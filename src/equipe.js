/**
 * equipe.js — recruter et FORMER.
 *
 * Le briefing prevoyait la basse saison pour « acheter du stock, agrandir et
 * former ». La formation manquait : l'hiver n'offrait donc qu'un
 * ralentissement, jamais une decision. C'est aussi la deuxieme courbe de
 * progression du jeu — la notoriete, on la subit ; l'equipe, on la choisit.
 *
 * ⚠️ Piege herite n°2 : un effet agrege n'est pas un effet applique. Chacun
 * des quatre roles est LU dans une fonction qui agit, et pas seulement dans la
 * fiche de l'employe :
 *   vendeur      → boutique.journee()      (places servies, chance de vente)
 *   styliste     → mariage.resoudre()      (elegance, coherence)
 *   coordinateur → clients.capacite()      (dossiers de front)
 *                  imprevus.tirer()        (encaisse les coups durs)
 *   attache      → clients.arriveesDuJour() (prospects)
 *                  state.celebrer()         (notoriete)
 * Avant d'ajouter un cinquieme role, `grep` son nom hors de config.js : il
 * doit renvoyer autre chose que l'agregation et l'affichage.
 *
 * ⚠️ Un membre EN FORMATION ne produit rien. C'est tout l'arbitrage : former
 * en haute saison, c'est se tirer une balle dans le pied ; former en hiver,
 * c'est ce qui rend l'hiver utile.
 */

import { alea, pick } from "./utils.js";
import { ROLES, EQUIPE, PRENOMS } from "./config.js";

let _idMembre = 1;
export const etatIdMembre = () => _idMembre;
export const setIdMembre = n => { _idMembre = n; };

export const equipeInitiale = () => [];

/** Combien de membres on peut employer au palier atteint. */
export const placesEquipe = palier =>
  EQUIPE.PLACES_BASE + EQUIPE.PLACES_PAR_PALIER * (palier - 1);

export const coutRecrue = nbMembres =>
  EQUIPE.COUT_RECRUE_BASE + EQUIPE.COUT_RECRUE_PAR_MEMBRE * nbMembres;

export const coutFormation = niveau =>
  EQUIPE.COUT_FORMATION_BASE + EQUIPE.COUT_FORMATION_PAR_NIVEAU * (niveau - 1);

export const joursFormation = niveau =>
  EQUIPE.JOURS_FORMATION_BASE + EQUIPE.JOURS_FORMATION_PAR_NIVEAU * (niveau - 1);

export const salaire = m =>
  EQUIPE.SALAIRE_BASE + EQUIPE.SALAIRE_PAR_NIVEAU * (m.niveau - 1);

/** La masse salariale du jour. Elle tombe qu'on travaille ou non. */
export const masseSalariale = equipe =>
  equipe.reduce((s, m) => s + salaire(m), 0);

export function recruter(equipe, role){
  const nom = pick(PRENOMS);
  const m = { id:_idMembre++, nom, role, niveau:1, formeJusque:0 };
  equipe.push(m);
  return m;
}

/** Un membre en formation est indisponible : c'est le prix de la montee. */
export const enFormation = (m, jour) => m.formeJusque > jour;

export function lancerFormation(m, jour){
  m.formeJusque = jour + joursFormation(m.niveau);
  return m.formeJusque;
}

/** Appele une fois par jour : cloture les formations arrivees a terme. */
export function jourEquipe(equipe, jour){
  const finis = [];
  for(const m of equipe){
    if(m.formeJusque && m.formeJusque === jour && m.niveau < EQUIPE.NIVEAU_MAX){
      m.niveau++;
      m.formeJusque = 0;
      finis.push(m);
    }else if(m.formeJusque && m.formeJusque <= jour){
      m.formeJusque = 0;
    }
  }
  return finis;
}

/**
 * L'apport TOTAL d'un role, en niveaux cumules des membres disponibles.
 * ⚠️ `jour` est obligatoire : sans lui, un membre en formation compterait
 * quand meme, et la formation deviendrait gratuite.
 */
export function apport(equipe, role, jour){
  return equipe.reduce((s, m) =>
    s + ((m.role === role && !enFormation(m, jour)) ? m.niveau : 0), 0);
}

/* Les quatre lectures. Elles vivent ici pour que le calcul d'un effet et sa
   table soient a un seul endroit — et pour qu'un `grep` sur un role tombe
   d'abord dessus. */

export const bonusPlaces = (equipe, jour) =>
  apport(equipe, "vendeur", jour) * ROLES.vendeur.PLACES;

export const bonusChanceVente = (equipe, jour) =>
  apport(equipe, "vendeur", jour) * ROLES.vendeur.CHANCE_VENTE;

export const bonusElegance = (equipe, jour) =>
  apport(equipe, "styliste", jour) * ROLES.styliste.ELEGANCE;

export const bonusCoherence = (equipe, jour) =>
  apport(equipe, "styliste", jour) * ROLES.styliste.COHERENCE;

export const bonusCapacite = (equipe, jour) =>
  Math.floor(apport(equipe, "coordinateur", jour) * ROLES.coordinateur.CAPACITE);

export const parerImprevu = (equipe, jour) =>
  Math.min(0.6, apport(equipe, "coordinateur", jour) * ROLES.coordinateur.PARE_IMPREVU);

export const bonusProspects = (equipe, jour) =>
  apport(equipe, "attache", jour) * ROLES.attache.PROSPECTS;

export const bonusNotoriete = (equipe, jour) =>
  apport(equipe, "attache", jour) * ROLES.attache.NOTORIETE;

/** Fiche lisible, pour l'interface. */
export function ficheMembre(m, jour){
  const d = ROLES[m.role];
  return {
    id:m.id, nom:m.nom, role:m.role, roleTxt:d.txt, couleur:d.couleur,
    resume:d.resume, niveau:m.niveau, niveauMax:EQUIPE.NIVEAU_MAX,
    salaire:salaire(m),
    enFormation: enFormation(m, jour),
    joursRestants: enFormation(m, jour) ? m.formeJusque - jour : 0,
    peutMonter: m.niveau < EQUIPE.NIVEAU_MAX,
    coutFormation: coutFormation(m.niveau),
    joursFormation: joursFormation(m.niveau),
  };
}
