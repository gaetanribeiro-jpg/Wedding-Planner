"""
banc.py — le banc d'essai : N parties, medianes, et confrontation a l'oracle JS.

⚠️ Piege herite n°7 : NE CONCLUS JAMAIS SUR UNE GRAINE, NI MEME SUR DIX.
Sur le projet precedent, une mediane sur 10 graines a annonce 13 378 jours la
ou 20 graines en donnaient 11 514. Les deux mesures etaient justes ; l'une
etait sous-echantillonnee. Le banc refuse donc de parler de « mesure » sous
20 graines.

⚠️ Piege herite n°8 : ne balaie jamais une constante pendant que tu edites les
sources. Le banc prend une empreinte de config.py au demarrage et la revalide
a la fin.

Lancer :
    python3 banc.py                  # 20 graines
    python3 banc.py --graines 30
    python3 banc.py --json           # pour comparaison automatique
    python3 banc.py --compare ../../.parite.json
"""

import argparse
import hashlib
import json
import os
import statistics
import sys
import time
from concurrent.futures import ProcessPoolExecutor

import config as K
from sim import jouer_partie

ICI = os.path.dirname(os.path.abspath(__file__))

# Les metriques comparees entre les deux oracles, et leur cle cote JS.
APPARIEMENT = [
    ("jours",        "jours"),
    ("contrats",     "contrats"),
    ("refuses",      "refuses"),
    ("taux_rate",    "tauxRate"),
    ("note_moyenne", "noteMoyenne"),
    ("palier",       "palier"),
    ("visiteurs",    "visiteurs"),
    ("refoules",     "refoules"),
]


def empreinte_config():
    with open(os.path.join(ICI, "config.py"), "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def med(vals):
    return statistics.median(vals) if vals else 0


def lancer(graines, jour_max):
    with ProcessPoolExecutor() as ex:
        return list(ex.map(jouer_partie, graines, [jour_max] * len(graines)))


def agreger(parties):
    finies = [p for p in parties if p["complete"]]
    col = lambda k: [p[k] for p in parties]
    return {
        "graines": len(parties),
        "completion": len(finies) / len(parties),
        "jours": med([p["fini_le"] for p in finies] if finies else col("jour")),
        "heures": med(col("heures")),
        "contrats": med(col("contrats")),
        "refuses": med(col("refuses")),
        "rates": med(col("rates")),
        "taux_rate": med(col("taux_rate")),
        "note_moyenne": med(col("note_moyenne")),
        "palier": med(col("palier")),
        "argent": med(col("argent")),
        "stock": med(col("stock")),
        "meubles": med(col("meubles")),
        "visiteurs": med(col("visiteurs")),
        "refoules": med(col("refoules")),
        "recette": med(col("recette")),
        "honoraires": med(col("honoraires")),
        "salons": med(col("salons")),
        "salons_gagnes": med(col("salons_gagnes")),
    }


VERT, JAUNE, ROUGE, GRAS, FIN = (
    "\033[32m", "\033[33m", "\033[31m", "\033[1m", "\033[0m")


def dans_cible(v, lo, hi):
    return f"{VERT}dans la cible{FIN}" if lo <= v <= hi \
        else f"{JAUNE}hors cible ({lo}–{hi}){FIN}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--graines", type=int, default=20)
    ap.add_argument("--jourmax", type=int, default=12000)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--compare", type=str, default=None,
                    help="fichier JSON produit par `node tools/test-parite.mjs --json`")
    a = ap.parse_args()

    emp = empreinte_config()
    t0 = time.time()
    parties = lancer(list(range(1, a.graines + 1)), a.jourmax)
    dt = time.time() - t0
    if empreinte_config() != emp:
        print("⚠️  config.py a change pendant la mesure : resultat sans valeur.",
              file=sys.stderr)
        sys.exit(2)

    R = agreger(parties)
    if a.json:
        print(json.dumps(R, indent=2))
        return

    print(f"\n{GRAS}L'ATELIER DU JOUR J — oracle Python{FIN}")
    print(f"  {a.graines} graines · {dt:.1f} s · config {emp}")
    if a.graines < 20:
        print(f"  {JAUNE}⚠️  {a.graines} graines : degrossissage, pas mesure. "
              f"Il en faut 20.{FIN}")

    print(f"\n{GRAS}  DUREE DE VIE{FIN}")
    print(f"    Parties terminees        {R['completion']*100:>10.0f} %")
    print(f"    Jours (mediane)          {R['jours']:>12.0f}")
    print(f"    Heures d'horloge a 1x    {R['heures']:>12.2f}   "
          + dans_cible(R["heures"], K.CIBLE_HEURES * .8, K.CIBLE_HEURES * 1.2))
    print(f"    Palier atteint           {R['palier']:>12.0f}   sur {len(K.PALIERS)}")

    print(f"\n{GRAS}  LA BOUCLE{FIN}")
    print(f"    Contrats signes          {R['contrats']:>12.0f}   "
          + dans_cible(R["contrats"], *K.CIBLE_CONTRATS))
    print(f"    Contrats refuses         {R['refuses']:>12.0f}   "
          + dans_cible(R["refuses"], *K.CIBLE_REFUS))
    print(f"    Taux de rate             {R['taux_rate']*100:>11.1f} %   "
          + dans_cible(R["taux_rate"], K.CIBLE_TAUX_RATE * .6, K.CIBLE_TAUX_RATE * 1.4))
    print(f"    Note moyenne             {R['note_moyenne']:>12.1f}")
    print(f"    Salons joues / gagnes    {R['salons']:>8.0f} / {R['salons_gagnes']:.0f}")
    if R["salons"] and not R["salons_gagnes"]:
        print(f"    {ROUGE}⚠️  Le joueur ne gagne JAMAIS le salon : "
              f"le boss est du contenu inatteignable (piege n°6).{FIN}")

    print(f"\n{GRAS}  LA BOUTIQUE{FIN}")
    print(f"    Visiteurs                {R['visiteurs']:>12.0f}")
    part = R["refoules"] / R["visiteurs"] * 100 if R["visiteurs"] else 0
    print(f"    Refoules                 {R['refoules']:>12.0f}   {part:.0f} % — "
          f"le plafond des places")
    print(f"    Recette boutique         {R['recette']:>12.0f}")
    print(f"    Honoraires               {R['honoraires']:>12.0f}   "
          + (f"{R['honoraires']/R['recette']:.1f}× la boutique" if R["recette"] else ""))

    if a.compare:
        comparer(R, a.compare)
    print()


def comparer(R, chemin):
    """
    ⚠️ C'est ICI que la mesure devient credible : deux implementations
    INDEPENDANTES qui tombent a moins de 5 % l'une de l'autre. Un seul moteur
    ne mesure que lui-meme, et confirme ses propres bugs.
    """
    try:
        with open(chemin) as f:
            js = json.load(f)
    except OSError as e:
        print(f"\n  {JAUNE}Comparaison impossible : {e}{FIN}")
        return

    print(f"\n{GRAS}  PARITE AVEC L'ORACLE JS{FIN}")
    print(f"    {'metrique':<16}{'python':>12}{'js':>12}{'ecart':>10}")
    pire = 0.0
    for cle_py, cle_js in APPARIEMENT:
        a, b = R.get(cle_py, 0), js.get(cle_js, 0)
        if not a and not b:
            continue
        base = max(abs(a), abs(b)) or 1
        e = abs(a - b) / base
        pire = max(pire, e)
        coul = VERT if e <= .05 else (JAUNE if e <= .15 else ROUGE)
        print(f"    {cle_py:<16}{a:>12.2f}{b:>12.2f}{coul}{e*100:>9.1f} %{FIN}")
    if pire <= .05:
        print(f"    {VERT}Les deux oracles tombent a moins de 5 % : "
              f"la mesure est credible.{FIN}")
    else:
        print(f"    {JAUNE}Ecart maximal {pire*100:.1f} % — au-dela de 5 %, "
              f"une des deux implementations a un defaut.{FIN}")


if __name__ == "__main__":
    main()
