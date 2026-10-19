// One name, one device (2026-10-19, his laptop showed Las Trampillas as an empty dark screen until he typed the PIN
// again). Before: a second device with a name already in the room MOVED that kid's slot to itself; the first device stayed
// in the room with no player: it heard the countdown and «active» (its screen switched to the game) but never got its own
// game (td:init, questions), and its resync was answered with nothing. Live check against a RUNNING local server (never
// the live site):
//   node scripts/test-samename-live.js --url http://localhost:4600 --password <the local teacher code>
// Checked: a second device with a name playing right now gets its own slot «Fernando 2» (both play: their own platform,
// their own question); the same phone again (its saved code: a reload, a second tab) takes its slot back and the old tab
// hears `player:elsewhere` (its resync then gets nothing, it never steals back); a phone that dropped comes back to its
// slot by name as always; a missed td:init comes back with a resync; a phone of the room with no slot hears
// `player:gone` (player.js joins again by itself; reproduced with an exam room, which keeps the old rule); a «Zoe 2»
// whose page reloads (its link says «Zoe») finds its own slot by its code; after the end a name playing on another device
// is never taken, and a device typing a dropped kid's name gets the card but never that kid's code; another game (Mochi
// Mash) and a long name follow the same rule.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:4600';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const SET = 'pack:yct1-familia-r1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
process.on('unhandledRejection', (e) => { console.error('FAIL', e && e.message ? e.message : e); process.exit(1); });
const sockets = [];
const connect = () => { const s = io(URL, { transports: ['websocket'], forceNew: true }); sockets.push(s); return s; };
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
function next(s, ev, ms, match) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { s.off(ev, h); rej(new Error(`timeout waiting for ${ev}`)); }, ms || 6000);
    function h(d) { if (match && !match(d)) return; clearTimeout(t); s.off(ev, h); res(d); }
    s.on(ev, h);
  });
}
// nothing of `ev` arrives within ms
function none(s, ev, ms) {
  return new Promise((res) => { let got = false; const h = () => { got = true; }; s.on(ev, h); setTimeout(() => { s.off(ev, h); res(!got); }, ms); });
}
// a kid: its socket, everything it hears that matters here
function kid(name) {
  const s = connect();
  const k = { s, name, inits: [], qs: [], elsewhere: 0, gone: 0 };
  s.on('td:ping', (m, cb) => { if (typeof cb === 'function') cb(1); });
  s.on('td:init', (d) => k.inits.push(d));
  s.on('question', (q) => k.qs.push(q));
  s.on('player:elsewhere', () => { k.elsewhere++; });
  s.on('player:gone', () => { k.gone++; });
  return k;
}

(async () => {
  // ---------- Las Trampillas: two devices called «Fernando» ----------
  const host = connect();
  const { pin } = await ack(host, 'host:create', { gameType: 'trapdoor', password: PASSWORD });
  ok(pin, 'a trapdoor room');
  ok((await ack(host, 'host:load-set', { pin, setId: SET })).ok, 'the pack loads');
  await ack(host, 'host:td-rounds', { pin, rounds: 3 });

  const phone = kid('Fernando'), laptop = kid('Fernando');
  const j1 = await ack(phone.s, 'player:join', { pin, name: 'Fernando' });
  ok(j1.ok && j1.name === 'Fernando', 'the phone joins as Fernando');
  const j2 = await ack(laptop.s, 'player:join', { pin, name: 'fernando' });
  ok(j2.ok && j2.name === 'fernando 2' && !j2.rejoined, `the laptop (no saved code, the phone still playing) gets its own slot, as it spelled it: «${j2.name}»`);
  ok(phone.elsewhere === 0, '… and the phone is not told to stop');
  const j3 = await ack(kid('Fernando').s, 'player:join', { pin, name: 'Fernando' });
  ok(j3.ok && j3.name === 'Fernando 3', 'a third one: «Fernando 3»');
  const longName = 'Maximiliano Alejand';                // 19 characters: «… 2» still fits in 20
  const l1 = kid(longName), l2 = kid(longName);
  await ack(l1.s, 'player:join', { pin, name: longName });
  const jl = await ack(l2.s, 'player:join', { pin, name: longName });
  ok(jl.ok && jl.name.length <= 20 && / 2$/.test(jl.name), `a long name keeps 20 characters at most: «${jl.name}»`);

  // a «Zoe 2» whose page reloads: the link still says «Zoe», its saved code finds its own slot (never a «Zoe 3»)
  const z1 = kid('Zoe'), z2 = kid('Zoe');
  await ack(z1.s, 'player:join', { pin, name: 'Zoe' });
  const jz2 = await ack(z2.s, 'player:join', { pin, name: 'Zoe' });
  ok(jz2.name === 'Zoe 2', 'a second Zoe: «Zoe 2»');
  const z3 = kid('Zoe');
  const zGone = next(z2.s, 'player:elsewhere', 3000);
  const jz3 = await ack(z3.s, 'player:join', { pin, name: 'Zoe', studentCode: jz2.studentCode });
  ok(jz3.ok && jz3.rejoined && jz3.name === 'Zoe 2', `«Zoe 2» reloads (the link says «Zoe», her code): back to her own slot («${jz3.name}»)`);
  await zGone;
  ok(z1.elsewhere === 0, '… and the first Zoe keeps hers');

  // the same phone again (a second tab: its saved code) takes its slot back; the old tab hears where its game went
  const tabA = kid('Leo');
  const ja = await ack(tabA.s, 'player:join', { pin, name: 'Leo' });
  ok(ja.ok && ja.studentCode, 'Leo joins (the room gives him a code, his phone saves it)');
  const tabB = kid('Leo');
  const elsewhereA = next(tabA.s, 'player:elsewhere', 3000);
  const jb = await ack(tabB.s, 'player:join', { pin, name: 'Leo', studentCode: ja.studentCode });
  ok(jb.ok && jb.rejoined && jb.name === 'Leo', 'the same phone (its saved code) takes its slot back: the same Leo');
  await elsewhereA;
  ok(tabA.elsewhere === 1, '… and the old tab hears player:elsewhere (a card with «Jugar aquí», never an empty game)');

  // a phone that dropped comes back to its slot by name, as always (even with no code)
  const mia = kid('Mia');
  await ack(mia.s, 'player:join', { pin, name: 'Mia' });
  mia.s.close();
  await sleep(400);
  const mia2 = kid('Mia');
  const jm = await ack(mia2.s, 'player:join', { pin, name: 'Mia' });
  ok(jm.ok && jm.rejoined && jm.name === 'Mia', 'a phone that dropped comes back to its own slot (Mia, no code)');

  // ---------- the start: every device has its own game ----------
  const inits = [phone, laptop, tabB, mia2].map((k) => next(k.s, 'td:init', 9000));
  const noInitA = none(tabA.s, 'td:init', 6500);
  host.emit('host:start', { pin });
  const [iP, iL, iB, iM] = await Promise.all(inits);
  ok(iP.me && iL.me && iP.me !== iL.me, 'the phone and the laptop each get their own platform (two characters)');
  ok(iP.roster[iP.me][0] === 'Fernando' && iL.roster[iL.me][0] === 'fernando 2', '… named Fernando and fernando 2 on every screen');
  ok(iB.me && iB.roster[iB.me][0] === 'Leo', 'the tab that took Leo\'s slot plays Leo');
  ok(iM.me && iM.roster[iM.me][0] === 'Mia', 'Mia plays after her reconnect');
  ok(await noInitA, 'the old tab (told «elsewhere») gets no game: it left the room');
  await Promise.all([phone, laptop].map((k) => (k.qs.length ? null : next(k.s, 'question', 8000))));
  ok(phone.qs.length > 0 && laptop.qs.length > 0, 'the phone and the laptop each get their own question in round 1');

  // a missed td:init: the resync brings it back (the same character)
  const again = next(laptop.s, 'td:init', 4000);
  laptop.s.emit('player:resync', { pin });
  const iL2 = await again;
  ok(iL2.me === iL.me, 'a missed td:init comes back with player:resync (the same character)');
  // the old tab's resync gets nothing: no game, no «gone» (it must not join again by itself and steal Leo back)
  const quietA = none(tabA.s, 'td:init', 1500), notGone = none(tabA.s, 'player:gone', 1500);
  tabA.s.emit('player:resync', { pin });
  ok((await quietA) && (await notGone), 'the old tab\'s resync: nothing (it waits for its «Jugar aquí»)');
  // «Jugar aquí»: the old tab joins with its saved code and takes Leo back; the other tab hears it
  const elsewhereB = next(tabB.s, 'player:elsewhere', 3000);
  const backA = next(tabA.s, 'td:init', 4000);
  const jA2 = await ack(tabA.s, 'player:join', { pin, name: 'Leo', studentCode: ja.studentCode });
  ok(jA2.ok && jA2.rejoined && jA2.name === 'Leo', '«Jugar aquí» takes Leo back');
  const iA = await backA;
  await elsewhereB;
  ok(iA.me === iB.me, '… the same character, and the other tab is told');

  // ---------- after the end: a name playing on another device is never taken ----------
  mia2.s.close();                                    // (Mia's phone drops before the end)
  await sleep(300);
  host.emit('host:end-now', { pin });
  await next(phone.s, 'game-end', 15000);
  const late = kid('Fernando');
  const jE = await ack(late.s, 'player:join', { pin, name: 'Fernando' });
  ok(!jE.ok, 'after the end, another device can\'t take Fernando\'s card while his phone is there');
  ok(phone.elsewhere === 0, '… and Fernando\'s phone keeps it');
  const other = kid('Mia');
  const jO = await ack(other.s, 'player:join', { pin, name: 'Mia' });
  ok(jO.ok && jO.gameState === 'ended' && !jO.studentCode && jO.guest, 'after the end, a device typing a dropped kid\'s name gets the card, never that kid\'s code');

  // ---------- another game: the same rule ----------
  const mh = connect();
  const room2 = await ack(mh, 'host:create', { gameType: 'mochi-mash', password: PASSWORD });
  const s1 = kid('Sofía'), s2 = kid('Sofía');
  ok((await ack(s1.s, 'player:join', { pin: room2.pin, name: 'Sofía' })).name === 'Sofía', 'Mochi Mash: Sofía');
  ok((await ack(s2.s, 'player:join', { pin: room2.pin, name: 'Sofía' })).name === 'Sofía 2', 'Mochi Mash: a second Sofía playing at the same time is «Sofía 2»');

  // ---------- the safety net: a phone of a room with no slot hears «gone» ----------
  // (exam rooms keep the old rule — the teacher supervises the tablets — so a second tablet with the same name still
  // takes the slot: the first is a phone with no slot, the case player.js answers by joining again by itself)
  const eh = connect();
  const ex = await ack(eh, 'host:create', { gameType: 'hsksim', simId: 'yct1-sim1', password: PASSWORD });
  if (ex && ex.pin) {
    const t1 = kid('Tablet'), t2 = kid('Tablet');
    await ack(t1.s, 'player:join', { pin: ex.pin, name: 'Ana Exam' });
    const jt = await ack(t2.s, 'player:join', { pin: ex.pin, name: 'Ana Exam' });
    ok(jt.ok && jt.rejoined, 'an exam room: the second tablet takes the slot (its old rule)');
    const gone = next(t1.s, 'player:gone', 3000);
    t1.s.emit('player:resync', { pin: ex.pin });
    ok(!!(await gone), 'the first tablet (no slot any more) hears player:gone on its resync');
    const stranger = kid('x');
    const noGone = none(stranger.s, 'player:gone', 1200);
    stranger.s.emit('player:resync', { pin: ex.pin });
    ok(await noGone, 'a socket that never joined that room hears nothing');
  } else ok(true, '(no exam room on this server: the «gone» check skipped)');

  sockets.forEach((s) => { try { s.close(); } catch (_) {} });
  console.log(`PASS · one name, one device: ${checks} checks`);
  process.exit(0);
})();
