#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd)
NAME=${1:?preset name (warm|mono|high-contrast|playful)}
SRC="$HERE/themes/$NAME.json"
[ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 1; }
cp "$SRC" "$HERE/theme.json"
echo "theme -> $NAME ($HERE/theme.json)"
