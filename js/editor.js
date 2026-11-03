import { state, setPhoto, loadFile, onPhoto } from "./state.js";
import { serie } from "./serie.js";
import { GUIAS } from "./guides.js";

const $ = (id) => document.getElementById(id);
const PREVIEW_MAX = 1100;
const EXPORT_MAX = 4096;

const DEFAULTS = { ev: 0, shadows: 0, highlights: 0, contrast: 0, sat: 0, temp: 0, tint: 0, sharp: 0, rot: 0 };
const SLIDERS = [
  { k: "ev", label: "Brilho", hint: "mais escuro ↔ mais claro", min: -2, max: 2, step: 0.05, fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(2).replace(".", ",") },
  { k: "contrast", label: "Contraste", hint: "menos ↔ mais", min: -50, max: 50, step: 1 },
  { k: "temp", label: "Cor (calor)", hint: "mais frio (azulado) ↔ mais quente (amarelado)", min: -100, max: 100, step: 1 },
  { k: "sharp", label: "Nitidez", hint: "use pouco, para não criar halos", min: 0, max: 100, step: 1 },
  { adv: true, k: "highlights", label: "Realces", hint: "recupera áreas muito claras", min: -100, max: 100, step: 1 },
  { adv: true, k: "shadows", label: "Sombras", hint: "clareia áreas escuras", min: -100, max: 100, step: 1 },
  { adv: true, k: "tint", label: "Matiz", hint: "verde ↔ magenta", min: -100, max: 100, step: 1 },
  { adv: true, k: "sat", label: "Saturação", min: -50, max: 50, step: 1 },
  { adv: true, k: "rot", label: "Endireitar", hint: "gira a foto para nivelar o plano", min: -8, max: 8, step: 0.1, fmt: (v) => v.toFixed(1).replace(".", ",") + "°" },
];
const CROPS = [
  { id: "orig", nome: "Original", ar: null },
  { id: "1:1", nome: "1:1", ar: 1 },
  { id: "4:3", nome: "4:3", ar: 4 / 3 },
  { id: "3:2", nome: "3:2", ar: 3 / 2 },
  { id: "16:9", nome: "16:9", ar: 16 / 9 },
  { id: "3:4", nome: "3:4 (vertical)", ar: 3 / 4 },
];

let p = { ...DEFAULTS };
let crop = CROPS[0];
let wb = [1, 1, 1];          // ganhos de balanço de branco (linear)
let picking = false;
let holding = false;
let raf = 0;
let base = null;             // canvas com corte/rotação, sem ajustes de pixel

// ---------- tabelas sRGB <-> linear ----------
const toLin = new Float32Array(256);
for (let i = 0; i < 256; i++) { const v = i / 255; toLin[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
const FROM_N = 4096;
const fromLin = new Uint8ClampedArray(FROM_N + 1);
for (let i = 0; i <= FROM_N; i++) { const v = i / FROM_N; fromLin[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
const toDisp = (lin) => fromLin[Math.min(FROM_N, Math.max(0, Math.round(lin * FROM_N)))];

// ---------- geometria: corte + rotação ----------
function frameSize(bw, bh) {
  if (!crop.ar) return { cw: bw, ch: bh };
  const ar = crop.ar;
  let cw = bw, ch = bw / ar;
  if (ch > bh) { ch = bh; cw = bh * ar; }
  return { cw, ch };
}

function drawBase(maxDim) {
  const bmp = state.bitmap;
  const { cw, ch } = frameSize(bmp.width, bmp.height);
  const scale = Math.min(1, maxDim / Math.max(cw, ch));
  const outW = Math.max(1, Math.round(cw * scale)), outH = Math.max(1, Math.round(ch * scale));
  const c = document.createElement("canvas");
  c.width = outW; c.height = outH;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const th = (p.rot * Math.PI) / 180;
  const cs = Math.abs(Math.cos(th)), sn = Math.abs(Math.sin(th));
  // zoom mínimo para que a imagem girada cubra todo o quadro
  const k = Math.max(1, (cw * cs + ch * sn) / bmp.width, (cw * sn + ch * cs) / bmp.height);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(th);
  ctx.scale(scale * k, scale * k);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  return c;
}

// ---------- ajustes de pixel ----------
function adjust(imgData, par, gains) {
  const d = imgData.data;
  const ev = Math.pow(2, par.ev);
  const gr = gains[0] * ev * (1 + par.temp * 0.003);
  const gg = gains[1] * ev * (1 - par.tint * 0.003);
  const gb = gains[2] * ev * (1 - par.temp * 0.003);
  const sh = par.shadows / 100, hi = par.highlights / 100;
  const ct = 1 + par.contrast / 100, sa = 1 + par.sat / 100;
  const tone = sh !== 0 || hi !== 0, doCt = ct !== 1, doSat = sa !== 1;
  for (let i = 0; i < d.length; i += 4) {
    let r = toDisp(toLin[d[i]] * gr) / 255;
    let g = toDisp(toLin[d[i + 1]] * gg) / 255;
    let b = toDisp(toLin[d[i + 2]] * gb) / 255;
    if (tone) {
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const f = 1 + sh * 0.6 * (1 - L) * (1 - L) + hi * 0.5 * L * L;
      r *= f; g *= f; b *= f;
    }
    if (doCt) { r = (r - 0.5) * ct + 0.5; g = (g - 0.5) * ct + 0.5; b = (b - 0.5) * ct + 0.5; }
    if (doSat) {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = y + (r - y) * sa; g = y + (g - y) * sa; b = y + (b - y) * sa;
    }
    d[i] = r < 0 ? 0 : r > 1 ? 255 : r * 255;
    d[i + 1] = g < 0 ? 0 : g > 1 ? 255 : g * 255;
    d[i + 2] = b < 0 ? 0 : b > 1 ? 255 : b * 255;
  }
}

function sharpen(imgData, amount) {
  if (amount <= 0) return;
  const { width: w, height: h, data: d } = imgData;
  const src = new Uint8ClampedArray(d);
  const a = (amount / 100) * 1.2;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const k = i + c;
        const blur = (src[k - 4] + src[k + 4] + src[k - w * 4] + src[k + w * 4] + src[k] * 4) / 8;
        d[k] = src[k] + a * (src[k] - blur);
      }
    }
  }
}

function process(canvas, par, gains) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  adjust(img, par, gains);
  sharpen(img, par.sharp);
  ctx.putImageData(img, 0, 0);
}

// ---------- ciclo de desenho ----------
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }

function render() {
  if (!state.bitmap) return;
  base = drawBase(PREVIEW_MAX);
  const out = $("edCanvas");
  out.width = base.width; out.height = base.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(base, 0, 0);
  if (!holding) process(out, p, wb);
}

function exportCanvas() {
  const c = drawBase(EXPORT_MAX);
  process(c, p, wb);
  return c;
}

// ---------- interface ----------
function buildSliders() {
  const main = $("edSliders"), more = $("edSlidersMore");
  main.innerHTML = ""; more.innerHTML = "";
  SLIDERS.forEach((s) => {
    const wrap = document.createElement("div"); wrap.className = "sl";
    const id = "sl-" + s.k;
    const lab = document.createElement("label"); lab.htmlFor = id;
    const t = document.createElement("span"); t.textContent = s.label;
    if (s.hint) { const h = document.createElement("small"); h.className = "hint"; h.textContent = s.hint; t.appendChild(h); }
    const o = document.createElement("output"); o.id = id + "-o";
    lab.append(t, o);
    const inp = document.createElement("input");
    inp.type = "range"; inp.id = id; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = p[s.k];
    const show = () => { o.textContent = s.fmt ? s.fmt(+inp.value) : (+inp.value > 0 ? "+" : "") + inp.value; };
    inp.addEventListener("input", () => { p[s.k] = +inp.value; show(); schedule(); });
    inp.addEventListener("dblclick", () => { inp.value = DEFAULTS[s.k]; p[s.k] = DEFAULTS[s.k]; show(); schedule(); });
    show();
    wrap.append(lab, inp);
    (s.adv ? more : main).appendChild(wrap);
  });
}

// ---------- melhoria automática (conservadora, não mexe na cor) ----------
function autoEnhance() {
  if (!state.bitmap) return;
  const b0 = drawBase(500);                       // análise em tamanho reduzido
  const d = b0.getContext("2d").getImageData(0, 0, b0.width, b0.height).data;
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    if (y >= 28) { hist[y]++; n++; }              // ignora o fundo escuro da boca
  }
  if (n < 200) { msg("Não encontrei área suficiente para analisar. Ajuste manualmente."); return; }
  const pct = (q) => { let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * q) return i; } return 255; };
  const med = pct(0.5), p5 = pct(0.05), p99 = pct(0.99);
  // brilho: só corrige quando a área iluminada está fora da faixa aceitável (mediana 125-185)
  let ev = 0;
  if (med < 125) ev = Math.log2(toLin[140] / Math.max(toLin[med], 1e-4));
  else if (med > 185) ev = Math.log2(toLin[170] / Math.max(toLin[med], 1e-4));
  ev = Math.max(-1, Math.min(1, ev));
  const cap = Math.log2(0.97 / Math.max(toLin[p99], 1e-4));
  ev = Math.min(ev, cap);
  if (Math.abs(ev) < 0.08) ev = 0;
  // contraste: só se a imagem estiver "achatada"
  const spread = p99 - p5;
  const contrast = spread < 175 ? Math.min(25, Math.round((190 - spread) / 3)) : 0;
  const sharp = 25;
  p = { ...DEFAULTS, ev: Math.round(ev * 20) / 20, contrast, sharp, rot: p.rot };
  wb = [1, 1, 1];
  syncSliders(); schedule();
  const fm = (v) => (v > 0 ? "+" : "") + String(v).replace(".", ",");
  msg("Melhoria aplicada: brilho " + fm(p.ev) + ", contraste " + fm(p.contrast) + ", nitidez +" + sharp + ". A cor não foi alterada: para corrigir a cor, use o cartão cinza (balanço de branco).");
}

function syncSliders() {
  SLIDERS.forEach((s) => {
    if (!s.k) return;
    const inp = $("sl-" + s.k); if (!inp) return;
    inp.value = p[s.k];
    inp.dispatchEvent(new Event("input"));
  });
}

function buildCrops() {
  const box = $("edCrop");
  box.innerHTML = "";
  CROPS.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = c.nome;
    b.setAttribute("aria-selected", String(c.id === crop.id));
    b.addEventListener("click", () => { crop = c; buildCrops(); schedule(); });
    box.appendChild(b);
  });
}

function msg(t) { $("edMsg").textContent = t || ""; }

function resetAll() {
  p = { ...DEFAULTS }; wb = [1, 1, 1]; crop = CROPS[0];
  syncSliders(); buildCrops(); msg(""); schedule();
}

// ---------- fotos da série do Gabarito ----------
let slotId = null;

function renderStrip() {
  const card = $("edSerie");
  card.hidden = serie.count() === 0;
  const box = $("edSerieGrid");
  box.innerHTML = "";
  GUIAS.forEach((g, i) => {
    const it = serie.get(g.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot" + (it ? " done" : "") + (it && it.orig ? " edited" : "") + (g.id === slotId ? " cur" : "");
    b.disabled = !it;
    b.setAttribute("aria-label", g.nome + (it ? (it.orig ? " (editada)" : "") : " (sem foto)"));
    const th = document.createElement("span");
    th.className = "th";
    if (it) th.style.backgroundImage = "url(" + it.url + ")"; else th.textContent = String(i + 1);
    const lb = document.createElement("span");
    lb.className = "lb"; lb.textContent = g.curto + (it && it.orig ? " ✎" : "");
    b.append(th, lb);
    b.addEventListener("click", () => openSlot(g.id));
    box.appendChild(b);
  });
  $("edApplyBox").hidden = !slotId;
  $("edRestore").hidden = !(slotId && serie.get(slotId) && serie.get(slotId).orig);
}

async function openSlot(id) {
  const it = serie.get(id);
  if (!it) return;
  try {
    const bmp = await createImageBitmap(new Blob([it.bytes], { type: "image/jpeg" }));
    resetAll();
    slotId = id;
    setPhoto(bmp, "serie_" + id);
    renderStrip();
  } catch (e) { msg("Não consegui abrir esta foto."); }
}

async function applyToSerie() {
  if (!slotId || !state.bitmap) return;
  const id = slotId;
  msg("Aplicando…");
  try { await serie.apply(id, exportCanvas()); }
  catch (e) { msg("Não consegui aplicar na série."); return; }
  const nome = GUIAS.find((g) => g.id === id).nome;
  const ids = GUIAS.map((g) => g.id).filter((x) => serie.has(x));
  const prox = ids[ids.indexOf(id) + 1];
  if (prox) {
    await openSlot(prox);
    msg("“" + nome + "” ajustada e guardada para o PDF. Agora: " + GUIAS.find((g) => g.id === prox).nome + ".");
  } else {
    await openSlot(id);
    msg("“" + nome + "” ajustada e guardada. Era a última: gere o PDF na aba Gabarito.");
  }
}

// baixa todas as fotos da série (versão guardada: editada ou original)
async function baixarTodas() {
  const ids = GUIAS.map((g) => g.id).filter((id) => serie.has(id));
  if (!ids.length) return;
  const files = ids.map((id) => new File([serie.get(id).bytes], id + (serie.get(id).orig ? "_editada" : "") + ".jpg", { type: "image/jpeg" }));
  if (navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files }); msg("Fotos compartilhadas."); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url; a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    await new Promise((r) => setTimeout(r, 450));
  }
  msg(files.length + " fotos baixadas. Se o navegador pedir, permita downloads múltiplos.");
}

async function restoreOriginal() {
  if (!slotId) return;
  const id = slotId;
  await serie.restore(id);
  await openSlot(id);
  msg("Original restaurada.");
}

function showState() {
  renderStrip();
  const has = !!state.bitmap;
  $("edEmpty").hidden = has;
  $("edWork").hidden = !has;
  if (has) schedule();
}

function pickWhite(ev) {
  if (!picking) return;
  const cv = $("edCanvas");
  const r = cv.getBoundingClientRect();
  const x = Math.round(((ev.clientX - r.left) / r.width) * cv.width);
  const y = Math.round(((ev.clientY - r.top) / r.height) * cv.height);
  const half = 4;
  const x0 = Math.max(0, x - half), y0 = Math.max(0, y - half);
  const w = Math.min(cv.width - x0, half * 2 + 1), h = Math.min(cv.height - y0, half * 2 + 1);
  if (!base || w < 1 || h < 1) return;
  // lê da imagem sem ajustes, para o ganho ser calculado sobre a cor original
  const d = base.getContext("2d").getImageData(x0, y0, w, h).data;
  let R = 0, G = 0, B = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { R += toLin[d[i]]; G += toLin[d[i + 1]]; B += toLin[d[i + 2]]; n++; }
  R /= n; G /= n; B /= n;
  if (G < 0.003 || R < 0.003 || B < 0.003) { msg("Área escura demais para servir de referência. Toque em uma superfície cinza ou branca bem iluminada."); return; }
  wb = [G / R, 1, G / B];
  p.temp = 0; p.tint = 0; syncSliders();
  picking = false; cv.classList.remove("picking");
  $("edPick").textContent = "Balanço de branco: tocar no cinza";
  msg("Balanço de branco aplicado a partir do ponto tocado. Use um cartão cinza (18%) ou uma superfície branca/cinza neutra.");
  schedule();
}

async function save(share) {
  if (!state.bitmap) return;
  msg("Gerando arquivo…");
  const c = exportCanvas();
  const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
  if (!blob) { msg("Não foi possível gerar o arquivo."); return; }
  const nome = (slotId || state.nome) + "_editada.jpg";
  if (share && navigator.canShare) {
    const file = new File([blob], nome, { type: "image/jpeg" });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); msg("Compartilhado."); return; } catch (e) { /* cancelado: cai no download */ }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  msg("Arquivo salvo: " + nome + " (" + c.width + " × " + c.height + " px).");
}

export function initEditor() {
  buildSliders(); buildCrops();
  $("edInput").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try { const bmp = await loadFile(f); resetAll(); slotId = null; setPhoto(bmp, "foto"); renderStrip(); }
    catch (err) { msg("Não consegui abrir essa imagem. Tente JPG ou PNG."); }
  });
  const hold = $("edHold");
  const on = (v) => () => { holding = v; schedule(); };
  ["pointerdown"].forEach((t) => hold.addEventListener(t, on(true)));
  ["pointerup", "pointerleave", "pointercancel"].forEach((t) => hold.addEventListener(t, on(false)));
  $("edPick").addEventListener("click", () => {
    picking = !picking;
    $("edCanvas").classList.toggle("picking", picking);
    $("edPick").textContent = picking ? "Toque no cinza da foto…" : "Balanço de branco: tocar no cinza";
    msg(picking ? "Toque, na foto, sobre o cartão cinza ou uma superfície neutra." : "");
  });
  $("edCanvas").addEventListener("click", pickWhite);
  $("edReset").addEventListener("click", resetAll);
  $("edAuto").addEventListener("click", autoEnhance);
  $("edSave").addEventListener("click", () => save(false));
  if (navigator.canShare) { $("edShare").hidden = false; $("edShare").addEventListener("click", () => save(true)); }
  $("edApply").addEventListener("click", applyToSerie);
  $("edAll").addEventListener("click", baixarTodas);
  $("edRestore").addEventListener("click", restoreOriginal);
  serie.onChange(renderStrip);
  onPhoto(() => { if (!state.nome.startsWith("serie_")) slotId = null; if (!$("tab-editor").hidden) showState(); });
  document.addEventListener("tabchange", (e) => {
    if (e.detail !== "editor") return;
    const primeira = GUIAS.find((g) => serie.has(g.id));
    if (primeira && !slotId && (!state.bitmap || state.nome.startsWith("captura_"))) openSlot(primeira.id);
    else showState();
  });
}
