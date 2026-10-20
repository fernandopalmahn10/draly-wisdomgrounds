#!/usr/bin/env node
// Monthly platform health check (his ask 2026-10-12: "warn me when any of these is crossed").
// Reads the live service's last 30 days from the Render API (memory, CPU, downloads, data disk), the live /api/_diag
// (student file size), the live compression, and this checkout (deployed media size, biggest file, phone page
// weight). Prints a plain report, writes it to ../reports/platform-health/<date>.md (+ .json), exits 1 if any limit
// is crossed. Read-only: never changes Render or the site.
//   node scripts/health-check.js            (token from .render-token, git-ignored, or env RENDER_TOKEN)
//   --no-render   skip the Render numbers (the token is not read at all)   --live <url>  another server's /api/_diag
//   --no-save     print only, write no report                               --help        this text
// 2026-10-20 (scale): «Most classes at the same time (30 days)» from /api/_diag `peak30` (core/usage-peaks.js; a class
// = a live room with 5+ kids): a warning at 3 classes (or 90 kids) at once, the red line at 5 (or 150 kids) on the
// Starter server (load test 2026-10-20: 3 classes of 30 comfortable, 5 the edge); Render's next size, Standard (1 CPU,
// 2 GB), holds about 10.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const ARGS = process.argv.slice(2);
if (ARGS.includes('--help') || ARGS.includes('-h')) {
  console.log([
    'Monthly platform health check (read-only).',
    '  node scripts/health-check.js              Render numbers + live site + this checkout; saves ../reports/platform-health/<date>.md',
    '  --no-render                               skip the Render numbers (the Render key is not read)',
    '  --live <url>                              read /api/_diag from another server (e.g. a local test server)',
    '  --no-save                                 print only',
    'Exit 0 = all clear, 1 = something to act on (a warning or a red line), 2 = the check itself failed.',
  ].join('\n'));
  process.exit(0);
}
const argVal = (n) => { const i = ARGS.indexOf('--' + n); const v = i >= 0 ? ARGS[i + 1] : undefined; return v && !v.startsWith('--') ? v : undefined; };
const NO_RENDER = ARGS.includes('--no-render');
const NO_SAVE = ARGS.includes('--no-save');

const ROOT = path.join(__dirname, '..');
const LIVE = (argVal('live') || 'https://draly-wisdomgrounds-2.onrender.com').replace(/\/+$/, '');
const LIVE_NAME = 'draly-wisdomgrounds-2';
// classes (live rooms with 5+ kids) or kids connected at the same time on the Starter server (load test 2026-10-20:
// classes of 30 robot kids; 3 comfortable, 5 the edge)
const CLASSES = { warn: 3, red: 5, warnKids: 90, redKids: 150, standard: 10 };
const LIMITS = {                      // the thresholds he agreed to (docs/HOW_CLAUDE_WORKS.md § Platform health)
  memoryPct: 70,                      // peak memory vs the server's limit
  cpuPct: 60,                         // peak 1-minute CPU vs the server's share
  studentFileMB: 20,                  // student-records.json: past this, move to a database
  diskPct: 30,                        // data disk used
  deployedMediaMB: 1024,              // tracked public/assets + protected/ (the locked sim media)
  biggestFileMB: 10,                  // any single tracked file
  pageKB: 1024,                       // a page + its scripts/styles, compressed, as a phone downloads it
  bandwidthGB: 25,                    // downloads in 30 days (Hobby includes 5 GB; extra is $0.15/GB)
};

const token = NO_RENDER ? '' : (process.env.RENDER_TOKEN || (() => {
  try { return fs.readFileSync(path.join(ROOT, '.render-token'), 'utf8'); } catch (_) { return ''; }
})()).trim();
const api = (p) => fetch('https://api.render.com/v1' + p, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const values = (body) => (Array.isArray(body) ? body : []).flatMap((s) => (s.values || []).map((v) => ({ t: v.timestamp, v: Number(v.value) })))
  .filter((x) => Number.isFinite(x.v));

const rows = [];   // { area, value, limit, ok, note, red? }
const add = (area, value, limit, ok, note, red) => rows.push({ area, value, limit, ok, note: note || '', red: !!red });

async function renderPart() {
  if (NO_RENDER) return;
  if (!token) { add('Render numbers', 'no token', '-', false, 'put the Render API key in mochi-mash/.render-token'); return; }
  const list = await api('/services?limit=50');
  if (list.status !== 200) { add('Render numbers', 'HTTP ' + list.status, '-', false, 'Render API refused the key'); return; }
  const services = list.body.map((x) => x.service);
  const live = services.find((s) => s.name === LIVE_NAME);
  if (!live) { add('Live service', 'not found', LIVE_NAME, false); return; }
  const running = services.filter((s) => s.suspended !== 'suspended');
  add('Paid servers running', running.map((s) => `${s.name} (${s.serviceDetails.plan})`).join(', '), 'only ' + LIVE_NAME,
    running.length === 1 && running[0].id === live.id,
    running.length > 1 ? 'every extra running server is billed: suspend or delete the ones nobody uses' : '');
  const end = new Date(), start = new Date(end - 30 * 86400e3);
  const q = (res) => `resource=${live.id}&startTime=${start.toISOString()}&endTime=${end.toISOString()}&resolutionSeconds=${res}`;
  const [mem, memLim, cpu, cpuLim, bw, disk, diskCap] = await Promise.all([
    api('/metrics/memory?' + q(300)), api('/metrics/memory-limit?' + q(3600)), api('/metrics/cpu?' + q(300)),   // 5-minute points: Render refuses 1-minute points over 30 days
    api('/metrics/cpu-limit?' + q(3600)), api('/metrics/bandwidth?' + q(3600)), api('/metrics/disk-usage?' + q(3600)),
    api('/metrics/disk-capacity?' + q(3600)),
  ]);
  const peak = (r) => values(r.body).reduce((a, b) => (b.v > a.v ? b : a), { v: 0, t: '' });
  const last = (r) => { const v = values(r.body); return v.length ? v[v.length - 1].v : 0; };
  const mPeak = peak(mem), mLim = last(memLim) || 512 * 1048576;
  const mPct = Math.round(mPeak.v / mLim * 100);
  add('Server memory (peak)', `${Math.round(mPeak.v / 1048576)} MB of ${Math.round(mLim / 1048576)} MB (${mPct}%)`, LIMITS.memoryPct + '%',
    mPct <= LIMITS.memoryPct, mPct > LIMITS.memoryPct ? 'time for a bigger server (Standard: 2 GB)' : 'peak ' + mPeak.t.slice(0, 16));
  const cPeak = peak(cpu), cLim = last(cpuLim) || 0.5;
  const cPct = Math.round(cPeak.v / cLim * 100);
  add('Server processor (peak 5 minutes)', `${cPeak.v.toFixed(2)} of ${cLim} CPU (${cPct}%)`, LIMITS.cpuPct + '%',
    cPct <= LIMITS.cpuPct, cPct > LIMITS.cpuPct ? 'classes may lag: bigger server or fewer live games at once' : 'peak ' + cPeak.t.slice(0, 16));
  const gb = values(bw.body).reduce((a, b) => a + b.v, 0) / 1024;
  add('Downloads (30 days)', `${gb.toFixed(1)} GB`, LIMITS.bandwidthGB + ' GB', gb <= LIMITS.bandwidthGB,
    `≈ $${(Math.max(0, gb - 5) * 0.15).toFixed(2)} extra this month on the Hobby plan (5 GB included)`);
  const dU = last(disk), dC = last(diskCap) || 1;
  const dPct = Math.round(dU / dC * 100);
  add('Data disk (student data)', `${Math.round(dU / 1048576)} MB of ${Math.round(dC / 1048576)} MB (${dPct}%)`, LIMITS.diskPct + '%', dPct <= LIMITS.diskPct);
}

// «Most classes at the same time (30 days)»: a class = a live room with 5+ kids connected (an open projector with
// nobody in it is no load). Under 3 classes and 90 kids fine; 3-4 classes or 90+ kids a warning (time to plan); 5+
// classes or 150+ kids the red line (move up). The kids count catches many small rooms at once.
function classesRow(p) {
  const area = 'Most classes at the same time (30 days)';
  const limit = `warn ${CLASSES.warn} (${CLASSES.warnKids} kids) · red ${CLASSES.red} (${CLASSES.redKids} kids)`;
  if (!p || !Number.isFinite(Number(p.rooms))) {
    add(area, 'unknown', limit, true, 'the live server does not count classes yet (deploy the «scale» update)');
    return;
  }
  const rooms = Number(p.rooms) || 0, kids = Number(p.players) || 0, days = Number(p.days) || 0;
  const n = Number.isFinite(Number(p.classes)) ? Number(p.classes) : rooms;   // (an older server: rooms only)
  const value = `${n} class${n === 1 ? '' : 'es'} · ${kids} kids connected · ${rooms} room${rooms === 1 ? '' : 's'} open`;
  const young = days < 30 ? ` · counted on ${days} day${days === 1 ? '' : 's'} so far` : '';
  if (n >= CLASSES.red || kids >= CLASSES.redKids) {
    add(area, value, limit, false,
      `red line for the Starter server: move up to Render Standard (1 CPU, 2 GB, ≈ ${CLASSES.standard} classes at once)` + young, true);
  } else if (n >= CLASSES.warn || kids >= CLASSES.warnKids) {
    add(area, value, limit, false,
      `still comfortable on Starter; at ${CLASSES.red} classes (${CLASSES.redKids} kids) at once move up to Standard (≈ ${CLASSES.standard} classes)` + young);
  } else {
    add(area, value, limit, true, `Starter holds 3 classes of 30 comfortably, 5 is the edge` + young);
  }
}

async function livePart() {
  try {
    const d = await fetch(LIVE + '/api/_diag', { signal: AbortSignal.timeout(30000) }).then((r) => r.json());
    const mb = d.studentRecordsBytes == null ? null : d.studentRecordsBytes / 1048576;
    add('Student records file', mb == null ? 'unknown' : `${mb.toFixed(1)} MB`, LIMITS.studentFileMB + ' MB',
      mb != null && mb <= LIMITS.studentFileMB, mb != null && mb > LIMITS.studentFileMB ? 'move student data to a database' : `live since ${d.uptimeHours} h, ${d.rooms} rooms open now`);
    classesRow(d.peak30);
  } catch (e) { add('Live site', 'not reachable', '-', false, e.message); }
  try {
    const r = await fetch(LIVE + '/js/player.js?health=' + Date.now(), { headers: { 'Accept-Encoding': 'gzip' }, signal: AbortSignal.timeout(30000) });
    const enc = r.headers.get('content-encoding') || 'none';
    add('Compression on the live site', enc, 'gzip/br', /gzip|br/.test(enc), /gzip|br/.test(enc) ? '' : 'phones download ~4× more: check server.js compression');
  } catch (_) { /* reported above */ }
}

function repoPart() {
  const tracked = execSync('git ls-files -z', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean);
  let media = 0, big = { size: 0, f: '' };
  for (const f of tracked) {
    let size = 0;
    try { size = fs.statSync(path.join(ROOT, f)).size; } catch (_) { continue; }
    if (f.startsWith('public/assets/') || f.startsWith('protected/')) media += size;   // protected/ = locked sim media (2026-10-15)
    if (size > big.size) big = { size, f };
  }
  add('Deployed media (public/assets + protected)', `${(media / 1048576).toFixed(0)} MB`, LIMITS.deployedMediaMB + ' MB', media / 1048576 <= LIMITS.deployedMediaMB);
  add('Biggest single file', `${(big.size / 1048576).toFixed(1)} MB (${big.f})`, LIMITS.biggestFileMB + ' MB', big.size / 1048576 <= LIMITS.biggestFileMB);
  let worst = { kb: 0, p: '' };
  for (const p of ['player.html', 'homework.html', 'index.html', 'maestro.html', 'host-snow.html', 'host-kingdoms.html', 'host-paint.html', 'audios.html']) {
    const file = path.join(ROOT, 'public', p);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file);
    let gz = zlib.gzipSync(html).length;
    for (const m of html.toString().matchAll(/(?:src|href)="(\/[^"?#]+\.(?:js|css))(?:\?[^"]*)?"/g)) {
      const f = path.join(ROOT, 'public', decodeURIComponent(m[1]));
      if (fs.existsSync(f)) gz += zlib.gzipSync(fs.readFileSync(f)).length;
    }
    if (gz / 1024 > worst.kb) worst = { kb: gz / 1024, p };
  }
  add('Heaviest page for a phone (compressed)', `${worst.kb.toFixed(0)} KB (${worst.p})`, LIMITS.pageKB + ' KB', worst.kb <= LIMITS.pageKB);
  try {
    const pack = execSync('git count-objects -v', { cwd: ROOT, encoding: 'utf8' });
    const kb = Number((/size-pack: (\d+)/.exec(pack) || [])[1] || 0);
    add('Project history (GitHub)', `${(kb / 1048576).toFixed(2)} GB`, '1 GB recommended, 5 GB hard', true, kb > 1048576 ? 'old deleted files still stored; harmless for now' : '');
  } catch (_) { /* no git here */ }
}

(async () => {
  await renderPart();
  await livePart();
  repoPart();
  const date = new Date().toISOString().slice(0, 10);
  const bad = rows.filter((r) => !r.ok);
  const reds = bad.filter((r) => r.red).length;
  const lines = [`# Platform health · ${date}`, '', bad.length ? `**${bad.length} warning(s)${reds ? `, ${reds} on the red line` : ''}**` : '**All clear: every number is under its limit.**', '',
    '| | Now | Limit | Note |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r.ok ? '✅' : r.red ? '🔴' : '⚠️'} ${r.area} | ${r.value} | ${r.limit} | ${r.note} |`)];
  const md = lines.join('\n') + '\n';
  console.log(md);
  if (NO_SAVE) process.exit(bad.length ? 1 : 0);
  const outDir = path.join(ROOT, '..', 'reports', 'platform-health');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, date + '.md'), md);
    fs.writeFileSync(path.join(outDir, date + '.json'), JSON.stringify({ date, limits: LIMITS, rows }, null, 2));
    console.log('saved: ' + path.join(outDir, date + '.md'));
  } catch (e) { console.log('could not save the report: ' + e.message); }
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error('health check crashed:', e.message); process.exit(2); });
