# The look

Tokens and components live in `template/index.html` (CSS) and `template/theme.js`.
Change the look by editing a theme preset, not by hard-coding colors in scenes.

## Principles

- Big type, few words
- Cards with soft elevation, not heavy drop shadows
- Caption chip sits on the seam between graphics and presenter
- Accent color used sparingly (one bar, one dot, one chip)

## Components

| Class | Role |
|-------|------|
| `.card` | Primary surface for titles and body |
| `.pill` | Small labeled badge |
| `.chip` / `#cap` | Spoken-word caption |
| `.mono` | Eyebrow / kicker |

## Motion

Default enter: ~0.45s with light overshoot (`theme.motion`). Prefer opacity +
translateY over busy parallax. Camera push stays subtle (`camera_push` ~1.04).
