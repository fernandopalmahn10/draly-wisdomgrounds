// Las Trampillas · every screen size shows the game (2026-10-19, his laptop showed an empty dark screen). A real browser
// (headless Chrome through playwright-core) against a RUNNING local server (never the live site):
//   node scripts/check-trapdoor-screens.js --url http://localhost:4600 --password <the local teacher code>
//   (playwright-core: the repo's, else PLAYWRIGHT_CORE=<folder>, else the one inside the global @playwright/cli)
// One room, a few socket kids, one page per size (laptops 1366×657 · 1366×768 · 1440×900 · 1920×1080, a phone sideways
// 844×390, phones 390×844 · 360×640), the teacher starts; each page must show the platform: #screen-trapdoor, its
// canvas at least 300×150 px and really drawn (many colours), and the four answer tiles inside the window (at 844×390
// they were below it). Then the blank-screen cases: a second device with a name already playing (it was an empty game,
// now «… 2» with its own platform), and a phone that misses its td:init (the first one is dropped in the page): it
// shows «Entrando a la plataforma…» and gets its platform by itself, never «type the PIN again».
// Gentle with the laptop: one browser, low priority, every step under a timeout, closed at the end.
'use strict';
const os = require('os');
const path = require('path');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:4600';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
function loadPw() {
  const tries = ['playwright-core', process.env.PLAYWRIGHT_CORE,
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'cli', 'node_modules', 'playwright-core')].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (_) { /* next */ } }
  return null;
}
const PW = loadPw();
if (!PW) { console.log('SKIP · no playwright-core here (set PLAYWRIGHT_CORE)'); process.exit(0); }
const SET = 'pack:yct1-familia-r1';
const SIZES = [[1366, 657], [1366, 768], [1440, 900], [1920, 1080], [844, 390], [390, 844], [360, 640]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0, bad = 0;
const ok = (c, m) => { checks++; if (!c) { bad++; console.log('FAIL ' + m); } };
const sockets = [];
const connect = () => { const s = io(URL, { transports: ['websocket'], forceNew: true }); sockets.push(s); return s; };
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const watchdog = setTimeout(() => { console.log('FAIL · timed out'); process.exit(1); }, 240000);

// what a page shows: the visible screen, the canvas box + whether it holds a picture, the tiles inside the window
const LOOK = `(() => {
  const vis = [...document.querySelectorAll('[id^=screen-]')].filter((e) => !e.classList.contains('hidden')).map((e) => e.id);
  const c = document.getElementById('tp-canvas');
  const r = c.getBoundingClientRect();
  let colours = 0;
  try { if (c.width > 4 && c.height > 4) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const s = new Set(); for (let i = 0; i < d.length; i += 4 * 499) s.add(d[i] >> 3 << 10 | d[i + 1] >> 3 << 5 | d[i + 2] >> 3); colours = s.size; } } catch (e) { colours = -1; }
  const D = window.TrapdoorPhone && TrapdoorPhone.debug();
  const tiles = [...document.querySelectorAll('.tp-a')].map((b) => b.getBoundingClientRect());
  const inside = tiles.length === 4 && tiles.every((t) => t.top >= 0 && t.bottom <= innerHeight + 1 && t.left >= 0 && t.right <= innerWidth + 1 && t.height >= 44);
  const wait = document.getElementById('tp-wait');
  return { vis, w: Math.round(r.width), h: Math.round(r.height), colours, on: !!(D && D.on), card: !!(D && D.card), tiles: tiles.length, inside,
    waiting: !!(wait && getComputedStyle(wait).display !== 'none'), name: (document.getElementById('lobby-name') || {}).textContent };
})()`;
// drop the first td:init this page hears (a missed init): every listener skips it
const DROP_FIRST_INIT = () => {
  let real;
  Object.defineProperty(window, 'io', { configurable: true, get() { return real; }, set(v) {
    real = function () {
      const s = v.apply(this, arguments);
      let dropped = false;
      const on = s.on.bind(s);
      s.on = function (ev, fn) {
        if (ev !== 'td:init') return on(ev, fn);
        return on(ev, function (d) { if (!dropped) return; return fn.apply(this, arguments); });
      };
      on('td:init', () => { if (!dropped) window.__droppedInit = (window.__droppedInit || 0) + 1; setTimeout(() => { dropped = true; }, 0); });
      return s;
    };
    Object.assign(real, v);
  } });
};

(async () => {
  const host = connect();
  const { pin } = await ack(host, 'host:create', { gameType: 'trapdoor', password: PASSWORD });
  await ack(host, 'host:load-set', { pin, setId: SET });
  await ack(host, 'host:td-rounds', { pin, rounds: 3 });
  for (const name of ['Sofi', 'Mateo', 'Valen']) {
    const s = connect();
    s.on('td:ping', (m, cb) => { if (typeof cb === 'function') cb(1); });
    await ack(s, 'player:join', { pin, name });
  }
  const browser = await PW.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  try {
    const pages = [];
    const open = async (w, h, name, init) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      if (init) await ctx.addInitScript(init);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${URL}/player.html?pin=${pin}&name=${encodeURIComponent(name)}&autojoin=1`, { timeout: 30000 });
      pages.push({ ctx, page, w, h, name, errors });
      return pages[pages.length - 1];
    };
    for (const [w, h] of SIZES) await open(w, h, `K${w}x${h}`);
    const twin = await open(1366, 657, 'K390x844');                     // the same name as a phone that is playing
    const missed = await open(1366, 657, 'Perdida', DROP_FIRST_INIT);    // misses its first td:init
    await sleep(2500);
    host.emit('host:start', { pin });
    await sleep(9500);                                                   // countdown 3 s + «¡YA!» 2.6 s + round 1's question
    for (const p of pages) {
      const r = await p.page.evaluate(LOOK);
      const tag = `${p.w}×${p.h} ${p.name}`;
      ok(r.vis.length === 1 && r.vis[0] === 'screen-trapdoor', `${tag}: the game's screen (${r.vis})`);
      ok(r.on && !r.waiting, `${tag}: its platform is on (no «Entrando…» left)`);
      ok(r.w >= 300 && r.h >= 150, `${tag}: the platform has a real size (${r.w}×${r.h})`);
      ok(r.colours > 12, `${tag}: the platform is drawn (${r.colours} colours)`);
      if (r.card) ok(r.inside, `${tag}: the four answers are inside the window`);
      ok(!p.errors.length, `${tag}: no page errors ${p.errors.slice(0, 2).join(' | ')}`);
      if (p === twin) ok(/ 2$/.test(r.name || ''), `the second device with a playing name plays as «… 2» (${r.name})`);
      if (p === missed) ok((await p.page.evaluate(() => window.__droppedInit || 0)) >= 1, 'the «missed» page really missed its first td:init (and still got its platform)');
      console.log(`${(r.on && r.w >= 300 && r.colours > 12) ? 'ok  ' : 'BAD '} ${tag.padEnd(24)} ${r.w}×${r.h} colours ${r.colours} tiles ${r.tiles}${r.card ? (r.inside ? ' in view' : ' OFF-SCREEN') : ''}`);
    }
    for (const p of pages) await p.ctx.close();
  } finally { await browser.close(); }
  sockets.forEach((s) => { try { s.close(); } catch (_) {} });
  clearTimeout(watchdog);
  console.log(bad ? `FAIL · ${bad} of ${checks} checks` : `PASS · every screen shows the game: ${checks} checks`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL', e && e.message); process.exit(1); });
