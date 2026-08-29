# Déploiement

Cible : **Dokploy sur un VPS Hetzner**. Les specs techniques (§2.3, §6, §7) nomment
encore Fly.io ; elles sont périmées sur ce point et seront corrigées avec le reste de
l'étape 8.

L'image est construite **sur le serveur** par Dokploy. Tout ce dont le build a besoin est
donc dans le dépôt : `pb_public/` et `pb_hooks/lib/` sont des artefacts générés et
gitignorés, c'est le `Dockerfile` qui les fabrique.

## Ce que la machine porte

|             |                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Image       | `Dockerfile` à la racine — build multi-étages, binaires épinglés par `.pocketbase-version` et `.litestream-version` |
| Déploiement | `deploy/compose.yml`, en type **Docker Compose** dans Dokploy                                                       |
| Données     | volume nommé `pb_data`, monté sur `/pb/pb_data`                                                                     |
| Réplication | Litestream vers Hetzner Object Storage, en continu                                                                  |

**Le type de déploiement n'est pas indifférent.** Dokploy fait tourner Docker Swarm, dont
l'ordonnanceur raisonne en répliques. SQLite n'admet qu'un seul écrivain : le type
« Application » pourrait en principe en démarrer deux. Le type Compose reste mono-instance
par construction.

**Le volume est un volume nommé, pas un bind mount.** Dokploy efface les chemins hôtes
absolus à chaque déploiement. Un bind mount emporterait la base au _second_ déploiement,
pas au premier — donc le jour où il y a quelque chose à perdre.

## Variables d'environnement

À renseigner dans le panneau d'environnement de Dokploy. **Aucune ne va dans le dépôt :
il est public.**

| Variable                       | Rôle                                                                                                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_DOMAIN`                   | le domaine **nu**, sans schéma : `budget.exemple.com`. C'est sur lui que Traefik associe le `Host`, et c'est ce qui alimente la règle `Host(...)` du routeur.                            |
| `APP_URL`                      | `https://<domaine>`, **avec** le schéma. Le modèle d'e-mail construit son lien de réinitialisation depuis `{APP_URL}` : non renseignée, le mail envoie les utilisateurs sur `localhost`. |
| `SMTP_HOST`                    | `smtp.resend.com`                                                                                                                                                                        |
| `SMTP_PORT`                    | `465` (TLS implicite) ou `587` (STARTTLS)                                                                                                                                                |
| `SMTP_USERNAME`                | `resend`, littéralement — ce n'est pas votre identifiant de compte                                                                                                                       |
| `SMTP_PASSWORD`                | la clé d'API Resend (`re_…`)                                                                                                                                                             |
| `SMTP_SENDER_ADDRESS`          | une adresse **sur un domaine vérifié chez Resend**                                                                                                                                       |
| `SMTP_SENDER_NAME`             | le nom affiché de l'expéditeur                                                                                                                                                           |
| `LITESTREAM_REPLICA_URL`       | `s3://<bucket>/<préfixe>?endpoint=https://fsn1.your-objectstorage.com&region=fsn1` — régions disponibles : `fsn1`, `nbg1`, `hel1`                                                        |
| `LITESTREAM_ACCESS_KEY_ID`     | clé d'accès S3 Hetzner                                                                                                                                                                   |
| `LITESTREAM_SECRET_ACCESS_KEY` | secret associé                                                                                                                                                                           |

Ces réglages sont appliqués par `pb_hooks/apply_env_settings.pb.js` **à chaque démarrage**,
et non par une migration. Raison : PocketBase garde le SMTP en base, pas dans ses options
de ligne de commande. Rejouer la configuration à chaque boot fait de la rotation de la clé
Resend un simple redémarrage au lieu d'un nouveau fichier de migration.

Le hook n'est **pas défensif** : s'il ne peut pas écrire les réglages, le conteneur ne
démarre pas. Une production qui démarre avec la récupération de compte silencieusement
cassée est pire qu'un conteneur que Dokploy affiche en échec.

Sans `APP_URL` ni `SMTP_HOST`, le hook ne fait rien du tout — c'est ce qui laisse le
développement local et les parcours de test configurer PocketBase vers Mailpit.

## Le routage n'est pas automatique

**Un déploiement de type Compose ne reçoit pas les étiquettes Traefik que Dokploy injecte
pour son type « Application ».** Le routeur est déclaré dans `deploy/compose.yml`, et le
conteneur doit rejoindre le réseau externe `dokploy-network` pour être joignable du tout.

Mesuré au premier déploiement réel, le 29/08/2026 : sans les deux, le domaine résolvait, le
TLS se terminait, et **chaque requête recevait le 404 par défaut de Traefik** — 19 octets de
`text/plain`, qu'on distingue de celui de PocketBase, lequel répond du JSON. Un 502 aurait
signifié un conteneur mort ; un 404 signifie qu'aucune route n'existe.

Renseigner le domaine dans l'interface de Dokploy ne suffit donc pas : c'est `APP_DOMAIN`
qui alimente la règle `Host(...)`.

Aucun middleware n'est nommé dans les étiquettes. En référencer un qui n'existe pas met le
routeur en erreur et fait retomber le HTTP en 404 — ce qui casse le défi ACME et, derrière
un proxy qui parle en clair à l'origine, casse le site. La redirection vers HTTPS appartient
à ce qui est devant, ou à la configuration globale de Traefik.

## Restauration

**La restauration est le chemin de démarrage ordinaire, pas une procédure spéciale.**
`deploy/entrypoint.sh` lance `litestream restore -if-db-not-exists -if-replica-exists`
avant de servir : une machine qui démarre sur un volume vide va rechercher la base sur le bucket.
Elle est donc exercée à chaque redéploiement sur volume neuf, et pas seulement le jour où
elle sert.

Restauration manuelle, vers un fichier de côté :

```bash
docker compose -f deploy/compose.yml exec app \
  litestream restore -o /tmp/verification.db "$LITESTREAM_REPLICA_URL"

docker compose -f deploy/compose.yml exec app \
  pocketbase serve --dir=/tmp --http=127.0.0.1:8091   # inspection hors production
```

Pour remonter à un instant précis, ajouter `-timestamp 2026-08-29T06:00:00Z`.

### Dernier exercice de restauration

> **Jamais exécuté.** La procédure ci-dessus est écrite mais **n'a pas encore tourné contre
> un vrai bucket** : les accès n'existent pas au 29/08/2026. Tant que cette ligne n'est
> pas datée, la sauvegarde de ce projet n'existe pas. C'est un critère de la DoD de
> l'étape 8, pas une formalité.

À rejouer **une fois par trimestre**, et à redater ici à chaque fois.

## Ce que cette sauvegarde ne couvre pas

Le bucket est chez **le même fournisseur que le serveur**, choisi ainsi le 29/08/2026 pour
garder le trafic de réplication à l'intérieur du datacentre. Litestream protège donc
toujours de la perte du disque et de la machine — l'object storage est un service distinct
et répliqué — mais **plus de la perte du compte** : une suspension Hetzner emporterait le
serveur et la sauvegarde ensemble.

La parade, si le cas doit être couvert, est une copie mensuelle du dernier instantané chez
un autre fournisseur. Ce n'est pas un second Litestream : deux réplications concurrentes
sur la même base se marchent dessus.

## Notes d'exploitation

- **Litestream lance PocketBase**, il ne tourne pas à côté (`litestream replicate -exec`).
  Un sidecar peut mourir en silence et laisser la base servir sans réplication — la pire
  panne possible pour une sauvegarde, puisque rien n'a l'air anormal jusqu'à la
  restauration.
- **Seul `data.db` est répliqué.** `auxiliary.db` ne porte que les journaux de requêtes :
  aucune valeur dans une restauration, et une amplification d'écriture inutile.
- **Le build consomme la machine.** `pnpm install` puis le bundle Vite constituent le pic
  de mémoire le plus élevé que ce serveur connaîtra, et il survient pendant que PocketBase
  sert. Sur 4 Go partagés avec le Postgres, le Redis et le Traefik de Dokploy, prévoir du
  swap.
- Dokploy occupe les ports 80, 443 et 3000, et installe Docker lui-même.

## Reste à faire pour clore l'étape 8

- Domaine et DNS, puis premier déploiement.
- Exercice de restauration réel, et datation de la section ci-dessus.
- Export RGPD et suppression de compte (`USR-04`). **Défaut connu** : la suppression échoue
  aujourd'hui en HTTP 400, `transactions.account` étant une relation non cascadante qui
  retient le compte (mesuré le 19/08/2026).
- Interface d'administration sur URL protégée.
- Supervision UptimeRobot.
