import { loadTheme } from './theme.js';

const FPS = 30;
const DUR = 12;
window.DUR = DUR;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = k => 1 - Math.pow(1 - k, 3);
const back = (k, s = 1.7) => k <= 0 ? 0 : k >= 1 ? 1 : 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
function T(el, { x = 0, y = 0, s = 1, o } = {}) {
  el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
  if (o !== undefined) el.style.opacity = clamp(o).toFixed(3);
}

await loadTheme('./theme.json');
const theme = window.THEME;

const stage = document.getElementById('stage');
const capEl = document.getElementById('cap');
const spk = document.getElementById('spk').getContext('2d');

// background sweep from theme
{
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  const r1 = g.createRadialGradient(330, 260, 60, 540, 900, 1500);
  r1.addColorStop(0, theme.colors.bg_hi);
  r1.addColorStop(.55, theme.colors.bg);
  r1.addColorStop(1, theme.colors.bg_lo);
  g.fillStyle = r1; g.fillRect(0, 0, 1080, 1920);
  document.getElementById('bg').style.backgroundImage = `url(${c.toDataURL('image/png')})`;
}

// speaker panel: solid theme color with label (no personal footage in sample)
function drawSpeaker(t) {
  spk.fillStyle = theme.colors.bg_lo;
  spk.fillRect(0, 0, 1080, 960);
  spk.fillStyle = theme.colors.surface;
  roundRect(spk, 120, 180, 840, 600, 40);
  spk.fill();
  spk.fillStyle = theme.colors.ink;
  spk.font = `700 42px ${theme.fonts.sans}, sans-serif`;
  spk.fillText('Presenter panel', 180, 360);
  spk.fillStyle = theme.colors.mute;
  spk.font = `500 28px ${theme.fonts.sans}, sans-serif`;
  spk.fillText('Replace with your own footage crop', 180, 420);
  spk.fillStyle = theme.colors.accent;
  spk.fillRect(180, 480, 200 + (Math.sin(t * 2) * 0.5 + 0.5) * 120, 14);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const el = document.createElement('div');
el.className = 'scene split';
el.style.display = 'block';
el.innerHTML = `
  <div class="cam">
    <div class="card" id="card" style="left:120px;top:160px;width:840px;height:520px;padding:48px 56px">
      <div id="kicker" class="mono" style="font-size:28px;color:var(--mute);font-weight:600;margin-bottom:18px">THEME DEMO</div>
      <div id="title" style="font-size:86px;font-weight:var(--headline-weight);letter-spacing:-.03em;line-height:1.02;color:var(--ink)">Make the idea visible</div>
      <div id="body" style="margin-top:28px;font-size:34px;color:var(--mute);font-weight:600;line-height:1.35">One object. One promise. Pay it off before the end.</div>
      <div id="bar" style="position:absolute;left:56px;bottom:48px;height:16px;border-radius:999px;background:var(--accent);width:40px"></div>
    </div>
    <div class="pill" id="tag" style="left:160px;top:720px"><span class="dot"></span><span id="tagtext">warm</span></div>
  </div>`;
stage.appendChild(el);
document.getElementById('tagtext').textContent = theme.name || 'theme';

const CAPS = [
  [0.4, 2.8, 'one idea'],
  [3.0, 5.5, 'shown clearly'],
  [5.8, 8.5, 'theme swap'],
  [8.8, 11.5, 'your taste'],
];

window.render = async function render(t) {
  drawSpeaker(t);
  const enter = back(seg(t, 0.15, 0.15 + (theme.motion?.enter_s || 0.45)), theme.motion?.overshoot || 1.7);
  T(document.getElementById('card'), { y: 80 * (1 - enter), s: 0.92 + 0.08 * enter, o: eo(seg(t, 0.1, 0.35)) });
  T(document.getElementById('tag'), { y: 40 * (1 - enter), o: eo(seg(t, 0.4, 0.7)) });
  const bar = document.getElementById('bar');
  bar.style.width = (40 + 720 * seg(t, 1.0, 10.5)) + 'px';
  // caption chip
  let text = '';
  for (const [a, b, w] of CAPS) if (t >= a && t < b) text = w;
  if (text) {
    capEl.style.display = 'block';
    capEl.textContent = text;
    const k = eo(seg(t, CAPS.find(c => c[2] === text)[0], CAPS.find(c => c[2] === text)[0] + 0.12));
    capEl.style.transform = `translate(-50%,-50%) scale(${0.92 + 0.08 * k})`;
  } else capEl.style.display = 'none';
};

window.READY = true;
