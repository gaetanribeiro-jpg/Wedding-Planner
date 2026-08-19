/**
 * render.js — le canvas. Deux vues, comme Aincrad : une ISOMETRIQUE pour le
 * lieu qu'on amenage, une vue de COTE pour le moment fort. C'est exactement le
 * couple ville / arene, et c'est ce qui prouve que les deux moities du moteur
 * tiennent.
 *
 * ⚠️ Ce module LIT `G`, il ne l'ecrit jamais. La regle de dependance d'Aincrad
 * (`render` depend de `state`, jamais l'inverse) est ce qui permet de resoudre
 * une partie entiere sans navigateur.
 *
 * ⚠️ Et il ne consomme JAMAIS `alea()`. Tout le hasard visible ici — le semis
 * du parquet, les petales, les invites — vient d'un hachage. Un seul tirage
 * dans une frame decalerait la partie a graine egale.
 */

import { TUILE_L as TL, TUILE_H as TH, versEcran, versGrille,
         cheminLosange, etendue } from "./iso.js";
import { teinter, melanger, pepin } from "./pixel.js";
import { hachage } from "./utils.js";
import { spriteMeuble, dessus } from "./mobilier.js";
import * as Gens from "./gens.js";
import { MEUBLES, SLOT, SLOTS, STYLE, FAMILLES, PRESTATAIRES } from "./config.js";
import { nomCouple } from "./clients.js";

export const C = {
  nuit:"#2e2434", nuit2:"#3d3044", bord:"#584a63",
  creme:"#f7efe4", creme2:"#e8dcc9",
  or:"#d8a94a", poudre:"#e69aa6", prune:"#8c4f6b", vert:"#7fa87a",
  texte:"#f4ecdf", faible:"#a89bb0",
};

const DORE = C.or;

/* Le sprite d'un personnage est cher a fabriquer et ne change pas. On le
   garde par cle — sans ce cache, chaque frame refabrique une dizaine de
   canvas et le rendu tombe sous les 20 images par seconde. */
const _gens = new Map();
function sprite(cle, f){
  if(!_gens.has(cle)) _gens.set(cle, f());
  return _gens.get(cle);
}
export const viderSprites = () => _gens.clear();

function poserSprite(c, sp, x, y){
  if(!sp) return;
  c.drawImage(sp, Math.round(x - sp.width/2), Math.round(y - sp.height));
}

/* ==================================================================== boutique
   L'equivalent exact de la ville : grille isometrique, tri en profondeur sur
   gx+gy, camera, et l'economie par frequentation rendue VISIBLE — les clients
   qui deambulent sont de vrais visiteurs du jour, pas des figurants. */

/**
 * Dessine la boutique. `vue` porte l'etat d'interface pur (case survolee,
 * meuble en main) : le rendu ne decide de rien, il montre.
 */
export function dessinerBoutique(ctx, G, vue = {}){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const b = G.boutique;
  const { ox, oy } = CADRAGE_BOUTIQUE(W, H, b);
  const e = (gx, gy) => ({ x: ox + (gx - gy)*TL/2, y: oy + (gx + gy)*TH/2 });

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = C.nuit; ctx.fillRect(0, 0, W, H);

  const mur = (p, q, haut, col) => {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    ctx.lineTo(q.x, q.y - haut); ctx.lineTo(p.x, p.y - haut);
    ctx.closePath(); ctx.fill();
  };

  /* ⚠️ Les murs se peignent TUILE PAR TUILE. Un seul quadrilatere entre les
     deux extremites part en diagonale a travers la piece : deux points
     eloignes sur une grille isometrique ne definissent pas un mur, ils
     definissent une corde. Meme raison pour la plinthe et les banderoles. */
  for(let i = 0; i < b.h; i++) mur(e(-1,i), e(-1,i+1), 58, "#6b5566");
  for(let i = 0; i < b.l; i++) mur(e(i,-1), e(i+1,-1), 58, "#7d6478");

  // Papier peint raye : un aplat uni sur un tiers d'ecran fait carton.
  ctx.fillStyle = "rgba(255,255,255,.055)";
  for(let i = 0; i < b.l*3; i++){ const p = e(i/3,-1); ctx.fillRect(p.x, p.y-58, 1, 58); }
  for(let i = 0; i < b.h*3; i++){ const p = e(-1,i/3); ctx.fillRect(p.x, p.y-58, 1, 58); }

  // Plinthe doree : sans elle le mur et le sol se touchent en deux aplats
  // voisins et la piece se lit comme un origami.
  for(let i = 0; i < b.h; i++) mur(e(-1,i), e(-1,i+1), 3, DORE);
  for(let i = 0; i < b.l; i++) mur(e(i,-1), e(i+1,-1), 3, DORE);

  // La vitrine sur rue.
  {
    const p = e(3,-1), q = e(5.4,-1);
    mur(p, q, 50, "#4a3a48");
    ctx.fillStyle = "#cfe4ea"; ctx.beginPath();
    ctx.moveTo(p.x+3, p.y-16); ctx.lineTo(q.x-3, q.y-16);
    ctx.lineTo(q.x-3, q.y-46); ctx.lineTo(p.x+3, p.y-46); ctx.closePath(); ctx.fill();
    const m = e(4.2,-1);
    ctx.fillStyle = "#4a3a48"; ctx.fillRect(m.x-1, m.y-46, 2, 30);
    mur(p, q, 15, DORE); mur(p, q, 12, "#4a3a48");
  }

  /* Le parquet, deux tons, plus un semis DETERMINISTE : le nœud du bois vient
     des coordonnees de la case, jamais d'un tirage. */
  for(let gy = 0; gy < b.h; gy++) for(let gx = 0; gx < b.l; gx++){
    const p = e(gx, gy);
    dessus(ctx, p.x, p.y + TH/2, TL, TH, (gx+gy)%2 ? "#b98a52" : "#c69760");
    if(((gx*7 + gy*13) % 5) === 0){
      ctx.fillStyle = "rgba(90,60,35,.30)"; ctx.fillRect(p.x-4, p.y + TH/2, 7, 1); }
  }

  /* ⚠️ Le tapis se peint DANS la couche de sol, pas en sprite trie en
     profondeur. Pose comme un meuble, son sprite est ancre par le bas : il
     flotte, et on lit une estrade rose au milieu de la boutique. Un tapis est
     un revetement, pas un objet. */
  for(const m of b.meubles){
    if(!MEUBLES[m.cle].sol) continue;
    for(let gy = m.gy; gy <= m.gy + 2 && gy < b.h; gy++)
      for(let gx = m.gx; gx <= m.gx + 3 && gx < b.l; gx++){
        const p = e(gx, gy);
        const bord = (gy === m.gy || gy === m.gy+2 || gx === m.gx || gx === m.gx+3);
        dessus(ctx, p.x, p.y + TH/2, TL, TH, bord ? "#7d4560" : C.prune);
      }
  }

  // La case survolee, et le meuble qu'on tient a la main.
  if(vue.survol){
    const p = e(vue.survol.gx, vue.survol.gy);
    ctx.strokeStyle = vue.valide === false ? C.prune : C.poudre;
    ctx.lineWidth = 2;
    cheminLosange(ctx, p.x, p.y + TH/2, TL, TH);
    ctx.stroke();
  }

  /* Le tri en profondeur. En isometrique, ce qui est « devant » a un (gx+gy)
     plus grand. Sans ce tri, un meuble du fond se dessine PAR-DESSUS celui du
     premier plan et toute l'illusion de relief s'effondre. */
  const file = [];
  for(const m of b.meubles){
    const d = MEUBLES[m.cle];
    if(d.sol) continue;                                  // deja peint au sol
    file.push({ k:m.gx + m.gy, gx:m.gx, gy:m.gy, sp:spriteMeuble(m.cle, varianteDe(m, G)) });
  }

  /* Les visiteurs. Leur NOMBRE vient de la journee simulee — ce sont les vrais
     visiteurs servis, pas un decor. Leur position vient d'un hachage du jour
     et de leur rang : ils bougent d'un jour a l'autre sans tirer un nombre. */
  const servis = G.derniereJournee ? Math.min(8, G.derniereJournee.servis) : 0;
  for(let i = 0; i < servis; i++){
    const h = hachage(`v${G.jour}-${i}`);
    const gx = (h % (b.l*10)) / 10, gy = ((h >>> 8) % (b.h*10)) / 10;
    file.push({ k:gx + gy + 0.01, gx, gy,
      sp: sprite(`badaud-${h % 64}`, () => Gens.badaud(`badaud${h % 64}`)),
      bulle: ["piece","coeur","note"][h % 3] });
  }

  file.sort((a, b2) => a.k - b2.k);
  for(const it of file){
    const p = e(it.gx, it.gy);
    poserSprite(ctx, it.sp, p.x, p.y + TH/2);
    if(it.bulle) bulle(ctx, p.x + 11, p.y + TH/2 - 32, it.bulle);
  }

  // Voile chaud : la lumiere de la boutique. Un aplat translucide, pas une
  // ombre douce — la charte interdit le flou, pas la couleur.
  ctx.fillStyle = "rgba(255,214,160,.10)"; ctx.fillRect(0, 0, W, H);
}

/** La variante visuelle d'un meuble : elle depend de l'etat, pas d'un tirage. */
function varianteDe(m, G){
  if(m.cle === "mannequin"){
    // Le mannequin porte la plus belle robe du stock : la boutique montre ce
    // qu'elle a vraiment. Un mannequin generique serait un mensonge d'etalage.
    const robes = G.stock.filter(a => a.slot === "robe");
    if(!robes.length) return "#fdf7ee,princesse";
    const best = robes.reduce((x, y) => y.tier > x.tier ? y : x);
    return `${best.teinte},${best.silhouette || "princesse"}`;
  }
  if(m.cle === "portant"){
    const robes = G.stock.filter(a => a.slot === "robe").slice(0, 4);
    const cols = robes.map(a => a.teinte);
    while(cols.length < 4) cols.push("#f3ecec");
    return cols.join(",");
  }
  if(m.cle === "canape") return "#a86a7c";
  if(m.cle === "cadre") return C.prune;
  return "";
}

/** Bulles au-dessus des clients : elles disent d'ou vient l'argent. */
function bulle(c, x, y, type){
  c.fillStyle = "#fbf5ea"; c.fillRect(x-7, y-7, 14, 12); c.fillRect(x-2, y+5, 4, 3);
  c.fillStyle = "#3a2b3a";
  c.fillRect(x-8, y-8, 16, 1); c.fillRect(x-8, y+5, 16, 1);
  c.fillRect(x-8, y-8, 1, 14);  c.fillRect(x+7, y-8, 1, 14);
  if(type === "coeur"){
    c.fillStyle = C.poudre;
    c.fillRect(x-4,y-4,3,3); c.fillRect(x+1,y-4,3,3);
    c.fillRect(x-4,y-1,8,2); c.fillRect(x-2,y+1,4,2); c.fillRect(x-1,y+3,2,1);
  }else if(type === "piece"){
    c.fillStyle = DORE; c.beginPath(); c.ellipse(x,y-1,4,4,0,0,7); c.fill();
    c.fillStyle = teinter(DORE,-.3); c.fillRect(x-1,y-3,2,5);
  }else{
    c.fillStyle = "#6b4a63";
    c.fillRect(x-3,y-5,7,1); c.fillRect(x-3,y-2,7,1); c.fillRect(x-3,y+1,4,1);
  }
}

/** Case sous le curseur. Inverse exact de la projection — voir iso.js. */
export function caseSousLeDoigt(ctx, G, px, py){
  // ⚠️ Le cadrage se calcule ICI PAR LA MEME FONCTION que le dessin. Deux
  // formules de camera qui divergent, et l'on vise une case pour batir sur une
  // autre — c'est exactement ce que `versEcran`/`versGrille` s'interdisent
  // dans iso.js, et ca vaut aussi pour l'origine.
  const { ox, oy } = CADRAGE_BOUTIQUE(ctx.canvas.width, ctx.canvas.height, G.boutique);
  const { gx, gy } = versGrille(px - ox, py - oy - TH/2);
  return { gx, gy };
}

/**
 * Le cadrage de la boutique, derive de l'etendue reelle de la grille.
 *
 * ⚠️ Premiere version : une origine en dur (`oy = 62`). Elle laissait un quart
 * de canvas mort sous la boutique et rognait le mur de gauche des que la
 * grille changeait de taille. L'etendue se CALCULE — iso.js l'expose pour
 * exactement cette raison.
 */
function CADRAGE_BOUTIQUE(W, H, b){
  const e = etendue(b.l, b.h);
  const MUR = 58;                       // les murs montent au-dessus de la grille
  return {
    ox: W/2 - (e.minX + e.maxX)/2,
    oy: Math.round((H - (e.maxY - e.minY) - MUR)/2) + MUR,
  };
}

/* ================================================================== jour J
   La deuxieme moitie du moteur : une vue de cote, comme l'arene. Le ciel est
   la seule entorse assumee au « zero degrade » ; les cretes, elles, sont en
   MARCHES — une colline antialiasee au-dessus d'un decor en pixels francs se
   repere au premier coup d'oeil. */

/**
 * Dessine le jour J a l'instant `t` (0..1) de la trace.
 *
 * ⚠️ `res` est la resolution DEJA CALCULEE. Cette fonction ne decide de rien :
 * elle rejoue. C'est ce qui garantit que l'ecran ne peut pas raconter une
 * autre issue que celle qui a ete comptee.
 */
export function dessinerJourJ(ctx, res, ctr, G, t = 1){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const sol = H - 66;
  ctx.imageSmoothingEnabled = false;

  const ciel = ctx.createLinearGradient(0, 0, 0, sol);
  ciel.addColorStop(0, "#4a3a6b"); ciel.addColorStop(.45, "#b5738a");
  ciel.addColorStop(.75, "#e8a07a"); ciel.addColorStop(1, "#f6d2a0");
  ctx.fillStyle = ciel; ctx.fillRect(0, 0, W, sol);
  ctx.fillStyle = "rgba(255,238,200,.55)";
  ctx.beginPath(); ctx.ellipse(W*.72, sol-26, 20, 20, 0, 0, 7); ctx.fill();

  // Collines en marches de 3 px.
  for(const [amp, base, col, ph] of [[16, sol-30, "#7a5f78", 0],
                                     [11, sol-14, "#5e4a63", 1.7]]){
    for(let x = 0; x < W; x += 3){
      const y = base - Math.round((Math.sin(x/58 + ph)*.6 + Math.sin(x/23 + ph)*.4) * amp/3)*3;
      ctx.fillStyle = col; ctx.fillRect(x, y, 3, sol - y);
    }
  }
  // Arbres au loin, silhouettes en marches. Semis stable par hachage.
  const rr = pepin(hachage("arbres"));
  for(let i = 0; i < 16; i++){
    const x = Math.round(rr()*W), h = 12 + Math.round(rr()*10);
    ctx.fillStyle = "#4e3d55";
    for(let k = 0; k < 4; k++)
      ctx.fillRect(x - (6 - k*1.5), sol - 16 - h + k*4, (6 - k*1.5)*2, 4);
  }

  // Guirlande lumineuse : c'est ce qui dit « soir de mariage » plus surement
  // qu'un ciel orange. Elle n'apparait que si la decoration est au dossier.
  if(ctr && ctr.choix.decoration){
    for(const [y0, y1] of [[26, 52], [40, 70]]){
      ctx.strokeStyle = "rgba(60,40,55,.75)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y0); ctx.quadraticCurveTo(W/2, y1, W, y0); ctx.stroke();
      for(let i = 0; i <= 22; i++){
        const u = i/22, x = u*W;
        const y = (1-u)*(1-u)*y0 + 2*(1-u)*u*y1 + u*u*y0;
        ctx.fillStyle = i%2 ? "#ffe9b0" : "#ffd48a";
        ctx.fillRect(Math.round(x)-1, Math.round(y)+2, 2, 3);
        ctx.fillStyle = "rgba(255,230,170,.22)";
        ctx.fillRect(Math.round(x)-3, Math.round(y), 6, 7);
      }
    }
  }

  // Sol en trois bandes, plus fonce vers le premier plan.
  ctx.fillStyle = "#6f8a5c"; ctx.fillRect(0, sol, W, 22);
  ctx.fillStyle = "#628050"; ctx.fillRect(0, sol+22, W, 22);
  ctx.fillStyle = "#557046"; ctx.fillRect(0, sol+44, W, H-sol-44);
  const rs = pepin(hachage("herbe"));
  for(let i = 0; i < 220; i++){
    const x = Math.round(rs()*W), y = sol + Math.round(rs()*(H-sol));
    ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fillRect(x, y, 1, 1);
  }

  // Allee centrale
  ctx.fillStyle = "#efe4d4"; ctx.beginPath();
  ctx.moveTo(W/2-18, sol); ctx.lineTo(W/2+18, sol);
  ctx.lineTo(W/2+52, H); ctx.lineTo(W/2-52, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e2d3bd";
  for(let i = 0; i < 5; i++){
    const u = i/5, y = sol + u*(H-sol), w = 18 + u*34;
    ctx.fillRect(W/2-w, Math.round(y), w*2, 1);
  }

  // Halo chaud derriere le couple : c'est ce qui ramene l'oeil au centre quand
  // tout le reste de l'image est occupe.
  const h2 = ctx.createRadialGradient(W/2, sol-2, 4, W/2, sol-2, 64);
  h2.addColorStop(0, "rgba(255,226,180,.42)"); h2.addColorStop(1, "rgba(255,226,180,0)");
  ctx.fillStyle = h2; ctx.fillRect(W/2-64, sol-66, 128, 128);

  // L'arche : seulement si la decoration a ete choisie. L'ecran doit montrer
  // le dossier reel, trous compris — c'est la moitie de l'information.
  if(ctr && ctr.choix.decoration)
    poserSprite(ctx, spriteMeuble("arche"), W/2, sol+16);

  // Le couple. Sa robe est CELLE du dossier.
  const couple = ctr ? ctr.couple : null;
  if(couple){
    const idRobe = ctr.choix.robe;
    const robe = idRobe != null && G ? G.stock.find(a => a.id === idRobe) : null;
    const idCost = ctr.choix.costume;
    const cost = idCost != null && G ? G.stock.find(a => a.id === idCost) : null;

    poserSprite(ctx, sprite(`marie-${couple.nomB}-${cost ? cost.teinte : "nu"}`,
      () => Gens.marie(couple.nomB, cost ? cost.teinte : "#5a5060")), W/2+18, sol+14);
    poserSprite(ctx, sprite(`mariee-${couple.nomA}-${robe ? robe.id : "nu"}`,
      () => Gens.mariee(couple.nomA,
        robe ? (robe.silhouette || "princesse") : "empire",
        robe ? robe.teinte : "#bdb2b8")), W/2-18, sol+14);
  }
  // L'officiant est toujours la : c'est lui qui fait que la scene est une
  // ceremonie et pas deux personnes debout dans un pre.
  poserSprite(ctx, sprite("officiant", () => Gens.perso({
    peau:"#d29466", chev:"#4a3a30", coiffe:"chignon",
    tissu:"#6b4a63", second:"#8c4f6b", robe:"empire" })), W/2, sol+4);

  /* Les rangees d'invites. Les rangees du fond sont plus PALES : en vue de
     cote, c'est le seul indice de profondeur qu'on ait. Le nombre de rangees
     suit le nombre d'invites du contrat — la scene dit la taille du mariage. */
  const rangs = couple ? Math.max(1, Math.min(3, Math.round(couple.invites / 45))) : 2;
  for(let rang = 0; rang < rangs; rang++){
    const y = sol + 18 + rang*22, k = 1 - rang*.16;
    for(const cote of [-1, 1]) for(let i = 0; i < 3; i++){
      const x = W/2 + cote*(58 + i*30 + rang*6);
      ctx.globalAlpha = .55 + rang*.15;
      poserSprite(ctx, spriteMeuble("chaise", "#c9b8a8"), x, y+6);
      ctx.globalAlpha = 1;
      const nom = `inv${rang}-${i}-${cote}-${couple ? couple.id : 0}`;
      poserSprite(ctx, sprite(nom, () => Gens.invite(nom)), x, y+2);
    }
  }

  // Petales : deux pixels, jamais un flou. Ils tombent avec `t`.
  const rp = pepin(hachage("petales"));
  const n = Math.round(70 * Math.min(1, t*1.4));
  for(let i = 0; i < n; i++){
    const x = Math.round(rp()*W), y0 = Math.round(rp()*(sol+30));
    const y = (y0 + t*40) % (sol+30);
    ctx.fillStyle = rp() < .5 ? "rgba(240,180,195,.85)" : "rgba(250,235,225,.8)";
    ctx.fillRect(x, Math.round(y), 2, 2);
  }
  ctx.fillStyle = "rgba(255,190,140,.12)"; ctx.fillRect(0, 0, W, H);

  // La ligne de trace en cours. Elle vient de `res`, jamais recalculee ici.
  if(res && res.trace){
    const courant = [...res.trace].reverse().find(x => x.tps <= t);
    if(courant) legende(ctx, W, H, courant.txt);
  }
}

function legende(c, W, H, txt){
  c.fillStyle = "rgba(46,36,52,.86)";
  c.fillRect(0, H-22, W, 22);
  c.fillStyle = C.or; c.fillRect(0, H-22, W, 2);
  c.fillStyle = C.creme;
  c.font = "11px 'JetBrains Mono', monospace";
  c.textAlign = "center";
  c.fillText(txt, W/2, H-7);
  c.textAlign = "left";
}

/* ==================================================================== salon
   L'equivalent du raid : un theme tire, ton stand contre ceux des concurrents,
   un jury qui circule. Tout ce qu'on a accumule passe un examen d'un coup. */

export function dessinerSalon(ctx, G, res){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const ox = W/2, oy = 74, GX = 10, GY = 8;
  const e = (gx, gy) => ({ x: ox + (gx-gy)*TL/2, y: oy + (gx+gy)*TH/2 });
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#241c2c"; ctx.fillRect(0, 0, W, H);

  const mur = (p, q, haut, col) => {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y);
    ctx.lineTo(q.x,q.y-haut); ctx.lineTo(p.x,p.y-haut);
    ctx.closePath(); ctx.fill();
  };
  for(let i = 0; i < GY; i++) mur(e(-1,i), e(-1,i+1), 74, "#3b2f45");
  for(let i = 0; i < GX; i++) mur(e(i,-1), e(i+1,-1), 74, "#473859");

  // Poutres du plafond : elles donnent l'echelle d'une halle.
  ctx.fillStyle = "rgba(0,0,0,.22)";
  for(let i = 0; i < GX; i += 2){ const p = e(i,-1); ctx.fillRect(p.x-1, p.y-74, 3, 74); }

  /* ⚠️ La banderole de theme se peint TUILE PAR TUILE le long du mur, comme la
     plinthe. Tracee d'un seul quadrilatere entre les deux extremites, elle
     part en diagonale a travers la halle. */
  const drape = (p, q, fond) => {
    mur(p,q,68,DORE); mur(p,q,66,C.prune); mur(p,q,46,DORE); mur(p,q,44,fond);
  };
  for(let i = 0; i < GX; i++) drape(e(i,-1), e(i+1,-1), "#473859");
  for(let i = 0; i < GY; i++) drape(e(-1,i), e(-1,i+1), "#3b2f45");

  // Fanions : le detail qui dit « salon » plutot que « couloir ».
  for(let i = 0; i < GX*2; i++){
    const p = e(i/2,-1);
    ctx.fillStyle = i%2 ? C.poudre : DORE;
    ctx.fillRect(p.x-2, p.y-44, 4, 4); ctx.fillRect(p.x-1, p.y-40, 2, 2);
  }
  for(let i = 0; i < GY*2; i++){
    const p = e(-1,i/2);
    ctx.fillStyle = i%2 ? DORE : C.poudre;
    ctx.fillRect(p.x-2, p.y-44, 4, 4); ctx.fillRect(p.x-1, p.y-40, 2, 2);
  }

  // Moquette : losanges deux tons + tapis central prune.
  for(let gy = 0; gy < GY; gy++) for(let gx = 0; gx < GX; gx++){
    const p = e(gx,gy);
    dessus(ctx, p.x, p.y+TH/2, TL, TH, (gx+gy)%2 ? "#6a5570" : "#75607b");
  }
  for(let gy = 1; gy < GY; gy++) for(let gx = 4; gx <= 5; gx++){
    const p = e(gx,gy); dessus(ctx, p.x, p.y+TH/2, TL, TH, C.prune);
  }

  const file = [];
  const add = (gx, gy, sp) => file.push({ k:gx+gy, gx, gy, sp });

  // Un stand par concurrent, dans SA couleur : le classement se lit dans la
  // salle avant d'etre lu dans le tableau.
  const rivaux = (res ? res.lignes.filter(l => !l.joueur) : G.concurrents).slice(0, 3);
  rivaux.forEach((c, i) => add(1.4 + i*3.2, 0.2, spriteMeuble("stand", c.couleur)));

  // Le tien, au centre, avec tes plus belles pieces exposees.
  const stand = res && res.stand ? res.stand : [];
  const pieces = stand.map(id => G.stock.find(a => a.id === id)).filter(Boolean);
  pieces.filter(a => a.slot === "robe").slice(0, 2).forEach((a, i) =>
    add(3.4 + i*2.4, 1.8, spriteMeuble("mannequin", `${a.teinte},${a.silhouette || "princesse"}`)));
  add(4.6, 3.4, spriteMeuble("podium"));
  add(0.4, 4.6, spriteMeuble("tableRonde"));
  add(9,   4.4, spriteMeuble("tableRonde"));
  add(1.6, 7,   spriteMeuble("plante"));
  add(8.4, 7,   spriteMeuble("plante"));

  // La foule : le jury, des confreres, toi.
  const foule = [
    [4.6,4.8, "planner"], [3.0,5.4, "invite"], [6.2,5.0, "invite"],
    [5.4,6.6, "invite"],  [2.2,3.2, "traiteur"], [7.4,2.8, "musique"],
    [7.8,6.4, "lieu"],    [2.6,6.8, "concurrente"],
  ];
  for(const [gx, gy, quoi] of foule){
    const sp = sprite(`salon-${quoi}-${gx}`, () => {
      if(quoi === "planner")     return Gens.planner(G.nomAtelier);
      if(quoi === "concurrente") return Gens.concurrente("rivale", C.prune);
      if(quoi === "invite")      return Gens.invite(`salon${gx}${gy}`);
      return Gens.prestataire(`salon${quoi}`, quoi, "boheme");
    });
    add(gx, gy, sp);
  }

  file.sort((a, b) => a.k - b.k);
  for(const it of file){ const p = e(it.gx, it.gy); poserSprite(ctx, it.sp, p.x, p.y+TH/2); }
  ctx.fillStyle = "rgba(120,90,160,.12)"; ctx.fillRect(0, 0, W, H);
}

/* ============================================================= vignettes
   Les petits sprites que l'interface pose dans ses panneaux. Ils passent par
   le meme generateur que la scene : deux chemins de rendu pour un meme
   personnage divergent au premier changement. */

export const vignetteMariee = (couple, article) => sprite(
  `vm-${couple.id}-${article ? article.id : 0}`,
  () => Gens.mariee(couple.nomA,
    article ? (article.silhouette || "princesse") : "empire",
    article ? article.teinte : "#bdb2b8"));

export const vignetteMarie = (couple, article) => sprite(
  `vh-${couple.id}-${article ? article.id : 0}`,
  () => Gens.marie(couple.nomB, article ? article.teinte : "#5a5060"));

export const vignettePresta = cle => sprite(`vp-${cle}`,
  () => Gens.prestataire(cle, PRESTATAIRES[cle].type, PRESTATAIRES[cle].style));

export const vignetteArticle = a => sprite(`va-${a.id}`, () => {
  if(a.slot === "robe")
    return Gens.perso({ peau:"#d8c8bc", chev:"#d8c8bc", coiffe:null,
                        tissu:a.teinte, second:teinter(a.teinte, -.12),
                        robe:a.silhouette || "empire" });
  if(a.slot === "costume")
    return Gens.perso({ peau:"#d8c8bc", chev:"#d8c8bc", coiffe:null,
                        tissu:a.teinte, second:teinter(a.teinte, -.18),
                        jambe:teinter(a.teinte, -.18), dentelle:"#fbf5ea" });
  return spriteMeuble("cadre", a.teinte);
});

/** Style CSS pour poser un sprite dans un element DOM. Voir pixel.styleCanvas. */
export function styleSprite(cv, taillePx){
  if(!cv) return "";
  return `background-image:url(${cv.toDataURL()});`
       + `background-size:contain;background-repeat:no-repeat;`
       + `background-position:center;image-rendering:pixelated;`
       + `width:${taillePx}px;height:${Math.round(taillePx * cv.height / cv.width)}px;`;
}

export { melanger, nomCouple, SLOT, SLOTS, STYLE, FAMILLES };
