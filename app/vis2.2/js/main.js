/* --- Main.js --- */

const DATA_PATH = "../../data/processed/questionnaire_clean.csv";

const AGE_BINS = [
  { label: "18–21", min: 18, max: 21 },
  { label: "22–25", min: 22, max: 25 },
  { label: "26–30", min: 26, max: 30 },
  { label: "31–35", min: 31, max: 35 },
  { label: "36–40", min: 36, max: 40 },
  { label: "41+",  min: 41, max: 120 }
];

// Configuration plus compacte pour voir 1.5 diagramme à l'écran
const WIDTH = 650;
const HEIGHT = 275; 

function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000";
}

function getArcPath(source, target, bend, offset = 0) {
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    const sx = source.x + Math.cos(angle) * offset;
    const sy = source.y + Math.sin(angle) * offset;
    const tx = target.x - Math.cos(angle) * offset;
    const ty = target.y - Math.sin(angle) * offset;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2 + bend;
    return `M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`;
}

async function init() {
  try {
    const rawData = await d3.csv(DATA_PATH);
    const data = rawData.map(d => ({
      ...d,
      age: Number(d.age),
      cycle_outcome_numeric: Number(d.cycle_outcome_numeric),
      cycle_trigger_numeric: Number(d.cycle_trigger_numeric)
    })).filter(d => !isNaN(d.age));

    const container = d3.select("#multiplesContainer");

    AGE_BINS.forEach(bin => {
      const filtered = data.filter(d => d.age >= bin.min && d.age <= bin.max);
      if (filtered.length > 0) {
        createAgeCard(container, filtered, bin);
      }
    });
  } catch (err) {
    console.error("Erreur chargement:", err);
  }
}

function createAgeCard(container, data, bin) {
  const section = container.append("section").attr("class", "ageCard");
  section.append("h1").text(`Tranche d'âge : ${bin.label} ans`);

  const layout = section.append("div").attr("class", "cardLayout");
  
  const svgWrapper = layout.append("div").attr("class", "svgWrapper");
  const svg = svgWrapper.append("svg").attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  
  const legend = layout.append("div").attr("class", "cardLegend");

  const n = data.length;
  const counts = d3.rollup(data, v => v.length, d => d.cycle_outcome_numeric);
  const pieData = [
    { label: "Diminue", value: counts.get(-1) || 0, color: getCss("--green") },
    { label: "Stable",  value: counts.get(0)  || 0, color: getCss("--gray") },
    { label: "Augmente", value: counts.get(1) || 0, color: getCss("--red") }
  ];
  const pctWorse = Math.round(((counts.get(1) || 0) / n) * 100);
  const avgTrigger = d3.mean(data, d => d.cycle_trigger_numeric);
  const copingScore = (avgTrigger * 5).toFixed(1);

  // Géométrie ajustée
  const leftX = WIDTH * 0.28;
  const rightX = WIDTH * 0.72;
  const centerY = HEIGHT * 0.52;
  const rUsage = 45; 
  const rAnx = 65;   

  const defs = svg.append("defs");
  defs.append("marker").attr("id", "arrowHeadTop").attr("viewBox", "0 0 10 10").attr("refX", 21).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", getCss("--arrowTop"));
  defs.append("marker").attr("id", "arrowHeadBot").attr("viewBox", "0 0 10 10").attr("refX", 20).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", getCss("--arrowBot"));

  // Arcs
  svg.append("path").attr("d", getArcPath({x: leftX, y: centerY - rUsage + 10}, {x: rightX, y: centerY - rAnx + 10}, -60)).attr("fill", "none").attr("stroke", getCss("--arrowTop")).attr("stroke-width", 3).attr("marker-end", "url(#arrowHeadTop)");
  svg.append("path").attr("d", getArcPath({x: rightX, y: centerY + rAnx - 10}, {x: leftX, y: centerY + rUsage - 10}, 60)).attr("fill", "none").attr("stroke", getCss("--arrowBot")).attr("stroke-width", 3).attr("stroke-dasharray", "5,3").attr("marker-end", "url(#arrowHeadBot)");

  // Labels
  svg.append("text").attr("x", WIDTH/2).attr("y", centerY - 85).attr("text-anchor", "middle").attr("class", "arcLabel").attr("fill", getCss("--arrowTop")).text("Impact Émotionnel");
  svg.append("text").attr("x", WIDTH/2).attr("y", centerY + 90).attr("text-anchor", "middle").attr("class", "arcLabel").attr("fill", getCss("--arrowBot")).text("Tendance au Re-scroll");
  
  // Score sous la flèche
  svg.append("text").attr("x", WIDTH*0.5).attr("y", centerY + 115).attr("text-anchor", "middle").attr("font-size", "13px").attr("fill", "#64748b").text(`Score d'intensité : ${copingScore} / 10`);

  // Cercles
  const gU = svg.append("g").attr("transform", `translate(${leftX}, ${centerY})`);
  gU.append("circle").attr("r", rUsage).attr("fill", "white").attr("stroke", "#0f172a").attr("stroke-width", 2);
  gU.append("text").attr("dy", "0.3em").attr("text-anchor", "middle").attr("font-weight", "800").attr("font-size", "12px").text("USAGE");

  const gA = svg.append("g").attr("transform", `translate(${rightX}, ${centerY})`);
  const pie = d3.pie().value(d => d.value).sort(null);
  const arcGen = d3.arc().innerRadius(rAnx - 20).outerRadius(rAnx);
  gA.selectAll("path").data(pie(pieData)).join("path").attr("d", arcGen).attr("fill", d => d.data.color).attr("stroke", "white").attr("stroke-width", 2);
  gA.append("text").attr("dy", "0.3em").attr("text-anchor", "middle").attr("font-weight", "800").attr("font-size", "12px").text("ANXIÉTÉ");

  legend.html(`
    <h3 class="legendHeader">LÉGENDE</h3>
    <div class="badges">
      <span class="badge">N = ${n}</span>
      <span class="badge" style="background:${pctWorse > 30 ? '#fee2e2' : '#f1f5f9'}; color:${pctWorse > 30 ? '#ef4444' : '#334155'}">
        Cas aggravés : ${pctWorse}%
      </span>
    </div>
    <div class="legendSection">
      <div class="legendTitle">1. IMPACT SUR L'ANXIÉTÉ (ANNEAU)</div>
      <div class="legendRow">L'anneau montre l'évolution après usage :</div>
      ${pieData.map(d => `
        <div class="legendRow">
          <span class="swatch" style="background:${d.color}"></span>
          <strong>${d.label}</strong> : ${Math.round(d.value / n * 100)}% des usagers
        </div>
      `).join("")}
    </div>
    <hr style="border:0; border-top:1px solid #e2e8f0; margin:10px 0;" />
    <div class="legendSection">
      <div class="legendTitle">2. LA BOUCLE DE RETOUR</div>
      <div class="legendRow">
        <span class="swatch" style="background:var(--arrowBot)"></span>
        <b>Tendance au Re-scroll</b>
      </div>
      <div class="legendRow" style="font-style:italic; color:#64748b; font-size:13px;">
        "Quand je suis anxieux, j'ai tendance à retourner scroller."
      </div>
      <div class="legendRow" style="margin-top:8px">
        Score d'intensité : <strong>${copingScore} / 10</strong>
      </div>
    </div>
  `);
}
init();