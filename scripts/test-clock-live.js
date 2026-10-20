// Live check of the teacher's clock «+30 s» / «−30 s» (his ask 2026-10-20: every pin game can take time away too)
// against a RUNNING local server (never the live site):
//   node scripts/test-clock-live.js --url http://localhost:3900 --password <teacher code>
// La Balanza de Oro (a game whose room tick owns the clock): «−30 s» moves the end, never below 10 s left, the last
// 30 s start as if the clock got there, a cut with nothing left to take changes nothing, «+30 s» still works.
// Reinos de Colores (the server's g.endsAt clock): the cut moves the round's end, the projector hears «−30 segundos»
// (host:time-cut) or why not (host:time-refused), the last-30-s moment starts, a kid cannot cut. Las Trampillas:
// «−30 s» = 2 rondas menos, never below the next round. Ojos de Halcón: «−5 rondas», never below the next round.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:3900';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
process.on('unhandledRejection', (e) => { console.error('FAIL', e && e.message ? e.message : e); process.exit(1); });
const socks = [];
const connect = () => { const s = io(URL, { transports: ['websocket'], forceNew: true }); socks.push(s); return s; };
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
function next(s, ev, ms, match) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => { s.off(ev, h); rej(new Error(`${section}: timeout waiting for ${ev}`)); }, ms || 8000);
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
let section = "";
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1500);
async function room(gameType, extra) {
  const host = connect();
  const { pin } = await ack(host, 'host:create', Object.assign({ gameType, password: PASSWORD }, extra || {}));
  ok(pin, gameType + ': room created');
  if (gameType !== 'sixseven') ok((await ack(host, 'host:load-set', { pin, setId: 'pack:yct1-familia-r1' })).ok, gameType + ': the pack loads');
  const kids = [];
  for (let i = 0; i < 2; i++) {
    const s = connect();
    const j = await ack(s, 'player:join', { pin, name: 'Reloj' + i + gameType.slice(0, 3), avatar: '🐉' });
    ok(j && j.ok !== false, gameType + ': kid ' + i + ' joined');
    kids.push(s);
  }
  return { host, pin, kids };
}

(async () => {
  section = '6-7';
  // ── La Balanza de Oro (sixseven): its room tick owns the clock ──
  {
    const { host, pin, kids } = await room('sixseven', { style: 'num' });
    host.emit('host:set-duration', { pin, duration: 120 });
    await sleep(300);
    host.emit('host:start', { pin });
    await next(host, 'ss:init', 8000);
    await sleep(400);
    host.emit('host:ss-skip', { pin });
    const play = await next(host, 'ss:play', 2000);
    ok(play.endsMs > 110000, `6-7: playing (${play.endsMs} ms left)`);
    const t1P = next(kids[0], 'ss:time', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    const t1 = await t1P;
    ok(t1.add === -30 && near(t1.endsMs, play.endsMs - 30000, 2500), `6-7: «−30 s» takes 30 s away, the phones hear it (${t1.endsMs} ms left)`);
    ok(t1.frenzyMs > 0, '6-7: still more than 30 s left: no last-30-s moment yet');
    const t2P = next(host, 'ss:time', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    const t2 = await t2P;
    ok(t2.add === -30 && near(t2.endsMs, t1.endsMs - 30000, 2500), `6-7: a second cut (${t2.endsMs} ms left)`);
    const t3P = next(host, 'ss:time', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    const t3 = await t3P;
    ok(t3.add === -30 && t3.endsMs < 30000, `6-7: a third cut lands inside the last 30 s (${t3.endsMs} ms left)`);
    ok(t3.frenzyMs === 0 || t3.frenzy, '6-7: the frenzy starts as if the clock got there');
    const t4cP = next(host, 'ss:time', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    const t4c = await t4cP;
    ok(t4c.add < 0 && t4c.add > -30 && near(t4c.endsMs, 10000, 1500), `6-7: a cut never goes below 10 s left (${t4c.add} s, ${t4c.endsMs} ms left)`);
    host.emit('host:add-time', { pin, seconds: -30 });
    ok(await none(host, 'ss:time', 1200), '6-7: nothing left to take: nothing changes');
    kids[0].emit('host:add-time', { pin, seconds: -30 });
    ok(await none(host, 'ss:time', 800), '6-7: a kid cannot touch the clock');
    const t4P = next(host, 'ss:time', 2000);
    host.emit('host:add-time', { pin, seconds: 30 });
    const t4 = await t4P;
    ok(t4.add === 30 && t4.endsMs > 30000, `6-7: «+30 s» still adds (${t4.endsMs} ms left)`);
    host.emit('host:end-now', { pin });
    await sleep(300);
  }

  section = 'Reinos';
  // ── Reinos de Colores (kingdoms): the server's g.endsAt clock ──
  {
    const { host, pin, kids } = await room('kingdoms');
    let last = null;
    host.on('state', (s) => { last = s; });
    host.emit('host:set-duration', { pin, duration: 120 });
    await sleep(300);
    const act = next(host, 'state', 12000, (s) => s.state === 'active' && s.endsAt);
    host.emit('host:start', { pin });
    const s0 = await act;
    const end0 = s0.endsAt;
    const cutP = next(host, 'host:time-cut', 2000);
    const stP = next(host, 'state', 2000, (s) => s.endsAt && s.endsAt < end0 - 20000);
    host.emit('host:add-time', { pin, seconds: -30 });
    const cut = await cutP;
    const s1 = await stP;
    ok(cut.add === -30, 'Reinos: the projector hears «−30 segundos»');
    ok(s1.endsAt === end0 - 30000 && s1.duration === s0.duration, 'Reinos: the end moved 30 s, the round\'s length stays the teacher\'s pick');
    const frP = next(kids[0], 'fin:frenzy', 4000, (d) => !d.off);
    const c2P = next(host, 'host:time-cut', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    await c2P;
    const c3P = next(host, 'host:time-cut', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    await c3P;
    const fr = await frP;
    ok(fr.endsMs <= 30000, `Reinos: inside the last 30 s the «¡Final!» moment starts on the phones (${fr.endsMs} ms)`);
    const refP = next(host, 'host:time-refused', 2000);
    for (let i = 0; i < 3; i++) { host.emit('host:add-time', { pin, seconds: -30 }); await sleep(150); }
    const ref = await refP;
    ok(ref && ref.cut, 'Reinos: nothing left to take: the projector hears why');
    const sNow = last;     // (no broadcast after a refused cut: the last one the projector got)
    ok(sNow.state === 'active' && sNow.endsAt - Date.now() > 7000, 'Reinos: cuts stop 10 s before the end: the round is still on');
    kids[1].emit('host:add-time', { pin, seconds: -30 });
    ok(await none(host, 'host:time-cut', 800), 'Reinos: a kid cannot touch the clock');
    host.emit('host:end-now', { pin });
    await sleep(300);
  }

  section = 'Trampillas';
  // ── Las Trampillas (trapdoor): «−30 s» = 2 rondas menos ──
  {
    const { host, pin } = await room('trapdoor');
    ok((await ack(host, 'host:td-rounds', { pin, rounds: 7 })).rounds === 7, 'Trampillas: 7 rounds');
    const ini = next(host, 'td:init', 9000);
    host.emit('host:start', { pin });
    await ini;
    await sleep(300);
    const r1P = next(host, 'td:rounds', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    const r1 = await r1P;
    ok(r1.cut && r1.rounds === 5 && !r1.refused, 'Trampillas: «−30 s» = 2 rondas menos (7 → 5)');
    const r2P = next(host, 'td:rounds', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    ok((await r2P).rounds === 3, 'Trampillas: 5 → 3');
    const r3P = next(host, 'td:rounds', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    const r3 = await r3P;
    ok(r3.rounds === 2 && !r3.refused, 'Trampillas: never fewer than 2 rounds (3 → 2)');
    const r4P = next(host, 'td:rounds', 2000);
    host.emit('host:add-time', { pin, seconds: -30 });
    const r4 = await r4P;
    ok(r4.refused && r4.why === 'min' && r4.rounds === 2, 'Trampillas: nothing left to take: refused with its reason');
    const r5P = next(host, 'td:rounds', 2000);
    host.emit('host:add-time', { pin, seconds: 30 });
    ok((await r5P).rounds === 4, 'Trampillas: «+30 s» still adds 2 rounds');
    host.emit('host:end-now', { pin });
    await sleep(300);
  }

  section = 'Halcón';
  // ── Ojos de Halcón (halcon): «−5 rondas» ──
  {
    const { host, pin } = await room('halcon');
    host.emit('host:hc-rounds', { pin, rounds: 15 });
    await sleep(300);
    host.emit('host:start', { pin });
    await next(host, 'hc:init', 4000);
    await next(host, 'hc:intro', 6000);
    await sleep(700);
    host.emit('host:hc-skip', { pin });
    const q1 = await next(host, 'hc:q', 2000);
    ok(q1.round === 1, 'Halcón: round 1');
    const h1P = next(host, 'hc:rounds', 2000);
    host.emit('host:hc-less', { pin });
    const h1 = await h1P;
    ok(h1.rounds === 10 && h1.cut, 'Halcón: «−5 rondas» (15 → 10)');
    const h2P = next(host, 'hc:rounds', 2000);
    host.emit('host:hc-less', { pin });
    ok((await h2P).rounds === 5, 'Halcón: 10 → 5');
    const h3P = next(host, 'hc:rounds', 2000);
    host.emit('host:hc-less', { pin });
    ok((await h3P).rounds === 2, 'Halcón: never below the next round (5 → 2 in round 1)');
    host.emit('host:hc-less', { pin });
    ok(await none(host, 'hc:rounds', 1000), 'Halcón: nothing left to take: nothing changes');
    host.emit('host:end-now', { pin });
    await sleep(300);
  }

  socks.forEach((s) => s.close());
  console.log(`test-clock-live: all ${checks} checks passed`);
  process.exit(0);
})();
