// Live check of La Gran Fuga v2 «Las rutas de la fuga» against a RUNNING local server (never the live site):
//   node scripts/test-escape-live.js --url http://localhost:4580 --password <the local teacher code>
// One teacher + 4 kids: the teacher picks the route in the lobby (only the projector may; a route that does not exist is
// refused; every phone learns it); every screen gets the round's route, zone, seed and the kid's own number; a right
// answer is a turbo (the projector hears its name); the crew reaches the zona segura and its waves light up; «Pausa»
// freezes the wave clock and «+30 s» moves the bell; no route change while playing; «Saltar zona» moves the episode on to
// the route's next place; the projector's F5 (a new socket with the room token) gets the episode back; a late joiner
// gets its number and the room; «Terminar» → «¡FINAL!» → the ceremony names the route's own places and rank; «Otra
// ronda» = the next route.
// The chase pass (2026-10-19): every phone hears its OWN Robotín a few times a second and he comes closer while its
// question is open; a right answer = a dash away, a wrong one = he gains; a kid who keeps missing gets zapped (her phone
// only, the projector hears who), a phone back mid-stun gets its lock with the time left, the lock ends by itself (then
// her shield) and she answers again.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');
const E = require('../core/escape');
const M = require('../public/js/escape-map');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:4580';
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

(async () => {
  const set = await fetch(URL + '/api/sets/' + encodeURIComponent(SET)).then((r) => r.json());
  const correctOf = (q) => { const x = set.questions.find((y) => y.text === q.text); return x ? q.answers.indexOf(x.correct) : -1; };
  ok(set.questions.length > 5, 'the pack loads');

  // ---------- the room, the route picked in the lobby ----------
  let host = connect();
  const { pin, hostToken } = await ack(host, 'host:create', { gameType: 'escape', password: PASSWORD });
  ok(pin && hostToken, 'a PIN and the projector\'s room token');
  ok((await ack(host, 'host:load-set', { pin, setId: SET })).ok, 'the pack loads into the room');
  host.emit('host:set-duration', { pin, duration: 240 });
  const kids = [];
  const join = async (name) => {
    const s = connect();
    const kid = { s, name, q: null, init: null, results: [], route: null, states: [] };
    s.on('question', (q) => { kid.q = q; });
    s.on('es:init', (d) => { kid.init = d; });
    s.on('es:route', (d) => { kid.route = d.route; });
    s.on('state', (st) => kid.states.push(st));
    s.on('answer-result', (r) => kid.results.push(r));
    const j = await ack(s, 'player:join', { pin, name });
    ok(j && j.ok !== false, `${name} joins`);
    kids.push(kid);
    return kid;
  };
  for (const name of ['Sofi', 'Mateo', 'Valen', 'Lucas']) await join(name);
  const [sofi] = kids;
  const routeSeen = next(sofi.s, 'es:route', 4000);
  const rAck = await ack(host, 'host:es-route', { pin, route: 1 });
  ok(rAck && rAck.ok && rAck.route === 1, 'the teacher picks the China route in the lobby');
  ok((await routeSeen).route === 1, 'every phone hears the route');
  ok(!(await ack(host, 'host:es-route', { pin, route: 7 })).ok, 'a route that does not exist is refused');
  ok(!(await ack(host, 'host:es-route', { pin, route: -1 })).ok, '… nor a negative one');
  const stranger = connect();
  const kAck = await ack(stranger, 'host:es-route', { pin, route: 0 });
  ok(!kAck || !kAck.ok, 'only the room\'s projector picks the route');
  stranger.close();
  await sleep(300);
  const lastState = sofi.states[sofi.states.length - 1];
  ok(lastState && lastState.esRoute === 1, 'the lobby state carries the route (a phone that joins late sees it)');

  // ---------- the round starts on the China route ----------
  const inits = kids.map((k) => next(k.s, 'es:init', 9000));
  const hostInit = next(host, 'es:init', 9000);
  host.emit('host:start', { pin });
  await Promise.all(inits);
  const hi = await hostInit;
  ok(hi.route === 1 && hi.zone === 'mercado' && hi.level === 1 && hi.phase === 'run', 'the projector: China route, El Mercado Nocturno, running');
  ok(hi.me == null && Object.keys(hi.players).length === 4, 'the projector knows the whole crew (no number of its own)');
  kids.forEach((k) => {
    ok(k.init.route === 1 && k.init.seed === hi.seed && k.init.round === hi.round, `${k.name}: the same route, seed and round`);
    ok(k.init.me && k.init.me.idx > 0 && hi.players[k.init.me.idx].name === k.name, `${k.name}: knows its own number`);
  });
  ok(!(await ack(host, 'host:es-route', { pin, route: 0 })).ok, 'no route change while the class plays');

  // ---------- answering: right = a turbo, the projector hears the name ----------
  const answer = async (k, right) => {
    for (let i = 0; i < 40 && !k.q; i++) await sleep(100);
    const q = k.q; if (!q) return null;
    k.q = null;
    const c = correctOf(q);
    const choice = right ? c : (c + 1) % q.answers.length;
    const res = next(k.s, 'answer-result', 4000);
    k.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: choice });
    return res;
  };
  const turboHeard = next(host, 'es:turbo', 6000);
  const r1 = await answer(sofi, true);
  ok(r1 && r1.correct && r1.escape && r1.escape.turbo, 'a right answer is a turbo for the crew');
  const th = await turboHeard;
  ok(th.name === 'Sofi' && th.idx === sofi.init.me.idx, 'the projector pops the name of the kid who gave it');
  const r2 = await answer(kids[1], false);
  ok(r2 && !r2.correct && !r2.escape.turbo, 'a wrong answer is no turbo (nothing lost)');

  // ---------- the chase pass (2026-10-19): each kid's own Robotín ----------
  ok(typeof r1.escape.gap === 'number' && r1.escape.gap > r1.escape.from, `a right answer: I dash away from MY Robotín (${r1.escape.from} → ${r1.escape.gap} m)`);
  ok(typeof r2.escape.gap === 'number' && r2.escape.gap < r2.escape.from, `a wrong answer: he gains on me (${r2.escape.from} → ${r2.escape.gap} m)`);
  ok(hi.chase && hi.chase.g0 === E.R.CH_G0 && sofi.init.me.ch && sofi.init.me.ch.g === E.R.CH_G0, 'every phone starts with its own Robotín 14 m back (the numbers come from the server)');
  const awake = await next(kids[2].s, 'es:g', 8000, (c) => c.v > 0);      // (asleep the first 3 s of a run)
  ok(awake && awake.v > 0, `Robotín wakes up and comes for Valen (${awake.v} m/s)`);
  const gs = [awake];
  const onG = (c) => gs.push(c);
  kids[2].s.on('es:g', onG);
  await sleep(1500);
  kids[2].s.off('es:g', onG);
  ok(gs.length >= 4, `my phone hears MY Robotín a few times a second (${gs.length - 1} in 1.5 s)`);
  ok(gs[gs.length - 1].g < gs[0].g || gs.some((c) => c.lu > 0), `my question open: he comes closer (${gs[0].g} → ${gs[gs.length - 1].g} m)`);
  // Valen keeps missing: he catches HER (a zap on her phone only), her tiles lock 1.8 s, then her shield; a phone that
  // reconnects mid-stun gets the lock back with the time left; the crew loses nothing
  const valen = kids[2];
  // every zap a phone hears must be its own: count them on every phone and on the projector (who + how many)
  const phonePz = [];
  const watchAll = kids.map((k) => { const h = () => phonePz.push(k.init.me.idx); k.s.on('es:pzap', h); return [k, h]; });
  const hostPz = [];
  host.on('es:pzap', (d) => hostPz.push(d));
  const pz = next(valen.s, 'es:pzap', 45000);
  // she misses until he is right behind her (each miss = he gains 2.5 m), then she hesitates on the next question
  let misses = 0, last = null;
  for (let i = 0; i < 10 && !(last && last.escape.gap <= 2); i++) { last = await answer(valen, false).catch(() => null); if (last) misses++; }
  ok(last && last.escape.gap <= 2, `after ${misses} misses he is right behind her (${last && last.escape.gap} m)`);
  const zap = await pz;
  ok(zap && zap.stunMs === E.R.CH_STUN_MS && zap.shieldMs === E.R.CH_SHIELD_MS, `he reaches Valen: a zap on her phone (stunned ${zap.stunMs} ms, then a ${zap.shieldMs} ms shield) after ${misses} misses`);
  // an answer that arrives during her stun (a tap in flight when the zap landed) is not judged: no dash over the zap,
  // the question stays hers
  for (let i = 0; i < 20 && !valen.q; i++) await sleep(50);
  const inFlight = valen.q;
  ok(inFlight, 'her question is still open when he zaps her');
  const stale = next(valen.s, 'answer-stale', 1500);
  const judged = [];
  const onRes = (r) => judged.push(r);
  valen.s.on('answer-result', onRes);
  valen.s.emit('player:answer', { pin, qid: inFlight.qid, choiceIdx: correctOf(inFlight) });
  const st = await stale;
  await sleep(250);
  valen.s.off('answer-result', onRes);
  ok(st && st.reason === 'stunned' && !judged.length, `an answer during the stun is refused («${st && st.reason}», no dash, ${judged.length} judged)`);
  await sleep(300);
  ok(hostPz.some((d) => d.idx === valen.init.me.idx && d.name === 'Valen'), 'the projector hears who Robotín zapped');
  watchAll.forEach(([k, h]) => k.s.off('es:pzap', h));
  const fromHost = hostPz.map((d) => d.idx).sort().join(','), onPhones = phonePz.slice().sort().join(',');
  ok(fromHost === onPhones, `each zap reached only the zapped kid's phone (projector ${fromHost} · phones ${onPhones})`);
  // reconnect mid-stun: a new socket, the same name → es:init carries her lock with the time left
  valen.s.close();
  await sleep(80);           // (the old connection closes first; short: she is still stunned for 1.8 s)
  const s2 = connect();
  const reInit = next(s2, 'es:init', 5000);
  valen.s = s2; valen.q = null;
  s2.on('question', (q) => { valen.q = q; });
  s2.on('answer-result', (r) => valen.results.push(r));
  await ack(s2, 'player:join', { pin, name: 'Valen' });
  const ri = await reInit;
  ok(ri.me && ri.me.ch && ri.me.ch.st > 0 && ri.me.ch.st <= E.R.CH_STUN_MS, `back mid-stun: the phone gets its lock again (${ri.me && ri.me.ch && ri.me.ch.st} ms left)`);
  ok(ri.me.pzaps === 1, 'and knows it was zapped once');
  for (let i = 0; i < 20 && !valen.q; i++) await sleep(50);
  ok(valen.q && valen.q.qid === inFlight.qid, 'the same question comes back to the phone (still hers after the stun)');
  // the lock ends by itself; her question is still hers and answering works again
  const free = await next(s2, 'es:g', 5000, (c) => c.st === 0);
  ok(free && free.sh > 0, `the stun ends by itself, her shield is up (${free.sh} ms)`);
  for (let i = 0; i < 30 && !valen.q; i++) await sleep(100);
  const r3 = await answer(valen, true);
  ok(r3 && r3.correct && typeof r3.escape.gap === 'number', 'after the stun she answers again (never out of play)');
  // the phone's own 12 s resync (same socket) is no reconnect: it never hands out a free shield (classroom playtest)
  await next(s2, 'es:g', 8000, (c) => c.sh === 0);
  const rs = next(s2, 'es:init', 4000);
  s2.emit('player:resync', { pin });
  const rsi = await rs;
  ok(rsi.me && rsi.me.ch && rsi.me.ch.sh === 0, `a resync of the same phone gets no shield (${rsi.me && rsi.me.ch && rsi.me.ch.sh} ms)`);

  // everyone answers right until the crew reaches the zona segura
  let zone = null;
  const waves = [];
  host.on('es:phase', (d) => { if (d.phase === 'zone' && !zone) zone = d; });
  host.on('es:wave', (w) => waves.push(w));
  const t0 = Date.now();
  while (!zone && Date.now() - t0 < 70000) {
    await Promise.all(kids.map((k) => answer(k, true).catch(() => null)));
  }
  ok(zone && zone.route === 1 && zone.zone === 'mercado', `the crew reaches the zona segura of El Mercado Nocturno (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  ok(zone.pos.length === 4, 'every kid stands in the room');
  const room = M.buildRoom(hi.seed, 1, 1);
  zone.pos.forEach(([, x, y]) => ok(!M.boxBlocked(room, x, y), 'each kid stands on open floor of the route\'s room'));

  // ---------- the waves, «Pausa», «+30 s» ----------
  for (let i = 0; i < 80 && !waves.length; i++) await sleep(100);
  const wave = waves[0];
  ok(wave, 'the first wave lights up');
  ok(wave.wave === 1 && wave.zones.length === 3 && wave.zones.every((z) => M.blockFree(room, z.x, z.y, z.w, z.h)), 'wave 1: three green zones on open floor');
  const p1 = next(host, 'es:pause', 3000, (d) => d.paused);
  host.emit('host:pause', { pin, paused: true });
  const pd = await p1;
  ok(pd.paused && pd.waveMs > 0, 'Pausa: the wave clock stops with time left');
  await sleep(1200);
  const before = sofi.states.filter((x) => x.endsAt).pop();
  host.emit('host:add-time', { pin, seconds: 30 });
  let st1 = null;
  for (let i = 0; i < 40 && !st1; i++) { await sleep(100); st1 = sofi.states.find((x) => x.endsAt >= before.endsAt + 29000); }
  ok(before && st1, '+30 s moves the bell (every phone hears the new end)');
  const p2 = next(host, 'es:pause', 3000, (d) => !d.paused);
  host.emit('host:pause', { pin, paused: false });
  const pd2 = await p2;
  ok(!pd2.paused && Math.abs(pd2.waveMs - pd.waveMs) < 600, 'Seguir: the wave goes on where it stopped');

  // ---------- «Saltar zona»: on to the route's next place ----------
  const skipped = next(host, 'es:moment', 4000, (m) => m.type === 'skip');
  const cleared = next(host, 'es:phase', 9000, (d) => d.phase === 'cleared');
  host.emit('host:es-skip', { pin });
  await skipped;
  const cl = await cleared;
  ok(cl.clearedLevel === 1 && cl.level === 2 && cl.zone === 'jardin', 'Saltar zona: level 1 cleared, next is El Jardín Chino');
  const run2 = await next(host, 'es:phase', 9000, (d) => d.phase === 'run');
  ok(run2.level === 2 && run2.zone === 'jardin' && run2.route === 1 && run2.crew === 0, 'the crew runs again, now through the garden');

  // ---------- the projector's F5: the same room back with its token ----------
  host.close();
  await sleep(400);
  host = connect();
  const back = next(host, 'es:init', 6000);
  const rc = await ack(host, 'host:reclaim', { pin, hostToken });
  ok(rc && rc.ok && rc.gameType === 'escape' && rc.state === 'active', 'F5: the projector takes the same room back');
  const bi = await back;
  ok(bi.route === 1 && bi.level === 2 && bi.zone === 'jardin' && bi.round === hi.round, '… and the episode where it was');

  // ---------- a late joiner ----------
  const late = await join('Noor');
  for (let i = 0; i < 40 && !late.init; i++) await sleep(100);
  ok(late.init && late.init.route === 1 && late.init.me && late.init.me.idx === 5, 'a late joiner gets the route and its own number');
  const ros = await next(host, 'es:roster', 4000, (d) => d.players && d.players[5]);
  ok(ros.players[5].name === 'Noor', 'the projector learns the late joiner');

  // ---------- «Terminar» → «¡FINAL!» → the ceremony with the route's own places and rank ----------
  const fin = next(host, 'fin:final', 4000);
  const endH = next(host, 'game-end', 12000);
  const endK = next(sofi.s, 'game-end', 12000);
  host.emit('host:end-now', { pin });
  await fin;
  const eh = await endH, ek = await endK;
  ok(eh.fin && eh.fin.extra && eh.fin.extra.route === 1, 'the ceremony knows the route');
  ok(['Pilotos del Cielo', 'Viajeros de la Muralla', 'Exploradores del Mercado'].includes(eh.fin.extra.rank.name), `the China route's rank (${eh.fin.extra.rank.name})`);
  ok(eh.fin.extra.rank.art && eh.fin.extra.levelsCleared === 1, 'the rank has its picture; one zone cleared');
  ok(ek.me && ek.me.turbos >= 1 && ek.fin.extra.route === 1, 'Sofi\'s card: her turbos, the same route');

  // ---------- «Otra ronda» = the next route ----------
  const nextRoute = next(sofi.s, 'es:route', 4000);
  host.emit('host:reset', { pin });
  ok((await nextRoute).route === 0, 'Otra ronda: back to the Dubái route (the next one)');
  ok(E.R.WAVE_MS[0][0] <= 10000, 'the waves are the shorter v2 ones');

  kids.forEach((k) => k.s.close());
  host.close();
  console.log(`escape-live: all ${checks} checks passed`);
  process.exit(0);
})();
