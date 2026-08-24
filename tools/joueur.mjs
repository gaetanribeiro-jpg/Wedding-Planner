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
         SALON as CFG_SALON, CFG, REFUS, EXIGENCE_FLOU, ROLES,
         SAISONS } from "../src/config.js";
import { scorePourCouple } from "../src/stock.js";
import { disponiblesAuPalier, estLibre, prixPresta,
         scorePrestaPourCouple } from "../src/prestataires.js";
import { capacite } from "../src/clients.js";
import { resoudre } from "../src/mariage.js";
import { fourchetteExigence } from "../src/imprevus.js";
import { placesEquipe, coutRecrue, coutFormation, enFormation } from "../src/equipe.js";

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
        prix: prixPresta(G.prestas, k, couple.invites, couple.echelle),
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
        .map(k => ({ k, prix:prixPresta(G.prestas, k, couple.invites, couple.echelle),
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
/**
 * ⚠️ L'IA n'a PAS le droit de lire `couple.exigence`. Le joueur ne voit qu'une
 * fourchette annoncee ; une IA qui lirait le chiffre vrai mesurerait une
 * partie que personne ne peut jouer — et masquerait exactement le defaut
 * qu'on cherche a corriger.
 *
 * Elle vise le MILIEU de la fourchette, pas le haut. Viser le haut, c'est la
 * politique d'un joueur qui ne rate jamais — et qui signe deux fois moins. On
 * mesure alors un jeu sans risque parce que l'IA refuse d'en prendre, pas
 * parce que le jeu n'en offre pas. Le milieu est le comportement d'un joueur
 * engage, et c'est celui qu'on veut equilibrer.
 */
const exigenceVue = couple => {
  const f = fourchetteExigence(couple, EXIGENCE_FLOU);
  return (f.min + f.max) / 2;
};

export function deciderProspects(G){
  const marge = 4;
  const carnetPlein = G.prospects.length >= capacite(G.palier, G.equipe, G.jour) + CARNET_MARGE;

  // Les meilleurs d'abord : signer le bon dossier avant de remplir la capacite
  // avec le premier venu, c'est le geste de base du jeu.
  const classes = G.prospects
    .map(p => ({ p, est: estimer(G, p), vue: exigenceVue(p) }))
    .sort((a, b) => (b.est - b.vue) - (a.est - a.vue));

  for(const { p, est, vue } of classes){
    if(S.capaciteRestante(G) <= 0) break;
    if(est >= vue + marge) S.signerProspect(G, p.id);
  }

  if(!carnetPlein) return;
  // Carnet sature : on fait le menage par le bas. Refuser coute de la
  // notoriete (decision n°5) mais rend la place a un couple qu'on saura
  // servir. Ne rien faire la bloquerait six jours.
  for(const { p, est, vue } of [...classes].reverse()){
    if(G.prospects.length < capacite(G.palier, G.equipe, G.jour) + CARNET_MARGE) break;
    if(est < vue) S.refuserProspect(G, p.id);
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
/**
 * Acheter, c'est parier sur la VARIETE — et desormais aussi reapprovisionner :
 * la boutique VEND le stock, donc un atelier qui n'achete plus se retrouve
 * sans rien a proposer pour un mariage. L'IA achete donc tant qu'elle peut,
 * exactement comme un joueur qui voit ses portants se vider.
 */
/* Le stock qu'un joueur RAISONNABLE garde en rayon. On n'achete pas sans fin :
   au-dela, l'argent dort en marchandise. C'est ce qui donne son equilibre a la
   boutique — les ventes creusent, les achats rebouchent, et le niveau se
   stabilise la ou le joueur l'a decide. */
const STOCK_VISE = palier => 14 + 9 * palier;

export function acheter(G){
  const dispo = G.argent - RESERVE(G.palier);
  if(dispo <= 0 || !G.catalogue.length) return;
  if(G.stock.length >= STOCK_VISE(G.palier)) return;

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
  /* On achete TANT QU'ON PEUT, pas une piece par jour : la boutique vend, et
     un joueur qui voit ses portants se vider ne se rationne pas a un article
     quotidien. C'est le meme geste, donc la meme mesure. */
  let reste = dispo;
  for(let n = 0; n < 6 && G.stock.length < STOCK_VISE(G.palier); n++){
    const possibles = G.catalogue.filter(a => a.prix <= reste);
    if(!possibles.length) break;
    const best = possibles.reduce((x, y) => valeur(y) > valeur(x) ? y : x);
    if(!S.acheterArticle(G, best.id).ok) break;
    reste -= best.prix;
  }
}

/* --------------------------------------------------------------- l'equipe
   ⚠️ Piege herite n°5 : si le joueur peut recruter et former, l'IA doit le
   faire aussi. Sans ca, on mesurerait un jeu ou l'equipe n'existe pas — et
   toute la courbe de la basse saison serait une fiction. */

export function gererEquipe(G){
  const saison = SAISONS[Math.floor(G.jour / CFG.JOURS_PAR_SAISON) % SAISONS.length];
  const dispo = G.argent - RESERVE(G.palier);

  // Recruter quand il reste une place et de la marge. On prend le role le
  // moins represente : une equipe monocolore laisse trois effets a zero.
  if(G.equipe.length < placesEquipe(G.palier)
     && dispo > coutRecrue(G.equipe.length) * 2){
    const roles = Object.keys(ROLES);
    const compte = r => G.equipe.filter(m => m.role === r).length;
    const cible = roles.reduce((a, b) => compte(b) < compte(a) ? b : a);
    S.recruter(G, cible);
    return;
  }

  // Former en BASSE SAISON seulement : un membre en formation ne produit
  // rien, et s'en priver en ete revient a refuser des contrats.
  if(saison !== "hiver") return;
  const libres = G.equipe.filter(m => !enFormation(m, G.jour));
  for(const m of libres){
    if(G.argent - RESERVE(G.palier) < coutFormation(m.niveau)) break;
    if(S.former(G, m.id).ok) return;
  }
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
  /* ⚠️ LES QUATRE AXES, UN PAR UN, et la part du budget reellement depensee.
     Une note moyenne agregee ne dit pas qu'un axe est MORT : l'axe budget a
     valu 0 sur toutes les parties d'une mesure entiere — 15 % de la note,
     strictement constant — sans qu'aucune metrique bronche. Un axe constant
     est du contenu inatteignable (piege herite n°6), et il ne se voit que si
     on le regarde separement. */
  const axes = { elegance:[], coherence:[], emotion:[], budget:[] };
  const parts = [];

  while(G.jour < jourMax){
    // L'ordre imite une session : on regle le salon s'il attend, on decide,
    // on prepare, on achete, on amenage, puis le jour passe.
    if(G.salonEnAttente){ jouerSalon(G); continue; }

    deciderProspects(G);
    for(const ctr of G.contrats) remplirDossier(G, ctr);
    acheter(G);
    amenager(G);
    gererEquipe(G);

    for(const e of S.tick(G)) if(e.type === "jourJ"){
      for(const k in axes) axes[k].push(e.res.axes[k]);
      parts.push(e.res.budget ? e.res.depense / e.res.budget : 0);
    }

    if(finiLe === null && G.palier >= PALIERS.length) finiLe = G.jour;
    // ⚠️ On s'arrete sur la queue de partie, pas sur un carnet vide : quand le
    // joueur mene plusieurs dossiers en permanence, `contrats.length` ne
    // retombe jamais a zero et la partie tournait jusqu'a `jourMax`. Une
    // graine sur cinq rapportait alors 7 167 contrats en 12 000 jours et
    // faisait exploser toutes les medianes.
    if(finiLe !== null && (G.contrats.length === 0 || G.jour > finiLe + 60)) break;
  }

  const med = l => l.length ? [...l].sort((a, b) => a - b)[l.length >> 1] : 0;
  return {
    ...S.resumeStats(G),
    /* ⚠️ Piege herite n°6 : un contenu inatteignable n'est pas du contenu. Le
       codex n'inscrit que ce qui a MARCHE, et rien ne garantit qu'il se
       remplisse — c'est une consequence de la partie, pas une table qu'on
       ouvre. On mesure donc ce que le joueur DECOUVRE reellement. */
    codexAccords:  Object.keys(G.codex.accords).length,
    codexPrestas:  Object.keys(G.codex.prestas).length,
    codexFamilles: Object.keys(G.codex.familles).length,
    codexCombos:   Object.keys(G.codex.combos).length,
    ...Object.fromEntries(Object.keys(axes).map(k => ["axe" + k[0].toUpperCase() + k.slice(1), med(axes[k])])),
    partBudget: +med(parts).toFixed(3),
    finiLe,
    complete: finiLe !== null,
    // Duree d'horloge a 1x : c'est la mesure a confronter a la cible de 25 h.
    heuresHorloge: +(G.jour * CFG.MS_PAR_JOUR / 3600000).toFixed(2),
  };
}

export { S as etat };
