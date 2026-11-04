# Review rubric

Score each axis 0 (fail) to 3 (excellent). Ship when mean >= 2.3.
An independent reviewer measures the main deliverable file; the builder does not grade their own work.

| Axis | 0 | 1 | 2 | 3 |
|------|---|---|---|---|
| Freeze | Cuts mid-word | Short hold | Clear hold on last cue (~0.3s) | Hold 0.3-0.5s + clean settle |
| Loudness | Clipped / buried; no measure | Uneven; far from target | Near -14 LUFS integrated | Dialogue-centered at about -14 LUFS (measure it) |
| True peak | Peaks above 0 dBTP / clipped | Above -1 dBTP | At or under -1 dBTP | Comfortably under -1 dBTP with headroom |
| Cover | Random end frame | Weak title | Readable title card | Strong end / thumbnailOffset lands on title |
| Theme | Hard-coded leftovers | Partial tokens | Tokens applied | Preset feels intentional |
| Clarity | Confusing | Needs audio | Point lands muted | Stranger gets it silent |

## Independent measurements (required evidence)

1. **Freeze:** scrub the last caption; note hold duration in seconds.
2. **Loudness:** `ffmpeg -i main.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -` and read `input_i` (or a two-pass measure). Target about **-14 LUFS** integrated for dialogue-led shorts.
3. **True peak:** same loudnorm printout `input_tp`, or `ffmpeg -i main.mp4 -af ebur128=peak=true -f null -`. Must be **<= -1 dBTP**.
4. **Cover / Theme / Clarity:** still frames + silent watch.

Also check:

- 1080x1920, expected duration (ffprobe)
- No personal names, private URLs, or third-party brand assets
- Captions are short chips, not paragraphs
- No em dashes (U+2014) in on-screen copy
