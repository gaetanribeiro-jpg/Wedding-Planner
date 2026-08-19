/**
 * prestataires.js — DJ, fleuristes, traiteurs, lieux : qualite, prix, AGENDA.
 *
 * ⚠️ Decision de design n°6 : ce ne sont pas une septieme categorie de
 * boutique, ce sont des RELATIONS avec un agenda. Le fleuriste que tu voulais
 * est deja pris ce samedi-la — par toi, ou par un concurrent. C'est la
 * mecanique des guildes rivales d'Aincrad reemployee, et c'est une source de
 * pression qui ne coute rien a produire : elle sort du calendrier.
 */

import { alea, clamp } from "./utils.js";
import { PRESTATAIRES, PRESTA_TYPES, AGENDA, AFFINITE_STYLES,
         STYLE, STYLES } from "./config.js";

/**
 * L'etat des prestataires : pour chaque cle, un agenda (jour -> qui l'occupe)
 * et un compteur de fidelite.
 *
 * L'agenda est un objet simple et non une Map : il doit passer dans JSON.
 * ⚠️ Piege de sauvegarde — une Map serialisee donne `{}` sans lever, et on
 * recharge une partie ou tous les prestataires sont libres.
 */
export function prestatairesInitiaux(){
  const out = {};
  for(const cle in PRESTATAIRES) out[cle] = { cle, agenda:{}, fidelite:0 };
  return out;
}

export const defPresta = cle => PRESTATAIRES[cle];

/** Les prestataires d'un type, ouverts au palier atteint. */
export function disponiblesAuPalier(type, palier){
  return Object.keys(PRESTATAIRES)
    .filter(k => PRESTATAIRES[k].type === type && PRESTATAIRES[k].palier <= palier);
}

/** Prix demande pour une date, remise de fidelite comprise. */
export function prixPresta(etat, cle, invites){
  const d = PRESTATAIRES[cle];
  const t = PRESTA_TYPES[d.type];
  const remise = 1 - Math.min(AGENDA.FIDELITE_MAX, etat[cle].fidelite) * AGENDA.FIDELITE_REMISE;
  // Le traiteur facture par tete, le lieu et la musique au forfait : sans ca,
  // un mariage de 300 personnes couterait le meme prix qu'un mariage de 40 et
  // le nombre d'invites cesserait d'etre un arbitrage.
  const parTete = d.type === "traiteur" ? invites / 80 : 1;
  return Math.round(t.prixBase * d.prix * parTete * remise);
}

/** Les jours qu'une reservation bloque autour du jour J (montage, demontage). */
function joursBloques(cle, jourJ){
  const n = PRESTA_TYPES[PRESTATAIRES[cle].type].jourBloques;
  const out = [];
  for(let d = 0; d < n; d++) out.push(jourJ - d);
  return out;
}

/** Qui occupe ce prestataire ce jour-la : null, "joueur", ou une cle de concurrent. */
export function occupePar(etat, cle, jourJ){
  for(const j of joursBloques(cle, jourJ)){
    const q = etat[cle].agenda[j];
    if(q) return q;
  }
  return null;
}

export const estLibre = (etat, cle, jourJ) => !occupePar(etat, cle, jourJ);

/**
 * Reserver pour le joueur. Retourne false si la date est prise.
 *
 * ⚠️ La verification se fait ICI, dans la fonction qui AGIT, pas seulement
 * dans la liste affichee (piege herite n°5). L'oracle appelle cette fonction :
 * s'il pouvait reserver une date prise, il mesurerait une partie que personne
 * ne joue.
 */
export function reserver(etat, cle, jourJ, par = "joueur"){
  if(!estLibre(etat, cle, jourJ)) return false;
  for(const j of joursBloques(cle, jourJ)) etat[cle].agenda[j] = par;
  return true;
}

/** Liberer (contrat annule, ou changement d'avis avant le jour J). */
export function liberer(etat, cle, jourJ, par = "joueur"){
  for(const j of joursBloques(cle, jourJ))
    if(etat[cle].agenda[j] === par) delete etat[cle].agenda[j];
}

/** Un mariage passe ensemble renforce la relation. */
export function fideliser(etat, cle){
  etat[cle].fidelite = Math.min(AGENDA.FIDELITE_MAX, etat[cle].fidelite + 1);
}

/**
 * Les concurrents remplissent l'agenda a l'avance. Appele une fois par jour
 * pour un horizon lointain : reserver a J+30 le jour meme ne laisserait
 * jamais le joueur se faire doubler, et la pression disparaitrait.
 */
export function concurrentsReservent(etat, jour, palier, concurrents){
  const pression = AGENDA.PRESSION_BASE + AGENDA.PRESSION_PAR_PALIER * (palier - 1);
  for(const cle in PRESTATAIRES){
    const d = PRESTATAIRES[cle];
    if(d.palier > palier) continue;                 // pas encore dans le jeu
    if(alea() > pression) continue;
    // Ils visent l'horizon ou le joueur va chercher ses dates.
    const cible = jour + 8 + Math.floor(alea() * 34);
    if(!estLibre(etat, cle, cible)) continue;
    // Un concurrent va vers les prestataires de son style : c'est ce qui rend
    // la pression LISIBLE. Une pression uniforme se lit comme du hasard pur.
    const conc = concurrents[Math.floor(alea() * concurrents.length)];
    const aff = AFFINITE_STYLES[d.style][conc.style];
    if(alea() > aff * conc.agressivite) continue;
    reserver(etat, cle, cible, conc.cle);
  }
}

/**
 * Rattraper une date prise par un concurrent, en jouant de la relation.
 * Payant en fidelite : c'est ce qui donne une valeur au fait de retravailler
 * avec les memes gens plutot que de toujours prendre le meilleur du moment.
 */
export function tenterDeloger(etat, cle, jourJ){
  const qui = occupePar(etat, cle, jourJ);
  if(!qui || qui === "joueur") return false;
  const chance = etat[cle].fidelite * AGENDA.FIDELITE_PRIORITE;
  if(alea() > chance) return false;
  for(const j of joursBloques(cle, jourJ)) delete etat[cle].agenda[j];
  return reserver(etat, cle, jourJ);
}

/** Note d'un prestataire pour un couple : meme principe que pour le stock. */
export function scorePrestaPourCouple(cle, couple){
  const d = PRESTATAIRES[cle];
  let aff = 0, tot = 0;
  for(const s of STYLES){
    const g = couple.gouts[s] || 0;
    aff += g * AFFINITE_STYLES[d.style][s];
    tot += g;
  }
  aff = tot > 0 ? aff / tot : 0.5;
  return clamp(d.qualite * (0.42 + 0.58 * aff), 0, 100);
}

/** Fiche lisible, avec la disponibilite pour une date donnee. */
export function fichePresta(etat, cle, jourJ, invites, couple){
  const d = PRESTATAIRES[cle];
  const qui = jourJ ? occupePar(etat, cle, jourJ) : null;
  return {
    cle, txt:d.txt, type:d.type, qualite:d.qualite,
    style:d.style, styleTxt:STYLE[d.style].txt, couleur:STYLE[d.style].couleur,
    prix: prixPresta(etat, cle, invites || 80),
    fidelite: etat[cle].fidelite,
    occupePar: qui,
    libre: !qui,
    score: couple ? Math.round(scorePrestaPourCouple(cle, couple)) : null,
  };
}

/**
 * Purge les dates passees. Sans elle, l'agenda grossit indefiniment et la
 * sauvegarde finit par depasser le quota de localStorage — un quota depasse
 * tronque SANS lever (piege herite n°3).
 */
export function purgerAgendas(etat, jour){
  for(const cle in etat){
    const a = etat[cle].agenda;
    for(const j in a) if(+j < jour - 2) delete a[j];
  }
}
