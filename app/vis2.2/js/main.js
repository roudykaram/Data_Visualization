/* --- Main.js --- */

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

// --- Helpers ---
function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getSize() {
  const card = document.querySelector(".vizCard");
  const width = card ? card.clientWidth : 800;
  const height = 500; // Hauteur fixe pour stabilité
  return { width, height };
}

function rowParser(d) {
  const age = Number(d.age);
  // cycle_outcome: -1 (better), 0 (same), 1 (worse)
  const outcome = Number(d.cycle_outcome_numeric); 
  // cycle_trigger: 0 (never) to 2 (often) -> will be mapped to score
  const trigger = Number(d.cycle_trigger_numeric);   
  return {
    ...d,
    age: Number.isFinite(age) ? age : null,
    cycle_outcome_numeric: Number.isFinite(outcome) ? outcome : null,
    cycle_trigger_numeric: Number.isFinite(trigger) ? trigger : 0
  };
}

function clearSvg() { svg.selectAll("*").remove(); }

function showMessage(msg) {
  const { width, height } = getSize();
  clearSvg();
  svg.attr("viewBox", `0 0 ${width} ${height}`);
  svg.append("text")
    .attr("x", width / 2).attr("y", height / 2)
    .attr("text-anchor", "middle").attr("fill", "#64748b")
    .text(msg);
}

// --- Geometrie des arcs ---
function getArcPath(source, target, bend, offset = 0) {
    // Calcul de l'angle entre source et cible pour appliquer l'offset correctement
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    
    // On décale le point de départ et d'arrivée
    const sx = source.x + Math.cos(angle) * offset;
    const sy = source.y + Math.sin(angle) * offset;
    const tx = target.x - Math.cos(angle) * offset;
    const ty = target.y - Math.sin(angle) * offset;

    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2 + bend;
    return `M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}`;
}

// --- APP STATE ---
let GLOBAL_DATA = [];

(async function init() {
  // Init Select
  ageGroupSelect.selectAll("option")
    .data(AGE_BINS).join("option")
    .attr("value", d => d.label).text(d => d.label);
  
  ageGroupSelect.property("value", "18–21"); // Default

  try {
    GLOBAL_DATA = await d3.csv(DATA_PATH, rowParser);
    GLOBAL_DATA = GLOBAL_DATA.filter(d => d.age !== null);
    
    if (GLOBAL_DATA.length === 0) throw new Error("No Data");
    
    // Initial Draw
    update();

    // Listeners
    ageGroupSelect.on("change", update);
    window.addEventListener("resize", () => { update(); });

  } catch (err) {
    console.error(err);
    showMessage("Erreur chargement données ou fichier vide.");
  }
})();

function update() {
  const selectedLabel = ageGroupSelect.node().value;
  const ageBin = AGE_BINS.find(b => b.label === selectedLabel);
  
  const filtered = GLOBAL_DATA.filter(d => d.age >= ageBin.min && d.age <= ageBin.max);
  nValue.text(`(N=${filtered.length})`);
  
  draw(filtered, ageBin);
}

function draw(data, ageBin) {
  const { width, height } = getSize();
  clearSvg();
  svg.attr("viewBox", `0 0 ${width} ${height}`);
  
  // Background
  svg.append("rect").attr("width", width).attr("height", height).attr("fill", "#f8fafc");

  if (data.length ==0) {
    showMessage("Données insuffisantes pour cette tranche d'âge.");
    d3.select("#legendContent").html("");
    return;
  }

  // --- CALCULS STATISTIQUES ---
  const n = data.length;

  // 1. Donut Data (Distribution de l'effet sur l'anxiété)
  const counts = d3.rollup(data, v => v.length, d => d.cycle_outcome_numeric);
  const pieData = [
    { label: "Diminue", value: counts.get(-1) || 0, color: getCss("--green") || "#22c55e", order: 1 },
    { label: "Stable",  value: counts.get(0)  || 0, color: getCss("--gray")  || "#9ca3af", order: 2 },
    { label: "Augmente", value: counts.get(1) || 0, color: getCss("--red")   || "#ef4444", order: 3 }
  ].sort((a,b) => a.order - b.order);

  // Pourcentage de "Augmente" pour le texte en surbrillance
  const pctWorse = Math.round((pieData.find(d => d.label === "Augmente").value / n) * 100);

  // 2. Score de Coping (Moyenne 0-2 ramenée sur 10)
  const avgTrigger = d3.mean(data, d => d.cycle_trigger_numeric);
  const copingScore = (avgTrigger * 5).toFixed(1); // 0 -> 0, 1 -> 5, 2 -> 10

  // --- CONFIGURATION VISUELLE ---
  const leftX = width * 0.3;
  const rightX = width * 0.7;
  const centerY = height * 0.55;
  
  const rUsage = 60;
  const rAnx = 80; // Un peu plus grand pour le donut

  // --- DEFINITION DES MARQUEURS (Flèches) ---
  const defs = svg.append("defs");
  
  // Marker Noir (Top)
  defs.append("marker").attr("id", "arrowHeadTop")
    .attr("viewBox", "0 0 10 10").attr("refX", 21).attr("refY", 5)
    .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
    .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", getCss("--arrowTop"));

  // Marker Gris (Bot)
  defs.append("marker").attr("id", "arrowHeadBot")
    .attr("viewBox", "0 0 10 10").attr("refX", 20).attr("refY", 5)
    .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
    .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", getCss("--arrowBot"));

  // --- DESSIN DES ARCS (ARROWS) ---
  const topBend = -80;
  const botBend = 80;

  // Arc Usage -> Anxiété
  svg.append("path")
    .attr("d", getArcPath({x: leftX, y: centerY - rUsage + 10}, {x: rightX, y: centerY - rAnx + 10}, topBend))
    .attr("fill", "none")
    .attr("stroke", getCss("--arrowTop"))
    .attr("stroke-width", 3)
    .attr("marker-end", "url(#arrowHeadTop)");

  // Arc Anxiété -> Usage
  svg.append("path")
    .attr("d", getArcPath({x: rightX, y: centerY + rAnx - 10}, {x: leftX, y: centerY + rUsage - 10}, botBend))
    .attr("fill", "none")
    .attr("stroke", getCss("--arrowBot"))
    .attr("stroke-width", 3)
    .attr("stroke-dasharray", "6,4") // Pointillés pour montrer que c'est un effet secondaire "insidieux"
    .attr("marker-end", "url(#arrowHeadBot)");

  // Labels sur les Arcs
  // Top
  svg.append("text")
    .attr("x", width * 0.5).attr("y", centerY + topBend - 35)
    .attr("text-anchor", "middle")
    .attr("font-weight", "700")
    .attr("fill", getCss("--arrowTop"))
    .text("Impact Émotionnel");

  // Bot
  svg.append("text")
    .attr("x", width * 0.5).attr("y", centerY + botBend + 40)
    .attr("text-anchor", "middle")
    .attr("font-weight", "700")
    .attr("fill", getCss("--arrowBot"))
    .text("Tendance au Re-scroll");
  
  svg.append("text")
    .attr("x", width * 0.5).attr("y", centerY + botBend + 55)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("fill", "#64748b")
    .text(`Score d'intensité : ${copingScore} / 10`);


  // --- DESSIN NOEUD GAUCHE (USAGE) ---
  const gUsage = svg.append("g").attr("transform", `translate(${leftX}, ${centerY})`);
  
  gUsage.append("circle")
    .attr("r", rUsage)
    .attr("fill", "white")
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 2);
    
  gUsage.append("text")
    .attr("dy", "-0.2em").attr("text-anchor", "middle")
    .attr("font-weight", "800").attr("fill", "#0f172a").text("USAGE");
  gUsage.append("text")
    .attr("dy", "1.2em").attr("text-anchor", "middle")
    .attr("font-size", "12px").attr("fill", "#64748b").text("(Temps, Scroll)");


  // --- DESSIN NOEUD DROITE (ANXIETE - DONUT) ---
  const gAnx = svg.append("g").attr("transform", `translate(${rightX}, ${centerY})`);

  // 1. Fond blanc propre
  gAnx.append("circle").attr("r", rAnx).attr("fill", "white");

  // 2. Le Donut
  const pie = d3.pie().value(d => d.value).sort(null);
  const arcGen = d3.arc().innerRadius(rAnx - 25).outerRadius(rAnx);
  
  gAnx.selectAll("path")
    .data(pie(pieData))
    .join("path")
    .attr("d", arcGen)
    .attr("fill", d => d.data.color)
    .attr("stroke", "white")
    .attr("stroke-width", 2);

  // 3. Texte central
  gAnx.append("text")
    .attr("dy", "-0.2em").attr("text-anchor", "middle")
    .attr("font-weight", "800").attr("fill", "#0f172a").text("ANXIÉTÉ");
  gAnx.append("text")
    .attr("dy", "1.2em").attr("text-anchor", "middle")
    .attr("font-size", "12px").attr("fill", "#64748b").text("Après usage");


  // --- LEGENDE HTML (Dynamique) ---
  updateLegend(n, pieData, copingScore, pctWorse);
}

function updateLegend(n, pieData, copingScore, pctWorse) {
  const container = d3.select("#legendContent");
  
  let html = `
    <div class="badges">
      <span class="badge">N = ${n}</span>
      <span class="badge" style="background:${pctWorse > 30 ? '#fee2e2' : '#f1f5f9'}; color:${pctWorse > 30 ? '#ef4444' : '#334155'}">
        Cas aggravés : ${pctWorse}%
      </span>
    </div>

    <div class="legendSection">
      <div class="legendTitle">1. Impact sur l'Anxiété (Anneau)</div>
      <div class="legendRow">L'anneau montre comment l'anxiété évolue juste après l'usage :</div>
      ${pieData.map(d => `
        <div class="legendRow">
          <span class="swatch" style="background:${d.color}"></span>
          <strong>${d.label}</strong> : ${Math.round(d.value / n * 100)}% des usagers
        </div>
      `).join("")}
    </div>

    <hr style="border:0; border-top:1px solid #e2e8f0; margin:15px 0;" />

    <div class="legendSection">
      <div class="legendTitle">2. La boucle de retour (Flèche du bas)</div>
      <div class="legendRow">
        <span class="swatch" style="background:var(--arrowBot)"></span>
        <b>Tendance au Re-scroll</b>
      </div>
      <div class="legendRow" style="font-style:italic; color:#64748b;">
        "Quand je suis anxieux, j'ai tendance à retourner scroller pour me calmer."
      </div>
      <div class="legendRow" style="margin-top:8px">
        Score moyen : <strong>${copingScore} / 10</strong>
      </div>
    </div>
  `;

  container.html(html);
}