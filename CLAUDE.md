# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du dépôt

Étapes 0 à 7 du plan livrées : outillage et CI ; authentification complète (inscription, connexion, réinitialisation vérifiée via Mailpit) ; noyau monétaire XOF partagé et exécuté par le moteur de PocketBase ; comptes, catégories et soldes calculés ; transactions, virements atomiques et scissions ; budgets mensuels avec seuils, alertes, reports et reste à vivre ; dettes avec échéancier, capital rejoué depuis l'historique et rappels J-3/J-1/J ; tableau de bord, centre de notifications et PWA installable. **Prochaine étape : le déploiement** (Fly.io, Litestream vers B2, SMTP de production).

Les deux documents de référence, à lire avant toute décision d'implémentation :

- `docs/specs-fonctionnelles-budget.md` — exigences numérotées par module (`CPT-*`, `TRX-*`, `CAT-*`, `BUD-*`, `DET-*`, `EPG-*`, `RAP-*`, `NOT-*`, `USR-*`), parcours utilisateur, priorisation MVP → v2.
- `docs/specs-techniques-budget.md` — stack, schéma des collections PocketBase, hooks serveur, déploiement.

Référencer les codes d'exigence (ex. `BUD-04`) dans les commits et les PR : c'est la traçabilité prévue entre le code et les specs.

## Architecture cible

Deux blocs, **un seul déploiement** :

- **Frontend** : SPA React 19 + TypeScript, build Vite, installable en PWA. Servie en statique par PocketBase depuis `pb_public/` — donc **pas de CORS et pas de serveur frontend séparé**.
- **Backend** : PocketBase (binaire Go unique) fournissant SQLite, l'auth e-mail/mot de passe, l'API REST/Realtime et l'admin. La logique métier serveur s'écrit en hooks JS dans `pb_hooks/`.
- **Sauvegarde** : Litestream réplique en continu le fichier SQLite vers Backblaze B2 / S3.

Layout du monorepo : `frontend/`, `packages/domain/`, `pb_hooks/` et `pb_migrations/` existent ; `deploy/` viendra avec l'étape 8.

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

Ce que goja accepte, vérifié à l'exécution : `class`, `const`, fonctions fléchées, `Number.isSafeInteger`. Le bundle cible donc **es2015**, pas l'`es5` annoncé par la doc — esbuild ne sait de toute façon pas abaisser `const` ni `class` jusqu'à es5.

Le bundle est en `platform: 'neutral'`, et ce n'est pas indifférent : sous `'node'`, esbuild externalise les modules natifs et émet des `require("node:fs")` que goja ne sait pas résoudre — l'erreur ne surgirait qu'à l'exécution. En `'neutral'`, importer un builtin **échoue au build**.

`pnpm domain:build` produit `pb_hooks/lib/domain.cjs` (CommonJS, es2015, fichier unique). L'extension `.cjs` est nécessaire : le `package.json` racine déclare `"type": "module"`, et l'outillage lirait sinon ce bundle comme de l'ESM. Les hooks l'importent par `require(`${__hooks}/lib/domain.cjs`)` — les chemins relatifs se résolvent depuis le répertoire courant, jamais depuis `pb_hooks`.

L'artefact est **généré et gitignoré**. Le harnais de test le **reconstruit lui-même** à chaque exécution (`buildDomain()` depuis `@budget/domain/build`) : s'en remettre à un hook `pretest` ne couvrait que `pnpm test`, et laissait `pnpm test:journeys` valider un bundle périmé en toute discrétion.

**La surface de `server.ts` est vérifiée par un test.** Les hooks appellent ce bundle depuis goja, sans types : une fonction absente du point d'entrée n'est une erreur de compilation nulle part, c'est un HTTP 400 sur ce que l'utilisateur était en train de faire. Mesuré une fois — un remboursement refusé parce que `splitPayment` n'avait jamais été exporté, pendant que tous les tests du domaine restaient verts en important le module directement.

**La marque `Money` disparaît à la compilation.** Les hooks appellent ce code depuis goja, sans types : toute fonction publique du domaine doit revalider ses entrées plutôt que se fier à sa signature.

**Chaque handler de hook est sérialisé et exécuté comme un programme isolé.** Il ne voit _rien_ de la portée du fichier : une `const` déclarée au-dessus de `onRecordAfterCreateSuccess(...)` y sera `undefined`, et l'erreur ne se manifeste qu'à l'exécution du hook, pas au démarrage. Les constantes vont donc dans le handler, et le code partagé passe par un `require()` **à l'intérieur** du handler.

## Comptes et catégories

- `accounts.initial_balance` est déclaré `onlyInt` : PocketBase refuse un montant fractionnaire en HTTP 400. L'invariant XOF tient jusqu'au stockage, pas seulement dans le domaine. Tout futur champ monétaire doit faire de même.
- Rien ne se supprime : un compte s'archive (`archived`), une catégorie se désactive (`active`). L'historique des transactions doit rester rattachable.
- `account_balances` est une view collection, qui somme désormais les transactions.
- Les mutations de comptes invalident aussi `['account-balances']` : le solde est dérivé côté serveur et aucun canal realtime ne le pousse.

## Transactions, virements et scissions

- **Montants toujours positifs** ; `type` porte le sens. Une colonne signée laisserait une « dépense » de -5000 signifier un revenu, et chaque agrégat devrait s'en prémunir.
- Un virement s'écrit en **deux lignes** de types `virement_sortant` et `virement_entrant`, reliées par `transfer_group`. Écart assumé au schéma des specs, qui prévoyait un unique `virement` : la view a besoin du sens pour choisir le signe, et deux valeurs explicites évitent un second champ conditionnel.
- Une transaction scindée est **plusieurs lignes ordinaires** partageant `split_group`. Chacune compte une fois partout — soldes, budgets, rapports — donc une seule règle d'agrégat, pas deux opposées.
- **La paire d'un virement se tient après l'écriture, pas seulement pendant.** La route ne garantissait l'atomicité qu'à la création : supprimer une seule jambe faisait passer le total des soldes de 170 000 à 200 000, par le bouton « Supprimer » ordinaire. `pb_hooks/keep_transfer_pairs.pb.js` fait tomber les deux ensemble — la boucle ne se referme pas parce que le partenaire n'est cherché qu'**après** `e.next()`, donc la seconde jambe ne trouve plus rien. Et la `updateRule` exclut désormais toute ligne portant un `transfer_group` : une jambe ne se modifie pas seule, un `PATCH` du `type` inventait 60 000 F.
- **Une seule écriture TypeScript de la règle « quels types créditent un solde »** : `isCredit()` dans `collections.ts`, utilisée pour le signe _et_ pour la couleur. La copie SQL dans la view `account_balances` est irréductible — SQLite ne peut pas l'appeler — donc tout changement se porte aux deux endroits, et nulle part ailleurs.
- **Virements et scissions passent par une route serveur** (`pb_hooks/transfers.pb.js`, `splits.pb.js`) qui écrit dans une seule transaction SQLite. Deux écritures client laisseraient un débit sans crédit sur une coupure. Ne pas contourner ces routes depuis le frontend.
- `pb_hooks/guard_owned_relations.pb.js` vérifie la propriété des relations **à la création comme à la mise à jour**, pour `transactions` _et_ `budgets` : PocketBase n'applique `account.user = @request.auth.id` qu'à la création. Le trou a été mesuré deux fois — un `PATCH` déplaçait une transaction sur le compte d'un tiers (étape 4), puis une enveloppe sur la catégorie d'un tiers (étape 5). **Toute nouvelle collection portant une relation vers un autre enregistrement du propriétaire passe par ce fichier.**
- Un formulaire dont un `<select>` démarre sur une valeur sans option correspondante **ne peut pas être soumis** : le navigateur affiche la première option sans émettre d'événement, et la valeur du formulaire reste vide. Les formulaires ne sont montés qu'une fois leurs options connues. Un parcours qui appelle toujours `selectOptions()` ne verra jamais ce défaut.
- Les routes convertissent toute entrée invalide en 400, y compris les identifiants inconnus : un `findRecordById` non encadré répondait 404 sur un POST, ce qui se lit « cette route n'existe pas ». Le message ne distingue pas l'inconnu de l'étranger, sans quoi il dirait si un identifiant existe.
- **La suppression d'un compte utilisateur échoue déjà** (HTTP 400, `Failed to delete record`), indépendamment des virements : `transactions.account` est une relation non cascadante et retient le compte. Mesuré au 19/08/2026 ; à traiter avec USR-04 à l'étape 8.
- `created` et `updated` ne sont plus implicites depuis PocketBase 0.23 : toute collection qui doit être triée par ordre d'insertion doit les déclarer explicitement.

## Budgets, seuils et reports

- **Une enveloppe par catégorie et par mois**, `month` en texte `YYYY-MM`, avec un index unique `(user, month, category)` : une seconde enveloppe couperait le plafond en deux et tous les totaux mentiraient.
- **`carried_amount` vit à côté de `cap_amount`, jamais dedans.** L'utilisateur doit continuer à voir le plafond qu'il a choisi, et une valeur absolue rend le report rejouable sans se cumuler.
- Le report a **deux moments**, pas un : le cron du 1er couvre les enveloppes déjà là, et `onRecordAfterCreateSuccess(budgets)` couvre les autres. Sans ce second chemin, un mois dupliqué le 3 ne recevrait jamais le report appliqué le 1er. Les deux appellent `pb_hooks/jobs/carry_over.js` — un module requis par les handlers, pas un hook : PocketBase ne charge que les `*.pb.js`.
- **L'alerte est une réconciliation, pas une réaction.** `pb_hooks/jobs/budget_alerts.js` ne demande jamais « que vient-il de se passer » mais « quels seuils cette enveloppe atteint-elle maintenant » : il crée ce qui manque et retire les alertes non lues qui ne se justifient plus. Branché sur la création, la mise à jour **et** la suppression d'une transaction — la seule création laissait une dépense corrigée à la hausse sans alerte, et laissait pour toujours l'alerte d'une dépense supprimée, la déduplication interdisant de la reproduire. Une alerte déjà écartée par l'utilisateur reste : c'est de l'historique.
- Une notification porte un **`subject` textuel indexé** (`YYYY-MM@categoryId`). Dédupliquer sur le `payload` obligeait à relire toutes les notifications de l'utilisateur à chaque saisie, un filtre sur un chemin JSON ne ramenant rien.
- **`carried_amount` est écrit par le serveur, dans `onRecordCreate`, après avoir été remis à zéro.** Il était réglable par le client : un plafond de 1 franc avec un report de 5 000 000 était accepté tel quel, et l'enveloppe ne déclenchait plus jamais de seuil.
- **Le « reste à vivre » ne suit pas la formule des specs à la lettre.** « Revenus − charges fixes − échéances − dépenses réalisées » compte deux fois une charge fixe déjà payée. Seule la part **non encore payée** des enveloppes fixes est déduite, sinon payer son loyer ferait baisser le reste à vivre deux fois. **Les échéances de dettes suivent exactement la même règle** (`unpaidInstalment`) : la mensualité moins ce qui a déjà été remboursé ce mois-ci, plafonnée à ce qui reste dû, et rien pour l'argent qu'on doit à l'utilisateur. Le terme est resté à zéro entre les étapes 5 et 7 — un commentaire annonçait qu'il rejoindrait le calcul au tableau de bord, où il n'a rejoint personne, et une mensualité de 90 000 F CFA était affichée comme disponible.
- **PocketBase ne sait pas typer un agrégat dans une view** : un `SUM()` non casté revient comme valeur JSON et `getInt()` y lit 0 — mesuré, le hook d'alerte ne se déclenchait jamais. Toute colonne calculée d'une view porte un `CAST(... AS INT)`.
- **Un champ `json` relu depuis un enregistrement n'est pas un objet JS** : `payload.month` y vaut `undefined`, et un filtre sur un chemin JSON (`payload.month = {:month}`) ne ramène rien. Passer par `JSON.parse(String(...))` et comparer en JavaScript.
- **Une erreur levée dans `onRecordAfterCreateSuccess` revient au client en HTTP 400 sur l'enregistrement lui-même** — mesuré. Tout hook accessoire (alerte, report) enveloppe donc son corps dans un `try/catch` qui journalise : une notification impossible ne doit jamais coûter à l'utilisateur la saisie qu'il vient de faire.

## Dettes et échéanciers

- **La mensualité est une donnée, pas un résultat** (`DET-01`) : l'utilisateur dit ce qu'il paie chaque mois, donc le nombre d'échéances tombe des termes, et la dernière est la petite — jamais la grosse. Réclamer plus que ce qui reste dû prendrait un argent que l'emprunteur ne doit pas.
- **La propriété tenue par les tests n'est pas le détail des échéances mais leur somme** : les parts de capital rendent exactement ce qui a été emprunté, quel que soit l'arrondi mensuel, y compris sur une centaine d'échéances.
- **Un taux n'est pas un montant.** `interest_rate` est le seul nombre décimal du schéma : 7,5 % est banal. Chaque franc qu'il produit est arrondi à l'entier immédiatement.
- **`debts.remaining_amount` est stocké, contre la règle du projet sur les cumuls dérivés.** L'exception est bornée et tient à une condition : ce champ n'est **jamais ajusté**, il est **rejoué** depuis l'historique complet des remboursements à chaque écriture (`pb_hooks/jobs/debt_balance.js`). Décrémenter puis ré-incrémenter serait le choix évident et le mauvais : corriger un remboursement ancien change ce que tous les suivants ont remboursé, leurs intérêts ayant été calculés sur un capital qui vient de bouger. Vérifié discriminant : remplacer le rejeu par un cumul rend le test de suppression rouge.
- Les hooks de remboursement tournent **dans** l'écriture (`onRecordCreate`, pas `AfterCreateSuccess`) : un rejeu qui échoue doit emporter l'écriture, et la ventilation appartient à la réponse rendue au client.
- **Le rejeu est autoritaire, jamais défensif.** Le hook de mise à jour d'une dette laisse l'écriture passer puis réécrit `remaining_amount` et `status` depuis l'historique. Rétablir la valeur d'avant, au lieu de recalculer, défait l'écriture du rejeu lui-même et boucle à l'infini — mesuré.
- **Le rejeu s'arrête quand la dette a disparu.** Supprimer une dette cascade vers ses remboursements, dont chacun déclenche un rejeu : recharger la dette y levait, et une dette portant le moindre remboursement devenait indestructible.
- **Le rejeu relit chaque remboursement avant de le comparer.** L'enregistrer déclenche le hook qui rejoue tout ; sans relecture, la boucle appelante comparait des copies antérieures à ce rejeu imbriqué et les réenregistrait toutes. Mesuré à 24 échéances : 249 ms contre 68 ms après correction ; à 50 : 1098 ms contre 214 ms. Non couvert par un test — une assertion de temps ne peut pas être à la fois stable en CI et discriminante ici.
- Les rappels d'échéance sont clés par `(date, dette, décalage)` dans le `subject` : c'est ce qui rend le cron quotidien rejouable après une panne sans sonner deux fois.
- Un rappel ne précède jamais la première échéance de l'échéancier affiché : les deux lectures du même calendrier se contredisaient pour une dette ouverte le jour même.
- **Les notifications d'échéance n'ont pas encore d'écran.** Le cron les produit, le panneau des budgets ne montre que les dépassements. Le centre de notifications est prévu à l'étape 7.

## Tableau de bord et PWA

- **La répartition des dépenses est une liste de barres classées, pas un camembert.** Un camembert demande de comparer des angles — la comparaison la plus difficile qui soit —, exige de toute façon une alternative textuelle pour WCAG, et coûte une dépendance de graphiques. Les courbes sur douze mois de `RAP-02` sont hors périmètre v1 ; c'est là qu'une librairie de graphiques gagnera sa place, pas ici.
- **Les figures du mois vivent dans `frontend/src/budgets/month-figures.ts`**, partagées par l'écran des budgets et le tableau de bord : les deux ne peuvent pas se contredire sur le même mois.
- **Une seule formulation par notification** (`frontend/src/home/notification-centre.tsx`), quel que soit l'écran qui l'affiche.
- **Les icônes de lancement sont dessinées par `frontend/scripts/make-icons.mjs`**, pas déposées en binaire opaque : `pnpm icons:build` les régénère, et la source des pixels est lisible.
- Le service worker est **désactivé pendant les parcours** (`disable: process.env.VITEST === 'true'`) : il servirait le build d'un test au suivant.
- **Aucun chiffre n'est affiché avant d'avoir été lu.** Les trois totaux du tableau de bord valent `—` tant que leurs requêtes n'ont pas abouti, et `budgeted === 0` ne devient « Aucune enveloppe définie » qu'une fois les enveloppes chargées. La première version affichait un `0` assuré pendant le chargement comme après un échec — sur les nombres mêmes qui décident d'une dépense. Le parcours tient la propriété par la négative : jamais de « 0 F CFA » quand la session est refusée.
- **Le solde total ne compte que les comptes ouverts** (`CPT-04`) : un compte archivé ne peut plus ni être débité ni recevoir de virement. Et un solde que le client n'a pas su relire rend le total inconnu, jamais nul — l'absorber en zéro le sous-estimerait en silence.
- **Le service worker n'attrape ni `/api/` ni `/_/`** (`navigateFallbackDenylist`). PocketBase sert la SPA, son API et sa console d'administration sur une seule origine : sans ces exclusions, le premier navigateur ayant ouvert l'application reçoit la coquille précachée à la place de la console. Vérifié dans le `sw.js` généré, pas dans la configuration.
- **Une notification se formule à la lecture, pas à l'écriture.** Le rappel est écrit le matin où le cron passe ; relu deux jours plus tard, il annonçait toujours « dans 3 jours ». Le compte à rebours se recalcule depuis `dueDate` à l'affichage, et `wordingOf` prend un `today` pour que le parcours puisse le fixer.
- **Le rappel le plus proche retire le précédent.** Les trois décalages J-3/J-1/J empilaient trois cartes le jour de l'échéance. Le cron marque comme lus les rappels non lus de décalage supérieur pour la même paire (date, dette) : la carte restante est la seule à jour, les autres restent en historique.
- **`wordingOf` rend `undefined` plutôt qu'un libellé creux**, et le centre écarte alors la ligne : une carte disant « Notification » n'apprend rien et demande quand même à être écartée. C'est aussi ce qui permet aux rappels d'échéance de s'afficher quand les catégories, elles, n'ont pas pu être lues — seules les alertes de budget en dépendent.
- **L'installabilité réelle ne peut pas être vérifiée avant le déploiement** : un service worker exige HTTPS. Ce qui est vérifié ici, c'est que le manifeste, le worker et les icônes sont servis avec les bons types. Le test sur appareil appartient à l'étape 8.

## Performance et accessibilité, mesurées

- **Le tableau de bord répond en 74 ms sur 5 000 entrées réparties sur trois ans**, contre les 2 s que le plan exige (`frontend/src/home/dashboard-load.journey.tsx`). La marge est ce qui dit que l'agrégation est restée dans SQLite ; le jour où un total se calcule côté client, ce test rougit.
- **Une mesure qui n'attend pas les bonnes choses ne mesure rien** : la première version attendait des titres statiques, présents avant la moindre requête, et annonçait 23 ms. Une assertion de performance doit porter sur une valeur, jamais sur un libellé.
- **L'audit WCAG AA est exécuté, pas inspecté** (`axe-core`, sur le tableau de bord et le formulaire de saisie). Vérifié discriminant sur une image sans alternative textuelle. **Vérifié non discriminant sur le contraste** : axe range le contraste en « incomplet » quand il ne peut pas résoudre le fond avec certitude, donc un paragraphe volontairement illisible n'a pas été signalé.
- **Le contraste n'est donc couvert par aucun test.** Les rapports mesurés à la main le 27/08/2026 — slate-600 sur slate-50 à 7,2:1, amber-700 à 4,6:1, red-700 à 5,9:1, contre les 4,5:1 exigés — valent pour la palette de ce jour-là et rien de plus : une couleur ajoutée ou modifiée doit être remesurée à la main, la CI ne le fera pas.

## Requêtes et cache

- **Un 4xx n'est jamais réessayé** (`createQueryClient`). Une lecture refusée répond pareil à la dixième tentative : les trois essais par défaut ne faisaient que retarder de sept secondes l'aveu que le chiffre n'a pas pu être lu. Les pannes réseau et serveur gardent leurs essais.
- **L'auto-annulation du SDK PocketBase est désactivée** (`pb.autoCancellation(false)`). Le SDK annule toute requête en vol dès qu'une autre part sur le même chemin : une liste à l'écran et la lecture qu'une mutation fait avant d'écrire s'annulaient mutuellement. TanStack Query tient déjà ce rôle.
- **L'invalidation a lieu dans `onSettled`, pas `onSuccess`** : une lecture annulée reste sans données et sans requête en cours, donc une écriture en échec laisserait la liste sur « Chargement… » jusqu'à la navigation suivante.
- **Une écriture annule les lectures qu'elle invalide** (`useDerivedMutation`, `frontend/src/lib/mutations.ts`). Une lecture encore en vol au moment de l'écriture résout avec des données d'avant, et TanStack Query la réutilise au lieu d'en lancer une seconde : l'invalidation qui suit est satisfaite par une réponse plus ancienne que l'écriture, et la ligne créée reste invisible. Toute nouvelle mutation passe par ce helper.
- **Les parcours tournent un fichier à la fois** (`fileParallelism: false`). En parallèle ce sont des iframes de même origine, donc un même `localStorage`, et le `LocalAuthStore` de PocketBase suit les connexions faites dans les autres onglets : une connexion d'un fichier atterrissait dans le client d'un autre. Mesuré à un échec sur six ; 8 exécutions vertes en sérialisé, pour une vingtaine de secondes de plus.
- Le harnais laisse passer la **sortie d'erreur de PocketBase** : un hook qui échoue était indiscernable d'un hook qui ne fait rien.
- Formatage des dates : `Intl` suffit pour un nom de mois en français (`frontend/src/lib/dates.ts`). `date-fns` n'entrera que le jour où il faudra vraiment calculer sur des dates.

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
pnpm icons:build        # régénère les icônes PWA depuis leur script
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
