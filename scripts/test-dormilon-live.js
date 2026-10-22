// Live check of «¡No despiertes a Dralingo!» against a RUNNING local server (never the live site):
//   node scripts/test-dormilon-live.js --url http://localhost:3500 --password <teacher code>
// One teacher + 4 kids (one board of 4): the deal at «Empezar», «Saltar» in the intro, «Turno de…» + the watchers'
// guesses, only the turn kid gets the question with its buttons (the others a copy, never the right answer), strokes and
// stirs reach the whole board, pause holds everything (answers refused, the clock stands still), «¡Me retiro!», a kid
// whose phone drops on its turn is skipped and comes back to its seat and points, «+30 s» / «−30 s», «Terminar» →
// «¡FINAL!» → each phone its board's ceremony payload, a projector that reconnects after the end gets its show again,
// «Otra ronda» starts a clean game.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:3500';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
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
// the right answer must never reach a phone before it is answered (only a miss reveals it, after the answer)
const leaks = [];
function guard(s, who) {
  s.onAny((ev, d) => {
    if ((ev === 'dm:q' || ev === 'dm:bq') && d && ('correctIdx' in d || 'correct' in d)) leaks.push(who + ': ' + ev + ' with the answer');
    if (ev === 'dm:init' && d && ((d.q && 'correctIdx' in d.q) || (d.board && ('limit' in d.board || 'danger' in d.board)))) leaks.push(who + ': dm:init leaks');
    if (/^dm:/.test(ev) && d && ('limit' in d || 'danger' in d)) leaks.push(who + ': ' + ev + ' carries the limit');
  });
}

(async () => {
  const host = connect();
  guard(host, 'host');
  const { pin, hostToken } = await ack(host, 'host:create', { gameType: 'dormilon', password: PASSWORD });
  ok(pin, 'room created');
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded && loaded.ok, 'pack loaded');
  host.emit('host:set-duration', { pin, duration: 180 });
  const kids = [];
  for (let i = 0; i < 4; i++) {
    const s = connect();
    const name = 'Dorm' + i;
    const j = await ack(s, 'player:join', { pin, name, avatar: '🐉' });
    ok(j && j.ok, name + ' joined');
    kids.push({ s, name, init: null, code: j.studentCode });
    s.on('dm:init', (d) => { kids[i].init = d; });
    guard(s, name);
  }
  const byK = (k) => kids.find((x) => x.init && x.init.you && x.init.you.k === k);

  // start: one board of 4, dealt at «Empezar»
  host.emit('host:start', { pin });
  const hi = await next(host, 'dm:init', 3000);
  ok(hi.phase === 'countdown' && hi.boards.length === 1 && hi.boards[0].seats.length === 4, '4 kids = one board of 4, dealt at «Empezar»');
  await sleep(200);
  ok(kids.every((x) => x.init && x.init.board && x.init.you), 'every phone got its own board and seat');
  await next(host, 'dm:intro', 6000);
  await sleep(400);
  const playP = next(host, 'dm:play', 3000);
  const preP = next(host, 'dm:pre', 4000);
  host.emit('host:dm-skip', { pin });                                  // «Saltar» in the intro → play at once
  await playP;
  const pre = await preP;
  ok(pre.guided && pre.k === hi.boards[0].seats[0].k, 'the first seat plays first, a guided turn');
  const turnKid = byK(pre.k);
  const watchers = kids.filter((x) => x !== turnKid);

  // a guided first turn never wakes him: no guess then (the friends watch how it is played)
  const gnoP = next(watchers[0].s, 'dm:guess-no', 1500);
  watchers[0].s.emit('player:dm-guess', { pin, g: 'sleep' });
  await gnoP;
  ok(true, 'no guess on a guided first turn');

  // the turn: only the turn kid gets the question
  const goP = next(host, 'dm:go', 5000);
  const qP = next(turnKid.s, 'dm:q', 6000);
  const bqP = next(watchers[1].s, 'dm:bq', 6000);
  const go = await goP;
  ok(go.k === pre.k && go.ms === 14000, 'the guided turn lasts 14 s');
  const q = await qP;
  const bq = await bqP;
  ok(q.qid && q.answers.length >= 2 && bq.text === q.text && !('qid' in bq), 'the turn kid gets the question; the board a copy without buttons');

  // pause holds everything
  const pauseP = next(host, 'dm:pause', 2000);
  host.emit('host:pause', { pin, paused: true });
  const pz = await pauseP;
  ok(pz.paused, 'paused');
  const nopeP = next(turnKid.s, 'dm:nope', 2000);
  await sleep(350);
  turnKid.s.emit('player:dm-answer', { pin, qid: q.qid, idx: 0 });
  const nope = await nopeP;
  ok(nope.why === 'closed', 'an answer during the pause is refused');
  const ends1 = pz.endsMs;
  await sleep(1200);
  const resumeP = next(host, 'dm:pause', 2000);
  host.emit('host:pause', { pin, paused: false });
  const rz = await resumeP;
  ok(!rz.paused && Math.abs(rz.endsMs - ends1) < 600, 'the clock stood still during the pause');

  // the open question is still the same: answer it (right = a stroke, wrong = a stir), the board hears it
  const resP = Promise.race([next(watchers[2].s, 'dm:pat', 3000), next(watchers[2].s, 'dm:miss', 3000)]);
  turnKid.s.emit('player:dm-answer', { pin, qid: q.qid, idx: 0 });
  const res = await resP;
  ok(res.k === pre.k && (res.pts === 1 || res.correctIdx >= 0), 'the stroke / stir reaches the board');
  // a second answer to the same question is ignored
  const nope2P = next(turnKid.s, 'dm:nope', 2000);
  turnKid.s.emit('player:dm-answer', { pin, qid: q.qid, idx: 1 });
  ok((await nope2P).why !== undefined, 'the same question never counts twice');
  // the next question, then «¡Me retiro!»
  const q2 = await next(turnKid.s, 'dm:q', 3000);
  ok(q2.qid !== q.qid, 'the next question follows');
  const endP = next(host, 'dm:end', 3000);
  turnKid.s.emit('player:dm-stop', { pin });
  const end = await endP;
  ok(end.why === 'stop' && end.k === pre.k, '«¡Me retiro!» ends the turn safely');
  ok(Array.isArray(end.guess) && end.pts != null, 'the turn ends with its guesses and its points');

  // the next kid's phone drops during «Turno de…»: skipped after a short wait, then back to its seat
  const pre2 = await next(host, 'dm:pre', 4000);
  const dropKid = byK(pre2.k);
  ok(dropKid && dropKid !== turnKid, 'the next seat plays next');
  const keptK = dropKid.init.you.k;
  dropKid.s.disconnect();
  const sk = await next(host, 'dm:skip', 8000).catch(() => null);
  const go2 = sk ? null : await next(host, 'dm:go', 1).catch(() => null);
  ok(sk || go2, 'a dropped kid: the turn is skipped (or had already started)');
  const back = connect();
  guard(back, 'back');
  let backInit = null;
  back.on('dm:init', (d) => { backInit = d; });
  const rj = await ack(back, 'player:join', { pin, name: dropKid.name, avatar: '🐉', studentCode: dropKid.code });
  ok(rj && rj.ok, 'the dropped kid rejoins');
  await sleep(600);
  ok(backInit && backInit.you && backInit.you.k === keptK, 'a rejoin keeps the seat (same key)');
  dropKid.s = back;

  // the teacher's clock
  const tP = next(host, 'dm:time', 2000);
  host.emit('host:add-time', { pin, seconds: 30 });
  const t1 = await tP;
  ok(t1.add === 30, '«+30 s» adds 30 s');
  const t2P = next(host, 'dm:time', 2000);
  host.emit('host:add-time', { pin, seconds: -30 });
  const t2 = await t2P;
  ok(t2.add === -30, '«−30 s» takes 30 s');

  // «Terminar» → «¡FINAL!» → the ceremony
  const finP = next(host, 'dm:final', 3000);
  const endHostP = next(host, 'game-end', 6000);
  const endKids = kids.map((x) => next(x.s, 'game-end', 7000));
  host.emit('host:end-now', { pin });
  const fin = await finP;
  ok(fin.ms === 2400, '«¡FINAL!» first');
  ok(await none(host, 'dm:final', 600), '«¡FINAL!» once');
  host.emit('host:end-now', { pin });                                    // a second «Terminar» during «¡FINAL!»: ignored
  const he = await endHostP;
  ok(he.dormilon && he.dormilon.boards.length === 1 && Array.isArray(he.dormilon.podium), 'the projector gets every board + the podium');
  const ke = await Promise.all(endKids);
  ke.forEach((d, i) => ok(d.me && d.dormilon && d.dormilon.board && d.dormilon.board.rows.some((r) => r.k === d.me.k), `kid ${i} gets its board and its card`));
  ok(ke.every((d) => d.me.of === 4 && d.me.classOf === 4), 'places in the board and the class');

  // the projector drops after the end: its show again
  host.disconnect();
  const host2 = connect();
  const geP = next(host2, 'game-end', 4000);
  const rc = await ack(host2, 'host:reclaim', { pin, hostToken, password: PASSWORD });
  ok(rc && rc.ok !== false, 'the projector reclaims its room');
  const ge2 = await geP;
  ok(ge2.dormilon && ge2.dormilon.boards.length === 1, 'the reconnected projector gets its show again');

  // «Otra ronda»: a clean game
  host2.emit('host:reset', { pin });
  await sleep(500);
  const hi2P = next(host2, 'dm:init', 4000);
  host2.emit('host:start', { pin });
  const hi2 = await hi2P;
  ok(hi2.phase === 'countdown' && hi2.id !== hi.id && hi2.boards[0].seats.every((x) => x.score === 0), '«Otra ronda» deals a clean game');
  host2.emit('host:end-now', { pin });

  ok(!leaks.length, 'no right answer or limit ever reached a screen: ' + leaks.join(', '));
  [host2, back].concat(kids.map((x) => x.s)).forEach((s) => { try { s.disconnect(); } catch (_) {} });
  console.log(`test-dormilon-live: ${checks} checks OK (${URL}, PIN ${pin})`);
  process.exit(0);
})().catch((e) => { console.error('test-dormilon-live FAILED:', e.message); process.exit(1); });
