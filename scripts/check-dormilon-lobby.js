// ¡No despiertes a Dralingo! · the projector at every laptop / projector size (his report 2026-10-22: "when the host is
// going to share that pin game… the button gets lost… it's unscrollable… you cannot find the button to press start").
//   node scripts/check-dormilon-lobby.js --url http://localhost:4313 --password <the local teacher code> [--out <folder>]
// For each size (1366×657, 1280×720, 1440×900, 1600×900, 1920×1080, and the browser at 125 %: 1366×768 and 1920×1080
// laptops zoomed in, and a 1080p laptop at 150 %): the lobby shows the PIN, the QR and «¡Empezar!» fully on the first screen, nothing wider than the
// window, and when the page is taller than the window a REAL mouse wheel moves it. Then a game starts (one socket kid)
// and the teacher's toolbar (Pausa, +30 s, −30 s, Saltar, Terminar, Sonido) must be fully visible too. A screenshot of
// each. Gentle: one browser, low priority, every step under a timeout.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const arg = (n, d) => (args.indexOf('--' + n) >= 0 && args[args.indexOf('--' + n) + 1]) || d;
const URL = arg('url', 'http://localhost:4313');
const PASSWORD = arg('password', process.env.TEST_TEACHER_PW || '');
const OUT = arg('out', path.join(__dirname, '..', '..', '..', 'dormilon-shots', 'lobby'));
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code>'); process.exit(2); }
try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
function loadPw() {
  const tries = ['playwright-core', process.env.PLAYWRIGHT_CORE,
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@playwright', 'cli', 'node_modules', 'playwright-core')].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (_) { /* next */ } }
  return null;
}
const PW = loadPw();
if (!PW) { console.log('SKIP · no playwright-core here (set PLAYWRIGHT_CORE)'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const SET = 'pack:yct1-familia-r1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0, bad = 0;
const ok = (c, m) => { checks++; if (!c) { bad++; console.log('FAIL ' + m); } };
// [name, CSS width, CSS height, device scale] (a 125 % zoom = the same window seen through a 1.25 bigger pixel)
const SIZES = [['1366x657', 1366, 657, 1], ['1280x720', 1280, 720, 1], ['1440x900', 1440, 900, 1], ['1600x900', 1600, 900, 1],
  ['1920x1080', 1920, 1080, 1], ['1366x657-zoom125', 1093, 526, 1.25], ['1920x1080-zoom125', 1536, 864, 1.25], ['1920x1080-zoom150', 1280, 720, 1.5]];
const watchdog = setTimeout(() => { console.log('FAIL · timed out'); process.exit(1); }, 300000);
const INVIEW = (sels) => {
  const out = {};
  sels.forEach((s) => {
    const e = document.querySelector(s);
    if (!e) { out[s] = 'missing'; return; }
    const r = e.getBoundingClientRect();
    out[s] = r.width > 0 && r.height > 0 && r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 ? 'in' : 'OUT ' + [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)].join(',');
  });
  const se = document.scrollingElement || document.documentElement;
  out.wide = se.scrollWidth <= innerWidth + 1;
  out.tall = se.scrollHeight - se.clientHeight;
  return out;
};

(async () => {
  const browser = await PW.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  for (const [name, w, h, dsf] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { bad++; console.log('FAIL ' + name + ' page error: ' + e.message); });
    await page.goto(`${URL}/host-dormilon.html?setId=${encodeURIComponent(SET)}`, { timeout: 45000, waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#ks-t-code', { timeout: 15000 });
    await page.fill('#ks-t-code', PASSWORD);
    await page.click('.ks-go');
    await page.waitForFunction(() => /^\d+$/.test(document.getElementById('pin-display').textContent), null, { timeout: 15000 });
    const pin = await page.evaluate(() => document.getElementById('pin-display').textContent);
    const kid = io(URL, { transports: ['websocket'], forceNew: true });
    await new Promise((res) => kid.emit('player:join', { pin, name: 'Ana', avatar: '' }, res));
    await sleep(1200);
    const L = await page.evaluate(INVIEW, ['#pin-display', '#qr', '#start-btn', '.dmh-dur']);
    await page.screenshot({ path: path.join(OUT, 'lobby-' + name + '.png') });
    ok(L['#pin-display'] === 'in' && L['#qr'] === 'in' && L['#start-btn'] === 'in' && L['.dmh-dur'] === 'in' && L.wide, name + ' lobby: PIN, QR, time and «¡Empezar!» on the first screen ' + JSON.stringify(L));
    if (L.tall > 4) {
      await page.mouse.move(w / 2, h * 0.6);
      await page.mouse.wheel(0, 400);
      await sleep(400);
      const y = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
      ok(y > 0, name + ' lobby is taller than the window (' + L.tall + ' px) and the wheel moves it');
      await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTo(0, 0));
    }
    // the game: the teacher's toolbar
    await page.click('#start-btn');
    await page.waitForSelector('#screen-active:not(.hidden)', { timeout: 20000 });
    await sleep(800);
    const T = await page.evaluate(INVIEW, ['#pause-btn', '#plus-btn', '#minus-btn', '#skip-btn', '#end-now-btn', '#mute-btn']);
    await page.screenshot({ path: path.join(OUT, 'game-' + name + '.png') });
    ok(['#pause-btn', '#plus-btn', '#minus-btn', '#skip-btn', '#end-now-btn', '#mute-btn'].every((s) => T[s] === 'in') && T.wide, name + ' game: every teacher button (incl. «−30 s») fully visible ' + JSON.stringify(T));
    kid.disconnect();
    await ctx.close();
  }
  await browser.close();
  clearTimeout(watchdog);
  console.log(`check-dormilon-lobby: ${checks - bad}/${checks} checks OK · shots in ${OUT}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('FAIL · ' + (e && e.stack || e)); process.exit(1); });
