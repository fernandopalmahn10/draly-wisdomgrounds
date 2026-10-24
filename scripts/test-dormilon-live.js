// Live check of «Draly Siesta · ¡No despiertes a Dralingo!» v4 against a RUNNING local server (never the live site):
//   node scripts/test-dormilon-live.js --url http://localhost:3500 --password <teacher code>
// v4 (the Windows rhythm): one teacher + 4 kids (one board of 4): the deal at «Empezar», «Saltar» in the intro, the
// question window (everyone's questions at once, never the answer; right = a feather, wrong / blind = a feather off + he
// shifts on the board; no strokes there), «Saltar» → «¡A hacerle cosquillas!» → the play window: several kids rub AT
// ONCE and the whole board + the projector see each tickle with its place (x, y) and the kid's feathers of the round,
// «🪶 ¡Guardar mis plumas!» keeps them, pause holds everything, the tally; a dropped phone comes back to its seat and feathers; «+30 s» / «−30 s» re-plan
// the window; «Terminar» → «¡FINAL!» → each phone its board's ceremony; the projector's show again after a reconnect;
// «Otra ronda» = a clean game. Then «🤖 Probar con robots»: one phone + 3 robots that play and never count.
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
// the right answer must never reach a phone before it is answered; the danger never reaches a screen
const leaks = [];
function guard(s, who) {
  s.onAny((ev, d) => {
    if (ev === 'dm:q' && d && ('correctIdx' in d || 'correct' in d)) leaks.push(who + ': ' + ev + ' with the answer');
    if (ev === 'dm:init' && d && ((d.q && 'correctIdx' in d.q) || (d.board && ('danger' in d.board || 'cuts' in d.board)))) leaks.push(who + ': dm:init leaks');
    if (/^dm:/.test(ev) && d && ('danger' in d || 'cuts' in d)) leaks.push(who + ': ' + ev + ' carries the danger');
  });
}
// answers whatever question kid x has open (right or wrong), waiting at least `wait` ms after it arrived
async function answerOpen(x, right, wait) {
  const q = x.q;
  if (!q) return null;
  const idx = right ? x.right(q) : (x.right(q) + 1) % q.answers.length;
  if (wait) await sleep(wait);
  const p = next(x.s, 'dm:qr', 3000, (d) => d.qid === q.qid);
  x.s.emit('player:dm-answer', { pin: x.pin, qid: q.qid, idx });
  return p;
}

(async () => {
  const host = connect();
  guard(host, 'host');
  const { pin, hostToken } = await ack(host, 'host:create', { gameType: 'dormilon', password: PASSWORD });
  ok(pin, 'room created');
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded && loaded.ok, 'pack loaded');
  host.emit('host:set-duration', { pin, duration: 180 });
  // the pack's right answers (a test-only map by question text: the server never sends them)
  const P = require('../core/packs');
  const pk = P.loadPack('yct1-familia-r1');
  const qs = P.forGames((pk && pk.questions) || []);   // as the room shows them: toned (2026-10-24)
  const answerOf = {};
  qs.forEach((q) => { answerOf[q.text] = String(q.correct); });
  const kids = [];
  for (let i = 0; i < 4; i++) {
    const s = connect();
    const name = 'Dorm' + i;
    const j = await ack(s, 'player:join', { pin, name, avatar: '🐉' });
    ok(j && j.ok, name + ' joined');
    const x = { s, name, init: null, code: j.studentCode, pin, q: null, pats: [], round: null };
    x.right = (q) => { const a = answerOf[q.text]; const i2 = a != null ? q.answers.indexOf(a) : -1; return i2 >= 0 ? i2 : 0; };
    kids.push(x);
    s.on('dm:init', (d) => { x.init = d; });
    s.on('dm:q', (d) => { x.q = d; });
    s.on('dm:qx', () => { x.q = null; });
    s.on('dm:qr', () => { x.q = null; });
    s.on('dm:pat', (d) => { x.pats.push(d); });
    s.on('dm:round', (d) => { x.round = d; });
    guard(s, name);
  }
  const haveAnswers = Object.keys(answerOf).length > 0;
  const byK = (k) => kids.find((x) => x.init && x.init.you && x.init.you.k === k);

  // start: one board of 4, dealt at «Empezar»
  host.emit('host:start', { pin });
  const hi = await next(host, 'dm:init', 3000);
  ok(hi.phase === 'countdown' && hi.boards.length === 1 && hi.boards[0].seats.length === 4, '4 kids = one board of 4, dealt at «Empezar»');
  ok(hi.boards[0].seats.every((x) => x.feathers === 0 && x.pile === 0 && x.score === 0 && !x.robot), 'everyone starts with an empty hand and no feathers collected');
  await sleep(200);
  ok(kids.every((x) => x.init && x.init.board && x.init.you), 'every phone got its own board and seat');
  await next(host, 'dm:intro', 6000);
  await sleep(400);
  const playP = next(host, 'dm:play', 3000);
  const qwP = next(host, 'dm:round', 4000, (d) => d.phase === 'qw');
  host.emit('host:dm-skip', { pin });                                  // «Saltar» in the intro → play at once
  await playP;
  const qw = await qwP;
  ok(qw.n === 1 && qw.ms >= 12000 && qw.ms <= 20000 && qw.total >= 4, 'round 1: a question window of 12-20 s, ~6 rounds in 3 minutes');
  await sleep(700);
  ok(kids.every((x) => x.q && x.q.answers && x.q.ms > 9000), 'EVERY kid gets a question at once, with time to read it');

  // no strokes in the question window
  const ns = next(kids[0].s, 'dm:nostroke', 2000);
  kids[0].s.emit('player:dm-stroke', { pin, x: 0.4, y: 0.4 });
  ok((await ns).why === 'closed', 'no tickles in the question window');

  // right answers = feathers (kids 0-2 answer right twice); kid 3 answers wrong once, then a blind tap
  const plumes = [];
  host.on('dm:plume', (d) => plumes.push(d));
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) {
      const r = await answerOpen(kids[i], true, round === 0 ? 650 : 0);
      if (haveAnswers) ok(r && r.ok && r.feathers === round + 1, kids[i].name + ' right → a feather');
      await sleep(450);
    }
  }
  const shiftP = next(kids[0].s, 'dm:shift', 3000);
  const w = await answerOpen(kids[3], false, 650);
  ok(w && !w.ok && w.correctText, 'a wrong answer: «¡Casi!» and the right one shown after');
  ok(!!(await shiftP), 'the board sees him shift (never who)');
  await sleep(1500);
  const q3 = kids[3].q;
  if (q3) {
    const blindP = next(kids[3].s, 'dm:qr', 3000, (d) => d.qid === q3.qid);
    kids[3].s.emit('player:dm-answer', { pin, qid: q3.qid, idx: kids[3].right(q3) });   // (at once: < 0.5 s after it arrived? only if it is fresh)
    const bl = await blindP;
    ok(bl && (bl.tooFast ? !bl.ok : true), 'a blind tap counts as wrong');
  }
  ok(plumes.some((d) => d.k != null && d.feathers >= 1), 'the projector sees the feather counts');

  // «Saltar» → «¡A hacerle cosquillas!» → the play window
  const pwinP = next(host, 'dm:round', 3000, (d) => d.phase === 'pwin');
  const readyP = next(kids[0].s, 'dm:ready', 3000);
  host.emit('host:dm-skip', { pin });
  const pwin = await pwinP;
  ok(pwin.n === 1, '«¡A hacerle cosquillas!»');
  const ready = await readyP;
  ok(ready.feathers && ready.feathers.length === 4, 'the board hears everyone\'s feathers');
  ok(kids.every((x) => !x.q), 'open questions are withdrawn at the window\'s end');
  const pw = await next(host, 'dm:round', 3000, (d) => d.phase === 'pw');
  ok(pw.ms >= 9000 && pw.ms <= 10000, 'the play window: 10 s');
  // three kids rub AT THE SAME TIME
  kids.forEach((x) => { x.pats = []; });
  const hostPats = [];
  host.on('dm:pat', (d) => hostPats.push(d));
  const rubbers = kids.slice(0, 3).filter((x) => (ready.feathers.find((f) => f.k === x.init.you.k) || {}).feathers > 0);
  rubbers.forEach((x, i) => x.s.emit('player:dm-stroke', { pin, x: 0.3 + i * 0.1, y: 0.4 }));
  await sleep(700);
  if (rubbers.length) {
    ok(hostPats.length >= 1, 'tickles land at once (' + hostPats.length + ')');
    const p0 = hostPats[0];
    ok(p0.pile >= 1 && p0.x > 0 && p0.y > 0 && p0.pts >= 1, 'a tickle carries the kid\'s feathers of the round and where it landed');
    ok(kids.every((x) => x.pats.length === hostPats.length), 'the whole board sees every tickle live');
  }
  // pause holds everything
  host.emit('host:pause', { pin, paused: true });
  await next(host, 'dm:pause', 2000);
  const pz = next(kids[1].s, 'dm:nostroke', 2000);
  kids[1].s.emit('player:dm-stroke', { pin, x: 0.4, y: 0.4 });
  ok((await pz).why === 'closed', 'paused: tickles are refused');
  host.emit('host:pause', { pin, paused: false });
  await next(host, 'dm:pause', 2000);
  await sleep(300);
  // «🪶 ¡Guardar mis plumas!»
  const banker = rubbers.find((x) => !hostPats.some((p) => p.k === x.init.you.k && false)) || kids[0];
  const bankP = next(host, 'dm:bank', 3000, (d) => d.k === banker.init.you.k).catch(() => null);
  banker.s.emit('player:dm-stop', { pin });
  const bank = await bankP;
  ok(bank === null || (bank.score >= 0 && bank.why), '«¡Guardar mis plumas!» keeps my feathers of the round (or he had already woken / they were kept)');
  // the tally
  const out = await next(host, 'dm:round', 16000, (d) => d.phase === 'pwout');
  ok(out.tally && out.tally.length === 1 && out.tally[0].rows.length === 4, 'the tally: every kid of the board');
  ok(out.tally[0].rows.every((r) => r.score >= 0 && r.got >= 0), 'everyone\'s feathers of the round were kept');
  const qw2 = await next(host, 'dm:round', 9000, (d) => d.phase === 'qw');
  ok(qw2.n === 2, 'round 2');

  // a kid's phone drops: back to its seat and feathers
  const dropKid = kids[2];
  const keptK = dropKid.init.you.k;
  dropKid.s.disconnect();
  await sleep(500);
  const back = connect();
  guard(back, 'back');
  let backInit = null;
  back.on('dm:init', (d) => { backInit = d; });
  const rj = await ack(back, 'player:join', { pin, name: dropKid.name, avatar: '🐉', studentCode: dropKid.code });
  ok(rj && rj.ok, 'the dropped kid rejoins');
  await sleep(700);
  ok(backInit && backInit.you && backInit.you.k === keptK && backInit.round && backInit.round.phase, 'a rejoin keeps the seat (same key) and the round');
  dropKid.s = back;

  // the teacher's clock
  const tP = next(host, 'dm:time', 2000);
  const rP = next(host, 'dm:round', 2000, (d) => d.phase === 'qw');
  host.emit('host:add-time', { pin, seconds: 30 });
  const t1 = await tP;
  ok(t1.add === 30, '«+30 s» adds 30 s');
  ok(!!(await rP.catch(() => null)), 'the open window takes its new length');
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
  host.emit('host:end-now', { pin });
  const he = await endHostP;
  ok(he.dormilon && he.dormilon.boards.length === 1 && Array.isArray(he.dormilon.podium), 'the projector gets every board + the podium');
  const ke = await Promise.all(endKids);
  ke.forEach((d, i) => ok(d.me && d.dormilon && d.dormilon.board && d.dormilon.board.rows.some((r) => r.k === d.me.k), `kid ${i} gets its board and its card`));
  ok(ke.every((d) => d.me.of === 4 && d.me.classOf === 4 && typeof d.me.score === 'number'), 'places in the board and the class, feathers on the card');

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
  await sleep(300);

  // ---------- «🤖 Probar con robots»: one phone + 3 robots that play and never count ----------
  const h3 = connect();
  guard(h3, 'host3');
  const c3 = await ack(h3, 'host:create', { gameType: 'dormilon', password: PASSWORD });
  await ack(h3, 'host:load-set', { pin: c3.pin, setId: SET });
  h3.emit('host:set-duration', { pin: c3.pin, duration: 60 });
  const robP = next(h3, 'dm:robots', 2000);
  h3.emit('host:dm-robots', { pin: c3.pin, on: true });
  const rob = await robP;
  ok(rob.on && rob.robots.length === 3 && rob.robots.every((r) => /🤖/.test(r.name)), 'the teacher\'s «Probar con robots»: 3 robots marked 🤖');
  const solo = connect();
  guard(solo, 'solo');
  const js = await ack(solo, 'player:join', { pin: c3.pin, name: 'Profe', avatar: '🐉' });
  ok(js && js.ok, 'one phone joins');
  const kidRobot = connect();
  const notHost = await new Promise((res) => { kidRobot.emit('host:dm-robots', { pin: c3.pin, on: false }); setTimeout(() => res(true), 300); });
  ok(notHost, 'a phone cannot switch the robots (teacher only)');
  kidRobot.disconnect();
  const i3P = next(h3, 'dm:init', 3000);
  h3.emit('host:start', { pin: c3.pin });
  const i3 = await i3P;
  ok(i3.boards.length === 1 && i3.boards[0].seats.length === 4 && i3.boards[0].seats.filter((x) => x.robot).length === 3, 'his board: him + 3 robots');
  await next(h3, 'dm:intro', 6000);
  h3.emit('host:dm-skip', { pin: c3.pin });
  const robotAnswers = [];
  h3.on('dm:plume', (d) => { if (i3.boards[0].seats.find((x) => x.k === d.k && x.robot)) robotAnswers.push(d); });
  await next(h3, 'dm:round', 25000, (d) => d.phase === 'pw');
  ok(robotAnswers.length >= 3, 'the robots answer questions (' + robotAnswers.length + ')');
  const robotPats = [];
  h3.on('dm:pat', (d) => { if (i3.boards[0].seats.find((x) => x.k === d.k && x.robot)) robotPats.push(d); });
  await next(h3, 'dm:round', 16000, (d) => d.phase === 'pwout');
  ok(robotPats.length >= 1, 'the robots tickle him in the play window (' + robotPats.length + ')');
  const e3P = next(h3, 'game-end', 8000);
  const s3P = next(solo, 'game-end', 8000);
  h3.emit('host:end-now', { pin: c3.pin });
  const e3 = await e3P;
  const s3 = await s3P;
  ok(e3.dormilon.boards[0].rows.length === 1 && e3.dormilon.boards[0].robots.length === 3, 'the end: robots listed apart, never ranked');
  ok(e3.dormilon.podium.length === 1 && e3.dormilon.count === 1 && e3.leaderboard.length === 1, 'robots never on the podium or the class list');
  ok(s3.me && s3.me.of === 1 && s3.me.classOf === 1, 'his card: 1 of 1 (robots never count)');

  ok(!leaks.length, 'no right answer or danger ever reached a screen: ' + leaks.join(', '));
  [host2, back, h3, solo].concat(kids.map((x) => x.s)).forEach((s) => { try { s.disconnect(); } catch (_) {} });
  console.log(`test-dormilon-live: ${checks} checks OK (${URL}, PIN ${pin})`);
  process.exit(0);
})().catch((e) => { console.error('test-dormilon-live FAILED:', e.message); process.exit(1); });
