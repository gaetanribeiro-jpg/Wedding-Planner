"""
config.py — l'equilibrage, cote oracle Python.

⚠️ C'EST ICI QU'ON REGLE, PAS DANS LE JS. La methode, dans l'ordre :
    1. modifier ce fichier
    2. mesurer avec tune.py (N parties par valeur, classees par ecart a la cible)
    3. verifier la courbe avec `npm run balance`
    4. SEULEMENT ENSUITE repercuter dans src/config.js
    5. controler avec `npm run parite --graines 20`
Ne jamais tuner a vue directement dans le JS : c'est ce qui a fait perdre des
sessions entieres sur le projet precedent.

⚠️ Ce fichier doit rester le MIROIR de src/config.js. `verifier.py` compare les
deux et gueule des qu'une valeur diverge — sans ce controle, on regle un jeu
qui n'est pas celui qu'on livre.
"""

# ------------------------------------------------------------------ horloge
MS_PAR_JOUR = 12500
JOURS_PAR_SAISON = 90
SALON_TOUS_LES_JOURS = 360
SALON_JOUR_DANS_ANNEE = 315

ARGENT_DEPART = 6000
NOTORIETE_DEPART = 0

# ------------------------------------------------------------------ cibles
CIBLE_HEURES = 11
CIBLE_CONTRATS = (150, 250)
CIBLE_TAUX_RATE = 0.15
CIBLE_REFUS = (7, 30)

# ------------------------------------------------------------------ saisons
SAISONS = ["printemps", "ete", "automne", "hiver"]
SAISON = {
    "printemps": {"prospects": 1.05, "frequentation": 1.10},
    "ete":       {"prospects": 2.20, "frequentation": 1.15},
    "automne":   {"prospects": 0.85, "frequentation": 0.95},
    "hiver":     {"prospects": 0.35, "frequentation": 0.70},
}

# ------------------------------------------------------------------ paliers
PALIERS = [
    {"n": 1, "txt": "Quartier", "seuil": 0,    "budgetMult": 1.00, "invitesMax": 70},
    {"n": 2, "txt": "Ville",    "seuil": 140,  "budgetMult": 1.55, "invitesMax": 110},
    {"n": 3, "txt": "Région",   "seuil": 520,  "budgetMult": 2.40, "invitesMax": 160},
    {"n": 4, "txt": "Capitale", "seuil": 1350, "budgetMult": 3.80, "invitesMax": 230},
    {"n": 5, "txt": "Royal",    "seuil": 2900, "budgetMult": 6.00, "invitesMax": 320},
]

# ------------------------------------------------------------------- styles
STYLES = ["boheme", "classique", "moderne", "romantique"]
AFFINITE = {
    "boheme":     {"boheme": 1.00, "classique": 0.35, "moderne": 0.30, "romantique": 0.70},
    "classique":  {"boheme": 0.35, "classique": 1.00, "moderne": 0.55, "romantique": 0.75},
    "moderne":    {"boheme": 0.30, "classique": 0.55, "moderne": 1.00, "romantique": 0.40},
    "romantique": {"boheme": 0.70, "classique": 0.75, "moderne": 0.40, "romantique": 1.00},
}

# -------------------------------------------------------------------- slots
SLOTS = ["lieu", "robe", "costume", "decoration", "traiteur", "musique"]
SLOT = {
    "lieu":       {"source": "prestataire", "poids": 1.15},
    "robe":       {"source": "stock",       "poids": 1.30},
    "costume":    {"source": "stock",       "poids": 0.85},
    "decoration": {"source": "stock",       "poids": 1.00},
    "traiteur":   {"source": "prestataire", "poids": 0.95},
    "musique":    {"source": "prestataire", "poids": 0.75},
}

# -------------------------------------------------------------------- stock
FAMILLES = {
    "robe": {
        "princesse":   ("romantique", 1.20), "sirene":  ("moderne", 1.10),
        "boheme":      ("boheme", 0.90),     "empire":  ("classique", 1.00),
        "courte":      ("moderne", 0.75),
    },
    "costume": {
        "troisPieces": ("classique", 1.05),  "smoking": ("classique", 1.20),
        "lin":         ("boheme", 0.80),     "velours": ("romantique", 1.10),
        "cintre":      ("moderne", 0.95),
    },
    "decoration": {
        "guirlandes":  ("boheme", 0.70),     "centres":  ("classique", 0.95),
        "arche":       ("romantique", 1.15), "lanternes": ("romantique", 0.85),
        "minimaliste": ("moderne", 1.00),
    },
}
RARETES = {
    "commun":    {"poids": 62, "qualite": 1.00, "prix": 1.00, "affixes": 0},
    "rare":      {"poids": 30, "qualite": 1.28, "prix": 1.75, "affixes": 1},
    "exception": {"poids": 8,  "qualite": 1.62, "prix": 3.20, "affixes": 2},
}
AFFIXES = {
    "brodee":     {"axe": "elegance",  "val": 6,  "poids": 10},
    "surMesure":  {"axe": "elegance",  "val": 9,  "poids": 7},
    "vintage":    {"axe": "emotion",   "val": 8,  "poids": 9},
    "signature":  {"axe": "emotion",   "val": 11, "poids": 5},
    "soldee":     {"axe": "budget",    "val": 10, "poids": 8},
    "intemporel": {"axe": "coherence", "val": 7,  "poids": 8},
    "audacieux":  {"axe": "coherence", "val": -6, "poids": 6, "bonusEmotion": 14},
}
PRIX_BASE = {"robe": 520, "costume": 340, "decoration": 260}
PRIX_EXPOSANT = 1.85
QUALITE_BASE = 34
QUALITE_PAR_TIER = 13
TAUX_REVENTE = 0.45
CATALOGUE_TAILLE = 10
CATALOGUE_PAR_PALIER = 4
CATALOGUE_JOURS = 12
USURE_PAR_USAGE = 0.05
USURE_PLANCHER = 0.60

# ------------------------------------------------------------- prestataires
PRESTA_TYPES = {
    "lieu":     {"prixBase": 1500, "jourBloques": 2},
    "traiteur": {"prixBase": 780,  "jourBloques": 1},
    "musique":  {"prixBase": 420,  "jourBloques": 1},
}
PRESTATAIRES = {
    "salleDesFetes":  ("lieu", 1, 32, "classique",  0.55),
    "grangeVerger":   ("lieu", 1, 44, "boheme",     0.80),
    "jardinHotel":    ("lieu", 2, 58, "romantique", 1.10),
    "loftIndustriel": ("lieu", 2, 61, "moderne",    1.20),
    "domaineVerger":  ("lieu", 3, 74, "boheme",     1.70),
    "chateauMarais":  ("lieu", 4, 88, "classique",  2.60),
    "villaCap":       ("lieu", 5, 96, "moderne",    3.60),
    "buffetMarcel":   ("traiteur", 1, 30, "classique",  0.60),
    "tableChamps":    ("traiteur", 1, 47, "boheme",     0.90),
    "maisonRoux":     ("traiteur", 2, 60, "romantique", 1.15),
    "atelierSel":     ("traiteur", 3, 75, "moderne",    1.65),
    "chefBertrand":   ("traiteur", 4, 90, "classique",  2.70),
    "djTonio":        ("musique", 1, 34, "moderne",    0.55),
    "duoCordes":      ("musique", 1, 45, "romantique", 0.85),
    "groupeFolk":     ("musique", 2, 58, "boheme",     1.05),
    "quatuorLune":    ("musique", 3, 76, "classique",  1.70),
    "orchestreOpera": ("musique", 4, 93, "classique",  2.90),
}
PRESSION_BASE = 0.10
PRESSION_PAR_PALIER = 0.055
FIDELITE_MAX = 5
FIDELITE_REMISE = 0.04
FIDELITE_PRIORITE = 0.09
# ⚠️ Un prestataire chiffre le mariage qu'il a devant lui. Sans ce facteur, la
# part du budget reellement depensee s'effondrait avec le palier (0,29 au
# palier 1, 0,037 au palier 5) parce que le budget est multiplie par six et pas
# les prix : l'axe BUDGET de la note valait 0 sur TOUS les mariages.
# Un EXPOSANT, pas un facteur : il vaut 1 en 1, donc les devis du palier 1
# restent ceux du jeu qui finissait a 100 %. La premiere version etait un
# facteur plat (PRIX_MULT=3) : elle triplait aussi les prix du quartier, ou le
# budget des couples n'a pas bouge, et deux parties sur vingt restaient
# BLOQUEES AU PALIER 1 pendant 12 000 jours (34 contrats, note 44 contre 72).
# Courbe mesuree, 12 graines : 1,6 -> axe budget 37 ; 1,9 -> 52 ; 2,2 -> 62 ;
# 2,6 -> FALAISE, zero partie finie sur douze. On prend 2,0, avec de la marge.
PRESTA_AMBITION_EXPOSANT = 2.0

# ------------------------------------------------------------------ clients
PROSPECTS_PAR_JOUR = 0.075
PROSPECT_PAR_NOTORIETE = 0.00003
PATIENCE_JOURS = 10
DELAI_MIN, DELAI_MAX = 60, 120
BUDGET_PAR_INVITE = 118
BUDGET_PLANCHER = 3800
GOUT_DOMINANT = (58, 88)
GOUT_SECOND = (22, 52)
GOUT_RESTE = (4, 26)
# ⚠️ Remontee de 38 a 42 en meme temps que PRESTA_PRIX_MULT : ranimer l'axe
# budget a ajoute ~6 points a chaque note, et l'ancienne valeur avait ete
# reglee sur un jeu ou un quart des axes valait zero. Deuxieme falaise :
# 45 -> 12,6 h, 48 -> 18,4 h, 51 -> 33,7 h et 7/12 parties finies seulement.
EXIGENCE_BASE = 42
EXIGENCE_PAR_PALIER = 6.5
CAPACITE_BASE = 3
CAPACITE_PAR_PALIER = 1

COUT_NOTORIETE = 8
COUT_ESCALADE = 4
CARNET_MARGE = 3
OUBLI_JOURS = 90

# ------------------------------------------------------------------ mariage
AXES = {"elegance": 0.30, "coherence": 0.28, "emotion": 0.27, "budget": 0.15}
PENALITE_SLOT_VIDE = 17
PART_GOUTS = 0.60
MALUS_RATE_NOTORIETE = 26
MALUS_RATE_HONORAIRES = 0.55
TAUX_HONORAIRES = 0.22
BONUS_NOTE = 0.55
NOTORIETE_BASE = 5
NOTORIETE_PAR_NOTE = 0.09
NOTORIETE_PAR_INVITE = 0.035
BOUCHE_A_OREILLE = 0.004
BUDGET_TOLERANCE = 1.04
BUDGET_PENALITE = 180
PORTEURS = {"lieu": 1.15, "musique": 1.30, "decoration": 1.25,
            "robe": 0.55, "costume": 0.35, "traiteur": 0.85}

# -------------------------------------------------------------- concurrents
CONCURRENTS = [
    ("aurore",  "romantique", 1.15), ("blancOr", "classique", 0.95),
    ("duval",   "moderne",    0.85), ("garance", "boheme",    1.05),
]
RIVAL_GAIN_BASE = 0.55
RIVAL_GAIN_SUIVI = 0.34
RIVAL_GAIN_REPRISE = 11

# -------------------------------------------------------------------- salon
SALON_POIDS_THEME = 0.40
SALON_PIECES_STAND = 5
SALON_COUT_STAND = 1200
SALON_MALUS_ABSENCE = 45
SALON_RIVAL_BASE = 150
SALON_RIVAL_PAR_PALIER = 120
SALON_RIVAL_PAR_NOTORIETE = 0.02
SALON_PRIX = {1: (9000, 150), 2: (4500, 85), 3: (2000, 40)}

# ----------------------------------------------------------------- boutique
BOUTIQUE_L, BOUTIQUE_H = 9, 7
# ⚠️ Le 7e champ dit si le meuble occupe le SOL. Un tapis (revetement) et un
# cadre (mural) n'occupent pas de case, et surtout ils ne comptent PAS comme
# voisins pour les combos — cote JS, `meubleEn()` les ignore. Sans ce champ,
# l'oracle Python accordait des bonus de combo que le jeu ne donne pas.
MEUBLES = {
    # cle:        (prix, gain, places, attrait, palier, categorie, occupeLeSol)
    "portant":    (420,  5.5, 2, 6,  1, "vente", True),
    "mannequin":  (680,  7.5, 1, 11, 1, "vente", True),
    "comptoir":   (900,  11,  1, 4,  1, "service", True),
    "vitrine":    (1150, 13,  1, 9,  2, "vente", True),
    "miroir":     (340,  2.0, 1, 8,  1, "confort", True),
    "plante":     (150,  0.6, 0, 5,  1, "confort", True),
    "canape":     (760,  3.0, 3, 7,  1, "confort", True),
    "tapis":      (480,  0,   0, 10, 2, "confort", False),
    "etagere":    (520,  6.0, 1, 5,  2, "vente", True),
    "cadre":      (190,  0,   0, 4,  1, "confort", False),
    "podium":     (1600, 19,  1, 14, 3, "service", True),
    "tableRonde": (1250, 16,  2, 6,  3, "service", True),
}
COMBOS = [("vente", "confort", 0.22), ("vente", "service", 0.30),
          ("service", "confort", 0.18)]

GAIN_FREQUENTATION = 1.0
VISITEURS_BASE = 3.0
VISITEURS_PAR_NOTORIETE = 0.019
VISITEURS_PAR_ATTRAIT = 0.070
CHARGES_BASE = 12
# ⚠️ Les charges suivent la boutique qu'on TIENT, pas le palier atteint. Avec
# un forfait par palier, une graine sur vingt finissait a 12 000 jours au
# palier 1, notoriete 0, argent 0 : le revenu plancher d'une boutique
# depouillee (~25/jour) etait sous le loyer (55/jour), et le palier ne
# redescend jamais. Indexee sur les meubles, la charge se degonfle quand la
# boutique se vide — il reste toujours un chemin de retour.
# Mesure a 20 graines : 1,5 / 2,5 / 3,5 donnent toutes 20/20 parties finies.
# On prend la plus HAUTE des trois — l'argent doit rester une contrainte, et
# 3,5 est le maximum qui ne rouvre pas le piege. A 5,4 la completion retombait
# a 14/20 : l'IA batit ~63 meubles tres tot, donc le loyer explosait des le
# palier 2.
CHARGES_PAR_MEUBLE = 3.5





# ------------------------------------------------------------------- vente
# ⚠️ L'argent ne monte pas tout seul : un visiteur servi a un meuble de VENTE
# peut repartir avec une piece, qui quitte le stock.
MARGE_VENTE = 1.45
VENTE_CHANCE_BASE = 0.028
VENTE_CHANCE_PAR_ATTRAIT = 0.0004
VENTE_MALUS_PAR_TIER = 0.16
VENTE_DECOTE_USAGE = 0.12
COMMISSION_PRESTA = 0.18

# ---------------------------------------------------------------- imprevus
# ⚠️ Ce qui donne ses dents au jeu : ils tombent APRES la signature, donc
# l'estimation faite au moment de s'engager ne peut pas les connaitre.
IMPREVU_CHANCE_PAR_JOUR = 0.10
# ⚠️ C'EST CETTE CONSTANTE QUI COMMANDE LES DENTS, pas CHANCE_PAR_JOUR.
# Symptome du piege herite n°4 : monter la chance de 0,10 a 0,22 ne bougeait
# le taux de rate que de 7,3 % a 9,1 %, parce que le plafond par dossier etait
# deja atteint (2,78 imprevus pour un plafond de 3). La chance ne decide plus
# rien des que la preparation dure 60 a 120 jours — c'est le plafond qui lie.
# Courbe mesuree, sans falaise : 3 -> 7,3 % de rates, 4 -> 11,1 %, 5 -> 14,8 %,
# 6 -> 20,1 %, 8 -> 23,6 %.
IMPREVU_MAX_PAR_DOSSIER = 4
IMPREVU_MARGE_JOURS = 2
IMPREVUS = {
    "defection":      {"poids": 26},
    "invitesEnPlus":  {"poids": 22, "part": (0.15, 0.40)},
    "exigenceMontee": {"poids": 20, "val": (4, 11)},
    "budgetCoupe":    {"poids": 16, "part": (0.08, 0.22)},
    "pieceAbimee":    {"poids": 16, "usures": 2},
}
EXIGENCE_FLOU_PART = 0.18
EXIGENCE_FLOU_MIN = 5

# ------------------------------------------------------------------ equipe
ROLES = {
    # role:          (places, chanceVente, elegance, coherence,
    #                 capacite, pareImprevu, prospects, notoriete)
    "vendeur":      (1, 0.05, 0,   0,   0,   0,    0,     0),
    "styliste":     (0, 0,    2.6, 2.2, 0,   0,    0,     0),
    "coordinateur": (0, 0,    0,   0,   0.5, 0.10, 0,     0),
    "attache":      (0, 0,    0,   0,   0,   0,    0.022, 0.05),
}
EQUIPE_NIVEAU_MAX = 4
COUT_RECRUE_BASE = 900
COUT_RECRUE_PAR_MEMBRE = 700
SALAIRE_BASE = 26
SALAIRE_PAR_NIVEAU = 14
COUT_FORMATION_BASE = 700
COUT_FORMATION_PAR_NIVEAU = 850
JOURS_FORMATION_BASE = 12
JOURS_FORMATION_PAR_NIVEAU = 6
PLACES_BASE = 1
PLACES_PAR_PALIER = 1

# ------------------------------------------------------------- surcharges
# ⚠️ Piege herite n°8 : ne balaie jamais une constante pendant que tu edites
# les sources. `tune.py` relance donc UN PROCESSUS PAR VALEUR testee, et passe
# la valeur par l'environnement plutot qu'en reecrivant ce fichier. Deux points
# de sweep mesures avec des fichiers differents ne se compareraient pas.
#
#   JOURJ_OVERRIDE="CHARGES_BASE=24,VISITEURS_BASE=4.0" python3 banc.py
import os as _os


def _appliquer_surcharges():
    brut = _os.environ.get("JOURJ_OVERRIDE", "").strip()
    if not brut:
        return []
    faites = []
    for morceau in brut.split(","):
        if "=" not in morceau:
            continue
        nom, val = morceau.split("=", 1)
        nom, val = nom.strip(), val.strip()
        if nom not in globals():
            raise SystemExit(f"surcharge inconnue : {nom}")
        courant = globals()[nom]
        if isinstance(courant, bool):
            nouveau = val.lower() in ("1", "true", "vrai")
        elif isinstance(courant, int) and "." not in val:
            nouveau = int(val)
        elif isinstance(courant, (int, float)):
            nouveau = float(val)
        else:
            raise SystemExit(f"{nom} n'est pas une constante numerique")
        globals()[nom] = nouveau
        faites.append((nom, courant, nouveau))
    return faites


SURCHARGES = _appliquer_surcharges()
