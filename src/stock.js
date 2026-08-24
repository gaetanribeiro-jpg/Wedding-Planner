/**
 * stock.js — les articles : slot × famille × style × tier × rarete × affixes.
 * Herite d'items.js, mais avec une difference qui change tout : ici une piece
 * n'a pas de valeur absolue. `scorePourCouple` la note POUR UN CLIENT.
 *
 * ⚠️ C'est la decision de design n°4, le coeur du jeu. Toute tentation de
 * classer les pieces « de la meilleure a la pire » est a refuser : elle
 * ramenerait le stock a un simple achat de tier le plus haut possible.
 */

import { alea, pick, tirerPondere, clamp } from "./utils.js";
import { FAMILLES, RARETES, AFFIXES, STOCK, STYLES, STYLE,
         AFFINITE_STYLES, SLOT } from "./config.js";

/* Les compteurs d'id se sauvegardent : sans eux, recharger une partie
   redistribue des identifiants deja pris et les references croisees (un
   dossier qui pointe vers une robe) tombent sur la mauvaise piece. */
let _idArticle = 1;
export const etatIdArticle = () => _idArticle;
export const setIdArticle = n => { _idArticle = n; };

/** Les slots servis par le stock, dans l'ordre d'affichage. */
export const SLOTS_STOCK = Object.keys(FAMILLES);

/**
 * Qualite intrinseque d'une piece, hors client. Elle ne suffit JAMAIS a
 * decider d'un achat — elle ne dit que ce que la piece vaut au mieux.
 */
export function qualiteBrute(a){
  const usure = Math.max(STOCK.USURE_PLANCHER, 1 - a.usages * STOCK.USURE_PAR_USAGE);
  return (STOCK.QUALITE_BASE + STOCK.QUALITE_PAR_TIER * (a.tier - 1))
       * RARETES[a.rarete].qualite * usure;
}

export function prixArticle(slot, famille, tier, rarete){
  return Math.round(
    STOCK.PRIX_BASE[slot]
    * Math.pow(tier, STOCK.PRIX_EXPOSANT)
    * RARETES[rarete].prix
    * FAMILLES[slot][famille].coutMult);
}

/** Ce qu'on recupere en revendant. Volontairement bas : voir config. */
export const prixRevente = a => Math.round(a.prix * STOCK.TAUX_REVENTE);

/**
 * Fabrique un article. `tierMax` borne le catalogue au palier atteint.
 *
 * Le style n'est PAS toujours le style naturel de la famille : une robe
 * princesse peut etre coupee dans un esprit moderne. C'est ce qui evite que
 * « famille » et « style » soient deux noms pour la meme donnee — et donc que
 * le catalogue se reduise a cinq choix.
 */
export function creerArticle(slot, tierMax, opts = {}){
  const famille = opts.famille || pick(Object.keys(FAMILLES[slot]));
  const def = FAMILLES[slot][famille];
  const tier = opts.tier || (1 + Math.floor(alea() * tierMax));
  const rarete = opts.rarete || tirerPondere(RARETES, "poids",
    // Les hauts tiers sortent plus souvent en rare : sinon les pieces
    // d'exception restent theoriques et on retombe sur le piege n°6.
    (k, w) => k === "commun" ? w : w * (1 + (tier - 1) * 0.22));

  // 62 % du temps le style naturel de la famille, sinon un autre : la piece
  // devient une trouvaille pour un client qu'on n'attendait pas.
  const style = opts.style || (alea() < 0.62 ? def.styleNaturel : pick(STYLES));

  const affixes = [];
  const nb = RARETES[rarete].affixes;
  for(let i = 0; i < nb; i++){
    const k = tirerPondere(AFFIXES, "poids",
      (cle, w) => affixes.includes(cle) ? 0 : w);
    if(!affixes.includes(k)) affixes.push(k);
  }

  return {
    id: _idArticle++,
    slot, famille, style, tier, rarete, affixes,
    silhouette: def.silhouette || null,
    prix: prixArticle(slot, famille, tier, rarete),
    usages: 0,
    // Teinte : derivee du style et du tier, JAMAIS tiree — le rendu ne
    // consomme pas alea() (piege herite n°1).
    teinte: teinteArticle(slot, style, tier),
  };
}

/**
 * Couleur d'une piece. Deterministe a partir de ses attributs : deux articles
 * identiques se ressemblent, et surtout le rendu ne decale pas le generateur.
 */
export function teinteArticle(slot, style, tier){
  const nuanciers = {
    robe:       ["#fdf7ee","#f7e6ea","#f2ece2","#efe3f0","#fbf3e6"],
    costume:    ["#33384f","#4a4258","#5f7a9a","#3a4258","#6b5a4a"],
    decoration: ["#e69aa6","#7fa87a","#d8a94a","#a89bb0","#c98aa0"],
  };
  const n = nuanciers[slot];
  const i = (STYLES.indexOf(style) * 2 + tier) % n.length;
  return n[i];
}

export function nomArticle(a){
  const def = FAMILLES[a.slot][a.famille];
  const suffixe = a.affixes.length ? " " + AFFIXES[a.affixes[0]].txt.toLowerCase() : "";
  return `${def.txt}${suffixe}`;
}

/**
 * ⚠️ LE coeur du jeu. Note d'une piece POUR CE COUPLE, sur 100.
 *
 * Deux facteurs seulement, et c'est volontaire : la qualite intrinseque, et
 * l'affinite entre le style de la piece et les gouts du couple. La deuxieme
 * pese assez pour qu'une piece de tier 2 bien choisie batte une piece de
 * tier 4 a cote de la plaque — sinon toute la mecanique de gouts serait
 * decorative.
 */
export function scorePourCouple(a, couple){
  const q = qualiteBrute(a);
  // Les gouts sont sur 100 par style ; on prend l'affinite ponderee.
  let aff = 0, tot = 0;
  for(const s of STYLES){
    const g = couple.gouts[s] || 0;
    aff += g * AFFINITE_STYLES[a.style][s];
    tot += g;
  }
  aff = tot > 0 ? aff / tot : 0.5;          // 0..1
  // Courbe : a 100 % d'affinite on garde toute la qualite, a 30 % on en perd
  // presque la moitie. La pente entre les deux est ce qui rend le pari lisible.
  return clamp(q * (0.42 + 0.58 * aff), 0, 100);
}

/** Bonus d'affixes sur un axe donne du jour J. */
export function bonusAffixes(a, axe){
  let v = 0;
  for(const k of a.affixes){
    const d = AFFIXES[k];
    if(d.axe === axe) v += d.val;
    if(axe === "emotion" && d.bonusEmotion) v += d.bonusEmotion;
  }
  return v;
}

/**
 * Le catalogue d'achat, renouvele a chaque saison.
 *
 * ⚠️ Il est tire par la SIMULATION (donc par alea) et memorise dans l'etat :
 * le regenerer a l'affichage donnerait un catalogue different a chaque
 * ouverture de l'onglet, et la partie cesserait d'etre reproductible.
 */
export const tailleCatalogue = palier =>
  STOCK.CATALOGUE_TAILLE + STOCK.CATALOGUE_PAR_PALIER * (palier - 1);

export function tirerCatalogue(palier){
  const tierMax = clamp(palier, 1, 5);
  const out = [];
  for(let i = 0; i < tailleCatalogue(palier); i++){
    const slot = SLOTS_STOCK[i % SLOTS_STOCK.length];
    out.push(creerArticle(slot, tierMax));
  }
  return out;
}

/** Le stock de depart : de quoi monter un premier dossier, rien de plus. */
export function stockInitial(){
  return [
    creerArticle("robe",       1, { famille:"boheme",     tier:1, rarete:"commun" }),
    creerArticle("robe",       1, { famille:"empire",     tier:1, rarete:"commun" }),
    creerArticle("costume",    1, { famille:"troisPieces",tier:1, rarete:"commun" }),
    creerArticle("decoration", 1, { famille:"guirlandes", tier:1, rarete:"commun" }),
  ];
}

/** Resume lisible d'une piece, pour l'interface et pour les traces d'oracle. */
export function ficheArticle(a){
  return {
    id:a.id, slot:a.slot, nom:nomArticle(a),
    style:a.style, styleTxt:STYLE[a.style].txt,
    tier:a.tier, rarete:a.rarete, rareteTxt:RARETES[a.rarete].txt,
    couleur:RARETES[a.rarete].couleur, teinte:a.teinte,
    qualite:Math.round(qualiteBrute(a)),
    prix:a.prix, usages:a.usages,
    affixes:a.affixes.map(k => AFFIXES[k].txt),
    slotTxt:SLOT[a.slot].txt,
  };
}
