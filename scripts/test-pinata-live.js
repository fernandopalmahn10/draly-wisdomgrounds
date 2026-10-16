// Live check of Piñata Tigre v2 against a RUNNING local server (never the live site):
//   node scripts/test-pinata-live.js --url http://localhost:3800
// One teacher + 4 kids: the lobby (ids + characters), the intro and «Saltar», the first questions, a wrong answer gives
// exactly one next question, a right answer opens a swing + its ping (ack), an honest centre tap is critical, a second tap
// is refused, a tampered clock is clamped, no tap = the automatic hit, «Pausa» holds the clock / refuses answers and taps /
// keeps an open swing through a long pause (watchdog resyncs) and the tap after «Seguir» counts, «+30 s», a rejoin keeps
// team + candies, a late joiner goes to the smaller team, team swaps are refused mid-game, «Terminar» plays «¡FINAL!» then
// the ceremony (a second «Terminar» is ignored), the end payload for the projector and each phone, reconnects after the
// end get it again, «Saltar» after the end reaches the phones, «Otra ronda» = a clean game.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:3800';
// creating a room needs a teacher (2026-10-15): the teacher code of the server under test (--password or TEST_TEACHER_PW)
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const SET = 'pack:yct1-familia-r1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
// a listener that timed out before it was awaited must fail the test with its reason, not crash it silently
process.on('unhandledRejection', (e) => { console.error('FAIL', e && e.message ? e.message : e); process.exit(1); });
const connect = () => io(URL, { transports: ['websocket'], forceNew: true });
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
function next(s, ev, ms, match) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { s.off(ev, h); rej(new Error(`timeout waiting for ${ev}`)); }, ms || 8000);
    function h(d) { if (match && !match(d)) return; clearTimeout(t); s.off(ev, h); res(d); }
    s.on(ev, h);
  });
}
function none(s, ev, ms) {
  return new Promise((res) => {
    let seen = false;
    const h = () => { seen = true; };
    s.on(ev, h);
    setTimeout(() => { s.off(ev, h); res(!seen); }, ms);
  });
}
const needle = (phase, c, half) => { const u = (((phase || 0) + Math.max(0, c) / half) % 2 + 2) % 2; return u <= 1 ? u : 2 - u; };
function when(sw, test, from) {
  for (let c = from || 250; c <= sw.window - 30; c += 5) if (test(needle(sw.phase, c, sw.half))) return c;
  return null;
}
// answer (random choice) until one is right; returns that answer-result (the swing in .pinata)
async function answerUntilRight(kid, maxTries) {
  for (let i = 0; i < (maxTries || 40); i++) {
    const q = kid.q || await next(kid.s, 'question', 6000);
    kid.q = null;
    const res = next(kid.s, 'answer-result', 4000);
    kid.s.emit('player:answer', { pin: kid.pin, qid: q.qid, choiceIdx: Math.floor(Math.random() * q.answers.length) }, () => {});
    const r = await res;
    r._at = Date.now();                    // the kid's arrow starts lead ms after this moment
    if (r.correct) return r;
    kid.q = await next(kid.s, 'question', 5000);
  }
  throw new Error('no right answer in time');
}
// tap at the moment the arrow is at the centre (on the kid's own clock: the swing's lead after the result arrived)
async function tapCentre(kid, r) {
  const sw = r.pinata;
  const c = when(sw, (p) => Math.abs(p - 0.5) < 0.01, 300);
  await sleep(Math.max(0, sw.lead + c - (Date.now() - r._at)));
  const hit = next(kid.s, 'pn:hit', 4000, (h) => h.hid === sw.hid);
  kid.s.emit('player:pn-hit', { pin: kid.pin, hid: sw.hid, c });
  return hit;
}

(async () => {
  const host = connect();
  let lastMeter = null;
  host.on('pn:meter', (d) => { lastMeter = d; });
  const { pin } = await ack(host, 'host:create', { gameType: 'pinata', password: PASSWORD });
  ok(pin, 'room created');
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded && loaded.ok, 'pack loaded');
  host.emit('host:set-duration', { pin, duration: 120 });
  const kids = [];
  for (let i = 0; i < 4; i++) {
    const s = connect();
    s.on('pn:ping', (d, cb) => { if (typeof cb === 'function') cb({ ok: 1 }); });
    const name = 'Tigre' + i;
    const j = await ack(s, 'player:join', { pin, name, avatar: '🐉' });
    ok(j && j.ok, name + ' joined');
    const kid = { s, name, team: j.team, pin, q: null, init: null, pings: [] };
    s.on('pn:ping', (d) => { kid.pings.push(d && d.hid); });
    s.on('pn:init', (d) => { kid.init = d; });
    s.on('question', (q) => { kid.q = q; });
    kids.push(kid);
  }
  ok(kids.filter((k) => k.team === 'red').length === 2, 'the lobby splits 2 / 2');
  await sleep(200);
  const lsP = next(host, 'state', 2000);
  host.emit('host:set-duration', { pin, duration: 120 });
  const ls = await lsP;
  ok(Object.values(ls.players).every((p) => p.k > 0 && typeof p.sk === 'string'), 'the projector knows every kid (id + character) from the lobby');

  // start → countdown → the intro on every screen; «Saltar» in the intro → play now
  const capP = next(host, 'pn:captains', 3000);
  host.emit('host:start', { pin });
  const cap = await capP;
  ok(cap && cap.red && cap.gold && cap.red !== cap.gold, 'two captains of the gang');
  const hi = await next(host, 'pn:init', 6000);
  ok(hi.phase === 'intro' && hi.ladder.length === 4 && hi.roster.length === 4 && hi.meter && hi.meter.tr === 0, 'the intro starts with the ladder, the roster and fresh tigers');
  await sleep(300);
  ok(kids.every((k) => k.init && k.init.phase === 'intro' && k.init.you && k.init.you.team === k.team), 'every phone gets its own snapshot');
  await sleep(500);
  host.emit('host:pn-skip', { pin });
  const play = await next(host, 'pn:play', 1500);
  ok(play.endsMs > 110000 && play.endsMs <= 120000, `«Saltar» in the intro starts the play (${play.endsMs} ms)`);
  await sleep(400);
  ok(kids.every((k) => !!k.q), 'every kid got a question when the play started');

  // a swap mid-game is refused
  const st0 = await next(host, 'state', 3000).catch(() => null);
  const ids = st0 ? Object.keys(st0.players) : [];
  if (ids.length) {
    host.emit('host:swap-team', { pin, playerId: ids[0] });
    ok(await none(kids[0].s, 'team-changed', 700), 'no team swap mid-game');
  }

  // a wrong answer: «¡Casi!» for 2.2 s, then exactly ONE next question (the room's tick deals it)
  const k3 = kids[3];
  for (let i = 0; i < 12; i++) {
    const q = k3.q || await next(k3.s, 'question', 6000);
    k3.q = null;
    const res = next(k3.s, 'answer-result', 4000);
    k3.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: Math.floor(Math.random() * q.answers.length) }, () => {});
    const r = await res;
    if (r.correct) {           // (a right one: let the automatic hit close it, then try again)
      await next(k3.s, 'pn:hit', 6000);
      await next(k3.s, 'question', 4000);
      continue;
    }
    ok(r.pinata && r.pinata.wait === 2200, 'a wrong answer is a wait, no swing');
    let count = 0;
    const h = () => { count++; };
    k3.s.on('question', h);
    await sleep(4300);
    k3.s.off('question', h);
    ok(count === 1, `after a wrong answer exactly one next question comes (${count})`);
    break;
  }
  k3.q = null;

  // a right answer opens a swing + its ping; an honest centre tap is critical; a second tap is refused
  const k0 = kids[0];
  const r0 = await answerUntilRight(k0);
  const sw0 = r0.pinata;
  ok(sw0 && sw0.hid > 0 && sw0.lead === 800 && sw0.window === 2700 && sw0.half === 900 && sw0.crit > 0, 'a right answer opens a swing (lead, window, the arrow)');
  await sleep(150);
  ok(k0.pings.includes(sw0.hid), 'the swing\'s ping reaches the phone (round trip measured on its ack)');
  const h0 = await tapCentre(k0, r0);
  ok(h0.grade === 'crit' && h0.crit && h0.power >= 6, `an honest centre tap is critical (${h0.grade}, +${h0.power})`);
  ok(h0.total === h0.power, 'my total = that hit');
  const noP = next(k0.s, 'pn:nohit', 2000);
  k0.s.emit('player:pn-hit', { pin, hid: sw0.hid, c: 100 });
  ok((await noP).hid === sw0.hid, 'a second tap on the same swing is refused');
  await sleep(300);
  ok(lastMeter && lastMeter.f && lastMeter.f.length > 0 || (lastMeter && (lastMeter.r + lastMeter.g) > 0), 'the projector meter moved (who hit)');
  k0.q = await next(k0.s, 'question', 3000);
  ok(!!k0.q, 'the next question comes after the result');

  // a tampered clock: tap when the arrow is at the edge but claim the centre → clamped, never critical
  const k1 = kids[1];
  const r1 = await answerUntilRight(k1);
  const sw1 = r1.pinata;
  const edge = when(sw1, (p) => p < 0.1, 250);
  const centre = edge != null ? (() => { for (let c = 0; c <= sw1.window; c += 5) if (Math.abs(needle(sw1.phase, c, sw1.half) - 0.5) < 0.01 && Math.abs(c - edge) > 420) return c; return null; })() : null;
  if (edge != null && centre != null) {
    await sleep(Math.max(0, sw1.lead + edge - (Date.now() - r1._at)));
    const hp = next(k1.s, 'pn:hit', 4000, (h) => h.hid === sw1.hid);
    k1.s.emit('player:pn-hit', { pin, hid: sw1.hid, c: centre });
    const h1 = await hp;
    ok(h1.grade !== 'crit' && Math.abs(h1.c - edge) <= 260, `a claimed centre far from the server's clock is clamped (${h1.grade}, c ${h1.c} vs tap ${edge})`);
  } else {
    ok(true, '(no edge/centre pair in this swing: skipped)');
    await next(k1.s, 'pn:hit', 6000);
  }
  k1.q = await next(k1.s, 'question', 4000);

  // no tap: the server's automatic hit after the window (power 1)
  const k2 = kids[2];
  const r2 = await answerUntilRight(k2);
  const tA = Date.now();
  const ha = await next(k2.s, 'pn:hit', 6000, (h) => h.hid === r2.pinata.hid);
  ok(ha.grade === 'auto' && ha.power === 1, `no tap = an automatic hit worth 1 (${ha.grade}, +${ha.power})`);
  ok(Date.now() - tA >= r2.pinata.lead + r2.pinata.window, 'only after the whole window');
  k2.q = await next(k2.s, 'question', 3000);

  // pause: the clock stands still, answers and taps are refused, an open swing survives a long pause
  const r3 = await answerUntilRight(k1);
  await sleep(r3.pinata.lead + 200);
  host.emit('host:pause', { pin, paused: true });
  const p1 = await next(host, 'pn:pause', 2000);
  ok(p1.paused && p1.endsMs > 0, 'paused');
  const noTap = next(k1.s, 'pn:nohit', 2000);
  k1.s.emit('player:pn-hit', { pin, hid: r3.pinata.hid, c: 600 });
  ok((await noTap).paused, 'a tap during the pause is refused (and the phone is told)');
  const q2 = k2.q || await next(k2.s, 'question', 4000);
  const stale = next(k2.s, 'answer-stale', 2000);
  k2.s.emit('player:answer', { pin, qid: q2.qid, choiceIdx: 0 }, () => {});
  ok((await stale).reason === 'paused', 'an answer during the pause is handed back (the question stays open)');
  let dealt = 0;
  const hq = () => { dealt++; };
  k1.s.on('question', hq);
  for (let i = 0; i < 3; i++) { await sleep(4500); k1.s.emit('player:resync', { pin }); }
  await sleep(600);
  k1.s.off('question', hq);
  ok(dealt === 0, `no new question while paused, even with resyncs (${dealt})`);
  kids[3].s.emit('player:resync', { pin });
  const rs = await next(kids[3].s, 'pn:init', 2000);
  ok(rs.paused && Math.abs(rs.endsMs - p1.endsMs) < 400, `the clock stands still while paused (${p1.endsMs} → ${rs.endsMs})`);
  host.emit('host:pause', { pin, paused: false });
  const p2 = await next(host, 'pn:pause', 2000);
  ok(!p2.paused && Math.abs(p2.endsMs - p1.endsMs) < 500, 'resume gives the time back');
  const h3p = next(k1.s, 'pn:hit', 4000, (h) => h.hid === r3.pinata.hid);
  k1.s.emit('player:pn-hit', { pin, hid: r3.pinata.hid, c: 200 + 300 });
  const h3 = await h3p;
  ok(h3.grade !== 'auto', `the swing survived a 14 s pause: the tap after «Seguir» counts (${h3.grade})`);

  // «+30 s»
  kids[3].s.emit('player:resync', { pin });
  const ref = await next(kids[3].s, 'pn:init', 2000);
  const t2 = Date.now();
  host.emit('host:add-time', { pin, seconds: 30 });
  const tm = await next(host, 'pn:time', 2000);
  const expect = ref.endsMs - (Date.now() - t2) + 30000;
  ok(Math.abs(tm.endsMs - expect) < 1500, `+30 s moves the end (${tm.endsMs} vs ${expect})`);

  // a rejoin keeps team and candies; a late joiner goes to the team with fewer kids
  const before = k0.team;
  k0.s.close();
  await sleep(300);
  const s0b = connect();
  s0b.on('pn:ping', (d, cb) => { if (typeof cb === 'function') cb({ ok: 1 }); });
  const initB = next(s0b, 'pn:init', 3000);
  const rj = await ack(s0b, 'player:join', { pin, name: k0.name, avatar: '🐉' });
  ok(rj.ok && rj.rejoined && rj.team === before, 'a rejoin keeps the team');
  const ib = await initB;
  ok(ib.you && ib.you.candy >= h0.total, `a rejoin keeps the candies (${ib.you.candy})`);
  k0.s = s0b;
  kids[3].s.close();
  await sleep(300);
  const late = connect();
  late.on('pn:ping', (d, cb) => { if (typeof cb === 'function') cb({ ok: 1 }); });
  const lj = await ack(late, 'player:join', { pin, name: 'Tarde', avatar: '🐪' });
  ok(lj.ok && lj.team === kids[3].team, `a late joiner goes to the team with fewer connected kids (${lj.team})`);
  const li = await next(late, 'pn:init', 2000);
  ok(li.you && li.you.k > 0 && li.you.candy === 0, 'the late joiner hits from now');

  // «Terminar»: «¡FINAL!» first, a second «Terminar» is ignored, then the ceremony on every screen
  const kidEnd = next(k1.s, 'game-end', 5000);
  const finalP = next(host, 'pn:final', 2000);
  host.emit('host:end-now', { pin });
  const fin = await finalP;
  ok(fin.ms === 2400, '«Terminar» plays «¡FINAL!»');
  host.emit('host:end-now', { pin });
  ok(await none(host, 'pn:final', 600), 'a second «Terminar» during «¡FINAL!» is ignored');
  const he = await next(host, 'game-end', 5000);
  ok(he.pinata && he.pinata.totals && he.teamScores.red === he.pinata.totals.r && he.leaderboard.length >= 4, 'the projector gets the totals, the stars, the top list');
  ok(['red', 'gold', 'tie'].includes(he.pinata.winner) && Array.isArray(he.pinata.stars) && he.pinata.tiers, 'a winner, the stars, the tigers broken');
  const ke = await kidEnd;
  ok(ke.me && ke.me.candy === h3.total && ke.me.team === k1.team && ke.me.hits >= 2, `each phone gets its own card (${ke.me.candy} caramelos, ${ke.me.hits} golpes)`);
  ok(!('leaderboard' in ke), 'a phone does not get the whole leaderboard');

  // after the end: reconnects get the ceremony again; «Saltar» reaches the phones
  const host2 = connect();
  const re = next(host2, 'game-end', 2000);
  const rc = await ack(host2, 'host:reclaim', { pin });
  ok(rc.ok && rc.state === 'ended', 'reclaim after the end');
  ok((await re).pinata, 'the projector gets the ceremony again');
  const kr = next(k1.s, 'game-end', 2000);
  k1.s.emit('player:resync', { pin });
  ok((await kr).me, 'a phone that resyncs after the end gets its card again');
  const sk = next(k1.s, 'pn:skip', 2000);
  host2.emit('host:pn-skip', { pin });
  ok(!!(await sk), '«Saltar» after the end reaches the phones');
  k1.s.close();
  await sleep(300);
  const s1b = connect();
  const cardB = next(s1b, 'game-end', 3000);
  const rj2 = await ack(s1b, 'player:join', { pin, name: k1.name, avatar: '🐉' });
  ok(rj2.ok && rj2.gameState === 'ended' && rj2.team === k1.team, 'after the end, the same name on a new socket gets its slot back');
  ok((await cardB).me.candy === ke.me.candy, 'and its own card again');
  const stranger = connect();
  const sj = await ack(stranger, 'player:join', { pin, name: 'Nadie', avatar: '🐉' });
  ok(!sj.ok, 'a new name after the end still waits for «Otra ronda»');
  stranger.close();
  k1.s = s1b;

  // «Otra ronda»: a clean game on the same PIN
  host2.emit('host:reset', { pin });
  const lob = await next(host2, 'state', 2000, (s) => s.state === 'lobby');
  ok(lob.state === 'lobby', 'back to the lobby');
  const init2P = next(host2, 'pn:init', 6000);
  host2.emit('host:start', { pin });
  const i2 = await init2P;
  ok(i2.id !== hi.id && i2.meter.r === 0 && i2.meter.g === 0 && i2.meter.tr === 0 && i2.phase === 'intro', 'a new game: new id, candies at 0, the first tigers');
  host2.emit('host:end-now', { pin });
  await next(host2, 'game-end', 6000);
  ok(true, 'ends cleanly');

  [host, host2, late, ...kids.map((k) => k.s)].forEach((s) => s.close());
  console.log(`test-pinata-live: ${checks} checks OK`);
  process.exit(0);
})().catch((e) => { console.error('FAIL', e && e.message ? e.message : e); process.exit(1); });
