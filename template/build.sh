#!/usr/bin/env bash
# Portable vertical explainer build (macOS + Linux).
# Requires: ffmpeg, ffprobe, node (>=18), system Chrome/Chromium.
# After cloning the skill: npm install  (installs playwright-core)
# No private render toolkit required.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE"
NAME=${NAME:-$(basename "$HERE" | sed 's/-short$//')}
PRESET=${PRESET:-}
FPS=${FPS:-30}

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing dependency: $1" >&2; exit 1; }; }
need ffmpeg; need ffprobe; need node

# Locate skill root (parent of template/ when still inside the skill; else HERE)
SKILL_ROOT=${SKILL_ROOT:-}
if [ -z "$SKILL_ROOT" ]; then
  if [ -f "$HERE/../package.json" ] && [ -f "$HERE/../scripts/render.mjs" ]; then
    SKILL_ROOT=$(cd "$HERE/.." && pwd)
  elif [ -f "$HERE/package.json" ] && [ -f "$HERE/scripts/render.mjs" ]; then
    SKILL_ROOT=$HERE
  else
    SKILL_ROOT=$HERE
  fi
fi

RENDER="$SKILL_ROOT/scripts/render.mjs"
if [ ! -f "$RENDER" ]; then
  # Copied template: look for render.mjs next to build.sh
  if [ -f "$HERE/scripts/render.mjs" ]; then
    RENDER="$HERE/scripts/render.mjs"
  else
    echo "Cannot find scripts/render.mjs." >&2
    echo "Run this from the explainer-short skill (after npm install), or copy scripts/render.mjs into this project." >&2
    exit 1
  fi
fi

if [ ! -f theme.json ]; then
  if [ -f themes/warm.json ]; then
    cp themes/warm.json theme.json
  else
    echo "missing theme.json (run scripts/use-theme.sh warm)" >&2
    exit 1
  fi
fi

mkdir -p out
ARGS=(--dir "$HERE" --out "$HERE/out/video.mp4" --fps "$FPS")
if [ -n "$PRESET" ]; then
  ARGS+=(--preset "$PRESET")
fi

echo "rendering with $RENDER"
node "$RENDER" "${ARGS[@]}"

# Optional audio: if out/voice.wav exists, loudnorm + mux
if [ -f out/voice.wav ]; then
  python3 mix.py || {
    echo "mix.py failed; muxing video-only" >&2
  }
  if [ -f out/mix.wav ]; then
    ffmpeg -v error -y -i out/video.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "out/${NAME}.mp4"
    echo "built out/${NAME}.mp4 (with audio)"
  else
    cp out/video.mp4 "out/${NAME}.mp4"
    echo "built out/${NAME}.mp4 (video only; no mix.wav)"
  fi
else
  cp out/video.mp4 "out/${NAME}.mp4"
  echo "built out/${NAME}.mp4 (theme/graphics only; drop out/voice.wav and re-run for VO mux)"
fi

ffprobe -v error -show_entries stream=width,height,duration -of default=nw=1 "out/${NAME}.mp4" || true
