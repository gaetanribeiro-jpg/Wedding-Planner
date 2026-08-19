/**
 * mobilier.js — les meubles isometriques, fabriques par recette.
 * Herite de batisseur.js, repris verbatim des maquettes validees.
 *
 * ⚠️ La lecon centrale, et c'est l'etape qui change tout : on dessine a la
 * resolution NATIVE, puis on SEUILLE l'alpha. Sans ce seuillage, les
 * diagonales isometriques sortent antialiasees et le resultat fait low-poly
 * plat — pas pixel art. Tout passe donc par `meuble()`, qui dessine, seuille,
 * puis cerne.
 *
 * ⚠️ Deuxieme lecon, payee sur le stand du salon : LE MOBILIER DOIT ETRE A
 * L'ECHELLE DU PERSONNAGE. Un personnage fait 28 px de haut. Un meuble de
 * 96×84 pose a cote se lit comme un lit, pas comme un stand. Les tailles
 * ci-dessous ont ete arretees sur planche contact, contre une silhouette.
 *
 * ⚠️ Comme gens.js : aucune fonction d'ici n'appelle `alea()`. Le semis de
 * fleurs de l'arche vient d'un `pepin(hachage(...))`.
 */

import { teinter, pepin } from "./pixel.js";
import { hachage } from "./utils.js";
import { perso, ROBES } from "./gens.js";
import { TUILE_L, TUILE_H } from "./iso.js";

/* Seuillage d'alpha : le geste qui fait la difference entre du pixel art et
   du vectoriel reduit. Tout ce qui est a moins de 50 % disparait. */
function pixeliser(ctx, w, h){
  const d = ctx.getImageData(0, 0, w, h), p = d.data;
  for(let i = 3; i < p.length; i += 4) p[i] = p[i] < 128 ? 0 : 255;
  ctx.putImageData(d, 0, 0);
}

/** La face superieure d'un volume : le losange 2:1. */
export function dessus(ctx, cx, cy, l, h, col){
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h/2); ctx.lineTo(cx + l/2, cy);
  ctx.lineTo(cx, cy + h/2); ctx.lineTo(cx - l/2, cy);
  ctx.closePath(); ctx.fill();
}

/**
 * Les trois faces d'un volume, DERIVEES d'une seule teinte.
 * ⚠️ Trois couleurs choisies independamment donnent trois plaques posees cote
 * a cote, pas un solide : c'est la meme raison qui fait deriver le contour et
 * l'ombrage dans pixel.js plutot que de les peindre.
 */
export function volume(ctx, cx, base, l, h, haut, col){
  const ga = teinter(col, -.30), dr = teinter(col, -.13);
  ctx.fillStyle = ga; ctx.beginPath();
  ctx.moveTo(cx - l/2, base - h/2); ctx.lineTo(cx, base);
  ctx.lineTo(cx, base - haut); ctx.lineTo(cx - l/2, base - h/2 - haut);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = dr; ctx.beginPath();
  ctx.moveTo(cx + l/2, base - h/2); ctx.lineTo(cx, base);
  ctx.lineTo(cx, base - haut); ctx.lineTo(cx + l/2, base - h/2 - haut);
  ctx.closePath(); ctx.fill();
  dessus(ctx, cx, base - h/2 - haut, l, h, col);
}

/** Contour derive, en pixels : meme principe que `cerner` sur les grilles. */
function cerne(ctx, w, h, col){
  const d = ctx.getImageData(0, 0, w, h), p = d.data, out = ctx.createImageData(d);
  out.data.set(p);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : p[(y*w + x)*4 + 3];
  const n = parseInt(col.slice(1), 16);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    if(a(x, y)) continue;
    if(a(x+1,y) || a(x-1,y) || a(x,y+1) || a(x,y-1)){
      const i = (y*w + x)*4;
      out.data[i] = n>>16 & 255; out.data[i+1] = n>>8 & 255;
      out.data[i+2] = n & 255;   out.data[i+3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

/** Fabrique un meuble : on dessine, on seuille, on cerne. Dans cet ordre. */
function meuble(w, h, f){
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d");
  f(c, w, h);
  pixeliser(c, w, h);
  cerne(c, w, h, "#3a2b3a");
  return cv;
}

const BOIS = "#a8753f", BOIS2 = "#8a5c30", DORE = "#d8a94a";
const POUDRE = "#e69aa6", PRUNE = "#8c4f6b";

/* Le cache : une recette ne change jamais pour une meme cle, et refabriquer
   un canvas a chaque frame ferait tomber le rendu. */
const _cache = new Map();
function cache(cle, f){
  if(!_cache.has(cle)) _cache.set(cle, f());
  return _cache.get(cle);
}

export const RECETTES = {
  /* Un portant, c'est deux montants, une barre et des robes qui PENDENT.
     Sans les cintres qui depassent, ca se lit comme une cloture. */
  portant:(couleurs = ["#f3ecec","#f7e6ea","#efe3f0","#fbf3e6"]) => meuble(46,50,(c)=>{
    c.fillStyle = teinter(DORE,-.25); c.fillRect(7,20,2,26); c.fillRect(37,20,2,26);
    c.fillStyle = DORE; c.fillRect(7,18,32,3);
    couleurs.forEach((col,i)=>{
      const x = 10 + i*6;
      c.fillStyle = teinter(col,-.18); c.fillRect(x,21,1,3);
      c.fillStyle = col;               c.fillRect(x-2,24,5,12);
      c.fillStyle = teinter(col,.12);  c.fillRect(x-3,32,7,8);
      c.fillStyle = teinter(col,-.22); c.fillRect(x+2,24,1,16);
    });
    c.fillStyle = "#5a4a52"; c.fillRect(5,46,4,2); c.fillRect(37,46,4,2);
  }),

  /* Le mannequin porte une VRAIE silhouette de robe : c'est le meme
     generateur que les personnages, donc la robe exposee en boutique est
     litteralement celle que la mariee portera. */
  mannequin:(col = "#fdf7ee", forme = "princesse") => meuble(34,52,(c)=>{
    c.fillStyle = "#6b5a63"; c.fillRect(16,44,2,6); c.fillRect(12,50,10,2);
    const sprite = perso({ peau:"#d8c8bc", chev:"#d8c8bc", coiffe:null,
                           tissu:col, second:teinter(col,-.10),
                           robe: ROBES[forme] ? forme : "princesse",
                           dentelle:"#fdf7ee" });
    c.imageSmoothingEnabled = false;
    // On ne prend que le corps, a partir de la nuque : un mannequin n'a pas de
    // tete. Couper plus haut laisserait le bas du contour du crane, qui se lit
    // comme un menton flottant.
    c.drawImage(sprite, 0, 10, 20, 18, 7, 18, 20, 18);
    c.fillStyle = "#c9b8c0"; c.fillRect(15,14,4,4);        // col du buste
  }),

  comptoir:() => meuble(60,38,(c)=>{
    volume(c,30,32,48,24,13,BOIS);
    dessus(c,30,32-12-13,48,24,"#ddd0be");
    c.fillStyle = teinter(DORE,-.1); c.fillRect(10,22,40,1);
    // Registre et petit bouquet : un comptoir vide se lit comme un bloc.
    c.fillStyle = "#f7efe4"; c.fillRect(22,8,10,4);
    c.fillStyle = POUDRE; c.fillRect(38,5,4,4);
    c.fillStyle = "#6f9a63"; c.fillRect(39,9,2,3);
  }),

  vitrine:() => meuble(46,40,(c)=>{
    volume(c,23,34,36,18,7,BOIS2);
    c.globalAlpha = .35; volume(c,23,34-7,36,18,11,"#dceef2"); c.globalAlpha = 1;
    c.fillStyle = DORE; c.fillRect(8,17,30,1);
    // Des bijoux dedans, sinon c'est une caisse vitree.
    for(const [x,y] of [[14,14],[22,12],[30,14]]){
      c.fillStyle = DORE; c.fillRect(x,y,3,2);
      c.fillStyle = "#f2e4ea"; c.fillRect(x+1,y,1,1); }
  }),

  miroir:() => meuble(30,54,(c)=>{
    c.fillStyle = DORE; c.fillRect(4,2,22,42);
    c.fillStyle = "#cfd8e0"; c.fillRect(7,5,16,36);
    c.fillStyle = "#e8eef2"; c.fillRect(9,7,4,32);
    c.fillStyle = teinter(DORE,-.25); c.fillRect(11,44,8,8);
  }),

  plante:() => meuble(28,40,(c)=>{
    c.fillStyle = "#b4785a"; c.fillRect(8,28,12,10);
    c.fillStyle = "#94604a"; c.fillRect(8,28,12,2);
    for(const [x,y,r] of [[14,18,8],[9,22,6],[19,22,6],[14,11,6]]){
      c.fillStyle = r > 6 ? "#5f8f57" : "#6fa564";
      c.beginPath(); c.ellipse(x,y,r,r*.85,0,0,7); c.fill(); }
  }),

  /* ⚠️ Le dossier se peint EN PREMIER, donc DERRIERE l'assise.
     Premiere version : dossier peint par-dessus les deux volumes. Il
     recouvrait le siege et le canape sortait en dalle rose — exactement le
     defaut du voile pose sur la tete plutot que derriere le corps. D'un
     dossier comme d'un voile, ce qu'on doit voir, c'est ce qui DEPASSE. */
  canape:(col = "#a86a7c") => meuble(56,46,(c)=>{
    c.fillStyle = col;               c.fillRect(6,2,44,16);   // dossier
    c.fillStyle = teinter(col,.16);  c.fillRect(8,4,40,4);    // rehaut du dossier
    c.fillStyle = teinter(col,-.24); c.fillRect(6,17,44,2);   // ombre sous le dossier
    volume(c,28,42,44,20,7,teinter(col,-.18));                // socle
    volume(c,28,35,44,20,5,teinter(col,.08));                 // assise
    // Accoudoirs : deux volumes courts qui bornent l'assise. Sans eux, le
    // canape n'a pas de largeur lisible et redevient une banquette.
    c.fillStyle = teinter(col,.10);  c.fillRect(2,12,6,14); c.fillRect(48,12,6,14);
    c.fillStyle = teinter(col,-.26); c.fillRect(2,25,6,2);  c.fillRect(48,25,6,2);
  }),

  /* ⚠️ Le tapis n'est PAS un sprite trie en profondeur : render.js le peint
     dans la couche de sol. Cette recette n'existe que pour la planche contact.
     Pose comme un meuble, son sprite est ancre par le bas, il flotte, et on lit
     une estrade rose au milieu de la boutique. */
  tapis:(col = PRUNE) => meuble(96,50,(c)=>{
    dessus(c,48,25,92,44,col);
    dessus(c,48,25,72,34,teinter(col,.14));
    dessus(c,48,25,44,20,col);
  }),

  arche:() => meuble(90,86,(c)=>{
    c.strokeStyle = "#8a6a4a"; c.lineWidth = 4;
    c.beginPath(); c.moveTo(16,84); c.lineTo(16,34);
    c.quadraticCurveTo(45,4,74,34); c.lineTo(74,84); c.stroke();
    // Le semis de fleurs vient d'un hachage, jamais du generateur du jeu.
    const r = pepin(hachage("arche"));
    for(let i = 0; i < 80; i++){
      const t = i/79;
      let x, y;
      if(t < .22){ x = 16; y = 84 - (t/.22)*50; }
      else if(t > .78){ x = 74; y = 34 + ((t-.78)/.22)*50; }
      else { const u = (t-.22)/.56; x = 16 + 58*u; y = 34 - 30*Math.sin(Math.PI*u); }
      const q = r();
      c.fillStyle = q < .42 ? "#f5eef0" : q < .62 ? "#e8a8b4"
                  : q < .82 ? "#6f9a63" : "#f0d8a0";
      const s = q < .62 ? 4 : 3;
      c.fillRect(x - s/2 + (r()-.5)*6, y - s/2 + (r()-.5)*6, s, s);
    }
  }),

  chaise:(col = "#c9b8a8") => meuble(22,34,(c)=>{
    volume(c,11,26,16,9,7,col);
    c.fillStyle = teinter(col,-.12); c.fillRect(4,8,14,12);
    c.fillStyle = "#f7eff2"; c.fillRect(6,10,10,3);         // noeud de dossier
    c.fillStyle = POUDRE; c.fillRect(9,12,4,4);
  }),

  tableRonde:() => meuble(58,40,(c)=>{
    volume(c,29,34,44,22,10,"#f2ead8");
    dessus(c,29,34-11-10,44,22,"#fbf5ea");
    c.fillStyle = POUDRE; c.beginPath(); c.ellipse(29,12,5,4,0,0,7); c.fill();
    c.fillStyle = "#6f9a63"; c.fillRect(26,9,2,3); c.fillRect(31,10,2,3);
    c.fillStyle = DORE; c.fillRect(18,14,2,4); c.fillRect(39,14,2,4);
  }),

  /* Un stand, c'est un PANNEAU qui se dresse et une table basse devant.
     La premiere version etait un bloc de 96×84 : a cote d'un personnage de
     28 px de haut, ca ne se lisait pas comme un stand mais comme un lit. */
  stand:(col = PRUNE) => meuble(62,62,(c)=>{
    c.fillStyle = teinter(col,-.30); c.fillRect(4,6,54,30);   // panneau
    c.fillStyle = col;               c.fillRect(6,8,50,26);
    c.fillStyle = "#f7efe4";         c.fillRect(10,13,42,13); // banderole vierge
    c.fillStyle = DORE;              c.fillRect(3,3,56,4);
    for(let i = 0; i < 4; i++){
      c.fillStyle = i%2 ? POUDRE : DORE; c.fillRect(9 + i*13, 29, 6, 2); }
    c.fillStyle = teinter(col,-.42); c.fillRect(8,36,4,10); c.fillRect(50,36,4,10);
    volume(c,31,58,40,18,9,"#c9b8a8");                       // table de presentation
    c.fillStyle = POUDRE; c.fillRect(22,40,6,4);
    c.fillStyle = "#6f9a63"; c.fillRect(36,41,5,3);
  }),

  cadre:(col = PRUNE) => meuble(20,24,(c)=>{
    c.fillStyle = DORE; c.fillRect(0,0,20,24);
    c.fillStyle = col;  c.fillRect(3,3,14,18);
    c.fillStyle = "#f7efe4"; c.fillRect(6,7,8,10);
    c.fillStyle = POUDRE; c.fillRect(8,9,4,6);
  }),

  etagere:() => meuble(46,26,(c)=>{
    c.fillStyle = BOIS2; c.fillRect(0,20,46,4);
    // Boites a chapeaux : cercle + ruban.
    for(const [x,col] of [[6,"#e8dcc9"],[19,POUDRE],[32,"#c9b8d0"]]){
      c.fillStyle = col; c.fillRect(x,6,12,14);
      c.fillStyle = teinter(col,-.18); c.fillRect(x,6,12,3);
      c.fillStyle = DORE; c.fillRect(x+5,6,2,14); }
  }),

  podium:() => meuble(44,30,(c)=>{
    volume(c,22,26,34,16,7,PRUNE);
    dessus(c,22,26-8-7,34,16,teinter(PRUNE,.20));
    c.fillStyle = DORE; c.fillRect(6,14,32,1);
    c.fillStyle = DORE; c.fillRect(19,2,6,8); c.fillRect(17,9,10,2);  // trophee
  }),
};

/**
 * Le sprite d'un meuble pose en boutique. `variante` sert aux meubles qui
 * portent une couleur ou une silhouette (portant, mannequin, canape).
 */
export function spriteMeuble(cle, variante = ""){
  const f = RECETTES[cle];
  if(!f) return null;
  return cache(cle + "|" + variante, () => {
    if(cle === "mannequin"){
      const [col, forme] = variante ? variante.split(",") : [];
      return f(col || "#fdf7ee", forme || "princesse");
    }
    if(cle === "portant" && variante) return f(variante.split(","));
    if(variante) return f(variante);
    return f();
  });
}

/** Vide le cache : utile aux planches contact qui rejouent les recettes. */
export const viderCache = () => _cache.clear();

export { TUILE_L, TUILE_H };
