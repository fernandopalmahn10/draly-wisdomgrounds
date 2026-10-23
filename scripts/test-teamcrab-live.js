// Live check of «Draly Cangrejo · ¡Atrapa a Fénec!» v2 against a RUNNING local server (never the live site):
//   node scripts/test-teamcrab-live.js --url http://localhost:4512 --password <teacher code>
// Game 1, one teacher + 4 kids (one crew of 4): the deal at «Empezar», «Saltar» in the intro, the question window (every
// kid gets a quick-fire question, never its answer), a right answer = +1 charge (the crew sees the Capitán race, never
// charges), a wrong answer = El Péndulo eats (tc:mine to me only, tc:eat to the crew with no name), pause holds
// everything, a dropped phone comes back to its seat, a late joiner sits in the crew, «+30 s» / «−30 s», «Saltar» closes
// the question window → «¡A martillar!»: the roles (the best answerer = Capitán), the Capitán steers and the crab walks
// (a crewmate's steer is ignored), a martillero's aim relays live and its slam falls and lands (impact or bonk), an empty
// hammer can't slam, «Terminar» → «¡FINAL!» → the endings, a projector that reconnects after the end gets its show again.
// Game 2 («Otra ronda» with «🤖 Probar con robots», the teacher only): 1 kid + 3 robots = one crew; the robots answer and
// slam; the end has them in their crew's line only: never in the rows, the stars, the podium or the leaderboard.
// Game 3 («1 contra 3», v3: the teacher's «🎮 Modo», a kid can't pick it): 4 new kids; the phones' lobby hears the mode;
// the window's best answerer is Fénec (his right answers = dashes); his phone streams where he is (relayed to the crew
// and the projector, a crewmate's stream ignored); a hammer shows its shadow 0.75 s and waits for HIS verdict: away on
// his screen = a miss even when his last stream was under it, under it = a hit that stuns him (no hit while stunned);
// a dash; «¡Tiempo!» banks his seconds; the next round another kid runs; the end has «Mejor corredor» and no catch.
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
    if (ev === 'tc:eat' && d && 'k' in d) leaks.push(who + ': tc:eat names who missed');
    if (ev === 'tc:race' && d && 'charges' in d) leaks.push(who + ': tc:race shows charges');
  });
}
const right = new Map();
try { (require('../core/packs').loadPack('yct1-familia-r1').questions || []).forEach((q) => right.set(q.text, String(q.correct))); } catch (_) {}

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
    s.on('tc:qx', () => { kd.q = null; });
    guard(s, name);
  }
  const kOf = (x) => x.init && x.init.you && x.init.you.k;
  // a kid can't call the robots in
  ok(await none(kids[0].s, 'tc:robots', 500) && (kids[0].s.emit('host:tc-robots', { pin, on: true }), await none(host, 'tc:robots', 600)), 'only the teacher calls the robots in');

  host.emit('host:start', { pin });
  const hi = await next(host, 'tc:init', 3000);
  ok(hi.phase === 'countdown' && hi.boards.length === 1 && hi.boards[0].seats.length === 4 && hi.boards[0].seats.every((x) => !x.robot), '4 kids = one crew of 4, dealt at «Empezar» (no robots)');
  ok(hi.boards[0].target >= 6 && hi.boards[0].words === 0 && hi.boards[0].claws.length === 4 && hi.rules && hi.rules.reach > 0, 'the crew has a target of words, 4 claws, the rules for the screens');
  await sleep(200);
  ok(kids.every((x) => x.init && x.init.board && x.init.you), 'every phone got its own crew and seat');
  await next(host, 'tc:intro', 6000);
  await sleep(300);
  const playP = next(host, 'tc:play', 3000);
  const qwP = next(host, 'tc:round', 3000, (d) => d.phase === 'qw');
  host.emit('host:tc-skip', { pin });                                    // «Saltar» in the intro → play at once
  await playP;
  const qw = await qwP;
  ok(qw.n === 1 && qw.ms >= 8000 && qw.total >= 4, 'the first question window opens (round 1 of 4+)', qw);
  for (let t = 0; t < 40 && kids.some((x) => !x.q); t++) await sleep(50);
  ok(kids.every((x) => x.q && x.q.qid && x.q.answers.length >= 2 && x.q.ms <= 8000 && x.q.ms > 6000), 'every kid gets a quick-fire question (8 s)');
  const ping = await next(kids[0].s, 'tc:ping', 4000);
  ok(ping && ping.t > 0, 'the server measures the round trip of each phone (a slam is judged where Fénec was on that screen)');
  kids[0].s.emit('player:tc-pong', { pin, t: ping.t });

  // a right answer = +1 charge; the crew sees the Capitán race (rights only)
  const a = kids[0], b = kids[1], c = kids[2];
  const aIdx = a.q.answers.indexOf(right.get(a.q.text));
  ok(aIdx >= 0, 'the test knows the right answer');
  await sleep(700);
  const qrP = next(a.s, 'tc:qr', 3000);
  const raceP = next(b.s, 'tc:race', 3000, (d) => d.k === kOf(a));
  a.s.emit('player:tc-answer', { pin, qid: a.q.qid, idx: aIdx });
  const qr = await qrP;
  ok(qr.ok && qr.charges === 1 && qr.gained === 1, 'a right answer = +1 hammer charge', qr);
  const race = await raceP;
  ok(race.rightQW === 1 && !('charges' in race), 'the crew sees the race for Capitán (right answers only)');
  for (let t = 0; t < 30 && !(a.q && a.q.qid !== qr.qid); t++) await sleep(50);
  ok(a.q && a.q.qid !== qr.qid, 'the next question right after');

  // a wrong answer: El Péndulo eats (my phone hears tc:mine, the crew an anonymous tc:eat)
  const bIdx = (b.q.answers.indexOf(right.get(b.q.text)) + 1) % b.q.answers.length;
  const bqrP = next(b.s, 'tc:qr', 3000);
  const mineP = next(b.s, 'tc:mine', 3000);
  const eatP = next(c.s, 'tc:eat', 3000);
  const noMineOthers = none(c.s, 'tc:mine', 1200);
  b.s.emit('player:tc-answer', { pin, qid: b.q.qid, idx: bIdx });
  const bqr = await bqrP;
  ok(!bqr.ok && bqr.correctText && bqr.waitMs > 0, 'a wrong answer: the right one shown, a short wait', bqr);
  const mi = await mineP;
  ok(mi.k === kOf(b) && mi.charges === 0 && mi.ate === false, 'my miss reaches only me (nothing to eat yet: he still grows)');
  const eat = await eatP;
  ok(!('k' in eat) && eat.anger >= 1, 'the crew sees El Péndulo eat, never who');
  ok(await noMineOthers, 'another kid never hears my miss');
  // a second right answer, then a wrong one: the charge is eaten
  for (let t = 0; t < 40 && !(a.q && a.q.qid !== qr.qid); t++) await sleep(50);
  await sleep(600);
  const qr2P = next(a.s, 'tc:qr', 3000);
  a.s.emit('player:tc-answer', { pin, qid: a.q.qid, idx: a.q.answers.indexOf(right.get(a.q.text)) });
  const qr2 = await qr2P;
  ok(qr2.ok && qr2.charges === 2, 'two right answers = 2 charges');
  for (let t = 0; t < 40 && !(a.q && a.q.qid !== qr2.qid); t++) await sleep(50);
  await sleep(600);
  const mine2P = next(a.s, 'tc:mine', 3000);
  a.s.emit('player:tc-answer', { pin, qid: a.q.qid, idx: (a.q.answers.indexOf(right.get(a.q.text)) + 1) % a.q.answers.length });
  const mine2 = await mine2P;
  ok(mine2.ate && mine2.charges === 1, 'a wrong answer with charges: El Péndulo eats one');

  // pause holds everything
  const pauseP = next(host, 'tc:pause', 2000);
  host.emit('host:pause', { pin, paused: true });
  const pz = await pauseP;
  ok(pz.paused, 'paused');
  for (let t = 0; t < 40 && !c.q; t++) await sleep(50);
  const cqrP = next(c.s, 'tc:nope', 1500);
  c.s.emit('player:tc-answer', { pin, qid: c.q.qid, idx: 0 });
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
  ok(backInit && backInit.you && backInit.you.k === keptK && backInit.board.seats.length === 4 && backInit.round && backInit.round.phase === 'qw', 'a rejoin keeps the seat (same key, same crew) and the window');
  dropKid.s = back;

  // a late joiner sits in the crew
  const late = connect();
  guard(late, 'late');
  let lateInit = null;
  late.on('tc:init', (d) => { lateInit = d; });
  const seatP = next(host, 'tc:seat', 3000);
  const lj = await ack(late, 'player:join', { pin, name: 'Tarde', avatar: '🐉' });
  ok(lj && lj.ok, 'a late kid joins');
  const st = await seatP;
  ok(st.board && st.board.seats.length === 5, 'the late kid sits in the crew (5 claws)');
  await sleep(300);
  ok(lateInit && lateInit.you && lateInit.board, 'the late kid gets its crew');

  // the teacher's clock
  const tP = next(host, 'tc:time', 2000);
  const reP = next(host, 'tc:round', 2000, (d) => d.phase === 'qw' && d.n === 1);
  host.emit('host:add-time', { pin, seconds: 30 });
  ok((await tP).add === 30, '«+30 s» adds 30 s');
  const re = await reP;
  ok(re.total >= qw.total, 'the open question window is re-planned for the new length', re);
  const t2P = next(host, 'tc:time', 2000);
  host.emit('host:add-time', { pin, seconds: -30 });
  ok((await t2P).add === -30, '«−30 s» takes 30 s');

  // «Saltar» closes the question window → «¡A martillar!»: the roles; the Capitán = the best answerer (kid a)
  const rolesP = next(b.s, 'tc:roles', 3000);
  const pwinP = next(host, 'tc:round', 3000, (d) => d.phase === 'pwin');
  host.emit('host:tc-skip', { pin });
  const roles = await rolesP;
  await pwinP;
  ok(roles.captain === kOf(a), 'the window\'s best answerer is the Capitán', roles);
  ok(roles.mart.length === 1 && roles.mart[0].k === kOf(a) && roles.mart[0].charges === 1, 'only kids with charges are martilleros (the rest watch)', roles);
  const pwP = next(host, 'tc:round', 4000, (d) => d.phase === 'pw');
  const pw = await pwP;
  ok(pw.ms === 10000, '«¡A martillar!»: a 10-s play window');
  // the Capitán steers: the crab walks (a crewmate's steer is ignored)
  const noCrabFromB = none(host, 'tc:steer', 500, (d) => d.k === kOf(b));
  b.s.emit('player:tc-steer', { pin, x: 0 });
  ok(await noCrabFromB, 'only the Capitán steers');
  const steerP = next(c.s, 'tc:steer', 2000, (d) => d.k === kOf(a));
  const crabP = next(c.s, 'tc:crab', 3000);
  a.s.emit('player:tc-steer', { pin, x: 4 });
  ok((await steerP).tx === 4, 'the Capitán\'s finger reaches the crew at once');
  const crab = await crabP;
  ok(crab.x > 2 && crab.x < 4, 'the crab walks there (not a jump)', crab);
  const aimP = next(c.s, 'tc:aim', 2000);
  a.s.emit('player:tc-aim', { pin, x: 3 });
  const aim = await aimP;
  ok(aim.k === kOf(a) && Math.abs(aim.off) <= hi.rules.reach + 1e-9, 'the aim relays live, within the crab\'s reach');
  const nsP = next(b.s, 'tc:noslam', 1500);
  b.s.emit('player:tc-slam', { pin, x: 2 });
  ok((await nsP).why === 'empty', 'no charges: no slam');
  const slamP = next(c.s, 'tc:slam', 2000);
  const landP = Promise.race([next(host, 'tc:impact', 3000, (d) => d.k === kOf(a)), next(host, 'tc:bonk', 3000, (d) => d.k === kOf(a))]);
  a.s.emit('player:tc-slam', { pin, x: 3 });
  const sl = await slamP;
  ok(sl.k === kOf(a) && sl.ms === hi.rules.fall && sl.charges === 0, 'the slam falls (one charge spent; the crew sees it)', sl);
  const land = await landP;
  ok(land && land.k === kOf(a), 'the hammer lands: an impact or a bonk');
  // every hammer spent: the window ends soon
  const outP = next(host, 'tc:round', 4000, (d) => d.phase === 'pwout');
  const out = await outP;
  ok(Array.isArray(out.tally) && out.tally.length === 1, '«¡Tiempo!» soon after the last hammer, with the round\'s tally');

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
  ok(ke[0].me.captained === 1, 'my card knows I was Capitán');

  // the projector drops after the end: its show again
  host.disconnect();
  const host2 = connect();
  guard(host2, 'host2');
  const geP = next(host2, 'game-end', 4000);
  const rc = await ack(host2, 'host:reclaim', { pin, hostToken, password: PASSWORD });
  ok(rc && rc.ok !== false, 'the projector reclaims its room');
  const ge2 = await geP;
  ok(ge2.teamcrab && ge2.teamcrab.boards.length === 1, 'the reconnected projector gets its show again');

  // ---------- game 2: «Otra ronda» with «🤖 Probar con robots»: 1 kid + 3 robots ----------
  [b, c, kids[3], { s: late }].forEach((x) => { try { x.s.disconnect(); } catch (_) {} });
  host2.emit('host:reset', { pin });
  await sleep(600);
  const robP = next(host2, 'tc:robots', 2000);
  host2.emit('host:tc-robots', { pin, on: true });
  const rob = await robP;
  ok(rob.on && rob.robots.length === 3 && rob.robots.every((r) => /🤖/.test(r.name)), '«🤖 Probar con robots»: 3 robots, marked 🤖');
  const hi2P = next(host2, 'tc:init', 4000);
  host2.emit('host:start', { pin });
  const hi2 = await hi2P;
  ok(hi2.phase === 'countdown' && hi2.id !== hi.id && hi2.boards.length === 1 && hi2.boards[0].seats.length === 4, '1 kid + 3 robots = one crew of 4');
  ok(hi2.boards[0].seats.filter((x) => x.robot).length === 3 && hi2.boards[0].seats.every((x) => !x.robot || (x.on && /🤖/.test(x.name))), 'the robots sit in the crew, online, marked 🤖');
  const robotKs = hi2.boards[0].seats.filter((x) => x.robot).map((x) => x.k);
  await next(host2, 'tc:intro', 6000);
  const raceRobot = next(a.s, 'tc:race', 9000, (d) => robotKs.includes(d.k));
  host2.emit('host:tc-skip', { pin });
  await raceRobot;
  ok(true, 'the robots answer (one got a right answer: the race)');
  await sleep(4000);
  host2.emit('host:tc-skip', { pin });
  const slamRobot = await next(a.s, 'tc:slam', 32000, (d) => robotKs.includes(d.k)).catch(() => null);   // (a window where every robot missed has no robot hammer: the next round)
  ok(slamRobot, 'the robots slam in the play window');
  const end2P = next(host2, 'game-end', 7000);
  const kEnd2P = next(a.s, 'game-end', 7000);
  host2.emit('host:end-now', { pin });
  await next(host2, 'tc:final', 3000);
  host2.emit('host:end-now', { pin });
  const e2 = await end2P;
  const k2 = await kEnd2P;
  const bd2 = e2.teamcrab.boards[0];
  ok(bd2.rows.length === 1 && bd2.robots.length === 3, 'the end: the robots ride in their crew\'s line only, never in its ranking');
  ok(bd2.stars.every((s) => s.winners.every((k) => !robotKs.includes(k))) && bd2.winners.every((k) => !robotKs.includes(k)), 'no star and no crew win for a robot');
  ok(e2.teamcrab.podium.every((r) => !robotKs.includes(r.k)) && e2.leaderboard.length === 1 && e2.teamcrab.count === 1, 'no robot on the podium, the leaderboard or the class count');
  ok(k2.me && k2.me.of === 1 && k2.me.classOf === 1, 'the kid\'s card counts only real kids');
  host2.emit('host:reset', { pin });
  await sleep(300);
  const robOffP = next(host2, 'tc:robots', 2000);
  host2.emit('host:tc-robots', { pin, on: false });
  ok(!(await robOffP).on, 'a second tap sends the robots home');

  // ---------- game 3: «1 contra 3» ----------
  try { a.s.disconnect(); } catch (_) {}
  {
  const vk = [];
  for (let i = 0; i < 4; i++) {
    const sk = connect();
    const j = await ack(sk, 'player:join', { pin, name: 'Zorro' + i, avatar: '🐉' });
    ok(j && j.ok, 'Zorro' + i + ' joined');
    const kd = { s: sk, name: 'Zorro' + i, init: null, q: null, st: null };
    sk.on('tc:init', (d) => { kd.init = d; });
    sk.on('tc:q', (d) => { kd.q = d; });
    sk.on('tc:qx', () => { kd.q = null; });
    sk.on('state', (d) => { kd.st = d; });
    guard(sk, kd.name);
    vk.push(kd);
  }
  vk[0].s.emit('host:tc-mode', { pin, mode: 'vs' });
  ok(await none(host2, 'tc:mode', 600), 'only the teacher picks the mode');
  const modeP = next(host2, 'tc:mode', 2000);
  const stP = next(vk[1].s, 'state', 3000, (d) => d && d.tcMode === 'vs');
  host2.emit('host:tc-mode', { pin, mode: 'vs' });
  ok((await modeP).mode === 'vs', '«🎮 Modo» → «1 contra 3»');
  ok((await stP).tcMode === 'vs', 'the phones\' lobby hears the mode (the steps of «1 contra 3»)');
  const hi3P = next(host2, 'tc:init', 4000);
  host2.emit('host:start', { pin });
  const hi3 = await hi3P;
  ok(hi3.mode === 'vs' && hi3.boards.length === 1 && hi3.boards[0].seats.length === 4 && hi3.rules.vs && hi3.rules.vs.fall === 750, 'the game is dealt in «1 contra 3» (the rules carry the runner\'s)');
  await next(host2, 'tc:intro', 6000);
  host2.emit('host:tc-skip', { pin });
  await sleep(900);
  const kOf3 = (x) => x.init && x.init.you && x.init.you.k;
  const ansRight = async (x) => { for (let t = 0; t < 60 && !x.q; t++) await sleep(50); if (!x.q) return false; await sleep(700); const q = x.q; const p = next(x.s, 'tc:qr', 3000).catch(() => null); x.s.emit('player:tc-answer', { pin, qid: q.qid, idx: q.answers.indexOf(right.get(q.text)) }); const r = await p; for (let t = 0; t < 40 && x.q && x.q.qid === q.qid; t++) await sleep(50); return !!(r && r.ok); };
  // Zorro0: 3 right (the runner), Zorro2: 2 right (Capitán, 2 hammers), Zorro1: 1 right (a martillero)
  ok(await ansRight(vk[0]) && await ansRight(vk[0]) && await ansRight(vk[0]), 'Zorro0 answers three right');
  ok(await ansRight(vk[2]) && await ansRight(vk[2]) && await ansRight(vk[1]), 'the crewmates answer (2 and 1 right)');
  const rolesP = next(vk[1].s, 'tc:roles', 4000);
  const pwP = next(vk[0].s, 'tc:round', 6000, (d) => d.phase === 'pw');
  host2.emit('host:tc-skip', { pin });
  const ro = await rolesP;
  ok(ro.runner === kOf3(vk[0]) && ro.dashes === 3 && !ro.mart.some((x) => x.k === ro.runner), 'the best answerer is Fénec this round (3 right = 3 dashes), with no hammer', ro);
  ok(ro.captain === kOf3(vk[1]) || ro.captain === kOf3(vk[2]), 'the Capitán is the best of the others');
  await pwP;
  const runner = vk[0], slammer = ro.mart.slice().sort((p, q) => q.charges - p.charges)[0];
  const sl = vk.find((x) => kOf3(x) === slammer.k);
  // his phone streams where he is: relayed to the crew and the projector; a crewmate's stream is ignored
  const goal = Math.max(0, ro.rx - 0.48);
  const relP = next(vk[2].s, 'tc:runner', 3000, (d) => d.k === ro.runner && Math.abs(d.x - goal) < 0.05);
  const relH = next(host2, 'tc:runner', 3000, (d) => d.k === ro.runner);
  let rx = ro.rx;
  for (let i = 1; i <= 6; i++) { rx = Math.max(0, rx - 0.08); runner.s.emit('player:tc-run', { pin, x: rx }); await sleep(70); }
  const rel = await relP;
  ok(Math.abs(rel.x - rx) < 0.2 && (await relH).k === ro.runner, 'his phone streams where he is: the crew and the projector see him move');
  ok(await (vk[3].s.emit('player:tc-run', { pin, x: 0 }), none(vk[2].s, 'tc:runner', 500, (d) => d.k === kOf3(vk[3]))), 'only the runner moves the runner');
  // a hammer on him: its shadow 0.75 s; HIS phone says he got away → a miss
  const slamP = next(runner.s, 'tc:slam', 3000, (d) => d.k === slammer.k);
  sl.s.emit('player:tc-slam', { pin, x: rx });
  const sm = await slamP;
  ok(sm.ms === 750 && sm.sid > 0, 'the runner\'s phone sees the hammer\'s shadow 0.75 s before it lands', sm);
  const impP = next(host2, 'tc:impact', 4000, (d) => d.sid === sm.sid);
  await sleep(sm.ms + 60);
  runner.s.emit('player:tc-land', { pin, sid: sm.sid, x: Math.min(4, sm.x + 0.8) });
  const imp = await impP;
  ok(!imp.hit, '«¡Pero si lo esquivé!» never: away on his own screen = a miss (his last stream was under it)', imp);
  // the next hammer: under it on his screen → a hit that stuns him, never the end of his round
  await sleep(600);
  const slam2P = next(runner.s, 'tc:slam', 3000, (d) => d.k === slammer.k);
  sl.s.emit('player:tc-slam', { pin, x: rx });
  const sm2 = await slam2P.catch(() => null);
  ok(sm2, 'a second hammer (it came back up)');
  const bonkP = next(vk[2].s, 'tc:bonk', 4000, (d) => d.sid === sm2.sid);
  await sleep(sm2.ms + 60);
  runner.s.emit('player:tc-land', { pin, sid: sm2.sid, x: sm2.x });
  const bk = await bonkP;
  ok(bk.runner === ro.runner && bk.k === slammer.k && bk.pts === 3 && bk.ms === 1000, 'under it on his screen = a hit: the slammer\'s points, he is stunned 1 s', bk);
  // a dash
  await sleep(1100);
  const dashP = next(vk[2].s, 'tc:dash', 3000);
  runner.s.emit('player:tc-dash', { pin, dir: 1 });
  const da = await dashP;
  ok(da.k === ro.runner && da.dashes === 2, 'a dash spends one of his dashes (the crew sees it)');
  // «¡Tiempo!»: his seconds
  const reP = next(vk[1].s, 'tc:runend', 6000);
  host2.emit('host:tc-skip', { pin });
  const re = await reP;
  ok(re.k === ro.runner && re.secs >= 1 && !re.untouched && re.pts === re.secs && re.charges >= 2, '«¡Tiempo!»: a point for each second he survived; the dashes he kept are charges again', re);
  // the next round: another kid runs
  await next(vk[0].s, 'tc:round', 6000, (d) => d.phase === 'qw');
  await sleep(400);
  ok(await ansRight(vk[0]) && await ansRight(vk[3]), 'answers in the next window');
  const ro2P = next(vk[1].s, 'tc:roles', 4000);
  host2.emit('host:tc-skip', { pin });
  const ro2 = await ro2P;
  ok(ro2.runner === kOf3(vk[3]), 'no one runs twice before everyone has run: the best of the rest runs', ro2);
  // a dropped runner phone: the computer runs for him (never a sitting duck); back, he gets his runner screen
  await next(vk[3].s, 'tc:round', 4000, (d) => d.phase === 'pw');
  const autoP = next(host2, 'tc:runner', 4000, (d) => d.k === ro2.runner);
  vk[3].s.disconnect();
  ok(await autoP.then(() => true).catch(() => false), 'a runner whose phone dropped is run by the computer');
  // the end
  const end3P = next(host2, 'game-end', 8000);
  const kEnd3P = next(vk[0].s, 'game-end', 8000);
  const fin3P = next(host2, 'tc:final', 3000);
  host2.emit('host:end-now', { pin });
  const fin3 = await fin3P;
  ok(fin3.mode === 'vs' && fin3.boards[0].caught === null, '«¡FINAL!» in «1 contra 3»: no caught / escaped');
  host2.emit('host:end-now', { pin });
  const e3 = await end3P;
  const k3 = await kEnd3P;
  ok(e3.teamcrab.mode === 'vs' && e3.teamcrab.boards[0].stars.some((x) => x.id === 'corredor') && e3.teamcrab.boards[0].caught === null, 'the ceremony has «Mejor corredor»', e3.teamcrab.boards[0].stars);
  ok(k3.me && k3.me.runs === 1 && k3.me.survived >= 1 && k3.teamcrab.mode === 'vs', 'my card knows I ran as Fénec', k3.me);
  host2.emit('host:reset', { pin });
  await sleep(300);
  host2.emit('host:tc-mode', { pin, mode: 'crew' });
  ok((await next(host2, 'tc:mode', 2000)).mode === 'crew', 'back to «Todos contra Fénec»');
  vk.forEach((x) => { try { x.s.disconnect(); } catch (_) {} });
  }

  ok(!leaks.length, 'no right answer, no charges in the race and no name of who missed ever reached a screen: ' + leaks.join(', '));
  [host2, a.s].forEach((s) => { try { s.disconnect(); } catch (_) {} });
  console.log(`test-teamcrab-live: ${checks} checks OK (${URL}, PIN ${pin})`);
  process.exit(0);
})().catch((e) => { console.error('test-teamcrab-live FAILED:', e.message); process.exit(1); });
