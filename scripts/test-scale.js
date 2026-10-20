#!/usr/bin/env node
// test-scale.js — the «fully scalable» update (2026-10-20, his ask; spec docs/specs/scale.md). Its OWN server (port
// 4460, never 3000, never the live site) on a temporary data folder with MADE-UP kids, guides and codes; every code and
// key is generated here and never printed. Checks:
//   1. cache headers by kind: a file asked for with a ?v= that a page names → a year, immutable; a guessed or odd ?v=
//      and any other query → as before (max-age=0); no query → phones 10 min + Cloudflare 1 day (its own header);
//      HTML pages, sw.js, the manifest, /api, the key screens and every locked file (/base-media, /sim-media,
//      /golden-media, the old /assets/ addresses of locked media) as before: never kept for others; a 304 and a Range
//      answer keep the same header
//   2. peak classes: the sampler keeps today's highest live rooms, classes (rooms with 5+ kids: an empty projector is
//      no class) and connected kids in data/usage-peaks.json (numbers only, 61 days, damaged entries dropped),
//      /api/_diag `peak30`, and scripts/health-check.js «Most classes at the same time (30 days)»: ✅, ⚠️ at 3 classes
//      or 90 kids, 🔴 at 5 classes or 150 kids (real server + a made-up _diag for each threshold)
//   3. the weekly backup key: missing / wrong key refused with the same answer as a wrong teacher code, counted in the
//      turnstile, 6 pulls a day, one backup at a time, no HEAD, it opens NOTHING else, the log never shows it; the
//      bundle has every JSON file + the guide PDFs + the sets and is whole; the signing key ONLY in the super admin's
//      download; with BACKUP_TOKEN unset (or short) the header means nothing; the laptop scripts (pull-backup.js:
//      saves, keeps 12 + one a month, logs, SUSPECT when accounts drop, refuses a wrong key; make-backup-token.js:
//      prints only «written»); a restore: scripts/unpack-backup.js refuses a cut file and a folder with files in it;
//      a fresh server on the unpacked folder has every kid, the archive, the super admin's code, the guides and the
//      peaks back, and a teacher device remembered before stays remembered (the key file, or SIM_LOCK_KEY_HEX for a
//      weekly file)
//   4. scripts/test-cache-versions.js --self-test
//   node scripts/test-scale.js        (--port 4460 · --keep to leave the server running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const { io } = require('socket.io-client');
const AssetRefs = require('../core/asset-refs');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4460));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-scale-'));
const LAPTOP = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-scale-laptop-'));   // a made-up laptop: key file + backups
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const TOKEN = crypto.randomBytes(32).toString('hex');
const SIGNKEY = crypto.randomBytes(32).toString('hex');   // the data disk's signing key (the server boots on it)
const secrets = new Set([SEED, LEGACY, TOKEN, SIGNKEY]);
const keep = { sup: '', weekly: '', dtd: '' };            // the two backups and a remembered teacher device, for the restore
const PULL = [path.join(ROOT, 'tools-for-root', 'backup', 'pull-backup.js'), path.join(ROOT, '..', 'tools', 'backup', 'pull-backup.js')].find((f) => fs.existsSync(f));
const MAKE = PULL && path.join(path.dirname(PULL), 'make-backup-token.js');

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function req(method, p, o = {}, port = PORT) {
  return new Promise((resolve, reject) => {
    const h = Object.assign({}, o.headers || {});
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buf.toString('utf8')); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, buf, text: buf.toString('utf8'), json });
      });
    });
    r.on('error', reject);
    r.end();
  });
}
const get = (p, o) => req('GET', p, o);
let ipN = 10;
const at = (extra) => ({ headers: Object.assign({ 'CF-Connecting-IP': '198.51.100.' + (ipN++) }, extra || {}) });
const cc = (r) => String(r.headers['cache-control'] || '');
const cdn = (r) => String(r.headers['cloudflare-cdn-cache-control'] || '');
const LONG = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=600';
const SHORT_CDN = 'public, max-age=86400, stale-while-revalidate=86400';
const BEFORE = 'public, max-age=0';
const PAGE = 'no-cache, no-store, must-revalidate';
// may a browser or Cloudflare keep this answer for anyone?
const sharedCacheable = (r) => [cc(r), cdn(r), String(r.headers['cdn-cache-control'] || '')].some((h) => {
  const c = h.toLowerCase();
  return /immutable|s-maxage/.test(c) || (/public/.test(c) && /max-age=[1-9]/.test(c)) || (h !== cc(r) && /max-age=[1-9]/.test(c));
});

// ── the made-up data folder ──
const DAY = 86400e3;
const PARKED = 'student-records.unreadable-1729000000000.json', PARKED_BYTES = Buffer.from('{"AB12CD":{"code":"AB1');
const kidCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('');
const KIDS = [kidCode(), kidCode()], ARCH = kidCode();
const dayKey = (t) => new Date(t - 6 * 3600e3).toISOString().slice(0, 10);   // his clock (UTC−6), like core/usage-peaks.js
function seed() {
  const now = Date.now();
  const recs = {};
  KIDS.forEach((c, i) => { recs[c] = { code: c, displayName: 'Prueba ' + i, avatar: null, classroomCode: null, level: 'yct1', firstSeen: now - DAY, lastSeen: now, sentencesBuilt: [] }; });
  fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify(recs));
  fs.writeFileSync(path.join(DATA, 'student-archive.json'), JSON.stringify({ [ARCH]: { code: ARCH, displayName: 'Archivada Prueba', level: 'yct1', firstSeen: now - 90 * DAY, lastSeen: now - 60 * DAY, sentencesBuilt: [] } }));
  fs.mkdirSync(path.join(DATA, 'guides'), { recursive: true });
  const g1 = Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(12 * 1048576 + 1)]);   // big: read and sent in pieces
  const g2 = Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(2048)]);
  fs.writeFileSync(path.join(DATA, 'guides', 'gtest001.pdf'), g1);
  fs.writeFileSync(path.join(DATA, 'guides', 'gtest002.pdf'), g2);
  fs.writeFileSync(path.join(DATA, 'guides.json'), JSON.stringify({
    gtest001: { id: 'gtest001', title: 'Guía de prueba 1', exp: 'exp1', classroomCode: null, filename: 'gtest001.pdf', size: g1.length, ts: now },
    gtest002: { id: 'gtest002', title: 'Guía de prueba 2', exp: 'exp2', classroomCode: null, filename: 'gtest002.pdf', size: g2.length, ts: now } }));
  fs.mkdirSync(path.join(DATA, 'sets'), { recursive: true });
  fs.writeFileSync(path.join(DATA, 'sets', 'familia-niños.csv'), 'pinyin,es\nni hao,hola\n');
  fs.writeFileSync(path.join(DATA, 'sim-lock.key'), SIGNKEY);
  fs.writeFileSync(path.join(DATA, PARKED), PARKED_BYTES);   // a broken copy the server parked for recovery
  // peaks: 3 classes 10 days ago (inside 30 days), 9 classes 40 days ago (outside), old days to prune, damaged entries
  const days = {};
  for (let i = 62; i <= 69; i++) days[dayKey(now - i * DAY)] = { rooms: 1, classes: 1, players: 8 };
  days[dayKey(now - 40 * DAY)] = { rooms: 9, classes: 9, players: 200 };
  days[dayKey(now - 10 * DAY)] = { rooms: 4, classes: 3, players: 61, name: 'Sofía', pin: '4321' };
  days[dayKey(now - 5 * DAY)] = { rooms: 'mucho', classes: null, players: -3 };
  days['hack'] = { rooms: 99, classes: 99, players: 99 };
  fs.writeFileSync(path.join(DATA, 'usage-peaks.json'), JSON.stringify({ v: 1, days }));
  return { g1, g2 };
}
const GUIDES = seed();

let srv = null, allLog = '';
async function startServer(extraEnv) {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: '', SIM_LOCK_KEY_HEX: '',
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, DRALY_PEAKS_SAMPLE_MS: '250', DRALY_PEAKS_WRITE_MS: '600', BACKUP_TOKEN: '' }, extraEnv || {}),
  });
  srv.stdout.on('data', (d) => { allLog += d; });
  srv.stderr.on('data', (d) => { allLog += d; });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { const r = await get('/health'); if (r.status === 200) return; } catch (_) {}
  }
  let tail = allLog.slice(-2000);
  secrets.forEach((s) => { tail = tail.split(s).join('<secret>'); });
  console.error('the server did not start:\n' + tail);
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
  await startServer({ BACKUP_TOKEN: TOKEN });
  let crashed = false;
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + String(e && e.stack || e).split(SEED).join('<seed>').split(TOKEN).join('<token>')); }
  if (!KEEP) await stopServer();
  if (!crashed) {
    const leaked = [...secrets].filter((c) => c && allLog.includes(c));
    ok(!leaked.length, 'no code or key reaches the server log (' + leaked.length + ' found)');
  }
  if (!KEEP) { for (const d of [DATA, LAPTOP]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } }
  console.log(failed ? `test-scale: ${failed} FAILED, ${passed} passed` : `test-scale: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();

async function run() {
  await cacheHeaders();
  await peaks();
  await backup();
  section('the version guard (scripts/test-cache-versions.js --self-test)');
  const g = spawnSync(process.execPath, [path.join(__dirname, 'test-cache-versions.js'), '--self-test'], { encoding: 'utf8' });
  ok(g.status === 0, 'the guard decides right on made-up pages: ' + String(g.stdout).trim().split('\n').pop());
}

// ── 1. cache headers ──────────────────────────────────────────────────────────────────────────────────────────────
async function cacheHeaders() {
  section('cache headers by kind');
  // real versions, as today's pages ask for them
  const known = AssetRefs.knownVersions(ROOT);
  const pick = (re) => { for (const [p, vs] of known) if (re.test(p) && fs.existsSync(path.join(ROOT, 'public', p))) return { p, v: [...vs][0] }; return null; };
  const js = pick(/^\/js\/[^/]+\.js$/), css = pick(/^\/css\/[^/]+\.css$/), asset = pick(/^\/assets\/(?!png-library\/).+\.(webp|png|jpg|mp3)$/);
  ok(!!(js && css && asset), 'today\'s pages name versioned scripts, styles and assets (' + [js, css, asset].map((x) => x && x.p).join(', ') + ')');
  const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
  const jsL = await get(enc(js.p) + '?v=' + js.v);
  ok(jsL.status === 200 && cc(jsL) === LONG, js.p + '?v=<its version in the pages> → kept a year, immutable (' + cc(jsL) + ')');
  ok(cc(await get(enc(css.p) + '?v=' + css.v)) === LONG, css.p + ': the same for a style');
  ok(cc(await get(enc(asset.p) + '?v=' + asset.v)) === LONG, asset.p + ': the same for an asset');
  const guess = await get(enc(js.p) + '?v=29991231z');
  ok(guess.status === 200 && cc(guess) === BEFORE, 'a guessed future ?v= (not in any page) → as before, never a year (' + cc(guess) + ')');
  const bare = await get(enc(js.p));
  ok(cc(bare) === SHORT && cdn(bare) === SHORT_CDN, 'no query → phones 10 min, Cloudflare 1 day + stale-while-revalidate in its own header');
  const pic = await get('/assets/app/favicon-32.png');
  ok(pic.status === 200 && cc(pic) === SHORT && cdn(pic) === SHORT_CDN, '/assets/ picture without a query → 10 min / 1 day');
  const mp3 = await get('/assets/escape/dash.mp3');
  ok(mp3.status === 200 && cc(mp3) === SHORT, 'a sound under /assets/ → 10 min / 1 day');
  const part = await get(enc(asset.p) + '?v=' + asset.v, { headers: { Range: 'bytes=0-99' } });
  ok(part.status === 206 && cc(part) === LONG && part.buf.length === 100, 'a Range answer keeps its header (206)');
  const nm = await get(enc(js.p) + '?v=' + js.v, { headers: { 'If-None-Match': jsL.headers.etag } });
  ok(nm.status === 304 && cc(nm) === LONG, 'a 304 (phone asks again) keeps the year');
  const png = fs.readdirSync(path.join(ROOT, 'public', 'assets', 'png-library')).find((f) => /\.(png|gif|webp)$/i.test(f));
  if (png) ok(cc(await get('/assets/png-library/' + encodeURIComponent(png))) === LONG, 'png-library keeps its year (as before)');
  for (const q of ['?v=', '?v=a&v=b', '?v=%3Cscript%3E', '?v=' + 'x'.repeat(80), '?t=123', '?V=1', '?v=' + js.v + '&x=1', '?x=1&v=' + js.v]) {
    const r = await get(enc(js.p) + q);
    ok(cc(r) === BEFORE && !cdn(r), 'another query (' + q.slice(0, 24) + ') → as before (max-age=0)');
  }

  section('pages, the app shell, the API: as before');
  for (const p of ['/', '/index.html', '/homework.html', '/maestro.html', '/audios.html', '/player.html', '/host-kingdoms.html', '/offline.html', '/index.html?v=3']) {
    const r = await get(p);
    ok(r.status === 200 && cc(r) === PAGE, p + ' → no-store (' + cc(r) + ')');
  }
  for (const p of ['/sw.js', '/sw.js?v=9', '/manifest.webmanifest']) {
    const r = await get(p);
    ok(r.status === 200 && cc(r) === BEFORE, p + ' → unchanged public, max-age=0 (' + cc(r) + ')');
  }
  const diag = await get('/api/_diag');
  ok(diag.status === 200 && /no-store/.test(cc(diag)), '/api/_diag → no-store');
  for (const p of ['/api/ruta-dorada', '/api/teacher-device', '/api/level-access?level=yct1', '/api/room-alive/123']) {
    const r = await get(p, at());
    ok(!sharedCacheable(r), p + ' → never kept for others (' + (cc(r) || 'none') + ')');
  }

  section('locked things: never public, never kept by Cloudflare');
  const locked = ['/base-media/yct1-base/base.json', '/base-media/yct1-base/book.pdf', '/sim-media/abc/def', '/golden-media/yct1sim/1/p01',
    '/golden-media/yct1sim/book.pdf', '/audios/yct1-base', '/audios/yct1/entrenamiento', '/audios/yct1/libro/1', '/yct-sim.html',
    '/hsk-sim.html?sim=hsk1-sim1', '/assets/study/yct1-vocabulario.pdf', '/assets/YCT%20SIMULATIONS/x.webp', '/assets/audios/yct1-base/base.json',
    '/api/golden/yct1/1', '/api/ruta/train?level=yct1'];
  for (const p of locked) {
    const r = await get(p, at());
    ok(!sharedCacheable(r), p + ' → ' + r.status + ', not cacheable for others (' + (cc(r) || 'none') + ')');
    ok(r.status !== 200 || /no-store|private/.test(cc(r)) || /text\/html/.test(r.headers['content-type'] || ''), p + ' → a refusal or a page, never the locked file');
  }
}

// ── 2. peak classes ───────────────────────────────────────────────────────────────────────────────────────────────
const sock = () => io('http://127.0.0.1:' + PORT, { transports: ['websocket'], forceNew: true, extraHeaders: { 'CF-Connecting-IP': '203.0.113.' + (ipN++) } });
const emitAck = (s, ev, payload, ms = 5000) => new Promise((res) => {
  const t = setTimeout(() => res({ timeout: true }), ms);
  s.emit(ev, payload, (r) => { clearTimeout(t); res(r || {}); });
});
const readPeaks = () => JSON.parse(fs.readFileSync(path.join(DATA, 'usage-peaks.json'), 'utf8'));
// (async: the made-up _diag below is served by THIS process, so its event loop must keep running)
function health(port) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(__dirname, 'health-check.js'), '--no-render', '--no-save', '--live', 'http://127.0.0.1:' + (port || PORT)]);
    let out = '';
    const t = setTimeout(() => p.kill(), 120000);
    p.stdout.on('data', (d) => { out += d; });
    p.on('exit', () => { clearTimeout(t); resolve(out.split('\n').find((l) => /Most classes at the same time/.test(l)) || ''); });
  });
}
async function peaks() {
  section('peak classes (core/usage-peaks.js, /api/_diag, health-check)');
  const d0 = (await get('/api/_diag')).json || {};
  ok(d0.peak30 && d0.peak30.classes === 3 && d0.peak30.rooms === 4 && d0.peak30.players === 61,
    '_diag peak30 = the 3 classes of 10 days ago, not the 9 of 40 days ago (' + JSON.stringify(d0.peak30) + ')');
  ok(d0.peak30 && Object.values(d0.peak30).every((v) => typeof v === 'number'), '… numbers only');
  const row0 = await health();
  ok(/⚠️/.test(row0) && /\b3 classes\b/.test(row0) && /61 kids/.test(row0), 'health-check: 3 classes = the warning (' + row0.slice(0, 100) + ')');
  const hosts = [], kids = [];
  const open = async (n) => {
    const s = sock();
    const r = await emitAck(s, 'host:create', { gameType: 'mochi-mash', password: SEED });
    hosts.push(s);
    for (let i = 0; i < n; i++) {
      const k = sock();
      kids.push(k);
      const j = await emitAck(k, 'player:join', { pin: r.pin, name: 'Niño ' + hosts.length + '-' + i });
      if (!j.ok) throw new Error('a kid could not join: ' + JSON.stringify(j));
    }
    return r;
  };
  const r1 = await open(2);
  ok(!!(r1 && r1.pin), 'a class opens (made-up teacher code)');
  await open(1);
  for (let i = 0; i < 4; i++) await open(0);   // projectors left open with nobody in them
  await sleep(1500);
  const d1 = (await get('/api/_diag')).json || {};
  ok(d1.liveRooms === 6, '_diag liveRooms = 6 (as before: a connected projector counts)');
  let f = readPeaks();
  const today = () => f.days[dayKey(Date.now())];
  ok(today() && today().rooms === 6 && today().classes === 0 && today().players === 3, "today on disk: 6 rooms, 0 classes (no room has 5 kids), 3 kids (" + JSON.stringify(today()) + ')');
  ok((((await get('/api/_diag')).json || {}).peak30 || {}).classes === 3, 'empty projectors never raise the classes peak');
  const keys = Object.keys(f.days);
  ok(keys.length <= 61 && keys.every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)), 'the file keeps 61 days at most, dates only (' + keys.length + ' days)');
  ok(!keys.includes(dayKey(Date.now() - 65 * DAY)), 'days older than 60 are dropped');
  const txt = fs.readFileSync(path.join(DATA, 'usage-peaks.json'), 'utf8');
  ok(!/Sof|4321|Niño|mucho/.test(txt) && Object.values(f.days).every((d) => Object.keys(d).sort().join() === 'classes,players,rooms'
    && ['rooms', 'classes', 'players'].every((k) => Number.isInteger(d[k]) && d[k] >= 0)), 'numbers only: no name, PIN or text survives');
  ok(!(r1.pin && txt.includes('"' + r1.pin + '"')), '… not even a live PIN');
  for (let i = 0; i < 5; i++) await open(5);   // five real classes
  await sleep(1500);
  const d2 = (await get('/api/_diag')).json || {};
  ok(d2.peak30 && d2.peak30.classes === 5 && d2.peak30.rooms === 11 && d2.peak30.players === 61,
    '5 rooms with 5 kids → peak30 classes 5, rooms 11 (kids still 61 from 10 days ago) (' + JSON.stringify(d2.peak30) + ')');
  const row1 = await health();
  ok(/🔴/.test(row1) && /\b5 classes\b/.test(row1) && /Standard/.test(row1), 'health-check: 5 classes = the red line, «move up to Standard» (' + row1.slice(0, 100) + ')');
  hosts.concat(kids).forEach((s) => s.close());
  await sleep(1200);
  f = readPeaks();
  ok(today().classes === 5 && today().players === 28, 'the peak stays after the classes end (5 classes, 28 kids)');

  section('health-check thresholds (a made-up /api/_diag)');
  let diag = {};
  const fake = http.createServer((q, s) => { if (q.url.startsWith('/api/_diag')) { s.setHeader('Content-Type', 'application/json'); s.end(JSON.stringify(diag)); } else { s.statusCode = 404; s.end(); } });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const fp = fake.address().port;
  const cases = [
    [{ rooms: 2, classes: 2, players: 60, days: 30 }, /✅/, 'under 3 classes and 90 kids: ✅'],
    [{ rooms: 2, classes: 2, players: 95, days: 30 }, /⚠️/, '95 kids in 2 classes: the warning (kids)'],
    [{ rooms: 4, classes: 1, players: 160, days: 30 }, /🔴/, '160 kids: the red line (kids)'],
    [{ rooms: 6, classes: 0, players: 0, days: 30 }, /✅/, '6 empty projectors: ✅ (no class)'],
    [{ rooms: 4, players: 10, days: 30 }, /⚠️.*\b4 classes\b/, 'an older server without classes: its rooms count'],
  ];
  for (const [p, re, msg] of cases) {
    diag = { ok: true, studentRecordsBytes: 1000, uptimeHours: 1, rooms: 0, peak30: p };
    ok(re.test(await health(fp)), 'health-check: ' + msg);
  }
  diag = { ok: true, studentRecordsBytes: 1000, uptimeHours: 1, rooms: 0 };
  ok(/unknown/.test(await health(fp)), 'health-check: a server without peak30 → «unknown» (deploy the update)');
  fake.close();
  const help = spawnSync(process.execPath, [path.join(__dirname, 'health-check.js'), '--help'], { encoding: 'utf8' });
  ok(help.status === 0 && /--no-render/.test(help.stdout), 'health-check --help answers without reading any key');
}

// ── 3. the weekly backup ──────────────────────────────────────────────────────────────────────────────────────────
function bundleOk(b, label, withKey) {
  ok(b && b._meta && b._meta.format === 2 && b._end && b._end.ok === true, label + ': format 2, whole (_end ok)');
  const recs = b && b.files && b.files['student-records.json'];
  ok(recs && KIDS.every((c) => recs[c]), label + ': the student records (every made-up kid)');
  ok(b && b.files && b.files['student-archive.json'] && b.files['student-archive.json'][ARCH], label + ': the archive');
  ok(b && b.files && b.files['guides.json'] && b.files['usage-peaks.json'], label + ': the other data files (guides.json, usage-peaks.json…)');
  const g = (b && b.guides) || {};
  ok(g['gtest001.pdf'] && Buffer.from(g['gtest001.pdf'], 'base64').equals(GUIDES.g1) && g['gtest002.pdf'] && Buffer.from(g['gtest002.pdf'], 'base64').equals(GUIDES.g2),
    label + ': both guide PDFs, byte for byte (one of 12 MB, sent in pieces)');
  ok(b && b.sets && Buffer.from(b.sets['familia-niños.csv'] || '', 'base64').toString() === 'pinyin,es\nni hao,hola\n', label + ': the uploaded sets (a name with ñ)');
  ok(b && b.raw && Buffer.from(b.raw[PARKED] || '', 'base64').equals(PARKED_BYTES) && !(b.files || {})[PARKED],
    label + ': a parked unreadable file travels as its bytes (raw), and is no error');
  if (withKey) ok(b && b.keys && b.keys['sim-lock.key'] === SIGNKEY, label + ': the signing key (the super admin\'s own download only)');
  else ok(b && b.keys && !Object.keys(b.keys).length, label + ': NO signing key (a weekly file that leaks cannot sign devices)');
}
async function backup() {
  section('the weekly backup key');
  const B = '/api/admin/backup';
  const none = await get(B, at());
  const wrong = await get(B, at({ 'X-Backup-Token': crypto.randomBytes(32).toString('hex') }));
  const emptyTok = await get(B, at({ 'X-Backup-Token': '' }));
  const wrongCode = await get(B, at({ 'X-Admin-Pw': 'T-' + rnd(5) }));
  ok(none.status === 401 && wrong.status === 401 && emptyTok.status === 401, 'no key, a wrong key, an empty key: 401');
  ok(wrong.text === none.text && wrong.text === wrongCode.text, '… with exactly the answer of a wrong teacher code (no hint): ' + wrong.text);
  ok(/no-store/.test(cc(wrong)), '… never cached');
  ok((await get(B, at({ 'X-Backup-Token': TOKEN.slice(0, 32) }))).status === 401, 'half of the right key: 401');
  ok((await req('HEAD', B, at({ 'X-Backup-Token': TOKEN }))).status === 405, 'a HEAD is refused (it would read every file for nothing)');

  // a remembered teacher device (signed with the disk's key): it must still be remembered after a restore
  const dev = await req('POST', '/api/teacher-device', at({ 'X-Admin-Pw': encodeURIComponent(SEED) }));
  const dtd = ((dev.headers['set-cookie'] || []).find((c) => /^dtd=/.test(c)) || '').split(';')[0];
  keep.dtd = dtd;
  ok(dev.status === 200 && !!dtd && (((await get('/api/teacher-device', { headers: { Cookie: dtd } })).json) || {}).remembered === true, 'a teacher device is remembered (dtd)');

  const sup = await get(B, at({ 'X-Admin-Pw': encodeURIComponent(SEED) }));
  keep.sup = sup.text;
  ok(sup.status === 200 && /attachment; filename="draly-backup-\d{4}-\d{2}-\d{2}\.json"/.test(sup.headers['content-disposition'] || ''), 'the super admin\'s button: 200, a draly-backup-<date>.json download');
  ok(/no-store/.test(cc(sup)) && /no-store/.test(cdn(sup)), '… no-store, also for Cloudflare');
  ok(sup.headers['transfer-encoding'] === 'chunked', '… streamed (chunked)');
  bundleOk(sup.json, 'super admin', true);
  ok(sup.json && sup.json._meta.by === 'super admin', '… marked as pulled by the super admin');
  const teachers = (((await get('/api/admin/teachers', at({ 'X-Admin-Pw': encodeURIComponent(SEED) }))).json) || {}).teachers || [];
  const regular = teachers.find((t) => !t.isSuperAdmin && t.teacherId);
  if (regular) {
    secrets.add(regular.teacherId);
    ok((await get(B, at({ 'X-Admin-Pw': encodeURIComponent(regular.teacherId) }))).status === 403, 'a regular teacher: 403 (as before)');
  }

  const tk = await get(B, at({ 'X-Backup-Token': TOKEN }));
  keep.weekly = tk.text;
  ok(tk.status === 200, 'the weekly key: 200');
  bundleOk(tk.json, 'weekly key', false);
  ok(tk.json && tk.json._meta.by === 'weekly key', '… marked as pulled by the weekly key');
  ok((await get(B, at({ 'X-Backup-Token': '  ' + TOKEN + '  ' }))).status === 200, '… spaces around it are fine (a file\'s line end)');
  await sleep(200);
  ok(/backup pulled by the weekly key \(from 198\.51\.100\.\d+\)/.test(allLog), 'the log says «backup pulled by the weekly key (from <address>)»');

  section('one backup at a time');
  const slow = await new Promise((resolve) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, method: 'GET', path: B, headers: { 'X-Admin-Pw': encodeURIComponent(SEED), 'CF-Connecting-IP': '198.51.100.' + (ipN++) } }, (res) => {
      res.pause();                                // a reader that stops reading: the server waits on a full connection
      resolve({ r, res });
    });
    r.end();
  });
  await sleep(30);
  const second = await get(B, at({ 'X-Admin-Pw': encodeURIComponent(SEED) }));
  ok(second.status === 429 && /respaldo/.test((second.json || {}).error || ''), 'a second backup while one is still going: 429 «ya se está haciendo un respaldo»');
  slow.res.destroy(); slow.r.destroy();
  await sleep(800);
  ok((await get(B, at({ 'X-Admin-Pw': encodeURIComponent(SEED) }))).status === 200, 'the reader that left frees it at once');

  section('the weekly key opens nothing else');
  const T = { 'X-Backup-Token': TOKEN };
  for (const p of ['/api/admin/students', '/api/admin/teachers', '/api/admin/disk-status', '/api/admin/level-keys', '/api/teacher-device',
    '/base-media/yct1-base/base.json', '/golden-media/yct1sim/book.pdf', '/api/ruta-dorada']) {
    const r = await get(p, at(T));
    const opened = r.status === 200 && ((p === '/api/teacher-device' && r.json && r.json.remembered)
      || (p === '/api/ruta-dorada' && r.json && (r.json.teacher || r.json.superAdmin || (r.json.modules || []).some((m) => m.open)))
      || !/^\/api\/(teacher-device|ruta-dorada)$/.test(p));
    ok(!opened, p + ' with the weekly key → still closed (' + r.status + ')');
  }
  for (const p of ['/api/admin/students', '/api/admin/teachers']) {
    ok((await get(p, at({ 'X-Admin-Pw': encodeURIComponent(TOKEN) }))).status === 401, p + ' with the key as a teacher code → 401');
  }
  const asCode = await req('POST', '/api/teacher-device', at({ 'X-Admin-Pw': encodeURIComponent(TOKEN) }));
  ok(asCode.status !== 200 && !(asCode.headers['set-cookie'] || []).some((c) => /^dtd=/.test(c) && !/Max-Age=0/.test(c)), 'the key typed as a teacher code remembers no device');
  const s = sock();
  const hc = await emitAck(s, 'host:create', { gameType: 'mochi-mash', password: TOKEN });
  s.close();
  ok(!hc.pin, 'the key as a teacher code opens no class (socket)');

  section('the turnstile and the daily limit');
  const ip = '198.51.100.' + (ipN++);
  for (let i = 0; i < 10; i++) await get(B, { headers: { 'CF-Connecting-IP': ip, 'X-Backup-Token': crypto.randomBytes(32).toString('hex') } });
  ok((await get(B, { headers: { 'CF-Connecting-IP': ip, 'X-Backup-Token': TOKEN } })).status === 429, '10 wrong keys from one address: that address waits, even with the right key (429)');
  ok((await get(B, { headers: { 'CF-Connecting-IP': ip, 'X-Admin-Pw': encodeURIComponent('T-' + rnd(5)) } })).status === 429, '… the same turnstile as the teacher codes');
  // pulls so far: 2 (tk + the spaced one); the laptop script makes 3 more (OK, SUSPECT, --accept)
  if (PULL) await laptopScripts();
  else console.log('  (tools-for-root/backup/ and ../tools/backup/ not here: the laptop scripts are skipped)');
  let n = PULL ? 5 : 2;
  while (n < 6) { const r = await get(B, at(T)); if (r.status === 200) n++; else break; }
  ok(n === 6, 'six pulls in a day work');
  const seventh = await get(B, at(T));
  ok(seventh.status === 429 && /respaldos hoy/.test((seventh.json || {}).error || ''), 'the 7th pull in 24 h: 429 «… respaldos hoy, espera a mañana»');
  ok((await get(B, at({ 'X-Admin-Pw': encodeURIComponent(SEED) }))).status === 200, 'the super admin\'s button is never limited by it');

  section('BACKUP_TOKEN unset or short: the header means nothing');
  await stopServer();
  await startServer({ BACKUP_TOKEN: '' });
  const off = await get(B, at(T));
  ok(off.status === 401 && off.text === none.text, 'unset: the right key → the same 401 as no key');
  ok((await get(B, at({ 'X-Admin-Pw': encodeURIComponent(SEED) }))).status === 200, 'unset: the super admin still downloads');
  await stopServer();
  const SHORTKEY = 'short-' + rnd(6);
  secrets.add(SHORTKEY);
  await startServer({ BACKUP_TOKEN: SHORTKEY });
  ok((await get(B, at({ 'X-Backup-Token': SHORTKEY }))).status === 401, 'shorter than 32 characters: OFF (its own value → 401)');
  ok(/BACKUP_TOKEN is shorter than 32 characters/.test(allLog), '… and the log says why');
  await restore();
}

async function laptopScripts() {
  section('the laptop scripts (pull-backup.js, make-backup-token.js)');
  const keyFile = path.join(LAPTOP, '.dralingo', 'backup-token');
  const outDir = path.join(LAPTOP, 'DralingoBackups', 'platform');
  const env = Object.assign({}, process.env, { DRALY_BACKUP_TOKEN_FILE: keyFile, DRALY_BACKUP_DIR: outDir, DRALY_BACKUP_RETRY_MS: '50' });
  const mk1 = spawnSync(process.execPath, [MAKE], { env, encoding: 'utf8' });
  const made = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '';
  ok(mk1.status === 0 && mk1.stdout.trim() === 'written' && !mk1.stderr, 'make-backup-token: prints only «written»');
  ok(/^[a-f0-9]{64}$/.test(made), '… a 32-byte key in the file (64 hex characters)');
  const mk2 = spawnSync(process.execPath, [MAKE], { env, encoding: 'utf8' });
  ok(mk2.status === 0 && /^kept/.test(mk2.stdout) && fs.readFileSync(keyFile, 'utf8').trim() === made, '… a second run keeps the key (Render already has it)');
  const mk3 = spawnSync(process.execPath, [MAKE, '--new'], { env, encoding: 'utf8' });
  ok(mk3.stdout.trim() === 'written' && fs.readFileSync(keyFile, 'utf8').trim() !== made, '… --new makes a fresh one');
  secrets.add(made); secrets.add(fs.readFileSync(keyFile, 'utf8').trim());

  // the wrong key on this laptop: refused, logged, exit 1, nothing saved
  const bad = spawnSync(process.execPath, [PULL, '--url', 'http://127.0.0.1:' + PORT], { env, encoding: 'utf8', timeout: 60000 });
  ok(bad.status === 1 && /refused the backup key/.test(bad.stderr), 'pull-backup with a key Render does not have: exit 1, «refused the backup key»');
  // older backups: 13 weekly ones this summer + one a month back to last year + a file of his own
  fs.mkdirSync(outDir, { recursive: true });
  const fake = (name, daysAgo) => { const f = path.join(outDir, name); fs.writeFileSync(f, zlib.gzipSync('{}')); const t = new Date(Date.now() - daysAgo * DAY); fs.utimesSync(f, t, t); };
  for (let i = 1; i <= 13; i++) fake(`draly-backup-2026-07-${String(i + 10).padStart(2, '0')}.json.gz`, 120 - i);   // July: the newest 12 + 1
  for (let m = 1; m <= 6; m++) fake(`draly-backup-2026-0${m}-01.json.gz`, 300 - m * 30);                         // one a month, Jan-Jun
  fake('draly-backup-2025-03-01.json.gz', 600);                                                                      // older than a year of months
  fs.writeFileSync(path.join(outDir, 'mis-notas.txt'), 'no tocar');
  fs.writeFileSync(keyFile, TOKEN + '\r\n');
  const good = spawnSync(process.execPath, [PULL, '--url', 'http://127.0.0.1:' + PORT], { env, encoding: 'utf8', timeout: 120000 });
  ok(good.status === 0 && /OK/.test(good.stdout), 'pull-backup: exit 0 (' + String(good.stdout || good.stderr).trim().slice(20, 150) + ')');
  const all = fs.readdirSync(outDir);
  const gz = all.filter((x) => /^draly-backup-.*\.json\.gz$/.test(x));
  const todays = gz.find((x) => x.startsWith('draly-backup-' + new Date(Date.now() - new Date().getTimezoneOffset() * 60e3).toISOString().slice(0, 10)));
  ok(!!todays, 'today\'s file draly-backup-<date>.json.gz');
  if (todays) bundleOk(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(outDir, todays))).toString('utf8')), 'the saved file', false);
  // kept: today + the 11 newest of July (12), + one a month: July (in), Jun…Jan (6) → 18; gone: the 2 oldest July ones, 2025-03
  ok(gz.length === 18 && !gz.includes('draly-backup-2026-07-11.json.gz') && gz.includes('draly-backup-2026-01-01.json.gz') && !gz.includes('draly-backup-2025-03-01.json.gz'),
    'the newest 12 stay, plus the newest of each month for a year; older ones go (' + gz.length + ' files)');
  ok(all.includes('mis-notas.txt') && all.includes('backup-log.txt'), 'his other files stay; the log is there');
  let log = fs.readFileSync(path.join(outDir, 'backup-log.txt'), 'utf8').trim().split('\n');
  ok(log.length === 2 && /FAILED/.test(log[0]) && /\bOK\b/.test(log[1]) && /\b\d+ kids \(\+ 1 archived\)/.test(log[1]) && /2 guides/.test(log[1]), 'one line per run: FAILED, then OK with the counts (' + log[1].slice(20, 150) + ')');
  // a sudden drop of accounts: the last OK line says many more → SUSPECT, saved, nothing removed
  fs.appendFileSync(path.join(outDir, 'backup-log.txt'), '2026-10-19 07:00:00  OK       draly-backup-2026-10-19.json.gz · 300 kids (+ 20 archived) · 9 data files\n');
  const before = fs.readdirSync(outDir).length;
  await sleep(1100);
  const sus = spawnSync(process.execPath, [PULL, '--url', 'http://127.0.0.1:' + PORT], { env, encoding: 'utf8', timeout: 120000 });
  log = fs.readFileSync(path.join(outDir, 'backup-log.txt'), 'utf8').trim().split('\n');
  ok(sus.status === 1 && /SUSPECT/.test(log[log.length - 1]) && fs.readdirSync(outDir).length === before + 1, 'far fewer accounts than the last good backup: SUSPECT, exit 1, saved, nothing removed');
  await sleep(1100);
  const acc = spawnSync(process.execPath, [PULL, '--url', 'http://127.0.0.1:' + PORT, '--accept'], { env, encoding: 'utf8', timeout: 120000 });
  log = fs.readFileSync(path.join(outDir, 'backup-log.txt'), 'utf8').trim().split('\n');
  ok(acc.status === 0 && /\bOK\b/.test(log[log.length - 1]), '--accept (the drop was on purpose): OK, the new «last good» backup');
  const out = good.stdout + good.stderr + bad.stdout + bad.stderr + sus.stdout + sus.stderr + mk1.stdout + mk2.stdout + mk3.stdout + log.join('\n');
  ok(![...secrets].some((x) => x && out.includes(x)), 'no key or code in what the scripts print or log');
  const down = spawnSync(process.execPath, [PULL, '--url', 'http://127.0.0.1:1'], { env, encoding: 'utf8', timeout: 60000 });
  ok(down.status === 1 && /could not reach/.test(down.stderr), 'no server: exit 1, «could not reach …»');
}

// a disaster: the disk is gone. One backup file → scripts/unpack-backup.js → a fresh server on that folder
async function restore() {
  section('a restore (scripts/unpack-backup.js → a server on the unpacked folder)');
  const UNPACK = path.join(__dirname, 'unpack-backup.js');
  const file = path.join(LAPTOP, 'draly-backup-restore.json.gz');
  fs.writeFileSync(file, zlib.gzipSync(keep.sup));
  const cut = path.join(LAPTOP, 'cut.json');
  fs.writeFileSync(cut, keep.sup.slice(0, Math.floor(keep.sup.length / 2)));
  const rCut = spawnSync(process.execPath, [UNPACK, cut, path.join(LAPTOP, 'never')], { encoding: 'utf8' });
  ok(rCut.status === 1 && /cut or broken/.test(rCut.stderr) && !fs.existsSync(path.join(LAPTOP, 'never')), 'a cut backup is refused, nothing written');
  ok(spawnSync(process.execPath, [UNPACK, file, DATA], { encoding: 'utf8' }).status === 1, 'it never writes into a folder that has files (a live data folder)');
  ok(spawnSync(process.execPath, [UNPACK, file, file], { encoding: 'utf8' }).status === 1, '… nor onto a file');
  const NEW = path.join(LAPTOP, 'restored-data');
  const r = spawnSync(process.execPath, [UNPACK, file, NEW], { encoding: 'utf8' });
  ok(r.status === 0 && /\(\+ 1 unreadable kept as they were\), 2 guides, 1 sets, 1 key file/.test(r.stdout), 'unpacked: ' + String(r.stdout).trim().slice(0, 150));
  ok(fs.readFileSync(path.join(NEW, PARKED)).equals(PARKED_BYTES), 'the parked unreadable file comes back as it was');
  const cutB = path.join(LAPTOP, 'cut-guide.json');
  fs.writeFileSync(cutB, JSON.stringify({ _meta: { format: 2 }, files: { 'a.json': { x: 1 } }, raw: {}, guides: { 'g.pdf': 'JVBERi0=', 'h.pdf': 'JVBERi0=' }, sets: {}, keys: {},
    _end: { ok: false, errors: ['guides/g.pdf (cut)'] } }));
  const rc = spawnSync(process.execPath, [UNPACK, cutB, path.join(LAPTOP, 'cut-out')], { encoding: 'utf8' });
  ok(rc.status === 1 && /g\.pdf \(cut while the server sent it\)/.test(rc.stdout) && !fs.existsSync(path.join(LAPTOP, 'cut-out', 'guides', 'g.pdf'))
    && fs.existsSync(path.join(LAPTOP, 'cut-out', 'guides', 'h.pdf')), 'a guide the server marked as cut is not written as if whole (the others are)');
  ok(fs.readFileSync(path.join(NEW, 'guides', 'gtest001.pdf')).equals(GUIDES.g1) && fs.readFileSync(path.join(NEW, 'sim-lock.key'), 'utf8') === SIGNKEY
    && fs.existsSync(path.join(NEW, 'sets', 'familia-niños.csv')), 'the guide PDFs, the sets and the signing key come back byte for byte');
  const remembered = async () => ((((await get('/api/teacher-device', { headers: { Cookie: keep.dtd } })).json) || {}).remembered === true);
  await stopServer();
  await startServer({ DRALY_DATA_DIR: NEW });
  const st = await get('/api/admin/students', at({ 'X-Admin-Pw': encodeURIComponent(SEED) }));
  const codes = ((st.json && st.json.students) || []).map((x) => x.code);
  ok(st.status === 200 && KIDS.every((c) => codes.includes(c)), 'the restored server: the super admin\'s code works and every kid is there');
  const d = (await get('/api/_diag')).json || {};
  ok(d.archivedAccounts === 1 && d.peak30 && d.peak30.classes === 5, 'the archive and the class peaks are back (' + d.archivedAccounts + ' archived, ' + (d.peak30 && d.peak30.classes) + ' classes)');
  const gl = ((await get('/api/admin/guides', at({ 'X-Admin-Pw': encodeURIComponent(SEED) }))).json || {}).guides || [];
  const pdf = await get('/api/guides/gtest001');
  ok(gl.length === 2 && pdf.status === 200 && pdf.buf.equals(GUIDES.g1), 'the guides open again (list + the PDF itself)');
  ok(await remembered(), 'a teacher device remembered before the disaster is still remembered (the key file came back)');

  // a weekly file has no signing key: Render's SIM_LOCK_KEY_HEX keeps phones signed in; without it they sign in again
  const wfile = path.join(LAPTOP, 'weekly.json');
  fs.writeFileSync(wfile, keep.weekly);
  const W = path.join(LAPTOP, 'restored-weekly');
  const rw = spawnSync(process.execPath, [UNPACK, wfile, W], { encoding: 'utf8' });
  ok(rw.status === 0 && /0 key file/.test(rw.stdout) && !fs.existsSync(path.join(W, 'sim-lock.key')), 'a weekly file unpacks without a key file');
  await stopServer();
  await startServer({ DRALY_DATA_DIR: W, SIM_LOCK_KEY_HEX: SIGNKEY });
  ok(await remembered(), 'with SIM_LOCK_KEY_HEX (the same key in Render\'s settings): the teacher device is still remembered');
  ok((await get('/api/admin/students', at({ 'X-Admin-Pw': encodeURIComponent(SEED) }))).status === 200, '… and the super admin\'s code works');
  await stopServer();
  const W2 = path.join(LAPTOP, 'restored-weekly-2');
  spawnSync(process.execPath, [UNPACK, wfile, W2], { encoding: 'utf8' });
  await startServer({ DRALY_DATA_DIR: W2 });
  ok(!(await remembered()), 'without it a new key is made: remembered phones must sign in again (why the key is kept once, in Render)');
}
