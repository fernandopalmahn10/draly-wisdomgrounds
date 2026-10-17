#!/usr/bin/env node
// test-socket-codes.js — every teacher code a live-game socket sends goes through the wrong-code turnstile (2026-10-17).
// Before: the warm-up presets (any socket, no PIN needed), the warm-up and reading teacher tools and the exam / warm-up
// / reading branch of host:reclaim read codes with no turnstile, so a socket could try teacher codes as fast as it liked
// (Cloudflare's rate limit covers only HTTP /api). Found by the code review of the projector lock (4afdc7120).
// Also: a socket handshake from a page on another site (its Origin) is refused.
// Starts its OWN server (port 4320, never 3000, never the live site) on a fresh temporary data folder with throw-away
// teacher codes that are never printed, and stops it.
//   node scripts/test-socket-codes.js            (--port 4320 · --keep to leave it running)
// Checks: wrong codes on the presets, the warm-up / reading / exam reclaim, the host-only tools and host:end count, and
// after 10 the address waits (a right code too, over HTTP as well); empty and retired codes never count; a remembered
// teacher device never waits for its school's address (its own wrong codes count on the device); a connection that
// proved its code, and a room's own projector (its host socket or room token) with its own teacher's code, keep working
// while the address waits, while any other code still waits; only the room's projector gets its code read by the
// host-only tools; a warm-up / reading / exam reclaim reads its code once (the owner check after it, 2026-10-17, counts
// nothing more, and right codes refused by it never count); super-admin tools still need a super-admin code; handshakes from other sites are refused (WebSocket
// and polling), ours and the ones with no Origin (test scripts, bots) are let in. Closing an exam room (host:end, his
// decision 2026-10-17): only its own monitor (room token), the teacher who opened it (remembered device or code) or a
// super admin, always with a teacher check; one code over all 900 PINs closes nothing, an unknown PIN answers like a
// room that is not yours, and the owner survives a restart (a room saved without one closes only for a super admin).
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
const PORT = Number(opt('port', 4320));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-sockcodes-'));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);          // WU_ADMIN_PASSWORD of this test server
const SEED = 'T-' + rnd(5);                  // the first-boot super-admin code of this test server
const SECRET = 'test-' + rnd(24);
const NEWCODE = 'PRUEBA' + (100000 + crypto.randomInt(800000));   // a teacher's new code after «Cambiar mi código»
const CODES = [];                            // the teachers' codes this run sees (never printed; checked against the log)

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
const sock = (b, more) => {
  const h = Object.assign({ 'CF-Connecting-IP': b.ip }, more || {});
  if (Object.keys(b.jar).length) h.Cookie = Object.entries(b.jar).map(([k, v]) => k + '=' + v).join('; ');
  return io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: h });
};
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});
const waitFor = (s, ev, test, ms = 1500) => new Promise((res) => {
  const t = setTimeout(() => { s.off(ev, f); res(null); }, ms);
  const f = (d) => { if (!test || test(d)) { clearTimeout(t); s.off(ev, f); res(d || {}); } };
  s.on(ev, f);
});
const remember = (b, code) => post('/api/teacher-device', { code }, { jar: b.jar, headers: { 'CF-Connecting-IP': b.ip } });
const WAIT = 'demasiados intentos';
// ten wrong codes from this browser's address (each one a real guess)
async function fillUp(b, ev = 'wu:presets-list') {
  const s = sock(b);
  for (let i = 0; i < 10; i++) await emitAck(s, ev, { password: 'WRONG-' + rnd(3) });
  s.close();
}

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
  const made = await post('/api/admin/teachers', { displayName: 'Ms Prueba', email: '', country: 'MX', levels: ['yct1'] }, { headers: T(SEED) });
  const other = made.json && (made.json.teacher || made.json);
  ok(made.status === 200 && other && other.teacherId && !other.isSuperAdmin, 'a second regular teacher is created');
  const ENNI = enni.teacherId, OTHER = other.teacherId;
  CODES.push(ENNI, OTHER);

  section('the warm-up presets need a code, and wrong ones count');
  const b1 = browser();
  const s1 = sock(b1);
  const p0 = await emitAck(s1, 'wu:presets-list', { password: 'WRONG-' + rnd(3) });
  ok(p0.ok === false && p0.error === 'bad password', 'a wrong code gets no presets');
  const p1 = await emitAck(s1, 'wu:presets-list', { password: ENNI });
  ok(p1.ok === true && Array.isArray(p1.presets), 'a teacher code lists them (no room needed)');
  const saved = await emitAck(s1, 'wu:presets-save', { password: ENNI, name: 'Prueba', sentence: ['ni', 'hao'] });
  ok(saved.ok === true && saved.preset && saved.preset.id, '… saves one');
  ok((await emitAck(s1, 'wu:presets-delete', { password: ENNI, id: saved.preset.id })).ok === true, '… and deletes it');
  const s2 = sock(b1);
  for (let i = 0; i < 4; i++) await emitAck(s2, 'wu:presets-list', { password: 'WRONG-' + i });
  for (let i = 0; i < 3; i++) await emitAck(s2, 'wu:presets-save', { password: 'WRONG-S' + i, name: 'x', sentence: ['a'] });
  for (let i = 0; i < 3; i++) await emitAck(s2, 'wu:presets-delete', { password: 'WRONG-D' + i, id: 'x' });
  const s3 = sock(b1);
  const late = await emitAck(s3, 'wu:presets-list', { password: ENNI });
  ok(late.ok === false && late.error === WAIT, 'ten wrong codes across list / save / delete → the address waits, even with a right code');
  ok((await emitAck(s3, 'wu:presets-save', { password: ENNI, name: 'x', sentence: ['a'] })).error === WAIT, '… for saving too');
  const create = await emitAck(s3, 'host:create', { gameType: 'mochi-mash', password: ENNI });
  ok(create.needTeacherKey && /Muchos intentos/.test(create.error || ''), '… and for opening a room (one turnstile)');
  const viaHttp = await get('/api/admin/teachers', { headers: Object.assign(T(ENNI), { 'CF-Connecting-IP': b1.ip }) });
  ok(viaHttp.status === 429, '… and over HTTP (/maestro) as well');
  ok((await emitAck(s1, 'wu:presets-list', { password: ENNI })).ok === true, 'a connection that already proved its code keeps working while its address waits');
  ok((await emitAck(s1, 'wu:presets-list', { password: SEED })).error === WAIT, '… but no other code is read from it (a right one included)');
  s1.close(); s2.close(); s3.close();

  section('empty and retired codes never count');
  const b2 = browser();
  const s4 = sock(b2);
  for (let i = 0; i < 25; i++) await emitAck(s4, 'wu:presets-list', i % 3 === 0 ? {} : { password: i % 3 === 1 ? '' : '   ' });
  ok((await emitAck(sock(b2), 'wu:presets-list', { password: ENNI })).ok === true, '25 tries with no code leave the address free');
  const bHuge = browser();
  const sHuge = sock(bHuge);
  const huge = await emitAck(sHuge, 'wu:presets-list', { password: 'X'.repeat(1e6) });
  ok(huge.ok === false && huge.error === 'bad password', 'a megabyte «code» is just a wrong code');
  for (let i = 0; i < 9; i++) await emitAck(sHuge, 'wu:presets-list', { password: 'Y'.repeat(600 + i) });
  ok((await emitAck(sock(bHuge), 'wu:presets-list', { password: ENNI })).error === WAIT, '… and long ones count like any wrong code');
  sHuge.close();
  const retiring = await post('/api/admin/teachers', { displayName: 'Ms Cambio', email: '', country: 'MX', levels: ['yct1'] }, { headers: T(SEED) });
  const OLD = retiring.json && (retiring.json.teacher || retiring.json).teacherId;
  CODES.push(OLD);
  const changed = await req('PUT', '/api/admin/teachers/' + encodeURIComponent(OLD) + '/code', { body: { newCode: NEWCODE }, headers: T(SEED) });
  ok(changed.status === 200, 'a teacher changes her code («Cambiar mi código»)');
  for (let i = 0; i < 12; i++) {
    const r = await emitAck(s4, i % 2 ? 'wu:presets-list' : 'wu:presets-save', { password: OLD, name: 'x', sentence: ['a'] });
    if (i === 0) ok(r.ok === false && r.error === 'bad password', 'the old (retired) code is refused');
  }
  ok((await emitAck(sock(b2), 'wu:presets-list', { password: ENNI })).ok === true, '… but 12 tries with it never make the address wait (old tabs keep sending it)');
  ok((await emitAck(sock(b2), 'wu:presets-list', { password: NEWCODE })).ok === true, 'her new code works');
  s4.close();

  section('a remembered teacher device never waits for its school\'s address');
  const school = browser();
  const dev = { jar: {}, ip: school.ip };
  ok((await remember(dev, ENNI)).status === 200, 'the teacher\'s laptop at school is remembered');
  await fillUp(school);                                           // a kid's phone on the same Wi-Fi tries codes
  ok((await emitAck(sock(school), 'wu:presets-list', { password: ENNI })).error === WAIT, 'the school\'s address waits after a phone\'s ten wrong codes');
  const d1 = sock(dev);
  ok((await emitAck(d1, 'wu:presets-list', { password: ENNI })).ok === true, 'the teacher\'s remembered laptop still gets in with her code');
  const dRoom = await emitAck(d1, 'host:create', { gameType: 'warmup' });
  ok(dRoom.pin && dRoom.hostToken, '… and still opens a room');
  d1.close();
  const dev2 = browser();
  await sleep(1100);   // (a device cookie carries its time in seconds: two laptops of one teacher, two cookies)
  ok((await remember(dev2, ENNI)).status === 200, 'another laptop of the same teacher is remembered');
  await fillUp(dev2);                                              // its own ten wrong codes (cookie on the socket)
  ok((await emitAck(sock(dev2), 'wu:presets-list', { password: ENNI })).error === WAIT, 'a remembered device\'s own ten wrong codes make that device wait (it can\'t try codes without limit)');
  ok((await emitAck(sock({ jar: {}, ip: dev2.ip }), 'wu:presets-list', { password: ENNI })).ok === true, '… on the device, not its address (another phone there is not stopped)');
  const dStill = await emitAck(sock(dev2), 'host:create', { gameType: 'mochi-mash' });
  ok(dStill.pin, '… and the device still opens rooms (that needs no code)');
  const ok2 = (r) => r.status === 200 || r.status === 403;   // (the code was accepted; 403 = not a super-admin page)
  const h1 = await get('/api/admin/teachers', { jar: dev2.jar, headers: Object.assign(T(ENNI), { 'CF-Connecting-IP': dev2.ip }) });
  ok(h1.status === 429, 'over HTTP the device waits too (/maestro: one count per device, sockets and HTTP together)');
  const h2 = await get('/api/admin/teachers', { jar: dev.jar, headers: Object.assign(T(ENNI), { 'CF-Connecting-IP': school.ip }) });
  ok(ok2(h2), 'her laptop at school still opens /maestro (the school\'s address and her other laptop\'s typos don\'t stop it)');
  const dev3 = browser();
  await sleep(1100);
  ok((await remember(dev3, ENNI)).status === 200, 'a third laptop of hers is remembered');
  for (let i = 0; i < 10; i++) await get('/api/admin/teachers', { jar: dev3.jar, headers: Object.assign(T('WRONG-' + i), { 'CF-Connecting-IP': dev3.ip }) });
  ok((await get('/api/admin/teachers', { jar: dev3.jar, headers: Object.assign(T(ENNI), { 'CF-Connecting-IP': dev3.ip }) })).status === 429,
    'ten wrong codes over HTTP from a remembered device → it waits (it used to try codes without limit)');
  ok(ok2(await get('/api/admin/teachers', { headers: Object.assign(T(ENNI), { 'CF-Connecting-IP': dev3.ip }) })), '… while another phone at its address is not stopped');
  ok((await emitAck(sock(dev3), 'wu:presets-list', { password: ENNI })).error === WAIT, '… and its sockets wait too');
  // a fresh device cookie is one right code away: all of a teacher's devices together get 30 wrong codes, then wait
  const lapT = await post('/api/admin/teachers', { displayName: 'Ms Portátil', email: '', country: 'MX', levels: ['yct1'] }, { headers: T(SEED) });
  const LAP = lapT.json && (lapT.json.teacher || lapT.json).teacherId;
  CODES.push(LAP);
  for (let round = 0; round < 3; round++) {
    const l = browser();
    await sleep(1100);
    ok((await remember(l, LAP)).status === 200, `a teacher remembers a fresh device with her own code (${round + 1})`);
    await fillUp(l);
  }
  const l4 = browser();
  await sleep(1100);
  ok((await remember(l4, LAP)).status === 200, '… and a 4th one after 30 wrong codes from her devices');
  ok((await emitAck(sock(l4), 'wu:presets-list', { password: LAP })).error === WAIT, 'after 30 wrong codes from her devices, even a fresh device waits (no endless guessing by new cookies)');
  ok((await get('/api/admin/teachers', { jar: l4.jar, headers: Object.assign(T(LAP), { 'CF-Connecting-IP': l4.ip }) })).status === 429, '… over HTTP too');
  ok(ok2(await get('/api/admin/teachers', { headers: Object.assign(T(ENNI), { 'CF-Connecting-IP': browser().ip }) })), 'another teacher is not stopped by it');

  section('taking back a warm-up, reading or exam projector: wrong codes count');
  for (const type of ['warmup', 'reading', 'hsksim']) {
    const proj = browser();
    const ps = sock(proj);
    const room = await emitAck(ps, 'host:create', { gameType: type, simId: 'yct1-sim1', password: ENNI });
    ok(room.pin && room.hostToken, `a ${type} room opens`);
    const att = browser();
    const as = sock(att);
    let allBad = true;
    for (let i = 0; i < 10; i++) {
      const r = await emitAck(as, 'host:reclaim', { pin: room.pin, password: 'WRONG-' + rnd(3) });
      if (!(r.ok === false && r.error === 'bad-password')) allBad = false;
    }
    ok(allBad, `${type}: ten wrong codes are refused`);
    const right = await emitAck(as, 'host:reclaim', { pin: room.pin, password: ENNI });
    ok(right.ok === false && right.error === 'wait', `${type}: … then the address waits, even with the right code (it used to be read without limit)`);
    as.close();
    const back = sock({ jar: {}, ip: att.ip });                     // the room's own projector, on that same school Wi-Fi
    const r1 = await emitAck(back, 'host:reclaim', { pin: room.pin, hostToken: room.hostToken, password: OTHER });
    ok(r1.ok === false && r1.error === 'wait', `${type}: the room's token with another teacher's code still waits (no way to test codes)`);
    const r2 = await emitAck(back, 'host:reclaim', { pin: room.pin, hostToken: room.hostToken, password: 'WRONG-' + rnd(3) });
    ok(r2.ok === false && r2.error === 'wait', `${type}: … and with a wrong code`);
    const r3 = await emitAck(back, 'host:reclaim', { pin: room.pin, hostToken: room.hostToken, password: ENNI });
    ok(r3.ok === true && r3.gameType === type, `${type}: the room's own projector (its token + its teacher's code) gets it back while the address waits`);
    ps.close(); back.close();
  }
  const fresh = sock(browser());
  const wr = await emitAck(fresh, 'host:create', { gameType: 'warmup', password: ENNI });
  const r4 = await emitAck(sock(browser()), 'host:reclaim', { pin: wr.pin, hostToken: wr.hostToken });
  ok(r4.ok === false && r4.error === 'bad-password', 'a warm-up room still needs the teacher code (the token alone is not enough)');
  fresh.close();
  // a room token (stolen, or an old tab) can't be used to try codes either: its misses count for that teacher
  const tp = sock(browser());
  const tr = await emitAck(tp, 'host:create', { gameType: 'warmup', password: OTHER });
  const tb = browser();
  await fillUp(tb);
  const ts = sock(tb);
  for (let i = 0; i < 10; i++) await emitAck(ts, 'host:reclaim', { pin: tr.pin, hostToken: tr.hostToken, password: 'WRONG-' + i });
  const t10 = await emitAck(ts, 'host:reclaim', { pin: tr.pin, hostToken: tr.hostToken, password: OTHER });
  ok(t10.ok === false && t10.error === 'wait', 'ten wrong codes with a room\'s token → even its teacher\'s code waits there (a token can\'t test codes)');
  ok((await emitAck(sock(browser()), 'host:reclaim', { pin: tr.pin, hostToken: tr.hostToken, password: OTHER })).ok === true,
    '… from an address that is not waiting, the room comes back as always');
  tp.close(); ts.close();

  section('a taken-over projector can\'t test the opener\'s code');
  const opener = sock(browser());
  const ow = await emitAck(opener, 'host:create', { gameType: 'warmup', password: ENNI });
  const tk = browser();
  const taker = sock(tk);
  const busy = await emitAck(taker, 'host:reclaim', { pin: ow.pin, password: SEED });
  ok(busy.ok === false && busy.error === 'host-live', 'nobody takes a running warm-up projector with a code, not even a super admin (2026-10-17)');
  opener.close();
  await sleep(250);
  ok((await emitAck(taker, 'host:reclaim', { pin: ow.pin, password: OTHER })).error === 'no-game', 'once it is off, another regular teacher\'s code still does not take it (to her the PIN is empty)');
  ok((await emitAck(taker, 'host:reclaim', { pin: ow.pin, password: SEED })).ok === true, '… a super admin does');
  await fillUp(tk);
  let none = true;
  for (const pw of [ENNI, 'WRONG-' + rnd(3), ENNI]) {
    const r = await emitAck(taker, 'wu:auth', { pin: ow.pin, password: pw });
    if (!(r.ok === false && r.wait === true && !r.isSuperAdmin)) none = false;
  }
  ok(none, 'with the taker\'s address waiting, the opener\'s code and wrong ones answer the same «wait» (being the host is no proof)');
  ok((await emitAck(taker, 'wu:presets-list', { pin: ow.pin, password: ENNI })).error === WAIT, '… on the presets too');
  ok((await emitAck(taker, 'wu:auth', { pin: ow.pin, password: SEED })).ok === true, '… while the taker\'s own code (proved on this connection) still works');
  taker.close();

  section('the owner check after the code reads nothing twice');
  const ob = browser();
  const oProj = sock(browser());
  const oRoom = await emitAck(oProj, 'host:create', { gameType: 'warmup', password: ENNI });
  const os1 = sock(ob);
  let refused = true;
  for (let i = 0; i < 12; i++) {
    const r = await emitAck(os1, 'host:reclaim', { pin: oRoom.pin, password: i % 2 ? OTHER : SEED });
    if (!(r.ok === false && r.error === (i % 2 ? 'no-game' : 'host-live'))) refused = false;
  }
  ok(refused, '12 right codes on a running warm-up projector are refused («host-live» to a super admin, «no-game» to a colleague)');
  ok((await emitAck(sock({ jar: {}, ip: ob.ip }), 'wu:presets-list', { password: ENNI })).ok === true, '… and never counted as wrong ones');
  for (let i = 0; i < 5; i++) await emitAck(os1, 'host:reclaim', { pin: oRoom.pin, password: 'WRONG-R' + i });
  const os2 = sock({ jar: {}, ip: ob.ip });
  for (let i = 0; i < 4; i++) await emitAck(os2, 'wu:presets-list', { password: 'WRONG-P' + i });
  ok((await emitAck(sock({ jar: {}, ip: ob.ip }), 'wu:presets-list', { password: ENNI })).ok === true, 'a wrong code on reclaim counts once (5 + 4 = 9: the address still gets in)');
  await emitAck(os2, 'wu:presets-list', { password: 'WRONG-P9' });
  ok((await emitAck(sock({ jar: {}, ip: ob.ip }), 'wu:presets-list', { password: ENNI })).error === WAIT, '… and the 10th makes it wait');
  os1.close(); os2.close(); oProj.close();

  section('host-only tools read only the room\'s own projector\'s code');
  const q = browser();
  const host = sock(q);
  const wu = await emitAck(host, 'host:create', { gameType: 'warmup', password: ENNI });
  const a1 = await emitAck(host, 'wu:auth', { pin: wu.pin, password: ENNI });
  ok(a1.ok === true && a1.isSuperAdmin === false, 'the warm-up projector unlocks with a regular teacher code (not super admin)');
  const kid = sock({ jar: {}, ip: q.ip });
  const joined = await emitAck(kid, 'player:join', { pin: wu.pin, name: 'Nina' });
  ok(joined.ok === true, 'a kid joins the warm-up');
  let kidAll = true;
  const kidFx = waitFor(kid, 'wu:fx', null, 1500);
  for (let i = 0; i < 15; i++) {
    const r = await emitAck(kid, 'wu:auth', { pin: wu.pin, password: 'WRONG-' + i });
    if (r.ok !== false) kidAll = false;
    kid.emit('wu:fx', { pin: wu.pin, password: 'WRONG-F' + i, kind: 'confetti' });
    kid.emit('wu:prompt-set', { pin: wu.pin, password: 'WRONG-P' + i, text: 'x' });
  }
  ok(kidAll, 'a kid\'s phone cannot unlock the teacher tools');
  ok(!(await kidFx), '… nor fire the effects');
  ok((await emitAck(sock({ jar: {}, ip: q.ip }), 'wu:presets-list', { password: ENNI })).ok === true, '… and its codes are never read, so they never make the school\'s address wait');
  await fillUp(q);                                                // now the school's address fills up
  ok((await emitAck(sock({ jar: {}, ip: q.ip }), 'wu:presets-list', { password: ENNI })).error === WAIT, 'the school\'s address waits');
  const a2 = await emitAck(host, 'wu:auth', { pin: wu.pin, password: ENNI });
  ok(a2.ok === true, 'the running warm-up projector keeps working while its address waits (never frozen mid-class)');
  const fx = waitFor(host, 'wu:fx', (d) => d && d.kind === 'confetti');
  host.emit('wu:fx', { pin: wu.pin, password: ENNI, kind: 'confetti' });
  ok(!!(await fx), '… its tools still act (confetti on every phone)');
  const a3 = await emitAck(host, 'wu:auth', { pin: wu.pin, password: SEED });
  ok(a3.ok === false && a3.wait === true && !a3.isSuperAdmin, '… but it can\'t try another code while the address waits (not even a right one)');
  kid.close(); host.close();

  const boss = sock(browser());
  const bw = await emitAck(boss, 'host:create', { gameType: 'warmup', password: SEED });
  const a4 = await emitAck(boss, 'wu:auth', { pin: bw.pin, password: SEED });
  ok(a4.ok === true && a4.isSuperAdmin === true, 'a super-admin code unlocks the super tools');
  const said = waitFor(boss, 'wu:prompt', (d) => d && d.text === 'Hola');
  boss.emit('wu:prompt-set', { pin: bw.pin, password: SEED, text: 'Hola' });
  ok(!!(await said), '… and broadcasts the Spanish prompt');
  boss.close();
  const plain = sock(browser());
  const pw2 = await emitAck(plain, 'host:create', { gameType: 'warmup', password: ENNI });
  const notSaid = waitFor(plain, 'wu:prompt', null, 600);
  plain.emit('wu:prompt-set', { pin: pw2.pin, password: ENNI, text: 'Hola' });
  ok(!(await notSaid), 'a regular teacher\'s code does not broadcast it');
  plain.close();

  const rp = browser();
  const rh = sock(rp);
  const rd = await emitAck(rh, 'host:create', { gameType: 'reading', password: ENNI });
  ok((await emitAck(rh, 'rd:auth', { pin: rd.pin, password: ENNI })).ok === true, 'the reading projector unlocks with the teacher code');
  ok((await emitAck(rh, 'rd:auth', { pin: rd.pin, password: 'WRONG-' + rnd(3) })).ok === false, '… not with a wrong one');
  const rk = sock({ jar: {}, ip: rp.ip });
  for (let i = 0; i < 12; i++) await emitAck(rk, 'rd:auth', { pin: rd.pin, password: 'WRONG-' + i });
  ok((await emitAck(sock({ jar: {}, ip: rp.ip }), 'wu:presets-list', { password: ENNI })).ok === true, 'a phone\'s rd:auth codes are never read');
  for (let i = 0; i < 9; i++) await emitAck(rh, 'rd:auth', { pin: rd.pin, password: 'WRONG-H' + i });
  const rw = await emitAck(sock({ jar: {}, ip: rp.ip }), 'wu:presets-list', { password: ENNI });
  ok(rw.error === WAIT, 'the projector\'s own wrong codes count (1 + 9 → the address waits)');
  ok((await emitAck(rh, 'rd:auth', { pin: rd.pin, password: ENNI })).ok === true, '… while its own teacher\'s code still works');
  rh.close(); rk.close();

  section('closing an exam room (host:end): its own monitor, its teacher or a super admin (his decision 2026-10-17)');
  const look = browser();
  const isOpen = async (p) => (await get('/api/hsk-sim/room/' + p, { headers: { 'CF-Connecting-IP': look.ip } })).status === 200;
  const examBy = async (code) => {
    const s = sock(browser());
    return Object.assign({ s }, await emitAck(s, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: code }));
  };
  const ep = sock(browser());
  const ex = await emitAck(ep, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: ENNI });
  ok(ex.pin && ex.hostToken, 'Ms Enni opens an exam room');
  const ekid = sock(browser());
  let kicked = 0;
  ekid.on('host-left', () => { kicked++; });
  const kj = await emitAck(ekid, 'player:join', { pin: ex.pin, name: 'Exam Kid', studentCode: '' });
  ok(kj && kj.ok, 'a kid joins it');
  const kidEnd = await emitAck(ekid, 'host:end', { pin: ex.pin });
  ok(kidEnd.ok === false && kidEnd.error === 'not-teacher', 'a kid\'s phone in the room closes nothing (no teacher code)');
  ok((await emitAck(ekid, 'host:end', { pin: '0000' })).error === 'not-teacher', '… and an unknown PIN answers the same (host:end tells nobody which PINs are exams)');
  const tokOnly = await emitAck(sock(browser()), 'host:end', { pin: ex.pin, hostToken: ex.hostToken });
  ok(tokOnly.ok === false && tokOnly.error === 'not-teacher', 'the room\'s token alone (no teacher) closes nothing');
  const oth = sock(browser());
  ok((await emitAck(oth, 'host:end', { pin: ex.pin, password: OTHER })).error === 'not-owner', 'another teacher\'s code does not close it (it used to)');
  ok((await emitAck(oth, 'host:end', { pin: '0000', password: OTHER })).error === 'not-owner', '… and to her an unknown PIN looks the same');
  const owr = await emitAck(sock(browser()), 'host:create', { gameType: 'warmup', password: OTHER });
  ok(owr.pin && (await emitAck(oth, 'host:end', { pin: owr.pin, password: OTHER })).ok === false, '… nor her own warm-up room (host:end closes exam rooms only)');
  oth.close();
  const sweep = sock(browser());
  const answers = new Set();
  for (let p = 100; p <= 999; p++) answers.add((await emitAck(sweep, 'host:end', { pin: String(p), password: OTHER })).error || 'closed');
  sweep.close();
  ok(answers.size === 1 && answers.has('not-owner'), 'one teacher code tried over all 900 PINs closes no exam (one answer for every PIN)');
  ok(await isOpen(ex.pin) && kicked === 0, '… Ms Enni\'s exam still runs and its kids never saw «host-left»');
  const oLap = browser();
  ok((await remember(oLap, OTHER)).status === 200, 'Ms Prueba\'s laptop is remembered');
  const ol = sock(oLap);
  ok((await emitAck(ol, 'host:end', { pin: ex.pin })).error === 'not-owner', '… and closes none of Ms Enni\'s exams (a remembered teacher device used to close any)');
  ok((await emitAck(ol, 'host:end', { pin: ex.pin, password: OTHER })).error === 'not-owner', '… not with her code either');
  ol.close();
  ok(await isOpen(ex.pin) && kicked === 0, 'the exam still runs');
  const e2 = await examBy(ENNI);
  const eLap = browser();
  ok((await remember(eLap, ENNI)).status === 200, 'Ms Enni\'s other laptop is remembered');
  ok((await emitAck(sock(eLap), 'host:end', { pin: e2.pin })).ok === true && !(await isOpen(e2.pin)), 'the teacher who opened an exam closes it from her remembered laptop (no code needed)');
  const e3 = await examBy(ENNI);
  ok((await emitAck(sock(browser()), 'host:end', { pin: e3.pin, password: ENNI })).ok === true && !(await isOpen(e3.pin)), '… or with her code from any browser (a monitor that reconnected)');
  const e4 = await examBy(ENNI);
  ok((await emitAck(sock(browser()), 'host:end', { pin: e4.pin, password: SEED })).ok === true && !(await isOpen(e4.pin)), 'a super admin closes any exam room');
  const e5 = await examBy(ENNI);
  ok((await emitAck(e5.s, 'host:end', { pin: e5.pin, hostToken: e5.hostToken, password: OTHER })).ok === true && !(await isOpen(e5.pin)),
    'its own monitor (the room token) closes it with any teacher\'s code (a shared laptop whose saved code changed)');
  [e2, e3, e4, e5].forEach((e) => e.s.close());
  const eb = browser();
  const es = sock(eb);
  for (let i = 0; i < 10; i++) await emitAck(es, 'host:end', { pin: ex.pin, password: 'WRONG-' + i });
  const e1 = await emitAck(es, 'host:end', { pin: ex.pin, password: ENNI });
  ok(e1.ok === false && e1.error === WAIT, 'ten wrong codes → the address waits for host:end too');
  const ep3 = sock({ jar: {}, ip: eb.ip });
  ok((await emitAck(ep3, 'host:end', { pin: ex.pin, hostToken: ex.hostToken, password: OTHER })).error === WAIT, 'the room\'s token with another teacher\'s code waits there (no way to test codes)');
  ep3.close();
  const ep2 = sock({ jar: {}, ip: eb.ip });
  const back2 = await emitAck(ep2, 'host:reclaim', { pin: ex.pin, hostToken: ex.hostToken, password: ENNI });
  ok(back2.ok === true, 'the exam\'s own projector moves to that school Wi-Fi');
  ok(await isOpen(ex.pin) && kicked === 0, 'the exam survived every refused close');
  const left = waitFor(ekid, 'host-left', null, 2000);
  ok((await emitAck(ep2, 'host:end', { pin: ex.pin, password: ENNI, hostToken: ex.hostToken })).ok === true, '… and its monitor closes its room with its teacher\'s code while the address waits');
  ok(!!(await left) && kicked === 1 && !(await isOpen(ex.pin)), 'only that real close sends its kids «host-left»');
  ep.close(); es.close(); ep2.close(); ekid.close();

  section('sockets only from the platform\'s own pages');
  const tryWs = (origin) => new Promise((res) => {
    const h = { 'CF-Connecting-IP': browser().ip };
    if (origin !== undefined) h.Origin = origin;
    const s = io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true, reconnection: false, timeout: 4000, extraHeaders: h });
    const done = (v) => { s.close(); res(v); };
    s.on('connect', () => done('in'));
    s.on('connect_error', () => done('refused'));
  });
  const tryPoll = (origin, more, q = '') => get('/socket.io/?EIO=4&transport=polling' + q, { headers: Object.assign({ 'CF-Connecting-IP': browser().ip }, origin === undefined ? {} : { Origin: origin }, more || {}) })
    .then((r) => (r.status === 200 && /^0\{|^___eio\[/.test(r.text) ? 'in' : r.status === 403 ? 'refused' : 'odd ' + r.status));
  const ours = ['https://app.dralingo.app', 'https://dralingo.app', 'https://www.dralingo.app', 'https://draly-wisdomgrounds-2.onrender.com',
    'http://localhost:3000', 'http://127.0.0.1:' + PORT, 'http://[::1]:5500', 'HTTPS://APP.DRALINGO.APP'];
  for (const o of ours) ok((await tryWs(o)) === 'in', `a page on ${o} connects`);
  ok((await tryWs(undefined)) === 'in', 'a connection with no Origin (test scripts, bots) connects');
  const theirs = ['https://evil.example', 'https://app.dralingo.app.evil.example', 'https://dralingo.app.evil.example', 'http://evil.example:' + PORT,
    'https://evil.example/app.dralingo.app', 'https://app.dralingo.app@evil.example', 'https://app.dralingo.app.', 'https://xn--app-dralingo-9db.example',
    'null', 'file://', 'chrome-extension://abcdefgh', 'not a url'];
  for (const o of theirs) ok((await tryWs(o)) === 'refused', `a page on «${o}» is refused (WebSocket)`);
  ok((await tryPoll('https://evil.example')) === 'refused', 'a page on another site is refused (polling)');
  ok((await tryPoll('https://app.dralingo.app')) === 'in', 'ours is let in (polling)');
  ok((await tryPoll(undefined)) === 'in', 'no Origin is let in (polling, e.g. a same-origin request)');
  ok((await tryPoll(undefined, { 'Sec-Fetch-Site': 'same-origin' })) === 'in', '… a browser\'s own same-origin request too');
  ok((await tryPoll(undefined, { 'Sec-Fetch-Site': 'cross-site' })) === 'refused', 'a request the browser marks cross-site is refused even with no Origin');
  ok((await tryPoll(undefined, null, '&j=0')) === 'refused', 'JSONP polling (a <script> tag on another site sends no Origin) is refused');
  ok((await tryPoll(undefined, null, '&%6A=0')) === 'refused', '… also with its name written %6A');
  ok((await get('/health', { headers: { Origin: 'https://evil.example' } })).status === 200, 'web pages and the API are not touched by it');
  await sleep(200);
  const refusedLines = allLog.split('\n').filter((l) => l.includes('socket refused') && l.includes('"https://evil.example"'));
  ok(refusedLines.length === 1, 'a refused site is written to the log once (not once per try)');

  section('closing an exam room after a restart (its owner on the data disk)');
  const rs = await examBy(ENNI);
  rs.s.close();
  await sleep(250);
  await stopServer();
  const roomsFile = path.join(DATA, 'hsk-rooms.json');
  const disk = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));
  ok(disk[rs.pin] && disk[rs.pin].owner, 'the exam room is on the data disk with its owner');
  disk['7777'] = { pin: '7777', simId: 'yct1-sim1', createdAt: Date.now(), fx: null };   // a room saved before 2026-10-17
  fs.writeFileSync(roomsFile, JSON.stringify(disk));
  await startServer();
  // (no lookup first: host:end reads the owner of a room not loaded yet straight from hsk-rooms.json)
  ok((await emitAck(sock(browser()), 'host:end', { pin: rs.pin, password: OTHER })).error === 'not-owner', 'after a restart another teacher still cannot close it');
  ok((await emitAck(sock(browser()), 'host:end', { pin: rs.pin, password: ENNI })).ok === true && !(await isOpen(rs.pin)), '… its teacher can');
  ok((await emitAck(sock(browser()), 'host:end', { pin: '7777', password: ENNI })).error === 'not-owner', 'an exam room with no owner on record closes for no regular teacher');
  ok(await isOpen('7777') && (await emitAck(sock(browser()), 'host:end', { pin: '7777', password: SEED })).ok === true && !(await isOpen('7777')),
    '… only for a super admin');

  ok(!/TypeError|Cannot read prop/.test(allLog), 'no error in the server log');
}

// ── as on Render (RENDER set): pages on localhost are not the platform's there ──
async function renderSide() {
  section('on Render, localhost pages are not ours');
  const port = PORT + 1;
  const data2 = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-sockcodes-r-'));
  const s2 = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: 'ignore',
    env: Object.assign({}, process.env, { PORT: String(port), RENDER: '1', DRALY_DATA_DIR: data2, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED }),
  });
  const hs = (origin) => new Promise((res) => {
    const r = http.get({ host: '127.0.0.1', port, path: '/socket.io/?EIO=4&transport=polling', headers: origin ? { Origin: origin } : {} }, (x) => { x.resume(); res(x.statusCode); });
    r.on('error', () => res(0));
  });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(400); up = (await hs()) === 200; }
  ok(up, 'a server with RENDER set starts');
  ok((await hs('http://localhost:3000')) === 403, 'a page on localhost is refused there');
  ok((await hs('http://127.0.0.1:5500')) === 403, '… and on 127.0.0.1');
  ok((await hs('https://app.dralingo.app')) === 200, 'app.dralingo.app is let in');
  ok((await hs('http://127.0.0.1:' + port)) === 200, 'the address it was reached at is let in (same origin)');
  const gone = new Promise((r) => s2.once('exit', r));
  s2.kill();
  await gone;
  try { fs.rmSync(data2, { recursive: true, force: true }); } catch (_) {}
}

(async () => {
  await startServer();
  let crashed = false;
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  const log = allLog;
  if (!KEEP) await stopServer();
  try { await renderSide(); } catch (e) { failed++; console.log('  ✖ render side crashed: ' + (e && e.stack || e)); }
  if (!crashed) ok(CODES.concat(SEED, LEGACY, NEWCODE).every((c) => c && !log.includes(c)), 'no teacher code in the server log');
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-socket-codes: ${failed} FAILED, ${passed} passed` : `test-socket-codes: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
