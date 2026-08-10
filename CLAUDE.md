# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du dépôt

Projet en phase de spécification : **aucun code n'existe encore**, seulement `docs/`. Il n'y a ni `package.json`, ni dépôt git initialisé, ni commandes de build/test/lint. Cette section (et la section « Commandes » ci-dessous) doit être mise à jour dès que le scaffolding est en place.

Les deux documents de référence, à lire avant toute décision d'implémentation :

- `docs/specs-fonctionnelles-budget.md` — exigences numérotées par module (`CPT-*`, `TRX-*`, `CAT-*`, `BUD-*`, `DET-*`, `EPG-*`, `RAP-*`, `NOT-*`, `USR-*`), parcours utilisateur, priorisation MVP → v2.
- `docs/specs-techniques-budget.md` — stack, schéma des collections PocketBase, hooks serveur, déploiement.

Référencer les codes d'exigence (ex. `BUD-04`) dans les commits et les PR : c'est la traçabilité prévue entre le code et les specs.

## Architecture cible

Deux blocs, **un seul déploiement** :

- **Frontend** : SPA React 19 + TypeScript, build Vite, installable en PWA. Servie en statique par PocketBase depuis `pb_public/` — donc **pas de CORS et pas de serveur frontend séparé**.
- **Backend** : PocketBase (binaire Go unique) fournissant SQLite, l'auth e-mail/mot de passe, l'API REST/Realtime et l'admin. La logique métier serveur s'écrit en hooks JS dans `pb_hooks/`.
- **Sauvegarde** : Litestream réplique en continu le fichier SQLite vers Backblaze B2 / S3.

Layout du monorepo prévu : `/frontend`, `/pb_hooks`, `/pb_migrations`, `/deploy`.

### Répartition client / serveur

Cette frontière est une décision d'architecture, pas un détail :

- **Côté serveur (hooks PocketBase)** : mise à jour de `debts.remaining_amount` sur création/modification/suppression d'un `debt_payment`, génération des transactions récurrentes (cron quotidien 06:00), notifications d'échéance J-3/J-1/J, alertes de dépassement de budget à 80 % / 100 %, reports `carry_over` et clôture mensuelle (cron le 1er), envoi des e-mails.
- **Côté client (calcul pur)** : simulateurs de remboursement anticipé et comparaison « boule de neige » vs « avalanche ». Aucun aller-retour serveur.

### Soldes et cumuls

Les soldes de comptes et les cumuls budgétaires sont **calculés à la volée** (somme des transactions), jamais stockés dénormalisés. Les index SQLite `(user, account, date)` et `(user, category, date)` portent cette approche. Ne pas introduire de colonne de solde matérialisée sans revenir sur cette décision.

## Conventions non négociables

- **Montants : entiers XOF, sans décimales.** Aucun flottant pour un montant, nulle part — ni en base, ni en TypeScript, ni dans les calculs de simulateur. Affichage via `Intl.NumberFormat('fr-FR', { currency: 'XOF' })` → `150 000 F CFA` (séparateur de milliers = espace).
- **Isolation par utilisateur** : toute collection PocketBase porte un champ `user` (relation vers `users`) et des règles d'accès `user = @request.auth.id`. Une nouvelle collection sans cette règle est un bug de sécurité.
- **Mois budgétaire = mois calendaire**, du 1er au dernier jour, non paramétrable en v1. Les budgets sont clés par `month` au format texte `YYYY-MM`.
- **Langue** : interface en français uniquement en v1 (`date-fns` en locale `fr`).
- **Mobile-first** : la cible principale est le mobile ; tablette et desktop suivent. Objectif de saisie d'une transaction : moins de 10 secondes (`TRX-01`).
- **Accessibilité** : WCAG AA visé (contrastes, navigation clavier, libellés de formulaires explicites).

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

Aucune commande de build, lint ou test n'est encore définie. Cibles prévues par les specs :

- Tests : Vitest sur la logique métier frontend (simulateurs de dette, calculs de budget).
- CI/CD : GitHub Actions — build frontend → copie dans `pb_public` → `fly deploy`.
- Restauration de sauvegarde : `litestream restore`, à tester une fois par trimestre.
