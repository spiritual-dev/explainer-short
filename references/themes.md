# Themes

## Schema (theme.json)

```json
{
  "name": "warm",
  "description": "Cream studio with soft product-UI cards",
  "colors": {
    "ink": "#1B1B1F",
    "mute": "#8C867E",
    "bg": "#F2EEE7",
    "bg_hi": "#FBF8F3",
    "bg_lo": "#E2DACE",
    "surface": "#FFFFFF",
    "surface_2": "#F6F3EE",
    "accent": "#2F6BFF",
    "accent_2": "#FF7A45",
    "accent_3": "#2FB766",
    "chip_bg": "rgba(22,22,26,0.80)",
    "chip_fg": "#FFFFFF",
    "shadow": "rgba(60,45,30,0.25)"
  },
  "fonts": {
    "sans": "Inter",
    "mono": "JBM",
    "sans_file": "fonts/InterVariable.woff2",
    "mono_file": "fonts/JetBrainsMono-Regular.woff2"
  },
  "type": {
    "headline_weight": 800,
    "chip_size_px": 56,
    "radius_card_px": 34,
    "radius_chip_px": 20
  },
  "motion": {
    "enter_s": 0.45,
    "overshoot": 1.7,
    "camera_push": 1.04
  }
}
```

`theme.js` maps these onto CSS variables (`--ink`, `--radius-card`, ...).

## Adding a preset

1. Copy `themes/warm.json` to `themes/my-look.json`.
2. Edit tokens. Keep contrast readable on a phone.
3. `bash scripts/use-theme.sh my-look`
4. Re-render and check a mid-frame still.

## Rules

- Do not hard-code brand colors in `main.js`; read from CSS vars or `window.THEME`.
- Caption chip must stay high-contrast (`chip_bg` / `chip_fg`).
- Taste-neutral: ship warm as default; let the person pick.
