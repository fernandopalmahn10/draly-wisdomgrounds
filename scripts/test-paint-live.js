// Live check of Dragones Pintores v2 against a RUNNING local server (never the live site):
//   node scripts/test-paint-live.js --url http://localhost:4570 --password <the local teacher code>
// One teacher + 4 kids: the teacher picks the world in the lobby; every phone gets the round's world + seed (the same
// sky as core/paint.js builds); a tap is only an intent: clamped to the sky, at most Paint.R.GO_RATE a second, nonsense
// ignored; the server flies the dragon at its speed (no teleport between two position messages) and paints the clouds
// on the way; out of fire → a question comes by itself; a guess under 450 ms = wrong; «¡Casi!» → the next question waits
// 2.6 s (4.2 s after two in a row); a right answer = +10 s of fire; an island captured by a dragon parked in its ring
// (+10 for the kingdom); a question nobody answers is closed by the server (time up); «Pausa» freezes the dragons and
// hands answers back; «+30 s»; a reconnect keeps the dragon where it was; a late joiner flies from home and every screen
// learns its name; the projector's F5 gets the sky back; «Terminar» → «¡FINAL!» → the ceremony with the islands star;
// «Otra ronda» = the next world.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');
const Paint = require('../core/paint');
const PW = require('../public/js/paint-worlds');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:4570';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const SET = 'pack:yct1-familia-r1';
const R = Paint.R;
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

(async () => {
  const set = await fetch(URL + '/api/sets/' + encodeURIComponent(SET)).then((r) => r.json());
  const correctOf = (q) => { const x = require('../core/packs').forGames(set.questions).find((y) => y.text === q.text);   /* as rooms show them: toned (2026-10-24) */ return x ? q.answers.indexOf(x.correct) : -1; };
  ok(set.questions.length > 5, 'the pack loads');

  // ---------- the room, the world picked in the lobby ----------
  const host = connect();
  const { pin, hostToken } = await ack(host, 'host:create', { gameType: 'paint', password: PASSWORD });
  ok(pin && hostToken, 'a PIN and the projector\'s room token');
  ok((await ack(host, 'host:load-set', { pin, setId: SET })).ok, 'the pack loads into the room');
  host.emit('host:set-duration', { pin, duration: 180 });
  const kids = [];
  for (const name of ['Sofi', 'Mateo', 'Valen', 'Lucas']) {
    const s = connect();
    const kid = { s, name, q: null, init: null, pos: [], paints: [], results: [], energy: null, qs: [] };
    s.on('question', (q) => { kid.q = q; kid.qAt = Date.now(); kid.qs.push([Date.now(), q.qid]); });
    s.on('pc:init', (d) => { kid.init = d; });
    s.on('pc:pos', (m) => kid.pos.push([Date.now(), m]));
    s.on('pc:paint', (m) => kid.paints.push(m));
    s.on('pc:energy', (d) => { kid.energy = d.energy; });
    s.on('answer-result', (r) => { kid.results.push([Date.now(), r]); if (r.paint) kid.energy = r.paint.energy; });
    const j = await ack(s, 'player:join', { pin, name });
    ok(j && j.ok !== false, `${name} joins`);
    kid.team = j.team;
    kids.push(kid);
  }
  const [sofi, mateo, valen, lucas] = kids;
  const worldAck = await ack(host, 'host:pc-world', { pin, world: 1 });
  ok(worldAck && worldAck.ok && worldAck.world === 1, 'the teacher picks La Gran Muralla in the lobby');
  ok(!(await ack(host, 'host:pc-world', { pin, world: 9 })).ok, 'a world that does not exist is refused');
  const kidWorld = await ack(connect(), 'host:pc-world', { pin, world: 3 });
  ok(!kidWorld || !kidWorld.ok, 'only the room\'s projector picks the world');

  // ---------- the round starts: every phone the same sky ----------
  const inits = kids.map((k) => next(k.s, 'pc:init', 9000));
  const hostInit = next(host, 'pc:init', 9000);
  host.emit('host:start', { pin });
  await Promise.all(inits);
  const hi = await hostInit;
  ok(hi.world === 1 && hi.me == null, 'the projector gets the world (no dragon of its own)');
  const sky = PW.build(hi.world, hi.seed);
  ok(sky.id === 'muralla' && sky.lms.map((l) => l.id).join() === 'temple,tower,panda', 'La Gran Muralla with its three islands');
  kids.forEach((k) => {
    ok(k.init.world === hi.world && k.init.seed === hi.seed, `${k.name}: the same world and seed as everyone`);
    ok(k.init.me > 0 && k.init.roster[k.init.me] && k.init.roster[k.init.me][0] === k.name, `${k.name}: knows which dragon is hers/his`);
    ok(Math.abs(k.init.energy - R.START_FIRE) < 0.01, `${k.name}: starts with ${R.START_FIRE} s of fire`);
    const me = k.init.pos.find((p) => p[0] === k.init.me);
    const home = sky.homes[k.team === 'gold' ? 'gold' : 'red'];
    ok(me && Math.abs(me[1] - home[0]) < 80 && Math.abs(me[2] - home[1]) < 80, `${k.name}: starts at the ${k.team} home`);
    k.k = k.init.me;
  });
  ok(Object.keys(hi.roster).length === 4, 'the projector knows every dragon');
  const lastPos = (k, kk) => { for (let i = k.pos.length - 1; i >= 0; i--) { const d = k.pos[i][1].d.find((p) => p[0] === kk); if (d) return d; } return null; };

  // ---------- a tap is an intent: clamped, no teleport, painting on the way ----------
  sofi.pos = [];
  sofi.s.emit('player:pc-go', { pin, x: 5000, y: -300 });
  await sleep(700);
  let me = lastPos(sofi, sofi.k);
  ok(me && me[3] === sky.w - R.MARGIN && me[4] === R.MARGIN + 20, `a tap outside the sky is clamped to its edge (${me && me.slice(3, 5)})`);
  // no teleport: between two position messages a dragon moves at most its speed × the time between them
  let worst = 0;
  for (let i = 1; i < sofi.pos.length; i++) {
    const a = sofi.pos[i - 1][1].d.find((p) => p[0] === sofi.k), b = sofi.pos[i][1].d.find((p) => p[0] === sofi.k);
    if (!a || !b) continue;
    const dt = (sofi.pos[i][1].t - sofi.pos[i - 1][1].t) / 1000;
    worst = Math.max(worst, Math.hypot(b[1] - a[1], b[2] - a[2]) / Math.max(0.05, dt));
  }
  ok(sofi.pos.length >= 2 && worst <= R.BLAZE_SPEED * 1.05, `no teleport: the dragon never flies faster than its speed (${Math.round(worst)} u/s)`);
  // nonsense is ignored; a burst of taps: only the first GO_RATE of a second count
  const before = lastPos(sofi, sofi.k);
  ['a', null, undefined].forEach((x) => sofi.s.emit('player:pc-go', { pin, x, y: 300 }));
  sofi.s.emit('player:pc-go', { pin, x: NaN, y: 300 });
  sofi.s.emit('player:pc-go', { pin });
  await sleep(450);
  const after1 = lastPos(sofi, sofi.k);
  ok(after1[3] === before[3] && after1[4] === before[4], 'taps that are not numbers change nothing');
  await sleep(1050);                                // a fresh second for the rate window
  for (let i = 0; i < 30; i++) sofi.s.emit('player:pc-go', { pin, x: 200 + i * 40, y: 500 });
  await sleep(450);
  const burst = lastPos(sofi, sofi.k);
  ok(burst[3] === 200 + (R.GO_RATE - 1) * 40 && burst[4] === 500, `a burst of 30 taps: only the first ${R.GO_RATE} of the second count (target x ${burst[3]})`);
  ok(sofi.paints.some((m) => (m.f || []).some(([, c]) => c === (sofi.team === 'gold' ? 2 : 1))), 'the server painted clouds in Sofi\'s colour on her way');
  ok(sofi.paints.some((m) => m.sc && m.sc[sofi.k] > 0) && sofi.paints.some((m) => m.ts && m.ts[sofi.team] > 0), 'her clouds and her kingdom\'s points count');

  // ---------- Lucas asks for a question and never answers: the server closes it (time up) ----------
  lucas.s.emit('player:pc-ask', { pin });
  const lq = await next(lucas.s, 'question', 3000);
  const lqAt = Date.now();
  ok(lq && lq.qid, '«Recargar» deals a question (through the room\'s tick)');

  // ---------- an island: Mateo parks in the centre ring until it is his kingdom's ----------
  const isl = sky.lms[0];
  mateo.s.emit('player:pc-go', { pin, x: isl.x, y: isl.y });
  const cap = await next(mateo.s, 'pc:paint', 15000, (m) => (m.ev || []).some((e) => e.type === 'capture' && e.lm === 0));
  const ev = cap.ev.find((e) => e.type === 'capture');
  ok(ev.team === (mateo.team === 'gold' ? 'gold' : 'red') && ev.names.includes('Mateo'), 'the island is captured by Mateo\'s kingdom, with his name');
  ok(cap.lm[0][1] === (mateo.team === 'gold' ? 2 : 1) && Math.abs(Math.abs(cap.lm[0][0]) - 1) < 0.01, 'its meter is full in his colour');
  ok(cap.ts[ev.team] >= R.LM_VALUE, `an island held is worth ${R.LM_VALUE} to the kingdom`);

  // ---------- out of fire: a question comes by itself; too fast = wrong; the «¡Casi!» wait ----------
  valen.qs = [];
  for (let i = 0; i < 12 && !(valen.energy === 0); i++) {
    valen.s.emit('player:pc-go', { pin, x: i % 2 ? 120 : 1480, y: 200 + (i % 3) * 200 });
    await sleep(1500);
    if (valen.qs.length) break;
  }
  const vq = valen.q && valen.qs.length ? valen.q : await next(valen.s, 'question', 20000);
  ok(vq && vq.qid, 'out of fire: a question comes by itself');
  await sleep(700);
  const w1 = next(valen.s, 'answer-result', 4000);
  valen.s.emit('player:answer', { pin, qid: vq.qid, choiceIdx: (correctOf(vq) + 1) % vq.answers.length });
  ok((await w1).correct === false, 'a wrong answer is wrong');
  const t0 = Date.now();
  // the next one comes by itself after the «¡Casi!» wait; tapped at once (under 450 ms) even the right answer is a guess
  const fastRes = new Promise((res) => {
    valen.s.once('question', (q) => { valen.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: correctOf(q) }); next(valen.s, 'answer-result', 4000).then(res); });
  });
  const vq2At = await next(valen.s, 'question', 8000).then(() => Date.now());
  const gap = vq2At - t0;
  ok(gap >= R.WRONG_WAIT_MS - 250 && gap < R.WRONG_WAIT_MS + 1500, `«¡Casi!»: the next question waits ${R.WRONG_WAIT_MS} ms (${gap})`);
  const fr = await fastRes;
  ok(fr.correct === false && fr.paint.why === 'fast', 'the right answer tapped in under 450 ms counts as a guess');
  const t1 = Date.now();
  const vq3 = await next(valen.s, 'question', 9000);
  const gap2 = Date.now() - t1;
  ok(gap2 >= R.WRONG_WAIT2_MS - 250, `two wrong in a row: a longer wait (${gap2} ms)`);
  await sleep(700);
  const rr = next(valen.s, 'answer-result', 4000);
  valen.s.emit('player:answer', { pin, qid: vq3.qid, choiceIdx: correctOf(vq3) });
  const rres = await rr;
  ok(rres.correct && rres.paint.energy >= R.ENERGY_PER_RIGHT - 0.01 && rres.paint.gain === R.ENERGY_PER_RIGHT, 'a right answer: +10 s of fire');

  // ---------- «Pausa»: the dragons stand still, answers come back, taps are ignored; «Seguir» ----------
  sofi.s.emit('player:pc-go', { pin, x: 300, y: 300 });
  await sleep(300);
  const pz = kids.map((k) => next(k.s, 'pc:pause', 3000, (d) => d.paused));
  host.emit('host:pause', { pin, paused: true });
  await Promise.all(pz);
  const p0 = lastPos(sofi, sofi.k);
  sofi.s.emit('player:pc-go', { pin, x: 1500, y: 800 });
  await sleep(900);
  const p1 = lastPos(sofi, sofi.k);
  ok(p0 && p1 && p0[1] === p1[1] && p0[2] === p1[2] && p1[3] !== 1500, 'paused: the dragons stand still and a tap is ignored');
  sofi.s.emit('player:pc-ask', { pin });
  ok(await next(sofi.s, 'question', 1200).then(() => false, () => true), 'paused: «Recargar» waits');
  const rs = kids.map((k) => next(k.s, 'pc:pause', 3000, (d) => !d.paused));
  host.emit('host:pause', { pin, paused: false });
  await Promise.all(rs);
  ok(true, '«Seguir» reaches every phone');

  // ---------- «+30 s» ----------
  const st0 = await next(host, 'state', 3000).catch(() => null);
  host.emit('host:add-time', { pin, seconds: 30 });
  const st1 = await next(host, 'state', 3000, (s) => st0 && s.endsAt > st0.endsAt + 25000).catch(() => null);
  ok(st1, '«+30 s» moves the end 30 s later');

  // ---------- a reconnect keeps the dragon; a late joiner flies from home; the projector's F5 ----------
  mateo.s.emit('player:pc-ask', { pin });
  const mq = await next(mateo.s, 'question', 3000);
  await sleep(300);
  const mBefore = lastPos(sofi, mateo.k);
  mateo.s.disconnect();
  await sleep(400);
  const m2 = connect();
  const m2init = next(m2, 'pc:init', 5000);
  const m2q = next(m2, 'question', 5000);
  await ack(m2, 'player:join', { pin, name: 'Mateo' });
  const mi = await m2init;
  const mNow = mi.pos.find((p) => p[0] === mi.me);
  ok(mi.me === mateo.k && mNow && Math.hypot(mNow[1] - mBefore[1], mNow[2] - mBefore[2]) < 60, 'a reconnect keeps the dragon (same id, where it was)');
  ok(mi.q === true && (await m2q).qid === mq.qid, 'and its open question (the phone knows it is still open: never a dead sheet)');
  ok(typeof mi.endsMs === 'number' && mi.endsMs > 0, 'the phone gets the time LEFT (its own clock may be off)');
  const nico = connect();
  const roster = next(host, 'pc:roster', 5000, (r) => Object.values(r).some((v) => v[0] === 'Nico'));
  const ninit = next(nico, 'pc:init', 5000);
  const nj = await ack(nico, 'player:join', { pin, name: 'Nico' });
  const ni = await ninit;
  ok(ni.me > 0 && Math.abs(ni.energy - R.START_FIRE) < 0.01, 'a late joiner gets a dragon with the start fire');
  const nHome = sky.homes[nj.team === 'gold' ? 'gold' : 'red'];
  const nPos = ni.pos.find((p) => p[0] === ni.me);
  ok(nPos && Math.abs(nPos[1] - nHome[0]) < 80, 'and starts at its kingdom\'s home');
  ok(await roster, 'every screen learns the late joiner\'s name');
  const host2 = connect();
  const reinit = next(host2, 'pc:init', 5000);
  const rc = await ack(host2, 'host:reclaim', { pin, hostToken });
  ok(rc && rc.ok !== false, 'the projector\'s F5 takes the room back with its token');
  const r2 = await reinit;
  ok(r2.world === hi.world && r2.seed === hi.seed && r2.lm[0][1] !== 0, 'the reloaded projector gets the same sky and the captured island');

  // ---------- the question nobody answered: closed by the server ----------
  const lr = lucas.results.find(([, r]) => r.paint && r.paint.why === 'timeup');
  const lr2 = lr || await next(lucas.s, 'answer-result', R.Q_SERVER_MS + 8000, (r) => r.paint && r.paint.why === 'timeup').then((r) => [Date.now(), r]);
  ok(lr2 && lr2[1].correct === false && lr2[0] - lqAt >= R.Q_SERVER_MS - 500, `an unanswered question is closed as «time up» by the server (${Math.round((lr2[0] - lqAt) / 1000)} s)`);

  // ---------- «Terminar» → «¡FINAL!» → the ceremony; «Otra ronda» = the next world ----------
  const fin = next(host2, 'fin:final', 4000);
  const ends = kids.slice(0, 3).filter((k) => k !== mateo).map((k) => next(k.s, 'game-end', 9000));
  const hostEnd = next(host2, 'game-end', 9000);
  host2.emit('host:end-now', { pin });
  ok((await fin).game === 'paint', '«¡FINAL!» on the projector');
  const he = await hostEnd;
  ok(he.fin && he.fin.game === 'paint' && he.fin.world === 1, 'the ceremony knows the world');
  ok((he.fin.stars || []).length <= 4 && (he.fin.stars || []).every((s) => ['painted', 'lm', 'streak', 'blaze'].includes(s.id)), 'Pintores\' stars');
  ok((he.fin.stars || []).some((s) => s.id === 'lm' && s.who.some((w) => w.name === 'Mateo')), '«Conquista maravillas» goes to Mateo (he captured the island)');
  const cards = await Promise.all(ends);
  cards.forEach((c) => ok(c.me && c.me.k && typeof c.me.lms === 'number' && typeof c.me.painted === 'number', 'every phone its card with clouds and islands'));
  const wNext = next(host2, 'pc:world', 4000);
  host2.emit('host:reset', { pin });
  ok((await wNext).world === 2, '«Otra ronda»: the next world (El río Li)');
  const init2 = next(host2, 'pc:init', 9000);
  host2.emit('host:start', { pin });
  const i2 = await init2;
  ok(i2.world === 2 && PW.build(i2.world, i2.seed).id === 'rio' && i2.own.every((c) => c === 0), 'the new round: El río Li, a white sky');
  host2.emit('host:end-now', { pin });
  await sleep(500);
  [host, host2, m2, nico].concat(kids.map((k) => k.s)).forEach((s) => s.close());
  console.log(`paint live: all ${checks} checks passed`);
  process.exit(0);
})();
