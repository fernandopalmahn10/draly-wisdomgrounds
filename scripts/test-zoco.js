#!/usr/bin/env node
// test-zoco.js — El Zoco de Dralingo (2026-10-19, his OK: "Okay I approve the design of the Souq"): coins judged by the
// server, the characters shop, a skin as the kid's character everywhere. Two parts, both on MADE-UP accounts in temporary
// folders (never data/, never the live site); throw-away teacher codes that are never printed:
//   1. in this process (core/zoco.js on a temp folder, the clock moved by hand): the catalog against saga.js and the
//      files, held characters never on sale, the amounts, the daily caps and what waits for the next days, «Deshacer»
//      taking its +50 back (even below 0 after a purchase: no spend-then-undo minting), nothing paid twice (unmark +
//      mark, a replayed practice, the same game), the 7-day streak, the welcome grant from what was done before,
//      the merge of an automatic account (only work NEW to the real account moves: no laundering loop), the caps' day
//      only moving forward (a time-zone flip), buying (atomic, owned, too few coins), setAvatar only for an owned skin,
//      SnowMap / saga resolving a skin id, the held characters' pictures not published
//   2. its OWN server (port 4580, never 3000): GET /api/zoco and the home's pill for every kind of visitor, the steps
//      paying in their own endpoints (seals, homework marks, a practice at its goal, a class PIN game played for real
//      with its bonus stars), a stranger / another kid / another site never earning, spending or equipping for someone,
//      buying with too few coins refused, held characters invisible and unbuyable, a skin not owned refused as an
//      avatar (homework, equip, a PIN join, the lobby swap, the 8-character cut), a skin showing in a pin game's player
//      list and ending, and a dropped kid's slot taken by a classmate paying nobody
//   node scripts/test-zoco.js            (--port 4580 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
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
  section('the catalog: his renders, the right ones, light files');
  const ids = Zoco.CATALOG.map((x) => x.id);
  ok(ids.length === 20 && new Set(ids).size === 20, 'twenty characters in the catalog (the 22 he saw in green, minus the two cone-hat babies)');
  ok(Saga.ZOCO.length === ids.length && Saga.ZOCO.every((z) => ids.includes(z.id)), 'saga.js draws exactly the catalog\'s characters (one list each, the same ids)');
  ['bebe-dralingo', 'bebe-dralingo-alas', 'dralingo-come-palabras', 'camello', 'monje-john', 'chica-kung-fu', 'hombre-latino', 'jefe-maya']
    .forEach((id) => ok(!ids.includes(id) && !Saga.zoco(id), 'kept out: ' + id));
  const held = Zoco.CATALOG.filter((x) => x.hold).map((x) => x.id).sort();
  ok(JSON.stringify(held) === JSON.stringify(['latifa-3d', 'panda-3d', 'perro-de-adric', 'poni-de-aileen']), 'held until he confirms where the model came from: the dog, the pony, the panda, Latifa con abaya (' + held.join(', ') + ')');
  ok(Zoco.CATALOG.every((x) => x.price >= 150 && x.price <= 400 && Number.isInteger(x.price)), 'prices 150-400');
  ok(Zoco.CATALOG.every((x) => typeof x.blurb === 'string' && x.blurb.length > 10 && !/[㐀-鿿]/.test(x.blurb) && !/—/.test(x.blurb)), 'a Spanish line for each, no hanzi, no em dash');
  ok(Saga.ZOCO.every((z) => /^[a-z0-9-]{3,40}$/.test(z.id) && !Saga.avatar(z.id) && !Saga.LEGACY_AVATARS[z.id]), 'skin ids never collide with a saga avatar or an old avatar name');
  const pub = path.join(ROOT, 'public', 'assets', 'zoco');
  let big = 0, missing = 0;
  const sold = Zoco.CATALOG.filter((x) => !x.hold).map((x) => x.id);
  sold.forEach((id) => {
    ['full', 'avatar'].forEach((k) => {
      const f = path.join(pub, k, id + '.webp');
      if (!fs.existsSync(f)) { missing++; return; }
      const n = fs.statSync(f).size;
      if (n > (k === 'full' ? 60 : 30) * 1024 || n < 2000) big++;
    });
  });
  ok(missing === 0, 'every character on sale has its full-body picture and its head (' + sold.length * 2 + ' files)');
  ok(big === 0, 'full-body pictures ≤ 60 KB, heads ≤ 30 KB (compressed)');
  ok(held.every((id) => !fs.existsSync(path.join(pub, 'full', id + '.webp')) && !fs.existsSync(path.join(pub, 'avatar', id + '.webp'))),
    'the held characters\' pictures are not published (their licence is still to confirm)');
  const extra = fs.readdirSync(path.join(pub, 'full')).concat(fs.readdirSync(path.join(pub, 'avatar'))).filter((f) => !sold.includes(f.replace(/\.webp$/, '')));
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

  section('a skin id on every page and in every game');
  ok(Saga.avatarUrl('dralingo-fuego-azul') === '/assets/zoco/avatar/dralingo-fuego-azul.webp' && Saga.skinBody('hamdan-3d') === '/assets/zoco/full/hamdan-3d.webp', 'saga.js: a skin\'s head and full body');
  ok(Saga.avatarUrl('hamdan') === '/assets/saga/avatars/hamdan.webp' && Saga.skinBody('hamdan') === null, '… the free saga avatars as before');
  ok(Saga.emojiOf('dralingo-emperador-qin') === '🐉' && Saga.emojiOf('profe-fer') === '👨‍🏫' && Saga.emojiOf('panda-3d') === '🐼' && Saga.emojiOf('🧔') === '🧔' && Saga.emojiOf('x-y') === '', 'a text-only list prints the character\'s emoji, never an id');
  ok(Saga.labelOf('aileen-3d') === 'Aileen artes marciales' && Saga.labelOf('hamdan') === 'Hamdan', '«Vas a jugar como …»: the skin\'s name');
  ok(SnowMap.skinFor('dralingo-fuego-azul', 'Ana') === 'dralingo-fuego-azul', 'SnowMap.skinFor (server and phones): a skin is the kid\'s character');
  ok(['dralingo', 'fer', 'hamdan', 'latifa', 'aileen', 'adric', 'adrian', 'camel', 'plane', 'falcon', 'oryx'].includes(SnowMap.skinFor('no-such-skin', 'Ana')), '… an unknown id falls back to a saga character');
  ok(Saga.zoco('__proto__') === null && Saga.zoco('constructor') === null && Zoco.item('__proto__') === null, 'own keys only (no prototype tricks)');

  section('the welcome grant: what was done before El Zoco never pays coin by coin');
  const env = { goal: 70 };
  const pre = Students.get('PREA');
  Zoco.ensure(pre, env);
  const want = Math.min(Zoco.WELCOME_MAX, 40 + 10 * 1 + 25 * 1);
  ok(pre.zoco.c === want && pre.zoco.w === want && pre.zoco.e === want, 'a one-time welcome grant from it (40 words + 1 practice at the goal + 1 homework sent = ' + want + ', at most ' + Zoco.WELCOME_MAX + ')');
  ok(Zoco.ensure(pre, env) === pre.zoco && pre.zoco.c === want, '… once only');
  const fresh = Students.get('NEWB');
  Zoco.ensure(fresh, env);
  ok(fresh.zoco.c === 0 && fresh.zoco.w === 0, 'a new kid starts at 0');
  // re-sealing words done before: nothing
  RP.applySeals('PREA', 'hsk2', [], range(1, 40));
  RP.applySeals('PREA', 'hsk2', range(1, 40), []);
  ok(Zoco.settleSeals(pre, 'hsk2').got === 0 && pre.zoco.c === want, 'unmarking and marking again the 40 old words pays nothing');
  RP.applySeals('PREA', 'hsk2', [41, 42], []);
  ok(Zoco.settleSeals(pre, 'hsk2').got === 4 && pre.zoco.c === want + 4, 'two new words: +2 each');
  RP.applySeals('PREA', 'hsk2', [], [41]);
  ok(Zoco.settleSeals(pre, 'hsk2').got === 0, 'unmark one: nothing taken (the word stays counted)');
  RP.applySeals('PREA', 'hsk2', [41], []);
  ok(Zoco.settleSeals(pre, 'hsk2').got === 0 && pre.zoco.c === want + 4, '… and marking it again pays nothing (no farming by repeating a tap)');
  // the practice done before: never again
  RP.recordPractice('PREA', 'hsk2', 1, 95);
  ok(Zoco.settleTrain(pre, 'hsk2', 70).got === 0, 'world 1 (at its goal before El Zoco) played again: nothing');
  RP.recordPractice('PREA', 'hsk2', 2, 60);
  ok(Zoco.settleTrain(pre, 'hsk2', 70).got === 0, 'world 2 below its goal: nothing');
  RP.recordPractice('PREA', 'hsk2', 2, 80);
  ok(Zoco.settleTrain(pre, 'hsk2', 70).got === 20, 'world 2 reaches its goal: +20');
  RP.recordPractice('PREA', 'hsk2', 2, 100);
  ok(Zoco.settleTrain(pre, 'hsk2', 70).got === 0, '… its best beaten later: nothing more');
  // the homework sent before: unmark + mark = nothing, never a take-back
  const mark = (code, id, on) => Students.updateTareas(code, (all) => { all[id] = all[id] || {}; if (on) { all[id].h = all[id].h || Date.now(); all[id].s = Date.now(); } else delete all[id].s; }, { activity: true });
  mark('PREA', NEW[0], false);
  ok(Zoco.settleHw(pre, NEW).got === 0, 'the homework sent before El Zoco unmarked: nothing taken back (it never paid)');
  mark('PREA', NEW[0], true);
  ok(Zoco.settleHw(pre, NEW).got === 0, '… and marked again: nothing paid');

  section('the homework marks: +50 once, «Deshacer» takes them back, the day\'s cap');
  mark('NEWB', NEW[1], true);
  let r = Zoco.settleHw(fresh, NEW);
  ok(r.got === 50 && fresh.zoco.c === 50, '«¡Ya la mandé!»: +50');
  ok(Zoco.settleHw(fresh, NEW).got === 0, 'the same marks again: nothing');
  mark('NEWB', NEW[1], false);
  r = Zoco.settleHw(fresh, NEW);
  ok(r.got === -50 && fresh.zoco.c === 0 && r.items[0].why === 'undo', '«Deshacer»: the +50 go back');
  mark('NEWB', NEW[1], true);
  ok(Zoco.settleHw(fresh, NEW).got === 50 && fresh.zoco.c === 50, 'marked again: +50 (one payment while it is marked)');
  mark('NEWB', OLD[0], true);
  ok(Zoco.settleHw(fresh, NEW).got === 0, 'another level\'s homework (it only plays): nothing');
  // the cap: 3 homeworks a day, the 4th waits (a new day; NEW has 3, one already paid: made-up ids are enough here)
  nextDay();
  const four = NEW.concat(['zz-e09-r1', 'zz-e09-r2']);
  four.forEach((id) => mark('NEWB', id, true));
  r = Zoco.settleHw(fresh, four);
  ok(fresh.zoco.day.hw === Zoco.CAP.hw && fresh.zoco.q.hw.length === 1 && r.got === Zoco.CAP.hw, 'four new homeworks in a day: three are paid (cap ' + Zoco.CAP.hw + '), one waits for tomorrow');
  mark('NEWB', 'zz-e09-r2', false);
  ok(Zoco.settleHw(fresh, four).got === 0 && fresh.zoco.q.hw.length === 0, 'the one waiting unmarked: it leaves the line (nothing to take back)');
  mark('NEWB', 'zz-e09-r2', true);
  Zoco.settleHw(fresh, four);
  ok(fresh.zoco.q.hw.length === 1, 'marked again: back in line');
  const c0 = fresh.zoco.c;
  nextDay();
  r = Zoco.settle(fresh);
  ok(r.got === 50 && fresh.zoco.c === c0 + 50 && fresh.zoco.q.hw.length === 0, 'a new day: what waited is paid first thing (+50)');

  section('La Base\'s words: +2 each, first time only, 50 words a day (the rest waits)');
  const before = fresh.zoco.c;
  RP.applySeals('NEWB', 'hsk2', range(1, 60), []);
  r = Zoco.settleSeals(fresh, 'hsk2');
  ok(r.got === Zoco.CAP.seal && fresh.zoco.q.seal === 120 - Zoco.CAP.seal, '60 words at once: ' + Zoco.CAP.seal + ' coins today, ' + (120 - Zoco.CAP.seal) + ' wait');
  RP.applySeals('NEWB', 'hsk2', [61], []);
  ok(Zoco.settleSeals(fresh, 'hsk2').got === 0 && fresh.zoco.q.seal === 120 - Zoco.CAP.seal + 2, 'one more today: it waits too');
  nextDay();
  r = Zoco.settle(fresh);
  ok(r.got === 22 && fresh.zoco.q.seal === 0 && fresh.zoco.c === before + Zoco.CAP.seal + 22, 'the next day the waiting coins come in (+22)');

  section('the 7-day streak: +30 at 7, 14, 21… of the same run, once each');
  const st = Students.get('NEWB');
  st.streak = 6; st.dayDate = today(Date.now() - DAY);
  ok(Zoco.settleStreak(st).got === 0, '6 days: nothing yet');
  st.streak = 7; st.dayDate = today();
  ok(Zoco.settleStreak(st).got === 30, '7 days in a row: +30');
  ok(Zoco.settleStreak(st).got === 0, '… once');
  st.streak = 14; st.dayDate = today(Date.now() + 7 * DAY);
  ok(Zoco.settleStreak(st).got === 30, '14 days of the same run: +30 more');
  ok(Zoco.streakKeys(pre).length === 1 && Object.prototype.hasOwnProperty.call(pre.zoco.k, Zoco.streakKeys(pre)[0]) && pre.zoco.k[Zoco.streakKeys(pre)[0]] === 0, 'a streak reached before El Zoco never pays');

  section('a class PIN game: +10 played for real, +5 a bonus star, once per game, the day\'s caps');
  const g = Students.get('REAL');
  Zoco.ensure(g, env);
  ok(Zoco.gameEnd(g, 'room1:1', { answered: 2, stars: 3 }).got === 0, '2 answers: not played for real (nothing)');
  ok(Zoco.gameEnd(g, 'room1:2', { answered: 5, stars: 2 }).got === 20, '5 answers and 2 bonus stars: +10 +5 +5');
  ok(Zoco.gameEnd(g, 'room1:2', { answered: 9, stars: 4 }).got === 0, 'the same game again (a reconnect): nothing');
  let paid = 0;
  for (let i = 3; i <= 9; i++) paid += Zoco.gameEnd(g, 'room1:' + i, { answered: 4, stars: 0 }).got;
  ok(paid === 10 * (Zoco.CAP.game - 1), 'games in a day: only ' + Zoco.CAP.game + ' pay (a teacher\'s «Otra ronda» many times)');
  let stars = 0;
  for (let i = 10; i <= 14; i++) stars += Zoco.gameEnd(g, 'room1:' + i, { answered: 4, stars: 3 }).got;
  ok(stars === 5 * (Zoco.CAP.star - 2), 'bonus stars in a day: only ' + Zoco.CAP.star + ' pay');

  section('the shop: buy once, enough coins, on sale only');
  const b = Students.get('REAL');
  b.zoco.c = 120;
  let x = Zoco.buy(b, 'dralingo-sheikh');
  ok(!x.ok && x.status === 402 && x.why === 'coins' && b.zoco.c === 120 && !b.zoco.own.length, 'too few coins (120 for 150): refused, nothing changes');
  b.zoco.c = 360;
  x = Zoco.buy(b, 'dralingo-sheikh');
  ok(x.ok && b.zoco.c === 210 && b.zoco.own.includes('dralingo-sheikh') && b.zoco.sp === 150, 'enough coins: bought (−150), on the record');
  ok(Zoco.buy(b, 'dralingo-sheikh').status === 409 && b.zoco.c === 210, 'buying it again: refused');
  for (const id of ['latifa-3d', 'perro-de-adric', 'poni-de-aileen', 'panda-3d', 'bebe-dralingo', 'camello', '__proto__', 'hamdan', '', null]) {
    const y = Zoco.buy(b, id);
    ok(!y.ok && y.status === 404 && b.zoco.c === 210, 'not on sale: ' + JSON.stringify(id));
  }
  const v = Zoco.view(b);
  ok(v.items.length === 16 && !v.items.some((i) => Zoco.item(i.id).hold) && v.items.find((i) => i.id === 'dralingo-sheikh').owned, 'the shop shows the 16 on sale (a held one only to a kid who already owns it), «Tuyo» on the one bought');
  ok(Students.setAvatar('REAL', 'dralingo-sheikh') && Students.get('REAL').avatar === 'dralingo-sheikh', 'an owned skin can be the avatar');
  ok(!Students.setAvatar('REAL', 'dralingo-fuego-azul') && Students.get('REAL').avatar === 'dralingo-sheikh', 'a skin not owned: refused');
  ok(!Students.setAvatar('NEWB', 'dralingo-sheikh'), '… another kid\'s skin: refused');
  ok(Students.setAvatar('NEWB', 'hamdan'), 'the free saga avatars stay free');

  section('spend, then «Deshacer»: the 50 go back even below 0');
  const u = Students.get('NEWB');
  u.zoco.c = 260;
  mark('NEWB', NEW[2], false); Zoco.settleHw(u, NEW);
  const cBefore = u.zoco.c;
  mark('NEWB', NEW[2], true); r = Zoco.settleHw(u, NEW);
  ok(r.got === 50 && u.zoco.c === cBefore + 50, 'a homework marked: +50 (' + u.zoco.c + ')');
  ok(Zoco.buy(u, 'dralingo-emperador').ok, 'a purchase with them (−250)');
  mark('NEWB', NEW[2], false);
  Zoco.settleHw(u, NEW);
  ok(u.zoco.c === cBefore + 50 - 250 - 50 && u.zoco.c < 0, '«Deshacer» after spending: the balance goes below 0 (' + u.zoco.c + '), never a free coin');
  ok(Zoco.buy(u, 'dralingo-clasico').status === 402, '… and nothing can be bought until it is earned back');

  section('the day only moves forward: flipping the time zone never resets the caps');
  const tzr = Students.get('REAL');
  tzr.tz = 'Pacific/Kiritimati';
  const dayK = Zoco.localDay(tzr);
  Zoco.settle(tzr);
  tzr.zoco.day.seal = Zoco.CAP.seal;   // (today's seal cap used up)
  tzr.zoco.q.seal = 40;
  tzr.tz = 'Pacific/Niue';
  ok(Zoco.localDay(tzr) < dayK, '(Niue\'s date is a day behind Kiritimati\'s)');
  ok(Zoco.settle(tzr).got === 0 && tzr.zoco.day.d === dayK && tzr.zoco.q.seal === 40, 'back to an earlier date: the counts of the later day stay, nothing waiting is paid');
  tzr.tz = 'Pacific/Kiritimati';
  ok(Zoco.settle(tzr).got === 0, '… and forward again to the same date: still nothing');
  tzr.tz = 'UTC'; tzr.zoco.q.seal = 0; tzr.zoco.day = {};

  section('an automatic account moves into the real one: coins and characters, nothing paid twice');
  const a = Students.get('AUTO22');
  Zoco.ensure(a, env);
  RP.applySeals('AUTO22', 'hsk2', range(1, 10), []);
  Zoco.settleSeals(a, 'hsk2');
  NEW.forEach((id) => mark('AUTO22', id, true));
  Zoco.settleHw(a, NEW);
  ok(a.zoco.c === 20 + 50 * NEW.length && Zoco.buy(a, 'dralingo-clasico').ok, 'the automatic account earned ' + (20 + 50 * NEW.length) + ' and bought one (150)');
  const coinsA = a.zoco.c, coinsR = Students.get('REAL').zoco.c;
  const m = Zoco.merge(a, Students.get('REAL'), env);
  const real = Students.get('REAL');
  ok(m.c === coinsA && real.zoco.c === coinsR + coinsA && a.zoco.c === 0, 'its coins join the real account (' + coinsA + ': everything it did is new there)');
  ok(real.zoco.own.includes('dralingo-clasico') && real.zoco.own.includes('dralingo-sheikh'), 'its characters too');
  ok(real.zoco.k['hw:' + NEW[0]] === 50, 'its homework keys keep what they paid (so «Deshacer» on the real account takes the 50 back)');
  RP.applySeals('REAL', 'hsk2', range(1, 10), []);
  ok(Zoco.settleSeals(real, 'hsk2').got === 0, 'its words moving in pay nothing a second time');

  section('a merge never launders coins: work the real account already did is worth nothing');
  const r2 = Students.get('REA2');
  Zoco.ensure(r2, env);
  RP.applySeals('REA2', 'hsk2', range(1, 50), []);
  Zoco.settleSeals(r2, 'hsk2');
  mark('REA2', NEW[0], true);
  Zoco.settleHw(r2, NEW);
  const c2 = r2.zoco.c;
  ok(c2 === Zoco.CAP.seal + 50, 'the real account did 50 words and a homework (' + c2 + ')');
  // «Salir» → a fresh automatic account → the same 50 words and the same homework → spend → «Pasar mi progreso»
  const au = Students.createAuto('Dragoncito 777', 'hsk2', 'seal');
  Zoco.ensure(au, env);
  RP.applySeals(au.code, 'hsk2', range(1, 50), []);
  Zoco.settleSeals(au, 'hsk2');
  mark(au.code, NEW[0], true);
  Zoco.settleHw(au, NEW);
  ok(au.zoco.c === Zoco.CAP.seal + 50 && Zoco.buy(au, 'dralingo-sheikh-roja').ok, 'the automatic account earned the same ' + (Zoco.CAP.seal + 50) + ' and spent 150');
  const mm = Zoco.merge(au, r2, env);
  ok(mm.c === -150 && r2.zoco.c === c2 - 150 && r2.zoco.own.includes('dralingo-sheikh-roja'), 'the merge: nothing new, so the character comes with its price (a debt of 150), never free coins');
  ok(Zoco.merge(au, r2, env).c === 0 && r2.zoco.c === c2 - 150, 'merging the same account again: nothing');
  // real new work does move
  const au2 = Students.createAuto('Dragoncito 778', 'hsk2', 'seal');
  Zoco.ensure(au2, env);
  RP.applySeals(au2.code, 'hsk2', range(41, 60), []);
  Zoco.settleSeals(au2, 'hsk2');
  const before2 = r2.zoco.c;
  const m2 = Zoco.merge(au2, r2, env);
  ok(m2.c === 20 && r2.zoco.c === before2 + 20, 'an automatic account with 10 words the real one never marked: +20 (only those)');
  RP.applySeals('REA2', 'hsk2', range(51, 60), []);
  ok(Zoco.settleSeals(r2, 'hsk2').got === 0, '… and those words moving in never pay again');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2. its own server
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-zoco-'));
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 5 * DAY }));
// a kid who did things BEFORE El Zoco (40 words, 1 practice at the goal, 1 homework sent, 6 days in a row up to yesterday)
fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify({
  PRE7: { code: 'PRE7', displayName: 'Kid Before', firstSeen: NOW - 40 * DAY, lastSeen: NOW - DAY, level: 'hsk2', classroomCode: '1002', sentencesBuilt: [],
    ruta: { hsk2: { s: '1-40', p: { 1: 80, 2: 50 } } }, tareas: { [NEW[0]]: { h: NOW - 2 * DAY, s: NOW - 2 * DAY } }, streak: 6, dayDate: today(NOW - DAY), tz: 'UTC' },
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
  ok(r.json.items.length === 16 && !r.json.items.some((i) => ['latifa-3d', 'perro-de-adric', 'poni-de-aileen', 'panda-3d'].includes(i.id)), '16 characters on sale; the held ones are not even listed');
  ok(!/latifa-3d|perro-de-adric|poni-de-aileen|panda-3d|Ready Player|origen del modelo|licencia/.test(r.text), '… nothing of the held ones in the answer (not their names, not why they are held)');
  ok(!r.text.includes(kidA.studentCode), 'the student code never travels');
  ok(JSON.stringify(r.json.ways.map((w) => w.coins)) === JSON.stringify([2, 20, 50, 10, 5, 30]), '«¿Cómo gano monedas?»: +2 · +20 · +50 · +10 · +5 c/u · +30 (the approved amounts)');
  r = await home(A, kidA.studentCode);
  ok(r.json.ok && r.json.zoco && r.json.zoco.coins === 0 && Number(r.json.zoco.now) > 0, 'the home sends the coins pill to the kid\'s own session');
  const B = phone();
  const kidB = await enter(B, '1002', 'Zoco B ' + stamp);
  r = await get('/api/homework/home?accessCode=1002&studentCode=' + encodeURIComponent(kidB.studentCode), as(A));
  ok(r.status === 403 || (r.json && r.json.zoco === null), 'another kid\'s home from this phone: never their coins');

  section('a kid who did things before El Zoco: a one-time welcome grant, nothing twice');
  const P = phone();
  const kidP = await enter(P, '1002', null, 'PRE7');
  ok(kidP.ok, 'the kid logs in with their class code and code');
  r = await home(P, 'PRE7');
  const welcome = 40 + 10 + 25;
  ok(r.json.zoco && r.json.zoco.coins === welcome && r.json.zoco.news.some((n) => n.why === 'welcome' && n.n === welcome), 'the home: the welcome grant (' + welcome + ') and its news for the «+N monedas» moment');
  r = await seals(P, 'hsk2', [41], []);
  ok(r.json.coins && r.json.coins.got === 2 + 30 && r.json.coins.items.some((i) => i.why === 'streak'), 'a new word today: +2, and the 7th day in a row: +30 (' + JSON.stringify(r.json.coins && r.json.coins.items) + ')');
  const r1 = await seals(P, 'hsk2', [], range(1, 40));
  r = await seals(P, 'hsk2', range(1, 40), []);
  ok(r1.status === 200 && !r1.json.coins && r.status === 200 && !r.json.coins, 'the old words unmarked and marked again: no coins');
  r = await tareas(P, { unsent: [NEW[0]] });
  ok(r.status === 200 && !r.json.coins, 'the homework sent before: «Deshacer» takes nothing (it never paid)');
  r = await tareas(P, { sent: [NEW[0]] });
  ok(r.status === 200 && !r.json.coins, '… marked again: nothing');

  section('the steps pay in their own endpoints, once');
  r = await seals(A, 'hsk2', [1, 2, 3], []);
  ok(r.json.coins && r.json.coins.got === 6 && r.json.coins.c === 6, 'La Base: three words, +6');
  ok(!(await seals(A, 'hsk2', [], [1, 2, 3])).json.coins && !(await seals(A, 'hsk2', [1, 2, 3], [])).json.coins, 'unmark + mark the same words: nothing');
  r = await seals(A, 'hsk2', range(4, 60), []);
  ok(r.json.coins && r.json.coins.got === Zoco.CAP.seal - 6, 'many words at once: up to the day\'s cap (' + Zoco.CAP.seal + ')');
  r = await shop(A);
  ok(r.json.coins === Zoco.CAP.seal && r.json.waiting === (57 * 2) - (Zoco.CAP.seal - 6), 'the rest waits for tomorrow (' + r.json.waiting + ')');
  r = await tareas(A, { sent: [NEW[1]] });
  ok(r.json.coins && r.json.coins.got === 50 && r.json.coins.c === Zoco.CAP.seal + 50, '«¡Ya la mandé!»: +50');
  ok(!(await tareas(A, { sent: [NEW[1]] })).json.coins, 'the same mark again: nothing');
  r = await tareas(A, { unsent: [NEW[1]] });
  ok(r.json.coins && r.json.coins.got === -50, '«Deshacer»: the +50 go back');
  r = await tareas(A, { sent: [NEW[1]] });
  ok(r.json.coins && r.json.coins.got === 50, 'marked again: +50');
  r = await tareas(A, { sent: [OLD[0]] });
  ok(r.status === 200 && !r.json.coins, 'another level\'s homework: no coins');
  ok((await shop(A)).json.coins === Zoco.CAP.seal + 50, 'A has ' + (Zoco.CAP.seal + 50));
  // a code in the body never moves coins to someone else
  r = await tareas(A, { code: kidB.studentCode, sent: [NEW[2]] });
  ok(r.json.coins && r.json.coins.got === 50 && (await shop(B)).json.coins === 0, 'a classmate\'s code in the body: the coins go to the logged-in kid, the classmate earns nothing');
  const coinsA = (await shop(A)).json.coins;

  section('El Entrenamiento: +20 the first time a world reaches its goal');
  const T = phone();
  const kidT = await enter(T, '1001', 'Zoco T ' + stamp);
  ok(kidT.ok && kidT.level === 'hsk1', 'an HSK 1 kid (Pinyin básico is open from the start)');
  let pl = await play(T, 'hsk1', 'pinyin', 4);
  ok(pl.fin.ok && pl.fin.pct < 70 && !pl.fin.coins, 'a round below the goal: no coins (' + pl.fin.pct + ' %)');
  pl = await play(T, 'hsk1', 'pinyin', 99);
  ok(pl.fin.ok && pl.fin.pct >= 70 && pl.fin.coins && pl.fin.coins.got === 20, 'a round at the goal: +20 (' + pl.fin.pct + ' %)');
  const again = await post('/api/ruta/train/finish', { round: pl.round }, as(T));
  ok(again.json.ok && !again.json.coins, 'the same round finished again: nothing');
  pl = await play(T, 'hsk1', 'pinyin', 99);
  ok(pl.fin.ok && !pl.fin.coins, 'the world played again at its goal: nothing (first time only)');

  section('the shop: strangers, other kids, other sites, too few coins');
  r = await buy(B, 'dralingo-sheikh');
  ok(r.status === 402 && r.json.why === 'coins' && (await shop(B)).json.coins === 0, 'too few coins: 402, nothing bought');
  ok((await buy(A, 'dralingo-sheikh', { 'Sec-Fetch-Site': 'cross-site' })).status === 403, 'a request from another site: 403');
  ok((await buy(A, 'dralingo-sheikh', { Origin: 'https://evil.example' })).status === 403, 'another Origin: 403');
  ok((await post('/api/zoco/buy', { id: 'dralingo-sheikh', who: 'aaaaaaaaaaaa' }, as(A))).status === 409, 'a sibling\'s mirror (another account\'s who): 409');
  for (const id of ['latifa-3d', 'perro-de-adric', 'poni-de-aileen', 'panda-3d', 'bebe-dralingo', '__proto__', 'hamdan']) {
    r = await buy(A, id);
    ok(r.status === 404 && (await shop(A)).json.coins === coinsA, 'not on sale, refused: ' + id);
  }
  r = await post('/api/zoco/buy', { id: 'dralingo-sheikh', code: kidB.studentCode }, as(A));
  ok(r.status === 200 && r.json.ok && r.json.coins === coinsA - 150 && r.json.own.includes('dralingo-sheikh'), 'A buys Dralingo Sheikh (150): their own purse, a code in the body ignored');
  ok((await shop(B)).json.own.length === 0 && (await shop(B)).json.coins === 0, '… B owns nothing and paid nothing');
  ok((await buy(A, 'dralingo-sheikh')).status === 409, 'buying it again: 409');

  section('a skin as the avatar: only when owned');
  ok((await equip(B, 'dralingo-sheikh')).status === 403, 'B equips A\'s skin: refused');
  r = await post('/api/homework/avatar', { accessCode: '1002', studentCode: kidB.studentCode, avatar: 'dralingo-sheikh' }, as(B));
  ok(r.status === 400, '… nor through Mi perfil\'s old avatar endpoint');
  ok((await equip(A, 'dralingo-fuego-azul')).status === 403, 'A equips a skin not bought: refused');
  ok((await equip(A, 'latifa-3d')).status === 403, '… a held one: refused');
  r = await equip(A, 'dralingo-sheikh');
  ok(r.status === 200 && r.json.ok, 'A equips the skin they bought');
  ok((await shop(A)).json.equipped === 'dralingo-sheikh', '… it is their avatar now');
  ok((await equip(A, 'dralingo-sheikh', { 'Sec-Fetch-Site': 'cross-site' })).status === 403, 'equip from another site: 403');
  r = await equip(B, 'hamdan');
  ok(r.status === 200, 'the free saga avatars stay free');

  section('the purchase is atomic (two taps at once never buy twice or go below 0)');
  const C = phone();
  const kidC = await enter(C, '1002', 'Zoco C ' + stamp);
  await tareas(C, { sent: NEW.slice(0, 3) });
  r = await shop(C);
  const cC = r.json.coins;
  const both = await Promise.all([buy(C, 'dralingo-clasico'), buy(C, 'dralingo-clasico'), buy(C, 'dralingo-sheikh-roja')]);
  const okN = both.filter((x) => x.status === 200).length;
  const after = (await shop(C)).json;
  ok(after.coins >= 0 && after.coins === cC - 150 * okN && after.own.filter((x) => x === 'dralingo-clasico').length <= 1, 'three buys at once with ' + cC + ' coins: ' + okN + ' bought, ' + after.coins + ' left, never twice');

  section('a class PIN game: a skin in the room, +10 played for real, +5 a bonus star');
  const res = await pinGame([
    { ph: A, name: 'Ana ' + stamp, code: kidA.studentCode, accessCode: '1002', avatar: '🐉', answers: 4 },
    { ph: B, name: 'Beto ' + stamp, code: kidB.studentCode, accessCode: '1002', avatar: 'dralingo-sheikh', answers: 4, swapTry: 'dralingo-sheikh' },
    { ph: C, name: 'Caro ' + stamp, code: kidC.studentCode, accessCode: '1002', avatar: 'panda-3dX', answers: 1 },
    { ph: phone(), name: 'Dani ' + stamp, code: kidA.studentCode, accessCode: '', avatar: 'dralingo-sheikh', answers: 4 },
  ]);
  const [mA, mB, mC, mD] = res.out;
  ok(mA.join && mA.join.ok && mA.join.avatar === 'dralingo-sheikh' && mA.join.skins.includes('dralingo-sheikh'), 'A joins: the room plays A\'s skin (the account\'s skin wins over the phone\'s pick) and tells the phone which skins A owns');
  ok(mB.join && mB.join.ok && mB.join.avatar === '🐉' && mB.join.skins.length === 0, 'B sends a skin B does not own: the room plays its base character (🐉)');
  ok(mD.join && mD.join.ok && mD.join.guest === true && mD.join.avatar === '🐉', 'a stranger typing A\'s code with A\'s skin: a guest, never A\'s skin');
  const roster = (st) => Object.values((st && st.players) || {});
  ok(roster(res.st0).some((p) => p.avatar === 'dralingo-sheikh' && /^Ana /.test(p.name)), 'the projector\'s player list carries A\'s skin');
  ok(!roster(res.st1).some((p) => /^Beto /.test(p.name) && p.avatar === 'dralingo-sheikh'), 'the lobby swap to a skin not owned: nothing changes');
  const meA = mA.end && mA.end.me;
  ok(meA && meA.skin === 'dralingo-sheikh', 'the ending: A\'s card is drawn with A\'s skin');
  const hostRows = mA.end && mA.end.fin ? [].concat(mA.end.fin.crews.red || [], mA.end.fin.crews.gold || []) : [];
  ok(hostRows.some((x) => x.skin === 'dralingo-sheikh'), '… and the ceremony\'s crews too');
  const starsA = meA && Array.isArray(meA.stars) ? meA.stars.length : 0;
  ok(mA.coins && mA.coins.got === 10 + 5 * Math.min(starsA, Zoco.CAP.star), 'A played for real: +10 and +5 per bonus star (' + starsA + ' stars → ' + (mA.coins && mA.coins.got) + ')');
  ok(mC.coins === null, 'C answered once: not played for real, no coins');
  ok(mC.join && mC.join.avatar === '🐼', 'a skin smuggled through the 8-character cut («panda-3dX» → «panda-3d», held): its emoji, never the skin');
  ok(mD.coins === null && (await shop(A)).json.coins === coinsA - 150 + (mA.coins ? mA.coins.got : 0), 'the stranger\'s join paid nothing to A');
  const cA0 = (await shop(A)).json.coins, cC0 = (await shop(C)).json.coins;
  const hj = await hijackGame({ ph: A, code: kidA.studentCode }, C, kidC.studentCode);
  ok(hj.jb && hj.jb.ok && hj.jb.rejoined === true, 'C types the name of A\'s dropped slot and takes it (as rooms always did)');
  ok(hj.coins === null && (await shop(C)).json.coins === cC0 && (await shop(A)).json.coins === cA0, '… but that slot\'s game pays nobody: not C, not A');

  section('nothing in the record that the phone could have written');
  await sleep(1500);
  const recs = JSON.parse(fs.readFileSync(path.join(DATA, 'student-records.json'), 'utf8'));
  const za = recs[kidA.studentCode] && recs[kidA.studentCode].zoco;
  ok(za && za.v === 1 && Array.isArray(za.own) && za.own.length === 1 && JSON.stringify(za).length < 3000, 'A\'s purse on their record (' + JSON.stringify(za || {}).length + ' characters)');
  ok(recs[kidA.studentCode].avatar === 'dralingo-sheikh', 'A\'s avatar: the skin');
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
