/** utils.js — aides sans dependance. */

/**
 * Generateur aleatoire GRAINE (mulberry32).
 *
 * Indispensable : sans graine, deux parties identiques donnent 400 jours et
 * 0 wipe ou 750 jours et 16 wipes. L'equilibrage devient intestable.
 * Toute source d'alea du jeu DOIT passer par alea() — jamais Math.random().
 */
let _etat = (Math.random() * 4294967296) >>> 0;
export function graine(n){ _etat = n >>> 0; }

/* Lire/ecrire l'etat interne : une sauvegarde qui ne le restaure pas donnerait
   une suite de tirages differente au rechargement, et la partie cesserait
   d'etre reproductible. */
export const etatAlea = () => _etat >>> 0;
export const setEtatAlea = n => { _etat = n >>> 0; };
export function alea(){
  _etat |= 0; _etat = (_etat + 0x6D2B79F5) | 0;
  let t = Math.imul(_etat ^ (_etat >>> 15), 1 | _etat);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const rnd  = (a,b) => a + alea()*(b-a);
export const pick = a => a[Math.floor(alea()*a.length)];
export const fmt  = n => Math.floor(n).toLocaleString("fr-FR");
export const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/** Tirage pondere sur un objet {cle:{poids:n}}. */
export function tirerPondere(table, cle="poids", modif=null){
  let tot=0; const cum=[];
  for(const k in table){
    let w = table[k][cle];
    if(modif) w = modif(k, w);
    tot += w; cum.push([k, tot]);
  }
  const x = alea()*tot;
  for(const [k,c] of cum) if(x<=c) return k;
  return Object.keys(table)[0];
}

/**
 * Hachage FNV-1a d'une chaine.
 *
 * C'est ce qui remplace `alea()` partout ou il faut du « hasard » STABLE et
 * qui ne doit pas consommer le generateur de la simulation : l'aspect d'un
 * villageois, les membres d'une guilde rivale, la recette d'un batiment.
 */
export function hachage(s){
  let h = 0x811c9dc5;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
