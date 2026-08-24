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

**Cible : ~11 h de durée de vie**, portée par l'horloge (`MS_PAR_JOUR`) et par
le nombre de contrats, pas par le nombre de mariages animés.
*(Le briefing d'origine disait 25 h et « 40 à 60 contrats » — les deux étaient
arithmétiquement incompatibles. Arbitré avec l'utilisateur : voir « La durée de
vie a été tranchée » plus bas.)*

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
   ✅ **Tenu, et voici comment.** La cause du 0,6 % de ratés n'était pas une
   constante trop basse : `estimer()` appelle `resoudre()`, la fonction même du
   jour J, donc le joueur prédisait sa note au point près en signant. Monter
   l'exigence ne produisait pas d'échecs, seulement des refus. **Un jeu ne prend
   des dents que si l'engagement précède l'information.** Deux mécaniques le
   font : l'exigence n'est annoncée qu'en **fourchette** (`EXIGENCE_FLOU`), et
   des **imprévus** tombent entre la signature et le jour J — ils consomment
   `alea()`, donc ils sont absents de l'estimation par construction, pas par
   ruse. Mesuré : **14,6 %** de ratés.
9. **Le codex ne dit QUE ce qui a marché.** Jamais ce qui rate, jamais ce qui
   marche moins bien, jamais une mise en garde. Le jeu connaît parfaitement les
   mauvais accords — la table d'affinités est dans `config.js`. S'il les
   affichait, même en avertissement (« de l'or sur un couple bohème, ça
   jure »), il donnerait la réponse, et découvrir **pour qui** une pièce est
   faite est l'essentiel de ce qu'on demande au joueur (décision n°4).
   Le silence sur ce qui rate n'est pas une omission : c'est la moitié du
   système. Corollaire d'implémentation : `codex.js` n'expose **aucune**
   fonction capable de répondre « ça ne marche pas ».
10. **L'argent ne monte jamais tout seul.** Toute recette est adossée à
   quelque chose de réel : une **pièce vendue** qui quitte le stock, ou une
   **commission** sur ce qu'on a fait réserver. Un dossier où l'on n'a rien
   engagé ne commissionne rien. C'est ce qui met le stock sous tension — chaque
   pièce est à la fois une vente possible aujourd'hui et un atout possible pour
   un mariage.
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

Compter **150 à 250 contrats** sur la partie, de plus en plus exigeants — mesuré
à 205. *(Le briefing disait 40 à 60 : incompatible avec la durée visée, voir
l'arbitrage plus bas.)*

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
| `src/equipe.js` | Quatre rôles, formation, salaires. Chaque rôle est **lu**. | neuf |
| `src/imprevus.js` | Ce qui tombe **après** la signature. Les dents du jeu. | neuf |
| `src/codex.js` | Ce qu'on a appris. **N'inscrit que ce qui a marché.** | neuf |
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

### 11. L'échelle d'un coefficient se vérifie contre ce qu'il MULTIPLIE
`VENTE.CHANCE_PAR_ATTRAIT` valait `0,006`. Lu seul, c'est une petite valeur,
cohérente avec ses voisins dans la table. Mais il multiplie l'**attrait total**
de la boutique, qui se compte en **centaines** en fin de partie : la
probabilité saturait à 85 %, la boutique liquidait tout ce que le fournisseur
livrait, et le stock restait collé à zéro. Mesure : **1 contrat en
12 000 jours**.
Une constante juste sur une échelle et fausse sur l'autre ne se voit pas à la
lecture — elle se voit en écrivant la multiplication en entier. Correction :
`0,0004`, plus la **règle de la pièce phare** (on ne vend jamais la meilleure
pièce libre d'un emplacement), qui garantit qu'un mariage reste toujours
montable.

### 12. Un axe constant est un quart de la note qui ne joue pas
**Le plus coûteux de la session, et invisible dans toutes les métriques
agrégées.** La note se lit sur quatre axes pondérés. L'axe **budget** valait
**0 sur absolument tous les mariages** — 15 % de la note, strictement constant.
Complétion, durée, contrats, taux de ratés : tout était « dans la cible », et le
joueur voyait pourtant un 0 sur chaque écran de résultat.
Cause : le budget d'un couple est multiplié par six avec le palier
(`budgetMult`), les prix des prestataires ne l'étaient pas. La part du budget
réellement dépensée tombait de **0,29 au palier 1 à 0,037 au palier 5**.
C'est le piège n°2 dans sa forme la plus pure. **Une moyenne ne dit jamais
qu'une de ses composantes est morte** : les deux harnais affichent désormais
les quatre axes SÉPARÉMENT, et crient quand l'un tombe à zéro.

### 13. Une charge qui ne décroît pas avec l'échec est un piège absorbant
C'est le **miroir exact du piège n°9**. Là, une pénalité grandissait avec le
succès ; ici, une charge ne diminuait pas avec l'échec.
Le loyer était un forfait par palier (55, puis +74 par palier) — et **le palier
ne redescend jamais**. Une graine sur vingt finissait à 12 000 jours, palier 1,
notoriété 0, argent 0, 3 pièces en stock, 9 meubles, note moyenne 46 contre 72
ailleurs. La boucle se refermait sur elle-même : plus d'argent → plus de stock →
des dossiers à trous → des mariages ratés → notoriété à zéro → moins de
visiteurs → toujours moins d'argent. Le revenu plancher d'une boutique
dépouillée vaut ~25/jour ; elle en payait 55. Elle perdait 30 par jour, pour
toujours.
La bonne forme : **indexer la charge sur ce qu'on tient**
(`CHARGES_PAR_MEUBLE`), pas sur ce qu'on a atteint. Elle se dégonfle quand la
boutique se vide, donc il reste toujours un chemin de retour — sans qu'aucun
filet artificiel n'ait à être ajouté. Complétion : 19/20 → **20/20**.
*Cherche toujours si ton état d'échec a une sortie.*

### 14. Le piège n°4 avait raison : cherche le plafond, pas la valeur
Nouvelle occurrence, en pleine lumière. Pour donner des dents au jeu, monter
`IMPREVUS.CHANCE_PAR_JOUR` de `0,10` à `0,22` — plus du double — ne faisait
bouger le taux de ratés que de **7,3 % à 9,1 %**.
Parce que `MAX_PAR_DOSSIER` valait 3 et qu'on mesurait déjà **2,78 imprévus par
dossier** : avec une préparation de 60 à 120 jours, le plafond était atteint
depuis longtemps et la chance quotidienne ne décidait plus rien.
La vraie poignée était le plafond : 3 → 7,3 %, 4 → 11,1 %, 5 → 14,8 %,
6 → 20,1 %. **Quand un réglage n'a plus d'effet, la constante que tu tournes
n'est pas celle qui lie.**

### 15. Les falaises se trouvent en balayant, jamais en raisonnant
Quatre trouvées cette session, toutes invisibles au raisonnement :
- `CLIENTS.PATIENCE_JOURS` : 6 / **10** / 18 / 30 — 18 et 30 détruisent la partie.
- `AGENDA.PRIX_MULT` (première version, abandonnée) : 3 → 12/12 parties finies,
  5 → 6/12, 8 → **zéro contrat signé**.
- `CLIENTS.EXIGENCE_BASE` : 45 → 12,6 h, 48 → 18,4 h, 51 → **33,7 h** et 7/12.
- `AGENDA.AMBITION_EXPOSANT` : 1,9 → 52 d'axe budget, 2,2 → 62, 2,6 → **0/12**.
Le mécanisme est toujours le même : au-delà d'un seuil, les devis dépassent
l'enveloppe qu'on s'autorise par emplacement, plus personne n'est réservable, et
les dossiers restent à trous. **Toute valeur retenue doit avoir été mesurée avec
ses voisines**, et la complétion regardée à chaque point.

### 16. Ne règle jamais le début de partie avec la fin
Corollaire des deux précédents, et la faute la plus tentante. Pour ranimer
l'axe budget, la première correction fut un **facteur plat** sur les devis
(`×3`). Elle marchait en fin de partie — et créait un **piège à pauvreté** au
début : au palier 1 l'ambition vaut 1,00, donc le facteur triplait les devis
sans que le budget des couples ait bougé d'un euro. Deux parties sur vingt sont
restées bloquées au palier 1 pendant 12 000 jours.
Un **exposant** (`echelle ** 2`) vaut 1 en 1 : les prix du quartier restent
exactement ceux du jeu qui finissait à 100 %, et l'écart ne se creuse que là où
le budget se creuse aussi. **Quand une correction doit grandir avec la
progression, c'est un exposant qu'il te faut, pas un facteur.**

### 17. Un `else` nu attrape ce qu'on ajoutera plus tard
Trouvé en pilotant un vrai navigateur, pas en lisant le code. L'écran titre
avait trois boutons et un `if / else if / else`. Le bouton « reprendre » du
panneau de code, ajouté après, retombait dans le `else` : il **reconstruisait le
panneau** — donc vidait le champ — juste avant que la ligne suivante n'aille y
lire le code. **Le code de partie était inutilisable depuis l'écran titre**,
c'est-à-dire exactement là où il est indispensable (piège n°3). Nommer la
branche coûte trois mots.

### 18. Un champ de N bits ne code pas sa borne supérieure
**Le plus vicieux de la session : il a besoin d'ÉCHELLE pour se voir.**
Le compresseur du code de partie encode un décalage sur **12 bits** — donc
0 à 4095. Mais la fenêtre de recherche remontait à `i - 4096`, donc un
recouvrement pouvait être trouvé à exactement 4096 : `(4096 >> 4) & 255` vaut
0, `(4096 & 15) << 4` vaut 0, et le décalage sort **codé comme zéro**. Au
décodage, `debut = out.length - 0` pointe après la fin du tampon, la copie
ramène des `undefined`, et la fin de la chaîne part en fumée.
Il faut **plus de 4 ko d'historique** pour qu'un tel recouvrement existe. Les
petites parties passaient ; les grosses rendaient un code que le jeu refusait
lui-même — « Code abîmé : il a été tronqué à la copie ». Le code était intact :
c'est le compresseur qui mentait, et le message accusait le joueur.
Deux leçons. **Une fenêtre de taille W donne des décalages 1..W, donc il faut
W ≤ 2^N − 1**, jamais 2^N. Et **un bug qui a besoin d'échelle ne se voit pas
sur un petit cas** : le codec se teste sur la plus grosse charge du jeu, pas
sur « bonjour ».
*Trouvé en voulant charger une partie de test, pas en relisant le code.*

### 19. Deux dépenses qui puisent au même seau : la première sert, l'autre jeûne
L'IA achetait du stock ET des meubles, chacune descendant jusqu'à sa réserve
de trésorerie. Tant que la boutique démarrait meublée, ça ne se voyait pas.
Sur une boutique **vide**, l'ordre est devenu tout :
- stock d'abord → une graine sur vingt finissait à 12 000 jours avec **zéro
  meuble** : aucune place, donc aucune recette, donc jamais de quoi poser la
  première ;
- meubles d'abord → deux autres finissaient avec **41 meubles et 3 pièces**,
  des dossiers à trous et la moitié des mariages ratés.
Les deux sont des parties perdues, et **aucun joueur ne joue ni l'une ni
l'autre**. Ce n'est donc pas un ORDRE qu'il fallait, c'est une **bascule sur un
plancher** : tant qu'on n'a pas de quoi habiller les dossiers qu'on porte
(3 emplacements de stock × la capacité), le stock passe devant ; au-dessus,
c'est la place qui manque.
Il a fallu **deux** gardes, pas une : la bascule seule laissait encore fuir
l'argent vers les meubles quand le catalogue n'offrait rien d'abordable —
d'où « on ne meuble pas une boutique qu'on n'a pas de quoi remplir », avec la
première place en exception puisque sans elle rien ne démarre.
*Quand deux investissements partagent une bourse, ce n'est jamais l'ordre qu'il
faut régler, c'est le seuil qui les départage.*

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
   ⚠️ *Et `max-width:100%` est un facteur fractionnaire déguisé.* Le canvas
   faisait 480 px de large, le téléphone 350 : la règle CSS le ramenait à
   0,73×. La correction n'est pas dans le facteur, elle est dans la
   **résolution native** — un canvas qui serre la scène (340 px pour une
   grille qui en fait 256) tient à l'échelle 1 sur un téléphone, et la
   boutique remplit son cadre au lieu d'y flotter.
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

**REGISTRE PARCHEMIN.** Le châssis, les panneaux et les menus sont en beige,
l'encre est brune, et un cadre de bois tient le tout. *(La première version
était une ardoise sombre — arbitré avec l'utilisateur : trop gris/noir.)*

Les règles de forme ne bougent pas : **zéro dégradé, zéro ombre floue**. Le
relief est fait de **deux arêtes nettes** — une claire en haut à gauche, une
sombre en bas à droite. C'est le biseau des jeux de gestion pixel : il ne coûte
aucun dégradé et il rend un bouton lisible *comme* bouton sans avoir à l'écrire.

| Jeton | Valeur | Métier — un seul par couleur |
|---|---|---|
| `--p0` … `--p4` | `#fdf7ea` → `#c9ac78` | le parchemin, du clair au foncé |
| `--bois` | `#8a5a2e` | le cadre, les bordures |
| `--encre` | `#3f2d1c` | le texte |
| `--or-vif` | `#e2ae3e` | argent, récompenses, **onglet actif** |
| `--bleu` | `#3f6fa8` | **la navigation** : onglets, vitesse. Jamais une donnée de jeu. |
| `--poudre` | `#b94a6f` | sélection |
| `--prune` | `#8a2c4f` | urgence, contrat perdu |
| `--vert` | `#4a7540` | prestataires, réussite |

Le **bleu est le métier de la navigation**, et rien d'autre. C'est ce qui
permet de lire un onglet sans le décoder : tout ce qui est bleu se clique pour
aller ailleurs, tout ce qui est or est une valeur ou l'endroit où l'on est.

⚠️ **Les couleurs de `config.js` ont DEUX métiers**, et c'est le piège de cette
passe. `STYLE[x].couleur` teinte un sprite **sur le canvas** *et* sert d'encre
**dans le DOM**. Elles sont claires parce que le canvas était sombre ; sur
parchemin, le romantique tombe à **2,2:1** et le bohème à 2,4:1 — illisible.
Ne les « corrige » pas dans `config.js` : tu casserais les sprites, qui sont
justes. C'est `encre()` dans `ui.js` qui les assombrit **au moment de
l'affichage**, jusqu'à 4,5:1 sur parchemin.

Et `encre()` passe **par HSL, pas par une multiplication des canaux** :
- multiplier les canaux rapproche la couleur de l'axe gris → les quatre styles
  sortaient en quatre **bruns indistincts**, ce qui est pire qu'illisible :
  c'est trompeur ;
- multiplier pour *saturer* fait saturer les canaux hauts → l'or (216,169,74)
  voyait rouge ET vert taper 255, donc il virait **olive**. Un clamp qui touche
  deux canaux sur trois ne conserve plus la teinte du tout.

En HSL la teinte est un nombre qu'on ne touche pas : elle survit par
construction. Seule la clarté descend, par petits pas, jusqu'au contraste visé.

⚠️ **Un aplat n'a pas à être lisible, il a à être vu.** `encre()` ne s'applique
qu'au **texte** et aux **bordures**. Les remplissages de jauge, les pastilles
du codex et les pastilles de ressource gardent la couleur vive. Corollaire
inverse, payé une fois : une **piste** de jauge en `#c9ac78` se lit comme un
remplissage doré, donc une jauge à 5 % paraissait pleine. La piste doit être
franchement plus claire que n'importe quel remplissage, sinon elle ment.

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

**Métriques cibles**, arrêtées et atteintes : complétion 100 %, durée ~11 h
(voir l'arbitrage plus bas), taux de mariages ratés ~15 %, 150 à 250 contrats
signés, 7 à 30 refusés.

⚠️ **Regarde les quatre axes séparément, à chaque mesure.** Une note moyenne ne
dit jamais qu'une de ses composantes est morte : l'axe budget a valu 0 sur des
parties entières pendant que toutes les métriques agrégées restaient vertes
(piège n°12). Les deux harnais les affichent un par un et crient sur un zéro.

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

**Le jeu est complet et équilibré, de bout en bout.** Boutique isométrique →
stock → carnet de prospects → dossier à six emplacements → imprévus → jour J
résolu puis animé → notoriété → palier → salon annuel. Huit onglets :
BOUTIQUE, STOCK, CLIENTS, PRESTA, ÉQUIPE, CODEX, SALON, BILAN.

Vérifié dans un vrai navigateur (Chromium piloté), sur une partie chargée par
code au palier 3 : les huit onglets, la fiche d'un prospect, l'ouverture d'un
dossier, la liste de choix d'un emplacement, le codex à 69 entrées, l'équipe et
ses salaires, le journal des imprévus d'un dossier. **Zéro erreur JavaScript** —
la seule requête en échec est la police Google, que la page est faite pour
remplacer par une police système. `npm run solo` produit un fichier unique de
276 ko qui s'ouvre en `file://`, sans serveur.

### La durée de vie a été tranchée avec l'utilisateur

Les deux cibles du briefing d'origine — « 40 à 60 contrats » et « ~25 h » —
étaient arithmétiquement incompatibles : un contrat dure quelques jours et on
en mène plusieurs de front, donc 50 contrats ≈ 600 jours ≈ 1,5 h.
**Décision : le compromis.** ~200 contrats, ~11 h d'horloge
(`CIBLE_CONTRATS: [150, 250]`, `CIBLE_HEURES: 11`).

### La mesure — 20 graines, les deux oracles

| Métrique | Python | JS | Cible | |
|---|---|---|---|---|
| Complétion (palier 5) | 100 % | 100 % | 100 % | ✅ |
| Jours (médiane) | 2 964 | 3 095 | — | |
| Heures d'horloge | 10,3 h | 10,8 h | ~11 h | ✅ |
| Contrats signés | 205 | 201 | 150–250 | ✅ |
| Contrats refusés | 15 | 17 | 7–30 | ✅ |
| **Taux de ratés** | **14,6 %** | **14,5 %** | **15 %** | ✅ |
| Note moyenne | 70,0 | 70,4 | — | |
| **Salons gagnés** | **4 / 8** | **3 / 8** | — | ✅ |
| Pièces vendues | 3 974 | 4 075 | > 0 | ✅ |
| Imprévus subis | 730 | 732 | > 0 | ✅ |
| Équipe finale | 5 | 5 | — | |

**Les quatre axes de la note, vivants** : élégance 73, cohérence 81, émotion 68,
**budget 53** (il valait 0 avant le piège n°12). Part du budget réellement
dépensée : **0,41**.

**Ce que le joueur atteint réellement** (piège n°6, mesuré à chaque run) : les
cinq paliers sont atteints par 100 % des parties ; le codex se remplit —
**10 accords de styles sur 10**, 27 prestataires, 59 familles de pièces,
3 combos de boutique. Aucun contenu inatteignable.

### La parité est enfin crédible

| | écart |
|---|---|
| palier · équipe | **0,0 %** |
| imprévus | 0,2 % |
| note moyenne | 0,5 % |
| axe budget | 0,9 % |
| taux de ratés | 1,0 % |
| part du budget | 1,3 % |
| contrats | 2,2 % |
| pièces vendues | 2,5 % |
| jours | 4,2 % |
| visiteurs refoulés | 4,7 % |
| visiteurs | 5,1 % |
| contrats refusés | 11,8 % |

**Tout sauf « refusés » tient sous 5,1 %**, contre 22,6 % au premier essai et
8,1 % en fin de session 1. « Refusés » est une médiane sur de petits comptes
(15 contre 17) : deux refus d'écart suffisent à faire 12 %.

⚠️ **Leçon inattendue, à garder** : l'écart entre les deux oracles s'est
resserré tout seul en corrigeant les pièges n°12 et n°13. Il ne venait pas
seulement de l'amplification de l'économie de boutique — il venait surtout des
**parties aberrantes**. Une graine bloquée à 12 000 jours tire une médiane bien
plus loin qu'une différence d'arrondi. *Un gros écart de parité est d'abord une
question à poser au jeu, pas à l'implémentation.*
(L'arrondi comptait aussi : `round()` en Python arrondit les demis vers le
**pair**, `Math.round` en JS vers le **haut**. `sim.py` a désormais un
`jsround()`.)

### Ce qui reste ouvert

Rien de bloquant. Trois choses valent d'être regardées un jour :

1. **La part du budget dépensée plafonne à ~0,41.** L'IA — comme le joueur —
   s'autorise `enveloppe × 1,35` par emplacement, et la somme des enveloppes
   des trois emplacements de prestataires vaut 0,64 du budget. La branche
   « `part >= 0,72` → 100 » de l'axe budget est donc **hors d'atteinte** avec
   des prestataires seuls. Ce n'est pas grave — l'axe vaut 53 et il varie — mais
   c'est un plafond dont il faut se souvenir avant de retoucher cet axe.
2. **96 % de la recette de boutique vient des ventes de pièces.** Le `gain` des
   meubles ne pèse presque plus. Ce n'est pas un bug (c'est bien un commerce),
   mais si l'on voulait que le choix des meubles compte pour leur rendement et
   pas seulement pour leur attrait et leurs places, c'est là qu'il faudrait
   regarder.
3. **L'argent cesse d'être une contrainte en fin de partie** (plusieurs
   millions au palier 5). La notoriété est le vrai goulot. Conforme au genre,
   mais à surveiller si l'on ajoute des dépenses de fin de partie.
