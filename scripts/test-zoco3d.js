#!/usr/bin/env node
// test-zoco3d.js — El Zoco in real 3D (2026-10-20, his words: "it looked like a display in 3D… each character… you can
// touch it and move it"; his pick «Real 3D, try 3 first»). No server, no browser: the rules the page lives by.
//   1 · the manifest (saga.js ZOCO_3D): only characters on sale, a file of /assets/zoco/3d/ named like the character,
//       a ?v= on it; skin3d() never yields a value out of range (a hand-edited map, an id like __proto__)
//   2 · who never tries the 3D (saga.js skin3dBlock, mi-dralingo.js want3d): reduced motion, Save-Data, no WebGL, a phone
//       with < 2 GB, a model that failed on this page; everything else may try
//   3 · the models stay off git until his «sube» (.gitignore, `git ls-files`), and when one is on this disk: glTF 2, Draco +
//       WebP only, no skeleton or animation, ≤ 1.6 MB, its ?v= = the start of its sha1
//   4 · the module (js/zoco3d/stage.js): three.js only through the import map (homework.html, the same version as
//       /audios and as the Draco decoder), pixel ratio ≤ 2, nothing drawn while hidden or off screen, everything
//       disposed and the context given back, the wheel held only while it really zooms (never a trapped page), a
//       vertical swipe left to the page (touch-action: pan-y), its words from the page (Spanish there, English in
//       hw-i18n)
//   node scripts/test-zoco3d.js
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);

const Saga = require('../public/js/saga');
const Zoco = require('../core/zoco');

// ── 1 · the manifest ──
section('1 · the manifest (saga.js ZOCO_3D)');
const ids = Object.keys(Saga.ZOCO_3D || {});
ok(ids.length >= 1, 'ZOCO_3D lists characters');
const catalog = (Zoco.CATALOG || Zoco.catalog || []);
const onSale = (id) => {
  const x = Array.isArray(catalog) ? catalog.find((c) => c.id === id) : null;
  return x ? !x.hold : !!(Zoco.item && Zoco.item(id));
};
for (const id of ids) {
  const m = Saga.skin3d(id);
  ok(!!Saga.zoco(id), id + ': a character of El Zoco (saga.js ZOCO)');
  ok(onSale(id), id + ': on sale in core/zoco.js');
  ok(m && m.id === id, id + ': skin3d gives its model');
  ok(m && new RegExp('^/assets/zoco/3d/' + id + '\\.glb\\?v=[0-9a-f]{8}$').test(m.glb), id + ': its file is /assets/zoco/3d/' + id + '.glb?v=<hash> (' + (m && m.glb) + ')');
  ok(m && m.coat >= 0 && m.coat <= 1 && m.rough[0] >= 0 && m.rough[0] <= m.rough[1] && m.rough[1] <= 1, id + ': its look in range');
}
for (const bad of [null, undefined, '', '__proto__', 'constructor', 'toString', 'nadie', 'dralingo-clasico', 'dralingo']) {
  ok(Saga.skin3d(bad) === null, 'no model for ' + JSON.stringify(bad));
}
// a hand-edited map: wrong paths give nothing, wild numbers are kept in range
{
  const src = read('public/js/saga.js').replace(/const ZOCO_3D = \{[\s\S]*?\n  \};/, "const ZOCO_3D = {\n" +
    "    'dralingo-sheikh': { glb: 'https://elsewhere.example/x.glb', coat: 0.2 },\n" +
    "    'hamdan-3d': { glb: '/assets/zoco/3d/hamdan-3d.glb?v=abc', coat: 9, rough: [-3, 'x'], yaw: 99 },\n" +
    "    'panda-3d': { glb: '/assets/zoco/../../server.js' },\n" +
    "    'nadie': { glb: '/assets/zoco/3d/nadie.glb' },\n  };");
  const ctx = { module: { exports: {} } };
  ctx.exports = ctx.module.exports;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'saga-edited.js' });
  const S2 = ctx.module.exports && ctx.module.exports.skin3d ? ctx.module.exports : ctx.Saga;
  ok(S2 && S2.skin3d('dralingo-sheikh') === null, 'an edited map: a file elsewhere gives no model');
  ok(S2 && S2.skin3d('panda-3d') === null, 'an edited map: a path out of /assets/zoco/3d/ gives no model');
  ok(S2 && S2.skin3d('nadie') === null, 'an edited map: a name that is no character gives no model');
  const h = S2 && S2.skin3d('hamdan-3d');
  ok(h && h.coat === 1 && h.rough[0] === 0 && h.rough[1] >= h.rough[0] && h.rough[1] <= 1 && Math.abs(h.yaw) <= Math.PI, 'an edited map: wild numbers kept in range');
}

// ── 2 · who never tries ──
section('2 · who never tries the 3D (the picture and its loop stay)');
const fine = { reduced: false, saveData: false, webgl: true, memory: 4, failed: false };
ok(Saga.skin3dBlock(fine) === null, 'a phone that can: may try');
ok(Saga.skin3dBlock(Object.assign({}, fine, { memory: undefined })) === null, 'a browser that does not say its memory: may try');
ok(Saga.skin3dBlock(Object.assign({}, fine, { reduced: true })) === 'reduced', 'reduced motion: never');
ok(Saga.skin3dBlock(Object.assign({}, fine, { saveData: true })) === 'save-data', 'Save-Data: never');
ok(Saga.skin3dBlock(Object.assign({}, fine, { webgl: false })) === 'webgl', 'no WebGL: never');
ok(Saga.skin3dBlock(Object.assign({}, fine, { memory: 1 })) === 'memory', 'a phone with 1 GB: never');
ok(Saga.skin3dBlock(Object.assign({}, fine, { failed: true })) === 'failed', 'a model that already failed on this page: not again');
ok(Saga.skin3dBlock(null) === 'webgl', 'nothing known: never');
// the page's own decision (mi-dralingo.js want3d) through a sandbox
function home(env) {
  const noop = () => {};
  const ctx = { console, setTimeout, clearTimeout, URL };
  ctx.window = ctx; ctx.self = ctx;
  ctx.document = {
    addEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    body: { classList: { add: noop, remove: noop, contains: () => false } },
    createElement: () => ({ getContext: () => (env.webgl ? { getExtension: () => ({ loseContext: noop }) } : null) }),
  };
  ctx.addEventListener = noop;
  ctx.matchMedia = (q) => ({ matches: /reduce/.test(q) ? !!env.reduced : false });
  ctx.navigator = { connection: { saveData: !!env.saveData }, deviceMemory: env.memory };
  ctx.location = { hash: '', pathname: '/homework', search: '' };
  ctx.history = { replaceState: noop };
  vm.createContext(ctx);
  vm.runInContext(read('public/js/saga.js'), ctx, { filename: 'saga.js' });
  if (!ctx.Saga && ctx.module) ctx.Saga = ctx.module.exports;
  for (const f of ['public/js/papas-plan.js', 'public/js/papas.js', 'public/js/mi-dralingo.js']) vm.runInContext(read(f), ctx, { filename: f });
  return ctx.DralyHome;
}
{
  const H = home({ webgl: true, memory: 4 });
  ok(H && H.want3d && H.want3d('dralingo-sheikh') && H.want3d('dralingo-sheikh').glb === Saga.skin3d('dralingo-sheikh').glb, 'the page: a 3D character on a phone that can → its model');
  ok(H && H.want3d('dralingo-emperador-qin') === null, 'the page: a character without a model → the picture');
  ok(home({ webgl: true, reduced: true }).want3d('dralingo-sheikh') === null, 'the page: reduced motion → the picture');
  ok(home({ webgl: true, saveData: true }).want3d('dralingo-sheikh') === null, 'the page: Save-Data → the picture');
  ok(home({ webgl: false }).want3d('dralingo-sheikh') === null, 'the page: no WebGL → the picture');
  ok(home({ webgl: true, memory: 1 }).want3d('dralingo-sheikh') === null, 'the page: 1 GB → the picture');
}

// ── 3 · the models: off git; when on this disk, light and right ──
section('3 · the models stay off git (his «sube» first)');
// (his «sube» for the models = delete the .gitignore line and commit the files; until then none may be in git)
const gi = read('.gitignore');
const held = /^public\/assets\/zoco\/3d\/$/m.test(gi);
let tracked = '';
try { tracked = execFileSync('git', ['ls-files', 'public/assets/zoco/3d'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (_) { tracked = '(git not available)'; }
if (held) ok(tracked === '', '.gitignore keeps the models out, and no 3D model is in git (' + (tracked || 'none') + ')');
else console.log('  · .gitignore no longer keeps public/assets/zoco/3d/ out (his «sube»): models in git: ' + (tracked.split('\n').filter(Boolean).length));
for (const id of ids) {
  const m = Saga.skin3d(id);
  const f = path.join(ROOT, 'public', 'assets', 'zoco', '3d', id + '.glb');
  if (!fs.existsSync(f)) { console.log('  · ' + id + '.glb is not on this disk (local only until his «sube»): the page keeps the picture'); continue; }
  const b = fs.readFileSync(f);
  ok(b.length <= 1.6 * 1024 * 1024, id + '.glb ≤ 1.6 MB (' + (b.length / 1024).toFixed(0) + ' KB)');
  ok(b.readUInt32LE(0) === 0x46546c67 && b.readUInt32LE(4) === 2, id + '.glb is a glTF 2 binary');
  const len = b.readUInt32LE(12);
  let J = {};
  try { J = JSON.parse(b.subarray(20, 20 + len).toString('utf8')); } catch (_) { J = null; }
  ok(!!J, id + '.glb: its JSON reads');
  if (J) {
    const req = J.extensionsRequired || [];
    ok(req.every((x) => x === 'KHR_draco_mesh_compression' || x === 'EXT_texture_webp'), id + '.glb needs only Draco + WebP (' + req.join(', ') + ')');
    ok(!(J.skins && J.skins.length) && !(J.animations && J.animations.length), id + '.glb: no skeleton, no animation (code motion)');
  }
  const h = crypto.createHash('sha1').update(b).digest('hex');
  ok(m && m.glb.endsWith('?v=' + h.slice(0, 8)), id + '.glb: the manifest\'s ?v= is this file\'s hash (a new model = a new name for the phones)');
}

// ── 4 · the module and the page ──
section('4 · js/zoco3d/stage.js and the page');
const S = read('public/js/zoco3d/stage.js');
const imports = [...S.matchAll(/^import .* from '([^']+)';/gm)].map((x) => x[1]);
ok(imports.length >= 2 && imports.every((p) => p === 'three' || /^three\/examples\/jsm\/[\w/.-]+\.js$/.test(p)), 'three.js only through the import map (' + imports.join(', ') + ')');
const hw = read('public/homework.html');
const au = read('public/audios.html');
const ver = (t) => { const m = /cdn\.jsdelivr\.net\/npm\/three@([\d.]+)\/build\/three\.module\.js/.exec(t); return m ? m[1] : null; };
ok(ver(hw) && ver(hw) === ver(au), 'homework.html\'s import map: the same three.js as /audios (' + ver(hw) + ')');
const dv = /three@([\d.]+)\/examples\/jsm\/libs\/draco\//.exec(S);
ok(dv && dv[1] === ver(hw), 'the Draco decoder of the same three.js');
ok(hw.indexOf('type="importmap"') >= 0 && hw.indexOf('type="importmap"') < hw.indexOf('<script src='), 'the import map comes before the page\'s scripts');
ok(/setPixelRatio\([^;]*Math\.min\(window\.devicePixelRatio \|\| 1, 2, Math\.sqrt\(MAX_PX/.test(S) && /const MAX_PX = 1\.5e6/.test(S), 'pixel ratio ≤ 2 and at most ~1.5 Mpx a frame');
ok(/on\(document, 'visibilitychange'/.test(S) && /IntersectionObserver/.test(S) && /SLEEP_AFTER/.test(S), 'nothing drawn while the tab is hidden, the stage off screen or nobody touched it for a long while');
ok(/forceContextLoss/.test(S) && /const giveBack = /.test(S) && /undo\.push\(\(\) => el\.removeEventListener\(type, fn, o\)\)/.test(S) && /catch \(err\) \{\s*alive = false;\s*giveBack\(\);\s*throw err;/.test(S), 'dispose (and a failure half way) gives everything back: listeners, observers, the scene, the context');
ok(/draco\.dispose\(\)/.test(S) && /setWorkerLimit\(2\)/.test(S), 'the Draco workers are closed once the model is read');
ok(/failIfMajorPerformanceCaveat: !opts\.software/.test(S) && /onShaderError/.test(S) && /isContextLost\(\)/.test(S), 'no software WebGL, a broken shader or a lost context never leaves an empty pedestal');
ok(/if \(!wanted\(\)\) cancel\(\);/.test(S) && (S.match(/if \(!wanted\(\)\) cancel\(\);/g) || []).length >= 2, 'a load the kid walked away from stops before the heavy work');
const wheel = /function onWheel\(e\) \{([\s\S]*?)\n    \}/.exec(S);
ok(wheel && /if \(e\.ctrlKey\) \{ e\.preventDefault\(\);/.test(wheel[1]) && /if \(setZoom\(z\)\) \{ e\.preventDefault\(\); \}/.test(wheel[1]) && (wheel[1].match(/preventDefault/g) || []).length === 2,
  'the wheel is held only while it really zooms (at a limit the page scrolls); a trackpad pinch never zooms the page');
ok(/on\(canvas, 'wheel', onWheel, \{ passive: false \}\)/.test(S), 'the wheel listener can hold the wheel');
const css = read('public/css/mi-dralingo.css');
ok(/\.zc-3d \{[^}]*touch-action: pan-y/.test(css), 'a vertical swipe on the character still scrolls the page (touch-action: pan-y)');
ok(!/[áéíóúñ¡¿]/i.test(S.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n').replace(/\/\/.*$/gm, '')), 'the module holds no Spanish of its own (the page gives the words)');
const md = read('public/js/mi-dralingo.js');
const js = /const Z3D_JS = '(\/js\/zoco3d\/stage\.js)\?v=([A-Za-z0-9_-]+)'/.exec(md);
ok(js && fs.existsSync(path.join(ROOT, 'public', js[1])), 'mi-dralingo.js asks for the module with a ?v=');
ok(/addEventListener\('pagehide', \(\) => zoco3dLeave\(''\)\)/.test(md) && /zoco3dLeave\(view\.kind === 'item' \? view\.id : ''\);\s*\/\/ \(🧊 left the character's page\)/.test(md), 'leaving the page (another view, the tab closed) disposes the 3D and cancels a load on its way');
ok(/const tok = \+\+Z3D\.seq;/.test(md) && /const mine = \(\) => Z3D\.seq === tok/.test(md) && /alive: mine/.test(md), 'every load has its own ticket: an old one never clears or feeds the next character\'s');
ok(/fetch\(m\.glb[\s\S]{0,400}import\(Z3D_JS\)/.test(md), 'the model is fetched before three.js is asked for (a missing model costs one 404)');
ok(/setTimeout\(\(\) => end\('timeout'\), Z3D_WAIT\)/.test(md) && /const Z3D_WAIT = 15000;/.test(md), 'a load stuck for 15 s gives the page its picture and loop back');
ok(/why === 'context' && !Z3D\.lost\[id\]/.test(md), 'a first lost context tries again (the phone took its graphics back), a second one keeps the picture');
ok(/getContext\('webgl2', \{ failIfMajorPerformanceCaveat: !z3dSoft\(\) \}\)/.test(md) && !/getContext\('webgl'\)/.test(md), 'the probe asks for hardware WebGL 2 only (three.js 0.170 needs it)');
const i18n = read('public/js/hw-i18n.js');
const words = /words: \{ spin: '([^']+)', drag: '([^']+)', tap: '([^']+)',\s*label: '([^']+)' \}/.exec(md);
ok(!!words, 'the page gives the module its words');
if (words) for (const w of words.slice(1)) ok(i18n.indexOf(JSON.stringify(w) + ':') >= 0, '«' + w + '» has its English in hw-i18n');

console.log((failed ? '✖ ' : '✓ ') + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
