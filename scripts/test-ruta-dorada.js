#!/usr/bin/env node
// test-ruta-dorada.js — La Ruta Dorada, phase 2 (2026-10-15): the tab, the module picker and each module's path.
// Starts its OWN server (port 4410, never 3000, never the live site) on a fresh temporary data folder, with throw-away
// teacher codes and level keys that are never printed, and plays every kind of visitor:
//   anonymous · a device that typed a level's key · a grandfathered kid (enrolled before the keys) · a new kid · a teacher
// Checks: /api/ruta-dorada gives one module per level of core/levels.js in its order, open only where LevelKeys.access
// says so, the simulations (names, links) ONLY for an open module and every link a player page that asks the key at its
// own door (anonymous gets the key screen there); nothing protected in what a visitor gets (no /sim-media/, no
// /base-media/, no sim list, no answers); «home» = the kid's own module (or a level this device holds the key of);
// /audios/<level>/clave = the key screen, back to the path once open; every old address still opens; the tab is called
// «La Ruta Dorada» on the page, the home card, the /homework entry and the app shortcut.
//   node scripts/test-ruta-dorada.js            (--port 4410 · --keep to leave it running)
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const Levels = require('../core/levels');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const PORT = Number(opt('port', 4410));
const KEEP = args.includes('--keep');
if (PORT === 3000) { console.error('never port 3000 (that is the dev server of the main checkout)'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'draly-ruta-'));
// (phase 4, 2026-10-16: this test checks who may open each module, so El Entrenamiento's switch is OFF here, as he may
// set it after the launch: the key alone lists a level's simulations. The Dorado rule ON is scripts/test-ruta-training.js)
fs.writeFileSync(path.join(DATA, 'ruta-settings.json'), JSON.stringify({ trainingLive: false, doradoPct: 70, trainingLaunchAt: Date.now() }));
const rnd = (n) => crypto.randomBytes(n).toString('hex').toUpperCase();
const LEGACY = 'legacy-' + rnd(12);
const SEED = 'T-' + rnd(5);
const SECRET = 'test-' + rnd(24);
const KEYS = { yct1: 'Luna-' + (10 + crypto.randomInt(89)), hsk2: 'Cometa-' + (10 + crypto.randomInt(89)), hsk1: 'Tigre-' + (10 + crypto.randomInt(89)) };

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
const put = (p, body, o = {}) => req('PUT', p, Object.assign({}, o, { body }));
const T = (code) => ({ 'X-Admin-Pw': encodeURIComponent(code) });
let ipN = 10;
const phone = () => ({ jar: {}, headers: { 'CF-Connecting-IP': '198.51.100.' + (ipN++) } });
const as = (ph, extra) => Object.assign({ jar: ph.jar, headers: Object.assign({}, ph.headers, (extra && extra.headers) || {}) });
const isKeyScreen = (r, levelName) => r.status === 401 && /data-level-key="locked"/.test(r.text) && (!levelName || r.text.includes('Escribe la clave de ' + levelName));
const isAudiosPage = (r) => r.status === 200 && /id="au-main"/.test(r.text) && !/data-level-key/.test(r.text);
const isPlayer = (r) => r.status === 200 && /id="y-exam"|id="hsk-runner"/.test(r.text) && !/data-level-key/.test(r.text);
const PROTECTED = /\/sim-media\/|\/base-media\/|SIMULATIONS|protected\/|"answer"|"transcript"|"ticket"/i;
const ruta = async (o) => { const r = await get('/api/ruta-dorada', o); return Object.assign(r.json || {}, { _r: r }); };
const mod = (st, id) => (st.modules || []).find((m) => m.id === id);
const simLevelRe = { yct1: /^yct1-sim\d+$/, hsk2: /^newhsk1-sim\d+$/, hsk1: /^hsk1-sim\d+$/ };
const pageOf = (id) => (/^hsk\d/.test(id) ? '/hsk-sim.html?sim=' : '/yct-sim.html?sim=') + encodeURIComponent(id);

let srv = null;
let allLog = '';
async function startServer() {
  try { await get('/health'); console.error('port ' + PORT + ' is busy: stop that server first'); process.exit(2); } catch (_) { /* free */ }
  srv = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PORT: String(PORT), DRALY_DATA_DIR: DATA, STUDENT_DATA_DIR: '', SIM_LOCK_SECRET: SECRET,
      WU_ADMIN_PASSWORD: LEGACY, DRALY_SEED_ADMIN_CODE: SEED, RENDER: '' }),
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

(async () => {
  await startServer();
  let crashed = false;
  try { await run(); } catch (e) { crashed = true; failed++; console.log('  ✖ crashed: ' + (e && e.stack || e)); }
  if (!KEEP) await stopServer();
  if (!crashed) {
    ok(!allLog.includes(SEED) && !allLog.includes(LEGACY) && !Object.values(KEYS).some((k) => allLog.toUpperCase().includes(k.toUpperCase())), 'no teacher code or level key in the server log');
  }
  if (!KEEP) { try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (_) {} }
  console.log(failed ? `test-ruta-dorada: ${failed} FAILED, ${passed} passed` : `test-ruta-dorada: all ${passed} checks passed`);
  process.exit(failed ? 1 : 0);
})();

async function enter(ph, accessCode, name, code) {
  const body = code ? { accessCode, studentCode: code } : { accessCode, displayName: name };
  return (await post('/api/homework/enter', body, as(ph))).json || {};
}

async function run() {
  const stamp = Date.now().toString(36).slice(-4);
  const LV = Levels.LEVELS;

  // ── 1. the page and its names ──
  section('the tab is «La Ruta Dorada»');
  const page = await get('/audios');
  ok(isAudiosPage(page), '/audios opens');
  ok(/<title>La Ruta Dorada · Dralingo<\/title>/.test(page.text) && /au-sub">La Ruta Dorada</.test(page.text), 'its title and header say «La Ruta Dorada»');
  ok(/\/js\/ruta\.js\?v=/.test(page.text) && /\/css\/ruta\.css\?v=/.test(page.text) && /id="rd-sky"/.test(page.text), 'it loads the picker (js/ruta.js, css/ruta.css) and the skyline');
  const visible = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  for (const f of ['public/audios.html', 'public/js/audios.js', 'public/js/ruta.js', 'public/index.html', 'public/js/homework.js', 'public/manifest.webmanifest', 'protected/pages/level-key.html']) {
    ok(!/Audios y vocabulario/i.test(visible(f)), `${f}: no «Audios y vocabulario» left`);
  }
  ok(/<b>La Ruta Dorada<\/b>/.test(visible('public/index.html')), 'the home card says «La Ruta Dorada»');
  ok(/'La Ruta Dorada de ' \+ hwLevelName\(\)/.test(visible('public/js/homework.js')) && /'\/audios\/' \+ encodeURIComponent\(hwBase\.level\) \+ '\?from=homework'/.test(visible('public/js/homework.js')),
    'the /homework entry is «La Ruta Dorada de <nivel>» and opens the kid\'s module path');
  ok(/"La Ruta Dorada"/.test(visible('public/manifest.webmanifest')), 'the app shortcut is «La Ruta Dorada»');
  // /homework.html?next=…: back to La Ruta Dorada after the login, never anywhere else (the check homework.js runs)
  const cond = (fs.readFileSync(path.join(ROOT, 'public/js/homework.js'), 'utf8').match(/if \((.+)\) hwNext = n;/) || [])[1];
  const nextOk = cond ? new Function('n', 'return ' + cond) : () => null;   // eslint-disable-line no-new-func
  ok(['/audios', '/audios/yct1', '/audios/newhsk1/clave', '/audios/yct1-base', '/yct-sim.html?sim=yct1-sim1',
    '/audios/yct1/entrenamiento', '/audios/yct1/entrenamiento/familia', '/audios/yct1/libro/1', '/audios/hsk1/libro/10'].every((n) => nextOk(n) === true),
  '/homework next= takes the picker, a route, a key address, a base, a sim, El Entrenamiento and a golden book');
  ok(['//evil.example', 'https://evil.example/audios', '/audiosx', '/audios/x/clave/x', '/audios/../maestro.html', '/audios/yct1/clave?x=1', '/audios/%2e%2e', '/maestro.html',
    '/audios/yct1/libro/0', '/audios/yct1/libro/01', '/audios/yct1/libro/1?de=x', '/audios/yct1/libro', '/audios/yct1/entrenamiento/x/y']
    .every((n) => nextOk(n) === false), '… and nothing else (no other site, no other page)');
  ok(/'\/audios\/' \+ encodeURIComponent\(l\.id\) \+ '\/clave'/.test(visible('public/js/maestro.js')),
    'the key\'s WhatsApp message (/maestro) links the level\'s key screen, which lands on its route');
  const i18n = fs.readFileSync(path.join(ROOT, 'public/js/hw-i18n.js'), 'utf8');
  ok(i18n.includes('"re":"^La Ruta Dorada de (.+)$"') && i18n.includes('"🔑 Entra con tu código y vuelves directo a La Ruta Dorada."'), 'hw-i18n.js translates the new /homework lines');
  const rjs = fs.readFileSync(path.join(ROOT, 'public/js/ruta.js'), 'utf8');
  ok(!/\/sim-media\/|\/base-media\//.test(rjs) && !/[\u2e80-\u9fff]/.test(rjs) && !/—/.test(rjs), 'js/ruta.js: no protected media address, no hanzi, no em dash');
  ok(!/'(yct1|hsk1|hsk2|newhsk1)'/.test(rjs), 'js/ruta.js names no level itself (the modules come from core/levels.js through the server)');

  // ── 2. anonymous ──
  section('an anonymous visitor');
  const anon = phone();
  const a0 = await ruta(as(anon));
  ok(a0.ok && /no-store/.test(a0._r.headers['cache-control'] || '') && /private/.test(a0._r.headers['cache-control'] || ''), '/api/ruta-dorada answers, private and never cached');
  ok(Array.isArray(a0.modules) && a0.modules.map((m) => m.id).join() === LV.map((l) => l.id).join(), 'one module per level of core/levels.js, in its order (' + LV.map((l) => l.name).join(', ') + ')');
  ok(a0.modules.every((m) => m.slug === (Levels.info(m.id).pack || m.id) && m.name === Levels.info(m.id).name), 'each module carries its curriculum address (yct1, newhsk1, hsk1) and its name');
  ok(a0.modules.every((m) => m.open === false && Array.isArray(m.sims) && m.sims.length === 0), 'nothing open, and no simulation listed');
  ok(a0.modules.every((m) => m.simCount > 0), '… only how many simulations each module has');
  ok(a0.modules.every((m) => !m.base || (m.base.id === Levels.info(m.id).base && m.base.words > 0)), 'each module names its base and word count');
  ok(!a0.teacher && !a0.student && a0.home == null, 'not a teacher, not a kid, no module of their own');
  ok(!PROTECTED.test(a0._r.text) && !/sim=/.test(a0._r.text) && !/-sim\d/.test(a0._r.text), 'nothing protected in what a visitor gets (no media links, no sim ids, no answers)');
  for (const p of ['/audios', '/audios/', '/audio', '/audios/yct1', '/audios/newhsk1', '/audios/hsk1', '/audios/hsk2']) {
    const r = await get(p, as(anon));
    ok(isAudiosPage(r) && !PROTECTED.test(r.text), `${p}: the page opens for a visitor, with nothing protected in it`);
  }
  for (const [lvl, name, slug] of [['yct1', 'YCT 1', 'yct1'], ['newhsk1', 'New HSK 1', 'newhsk1'], ['hsk2', 'New HSK 1', 'newhsk1'], ['hsk1', 'HSK 1', 'hsk1']]) {
    const r = await get('/audios/' + lvl + '/clave', as(anon));
    ok(isKeyScreen(r, name), `/audios/${lvl}/clave: the ${name} key screen`);
    ok(r.text.includes('"route":"/audios/' + slug + '"') && /id="ks-routeback"/.test(r.text), `… with its way back to the path (/audios/${slug})`);
    ok(/no-store/.test(r.headers['cache-control'] || ''), '… never cached');
  }
  const bad = await get('/audios/zz9/clave', as(anon));
  ok(bad.status === 302 && bad.headers.location === '/audios', 'an unknown level\'s key address goes back to the picker');
  for (const p of ['/audios/hsk1-e01-r1', '/audios/hsk2-e01-r1', '/audios/newhsk1-e01-r1', '/audio/hsk1-e03-r1', '/audios?t=hsk1-e01-r1']) {
    ok(isAudiosPage(await get(p, as(anon))), `${p}: the homework audio address still opens`);
  }
  ok(isKeyScreen(await get('/audios/yct1-base', as(anon)), 'YCT 1') && isKeyScreen(await get('/audios/hsk2-base', as(anon)), 'New HSK 1'), 'La Base still asks its key (also at the hsk2 alias)');
  ok(isKeyScreen(await get(pageOf('yct1-sim1'), as(anon)), 'YCT 1') && isKeyScreen(await get(pageOf('hsk1-sim1'), as(anon)), 'HSK 1'), 'a simulation\'s link asks the key at the player\'s door');

  // ── 3. before the keys: a kid enrolled now is grandfathered later ──
  section('keys go live');
  const oldPh = phone();
  const oldKid = await enter(oldPh, '1003', 'Ruta Old ' + stamp);
  ok(oldKid.ok && oldKid.levelOpen === true, 'a kid enrolled before the keys');
  for (const [lvl, k] of Object.entries(KEYS)) ok((await put('/api/admin/level-keys/' + lvl, { key: k }, { headers: T(SEED) })).json.ok, `the ${lvl} key is set`);
  const newPh = phone();
  const newKid = await enter(newPh, '1003', 'Ruta New ' + stamp);
  ok(newKid.ok && newKid.levelOpen === false, 'a kid enrolled after the keys: locked');

  // ── 4. a device that typed a level's key ──
  section('a device with the YCT 1 key');
  const kd = phone();
  ok((await post('/api/level-key', { level: 'yct1', key: KEYS.yct1.toLowerCase() }, as(kd))).json.ok, 'the key is typed once');
  const k1 = await ruta(as(kd));
  const ky = mod(k1, 'yct1');
  ok(ky && ky.open && mod(k1, 'hsk2').open === false && mod(k1, 'hsk1').open === false, 'YCT 1 is open, the other modules stay locked');
  ok(k1.home === 'yct1' && !k1.student, 'the picker lands on YCT 1 (the level this device holds)');
  ok(ky.sims.length === ky.simCount && ky.sims.length >= 5 && ky.sims.every((s, i) => s.n === i + 1 && simLevelRe.yct1.test(s.id) && s.questions > 0),
    `its ${ky.sims.length} simulations in order, each with its question count`);
  ok(ky.sims.every((s) => s.href === pageOf(s.id) && s.best === null), '… each linking to its player (no score yet)');
  ok(mod(k1, 'hsk1').sims.length === 0 && mod(k1, 'hsk2').sims.length === 0, 'no list of the locked modules\' simulations');
  ok(!/\/sim-media\/|\/base-media\/|"answer"|"ticket"/.test(k1._r.text), 'still no media links or answers in the state');
  for (const s of ky.sims) {
    ok(isPlayer(await get(s.href, as(kd))), `${s.id}: its player opens on this device (through the key check)`);
    ok(isKeyScreen(await get(s.href, as(phone())), 'YCT 1'), `${s.id}: the same link asks the key on another phone (no bypass)`);
  }
  const back = await get('/audios/yct1/clave', as(kd));
  ok(back.status === 302 && back.headers.location === '/audios/yct1', 'the key address sends an open device back to the path');
  ok((await get('/audios/hsk1/clave', as(kd))).status === 401, '… and still asks another level\'s key');

  // ── 5. the grandfathered kid, logged in ──
  section('a grandfathered kid');
  const gf = phone();
  const relog = await enter(gf, '1003', null, oldKid.studentCode);
  ok(relog.ok && relog.levelOpen === true, 'logs in at /homework (their own class code)');
  const g1 = await ruta(as(gf));
  ok(g1.student && g1.home === 'yct1' && mod(g1, 'yct1').open && !mod(g1, 'hsk1').open, 'their own module first, open; other levels locked');
  const gy = mod(g1, 'yct1');
  ok(gy.sims.length >= 5 && gy.sims.every((s) => s.href === pageOf(s.id)), 'their level\'s simulations are listed');
  // a try lands on their record → the path shows their best
  const pay = await get('/api/hsk-sim/' + gy.sims[0].id, as(gf));
  const sub = pay.json && pay.json.ok ? await post('/api/hsk-sim/' + gy.sims[0].id + '/submit', { studentCode: oldKid.studentCode, answers: {}, ticket: pay.json.sim.ticket }, as(gf)) : null;
  ok(sub && sub.json && sub.json.ok, 'they hand in a simulation');
  const g2 = await ruta(as(gf));
  const done = mod(g2, 'yct1').sims[0];
  ok(done && typeof done.best === 'number' && done.best >= 0 && done.best <= 100 && mod(g2, 'yct1').sims.slice(1).every((s) => s.best === null), 'the path shows their best on that simulation only');
  ok(mod(await ruta(as(phone())), 'yct1').sims.length === 0, '… and a visitor still sees no list');

  // ── 6. a new kid, logged in, without the key ──
  section('a new kid without the key');
  const n1 = await ruta(as(newPh));
  ok(n1.student && n1.home === 'yct1' && mod(n1, 'yct1').open === false && mod(n1, 'yct1').sims.length === 0, 'lands on their own module, locked, no simulation list');
  ok(!PROTECTED.test(n1._r.text), '… nothing protected in it');

  // ── 7. a teacher ──
  section('a teacher');
  const t1 = await ruta({ headers: Object.assign({ 'CF-Connecting-IP': '198.51.100.250' }, T(SEED)) });
  ok(t1.teacher && t1.modules.every((m) => m.open) && t1.home == null, 'every module open, no module of their own');
  ok(t1.modules.every((m) => m.sims.length === m.simCount && m.sims.every((s) => simLevelRe[m.id] && simLevelRe[m.id].test(s.id) && s.href === pageOf(s.id))),
    'each module lists its own simulations (Old HSK 1 on the HSK player, YCT and New HSK on the YCT player)');
  const tdev = phone();
  ok((await post('/api/teacher-device', { code: SEED }, as(tdev))).json.ok, 'a teacher device is remembered');
  ok((await ruta(as(tdev))).modules.every((m) => m.open), '… and opens every module');
}
