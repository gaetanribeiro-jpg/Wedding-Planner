/**
 * gens.js — les personnages pixel : maries, invites, prestataires, toi.
 * Herite de villageois.js, et repris VERBATIM des maquettes validees : les
 * recettes de ce fichier sont celles qui ont passe la planche contact, avec
 * les cinq lecons de pixel art deja payees dessus (voir CLAUDE.md).
 *
 * ⚠️ AUCUNE fonction d'ici n'appelle `alea()`, et aucune ne doit jamais le
 * faire. La peau, les cheveux, la teinte d'un invite viennent d'un HACHAGE de
 * son nom : un sprite qui consommerait le generateur decalerait toute la
 * partie a graine egale et rendrait l'equilibrage intestable (piege n°1).
 */

import { grille, poser, sym, rect, bande, ovale, ligne, cerner, ombrer,
         rendre, teinter } from "./pixel.js";
import { hachage } from "./utils.js";
import { STYLE } from "./config.js";

/* Les marqueurs. Une lettre par matiere : c'est ce qui permet de DERIVER
   l'ombrage, puisqu'on sait quelles matieres s'ombrent et lesquelles non. */
const V = ".", O = "o", OE = "e";
const PE="S", PEo="s", CH="H", CHo="h", TI="A", TIo="a", SE="B", SEo="b";
const DE="D", DEo="d", ME="M", MEo="m", CU="K", CUo="k", JA="N", JAo="n";
const AC="R", VO="W";                    // accent et voile : jamais ombres
const OMB = { [PE]:PEo, [CH]:CHo, [TI]:TIo, [SE]:SEo,
              [DE]:DEo, [ME]:MEo, [CU]:CUo, [JA]:JAo };

export const PL = 20, PH = 28;
const CX=9.5, TCY=6, TRX=3.4, TRY=3.2, YCOU=10, YTOR=11, YTAILLE=16, YSOL=26;

/* Trapeze symetrique : demi-largeur du haut vers celle du bas. C'est la forme
   de base d'une jupe, et le seul primitif qu'il a fallu ajouter a pixel.js. */
function jupe(g, yHaut, yBas, demiHaut, demiBas, m){
  for(let y = yHaut; y <= yBas; y++){
    const t = (y - yHaut) / Math.max(1, (yBas - yHaut));
    const d = demiHaut + (demiBas - demiHaut) * t;
    for(let i = 0; i < d; i++) sym(g, Math.floor((g.L - 1) / 2) - i, y, m);
  }
}
function couture(g, y, demi, m){ for(let i = 0; i < demi; i++) sym(g, 9 - i, y, m); }
/* Plis verticaux : deux colonnes assombries. Une jupe en aplat uni se lit
   comme un cone de papier, pas comme du tissu. */
function plis(g, yh, yb, cols, m){
  for(let y = yh; y <= yb; y++) for(const x of cols) sym(g, x, y, m);
}

/**
 * Les cinq silhouettes de robe.
 *
 * ⚠️ C'est LE test qui decide de tout : si une princesse et une sirene se
 * ressemblent, tout le systeme de gouts s'effondre. Premiere version ratee, et
 * la lecon vaut d'etre gardee : a 20 px de large, une difference de deux
 * pixels n'existe pas. Il faut EXAGERER — la princesse touche les bords de la
 * grille, la sirene est franchement moulante PUIS franchement evasee. Et
 * chacune porte une couture de taille dans un ton contraste : sans elle, une
 * robe ivoire est un aplat, parce que l'ombrage derive ne mord pas sur du
 * presque-blanc.
 */
export const ROBES = {
  princesse:{ txt:"Princesse", buste:"bustier", jupe:(g,m,d)=>{
    // Taille TRES cintree puis cloche pleine largeur : le contraste entre les
    // deux est tout ce qui fait la princesse.
    jupe(g,YTAILLE,YTAILLE+2,2,5,m);
    jupe(g,YTAILLE+2,YSOL,5,10,m);
    plis(g,YTAILLE+4,YSOL-1,[4,6],TIo);
    couture(g,YTAILLE,2,d);
    couture(g,YSOL-1,10,d);
  }},
  sirene:{ txt:"Sirène", buste:"bustier", jupe:(g,m,d)=>{
    // Moulante sur DEUX pixels de demi-largeur : au-dessus de trois, ca ne se
    // distingue plus d'une robe droite. La rupture doit etre franche.
    jupe(g,YTAILLE,YSOL-4,2,2,m);
    jupe(g,YSOL-3,YSOL,3,10,m);
    plis(g,YSOL-2,YSOL,[5,7],TIo);
    couture(g,YTAILLE,2,d); couture(g,YSOL-4,2,TIo);
  }},
  boheme:{ txt:"Bohème", buste:"manches", jupe:(g,m,d)=>{
    jupe(g,YTAILLE-1,YSOL,3,6,m);
    plis(g,YTAILLE+1,YSOL-1,[7],TIo);
    couture(g,YTAILLE-1,3,d);                   // taille marquee par une ceinture
    couture(g,YSOL,6,d); couture(g,YSOL-1,6,d); // ourlet de dentelle
    sym(g,4,YSOL,d); sym(g,3,YSOL,d);
  }},
  empire:{ txt:"Empire", buste:"bretelles", jupe:(g,m,d)=>{
    // Colonne lisse a taille tres haute. Pas de plis : les rayures verticales
    // la faisaient lire comme un tonneau, et surtout comme une boheme.
    jupe(g,YTAILLE-4,YSOL,3,6,m);
    couture(g,YTAILLE-4,3,d); couture(g,YTAILLE-3,3,d);
    plis(g,YTAILLE,YSOL-1,[6],TIo);
  }},
  courte:{ txt:"Courte", buste:"manches", jupe:(g,m,d)=>{
    jupe(g,YTAILLE,YSOL-6,3,6,m);
    couture(g,YTAILLE,3,d); couture(g,YSOL-6,6,d);
    // Des jambes SOUS la jupe : sans elles la robe courte se lit comme une
    // robe longue coupee, et le personnage est pose dans un seau.
    for(let y=YSOL-5;y<YSOL;y++){ rect(g,7,y,2,1,JA); rect(g,11,y,2,1,JA); }
    rect(g,7,YSOL,2,1,CU); rect(g,11,YSOL,2,1,CU);
  }},
};

function buste(g, forme, tissu, dentelle){
  bande(g,4,YTOR,1,tissu);                       // epaules
  bande(g,3,YTOR+1,4,tissu);                     // buste
  if(forme === "bustier"){
    // Epaules NUES : c'est ce qui distingue un bustier d'une robe a manches a
    // cette taille — pas le decollete, qui fait deux pixels.
    bande(g,4,YTOR,1,PE);
    for(let y=YTOR+1;y<=YTOR+2;y++) sym(g,6,y,PE);
    bande(g,3,YTOR+1,1,dentelle);
  }else if(forme === "manches"){
    for(let y=YTOR+1;y<=YTOR+4;y++) sym(g,5,y,tissu);
    sym(g,5,YTOR+5,PE);                          // mains
  }else if(forme === "bretelles"){
    bande(g,4,YTOR,1,PE);
    sym(g,7,YTOR,tissu); sym(g,8,YTOR,tissu);
    bande(g,3,YTOR+2,1,dentelle);
  }
  if(forme !== "manches"){
    for(let y=YTOR+2;y<=YTOR+4;y++) sym(g,5,y,PE);
    sym(g,5,YTOR+5,PE);
  }
}

function tete(g, dos, coiffe, pose){
  rect(g,8,YCOU,4,1,PE);
  ovale(g,CX,TCY,TRX,TRY,PE);
  ovale(g,CX,TCY-.6,TRX+.3,TRY+.3,CH);
  if(!dos){
    ovale(g,CX,TCY+.8,TRX-.7,TRY-.8,PE);
    poser(g,7,TCY+1,OE); poser(g,12,TCY+1,OE);
    if(pose === "joie") rect(g,9,TCY+3,2,1,OE);
  }
  if(coiffe === "chignon"){ bande(g,2,TCY-5,2,CH); sym(g,7,TCY-3,CH); }
  else if(coiffe === "long"){ for(let y=TCY;y<=YTOR+3;y++) sym(g,6,y,CH); sym(g,7,YTOR+4,CH); }
  else if(coiffe === "court"){ bande(g,4,TCY-3,1,CH); }
  else if(coiffe === "boucles"){ for(const [x,y] of [[5,TCY],[5,TCY+1],[6,TCY+2],[4,TCY-1]]) sym(g,x,y,CH); }
  else if(coiffe === "toque"){ bande(g,4,TCY-3,1,DE); bande(g,3,TCY-6,3,DE); }
  else if(coiffe === "casque"){
    bande(g,4,TCY-4,1,ME);                       // arceau
    sym(g,6,TCY-3,ME);
    for(let y=TCY-2;y<=TCY+1;y++){ sym(g,5,y,ME); sym(g,6,y,ME); }   // ecouteurs
    for(let y=TCY-1;y<=TCY;y++) sym(g,5,y,AC);   // coussinets colores
  }
}

/**
 * Le VOILE est un marqueur non ombre : un aplat qui ne s'assombrit sur aucun
 * bord se lit comme du tulle.
 *
 * ⚠️ Il se dessine DERRIERE le corps, pas par-dessus. Premiere version : un
 * ovale pose sur la tete — la mariee n'avait plus de visage et, robe ivoire
 * sous voile ivoire, elle sortait en tache blanche. D'un voile, ce qu'on voit,
 * c'est ce qui DEPASSE de la silhouette.
 */
function voileArriere(g){
  for(let y=TCY-1;y<=YTAILLE+6;y++){ sym(g,5,y,VO); sym(g,4,y,VO); }
  for(let y=YTAILLE+4;y<=YTAILLE+7;y++){ sym(g,3,y,VO); }
  bande(g,7,TCY-4,1,VO);
}

/* La couronne, elle, se pose devant : c'est ce qui dit « mariee » de face. */
function couronne(g){
  // Un diademe TIENT DANS LA LARGEUR DU CRANE. Deborder d'un pixel de chaque
  // cote et il se lit comme une helice posee sur la tete.
  bande(g,4,TCY-3,1,AC);
  poser(g,7,TCY-4,AC); poser(g,12,TCY-4,AC);
  poser(g,9,TCY-4,AC); poser(g,10,TCY-4,AC);
}

function accessoire(g, a){
  if(a === "bouquet"){
    ovale(g,15,YTOR+4,2.2,2,AC); poser(g,15,YTOR+6,CU); poser(g,15,YTOR+7,CU);
    poser(g,14,YTOR+3,DE); poser(g,16,YTOR+5,DE);
  }else if(a === "presse"){
    rect(g,13,YTOR+3,5,6,DE); rect(g,13,YTOR+3,5,1,CU);
    for(let y=YTOR+5;y<=YTOR+7;y++) rect(g,14,y,3,1,CUo);
    poser(g,13,YTOR+5,PE);
  }else if(a === "gerbe"){
    for(const [x,y] of [[14,YTOR+1],[16,YTOR+2],[15,YTOR+3],[17,YTOR+4]]){
      poser(g,x,y,AC); poser(g,x+1,y+1,AC); }
    ligne(g,15,YTOR+5,16,YTOR+8,SE);
  }else if(a === "plateau"){
    rect(g,14,YTOR+3,5,1,ME); rect(g,15,YTOR+2,3,1,DE);
    poser(g,15,YTOR+1,AC); poser(g,17,YTOR+1,AC);
    poser(g,13,YTOR+4,PE);
  }else if(a === "noeud"){
    sym(g,8,YTOR+1,AC); rect(g,9,YTOR+1,2,1,AC);
  }
}

/**
 * Un personnage. `r` : { peau, chev, coiffe, tissu, second, dentelle, jambe,
 * accent, tulle, robe, voile, acc, pose }.
 */
export function perso(r){
  let g = grille(PL, PH, V);
  const pal = {
    [PE]:r.peau, [PEo]:teinter(r.peau, -.20),
    [CH]:r.chev, [CHo]:teinter(r.chev, -.26),
    [TI]:r.tissu, [TIo]:teinter(r.tissu, -.24),
    [SE]:r.second, [SEo]:teinter(r.second, -.24),
    [DE]:r.dentelle || "#fdf7ee", [DEo]:teinter(r.dentelle || "#fdf7ee", -.14),
    [ME]:"#c6ccda", [MEo]:"#858da0",
    [CU]:"#7a5a3a", [CUo]:"#5a4029",
    [JA]:r.jambe || "#3a3040", [JAo]:teinter(r.jambe || "#3a3040", -.28),
    [AC]:r.accent || "#e69aa6", [VO]:r.tulle || "#fbf6f0",
    [O]:"#2b1f2b", [OE]:"#2b1f2b",
  };
  // Le voile est pose AVANT tout le reste : le corps l'ecrase, et il n'en
  // reste que ce qui deborde de la silhouette. C'est ca, un voile.
  if(r.voile) voileArriere(g);
  if(r.robe && ROBES[r.robe]){
    ROBES[r.robe].jupe(g, TI, DE);
    buste(g, ROBES[r.robe].buste, TI, DE);
  }else{
    // Pantalon : deux jambes separees par deux pixels de vide, sinon le
    // personnage repose sur un pilier.
    for(let y=YTAILLE;y<YSOL;y++){ rect(g,7,y,2,1,JA); rect(g,11,y,2,1,JA); }
    rect(g,7,YSOL,2,1,CU); rect(g,11,YSOL,2,1,CU);
    bande(g,4,YTOR,1,TI); bande(g,3,YTOR+1,5,TI);
    for(let y=YTOR+1;y<=YTOR+4;y++) sym(g,5,y,TI);
    sym(g,5,YTOR+5,PE);
    rect(g,9,YTOR+1,2,4,DE);                     // chemise
    bande(g,3,YTAILLE-1,1,CU);                   // ceinture
  }
  tete(g, false, r.coiffe, r.pose);
  if(r.voile) couronne(g);
  if(r.acc) accessoire(g, r.acc);
  g = ombrer(g, OMB, V, O);
  g = cerner(g, V, O);
  return rendre(g, pal, V);
}

/* ------------------------------------------------------------- recettes
   L'aspect d'une personne se DERIVE de son nom par hachage. Deux invites ne
   sont jamais clones, et surtout : aucun tirage n'est consomme. */

const PEAUX   = ["#f5d0aa","#f0cfae","#e8b489","#d29466","#b87a4e","#8f5c38"];
const CHEVEUX = ["#241c16","#3a2a22","#2e2118","#7a4a24","#b07a30","#5a2020","#4a3a30","#8a5a2e"];
const COIFFES = ["chignon","long","court","boucles"];

/** Trois entiers stables tires du nom : peau, cheveux, coiffe. */
function traits(nom){
  const h = hachage(nom);
  return {
    peau: PEAUX[h % PEAUX.length],
    chev: CHEVEUX[(h >>> 5) % CHEVEUX.length],
    coiffe: COIFFES[(h >>> 11) % COIFFES.length],
  };
}

/** La mariee. Sa robe et sa teinte viennent du dossier, pas du hachage. */
export const mariee = (nom, silhouette, teinte, accent) => perso({
  ...traits(nom), coiffe:"long",
  tissu: teinte || "#fdf7ee", second: teinter(teinte || "#fdf7ee", -.10),
  robe: silhouette || "princesse", voile:1, acc:"bouquet", pose:"joie",
  accent: accent || "#e69aa6",
});

export const marie = (nom, teinte) => perso({
  ...traits(nom), coiffe:"court",
  tissu: teinte || "#33384f", second: teinter(teinte || "#33384f", -.18),
  jambe: teinter(teinte || "#33384f", -.18), acc:"noeud", dentelle:"#fbf5ea",
});

/** Un invite. Une robe une fois sur deux, decidee par le hachage. */
export function invite(nom){
  const h = hachage(nom + "-invite");
  const t = traits(nom);
  const robes = ["boheme","courte","empire","sirene",null,null];
  const cols = ["#c98aa0","#7fa87a","#8a9ac8","#d8a94a","#5f7a9a","#a86a7c"];
  const c = cols[h % cols.length];
  return perso({ ...t, robe:robes[(h >>> 7) % robes.length],
                 tissu:c, second:teinter(c, -.20), jambe:"#3a3040" });
}

/** Un prestataire : sa tenue dit son metier, pas son nom. */
export function prestataire(cle, type, style){
  const t = traits(cle);
  const teinte = STYLE[style] ? STYLE[style].couleur : "#7fa87a";
  if(type === "traiteur")
    return perso({ ...t, coiffe:"toque", tissu:"#f2ece2", second:"#d8cfc2",
                   acc:"plateau", jambe:"#3a3040" });
  if(type === "musique"){
    // ⚠️ Le casque dit « DJ », pas « musicien ». Un quatuor a cordes coiffe
    // d'un casque audio, c'est le meme defaut que le stand a l'echelle d'un
    // lit : le signe est lisible mais il raconte autre chose. Le registre du
    // prestataire decide donc du signe.
    if(style === "moderne")
      return perso({ ...t, coiffe:"casque", tissu:"#4a4258", second:"#33384f",
                     jambe:"#33384f", accent:teinte });
    return perso({ ...t, tissu:"#2e2b3a", second:"#232030", jambe:"#232030",
                   acc:"noeud", dentelle:"#f2ece2", accent:teinte });
  }
  // Le lieu est represente par son intendant, en tenue de la maison.
  return perso({ ...t, tissu:teinte, second:teinter(teinte, -.20),
                 acc:"gerbe", jambe:"#3a3040" });
}

/** Le wedding planner — toi. Presse-papiers a la main : c'est la signature. */
export const planner = (nom = "Élise") => perso({
  ...traits(nom), coiffe:"chignon", tissu:"#6b4a63", second:"#8c4f6b",
  acc:"presse", jambe:"#4a3a50",
});

/** Une concurrente : meme generateur, teinte de sa maison. */
export const concurrente = (cle, couleur) => perso({
  ...traits(cle), coiffe:"chignon", robe:"sirene",
  tissu:couleur, second:teinter(couleur, -.22),
});

/** Un client qui deambule dans la boutique. Pose stable, derivee du nom. */
export function badaud(nom){
  const h = hachage(nom + "-badaud");
  const t = traits(nom);
  const cols = ["#6b4a63","#4a5a7a","#7fa87a","#a86a7c","#5f7a9a","#b07a30"];
  const c = cols[h % cols.length];
  const enRobe = ((h >>> 3) & 1) === 1;
  return perso({ ...t, tissu:c, second:teinter(c, -.20), jambe:"#33384a",
                 robe: enRobe ? ["boheme","courte","empire"][(h >>> 9) % 3] : null });
}

export { teinter };
