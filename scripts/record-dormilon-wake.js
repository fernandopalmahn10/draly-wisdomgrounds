// ⚠ v3 ONLY (turns + «¿Se despierta?»): v4 (2026-10-24, the Windows rhythm) has no turns; its play window is filmed at
// 4 fps by scripts/check-dormilon-screens.js (turn-frames/) and its wake-up by the same run (k31 / k31b). Kept for the record.
// ¡No despiertes a Dralingo! · a WAKE-UP filmed at 4 fps on a real phone (390×844, headless Chrome) for the side-by-side
// with the video's (his rule «Big moments take over the whole screen with their emotion»: the Wiggler turns red, rays,
// shake, steam, the points vanish).
//   node scripts/record-dormilon-wake.js --url http://localhost:4313 --password <the local teacher code> [--out <folder>]
// Ana (the browser phone) plays a board of 4 with three socket bots (two tickles a turn); she answers the quiz right
// and on her turns rubs his head with a real touch finger (CDP) until her feathers run out. The phone is photographed
// every 250 ms into a 2-s ring; when he wakes up on her board the ring (the 2 s before) and the next 5.5 s are written:
// mine-wNN.png when Ana woke him (the waker's phone), watch-wNN.png when a friend did (a watcher's phone), + wake.json.
// It stops once Ana's own wake-up is filmed (or after 4 minutes). Gentle: one browser, low priority, timeouts.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const arg = (n, d) => (args.indexOf('--' + n) >= 0 && args[args.indexOf('--' + n) + 1]) || d;
const URL = arg('url', 'http://localhost:4313');
const PASSWORD = arg('password', process.env.TEST_TEACHER_PW || '');
const OUT = arg('out', path.join(__dirname, '..', '..', '..', 'dormilon-shots', 'wake-4fps'));
const SET = 'pack:yct1-familia-r1';
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
process.env.DRALY_DATA_DIR = process.env.DRALY_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'dm-rec-'));
const RIGHT = new Map();
require('../core/packs').forGames(require('../core/sets').loadSet(SET).questions || []).forEach((q) => RIGHT.set(q.text, q.correct));
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).filter((f) => /^(mine|watch)-w\d+\.png$/.test(f)).forEach((f) => fs.unlinkSync(path.join(OUT, f)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const sockets = [];
let browser = null;
const watchdog = setTimeout(() => { console.log('FAIL · timed out'); finish(1); }, 330000);
async function finish(code) {
  clearTimeout(watchdog);
  sockets.forEach((s) => { try { s.disconnect(); } catch (_) {} });
  if (browser) await browser.close().catch(() => {});
  process.exit(code);
}
// three friends: they answer right 80 % of the time and tickle twice on their turn
function bot(pin, name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  let me = null, t = null;
  s.on('dm:init', (d) => { if (d.you) me = d.you.k; });
  s.on('dm:q', (q) => {
    const ri = q.answers.indexOf(RIGHT.get(q.text));
    const idx = ri >= 0 && Math.random() < 0.8 ? ri : Math.floor(Math.random() * q.answers.length);
    setTimeout(() => s.emit('player:dm-answer', { pin, qid: q.qid, idx }), 1100 + Math.random() * 1200);
  });
  s.on('dm:go', (d) => {
    if (d.k !== me) return;
    let n = 0;                     // (two tickles, then «¡Me retiro!»: most of the danger comes from Ana's own turns)
    const rub = () => { if (n++ >= 2) { s.emit('player:dm-stop', { pin }); return; } s.emit('player:dm-feather', { pin, x: 0.36 + Math.random() * 0.1, y: 0.38 + Math.random() * 0.05 }); s.emit('player:dm-stroke', { pin }); t = setTimeout(rub, 650 + Math.random() * 150); };
    t = setTimeout(rub, 600);
  });
  const off = (d) => { if (d.k === me && t) { clearTimeout(t); t = null; } };
  s.on('dm:end', off);
  s.on('dm:wake', off);
  return new Promise((res) => s.emit('player:join', { pin, name, avatar: '' }, res));
}

(async () => {
  const host = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(host);
  const made = await ack(host, 'host:create', { gameType: 'dormilon', password: PASSWORD });
  if (!made || !made.pin) { console.log('FAIL · host:create', made && made.error); return finish(1); }
  const pin = made.pin;
  await ack(host, 'host:load-set', { pin, setId: SET });
  host.emit('host:set-duration', { pin, duration: 240 });
  const wakes = [];
  host.on('dm:wake', (d) => wakes.push({ at: Date.now(), b: d.b, k: d.k, lost: d.lost }));
  browser = await PW.chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${URL}/player.html?pin=${pin}&name=Ana&autojoin=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(1800);
  for (const n of ['Beto', 'Caro', 'Dani']) await bot(pin, n);
  await sleep(600);
  host.emit('host:start', { pin });
  const frame = () => page.evaluate(() => window.DormilonPhone && window.DormilonPhone.frame()).catch(() => null);
  let rubbing = false;
  async function finger() {
    rubbing = true;
    try {
      const [cx, cy] = await page.evaluate(() => {
        const st = window.DormilonPhone.stage();
        const box = document.getElementById('dm-stage').getBoundingClientRect();
        const [px, py] = st.cuPoint(...st.cuHead());
        return [box.left + px, box.top + py];
      });
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
      await touch('touchStart', cx - 45, cy);
      for (let i = 0; i < 7; i++) {
        const f = await frame();
        if (!f || !f.myturn || f.cue >= 4) break;
        for (const dir of [1, -1]) for (let s = 1; s <= 8; s++) { const u = dir > 0 ? s / 8 : 1 - s / 8; await touch('touchMove', cx - 45 + u * 90, cy + Math.sin(u * Math.PI) * (dir > 0 ? -10 : 10)); await sleep(20); }
      }
      await touch('touchEnd', cx, cy);
    } catch (_) { /* the turn ended */ }
    rubbing = false;
  }
  // film: a frame every 250 ms into a ring of 8; a wake-up on Ana's board writes the ring + 22 frames more
  const ring = [];
  let lastQ = null, myK = null, myB = null, capture = null, gotMine = false, gotWatch = false;
  const t0 = Date.now();
  const meta = { at: new Date().toISOString(), fps: 4, viewport: '390x844', sets: [] };
  while (Date.now() - t0 < 300000 && !gotMine) {
    const t = Date.now();
    const f = await frame();
    if (f && f.you != null && myK == null) { myK = f.you; myB = f.board; }       // (frame().you = my seat key)
    let png = null;
    try { png = await page.screenshot({ timeout: 4000 }); } catch (_) { /* next */ }
    const info = { ms: t - t0, phase: f && f.turn && f.turn.phase, myturn: f && f.myturn, cue: f && f.cue, feathers: f && f.feathers, seats: f && f.seats };
    if (png) { ring.push({ png, info }); if (ring.length > 8) ring.shift(); }
    // a wake-up on my board starts a capture
    const w = wakes.find((x) => !x.seen && x.b === myB);
    if (w && !capture) {
      w.seen = true;
      const mine = w.k === myK;
      if ((mine && !gotMine) || (!mine && !gotWatch)) capture = { tag: mine ? 'mine' : 'watch', frames: ring.slice(), left: 22, wake: w };
    } else if (capture && png) {
      capture.frames.push({ png, info });
      if (--capture.left <= 0) {
        capture.frames.forEach((x, i) => fs.writeFileSync(path.join(OUT, capture.tag + '-w' + String(i).padStart(2, '0') + '.png'), x.png));
        meta.sets.push({ tag: capture.tag, lost: capture.wake.lost, wakeAtFrame: 8, frames: capture.frames.map((x, i) => Object.assign({ name: capture.tag + '-w' + String(i).padStart(2, '0') + '.png' }, x.info)) });
        if (capture.tag === 'mine') gotMine = true; else gotWatch = true;
        console.log('filmed a wake-up (' + capture.tag + ', lost ' + capture.wake.lost + ')');
        capture = null;
      }
    }
    // play: answer right between turns, rub on my turn
    if (f && f.q && f.q !== lastQ && !f.myturn) {
      lastQ = f.q;
      const right = RIGHT.get(f.q);
      const i = right != null && f.answers ? f.answers.indexOf(right) : 0;
      setTimeout(() => page.evaluate((k) => window.DormilonPhone.answer(k), i >= 0 ? i : 0).catch(() => {}), 700);
    }
    if (f && f.myturn && f.turn && f.turn.phase === 'turn' && !rubbing && !capture) { if (process.env.DEBUG) console.log('my turn', Math.round((Date.now() - t0) / 1000), 's · feathers', f.feathers, '· seats', f.seats.join(' ')); finger(); }
    await sleep(Math.max(0, 250 - (Date.now() - t)));
  }
  fs.writeFileSync(path.join(OUT, 'wake.json'), JSON.stringify(meta, null, 1));
  console.log((gotMine ? 'PASS' : gotWatch ? 'PASS (a friend woke him: watcher film only)' : 'FAIL · no wake-up filmed') + ' · ' + OUT);
  finish(gotMine || gotWatch ? 0 : 1);
})().catch((e) => { console.log('FAIL · ' + (e && e.stack || e)); finish(1); });
