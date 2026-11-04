# explainer-short

Open skill: build a short vertical (9:16) talking-head explainer with animated
graphics, caption chips, and **swappable themes**.

Works with Codex, Claude Code, Cursor, or any agent that can follow a `SKILL.md`.
No personal brand. No private render toolkit. Theme demo runs after `npm install`.

## Install

### Codex

```bash
mkdir -p ~/.codex/skills
git clone <this-repo-url> ~/.codex/skills/explainer-short
cd ~/.codex/skills/explainer-short
npm install
```

### Claude Code

```bash
mkdir -p ~/.claude/skills
git clone <this-repo-url> ~/.claude/skills/explainer-short
cd ~/.claude/skills/explainer-short
npm install
```

### Cursor or any agent

Clone or copy this folder into your skills path, run `npm install`, and point the
agent at `SKILL.md`.

System deps: **Node 18+**, **ffmpeg**, **ffprobe**, and a system **Chrome or Chromium**.
Optional for talking-head helpers: Python 3 with `numpy` and `soundfile`.

## Theme presets

| Preset | Feel |
|--------|------|
| `warm` | Cream paper wash, blue accent (default) |
| `mono` | Near-black ground, white type, one blue accent |
| `high-contrast` | Strong ink on bright ground |
| `playful` | Softer radii, brighter accents |

```bash
bash template/scripts/use-theme.sh warm
```

Fonts are SIL OFL (Inter, JetBrains Mono) and ship as woff2 under `template/fonts/`
with license files. Swap fonts by editing the theme JSON `fonts` block and dropping
another OFL/Apache-licensed woff2 into `fonts/`.

## Theme demo (fresh clone)

```bash
npm install
node scripts/render_sample.mjs warm
node scripts/render_sample.mjs mono
```

Writes `sample/out/<preset>/<preset>.mp4` plus start/mid stills. Compare the stills
to confirm colors changed.

## Full talking-head project

1. Copy `template/` to a new folder (or edit in place).
2. Provide `src/edl.json` and `src/captions.json` (cut timeline + caption chips).
3. Apply a theme: `bash template/scripts/use-theme.sh warm` (or mono / playful / high-contrast).
4. From the skill root (after `npm install`):

```bash
# render the copied project
node scripts/render.mjs --dir path/to/project --preset warm --out path/to/project/out/video.mp4

# or, while still inside this skill's template/ folder:
PRESET=warm bash template/build.sh
```

Without `src/edl.json` the template will exit with a clear error. Use the Theme demo above for a no-EDL proof that colors and fonts swap.

Audio (optional): place `out/voice.wav` (and optional `out/music.wav`) in the project, then run
`python3 mix.py` from that folder. Targets about **-14 LUFS** integrated and **<= -1 dBTP** true peak.

## Review

Six axes, 0-3, ship at mean >= 2.3. See `references/review-rubric.md`.

## License

MIT (see `LICENSE`). Fonts: SIL Open Font License.
