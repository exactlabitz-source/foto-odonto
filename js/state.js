// Estado compartilhado entre as abas: a foto "atual" fica só na memória do navegador.
const listeners = new Set();
export const state = { bitmap: null, nome: "foto" };

export function onPhoto(fn) { listeners.add(fn); }

export function setPhoto(bitmap, nome = "foto") {
  if (state.bitmap && state.bitmap !== bitmap && state.bitmap.close) {
    try { state.bitmap.close(); } catch (e) { /* ignora */ }
  }
  state.bitmap = bitmap;
  state.nome = nome.replace(/\.[^.]+$/, "") || "foto";
  listeners.forEach((fn) => fn(state));
}

// Carrega um arquivo de imagem respeitando a orientação do EXIF.
export async function loadFile(file) {
  if (!file) return null;
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (e) {
    // fallback para navegadores sem suporte à opção
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function bitmapToCanvas(bmp, maxDim) {
  const s = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}
