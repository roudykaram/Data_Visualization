// ==========================================
// 1. CONFIGURATION ET VARIABLES GLOBALES
// ==========================================

const width = 350;
const height = 350;
const margin = 50;
const radius = Math.min(width, height) / 2 - margin;

// Données par défaut (au chargement de la page)
let currentData = [50, 50, 50, 50, 50, 50, 50, 50]; 
let previousData = [50, 50, 50, 50, 50, 50, 50, 50]; 
let csvData = []; // Stockera les données chargées du fichier CSV

// Liste des facteurs (DOIT respecter l'ordre exact de vos <select> dans le HTML)
const features = [
    "Sommeil",       // 0
    "Culpabilité",   // 1 (Négatif)
    "Productivité",  // 2
    "Social",        // 3
    "Santé",         // 4
    "Temps écran",   // 5 (Négatif)
    "Anxiété",       // 6 (Négatif)
    "Contrôle"       // 7
];

// Indices des facteurs "négatifs" (où un score de 90/100 est MAUVAIS pour l'utilisateur)
// Culpabilité (idx 1), Temps (idx 5), Anxiété (idx 6)
const negativeIndices = [1, 5, 6]; 


// ==========================================
// 2. CHARGEMENT DES DONNÉES CSV
// ==========================================

// Le chemin remonte de 'visu3' vers 'app' (../) puis vers la racine (../) puis descend dans 'data/processed'
const csvPath = "../../data/processed/questionnaire_clean.csv";

d3.csv(csvPath).then(data => {
    console.log("Données CSV chargées :", data.length, "profils trouvés.");
    csvData = data; 
    
    // Mise à jour visuelle du bouton pour confirmer le chargement
    const btn = document.getElementById('btn-random');
    btn.textContent = " Analyser un profil existant";
    btn.style.backgroundColor = "#9b59b6"; // Violet
    btn.style.color = "white";
}).catch(error => {
    console.error(" Erreur de chargement CSV :", error);
    // Message d'aide discret dans la console
    console.warn("Assurez-vous d'ouvrir le dossier RACINE du projet avec Live Server, et pas juste le dossier 'visu3'.");
});


// ==========================================
// 3. CRÉATION DES GRAPHIQUES (D3.js)
// ==========================================

// --- A. LE RADAR (ARAIGNÉE) ---

// Nettoyage préalable
d3.select("#radar-container").selectAll("*").remove();

const svgRadar = d3.select("#radar-container").append("svg")
    .attr("width", width).attr("height", height)
    .append("g").attr("transform", `translate(${width/2},${height/2})`);

const rScale = d3.scaleLinear().range([0, radius]).domain([0, 100]);
const angleSlice = Math.PI * 2 / features.length;

// Dessin de la grille (cercles concentriques)
[20, 40, 60, 80, 100].forEach(level => {
    svgRadar.append("circle")
        .attr("r", rScale(level))
        .attr("fill", "none")
        .attr("stroke", "#eee");
});

// Dessin des axes et du texte
features.forEach((feature, i) => {
    const angle = i * angleSlice - Math.PI / 2;
    // Ligne de l'axe
    svgRadar.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", rScale(100) * Math.cos(angle))
        .attr("y2", rScale(100) * Math.sin(angle))
        .attr("stroke", "#ccc");
    
    // Label
    const labelX = Math.cos(angle) * (radius + 20);
    const labelY = Math.sin(angle) * (radius + 20);
    svgRadar.append("text")
        .attr("x", labelX).attr("y", labelY)
        .text(feature)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("fill", "#555");
});

// Fonction pour dessiner la forme (path)
const radarLine = d3.lineRadial()
    .curve(d3.curveLinearClosed)
    .radius(d => rScale(d))
    .angle((d, i) => i * angleSlice);

// Création des formes vides (qui seront animées plus tard)
const pathPrevious = svgRadar.append("path")
    .attr("fill", "rgba(200, 200, 200, 0.2)")
    .attr("stroke", "#ccc")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4,4");

const pathCurrent = svgRadar.append("path")
    .attr("fill", "rgba(74, 144, 226, 0.2)")
    .attr("stroke", "#4a90e2")
    .attr("stroke-width", 3);


// --- B. LA JAUGE (DONUT) ---

d3.select("#gauge-container").selectAll("*").remove();

const radiusJauge = Math.min(width, height) / 2 - 60;
const svgJauge = d3.select("#gauge-container").append("svg")
    .attr("width", width).attr("height", height)
    .append("g").attr("transform", `translate(${width/2},${height/2})`);

const arc = d3.arc().innerRadius(radiusJauge - 20).outerRadius(radiusJauge);
const pie = d3.pie().sort(null).value(d => d);

// Création du cercle initial
const pathJauge = svgJauge.selectAll("path")
    .data(pie([50, 50])) // Valeur par défaut
    .enter().append("path")
    .attr("d", arc)
    .attr("fill", "#ddd");

// Texte central
const textScore = svgJauge.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.3em")
    .style("font-size", "28px")
    .style("font-weight", "bold")
    .text("50%");


// ==========================================
// 4. LOGIQUE MÉTIER (CALCULS)
// ==========================================

// Fonction qui calcule le pourcentage de RISQUE GLOBAL
function calculateRisk(values) {
    let totalHealthPoints = 0;
    
    values.forEach((val, i) => {
        if (negativeIndices.includes(i)) {
            // Pour Culpabilité, Temps, Anxiété : 90/100 est MAUVAIS.
            // Donc ça vaut seulement 10 points de "santé".
            totalHealthPoints += (100 - val);
        } else {
            // Pour Sommeil, Productivité, etc : 90/100 est BIEN.
            // Donc ça vaut 90 points de "santé".
            totalHealthPoints += val;
        }
    });

    // On fait la moyenne des points de santé
    const averageHealth = totalHealthPoints / values.length;
    
    // Le risque est l'inverse de la santé
    return Math.round(100 - averageHealth);
}

// Fonction principale de mise à jour de l'affichage
function updateDisplay(newData) {
    // Gestion de l'historique
    previousData = [...currentData];
    currentData = newData;

    // Calcul du score
    const riskScore = calculateRisk(currentData);

    // Mise à jour du Radar (Animation)
    pathPrevious.datum(previousData).transition().duration(750).attr("d", radarLine);
    pathCurrent.datum(currentData).transition().duration(750).attr("d", radarLine);

    // Détermination de la couleur (Logique demandée : Vert < 40 < Jaune < 50 < Orange < 60 < Rouge)
    let color;
    if (riskScore < 40) {
        color = "#2ecc71"; // Vert
    } else if (riskScore < 50) {
        color = "#f1c40f"; // Jaune
    } else if (riskScore < 60) {
        color = "#e67e22"; // Orange
    } else {
        color = "#e74c3c"; // Rouge
    }

    // Mise à jour de la Jauge
    const pieData = pie([riskScore, 100 - riskScore]);
    
    svgJauge.selectAll("path")
        .data(pieData)
        .transition().duration(750)
        .attr("d", arc)
        .attr("fill", (d, i) => {
            // i=0 est la partie pleine (score), i=1 est la partie vide
            if (i === 1) return "#f0f0f0"; 
            return color; 
        });

    // Mise à jour du texte
    textScore.text(riskScore + "%").style("fill", color);
}


// ==========================================
// 5. GESTION DES BOUTONS (INTERACTIONS)
// ==========================================

// BOUTON 1 : Calculer depuis le formulaire HTML
document.getElementById('btn-calculer').addEventListener('click', () => {
    // On récupère les valeurs des 8 selects
    const ids = [
        'select-sommeil', 
        'select-culpabilite', 
        'select-productivite', 
        'select-social', 
        'select-sante', 
        'select-temps', 
        'select-anxiete', 
        'select-controle'
    ];
    
    // Le "+" convertit la chaîne de caractères "90" en nombre 90
    const formValues = ids.map(id => +document.getElementById(id).value);
    
    updateDisplay(formValues);
});

// BOUTON 2 : Charger un profil aléatoire du CSV
document.getElementById('btn-random').addEventListener('click', () => {
    if (csvData.length === 0) {
        alert("Les données CSV ne sont pas chargées ou le chemin est incorrect.");
        return;
    }

    // 1. Choisir une ligne au hasard
    const randomIndex = Math.floor(Math.random() * csvData.length);
    const row = csvData[randomIndex];
    console.log("Profil CSV sélectionné :", row);

    // 2. Mapping intelligent : CSV vers Echelle 0-100
    // On nettoie les données et on convertit tout sur 100
    
    // Sommeil : risk_sleep (0 ou 1). On inverse car on veut la QUALITÉ du sommeil.
    const v1 = (1 - parseFloat(row.risk_sleep || 0.5)) * 100;
    
    // Culpabilité : risk_guilt (0 ou 1). On garde tel quel (c'est négatif).
    const v2 = parseFloat(row.risk_guilt || 0) * 100;
    
    // Productivité : risk_productivity (0 ou 1). On inverse (on veut la productivité).
    const v3 = (1 - parseFloat(row.risk_productivity || 0.5)) * 100;
    
    // Social : risk_notification (0 ou 1). On utilise ça comme proxy social. On inverse.
    const v4 = (1 - parseFloat(row.risk_notification || 0.5)) * 100;
    
    // Santé : colonne "usage_is_healthy". Texte -> Chiffre.
    let v5 = 50;
    if (row.usage_is_healthy === "Oui") v5 = 90;
    else if (row.usage_is_healthy === "Non") v5 = 20;
    
    // Temps : daily_time_numeric. On normalise sur 8h max.
    // Si la personne passe 4h, ça fait 50% de la jauge temps.
    let valTime = parseFloat(row.daily_time_numeric || 0);
    const v6 = Math.min((valTime / 8) * 100, 100);
    
    // Anxiété : anxiety_score (1 à 7). On convertit sur 100.
    const v7 = (parseFloat(row.anxiety_score || 1) / 7) * 100;
    
    // Contrôle : self_control_score (1 à 7). On convertit sur 100.
    const v8 = (parseFloat(row.self_control_score || 3) / 7) * 100;

    // 3. Nettoyage final (arrondir et éviter les bugs NaN)
    const rawValues = [v1, v2, v3, v4, v5, v6, v7, v8];
    const cleanValues = rawValues.map(v => isNaN(v) ? 50 : Math.round(v));

    updateDisplay(cleanValues);
});

// Initialisation au chargement de la page (tout à 50%)
updateDisplay([50, 50, 50, 50, 50, 50, 50, 50]);