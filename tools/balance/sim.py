"""
sim.py — l'oracle Python. Reimplementation INDEPENDANTE de la simulation.

Pourquoi une deuxieme implementation : deux moteurs ecrits separement qui
tombent a moins de 5 % l'un de l'autre, c'est ce qui rend une mesure credible.
Un seul moteur ne mesure que lui-meme — il confirme ses propres bugs.

Ce fichier ne lit PAS le JavaScript et n'importe rien du jeu. Il ne partage que
les constantes de config.py, qui doivent rester le miroir de src/config.js
(verifier.py controle cette egalite).

Le generateur est le meme mulberry32 : la qualite du hasard ne doit pas etre
une variable de plus entre les deux mesures. La LOGIQUE, elle, est reecrite.

Lancer : python3 sim.py [graine]
"""

import math
import sys

import config as K


# --------------------------------------------------------------- generateur

class Alea:
    """mulberry32, identique a celui d'utils.js.

    ⚠️ Le generateur est le SEUL element volontairement copie du JS. La qualite
    du hasard ne doit pas etre une variable de plus entre les deux mesures :
    si les deux oracles divergent, on veut que ce soit la LOGIQUE qui differe,
    pas la suite de nombres. Tout le reste de ce fichier est reecrit.
    """

    def __init__(self, graine):
        self.e = graine & 0xFFFFFFFF

    def __call__(self):
        self.e = (self.e + 0x6D2B79F5) & 0xFFFFFFFF
        t = _imul(self.e ^ (self.e >> 15), 1 | self.e)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    def entre(self, a, b):
        return a + self() * (b - a)

    def choix(self, seq):
        return seq[int(self() * len(seq))]

    def pondere(self, table, poids):
        total = sum(poids(k) for k in table)
        x = self() * total
        cum = 0
        for k in table:
            cum += poids(k)
            if x <= cum:
                return k
        return next(iter(table))


def _imul(a, b):
    """Math.imul : multiplication 32 bits signee, tronquee."""
    a &= 0xFFFFFFFF
    b &= 0xFFFFFFFF
    r = (a * b) & 0xFFFFFFFF
    return r


def clamp(v, a, b):
    return max(a, min(b, v))


# ------------------------------------------------------------------ modeles

class Article:
    __slots__ = ("id", "slot", "famille", "style", "tier", "rarete", "affixes", "usages", "prix")

    def __init__(self, i, slot, famille, style, tier, rarete, affixes):
        self.id = i
        self.slot = slot
        self.famille = famille
        self.style = style
        self.tier = tier
        self.rarete = rarete
        self.affixes = affixes
        self.usages = 0
        self.prix = round(K.PRIX_BASE[slot] * (tier ** K.PRIX_EXPOSANT)
                          * K.RARETES[rarete]["prix"] * K.FAMILLES[slot][famille][1])

    def qualite(self):
        usure = max(K.USURE_PLANCHER, 1 - self.usages * K.USURE_PAR_USAGE)
        return ((K.QUALITE_BASE + K.QUALITE_PAR_TIER * (self.tier - 1))
                * K.RARETES[self.rarete]["qualite"] * usure)

    def bonus(self, axe):
        v = 0
        for a in self.affixes:
            d = K.AFFIXES[a]
            if d["axe"] == axe:
                v += d["val"]
            if axe == "emotion" and "bonusEmotion" in d:
                v += d["bonusEmotion"]
        return v


class Couple:
    __slots__ = ("id", "gouts", "invites", "budget", "exigence", "jourJPrevu",
                 "expireLe")


class Contrat:
    __slots__ = ("id", "couple", "jourJ", "choix", "depense")


# ------------------------------------------------------------------- partie

class Partie:
    def __init__(self, graine, jour_max=12000):
        self.a = Alea(graine)
        self.jour_max = jour_max
        self.jour = 0
        self.argent = K.ARGENT_DEPART
        self.notoriete = K.NOTORIETE_DEPART
        self.palier = 1
        self.bouche = 0.0

        self.meubles = [("portant", 0, 0), ("comptoir", 8, 4), ("miroir", 0, 5)]
        self.stock = []
        self.catalogue = []
        self.prospects = []
        self.contrats = []
        self.agenda = {c: {} for c in K.PRESTATAIRES}
        self.fidelite = {c: 0 for c in K.PRESTATAIRES}
        self.rivaux = [{"cle": c, "style": s, "ag": g, "not": 40 + i * 18}
                       for i, (c, s, g) in enumerate(K.CONCURRENTS)]

        self._id_art = 1
        self._id_couple = 1
        self.refus_saison = 0
        self.dernier_refus = -999

        self.stats = dict(contrats=0, refuses=0, rates=0, reussis=0,
                          note_totale=0.0, recette=0.0, honoraires=0.0,
                          visiteurs=0, refoules=0, achats=0, meubles_poses=0,
                          salons=0, salons_gagnes=0, fini_le=None)

        for f, t, r in (("robe", "boheme", "commun"), ("robe", "empire", "commun"),
                        ("costume", "troisPieces", "commun"),
                        ("decoration", "guirlandes", "commun")):
            self.stock.append(self._article(f, tier=1, rarete=r, famille=t))
        self._tirer_catalogue()

    # ---------------------------------------------------------- utilitaires
    def saison(self):
        return K.SAISONS[(self.jour // K.JOURS_PAR_SAISON) % 4]

    def capacite(self):
        return K.CAPACITE_BASE + K.CAPACITE_PAR_PALIER * (self.palier - 1)

    def _article(self, slot, tier=None, rarete=None, famille=None, tier_max=1):
        fam = famille or self.a.choix(list(K.FAMILLES[slot]))
        t = tier or (1 + int(self.a() * tier_max))
        if rarete is None:
            rarete = self.a.pondere(
                K.RARETES,
                lambda k: K.RARETES[k]["poids"] * (1 if k == "commun"
                                                   else 1 + (t - 1) * 0.22))
        naturel = K.FAMILLES[slot][fam][0]
        style = naturel if self.a() < 0.62 else self.a.choix(K.STYLES)
        aff = []
        for _ in range(K.RARETES[rarete]["affixes"]):
            k = self.a.pondere(K.AFFIXES,
                               lambda x: 0 if x in aff else K.AFFIXES[x]["poids"])
            if k not in aff:
                aff.append(k)
        art = Article(self._id_art, slot, fam, style, t, rarete, aff)
        self._id_art += 1
        return art

    def _tirer_catalogue(self):
        slots = list(K.FAMILLES)
        self.catalogue = [self._article(slots[i % len(slots)],
                                        tier_max=clamp(self.palier, 1, 5))
                          for i in range(K.CATALOGUE_TAILLE)]

    # --------------------------------------------------------------- scores
    @staticmethod
    def _affinite(style, couple):
        num = den = 0.0
        for s in K.STYLES:
            g = couple.gouts[s]
            num += g * K.AFFINITE[style][s]
            den += g
        return num / den if den else 0.5

    def score_article(self, art, couple):
        return clamp(art.qualite() * (0.42 + 0.58 * self._affinite(art.style, couple)),
                     0, 100)

    def score_presta(self, cle, couple):
        _, _, qual, style, _ = K.PRESTATAIRES[cle]
        return clamp(qual * (0.42 + 0.58 * self._affinite(style, couple)), 0, 100)

    def prix_presta(self, cle, invites):
        typ, _, _, _, mult = K.PRESTATAIRES[cle]
        remise = 1 - min(K.FIDELITE_MAX, self.fidelite[cle]) * K.FIDELITE_REMISE
        par_tete = invites / 80 if typ == "traiteur" else 1
        return round(K.PRESTA_TYPES[typ]["prixBase"] * mult * par_tete * remise)

    # -------------------------------------------------------------- agendas
    def _jours_bloques(self, cle, jour_j):
        n = K.PRESTA_TYPES[K.PRESTATAIRES[cle][0]]["jourBloques"]
        return [jour_j - d for d in range(n)]

    def libre(self, cle, jour_j):
        return all(j not in self.agenda[cle] for j in self._jours_bloques(cle, jour_j))

    def reserver(self, cle, jour_j, par="joueur"):
        if not self.libre(cle, jour_j):
            return False
        for j in self._jours_bloques(cle, jour_j):
            self.agenda[cle][j] = par
        return True

    def liberer(self, cle, jour_j, par="joueur"):
        for j in self._jours_bloques(cle, jour_j):
            if self.agenda[cle].get(j) == par:
                del self.agenda[cle][j]

    def dispo_au_palier(self, typ):
        return [c for c, v in K.PRESTATAIRES.items()
                if v[0] == typ and v[1] <= self.palier]

    # ------------------------------------------------------------- boutique
    def _attrait(self):
        return sum(K.MEUBLES[c][3] for c, _, _ in self.meubles)

    def _combo(self, idx):
        cx, gx, gy = self.meubles[idx]
        cat_a = K.MEUBLES[cx][5]
        vus, bonus = set(), 0.0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            for cle, x, y in self.meubles:
                if x != gx + dx or y != gy + dy:
                    continue
                cat_b = K.MEUBLES[cle][5]
                for a, b, v in K.COMBOS:
                    if {a, b} == {cat_a, cat_b} and (a, b) not in vus:
                        vus.add((a, b))
                        bonus += v
        return bonus

    def journee_boutique(self):
        brut = ((K.VISITEURS_BASE
                 + self.notoriete * K.VISITEURS_PAR_NOTORIETE
                 + self._attrait() * K.VISITEURS_PAR_ATTRAIT)
                * K.SAISON[self.saison()]["frequentation"])
        n = int(brut) + (1 if self.a() < brut - int(brut) else 0)

        libres = [K.MEUBLES[c][2] for c, _, _ in self.meubles]
        servables = [i for i, (c, _, _) in enumerate(self.meubles)
                     if K.MEUBLES[c][2] > 0]
        recette = 0.0
        servis = refoules = 0
        for _ in range(n):
            depart = int(self.a() * max(1, len(servables)))
            choisi = None
            for k in range(len(servables)):
                cand = servables[(depart + k) % len(servables)]
                if libres[cand] > 0:
                    choisi = cand
                    break
            if choisi is None:
                refoules += 1
                continue
            libres[choisi] -= 1
            servis += 1
            recette += (K.MEUBLES[self.meubles[choisi][0]][1]
                        * (1 + self._combo(choisi)) * K.GAIN_FREQUENTATION)
        charges = K.CHARGES_BASE + K.CHARGES_PAR_PALIER * (self.palier - 1)
        self.stats["visiteurs"] += n
        self.stats["refoules"] += refoules
        self.stats["recette"] += recette
        self.argent += round(recette - charges)
        return refoules

    # -------------------------------------------------------------- clients
    def _prospect(self):
        p = K.PALIERS[self.palier - 1]
        c = Couple()
        c.id = self._id_couple
        self._id_couple += 1
        c.invites = round(self.a.entre(round(p["invitesMax"] * 0.35), p["invitesMax"]))
        c.budget = max(K.BUDGET_PLANCHER,
                       round(c.invites * K.BUDGET_PAR_INVITE * p["budgetMult"]
                             * self.a.entre(0.82, 1.24)))
        ordre = K.STYLES[:]
        for i in range(len(ordre) - 1, 0, -1):
            j = int(self.a() * (i + 1))
            ordre[i], ordre[j] = ordre[j], ordre[i]
        c.gouts = {
            ordre[0]: round(self.a.entre(*K.GOUT_DOMINANT)),
            ordre[1]: round(self.a.entre(*K.GOUT_SECOND)),
            ordre[2]: round(self.a.entre(*K.GOUT_RESTE)),
            ordre[3]: round(self.a.entre(*K.GOUT_RESTE)),
        }
        c.exigence = round(K.EXIGENCE_BASE + K.EXIGENCE_PAR_PALIER
                           * (self.palier - 1) * self.a.entre(0.8, 1.2))
        c.jourJPrevu = self.jour + round(self.a.entre(K.DELAI_MIN, K.DELAI_MAX))
        c.expireLe = self.jour + K.PATIENCE_JOURS
        return c

    # -------------------------------------------------------------- mariage
    def resoudre(self, ctr):
        pieces = {}
        for s in K.SLOTS:
            v = ctr.choix.get(s)
            if v is None:
                pieces[s] = None
            elif K.SLOT[s]["source"] == "stock":
                art = next((a for a in self.stock if a.id == v), None)
                pieces[s] = ("stock", art, art.style, art.qualite()) if art else None
            else:
                _, _, qual, style, _ = K.PRESTATAIRES[v]
                pieces[s] = ("presta", None, style, qual)

        remplis = [s for s in K.SLOTS if pieces[s]]
        vides = [s for s in K.SLOTS if not pieces[s]]
        poids_tot = sum(K.SLOT[s]["poids"] for s in K.SLOTS)
        couple = ctr.couple

        eleg = 0.0
        for s in remplis:
            nat, art, _, qual = pieces[s]
            eleg += (qual + (art.bonus("elegance") if art else 0)) * K.SLOT[s]["poids"]
        eleg /= poids_tot
        for s in vides:
            eleg -= K.PENALITE_SLOT_VIDE * K.SLOT[s]["poids"] / poids_tot * 6

        pg = 0.0
        if remplis:
            for s in remplis:
                pg += self._affinite(pieces[s][2], couple) * K.SLOT[s]["poids"]
            pg /= sum(K.SLOT[s]["poids"] for s in remplis)
        pa, paires = 0.0, 0
        for i in range(len(remplis)):
            for j in range(i + 1, len(remplis)):
                pa += K.AFFINITE[pieces[remplis[i]][2]][pieces[remplis[j]][2]]
                paires += 1
        pa = pa / paires if paires else 0.5
        coher = 100 * (K.PART_GOUTS * pg + (1 - K.PART_GOUTS) * pa)
        for s in remplis:
            if pieces[s][1]:
                coher += pieces[s][1].bonus("coherence")
        coher -= K.PENALITE_SLOT_VIDE * 0.7 * len(vides)

        emo, pe = 0.0, 0.0
        for s in remplis:
            nat, art, _, qual = pieces[s]
            w = K.PORTEURS[s]
            emo += (qual + (art.bonus("emotion") if art else 0)) * w
            pe += w
        emo = emo / pe if pe else 0
        dom = max(couple.gouts, key=lambda s: couple.gouts[s])
        emo += 3.5 * sum(1 for s in remplis if pieces[s][2] == dom)
        for s in vides:
            emo -= K.PENALITE_SLOT_VIDE * K.PORTEURS[s] * 0.8

        part = ctr.depense / couple.budget if couple.budget else 1
        if part > K.BUDGET_TOLERANCE:
            budg = 100 - (part - K.BUDGET_TOLERANCE) * K.BUDGET_PENALITE
        elif part >= 0.72:
            budg = 100
        else:
            budg = 100 - (0.72 - part) * 170
        for s in remplis:
            if pieces[s][1]:
                budg += pieces[s][1].bonus("budget")

        axes = {"elegance": clamp(round(eleg), 0, 100),
                "coherence": clamp(round(coher), 0, 100),
                "emotion": clamp(round(emo), 0, 100),
                "budget": clamp(round(budg), 0, 100)}
        note = clamp(round(sum(axes[k] * w for k, w in K.AXES.items())), 0, 100)
        reussi = note >= couple.exigence

        hono = couple.budget * K.TAUX_HONORAIRES * (1 + K.BONUS_NOTE * note / 100)
        if not reussi:
            hono *= (1 - K.MALUS_RATE_HONORAIRES)
        noto = (K.NOTORIETE_BASE + note * K.NOTORIETE_PAR_NOTE
                + couple.invites * K.NOTORIETE_PAR_INVITE) if reussi \
            else -K.MALUS_RATE_NOTORIETE
        return note, reussi, round(hono), round(noto), \
            (note * K.BOUCHE_A_OREILLE if reussi else 0)

    def estimer(self, couple):
        """Le meme geste que le joueur : on monte un dossier virtuel et on le note."""
        virt = Contrat()
        virt.couple = couple
        virt.jourJ = couple.jourJPrevu
        virt.choix = {}
        virt.depense = 0
        poids_tot = sum(K.SLOT[s]["poids"] for s in K.SLOTS)
        pris = {s: {c.choix.get(s) for c in self.contrats} for s in K.SLOTS}
        for s in K.SLOTS:
            if K.SLOT[s]["source"] == "stock":
                libres = [a for a in self.stock if a.slot == s and a.id not in pris[s]]
                if libres:
                    virt.choix[s] = max(libres, key=lambda a: self.score_article(a, couple)).id
            else:
                env = couple.budget * K.SLOT[s]["poids"] / poids_tot
                cands = [(c, self.prix_presta(c, couple.invites),
                          self.score_presta(c, couple))
                         for c in self.dispo_au_palier(s) if self.libre(c, virt.jourJ)]
                cands = [x for x in cands
                         if x[1] <= env * 1.35 and virt.depense + x[1] <= couple.budget]
                if cands:
                    best = max(cands, key=lambda x: x[2] / max(1, x[1]))
                    virt.choix[s] = best[0]
                    virt.depense += best[1]
        return self.resoudre(virt)[0]

    # ------------------------------------------------------------- decisions
    def remplir(self, ctr):
        poids_tot = sum(K.SLOT[s]["poids"] for s in K.SLOTS)
        for s in sorted(K.SLOTS, key=lambda x: -K.SLOT[x]["poids"]):
            if ctr.choix.get(s) is not None:
                continue
            if K.SLOT[s]["source"] == "stock":
                pris = {c.choix.get(s) for c in self.contrats}
                libres = [a for a in self.stock if a.slot == s and a.id not in pris]
                if libres:
                    ctr.choix[s] = max(
                        libres, key=lambda a: self.score_article(a, ctr.couple)).id
            else:
                env = ctr.couple.budget * K.SLOT[s]["poids"] / poids_tot
                cands = [(c, self.prix_presta(c, ctr.couple.invites),
                          self.score_presta(c, ctr.couple))
                         for c in self.dispo_au_palier(s) if self.libre(c, ctr.jourJ)]
                cands = [x for x in cands
                         if x[1] <= env * 1.35
                         and ctr.depense + x[1] <= ctr.couple.budget]
                if cands:
                    best = max(cands, key=lambda x: x[2] / max(1, x[1]))
                    if self.reserver(best[0], ctr.jourJ):
                        ctr.choix[s] = best[0]
                        ctr.depense += best[1]

    def decider(self):
        carnet_plein = len(self.prospects) >= self.capacite() + K.CARNET_MARGE
        classes = sorted(((p, self.estimer(p)) for p in self.prospects),
                         key=lambda x: -(x[1] - x[0].exigence))
        for p, est in classes:
            if len(self.contrats) >= self.capacite():
                break
            if est >= p.exigence + 8:
                self.prospects.remove(p)
                c = Contrat()
                c.id, c.couple, c.jourJ = p.id, p, p.jourJPrevu
                c.choix, c.depense = {}, 0
                self.contrats.append(c)
                self.stats["contrats"] += 1
        if not carnet_plein:
            return
        for p, est in reversed(classes):
            if len(self.prospects) < self.capacite() + K.CARNET_MARGE:
                break
            if p in self.prospects and est < p.exigence:
                self.prospects.remove(p)
                cout = K.COUT_NOTORIETE + K.COUT_ESCALADE * self.refus_saison
                self.notoriete = max(0, self.notoriete - cout)
                self.refus_saison += 1
                self.dernier_refus = self.jour
                self.stats["refuses"] += 1
                self._reprise(p)

    def _reprise(self, couple):
        best, sc = self.rivaux[0], -1
        for r in self.rivaux:
            v = self._affinite(r["style"], couple) * r["ag"] * self.a.entre(0.85, 1.15)
            if v > sc:
                sc, best = v, r
        best["not"] += K.RIVAL_GAIN_REPRISE

    def acheter(self):
        reserve = 1200 + self.palier * 900
        dispo = self.argent - reserve
        if dispo <= 0 or not self.catalogue:
            return
        couv = {}
        for a in self.stock:
            couv[(a.slot, a.style)] = couv.get((a.slot, a.style), 0) + 1
        abordables = [a for a in self.catalogue if a.prix <= dispo]
        if not abordables:
            return
        def valeur(a):
            trou = 1 / (1 + couv.get((a.slot, a.style), 0))
            q = (a.tier * 12 + 30) / max(1, a.prix) * 1000
            return trou * 2.2 + q
        best = max(abordables, key=valeur)
        self.argent -= best.prix
        self.catalogue.remove(best)
        self.stock.append(best)
        self.stats["achats"] += 1

    def amenager(self, refoules):
        # ⚠️ Le joueur — et donc l'oracle JS — n'amenage qu'apres avoir VU une
        # journee : `amenager` lit le bilan de la veille pour savoir s'il
        # manque des places ou de l'attrait. Au jour 1 il n'y a pas de veille.
        # Sans cette symetrie, l'oracle Python pose un meuble de plus que le
        # JS des le premier jour, et l'ecart se compose sur 8 000 jours.
        if self.jour == 0:
            return
        dispo = self.argent - (1200 + self.palier * 900)
        if dispo <= 0:
            return
        manque = refoules > 0
        cands = [c for c, v in K.MEUBLES.items()
                 if v[4] <= self.palier and v[0] <= dispo
                 and ((v[2] > 0) if manque else (v[3] > 0))]
        if not cands:
            return
        def valeur(c):
            p, gain, places, attrait, _, _ = K.MEUBLES[c]
            return (gain * places) / p if manque else attrait / p
        cle = max(cands, key=valeur)
        occupees = {(x, y) for _, x, y in self.meubles}
        libres = [(gx, gy) for gy in range(K.BOUTIQUE_H) for gx in range(K.BOUTIQUE_L)
                  if (gx, gy) not in occupees]
        if not libres:
            return
        def voisins(c):
            gx, gy = c
            return sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                       if (gx + dx, gy + dy) in occupees)
        gx, gy = max(libres, key=voisins)
        self.argent -= K.MEUBLES[cle][0]
        self.meubles.append((cle, gx, gy))
        self.stats["meubles_poses"] += 1

    # ----------------------------------------------------------------- tick
    def tick(self):
        self.jour += 1
        sais = self.saison()
        refoules = self.journee_boutique()

        for r in self.rivaux:
            suivi = max(0, self.notoriete - r["not"]) * K.RIVAL_GAIN_SUIVI * 0.01
            r["not"] += (K.RIVAL_GAIN_BASE + suivi) * r["ag"] * self.a.entre(0.7, 1.3)

        pression = K.PRESSION_BASE + K.PRESSION_PAR_PALIER * (self.palier - 1)
        for cle, (typ, pal, _, style, _) in K.PRESTATAIRES.items():
            if pal > self.palier or self.a() > pression:
                continue
            cible = self.jour + 8 + int(self.a() * 34)
            if not self.libre(cle, cible):
                continue
            riv = self.rivaux[int(self.a() * len(self.rivaux))]
            if self.a() > K.AFFINITE[style][riv["style"]] * riv["ag"]:
                continue
            self.reserver(cle, cible, riv["cle"])

        carnet = self.capacite() + K.CARNET_MARGE
        taux = ((K.PROSPECTS_PAR_JOUR + self.notoriete * K.PROSPECT_PAR_NOTORIETE
                 + self.bouche) * K.SAISON[sais]["prospects"])
        n = int(taux) + (1 if self.a() < taux - int(taux) else 0)
        self.bouche *= 0.86
        for _ in range(n):
            if len(self.prospects) >= carnet:
                continue
            self.prospects.append(self._prospect())

        # ⚠️ Un prospect qui expire part CHEZ UN CONCURRENT. La premiere
        # version le jetait simplement : le rival ne gagnait rien, et surtout
        # les quatre tirages du choix du rival n'etaient pas consommes. Sur
        # 7 000 jours et des centaines d'expirations, les deux oracles
        # partaient sur des suites de nombres completement differentes — 18 %
        # d'ecart sur les visiteurs, pour une ligne manquante.
        expires = [p for p in self.prospects if p.expireLe <= self.jour]
        for p in expires:
            self._reprise(p)
        self.prospects = [p for p in self.prospects if p.expireLe > self.jour]

        for ctr in [c for c in self.contrats if c.jourJ <= self.jour]:
            note, reussi, hono, noto, bouche = self.resoudre(ctr)
            self.argent += hono
            self.notoriete = max(0, self.notoriete + noto)
            self.bouche += bouche
            self.stats["honoraires"] += hono
            self.stats["note_totale"] += note
            self.stats["reussis" if reussi else "rates"] += 1
            for s in K.SLOTS:
                v = ctr.choix.get(s)
                if v is None:
                    continue
                if K.SLOT[s]["source"] == "stock":
                    art = next((a for a in self.stock if a.id == v), None)
                    if art:
                        art.usages += 1
                else:
                    self.fidelite[v] = min(K.FIDELITE_MAX, self.fidelite[v] + 1)
            self.contrats.remove(ctr)

        p = 1
        for x in K.PALIERS:
            if self.notoriete >= x["seuil"]:
                p = x["n"]
        if p > self.palier:
            self.palier = p
            if p == len(K.PALIERS) and self.stats["fini_le"] is None:
                self.stats["fini_le"] = self.jour

        if self.jour % K.JOURS_PAR_SAISON == 0:
            self.refus_saison = 0
            self._tirer_catalogue()
        if self.jour - self.dernier_refus > K.OUBLI_JOURS:
            self.refus_saison = 0

        if self.jour > 0 and self.jour % K.SALON_TOUS_LES_JOURS == K.SALON_JOUR_DANS_ANNEE:
            self._salon()

        if self.argent < 0:
            self.notoriete = max(0, self.notoriete - math.ceil(-self.argent / 200))
            self.argent = 0
        return refoules

    def _salon(self):
        theme = self.a.choix(K.STYLES)
        participe = self.argent - K.SALON_COUT_STAND > 0
        lignes = []
        for r in self.rivaux:
            aff = K.AFFINITE[r["style"]][theme]
            base = 60 + r["not"] * 0.34 + (self.palier - 1) * 22
            lignes.append(round(base * ((1 - K.SALON_POIDS_THEME)
                                        + K.SALON_POIDS_THEME * aff * 1.6)
                                * self.a.entre(0.92, 1.08)))
        if participe:
            def note_piece(a):
                aff = K.AFFINITE[a.style][theme]
                return a.qualite() * ((1 - K.SALON_POIDS_THEME)
                                      + K.SALON_POIDS_THEME * aff * 1.6)
            stand = sorted(self.stock, key=note_piece, reverse=True)[:K.SALON_PIECES_STAND]
            pts = round(sum(note_piece(a) for a in stand))
            rang = 1 + sum(1 for x in lignes if x > pts)
            self.argent -= K.SALON_COUT_STAND
            self.stats["salons"] += 1
            if rang in K.SALON_PRIX:
                argent, noto = K.SALON_PRIX[rang]
                self.argent += argent
                self.notoriete += noto
                if rang == 1:
                    self.stats["salons_gagnes"] += 1
            else:
                self.notoriete = max(0, self.notoriete
                                     - round(K.SALON_MALUS_ABSENCE * 0.35))
        else:
            self.notoriete = max(0, self.notoriete - K.SALON_MALUS_ABSENCE)

    # ---------------------------------------------------------------- jouer
    def jouer(self):
        refoules = 0
        while self.jour < self.jour_max:
            self.decider()
            for c in self.contrats:
                self.remplir(c)
            self.acheter()
            self.amenager(refoules)
            refoules = self.tick()
            if self.stats["fini_le"] is not None and not self.contrats:
                break
        n = self.stats["reussis"] + self.stats["rates"]
        return {
            "jour": self.jour,
            "fini_le": self.stats["fini_le"],
            "complete": self.stats["fini_le"] is not None,
            "palier": self.palier,
            "heures": round(self.jour * K.MS_PAR_JOUR / 3600000, 2),
            "contrats": self.stats["contrats"],
            "refuses": self.stats["refuses"],
            "rates": self.stats["rates"],
            "reussis": self.stats["reussis"],
            "taux_rate": round(self.stats["rates"] / n, 3) if n else 0,
            "note_moyenne": round(self.stats["note_totale"] / n, 1) if n else 0,
            "argent": round(self.argent),
            "notoriete": round(self.notoriete),
            "stock": len(self.stock),
            "meubles": len(self.meubles),
            "visiteurs": self.stats["visiteurs"],
            "refoules": self.stats["refoules"],
            "recette": round(self.stats["recette"]),
            "honoraires": round(self.stats["honoraires"]),
            "salons": self.stats["salons"],
            "salons_gagnes": self.stats["salons_gagnes"],
        }


def jouer_partie(graine, jour_max=12000):
    return Partie(graine, jour_max).jouer()


if __name__ == "__main__":
    g = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    import json
    print(json.dumps(jouer_partie(g), indent=1, ensure_ascii=False))
