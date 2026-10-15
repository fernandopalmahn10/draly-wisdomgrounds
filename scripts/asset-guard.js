#!/usr/bin/env node
// Asset guard (2026-10-12, his "automate as much as you can"): keeps the site light as games and pictures pile up.
// Checks the media about to be committed (staged files; `--all` = everything tracked) against the asset rules in
// mochi-mash/CLAUDE.md: no file over 10 MB, no BMP/TIFF, still pictures as WebP under ~300 KB (animations under 2 MB),
// sounds under 2 MB (exam recordings exempt). Exit 1 = a hard rule broken (fix before deploying); warnings only print.
//   node scripts/asset-guard.js          node scripts/asset-guard.js --all
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const all = process.argv.includes('--all');
// protected/ = the locked simulation media (2026-10-15, core/sim-lock.js): deployed too, same rules
const list = all
  ? execSync('git ls-files -z public/assets protected', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0')
  : execSync('git diff --cached --name-only --diff-filter=AM -z', { cwd: ROOT, encoding: 'utf8' }).split('\0');
const files = list.filter((f) => f && (f.startsWith('public/assets/') || (f.startsWith('protected/') && !f.startsWith('protected/pages/'))));
const MB = 1048576;
const errors = [], warns = [];
for (const f of files) {
  let size;
  try { size = fs.statSync(path.join(ROOT, f)).size; } catch (_) { continue; }
  const ext = path.extname(f).toLowerCase();
  const exam = /SIMULATIONS\//.test(f);                       // official recordings: long by nature
  const anim = /[\\/]anim[\\/]/.test(f);                       // animated WebP clips
  if (size > 10 * MB && !(exam && /\.(m4a|mp3)$/.test(ext))) errors.push(`${f}: ${(size / MB).toFixed(1)} MB (max 10 MB per file)`);
  if (['.bmp', '.tif', '.tiff'].includes(ext)) errors.push(`${f}: ${ext} is uncompressed, save it as .webp`);
  if (['.png', '.jpg', '.jpeg'].includes(ext) && size > 300 * 1024) warns.push(`${f}: ${(size / 1024).toFixed(0)} KB ${ext}, a .webp is usually 5-10× smaller`);
  if (ext === '.webp' && !anim && size > 300 * 1024) warns.push(`${f}: ${(size / 1024).toFixed(0)} KB still picture (aim for < 300 KB: 720-1200 px, quality ~82)`);
  if (ext === '.webp' && anim && size > 2 * MB) warns.push(`${f}: ${(size / MB).toFixed(1)} MB animation (aim for < 2 MB)`);
  if (['.mp3', '.m4a', '.ogg', '.wav'].includes(ext) && !exam && size > 2 * MB) warns.push(`${f}: ${(size / MB).toFixed(1)} MB sound (aim for < 2 MB; music loops 96-128 kbps)`);
  if (ext === '.wav') errors.push(`${f}: .wav is uncompressed, save it as .mp3`);
  if (['.gif', '.mp4', '.glb'].includes(ext) && size > 2 * MB) warns.push(`${f}: ${(size / MB).toFixed(1)} MB ${ext} (heavy for phones: animated WebP or a smaller file)`);
}
console.log(`asset guard: ${files.length} file(s) checked${all ? ' (all tracked media)' : ' (staged)'}, ${errors.length} problem(s), ${warns.length} warning(s)`);
errors.forEach((e) => console.log('  ✖ ' + e));
warns.forEach((w) => console.log('  ⚠ ' + w));
process.exit(errors.length ? 1 : 0);
