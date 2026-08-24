"""
verifier.py — config.py est-il encore le miroir de src/config.js ?

⚠️ C'est le garde-fou de toute la methode d'equilibrage. On regle dans
config.py, on mesure, puis on repercute dans src/config.js. Si les deux
derivent, on regle un jeu et on en livre un autre — et la mesure devient un
mensonge sans que rien ne le signale.

Ce script demande au JS de se decrire lui-meme (aucun parsing de source, qui
casserait au premier reformatage), puis compare valeur par valeur.

Lancer : python3 verifier.py
Sortie : code 0 si tout concorde, 1 sinon.
"""

import json
import os
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, "..", ".."))

sys.path.insert(0, ICI)
import config as K

VERT, ROUGE, JAUNE, GRAS, FIN = (
    "\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[0m")

# nom Python -> chemin dans le config JS.
APPARIEMENT = {
    "MS_PAR_JOUR":            "CFG.MS_PAR_JOUR",
    "JOURS_PAR_SAISON":       "CFG.JOURS_PAR_SAISON",
    "SALON_TOUS_LES_JOURS":   "CFG.SALON_TOUS_LES_JOURS",
    "SALON_JOUR_DANS_ANNEE":  "CFG.SALON_JOUR_DANS_ANNEE",
    "ARGENT_DEPART":          "CFG.ARGENT_DEPART",
    "NOTORIETE_DEPART":       "CFG.NOTORIETE_DEPART",
    "PRIX_EXPOSANT":          "STOCK.PRIX_EXPOSANT",
    "QUALITE_BASE":           "STOCK.QUALITE_BASE",
    "QUALITE_PAR_TIER":       "STOCK.QUALITE_PAR_TIER",
    "TAUX_REVENTE":           "STOCK.TAUX_REVENTE",
    "CATALOGUE_TAILLE":       "STOCK.CATALOGUE_TAILLE",
    "CATALOGUE_PAR_PALIER":   "STOCK.CATALOGUE_PAR_PALIER",
    "CATALOGUE_JOURS":        "STOCK.CATALOGUE_JOURS",
    "USURE_PAR_USAGE":        "STOCK.USURE_PAR_USAGE",
    "USURE_PLANCHER":         "STOCK.USURE_PLANCHER",
    "PRESSION_BASE":          "AGENDA.PRESSION_BASE",
    "PRESSION_PAR_PALIER":    "AGENDA.PRESSION_PAR_PALIER",
    "FIDELITE_MAX":           "AGENDA.FIDELITE_MAX",
    "FIDELITE_REMISE":        "AGENDA.FIDELITE_REMISE",
    "FIDELITE_PRIORITE":      "AGENDA.FIDELITE_PRIORITE",
    "PRESTA_AMBITION_EXPOSANT": "AGENDA.AMBITION_EXPOSANT",
    "PROSPECTS_PAR_JOUR":     "CLIENTS.PROSPECTS_PAR_JOUR",
    "PROSPECT_PAR_NOTORIETE": "CLIENTS.PROSPECT_PAR_NOTORIETE",
    "PATIENCE_JOURS":         "CLIENTS.PATIENCE_JOURS",
    "DELAI_MIN":              "CLIENTS.DELAI_MIN",
    "DELAI_MAX":              "CLIENTS.DELAI_MAX",
    "BUDGET_PAR_INVITE":      "CLIENTS.BUDGET_PAR_INVITE",
    "BUDGET_PLANCHER":        "CLIENTS.BUDGET_PLANCHER",
    "EXIGENCE_BASE":          "CLIENTS.EXIGENCE_BASE",
    "EXIGENCE_PAR_PALIER":    "CLIENTS.EXIGENCE_PAR_PALIER",
    "CAPACITE_BASE":          "CLIENTS.CAPACITE_BASE",
    "CAPACITE_PAR_PALIER":    "CLIENTS.CAPACITE_PAR_PALIER",
    "COUT_NOTORIETE":         "REFUS.COUT_NOTORIETE",
    "COUT_ESCALADE":          "REFUS.COUT_ESCALADE",
    "CARNET_MARGE":           "REFUS.CARNET_MARGE",
    "OUBLI_JOURS":            "REFUS.OUBLI_JOURS",
    "PENALITE_SLOT_VIDE":     "MARIAGE.PENALITE_SLOT_VIDE",
    "PART_GOUTS":             "MARIAGE.PART_GOUTS",
    "MALUS_RATE_NOTORIETE":   "MARIAGE.MALUS_RATE_NOTORIETE",
    "MALUS_RATE_HONORAIRES":  "MARIAGE.MALUS_RATE_HONORAIRES",
    "TAUX_HONORAIRES":        "MARIAGE.TAUX_HONORAIRES",
    "BONUS_NOTE":             "MARIAGE.BONUS_NOTE",
    "NOTORIETE_BASE":         "MARIAGE.NOTORIETE_BASE",
    "NOTORIETE_PAR_NOTE":     "MARIAGE.NOTORIETE_PAR_NOTE",
    "NOTORIETE_PAR_INVITE":   "MARIAGE.NOTORIETE_PAR_INVITE",
    "BOUCHE_A_OREILLE":       "MARIAGE.BOUCHE_A_OREILLE",
    "BUDGET_TOLERANCE":       "MARIAGE.BUDGET_TOLERANCE",
    "BUDGET_PENALITE":        "MARIAGE.BUDGET_PENALITE",
    "RIVAL_GAIN_BASE":        "RIVALITE.GAIN_BASE",
    "RIVAL_GAIN_SUIVI":       "RIVALITE.GAIN_SUIVI",
    "RIVAL_GAIN_REPRISE":     "RIVALITE.GAIN_PAR_REPRISE",
    "SALON_POIDS_THEME":      "SALON.POIDS_THEME",
    "SALON_PIECES_STAND":     "SALON.PIECES_STAND",
    "SALON_COUT_STAND":       "SALON.COUT_STAND",
    "SALON_MALUS_ABSENCE":    "SALON.MALUS_ABSENCE",
    "SALON_RIVAL_BASE":       "SALON.RIVAL_BASE",
    "SALON_RIVAL_PAR_PALIER": "SALON.RIVAL_PAR_PALIER",
    "SALON_RIVAL_PAR_NOTORIETE": "SALON.RIVAL_PAR_NOTORIETE",
    "BOUTIQUE_L":             "BOUTIQUE.LARGEUR",
    "BOUTIQUE_H":             "BOUTIQUE.HAUTEUR",
    "GAIN_FREQUENTATION":     "ECONOMIE.GAIN_FREQUENTATION",
    "VISITEURS_BASE":         "ECONOMIE.VISITEURS_BASE",
    "VISITEURS_PAR_NOTORIETE": "ECONOMIE.VISITEURS_PAR_NOTORIETE",
    "VISITEURS_PAR_ATTRAIT":  "ECONOMIE.VISITEURS_PAR_ATTRAIT",
    "CHARGES_BASE":           "ECONOMIE.CHARGES_BASE",
    "CHARGES_PAR_MEUBLE":     "ECONOMIE.CHARGES_PAR_MEUBLE",
    # --- la vente : l'argent est adosse a une marchandise -----------------
    "MARGE_VENTE":            "VENTE.MARGE",
    "VENTE_CHANCE_BASE":      "VENTE.CHANCE_BASE",
    "VENTE_CHANCE_PAR_ATTRAIT": "VENTE.CHANCE_PAR_ATTRAIT",
    "VENTE_MALUS_PAR_TIER":   "VENTE.MALUS_PAR_TIER",
    "VENTE_DECOTE_USAGE":     "VENTE.DECOTE_USAGE",
    "COMMISSION_PRESTA":      "VENTE.COMMISSION_PRESTA",
    # --- les imprevus : ce qui donne ses dents au jeu ---------------------
    "IMPREVU_CHANCE_PAR_JOUR": "IMPREVUS.CHANCE_PAR_JOUR",
    "IMPREVU_MAX_PAR_DOSSIER": "IMPREVUS.MAX_PAR_DOSSIER",
    "IMPREVU_MARGE_JOURS":    "IMPREVUS.MARGE_JOURS",
    "EXIGENCE_FLOU_PART":     "EXIGENCE_FLOU.PART",
    "EXIGENCE_FLOU_MIN":      "EXIGENCE_FLOU.MIN",
    # --- l'equipe --------------------------------------------------------
    "EQUIPE_NIVEAU_MAX":      "EQUIPE.NIVEAU_MAX",
    "COUT_RECRUE_BASE":       "EQUIPE.COUT_RECRUE_BASE",
    "COUT_RECRUE_PAR_MEMBRE": "EQUIPE.COUT_RECRUE_PAR_MEMBRE",
    "SALAIRE_BASE":           "EQUIPE.SALAIRE_BASE",
    "SALAIRE_PAR_NIVEAU":     "EQUIPE.SALAIRE_PAR_NIVEAU",
    "COUT_FORMATION_BASE":    "EQUIPE.COUT_FORMATION_BASE",
    "COUT_FORMATION_PAR_NIVEAU": "EQUIPE.COUT_FORMATION_PAR_NIVEAU",
    "JOURS_FORMATION_BASE":   "EQUIPE.JOURS_FORMATION_BASE",
    "JOURS_FORMATION_PAR_NIVEAU": "EQUIPE.JOURS_FORMATION_PAR_NIVEAU",
    "PLACES_BASE":            "EQUIPE.PLACES_BASE",
    "PLACES_PAR_PALIER":      "EQUIPE.PLACES_PAR_PALIER",
}

# Les deux tables ajoutees en meme temps que les systemes qu'elles reglent.
# ⚠️ Une TABLE se verifie ligne par ligne : c'est exactement la ou l'oubli
# passe inapercu. `occupeLeSol` sur les meubles avait deja coute 20 % d'ecart
# entre les deux oracles pour un seul booleen non repercute.
ROLES_CHAMPS = {
    "vendeur":      (("PLACES", 0), ("CHANCE_VENTE", 1)),
    "styliste":     (("ELEGANCE", 2), ("COHERENCE", 3)),
    "coordinateur": (("CAPACITE", 4), ("PARE_IMPREVU", 5)),
    "attache":      (("PROSPECTS", 6), ("NOTORIETE", 7)),
}

# nom python -> (cle JS, champ JS) pour chaque entree de la table d'imprevus.
IMPREVU_CHAMPS = {
    "defection":      (("poids", "poids"),),
    "invitesEnPlus":  (("poids", "poids"), ("part", ("PART_MIN", "PART_MAX"))),
    "exigenceMontee": (("poids", "poids"), ("val", ("MIN", "MAX"))),
    "budgetCoupe":    (("poids", "poids"), ("part", ("PART_MIN", "PART_MAX"))),
    "pieceAbimee":    (("poids", "poids"), ("usures", "USURES")),
}

DUMP = """
import * as C from "../../src/config.js";
const out = {};
for(const [k, v] of Object.entries(C))
  if(v && typeof v === "object") out[k] = v;
console.log(JSON.stringify(out));
"""


def config_js():
    chemin = os.path.join(ICI, ".dump-config.mjs")
    with open(chemin, "w") as f:
        f.write(DUMP)
    try:
        out = subprocess.run(["node", chemin], capture_output=True, text=True,
                             cwd=ICI)
        if out.returncode != 0:
            raise SystemExit("impossible de lire src/config.js :\n" + out.stderr)
        return json.loads(out.stdout)
    finally:
        os.remove(chemin)


def creuser(obj, chemin):
    for part in chemin.split("."):
        if not isinstance(obj, dict) or part not in obj:
            return None
        obj = obj[part]
    return obj


def main():
    js = config_js()
    ecarts, manquants = [], []

    for nom_py, chemin in APPARIEMENT.items():
        v_py = getattr(K, nom_py, None)
        v_js = creuser(js, chemin)
        if v_js is None:
            manquants.append((nom_py, chemin))
            continue
        if abs(float(v_py) - float(v_js)) > 1e-9:
            ecarts.append((nom_py, v_py, chemin, v_js))

    # Les paliers sont la colonne vertebrale de la duree de vie : on les
    # compare un a un plutot qu'en bloc.
    for i, p in enumerate(K.PALIERS):
        j = js.get("PALIERS", [])[i] if i < len(js.get("PALIERS", [])) else None
        if not j:
            manquants.append((f"PALIERS[{i}]", "PALIERS"))
            continue
        for cle in ("seuil", "budgetMult", "invitesMax"):
            if abs(float(p[cle]) - float(j[cle])) > 1e-9:
                ecarts.append((f"PALIERS[{i}].{cle}", p[cle],
                               f"PALIERS[{i}].{cle}", j[cle]))

    for cle_py, cle_js in (("MEUBLES", "MEUBLES"),):
        for nom, tup in getattr(K, cle_py).items():
            m = js.get(cle_js, {}).get(nom)
            if not m:
                manquants.append((f"{cle_py}.{nom}", cle_js))
                continue
            for i, champ in enumerate(("prix", "gain", "places", "attrait", "palier")):
                if abs(float(tup[i]) - float(m[champ])) > 1e-9:
                    ecarts.append((f"{cle_py}.{nom}.{champ}", tup[i],
                                   f"{cle_js}.{nom}.{champ}", m[champ]))
            # ⚠️ `occupeLeSol` decide si le meuble compte comme voisin pour un
            # combo. C'est un booleen, donc facile a oublier — et il a deja
            # coute 20 % d'ecart entre les deux oracles.
            sol_py = bool(tup[6]) if len(tup) > 6 else True
            sol_js = not (m.get("sol") or m.get("mural"))
            if sol_py != sol_js:
                ecarts.append((f"{cle_py}.{nom}.occupeLeSol", sol_py,
                               f"{cle_js}.{nom}.sol/mural", sol_js))

    # ⚠️ La table des roles : quatre lignes de huit colonnes cote Python,
    # quatre objets a deux champs cote JS. C'est la forme la plus facile a
    # laisser deriver, et un role mal repercute ne se voit dans aucune mesure —
    # il change juste silencieusement l'equilibre.
    for role, champs in ROLES_CHAMPS.items():
        tup = K.ROLES.get(role)
        d = js.get("ROLES", {}).get(role)
        if tup is None or d is None:
            manquants.append((f"ROLES.{role}", "ROLES"))
            continue
        for nom_js, i in champs:
            if nom_js not in d:
                manquants.append((f"ROLES.{role}.{nom_js}", "ROLES"))
                continue
            if abs(float(tup[i]) - float(d[nom_js])) > 1e-9:
                ecarts.append((f"ROLES.{role}[{i}]", tup[i],
                               f"ROLES.{role}.{nom_js}", d[nom_js]))

    for cle, champs in IMPREVU_CHAMPS.items():
        py = K.IMPREVUS.get(cle)
        d = js.get("IMPREVU", {}).get(cle)
        if py is None or d is None:
            manquants.append((f"IMPREVUS.{cle}", "IMPREVU"))
            continue
        for nom_py, nom_js in champs:
            if isinstance(nom_js, tuple):
                paire = tuple(d.get(x) for x in nom_js)
                if None in paire:
                    manquants.append((f"IMPREVUS.{cle}.{nom_py}", "IMPREVU"))
                    continue
                if tuple(float(x) for x in py[nom_py]) != tuple(float(x) for x in paire):
                    ecarts.append((f"IMPREVUS.{cle}.{nom_py}", py[nom_py],
                                   f"IMPREVU.{cle}", paire))
            else:
                if nom_js not in d:
                    manquants.append((f"IMPREVUS.{cle}.{nom_py}", "IMPREVU"))
                    continue
                if abs(float(py[nom_py]) - float(d[nom_js])) > 1e-9:
                    ecarts.append((f"IMPREVUS.{cle}.{nom_py}", py[nom_py],
                                   f"IMPREVU.{cle}.{nom_js}", d[nom_js]))

    print(f"\n{GRAS}Miroir config.py ↔ src/config.js{FIN}")
    if manquants:
        print(f"\n  {JAUNE}Non trouves cote JS :{FIN}")
        for a, b in manquants:
            print(f"    {a}  (cherche a {b})")
    if ecarts:
        print(f"\n  {ROUGE}{len(ecarts)} valeur(s) divergente(s) :{FIN}")
        print(f"    {'python':<32}{'py':>12}{'js':>12}")
        for nom, vpy, chemin, vjs in ecarts:
            print(f"    {nom:<32}{vpy:>12}{vjs:>12}")
        print(f"\n  {ROUGE}⚠️  On regle un jeu et on en livre un autre. "
              f"Repercute avant de mesurer quoi que ce soit.{FIN}\n")
        sys.exit(1)
    if manquants:
        sys.exit(1)
    n = (len(APPARIEMENT) + len(K.PALIERS) * 3 + len(K.MEUBLES) * 6
         + sum(len(v) for v in ROLES_CHAMPS.values())
         + sum(len(v) for v in IMPREVU_CHAMPS.values()))
    print(f"  {VERT}{n} valeurs concordent. Les deux configs sont le "
          f"miroir l'une de l'autre.{FIN}\n")


if __name__ == "__main__":
    main()
