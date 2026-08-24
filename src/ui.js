/**
 * ui.js — le DOM. AUCUNE logique de jeu ici.
 *
 * ⚠️ Regle de dependance : ce module lit `G` et appelle les actions que
 * `main.js` lui passe. Il ne modifie jamais l'etat lui-meme et ne decide
 * jamais si une action est permise — c'est `state.js` qui refuse, et l'ecran
 * ne fait que montrer le refus. Sur le projet precedent, un deblocage verifie
 * dans l'affichage et pas dans l'action a laisse passer l'oracle : la regle
 * n'existait que pour le joueur (piege herite n°5).
 *
 * Le seul ecran MODAL du jeu est le salon (decision de design n°2). Tout le
 * reste s'annonce par un bandeau, et la boutique ne se fait jamais voler
 * l'ecran (decision n°8).
 */

import { fmt } from "./utils.js";
import * as S from "./state.js";
import * as Sv from "./save.js";
import { SLOTS, SLOT, STYLE, STYLES, AXES, PALIERS, MEUBLES, RARETES,
         SALON, CFG, PRESTATAIRES, AFFIXES, ROLES, EQUIPE,
         EXIGENCE_FLOU } from "./config.js";
import * as Stock from "./stock.js";
import * as Presta from "./prestataires.js";
import * as Clients from "./clients.js";
import * as Boutique from "./boutique.js";
import * as Salon from "./salon.js";
import * as Equipe from "./equipe.js";
import * as Codex from "./codex.js";
import * as Imprevus from "./imprevus.js";
import * as R from "./render.js";
import { axesAffiches } from "./mariage.js";

export const ONGLETS = [
  ["boutique","BOUTIQUE"], ["stock","STOCK"], ["clients","CLIENTS"],
  ["prestataires","PRESTA"], ["equipe","ÉQUIPE"], ["codex","CODEX"],
  ["salon","SALON"], ["bilan","BILAN"],
];

/* L'etat d'INTERFACE, distinct de l'etat de jeu : onglet courant, meuble en
   main, dossier ouvert. Il n'a rien a faire dans `G` — il ne se sauvegarde
   pas et ne doit pas entrer dans la reproductibilite. */
export const vue = {
  onglet: "boutique",
  meubleEnMain: null,
  dossierOuvert: null,
  prospectOuvert: null,
  slotOuvert: null,
  survol: null,
  valide: true,
  message: "",
  messageJusque: 0,
};

let $racine = null, $scene = null, actions = {};

const ech = s => String(s).replace(/[&<>"]/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

/** Un message fugace en bas d'ecran : c'est la reponse aux refus de `state`. */
export function dire(txt, ms = 2600){
  vue.message = txt;
  vue.messageJusque = Date.now() + ms;
}

/* ==================================================================== shell */

export function monter(racine, G, cb){
  $racine = racine;
  actions = cb;
  racine.innerHTML = `
    <div class="jeu">
      <div class="barre" id="barre"></div>
      <div id="bandeaux"></div>
      <canvas class="scene" id="scene" width="340" height="216"></canvas>
      <div class="onglets" id="onglets"></div>
      <div id="panneau"></div>
    </div>
    <div id="modal" class="modal" hidden></div>
    <div id="flash" class="flash" hidden></div>`;
  $scene = racine.querySelector("#scene");

  racine.querySelector("#onglets").addEventListener("click", e => {
    const t = e.target.closest("[data-onglet]");
    if(!t) return;
    vue.onglet = t.dataset.onglet;
    vue.meubleEnMain = null;
    rafraichir(G);
  });

  // Delegation unique : chaque bouton porte son intention en data-*.
  racine.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if(!el) return;
    const { act, ...d } = el.dataset;
    actions.commande?.(act, d, el);
  });

  // La boutique se pose au doigt. `caseSousLeDoigt` est l'inverse exact de la
  // projection : si les deux divergent, on vise une case et on batit sur une
  // autre (voir iso.js).
  $scene.addEventListener("mousemove", e => {
    if(vue.onglet !== "boutique" || !vue.meubleEnMain) return;
    const r = $scene.getBoundingClientRect();
    const px = (e.clientX - r.left) * $scene.width / r.width;
    const py = (e.clientY - r.top) * $scene.height / r.height;
    vue.survol = R.caseSousLeDoigt($scene.getContext("2d"), G, px, py);
    const v = Boutique.peutPlacer(G.boutique, vue.meubleEnMain,
      vue.survol.gx, vue.survol.gy, G.palier, G.argent);
    vue.valide = v.ok;
  });
  $scene.addEventListener("mouseleave", () => { vue.survol = null; });
  $scene.addEventListener("click", () => {
    if(vue.onglet !== "boutique" || !vue.meubleEnMain || !vue.survol) return;
    actions.commande?.("poser", { cle:vue.meubleEnMain,
      gx:vue.survol.gx, gy:vue.survol.gy });
  });

  rafraichir(G);
  return { scene:$scene };
}

export const contexteScene = () => $scene.getContext("2d");

/* =================================================================== barre */

function barre(G){
  const p = S.palierCourant(G);
  const sai = S.infoSaison(G);
  const res = [
    { n:"Argent",    v:fmt(G.argent) + " €", c:"#d8a94a" },
    { n:"Notoriété", v:etoiles(G.palier) + " " + fmt(G.notoriete), c:"#e69aa6" },
    { n:"Stock",     v:G.stock.length, c:"#7fa87a" },
    { n:"Saison",    v:sai.txt, c:sai.couleur },
    { n:"Jour",      v:`${S.jourDansAnnee(G.jour)} · an ${S.anneeDe(G.jour)}`, c:"#a89bb0" },
  ];
  const vitesses = CFG.VITESSES.map(v =>
    `<span data-act="vitesse" data-v="${v}" ${v === G.vitesse ? "data-on" : ""}>`
    + `${v === 0 ? "II" : v + "x"}</span>`).join("");
  return `<span class="titre">${ech(G.nomAtelier.toUpperCase())}</span>
    ${res.map(r => `<span class="res"><i style="background:${r.c}"></i>
      <span class="lbl">${r.n}</span><b>${r.v}</b></span>`).join("")}
    <span class="palier" title="${ech(p.txtDeblocage)}">${ech(p.txt)}</span>
    <span class="vitesse">${vitesses}</span>`;
}

const etoiles = p => "★".repeat(p) + "☆".repeat(PALIERS.length - p);

/* ================================================================ bandeaux
   Le jour J s'ANNONCE, il ne vole pas l'ecran (decision de design n°8). */

function bandeaux(G){
  const out = [];

  // ⚠️ Le bandeau de stockage reste tant que le probleme dure. Un message
  // fugace serait rate par le joueur, et il perdrait sa partie sans savoir.
  if(Sv.etatStockage.ok === false){
    out.push(`<div class="bandeau alerte">
      <b>SAUVEGARDE IMPOSSIBLE</b> — ${ech(Sv.etatStockage.raison)}.
      <button data-act="code">copier le code de partie</button></div>`);
  }

  const d = S.dossierUrgent(G);
  if(d){
    const reste = d.jourJ - G.jour;
    if(reste <= 3){
      const manque = SLOTS.filter(s => !d.choix[s]).length;
      out.push(`<div class="bandeau ${reste <= 1 ? "urgent" : ""}">
        JOUR J DANS ${reste} JOUR${reste > 1 ? "S" : ""} ·
        ${ech(Clients.nomCouple(d.couple))}
        ${manque ? `· <b>${manque} emplacement${manque > 1 ? "s" : ""} vide${manque > 1 ? "s" : ""}</b>` : "· dossier complet"}
        <button data-act="ouvrir" data-id="${d.id}">ouvrir le dossier</button></div>`);
    }
  }

  const versSalon = (CFG.SALON_JOUR_DANS_ANNEE - S.jourDansAnnee(G.jour) + CFG.SALON_TOUS_LES_JOURS)
                    % CFG.SALON_TOUS_LES_JOURS;
  if(versSalon > 0 && versSalon <= 20)
    out.push(`<div class="bandeau">SALON DU MARIAGE DANS ${versSalon} JOURS —
      il se juge sur ton stock, pas sur ton argent.</div>`);

  return out.join("");
}

/* ================================================================ panneaux */

/**
 * Assombrit une couleur de `config.js` jusqu'a ce qu'elle se lise SUR
 * PARCHEMIN.
 *
 * ⚠️ Les couleurs de config.js ont DEUX METIERS : elles teintent un sprite sur
 * le canvas, et elles servent d'encre ici. Elles ont ete choisies claires
 * parce que le canvas etait sombre — sur le beige, le romantique tombe a
 * 2,2:1 et le boheme a 2,4:1, c'est-a-dire illisible.
 *
 * On ne les corrige PAS dans config.js : on y casserait les sprites, qui sont
 * justes. On les assombrit ICI, au moment de l'affichage, et seulement pour
 * ce qui est du TEXTE ou une BORDURE. Un aplat de jauge ou une pastille garde
 * la couleur vive : c'est un fond, il n'a pas a etre lisible, il a a etre vu.
 *
 * Pure et deterministe — aucun `alea()`, donc le rendu ne decale pas la
 * simulation (piege herite n°1).
 */
const _encreCache = {};
export function encre(hex){
  if(_encreCache[hex]) return _encreCache[hex];
  const n = parseInt(hex.slice(1), 16);
  const R = ((n >> 16) & 255) / 255, V = ((n >> 8) & 255) / 255, B = (n & 255) / 255;

  /* ⚠️ ON PASSE PAR HSL, et pas par une multiplication des canaux. Assombrir
     en multipliant rapproche les canaux de l'axe gris — les quatre styles
     sortaient en quatre bruns indistincts. Et SATURER en multipliant fait
     saturer les canaux hauts : l'or (216,169,74) voyait rouge ET vert taper
     255, donc il virait OLIVE. Un clamp qui touche deux canaux sur trois ne
     conserve plus la teinte du tout.
     En HSL, la teinte est un nombre qu'on ne touche pas : elle survit par
     construction. */
  const mx = Math.max(R, V, B), mn = Math.min(R, V, B), d = mx - mn;
  let h = 0;
  if(d){
    if(mx === R)      h = ((V - B) / d + (V < B ? 6 : 0)) / 6;
    else if(mx === V) h = ((B - R) / d + 2) / 6;
    else              h = ((R - V) / d + 4) / 6;
  }
  let l = (mx + mn) / 2;
  let sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  sat = Math.min(1, sat * 1.15);          // un peu plus franc, teinte intacte

  const versRgb = () => {
    const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = l - c / 2, i = Math.floor(h * 6) % 6;
    const t = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][i];
    return t.map(u => Math.round((u + m) * 255));
  };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const FOND = 0.2126 * lin(246) + 0.7152 * lin(234) + 0.0722 * lin(212);
  const contraste = () => {
    const [r, v, b] = versRgb();
    const L = 0.2126 * lin(r) + 0.7152 * lin(v) + 0.0722 * lin(b);
    return (FOND + 0.05) / (L + 0.05);
  };
  // On ne baisse que la CLARTE, par petits pas, jusqu'a 4,5:1 sur parchemin.
  for(let i = 0; i < 40 && l > 0.12 && contraste() < 4.5; i++) l -= 0.02;

  const out = "#" + versRgb().map(x => x.toString(16).padStart(2, "0")).join("");
  _encreCache[hex] = out;
  return out;
}

const jauge = (v, max, col) =>
  `<span class="jauge"><i style="width:${Math.max(0, Math.min(100, v/max*100))}%;background:${col}"></i></span>`;

function panneau(G){
  switch(vue.onglet){
    case "boutique":     return pBoutique(G);
    case "stock":        return pStock(G);
    case "clients":      return pClients(G);
    case "prestataires": return pPrestataires(G);
    case "equipe":       return pEquipe(G);
    case "codex":        return pCodex(G);
    case "salon":        return pSalon(G);
    default:             return pBilan(G);
  }
}

/* ------------------------------------------------------------- boutique */

function pBoutique(G){
  const j = G.derniereJournee;
  const cat = Boutique.catalogueMeubles(G.palier);
  const combos = Boutique.combosActifs(G.boutique);
  return `<div class="panneau">
    <span class="etiq">LA JOURNÉE</span>
    ${j ? `<div class="ligne"><span>Visiteurs</span><b>${j.visiteurs}</b>
        <span class="faible">servis ${j.servis}</span>
        ${j.refoules ? `<span class="prune">refoulés ${j.refoules}</span>` : ""}</div>
      <div class="ligne"><span>Vendu</span>
        <b class="${j.vendus && j.vendus.length ? "or" : "faible"}">${j.vendus ? j.vendus.length : 0} pièce(s)</b>
        <span class="faible">le stock part au détail — garde ce qu'il te faut</span></div>
      <div class="ligne"><span>Recette</span><b class="or">${fmt(j.recette)} €</b>
        <span class="faible">charges ${fmt(j.charges)} €</span>
        <b class="${j.net >= 0 ? "vert" : "prune"}">${j.net >= 0 ? "+" : ""}${fmt(j.net)} €</b></div>
      <div class="ligne faible">${ech(Boutique.diagnostic(G.boutique, j))}</div>`
      : `<div class="ligne faible">La boutique n'a pas encore ouvert.</div>`}

    ${combos.length ? `<span class="etiq">COMBOS ACTIFS</span>
      ${combos.map(c => `<div class="ligne vert">+${Math.round(c.bonus*100)} % · ${ech(c.txt)}</div>`).join("")}`
      : `<div class="ligne faible">Aucun combo : rapproche un meuble de vente
         d'un meuble de confort ou de service.</div>`}

    <span class="etiq">MEUBLES</span>
    <div class="grille-cat">
      ${cat.map(m => `<button class="carte" data-act="prendre" data-cle="${m.cle}"
        ${vue.meubleEnMain === m.cle ? "data-on" : ""}
        ${G.argent < m.prix ? "disabled" : ""}>
        <b>${ech(m.txt)}</b>
        <span class="or">${fmt(m.prix)} €</span>
        <span class="faible">gain ${m.gain} · ${m.places} place${m.places > 1 ? "s" : ""} · attrait ${m.attrait}</span>
      </button>`).join("")}
    </div>
    ${vue.meubleEnMain
      ? `<div class="ligne poudre">Clique dans la boutique pour poser
         « ${ech(MEUBLES[vue.meubleEnMain].txt)} ».
         <button data-act="lacher">annuler</button></div>`
      : `<div class="ligne faible">Choisis un meuble, puis clique une case.
         Les combos se gagnent par contact.</div>`}
  </div>`;
}

/* ---------------------------------------------------------------- stock */

function carteArticle(a, G, extra = ""){
  const f = Stock.ficheArticle(a);
  return `<div class="carte-art">
    <i class="vign" style="${R.styleSprite(R.vignetteArticle(a), 34)}"></i>
    <div class="corps">
      <b>${ech(f.nom)}</b>
      <span class="pill" style="border-color:${encre(STYLE[a.style].couleur)};color:${encre(STYLE[a.style].couleur)}">${ech(f.styleTxt)}</span>
      <span class="pill" style="border-color:${encre(f.couleur)};color:${encre(f.couleur)}">T${f.tier} ${ech(f.rareteTxt)}</span>
      ${f.affixes.map(x => `<span class="pill faible">${ech(x)}</span>`).join("")}
      ${f.usages ? `<span class="faible">porté ${f.usages}×</span>` : ""}
    </div>
    ${extra}
  </div>`;
}

function pStock(G){
  const parSlot = {};
  for(const a of G.stock) (parSlot[a.slot] ||= []).push(a);
  return `<div class="deux">
    <div class="panneau">
      <span class="etiq">CATALOGUE · renouvelé chaque saison</span>
      <div class="ligne faible">La meilleure robe n'existe pas : une pièce vaut
        ce qu'elle vaut <b>pour un couple donné</b>. Achète de la variété.</div>
      ${G.catalogue.map(a => carteArticle(a, G,
        `<button data-act="acheter" data-id="${a.id}" ${G.argent < a.prix ? "disabled" : ""}>
           ${fmt(a.prix)} €</button>`)).join("")
        || `<div class="ligne faible">Catalogue épuisé jusqu'à la saison prochaine.</div>`}
    </div>
    <div class="panneau">
      <span class="etiq">TON STOCK · ${G.stock.length} pièces</span>
      ${Object.keys(parSlot).length ? Object.entries(parSlot).map(([slot, l]) => `
        <div class="sous-titre">${ech(SLOT[slot].txt)} · ${l.length}</div>
        ${l.slice(0, 12).map(a => carteArticle(a, G,
          `<button data-act="revendre" data-id="${a.id}">↩ ${fmt(Stock.prixRevente(a))} €</button>`)).join("")}
        ${l.length > 12 ? `<div class="ligne faible">…et ${l.length - 12} autres</div>` : ""}
      `).join("") : `<div class="ligne faible">Stock vide.</div>`}
    </div>
  </div>`;
}

/* -------------------------------------------------------------- clients */

/**
 * Les gouts d'un couple, du plus fort au plus faible.
 *
 * ⚠️ L'ordre COMPTE. Range dans l'ordre fixe de la table, le joueur devait
 * comparer quatre barres pour trouver laquelle domine — et la question qu'il
 * se pose, la seule, c'est « qu'est-ce qu'ils aiment ? ». Trier par valeur
 * repond a la question au lieu de la poser.
 */
function gouts(couple){
  return [...STYLES]
    .sort((a, b) => couple.gouts[b] - couple.gouts[a])
    .map((s, i) => `<div class="ligne mince">
      <span style="min-width:96px;${i === 0 ? "font-weight:700" : ""}">${ech(STYLE[s].txt)}</span>
      ${jauge(couple.gouts[s], 100, STYLE[s].couleur)}
      <b style="min-width:30px;text-align:right">${couple.gouts[s]}</b></div>`).join("");
}

/**
 * Ce que le couple demande, en toutes lettres.
 *
 * ⚠️ CE PANNEAU N'A PAS LE DROIT DE DONNER LA REPONSE (decision de design n°9).
 * Il explique la LECTURE — ce qu'est un gout dominant, ce que vaut un
 * emplacement vide, comment se lit un budget — jamais quel style va avec quel
 * autre. La table d'affinites reste le secret du jeu ; sans elle a deviner, il
 * ne reste qu'a cliquer.
 */
function ceQuIlsVeulent(p, G){
  const tries = [...STYLES].sort((a, b) => p.gouts[b] - p.gouts[a]);
  const dom = tries[0], second = tries[1];
  const ecart = p.gouts[dom] - p.gouts[second];
  const f = Imprevus.fourchetteExigence(p, EXIGENCE_FLOU);
  const parTete = Math.round(p.budget / Math.max(1, p.invites));
  const reste = p.expireLe - G.jour;

  const humeur = ecart >= 35
    ? `<b>${ech(STYLE[dom].txt)}</b> domine largement : tout ce qui s'en éloigne
       se verra.`
    : ecart >= 15
      ? `<b>${ech(STYLE[dom].txt)}</b> domine, mais <b>${ech(STYLE[second].txt)}</b>
         compte encore.`
      : `<b>${ech(STYLE[dom].txt)}</b> et <b>${ech(STYLE[second].txt)}</b> se
         disputent leur cœur : un dossier trop tranché en décevra la moitié.`;

  return `<div class="detail">
    <div class="sous-titre">CE QU'ILS AIMENT</div>
    <p class="prose">${humeur}</p>

    <div class="sous-titre">CE QU'ILS ATTENDENT</div>
    <div class="ligne mince"><span class="faible">Note visée le jour J</span>
      <span style="flex:1"></span><b>entre ${f.min} et ${f.max}</b></div>
    <p class="prose">Ils n'annoncent qu'une fourchette — le vrai chiffre, tu ne
      le connaîtras qu'au résultat.</p>
    <p class="prose">Six emplacements à remplir : lieu, robe, costume,
      décoration, traiteur, musique. <b>Un emplacement vide coûte plus cher
      qu'un choix moyen.</b></p>

    <div class="sous-titre">LEUR BUDGET</div>
    <div class="ligne mince"><span class="faible">${p.invites} invités</span>
      <span style="flex:1"></span><b>${fmt(p.budget)} €</b>
      <span class="faible">soit ${fmt(parTete)} € par tête</span></div>
    <p class="prose">Tu n'engages que les prestataires — le stock, tu l'as déjà
      payé. <b>Dépenser trop peu compte autant que dépenser trop</b> : un couple
      qui a mis la somme sur la table veut la voir.</p>

    <div class="sous-titre">LE CALENDRIER</div>
    <div class="ligne mince"><span class="faible">Jour J</span>
      <span style="flex:1"></span><b>dans ${p.jourJPrevu - G.jour} jours</b></div>
    <div class="ligne mince"><span class="faible">Patience</span>
      <span style="flex:1"></span>
      <b class="${reste <= 2 ? "prune" : ""}">${reste} jour(s)</b></div>
    <p class="prose">Passé ce délai ils vont voir un concurrent, et la place
      qu'ils tenaient dans ton carnet se libère.</p>
  </div>`;
}

function pClients(G){
  const cap = Clients.capacite(G.palier);
  const carnet = cap + 3;
  return `<div class="deux">
    <div class="panneau">
      <span class="etiq">CARNET · ${G.prospects.length}/${carnet}</span>
      <div class="ligne faible">Refuser coûte de la notoriété, mais rend la
        place tout de suite. Ne pas répondre la bloque six jours.</div>
      ${G.prospects.map(p => ficheProspect(p, G, cap)).join("")
        || `<div class="ligne faible">Personne n'a poussé la porte.</div>`}
    </div>
    <div class="panneau">
      <span class="etiq">DOSSIERS EN COURS · ${G.contrats.length}/${cap}</span>
      ${G.contrats.map(c => ficheDossier(c, G)).join("")
        || `<div class="ligne faible">Aucun mariage en préparation.</div>`}
    </div>
  </div>`;
}

function ficheProspect(p, G, cap){
  const plein = G.contrats.length >= cap;
  const ouvert = vue.prospectOuvert === p.id;
  return `<div class="bloc">
    <div class="ligne">
      <i class="vign" style="${R.styleSprite(R.vignetteMariee(p, null), 30)}"></i>
      <i class="vign" style="${R.styleSprite(R.vignetteMarie(p, null), 30)}"></i>
      <div style="flex:1">
        <b>${ech(Clients.nomCouple(p))}</b><br>
        <span class="faible">${p.invites} invités · ${fmt(p.budget)} € ·
          ${ech(p.lieuTxt)} · dans ${p.jourJPrevu - G.jour} jours</span>
      </div>
      <span class="pill" style="border-color:${encre(STYLE[Clients.styleDominant(p)].couleur)};color:${encre(STYLE[Clients.styleDominant(p)].couleur)}">
        ${ech(STYLE[Clients.styleDominant(p)].txt)}</span>
    </div>
    ${gouts(p)}
    ${ouvert ? ceQuIlsVeulent(p, G) : ""}
    <div class="ligne">
      <span class="faible">Ils attendront ${p.expireLe - G.jour} jour(s).
        ${(() => { const f = Imprevus.fourchetteExigence(p, EXIGENCE_FLOU);
          return `Ils disent en attendre « entre ${f.min} et ${f.max} ».`; })()}</span>
      <span style="flex:1"></span>
      <button data-act="prospect" data-id="${p.id}">
        ${ouvert ? "replier" : "ce qu'ils veulent"}</button>
      <button data-act="refuser" data-id="${p.id}" class="danger">refuser</button>
      <button data-act="signer" data-id="${p.id}" class="or" ${plein ? "disabled" : ""}>
        ${plein ? "complet" : "signer"}</button>
    </div>
  </div>`;
}

function ficheDossier(c, G){
  const reste = c.jourJ - G.jour;
  const ouvert = vue.dossierOuvert === c.id;
  const prep = Math.round(Clients.preparation(c) * 100);
  return `<div class="bloc ${reste <= 3 ? "chaud" : ""}">
    <div class="ligne">
      <div style="flex:1"><b>${ech(Clients.nomCouple(c.couple))}</b><br>
        <span class="faible">jour J dans ${reste} j · ${c.couple.invites} invités</span></div>
      <button data-act="ouvrir" data-id="${c.id}">${ouvert ? "replier" : "ouvrir"}</button>
    </div>
    <div class="ligne mince"><span style="min-width:88px">Budget</span>
      ${jauge(c.depense, c.couple.budget, c.depense > c.couple.budget ? "#8c4f6b" : "#d8a94a")}
      <b class="${c.depense > c.couple.budget ? "prune" : "or"}">${fmt(c.depense)} / ${fmt(c.couple.budget)}</b></div>
    <div class="ligne mince"><span style="min-width:88px">Préparation</span>
      ${jauge(prep, 100, "#7fa87a")}<b>${prep} %</b></div>
    ${ouvert ? dossierDetail(c, G) : ""}
  </div>`;
}

function dossierDetail(c, G){
  const im = Imprevus.listeImprevus(c);
  return `<div class="detail">
    ${gouts(c.couple)}
    ${im.length ? `<span class="etiq">CE QUI A CHANGÉ DEPUIS LA SIGNATURE</span>
      ${im.map(e => `<div class="ligne prune">
        <b style="min-width:44px">J${e.jour}</b>
        <b style="min-width:160px">${ech(e.txt)}</b>
        <span class="faible">${ech(e.detail)}</span>
        ${e.effet ? `<b class="prune">${ech(e.effet)}</b>` : ""}</div>`).join("")}` : ""}
    <span class="etiq">CE QUE TU LEUR PROPOSES</span>
    <div class="slots">
      ${SLOTS.map(s => slotCase(c, s, G)).join("")}
    </div>
    ${vue.slotOuvert && vue.dossierOuvert === c.id ? choixPourSlot(c, vue.slotOuvert, G) : ""}
    <div class="ligne">
      <span class="faible">Il reste ${fmt(Clients.budgetRestant(c))} € et ${c.jourJ - G.jour} jours.</span>
      <span style="flex:1"></span>
      <button data-act="annuler" data-id="${c.id}" class="danger">annuler le contrat</button>
    </div>
  </div>`;
}

/**
 * ⚠️ UN EMPLACEMENT NE DONNE PAS LA NOTE DE LA PIECE.
 *
 * La version precedente affichait « 26/100 pour eux » sur chaque choix : le
 * joueur n'avait plus qu'a lire le plus grand nombre. C'etait donner la
 * reponse — et le coeur du jeu est justement de deviner POUR QUI une piece est
 * faite (decision de design n°4). On montre donc ce qu'on a mis, son style, et
 * rien de plus. Les gouts du couple sont affiches juste au-dessus : c'est
 * l'indice, pas la solution.
 */
function slotCase(c, slot, G){
  const v = c.choix[slot];
  const on = vue.slotOuvert === slot && vue.dossierOuvert === c.id;
  if(v == null)
    return `<button class="slot" data-vide data-act="slot" data-id="${c.id}" data-slot="${slot}" ${on ? "data-on" : ""}>
      <u>${ech(SLOT[slot].txt)}</u><b>— à choisir —</b></button>`;
  let nom, style;
  if(SLOT[slot].source === "stock"){
    const a = G.stock.find(x => x.id === v);
    nom = a ? Stock.nomArticle(a) : "?";
    style = a ? a.style : null;
  }else{
    nom = PRESTATAIRES[v].txt;
    style = PRESTATAIRES[v].style;
  }
  return `<button class="slot" data-act="slot" data-id="${c.id}" data-slot="${slot}" ${on ? "data-on" : ""}>
    <u>${ech(SLOT[slot].txt)}</u><b>${ech(nom)}</b>
    ${style ? `<span class="pill" style="border-color:${encre(STYLE[style].couleur)};color:${encre(STYLE[style].couleur)}">${ech(STYLE[style].txt)}</span>` : ""}</button>`;
}

/**
 * ⚠️ La liste des choix n'est ni notee, ni triee par pertinence.
 *
 * Trier par « note pour ce couple » reviendrait a mettre la bonne reponse en
 * premier : le joueur cliquerait la ligne du haut sans jamais regarder les
 * gouts. On trie donc par STYLE, ce qui est une information neutre, et on
 * laisse le joueur faire le rapprochement lui-meme.
 *
 * Ce qu'on affiche reste honnete et complet — style, tier, rarete, affixes,
 * prix, disponibilite. Rien n'est cache : c'est la CONCLUSION qu'on ne tire
 * pas a sa place.
 */
function choixPourSlot(c, slot, G){
  if(SLOT[slot].source === "stock"){
    const libres = G.stock.filter(a => a.slot === slot &&
      !G.contrats.some(x => x.id !== c.id && x.choix[slot] === a.id));
    const tries = [...libres].sort((a, b) =>
      STYLES.indexOf(a.style) - STYLES.indexOf(b.style) || b.tier - a.tier);
    return `<div class="choix"><span class="etiq">${ech(SLOT[slot].txt)} — ton stock</span>
      ${tries.map(a => carteArticle(a, G,
        `<button data-act="choisir" data-id="${c.id}" data-slot="${slot}" data-v="${a.id}">choisir</button>`)).join("")
        || `<div class="ligne faible">Aucune pièce libre pour cet emplacement.</div>`}
      ${c.choix[slot] != null ? `<button data-act="choisir" data-id="${c.id}" data-slot="${slot}" data-v="">retirer</button>` : ""}
    </div>`;
  }
  const cands = Presta.disponiblesAuPalier(slot, G.palier)
    .map(k => Presta.fichePresta(G.prestas, k, c.jourJ, c.couple.invites, null))
    .sort((a, b) => STYLES.indexOf(a.style) - STYLES.indexOf(b.style));
  return `<div class="choix"><span class="etiq">${ech(SLOT[slot].txt)} — le ${c.jourJ}</span>
    ${cands.map(p => `<div class="carte-art">
      <i class="vign" style="${R.styleSprite(R.vignettePresta(p.cle), 30)}"></i>
      <div class="corps"><b>${ech(p.txt)}</b>
        <span class="pill" style="border-color:${encre(p.couleur)};color:${encre(p.couleur)}">${ech(p.styleTxt)}</span>
        <span class="faible">qualité ${p.qualite} · ${fmt(p.prix)} €</span>
        ${p.fidelite ? `<span class="pill vert">fidélité ${p.fidelite}</span>` : ""}
        ${p.libre ? "" : `<span class="pill prune">pris par ${p.occupePar === "joueur" ? "toi" : ech(p.occupePar)}</span>`}
      </div>
      <button data-act="choisir" data-id="${c.id}" data-slot="${slot}" data-v="${p.cle}"
        ${p.libre || p.fidelite ? "" : "disabled"}>réserver</button>
    </div>`).join("")}
    ${c.choix[slot] != null ? `<button data-act="choisir" data-id="${c.id}" data-slot="${slot}" data-v="">retirer</button>` : ""}
  </div>`;
}

/* --------------------------------------------------------- prestataires */

function pPrestataires(G){
  const proche = S.dossierUrgent(G);
  const jourJ = proche ? proche.jourJ : G.jour + 21;
  return `<div class="panneau">
    <span class="etiq">AGENDA AU JOUR ${jourJ}${proche ? ` · ${ech(Clients.nomCouple(proche.couple))}` : ""}</span>
    <div class="ligne faible">Un prestataire pris est pris. La fidélité, elle,
      s'achète en travaillant deux fois avec les mêmes gens.</div>
    ${["lieu","traiteur","musique"].map(t => `
      <div class="sous-titre">${ech(SLOT[t].txt)}</div>
      ${Presta.disponiblesAuPalier(t, G.palier).map(k => {
        // ⚠️ Pas de `couple` : on ne calcule aucun score « pour eux ». La
        // qualite et le style sont des faits ; l'accord, c'est au joueur.
        const p = Presta.fichePresta(G.prestas, k, jourJ,
                                     proche ? proche.couple.invites : 80, null);
        return `<div class="ligne">
          <i class="vign" style="${R.styleSprite(R.vignettePresta(k), 26)}"></i>
          <b style="min-width:150px">${ech(p.txt)}</b>
          <span class="pill" style="border-color:${encre(p.couleur)};color:${encre(p.couleur)}">${ech(p.styleTxt)}</span>
          ${jauge(p.qualite, 100, "#7fa87a")}
          <span class="or" style="min-width:70px;text-align:right">${fmt(p.prix)} €</span>
          <span class="${p.libre ? "vert" : "prune"}" style="min-width:110px;text-align:right">
            ${p.libre ? "libre" : (p.occupePar === "joueur" ? "réservé par toi" : "pris")}</span>
        </div>`;
      }).join("")}`).join("")}
  </div>`;
}


/* --------------------------------------------------------------- equipe */

function pEquipe(G){
  const places = Equipe.placesEquipe(G.palier);
  const masse = Equipe.masseSalariale(G.equipe);
  const cout = Equipe.coutRecrue(G.equipe.length);
  const hiver = S.saisonCourante(G) === "hiver";
  return `<div class="deux">
    <div class="panneau">
      <span class="etiq">TON ÉQUIPE · ${G.equipe.length}/${places}</span>
      <div class="ligne"><span>Masse salariale</span>
        <b class="${masse ? "prune" : "faible"}">${fmt(masse)} € / jour</b>
        <span class="faible">elle tombe même en basse saison</span></div>
      ${G.equipe.map(m => ficheEquipier(m, G)).join("")
        || `<div class="ligne faible">Tu travailles seul.</div>`}
      <span class="etiq" style="margin-top:12px">EMBAUCHER · ${fmt(cout)} €</span>
      ${G.equipe.length >= places
        ? `<div class="ligne faible">Plus de place : il faut monter d'un palier.</div>`
        : `<div class="grille-cat">
            ${Object.entries(ROLES).map(([k, r]) => `<button class="carte"
              data-act="recruter" data-role="${k}" ${G.argent < cout ? "disabled" : ""}>
              <b style="color:${encre(r.couleur)}">${ech(r.txt)}</b>
              <span class="faible">${ech(r.resume)}</span></button>`).join("")}
          </div>`}
    </div>
    <div class="panneau">
      <span class="etiq">LA FORMATION</span>
      <div class="ligne ${hiver ? "vert" : "faible"}">
        ${hiver ? "C'est l'hiver : personne ne se marie, c'est le moment."
                : "Former maintenant, c'est se priver d'un bras en pleine saison."}
      </div>
      <div class="ligne faible">Un membre en formation ne produit rien tant
        qu'elle dure. C'est tout l'arbitrage.</div>
      <span class="etiq" style="margin-top:10px">CE QUE CHACUN APPORTE</span>
      ${Object.entries(ROLES).map(([k, r]) => {
        const n = Equipe.apport(G.equipe, k, G.jour);
        return `<div class="ligne mince">
          <b style="min-width:120px;color:${encre(r.couleur)}">${ech(r.txt)}</b>
          ${jauge(n, EQUIPE.NIVEAU_MAX * 2, r.couleur)}
          <b style="min-width:26px;text-align:right">${n}</b></div>`;
      }).join("")}
    </div>
  </div>`;
}

function ficheEquipier(m, G){
  const f = Equipe.ficheMembre(m, G.jour);
  return `<div class="bloc">
    <div class="ligne">
      <b style="color:${encre(f.couleur)};min-width:110px">${ech(f.nom)}</b>
      <span class="pill" style="border-color:${encre(f.couleur)};color:${encre(f.couleur)}">${ech(f.roleTxt)}</span>
      <span class="faible">niveau ${f.niveau}/${f.niveauMax} · ${f.salaire} €/j</span>
      <span style="flex:1"></span>
      ${f.enFormation
        ? `<span class="poudre">en formation · ${f.joursRestants} j</span>`
        : f.peutMonter
          ? `<button data-act="former" data-id="${f.id}" ${G.argent < f.coutFormation ? "disabled" : ""}>
               former · ${fmt(f.coutFormation)} € · ${f.joursFormation} j</button>`
          : `<span class="or">au sommet</span>`}
      <button data-act="renvoyer" data-id="${f.id}" class="danger mini"
              title="Remercier ${ech(f.nom)}">✕</button>
    </div>
    <div class="ligne mince faible">${ech(f.resume)}</div>
  </div>`;
}

/* ---------------------------------------------------------------- codex
   ⚠️ N'affiche QUE ce qui a marche. Jamais ce qui rate, jamais un
   avertissement. Le jeu connait les mauvais accords et doit se taire dessus :
   les lister reviendrait a donner la table d'affinites, et deviner pour qui
   une piece est faite est l'essentiel de ce qu'on demande au joueur. */

function pCodex(G){
  const acc = Codex.accordsConnus(G.codex);
  const pre = Codex.prestasConnus(G.codex);
  const fam = Codex.famillesConnues(G.codex);
  const com = Codex.combosConnus(G.codex);
  const av = Codex.avancement(G.codex);
  const bloc = (titre, lignes, vide) => `<span class="etiq">${titre}</span>
    ${lignes.length ? lignes : `<div class="ligne faible">${vide}</div>`}`;

  return `<div class="deux">
    <div class="panneau">
      <span class="etiq">CE QUE L'ATELIER A APPRIS · ${av.trouves} entrées</span>
      <div class="ligne faible">On ne note ici que ce qui a <b>marché</b>. Ce
        qui ne marche pas, il faudra le découvrir en le ratant.</div>
      ${bloc("ACCORDS DE STYLES ÉPROUVÉS",
        acc.map(a => `<div class="ligne">
          <span class="pastille" style="background:${a.couleurA}"></span>
          <span class="pastille" style="background:${a.couleurB}"></span>
          <b style="flex:1">${ech(a.txt)}</b>
          <span class="faible">${a.n}×</span></div>`).join(""),
        "Aucun accord retenu. Marie deux styles et regarde la cohérence.")}
      ${bloc("COMBOS DE BOUTIQUE",
        com.map(c => `<div class="ligne vert">${ech(c.txt)}</div>`).join(""),
        "Aucun combo repéré. Rapproche des meubles de familles différentes.")}
    </div>
    <div class="panneau">
      ${bloc("PRESTATAIRES QUI ONT PORTÉ UN MARIAGE",
        pre.map(x => `<div class="ligne">
          <b style="min-width:150px">${ech(x.txt)}</b>
          <span class="pill" style="border-color:${encre(x.couleur)};color:${encre(x.couleur)}">
            couple ${ech(x.goutTxt.toLowerCase())}</span>
          <span class="faible">${x.n}×</span></div>`).join(""),
        "Rien encore. Un prestataire s'inscrit ici quand l'émotion est forte.")}
      ${bloc("PIÈCES QUI ONT FAIT MOUCHE",
        fam.map(x => `<div class="ligne">
          <span class="faible" style="min-width:74px">${ech(x.slotTxt)}</span>
          <b style="min-width:120px">${ech(x.txt)}</b>
          <span class="pill" style="border-color:${encre(x.couleur)};color:${encre(x.couleur)}">
            couple ${ech(x.goutTxt.toLowerCase())}</span>
          <span class="faible">${x.n}×</span></div>`).join(""),
        "Rien encore. Une pièce s'inscrit ici quand l'élégance est forte.")}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- salon */

function pSalon(G){
  const versSalon = (CFG.SALON_JOUR_DANS_ANNEE - S.jourDansAnnee(G.jour) + CFG.SALON_TOUS_LES_JOURS)
                    % CFG.SALON_TOUS_LES_JOURS;
  return `<div class="panneau">
    <span class="etiq">PROCHAIN SALON</span>
    <div class="ligne">Dans <b>${versSalon} jours</b>. Stand : <b class="or">${fmt(SALON.COUT_STAND)} €</b>.
      Ne pas s'y présenter coûte ${SALON.MALUS_ABSENCE} de notoriété.</div>
    <div class="ligne faible">Le thème est tiré le jour même et pèse
      ${Math.round(SALON.POIDS_THEME*100)} % de la note. C'est ce qui récompense
      un stock varié plutôt qu'un stock optimal.</div>
    <span class="etiq">CE QUE TON STAND VAUDRAIT, PAR THÈME</span>
    ${STYLES.map(t => {
      const st = Salon.meilleurStand(G.stock, t);
      return `<div class="ligne mince"><span style="min-width:96px">${ech(STYLE[t].txt)}</span>
        ${jauge(Salon.scoreStand(st, t), 600, STYLE[t].couleur)}
        <b style="min-width:44px;text-align:right">${Salon.scoreStand(st, t)}</b></div>`;
    }).join("")}
    <span class="etiq">LA COURSE À LA NOTORIÉTÉ</span>
    ${classementLignes(G).map(r => `<div class="ligne">
      <b style="min-width:18px;color:${encre(r.couleur)}">${r.rang}</b>
      <b style="min-width:170px;color:${encre(r.couleur)}">${ech(r.txt)}${r.joueur ? " (toi)" : ""}</b>
      ${jauge(r.notoriete, Math.max(...classementLignes(G).map(x => x.notoriete), 1), r.couleur)}
      <b style="min-width:52px;text-align:right">${fmt(r.notoriete)}</b></div>`).join("")}
    <span class="etiq">PALMARÈS</span>
    ${G.salons.length ? G.salons.map(s => `<div class="ligne">
      <b style="min-width:60px">An ${s.annee}</b>
      <span class="pill" style="border-color:${encre(STYLE[s.theme].couleur)};color:${encre(STYLE[s.theme].couleur)}">${ech(s.themeTxt)}</span>
      <b class="${s.rang === 1 ? "or" : ""}">${s.participe ? `${s.rang}ᵉ · ${s.points} pts` : "absent"}</b>
      <span class="faible">${ech(s.resume)}</span></div>`).join("")
      : `<div class="ligne faible">Aucun salon encore couru.</div>`}
  </div>`;
}

/* ---------------------------------------------------------- concurrents */

function pConcurrents(G){
  const rangs = classementLignes(G);
  const max = Math.max(...rangs.map(r => r.notoriete), 1);
  return `<div class="panneau">
    <span class="etiq">LA COURSE À LA NOTORIÉTÉ</span>
    ${rangs.map(r => `<div class="ligne">
      <b style="min-width:18px;color:${encre(r.couleur)}">${r.rang}</b>
      <b style="min-width:170px;color:${encre(r.couleur)}">${ech(r.txt)}${r.joueur ? " (toi)" : ""}</b>
      ${jauge(r.notoriete, max, r.couleur)}
      <b style="min-width:52px;text-align:right">${fmt(r.notoriete)}</b></div>`).join("")}
    <span class="etiq">CE QU'ILS T'ONT PRIS</span>
    ${G.concurrents.map(c => `<div class="ligne faible">
      <b style="color:${encre(c.couleur)};min-width:170px">${ech(c.txt)}</b>
      ${c.reprises} couple${c.reprises > 1 ? "s" : ""} récupéré${c.reprises > 1 ? "s" : ""}
      · style ${ech(STYLE[c.style].txt.toLowerCase())}</div>`).join("")}
  </div>`;
}

function classementLignes(G){
  const tout = [
    ...G.concurrents.map(c => ({ txt:c.txt, notoriete:Math.round(c.notoriete),
                                 couleur:c.couleur, joueur:false })),
    { txt:G.nomAtelier, notoriete:Math.round(G.notoriete), couleur:"#e69aa6", joueur:true },
  ];
  tout.sort((a, b) => b.notoriete - a.notoriete);
  return tout.map((x, i) => ({ ...x, rang:i + 1 }));
}

/* ---------------------------------------------------------------- bilan */

function pBilan(G){
  const st = S.resumeStats(G);
  const p = S.palierCourant(G);
  const suiv = PALIERS[G.palier] || null;
  return `<div class="deux">
    <div class="panneau">
      <span class="etiq">LA PARTIE</span>
      <div class="ligne"><span>Palier</span><b>${ech(p.txt)}</b>
        <span class="faible">${ech(p.txtDeblocage)}</span></div>
      ${suiv ? `<div class="ligne mince"><span style="min-width:96px">Vers ${ech(suiv.txt)}</span>
        ${jauge(G.notoriete - p.seuil, suiv.seuil - p.seuil, "#e69aa6")}
        <b>${fmt(G.notoriete)} / ${fmt(suiv.seuil)}</b></div>`
        : `<div class="ligne or">Palier royal atteint.</div>`}
      <div class="ligne"><span>Mariages</span><b>${st.reussis} réussis</b>
        <b class="prune">${st.rates} ratés</b>
        <span class="faible">note moyenne ${st.noteMoyenne}</span></div>
      <div class="ligne"><span>Contrats</span><b>${st.contrats} signés</b>
        <span class="faible">${st.refuses} refusés</span></div>
      <div class="ligne"><span>Boutique</span><b class="or">${fmt(st.recetteBoutique)} €</b>
        <span class="faible">${fmt(st.ventes)} pièces vendues</span></div>
      <div class="ligne"><span>Prestations</span><b class="or">${fmt(st.honoraires)} €</b>
        <span class="faible">dont ${fmt(st.commissions)} € de commissions</span></div>
      <div class="ligne"><span>Salaires versés</span><b class="prune">${fmt(st.salaires)} €</b>
        <span class="faible">${st.equipe} personne(s)</span></div>
      <div class="ligne"><span>Imprévus subis</span><b>${st.imprevus}</b></div>
      <div class="ligne"><span>Horloge</span><b>${st.heures} h</b>
        <span class="faible">à vitesse 1×</span></div>
    </div>
    <div class="panneau">
      <span class="etiq">JOURNAL</span>
      ${G.journal.length ? G.journal.slice(0, 8).map(j => `<div class="ligne">
        <b style="min-width:44px" class="faible">J${j.jour}</b>
        <b style="min-width:130px">${ech(j.couple)}</b>
        <b class="${j.reussi ? "vert" : "prune"}" style="min-width:40px">${j.note}</b>
        <span class="faible">${ech(j.resume)}</span></div>`).join("")
        : `<div class="ligne faible">Aucun mariage célébré.</div>`}
      <span class="etiq">SAUVEGARDE</span>
      <div class="ligne">
        <span class="${Sv.etatStockage.ok === false ? "prune" : "vert"}">
          ${Sv.etatStockage.ok === false ? ech(Sv.etatStockage.raison) : "Le navigateur enregistre la partie."}</span>
      </div>
      <div class="ligne">
        <button data-act="code">copier le code de partie</button>
        <button data-act="sauver">sauver maintenant</button>
        <button data-act="nouvelle" class="danger">nouvelle partie</button>
      </div>
      <div class="ligne faible">Le code de partie ne dépend d'aucun stockage :
        c'est la porte de sortie si le navigateur refuse d'écrire.</div>
    </div>
  </div>`;
}

/* ================================================================= modal
   ⚠️ Le SEUL ecran modal du jeu. S'il s'en ajoute un deuxieme, c'est que la
   decision de design n°2 est en train de se perdre. */

export function modalSalon(G, res, surChoix){
  const el = $racine.querySelector("#modal");
  el.hidden = false;
  if(!res){
    const theme = G.themeSalon;
    const stand = Salon.meilleurStand(G.stock, theme);
    el.innerHTML = `<div class="boite">
      <div class="bandeau">SALON DU MARIAGE · AN ${S.anneeDe(G.jour)} — THÈME TIRÉ :
        <span class="or">${ech(STYLE[theme].txt.toUpperCase())}</span></div>
      <div class="panneau">
        <div class="ligne faible">Ton stand présentera automatiquement tes
          ${SALON.PIECES_STAND} meilleures pièces <b>pour ce thème</b>.</div>
        ${stand.map(a => carteArticle(a, G,
          `<b class="or">${Math.round(Salon.notePiece(a, theme))}</b>`)).join("")
          || `<div class="ligne prune">Tu n'as rien à montrer.</div>`}
        <div class="ligne"><b>Total</b><b class="or">${Salon.scoreStand(stand, theme)} points</b></div>
        <div class="ligne">
          <span class="faible">Le stand coûte ${fmt(SALON.COUT_STAND)} €.
            S'abstenir coûte ${SALON.MALUS_ABSENCE} de notoriété.</span>
          <span style="flex:1"></span>
          <button data-act="salon-passer" class="danger">passer son tour</button>
          <button data-act="salon-jouer" class="or"
            ${G.argent < SALON.COUT_STAND ? "disabled" : ""}>monter le stand</button>
        </div>
      </div></div>`;
    return;
  }
  const max = Math.max(...res.lignes.map(l => l.points), 1);
  el.innerHTML = `<div class="boite">
    <div class="bandeau">SALON · THÈME ${ech(res.themeTxt.toUpperCase())}</div>
    <canvas id="scene-salon" class="scene" width="480" height="232"></canvas>
    <div class="panneau">
      <span class="etiq">CLASSEMENT</span>
      ${res.lignes.map(l => `<div class="ligne">
        <b style="min-width:18px;color:${encre(l.couleur)}">${l.rang}</b>
        <b style="min-width:150px;color:${encre(l.couleur)}">${ech(l.txt)}</b>
        ${jauge(l.points, max, l.couleur)}
        <b style="min-width:44px;text-align:right">${l.points}</b></div>`).join("")}
      <div class="ligne"><b>${ech(res.resume)}</b></div>
      <div class="ligne">
        ${res.gainArgent ? `<b class="or">+${fmt(res.gainArgent)} €</b>` : ""}
        <b class="${res.gainNotoriete >= 0 ? "vert" : "prune"}">
          ${res.gainNotoriete >= 0 ? "+" : ""}${res.gainNotoriete} notoriété</b>
        <span style="flex:1"></span>
        <button data-act="salon-fermer" class="or">reprendre la saison</button>
      </div>
    </div></div>`;
  const cv = el.querySelector("#scene-salon");
  if(cv) R.dessinerSalon(cv.getContext("2d"), G, res);
}

export function fermerModal(){
  const el = $racine.querySelector("#modal");
  el.hidden = true; el.innerHTML = "";
}

/* ============================================================== resultat
   Le jour J s'annonce et se REJOUE ; il ne coupe pas la partie. */

export function panneauResultat(res){
  return `<div class="panneau resultat">
    <div class="ligne">
      <div><span class="etiq">NOTE DU JOUR J</span>
        <span class="score ${res.reussi ? "" : "prune"}">${res.note}</span>
        <span class="faible"> / 100 · ils attendaient ${res.exigence}</span></div>
      <div style="flex:1;min-width:220px">
        ${axesAffiches(res).map(([n, v, c]) => `<div class="ligne mince">
          <span style="min-width:92px">${ech(n)}</span>${jauge(v, 100, c)}
          <b style="min-width:30px;text-align:right">${v}</b></div>`).join("")}
      </div>
      <div style="min-width:190px" class="faible">
        <b class="${res.reussi ? "vert" : "prune"}">${ech(res.couple)}</b><br>
        ${ech(res.resume)}<br>
        <b class="or">+${fmt(res.honoraires)} €</b> ·
        <b class="${res.notoriete >= 0 ? "vert" : "prune"}">
          ${res.notoriete >= 0 ? "+" : ""}${res.notoriete} notoriété</b>
      </div>
    </div>
    <div class="ligne"><span style="flex:1"></span>
      <button data-act="fermer-resultat" class="or">revenir à la boutique</button></div>
  </div>`;
}

/* ================================================================= flash */

function flash(){
  const el = $racine.querySelector("#flash");
  if(!vue.message || Date.now() > vue.messageJusque){ el.hidden = true; return; }
  el.hidden = false;
  el.textContent = vue.message;
}

/* ============================================================ rafraichir */

export function rafraichir(G, extra = ""){
  if(!$racine) return;
  $racine.querySelector("#barre").innerHTML = barre(G);
  $racine.querySelector("#bandeaux").innerHTML = bandeaux(G);
  $racine.querySelector("#onglets").innerHTML = ONGLETS.map(([k, t]) =>
    `<span data-onglet="${k}" ${k === vue.onglet ? "data-on" : ""}>${t}</span>`).join("");
  $racine.querySelector("#panneau").innerHTML = extra || panneau(G);
  flash();
}

export const rafraichirFlash = () => flash();
