// Explainer short: the page (template). window.render(t) draws frame t (seconds on the cut timeline).
// Layout: split = animation stage on top (1080x960) + speaker below; full = the stage covers the frame.
import { drawIso, idealIsland, idealOrder, studioIsland, scaffold, P } from './iso.js';
import { loadTheme } from './theme.js';

const FPS = 30;
await loadTheme('./theme.json');
const theme = window.THEME;

const opt = u => fetch(u).then(r => r.ok ? r.json() : null, () => null);
const must = async (u) => {
  const v = await opt(u);
  if (!v) throw new Error(`Missing ${u}. For a theme-only demo use: node scripts/render_sample.mjs warm`);
  return v;
};
const [EDL, CAPS] = await Promise.all([must('src/edl.json'), must('src/captions.json')]);
// B-roll (optional)
const [BCUT, BN] = await Promise.all([opt('src/broll_cut.json'), opt('broll/index.json')]).then(([c, n]) => [c || [], n || {}]);
const VOICE = EDL.dur, DUR = +(VOICE + 0.9).toFixed(3);
const NFR = EDL.pieces.reduce((n, p) => n + Math.round(p.dur * FPS), 0);
window.DUR = DUR;

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eo = k => 1 - Math.pow(1 - k, 3);
const eio = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const back = (k, s = 1.7) => k <= 0 ? 0 : k >= 1 ? 1 : 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const pop = (t, at, d = .42) => back(seg(t, at, at + d));
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const vn = (x, s = 0) => { const i = Math.floor(x), f = x - i, h = n => { const v = Math.sin((n + s * 57.3) * 127.1) * 43758.5; return v - Math.floor(v); }; const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u); };
function T(el, { x = 0, y = 0, s = 1, r = 0, rx = 0, ry = 0, o, blur } = {}) {
  el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) perspective(1600px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`;
  if (o !== undefined) el.style.opacity = clamp(o).toFixed(3);
  if (blur !== undefined) el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
}
const EV = [];
const ev = (t, type, v = 1) => EV.push({ t: +t.toFixed(3), type, v });
window.EV = EV;

// ---------- frame ----------
const film = document.getElementById('film'), stage = document.getElementById('stage'), capEl = document.getElementById('cap');
const cursorEl = document.getElementById('cursor');
const FULL = [[9.1, 15.5]];          // full-screen intervals (cut seconds): the stage covers the speaker. 2-4 per film, on the biggest ideas
function fullAmt(t) { let m = 0; for (const [a, b] of FULL) m = Math.max(m, eio(seg(t, a - .3, a + .2)) * (1 - eio(seg(t, b - .2, b + .3)))); return m; }

// background: warm studio sweep with fine grain, rendered once
{
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const g = c.getContext('2d');
  const r1 = g.createRadialGradient(330, 260, 60, 540, 900, 1500);
  r1.addColorStop(0, theme.colors.bg_hi); r1.addColorStop(.55, theme.colors.bg); r1.addColorStop(1, theme.colors.bg_lo);
  g.fillStyle = r1; g.fillRect(0, 0, 1080, 1920);
  const id = g.getImageData(0, 0, 1080, 1920), rnd = mulberry(11);
  for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - .5) * 6; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
  g.putImageData(id, 0, 0);
  document.getElementById('bg').style.backgroundImage = `url(${c.toDataURL('image/png')})`;
}

// ---------- image sequences: speaker + B-roll ----------
const cache = new Map();
function img(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((res, rej) => { const im = new Image(); im.onload = () => im.decode().then(() => res(im), () => res(im)); im.onerror = rej; im.src = src; });
  cache.set(src, p); if (cache.size > 90) cache.delete(cache.keys().next().value);   // two sequences on screen at once need room
  return p;
}
const frame = i => img(`frames/${String(i).padStart(5, '0')}.jpg`);
const spk = document.getElementById('spk').getContext('2d');
function pieceAt(t) { let i = 0; while (i < EDL.pieces.length - 1 && EDL.pieces[i + 1].t <= t + 1e-6) i++; return i; }
async function drawSpeaker(t) {
  const fi = Math.min(NFR - 1, Math.floor(t * FPS + 1e-4));
  const im = await frame(fi);
  const close = pieceAt(Math.min(t, VOICE - .001)) % 2 === 1;      // alternate framings per piece to mask jump cuts
  if (close) spk.drawImage(im, 36, 32, 1080, 960, 0, 0, 1080, 960);   // 1:1 centre of the crop
  else spk.drawImage(im, 0, 0, 1152, 1024, 0, 0, 1080, 960);         // whole crop at 0.9375
}
// B-roll clip `id` at cut time t into a canvas: frame 0 lands on the clip's start in src/broll_cut.json.
// Canvases are 1080x960 (pane, ppane) or 1080x1920 (portrait); never draw a clip larger than its frames.
const B0 = Object.fromEntries(BCUT.map(([id, a]) => [id, a]));
async function bdraw(ctx, id, t, w = 1080, h = 960) {
  const k = clamp(Math.floor((t - B0[id]) * FPS + 1e-4), 0, BN[id] - 1);
  ctx.drawImage(await img(`broll/${id}/${String(k).padStart(5, '0')}.jpg`), 0, 0, w, h);
}

const SCENES = [];
function scene(t0, t1, full, html, update, opt = {}) {
  const el = document.createElement('div');
  el.className = 'scene ' + (full ? 'full' : 'split');
  el.innerHTML = `<div class="cam">${html}</div>`;
  stage.appendChild(el);
  const q = s => el.querySelector(s), qa = s => [...el.querySelectorAll(s)];
  const sc = { t0, t1, full, el, cam: el.firstElementChild, q, qa, update, ...opt };
  SCENES.push(sc); return sc;
}
const cardSh = (l, t, w) => `<div class="shadowblob" style="left:${l}px;top:${t}px;width:${w}px;height:${Math.round(w * .16)}px"></div>`;

// ---------- scenes ----------
// Each scene: scene(t0, t1, full, html, update(t), {noEnter, noExit, cursor(t)}). Positions are in stage pixels
// (1080x960 split, 1080x1920 full). Hang every beat on a spoken word's time from src/cut_words.json.
// update may be async (B-roll draws await their frame). noEnter: hard cut in at t0 (B-roll, a cut on a word);
// noExit: hard cut out, the scene held .3 s under the next one so a resizing stage never shows an empty frame.
// Example scenes: replace with your beats.
// Optional B-roll scene pattern:
//   scene(62.0, 71.4, false, `<canvas id="bc" width="1080" height="960" class="abs" style="left:0;top:0"></canvas>`,
//   async function (t) { await bdraw(this.q('#bc').getContext('2d'), t < 64.62 ? 'swim' : 'feet', t); }, { noEnter: true, noExit: true });
// A full-screen B-roll moment: the FULL interval starts .3 s after the cut, so the stage grows over footage, not cream.
// 1 · the redacted definition (0 – 4.9)
scene(0, 4.9, false, `
  ${cardSh(190, 640, 700)}
  <div class="card gloss" id="dict" style="left:160px;top:230px;width:760px;height:430px;padding:46px 56px;overflow:hidden">
    <div style="font-size:92px;font-weight:800;letter-spacing:-.035em;line-height:1">suc·cess</div>
    <div style="font-size:32px;color:var(--mute);font-weight:500;margin-top:14px">/səkˈses/ &nbsp;·&nbsp; <i>noun</i></div>
    <div style="margin-top:38px;display:flex;gap:20px;align-items:center;font-size:34px;font-weight:700;color:var(--mute)">1.<span class="redact" style="width:570px;height:34px"></span></div>
    <div style="margin-top:18px;padding-left:46px"><span class="redact" style="width:390px;height:34px"></span></div>
    <div id="sheen" class="abs" style="top:0;left:0;width:160px;height:430px;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.75),rgba(255,255,255,0));mix-blend-mode:screen"></div>
  </div>
  <svg id="heart" class="abs" style="left:838px;top:186px;width:120px;height:120px" viewBox="0 0 100 100">
    <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF6B81"/><stop offset="1" stop-color="#E5304F"/></linearGradient></defs>
    <path d="M50 86 C20 64 8 48 8 32 C8 18 19 9 31 9 C40 9 46 14 50 21 C54 14 60 9 69 9 C81 9 92 18 92 32 C92 48 80 64 50 86Z" fill="url(#hg)" stroke="#fff" stroke-width="4"/>
    <ellipse cx="32" cy="27" rx="11" ry="7" fill="rgba(255,255,255,.55)" transform="rotate(-30 32 27)"/></svg>
  <div class="pill" id="attr" style="left:300px;top:712px;font-size:34px;padding:14px 30px 14px 16px">
    <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#3B4A63,#1C2433);color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;font-weight:800">EN</div>
    Your speaker</div>`,
function (t) {
  const a = seg(t, 0, .55);
  T(this.q('#dict'), { y: -170 * (1 - back(a, 1.3)), rx: 26 * (1 - eo(a)), o: eo(seg(t, 0, .18)) });
  this.q('.shadowblob').style.opacity = eo(a);
  const sw = ((t - .9) % 2.2) / 1.1; T(this.q('#sheen'), { x: -200 + 1150 * clamp(sw) });
  const h = pop(t, 2.62, .45); T(this.q('#heart'), { s: h, r: -14 + 6 * Math.sin(t * 3), o: seg(t, 2.6, 2.7) });
  const at = seg(t, 3.55, 4.0); T(this.q('#attr'), { y: 40 * (1 - eo(at)), o: eo(at) });
  T(this.cam, { s: 1 + .035 * seg(t, 0, 4.9) });
}, { noEnter: true });
ev(0, 'drop'); ev(2.62, 'pop', .7); ev(3.6, 'slide', .6);

// 3 · the definition, performed (9.1 – 15.5, full)
{
  const W = [['One', 10.42], ['clear', 10.74], ['idea', 11.1], ['shown', 11.34, '#FFB287'], ['simply', 12.22, '#9DB8FF'], ['then', 13.46], ['paid', 14.06], ['off', 14.22, '#9BE0AE'], ['cleanly.', 14.58, '#9BE0AE']];
  const words = W.map(([w, at, m]) => `<span class="word" data-t="${at}">${w}${m ? `<span class="mark" style="background:${m}"></span>` : ''}<span class="bar"></span></span>`).join(' ');
  let segs = ''; for (let i = 0; i < 10; i++) segs += `<div class="sg" style="flex:1;height:34px;border-radius:10px;margin-right:${i < 9 ? 10 : 0}px;background:#E9E4DC;box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 1px 2px rgba(0,0,0,.08) inset"></div>`;
  const isl = idealIsland();
  scene(9.1, 15.5, true, `
    ${cardSh(150, 690, 780)}
    <div class="card gloss" id="defc" style="left:80px;top:170px;width:920px;height:560px;padding:54px 62px">
      <div style="font-size:28px;font-weight:700;color:var(--mute);letter-spacing:.16em">SUCCESS (NOUN)</div>
      <div style="font-size:76px;font-weight:800;line-height:1.14;letter-spacing:-.028em;margin-top:22px;position:relative;z-index:0">${words}</div>
      <div style="margin-top:28px;font-size:30px;color:var(--mute);font-weight:600">Your speaker</div>
    </div>
    <div class="card" id="prog" style="left:110px;top:800px;width:860px;height:150px;padding:28px 36px">
      <div style="display:flex;justify-content:space-between;font-size:26px;font-weight:700;color:var(--mute);margin-bottom:18px"><span>PROGRESS</span><span id="pct" class="mono" style="color:var(--ink)">0%</span></div>
      <div style="display:flex">${segs}</div>
    </div>
    <div id="isl" class="abs" style="left:90px;top:1030px;width:900px;height:800px"></div>
    <div class="pill" id="tag" style="left:390px;top:1050px;font-size:30px;color:#14733B"><div class="dot" style="background:var(--green);box-shadow:0 0 0 6px rgba(47,183,102,.18)"></div>clear idea</div>`,
  function (t) {
    this.qa('.word').forEach(w => {
      const at = +w.dataset.t, k = eo(seg(t, at - .04, at + .16));
      w.querySelector('.bar').style.transform = `scaleX(${(1 - k).toFixed(3)})`;
      const m = w.querySelector('.mark'); if (m) m.style.transform = `scaleX(${eo(seg(t, at + .1, at + .45)).toFixed(3)})`;
    });
    const n = 4 * seg(t, 11.34, 12.3);
    this.qa('.sg').forEach((s, i) => {
      const f = clamp(n - i); s.style.background = f > 0 ? `linear-gradient(180deg,#FF9E6B,#F2692F)` : '#E9E4DC';
      s.style.opacity = f > 0 ? (.35 + .65 * f).toFixed(2) : 1; s.style.transform = `scaleY(${(1 + .25 * Math.sin(Math.PI * f)).toFixed(3)})`;
    });
    this.q('#pct').textContent = Math.round(10 * n) + '%';
    T(this.q('#prog'), { o: eo(seg(t, 10.9, 11.3)), y: 30 * (1 - eo(seg(t, 10.9, 11.3))) });
    // the blueprint draws itself, item by item
    const order = idealOrder(isl), t0 = 12.25, step = 1.85 / order.length;
    order.forEach((it, i) => { it.s = 0; it.b = 1; it.show = eo(seg(t, t0 + i * step, t0 + i * step + .3)); });
    const glow = Math.sin(Math.PI * seg(t, 14.2, 15.2));
    this.q('#isl').innerHTML = drawIso(order, 86, { w: 900, h: 800, oy: 250, grid: seg(t, 12.1, 12.6) });
    this.q('#isl').style.filter = glow > .01 ? `drop-shadow(0 0 ${(18 * glow).toFixed(1)}px rgba(47,107,255,${(.45 * glow).toFixed(2)}))` : 'none';
    const tg = pop(t, 14.3, .45); T(this.q('#tag'), { s: .6 + .4 * tg, o: seg(t, 14.28, 14.4), y: 20 * (1 - tg) });
    T(this.cam, { s: 1.0 + .03 * seg(t, 9.1, 15.5) });
  });
  ev(9.0, 'whoosh', .7); for (const [, at] of W) ev(at, 'peel', .35); for (let i = 0; i < 4; i++) ev(11.34 + i * .24, 'tick', .6);
  ev(12.25, 'draw', .6); ev(14.25, 'bell', 1);
}

// 11 + 12 · say it to the models, then write it down (54.8 – 68.3)
{
  const MODELS = [['Claude Code', 60.76, '#D9774B'], ['Codex', 61.86, '#3A3D44'], ['ChatGPT', 63.24, '#1B9C85'], ['Claude', 63.8, '#C98A4B']];
  const L1 = "Here's the life I want to build: ", L2 = 'a home by the water, work that matters, time to create.';
  let wave = ''; for (let i = 0; i < 30; i++) wave += `<div class="wv" style="width:12px;border-radius:6px;background:linear-gradient(180deg,#FF9E6B,#F2692F);margin-right:8px"></div>`;
  scene(54.8, 68.3, false, `
    ${cardSh(150, 800, 780)}
    <div id="models" class="abs" style="left:0;top:100px;width:1080px;height:90px">
      ${MODELS.map(([m, , c], i) => `<div class="pill model" data-i="${i}" style="left:0;top:0"><div class="dot" style="background:${c}"></div>${m}</div>`).join('')}</div>
    <div class="card" id="win" style="left:90px;top:250px;width:900px;height:540px;overflow:hidden">
      <div style="height:62px;display:flex;align-items:center;gap:12px;padding:0 26px;border-bottom:1px solid rgba(40,30,20,.07)">
        <div class="dot" style="background:#FF5F57"></div><div class="dot" style="background:#FEBC2E"></div><div class="dot" style="background:#28C840"></div>
        <div style="flex:1;text-align:center;font-size:24px;font-weight:700;color:var(--mute);margin-right:80px">New chat</div></div>
      <div id="mic" class="abs" style="left:60px;top:140px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle at 38% 32%,#FFB287,#F2692F 60%,#D9531C);
        box-shadow:0 14px 26px -8px rgba(242,105,47,.6),0 1px 0 rgba(255,255,255,.5) inset;display:flex;align-items:center;justify-content:center">
        <svg width="60" height="60" viewBox="0 0 120 120"><rect x="44" y="12" width="32" height="56" rx="16" fill="#fff"/><path d="M30 52 Q30 82 60 82 Q90 82 90 52" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/><rect x="56" y="82" width="8" height="18" fill="#fff"/></svg></div>
      <div id="micring" class="abs" style="left:60px;top:140px;width:140px;height:140px;border-radius:50%;border:4px solid rgba(242,105,47,.7)"></div>
      <div id="wave" class="abs" style="left:250px;top:140px;height:140px;display:flex;align-items:center">${wave}</div>
      <div id="tx" class="abs" style="left:60px;top:150px;width:780px;font-size:40px;font-weight:600;line-height:1.3"></div>
      <div class="abs" style="left:26px;right:26px;bottom:26px;height:84px;border-radius:42px;background:#F4F1EC;display:flex;align-items:center;justify-content:flex-end;padding:0 10px">
        <div id="send" style="width:66px;height:66px;border-radius:50%;background:#1B1B1F;display:flex;align-items:center;justify-content:center">
        <svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
    </div>`,
  function (t) {
    // model chips: laid out centred, each pops on its name
    const els = this.qa('.model'); let wsum = 0; const ws = els.map(e => e.offsetWidth); wsum = ws.reduce((a, b) => a + b, 0) + 24 * (ws.length - 1);
    let x = (1080 - wsum) / 2;
    els.forEach((e, i) => { const k = back(seg(t, MODELS[i][1], MODELS[i][1] + .4)); e.style.left = x + 'px'; x += ws[i] + 24; T(e, { s: .6 + .4 * k, y: 30 * (1 - eo(seg(t, MODELS[i][1], MODELS[i][1] + .3))), o: seg(t, MODELS[i][1], MODELS[i][1] + .08) }); });
    const rec = seg(t, 56.8, 56.9) * (1 - seg(t, 64.5, 64.8));
    const p = ((t - 56.8) % 1.0); T(this.q('#micring'), { s: 1 + .5 * p, o: rec * (1 - p) });
    const click = Math.sin(Math.PI * seg(t, 56.7, 56.95));
    const gone = eo(seg(t, 64.6, 65.0));
    T(this.q('#mic'), { s: (1 - .08 * click) * (1 - gone), o: 1 - gone });
    this.qa('.wv').forEach((b, i) => { b.style.height = (10 + 110 * rec * Math.pow(vn(t * 8 + i * .9, i), 1.6)).toFixed(1) + 'px'; });
    this.q('#wave').style.opacity = 1 - gone;
    const n1 = Math.round(L1.length * seg(t, 65.0, 66.3)), n2 = Math.round(L2.length * seg(t, 66.4, 67.9));
    const caret = Math.floor(t * 2.4) % 2 || t < 64.9 ? '' : '<span style="display:inline-block;width:3px;height:44px;background:var(--blue);vertical-align:-8px;margin-left:2px"></span>';
    this.q('#tx').innerHTML = `<span style="color:var(--mute)">${L1.slice(0, n1)}</span>${L2.slice(0, n2)}${caret}`;
    const sp = Math.sin(Math.PI * seg(t, 68.05, 68.3)); T(this.q('#send'), { s: 1 - .1 * sp }); this.q('#send').style.background = t > 68.05 ? '#2F6BFF' : '#1B1B1F';
    T(this.cam, { s: 1 + .04 * eio(seg(t, 64.6, 68.3)), y: 10 * eio(seg(t, 64.6, 68.3)) });
  }, {
    cursor(t) {
      if (t < 55.5 || t > 68.6) return null;
      const K = [[55.5, 760, 900], [56.6, 205, 470], [57.2, 220, 490], [64.6, 260, 520], [67.4, 860, 760], [68.0, 908, 728], [68.6, 930, 760]];
      let i = 0; while (i < K.length - 2 && K[i + 1][0] <= t) i++;
      const k = eio(seg(t, K[i][0], K[i + 1][0]));
      return { x: lerp(K[i][1], K[i + 1][1], k), y: lerp(K[i][2], K[i + 1][2], k), press: Math.max(Math.sin(Math.PI * seg(t, 56.65, 56.9)), Math.sin(Math.PI * seg(t, 68.02, 68.25))), o: seg(t, 55.5, 55.8) };
    }
  });
  ev(56.75, 'click', 1); ev(56.8, 'chime', .5);
  for (const [, a] of MODELS) ev(a + .28, 'pop', .5);          // after the name's onset, never on it
  for (let i = 0; i < 34; i++) ev(65.0 + i * 1.3 / 34, 'key', .3);
  for (let i = 0; i < 56; i++) ev(66.4 + i * 1.5 / 56, 'key', .3);
  ev(68.12, 'click', 1);
}

// ---------- render ----------
let lastCap = null;
window.render = async function (t) {
  const amt = fullAmt(t), H = 960 + 960 * amt;
  stage.style.height = H.toFixed(1) + 'px';
  if (amt < .999) await drawSpeaker(t);
  for (const s of SCENES) {
    const vis = t >= (s.noEnter ? s.t0 : s.t0 - .45) && t <= s.t1 + (s.noExit ? .3 : .45);
    s.el.style.display = vis ? 'block' : 'none';
    if (!vis) continue;
    const a = s.noEnter ? 1 : seg(t, s.t0 - .04, s.t0 + .34), z = s.noExit ? 0 : seg(t, s.t1 - .16, s.t1 + .12);   // hand-off, not a dissolve
    T(s.el, { y: (1 - eo(a)) * 70 - eio(z) * 50, s: .965 + .035 * eo(a) - .02 * z, o: eo(a) * (1 - eio(z)) });
    await s.update(t);
  }
  // caption chip on the seam (centre of frame in full layout); hidden while the definition card spells it out
  const c = CAPS.find(c => t >= c.t0 && t < c.t1);
  const hide = t > 9.15 && t < 15.45;                 // hide the chip when an on-screen card already spells the words
  if (c && !hide) {
    if (capEl.textContent !== c.text) capEl.textContent = c.text;
    capEl.style.display = 'block';
    const k = seg(t, c.t0, c.t0 + .09);
    capEl.style.transform = `translate(-50%,-50%) scale(${(.9 + .1 * eo(k)).toFixed(3)})`;
  } else capEl.style.display = 'none';
  // cursor (the viewer's hand)
  let cur = null; for (const s of SCENES) if (s.cursor && t >= s.t0 - .45 && t <= s.t1 + .45) { cur = s.cursor(t); if (cur) break; }
  if (cur) { cursorEl.style.display = 'block'; T(cursorEl, { x: cur.x - 10, y: cur.y - 6, s: 1 - .15 * (cur.press || 0), o: cur.o ?? 1 }); } else cursorEl.style.display = 'none';
};
EV.sort((a, b) => a.t - b.t);
await document.fonts.ready;
await frame(0);
window.READY = true;
