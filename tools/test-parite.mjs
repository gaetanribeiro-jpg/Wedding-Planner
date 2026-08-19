/**
 * test-parite.mjs — l'oracle JS. Il joue N parties completes et agrege.
 *
 * ⚠️ Piege herite n°7, celui qui a fait annoncer 13 378 jours la ou il y en
 * avait 11 514 : NE CONCLUS JAMAIS SUR UNE GRAINE, NI MEME SUR DIX. Les deux
 * mesures etaient justes ; l'une etait sous-echantillonnee.
 *   10 graines = un degrossissage.
 *   20 graines = une mesure.
 * Le harnais le rappelle a l'ecran sous 20 graines, et refuse de qualifier une
 * mesure de « mesure » en dessous.
 *
 * ⚠️ Piege herite n°8 : ne balaie jamais une constante pendant que tu edites
 * les sources. Le mode `--sweep` relance un processus par valeur ; deux points
 * mesures avec des fichiers differents ne se comparent pas. Le harnais prend
 * donc une empreinte des sources au demarrage et la revalide a la fin.
 *
 * Usage :
 *   node tools/test-parite.mjs --mediane --graines 20
 *   node tools/test-parite.mjs --json
 *   node tools/test-parite.mjs --detail          (une ligne par graine)
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { jouerPartie } from "./joueur.mjs";
import { CFG, PALIERS } from "../src/config.js";
import { hachage } from "../src/utils.js";

const ICI = dirname(fileURLToPath(import.meta.url));
const SRC = join(ICI, "..", "src");

const arg = (nom, defaut) => {
  const i = process.argv.indexOf("--" + nom);
  if(i < 0) return defaut;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith("--")) ? true : v;
};

const GRAINES  = +arg("graines", 20);
const JOUR_MAX = +arg("jourmax", 12000);
const JSON_OUT = !!arg("json", false);
const DETAIL   = !!arg("detail", false);

/** Empreinte des sources : deux mesures ne se comparent que si elle est egale. */
function empreinteSources(){
  let t = "";
  for(const f of readdirSync(SRC).sort())
    if(f.endsWith(".js")) t += f + readFileSync(join(SRC, f), "utf8");
  return hachage(t).toString(36);
}

const mediane = l => {
  if(!l.length) return 0;
  const s = [...l].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
};
const moyenne = l => l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0;
const pct = (l, p) => {
  if(!l.length) return 0;
  const s = [...l].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

/* ------------------------------------------------------------------ run */

const empreinte = empreinteSources();
const t0 = Date.now();
const parties = [];
for(let g = 1; g <= GRAINES; g++) parties.push(jouerPartie(g, JOUR_MAX));
const duree = Date.now() - t0;

if(empreinteSources() !== empreinte){
  console.error("\n⚠️  LES SOURCES ONT CHANGE PENDANT LA MESURE. "
              + "Le resultat ne veut rien dire — relance sans editer.\n");
  process.exit(2);
}

const col = k => parties.map(p => p[k]);
const finies = parties.filter(p => p.complete);
const joursRef = finies.length ? finies.map(p => p.finiLe) : col("jour");

const R = {
  graines: GRAINES,
  empreinteSources: empreinte,
  completion: finies.length / parties.length,
  // ⚠️ `heures` se calcule sur LA MEME POPULATION que `jours` — les parties
  // terminees. Une partie tronquee a jourMax entrerait dans la mediane des
  // heures sans entrer dans celle des jours, et les deux chiffres cesseraient
  // de parler de la meme chose.
  jours:        mediane(joursRef),
  joursP10:     pct(joursRef, .10),
  joursP90:     pct(joursRef, .90),
  heures:       +(mediane(joursRef) * CFG.MS_PAR_JOUR / 3600000).toFixed(2),
  contrats:     mediane(col("contrats")),
  refuses:      mediane(col("refuses")),
  rates:        mediane(col("rates")),
  tauxRate:     mediane(col("tauxRate")),
  noteMoyenne:  mediane(col("noteMoyenne")),
  palier:       mediane(col("palier")),
  argentFinal:  mediane(col("argent")),
  stock:        mediane(col("stock")),
  meubles:      mediane(col("meubles")),
  visiteurs:    mediane(col("visiteurs")),
  refoules:     mediane(col("refoules")),
  salonsJoues:  mediane(col("salonsJoues")),
  salonsGagnes: mediane(col("salonsGagnes")),
  recetteBoutique: mediane(col("recetteBoutique")),
  honoraires:   mediane(col("honoraires")),
  msParJour:    CFG.MS_PAR_JOUR,
};

if(JSON_OUT){
  console.log(JSON.stringify(R, null, 2));
  process.exit(0);
}

/* --------------------------------------------------------------- sortie */

const f = n => Number.isInteger(n) ? String(n) : n.toFixed(2);
const ligne = (a, b, c = "") =>
  console.log("  " + a.padEnd(26) + String(b).padStart(12) + (c ? "   " + c : ""));

const ecart = (v, [lo, hi]) =>
  v < lo ? `\x1b[33msous la cible (${lo}–${hi})\x1b[0m`
: v > hi ? `\x1b[33mau-dessus (${lo}–${hi})\x1b[0m`
:          `\x1b[32mdans la cible\x1b[0m`;

console.log(`\n\x1b[1mL'ATELIER DU JOUR J — oracle JS\x1b[0m`);
console.log(`  ${GRAINES} graines · ${(duree/1000).toFixed(1)} s · `
          + `sources ${empreinte}`);
if(GRAINES < 20)
  console.log(`  \x1b[33m⚠️  ${GRAINES} graines : c'est un degrossissage, pas une mesure. `
            + `Il en faut 20.\x1b[0m`);

console.log("\n\x1b[1m  DUREE DE VIE\x1b[0m");
ligne("Parties terminees", `${Math.round(R.completion*100)} %`,
      R.completion >= 1 ? "\x1b[32mcomplet\x1b[0m" : "\x1b[31mincomplet\x1b[0m");
ligne("Jours (mediane)", f(R.jours), `p10 ${f(R.joursP10)} · p90 ${f(R.joursP90)}`);
ligne("Heures d'horloge a 1x", f(R.heures), ecart(R.heures, [CFG.CIBLE_HEURES*0.8, CFG.CIBLE_HEURES*1.2]));
ligne("Palier atteint", f(R.palier), `sur ${PALIERS.length}`);

console.log("\n\x1b[1m  LA BOUCLE\x1b[0m");
ligne("Contrats signes", f(R.contrats), ecart(R.contrats, CFG.CIBLE_CONTRATS));
ligne("Contrats refuses", f(R.refuses), ecart(R.refuses, CFG.CIBLE_REFUS));
ligne("Mariages rates", f(R.rates));
ligne("Taux de rate", (R.tauxRate*100).toFixed(1) + " %",
      ecart(R.tauxRate, [CFG.CIBLE_TAUX_RATE*0.6, CFG.CIBLE_TAUX_RATE*1.4]));
ligne("Note moyenne", f(R.noteMoyenne));
ligne("Salons joues / gagnes", `${f(R.salonsJoues)} / ${f(R.salonsGagnes)}`);

console.log("\n\x1b[1m  LA BOUTIQUE\x1b[0m");
ligne("Meubles poses", f(R.meubles));
ligne("Visiteurs", f(R.visiteurs));
ligne("Visiteurs refoules", f(R.refoules),
      R.visiteurs ? `${Math.round(R.refoules/R.visiteurs*100)} % — le plafond des places` : "");
ligne("Recette boutique", f(R.recetteBoutique));
ligne("Honoraires", f(R.honoraires),
      R.recetteBoutique ? `${(R.honoraires/R.recetteBoutique).toFixed(1)}× la boutique` : "");
ligne("Stock final", f(R.stock));
ligne("Argent final", f(R.argentFinal));

/* ⚠️ Piege herite n°6 : un contenu inatteignable n'est pas du contenu. On
   mesure donc ce que le joueur OBTIENT, pas ce que les tables contiennent. */
console.log("\n\x1b[1m  CE QUE LE JOUEUR ATTEINT REELLEMENT\x1b[0m");
const parPalier = PALIERS.map(p =>
  parties.filter(x => x.palier >= p.n).length / parties.length);
PALIERS.forEach((p, i) =>
  ligne(`Palier ${p.n} — ${p.txt}`, `${Math.round(parPalier[i]*100)} %`,
        parPalier[i] === 0 ? "\x1b[31mjamais atteint\x1b[0m" : ""));

if(DETAIL){
  console.log("\n\x1b[1m  PAR GRAINE\x1b[0m");
  console.log("  graine  jours  palier  contrats  refus  rates  note");
  parties.forEach((p, i) => console.log(
    `  ${String(i+1).padStart(6)}  ${String(p.jour).padStart(5)}  `
    + `${String(p.palier).padStart(6)}  ${String(p.contrats).padStart(8)}  `
    + `${String(p.refuses).padStart(5)}  ${String(p.rates).padStart(5)}  `
    + `${p.noteMoyenne.toFixed(1).padStart(5)}`));
}

console.log("");
