#!/usr/bin/env node
/**
 * Theme demo convenience wrapper.
 * Usage: node scripts/render_sample.mjs [preset] [outdir]
 */
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const preset = process.argv[2] || process.env.PRESET || 'warm';
const outDir = process.argv[3] || process.env.OUT || join(ROOT, 'sample', 'out', preset);
mkdirSync(outDir, { recursive: true });
const outMp4 = join(outDir, `${preset}.mp4`);
const r = spawnSync(process.execPath, [
  join(__dirname, 'render.mjs'),
  '--dir', join(ROOT, 'sample'),
  '--preset', preset,
  '--out', outMp4,
], { stdio: 'inherit' });
process.exit(r.status ?? 1);
