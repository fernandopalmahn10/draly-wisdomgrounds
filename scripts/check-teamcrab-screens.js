// Draly Cangrejo · ¡Atrapa a Fénec! v2 · every screen in a real browser (headless Chrome through playwright-core) against a
// RUNNING local server (never the live site):
//   node scripts/check-teamcrab-screens.js --url http://localhost:4512 --password <the local teacher code> [--out <folder>]
// The projector (1600×900, the teacher types the code on the key screen) + four phones (390×844, 360×640, sideways
// 844×390, a laptop 1366×657) + socket bots that fill the crews and play like kids (half of their answers wrong, so El
// Péndulo eats), a phone that joins late. A whole short game (2 min, ~5 rounds) is played; each moment is photographed as
// it happens and its PEAK is measured: the question window (tiles + my hammer meter fit), «¡A martillar!» (my role card),
// the play window per role (the controls fit; the faces inside, no hovering hammer on them, Fénec inside), the bonk
// (Fénec and every face inside, nothing covering them: the card, the panel, the «¡BONK!» stamp, his bubble), El Péndulo
// eating my miss, the ending (Fénec inside the ceremony's stage). Ana's (390×844) play windows are filmed at 4 fps until
// one has a bonk (`play-4fps/`, for the side-by-side with the video's 7:39-7:43), and her ending at 4 fps (`end-4fps/`).
// Gentle with the laptop: one browser, low priority, every step under a timeout, closed at the end.
// v3: `--mode vs` = «1 contra 3» (the teacher clicks «🦊 1 contra 3» in the lobby): the bots run like a kid who watches
// the shadows (and report where they were when each hammer landed on their screen) or martillan at the runner; the
// phones play every role (the runner moves away from falling shadows); Ana's runner view is filmed at 4 fps
// (`run-4fps/`, the video's camera: 7:39-7:43) and her runner PEAK measured (Fénec from behind inside, no face covered).
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const arg = (n, d) => (args.indexOf('--' + n) >= 0 && args[args.indexOf('--' + n) + 1]) || d;
const URL = arg('url', 'http://localhost:4512');
const PASSWORD = arg('password', process.env.TEST_TEACHER_PW || '');
const OUT = arg('out', path.join(__dirname, '..', '..', '..', 'teamcrab-shots', 'run'));
const BOTS = +arg('bots', 4);
const ACC = +arg('acc', 0.5);
const MODE = arg('mode', 'crew');
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
try { require('../core/packs').forGames(require('../core/packs').loadPack('yct1-familia-r1').questions || []).forEach((q) => { RIGHT[q.text] = String(q.correct); }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0, bad = 0;
const ok = (c, m) => { checks++; if (!c) { bad++; console.log('FAIL ' + m); } };
const shots = [];
const watchdog = setTimeout(() => { console.log('FAIL · timed out'); finish(1); }, 520000);
const sockets = [];
let browser = null;

// ---------- the socket bots (kids of the crews: they answer, and in «¡A martillar!» they steer / slam like kids) ----------
function bot(pin, name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  let me = null, role = 'none', charges = 0, armed = false, crab = 2, phase = '', f = { mode: 'idle', x: 2, x1: 2 }, next = 0;
  let runner = null, rx = 2, goal = 2, shadows = [], dashes = 0;   // («1 contra 3»)
  s.on('tc:init', (d) => { if (d.you) me = d.you.k; if (d.board) { crab = d.board.crab; if (d.board.fen) f = d.board.fen; } });
  s.on('tc:round', (d) => { phase = d.phase; if (d.phase === 'qw') role = 'none'; });
  s.on('tc:roles', (d) => { const m = (d.mart || []).find((x) => x.k === me); runner = d.runner != null ? d.runner : null; role = runner === me ? 'runner' : d.captain === me ? 'cap' : m ? 'mart' : 'watch'; charges = m ? m.charges : 0; armed = !!m; crab = d.crab; if (d.rx != null) rx = goal = d.rx; dashes = role === 'runner' ? d.dashes || 0 : 0; shadows = []; });
  s.on('tc:runner', (d) => { if (role !== 'runner') rx = d.x; });
  s.on('tc:crab', (d) => { crab = d.x; });
  s.on('tc:fen', (d) => { f = d; });
  s.on('tc:claw', (d) => { if (d.k === me) { armed = d.st === 'armed'; charges = d.charges; } });
  s.on('tc:slam', (d) => {
    if (d.k === me) { armed = false; charges = d.charges; }
    if (role === 'runner' && d.sid) { const sh = { x: d.x, seen: Date.now(), land: Date.now() + d.ms }; shadows.push(sh); setTimeout(() => { s.emit('player:tc-land', { pin, sid: d.sid, x: rx }); shadows = shadows.filter((q) => q !== sh); }, d.ms); }
  });
  // the runner bot: it notices a shadow after 0.3-0.5 s and runs out of it (a dash when it can't make it), else wanders
  const rt = setInterval(() => {
    if (!s.connected) { clearInterval(rt); return; }
    if (phase !== 'pw' || role !== 'runner') return;
    const now = Date.now();
    const live = shadows.filter((q) => now - q.seen > 300 + Math.random() * 200 && Math.abs(q.x - rx) < 0.62);
    if (live.length) {
      const lo = Math.min(...live.map((q) => q.x)) - 0.6, hi = Math.max(...live.map((q) => q.x)) + 0.6;
      goal = lo >= 0 && (rx - lo < hi - rx || hi > 4) ? lo : Math.min(4, hi);
      if (dashes > 0 && Math.abs(goal - rx) > 0.9) { dashes--; const dir = goal < rx ? -1 : 1; s.emit('player:tc-dash', { pin, dir }); rx = Math.max(0, Math.min(4, rx + dir * 1.2)); }
    } else if (Math.abs(goal - rx) < 0.05 && Math.random() < 0.08) goal = 0.4 + Math.random() * 3.2;
    const st = 1.5 * 0.07;
    rx = Math.abs(goal - rx) <= st ? goal : rx + Math.sign(goal - rx) * st;
    s.emit('player:tc-run', { pin, x: Math.round(rx * 1000) / 1000 });
  }, 70);
  s.on('tc:q', (q) => {
    s.emit('player:tc-seen', { pin, qid: q.qid });
    setTimeout(() => { const r = q.answers.indexOf(RIGHT[q.text]); s.emit('player:tc-answer', { pin, qid: q.qid, idx: Math.random() < ACC && r >= 0 ? r : (Math.max(0, r) + 1) % q.answers.length }); }, 1300 + Math.random() * 1700);
  });
  const t = setInterval(() => {
    if (!s.connected) { clearInterval(t); return; }
    if (phase !== 'pw') return;
    if (role === 'runner') return;
    const at = runner != null ? rx : f.mode === 'run' || f.mode === 'crouch' ? f.x1 : f.x;
    if (role === 'cap') s.emit('player:tc-steer', { pin, x: at });
    if (armed && charges > 0 && Date.now() > next && (runner != null || f.mode === 'idle') && Math.abs(at - crab) < 1.1) { next = Date.now() + 1100; s.emit('player:tc-slam', { pin, x: at + (Math.random() - 0.5) * 0.6 }); }
  }, 300);
  s.on('tc:bonk', () => { if (Math.random() < 0.2) s.emit('player:tc-react', { pin, e: ['wow', 'lol', 'clap', 'fire'][Math.floor(Math.random() * 4)] }); });
  return new Promise((res) => s.emit('player:join', { pin, name, avatar: '' }, res));
}

// ---------- pages ----------
async function shot(page, name, freeze) {
  try {
    if (freeze) await page.evaluate(() => { if (window.CrabStage) window.CrabStage.freeze(true); });
    await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 15000 });
    shots.push(name);
    if (freeze) await page.evaluate(() => { if (window.CrabStage) window.CrabStage.freeze(false); });
  } catch (e) { console.log('shot failed', name, e.message); }
}
const frame = (page) => page.evaluate(() => (window.CrabPhone ? window.CrabPhone.frame() : null)).catch(() => null);
const LOOK = () => {
  const vis = [...document.querySelectorAll('[id^=screen-]')].filter((e) => !e.classList.contains('hidden')).map((e) => e.id);
  const st = document.querySelector('#tc-stage .tcs');
  const r = st ? st.getBoundingClientRect() : null;
  const tiles = [...document.querySelectorAll('#tc-tiles .tc-tile')].map((b) => b.getBoundingClientRect());
  const inside = tiles.every((t) => t.top >= 0 && t.bottom <= innerHeight + 1 && t.left >= 0 && t.right <= innerWidth + 1 && t.height >= 44);
  const g = document.getElementById('tc-golpe').getBoundingClientRect();
  const golpeIn = g.height === 0 || (g.top >= 0 && g.bottom <= innerHeight + 1 && g.height >= 44);
  const m = document.getElementById('tc-meter').getBoundingClientRect();
  const meterIn = m.height === 0 || (m.top >= 0 && m.bottom <= innerHeight + 1);
  const wide = document.documentElement.scrollWidth <= innerWidth + 1;
  return { vis, stage: r ? [Math.round(r.width), Math.round(r.height)] : null, tiles: tiles.length, inside, golpeIn, meterIn, wide };
};
// the PEAK of a big moment: are Fénec and every face of the crew inside the screen, with nothing covering them? (and no
// hovering hammer over a face)
const PEAK = (sel) => {
  const root = document.querySelector(sel || '#tc-stage');
  const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && Number(getComputedStyle(e).opacity) > 0.05;
  const fenEl = root && root.querySelector('.tcs-fen .tcs-fimg');
  const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const fen = fenEl && vis(fenEl) ? box(fenEl) : null;
  const domes = root ? [...root.querySelectorAll('.tcs-dome')].map(box) : [];
  const covers = [];
  ['#tc-big', '.tc-panel', '.tcs-stamp', '.tcs-bubble', '.tc-plus.on', '#mute-btn', '.tcs-runtag'].forEach((q) => document.querySelectorAll(q).forEach((e) => { if (vis(e) && !e.classList.contains('hidden')) covers.push({ q, b: box(e) }); }));
  const hams = root ? [...root.querySelectorAll('.tcs-ham.st-armed:not(.rising) .tcs-himg')].filter(vis).map((e) => ({ q: '.tcs-ham', b: box(e) })) : [];
  const inside = (b) => b && b.l >= -2 && b.t >= -2 && b.r <= innerWidth + 2 && b.b <= innerHeight + 2;
  const ov = (a, c) => Math.max(0, Math.min(a.r, c.r) - Math.max(a.l, c.l)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.t, c.t));
  const worst = (a, list) => Math.max(0, ...(list || covers).map((c) => ov(a, c.b) / Math.max(1, a.w * a.h)));
  const by = (a) => covers.filter((c) => ov(a, c.b) / Math.max(1, a.w * a.h) > 0.12).map((c) => c.q);
  return {
    fenIn: inside(fen), fenCovered: fen ? Math.round(worst(fen) * 100) : 100, fenBy: fen ? by(fen) : [],
    facesIn: domes.length > 0 && domes.every(inside), facesCovered: Math.round(Math.max(0, ...domes.map((d) => worst(d))) * 100), facesBy: [...new Set(domes.flatMap(by))],
    hamOnFaces: Math.round(Math.max(0, ...domes.map((d) => worst(d, hams))) * 100),
    fen: fen && [Math.round(fen.l), Math.round(fen.t), Math.round(fen.w), Math.round(fen.h)], n: domes.length,
  };
};
// hold every animation at `ms` (the peak of a moment), then let it run on
const HOLD = (ms) => { document.getAnimations().forEach((a) => { try { a.pause(); a.currentTime = ms; } catch (_) {} }); };
const RUN = () => { document.getAnimations().forEach((a) => { try { a.play(); } catch (_) {} }); };
// a kid's finger in the play window: the Capitán drives under Fénec, a martillero taps him when he stands still in reach
const PLAY = () => {
  const P = window.CrabPhone, f = P.frame(), s = P.stage();
  if (f.window !== 'pw' || !s) return f;
  f.fall = s.crew.some((c) => c.st === 'fall');
  if (f.role === 'runner') {
    const me = s.myX(), live = s.crew.filter((c) => c.st === 'fall' && Math.abs(c.fallX - me) < 0.62);
    if (live.length) { const lo = Math.min(...live.map((c) => c.fallX)) - 0.6, hi = Math.max(...live.map((c) => c.fallX)) + 0.6; P.runTo(lo >= 0 && (me - lo < hi - me || hi > 4) ? lo : Math.min(4, hi)); }
    else if (!window.__wander || Date.now() - window.__wander > 1400) { window.__wander = Date.now(); P.runTo(Math.max(0.3, Math.min(3.7, me + (Math.random() - 0.5) * 1.6))); }
    return f;
  }
  const at = s.f.mode === 'run' || s.f.mode === 'crouch' ? s.f.x1 : s.fx;
  if (f.role === 'cap') P.steerTo(at);
  if ((f.role === 'mart' || f.role === 'cap') && f.charges > 0 && f.claw === 'armed' && s.f.mode === 'idle' && Math.abs(s.fx - s.crabX) < 1.05 && (!window.__tapAt || Date.now() - window.__tapAt > 900)) { window.__tapAt = Date.now(); P.tapFenec(); }
  return f;
};

async function finish(code) {
  clearTimeout(watchdog);
  sockets.forEach((s) => { try { s.disconnect(); } catch (_) {} });
  try { if (browser) await browser.close(); } catch (_) {}
  console.log(`check-teamcrab-screens: ${checks - bad}/${checks} checks OK · ${shots.length} shots in ${OUT}`);
  process.exit(code != null ? code : bad ? 1 : 0);
}

(async () => {
  browser = await PW.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  const hctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const host = await hctx.newPage();
  host.on('pageerror', (e) => { bad++; console.log('FAIL projector error: ' + e.message); });
  await host.goto(`${URL}/host-teamcrab.html?setId=${encodeURIComponent(SET)}`, { timeout: 45000, waitUntil: 'domcontentloaded' });
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
  await host.setViewportSize({ width: 1366, height: 657 });
  await sleep(500);
  await shot(host, 'p02-projector-lobby-1366x657');
  const lb = await host.evaluate(() => { const b = document.getElementById('start-btn').getBoundingClientRect(); const r = document.getElementById('robots-btn').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, rb: r.bottom, h: innerHeight }; });
  ok(lb.bottom <= lb.h && lb.rb <= lb.h, 'the projector lobby at 1366×657: «¡Empezar!» and «🤖 Probar con robots» on the first screen ' + JSON.stringify(lb));
  await host.setViewportSize({ width: 1600, height: 900 });
  await shot(phones[0].page, 'k01-phone-lobby-390x844');
  await shot(phones[1].page, 'k02-phone-lobby-360x640');
  if (MODE === 'vs') { await host.click('.tch-mode button[data-mode=vs]'); await sleep(900); await shot(host, 'p02b-projector-lobby-vs-1600x900'); await shot(phones[0].page, 'k01b-phone-lobby-vs-390x844'); const pl = await phones[0].page.evaluate(() => { const b = document.getElementById('tc-how'); return b ? { vs: b.classList.contains('vs'), text: b.textContent.slice(0, 200) } : null; }); ok(pl && pl.vs && /1 contra 3/.test(pl.text), 'the phones\' lobby shows the steps of «1 contra 3» ' + JSON.stringify(pl)); }
  await host.click('#start-btn');
  await sleep(1800);
  await shot(host, 'p03-projector-countdown', true);
  await sleep(3200);
  for (const p of phones) { const f = await frame(p.page); ok(f && f.on && f.board, p.name + ' is in a crew: ' + JSON.stringify(f && f.seats)); }
  await shot(host, 'p04-projector-intro');
  // a late joiner
  const lctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const late = await lctx.newPage();
  late.on('pageerror', (e) => { bad++; console.log('FAIL late page error: ' + e.message); });
  await late.goto(`${URL}/player.html?pin=${pin}&name=Eli&autojoin=1`, { timeout: 45000, waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const lf = await frame(late);
  ok(lf && lf.on && lf.board, 'a late joiner sits in a crew: ' + JSON.stringify(lf));
  const ll = await late.evaluate(LOOK);
  ok(ll.vis.includes('screen-teamcrab') && ll.stage && ll.stage[1] > 100, 'the late joiner sees the game: ' + JSON.stringify(ll));
  await shot(late, 'k03-late-joiner-390x844');

  const t0 = Date.now();
  let hostBonk = false, hostFrenzy = false, hostQw = false, hostPw = false;
  const allPhones = phones.concat([{ name: 'Eli', page: late, tag: 'eli-390x844', seen: {} }]);
  const REC = path.join(OUT, 'play-4fps');
  fs.mkdirSync(REC, { recursive: true });
  let recDone = false, recTry = 0;
  // Ana's play window at 4 fps (a frame every 250 ms for 5 s from «¡A martillar!»), kept when her crew bonked in it
  const RUNREC = path.join(OUT, 'run-4fps');
  let runDone = false, runTry = 0;
  // «1 contra 3»: Ana's runner view (the video's camera) at 4 fps, kept when hammers fell on her screen
  async function recordRun(p) {
    runTry++;
    const tmp = path.join(RUNREC, 'try' + runTry);
    fs.mkdirSync(tmp, { recursive: true });
    let falls = 0, peak = null;
    for (let i = 0; i < 20; i++) {
      const t = Date.now();
      const f2 = await p.page.evaluate(PLAY).catch(() => null);
      if (f2 && f2.fall) falls++;
      await Promise.all(allPhones.filter((q) => q !== p).map((q) => q.page.evaluate(PLAY).catch(() => null)));   // (her crewmates' phones keep playing while she is filmed)
      try { await p.page.screenshot({ path: path.join(tmp, 'f' + String(i).padStart(2, '0') + '.png'), timeout: 8000 }); } catch (_) { /* next */ }
      if (f2 && f2.fall && !peak) peak = await p.page.evaluate(PEAK).catch(() => null);
      await sleep(Math.max(0, 250 - (Date.now() - t)));
    }
    fs.writeFileSync(path.join(tmp, 'falls.txt'), String(falls));
    if (peak) ok(peak.fenIn && peak.facesIn && peak.facesCovered <= 12 && peak.hamOnFaces <= 15, p.name + ' runner view with a hammer falling: Fénec (from behind) and the faces inside, nothing on them ' + JSON.stringify(peak));
    if (falls >= 2) { runDone = true; fs.writeFileSync(path.join(RUNREC, 'RUN.txt'), 'try' + runTry + ' falls ' + falls); shots.push('run-4fps/try' + runTry); }
  }
  async function recordPlay(p) {
    recTry++;
    const tmp = path.join(REC, 'try' + recTry);
    fs.mkdirSync(tmp, { recursive: true });
    let bonk = false, roleSeen = '';
    for (let i = 0; i < 20; i++) {
      const t = Date.now();
      const f2 = await p.page.evaluate(PLAY).catch(() => null);
      if (f2) { roleSeen = f2.role; if (f2.moment === 'bonk') bonk = true; }
      try { await p.page.screenshot({ path: path.join(tmp, 'f' + String(i).padStart(2, '0') + '.png'), timeout: 8000 }); } catch (_) { /* next */ }
      await sleep(Math.max(0, 250 - (Date.now() - t)));
    }
    fs.writeFileSync(path.join(tmp, 'role.txt'), roleSeen + (bonk ? ' BONK' : ''));
    if (bonk && roleSeen !== 'watch') { recDone = true; fs.writeFileSync(path.join(REC, 'BONK.txt'), 'try' + recTry + ' ' + roleSeen); shots.push('play-4fps/try' + recTry); }
    return bonk;
  }
  while (Date.now() - t0 < 150000) {
    const hf = await host.evaluate(() => window.CrabHost && window.CrabHost.frame()).catch(() => null);
    if (hf && hf.phase === 'final') break;
    if (hf && hf.window === 'qw' && !hostQw && hf.round >= 1) { hostQw = true; await sleep(1500); await shot(host, 'p05-projector-questions', true); }
    if (hf && hf.window === 'pw' && !hostPw) { hostPw = true; await sleep(1500); await shot(host, 'p06-projector-play'); }
    for (const p of allPhones) {
      const f = await p.page.evaluate(() => (window.CrabPhone && window.CrabPhone.frame().window === 'pw' ? null : window.CrabPhone && window.CrabPhone.frame())).catch(() => null) || await p.page.evaluate(PLAY).catch(() => null);
      if (!f || !f.on) continue;
      const S = p.seen;
      // a bonk on my crew: its peak (the stamp landed, the words in the air)
      if (f.moment === 'bonk' && !S.bonk) {
        S.bonk = 1;
        await sleep(200);
        await p.page.evaluate(HOLD, 330).catch(() => {});
        await shot(p.page, 'k31-bonk-peak-' + p.tag);
        const P = await p.page.evaluate(PEAK).catch(() => null);
        await p.page.evaluate(RUN).catch(() => {});
        ok(P && P.fenIn && P.fenCovered <= 25 && P.facesIn && P.facesCovered <= 12 && P.hamOnFaces <= 15, p.name + ' bonk peak: Fénec and the crew\'s faces inside, nothing covering them ' + JSON.stringify(P));
        if (!hostBonk) { hostBonk = true; await host.evaluate(HOLD, 330).catch(() => {}); await shot(host, 'p07-projector-bonk'); await host.evaluate(RUN).catch(() => {}); }
        continue;
      }
      // my miss: the hammer flies into El Péndulo («¡Ñam!»)
      if (f.moment === 'eat' && !S.eat) {
        S.eat = 1;
        await sleep(350);
        await p.page.evaluate(HOLD, 380).catch(() => {});
        await shot(p.page, 'k22-eat-' + p.tag);
        const P = await p.page.evaluate(PEAK).catch(() => null);
        await p.page.evaluate(RUN).catch(() => {});
        ok(P && P.facesIn && P.facesCovered <= 12, p.name + ' El Péndulo eats: the crew\'s faces inside, nothing on them ' + JSON.stringify(P));
        continue;
      }
      if (f.window === 'pwin' && !S['pwin' + f.role]) {
        S['pwin' + f.role] = 1;
        await sleep(250);
        await shot(p.page, 'k20-role-' + f.role + '-' + p.tag, true);
      }
      if (f.window === 'pw') {
        if (MODE === 'vs' && p === phones[0] && f.role === 'runner' && !runDone && runTry < 3 && !S['run' + f.round]) { S['run' + f.round] = 1; await recordRun(p); continue; }
        if (p === phones[0] && !recDone && recTry < 5 && f.role !== 'watch' && f.role !== 'runner' && !S['rec' + f.round]) { S['rec' + f.round] = 1; await recordPlay(p); continue; }
        if (!S['pw' + f.role]) {
          S['pw' + f.role] = 1;
          await sleep(400);
          await shot(p.page, 'k21-play-' + f.role + '-' + p.tag, true);
          const L = await p.page.evaluate(LOOK);
          const P = await p.page.evaluate(PEAK).catch(() => null);
          ok(L.golpeIn && L.wide && (f.role === 'watch' || L.meterIn), p.name + ' play window (' + f.role + '): the controls fit ' + JSON.stringify(L));
          ok(P && P.facesIn && P.hamOnFaces <= 15 && P.fenIn, p.name + ' play window: the faces inside, no hovering hammer on them, Fénec inside ' + JSON.stringify(P));
        }
        continue;
      }
      if (f.window === 'qw' && f.q) {
        if (!S.quiz) { S.quiz = 1; await shot(p.page, 'k11-quiz-' + p.tag, true); const L = await p.page.evaluate(LOOK); ok(L.tiles >= 2 && L.inside && L.wide && L.meterIn, p.name + ' quiz tiles + hammer meter fit: ' + JSON.stringify(L)); }
        if (S.lastQ !== f.q) {
          S.lastQ = f.q;
          await sleep(500);
          const want = RIGHT[f.q];
          const i = f.answers ? f.answers.indexOf(want) : 0;
          await p.page.evaluate((x) => window.CrabPhone.answer(x), Math.random() < 0.82 && i >= 0 ? i : (Math.max(0, i) + 1) % 4);
        }
      }
      if (f.window === 'pwout' && !S.pwout) { S.pwout = 1; await shot(p.page, 'k23-tiempo-' + p.tag, true); }
      if (f.frenzy && !S.frenzy) { S.frenzy = 1; await shot(p.page, 'k40-final-round-' + p.tag, true); if (!hostFrenzy) { hostFrenzy = true; await shot(host, 'p08-projector-final-round', true); } }
    }
    await sleep(120);
  }
  // «¡FINAL!» and the endings
  await sleep(500);
  await shot(host, 'p09-projector-final');
  await shot(phones[0].page, 'k50-final-' + phones[0].tag);
  // Ana's ending at 4 fps (from the game-end, ~6 s), for the side-by-side with the video's 8:09-8:13
  const ER = path.join(OUT, 'end-4fps');
  fs.mkdirSync(ER, { recursive: true });
  await phones[0].page.waitForSelector('#tc-cer', { timeout: 8000 }).catch(() => {});
  for (let i = 0; i < 22; i++) {
    const t = Date.now();
    try { await phones[0].page.screenshot({ path: path.join(ER, 'f' + String(i).padStart(2, '0') + '.png'), timeout: 8000 }); } catch (_) { /* next */ }
    await sleep(Math.max(0, 250 - (Date.now() - t)));
  }
  shots.push('end-4fps');
  for (const p of allPhones.slice(1, 4)) await shot(p.page, 'k51-ending-' + p.tag);
  for (const p of allPhones.slice(0, 4)) {
    const P = await p.page.evaluate(PEAK, '.tc-cer-stage').catch(() => null);
    ok(P && P.fenIn, p.name + ' ending: Fénec inside the ceremony\'s stage ' + JSON.stringify(P));
  }
  await shot(host, 'p10-projector-end');
  await host.setViewportSize({ width: 1366, height: 657 });
  await sleep(600);
  await shot(host, 'p11-projector-end-1366x657');
  await sleep(15500);   // (the ending, up to 4 bonus stars, the drum, the winner, then the card)
  for (const p of allPhones) {
    await shot(p.page, 'k53-my-card-' + p.tag);
    const c = await p.page.evaluate(() => { const c = document.querySelector('.tc-mycard'); if (!c) return null; const r = c.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top), home: !!c.querySelector('.tc-home') }; });
    ok(c && c.home && c.top >= -2, p.name + ' got its card with «Inicio», its top (the character) on the screen: ' + JSON.stringify(c));
  }
  if (MODE === 'vs') ok(runDone, 'Ana\'s runner view with hammers falling was filmed at 4 fps (' + runTry + ' tries)');
  else ok(recDone, 'Ana\'s play window with a bonk was filmed at 4 fps (' + recTry + ' tries)');
  await finish();
})().catch((e) => { console.log('FAIL · ' + e.message); finish(1); });
