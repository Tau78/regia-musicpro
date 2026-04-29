#!/usr/bin/env bash
# Pubblica REGIA MUSICPRO su GitHub: commit, push, nuova versione (patch), tag v* → CI Windows
# che esegue `dist:win:publish` (installer + latest.yml + altri file di update) come release
# PUBBLICA (Latest), non bozza — vedi `releaseType: release` in electron-builder.yml.
#
# Token: sulla CI GitHub Actions è automatico (`GITHUB_TOKEN` → passato come `GH_TOKEN` nel workflow).
#   Non devi configurare un PAT per questo flusso, a meno che la build non debba scrivere altrove.
# Se pubblichi da PC con `npm run dist:win:publish` / `npm run release:win:github`, serve `GH_TOKEN`.
#
# Uso (da terminale integrato nella root del progetto):
#   bash "scripts/PUBBLICA REGIA.sh"
#   bash "scripts/PUBBLICA REGIA.sh" "Messaggio commit personalizzato"
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Errore: cartella non è un repository Git." >&2
  exit 1
fi

if [ "$(git branch --show-current)" != "main" ]; then
  echo "Errore: devi essere sul branch main (ora sei su '$(git branch --show-current)')." >&2
  exit 1
fi

COMMIT_MSG=""
if [ "$#" -ge 1 ]; then
  COMMIT_MSG="$*"
fi

echo "→ Incremento versione (patch) in package.json..."
npm version patch --no-git-tag-version

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

git add -A
if git diff --cached --quiet; then
  echo "Errore: nessun file da committare dopo il bump versione." >&2
  exit 1
fi

if [ -z "$COMMIT_MSG" ]; then
  COMMIT_MSG="Release ${VERSION}: pubblicazione Windows e aggiornamento automatico"
fi

echo "→ Commit: ${COMMIT_MSG}"
git commit -m "$COMMIT_MSG"

echo "→ Allineamento con origin/main..."
git pull --rebase origin main

echo "→ Push branch main..."
git push origin main

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Errore: il tag ${TAG} esiste già in locale. Risolvi i tag e riprova." >&2
  exit 1
fi

echo "→ Tag ${TAG} e push (avvia CI Release Windows + macOS su GitHub)..."
git tag -a "$TAG" -m "REGIA MUSICPRO ${VERSION}"
git push origin "$TAG"

echo
echo "Completato: versione ${VERSION}, tag ${TAG}."
echo "Controlla la build: https://github.com/Tau78/regia-musicpro/actions"
echo "Poi le release: https://github.com/Tau78/regia-musicpro/releases"
