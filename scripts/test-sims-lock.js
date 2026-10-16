#!/usr/bin/env node
// test-sims-lock.js — La Ruta Dorada phase 1 (2026-10-15): the exam simulations are locked (core/sim-lock.js).
// Starts its OWN server on port 4000 (never 3000, never the live site) with a throw-away signing key, plays every way
// in and out against it, and stops it. Test students are created through the API (/api/homework/enter), never by
// opening data/.
//   node scripts/test-sims-lock.js            (--port 4000 · --keep to leave the server running for a browser check)
// Checks: anonymous visitors get the friendly page on every sim page, nothing from any sim data endpoint, no sim file
// at the old /assets/… addresses or through path tricks; a student of a level gets that level's sims + files and is
// refused the others (and loses them when moved to another level); a teacher gets everything (grade not saved); a kid
// who JOINED a teacher's room (room pass) gets THAT room's sim only, and nothing new once the room closes (the submit
// ticket still hands in, a student's ticket only on their own record); nobody else takes over or closes a room;
// signed links expire, can't open another sim's file, carry no student code; every protected answer is private +
// no-store; ?debug=1&direct=1 opens only on this PC, never with another Host or through a proxy; PIN guessing from one
// address pauses there only. Since the key model (2026-10-15, second round; scripts/test-level-keys.js tests the keys
// themselves) this server never gets a key: every kid enrolled here is "before the go-live" and keeps their level, a
// refusal is the level's key screen, and La Base is locked too. Its own temporary data folder; throw-away codes.
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4000));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const TEACHER = 'legacy-' + crypto.randomBytes(12).toString('hex');   // this server's WU_ADMIN_PASSWORD (no default since 2026-10-15)
const SECRET = 'test-' + crypto.randomBytes(24).toString('hex');  // same key here and in the server we start
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-simlock-'));   // its own teachers, students, keys
// (phase 4, 2026-10-16: this test checks the key's door, so El Entrenamiento's switch is OFF here, as he may set it
// after the launch: the key alone opens a simulation. The Dorado rule ON is scripts/test-ruta-training.js)
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: false, doradoPct: 70, trainingLaunchAt: Date.now() }));
process.env.SIM_LOCK_SECRET = SECRET;
const SimLock = require('../core/sim-lock');
const YctSim = require('../core/yct-sim');
const HskSim = require('../core/hsk-sim');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);

// ── tiny HTTP client (raw paths, any Host header, one cookie jar per visitor) ──
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
        if (o.jar) sc.forEach((c) => { const m = /^([^=]+)=([^;]*)/.exec(c); if (m) o.jar[m[1]] = m[2]; });
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const noStore = (r) => /private/.test(r.headers['cache-control'] || '') && /no-store/.test(r.headers['cache-control'] || '');
const isLocked = (r) => /data-level-key="locked"/.test(r.text) && !/id="y-exam"|id="hsk-runner"/.test(r.text);
const isPlayer = (r) => r.status === 200 && /id="y-exam"|id="hsk-runner"/.test(r.text) && !/data-level-key/.test(r.text);
const links = (obj) => Array.from(new Set(JSON.stringify(obj).match(/\/sim-media\/[^"\\]+/g) || []));
const oldUrls = (obj) => (JSON.stringify(obj).match(/\/assets\/[^"]*SIMULATIONS[^"]*/gi) || []);
function scoredHaveNoKey(sim) {
  const items = [];
  ['listening', 'reading'].forEach((k) => {
    const sec = (sim && sim[k]) || {};
    (sec.parts || []).forEach((p) => (p.items || []).forEach((it) => { if (!it.example) items.push(it); }));
    Object.keys(sec).filter((n) => /^part\d$/.test(n)).forEach((n) => ((sec[n] && sec[n].questions) || []).forEach((it) => items.push(it)));
  });
  return items.length > 0 && !items.some((it) => 'answer' in it || 'transcript' in it || 'es' in it);
}
// a sim's own logical media URLs (as the data writes them), a few per sim
function logicalMedia(simId, n) {
  const s = YctSim.SIMS[simId] || HskSim.SIMULATIONS[simId];
  const all = Array.from(new Set(JSON.stringify(s).match(/\/assets\/[^"]*SIMULATIONS[^"]*/g) || []));
  const audio = all.filter((u) => /\.(m4a|mp3)$/.test(u));
  const pics = all.filter((u) => /\.(webp|jpe?g|png)$/.test(u));
  return audio.slice(0, 1).concat(pics.slice(0, n || 2));
}
async function fetchMedia(u, o = {}) {
  const audio = /\.(m4a|mp3)$/.test(u);
  return get(u, Object.assign({}, o, { headers: Object.assign(audio ? { Range: 'bytes=0-2047' } : {}, o.headers || {}) }));
}
const mediaOk = (r) => (r.status === 200 || r.status === 206) && noStore(r) && /same-origin/.test(r.headers['cross-origin-resource-policy'] || '') &&
  /no-store/.test(r.headers['cdn-cache-control'] || '') && r.bytes > 0;

// ── socket.io client for the teacher's room ──
const { io } = require('socket.io-client');
const sock = () => io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true });
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});

async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  // --keep: a detached server that outlives this script (stop it by its port afterwards)
  const srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT), SIM_LOCK_SECRET: SECRET, WU_ADMIN_PASSWORD: TEACHER,
      DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', DRALY_SEED_ADMIN_CODE: 'T-' + crypto.randomBytes(5).toString('hex').toUpperCase() }),
    stdio: KEEP ? 'ignore' : ['ignore', 'pipe', 'pipe'], detached: KEEP,
  });
  let log = '';
  if (!KEEP) {
    srv.stdout.on('data', (d) => { log += d; });
    srv.stderr.on('data', (d) => { log += d; });
  } else srv.unref();
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try { const r = await get('/health'); if (r.status === 200) return srv; } catch (_) {}
  }
  console.error('the server did not start:\n' + log.slice(-2000));
  srv.kill();
  process.exit(2);
}

(async () => {
  const srv = await startServer();
  try { await run(); } catch (e) { failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) { srv.kill(); await sleep(300); try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-sims-lock: ${failed} FAILED, ${passed} passed` : `test-sims-lock: all ${passed} checks passed`);
  if (KEEP) console.log('(server left running on port ' + PORT + ', key ' + SECRET.slice(0, 9) + '…)');
  process.exit(failed ? 1 : 0);
})();

async function run() {
  const list = (await get('/api/hsk-sim/list')).json;
  const sims = ((list && list.sims) || []).map((s) => s.id);
  const yct = sims.filter((id) => /^yct\d/.test(id));
  const nhsk = sims.filter((id) => /^newhsk\d/.test(id));
  const ohsk = sims.filter((id) => /^hsk\d/.test(id));
  ok(yct.length >= 5 && nhsk.length >= 2 && ohsk.length >= 10, `the sim list is there (yct ${yct.length}, new hsk ${nhsk.length}, old hsk ${ohsk.length})`);
  ok(list && !/"answer"/.test(JSON.stringify(list)), 'the public sim list is titles only (no answers)');

  // ── 1. the old public addresses and path tricks serve nothing ──
  section('old /assets/… addresses and path tricks');
  for (const id of [yct[0], nhsk[0], ohsk[0], ohsk[ohsk.length - 1]]) {
    for (const u of logicalMedia(id, 2)) {
      const r = await get(u);
      ok(r.status === 404 && r.bytes < 100, `old address is gone: ${decodeURIComponent(u).slice(0, 70)} → ${r.status}`);
    }
  }
  for (const p of ['/js/../yct-sim.html', '//yct-sim.html', '/./hsk-sim.html', '/%2e/yct-sim.html', '/protected/pages/yct-sim.html',
    '/protected/YCT%20SIMULATIONS/YCT%201/SIMULATION%201/listening.m4a', '/assets/../protected/pages/hsk-sim.html',
    '/assets/x/..%2f..%2fprotected/YCT%20SIMULATIONS/YCT%201/SIMULATION%201/listening.m4a', '/sim-locked.html', '/YCT-SIM.HTML']) {
    const r = await get(p);
    ok(!isPlayer(r) && !/audio\/mp4/.test(r.headers['content-type'] || ''), `no player or file through ${p} (${r.status})`);
  }

  // ── 2. anonymous visitor: friendly page everywhere, no data ──
  section('anonymous visitor');
  const pages = ['/yct-sim.html', '/hsk-sim.html', '/hsk-sim.html?pin=9999', '/yct-sim.html?pin=123&code=ABCD',
    '/yct-sim.html?sim=yct1-sim1&code=ABCD']
    .concat(yct.concat(nhsk).map((id) => '/yct-sim.html?sim=' + id)).concat(ohsk.map((id) => '/hsk-sim.html?sim=' + id));
  for (const p of pages) {
    const r = await get(p);
    ok(r.status === 401 && isLocked(r) && (/Escribe la clave de (YCT 1|New HSK 1|HSK 1)/.test(r.text) || /"reason":"(room|pin)"/.test(r.text)) && noStore(r), `the key screen (or the PIN card) on ${p} (${r.status})`);
  }
  ok(isPlayer(await get('/hsk-sim.html?access=1001&sim=hsk1-sim1&code=ABCD')), 'a teacher\'s forced link (?access=…) opens the PIN box page (it holds no exam), so a kid without the key still joins the room');
  ok((await get('/api/hsk-sim/hsk1-sim1?accessCode=1001&studentCode=ABCD')).status === 401, '… while the forced link\'s sim itself stays locked');
  const dead = await get('/yct-sim.html?pin=9999');
  ok(/"reason":"room"/.test(dead.text), 'a closed room PIN gets the «Esta sala ya cerró» card');
  ok(/Escribe la clave de New HSK 1/.test((await get('/yct-sim.html?sim=newhsk1-sim1')).text) && /Escribe la clave de HSK 1/.test((await get('/hsk-sim.html?sim=hsk1-sim2')).text), 'a sim\'s key screen names its own level');
  for (const id of sims) {
    const a = await get('/api/hsk-sim/' + id);
    const b = await get('/api/hsk-sim/' + id + '?accessCode=1001&studentCode=ABCD');   // the old access-code-only way in
    const c = await get('/api/hsk-sim/' + id + '?pin=9999');
    const s = await post('/api/hsk-sim/' + id + '/submit', { studentCode: 'ABCD', answers: {} });
    ok(a.status === 401 && b.status === 401 && c.status === 401 && !/listening|review|breakdown/.test(a.text + b.text + c.text),
      `${id}: no payload anonymously (${a.status}/${b.status}/${c.status})`);
    ok(s.status === 401 && !/review|breakdown|expected/.test(s.text), `${id}: no submit (no answer key) anonymously (${s.status})`);
    ok(noStore(a), `${id}: refusal is private/no-store`);
  }
  ok((await get('/api/sim-images')).status === 401, 'the teacher picture catalog needs a teacher code');
  ok((await get('/api/hsk-sim-practice')).status === 401, 'the teacher sentence practice (with answers) needs a teacher code');
  ok((await get('/api/homework/trainer/session/1/exp1')).status === 401, 'the HSK 1 trainer needs an access code');
  for (const id of ['pack:yct1-simulacro-s1e', 'pack:newhsk1-simulacro-s1e', 'pack:hsk1-simulacro-s1']) {
    const r = await get('/api/sets/' + encodeURIComponent(id));
    ok(r.json && r.json.title && Array.isArray(r.json.questions) && r.json.questions.length === 0, `${id}: name only, no questions or answers anonymously`);
  }
  ok((await get('/api/sets/' + encodeURIComponent('pack:yct1-familia-r1'))).status !== 401, 'other pack rounds are untouched');

  // ── 3. the local harness: only on this PC, never with another Host or through a proxy ──
  section('?debug=1&direct=1');
  const dbgPage = await get('/yct-sim.html?debug=1&direct=1&sim=yct1-sim1&code=ABCD&view=reading');
  ok(isPlayer(dbgPage), 'the harness page opens on localhost');
  const dbg = await get('/api/hsk-sim/yct1-sim1?studentCode=ABCD&pin=&debug=1&direct=1');
  ok(dbg.json && dbg.json.ok && links(dbg.json.sim).length > 10 && oldUrls(dbg.json.sim).length === 0, 'the harness payload loads on localhost, with signed links');
  const dbgFile = links(dbg.json && dbg.json.sim).find((u) => /\.m4a$/.test(u));
  ok(dbgFile && mediaOk(await fetchMedia(dbgFile)), 'a harness link plays on localhost');
  for (const h of [{ Host: 'app.dralingo.app' }, { Host: 'draly-wisdomgrounds-2.onrender.com' }, { 'X-Forwarded-For': '1.2.3.4' }, { 'CF-Connecting-IP': '1.2.3.4' }]) {
    const tag = JSON.stringify(h);
    const p = await get('/yct-sim.html?debug=1&direct=1&sim=yct1-sim1', { headers: h });
    const a = await get('/api/hsk-sim/yct1-sim1?debug=1&direct=1', { headers: h });
    const s = await post('/api/hsk-sim/yct1-sim1/submit?debug=1&direct=1', { answers: {} }, { headers: h });
    const f = dbgFile ? await fetchMedia(dbgFile, { headers: h }) : { status: 0 };
    ok(p.status === 401 && isLocked(p), `no harness page with ${tag}`);
    ok(a.status === 401 && s.status === 401, `no harness payload/submit with ${tag}`);
    ok(f.status === 403, `a harness link is dead with ${tag} (${f.status})`);
  }

  // ── 4. signed links: forged, expired, another sim, another purpose ──
  section('signed links');
  const one = SimLock.rewrite(logicalMedia('yct1-sim1', 1)[0], { kind: 's' });
  const two = SimLock.rewrite(logicalMedia('yct1-sim2', 1)[0], { kind: 's' });
  const tokOf = (u) => u.split('/')[2];
  const fileOf = (u) => u.split('/')[3];
  ok(mediaOk(await fetchMedia(one)), 'a fresh student link plays');
  ok((await fetchMedia('/sim-media/' + tokOf(one) + '/' + fileOf(two))).status === 403, 'a link of sim 1 cannot open a file of sim 2');
  const expired = SimLock._sign('m', ['s', 'yct1-sim1', ''], -60 * 1000);
  ok((await fetchMedia('/sim-media/' + expired + '/' + fileOf(one))).status === 403, 'an expired link is refused');
  const forged = tokOf(one).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  ok((await fetchMedia('/sim-media/' + forged + '/' + fileOf(one))).status === 403, 'a tampered link is refused');
  const otherKey = 'x'.repeat(10) + Buffer.from('m~s~yct1-sim1~~' + Math.floor(Date.now() / 1000 + 3600).toString(36)).toString('base64url');
  ok((await fetchMedia('/sim-media/' + otherKey + '.AAAAAAAAAAAAAAAAAAAAAA/' + fileOf(one))).status === 403, 'a home-made link is refused');
  const asTicket = SimLock.ticket({ kind: 's' }, 'yct1-sim1');
  ok((await fetchMedia('/sim-media/' + asTicket + '/' + fileOf(one))).status === 403, 'a submit ticket is not a media link');
  ok((await get('/sim-media/' + tokOf(one) + '/000000000000000000000000.webp')).status === 404, 'an unknown file id is a 404');

  // ── 5. students of each level ──
  section('enrolled students');
  const stamp = Date.now().toString(36).slice(-4);
  async function enroll(accessCode, name) {
    const jar = {};
    const r = await post('/api/homework/enter', { accessCode, displayName: name + ' ' + stamp }, { jar });
    ok(r.json && r.json.ok && r.json.studentCode, `${name}: enrolled through /api/homework/enter`);
    const c = (r.setCookie || []).find((x) => /^dsim=/.test(x)) || '';
    ok(/HttpOnly/i.test(c) && /SameSite=Lax/i.test(c) && /Path=\//.test(c) && !/Secure/.test(c), `${name}: the login sets the httpOnly sim session cookie`);
    ok(r.json && r.json.levelOpen === true, `${name}: enrolled before any key, their level is open`);
    return { jar, code: r.json && r.json.studentCode, accessCode, level: r.json && r.json.level };
  }
  const kids = {
    yct: await enroll('1003', 'Lock Yct'),
    nhsk: await enroll('1002', 'Lock NewHsk'),
    ohsk: await enroll('1001', 'Lock OldHsk'),
  };
  const own = { yct, nhsk, ohsk };
  const pageOf = (id) => (/^hsk\d/.test(id) ? '/hsk-sim.html?sim=' : '/yct-sim.html?sim=') + id;
  for (const [lvl, kid] of Object.entries(kids)) {
    for (const id of sims) {
      const mine = own[lvl].includes(id);
      const pg = await get(pageOf(id), { jar: kid.jar });
      const api = await get('/api/hsk-sim/' + id, { jar: kid.jar });
      if (mine) {
        ok(isPlayer(pg) && noStore(pg), `${lvl} kid opens ${id} (page ${pg.status})`);
        ok(api.json && api.json.ok && scoredHaveNoKey(api.json.sim) && oldUrls(api.json.sim).length === 0 && api.json.sim.ticket,
          `${lvl} kid gets ${id}: no answer key, only signed links, a ticket`);
        ok(noStore(api), `${id} payload is private/no-store`);
        const ls = links(api.json && api.json.sim);
        const audio = ls.find((u) => /\.(m4a|mp3)$/.test(u));
        const pic = ls.find((u) => /\.(webp|jpe?g|png)$/.test(u));
        const ra = audio ? await fetchMedia(audio) : { status: 0, headers: {} };
        const rp = pic ? await fetchMedia(pic) : { status: 0, headers: {} };
        ok(mediaOk(ra) && (ra.status === 206) && /^audio\//.test(ra.headers['content-type'] || ''), `${id}: its recording plays in pieces (${ra.status} ${ra.headers['content-type']})`);
        ok(mediaOk(rp) && /^image\//.test(rp.headers['content-type'] || ''), `${id}: a picture loads (${rp.status})`);
        ok(!ls.some((u) => Buffer.from(u.split('/')[2].split('.')[0], 'base64url').toString().includes(kid.code)), `${id}: no student code inside a link`);
        ok(!/\((TRUE|FALSE|CORRECT)\)/i.test(ls.join(' ')), `${id}: no answer hint in a file name`);
      } else {
        ok(pg.status === 401 && isLocked(pg), `${lvl} kid gets that level's key screen for ${id} (other level, page ${pg.status})`);
        ok(api.status === 401 && !/listening/.test(api.text), `${lvl} kid gets no ${id} payload (${api.status})`);
      }
    }
    ok(isPlayer(await get('/yct-sim.html', { jar: kid.jar })) || isPlayer(await get('/hsk-sim.html', { jar: kid.jar })), `${lvl} kid keeps the PIN box page`);
  }
  // a solo exam is saved on the kid's own record, whatever code the page sends
  const y = kids.yct;
  const p1 = (await get('/api/hsk-sim/yct1-sim1', { jar: y.jar })).json;
  const sub = await post('/api/hsk-sim/yct1-sim1/submit', { studentCode: kids.ohsk.code, answers: { 'L1-1': 'T' }, ticket: p1 && p1.sim && p1.sim.ticket }, { jar: y.jar });
  ok(sub.json && sub.json.ok && sub.json.result && sub.json.saved !== false && sub.json.result.review, 'a student hands in a solo exam and gets the review');
  const mineA = (await get('/api/homework/my-hsk-attempts/' + y.code + '?accessCode=1003')).json;
  const otherA = (await get('/api/homework/my-hsk-attempts/' + kids.ohsk.code + '?accessCode=1001')).json;
  ok(mineA && mineA.attempts && mineA.attempts.length === 1 && otherA && otherA.attempts && otherA.attempts.length === 0, 'the grade landed on the logged-in kid only');
  // a student's ticket (no cookie) also hands in on their own record only, never on a classmate's
  const t2 = await post('/api/hsk-sim/yct1-sim1/submit', { studentCode: kids.ohsk.code, answers: {}, ticket: p1.sim.ticket });
  const mineB = (await get('/api/homework/my-hsk-attempts/' + y.code + '?accessCode=1003')).json;
  const otherB = (await get('/api/homework/my-hsk-attempts/' + kids.ohsk.code + '?accessCode=1001')).json;
  ok(t2.json && t2.json.ok && mineB.attempts.length === 2 && otherB.attempts.length === 0, 'a student\'s ticket saves on their own record, whatever code is sent');
  const det = await get('/api/homework/my-hsk-attempt/' + y.code + '?accessCode=1003&ts=' + mineA.attempts[0].ts);
  ok(det.json && det.json.ok && oldUrls(det.json).length === 0 && noStore(det), '«Mis exámenes» shows the attempt with signed links only');
  ok((await get('/api/homework/my-hsk-attempt/' + y.code + '?accessCode=1001&ts=' + mineA.attempts[0].ts)).status === 403, '«Mis exámenes» of a kid needs their own classroom code');
  // the silent session from codes the phone saved (the friendly page)
  const jar2 = {};
  const s1 = await post('/api/sim-access/session', { accessCode: '1003', studentCode: y.code }, { jar: jar2 });
  ok(s1.json && s1.json.ok && s1.json.kind === 'student' && s1.json.open === true && s1.json.sims.includes('yct1-sim1') && !s1.json.sims.includes('newhsk1-sim1') && jar2.dsim && jar2.dlv_yct1,
    'a saved student code makes a session for its level');
  ok(isPlayer(await get('/yct-sim.html?sim=yct1-sim2', { jar: jar2 })), '… which opens the exam');
  ok((await post('/api/sim-access/session', { accessCode: '1003', studentCode: 'ZZZZ' })).status === 401, 'an unknown student code makes no session');
  ok((await post('/api/sim-access/session', { accessCode: '0000', studentCode: y.code })).status === 401, 'a wrong access code makes no session');
  ok((await post('/api/sim-access/session', { accessCode: '1001', studentCode: y.code })).status === 403, 'another classroom\'s access code makes no session');
  const bad = { dsim: y.jar.dsim.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) };
  ok(isLocked(await get('/yct-sim.html?sim=yct1-sim1', { jar: bad })), 'a tampered session cookie opens nothing');
  // HSK 1 trainer: the Old HSK 1 class only, signed links
  const tr = await get('/api/homework/trainer/session/1/exp1?accessCode=1001');
  ok(tr.json && tr.json.ok && links(tr.json.questions).length > 0 && oldUrls(tr.json.questions).length === 0, 'the HSK 1 trainer still plays, with signed links');
  const trFile = links(tr.json && tr.json.questions)[0];
  ok(trFile && mediaOk(await fetchMedia(trFile)), 'a trainer file loads');
  ok((await get('/api/homework/trainer/session/1/exp1?accessCode=1003')).status === 403, 'a YCT class gets no HSK 1 trainer');
  const trq = tr.json && tr.json.questions && tr.json.questions[0];
  ok(trq && (await post('/api/homework/trainer/check', { accessCode: '1001', qid: trq.qid, answer: 'A' })).status === 200 &&
    (await post('/api/homework/trainer/check', { accessCode: '1003', qid: trq.qid, answer: 'A' })).status === 403, 'trainer verdicts (they tell the answer) for the HSK 1 classes only');
  // a kid moved to another level: the old session stops at the next request
  const mover = await enroll('1003', 'Lock Mover');
  ok(isPlayer(await get('/yct-sim.html?sim=yct1-sim1', { jar: mover.jar })), 'the mover opens a YCT sim');
  const moved = await post('/api/homework/enter', { accessCode: '1002', studentCode: mover.code }, { jar: mover.jar });
  ok(moved.json && moved.json.level === 'hsk2', '… then logs in with the New HSK 1 code (level changes)');
  ok(isPlayer(await get('/yct-sim.html?sim=newhsk1-sim1', { jar: mover.jar })), '… New HSK 1 opens (no key exists yet on this server)');
  ok(isPlayer(await get('/yct-sim.html?sim=yct1-sim1', { jar: mover.jar })), '… the phone that opened YCT 1 keeps it (a device keeps an opened level)');
  ok(isLocked(await get('/yct-sim.html?sim=yct1-sim1', { jar: { dsim: mover.jar.dsim } })), '… but the session alone no longer opens YCT 1 (the account is New HSK 1 now)');
  // the New HSK 1 «Simulacro» homework (pack rounds made from the sims) still works for a logged-in kid
  const enter2 = await post('/api/homework/enter', { accessCode: '1002', studentCode: kids.nhsk.code });
  const sima = ((enter2.json && enter2.json.assignments) || []).find((a) => /simulacro/i.test(a.id + ' ' + a.title));
  ok(!!sima, 'the New HSK 1 kid still has the Simulacro homework');
  if (sima) {
    const as = await get('/api/homework/assignment/' + encodeURIComponent(sima.id) + '?accessCode=1002');
    ok(as.json && as.json.ok && (as.json.questions || []).length > 0, 'the Simulacro homework round loads its questions');
  }

  // ── 6. teacher ──
  section('teacher');
  const T = { 'X-Admin-Pw': encodeURIComponent(TEACHER) };
  for (const id of sims) {
    const r = await get('/api/hsk-sim/' + id, { headers: T });
    ok(r.json && r.json.ok && oldUrls(r.json.sim).length === 0, `teacher gets ${id}`);
  }
  const tsub = await post('/api/hsk-sim/newhsk1-sim1/submit', { studentCode: 'TEACH', answers: {} }, { headers: T });
  ok(tsub.json && tsub.json.ok && tsub.json.saved === false, 'a teacher\'s try is graded, never saved');
  const tj = {};
  const ts = await post('/api/sim-access/session', {}, { headers: T, jar: tj });
  ok(ts.json && ts.json.ok && ts.json.kind === 'teacher' && tj.dtd, 'the teacher code remembers the device as a teacher\'s');
  ok(isPlayer(await get('/yct-sim.html?sim=newhsk1-sim2', { jar: tj })) && isPlayer(await get('/hsk-sim.html?sim=hsk1-sim3', { jar: tj })), 'a teacher opens any sim page');
  ok((await post('/api/sim-access/session', {}, { headers: { 'X-Admin-Pw': 'nope' } })).status === 401, 'a wrong teacher code makes no session');
  const cat = await get('/api/sim-images', { headers: T });
  const catLinks = links(cat.json);
  ok(cat.json && cat.json.ok && catLinks.length > 100 && oldUrls(cat.json).length === 0, 'the «Describe la imagen» catalog comes as signed links');
  ok(catLinks[0] && mediaOk(await fetchMedia(catLinks[0])), 'a catalog picture loads');
  const tset = await get('/api/sets/' + encodeURIComponent('pack:newhsk1-simulacro-s1e'), { headers: T });
  ok(tset.json && (tset.json.questions || []).length > 0, 'a teacher still gets a Simulacro round\'s questions');

  // ── 7. a teacher's exam room ──
  section('teacher room (PIN)');
  const host0 = sock();
  const noPw = await emitAck(host0, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1' });
  ok(!noPw.pin && noPw.error, 'nobody opens an exam room without a teacher code');
  const created = await emitAck(host0, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: TEACHER });
  const pin = created.pin;
  ok(!!pin, 'the teacher opens a room (PIN ' + pin + ')');
  const kidS = sock();
  const joined = await emitAck(kidS, 'player:join', { pin, name: 'Room Kid', studentCode: '' });
  const pass = joined && joined.roomPass;
  ok(joined && joined.ok && pass, 'a kid joins the room with its PIN (and gets the room pass)');
  ok(isPlayer(await get('/yct-sim.html?pin=' + pin + '&code=ROOMK')) && isPlayer(await get('/hsk-sim.html?pin=' + pin)), 'the PIN opens the exam pages with no login');
  ok((await get('/api/hsk-sim/yct1-sim1?studentCode=ROOMK&pin=' + pin)).status === 401, 'a bare PIN (no join, so not on the roster) loads no sim');
  const P = '&pin=' + pin + '&pass=' + encodeURIComponent(pass);
  const rp = await get('/api/hsk-sim/yct1-sim1?studentCode=ROOMK' + P);
  ok(rp.json && rp.json.ok && scoredHaveNoKey(rp.json.sim), 'the room\'s sim loads with the PIN + pass');
  ok((await get('/api/hsk-sim/yct1-sim2?x=1' + P)).status === 401 && (await get('/api/hsk-sim/newhsk1-sim1?x=1' + P)).status === 401, 'the room pass opens no other sim');
  ok((await get('/api/hsk-sim/yct1-sim1?pin=999' + '&pass=' + encodeURIComponent(pass))).status === 401, 'the room pass works with its own PIN only');
  const roomLinks = links(rp.json && rp.json.sim);
  const roomAudio = roomLinks.find((u) => /\.m4a$/.test(u));
  const roomPic = roomLinks.find((u) => /\.(webp|jpe?g|png)$/.test(u));
  ok(roomAudio && mediaOk(await fetchMedia(roomAudio)) && roomPic && mediaOk(await fetchMedia(roomPic)), 'the room\'s recording and pictures load');
  ok((await fetchMedia('/sim-media/' + tokOf(roomAudio) + '/' + fileOf(two))).status === 403, 'a room link cannot open another sim\'s file');
  const asKid = await post('/api/hsk-sim/yct1-sim1/submit?x=1' + P, { studentCode: 'TEACHKID', answers: {}, pin }, { jar: tj });
  ok(asKid.json && asKid.json.ok && asKid.json.saved !== false, 'a teacher playing in a room (joined) plays as a kid (grade saved)');
  // nobody else takes the room over or closes it
  const intruder = sock();
  const reclaim = await emitAck(intruder, 'host:reclaim', { pin });
  ok(reclaim && reclaim.ok === false, 'a socket without the teacher code cannot take over the exam room');
  const noCode = await emitAck(intruder, 'host:end', { pin });
  const hostNoCode = await emitAck(host0, 'host:end', { pin });
  ok(noCode.ok === false && hostNoCode.ok === false && isPlayer(await get('/yct-sim.html?pin=' + pin)), 'closing the room always takes the teacher code');
  intruder.close();
  const ended = await emitAck(host0, 'host:end', { pin, password: TEACHER });
  ok(ended && ended.ok, 'the teacher closes the room («Cerrar la sala»)');
  await sleep(150);
  const after = await get('/yct-sim.html?pin=' + pin);
  ok(after.status === 401 && /"reason":"room"/.test(after.text), 'a closed room\'s PIN gets the «sala cerrada» card');
  ok((await get('/api/hsk-sim/yct1-sim1?x=1' + P)).status === 401, 'a closed room\'s PIN + pass load nothing');
  ok((await fetchMedia(roomAudio)).status === 403, 'a closed room\'s links stop working');
  const late = await post('/api/hsk-sim/yct1-sim1/submit?pin=' + pin, { studentCode: 'ROOMK', answers: { 'L1-1': 'F' }, pin, ticket: rp.json.sim.ticket });
  ok(late.json && late.json.ok && late.json.result, 'a kid who took it can still hand in (ticket) after the room closed');
  ok((await post('/api/hsk-sim/yct1-sim1/submit', { studentCode: 'ROOMK', answers: {}, ticket: rp.json.sim.ticket.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) })).status === 401, 'a tampered ticket hands in nothing');
  ok((await post('/api/hsk-sim/yct1-sim2/submit', { studentCode: 'ROOMK', answers: {}, ticket: rp.json.sim.ticket })).status === 401, 'a ticket of one sim hands in no other');
  kidS.close();
  host0.close();

  // ── 8. «Describe la imagen» in Modo Maestro: the picture on every phone of THAT room, only while it lives ──
  section('Modo Maestro picture');
  const wh = sock();
  const wc = await emitAck(wh, 'host:create', { gameType: 'warmup', password: TEACHER });
  const wkid = sock();
  await emitAck(wkid, 'player:join', { pin: wc.pin, name: 'Warm Kid' });
  const gotImg = new Promise((res) => { wkid.on('wu:image', (d) => res(d)); setTimeout(() => res(null), 4000); });
  wh.emit('wu:image', { pin: wc.pin, password: TEACHER, url: catLinks[0] });
  const d = await gotImg;
  ok(d && /^\/sim-media\//.test(d.url) && d.url !== catLinks[0], 'the picture reaches the kids as a link of this room');
  ok(d && mediaOk(await fetchMedia(d.url)), '… which loads on the phone');
  wh.emit('wu:image', { pin: wc.pin, password: TEACHER, url: '/assets/dralingo.png' });   // not a sim picture: ignored
  wh.emit('host:end-now', { pin: wc.pin });
  await sleep(300);
  ok(d && (await fetchMedia(d.url)).status === 403, 'the room ended: its picture link stops');
  wkid.close();
  wh.close();

  // ── 9. what stays open ──
  section('La Base is locked too (2026-10-15); the library and homework audio stay open');
  ok(isLocked(await get('/audios/yct1-base')) && (await get('/assets/audios/catalog.json')).status === 200 && (await get('/audios')).status === 200, 'La Base asks the key; /audios and its catalog are public');
  ok((await get('/base-media/yct1-base/base.json')).status === 401 && (await get('/assets/audios/yct1-base/base.json')).status === 404, 'La Base data is refused, its old address is gone');
  ok((await get('/base-media/yct1-base/base.json', { jar: kids.yct.jar })).status === 200, 'the enrolled YCT kid opens it');
  ok((await get('/homework.html?next=' + encodeURIComponent('/yct-sim.html?sim=yct1-sim1'))).status === 200, 'the login page takes ?next=');

  // ── 10. PIN guessing: an outside address (Cloudflare's CF-Connecting-IP, which a visitor can't fake through it) ──
  section('PIN guessing');
  for (let i = 0; i < 70; i++) await get('/yct-sim.html?pin=' + pin);   // kids reloading a closed room are not guessing
  const host1 = sock();
  const c1 = await emitAck(host1, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim4', password: TEACHER });
  ok(c1.pin && (await get('/api/hsk-sim/room/' + c1.pin)).status === 200, 'reloading a closed room\'s PIN 70 times pauses nothing');
  const OUT = { 'CF-Connecting-IP': '203.0.113.7' };
  let n = 0;
  for (let p = 100; n < 65; p++) {
    if (String(p) === String(c1.pin) || String(p) === String(pin)) continue;
    await get('/api/hsk-sim/room/' + p, { headers: Object.assign({ 'X-Forwarded-For': '10.0.0.' + (n % 250) + ', 162.158.0.9' }, OUT) });   // through Cloudflare, a new XFF in front each time
    n++;
  }
  ok((await get('/api/hsk-sim/room/' + c1.pin, { headers: OUT })).status === 429, '65 unknown PINs from one address pause its room lookups (a changing X-Forwarded-For does not help)');
  ok((await get('/api/hsk-sim/yct1-sim4?pin=' + c1.pin, { headers: OUT })).status === 401, '… and a PIN alone never loads the sim anyway');
  ok((await get('/api/hsk-sim/room/' + c1.pin)).status === 200, 'the class at another address is not affected');
  // straight to the server (not Cloudflare): a forged CF-Connecting-IP per request changes nothing, the real hop counts
  let m = 0;
  for (let p = 100; m < 65; p++) {
    if (String(p) === String(c1.pin) || String(p) === String(pin)) continue;
    await get('/api/hsk-sim/room/' + p, { headers: { 'X-Forwarded-For': '198.51.100.200', 'CF-Connecting-IP': '203.0.113.' + (m % 250) } });
    m++;
  }
  ok((await get('/api/hsk-sim/room/' + c1.pin, { headers: { 'X-Forwarded-For': '198.51.100.200', 'CF-Connecting-IP': '192.0.2.1' } })).status === 429,
    'a forged CF-Connecting-IP (not from Cloudflare) does not reset the count: the address that reached us is paused');
  // the same over the socket: PINs tried with player:join count too, and a paused address can't find an exam room
  const guesser = io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true, extraHeaders: { 'CF-Connecting-IP': '203.0.113.88' } });
  let k = 0;
  for (let p = 100; k < 61; p++) {
    if (String(p) === String(c1.pin) || String(p) === String(pin)) continue;
    await emitAck(guesser, 'player:join', { pin: String(p), name: 'G' + k });
    k++;
  }
  const blockedJoin = await emitAck(guesser, 'player:join', { pin: c1.pin, name: 'Guesser' });
  ok(blockedJoin && !blockedJoin.ok && !blockedJoin.roomPass && /Espera/.test(blockedJoin.error || ''), 'PINs guessed over the socket pause that address: no exam room, no room pass');
  guesser.close();
  const fine = sock();
  const fineJoin = await emitAck(fine, 'player:join', { pin: c1.pin, name: 'Real Kid' });
  ok(fineJoin && fineJoin.ok && fineJoin.roomPass, '… a kid at another address still joins the exam room');
  fine.close();
  ok(isPlayer(await get('/yct-sim.html?pin=' + c1.pin, { headers: OUT })), 'a live room\'s page still opens (it holds no exam): a class sharing that address is never locked out');
  host1.close();
}
