# Structure

## Stage

- Canvas: 1080 x 1920 (9:16)
- Top 960px: motion / cards (`#stage`)
- Bottom 960px: presenter panel (`#spk` canvas or video crop)
- Seam: caption chip (`#cap`) centered on y=960

## Runtime contract

The page must expose:

```js
window.DUR = 12;           // seconds
window.READY = true;       // set after theme + DOM ready
window.render = async (t) => { /* draw frame at time t (seconds) */ };
```

A headless browser calls `render(t)` for each frame, screenshots `#film`, and
ffmpeg stitches the PNGs.

## Theme load

```js
import { loadTheme } from './theme.js';
await loadTheme('./theme.json');
// CSS variables are on :root; window.THEME holds the JSON
```

## Project layout (after copy)

```
my-explainer/
  index.html
  main.js
  theme.json          # active preset
  theme.js
  themes/*.json
  fonts/*.woff2
  build.sh            # optional full pipeline
  src/                # takes, edit, captions (full pipeline)
  out/
```
