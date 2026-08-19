/**
 * sons.js — bruitages, synthetises. Aucun fichier audio.
 *
 * Cinq bruitages changent completement la sensation d'un jeu de gestion, et
 * c'est l'ecart le plus brutal avec un jeu fini. Les generer en WebAudio evite
 * d'ajouter des centaines de kilo-octets au build solo, qui tient dans un seul
 * fichier — et un son de synthese carre colle a la direction pixel bien mieux
 * qu'un echantillon realiste.
 *
 * ⚠️ Le contexte audio ne peut PAS demarrer avant un geste du joueur : les
 * navigateurs le suspendent. On l'ouvre paresseusement au premier son demande
 * apres une interaction, et tout appel anterieur est ignore en silence.
 *
 * ⚠️ Aucune fonction d'ici ne doit lever : un bruitage rate ne doit jamais
 * interrompre une journee de jeu. Tout est enveloppe.
 */

let ctx = null, actif = true, pret = false;

/** Le joueur a interagi : on peut ouvrir le contexte. Appele par main.js. */
export function debloquerSons(){
  pret = true;
  try{ ctx?.resume(); }catch{}
}

export const sonsActifs = () => actif;
export function basculerSons(){
  actif = !actif;
  try{ localStorage.setItem("jourj-sons", actif ? "1" : "0"); }catch{}
  return actif;
}
try{ actif = localStorage.getItem("jourj-sons") !== "0"; }catch{}

function contexte(){
  if(!pret || !actif) return null;
  try{
    if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if(ctx.state === "suspended") ctx.resume();
    return ctx;
  }catch{ return null; }
}

/**
 * Une note. `forme` carre ou triangle — jamais sinus : trop lisse pour du
 * pixel, il sonne « application » et pas « jeu ».
 */
function note(freq, duree, { forme = "square", vol = .06, glisse = 0, retard = 0 } = {}){
  const c = contexte(); if(!c) return;
  try{
    const t0 = c.currentTime + retard;
    const o = c.createOscillator(), g = c.createGain();
    o.type = forme;
    o.frequency.setValueAtTime(freq, t0);
    if(glisse) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * glisse), t0 + duree);
    // Attaque immediate, extinction exponentielle : c'est l'enveloppe d'une
    // puce sonore. Une attaque douce donnerait un son de nappe.
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + duree);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + duree + .02);
  }catch{}
}

const arpege = (freqs, pas, opts) =>
  freqs.forEach((f, i) => note(f, pas * 1.6, { ...opts, retard:i * pas }));

/* Le repertoire. Un son par EVENEMENT de jeu, pas par element d'interface :
   un jeu qui cliquette a chaque tap fatigue en deux minutes.
   ⚠️ Le moteur ci-dessus est verbatim ; seuls les NOMS changent, parce qu'un
   son se nomme par l'evenement qui le declenche et que les evenements de ce
   jeu ne sont plus ceux d'Aincrad. */
export const SONS = {
  // Pose d'un meuble : un coup sec, grave, sans queue.
  meuble:     () => { note(180, .07, { vol:.07 }); note(120, .11, { retard:.05, vol:.05 }); },
  // Piece : deux notes montantes, la signature de tous les jeux de gestion.
  piece:      () => { note(1050, .05, { vol:.035 }); note(1560, .09, { retard:.05, vol:.03 }); },
  // Contrat signe : la fanfare courte. C'est le moment ou le jeu commence.
  contrat:    () => arpege([523, 659, 784, 1047, 1319], .075, { vol:.07 }),
  // Jour J reussi : plus grave et plus large que la fanfare, on a gravi un cran.
  jourJ:      () => arpege([392, 523, 659, 784], .11, { vol:.08, forme:"triangle" }),
  // Mariage rate : une chute. Une seule note qui glisse vers le bas, sans resolution.
  rate:       () => note(320, .55, { glisse:.28, vol:.09, forme:"triangle" }),
  // Achat de stock : montee rapide, puis la note tenue de la revelation.
  achat:      () => { arpege([440, 554, 659], .06, { vol:.05 }); note(880, .5, { retard:.2, vol:.05, forme:"triangle" }); },
  // Piece d'exception : la meme, une octave au-dessus et deux fois plus longue.
  exception:  () => arpege([659, 831, 988, 1319, 1661], .1, { vol:.08, forme:"triangle" }),
  // Deblocage d'un palier de notoriete.
  palier:     () => arpege([784, 1047], .09, { vol:.05 }),
  // Refus : un buzz court. Il dit « non » sans texte.
  refus:      () => note(140, .12, { vol:.05, glisse:.7 }),
};
/** Joue un son du repertoire. Nom inconnu = silence, jamais d'erreur. */
export function jouer(nom){ try{ SONS[nom]?.(); }catch{} }
