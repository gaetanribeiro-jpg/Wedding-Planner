/**
 * clients.js — les couples, leurs gouts, leurs budgets, leurs contrats.
 * Herite de heroes.js : un couple est a ce jeu ce qu'un heros etait a
 * Aincrad, sauf qu'on ne l'ameliore pas — on le SATISFAIT, une fois.
 *
 * ⚠️ Decision de design n°5 : on peut refuser un contrat. Refuser coute de la
 * notoriete, mais evite un mariage rate. Sans cette porte de sortie, la seule
 * strategie serait de tout signer et le jeu perdrait sa decision principale.
 */

import { alea, rnd, pick, clamp } from "./utils.js";
import { CLIENTS, PALIERS, STYLES, STYLE, PRENOMS, LIEUX_TXT,
         SAISON, SLOTS, SLOT, EXIGENCE_FLOU } from "./config.js";
import { bonusCapacite, bonusProspects } from "./equipe.js";
import { fourchetteExigence } from "./imprevus.js";

let _idCouple = 1;
export const etatIdCouple = () => _idCouple;
export const setIdCouple = n => { _idCouple = n; };

/**
 * Les gouts d'un couple : un dominant fort, un secondaire, deux residus.
 *
 * ⚠️ Des gouts plats rendraient toutes les pieces equivalentes. Le dominant
 * doit vraiment dominer, sinon la decision n°4 devient decorative — c'est le
 * meme piege que les cinq silhouettes de robe qui se ressemblaient.
 */
function tirerGouts(){
  const ordre = [...STYLES];
  // Melange de Fisher-Yates sur alea : la simulation seule tire.
  for(let i = ordre.length - 1; i > 0; i--){
    const j = Math.floor(alea() * (i + 1));
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }
  const g = {};
  g[ordre[0]] = Math.round(rnd(...CLIENTS.GOUT_DOMINANT));
  g[ordre[1]] = Math.round(rnd(...CLIENTS.GOUT_SECOND));
  g[ordre[2]] = Math.round(rnd(...CLIENTS.GOUT_RESTE));
  g[ordre[3]] = Math.round(rnd(...CLIENTS.GOUT_RESTE));
  return g;
}

export const styleDominant = couple =>
  STYLES.reduce((a, b) => couple.gouts[b] > couple.gouts[a] ? b : a, STYLES[0]);

/**
 * Un prospect se presente. Son ambition suit le palier du joueur : au palier 1
 * on marie le quartier, au palier 5 on marie une principaute.
 */
export function creerProspect(jour, palier, saison){
  const p = PALIERS[palier - 1];
  const invitesMin = Math.round(p.invitesMax * 0.35);
  const invites = Math.round(rnd(invitesMin, p.invitesMax));

  // Deux prenoms distincts : un couple homonyme se lit comme un bug.
  const a = pick(PRENOMS);
  let b = pick(PRENOMS);
  for(let i = 0; i < 6 && b === a; i++) b = pick(PRENOMS);

  const budget = Math.max(CLIENTS.BUDGET_PLANCHER,
    Math.round(invites * CLIENTS.BUDGET_PAR_INVITE * p.budgetMult * rnd(0.82, 1.24)));

  // Le delai jusqu'au jour J. Il est court par principe : le contrat est
  // l'unite de jeu, pas la saison (decision n°1).
  const delai = Math.round(rnd(CLIENTS.DELAI_MIN, CLIENTS.DELAI_MAX));
  const exigence = Math.round(CLIENTS.EXIGENCE_BASE
                 + CLIENTS.EXIGENCE_PAR_PALIER * (palier - 1) * rnd(0.8, 1.2));

  return {
    id: _idCouple++,
    nomA: a, nomB: b,
    gouts: tirerGouts(),
    invites, budget,
    // L'AMBITION du couple : ce que les prestataires lisent avant de chiffrer.
    // ⚠️ Elle est FIGEE a la creation, comme le budget. La deriver du palier
    // courant ferait renchérir un devis deja signe des que le joueur monte
    // d'un palier — et le dossier basculerait en depassement sans qu'on y
    // touche.
    echelle: p.budgetMult,
    lieuTxt: pick(LIEUX_TXT),
    // Exigence : le seuil sous lequel ils sont decus. Il monte avec le palier,
    // donc un dossier qui passait au palier 1 rate au palier 4.
    // ⚠️ `exigence` est le chiffre VRAI, et il n'est jamais affiche tel quel :
    // le couple n'en annonce qu'une fourchette (voir imprevus.js). Sans ce
    // flou, le joueur calcule sa marge au point pres et ne rate jamais.
    // `exigenceInitiale` sert de base a la fourchette : elle ne bouge pas
    // quand un imprevu fait monter l'exigence, sinon la fourchette trahirait
    // l'imprevu — et le joueur saurait sans avoir eu a le decouvrir.
    exigence,
    exigenceInitiale: exigence,
    // Jour J vise s'ils signent aujourd'hui.
    jourJPrevu: jour + delai,
    // Ils ne patientent pas : au bout de PATIENCE_JOURS, ils vont voir ailleurs.
    apparuLe: jour,
    expireLe: jour + CLIENTS.PATIENCE_JOURS,
    saisonArrivee: saison,
  };
}

/** Nom d'affichage du couple. */
export const nomCouple = c => `${c.nomA} & ${c.nomB}`;

/**
 * Signer : le prospect devient un contrat, avec ses six emplacements vides.
 * Le jour J est FIXE a la signature — decaler une date apres coup casserait
 * toutes les reservations de prestataires deja posees.
 */
export function signer(couple, jour){
  return {
    id: couple.id,
    couple,
    signeLe: jour,
    jourJ: couple.jourJPrevu,
    // Les six emplacements. `stock` porte un id d'article, `prestataire` une
    // cle de prestataire : deux natures, deux mecaniques.
    choix: Object.fromEntries(SLOTS.map(s => [s, null])),
    depense: 0,
    resolu: null,
  };
}

/** Ce qui a ete engage sur un dossier, en euros. */
export const budgetRestant = ctr => ctr.couple.budget - ctr.depense;

/** Part du dossier remplie : sert au bandeau de preparation. */
export function preparation(ctr){
  const remplis = SLOTS.filter(s => ctr.choix[s]).length;
  return remplis / SLOTS.length;
}

/**
 * Combien de contrats on peut mener de front.
 *
 * ⚠️ C'est LA contrainte de la haute saison (decision de design n°3). Elle
 * doit etre verifiee dans la fonction qui SIGNE, pas seulement affichee sur la
 * liste des prospects : le piege herite n°5 dit qu'un deblocage controle a
 * l'affichage seulement se contourne des que l'oracle joue.
 */
export const capacite = (palier, equipe = [], jour = 0) =>
  CLIENTS.CAPACITE_BASE
  + CLIENTS.CAPACITE_PAR_PALIER * (palier - 1)
  // Un coordinateur porte un dossier de plus. C'est la lecture de son role —
  // sans elle il ne serait qu'une ligne sur une fiche (piege herite n°2).
  + bonusCapacite(equipe, jour);

/**
 * Arrivees du jour. Le flux monte avec la notoriete et explose en ete.
 * Retourne un nombre entier de prospects : la fraction est jouee au sort,
 * sinon le flux serait une marche d'escalier au lieu d'une courbe.
 */
export function arriveesDuJour(notoriete, saison, boucheAOreille = 0,
                               equipe = [], jour = 0){
  const taux = (CLIENTS.PROSPECTS_PAR_JOUR
              + notoriete * CLIENTS.PROSPECT_PAR_NOTORIETE
              + boucheAOreille
              // L'attache de presse fait venir du monde : sa lecture est ici.
              + bonusProspects(equipe, jour))
             * SAISON[saison].prospects;
  const entier = Math.floor(taux);
  return entier + (alea() < (taux - entier) ? 1 : 0);
}

/** Fiche lisible d'un couple, pour l'interface et les traces d'oracle. */
export function ficheCouple(c){
  const f = fourchetteExigence(c, EXIGENCE_FLOU);
  return {
    id:c.id, nom:nomCouple(c), invites:c.invites, budget:c.budget,
    // ⚠️ Jamais `c.exigence` : le joueur n'a droit qu'a la fourchette.
    exigenceMin:f.min, exigenceMax:f.max, lieuTxt:c.lieuTxt,
    dominant:styleDominant(c), dominantTxt:STYLE[styleDominant(c)].txt,
    gouts:STYLES.map(s => [STYLE[s].txt, c.gouts[s], STYLE[s].couleur]),
  };
}

/** Les emplacements d'un dossier, dans l'ordre, avec leur source. */
export const slotsDuDossier = () =>
  SLOTS.map(s => ({ cle:s, txt:SLOT[s].txt, source:SLOT[s].source }));

/** Borne haute d'un budget raisonnable pour un slot : sert a l'IA de l'oracle. */
export function budgetParSlot(couple, slot){
  return Math.round(couple.budget * SLOT[slot].poids / SLOTS.reduce(
    (s, k) => s + SLOT[k].poids, 0));
}

export const clampGout = v => clamp(v, 0, 100);
