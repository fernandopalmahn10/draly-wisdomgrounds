// ¡Atrapa a Fénec! · the ending when the crew does NOT get the words back (Fénec escapes and kicks the crab to pieces,
// the video's 8:09-8:13 «FINISH!» → the crab falls apart in a puff), filmed at 4 fps on a 390×844 phone, against a
// RUNNING local server (never the live site):
//   node scripts/record-teamcrab-end.js --url http://localhost:4512 --password <the local teacher code> [--out <folder>]
// One phone (Ana) + two socket kids who never answer; the teacher starts and presses «Terminar» right after the intro, so
// the crew has 0 words: «¡FINAL!» → the escaped ending. Frames in <out>/escape-4fps/, the projector's end in <out>.
// (The caught ending and a slam + bonk are filmed by scripts/check-teamcrab-screens.js: slam-4fps/ and end-4fps/.)
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const arg = (n, d) => (args.indexOf('--' + n) >= 0 && args[args.indexOf('--' + n) + 1]) || d;
const URL = arg('url', 'http://localhost:4512');
const PASSWORD = arg('password', process.env.TEST_TEACHER_PW || '');
const OUT = arg('out', path.join(__dirname, '..', '..', '..', 'teamcrab-shots', 'escape'));
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
const SET = 'pack:yct1-familia-r1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REC = path.join(OUT, 'escape-4fps');
fs.mkdirSync(REC, { recursive: true });
const socks = [];
const watchdog = setTimeout(() => { console.log('FAIL · timed out'); process.exit(1); }, 150000);
(async () => {
  const browser = await PW.chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
  let bad = 0;
  try {
    const host = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
    host.on('pageerror', (e) => { bad++; console.log('FAIL projector error: ' + e.message); });
    await host.goto(`${URL}/host-teamcrab.html?setId=${encodeURIComponent(SET)}`, { timeout: 45000, waitUntil: 'domcontentloaded' });
    await host.waitForSelector('#ks-t-code', { timeout: 15000 });
    await host.fill('#ks-t-code', PASSWORD);
    await host.click('.ks-go');
    await host.waitForFunction(() => /^\d+$/.test(document.getElementById('pin-display').textContent), null, { timeout: 15000 });
    const pin = await host.evaluate(() => document.getElementById('pin-display').textContent);
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
    page.on('pageerror', (e) => { bad++; console.log('FAIL phone error: ' + e.message); });
    await page.goto(`${URL}/player.html?pin=${pin}&name=Ana&autojoin=1`, { timeout: 45000, waitUntil: 'domcontentloaded' });
    for (const n of ['Leo', 'Mia']) {
      const s = io(URL, { transports: ['websocket'], forceNew: true });
      socks.push(s);
      await new Promise((res) => s.emit('player:join', { pin, name: n, avatar: '' }, res));
    }
    await sleep(2000);
    await host.click('#start-btn');
    await host.waitForFunction(() => window.CrabHost && window.CrabHost.frame().phase === 'play', null, { timeout: 15000 });
    await sleep(2500);
    host.once('dialog', (d) => d.accept());
    await host.click('#end-now-btn');
    await page.waitForSelector('#tc-cer', { timeout: 10000 });
    for (let i = 0; i < 24; i++) {
      const t = Date.now();
      try { await page.screenshot({ path: path.join(REC, 'f' + String(i).padStart(2, '0') + '.png'), timeout: 8000 }); } catch (_) { /* next */ }
      await sleep(Math.max(0, 250 - (Date.now() - t)));
    }
    await host.screenshot({ path: path.join(OUT, 'projector-end-escaped.png') });
    const broken = await page.evaluate(() => !!document.querySelector('.tc-cer-stage .tcs.broken'));
    if (!broken) { bad++; console.log('FAIL the crab did not fall apart in the escaped ending'); }
  } catch (e) { bad++; console.log('FAIL · ' + e.message); }
  socks.forEach((s) => s.disconnect());
  await browser.close();
  clearTimeout(watchdog);
  console.log(`record-teamcrab-end: ${bad ? 'FAIL' : 'OK'} · frames in ${REC}`);
  process.exit(bad ? 1 : 0);
})();
