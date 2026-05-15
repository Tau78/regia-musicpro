#!/usr/bin/env bash
# Release desktop su GitHub: bump patch, tag v*, push main + tag.
# Attiva .github/workflows/release.yml (installer Windows/macOS + feed auto-update).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$ROOT/scripts/release-vercel-prod.sh" --with-tag
