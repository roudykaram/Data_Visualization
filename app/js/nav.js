// app/js/nav.js
(function () {
  const links = [
    { label: "Accueil", href: "../home/index.html", key: "home" },
    { label: "1. Comparer le cycle", href: "../vis2.2/index.html", key: "vis2" },
    { label: "2. Comparer les plateformes", href: "../visu_1/index.html", key: "visu1" },
    { label: "3. Mon diagnostic", href: "../visu3/index.html", key: "visu3" },
  ];

  // Détecte où on est (selon le dossier dans l'URL)
  function currentKey() {
    const p = window.location.pathname.toLowerCase();
    if (p.includes("/home/")) return "home";
    if (p.includes("/vis2.2/")) return "vis2";
    if (p.includes("/visu_1/")) return "visu1";
    if (p.includes("/visu3/")) return "visu3";
    return null;
  }

  function buildNav() {
    const key = currentKey();

    const header = document.createElement("header");
    header.className = "dvnav";

    const actions = document.createElement("div");
    actions.className = "dvnav__actions";

    links.forEach((l) => {
      const a = document.createElement("a");
      a.className = "dvnav__btn";
      a.textContent = l.label;
      a.href = l.href;

      if (l.key === key) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
        a.setAttribute("tabindex", "-1");
        a.addEventListener("click", (e) => e.preventDefault());
      }

      actions.appendChild(a);
    });

    header.appendChild(actions);
    return header;
  }

  // Injecte le menu en haut du body
  document.addEventListener("DOMContentLoaded", () => {
    // si tu as déjà un <header class="dvnav"> écrit en dur, on évite le doublon
    if (document.querySelector(".dvnav")) return;

    document.body.prepend(buildNav());
  });
})();