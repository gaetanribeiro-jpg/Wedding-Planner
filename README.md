# L'Atelier du Jour J

Jeu de gestion pixel rétro dans l'esprit **Kairosoft**, sur le métier de
wedding planner. On tient une boutique, on signe des couples, on monte leur
mariage, et une fois l'an on se mesure aux concurrents au Salon du Mariage.

*Titre provisoire.*

Tout est **dessiné et synthétisé à l'exécution** : pas une image, pas une
police bitmap, pas un fichier son n'est chargé depuis le réseau. Les
personnages, les meubles isométriques, les scènes et les bruitages sortent de
recettes de quelques lignes.

## Lancer

```bash
npm run dev          # serveur sur http://localhost:8080
npm run dev:python   # équivalent sans Node
```

Les modules sont en ESM : **ouvrir `index.html` en `file://` ne marche pas**,
il faut passer par le serveur.

```bash
npm run solo         # → dist/atelier-du-jour-j.html
```

Le build solo replie les vingt modules dans un seul fichier de 220 ko qui,
lui, s'ouvre en `file://`. Aucune dépendance : ni bundler, ni minifieur.

## La boucle

acheter du stock → signer un contrat → composer le mariage → jour J →
notoriété → contrats plus prestigieux → agrandir

Six emplacements par dossier. Trois viennent du **stock** (robe, costume,
décoration), trois des **prestataires** (lieu, traiteur, musique) — et ceux-là
ont un **agenda** : le fleuriste que tu voulais est peut-être déjà pris ce
samedi-là.

La pièce parfaite n'existe pas dans l'absolu : chaque couple a un profil de
goûts, et une robe est notée **pour ce client-là**. Le stock est un pari sur la
variété, pas sur la qualité.

## Mesurer

Deux oracles indépendants. C'est ce qui rend une mesure crédible : un seul
moteur ne mesure que lui-même, et confirme ses propres bugs.

```bash
npm run parite                             # oracle JS, 20 graines
node tools/test-parite.mjs --graines 20 --detail
node tools/test-parite.mjs --json > .parite.json

npm run balance                            # oracle Python, 20 graines
cd tools/balance && python3 banc.py --compare ../../.parite.json
python3 verifier.py                        # config.py est-il le miroir du JS ?
python3 tune.py CHARGES_BASE 20 30 40 55 --cible heures
```

⚠️ **10 graines = un dégrossissage. 20 = une mesure.** Les deux harnais le
rappellent, et refusent de parler de « mesure » en dessous.

⚠️ **Ne règle jamais à vue dans le JS.** L'ordre est :
`tools/balance/config.py` → `tune.py` → `banc.py` → **ensuite** `src/config.js`
→ `npm run parite --graines 20`.

## Où juger le rendu

Sur les planches contact, jamais dans le code :
[`docs/robes.html`](docs/robes.html) ·
[`docs/gens.html`](docs/gens.html) ·
[`docs/mobilier.html`](docs/mobilier.html) ·
[`docs/maquettes.html`](docs/maquettes.html)

Quatorze défauts de pixel art ont déjà été payés dessus, dont quatre trouvés
en une passe sur ces planches. Aucun n'était visible autrement.

## Avant de toucher au code

Lis `CLAUDE.md`. Il contient les décisions verrouillées, l'état mesuré, et
surtout **les pièges déjà payés** — dix hérités du projet Aincrad Village,
quatorze propres au pixel art de ce jeu.
