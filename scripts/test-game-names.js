#!/usr/bin/env node
// test-game-names.js — the «Draly Party» names (his naming 2026-10-23, «Approve all»). The names live in
// core/game-names.js (full + short + the old ones); this test reads them there and checks every place a kid, a parent or
// a teacher reads a game's name, so a rename is that file + the pages, never this test:
//   · games.html, /maestro's launcher (js/maestro.js), packs.html and sets.html: the full name of every game they list,
//     and every pin game of games.html has a name in core/game-names.js (a new game gets its Draly name from the start)
//   · each projector page: <title> = «<full> · Anfitrión», its lobby title shows the short name, its tab title (with the
//     PIN, js/host-*.js) the short one
//   · the phones' lobby title (js/player.js) and the shared ceremony (js/party.js): the full name
//   · no old name (one that is not part of today's names) and no «Monopolio» / «Dàfùwēng» left in the kid, parent and
//     teacher files (comments stripped, like scripts/test-wording.js)
//   · kids' inboxes keep invites with the old names: GameNames.inboxMessage, and /api/homework/inbox on its OWN server
//     (port 4660, a temporary data folder with a made-up kid, never data/, never the live site), show today's name and
//     leave the saved record as it was
//   node scripts/test-game-names.js [--port 4660] [--no-server]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4660));
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const GN = require('../core/game-names');
const TYPES = Object.keys(GN.NAMES);

let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✖ ' + msg); } };
const section = (t) => console.log('· ' + t);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// blank out comments but keep line numbers (the same as scripts/test-wording.js)
const strip = (src) => src
  .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const unquote = (s) => s.replace(/\\'/g, '\'');

section('the list itself');
TYPES.forEach((t) => {
  const n = GN.NAMES[t];
  ok(/^Draly \S/.test(n.full) && /^Draly \S/.test(n.short), t + ': both names carry «Draly» (' + n.full + ')');
  ok(n.full === n.short || n.full.startsWith(n.short + ' · '), t + ': the short name is the start of the full one');
  ok(!/Monopolio|Dàfùwēng/i.test(n.full), t + ': no «Monopolio» in the name');
});
ok(GN.nameOf('monopoly', 'short') === 'Draly Tablero' && GN.nameOf('nope') === null, 'nameOf: a game\'s name, null for anything else');

section('games.html: every pin game with its full name');
const gamesSrc = read('public/games.html');
const gamesBlock = gamesSrc.slice(gamesSrc.indexOf('const GAMES = ['), gamesSrc.indexOf('const TOOLS = ['));
const HOST = {};   // gameType → its projector page (from games.html)
const entryRe = /\{\s*id:\s*'([^']+)',\s*emo:\s*'[^']*',\s*name:\s*'((?:\\'|[^'])+)'([^}]*)\}/g;
let m, listed = 0;
while ((m = entryRe.exec(gamesBlock))) {
  const rest = m[3];
  const type = (/game:\s*'([^']+)'/.exec(rest) || [])[1] || m[1];
  const host = (/host:\s*'([^']+)'/.exec(rest) || [])[1];
  listed++;
  ok(GN.NAMES[type], `games.html lists «${type}»: it needs its Draly name in core/game-names.js`);
  if (!GN.NAMES[type]) continue;
  HOST[type] = host;
  ok(unquote(m[2]) === GN.NAMES[type].full, `games.html ${type}: «${unquote(m[2])}» is «${GN.NAMES[type].full}»`);
}
ok(listed >= TYPES.length, 'games.html lists every game (' + listed + ')');
TYPES.forEach((t) => ok(HOST[t], t + ': listed in games.html with its projector page'));

section('/maestro\'s launcher: the full name on every game card');
const maestro = read('public/js/maestro.js');
const launch = maestro.slice(maestro.indexOf('const LAUNCHER_GAMES = ['), maestro.indexOf('];', maestro.indexOf('const LAUNCHER_GAMES = [')));
const byHost = {};
const labRe = /\{\s*id:\s*'([^']+)',\s*label:\s*'((?:\\'|[^'])+)',[^\n]*?host:\s*'([^']+)'/g;
while ((m = labRe.exec(launch))) byHost[m[3]] = unquote(m[2]);
TYPES.forEach((t) => ok(byHost[HOST[t]] === GN.NAMES[t].full, `launcher ${t}: «${byHost[HOST[t]]}» is «${GN.NAMES[t].full}»`));

section('packs.html and sets.html: the game named on top of the question picker');
for (const rel of ['public/packs.html', 'public/sets.html']) {
  const src = read(rel);
  const names = {};
  const re = /'([\w-]+)':\s*\{\s*emoji:\s*'[^']*',\s*name:\s*'((?:\\'|[^'])+)'/g;
  while ((m = re.exec(src))) names[m[1]] = unquote(m[2]);
  Object.keys(names).forEach((t) => {
    ok(GN.NAMES[t], `${rel} names «${t}»: it needs its Draly name in core/game-names.js`);
    if (GN.NAMES[t]) ok(names[t] === GN.NAMES[t].full, `${rel} ${t}: «${names[t]}» is «${GN.NAMES[t].full}»`);
  });
  // (6-7 makes its own sums: no question picker)
  TYPES.filter((t) => t !== 'sixseven').forEach((t) => ok(names[t], `${rel} has ${t}`));
}

section('the projectors: tab title, lobby title, the tab with its PIN');
TYPES.forEach((t) => {
  const page = 'public' + HOST[t];
  if (!HOST[t] || !fs.existsSync(path.join(ROOT, page))) { ok(false, t + ': its projector page ' + page); return; }
  const src = read(page);
  const title = (/<title>([^<]*)<\/title>/.exec(src) || [])[1];
  ok(title === GN.NAMES[t].full + ' · Anfitrión', `${page} <title>: «${title}»`);
  const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(strip(src)) || [])[1] || '';
  const h1Text = h1.replace(/<span class="es-tv"[^>]*>[\s\S]*?<\/span>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  ok(h1Text.replace(/ /g, '').includes(GN.NAMES[t].short.replace(/ /g, '')), `${page} lobby title «${h1Text}» shows «${GN.NAMES[t].short}»`);
  const js = (src.match(/src="\/js\/(host-[\w-]+)\.js/g) || []).map((s) => s.slice(9, -3)).filter((f) => !/host-(back|reconnect)$/.test(f));
  const tab = js.map((f) => read('public/js/' + f + '.js')).map((s) => (/document\.title = `([^`]*)`/.exec(s) || [])[1]).find(Boolean);
  ok(tab && tab.startsWith(GN.NAMES[t].short + ' · '), `${page} tab title with the PIN «${tab}» starts with «${GN.NAMES[t].short}»`);
});

section('the phones and the shared ceremony');
const player = read('public/js/player.js');
const tlRe = /gameType === '([\w-]+)'\)\s*\{\s*teamLabel = '((?:\\'|[^'])+)'/g;
let phoneN = 0;
while ((m = tlRe.exec(player))) {
  phoneN++;
  ok(GN.NAMES[m[1]] && unquote(m[2]) === GN.NAMES[m[1]].full, `player.js lobby title ${m[1]}: «${unquote(m[2])}»`);
}
ok(phoneN >= 5, 'player.js: the games whose lobby shows the game\'s name (' + phoneN + ')');
const party = read('public/js/party.js');
const ptRe = /\b([\w]+):\s*\{\s*title:\s*'((?:\\'|[^'])+)'/g;
let partyN = 0;
while ((m = ptRe.exec(party))) {
  partyN++;
  ok(GN.NAMES[m[1]] && unquote(m[2]) === GN.NAMES[m[1]].full, `party.js ceremony ${m[1]}: «${unquote(m[2])}»`);
}
ok(partyN >= 5, 'party.js: the games of the shared ceremony (' + partyN + ')');
const sixTitle = (/games\[pin\]\.setTitle = '((?:\\'|[^'])+)'/.exec(read('server.js')) || [])[1];
ok(sixTitle === GN.NAMES.sixseven.full, `server.js: 6-7's question set is named «${sixTitle}»`);

section('no old name and no «Monopolio» where kids, parents and teachers read');
// an old name that is part of today's names (a subtitle like «¡No despiertes a Dralingo!», «Piñata») stays allowed
const allFull = TYPES.map((t) => GN.NAMES[t].full);
const retired = [];
Object.keys(GN.OLD).forEach((t) => GN.OLD[t].forEach((n) => { if (!allFull.some((f) => f.includes(n))) retired.push(n); }));
ok(retired.includes('Mochi Mash') && retired.includes('Dàfùwēng · Monopolio'), 'the retired names come from core/game-names.js');
const SCAN = [];
const add = (dir, re) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => re.test(f)).forEach((f) => SCAN.push(dir + '/' + f));
add('public', /\.html$/);
add('public/js', /\.js$/);
add('protected/pages', /\.html$/);
add('core', /\.js$/);
SCAN.push('server.js');
const SKIP = new Set(['core/game-names.js']);
let hits = 0;
for (const rel of SCAN) {
  if (SKIP.has(rel)) continue;
  strip(read(rel)).split('\n').forEach((line, i) => {
    if (/console\.(log|warn|error)\(/.test(line)) return;   // (server logs: never on a screen)
    let l = line;
    allFull.forEach((f) => { l = l.split(f).join(''); });
    const bad = retired.filter((n) => l.includes(n));
    if (/Monopolio|Dàfùwēng|Dafuweng/i.test(l)) bad.push('Monopolio / Dàfùwēng');
    if (bad.length) { hits++; console.log(`  ✖ ${rel}:${i + 1} still says «${bad[0]}»: ${line.trim().slice(0, 140)}`); }
  });
}
ok(!hits, 'no old game name left (' + SCAN.length + ' files)');

section('kids\' saved invites read today\'s name');
const inv = (name, end) => '🚀 La maestra está abriendo ' + name + ' ahora. ' + (end || 'Estás entrando.');
const msg = (name, end) => ({ id: 'x', text: inv(name, end), actionType: 'force', actionUrl: '/player.html?pin=123&autojoin=1', actionLabel: '📚 ' + name, ts: 1 });
TYPES.forEach((t) => GN.OLD[t].forEach((old) => {
  const o = msg(old);
  const before = JSON.stringify(o);
  const r = GN.inboxMessage(o);
  ok(r.text === inv(GN.NAMES[t].full) && r.actionLabel === '📚 ' + GN.NAMES[t].full, `an invite to «${old}» reads «${GN.NAMES[t].full}»`);
  ok(JSON.stringify(o) === before, `the saved «${old}» invite itself is untouched`);
}));
ok(GN.inboxMessage(msg('Reinos de Colores', 'Prepárate.')).text === inv('Draly Reinos', 'Prepárate.'), 'the auto-host invite («… ahora. Prepárate.») too');
const today = msg(GN.NAMES.teamcrab.full);
ok(GN.inboxMessage(today) === today, 'an invite with today\'s name comes back as it is (never «Draly Cangrejo · Draly Cangrejo …»)');
const mine = { id: 'y', text: 'Hoy jugamos Mochi Mash en clase, ¡prepárense!', actionLabel: '📚 Modo Maestro', ts: 1 };
ok(GN.inboxMessage(mine) === mine, 'a teacher\'s own words and other buttons stay as written');
ok(GN.inboxMessage(null) === null && GN.inboxMessage({ id: 'z', ts: 1 }).id === 'z', 'odd messages pass through');

// ---------------------------------------------------------------------------------------------------------------------
// /api/homework/inbox on its own server: a made-up kid whose inbox holds invites with the old names
async function live() {
  section('/api/homework/inbox (own server on port ' + PORT + ')');
  const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-names-'));
  const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
  const SEED = 'T-' + rnd(5);
  const NOW = Date.now(), DAY = 86400e3;
  const OLD_INVITE = { id: 'm1', from: 'super', fromName: 'Profe', text: inv('Dàfùwēng · Monopolio'), actionType: 'force',
    actionUrl: '/player.html?pin=321&autojoin=1', actionLabel: '📚 Dàfùwēng · Monopolio', ts: NOW - DAY, readAt: NOW - DAY };
  const OLD_INVITE2 = { id: 'm2', from: 'super', fromName: 'Profe', text: inv('Mochi Mash'), actionType: 'force',
    actionUrl: '/player.html?pin=322&autojoin=1', actionLabel: '📚 Mochi Mash', ts: NOW - 2 * DAY, readAt: NOW - 2 * DAY };
  const OWN = { id: 'm3', from: 'super', fromName: 'Profe', text: 'Mañana jugamos Mochi Mash', ts: NOW - 3 * DAY, readAt: null };
  fs.writeFileSync(path.join(DATA, 'student-records.json'), JSON.stringify({
    KIDN: { code: 'KIDN', displayName: 'Kid Nombres', avatar: 'dralingo', classroomCode: '1002', classroomId: null, firstSeen: NOW - 20 * DAY,
      lastSeen: NOW - DAY, sentencesBuilt: [], level: 'hsk2', inbox: [OLD_INVITE, OLD_INVITE2, OWN] },
  }));
  const get = (p) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, method: 'GET', path: p, headers: { 'CF-Connecting-IP': '198.51.100.66' } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => { const text = Buffer.concat(chunks).toString('utf8'); let json = null; try { json = JSON.parse(text); } catch (_) {} resolve({ status: res.statusCode, json }); });
    });
    r.on('error', reject);
    r.end();
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  let log = '';
  const srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: 'test-' + rnd(24),
      WU_ADMIN_PASSWORD: 'legacy-' + rnd(12), DRALY_SEED_ADMIN_CODE: SEED, RENDER: '' }),
  });
  try { os.setPriority(srv.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
  srv.stdout.on('data', (d) => { log += d; });
  srv.stderr.on('data', (d) => { log += d; });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await sleep(400); try { up = (await get('/health')).status === 200; } catch (_) {} }
  try {
    ok(up, 'the test server started');
    if (!up) { console.log(log.slice(-1500).split(SEED).join('<code>')); return; }
    const r = await get('/api/homework/inbox?accessCode=1002&studentCode=KIDN');
    const box = (r.json && r.json.inbox) || [];
    ok(r.status === 200 && box.length === 3, 'the kid\'s own inbox answers (' + r.status + ', ' + box.length + ')');
    const a = box.find((x) => x.id === 'm1') || {}, b = box.find((x) => x.id === 'm2') || {}, c = box.find((x) => x.id === 'm3') || {};
    ok(a.text === inv(GN.NAMES.monopoly.full) && a.actionLabel === '📚 ' + GN.NAMES.monopoly.full, 'the «Dàfùwēng · Monopolio» invite reads «' + a.text + '»');
    ok(b.text === inv(GN.NAMES['mochi-mash'].full) && b.actionLabel === '📚 ' + GN.NAMES['mochi-mash'].full, 'the «Mochi Mash» invite reads today\'s name');
    ok(c.text === OWN.text, 'the teacher\'s own words stay as written');
    ok(!box.some((x) => 'from' in x), 'the sender\'s id still never reaches the phone');
    await sleep(300);
    const disk = JSON.parse(fs.readFileSync(path.join(DATA, 'student-records.json'), 'utf8'));
    const saved = ((disk.KIDN || {}).inbox || []).find((x) => x.id === 'm1') || {};
    ok(saved.text === OLD_INVITE.text && saved.actionLabel === OLD_INVITE.actionLabel, 'the record keeps what it saved (a mapping where it is shown, no migration)');
  } finally {
    const p = new Promise((res) => srv.once('exit', res));
    srv.kill();
    await p;
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {}
  }
}

(async () => {
  if (!args.includes('--no-server')) await live();
  console.log(failed ? `game names: ${failed} FAILED, ${passed} passed` : `game names: all ${passed} checks pass`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
