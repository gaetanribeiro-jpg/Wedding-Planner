/**
 * salon.js — le rendez-vous annuel. C'est le BOSS du jeu.
 *
 * ⚠️ Decision de design n°2 : c'est le seul moment ou la boucle s'arrete et
 * attend une decision, et donc LE SEUL ECRAN MODAL DU JEU. Tout le reste
 * s'annonce par un bandeau. La premiere version du concept faisait du salon le
 * moteur de la partie : a 9 s/jour, une annee de jeu fait 54 minutes, et rien
 * ne force une decision entre deux salons. C'est le defaut deja corrige sur le
 * tournoi d'Aincrad, passe de tous les 20 etages a tous les 10.
 *
 * Le theme tire chaque annee pese 40 % de la note. C'est ce qui recompense un
 * stock VARIE plutot qu'un stock optimal : la meilleure robe n'existe pas dans
 * l'absolu, pas plus au salon qu'en dossier.
 */

import { alea, pick, rnd } from "./utils.js";
import { SALON, STYLES, STYLE, AFFINITE_STYLES, PALIERS } from "./config.js";
import { qualiteBrute } from "./stock.js";

/** Le theme de l'annee : un style, tire au moment du salon. */
export const tirerTheme = () => pick(STYLES);

/**
 * Les pieces que le stand presente : les meilleures pour LE THEME, pas les
 * meilleures tout court. L'ecart entre les deux listes est tout le sujet.
 */
export function meilleurStand(stock, theme){
  return [...stock]
    .map(a => ({ a, v: notePiece(a, theme) }))
    .sort((x, y) => y.v - x.v)
    .slice(0, SALON.PIECES_STAND)
    .map(x => x.a);
}

/** Note d'une piece au salon : sa qualite, ponderee par l'affinite au theme. */
export function notePiece(a, theme){
  const aff = AFFINITE_STYLES[a.style][theme];
  return qualiteBrute(a) * ((1 - SALON.POIDS_THEME) + SALON.POIDS_THEME * aff * 1.6);
}

/** Le score d'un stand : la somme des pieces presentees. */
export const scoreStand = (pieces, theme) =>
  Math.round(pieces.reduce((s, a) => s + notePiece(a, theme), 0));

/**
 * Le score d'un concurrent. Il derive de sa notoriete et de son style : on ne
 * simule pas son stock, ce serait un moteur entier pour une ligne de
 * classement. Mais il doit rester BATTABLE quand le theme lui est contraire —
 * sinon le tirage du theme n'est plus une information, juste du bruit.
 */
export function scoreConcurrent(c, theme, palier){
  const aff = AFFINITE_STYLES[c.style][theme];
  const base = 60 + c.notoriete * 0.34 + (palier - 1) * 22;
  return Math.round(base * ((1 - SALON.POIDS_THEME) + SALON.POIDS_THEME * aff * 1.6)
                    * rnd(0.92, 1.08));
}

/**
 * Resout le salon. Comme le jour J, TOUT est resolu avant d'etre montre :
 * `resoudre` ne touche a rien d'affichable et rend un classement complet.
 *
 * `participe` a false quand le joueur passe son tour : ca coute de la
 * notoriete, sinon sauter les annees faibles serait la strategie optimale et
 * le boss deviendrait facultatif.
 */
export function resoudre({ theme, stock, concurrents, palier, notoriete, argent,
                           participe = true, nomAtelier = "Ton atelier" }){
  const lignes = concurrents.map(c => ({
    cle:c.cle, txt:c.txt, couleur:c.couleur, joueur:false,
    points: scoreConcurrent(c, theme, palier),
  }));

  let stand = [], points = 0;
  if(participe){
    stand = meilleurStand(stock, theme);
    points = scoreStand(stand, theme);
    lignes.push({ cle:"joueur", txt:nomAtelier, couleur:"#e69aa6", joueur:true, points });
  }

  lignes.sort((a, b) => b.points - a.points);
  lignes.forEach((l, i) => l.rang = i + 1);

  const moi = lignes.find(l => l.joueur);
  const rang = moi ? moi.rang : null;
  const prix = participe ? SALON.PRIX.find(p => p.rang === rang) : null;

  return {
    theme, themeTxt: STYLE[theme].txt,
    participe,
    stand: stand.map(a => a.id),
    points, rang, lignes,
    cout: participe ? SALON.COUT_STAND : 0,
    gainArgent: prix ? prix.argent : 0,
    gainNotoriete: participe
      ? (prix ? prix.notoriete : Math.round(-SALON.MALUS_ABSENCE * 0.35))
      : -SALON.MALUS_ABSENCE,
    prixTxt: prix ? prix.txt : null,
    resume: resumer(participe, rang, theme, stand),
  };
}

function resumer(participe, rang, theme, stand){
  if(!participe)
    return `Ton stand est resté vide. Le métier l'a remarqué.`;
  const t = STYLE[theme].txt.toLowerCase();
  if(rang === 1) return `Ton stand ${t} a écrasé la halle.`;
  if(rang === 2) return `Deuxième d'un cheveu. Il manquait une pièce.`;
  if(rang === 3) return `Sur le podium, sans le haut.`;
  if(!stand.length) return `Un stand sans pièce montrable : c'était perdu d'avance.`;
  return `Le thème était ${t}. Ton stock ne l'était pas.`;
}

/** Le salon tombe-t-il aujourd'hui ? */
export const estJourDeSalon = (jour, cfg) =>
  jour > 0 && (jour % cfg.SALON_TOUS_LES_JOURS) === cfg.SALON_JOUR_DANS_ANNEE;

/** Peut-on se payer un stand ? Verifie la ou l'on agit, pas a l'affichage. */
export const peutParticiper = argent => argent >= SALON.COUT_STAND;

/** Prochain palier a atteindre, pour le bandeau d'annonce. */
export const prochainPalier = notoriete =>
  PALIERS.find(p => p.seuil > notoriete) || null;
