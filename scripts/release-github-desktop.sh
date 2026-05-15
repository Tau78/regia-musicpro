#!/usr/bin/env bash
# Release desktop su GitHub:
# 1) Se ci sono modifiche: git add -A + commit (messaggio: PRE_RELEASE_COMMIT_MSG o default).
# 2) Poi come prima: pull, sync lock se serve, npm version patch, tag v*, push main + tag.
# Attiva .github/workflows/release.yml (installer + feed auto-update).
#
# Messaggio commit pre-release: export PRE_RELEASE_COMMIT_MSG="feat: cosa hai fatto"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Errore: serve il branch main (ora: $(git branch --show-current))." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  DEFAULT_MSG='chore: pre-release — salvataggio modifiche prima del bump versione'
  MSG="${PRE_RELEASE_COMMIT_MSG:-$DEFAULT_MSG}"
  git add -A
  if git diff --cached --quiet; then
    echo "Errore: working tree segnalava modifiche ma non c’è nulla da committare." >&2
    exit 1
  fi
  STAT="$(git diff --cached --stat)"
  git commit -m "$MSG" -m "Stat:" -m "$STAT"
fi

exec bash "$ROOT/scripts/release-vercel-prod.sh" --with-tag
