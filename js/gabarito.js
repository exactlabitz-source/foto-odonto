import { GUIAS } from "./guides.js";
import { state, setPhoto, loadFile, onPhoto, bitmapToCanvas } from "./state.js";
import { serie, gerarPdf } from "./serie.js";

const $ = (id) => document.getElementById(id);
let guia = GUIAS[0];
let stream = null;
let facing = "environment";
let galleryUrl = null;
// padronização do protocolo: câmera sempre aberta em 2,5x
const ZOOM_ALVO = 2.5;
let zoomDigital = 1; // fator aplicado por recorte quando o navegador não deixa controlar o zoom da câmera

function renderChips() {
  const box = $("guideChips");
  box.innerHTML = "";
  GUIAS.forEach((g) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = (serie.has(g.id) ? "✓ " : "") + g.nome;
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", String(g.id === guia.id));
    b.addEventListener("click", () => { guia = g; applyGuide(); renderChips(); renderSerie(); });
    box.appendChild(b);
  });
}

function applyGuide() {
  $("stage").className = "stage " + guia.orient;
  $("overlay").innerHTML = guia.svg;
  const info = $("guideInfo");
  info.innerHTML = "";
  const h = document.createElement("h3");
  h.textContent = guia.nome + ": o que conferir";
  const ul = document.createElement("ul");
  const padrao = guia.orient === "port"
    ? "Padrão do protocolo: zoom 2,5x, celular na vertical, a cerca de 1 metro."
    : "Padrão do protocolo: zoom 2,5x, celular na horizontal, a cerca de 30 a 50 cm.";
  [padrao, ...guia.dica].forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
  info.append(h, ul);
}

function showMsg(t) { $("camMsg").textContent = t || ""; }

async function openCam() {
  showMsg("");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMsg("Este navegador não permite abrir a câmera aqui. Use “Usar foto da galeria”.");
    return;
  }
  stopCam();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 4032 }, height: { ideal: 3024 } },
      audio: false,
    });
  } catch (e) {
    const negado = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
    showMsg(negado
      ? "Permissão da câmera negada. Libere o acesso nas configurações do navegador ou use “Usar foto da galeria”."
      : "Não foi possível abrir a câmera neste aparelho. Use “Usar foto da galeria”.");
    return;
  }
  clearGallery();
  const v = $("cam");
  await aplicarZoom(v);
  v.srcObject = stream;
  v.hidden = false;
  try { await v.play(); } catch (e) { /* autoplay já cuida */ }
  $("stageEmpty").hidden = true;
  $("btnShot").hidden = false;
  $("btnFlip").hidden = false;
  $("btnCam").textContent = "Reiniciar câmera";
  // traz o quadro para a tela (no celular deitado, o quadro ocupa toda a altura)
  try { $("stage").scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) { /* ignora */ }
}

// abre a câmera em 2,5x: usa o zoom real da câmera quando o navegador permite; senão, recorta digitalmente
async function aplicarZoom(v) {
  zoomDigital = 1;
  v.style.transform = "";
  const tag = $("zoomTag");
  let texto = "";
  try {
    const track = stream.getVideoTracks()[0];
    const cap = track.getCapabilities ? track.getCapabilities() : {};
    if (cap.zoom && typeof cap.zoom.max === "number") {
      const z = Math.min(cap.zoom.max, Math.max(cap.zoom.min || 1, ZOOM_ALVO));
      await track.applyConstraints({ advanced: [{ zoom: z }] });
      const real = (track.getSettings && track.getSettings().zoom) || z;
      if (Math.abs(real - ZOOM_ALVO) < 0.05) texto = "Zoom 2,5x (câmera)";
      else {
        // a câmera não chega a 2,5x: completa o restante com recorte digital
        zoomDigital = ZOOM_ALVO / real;
        texto = "Zoom 2,5x (" + String(real.toFixed(1)).replace(".", ",") + "x câmera + recorte)";
      }
    } else {
      zoomDigital = ZOOM_ALVO;
      texto = "Zoom 2,5x (recorte digital)";
    }
  } catch (e) {
    zoomDigital = ZOOM_ALVO;
    texto = "Zoom 2,5x (recorte digital)";
  }
  if (zoomDigital > 1) v.style.transform = "scale(" + zoomDigital + ")";
  if (tag) { tag.textContent = texto; tag.hidden = !texto; }
}

function stopCam() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  const v = $("cam");
  v.srcObject = null;
  v.style.transform = "";
  zoomDigital = 1;
  if ($("zoomTag")) $("zoomTag").hidden = true;
  v.hidden = true;
  $("btnShot").hidden = true;
  $("btnFlip").hidden = true;
  $("btnCam").textContent = "Abrir câmera";
}

function clearGallery() {
  if (galleryUrl) { URL.revokeObjectURL(galleryUrl); galleryUrl = null; }
  $("galleryImg").hidden = true;
  $("galleryImg").removeAttribute("src");
}

async function shoot() {
  const v = $("cam");
  if (!v.videoWidth) { showMsg("A câmera ainda não está pronta. Aguarde um instante."); return; }
  // recorta o vídeo do mesmo modo que o quadro mostra (object-fit: cover)
  const stage = $("stage").getBoundingClientRect();
  const ar = stage.width / stage.height;
  const vw = v.videoWidth, vh = v.videoHeight;
  let sw = vw, sh = vh;
  if (vw / vh > ar) sw = vh * ar; else sh = vw / ar;
  sw /= zoomDigital; sh /= zoomDigital; // recorte central quando o zoom é digital
  const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
  const c = document.createElement("canvas");
  c.width = Math.round(sw); c.height = Math.round(sh);
  c.getContext("2d").drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const bmp = await createImageBitmap(c);
  setPhoto(bmp, "captura_" + guia.id);
  await guardar(c, true);
}

// guarda a foto na série do protocolo (só na memória) e, na câmera, avança para a próxima foto pendente
async function guardar(canvas, avancar) {
  const atual = guia;
  try { await serie.set(atual.id, canvas); }
  catch (e) { showMsg("Não consegui guardar esta foto na série."); return; }
  const i = GUIAS.indexOf(atual);
  const prox = avancar ? [...GUIAS.slice(i + 1), ...GUIAS.slice(0, i)].find((g) => !serie.has(g.id)) : null;
  if (prox) { guia = prox; applyGuide(); }
  renderChips();
  showMsg(prox
    ? "Foto “" + atual.nome + "” guardada. Próxima: " + prox.nome + "."
    : "Foto “" + atual.nome + "” guardada na série. " + (serie.count() === GUIAS.length ? "Série completa: gere o PDF abaixo." : "Escolha outra foto do protocolo ou gere o PDF."));
}

async function fromGallery(file) {
  if (!file) return;
  try {
    const bmp = await loadFile(file);
    stopCam();
    clearGallery();
    galleryUrl = URL.createObjectURL(file);
    const img = $("galleryImg");
    img.src = galleryUrl;
    img.hidden = false;
    $("stageEmpty").hidden = true;
    setPhoto(bmp, "captura_" + guia.id);
    await guardar(bitmapToCanvas(bmp, 2000), false);
  } catch (e) {
    showMsg("Não consegui abrir essa imagem. Tente JPG ou PNG.");
  }
}

function updateThumb() {
  const card = $("shotResult");
  if (!state.bitmap) { card.hidden = true; return; }
  const c = bitmapToCanvas(state.bitmap, 900);
  $("shotThumb").src = c.toDataURL("image/jpeg", 0.85);
  card.hidden = false;
}

function renderSerie() {
  const box = $("serieGrid");
  box.innerHTML = "";
  GUIAS.forEach((g, i) => {
    const it = serie.get(g.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot" + (it ? " done" : "") + (g.id === guia.id ? " cur" : "");
    b.setAttribute("aria-label", g.nome + (it ? " (guardada)" : " (pendente)"));
    const th = document.createElement("span");
    th.className = "th";
    if (it) th.style.backgroundImage = "url(" + it.url + ")"; else th.textContent = String(i + 1);
    const lb = document.createElement("span");
    lb.className = "lb"; lb.textContent = g.curto;
    b.append(th, lb);
    b.addEventListener("click", () => { guia = g; applyGuide(); renderChips(); renderSerie(); $("stage").scrollIntoView({ block: "center", behavior: "smooth" }); });
    box.appendChild(b);
  });
  $("serieCount").textContent = serie.count() + " de " + GUIAS.length + " fotos";
  $("btnPdf").disabled = serie.count() === 0;
}

let ultimoPdf = null;
async function fazerPdf(compartilhar) {
  const msg = $("pdfMsg");
  if (!serie.count()) { msg.textContent = "Capture ou escolha ao menos uma foto."; return; }
  $("btnPdf").disabled = true; msg.textContent = "Montando o PDF…";
  try {
    const ident = $("serieId").value.trim().slice(0, 40);
    const blob = await gerarPdf(ident);
    const nome = "documentacao_fotografica_" + new Date().toISOString().slice(0, 10) + ".pdf";
    const falta = GUIAS.filter((g) => !serie.has(g.id)).map((g) => g.nome);
    const file = new File([blob], nome, { type: "application/pdf" });
    if (compartilhar && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Documentação fotográfica" });
    } else {
      const a = document.createElement("a");
      if (ultimoPdf) URL.revokeObjectURL(ultimoPdf);
      ultimoPdf = URL.createObjectURL(blob);
      a.href = ultimoPdf; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
    }
    msg.textContent = "PDF pronto (" + Math.round(blob.size / 1024) + " KB)." + (falta.length ? " Ficaram em branco: " + falta.join(", ") + "." : "");
  } catch (e) {
    if (e && e.name === "AbortError") msg.textContent = "";
    else msg.textContent = "Não consegui gerar o PDF neste aparelho.";
  } finally { renderSerie(); }
}

export function initGabarito() {
  renderChips();
  applyGuide();
  renderSerie();
  serie.onChange(() => { renderChips(); renderSerie(); });
  $("btnPdf").addEventListener("click", () => fazerPdf(false));
  const f = new File([new Blob(["x"])], "a.pdf", { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    $("btnPdfShare").hidden = false;
    $("btnPdfShare").addEventListener("click", () => fazerPdf(true));
  }
  $("btnSerieClear").addEventListener("click", () => { if (!serie.count() || confirm("Apagar todas as fotos da série?")) { serie.clear(); showMsg(""); $("pdfMsg").textContent = ""; } });
  $("btnCam").addEventListener("click", openCam);
  $("btnShot").addEventListener("click", shoot);
  $("btnFlip").addEventListener("click", () => { facing = facing === "environment" ? "user" : "environment"; openCam(); });
  $("galleryInput").addEventListener("change", (e) => { fromGallery(e.target.files[0]); e.target.value = ""; });
  onPhoto(updateThumb);
  // economiza bateria: desliga a câmera ao sair da aba
  document.addEventListener("tabchange", (e) => { if (e.detail !== "gabarito") stopCam(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopCam(); });
}

export { GUIAS };
