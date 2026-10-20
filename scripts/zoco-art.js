#!/usr/bin/env node
// zoco-art.js — El Zoco's art slots (2026-10-20, his words: "they look too plain and boring now… it should feel like the
// 3D avatar is there waiting for you"). Swapping in new art is DATA: drop the files with these names, run this script.
//
//   public/assets/zoco/full/<id>-g.webp     the glossy platform-look picture, full body, transparent (≤ 720 px tall, ≤ 150 KB)
//   public/assets/zoco/avatar/<id>-g.webp   its round head, 256 × 256, cut around the face (≤ 30 KB)
//   public/assets/zoco/anim/<id>-still.webp the idle loop's first frame (≤ 150 KB): shown first, and with reduced motion
//   public/assets/zoco/anim/<id>.webp       the idle «waiting» loop, animated WebP (~520 px, ~0.5-1 MB, ≤ 1.5 MB): laptops
//   public/assets/zoco/anim/<id>-lite.webp  the same loop for phones (~240 px, ~250 KB, ≤ 400 KB)
// (<id> = the catalog's id, core/zoco.js CATALOG: dralingo-emperador-qin, hamdan-3d, perro-de-adric…; the loop and its
// still come from video_tools/canva_anim.py: name.webp + name-still.webp, the lite one with --size 240 --fps 12 --quality 62)
//
// It writes public/js/saga.js's ZOCO_ART / ZOCO_ANIM (between `// <zoco-art>` and `// </zoco-art>`) with a ?v= per file
// (Cloudflare keeps /assets/* 2 h: a picture re-made under the same name still reaches phones at once), keeps any hx / fx
// set there by hand, and bumps `js/saga.js?v=` in every page that loads it when the maps changed. A file over its size
// limit is refused (exit 1, nothing written).
//   node scripts/zoco-art.js            write the maps (and the bumps) from the files on disk
//   node scripts/zoco-art.js --check    write nothing; exit 1 when the maps and the files disagree (scripts/test-zoco.js)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const ZD = path.join(PUB, 'assets', 'zoco');
const SAGA = path.join(PUB, 'js', 'saga.js');
const KB = 1024;
const LIMIT = { 'full-g': 150 * KB, 'avatar-g': 30 * KB, still: 150 * KB, loop: 1536 * KB, lite: 400 * KB };

// a WebP's size in pixels from its header (lossy VP8, lossless VP8L, extended VP8X: animations and alpha)
function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), animated: !!(b[20] & 2) };
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff), animated: false }; }
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, animated: false };
  return null;
}
const stamp = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
const url = (file) => '/' + path.relative(PUB, file).split(path.sep).join('/') + '?v=' + stamp(file);
const r2 = (n) => Math.round(n * 100) / 100;

function readMaps(src) {
  const m = /\/\/ <zoco-art>\r?\n([\s\S]*?)\r?\n\s*\/\/ <\/zoco-art>/.exec(src);   // (a Windows checkout has CRLF)
  if (!m) throw new Error('saga.js has no // <zoco-art> … // </zoco-art> block');
  const one = (name) => { const x = new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\});').exec(m[1]); return x ? JSON.parse(x[1]) : {}; };
  return { art: one('ZOCO_ART'), anim: one('ZOCO_ANIM'), block: m[0] };
}

// what the files on disk say → { art, anim, problems: [..] }
function build(prev) {
  const ids = require(path.join(ROOT, 'core', 'zoco')).CATALOG.map((x) => x.id);
  const art = {}, anim = {}, problems = [];
  const keep = (old, out) => { ['hx', 'fx'].forEach((k) => { if (old && Number.isFinite(old[k])) out[k] = old[k]; }); return out; };
  const check = (file, kind) => {
    const n = fs.statSync(file).size;
    if (n > LIMIT[kind]) problems.push(path.relative(ROOT, file) + ' is ' + Math.round(n / KB) + ' KB (at most ' + Math.round(LIMIT[kind] / KB) + ' KB)');
    const s = webpSize(file);
    if (!s) problems.push(path.relative(ROOT, file) + ' is not a WebP');
    return s;
  };
  ids.forEach((id) => {
    const full = path.join(ZD, 'full', id + '-g.webp'), head = path.join(ZD, 'avatar', id + '-g.webp');
    if (fs.existsSync(full) || fs.existsSync(head)) {
      const e = {};
      if (fs.existsSync(full)) { const s = check(full, 'full-g'); e.full = url(full); if (s) e.ar = r2(s.w / s.h); }
      if (fs.existsSync(head)) { const s = check(head, 'avatar-g'); e.avatar = url(head); if (s && s.w !== s.h) problems.push(path.relative(ROOT, head) + ' is not square'); }
      art[id] = keep(prev.art[id], e);
    }
    const loop = path.join(ZD, 'anim', id + '.webp'), still = path.join(ZD, 'anim', id + '-still.webp'), lite = path.join(ZD, 'anim', id + '-lite.webp');
    if (fs.existsSync(loop) || fs.existsSync(still) || fs.existsSync(lite)) {
      if (!fs.existsSync(loop) || !fs.existsSync(still)) { problems.push('anim/' + id + ': needs both ' + id + '.webp and ' + id + '-still.webp'); return; }
      const sl = check(loop, 'loop'), ss = check(still, 'still');
      if (sl && !sl.animated) problems.push('anim/' + id + '.webp is not animated');
      const e = { still: url(still), full: url(loop) };
      if (fs.existsSync(lite)) { const s = check(lite, 'lite'); if (s && !s.animated) problems.push('anim/' + id + '-lite.webp is not animated'); e.lite = url(lite); }
      if (ss) e.ar = r2(ss.w / ss.h);
      anim[id] = keep(prev.anim[id], e);
    }
  });
  // files that match no catalog id (a typo in a name would silently show nothing)
  [['full', /-g\.webp$/], ['avatar', /-g\.webp$/], ['anim', /\.webp$/]].forEach(([dir, re]) => {
    const d = path.join(ZD, dir);
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

function pagesWithSaga() {
  const out = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') walk(p); } else if (/\.html$/.test(e.name)) out.push(p);
  });
  walk(PUB);
  const prot = path.join(ROOT, 'protected', 'pages');
  if (fs.existsSync(prot)) walk(prot);
  return out.filter((p) => /js\/saga\.js\?v=/.test(fs.readFileSync(p, 'utf8')));
}

function main() {
  const CHECK = process.argv.includes('--check');
  const src = fs.readFileSync(SAGA, 'utf8');
  const prev = readMaps(src);
  const { art, anim, problems } = build(prev);
  const same = JSON.stringify(art) === JSON.stringify(prev.art) && JSON.stringify(anim) === JSON.stringify(prev.anim);
  const say = 'glossy pictures: ' + (Object.keys(art).join(', ') || 'none') + ' · idle loops: ' + (Object.keys(anim).join(', ') || 'none');
  if (problems.length) { console.log('✖ ' + problems.join('\n✖ ')); process.exit(1); }
  if (CHECK) {
    console.log((same ? '✓ saga.js matches the files · ' : '✖ saga.js does not match the files (run node scripts/zoco-art.js) · ') + say);
    process.exit(same ? 0 : 1);
  }
  if (same) { console.log('nothing to do · ' + say); return; }
  fs.writeFileSync(SAGA, src.replace(prev.block, block(art, anim, src.includes('\r\n') ? '\r\n' : '\n')));
  const v = new Date().toISOString().slice(0, 10).replace(/-/g, '') + 'za' + crypto.createHash('sha1').update(JSON.stringify([art, anim])).digest('hex').slice(0, 4);
  const pages = pagesWithSaga();
  pages.forEach((p) => fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/js\/saga\.js\?v=[A-Za-z0-9_-]+/g, 'js/saga.js?v=' + v)));
  console.log('✓ saga.js written · ' + say + '\n✓ js/saga.js?v=' + v + ' in ' + pages.length + ' pages (' + pages.map((p) => path.relative(ROOT, p)).join(', ') + ')');
}

if (require.main === module) main();
module.exports = { build, readMaps, webpSize, LIMIT };
