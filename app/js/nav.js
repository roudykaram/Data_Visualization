// Configure l'ordre des pages ici
const DV_PAGES = [
  "../vis2.2/index.html",  // 1) cycle
  "../visu_1/index.html",  // 2) plateformes
  "../visu3/index.html"    // 3) diagnostic
];

function currentIndex() {
  const path = window.location.pathname.replace(/\\/g, "/");
  const found = DV_PAGES.findIndex(p => path.endsWith(p.replace("../","/app/")));
  return found; // peut être -1 si live-server change le chemin
}

function resolveIndexFallback() {
  const href = window.location.href;
  if (href.includes("/vis2.2/")) return 0;
  if (href.includes("/visu_1/")) return 1;
  if (href.includes("/visu3/")) return 2;
  return -1;
}

function setupNav() {
  const idx = currentIndex();
  const i = idx !== -1 ? idx : resolveIndexFallback();
  if (i === -1) return;

  const prev = document.getElementById("dvPrev");
  const next = document.getElementById("dvNext");

  if (prev) {
    prev.href = (i > 0) ? DV_PAGES[i - 1] : "../home/index.html";
    prev.textContent = (i > 0) ? "← Précédent" : "← Accueil";
  }
  if (next) {
    next.href = (i < DV_PAGES.length - 1) ? DV_PAGES[i + 1] : "../home/index.html";
    next.textContent = (i < DV_PAGES.length - 1) ? "Suivant →" : "Accueil →";
  }
}

window.addEventListener("load", setupNav);