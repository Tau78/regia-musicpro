#!/usr/bin/env bash
# Committa tutte le modifiche tracciate e non tracciate nella root del repo.
# Uso: ./scripts/git-commit.sh "messaggio del commit"
#      npm run git:commit -- "messaggio del commit"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$#" -lt 1 ]; then
  echo "Uso: $0 \"messaggio del commit\"" >&2
  exit 1
fi

MSG="$*"
git add -A
if git diff --cached --quiet; then
  echo "Nessuna modifica da committare." >&2
  exit 1
fi

git commit -m "$MSG"
echo "Commit creato."
