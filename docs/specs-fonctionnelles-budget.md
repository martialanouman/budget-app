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
| CPT-02 | Chaque compte a un nom, un type, un solde initial et une couleur/icône. Tous les comptes sont en XOF. |
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
| TRX-05 | Modification et suppression d'une transaction, avec recalcul immédiat des soldes et budgets. |
| TRX-06 | Import de relevés au format CSV/Excel : correspondance des colonnes assistée, détection des doublons, catégorisation automatique par règles (ex. « libellé contient 'ORANGE' → Téléphonie »). |
| TRX-07 | Possibilité de joindre une photo de reçu à une transaction. |
| TRX-08 | Scinder une transaction en plusieurs catégories (ex. courses au supermarché : alimentation + hygiène). |

### 2.3 Module Catégories

| Réf. | Exigence |
|------|----------|
| CAT-01 | Jeu de catégories par défaut à la création du compte (logement, alimentation, transport, santé, loisirs, éducation, famille, dettes, épargne…). |
| CAT-02 | Création, renommage, fusion et désactivation de catégories et sous-catégories. |
| CAT-03 | Distinction entre charges fixes (loyer, abonnements) et dépenses variables, utilisée dans les rapports. |

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
| RAP-02 | Graphiques : répartition des dépenses par catégorie (mois en cours), évolution revenus/dépenses sur 12 mois, évolution de l'endettement total. |
| RAP-03 | Comparaison mois par mois d'une catégorie (ex. alimentation sur 6 mois). |
| RAP-04 | Rapport mensuel de synthèse consultable et exportable (PDF). |
| RAP-05 | Export des données en CSV/Excel sur une période choisie. |

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
