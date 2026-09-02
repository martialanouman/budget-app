# Spécifications fonctionnelles — Application web de gestion de budget

**Projet :** Gestionnaire de budget personnel
**Version :** 1.2
**Date :** 08/08/2026
**Auteur :** Martial

---

## 1. Présentation générale

### 1.1 Objectif

Concevoir une application web permettant à un particulier de :

- Suivre ses revenus et ses dépenses mensuelles
- Gérer un budget par catégories avec des plafonds mensuels
- Suivre et rembourser ses dettes de manière structurée
- Visualiser sa situation financière globale et son évolution dans le temps

### 1.2 Périmètre (v1)

**Inclus :**

- Usage personnel mono-utilisateur (avec compte sécurisé)
- Saisie manuelle des transactions + import de relevés (CSV/Excel)
- Multi-comptes (compte courant, mobile money, espèces, épargne)
- Gestion des dettes avec échéanciers
- Budgets mensuels par catégorie
- Tableaux de bord et rapports
- Devise unique : **XOF (Franc CFA)** — tous les montants, formats et affichages en XOF
- **Application hébergée** : les données sont stockées côté serveur ; l'utilisateur retrouve l'intégralité de ses données depuis n'importe quel appareil en se connectant à son compte

**Exclu (versions ultérieures) :**

- Connexion bancaire automatique (Open Banking)
- Multi-devises
- Mode hors ligne / saisie sans connexion (envisageable en v2)
- Gestion multi-utilisateurs / budget partagé en couple
- Application mobile native (l'app web sera responsive)
- Investissements et portefeuille boursier

### 1.3 Utilisateur cible

Particulier souhaitant reprendre le contrôle de ses finances : suivi quotidien des dépenses, réduction de l'endettement, constitution d'une épargne.

---

## 2. Modules fonctionnels

### 2.1 Module Comptes

| Réf. | Exigence |
|------|----------|
| CPT-01 | L'utilisateur peut créer plusieurs comptes : compte bancaire, mobile money, espèces, épargne, autre. |
| CPT-02 | Chaque compte a un nom, un type, un solde initial et une couleur. Tous les comptes sont en XOF. La couleur est choisie par l'utilisateur ; à défaut elle est dérivée du nom, de sorte qu'aucun compte n'en soit dépourvu. L'icône du compte est déduite de son type et ne se choisit pas. |
| CPT-03 | Le solde de chaque compte est calculé automatiquement (solde initial ± transactions). |
| CPT-04 | L'utilisateur peut archiver un compte sans perdre l'historique. |
| CPT-05 | Un virement entre deux comptes est saisi en une seule opération (débit + crédit liés), sans compter comme une dépense. |

### 2.2 Module Transactions (revenus & dépenses)

| Réf. | Exigence |
|------|----------|
| TRX-01 | Saisie rapide d'une transaction : montant, type (dépense/revenu), compte, catégorie, date, note facultative. Objectif : moins de 10 secondes. |
| TRX-02 | Chaque transaction est rattachée à une catégorie et, en option, une sous-catégorie et des étiquettes (tags). |
| TRX-03 | Transactions récurrentes : loyer, abonnements, salaire… avec fréquence (hebdo, mensuelle, annuelle), génération automatique et rappel avant échéance. |
| TRX-04 | Recherche et filtres : par période, compte, catégorie, montant, texte libre. |
| TRX-05 | Modification et suppression d'une transaction, avec recalcul immédiat des soldes et budgets. Les deux restent possibles **pendant 30 jours après l'enregistrement** de la transaction, et non après ; le délai court depuis la saisie, pas depuis la date de l'opération. Une jambe de virement ne se modifie jamais seule : elle se supprime, et sa jumelle tombe avec elle. |
| TRX-06 | Import de relevés au format CSV/Excel : correspondance des colonnes assistée, détection des doublons, catégorisation automatique par règles (ex. « libellé contient 'ORANGE' → Téléphonie »). |
| TRX-07 | Possibilité de joindre une photo de reçu à une transaction. |
| TRX-08 | Scinder une transaction en plusieurs catégories (ex. courses au supermarché : alimentation + hygiène). |
| TRX-09 | Le montant se saisit sur un pavé numérique de l'application plutôt que sur le clavier du système : le franc n'a pas de décimale, et un clavier numérique de téléphone en propose une. Le pavé n'est **jamais la seule voie** — la saisie reste possible au clavier physique et aux technologies d'assistance, et le montant en cours est annoncé. |

### 2.3 Module Catégories

| Réf. | Exigence |
|------|----------|
| CAT-01 | Jeu de catégories par défaut à la création du compte (logement, alimentation, transport, santé, loisirs, éducation, famille, dettes, épargne…). |
| CAT-02 | Création, renommage, fusion et désactivation de catégories et sous-catégories. |
| CAT-03 | Distinction entre charges fixes (loyer, abonnements) et dépenses variables, utilisée dans les rapports. |
| CAT-04 | Chaque catégorie porte une icône et une couleur, choisies par l'utilisateur. À défaut, **la couleur est dérivée du nom** et **l'icône est une étiquette neutre** : une catégorie sans ornement resterait indistincte dans une liste, or c'est l'icône qui rend une ligne de transaction reconnaissable d'un coup d'œil sur un téléphone. L'icône n'est pas dérivée, et l'asymétrie est voulue — aucune dérivation ne sait qu'une catégorie nommée « Coiffeur » veut un emoji précis, et un hachage dans la grille lui donnerait un taxi ; une teinte fausse ne dit rien de faux, une icône fausse si. Les catégories créées à l'inscription reçoivent les deux, choisies à la main. |

### 2.4 Module Budget mensuel

| Réf. | Exigence |
|------|----------|
| BUD-01 | Pour chaque mois, l'utilisateur définit un plafond de dépense par catégorie (méthode des enveloppes). |
| BUD-02 | Le budget d'un mois peut être dupliqué depuis le mois précédent en un clic. |
| BUD-03 | Affichage en temps réel : montant budgété, dépensé, restant, avec barre de progression par catégorie. |
| BUD-04 | Alertes visuelles à 80 % et 100 % du plafond ; notification (e-mail ou in-app) en cas de dépassement. |
| BUD-05 | Vue « Reste à vivre » : revenus du mois − charges fixes − échéances de dettes − dépenses déjà réalisées. |
| BUD-06 | Option de report du solde non dépensé d'une catégorie sur le mois suivant. |

### 2.5 Module Dettes

| Réf. | Exigence |
|------|----------|
| DET-01 | Enregistrement d'une dette : créancier, montant initial, capital restant dû, taux d'intérêt (facultatif), date de début, mensualité, jour d'échéance. |
| DET-02 | Types de dettes : prêt bancaire, crédit consommation, dette familiale/amicale, tontine, découvert, autre. Gère aussi le sens inverse (argent qu'on me doit). |
| DET-03 | Échéancier généré automatiquement ; chaque remboursement saisi (ou lié à une transaction) réduit le capital restant dû. |
| DET-04 | Rappels avant chaque échéance (paramétrable : J-3, J-1, jour J). |
| DET-05 | Tableau de bord des dettes : total dû, part du revenu mensuel consacrée au remboursement, date estimée de fin de chaque dette. |
| DET-06 | Simulateur de remboursement anticipé : impact d'un versement supplémentaire sur la durée et le coût total. |
| DET-07 | Comparaison des stratégies « boule de neige » (plus petite dette d'abord) et « avalanche » (taux le plus élevé d'abord) avec ordre de remboursement suggéré. |
| DET-08 | Historique complet des remboursements par dette. |

### 2.6 Module Objectifs d'épargne

| Réf. | Exigence |
|------|----------|
| EPG-01 | Création d'objectifs : nom, montant cible, date cible facultative (ex. fonds d'urgence, voyage, achat). |
| EPG-02 | Versements vers un objectif (manuels ou récurrents), suivi de progression en % et en montant. |
| EPG-03 | Projection de la date d'atteinte au rythme actuel. |

### 2.7 Module Tableau de bord & rapports

| Réf. | Exigence |
|------|----------|
| RAP-01 | Tableau de bord d'accueil : solde total, dépenses du mois vs budget, prochaines échéances (dettes + récurrentes), reste à vivre, top 5 des catégories de dépense. |
| RAP-02 | Graphiques : répartition des dépenses par catégorie (mois en cours), évolution revenus/dépenses sur 12 mois, évolution de l'endettement total. La répartition du mois est un **anneau accompagné d'une légende chiffrée et ordonnée**, et c'est la légende qui porte la lecture : comparer des angles est la comparaison la plus difficile qui soit, et l'anneau lui-même est masqué aux technologies d'assistance. Les deux évolutions sur douze mois restent à faire (§8). |
| RAP-03 | Comparaison mois par mois d'une catégorie (ex. alimentation sur 6 mois). |
| RAP-04 | Rapport mensuel de synthèse consultable et exportable (PDF). |
| RAP-05 | Export des données en CSV/Excel sur une période choisie. |
| RAP-06 | Série de saisie : nombre de jours consécutifs, jusqu'à aujourd'hui, comptant au moins une transaction. Tenir ses comptes est une habitude avant d'être un calcul, et c'est le seul chiffre du tableau de bord qui parle du geste plutôt que de l'argent. |
| RAP-07 | Une phrase de conseil sur le tableau de bord, calculée par des règles explicites à partir du reste à vivre et des jours restants dans le mois. Aucun texte n'est engendré à l'exécution : les formulations sont écrites, et l'on choisit entre elles. |
| RAP-08 | Conseil du mois : un rapprochement entre le mois courant et le précédent, sur un poste où l'utilisateur a fait mieux ou moins bien. Suppose RAP-03. |

### 2.8 Module Notifications & rappels

| Réf. | Exigence |
|------|----------|
| NOT-01 | Rappels d'échéances de dettes et de transactions récurrentes. |
| NOT-02 | Alerte de dépassement de budget par catégorie. |
| NOT-03 | Rappel de saisie si aucune transaction enregistrée depuis N jours (paramétrable, désactivable). |
| NOT-04 | Canaux : notification in-app et e-mail ; préférences gérées par l'utilisateur. |

### 2.9 Module Compte utilisateur & paramètres

| Réf. | Exigence |
|------|----------|
| USR-01 | Inscription et connexion par e-mail + mot de passe. Les données sont accessibles depuis n'importe quel appareil après connexion. |
| USR-02 | Réinitialisation du mot de passe par e-mail. |
| USR-03 | Paramètres : format de date, langue (français en v1). Devise fixe : XOF. Mois budgétaire : du 1er au dernier jour du mois calendaire. |
| USR-04 | Export complet des données personnelles et suppression définitive du compte (droit à l'oubli). |
| USR-05 | Verrouillage optionnel par code PIN pour un accès rapide. |
| USR-06 | Profil : l'utilisateur renseigne un nom, par lequel l'application le salue. L'adresse e-mail reste affichée à côté de la salutation — c'est elle qui dit quel compte la déconnexion va quitter. Tant qu'aucun nom n'est donné, l'adresse tient lieu de salutation. |
| USR-07 | Modification du mot de passe depuis le compte : mot de passe actuel, nouveau mot de passe et confirmation. L'ancien est exigé par le serveur, pas seulement par l'écran. La session reste ouverte. |
| USR-08 | Modification de l'adresse e-mail avec confirmation : un lien est envoyé à la **nouvelle** adresse, et le changement ne prend effet qu'une fois ce lien ouvert. L'adresse actuelle reste active jusque-là, et la confirmation ferme toutes les sessions. |
| USR-09 | Double authentification optionnelle, activable par l'utilisateur pour son seul compte. Le second facteur est un **code à usage unique envoyé par e-mail**. Le code ne vaut **jamais** comme connexion à lui seul : il complète une authentification commencée par le mot de passe, jamais ne la remplace. La **désactiver exige le mot de passe** ; l'activer non. L'authentification par application (TOTP, Google Authenticator) est écartée en v1 : PocketBase n'expose aucun point d'extension pour un facteur tiers, et son moteur de hooks n'offre pas HMAC-SHA1 — la construire signifierait réécrire l'émission de jetons sur le chemin de connexion. |
| USR-10 | Thème clair ou sombre. La préférence du système décide par défaut ; un réglage explicite la remplace et **est retenu d'une session à l'autre**. Un thème imposé sans recours est un défaut d'accessibilité pour qui a réglé son appareil exprès. |

---

## 3. Parcours utilisateur clés

### 3.1 Premier démarrage (onboarding)

1. Création du compte utilisateur (e-mail + mot de passe)
2. Création des comptes financiers (soldes initiaux)
3. Déclaration des revenus et charges fixes récurrentes
4. Déclaration des dettes en cours
5. Définition du premier budget mensuel (assistée : suggestions à partir des charges déclarées)

### 3.2 Usage quotidien

1. Ouverture de l'app → tableau de bord
2. Bouton « + » toujours visible → saisie d'une dépense en moins de 10 secondes
3. Consultation du restant par catégorie

### 3.3 Fin de mois

1. Notification de clôture du mois
2. Rapport mensuel : budget vs réalisé, écarts, évolution des dettes
3. Duplication/ajustement du budget pour le mois suivant

### 3.4 Remboursement d'une dette

1. Rappel à J-3 de l'échéance
2. Saisie du remboursement (ou validation de l'échéance prévue)
3. Mise à jour du capital restant dû et de la date de fin estimée

---

## 4. Exigences non fonctionnelles

| Domaine | Exigence |
|---------|----------|
| Responsive | Interface utilisable en priorité sur mobile (mobile-first), également sur tablette et ordinateur. |
| Performance | Affichage du tableau de bord < 2 s ; saisie d'une transaction fluide même avec plusieurs années d'historique. |
| Sécurité | Mots de passe hachés (bcrypt/argon2), HTTPS obligatoire, sessions sécurisées, protection CSRF/XSS. |
| Confidentialité | Les données financières ne sont ni revendues ni partagées ; conformité RGPD (export + suppression). |
| Architecture | Application hébergée classique (client web + API + base de données serveur). Installable comme PWA pour un accès rapide depuis l'écran d'accueil. Mode hors ligne envisagé en v2. |
| Formats XOF | Montants affichés sans décimales (le XOF n'en utilise pas), séparateur de milliers par espace (ex. 150 000 F CFA). |
| Sauvegarde | Réplication continue de la base vers un stockage externe + sauvegarde quotidienne. Perte de données maximale acceptable : quelques secondes. |
| Accessibilité | Contrastes suffisants, navigation clavier, libellés de formulaires explicites (WCAG AA visé). |

---

## 5. Modèle de données (vue simplifiée)

- **Utilisateur** (id, email, mot de passe haché, paramètres)
- **Compte** (id, utilisateur, nom, type, solde initial, archivé)
- **Catégorie** (id, utilisateur, nom, parent, type fixe/variable, active)
- **Transaction** (id, compte, catégorie, type, montant, date, note, récurrence, pièce jointe, transaction liée [virement/split])
- **Règle de catégorisation** (id, motif de libellé, catégorie cible)
- **Budget** (id, mois, catégorie, montant plafond, report activé)
- **Dette** (id, créancier, type, sens [je dois / on me doit], montant initial, capital restant, taux, mensualité, jour d'échéance, statut)
- **Remboursement** (id, dette, transaction liée, montant, part capital/intérêts, date)
- **Objectif d'épargne** (id, nom, montant cible, date cible, versements)
- **Notification** (id, type, échéance, statut)

---

## 6. Priorisation proposée

| Version | Contenu |
|---------|---------|
| **MVP (v1.0)** | Compte utilisateur, comptes financiers, transactions manuelles, catégories, budget mensuel avec alertes, dettes avec échéancier et rappels, tableau de bord de base. |
| **v1.1** | Import CSV + règles de catégorisation, transactions récurrentes automatiques, rapports avancés, export PDF/CSV, objectifs d'épargne, notifications e-mail. |
| **v1.2** | Simulateurs de remboursement (boule de neige/avalanche), reste à vivre avancé. |
| **v2.0** | Mode hors ligne (PWA), budget partagé (couple/foyer), connexion bancaire, multi-devises, application mobile. |

---

## 7. Décisions actées

| # | Question | Décision |
|---|----------|----------|
| 1 | Devise | XOF uniquement ; multi-devises repoussé en v2. |
| 2 | Mois budgétaire | Mois calendaire (du 1er au dernier jour), non paramétrable en v1. |
| 3 | Dettes informelles | Minoritaires : le champ taux d'intérêt reste facultatif mais les échéanciers avec intérêts sont pleinement supportés. |
| 4 | Hébergement | **Application hébergée uniquement** : données côté serveur, accessibles depuis n'importe quel appareil. Le mode local est abandonné (risque de perte de données en changeant de PC). |
| 5 | Stack technique | React + TypeScript (TanStack Router/Query) / PocketBase (SQLite) — détaillée dans le document *Spécifications techniques*. |

---

## 8. À spécifier

Ce qui est écarté d'une livraison mais n'est pas abandonné. Chaque ligne dit **pourquoi**
c'est reporté et **ce qu'une spécification devra trancher** : sans cette seconde colonne,
un registre n'est qu'une liste de regrets. Un point qui descend ici y descend au moment où
il est écarté, pas à la fin.

| Sujet | Pourquoi c'est reporté | Ce qu'une spécification devra trancher |
|-------|------------------------|----------------------------------------|
| **Onboarding en cinq étapes** | Le §3.1 le décrit comme parcours mais aucune exigence ne le porte, et rien n'en est écrit. Écarté de la refonte de septembre 2026 : ce n'est pas une entrée de navigation. | Obligatoire ou sautable ; ce qu'il advient d'un abandon à mi-parcours ; si les plafonds proposés à la dernière étape sont calculés depuis les revenus saisis ou simplement suggérés. |
| **Objectifs d'épargne** (`EPG-01` à `EPG-03`) | v1.1. L'entrée de navigation et l'écran d'attente sont posés (PR 3/7, `/savings`) ; aucune collection n'existe. | Si un objectif est un compte d'épargne ou une enveloppe ; si un versement est une transaction ordinaire ou une écriture propre ; ce que devient un objectif atteint, et un objectif abandonné. |
| **Rapports** (`RAP-03`, `RAP-04` PDF, `RAP-05` CSV, et les deux évolutions sur douze mois de `RAP-02`) | v1.1. Entrée de navigation et écran d'attente posés (PR 3/7, `/reports`), qui renvoie à la répartition du mois déjà présente sur l'accueil. | La profondeur d'historique couverte et son coût en requêtes ; si le PDF se fabrique côté client ou serveur ; ce qu'un export CSV contient face à l'export RGPD (`USR-04`) qui existe déjà et fait presque la même chose. |
| **Évolution de l'endettement sur douze mois** | Partie de `RAP-02`. Demande de rejouer le capital restant mois par mois depuis l'historique des remboursements — ce n'est pas de l'habillage. | Si cet historique se recalcule à la demande ou se matérialise. La seconde réponse rouvrirait la règle « aucun cumul dénormalisé », dont `debts.remaining_amount` est aujourd'hui la seule exception, et sous condition. |
| **Simulateurs boule de neige / avalanche** (`DET-06`, `DET-07`) | v1.2. La maquette de septembre 2026 les dessine ; écartés du périmètre de la refonte. | Ce que « coût total » recouvre exactement ; si la stratégie suggérée se contente d'informer ou réordonne réellement les remboursements. |
| **Transactions récurrentes** (`TRX-03`) | v1.1. Aucune collection ne les porte, alors que `transactions.recurring_rule` existe déjà et que `NOT-01` promet leurs rappels : la moitié du câblage attend depuis l'étape 4. | Génération d'avance ou le jour même ; ce qui arrive à une occurrence modifiée à la main puis à la règle qui l'a produite ; comment une série s'arrête sans effacer son passé. |
| **Import CSV et règles de catégorisation** (`TRX-06`) | v1.1, jamais commencé. | Les formats acceptés ; la détection des doublons ; si une règle de catégorisation s'applique rétroactivement à l'historique ou seulement aux lignes à venir. |
| **Reçus joints** (`TRX-07`) | v1.1. La refonte livre la puce « Note » de la maquette sans sa moitié « reçu ». | Le stockage et la taille maximale ; ce que devient la pièce jointe à l'export RGPD et à la fermeture de compte ; si elle est répliquée par Litestream, qui ne réplique que SQLite. |
| **Verrouillage par code PIN** (`USR-05`) | Écarté à l'étape 1 : côté client il ne protège pas le jeton d'authentification, donc c'est un verrou cosmétique. La même objection a fait écarter un TOTP maison en `USR-09`. | S'il est assumé comme un confort et documenté comme tel, ou s'il exige un vrai chemin serveur — auquel cas ce n'est plus un PIN. |
| **Rappel de saisie** (`NOT-03`) et **notifications de récurrentes** | Les deux types existent dans le modèle `notifications` ; le centre de notifications ne leur donne aucune formulation, donc ils ne s'affichent jamais. `RAP-06`, la série de saisie, occupe exactement le même terrain. | Le N de « aucune saisie depuis N jours », sa valeur par défaut, et surtout si la série de saisie et le rappel doivent être la même mécanique vue de deux côtés plutôt que deux comptages qui se contrediront. |
| **Modifier une catégorie ou un compte après sa création** | `CAT-02` promet le renommage et `CAT-04`/`CPT-02` laissent l'apparence au choix de l'utilisateur ; les deux écrans n'offrent que la création, la désactivation et l'archivage. `useRenameCategory` et `useRenameAccount` existent depuis l'étape 3 et ne sont appelés nulle part. Conséquence mesurable : tout compte antérieur à la refonte garde une couleur dérivée sans moyen de la changer, et une icône mal cliquée l'est pour toujours. Écarté de la PR 2/7, qui pose l'apparence ; c'est l'affaire des écrans de listes. | Si la modification est un formulaire propre ou une édition en place dans la ligne ; si renommer une catégorie doit rejouer quoi que ce soit — la fusion de `CAT-02` est le vrai sujet caché derrière le renommage ; si l'apparence d'une ligne existante se modifie sans passer par le même formulaire que le nom. |
| **Le pavé numérique sur les autres montants** | `TRX-09` porte le montant d'une transaction, et la PR 4/7 l'a livré là plus le virement. Un plafond d'enveloppe, un capital de dette, une mensualité, un remboursement et un solde initial gardent le clavier du système — donc gardent la touche décimale que l'exigence désigne comme le défaut à corriger. Écarté parce que le pavé mesure 215 px : trois montants dans le formulaire de dette en feraient trois écrans. | Si un pavé qui se déplie au focus est le bon dessin pour un formulaire à plusieurs montants — ce qui suppose de régler d'abord où va le focus à l'ouverture d'une feuille ; ou si ces champs relèvent d'une saisie assise pour laquelle le clavier du système suffit, auquel cas `TRX-09` doit le dire. |
| **Le focus à l'ouverture d'une feuille** | Mesuré le 02/09/2026 : `showModal()` donne le focus au bouton « Fermer », et React ne rend pas d'attribut `autofocus` que le `<dialog>` pourrait préférer. L'`autoFocus` posé sur le champ « Montant » depuis l'étape 4 n'a donc jamais rien fait — retiré à la PR 4/7 plutôt que laissé à mentir. | Quel élément une feuille vise : son premier champ, son titre, ou le bouton de fermeture qu'elle vise aujourd'hui. Le choix vaut pour les trois feuilles, dont celle du menu qui n'a pas de champ du tout. |
| **Préférences de canal des notifications** (`NOT-04`) | L'écran Paramètres annonce « in-app + e-mail » sans que rien ne soit réglable. | Quelles notifications se coupent séparément ; ce qu'un utilisateur qui coupe tout continue de recevoir malgré lui, car la réinitialisation de mot de passe n'est pas négociable. |
| **Confirmation des actions destructives** | Hétérogène : double clic pour une transaction, rien pour une enveloppe, un remboursement ni l'archivage d'un compte, saisie de l'adresse e-mail pour fermer le compte. Uniformiser est un changement de comportement, que la refonte de septembre 2026 s'est interdit. | À partir de quel enjeu une suppression se confirme, et sous quelle forme — l'échelle doit être unique, sinon elle ne s'apprend pas. |
| **Session périmée ou révoquée** | Rien n'appelle `authRefresh()` : un nom modifié ailleurs reste périmé dans l'en-tête, et une session révoquée côté serveur affiche encore `0 F CFA` au lieu de renvoyer à la connexion. Défaut connu, jamais corrigé. | Où réfuter la session : au démarrage, à chaque navigation, ou sur le premier 401 rencontré. Le choix touche la garde d'accès, d'où le report. |

### Corrections en attente, sans décision à prendre

- **`verificationTemplate`** est encore en anglais et pointe vers la console d'administration de PocketBase, exactement le défaut que deux migrations ont déjà corrigé pour la réinitialisation de mot de passe et le changement d'adresse. Rien à concevoir : à corriger.
- **`manifest.webmanifest` est servi en `text/plain`** en production — la table MIME de Go ignore cette extension et l'image Alpine n'a pas d'`/etc/mime.types`. Mesuré dans le conteneur réel le 29/08/2026. Rien à concevoir : à corriger dans l'image.
- **Les spécifications techniques décrivaient un schéma inexistant** jusqu'au 01/09/2026 (collections jamais créées, champs de `transactions` qui n'ont jamais existé, cinq hooks listés sur quatorze). Corrigé — mais la dérive s'était installée sans que rien ne la signale, et rien ne l'empêche de recommencer.
