// Live check of 6-7 Swing v2 against a RUNNING local server (never the live site):
//   node scripts/test-sixseven-live.js --url http://localhost:3900
// One teacher + 4 kids: the round style from the lobby (and an unknown one refused), the lobby ids + characters, the
// captains, the intro and «Saltar», a sum for every kid, the sums follow the style, a right answer (the streak, the
// coins, the next sum after the short beat), a wrong one (the wait, «¡Respira!» after two), a too-fast tap, a mashed
// double tap (one verdict, at most one 'answer-stale'), time up, the projector's feed, «Pausa» (answers refused, the
// same sum on a resync, a 13 s pause with the watchdog's resyncs, the answer after «Seguir» counts), «+30 s», a swap
// refused mid-game, a rejoin keeps team + gold + the open sum, a late joiner to the smaller team, «Terminar» →
// «¡FINAL!» → the ceremony (a second «Terminar» ignored), the end payloads, a reconnect after the end gets the card,
// «Saltar» after the end reaches the phones, «Otra ronda» = a clean game in the new style.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:3900';
// creating a room needs a teacher (2026-10-15): the teacher code of the server under test (--password or TEST_TEACHER_PW)
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
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
function count(s, ev, ms) {
  return new Promise((res) => {
    let n = 0;
    const h = () => { n++; };
    s.on(ev, h);
    setTimeout(() => { s.off(ev, h); res(n); }, ms);
  });
}
const solve = (q) => (q.ss.op === '+' ? q.ss.a + q.ss.b : q.ss.a - q.ss.b);
const idxOf = (n) => (n === 6 ? 0 : 1);
// the kid's open sum (waits for one if none)
async function sum(kid, ms) {
  if (kid.q) return kid.q;
  await next(kid.s, 'question', ms || 6000);
  return kid.q;
}
// answer the open sum; right = true/false; waits a human moment first (the too-fast line)
async function answer(kid, right, waitMs) {
  const q = await sum(kid);
  await sleep(waitMs == null ? 600 : waitMs);
  const val = solve(q);
  kid.q = null;
  const r = next(kid.s, 'answer-result', 4000);
  kid.s.emit('player:answer', { pin: kid.pin, qid: q.qid, choiceIdx: idxOf(right ? val : (val === 6 ? 7 : 6)) }, () => {});
  const res = await r;
  res._at = Date.now();
  return res;
}

(async () => {
  const host = connect();
  let feed = 0;
  host.on('ss:meter', (d) => { if (d && d.f && d.f.length) feed += d.f.length; });
  const { pin } = await ack(host, 'host:create', { gameType: 'sixseven', password: PASSWORD, style: 'zh' });
  ok(pin, 'room created');
  const s0 = next(host, 'state', 3000);
  host.emit('host:set-duration', { pin, duration: 120 });
  ok((await s0).ssStyle === 'zh', 'the style picked at create time (En Chino)');
  const s1 = next(host, 'state', 3000, (s) => s.ssStyle === 'num');
  host.emit('host:ss-style', { pin, style: 'num' });
  ok((await s1).ssStyle === 'num', 'the teacher switches to «Números» in the lobby');
  host.emit('host:ss-style', { pin, style: 'klingon' });
  ok((await next(host, 'state', 3000)).ssStyle === 'mix', 'an unknown style falls back to «Mezcla»');
  host.emit('host:ss-style', { pin, style: 'num' });
  await sleep(200);

  const kids = [];
  const mk = async (name) => {
    const s = connect();
    const j = await ack(s, 'player:join', { pin, name, avatar: '🐉' });
    const kid = { s, name, team: j.team, pin, q: null, init: null, ok: j.ok };
    s.on('ss:init', (d) => { kid.init = d; });
    s.on('question', (q) => { kid.q = q; });
    s.on('team-changed', (d) => { if (d && d.team) kid.team = d.team; });
    return kid;
  };
  for (let i = 0; i < 4; i++) { const k = await mk('Seis' + i); ok(k.ok, k.name + ' joined'); kids.push(k); }
  ok(kids.filter((k) => k.team === 'red').length === 2, 'the lobby splits 2 / 2');
  // a kid who leaves in the lobby: «Equilibrar equipos» splits only the kids still here, and the round leaves them out
  const gone = await mk('Adios');
  gone.s.disconnect();
  await sleep(400);
  let fair = 0;
  for (let i = 0; i < 3; i++) {
    host.emit('host:auto-balance', { pin });
    await sleep(250);
    if (kids.filter((k) => k.team === 'red').length === 2) fair++;
  }
  ok(fair === 3, '«Equilibrar equipos» splits only the kids still here: 2 / 2 every time');
  const lsP = next(host, 'state', 2000);
  host.emit('host:set-duration', { pin, duration: 120 });
  const ls = await lsP;
  ok(Object.values(ls.players).every((p) => p.k > 0 && typeof p.sk === 'string'), 'the projector knows every kid (id + character) from the lobby');

  // start → captains → countdown → the intro on every screen; «Saltar» in the intro → play now
  const capP = next(host, 'ss:captains', 3000);
  host.emit('host:start', { pin });
  const cap = await capP;
  ok(cap && cap.red && cap.gold && cap.red !== cap.gold, 'two captains of the gang');
  const hi = await next(host, 'ss:init', 6000);
  ok(hi.phase === 'intro' && hi.race.length === 4 && hi.roster.length === 4 && hi.style === 'num', 'the intro: the landmark race, the roster (the kid who left sits it out), the style');
  await sleep(300);
  ok(kids.every((k) => k.init && k.init.phase === 'intro' && k.init.you && k.init.you.team === k.team && k.init.you.coins === 0), 'every phone gets its own snapshot');
  ok(kids.every((k) => !k.q), 'no sum during the intro');
  await sleep(400);
  host.emit('host:ss-skip', { pin });
  const play = await next(host, 'ss:play', 1500);
  ok(play.endsMs > 110000 && play.endsMs <= 120000, `«Saltar» in the intro starts the play (${play.endsMs} ms)`);
  await sleep(400);
  ok(kids.every((k) => !!k.q), 'every kid got a sum when the play started');
  ok(kids.every((k) => k.q.gameMode === 'sixseven' && k.q.answers.join() === '6,7' && !k.q.ss.zh && /^\d+ [+−] \d+ = \?$/.test(k.q.text)), '«Números»: digit sums with the buttons 6 and 7');
  ok(kids.every((k) => { const v = solve(k.q); return v === 6 || v === 7; }), 'every answer is 6 or 7');

  // a swap mid-game is refused
  const st0 = await next(host, 'state', 3000).catch(() => null);
  const ids = st0 ? Object.keys(st0.players) : [];
  if (ids.length) {
    host.emit('host:swap-team', { pin, playerId: ids[0] });
    ok(await none(kids[0].s, 'team-changed', 700), 'no team swap mid-game');
  }

  // right answers: the streak and its coins, the next sum after the beat (one only)
  const A = kids[0];
  const r1 = await answer(A, true);
  ok(r1.correct && r1.sixseven.right && r1.sixseven.coins === 1 + r1.sixseven.goldExtra && r1.sixseven.streak === 1, 'right: 1 coin (+ a golden extra on a golden sum), streak 1');
  ok(/^(6 · liu|7 · qi)$/.test(r1.correctText), 'the verdict names the number in pinyin: ' + r1.correctText);
  const nq = await next(A.s, 'question', 3000);
  const gap = Date.now() - r1._at;
  ok(gap >= 380 && gap < 1400, `the next sum after the short beat (${gap} ms)`);
  ok(await none(A.s, 'question', 600), 'exactly one next sum');
  // an answer for the OLD sum (a late time-up, a re-sent tap) never judges the new one
  const quietRes = none(A.s, 'answer-result', 700);
  A.s.emit('player:answer', { pin, qid: r1.sixseven.qid, choiceIdx: -1 }, () => {});
  ok(await quietRes, 'an answer for an older sum is dropped (the open sum stays open)');
  A.q = nq;
  const r2 = await answer(A, true);
  const r3 = await answer(A, true);
  ok(r3.sixseven.streak === 3 && r3.sixseven.mult === 2 && r3.sixseven.coins === 2 + r3.sixseven.goldExtra, 'a streak of 3: ×2 coins');
  ok(r3.sixseven.total === r1.sixseven.coins + r2.sixseven.coins + r3.sixseven.coins, 'my running total adds up');

  // wrong answers: the wait, then «¡Respira!»
  const B = kids[1];
  const w1 = await answer(B, false);
  ok(!w1.correct && w1.sixseven.coins === 0 && w1.sixseven.wait === 1600 && !w1.sixseven.calm, 'wrong: no coins, a 1.6 s wait');
  ok(await none(B.s, 'question', 1300), 'no sum during the wait');
  await next(B.s, 'question', 2000);
  const w2 = await answer(B, false);
  ok(w2.sixseven.calm && w2.sixseven.wait === 2600, 'two wrong in a row: «¡Respira!» and a longer wait');
  ok(await none(B.s, 'question', 2200), 'the longer wait holds');
  await next(B.s, 'question', 2000);

  // a too-fast tap (right button, but nobody reads that fast) is wrong
  const C = kids[2];
  const fresh = next(C.s, 'question', 4000);
  await answer(C, true);                     // (its first sum has been open a while: answer it, then tap the next at once)
  const q0 = await fresh;
  C.q = null;
  const tfP = next(C.s, 'answer-result', 3000);
  C.s.emit('player:answer', { pin, qid: q0.qid, choiceIdx: idxOf(solve(q0)) }, () => {});
  const tf = await tfP;
  ok(!tf.correct && tf.sixseven.tooFast, 'a tap faster than anybody reads is wrong, even on the right number');
  ok(tf.sixseven.streak === 0, 'and it breaks the streak');

  // a mashed double tap: one verdict, at most one 'answer-stale'
  const qd = await sum(C, 4000);
  await sleep(600);
  C.q = null;
  const resN = count(C.s, 'answer-result', 1200), staleN = count(C.s, 'answer-stale', 1200);
  for (let i = 0; i < 5; i++) C.s.emit('player:answer', { pin, qid: qd.qid, choiceIdx: idxOf(solve(qd)) }, () => {});
  ok((await resN) === 1, 'five taps on one sum: one verdict');
  ok((await staleN) <= 1, 'and at most one «stale» reply (mashing can\'t make the server chatter)');

  // time up (the phone's clock ran out)
  const D = kids[3];
  const qt = await sum(D);
  D.q = null;
  const tuP = next(D.s, 'answer-result', 3000);
  D.s.emit('player:answer', { pin, qid: qt.qid, choiceIdx: -1 }, () => {});
  const tu = await tuP;
  ok(!tu.correct && tu.sixseven.timeUp, 'time up is a wrong answer');
  await sleep(700);
  ok(feed > 0, `the projector's feed names who scored (${feed} entries)`);

  // «Pausa»: answers refused (the sum stays open), a resync sends the same sum, a long pause, then the answer counts
  for (const k of kids) { if (!k.q) await sum(k, 4000).catch(() => {}); }
  const P = kids[0];
  const freshP = next(P.s, 'question', 4000);
  await answer(P, true);                     // (a fresh sum for the pause: an open sum with < 3 s left is not re-sent)
  const pq = await freshP;
  P.q = null;
  host.emit('host:pause', { pin, paused: true });
  ok((await next(P.s, 'ss:pause', 2000)).paused, 'the phones hear «Pausa»');
  const quiet = Promise.all(kids.slice(1).map((k) => none(k.s, 'question', 2500)));
  const stP = next(P.s, 'answer-stale', 2000);
  P.s.emit('player:answer', { pin, qid: pq.qid, choiceIdx: idxOf(solve(pq)) }, () => {});
  ok((await stP).reason === 'paused', 'an answer during the pause is handed back');
  for (let i = 0; i < 2; i++) {
    await sleep(6000);
    const rq = next(P.s, 'question', 2000);
    P.s.emit('player:resync', { pin });
    ok((await rq).qid === pq.qid, 'a resync in the pause sends the same open sum');
  }
  ok((await quiet).every(Boolean), 'no new sums while paused');
  host.emit('host:pause', { pin, paused: false });
  await next(P.s, 'ss:pause', 2000, (d) => !d.paused);
  await sleep(500);
  P.q = pq;
  const pr = await answer(P, true, 0);
  ok(pr.correct && !pr.sixseven.tooFast, 'after «Seguir» the open sum counts (the pause is no «too fast» trap)');

  // «+30 s»
  const tP = next(P.s, 'ss:time', 2000);
  host.emit('host:add-time', { pin, seconds: 30 });
  const tm = await tP;
  ok(tm.add === 30 && tm.endsMs > 120000, `«+30 s» moves the end (${tm.endsMs} ms left)`);

  // a rejoin keeps the team, the gold and the open sum
  const R0 = kids[0];
  const coinsBefore = pr.sixseven.total;
  const openQ = await sum(R0, 4000);
  R0.s.close();
  await sleep(500);
  const re = await mk(R0.name);
  ok(re.ok && re.team === R0.team, 'a rejoin keeps the team');
  await sleep(500);
  ok(re.init && re.init.you.coins === coinsBefore, `a rejoin keeps the gold (${coinsBefore})`);
  ok(re.q && re.q.qid === openQ.qid, 'a rejoin gets its open sum again');
  ok(re.q.ss.ms < openQ.ss.ms && re.q.ss.ms > 3000, `with the time it really has left on the server's clock (${re.q.ss.ms} ms)`);
  kids[0] = re;

  // a late joiner goes to the team with fewer connected kids, and plays at once
  kids[3].s.close();                         // Mar or Fuego now has one less connected kid
  await sleep(400);
  const lateTeam = kids[3].team;
  const L = await mk('Tarde');
  ok(L.ok && L.team === lateTeam, 'a late joiner goes to the smaller team');
  await sleep(1200);
  ok(L.init && L.init.phase === 'play' && L.init.you.coins === 0, 'the late joiner gets the game snapshot');
  ok(!!L.q, 'and a sum');

  // «Terminar»: «¡FINAL!», then the ceremony; a second «Terminar» is ignored
  host.on('ss:final', () => { host._finals = (host._finals || 0) + 1; });
  const finP = next(host, 'ss:final', 2000);
  host.emit('host:end-now', { pin });
  const fin = await finP;
  ok(fin.ms === 2400, '«Terminar» plays «¡FINAL!» first');
  host.emit('host:end-now', { pin });
  const endH = await next(host, 'game-end', 5000);
  ok(host._finals === 1, 'a second «Terminar» does not play «¡FINAL!» again');
  ok(endH.sixseven && endH.sixseven.totals && endH.winner === endH.sixseven.winner && endH.sixseven.style === 'num', 'the projector\'s end payload');
  ok(endH.teamScores.red === endH.sixseven.totals.r && endH.teamScores.gold === endH.sixseven.totals.g, 'teamScores = the gold');
  ok(Array.isArray(endH.sixseven.stars) && endH.sixseven.top.length >= 1, 'stars and the podium');

  // a phone that reconnects after the end gets its card
  const again = connect();
  const gE = next(again, 'game-end', 4000);
  const j2 = await ack(again, 'player:join', { pin, name: 'Seis1' });
  ok(j2.ok && j2.gameState === 'ended', 'a reconnect after the end is accepted');
  const card = await gE;
  ok(card.me && card.me.team === kids[1].team && typeof card.me.coins === 'number', 'and gets its own card');
  // «Saltar» after the end reaches the phones
  const skP = next(again, 'ss:skip', 2000);
  host.emit('host:ss-skip', { pin });
  ok(!!(await skP), '«Saltar» on the ceremony jumps every phone to its card');

  // «Otra ronda»: a clean game, now En Chino
  host.emit('host:reset', { pin });
  await next(host, 'state', 2000, (s) => s.state === 'lobby');
  host.emit('host:ss-style', { pin, style: 'zh' });
  await sleep(300);
  const reInit = next(again, 'ss:init', 9000);
  host.emit('host:start', { pin });
  const ri = await reInit;
  ok(ri.id !== hi.id && ri.you.coins === 0 && ri.style === 'zh', '«Otra ronda»: a new game, fresh gold, the new style');
  host.emit('host:ss-skip', { pin });
  const zq = await next(again, 'question', 4000);
  ok(zq.ss.zh && /^[a-z]+ [+−] [a-z]+ = \?$/.test(zq.text), '«En Chino»: pinyin sums (' + zq.text + ')');

  host.emit('host:end-now', { pin });
  await sleep(300);
  [host, again, L.s].concat(kids.map((k) => k.s)).forEach((s) => s.close());
  console.log(`test-sixseven-live: ${checks} checks passed`);
  process.exit(0);
})();
