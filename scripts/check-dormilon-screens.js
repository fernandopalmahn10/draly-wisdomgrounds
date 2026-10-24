// Draly Siesta · ¡No despiertes a Dralingo! v4 · every screen in a real browser (headless Chrome through playwright-core)
// against a RUNNING local server (never the live site):
//   node scripts/check-dormilon-screens.js --url http://localhost:4313 --password <the local teacher code> [--out <folder>]
// The projector (1600×900, the teacher types the code on the key screen) + four phones (390×844, 360×640, sideways
// 844×390, a laptop 1366×657) + socket bots that fill the boards and play like kids (answer in 1-3 s; in the play window
// they rub at the same time, some stop with «¡Me retiro!», they react), a phone that joins late. A whole short game
// (3 min) is played and each moment is photographed as it happens: the lobby, a question window (my question + my 4
// feathers), «¡A hacerle cosquillas!», my guided first play window, rubbing with my tower growing while my friends'
// tickles land live, my tower in the safe, the danger rising, the wake-up (and its peak: his angry face inside the view),
// the tally, the final round ×2, «¡FINAL!», the towers' reveal, my card, the projector's end. One play window of the
// 390×844 phone is filmed at 4 fps (turn-frames/) for the side-by-side with the original. Each phone must show
// #screen-dormilon, never an empty screen, nothing wider than the window, «¡Me retiro!» and the tiles inside it.
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
const RIGHT = {};
try { (require('../core/packs').loadPack('yct1-familia-r1').questions || []).forEach((q) => { RIGHT[q.text] = String(q.correct); }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0, bad = 0;
const ok = (c, m) => { checks++; if (!c) { bad++; console.log('FAIL ' + m); } };
const shots = [];
const watchdog = setTimeout(() => { console.log('FAIL · timed out'); finish(1); }, 480000);
const sockets = [];
let browser = null;

// ---------- the socket bots (they play like kids) ----------
function bot(pin, name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  let me = null, rubT = null, feathers = 0, pile = 0, phase = null, cue = 0, awake = false, safe = false;
  const stopAt = 1 + Math.floor(Math.random() * 4);
  s.on('dm:init', (d) => { if (d.you) { me = d.you.k; feathers = d.you.feathers; } });
  s.on('dm:q', (q) => setTimeout(() => {
    const r = RIGHT[q.text] != null ? q.answers.indexOf(RIGHT[q.text]) : -1;
    s.emit('player:dm-answer', { pin, qid: q.qid, idx: r >= 0 && Math.random() < 0.75 ? r : Math.floor(Math.random() * q.answers.length) });
  }, 1100 + Math.random() * 1600));
  s.on('dm:qr', (d) => { feathers = d.feathers; });
  const rub = () => {
    rubT = null;
    if (phase !== 'pw' || safe || feathers <= 0) return;
    if (awake) { rubT = setTimeout(rub, 500); return; }
    if (pile >= stopAt || (pile && cue >= 3)) { s.emit('player:dm-stop', { pin }); return; }
    s.emit('player:dm-stroke', { pin, x: 0.3 + Math.random() * 0.2, y: 0.35 + Math.random() * 0.1 });
    rubT = setTimeout(rub, 550 + Math.random() * 450);
  };
  s.on('dm:round', (d) => {
    phase = d.phase;
    if (d.phase === 'qw') { pile = 0; safe = false; }
    if (d.phase === 'pw') { safe = feathers <= 0; awake = false; rubT = setTimeout(rub, 300 + Math.random() * 1200); }
    if (d.phase === 'pwout' && rubT) { clearTimeout(rubT); rubT = null; }
  });
  s.on('dm:pat', (d) => { cue = d.cue; if (d.k === me) { pile = d.pile; feathers = d.feathers; } });
  s.on('dm:bank', (d) => { if (d.k === me) { safe = true; pile = 0; if (Math.random() < 0.5) setTimeout(() => s.emit('player:dm-react', { pin, e: ['shh', 'wow', 'lol', 'clap'][Math.floor(Math.random() * 4)] }), 600); } });
  s.on('dm:wake', (d) => { awake = true; if (d.k === me) pile = 0; });
  s.on('dm:sleep', (d) => { awake = false; cue = d.cue || 0; });
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
  const box = (id) => { const e = document.getElementById(id); return e ? e.getBoundingClientRect() : { height: 0 }; };
  const stop = box('dm-stop'), cnt = box('dm-count'), tower = box('dm-tower'), quiver = box('dm-hudq');
  const wide = document.documentElement.scrollWidth <= innerWidth + 1;
  const inV = (b) => b.height === 0 || (b.top >= -1 && b.bottom <= innerHeight + 1 && b.left >= -1 && b.right <= innerWidth + 1);
  const turnIn = stop.height === 0 || (inV(stop) && inV(cnt) && inV(tower) && inV(quiver) && stop.height >= 44);
  // the HUD's pieces never sit on top of each other
  const ov = (a, b) => a.height && b.height && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  const clash = ov(tower, stop) || ov(quiver, stop) || ov(tower, quiver);
  return { vis, stage: r ? [Math.round(r.width), Math.round(r.height)] : null, tiles: tiles.length, inside, hudIn: turnIn, clash, wide };
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
  const PHONES = [['Ana', 390, 844, '🌎'], ['Beto', 360, 640, '🧔'], ['Caro', 844, 390, '🧕'], ['Dani', 1366, 657, '🐕']];
  const phones = [];
  for (const [name, w, h, av] of PHONES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
    await ctx.addInitScript((a) => { try { localStorage.setItem('dralyAvatar', a); } catch (_) {} }, av);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { bad++; console.log('FAIL ' + name + ' page error: ' + e.message); });
    await page.goto(`${URL}/player.html?pin=${pin}&name=${encodeURIComponent(name)}&autojoin=1`, { timeout: 45000, waitUntil: 'domcontentloaded' });
    phones.push({ name, w, h, page, tag: name.toLowerCase() + '-' + w + 'x' + h, seen: {} });
  }
  for (let i = 0; i < BOTS; i++) await bot(pin, 'Bot' + (i + 1));
  await sleep(2500);
  await shot(host, 'p01-projector-lobby-1600x900');
  await shot(phones[0].page, 'k01-phone-lobby-390x844');
  await shot(phones[1].page, 'k02-phone-lobby-360x640');
  await host.click('.dmh-dur button[data-s="180"]');
  await sleep(300);
  await host.click('#start-btn');
  await sleep(1800);
  await shot(host, 'p03-projector-countdown', true);
  await sleep(3200);
  for (const p of phones) { const f = await frame(p.page); ok(f && f.on && f.board, p.name + ' is seated on a board: ' + JSON.stringify(f && f.seats)); }
  await shot(host, 'p04-projector-intro');
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

  const t0 = Date.now();
  const H = {};
  const allPhones = phones.concat([{ name: 'Eli', page: late, tag: 'eli-390x844', seen: {} }]);
  const REC = path.join(OUT, 'turn-frames');
  fs.mkdirSync(REC, { recursive: true });
  fs.readdirSync(REC).forEach((f) => { if (/^f\d+\.png$/.test(f)) fs.unlinkSync(path.join(REC, f)); });
  // a whole play window of Ana's phone at 4 fps (a frame every 250 ms while she rubs), for the side-by-side
  async function recordWindow(p) {
    // she plays the whole window like a kid: rubs gently while he sleeps, «¡Me retiro!» at 3 coins or when he looks restless
    let filming = true;
    const go = (async () => {
      while (filming) {
        const f = await frame(p.page);
        if (!f || !f.round || f.round.phase !== 'pw') { await sleep(150); continue; }
        if (f.safe || f.feathers <= 0) break;
        if (f.awake) { await sleep(200); continue; }
        if (f.pile >= 3 || (f.pile >= 1 && f.cue >= 3)) { await p.page.evaluate(() => window.DormilonPhone.stop()).catch(() => {}); break; }
        await p.page.evaluate(() => window.DormilonPhone.rub(1, 760)).catch(() => {});
        await sleep(120);
      }
    })();
    for (let i = 0; i < 64; i++) {
      const t = Date.now();
      try { await p.page.screenshot({ path: path.join(REC, 'f' + String(i).padStart(2, '0') + '.png'), timeout: 8000 }); } catch (_) { /* next */ }
      const f2 = await frame(p.page);
      if (!f2 || !f2.round || f2.round.phase === 'qw') break;
      await sleep(Math.max(0, 250 - (Date.now() - t)));
    }
    filming = false;
    await go.catch(() => {});
    shots.push('turn-frames');
  }
  while (Date.now() - t0 < 230000) {
    const hf = await host.evaluate(() => window.DormHost && window.DormHost.frame()).catch(() => null);
    if (hf && hf.phase === 'final') break;
    const hr = hf && hf.round;
    if (hr && hr.phase === 'qw' && !H.qw && Date.now() - t0 > 3000) { H.qw = 1; await shot(host, 'p05-projector-question-window', true); }
    if (hr && hr.phase === 'pw' && !H.pw && Date.now() - t0 > 3000) { H.pw = 1; await sleep(1500); await shot(host, 'p05b-projector-play-window', true); }
    for (const p of allPhones) {
      const f = await frame(p.page);
      if (!f || !f.on || !f.round) continue;
      const S = p.seen;
      const ph = f.round.phase;
      if (ph === 'qw') {
        if (f.q && S.lastQ !== f.q) {
          S.lastQ = f.q;
          if (!S.qshot && f.answers) { S.qshot = 1; await shot(p.page, 'k20-question-' + p.tag, true); const L = await p.page.evaluate(LOOK); ok(L.tiles >= 2 && L.inside && L.wide, p.name + ' question window: the tiles fit: ' + JSON.stringify(L)); }
          await sleep(650);
          const ri = f.answers ? f.answers.indexOf(RIGHT[f.q]) : -1;
          await p.page.evaluate((i) => window.DormilonPhone.answer(i), ri >= 0 && Math.random() < 0.8 ? ri : 0);
          if (!S.feather) { S.feather = 1; await sleep(260); await shot(p.page, 'k21-feather-flies-' + p.tag); }
        }
        continue;
      }
      if (ph === 'pwin' && !S.pwin) { S.pwin = 1; await shot(p.page, 'k11-tickle-time-' + p.tag, true); }
      if (ph === 'pw') {
        if (f.raging && f.awake && !S.wake) {
          S.wake = 1;
          await shot(p.page, 'k31-wake-' + p.tag, true);
          const A = await p.page.evaluate(() => {
            document.getAnimations().forEach((a) => { try { const d = a.effect && a.effect.getComputedTiming ? Number(a.effect.getComputedTiming().duration) || 0 : 0; a.pause(); a.currentTime = Math.max(0, Math.min(1790, (d || 1790) - 1)); } catch (_) {} });
            const st = window.DormilonPhone && window.DormilonPhone.stage();
            return st && st.angryPoints ? st.angryPoints(1.07) : null;
          }).catch(() => null);
          try { await p.page.screenshot({ path: path.join(OUT, 'k31b-wake-peak-' + p.tag + '.png'), timeout: 15000 }); shots.push('k31b-wake-peak-' + p.tag); } catch (_) {}
          await p.page.evaluate(() => document.getAnimations().forEach((a) => { try { a.play(); } catch (_) {} })).catch(() => {});
          const inside = (pt) => A && pt[0] >= 8 && pt[0] <= A.W - 8 && pt[1] >= 8 && pt[1] <= A.H - 8;
          ok(A && ['eyeL', 'eyeR', 'mustache', 'mouth'].every((k) => inside(A[k])), p.name + ' wake-up: his angry face inside the view at the peak ' + JSON.stringify(A));
          if (!H.wake) { H.wake = 1; await shot(host, 'p06-projector-wake', true); }
          continue;
        }
        if (f.awake) continue;
        if (f.safe) {
          if (!S.safe && f.score >= 0 && S.rubbed) { S.safe = 1; await sleep(300); await shot(p.page, 'k14-my-tower-safe-' + p.tag, true); const L = await p.page.evaluate(LOOK); ok(L.hudIn && !L.clash && L.wide, p.name + ' safe: the HUD fits: ' + JSON.stringify(L)); }
          continue;
        }
        if (f.feathers > 0 && !S.busy) {
          // Ana films her second play window (the first is the guided one)
          if (p === phones[0] && S.windows === 1 && !S.rec) { S.rec = 1; S.busy = 1; S.rubbed = 1; await recordWindow(p); S.busy = 0; continue; }
          S.busy = 1;
          S.windows = (S.windows || 0) + (S.lastWin !== f.round.n ? 1 : 0);
          S.lastWin = f.round.n;
          if (!S.guided && S.windows === 1) { S.guided = 1; await sleep(250); await shot(p.page, 'k10-guided-' + p.tag, true); const L = await p.page.evaluate(LOOK); ok(L.hudIn && !L.clash && L.wide, p.name + ' play window: the count, my tower, my feathers and «¡Me retiro!» fit: ' + JSON.stringify(L)); }
          const n = 1 + Math.floor(Math.random() * Math.min(3, f.feathers));
          p.page.evaluate((k) => window.DormilonPhone.rub(k, 760), n).catch(() => {}).then(async () => {
            S.rubbed = 1;
            if (!S.rubShot) { S.rubShot = 1; await shot(p.page, 'k12-rubbing-tower-' + p.tag); }
            const f3 = await frame(p.page);
            if (f3 && f3.pile > 0 && !f3.safe && Math.random() < 0.6) await p.page.evaluate(() => window.DormilonPhone.stop()).catch(() => {});
            S.busy = 0;
          });
        }
        if (f.cue >= 2 && f.cue < 4 && !S.danger) { S.danger = 1; await shot(p.page, 'k30-danger-cue' + f.cue + '-' + p.tag, true); }
      }
      if (ph === 'pwout' && !S.tally && !f.raging) { S.tally = 1; await sleep(500); await shot(p.page, 'k33-tally-' + p.tag, true); }
      if (f.frenzy && !S.frenzy) { S.frenzy = 1; await shot(p.page, 'k40-final-round-' + p.tag, true); if (!H.frenzy) { H.frenzy = 1; await shot(host, 'p08-projector-final-round', true); } }
    }
    await sleep(150);
  }
  await sleep(600);
  await shot(host, 'p09-projector-final');
  await shot(phones[0].page, 'k50-final-' + phones[0].tag);
  await sleep(2600);
  for (const p of allPhones.slice(0, 3)) await shot(p.page, 'k51-ceremony-start-' + p.tag);
  // the towers' reveal (whatever stars came first): photographed when it shows
  for (let i = 0; i < 40; i++) {
    const has = await phones[0].page.evaluate(() => !!document.querySelector('.dm-towers')).catch(() => false);
    if (has) { await sleep(2400); await shot(phones[0].page, 'k52-towers-reveal-' + phones[0].tag); await shot(phones[1].page, 'k52-towers-reveal-' + phones[1].tag); break; }
    await sleep(500);
  }
  await shot(host, 'p10-projector-end');
  await host.setViewportSize({ width: 1366, height: 657 });
  await sleep(600);
  await shot(host, 'p11-projector-end-1366x657');
  await sleep(6000);
  for (const p of allPhones) {
    // (a board with more bonus stars has a longer ceremony: wait for its card, up to 20 s)
    for (let i = 0; i < 40; i++) { if (await p.page.evaluate(() => !!document.querySelector('.dm-mycard')).catch(() => false)) break; await sleep(500); }
    await shot(p.page, 'k53-my-card-' + p.tag);
    const c = await p.page.evaluate(() => { const c = document.querySelector('.dm-mycard'); if (!c) return null; const r = c.getBoundingClientRect(); return { h: r.height, top: r.top, home: !!c.querySelector('.dm-home') }; });
    ok(c && c.home, p.name + ' got its card with «Inicio»: ' + JSON.stringify(c));
  }
  for (const p of allPhones) ok(p.seen.pwin && (p.seen.rubbed || p.seen.safe), p.name + ' played a play window: ' + JSON.stringify(p.seen));
  await finish();
})().catch((e) => { console.log('FAIL · ' + e.message); finish(1); });
