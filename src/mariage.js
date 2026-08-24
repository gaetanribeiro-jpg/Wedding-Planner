/**
 * mariage.js — la resolution d'un jour J. Herite de combat.js.
 *
 * ⚠️ Regle d'architecture non negociable (elle a tenu sur Aincrad) : le jour J
 * est ENTIEREMENT resolu avant d'etre anime. `resoudre()` ne touche ni au DOM
 * ni au canvas, et rend une TRACE. L'animation rejoue la trace ; elle ne peut
 * donc pas diverger de l'issue, et l'oracle mesure exactement ce que le joueur
 * verra.
 *
 * Quatre axes plutot qu'un chiffre : un score unique ne dit pas ce qu'on a
 * rate, et c'est precisement ce qu'on veut corriger au mariage suivant.
 */

import { clamp } from "./utils.js";
import { AXES, MARIAGE, SLOTS, SLOT, STYLES, STYLE,
         AFFINITE_STYLES, PRESTATAIRES, VENTE, PRESTA_TYPES } from "./config.js";
import { bonusElegance, bonusCoherence } from "./equipe.js";
import { qualiteBrute, bonusAffixes } from "./stock.js";
import { nomCouple, styleDominant } from "./clients.js";

/**
 * Ce qui occupe un emplacement, ramene a une forme commune : un style, une
 * qualite brute, et de quoi lire les affixes. Les deux natures (stock et
 * prestataire) se rejoignent ici, et seulement ici.
 */
function piece(ctr, slot, stockParId){
  const choix = ctr.choix[slot];
  if(!choix) return null;
  if(SLOT[slot].source === "stock"){
    const a = stockParId[choix];
    if(!a) return null;
    return { nature:"stock", art:a, style:a.style, qualite:qualiteBrute(a),
             txt:`${a.famille}`, ref:a };
  }
  const d = PRESTATAIRES[choix];
  if(!d) return null;
  return { nature:"presta", art:null, style:d.style, qualite:d.qualite,
           txt:d.txt, ref:d };
}

/** Affinite d'un style avec les gouts d'un couple, sur 0..1. */
function affiniteGouts(style, couple){
  let a = 0, t = 0;
  for(const s of STYLES){
    const g = couple.gouts[s] || 0;
    a += g * AFFINITE_STYLES[style][s];
    t += g;
  }
  return t > 0 ? a / t : 0.5;
}

/**
 * Resout un jour J. Rend { note, axes, reussi, honoraires, notoriete,
 * boucheAOreille, trace, resume }.
 *
 * `stockParId` : un index id -> article. Passe en argument plutot que lu dans
 * un etat global, pour que l'oracle puisse resoudre un dossier sans monter une
 * partie complete.
 */
export function resoudre(ctr, stockParId, contexte = {}){
  const couple = ctr.couple;
  // L'equipe entre ici, et pas dans un total affiche ailleurs : c'est la
  // lecture du role de styliste (piege herite n°2).
  const equipe = contexte.equipe || [];
  const jour = contexte.jour || 0;
  const pieces = {};
  for(const s of SLOTS) pieces[s] = piece(ctr, s, stockParId);

  const remplis = SLOTS.filter(s => pieces[s]);
  const vides = SLOTS.filter(s => !pieces[s]);
  const poidsTotal = SLOTS.reduce((t, s) => t + SLOT[s].poids, 0);

  /* ------------------------------------------------------------ elegance
     La qualite intrinseque de ce qui est presente. C'est le seul axe ou la
     piece chere gagne dans l'absolu — et c'est pour ca qu'il ne pese que 30 %. */
  let elegance = 0;
  for(const s of remplis){
    const p = pieces[s];
    const bonus = p.nature === "stock" ? bonusAffixes(p.art, "elegance") : 0;
    elegance += (p.qualite + bonus) * SLOT[s].poids;
  }
  elegance /= poidsTotal;
  elegance += bonusElegance(equipe, jour);
  // ⚠️ Un slot vide ne vaut pas zero : il fait activement mal. Sans ca,
  // remplir six emplacements avec du mediocre serait toujours pire que d'en
  // remplir trois avec du bon, et le jeu recompenserait le dossier a trous.
  for(const s of vides) elegance -= MARIAGE.PENALITE_SLOT_VIDE * SLOT[s].poids / poidsTotal * 6;

  /* ----------------------------------------------------------- coherence
     Deux choses, et il faut les deux : que ca colle a LEURS gouts, et que les
     pieces aillent ENTRE ELLES. Un dossier peut etre parfaitement assorti et
     completement a cote de la plaque. */
  let partGouts = 0;
  for(const s of remplis) partGouts += affiniteGouts(pieces[s].style, couple) * SLOT[s].poids;
  partGouts = remplis.length
    ? partGouts / remplis.reduce((t, s) => t + SLOT[s].poids, 0)
    : 0;

  let partAccord = 0, paires = 0;
  for(let i = 0; i < remplis.length; i++)
    for(let j = i + 1; j < remplis.length; j++){
      partAccord += AFFINITE_STYLES[pieces[remplis[i]].style][pieces[remplis[j]].style];
      paires++;
    }
  partAccord = paires ? partAccord / paires : 0.5;

  let coherence = 100 * (MARIAGE.PART_GOUTS * partGouts
                       + (1 - MARIAGE.PART_GOUTS) * partAccord);
  coherence += bonusCoherence(equipe, jour);
  for(const s of remplis)
    if(pieces[s].nature === "stock") coherence += bonusAffixes(pieces[s].art, "coherence");
  for(const s of vides) coherence -= MARIAGE.PENALITE_SLOT_VIDE * 0.7;

  /* ------------------------------------------------------------- emotion
     Ce qui fait pleurer la tante. Ce sont le lieu, la musique et la
     decoration qui la portent, pas la robe : c'est ce qui empeche de tout
     miser sur un seul emplacement. */
  const PORTEURS = { lieu:1.15, musique:1.30, decoration:1.25, robe:0.55, costume:0.35, traiteur:0.85 };
  let emotion = 0, poidsEmo = 0;
  for(const s of remplis){
    const p = pieces[s], w = PORTEURS[s];
    const bonus = p.nature === "stock" ? bonusAffixes(p.art, "emotion") : 0;
    emotion += (p.qualite + bonus) * w;
    poidsEmo += w;
  }
  emotion = poidsEmo ? emotion / poidsEmo : 0;
  // Un dossier qui tape pile dans le style dominant du couple emporte tout.
  const dom = styleDominant(couple);
  const dansLeMille = remplis.filter(s => pieces[s].style === dom).length;
  emotion += dansLeMille * 3.5;
  for(const s of vides) emotion -= MARIAGE.PENALITE_SLOT_VIDE * (PORTEURS[s] || 1) * 0.8;

  /* -------------------------------------------------------------- budget
     Depenser trop est puni, mais depenser trop peu l'est aussi : un couple
     qui a mis 12 000 € sur la table et voit 4 000 € de mariage se sent volé. */
  const part = couple.budget > 0 ? ctr.depense / couple.budget : 1;
  let budget;
  if(part > MARIAGE.BUDGET_TOLERANCE){
    budget = 100 - (part - MARIAGE.BUDGET_TOLERANCE) * MARIAGE.BUDGET_PENALITE;
  }else if(part >= 0.72){
    budget = 100;
  }else{
    // En dessous de 72 % du budget, la note descend vite : c'est ce qui evite
    // la strategie « tout au rabais », qui rendrait l'argent sans interet.
    budget = 100 - (0.72 - part) * 170;
  }
  for(const s of remplis)
    if(pieces[s].nature === "stock") budget += bonusAffixes(pieces[s].art, "budget");

  const axes = {
    elegance:  clamp(Math.round(elegance),  0, 100),
    coherence: clamp(Math.round(coherence), 0, 100),
    emotion:   clamp(Math.round(emotion),   0, 100),
    budget:    clamp(Math.round(budget),    0, 100),
  };

  const note = clamp(Math.round(
    Object.keys(AXES).reduce((s, k) => s + axes[k] * AXES[k].poids, 0)), 0, 100);

  /* ------------------------------------------------------------- l'issue
     ⚠️ Il faut des dents (decision de design n°7). Sans echec reel, le jeu
     devient un clicker confortable — c'est le point de design le plus
     important apres la boucle. */
  const reussi = note >= couple.exigence;

  /* Deux robinets, et ils disent deux metiers differents.
     - Les HONORAIRES paient ton travail : ils suivent le budget et la note.
     - La COMMISSION paie ce que tu as fait reserver : elle suit ce que tu as
       reellement engage chez des prestataires.
     ⚠️ C'est ce qui fait que l'argent s'accumule sur des PRESTATIONS et pas
     sur un forfait. Un dossier ou l'on n'a rien reserve ne commissionne rien. */
  let honoraires = couple.budget * MARIAGE.TAUX_HONORAIRES
                 * (1 + MARIAGE.BONUS_NOTE * note / 100);
  const commission = Math.round(ctr.depense * VENTE.COMMISSION_PRESTA);
  if(!reussi) honoraires *= (1 - MARIAGE.MALUS_RATE_HONORAIRES);
  honoraires += commission;

  const notoriete = reussi
    ? MARIAGE.NOTORIETE_BASE
      + note * MARIAGE.NOTORIETE_PAR_NOTE
      + couple.invites * MARIAGE.NOTORIETE_PAR_INVITE
    : -MARIAGE.MALUS_RATE_NOTORIETE;

  const boucheAOreille = reussi ? note * MARIAGE.BOUCHE_A_OREILLE : 0;

  return {
    contratId: ctr.id,
    couple: nomCouple(couple),
    invites: couple.invites,
    note, axes, reussi,
    exigence: couple.exigence,
    honoraires: Math.round(honoraires),
    commission,
    depense: ctr.depense,
    budget: couple.budget,
    notoriete: Math.round(notoriete),
    boucheAOreille,
    // Les prestataires avec qui on vient de travailler : ils se fidelisent.
    prestas: SLOTS.filter(s => SLOT[s].source === "prestataire" && ctr.choix[s])
                  .map(s => ctr.choix[s]),
    // Les pieces de stock utilisees : elles s'usent.
    articles: SLOTS.filter(s => SLOT[s].source === "stock" && ctr.choix[s])
                   .map(s => ctr.choix[s]),
    trace: tracer(ctr, pieces, axes, note, reussi, contexte),
    resume: resumer(couple, axes, note, reussi, vides),
  };
}

/**
 * La trace : la suite de moments que l'animation rejouera. Elle est produite
 * PAR la resolution, jamais recalculee a l'affichage — c'est ce qui garantit
 * que l'ecran raconte l'issue reelle.
 */
function tracer(ctr, pieces, axes, note, reussi, contexte){
  const t = [];
  const nom = s => pieces[s] ? pieces[s].txt : null;
  t.push({ tps:0.00, scene:"arrivee",
    txt: pieces.lieu ? `On arrive ${ctr.couple.lieuTxt}, ${nom("lieu")}.`
                     : `Personne n'a réservé de lieu.`,
    axe:"coherence" });
  t.push({ tps:0.22, scene:"ceremonie",
    txt: pieces.robe ? `La robe fait son effet dans l'allée.`
                     : `La mariée n'a pas de robe. Le silence est long.`,
    axe:"elegance" });
  t.push({ tps:0.46, scene:"repas",
    txt: pieces.traiteur ? `${nom("traiteur")} sert, et ça se voit sur les visages.`
                         : `Le buffet est vide.`,
    axe:"budget" });
  t.push({ tps:0.70, scene:"danse",
    txt: pieces.musique ? `${nom("musique")} ouvre le bal.`
                        : `Pas de musique : la piste reste vide.`,
    axe:"emotion" });
  t.push({ tps:0.92, scene:"final",
    txt: reussi ? `${note} sur 100. On en reparlera.`
                : `${note} sur 100. Ils attendaient ${ctr.couple.exigence}.`,
    axe:null });
  // Le contexte (meteo, salon gagne l'annee d'avant) ne change pas l'issue :
  // il ne fait qu'habiller la trace. Toute donnee qui modifierait le score
  // doit passer par les axes, sinon l'animation reprendrait la main sur la
  // resolution — exactement ce que l'architecture interdit.
  if(contexte.txt) t.push({ tps:0.99, scene:"final", txt:contexte.txt, axe:null });
  return t;
}

/** Une phrase qui dit ce qu'il fallait corriger. C'est la vraie recompense. */
function resumer(couple, axes, note, reussi, vides){
  if(vides.length >= 3)
    return `Un dossier à trous : ${vides.length} emplacements vides sur six. Ça ne pardonne pas.`;
  const pire = Object.keys(AXES).reduce((a, b) => axes[b] < axes[a] ? b : a);
  if(!reussi){
    // ⚠️ On dit QUEL AXE a lache, jamais quel style il fallait. Nommer le gout
    // dominant ici reviendrait a donner la reponse apres coup — le joueur doit
    // la relier lui-meme aux gouts affiches sur la fiche du couple.
    if(pire === "coherence") return `Rien n'allait ensemble. Ça ne leur ressemblait pas.`;
    if(pire === "budget")    return `Le budget a lâché avant la fin.`;
    if(pire === "elegance")  return `Rien n'était à la hauteur de ce qu'ils avaient imaginé.`;
    return `Joli sur le papier, plat dans la salle.`;
  }
  if(note >= 92) return `Un mariage dont on parlera pendant des années.`;
  if(axes[pire] < 55){
    // « le élégance » : l'elision est la seule grammaire que ce jeu ait a
    // gerer, et elle saute aux yeux dans un panneau de resultat.
    const t = AXES[pire].txt.toLowerCase();
    const art = /^[aeiouéèêàâîôû]/.test(t) ? "l'" : "le ";
    return `Réussi, mais ${art}${t} a failli tout gâcher.`;
  }
  return `Ils repartent conquis.`;
}

/** Les axes formates pour l'affichage, dans l'ordre de la charte. */
export const axesAffiches = res =>
  Object.keys(AXES).map(k => [AXES[k].txt, res.axes[k], AXES[k].couleur]);
