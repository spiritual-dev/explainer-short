#!/usr/bin/env python3
"""Portable mix: loudnorm voice to about -14 LUFS, true peak <= -1 dBTP.

Optional: if out/music.wav exists, duck it under voice. No private toolkit.

Inputs:
  out/voice.wav   required
  out/music.wav   optional bed

Output:
  out/mix.wav
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from shutil import which

HERE = Path(__file__).resolve().parent
os.chdir(HERE)
OUT = HERE / "out"
VOICE = OUT / "voice.wav"
MUSIC = OUT / "music.wav"
MIX = OUT / "mix.wav"
TARGET_I = -14.0
TARGET_TP = -1.0
TARGET_LRA = 11.0


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr or r.stdout or "ffmpeg failed\n")
        raise SystemExit(r.returncode)
    return r


def loudnorm_measure(src: Path) -> dict:
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(src),
        "-af", f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json",
        "-f", "null", "-",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    text = r.stderr or r.stdout
    start = text.rfind("{")
    end = text.rfind("}")
    if start < 0 or end < 0:
        return {}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}


def loudnorm_apply(src: Path, dst: Path, stats: dict) -> None:
    if stats:
        af = (
            f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}"
            f":measured_I={stats.get('input_i', TARGET_I)}"
            f":measured_TP={stats.get('input_tp', TARGET_TP)}"
            f":measured_LRA={stats.get('input_lra', TARGET_LRA)}"
            f":measured_thresh={stats.get('input_thresh', -24)}"
            f":offset={stats.get('target_offset', 0)}"
            f":linear=true"
        )
    else:
        af = f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA={TARGET_LRA}"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", af, str(dst)])


def main() -> None:
    if which("ffmpeg") is None:
        sys.exit("missing dependency: ffmpeg")
    if not VOICE.is_file():
        print("no out/voice.wav; skip mix", file=sys.stderr)
        raise SystemExit(0)

    OUT.mkdir(parents=True, exist_ok=True)
    norm = OUT / "voice_norm.wav"
    stats = loudnorm_measure(VOICE)
    loudnorm_apply(VOICE, norm, stats)

    if MUSIC.is_file():
        ducked = OUT / "music_ducked.wav"
        run([
            "ffmpeg", "-v", "error", "-y",
            "-i", str(MUSIC), "-i", str(norm),
            "-filter_complex",
            "[1:a]asplit=2[sc][mix];"
            "[0:a][sc]sidechaincompress=threshold=0.05:ratio=8:attack=50:release=300:makeup=0[duck];"
            "[duck]volume=-18dB[bed];"
            "[mix][bed]amix=inputs=2:duration=first:dropout_transition=0[out]",
            "-map", "[out]", str(ducked),
        ])
        stats2 = loudnorm_measure(ducked)
        loudnorm_apply(ducked, MIX, stats2)
        ducked.unlink(missing_ok=True)
        norm.unlink(missing_ok=True)
    else:
        if MIX.exists():
            MIX.unlink()
        norm.replace(MIX)

    print(f"wrote {MIX} (target I={TARGET_I} LUFS, TP<={TARGET_TP} dBTP)")


if __name__ == "__main__":
    main()
