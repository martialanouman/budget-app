# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du dépôt

Étape 0 du plan livrée : le scaffolding (workspace pnpm, frontend Vite/React, Vitest, lint, CI) est en place. **Aucune fonctionnalité métier n'existe encore** — pas de PocketBase, pas de collections, pas d'écran applicatif. La prochaine étape est le socle PocketBase et l'authentification.

Les deux documents de référence, à lire avant toute décision d'implémentation :

- `docs/specs-fonctionnelles-budget.md` — exigences numérotées par module (`CPT-*`, `TRX-*`, `CAT-*`, `BUD-*`, `DET-*`, `EPG-*`, `RAP-*`, `NOT-*`, `USR-*`), parcours utilisateur, priorisation MVP → v2.
- `docs/specs-techniques-budget.md` — stack, schéma des collections PocketBase, hooks serveur, déploiement.

Référencer les codes d'exigence (ex. `BUD-04`) dans les commits et les PR : c'est la traçabilité prévue entre le code et les specs.

## Architecture cible

Deux blocs, **un seul déploiement** :

- **Frontend** : SPA React 19 + TypeScript, build Vite, installable en PWA. Servie en statique par PocketBase depuis `pb_public/` — donc **pas de CORS et pas de serveur frontend séparé**.
- **Backend** : PocketBase (binaire Go unique) fournissant SQLite, l'auth e-mail/mot de passe, l'API REST/Realtime et l'admin. La logique métier serveur s'écrit en hooks JS dans `pb_hooks/`.
- **Sauvegarde** : Litestream réplique en continu le fichier SQLite vers Backblaze B2 / S3.

Layout du monorepo : `frontend/` (existe), `packages/domain/` (existe), puis `pb_hooks/`, `pb_migrations/` et `deploy/` à venir.

`packages/domain` étend le layout des specs : il porte les calculs financiers en TypeScript pur, sans dépendance à React ni à PocketBase, pour être partagé entre le frontend et les hooks serveur (compilé en CommonJS vers `pb_hooks/lib/` à partir de l'étape 2). Les hooks se limitent à l'orchestration.

### Répartition client / serveur

Cette frontière est une décision d'architecture, pas un détail :

- **Côté serveur (hooks PocketBase)** : mise à jour de `debts.remaining_amount` sur création/modification/suppression d'un `debt_payment`, génération des transactions récurrentes (cron quotidien 06:00), notifications d'échéance J-3/J-1/J, alertes de dépassement de budget à 80 % / 100 %, reports `carry_over` et clôture mensuelle (cron le 1er), envoi des e-mails.
- **Côté client (calcul pur)** : simulateurs de remboursement anticipé et comparaison « boule de neige » vs « avalanche ». Aucun aller-retour serveur.

### Soldes et cumuls

Les soldes de comptes et les cumuls budgétaires sont **calculés à la volée** (somme des transactions), jamais stockés dénormalisés. Les index SQLite `(user, account, date)` et `(user, category, date)` portent cette approche. Ne pas introduire de colonne de solde matérialisée sans revenir sur cette décision.

## Conventions non négociables

- **Code intégralement en anglais** : identifiants, noms de fichiers, noms de tests, champs de collections, messages de commit. Seul le texte affiché à l'utilisateur est en français.
- **Commentaires parcimonieux** : on commente le _pourquoi_ d'une décision non évidente, jamais le _quoi_. Un commentaire qui paraphrase le code est supprimé.
- **Versions de librairies** : toujours vérifiées via `ctx7` (doc) et le registre npm (version publiée) avant installation, jamais de mémoire. Les versions des specs datent du 09/08/2026 et servent de plancher, pas de vérité.
- **Montants : entiers XOF, sans décimales.** Aucun flottant pour un montant, nulle part — ni en base, ni en TypeScript, ni dans les calculs de simulateur. Affichage via `Intl.NumberFormat('fr-FR', { currency: 'XOF' })` → `150 000 F CFA` (séparateur de milliers : une espace insécable, voir la section Tests).
- **Isolation par utilisateur** : toute collection PocketBase porte un champ `user` (relation vers `users`) et des règles d'accès `user = @request.auth.id`. Une nouvelle collection sans cette règle est un bug de sécurité.
- **Mois budgétaire = mois calendaire**, du 1er au dernier jour, non paramétrable en v1. Les budgets sont clés par `month` au format texte `YYYY-MM`.
- **Langue** : interface en français uniquement en v1 (`date-fns` en locale `fr`).
- **Mobile-first** : la cible principale est le mobile ; tablette et desktop suivent. Objectif de saisie d'une transaction : moins de 10 secondes (`TRX-01`).
- **Accessibilité** : WCAG AA visé (contrastes, navigation clavier, libellés de formulaires explicites).

## Tests

Deux niveaux, sans couche intermédiaire de tests de composants.

- `packages/domain/**/*.test.ts` — projet Vitest `domain`, en node. Uniquement les règles métier à risque financier : arithmétique XOF, échéanciers, répartition capital/intérêts, seuils de budget. Style BDD : `describe` porte le contexte (« Given… »), `it` porte le comportement observable.
- `frontend/**/*.journey.tsx` — projet Vitest `journeys`, en browser mode chromium via `vitest-browser-react`. L'application réelle est montée contre une instance PocketBase de test, **sans mock du SDK** : ces parcours couvrent aussi les règles d'accès et les hooks serveur. `render()` est asynchrone, il faut l'`await`.

On n'écrit pas : tests de composants de présentation, snapshots, tests de getters, ni tests qui mockent la couche qu'ils prétendent vérifier. Un test qui ne peut pas échouer sur une régression métier réelle n'a pas sa place.

Piège vérifié : `Intl` formate les montants XOF avec des espaces insécables (U+202F, U+00A0) dont les points de code dépendent de la version d'ICU embarquée dans Node. Les assertions de format utilisent `\s`, jamais un espace littéral.

## Authentification

- PocketBase **fournit déjà** une collection `users` dont les règles d'accès sont `id = @request.auth.id`. La migration `pb_migrations/1786404350_extend_users_collection.js` ne fait qu'ajouter `settings` et relever le plancher de mot de passe de 8 à 10 (specs §5). Ne pas recréer cette collection.
- Le routage est **par code** (`frontend/src/router.tsx`), pas par fichiers : à l'échelle prévue, le plugin et le `routeTree.gen.ts` ne s'amortissent pas. `createAppRouter(history?)` accepte un historique mémoire, ce dont les parcours se servent.
- La garde d'accès lit `pb.authStore.isValid` directement dans `beforeLoad`, sans passer par le contexte du router — une source de vérité unique, pas de synchronisation à tenir. Comme `beforeLoad` ne se rejoue qu'à la navigation, `AppRouterProvider` invalide le router à chaque changement de l'authStore : monter `RouterProvider` en direct rouvrirait le trou (session vidée dans un autre onglet, jeton expiré).
- `confirmPasswordReset` vide l'authStore après succès : PocketBase fait tourner le `tokenKey` au changement de mot de passe, donc la session locale est morte côté serveur tout en paraissant valide à la garde.
- Le client PocketBase pointe sur `VITE_POCKETBASE_URL`, avec `/` par défaut : en production PocketBase sert lui-même la SPA, donc même origine.
- Le modèle d'e-mail de réinitialisation est **remplacé par migration** : celui de PocketBase renvoie vers son interface admin (`{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}`), pas vers la SPA. Toute nouvelle collection auth aura le même défaut à corriger.
- **Le SMTP de production reste à configurer** (Brevo ou Resend, cf. specs §2.2). Sans lui, la réinitialisation de mot de passe ne fonctionne pas en production.

## Domaine partagé et moteur goja

`packages/domain` a **deux points d'entrée**, et la distinction n'est pas cosmétique :

- `src/index.ts` — tout, pour le frontend.
- `src/server.ts` — uniquement ce qui tourne sous PocketBase. C'est lui qu'on bundle.

**Le moteur goja n'a pas `Intl` du tout** (`ReferenceError: Intl is not defined`), et son `Number.prototype.toLocaleString` lit son argument comme un radix de `toString` : `(150000).toLocaleString('fr-FR')` lève une `RangeError`. Aucun formatage localisé n'est donc possible côté serveur. `src/format.ts` construit son `Intl.NumberFormat` au chargement du module : **l'ajouter à `server.ts` ferait planter les hooks au démarrage**. Quand un montant devra figurer dans un e-mail (étape 6), il faudra un formateur maison, testé.

Ce que goja accepte, vérifié à l'exécution : `class`, `const`, fonctions fléchées, `Number.isInteger`. Le bundle cible donc **es2015**, pas l'`es5` annoncé par la doc — esbuild ne sait de toute façon pas abaisser `const` ni `class` jusqu'à es5.

`pnpm domain:build` produit `pb_hooks/lib/domain.cjs` (CommonJS, es2015, fichier unique). L'extension `.cjs` est nécessaire : le `package.json` racine déclare `"type": "module"`, et l'outillage lirait sinon ce bundle comme de l'ESM. Les hooks l'importent par `require(`${__hooks}/lib/domain.cjs`)` — les chemins relatifs se résolvent depuis le répertoire courant, jamais depuis `pb_hooks`.

L'artefact est **généré et gitignoré**. `pnpm test` le reconstruit via `pretest`, et le harnais refuse de démarrer avec un message explicite s'il manque.

## Contraintes d'outillage

- **TypeScript est figé en 6.0.3**, alors que 7.0.2 (réécriture Go) est le `latest`. Raison : typescript-eslint 8.67 déclare `typescript: >=4.8.4 <6.1.0` et ne supporte pas encore TS 7. Monter TS 7 signifierait perdre le lint type-aware. À réévaluer quand typescript-eslint suivra.
- `allowImportingTsExtensions` est activé : les imports portent leur extension (`./currency.ts`). Le build passe par Vite, jamais par `tsc`.
- Prettier ignore `docs/` : la mise en forme des specs est rédigée à la main, pas générée.

## Modèles de données particuliers

Trois relations dans `transactions` méritent attention car elles encodent des cas métier distincts :

- `transfer_ref` — virement entre comptes : une seule opération saisie, débit + crédit liés, **qui ne compte pas comme une dépense** dans les budgets et rapports (`CPT-05`).
- `split_parent` — transaction scindée sur plusieurs catégories (`TRX-08`).
- `recurring_rule` — transaction générée par une règle récurrente.

Les `debts` ont une `direction` (`je_dois` / `on_me_doit`) : le module gère aussi l'argent qu'on doit à l'utilisateur (`DET-02`). Le taux d'intérêt est facultatif (dettes informelles, tontines) mais les échéanciers avec intérêts sont pleinement supportés.

## Versions figées

Les versions du tableau `docs/specs-techniques-budget.md` §2 ont été vérifiées au 09/08/2026 et font foi. Points de vigilance :

- **PocketBase est en pré-1.0** (0.39.3) : figer la version en production, lire les notes de migration avant toute montée.
- **Litestream 0.5+** utilise le format LTX — ignorer les tutoriels 0.3.
- **Tailwind 4** se configure en CSS, il n'y a plus de `tailwind.config.js`.

## Commandes

Toutes se lancent depuis la racine ; le workspace est géré par pnpm.

```bash
pnpm install            # requiert Node >= 24
pnpm services:install   # récupère les binaires épinglés PocketBase et Mailpit dans bin/
pnpm pb:dev             # démarre PocketBase sur 127.0.0.1:8090
pnpm mailpit:dev        # boîte SMTP locale : SMTP 1025, interface 8025
pnpm dev                # serveur de développement Vite
pnpm domain:build       # bundle du domaine vers pb_hooks/lib/domain.cjs
pnpm build              # domaine puis frontend vers pb_public/
pnpm typecheck          # tsc --noEmit sur chaque paquet, en parallèle
pnpm lint               # ESLint, avec règles type-aware
pnpm format             # vérification Prettier (format:write pour corriger)
pnpm test               # les deux projets Vitest
pnpm test:domain        # scénarios métier seuls (rapides, node)
pnpm test:journeys      # parcours navigateur seuls (chromium)
```

Pour un seul scénario : `pnpm test:domain -t "formats it as whole francs"`.

Le browser mode exige chromium, à installer une fois :
`pnpm --filter @budget/frontend exec playwright install chromium`.

Les parcours démarrent eux-mêmes leurs services (`frontend/test/global-setup.ts`, en
`globalSetup`), avec un `pb_data` temporaire supprimé en fin de run — d'où le prérequis
`pnpm services:install`. Ports dédiés pour ne pas percuter le dev : PocketBase **8091**,
Mailpit SMTP **1026** et interface **8026** (contre 8090 / 1025 / 8025 en développement).

Le harnais assemble le répertoire de hooks dans un temporaire : `pb_hooks/` de production
**plus** les sondes de test de `frontend/test/pb_hooks/`. Les vrais hooks sont donc chargés
par les parcours, et les sondes ne partent jamais en production.

Le SMTP de PocketBase vit en base, pas en ligne de commande : le `globalSetup` crée un
superuser puis pointe les réglages vers Mailpit via `PATCH /api/settings`.

À venir avec les étapes suivantes : démarrage de PocketBase en local, `fly deploy`, et `litestream restore` (à tester une fois par trimestre).
