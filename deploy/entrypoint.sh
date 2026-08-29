#!/bin/sh
# PocketBase is started *by* Litestream, not beside it. A sidecar can die
# quietly and leave the database serving with no replication — the worst way a
# backup can fail, because nothing looks wrong until the day of the restore.
set -eu

DB=/pb/pb_data/data.db

set -- pocketbase serve \
  --http=0.0.0.0:8090 \
  --dir=/pb/pb_data \
  --migrationsDir=/pb/pb_migrations \
  --hooksDir=/pb/pb_hooks \
  --publicDir=/pb/pb_public

if [ -z "${LITESTREAM_REPLICA_URL:-}" ]; then
  echo "entrypoint: LITESTREAM_REPLICA_URL is unset — serving with no replication." >&2
  exec "$@"
fi

# A machine that comes up on an empty volume pulls the database back before
# serving. Disaster recovery is therefore the ordinary startup path, exercised
# at every fresh deploy instead of only on the day it is needed.
#
# Only data.db is replicated: auxiliary.db holds request logs, which are not
# worth the write amplification and are of no use in a restore.
litestream restore -if-db-not-exists -if-replica-exists -o "$DB" "$LITESTREAM_REPLICA_URL"

exec litestream replicate -exec "$*" "$DB" "$LITESTREAM_REPLICA_URL"
