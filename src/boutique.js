/**
 * boutique.js — la grille, les meubles, et l'ECONOMIE PAR FREQUENTATION.
 * Herite de town.js. C'est l'ecran d'accueil du jeu : il ne se fait jamais
 * voler par le jour J, qui s'annonce par un bandeau (decision de design n°8).
 *
 * Le modele en une phrase : des visiteurs entrent chaque jour, chacun cherche
 * une PLACE libre a un meuble, et depense le gain de ce meuble.
 *
 * ⚠️ Piege herite n°4, celui qui a coute le plus cher : un plafond verifie sur
 * une seule voie n'est pas un plafond. Ici le plafond, ce sont les places, et
 * elles sont consommees dans `journee()` — la seule fonction qui sert
 * reellement les visiteurs. Le symptome a surveiller est traitre : quand plus
 * aucun reglage n'a d'effet mesurable, ne cherche pas la bonne valeur, cherche
 * ce qui court-circuite la contrainte.
 */

import { alea, clamp } from "./utils.js";
import { MEUBLES, COMBOS, ECONOMIE, BOUTIQUE, SAISON } from "./config.js";

export function boutiqueInitiale(){
  return {
    l: BOUTIQUE.LARGEUR,
    h: BOUTIQUE.HAUTEUR,
    // Chaque meuble : { cle, gx, gy }. Le sol et les murs ne sont pas des
    // meubles : ils appartiennent au decor et ne rapportent rien.
    meubles: [
      { cle:"portant",   gx:0, gy:0 },
      { cle:"comptoir",  gx:8, gy:4 },
      { cle:"miroir",    gx:0, gy:5 },
    ],
  };
}

export const defMeuble = cle => MEUBLES[cle];

/** Emprise d'un meuble : une case. Les tapis et les cadres n'occupent rien. */
export const occupeLeSol = cle => !MEUBLES[cle].sol && !MEUBLES[cle].mural;

export function meubleEn(b, gx, gy){
  return b.meubles.find(m => m.gx === gx && m.gy === gy && occupeLeSol(m.cle)) || null;
}

/**
 * ⚠️ La verification de placement vit ICI, et c'est cette fonction que
 * l'interface ET l'oracle appellent. Un controle fait seulement dans le
 * catalogue affiche laisserait l'oracle batir n'importe ou et mesurer une
 * boutique que personne ne peut construire (piege herite n°5).
 */
export function peutPlacer(b, cle, gx, gy, palier, argent){
  const d = MEUBLES[cle];
  if(!d) return { ok:false, txt:"meuble inconnu" };
  if(d.palier > palier) return { ok:false, txt:"pas encore débloqué" };
  if(argent < d.prix) return { ok:false, txt:"pas assez d'argent" };
  if(gx < 0 || gy < 0 || gx >= b.l || gy >= b.h) return { ok:false, txt:"hors de la boutique" };
  if(occupeLeSol(cle) && meubleEn(b, gx, gy)) return { ok:false, txt:"case occupée" };
  return { ok:true };
}

export function placer(b, cle, gx, gy){
  b.meubles.push({ cle, gx, gy });
}

export function retirer(b, gx, gy){
  const i = b.meubles.findIndex(m => m.gx === gx && m.gy === gy);
  if(i < 0) return null;
  return b.meubles.splice(i, 1)[0];
}

/* ------------------------------------------------------------- attrait */

/**
 * L'attrait total decide du NOMBRE de visiteurs. Il est lu ici et nulle part
 * ailleurs.
 * ⚠️ Piege herite n°2 : avant d'ajouter un effet, verifier qu'il est lu par
 * autre chose que l'agregation et l'affichage. `attrait` l'est par
 * `visiteursDuJour`, `gain` et `places` par `journee`. Un champ de plus doit
 * gagner sa place de la meme facon.
 */
export const attraitTotal = b =>
  b.meubles.reduce((s, m) => s + MEUBLES[m.cle].attrait, 0);

export const placesTotales = b =>
  b.meubles.reduce((s, m) => s + MEUBLES[m.cle].places, 0);

export function visiteursDuJour(b, notoriete, saison){
  const brut = (ECONOMIE.VISITEURS_BASE
              + notoriete * ECONOMIE.VISITEURS_PAR_NOTORIETE
              + attraitTotal(b) * ECONOMIE.VISITEURS_PAR_ATTRAIT)
             * SAISON[saison].frequentation;
  const entier = Math.floor(brut);
  return entier + (alea() < (brut - entier) ? 1 : 0);
}

/* -------------------------------------------------------------- combos */

const VOISINS = [[1,0],[-1,0],[0,1],[0,-1]];

/**
 * Bonus de combo d'un meuble : somme des bonus des paires de categories
 * formees avec ses voisins immediats.
 *
 * ⚠️ Ce bonus est applique PAR VISITEUR dans `journee()`. Le calculer une fois
 * pour l'afficher dans un panneau « bonus de la boutique » sans jamais le lire
 * au moment de servir, c'est exactement le batiment a 1 500 or dont l'effet
 * etait strictement nul.
 */
export function comboDe(b, m){
  const catA = MEUBLES[m.cle].cat;
  let bonus = 0;
  const vus = new Set();
  for(const [dx, dy] of VOISINS){
    const v = meubleEn(b, m.gx + dx, m.gy + dy);
    if(!v) continue;
    const catB = MEUBLES[v.cle].cat;
    const c = COMBOS.find(x => (x.a === catA && x.b === catB) || (x.a === catB && x.b === catA));
    // Une meme paire de categories ne compte qu'une fois : sinon, entourer un
    // comptoir de quatre canapes donnerait quatre fois le meme bonus et la
    // boutique se reduirait a un seul motif.
    if(c && !vus.has(c.txt)){ vus.add(c.txt); bonus += c.bonus; }
  }
  return bonus;
}

/** Les combos actifs, pour l'affichage. Derive de comboDe, jamais l'inverse. */
export function combosActifs(b){
  const out = new Map();
  for(const m of b.meubles){
    const catA = MEUBLES[m.cle].cat;
    for(const [dx, dy] of VOISINS){
      const v = meubleEn(b, m.gx + dx, m.gy + dy);
      if(!v) continue;
      const catB = MEUBLES[v.cle].cat;
      const c = COMBOS.find(x => (x.a === catA && x.b === catB) || (x.a === catB && x.b === catA));
      if(c) out.set(c.txt, c);
    }
  }
  return [...out.values()];
}

/* -------------------------------------------------------------- journee */

/**
 * Une journee de boutique. Retourne le detail, pas seulement le total :
 * `servis` et `refoules` sont ce qui permet de VOIR le plafond des places.
 * Sans ces deux nombres, un joueur qui double son attrait sans ajouter de
 * place ne comprend pas pourquoi rien ne bouge.
 */
export function journee(b, notoriete, saison, palier){
  const visiteurs = visiteursDuJour(b, notoriete, saison);

  // Les places restantes, meuble par meuble. C'est le plafond, et il est
  // consomme ici — la seule voie qui sert un visiteur.
  const libres = b.meubles.map(m => MEUBLES[m.cle].places);
  const servables = b.meubles
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => MEUBLES[m.cle].places > 0);

  let recette = 0, servis = 0, refoules = 0;
  for(let v = 0; v < visiteurs; v++){
    // Le visiteur va au premier meuble libre en partant d'un point tire :
    // un balayage toujours dans le meme ordre remplirait d'abord le meuble
    // pose en premier, et l'ordre de construction changerait l'economie.
    const depart = Math.floor(alea() * Math.max(1, servables.length));
    let sert = null;
    for(let k = 0; k < servables.length; k++){
      const cand = servables[(depart + k) % servables.length];
      if(libres[cand.i] > 0){ sert = cand; break; }
    }
    if(!sert){ refoules++; continue; }
    libres[sert.i]--;
    servis++;
    recette += MEUBLES[sert.m.cle].gain
             * (1 + comboDe(b, sert.m))
             * ECONOMIE.GAIN_FREQUENTATION;
  }

  const charges = ECONOMIE.CHARGES_BASE + ECONOMIE.CHARGES_PAR_PALIER * (palier - 1);
  return {
    visiteurs, servis, refoules,
    recette: Math.round(recette),
    charges: Math.round(charges),
    net: Math.round(recette - charges),
  };
}

/** Ce que le catalogue propose au palier atteint. */
export function catalogueMeubles(palier){
  return Object.keys(MEUBLES)
    .filter(k => MEUBLES[k].palier <= palier)
    .map(k => ({ cle:k, ...MEUBLES[k] }));
}

/** Diagnostic affiche au joueur : dit ce qui bride la boutique, en une phrase. */
export function diagnostic(b, dernier){
  if(!dernier) return "";
  if(dernier.refoules > 0)
    return `${dernier.refoules} visiteur${dernier.refoules > 1 ? "s" : ""} `
         + `repart${dernier.refoules > 1 ? "ent" : ""} sans être servi${dernier.refoules > 1 ? "s" : ""} : `
         + `il manque des places, pas de l'attrait.`;
  const places = placesTotales(b);
  if(dernier.visiteurs < places * 0.6)
    return `Des places libres toute la journée : c'est l'attrait qui manque, pas la capacité.`;
  return `La boutique tourne à plein.`;
}

export const clampGrille = (b, gx, gy) =>
  ({ gx: clamp(gx, 0, b.l - 1), gy: clamp(gy, 0, b.h - 1) });
