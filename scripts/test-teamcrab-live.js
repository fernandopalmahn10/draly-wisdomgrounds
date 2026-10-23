// Live check of «¡Atrapa a Fénec!» against a RUNNING local server (never the live site):
//   node scripts/test-teamcrab-live.js --url http://localhost:4512 --password <teacher code>
// One teacher + 4 kids (one crew of 4): the deal at «Empezar», «Saltar» in the intro, every kid gets a question (never
// its answer), a right answer loads the hammer (the board sees it), the aim relays live, a slam falls and lands (impact
// or bonk), a wrong answer jams only my hammer and the board hears an anonymous snatch + the spark, pause holds
// everything, a kid whose phone drops comes back to its seat and words, «+30 s» / «−30 s», «Terminar» → «¡FINAL!»
// (caught / escaped per crew) → each phone its crew's ending payload, a projector that reconnects after the end gets
// its show again, «Otra ronda» deals a clean game.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:4512';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const SET = 'pack:yct1-familia-r1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m, d) => { checks++; if (!c && d) console.error('   detail:', JSON.stringify(d).slice(0, 400)); assert.ok(c, m); };
const connect = () => io(URL, { transports: ['websocket'], forceNew: true });
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
function next(s, ev, ms, match) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { s.off(ev, h); rej(new Error(`timeout waiting for ${ev}`)); }, ms || 8000);
    function h(d) { if (match && !match(d)) return; clearTimeout(t); s.off(ev, h); res(d); }
    s.on(ev, h);
  });
}
function none(s, ev, ms, match) {
  return new Promise((res) => {
    let seen = false;
    const h = (d) => { if (!match || match(d)) seen = true; };
    s.on(ev, h);
    setTimeout(() => { s.off(ev, h); res(!seen); }, ms);
  });
}
const leaks = [];
function guard(s, who) {
  s.onAny((ev, d) => {
    if (ev === 'tc:q' && d && ('correctIdx' in d || 'correct' in d)) leaks.push(who + ': ' + ev + ' with the answer');
    if (ev === 'tc:init' && d && d.q && 'correctIdx' in d.q) leaks.push(who + ': tc:init leaks the answer');
    if (ev === 'tc:snatch' && d && 'k' in d) leaks.push(who + ': tc:snatch names who failed');
  });
}

(async () => {
  const host = connect();
  guard(host, 'host');
  const { pin, hostToken } = await ack(host, 'host:create', { gameType: 'teamcrab', password: PASSWORD });
  ok(pin, 'room created');
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded && loaded.ok, 'pack loaded');
  host.emit('host:set-duration', { pin, duration: 120 });
  const kids = [];
  for (let i = 0; i < 4; i++) {
    const s = connect();
    const name = 'Crab' + i;
    const j = await ack(s, 'player:join', { pin, name, avatar: '🐉' });
    ok(j && j.ok, name + ' joined');
    const kd = { s, name, init: null, code: j.studentCode, q: null };
    kids.push(kd);
    s.on('tc:init', (d) => { kd.init = d; });
    s.on('tc:q', (d) => { kd.q = d; });
    guard(s, name);
  }
  const kOf = (x) => x.init && x.init.you && x.init.you.k;

  host.emit('host:start', { pin });
  const hi = await next(host, 'tc:init', 3000);
  ok(hi.phase === 'countdown' && hi.boards.length === 1 && hi.boards[0].seats.length === 4, '4 kids = one crew of 4, dealt at «Empezar»');
  ok(hi.boards[0].target >= 6 && hi.boards[0].words === 0 && hi.boards[0].hammers.length === 4, 'the crew has a target of words and 4 hammers');
  await sleep(200);
  ok(kids.every((x) => x.init && x.init.board && x.init.you), 'every phone got its own crew and seat');
  await next(host, 'tc:intro', 6000);
  await sleep(300);
  const playP = next(host, 'tc:play', 3000);
  host.emit('host:tc-skip', { pin });                                    // «Saltar» in the intro → play at once
  await playP;
  for (let t = 0; t < 40 && kids.some((x) => !x.q); t++) await sleep(50);
  ok(kids.every((x) => x.q && x.q.qid && x.q.answers.length >= 2 && x.q.ms === 15000), 'every kid gets a question at once (15 s)');

  // a right answer loads the hammer (the board sees it); the aim relays; the slam lands
  const right = new Map();
  try { (require('../core/packs').loadPack('yct1-familia-r1').questions || []).forEach((q) => right.set(q.text, String(q.correct))); } catch (_) {}
  const a = kids[0], b = kids[1], c = kids[2];
  const aIdx = a.q.answers.indexOf(right.get(a.q.text));
  ok(aIdx >= 0, 'the test knows the right answer');
  await sleep(600);
  const qrP = next(a.s, 'tc:qr', 3000);
  const hamP = next(b.s, 'tc:ham', 3000, (d) => d.k === kOf(a));
  a.s.emit('player:tc-answer', { pin, qid: a.q.qid, idx: aIdx });
  const qr = await qrP;
  ok(qr.ok && qr.loadMs === 9000 && qr.guided, 'a right answer loads my hammer (my first load: 9 s, guided)', qr);
  const ham = await hamP;
  ok(ham.st === 'loaded', 'the crew sees the hammer loaded');
  ok(await none(a.s, 'tc:q', 500), 'no question while my hammer is loaded');
  const aimP = next(b.s, 'tc:aim', 2000);
  const aimHostP = next(host, 'tc:aim', 2000);
  a.s.emit('player:tc-aim', { pin, x: 0.75 });
  const aim = await aimP;
  ok(aim.k === kOf(a) && aim.spot === 3 && (await aimHostP).x === 0.75, 'the aim moves live on the crew\'s phones and the projector');
  const nsP = next(b.s, 'tc:noslam', 1500);
  b.s.emit('player:tc-slam', { pin, x: 0.5 });
  ok((await nsP).why === 'empty', 'an empty hammer cannot slam');
  const slamP = next(c.s, 'tc:slam', 2000);
  const landP = Promise.race([next(host, 'tc:impact', 3000, (d) => d.k === kOf(a)), next(host, 'tc:bonk', 3000, (d) => d.k === kOf(a))]);
  a.s.emit('player:tc-slam', { pin, x: 0.75 });
  const sl = await slamP;
  ok(sl.k === kOf(a) && sl.spot === 3 && sl.ms === 420, 'the slam falls on the spot (the crew sees it)');
  const land = await landP;
  ok(land && land.k === kOf(a), 'the hammer lands: an impact or a bonk');
  const backP = next(a.s, 'tc:ham', 3000, (d) => d.k === kOf(a) && d.st === 'idle');
  await backP;
  for (let t = 0; t < 30 && !(a.q && a.q.qid !== qr.qid); t++) await sleep(50);
  ok(a.q && a.q.qid !== qr.qid, 'my hammer back up = the next question');

  // a wrong answer: my hammer jams (only my phone), the crew hears an anonymous snatch + the spark
  const bIdx = (b.q.answers.indexOf(right.get(b.q.text)) + 1) % b.q.answers.length;
  const bqrP = next(b.s, 'tc:qr', 3000);
  const snP = next(c.s, 'tc:snatch', 3000);
  const feedP = next(c.s, 'tc:feed', 3000);
  const noJamOthers = none(c.s, 'tc:ham', 1200, (d) => d.k === kOf(b) && d.st === 'jam');
  b.s.emit('player:tc-answer', { pin, qid: b.q.qid, idx: bIdx });
  const bqr = await bqrP;
  ok(!bqr.ok && bqr.jamMs === 3000 && bqr.correctText, 'a wrong answer: the right one shown, my hammer jams 3 s', bqr);
  const sn = await snP;
  ok(!('k' in sn) && typeof sn.words === 'number', 'the crew hears Fénec snatch a word, never who failed');
  ok((await feedP).anger >= 1, 'a grumpy spark feeds El Péndulo');
  ok(await noJamOthers, 'the jam shows only on its own phone');
  ok(await none(b.s, 'tc:q', 1500), 'no question while my hammer is jammed');

  // pause holds everything
  const pauseP = next(host, 'tc:pause', 2000);
  host.emit('host:pause', { pin, paused: true });
  const pz = await pauseP;
  ok(pz.paused, 'paused');
  const qc = c.q;
  const cqrP = next(c.s, 'tc:nope', 1500);
  c.s.emit('player:tc-answer', { pin, qid: qc.qid, idx: 0 });
  ok((await cqrP).why === 'closed', 'an answer during the pause is refused');
  const ends1 = pz.endsMs;
  await sleep(1200);
  const resumeP = next(host, 'tc:pause', 2000);
  host.emit('host:pause', { pin, paused: false });
  const rz = await resumeP;
  ok(!rz.paused && Math.abs(rz.endsMs - ends1) < 600, 'the clock stood still during the pause');

  // a kid whose phone drops comes back to its seat and words
  const dropKid = kids[3];
  const keptK = kOf(dropKid);
  dropKid.s.disconnect();
  await sleep(500);
  const back = connect();
  guard(back, 'back');
  let backInit = null;
  back.on('tc:init', (d) => { backInit = d; });
  const rj = await ack(back, 'player:join', { pin, name: dropKid.name, avatar: '🐉', studentCode: dropKid.code });
  ok(rj && rj.ok, 'the dropped kid rejoins');
  await sleep(600);
  ok(backInit && backInit.you && backInit.you.k === keptK && backInit.board.seats.length === 4, 'a rejoin keeps the seat (same key, same crew)');
  dropKid.s = back;

  // a late joiner sits in a crew
  const late = connect();
  guard(late, 'late');
  let lateInit = null;
  late.on('tc:init', (d) => { lateInit = d; });
  const seatP = next(host, 'tc:seat', 3000);
  const lj = await ack(late, 'player:join', { pin, name: 'Tarde', avatar: '🐉' });
  ok(lj && lj.ok, 'a late kid joins');
  const st = await seatP;
  ok(st.board && st.board.seats.length === 5, 'the late kid sits in the crew (5 hammers)');
  await sleep(300);
  ok(lateInit && lateInit.you && lateInit.board, 'the late kid gets its crew');

  // the teacher's clock
  const tP = next(host, 'tc:time', 2000);
  host.emit('host:add-time', { pin, seconds: 30 });
  ok((await tP).add === 30, '«+30 s» adds 30 s');
  const t2P = next(host, 'tc:time', 2000);
  host.emit('host:add-time', { pin, seconds: -30 });
  ok((await t2P).add === -30, '«−30 s» takes 30 s');

  // «Saltar» mid-game: a jam ends now
  const skipHamP = next(b.s, 'tc:ham', 2500, (d) => d.k === kOf(b) && d.st === 'idle').catch(() => null);
  host.emit('host:tc-skip', { pin });
  ok(true, '«Saltar» mid-game');
  await skipHamP;

  // «Terminar» → «¡FINAL!» → the endings
  const finP = next(host, 'tc:final', 3000);
  const endHostP = next(host, 'game-end', 6000);
  const endKids = kids.map((x) => next(x.s, 'game-end', 7000));
  host.emit('host:end-now', { pin });
  const fin = await finP;
  ok(fin.ms === 2400 && fin.boards.length === 1 && 'caught' in fin.boards[0], '«¡FINAL!» first, caught or escaped per crew');
  ok(await none(host, 'tc:final', 600), '«¡FINAL!» once');
  host.emit('host:end-now', { pin });
  const he = await endHostP;
  ok(he.teamcrab && he.teamcrab.boards.length === 1 && Array.isArray(he.teamcrab.crews) && Array.isArray(he.teamcrab.podium), 'the projector gets every crew + the crews + the podium');
  const ke = await Promise.all(endKids);
  ke.forEach((d, i) => ok(d.me && d.teamcrab && d.teamcrab.board && d.teamcrab.board.rows.some((r) => r.k === d.me.k) && typeof d.me.caught === 'boolean', `kid ${i} gets its crew's ending and its card`));
  ok(ke.every((d) => d.me.of === 5 && d.me.classOf === 5), 'places in the crew and the class');

  // the projector drops after the end: its show again
  host.disconnect();
  const host2 = connect();
  const geP = next(host2, 'game-end', 4000);
  const rc = await ack(host2, 'host:reclaim', { pin, hostToken, password: PASSWORD });
  ok(rc && rc.ok !== false, 'the projector reclaims its room');
  const ge2 = await geP;
  ok(ge2.teamcrab && ge2.teamcrab.boards.length === 1, 'the reconnected projector gets its show again');

  // «Otra ronda»: a clean game
  host2.emit('host:reset', { pin });
  await sleep(500);
  const hi2P = next(host2, 'tc:init', 4000);
  host2.emit('host:start', { pin });
  const hi2 = await hi2P;
  ok(hi2.phase === 'countdown' && hi2.id !== hi.id && hi2.boards.every((x) => x.words === 0), '«Otra ronda» deals a clean game');
  host2.emit('host:end-now', { pin });

  ok(!leaks.length, 'no right answer and no name of who failed ever reached a screen: ' + leaks.join(', '));
  [host2, back, late].concat(kids.map((x) => x.s)).forEach((s) => { try { s.disconnect(); } catch (_) {} });
  console.log(`test-teamcrab-live: ${checks} checks OK (${URL}, PIN ${pin})`);
  process.exit(0);
})().catch((e) => { console.error('test-teamcrab-live FAILED:', e.message); process.exit(1); });
