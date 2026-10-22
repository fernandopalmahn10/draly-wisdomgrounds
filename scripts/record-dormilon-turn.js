// ¡No despiertes a Dralingo! · one kid's ordinary turn filmed at 4 fps on a real phone (390×844, headless Chrome through
// playwright-core) against a RUNNING local server, for the side-by-side with the original minigame's turn (his rule
// «Never call it done unless it FEELS like Mario Party»: frames of both, where it wins and where we lose).
//   node scripts/record-dormilon-turn.js --url http://localhost:4313 --password <the local teacher code> [--out <folder>]
// Ana (the browser phone) plays a board of 4 with three socket bots. Between turns she answers the quiz RIGHT (the pack
// says which: a strong kid fills her quiver); on her first ordinary turn the script rubs his head with a real touch
// finger (CDP touch events: touchstart / touchmove / touchend, one back-and-forth about every 0.75 s, like the original's
// ~1 pat a second) while a frame is taken every 250 ms from «Turno de Ana» to the bedroom after it. Writes fNN.png +
// frames.json (the time, the count, my feathers and score of each frame). Gentle: one browser, low priority, timeouts.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const arg = (n, d) => (args.indexOf('--' + n) >= 0 && args[args.indexOf('--' + n) + 1]) || d;
const URL = arg('url', 'http://localhost:4313');
const PASSWORD = arg('password', process.env.TEST_TEACHER_PW || '');
const OUT = arg('out', path.join(__dirname, '..', '..', '..', 'dormilon-shots', 'turn-4fps'));
const STROKES = +arg('strokes', 6);
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
// the pack, read the way the server reads it (question text → the right answer), so Ana answers like a strong kid
process.env.DRALY_DATA_DIR = process.env.DRALY_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'dm-rec-'));
const RIGHT = new Map();
(require('../core/sets').loadSet(SET).questions || []).forEach((q) => RIGHT.set(q.text, q.correct));
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).filter((f) => /^f\d+\.png$/.test(f)).forEach((f) => fs.unlinkSync(path.join(OUT, f)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const sockets = [];
let browser = null;
const watchdog = setTimeout(() => { console.log('FAIL · timed out'); finish(1); }, 240000);
async function finish(code) {
  clearTimeout(watchdog);
  sockets.forEach((s) => { try { s.disconnect(); } catch (_) {} });
  if (browser) await browser.close().catch(() => {});
  process.exit(code);
}

// three friends of the board: they answer, guess on Ana's turn, and keep their own turns short (1-2 strokes, then stop)
function bot(pin, name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  let me = null, t = null;
  s.on('dm:init', (d) => { if (d.you) me = d.you.k; });
  s.on('dm:pre', (d) => { if (d.k !== me && !d.guided) setTimeout(() => s.emit('player:dm-guess', { pin, g: Math.random() < 0.4 ? 'wake' : 'sleep' }), 400 + Math.random() * 900); });
  s.on('dm:q', (q) => setTimeout(() => s.emit('player:dm-answer', { pin, qid: q.qid, idx: Math.floor(Math.random() * q.answers.length) }), 1200 + Math.random() * 1500));
  s.on('dm:go', (d) => {
    if (d.k !== me) return;
    let n = 0;
    const stopAt = 1 + Math.floor(Math.random() * 2);
    const rub = () => {
      if (n >= stopAt) { s.emit('player:dm-stop', { pin }); return; }
      s.emit('player:dm-feather', { pin, x: 0.36 + Math.random() * 0.1, y: 0.38 + Math.random() * 0.05 });
      s.emit('player:dm-stroke', { pin });
      n++;
      t = setTimeout(rub, 800);
    };
    t = setTimeout(rub, 700);
  });
  const off = (d) => { if (d.k === me && t) { clearTimeout(t); t = null; } };
  s.on('dm:end', off);
  s.on('dm:wake', off);
  s.on('dm:pat', (d) => { if (d.k !== me && Math.random() < 0.3) s.emit('player:dm-react', { pin, e: ['shh', 'wow', 'clap'][Math.floor(Math.random() * 3)] }); });
  return new Promise((res) => s.emit('player:join', { pin, name, avatar: '' }, res));
}

(async () => {
  const host = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(host);
  const made = await ack(host, 'host:create', { gameType: 'dormilon', password: PASSWORD });
  if (!made || !made.pin) { console.log('FAIL · host:create', made && made.error); return finish(1); }
  const pin = made.pin;
  await ack(host, 'host:load-set', { pin, setId: SET });
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

  // a finger: touchstart on his head, then back and forth across it (~0.45 s each way), one stroke ≈ 0.9 s
  async function finger(stopWhen) {
    const at = await page.evaluate(() => {
      const st = window.DormilonPhone.stage();
      const box = document.getElementById('dm-stage').getBoundingClientRect();
      const [hx, hy] = st.cuHead();
      const [px, py] = st.cuPoint(hx, hy);
      return [box.left + px, box.top + py];
    });
    const [cx, cy] = at;
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y), id: 1 }] });
    await touch('touchStart', cx - 45, cy);
    let done = 0;
    for (let i = 0; i < STROKES && !(await stopWhen()); i++) {
      for (const dir of [1, -1]) {
        for (let s = 1; s <= 8; s++) {
          const u = dir > 0 ? s / 8 : 1 - s / 8;
          await touch('touchMove', cx - 45 + u * 90, cy + Math.sin(u * Math.PI) * (dir > 0 ? -10 : 10));
          await sleep(20);
        }
      }
      done++;
    }
    await touch('touchEnd', cx, cy);
    return done;
  }

  // wait for Ana's first ordinary turn, answering the quiz right in the meantime
  let lastQ = null, rec = false, guidedDone = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const f = await frame();
    if (f && f.turn && f.turn.mine && !f.turn.guided && f.turn.phase === 'pre') { rec = true; break; }
    if (f && f.q && f.q !== lastQ && !f.myturn) {
      lastQ = f.q;
      const right = RIGHT.get(f.q);
      const i = right != null && f.answers ? f.answers.indexOf(right) : -1;
      await sleep(500);
      await page.evaluate((k) => window.DormilonPhone.answer(k), i >= 0 ? i : 0).catch(() => {});
    }
    // my guided first turn: two gentle strokes, then «¡Me retiro!» (the recording is about the ordinary turn)
    if (f && f.myturn && f.turn && f.turn.guided && f.turn.phase === 'turn' && !guidedDone) {
      guidedDone = true;
      await page.evaluate(() => window.DormilonPhone.rub(2, 800)).catch(() => {});
      await page.evaluate(() => window.DormilonPhone.stop()).catch(() => {});
      await sleep(400);
    }
    await sleep(150);
  }
  if (!rec) { console.log('FAIL · Ana never got an ordinary turn'); return finish(1); }

  // film it: a frame every 250 ms from «Turno de Ana» until 1.5 s after her turn ended
  const log = [];
  let i = 0, rubbing = null, endedAt = 0;
  const tStart = Date.now();
  while (Date.now() - tStart < 20000) {
    const t = Date.now();
    const f = await frame();
    const name = 'f' + String(i).padStart(2, '0') + '.png';
    try { await page.screenshot({ path: path.join(OUT, name), timeout: 4000 }); } catch (_) { /* next */ }
    log.push({ name, ms: t - tStart, phase: f && f.turn && f.turn.phase, mine: f && f.turn && f.turn.mine, myturn: f && f.myturn, feathers: f && f.feathers, cue: f && f.cue, you: f && f.you && f.you.score, wake: f && f.cue >= 4 });
    i++;
    if (!rubbing && f && f.myturn && f.turn && f.turn.phase === 'turn') {
      rubbing = sleep(500).then(() => finger(async () => { const g = await frame(); return !g || !g.myturn; }));
    }
    if (!endedAt && rubbing && f && !f.myturn) endedAt = Date.now();
    if (endedAt && Date.now() - endedAt > 1500) break;
    await sleep(Math.max(0, 250 - (Date.now() - t)));
  }
  const strokes = rubbing ? await rubbing.catch(() => 0) : 0;
  fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify({ at: new Date().toISOString(), fps: 4, viewport: '390x844', strokes, frames: log }, null, 1));
  console.log('PASS · ' + log.length + ' frames · ' + strokes + ' strokes rubbed · ' + OUT);
  finish(0);
})().catch((e) => { console.log('FAIL · ' + (e && e.stack || e)); finish(1); });
