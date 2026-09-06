# Spécifications techniques — Application web de gestion de budget

**Projet :** Gestionnaire de budget personnel
**Version :** 1.1
**Date :** 09/08/2026 (versions des outils vérifiées à cette date)
**Document lié :** Spécifications fonctionnelles v1.2

---

## 1. Architecture générale

Application hébergée classique en deux blocs :

```
┌─────────────────────┐         HTTPS          ┌──────────────────────────┐
│  Client web (SPA)   │ ◄────────────────────► │  Serveur (VPS Hetzner)   │
│  React + TypeScript │   API REST + Realtime  │  PocketBase (Go)         │
│  installable en PWA │                        │  ├─ Auth (e-mail/mdp)    │
└─────────────────────┘                        │  ├─ API REST générée     │
                                               │  ├─ SQLite (fichier)     │
                                               │  └─ Litestream ──► S3    │
                                               └──────────────────────────┘
```

- **Frontend** : Single Page Application servie en statique, installable comme PWA (icône écran d'accueil, démarrage rapide). Pas de mode hors ligne en v1.
- **Backend** : **PocketBase**, un binaire unique qui fournit la base SQLite, l'authentification, l'API REST/Realtime et une interface d'administration. Le code backend spécifique (échéanciers, simulateurs) s'écrit en hooks JavaScript PocketBase ou côté client.
- **Sauvegarde** : **Litestream** réplique en continu le fichier SQLite vers un stockage objet S3 (Hetzner Object Storage). Perte maximale en cas de crash : quelques secondes.

## 2. Stack détaillée

### 2.1 Frontend

| Brique | Choix | Version vérifiée | Rôle |
|--------|-------|------------------|------|
| Framework | React + TypeScript | 19.2 | UI, typage strict des montants et entités |
| Build | Vite | 8.2 | Développement rapide, build optimisé |
| UI / styles | Tailwind CSS, en tokens `@theme` | 4.3 | Palette, typographie et rayons ; deux thèmes |
| Composants | Maison, sur primitives natives | — | `<dialog>` pour les feuilles, `<details>` pour les replis. **shadcn/ui et Radix ont été envisagés le 09/08/2026 et jamais installés** : la plateforme fournit déjà le piège de focus, la touche Échap, l'inertion et le calque supérieur |
| Couleurs de catégorie | Huit clés de palette | — | `terracotta`, `ambre`, `olive`, `vert`, `sarcelle`, `indigo`, `prune`, `framboise`. **Une valeur par teinte, partagée par les deux thèmes** : la fenêtre de luminance qui franchit 3:1 contre le blanc *et* contre la surface sombre va de 0,136 à 0,300, donc elle existe. Stockées par clé et jamais en hexadécimal — une couleur choisie sur le clair peut disparaître sur le sombre |
| Icônes | lucide-react | 1.31.0 | Décoratives, toujours `aria-hidden` et doublées d'un mot |
| Typographie | Sora | — | Variable, deux fichiers pour quatre graisses. Servie **localement** depuis `frontend/public/fonts/` : une origine unique en production, et du texte qui s'affiche même si un tiers tombe. Instrument Serif entrera avec `RAP-07`, la ligne de coaching, et pas avant : livrée sans elle, elle était précachée sans jamais rendre un caractère |
| Graphiques | Recharts | 3.10.1 | **Pas installé.** Déclaré le 09/08/2026, toujours absent de `package.json` au 01/09/2026 : la répartition est rendue par les barres classées de `components/meter.tsx`. Retenu pour l'anneau de `RAP-02`, avec sa couche d'accessibilité désactivée — depuis la 3.0 elle pose `role="application"` sur le SVG, ce qui sort un lecteur d'écran du mode navigation |
| État serveur | TanStack Query | 5.101 | Cache des appels API, invalidation après mutation |
| Routage | TanStack Router | 1.170 | Navigation SPA, routes typées (cohérent avec TanStack Query) |
| Formulaires | React Hook Form + Zod | 7.85 / 4.4 | Validation côté client (montants > 0, dates…) |
| Dates | `Intl.DateTimeFormat('fr-FR')` | natif | Nommer un mois et un jour (`lib/dates.ts`). **date-fns a été déclaré le 09/08/2026 et jamais installé** : il n'entrera que le jour où il faudra vraiment calculer sur des dates, pas seulement les écrire |
| Montants | Intl.NumberFormat('fr-FR', {currency:'XOF'}) | natif | Affichage 150 000 F CFA, sans décimales |
| PWA | vite-plugin-pwa | 1.3 | Manifest + icône ; cache statique uniquement (pas de données hors ligne) |
| SDK API | pocketbase (client JS officiel) | 0.27 | Auth + CRUD typé vers le backend |

### 2.2 Backend

| Brique | Choix | Version vérifiée (09/08/2026) | Rôle |
|--------|-------|-------------------------------|------|
| Serveur | PocketBase | 0.39.3 | Auth, API, admin, hooks |
| Base de données | SQLite (intégrée à PocketBase) | — | Toutes les données applicatives |
| Logique métier | Hooks PocketBase (JS) | — | Génération d'échéanciers, recalculs, envoi d'e-mails |
| E-mails | SMTP Resend (offre gratuite), port 587 | — | Réinitialisation mot de passe, rappels, alertes |
| Tâches planifiées | Cron PocketBase (`cronAdd`) | — | Rappels J-3/J-1, génération des transactions récurrentes, clôture mensuelle |
| Sauvegarde | Litestream | 0.5.16 | Réplication continue du fichier SQLite vers un stockage objet S3 |

> **Note SMTP.** Les cinq ports de Resend ne se valent pas : 465 et 2465, en TLS implicite, expirent sans répondre ; 25, 587 et 2587, en STARTTLS, fonctionnent. Mesuré depuis deux réseaux le 29/08/2026. Un délai d'attente ne ressemble à rien jusqu'à ce que le mail n'arrive jamais.

> **Notes de version.** PocketBase est en pré-1.0 : figer la version en production et lire les notes de migration avant chaque montée. Litestream 0.5 utilise le nouveau format LTX (suivre la documentation 0.5+, pas les anciens tutoriels 0.3). Tailwind 4 se configure en CSS (plus de `tailwind.config.js`).
> **Les deux thèmes, et la règle qui les tient.** La palette vit en variables CSS, jamais en classes `dark:`. Le jeu clair est défini sur `:root` nu ; le sombre le redéfinit sous `@media (prefers-color-scheme: dark)` gardé par `:root:not([data-theme='light'])`, puis une seconde fois sous `:root[data-theme='dark']` pour que le choix explicite l'emporte dans les deux sens. **Aucune couleur n'a sa seule définition dans un bloc `@media` ou `[data-theme]`** : une couleur qui n'existe que dans le thème sombre disparaît du thème clair sans que rien ne le signale.
>
> **Qui écrit `[data-theme]` (`USR-10`).** `frontend/src/lib/theme.ts` seul, et l'écran qui l'appelle est `frontend/src/profile/theme-section.tsx` — trois radios, « Système » par défaut, écrites au clic sans bouton d'enregistrement. Le réglage vit dans `localStorage` (`kalpe:theme`) et non sur le compte, et c'est une contrainte avant d'être un choix : la palette doit être juste sur l'écran de connexion, où il n'existe aucune session d'où lire une préférence. Deux endroits écrivent l'attribut — un extrait bloquant dans `index.html`, avant la feuille de style, puis `installTheme()` au démarrage de l'application — sans quoi la page peindrait le thème clair le temps d'un cadre. **La mécanique était livrée depuis la PR 1/7 et l'écran manquait jusqu'à la PR 7/7** : le choix explicite était inatteignable, donc la moitié `[data-theme]` de la palette aussi.
>
> **Le contraste n'est vérifié par aucun test, et ne le sera pas.** `axe-core` range le contraste en « incomplet » dès qu'il ne peut pas résoudre le fond avec certitude — vérifié non discriminant sur un paragraphe volontairement illisible. **Toute couleur ajoutée ou modifiée se mesure donc à la main, dans les deux thèmes**, contre les 4,5:1 qu'exige WCAG AA pour du texte courant. Trois paires de la maquette de septembre 2026 échouaient à cette mesure et ont été corrigées avant d'entrer :
>
> | Paire | Maquette | Retenu |
> |-------|----------|--------|
> | Ambre sur ambre doux — le badge « 80 % » | `#B4791C`, **3,24:1** | `#906116`, **4,72:1** |
> | Ambre sur blanc | `#B4791C`, **3,69:1** | `#906116`, **5,37:1** |
> | Texte secondaire sur `surface-2` — l'en-tête de jour | `#7A6E66`, **4,29:1** | `#756A62`, **4,56:1** |
>
> Le thème sombre passait partout sans retouche (5,66:1 au plus bas). Mesures du 01/09/2026.

### 2.3 Hébergement & exploitation

| Sujet | Choix |
|-------|-------|
| Serveur | VPS Hetzner (CX22, 2 vCPU / 4 Go), Dokploy en déploiement Docker Compose |
| Frontend | Servi par PocketBase lui-même (dossier `pb_public`) → un seul déploiement, pas de CORS |
| HTTPS | Traefik, fourni par Dokploy (certificat Let's Encrypt) |
| Sauvegarde | Litestream → Hetzner Object Storage, même région que le serveur |
| Restauration | `litestream restore` : procédure documentée et testée une fois par trimestre |
| Domaine | Nom de domaine + DNS (Cloudflare) |
| Supervision | UptimeRobot (gratuit) : alerte si l'app ne répond plus |

> **Le stockage de sauvegarde est chez le même fournisseur que le serveur** (décidé le 29/08/2026, pour garder le trafic de réplication à l'intérieur du datacentre). Litestream couvre donc toujours la perte du disque et de la machine, mais **plus la perte du compte**, qui emporterait les deux ensemble. Couvrir ce cas demanderait une copie périodique chez un autre fournisseur, jamais un second Litestream — deux réplications sur la même base se marchent dessus.
>
> **La console d'administration de PocketBase ne doit pas être exposée** : Traefik refuse `/_` et `/api/collections/_superusers/`, et l'on y accède par un tunnel SSH vers la boucle locale du serveur. Bloquer le second chemin autant que le premier n'est pas un détail — la console est une page, ce point d'authentification est la porte. *Écrit et vérifié contre un Traefik réel, pas encore déployé au 29/08/2026.*

## 3. Schéma de la base (collections PocketBase)

Toutes les collections portent un champ `user` (relation vers `users`) et des règles d'accès `user = @request.auth.id` : chaque utilisateur ne voit que ses données.

| Collection | Champs principaux |
|------------|-------------------|
| `users` (auth) | email, password (géré par PocketBase), **name**, **mfa_enabled** (bool), settings (json). `mfa_enabled` est une colonne et **jamais un chemin dans le JSON `settings`** : un filtre de règle sur un chemin JSON ne ramène rien, mesuré |
| `accounts` | name, type (select : banque, mobile_money, especes, epargne, autre), initial_balance (number, `onlyInt`), color (**clé de palette** ; le champ existait depuis l'étape 3 et rien ne lui avait jamais écrit avant `CPT-02`), archived (bool). `initial_balance` est `onlyInt` : l'invariant XOF tient jusqu'au stockage, pas seulement dans le domaine |
| `categories` | name, parent (relation categories, nullable), kind (select : fixe, variable), active (bool), icon (texte, un emoji), color (texte, **une clé de palette**) — `CAT-04`, migration `1788000000`. Les deux peuvent être vides : rien ne rétro-remplit les catégories antérieures, et l'interface dérive alors l'apparence du nom |
| `transactions` | account (rel, **requis**), category (rel, optionnelle), type (select : **depense, revenu, virement_sortant, virement_entrant**), amount (number, XOF entiers, **toujours positif** — le type porte le sens), date, note, **transfer_group** (texte), **split_group** (texte), created/updated. `receipt` et `recurring_rule` n'existent pas (§8 des specs fonctionnelles) |
| `recurring_rules` | label, amount, type, account (rel), category (rel), frequency (select : hebdo, mensuel, annuel), day, next_occurrence, active  **Jamais créée** : conception retenue, implémentation reportée (§8 des specs fonctionnelles). |
| `categorization_rules` | pattern (texte contenu dans le libellé), category (rel), priority  **Jamais créée** : conception retenue, implémentation reportée (§8 des specs fonctionnelles). |
| `budgets` | month (texte `YYYY-MM`), category (rel), cap_amount, carry_over (bool), **carried_amount** (écrit par le serveur, jamais par le client). Index unique `(user, month, category)` : une seconde enveloppe couperait le plafond en deux et tous les totaux mentiraient |
| `debts` | creditor, kind (select : pret_bancaire, credit_conso, familiale, tontine, decouvert, autre), direction (select : je_dois, on_me_doit), initial_amount, remaining_amount, interest_rate (nullable), monthly_payment, due_day, start_date, status (select : active, soldee) |
| `debt_payments` | debt (rel), transaction (rel, nullable), amount, principal_part, interest_part, date |
| `savings_goals` | name, target_amount, target_date (nullable), status  **Jamais créée** : conception retenue, implémentation reportée (§8 des specs fonctionnelles). |
| `savings_contributions` | goal (rel), transaction (rel, nullable), amount, date  **Jamais créée** : conception retenue, implémentation reportée (§8 des specs fonctionnelles). |
| `notifications` | type (select : echeance_dette, recurrente, depassement_budget, rappel_saisie), payload (json), **subject** (texte indexé, clé de déduplication), due_at, read (bool). Dédupliquer sur le `payload` obligerait à relire toutes les notifications de l'utilisateur à chaque saisie : **un champ `json` relu n'est pas un objet JS**, et un filtre sur un chemin JSON ne ramène rien |

**Convention montants** : entiers en XOF (pas de décimales) — élimine tout problème d'arrondi flottant.

**Soldes et cumuls** : calculés à la volée (somme des transactions) ; SQLite indexé sur `(user, account, date)` et `(user, category, date)` reste instantané même avec des dizaines de milliers de lignes.

**Les view collections portent les agrégats.** Ce sont elles qui rendent tenable la règle
ci-dessus : la somme se fait dans SQLite, jamais en tirant l'historique dans le navigateur.
Elles sont en lecture seule et **n'émettent aucun événement realtime** — la fraîcheur passe
par l'invalidation TanStack Query après mutation, pas par une souscription.

| View | Ce qu'elle rend |
|------|-----------------|
| `account_balances` | Solde par compte : solde initial ± transactions, le signe venant du `type` |
| `budget_spending` | Dépensé par enveloppe, par mois et par catégorie |
| `monthly_summary` | Revenus et dépenses du mois, pour le reste à vivre |
| `category_usage` | Ce qui retient une catégorie : transactions, enveloppes, sous-catégories |

**Toute colonne calculée d'une view porte un `CAST(... AS INT)`.** Sans lui, PocketBase rend
l'agrégat en valeur JSON et `getInt()` y lit 0 — mesuré à l'étape 5, où le hook d'alerte de
budget ne se déclenchait jamais.

**Une seule exception à la règle des cumuls : `debts.remaining_amount`, qui est stocké.**
Elle tient à une condition — ce champ n'est **jamais ajusté**, il est **rejoué** depuis
l'historique complet des remboursements à chaque écriture. Décrémenter puis ré-incrémenter
serait le choix évident et le mauvais : corriger un remboursement ancien change ce que tous
les suivants ont remboursé, leurs intérêts ayant été calculés sur un capital qui vient de
bouger.

## 4. Logique métier côté serveur (hooks PocketBase)

Quatorze fichiers dans `pb_hooks/`, plus les modules de `pb_hooks/jobs/` qu'ils requièrent.
PocketBase ne charge que les `*.pb.js` : un module partagé n'est pas un hook.

### Écriture atomique

| Fichier | Rôle |
|---------|------|
| `transfers.pb.js` | Route serveur écrivant les **deux** jambes d'un virement dans une seule transaction SQLite. Deux écritures client laisseraient un débit sans crédit sur une coupure |
| `splits.pb.js` | Idem pour une transaction scindée : plusieurs lignes ordinaires partageant un `split_group` |

### Garde-fous

| Fichier | Rôle |
|---------|------|
| `guard_owned_relations.pb.js` | Vérifie la propriété des relations **à la création comme à la mise à jour**, pour `transactions` et `budgets`. PocketBase n'applique `account.user = @request.auth.id` qu'à la création : le trou a été mesuré deux fois |
| `guard_category_deletion.pb.js` | Refuse la suppression d'une catégorie que retiennent des transactions, des enveloppes ou des sous-catégories. **Compte avant `e.next()`** : `budgets.category` cascade, un contrôle placé après aurait déjà détruit les enveloppes |
| `limit_entry_changes.pb.js` | La fenêtre de 30 jours de `TRX-05`, en modification comme en suppression. Le délai court depuis `created`, jamais depuis `date` |
| `keep_transfer_pairs.pb.js` | Fait tomber les deux jambes d'un virement ensemble. Le partenaire n'est cherché qu'**après** `e.next()`, sinon la boucle ne se refermerait pas |
| `otp_is_a_second_factor_only.pb.js` | Refuse tout `authWithOTP` sans `mfaId`. Activer `otp` ouvre sinon une connexion **sans mot de passe** pour tout le monde : l'OTP de PocketBase est une méthode d'authentification à part entière, et `mfa.rule` n'empêche pas la première méthode d'être le code lui-même |

### Valeurs dérivées et notifications

| Fichier / cron | Déclencheur | Action |
|----------------|-------------|--------|
| `replay_debt_balance.pb.js` | Création, modification ou suppression d'un `debt_payment` | **Rejoue** `remaining_amount` et `status` depuis l'historique complet — il ne décrémente pas. Tourne **dans** l'écriture (`onRecordCreate`), pour qu'un rejeu qui échoue emporte l'écriture |
| `notify_budget_thresholds.pb.js` | Écriture d'une transaction **ou d'une enveloppe** | Réconcilie : quels seuils cette enveloppe atteint-elle maintenant. Crée ce qui manque, retire les alertes non lues qui ne se justifient plus. Poser un plafond sur une catégorie déjà dépensée doit alerter, pas attendre la dépense suivante |
| `carry_over_budgets.pb.js` | Cron le 1er du mois, **et** création d'une enveloppe | Applique `carry_over`. Le second chemin n'est pas redondant : un mois dupliqué le 3 ne recevrait jamais le report appliqué le 1er |
| `remind_debt_dues.pb.js` | Cron quotidien 06:00 | Rappels J-3 / J-1 / J, clés par `(date, dette, décalage)` — c'est ce qui rend le cron rejouable après une panne sans sonner deux fois. Le rappel le plus proche marque comme lus les précédents. **Il ne génère aucune transaction récurrente** : la collection n'existe pas |

### Service

| Fichier | Rôle |
|---------|------|
| `seed_default_categories.pb.js` | Les catégories par défaut de `CAT-01`, à l'inscription. Guardé **par catégorie** : une qui échoue ne doit pas coûter toutes les suivantes, et l'échec ne doit jamais faire échouer l'inscription |
| `export.pb.js` | L'export RGPD de `USR-04`. L'identité vient de la **session**, jamais d'un paramètre, et le bloc `account` est construit **champ par champ** : une liste blanche ne peut pas laisser passer un champ ajouté plus tard |
| `apply_env_settings.pb.js` | Rejoue SMTP, `APP_URL`, `APP_NAME` et la **limitation de débit** depuis l'environnement à chaque démarrage. Le SMTP de PocketBase vit en base : un conteneur démarrant sur un volume vide servirait sinon avec le mail coupé |

### Deux règles d'écriture qui ne sont pas du style

**Chaque handler est sérialisé et exécuté comme un programme isolé.** Il ne voit *rien* de la
portée du fichier : une `const` déclarée au-dessus du handler y sera `undefined`, et l'erreur
ne se manifeste qu'à l'exécution du hook. Les constantes vont donc dans le handler, et le
code partagé passe par un `require()` **à l'intérieur**.

**Hook de modèle ou hook de requête, ce n'est pas indifférent.** PocketBase exécute les hooks
de **modèle** (`onRecordDelete`) pour les enregistrements supprimés **en cascade**, jamais les
hooks de **requête** (`onRecordDeleteRequest`). Un garde-fou branché sur le mauvais des deux
rend la fermeture de compte impossible, ou laisse passer une suppression interne qu'il devait
couvrir. Ce dépôt l'a payé quatre fois — catégories, transactions, et `USR-04` deux fois.

**Un hook accessoire n'échoue jamais aux dépens de l'utilisateur.** Une erreur levée dans
`onRecordAfterCreateSuccess` revient au client en HTTP 400 **sur l'enregistrement lui-même** :
alertes et reports enveloppent donc leur corps dans un `try/catch` qui journalise. Une
notification impossible ne doit pas coûter la saisie qu'on vient de faire.

Les simulateurs (remboursement anticipé, boule de neige vs avalanche) restent du **calcul pur
côté client** — aucun besoin serveur.
## 5. Sécurité

- HTTPS obligatoire (HSTS), cookies/token gérés par le SDK PocketBase
- Mots de passe : bcrypt (intégré PocketBase), longueur minimale 10 caractères
- Règles d'accès par collection : isolation stricte par utilisateur (`user = @request.auth.id`)
- Limitation de débit sur les endpoints d'authentification : fournie par PocketBase mais **livrée désactivée**, donc activée au démarrage par `apply_env_settings.pb.js`. Ses règles par défaut plafonnent l'authentification à deux tentatives par trois secondes — mesuré le 29/08/2026, la deuxième reçoit un 429
- Interface admin PocketBase : **exposée à ce jour**. Le retrait vit sur la branche `console-behind-ssh-tunnel`, **non fusionnée** : `deploy/compose.yml` déclare un routeur Traefik sur `Host(${APP_DOMAIN})` sans middleware de blocage, donc `/_/` et `/api/collections/_superusers/auth-with-password` répondent depuis Internet. La cible est décrite au §2.3. Protéger `/_/` ne suffira pas : la console est une page, ce point d'authentification est la porte, et un attaquant qui connaît l'API ne visite jamais la page. Ce que la limitation de débit ci-dessous couvre en attendant
- Export RGPD : endpoint d'export JSON/CSV de toutes les collections de l'utilisateur ; suppression en cascade à la suppression du compte
- Aucune donnée bancaire sensible (pas de numéros de compte réels requis)

## 6. Environnements & déploiement

| Sujet | Choix |
|-------|-------|
| Code | Monorepo Git (GitHub) : `/frontend` + `/pb_hooks` + `/deploy` |
| CI/CD | GitHub Actions vérifie (lint, types, tests) ; Dokploy construit l'image sur le serveur et déploie |
| Environnements | `dev` (PocketBase local, données de test) et `prod` |
| Migrations | Migrations PocketBase versionnées dans Git (`pb_migrations`) |
| Tests | Vitest (logique métier front : simulateurs, calculs de budget) + tests manuels de parcours |

## 7. Estimation des coûts mensuels

| Poste | Coût |
|-------|------|
| Serveur (VPS Hetzner CX22) | ~5 € |
| Sauvegarde (Hetzner Object Storage) | ~1 € |
| E-mails (Resend, offre gratuite) | 0 € |
| Nom de domaine | ~1 €/mois (12 €/an) |
| **Total** | **~7 €/mois** |

## 8. Risques et parades

| Risque | Parade |
|--------|--------|
| Perte du serveur / du disque | Litestream (réplication continue) + restauration testée régulièrement |
| PocketBase trop limitant à terme | Le schéma est du SQL standard : migration possible vers PostgreSQL + backend Node si besoin (v2 multi-utilisateurs) |
| Montée en charge (si ouverture à d'autres utilisateurs) | SQLite tient sans problème jusqu'à plusieurs milliers d'utilisateurs pour ce profil d'usage |
| E-mails en spam | Domaine dédié + SPF/DKIM configurés dès le départ |
