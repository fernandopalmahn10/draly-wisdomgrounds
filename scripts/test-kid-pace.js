#!/usr/bin/env node
// test-kid-pace.js — «Each kid's own progress decides this week's homework» (his final pick 2026-10-21, «Automatic by
// each kid», the same day the class's pace set in /maestro was built and removed: no teacher setting at all). A kid's
// current experience = the first experience whose words they have not all marked (the last one once every word is
// marked); homework up to it is DUE, later ones stay visible and play but are never counted. Its OWN server (port 4530,
// never 3000), a temporary data folder with MADE-UP teachers, class codes and kids (generated here, never printed),
// never data/, never the live site.
//   1 · the plan alone (public/js/papas-plan.js) with all 8 experiences holding homework: a new kid → experience 1;
//       the words of 1-2 all marked → experience 3, due up to 3; every word marked → the last; later homework never
//       counted (badges, reminder, Papás); Papás' «Lo más importante»; paceOf's edges; an old `cur` is ignored
//   2 · the pages: /maestro has no class-pace card any more; La Ruta Dorada reads the kid's own seals (a teacher's
//       preview: experience 1); the new «¡Vas adelantado!» line and its English
//   3 · the server: /api/admin/class-pace answers 404 (GET and POST); no `cur` in /api/ruta-dorada, the home or the
//       insights; the server's plan (the home and Papás) = the page's plan, its pace from the kid's own seals
//   node scripts/test-kid-pace.js        (--port 4530 · --keep to leave the server running)
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
const PORT = Number(opt('port', 4530));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const Plan = require('../public/js/papas-plan.js');

// ── 1 · the plan alone: 8 experiences of 10 words, 2 homeworks each (rounds 1-2) ─────────────────────────────────────
const W = (n, best, open) => ({ n, name: 'Mundo ' + n, pic: null, first: (n - 1) * 10 + 1, count: 10, best: best == null ? null : best, open: !!open });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// newest first, like the server's catalog order (experience desc, round desc)
const HW8 = (sent) => range(1, 8).reverse().flatMap((n) => [2, 1].map((r) => { const id = 'x-e0' + n + '-r' + r; return { id, exp: n, round: r, title: 'Tarea ' + n + '.' + r, sent: !!(sent && sent(n, r)) }; }));
const raw = (o) => Object.assign({ pct: 70, words: 80, seals: [], worlds: range(1, 8).map((n) => W(n)), hws: HW8(), sim: null }, o);
// js/papas-plan.js + js/papas.js in a sandbox (Papás' words)
function pageWords() {
  const ctx = { console };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('public/js/papas-plan.js'), ctx, { filename: 'papas-plan.js' });
  vm.runInContext(read('public/js/papas.js'), ctx, { filename: 'papas.js' });
  return ctx.DralyPapas.texts;
}
function planTests() {
  section('the plan: a new kid (no word marked) is on experience 1');
  let p = Plan.plan(raw({}));
  let t = Plan.today(p);
  ok(p.pace === 1 && p.tareas.of === 2 && p.tareas.later === 14 && p.tareas.sent === 0 && same(p.tareas.week, { exp: 1, of: 2, left: 2 }),
    'due = experience 1\'s 2 homeworks, «this week» = experience 1; the 14 of experiences 2-8 are later, never counted (' + JSON.stringify(p.tareas) + ')');
  ok(p.focus.kind === 'tarea' && p.focus.exp === 1 && p.focus.id === 'x-e01-r2', 'Papás «Lo más importante»: experience 1\'s newest homework, never experience 8\'s');
  ok(t.kind === 'words' && t.exp === 1 && t.remind && t.remind.left === 2 && t.remind.text === 'Y tu tarea de esta semana: 2 por mandar.',
    'the kid: experience 1, its words; the reminder counts the 2 due only («' + (t.remind && t.remind.text) + '»)');
  ok(p.hws.every((h) => h.due === (h.exp <= 1)) && p.exps.every((e) => e.due === (e.n <= 1)), 'each homework and each experience knows whether it is due');
  ok(Plan.plan(raw({ cur: 7 })).pace === 1 && Plan.plan(raw({ cur: 7 })).tareas.of === 2, 'an old class pace (`cur`, the morning of 2026-10-21) is never read');

  section('the plan: the words of experiences 1-2 all marked → experience 3, due up to 3');
  p = Plan.plan(raw({ seals: range(1, 20) }));
  t = Plan.today(p);
  ok(p.pace === 3 && p.tareas.of === 6 && p.tareas.later === 10 && same(p.tareas.week, { exp: 3, of: 2, left: 2 }),
    'due = the 6 homeworks of experiences 1-3, «this week» = experience 3, 10 later (' + JSON.stringify(p.tareas) + ')');
  ok(p.focus.kind === 'tarea' && p.focus.exp === 3 && p.focus.id === 'x-e03-r2', 'Papás: the newest DUE homework (experience 3)');
  ok(p.hws.every((h) => h.due === (h.exp <= 3)), '… each homework of 1-3 due, 4-8 not');
  ok(p.current === 1 && t.kind === 'tarea' && t.exp === 1 && t.remind && t.remind.left === 4,
    'the kid: still on experience 1\'s ladder («Mandar mi tarea»), the 4 due of experiences 2-3 ride along as the reminder («' + (t.remind && t.remind.text) + '»)');
  p = Plan.plan(raw({ seals: range(1, 27) }));
  ok(p.pace === 3, 'experience 3 half marked (7 of 10): still experience 3');
  p = Plan.plan(raw({ seals: range(1, 10).concat(range(21, 30)) }));
  ok(p.pace === 2 && p.tareas.of === 4, 'experience 3 marked but 2 not: experience 2 (the FIRST with words left), due up to 2');

  section('the plan: every word marked → the last experience');
  p = Plan.plan(raw({ seals: range(1, 80) }));
  ok(p.pace === 8 && p.tareas.of === 16 && p.tareas.later === 0 && p.tareas.week && p.tareas.week.exp === 8, 'all 80 words marked: experience 8, every homework due');

  section('the plan: later homework is never counted');
  const upTo3 = (n) => n <= 3;
  p = Plan.plan(raw({ seals: range(1, 20), hws: HW8(upTo3) }));
  t = Plan.today(p);
  ok(p.tareas.of === 6 && p.tareas.sent === 6 && p.tareas.later === 10 && same(p.tareas.week, { exp: 3, of: 2, left: 0 }), 'all 6 due sent: «Al día» (week 3, 0 left), 10 later not missing');
  ok(p.focus.kind !== 'tarea' && !t.remind, '… Papás moves on, the kid gets no reminder (later homework never «por mandar»)');
  p = Plan.plan(raw({ seals: range(1, 20), hws: HW8((n) => n <= 3 || n === 6) }));
  ok(p.tareas.sent === 6 && p.tareas.ahead === 2, 'homework sent ahead (experience 6) counts as ahead, never as due');
  p = Plan.plan(raw({ seals: range(1, 10), worlds: range(1, 8).map((n) => W(n, n === 1 ? 90 : null)), hws: HW8((n) => n === 1) }));
  t = Plan.today(p);
  ok(p.pace === 2 && p.current === 2 && t.kind === 'words' && t.exp === 2 && t.remind && t.remind.exp === 2 && t.remind.left === 2 && p.focus.kind === 'tarea' && p.focus.exp === 2,
    'experience 1 complete: on to experience 2, its words; its homework is due now (the reminder, Papás asks for it), 3-8 still later');

  section('Papás: «Lo más importante» on the kid\'s experience');
  const texts = pageWords();
  const tx = texts({ ruta: raw({ seals: range(1, 20) }) });
  ok(tx && tx.focus && /Experiencia 3/.test(tx.focus.text) && tx.focus.btn === 'Ver la tarea', 'the kid on experience 3: «' + (tx && tx.focus && tx.focus.text) + '» → «Ver la tarea»');
  const tx1 = texts({ ruta: raw({}) });
  ok(tx1 && tx1.focus && /Experiencia 1/.test(tx1.focus.text), 'a new kid: experience 1\'s homework («' + (tx1 && tx1.focus && tx1.focus.text) + '»)');

  section('paceOf: the one rule');
  ok(Plan.paceOf([]) === null && Plan.paceOf(null) === null, 'no experiences: no pace (every homework due)');
  ok(Plan.paceOf([{ n: 2, count: 5, sealed: 5 }, { n: 1, count: 5, sealed: 0 }]) === 1, 'read in the curriculum\'s order, whatever the list\'s order');
  ok(Plan.paceOf([{ n: 1, count: 0, sealed: 0 }, { n: 2, count: 5, sealed: 1 }]) === 2, 'an experience with no words is never the pace');
  ok(Plan.paceOf([{ n: 1, count: 5, sealed: 5 }, { n: 2, count: 5, sealed: 9 }]) === 2, 'all marked: the last one');
  ok(Plan.plan(raw({ worlds: [], hws: HW8() })).pace === null && Plan.plan(raw({ worlds: [], hws: HW8() })).tareas.of === 16, 'a level with no experiences: every homework due, no week named');
}

// ── 2 · the pages ────────────────────────────────────────────────────────────────────────────────────────────────
function english() {
  const shown = [];
  const el = () => ({ style: {}, setAttribute() {}, getAttribute() { return null; }, addEventListener() {} });
  const ctx = {
    console, MutationObserver: function () { this.observe = () => {}; },
    NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 },
    localStorage: { getItem: (k) => (k === 'hw_lang' ? 'en' : null), setItem() {} },
    location: { reload() {} },
    document: { readyState: 'complete', title: '', documentElement: {}, body: el(), createElement: el, createTreeWalker: () => ({ nextNode: () => null }), addEventListener() {}, getElementById: () => null },
  };
  ctx.document.body.appendChild = () => {};
  ctx.window = ctx;
  ctx.alert = (m) => { shown.push(m); };
  ctx.confirm = (m) => { shown.push(m); return true; };
  vm.createContext(ctx);
  vm.runInContext(read('public/js/hw-i18n.js'), ctx, { filename: 'hw-i18n.js' });
  return (s) => { shown.length = 0; ctx.window.alert(s); return shown[0]; };
}
function pageTests() {
  section('the pages');
  const mjs = read('public/js/maestro.js'), mhtml = read('public/maestro.html'), css = read('public/css/teacher-dashboard.css');
  ok(!/m-pace|class-pace|paceMaybe|Experiencia actual/.test(mjs + mhtml + css), '/maestro: no class-pace card, call or style left');
  const rjs = read('public/js/ruta.js');
  ok(/Plan\.paceOf\(pr\.worlds\)/.test(rjs) && /ctx\.ruta\.teacher\) return firstExpOf\(m\)/.test(rjs) && /dueOf\(ctx, m, hws\)/.test(rjs) && !/paceOf\(m\)/.test(rjs),
    'La Ruta Dorada: the kid\'s pace from their own seals (js/papas-plan.js paceOf), a teacher\'s preview on experience 1');
  ok(/Esta semana/.test(rjs) && /Más adelante/.test(rjs) && !/La mandás cuando tu clase llegue/.test(rjs + read('public/js/mi-dralingo.js')), '«Esta semana» / «Más adelante» stay; «¡Vas adelantado!» no longer says «when your class gets there»');
  ok(/cur = Plan \? Plan\.plan\(rr\)\.pace : null/.test(read('public/js/mi-dralingo.js')), 'the kid\'s home hands its folders the same plan\'s pace');
  const en = english();
  const missing = [];
  ['«¡Vas adelantado! Ya podés escuchar el audio. La mandás cuando llegues a esta experiencia.»', 'Esta semana', 'Más adelante'].forEach((s) => {
    const e = en(s);
    if (!e || e === s || /[áéíóúñ¿¡]/i.test(e)) missing.push(s);
    else if (en(e) !== e) missing.push(s + ' (its English is not settled)');
  });
  ok(!missing.length, 'the new line has its English' + (missing.length ? ': missing ' + missing.map((x) => '«' + x + '»').join(', ') : ''));
}

// ── 3 · the server, made-up teachers and kids ───────────────────────────────────────────────────────────────────
const CAT = JSON.parse(read('public/assets/audios/catalog.json'));
const NEWHW = CAT.homeworks.filter((h) => h.level === 'newhsk1').sort((a, b) => (b.exp - a.exp) || (b.round - a.round));
// New HSK 1's La Base worlds, from the catalog where they live (the same counting as core/ruta-progress.js)
const NBASE = (() => {
  const b = (CAT.bases || []).find((x) => x && x.id === 'newhsk1-base');
  let next = 1;
  return (b ? b.worlds : []).map((w) => { const first = Number(w.first) || next; const count = Number(w.count) || 0; next = first + count; return { n: Number(w.n), first, count }; }).filter((w) => w.count > 0);
})();
const TWO = NBASE.length >= 3 ? NBASE[1].first + NBASE[1].count - 1 : 0;   // the last word of experience 2
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-kidpace-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const CODE_A = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const NOW = Date.now(), DAY = 86400e3;
const CLS = new Set();
while (CLS.size < 3) { const c = String(2101 + crypto.randomInt(7899)); if (c !== String(PORT)) CLS.add(c); }
const [S_NEW, A_NEW, A_OLD] = [...CLS];
const teacher = (code, name, codes, levels, sup, extra) => Object.assign({ teacherId: code, uid: 'u' + rnd(6), codeGen: 0, displayName: name, email: null, country: 'MX',
  accessCodes: codes, codeLevels: levels, isSuperAdmin: !!sup, createdAt: NOW - 90 * DAY, lastSeen: NOW - DAY }, extra || {});
// Ana's record still carries a class pace saved the morning of 2026-10-21 (`codeExps`): kept on the disk, never read
fs.writeFileSync(path.join(DATA, 'teachers.json'), JSON.stringify({
  [SEED]: teacher(SEED, 'Super Prueba', [S_NEW], { [S_NEW]: 'hsk2' }, true),
  [CODE_A]: teacher(CODE_A, 'Ana Prueba', [A_NEW, A_OLD], { [A_NEW]: 'hsk2', [A_OLD]: 'hsk1' }, false, { codeExps: { [A_NEW]: 6 } }),
}));
fs.writeFileSync(path.join(DATA, 'teachers-meta.json'), JSON.stringify({ superAdminSeenAt: NOW - 90 * DAY, retired: [], retiredLoose: [], retiredClass: [], oldSeedsDone: NOW - 90 * DAY }));
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 30 * DAY }));
const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const used = new Set();
const madeUpCode = () => { let c; do { c = Array.from({ length: 5 }, () => AB[crypto.randomInt(AB.length)]).join('') + (2 + crypto.randomInt(8)); } while (used.has(c)); used.add(c); return c; };
const KIDS = {
  KN: { level: 'hsk2', cls: A_NEW, name: 'Sofía Prueba' },                                     // new: no word marked
  K2: { level: 'hsk2', cls: A_NEW, name: 'Mateo Prueba', ruta: { s: '1-' + TWO, at: NOW - DAY } },   // the words of 1-2 marked
  KA: { level: 'hsk2', cls: A_NEW, name: 'Lucía Prueba', ruta: { s: '1-' + ((NBASE[NBASE.length - 1] || { first: 1, count: 0 }).first + (NBASE[NBASE.length - 1] || { count: 0 }).count - 1), at: NOW - DAY } },   // every word
};
const SEEDED = {};
Object.values(KIDS).forEach((v) => {
  v.code = madeUpCode();
  SEEDED[v.code] = Object.assign({ code: v.code, displayName: v.name, avatar: 'aileen', classroomCode: v.cls, classroomId: null, firstSeen: NOW - 40 * DAY, lastSeen: NOW - DAY,
    sentencesBuilt: [], level: v.level, levelAccess: { [v.level]: { via: 'teacher', at: NOW - DAY } } }, v.ruta ? { ruta: { [v.level]: v.ruta } } : {});
});
fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify(SEEDED));

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
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers) });
const T = (code) => ({ headers: { 'X-Admin-Pw': encodeURIComponent(code), 'CF-Connecting-IP': '203.0.113.11', Origin: 'http://localhost:' + PORT, 'Sec-Fetch-Site': 'same-origin' } });
const enter = async (ph, kid) => (await post('/api/homework/enter', { accessCode: kid.cls, studentCode: kid.code }, as(ph))).json || {};

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
  console.error('the server did not start:\n' + [SEED, CODE_A, LEGACY].reduce((s, c) => s.split(c).join('<code>'), allLog.slice(-2000)));
  srv.kill();
  process.exit(2);
}
async function stopServer() {
  if (!srv) return;
  const p = new Promise((r) => srv.once('exit', r));
  srv.kill();
  await p;
  srv = null;
  await sleep(300);
}

async function serverTests() {
  section('the server: no class pace any more');
  const g = await get('/api/admin/class-pace', T(CODE_A));
  const pp = await post('/api/admin/class-pace', { code: A_NEW, n: 2 }, T(CODE_A));
  ok(g.status === 404 && pp.status === 404, 'GET and POST /api/admin/class-pace answer 404 (' + g.status + ', ' + pp.status + ')');
  const file = JSON.parse(fs.readFileSync(path.join(DATA, 'teachers.json'), 'utf8'));
  ok(file[CODE_A] && file[CODE_A].codeExps && file[CODE_A].codeExps[A_NEW] === 6, 'a pace saved that morning stays on the teacher\'s record, untouched (never deleted)');
  const ta = await get('/api/ruta-dorada', T(CODE_A));
  const mods = (ta.json && ta.json.modules) || [];
  ok(ta.status === 200 && mods.length > 0 && mods.every((m) => !('cur' in m)), 'La Ruta Dorada\'s modules carry no `cur` (a teacher\'s preview counts from experience 1 on the page)');

  section('the server: each kid\'s own pace (the home and Papás read the same plan)');
  ok(NBASE.length >= 3 && TWO > 0, 'New HSK 1\'s La Base has its worlds in the catalog (' + NBASE.length + ')');
  const ph = { KN: phone(), K2: phone(), KA: phone() };
  for (const k of Object.keys(KIDS)) await enter(ph[k], KIDS[k]);
  const homeOf = async (k) => (await get('/api/homework/home?accessCode=' + KIDS[k].cls + '&studentCode=' + KIDS[k].code, as(ph[k]))).json || {};
  const insOf = async (k) => (await get('/api/homework/insights/' + KIDS[k].code + '?accessCode=' + KIDS[k].cls, as(ph[k]))).json || {};
  const expect = { KN: 1, K2: 3, KA: NBASE.length ? NBASE[NBASE.length - 1].n : null };
  for (const k of Object.keys(KIDS)) {
    const home = await homeOf(k), ins = await insOf(k);
    const p = home.ruta && home.ruta.plan;
    const n = expect[k];
    const due = NEWHW.filter((h) => h.exp <= n), later = NEWHW.filter((h) => h.exp > n);
    ok(!!p && p.pace === n && same(p, Plan.plan(home.ruta)) && !('cur' in home.ruta), k + ': the home\'s plan = the page\'s plan, on experience ' + n + ' (its own words), no `cur`');
    ok(!!p && p.tareas.of === due.length && p.tareas.later === later.length && p.hws.every((h) => h.due === (h.exp <= n)),
      k + ': due = the catalog\'s homework up to experience ' + n + ' (' + due.length + '), later = ' + later.length + ', never counted');
    const ip = ins.ruta && ins.ruta.plan;
    ok(!!ip && ip.pace === n && (due.length ? ip.focus.kind === 'tarea' && ip.focus.id === due[0].id : ip.focus.kind !== 'tarea'),
      k + ': Papás «Lo más importante» = the newest DUE homework (' + (due[0] ? due[0].id : 'none') + '), never a later one');
  }
  ok(!allLog.includes(CODE_A) && !allLog.includes(SEED) && !allLog.includes(LEGACY), 'no teacher code in the server log');
}

(async () => {
  let crashed = false;
  try { planTests(); pageTests(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  await startServer();
  try { await serverTests(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  else console.log('(server left running on port ' + PORT + ', data in a temp folder)');
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-kid-pace: ${failed} FAILED, ${passed} passed` : `test-kid-pace: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
