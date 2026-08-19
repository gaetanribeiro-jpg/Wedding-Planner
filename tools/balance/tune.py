"""
tune.py — balaie UNE constante et classe les valeurs par ecart a la cible.

C'est l'outil de reglage de reference. La methode complete est dans CLAUDE.md :
    1. modifier config.py
    2. mesurer ICI (N parties par valeur, classees par ecart a la cible)
    3. verifier la courbe avec banc.py
    4. SEULEMENT ENSUITE repercuter dans src/config.js
    5. controler avec `npm run parite --graines 20`

⚠️ Piege herite n°8 : LE HARNAIS RELANCE UN PROCESSUS PAR VALEUR TESTEE, et
passe la valeur par l'environnement (JOURJ_OVERRIDE) plutot qu'en reecrivant
config.py. Deux points de sweep mesures avec des fichiers differents ne se
comparent pas — et editer les sources pendant un balayage est exactement la
facon de produire une courbe qui ne veut rien dire.

⚠️ Piege herite n°7 : sous 20 graines, ce n'est pas une mesure. Le degrossissage
a 8 graines sert a trouver la fourchette, jamais a arreter une valeur.

Exemples :
    python3 tune.py CHARGES_BASE 20 30 40 55 --graines 8 --cible heures
    python3 tune.py EXIGENCE_BASE 38 44 50 56 --graines 20 --cible taux_rate
    python3 tune.py GAIN_FREQUENTATION 0.6 0.8 1.0 1.4 --cible heures
"""

import argparse
import json
import os
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))

# Chaque cible : (cle du resultat agrege, valeur visee, ou fourchette)
CIBLES = {
    "heures":     ("heures", "CIBLE_HEURES"),
    "contrats":   ("contrats", "CIBLE_CONTRATS"),
    "refus":      ("refuses", "CIBLE_REFUS"),
    "taux_rate":  ("taux_rate", "CIBLE_TAUX_RATE"),
    "jours":      ("jours", None),
}

VERT, JAUNE, GRAS, FIN = "\033[32m", "\033[33m", "\033[1m", "\033[0m"


def mesurer(nom, valeur, graines, jourmax):
    """Un processus neuf par valeur : aucun etat ne fuit d'un point a l'autre."""
    env = dict(os.environ, JOURJ_OVERRIDE=f"{nom}={valeur}")
    out = subprocess.run(
        [sys.executable, os.path.join(ICI, "banc.py"),
         "--graines", str(graines), "--jourmax", str(jourmax), "--json"],
        capture_output=True, text=True, env=env, cwd=ICI)
    if out.returncode != 0:
        print(out.stderr, file=sys.stderr)
        raise SystemExit(f"la mesure a echoue pour {nom}={valeur}")
    return json.loads(out.stdout)


def distance(valeur, cible):
    """Ecart relatif a la cible. Une fourchette vaut zero a l'interieur."""
    if cible is None:
        return 0.0
    if isinstance(cible, (tuple, list)):
        lo, hi = cible
        if valeur < lo:
            return (lo - valeur) / max(abs(lo), 1e-9)
        if valeur > hi:
            return (valeur - hi) / max(abs(hi), 1e-9)
        return 0.0
    return abs(valeur - cible) / max(abs(cible), 1e-9)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("constante")
    ap.add_argument("valeurs", nargs="+")
    ap.add_argument("--graines", type=int, default=8)
    ap.add_argument("--jourmax", type=int, default=12000)
    ap.add_argument("--cible", default="heures", choices=list(CIBLES))
    a = ap.parse_args()

    sys.path.insert(0, ICI)
    import config as K

    if not hasattr(K, a.constante):
        raise SystemExit(f"{a.constante} n'existe pas dans config.py")

    cle, nom_cible = CIBLES[a.cible]
    cible = getattr(K, nom_cible) if nom_cible else None

    print(f"\n{GRAS}Balayage de {a.constante}{FIN} — {a.graines} graines par valeur, "
          f"cible « {a.cible} » = {cible}")
    print(f"  valeur de depart : {getattr(K, a.constante)}")
    if a.graines < 20:
        print(f"  {JAUNE}⚠️  {a.graines} graines : degrossissage. Confirme la "
              f"valeur retenue a 20 avant de la repercuter dans le JS.{FIN}")

    lignes = []
    for v in a.valeurs:
        R = mesurer(a.constante, v, a.graines, a.jourmax)
        d = distance(R[cle], cible)
        lignes.append((v, R, d))
        print(f"    {a.constante}={v:<10} {a.cible}={R[cle]:<10.2f} "
              f"jours={R['jours']:<8.0f} contrats={R['contrats']:<7.0f} "
              f"rate={R['taux_rate']*100:.1f}%  ecart={d*100:.1f} %")

    lignes.sort(key=lambda x: x[2])
    print(f"\n{GRAS}  CLASSEMENT PAR ECART A LA CIBLE{FIN}")
    for i, (v, R, d) in enumerate(lignes, 1):
        marque = f"{VERT}  ←{FIN}" if i == 1 else ""
        print(f"    {i}. {a.constante}={v:<10} ecart {d*100:>6.1f} %{marque}")

    meilleure = lignes[0]
    print(f"\n  Meilleure valeur mesuree : {GRAS}{a.constante}="
          f"{meilleure[0]}{FIN}")
    print(f"  ⚠️  Ne la recopie dans src/config.js qu'apres l'avoir confirmee "
          f"a 20 graines.\n")


if __name__ == "__main__":
    main()
