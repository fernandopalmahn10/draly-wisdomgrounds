#!/usr/bin/env node
// zoco-art.js — El Zoco's art slots (2026-10-20, his words: "they look too plain and boring now… it should feel like the
// 3D avatar is there waiting for you"). Swapping in new art is DATA: drop the files with these names, run this script.
//
//   public/assets/zoco/full/<id>-g.webp     the glossy platform-look picture, full body, transparent (≤ 720 px tall, ≤ 150 KB)
//   public/assets/zoco/avatar/<id>-g.webp   its round head, 256 × 256, cut around the face (≤ 30 KB)
//   public/assets/zoco/anim/<id>-still.webp the idle loop's first frame (≤ 150 KB): shown first, and with reduced motion
//   public/assets/zoco/anim/<id>.webp       the idle «waiting» loop, animated WebP (~520 px, ~0.5-1 MB, ≤ 1.5 MB): laptops
//   public/assets/zoco/anim/<id>-lite.webp  the same loop for phones (~240 px, ~250 KB, ≤ 400 KB): REQUIRED with a loop
// (<id> = the catalog's id, core/zoco.js CATALOG: dralingo-emperador-qin, hamdan-3d, perro-de-adric…; the loop and its
// still come from video_tools/canva_anim.py: name.webp + name-still.webp, the lite one with --size 240 --fps 12 --quality 62)
//
// It writes public/js/saga.js's ZOCO_ART / ZOCO_ANIM (between `// <zoco-art>` and `// </zoco-art>`) with a ?v= per file
// (Cloudflare keeps /assets/* 2 h: a picture re-made under the same name still reaches phones at once), keeps any hx / fx
// set there by hand, and bumps `js/saga.js?v=` in every page that loads it when the maps changed. A file over its size
// limit, with a name no character has, not a WebP, or a loop without its still or its lite one is refused (exit 1, nothing
// written). saga.js is checked as JavaScript before it is replaced, and replaced through a temp file + rename.
//   node scripts/zoco-art.js                  write the maps (and the bumps) from the files on disk
//   node scripts/zoco-art.js --check          write nothing; exit 1 when the maps and the files disagree (test-zoco)
//   node scripts/zoco-art.js --root <folder>  work on another copy of the platform (test-zoco runs its write path there)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const KB = 1024;
const LIMIT = { 'full-g': 150 * KB, 'avatar-g': 30 * KB, still: 150 * KB, loop: 1536 * KB, lite: 400 * KB };
// the catalog is code: always this checkout's
const catalogIds = () => require(path.join(__dirname, '..', 'core', 'zoco')).CATALOG.map((x) => x.id);

const paths = (root) => {
  const PUB = path.join(root, 'public');
  return { ROOT: root, PUB, ZD: path.join(PUB, 'assets', 'zoco'), SAGA: path.join(PUB, 'js', 'saga.js') };
};

// a WebP's size in pixels from its first 32 bytes only (lossy VP8, lossless VP8L, extended VP8X: animations and alpha)
function webpSize(file) {
  const b = Buffer.alloc(32);
  const fd = fs.openSync(file, 'r');
  let n = 0;
  try { n = fs.readSync(fd, b, 0, 32, 0); } finally { fs.closeSync(fd); }
  if (n < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), animated: !!(b[20] & 2) };
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff), animated: false }; }
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, animated: false };
  return null;
}
const stamp = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
const r2 = (n) => Math.round(n * 100) / 100;

// the two maps as they stand in saga.js (a hand-edited map that is not JSON is named with its line)
function readMaps(src) {
  const m = /\/\/ <zoco-art>\r?\n([\s\S]*?)\r?\n\s*\/\/ <\/zoco-art>/.exec(src);   // (a Windows checkout has CRLF)
  if (!m) throw new Error('saga.js has no // <zoco-art> … // </zoco-art> block');
  const startLine = src.slice(0, m.index).split('\n').length;
  const one = (name) => {
    const x = new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\});').exec(m[1]);
    if (!x) throw new Error('saga.js: ' + name + ' is missing from the // <zoco-art> block (line ' + startLine + ')');
    try { return JSON.parse(x[1]); } catch (e) {
      const line = startLine + m[1].slice(0, x.index).split('\n').length;
      throw new Error('saga.js line ' + line + ': ' + name + ' is not JSON any more (' + e.message + '); only "hx" / "fx" numbers may be edited by hand');
    }
  };
  return { art: one('ZOCO_ART'), anim: one('ZOCO_ANIM'), block: m[0] };
}

// what the files on disk say → { art, anim, problems: [..] }
function build(prev, root) {
  const P = paths(root || path.join(__dirname, '..'));
  const ids = catalogIds();
  const art = {}, anim = {}, problems = [];
  const keep = (old, out) => { ['hx', 'fx'].forEach((k) => { if (old && Number.isFinite(old[k])) out[k] = old[k]; }); return out; };
  const rel = (f) => path.relative(P.ROOT, f).split(path.sep).join('/');
  const url = (f) => '/' + path.relative(P.PUB, f).split(path.sep).join('/') + '?v=' + stamp(f);
  // a file's size first (an oversized one is refused before it is ever read), then its header
  const check = (file, kind) => {
    const n = fs.statSync(file).size;
    if (n > LIMIT[kind]) { problems.push(rel(file) + ' is ' + Math.round(n / KB) + ' KB (at most ' + Math.round(LIMIT[kind] / KB) + ' KB)'); return null; }
    const s = webpSize(file);
    if (!s) problems.push(rel(file) + ' is not a WebP');
    return s;
  };
  const has = (f) => fs.existsSync(f) && fs.statSync(f).isFile();
  ids.forEach((id) => {
    const full = path.join(P.ZD, 'full', id + '-g.webp'), head = path.join(P.ZD, 'avatar', id + '-g.webp');
    if (has(full) || has(head)) {
      const e = {};
      if (has(full)) { const s = check(full, 'full-g'); if (s) { e.full = url(full); e.ar = r2(s.w / s.h); } }
      if (has(head)) { const s = check(head, 'avatar-g'); if (s) { if (s.w !== s.h) problems.push(rel(head) + ' is not square'); e.avatar = url(head); } }
      art[id] = keep(prev.art[id], e);
    }
    const loop = path.join(P.ZD, 'anim', id + '.webp'), still = path.join(P.ZD, 'anim', id + '-still.webp'), lite = path.join(P.ZD, 'anim', id + '-lite.webp');
    if (has(loop) || has(still) || has(lite)) {
      // (phones must never get the ~1 MB loop: a loop without its lite one is refused, like one without its still)
      const miss = [[loop, id + '.webp'], [still, id + '-still.webp'], [lite, id + '-lite.webp']].filter(([f]) => !has(f)).map((x) => x[1]);
      if (miss.length) { problems.push('anim/' + id + ': ' + miss.join(' and ') + ' missing (a loop needs its still and its lite one)'); return; }
      const sl = check(loop, 'loop'), ss = check(still, 'still'), sm = check(lite, 'lite');
      if (sl && !sl.animated) problems.push('anim/' + id + '.webp is not animated');
      if (sm && !sm.animated) problems.push('anim/' + id + '-lite.webp is not animated');
      if (!sl || !ss || !sm) return;
      anim[id] = keep(prev.anim[id], { still: url(still), full: url(loop), lite: url(lite), ar: r2(ss.w / ss.h) });
    }
  });
  // files that match no catalog id (a typo in a name would silently show nothing)
  [['full', /-g\.webp$/], ['avatar', /-g\.webp$/], ['anim', /\.webp$/]].forEach(([dir, re]) => {
    const d = path.join(P.ZD, dir);
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d).filter((f) => re.test(f)).forEach((f) => {
      const id = f.replace(/(-g|-still|-lite)?\.webp$/, '');
      if (!ids.includes(id)) problems.push(dir + '/' + f + ': no character of the catalog is called «' + id + '»');
    });
  });
  return { art, anim, problems };
}

const block = (art, anim, nl) => {
  const map = (o) => {
    const ks = Object.keys(o);
    return ks.length ? '{' + nl + ks.map((k) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(o[k]) + ',').join(nl).replace(/,$/, '') + nl + '  }' : '{}';
  };
  return '// <zoco-art>' + nl + '  const ZOCO_ART = ' + map(art) + ';' + nl + '  const ZOCO_ANIM = ' + map(anim) + ';' + nl + '  // </zoco-art>';
};

// every page that loads saga.js with a ?v= (public/, protected/pages/)
function pagesWithSaga(root) {
  const P = paths(root || path.join(__dirname, '..'));
  const out = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') walk(p); } else if (/\.html$/.test(e.name)) out.push(p);
  });
  if (fs.existsSync(P.PUB)) walk(P.PUB);
  const prot = path.join(P.ROOT, 'protected', 'pages');
  if (fs.existsSync(prot)) walk(prot);
  return out.filter((p) => /js\/saga\.js\?v=/.test(fs.readFileSync(p, 'utf8')));
}

// replace a file through a temp file + rename (a crash never leaves it half written)
function writeSafe(file, text) {
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// → { code, out } (no process.exit: test-zoco calls it too)
function run(opts) {
  const o = opts || {};
  const P = paths(o.root || path.join(__dirname, '..'));
  const src = fs.readFileSync(P.SAGA, 'utf8');
  let prev;
  try { prev = readMaps(src); } catch (e) { return { code: 1, out: '✖ ' + e.message }; }
  const { art, anim, problems } = build(prev, P.ROOT);
  const same = JSON.stringify(art) === JSON.stringify(prev.art) && JSON.stringify(anim) === JSON.stringify(prev.anim);
  const say = 'glossy pictures: ' + (Object.keys(art).join(', ') || 'none') + ' · idle loops: ' + (Object.keys(anim).join(', ') || 'none');
  if (problems.length) return { code: 1, out: '✖ ' + problems.join('\n✖ ') };
  if (o.check) return { code: same ? 0 : 1, out: (same ? '✓ saga.js matches the files · ' : '✖ saga.js does not match the files (run node scripts/zoco-art.js) · ') + say };
  if (same) return { code: 0, out: 'nothing to do · ' + say };
  const next = src.replace(prev.block, () => block(art, anim, src.includes('\r\n') ? '\r\n' : '\n'));
  // (the new saga.js must still be JavaScript, and must still read back to the same maps)
  try { new vm.Script(next, { filename: 'saga.js' }); } catch (e) { return { code: 1, out: '✖ the new saga.js would not run (' + e.message + '): nothing written' }; }
  const back = readMaps(next);
  if (JSON.stringify(back.art) !== JSON.stringify(art) || JSON.stringify(back.anim) !== JSON.stringify(anim)) return { code: 1, out: '✖ the new maps did not read back: nothing written' };
  writeSafe(P.SAGA, next);
  const v = new Date().toISOString().slice(0, 10).replace(/-/g, '') + 'za' + crypto.createHash('sha1').update(JSON.stringify([art, anim])).digest('hex').slice(0, 4);
  const pages = pagesWithSaga(P.ROOT);
  pages.forEach((p) => writeSafe(p, fs.readFileSync(p, 'utf8').replace(/js\/saga\.js\?v=[A-Za-z0-9_-]+/g, () => 'js/saga.js?v=' + v)));
  return { code: 0, out: '✓ saga.js written · ' + say + '\n✓ js/saga.js?v=' + v + ' in ' + pages.length + ' pages (' + pages.map((p) => path.relative(P.ROOT, p)).join(', ') + ')', v, pages };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const i = a.indexOf('--root');
  const r = run({ check: a.includes('--check'), root: i >= 0 && a[i + 1] ? path.resolve(a[i + 1]) : null });
  console.log(r.out);
  process.exit(r.code);
}
module.exports = { build, readMaps, webpSize, pagesWithSaga, run, LIMIT };
