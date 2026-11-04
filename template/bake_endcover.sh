#!/usr/bin/env bash
# Bake a split cover PNG as ~0.4s at the END of a 9:16 phone mp4 so platforms that pick a frame from the end
# can use the cover (IG / TikTok style thumbnailOffset). Copy into the project; do not run here.
# Usage: bake_endcover.sh <source.mp4> <cover.png> <out-endcover.mp4> [duration_s=0.4]
set -euo pipefail
SRC=${1:?source mp4}
COVER=${2:?cover png}
OUT=${3:?output mp4}
DUR=${4:-0.4}
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$SRC")
# r_frame_rate like 30/1 or 3450163/100000
python3 - "$FPS" "$DUR" "$COVER" "$SRC" "$WORK" "$OUT" <<'PY2'
import subprocess, sys, os
fps_s, dur_s, cover, src, work, out = sys.argv[1:7]
num, den = fps_s.split("/") if "/" in fps_s else (fps_s, "1")
fps = float(num) / float(den)
dur = float(dur_s)
still = os.path.join(work, "cover-still.mp4")
# Match source fps; silent stereo so concat stays A/V
cmd_still = [
    "ffmpeg", "-y", "-loop", "1", "-i", cover,
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-c:v", "libx264", "-t", str(dur), "-r", str(fps), "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-shortest", still,
]
subprocess.check_call(cmd_still)
# Concat demuxer needs identical codecs; re-encode safely
list_path = os.path.join(work, "list.txt")
with open(list_path, "w") as f:
    f.write(f"file '{os.path.abspath(src)}'\n")
    f.write(f"file '{os.path.abspath(still)}'\n")
cmd_cat = [
    "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
    "-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart", out,
]
subprocess.check_call(cmd_cat)
# Probe durations for thumbnailOffset window
def dur_of(p):
    outp = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nk=1:nw=1", p,
    ], text=True).strip()
    return float(outp)
total = dur_of(out)
start_ms = int(round((total - dur) * 1000))
end_ms = int(round(total * 1000)) - 1
mid_ms = (start_ms + end_ms) // 2
print(f"endcover written: {out}")
print(f"cover window ms: {start_ms}-{end_ms} (suggest thumbnailOffset={mid_ms})")
PY2
