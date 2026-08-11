#!/usr/bin/env bash
# Downloads the pinned PocketBase binary into bin/. The binary is not committed:
# it is platform specific and the version is pinned in .pocketbase-version.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(tr -d '[:space:]' <"${root}/.pocketbase-version")"
target="${root}/bin/pocketbase"

# Compared exactly, not with grep: an unanchored match lets a pin that is a
# substring of the installed version silently skip the download.
if [[ -x "${target}" ]]; then
  installed="$("${target}" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
  if [[ "${installed}" == "${version}" ]]; then
    echo "PocketBase ${version} already present."
    exit 0
  fi
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

archive="pocketbase_${version}_${os}_${arch}.zip"
url="https://github.com/pocketbase/pocketbase/releases/download/v${version}/${archive}"
tmp="$(mktemp -d)"
trap 'rm -rf "${tmp}"' EXIT

echo "Downloading ${archive}..."
curl -fsSL "${url}" -o "${tmp}/${archive}"
unzip -q "${tmp}/${archive}" -d "${tmp}"

mkdir -p "${root}/bin"
mv "${tmp}/pocketbase" "${target}"
chmod +x "${target}"

echo "PocketBase ${version} installed at bin/pocketbase."
