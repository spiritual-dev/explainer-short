---
name: explainer-short
description: >
  Build a short vertical (9:16) talking-head explainer with animated graphics,
  captions, and a theme you can swap. Use when someone asks for a short explainer
  video, a vertical teaching clip, a themeable motion graphic over a presenter, or
  a portable HTML canvas render pipeline without a heavy framework.
---

# explainer-short

Make a short vertical explainer: presenter on the bottom half, motion graphics on
the top half, big caption chips in the middle. One idea per clip. Theme tokens
control color, type, radius, and motion so the same script can look warm, mono,
high-contrast, or playful.

## When to use

- A 8-30 second vertical teaching or product explainer
- A reusable HTML/Canvas pipeline that exports MP4
- Swappable visual themes without rewriting the scene code

## Layout

```
+---------------------------+
|   motion / cards (1080)   |
|                           |
|---------------------------|  <- caption chip at the seam
|   presenter crop (960)    |
|                           |
+---------------------------+
         1080 x 1920
```

## Theme system

Themes live in `template/themes/*.json` (and `sample/themes/` for the demo).
Active theme is `theme.json` in the project folder.

```bash
bash template/scripts/use-theme.sh warm          # or mono | high-contrast | playful
# or from a copied project:
bash scripts/use-theme.sh mono
```

Tokens (CSS variables after `loadTheme`):

| Token | Role |
|-------|------|
| `--ink` `--mute` | Text |
| `--bg` `--bg-hi` `--bg-lo` | Stage wash |
| `--surface` `--surface-2` | Cards |
| `--accent` `--accent-2` `--accent-3` | Emphasis |
| `--chip-bg` `--chip-fg` | Caption chip |
| `--radius-card` `--radius-chip` `--chip-size` | Shape |
| `--headline-weight` | Title weight |
| `--font-sans` `--font-mono` | Type (OFL woff2 in `fonts/`) |

Presets: `warm` (default), `mono`, `high-contrast`, `playful`.

Edit a JSON file, re-run `use-theme.sh`, reload. No build step for the theme itself.

### Font swap

1. Drop an open-licensed woff2 into `fonts/` and keep its license file beside it.
2. Set `fonts.sans` / `fonts.sans_file` (and mono) in the theme JSON.
3. Point `@font-face` in `index.html` at the new file if the family name changes.
4. Re-render a mid-frame still and confirm.

Bundled defaults: Inter + JetBrains Mono (SIL OFL). License texts ship under `fonts/`.

## Quick start (theme demo, no talking-head take)

```bash
npm install
node scripts/render_sample.mjs warm
node scripts/render_sample.mjs mono
# outputs: sample/out/<preset>/<preset>.mp4 + frame stills
```

Requires: Node 18+, system Chrome or Chromium, ffmpeg.

## Full project pipeline (self-contained)

1. Copy `template/` into a new project folder (or work inside `sample/`).
2. Write scenes in `main.js` that call `window.render(t)` and use CSS vars from the theme.
3. Optional talking-head: drop a take, fill `src/edit.json`, run `python3 src/edit.py` (needs numpy + soundfile), then `python3 src/captions.py`.
4. From the skill root (after `npm install`):

```bash
PRESET=warm bash template/build.sh
# or, for a copied project:
SKILL_ROOT=/path/to/explainer-short PRESET=mono bash build.sh
# or call the renderer directly:
node scripts/render.mjs --dir path/to/project --preset warm --out path/to/project/out/video.mp4
```

5. If you have `out/voice.wav`, `python3 mix.py` loudnorms toward -14 LUFS / -1 dBTP and `build.sh` muxes it.

`template/scripts/render.mjs` is also copied beside the template so a project can keep a local copy.

## Design rules

1. **One idea.** One object, one promise, paid off before the end.
2. **Readable at arm's length.** Big type, high contrast, few words on screen.
3. **Caption chips are the voice.** Keep cues short; freeze on the last word briefly.
4. **Theme, do not hard-code.** Colors, radii, and chip size come from tokens.
5. **Taste-neutral default.** Warm is the default; the person picks a preset.

## Review before shipping

Score each axis 0-3. Ship only if the mean is at least 2.3.
Independent reviewer measures the main file.

| Axis | Look for |
|------|----------|
| Freeze | Last caption holds ~0.3-0.5s; no cut mid-word |
| Loudness | About -14 LUFS integrated (measure with ffmpeg loudnorm) |
| True peak | <= -1 dBTP |
| Cover | End frame or thumbnailOffset is a clear title card |
| Theme | Tokens applied; no leftover hard-coded brand colors |
| Clarity | A stranger gets the point without audio |

Full rubric: `references/review-rubric.md`. Safe zones: `references/cover.md`.

## Files

| Path | Role |
|------|------|
| `package.json` | Declares `playwright-core` |
| `template/` | Starter project (HTML, theme, fonts, build.sh) |
| `template/themes/` | Preset JSON |
| `template/theme.js` | `loadTheme()` -> CSS vars on `:root` |
| `sample/` | Self-contained 12s theme demo |
| `scripts/render.mjs` | Headless frame render + ffmpeg mux |
| `scripts/render_sample.mjs` | Convenience wrapper for sample presets |
| `references/` | Structure, themes, review rubric, cover, finish |
| `docs/` | Preview stills from verified runs |

## Agent checklist

- [ ] `npm install` done in the skill root
- [ ] Theme preset chosen (or warm default)
- [ ] `theme.json` matches the preset
- [ ] Scenes use CSS variables, not hard-coded brand colors
- [ ] Sample or full build produces MP4
- [ ] ffprobe confirms 1080x1920 and expected duration
- [ ] Mid-frame still looks on-brand for the preset
- [ ] Loudness ~ -14 LUFS and true peak <= -1 dBTP when audio is present
- [ ] Review rubric mean >= 2.3
- [ ] No personal or third-party brand leftovers in the project
