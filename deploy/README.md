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
| Réplication | Litestream vers Backblaze B2, en continu                                                                            |

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

| Variable                       | Rôle                                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                      | `https://<domaine>`. Le modèle d'e-mail construit son lien de réinitialisation depuis `{APP_URL}` : non renseignée, le mail envoie les utilisateurs sur `localhost`. |
| `SMTP_HOST`                    | `smtp.resend.com`                                                                                                                                                    |
| `SMTP_PORT`                    | `465` (TLS implicite) ou `587` (STARTTLS)                                                                                                                            |
| `SMTP_USERNAME`                | `resend`, littéralement — ce n'est pas votre identifiant de compte                                                                                                   |
| `SMTP_PASSWORD`                | la clé d'API Resend (`re_…`)                                                                                                                                         |
| `SMTP_SENDER_ADDRESS`          | une adresse **sur un domaine vérifié chez Resend**                                                                                                                   |
| `SMTP_SENDER_NAME`             | le nom affiché de l'expéditeur                                                                                                                                       |
| `LITESTREAM_REPLICA_URL`       | `s3://<bucket>/<préfixe>?endpoint=<endpoint B2>&region=<région B2>`                                                                                                  |
| `LITESTREAM_ACCESS_KEY_ID`     | clé d'application B2                                                                                                                                                 |
| `LITESTREAM_SECRET_ACCESS_KEY` | secret associé                                                                                                                                                       |

Ces réglages sont appliqués par `pb_hooks/apply_env_settings.pb.js` **à chaque démarrage**,
et non par une migration. Raison : PocketBase garde le SMTP en base, pas dans ses options
de ligne de commande. Rejouer la configuration à chaque boot fait de la rotation de la clé
Resend un simple redémarrage au lieu d'un nouveau fichier de migration.

Le hook n'est **pas défensif** : s'il ne peut pas écrire les réglages, le conteneur ne
démarre pas. Une production qui démarre avec la récupération de compte silencieusement
cassée est pire qu'un conteneur que Dokploy affiche en échec.

Sans `APP_URL` ni `SMTP_HOST`, le hook ne fait rien du tout — c'est ce qui laisse le
développement local et les parcours de test configurer PocketBase vers Mailpit.

## Restauration

**La restauration est le chemin de démarrage ordinaire, pas une procédure spéciale.**
`deploy/entrypoint.sh` lance `litestream restore -if-db-not-exists -if-replica-exists`
avant de servir : une machine qui démarre sur un volume vide va rechercher la base sur B2.
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
> un vrai bucket B2** : les accès n'existent pas au 29/08/2026. Tant que cette ligne n'est
> pas datée, la sauvegarde de ce projet n'existe pas. C'est un critère de la DoD de
> l'étape 8, pas une formalité.

À rejouer **une fois par trimestre**, et à redater ici à chaque fois.

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
