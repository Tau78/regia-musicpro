#!/usr/bin/env bash
# Pubblica su GitHub Releases l'installer Windows + latest.yml (auto-updater).
# Esegui su Windows (stesso ambiente di `npm run dist:win`).
#
# Prerequisito: variabile d'ambiente GH_TOKEN (PAT con scope `repo`).
#
# Uso:  export GH_TOKEN=ghp_...
#       npm run release:win:github
#
# Non incrementa la versione né fa commit/push del codice: vedi commenti in fondo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${GH_TOKEN:-}" ]; then
  echo "Errore: GH_TOKEN non è impostato." >&2
  echo "Esempio (PowerShell): \$env:GH_TOKEN=\"ghp_...\"" >&2
  echo "Esempio (bash):       export GH_TOKEN=ghp_..." >&2
  exit 1
fi

npm run dist:win:publish

echo
echo "OK: upload completato. Su GitHub → Releases verifica .exe e latest.yml."
