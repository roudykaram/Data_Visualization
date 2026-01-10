function createDiagnosticViz(data) {
    
    // --- 1. FONCTION POUR DESSINER LA JAUGE (GAUGE) ---
    function drawGauge(containerId, score) {
        d3.select(containerId).html(""); // Nettoyer
        
        const width = 300, height = 200;
        const radius = Math.min(width, height) - 20;
        
        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width / 2},${height - 20})`);

        // Echelle de couleur (Vert -> Jaune -> Rouge)
        const colorScale = d3.scaleLinear()
            .domain([0, 50, 100])
            .range(["#2ecc71", "#f1c40f", "#e74c3c"]);

        // L'Arc de fond (Demi-cercle gris)
        const arc = d3.arc()
            .innerRadius(radius - 40)
            .outerRadius(radius)
            .startAngle(-Math.PI / 2)
            .endAngle(Math.PI / 2);

        svg.append("path")
            .attr("d", arc)
            .attr("fill", "#eee");

        // L'Arc de valeur (Le score)
        // Convertir score (0-100) en radians (-PI/2 à PI/2)
        const scoreAngle = (score / 100) * Math.PI - (Math.PI / 2);

        const activeArc = d3.arc()
            .innerRadius(radius - 40)
            .outerRadius(radius)
            .startAngle(-Math.PI / 2)
            .endAngle(scoreAngle);

        svg.append("path")
            .attr("d", activeArc)
            .attr("fill", colorScale(score));

        // Texte du score au centre
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("y", -20)
            .style("font-size", "40px")
            .style("font-weight", "bold")
            .style("fill", colorScale(score))
            .text(Math.round(score) + "%");
        
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("y", 15)
            .style("font-size", "14px")
            .style("fill", "#777")
            .text("Niveau de Risque");
    }

    // --- 2. FONCTION POUR DESSINER LE RADAR (SPIDER CHART) ---
    function drawRadar(containerId, userData) {
        d3.select(containerId).html(""); // Nettoyer

        const width = 350, height = 300;
        const margin = 40;
        const radius = Math.min(width, height) / 2 - margin;

        const svg = d3.select(containerId)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);

        // Les axes du radar
        const features = [
            {name: "Sommeil", value: userData.risk_sleep},
            {name: "Temps Perdu", value: userData.risk_timeloss},
            {name: "Notifications", value: userData.risk_notification},
            {name: "Culpabilité", value: userData.risk_guilt},
            {name: "Productivité", value: userData.risk_productivity},
            {name: "Échec Réduction", value: userData.risk_failed_reduction}
        ];

        const angleSlice = Math.PI * 2 / features.length;

        // Echelle radiale (0 au centre, 1 au bord)
        const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

        // Dessiner la grille (cercles concentriques)
        const levels = [0.25, 0.5, 0.75, 1];
        levels.forEach(level => {
            svg.append("circle")
                .attr("r", rScale(level))
                .style("fill", "none")
                .style("stroke", "#CDCDCD")
                .style("stroke-dasharray", "3,3");
        });

        // Dessiner les axes (lignes)
        const axes = svg.selectAll(".axis")
            .data(features)
            .enter()
            .append("g")
            .attr("class", "axis");

        axes.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", (d, i) => rScale(1.1) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y2", (d, i) => rScale(1.1) * Math.sin(angleSlice * i - Math.PI / 2))
            .style("stroke", "grey")
            .style("stroke-width", "1px");

        // Labels des axes
        axes.append("text")
            .attr("x", (d, i) => rScale(1.25) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y", (d, i) => rScale(1.25) * Math.sin(angleSlice * i - Math.PI / 2))
            .style("font-size", "11px")
            .attr("text-anchor", "middle")
            .text(d => d.name);

        // Dessiner la forme (La zone de risque)
        const radarLine = d3.lineRadial()
            .angle((d, i) => i * angleSlice)
            .radius(d => rScale(d.value))
            .curve(d3.curveLinearClosed);

        svg.append("path")
            .datum(features)
            .attr("d", radarLine)
            .style("fill", "rgba(231, 76, 60, 0.5)") // Rouge semi-transparent
            .style("stroke", "#e74c3c")
            .style("stroke-width", 2);
            
        // Titre
        svg.append("text")
            .attr("x", 0)
            .attr("y", -height/2 + 15)
            .attr("text-anchor", "middle")
            .style("font-weight", "bold")
            .text("Détails des facteurs de risque");
    }

    // --- 3. INTERACTION ---
    
    // Fonction pour mettre à jour tout le dashboard avec un utilisateur
    function updateDashboard(user) {
        console.log("Utilisateur affiché :", user);
        drawGauge("#vis-jauge", user.risk_score);
        drawRadar("#vis-radar", user);
    }

    // Initialisation avec le premier utilisateur
    updateDashboard(data[0]);

    // Gestion du clic bouton
    d3.select("#btn-random-user").on("click", () => {
        // Prendre un index aléatoire
        const randomIndex = Math.floor(Math.random() * data.length);
        const randomUser = data[randomIndex];
        updateDashboard(randomUser);
    });
}