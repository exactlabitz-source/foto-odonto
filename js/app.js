import { initGabarito } from "./gabarito.js";
import { initAvaliador } from "./avaliador.js";
import { initEditor } from "./editor.js";

const $ = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll(".tabs button")];

export function showTab(name) {
  tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === name)));
  document.querySelectorAll(".panel").forEach((p) => { p.hidden = p.id !== "tab-" + name; });
  document.dispatchEvent(new CustomEvent("tabchange", { detail: name }));
  window.scrollTo({ top: 0 });
  try { sessionStorage.setItem("tab", name); } catch (e) { /* sem armazenamento */ }
}

tabs.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-goto]");
  if (g) showTab(g.dataset.goto);
});

initGabarito();
initAvaliador();
initEditor();

// ---------- funcionamento sem internet (PWA) ----------
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
