// ===== Paths (tu sers depuis la racine du projet) =====
const PATH_Q = "../../../data/processed/questionnaire_clean.csv";
const PATH_K = "../../../data/raw/Mental_Health_and_Social_Media_Balance_Dataset.csv";

// ===== SVG config =====
const W = 1050;
const H = 520;
const M = { top: 30, right: 20, bottom: 90, left: 60 };

// ===== State =====
let dataQ = [];
let dataK = [];

let metricQ = "anxiety"; // anxiety_score | mood_impact
let minNQ = 5;

let viewK = "box"; // box | bar
let minNK = 5;

// ===== Utils =====
function normPlatform(s) {
  const x = (s ?? "").toString().trim();
  if (!x) return "";
  // normalise casse + quelques variantes
  const low = x.toLowerCase();
  if (low === "discord") return "Discord";
  if (low === "x(twitter)" || low === "twitter" || low === "x") return "X";
  if (low === "instagram") return "Instagram";
  if (low === "tiktok") return "TikTok";
  if (low === "whatsapp") return "WhatsApp";
  if (low === "youtube") return "YouTube";
  if (low === "facebook") return "Facebook";
  if (low === "snapchat") return "Snapchat";
  if (low === "linkedin") return "LinkedIn";
  if (low === "mastodon") return "Mastodon";
  if (low.includes("aucun")) return "Aucun";
  // default: capitaliser 1re lettre
  return x.charAt(0).toUpperCase() + x.slice(1);
}

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

function buildSVG(containerId) {
  d3.select(containerId).selectAll("*").remove();
  const svg = d3.select(containerId).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  return { svg, g, innerW: W - M.left - M.right, innerH: H - M.top - M.bottom };
}

function drawBoxplot(containerId, rows, xKey, yKey, titleY, minN) {
  const { g, innerW, innerH } = buildSVG(containerId);

  const clean = rows
    .map(d => ({ x: normPlatform(d[xKey]), y: +d[yKey] }))
    .filter(d => d.x && Number.isFinite(d.y));

  const grouped = d3.group(clean, d => d.x);
  const boxesAll = Array.from(grouped, ([platform, arr]) => {
    const vals = arr.map(d => d.y);
    return { platform, ...computeBox(vals) };
  });

  // filtre minN
  const boxes = boxesAll.filter(b => b.n >= minN);

  if (boxes.length === 0) {
    d3.select(containerId).append("div")
      .style("color", "crimson")
      .style("padding", "8px 0")
      .text(`Aucune plateforme avec n ≥ ${minN}. Baisse le filtre Min réponses.`);
    return;
  }

  // tri : par médiane (utile)
  boxes.sort((a, b) => d3.descending(a.med, b.med));

  const x = d3.scaleBand()
    .domain(boxes.map(d => d.platform))
    .range([0, innerW])
    .padding(0.35);

  const yMin = d3.min(boxes, d => d.whiskerLow);
  const yMax = d3.max(boxes, d => d.whiskerHigh);

  const y = d3.scaleLinear()
    .domain([yMin, yMax])
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
    .text(titleY);

  const bw = x.bandwidth();

  const boxG = g.selectAll(".boxg")
    .data(boxes, d => d.platform)
    .enter()
    .append("g")
    .attr("transform", d => `translate(${x(d.platform)},0)`);

  boxG.append("line")
    .attr("class", "whisker")
    .attr("x1", bw / 2).attr("x2", bw / 2)
    .attr("y1", d => y(d.whiskerLow))
    .attr("y2", d => y(d.whiskerHigh));

  boxG.append("line")
    .attr("class", "cap")
    .attr("x1", bw * 0.2).attr("x2", bw * 0.8)
    .attr("y1", d => y(d.whiskerLow))
    .attr("y2", d => y(d.whiskerLow));

  boxG.append("line")
    .attr("class", "cap")
    .attr("x1", bw * 0.2).attr("x2", bw * 0.8)
    .attr("y1", d => y(d.whiskerHigh))
    .attr("y2", d => y(d.whiskerHigh));

  boxG.append("rect")
    .attr("class", "box")
    .attr("x", 0).attr("width", bw)
    .attr("y", d => y(d.q3))
    .attr("height", d => Math.max(0, y(d.q1) - y(d.q3)));

  boxG.append("line")
    .attr("class", "median")
    .attr("x1", 0).attr("x2", bw)
    .attr("y1", d => y(d.med))
    .attr("y2", d => y(d.med));

  boxG.each(function(d) {
    d3.select(this).selectAll(".outlier")
      .data(d.outliers)
      .enter()
      .append("circle")
      .attr("class", "outlier")
      .attr("cx", bw / 2)
      .attr("cy", v => y(v))
      .attr("r", 3);
  });
}

function drawBar(containerId, rows, xKey, yKey, titleY, minN) {
  const { g, innerW, innerH } = buildSVG(containerId);

  const clean = rows
    .map(d => ({ x: normPlatform(d[xKey]), y: +d[yKey] }))
    .filter(d => d.x && Number.isFinite(d.y));

  const grouped = d3.group(clean, d => d.x);
  const barsAll = Array.from(grouped, ([platform, arr]) => ({
    platform,
    n: arr.length,
    mean: d3.mean(arr, d => d.y),
  }));

  const bars = barsAll.filter(b => b.n >= minN);
  if (bars.length === 0) {
    d3.select(containerId).append("div")
      .style("color", "crimson")
      .style("padding", "8px 0")
      .text(`Aucune plateforme avec n ≥ ${minN}. Baisse le filtre Min réponses.`);
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
    .text(titleY + " (moyenne)");

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

// ===== Renderers =====
function renderQ() {
  const yKey = metricQ === "anxiety" ? "anxiety_score" : "mood_impact";
  const title = metricQ === "anxiety" ? "Anxiety score" : "Mood impact";
  drawBoxplot("#chartQ", dataQ, "main_platform", yKey, title, minNQ);
}

function renderK() {
  if (viewK === "box") {
    drawBoxplot("#chartK", dataK, "Social_Media_Platform", "Stress_Level(1-10)", "Stress level", minNK);
  } else {
    drawBar("#chartK", dataK, "Social_Media_Platform", "Stress_Level(1-10)", "Stress level", minNK);
  }
}

// ===== Load both datasets =====
Promise.all([
  d3.csv(PATH_Q),
  d3.csv(PATH_K),
]).then(([q, k]) => {
  dataQ = q;
  dataK = k;
  renderQ();
  renderK();
});

// ===== UI events =====
d3.select("#metricQ").on("change", function () {
  metricQ = this.value;
  renderQ();
});

d3.select("#minNQ").on("change", function () {
  minNQ = +this.value;
  renderQ();
});

d3.select("#minNK").on("change", function () {
  minNK = +this.value;
  renderK();
});

d3.select("#toggleK").on("click", function () {
  viewK = (viewK === "box") ? "bar" : "box";
  this.textContent = `Vue : ${viewK === "box" ? "Boxplot" : "Bar chart"}`;
  renderK();
});