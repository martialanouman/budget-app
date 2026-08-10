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
│  Client web (SPA)   │ ◄────────────────────► │  Serveur (VPS/Fly.io)    │
│  React + TypeScript │   API REST + Realtime  │  PocketBase (Go)         │
│  installable en PWA │                        │  ├─ Auth (e-mail/mdp)    │
└─────────────────────┘                        │  ├─ API REST générée     │
                                               │  ├─ SQLite (fichier)     │
                                               │  └─ Litestream ──► S3    │
                                               └──────────────────────────┘
```

- **Frontend** : Single Page Application servie en statique, installable comme PWA (icône écran d'accueil, démarrage rapide). Pas de mode hors ligne en v1.
- **Backend** : **PocketBase**, un binaire unique qui fournit la base SQLite, l'authentification, l'API REST/Realtime et une interface d'administration. Le code backend spécifique (échéanciers, simulateurs) s'écrit en hooks JavaScript PocketBase ou côté client.
- **Sauvegarde** : **Litestream** réplique en continu le fichier SQLite vers un stockage objet (Backblaze B2 ou S3). Perte maximale en cas de crash : quelques secondes.

## 2. Stack détaillée

### 2.1 Frontend

| Brique | Choix | Version vérifiée (09/08/2026) | Rôle |
|--------|-------|-------------------------------|------|
| Framework | React + TypeScript | 19.2 | UI, typage strict des montants et entités |
| Build | Vite | 8.2 | Développement rapide, build optimisé |
| UI / styles | Tailwind CSS + shadcn/ui | 4.3 | Composants mobile-first (formulaires, tableaux, dialogues) |
| Graphiques | Recharts | 3.10 | Camemberts, courbes 12 mois, barres de progression |
| État serveur | TanStack Query | 5.101 | Cache des appels API, invalidation après mutation |
| Routage | TanStack Router | 1.170 | Navigation SPA, routes typées (cohérent avec TanStack Query) |
| Formulaires | React Hook Form + Zod | 7.85 / 4.4 | Validation côté client (montants > 0, dates…) |
| Dates | date-fns (locale fr) | 4.4 | Calculs d'échéances, mois budgétaires |
| Montants | Intl.NumberFormat('fr-FR', {currency:'XOF'}) | natif | Affichage 150 000 F CFA, sans décimales |
| PWA | vite-plugin-pwa | 1.3 | Manifest + icône ; cache statique uniquement (pas de données hors ligne) |
| SDK API | pocketbase (client JS officiel) | 0.27 | Auth + CRUD typé vers le backend |

### 2.2 Backend

| Brique | Choix | Version vérifiée (09/08/2026) | Rôle |
|--------|-------|-------------------------------|------|
| Serveur | PocketBase | 0.39.3 | Auth, API, admin, hooks |
| Base de données | SQLite (intégrée à PocketBase) | — | Toutes les données applicatives |
| Logique métier | Hooks PocketBase (JS) | — | Génération d'échéanciers, recalculs, envoi d'e-mails |
| E-mails | SMTP (Brevo ou Resend, offre gratuite) | — | Réinitialisation mot de passe, rappels, alertes |
| Tâches planifiées | Cron PocketBase (`cronAdd`) | — | Rappels J-3/J-1, génération des transactions récurrentes, clôture mensuelle |
| Sauvegarde | Litestream | 0.5.12 | Réplication continue du fichier SQLite vers B2/S3 |

> **Notes de version.** PocketBase est en pré-1.0 : figer la version en production et lire les notes de migration avant chaque montée. Litestream 0.5 utilise le nouveau format LTX (suivre la documentation 0.5+, pas les anciens tutoriels 0.3). Tailwind 4 se configure en CSS (plus de `tailwind.config.js`) — les versions récentes de shadcn/ui le supportent nativement.

### 2.3 Hébergement & exploitation

| Sujet | Choix |
|-------|-------|
| Serveur | Fly.io (machine 256 Mo + volume persistant 1 Go) ou VPS (Hetzner/Contabo ~5 €/mois) |
| Frontend | Servi par PocketBase lui-même (dossier `pb_public`) → un seul déploiement, pas de CORS |
| HTTPS | Automatique (Fly.io) ou Caddy (VPS) |
| Sauvegarde | Litestream → Backblaze B2 (10 Go gratuits) + snapshot quotidien |
| Restauration | `litestream restore` : procédure documentée et testée une fois par trimestre |
| Domaine | Nom de domaine + DNS (Cloudflare) |
| Supervision | UptimeRobot (gratuit) : alerte si l'app ne répond plus |

## 3. Schéma de la base (collections PocketBase)

Toutes les collections portent un champ `user` (relation vers `users`) et des règles d'accès `user = @request.auth.id` : chaque utilisateur ne voit que ses données.

| Collection | Champs principaux |
|------------|-------------------|
| `users` (auth) | email, password (géré par PocketBase), settings (json : format date, préférences notifications) |
| `accounts` | name, type (select : banque, mobile_money, especes, epargne, autre), initial_balance (number), color, archived (bool) |
| `categories` | name, parent (relation categories, nullable), kind (select : fixe, variable), active (bool) |
| `transactions` | account (rel), category (rel), type (select : depense, revenu, virement), amount (number, XOF entiers), date, note, transfer_ref (rel transactions, nullable), split_parent (rel transactions, nullable), receipt (file), recurring_rule (rel, nullable) |
| `recurring_rules` | label, amount, type, account (rel), category (rel), frequency (select : hebdo, mensuel, annuel), day, next_occurrence, active |
| `categorization_rules` | pattern (texte contenu dans le libellé), category (rel), priority |
| `budgets` | month (texte `YYYY-MM`), category (rel), cap_amount, carry_over (bool) |
| `debts` | creditor, kind (select : pret_bancaire, credit_conso, familiale, tontine, decouvert, autre), direction (select : je_dois, on_me_doit), initial_amount, remaining_amount, interest_rate (nullable), monthly_payment, due_day, start_date, status (select : active, soldee) |
| `debt_payments` | debt (rel), transaction (rel, nullable), amount, principal_part, interest_part, date |
| `savings_goals` | name, target_amount, target_date (nullable), status |
| `savings_contributions` | goal (rel), transaction (rel, nullable), amount, date |
| `notifications` | type (select : echeance_dette, recurrente, depassement_budget, rappel_saisie), payload (json), due_at, read (bool) |

**Convention montants** : entiers en XOF (pas de décimales) — élimine tout problème d'arrondi flottant.

**Soldes et cumuls** : calculés à la volée (somme des transactions) ; SQLite indexé sur `(user, account, date)` et `(user, category, date)` reste instantané même avec des dizaines de milliers de lignes.

## 4. Logique métier côté serveur (hooks PocketBase)

| Hook / cron | Déclencheur | Action |
|-------------|-------------|--------|
| `onRecordCreate(debt_payments)` | Saisie d'un remboursement | Décrémente `debts.remaining_amount` ; passe `status = soldee` si ≤ 0 |
| `onRecordDelete/Update(debt_payments)` | Correction | Recalcule `remaining_amount` depuis l'historique |
| Cron quotidien 06:00 | Chaque jour | Génère les transactions récurrentes arrivées à échéance ; crée les notifications J-3/J-1/J des dettes ; envoie les e-mails |
| Cron mensuel (le 1er) | Début de mois | Applique les reports de budget (`carry_over`) ; notification « clôture du mois + rapport disponible » |
| `onRecordCreate(transactions)` | Nouvelle dépense | Vérifie le budget de la catégorie ; crée une notification à 80 % / 100 % |

Les simulateurs (remboursement anticipé, boule de neige vs avalanche) sont du **calcul pur côté client** — aucun besoin serveur.

## 5. Sécurité

- HTTPS obligatoire (HSTS), cookies/token gérés par le SDK PocketBase
- Mots de passe : bcrypt (intégré PocketBase), longueur minimale 10 caractères
- Règles d'accès par collection : isolation stricte par utilisateur (`user = @request.auth.id`)
- Limitation de débit sur les endpoints d'authentification (intégrée PocketBase)
- Interface admin PocketBase : accessible uniquement via une URL protégée + mot de passe fort (voire filtrage IP)
- Export RGPD : endpoint d'export JSON/CSV de toutes les collections de l'utilisateur ; suppression en cascade à la suppression du compte
- Aucune donnée bancaire sensible (pas de numéros de compte réels requis)

## 6. Environnements & déploiement

| Sujet | Choix |
|-------|-------|
| Code | Monorepo Git (GitHub) : `/frontend` + `/pb_hooks` + `/deploy` |
| CI/CD | GitHub Actions : build du frontend → copie dans `pb_public` → déploiement Fly.io (`fly deploy`) |
| Environnements | `dev` (PocketBase local, données de test) et `prod` |
| Migrations | Migrations PocketBase versionnées dans Git (`pb_migrations`) |
| Tests | Vitest (logique métier front : simulateurs, calculs de budget) + tests manuels de parcours |

## 7. Estimation des coûts mensuels

| Poste | Coût |
|-------|------|
| Serveur (Fly.io ou VPS) | ~5 € |
| Sauvegarde (Backblaze B2) | 0 € (< 10 Go) |
| E-mails (Brevo/Resend, offre gratuite) | 0 € |
| Nom de domaine | ~1 €/mois (12 €/an) |
| **Total** | **~6 €/mois** |

## 8. Risques et parades

| Risque | Parade |
|--------|--------|
| Perte du serveur / du disque | Litestream (réplication continue) + restauration testée régulièrement |
| PocketBase trop limitant à terme | Le schéma est du SQL standard : migration possible vers PostgreSQL + backend Node si besoin (v2 multi-utilisateurs) |
| Montée en charge (si ouverture à d'autres utilisateurs) | SQLite tient sans problème jusqu'à plusieurs milliers d'utilisateurs pour ce profil d'usage |
| E-mails en spam | Domaine dédié + SPF/DKIM configurés dès le départ |
