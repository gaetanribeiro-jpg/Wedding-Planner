/**
 * state.js — l'etat `G` et la boucle. UN TICK = UN JOUR.
 *
 * ⚠️ Regle de dependance (celle d'Aincrad, qui a tenu) : `ui` et `render`
 * dependent de `state`, jamais l'inverse. Ce fichier ne connait ni le DOM ni
 * le canvas — c'est ce qui permet a l'oracle de faire tourner des parties
 * entieres dans node, et donc de mesurer quoi que ce soit.
 *
 * ⚠️ `G` n'est pas serialisable tel quel. Si tu ajoutes un champ, ajoute-le a
 * `SIMPLES` ou traite-le a la main dans save.js, et incremente `VERSION`.
 * L'etat du generateur aleatoire et les compteurs d'id se sauvegardent aussi :
 * sans eux, recharger casse la reproductibilite a graine fixe.
 */

import { alea, graine as poserGraine, etatAlea, setEtatAlea, clamp } from "./utils.js";
import { CFG, PALIERS, SAISONS, SAISON, SLOTS, SLOT, MEUBLES, STOCK,
         REFUS, CLIENTS } from "./config.js";
import * as Boutique from "./boutique.js";
import * as Stock from "./stock.js";
import * as Clients from "./clients.js";
import * as Presta from "./prestataires.js";
import * as Conc from "./concurrents.js";
import * as Salon from "./salon.js";
import { resoudre as resoudreMariage } from "./mariage.js";

export const VERSION = 1;

/* Les champs qui se recopient tels quels a la sauvegarde. Tout le reste est
   traite a la main dans save.js. */
export const SIMPLES = [
  "version","jour","argent","notoriete","palier","nomAtelier",
  "refusSaison","refusTotal","dernierRefus","boucheAOreille",
  "vitesse","fini","salonEnAttente","themeSalon",
];

export function nouvellePartie(gr = (Math.random() * 4294967296) >>> 0,
                               nomAtelier = "L'Atelier"){
  poserGraine(gr);
  Stock.setIdArticle(1);
  Clients.setIdCouple(1);

  const G = {
    version: VERSION,
    graine: gr >>> 0,
    nomAtelier,
    jour: 0,
    argent: CFG.ARGENT_DEPART,
    notoriete: CFG.NOTORIETE_DEPART,
    palier: 1,

    boutique: Boutique.boutiqueInitiale(),
    stock: Stock.stockInitial(),
    catalogue: [],
    prospects: [],
    contrats: [],
    prestas: Presta.prestatairesInitiaux(),
    concurrents: Conc.concurrentsInitiaux(),

    // Refuser coute de plus en plus cher dans la meme saison.
    refusSaison: 0,
    refusTotal: 0,
    dernierRefus: -999,
    boucheAOreille: 0,

    journal: [],
    salons: [],
    // Le salon est le seul moment modal : il met la boucle en attente.
    salonEnAttente: false,
    themeSalon: null,

    vitesse: 1,
    fini: false,
    derniereJournee: null,

    stats: statsVierges(),
  };
  G.catalogue = Stock.tirerCatalogue(G.palier);
  return G;
}

export const statsVierges = () => ({
  contratsSignes:0, contratsRefuses:0, contratsRates:0, contratsReussis:0,
  prospectsVus:0, prospectsPerdus:0, prospectsIgnores:0,
  noteTotale:0, recetteBoutique:0, chargesPayees:0, honoraires:0,
  achats:0, meublesPoses:0, salonsGagnes:0, salonsJoues:0,
  visiteurs:0, refoules:0,
  jourPalier:[0,0,0,0,0],
});

/* ------------------------------------------------------------- calendrier */

export const saisonDe = jour =>
  SAISONS[Math.floor(jour / CFG.JOURS_PAR_SAISON) % SAISONS.length];
export const anneeDe = jour => 1 + Math.floor(jour / CFG.SALON_TOUS_LES_JOURS);
export const jourDansAnnee = jour => jour % CFG.SALON_TOUS_LES_JOURS;
export const saisonCourante = G => saisonDe(G.jour);
export const infoSaison = G => SAISON[saisonCourante(G)];

/* ---------------------------------------------------------------- palier */

export function palierPour(notoriete){
  let p = 1;
  for(const x of PALIERS) if(notoriete >= x.seuil) p = x.n;
  return p;
}

/* --------------------------------------------------------------- actions
   Toutes les actions du joueur passent par ces fonctions, et l'oracle appelle
   EXACTEMENT les memes (piege herite n°5 : si le joueur peut faire un geste,
   l'IA de test doit pouvoir le faire aussi, sinon elle mesure une partie que
   personne ne joue). */

export function signerProspect(G, id){
  const i = G.prospects.findIndex(p => p.id === id);
  if(i < 0) return { ok:false, txt:"prospect introuvable" };
  // ⚠️ La capacite est verifiee ICI, dans la fonction qui agit.
  if(G.contrats.length >= Clients.capacite(G.palier))
    return { ok:false, txt:"tu ne peux pas en mener un de plus de front" };
  const couple = G.prospects.splice(i, 1)[0];
  const ctr = Clients.signer(couple, G.jour);
  G.contrats.push(ctr);
  G.stats.contratsSignes++;
  return { ok:true, contrat:ctr };
}

export function refuserProspect(G, id){
  const i = G.prospects.findIndex(p => p.id === id);
  if(i < 0) return { ok:false, txt:"prospect introuvable" };
  const couple = G.prospects.splice(i, 1)[0];
  // Le cout monte a chaque refus de la saison : sans escalade, la strategie
  // optimale serait de ne signer que les dossiers parfaits.
  const cout = REFUS.COUT_NOTORIETE + REFUS.COUT_ESCALADE * G.refusSaison;
  G.notoriete = Math.max(0, G.notoriete - cout);
  G.refusSaison++;
  G.refusTotal++;
  G.dernierRefus = G.jour;
  G.stats.contratsRefuses++;
  const vainqueur = Conc.reprendreClient(G.concurrents, couple);
  return { ok:true, cout, vainqueur };
}

export function acheterArticle(G, id){
  const i = G.catalogue.findIndex(a => a.id === id);
  if(i < 0) return { ok:false, txt:"article introuvable" };
  const a = G.catalogue[i];
  if(G.argent < a.prix) return { ok:false, txt:"pas assez d'argent" };
  G.argent -= a.prix;
  G.catalogue.splice(i, 1);
  G.stock.push(a);
  G.stats.achats++;
  return { ok:true, article:a };
}

export function revendreArticle(G, id){
  // Une piece engagee sur un dossier ne se revend pas : sinon on encaisse la
  // revente et on garde le bonus au jour J.
  if(G.contrats.some(c => SLOTS.some(s => SLOT[s].source === "stock" && c.choix[s] === id)))
    return { ok:false, txt:"cette pièce est engagée sur un dossier" };
  const i = G.stock.findIndex(a => a.id === id);
  if(i < 0) return { ok:false, txt:"article introuvable" };
  const a = G.stock.splice(i, 1)[0];
  const prix = Stock.prixRevente(a);
  G.argent += prix;
  return { ok:true, prix };
}

export function poserMeuble(G, cle, gx, gy){
  const v = Boutique.peutPlacer(G.boutique, cle, gx, gy, G.palier, G.argent);
  if(!v.ok) return v;
  G.argent -= MEUBLES[cle].prix;
  Boutique.placer(G.boutique, cle, gx, gy);
  G.stats.meublesPoses++;
  return { ok:true };
}

export function enleverMeuble(G, gx, gy){
  const m = Boutique.retirer(G.boutique, gx, gy);
  if(!m) return { ok:false, txt:"rien ici" };
  // On recupere la moitie : demonter ne doit pas etre gratuit, sinon on
  // reamenage la boutique a chaque saison sans rien payer.
  G.argent += Math.round(MEUBLES[m.cle].prix * 0.5);
  return { ok:true, meuble:m };
}

/**
 * Affecter un emplacement d'un dossier.
 * `valeur` : un id d'article (slot de stock) ou une cle de prestataire.
 * Rendre null libere l'emplacement.
 */
export function choisirPour(G, contratId, slot, valeur){
  const ctr = G.contrats.find(c => c.id === contratId);
  if(!ctr) return { ok:false, txt:"dossier introuvable" };
  const src = SLOT[slot].source;

  // Liberer l'ancien choix d'abord : une reservation qu'on remplace doit
  // rendre sa date, sinon on bloque l'agenda pour rien jusqu'a la fin.
  const ancien = ctr.choix[slot];
  if(ancien != null){
    if(src === "prestataire"){
      Presta.liberer(G.prestas, ancien, ctr.jourJ);
      ctr.depense -= Presta.prixPresta(G.prestas, ancien, ctr.couple.invites);
    }
    ctr.choix[slot] = null;
  }
  if(valeur == null) return { ok:true };

  if(src === "stock"){
    const a = G.stock.find(x => x.id === valeur);
    if(!a) return { ok:false, txt:"pièce introuvable" };
    if(a.slot !== slot) return { ok:false, txt:"pas le bon emplacement" };
    // Une piece ne peut pas servir deux mariages le meme jour.
    const prise = G.contrats.some(c => c.id !== contratId && c.choix[slot] === valeur);
    if(prise) return { ok:false, txt:"déjà promise à un autre dossier" };
    ctr.choix[slot] = valeur;
    return { ok:true };
  }

  // Prestataire : c'est l'agenda qui decide, et il decide ICI.
  if(!Presta.estLibre(G.prestas, valeur, ctr.jourJ)){
    const delogé = Presta.tenterDeloger(G.prestas, valeur, ctr.jourJ);
    if(!delogé) return { ok:false, txt:"déjà pris ce jour-là" };
  }else{
    Presta.reserver(G.prestas, valeur, ctr.jourJ);
  }
  const prix = Presta.prixPresta(G.prestas, valeur, ctr.couple.invites);
  ctr.choix[slot] = valeur;
  ctr.depense += prix;
  return { ok:true, prix };
}

/** Annuler un dossier avant le jour J : ca coute cher, mais ca existe. */
export function annulerContrat(G, contratId){
  const i = G.contrats.findIndex(c => c.id === contratId);
  if(i < 0) return { ok:false, txt:"dossier introuvable" };
  const ctr = G.contrats[i];
  for(const s of SLOTS)
    if(SLOT[s].source === "prestataire" && ctr.choix[s])
      Presta.liberer(G.prestas, ctr.choix[s], ctr.jourJ);
  G.contrats.splice(i, 1);
  G.notoriete = Math.max(0, G.notoriete - REFUS.COUT_NOTORIETE * 2);
  Conc.reprendreClient(G.concurrents, ctr.couple);
  return { ok:true };
}

/* ------------------------------------------------------------------ tick */

/**
 * Un jour. Rend la liste des evenements a montrer — l'interface reagit a
 * cette liste et ne recalcule rien.
 */
export function tick(G){
  if(G.fini || G.salonEnAttente) return [];
  const ev = [];
  G.jour++;
  const saison = saisonCourante(G);

  /* --- la boutique tourne ------------------------------------------- */
  const j = Boutique.journee(G.boutique, G.notoriete, saison, G.palier);
  G.argent += j.net;
  G.derniereJournee = j;
  G.stats.recetteBoutique += j.recette;
  G.stats.chargesPayees += j.charges;
  G.stats.visiteurs += j.visiteurs;
  G.stats.refoules += j.refoules;

  /* --- les rivaux avancent ------------------------------------------ */
  Conc.jourConcurrents(G.concurrents, G.notoriete);
  Presta.concurrentsReservent(G.prestas, G.jour, G.palier, G.concurrents);
  if(G.jour % 30 === 0) Presta.purgerAgendas(G.prestas, G.jour);

  /* --- des couples se presentent ------------------------------------
     ⚠️ Le CARNET est borne. Au-dela, les couples ne poussent meme pas la
     porte : ils vont ailleurs sans qu'on le sache, et ca ne coute rien. C'est
     ce qui donne sa valeur au refus — refuser libere une place tout de suite,
     ignorer la bloque six jours — et ca borne le flux, qui sinon croit avec la
     notoriete jusqu'a noyer toute decision. */
  const carnet = Clients.capacite(G.palier) + REFUS.CARNET_MARGE;
  const n = Clients.arriveesDuJour(G.notoriete, saison, G.boucheAOreille);
  G.boucheAOreille *= 0.86;            // le bouche a oreille s'eteint
  for(let i = 0; i < n; i++){
    if(G.prospects.length >= carnet){ G.stats.prospectsIgnores++; continue; }
    const p = Clients.creerProspect(G.jour, G.palier, saison);
    G.prospects.push(p);
    G.stats.prospectsVus++;
    ev.push({ type:"prospect", couple:p });
  }

  /* --- ceux qui attendaient s'en vont ------------------------------- */
  for(let i = G.prospects.length - 1; i >= 0; i--){
    if(G.prospects[i].expireLe > G.jour) continue;
    const perdu = G.prospects.splice(i, 1)[0];
    const chez = Conc.reprendreClient(G.concurrents, perdu);
    // Expirer ne coute pas de notoriete : le couple n'a jamais rien signe.
    // Ce que ca coute, c'est la place qu'il a tenue six jours dans le carnet.
    G.stats.prospectsPerdus++;
    ev.push({ type:"perdu", couple:perdu, concurrent:chez });
  }

  /* --- les jours J -------------------------------------------------- */
  for(let i = G.contrats.length - 1; i >= 0; i--){
    const ctr = G.contrats[i];
    if(ctr.jourJ > G.jour) continue;
    const res = celebrer(G, ctr);
    G.contrats.splice(i, 1);
    // Le contrat voyage AVEC la resolution : le rendu a besoin des choix
    // reels (quelle robe, quel lieu) pour mettre en scene le bon mariage, et
    // il vient d'etre retire de la liste. Le reconstruire depuis le resume
    // serait une deuxieme source de verite, donc une divergence a terme.
    ev.push({ type:"jourJ", res, contrat:ctr });
  }

  /* --- palier ------------------------------------------------------- */
  const p = palierPour(G.notoriete);
  if(p > G.palier){
    G.palier = p;
    G.stats.jourPalier[p - 1] = G.jour;
    ev.push({ type:"palier", palier:PALIERS[p - 1] });
    if(p === PALIERS.length){
      // Palier royal : la fin de partie est atteinte, mais on ne coupe pas la
      // partie — on la laisse se finir sur le dernier mariage.
      ev.push({ type:"final" });
    }
  }

  /* --- saison et catalogue ------------------------------------------ */
  if(G.jour % CFG.JOURS_PAR_SAISON === 0){
    G.refusSaison = 0;
    G.catalogue = Stock.tirerCatalogue(G.palier);
    ev.push({ type:"saison", saison:saisonCourante(G) });
  }
  if(G.jour - G.dernierRefus > REFUS.OUBLI_JOURS) G.refusSaison = 0;

  /* --- le salon ------------------------------------------------------
     Le seul evenement qui ARRETE la boucle. Tout le reste s'annonce par un
     bandeau (decision de design n°8). */
  if(Salon.estJourDeSalon(G.jour, CFG)){
    G.salonEnAttente = true;
    G.themeSalon = Salon.tirerTheme();
    ev.push({ type:"salon", theme:G.themeSalon });
  }

  /* --- ruine ---------------------------------------------------------
     Pas de game over brutal : on tombe a zero, on paie ses charges en
     notoriete, et on remonte. Un ecran « perdu » sur un jeu de gestion de
     25 h coupe la partie exactement quand elle devient interessante. */
  if(G.argent < 0){
    const dette = -G.argent;
    G.argent = 0;
    G.notoriete = Math.max(0, G.notoriete - Math.ceil(dette / 200));
    ev.push({ type:"decouvert", dette });
  }

  return ev;
}

/** Le jour J d'un dossier : resolu d'un coup, puis anime par le rendu. */
function celebrer(G, ctr){
  const parId = Object.fromEntries(G.stock.map(a => [a.id, a]));
  const res = resoudreMariage(ctr, parId);

  G.argent += res.honoraires;
  G.notoriete = Math.max(0, G.notoriete + res.notoriete);
  G.boucheAOreille += res.boucheAOreille;
  G.stats.honoraires += res.honoraires;
  G.stats.noteTotale += res.note;
  if(res.reussi) G.stats.contratsReussis++; else G.stats.contratsRates++;

  // Les pieces s'usent, les prestataires se fidelisent. Deux effets APPLIQUES,
  // pas deux compteurs d'affichage (piege herite n°2).
  for(const id of res.articles){
    const a = G.stock.find(x => x.id === id);
    if(a) a.usages++;
  }
  for(const cle of res.prestas) Presta.fideliser(G.prestas, cle);

  G.journal.unshift({ jour:G.jour, ...res });
  if(G.journal.length > 40) G.journal.pop();
  return res;
}

/* ------------------------------------------------------------------ salon */

/** Le joueur a decide : il participe ou il passe. Debloque la boucle. */
export function reglerSalon(G, participe){
  const res = Salon.resoudre({
    theme: G.themeSalon,
    stock: G.stock,
    concurrents: G.concurrents,
    palier: G.palier,
    notoriete: G.notoriete,
    argent: G.argent,
    participe: participe && Salon.peutParticiper(G.argent),
    nomAtelier: G.nomAtelier,
  });
  G.argent -= res.cout;
  G.argent += res.gainArgent;
  G.notoriete = Math.max(0, G.notoriete + res.gainNotoriete);
  G.salons.unshift({ annee:anneeDe(G.jour), ...res });
  G.stats.salonsJoues += res.participe ? 1 : 0;
  if(res.rang === 1) G.stats.salonsGagnes++;
  G.salonEnAttente = false;
  G.themeSalon = null;
  return res;
}

/* ------------------------------------------------------------- lectures
   Des vues derivees, pour l'interface et l'oracle. Aucune ne modifie `G`. */

export const capaciteRestante = G =>
  Clients.capacite(G.palier) - G.contrats.length;

export const palierCourant = G => PALIERS[G.palier - 1];

export const prochainJourJ = G =>
  G.contrats.reduce((m, c) => c.jourJ < m ? c.jourJ : m, Infinity);

/** Le dossier dont le jour J est le plus proche : c'est lui qui merite le bandeau. */
export const dossierUrgent = G =>
  G.contrats.slice().sort((a, b) => a.jourJ - b.jourJ)[0] || null;

export const noteMoyenne = G => {
  const n = G.stats.contratsReussis + G.stats.contratsRates;
  return n ? G.stats.noteTotale / n : 0;
};

export const tauxRate = G => {
  const n = G.stats.contratsReussis + G.stats.contratsRates;
  return n ? G.stats.contratsRates / n : 0;
};

/** Duree de partie en heures d'horloge, a la vitesse 1x. */
export const heuresDeJeu = G => G.jour * CFG.MS_PAR_JOUR / 3600000;

export const estFinie = G => G.palier >= PALIERS.length && G.contrats.length === 0;

export const resumeStats = G => ({
  jour:G.jour, annee:anneeDe(G.jour), palier:G.palier,
  argent:Math.round(G.argent), notoriete:Math.round(G.notoriete),
  heures:+heuresDeJeu(G).toFixed(2),
  contrats:G.stats.contratsSignes, refuses:G.stats.contratsRefuses,
  rates:G.stats.contratsRates, reussis:G.stats.contratsReussis,
  tauxRate:+tauxRate(G).toFixed(3),
  noteMoyenne:+noteMoyenne(G).toFixed(1),
  stock:G.stock.length, meubles:G.boutique.meubles.length,
  visiteurs:G.stats.visiteurs, refoules:G.stats.refoules,
  salonsGagnes:G.stats.salonsGagnes, salonsJoues:G.stats.salonsJoues,
  recetteBoutique:Math.round(G.stats.recetteBoutique),
  honoraires:Math.round(G.stats.honoraires),
});

/* L'etat du generateur voyage avec la partie : sans lui, recharger donne une
   autre suite de tirages et la partie cesse d'etre reproductible. */
export const snapshotAlea = () => ({
  alea: etatAlea(), idArticle: Stock.etatIdArticle(), idCouple: Clients.etatIdCouple(),
});
export function restaurerAlea(s){
  setEtatAlea(s.alea);
  Stock.setIdArticle(s.idArticle);
  Clients.setIdCouple(s.idCouple);
}

export { clamp };
