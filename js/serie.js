// Série de fotos do protocolo (guardada só na memória do navegador) e geração do PDF.
import { GUIAS } from "./guides.js";

const MAX_LADO = 2000;
const QUALIDADE = 0.88;
const itens = new Map();          // id -> { bytes, w, h, url }
const ouvintes = new Set();

export const serie = {
  has: (id) => itens.has(id),
  get: (id) => itens.get(id),
  count: () => itens.size,
  onChange: (fn) => ouvintes.add(fn),
  async set(id, canvas, orig) {
    const s = Math.min(1, MAX_LADO / Math.max(canvas.width, canvas.height));
    let c = canvas;
    if (s < 1) {
      c = document.createElement("canvas");
      c.width = Math.round(canvas.width * s); c.height = Math.round(canvas.height * s);
      c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
    }
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", QUALIDADE));
    if (!blob) throw new Error("jpeg");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const velho = itens.get(id);
    if (velho) URL.revokeObjectURL(velho.url);
    itens.set(id, { bytes, w: c.width, h: c.height, url: URL.createObjectURL(blob), orig: orig || null });
    ouvintes.forEach((f) => f());
  },
  // grava a versão editada guardando a original (a primeira) para poder restaurar
  async apply(id, canvas) {
    const it = itens.get(id);
    const orig = it ? (it.orig || { bytes: it.bytes, w: it.w, h: it.h }) : null;
    await this.set(id, canvas, orig);
  },
  async restore(id) {
    const it = itens.get(id);
    if (!it || !it.orig) return;
    const blob = new Blob([it.orig.bytes], { type: "image/jpeg" });
    URL.revokeObjectURL(it.url);
    itens.set(id, { bytes: it.orig.bytes, w: it.orig.w, h: it.orig.h, url: URL.createObjectURL(blob), orig: null });
    ouvintes.forEach((f) => f());
  },
  clear() {
    itens.forEach((v) => URL.revokeObjectURL(v.url));
    itens.clear();
    ouvintes.forEach((f) => f());
  },
};

// ---------- escritor de PDF mínimo (sem bibliotecas) ----------
const latin1 = (s) => {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b[i] = c < 256 ? c : 63; }
  return b;
};
const esc = (s) => String(s).replace(/[\\()]/g, "\\$&").replace(/[\r\n]+/g, " ");
const n2 = (x) => (Math.round(x * 100) / 100).toString();

class Pdf {
  constructor() { this.partes = []; this.tam = 0; this.pos = []; this.raw("%PDF-1.4\n%âãÏÓ\n"); }
  raw(x) { const b = typeof x === "string" ? latin1(x) : x; this.partes.push(b); this.tam += b.length; }
  obj(n, dict, stream) {
    this.pos[n] = this.tam;
    if (stream) {
      this.raw(n + " 0 obj\n<< " + dict + " /Length " + stream.length + " >>\nstream\n");
      this.raw(stream); this.raw("\nendstream\nendobj\n");
    } else this.raw(n + " 0 obj\n" + dict + "\nendobj\n");
  }
  fim(total) {
    const ini = this.tam;
    let x = "xref\n0 " + total + "\n0000000000 65535 f \n";
    for (let i = 1; i < total; i++) x += String(this.pos[i]).padStart(10, "0") + " 00000 n \n";
    x += "trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + ini + "\n%%EOF\n";
    this.raw(x);
    return new Blob(this.partes, { type: "application/pdf" });
  }
}

const PW = 595, PH = 842, M = 36;
const PAGINAS = [
  { ids: ["face-repouso", "face-sorriso", "perfil-repouso", "perfil-sorriso"], altura: 300 },
  { ids: ["labio-repouso", "intra-frontal", "lateral-esq", "lateral-dir"], altura: 232 },
];

async function logoJpeg() {
  const img = document.querySelector(".top .logo");
  if (!img || !img.naturalWidth) return null;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.92));
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
}

export async function gerarPdf(identificacao) {
  const data = new Date().toLocaleDateString("pt-BR");
  const logo = await logoJpeg();
  const pdf = new Pdf();
  let prox = 5;                       // 1 catálogo, 2 páginas, 3 e 4 fontes
  const imgs = [];                    // { n, nome, bytes, w, h }
  const addImg = (nome, o) => { const e = { n: prox++, nome, ...o }; imgs.push(e); return e; };
  const logoRef = logo ? addImg("Logo", logo) : null;

  const paginas = PAGINAS
    .map((p) => ({ ...p, fotos: p.ids.filter((id) => serie.has(id)) }))
    .filter((p) => p.fotos.length > 0);
  const total = paginas.length;
  const usadas = {};
  paginas.forEach((p) => p.fotos.forEach((id) => { usadas[id] = addImg("Im" + id.replace(/\W/g, ""), serie.get(id)); }));

  imgs.forEach((im) => pdf.obj(im.n,
    "/Type /XObject /Subtype /Image /Width " + im.w + " /Height " + im.h +
    " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode", im.bytes));
  pdf.obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  pdf.obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const xobj = "/XObject << " + imgs.map((im) => "/" + im.nome + " " + im.n + " 0 R").join(" ") + " >>";
  const recursos = "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> " + xobj + " >>";
  const texto = (fonte, tam, x, yTopo, s, cinza = 0) =>
    "BT /" + fonte + " " + tam + " Tf " + cinza + " g " + n2(x) + " " + n2(PH - yTopo) + " Td (" + esc(s) + ") Tj ET\n";
  const figura = (nome, x, yTopo, w, h) => "q " + n2(w) + " 0 0 " + n2(h) + " " + n2(x) + " " + n2(PH - yTopo - h) + " cm /" + nome + " Do Q\n";

  const idPagina = []; let n = prox;
  paginas.forEach((p, pi) => {
    let c = "";
    let xTitulo = M;
    if (logoRef) {
      const lh = 30, lw = lh * logoRef.w / logoRef.h;
      c += figura(logoRef.nome, M, M, lw, lh); xTitulo = M + lw + 14;
    }
    c += texto("F2", 14, xTitulo, M + 13, "Documentação fotográfica", 0.04);
    const sub = (identificacao ? "Identificação: " + identificacao + "   |   " : "") + "Data: " + data;
    c += texto("F1", 9, xTitulo, M + 27, sub, 0.35);
    c += "0.894 0 0.447 RG 2 w " + M + " " + (PH - 74) + " m " + (PW - M) + " " + (PH - 74) + " l S\n";

    const larg = (PW - 2 * M - 16) / 2;
    p.ids.forEach((id, i) => {
      const col = i % 2, lin = Math.floor(i / 2);
      const x0 = M + col * (larg + 16), y0 = 92 + lin * (p.altura + 34);
      const g = GUIAS.find((q) => q.id === id);
      if (usadas[id]) {
        const im = usadas[id];
        const s = Math.min(larg / im.w, p.altura / im.h);
        const w = im.w * s, h = im.h * s;
        c += figura(im.nome, x0 + (larg - w) / 2, y0 + (p.altura - h) / 2, w, h);
      } else {
        c += "0.7 G 0.8 w [3 3] 0 d " + n2(x0) + " " + n2(PH - y0 - p.altura) + " " + n2(larg) + " " + p.altura + " re S [] 0 d\n";
        c += texto("F1", 9, x0 + larg / 2 - 40, y0 + p.altura / 2, "foto não registrada", 0.5);
      }
      c += texto("F2", 10, x0, y0 + p.altura + 15, g.nome, 0.1);
    });
    c += texto("F1", 8, M, PH - 22, "Gerado no navegador, sem envio de dados. EXACT Odontologia Digital.", 0.5);
    c += texto("F1", 8, PW - M - 40, PH - 22, "Página " + (pi + 1) + "/" + total, 0.5);
    const idC = n++, idP = n++;
    pdf.obj(idC, "", latin1(c));
    pdf.obj(idP, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW + " " + PH + "] " + recursos + " /Contents " + idC + " 0 R >>");
    idPagina.push(idP);
  });
  pdf.obj(2, "<< /Type /Pages /Kids [" + idPagina.map((i) => i + " 0 R").join(" ") + "] /Count " + idPagina.length + " >>");
  pdf.obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  return pdf.fim(n);
}
