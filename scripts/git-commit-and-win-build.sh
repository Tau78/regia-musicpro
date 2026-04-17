#!/usr/bin/env bash
# 1) Stesso flusso di git-commit.sh
# 2) Crea il tag v<version> da package.json e fa push del branch + tag.
#    Su GitHub parte il workflow che genera l'installer Windows (.exe).
#
# Uso: ./scripts/git-commit-and-win-build.sh "messaggio del commit"
#      npm run git:commit:release-win -- "messaggio del commit"
#
# Se il tag esiste già, aumenta "version" in package.json (es. npm version patch --no-git-tag-version)
# e committa prima di rilanciare questo script.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$#" -lt 1 ]; then
  echo "Uso: $0 \"messaggio del commit\"" >&2
  exit 1
fi

"$ROOT/scripts/git-commit.sh" "$@"

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Il tag $TAG esiste già in questo repo." >&2
  echo "Aumenta la versione in package.json e ripeti (es. npm version patch --no-git-tag-version && git add package.json package-lock.json)." >&2
  exit 1
fi

git tag -a "$TAG" -m "Release $TAG (build Windows CI)"
git push
git push origin "$TAG"

echo "Push completato. Tag: $TAG"
echo "Su GitHub: scheda Actions → workflow \"Build Windows\"; a fine job scarica l'artifact con l'.exe."
