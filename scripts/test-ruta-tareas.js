#!/usr/bin/env node
// test-ruta-tareas.js — La Ruta Dorada redesign (2026-10-18): the homework done marks on the kid's ACCOUNT («Escuchada»,
// «¡Ya la mandé!») and the study PDFs for the super admin only. Its OWN server (port 4450, never 3000), a temporary data
// folder with MADE-UP accounts, throw-away teacher codes and level keys that are never printed. Never data/, never the
// live site.
//   · /api/ruta/tareas: who may write (only a logged-in kid, on their own record; a code in the body is ignored),
//     validation (catalog ids only, lists, at most 60, sent and unsent at once), the old hsk2-… ids, `who` (409 for a
//     sibling's mirror), the rate limit (60 saves a minute per kid), «Deshacer»
//   · two «phones» of the same kid: the marks come back on the second one (GET, the route data, the /homework login)
//   · the anonymous path (nothing saved on the server, nothing sent back)
//   · the route data (/api/ruta-dorada) carries each level's marks for the logged-in kid only
//   · the PDFs: La Base's vocabulary PDF and the golden book's PDF answer only to a super admin (code header or a
//     remembered super-admin device); a kid, a key-only phone and a regular teacher get 403, and nobody else is told
//     where they are (base.json without `book`, no PDF link in the route data or the golden book's API)
//   node scripts/test-ruta-tareas.js            (--port 4450 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4450));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the catalog's homework audios (never hardcoded: a new homework changes nothing here)
const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'audios', 'catalog.json'), 'utf8'));
const hwOf = (folder) => CAT.homeworks.filter((h) => h.level === folder).sort((a, b) => (b.exp - a.exp) || (b.round - a.round)).map((h) => h.id);
const NEW = hwOf('newhsk1');
const OLD = hwOf('hsk1');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-tareas-'));
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: false, doradoPct: 70, trainingLaunchAt: Date.now() }));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const KEYS = { yct1: 'Luna-' + (10 + crypto.randomInt(89)), hsk2: 'Cometa-' + (10 + crypto.randomInt(89)), hsk1: 'Tigre-' + (10 + crypto.randomInt(89)) };

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
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        const sc = res.headers['set-cookie'] || [];
        if (o.jar) sc.forEach((c) => { const m = /^([^=]+)=([^;]*)/.exec(c); if (m) { if (/Max-Age=0\b/.test(c)) delete o.jar[m[1]]; else o.jar[m[1]] = m[2]; } });
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, text, json, size: buf.length, head: buf.slice(0, 5).toString('latin1') });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
const get = (p, o) => req('GET', p, o);
const post = (p, body, o = {}) => req('POST', p, Object.assign({}, o, { body }));
const put = (p, body, o = {}) => req('PUT', p, Object.assign({}, o, { body }));
const T = (code) => ({ 'X-Admin-Pw': encodeURIComponent(code) });
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph) => ({ jar: ph.jar, headers: Object.assign({}, ph.headers) });
const teacher = (code) => ({ headers: Object.assign({ 'CF-Connecting-IP': '198.51.100.250' }, T(code)) });
const marks = (ph) => get('/api/ruta/tareas', as(ph));
const save = (ph, body) => post('/api/ruta/tareas', body, as(ph));
const ruta = async (o) => { const r = await get('/api/ruta-dorada', o); return Object.assign(r.json || {}, { _r: r }); };
const mod = (st, id) => (st.modules || []).find((m) => m.id === id);
async function enter(ph, accessCode, name, code) {
  const body = code ? { accessCode, studentCode: code } : { accessCode, displayName: name };
  return (await post('/api/homework/enter', body, as(ph))).json || {};
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

async function run() {
  const stamp = Date.now().toString(36).slice(-4);
  section('the catalog');
  ok(NEW.length >= 2 && OLD.length >= 2, `homework audios to mark: New HSK 1 ${NEW.length}, HSK 1 ${OLD.length}`);

  section('the kids, the keys, the teachers');
  const A1 = phone();
  const kidA = await enter(A1, '1002', 'Tareas A ' + stamp);
  ok(kidA.ok && kidA.level === 'hsk2' && kidA.levelOpen === true, 'a New HSK 1 kid enrolled before the keys');
  ok(kidA.tareas && same(kidA.tareas.ids, NEW) && same(kidA.tareas.sent, []) && kidA.tareas.level === 'newhsk1' && /^[a-f0-9]{12}$/.test(kidA.tareas.who),
    'the /homework login sends their level\'s homework audios, newest first, nothing sent yet («Hacer mis tareas»)');
  const B1 = phone();
  const kidB = await enter(B1, '1002', 'Tareas B ' + stamp);
  ok(kidB.ok, 'a classmate');
  for (const [lvl, k] of Object.entries(KEYS)) ok((await put('/api/admin/level-keys/' + lvl, { key: k }, teacher(SEED))).json.ok, `the ${lvl} key is set`);
  const t2 = await post('/api/admin/teachers', { displayName: 'Ms Tareas ' + stamp, levels: ['hsk2'] }, teacher(SEED));
  const T2 = t2.json && t2.json.teacher;
  ok(T2 && T2.teacherId, 'a regular teacher (not the super admin)');
  const K1 = phone();
  ok((await post('/api/level-key', { level: 'hsk2', key: KEYS.hsk2 }, as(K1))).json.ok, 'a phone that typed the New HSK 1 key (nobody logged in)');
  const anon = phone();

  section('the anonymous path: the marks stay on the phone');
  let g = await marks(anon);
  ok(g.status === 200 && g.json.student === false && !('marks' in g.json) && /no-store/.test(g.headers['cache-control'] || ''), 'GET: student: false, no marks, never cached');
  let p = await save(anon, { heard: [NEW[0]] });
  ok(p.status === 403 && p.json.student === false, 'POST without a login: 403 (nothing saved on the server)');
  ok((await save(K1, { sent: [NEW[0]] })).status === 403, 'a key-only phone: 403 too (the key opens levels, it is not an account)');
  ok(mod(await ruta(as(anon)), 'hsk2').tareas === null && mod(await ruta(as(K1)), 'hsk2').tareas === null, 'the route data carries no marks for them');

  section('a logged-in kid\'s marks live on their account');
  g = await marks(A1);
  ok(g.status === 200 && g.json.student === true && g.json.who === kidA.tareas.who && same(g.json.marks, {}), 'GET: their account (an opaque id, never the code), no marks yet');
  ok(!g.text.includes(kidA.studentCode), '… the student code never travels');
  p = await save(A1, { who: g.json.who, heard: [NEW[0], NEW[1]] });
  ok(p.status === 200 && same(p.json.marks, { [NEW[0]]: { h: 1 }, [NEW[1]]: { h: 1 } }), '«Escuchada» for two homeworks');
  p = await save(A1, { who: g.json.who, sent: [NEW[1]] });
  ok(p.status === 200 && same(p.json.marks[NEW[1]], { h: 1, s: 1 }) && same(p.json.marks[NEW[0]], { h: 1 }), '«¡Ya la mandé!» on one of them');
  p = await save(A1, { sent: [NEW[0]] });
  ok(p.status === 200 && same(p.json.marks[NEW[0]], { h: 1, s: 1 }), 'a save without `who` (an old page) still goes to the logged-in kid');
  p = await save(A1, { unsent: [NEW[0]] });
  ok(p.status === 200 && same(p.json.marks[NEW[0]], { h: 1 }), '«Deshacer» takes the «mandada» back (the «escuchada» stays)');
  p = await save(A1, { sent: [NEW[1]], heard: [NEW[1]] });
  ok(p.status === 200 && same(p.json.marks[NEW[1]], { h: 1, s: 1 }), 'marking again changes nothing (a union)');
  const OLDID = NEW[0].replace(/^newhsk1-/, 'hsk2-');
  if (OLDID !== NEW[0]) {
    p = await save(A1, { sent: [OLDID] });
    ok(p.status === 200 && p.json.marks[NEW[0]] && p.json.marks[NEW[0]].s === 1 && !p.json.marks[OLDID], 'an old hsk2-… id (HSK 2 became New HSK 1) lands on its newhsk1-… homework');
    await save(A1, { unsent: [NEW[0]] });
  }
  p = await save(A1, { heard: [OLD[0]] });
  ok(p.status === 200 && same(p.json.marks[OLD[0]], { h: 1 }), 'another level\'s homework (open to everyone) can be marked too');
  p = await save(A1, { code: kidB.studentCode, sent: [NEW[0]] });
  ok(p.status === 200 && same((await marks(B1)).json.marks, {}), 'a code in the body is ignored: only the logged-in kid\'s own record is written');
  ok(same((await marks(B1)).json.marks, {}) && (await marks(B1)).json.who !== g.json.who, 'the classmate\'s account is untouched, with an id of its own');
  await save(A1, { unsent: [NEW[0]] });

  section('only catalog ids (the others skipped and named back), only lists, never too many');
  const before = (await marks(A1)).json.marks;
  for (const [body, why] of [[{ heard: ['nope-e01-r1'] }, 'an id the catalog does not have'], [{ heard: [12] }, 'a number'],
    [{ heard: ['../catalog'] }, 'a path'], [{ heard: ['__proto__'] }, '__proto__'], [{ heard: ['a'.repeat(200)] }, 'a very long id']]) {
    const r = await save(A1, body);
    ok(r.status === 200 && r.json.ok && Array.isArray(r.json.unknown) && r.json.unknown.length === 1 && same(r.json.marks, before), `skipped and named back: ${why}`);
  }
  ok(!JSON.stringify((await save(A1, { heard: ['a'.repeat(200)] })).json.unknown).includes('a'.repeat(61)), '… an id named back is cut to 60 characters');
  let mix = await save(A1, { sent: [NEW[0], 'nope-e09-r9'] });
  ok(mix.status === 200 && same(mix.json.unknown, ['nope-e09-r9']) && mix.json.marks[NEW[0]].s === 1, 'a good id next to a stale one: the good one is saved, the stale one named back');
  mix = await save(A1, { unsent: [NEW[0]] });
  ok(mix.status === 200 && !('unknown' in mix.json) && !mix.json.marks[NEW[0]].s, '… (and taken back: no `unknown` when every id is good)');
  for (const [body, why] of [[{ sent: NEW[0] }, 'not a list'], [{ sent: [NEW[0]], unsent: [NEW[0]] }, 'sent and not sent at once'],
    [{ heard: Array.from({ length: 61 }, () => NEW[0]) }, '61 ids in one list']]) {
    const r = await save(A1, body);
    ok(r.status === 400 && r.json && r.json.ok === false, `refused: ${why}`);
  }
  ok(same((await marks(A1)).json.marks, { [NEW[0]]: { h: 1 }, [NEW[1]]: { h: 1, s: 1 }, [OLD[0]]: { h: 1 } }), '… nothing else reached the account');
  // a tap the account already has writes nothing (no save, no activity)
  await sleep(1500);
  const recFile = path.join(DATA, 'student-records.json');
  const t0 = fs.statSync(recFile).mtimeMs;
  ok((await save(A1, { heard: [NEW[0]], sent: [NEW[1]] })).status === 200, 'the same marks again');
  await sleep(1600);
  ok(fs.statSync(recFile).mtimeMs === t0, '… the student file is not written again (nothing changed)');
  const w409 = await save(A1, { who: 'aaaaaaaaaaaa', sent: [NEW[0]] });
  ok(w409.status === 409 && w409.json.who === g.json.who && !(await marks(A1)).json.marks[NEW[0]].s,
    'a save from another account\'s mirror (a sibling logged in meanwhile): 409 with this account\'s id, nothing written');

  section('a second phone of the same kid');
  const A2 = phone();
  const again = await enter(A2, '1002', null, kidA.studentCode);
  ok(again.ok && same(again.tareas.sent, [NEW[1]]), 'the /homework login on the new phone: «Hacer mis tareas» counts the one already sent');
  ok(same((await marks(A2)).json.marks, (await marks(A1)).json.marks), 'GET on the new phone: the same marks');
  const m2 = mod(await ruta(as(A2)), 'hsk2');
  ok(m2 && same(m2.tareas, { [NEW[0]]: { h: 1 }, [NEW[1]]: { h: 1, s: 1 } }), 'the route data carries New HSK 1\'s marks (only that level\'s homework)');
  ok(same(mod(await ruta(as(A2)), 'hsk1').tareas, { [OLD[0]]: { h: 1 } }) && same(mod(await ruta(as(A2)), 'yct1').tareas, {}), '… and each level its own');
  ok((await save(A2, { sent: [NEW[0]] })).status === 200 && (await marks(A1)).json.marks[NEW[0]].s === 1, 'sent from the new phone: the first phone sees it');
  ok(mod(await ruta(teacher(SEED)), 'hsk2').tareas === null, 'a teacher\'s route data carries no kid\'s marks');
  await post('/api/homework/logout', {}, as(A2));
  ok((await marks(A2)).json.student === false && (await save(A2, { heard: [NEW[0]] })).status === 403, '«Salir»: that phone writes on the account no more');
  ok((await enter(A2, '1002', null, kidA.studentCode)).ok && (await marks(A2)).json.student === true, 'one login brings it back');

  section('the record stays small, and it is the kid\'s');
  await sleep(1500);   // the student file is written a second after the last change
  const recs = JSON.parse(fs.readFileSync(path.join(DATA, 'student-records.json'), 'utf8'));
  const ra = recs[kidA.studentCode] && recs[kidA.studentCode].tareas;
  ok(ra && Object.keys(ra).length === 3 && ra[NEW[1]].h > 0 && ra[NEW[1]].s > 0 && JSON.stringify(ra).length < 300, 'stored as { id: { h, s } } on their record: ' + JSON.stringify(ra || {}).length + ' characters');
  ok(!recs[kidB.studentCode].tareas, 'nothing on the classmate\'s record');
  ok(!Object.values(recs).some((r) => r.code !== kidA.studentCode && r.tareas), 'no other record got marks');

  section('a save counts per kid: 60 a minute');
  const C1 = phone();
  const kidC = await enter(C1, '1002', 'Tareas C ' + stamp);
  ok(kidC.ok && kidC.levelOpen === false && (await marks(C1)).json.student === true, 'a kid who joined after the keys (no key): the homework audios are open, so their marks save too');
  const codes = [];
  for (let i = 0; i < 64; i++) codes.push((await save(C1, { heard: [NEW[0]] })).status);
  const first429 = codes.indexOf(429);
  ok(first429 === 60 && codes.slice(first429).every((c) => c === 429), 'the kid\'s saves wait after 60 in a minute (first wait at save ' + (first429 + 1) + ')');  ok((await save(B1, { heard: [NEW[0]] })).status === 200, '… a classmate on the same school Wi-Fi is never slowed');

  section('the study PDFs: the super admin only');
  const base = CAT.bases.find((b) => b.level === 'newhsk1');
  ok(base && /book\.pdf/.test((base.book && base.book.pdf) || ''), 'New HSK 1\'s La Base has a PDF in the catalog');
  const pdfUrl = '/base-media/' + base.id + '/book.pdf';
  let r = await get(pdfUrl, as(A1));
  ok(r.status === 403 && r.head !== '%PDF-', 'La Base\'s PDF → a kid with the level: 403');
  ok((await get(pdfUrl, as(K1))).status === 403, '… a key-only phone: 403');
  ok((await get(pdfUrl, teacher(T2.teacherId))).status === 403, '… a regular teacher: 403');
  ok((await get(pdfUrl, as(anon))).status === 401, '… anonymous: the level\'s door first (401)');
  r = await get(pdfUrl, teacher(SEED));
  ok(r.status === 200 && r.head === '%PDF-' && /application\/pdf/.test(r.headers['content-type'] || '') && /private/.test(r.headers['cache-control'] || ''), '… the super admin (code): the PDF, private');
  const SA = phone();
  ok((await post('/api/teacher-device', { code: SEED }, as(SA))).json.ok, 'a remembered super-admin device');
  r = await get(pdfUrl, as(SA));
  ok(r.status === 200 && r.head === '%PDF-', '… downloads it with a plain link (its cookie)');
  let bj = await get('/base-media/' + base.id + '/base.json', as(A1));
  ok(bj.status === 200 && bj.json && Array.isArray(bj.json.words) && bj.json.words.length === base.words && !('book' in bj.json), 'La Base\'s page data for a kid: every word, no `book` (no download button anywhere)');
  ok(!/book\.pdf/.test(bj.text), '… not even its address');
  bj = await get('/base-media/' + base.id + '/base.json', teacher(T2.teacherId));
  ok(bj.status === 200 && !('book' in bj.json), '… for a regular teacher the same');
  bj = await get('/base-media/' + base.id + '/base.json', as(SA));
  ok(bj.status === 200 && bj.json.book && /book\.pdf/.test(bj.json.book.pdf), '… the super admin\'s page names the PDF');

  const gl = mod(await ruta(teacher(SEED)), 'hsk2');
  ok(gl && gl.golden && /\/golden-media\/.+\/book\.pdf/.test(gl.golden.pdf || ''), 'the route data names the golden book\'s PDF to the super admin');
  ok(gl.sims.length > 0 && gl.sims.every((s) => 'at' in s && s.at === null), 'each simulation carries `at` (the latest try: none for a teacher)');
  const gt = mod(await ruta(teacher(T2.teacherId)), 'hsk2');
  ok(gt && gt.golden && gt.golden.pdf === null, '… never to a regular teacher');
  const gk = mod(await ruta(as(A1)), 'hsk2');
  ok(!gk.golden || gk.golden.pdf == null, '… nor to a kid');
  const gpdf = (gl.golden.pdf || '').split('?')[0];
  if (gpdf) {
    ok((await get(gpdf, teacher(T2.teacherId))).status === 403, 'the golden book\'s PDF → a regular teacher: 403');
    ok((await get(gpdf, as(A1))).status === 403, '… a kid: 403');
    r = await get(gpdf, teacher(SEED));
    ok(r.status === 200 && r.head === '%PDF-' && /attachment/.test(r.headers['content-disposition'] || ''), '… the super admin: the PDF (a download)');
    ok((await get(gpdf, as(SA))).status === 200, '… and on a remembered super-admin device');
  }
  const gb = await get('/api/golden/newhsk1/1', teacher(T2.teacherId));
  ok(gb.status === 200 && gb.json.pdf && gb.json.pdf.href === null && gb.json.pdf.ready === false, 'the golden book\'s page for a regular teacher: no PDF');
  const gs = await get('/api/golden/newhsk1/1', teacher(SEED));
  ok(gs.status === 200 && /book\.pdf/.test(gs.json.pdf.href || '') && gs.json.pdf.ready === true, '… for the super admin: its link');

  section('«Tus tareas» by experience, like folders (his rule 2026-10-18)');
  const st0 = await ruta(phone());
  const exOf = (id) => (mod(st0, id) || {}).exps || [];
  for (const [id, n] of [['hsk2', 8], ['hsk1', 8], ['yct1', 6]]) {
    const ex = exOf(id);
    ok(ex.length === n && ex.every((e, i) => e.n === i + 1 && e.name && !/^EXP/i.test(e.name) && !/Pinyin|Simulacro/.test(e.name)),
      `${id}: ${ex.length} experiences, numbered 1-${n}, the curriculum's names (never «EXP3 ·», Pinyin básico or the Simulacro)`);
    const bad = ex.filter((e) => !e.pic || !/^\/assets\/packs\/[a-z0-9]+\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/.test(e.pic) || !fs.existsSync(path.join(ROOT, 'public', e.pic)));
    ok(!bad.length, `${id}: each experience has one of its own pack pictures on disk (${bad.map((e) => e.n).join(', ') || 'all there'})`);
  }
  ok(exOf('hsk2')[2].name === 'El Restaurante Chino' && exOf('hsk2')[3].pic.indexOf('/newhsk1/tienda/') > 0, 'New HSK 1: Experiencia 3 is «El Restaurante Chino», 4 shows its clothes shop');
  const noFolder = CAT.homeworks.filter((h) => { const lv = ({ newhsk1: 'hsk2', hsk1: 'hsk1', yct1: 'yct1' })[h.level]; return !exOf(lv).some((e) => e.n === h.exp); });
  ok(!noFolder.length, 'every homework audio of the catalog has its experience folder (' + (noFolder.map((h) => h.id).join(', ') || 'all') + ')');
  ok(!JSON.stringify(st0.modules.map((m) => m.exps)).match(/[㐀-鿿]/), 'the folders carry no hanzi');
  const rjs = fs.readFileSync(path.join(ROOT, 'public', 'js', 'ruta.js'), 'utf8');
  ok(/data-open-exp/.test(rjs) && /Volver a las experiencias/.test(rjs) && /La más nueva/.test(rjs) && /Pronto/.test(rjs) && !/Ver todas mis tareas/.test(rjs),
    'js/ruta.js draws the folders («Volver a las experiencias», «La más nueva», «Pronto»), never the old long list («Ver todas mis tareas»)');

  section('the pages that draw it');
  const page = fs.readFileSync(path.join(ROOT, 'public', 'js', 'ruta.js'), 'utf8');
  ok(/\/api\/ruta\/tareas/.test(page) && /draly_tareas/.test(page), 'js/ruta.js saves the marks (account) and keeps the phone\'s (draly_tareas)');
  ok(!/El libro en PDF llega/.test(page) && !/para descargar el libro/.test(page), 'no «El libro en PDF llega con…» line on the route');
  const libro = fs.readFileSync(path.join(ROOT, 'public', 'js', 'libro.js'), 'utf8');
  ok(!/para descargar el libro/.test(libro) && !/Llega con El Simulacro Dorado/.test(libro), 'no PDF promise in El libro dorado');
  const hw = fs.readFileSync(path.join(ROOT, 'public', 'js', 'homework.js'), 'utf8');
  ok(/Hacer mis tareas/.test(hw) && /\?from=homework#tareas/.test(hw), '/homework: «Hacer mis tareas» opens «Tus tareas»');
  const i18n = fs.readFileSync(path.join(ROOT, 'public', 'js', 'hw-i18n.js'), 'utf8');
  ok(/Hacer mis tareas/.test(i18n) && /por mandar/.test(i18n), '… and has its English');
}

(async () => {
  let crashed = false;
  await startServer();
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  if (!crashed) {
    ok(!allLog.includes(SEED) && !allLog.includes(LEGACY) && !Object.values(KEYS).some((k) => allLog.toUpperCase().includes(k.toUpperCase())), 'no teacher code or level key in the server log');
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-ruta-tareas: ${failed} FAILED, ${passed} passed` : `test-ruta-tareas: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
