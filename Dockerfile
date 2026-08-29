# syntax=docker/dockerfile:1

# Built by Dokploy on the server itself, so everything the build needs has to be
# in the repository. pb_public/ and pb_hooks/lib/ are generated artefacts and are
# gitignored on purpose: this image makes them, it never copies them.

# --- Pinned binaries -------------------------------------------------------
# Both are static Go binaries, which is what lets the runtime stage stay on
# Alpine. The architecture comes from `uname` rather than from BuildKit's
# TARGETARCH: Dokploy builds and runs on the same machine, so the build platform
# is the target platform, and a wrong default would only surface as an "exec
# format error" at startup instead of failing here.
FROM alpine:3.22 AS tools

RUN apk add --no-cache curl unzip tar

WORKDIR /tools
COPY .pocketbase-version .litestream-version ./

RUN set -eu; \
    pb_version="$(tr -d '[:space:]' < .pocketbase-version)"; \
    ls_version="$(tr -d '[:space:]' < .litestream-version)"; \
    case "$(uname -m)" in \
      x86_64)  pb_arch=amd64; ls_arch=x86_64 ;; \
      aarch64) pb_arch=arm64; ls_arch=arm64 ;; \
      *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o pocketbase.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${pb_version}/pocketbase_${pb_version}_linux_${pb_arch}.zip"; \
    unzip -q pocketbase.zip pocketbase; \
    # Litestream 0.5 dropped the "v" from the archive name and calls x86_64 by
    # its own name, unlike the 0.3 releases every tutorial still links to.
    curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${ls_version}/litestream-${ls_version}-linux-${ls_arch}.tar.gz" \
      | tar -xz litestream; \
    chmod +x pocketbase litestream

# --- Frontend and shared domain -------------------------------------------
FROM node:24-slim AS build

RUN corepack enable
WORKDIR /src

# Manifests first: the dependency layer survives every change that leaves them
# untouched, which is most of them.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile

COPY . .

# Produces pb_hooks/lib/domain.cjs and pb_public/ — the two artefacts the
# runtime stage picks up.
RUN pnpm build

# --- Runtime ---------------------------------------------------------------
FROM alpine:3.22

# ca-certificates is not optional here: without it Litestream cannot reach
# Backblaze over TLS and PocketBase cannot reach Resend.
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -u 10001 pocketbase

COPY --from=tools /tools/pocketbase /tools/litestream /usr/local/bin/

WORKDIR /pb
COPY --from=build /src/pb_public/ ./pb_public/
COPY --from=build /src/pb_hooks/ ./pb_hooks/
COPY pb_migrations/ ./pb_migrations/
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /pb/pb_data \
 && chown -R pocketbase:pocketbase /pb

USER pocketbase
EXPOSE 8090

# Dokploy and Traefik both read this; PocketBase answers it without auth.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
