# Social Media & Well-being Visualization

**How do digital interactions influence our mental health?** This project explores the complex relationship between social media usage patterns, interface design, and user well-being through interactive data visualizations.

> **Course:** Data Visualization (Master 2 Artificial Intellegence - Université Lyon 1)  
> **Team:** Sarra MEJRI, Jane AZIZ, Roudy KARAM
> **Live Demo:** (https://roudykaram.github.io/Data_Visualization/app/home/index.html)


## Project Overview

Public debate often reduces the impact of social media to a simple cause-and-effect relationship ("Social media causes depression"). Our goal is to nuance this view by exploring **correlations, behavioral loops, and design mechanisms**.

We structured the project into three interactive steps:
1.  **Understanding the Cycle:** How usage triggers emotional responses and creates a feedback loop (the "re-scroll").
2.  **Comparing Platforms:** Analyzing which apps are the most stressful and explaining *why* via design metrics (density of stimulation).
3.  **Self-Diagnosis:** A tool for users to assess their own "Digital Health" based on 8 key factors.


## Data Sources

To build a comprehensive analysis, we combined external datasets with primary data collected specifically for this project:

### 1. Custom Survey (Primary Data)
* **Source:** Exclusive questionnaire conducted with **~150 students** (Jan 2025).
* **Key Variables:** Instant emotional impact (mood before/after), specific habits (night scrolling), and the "re-scroll" intensity.
* **Why:** Fills the gap in public datasets by capturing the *immediate* emotional loop.

### 2. External Dataset (Kaggle)
* **Source:** *Mental Health and Social Media Balance Dataset*.
* **Key Variables:** Daily screen time, stress levels, primary platform, age.
* **Why:** Provides a statistical baseline for general usage trends.

### 3. "Design & Scroll" Test
* **Methodology:** A manual test performed by the team to quantify the "Density of Stimulation." We scrolled for 5 minutes on major platforms and counted the number of Videos vs. Images vs. Text encountered.
* **Result:** Explains the "addictive" potential of platforms like TikTok (high video density) vs. Instagram.


## Visualizations

The application is divided into three main modules:

### 1. The Anxiety Cycle (`vis2.2`)
* **Concept:** Visualizes the vicious cycle between **Usage** and **Anxiety**.
* **Chart Type:** Directed Graph & Donut Chart.
* **Insight:** Shows the distribution of emotional impact and the "Re-scroll Score" — measuring how often users return to the app as a refuge mechanism when anxious.

### 2. Platform Comparison (`visu_1`)
* **Concept:** Is TikTok more stressful than YouTube or any other social media?
* **Chart Types:**
    * **Boxplots / Violin Plots:** To show the distribution of stress scores across different apps.
    * **Stacked Bar Chart:** Visualizes the "Density of Stimulation" (Design Test) to correlate interface speed with stress.
* **Interaction:** Toggle between View modes (Boxplot/Violin) and Datasets (Kaggle/Questionnaire).

### 3. My Diagnostic (`visu3`)
* **Concept:** A personal assessment tool.
* **Chart Type:** **Radar Chart (Spider Web)** with 8 axes.
* **Factors:** Sleep quality, Guilt, Productivity, Social life, Anxiety, Screen time, Self-control, General health.
* **Interaction:** Users input their own habits to generate a score and see their profile overlaid against the average student profile.


##  Technical Stack

* **Frontend:** HTML5, CSS3 (Custom Dark Mode & Responsive Design).
* **Visualization Library:** **D3.js (v7)** for all charts.
* **Data Processing:** Python (Pandas) for cleaning and merging CSV files.
* **Architecture:** Single Page Application (SPA) feel with navigation headers.

##  Project Structure

.
├── app/
│   ├── home/           # Landing Page (Context & Methodology)
│   ├── vis2.2/         # Step 1: The Cycle Visualization
│   ├── visu_1/         # Step 2: Platform Comparison & Design Test
│   └── visu3/          # Step 3: Diagnostic Tool
├── data/
│   ├── raw/            # Original datasets
│   └── processed/      # Cleaned CSV files used by D3.js
├── scripts/            # Python scripts for data cleaning
├── index.html          # Root redirect file for GitHub Pages
└── README.md           # Project Documentation