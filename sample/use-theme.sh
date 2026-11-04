#!/usr/bin/env bash
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
NAME=${1:?preset}
cp "$HERE/themes/$NAME.json" "$HERE/theme.json"
echo "sample theme -> $NAME"
