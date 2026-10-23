// ¡Atrapa a Fénec! · every screen in a real browser (headless Chrome through playwright-core) against a RUNNING local
// server (never the live site):
//   node scripts/check-teamcrab-screens.js --url http://localhost:4512 --password <the local teacher code> [--out <folder>]
// The projector (1600×900, the teacher types the code on the key screen) + four phones (390×844, 360×640, sideways
// 844×390, a laptop 1366×657) + socket bots that fill the crews and play like kids (half of their answers wrong, so El
// Péndulo fills up and swings), a phone that joins late. A whole short game (2 min) is played; each moment is
// photographed as it happens and its PEAK is measured: the bonk (Fénec and every face of the crew inside the screen,
// nothing covering them: the bonker's card, the panel, the «¡BONK!» stamp, his bubble), El Péndulo's big swing (the
// faces inside, the card off them), the ending (Fénec and the crab inside the ceremony's stage). Ana's (390×844) slams
// are filmed at 4 fps until one is a bonk (frames for the side-by-side with the video, `slam-4fps/`), and her ending at
// 4 fps (`end-4fps/`). Gentle with the laptop: one browser, low priority, every step under a timeout, closed at the end.
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

// ---------- the socket bots (kids of the crews) ----------
function bot(pin, name) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  let me = null, fx = 2;
  s.on('tc:init', (d) => { if (d.you) me = d.you.k; if (d.board) fx = d.board.fx; });
  s.on('tc:hop', (d) => { fx = d.to; });
  s.on('tc:up', (d) => { fx = d.to; });
  s.on('tc:q', (q) => {
    s.emit('player:tc-seen', { pin, qid: q.qid });
    setTimeout(() => { const r = q.answers.indexOf(RIGHT[q.text]); s.emit('player:tc-answer', { pin, qid: q.qid, idx: Math.random() < ACC && r >= 0 ? r : (Math.max(0, r) + 1) % q.answers.length }); }, 1100 + Math.random() * 1500);
  });
  s.on('tc:ham', (d) => {
    if (d.k !== me || d.st !== 'loaded') return;
    let n = 0;
    const t = setInterval(() => { s.emit('player:tc-aim', { pin, x: fx / 4 }); if (++n > 5 + Math.random() * 6) { clearInterval(t); s.emit('player:tc-slam', { pin, x: fx / 4 }); } }, 130);
  });
  s.on('tc:noslam', (d) => { if (d.why === 'wait') setTimeout(() => s.emit('player:tc-slam', { pin, x: fx / 4 }), 600); });
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
  const wide = document.documentElement.scrollWidth <= innerWidth + 1;
  return { vis, stage: r ? [Math.round(r.width), Math.round(r.height)] : null, tiles: tiles.length, inside, golpeIn, wide };
};
// the PEAK of a big moment: are Fénec and every face of the crew inside the screen, with nothing covering them?
const PEAK = (sel) => {
  const root = document.querySelector(sel || '#tc-stage');
  const vis = (e) => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && Number(getComputedStyle(e).opacity) > 0.05;
  const fenEl = root && root.querySelector('.tcs-fen .tcs-fimg');
  const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const fen = fenEl && vis(fenEl) ? box(fenEl) : null;
  const domes = root ? [...root.querySelectorAll('.tcs-dome')].map(box) : [];
  const covers = [];
  ['#tc-big', '.tc-panel', '.tcs-stamp', '.tcs-bubble', '.tc-plus.on', '#mute-btn'].forEach((q) => document.querySelectorAll(q).forEach((e) => { if (vis(e) && !e.classList.contains('hidden')) covers.push({ q, b: box(e) }); }));
  const inside = (b) => b && b.l >= -2 && b.t >= -2 && b.r <= innerWidth + 2 && b.b <= innerHeight + 2;
  const ov = (a, c) => Math.max(0, Math.min(a.r, c.r) - Math.max(a.l, c.l)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.t, c.t));
  const worst = (a) => Math.max(0, ...covers.map((c) => ov(a, c.b) / Math.max(1, a.w * a.h)));
  const by = (a) => covers.filter((c) => ov(a, c.b) / Math.max(1, a.w * a.h) > 0.12).map((c) => c.q);
  return {
    fenIn: inside(fen), fenCovered: fen ? Math.round(worst(fen) * 100) : 100, fenBy: fen ? by(fen) : [],
    facesIn: domes.length > 0 && domes.every(inside), facesCovered: Math.round(Math.max(0, ...domes.map(worst)) * 100), facesBy: [...new Set(domes.flatMap(by))],
    fen: fen && [Math.round(fen.l), Math.round(fen.t), Math.round(fen.w), Math.round(fen.h)], n: domes.length,
  };
};
// hold every animation at `ms` (the peak of a moment), then let it run on
const HOLD = (ms) => { document.getAnimations().forEach((a) => { try { a.pause(); a.currentTime = ms; } catch (_) {} }); };
const RUN = () => { document.getAnimations().forEach((a) => { try { a.play(); } catch (_) {} }); };

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
  const lb = await host.evaluate(() => { const b = document.getElementById('start-btn').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight }; });
  ok(lb.bottom <= lb.h, 'the projector lobby at 1366×657: «¡Empezar!» on the first screen ' + JSON.stringify(lb));
  await host.setViewportSize({ width: 1600, height: 900 });
  await shot(phones[0].page, 'k01-phone-lobby-390x844');
  await shot(phones[1].page, 'k02-phone-lobby-360x640');
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
  let hostBonk = false, hostSwing = false, hostFrenzy = false, hostMid = false;
  const allPhones = phones.concat([{ name: 'Eli', page: late, tag: 'eli-390x844', seen: {} }]);
  const REC = path.join(OUT, 'slam-4fps');
  fs.mkdirSync(REC, { recursive: true });
  let recDone = false, recTry = 0;
  // Ana's slam at 4 fps (a frame every 250 ms from the tap), kept when it was a bonk
  async function recordSlam(p) {
    recTry++;
    const tmp = path.join(REC, 'try' + recTry);
    fs.mkdirSync(tmp, { recursive: true });
    let bonk = false;
    await p.page.evaluate(() => window.CrabPhone.tapFenec());
    for (let i = 0; i < 14; i++) {
      const t = Date.now();
      try { await p.page.screenshot({ path: path.join(tmp, 'f' + String(i).padStart(2, '0') + '.png'), timeout: 8000 }); } catch (_) { /* next */ }
      const f2 = await frame(p.page);
      if (f2 && f2.moment === 'bonk') bonk = true;
      await sleep(Math.max(0, 250 - (Date.now() - t)));
    }
    if (bonk) { recDone = true; fs.writeFileSync(path.join(REC, 'BONK.txt'), 'try' + recTry); shots.push('slam-4fps/try' + recTry); }
    return bonk;
  }
  while (Date.now() - t0 < 140000) {
    const hf = await host.evaluate(() => window.CrabHost && window.CrabHost.frame()).catch(() => null);
    if (hf && hf.phase === 'final') break;
    for (const p of allPhones) {
      const f = await frame(p.page);
      if (!f || !f.on) continue;
      const S = p.seen;
      // a bonk on my crew: its peak (the stamp landed, the words in the air)
      if (f.moment === 'bonk' && !S.bonk) {
        S.bonk = 1;
        await sleep(250);
        await p.page.evaluate(HOLD, 330).catch(() => {});
        await shot(p.page, 'k31-bonk-peak-' + p.tag);
        const P = await p.page.evaluate(PEAK).catch(() => null);
        await p.page.evaluate(RUN).catch(() => {});
        ok(P && P.fenIn && P.fenCovered <= 25 && P.facesIn && P.facesCovered <= 12, p.name + ' bonk peak: Fénec and the crew\'s faces inside, nothing covering them ' + JSON.stringify(P));
        if (!hostBonk) { hostBonk = true; await host.evaluate(HOLD, 330).catch(() => {}); await shot(host, 'p06-projector-bonk'); await host.evaluate(RUN).catch(() => {}); }
        continue;
      }
      if (f.moment === 'swing' && !S.swing) {
        S.swing = 1;
        await sleep(300);
        await p.page.evaluate(HOLD, 600).catch(() => {});
        await shot(p.page, 'k32-swing-peak-' + p.tag);
        const P = await p.page.evaluate(PEAK).catch(() => null);
        await p.page.evaluate(RUN).catch(() => {});
        ok(P && P.facesIn && P.facesCovered <= 12, p.name + ' big swing peak: the crew\'s faces inside, the card off them ' + JSON.stringify(P));
        if (!hostSwing) { hostSwing = true; await shot(host, 'p07-projector-swing', true); }
        continue;
      }
      if (f.ham === 'jam' && !S.jam) { S.jam = 1; await shot(p.page, 'k22-jam-' + p.tag, true); }
      // my hammer is loaded: the pad (+ the guided hand the first time), then slam on Fénec
      if (f.ham === 'loaded' && !f.moment) {
        if (!S.pad) {
          S.pad = 1;
          await sleep(350);
          await shot(p.page, 'k12-loaded-guided-' + p.tag, true);
          const L = await p.page.evaluate(LOOK);
          ok(L.golpeIn && L.wide, p.name + ' my loaded hammer: «¡GOLPE!» fits ' + JSON.stringify(L));
        }
        if (p === phones[0] && !recDone && S.pad && recTry < 6) { await recordSlam(p); continue; }
        await p.page.evaluate(() => window.CrabPhone.tapFenec());
        if (!S.slam) { S.slam = 1; await sleep(220); await shot(p.page, 'k13-slam-' + p.tag); }
        continue;
      }
      if (f.q && f.ham === 'idle') {
        if (!S.quiz) { S.quiz = 1; await shot(p.page, 'k11-quiz-' + p.tag, true); const L = await p.page.evaluate(LOOK); ok(L.tiles >= 2 && L.inside && L.wide, p.name + ' quiz tiles fit: ' + JSON.stringify(L)); }
        if (S.lastQ !== f.q) {
          S.lastQ = f.q;
          await sleep(500);
          const want = RIGHT[f.q];
          const i = f.answers ? f.answers.indexOf(want) : 0;
          await p.page.evaluate((x) => window.CrabPhone.answer(x), Math.random() < 0.88 && i >= 0 ? i : (Math.max(0, i) + 1) % 4);
        }
      }
      if (f.frenzy && !S.frenzy) { S.frenzy = 1; await shot(p.page, 'k40-last30-' + p.tag, true); if (!hostFrenzy) { hostFrenzy = true; await shot(host, 'p08-projector-last30', true); } }
    }
    if (!hostMid && Date.now() - t0 > 20000) { hostMid = true; await shot(host, 'p05-projector-mid-game', true); }
    await sleep(150);
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
  await sleep(11000);
  for (const p of allPhones) {
    await shot(p.page, 'k53-my-card-' + p.tag);
    const c = await p.page.evaluate(() => { const c = document.querySelector('.tc-mycard'); if (!c) return null; const r = c.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top), home: !!c.querySelector('.tc-home') }; });
    ok(c && c.home && c.top >= -2, p.name + ' got its card with «Inicio», its top (the character) on the screen: ' + JSON.stringify(c));
  }
  ok(recDone, 'Ana\'s bonk was filmed at 4 fps (' + recTry + ' tries)');
  await finish();
})().catch((e) => { console.log('FAIL · ' + e.message); finish(1); });
