#!/usr/bin/env node
// test-papas.js — «Mi Dralingo» part 2 · Papás (2026-10-18), the parents' view of /homework. Its OWN server (port 4460,
// never 3000), a temporary data folder with MADE-UP kids at different stages (codes made up here, never printed), never
// data/, never the live site.
//   1 · the plan alone (public/js/papas-plan.js): the four numbers, an experience complete = every word marked + its
//       practice at the goal + its homework sent (or none yet), done / current / later, and «Lo más importante esta
//       semana» in his order: a homework to send (the newest not sent) → practice below the goal in the current
//       experience → words to mark → El Entrenamiento done: tell the teacher → «¡Va muy bien!»
//   2 · the server: /api/homework/insights carries `ruta` (seals, practice, homework sent, simulations, the plan) only
//       when the /homework session on that phone is this same kid: a classmate's insights (same class code), a phone
//       without a session, never get it; never the kid's code inside it; never cached
//   3 · the page's words (public/js/papas.js `texts`, in a sandbox) for each made-up kid, and their English
//       (public/js/hw-i18n.js, through its window.alert hook: every Papás phrase has an English line)
//   4 · the page: every old piece of Papás has its row (nothing lost), no hidden pills, no «Camino del idioma», no
//       pending tareas with «Hacerla ahora», no hanzi, never «Chinese», no code shown
//   node scripts/test-papas.js            (--port 4460 · --keep to leave the server running, --logins <file> writes
//                                           the made-up kids' logins there for the screenshots)
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
const PORT = Number(opt('port', 4460));
const KEEP = args.includes('--keep');
const LOGINS = opt('logins', '');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const HANZI = /[㐀-鿿]/;

const Plan = require('../public/js/papas-plan.js');

// ── 1 · the plan alone ──────────────────────────────────────────────────────────────────────────────────────────
// a made-up level: 4 experiences of 10 words (1-10, 11-20, …), homework in experiences 1 and 3
const W = (n, best, open) => ({ n, name: 'Mundo ' + n, pic: null, first: (n - 1) * 10 + 1, count: 10, best: best == null ? null : best, open: !!open });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const HW = (sent3, sent1) => [{ id: 'x-e03-r1', exp: 3, round: 1, title: 'Tres', sent: !!sent3 }, { id: 'x-e01-r1', exp: 1, round: 1, title: 'Uno', sent: !!sent1 }];
const raw = (o) => Object.assign({ pct: 70, words: 40, seals: [], worlds: [W(1), W(2), W(3), W(4)], hws: HW(false, false), sim: null }, o);
function planTests() {
  section('the plan: a new kid');
  let p = Plan.plan(raw({}));
  ok(p.sealed === 0 && p.words === 40 && p.complete === 0 && p.of === 4 && p.current === 1, 'nothing yet: 0 of 40 words, 0 of 4 experiences, it is on experience 1');
  ok(same(p.exps.map((e) => e.state), ['current', 'later', 'later', 'later']), '… experience 1 current, the rest later');
  ok(p.focus.kind === 'tarea' && p.focus.id === 'x-e03-r1' && p.focus.exp === 3 && p.focus.name === 'Mundo 3', '«Lo más importante»: the NEWEST homework not sent (experience 3), before anything else');
  ok(same(p.tareas, { of: 2, sent: 0, week: { exp: 3, of: 1, left: 1 } }), 'tareas: 0 of 2 sent, this week = the newest experience with homework, 1 left');
  ok(p.sim === null && p.trainDone === false, 'no simulation, El Entrenamiento not done');

  section('the plan: the order of «Lo más importante»');
  p = Plan.plan(raw({ hws: HW(false, true) }));
  ok(p.focus.kind === 'tarea' && p.focus.id === 'x-e03-r1', 'a homework waiting beats everything (experience 1 sent, 3 not)');
  p = Plan.plan(raw({ hws: HW(true, false) }));
  ok(p.focus.kind === 'tarea' && p.focus.id === 'x-e01-r1', '… the newest NOT SENT: experience 3 sent → experience 1\'s');
  p = Plan.plan(raw({ hws: HW(true, true), seals: range(1, 6) }));
  ok(p.focus.kind === 'words' && p.focus.exp === 1 && p.focus.left === 4, 'homework sent, practice not open yet (words missing): mark the words of the current experience, 4 left');
  p = Plan.plan(raw({ hws: HW(true, true), seals: range(1, 10) }));
  ok(p.focus.kind === 'practice' && p.focus.exp === 1 && p.focus.best === null && p.focus.goal === 70, 'every word marked, never practised: practise experience 1 (goal 70 %)');
  p = Plan.plan(raw({ hws: HW(true, true), seals: range(1, 10), worlds: [W(1, 55), W(2), W(3), W(4)] }));
  ok(p.focus.kind === 'practice' && p.focus.best === 55, '… practised below the goal: «va en 55 %»');
  p = Plan.plan(raw({ hws: HW(true, true), seals: range(1, 4), worlds: [W(1, 40, true), W(2), W(3), W(4)] }));
  ok(p.focus.kind === 'practice' && p.focus.exp === 1, 'a practice a teacher opened (words still missing) and below the goal: practice comes before words');
  p = Plan.plan(raw({ hws: HW(true, true), seals: range(1, 4), worlds: [W(1, 90, true), W(2), W(3), W(4)] }));
  ok(p.focus.kind === 'words' && p.focus.left === 6, '… at the goal already: then the words left');
  p = Plan.plan(raw({ hws: HW(true, true), seals: range(1, 10), worlds: [W(1, 70), W(2), W(3), W(4)] }));
  ok(p.exps[0].done && p.current === 2 && p.focus.kind === 'words' && p.focus.exp === 2, '70 % is the goal reached: experience 1 complete, experience 2 is next (its words)');
  const all = range(1, 40);
  const best = [W(1, 80), W(2, 90), W(3, 75), W(4, 100)];
  p = Plan.plan(raw({ hws: HW(true, true), seals: all, worlds: best }));
  ok(p.complete === 4 && p.current === null && p.trainDone && p.focus.kind === 'teacher', 'everything complete, no simulation yet: «Avísale a la profe»');
  ok(same(p.exps.map((e) => e.state), ['done', 'done', 'done', 'done']), '… every experience done');
  p = Plan.plan(raw({ hws: HW(true, true), seals: all, worlds: best, sim: { n: 2, percent: 48, passed: false, at: 1 } }));
  ok(p.focus.kind === 'teacher' && p.sim.percent === 48 && p.sim.passed === false, 'a simulation not passed yet: still «Avísale a la profe»');
  p = Plan.plan(raw({ hws: HW(true, true), seals: all, worlds: best, sim: { n: 2, percent: 84.6, passed: true, at: 1 } }));
  ok(p.focus.kind === 'fine' && p.focus.sim && p.focus.sim.percent === 85, 'a simulation passed: «¡Va muy bien!» with its % (rounded)');
  p = Plan.plan(raw({ worlds: [], hws: [], words: 0 }));
  ok(p.of === 0 && p.current === null && p.focus.kind === 'fine', 'a level with no experiences yet: a calm «¡Va muy bien!»');

  section('the plan: what makes an experience complete');
  p = Plan.plan(raw({ hws: HW(false, false), seals: range(1, 10), worlds: [W(1, 90), W(2), W(3), W(4)] }));
  ok(!p.exps[0].done && p.exps[0].hw.of === 1 && p.exps[0].hw.sent === 0, 'words + practice done but its homework not sent: not complete');
  p = Plan.plan(raw({ hws: HW(false, false), seals: range(11, 20), worlds: [W(1), W(2, 90), W(3), W(4)] }));
  ok(p.exps[1].done && p.exps[1].hw.of === 0 && p.complete === 1, 'an experience with no homework yet: words + practice are enough');
  ok(same(p.exps.map((e) => e.state), ['current', 'done', 'later', 'later']), '… done even after the current one (done / current / later)');
  p = Plan.plan(raw({ hws: HW(true, true), seals: range(1, 10), worlds: [W(1, 69), W(2), W(3), W(4)] }));
  ok(!p.exps[0].done, '69 % is below the goal');
  p = Plan.plan(raw({ pct: 80, hws: HW(true, true), seals: range(1, 10), worlds: [W(1, 75), W(2), W(3), W(4)] }));
  ok(!p.exps[0].done && p.focus.kind === 'practice' && p.focus.goal === 80, 'the goal follows the Dorado % his /maestro sets (80 here)');
  p = Plan.plan(raw({ seals: [0, -3, 5, 5, 41, 999, 'x', 2.5] }));
  ok(p.sealed === 1 && p.exps[0].sealed === 1, 'seals outside the level (0, negatives, past the base, not whole) never count, a repeat counts once');
  p = Plan.plan(raw({ seals: undefined, worlds: [Object.assign(W(1), { sealed: 7 }), W(2)] }));
  ok(p.sealed === 7 && p.words === 40, 'without a seal list, a world\'s own `sealed` count is used');
}

// ── 2 + 3 · the server and the page's words ──────────────────────────────────────────────────────────────────────
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'audios', 'catalog.json'), 'utf8'));
const hwOf = (folder) => CAT.homeworks.filter((h) => h.level === folder).sort((a, b) => (b.exp - a.exp) || (b.round - a.round));
const NEWHW = hwOf('newhsk1');
const OLDHW = hwOf('hsk1');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-papas-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const used = new Set();
const madeUpCode = () => { let c; do { c = Array.from({ length: 5 }, () => AB[crypto.randomInt(AB.length)]).join('') + (2 + crypto.randomInt(8)); } while (used.has(c)); used.add(c); return c; };
const NOW = Date.now(), DAY = 86400e3;
// the class codes the server seeds on an empty disk (core/teachers.js), by level; never printed
const CLASS = { hsk2: ['1', '0', '0', '2'].join(''), yct1: ['1', '0', '0', '3'].join(''), hsk1: ['1', '0', '0', '1'].join('') };
const allSent = (list) => Object.fromEntries(list.map((h) => [h.id, { h: NOW - DAY, s: NOW - DAY }]));
const KIDS = {
  NEWK: { level: 'hsk2', name: 'Sofía Prueba', avatar: 'aileen' },
  HALF: { level: 'hsk2', name: 'Mateo Prueba', avatar: 'adric', ruta: { s: '1-123', at: NOW - DAY, p: { 1: 92, 2: 74, 3: 55 } },
    tareas: { [NEWHW.find((h) => h.exp === 1).id]: { h: NOW - 2 * DAY, s: NOW - 2 * DAY }, [NEWHW.find((h) => h.exp === 3).id]: { h: NOW - DAY } } },
  PRAC: { level: 'hsk2', name: 'Lucía Prueba', avatar: 'camel', ruta: { s: '1-117', at: NOW - DAY, p: { 1: 92, 2: 74, 3: 55 } }, tareas: allSent(NEWHW) },
  WORD: { level: 'hsk2', name: 'Diego Prueba', avatar: 'oryx', ruta: { s: '1-40', at: NOW - DAY }, tareas: allSent(NEWHW) },
  DONE: { level: 'hsk2', name: 'Valentina Prueba', avatar: 'falcon', ruta: { s: '1-300', at: NOW - DAY, p: { 1: 80, 2: 85, 3: 90, 4: 75, 5: 70, 6: 95, 7: 88, 8: 100, pinyin: 40 } }, tareas: allSent(NEWHW) },
  GOLD: { level: 'hsk2', name: 'Martín Prueba', avatar: 'dralingo', ruta: { s: '1-300', at: NOW - DAY, p: { 1: 80, 2: 85, 3: 90, 4: 75, 5: 70, 6: 95, 7: 88, 8: 100 } }, tareas: allSent(NEWHW),
    hskResults: [{ simId: 'newhsk1-sim1', score: 120, total: 200, percent: 60, ts: NOW - 5 * DAY, answeredCount: 40, questions: 40, wrongQs: [] },
      { simId: 'newhsk1-sim2', score: 170, total: 200, percent: 85, ts: NOW - DAY, answeredCount: 40, questions: 40, wrongQs: [] }] },
  YCTK: { level: 'yct1', name: 'Emma Prueba', avatar: 'aileen', ruta: { s: '1-17', at: NOW - DAY, p: { 1: 80 } } },
  OLDK: { level: 'hsk1', name: 'Tomás Prueba', avatar: 'adric', tareas: { [OLDHW[OLDHW.length - 1].id]: { h: NOW - DAY, s: NOW - DAY } } },
  OTHR: { level: 'hsk2', name: 'Clara Prueba', avatar: 'oryx', ruta: { s: '1-50', at: NOW - DAY, p: { 1: 99 } } },
};
const SEEDED = {};
Object.entries(KIDS).forEach(([k, v]) => {
  v.code = madeUpCode();
  SEEDED[v.code] = { code: v.code, displayName: v.name, avatar: v.avatar, classroomCode: CLASS[v.level], classroomId: null, firstSeen: NOW - 40 * DAY,
    lastSeen: NOW - DAY, sentencesBuilt: [], level: v.level,
    ruta: v.ruta ? { [v.level]: v.ruta } : undefined, tareas: v.tareas, hskResults: v.hskResults };
});
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: true, doradoPct: 70, trainingLaunchAt: NOW - 30 * DAY }));
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
const enter = async (ph, kid) => (await post('/api/homework/enter', { accessCode: CLASS[kid.level], studentCode: kid.code }, as(ph))).json || {};
const insights = (ph, kid, code) => get('/api/homework/insights/' + encodeURIComponent((code || kid).code) + '?accessCode=' + encodeURIComponent(CLASS[kid.level]), as(ph));

// the page's words: public/js/papas-plan.js + public/js/papas.js in a sandbox (no page: only `texts`)
function pageWords() {
  const ctx = { console };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'js', 'papas-plan.js'), 'utf8'), ctx, { filename: 'papas-plan.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'js', 'papas.js'), 'utf8'), ctx, { filename: 'papas.js' });
  return ctx.DralyPapas.texts;
}
// their English: public/js/hw-i18n.js in EN mode, read through its window.alert hook (it translates what it shows)
function english() {
  const shown = [];
  const el = () => ({ style: {}, setAttribute() {}, getAttribute() { return null; }, addEventListener() {} });
  const ctx = {
    console, MutationObserver: function () { this.observe = () => {}; },
    NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 },
    localStorage: { getItem: (k) => (k === 'hw_lang' ? 'en' : null), setItem() {} },
    location: { reload() {} },
    document: { readyState: 'complete', title: '', documentElement: {}, body: el(), createElement: el, createTreeWalker: () => ({ nextNode: () => null }), addEventListener() {} },
  };
  ctx.document.body.appendChild = () => {};
  ctx.window = ctx;
  ctx.alert = (m) => { shown.push(m); };
  ctx.confirm = (m) => { shown.push(m); return true; };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'public', 'js', 'hw-i18n.js'), 'utf8'), ctx, { filename: 'hw-i18n.js' });
  return (s) => { shown.length = 0; ctx.window.alert(s); return shown[0]; };
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

async function serverTests() {
  const texts = pageWords();
  const en = english();
  const phones = {};
  section('the made-up kids log in at /homework');
  for (const [k, kid] of Object.entries(KIDS)) {
    phones[k] = phone();
    const e = await enter(phones[k], kid);
    ok(e.ok && e.studentCode === kid.code, k + ': logged in (' + kid.level + ')');
  }
  const R = {};
  for (const k of Object.keys(KIDS)) R[k] = await insights(phones[k], KIDS[k]);
  const r0 = R.HALF;
  ok(r0.status === 200 && r0.json && r0.json.ok && r0.json.ruta && /private/.test(r0.headers['cache-control'] || '') && /no-store/.test(r0.headers['cache-control'] || ''),
    'the insights carry `ruta` for the kid\'s own session, never cached');
  for (const k of Object.keys(KIDS)) {
    const ru = R[k].json && R[k].json.ruta;
    ok(!!ru && same(ru.plan, Plan.plan(ru)), k + ': the server\'s plan is the page\'s plan (the same file)');
    ok(!!ru && !JSON.stringify(ru).includes(KIDS[k].code) && !HANZI.test(JSON.stringify(ru)), k + ': no student code and no hanzi inside `ruta`');
  }

  section('the numbers and «Lo más importante» of each made-up kid');
  const P = (k) => R[k].json.ruta.plan;
  const T = (k) => texts(R[k].json);
  let p = P('NEWK');
  ok(p.sealed === 0 && p.words === 300 && p.complete === 0 && p.of === 8 && p.current === 1, 'new kid: 0 of 300 words, 0 of 8 experiences, on experience 1');
  ok(p.focus.kind === 'tarea' && p.focus.id === NEWHW[0].id && p.focus.exp === NEWHW[0].exp, 'new kid: send the newest homework (' + NEWHW[0].id + ')');
  ok(p.tareas.of === NEWHW.length && p.tareas.sent === 0 && p.tareas.week && p.tareas.week.left >= 1, '… 0 homework sent, «Falta» this week\'s');
  ok(p.sim === null, '… no simulation: «Aún no»');
  let t = T('NEWK');
  ok(/^Ayúdale a mandar la tarea de la Experiencia \d+, .+: graben juntos su video y mándenlo a la profe por WhatsApp\.$/.test(t.focus.text) && t.focus.btn === 'Ver la tarea' &&
    t.focus.href === '/audios/' + NEWHW[0].id, '… «' + t.focus.text + '» → «Ver la tarea» opens that homework');
  p = P('HALF');
  ok(p.sealed === 123 && p.complete === 2 && p.current === 3, 'halfway: 123 of 300 words, experiences 1-2 complete (words + practice + homework), on 3');
  ok(same(p.exps.map((e) => e.state), ['done', 'done', 'current', 'later', 'later', 'later', 'later', 'later']), '… the strip: done, done, current, later…');
  // (2026-10-19: «this week» = the NEWEST experience with homework in the catalog, which grows as storybooks arrive:
  // La Tienda made it experience 4. The kid's own experience 3 homework is only heard, so still 1 sent)
  const WEEK = NEWHW[0].exp;
  const WEEK_LEFT = NEWHW.filter((h) => h.exp === WEEK && !(KIDS.HALF.tareas[h.id] && KIDS.HALF.tareas[h.id].s)).length;
  ok(p.tareas.sent === 1 && p.tareas.week.exp === WEEK && p.tareas.week.left === WEEK_LEFT && p.focus.kind === 'tarea' && p.focus.exp === WEEK,
    '… 1 homework sent (heard is not sent), this week\'s homework waits: «Ayúdale a mandar la tarea de la Experiencia ' + WEEK + '»');
  t = T('HALF');
  ok(t.ruta && /^Va en la Experiencia 3, El Restaurante Chino\. Cuando termine las 8, la profe le hace El Simulacro Dorado en clase\.$/.test(t.ruta.say), '… «' + (t.ruta && t.ruta.say) + '»');
  const weekName = (p.exps.find((e) => e.n === WEEK) || {}).name || '?';
  ok(t.tips.length === 3 && t.tips[0].includes(weekName) && /video/.test(t.tips[2]), '… 3 tips for this week\'s experience ' + WEEK + ', ' + weekName + ' (its words, a question, the video)');
  p = P('PRAC');
  ok(p.focus.kind === 'practice' && p.focus.exp === 3 && p.focus.best === 55 && p.focus.goal === 70, 'homework all sent: practise experience 3, 55 % of 70 %');
  t = T('PRAC');
  ok(/hoy va en 55 %\.$/.test(t.focus.text) && t.focus.btn === 'Practicar ahora' && /^\/audios\/newhsk1\/entrenamiento\/[a-z]+$/.test(t.focus.href), '… «Practicar ahora» opens that world of El Entrenamiento');
  p = P('WORD');
  ok(p.focus.kind === 'words' && p.focus.exp === 1 && p.focus.left === 7 && p.sealed === 40, 'words to mark: experience 1, 7 left (40 of its 47 marked)');
  t = T('WORD');
  ok(t.focus.btn === 'Marcar palabras' && t.focus.href === '/audios/newhsk1-base#mundo-1' && /le faltan 7\.$/.test(t.focus.text), '… «Marcar palabras» opens that world of La Base');
  p = P('DONE');
  ok(p.complete === 8 && p.current === null && p.trainDone && p.focus.kind === 'teacher' && p.sealed === 300, 'all done, no simulation: «Avísale a la profe» (El Entrenamiento done)');
  t = T('DONE');
  ok(/^https:\/\/wa\.me\/\?text=/.test(t.focus.href) && /Valentina Prueba terminó El Entrenamiento de New HSK 1/.test(t.teacher), '… a WhatsApp message for the teacher, with the kid\'s name');
  ok(t.ruta && /^¡Terminó las 8 experiencias! Ahora la profe le hace El Simulacro Dorado en clase\.$/.test(t.ruta.say), '… «' + (t.ruta && t.ruta.say) + '»');
  p = P('GOLD');
  ok(p.sim && p.sim.n === 2 && p.sim.percent === 85 && p.sim.passed && p.focus.kind === 'fine', 'simulation passed in class: the LATEST one (85 %, ✓) and «¡Va muy bien!»');
  ok(R.GOLD.json.ruta.books.length === 2 && R.GOLD.json.ruta.books.every((b) => /^\/audios\/newhsk1\/libro\/\d$/.test(b.book)), '… each simulation taken has its golden book (its mistakes)');
  t = T('GOLD');
  ok(/^¡Va muy bien! Aprobó El Simulacro Dorado con 85 %\./.test(t.focus.text) && t.focus.calm && t.focus.btn === 'Ver su libro dorado' &&
    t.focus.href === '/audios/newhsk1/libro/2', '… «' + t.focus.text + '» → «Ver su libro dorado» of that simulation');
  p = P('YCTK');
  ok(p.of === 6 && p.words === 83 && p.sealed === 17 && p.complete === 1 && p.current === 2 && p.tareas.of === 0, 'YCT 1: 6 experiences, 17 of 83 words, experience 1 complete (no homework audio yet)');
  ok(p.focus.kind === 'words' && p.focus.exp === 2 && p.focus.left === 12, '… «Lo más importante»: the words of experience 2');
  p = P('OLDK');
  ok(p.of === 8 && p.words === 150 && p.tareas.of === OLDHW.length && p.tareas.sent === 1 && p.focus.kind === 'tarea' && p.focus.id === OLDHW[0].id, 'HSK 1: the newest homework not sent (one older one sent)');

  section('only the kid\'s own record');
  const other = await insights(phones.HALF, KIDS.OTHR);
  ok(other.status === 200 && other.json.ruta === null, 'a classmate\'s insights (same class code) from this kid\'s phone: no `ruta`');
  const bare = phone();
  const noSession = await insights(bare, KIDS.HALF);
  ok(noSession.status === 200 && noSession.json.ruta === null, 'a phone with no /homework session: no `ruta` (the page asks to come in again)');
  const t0 = texts(noSession.json);
  ok(t0.focus.reload && t0.focus.btn === 'Entrar de nuevo', '… the page says «Para ver su Ruta Dorada, vuelve a entrar con su código.»');
  // (since la entrada: the kid's own session proves the record, whatever class code the page sends; a phone without it
  // and with another class's code is refused, as before)
  ok((await get('/api/homework/insights/' + KIDS.HALF.code + '?accessCode=' + CLASS.yct1, as(bare))).status === 403, 'another class\'s code from a phone that is not the kid\'s: refused, as before');
  ok((await get('/api/homework/insights/' + KIDS.HALF.code + '?accessCode=0000', as(phones.HALF))).status === 401, 'a code that is no class code: refused, as before');
  const out = await post('/api/homework/logout', {}, as(phones.HALF));
  ok(out.status === 200 && (await insights(phones.HALF, KIDS.HALF)).json.ruta === null, '«Salir»: the same phone gets no `ruta` any more');

  section('every Papás phrase has its English (hw-i18n.js)');
  const missing = [];
  const check = (s) => { if (!s || !/[A-Za-zÀ-ÿ]/.test(s)) return; const e = en(s); if (!e || e === s || /[áéíóúñ¿¡]/i.test(e.replace(/«[^»]*»/g, ''))) missing.push(s); };
  for (const k of Object.keys(KIDS)) {
    const x = T(k);
    [x.focus.text, x.focus.btn].concat(x.tips).concat(x.ruta ? [x.ruta.of, x.ruta.say].concat(x.ruta.tiles) : []).forEach(check);
  }
  [t0.focus.text, t0.focus.btn].forEach(check);
  // the page's fixed words (homework.html's Papás block: text, sheet titles, labels)
  const html = fs.readFileSync(path.join(ROOT, 'public', 'homework.html'), 'utf8');
  const block = html.slice(html.indexOf('<div id="screen-parents"'), html.indexOf('<!-- SCREEN: ASSIGNMENT —', html.indexOf('<div id="screen-parents"')));
  const dec = (s) => s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const fixed = new Set();
  block.replace(/<!--[\s\S]*?-->/g, '').replace(/>([^<>]+)</g, (_, s) => { fixed.add(dec(s)); return _; });
  block.replace(/(?:data-title|aria-label)="([^"]+)"/g, (_, s) => { fixed.add(dec(s)); return _; });
  fixed.forEach(check);
  // the page's other words (js/papas.js), as the page builds them
  ['palabras que ya sabe', 'experiencias completas', 'mandadas', 'tareas por WhatsApp', 'Falta 1 de esta semana', 'Faltan 2 de esta semana', 'Al día', 'Pronto',
    'La profe las manda pronto', 'simulacro en clase', '¡Aprobado!', 'Para aprobar: 60 %', 'Aún no', 'La profe lo hace al final', 'de 300', '3 de 8', 'Copiar mensaje',
    '¡Mensaje copiado!', 'Ver La Ruta Dorada', 'Ver su libro dorado', 'Sus logros', 'Sus palabras', 'Lo que escribió en sus tareas', 'Escribió:', 'Correcto:', 'de 300 palabras marcadas',
    'de 8 tareas aprobadas', 'historias leídas', 'Todavía no tiene logros. Cuando apruebe su primera tarea, aparece aquí.', 'Las palabras de su nivel llegan pronto.',
    'EXP3 · El Restaurante Chino', '20 palabras', 'Escuchar ni hao', 'Entendió la historia «La fiesta»', 'Sacó 80/100 en el examen de lectura',
    'Identificó eventos y personajes de la historia', 'Pídele que te cuente la historia de «La fiesta» con sus propias palabras.',
    'Cuando apruebe una tarea o lea una historia, aquí aparecen preguntas para hacerle.', 'Aprobó. Pídele que te cuente qué le gustó del examen.',
    'Aún no aprueba este examen. Lo repasan en clase y en El Entrenamiento.', 'Aún no hizo ningún simulacro. La profe lo hace en clase, al final de La Ruta Dorada.',
    'Sus errores, en el libro dorado', 'Simulacro 2', 'Ver el libro dorado', 'Sin errores', '1 error para repasar', '3 errores para repasar',
    'Pregúntale: «¿Qué pasó en la historia de La fiesta? Cuéntamela en Chino Mandarín o en español.»',
    'Aún no lee historias en clase. Cuando lea la primera, aquí ves su nota.', 'Chino Mandarín · New HSK 1',
    'YCT 1 es el primer nivel del examen oficial de Chino Mandarín para niños. Toca 🔊 para oír cada palabra y pídele que la repita.',
    'New HSK 1 es el primer nivel del nuevo examen oficial de Chino Mandarín. Toca 🔊 para oír cada palabra y pídele que la repita.',
    'HSK 1 es el primer nivel del examen oficial de Chino Mandarín. Toca 🔊 para oír cada palabra y pídele que la repita.'].forEach(check);
  ok(!missing.length, 'English for every phrase' + (missing.length ? ': missing ' + missing.map((m) => '«' + m + '»').join(', ') : ''));
  ok(en('Ayúdale a mandar la tarea de la Experiencia 3, El Restaurante Chino: graben juntos su video y mándenlo a la profe por WhatsApp.') ===
    'Help them send the homework of Experience 3, The Chinese Restaurant: record their video together and send it to the teacher on WhatsApp.', '… the experience\'s name is translated inside the sentence');

  if (LOGINS) {
    // (for the screenshots only: a file the caller reads; never printed)
    fs.writeFileSync(LOGINS, JSON.stringify(Object.fromEntries(Object.entries(KIDS).map(([k, v]) => [k, { access: CLASS[v.level], code: v.code, level: v.level }]))));
  }
}

// ── 4 · the page ────────────────────────────────────────────────────────────────────────────────────────────────
function pageTests() {
  section('the page: everything of the old Papás has its place, nothing confusing is left');
  const html = fs.readFileSync(path.join(ROOT, 'public', 'homework.html'), 'utf8');
  const hw = fs.readFileSync(path.join(ROOT, 'public', 'js', 'homework.js'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'papas.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'papas.css'), 'utf8');
  const block = html.slice(html.indexOf('<div id="screen-parents"'), html.indexOf('<!-- SCREEN: ASSIGNMENT —', html.indexOf('<div id="screen-parents"')));
  ok(block.length > 2000, 'the Papás screen is in homework.html');
  for (const part of ['mensajes', 'reporte', 'guias', 'sabe', 'preguntas', 'examenes', 'historias', 'tareas', 'ideas']) {
    ok(block.includes('data-open="' + part + '"'), 'a row (or link) opens «' + part + '»');
  }
  for (const part of ['sabe', 'preguntas', 'examenes', 'historias', 'reporte', 'guias', 'ideas']) ok(block.includes('data-part="' + part + '"'), '… and its sheet part «' + part + '»');
  ok(block.includes('id="hw-parents-back"') && block.includes('id="hw-guias-list"') && block.includes('id="hw-report-months"'), 'the old «Volver», guides and month reports keep their ids (homework.js fills them)');
  ['Práctica aleatoria, cualquier día', 'EN VOZ ALTA, siempre', 'Escribir también ayuda', 'Que él/ella te enseñe a ti', 'Celebra los pequeños logros',
    '5 minutos por día &gt; 1 hora a la semana', 'No corrijas demasiado'].forEach((t) => ok(block.includes(t), 'the old tip «' + t + '» is kept («Más ideas para casa»)'));
  ok(!/hw-parents-pill|hw-parents-stats|Camino del idioma|hw-parents-tab\b|Generar reporte|hw-parents-remaining/.test(block + hw.replace(/\/\/.*$/gm, '')), 'no hidden-toggle pills, no «Camino del idioma», no tabs, no pending-tareas list');
  ok(!/Hacerla ahora/.test(block + js), 'no «Hacerla ahora» on Papás (the tareas are the kid\'s home: «Ver sus tareas»)');
  ok(!/Código:|hw-parents-code/.test(block) && !/\bD\.code\b|data\.code\b/.test(js), 'no code shown on Papás');
  ok(/body:has\(#screen-parents:not\(\.hidden\)\) #hw-pin-stack \{ display: none/.test(css), '… and the pinned code stack hides while Papás is open');
  ok(!HANZI.test(block) && !HANZI.test(js) && !HANZI.test(fs.readFileSync(path.join(ROOT, 'public', 'js', 'papas-plan.js'), 'utf8')), 'no hanzi in the Papás page');
  ok(!/\bChinese\b/.test(block) && !/\bChinese\b/.test(js.replace(/\/\/.*$/gm, '')), 'never «Chinese»');
  ok(/papas-plan\.js\?v=/.test(html) && /papas\.js\?v=/.test(html) && /papas\.css\?v=/.test(html), 'homework.html loads papas-plan.js, papas.js and papas.css');
  ok(/window\.DralyPapas\.render\(data/.test(hw), 'homework.js hands the insights to js/papas.js');
  ok(/font-size: 1[5-9]px|font: [0-9]+ 1[5-9]px/.test(css) && !/font-size: 1[0-4]px/.test(css.replace(/\.pp-tile-n[^}]*\}/g, '').replace(/@container[^{]*\{[^}]*\.pp-tile-n[^}]*\}\s*\}/g, '')),
    'body text 15 px or more (only the strip\'s tiny tile numbers are smaller)');
  ok(/min-height: 48px/.test(css) && /\.pp-say \{[^}]*width: 48px; height: 48px/.test(css) && /\.pp-row \{[^}]*min-height: 66px/.test(css), 'tap targets 48 px or more');
  // the scenes of the strip are on disk (and light)
  const scenes = (js.match(/'[a-z]+\/[a-z]+\/bg-s\.webp'|'scenes\/[a-z]+-s\.webp'/g) || []).map((s) => s.slice(1, -1));
  ok(scenes.length >= 10 && scenes.every((s) => { try { return fs.statSync(path.join(ROOT, 'public', 'assets', s)).size < 60000; } catch (_) { return false; } }), 'every scene of the strip is on disk, under 60 KB (' + scenes.length + ')');
}

(async () => {
  let crashed = false;
  try { planTests(); pageTests(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  await startServer();
  try { await serverTests(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  else console.log('(server left running on port ' + PORT + ', data in a temp folder)');
  if (!crashed) {
    ok(!allLog.includes(SEED) && !allLog.includes(LEGACY), 'no teacher code in the server log');
    ok(!/\[papas\] ruta failed/.test(allLog), 'the server never failed building `ruta`');
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-papas: ${failed} FAILED, ${passed} passed` : `test-papas: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
