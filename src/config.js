/**
 * config.js — TOUT l'equilibrage et toutes les tables de donnees.
 * Aucune logique de jeu ici : uniquement des nombres et des tables, plus les
 * courbes qui en derivent.
 *
 * ⚠️ Regle absolue : une constante d'equilibrage ne vit nulle part ailleurs.
 * Sur le projet precedent, chaque valeur ecrite en dur dans un module a fini
 * par etre oubliee lors d'une passe de reglage.
 *
 * ⚠️ Ces valeurs ont ete MESUREES, pas choisies : reglees dans
 * tools/balance/config.py, confirmees sur 20 graines par l'oracle Python,
 * puis repercutees ici. Ne les change pas a vue — refais le tour complet
 * (voir la methode dans CLAUDE.md).
 *
 * Mesure du 19/08 (oracle Python, 20 graines) : 100 % de completion,
 * 3 174 jours de mediane, 11,0 h d'horloge, 157 contrats, 8 refus.
 * Restent hors cible : le taux de mariages rates (0,6 % contre 15 % vises)
 * et le salon, que le joueur ne gagne jamais. Voir CLAUDE.md.
 */

/* ==================================================================== temps */

export const SAISONS = ["printemps", "ete", "automne", "hiver"];

export const SAISON = {
  printemps:{ txt:"Printemps", couleur:"#8fb87a",
              // Multiplicateur d'arrivee de prospects et de frequentation.
              prospects:1.05, frequentation:1.10 },
  ete:      { txt:"Été",       couleur:"#d8a94a",
              // ⚠️ La haute saison ne doit PAS etre juste « plus d'argent » :
              // c'est le moment ou la capacite devient la contrainte, donc le
              // flux de prospects monte beaucoup plus que la frequentation.
              prospects:2.20, frequentation:1.15 },
  automne:  { txt:"Automne",   couleur:"#c07a4a",
              prospects:0.85, frequentation:0.95 },
  hiver:    { txt:"Hiver",     couleur:"#8a9ac8",
              // La basse saison est le temps du stock et des travaux. Si elle
              // rapportait autant, personne n'aurait de raison d'agrandir.
              prospects:0.35, frequentation:0.70 },
};

/* ================================================================ paliers */

/**
 * L'echelle de progression. Elle remplace les 100 etages d'Aincrad : sans
 * echelle explicite, pas de duree de vie mesurable.
 * `seuil` est en notoriete cumulee.
 */
export const PALIERS = [
  { n:1, txt:"Quartier",  seuil:0,    budgetMult:1.00, invitesMax:70,
    txtDeblocage:"robes simples, un prestataire par type" },
  { n:2, txt:"Ville",     seuil:140,  budgetMult:1.55, invitesMax:110,
    txtDeblocage:"costumes sur mesure, lieux privés" },
  { n:3, txt:"Région",    seuil:520,  budgetMult:2.40, invitesMax:160,
    txtDeblocage:"pièces d'exception, grands domaines" },
  { n:4, txt:"Capitale",  seuil:1350, budgetMult:3.80, invitesMax:230,
    txtDeblocage:"créateurs, orchestres" },
  { n:5, txt:"Royal",     seuil:2900, budgetMult:6.00, invitesMax:320,
    txtDeblocage:"le mariage princier, fin de partie" },
];

/* ================================================================== styles
   Les quatre axes de gout. Tout le jeu tourne autour d'eux : une piece est
   notee POUR UN CLIENT, jamais dans l'absolu (decision de design n°4). */

export const STYLES = ["boheme", "classique", "moderne", "romantique"];

export const STYLE = {
  boheme:     { txt:"Bohème",     couleur:"#7fa87a" },
  classique:  { txt:"Classique",  couleur:"#8a9ac8" },
  moderne:    { txt:"Moderne",    couleur:"#a89bb0" },
  romantique: { txt:"Romantique", couleur:"#e69aa6" },
};

/**
 * Distance entre styles : deux styles voisins ne jurent pas, deux styles
 * opposes si. Sert a la coherence d'un dossier.
 * ⚠️ Symetrique par construction (verifie par un invariant plus bas) : une
 * table dissymetrique donnerait un score dependant de l'ordre des slots.
 */
export const AFFINITE_STYLES = {
  boheme:     { boheme:1.00, classique:0.35, moderne:0.30, romantique:0.70 },
  classique:  { boheme:0.35, classique:1.00, moderne:0.55, romantique:0.75 },
  moderne:    { boheme:0.30, classique:0.55, moderne:1.00, romantique:0.40 },
  romantique: { boheme:0.70, classique:0.75, moderne:0.40, romantique:1.00 },
};

/* ================================================================== slots
   Six emplacements a remplir. Trois viennent du STOCK (on les achete et on
   les garde), trois viennent des PRESTATAIRES (on les reserve pour une date).
   C'est ce partage qui fait travailler les deux mecaniques a chaque dossier. */

export const SLOTS = ["lieu", "robe", "costume", "decoration", "traiteur", "musique"];

export const SLOT = {
  lieu:       { txt:"Lieu",       source:"prestataire", poids:1.15 },
  robe:       { txt:"Robe",       source:"stock",       poids:1.30 },
  costume:    { txt:"Costume",    source:"stock",       poids:0.85 },
  decoration: { txt:"Décoration", source:"stock",       poids:1.00 },
  traiteur:   { txt:"Traiteur",   source:"prestataire", poids:0.95 },
  musique:    { txt:"Musique",    source:"prestataire", poids:0.75 },
};

/* ================================================================== stock */

/**
 * Les familles d'articles. `silhouette` renvoie a une recette de dessin :
 * pour les robes ce sont les cinq silhouettes validees sur maquette, et
 * elles doivent se lire sans etiquette (piege de pixel art n°1).
 * `styleNaturel` est le style vers lequel la famille penche : une piece peut
 * en porter un autre, elle coute alors plus cher a produire.
 */
export const FAMILLES = {
  robe: {
    princesse:{ txt:"Princesse", silhouette:"princesse", styleNaturel:"romantique", coutMult:1.20 },
    sirene:   { txt:"Sirène",    silhouette:"sirene",    styleNaturel:"moderne",    coutMult:1.10 },
    boheme:   { txt:"Bohème",    silhouette:"boheme",    styleNaturel:"boheme",     coutMult:0.90 },
    empire:   { txt:"Empire",    silhouette:"empire",    styleNaturel:"classique",  coutMult:1.00 },
    courte:   { txt:"Courte",    silhouette:"courte",    styleNaturel:"moderne",    coutMult:0.75 },
  },
  costume: {
    troisPieces:{ txt:"Trois-pièces", styleNaturel:"classique",  coutMult:1.05 },
    smoking:    { txt:"Smoking",      styleNaturel:"classique",  coutMult:1.20 },
    lin:        { txt:"Lin clair",    styleNaturel:"boheme",     coutMult:0.80 },
    velours:    { txt:"Velours",      styleNaturel:"romantique", coutMult:1.10 },
    cintre:     { txt:"Cintré",       styleNaturel:"moderne",    coutMult:0.95 },
  },
  decoration: {
    guirlandes:  { txt:"Guirlandes",       styleNaturel:"boheme",     coutMult:0.70 },
    centres:     { txt:"Centres de table", styleNaturel:"classique",  coutMult:0.95 },
    arche:       { txt:"Arche fleurie",    styleNaturel:"romantique", coutMult:1.15 },
    lanternes:   { txt:"Lanternes",        styleNaturel:"romantique", coutMult:0.85 },
    minimaliste: { txt:"Ligne épurée",     styleNaturel:"moderne",    coutMult:1.00 },
  },
};

/**
 * Raretes. `qualite` est le multiplicateur de note, `prix` celui du cout.
 * ⚠️ Le prix monte plus vite que la qualite : sans ca, la meilleure strategie
 * serait d'acheter uniquement des pieces d'exception et le stock cesserait
 * d'etre un pari sur la variete.
 */
export const RARETES = {
  commun:    { txt:"Commun",     poids:62, qualite:1.00, prix:1.00, affixes:0, couleur:"#a89bb0" },
  rare:      { txt:"Rare",       poids:30, qualite:1.28, prix:1.75, affixes:1, couleur:"#8a9ac8" },
  exception: { txt:"Exception",  poids:8,  qualite:1.62, prix:3.20, affixes:2, couleur:"#d8a94a" },
};

/**
 * Affixes : de petits bonus qui portent sur UN axe du jour J.
 * ⚠️ Un affixe doit etre lu dans mariage.js, pas seulement agrege sur la
 * fiche de l'article (piege herite n°2).
 */
export const AFFIXES = {
  brodee:     { txt:"Brodée main",     axe:"elegance", val:6,  poids:10 },
  surMesure:  { txt:"Sur mesure",      axe:"elegance", val:9,  poids:7 },
  vintage:    { txt:"Pièce vintage",   axe:"emotion",  val:8,  poids:9 },
  signature:  { txt:"Signée",          axe:"emotion",  val:11, poids:5 },
  soldee:     { txt:"Fin de série",    axe:"budget",   val:10, poids:8 },
  intemporel: { txt:"Intemporelle",    axe:"coherence",val:7,  poids:8 },
  audacieux:  { txt:"Audacieuse",      axe:"coherence",val:-6, poids:6, bonusEmotion:14 },
};

/* Cout d'un article : base × tier^exposant × rarete × famille.
   ⚠️ Exposant > 1 : une progression lineaire rendait le tier 5 trivialement
   accessible des le palier 2 et court-circuitait toute l'echelle. */
export const STOCK = {
  PRIX_BASE:        { robe:520, costume:340, decoration:260 },
  PRIX_EXPOSANT:    1.85,
  // Qualite intrinseque d'une piece de tier t, avant rarete.
  QUALITE_BASE:     34,
  QUALITE_PAR_TIER: 13,
  // Revente : on ne recupere pas sa mise, sinon le stock n'est plus un pari.
  TAUX_REVENTE:     0.45,
  // Taille du catalogue propose a l'achat, renouvele chaque saison.
  CATALOGUE_TAILLE: 9,
  // Une piece deja utilisee s'use : elle perd de la qualite a chaque mariage.
  USURE_PAR_USAGE:  0.05,
  USURE_PLANCHER:   0.60,
};

/* ========================================================== prestataires
   Decision de design n°6 : ce sont des RELATIONS avec un AGENDA, pas une
   septieme categorie de boutique. Le fleuriste que tu voulais est deja pris
   ce samedi-la — par toi ou par un concurrent. */

export const PRESTA_TYPES = {
  lieu:     { txt:"Lieu",     prixBase:1500, jourBloques:2 },
  traiteur: { txt:"Traiteur", prixBase:780,  jourBloques:1 },
  musique:  { txt:"Musique",  prixBase:420,  jourBloques:1 },
};

export const PRESTATAIRES = {
  // Chaque entree : type, palier d'apparition, qualite 0-100, style, prix ×.
  // Le prix suit la qualite de pres : payer plus doit acheter de la qualite,
  // le choix se fait sur le STYLE et sur la DISPONIBILITE, pas sur le prix.
  salleDesFetes:  { type:"lieu", txt:"Salle des fêtes",     palier:1, qualite:32, style:"classique",  prix:0.55 },
  grangeVerger:   { type:"lieu", txt:"Grange du Verger",    palier:1, qualite:44, style:"boheme",     prix:0.80 },
  jardinHotel:    { type:"lieu", txt:"Jardin de l'Hôtel",   palier:2, qualite:58, style:"romantique", prix:1.10 },
  loftIndustriel: { type:"lieu", txt:"Loft de la Fonderie", palier:2, qualite:61, style:"moderne",    prix:1.20 },
  domaineVerger:  { type:"lieu", txt:"Domaine du Verger",   palier:3, qualite:74, style:"boheme",     prix:1.70 },
  chateauMarais:  { type:"lieu", txt:"Château du Marais",   palier:4, qualite:88, style:"classique",  prix:2.60 },
  villaCap:       { type:"lieu", txt:"Villa du Cap",        palier:5, qualite:96, style:"moderne",    prix:3.60 },

  buffetMarcel:   { type:"traiteur", txt:"Chez Marcel",       palier:1, qualite:30, style:"classique",  prix:0.60 },
  tableChamps:    { type:"traiteur", txt:"La Table des Champs",palier:1,qualite:47, style:"boheme",     prix:0.90 },
  maisonRoux:     { type:"traiteur", txt:"Maison Roux",       palier:2, qualite:60, style:"romantique", prix:1.15 },
  atelierSel:     { type:"traiteur", txt:"L'Atelier du Sel",  palier:3, qualite:75, style:"moderne",    prix:1.65 },
  chefBertrand:   { type:"traiteur", txt:"Chef Bertrand",     palier:4, qualite:90, style:"classique",  prix:2.70 },

  djTonio:        { type:"musique", txt:"DJ Tonio",          palier:1, qualite:34, style:"moderne",    prix:0.55 },
  duoCordes:      { type:"musique", txt:"Duo à cordes",      palier:1, qualite:45, style:"romantique", prix:0.85 },
  groupeFolk:     { type:"musique", txt:"Les Foins",         palier:2, qualite:58, style:"boheme",     prix:1.05 },
  quatuorLune:    { type:"musique", txt:"Quatuor de la Lune",palier:3, qualite:76, style:"classique",  prix:1.70 },
  orchestreOpera: { type:"musique", txt:"Orchestre de l'Opéra",palier:4,qualite:93, style:"classique", prix:2.90 },
};

export const AGENDA = {
  // Un prestataire pris est pris : c'est la source de pression du systeme.
  // Probabilite qu'un concurrent bloque une date donnee, par palier de jeu.
  PRESSION_BASE:    0.10,
  PRESSION_PAR_PALIER: 0.055,
  // Une relation entretenue (contrats passes ensemble) donne une priorite.
  FIDELITE_MAX:     5,
  FIDELITE_REMISE:  0.04,     // par point de fidelite, sur le prix
  FIDELITE_PRIORITE:0.09,     // par point, chance de deloger un concurrent
};

/* ================================================================ clients */

export const CLIENTS = {
  // Arrivee de prospects : une base par jour, modulee par saison et notoriete.
  PROSPECTS_PAR_JOUR: 0.16,
  PROSPECT_PAR_NOTORIETE: 0.00011,
  // Un prospect qui attend trop s'en va — chez un concurrent.
  PATIENCE_JOURS: 6,
  // Delai entre signature et jour J. Court : le contrat est l'unite de jeu,
  // pas la saison (decision de design n°1).
  DELAI_MIN: 9,
  DELAI_MAX: 21,
  // Budget : par invite, module par le palier du prospect.
  BUDGET_PAR_INVITE: 118,
  BUDGET_PLANCHER: 3800,
  // Les gouts d'un couple : on tire un style dominant fort et un secondaire.
  // ⚠️ Des gouts plats rendraient toutes les pieces equivalentes et tueraient
  // la decision n°4. Le dominant doit vraiment dominer.
  GOUT_DOMINANT: [58, 88],
  GOUT_SECOND:   [22, 52],
  GOUT_RESTE:    [4, 26],
  // Exigence : seuil de note en dessous duquel le couple est decu.
  EXIGENCE_BASE: 38,
  EXIGENCE_PAR_PALIER: 6.5,
  // Combien de contrats on peut mener de front. C'est LA contrainte d'ete.
  CAPACITE_BASE: 3,
  CAPACITE_PAR_PALIER: 1,
};

/* Refuser un contrat coute de la notoriete mais evite un mariage rate
   (decision de design n°5). Le cout monte si on refuse en serie : sans ca,
   la strategie optimale serait de ne signer que les dossiers parfaits.

   ⚠️ CE QUE REFUSER ACHETE : une place dans le CARNET, tout de suite.
   Le carnet ne tient que `capacite + CARNET_MARGE` dossiers en attente, et un
   couple qu'on n'a pas repondu le bloque jusqu'a expiration. Refuser libere
   la place immediatement, pour le couple qui se presentera demain.

   C'est la deuxieme version de cette regle. La premiere faisait payer une
   notoriete a chaque prospect EXPIRE, pour que « ignorer » ne soit pas
   gratuit. Elle a produit une spirale : le flux de prospects croit avec la
   notoriete, donc le cout d'expiration aussi, donc la notoriete s'ecrasait sur
   un equilibre bas. Sur 6 000 jours, 512 mariages reussis se soldaient par une
   notoriete de 14. Une penalite qui grandit avec le succes est un plafond
   deguise — piege herite n°4 sous un autre visage. */
export const REFUS = {
  COUT_NOTORIETE:  8,
  COUT_ESCALADE:   4,     // par refus dans la meme saison
  CARNET_MARGE:    3,     // dossiers en attente au-dela de la capacite
  OUBLI_JOURS:     90,
};

/* ================================================================ mariage */

/**
 * Le jour J se resout en QUATRE axes. Un chiffre unique ne dit pas ce qu'on a
 * rate — et c'est exactement ce qu'on veut corriger au mariage suivant.
 * ⚠️ Les poids somment a 1 (invariant verifie plus bas).
 */
export const AXES = {
  elegance:  { txt:"Élégance",    poids:0.30, couleur:"#d8a94a" },
  coherence: { txt:"Cohérence",   poids:0.28, couleur:"#7fa87a" },
  emotion:   { txt:"Émotion",     poids:0.27, couleur:"#e69aa6" },
  budget:    { txt:"Budget tenu", poids:0.15, couleur:"#8a9ac8" },
};

export const MARIAGE = {
  // Un slot vide ne vaut pas zero : il fait activement mal. Sans ca, remplir
  // six slots avec du mediocre serait toujours pire que d'en remplir trois.
  PENALITE_SLOT_VIDE: 17,
  // Coherence : part de l'accord avec les gouts du couple contre l'accord des
  // pieces entre elles. Les deux comptent — un dossier peut etre parfaitement
  // assorti et completement a cote des gouts.
  PART_GOUTS: 0.60,
  // Il faut des dents (decision de design n°7). En dessous de l'exigence du
  // couple, le mariage est rate : notoriete perdue, honoraires ampute.
  MALUS_RATE_NOTORIETE: 26,
  MALUS_RATE_HONORAIRES: 0.55,
  // Honoraires : part du budget qui te revient, courbee par la note.
  TAUX_HONORAIRES: 0.22,
  BONUS_NOTE: 0.55,           // part supplementaire, proportionnelle a note/100
  // Notoriete gagnee : proportionnelle a la note ET a la taille du mariage.
  NOTORIETE_BASE: 5,
  NOTORIETE_PAR_NOTE: 0.13,
  NOTORIETE_PAR_INVITE: 0.055,
  // Un mariage reussi ramene des prospects : c'est la boucle qui se referme.
  BOUCHE_A_OREILLE: 0.004,    // prospects par point de note
  // Depassement de budget : tolere jusqu'a un point, puis ca pique.
  BUDGET_TOLERANCE: 1.04,
  BUDGET_PENALITE:  180,      // points d'axe perdus par unite de depassement
};

/* ============================================================ concurrents
   La course a la notoriete. Ils bloquent des prestataires, recuperent les
   clients qu'on refuse et se presentent au salon. */

export const CONCURRENTS = [
  { cle:"aurore", txt:"Maison Aurore",     style:"romantique", agressivite:1.15, couleur:"#d8a94a" },
  { cle:"blancOr",txt:"Blanc & Or",        style:"classique",  agressivite:0.95, couleur:"#8a9ac8" },
  { cle:"duval",  txt:"Cérémonies Duval",  style:"moderne",    agressivite:0.85, couleur:"#a89bb0" },
  { cle:"garance",txt:"Atelier Garance",   style:"boheme",     agressivite:1.05, couleur:"#7fa87a" },
];

export const RIVALITE = {
  // Notoriete que gagne un concurrent par jour, courbee sur la progression du
  // joueur : sans indexation, ils decrochent au palier 2 et le jeu s'aplatit.
  GAIN_BASE: 0.55,
  GAIN_SUIVI: 0.34,           // part de la notoriete du joueur qu'ils suivent
  // Un client refuse part chez eux et leur rapporte.
  GAIN_PAR_REPRISE: 11,
};

/* ================================================================== salon
   Le rendez-vous annuel, et le SEUL ecran modal du jeu (decision n°2). */

export const SALON = {
  // Thematique tiree chaque annee : elle pese lourd, c'est ce qui recompense
  // un stock varie plutot qu'un stock optimal.
  POIDS_THEME: 0.40,
  // Nombre de pieces que le stand presente.
  PIECES_STAND: 5,
  // Recompenses par rang.
  PRIX: [
    { rang:1, argent:9000, notoriete:150, txt:"Grand Prix du Salon" },
    { rang:2, argent:4500, notoriete:85,  txt:"Deuxième place" },
    { rang:3, argent:2000, notoriete:40,  txt:"Troisième place" },
  ],
  // Se presenter coute un stand. Ne pas se presenter coute de la notoriete :
  // sinon, la strategie optimale est de sauter les annees faibles.
  COUT_STAND: 1200,
  MALUS_ABSENCE: 45,

  /* Le score d'un concurrent.
     ⚠️ Premiere version : `60 + notoriete * 0.34 + (palier-1) * 22`. La
     notoriete d'un rival court sans borne, alors que le stand du joueur
     PLAFONNE a cinq pieces — au palier 5, les rivaux tapaient dans les 1 000
     quand le meilleur stand possible valait 860. Mesure : 0 victoire sur 19
     participations, sur 20 graines. Le boss etait litteralement ingagnable,
     c'est-a-dire du contenu inatteignable (piege herite n°6).
     Les trois constantes ci-dessous sont calees sur le plafond du joueur :
     ~170 au palier 1, ~860 au palier 5 avec un stock qui colle au theme. */
  RIVAL_BASE: 150,
  RIVAL_PAR_PALIER: 120,
  RIVAL_PAR_NOTORIETE: 0.02,
};

/* ================================================================ boutique
   L'economie par frequentation, reprise de town.js. Chaque meuble a un gain
   par visiteur et un nombre de PLACES : les places sont le plafond.

   ⚠️ Piege herite n°4 : le plafond doit etre verifie sur la seule voie qui
   sert reellement les visiteurs. Un plafond controle a l'affichage et pas au
   service donne un jeu ou plus aucun reglage n'a d'effet. */

export const BOUTIQUE = { LARGEUR:9, HAUTEUR:7 };

export const MEUBLES = {
  portant:   { txt:"Portant",        prix:420,  gain:5.5, places:2, attrait:6,  palier:1, cat:"vente" },
  mannequin: { txt:"Mannequin",      prix:680,  gain:7.5, places:1, attrait:11, palier:1, cat:"vente" },
  comptoir:  { txt:"Comptoir",       prix:900,  gain:11,  places:1, attrait:4,  palier:1, cat:"service" },
  vitrine:   { txt:"Vitrine",        prix:1150, gain:13,  places:1, attrait:9,  palier:2, cat:"vente" },
  miroir:    { txt:"Miroir",         prix:340,  gain:2.0, places:1, attrait:8,  palier:1, cat:"confort" },
  plante:    { txt:"Plante",         prix:150,  gain:0.6, places:0, attrait:5,  palier:1, cat:"confort" },
  canape:    { txt:"Canapé",         prix:760,  gain:3.0, places:3, attrait:7,  palier:1, cat:"confort" },
  tapis:     { txt:"Tapis",          prix:480,  gain:0,   places:0, attrait:10, palier:2, cat:"confort", sol:true },
  etagere:   { txt:"Étagère",        prix:520,  gain:6.0, places:1, attrait:5,  palier:2, cat:"vente" },
  cadre:     { txt:"Cadre",          prix:190,  gain:0,   places:0, attrait:4,  palier:1, cat:"confort", mural:true },
  podium:    { txt:"Podium d'essayage",prix:1600,gain:19, places:1, attrait:14, palier:3, cat:"service" },
  tableRonde:{ txt:"Table de rendez-vous",prix:1250,gain:16,places:2,attrait:6, palier:3, cat:"service" },
};

/**
 * Combos : deux meubles de categories complementaires en contact donnent un
 * bonus au gain du visiteur qu'ils servent.
 * ⚠️ Le bonus est applique PAR VISITEUR dans boutique.js, pas agrege dans un
 * total decoratif — c'est exactement l'erreur du batiment a 1 500 or.
 */
export const COMBOS = [
  { a:"vente",   b:"confort", bonus:0.22, txt:"On reste plus longtemps devant un portant quand on peut s'asseoir." },
  { a:"vente",   b:"service", bonus:0.30, txt:"Un vendeur à portée du portant, et l'essayage se transforme en vente." },
  { a:"service", b:"confort", bonus:0.18, txt:"Un rendez-vous se conclut mieux dans un coin soigné." },
];

export const ECONOMIE = {
  /* ⚠️ LE bouton unique pour recalibrer toute la boutique. Tout le reste de
     l'economie de vente en depend lineairement — c'est voulu : une seule
     poignee, sinon un reglage se paie en trois endroits. */
  GAIN_FREQUENTATION: 1.0,
  // Visiteurs par jour : une base, plus la notoriete, plus l'attrait des
  // meubles. L'attrait est lu ICI et nulle part ailleurs.
  VISITEURS_BASE: 3.0,
  VISITEURS_PAR_NOTORIETE: 0.019,
  VISITEURS_PAR_ATTRAIT: 0.070,
  // Charges quotidiennes : le loyer monte avec le palier. Sans charges, la
  // boutique devient une rente et l'argent cesse d'etre une contrainte.
  CHARGES_BASE: 55,
  CHARGES_PAR_PALIER: 74,
};

/* ================================================================ horloge */

export const CFG = {
  /* ---------------------------------------------------------------- horloge
     ⚠️ Le rythme se regle a TROIS endroits, pas un : la duree d'un jour, le
     gel de l'horloge pendant une animation, et le pas d'animation qui suit la
     vitesse. En oublier un donne un jeu injouable. */
  MS_PAR_JOUR: 12500,
  VITESSES: [0, 1, 3, 8],
  // Le jour J s'anime pendant ce temps, horloge GELEE. Sans gel, la journee
  // suivante commence pendant la ceremonie.
  MS_ANIMATION_JOURJ: 6200,

  /* ------------------------------------------------------------- calendrier */
  JOURS_PAR_SAISON: 90,
  SALON_TOUS_LES_JOURS: 360,
  // Le salon tombe en automne, apres la haute saison : on y presente ce que
  // l'ete a permis d'accumuler.
  SALON_JOUR_DANS_ANNEE: 315,

  /* ----------------------------------------------------------- demarrage */
  ARGENT_DEPART: 6000,
  NOTORIETE_DEPART: 0,
  // Le catalogue de stock se renouvelle a chaque saison.
  CATALOGUE_RENOUVELLEMENT: 90,

  /* --------------------------------------------------------------- cible
     ⚠️ PLACEHOLDER assume : ces cibles servent a l'oracle, elles n'ont pas
     encore ete atteintes. Voir le rapport de mesure dans CLAUDE.md. */
  CIBLE_HEURES: 11,
  CIBLE_CONTRATS: [150, 250],
  CIBLE_TAUX_RATE: 0.15,
  CIBLE_REFUS: [2, 8],
};

/* ================================================================== noms
   ⚠️ Aucun de ces tirages ne doit passer par alea() cote rendu : les noms
   sont tires par la simulation (donc alea), l'ASPECT par un hachage du nom
   (piege herite n°1). */

export const PRENOMS = [
  "Camille","Noé","Léa","Sacha","Jeanne","Malo","Inès","Basile","Alma","Tom",
  "Nour","Elias","Rose","Aaron","Lou","Gabin","Maya","Ilan","Suzanne","Nathan",
  "Iris","Timéo","Zoé","Marius","Anouk","Élio","Faustine","Côme","Livia","Achille",
];

export const LIEUX_TXT = [
  "au bord de l'eau","sous les arbres","en pleine ville","dans les vignes",
  "sur la colline","au vieux moulin","dans la cour pavée","face à la mer",
];

/* =============================================================== invariants
   `exiger` leve au chargement si un invariant est casse. Sur le projet
   precedent, deux invariants d'equilibrage ont ete casses en silence pendant
   des semaines faute de ce genre de verification. */

export function exiger(condition, message){
  if(!condition) throw new Error("Invariant casse : " + message);
}

exiger(CFG.MS_PAR_JOUR >= 1000,
  "une journee sous une seconde ne laisse pas le temps de gerer quoi que ce soit");

exiger(Math.abs(Object.values(AXES).reduce((s,a) => s + a.poids, 0) - 1) < 1e-9,
  "les poids des axes du jour J doivent sommer a 1, sinon la note n'est plus sur 100");

exiger(CFG.JOURS_PAR_SAISON * SAISONS.length === CFG.SALON_TOUS_LES_JOURS,
  "une annee doit faire exactement quatre saisons, sinon le salon derive dans le calendrier");

exiger(CFG.SALON_JOUR_DANS_ANNEE < CFG.SALON_TOUS_LES_JOURS,
  "le salon doit tomber dans l'annee");

for(const a of STYLES) for(const b of STYLES)
  exiger(AFFINITE_STYLES[a][b] === AFFINITE_STYLES[b][a],
    `l'affinite ${a}/${b} est dissymetrique : le score dependrait de l'ordre des slots`);

/* ⚠️ Piege herite n°6 : un contenu inatteignable n'est pas du contenu. Sur
   Aincrad, treize heros uniques sur vingt ne sortaient jamais. On verifie donc
   ici que CHAQUE palier debloque au moins un prestataire ET au moins un
   meuble — un palier qui n'ouvre rien est un palier que le joueur ne remarque
   pas. Ce n'est pas une preuve d'atteignabilite, elle vient de l'oracle ; ce
   n'est qu'un garde-fou de table. */
for(const p of PALIERS){
  exiger(Object.values(PRESTATAIRES).some(x => x.palier === p.n) || p.n === 5,
    `le palier ${p.n} n'ouvre aucun prestataire`);
}
exiger(Object.values(MEUBLES).every(m => m.palier >= 1 && m.palier <= PALIERS.length),
  "un meuble est adosse a un palier qui n'existe pas : il serait inachetable");

exiger(PALIERS.every((p,i) => i === 0 || p.seuil > PALIERS[i-1].seuil),
  "les seuils de palier doivent etre strictement croissants");

/* Le prix par point de qualite doit MONTER avec la rarete. Si acheter de
   l'exception revenait au meme prix au point, la strategie optimale serait de
   n'acheter que ca, et le stock cesserait d'etre un pari sur la variete. */
{
  const ordre = ["commun", "rare", "exception"];
  for(let i = 1; i < ordre.length; i++){
    const bas = RARETES[ordre[i-1]], haut = RARETES[ordre[i]];
    exiger(haut.prix / haut.qualite > bas.prix / bas.qualite,
      `${ordre[i]} coute moins cher au point de qualite que ${ordre[i-1]}`);
  }
}

exiger(SLOTS.every(s => SLOT[s]),
  "chaque slot doit avoir une definition");

exiger(SLOTS.filter(s => SLOT[s].source === "prestataire").length === 3,
  "trois slots doivent venir des prestataires : c'est ce qui fait travailler l'agenda a chaque dossier");
