// Live check of Mochi Mash v2 against a RUNNING local server (never the live site):
//   node scripts/test-mochi-live.js --url http://localhost:3700
// One teacher + 4 kids: the intro and «Saltar», the first questions, a right answer opens a mash window, tap batches are
// capped and summed (mm:mashed), «Pausa» holds the clock / refuses taps and answers / moves an open window, resume,
// a resync while paused, «+30 s», a rejoin keeps team + mochis, a late joiner goes to the smaller team, team swaps are
// refused mid-game, «Terminar» plays «¡FINAL!» then the ceremony (a second «Terminar» is ignored), the end payload for
// the projector and each phone, a projector / phone that reconnects after the end gets it again, «Saltar» after the end
// reaches the phones, «Otra ronda» = a clean game.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:3700';
const SET = 'pack:yct1-familia-r1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
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
// answer questions (random choice) until one is right; returns that answer-result
async function answerUntilRight(kid, maxTries) {
  for (let i = 0; i < (maxTries || 30); i++) {
    const q = kid.q || await next(kid.s, 'question', 6000);
    kid.q = null;
    const pick = Math.floor(Math.random() * q.answers.length);
    const res = next(kid.s, 'answer-result', 4000);
    kid.s.emit('player:answer', { pin: kid.pin, qid: q.qid, choiceIdx: pick }, () => {});
    const r = await res;
    if (r.correct) return r;
    kid.q = await next(kid.s, 'question', 5000);
  }
  throw new Error('no right answer in time');
}

(async () => {
  const host = connect();
  let lastMeter = null;
  host.on('mm:meter', (d) => { lastMeter = d; });
  const { pin } = await ack(host, 'host:create', { gameType: 'mochi-mash' });
  ok(pin, 'room created');
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded && loaded.ok, 'pack loaded');
  host.emit('host:set-duration', { pin, duration: 120 });
  const kids = [];
  for (let i = 0; i < 4; i++) {
    const s = connect();
    const name = 'Mochi' + i;
    const j = await ack(s, 'player:join', { pin, name, avatar: '🐉' });
    ok(j && j.ok, name + ' joined');
    const kid = { s, name, team: j.team, pin, q: null, init: null };
    s.on('mm:init', (d) => { kid.init = d; });
    s.on('question', (q) => { kid.q = q; });
    kids.push(kid);
  }
  ok(kids.filter((k) => k.team === 'red').length === 2, 'the lobby splits 2 / 2');
  await sleep(200);
  const lsP = next(host, 'state', 2000);
  host.emit('host:set-duration', { pin, duration: 120 });        // (one more state push, so the snapshot is fresh)
  const ls = await lsP;
  ok(Object.values(ls.players).every((p) => p.k > 0 && typeof p.sk === 'string'), 'the projector knows every kid (id + character) from the lobby');

  // start → countdown → the intro on every screen; «Saltar» in the intro → play now
  host.emit('host:start', { pin });
  const hi = await next(host, 'mm:init', 6000);
  ok(hi.phase === 'intro' && hi.E > 0 && hi.landmarks.length === 4 && hi.roster.length === 4, 'the intro starts with the landmarks and the roster');
  await sleep(300);                                              // (the phones' own snapshots are on their way)
  ok(kids.every((k) => k.init && k.init.phase === 'intro' && k.init.you && k.init.you.team === k.team), 'every phone gets its own snapshot');
  await sleep(500);
  host.emit('host:mm-skip', { pin });
  const play = await next(host, 'mm:play', 1500);
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

  // a wrong answer: «¡Casi!» for 2.2 s, then exactly ONE next question (the room's tick deals it, not two timers)
  const k3 = kids[3];
  for (let i = 0; i < 12; i++) {
    const q = k3.q || await next(k3.s, 'question', 6000);
    k3.q = null;
    const res = next(k3.s, 'answer-result', 4000);
    k3.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: Math.floor(Math.random() * q.answers.length) }, () => {});
    const r = await res;
    if (r.correct) { await next(k3.s, 'question', 9000); continue; }
    let count = 0;
    const h = () => { count++; };
    k3.s.on('question', h);
    await sleep(4300);
    k3.s.off('question', h);
    ok(count === 1, `after a wrong answer exactly one next question comes (${count})`);
    break;
  }
  k3.q = null;

  // a right answer opens a window; capped tap batches; the summary
  const k0 = kids[0];
  const r0 = await answerUntilRight(k0);
  ok(r0.mochi && r0.mochi.mid > 0 && r0.mochi.ms >= 5000 && r0.mochi.lead === 900, 'a right answer opens a mash window after the lead-in');
  await sleep(r0.mochi.lead + 100);
  for (let i = 0; i < 8; i++) { k0.s.emit('player:mm-taps', { pin, mid: r0.mochi.mid, n: 12 }); await sleep(250); }   // 48 a second claimed
  const sum0 = await next(k0.s, 'mm:mashed', r0.mochi.ms + 3000);
  ok(sum0.mid === r0.mochi.mid && sum0.taps > 0 && sum0.taps <= Math.floor((12 * r0.mochi.ms) / 1000) + 6, `taps capped (${sum0.taps} credited of 96 claimed in ~2 s)`);
  ok(sum0.taps <= Math.floor(12 * 2.3) + 6, 'the cap follows the time spent in the window, not the claim');
  ok(sum0.mochis >= sum0.taps && sum0.total === sum0.mochis, 'the summary adds up');
  const meter = lastMeter || { r: 0, g: 0 };
  ok(meter.r + meter.g > 0, 'the projector meter moved');
  const nq = await next(k0.s, 'question', 3000);
  ok(!!nq, 'the next question comes after the window');
  k0.q = nq;

  // pause: the clock stands still, answers and taps are refused, a resync shows it paused
  const k1 = kids[1];
  const r1 = await answerUntilRight(k1);
  await sleep(r1.mochi.lead + 300);
  k1.s.emit('player:mm-taps', { pin, mid: r1.mochi.mid, n: 3 });
  await sleep(100);
  host.emit('host:pause', { pin, paused: true });
  const p1 = await next(host, 'mm:pause', 2000);
  ok(p1.paused && p1.endsMs > 0, 'paused');
  k1.s.emit('player:mm-taps', { pin, mid: r1.mochi.mid, n: 3 });
  const k2 = kids[2];
  const q2 = k2.q || await next(k2.s, 'question', 4000);
  const stale = next(k2.s, 'answer-stale', 2000);
  k2.s.emit('player:answer', { pin, qid: q2.qid, choiceIdx: 0 }, () => {});
  const sr = await stale;
  ok(sr.reason === 'paused', 'an answer during the pause is handed back (the question stays open)');
  ok(await none(k1.s, 'mm:mashed', r1.mochi.ms + 800), 'an open window does not close while paused');
  kids[3].s.emit('player:resync', { pin });
  const rs = await next(kids[3].s, 'mm:init', 2000);
  ok(rs.paused && Math.abs(rs.endsMs - p1.endsMs) < 400, `the clock stands still while paused (${p1.endsMs} → ${rs.endsMs})`);
  host.emit('host:pause', { pin, paused: false });
  const p2 = await next(host, 'mm:pause', 2000);
  let t2 = Date.now();
  ok(!p2.paused && Math.abs(p2.endsMs - p1.endsMs) < 500, 'resume gives the time back');
  const sum1 = await next(k1.s, 'mm:mashed', r1.mochi.ms + 3000);
  ok(sum1.taps === 3, `taps during the pause were refused, the window was moved, not lost (${sum1.taps})`);

  // a LONG pause (> 12 s: every phone's watchdog resyncs) in the middle of a window: no question is dealt under the pause
  // card, the window waits, and taps after «Seguir» still count (classroom playtest 2026-10-14)
  const k2b = kids[2];
  const r2 = await answerUntilRight(k2b);
  await sleep(r2.mochi.lead + 200);
  host.emit('host:pause', { pin, paused: true });
  await next(host, 'mm:pause', 2000);
  let dealt = 0;
  const hq = () => { dealt++; };
  k2b.s.on('question', hq);
  for (let i = 0; i < 3; i++) { await sleep(4500); k2b.s.emit('player:resync', { pin }); }
  await sleep(600);
  k2b.s.off('question', hq);
  ok(dealt === 0, `no new question while paused, even with resyncs (${dealt})`);
  host.emit('host:pause', { pin, paused: false });
  await next(host, 'mm:pause', 2000);
  for (let i = 0; i < 6; i++) { k2b.s.emit('player:mm-taps', { pin, mid: r2.mochi.mid, n: 2 }); await sleep(250); }
  const sum2 = await next(k2b.s, 'mm:mashed', r2.mochi.ms + 3000);
  ok(sum2.mid === r2.mochi.mid && sum2.taps === 12, `the window survived a 14 s pause: taps after «Seguir» count (${sum2.taps})`);
  k2b.q = await next(k2b.s, 'question', 3000);

  // a SLOW wrong answer (> 12 s on the question): still exactly one next question (the old watchdog race)
  const qs = k2b.q;
  k2b.q = null;
  await sleep(12600);
  let slow = 0;
  const hs = () => { slow++; };
  k2b.s.on('question', hs);
  const resS = next(k2b.s, 'answer-result', 4000);
  k2b.s.emit('player:answer', { pin, qid: qs.qid, choiceIdx: -1 }, () => {});    // a time-up
  const rS = await resS;
  await sleep(4400);
  k2b.s.off('question', hs);
  ok(!rS.correct && slow === 1, `a time-up after 12.6 s gives exactly one next question (${slow})`);

  // «+30 s» (the reference: the clock right now, from a fresh snapshot)
  kids[3].s.emit('player:resync', { pin });
  const ref = await next(kids[3].s, 'mm:init', 2000);
  p2.endsMs = ref.endsMs;
  t2 = Date.now();
  host.emit('host:add-time', { pin, seconds: 30 });
  const tm = await next(host, 'mm:time', 2000);
  const expect = p2.endsMs - (Date.now() - t2) + 30000;
  ok(Math.abs(tm.endsMs - expect) < 1500, `+30 s moves the end (${tm.endsMs} vs ${expect})`);

  // a rejoin keeps team and mochis; a late joiner goes to the team with fewer kids
  const before = k0.team;
  k0.s.close();
  await sleep(300);
  const s0b = connect();
  const initB = next(s0b, 'mm:init', 3000);
  const rj = await ack(s0b, 'player:join', { pin, name: k0.name, avatar: '🐉' });
  ok(rj.ok && rj.rejoined && rj.team === before, 'a rejoin keeps the team');
  const ib = await initB;
  ok(ib.you && ib.you.mochis === sum0.total, `a rejoin keeps the mochis (${ib.you.mochis})`);
  k0.s = s0b;
  kids[3].s.close();                                            // one of the other team leaves…
  await sleep(300);
  const late = connect();
  const lj = await ack(late, 'player:join', { pin, name: 'Tarde', avatar: '🐪' });
  ok(lj.ok && lj.team === kids[3].team, `a late joiner goes to the team with fewer connected kids (${lj.team})`);
  const li = await next(late, 'mm:init', 2000);
  ok(li.you && li.you.k > 0 && li.you.mochis === 0, 'the late joiner feeds from now');

  // «Terminar»: «¡FINAL!» first, a second «Terminar» is ignored, then the ceremony on every screen
  const finalP = next(host, 'mm:final', 2000);
  host.emit('host:end-now', { pin });
  const fin = await finalP;
  ok(fin.ms === 2400, '«Terminar» plays «¡FINAL!»');
  host.emit('host:end-now', { pin });
  ok(await none(host, 'mm:final', 600), 'a second «Terminar» during «¡FINAL!» is ignored');
  const kidEnd = next(k1.s, 'game-end', 4000);
  const he = await next(host, 'game-end', 4000);
  ok(he.mochi && he.mochi.totals && he.teamScores.red === he.mochi.totals.r && he.leaderboard.length >= 4, 'the projector gets the totals, the stars, the top list');
  ok(['red', 'gold', 'tie'].includes(he.mochi.winner) && Array.isArray(he.mochi.stars), 'a winner and the stars');
  const ke = await kidEnd;
  ok(ke.me && ke.me.mochis === sum1.total && ke.me.team === k1.team, `each phone gets its own card (${ke.me.mochis} mochis)`);
  ok(!('leaderboard' in ke), 'a phone does not get the whole leaderboard');

  // after the end: a reconnecting projector / a phone that resyncs get the ceremony again; «Saltar» reaches the phones
  const host2 = connect();
  const re = next(host2, 'game-end', 2000);
  const rc = await ack(host2, 'host:reclaim', { pin });
  ok(rc.ok && rc.state === 'ended', 'reclaim after the end');
  ok((await re).mochi, 'the projector gets the ceremony again');
  const kr = next(k1.s, 'game-end', 2000);
  k1.s.emit('player:resync', { pin });
  ok((await kr).me, 'a phone that resyncs after the end gets its card again');
  const sk = next(k1.s, 'mm:skip', 2000);
  host2.emit('host:mm-skip', { pin });
  ok(!!(await sk), '«Saltar» after the end reaches the phones');
  // a phone that dropped around the end comes back on a NEW socket: its slot and its own card again
  k1.s.close();
  await sleep(300);
  const s1b = connect();
  const cardB = next(s1b, 'game-end', 3000);
  const rj2 = await ack(s1b, 'player:join', { pin, name: k1.name, avatar: '🐉' });
  ok(rj2.ok && rj2.gameState === 'ended' && rj2.team === k1.team, 'after the end, the same name on a new socket gets its slot back');
  const cb2 = await cardB;
  ok(cb2.me && cb2.me.mochis === ke.me.mochis, 'and its own card again');
  const stranger = connect();
  const sj = await ack(stranger, 'player:join', { pin, name: 'Nadie', avatar: '🐉' });
  ok(!sj.ok, 'a new name after the end still waits for «Otra ronda»');
  stranger.close();
  k1.s = s1b;

  // «Otra ronda»: a clean game on the same PIN
  host2.emit('host:reset', { pin });
  const lob = await next(host2, 'state', 2000, (s) => s.state === 'lobby');
  ok(lob.state === 'lobby', 'back to the lobby');
  const init2P = next(host2, 'mm:init', 6000);
  host2.emit('host:start', { pin });
  const i2 = await init2P;
  ok(i2.id !== hi.id && i2.totals.r === 0 && i2.totals.g === 0 && i2.phase === 'intro', 'a new game: new id, totals at 0');
  host2.emit('host:end-now', { pin });
  await next(host2, 'game-end', 6000);
  ok(true, 'ends cleanly');

  [host, host2, late, ...kids.map((k) => k.s)].forEach((s) => s.close());
  console.log(`test-mochi-live: ${checks} checks OK`);
  process.exit(0);
})().catch((e) => { console.error('FAIL', e && e.message ? e.message : e); process.exit(1); });
