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

⚠️ Ce que ce fichier ne simule PAS, et pourquoi : le codex. Il n'inscrit que ce
qui a marche et ne modifie AUCUNE valeur de la simulation — c'est un carnet de
decouvertes, pas un bonus. Le simuler ne changerait pas une mesure ; l'oublier
ne peut donc pas en fausser une. Tout le reste du jeu est ici.

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


def jsround(x):
    """Math.round de JavaScript.

    ⚠️ Le `round` de Python arrondit les demis vers le PAIR (2.5 -> 2), celui
    de JS vers le haut (2.5 -> 3). Sur un jeu ou des dizaines de milliers de
    valeurs passent par un arrondi — prix, notes, honoraires, notoriete — les
    deux oracles derivaient l'un de l'autre pour cette seule raison. C'est
    exactement le genre d'ecart qu'on prendrait pour un bug de logique.
    """
    return math.floor(x + 0.5)


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
        self.prix = jsround(K.PRIX_BASE[slot] * (tier ** K.PRIX_EXPOSANT)
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
    __slots__ = ("id", "gouts", "invites", "budget", "exigence", "exigenceInitiale",
                 "echelle", "jourJPrevu", "expireLe")


class Contrat:
    __slots__ = ("id", "couple", "jourJ", "choix", "depense", "imprevus")


# ------------------------------------------------- ce que le joueur VOIT

def fourchette_exigence(couple):
    """L'exigence telle que le couple l'ANNONCE : une fourchette, jamais le
    chiffre exact.

    ⚠️ Elle est derivee de l'id du couple, pas tiree : deux lectures de la meme
    fiche donnent la meme fourchette. Sinon le joueur n'aurait qu'a rouvrir la
    fiche pour affiner son estimation, et le flou ne couterait rien.

    Elle part de `exigenceInitiale` et non de `exigence` : un imprevu qui fait
    monter l'exigence ne doit pas transparaitre dans la fourchette, sinon le
    joueur apprendrait le coup dur sans avoir eu a le decouvrir.
    """
    marge = max(K.EXIGENCE_FLOU_MIN,
                jsround(couple.exigenceInitiale * K.EXIGENCE_FLOU_PART))
    biais = (couple.id % 7) - 3
    centre = couple.exigenceInitiale + biais
    return max(0, centre - marge), centre + marge


def exigence_vue(couple):
    """Ce que l'IA a le droit de lire. JAMAIS `couple.exigence`.

    ⚠️ Une IA qui lirait le chiffre vrai mesurerait une partie que personne ne
    peut jouer — et masquerait exactement le defaut qu'on cherche a corriger.
    Elle vise le MILIEU de la fourchette : viser le haut serait la politique
    d'un joueur qui ne rate jamais et signe deux fois moins, et on mesurerait
    alors un jeu sans risque parce que l'IA refuse d'en prendre.
    """
    lo, hi = fourchette_exigence(couple)
    return (lo + hi) / 2


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
        self.equipe = []
        self.agenda = {c: {} for c in K.PRESTATAIRES}
        self.fidelite = {c: 0 for c in K.PRESTATAIRES}
        self.rivaux = [{"cle": c, "style": s, "ag": g, "not": 40 + i * 18}
                       for i, (c, s, g) in enumerate(K.CONCURRENTS)]

        self._id_art = 1
        self._id_couple = 1
        self._id_membre = 1
        self.refus_saison = 0
        self.dernier_refus = -999

        self.stats = dict(contrats=0, refuses=0, rates=0, reussis=0,
                          note_totale=0.0, recette=0.0, honoraires=0.0,
                          visiteurs=0, refoules=0, achats=0, meubles_poses=0,
                          salons=0, salons_gagnes=0, fini_le=None,
                          ventes=0, recette_ventes=0.0, commissions=0.0,
                          salaires=0.0, recrues=0, formations=0, imprevus=0,
                          # ⚠️ Les quatre axes sont suivis un par un. Un axe
                          # constant est un quart de la note qui ne joue pas,
                          # et rien d'autre que cette mesure ne le montre :
                          # l'axe BUDGET a valu 0 sur tous les mariages d'une
                          # partie entiere sans que la moindre metrique bronche.
                          axes={k: [] for k in K.AXES}, parts=[])

        for f, t, r in (("robe", "boheme", "commun"), ("robe", "empire", "commun"),
                        ("costume", "troisPieces", "commun"),
                        ("decoration", "guirlandes", "commun")):
            self.stock.append(self._article(f, tier=1, rarete=r, famille=t))
        self._tirer_catalogue()

    # ---------------------------------------------------------- utilitaires
    def saison(self):
        return K.SAISONS[(self.jour // K.JOURS_PAR_SAISON) % 4]

    def capacite(self):
        return (K.CAPACITE_BASE + K.CAPACITE_PAR_PALIER * (self.palier - 1)
                + self.bonus_capacite())

    def _reserve(self):
        """L'IA ne depense pas jusqu'au dernier euro, comme un joueur qui garde
        de quoi payer ses charges. Sans reserve, elle tombe a decouvert des la
        premiere basse saison et la mesure ne dit plus rien."""
        return 1200 + self.palier * 900

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
        # ⚠️ Le catalogue grandit avec le palier : sans ca, l'offre du
        # fournisseur reste celle du quartier alors que la boutique ecoule
        # trois fois plus, et le stock se vide sans que rien ne le rebouche.
        taille = K.CATALOGUE_TAILLE + K.CATALOGUE_PAR_PALIER * (self.palier - 1)
        self.catalogue = [self._article(slots[i % len(slots)],
                                        tier_max=clamp(self.palier, 1, 5))
                          for i in range(taille)]

    # --------------------------------------------------------------- equipe
    # ⚠️ Piege herite n°2 : un effet agrege n'est pas un effet applique. Chacun
    # des quatre roles est LU dans une fonction qui agit — places et chance de
    # vente dans la journee de boutique, elegance et coherence dans la
    # resolution du jour J, capacite et parade aux imprevus dans les decisions,
    # prospects et notoriete dans le flux. Aucun n'est un simple compteur.
    def places_equipe(self):
        return K.PLACES_BASE + K.PLACES_PAR_PALIER * (self.palier - 1)

    def cout_recrue(self):
        return K.COUT_RECRUE_BASE + K.COUT_RECRUE_PAR_MEMBRE * len(self.equipe)

    @staticmethod
    def cout_formation(niveau):
        return K.COUT_FORMATION_BASE + K.COUT_FORMATION_PAR_NIVEAU * (niveau - 1)

    @staticmethod
    def jours_formation(niveau):
        return K.JOURS_FORMATION_BASE + K.JOURS_FORMATION_PAR_NIVEAU * (niveau - 1)

    @staticmethod
    def salaire(m):
        return K.SALAIRE_BASE + K.SALAIRE_PAR_NIVEAU * (m["niveau"] - 1)

    def en_formation(self, m):
        return m["formeJusque"] > self.jour

    def apport(self, role):
        """Les niveaux cumules des membres DISPONIBLES.

        ⚠️ Un membre en formation ne produit rien. Sans cette exclusion, la
        formation serait gratuite et l'arbitrage « former en hiver ou pas »
        n'existerait pas."""
        return sum(m["niveau"] for m in self.equipe
                   if m["role"] == role and not self.en_formation(m))

    def bonus_places(self):
        return self.apport("vendeur") * K.ROLES["vendeur"][0]

    def bonus_chance_vente(self):
        return self.apport("vendeur") * K.ROLES["vendeur"][1]

    def bonus_elegance(self):
        return self.apport("styliste") * K.ROLES["styliste"][2]

    def bonus_coherence(self):
        return self.apport("styliste") * K.ROLES["styliste"][3]

    def bonus_capacite(self):
        return int(self.apport("coordinateur") * K.ROLES["coordinateur"][4])

    def parer_imprevu(self):
        return min(0.6, self.apport("coordinateur") * K.ROLES["coordinateur"][5])

    def bonus_prospects(self):
        return self.apport("attache") * K.ROLES["attache"][6]

    def bonus_notoriete(self):
        return self.apport("attache") * K.ROLES["attache"][7]

    def jour_equipe(self):
        for m in self.equipe:
            if not m["formeJusque"]:
                continue
            if m["formeJusque"] == self.jour and m["niveau"] < K.EQUIPE_NIVEAU_MAX:
                m["niveau"] += 1
                m["formeJusque"] = 0
            elif m["formeJusque"] <= self.jour:
                m["formeJusque"] = 0

    def gerer_equipe(self):
        """La politique d'equipe du joueur. Recruter le role le moins
        represente, former UNIQUEMENT en basse saison."""
        dispo = self.argent - self._reserve()

        if (len(self.equipe) < self.places_equipe()
                and dispo > self.cout_recrue() * 2):
            # Une equipe monocolore laisse trois effets a zero : on comble le
            # trou plutot que d'empiler des vendeurs.
            compte = {r: 0 for r in K.ROLES}
            for m in self.equipe:
                compte[m["role"]] += 1
            cible = None
            for r in K.ROLES:
                if cible is None or compte[r] < compte[cible]:
                    cible = r
            cout = self.cout_recrue()
            if self.argent >= cout:
                self.argent -= cout
                # Le JS tire un prenom au recrutement : on consomme le meme
                # tirage, sinon les deux oracles se desynchronisent a chaque
                # embauche.
                self.a()
                self.equipe.append({"id": self._id_membre, "role": cible,
                                    "niveau": 1, "formeJusque": 0})
                self._id_membre += 1
                self.stats["recrues"] += 1
            return

        # ⚠️ Former en HAUTE saison, c'est se priver au pire moment : le membre
        # ne produit rien pendant sa formation. C'est ce qui rend l'hiver utile
        # au lieu d'etre un simple ralentissement.
        if self.saison() != "hiver":
            return
        for m in self.equipe:
            if self.en_formation(m):
                continue
            if self.argent - self._reserve() < self.cout_formation(m["niveau"]):
                break
            if m["niveau"] >= K.EQUIPE_NIVEAU_MAX:
                continue
            self.argent -= self.cout_formation(m["niveau"])
            m["formeJusque"] = self.jour + self.jours_formation(m["niveau"])
            self.stats["formations"] += 1
            return

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

    def prix_presta(self, cle, invites, echelle=1):
        """`echelle` est l'AMBITION du couple — le `budgetMult` de son palier.

        ⚠️ Un devis se fait sur le mariage qu'on a devant soi. Sans ce facteur,
        la part du budget depensee tombait de 0,29 au palier 1 a 0,037 au
        palier 5 : le budget est multiplie par six avec le palier, les prix ne
        l'etaient pas. L'axe BUDGET valait alors 0 sur TOUS les mariages —
        un quart des axes de la note, strictement constant."""
        typ, _, _, _, mult = K.PRESTATAIRES[cle]
        remise = 1 - min(K.FIDELITE_MAX, self.fidelite[cle]) * K.FIDELITE_REMISE
        par_tete = invites / 80 if typ == "traiteur" else 1
        # Un EXPOSANT, pas un facteur : il vaut 1 en 1, donc les devis du
        # palier 1 restent ceux du jeu qui finissait a 100 %.
        ambition = echelle ** K.PRESTA_AMBITION_EXPOSANT
        return jsround(K.PRESTA_TYPES[typ]["prixBase"] * mult * par_tete
                       * ambition * remise)

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
                # ⚠️ Un tapis et un cadre n'occupent pas le sol : cote JS,
                # `meubleEn()` ne les rend jamais, donc ils ne forment PAS de
                # combo. L'oracle Python leur accordait un bonus fantome — un
                # effet mesure qui n'existe pas dans le jeu livre.
                if not K.MEUBLES[cle][6]:
                    continue
                cat_b = K.MEUBLES[cle][5]
                for a, b, v in K.COMBOS:
                    if {a, b} == {cat_a, cat_b} and (a, b) not in vus:
                        vus.add((a, b))
                        bonus += v
        return bonus

    @staticmethod
    def _prix_vente(art):
        return jsround(art.prix * K.MARGE_VENTE * (1 - art.usages * K.VENTE_DECOTE_USAGE))

    def _chance_vente(self, art, attrait, bonus_equipe):
        """⚠️ Les pieces cheres se vendent MAL au comptoir : le quartier n'a
        pas le budget d'une piece d'exception. C'est ce qui empeche la boutique
        de se vider de ses meilleurs atouts toute seule — le joueur garde ses
        tiers hauts pour les mariages parce que le marche ne les prend pas, pas
        parce qu'une regle le lui interdit.

        ⚠️ `CHANCE_PAR_ATTRAIT` s'applique a l'attrait TOTAL, qui se compte en
        CENTAINES en fin de partie. A 0,006 la chance saturait a 85 % et la
        boutique liquidait tout son stock en quelques jours : 1 contrat en
        12 000 jours mesures. L'ordre de grandeur d'un coefficient se verifie
        contre la valeur qu'il multiplie, pas contre son voisin dans la table.
        """
        usure = art.usages * K.VENTE_DECOTE_USAGE
        return clamp(K.VENTE_CHANCE_BASE
                     + attrait * K.VENTE_CHANCE_PAR_ATTRAIT
                     + bonus_equipe
                     + usure
                     - (art.tier - 1) * K.VENTE_MALUS_PAR_TIER,
                     0.01, 0.85)

    def journee_boutique(self, vendables, engages):
        brut = ((K.VISITEURS_BASE
                 + self.notoriete * K.VISITEURS_PAR_NOTORIETE
                 + self._attrait() * K.VISITEURS_PAR_ATTRAIT)
                * K.SAISON[self.saison()]["frequentation"])
        n = int(brut) + (1 if self.a() < brut - int(brut) else 0)

        attrait = self._attrait()
        bonus_v = self.bonus_chance_vente()

        libres = [K.MEUBLES[c][2] for c, _, _ in self.meubles]
        # Un vendeur ajoute des places : c'est la lecture de son role.
        renfort = self.bonus_places()
        for i in range(len(libres)):
            if renfort <= 0:
                break
            if libres[i] > 0:
                libres[i] += 1
                renfort -= 1
        servables = [i for i, (c, _, _) in enumerate(self.meubles)
                     if K.MEUBLES[c][2] > 0]
        recette = 0.0
        servis = refoules = 0
        vendus = []
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
            cle_m = self.meubles[choisi][0]
            combo = 1 + self._combo(choisi)
            # Le service rendu : conseil, essayage, retouches. Le petit flux.
            recette += K.MEUBLES[cle_m][1] * combo * K.GAIN_FREQUENTATION

            # ⚠️ Et parfois la VENTE. C'est ce qui fait que l'argent ne monte
            # pas tout seul : la recette est adossee a une marchandise reelle,
            # qui quitte le stock. Seuls les meubles de vente vendent.
            if K.MEUBLES[cle_m][5] != "vente" or not vendables:
                continue
            art = vendables[int(self.a() * len(vendables))]
            if art.id in engages:
                continue
            if self.a() > self._chance_vente(art, attrait, bonus_v):
                continue
            gain = self._prix_vente(art) * combo
            recette += gain
            self.stats["recette_ventes"] += gain
            vendus.append(art.id)
            vendables.remove(art)

        # ⚠️ Indexees sur les meubles, pas sur le palier : c'est ce qui rend la
        # faillite reversible (voir config.py).
        charges = K.CHARGES_BASE + K.CHARGES_PAR_MEUBLE * len(self.meubles)
        self.stats["visiteurs"] += n
        self.stats["refoules"] += refoules
        self.stats["recette"] += recette
        self.argent += jsround(recette - charges)
        return refoules, vendus

    # -------------------------------------------------------------- clients
    def _prospect(self):
        p = K.PALIERS[self.palier - 1]
        c = Couple()
        c.id = self._id_couple
        self._id_couple += 1
        c.invites = jsround(self.a.entre(jsround(p["invitesMax"] * 0.35), p["invitesMax"]))
        c.budget = max(K.BUDGET_PLANCHER,
                       jsround(c.invites * K.BUDGET_PAR_INVITE * p["budgetMult"]
                               * self.a.entre(0.82, 1.24)))
        ordre = K.STYLES[:]
        for i in range(len(ordre) - 1, 0, -1):
            j = int(self.a() * (i + 1))
            ordre[i], ordre[j] = ordre[j], ordre[i]
        c.gouts = {
            ordre[0]: jsround(self.a.entre(*K.GOUT_DOMINANT)),
            ordre[1]: jsround(self.a.entre(*K.GOUT_SECOND)),
            ordre[2]: jsround(self.a.entre(*K.GOUT_RESTE)),
            ordre[3]: jsround(self.a.entre(*K.GOUT_RESTE)),
        }
        c.exigence = jsround(K.EXIGENCE_BASE + K.EXIGENCE_PAR_PALIER
                             * (self.palier - 1) * self.a.entre(0.8, 1.2))
        # ⚠️ La fourchette annoncee part d'ICI et pas de `exigence` : un imprevu
        # qui fait monter l'exigence ne doit pas transparaitre dans ce que le
        # joueur avait lu au moment de signer.
        c.exigenceInitiale = c.exigence
        # ⚠️ FIGEE a la creation, comme le budget : la deriver du palier
        # courant ferait rencherir un devis deja signe des que le joueur monte
        # d'un palier, et le dossier basculerait seul en depassement.
        c.echelle = p["budgetMult"]
        c.jourJPrevu = self.jour + jsround(self.a.entre(K.DELAI_MIN, K.DELAI_MAX))
        c.expireLe = self.jour + K.PATIENCE_JOURS
        return c

    # ------------------------------------------------------------- imprevus
    # ⚠️ CE QUI DONNE SES DENTS AU JEU (decision de design n°7). La cause du
    # 0,6 % de rates mesure n'etait pas une constante trop basse : `estimer()`
    # appelle `resoudre()`, la fonction meme du jour J, donc le joueur pouvait
    # PREDIRE sa note au point pres au moment de signer. Monter l'exigence ne
    # produisait pas d'echecs, seulement des refus.
    # Un jeu ne prend des dents que si l'ENGAGEMENT PRECEDE L'INFORMATION. Ces
    # evenements tombent apres la signature et consomment alea() : ils sont donc
    # absents de l'estimation par construction, pas par ruse.
    def _tirer_imprevu(self, ctr):
        if len(ctr.imprevus) >= K.IMPREVU_MAX_PAR_DOSSIER:
            return None
        # Rien dans les tout derniers jours : il faut pouvoir encore corriger.
        # Un coup dur sans recours n'est pas de la tension, c'est de l'arbitraire.
        if ctr.jourJ - self.jour <= K.IMPREVU_MARGE_JOURS:
            return None
        chance = K.IMPREVU_CHANCE_PAR_JOUR * (1 - self.parer_imprevu())
        if self.a() > chance:
            return None
        return self.a.pondere(K.IMPREVUS, lambda k: K.IMPREVUS[k]["poids"])

    def _appliquer_imprevu(self, cle, ctr):
        d = K.IMPREVUS[cle]
        couple = ctr.couple

        if cle == "defection":
            # Un prestataire deja reserve se decommande : sa date est liberee,
            # le slot redevient vide, et il faut retrouver quelqu'un.
            pris = [s for s in K.SLOTS
                    if K.SLOT[s]["source"] == "prestataire" and ctr.choix.get(s)]
            if not pris:
                return None
            slot = pris[int(self.a() * len(pris))]
            cle2 = ctr.choix[slot]
            self.liberer(cle2, ctr.jourJ)
            ctr.depense -= self.prix_presta(cle2, couple.invites, couple.echelle)
            ctr.choix[slot] = None

        elif cle == "invitesEnPlus":
            en_plus = max(4, jsround(couple.invites * self.a.entre(*d["part"])))
            couple.invites += en_plus
            # Le traiteur se refacture par tete : la depense monte toute seule.
            if ctr.choix.get("traiteur"):
                ctr.depense = sum(
                    self.prix_presta(ctr.choix[s], couple.invites, couple.echelle)
                    for s in K.SLOTS
                    if K.SLOT[s]["source"] == "prestataire" and ctr.choix.get(s))

        elif cle == "exigenceMontee":
            couple.exigence += jsround(self.a.entre(*d["val"]))

        elif cle == "budgetCoupe":
            coupe = jsround(couple.budget * self.a.entre(*d["part"]))
            couple.budget = max(K.BUDGET_PLANCHER, couple.budget - coupe)

        elif cle == "pieceAbimee":
            pris = [s for s in K.SLOTS
                    if K.SLOT[s]["source"] == "stock" and ctr.choix.get(s)]
            if not pris:
                return None
            slot = pris[int(self.a() * len(pris))]
            art = next((a for a in self.stock if a.id == ctr.choix[slot]), None)
            if art:
                art.usages += d["usures"]

        ctr.imprevus.append(cle)
        return cle

    # -------------------------------------------------------------- mariage
    def resoudre(self, ctr, avec_equipe=False):
        """⚠️ PURE quand `avec_equipe` est faux : aucun alea(). C'est ce qui
        permet a l'estimation de l'appeler sur un dossier virtuel — deux
        estimations de la meme chose finissent toujours par diverger, il ne
        doit y en avoir qu'une (piege herite n°10)."""
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
        if avec_equipe:
            eleg += self.bonus_elegance()
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
        if avec_equipe:
            coher += self.bonus_coherence()
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

        axes = {"elegance": clamp(jsround(eleg), 0, 100),
                "coherence": clamp(jsround(coher), 0, 100),
                "emotion": clamp(jsround(emo), 0, 100),
                "budget": clamp(jsround(budg), 0, 100)}
        note = clamp(jsround(sum(axes[k] * w for k, w in K.AXES.items())), 0, 100)
        reussi = note >= couple.exigence

        # Deux robinets, et ils disent deux metiers differents. Les HONORAIRES
        # paient ton travail — ils suivent le budget et la note. La COMMISSION
        # paie ce que tu as fait RESERVER : un dossier ou l'on n'a rien engage
        # chez un prestataire ne commissionne rien. C'est ce qui fait que
        # l'argent s'accumule sur des prestations et pas sur un forfait.
        hono = couple.budget * K.TAUX_HONORAIRES * (1 + K.BONUS_NOTE * note / 100)
        commission = jsround(ctr.depense * K.COMMISSION_PRESTA)
        if not reussi:
            hono *= (1 - K.MALUS_RATE_HONORAIRES)
        hono += commission
        noto = (K.NOTORIETE_BASE + note * K.NOTORIETE_PAR_NOTE
                + couple.invites * K.NOTORIETE_PAR_INVITE) if reussi \
            else -K.MALUS_RATE_NOTORIETE
        return (note, reussi, jsround(hono), jsround(noto),
                (note * K.BOUCHE_A_OREILLE if reussi else 0), commission, axes,
                (ctr.depense / couple.budget if couple.budget else 0))

    def estimer(self, couple):
        """Le meme geste que le joueur : on monte un dossier virtuel et on le
        note avec la fonction du jour J elle-meme."""
        virt = Contrat()
        virt.couple = couple
        virt.jourJ = couple.jourJPrevu
        virt.choix = {}
        virt.depense = 0
        virt.imprevus = []
        poids_tot = sum(K.SLOT[s]["poids"] for s in K.SLOTS)
        pris = {s: {c.choix.get(s) for c in self.contrats} for s in K.SLOTS}
        for s in K.SLOTS:
            if K.SLOT[s]["source"] == "stock":
                libres = [a for a in self.stock if a.slot == s and a.id not in pris[s]]
                if libres:
                    virt.choix[s] = max(libres, key=lambda a: self.score_article(a, couple)).id
            else:
                env = couple.budget * K.SLOT[s]["poids"] / poids_tot
                cands = [(c, self.prix_presta(c, couple.invites, couple.echelle),
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
                cands = [(c, self.prix_presta(c, ctr.couple.invites, ctr.couple.echelle),
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
        """⚠️ On classe et on decide sur `exigence_vue`, JAMAIS sur
        `couple.exigence` : le joueur n'a droit qu'a la fourchette annoncee."""
        carnet_plein = len(self.prospects) >= self.capacite() + K.CARNET_MARGE
        classes = sorted(((p, self.estimer(p), exigence_vue(p)) for p in self.prospects),
                         key=lambda x: -(x[1] - x[2]))
        for p, est, vue in classes:
            if len(self.contrats) >= self.capacite():
                break
            # Marge de 4 points : celle de joueur.mjs. Une marge differente
            # entre les deux oracles mesurerait deux politiques, pas un jeu.
            if est >= vue + 4:
                self.prospects.remove(p)
                c = Contrat()
                c.id, c.couple, c.jourJ = p.id, p, p.jourJPrevu
                c.choix, c.depense, c.imprevus = {}, 0, []
                self.contrats.append(c)
                self.stats["contrats"] += 1
        if not carnet_plein:
            return
        for p, est, vue in reversed(classes):
            if len(self.prospects) < self.capacite() + K.CARNET_MARGE:
                break
            if p in self.prospects and est < vue:
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
        """⚠️ Acheter, c'est parier sur la VARIETE — et desormais aussi
        REAPPROVISIONNER : la boutique vend le stock, donc un atelier qui
        n'achete plus se retrouve sans rien a proposer pour un mariage.
        Le stock vise borne l'appetit : au-dela, l'argent dort en marchandise."""
        dispo = self.argent - self._reserve()
        if dispo <= 0 or not self.catalogue:
            return
        vise = 14 + 9 * self.palier
        if len(self.stock) >= vise:
            return
        couv = {}
        for a in self.stock:
            couv[(a.slot, a.style)] = couv.get((a.slot, a.style), 0) + 1
        if not [a for a in self.catalogue if a.prix <= dispo]:
            return

        def valeur(a):
            trou = 1 / (1 + couv.get((a.slot, a.style), 0))
            q = (a.tier * 12 + 30) / max(1, a.prix) * 1000
            return trou * 2.2 + q

        # On achete TANT QU'ON PEUT, pas une piece par jour : un joueur qui voit
        # ses portants se vider ne se rationne pas a un article quotidien.
        reste = dispo
        for _ in range(6):
            if len(self.stock) >= vise:
                break
            possibles = [a for a in self.catalogue if a.prix <= reste]
            if not possibles:
                break
            best = max(possibles, key=valeur)
            self.argent -= best.prix
            self.catalogue.remove(best)
            self.stock.append(best)
            self.stats["achats"] += 1
            reste -= best.prix

    def amenager(self, refoules):
        # ⚠️ Le joueur — et donc l'oracle JS — n'amenage qu'apres avoir VU une
        # journee : `amenager` lit le bilan de la veille pour savoir s'il
        # manque des places ou de l'attrait. Au jour 1 il n'y a pas de veille.
        # Sans cette symetrie, l'oracle Python pose un meuble de plus que le
        # JS des le premier jour, et l'ecart se compose sur 8 000 jours.
        if self.jour == 0:
            return
        dispo = self.argent - self._reserve()
        if dispo <= 0:
            return
        manque = refoules > 0
        cands = [c for c, v in K.MEUBLES.items()
                 if v[4] <= self.palier and v[0] <= dispo
                 and ((v[2] > 0) if manque else (v[3] > 0))]
        if not cands:
            return

        def valeur(c):
            p, gain, places, attrait = K.MEUBLES[c][:4]
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

        # ⚠️ Les pieces ENGAGEES sur un dossier ne sont pas vendables.
        engages = set()
        for c in self.contrats:
            for s in K.SLOTS:
                if K.SLOT[s]["source"] == "stock" and c.choix.get(s) is not None:
                    engages.add(c.choix[s])

        # ⚠️ On ne vend JAMAIS la piece phare d'un emplacement. Sans cette
        # regle, la boutique liquide tout : l'offre du fournisseur et la
        # capacite d'ecoulement s'equilibrent a stock zero, plus aucun dossier
        # n'est montable, et l'oracle mesure 1 contrat en 12 000 jours. C'est
        # le piege n°4 sous un autre visage — une boucle qui se court-circuite
        # elle-meme. Une maison garde ses pieces de signature en vitrine.
        phares = set()
        for s in K.SLOTS:
            if K.SLOT[s]["source"] != "stock":
                continue
            dispo = [a for a in self.stock if a.slot == s and a.id not in engages]
            if dispo:
                phares.add(max(dispo, key=lambda a: a.qualite()).id)
        vendables = [a for a in self.stock
                     if a.id not in engages and a.id not in phares]

        refoules, vendus = self.journee_boutique(vendables, engages)

        # Les pieces vendues QUITTENT le stock. C'est ce qui fait que l'argent
        # est adosse a des marchandises et ne monte pas tout seul.
        if vendus:
            ids = set(vendus)
            self.stock = [a for a in self.stock if a.id not in ids]
            self.stats["ventes"] += len(vendus)

        # Le salaire tombe qu'on travaille ou non. C'est la contrepartie de la
        # capacite : une equipe trop grande coule la boutique en basse saison.
        masse = sum(self.salaire(m) for m in self.equipe)
        if masse:
            self.argent -= masse
            self.stats["salaires"] += masse
        self.jour_equipe()

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
                 + self.bouche
                 # L'attache de presse fait venir du monde : lecture de son role.
                 + self.bonus_prospects())
                * K.SAISON[sais]["prospects"])
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

        # Les imprevus, avant les jours J : un dossier peut etre frappe le matin
        # meme si sa date est loin, jamais dans les derniers jours.
        for ctr in self.contrats:
            cle = self._tirer_imprevu(ctr)
            if not cle:
                continue
            if self._appliquer_imprevu(cle, ctr):
                self.stats["imprevus"] += 1

        for ctr in [c for c in self.contrats if c.jourJ <= self.jour]:
            (note, reussi, hono, noto, bouche, commission,
             axes, part) = self.resoudre(ctr, True)
            for k, v in axes.items():
                self.stats["axes"][k].append(v)
            self.stats["parts"].append(part)
            self.argent += hono
            # L'attache de presse fait porter le mariage plus loin.
            relais = 1 + self.bonus_notoriete()
            self.notoriete = max(0, self.notoriete
                                 + (noto * relais if noto > 0 else noto))
            self.bouche += bouche
            self.stats["honoraires"] += hono
            self.stats["commissions"] += commission
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
        # ⚠️ Le fournisseur repasse tous les CATALOGUE_JOURS, pas une fois par
        # saison : sans ca, la boutique vend son stock plus vite qu'elle ne le
        # reconstitue et il ne reste rien pour les mariages.
        if self.jour % K.CATALOGUE_JOURS == 0:
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
            # Le rival suit le PALIER, pas sa notoriete : celle-ci croit sans
            # borne alors que le stand du joueur plafonne a cinq pieces.
            base = (K.SALON_RIVAL_BASE
                    + (self.palier - 1) * K.SALON_RIVAL_PAR_PALIER
                    + r["not"] * K.SALON_RIVAL_PAR_NOTORIETE)
            lignes.append(jsround(base * ((1 - K.SALON_POIDS_THEME)
                                          + K.SALON_POIDS_THEME * aff * 1.6)
                                  * self.a.entre(0.92, 1.08)))
        if participe:
            def note_piece(a):
                aff = K.AFFINITE[a.style][theme]
                return a.qualite() * ((1 - K.SALON_POIDS_THEME)
                                      + K.SALON_POIDS_THEME * aff * 1.6)
            stand = sorted(self.stock, key=note_piece, reverse=True)[:K.SALON_PIECES_STAND]
            pts = jsround(sum(note_piece(a) for a in stand))
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
                                     - jsround(K.SALON_MALUS_ABSENCE * 0.35))
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
            self.gerer_equipe()
            refoules = self.tick()
            if self.stats["fini_le"] is not None and (
                    not self.contrats or self.jour > self.stats["fini_le"] + 60):
                break
        n = self.stats["reussis"] + self.stats["rates"]
        med = lambda l: sorted(l)[len(l) // 2] if l else 0
        return {
            **{"axe_" + k: med(v) for k, v in self.stats["axes"].items()},
            "part_budget": round(med(self.stats["parts"]), 3),
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
            "argent": jsround(self.argent),
            "notoriete": jsround(self.notoriete),
            "stock": len(self.stock),
            "meubles": len(self.meubles),
            "equipe": len(self.equipe),
            "visiteurs": self.stats["visiteurs"],
            "refoules": self.stats["refoules"],
            "recette": jsround(self.stats["recette"]),
            "honoraires": jsround(self.stats["honoraires"]),
            "ventes": self.stats["ventes"],
            "recette_ventes": jsround(self.stats["recette_ventes"]),
            "commissions": jsround(self.stats["commissions"]),
            "salaires": jsround(self.stats["salaires"]),
            "recrues": self.stats["recrues"],
            "formations": self.stats["formations"],
            "imprevus": self.stats["imprevus"],
            "salons": self.stats["salons"],
            "salons_gagnes": self.stats["salons_gagnes"],
        }


def jouer_partie(graine, jour_max=12000):
    return Partie(graine, jour_max).jouer()


if __name__ == "__main__":
    g = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    import json
    print(json.dumps(jouer_partie(g), indent=1, ensure_ascii=False))
