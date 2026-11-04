# Finish: speed, mix, exports

Post-render finishing: take a built short to post-ready audio and encodes.

## Speed

Default snappier cut: **1.15x** when the person asks for pace. Re-time captions
after any speed change.

## Mix

- Dialogue-centered.
- Target about **-14 LUFS** integrated loudness for the final mix.
- True peak **<= -1 dBTP**.
- If music is present, tuck it under (about -18 dB relative to voice as a starting point).
- Prefer a lighter bed over a launch-trailer blast for talking-head explainers.
- Portable helper: `python3 mix.py` (needs `out/voice.wav`; optional `out/music.wav`).

Measure:

```bash
ffmpeg -i out/NAME.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -
```

## Exports

| File | Role |
|------|------|
| `out/video.mp4` | Graphics render |
| `out/mix.wav` | Loudnormed mix |
| `out/NAME.mp4` | Delivery (video + audio mux, `+faststart`) |
| phone / social copy | Optional lower-bitrate re-encode |

## Checklist

- [ ] Speed decision recorded in TREATMENT.md
- [ ] Mix is VO-led at about -14 LUFS
- [ ] True peak <= -1 dBTP
- [ ] End-cover baked if the platform benefits
- [ ] ffprobe: 1080x1920, expected duration
- [ ] Rubric mean >= 2.3
- [ ] No personal leftovers in filenames or metadata you will publish
