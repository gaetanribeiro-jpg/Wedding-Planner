/**
 * pixel.js — primitives de pixel art procedural.
 *
 * Trois generateurs les partagent (`avatar.js` historiquement, `villageois.js`
 * et `bestiaire.js`), et tous suivent la meme methode : on pose des marqueurs
 * dans une grille de caracteres, puis on DERIVE le contour et l'ombrage du
 * remplissage. Rien n'est peint a la main.
 *
 * C'est cette derivation qui garantit la cohesion : quelle que soit la
 * recette, la silhouette est toujours cernee de la meme facon et eclairee du
 * meme cote. Un contour dessine a la main ne survit pas a la premiere recette
 * qu'on ajoute.
 *
 * ⚠️ Aucune primitive n'appelle `alea()`, et aucune ne doit jamais le faire :
 * le rendu ne consomme pas le generateur de la simulation, sinon l'equilibrage
 * cesse d'etre reproductible a graine egale.
 */

/** Grille vide. Elle porte ses propres dimensions, les primitives les lisent. */
export function grille(L, H, vide = "."){
  const g = Array.from({ length:H }, () => Array(L).fill(vide));
  g.L = L; g.H = H;
  return g;
}

export const dans = (g, x, y) => x >= 0 && y >= 0 && x < g.L && y < g.H;

export function poser(g, x, y, m){
  x = x | 0; y = y | 0;
  if(dans(g, x, y)) g[y][x] = m;
}

/** Pose le pixel et son symetrique par rapport a l'axe vertical. */
export function sym(g, x, y, m){
  poser(g, x, y, m); poser(g, g.L - 1 - x, y, m);
}

export function rect(g, x, y, w, h, m){
  for(let j = y; j < y + h; j++) for(let i = x; i < x + w; i++) poser(g, i, j, m);
}

/** Bande symetrique, definie par sa demi-largeur depuis l'axe. */
export function bande(g, demi, y, h, m){
  const axe = Math.floor((g.L - 1) / 2);
  for(let j = y; j < y + h; j++)
    for(let i = 0; i < demi; i++) sym(g, axe - i, j, m);
}

export function ovale(g, cx, cy, rx, ry, m){
  for(let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
    for(let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++){
      const dx = (i - cx) / rx, dy = (j - cy) / ry;
      if(dx*dx + dy*dy <= 1) poser(g, i, j, m);
    }
}

/** Segment de Bresenham : pattes, cornes, membres. */
export function ligne(g, x0, y0, x1, y1, m){
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for(let i = 0; i <= n; i++)
    poser(g, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, m);
}

/** Contour derive : tout vide colle a du plein devient contour. */
export function cerner(g, vide, contour){
  const out = g.map(l => l.slice()); out.L = g.L; out.H = g.H;
  for(let y = 0; y < g.H; y++) for(let x = 0; x < g.L; x++){
    if(g[y][x] !== vide) continue;
    const voisin = [[1,0],[-1,0],[0,1],[0,-1]]
      .some(([dx,dy]) => dans(g, x+dx, y+dy) && g[y+dy][x+dx] !== vide);
    if(voisin) out[y][x] = contour;
  }
  return out;
}

/** Ombrage derive : lumiere en haut a gauche, bord droit et bas ombres. */
export function ombrer(g, ombreDe, vide, contour){
  const out = g.map(l => l.slice()); out.L = g.L; out.H = g.H;
  for(let y = 0; y < g.H; y++) for(let x = 0; x < g.L; x++){
    const m = g[y][x];
    if(!ombreDe[m]) continue;
    const droite = dans(g, x+1, y) ? g[y][x+1] : vide;
    const bas    = dans(g, x, y+1) ? g[y+1][x] : vide;
    if(droite === vide || droite === contour || bas === vide || bas === contour)
      out[y][x] = ombreDe[m];
  }
  return out;
}

/**
 * Peint la grille dans un canvas, un pixel par case.
 *
 * `fillRect` par case plutot qu'un `putImageData` : c'est net a n'importe
 * quelle taille et ca ne depend d'aucun facteur d'echelle entier au moment de
 * la fabrication — c'est l'affichage qui arrondit.
 */
export function rendre(g, palette, vide = "."){
  const cv = document.createElement("canvas");
  cv.width = g.L; cv.height = g.H;
  const ctx = cv.getContext("2d");
  for(let y = 0; y < g.H; y++) for(let x = 0; x < g.L; x++){
    const m = g[y][x];
    if(m === vide) continue;
    ctx.fillStyle = palette[m] || "#ff00ff";   // magenta = marqueur oublie
    ctx.fillRect(x, y, 1, 1);
  }
  return cv;
}

/* Le hachage vit dans utils.js : guilds.js en a besoin aussi, et deux copies
   d'une fonction de hachage finissent toujours par diverger d'un bit. */
export { hachage as graineNom } from "./utils.js";

/**
 * Eclaircit (k > 0) ou assombrit (k < 0) une couleur hexadecimale.
 *
 * ⚠️ SEULE divergence assumee avec la version d'Aincrad, et c'est une
 * correction, pas un gout. Aincrad eclaircissait par multiplication
 * (`c * (1 + k))`. Sur une palette sombre ca marche ; sur celle-ci, ou la
 * moitie des matieres sont des ivoires a 250 de luminance, un facteur 1.12
 * sature immediatement au blanc et le rehaut disparait — le meme defaut que
 * l'ombrage derive qui ne mord pas sur du presque-blanc. On interpole donc
 * VERS le blanc, ce qui garde un ecart lisible aux deux bouts de l'echelle.
 * C'est la formule des maquettes validees, et les planches contact font foi.
 */
export function teinter(hex, k){
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255,
    Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
  return `#${((f(n>>16 & 255)<<16) | (f(n>>8 & 255)<<8) | f(n & 255))
              .toString(16).padStart(6, "0")}`;
}

/** Interpolation entre deux couleurs. Sert a paler les rangees du fond. */
export function melanger(a, b, k){
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const f = d => Math.round(((na>>d & 255) * (1-k) + (nb>>d & 255) * k));
  return `#${((f(16)<<16) | (f(8)<<8) | f(0)).toString(16).padStart(6, "0")}`;
}

/**
 * Petit generateur STABLE derive d'un hachage. C'est ce qui remplace `alea()`
 * dans tout le decoratif : un semis de petales, les fleurs d'une arche.
 * ⚠️ Il ne touche pas au generateur de la simulation — c'est tout l'interet.
 */
export function pepin(h){
  let e = h >>> 0;
  return () => {
    e ^= e << 13; e >>>= 0;
    e ^= e >> 17;
    e ^= e << 5;  e >>>= 0;
    return e / 4294967296;
  };
}

/**
 * Style CSS pour afficher un sprite genere dans un element DOM.
 *
 * Les generateurs rendent un canvas, mais l'interface est en DOM : sans ce
 * pont, il faudrait deux chemins de rendu pour un meme personnage — celui de
 * l'arene et celui de la fiche — et ils divergeraient au premier changement.
 */
export function styleCanvas(cv, taillePx){
  return `background-image:url(${cv.toDataURL()});`
       + `background-size:contain;background-repeat:no-repeat;`
       + `background-position:center;image-rendering:pixelated;`
       + `width:${taillePx}px;height:${Math.round(taillePx * cv.height / cv.width)}px;`;
}
