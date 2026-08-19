/**
 * iso.js — projection isometrique 2:1.
 *
 * Une case de la grille devient un losange de TUILE_L x TUILE_H pixels, avec
 * TUILE_H = TUILE_L / 2. C'est la projection de tous les Kairosoft, et ce
 * n'est pas un choix cosmetique : en vue de dessus, un batiment n'a pas de
 * HAUTEUR, donc pas de silhouette, donc rien qui le distingue de son voisin
 * au-dela de sa couleur. C'est ce qui rendait les 126 constructions
 * interchangeables.
 *
 * Les fonctions vont par paires — `versEcran` et `versGrille` sont l'inverse
 * l'une de l'autre. Le placement au doigt depend entierement de la seconde :
 * si elles divergent, on vise une case et on batit sur une autre.
 */
export const TUILE_L = 32;              // largeur d'un losange, en px de base
export const TUILE_H = TUILE_L / 2;     // hauteur : la moitie, d'ou le « 2:1 »

/** Centre du losange de la case (gx, gy), en pixels monde. */
export const versEcran = (gx, gy) => ({
  x: (gx - gy) * (TUILE_L / 2),
  y: (gx + gy) * (TUILE_H / 2),
});

/** Case sous un point du monde. Inverse exact de versEcran. */
export function versGrille(x, y){
  const a = x / (TUILE_L / 2), b = y / (TUILE_H / 2);
  return { gx: Math.floor((b + a) / 2), gy: Math.floor((b - a) / 2) };
}

/**
 * Ordre de dessin : du fond vers l'avant.
 *
 * En isometrique, ce qui est « devant » a un (gx + gy) plus grand. Sans ce
 * tri, un batiment du fond se dessine PAR-DESSUS celui du premier plan et
 * toute l'illusion de relief s'effondre.
 */
export const profondeur = (gx, gy) => gx + gy;

/** Etendue en pixels d'une ville de l x h cases. Sert a cadrer la camera. */
export function etendue(l, h){
  return {
    // Le losange le plus a gauche est le coin (0, h-1), le plus a droite (l-1, 0).
    minX: -(h - 1) * (TUILE_L / 2),
    maxX:  (l - 1) * (TUILE_L / 2) + TUILE_L,
    minY: 0,
    maxY: (l + h - 2) * (TUILE_H / 2) + TUILE_H,
  };
}

/** Trace le losange d'une case, pour le quadrillage et les surbrillances. */
export function cheminLosange(ctx, cx, cy, l = TUILE_L, h = TUILE_H){
  ctx.beginPath();
  ctx.moveTo(cx,        cy - h / 2);
  ctx.lineTo(cx + l / 2, cy);
  ctx.lineTo(cx,        cy + h / 2);
  ctx.lineTo(cx - l / 2, cy);
  ctx.closePath();
}
