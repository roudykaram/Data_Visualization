// ==========================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ==========================================

const width = 350;
const height = 350;
const margin = 50;
const radius = Math.min(width, height) / 2 - margin;

// Données
let currentData = [50, 50, 50, 50, 50, 50, 50, 50]; 
let averageData = [50, 50, 50, 50, 50, 50, 50, 50]; // Stockera la MOYENNE GLOBALE
let csvData = []; 

const features = [
    "Sommeil", "Culpabilité", "Productivité", "Social", 
    "Santé", "Temps écran", "Anxiété", "Contrôle"
];

// Indices des facteurs "négatifs" (Scores élevés = Mauvais)
const negativeIndices = [1, 5, 6]; 


// ==========================================
// 2. CHARGEMENT ET CALCUL DE LA MOYENNE
// ==========================================

const csvPath = "../../data/processed/questionnaire_clean.csv";

d3.csv(csvPath).then(data => {
    console.log(" Données chargées :", data.length, "utilisateurs.");
    csvData = data; 
    
    // --- CALCUL DE LA MOYENNE DE TOUTE LA BASE DE DONNÉES ---
    let sums = [0, 0, 0, 0, 0, 0, 0, 0];
    let count = 0;

    data.forEach(row => {
        // On convertit chaque ligne avec la même logique que pour l'affichage
        const vals = parseRow(row);
        
        // On additionne (si les données sont valides)
        if (!vals.some(isNaN)) {
            vals.forEach((v, i) => sums[i] += v);
            count++;
        }
    });

    // On divise par le nombre total pour avoir la moyenne
    averageData = sums.map(s => Math.round(s / count));
    console.log(" Moyenne calculée sur la base :", averageData);

    // On met à jour le graphique immédiatement pour montrer la moyenne en gris
    // Et on met les barres bleues à 50 par défaut
    updateDisplay([50, 50, 50, 50, 50, 50, 50, 50]);

    // Mise à jour de l'interface
    const btn = document.getElementById('btn-random');
    btn.textContent = "Comparer un profil réel à la moyenne";
    btn.style.backgroundColor = "#9b59b6"; btn.style.color = "white";

    // Mise à jour automatique de la légende HTML (plus besoin de toucher au HTML)
    d3.select(".legend").html(`
        <span class="dot prev" style="background-color:#ccc"></span> Moyenne Globale
        <span class="dot curr" style="background-color:#4a90e2; margin-left:10px;"></span> Profil Sélectionné
    `);

}).catch(error => {
    console.warn(" Impossible de charger le CSV (Vérifiez le Live Server).", error);
});

// Fonction utilitaire pour convertir une ligne CSV en chiffres 0-100
function parseRow(row) {
    const v1 = (1 - parseFloat(row.risk_sleep || 0.5)) * 100;
    const v2 = parseFloat(row.risk_guilt || 0) * 100;
    const v3 = (1 - parseFloat(row.risk_productivity || 0.5)) * 100;
    const v4 = (1 - parseFloat(row.risk_notification || 0.5)) * 100;
    
    let v5 = 50;
    if (row.usage_is_healthy === "Oui") v5 = 90;
    else if (row.usage_is_healthy === "Non") v5 = 20;

    const v6 = Math.min((parseFloat(row.daily_time_numeric || 0) / 8) * 100, 100);
    const v7 = (parseFloat(row.anxiety_score || 1) / 7) * 100;
    const v8 = (parseFloat(row.self_control_score || 3) / 7) * 100;

    return [v1, v2, v3, v4, v5, v6, v7, v8];
}


// ==========================================
// 3. CRÉATION DES GRAPHIQUES
// ==========================================

// --- A. RADAR ---
d3.select("#radar-container").selectAll("*").remove();
const svgRadar = d3.select("#radar-container").append("svg")
    .attr("width", width).attr("height", height)
    .append("g").attr("transform", `translate(${width/2},${height/2})`);

// Marqueur Flèche
const defs = svgRadar.append("defs");
defs.append("marker").attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10").attr("refX", 8).attr("refY", 0)
    .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
    .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#ccc");

const rScale = d3.scaleLinear().range([0, radius]).domain([0, 100]);
const angleSlice = Math.PI * 2 / features.length;

// Grille
[20, 40, 60, 80, 100].forEach(l => svgRadar.append("circle").attr("r", rScale(l)).attr("fill", "none").attr("stroke", "#eee"));

// Axes
features.forEach((feature, i) => {
    const angle = i * angleSlice - Math.PI / 2;
    svgRadar.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", rScale(105) * Math.cos(angle)).attr("y2", rScale(105) * Math.sin(angle))
        .attr("stroke", "#ccc").attr("stroke-width", 1.5).attr("marker-end", "url(#arrowhead)");
    
    svgRadar.append("text")
        .attr("x", Math.cos(angle) * (radius + 25)).attr("y", Math.sin(angle) * (radius + 25))
        .text(feature).attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .style("font-size", "11px").style("font-weight", "bold").style("fill", "#555");
});

const radarLine = d3.lineRadial().curve(d3.curveLinearClosed).radius(d => rScale(d)).angle((d, i) => i * angleSlice);

// Formes : Moyenne (Gris) et Actuel (Bleu)
const pathAverage = svgRadar.append("path") // C'est ici que ça change !
    .attr("fill", "rgba(150, 150, 150, 0.2)") // Gris un peu plus foncé pour être visible
    .attr("stroke", "#999")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4,4");

const pathCurrent = svgRadar.append("path")
    .attr("fill", "rgba(74, 144, 226, 0.2)")
    .attr("stroke", "#4a90e2")
    .attr("stroke-width", 3);


// --- B. JAUGE AVEC AIGUILLE ---
d3.select("#gauge-container").selectAll("*").remove();
const radiusJauge = Math.min(width, height) / 2 - 60;
const svgJauge = d3.select("#gauge-container").append("svg")
    .attr("width", width).attr("height", height)
    .append("g").attr("transform", `translate(${width/2},${height/2})`);

const arc = d3.arc().innerRadius(radiusJauge - 20).outerRadius(radiusJauge);
const pie = d3.pie().sort(null).value(d => d);

const pathJauge = svgJauge.selectAll("path.slice").data(pie([50, 50])).enter().append("path")
    .attr("class", "slice").attr("d", arc).attr("fill", "#ddd");

const textScore = svgJauge.append("text").attr("text-anchor", "middle").attr("dy", "35")
    .style("font-size", "24px").style("font-weight", "bold").text("50%");

const needlePath = svgJauge.append("path").attr("class", "needle")
    .attr("d", `M-3,0 L0,-${radiusJauge + 10} L3,0 L0,5 Z`)
    .attr("fill", "#333");
svgJauge.append("circle").attr("r", 5).attr("fill", "#333");


// ==========================================
// 4. LOGIQUE D'AFFICHAGE
// ==========================================

function calculateRisk(values) {
    let total = 0;
    values.forEach((val, i) => {
        if (negativeIndices.includes(i)) total += (100 - val);
        else total += val;
    });
    return Math.round(100 - (total / values.length));
}

function updateDisplay(newData) {
    currentData = newData;
    const riskScore = calculateRisk(currentData);

    // --- RADAR ---
    // La forme grise (Average) reste FIXE sur la moyenne calculée
    pathAverage.datum(averageData).transition().duration(750).attr("d", radarLine);
    
    // La forme bleue (Actuelle) bouge selon le profil choisi
    pathCurrent.datum(currentData).transition().duration(750).attr("d", radarLine);

    // --- COULEURS ---
    let color;
    if (riskScore < 40) color = "#2ecc71";
    else if (riskScore < 50) color = "#f1c40f";
    else if (riskScore < 60) color = "#e67e22";
    else color = "#e74c3c";

    // --- JAUGE ---
    const pieData = pie([riskScore, 100 - riskScore]);
    svgJauge.selectAll("path.slice").data(pieData).transition().duration(750).attr("d", arc)
        .attr("fill", (d, i) => i === 1 ? "#f0f0f0" : color);

    const angleDeg = (riskScore / 100) * 360;
    needlePath.transition().duration(750).attr("transform", `rotate(${angleDeg})`);
    textScore.text(riskScore + "%").style("fill", color);
}


// ==========================================
// 5. INTERACTION
// ==========================================

document.getElementById('btn-calculer').addEventListener('click', () => {
    const ids = ['select-sommeil', 'select-culpabilite', 'select-productivite', 'select-social', 'select-sante', 'select-temps', 'select-anxiete', 'select-controle'];
    updateDisplay(ids.map(id => +document.getElementById(id).value));
});

document.getElementById('btn-random').addEventListener('click', () => {
    if (csvData.length === 0) return alert("Chargement CSV en cours...");
    const row = csvData[Math.floor(Math.random() * csvData.length)];
    const vals = parseRow(row);
    // On nettoie les NaN au cas où
    updateDisplay(vals.map(v => isNaN(v) ? 50 : Math.round(v)));
});