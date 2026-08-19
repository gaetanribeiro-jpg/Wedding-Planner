/**
 * joueur.mjs — la politique de jeu que l'oracle applique.
 *
 * ⚠️ Piege herite n°5, celui qui invalide silencieusement une mesure :
 * L'ORACLE DOIT FAIRE LE MEME GESTE QUE LE JOUEUR. Si le joueur peut libérer
 * une place, acheter un type de meuble ou equiper a la main, l'IA de test doit
 * le faire aussi — sinon elle mesure une partie que personne ne joue.
 *
 * Concretement : ce fichier n'a le droit d'appeler QUE les fonctions d'action
 * exportees par state.js (`signerProspect`, `acheterArticle`, `poserMeuble`,
 * `choisirPour`, `reglerSalon`…). Il ne touche jamais `G` directement. Si une
 * regle manque a une de ces fonctions, l'oracle la subit comme le joueur.
 *
 * Ce fichier vit dans tools/ et non dans src/ : ce n'est pas du jeu, c'est de
 * la mesure. Le jeu n'en depend pas.
 */

import * as S from "../src/state.js";
import { SLOTS, SLOT, MEUBLES, PALIERS, STYLES, AFFINITE_STYLES,
         SALON as CFG_SALON, CFG, REFUS } from "../src/config.js";
import { scorePourCouple } from "../src/stock.js";
import { disponiblesAuPalier, estLibre, prixPresta,
         scorePrestaPourCouple } from "../src/prestataires.js";
import { capacite } from "../src/clients.js";
import { resoudre } from "../src/mariage.js";

/* Reserve de tresorerie : l'IA ne depense pas jusqu'au dernier euro, comme un
   joueur qui garde de quoi payer ses charges. Sans reserve, elle tombe a
   decouvert des la premiere basse saison et la mesure ne dit plus rien. */
const RESERVE = (palier) => 1200 + palier * 900;
const CARNET_MARGE = REFUS.CARNET_MARGE;

/* ------------------------------------------------------------- le dossier */

/**
 * Remplit un dossier au mieux, dans l'ordre des emplacements les plus lourds.
 * Le budget est reparti par slot : depenser tout sur la robe et laisser le
 * traiteur vide est une strategie perdante, et l'IA doit pouvoir l'eviter
 * comme un joueur le ferait.
 */
export function remplirDossier(G, ctr){
  const couple = ctr.couple;
  const poidsTot = SLOTS.reduce((s, k) => s + SLOT[k].poids, 0);

  for(const slot of [...SLOTS].sort((a, b) => SLOT[b].poids - SLOT[a].poids)){
    if(ctr.choix[slot]) continue;
    const enveloppe = couple.budget * SLOT[slot].poids / poidsTot;

    if(SLOT[slot].source === "stock"){
      // On ne paie rien : la piece est deja au stock. Le seul critere est
      // donc la note POUR CE COUPLE — exactement la decision n°4.
      const libres = G.stock.filter(a =>
        a.slot === slot &&
        !G.contrats.some(c => c.choix[slot] === a.id));
      if(!libres.length) continue;
      const best = libres.reduce((x, y) =>
        scorePourCouple(y, couple) > scorePourCouple(x, couple) ? y : x);
      S.choisirPour(G, ctr.id, slot, best.id);
      continue;
    }

    // Prestataire : il faut qu'il soit libre CE JOUR-LA et dans l'enveloppe.
    const cands = disponiblesAuPalier(slot, G.palier)
      .filter(k => estLibre(G.prestas, k, ctr.jourJ))
      .map(k => ({ k,
        prix: prixPresta(G.prestas, k, couple.invites),
        note: scorePrestaPourCouple(k, couple) }))
      .filter(x => x.prix <= enveloppe * 1.35
                && ctr.depense + x.prix <= couple.budget);
    if(!cands.length) continue;
    // Meilleure note par euro : c'est le critere qu'un joueur applique quand
    // il a un budget et pas un chequier.
    const best = cands.reduce((x, y) =>
      (y.note / Math.max(1, y.prix)) > (x.note / Math.max(1, x.prix)) ? y : x);
    S.choisirPour(G, ctr.id, slot, best.k);
  }
}

/* ------------------------------------------------------- signer ou refuser */

/**
 * Estimation de la note qu'on ferait sur ce dossier.
 *
 * ⚠️ Premiere version ratee, et la lecon vaut d'etre gardee : elle faisait la
 * moyenne des meilleures pieces par emplacement. Elle annoncait 30 la ou le
 * jour J en donnait 50 — parce que la note ne se lit pas sur les pieces mais
 * sur QUATRE AXES ponderes, dont la coherence et le budget, qui n'ont rien a
 * voir avec la qualite moyenne du stock. Resultat : l'IA ne signait aucun
 * contrat, et la mesure disait « 0 contrat en 4 000 jours » — un chiffre juste
 * sur une partie qui n'existe pas.
 *
 * La version correcte monte un dossier VIRTUEL et le passe a `resoudre`, la
 * fonction meme du jour J. C'est possible parce que `resoudre` est pure : elle
 * ne consomme pas alea() et ne touche a rien. Deux estimations differentes de
 * la meme chose finissent toujours par diverger ; il ne doit y en avoir qu'une.
 */
export function estimer(G, couple){
  const jourJ = couple.jourJPrevu;
  const virtuel = { id:-1, couple, jourJ,
                    choix:Object.fromEntries(SLOTS.map(s => [s, null])), depense:0 };
  const parId = Object.fromEntries(G.stock.map(a => [a.id, a]));
  const poidsTot = SLOTS.reduce((s, k) => s + SLOT[k].poids, 0);

  for(const slot of SLOTS){
    if(SLOT[slot].source === "stock"){
      const libres = G.stock.filter(a => a.slot === slot &&
        !G.contrats.some(c => c.choix[slot] === a.id));
      if(!libres.length) continue;
      virtuel.choix[slot] = libres.reduce((x, y) =>
        scorePourCouple(y, couple) > scorePourCouple(x, couple) ? y : x).id;
    }else{
      const enveloppe = couple.budget * SLOT[slot].poids / poidsTot;
      const cands = disponiblesAuPalier(slot, G.palier)
        .filter(k => estLibre(G.prestas, k, jourJ))
        .map(k => ({ k, prix:prixPresta(G.prestas, k, couple.invites),
                     note:scorePrestaPourCouple(k, couple) }))
        .filter(x => x.prix <= enveloppe * 1.35
                  && virtuel.depense + x.prix <= couple.budget);
      if(!cands.length) continue;
      const best = cands.reduce((x, y) =>
        (y.note / Math.max(1, y.prix)) > (x.note / Math.max(1, x.prix)) ? y : x);
      virtuel.choix[slot] = best.k;
      virtuel.depense += best.prix;
    }
  }
  return resoudre(virtuel, parId).note;
}

/**
 * Signer, refuser, ou laisser mijoter.
 *
 * Les trois branches doivent EXISTER dans la mesure, sinon on ne mesure pas le
 * jeu qu'on a ecrit. En particulier le refus : il ne se justifie que parce
 * qu'il libere une place du carnet tout de suite. L'IA ne refuse donc que
 * lorsque le carnet est plein — exactement le moment ou un joueur le ferait.
 */
export function deciderProspects(G){
  const marge = 8;
  const carnetPlein = G.prospects.length >= capacite(G.palier) + CARNET_MARGE;

  // Les meilleurs d'abord : signer le bon dossier avant de remplir la capacite
  // avec le premier venu, c'est le geste de base du jeu.
  const classes = G.prospects
    .map(p => ({ p, est: estimer(G, p) }))
    .sort((a, b) => (b.est - b.p.exigence) - (a.est - a.p.exigence));

  for(const { p, est } of classes){
    if(S.capaciteRestante(G) <= 0) break;
    if(est >= p.exigence + marge) S.signerProspect(G, p.id);
  }

  if(!carnetPlein) return;
  // Carnet sature : on fait le menage par le bas. Refuser coute de la
  // notoriete (decision n°5) mais rend la place a un couple qu'on saura
  // servir. Ne rien faire la bloquerait six jours.
  for(const { p, est } of [...classes].reverse()){
    if(G.prospects.length < capacite(G.palier) + CARNET_MARGE) break;
    if(est < p.exigence) S.refuserProspect(G, p.id);
  }
}

/* ------------------------------------------------------------- la boutique */

/**
 * ⚠️ Piege herite n°4 : le plafond, ce sont les PLACES. L'IA lit `refoules`
 * exactement comme le joueur lit le diagnostic de la boutique, et achete des
 * places quand on refoule, de l'attrait sinon. Une IA qui achete le meuble le
 * plus cher disponible ne testerait jamais la contrainte.
 */
export function amenager(G){
  const j = G.derniereJournee;
  if(!j) return;
  const dispo = G.argent - RESERVE(G.palier);
  if(dispo <= 0) return;

  const manquePlaces = j.refoules > 0;
  const cat = Object.keys(MEUBLES)
    .filter(k => MEUBLES[k].palier <= G.palier && MEUBLES[k].prix <= dispo)
    .filter(k => manquePlaces ? MEUBLES[k].places > 0 : MEUBLES[k].attrait > 0);
  if(!cat.length) return;

  const valeur = k => manquePlaces
    ? (MEUBLES[k].gain * MEUBLES[k].places) / MEUBLES[k].prix
    : MEUBLES[k].attrait / MEUBLES[k].prix;
  const cle = cat.reduce((a, b) => valeur(b) > valeur(a) ? b : a);

  // Chercher une case libre. On vise a cote d'un meuble existant : les combos
  // se gagnent par CONTACT, et un joueur qui a compris ca ne pose pas au
  // hasard. C'est aussi ce qui fait que le bonus de combo est reellement
  // mesure par l'oracle plutot que theorique.
  const b = G.boutique;
  const cases = [];
  for(let gy = 0; gy < b.h; gy++) for(let gx = 0; gx < b.l; gx++){
    if(b.meubles.some(m => m.gx === gx && m.gy === gy)) continue;
    const voisins = [[1,0],[-1,0],[0,1],[0,-1]]
      .filter(([dx,dy]) => b.meubles.some(m => m.gx === gx+dx && m.gy === gy+dy)).length;
    cases.push({ gx, gy, voisins });
  }
  if(!cases.length) return;
  cases.sort((x, y) => y.voisins - x.voisins);
  S.poserMeuble(G, cle, cases[0].gx, cases[0].gy);
}

/* ---------------------------------------------------------------- le stock */

/**
 * Acheter, c'est parier sur la VARIETE. L'IA vise le style le moins couvert
 * de son stock : c'est la lecture correcte de la decision n°4, et si le jeu
 * recompensait plutot le tier le plus haut, la mesure le montrerait.
 */
export function acheter(G){
  const dispo = G.argent - RESERVE(G.palier);
  if(dispo <= 0 || !G.catalogue.length) return;

  // Couverture actuelle : combien de pieces par (slot, style).
  const couv = {};
  for(const a of G.stock) couv[a.slot + "/" + a.style] = (couv[a.slot + "/" + a.style] || 0) + 1;

  const abordables = G.catalogue.filter(a => a.prix <= dispo);
  if(!abordables.length) return;

  const valeur = a => {
    const trou = 1 / (1 + (couv[a.slot + "/" + a.style] || 0));
    // La qualite compte, mais divisee par le prix : sinon l'IA n'achete que
    // du tier 5 des qu'elle peut, et on ne mesure plus jamais le milieu de
    // l'echelle.
    const q = (a.tier * 12 + 30) / Math.max(1, a.prix) * 1000;
    return trou * 2.2 + q;
  };
  const best = abordables.reduce((x, y) => valeur(y) > valeur(x) ? y : x);
  S.acheterArticle(G, best.id);
}

/* ---------------------------------------------------------------- le salon */

export function jouerSalon(G){
  if(!G.salonEnAttente) return null;
  // Se presenter si on peut se le payer sans tomber sous la reserve. Sauter
  // coute de la notoriete, donc on ne saute que contraint.
  const participe = G.argent - CFG_SALON.COUT_STAND > 0;
  return S.reglerSalon(G, participe);
}

/* ------------------------------------------------------------ une partie */

/**
 * Joue une partie complete et rend le resume de mesure.
 * `jourMax` borne la simulation : une partie qui n'atteint jamais le palier 5
 * ne doit pas boucler indefiniment, elle doit etre RAPPORTEE comme inachevee.
 */
export function jouerPartie(gr, jourMax = 6000){
  const G = S.nouvellePartie(gr, "L'Atelier");
  let finiLe = null;

  while(G.jour < jourMax){
    // L'ordre imite une session : on regle le salon s'il attend, on decide,
    // on prepare, on achete, on amenage, puis le jour passe.
    if(G.salonEnAttente){ jouerSalon(G); continue; }

    deciderProspects(G);
    for(const ctr of G.contrats) remplirDossier(G, ctr);
    acheter(G);
    amenager(G);

    S.tick(G);

    if(finiLe === null && G.palier >= PALIERS.length) finiLe = G.jour;
    if(finiLe !== null && G.contrats.length === 0) break;
  }

  return {
    ...S.resumeStats(G),
    finiLe,
    complete: finiLe !== null,
    // Duree d'horloge a 1x : c'est la mesure a confronter a la cible de 25 h.
    heuresHorloge: +(G.jour * CFG.MS_PAR_JOUR / 3600000).toFixed(2),
  };
}

export { S as etat };
