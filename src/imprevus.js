/**
 * imprevus.js — ce qui arrive ENTRE la signature et le jour J.
 *
 * ⚠️ C'est la reponse au defaut le plus important qu'on ait mesure : 0,6 % de
 * mariages rates contre 15 % vises (decision de design n°7 — « il faut des
 * dents »).
 *
 * La cause n'etait pas une constante trop basse. `estimer()` appelle
 * `resoudre()`, la fonction meme du jour J : le joueur pouvait donc PREDIRE sa
 * note au point pres au moment de signer. Monter `EXIGENCE_BASE` ne produisait
 * pas d'echecs — seulement des refus, parce qu'un joueur qui voit d'avance
 * qu'il va rater ne signe pas.
 *
 * Un jeu ne prend des dents que si l'engagement precede l'information. Ces
 * evenements tombent APRES la signature, tires par la simulation. Ils sont
 * donc absents de l'estimation par construction, pas par ruse.
 *
 * ⚠️ Et ils doivent rester JOUABLES : ils frappent avec une marge avant le
 * jour J (`IMPREVUS.MARGE_JOURS`), pour qu'on puisse encore reagir. Un coup
 * dur qui tombe la veille sans recours n'est pas de la tension, c'est de
 * l'arbitraire — et le joueur ne l'apprend pas, il le subit.
 */

import { alea, rnd, tirerPondere } from "./utils.js";
import { IMPREVUS, IMPREVU, SLOTS, SLOT, CLIENTS } from "./config.js";
import * as Presta from "./prestataires.js";
import { parerImprevu } from "./equipe.js";

/**
 * Un dossier subit-il un imprevu aujourd'hui, et lequel ?
 * Rend `null` la plupart du temps. Consomme `alea()` — donc invisible a
 * l'estimation, qui est pure.
 */
export function tirer(ctr, jour, equipe){
  if((ctr.imprevus || []).length >= IMPREVUS.MAX_PAR_DOSSIER) return null;
  // Rien dans les tout derniers jours : il faut pouvoir encore corriger.
  if(ctr.jourJ - jour <= IMPREVUS.MARGE_JOURS) return null;

  // Un coordinateur amortit les coups durs. C'est la lecture de son role —
  // sans elle, il ne servirait qu'a l'affichage (piege herite n°2).
  const chance = IMPREVUS.CHANCE_PAR_JOUR * (1 - parerImprevu(equipe, jour));
  if(alea() > chance) return null;

  return tirerPondere(IMPREVU, "poids");
}

/**
 * Applique l'imprevu au dossier. Rend de quoi le raconter au joueur.
 *
 * `etatPrestas` est passe en argument plutot que lu dans un etat global : ce
 * module doit rester appelable depuis l'oracle, qui ne monte pas `G`.
 */
export function appliquer(cle, ctr, jour, etatPrestas){
  const d = IMPREVU[cle];
  const couple = ctr.couple;
  const ev = { cle, jour, txt:d.txt, detail:d.detail, effet:"" };

  if(cle === "defection"){
    // Un prestataire deja reserve se decommande. On libere sa date : le slot
    // redevient vide, et le joueur doit retrouver quelqu'un de libre.
    const pris = SLOTS.filter(s => SLOT[s].source === "prestataire" && ctr.choix[s]);
    if(!pris.length) return null;                 // rien a annuler : pas d'evenement
    const slot = pris[Math.floor(alea() * pris.length)];
    const cle2 = ctr.choix[slot];
    Presta.liberer(etatPrestas, cle2, ctr.jourJ);
    ctr.depense -= Presta.prixPresta(etatPrestas, cle2, couple.invites, couple.echelle);
    ctr.choix[slot] = null;
    ev.slot = slot;
    ev.effet = `${SLOT[slot].txt} à refaire`;

  }else if(cle === "invitesEnPlus"){
    const enPlus = Math.max(4, Math.round(couple.invites * rnd(d.PART_MIN, d.PART_MAX)));
    couple.invites += enPlus;
    // Le traiteur se refacture par tete : la depense engagee monte toute seule.
    if(ctr.choix.traiteur){
      const avant = ctr.depense;
      ctr.depense = SLOTS.reduce((t, s) =>
        t + (SLOT[s].source === "prestataire" && ctr.choix[s]
             ? Presta.prixPresta(etatPrestas, ctr.choix[s], couple.invites, couple.echelle) : 0), 0);
      ev.surcout = Math.max(0, Math.round(ctr.depense - avant));
    }
    ev.effet = `+${enPlus} invités`;

  }else if(cle === "exigenceMontee"){
    const m = Math.round(rnd(d.MIN, d.MAX));
    couple.exigence += m;
    ev.effet = `ils en attendent plus`;

  }else if(cle === "budgetCoupe"){
    const coupe = Math.round(couple.budget * rnd(d.PART_MIN, d.PART_MAX));
    couple.budget = Math.max(CLIENTS.BUDGET_PLANCHER, couple.budget - coupe);
    ev.effet = `−${coupe} € de budget`;

  }else if(cle === "pieceAbimee"){
    // On note l'usure sur le dossier : state.js l'applique a l'article, parce
    // que c'est lui qui tient le stock. Ce module ne connait pas `G`.
    const pris = SLOTS.filter(s => SLOT[s].source === "stock" && ctr.choix[s]);
    if(!pris.length) return null;
    const slot = pris[Math.floor(alea() * pris.length)];
    ev.slot = slot;
    ev.articleId = ctr.choix[slot];
    ev.usures = d.USURES;
    ev.effet = `la ${SLOT[slot].txt.toLowerCase()} a souffert`;
  }

  (ctr.imprevus ||= []).push(ev);
  return ev;
}

/**
 * L'exigence telle que le COUPLE l'annonce : une fourchette, jamais le
 * chiffre exact.
 *
 * ⚠️ Sans ce flou, meme avec des imprevus, un joueur calculerait sa marge au
 * point pres et ne raterait que par malchance franche. La fourchette rend la
 * decision de signer reellement incertaine — et c'est ce qui donne son prix au
 * refus (decision de design n°5).
 *
 * Elle est DERIVEE du couple (donc stable d'un affichage a l'autre) et ne
 * consomme aucun tirage : deux ouvertures de la meme fiche donnent la meme
 * fourchette, sinon le joueur n'aurait qu'a rouvrir pour affiner.
 */
export function fourchetteExigence(couple, flou){
  const marge = Math.max(flou.MIN, Math.round(couple.exigenceInitiale * flou.PART));
  // Le decalage vient du couple, pas d'un tirage : stable et non rejouable.
  const biais = (couple.id % 7) - 3;
  const centre = couple.exigenceInitiale + biais;
  return { min: Math.max(0, centre - marge), max: centre + marge };
}

export const nbImprevus = ctr => (ctr.imprevus || []).length;

/** Les imprevus d'un dossier, pour l'interface. */
export const listeImprevus = ctr => (ctr.imprevus || []).map(e => ({
  txt: e.txt, detail: e.detail, effet: e.effet, jour: e.jour,
}));
