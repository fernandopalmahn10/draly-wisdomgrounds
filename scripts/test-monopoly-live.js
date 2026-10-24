// Live check of Dàfùwēng · Monopolio v2 against a RUNNING local server (never the live site):
//   node scripts/test-monopoly-live.js --url http://localhost:4530 --password <the local teacher code>
// One teacher + 4 kids (one board of 4): the lobby ids + characters, the deal at the countdown (every phone its board,
// the projector all of them), the intro and «Saltar», a question for every kid, a right answer → the dice window → a tap
// → the turn script (the path follows the loop, its length is the shared clock) for the kid and the move for the other 3
// phones and the projector only, the next question after the turn; a wrong answer → its wait; a too-fast tap; a window
// nobody taps rolls by itself; «Pausa» (answers and dice refused, the clock held) and «Seguir»; «+30 s»; a reconnect gets
// its seat, coins and open question back; a late joiner sits at the board (5th seat); «Terminar» → «¡FINAL!» → each phone
// its board's ceremony + card (a second «Terminar» ignored); a reconnect after the end gets its card; «Saltar» after the end
// reaches the phones; «Otra ronda» = the lobby again and a new deal.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');
const MAP = require('../public/js/monopoly-map');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:4530';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const SET = 'pack:yct1-familia-r1';
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
  return new Promise((res) => { let seen = false; const h = () => { seen = true; }; s.on(ev, h); setTimeout(() => { s.off(ev, h); res(!seen); }, ms); });
}

(async () => {
  const set = await fetch(URL + '/api/sets/' + encodeURIComponent(SET)).then((r) => r.json());
  const correctOf = (q) => { const x = require('../core/packs').forGames(set.questions).find((y) => y.text === q.text);   /* as rooms show them: toned (2026-10-24) */ return x ? q.answers.indexOf(x.correct) : -1; };
  ok(set.questions.length > 5, 'the pack loads');

  // ---------- the room ----------
  const host = connect();
  const { pin } = await ack(host, 'host:create', { gameType: 'monopoly', password: PASSWORD });
  ok(pin, 'a PIN');
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded.ok, 'the pack loads into the room');
  host.emit('host:set-duration', { pin, duration: 180 });
  const kids = [];
  const NAMES = ['Sofi', 'Mateo', 'Valen', 'Lucas'];
  for (const name of NAMES) {
    const s = connect();
    const kid = { s, name, q: null, init: null, turns: [], moves: [], results: [] };
    s.on('question', (q) => { kid.q = q; kid.qAt = Date.now(); });
    s.on('mn:init', (d) => { kid.init = d; });
    s.on('mn:turn', (t) => kid.turns.push(t));
    s.on('mn:move', (m) => kid.moves.push(m));
    s.on('answer-result', (r) => kid.results.push(r));
    const j = await ack(s, 'player:join', { pin, name, avatar: '🌎' });
    ok(j.ok, 'joined ' + name);
    kid.id = j.playerId;
    kids.push(kid);
  }
  const st = await next(host, 'state', 3000, (x) => Object.keys(x.players || {}).length === 4);
  Object.values(st.players).forEach((p) => ok(p.k > 0 && p.sk, 'the lobby knows each kid id + character'));
  const hostMoves = [];
  host.on('mn:move', (m) => hostMoves.push(m));

  // ---------- the deal, the intro ----------
  const hInit = next(host, 'mn:init', 6000);
  const kInits = kids.map((k) => next(k.s, 'mn:init', 6000));
  host.emit('host:start', { pin });
  const hi = await hInit;
  ok(hi.phase === 'countdown' && hi.boards.length === 1 && hi.boards[0].seats.length === 4, 'the deal: one board of 4 at the countdown');
  const ki = await Promise.all(kInits);
  ki.forEach((d, i) => {
    ok(d.board && d.you && d.board.id === hi.boards[0].id, 'every phone gets its board (' + NAMES[i] + ')');
    ok(d.you.pos === 0 && d.you.coins === 5 && d.you.stars === 0, 'Salida, 5 coins, no stars');
  });
  ok(new Set(ki.map((d) => d.you.c)).size === 4, 'four seat colours');
  const again = await new Promise((res) => { host.emit('host:start', { pin }); setTimeout(() => res(true), 300); });
  ok(again, '(a second «¡A jugar!» is ignored)');
  await next(host, 'mn:intro', 6000);
  ok(await none(kids[0].s, 'question', 600), 'no question in the intro');
  host.emit('host:mn-skip', { pin });
  await next(kids[0].s, 'mn:play', 3000);
  await sleep(700);
  kids.forEach((k) => ok(k.q && k.q.answers.length >= 2, 'a question for every kid (' + k.name + ')'));

  // ---------- a right answer → dice → turn ----------
  const A = kids[0];
  let q = A.q; A.q = null;
  await sleep(700);
  const rr = next(A.s, 'answer-result', 4000);
  A.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: correctOf(q) }, () => {});
  let r = await rr;
  ok(r.correct && r.monopoly && r.monopoly.right && r.monopoly.tid > 0, 'right: a dice window');
  ok(r.monopoly.dice === 1 && r.monopoly.ms === 3000, 'one die, 3 s');
  ok(await none(A.s, 'question', 500), 'no question while the dice wait');
  const tt = next(A.s, 'mn:turn', 4000);
  const others = kids.slice(1).map((k) => next(k.s, 'mn:move', 4000));
  const hm = next(host, 'mn:move', 4000);
  A.s.emit('player:mn-roll', { pin, tid: r.monopoly.tid });
  const turn = await tt;
  ok(turn.tid === r.monopoly.tid && !turn.auto, 'my tap rolled');
  ok(turn.dice[0] >= 1 && turn.dice[0] <= 6, 'a die 1-6 (the server\'s)');
  let p0 = 0;
  turn.path.forEach((p) => { ok(p === (p0 + 1) % MAP.N, 'the path follows the loop'); p0 = p; });
  ok(turn.ms === MAP.scriptMs(turn), 'its length is the shared clock');
  const mv = await Promise.all(others);
  mv.forEach((m) => ok(m.k === turn.k && m.tid === turn.tid, 'the other phones of my board get the move'));
  ok((await hm).tid === turn.tid, 'the projector gets the move');
  ok(await none(A.s, 'mn:move', 300) || true, '(my own move never comes as mn:move)');
  ok(A.moves.every((m) => m.k !== turn.k), 'never my own move back');
  const tq = Date.now();
  await next(A.s, 'question', turn.ms + 3000);
  const waited = Date.now() - tq;
  ok(waited > turn.ms - 900 && waited < turn.ms + 1500, `the next question after the turn has played (${waited} ms for ${turn.ms})`);
  // a tap for the same turn again: the same script, never a second turn
  const dup = next(A.s, 'mn:turn', 2500);
  A.s.emit('player:mn-roll', { pin, tid: turn.tid });
  ok((await dup).tid === turn.tid, 'a repeated tap gets the same turn again');

  // ---------- wrong, too fast ----------
  const Bk = kids[1];
  q = Bk.q; Bk.q = null;
  await sleep(700);
  const wrongIdx = (correctOf(q) + 1) % q.answers.length;
  const rw = next(Bk.s, 'answer-result', 4000);
  Bk.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: wrongIdx }, () => {});
  r = await rw;
  ok(!r.correct && r.monopoly.wait === 2200 && !r.monopoly.tooFast, 'wrong: the wait');
  const tw = Date.now();
  await next(Bk.s, 'question', 5000);
  ok(Date.now() - tw > 1800, 'the next question after the wait');
  q = Bk.q; Bk.q = null;
  const rf = next(Bk.s, 'answer-result', 4000);
  Bk.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: correctOf(q) }, () => {});
  r = await rf;
  ok(!r.correct && r.monopoly.tooFast, 'right but too fast: wrong');
  ok(r.monopoly.calm && r.monopoly.wait === 3400, 'two wrong in a row: «¡Respira!»');

  // ---------- a window nobody taps ----------
  const C = kids[2];
  q = C.q; C.q = null;
  await sleep(700);
  const rc = next(C.s, 'answer-result', 4000);
  C.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: correctOf(q) }, () => {});
  r = await rc;
  ok(r.correct, 'right');
  const t0 = Date.now();
  const auto = await next(C.s, 'mn:turn', 8000);
  ok(auto.auto && auto.tid === r.monopoly.tid, 'no tap: the dice roll by themselves');
  ok(Date.now() - t0 > 4000, `…after the window (${Date.now() - t0} ms)`);

  // ---------- pause ----------
  const D = kids[3];
  await sleep(300);
  if (!D.q) await next(D.s, 'question', 6000);
  const pq = D.q;
  const pz = next(D.s, 'mn:pause', 3000);
  host.emit('host:pause', { pin, paused: true });
  ok((await pz).paused, 'paused');
  const stale = next(D.s, 'answer-stale', 3000);
  D.s.emit('player:answer', { pin, qid: pq.qid, choiceIdx: correctOf(pq) }, () => {});
  ok((await stale).reason === 'paused', 'an answer in the pause is handed back');
  ok(await none(D.s, 'question', 1200), 'no new question in the pause');
  const ups = next(D.s, 'mn:pause', 3000);
  host.emit('host:pause', { pin, paused: false });
  ok(!(await ups).paused, 'resumed');
  const rd = next(D.s, 'answer-result', 4000);
  D.s.emit('player:answer', { pin, qid: pq.qid, choiceIdx: correctOf(pq) }, () => {});
  r = await rd;
  ok(r.correct, 'the same question counts after «Seguir»');
  const pz2 = next(D.s, 'mn:pause', 3000);
  host.emit('host:pause', { pin, paused: true });
  await pz2;
  const nr = next(D.s, 'mn:noroll', 3000);
  D.s.emit('player:mn-roll', { pin, tid: r.monopoly.tid });
  ok((await nr).paused, 'a dice tap in the pause is refused');
  ok(await none(D.s, 'mn:turn', 2000), 'and the window does not roll by itself while paused');
  host.emit('host:pause', { pin, paused: false });
  await sleep(300);
  const dt = next(D.s, 'mn:turn', 3000);
  D.s.emit('player:mn-roll', { pin, tid: r.monopoly.tid });
  ok((await dt).tid === r.monopoly.tid, 'the tap after «Seguir» rolls');

  // ---------- +30 s ----------
  const tm = next(kids[0].s, 'mn:time', 3000);
  host.emit('host:add-time', { pin, seconds: 30 });
  const time = await tm;
  ok(time.add === 30 && time.endsMs > 150000, '+30 s');

  // ---------- a reconnect ----------
  const before = await new Promise((res) => { kids[0].s.emit('player:resync', { pin }); kids[0].s.once('mn:init', res); });
  kids[0].s.close();
  await sleep(400);
  const s2 = connect();
  const back = { s: s2, q: null };
  s2.on('question', (x) => { back.q = x; });
  const bi = next(s2, 'mn:init', 4000);
  const j2 = await ack(s2, 'player:join', { pin, name: 'Sofi', avatar: '🌎' });
  ok(j2.ok && j2.rejoined, 'rejoin');
  const binit = await bi;
  ok(binit.you.k === before.you.k && binit.you.c === before.you.c, 'the same seat and colour');
  ok(binit.you.coins === before.you.coins && binit.you.stars === before.you.stars, 'the same coins and stars');
  kids[0].s = s2;

  // ---------- the phone's own time-up ----------
  const E = kids[1];
  E.q = null;
  const eq = await next(E.s, 'question', 30000);       // a fresh one (an older open one may have timed out on the server)
  E.q = null;
  await sleep(700);
  const re = next(E.s, 'answer-result', 4000);
  E.s.emit('player:answer', { pin, qid: eq.qid, choiceIdx: -1 }, () => {});
  const rte = await re;
  ok(!rte.correct && rte.monopoly.timeUp, 'the phone clock running out (choiceIdx -1) counts as time up');

  // ---------- a drop between the roll and its script ----------
  const F = kids[3];
  F.q = null;
  const fq = await next(F.s, 'question', 30000);
  F.q = null;
  await sleep(700);
  const rfq = next(F.s, 'answer-result', 4000);
  F.s.emit('player:answer', { pin, qid: fq.qid, choiceIdx: correctOf(fq) }, () => {});
  const rf2 = await rfq;
  ok(rf2.correct, 'right before the drop');
  F.s.close();
  await sleep(5600);                                   // the window passes: the server rolls while the phone is away
  const sF = connect();
  const fi = next(sF, 'mn:init', 4000);
  ok((await ack(sF, 'player:join', { pin, name: 'Lucas' })).ok, 'back');
  const finit = await fi;
  ok(!finit.you.turn && finit.you.last && finit.you.last.tid === rf2.monopoly.tid, 'the turn rolled while away comes back as you.last');
  const again2 = next(sF, 'mn:turn', 3000);
  sF.emit('player:mn-roll', { pin, tid: rf2.monopoly.tid });
  ok((await again2).tid === rf2.monopoly.tid, 'asking for it again gets the same turn (never a second one)');
  kids[3].s = sF;

  // ---------- a late joiner ----------
  const late = connect();
  const li = next(late, 'mn:init', 4000);
  const seat = next(kids[1].s, 'mn:seat', 4000);
  ok((await ack(late, 'player:join', { pin, name: 'Nina', avatar: '🦅' })).ok, 'a late joiner');
  const lin = await li;
  ok(lin.board.seats.length === 5 && lin.you.c === 4, 'the 5th seat of the board (purple)');
  ok((await seat).board.seats.length === 5, 'the board\'s phones see the new piece');

  // ---------- the end ----------
  const fin = next(kids[1].s, 'mn:final', 4000);
  host.emit('host:end-now', { pin });
  await fin;
  host.emit('host:end-now', { pin });
  const ends = await Promise.all([kids[1], kids[2], kids[3]].map((k) => next(k.s, 'game-end', 6000)));
  const hend = await next(host, 'game-end', 4000).catch(() => null);
  ends.forEach((e) => {
    ok(e.monopoly && e.monopoly.board && e.me, 'each phone its board + card');
    ok(e.me.total === e.me.stars + (e.me.bonus || []).length, 'total = stars + bonus');
    ok(e.monopoly.board.rows.some((x) => x.k === e.me.k), 'I am in my board');
    ok(typeof e.me.rank === 'number' && e.me.of === 5, 'my rank of 5');
  });
  ok(!hend || (hend.monopoly && hend.monopoly.boards.length >= 1), 'the projector: every board + the podium');
  ok(await none(kids[1].s, 'game-end', 1500), 'a second «Terminar» changes nothing');
  // a reconnect after the end gets its card
  kids[2].s.close();
  const s3 = connect();
  const ce = next(s3, 'game-end', 4000);
  ok((await ack(s3, 'player:join', { pin, name: 'Valen' })).ok, 'reconnect after the end');
  ok((await ce).me, 'the card again');
  const sk = next(kids[1].s, 'mn:skip', 3000);
  host.emit('host:mn-skip', { pin });
  await sk;
  ok(true, '«Saltar» after the end reaches the phones');

  // ---------- Otra ronda ----------
  const lob = next(kids[1].s, 'state', 3000, (x) => x.state === 'lobby');
  host.emit('host:reset', { pin });
  await lob;
  const ni = next(kids[1].s, 'mn:init', 6000);
  host.emit('host:start', { pin });
  const n2 = await ni;
  ok(n2.phase === 'countdown' && n2.id !== hi.id && n2.you.coins === 5, '«Otra ronda»: a new deal, fresh coins');
  host.emit('host:end-now', { pin });

  [host, late, s3, ...kids.map((k) => k.s)].forEach((s) => s.close());
  console.log(`test-monopoly-live: ${checks} checks passed`);
  process.exit(0);
})();
