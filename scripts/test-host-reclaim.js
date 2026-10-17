#!/usr/bin/env node
// test-host-reclaim.js — a live room's projector goes back only to the teacher who opened it (2026-10-16).
// Before: socket host:reclaim gave any non-exam room to whoever knew its PIN, even while the teacher's projector was
// still connected (found by the code reviews of Monopolio v2 and Vuelo del Dragón v2).
// Starts its OWN server (port 4310, never 3000, never the live site) on a fresh temporary data folder with throw-away
// teacher codes that are never printed, plays every way back in, and stops it. Then loads public/js/teacher-gate.js
// in a small fake page to check that the host pages keep the room's token per tab and send it on reclaim.
//   node scripts/test-host-reclaim.js            (--port 4310 · --keep to leave it running)
// Checks: host:create answers the room's token (32 hex) and never sends it in the room's state; a stranger with the PIN,
// a wrong token, a wrong code or another regular teacher (code or remembered device) is refused while the room and its
// projector stay as they were; the same tab (token), the same teacher in another browser (remembered device or code)
// and a super admin get it back; a room opened from a remembered device belongs to that teacher; exam and warm-up rooms
// keep their own rule (the teacher code, the token alone is not enough); wrong codes count in the turnstile.
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4310));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-reclaim-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);          // WU_ADMIN_PASSWORD of this test server
const SEED = 'T-' + rnd(5);                  // the first-boot super-admin code of this test server
const SECRET = 'test-' + rnd(24);

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const T = (code) => ({ 'X-Admin-Pw': encodeURIComponent(code) });
let ipN = 10;
// a browser: its own cookie jar and its own address (Cloudflare's CF-Connecting-IP), so limits never leak between checks
const browser = () => ({ jar: {}, ip: '198.51.100.' + (ipN++) });
const sock = (b) => {
  const h = { 'CF-Connecting-IP': b.ip };
  if (Object.keys(b.jar).length) h.Cookie = Object.entries(b.jar).map(([k, v]) => k + '=' + v).join('; ');
  return io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true, extraHeaders: h });
};
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});
const remember = (b, code) => post('/api/teacher-device', { code }, { jar: b.jar, headers: { 'CF-Connecting-IP': b.ip } });

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED }),
  });
  srv.stdout.on('data', (d) => { allLog += d; });
  srv.stderr.on('data', (d) => { allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return; } catch (_) {}
  }
  console.error('the server did not start:\n' + allLog.slice(-2000));
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
  const teachers = ((await get('/api/admin/teachers', { headers: T(SEED) })).json || {}).teachers || [];
  const enni = teachers.find((t) => /enni/i.test(t.displayName) && !t.isSuperAdmin);
  ok(enni && enni.teacherId, 'a regular teacher exists (Ms Enni)');
  // a second regular teacher, made through the API like /maestro does
  const made = await post('/api/admin/teachers', { displayName: 'Ms Prueba', email: '', country: 'MX', levels: ['yct1'] }, { headers: T(SEED) });
  const other = made.json && (made.json.teacher || made.json);
  ok(made.status === 200 && other && other.teacherId && other.teacherId !== enni.teacherId && !other.isSuperAdmin, 'a second regular teacher is created');
  const ENNI = enni.teacherId, OTHER = other.teacherId;

  section('a room opened with the teacher code');
  const projector = browser();
  const host = sock(projector);
  const states = [];
  host.on('state', (s) => states.push(JSON.stringify(s)));
  const created = await emitAck(host, 'host:create', { gameType: 'mochi-mash', password: ENNI });
  const pin = created.pin;
  ok(pin && /^[0-9a-f]{32}$/.test(String(created.hostToken || '')), 'host:create answers the PIN and the room\'s token (32 hex)');
  await sleep(300);
  ok(states.length > 0 && states.every((s) => !s.includes(created.hostToken) && !/hostToken|hostOwner/.test(s)), 'the room\'s state never carries its token or owner');

  const stranger = sock(browser());
  const r1 = await emitAck(stranger, 'host:reclaim', { pin });
  ok(r1.ok === false && /^(not-host|host-live)$/.test(r1.error), 'a stranger who knows the PIN cannot take the projector');
  const r2 = await emitAck(stranger, 'host:reclaim', { pin, hostToken: '0'.repeat(32) });
  ok(r2.ok === false, '… nor with a made-up token');
  const r3 = await emitAck(stranger, 'host:reclaim', { pin, hostToken: created.hostToken.slice(0, 31) });
  ok(r3.ok === false, '… nor with a cut token');
  const r4 = await emitAck(stranger, 'host:reclaim', { pin, password: 'WRONG-' + rnd(3) });
  ok(r4.ok === false, '… nor with a wrong code');
  const r5 = await emitAck(stranger, 'host:reclaim', { pin, password: OTHER });
  ok(r5.ok === false, '… nor another regular teacher with her own code');
  const otherDev = browser();
  ok((await remember(otherDev, OTHER)).status === 200, 'the other teacher\'s browser is remembered');
  const otherSock = sock(otherDev);
  const r6 = await emitAck(otherSock, 'host:reclaim', { pin });
  ok(r6.ok === false, '… nor from her remembered device');
  otherSock.close();
  // the teacher's projector is still the host: its own controls still work (the stranger never took it)
  const stillHost = await emitAck(host, 'host:reclaim', { pin, hostToken: created.hostToken });
  ok(stillHost.ok === true && stillHost.gameType === 'mochi-mash' && stillHost.state === 'lobby', 'the teacher\'s projector keeps its room');
  stranger.close();

  section('a connected projector is taken by nothing but its own token');
  const laptop = browser();
  ok((await remember(laptop, ENNI)).status === 200, 'the teacher\'s other browser is remembered');
  const boss = browser();
  await remember(boss, SEED);
  const old1 = sock(laptop), old2 = sock(boss), old3 = sock(browser());
  const h1 = await emitAck(old1, 'host:reclaim', { pin });
  const h2 = await emitAck(old2, 'host:reclaim', { pin });
  const h3 = await emitAck(old3, 'host:reclaim', { pin, password: ENNI });
  ok(h1.ok === false && h1.error === 'host-live', 'the same teacher\'s other browser (an old sleeping tab) cannot take a running projector');
  ok(h2.ok === false && h2.error === 'host-live', '… nor a super admin\'s device');
  ok(h3.ok === false && h3.error === 'host-live', '… nor the same teacher\'s code');
  old1.close(); old2.close(); old3.close();

  section('the teacher gets it back');
  host.close();
  await sleep(250);
  const f5 = sock(projector);                                   // F5 in the same tab: the page brings the token
  const r7 = await emitAck(f5, 'host:reclaim', { pin, hostToken: created.hostToken });
  ok(r7.ok === true && r7.gameType === 'mochi-mash', 'F5 in the same tab (the room\'s token) takes the room back');
  const dup = sock(projector);                                  // a duplicated tab carries the same token
  ok((await emitAck(dup, 'host:reclaim', { pin, hostToken: created.hostToken })).ok === true, 'the room\'s token works even while its projector is connected');
  dup.close(); f5.close();
  await sleep(250);
  const s8 = sock(laptop);
  const r8 = await emitAck(s8, 'host:reclaim', { pin });
  ok(r8.ok === true, 'once the projector is gone, the same teacher\'s remembered device takes it back (another browser)');
  s8.close();
  await sleep(250);
  const s9 = sock(browser());
  const r9 = await emitAck(s9, 'host:reclaim', { pin, password: ENNI.toLowerCase() });
  ok(r9.ok === true, '… and the same teacher\'s code');
  s9.close();
  await sleep(250);
  const s10 = sock(boss);
  const r10 = await emitAck(s10, 'host:reclaim', { pin });
  ok(r10.ok === true, '… and a super admin\'s device (any room)');
  s10.close();
  await sleep(250);

  section('a room opened from a remembered device');
  const s11 = sock(laptop);
  const c2 = await emitAck(s11, 'host:create', { gameType: 'monopoly' });
  ok(c2.pin && c2.hostToken && c2.hostToken !== created.hostToken, 'a remembered device opens a room with its own token');
  const s12 = sock(otherDev);
  ok((await emitAck(s12, 'host:reclaim', { pin: c2.pin })).ok === false, 'another teacher\'s device cannot take it');
  ok((await emitAck(s12, 'host:reclaim', { pin: c2.pin, hostToken: created.hostToken })).ok === false, 'another room\'s token does not open it');
  s11.close();
  await sleep(250);
  ok((await emitAck(s12, 'host:reclaim', { pin: c2.pin })).ok === false, 'another teacher\'s device cannot take it after its projector is gone either');
  s12.close();
  const s13 = sock(browser());
  ok((await emitAck(s13, 'host:reclaim', { pin: c2.pin, password: ENNI })).ok === true, 'its teacher\'s code takes it back');
  s13.close();

  section('exam and warm-up rooms keep their own rule');
  const s14 = sock(browser());
  const exam = await emitAck(s14, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: ENNI });
  ok(exam.pin && exam.hostToken, 'an exam room opens');
  const s15 = sock(browser());
  const e1 = await emitAck(s15, 'host:reclaim', { pin: exam.pin, hostToken: exam.hostToken });
  ok(e1.ok === false && e1.error === 'bad-password', 'an exam room still needs the teacher code (the token alone is not enough)');
  ok((await emitAck(s15, 'host:reclaim', { pin: exam.pin, password: ENNI })).ok === true, '… and comes back with it');
  s15.close(); s14.close();
  const s16 = sock(browser());
  const wu = await emitAck(s16, 'host:create', { gameType: 'warmup', password: ENNI });
  const s17 = sock(browser());
  ok((await emitAck(s17, 'host:reclaim', { pin: wu.pin })).ok === false, 'a warm-up room still needs the teacher code');
  ok((await emitAck(s17, 'host:reclaim', { pin: wu.pin, password: ENNI })).ok === true, '… and comes back with it');
  s17.close(); s16.close();

  section('wrong codes count');
  const brute = browser();
  const s18 = sock(brute);
  for (let i = 0; i < 10; i++) await emitAck(s18, 'host:reclaim', { pin, password: 'WRONG-' + i });
  const after = await emitAck(s18, 'host:create', { gameType: 'mochi-mash', password: ENNI });
  ok(after.needTeacherKey && /Muchos intentos/.test(after.error || ''), 'ten wrong codes on reclaim → the address waits like any wrong code');
  const rightLate = await emitAck(s18, 'host:reclaim', { pin, password: ENNI });
  ok(rightLate.ok === false && rightLate.error === 'wait', '… and reclaim stops reading codes from it too (even a right one)');
  s18.close();
  const brute2 = sock(Object.assign(browser(), { ip: brute.ip }));
  const tokenOk = await emitAck(brute2, 'host:reclaim', { pin: c2.pin, hostToken: c2.hostToken });
  ok(tokenOk.ok === true, 'a projector with its room\'s token is never stopped by its address\'s wrong codes');
  brute2.close();

  section('odd PINs');
  const odd = sock(laptop);
  ok((await emitAck(odd, 'host:reclaim', { pin: '000000' })).error === 'no-game', 'an unknown PIN says so');
  for (const p of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const r = await emitAck(odd, 'host:reclaim', { pin: p, password: ENNI });
    ok(r.ok === false && r.error === 'no-game', `«${p}» is no room`);
  }
  ok((await emitAck(odd, 'host:reclaim', null)).error === 'no-game', 'an empty reclaim is no room');
  odd.close();
  ok(!/TypeError|Cannot read prop/.test(allLog), 'no error in the server log');
}

// ── the host page side: public/js/teacher-gate.js keeps the token per tab and sends it on reclaim ──
async function gateSide() {
  section('teacher-gate.js on a host page');
  const src = fs.readFileSync(path.join(ROOT, 'public', 'js', 'teacher-gate.js'), 'utf8');
  const store = {};
  const sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const sent = [];
  const fakeSocket = () => ({
    emit(ev, ...a) {
      sent.push({ ev, a });
      const cb = a.find((x) => typeof x === 'function');
      if (ev === 'host:create' && cb) cb({ pin: '424242', hostToken: 'ab'.repeat(16) });
      if (ev === 'host:reclaim' && cb) cb({ ok: true });
      return this;
    },
    on() { return this; },
  });
  const fakeIo = function () { return fakeSocket(); };
  const win = {
    io: fakeIo, innerWidth: 1600,
    matchMedia: () => ({ matches: false }),
  };
  const ctx = {
    window: win, sessionStorage, localStorage: { getItem: () => null, removeItem() {} },
    matchMedia: win.matchMedia, setTimeout, clearTimeout, console,
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ remembered: true }) }),
    document: { querySelector: () => null, addEventListener() {}, body: null },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  await sleep(20);
  const page = win.io();                                  // the host page's own io() call goes through the gate
  let got = null;
  page.emit('host:create', { gameType: 'mochi-mash' }, (r) => { got = r; });
  await sleep(20);
  ok(got && got.pin === '424242', 'the page still gets its PIN from host:create');
  ok(store['draly.hostToken.424242'] === 'ab'.repeat(16), 'the room\'s token is kept for this tab (sessionStorage)');
  page.emit('host:reclaim', { pin: '424242' }, () => {});
  const rec = sent.filter((x) => x.ev === 'host:reclaim').pop();
  ok(rec && rec.a[0] && rec.a[0].hostToken === 'ab'.repeat(16) && rec.a[0].pin === '424242', 'host:reclaim carries the token');
  ok(rec && typeof rec.a[1] === 'function', '… and the page\'s callback');
  // an F5: a fresh page in the same tab (the same sessionStorage) still finds it
  const ctx2 = Object.assign({}, ctx, { window: { io: fakeIo, innerWidth: 1600, matchMedia: win.matchMedia } });
  vm.createContext(ctx2);
  vm.runInContext(src, ctx2);
  await sleep(20);
  const page2 = ctx2.window.io();
  page2.emit('host:reclaim', { pin: '424242' }, () => {});
  const rec2 = sent.filter((x) => x.ev === 'host:reclaim').pop();
  ok(rec2 && rec2.a[0].hostToken === 'ab'.repeat(16), 'after an F5 the page still sends the token');
  page2.emit('host:reclaim', { pin: '999999' }, () => {});
  const rec3 = sent.filter((x) => x.ev === 'host:reclaim').pop();
  ok(rec3 && !rec3.a[0].hostToken, 'another room\'s reclaim gets no token');
  page2.emit('host:reclaim', { pin: '424242', password: 'X' }, () => {});
  const rec4 = sent.filter((x) => x.ev === 'host:reclaim').pop();
  ok(rec4 && rec4.a[0].password === 'X' && rec4.a[0].hostToken, 'a code the page sends itself (warm-up, exams) still goes, with the token');

  // a device that is not a teacher's: the key screen comes only with a new room, never over an F5 that takes a room back
  let screens = 0;
  const ctx3 = Object.assign({}, ctx, {
    window: { io: fakeIo, innerWidth: 1600, matchMedia: win.matchMedia },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ remembered: false }) }),
    document: { querySelector: () => null, addEventListener: (ev) => { if (ev === 'DOMContentLoaded') screens++; }, body: null },
  });
  vm.createContext(ctx3);
  vm.runInContext(src, ctx3);
  await sleep(30);
  const page3 = ctx3.window.io();
  page3.emit('host:reclaim', { pin: '424242' }, () => {});
  await sleep(20);
  ok(screens === 0, 'no key screen at load or over a reclaim (an F5 of a running room after a code change)');
  page3.emit('host:create', { gameType: 'mochi-mash' }, () => {});
  await sleep(20);
  ok(screens === 1, 'the key screen comes with a new room');
  ok(sent.filter((x) => x.ev === 'host:create').length === 1, 'and the new room waits for the code (nothing sent yet)');
}

(async () => {
  await startServer();
  let crashed = false;
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  const log = allLog;
  if (!KEEP) await stopServer();
  if (!crashed) ok(!log.includes(SEED) && !log.includes(LEGACY), 'no teacher code in the server log');
  try { await gateSide(); } catch (e) { failed++; console.log('  ✖ gate side crashed: ' + (e && e.stack || e)); }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-host-reclaim: ${failed} FAILED, ${passed} passed` : `test-host-reclaim: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
