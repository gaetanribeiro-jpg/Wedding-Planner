/**
 * tuto.js — le guide des premiers pas.
 *
 * ⚠️ LA regle, et elle a coute une session sur le projet precedent : une etape
 * se valide sur l'ETAT, jamais sur un clic. Un tutoriel branche sur les
 * evenements d'interface se desynchronise a la premiere action faite
 * autrement — au clavier, par un raccourci, ou parce que le joueur avait deja
 * fait le geste avant que l'etape ne s'affiche. Il reste alors bloque sur une
 * consigne deja accomplie, et il n'y a aucun moyen de s'en sortir.
 *
 * Ici chaque etape porte un predicat `fait(G)`. Le guide relit l'etat a chaque
 * rafraichissement et avance tout seul. Il est donc impossible de le bloquer.
 */

import { SLOTS } from "./config.js";
import * as S from "./state.js";
import * as Boutique from "./boutique.js";

export const ETAPES = [
  { cle:"meuble",
    txt:"Pose un meuble dans la boutique. Les combos se gagnent par contact : "
      + "colle un meuble de confort à un meuble de vente.",
    onglet:"boutique",
    fait: G => G.stats.meublesPoses >= 1 },

  { cle:"achat",
    txt:"Achète une pièce au catalogue. Vise un style que tu n'as pas encore : "
      + "la meilleure robe n'existe pas, seulement la bonne robe pour un couple.",
    onglet:"stock",
    fait: G => G.stats.achats >= 1 },

  { cle:"signer",
    txt:"Un couple attend dans ton carnet. Regarde ses goûts, puis signe — "
      + "ou refuse, si tu sais que tu ne sauras pas le servir.",
    onglet:"clients",
    fait: G => G.stats.contratsSignes >= 1 || G.stats.contratsRefuses >= 1 },

  { cle:"remplir",
    txt:"Ouvre le dossier et remplis les six emplacements. Un emplacement vide "
      + "ne vaut pas zéro : il fait activement mal.",
    onglet:"clients",
    fait: G => G.contrats.some(c => SLOTS.every(s => c.choix[s]))
            || G.stats.contratsReussis + G.stats.contratsRates >= 1 },

  { cle:"presta",
    txt:"Réserve un prestataire. Il est pris ou il ne l'est pas : l'agenda ne "
      + "se négocie qu'avec de la fidélité.",
    onglet:"prestataires",
    fait: G => G.contrats.some(c => c.choix.lieu || c.choix.traiteur || c.choix.musique)
            || G.stats.contratsReussis + G.stats.contratsRates >= 1 },

  { cle:"jourJ",
    txt:"Laisse le temps passer jusqu'au jour J. Tout est déjà joué à cet "
      + "instant — la cérémonie ne fait que raconter ce que ton dossier vaut.",
    onglet:"clients",
    fait: G => G.stats.contratsReussis + G.stats.contratsRates >= 1 },

  { cle:"places",
    txt:"Ta boutique refoule des visiteurs ? Ce ne sont pas des clients en "
      + "moins, c'est des PLACES en moins. L'attrait fait venir, les places "
      + "servent.",
    onglet:"boutique",
    // ⚠️ Cette etape ne s'affiche que si le plafond MORD vraiment. Un conseil
    // donne avant que le probleme existe ne s'imprime pas.
    pertinent: G => G.derniereJournee && G.derniereJournee.refoules > 0,
    fait: G => G.derniereJournee && G.derniereJournee.refoules === 0
            && Boutique.placesTotales(G.boutique) >= 6 },

  { cle:"salon",
    txt:"Le salon annuel arrive. C'est le seul moment où la partie s'arrête et "
      + "attend : ton stock entier y passe un examen sur un thème tiré au sort.",
    onglet:"salon",
    pertinent: G => {
      const vers = (360 - S.jourDansAnnee(G.jour) + 360) % 360;
      return G.stats.salonsJoues === 0 && vers <= 30;
    },
    fait: G => G.salons.length >= 1 },
];

/**
 * L'etape courante : la premiere qui est pertinente et pas encore faite.
 * Recalculee a chaque appel — c'est ce qui la rend impossible a desynchroniser.
 */
export function etapeCourante(G){
  for(const e of ETAPES){
    if(e.pertinent && !e.pertinent(G)) continue;
    if(!e.fait(G)) return e;
  }
  return null;
}

export function progression(G){
  const total = ETAPES.length;
  const faites = ETAPES.filter(e => e.fait(G)).length;
  return { faites, total, fini: faites >= total };
}

/** Le bandeau du guide. Rendu par ui.js, decide ici. */
export function bandeau(G){
  const e = etapeCourante(G);
  if(!e) return "";
  const p = progression(G);
  return `<div class="bandeau guide">
    <b>GUIDE ${p.faites}/${p.total}</b> — ${e.txt}
    <button data-act="onglet" data-o="${e.onglet}">y aller</button>
    <button data-act="guide-off" class="discret">masquer</button>
  </div>`;
}
