// ===== Paths =====
const PATH_Q = "../../data/processed/questionnaire_clean.csv";
const PATH_K = "../../data/raw/Mental_Health_and_Social_Media_Balance_Dataset.csv";
const PATH_D = "../../data/processed/design_test.csv";

// ===== Common chart config =====
const W = 900;
const H = 520;
const M = { top: 30, right: 20, bottom: 90, left: 60 };

// ===== State =====
let dataQ = [];
let dataK = [];
let dataD = [];

let metricQ = "anxiety";      // anxiety | mood
let minNQ = 5;
let viewQ = "box";            // box | violin  (box par défaut)

let minNK = 5;
let viewKDist = "box";        // box | violin (box par défaut)

let aggD = "mean";            // mean | sum

// ===== Helpers =====
function normPlatform(s) {
  const x = (s ?? "").toString().trim();
  if (!x) return "";
  const low = x.toLowerCase().trim();

  if (low === "discord") return "Discord";
  if (s.includes("twitter") || s === "x" || s.includes("x (twitter)") || s.includes("X(Twitter)")|| s.includes("X (Twitter)")) return "X";
  if (low === "instagram") return "Instagram";
  if (low === "tiktok") return "TikTok";
  if (low === "whatsapp") return "WhatsApp";  
  if (low === "youtube") return "YouTube";
  if (low === "facebook") return "Facebook";
  if (low === "snapchat") return "Snapchat";
  if (low === "linkedin") return "LinkedIn";
  if (low === "mastodon") return "Mastodon";
  if (low.includes("aucun")) return "Aucun";

  return x.charAt(0).toUpperCase() + x.slice(1);
}

// ===== Couleurs stables par plateforme (même couleur partout) =====
const PLATFORM_COLORS = new Map([
  ["Facebook",  "#4E79A7"],
  ["YouTube",   "#F28E2B"],
  ["TikTok",    "#E15759"],
  ["Instagram", "#76B7B2"],
  ["LinkedIn",  "#59A14F"],
  ["X",         "#EDC948"],
  ["Snapchat",  "#B07AA1"],
  ["WhatsApp",  "#FF9DA7"],
  ["Discord",   "#9C755F"],
  ["Mastodon",  "#BAB0AC"],
  ["Pinterest",  "#D37295"],
  ["Aucun",     "#7F7F7F"],
]);

function platformColor(p) {
  return PLATFORM_COLORS.get(p) || "#9aa0a6"; // fallback si nouvelle plateforme
}

// --- Shade helper: éclaircir/assombrir une couleur hex ---
function shade(hex, factor) {
  const c = d3.color(hex);
  if (!c) return hex;
  const hsl = d3.hsl(c);
  hsl.l = Math.max(0, Math.min(1, hsl.l * factor));
  return hsl.formatHex();
}

// --- id safe pour <pattern> ---
function safeId(str) {
  return String(str).replace(/\W+/g, "");
}
function pickCol(columns, candidates) {
  const lower = new Map(columns.map(c => [c.toLowerCase().trim(), c]));
  for (const cand of candidates) {
    const key = cand.toLowerCase().trim();
    if (lower.has(key)) return lower.get(key);
  }
  for (const cand of candidates) {
    const key = cand.toLowerCase().trim();
    for (const c of columns) {
      if (c.toLowerCase().includes(key)) return c;
    }
  }
  return null;
}

function buildSVG(containerId) {
  d3.select(containerId).selectAll("*").remove();
  const svg = d3.select(containerId).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  return { svg, g, innerW: W - M.left - M.right, innerH: H - M.top - M.bottom };
}

function stats(values) {
  const s = values.slice().sort(d3.ascending);
  return {
    q1: d3.quantile(s, 0.25),
    med: d3.quantile(s, 0.5),
    q3: d3.quantile(s, 0.75),
    min: d3.min(s),
    max: d3.max(s),
    n: s.length
  };
}

function platformColorScale(platforms) {
  return d3.scaleOrdinal()
    .domain(platforms)
    .range(d3.schemeTableau10);
}

// ===== Boxplot =====
function computeBox(values) {
  const sorted = values.slice().sort(d3.ascending);
  const q1 = d3.quantile(sorted, 0.25);
  const med = d3.quantile(sorted, 0.5);
  const q3 = d3.quantile(sorted, 0.75);
  const iqr = q3 - q1;

  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;

  const whiskerLow = d3.min(sorted.filter(v => v >= lowFence));
  const whiskerHigh = d3.max(sorted.filter(v => v <= highFence));
  const outliers = sorted.filter(v => v < lowFence || v > highFence);

  return { q1, med, q3, whiskerLow, whiskerHigh, outliers, n: sorted.length };
}

function drawBoxplot(containerId, rows, xKey, yKey, yTitle, minN) {
  const { g, innerW, innerH } = buildSVG(containerId);

  const clean = rows
    .map(d => ({ x: normPlatform(d[xKey]), y: +d[yKey] }))
    .filter(d => d.x && Number.isFinite(d.y));

  const grouped = d3.group(clean, d => d.x);
  let boxes = Array.from(grouped, ([platform, arr]) => {
    const values = arr.map(d => d.y);
    return { platform, ...computeBox(values) };
  });

  boxes = boxes.filter(b => b.n >= minN);
  if (boxes.length === 0) {
    d3.select(containerId).append("div")
      .style("color", "crimson").style("padding", "8px 0")
      .text(`Aucune plateforme avec n ≥ ${minN}.`);
    return;
  }

  // sort by median
  boxes.sort((a, b) => d3.descending(a.med, b.med));

  const x = d3.scaleBand()
    .domain(boxes.map(d => d.platform))
    .range([0, innerW])
    .padding(0.35);

  const y = d3.scaleLinear()
    .domain([d3.min(boxes, d => d.whiskerLow), d3.max(boxes, d => d.whiskerHigh)])
    .nice()
    .range([innerH, 0]);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-25)")
    .style("text-anchor", "end");

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  const color = platformColor;  // couleur stable par plateforme

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .style("font-size", "12px")
    .style("fill", "#333")
    .text(yTitle);

  const bw = x.bandwidth();

  const boxG = g.selectAll(".boxg")
    .data(boxes, d => d.platform)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x(d.platform)},0)`);

   

  // whisker
  boxG.append("line")
    .attr("class", "whisker")
    .attr("x1", bw / 2).attr("x2", bw / 2)
    .attr("y1", d => y(d.whiskerLow))
    .attr("y2", d => y(d.whiskerHigh))
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 1.2);

  // caps  

  boxG.append("line")
    .attr("class", "cap")
    .attr("x1", bw * 0.2).attr("x2", bw * 0.8)
    .attr("y1", d => y(d.whiskerLow))
    .attr("y2", d => y(d.whiskerLow))
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 1.2);

  boxG.append("line")
    .attr("class", "cap")
    .attr("x1", bw * 0.2).attr("x2", bw * 0.8)
    .attr("y1", d => y(d.whiskerHigh))
    .attr("y2", d => y(d.whiskerHigh))
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 1.2);

  // box
  boxG.append("rect")
    .attr("class", "box")
    .attr("x", 0).attr("width", bw)
    .attr("y", d => y(d.q3))
    .attr("height", d => Math.max(0, y(d.q1) - y(d.q3)))
    .attr("fill", d => color(d.platform))
    .attr("fill-opacity", 1)
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 1.2);

  // median
  boxG.append("line")
    .attr("class", "median")
    .attr("x1", 0).attr("x2", bw)
    .attr("y1", d => y(d.med))
    .attr("y2", d => y(d.med))
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 2);

  // outliers
  boxG.each(function (d) {
    d3.select(this).selectAll(".outlier")
      .data(d.outliers)
      .enter()
      .append("circle")
      .attr("class", "outlier")
      .attr("cx", bw / 2)
      .attr("cy", v => y(v))
      .attr("r", 3)
      .attr("fill", color(d.platform))
      .attr("fill-opacity", 0.7);
  });
}

// ===== Violin =====
function kernelEpanechnikov(k) {
  return v => {
    v /= k;
    return Math.abs(v) <= 1 ? (0.75 * (1 - v * v)) / k : 0;
  };
}
function kernelDensityEstimator(kernel, X) {
  return V => X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
}

function drawViolin(containerId, rows, xKey, yKey, yTitle, minN) {
  const { g, innerW, innerH } = buildSVG(containerId);

  const clean = rows
    .map(d => ({ x: normPlatform(d[xKey]), y: +d[yKey] }))
    .filter(d => d.x && Number.isFinite(d.y));

  const grouped = d3.group(clean, d => d.x);
  let groups = Array.from(grouped, ([platform, arr]) => {
    const values = arr.map(d => d.y);
    return { platform, values, points: arr, ...stats(values) };
  });

  groups = groups.filter(d => d.n >= minN);
  if (groups.length === 0) {
    d3.select(containerId).append("div")
      .style("color", "crimson").style("padding", "8px 0")
      .text(`Aucune plateforme avec n ≥ ${minN}.`);
    return;
  }

  // Tri par médiane (facilite comparaison)
  groups.sort((a, b) => d3.descending(a.med, b.med));

  const x = d3.scaleBand()
    .domain(groups.map(d => d.platform))
    .range([0, innerW])
    .padding(0.35);

  const yMin = d3.min(groups, d => d.min);
  const yMax = d3.max(groups, d => d.max);

  const y = d3.scaleLinear()
    .domain([yMin, yMax])
    .nice()
    .range([innerH, 0]);

  // Axes
  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-25)")
    .style("text-anchor", "end");

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .style("font-size", "12px")
    .style("fill", "#333")
    .text(yTitle);

  // Couleur par plateforme (palette propre)
  const color = platformColor; // fonction stable

  // KDE
  const yTicks = y.ticks(35);
  const bandwidth = (yMax - yMin) / 15 || 1;
  const kde = kernelDensityEstimator(kernelEpanechnikov(bandwidth), yTicks);

  const densities = groups.map(d => ({ ...d, density: kde(d.values) }));
  const maxDensity = d3.max(densities, d => d3.max(d.density, v => v[1]));

  const widthScale = d3.scaleLinear()
    .domain([0, maxDensity])
    .range([0, x.bandwidth() / 2]);

  const area = d3.area()
    .curve(d3.curveCatmullRom)
    .x0(v => -widthScale(v[1]))
    .x1(v => widthScale(v[1]))
    .y(v => y(v[0]));

  // Groupe par plateforme (centré)
  const violinG = g.selectAll(".violinG")
    .data(densities, d => d.platform)
    .enter()
    .append("g")
    .attr("class", "violinG")
    .attr("transform", d => `translate(${x(d.platform) + x.bandwidth()/2},0)`);

  // Violin coloré (semi-transparent)
  violinG.append("path")
    .attr("d", d => area(d.density))
    .attr("fill", d => color(d.platform))
    .attr("fill-opacity", 0.25)
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 1.2);

  // Points (individus) avec jitter horizontal
  const jitter = x.bandwidth() * 0.18; // amplitude jitter
  violinG.each(function(d) {
    d3.select(this)
      .selectAll("circle")
      .data(d.points)
      .enter()
      .append("circle")
      .attr("cx", () => (Math.random() - 0.5) * 2 * jitter)
      .attr("cy", p => y(p.y))
      .attr("r", 3)
      .attr("fill", color(d.platform))
      .attr("fill-opacity", 0.75);
  });

  // Médiane (point blanc comme l'exemple)
  violinG.append("circle")
    .attr("cx", 0)
    .attr("cy", d => y(d.med))
    .attr("r", 5)
    .attr("fill", "white")
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 2);

  // IQR (barre verticale fine)
  violinG.append("line")
    .attr("x1", 0).attr("x2", 0)
    .attr("y1", d => y(d.q1))
    .attr("y2", d => y(d.q3))
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 3)
    .attr("stroke-linecap", "round");

  // Option : moustaches (min/max) plus fines
  violinG.append("line")
    .attr("x1", 0).attr("x2", 0)
    .attr("y1", d => y(d.min))
    .attr("y2", d => y(d.max))
    .attr("stroke", d => color(d.platform))
    .attr("stroke-width", 1.2)
    .attr("stroke-opacity", 0.7);
}

// ===== Bar chart (mean) =====
function drawBar(containerId, rows, xKey, yKey, yTitle, minN) {
  const { g, innerW, innerH } = buildSVG(containerId); 

  const clean = rows
    .map(d => ({ x: normPlatform(d[xKey]), y: +d[yKey] }))
    .filter(d => d.x && Number.isFinite(d.y));

  const grouped = d3.group(clean, d => d.x);
  let bars = Array.from(grouped, ([platform, arr]) => ({
    platform,
    n: arr.length,
    mean: d3.mean(arr, d => d.y),
  }));

  bars = bars.filter(d => d.n >= minN);
  if (bars.length === 0) {
    d3.select(containerId).append("div")
      .style("color", "crimson").style("padding", "8px 0")
      .text(`Aucune plateforme avec n ≥ ${minN}.`);
    return;
  }

  bars.sort((a, b) => d3.descending(a.mean, b.mean));

  const x = d3.scaleBand()
    .domain(bars.map(d => d.platform))
    .range([0, innerW])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bars, d => d.mean)])
    .nice()
    .range([innerH, 0]);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-25)")
    .style("text-anchor", "end");

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .style("font-size", "12px")
    .style("fill", "#333")
    .text(`${yTitle} (moyenne)`);

  g.selectAll(".bar")
    .data(bars, d => d.platform)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.platform))
    .attr("y", d => y(d.mean))
    .attr("width", x.bandwidth())
    .attr("height", d => innerH - y(d.mean));
}

// ===== Design test (stacked bars) =====
function renderD() {
  d3.select("#chartD").selectAll("*").remove();

  if (!dataD.length) {
    d3.select("#chartD").append("div")
      .style("color", "crimson").style("padding", "8px 0")
      .text("design_test.csv est vide ou introuvable.");
    return;
  }

  const WD = 1050, HD = 520;
  const MD = { top: 30, right: 30, bottom: 80, left: 70 };
  const innerW = WD - MD.left - MD.right;
  const innerH = HD - MD.top - MD.bottom;

  const svg = d3.select("#chartD").append("svg").attr("viewBox", `0 0 ${WD} ${HD}`);
  const g = svg.append("g").attr("transform", `translate(${MD.left},${MD.top})`);

  const cleaned = dataD.map(d => ({
    platform: (d.platform || "").trim(),
    person: (d.person || "").trim(),
    video: +d.video_count,
    image: +d.image_count,
    text: +d.text_count
  })).filter(d => d.platform && Number.isFinite(d.video) && Number.isFinite(d.image) && Number.isFinite(d.text));

  // --- Patterns (hachures) pour Photos, par plateforme ---
  const defs = svg.append("defs");
  // Pattern neutre pour la légende (Photos en gris hachuré)
  const legPat = defs.append("pattern")
    .attr("id", "legendHatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8)
    .attr("patternTransform", "rotate(45)");

  legPat.append("rect")
    .attr("width", 8)
    .attr("height", 8)
    .attr("fill", "#bfbfbf"); // même gris que "Texte"

  legPat.append("line")
    .attr("x1", 0).attr("y1", 0)
    .attr("x2", 0).attr("y2", 8)
    .attr("stroke", "#5a5a5a")
    .attr("stroke-width", 2);
  const platforms = Array.from(new Set(cleaned.map(d => d.platform)));

  platforms.forEach(p => {
    const base = platformColor(p);
    const pid = `photoHatch-${safeId(p)}`;

    const pat = defs.append("pattern")
      .attr("id", pid)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 8)
      .attr("height", 8)
      .attr("patternTransform", "rotate(45)");

    // fond clair (couleur plateforme éclaircie)
    pat.append("rect")
      .attr("width", 8)
      .attr("height", 8)
      .attr("fill", shade(base, 1.20));

    // traits foncés (couleur plateforme assombrie)
    pat.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", 0).attr("y2", 8)
      .attr("stroke", shade(base, 0.75))
      .attr("stroke-width", 2);
  });

  // --- Règle de remplissage : vidéos/photos/texte, mais teinté par plateforme ---
  function fillByPlatformAndType(platform, key) {
    const base = platformColor(platform);

    if (key === "video") return shade(base, 0.75);                 // foncé
    if (key === "image") return `url(#photoHatch-${safeId(platform)})`; // hachuré
    if (key === "text")  return shade(base, 1.5);                 // clair

    return base;
  }    
  const grouped = d3.group(cleaned, d => d.platform);
  const agg = Array.from(grouped, ([platform, arr]) => ({
    platform,
    video: aggD === "sum" ? d3.sum(arr, d => d.video) : d3.mean(arr, d => d.video),
    image: aggD === "sum" ? d3.sum(arr, d => d.image) : d3.mean(arr, d => d.image),
    text:  aggD === "sum" ? d3.sum(arr, d => d.text)  : d3.mean(arr, d => d.text),
  }));

  agg.sort((a, b) => d3.descending(a.video + a.image + a.text, b.video + b.image + b.image + b.text));

  const keys = ["video", "image", "text"];

  const x = d3.scaleBand()
    .domain(agg.map(d => d.platform))
    .range([0, innerW])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, d3.max(agg, d => d.video + d.image + d.text)])
    .nice()
    .range([innerH, 0]);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-25)")
    .style("text-anchor", "end");

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  g.append("text")
    .attr("x", 0)
    .attr("y", -10)
    .style("font-size", "12px")
    .style("fill", "#333")
    .text(aggD === "sum" ? "Total de contenus (5 min)" : "Moyenne de contenus (5 min)");

  const stack = d3.stack().keys(keys);
  const series = stack(agg);

  g.selectAll(".layer")
    .data(series)
    .enter()
    .append("g")
    .attr("class", d => `layer layer-${d.key}`)
    .selectAll("rect")
    .data(s => s.map(v => ({ key: s.key, data: v.data, y0: v[0], y1: v[1] })))
    .enter()
    .append("rect")
    .attr("x", d => x(d.data.platform))
    .attr("y", d => y(d.y1))
    .attr("height", d => y(d.y0) - y(d.y1))
    .attr("width", x.bandwidth())
    .attr("fill", d => fillByPlatformAndType(d.data.platform, d.key))
    .attr("stroke", "#333");

      // ===== LÉGENDE (Vidéos / Photos / Texte) =====
  const legendLabels = {
    text: "Texte",
    image: "Photos",
    video: "Vidéos"
  };

  // Position : en haut à droite du graphe
  const legendX = innerW - 140;  // ajuste si besoin (ex: -160)
  const legendY = 0;

  const legend = g.append("g")
    .attr("class", "legendD")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  legend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .text("Contenu")
    .style("font-size", "13px")
    .style("font-weight", "700")
    .style("fill", "#333");

  const item = legend.selectAll(".legend-item")
    .data(keys)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${10 + i * 20})`);

  item.append("rect")
    .attr("width", 14)
    .attr("height", 14)
    .attr("rx", 3)
    .attr("fill", d => {
      if (d === "text")  return "#e3e1e1";      // Texte
      if (d === "image") return "url(#legendHatch)"; // Photos hachuré gris
      if (d === "video") return "#6b6b6b";      // Vidéos
      
      return "#999";
    })
    .attr("stroke", "#333")
    .attr("stroke-width", 0.6);

  item.append("text")
    .attr("x", 20)
    .attr("y", 11)
    .text(d => legendLabels[d] ?? d)
    .style("font-size", "12px")
    .style("fill", "#333");
}

// ===== Render Q/K =====
function renderQ() {
  const xKey = "main_platform";
  const yKey = metricQ === "anxiety" ? "anxiety_score" : "mood_impact";
  const title = metricQ === "anxiety" ? "Anxiety score" : "Mood impact";

  if (viewQ === "box") {
    drawBoxplot("#chartQ", dataQ, xKey, yKey, title, minNQ);
  } else {
    drawViolin("#chartQ", dataQ, xKey, yKey, title, minNQ);
  }
}

function renderK() {
  if (!dataK.length) return;

  const cols = Object.keys(dataK[0]);
  const platformCol = pickCol(cols, ["social_media_platform", "platform"]);
  const stressCol = pickCol(cols, ["stress_level", "stress level", "stress"]);

  if (!platformCol || !stressCol) {
    d3.select("#chartK").selectAll("*").remove();
    d3.select("#chartK").append("div")
      .style("color", "crimson").style("padding", "8px 0")
      .text(`Colonnes Kaggle introuvables. platform=${platformCol}, stress=${stressCol}.`);
    return;
  }


  // distribution mode
  if (viewKDist === "box") {
    drawBoxplot("#chartK", dataK, platformCol, stressCol, "Stress level", minNK);
  } else {
    drawViolin("#chartK", dataK, platformCol, stressCol, "Stress level", minNK);
  }
}

// ===== Load all =====
Promise.all([
  d3.csv(PATH_Q),
  d3.csv(PATH_K),
  d3.csv(PATH_D),
]).then(([q, k, d]) => {
  dataQ = q;
  dataK = k;
  dataD = d;

  renderQ();
  renderK();
  renderD();
});

// ===== UI events =====
d3.select("#toggleQ").on("click", function () {
  viewQ = (viewQ === "box") ? "violin" : "box";
  this.textContent = `Vue : ${viewQ === "box" ? "Boxplot" : "Violin"}`;
  renderQ();
});

d3.select("#metricQ").on("change", function () {
  metricQ = this.value;
  renderQ();
});

d3.select("#minNQ").on("change", function () {
  minNQ = +this.value;
  renderQ();
});

d3.select("#toggleK").on("click", function () {
  // only affects distribution mode
  viewKDist = (viewKDist === "box") ? "violin" : "box";
  this.textContent = `Vue : ${viewKDist === "box" ? "Boxplot" : "Violin"}`;
  renderK();
});



d3.select("#minNK").on("change", function () {
  minNK = +this.value;
  renderK();
});

d3.select("#aggD").on("change", function () {
  aggD = this.value;
  renderD();
});