#!/usr/bin/env node
// test-zoco.js — El Zoco de Dralingo (2026-10-19, his OK: "Okay I approve the design of the Souq"; v2 2026-10-20: "make it
// a lot more difficult to get the points" + "I bought licenses for all these models" + "the 3D avatar is there waiting for
// you"): coins judged by the server, the characters shop, a skin as the kid's character everywhere. Two parts, both on
// MADE-UP accounts in temporary folders (never data/, never the live site); throw-away teacher codes never printed:
//   1. in this process (core/zoco.js on a temp folder, the clock moved by hand): the catalog against saga.js and the
//      files (all 20 on sale, nothing held, prices 800-3000, the art slots ZOCO_ART / ZOCO_ANIM matching the files and
//      swapping art as data only), the v2 amounts (core/zoco.js PAY, read from there), the daily caps in steps and what
//      waits for the next days, «Deshacer» taking back what it paid (even below 0 after a purchase: no spend-then-undo
//      minting), nothing paid twice (unmark + mark, a replayed practice, the same game), the 7-day streak, the welcome
//      grant from what was done before, a purse of 2026-10-19 taking the v2 amounts (coins, characters, welcome and keys
//      untouched; only what was waiting in today's amounts; once), the merge of an automatic account (only work NEW to
//      the real account moves: no laundering loop), the caps' day only moving forward (a time-zone flip), buying
//      (atomic, owned, too few coins), setAvatar only for an owned skin, SnowMap / saga resolving a skin id
//   2. its OWN server (port 4580, never 3000): GET /api/zoco and the home's pill for every kind of visitor, the steps
//      paying in their own endpoints (seals, homework marks, a practice at its goal, a class PIN game played for real
//      with its bonus stars), a stranger / another kid / another site never earning, spending or equipping for someone,
//      buying with too few coins refused, the four once held on sale, a purse of 2026-10-19 keeping its coins and
//      characters, a skin not owned refused as an avatar (homework, equip, a PIN join, the lobby swap, the 8-character
//      cut), a skin showing in a pin game's player list and ending, and a dropped kid's slot taken by a classmate paying
//      nobody
//   node scripts/test-zoco.js            (--port 4580 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4580));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const DAY = 86400e3, NOW = Date.now();
const today = (at) => new Date(at || Date.now()).toISOString().slice(0, 10);

// the catalog's homework audios (never hardcoded)
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'audios', 'catalog.json'), 'utf8'));
const hwOf = (folder) => CAT.homeworks.filter((h) => h.level === folder).sort((a, b) => (b.exp - a.exp) || (b.round - a.round)).map((h) => h.id);
const NEW = hwOf('newhsk1');
const OLD = hwOf('hsk1');

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 1. in this process
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const UNIT = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-zoco-unit-'));
process.env.DRALY_DATA_DIR = UNIT;
process.env.STUDENT_DATA_DIR = UNIT;
fs.writeFileSync(path.join(UNIT, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 5 * DAY }));
fs.writeFileSync(path.join(UNIT, 'student-records.json'), JSON.stringify({
  // a kid who did a lot BEFORE El Zoco: 40 words, world 1 at 80 % (world 2 at 50 %), one homework sent, 9 days in a row
  PREA: { code: 'PREA', displayName: 'Kid Pre', firstSeen: NOW - 40 * DAY, lastSeen: NOW, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [],
    ruta: { hsk2: { s: '1-40', p: { 1: 80, 2: 50 } } }, tareas: { [NEW[0]]: { h: NOW - 2 * DAY, s: NOW - 2 * DAY } }, streak: 9, dayDate: today() },
  // a brand-new kid
  NEWB: { code: 'NEWB', displayName: 'Kid New', firstSeen: NOW, lastSeen: NOW, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [] },
  // an automatic account and the real account it moves into
  AUTO22: { code: 'AUTO22', displayName: 'Dragoncito 123', firstSeen: NOW, lastSeen: NOW, level: 'hsk2', auto: true, sentencesBuilt: [] },
  REAL: { code: 'REAL', displayName: 'Kid Real', firstSeen: NOW - 9 * DAY, lastSeen: NOW, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [] },
  REA2: { code: 'REA2', displayName: 'Kid Real 2', firstSeen: NOW - 9 * DAY, lastSeen: NOW, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [] },
  // a kid whose purse opened on 2026-10-19 (v1 amounts): 300 coins, a character bought at its old price, the welcome
  // grant paid, a homework paid 50, and in today's line 41 coins of words (21 words at 2) + two homeworks at 50; today's
  // counters at the old caps (60 coins of words = 30 words, 100 coins of homework = 2)
  OLDK: { code: 'OLDK', displayName: 'Kid Old', firstSeen: NOW - 20 * DAY, lastSeen: NOW, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [],
    avatar: 'dralingo-sheikh', tareas: { [NEW[0]]: { h: NOW - DAY, s: NOW - DAY }, 'zz-old-1': { h: NOW, s: NOW }, 'zz-old-2': { h: NOW, s: NOW } },
    zoco: { v: 1, at: NOW - DAY, c: 300, e: 450, sp: 150, w: 150, ps: 100, own: ['dralingo-sheikh'], buys: [['dralingo-sheikh', 150, NOW - DAY]],
      k: { ['hw:' + NEW[0]]: 50, 'train:hsk2:1': 20 }, sk: { hsk2: '1-50' }, gm: {}, q: { seal: 41, hw: [['zz-old-1', 50], ['zz-old-2', 50]] },
      day: { d: today(), seal: 60, hw: 100, game: 2, star: 3 }, log: [[NOW - DAY, 150, 'welcome']] } },
  // an automatic account of 2026-10-19 with a homework waiting at the old 50
  AUTOV: { code: 'AUTOV', displayName: 'Dragoncito 321', firstSeen: NOW - DAY, lastSeen: NOW, level: 'hsk2', auto: true, sentencesBuilt: [],
    tareas: { 'zz-auto-1': { h: NOW, s: NOW } },
    zoco: { v: 1, at: NOW - DAY, c: 0, e: 0, sp: 0, w: 0, ps: 0, own: [], buys: [], k: {}, sk: {}, gm: {}, q: { seal: 0, hw: [['zz-auto-1', 50]] }, day: {}, log: [] } },
}));
const Saga = require('../public/js/saga');
const SnowMap = require('../public/js/snow-map');
const Students = require('../core/student-records');
const RP = require('../core/ruta-progress');
const Zoco = require('../core/zoco');

// the clock, by hand (days for the caps): Date.now() + shift
const realNow = Date.now;
let shift = 0;
Date.now = () => realNow() + shift;
const nextDay = () => { shift += DAY; };

function unit() {
  const P = Zoco.PAY, CAP = Zoco.CAP, CAPC = Zoco.CAPC;
  section('v2 (2026-10-20): the amounts, the caps, the prices');
  ok(P.seal === 1 && P.train === 10 && P.hw === 25 && P.game === 5 && P.star === 2 && P.streak === 15, 'the amounts: +1 a word, +10 a practice, +25 a homework, +5 a game, +2 a star, +15 a 7-day streak');
  ok(CAP.seal === 30 && CAP.hw === 2 && CAP.game === 4 && CAP.star === 5, 'the daily caps: 30 words, 2 homework, 4 games, 5 stars');
  ok(CAPC.seal === CAP.seal * P.seal && CAPC.hw === CAP.hw * P.hw, '… the words\' and homework\'s caps in coins follow');

  section('the catalog: his renders, all 20 on sale, light files');
  const ids = Zoco.CATALOG.map((x) => x.id);
  ok(ids.length === 20 && new Set(ids).size === 20, 'twenty characters in the catalog (the 22 he saw in green, minus the two cone-hat babies)');
  ok(Saga.ZOCO.length === ids.length && Saga.ZOCO.every((z) => ids.includes(z.id)), 'saga.js draws exactly the catalog\'s characters (one list each, the same ids)');
  ['bebe-dralingo', 'bebe-dralingo-alas', 'dralingo-come-palabras', 'camello', 'monje-john', 'chica-kung-fu', 'hombre-latino', 'jefe-maya']
    .forEach((id) => ok(!ids.includes(id) && !Saga.zoco(id), 'kept out: ' + id));
  const held = Zoco.CATALOG.filter((x) => x.hold).map((x) => x.id);
  ok(held.length === 0 && Zoco.CATALOG.every((x) => Zoco.onSale(x)), 'nothing held: he bought the licences (the dog, the pony, the panda and Latifa con abaya on sale)');
  const price = (id) => Zoco.item(id).price;
  ok(Zoco.CATALOG.every((x) => Number.isInteger(x.price) && x.price >= 800 && x.price <= 3000), 'prices 800-3000');
  ok(price('dralingo-emperador-qin') === 3000 && Zoco.CATALOG.every((x) => x.price <= 3000) && Zoco.CATALOG.filter((x) => x.price === 3000).length === 1, 'Dralingo Emperador Qin 3000, the top (and the only one)');
  const min = Math.min(...Zoco.CATALOG.map((x) => x.price));
  ok(['dralingo-sheikh', 'dralingo-sheikh-roja', 'dralingo-clasico'].every((id) => price(id) === min) && min === 800, 'the plain forms the cheapest (800)');
  const mid = ['profe-fer', 'hamdan-3d', 'latifa-3d', 'aileen-3d', 'adric-3d', 'adrian-3d', 'perro-de-adric', 'poni-de-aileen', 'panda-3d'];
  ok(mid.every((id) => price(id) > min && price(id) < 1800), 'the gang and the pets in the middle (' + mid.map(price).join(', ') + ')');
  ok(['dralingo-emperador', 'dralingo-emperador-barba', 'dralingo-fuego-azul'].every((id) => price(id) >= 1800 && price(id) > Math.max(...mid.map(price))), 'the emperors and Fuego Azul dearer than the gang and the pets');
  ok(Zoco.CATALOG.every((x) => typeof x.blurb === 'string' && x.blurb.length > 10 && !/[㐀-鿿]/.test(x.blurb) && !/—/.test(x.blurb)), 'a Spanish line for each, no hanzi, no em dash');
  ok(Saga.ZOCO.every((z) => /^[a-z0-9-]{3,40}$/.test(z.id) && !Saga.avatar(z.id) && !Saga.LEGACY_AVATARS[z.id]), 'skin ids never collide with a saga avatar or an old avatar name');
  ok(Saga.ZOCO.every((z) => z.ar > 0.2 && z.ar < 2 && z.hx > 0 && z.hx < 1 && (z.fx == null || (z.fx > 0 && z.fx < 1))), 'every character says how it stands (ar, hx, fx): the pedestal places it by its feet');
  const pub = path.join(ROOT, 'public', 'assets', 'zoco');
  let big = 0, missing = 0;
  ids.forEach((id) => {
    ['full', 'avatar'].forEach((k) => {
      const f = path.join(pub, k, id + '.webp');
      if (!fs.existsSync(f)) { missing++; return; }
      const n = fs.statSync(f).size;
      if (n > (k === 'full' ? 60 : 30) * 1024 || n < 2000) big++;
    });
  });
  ok(missing === 0, 'every character has its full-body picture and its head (' + ids.length * 2 + ' files, the four once held included)');
  ok(big === 0, 'full-body pictures ≤ 60 KB, heads ≤ 30 KB (compressed)');
  const extra = fs.readdirSync(path.join(pub, 'full')).concat(fs.readdirSync(path.join(pub, 'avatar'))).filter((f) => !ids.includes(f.replace(/(-g)?\.webp$/, '')));
  ok(!extra.length, 'nothing else in public/assets/zoco (' + extra.join(', ') + ')');
  const roster = path.join(ROOT, '..', '..', '..', '..', 'assets-library', 'originals-renders', '2026-10-19', 'roster.json');
  if (fs.existsSync(roster)) {
    const R = JSON.parse(fs.readFileSync(roster, 'utf8')).characters;
    const nameOf = (rid) => (R.find((c) => c.id === rid) || {}).name_es;
    const rid = (id) => id.replace(/-3d$/, '').replace(/^panda$/, 'panda');
    // the gang got kid names for their outfit at the design review (2026-10-19: «3D» is a tech word kids don't read)
    const RENAMED = { 'profe-fer': 'Profe Fer de traje', 'hamdan-3d': 'Hamdan con kandura', 'latifa-3d': 'Latifa con abaya', 'adric-3d': 'Adric de negro', 'adrian-3d': 'Adrian con chaqueta' };
    const bad = Saga.ZOCO.filter((z) => (RENAMED[z.id] || nameOf(rid(z.id))) !== z.label).map((z) => z.id);
    ok(!bad.length, 'named as in roster.json, the gang by their outfit (' + bad.join(', ') + ')');
    ok(!Saga.ZOCO.some((z) => /3D/.test(z.label)) && !Zoco.CATS.some((c) => /3D/.test(c.tag)) && !Zoco.CATALOG.some((x) => /3D/.test(x.blurb)), 'no «3D» in anything kids read');
    const cards = Zoco.CATALOG.filter((x) => x.cat === 'dralingo' && Zoco.onSale(x)).map((x) => x.id);
    const alike = [['dralingo-emperador', 'dralingo-emperador-barba'], ['dralingo-sheikh', 'dralingo-sheikh-paseo'], ['dralingo-sheikh-roja', 'dralingo-sheikh-paseo-roja'], ['dralingo-sheikh', 'dralingo-sheikh-roja'], ['dralingo-sheikh-paseo', 'dralingo-sheikh-paseo-roja']];
    const near = (a, b, cols) => { const i = cards.indexOf(a), j = cards.indexOf(b); const ri = Math.floor(i / cols), rj = Math.floor(j / cols), ci = i % cols, cj = j % cols; return (ri === rj && Math.abs(ci - cj) === 1) || (ci === cj && Math.abs(ri - rj) === 1); };
    ok(alike.every(([a, b]) => !near(a, b, 2) && !near(a, b, 5)), 'look-alikes never side by side (a phone\'s 2 columns, a laptop\'s 5)');
    ok(Saga.ZOCO.every((z) => (R.find((c) => c.id === rid(z.id)) || {}).status === 'keep'), 'every one of them «keep» in roster.json');
  } else console.log('    (roster.json not on this computer: names not compared)');

  section('the art slots (ZOCO_ART, ZOCO_ANIM): the files decide, swapping art is data only');
  const Art = require('./zoco-art');
  const sagaSrc = fs.readFileSync(path.join(ROOT, 'public', 'js', 'saga.js'), 'utf8');
  const maps = Art.readMaps(sagaSrc);
  const built = Art.build(maps);
  ok(!built.problems.length, 'every art file has a catalog name and is light enough (' + built.problems.join(' · ') + ')');
  ok(JSON.stringify(built.art) === JSON.stringify(Saga.ZOCO_ART) && JSON.stringify(built.anim) === JSON.stringify(Saga.ZOCO_ANIM), 'saga.js\'s maps are exactly the files on disk (scripts/zoco-art.js --check)');
  const allUrls = [].concat(...Object.values(Saga.ZOCO_ART).map((e) => [e.full, e.avatar]), ...Object.values(Saga.ZOCO_ANIM).map((e) => [e.still, e.full, e.lite]))
    .filter(Boolean);
  ok(allUrls.every((u) => /\?v=[0-9a-f]{8}$/.test(u) && fs.existsSync(path.join(ROOT, 'public', u.replace(/\?.*$/, '')))), 'each art file named in the maps exists and carries its own ?v= (' + allUrls.length + ')');
  ok(Object.keys(Saga.ZOCO_ART).concat(Object.keys(Saga.ZOCO_ANIM)).every((id) => ids.includes(id)), 'the maps name catalog characters only');
  const sagaPages = Art.pagesWithSaga(ROOT);
  const versions = sagaPages.map((p) => fs.readFileSync(p, 'utf8').match(/js\/saga\.js\?v=([A-Za-z0-9_-]+)/g)).reduce((a, m) => a.concat(m || []), []);
  ok(sagaPages.length >= 18 && new Set(versions).size === 1, 'all ' + sagaPages.length + ' pages that load saga.js load the same version (' + versions[0] + ')');
  // data only: one line in a map moves the picture of the shop and every game, and gives a character its idle loop
  const T = 'hamdan-3d';
  const keepArt = Saga.ZOCO_ART[T], keepAnim = Saga.ZOCO_ANIM[T];
  Saga.ZOCO_ART[T] = { full: '/assets/zoco/full/hamdan-3d-g.webp?v=00000001', avatar: '/assets/zoco/avatar/hamdan-3d-g.webp?v=00000002', ar: 0.5 };
  Saga.ZOCO_ANIM[T] = { still: '/s.webp', full: '/f.webp', lite: '/l.webp', ar: 0.6 };
  const vT = Zoco.view({ zoco: null }).items.find((i) => i.id === T);
  ok(Saga.skinBody(T) === Saga.ZOCO_ART[T].full && Saga.skinHead(T) === Saga.ZOCO_ART[T].avatar && Saga.avatarUrl(T) === Saga.ZOCO_ART[T].avatar
    && vT.full === Saga.ZOCO_ART[T].full && vT.head === Saga.ZOCO_ART[T].avatar, 'a glossy picture in ZOCO_ART: the shop, the games (skinBody / skinHead) and the rosters (avatarUrl) draw it');
  const an = Saga.skinAnim(T);
  ok(an && an.still === '/s.webp' && an.full === '/f.webp' && an.lite === '/l.webp' && an.ar === 0.6 && an.hx === Saga.zoco(T).hx && an.fx === an.hx, 'an idle loop in ZOCO_ANIM: still + loop + lite, standing like its render (hx / fx)');
  Saga.ZOCO_ANIM[T] = { still: '/s.webp', full: '/f.webp', ar: 0.6 };
  ok(Saga.skinAnim(T).lite === null, 'a loop with no lite one: lite is null (a phone keeps the still, never the full loop)');
  Saga.ZOCO_ART[T] = { full: 7, avatar: { x: 1 }, ar: 99, hx: -3, fx: 'x' };
  const odd = Saga.skinLook(T);
  ok(Saga.skinBody(T) === '/assets/zoco/full/hamdan-3d.webp' && Saga.skinHead(T) === '/assets/zoco/avatar/hamdan-3d.webp' && odd.ar === 3 && odd.hx === 0 && odd.fx === 0,
    'odd values in a hand-edited map: the render\'s pictures, ar within 0.2…3, hx / fx within 0…1 (' + JSON.stringify(odd) + ')');
  delete Saga.ZOCO_ART[T]; delete Saga.ZOCO_ANIM[T];
  if (keepArt) Saga.ZOCO_ART[T] = keepArt;
  if (keepAnim) Saga.ZOCO_ANIM[T] = keepAnim;
  const none = ids.filter((id) => !Saga.ZOCO_ART[id] && !Saga.ZOCO_ANIM[id]);
  ok(none.every((id) => Saga.skinBody(id) === '/assets/zoco/full/' + id + '.webp' && Saga.skinAnim(id) === null), 'with no art in the maps a character shows its render, no loop (as on 2026-10-19)');
  ok(Saga.skinLook('perro-de-adric').fx < Saga.skinLook('perro-de-adric').hx && Saga.skinLook('profe-fer').fx === Saga.skinLook('profe-fer').hx, 'the dog stands on its paws, not its head (fx); a person stands under the face');

  section('scripts/zoco-art.js writes on a copy: refusals, hand-set hx / fx kept, CRLF, the ?v= bumps');
  const AR = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-zoco-art-'));
  const put = (rel, from) => { const f = path.join(AR, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.copyFileSync(path.join(ROOT, from), f); return f; };
  try {
    const sagaT = put('public/js/saga.js', 'public/js/saga.js');
    fs.writeFileSync(sagaT, fs.readFileSync(sagaT, 'utf8').replace(/\r?\n/g, '\r\n'));   // (a Windows checkout: CRLF)
    put('public/homework.html', 'public/homework.html');
    put('public/host-snow.html', 'public/host-snow.html');
    put('protected/pages/hsk-sim.html', 'protected/pages/hsk-sim.html');
    const A1 = 'public/assets/zoco/anim/dralingo-clasico';
    put('public/assets/zoco/full/hamdan-3d-g.webp', 'public/assets/zoco/full/hamdan-3d.webp');
    put('public/assets/zoco/avatar/hamdan-3d-g.webp', 'public/assets/zoco/avatar/hamdan-3d.webp');
    put(A1 + '-still.webp', 'public/assets/dralingo/anim/hello-still.webp');
    put(A1 + '.webp', 'public/assets/dralingo/anim/hello.webp');
    const before = fs.readFileSync(sagaT, 'utf8');
    let w = Art.run({ root: AR });
    ok(w.code === 1 && /dralingo-clasico-lite\.webp missing/.test(w.out) && fs.readFileSync(sagaT, 'utf8') === before, 'a loop without its lite one: refused, nothing written (' + w.out.split('\n')[0] + ')');
    put(A1 + '-lite.webp', 'public/assets/dralingo/anim/hello.webp');   // (1.1 MB: over the lite one's 400 KB)
    w = Art.run({ root: AR });
    ok(w.code === 1 && /dralingo-clasico-lite\.webp is \d+ KB/.test(w.out) && fs.readFileSync(sagaT, 'utf8') === before, 'a lite loop over 400 KB: refused, nothing written');
    put(A1 + '-lite.webp', 'public/assets/dralingo/anim/cheer-lite.webp');
    put('public/assets/zoco/anim/dralingo-clasco.webp', 'public/assets/dralingo/anim/cheer-lite.webp');
    w = Art.run({ root: AR });
    ok(w.code === 1 && /no character of the catalog is called «dralingo-clasco»/.test(w.out), 'a misspelt name: refused, named');
    fs.unlinkSync(path.join(AR, 'public/assets/zoco/anim/dralingo-clasco.webp'));
    w = Art.run({ root: AR, check: true });
    ok(w.code === 1, '--check: the maps and the files disagree');
    w = Art.run({ root: AR });
    const s1 = fs.readFileSync(sagaT, 'utf8');
    const ctxS = { module: { exports: {} } };
    new vm.Script(s1).runInNewContext(ctxS);
    const S1 = { exports: ctxS.module.exports };
    const m1 = Art.readMaps(s1);
    ok(w.code === 0 && m1.anim['dralingo-clasico'] && /\?v=[0-9a-f]{8}$/.test(m1.anim['dralingo-clasico'].lite) && m1.art['hamdan-3d'] && /hamdan-3d-g\.webp\?v=/.test(m1.art['hamdan-3d'].full), 'written: the loop (still, full, lite) and the glossy picture, each with its ?v=');
    ok(!/[^\r]\n/.test(s1) && S1.exports && S1.exports.skinAnim('dralingo-clasico').lite.indexOf('-lite.webp') > 0, 'saga.js keeps its CRLF and still runs (the new map read back through it)');
    const pv = ['public/homework.html', 'public/host-snow.html', 'protected/pages/hsk-sim.html'].map((p) => (fs.readFileSync(path.join(AR, p), 'utf8').match(/js\/saga\.js\?v=([A-Za-z0-9_-]+)/) || [])[1]);
    ok(w.v && pv.every((x) => x === w.v) && !fs.readdirSync(path.join(AR, 'public', 'js')).some((f) => /\.tmp-/.test(f)), 'the 3 pages of the copy bumped to ' + w.v + ', no temp file left');
    // a hand-set fx survives a re-made picture
    fs.writeFileSync(sagaT, s1.replace('"ar":0.4', '"ar":0.4,"fx":0.44'));
    put('public/assets/zoco/full/hamdan-3d-g.webp', 'public/assets/zoco/full/adric-3d.webp');
    w = Art.run({ root: AR });
    const m2 = Art.readMaps(fs.readFileSync(sagaT, 'utf8'));
    ok(w.code === 0 && m2.art['hamdan-3d'].fx === 0.44 && m2.art['hamdan-3d'].full !== m1.art['hamdan-3d'].full, 'a re-made picture gets a new ?v=, the hx / fx set by hand stay (' + JSON.stringify(m2.art['hamdan-3d']) + ')');
    fs.writeFileSync(sagaT, fs.readFileSync(sagaT, 'utf8').replace('"fx":0.44', '"fx":0.44,'));
    w = Art.run({ root: AR });
    ok(w.code === 1 && /saga\.js line \d+: ZOCO_ART is not JSON/.test(w.out), 'a broken hand edit: named with its line, nothing written (' + w.out + ')');
  } finally { fs.rmSync(AR, { recursive: true, force: true }); }

  section('a skin id on every page and in every game');
  ok(Saga.avatarUrl('dralingo-fuego-azul') === '/assets/zoco/avatar/dralingo-fuego-azul.webp' && Saga.skinBody('hamdan-3d') === '/assets/zoco/full/hamdan-3d.webp', 'saga.js: a skin\'s head and full body');
  ok(Saga.avatarUrl('hamdan') === '/assets/saga/avatars/hamdan.webp' && Saga.skinBody('hamdan') === null && Saga.skinAnim('hamdan') === null, '… the free saga avatars as before');
  ok(Saga.emojiOf('dralingo-emperador-qin') === '🐉' && Saga.emojiOf('profe-fer') === '👨‍🏫' && Saga.emojiOf('panda-3d') === '🐼' && Saga.emojiOf('🧔') === '🧔' && Saga.emojiOf('x-y') === '', 'a text-only list prints the character\'s emoji, never an id');
  ok(Saga.labelOf('aileen-3d') === 'Aileen artes marciales' && Saga.labelOf('hamdan') === 'Hamdan', '«Vas a jugar como …»: the skin\'s name');
  ok(SnowMap.skinFor('dralingo-fuego-azul', 'Ana') === 'dralingo-fuego-azul' && SnowMap.skinFor('latifa-3d', 'Ana') === 'latifa-3d', 'SnowMap.skinFor (server and phones): a skin is the kid\'s character (Latifa con abaya too)');
  ok(['dralingo', 'fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian', 'camel', 'plane', 'falcon', 'oryx'].includes(SnowMap.skinFor('no-such-skin', 'Ana')), '… an unknown id falls back to a saga character');
  ok(Saga.zoco('__proto__') === null && Saga.zoco('constructor') === null && Zoco.item('__proto__') === null && Saga.skinAnim('__proto__') === null, 'own keys only (no prototype tricks)');

  section('the welcome grant: what was done before El Zoco never pays coin by coin');
  const env = { goal: 70 };
  const pre = Students.get('PREA');
  Zoco.ensure(pre, env);
  const want = Math.min(Zoco.WELCOME_MAX, Math.round(40 * P.seal / 2 + 1 * P.train / 2 + 1 * P.hw / 2));
  ok(pre.zoco.c === want && pre.zoco.w === want && pre.zoco.e === want && pre.zoco.pv === 2, 'a one-time welcome grant at half of today\'s pay (40 words + 1 practice at the goal + 1 homework sent = ' + want + ', at most ' + Zoco.WELCOME_MAX + ')');
  ok(Zoco.ensure(pre, env) === pre.zoco && pre.zoco.c === want, '… once only');
  const fresh = Students.get('NEWB');
  Zoco.ensure(fresh, env);
  ok(fresh.zoco.c === 0 && fresh.zoco.w === 0, 'a new kid starts at 0');
  // re-sealing words done before: nothing
  RP.applySeals('PREA', 'hsk2', [], range(1, 40));
  RP.applySeals('PREA', 'hsk2', range(1, 40), []);
  ok(Zoco.settleSeals(pre, 'hsk2').got === 0 && pre.zoco.c === want, 'unmarking and marking again the 40 old words pays nothing');
  RP.applySeals('PREA', 'hsk2', [41, 42], []);
  ok(Zoco.settleSeals(pre, 'hsk2').got === 2 * P.seal && pre.zoco.c === want + 2 * P.seal, 'two new words: +' + P.seal + ' each');
  RP.applySeals('PREA', 'hsk2', [], [41]);
  ok(Zoco.settleSeals(pre, 'hsk2').got === 0, 'unmark one: nothing taken (the word stays counted)');
  RP.applySeals('PREA', 'hsk2', [41], []);
  ok(Zoco.settleSeals(pre, 'hsk2').got === 0 && pre.zoco.c === want + 2 * P.seal, '… and marking it again pays nothing (no farming by repeating a tap)');
  // the practice done before: never again
  RP.recordPractice('PREA', 'hsk2', 1, 95);
  ok(Zoco.settleTrain(pre, 'hsk2', 70).got === 0, 'world 1 (at its goal before El Zoco) played again: nothing');
  RP.recordPractice('PREA', 'hsk2', 2, 60);
  ok(Zoco.settleTrain(pre, 'hsk2', 70).got === 0, 'world 2 below its goal: nothing');
  RP.recordPractice('PREA', 'hsk2', 2, 80);
  ok(Zoco.settleTrain(pre, 'hsk2', 70).got === P.train, 'world 2 reaches its goal: +' + P.train);
  RP.recordPractice('PREA', 'hsk2', 2, 100);
  ok(Zoco.settleTrain(pre, 'hsk2', 70).got === 0, '… its best beaten later: nothing more');
  // the homework sent before: unmark + mark = nothing, never a take-back
  const mark = (code, id, on) => Students.updateTareas(code, (all) => { all[id] = all[id] || {}; if (on) { all[id].h = all[id].h || Date.now(); all[id].s = Date.now(); } else delete all[id].s; }, { activity: true });
  mark('PREA', NEW[0], false);
  ok(Zoco.settleHw(pre, NEW).got === 0, 'the homework sent before El Zoco unmarked: nothing taken back (it never paid)');
  mark('PREA', NEW[0], true);
  ok(Zoco.settleHw(pre, NEW).got === 0, '… and marked again: nothing paid');

  section('the homework marks: +' + P.hw + ' once, «Deshacer» takes them back, ' + CAP.hw + ' a day');
  mark('NEWB', NEW[1], true);
  let r = Zoco.settleHw(fresh, NEW);
  ok(r.got === P.hw && fresh.zoco.c === P.hw, '«¡Ya la mandé!»: +' + P.hw);
  ok(Zoco.settleHw(fresh, NEW).got === 0, 'the same marks again: nothing');
  mark('NEWB', NEW[1], false);
  r = Zoco.settleHw(fresh, NEW);
  ok(r.got === -P.hw && fresh.zoco.c === 0 && r.items[0].why === 'undo', '«Deshacer»: the +' + P.hw + ' go back');
  mark('NEWB', NEW[1], true);
  ok(Zoco.settleHw(fresh, NEW).got === P.hw && fresh.zoco.c === P.hw, 'marked again: +' + P.hw + ' (one payment while it is marked)');
  mark('NEWB', OLD[0], true);
  ok(Zoco.settleHw(fresh, NEW).got === 0, 'another level\'s homework (it only plays): nothing');
  // the cap: 2 homeworks a day, the rest waits (a new day; NEW has 3, one already paid: made-up ids are enough here)
  nextDay();
  const four = NEW.concat(['zz-e09-r1', 'zz-e09-r2']);
  four.forEach((id) => mark('NEWB', id, true));
  r = Zoco.settleHw(fresh, four);
  ok(fresh.zoco.day.hw === CAPC.hw && fresh.zoco.q.hw.length === 2 && r.got === CAPC.hw, 'four new homeworks in a day: two are paid (cap ' + CAP.hw + '), two wait for tomorrow');
  mark('NEWB', 'zz-e09-r2', false);
  ok(Zoco.settleHw(fresh, four).got === 0 && fresh.zoco.q.hw.length === 1, 'one waiting unmarked: it leaves the line (nothing to take back)');
  mark('NEWB', 'zz-e09-r2', true);
  Zoco.settleHw(fresh, four);
  ok(fresh.zoco.q.hw.length === 2, 'marked again: back in line');
  const c0 = fresh.zoco.c;
  nextDay();
  r = Zoco.settle(fresh);
  ok(r.got === 2 * P.hw && fresh.zoco.c === c0 + 2 * P.hw && fresh.zoco.q.hw.length === 0, 'a new day: what waited is paid first thing (+' + 2 * P.hw + ')');

  section('La Base\'s words: +' + P.seal + ' each, first time only, ' + CAP.seal + ' words a day (the rest waits)');
  const before = fresh.zoco.c;
  RP.applySeals('NEWB', 'hsk2', range(1, 60), []);
  r = Zoco.settleSeals(fresh, 'hsk2');
  ok(r.got === CAPC.seal && fresh.zoco.q.seal === 60 * P.seal - CAPC.seal, '60 words at once: ' + CAPC.seal + ' coins today, ' + (60 * P.seal - CAPC.seal) + ' wait');
  RP.applySeals('NEWB', 'hsk2', [61], []);
  ok(Zoco.settleSeals(fresh, 'hsk2').got === 0 && fresh.zoco.q.seal === 61 * P.seal - CAPC.seal, 'one more today: it waits too');
  nextDay();
  r = Zoco.settle(fresh);
  ok(r.got === CAPC.seal && fresh.zoco.q.seal === 1 && fresh.zoco.c === before + 2 * CAPC.seal, 'the next day ' + CAPC.seal + ' of the waiting coins come in (the day\'s cap), 1 still waits');
  nextDay();
  ok(Zoco.settle(fresh).got === 1 && fresh.zoco.q.seal === 0, '… and the last one the day after');

  section('the 7-day streak: +' + P.streak + ' at 7, 14, 21… of the same run, once each');
  const st = Students.get('NEWB');
  st.streak = 6; st.dayDate = today(Date.now() - DAY);
  ok(Zoco.settleStreak(st).got === 0, '6 days: nothing yet');
  st.streak = 7; st.dayDate = today();
  ok(Zoco.settleStreak(st).got === P.streak, '7 days in a row: +' + P.streak);
  ok(Zoco.settleStreak(st).got === 0, '… once');
  st.streak = 14; st.dayDate = today(Date.now() + 7 * DAY);
  ok(Zoco.settleStreak(st).got === P.streak, '14 days of the same run: +' + P.streak + ' more');
  ok(Zoco.streakKeys(pre).length === 1 && Object.prototype.hasOwnProperty.call(pre.zoco.k, Zoco.streakKeys(pre)[0]) && pre.zoco.k[Zoco.streakKeys(pre)[0]] === 0, 'a streak reached before El Zoco never pays');

  section('a class PIN game: +' + P.game + ' played for real, +' + P.star + ' a bonus star, once per game, the day\'s caps');
  const g = Students.get('REAL');
  Zoco.ensure(g, env);
  ok(Zoco.gameEnd(g, 'room1:1', { answered: 2, stars: 3 }).got === 0, '2 answers: not played for real (nothing)');
  ok(Zoco.gameEnd(g, 'room1:2', { answered: 5, stars: 2 }).got === P.game + 2 * P.star, '5 answers and 2 bonus stars: +' + P.game + ' +' + P.star + ' +' + P.star);
  ok(Zoco.gameEnd(g, 'room1:2', { answered: 9, stars: 4 }).got === 0, 'the same game again (a reconnect): nothing');
  let paid = 0;
  for (let i = 3; i <= 9; i++) paid += Zoco.gameEnd(g, 'room1:' + i, { answered: 4, stars: 0 }).got;
  ok(paid === P.game * (CAP.game - 1), 'games in a day: only ' + CAP.game + ' pay (a teacher\'s «Otra ronda» many times)');
  let stars = 0;
  for (let i = 10; i <= 14; i++) stars += Zoco.gameEnd(g, 'room1:' + i, { answered: 4, stars: 3 }).got;
  ok(stars === P.star * (CAP.star - 2), 'bonus stars in a day: only ' + CAP.star + ' pay');

  section('the shop: buy once, enough coins, on sale only');
  const b = Students.get('REAL');
  b.zoco.c = 790;
  let x = Zoco.buy(b, 'dralingo-sheikh');
  ok(!x.ok && x.status === 402 && x.why === 'coins' && x.need === 10 && b.zoco.c === 790 && !b.zoco.own.length, 'too few coins (790 for 800): refused, nothing changes («Te faltan 10»)');
  b.zoco.c = 2300;
  x = Zoco.buy(b, 'dralingo-sheikh');
  ok(x.ok && b.zoco.c === 1500 && b.zoco.own.includes('dralingo-sheikh') && b.zoco.sp === 800, 'enough coins: bought (−800), on the record');
  ok(Zoco.buy(b, 'dralingo-sheikh').status === 409 && b.zoco.c === 1500, 'buying it again: refused');
  for (const id of ['bebe-dralingo', 'camello', '__proto__', 'hamdan', '', null]) {
    const y = Zoco.buy(b, id);
    ok(!y.ok && y.status === 404 && b.zoco.c === 1500, 'not on sale: ' + JSON.stringify(id));
  }
  x = Zoco.buy(b, 'latifa-3d');
  ok(x.ok && b.zoco.c === 100 && b.zoco.own.includes('latifa-3d'), 'Latifa con abaya (once held) is on sale: bought (−1400)');
  const v = Zoco.view(b);
  ok(v.items.length === 20 && v.items.find((i) => i.id === 'dralingo-sheikh').owned && v.items.find((i) => i.id === 'panda-3d').price === 1200, 'the shop shows all 20 with their v2 prices, «Tuyo» on the ones bought');
  ok(v.limits.seal === CAP.seal && v.limits.hw === CAP.hw && v.limits.game === CAP.game && v.limits.star === CAP.star, '«¿Cómo gano monedas?» gets the day\'s limits in steps (`limits`)');
  ok(v.caps.seal / 2 === CAP.seal && v.caps.hw / 50 === CAP.hw, '… and `caps` stays in v1 units, so a tab opened before the deploy still reads «30 palabras y 2 tareas»');
  ok(JSON.stringify(v.ways.map((w) => w.coins)) === JSON.stringify([P.seal, P.train, P.hw, P.game, P.star, P.streak]), '… and the six ways with today\'s amounts');
  ok(Students.setAvatar('REAL', 'dralingo-sheikh') && Students.get('REAL').avatar === 'dralingo-sheikh', 'an owned skin can be the avatar');
  ok(!Students.setAvatar('REAL', 'dralingo-fuego-azul') && Students.get('REAL').avatar === 'dralingo-sheikh', 'a skin not owned: refused');
  ok(!Students.setAvatar('NEWB', 'dralingo-sheikh'), '… another kid\'s skin: refused');
  ok(Students.setAvatar('NEWB', 'hamdan'), 'the free saga avatars stay free');

  section('spend, then «Deshacer»: the homework\'s coins go back even below 0');
  const u = Students.get('NEWB');
  nextDay();
  u.zoco.c = 1800;
  mark('NEWB', NEW[2], false); Zoco.settleHw(u, NEW);
  const cBefore = u.zoco.c;
  mark('NEWB', NEW[2], true); r = Zoco.settleHw(u, NEW);
  ok(r.got === P.hw && u.zoco.c === cBefore + P.hw, 'a homework marked: +' + P.hw + ' (' + u.zoco.c + ')');
  ok(Zoco.buy(u, 'dralingo-emperador').ok, 'a purchase with them (−1800)');
  mark('NEWB', NEW[2], false);
  Zoco.settleHw(u, NEW);
  ok(u.zoco.c === cBefore + P.hw - 1800 - P.hw && u.zoco.c < 0, '«Deshacer» after spending: the balance goes below 0 (' + u.zoco.c + '), never a free coin');
  ok(Zoco.buy(u, 'dralingo-clasico').status === 402, '… and nothing can be bought until it is earned back');

  section('a purse of 2026-10-19 takes the v2 amounts, once: coins, characters, welcome and keys untouched');
  const o = Students.get('OLDK');
  o.zoco.day.d = Zoco.localDay(o);   // (its counters are today's: the test's clock has moved on since the record was written)
  Zoco.ensure(o, env);
  const oz = o.zoco;
  ok(oz.v === 1 && oz.pv === 2 && oz.pvAt > 0, 'its purse now pays in the v2 amounts (pv 2; the shape stays v 1, so a server rolled back still reads it)');
  ok(oz.c === 300 && oz.e === 450 && oz.sp === 150 && JSON.stringify(oz.own) === '["dralingo-sheikh"]' && oz.buys.length === 1, 'its 300 coins, its character bought at the old price, what it earned and spent: as they were');
  ok(oz.w === 150 && oz.log.filter((e) => e[2] === 'welcome').length === 1, 'the welcome grant already paid: not paid again, not taken back');
  ok(oz.k['hw:' + NEW[0]] === 50 && oz.k['train:hsk2:1'] === 20, 'every key keeps what it paid');
  ok(oz.q.seal === 21 * P.seal && JSON.stringify(oz.q.hw) === JSON.stringify([['zz-old-1', P.hw], ['zz-old-2', P.hw]]), 'what was waiting goes in today\'s amounts (21 words → ' + 21 * P.seal + ', two homeworks → ' + P.hw + ' each)');
  ok(oz.day.seal === 30 * P.seal && oz.day.hw === 2 * P.hw && oz.day.game === 2 && oz.day.star === 3, 'today\'s counters in today\'s amounts (30 words and 2 homeworks already today: the caps are reached)');
  const at = oz.pvAt;
  ok(Zoco.ensure(o, env) === oz && oz.pvAt === at && oz.c === 300 && oz.q.seal === 21 * P.seal, 'once only (touching it again changes nothing)');
  RP.applySeals('OLDK', 'hsk2', [51], []);
  ok(Zoco.settleSeals(o, 'hsk2').got === 0 && oz.q.seal === 22 * P.seal, 'a new word today: today\'s cap is used, it waits');
  mark('OLDK', NEW[0], false);
  r = Zoco.settleHw(o, NEW);
  ok(r.got === -50 && oz.c === 250, '«Deshacer» of the homework paid 50 under v1: the 50 it paid go back (never minted)');
  ok(Students.setAvatar('OLDK', 'dralingo-sheikh'), 'its character still equips');
  nextDay();
  r = Zoco.settle(o);
  ok(r.got === 22 * P.seal + 2 * P.hw && oz.q.seal === 0 && oz.q.hw.length === 0, 'the next day the line is paid in v2 amounts (+' + (22 * P.seal + 2 * P.hw) + ')');

  section('a purse already in v2 (or later) is never converted again; a damaged line never blocks');
  // a rollback: v2 deployed (pv 2), then a v1 server queued at its own amounts (20 words at 2 = 40 coins, a homework at
  // 50), then v2 again. The words' line holds coins: paid as they stand; a homework is read within 0 … today's 25.
  const rb = Students.getOrCreate(null, 'Kid Rollback');
  Students.updateTareas(rb.code, (all) => { all['zz-rb-1'] = { h: Date.now(), s: Date.now() }; }, { activity: true });
  rb.zoco = { v: 1, pv: 2, at: Date.now() - DAY, c: 10, e: 10, sp: 0, w: 0, ps: 10, own: [], buys: [], k: {}, sk: {}, gm: {}, q: { seal: 40, hw: [['zz-rb-1', 50]] }, day: {}, log: [] };
  Zoco.ensure(rb, env);
  ok(rb.zoco.q.seal === 40 && rb.zoco.q.hw[0][1] === 50 && !rb.zoco.pvAt, 'a pv 2 purse: ensure() converts nothing again (the rolled-back line stays as it was queued)');
  r = Zoco.settle(rb);
  ok(r.got === CAPC.seal + P.hw && rb.zoco.q.seal === 40 - CAPC.seal && rb.zoco.k['hw:zz-rb-1'] === P.hw, 'the next touch: ' + CAPC.seal + ' of the 40 waiting coins of words (the day\'s cap), the homework at today\'s ' + P.hw + ' (its key says ' + P.hw + ': «Deshacer» takes back ' + P.hw + ')');
  const p3 = { v: 1, pv: 3, q: { seal: 40, hw: [['x', 50]] }, day: {} };
  Zoco.upgrade(p3);
  ok(p3.q.seal === 40 && p3.q.hw[0][1] === 50 && p3.pv === 3, 'a purse of a later version (pv 3) rolled back: never halved again');
  const bad = Students.getOrCreate(null, 'Kid Bad Line');
  Students.updateTareas(bad.code, (all) => { all['zz-bad'] = { h: Date.now(), s: Date.now() }; all['zz-ok'] = { h: Date.now(), s: Date.now() }; }, { activity: true });
  bad.zoco = { v: 1, pv: 2, at: Date.now(), c: 0, e: 0, sp: 0, w: 0, ps: 0, own: [], buys: [], k: {}, sk: {}, gm: {}, q: { seal: 0, hw: [null, ['zz-bad', 'abc'], ['zz-ok', 1e9]] }, day: {}, log: [] };
  r = Zoco.settle(bad);
  ok(bad.zoco.q.hw.length === 0 && r.got === P.hw && bad.zoco.k['hw:zz-bad'] === 0 && bad.zoco.k['hw:zz-ok'] === P.hw, 'a damaged line (a null, «abc», a billion): dropped or read within 0 … ' + P.hw + ', the rest still paid (+' + r.got + ')');

  section('the day only moves forward: flipping the time zone never resets the caps');
  const tzr = Students.get('REAL');
  tzr.tz = 'Pacific/Kiritimati';
  const dayK = Zoco.localDay(tzr);
  Zoco.settle(tzr);
  tzr.zoco.day.seal = CAPC.seal;   // (today's seal cap used up)
  tzr.zoco.q.seal = 40;
  tzr.tz = 'Pacific/Niue';
  ok(Zoco.localDay(tzr) < dayK, '(Niue\'s date is a day behind Kiritimati\'s)');
  ok(Zoco.settle(tzr).got === 0 && tzr.zoco.day.d === dayK && tzr.zoco.q.seal === 40, 'back to an earlier date: the counts of the later day stay, nothing waiting is paid');
  tzr.tz = 'Pacific/Kiritimati';
  ok(Zoco.settle(tzr).got === 0, '… and forward again to the same date: still nothing');
  tzr.tz = 'UTC'; tzr.zoco.q.seal = 0; tzr.zoco.day = {};

  section('an automatic account moves into the real one: coins and characters, nothing paid twice');
  nextDay();
  const a = Students.get('AUTO22');
  Zoco.ensure(a, env);
  RP.applySeals('AUTO22', 'hsk2', range(1, 10), []);
  Zoco.settleSeals(a, 'hsk2');
  NEW.forEach((id) => mark('AUTO22', id, true));
  Zoco.settleHw(a, NEW);
  ok(a.zoco.c === 10 * P.seal + CAPC.hw && a.zoco.q.hw.length === NEW.length - CAP.hw, 'the automatic account earned ' + (10 * P.seal + CAPC.hw) + ' (10 words, 2 homeworks) and 1 homework waits');
  // (a class game history of 790 on it, as if it had played for weeks: enough for a character)
  a.zoco.gm['old:1'] = [Date.now(), 790]; a.zoco.c += 790; a.zoco.e += 790;
  ok(Zoco.buy(a, 'dralingo-clasico').ok, 'it bought one (800)');
  const coinsA = a.zoco.c, coinsR = Students.get('REAL').zoco.c;
  const m = Zoco.merge(a, Students.get('REAL'), env);
  const real = Students.get('REAL');
  ok(m.c === coinsA && real.zoco.c === coinsR + coinsA && a.zoco.c === 0, 'its coins join the real account (' + coinsA + ': everything it did is new there)');
  ok(real.zoco.own.includes('dralingo-clasico') && real.zoco.own.includes('dralingo-sheikh'), 'its characters too');
  ok(real.zoco.k['hw:' + NEW[0]] === P.hw && real.zoco.q.hw.some((y) => y[0] === NEW[2] && y[1] === P.hw), 'its homework keys keep what they paid (so «Deshacer» takes them back), its waiting one joins the line');
  RP.applySeals('REAL', 'hsk2', range(1, 10), []);
  ok(Zoco.settleSeals(real, 'hsk2').got === 0, 'its words moving in pay nothing a second time');
  const a1 = Students.get('AUTOV');
  const m1 = Zoco.merge(a1, Students.get('REA2'), env);
  ok(a1.zoco.pv === 2 && m1.c === 0 && Students.get('REA2').zoco.q.hw.some((y) => y[0] === 'zz-auto-1' && y[1] === P.hw), 'an automatic purse of 2026-10-19: its waiting homework joins the line at today\'s ' + P.hw + ', never 50');

  section('a merge never launders coins: work the real account already did is worth nothing');
  const r2 = Students.get('REA2');
  Zoco.ensure(r2, env);
  r2.zoco.q.hw = [];
  RP.applySeals('REA2', 'hsk2', range(1, 50), []);
  Zoco.settleSeals(r2, 'hsk2');
  mark('REA2', NEW[0], true);
  Zoco.settleHw(r2, NEW);
  const c2 = r2.zoco.c;
  ok(c2 === CAPC.seal + P.hw, 'the real account did 50 words and a homework (' + c2 + ')');
  // «Salir» → a fresh automatic account → the same 50 words and the same homework → «Pasar mi progreso»
  const au = Students.createAuto('Dragoncito 777', 'hsk2', 'seal');
  Zoco.ensure(au, env);
  RP.applySeals(au.code, 'hsk2', range(1, 50), []);
  Zoco.settleSeals(au, 'hsk2');
  mark(au.code, NEW[0], true);
  Zoco.settleHw(au, NEW);
  ok(au.zoco.c === CAPC.seal + P.hw, 'the automatic account earned the same ' + (CAPC.seal + P.hw));
  ok(Zoco.merge(au, r2, env).c === 0 && r2.zoco.c === c2, 'the merge: nothing new, no coins');
  // … and spent on duplicate work: the character comes with its price (a debt), never free coins
  const au3 = Students.createAuto('Dragoncito 779', 'hsk2', 'seal');
  Zoco.ensure(au3, env);
  RP.applySeals(au3.code, 'hsk2', range(1, 50), []);
  Zoco.settleSeals(au3, 'hsk2');
  au3.zoco.gm['old:3'] = [Date.now(), 790]; au3.zoco.c += 790; au3.zoco.e += 790;
  ok(Zoco.buy(au3, 'dralingo-sheikh-roja').ok, 'another one: the same 50 words, 790 from games, and it spent 800');
  const mm = Zoco.merge(au3, r2, env);
  ok(mm.c === 790 - 800 && r2.zoco.c === c2 - 10 && r2.zoco.own.includes('dralingo-sheikh-roja'), 'the merge: only the 790 are new, so the character costs the real account 10 (a debt), never free coins');
  ok(Zoco.merge(au3, r2, env).c === 0 && r2.zoco.c === c2 - 10, 'merging the same account again: nothing');
  // real new work does move
  const au2 = Students.createAuto('Dragoncito 778', 'hsk2', 'seal');
  Zoco.ensure(au2, env);
  RP.applySeals(au2.code, 'hsk2', range(41, 60), []);
  Zoco.settleSeals(au2, 'hsk2');
  const before2 = r2.zoco.c;
  const m2 = Zoco.merge(au2, r2, env);
  ok(m2.c === 10 * P.seal && r2.zoco.c === before2 + 10 * P.seal, 'an automatic account with 10 words the real one never marked: +' + 10 * P.seal + ' (only those)');
  RP.applySeals('REA2', 'hsk2', range(51, 60), []);
  ok(Zoco.settleSeals(r2, 'hsk2').got === 0, '… and those words moving in never pay again');

  section('a merge from an automatic account of 2026-10-19: its words move at what they paid (2 each), never erased');
  const v1Auto = (name, purse) => { const x = Students.createAuto(name, 'hsk2', 'seal'); x.zoco = Object.assign({ v: 1, at: Date.now() - DAY, w: 0, own: [], buys: [], k: {}, gm: {}, q: { seal: 0, hw: [] }, day: {}, log: [] }, purse); return x; };
  const fA = v1Auto('Dragoncito 501', { c: 100, e: 100, sp: 0, ps: 100, sk: { hsk2: '101-150' } });
  const tA = Students.getOrCreate(null, 'Kid Merge A');
  const mA = Zoco.merge(fA, tA, env);
  ok(mA.c === 100 && tA.zoco.c === 100 && fA.zoco.ps1 === 100, '50 words paid 100 under v1, new to the real account: +100 (not 50)');
  const fB = v1Auto('Dragoncito 502', { c: 50, e: 200, sp: 150, ps: 200, sk: { hsk2: '1-100' }, own: ['dralingo-sheikh'], buys: [['dralingo-sheikh', 150, Date.now() - DAY]] });
  const tB = Students.getOrCreate(null, 'Kid Merge B');
  const mB = Zoco.merge(fB, tB, env);
  ok(mB.c === 50 && tB.zoco.c === 50 && tB.zoco.own.includes('dralingo-sheikh'), '100 words (200) that bought Dralingo Sheikh at 150 with 50 left: the real account ends at +50 with the Sheikh (never −50)');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2. its own server
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-zoco-'));
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 5 * DAY }));
// a kid who did things BEFORE El Zoco (40 words, 1 practice at the goal, 1 homework sent, 6 days in a row up to yesterday)
// a purse already in the v2 amounts (pv 2) with a balance, and one of 2026-10-19 (v1: no pv)
const purse2 = (c) => ({ v: 1, pv: 2, at: NOW - 30 * DAY, c, e: c, sp: 0, w: 0, ps: 0, own: [], buys: [], k: {}, sk: {}, gm: {}, q: { seal: 0, hw: [] }, day: {}, log: [] });
fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify({
  PRE7: { code: 'PRE7', displayName: 'Kid Before', firstSeen: NOW - 40 * DAY, lastSeen: NOW - DAY, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [],
    ruta: { hsk2: { s: '1-40', p: { 1: 80, 2: 50 } } }, tareas: { [NEW[0]]: { h: NOW - 2 * DAY, s: NOW - 2 * DAY } }, streak: 6, dayDate: today(NOW - DAY), tz: 'UTC' },
  // a kid who saved for weeks, and one with one character's worth
  RICH: { code: 'RICH', displayName: 'Kid Rich', firstSeen: NOW - 60 * DAY, lastSeen: NOW - DAY, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [], tz: 'UTC', zoco: purse2(2600) },
  RIC2: { code: 'RIC2', displayName: 'Kid Rich 2', firstSeen: NOW - 60 * DAY, lastSeen: NOW - DAY, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [], tz: 'UTC', zoco: purse2(1000) },
  // a purse of 2026-10-19: 300 coins, a character bought at 150 and equipped, the welcome grant (150) paid, 10 coins of
  // words (5 words at 2) waiting since yesterday
  OLDV: { code: 'OLDV', displayName: 'Kid V1', firstSeen: NOW - 30 * DAY, lastSeen: NOW - DAY, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [], tz: 'UTC',
    avatar: 'dralingo-sheikh', zoco: { v: 1, at: NOW - DAY, c: 300, e: 450, sp: 150, w: 150, ps: 100, own: ['dralingo-sheikh'], buys: [['dralingo-sheikh', 150, NOW - DAY]],
      k: {}, sk: {}, gm: {}, q: { seal: 10, hw: [] }, day: { d: today(NOW - DAY), seal: 100, hw: 150, game: 6, star: 8 }, log: [[NOW - DAY, 150, 'welcome']] } },
}));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
function req(method, p, o = {}) {
  return new Promise((resolve, reject) => {
    const h = Object.assign({}, o.headers || {});
    if (o.jar && Object.keys(o.jar).length) h.Cookie = Object.entries(o.jar).map(([k, v]) => k + '=' + v).join('; ');
    let data = null;
    if (o.body !== undefined) { data = Buffer.from(JSON.stringify(o.body)); h['Content-Type'] = 'application/json'; h['Content-Length'] = data.length; }
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const sc = res.headers['set-cookie'] || [];
        if (o.jar) sc.forEach((c) => { const m = /^([^=]+)=([^;]*)/.exec(c); if (m) { if (/Max-Age=0\b/.test(c)) delete o.jar[m[1]]; else o.jar[m[1]] = m[2]; } });
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const get = (p, o) => req('GET', p, o);
const post = (p, body, o = {}) => req('POST', p, Object.assign({}, o, { body }));
let ipN = 20;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph, extra) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers, extra || {}) });
const cookieOf = (ph) => Object.entries(ph.jar).map(([k, v]) => k + '=' + v).join('; ');
async function enter(ph, accessCode, name, code) {
  const body = code ? { accessCode, studentCode: code } : { accessCode, displayName: name };
  return (await post('/api/homework/enter', body, as(ph))).json || {};
}
const shop = (ph) => get('/api/zoco', as(ph));
const buy = (ph, id, extra) => post('/api/zoco/buy', { id }, as(ph, extra));
const equip = (ph, id, extra) => post('/api/zoco/equip', { id }, as(ph, extra));
const seals = (ph, level, add, remove) => post('/api/ruta/seals', { level, add, remove }, as(ph));
const tareas = (ph, body) => post('/api/ruta/tareas', body, as(ph));
const home = (ph, code) => get('/api/homework/home?accessCode=&studentCode=' + encodeURIComponent(code) + '&zs=0', as(ph));

// El Entrenamiento: the test's own key of a world (built here; the server never sends one)
const lookOf = (q) => q.text + '|' + q.answers.slice().sort().join('|');
function keyOf(level, worldKey) {
  const Levels = require('../core/levels');
  const Packs = require('../core/packs');
  const E = require('../core/entrenamiento');
  const lvl = Levels.normalize(level);
  const pl = Packs.LEVELS.find((p) => p.id === Levels.info(lvl).pack);
  const w = pl.worlds.find((x) => x.id === worldKey);
  const byText = new Map(), byLook = new Map();
  for (let i = 0; i < 3; i++) w.rounds.forEach((r) => Packs.buildRound(pl, w, r).forEach((q) => { if (!byText.has(q.text)) byText.set(q.text, q.correct); }));
  const W = E.worldsOf(lvl).find((x) => x.key === worldKey);
  E._drills.forWorld(lvl, W).forEach((q) => byLook.set(lookOf(q), q.correct));
  return { get: (q) => (byLook.has(lookOf(q)) ? byLook.get(lookOf(q)) : byText.get(q.text)) };
}
async function play(ph, level, worldKey, rightN) {
  const r = await post('/api/ruta/train/round', { level, world: worldKey }, as(ph));
  if (!r.json || !r.json.ok) return { start: r };
  const K = keyOf(level, worldKey);
  let n = 0;
  for (const q of r.json.questions) {
    const right = K.get(q);
    await post('/api/ruta/train/answer', { round: r.json.round, i: q.i, chosen: n < rightN ? right : q.answers.find((x) => x !== right) }, as(ph));
    n++;
  }
  const f = await post('/api/ruta/train/finish', { round: r.json.round }, as(ph));
  return { start: r, fin: f.json || {}, status: f.status, round: r.json.round };
}

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '', DRALY_TRAINING_BUILT: '1' }),
  });
  try { os.setPriority(srv.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
  srv.stdout.on('data', (d) => { allLog += d; });
  srv.stderr.on('data', (d) => { allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return; } catch (_) {}
  }
  console.error('the server did not start:\n' + allLog.slice(-2000).split(SEED).join('<code>'));
  srv.kill();
  process.exit(2);
}
async function stopServer() {
  if (!srv) return;
  const p = new Promise((r) => srv.once('exit', r));
  srv.kill();
  await p;
  srv = null;
}

// a class PIN game (Reinos de Colores): the teacher's room, kids join with their saved codes, a few answers, «Terminar»
async function pinGame(kids) {
  const { io } = require('socket.io-client');
  const URL = 'http://127.0.0.1:' + PORT;
  const connect = (ph) => io(URL, { transports: ['websocket'], forceNew: true, extraHeaders: ph ? { Cookie: cookieOf(ph), 'CF-Connecting-IP': ph.headers['CF-Connecting-IP'] } : {} });
  const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
  const next = (s, ev, ms, match) => new Promise((res, rej) => {
    const t = setTimeout(() => { s.off(ev, h); rej(new Error('timeout waiting for ' + ev)); }, ms || 8000);
    function h(d) { if (match && !match(d)) return; clearTimeout(t); s.off(ev, h); res(d); }
    s.on(ev, h);
  });
  const host = connect(null);
  const created = await ack(host, 'host:create', { gameType: 'kingdoms', password: SEED });
  const pin = created && created.pin;
  await ack(host, 'host:load-set', { pin, setId: 'pack:yct1-familia-r1' });
  host.emit('host:set-duration', { pin, duration: 60 });
  let lastState = null;
  host.on('state', (st) => { lastState = st; });
  const out = [];
  for (const k of kids) {
    const s = connect(k.ph);
    const me = { s, k, q: null, coins: null, end: null };
    s.on('question', (q) => { me.q = q; });
    s.on('zoco:coins', (d) => { me.coins = d; });
    s.on('game-end', (d) => { me.end = d; });
    me.join = await ack(s, 'player:join', { pin, name: k.name, avatar: k.avatar, studentCode: k.code, accessCode: k.accessCode || '' });
    out.push(me);
  }
  await sleep(600);
  const st0 = lastState;
  // the lobby swap: a skin not owned changes nothing
  const guest = out.find((m) => m.k.swapTry);
  if (guest) { guest.s.emit('player:set-avatar', { pin, avatar: guest.k.swapTry }); await sleep(500); }
  const st1 = lastState;
  const inits = out.map((m) => next(m.s, 'kd:init', 9000).catch(() => null));
  host.emit('host:start', { pin });
  await Promise.all(inits);
  for (const m of out) {
    for (let n = 0; n < (m.k.answers || 0); n++) {
      if (!m.q) { try { await next(m.s, 'question', 5000); } catch (_) { break; } }
      const q = m.q; m.q = null;
      const res = next(m.s, 'answer-result', 5000).catch(() => null);
      m.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: 0 });
      const rr = await res;
      if (rr && rr.kingdoms && rr.kingdoms.needsPlant) {
        m.s.emit('player:kd-plant', { pin, tile: rr.kingdoms.valid[0] });
        await sleep(250);
        if (rr.kingdoms.flags > 1) { const p2 = await next(m.s, 'kd:prompt', 2500).catch(() => null); if (p2) { m.s.emit('player:kd-plant', { pin, tile: p2.valid[0] }); await sleep(250); } }
      }
      await sleep(250);
    }
  }
  const ends = out.map((m) => next(m.s, 'game-end', 9000).catch(() => null));
  host.emit('host:end-now', { pin });
  await Promise.all(ends);
  await sleep(800);
  out.forEach((m) => m.s.close());
  host.close();
  return { pin, out, st0, st1 };
}

// a dropped kid's slot taken by someone typing the same name: the slot's game pays nobody else
async function hijackGame(A, B, codeB) {
  const { io } = require('socket.io-client');
  const URL = 'http://127.0.0.1:' + PORT;
  const connect = (ph) => io(URL, { transports: ['websocket'], forceNew: true, extraHeaders: ph ? { Cookie: cookieOf(ph), 'CF-Connecting-IP': ph.headers['CF-Connecting-IP'] } : {} });
  const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
  const next = (s, ev, ms) => new Promise((res, rej) => { const t = setTimeout(() => { s.off(ev, h); rej(new Error('timeout ' + ev)); }, ms || 8000); function h(d) { clearTimeout(t); s.off(ev, h); res(d); } s.on(ev, h); });
  const host = connect(null);
  const created = await ack(host, 'host:create', { gameType: 'kingdoms', password: SEED });
  const pin = created && created.pin;
  await ack(host, 'host:load-set', { pin, setId: 'pack:yct1-familia-r1' });
  host.emit('host:set-duration', { pin, duration: 60 });
  const sa = connect(A.ph);
  await ack(sa, 'player:join', { pin, name: 'Hija', avatar: '🐉', studentCode: A.code, accessCode: '1002' });
  sa.close();
  await sleep(700);
  const sb = connect(B);
  let coins = null, q = null;
  sb.on('zoco:coins', (d) => { coins = d; });
  sb.on('question', (x) => { q = x; });
  const jb = await ack(sb, 'player:join', { pin, name: 'Hija', avatar: '🐉', studentCode: codeB, accessCode: '1002' });
  const init = next(sb, 'kd:init', 9000).catch(() => null);
  host.emit('host:start', { pin });
  await init;
  for (let n = 0; n < 4; n++) {
    if (!q) { try { await next(sb, 'question', 5000); } catch (_) { break; } }
    const qq = q; q = null;
    const res = next(sb, 'answer-result', 5000).catch(() => null);
    sb.emit('player:answer', { pin, qid: qq.qid, choiceIdx: 0 });
    const rr = await res;
    if (rr && rr.kingdoms && rr.kingdoms.needsPlant) { sb.emit('player:kd-plant', { pin, tile: rr.kingdoms.valid[0] }); await sleep(250); }
    await sleep(250);
  }
  const end = next(sb, 'game-end', 9000).catch(() => null);
  host.emit('host:end-now', { pin });
  await end;
  await sleep(800);
  sb.close(); host.close();
  return { jb, coins };
}

async function run() {
  const P = Zoco.PAY, CAP = Zoco.CAP, CAPC = Zoco.CAPC;
  const stamp = Date.now().toString(36).slice(-4);
  section('every kind of visitor on GET /api/zoco and the home\'s pill');
  const anon = phone();
  let r = await shop(anon);
  ok(r.status === 200 && r.json.student === false && !('coins' in r.json) && /no-store/.test(r.headers['cache-control'] || ''), 'nobody logged in: student: false, no coins, never cached');
  ok((await buy(anon, 'dralingo-sheikh')).status === 403 && (await equip(anon, 'hamdan')).status === 403, '… and nobody can buy or equip');
  const A = phone();
  const kidA = await enter(A, '1002', 'Zoco A ' + stamp);
  ok(kidA.ok && kidA.level === 'hsk2', 'a New HSK 1 kid (made up)');
  r = await shop(A);
  ok(r.status === 200 && r.json.student === true && r.json.coins === 0 && r.json.welcome === 0 && /^[a-f0-9]{12}$/.test(r.json.who), 'their shop: 0 coins, no welcome grant (nothing done before)');
  const HELD4 = ['latifa-3d', 'perro-de-adric', 'poni-de-aileen', 'panda-3d'];
  ok(r.json.items.length === 20 && HELD4.every((id) => r.json.items.some((i) => i.id === id && i.full === '/assets/zoco/full/' + id + '.webp')), 'all 20 characters on sale, the dog, the pony, the panda and Latifa con abaya with their pictures');
  ok(!/Ready Player|origen del modelo|licencia|"hold"/.test(r.text), '… and no word of why they were held');
  ok(r.json.items.find((i) => i.id === 'dralingo-emperador-qin').price === 3000 && Math.min(...r.json.items.map((i) => i.price)) === 800, 'the v2 prices (800 … Dralingo Emperador Qin 3000)');
  ok(!r.text.includes(kidA.studentCode), 'the student code never travels');
  ok(JSON.stringify(r.json.ways.map((w) => w.coins)) === JSON.stringify([1, 10, 25, 5, 2, 15]), '«¿Cómo gano monedas?»: +1 · +10 · +25 · +5 · +2 c/u · +15 (v2)');
  ok(r.json.limits.seal === 30 && r.json.limits.hw === 2 && r.json.limits.game === 4 && r.json.limits.star === 5, '… and the day\'s limits: 30 words, 2 homeworks, 4 games, 5 stars');
  ok(r.json.caps.seal / 2 === 30 && r.json.caps.hw / 50 === 2, '… `caps` in v1 units for a tab opened before the deploy (it divides by 2 and 50)');
  r = await home(A, kidA.studentCode);
  ok(r.json.ok && r.json.zoco && r.json.zoco.coins === 0 && Number(r.json.zoco.now) > 0, 'the home sends the coins pill to the kid\'s own session');
  const B = phone();
  const kidB = await enter(B, '1002', 'Zoco B ' + stamp);
  r = await get('/api/homework/home?accessCode=1002&studentCode=' + encodeURIComponent(kidB.studentCode), as(A));
  ok(r.status === 403 || (r.json && r.json.zoco === null), 'another kid\'s home from this phone: never their coins');

  section('a kid who did things before El Zoco: a one-time welcome grant, nothing twice');
  const Pp = phone();
  const kidP = await enter(Pp, '1002', null, 'PRE7');
  ok(kidP.ok, 'the kid logs in with their class code and code');
  r = await home(Pp, 'PRE7');
  const welcome = Math.round(40 * P.seal / 2 + P.train / 2 + P.hw / 2);
  ok(r.json.zoco && r.json.zoco.coins === welcome && r.json.zoco.news.some((n) => n.why === 'welcome' && n.n === welcome), 'the home: the welcome grant at half of today\'s pay (' + welcome + ') and its news for the «+N monedas» moment');
  r = await seals(Pp, 'hsk2', [41], []);
  ok(r.json.coins && r.json.coins.got === P.seal + P.streak && r.json.coins.items.some((i) => i.why === 'streak'), 'a new word today: +' + P.seal + ', and the 7th day in a row: +' + P.streak + ' (' + JSON.stringify(r.json.coins && r.json.coins.items) + ')');
  const r1 = await seals(Pp, 'hsk2', [], range(1, 40));
  r = await seals(Pp, 'hsk2', range(1, 40), []);
  ok(r1.status === 200 && !r1.json.coins && r.status === 200 && !r.json.coins, 'the old words unmarked and marked again: no coins');
  r = await tareas(Pp, { unsent: [NEW[0]] });
  ok(r.status === 200 && !r.json.coins, 'the homework sent before: «Deshacer» takes nothing (it never paid)');
  r = await tareas(Pp, { sent: [NEW[0]] });
  ok(r.status === 200 && !r.json.coins, '… marked again: nothing');

  section('a purse of 2026-10-19 (v1 amounts) on the server: its coins and characters stay');
  const O = phone();
  ok((await enter(O, '1002', null, 'OLDV')).ok, 'the kid logs in');
  r = await shop(O);
  ok(r.json.coins === 300 + 5 * P.seal && r.json.welcome === 150 && r.json.own.includes('dralingo-sheikh') && r.json.equipped === 'dralingo-sheikh' && r.json.waiting === 0,
    'its 300 coins, its character (bought at 150, still theirs and still equipped), its welcome grant (150, not paid again); the 10 coins of 5 words waiting since yesterday came in at today\'s +' + P.seal + ' a word (' + r.json.coins + ')');
  ok(r.json.items.find((i) => i.id === 'dralingo-sheikh').owned && r.json.items.find((i) => i.id === 'dralingo-sheikh').price === 800, '… «Tuyo» on it, whatever its price is now');

  section('the steps pay in their own endpoints, once');
  r = await seals(A, 'hsk2', [1, 2, 3], []);
  ok(r.json.coins && r.json.coins.got === 3 * P.seal && r.json.coins.c === 3 * P.seal, 'La Base: three words, +' + 3 * P.seal);
  ok(!(await seals(A, 'hsk2', [], [1, 2, 3])).json.coins && !(await seals(A, 'hsk2', [1, 2, 3], [])).json.coins, 'unmark + mark the same words: nothing');
  r = await seals(A, 'hsk2', range(4, 60), []);
  ok(r.json.coins && r.json.coins.got === CAPC.seal - 3 * P.seal, 'many words at once: up to the day\'s cap (' + CAP.seal + ' words)');
  r = await shop(A);
  ok(r.json.coins === CAPC.seal && r.json.waiting === 57 * P.seal - (CAPC.seal - 3 * P.seal), 'the rest waits for tomorrow (' + r.json.waiting + ')');
  r = await tareas(A, { sent: [NEW[1]] });
  ok(r.json.coins && r.json.coins.got === P.hw && r.json.coins.c === CAPC.seal + P.hw, '«¡Ya la mandé!»: +' + P.hw);
  ok(!(await tareas(A, { sent: [NEW[1]] })).json.coins, 'the same mark again: nothing');
  r = await tareas(A, { unsent: [NEW[1]] });
  ok(r.json.coins && r.json.coins.got === -P.hw, '«Deshacer»: the +' + P.hw + ' go back');
  r = await tareas(A, { sent: [NEW[1]] });
  ok(r.json.coins && r.json.coins.got === P.hw, 'marked again: +' + P.hw);
  r = await tareas(A, { sent: [OLD[0]] });
  ok(r.status === 200 && !r.json.coins, 'another level\'s homework: no coins');
  ok((await shop(A)).json.coins === CAPC.seal + P.hw, 'A has ' + (CAPC.seal + P.hw));
  // a code in the body never moves coins to someone else (and the day's 2 homeworks are used: this one waits)
  const wA = (await shop(A)).json.waiting;
  r = await tareas(A, { code: kidB.studentCode, sent: [NEW[2]] });
  const sB = (await shop(B)).json;
  ok(r.status === 200 && !r.json.coins && (await shop(A)).json.waiting === wA + P.hw && sB.coins === 0 && sB.waiting === 0, 'a classmate\'s code in the body: the homework is the logged-in kid\'s (it waits: 2 a day already), the classmate earns nothing');

  section('El Entrenamiento: +' + P.train + ' the first time a world reaches its goal');
  const T = phone();
  const kidT = await enter(T, '1001', 'Zoco T ' + stamp);
  ok(kidT.ok && kidT.level === 'hsk1', 'an HSK 1 kid (Pinyin básico is open from the start)');
  let pl = await play(T, 'hsk1', 'pinyin', 4);
  ok(pl.fin.ok && pl.fin.pct < 70 && !pl.fin.coins, 'a round below the goal: no coins (' + pl.fin.pct + ' %)');
  pl = await play(T, 'hsk1', 'pinyin', 99);
  ok(pl.fin.ok && pl.fin.pct >= 70 && pl.fin.coins && pl.fin.coins.got === P.train, 'a round at the goal: +' + P.train + ' (' + pl.fin.pct + ' %)');
  const again = await post('/api/ruta/train/finish', { round: pl.round }, as(T));
  ok(again.json.ok && !again.json.coins, 'the same round finished again: nothing');
  pl = await play(T, 'hsk1', 'pinyin', 99);
  ok(pl.fin.ok && !pl.fin.coins, 'the world played again at its goal: nothing (first time only)');

  section('the shop: strangers, other kids, other sites, too few coins');
  const R = phone();
  ok((await enter(R, '1002', null, 'RICH')).ok, 'a kid who saved 2600 coins logs in');
  const coinsR0 = (await shop(R)).json.coins;
  ok(coinsR0 === 2600, '… 2600 in their purse');
  r = await buy(B, 'dralingo-sheikh');
  ok(r.status === 402 && r.json.why === 'coins' && r.json.need === 800 && (await shop(B)).json.coins === 0, 'too few coins: 402 («Te faltan 800»), nothing bought');
  r = await buy(A, 'dralingo-sheikh');
  ok(r.status === 402 && r.json.need === 800 - (CAPC.seal + P.hw), 'A with ' + (CAPC.seal + P.hw) + ' coins: «Te faltan ' + (800 - (CAPC.seal + P.hw)) + '» (a character takes weeks)');
  ok((await buy(R, 'dralingo-sheikh', { 'Sec-Fetch-Site': 'cross-site' })).status === 403, 'a request from another site: 403');
  ok((await buy(R, 'dralingo-sheikh', { Origin: 'https://evil.example' })).status === 403, 'another Origin: 403');
  ok((await post('/api/zoco/buy', { id: 'dralingo-sheikh', who: 'aaaaaaaaaaaa' }, as(R))).status === 409, 'a sibling\'s mirror (another account\'s who): 409');
  for (const id of ['bebe-dralingo', '__proto__', 'hamdan', 'camello']) {
    r = await buy(R, id);
    ok(r.status === 404 && (await shop(R)).json.coins === coinsR0, 'not on sale, refused: ' + id);
  }
  r = await post('/api/zoco/buy', { id: 'dralingo-sheikh', code: kidB.studentCode }, as(R));
  ok(r.status === 200 && r.json.ok && r.json.coins === coinsR0 - 800 && r.json.own.includes('dralingo-sheikh'), 'R buys Dralingo Sheikh (800): their own purse, a code in the body ignored');
  ok((await shop(B)).json.own.length === 0 && (await shop(B)).json.coins === 0, '… B owns nothing and paid nothing');
  ok((await buy(R, 'dralingo-sheikh')).status === 409, 'buying it again: 409');
  r = await buy(R, 'latifa-3d');
  ok(r.status === 200 && r.json.coins === coinsR0 - 800 - 1400 && r.json.own.includes('latifa-3d'), 'R buys Latifa con abaya (1400): once held, on sale now');
  const coinsR = r.json.coins;

  section('a skin as the avatar: only when owned');
  ok((await equip(B, 'dralingo-sheikh')).status === 403, 'B equips R\'s skin: refused');
  r = await post('/api/homework/avatar', { accessCode: '1002', studentCode: kidB.studentCode, avatar: 'dralingo-sheikh' }, as(B));
  ok(r.status === 400, '… nor through Mi perfil\'s old avatar endpoint');
  ok((await equip(R, 'dralingo-fuego-azul')).status === 403, 'R equips a skin not bought: refused');
  ok((await equip(B, 'panda-3d')).status === 403, '… B the panda (on sale, not bought): refused');
  ok((await equip(R, 'latifa-3d')).status === 200, 'R equips Latifa con abaya, bought');
  r = await equip(R, 'dralingo-sheikh');
  ok(r.status === 200 && r.json.ok, 'R equips Dralingo Sheikh, bought');
  ok((await shop(R)).json.equipped === 'dralingo-sheikh', '… it is their avatar now');
  ok((await equip(R, 'dralingo-sheikh', { 'Sec-Fetch-Site': 'cross-site' })).status === 403, 'equip from another site: 403');
  r = await equip(B, 'hamdan');
  ok(r.status === 200, 'the free saga avatars stay free');

  section('the purchase is atomic (three taps at once never buy twice or go below 0)');
  const C = phone();
  const kidC = await enter(C, '1002', null, 'RIC2');
  r = await shop(C);
  const cC = r.json.coins;
  const both = await Promise.all([buy(C, 'dralingo-clasico'), buy(C, 'dralingo-clasico'), buy(C, 'dralingo-sheikh-roja')]);
  const okN = both.filter((x) => x.status === 200).length;
  const after = (await shop(C)).json;
  ok(okN === 1 && after.coins === cC - 800 && after.own.length === 1, 'three buys at once with ' + cC + ' coins (one character\'s worth): ' + okN + ' bought, ' + after.coins + ' left, never twice');

  section('a class PIN game: a skin in the room, +' + P.game + ' played for real, +' + P.star + ' a bonus star');
  const res = await pinGame([
    { ph: R, name: 'Ana ' + stamp, code: 'RICH', accessCode: '1002', avatar: '🐉', answers: 4 },
    { ph: B, name: 'Beto ' + stamp, code: kidB.studentCode, accessCode: '1002', avatar: 'dralingo-sheikh', answers: 4, swapTry: 'dralingo-sheikh' },
    { ph: C, name: 'Caro ' + stamp, code: kidC.studentCode, accessCode: '1002', avatar: 'panda-3dX', answers: 1 },
    { ph: phone(), name: 'Dani ' + stamp, code: 'RICH', accessCode: '', avatar: 'dralingo-sheikh', answers: 4 },
  ]);
  const [mA, mB, mC, mD] = res.out;
  ok(mA.join && mA.join.ok && mA.join.avatar === 'dralingo-sheikh' && mA.join.skins.includes('dralingo-sheikh') && mA.join.skins.includes('latifa-3d'), 'R joins: the room plays R\'s skin (the account\'s skin wins over the phone\'s pick) and tells the phone which skins R owns');
  ok(mB.join && mB.join.ok && mB.join.avatar === '🐉' && mB.join.skins.length === 0, 'B sends a skin B does not own: the room plays its base character (🐉)');
  ok(mD.join && mD.join.ok && mD.join.guest === true && mD.join.avatar === '🐉', 'a stranger typing R\'s code with R\'s skin: a guest, never R\'s skin');
  const roster = (st) => Object.values((st && st.players) || {});
  ok(roster(res.st0).some((p) => p.avatar === 'dralingo-sheikh' && /^Ana /.test(p.name)), 'the projector\'s player list carries R\'s skin');
  ok(!roster(res.st1).some((p) => /^Beto /.test(p.name) && p.avatar === 'dralingo-sheikh'), 'the lobby swap to a skin not owned: nothing changes');
  const meA = mA.end && mA.end.me;
  ok(meA && meA.skin === 'dralingo-sheikh', 'the ending: R\'s card is drawn with R\'s skin');
  const hostRows = mA.end && mA.end.fin ? [].concat(mA.end.fin.crews.red || [], mA.end.fin.crews.gold || []) : [];
  ok(hostRows.some((x) => x.skin === 'dralingo-sheikh'), '… and the ceremony\'s crews too');
  const starsA = meA && Array.isArray(meA.stars) ? meA.stars.length : 0;
  ok(mA.coins && mA.coins.got === P.game + P.star * Math.min(starsA, CAP.star), 'R played for real: +' + P.game + ' and +' + P.star + ' per bonus star (' + starsA + ' stars → ' + (mA.coins && mA.coins.got) + ')');
  ok(mC.coins === null, 'C answered once: not played for real, no coins');
  ok(mC.join && mC.join.avatar === '🐼', 'a skin smuggled through the 8-character cut («panda-3dX» → «panda-3d», not owned): its emoji, never the skin');
  ok(mD.coins === null && (await shop(R)).json.coins === coinsR + (mA.coins ? mA.coins.got : 0), 'the stranger\'s join paid nothing to R');
  const cA0 = (await shop(A)).json.coins, cC0 = (await shop(C)).json.coins;
  const hj = await hijackGame({ ph: A, code: kidA.studentCode }, C, kidC.studentCode);
  ok(hj.jb && hj.jb.ok && hj.jb.rejoined === true, 'C types the name of A\'s dropped slot and takes it (as rooms always did)');
  ok(hj.coins === null && (await shop(C)).json.coins === cC0 && (await shop(A)).json.coins === cA0, '… but that slot\'s game pays nobody: not C, not A');

  section('nothing in the record that the phone could have written');
  await sleep(1500);
  const recs = JSON.parse(fs.readFileSync(path.join(DATA, 'student-records.json'), 'utf8'));
  const za = recs.RICH && recs.RICH.zoco;
  ok(za && za.v === 1 && za.pv === 2 && Array.isArray(za.own) && za.own.length === 2 && JSON.stringify(za).length < 3000, 'R\'s purse on their record (' + JSON.stringify(za || {}).length + ' characters)');
  ok(recs.RICH.avatar === 'dralingo-sheikh', 'R\'s avatar: the skin');
  ok(recs.OLDV && recs.OLDV.zoco.pv === 2 && recs.OLDV.zoco.c === 300 + 5 * P.seal && recs.OLDV.zoco.w === 150, 'the purse of 2026-10-19 saved in v2 amounts, its coins and welcome kept');
  const zA = recs[kidA.studentCode] && recs[kidA.studentCode].zoco;
  ok(zA && zA.pv === 2, 'a purse opened today is v2 from the start');
  ok(!allLog.includes(kidA.studentCode) && !allLog.includes(SEED), 'no student code or teacher code in the server log');
}

(async () => {
  try {
    unit();
  } catch (e) { failed++; console.log('  ✖ unit part crashed: ' + (e && e.stack || e)); }
  Date.now = realNow;
  try {
    await startServer();
    await run();
  } catch (e) { failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  console.log((failed ? 'FAIL' : 'PASS') + ' · ' + passed + ' passed, ' + failed + ' failed');
  if (failed && allLog) console.log(allLog.split(SEED).join('<code>').split(LEGACY).join('<legacy>').slice(-1500));
  for (const d of [UNIT, DATA]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
  process.exit(failed ? 1 : 0);
})();
