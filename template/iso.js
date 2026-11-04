// Isometric toy-world renderer: a list of items (back to front) -> SVG markup.
// Units are tiles; k = pixels per tile. Every item can be shown as a blueprint (dashed blue lines),
// solid (shaded faces), or partly built (`fill` = how much of its height is solid).
const C30 = Math.cos(Math.PI / 6);
export const P = (x, y, z, k) => [(x - y) * C30 * k, (x + y) * 0.5 * k - z * k];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb = (c, f = 1, a = 1) => `rgba(${c.map(v => Math.round(Math.min(255, v * f))).join(',')},${a})`;
const pts = (a, k) => a.map(([x, y, z]) => P(x, y, z, k).map(v => v.toFixed(1)).join(',')).join(' ');
const BP = '#2F6BFF';
let UID = 0, U = 'u0';   // per-drawing prefix: SVG ids must be unique across the page

function quad(a, k, fill, stroke, sw, dash) {
  return `<polygon points="${pts(a, k)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`;
}
function boxFaces(x, y, z, w, d, h) {
  return {
    top: [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]],
    right: [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]],
    left: [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]],
  };
}
function solidBox(it, k, h, a) {
  const c = hex(it.c), ct = hex(it.ct || it.c), f = boxFaces(it.x, it.y, it.z, it.w, it.d, h);
  const edge = `rgba(255,255,255,${0.35 * a})`;
  return quad(f.left, k, rgb(c, 0.9, a), rgb(c, 0.8, a * 0.6), 0.8) + quad(f.right, k, rgb(c, 0.74, a), rgb(c, 0.66, a * 0.6), 0.8)
    + quad(f.top, k, rgb(ct, 1.06, a), edge, 1.2);
}
function blueBox(it, k, a) {
  const f = boxFaces(it.x, it.y, it.z, it.w, it.d, it.h), fl = `rgba(47,107,255,${0.05 * a})`, st = `rgba(47,107,255,${0.9 * a})`;
  return quad(f.left, k, fl, st, 2, '7 6') + quad(f.right, k, fl, st, 2, '7 6') + quad(f.top, k, fl, st, 2, '7 6');
}
function roof(it, k, a, blue) {
  const { x, y, z, w, d, h } = it, m = y + d / 2;
  const back = [[x, y, z], [x + w, y, z], [x + w, m, z + h], [x, m, z + h]];
  const front = [[x, y + d, z], [x + w, y + d, z], [x + w, m, z + h], [x, m, z + h]];
  const gable = [[x + w, y, z], [x + w, y + d, z], [x + w, m, z + h]];
  if (blue) {
    const fl = `rgba(47,107,255,${0.05 * a})`, st = `rgba(47,107,255,${0.9 * a})`;
    return quad(back, k, fl, st, 2, '7 6') + quad(gable, k, fl, st, 2, '7 6') + quad(front, k, fl, st, 2, '7 6');
  }
  const c = hex(it.c), wall = hex(it.wall || '#F6F1E8');
  return quad(back, k, rgb(c, 1.08, a), rgb(c, .9, a * .5), .8) + quad(gable, k, rgb(wall, .74, a), rgb(wall, .66, a * .5), .8)
    + quad(front, k, rgb(c, .86, a), `rgba(255,255,255,${.3 * a})`, 1.2);
}
function decal(it, k, a, blue) {          // window or door on a wall plane
  const q = it.face === 'left'
    ? [[it.a, it.p, it.z0], [it.b, it.p, it.z0], [it.b, it.p, it.z1], [it.a, it.p, it.z1]]
    : [[it.p, it.a, it.z0], [it.p, it.b, it.z0], [it.p, it.b, it.z1], [it.p, it.a, it.z1]];
  if (blue) return quad(q, k, 'none', `rgba(47,107,255,${0.9 * a})`, 1.6, '5 5');
  const lit = it.lit || 0;
  const base = hex(it.c), glow = [255, 214, 120];
  const col = base.map((v, i) => v + (glow[i] - v) * lit);
  let s = quad(q, k, rgb(col, it.face === 'left' ? 0.95 : 0.8, a), `rgba(255,255,255,${.5 * a})`, 1.2);
  if (lit > 0.02) s = `<g filter="url(#${U}glow)" opacity="${.5 * lit * a}">${quad(q, k, 'rgba(255,200,90,.9)', 'none', 0)}</g>` + s;
  return s;
}
function ball(it, k, a, blue) {
  const [cx, cy] = P(it.x, it.y, it.z, k), r = it.r * k;
  if (blue) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(47,107,255,${.05 * a})" stroke="rgba(47,107,255,${.9 * a})" stroke-width="2" stroke-dasharray="7 6"/>`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${U}${it.grad || 'leaf'})" opacity="${a}"/>`
    + `<ellipse cx="${cx - r * .3}" cy="${cy - r * .38}" rx="${r * .32}" ry="${r * .2}" fill="rgba(255,255,255,${.28 * a})"/>`;
}

// it.s = solid amount 0..1, it.b = blueprint amount 0..1, it.fill = built fraction of height (boxes)
export function drawIso(items, k, { w = 900, h = 760, ox = 0, oy = 0, grid = 0 } = {}) {
  U = 'u' + (++UID) + '_';
  let out = '';
  if (grid > 0) {                         // blueprint paper grid on the ground plane
    let g = '';
    for (let i = -2; i <= 10; i++) {
      const [ax, ay] = P(i, -2, 0, k), [bx, by] = P(i, 10, 0, k), [cx, cy] = P(-2, i, 0, k), [dx, dy] = P(10, i, 0, k);
      g += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/><line x1="${cx}" y1="${cy}" x2="${dx}" y2="${dy}"/>`;
    }
    out += `<g stroke="rgba(47,107,255,${0.16 * grid})" stroke-width="1">${g}</g>`;
  }
  for (const it of items) {
    const s = it.s ?? 1, b = it.b ?? 0, sh = it.show ?? 1;
    if (sh <= 0) continue;
    const g = it.lift ? `<g transform="translate(0,${-it.lift * k})" opacity="${sh}">` : `<g opacity="${sh}">`;
    let body = '';
    if (it.t === 'box') {
      if (b > 0 && (s < 1 || (it.fill ?? 1) < 1)) body += blueBox(it, k, b);
      const fh = it.h * (it.fill ?? 1);
      if (s > 0 && fh > 0.001) body += solidBox(it, k, fh, s);
    } else if (it.t === 'roof') {
      if (b > 0 && s < 1) body += roof(it, k, b, true);
      if (s > 0) body += roof(it, k, s, false);
    } else if (it.t === 'decal') {
      if (b > 0 && s < 1) body += decal(it, k, b, true);
      if (s > 0) body += decal(it, k, s, false);
    } else if (it.t === 'ball') {
      if (b > 0 && s < 1) body += ball(it, k, b, true);
      if (s > 0) body += ball(it, k, s, false);
    }
    out += g + body + '</g>';
  }
  const defs = `<defs><filter id="${U}glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${k * .18}"/></filter>
    <radialGradient id="${U}leaf" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#8FDB8A"/><stop offset=".55" stop-color="#4FAE5E"/><stop offset="1" stop-color="#2F7D45"/></radialGradient>
    <radialGradient id="${U}metal" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#F4F6F8"/><stop offset=".6" stop-color="#A9B0B9"/><stop offset="1" stop-color="#5F6670"/></radialGradient></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${-w / 2 + ox} ${-h / 2 + oy} ${w} ${h}">${defs}${out}</svg>`;
}

// Example: a house on a floating island. Back to front.
export function idealIsland() {
  return {
    slab: { t: 'box', x: 0, y: 0, z: -0.9, w: 7, d: 7, h: 0.9, c: '#C9976B', ct: '#9AD17C' },
    path: [0, 1, 2].map(i => ({ t: 'box', x: 5.15 + i * 0.62, y: 3.05, z: 0, w: 0.42, d: 0.55, h: 0.06, c: '#E9E1D3' })),
    body: { t: 'box', x: 1.6, y: 1.8, z: 0, w: 3.3, d: 2.8, h: 2.0, c: '#F6F1E8' },
    win1: { t: 'decal', face: 'left', p: 4.6, a: 2.0, b: 2.7, z0: 0.8, z1: 1.5, c: '#9BB8D3' },
    win2: { t: 'decal', face: 'left', p: 4.6, a: 3.4, b: 4.1, z0: 0.8, z1: 1.5, c: '#9BB8D3' },
    door: { t: 'decal', face: 'right', p: 4.9, a: 2.9, b: 3.6, z0: 0, z1: 1.25, c: '#7A4E34' },
    win3: { t: 'decal', face: 'right', p: 4.9, a: 2.0, b: 2.55, z0: 0.85, z1: 1.45, c: '#9BB8D3' },
    roof: { t: 'roof', x: 1.4, y: 1.55, z: 2.0, w: 3.7, d: 3.3, h: 1.35, c: '#E2725B' },
    chim: { t: 'box', x: 2.2, y: 2.0, z: 2.4, w: 0.42, d: 0.42, h: 1.05, c: '#CFC6BA' },
    trunk1: { t: 'box', x: 5.55, y: 5.35, z: 0, w: 0.26, d: 0.26, h: 0.75, c: '#8B5A3C' },
    tree1: { t: 'ball', x: 5.68, y: 5.48, z: 1.55, r: 0.95 },
    trunk2: { t: 'box', x: 0.9, y: 5.75, z: 0, w: 0.22, d: 0.22, h: 0.6, c: '#8B5A3C' },
    tree2: { t: 'ball', x: 1.01, y: 5.86, z: 1.2, r: 0.7 },
    bush: { t: 'ball', x: 4.9, y: 0.9, z: 0.35, r: 0.42 },
  };
}
export const idealOrder = o => [o.slab, ...o.path, o.bush, o.body, o.win1, o.win2, o.door, o.win3, o.roof, o.chim, o.trunk2, o.tree2, o.trunk1, o.tree1];

// "Mine": a small studio with a stage light and a mic stand.
export function studioIsland() {
  return [
    { t: 'box', x: 0, y: 0, z: -0.9, w: 7, d: 7, h: 0.9, c: '#B98A63', ct: '#D9CFC2' },
    { t: 'box', x: 1.2, y: 1.2, z: 0, w: 3.6, d: 3.0, h: 1.7, c: '#33353D' },
    { t: 'box', x: 1.1, y: 1.1, z: 1.7, w: 3.8, d: 3.2, h: 0.18, c: '#22242A' },
    { t: 'decal', face: 'left', p: 4.2, a: 1.6, b: 3.6, z0: 0.6, z1: 1.3, c: '#B07CFF', lit: 0.6 },
    { t: 'decal', face: 'right', p: 4.8, a: 2.2, b: 2.9, z0: 0, z1: 1.2, c: '#C98A4B' },
    { t: 'box', x: 5.3, y: 4.6, z: 0, w: 1.2, d: 1.2, h: 0.25, c: '#5A5D66' },
    { t: 'box', x: 5.85, y: 5.15, z: 0.25, w: 0.08, d: 0.08, h: 1.5, c: '#9AA0A8' },
    { t: 'ball', x: 5.89, y: 5.19, z: 1.85, r: 0.22, grad: 'metal' },
    { t: 'box', x: 0.6, y: 5.2, z: 0, w: 0.1, d: 0.1, h: 2.2, c: '#9AA0A8' },
    { t: 'box', x: 0.45, y: 5.05, z: 2.2, w: 0.4, d: 0.4, h: 0.3, c: '#2A2C31' },
    { t: 'ball', x: 2.3, y: 5.6, z: 0.4, r: 0.45 },
  ];
}

// Scaffolding around the house body (front and back halves, so it wraps the house in depth)
export function scaffold(H = 3.6) {
  const X0 = 1.3, X1 = 5.2, Y0 = 1.5, Y1 = 4.9, pole = (x, y) => ({ t: 'box', x, y, z: 0, w: 0.12, d: 0.12, h: H, c: '#B7BEC7' });
  const back = [pole(X0, Y0), pole((X0 + X1) / 2, Y0), pole(X1, Y0), pole(X0, (Y0 + Y1) / 2), pole(X0, Y1)];
  const front = [pole(X1, (Y0 + Y1) / 2), pole((X0 + X1) / 2, Y1), pole(X1, Y1)];
  const planks = [];
  for (const z of [1.0, 2.05, 3.1]) {
    planks.push({ t: 'box', x: X0 - 0.1, y: Y0 - 0.2, z, w: 0.3, d: Y1 - Y0 + 0.4, h: 0.08, c: '#D9A35B', back: true });
    planks.push({ t: 'box', x: X0 - 0.2, y: Y0 - 0.1, z, w: X1 - X0 + 0.4, d: 0.3, h: 0.08, c: '#D9A35B', back: true });
    planks.push({ t: 'box', x: X1 - 0.1, y: Y0 - 0.2, z, w: 0.34, d: Y1 - Y0 + 0.4, h: 0.08, c: '#D9A35B' });
    planks.push({ t: 'box', x: X0 - 0.2, y: Y1 - 0.1, z, w: X1 - X0 + 0.4, d: 0.34, h: 0.08, c: '#D9A35B' });
  }
  return { back, front, planks };
}
