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
import { MEUBLES, COMBOS, ECONOMIE, BOUTIQUE, SAISON, VENTE } from "./config.js";
import { bonusPlaces, bonusChanceVente } from "./equipe.js";

export function boutiqueInitiale(){
  return {
    l: BOUTIQUE.LARGEUR,
    h: BOUTIQUE.HAUTEUR,
    /* Chaque meuble : { cle, gx, gy }. Le sol et les murs ne sont pas des
       meubles : ils appartiennent au decor et ne rapportent rien.

       ⚠️ ON DEMARRE SUR UNE PIECE VIDE. Trois meubles poses d'avance
       repondaient a la premiere question du jeu — « qu'est-ce que je mets, et
       ou ? » — avant que le joueur ait pu se la poser. Une boutique vide la
       lui rend, et le premier jour sans une seule place servie enseigne le
       plafond des places mieux qu'un texte.
       Consequence a garder en tete : au jour 1, TOUS les visiteurs repartent.
       C'est voulu, et c'est mesure — la completion reste a 100 %. */
    meubles: [],
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
 * Chance qu'un visiteur reparte avec cette piece.
 *
 * ⚠️ Les pieces cheres se vendent MAL au comptoir : le quartier n'a pas le
 * budget d'une piece d'exception. C'est ce qui empeche la boutique de se vider
 * de ses meilleurs atouts toute seule — le joueur garde ses tiers hauts pour
 * les mariages parce que le marche ne les prend pas, pas parce qu'une regle
 * le lui interdit.
 */
export function chanceVente(a, attrait, bonusEquipe){
  const usure = a.usages * VENTE.DECOTE_USAGE;
  return clamp(VENTE.CHANCE_BASE
             + attrait * VENTE.CHANCE_PAR_ATTRAIT
             + bonusEquipe
             + usure                                   // le solde part vite
             - (a.tier - 1) * VENTE.MALUS_PAR_TIER,
             0.01, 0.85);
}

/** Prix de vente au detail : le prix catalogue plus la marge, moins l'usure. */
export const prixVente = a =>
  Math.round(a.prix * VENTE.MARGE * (1 - a.usages * VENTE.DECOTE_USAGE));

/**
 * Une journee de boutique.
 *
 * ⚠️ L'ARGENT NE MONTE PAS TOUT SEUL. Un visiteur servi a un meuble de VENTE
 * peut repartir avec une piece du stock : la recette est alors adossee a une
 * marchandise reelle, qui QUITTE le stock. Les meubles de service et de
 * confort ne vendent pas — ils font rester, ce qui est deja un metier.
 *
 * C'est ce qui met le stock sous tension : chaque piece est a la fois une
 * vente possible aujourd'hui et un atout possible pour un mariage. Garder ou
 * vendre devient une decision.
 *
 * `vendables` est la liste des articles NON engages sur un dossier. Le filtre
 * se fait chez l'appelant, qui seul connait les contrats — mais la regle est
 * verifiee ici aussi, parce que c'est ici qu'on vend (piege herite n°5).
 *
 * Retourne le detail, pas seulement le total : `servis` et `refoules` sont ce
 * qui permet de VOIR le plafond des places.
 */
export function journee(b, notoriete, saison, palier, opts = {}){
  const equipe = opts.equipe || [];
  const jour = opts.jour || 0;
  const vendables = opts.vendables || [];
  const engages = opts.engages || new Set();

  const visiteurs = visiteursDuJour(b, notoriete, saison);
  const attrait = attraitTotal(b);
  const bonusV = bonusChanceVente(equipe, jour);

  // Les places restantes, meuble par meuble. C'est le plafond, et il est
  // consomme ici — la seule voie qui sert un visiteur. Un vendeur en ajoute :
  // c'est la lecture de son role.
  const libres = b.meubles.map(m => MEUBLES[m.cle].places);
  const servables = b.meubles
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => MEUBLES[m.cle].places > 0);
  let renfort = bonusPlaces(equipe, jour);
  for(let i = 0; i < libres.length && renfort > 0; i++){
    if(libres[i] > 0){ libres[i]++; renfort--; }
  }

  let recette = 0, servis = 0, refoules = 0;
  const vendus = [];
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

    const def = MEUBLES[sert.m.cle];
    const combo = 1 + comboDe(b, sert.m);

    // Le service rendu : conseil, essayage, retouches. C'est le petit flux.
    recette += def.gain * combo * ECONOMIE.GAIN_FREQUENTATION;

    // Et parfois, la vente. Elle ne se produit qu'aux meubles de VENTE.
    if(def.cat !== "vente" || !vendables.length) continue;
    const a = vendables[Math.floor(alea() * vendables.length)];
    if(engages.has(a.id)) continue;               // promise a un dossier
    if(alea() > chanceVente(a, attrait, bonusV)) continue;
    recette += prixVente(a) * combo;
    vendus.push(a.id);
    // On ne vend pas deux fois la meme piece dans la journee.
    const j = vendables.indexOf(a);
    if(j >= 0) vendables.splice(j, 1);
  }

  // ⚠️ Les charges suivent la boutique qu'on TIENT, pas le palier atteint :
  // c'est ce qui rend la faillite reversible (voir ECONOMIE dans config.js).
  const charges = ECONOMIE.CHARGES_BASE + ECONOMIE.CHARGES_PAR_MEUBLE * b.meubles.length;
  return {
    visiteurs, servis, refoules,
    vendus,
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
  if(!dernier.vendus || !dernier.vendus.length)
    return `Personne n'a rien acheté : il faut du stock à vendre, et des meubles de vente pour le présenter.`;
  return `La boutique tourne à plein.`;
}

export const clampGrille = (b, gx, gy) =>
  ({ gx: clamp(gx, 0, b.l - 1), gy: clamp(gy, 0, b.h - 1) });
