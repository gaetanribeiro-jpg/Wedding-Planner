/**
 * codex.js — ce que l'atelier a APPRIS.
 *
 * ⚠️ REGLE DE DESIGN, PAS LIMITE TECHNIQUE : le codex n'inscrit que ce qui a
 * MARCHE. Jamais ce qui rate, jamais ce qui marche moins bien, jamais une
 * mise en garde.
 *
 * Le jeu connait parfaitement les mauvais accords — la table d'affinites est
 * dans config.js. S'il les affichait, meme sous forme d'avertissement (« de
 * l'or sur un couple boheme, ça jure »), il donnerait la reponse et le coeur
 * du jeu s'effondrerait : decouvrir POUR QUI une piece est faite est
 * l'essentiel de ce qu'on demande au joueur (decision de design n°4).
 *
 * Le silence sur ce qui rate n'est donc pas une omission : c'est la moitie du
 * systeme. Le joueur apprend par le jour J — quatre axes qui disent ce qui a
 * manque — pas par une infobulle.
 *
 * Corollaire d'implementation : ce module n'expose AUCUNE fonction qui reponde
 * « ça ne marche pas ». Il ne sait dire que « ça a marché, telle fois ».
 */

import { CODEX, STYLE, STYLES, SLOT, FAMILLES, PRESTATAIRES } from "./config.js";

export const codexInitial = () => ({
  // accord de deux styles dans un meme dossier : "boheme|romantique" -> n
  accords: {},
  // un prestataire qui a brille pour un gout dominant : "grangeVerger|boheme"
  prestas: {},
  // une famille de piece qui a plu a un gout dominant : "robe|boheme|boheme"
  familles: {},
  // un combo de meubles constate en boutique
  combos: {},
});

const bump = (table, cle) => { table[cle] = (table[cle] || 0) + 1; };

/**
 * Enregistre ce qu'un mariage a appris.
 *
 * ⚠️ On n'apprend QUE d'un succes, et seulement sur les axes qui ont ete
 * franchement bons. Un mariage tout juste passable n'enseigne rien — et
 * surtout, inscrire une combinaison mediocre reviendrait a la recommander.
 */
export function apprendre(codex, res, ctr, stockParId, dominant){
  if(!res.reussi || res.note < CODEX.SEUIL_NOTE) return [];
  const neuf = [];

  const styleDe = slot => {
    const v = ctr.choix[slot];
    if(v == null) return null;
    if(SLOT[slot].source === "stock"){
      const a = stockParId[v];
      return a ? a.style : null;
    }
    return PRESTATAIRES[v] ? PRESTATAIRES[v].style : null;
  };

  const slots = Object.keys(ctr.choix).filter(s => ctr.choix[s] != null);

  // 1. Les accords de styles — seulement si la COHERENCE a ete bonne.
  if(res.axes.coherence >= CODEX.SEUIL_AXE){
    for(let i = 0; i < slots.length; i++)
      for(let j = i + 1; j < slots.length; j++){
        const a = styleDe(slots[i]), b = styleDe(slots[j]);
        if(!a || !b) continue;
        // Cle ordonnee : « boheme + romantique » et « romantique + boheme »
        // sont le meme apprentissage.
        const cle = [a, b].sort().join("|");
        if(!codex.accords[cle]) neuf.push({ type:"accord", cle });
        bump(codex.accords, cle);
      }
  }

  // 2. Les prestataires qui ont porte l'EMOTION pour ce gout dominant.
  if(res.axes.emotion >= CODEX.SEUIL_AXE){
    for(const s of slots){
      if(SLOT[s].source !== "prestataire") continue;
      const cle = `${ctr.choix[s]}|${dominant}`;
      if(!codex.prestas[cle]) neuf.push({ type:"presta", cle });
      bump(codex.prestas, cle);
    }
  }

  // 3. Les familles de pieces qui ont porte l'ELEGANCE pour ce gout.
  if(res.axes.elegance >= CODEX.SEUIL_AXE){
    for(const s of slots){
      if(SLOT[s].source !== "stock") continue;
      const a = stockParId[ctr.choix[s]];
      if(!a) continue;
      const cle = `${a.slot}|${a.famille}|${dominant}`;
      if(!codex.familles[cle]) neuf.push({ type:"famille", cle });
      bump(codex.familles, cle);
    }
  }

  return neuf;
}

/** Un combo de boutique se decouvre en le voyant tourner, pas en le lisant. */
export function apprendreCombo(codex, txt){
  const neuf = !codex.combos[txt];
  bump(codex.combos, txt);
  return neuf;
}

/* ------------------------------------------------------------- lectures
   Toutes rendent des listes de choses QUI ONT MARCHE. Aucune ne peut repondre
   « ceci ne marche pas » — c'est volontaire, et ça doit le rester. */

export function accordsConnus(codex){
  return Object.entries(codex.accords)
    .map(([cle, n]) => {
      const [a, b] = cle.split("|");
      return { a, b, n,
               txt: a === b ? `${STYLE[a].txt} avec lui-même`
                            : `${STYLE[a].txt} + ${STYLE[b].txt}`,
               couleurA: STYLE[a].couleur, couleurB: STYLE[b].couleur };
    })
    .sort((x, y) => y.n - x.n);
}

export function prestasConnus(codex){
  return Object.entries(codex.prestas)
    .map(([cle, n]) => {
      const [presta, gout] = cle.split("|");
      const d = PRESTATAIRES[presta];
      if(!d) return null;
      return { n, txt:d.txt, type:d.type,
               goutTxt: STYLE[gout].txt, couleur: STYLE[gout].couleur };
    })
    .filter(Boolean)
    .sort((x, y) => y.n - x.n);
}

export function famillesConnues(codex){
  return Object.entries(codex.familles)
    .map(([cle, n]) => {
      const [slot, famille, gout] = cle.split("|");
      const d = FAMILLES[slot] && FAMILLES[slot][famille];
      if(!d) return null;
      return { n, slotTxt: SLOT[slot].txt, txt: d.txt,
               goutTxt: STYLE[gout].txt, couleur: STYLE[gout].couleur };
    })
    .filter(Boolean)
    .sort((x, y) => y.n - x.n);
}

export const combosConnus = codex =>
  Object.entries(codex.combos).map(([txt, n]) => ({ txt, n }))
    .sort((x, y) => y.n - x.n);

/**
 * Combien reste-t-il a decouvrir ? On donne le TOTAL, pas la liste : savoir
 * qu'il reste des choses est une invitation, savoir lesquelles serait la
 * reponse.
 */
export function avancement(codex){
  const accordsPossibles = STYLES.length * (STYLES.length + 1) / 2;
  const trouves = Object.keys(codex.accords).length
                + Object.keys(codex.prestas).length
                + Object.keys(codex.familles).length
                + Object.keys(codex.combos).length;
  return { trouves, accords: Object.keys(codex.accords).length, accordsPossibles };
}
