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
// and a super admin get it back; a room opened from a remembered device belongs to that teacher; warm-up, reading and
// exam rooms follow the same rule AND still need a teacher code (2026-10-17: before, any teacher code took them, even
// mid-class; one code over all 900 PINs takes none now, an old tab can't take a newer room, an exam room keeps its owner
// across a restart and one saved without an owner goes only to a super admin); wrong codes count in the turnstile.
// A dropped Wi-Fi (2026-10-17): the reading and exam projectors take their room back like the warm-up (before, their
// controls went quiet and a reload opened a new room): the reading gets its state again and its rd:* controls work, the
// exam monitor gets the room's state and «Empezar» works, also after a restart (its room was only on the disk); and
// public/js/host-reconnect.js in a small fake page: the notices, the way forward on every refusal, the retries. The
// warm-up uses it too since 2026-10-17 (its own reclaim showed a refusal only in the console): its builder state comes
// again, its tools work, and its own options run in the fake page.
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

  section('warm-up, reading and exam rooms: the owner rule, and still the teacher code (his decision 2026-10-17)');
  // (before: ANY teacher code took them, even while the teacher's projector was on)
  const once = async (b, payload) => { const s = sock(b); const r = await emitAck(s, 'host:reclaim', payload); s.close(); return r; };
  for (const type of ['warmup', 'reading', 'hsksim']) {
    const proj = browser();
    const ps = sock(proj);
    const room = await emitAck(ps, 'host:create', { gameType: type, simId: 'yct1-sim1', password: ENNI });
    ok(room.pin && /^[0-9a-f]{32}$/.test(String(room.hostToken || '')), `${type}: a room opens with its token`);
    const t1 = await once(browser(), { pin: room.pin, hostToken: room.hostToken });
    ok(t1.ok === false && t1.error === 'bad-password', `${type}: the token alone is not enough (the teacher code is still needed)`);
    const t2 = await once(laptop, { pin: room.pin });
    ok(t2.ok === false && t2.error === 'bad-password', `${type}: … nor her remembered device without the code`);
    for (const [who, pw] of [['the same teacher\'s code (an old sleeping tab)', ENNI], ['another teacher\'s code', OTHER], ['a super admin\'s code', SEED]]) {
      const r = await once(browser(), { pin: room.pin, password: pw });
      ok(r.ok === false && r.error === 'host-live', `${type}: while its projector is on, ${who} cannot take it`);
    }
    const drop = sock(proj);                                       // a dropped Wi-Fi: a new connection of the same tab
    const r1 = await emitAck(drop, 'host:reclaim', { pin: room.pin, hostToken: room.hostToken, password: ENNI });
    ok(r1.ok === true && r1.gameType === type, `${type}: the same tab (its token + the code) gets it back, even before the old connection is gone`);
    ps.close(); drop.close();
    await sleep(250);
    const r2 = await once(browser(), { pin: room.pin, password: OTHER });
    ok(r2.ok === false && r2.error === 'not-host', `${type}: once the projector is off, a colleague's code still cannot take it`);
    const r3 = await once(otherDev, { pin: room.pin, password: OTHER });
    ok(r3.ok === false && r3.error === 'not-host', `${type}: … nor from her remembered device`);
    const r4 = await once(browser(), { pin: room.pin, password: ENNI.toLowerCase() });
    ok(r4.ok === true && r4.gameType === type, `${type}: the same teacher's code on another laptop takes it back`);
    await sleep(250);
    const r5 = await once(laptop, { pin: room.pin, password: OTHER });
    ok(r5.ok === true, `${type}: … and her remembered device (with a teacher code)`);
    await sleep(250);
    const r6 = await once(browser(), { pin: room.pin, password: SEED });
    ok(r6.ok === true, `${type}: … and a super admin`);
    await sleep(250);
  }
  // an old sleeping warm-up tab whose PIN came back for a newer room (another teacher's): its old token and its code
  const oldTab = sock(browser());
  const oldRoom = await emitAck(oldTab, 'host:create', { gameType: 'warmup', password: ENNI });
  oldTab.close();
  const newProj = sock(browser());
  const newRoom = await emitAck(newProj, 'host:create', { gameType: 'warmup', password: OTHER });
  const w1 = await once(browser(), { pin: newRoom.pin, hostToken: oldRoom.hostToken, password: ENNI });
  ok(w1.ok === false && w1.error === 'host-live', 'an old warm-up tab (another room\'s token + its code) cannot take a newer running room');
  newProj.close();
  await sleep(250);
  const w2 = await once(browser(), { pin: newRoom.pin, hostToken: oldRoom.hostToken, password: ENNI });
  ok(w2.ok === false && w2.error === 'not-host', '… nor once that projector dropped');
  // one teacher code tried over every 3-digit PIN takes no projector (the hole: every warm-up, reading and exam room)
  const sweepT = await post('/api/admin/teachers', { displayName: 'Ms Barrido', email: '', country: 'MX', levels: ['yct1'] }, { headers: T(SEED) });
  const SWEEP = sweepT.json && (sweepT.json.teacher || sweepT.json).teacherId;
  ok(!!SWEEP, 'a third regular teacher is created');
  const live = [];
  for (const type of ['warmup', 'reading', 'hsksim']) {
    const s = sock(browser());
    live.push({ s, room: await emitAck(s, 'host:create', { gameType: type, simId: 'yct1-sim1', password: ENNI }) });
  }
  const sweepB = browser();
  const sweeper = sock(sweepB);
  let taken = 0, seen = 0;
  for (let p = 100; p <= 999; p++) {
    const r = await emitAck(sweeper, 'host:reclaim', { pin: String(p), password: SWEEP });
    if (r.ok) taken++;
    if (r.error && r.error !== 'no-game') seen++;
  }
  ok(seen >= 3 && taken === 0, `one teacher code tried over all 900 PINs takes none of the ${seen} rooms (it used to take every warm-up, reading and exam room)`);
  sweeper.close();
  const after900 = sock({ jar: {}, ip: sweepB.ip });
  ok((await emitAck(after900, 'wu:presets-list', { password: 'WRONG-' + rnd(3) })).ok === false
    && (await emitAck(after900, 'wu:presets-list', { password: SWEEP })).ok === true, '… and its address is not waiting (a right code never counts as a wrong one)');
  after900.close();
  for (const l of live) {
    const back = await emitAck(l.s, 'host:reclaim', { pin: l.room.pin, hostToken: l.room.hostToken, password: ENNI });
    ok(back.ok === true, `… while each running ${back.gameType || 'room'} projector still has its room`);
    l.s.close();
  }
  await sleep(250);

  section('a dropped Wi-Fi: the warm-up, reading and exam projectors keep working (2026-10-17)');
  // (before: only the warm-up took its room back; a reading's rd:* controls and an exam's «Empezar» went quiet)
  const nextEv = (s, ev, ms = 1500) => new Promise((res) => { const t = setTimeout(() => res(null), ms); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
  {
    // the warm-up (its page moved onto host-reconnect.js 2026-10-17): the builder state comes again, the tools work
    const proj = browser();
    const ps = sock(proj);
    const room = await emitAck(ps, 'host:create', { gameType: 'warmup', password: ENNI });
    ok((await emitAck(ps, 'wu:auth', { pin: room.pin, password: ENNI })).ok === true, 'warm-up: the projector unlocks its tools');
    const kid = sock(browser());
    const kidStates = [];
    kid.on('wu:state', (s) => kidStates.push(s));
    ok((await emitAck(kid, 'player:join', { pin: room.pin, name: 'Leo' })).ok === true, 'warm-up: a kid joins');
    const started = nextEv(kid, 'wu:state', 6000);            // (the builder opens after the 3.5 s countdown)
    ps.emit('host:start', { pin: room.pin });
    ok(!!(await started), 'warm-up: the builder opens on the kid\'s phone');
    const said = () => (kidStates.length ? (kidStates[kidStates.length - 1].sentence || []).join(' ') : null);
    ps.emit('wu:add-word', { pin: room.pin, password: ENNI, wordId: 'w-ni' });
    await sleep(300);
    ok(said() === 'w-ni', 'warm-up: the teacher builds a sentence and the kid\'s phone shows it');
    const drop = sock(proj);                                   // the Wi-Fi blips: the same tab, a new connection
    const before = kidStates.length;
    drop.emit('wu:add-word', { pin: room.pin, password: ENNI, wordId: 'w-hao' });
    await sleep(300);
    ok(kidStates.length === before, 'warm-up: the new connection alone changes nothing (its tools wait for the room)');
    const resync = nextEv(drop, 'wu:state');
    const back = await emitAck(drop, 'host:reclaim', { pin: room.pin, hostToken: room.hostToken, password: ENNI });
    ok(back.ok === true && back.gameType === 'warmup' && back.state === 'active', 'warm-up: the page takes its room back (same PIN), even before the old connection is gone');
    const st = await resync;
    ok(st && (st.sentence || []).join(' ') === 'w-ni', 'warm-up: … and gets the builder state again (wu:state: the sentence on the stage) to repaint');
    drop.emit('wu:add-word', { pin: room.pin, password: ENNI, wordId: 'w-hao' });
    await sleep(300);
    ok(said() === 'w-ni w-hao', 'warm-up: its tools work again (the kid\'s phone gets the next word)');
    ps.emit('wu:clear', { pin: room.pin, password: ENNI });
    await sleep(300);
    ok(said() === 'w-ni w-hao', 'warm-up: the old connection no longer drives the room');
    ps.close(); drop.close(); kid.close();
  }
  {
    const proj = browser();
    const ps = sock(proj);
    const room = await emitAck(ps, 'host:create', { gameType: 'reading', password: ENNI });
    ok((await emitAck(ps, 'rd:auth', { pin: room.pin, password: ENNI })).ok === true, 'reading: the projector unlocks its tools');
    const kid = sock(browser());
    const kidStates = [];
    kid.on('rd:state', (s) => kidStates.push(s));
    ok((await emitAck(kid, 'player:join', { pin: room.pin, name: 'Ana' })).ok === true, 'reading: a kid joins');
    const started = nextEv(kid, 'rd:state', 6000);            // (the reading begins after the 3.5 s countdown)
    ps.emit('host:start', { pin: room.pin });
    ok(!!(await started), 'reading: the story starts on the kid\'s phone');
    ps.emit('rd:goto', { pin: room.pin, password: ENNI, page: 1 });
    await sleep(300);
    const lastPage = () => (kidStates.length ? kidStates[kidStates.length - 1].currentPage : null);
    ok(lastPage() === 1, 'reading: the story runs and the kid\'s phone follows the projector (page 2)');
    const drop = sock(proj);                                   // the Wi-Fi blips: the same tab, a new connection
    const before = kidStates.length;
    drop.emit('rd:goto', { pin: room.pin, password: ENNI, page: 2 });
    await sleep(300);
    ok(kidStates.length === before && lastPage() === 1, 'reading: the new connection alone moves nothing (the bug: the controls went quiet)');
    const resync = nextEv(drop, 'rd:state');
    const back = await emitAck(drop, 'host:reclaim', { pin: room.pin, hostToken: room.hostToken, password: ENNI });
    ok(back.ok === true && back.gameType === 'reading' && /^(active|countdown)$/.test(back.state), 'reading: the page takes its room back (same PIN), even before the old connection is gone');
    const st = await resync;
    ok(st && st.currentPage === 1 && Array.isArray(st.pages) && st.pages.length > 1, 'reading: … and gets the reading state again (the page it was on) to repaint');
    drop.emit('rd:goto', { pin: room.pin, password: ENNI, page: 2 });
    await sleep(300);
    ok(lastPage() === 2, 'reading: its controls work again (the kid\'s phone turns the page)');
    ps.emit('rd:goto', { pin: room.pin, password: ENNI, page: 0 });
    await sleep(300);
    ok(lastPage() === 2, 'reading: the old connection no longer drives the room');
    ps.close(); drop.close(); kid.close();
  }
  {
    const proj = browser();
    const es = sock(proj);
    const room = await emitAck(es, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: ENNI });
    const drop = sock(proj);
    const seen = [];
    drop.on('state', (s) => seen.push(s));
    drop.emit('host:start', { pin: room.pin });
    await sleep(300);
    ok(seen.length === 0, 'exam: the new connection alone is outside the room (the roster froze, «Empezar» did nothing)');
    const back = await emitAck(drop, 'host:reclaim', { pin: room.pin, hostToken: room.hostToken, password: ENNI });
    await sleep(250);
    ok(back.ok === true && back.gameType === 'hsksim' && seen.some((s) => s.state === 'lobby'), 'exam: the monitor takes its room back (same PIN) and gets the room\'s state again');
    drop.emit('host:start', { pin: room.pin });
    await sleep(400);
    ok(seen.some((s) => s.state === 'countdown' || s.state === 'active'), 'exam: «Empezar» works again');
    es.close(); drop.close();
  }
  await sleep(250);

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

  section('an exam room keeps its owner across a restart');
  const viaHttp = await post('/api/hsk-sim/room/create', { simId: 'yct1-sim1' }, { headers: T(ENNI) });
  const hPin = viaHttp.json && viaHttp.json.pin;
  ok(viaHttp.status === 200 && hPin, 'an exam room opened over HTTP (/api/hsk-sim/room/create)');
  ok((await once(browser(), { pin: hPin, password: OTHER })).error === 'not-host', '… goes back to no other teacher');
  ok((await once(browser(), { pin: hPin, password: ENNI })).ok === true, '… but to the teacher who opened it');
  const xs = sock(browser());
  const xRoom = await emitAck(xs, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: ENNI });
  xs.close();
  const ys = sock(browser());                                     // its monitor will be the first to ask for it after the restart
  const yRoom = await emitAck(ys, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: ENNI });
  ys.close();
  await sleep(250);
  await stopServer();
  const roomsFile = path.join(DATA, 'hsk-rooms.json');
  const disk = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));
  ok(disk[hPin] && disk[xRoom.pin] && disk[hPin].owner && disk[hPin].owner === disk[xRoom.pin].owner, 'both exam rooms keep their owner on the data disk');
  const diskText = JSON.stringify(disk);
  ok(![ENNI, OTHER, SEED, LEGACY].some((c) => diskText.includes(c)) && !diskText.includes(xRoom.hostToken), '… as the teacher\'s id: never a code or a room token');
  disk['7777'] = { pin: '7777', simId: 'yct1-sim1', createdAt: Date.now(), fx: null };   // a room saved before 2026-10-17
  fs.writeFileSync(roomsFile, JSON.stringify(disk));
  await startServer();
  for (const p of [hPin, xRoom.pin, '7777']) ok((await get('/api/hsk-sim/room/' + p)).status === 200, `exam room ${p === '7777' ? 'saved before the change' : p === hPin ? '(HTTP)' : '(socket)'} is back after the restart`);
  for (const p of [hPin, xRoom.pin]) {
    ok((await once(browser(), { pin: p, password: OTHER })).error === 'not-host', 'after a restart another teacher still cannot take it');
    ok((await once(browser(), { pin: p, password: ENNI })).ok === true, '… its teacher can');
    await sleep(250);
  }
  ok((await once(browser(), { pin: '7777', password: ENNI })).error === 'not-host', 'a room with no owner on record goes to no regular teacher');
  ok((await once(browser(), { pin: '7777', password: SEED })).ok === true, '… only to a super admin');
  // the monitor itself reconnecting after the restart, before anything else looked its room up (2026-10-17)
  ok((await once(browser(), { pin: yRoom.pin })).error === 'no-game', 'after a restart, a socket with no code learns nothing about an exam room on the disk');
  ok((await once(browser(), { pin: yRoom.pin, password: 'WRONG-' + rnd(3) })).error === 'no-game', '… nor with a wrong code');
  const mon = sock(browser());
  const monSeen = [];
  mon.on('state', (s) => monSeen.push(s));
  const yBack = await emitAck(mon, 'host:reclaim', { pin: yRoom.pin, hostToken: yRoom.hostToken, password: ENNI });
  await sleep(250);
  ok(yBack.ok === true && yBack.gameType === 'hsksim' && monSeen.some((s) => s.state === 'lobby'), 'its own monitor reconnecting after a restart takes it back by itself (same PIN, the room\'s state again)');
  mon.emit('host:start', { pin: yRoom.pin });
  await sleep(400);
  ok(monSeen.some((s) => s.state === 'countdown' || s.state === 'active'), '… and «Empezar» works');
  mon.close();
  await sleep(250);
  ok((await once(browser(), { pin: yRoom.pin, password: OTHER })).error === 'not-host', '… and another teacher\'s code still cannot take it');

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

// ── the warm-up, reading and exam pages: public/js/host-reconnect.js takes the room back, never a dead screen ──
async function reconnectSide() {
  section('host-reconnect.js on the warm-up, reading and exam pages');
  // (the warm-up had its own connect handler until 2026-10-17: a refusal reached only the console, a dead screen)
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const grace = srv.match(/const graceMs = \(g\.gameType === 'warmup' \|\| g\.gameType === 'reading'[^?]*\? (\d+) \* 60 \* 1000/);
  for (const [page, js, pinOf, codeVar] of [
    ['host-warmup.html', 'host-warmup.js', '\\(adminPw \\? pin : null\\)', 'adminPw'],
    ['host-reading.html', 'host-reading.js', 'pin', 'adminPw'],
    ['host-hsk.html', 'host-hsk.js', 'pin', 'pw'],
  ]) {
    const html = fs.readFileSync(path.join(ROOT, 'public', page), 'utf8');
    const g = html.indexOf('/js/teacher-gate.js'), a = html.indexOf('/js/host-reconnect.js?v='), b = html.indexOf('/js/' + js + '?v=');
    ok(g >= 0 && a > g && b > a, `${page} loads host-reconnect.js after teacher-gate.js and before ${js}`);
    const code = fs.readFileSync(path.join(ROOT, 'public', 'js', js), 'utf8');
    ok(new RegExp('DralyReconnect\\.watch\\(socket, \\{\\s*pin: \\(\\) => ' + pinOf + ',(\\s*//[^\\n]*)?\\s*code: \\(\\) => ' + codeVar + ',').test(code), `${js} hands it the room's PIN and the teacher code`);
    ok(!/emit\(\s*'host:reclaim'/.test(code), `${js} sends no host:reclaim of its own (one way back: two would race each other)`);
    const holds = code.match(/holdsMinutes: (\d+)/);
    if (holds) ok(grace && holds[1] === grace[1], `${js}: «La sala te espera ${holds[1]} minutos» is what server.js waits for its projector`);
  }
  const src = fs.readFileSync(path.join(ROOT, 'public', 'js', 'host-reconnect.js'), 'utf8');
  ok(!/innerHTML/.test(src), 'its notices are built as text (never innerHTML)');

  // a small fake page: just enough DOM for the notices, a fake connection and a fake clock
  function El(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.attrs = {}; this.on = {}; this.parentNode = null; this.className = ''; this._t = ''; this.value = ''; }
  El.prototype = {
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    addEventListener(ev, fn) { (this.on[ev] = this.on[ev] || []).push(fn); },
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; },
    get firstChild() { return this.children[0] || null; },
    set textContent(v) { this.children = []; this._t = String(v); },
    get textContent() { return [this._t].concat(this.children.map((c) => c.textContent)).join(' ').replace(/\s+/g, ' ').trim(); },
    all() { return [this].concat(...this.children.map((c) => (c.all ? c.all() : []))); },
    querySelector(sel) { return this.all().slice(1).find((e) => (sel[0] === '.' ? (' ' + e.className + ' ').includes(' ' + sel.slice(1) + ' ') : e.tagName === sel.toUpperCase())) || null; },
    focus() {},
    fire(ev, e) { (this.on[ev] || []).forEach((f) => f(e || { key: '', preventDefault() {} })); },
  };
  const document = {
    createElement: (t) => new El(t),
    createTextNode: (t) => ({ textContent: String(t), parentNode: null }),
    head: new El('head'), body: new El('body'),
  };
  let now = 0, tid = 0;
  const timers = [];
  const setT = (fn, ms) => { timers.push({ fn, at: now + (ms || 0), id: ++tid }); return tid; };
  const clearT = (id) => { const t = timers.find((x) => x.id === id); if (t) t.done = true; };
  const tick = (ms) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => !t.done && t.at <= end).sort((x, y) => x.at - y.at)[0];
      if (!due) break;
      now = due.at; due.done = true; due.fn();
    }
    now = end;
  };
  const ws = {
    connected: false, handlers: {}, sent: [], connects: 0,
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; },
    emit(ev, payload, cb) { this.sent.push({ ev, payload, cb }); return this; },
    connect() { this.connects++; },
    fire(ev, ...a) { (this.handlers[ev] || []).forEach((f) => f(...a)); },
  };
  const ctx = { window: {}, document, setTimeout: setT, clearTimeout: clearT, console: { warn() {} }, location: { href: '', reload() {} } };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  ok(ctx.window.DralyReconnect && typeof ctx.window.DralyReconnect.watch === 'function', 'it loads in a page');
  let pin = '', code = 'CODE-1';
  const calls = { back: [], setCode: [], newRoom: 0 };
  ctx.window.DralyReconnect.watch(ws, {
    pin: () => pin, code: () => code, setCode: (c) => { calls.setCode.push(c); code = c; },
    room: 'la lectura', holdsMinutes: 10,
    newRoom: { label: 'Abrir una lectura nueva', go: () => { calls.newRoom++; } },
    onBack: (r) => calls.back.push(r),
  });
  const body = () => document.body.textContent;
  const asks = () => ws.sent.filter((x) => x.ev === 'host:reclaim');
  const lastAsk = () => asks().pop();
  const card = () => document.body.all().find((e) => e.attrs.role === 'alertdialog') || null;
  const button = (label) => document.body.all().find((e) => e.tagName === 'BUTTON' && e.textContent === label) || null;
  const blip = () => { ws.connected = false; ws.fire('disconnect', 'transport close'); ws.connected = true; ws.fire('connect'); };

  ws.connected = true; ws.fire('connect');
  ok(asks().length === 0, 'the page\'s first connection asks for nothing');
  ws.connected = false; ws.fire('disconnect', 'transport close'); ws.connected = true; ws.fire('connect');
  ok(asks().length === 0 && body() === '', 'a dropped connection before the room exists: nothing to take back, nothing shown');

  pin = '123';
  ws.connected = false; ws.fire('disconnect', 'transport close');
  ok(/Sin conexión · reconectando con la sala 123/.test(body()) && /Los botones vuelven/.test(body()), 'offline: the notice says so, with the PIN');
  tick(20000);
  ok(/Revisa el wifi/.test(body()) && /La sala te espera 10 minutos/.test(body()), '… and after 20 s says what to check and how long the room waits');
  ws.connected = true; ws.fire('connect');
  ok(asks().length === 1 && lastAsk().payload.pin === '123' && lastAsk().payload.password === 'CODE-1' && typeof lastAsk().cb === 'function', 'back online: it asks for its room (PIN + the teacher code; teacher-gate.js adds the token)');
  ok(/Reconectando con la sala 123/.test(body()), '… while the notice says «Reconectando»');
  lastAsk().cb({ ok: true, gameType: 'reading', state: 'active' });
  ok(calls.back.length === 1 && calls.back[0].gameType === 'reading', 'the room is back: the page re-syncs (onBack)');
  ok(/Conexión recuperada · sala 123/.test(body()) && !card(), '… «Conexión recuperada», no card');
  tick(3000);
  ok(body() === '', '… and the notice goes away by itself');

  blip();
  lastAsk().cb({ ok: false, error: 'no-game' });
  ok(card() && /La lectura se cerró/.test(card().textContent) && /ya no existe/.test(card().textContent), 'the room is gone: a card says so in Spanish');
  ok(button('Abrir una lectura nueva') && button('Volver a Modo Maestro'), '… with a way forward (a new room, Modo Maestro)');
  button('Abrir una lectura nueva').fire('click');
  ok(calls.newRoom === 1, '«Abrir una lectura nueva» opens a new room');
  document.body.all().find((e) => e.attrs['aria-label'] === 'Cerrar aviso').fire('click');
  ok(!card() && /no está conectada/.test(body()) && button('Ver opciones'), '«Cerrar aviso»: the card goes, a red notice stays with «Ver opciones»');
  button('Ver opciones').fire('click');
  ok(card() && /se cerró/.test(card().textContent), '«Ver opciones» brings the card back');

  ws.connected = false; ws.fire('disconnect', 'transport close');
  ok(!card() && /Sin conexión/.test(body()), 'a new drop closes the card and says «Sin conexión»');
  ws.connected = true; ws.fire('connect');
  lastAsk().cb({ ok: false, error: 'bad-password' });
  const field = () => card() && card().querySelector('input');
  ok(field() && /Tu código ya no abre esta sala/.test(card().textContent) && /siguen dentro/.test(card().textContent), 'the code no longer works (changed mid-class): a card asks for today\'s code');
  const n0 = asks().length;
  button('Recuperar la sala').fire('click');
  ok(asks().length === n0 && /Escribe tu código/.test(card().textContent), '… an empty field asks for the code, sends nothing');
  field().value = ' NUEVO-2 ';
  button('Recuperar la sala').fire('click');
  ok(calls.setCode.pop() === 'NUEVO-2' && asks().length === n0 + 1 && lastAsk().payload.password === 'NUEVO-2', '… the typed code becomes the page\'s code and asks again');
  lastAsk().cb({ ok: false, error: 'bad-password' });
  ok(field() && /tampoco funciona/.test(card().textContent), '… a wrong one says so and keeps the field');
  field().value = 'NUEVO-3';
  field().fire('keydown', { key: 'Enter', preventDefault() {} });
  ok(lastAsk().payload.password === 'NUEVO-3', '… Enter sends it too');
  lastAsk().cb({ ok: true, gameType: 'reading', state: 'active' });
  ok(!card() && calls.back.length === 2, '… the right one brings the room back');
  tick(3000);

  blip();
  lastAsk().cb({ ok: false, error: 'wait' });
  ok(card() && /Muchos intentos/.test(card().textContent) && button('Reintentar ahora'), 'too many wrong codes from the school\'s address: a card, «Reintentar ahora»');
  const n1 = asks().length;
  tick(60000);
  ok(asks().length === n1 + 1, '… and it tries again by itself after a minute');
  lastAsk().cb({ ok: true });
  ok(!card(), '… until the room is back');
  tick(3000);

  blip();
  const silent = lastAsk();
  tick(8000);
  ok(card() && /El servidor no respondió/.test(card().textContent) && button('Reintentar') && button('Abrir una lectura nueva'), 'no answer in 8 s: a card with «Reintentar» and a new room');
  const b0 = calls.back.length;
  silent.cb({ ok: true });
  ok(!card() && calls.back.length === b0 + 1, '… a late yes still counts');
  tick(3000);
  blip();
  tick(8000);
  const n2 = asks().length;
  tick(5000);
  ok(asks().length === n2 + 1, '… and with no answer at all it asks again by itself');
  lastAsk().cb({ ok: true });
  tick(3000);

  ws.connected = true; ws.fire('connect');
  const stale = lastAsk();
  ws.connected = false; ws.fire('disconnect', 'transport close');
  const b1 = calls.back.length;
  stale.cb({ ok: true });
  ok(/Sin conexión/.test(body()) && calls.back.length === b1, 'an answer over a connection that dropped meanwhile changes nothing');
  ws.connected = true; ws.fire('connect');
  lastAsk().cb({ ok: true });
  tick(3000);

  blip();
  lastAsk().cb({ ok: false, error: 'host-live' });
  ok(card() && /Otra pantalla/.test(card().textContent), 'another screen holds the room: a card says so');
  const n3 = asks().length;
  tick(15000);
  ok(asks().length === n3 + 1, '… and it tries again by itself (that screen\'s connection may be dying)');
  lastAsk().cb({ ok: true });
  tick(3000);

  ws.connected = false; ws.fire('disconnect', 'io server disconnect');
  tick(1500);
  ok(ws.connects === 1, 'a connection the server closed is opened again (socket.io would not by itself)');
  ws.connected = true; ws.fire('connect');
  lastAsk().cb({ ok: true });
  tick(3000);
  ws.fire('disconnect', 'io client disconnect');
  ok(body() === '', 'the page closing its own connection shows nothing');

  // the warm-up's own options, read from host-warmup.js and run with its two variables (pin, adminPw)
  section('the warm-up page with host-reconnect.js');
  const wuSrc = fs.readFileSync(path.join(ROOT, 'public', 'js', 'host-warmup.js'), 'utf8');
  const opts = wuSrc.match(/DralyReconnect\.watch\(socket, (\{[\s\S]*?\n {4}\})\);/);
  ok(!!opts, 'host-warmup.js: its options can be read');
  if (!opts) return;
  let reloads = 0;
  const wctx = { location: { href: '', reload() { reloads++; } } };
  vm.createContext(wctx);
  const wu = vm.runInContext('(function () { let pin = null, adminPw = null; const o = ' + opts[1] +
    '; return { o, set(p, c) { pin = p; adminPw = c; }, code: () => adminPw }; })()', wctx);
  const ws2 = {
    connected: false, handlers: {}, sent: [],
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; },
    emit(ev, payload, cb) { this.sent.push({ ev, payload, cb }); return this; },
    connect() {},
    fire(ev, ...a) { (this.handlers[ev] || []).forEach((f) => f(...a)); },
  };
  ctx.window.DralyReconnect.watch(ws2, wu.o);
  const wuAsk = () => ws2.sent.filter((x) => x.ev === 'host:reclaim').pop();
  const wuAsks = () => ws2.sent.filter((x) => x.ev === 'host:reclaim').length;
  ws2.connected = true; ws2.fire('connect');
  wu.set('456', null);                                         // the gate refused the code: the page has a PIN, no code
  ws2.connected = false; ws2.fire('disconnect', 'transport close');
  ok(body() === '', 'warm-up: a room whose code the gate refused is not taken back (no notice over the gate)');
  ws2.connected = true; ws2.fire('connect');
  ok(wuAsks() === 0, '… and nothing is asked');
  wu.set('456', 'CODE-W');                                     // the teacher's room, running
  ws2.connected = false; ws2.fire('disconnect', 'transport close');
  ok(/Sin conexión · reconectando con la sala 456/.test(body()), 'warm-up: offline, the notice says so with its PIN');
  tick(20000);
  ok(/La sala te espera 10 minutos/.test(body()), '… and after 20 s how long its room waits');
  ws2.connected = true; ws2.fire('connect');
  ok(wuAsks() === 1 && wuAsk().payload.pin === '456' && wuAsk().payload.password === 'CODE-W', 'warm-up: back online it asks for its room once (PIN + its code)');
  wuAsk().cb({ ok: false, error: 'no-game' });
  ok(card() && /El calentamiento se cerró/.test(card().textContent) && button('Abrir un calentamiento nuevo') && button('Volver a Modo Maestro'),
    'warm-up: the room is gone (a restart): «El calentamiento se cerró», a new one or Modo Maestro (it used to be a dead screen)');
  button('Abrir un calentamiento nuevo').fire('click');
  ok(reloads === 1, '… «Abrir un calentamiento nuevo» reloads the page (its gate opens a new room)');
  ws2.connected = false; ws2.fire('disconnect', 'transport close');
  ws2.connected = true; ws2.fire('connect');
  wuAsk().cb({ ok: false, error: 'bad-password' });
  ok(card() && card().querySelector('input') && /Tu código ya no abre esta sala/.test(card().textContent), 'warm-up: its code changed mid-class: the card asks for today\'s code');
  card().querySelector('input').value = 'HOY-7';
  button('Recuperar la sala').fire('click');
  ok(wu.code() === 'HOY-7' && wuAsk().payload.password === 'HOY-7', '… the typed code becomes the page\'s code (every warm-up tool sends it) and asks again');
  wuAsk().cb({ ok: true, gameType: 'warmup', state: 'active' });
  ok(!card() && /Conexión recuperada · sala 456/.test(body()), '… and the room is back');
  tick(3000);
  ok(body() === '', '… the notice goes away by itself');
}

(async () => {
  await startServer();
  let crashed = false;
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  const log = allLog;
  if (!KEEP) await stopServer();
  if (!crashed) ok(!log.includes(SEED) && !log.includes(LEGACY), 'no teacher code in the server log');
  try { await gateSide(); } catch (e) { failed++; console.log('  ✖ gate side crashed: ' + (e && e.stack || e)); }
  try { await reconnectSide(); } catch (e) { failed++; console.log('  ✖ reconnect side crashed: ' + (e && e.stack || e)); }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-host-reclaim: ${failed} FAILED, ${passed} passed` : `test-host-reclaim: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();
