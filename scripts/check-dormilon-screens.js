// ¡No despiertes a Dralingo! · every screen in a real browser (headless Chrome through playwright-core) against a RUNNING
// local server (never the live site):
//   node scripts/check-dormilon-screens.js --url http://localhost:4313 --password <the local teacher code> [--out <folder>]
// The projector (1600×900, the teacher types the code on the key screen) + four phones (390×844, 360×640, sideways
// 844×390, a laptop 1366×657) + socket bots that fill the boards and play like kids (answer in 1-3 s, stop now and then,
// guess, react), a phone that joins late. A whole short game (3 min) is played and each moment is photographed as it
// happens: lobby, «Turno de…» + the guess, my guided turn, my turn, a friend's turn with the question live, the danger
// rising, the wake-up, a new night, the last 30 s, «¡FINAL!», the ceremony and my card, the projector's end. Each phone
// must show #screen-dormilon (its stage drawn, tiles inside the window on my turn), never an empty screen.
// Gentle with the laptop: one browser, low priority, every step under a timeout, closed at the end.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const arg = (n, d) => (args.indexOf('--' + n) >= 0 && args[args.indexOf('--' + n) + 1]) || d;
const URL = arg('url', 'http://localhost:4313');
const PASSWORD = arg('password', process.env.TEST_TEACHER_PW || '');
const OUT = arg('out', path.join(__dirname, '..', '..', '..', 'dormilon-shots'));
const BOTS = +arg('bots', 4);
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
const shots = [];
const watchdog = setTimeout(() => { console.log('FAIL · timed out'); finish(1); }, 420000);
const sockets = [];
let browser = null;

// ---------- the socket bots (they play like kids) ----------
function bot(pin, name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  let me = null, pats = 0, stopAt = 1 + Math.floor(Math.random() * 4);
  s.on('dm:init', (d) => { if (d.you) me = d.you.k; });
  s.on('dm:pre', (d) => {
    if (d.k === me) { pats = 0; stopAt = 1 + Math.floor(Math.random() * 4); return; }
    if (Math.random() < 0.8) setTimeout(() => s.emit('player:dm-guess', { pin, g: Math.random() < 0.4 ? 'wake' : 'sleep' }), 300 + Math.random() * 1500);
  });
  s.on('dm:q', (q) => {
    setTimeout(() => {
      if (pats >= stopAt && Math.random() < 0.7) { s.emit('player:dm-stop', { pin }); return; }
      const idx = Math.random() < 0.55 ? Math.floor(Math.random() * q.answers.length) : 0;
      s.emit('player:dm-answer', { pin, qid: q.qid, idx });
    }, 900 + Math.random() * 1800);
  });
  s.on('dm:pat', (d) => { if (d.k === me) pats++; });
  s.on('dm:bq', () => { if (Math.random() < 0.25) s.emit('player:dm-react', { pin, e: ['shh', 'wow', 'lol', 'clap'][Math.floor(Math.random() * 4)] }); });
  return new Promise((res) => s.emit('player:join', { pin, name, avatar: '' }, res));
}

// ---------- pages ----------
async function shot(page, name, freeze) {
  try {
    if (freeze) await page.evaluate(() => { if (window.DormStage) window.DormStage.freeze(true); });
    const f = path.join(OUT, name + '.png');
    await page.screenshot({ path: f, timeout: 15000 });
    shots.push(name);
    if (freeze) await page.evaluate(() => { if (window.DormStage) window.DormStage.freeze(false); });
  } catch (e) { console.log('shot failed', name, e.message); }
}
const frame = (page) => page.evaluate(() => (window.DormilonPhone ? window.DormilonPhone.frame() : null)).catch(() => null);
const LOOK = () => {
  const vis = [...document.querySelectorAll('[id^=screen-]')].filter((e) => !e.classList.contains('hidden')).map((e) => e.id);
  const st = document.querySelector('#dm-stage .dms');
  const r = st ? st.getBoundingClientRect() : null;
  const tiles = [...document.querySelectorAll('#dm-tiles .dm-tile')].map((b) => b.getBoundingClientRect());
  const inside = tiles.every((t) => t.top >= 0 && t.bottom <= innerHeight + 1 && t.left >= 0 && t.right <= innerWidth + 1 && t.height >= 44);
  const stop = document.getElementById('dm-stop').getBoundingClientRect();
  const coach = document.getElementById('dm-coach');
  const cr = coach && !coach.classList.contains('hidden') ? coach.getBoundingClientRect() : null;
  const wide = document.documentElement.scrollWidth <= innerWidth + 1;
  return { vis, stage: r ? [Math.round(r.width), Math.round(r.height)] : null, tiles: tiles.length, inside, stopIn: stop.bottom <= innerHeight + 1 || stop.height === 0, coachIn: !cr || (cr.top >= 0 && cr.bottom <= innerHeight + 1), wide };
};

async function finish(code) {
  clearTimeout(watchdog);
  sockets.forEach((s) => { try { s.disconnect(); } catch (_) {} });
  try { if (browser) await browser.close(); } catch (_) {}
  console.log(`check-dormilon-screens: ${checks - bad}/${checks} checks OK · ${shots.length} shots in ${OUT}`);
  process.exit(code != null ? code : bad ? 1 : 0);
}

(async () => {
  browser = await PW.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  // the projector: the teacher's code on the key screen once, then the lobby
  const hctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const host = await hctx.newPage();
  host.on('pageerror', (e) => { bad++; console.log('FAIL projector error: ' + e.message); });
  await host.goto(`${URL}/host-dormilon.html?setId=${encodeURIComponent(SET)}`, { timeout: 45000, waitUntil: 'domcontentloaded' });
  await host.waitForSelector('#ks-t-code', { timeout: 15000 });
  await host.fill('#ks-t-code', PASSWORD);
  await host.click('.ks-go');
  await host.waitForFunction(() => /^\d+$/.test(document.getElementById('pin-display').textContent), null, { timeout: 15000 });
  const pin = await host.evaluate(() => document.getElementById('pin-display').textContent);
  ok(!!pin, 'the projector opened a room');
  // the phones
  const PHONES = [['Ana', 390, 844, '🌎'], ['Beto', 360, 640, '🧔'], ['Caro', 844, 390, '🧕'], ['Dani', 1366, 657, '🐕']];
  const phones = [];
  for (const [name, w, h, av] of PHONES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
    await ctx.addInitScript((a) => { try { localStorage.setItem('dralyAvatar', a); } catch (_) {} }, av);   // (each phone its own character)
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { bad++; console.log('FAIL ' + name + ' page error: ' + e.message); });
    await page.goto(`${URL}/player.html?pin=${pin}&name=${encodeURIComponent(name)}&autojoin=1`, { timeout: 45000, waitUntil: 'domcontentloaded' });
    phones.push({ name, w, h, page, tag: name.toLowerCase() + '-' + w + 'x' + h, seen: {} });
  }
  for (let i = 0; i < BOTS; i++) await bot(pin, 'Bot' + (i + 1));
  await sleep(2500);
  await shot(host, 'p01-projector-lobby-1600x900');
  await host.setViewportSize({ width: 1366, height: 657 });
  await sleep(500);
  await shot(host, 'p02-projector-lobby-1366x657');
  await host.setViewportSize({ width: 1600, height: 900 });
  await shot(phones[0].page, 'k01-phone-lobby-390x844');
  await shot(phones[1].page, 'k02-phone-lobby-360x640');
  // 3 minutes, start
  await host.click('.dmh-dur button[data-s="180"]');
  await sleep(300);
  await host.click('#start-btn');
  await sleep(1800);
  await shot(host, 'p03-projector-countdown', true);
  await sleep(3200);
  for (const p of phones) { const f = await frame(p.page); ok(f && f.on && f.board, p.name + ' is seated on a board: ' + JSON.stringify(f && f.seats)); }
  await shot(host, 'p04-projector-intro');
  // a late joiner (a new phone after the start)
  const lctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const late = await lctx.newPage();
  late.on('pageerror', (e) => { bad++; console.log('FAIL late page error: ' + e.message); });
  await late.goto(`${URL}/player.html?pin=${pin}&name=Eli&autojoin=1`, { timeout: 45000, waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const lf = await frame(late);
  ok(lf && lf.on && lf.board, 'a late joiner sits on a board: ' + JSON.stringify(lf));
  const ll = await late.evaluate(LOOK);
  ok(ll.vis.includes('screen-dormilon') && ll.stage && ll.stage[1] > 100, 'the late joiner sees the game: ' + JSON.stringify(ll));
  await shot(late, 'k03-late-joiner-390x844');

  // play: the browser phones answer like kids; photograph every moment as it happens
  const t0 = Date.now();
  let hostWake = false, hostFrenzy = false, hostNight = false, hostMid = false;
  const allPhones = phones.concat([{ name: 'Eli', page: late, tag: 'eli-390x844', seen: {} }]);
  while (Date.now() - t0 < 200000) {
    const hf = await host.evaluate(() => window.DormHost && window.DormHost.frame()).catch(() => null);
    if (hf && hf.phase === 'final') break;
    for (const p of allPhones) {
      const f = await frame(p.page);
      if (!f || !f.on) continue;
      const S = p.seen;
      // my turn: answer like a kid (pick a tile in ~1.5 s), stop after 2-3 strokes sometimes
      if (f.turn && f.turn.mine && f.turn.phase === 'turn' && f.q) {
        if (f.turn.guided && !S.guided) { S.guided = 1; await shot(p.page, 'k10-guided-turn-' + p.tag, true); const L = await p.page.evaluate(LOOK); ok(L.tiles >= 2 && L.inside && L.stopIn && L.coachIn && L.wide, p.name + ' guided turn: the tiles and «¡Me retiro!» fit: ' + JSON.stringify(L)); }
        else if (!f.turn.guided && !S.turn) { S.turn = 1; await shot(p.page, 'k11-my-turn-' + p.tag, true); const L = await p.page.evaluate(LOOK); ok(L.tiles >= 2 && L.inside && L.stopIn && L.wide, p.name + ' my turn fits: ' + JSON.stringify(L)); }
        const qk = f.q;
        if (S.lastQ !== qk) {
          S.lastQ = qk;
          await sleep(500);
          if (Math.random() < 0.15 && S.turn) await p.page.evaluate(() => window.DormilonPhone.stop());
          else await p.page.evaluate((i) => window.DormilonPhone.answer(i), Math.floor(Math.random() * 3));
        }
      }
      if (f.turn && !f.turn.mine && f.panel === 'dm-watch') {
        if (f.turn.phase === 'pre' && !S.guess) { S.guess = 1; await shot(p.page, 'k20-watch-guess-' + p.tag, true); }
        if (f.turn.phase === 'turn' && !S.watchQ) {
          const hasQ = await p.page.evaluate(() => !document.getElementById('dm-bq').classList.contains('hidden'));
          if (hasQ) { S.watchQ = 1; await p.page.evaluate(() => { const b = document.querySelector('#dm-bq-opts .dm-bqo'); if (b) b.click(); document.querySelector('#dm-reacts button').click(); }); await sleep(300); await shot(p.page, 'k21-watch-question-' + p.tag, true); }
        }
      }
      if (f.cue >= 2 && f.cue < 4 && !S.danger) { S.danger = 1; await shot(p.page, 'k30-danger-cue' + f.cue + '-' + p.tag, true); }
      if (f.cue >= 4 && !S.wake) {
        S.wake = 1;
        await shot(p.page, 'k31-wake-' + p.tag, true);
        if (!hostWake) { hostWake = true; await shot(host, 'p06-projector-wake', true); }
      }
      if (f.night >= 2 && f.panel === 'dm-msg' && !S.night) { S.night = 1; await shot(p.page, 'k32-new-night-' + p.tag); if (!hostNight) { hostNight = true; await shot(host, 'p07-projector-new-night'); } }
      if (f.frenzy && !S.frenzy) { S.frenzy = 1; await shot(p.page, 'k40-last30-' + p.tag, true); if (!hostFrenzy) { hostFrenzy = true; await shot(host, 'p08-projector-last30', true); } }
    }
    if (!hostMid && Date.now() - t0 > 25000) { hostMid = true; await shot(host, 'p05-projector-mid-game', true); }
    await sleep(250);
  }
  // «¡FINAL!» and the ceremony
  await sleep(600);
  await shot(host, 'p09-projector-final');
  await shot(phones[0].page, 'k50-final-' + phones[0].tag);
  await sleep(2600);
  for (const p of allPhones.slice(0, 3)) await shot(p.page, 'k51-ceremony-start-' + p.tag);
  await sleep(3500);
  await shot(phones[0].page, 'k52-ceremony-mid-' + phones[0].tag);
  await shot(host, 'p10-projector-end');
  await host.setViewportSize({ width: 1366, height: 657 });
  await sleep(600);
  await shot(host, 'p11-projector-end-1366x657');
  await sleep(9000);
  for (const p of allPhones) {
    await shot(p.page, 'k53-my-card-' + p.tag);
    const c = await p.page.evaluate(() => { const c = document.querySelector('.dm-mycard'); if (!c) return null; const r = c.getBoundingClientRect(); return { h: r.height, top: r.top, home: !!c.querySelector('.dm-home') }; });
    ok(c && c.home, p.name + ' got its card with «Inicio»: ' + JSON.stringify(c));
  }
  await finish();
})().catch((e) => { console.log('FAIL · ' + e.message); finish(1); });
