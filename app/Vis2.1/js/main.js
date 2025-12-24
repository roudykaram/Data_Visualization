const DATA_PATH = "../../data/processed/questionnaire_clean.csv";

const svg = d3.select("#cycleViz");
const ageGroupSelect = d3.select("#ageGroup");
const nValue = d3.select("#nValue");

const AGE_BINS = [
  { label: "18–21", min: 18, max: 21 },
  { label: "22–25", min: 22, max: 25 },
  { label: "26–30", min: 26, max: 30 },
  { label: "31–35", min: 31, max: 35 },
  { label: "36–40", min: 36, max: 40 },
  { label: "41+",  min: 41, max: 120 }
];

// ---------- responsive sizing ----------
function getSize() {
  const card = document.querySelector(".vizCard");
  const pad = 28;
  const width = Math.max(560, (card?.clientWidth || 760) - pad);
  const height = Math.max(380, Math.min(560, Math.round(width * 0.55)));
  return { width, height };
}

function rowParser(d) {
  const age = Number(d.age);
  const outcome = Number(d.cycle_outcome_numeric);   // -1 / 0 / 1
  const trigger = Number(d.cycle_trigger_numeric);   // 0..2
  return {
    ...d,
    age: Number.isFinite(age) ? age : null,
    cycle_outcome_numeric: Number.isFinite(outcome) ? outcome : null,
    cycle_trigger_numeric: Number.isFinite(trigger) ? trigger : 0
  };
}

function clearSvg() { svg.selectAll("*").remove(); }

function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function showMessage(msg, width, height) {
  clearSvg();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  svg.append("rect")
    .attr("x", 14).attr("y", 14)
    .attr("width", width - 28).attr("height", height - 28)
    .attr("rx", 18)
    .attr("fill", getCss("--canvas") || "#f6f7f9");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("text-anchor", "middle")
    .attr("font-size", 15)
    .attr("font-weight", 800)
    .attr("fill", "#111827")
    .text(msg);
}

// point on circle edge from -> to
function edgePoint(from, to, r, pad = 10) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: from.x + (dx / len) * (r + pad),
    y: from.y + (dy / len) * (r + pad)
  };
}

// smooth arc between circle edges
function arcPath(a, b, bendY) {
  const s = edgePoint(a, b, a.r, 10);
  const t = edgePoint(b, a, b.r, 10);
  const mx = (s.x + t.x) / 2;
  const my = (s.y + t.y) / 2 + bendY;
  return `M ${s.x} ${s.y} Q ${mx} ${my} ${t.x} ${t.y}`;
}

// ---------- state ----------
let GLOBAL_DATA = [];

(async function init() {
  // dropdown options
  ageGroupSelect.selectAll("option")
    .data(AGE_BINS)
    .join("option")
    .attr("value", d => d.label)
    .text(d => d.label);

  ageGroupSelect.property("value", "22–25");

  // load CSV
  try {
    GLOBAL_DATA = await d3.csv(DATA_PATH, rowParser);

    // preuve CSV chargé
    console.log("CSV chargé ✅ lignes =", GLOBAL_DATA.length);
    console.log("Exemple 3 lignes :", GLOBAL_DATA.slice(0, 3));
    console.log("Colonnes détectées :", Object.keys(GLOBAL_DATA[0] || {}));
  } catch (err) {
    console.error(err);
    const { width, height } = getSize();
    showMessage("Erreur : impossible de charger le CSV (DATA_PATH).", width, height);
    return;
  }

  GLOBAL_DATA = GLOBAL_DATA.filter(d => d.age !== null);

  if (GLOBAL_DATA.length === 0) {
    const { width, height } = getSize();
    showMessage("Aucune donnée exploitable (âge invalide).", width, height);
    return;
  }

  const firstBin = AGE_BINS.find(b => b.label === ageGroupSelect.node().value);
  update(firstBin);

  ageGroupSelect.on("change", function () {
    const bin = AGE_BINS.find(b => b.label === this.value);
    update(bin);
  });

  window.addEventListener("resize", () => {
    const bin = AGE_BINS.find(b => b.label === ageGroupSelect.node().value);
    update(bin);
  });
})();

function update(ageBin) {
  const filtered = GLOBAL_DATA.filter(d => d.age >= ageBin.min && d.age <= ageBin.max);
  nValue.text(`(N=${filtered.length})`);
  draw(filtered, ageBin);
}

function draw(data, ageBin) {
  const { width, height } = getSize();
  clearSvg();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  if (!data || data.length === 0) {
    showMessage("Pas assez de données pour cette tranche d’âge.", width, height);
    d3.select("#legendContent").html(`<div class="legendRow">Pas assez de données.</div>`);
    return;
  }

  const n = data.length;

  // ---------- metrics ----------
  const pAnxietyUp = data.filter(d => d.cycle_outcome_numeric === 1).length / n;
  const avgTrigger = d3.mean(data, d => d.cycle_trigger_numeric ?? 0);
  const pCoping = (Number.isFinite(avgTrigger) ? avgTrigger : 0) / 2;

  // outcome majority for anxiety circle color
  const counts = d3.rollup(
    data.filter(d => d.cycle_outcome_numeric !== null),
    v => v.length,
    d => d.cycle_outcome_numeric
  );

  const cMinus = counts.get(-1) || 0;
  const cZero  = counts.get(0)  || 0;
  const cPlus  = counts.get(1)  || 0;

  const pMinus = cMinus / n;
  const pZero  = cZero  / n;
  const pPlus  = cPlus  / n;

  let anxietyColor = getCss("--gray") || "#9ca3af";
  let anxietyLabel = "Neutre (majoritaire)";
  if (pPlus > pMinus && pPlus > pZero) {
    anxietyColor = getCss("--red") || "#ef4444";
    anxietyLabel = "Anxiété augmente (majoritaire)";
  } else if (pMinus > pPlus && pMinus > pZero) {
    anxietyColor = getCss("--green") || "#22c55e";
    anxietyLabel = "Anxiété diminue (majoritaire)";
  }

  console.log(`DRAW "${ageBin.label}" N=${n}`, { pAnxietyUp, pCoping, cMinus, cZero, cPlus });

  // ---------- background canvas ----------
  const pad = 14;
  svg.append("rect")
    .attr("x", pad).attr("y", pad)
    .attr("width", width - pad * 2)
    .attr("height", height - pad * 2)
    .attr("rx", 18)
    .attr("fill", getCss("--canvas") || "#f6f7f9");

  // ---------- defs: shadow + markers ----------
  const defs = svg.append("defs");

  // shadow for circles
  const filter = defs.append("filter")
    .attr("id", "softShadow")
    .attr("x", "-20%").attr("y", "-20%")
    .attr("width", "140%").attr("height", "140%");
  filter.append("feDropShadow")
    .attr("dx", 0)
    .attr("dy", 4)
    .attr("stdDeviation", 4)
    .attr("flood-color", "#000")
    .attr("flood-opacity", 0.12);

  // ✅ Static arrow colors (requested)
  const colorTop = "#111827"; // Usage → Anxiété (black)
  const colorBot = "gray"; // Anxiété → Usage (white)

  // marker with fixed size (does NOT scale with strokeWidth)
  function makeMarker(id, color) {
    const m = defs.append("marker")
      .attr("id", id)
      .attr("viewBox", "0 0 12 12")
      .attr("refX", 9)
      .attr("refY", 6)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto");

    m.append("path")
      .attr("d", "M 0 0 L 12 6 L 0 12 z")
      .attr("fill", color);
  }

  makeMarker("arrowTop", colorTop);
  makeMarker("arrowBot", colorBot);

  // ---------- layout nodes ----------
  const nodeUsage = {
    x: width * 0.28,
    y: height * 0.58,
    r: Math.max(56, Math.min(94, width * 0.075)),
    label: "Usage",
    sub: "scroller / réseaux"
  };

  const nodeAnx = {
    x: width * 0.72,
    y: height * 0.58,
    r: Math.max(70, Math.min(118, width * 0.095)),
    label: "Anxiété",
    sub: "après usage"
  };

  // ✅ STATIC thickness (requested): never changes
  const STATIC_W = 5;
  const wU2A = STATIC_W;
  const wA2U = STATIC_W;

  // ---------- arcs ----------
  const topArc = arcPath(nodeUsage, nodeAnx, -height * 0.30);
  const botArc = arcPath(nodeAnx, nodeUsage, +height * 0.30);

  // ✅ NO halo: only single stroke
  function drawArc(pathD, color, w, markerId) {
    svg.append("path")
      .attr("d", pathD)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", w)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("opacity", 0.95)
      .attr("marker-end", `url(#${markerId})`);
  }

  drawArc(topArc, colorTop, wU2A, "arrowTop");
  drawArc(botArc, colorBot, wA2U, "arrowBot");

  // ---------- percent labels (stay dynamic) ----------
  function pctText(x, y, txt, strokeColor) {
    svg.append("text")
      .attr("x", x).attr("y", y)
      .attr("text-anchor", "middle")
      .attr("font-size", Math.max(16, Math.min(30, width * 0.03)))
      .attr("font-weight", 900)
      .attr("fill", "#0f172a")
      .attr("paint-order", "stroke")
      .attr("stroke", strokeColor)
      .attr("stroke-width", 10)
      .text(txt);
  }

  pctText(width * 0.50, height * 0.18, `${Math.round(pAnxietyUp * 100)}%`, getCss("--canvas") || "#f6f7f9");
  pctText(width * 0.50, height * 0.93, `${Math.round(pCoping * 100)}%`, getCss("--canvas") || "#f6f7f9");

  // ---------- circles ----------
  function drawNode(node, fill, textColor, subColor) {
    const g = svg.append("g").attr("transform", `translate(${node.x},${node.y})`);

    g.append("circle")
      .attr("r", node.r)
      .attr("fill", fill)
      .attr("stroke", "rgba(17,24,39,0.55)")
      .attr("stroke-width", 2)
      .attr("filter", "url(#softShadow)");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", Math.max(16, node.r * 0.34))
      .attr("font-weight", 900)
      .attr("dy", -6)
      .attr("fill", textColor)
      .text(node.label);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", Math.max(12, node.r * 0.22))
      .attr("font-weight", 700)
      .attr("dy", Math.max(18, node.r * 0.28))
      .attr("fill", subColor)
      .text(node.sub);
  }

  drawNode(nodeUsage, "#ffffff", "#111827", "#334155");
  drawNode(nodeAnx, anxietyColor, "#ffffff", "rgba(255,255,255,0.92)");

  // ---------- legend (clear, full sentences) ----------
  d3.select("#legendContent").html(`
    <div class="badges">
      <span class="badge">Tranche : ${ageBin.label}</span>
      <span class="badge">N = ${n}</span>
    </div>

    <div class="legendRow" style="margin-top:10px">
      <b>Interprétation des flèches</b>
    </div>

    <div class="legendRow">
      <span class="swatch" style="background:#111827"></span>
      <b>Usage → Anxiété</b> : part des répondants pour qui <b>l’anxiété augmente après l’usage</b>.
      Valeur affichée : <b>${Math.round(pAnxietyUp * 100)}%</b>.
    </div>

    <div class="legendRow">
      <span class="swatch" style="background:grey;border:1px solid #cbd5e1"></span>
      <b>Anxiété → Usage</b> : intensité moyenne indiquant si <b>l’anxiété incite à scroller davantage</b>.
      Valeur affichée : <b>${Math.round(pCoping * 100)}%</b>.
    </div>

    <hr/>

    <div class="legendRow">
      <b>Couleur du cercle “Anxiété”</b> : résultat <b>majoritaire</b> après l’usage
    </div>
    <div class="legendRow">
      <span class="dot" style="background: var(--green)"></span>
      <b>Vert</b> : la majorité déclare que l’anxiété <b>diminue</b>.
    </div>
    <div class="legendRow">
      <span class="dot" style="background: var(--gray)"></span>
      <b>Gris</b> : la majorité déclare que l’anxiété <b>ne change pas</b>.
    </div>
    <div class="legendRow">
      <span class="dot" style="background: var(--red)"></span>
      <b>Rouge</b> : la majorité déclare que l’anxiété <b>augmente</b>.
    </div>

    <div class="legendRow" style="opacity:.78;margin-top:10px">
      <i>${anxietyLabel}</i>
    </div>
  `);
}
