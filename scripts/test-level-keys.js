#!/usr/bin/env node
// test-level-keys.js — La Ruta Dorada phase 1, the key model (his decisions 2026-10-15; core/level-keys.js).
// Starts its OWN server (port 4300, never 3000, never the live site) on a fresh temporary data folder (so the go-live
// moment and grandfathering start from zero), with throw-away teacher codes that are never printed, plays every way in
// and out, restarts it twice (the code change and the boot seed must survive), and stops it. Students are made
// through the API, never by opening a data file.
//   node scripts/test-level-keys.js            (--port 4300 · --keep to leave it running)
// Checks: La Base (pages, data, clips, pictures, PDF) and the sims are refused anonymously (key screen), old /assets/
// addresses serve nothing; before any key every enrolled kid keeps their level; the first key = go-live; a new account
// needs the key, a grandfathered one does not (after its /homework login, on any device), a kid who moves up needs the
// new level's key but keeps the old one; the right key opens that level only (any case, spaces, dashes), wrong keys
// are refused and rate-limited per device and per address, another level's key gets its own message; a key typed while
// logged in is saved on the account; a key change stops the old key for new devices while unlocked devices keep it;
// «Cerrar en todos los aparatos» ends the devices, accounts keep theirs; «Desbloquear»; creating a room needs a
// remembered teacher device or a teacher code; the /maestro login and the teacher screen remember the device; a remembered
// device opens every level; «Cambiar mi código» (own + super-admin for others) stops the old code at once, ends devices
// remembered with it, retires it for good, survives a restart, and the boot seed never brings a code back; teacher
// codes never reach a kid's phone; homework and its audio pages are unchanged.
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4300));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-keys-'));
// (phase 4, 2026-10-16: this test checks the key's door, so El Entrenamiento's switch is OFF here, as he may set it
// after the launch: the key alone opens a simulation. The Dorado rule ON is scripts/test-ruta-training.js)
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: false, doradoPct: 70, trainingLaunchAt: Date.now() }));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);          // WU_ADMIN_PASSWORD of this test server
const SEED = 'T-' + rnd(5);                  // the first-boot super-admin code of this test server
const SECRET = 'test-' + rnd(24);

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── HTTP with a cookie jar per visitor (a phone) ──
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
        resolve({ status: res.statusCode, headers: res.headers, text, json, bytes: buf.length, setCookie: sc });
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
const isKeyScreen = (r, levelName) => r.status === 401 && /data-level-key="locked"/.test(r.text) && (!levelName || r.text.includes('Escribe la clave de ' + levelName));
const isAudiosPage = (r) => r.status === 200 && /id="au-main"/.test(r.text) && !/data-level-key/.test(r.text);
const isPlayer = (r) => r.status === 200 && /id="y-exam"|id="hsk-runner"/.test(r.text) && !/data-level-key/.test(r.text);
const noStore = (r) => /no-store/.test(r.headers['cache-control'] || '');
const cookieOk = (sc, name) => { const c = sc.find((x) => x.startsWith(name + '=')); return !!c && /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c) && /Path=\//.test(c); };
const sock = (jar) => io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true,
  extraHeaders: jar && Object.keys(jar).length ? { Cookie: Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ') } : {} });
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});
async function create(jar, opts) {
  const s = sock(jar);
  const r = await emitAck(s, 'host:create', Object.assign({ gameType: 'mochi-mash' }, opts || {}));
  s.close();
  return r;
}
// a phone: its own cookie jar and its own address (Cloudflare's CF-Connecting-IP), so limits never leak between tests
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph, extra) => Object.assign({ jar: ph.jar, headers: Object.assign({}, ph.headers, (extra && extra.headers) || {}) });

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED }),
  });
  let log = '';
  srv.stdout.on('data', (d) => { log += d; allLog += d; });
  srv.stderr.on('data', (d) => { log += d; allLog += d; });
  srv.getLog = () => log;
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return srv; } catch (_) {}
  }
  console.error('the server did not start:\n' + log.slice(-2000));
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

(async () => {
  await startServer();
  let crashed = false;
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  const log = allLog;
  if (!KEEP) await stopServer();
  if (!crashed) {
    ok(!log.includes(SEED) && !log.includes(LEGACY) && !/Luna-?58|Cielo-?2024|Cometa-?73|Tigre-?41/i.test(log), 'no teacher code or level key in the server log');
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-level-keys: ${failed} FAILED, ${passed} passed` : `test-level-keys: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();

const BASES = [
  { id: 'yct1-base', level: 'yct1', name: 'YCT 1', pack: 'yct1' },
  { id: 'newhsk1-base', level: 'hsk2', name: 'New HSK 1', pack: 'newhsk1' },
  { id: 'hsk1-base', level: 'hsk1', name: 'HSK 1', pack: 'hsk1' },
];
function baseFiles(b) {   // its data, a word clip, a sentence clip, a picture, the PDF
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'protected', 'base', b.id, 'base.json'), 'utf8'));
  return ['/base-media/' + b.id + '/base.json', data.words[0].au, data.words[1].exau, data.words[2].pic, data.book.pdf];
}
const fetchMedia = (u, o) => get(u, Object.assign({}, o, { headers: Object.assign(/\.mp3/.test(u) ? { Range: 'bytes=0-1023' } : {}, (o && o.headers) || {}) }));
const mediaOk = (r) => (r.status === 200 || r.status === 206) && r.bytes > 0 && /private/.test(r.headers['cache-control'] || '') &&
  /no-store/.test(r.headers['cloudflare-cdn-cache-control'] || '');

async function enter(ph, accessCode, name, code) {
  const body = code ? { accessCode, studentCode: code } : { accessCode, displayName: name };
  const r = await post('/api/homework/enter', body, as(ph));
  return r.json || {};
}
async function openBase(ph, b) {
  const page = await get('/audios/' + b.id, as(ph));
  const data = await get('/base-media/' + b.id + '/base.json', as(ph));
  return isAudiosPage(page) && data.status === 200 && data.json && data.json.words && data.json.words.length > 0;
}

async function run() {
  const stamp = Date.now().toString(36).slice(-4);

  // ── 1. anonymous: everything of La Base and the sims asks for the key ──
  section('anonymous visitor');
  const anon = phone();
  for (const b of BASES) {
    ok(isKeyScreen(await get('/audios/' + b.id, as(anon)), b.name), `${b.id}: the page is the ${b.name} key screen`);
    for (const u of baseFiles(b)) {
      const r = await fetchMedia(u, as(anon));
      ok(r.status === 401 && r.bytes < 200 && noStore(r), `${b.id}: ${u.split('?')[0]} refused anonymously (${r.status})`);
    }
    ok((await get('/assets/audios/' + b.id + '/base.json')).status === 404, `${b.id}: the old /assets/ data address answers 404`);
    ok((await get('/assets/study/' + b.pack + '-vocabulario.pdf')).status === 404, `${b.id}: the old /assets/study PDF answers 404`);
  }
  ok(isKeyScreen(await get('/audios/hsk2-base', as(anon)), 'New HSK 1'), 'the stored-id alias /audios/hsk2-base asks for the New HSK 1 key');
  ok(isKeyScreen(await get('/audios/HSK2-BASE', as(anon)), 'New HSK 1'), '… in any case');
  for (const p of ['/base-media/yct1-base/../../server.js', '/base-media/yct1-base/pics/../base.json', '/base-media/yct1-base/%2e%2e/%2e%2e/package.json',
    '/base-media/x-base/base.json', '/base-media/yct1-base/base.json.bak', '/assets/audios/yct1-base/../yct1-base/base.json', '/assets//study/yct1-vocabulario.pdf',
    '/assets/%73tudy/yct1-vocabulario.pdf', '/protected/base/yct1-base/base.json', '/protected/study/yct1-vocabulario.pdf']) {
    const r = await get(p, as(anon));
    ok(r.status !== 200 || !/"words"|%PDF/.test(r.text), `nothing through ${p} (${r.status})`);
  }
  const sims = ((await get('/api/hsk-sim/list')).json || {}).sims || [];
  const simOf = (lvl) => sims.filter((s) => (lvl === 'yct1' ? /^yct1-/ : lvl === 'hsk2' ? /^newhsk1-/ : /^hsk1-/).test(s.id)).map((s) => s.id);
  ok(simOf('yct1').length >= 5 && simOf('hsk2').length >= 2 && simOf('hsk1').length >= 5, 'the sim list is there');
  const pageOf = (id) => (/^hsk\d/.test(id) ? '/hsk-sim.html?sim=' : '/yct-sim.html?sim=') + id;
  for (const [lvl, name] of [['yct1', 'YCT 1'], ['hsk2', 'New HSK 1'], ['hsk1', 'HSK 1']]) {
    const id = simOf(lvl)[0];
    ok(isKeyScreen(await get(pageOf(id), as(anon)), name), `${id}: the sim page is the ${name} key screen`);
    ok((await get('/api/hsk-sim/' + id, as(anon))).status === 401, `${id}: no payload anonymously`);
  }
  ok((await get('/yct-sim.html', as(anon))).status === 401 && /"reason":"pin"/.test((await get('/yct-sim.html', as(anon))).text), 'the bare exam page sends a visitor to the PIN card');
  const access0 = (await get('/api/level-access', as(anon))).json;
  ok(access0 && access0.ok && access0.levels && !access0.levels.yct1 && !access0.levels.hsk2 && !access0.levels.newhsk1 && !access0.levels.hsk1 && !access0.teacher,
    '/api/level-access: nothing open for a visitor');

  // ── 2. homework and its audio stay exactly as they were ──
  section('homework unchanged');
  ok((await get('/homework.html', as(anon))).status === 200, '/homework.html opens');
  ok(isAudiosPage(await get('/audios', as(anon))) && isAudiosPage(await get('/audios/yct1', as(anon))), '/audios and a level folder open');
  for (const id of ['hsk1-e01-r1', 'newhsk1-e01-r1', 'hsk2-e01-r1']) ok(isAudiosPage(await get('/audios/' + id, as(anon))), `/audios/${id} (a printed PDF's address) opens`);
  const cat = (await get('/assets/audios/catalog.json')).json;
  ok(cat && cat.homeworks && cat.homeworks.length >= 6, 'the catalog is public');
  const hw = cat.homeworks[0];
  const track = await get(hw.tracks[0].src, { headers: { Range: 'bytes=0-1023' } });
  ok(track.status === 206 || track.status === 200, 'a homework track plays with no login');
  ok(!/\/assets\/audios\/[a-z0-9]+-base\//.test(JSON.stringify(cat)) && !/\/assets\/study\//.test(JSON.stringify(cat)), 'the catalog points La Base at /base-media/ only');

  // ── 3. before any key: every enrolled kid keeps their level ──
  section('before the keys go live');
  const keys0 = (await get('/api/admin/level-keys', { headers: T(SEED) })).json;
  ok(keys0 && keys0.ok && !keys0.goLiveAt && keys0.levels.length === 3 && keys0.levels.every((l) => !l.key), 'no key yet, no go-live moment');
  const oldPh = phone();
  const oldKid = await enter(oldPh, '1003', 'Old Yct ' + stamp);
  ok(oldKid.ok && oldKid.level === 'yct1' && oldKid.levelOpen === true, 'a kid enrolled before the keys: their level is open');
  ok(oldPh.jar.dsim && oldPh.jar.dlv_yct1, '… the login gives the session and this phone the level (cookies)');
  ok(await openBase(oldPh, BASES[0]), '… La Base YCT 1 opens');
  ok(isKeyScreen(await get('/audios/hsk1-base', as(oldPh)), 'HSK 1'), '… another level\'s base still asks its key');
  const oldHsk = phone();
  const oldHskKid = await enter(oldHsk, '1001', 'Old Hsk ' + stamp);
  const moverPh = phone();
  const mover = await enter(moverPh, '1003', 'Mover ' + stamp);
  const lateUnlockPh = phone();
  ok(oldHskKid.levelOpen && mover.levelOpen, 'two more kids enrolled before the keys');

  // ── 4. the keys: only the super-admin sets them; the first one is the go-live moment ──
  section('setting the keys (/maestro)');
  const teachers = ((await get('/api/admin/teachers', { headers: T(SEED) })).json || {}).teachers || [];
  const enni = teachers.find((t) => /enni/i.test(t.displayName));
  ok(enni && enni.teacherId && !enni.isSuperAdmin, 'a regular teacher exists (Ms Enni)');
  ok((await put('/api/admin/level-keys/yct1', { key: 'Luna-58' }, { headers: T(enni.teacherId) })).status === 403, 'a regular teacher cannot set a key');
  ok((await get('/api/admin/level-keys', { headers: T(enni.teacherId) })).status === 403, '… nor see them');
  ok((await get('/api/admin/level-keys')).status === 401, '… and a visitor gets nothing');
  for (const bad of ['PANDA-12', 'panda 12', 'abc', 'LUNA5', '12345678', 'LUNA-58<script>', '']) {
    const r = await put('/api/admin/level-keys/yct1', { key: bad }, { headers: T(SEED) });
    ok(r.status === 400 && r.json && r.json.error, `the key «${bad}» is refused: ${r.json && r.json.error}`);
  }
  const s1 = await put('/api/admin/level-keys/yct1', { key: 'Luna-58' }, { headers: T(SEED) });
  ok(s1.json && s1.json.ok && s1.json.goLiveAt > 0, 'the YCT 1 key is set: the keys are live');
  const goLive = s1.json.goLiveAt;
  ok((await put('/api/admin/level-keys/hsk2', { key: 'luna 58' }, { headers: T(LEGACY) })).status === 400, 'each level needs its own key');
  ok((await put('/api/admin/level-keys/newhsk1', { key: 'Cometa-73' }, { headers: T(LEGACY) })).json.ok, 'New HSK 1 (its curriculum id) gets a key (legacy password)');
  const s3 = await put('/api/admin/level-keys/hsk1', { key: 'Tigre-41' }, { headers: T(SEED) });
  ok(s3.json && s3.json.ok && s3.json.goLiveAt === goLive, 'HSK 1 gets a key; the go-live moment never moves');
  const keys1 = (await get('/api/admin/level-keys', { headers: T(SEED) })).json;
  ok(keys1.levels.find((l) => l.id === 'yct1').key === 'LUNA-58' && keys1.levels.find((l) => l.id === 'hsk2').key === 'COMETA-73', 'the panel shows each key as he typed it (upper case)');

  // ── 5. after the go-live ──
  section('grandfathered vs new accounts');
  const newPh = phone();
  const newKid = await enter(newPh, '1003', 'New Yct ' + stamp);
  ok(newKid.ok && newKid.levelOpen === false && !newPh.jar.dlv_yct1, 'a new account after the go-live: not open');
  ok(isKeyScreen(await get('/audios/yct1-base', as(newPh)), 'YCT 1'), '… La Base YCT 1 asks the key');
  ok(isKeyScreen(await get(pageOf(simOf('yct1')[0]), as(newPh)), 'YCT 1'), '… so does a YCT 1 sim');
  const oldAgain = phone();
  const relog = await enter(oldAgain, '1003', null, oldKid.studentCode);
  ok(relog.ok && relog.levelOpen === true && oldAgain.jar.dlv_yct1, 'the grandfathered kid on a NEW phone: open after the /homework login');
  ok(await openBase(oldAgain, BASES[0]), '… La Base opens there');
  const det = (await get('/api/admin/students/' + oldKid.studentCode, { headers: T(SEED) })).json;
  ok(det && det.levelKey && det.levelKey.open && det.levelKey.via === 'grandfathered', 'the Cuaderno shows it: open, kept from before the keys');
  const rosterRow = (((await get('/api/admin/students', { headers: T(SEED) })).json || {}).students || []).find((s) => s.code === newKid.studentCode);
  ok(rosterRow && rosterRow.levelOpen === false && !('levelAccess' in rosterRow), 'the roster row says a new kid is locked (no raw fields)');
  // the session key screen route: saved codes open a grandfathered kid's level silently
  const silentPh = phone();
  const sil = await post('/api/level-access/session', { accessCode: '1003', studentCode: oldKid.studentCode }, as(silentPh));
  ok(sil.json && sil.json.ok && sil.json.open === true && silentPh.jar.dlv_yct1, 'the key screen\'s silent try with saved codes opens a grandfathered kid');
  const silNew = await post('/api/level-access/session', { accessCode: '1003', studentCode: newKid.studentCode }, as(phone()));
  ok(silNew.json && silNew.json.ok && silNew.json.open === false, '… and not a new account');
  ok((await post('/api/level-access/session', { accessCode: '1001', studentCode: oldKid.studentCode }, as(phone()))).status === 403, '… never with another class\'s code');

  // ── 6. typing the key ──
  section('the key screen');
  const k = phone();
  const wrong = await post('/api/level-key', { level: 'yct1', key: 'Luna-59' }, as(k));
  ok(wrong.status === 401 && /Esa clave no es/.test(wrong.json.error) && !/LUNA/i.test(wrong.text), 'a wrong key: the kind message, nothing echoed');
  ok(cookieOk(wrong.setCookie, 'dkd'), 'the device gets its (guess-counting) id');
  const other = await post('/api/level-key', { level: 'yct1', key: 'tigre41' }, as(k));
  ok(other.status === 401 && other.json.otherLevel === 'hsk1' && /HSK 1/.test(other.json.error), 'another level\'s key: «esa clave es de HSK 1»');
  ok((await post('/api/level-key', { level: 'yct1', key: '   ' }, as(k))).status === 400, 'an empty key: «Escribe la clave»');
  ok((await post('/api/level-key', { level: 'zz9', key: 'Luna-58' }, as(k))).status === 400, 'an unknown level is refused');
  const right = await post('/api/level-key', { level: 'yct1', key: ' luna — 58 ' }, as(k));
  ok(right.json && right.json.ok && right.json.saved === false && cookieOk(right.setCookie, 'dlv_yct1'), 'the right key (any case, spaces, dashes): this device keeps YCT 1 (httpOnly cookie)');
  ok(await openBase(k, BASES[0]), '… La Base YCT 1 opens');
  for (const u of baseFiles(BASES[0])) ok(mediaOk(await fetchMedia(u, as(k))), `… ${u.split('?')[0]} loads (private, never at Cloudflare)`);
  ok(/attachment|inline/.test((await get(baseFiles(BASES[0])[4], as(k))).headers['content-disposition'] || '') , '… the PDF downloads');
  ok(isKeyScreen(await get('/audios/hsk1-base', as(k)), 'HSK 1') && (await get('/base-media/hsk1-base/base.json', as(k))).status === 401, '… that level only (HSK 1 still asks)');
  ok(isPlayer(await get(pageOf(simOf('yct1')[0]), as(k))), '… the YCT 1 sims open');
  const pay = await get('/api/hsk-sim/' + simOf('yct1')[0], as(k));
  ok(pay.json && pay.json.ok && pay.json.sim.ticket, '… with their payload');
  ok((await get('/api/hsk-sim/' + simOf('hsk2')[0], as(k))).status === 401, '… and no New HSK 1 sim');
  const guest = await post('/api/hsk-sim/' + simOf('yct1')[0] + '/submit', { studentCode: newKid.studentCode, answers: {}, ticket: pay.json.sim.ticket }, as(k));
  ok(guest.json && guest.json.ok && guest.json.saved === false && guest.json.guest, 'a key-only phone: graded, not saved on a typed code');
  const proven = await post('/api/hsk-sim/' + simOf('yct1')[0] + '/submit', { studentCode: newKid.studentCode, accessCode: '1003', answers: {}, ticket: pay.json.sim.ticket }, as(k));
  ok(proven.json && proven.json.ok && proven.json.saved !== false, '… saved when the phone proves whose it is (class code + student code)');
  ok(((await get('/api/level-access', as(k))).json.levels || {}).yct1 === true, '/api/level-access: YCT 1 open on this phone');

  // ── 7. wrong guesses: 5 per device, 30 per address ──
  section('wrong guesses');
  const g = phone();
  for (let i = 0; i < 5; i++) await post('/api/level-key', { level: 'hsk1', key: 'Tigre-' + (50 + i) }, as(g));
  const sixth = await post('/api/level-key', { level: 'hsk1', key: 'Tigre-41' }, as(g));
  ok(sixth.status === 429 && sixth.json.wait > 0 && /Espera \d+ minutos?/.test(sixth.json.error), '5 wrong on one device → a wait, even for the right key (kind message)');
  const sameIpNewDevice = { jar: {}, headers: g.headers };
  ok((await post('/api/level-key', { level: 'hsk1', key: 'Tigre-41' }, sameIpNewDevice)).json.ok, '… another device at the same address still gets in (a class shares one Wi-Fi)');
  const ip = { 'CF-Connecting-IP': '203.0.113.77' };
  for (let i = 0; i < 30; i++) await post('/api/level-key', { level: 'hsk1', key: 'Tigre-' + (100 + i) }, { jar: {}, headers: ip });
  ok((await post('/api/level-key', { level: 'hsk1', key: 'Tigre-41' }, { jar: {}, headers: ip })).status === 429, '30 wrong from one address (new device each time) → that address waits');
  ok((await post('/api/level-key', { level: 'hsk1', key: 'Tigre-41' }, as(phone()))).json.ok, '… other addresses are not affected');

  // ── 8. a key typed while logged in is saved on the account ──
  section('the key on the account');
  const nk = phone();
  await enter(nk, '1003', null, newKid.studentCode);
  const typed = await post('/api/level-key', { level: 'yct1', key: 'LUNA58' }, as(nk));
  ok(typed.json && typed.json.ok && typed.json.saved === true, 'a logged-in kid types the key: saved on their account');
  const nk2 = phone();
  const relog2 = await enter(nk2, '1003', null, newKid.studentCode);
  ok(relog2.levelOpen === true && await openBase(nk2, BASES[0]), '… so their next phone opens without typing it');
  const detNew = (await get('/api/admin/students/' + newKid.studentCode, { headers: T(SEED) })).json;
  ok(detNew.levelKey.open && detNew.levelKey.via === 'key', 'the Cuaderno: open by key');
  // a key typed BEFORE logging in is saved at the login
  const before = phone();
  const kid3 = await enter(phone(), '1003', 'Kid Three ' + stamp);
  await post('/api/level-key', { level: 'yct1', key: 'Luna-58' }, as(before));
  const login3 = await enter(before, '1003', null, kid3.studentCode);
  ok(kid3.levelOpen === false && login3.levelOpen === true, 'a key typed before the login is saved on the account at the login');
  ok(((await get('/api/admin/students/' + kid3.studentCode, { headers: T(SEED) })).json.levelKey || {}).via === 'key', '… the Cuaderno says so');

  // ── 9. a kid who moves up after the go-live ──
  section('moving to another level');
  // (a login with the kid's own class code after the go-live stamps the grandfathered level on the account; a move
  // with a new class code never stamps anything: from outside it looks exactly like someone trying another class)
  ok((await enter(moverPh, '1003', null, mover.studentCode)).levelOpen === true, 'the grandfathered YCT kid logs in after the go-live (own class code)');
  const mv = await enter(moverPh, '1002', null, mover.studentCode);
  ok(mv.level === 'hsk2' && mv.levelOpen === false, 'a grandfathered YCT kid now on New HSK 1: that level needs its key');
  const mvPh2 = phone();
  await enter(mvPh2, '1002', null, mover.studentCode);
  ok(isKeyScreen(await get('/audios/newhsk1-base', as(mvPh2)), 'New HSK 1'), '… New HSK 1 asks the key');
  ok(await openBase(mvPh2, BASES[0]), '… while YCT 1 stays open on their account (any phone)');

  // ── 10. a key change; closing every device ──
  section('changing a key');
  const ch = await put('/api/admin/level-keys/yct1', { key: 'Cielo-2024' }, { headers: T(SEED) });
  ok(ch.json && ch.json.ok && ch.json.goLiveAt === goLive, 'the YCT 1 key changes (the go-live moment stays)');
  ok((await post('/api/level-key', { level: 'yct1', key: 'Luna-58' }, as(phone()))).status === 401, 'the old key no longer opens a new device');
  ok((await post('/api/level-key', { level: 'yct1', key: 'cielo2024' }, as(phone()))).json.ok, 'the new key does');
  ok(await openBase(k, BASES[0]), 'a device unlocked with the old key keeps YCT 1 (no family has to retype)');
  const cl = await post('/api/admin/level-keys/yct1/close-devices', {}, { headers: T(SEED) });
  ok(cl.json && cl.json.ok, '«Cerrar en todos los aparatos» for YCT 1');
  ok(isKeyScreen(await get('/audios/yct1-base', as(k)), 'YCT 1'), '… that device asks again');
  ok(await openBase(k, BASES[0]) === false, '… its files too');
  ok((await enter(phone(), '1003', null, newKid.studentCode)).levelOpen === false, '… and an account that had typed the (leaked) key loses it too: it types the new key once');
  const relock = phone();
  await enter(relock, '1003', null, newKid.studentCode);
  ok((await post('/api/level-key', { level: 'yct1', key: 'Cielo-2024' }, as(relock))).json.ok && (await enter(phone(), '1003', null, newKid.studentCode)).levelOpen === true,
    '… after typing the new key it is saved on the account again');
  const back = phone();
  ok((await enter(back, '1003', null, oldKid.studentCode)).levelOpen === true && await openBase(back, BASES[0]), '… a grandfathered kid gets it back at the next /homework login (from the account)');
  ok((await post('/api/admin/level-keys/zz9/close-devices', {}, { headers: T(SEED) })).status === 400, 'an unknown level is refused');

  // ── 11. «Desbloquear» ──
  section('«Desbloquear» (teacher)');
  const lateKid = await enter(lateUnlockPh, '1001', 'Late Hsk ' + stamp);
  ok(lateKid.levelOpen === false, 'a new HSK 1 kid: locked');
  ok((await post('/api/admin/student/' + lateKid.studentCode + '/level-access', {}, { headers: T(enni.teacherId) })).status === 403 ||
    (enni.accessCodes || []).includes('1001'), 'a teacher of another class cannot unlock them');
  const un = await post('/api/admin/student/' + lateKid.studentCode + '/level-access', {}, { headers: T(SEED) });
  ok(un.json && un.json.ok && un.json.levelKey.open && un.json.levelKey.via === 'teacher', 'their teacher unlocks them');
  ok((await enter(lateUnlockPh, '1001', null, lateKid.studentCode)).levelOpen === true && await openBase(lateUnlockPh, BASES[2]), '… and La Base HSK 1 opens after their login');

  // ── 12. creating a room ──
  section('hosting needs a teacher device');
  const none = await create(null, { gameType: 'mochi-mash' });
  ok(!none.pin && none.needTeacherKey, 'host:create with no remembered device and no code: refused (needTeacherKey)');
  ok(!(await create(null, { gameType: 'pinata', password: 'nope' })).pin, '… a wrong code: refused');
  ok(!!(await create(null, { gameType: 'pinata', password: SEED })).pin, '… the teacher code (bots, test scripts, the screen\'s first create): a room');
  ok(!!(await create(null, { gameType: 'warmup', password: LEGACY })).pin, '… the legacy password too');
  const tdev = phone();
  ok(((await get('/api/teacher-device', as(tdev))).json || {}).remembered === false, 'a new device is not remembered');
  ok((await post('/api/teacher-device', { code: 'nope' }, as(tdev))).status === 401, 'the teacher screen refuses a wrong code');
  const viaQuery = await post('/api/teacher-device?pw=' + encodeURIComponent(SEED), {}, as(phone()));
  ok(viaQuery.status === 401 && !viaQuery.setCookie.some((c) => c.startsWith('dtd=')), 'a code in the address (?pw=, a link from another site) remembers nothing');
  const rem = await post('/api/teacher-device', { code: SEED.toLowerCase() }, as(tdev));
  ok(rem.json && rem.json.ok && cookieOk(rem.setCookie, 'dtd') && /Max-Age=77\d{5}/.test(rem.setCookie.find((c) => c.startsWith('dtd='))), 'the right code remembers THIS device (httpOnly, 90 days)');
  ok(((await get('/api/teacher-device', as(tdev))).json || {}).remembered === true, '… it is remembered');
  ok(!!(await create(tdev.jar, { gameType: 'mochi-mash' })).pin, '… and creates a room with no code (the cookie rides on the connection)');
  ok(!!(await create(tdev.jar, { gameType: 'hsksim', simId: 'yct1-sim1' })).pin, '… an exam room too');
  const forged = Object.assign({}, tdev.jar, { dtd: tdev.jar.dtd.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) });
  ok(!(await create(forged, {})).pin, 'a tampered teacher cookie creates nothing');
  ok(!(await create(k.jar, {})).pin, 'a level key cookie is not a teacher device');
  const maestro = phone();
  const login = await get('/api/admin/students', as(maestro, { headers: T(SEED) }));
  ok(login.status === 200 && cookieOk(login.setCookie, 'dtd'), 'the /maestro login remembers the device');
  ok(!(await get('/api/admin/students', as(maestro, { headers: T(SEED) }))).setCookie.some((c) => c.startsWith('dtd=')), '… once (the 15-s roster polls set nothing more)');
  ok(!!(await create(maestro.jar, { gameType: 'kingdoms' })).pin, '… so its games open without asking');
  ok(isAudiosPage(await get('/audios/hsk1-base', as(maestro))) && isPlayer(await get(pageOf(simOf('hsk2')[0]), as(maestro))), 'a teacher device opens every level (La Base and sims)');
  ok(((await get('/api/level-access', as(maestro))).json || {}).teacher === true, '/api/level-access: teacher');
  const legacyDev = phone();
  await post('/api/teacher-device', { code: LEGACY }, as(legacyDev));
  ok(!!(await create(legacyDev.jar, {})).pin, 'the legacy password remembers a device too');
  await post('/api/teacher-device/forget', {}, as(maestro));
  ok(!maestro.jar.dtd && !(await create(maestro.jar, {})).pin, '«Log out» in /maestro forgets the device');
  // the turnstile: 10 wrong teacher codes from one address
  const brute = { 'CF-Connecting-IP': '203.0.113.99' };
  for (let i = 0; i < 10; i++) await post('/api/teacher-device', { code: 'WRONG-' + i }, { headers: brute });
  ok((await post('/api/teacher-device', { code: SEED }, { headers: brute })).status === 429, '10 wrong teacher codes from one address → a wait');

  // ── 13. «Cambiar mi código» ──
  section('«Cambiar mi código»');
  const me = phone();
  await get('/api/admin/students', as(me, { headers: T(SEED) }));
  for (const bad of ['abc', '1003', 'ABCDEFGH', '12345678', SEED, enni.teacherId]) {
    const r = await post('/api/admin/my-code', { newCode: bad }, as(me, { headers: T(SEED) }));
    ok(r.status === 400 && r.json && r.json.error && !r.text.includes(SEED), `a new code «${bad === SEED ? '(the same)' : bad === enni.teacherId ? '(another teacher\'s)' : bad}» is refused: ${r.json && r.json.error}`);
  }
  const NEW = 'Dragon-' + rnd(3) + '7';
  const chg = await post('/api/admin/my-code', { newCode: NEW }, as(me, { headers: T(SEED) }));
  ok(chg.json && chg.json.ok && chg.json.teacher.teacherId === NEW.toUpperCase() && cookieOk(chg.setCookie, 'dtd'), 'the super-admin changes their own code (this device stays remembered)');
  ok((await get('/api/admin/students', { headers: T(SEED) })).status === 401, 'the old code stops at once');
  ok((await get('/api/admin/students', { headers: T(NEW) })).status === 200, 'the new code works');
  ok(!(await create(tdev.jar, {})).pin, 'a device remembered with the old code asks again');
  ok(!(await create(null, { password: SEED })).pin, 'the old code creates no room');
  ok(!!(await create(me.jar, {})).pin, 'this device (remembered with the new code) creates rooms');
  // a custom assignment Ms Enni made follows her code change
  const ca = await post('/api/admin/custom-assignment', { title: 'Prueba ' + stamp, items: [{ es: 'hola', expected: 'ni hao' }], targetStudents: [newKid.studentCode] }, { headers: T(enni.teacherId) });
  ok(ca.json && ca.json.ok, 'Ms Enni makes a special assignment');
  const ENNI2 = 'Enni-' + rnd(4) + '9';
  const ce = await put('/api/admin/teachers/' + encodeURIComponent(enni.teacherId) + '/code', { newCode: ENNI2 }, { headers: T(NEW) });
  ok(ce.json && ce.json.ok, 'the super-admin changes another teacher\'s code');
  ok((await put('/api/admin/teachers/' + encodeURIComponent(ENNI2) + '/code', { newCode: 'Other-' + rnd(4) + '1' }, { headers: T(ENNI2) })).status === 403, 'a regular teacher cannot change others\' codes');
  ok((await get('/api/admin/students', { headers: T(enni.teacherId) })).status === 401 && (await get('/api/admin/students', { headers: T(ENNI2) })).status === 200, 'her old code stops, the new one works');
  const mine = (await get('/api/admin/custom-assignments', { headers: T(ENNI2) })).json;
  ok(mine && (mine.assignments || []).some((a) => a.title === 'Prueba ' + stamp), '… her special assignment is still hers');
  ok((await put('/api/admin/teachers/' + encodeURIComponent(ENNI2) + '/code', { newCode: enni.teacherId }, { headers: T(NEW) })).status === 400, 'a retired code can never be taken again');
  ok((await post('/api/admin/my-code', { newCode: 'Back-' + rnd(4) + '1' }, { headers: T(LEGACY) })).status === 400, 'the legacy password has no code to change here (Render)');
  const school = { 'CF-Connecting-IP': '203.0.113.150' };
  for (let i = 0; i < 12; i++) await get('/api/admin/students', { headers: Object.assign({}, school, T(SEED)) });
  const stale = await get('/api/admin/students', { headers: Object.assign({}, school, T(SEED)) });
  ok(stale.status === 401 && stale.json && stale.json.retired, 'an old tab still sending the changed code: «ya se cambió», not counted as a guess');
  ok((await get('/api/admin/students', { headers: Object.assign({}, school, T(NEW)) })).status === 200, '… so the school\'s address is not locked out');
  for (let i = 0; i < 10; i++) await get('/api/admin/students', { headers: Object.assign({}, school, T('WRONG-' + i)) });
  ok((await get('/api/admin/students', { headers: Object.assign({}, school, T(NEW)) })).status === 429, '10 really wrong codes from that address lock it…');
  ok((await get('/api/admin/students', { jar: me.jar, headers: Object.assign({}, school, T(NEW)) })).status === 200, '… except a remembered teacher device (never stranded mid-class)');
  const sug = (await get('/api/admin/teachers/suggest-code', { headers: T(NEW) })).json;
  ok(sug && /^T-[A-Z0-9]{8}$/.test(sug.code), '«nuevo código al azar» offers a code of the usual shape');

  // ── 14. teacher codes never reach a kid's phone ──
  section('teacher codes stay off kids\' phones');
  const sent = await post('/api/admin/student/' + newKid.studentCode + '/message', { text: 'Hola ' + stamp }, { headers: T(NEW) });
  ok(sent.json && sent.json.ok, 'the super-admin sends the kid a message');
  const inbox = await get('/api/homework/inbox?accessCode=1003&studentCode=' + newKid.studentCode);
  ok(inbox.json && inbox.json.inbox.length >= 1 && inbox.json.inbox.every((m) => !('from' in m)) && !inbox.text.includes(ENNI2) && !inbox.text.includes(NEW), 'the inbox carries no teacher code');
  const kidList = await get('/api/homework/custom-assignments/' + newKid.studentCode + '?accessCode=1003');
  ok(kidList.json && kidList.json.assignments.length >= 1 && !kidList.text.includes(ENNI2) && !/teacherId/.test(kidList.text), 'the special-assignment list carries no teacher code');
  const hist = await get('/api/homework/sentences/' + newKid.studentCode + '?accessCode=1003');
  ok(hist.status === 200 && !/editedBy/.test(hist.text), 'saved sentences carry no editor code');
  for (const f of ['public/js/maestro.js', 'public/js/teacher-gate.js', 'protected/pages/level-key.html', 'public/js/audios.js']) {
    ok(!new RegExp(['dra', 'ly20', '26'].join('') + '|' + ['EMA', 'AR'].join(''), 'i').test(fs.readFileSync(path.join(ROOT, f), 'utf8')), `${f}: no teacher code written in it`);
  }
  ok(!/WU_ADMIN_PASSWORD \|\| '[^']/.test(fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8')), 'server.js: the legacy password has no default written in the code');

  // ── 14b. a login with another class's code (class codes are not secret) opens nothing ──
  section('another class\'s code');
  const intruder = phone();
  const wrongClass = await enter(intruder, '1003', null, oldHskKid.studentCode);
  ok(wrongClass.ok && wrongClass.levelOpen === false && !intruder.jar.dsim && !intruder.jar.dlv_hsk1 && !intruder.jar.dlv_yct1,
    'a grandfathered HSK 1 kid\'s code typed with the YCT 1 class code: homework works, but no session and no level');
  ok(isKeyScreen(await get('/audios/hsk1-base', as(intruder)), 'HSK 1') && isKeyScreen(await get('/audios/yct1-base', as(intruder)), 'YCT 1'), '… both bases still ask their key');
  const again = await enter(intruder, '1003', null, oldHskKid.studentCode);   // the code the first login re-tagged
  ok(again.ok && again.levelOpen === false && isKeyScreen(await get('/audios/hsk1-base', as(intruder)), 'HSK 1') && isKeyScreen(await get('/audios/yct1-base', as(intruder)), 'YCT 1'),
    '… and a second login with the class code the first one re-tagged opens nothing either');

  // ── 15. student-code guessing at /homework ──
  section('student-code guessing');
  const sg = { 'CF-Connecting-IP': '203.0.113.123' };
  let last = null;
  for (let i = 0; i < 61; i++) last = await post('/api/homework/enter', { accessCode: '1003', studentCode: 'Z' + String(i).padStart(3, '9').replace(/[01]/g, '9') }, { headers: sg });
  ok(last.status === 429, '60 unknown student codes from one address → a wait');
  ok((await post('/api/homework/enter', { accessCode: '1003', studentCode: oldKid.studentCode }, as(phone()))).json.ok, '… other addresses log in as usual');

  // ── 16. restarts: the new codes stay, the seed never brings the old one back ──
  section('restart');
  await stopServer();
  await startServer();
  ok((await get('/api/admin/students', { headers: T(SEED) })).status === 401, 'after a restart the old super-admin code still fails');
  ok((await get('/api/admin/students', { headers: T(NEW) })).status === 200, '… the new one works');
  ok(((await get('/api/_diag')).json || {}).teachers === 3, '… no account was seeded again');
  ok(((await get('/api/admin/level-keys', { headers: T(NEW) })).json || {}).goLiveAt === goLive, '… the go-live moment is the same');
  ok(await openBase(back, BASES[0]) && !!(await create(me.jar, {})).pin, '… devices stay remembered (keys and teacher)');
  // the teacher file lost: the seed stays off (no known code comes back)
  fs.renameSync(path.join(DATA, 'teachers.json'), path.join(DATA, 'teachers.lost.json'));
  await stopServer();
  await startServer();
  ok(((await get('/api/_diag')).json || {}).teachers === 0, 'teachers.json lost → no account is seeded again (the one-shot flag)');
  ok((await get('/api/admin/students', { headers: T(SEED) })).status === 401, '… so the first seeded code never comes back');
  ok((await get('/api/admin/students', { headers: T(LEGACY) })).status === 200, '… and the legacy password (Render) still lets him in to restore a backup');
  await stopServer();
  fs.renameSync(path.join(DATA, 'teachers.lost.json'), path.join(DATA, 'teachers.json'));
  fs.writeFileSync(path.join(DATA, 'teachers.json'), '{ broken');
  await startServer();
  ok(fs.readdirSync(DATA).some((f) => /^teachers\.unreadable-\d+\.json$/.test(f)), 'an unreadable teachers.json is kept aside, never written over');
  ok(((await get('/api/_diag')).json || {}).teachers === 0, '… and nothing is seeded over it');
}
