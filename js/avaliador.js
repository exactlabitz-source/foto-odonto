import { state, setPhoto, loadFile, onPhoto, bitmapToCanvas } from "./state.js";
import { GUIAS } from "./guides.js";
import { serie } from "./serie.js";

const $ = (id) => document.getElementById(id);
const ANALISE_W = 640;   // largura de análise (mantém as medidas comparáveis entre aparelhos)
const TILE = 8;
export const TUNE = { floor: 8 };   // piso de gradiente (ignora variações pequenas, típicas de ruído)          // grade de blocos para medir nitidez

export function analyze(bitmap) {
  const s = Math.min(1, ANALISE_W / bitmap.width);
  const w = Math.max(16, Math.round(bitmap.width * s));
  const h = Math.max(16, Math.round(bitmap.height * s));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  const n = w * h;
  const lum = new Float32Array(n);
  const hist = new Uint32Array(64);
  let sum = 0, clipped = 0, dark = 0, sumLit = 0, nLit = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = d[p], g = d[p + 1], b = d[p + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum[i] = y; sum += y;
    hist[Math.min(63, y >> 2)]++;
    if (Math.min(r, g, b) >= 245) clipped++;
    if (y < 20) dark++; else { sumLit += y; nLit++; }
  }
  const mean = sum / n;
  // Exposição: média só dos pixels iluminados. Em intraoral o contrastador preto e a cavidade escura
  // puxam a média para baixo mesmo com a foto bem exposta.
  const meanLit = nLit > 0.1 * n ? sumLit / nLit : mean;

  // Nitidez: método de "re-desfoque" (Crête et al.). Desfoca a imagem em 1x9 e mede quanto da
  // variação de borda se perdeu: foto nítida perde muito (valor baixo), foto borrada perde pouco (valor alto).
  // Usa só o quartil de blocos com mais detalhe, porque em foto odontológica o fundo é desfocado de propósito.
  const K = 4; // meia-janela do desfoque (9 amostras)
  const tw = Math.floor(w / TILE), th = Math.floor(h / TILE);
  const sumF = new Float64Array(TILE * TILE), sumV = new Float64Array(TILE * TILE);
  const addPair = (x, y, a0, a1, b0, b1) => {
    const t = Math.min(TILE - 1, Math.floor(y / th)) * TILE + Math.min(TILE - 1, Math.floor(x / tw));
    const dF = Math.abs(a1 - a0), dB = Math.abs(b1 - b0);
    if (dF < TUNE.floor) return;
    sumF[t] += dF; sumV[t] += Math.max(0, dF - dB);
  };
  const blurAt = (x, y, dx, dy) => {
    let acc = 0;
    for (let k = -K; k <= K; k++) {
      const xx = Math.min(w - 1, Math.max(0, x + k * dx)), yy = Math.min(h - 1, Math.max(0, y + k * dy));
      acc += lum[yy * w + xx];
    }
    return acc / (2 * K + 1);
  };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      addPair(x, y, lum[i], lum[i + 1], blurAt(x, y, 1, 0), blurAt(x + 1, y, 1, 0));
      addPair(x, y, lum[i], lum[i + w], blurAt(x, y, 0, 1), blurAt(x, y + 1, 0, 1));
    }
  }
  const tiles = Array.from(sumF, (f, i) => [f, sumV[i]]).sort((a, b) => b[0] - a[0]);
  const nq = Math.max(1, Math.round(tiles.length / 4));
  let F = 0, V = 0;
  for (let i = 0; i < nq; i++) { F += tiles[i][0]; V += tiles[i][1]; }
  const blur = F > 0 ? 1 - V / F : 1;   // 0 = nítida, 1 = muito borrada

  return {
    w: bitmap.width, h: bitmap.height,
    mean, meanLit, clipped: clipped / n, dark: dark / n, blur,
    hist: Array.from(hist),
  };
}

// Limiares empíricos (análise em 640 px de largura). São indicadores de apoio.
// Calibrados com 16 fotos intraorais reais, nítidas (desfoque 0,11 a 0,22), e com versões borradas, tremidas e com ruído.
const BLUR_ATENCAO = 0.30, BLUR_RUIM = 0.45;
export function judge(m) {
  const items = [];
  const longSide = Math.max(m.w, m.h);

  // Nitidez
  let st = "ok", sd = "Foco adequado para documentação.";
  if (m.blur >= BLUR_RUIM) { st = "bad"; sd = "Parece fora de foco ou tremida. Toque na tela sobre o dente para focar, apoie o celular e use temporizador."; }
  else if (m.blur >= BLUR_ATENCAO) { st = "warn"; sd = "Nitidez no limite. Mantenha o zoom padrão de 2,5x e ajuste a distância, melhore a luz e confira o foco antes de disparar."; }
  items.push({ titulo: "Nitidez (foco)", status: st, valor: "desfoque estimado: " + Math.round(m.blur * 100) + "% (menor é melhor)", dica: sd });

  // Áreas estouradas / reflexos
  const cp = m.clipped * 100;
  let ct = "ok", cd = "Sem excesso de áreas estouradas.";
  if (cp > 6) { ct = "bad"; cd = "Muitas áreas estouradas (reflexo ou luz forte demais). Seque a superfície, afaste a luz ou use difusor, e mude levemente o ângulo."; }
  else if (cp > 1.5) { ct = "warn"; cd = "Há áreas estouradas. Pode ser reflexo de saliva ou luz direta; veja se perdeu detalhe nos dentes."; }
  items.push({ titulo: "Reflexos e áreas estouradas", status: ct, valor: cp.toFixed(1).replace(".", ",") + "% dos pixels", dica: cd });

  // Exposição geral
  let et = "ok", ed = "Luminosidade média adequada.";
  const L = m.meanLit;
  if (L < 55) { et = "bad"; ed = "Imagem muito escura. Melhore a luz em vez de clarear depois: o ruído aparece e a cor muda."; }
  else if (L < 85) { et = "warn"; ed = "Imagem um pouco escura. Considere mais luz ou toque na tela para ajustar a exposição sobre os dentes."; }
  else if (L > 205) { et = "bad"; ed = "Imagem muito clara. Reduza a luz ou a exposição para não perder detalhe do esmalte."; }
  else if (L > 175) { et = "warn"; ed = "Imagem um pouco clara. Confira se o esmalte ainda mostra textura."; }
  items.push({ titulo: "Exposição geral", status: et, valor: "média " + Math.round(L) + " de 255 (sem contar áreas pretas)", dica: ed });

  // Resolução
  let rt = "ok", rd = "Resolução suficiente para tela, impressão pequena e apresentação.";
  if (longSide < 1200) { rt = "bad"; rd = "Resolução baixa. Prefira o aplicativo de câmera do celular na qualidade máxima, sem compartilhar por mensageiros (eles reduzem a imagem)."; }
  else if (longSide < 2000) { rt = "warn"; rd = "Resolução aceitável para tela. Para impressão ou análise de detalhe, use a câmera nativa em qualidade máxima."; }
  items.push({ titulo: "Resolução", status: rt, valor: m.w + " × " + m.h + " px", dica: rd });

  const bad = items.filter((i) => i.status === "bad").length;
  const warn = items.filter((i) => i.status === "warn").length;
  let nivel = "ok", titulo = "Boa para documentação", texto = "Nenhum problema técnico importante encontrado.";
  if (bad > 0) { nivel = "bad"; titulo = "Refazer é recomendado"; texto = "Há problema técnico que pode comprometer a foto. Veja os itens em vermelho."; }
  else if (warn > 0) { nivel = "warn"; titulo = "Aceitável, com pontos a melhorar"; texto = "Dá para usar, mas confira os avisos em amarelo."; }
  return { items, nivel, titulo, texto };
}

function drawHist(m) {
  const c = $("evalHist");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  const max = Math.max(...m.hist.slice(1, 63), 1);
  const bw = c.width / m.hist.length;
  m.hist.forEach((v, i) => {
    const hgt = Math.min(1, v / max) * (c.height - 8);
    ctx.fillStyle = i >= 61 ? "#FF8DC0" : "#E40072";
    ctx.fillRect(i * bw, c.height - hgt, Math.max(1, bw - 1), hgt);
  });
}

// ---------- fotos da série do Gabarito ----------
let slotAv = null;
const cacheAv = new Map(); // url -> { nivel }
const ROT = { ok: "Ok", warn: "Atenção", bad: "Refazer" };

async function nivelDe(it) {
  if (cacheAv.has(it.url)) return cacheAv.get(it.url);
  let nivel = null;
  try {
    const bmp = await createImageBitmap(new Blob([it.bytes], { type: "image/jpeg" }));
    nivel = judge(analyze(bmp)).nivel;
    if (bmp.close) bmp.close();
  } catch (e) { /* sem avaliação */ }
  cacheAv.set(it.url, nivel);
  return nivel;
}

async function openSlotAv(id) {
  const it = serie.get(id);
  if (!it) return;
  try {
    const bmp = await createImageBitmap(new Blob([it.bytes], { type: "image/jpeg" }));
    slotAv = id;
    setPhoto(bmp, "captura_" + id);
    renderSerieAv();
  } catch (e) { alert("Não consegui abrir esta foto."); }
}

let rodada = 0;
async function renderSerieAv() {
  const card = $("evalSerie");
  card.hidden = serie.count() === 0;
  if (card.hidden) return;
  const eu = ++rodada;
  const box = $("evalSerieGrid");
  box.innerHTML = "";
  const tags = {};
  GUIAS.forEach((g, i) => {
    const it = serie.get(g.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "slot" + (it ? " done" : "") + (g.id === slotAv ? " cur" : "");
    b.disabled = !it;
    b.setAttribute("aria-label", g.nome + (it ? "" : " (sem foto)"));
    const th = document.createElement("span");
    th.className = "th";
    if (it) th.style.backgroundImage = "url(" + it.url + ")"; else th.textContent = String(i + 1);
    const lb = document.createElement("span");
    lb.className = "lb"; lb.textContent = g.curto;
    const tg = document.createElement("span");
    tg.className = "tag av"; tg.hidden = true;
    tags[g.id] = tg;
    b.append(th, lb, tg);
    b.addEventListener("click", () => openSlotAv(g.id));
    box.appendChild(b);
  });
  const cont = { ok: 0, warn: 0, bad: 0 };
  for (const g of GUIAS) {
    const it = serie.get(g.id);
    if (!it) continue;
    const n = await nivelDe(it);
    if (eu !== rodada) return; // outra renderização começou
    if (n) { cont[n]++; tags[g.id].hidden = false; tags[g.id].textContent = ROT[n]; tags[g.id].className = "tag av " + n; }
  }
  $("evalSerieSum").textContent = serie.count() + " foto(s) na série: " + cont.ok + " ok, " + cont.warn + " com atenção, " + cont.bad + " para refazer.";
}

function render() {
  if (!state.bitmap) { $("evalEmpty").hidden = false; $("evalOut").hidden = true; return; }
  $("evalEmpty").hidden = true;
  $("evalOut").hidden = false;
  const m = analyze(state.bitmap);
  const j = judge(m);

  const pv = $("evalPreview");
  const small = bitmapToCanvas(state.bitmap, 700);
  pv.width = small.width; pv.height = small.height;
  pv.getContext("2d").drawImage(small, 0, 0);

  const v = $("evalVerdict");
  v.className = "verdict " + j.nivel;
  v.innerHTML = "";
  const s = document.createElement("strong"); s.textContent = j.titulo;
  const p = document.createElement("span"); p.textContent = j.texto;
  v.append(s, p);

  const box = $("evalItems");
  box.innerHTML = "";
  const rot = { ok: "Ok", warn: "Atenção", bad: "Refazer" };
  j.items.forEach((it) => {
    const el = document.createElement("div");
    el.className = "item " + it.status;
    const hd = document.createElement("header");
    const h4 = document.createElement("h4"); h4.textContent = it.titulo;
    const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = rot[it.status];
    hd.append(h4, tag);
    const val = document.createElement("div"); val.className = "val"; val.textContent = it.valor;
    const pp = document.createElement("p"); pp.textContent = it.dica;
    el.append(hd, val, pp);
    box.appendChild(el);
  });
  drawHist(m);
}

export function initAvaliador() {
  $("evalInput").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try { setPhoto(await loadFile(f), f.name); }
    catch (err) { alert("Não consegui abrir essa imagem. Tente JPG ou PNG."); }
  });
  onPhoto(() => { if (!$("tab-avaliador").hidden) render(); });
  serie.onChange(() => { if (!$("tab-avaliador").hidden) renderSerieAv(); });
  document.addEventListener("tabchange", (e) => {
    if (e.detail !== "avaliador") return;
    renderSerieAv();
    const primeira = GUIAS.find((g) => serie.has(g.id));
    // sem foto aberta (ou só uma captura antiga): abre a primeira da série
    if (primeira && (!state.bitmap || (state.nome.startsWith("captura_") && !slotAv))) openSlotAv(primeira.id);
    else render();
  });
}
