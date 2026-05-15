#!/usr/bin/env bash
# Release produzione web (Vercel): incrementa patch in package.json, commit, push su main.
# Non crea tag git (evita di attivare .github/workflows/release.yml sui tag v*).
# Opzione: --with-tag → tag semver + push tag (attiva anche release Electron se la usi).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WITH_TAG=0
if [[ "${1:-}" == "--with-tag" ]]; then
  WITH_TAG=1
fi

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Errore: serve il branch main (ora: $(git branch --show-current))." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Errore: working tree non pulito. Committa o stash, poi ripeti." >&2
  git status --short >&2
  exit 1
fi

git pull --rebase origin main

npm install --no-audit --no-fund

if [[ -n "$(git status --porcelain)" ]]; then
  echo "npm install ha lasciato modifiche (es. lockfile). Commit di allineamento…" >&2
  git add package.json package-lock.json
  git commit -m "chore: sync package.json / lockfile before release"
fi

if [[ "$WITH_TAG" == 1 ]]; then
  npm version patch -m "release: %s"
  git push origin main --follow-tags
  echo "OK: main + tag inviati (Release Electron partirà se il workflow è attivo)."
else
  npm version patch --no-git-tag-version
  VER="$(node -p "require('./package.json').version")"
  git add package.json package-lock.json
  if git diff --staged --quiet; then
    echo "Errore: nessun cambiamento dopo npm version." >&2
    exit 1
  fi
  git commit -m "release: ${VER}"
  git push origin main
  echo "OK: release ${VER} su main → Vercel (e eventuale workflow Deploy da GitHub Actions)."
fi
