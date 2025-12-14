import pandas as pd
import numpy as np
import re
import os

# --- 1. CONFIGURATION ---
INPUT_PATH = "./data/raw/Usage_des_reseaux_sociaux.csv"
OUTPUT_FOLDER = "./data/processed"
OUTPUT_PATH = os.path.join(OUTPUT_FOLDER, "questionnaire_clean.csv")

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# --- FONCTIONS DE NETTOYAGE ---

def extract_int(value):
    if pd.isna(value): return np.nan
    m = re.search(r"\d+", str(value))
    return float(m.group()) if m else np.nan

def normalize_country(val):
    if pd.isna(val): return "Unknown"
    val_clean = str(val).lower().strip()
    
    # Listes de pays (Ta configuration validée)
    liste_tunisie = ['tunis', 'Tunisie', 'tunisie', 'Sfax', 'jelma', 'monastir', 'hammem chat', 'Médenine', 'medenine', 'عين دراهم', 'Tunis', 'TUNISIE', 'TUNISIA', 'Tunis / Tunisie', 'Tunis . Tunisie']
    for mot in liste_tunisie:
        if mot.lower() in val_clean: return 'Tunisia'

    liste_france = ['france', 'Lyon /France', 'Lyon . France', 'lyon', 'paris', 'marseille']
    for mot in liste_france:
        if mot.lower() in val_clean: return 'France'

    liste_liban = ['liban', 'lebanon', 'le Liban', 'Libanon', 'Liban', 'Lebanese University', 'Lebanon', 'Beyrouth', 'Beirut']
    for mot in liste_liban:
        if mot.lower() in val_clean: return 'Lebanon'

    liste_usa = ['usa', 'new york', 'New York', 'United States', 'United States of America', 'US', 'U.S.A', 'États-Unis', 'etats unis', 'Etats Unis']
    for mot in liste_usa:
        if mot.lower() in val_clean: return 'USA'

    if 'canada' in val_clean: return 'Canada'
    if 'luxembourg' in val_clean: return 'Luxembourg'
    
    return "Other"

def split_multiselect(x):
    if pd.isna(x): return []
    items = [i.strip() for i in str(x).split(",")]
    return [i for i in items if i]

# --- FONCTIONS SCORE DE RISQUE ---
def map_frequency_to_score(val):
    if pd.isna(val): return 0
    v = str(val).lower().strip()
    if any(x in v for x in ['jamais', 'non', 'pas du tout']): return 0
    if any(x in v for x in ['rarement']): return 0.25
    if any(x in v for x in ['parfois']): return 0.5
    if any(x in v for x in ['souvent', 'toujours', 'fréquemment', 'oui']): return 1.0
    return 0

def map_productivity_score(val):
    try:
        return 1.0 if float(val) >= 5 else 0.0
    except:
        return 0.0

# --- NOUVEAU : FONCTIONS CERCLE VICIEUX ---
def map_anxiety_trigger(val):
    """Quand je suis anxieux, j'utilise plus ? (Déclencheur)"""
    # Oui -> 2 (Fort), Parfois -> 1 (Moyen), Non -> 0 (Faible)
    v = str(val).lower().strip()
    if 'oui' in v: return 2
    if 'parfois' in v: return 1
    return 0

def map_anxiety_outcome(val):
    """Après utilisation, mon anxiété... ? (Conséquence)"""
    # Augmente -> 1 (Mauvais), Ne change pas -> 0, Diminue -> -1 (Bon)
    v = str(val).lower().strip()
    if 'augmente' in v: return 1
    if 'diminue' in v: return -1
    return 0

def main():
    print(f" Lecture du fichier : {INPUT_PATH}")
    try:
        df = pd.read_csv(INPUT_PATH)
    except FileNotFoundError:
        print(" ERREUR : Fichier introuvable.")
        return

    # 1. Suppression question piège
    df = df.drop(columns=["Quelle est la couleur du ciel?"], errors="ignore")

    # 2. Renommage
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

    # 3. SUPPRESSION DU TIMESTAMP (Inutile)
    df = df.drop(columns=['timestamp'], errors='ignore')

    # Nettoyages standards
    df["age"] = df["age"].apply(extract_int)
    df["country"] = df["country"].apply(normalize_country)
    
    gender_map = {'Homme': 'Male', 'Femme': 'Female', 'Autre': 'Other', 'Je préfère ne pas répondre': 'Other'}
    df['gender'] = df['gender'].map(gender_map)

    time_mapping = {
        'Moins de 30 minutes': 0.25, '30 min – 1 heure': 0.75,
        '1–2 heures': 1.5, '2–3 heures': 2.5,
        '3–4 heures': 3.5, 'Plus de 4 heures': 5.0
    }
    df['daily_time_numeric'] = df['daily_time_cat'].map(time_mapping)

    # Listes
    for c in ["platforms", "day_moments", "activities", "emotions"]:
        df[c] = df[c].apply(split_multiselect)

    # 4. NOUVEAU : COLONNES TEMPORELLES POUR LA VISUALISATION
    # Cela te permet de dire : "Pour tous les gens qui utilisent le MATIN, quelle est leur anxiété ?"
    # On crée 4 colonnes booléennes (0 ou 1)
    df['use_morning'] = df['day_moments'].astype(str).apply(lambda x: 1 if 'Matin' in x else 0)
    df['use_afternoon'] = df['day_moments'].astype(str).apply(lambda x: 1 if 'Après-midi' in x else 0)
    df['use_evening'] = df['day_moments'].astype(str).apply(lambda x: 1 if 'Soir' in x else 0)
    df['use_night'] = df['day_moments'].astype(str).apply(lambda x: 1 if 'Nuit' in x else 0)

    # 5. NOUVEAU : COLONNES CERCLE VICIEUX (Numeric)
    # Pour changer la couleur ou la taille des points selon l'intensité du cycle
    df['cycle_trigger_numeric'] = df['anxiety_more_usage'].apply(map_anxiety_trigger)
    df['cycle_outcome_numeric'] = df['anxiety_after'].apply(map_anxiety_outcome)

    # 6. Score de Risque (Gardé identique)
    df['risk_sleep'] = df['sleep_difficulties'].apply(map_frequency_to_score)
    df['risk_timeloss'] = df['time_loss'].apply(map_frequency_to_score)
    df['risk_notification'] = df['notification_compulsion'].apply(map_frequency_to_score)
    df['risk_guilt'] = df['guilt_after_use'].apply(map_frequency_to_score)
    df['risk_failed_reduction'] = df['failed_reduction'].apply(map_frequency_to_score)
    df['risk_productivity'] = df['productivity_impact'].apply(map_productivity_score)

    risk_columns = ['risk_sleep', 'risk_timeloss', 'risk_notification', 'risk_guilt', 'risk_failed_reduction', 'risk_productivity']
    df['total_risk_points'] = df[risk_columns].sum(axis=1)
    df['risk_score'] = (df['total_risk_points'] / 6) * 100

    # Sauvegarde
    df.to_csv(OUTPUT_PATH, index=False)
    
    print(f" Fichier FINAL généré : {OUTPUT_PATH}")
    print("\n--- Nouvelles Colonnes Ajoutées ---")
    print(df[['use_morning', 'use_night', 'cycle_trigger_numeric']].head())

if __name__ == "__main__":
    main()