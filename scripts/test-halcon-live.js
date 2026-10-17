// Live check of Ojos de Halcón's server timing against a RUNNING local server (never the live site):
//   node scripts/test-halcon-live.js --url http://localhost:3500
// One teacher + 5 kids (one board of 5): skip in the intro, pause holds the round (no resolve, looks refused, the clock
// stands still), resume, rivals and the projector learn only «ready» (never a window) until the reveal, a double
// «Saltar» never skips the result, a kid who drops and rejoins mid-round keeps seat + look, «+5 rondas», «Terminar» while paused ends at once, a projector that reconnects after the end gets its finale
// again, «Otra ronda» starts a clean game, «Terminar» during «¡FINAL!» is ignored and the finale still comes.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:3500';
// creating a room needs a teacher (2026-10-15): the teacher code of the server under test (--password or TEST_TEACHER_PW)
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const SET = 'pack:yct1-familia-r1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const connect = () => io(URL, { transports: ['websocket'], forceNew: true });
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
// wait for the next `ev` on socket s (optionally matching), with a timeout that fails the test
function next(s, ev, ms, match) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { s.off(ev, h); rej(new Error(`timeout waiting for ${ev}`)); }, ms || 8000);
    function h(d) { if (match && !match(d)) return; clearTimeout(t); s.off(ev, h); res(d); }
    s.on(ev, h);
  });
}
// true if `ev` does NOT arrive within ms
function none(s, ev, ms) {
  return new Promise((res) => {
    let seen = false;
    const h = () => { seen = true; };
    s.on(ev, h);
    setTimeout(() => { s.off(ev, h); res(!seen); }, ms);
  });
}

// hidden looks (his decision 2026-10-14): no screen may get another player's window before the reveal
const leaks = [];
function guard(s, who) {
  s.onAny((ev, d) => {
    if (ev === 'hc:look') leaks.push(who + ': hc:look');
    if (ev === 'hc:ready' && d && 'pos' in d) leaks.push(who + ': hc:ready with a window');
    if (ev === 'hc:init' && d && 'looks' in d) leaks.push(who + ': hc:init with looks');
  });
}

(async () => {
  const host = connect();
  guard(host, 'host');
  const { pin, hostToken } = await ack(host, 'host:create', { gameType: 'halcon', password: PASSWORD });
  ok(pin, 'room created');
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded && loaded.ok, 'pack loaded');
  host.emit('host:hc-rounds', { pin, rounds: 10 });
  const kids = [];
  for (let i = 0; i < 5; i++) {
    const s = connect();
    const name = 'Live' + i;
    const j = await ack(s, 'player:join', { pin, name, avatar: '🐉' });
    ok(j && j.ok, name + ' joined');
    kids.push({ s, name, init: null });
    s.on('hc:init', (d) => { kids[i].init = d; });
    guard(s, name);
  }

  // start: everyone is dealt into one board of 5 during the countdown
  host.emit('host:start', { pin });
  const hi = await next(host, 'hc:init', 3000);
  ok(hi.phase === 'countdown' && hi.boards.length === 1 && hi.boards[0].seats.length === 5, '5 kids = one board of 5, dealt at «Empezar»');
  await next(host, 'hc:intro', 6000);
  await sleep(750);
  host.emit('host:hc-skip', { pin });                                   // «Saltar» in the intro → round 1 at once
  const q1 = await next(host, 'hc:q', 1200);
  ok(q1.round === 1, 'skip in the intro starts round 1');

  // pause in the answer window: nothing resolves, looks are refused, the clock stands still
  const open1 = await next(host, 'hc:open', 4000);
  await sleep(1000);
  host.emit('host:pause', { pin, paused: true });
  const p1 = await next(host, 'hc:pause', 2000);
  ok(p1.paused && p1.phase === 'answer', 'pause during the answer window');
  kids[0].s.emit('player:hc-look', { pin, pos: open1.opts.findIndex((o) => o != null) });
  const refused = await next(kids[0].s, 'hc:mine', 2000);
  ok(refused.status === 'closed', 'a look during the pause is refused');
  ok(await none(host, 'hc:resolve', 2500), 'no resolve while paused');
  kids[1].s.emit('player:resync', { pin });
  const rs = await next(kids[1].s, 'hc:init', 2000);
  ok(rs.paused && Math.abs(rs.phaseMs - p1.phaseMs) < 300, `the clock stands still while paused (${p1.phaseMs} → ${rs.phaseMs} ms)`);
  host.emit('host:pause', { pin, paused: false });
  const p2 = await next(host, 'hc:pause', 2000);
  ok(!p2.paused && p2.phaseMs > 3000, 'resume gives back the time left');

  // a kid looks: the board's other phones and the projector learn only that this kid is READY (never the window)
  const seat2 = kids[2].init && kids[2].init.you;
  const rival = next(kids[3].s, 'hc:ready', 2000);
  const proj = next(host, 'hc:ready', 2000);
  kids[2].s.emit('player:hc-look', { pin, pos: 0 });
  const m2 = await next(kids[2].s, 'hc:mine', 2000);
  ok(m2.status === 'ok', 'look sent');
  const rv = await rival, pv = await proj;
  ok(rv.id === seat2 && !('pos' in rv), 'a rival phone gets «ready» for that seat, without the window');
  ok(pv.id === seat2 && !('pos' in pv), 'the projector gets «ready» too, without the window');
  kids[1].s.emit('player:resync', { pin });
  const rs1 = await next(kids[1].s, 'hc:init', 2000);
  ok(rs1.ready.includes(seat2) && rs1.mine == null && !('looks' in rs1), 'a rival snapshot lists who is ready, no windows');
  // … drops, and comes back on a new socket: same seat, same look
  const before = kids[2].init && kids[2].init.you;
  kids[2].s.close();
  await sleep(300);
  const s2 = connect();
  s2.on('hc:init', (d) => { kids[2].init = d; });
  const rj = await ack(s2, 'player:join', { pin, name: kids[2].name, avatar: '🐉' });
  ok(rj.ok && rj.rejoined, 'rejoin with the same name');
  const ri = await next(s2, 'hc:init', 2000);
  ok(ri.you === before, 'a rejoin keeps the seat');
  ok(ri.mine === 0 && ri.ready.includes(ri.you), 'a rejoin keeps the look of the round (its own window)');
  kids[2].s = s2;
  guard(s2, 'Live2b');

  // double «Saltar»: the first resolves, the second (too soon) must not skip the result
  const kres = next(kids[3].s, 'hc:resolve', 1500);
  host.emit('host:hc-skip', { pin });
  host.emit('host:hc-skip', { pin });
  const hres = await next(host, 'hc:resolve', 1500);
  const r2 = hres.boards[0].rows.find((r) => r.id === seat2);
  ok(r2 && r2.pos === 0, 'the reveal shows every window (the projector)');
  const kr = await kres;
  ok(kr.board.rows.find((r) => r.id === seat2).pos === 0, 'the reveal shows every window (a rival phone)');
  ok(await none(host, 'hc:q', 600), 'a double «Saltar» does not jump over the result');

  // «+5 rondas»
  host.emit('host:hc-more', { pin });
  const more = await next(host, 'hc:rounds', 2000);
  ok(more.rounds === 15, '+5 rondas → 15');

  // «Terminar» while paused: straight to the end (the pause holds every timer)
  await next(host, 'hc:q', 5000);
  host.emit('host:pause', { pin, paused: true });
  await next(host, 'hc:pause', 2000);
  const ends = kids.map((k) => next(k.s, 'game-end', 3000));
  host.emit('host:end-now', { pin });
  const he = await next(host, 'game-end', 3000);
  ok(he.halcon && he.halcon.boards.length === 1 && Array.isArray(he.halcon.top), 'the projector gets the class result');
  const ke = await Promise.all(ends);
  ke.forEach((d, i) => ok(d.me && d.halcon.boards[0].rows.some((r) => r.id === d.me.id), `kid ${i} gets their board and their place`));

  // a projector that reconnects after the end gets the finale again
  const host2 = connect();
  guard(host2, 'host2');
  const again = next(host2, 'game-end', 3000);
  const rc = await ack(host2, 'host:reclaim', { pin, hostToken });
  ok(rc.ok && rc.state === 'ended', 'reclaim after the end');
  const ge2 = await again;
  ok(ge2.halcon && ge2.halcon.boards.length === 1, 'the reconnected projector gets its finale again');

  // «Otra ronda» → a clean second game; «Terminar» during «¡FINAL!» is ignored and the finale still comes
  host2.emit('host:reset', { pin });
  await sleep(300);
  host2.emit('host:start', { pin });
  const i2 = await next(host2, 'hc:init', 3000);
  ok(i2.id !== hi.id && i2.round === 0 && i2.boards[0].seats.every((s) => s.score === 0), '«Otra ronda»: a new game, everyone at 0');
  await next(host2, 'hc:intro', 6000);
  await next(host2, 'hc:q', 4000);
  host2.emit('host:end-now', { pin });
  await next(host2, 'hc:finish', 2000);
  await sleep(300);
  host2.emit('host:end-now', { pin });                                 // a second «Terminar» during «¡FINAL!»
  ok(await none(host2, 'game-end', 1500), '«Terminar» during «¡FINAL!» does not cut the moment short');
  const g3 = await next(host2, 'game-end', 3000);
  ok(g3.halcon.winners.length === 0, 'nobody scored: nobody is the winner');

  ok(leaks.length === 0, 'no window reached any screen before the reveal' + (leaks.length ? ': ' + leaks.join(', ') : ''));
  [host, host2, ...kids.map((k) => k.s)].forEach((s) => s.close());
  console.log(`test-halcon-live: ${checks} checks OK (${URL}, PIN ${pin})`);
  process.exit(0);
})().catch((e) => { console.error('test-halcon-live FAILED:', e.message); process.exit(1); });
