/**
 * concurrents.js — les planners rivaux et la course a la notoriete.
 * Herite de guilds.js. Ils font trois choses, et chacune coute quelque chose
 * au joueur : ils bloquent des prestataires (voir prestataires.js), ils
 * recuperent les clients refuses, et ils se presentent au salon.
 *
 * ⚠️ Leur notoriete SUIT la tienne (RIVALITE.GAIN_SUIVI). Sans indexation, ils
 * decrochent au palier 2 et le classement du salon devient une formalite —
 * c'est le meme defaut que les guildes d'Aincrad qui plafonnaient a l'etage 30.
 */

import { alea, rnd } from "./utils.js";
import { CONCURRENTS, RIVALITE, STYLE, AFFINITE_STYLES, STYLES } from "./config.js";

export function concurrentsInitiaux(){
  return CONCURRENTS.map((c, i) => ({
    ...c,
    // Ils ne partent pas tous de zero : un jeu ou l'on est d'emblee premier
    // n'a pas de course.
    notoriete: 40 + i * 18,
    reprises: 0,
  }));
}

/** Un jour de plus pour eux. Appele une fois par tick. */
export function jourConcurrents(liste, notorieteJoueur){
  for(const c of liste){
    const suivi = Math.max(0, notorieteJoueur - c.notoriete) * RIVALITE.GAIN_SUIVI * 0.01;
    c.notoriete += (RIVALITE.GAIN_BASE + suivi) * c.agressivite * rnd(0.7, 1.3);
  }
}

/**
 * Un prospect refuse ou perdu part chez quelqu'un. Il va chez celui dont le
 * style colle le mieux a ses gouts : c'est ce qui rend visible le fait qu'on
 * vient de donner un client a un rival PRECIS.
 */
export function reprendreClient(liste, couple){
  let meilleur = liste[0], score = -1;
  for(const c of liste){
    let a = 0, t = 0;
    for(const s of STYLES){
      const g = couple.gouts[s] || 0;
      a += g * AFFINITE_STYLES[c.style][s];
      t += g;
    }
    const v = (t ? a / t : 0.5) * c.agressivite * rnd(0.85, 1.15);
    if(v > score){ score = v; meilleur = c; }
  }
  meilleur.notoriete += RIVALITE.GAIN_PAR_REPRISE;
  meilleur.reprises++;
  return meilleur;
}

/** Le classement general, joueur inclus. */
export function classement(liste, notorieteJoueur, nomJoueur = "Ton atelier"){
  const tout = [
    ...liste.map(c => ({ cle:c.cle, txt:c.txt, notoriete:c.notoriete,
                         couleur:c.couleur, joueur:false })),
    { cle:"joueur", txt:nomJoueur, notoriete:notorieteJoueur,
      couleur:"#e69aa6", joueur:true },
  ];
  tout.sort((a, b) => b.notoriete - a.notoriete);
  return tout.map((x, i) => ({ ...x, rang:i + 1 }));
}

export const rangDuJoueur = (liste, notorieteJoueur) =>
  classement(liste, notorieteJoueur).find(x => x.joueur).rang;

export const ficheConcurrent = c => ({
  cle:c.cle, txt:c.txt, notoriete:Math.round(c.notoriete),
  style:c.style, styleTxt:STYLE[c.style].txt, couleur:c.couleur,
  reprises:c.reprises,
});
