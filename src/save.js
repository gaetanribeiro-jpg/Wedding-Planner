/**
 * save.js — persistance ET code de partie.
 *
 * ⚠️ Piege herite n°3, celui qui a coute une session entiere : UNE SAUVEGARDE
 * PEUT ECHOUER EN SILENCE. `localStorage` leve dans un cadre bac a sable, et
 * un quota depasse TRONQUE sans rien lever. Les quatre parades sont donc
 * montees des le depart, pas ajoutees apres coup :
 *
 *   1. un test d'ecriture REEL au demarrage (`tester()`) ;
 *   2. une RELECTURE de ce qu'on vient d'ecrire, comparee par empreinte ;
 *   3. un etat d'erreur que l'interface affiche en bandeau tant qu'il dure ;
 *   4. un CODE DE PARTIE copiable qui ne depend d'aucun stockage, accessible
 *      depuis le jeu et depuis l'ecran titre.
 *
 * ⚠️ L'etat du generateur aleatoire et les compteurs d'id voyagent avec la
 * partie. Sans eux, recharger donne une autre suite de tirages : la partie
 * cesse d'etre reproductible a graine fixe, et l'equilibrage devient
 * invérifiable.
 */

import { hachage } from "./utils.js";
import * as S from "./state.js";
import { prixArticle, teinteArticle } from "./stock.js";
import { FAMILLES } from "./config.js";
import * as Equipe from "./equipe.js";
import * as Codex from "./codex.js";

const CLE = "jourj-partie";
export const VERSION_SAVE = 2;

/* L'etat du stockage, lu par l'interface pour son bandeau. */
export const etatStockage = { ok:null, raison:"", derniereEcriture:0 };

/**
 * Test d'ecriture REEL, pas une detection de fonctionnalite. Verifier que
 * `window.localStorage` existe ne dit rien : dans un bac a sable, l'objet est
 * la et c'est l'ecriture qui leve.
 */
export function tester(){
  try{
    const t = "jourj-test-" + Date.now();
    localStorage.setItem(t, "1");
    const relu = localStorage.getItem(t);
    localStorage.removeItem(t);
    if(relu !== "1"){
      etatStockage.ok = false;
      etatStockage.raison = "le navigateur accepte l'écriture mais ne la relit pas";
      return false;
    }
    etatStockage.ok = true; etatStockage.raison = "";
    return true;
  }catch(e){
    etatStockage.ok = false;
    etatStockage.raison = "le navigateur refuse le stockage local";
    return false;
  }
}

/* ------------------------------------------------------------ compression
   On ne stocke que ce qui ne se recalcule pas. Un article garde son id, son
   slot, sa famille, son style, son tier, sa rarete et ses affixes ; son prix,
   sa teinte et sa silhouette se REDERIVENT au chargement. Sur une partie
   avancee, ca divise la taille du stock par trois — et le quota de
   localStorage est exactement le genre de plafond qui casse en silence. */

const compActicle = a => [a.id, a.slot, a.famille, a.style, a.tier, a.rarete,
                          a.affixes, a.usages];

function decompArticle(v){
  const [id, slot, famille, style, tier, rarete, affixes, usages] = v;
  return {
    id, slot, famille, style, tier, rarete, affixes: affixes || [], usages: usages || 0,
    silhouette: FAMILLES[slot][famille].silhouette || null,
    prix: prixArticle(slot, famille, tier, rarete),
    teinte: teinteArticle(slot, style, tier),
  };
}

/** L'etat, ramene a ce qui doit vraiment voyager. */
export function serialiser(G){
  const s = {};
  for(const k of S.SIMPLES) s[k] = G[k];
  s.graine = G.graine;
  s.alea = S.snapshotAlea();
  s.boutique = G.boutique;
  s.stock = G.stock.map(compActicle);
  s.catalogue = G.catalogue.map(compActicle);
  s.prospects = G.prospects;
  // Un contrat porte son couple en entier : deux dossiers ne partagent jamais
  // un couple, donc pas de reference a reconstruire.
  s.contrats = G.contrats;
  s.prestas = G.prestas;
  s.concurrents = G.concurrents;
  // ⚠️ Nouveaux champs de la v2 : l'equipe et le codex. Les oublier ici
  // rechargerait une partie sans employes et sans decouvertes, sans que rien
  // ne le signale — c'est pour ca que VERSION est passee a 2.
  s.equipe = G.equipe;
  s.codex = G.codex;
  s.idMembre = Equipe.etatIdMembre();
  s.stats = G.stats;
  // Le journal et les salons sont de l'historique d'affichage : on en garde
  // assez pour l'ecran bilan, pas plus. C'est la principale source de gonfle.
  s.journal = G.journal.slice(0, 12);
  s.salons = G.salons.slice(0, 8);
  s.derniereJournee = G.derniereJournee;
  return s;
}

export function deserialiser(s){
  const G = S.nouvellePartie(s.graine >>> 0, s.nomAtelier || "L'Atelier");
  for(const k of S.SIMPLES) if(k in s) G[k] = s[k];
  G.graine = s.graine >>> 0;
  G.boutique = s.boutique;
  G.stock = (s.stock || []).map(decompArticle);
  G.catalogue = (s.catalogue || []).map(decompArticle);
  G.prospects = s.prospects || [];
  G.contrats = s.contrats || [];
  G.prestas = s.prestas || {};
  G.concurrents = s.concurrents || [];
  G.equipe = s.equipe || [];
  G.codex = { ...Codex.codexInitial(), ...(s.codex || {}) };
  if(s.idMembre) Equipe.setIdMembre(s.idMembre);
  G.stats = { ...S.statsVierges(), ...(s.stats || {}) };
  G.journal = s.journal || [];
  G.salons = s.salons || [];
  G.derniereJournee = s.derniereJournee || null;
  // ⚠️ En DERNIER : `nouvellePartie` a repose la graine et consomme des
  // tirages pour le stock initial. Restaurer l'etat du generateur avant
  // aurait ete ecrase.
  if(s.alea) S.restaurerAlea(s.alea);
  return G;
}

/* -------------------------------------------------------------- ecriture */

/**
 * Sauve, PUIS relit et compare une empreinte.
 * ⚠️ C'est la relecture qui compte : un quota depasse tronque la chaine sans
 * lever, et `setItem` rend la main comme si tout allait bien. Sans cette
 * verification, on decouvre le probleme au rechargement — c'est-a-dire trop
 * tard.
 */
export function sauver(G){
  let texte;
  try{
    texte = JSON.stringify({ v:VERSION_SAVE, e:serialiser(G) });
  }catch(e){
    etatStockage.ok = false;
    etatStockage.raison = "l'état du jeu n'a pas pu être sérialisé";
    return false;
  }
  try{
    localStorage.setItem(CLE, texte);
    const relu = localStorage.getItem(CLE);
    if(relu == null || relu.length !== texte.length || hachage(relu) !== hachage(texte)){
      etatStockage.ok = false;
      etatStockage.raison = "la sauvegarde a été tronquée par le navigateur "
                          + "(quota dépassé) — utilise le code de partie";
      return false;
    }
    etatStockage.ok = true; etatStockage.raison = "";
    etatStockage.derniereEcriture = Date.now();
    return true;
  }catch(e){
    etatStockage.ok = false;
    etatStockage.raison = "le navigateur refuse d'écrire la sauvegarde "
                        + "— utilise le code de partie";
    return false;
  }
}

export function charger(){
  try{
    const t = localStorage.getItem(CLE);
    if(!t) return null;
    const o = JSON.parse(t);
    if(!o || o.v !== VERSION_SAVE) return null;
    return deserialiser(o.e);
  }catch(e){
    return null;
  }
}

export function effacer(){
  try{ localStorage.removeItem(CLE); return true; }catch(e){ return false; }
}

export function existeUneSauvegarde(){
  try{ return !!localStorage.getItem(CLE); }catch(e){ return false; }
}

/* ------------------------------------------------------- code de partie
   Il ne depend d'AUCUN stockage : c'est la seule porte de sortie quand le
   navigateur refuse d'ecrire. Il doit donc etre accessible depuis le jeu ET
   depuis l'ecran titre — un code qu'on ne peut coller nulle part ne sert a
   rien. */

/* base64url : le code se colle dans un champ, un courriel, une URL. Le `+`
   et le `/` du base64 standard survivent mal aux trois. */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function versB64(octets){
  let out = "";
  for(let i = 0; i < octets.length; i += 3){
    const a = octets[i], b = octets[i+1], c = octets[i+2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b || 0) >> 4)];
    out += i+1 < octets.length ? B64[((b & 15) << 2) | ((c || 0) >> 6)] : "=";
    out += i+2 < octets.length ? B64[c & 63] : "=";
  }
  return out;
}

function depuisB64(s){
  const t = s.replace(/=+$/, "");
  const out = [];
  for(let i = 0; i < t.length; i += 4){
    const n = [0,1,2,3].map(k => B64.indexOf(t[i+k]));
    out.push(((n[0] << 2) | (n[1] >> 4)) & 255);
    if(n[2] >= 0) out.push(((n[1] << 4) | (n[2] >> 2)) & 255);
    if(n[3] >= 0) out.push(((n[2] << 6) | n[3]) & 255);
  }
  return out;
}

const enUtf8 = s => [...new TextEncoder().encode(s)];
const deUtf8 = o => new TextDecoder().decode(new Uint8Array(o));

/* ------------------------------------------------------------ compression
   LZSS, fenetre de 4 ko, longueurs de 3 a 18.
   ⚠️ Sans elle, le code de partie fait 26 000 caracteres au bout de 300 jours
   et grossit avec le stock. Un code qu'on ne peut pas coller dans un champ ou
   un courriel n'est pas une porte de sortie — et c'est justement le seul
   recours quand le navigateur refuse d'ecrire. Ici il tombe autour du quart.

   Le format : un octet de drapeaux, puis huit elements. Bit a 1 = litteral
   (un octet), bit a 0 = reference (deux octets : 12 bits d'offset, 4 bits de
   longueur moins trois). */

/* ⚠️ LE DECALAGE TIENT SUR 12 BITS, donc il va de 1 a 4095 — PAS a 4096.
   Premiere version : la fenetre de recherche remontait a `i - FENETRE`, donc
   un recouvrement pouvait etre trouve a exactement 4096 octets. A l'encodage,
   `(4096 >> 4) & 255` vaut 0 et `(4096 & 15) << 4` vaut 0 : le decalage sort
   comme ZERO. Au decodage, `debut = out.length - 0` pointe apres la fin du
   tampon, la copie ramene des `undefined`, et la fin de la chaine part en
   fumee.
   Il faut plus de 4 ko d'historique pour qu'un tel recouvrement existe : les
   petites parties passaient, les grosses rendaient un code que le jeu
   refusait lui-meme avec « Code abime : il a ete tronque a la copie ». Le code
   etait intact ; c'est le compresseur qui mentait.
   La fenetre UTILE vaut donc FENETRE - 1. */
const FENETRE = 4096, DECALAGE_MAX = FENETRE - 1, LONG_MAX = 18, LONG_MIN = 3;

export function compresser(src){
  const out = [];
  let i = 0;
  while(i < src.length){
    const drapeauxAt = out.length;
    out.push(0);
    let drapeaux = 0;
    for(let bit = 0; bit < 8 && i < src.length; bit++){
      // Recherche du plus long recouvrement dans la fenetre. Bornee : une
      // recherche exhaustive sur 4 ko rendrait la sauvegarde perceptible.
      let meilleurLong = 0, meilleurOff = 0;
      const debut = Math.max(0, i - DECALAGE_MAX);
      for(let j = i - 1; j >= debut; j--){
        if(src[j] !== src[i]) continue;
        let l = 1;
        while(l < LONG_MAX && i + l < src.length && src[j + l] === src[i + l]) l++;
        if(l > meilleurLong){ meilleurLong = l; meilleurOff = i - j; }
        if(l === LONG_MAX) break;
      }
      if(meilleurLong >= LONG_MIN){
        out.push(((meilleurOff >> 4) & 255));
        out.push(((meilleurOff & 15) << 4) | (meilleurLong - LONG_MIN));
        i += meilleurLong;
      }else{
        drapeaux |= (1 << bit);
        out.push(src[i]); i++;
      }
    }
    out[drapeauxAt] = drapeaux;
  }
  return out;
}

export function decompresser(src){
  const out = [];
  let i = 0;
  while(i < src.length){
    const drapeaux = src[i++];
    for(let bit = 0; bit < 8 && i < src.length; bit++){
      if(drapeaux & (1 << bit)){
        out.push(src[i++]);
      }else{
        // Une reference fait DEUX octets : s'il n'en reste qu'un, le flux est
        // tronque pour de vrai. On s'arrete net plutot que de lire `undefined`
        // et de rendre une chaine a moitie juste — c'est l'empreinte qui doit
        // annoncer le probleme, pas un texte silencieusement faux.
        if(i + 1 >= src.length) return out;
        const a = src[i++], b = src[i++];
        const off = (a << 4) | (b >> 4);
        const len = (b & 15) + LONG_MIN;
        const debut = out.length - off;
        if(off === 0 || debut < 0) return out;
        // Copie octet par octet : un recouvrement peut se chevaucher avec
        // lui-meme (c'est ainsi qu'on encode une repetition longue).
        for(let k = 0; k < len; k++) out.push(out[debut + k]);
      }
    }
  }
  return out;
}

/**
 * Le code de partie : version, empreinte, charge utile.
 * L'empreinte permet de dire « ce code est abime » plutot que de charger une
 * partie a moitie lue — un code tronque par un copier-coller rate est le cas
 * courant, pas le cas rare.
 */
export function codeDePartie(G){
  const texte = JSON.stringify(serialiser(G));
  const somme = hachage(texte).toString(36).padStart(7, "0").slice(0, 7);
  return `JJ${VERSION_SAVE}-${somme}-${versB64(compresser(enUtf8(texte)))}`;
}

export function depuisCode(code){
  try{
    const propre = String(code).trim().replace(/\s+/g, "");
    const m = /^JJ(\d+)-([0-9a-z]{7})-(.+)$/.exec(propre);
    if(!m) return { ok:false, txt:"Ce n'est pas un code de partie." };
    if(+m[1] !== VERSION_SAVE)
      return { ok:false, txt:`Code d'une autre version du jeu (v${m[1]}).` };
    const texte = deUtf8(decompresser(depuisB64(m[3])));
    const somme = hachage(texte).toString(36).padStart(7, "0").slice(0, 7);
    if(somme !== m[2])
      return { ok:false, txt:"Code abîmé : il a été tronqué à la copie." };
    return { ok:true, G: deserialiser(JSON.parse(texte)) };
  }catch(e){
    return { ok:false, txt:"Code illisible." };
  }
}

/** Sauvegarde automatique, bornee : ecrire a chaque tick userait le quota. */
let _dernier = 0;
export function sauverSiBesoin(G, intervalleMs = 20000){
  const t = Date.now();
  if(t - _dernier < intervalleMs) return null;
  _dernier = t;
  return sauver(G);
}
