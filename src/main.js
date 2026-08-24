/**
 * main.js — l'horloge, l'ecran titre, et le cablage entre `ui` et `state`.
 *
 * ⚠️ Le rythme se regle a TROIS endroits, pas un, et en oublier un donne un
 * jeu injouable :
 *   1. la duree d'un jour (`CFG.MS_PAR_JOUR`, divisee par la vitesse) ;
 *   2. le GEL de l'horloge pendant une animation ou un ecran modal ;
 *   3. le pas d'animation, qui suit lui aussi la vitesse.
 * Les trois sont ci-dessous, dans `boucle()`, cote a cote — pour qu'on ne
 * puisse pas en modifier un sans voir les deux autres.
 */

import { CFG, PALIERS } from "./config.js";
import * as S from "./state.js";
import * as Sv from "./save.js";
import * as UI from "./ui.js";
import * as R from "./render.js";
import * as Tuto from "./tuto.js";
import { debloquerSons, jouer, basculerSons, sonsActifs } from "./sons.js";
import { nomCouple } from "./clients.js";

let G = null;
let ctx = null;
let horloge = 0, dernier = 0;
let anim = null;             // { res, ctr, debut } pendant un jour J
let resultat = null;         // le panneau de resultat, tant qu'on ne l'a pas ferme
let guideVisible = true;

const $ = s => document.querySelector(s);

/* ============================================================= ecran titre */

function ecranTitre(){
  const aUneSauvegarde = Sv.existeUneSauvegarde();
  $("#app").innerHTML = `
    <div class="titre-ecran">
      <canvas id="titre-scene" width="480" height="200"></canvas>
      <h1>L'ATELIER DU JOUR J</h1>
      <p class="sous">Un jeu de gestion. Tu tiens une boutique, tu signes des
        couples, et une fois l'an tu passes un examen public.</p>
      <div class="menu">
        ${aUneSauvegarde ? `<button data-t="continuer" class="or">reprendre la partie</button>` : ""}
        <button data-t="nouvelle" class="${aUneSauvegarde ? "" : "or"}">nouvelle partie</button>
        <button data-t="code">reprendre avec un code</button>
      </div>
      <div id="titre-zone"></div>
      ${Sv.etatStockage.ok === false ? `<p class="alerte-txt">
        Ce navigateur refuse d'enregistrer : ${Sv.etatStockage.raison}.
        Utilise le code de partie pour ne rien perdre.</p>` : ""}
      <p class="pied">Tout est dessiné à l'exécution : pas une image, pas un son
        chargé depuis le réseau.</p>
    </div>`;

  // Un aperçu du jour J en fond de titre : c'est la promesse du jeu.
  const cv = $("#titre-scene");
  const apercu = S.nouvellePartie(20260819, "L'Atelier");
  R.dessinerJourJ(cv.getContext("2d"), null, null, apercu, 1);

  $("#app").addEventListener("click", e => {
    const b = e.target.closest("[data-t]");
    if(!b) return;
    debloquerSons();
    if(b.dataset.t === "continuer"){
      const chargee = Sv.charger();
      if(!chargee) return UI.dire("La sauvegarde est illisible.");
      demarrer(chargee);
    }else if(b.dataset.t === "nouvelle"){
      demarrer(S.nouvellePartie(undefined, "L'Atelier d'Élise"));
    }else if(b.dataset.t === "code"){
      // ⚠️ Le code de partie doit etre utilisable DEPUIS L'ECRAN TITRE. Un code
      // qu'on ne peut coller que depuis une partie en cours ne sert a rien
      // quand c'est justement le chargement qui a echoue.
      //
      // ⚠️ Ce test etait un `else` nu, et le bouton « reprendre » du panneau
      // retombait dedans : il RECONSTRUISAIT le panneau — donc vidait le
      // champ — juste avant que la ligne suivante n'aille y lire le code. Le
      // code de partie etait donc inutilisable depuis l'ecran titre, c'est-a-
      // dire exactement la ou il est indispensable. Un `else` attrape tout ce
      // qu'on ajoutera plus tard : il faut nommer la branche.
      $("#titre-zone").innerHTML = `
        <div class="panneau">
          <span class="etiq">CODE DE PARTIE</span>
          <textarea id="champ-code" rows="4" placeholder="JJ1-..."></textarea>
          <div class="ligne"><span id="code-msg" class="prune"></span>
            <span style="flex:1"></span>
            <button data-t="valider-code" class="or">reprendre</button></div>
        </div>`;
    }
    if(b.dataset.t === "valider-code"){
      const r = Sv.depuisCode($("#champ-code").value);
      if(!r.ok){ $("#code-msg").textContent = r.txt; return; }
      demarrer(r.G);
    }
  });
}

/* ================================================================ demarrage */

function demarrer(partie){
  G = partie;
  UI.monter($("#app"), G, { commande });
  ctx = UI.contexteScene();
  dernier = performance.now();
  horloge = 0;
  cadrer();
  window.addEventListener("resize", cadrer);
  rafraichir();
  requestAnimationFrame(boucle);
}

/**
 * ⚠️ L'ECHELLE D'AFFICHAGE EST UN ENTIER. A facteur fractionnaire,
 * `image-rendering:pixelated` donne des pixels de tailles inegales : une
 * colonne sur deux fait un pixel de plus, et tout le travail de pixel art
 * part en escalier irregulier. On calcule donc le plus grand entier qui tient
 * dans la largeur disponible, et on pose la largeur du canvas EN PIXELS.
 */
function cadrer(){
  const cv = ctx && ctx.canvas;
  if(!cv) return;
  const dispo = cv.parentElement.clientWidth;
  const k = Math.max(1, Math.floor(dispo / cv.width));
  cv.style.width = (cv.width * k) + "px";
  cv.style.margin = "0 auto";
}

/* ================================================================== boucle */

function boucle(t){
  const dt = Math.min(250, t - dernier);       // un onglet remis au premier
  dernier = t;                                 // plan ne doit pas rejouer 3 h

  /* (2) LE GEL. Pendant une ceremonie ou un ecran modal, l'horloge ne tourne
     pas. Sans ce gel, la journee suivante commence pendant la ceremonie et le
     joueur voit un resultat qui parle d'un autre jour. */
  const gelee = anim !== null || G.salonEnAttente || resultat !== null;

  if(!gelee && G.vitesse > 0){
    // (1) LA DUREE D'UN JOUR, divisee par la vitesse.
    horloge += dt * G.vitesse;
    while(horloge >= CFG.MS_PAR_JOUR){
      horloge -= CFG.MS_PAR_JOUR;
      unJour();
      if(anim || G.salonEnAttente) break;       // on s'arrete net sur l'evenement
    }
  }

  dessiner(t);
  requestAnimationFrame(boucle);
}

function unJour(){
  const ev = S.tick(G);
  for(const e of ev){
    if(e.type === "jourJ"){
      for(const d of (e.res.decouvertes || []))
        UI.dire("Le codex s'enrichit.", 2600);
      // ⚠️ La resolution est DEJA faite. L'animation ne fait que la rejouer :
      // elle ne peut donc pas raconter une autre issue.
      anim = { res:e.res, ctr:e.contrat, debut:performance.now() };
      jouer(e.res.reussi ? "jourJ" : "rate");
    }else if(e.type === "palier"){
      jouer("palier");
      UI.dire(`Palier ${e.palier.txt} : ${e.palier.txtDeblocage}.`, 4200);
    }else if(e.type === "salon"){
      UI.modalSalon(G, null);
    }else if(e.type === "perdu"){
      UI.dire(`${nomCouple(e.couple)} sont partis chez ${e.concurrent.txt}.`);
    }else if(e.type === "codex"){
      UI.dire(`Codex : ${e.txt}`, 3600);
    }else if(e.type === "imprevu"){
      UI.dire(`${nomCouple(e.contrat.couple)} — ${e.imprevu.txt}. ${e.imprevu.detail}`, 4600);
      jouer("refus");
    }else if(e.type === "formation"){
      UI.dire(`${e.membre.nom} passe niveau ${e.membre.niveau}.`, 3600);
      jouer("palier");
    }else if(e.type === "decouvert"){
      UI.dire(`Découvert de ${e.dette} € : la notoriété paie l'ardoise.`, 3800);
    }
  }
  Sv.sauverSiBesoin(G);
  rafraichir();
}

/* Chaque scene a son cadre. Changer la hauteur efface le canvas, donc on ne
   la touche QUE lorsqu'elle change vraiment. */
function cadreScene(h){
  if(ctx.canvas.height === h) return;
  ctx.canvas.height = h;
  ctx.imageSmoothingEnabled = false;
  cadrer();
}

function dessiner(t){
  if(!ctx) return;
  if(anim){
    cadreScene(252);
    /* (3) LE PAS D'ANIMATION SUIT LA VITESSE. A 8x, une ceremonie de six
       secondes est six secondes de trop : le joueur a demande a aller vite. */
    const v = Math.max(1, G.vitesse);
    const u = (t - anim.debut) * v / CFG.MS_ANIMATION_JOURJ;
    R.dessinerJourJ(ctx, anim.res, anim.ctr, G, Math.min(1, u));
    if(u >= 1){
      resultat = { res:anim.res, ctr:anim.ctr };
      anim = null;
      UI.rafraichir(G, UI.panneauResultat(resultat.res));
    }
    return;
  }
  if(resultat){ cadreScene(252); R.dessinerJourJ(ctx, resultat.res, resultat.ctr, G, 1); return; }
  cadreScene(206);
  R.dessinerBoutique(ctx, G, UI.vue);
  UI.rafraichirFlash();
}

function rafraichir(){
  const guide = guideVisible ? Tuto.bandeau(G) : "";
  UI.rafraichir(G);
  if(guide){
    const b = document.querySelector("#bandeaux");
    if(b) b.insertAdjacentHTML("afterbegin", guide);
  }
}

/* ================================================================ commandes
   ⚠️ Chaque commande delegue a `state.js` et se contente d'AFFICHER le refus.
   L'interface ne juge jamais de la legalite d'un coup : la regle doit vivre
   dans la fonction qui agit, sinon elle ne s'applique qu'au joueur et pas a
   l'oracle (piege herite n°5). */

function commande(act, d){
  debloquerSons();
  const id = d.id != null ? +d.id : null;

  switch(act){
    case "vitesse": G.vitesse = +d.v; break;

    case "onglet": UI.vue.onglet = d.o; break;
    case "guide-off": guideVisible = false; break;

    case "prendre": UI.vue.meubleEnMain = d.cle; break;
    case "lacher":  UI.vue.meubleEnMain = null; break;
    case "poser": {
      const r = S.poserMeuble(G, d.cle, +d.gx, +d.gy);
      if(!r.ok) return UI.dire(r.txt), jouer("refus");
      jouer("meuble");
      UI.vue.meubleEnMain = null;
      break;
    }

    case "acheter": {
      const r = S.acheterArticle(G, id);
      if(!r.ok) return UI.dire(r.txt), jouer("refus");
      jouer(r.article.rarete === "exception" ? "exception" : "achat");
      break;
    }
    case "revendre": {
      const r = S.revendreArticle(G, id);
      if(!r.ok) return UI.dire(r.txt), jouer("refus");
      UI.dire(`Revendu ${r.prix} €.`);
      jouer("piece");
      break;
    }

    case "signer": {
      const r = S.signerProspect(G, id);
      if(!r.ok) return UI.dire(r.txt), jouer("refus");
      jouer("contrat");
      UI.vue.onglet = "clients";
      UI.vue.dossierOuvert = r.contrat.id;
      break;
    }
    case "refuser": {
      const r = S.refuserProspect(G, id);
      if(!r.ok) return UI.dire(r.txt);
      UI.dire(`−${r.cout} notoriété. Ils iront chez ${r.vainqueur.txt}.`, 3200);
      jouer("refus");
      break;
    }
    case "annuler": {
      const r = S.annulerContrat(G, id);
      if(!r.ok) return UI.dire(r.txt);
      UI.dire("Contrat annulé. Ça se saura.", 3200);
      jouer("rate");
      break;
    }

    case "ouvrir":
      UI.vue.onglet = "clients";
      UI.vue.dossierOuvert = UI.vue.dossierOuvert === id ? null : id;
      UI.vue.slotOuvert = null;
      break;
    case "slot":
      UI.vue.dossierOuvert = id;
      UI.vue.slotOuvert = UI.vue.slotOuvert === d.slot ? null : d.slot;
      break;
    case "choisir": {
      const v = d.v === "" ? null : (isNaN(+d.v) ? d.v : +d.v);
      const r = S.choisirPour(G, id, d.slot, v);
      if(!r.ok) return UI.dire(r.txt), jouer("refus");
      if(r.prix) UI.dire(`Réservé pour ${r.prix} €.`);
      jouer("piece");
      UI.vue.slotOuvert = null;
      break;
    }

    case "salon-jouer": case "salon-passer": {
      const res = S.reglerSalon(G, act === "salon-jouer");
      jouer(res.rang === 1 ? "exception" : "palier");
      UI.modalSalon(G, res);
      return;                                  // le modal reste ouvert
    }
    case "salon-fermer": UI.fermerModal(); break;

    case "fermer-resultat": resultat = null; break;

    case "recruter": {
      const r = S.recruter(G, d.role);
      if(!r.ok) return UI.dire(r.txt), jouer("refus");
      UI.dire(`${r.membre.nom} rejoint l'atelier. −${r.cout} €.`, 3200);
      jouer("contrat");
      break;
    }
    case "former": {
      const r = S.former(G, id);
      if(!r.ok) return UI.dire(r.txt), jouer("refus");
      UI.dire(`${r.membre.nom} part en formation pour ${r.jusque - G.jour} jours.`, 3600);
      jouer("palier");
      break;
    }
    case "renvoyer": {
      const r = S.renvoyer(G, id);
      if(!r.ok) return UI.dire(r.txt);
      UI.dire(`${r.membre.nom} quitte l'atelier.`);
      break;
    }

    case "code": {
      const c = Sv.codeDePartie(G);
      copier(c);
      UI.dire(`Code copié (${c.length} caractères). Garde-le au chaud.`, 4200);
      break;
    }
    case "sauver":
      UI.dire(Sv.sauver(G) ? "Partie enregistrée." : Sv.etatStockage.raison, 3600);
      break;
    case "nouvelle":
      if(!confirm("Abandonner cette partie ?")) return;
      Sv.effacer();
      location.reload();
      return;
    case "sons":
      UI.dire(basculerSons() ? "Sons activés." : "Sons coupés.");
      break;
  }
  rafraichir();
}

/** Copie sans dependance : `navigator.clipboard` n'existe pas partout. */
function copier(txt){
  try{
    if(navigator.clipboard) return navigator.clipboard.writeText(txt);
  }catch(e){}
  const ta = document.createElement("textarea");
  ta.value = txt; document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand("copy"); }catch(e){}
  ta.remove();
}

/* =================================================================== amorce */

// ⚠️ Le test de stockage tourne AVANT toute chose : l'ecran titre doit deja
// pouvoir dire au joueur que sa partie ne s'enregistrera pas.
Sv.tester();
ecranTitre();

// La partie se sauve aussi quand on quitte l'onglet : c'est le moment ou on
// perd le plus de progression.
window.addEventListener("beforeunload", () => { if(G) Sv.sauver(G); });
document.addEventListener("visibilitychange", () => {
  if(G && document.hidden) Sv.sauver(G);
});
