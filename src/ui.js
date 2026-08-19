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
         SALON, CFG, PRESTATAIRES, AFFIXES } from "./config.js";
import * as Stock from "./stock.js";
import * as Presta from "./prestataires.js";
import * as Clients from "./clients.js";
import * as Boutique from "./boutique.js";
import * as Salon from "./salon.js";
import * as R from "./render.js";
import { axesAffiches } from "./mariage.js";

export const ONGLETS = [
  ["boutique","BOUTIQUE"], ["stock","STOCK"], ["clients","CLIENTS"],
  ["prestataires","PRESTATAIRES"], ["salon","SALON"],
  ["concurrents","CONCURRENTS"], ["bilan","BILAN"],
];

/* L'etat d'INTERFACE, distinct de l'etat de jeu : onglet courant, meuble en
   main, dossier ouvert. Il n'a rien a faire dans `G` — il ne se sauvegarde
   pas et ne doit pas entrer dans la reproductibilite. */
export const vue = {
  onglet: "boutique",
  meubleEnMain: null,
  dossierOuvert: null,
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
      <canvas class="scene" id="scene" width="480" height="206"></canvas>
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

const jauge = (v, max, col) =>
  `<span class="jauge"><i style="width:${Math.max(0, Math.min(100, v/max*100))}%;background:${col}"></i></span>`;

function panneau(G){
  switch(vue.onglet){
    case "boutique":     return pBoutique(G);
    case "stock":        return pStock(G);
    case "clients":      return pClients(G);
    case "prestataires": return pPrestataires(G);
    case "salon":        return pSalon(G);
    case "concurrents":  return pConcurrents(G);
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
      <span class="pill" style="border-color:${STYLE[a.style].couleur};color:${STYLE[a.style].couleur}">${ech(f.styleTxt)}</span>
      <span class="pill" style="border-color:${f.couleur};color:${f.couleur}">T${f.tier} ${ech(f.rareteTxt)}</span>
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

function gouts(couple){
  return STYLES.map(s => `<div class="ligne mince">
    <span style="min-width:88px">${ech(STYLE[s].txt)}</span>
    ${jauge(couple.gouts[s], 100, STYLE[s].couleur)}
    <b style="min-width:30px;text-align:right">${couple.gouts[s]}</b></div>`).join("");
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
  return `<div class="bloc">
    <div class="ligne">
      <i class="vign" style="${R.styleSprite(R.vignetteMariee(p, null), 30)}"></i>
      <i class="vign" style="${R.styleSprite(R.vignetteMarie(p, null), 30)}"></i>
      <div style="flex:1">
        <b>${ech(Clients.nomCouple(p))}</b><br>
        <span class="faible">${p.invites} invités · ${fmt(p.budget)} € ·
          ${ech(p.lieuTxt)} · dans ${p.jourJPrevu - G.jour} jours</span>
      </div>
      <span class="pill" style="border-color:${STYLE[Clients.styleDominant(p)].couleur};color:${STYLE[Clients.styleDominant(p)].couleur}">
        ${ech(STYLE[Clients.styleDominant(p)].txt)}</span>
    </div>
    ${gouts(p)}
    <div class="ligne">
      <span class="faible">Ils attendront ${p.expireLe - G.jour} jour(s).
        Exigence ${p.exigence}/100.</span>
      <span style="flex:1"></span>
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
  return `<div class="detail">
    ${gouts(c.couple)}
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

function slotCase(c, slot, G){
  const v = c.choix[slot];
  const on = vue.slotOuvert === slot && vue.dossierOuvert === c.id;
  if(v == null)
    return `<button class="slot" data-vide data-act="slot" data-id="${c.id}" data-slot="${slot}" ${on ? "data-on" : ""}>
      <u>${ech(SLOT[slot].txt)}</u><b>— à choisir —</b></button>`;
  if(SLOT[slot].source === "stock"){
    const a = G.stock.find(x => x.id === v);
    const note = a ? Math.round(Stock.scorePourCouple(a, c.couple)) : 0;
    return `<button class="slot" data-act="slot" data-id="${c.id}" data-slot="${slot}" ${on ? "data-on" : ""}>
      <u>${ech(SLOT[slot].txt)}</u><b>${a ? ech(Stock.nomArticle(a)) : "?"}</b>
      <span class="${note >= 55 ? "vert" : note >= 35 ? "or" : "prune"}">${note}/100 pour eux</span></button>`;
  }
  const d = PRESTATAIRES[v];
  const note = Math.round(Presta.scorePrestaPourCouple(v, c.couple));
  return `<button class="slot" data-act="slot" data-id="${c.id}" data-slot="${slot}" ${on ? "data-on" : ""}>
    <u>${ech(SLOT[slot].txt)}</u><b>${ech(d.txt)}</b>
    <span class="${note >= 55 ? "vert" : note >= 35 ? "or" : "prune"}">${note}/100 pour eux</span></button>`;
}

function choixPourSlot(c, slot, G){
  if(SLOT[slot].source === "stock"){
    const libres = G.stock.filter(a => a.slot === slot &&
      !G.contrats.some(x => x.id !== c.id && x.choix[slot] === a.id));
    const tries = libres.map(a => ({ a, n: Stock.scorePourCouple(a, c.couple) }))
                        .sort((x, y) => y.n - x.n);
    return `<div class="choix"><span class="etiq">${ech(SLOT[slot].txt)} — ton stock</span>
      ${tries.map(({ a, n }) => carteArticle(a, G,
        `<button data-act="choisir" data-id="${c.id}" data-slot="${slot}" data-v="${a.id}"
          class="${n >= 55 ? "vert" : ""}">${Math.round(n)}/100</button>`)).join("")
        || `<div class="ligne faible">Aucune pièce libre pour cet emplacement.</div>`}
      ${c.choix[slot] != null ? `<button data-act="choisir" data-id="${c.id}" data-slot="${slot}" data-v="">retirer</button>` : ""}
    </div>`;
  }
  const cands = Presta.disponiblesAuPalier(slot, G.palier)
    .map(k => Presta.fichePresta(G.prestas, k, c.jourJ, c.couple.invites, c.couple))
    .sort((a, b) => b.score - a.score);
  return `<div class="choix"><span class="etiq">${ech(SLOT[slot].txt)} — le ${c.jourJ}</span>
    ${cands.map(p => `<div class="carte-art">
      <i class="vign" style="${R.styleSprite(R.vignettePresta(p.cle), 30)}"></i>
      <div class="corps"><b>${ech(p.txt)}</b>
        <span class="pill" style="border-color:${p.couleur};color:${p.couleur}">${ech(p.styleTxt)}</span>
        <span class="faible">qualité ${p.qualite} · ${fmt(p.prix)} €</span>
        ${p.fidelite ? `<span class="pill vert">fidélité ${p.fidelite}</span>` : ""}
        ${p.libre ? "" : `<span class="pill prune">pris par ${p.occupePar === "joueur" ? "toi" : ech(p.occupePar)}</span>`}
      </div>
      <button data-act="choisir" data-id="${c.id}" data-slot="${slot}" data-v="${p.cle}"
        ${p.libre || p.fidelite ? "" : "disabled"}>${p.score}/100</button>
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
        const p = Presta.fichePresta(G.prestas, k, jourJ, proche ? proche.couple.invites : 80,
                                     proche ? proche.couple : null);
        return `<div class="ligne">
          <i class="vign" style="${R.styleSprite(R.vignettePresta(k), 26)}"></i>
          <b style="min-width:150px">${ech(p.txt)}</b>
          <span class="pill" style="border-color:${p.couleur};color:${p.couleur}">${ech(p.styleTxt)}</span>
          ${jauge(p.qualite, 100, "#7fa87a")}
          <span class="or" style="min-width:70px;text-align:right">${fmt(p.prix)} €</span>
          <span class="${p.libre ? "vert" : "prune"}" style="min-width:110px;text-align:right">
            ${p.libre ? "libre" : (p.occupePar === "joueur" ? "réservé par toi" : "pris")}</span>
        </div>`;
      }).join("")}`).join("")}
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
    <span class="etiq">PALMARÈS</span>
    ${G.salons.length ? G.salons.map(s => `<div class="ligne">
      <b style="min-width:60px">An ${s.annee}</b>
      <span class="pill" style="border-color:${STYLE[s.theme].couleur};color:${STYLE[s.theme].couleur}">${ech(s.themeTxt)}</span>
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
      <b style="min-width:18px;color:${r.couleur}">${r.rang}</b>
      <b style="min-width:170px;color:${r.couleur}">${ech(r.txt)}${r.joueur ? " (toi)" : ""}</b>
      ${jauge(r.notoriete, max, r.couleur)}
      <b style="min-width:52px;text-align:right">${fmt(r.notoriete)}</b></div>`).join("")}
    <span class="etiq">CE QU'ILS T'ONT PRIS</span>
    ${G.concurrents.map(c => `<div class="ligne faible">
      <b style="color:${c.couleur};min-width:170px">${ech(c.txt)}</b>
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
        <span class="faible">honoraires ${fmt(st.honoraires)} €</span></div>
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
        <b style="min-width:18px;color:${l.couleur}">${l.rang}</b>
        <b style="min-width:150px;color:${l.couleur}">${ech(l.txt)}</b>
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
