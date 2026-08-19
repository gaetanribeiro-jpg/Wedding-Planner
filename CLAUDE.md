# L'Atelier du Jour J — briefing projet

> Ce fichier est lu automatiquement par Claude Code au démarrage de chaque
> session. **Il est la mémoire du projet** : rien d'autre ne survit d'une
> session à l'autre. Tiens-le à jour, et surtout écris-y les erreurs commises
> — c'est la partie qui coûte cher.
>
> *Titre provisoire.* À arrêter avant le premier écran titre.

## Le jeu

Jeu de gestion pixel rétro dans l'esprit **Kairosoft**, sur le métier de
**wedding planner**. On démarre avec une petite boutique, on la remplit, on
signe des couples, on monte leur mariage, et une fois l'an on se mesure aux
concurrents au **Salon du Mariage**.

**Boucle centrale :** acheter du stock → signer un contrat → composer le
mariage → jour J → notoriété → contrats plus prestigieux → agrandir.

**Cible : ~25 h de durée de vie**, portée par l'horloge (`MS_PAR_JOUR`) et par
le nombre de contrats, pas par le nombre de mariages animés.

## Décisions de design verrouillées

Prises avec l'utilisateur. Ne pas les rouvrir sans lui demander.

1. **Le contrat est l'unité de jeu, pas le salon.** Un mariage se prépare en
   quelques jours et se résout au jour J. C'est l'équivalent de l'expédition
   d'étage d'Aincrad. ⚠️ La première version du concept faisait du salon annuel
   le moteur : à 9 s/jour, une année de jeu fait ~54 minutes, donc **rien** ne
   force une décision entre deux salons. C'est le défaut qu'on a corrigé sur le
   tournoi d'Aincrad (passé de tous les 20 étages à tous les 10).
2. **Le salon annuel est le boss.** Thème tiré, ton stand contre ceux des
   concurrents, tout ce qu'on a accumulé passe un examen d'un coup. C'est le
   seul moment où la boucle s'arrête et attend une décision — **le seul écran
   modal du jeu**, comme le briefing de raid d'Aincrad.
3. **La saison donne le rythme.** Les mariages se groupent en été. Basse
   saison : on achète du stock, on agrandit, on forme. Haute saison : les
   contrats affluent et c'est la **capacité** qui devient la contrainte.
4. **La meilleure robe n'existe pas dans l'absolu.** Chaque couple a un profil
   de goûts, donc une pièce est notée *pour ce client-là*. C'est
   `scorePourHeros()` d'Aincrad transposé, et c'est le cœur du jeu : le stock
   devient un pari sur la **variété**, pas sur la qualité.
5. **On peut refuser un contrat.** Aincrad ne l'a jamais eu. Refuser coûte de
   la notoriété mais évite un mariage raté.
6. **Les prestataires sont des relations avec un AGENDA**, pas une septième
   catégorie de boutique. Le fleuriste que tu voulais est déjà pris ce
   samedi-là — par toi ou par un concurrent. C'est la mécanique des guildes
   rivales réemployée, et c'est une source de pression gratuite.
7. **Il faut des dents.** Un mariage raté doit coûter : notoriété perdue,
   client qui part chez le concurrent, contrat annulé. Sans échec réel, le jeu
   devient un clicker confortable. C'est le point de design le plus important
   après la boucle.
8. **La boutique est l'écran d'accueil et ne se fait jamais voler.** Le jour J
   s'annonce par un bandeau ; on bascule si on veut regarder.

## L'échelle de progression

Elle remplace les 100 étages d'Aincrad. Sans échelle explicite, pas de durée de
vie mesurable.

| Palier | Notoriété | Ce qui s'ouvre |
|---|---|---|
| 1 | Quartier | robes simples, 1 prestataire par type |
| 2 | Ville | costumes sur mesure, lieux privés |
| 3 | Région | pièces d'exception, grands domaines |
| 4 | Capitale | créateurs, orchestres |
| 5 | Royal | le mariage princier, fin de partie |

Compter **40 à 60 contrats** sur la partie, de plus en plus exigeants.

## Architecture prévue

**Règle de dépendance** (celle d'Aincrad, qui a tenu) : `ui` et `render`
dépendent de `state`, jamais l'inverse. `state` ne connaît ni le DOM ni le
canvas. Le jour J est **entièrement résolu avant d'être animé** : l'animation
ne peut pas diverger de l'issue.

| Fichier | Responsabilité | Origine |
|---|---|---|
| `src/config.js` | **Tout** l'équilibrage et les tables. Aucune logique. | neuf |
| `src/utils.js` | `alea`, `graine`, `fmt`, `tirerPondere`, `hachage`. | **verbatim** |
| `src/pixel.js` | Primitives de pixel art, contour et ombrage dérivés. | **verbatim** |
| `src/iso.js` | Projection 2:1. `versEcran`/`versGrille` sont inverses. | **verbatim** |
| `src/sons.js` | Bruitages WebAudio synthétisés, aucun fichier. | **verbatim** |
| `src/state.js` | État `G` + boucle (1 tick = 1 jour). | ← `state.js` |
| `src/boutique.js` | Grille, meubles, **économie par fréquentation**, combos. | ← `town.js` |
| `src/stock.js` | Articles : slot × famille × style × tier × rareté × affixes. | ← `items.js` |
| `src/clients.js` | Couples, profils de goûts, budgets, contrats. | ← `heroes.js` |
| `src/mariage.js` | Résolution d'un jour J, score en trois axes, trace. | ← `combat.js` |
| `src/prestataires.js` | DJ, fleuristes, traiteurs : qualité, prix, **agenda**. | neuf |
| `src/concurrents.js` | Planners rivaux, course à la notoriété. | ← `guilds.js` |
| `src/salon.js` | Le rendez-vous annuel, thème tiré, classement. | neuf |
| `src/gens.js` | Personnages pixel : mariés, invités, prestataires. | ← `villageois.js` |
| `src/mobilier.js` | Meubles isométriques par recette. | ← `batisseur.js` |
| `src/render.js` | Canvas : boutique iso + scène du jour J (vue de côté). | ← `render.js` |
| `src/ui.js` | DOM. Aucune logique de jeu. | ← `ui.js` |
| `src/save.js` | Persistance **+ code de partie** (voir piège n°3). | ← `save.js` |
| `src/tuto.js` | Guide : étapes validées sur l'ÉTAT, jamais sur un clic. | ← `tuto.js` |
| `tools/balance/config.py` | L'équilibrage côté oracle. **On règle ici.** | ← idem |
| `tools/balance/sim.py` | Réimplémentation **indépendante** de la simulation. | ← idem |
| `tools/balance/banc.py` | N parties, médianes, parité avec l'oracle JS. | ← idem |
| `tools/balance/tune.py` | Balaye une constante, classe par écart à la cible. | ← idem |
| `tools/balance/verifier.py` | `config.py` est-il encore le miroir du JS ? | neuf |
| `tools/test-parite.mjs` | Oracle JS, N graines, médiane agrégée. | ← idem |
| `tools/joueur.mjs` | La politique de jeu que l'oracle applique. | neuf |
| `tools/build-solo.mjs` | Replie le jeu dans un seul fichier HTML. | ← idem |
| `docs/*.html` | Planches contact. **On juge là, jamais dans le code.** | ← idem |

## ⚠️ Les pièges hérités d'Aincrad

Chacun a coûté au moins une session sur l'autre projet. Ils sont génériques :
ils s'appliquent ici tels quels.

### 1. Le rendu ne consomme JAMAIS `alea()`
Tout tirage de simulation passe par `alea()` de `utils.js`. Un sprite, un
motif, un semis au sol qui tire un nombre **décale toute la partie à graine
égale** et rend l'équilibrage intestable. Le hasard décoratif vient d'un
**hachage** (du nom, des coordonnées), jamais du générateur.

### 2. Un effet agrégé n'est pas un effet appliqué
Sur Aincrad, cinq effets d'économie étaient calculés puis **lus par personne**
— dont un bâtiment à 1 500 or dont l'effet était strictement nul. Avant
d'ajouter un effet, `grep` son nom hors de `config.js` : il doit renvoyer autre
chose que l'agrégation et l'affichage.

### 3. Une sauvegarde qui échoue en silence
`localStorage` **lève** dans un cadre bac à sable. Prévoir dès le départ :
un test d'écriture réel au démarrage, une **relecture** de ce qu'on vient
d'écrire (un quota dépassé tronque sans lever), un bandeau visible tant que le
problème dure, et un **code de partie** copiable qui ne dépend d'aucun
stockage — accessible depuis le jeu **et depuis l'écran titre**.

### 4. Un plafond vérifié sur une seule voie n'est pas un plafond
Symptôme trompeur : **plus aucun réglage n'a d'effet mesurable**. Quand une
constante divisée par sept ne bouge rien, ne cherche pas la bonne valeur —
cherche ce qui court-circuite la contrainte.

### 5. L'oracle doit faire le MÊME GESTE que le joueur
Si le joueur peut libérer une place, acheter un type de meuble ou équiper à la
main, l'IA de test doit le faire aussi. Sinon elle mesure une partie que
personne ne joue. Corollaire : tout déblocage progressif doit être vérifié
**dans la fonction qui agit**, pas seulement dans l'affichage du catalogue.

### 6. Un contenu inatteignable n'est pas du contenu
Sur Aincrad, treize héros uniques sur vingt ne sortaient jamais — 81 % des
gemmes non dépensées, 8 665 invocations refusées. Mesure toujours ce que le
joueur **obtient réellement**, pas ce que la table contient.

### 7. Ne conclus jamais sur une graine, ni même sur dix
Les constantes finissent toutes au bord d'une falaise. Sur Aincrad, à trois
décimales près la partie gagnait **cinq mille jours**. Une médiane sur
10 graines a annoncé 13 378 jours là où 20 graines en donnaient 11 514 : les
deux mesures sont justes, l'une est sous-échantillonnée. **10 graines = un
dégrossissage. 20 = une mesure.**

### 8. Ne balaie jamais une constante pendant que tu édites les sources
Le harnais relance un `node` par valeur testée. Deux points de sweep mesurés
avec des fichiers différents ne se comparent pas.
*Déjà payé une fois ici :* `banc.py` a refusé un run de 20 graines parce que
`config.py` avait bougé pendant la mesure. Le garde-fou marche — il est dans
`banc.py` et dans `test-parite.mjs`, sous forme d'empreinte prise au départ et
revalidée à la fin.

### 9. Une pénalité qui grandit avec le succès est un plafond déguisé
**Trouvé par l'oracle, invisible autrement.** Pour que « ignorer un prospect »
ne soit pas gratuit, chaque couple expiré coûtait 5 de notoriété. Mais le flux
de prospects croît **avec** la notoriété : plus on réussissait, plus on payait.
Résultat mesuré : 512 mariages réussis sur 6 000 jours, et une notoriété finale
de **14**. Chaque mariage était bon ; la partie n'avançait pas.
La bonne forme : borner le **carnet** (`REFUS.CARNET_MARGE`) plutôt que punir
le volume. Refuser achète alors une place immédiate — c'est ce qui donne enfin
un prix ET une contrepartie à la décision n°5.
C'est le piège n°4 sous un autre visage : cherche ce qui court-circuite, pas la
bonne valeur.

### 10. L'estimation de l'IA doit passer par la fonction du jeu
La première version de `estimer()` faisait la moyenne des meilleures pièces par
emplacement. Elle annonçait 30 là où le jour J donnait 50 — parce qu'une note
se lit sur **quatre axes pondérés**, pas sur une moyenne de qualité. L'oracle
ne signait donc aucun contrat et rapportait « 0 contrat en 4 000 jours » : un
chiffre juste, sur une partie que personne ne joue.
`resoudre()` est **pure** (aucun `alea()`) précisément pour qu'on puisse
l'appeler sur un dossier virtuel. Deux estimations de la même chose finissent
toujours par diverger ; il ne doit y en avoir qu'une.

## ⚠️ Les pièges de pixel art, appris sur les maquettes

Ceux-là sont propres à ce jeu, et ils ont déjà été payés une fois.

1. **À 20 px de large, deux pixels d'écart n'existent pas.** Les cinq
   silhouettes de robe sont sorties identiques au premier essai. Il faut
   **exagérer** : la princesse touche les bords de la grille, la sirène est
   franchement moulante *puis* franchement évasée.
2. **L'ombrage dérivé ne mord pas sur du presque-blanc.** Une robe ivoire sans
   couture de taille contrastée est un aplat. Chaque pièce claire a besoin
   d'une couture, de plis, ou d'un ourlet dans un ton distinct.
3. **Le voile se dessine DERRIÈRE le corps.** Posé par-dessus, la mariée perd
   son visage et sort en tache blanche. D'un voile, ce qu'on voit, c'est ce qui
   dépasse de la silhouette.
4. **Une robe courte a besoin de jambes.** Sans elles, elle se lit comme une
   robe longue coupée et le personnage est posé dans un seau.
5. **Un tapis se peint DANS la couche de sol**, pas en sprite trié en
   profondeur : ancré par le bas, il flotte et devient une estrade.
6. **Une banderole se peint tuile par tuile le long d'un mur isométrique.**
   Tracée d'un seul quadrilatère entre deux extrémités, elle part en diagonale
   à travers la salle : deux points éloignés sur une grille iso ne définissent
   pas un mur, ils définissent une corde.
7. **Le mobilier doit être à l'échelle du personnage.** Un stand de 96×84 à
   côté d'un personnage de 28 px de haut se lit comme un lit, pas comme un
   stand.
8. **Dessiner à la résolution NATIVE puis seuiller l'alpha.** Sans ça, les
   diagonales isométriques sortent floues et le résultat fait low-poly plat,
   pas pixel art. C'est l'étape qui change tout.
9. **L'échelle d'affichage est un entier.** À facteur fractionnaire,
   `image-rendering:pixelated` donne des pixels de tailles inégales.
10. **Une recette ne touche jamais le bord de sa grille** : le contour dérivé a
    besoin d'une rangée libre, sinon le personnage paraît coupé.

11. **Un élément d'arrière-plan se peint AVANT, pas par-dessus.** C'est la
    leçon du voile, et elle se généralise : le dossier du canapé était peint
    après l'assise, il la recouvrait, et le meuble sortait en dalle rose. Ce
    qu'on doit voir d'un arrière-plan, c'est ce qui **dépasse**.
12. **Un sprite mémorisé est un nœud DOM unique.** `spriteMeuble` met ses
    canvas en cache ; `appendChild` **déplace** un nœud au lieu de le copier.
    La planche mobilier affichait des étiquettes sans image : la section 2
    avait vidé la section 1. Toute planche qui *insère* un sprite doit le
    cloner. Dans le jeu, `drawImage` ne pose pas le problème.
13. **Le signe doit raconter le bon métier.** Le casque audio disait « DJ »
    sur un quatuor à cordes. Un signe lisible qui désigne autre chose est
    pire qu'un signe absent — c'est le stand à l'échelle d'un lit, en version
    sémantique.
14. **Le cadrage se calcule depuis l'étendue de la grille**, et par la **même
    fonction** que le pointage. Une origine en dur laissait un quart de canvas
    mort et rognait le mur de gauche ; deux formules de caméra qui divergent,
    et l'on vise une case pour bâtir sur une autre.

**On juge sur les planches contact (`docs/*.html`), jamais dans le code.**
Aucun de ces quatorze défauts n'était visible autrement — les quatre derniers
ont été trouvés sur les planches, en une passe.

## Charte graphique

On quitte l'ardoise nuit + cyan de SAO. Registre chaud, mais **mêmes règles de
forme** : zéro arrondi, zéro dégradé, zéro ombre douce, bordures franches de
2 px.

| Jeton | Valeur | Métier — un seul par couleur |
|---|---|---|
| `--nuit` | `#2e2434` | châssis, fonds de panneau |
| `--creme` | `#f7efe4` | texte, papier |
| `--or` | `#d8a94a` | argent, récompenses |
| `--poudre` | `#e69aa6` | état actif, sélection |
| `--prune` | `#8c4f6b` | urgence, contrat perdu |
| `--vert` | `#7fa87a` | prestataires, réussite |

Typo : Silkscreen pour les titres, JetBrains Mono pour le reste. Une seule
exception au « zéro dégradé » : le ciel du jour J et de l'écran titre — un
aplat uni derrière une scène de coucher de soleil supprime la profondeur.

## Méthode d'équilibrage

**Monter l'oracle Python dès le début.** C'est ce qui a permis de tenir la
durée de vie sur Aincrad, et c'est beaucoup plus dur à rajouter après coup.
Deux implémentations indépendantes qui tombent à 5 % l'une de l'autre, c'est ce
qui rend une mesure crédible.

```
1. modifier tools/balance/config.py
2. mesurer avec tune.py (N parties par valeur, classées par écart à la cible)
3. vérifier la courbe avec npm run balance
4. SEULEMENT ENSUITE répercuter dans src/config.js
5. contrôler avec npm run parite --graines 20
```

Ne jamais tuner à vue directement dans le JS.

**Métriques cibles** (à fixer après le premier prototype jouable) :
complétion 100 %, durée ~25 h, taux de mariages ratés ~15 %, contrats refusés
2 à 8 sur la partie.

## Conventions

- **Commentaires et identifiants en français, sans accents** (`peutPlacer`,
  `coutRecrue`). Les accents sont réservés aux chaînes affichées.
- Les commentaires expliquent **pourquoi**, pas quoi. Priorité aux pièges
  d'équilibrage et aux contraintes des assets.
- Toute constante d'équilibrage va dans `config.js`, jamais en dur ailleurs.
- Les courbes sont des **fonctions de la progression**, pas des constantes :
  c'est ce qui garde la boutique utile jusqu'au bout.
- `G` n'est pas sérialisable tel quel : si tu ajoutes un champ, ajoute-le à
  `SIMPLES` ou traite-le à la main, et incrémente `VERSION`. L'état du
  générateur aléatoire et les compteurs d'id se sauvegardent aussi — sans eux,
  recharger casse la reproductibilité à graine fixe.

## État actuel

**La tranche verticale tourne, de bout en bout.** Boutique isométrique → stock
→ carnet de prospects → dossier à six emplacements → jour J résolu puis animé →
notoriété → palier. Le salon annuel est jouable (thème tiré, classement,
prix). Sauvegarde + code de partie compressé. Guide en huit étapes validées
sur l'état.

Vérifié dans un vrai navigateur : écran titre, partie neuve, les sept onglets,
zéro erreur console. `npm run solo` produit un fichier unique de 220 ko qui
s'ouvre en `file://`.

### La première mesure — 20 graines, les deux oracles

| Métrique | Mesuré | Cible | |
|---|---|---|---|
| Complétion (palier 5) | **100 %** | 100 % | ✅ |
| Jours (médiane) | 6 813 | — | |
| Heures d'horloge à 1× | **17,0 h** | ~25 h | ⚠️ court d'un tiers |
| Contrats signés | **661** | 40–60 | ❌ **11× trop** |
| Contrats refusés | **533** | 2–8 | ❌ |
| Taux de mariages ratés | **0,7 %** | 15 % | ❌ **le jeu n'a pas de dents** |
| Salons gagnés | **0 sur 19** | — | ❌ **boss inatteignable** |

### ⚠️ La parité n'est pas atteinte — à régler EN PREMIER

Les deux oracles tombent d'accord sur ce qui est **intensif** et divergent de
~21 % sur ce qui est **extensif** :

| Métrique | Python | JS | Écart |
|---|---|---|---|
| note moyenne | 60,5 | 60,3 | **0,3 %** ✅ |
| palier atteint | 5 | 5 | **0 %** ✅ |
| taux de raté | 0,6 % | 0,7 % | 7,7 % |
| jours | 8 680 | 6 813 | **21,5 %** ❌ |
| contrats | 852 | 662 | **22,4 %** ❌ |
| visiteurs | 368 613 | 293 313 | **20,4 %** ❌ |

Les **règles** concordent (une note se calcule pareil des deux côtés) ; c'est
la **trajectoire** qui diverge. Tant que ce n'est pas fermé, lis les chiffres
absolus à ±20 % et ne t'en sers que pour comparer des variantes **au sein du
même oracle**.

**Déjà écarté** (vérifié, sans effet mesurable) :
- le générateur — mulberry32 rend une suite identique au bit près ;
- l'ordre de consommation d'`alea()` à la création d'un article, dans la
  journée de boutique, chez les rivaux, au salon ;
- un prospect expiré part chez un concurrent (manquait côté Python — corrigé,
  n'a pas fermé l'écart) ;
- `OUBLI_JOURS` sur le compteur de refus (manquait — corrigé, sans effet) ;
- l'aménagement au jour 1 (le JS ne peut pas, faute de veille — symétrisé) ;
- les tapis et cadres comptés à tort comme voisins de combo côté Python
  (corrigé, sans effet mesurable : l'IA n'en achète presque pas).

**Où chercher ensuite.** L'économie de boutique est un circuit qui
s'auto-alimente — attrait → visiteurs → argent → meubles → attrait. Une
différence minime et *persistante* s'y compose. Le plus prometteur est de
comparer jour par jour, sur une graine, `attrait` / `recette` / `argent`
plutôt que les totaux de fin : le harnais de trace existe déjà
(`tools/` + une boucle de 400 jours), c'est ce qui a permis de trouver les
quatre correctifs ci-dessus.

### ⚠️ Les trois choses à régler ensuite, dans cet ordre

1. **« 40–60 contrats » et « ~25 h » sont arithmétiquement incompatibles.**
   Un contrat dure 14 à 34 jours et on en mène 2 à 6 de front ; 50 contrats,
   c'est donc ~600 jours, soit **1,5 h** à 9 s/jour. Pour tenir 25 h il faut
   ~10 000 jours, donc ~700 contrats. **Il faut choisir**, et c'est une
   décision de design, pas un réglage :
   - soit la durée de vie prime → la cible passe à ~500 contrats et le contrat
     devient un geste courant ;
   - soit la rareté prime → 40–60 contrats, ~3 h d'horloge, et les 25 h
     doivent venir d'ailleurs (jours plus lents, ou temps passé en menus).
   Tant que ce n'est pas tranché, `CIBLE_CONTRATS` et `CIBLE_HEURES` se
   contredisent et l'oracle signalera toujours une des deux au rouge.

2. **Le jeu n'a pas de dents** (0,7 % de ratés contre 15 % visés). La
   décision de design n°7 dit que c'est le point le plus important après la
   boucle. Piste mesurée : `EXIGENCE_BASE` / `EXIGENCE_PAR_PALIER` montent
   trop lentement devant la qualité du stock accumulé.

3. **Le salon est du contenu inatteignable** (piège n°6) : 0 victoire sur 19
   participations, sur 20 graines. Cause identifiée dans `scoreConcurrent` —
   le score d'un rival croît avec sa notoriété **sans borne**, alors que le
   stand du joueur plafonne à 5 pièces. Il faut indexer le rival sur le même
   plafond que le joueur, pas sur une notoriété qui court.

**Prochain pas :** trancher le point 1 avec l'utilisateur, puis régler 2 et 3
par la méthode (`tools/balance/config.py` → `tune.py` → `banc.py` → JS →
`npm run parite --graines 20`). Ne rien toucher au JS avant.
