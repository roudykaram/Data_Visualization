import pandas as pd
import numpy as np
import re
import os

# --- 1. CONFIGURATION ---
INPUT_PATH = "./data/raw/Usage_des_reseaux_sociaux.csv"
OUTPUT_FOLDER = "./data/processed"
OUTPUT_PATH = os.path.join(OUTPUT_FOLDER, "questionnaire_clean.csv")

# Création du dossier si nécessaire
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# --- FONCTIONS UTILITAIRES ---

def extract_int(value):
    """Extrait le premier entier trouvé, sinon NaN."""
    if pd.isna(value):
        return np.nan
    m = re.search(r"\d+", str(value))
    return float(m.group()) if m else np.nan

def normalize_country(val):
    """
    Nettoyage des pays en utilisant TES listes exactes.
    La comparaison se fait en minuscule pour ne rien rater.
    """
    if pd.isna(val):
        return "Unknown"
    
    # On convertit l'entrée utilisateur en texte minuscule propre
    val_clean = str(val).lower().strip()
    
    # --- TES LISTES EXACTES ---
    
    # 1. TUNISIE
    liste_tunisie = [
        'tunis', 'Tunisie', 'tunisie', 'Sfax', 'jelma', 'monastir', 
        'hammem chat', 'Médenine', 'medenine', 'عين دراهم', 'Tunis', 
        'TUNISIE', 'TUNISIA', 'Tunis / Tunisie', 'Tunis . Tunisie'
    ]
    # On vérifie chaque mot de ta liste
    for mot in liste_tunisie:
        # On compare minuscule contre minuscule (mot.lower() vs val_clean)
        if mot.lower() in val_clean:
            return 'Tunisia'

    # 2. FRANCE
    liste_france = ['france', 'Lyon /France', 'Lyon . France', 'lyon', 'paris', 'marseille']
    for mot in liste_france:
        if mot.lower() in val_clean:
            return 'France'

    # 3. LIBAN
    liste_liban = [
        'liban', 'lebanon', 'le Liban', 'Libanon', 'Liban', 
        'Lebanese University', 'Lebanon', 'Beyrouth', 'Beirut'
    ]
    for mot in liste_liban:
        if mot.lower() in val_clean:
            return 'Lebanon'

    # 4. USA
    liste_usa = [
        'usa', 'new york', 'New York', 'United States', 
        'United States of America', 'US', 'U.S.A', 
        'États-Unis', 'etats unis', 'Etats Unis'
    ]
    for mot in liste_usa:
        if mot.lower() in val_clean:
            return 'USA'

    # 5. AUTRES
    if 'canada' in val_clean: return 'Canada'
    if 'luxembourg' in val_clean: return 'Luxembourg'
    
    # Si on arrive ici, c'est vraiment "Other" (ou une orthographe imprévue)
    return "Other"

def split_multiselect(x):
    if pd.isna(x): return []
    items = [i.strip() for i in str(x).split(",")]
    return [i for i in items if i]


def main():
    print(f"🔄 Lecture du fichier : {INPUT_PATH}")
    try:
        df = pd.read_csv(INPUT_PATH)
    except FileNotFoundError:
        print("❌ ERREUR : Fichier introuvable.")
        print("   1. Vérifie que le fichier est bien dans : data/raw/")
        print("   2. Vérifie qu'il s'appelle bien : Usage_des_reseaux_sociaux.csv")
        return

    # 1. Suppression question piège
    df = df.drop(columns=["Quelle est la couleur du ciel?"], errors="ignore")

    # 2. Renommage des colonnes
    rename_map = {
        "Horodateur": "timestamp",
        "1. Quel est votre âge ?": "age",
        "2. Genre": "gender",
        "3. Quel est votre statut actuel ?": "status",
        "4. Pays de résidence": "country",
        "1. Quels réseaux sociaux utilisez-vous au moins une fois par semaine ?": "platforms",
        "2. Parmi ces réseaux, lequel utilisez-vous le plus ?": "main_platform",
        "3.Et lequel utilisez-vous en deuxième le plus ?": "second_platform",
        "4. En moyenne, combien de temps passez-vous par jour sur tous les réseaux sociaux confondus ?": "daily_time_cat",
        " 5. À quels moments de la journée utilisez-vous le plus les réseaux sociaux ?": "day_moments",
        "6. Quelles activités faites-vous le plus souvent sur les réseaux sociaux ?": "activities",
        "7. Pour le réseau que vous utilisez le plus, l’utilisation influence comment votre humeur ?": "mood_impact",
        "8. Après avoir utilisé vos réseaux sociaux, vous vous sentez le plus souvent :": "emotions",
        "9. Pensez-vous que votre usage des réseaux sociaux affecte votre confiance en vous ?": "self_esteem_impact",
        "10. En général, qu’est-ce qui vous fait arrêter de scroller ?": "stop_scrolling_reason",
        "11. Sur une échelle de 1 à 7, quel a été votre niveau d’anxiété cette semaine ?": "anxiety_score",
        "12. Quand vous vous sentez anxieux, utilisez-vous davantage les réseaux sociaux ?": "anxiety_more_usage",
        "13. Après avoir utilisé les réseaux sociaux, votre anxiété :": "anxiety_after",
        "14. Avez-vous des difficultés de sommeil liées à l’usage des réseaux sociaux ?": "sleep_difficulties",
        "15. À quelle fréquence utilisez-vous votre téléphone dans les 30 minutes avant de dormir ?": "phone_before_sleep",
        "16. Avez-vous déjà essayé de réduire votre usage, sans succès ?": "failed_reduction",
        "17. Perdez-vous la notion du temps lorsque vous utilisez les réseaux sociaux ?": "time_loss",
        "18. Vous sentez-vous obligé(e) de vérifier vos notifications ?": "notification_compulsion",
        "19. Votre usage impacte-t-il votre productivité ou vos études ?": "productivity_impact",
        "20. Vous arrive-t-il de culpabiliser après avoir utilisé les réseaux sociaux ?": "guilt_after_use",
        "21. Sur une échelle de 1 à 7, comment évalueriez-vous votre maîtrise de votre usage des réseaux sociaux ?": "self_control_score",
        "22. Pensez-vous que votre usage actuel est sain ?": "usage_is_healthy",
        "23. Qu’aimeriez-vous améliorer dans votre usage ?": "improvement_wish",
    }
    df = df.rename(columns=rename_map)

    # 3. Nettoyages de base
    df["age"] = df["age"].apply(extract_int)

    # APPLICATION DE TA FONCTION PAYS PERSONNALISÉE
    df["country"] = df["country"].apply(normalize_country)

    gender_map = {'Homme': 'Male', 'Femme': 'Female', 'Autre': 'Other', 'Je préfère ne pas répondre': 'Other'}
    df['gender'] = df['gender'].map(gender_map)



    # ✅ AJOUT 1 : usage_intensity_score (1 -> 6)
    intensity_mapping = {
        'Moins de 30 minutes': 1,
        '30 min – 1 heure': 2,
        '1–2 heures': 3,
        '2–3 heures': 4,
        '3–4 heures': 5,
        'Plus de 4 heures': 6
    }
    df["usage_intensity_score"] = df["daily_time_cat"].map(intensity_mapping)

    # ✅ AJOUT 2 : anxiety_delta (-1 / 0 / +1)
    # Diminue = -1, Ne change pas = 0, Augmente = +1
    anxiety_delta_map = {
        "diminue": -1,
        "ne change pas": 0,
        "augmente": 1
    }
    df["anxiety_delta"] = (
        df["anxiety_after"]
        .astype(str)
        .str.lower()
        .str.strip()
        .replace({"nan": np.nan})
        .map(anxiety_delta_map)
    )

    # 5. Gestion des listes
    for c in ["platforms", "day_moments", "activities", "emotions"]:
        df[c] = df[c].apply(split_multiselect)

    # 6. Conversion Booléens
    yn_map = {"oui": True, "non": False}
    bool_cols = [
        "sleep_difficulties", "failed_reduction", "time_loss",
        "notification_compulsion", "productivity_impact",
        "guilt_after_use", "usage_is_healthy"
    ]
    for c in bool_cols:
        if c in df.columns:
            df[c] = df[c].astype(str).str.lower().str.strip().replace({"nan": np.nan}).map(yn_map)

    # 7. CALCUL DU SCORE DE RISQUE
    risk_components = [
        "time_loss", "failed_reduction", "sleep_difficulties",
        "notification_compulsion", "guilt_after_use", "productivity_impact"
    ]
    tmp_risk = df[risk_components].fillna(False).astype(int)

    # si tu veux aussi le raw :
    df["risk_score_raw"] = tmp_risk.sum(axis=1)

    df["risk_score"] = (df["risk_score_raw"] / len(risk_components)) * 100

    # 8. Sauvegarde
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"✅ Fichier PROPRE généré : {OUTPUT_PATH}")
    print("\n--- Vérification des Pays (Top 10) ---")
    print(df['country'].value_counts().head(10))

if __name__ == "__main__":
    main()
