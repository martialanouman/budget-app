#!/usr/bin/env bash
# Downloads the pinned Mailpit binary into bin/. Mailpit is the SMTP sink used
# by the password reset journey: it captures mail instead of delivering it.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(tr -d '[:space:]' <"${root}/.mailpit-version")"
target="${root}/bin/mailpit"

if [[ -x "${target}" ]] && "${target}" version 2>/dev/null | grep -q "${version}"; then
  echo "Mailpit ${version} already present."
  exit 0
fi

case "$(uname -s)" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  arm64 | aarch64) arch="arm64" ;;
  x86_64 | amd64) arch="amd64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

archive="mailpit-${os}-${arch}.tar.gz"
url="https://github.com/axllent/mailpit/releases/download/v${version}/${archive}"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

echo "Downloading ${archive}..."
curl -fsSL "${url}" -o "${tmp}/${archive}"
tar -xzf "${tmp}/${archive}" -C "${tmp}"

mkdir -p "${root}/bin"
mv "${tmp}/mailpit" "${target}"
chmod +x "${target}"

echo "Mailpit ${version} installed at bin/mailpit."
