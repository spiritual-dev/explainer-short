#!/usr/bin/env node
/**
 * Portable renderer: drive window.render(t) with playwright-core + system Chrome,
 * stitch frames with ffmpeg. No private toolkit required.
 *
 * Usage:
 *   node scripts/render.mjs --dir sample --preset warm
 *   node scripts/render.mjs --dir template --out template/out/video.mp4
 *   node scripts/render.mjs --dir /path/to/copied-project
 */
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import {
  mkdirSync, writeFileSync, existsSync, copyFileSync, rmSync, readFileSync, statSync,
} from 'fs';
import { join, dirname, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}
function flag(name) {
  return process.argv.includes(name);
}

const projectDir = resolve(arg('--dir', join(ROOT, 'sample')));
const preset = arg('--preset', process.env.PRESET || '');
const outMp4 = resolve(arg('--out', join(projectDir, 'out', (preset || 'video') + '.mp4')));
const fps = Number(arg('--fps', process.env.FPS || 30));
const keepFrames = flag('--keep-frames');

if (!existsSync(join(projectDir, 'index.html'))) {
  console.error('No index.html in', projectDir);
  process.exit(1);
}

if (preset) {
  const themeSrc = join(projectDir, 'themes', `${preset}.json`);
  if (!existsSync(themeSrc)) {
    console.error('missing preset', themeSrc);
    process.exit(1);
  }
  copyFileSync(themeSrc, join(projectDir, 'theme.json'));
}

const require = createRequire(import.meta.url);
let chromium;
const tryPaths = [
  join(ROOT, 'node_modules/playwright-core'),
  join(ROOT, '..', 'node_modules/playwright-core'), // skill root when this file lives in template/scripts
  join(projectDir, 'node_modules/playwright-core'),
  join(process.cwd(), 'node_modules/playwright-core'),
];
for (const p of tryPaths) {
  try { chromium = require(join(p, 'index.js')).chromium; break; } catch {}
}
if (!chromium) {
  console.error('playwright-core not found. From the skill root run:');
  console.error('  npm install');
  process.exit(1);
}

const chromePaths = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
let executablePath = null;
for (const p of chromePaths) if (existsSync(p)) { executablePath = p; break; }
if (!executablePath) {
  console.error('No Chrome/Chromium found. Set CHROME_PATH.');
  process.exit(1);
}

const outDir = dirname(outMp4);
const framesDir = join(outDir, 'frames');
mkdirSync(framesDir, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};

function startServer(root) {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      let url = decodeURIComponent(req.url.split('?')[0]);
      if (url === '/') url = '/index.html';
      const fp = join(root, url);
      if (!fp.startsWith(root) || !existsSync(fp) || statSync(fp).isDirectory()) {
        const isJson = extname(url) === '.json';
        res.writeHead(404, { 'Content-Type': isJson ? 'application/json' : 'text/plain' });
        res.end(isJson ? 'null' : 'not found');
        return;
      }
      const body = readFileSync(fp);
      res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
      res.end(body);
    });
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

const server = await startServer(projectDir);
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log('serving', projectDir, 'at', base);

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    const t = msg.text();
    if (/favicon|Failed to load resource.*404/i.test(t)) return;
    errors.push(t); console.error('[console]', t);
  }
});
page.on('pageerror', err => { errors.push(err.message); console.error('[pageerror]', err.message); });
page.on('requestfailed', req => {
  const u = req.url();
  if (/favicon/i.test(u)) return;
  if (/\/(theme\.json|theme\.js|main\.js|index\.html|fonts\/)/.test(u)) {
    errors.push('requestfailed ' + u); console.error('[requestfailed]', u, req.failure()?.errorText);
  }
});

await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
if (errors.length) {
  console.error('page errors before READY:', errors);
  await browser.close(); server.close(); process.exit(2);
}
await page.waitForFunction(() => window.READY === true, null, { timeout: 20000 });
const DUR = await page.evaluate(() => window.DUR || 12);
const total = Math.round(DUR * fps);
console.log(`rendering: ${total} frames @ ${fps}fps (${DUR}s)`);

for (let i = 0; i < total; i++) {
  const t = i / fps;
  await page.evaluate(async (tt) => { await window.render(tt); }, t);
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  writeFileSync(join(framesDir, `f${String(i).padStart(5, '0')}.png`), buf);
  if (i % 60 === 0) process.stdout.write(`  frame ${i}/${total}\n`);
}
await browser.close();
server.close();

if (errors.length) {
  console.error('console errors during render:', errors);
  process.exit(2);
}

const r = spawnSync('ffmpeg', [
  '-y', '-framerate', String(fps),
  '-i', join(framesDir, 'f%05d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
  '-movflags', '+faststart', outMp4,
], { encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log('wrote', outMp4);

const mid = Math.floor(total / 2);
copyFileSync(join(framesDir, `f${String(0).padStart(5, '0')}.png`), join(outDir, 'frame-001.png'));
copyFileSync(join(framesDir, `f${String(mid).padStart(5, '0')}.png`), join(outDir, 'frame-mid.png'));
if (!keepFrames) {
  rmSync(framesDir, { recursive: true, force: true });
}
console.log('preview stills ready');
