/**
 * build-solo.mjs — replie tout le jeu dans UN SEUL fichier HTML.
 *
 * Pourquoi : le jeu doit pouvoir se donner, s'archiver et s'ouvrir sans
 * serveur. En ESM, `index.html` ouvert en `file://` ne marche pas — les
 * modules sont bloques par la politique d'origine. Ce script resout les
 * imports a la main et inline tout dans un `<script>` classique.
 *
 * Aucune dependance : ni bundler, ni minifieur. C'est voulu — un build a
 * dependances est un build qui casse dans six mois.
 *
 * ⚠️ CHAQUE MODULE GARDE SA PORTEE. Premiere version : une simple
 * concatenation avec les `export` retires. Elle a casse tout de suite —
 * `DORE` est declare dans mobilier.js ET dans render.js, et une fois a plat
 * c'est un `SyntaxError` au chargement. Deux modules ont le droit d'avoir des
 * constantes du meme nom ; c'est meme la raison d'etre des modules. On emet
 * donc une fonction par module, et un objet d'exports.
 *
 * ⚠️ Le jeu ne charge aucune image et aucun son : tout est dessine et
 * synthetise a l'execution. C'est ce qui permet a un seul fichier de suffire.
 * La seule ressource externe est la police ; la page retombe sur une police
 * systeme si le reseau manque.
 *
 * Lancer : npm run solo   →  dist/atelier-du-jour-j.html
 *          npm run solo -- --artefact  →  dist/artefact.html
 *
 * ⚠️ Le mode `--artefact` sort le CORPS DE PAGE SEUL — pas de doctype, pas de
 * <html>, pas de <head>, pas de <body>. C'est ce qu'attend un hebergeur qui
 * enveloppe lui-meme le fichier dans son propre squelette. Le jeu ne charge
 * aucune ressource hors la police, donc les deux sorties sont autonomes.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..");
const SRC = join(RACINE, "src");

/* Ordre de repliage : les dependances d'abord. Pose a la main plutot que
   resolu par un graphe — vingt modules, et un ordre explicite se relit.
   Si un jour un cycle apparait, c'est ici qu'il se verra. */
const ORDRE = [
  "utils.js", "config.js", "pixel.js", "iso.js", "sons.js",
  // equipe et codex ne dependent que de config : ils passent tot, parce que
  // clients, boutique et mariage lisent tous les trois l'apport de l'equipe.
  "equipe.js", "codex.js",
  "stock.js", "prestataires.js", "imprevus.js", "clients.js",
  "concurrents.js", "boutique.js", "mariage.js", "salon.js", "state.js",
  "gens.js", "mobilier.js", "render.js", "save.js", "tuto.js",
  "ui.js", "main.js",
];

const cle = chemin => basename(chemin);

/** Decoupe la liste `{ a, b as c }` d'un import ou d'un export. */
function membres(clause){
  return clause.split(",").map(m => m.trim()).filter(Boolean).map(m => {
    const t = m.split(/\s+as\s+/);
    return { source: t[0].trim(), local: (t[1] || t[0]).trim() };
  });
}

/**
 * Transforme un module ESM en corps de fonction + liste d'exports.
 * Les imports deviennent des lectures dans `M`, la table des modules deja
 * construits — c'est ce qui rend l'ordre de ORDRE significatif.
 */
function replier(source){
  const prelude = [];
  const exports = new Set();
  let out = source;

  // export ... from "..."  →  re-export : on lit chez le voisin et on republie.
  out = out.replace(
    /^[ \t]*export\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];?[ \t]*$/gm,
    (_, clause, chemin) => {
      for(const { source: s, local } of membres(clause)){
        prelude.push(`const ${local} = M[${JSON.stringify(cle(chemin))}].${s};`);
        exports.add(local);
      }
      return "";
    });

  // import ... from "..."
  out = out.replace(
    /^[ \t]*import\s+([\s\S]*?)\s+from\s*["']([^"']+)["'];?[ \t]*$/gm,
    (_, clause, chemin) => {
      const k = JSON.stringify(cle(chemin));
      const etoile = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);
      if(etoile){
        prelude.push(`const ${etoile[1]} = M[${k}];`);
        return "";
      }
      const acc = clause.match(/\{([\s\S]*?)\}/);
      if(acc){
        const paires = membres(acc[1])
          .map(({ source: s, local }) => s === local ? s : `${s}: ${local}`);
        prelude.push(`const { ${paires.join(", ")} } = M[${k}];`);
      }
      const defaut = /^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause.replace(/\{[\s\S]*?\}/, ""));
      if(defaut && defaut[1]) prelude.push(`const ${defaut[1]} = M[${k}].default;`);
      return "";
    });

  // import "..." nu : un module purement pour son effet de bord.
  out = out.replace(/^[ \t]*import\s*["'][^"']+["'];?[ \t]*$/gm, "");

  // export { a, b as c }  (sans `from`)
  out = out.replace(/^[ \t]*export\s*\{([\s\S]*?)\}\s*;?[ \t]*$/gm, (_, clause) => {
    for(const { source: s, local } of membres(clause)){
      if(s === local) exports.add(s);
      else { prelude.push(""); exports.add(local); out += `\nvar ${local} = ${s};`; }
    }
    return "";
  });

  // export const / let / var / function / class / async function
  out = out.replace(
    /^[ \t]*export\s+(const|let|var|function\*?|class|async\s+function\*?)\s+([A-Za-z_$][\w$]*)/gm,
    (_, mot, nom) => { exports.add(nom); return `${mot} ${nom}`; });

  // export const {a, b} = ... (destructuration) — pas utilise, mais explicite.
  out = out.replace(/^[ \t]*export\s+(const|let|var)\s+\{/gm, "$1 {");

  return { corps: prelude.join("\n") + "\n" + out, exports: [...exports] };
}

let corps = "";
for(const f of ORDRE){
  const src = readFileSync(join(SRC, f), "utf8");
  const { corps: c, exports } = replier(src);
  corps += `\n/* ===== ${f} ${"=".repeat(Math.max(0, 60 - f.length))} */\n`;
  corps += `M[${JSON.stringify(f)}] = (function(M){\n${c}\n`;
  corps += `return { ${exports.join(", ")} };\n})(M);\n`;
}

const html = readFileSync(join(RACINE, "index.html"), "utf8");

/* On remplace la balise module par le code replie. `type="module"` disparait :
   c'est justement ce qui empechait le fichier de s'ouvrir en file://. */
const script = `<script>\n"use strict";\n(function(){\nconst M = {};\n${corps}\n})();\n</script>`;
const sortie = html.replace(/<script type="module"[^>]*><\/script>/, script);

if(sortie === html){
  console.error("La balise <script type=\"module\"> est introuvable dans index.html.");
  process.exit(1);
}

mkdirSync(join(RACINE, "dist"), { recursive: true });

const artefact = process.argv.includes("--artefact");
const nom = artefact ? "artefact.html" : "atelier-du-jour-j.html";

/* En mode artefact on ne garde que ce qui vit DANS le corps : le titre (que
   l'hebergeur va chercher pour nommer la page), la police, la feuille de
   style, le point de montage et le code. Le reste du squelette est fourni. */
let rendu = sortie;
if(artefact){
  const morceau = (ouvre, ferme) => {
    const a = html.indexOf(ouvre);
    if(a < 0) return "";
    const b = html.indexOf(ferme, a);
    return html.slice(a, b + ferme.length);
  };
  rendu = [
    morceau("<title>", "</title>"),
    morceau(`<link href="https://fonts.googleapis.com`, ">"),
    morceau("<style>", "</style>"),
    `<div id="app"></div>`,
    script,
  ].join("\n");
}

const chemin = join(RACINE, "dist", nom);
writeFileSync(chemin, rendu);

console.log(`dist/${nom} — ${(rendu.length/1024).toFixed(0)} ko, `
          + `${ORDRE.length} modules repliés, chacun dans sa portée`
          + (artefact ? " (corps de page seul)." : "."));
console.log(`Aucune image, aucun son : tout est dessiné et synthétisé à l'exécution.`);
