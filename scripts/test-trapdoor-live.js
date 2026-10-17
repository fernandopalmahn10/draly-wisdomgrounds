// Live check of Las Trampillas against a RUNNING local server (never the live site):
//   node scripts/test-trapdoor-live.js --url http://localhost:4600 --password <the local teacher code>
// One teacher + 4 kids (+ a late joiner): the lobby's arena and rounds (only the projector picks); every screen gets the
// same arena and roster; «⏭ Saltar» skips «¡YA!»; a tap is only an intent (clamped onto the floor, at most GO_RATE a
// second, nonsense ignored, no teleport); the round's plan never carries the drop; the wings question (a guess under
// 450 ms = wrong, «¡Casi!» waits 2 s); «0» closes an open wings question; the doors: a kid with wings on a falling slice
// is saved once, one without falls; the pit: a right answer after «0» = up at the next round (and a «rise with wings»
// question), a right answer early in a round = up at once (td:rise for every screen); the tally is each kingdom's share
// standing out of 10 (×2 in the Final Round); «⏸ Pausa» freezes the runners and hands answers back; «+30 s» = 2 rondas
// más (refused in the Final Round); a reconnect keeps the kid's place; a late joiner rises at the next round; the
// projector's F5 gets the platform back; a pit question nobody answers is closed by the server (time up); «Terminar» →
// «¡FINAL!» → the ceremony with each phone's card; «Otra ronda» = the next arena.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');
const T = require('../core/trapdoor');
const A = require('../public/js/trapdoor-arena');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:4600';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const SET = 'pack:yct1-familia-r1';
const R = T.R;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
process.on('unhandledRejection', (e) => { console.error('FAIL', e && e.message ? e.message : e); process.exit(1); });
const connect = () => io(URL, { transports: ['websocket'], forceNew: true });
const ack = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
// a question of `kind` that reached this kid at or after `since` (already here, or the next to come)
async function waitQ(kid, kind, since, ms) {
  const end = Date.now() + (ms || 4000);
  for (;;) {
    const q = kid.qs.slice().reverse().find((x) => x.td === kind && x.__at >= since);
    if (q) return q;
    if (Date.now() > end) throw new Error(`timeout waiting for a ${kind} question (${kid.name})`);
    await sleep(40);
  }
}
function next(s, ev, ms, match) {
  const where = (new Error().stack.split('\n')[2] || '').trim();
  return new Promise((res, rej) => {
    const t = setTimeout(() => { s.off(ev, h); rej(new Error(`timeout waiting for ${ev} (${s.__name || 'host'}, ${where})`)); }, ms || 8000);
    function h(d) { if (match && !match(d)) return; clearTimeout(t); s.off(ev, h); res(d); }
    s.on(ev, h);
  });
}

(async () => {
  const set = await fetch(URL + '/api/sets/' + encodeURIComponent(SET)).then((r) => r.json());
  const correctOf = (q) => { const x = set.questions.find((y) => y.text === q.text); return x ? q.answers.indexOf(x.correct) : -1; };
  ok(set.questions.length > 5, 'the pack loads');

  // ---------- the room, the lobby ----------
  const host = connect();
  const { pin, hostToken } = await ack(host, 'host:create', { gameType: 'trapdoor', password: PASSWORD });
  ok(pin && hostToken, 'a PIN and the projector\'s room token');
  ok((await ack(host, 'host:load-set', { pin, setId: SET })).ok, 'the pack loads into the room');
  const kids = [];
  function kidOn(s, name) {
    s.__name = name;
    const kid = { s, name, q: null, qs: [], init: null, pos: {}, posMsgs: [], results: [], me: null, closes: [] };
    s.on('question', (q) => { q.__at = Date.now(); kid.q = q; kid.qAt = Date.now(); kid.qs.push(q); });
    s.on('td:init', (d) => { kid.init = d; kid.k = d.me; (d.pos || []).forEach((r) => { kid.pos[r[0]] = r; }); });
    s.on('td:pos', (m) => { kid.posMsgs.push([Date.now(), m]); (m.d || []).forEach((r) => { kid.pos[r[0]] = r; }); });
    s.on('td:me', (d) => { kid.me = d; });
    s.on('td:qclose', (d) => kid.closes.push(d));
    s.on('answer-result', (r) => { kid.results.push([Date.now(), r]); if (kid.q && r) kid.q = null; });
    return kid;
  }
  for (const name of ['Sofi', 'Mateo', 'Valen', 'Lucas']) {
    const s = connect();
    const kid = kidOn(s, name);
    const j = await ack(s, 'player:join', { pin, name });
    ok(j && j.ok !== false, `${name} joins`);
    kid.team = j.team;
    kids.push(kid);
  }
  const [sofi, mateo, valen, lucas] = kids;
  ok(new Set(kids.map((k) => k.team)).size === 2, 'two kingdoms');
  const a1 = await ack(host, 'host:td-arena', { pin, arena: 1 });
  ok(a1 && a1.ok && a1.arena === 1, 'the teacher picks El Templo del Cielo in the lobby');
  ok(!(await ack(host, 'host:td-arena', { pin, arena: 7 })).ok, 'an arena that does not exist is refused');
  const kidArena = await ack(sofi.s, 'host:td-arena', { pin, arena: 2 });
  ok(!kidArena || !kidArena.ok, 'only the room\'s projector picks the arena');
  ok((await ack(host, 'host:td-rounds', { pin, rounds: 3 })).rounds === 3, 'the teacher picks 3 rounds');
  ok((await ack(host, 'host:td-rounds', { pin, rounds: 99 })).rounds === R.ROUNDS_MAX, 'rounds are capped at 15');
  ok((await ack(host, 'host:td-rounds', { pin, rounds: 3 })).rounds === 3, '…back to 3');
  const st0 = await new Promise((res) => { host.once('state', res); host.emit('host:set-duration', { pin, duration: 40 }); });
  ok(st0.tdArena === 1 && st0.tdRounds === 3, `the lobby state carries the arena and the rounds (a duration of 40 s fits ${st0.tdRounds})`);

  // ---------- the start: every screen the same platform; «⏭ Saltar» skips «¡YA!» ----------
  const caps = next(host, 'td:captains', 6000);
  const inits = kids.map((k) => next(k.s, 'td:init', 9000));
  const hostInit = next(host, 'td:init', 9000);
  host.emit('host:start', { pin });
  const cp = await caps;
  ok(cp.red && cp.gold && cp.red !== cp.gold, 'two of the gang captain the kingdoms');
  await Promise.all(inits);
  const hi = await hostInit;
  ok(hi.arena === 1 && hi.rounds === 3 && hi.phase === 'intro' && hi.me == null, 'the projector: the arena, 3 rounds, «¡YA!» (no character of its own)');
  ok(Object.keys(hi.roster).length === 4, 'the projector knows every kid');
  kids.forEach((k) => {
    ok(k.init.arena === 1 && k.init.me > 0 && k.init.roster[k.init.me][0] === k.name, `${k.name}: the same arena, knows which character is theirs`);
    ok(k.init.st === 'up', `${k.name}: on the floor from the start`);
    const p = k.init.pos.find((r) => r[0] === k.k);
    const r = Math.hypot(p[1], p[2]);
    ok(r >= A.R_MIN - 0.2 && r <= A.R_MAX + 0.2, `${k.name}: starts on the walkable ring`);
  });
  const r1p = next(host, 'td:round', 2000, (m) => m.r === 1);
  host.emit('host:td-skip', { pin });
  const r1 = await r1p;
  ok(r1.r === 1 && r1.kind === 'quarter' && !r1.final && r1.mult === 1, '«⏭ Saltar»: round 1 at once, a quarter drops');
  ok(!('set' in r1) && !('drop' in r1) && JSON.stringify(r1).indexOf('"s"') < 0, 'the round\'s plan never carries what will drop');
  ok(r1.jumps.length >= 8 && r1.jumps.every((j, i) => i === 0 || j[1] !== r1.jumps[i - 1][1]), 'the roulette: many places, never the same twice in a row');
  const r1At = Date.now() - r1.ago;
  const B = A.bounds(false);

  // ---------- the wings question (right at the start of round 1: answers need time before «0») ----------
  await sleep(150);
  ok(kids.every((k) => k.qs.length >= 1 && k.qs[0].td === 'wings'), 'round 1: every kid on the floor gets the wings question');
  // Valen: a right answer the moment it lands (a guess, under 450 ms) · Sofi: right (wings) · Mateo: wrong (waits 2 s) ·
  // Lucas: never answers
  const vq = valen.q;
  const res3 = next(valen.s, 'answer-result');
  valen.s.emit('player:answer', { pin, qid: vq.qid, choiceIdx: correctOf(vq) }, () => {});
  const rv = await res3;
  ok(!rv.correct && rv.td.why === 'fast', `a right answer faster than 450 ms counts as a guess (${Date.now() - valen.qAt} ms)`);
  const sq = sofi.q;
  const res1 = next(sofi.s, 'answer-result');
  await sleep(Math.max(0, 520 - (Date.now() - sofi.qAt)));
  sofi.s.emit('player:answer', { pin, qid: sq.qid, choiceIdx: correctOf(sq) }, () => {});
  const ra = await res1;
  ok(ra.correct && ra.td.wings && ra.td.kind === 'wings', 'Sofi answers right: wings');
  await sleep(150);
  ok(sofi.me && sofi.me.wings, 'her phone learns she has wings (td:me)');
  const mq = mateo.q;
  const res2 = next(mateo.s, 'answer-result');
  mateo.s.emit('player:answer', { pin, qid: mq.qid, choiceIdx: (correctOf(mq) + 1) % mq.answers.length }, () => {});
  const rb = await res2;
  ok(!rb.correct && rb.td.wait === R.WRONG_WAIT_MS && !rb.td.wings, '«¡Casi!»: no wings, the next question waits 2 s');
  const mq2 = await waitQ(mateo, 'wings', mateo.results[0][0], 3500);
  ok(mq2.td === 'wings' && Date.now() - mateo.results[0][0] >= R.WRONG_WAIT_MS - 150, 'the next wings question comes after the wait');

  // ---------- a tap is an intent ----------
  sofi.s.emit('player:td-go', { pin, x: 5000, y: -300 });
  await sleep(1300);
  let me = sofi.pos[sofi.k];
  ok(me && Math.abs(Math.hypot(me[3], me[4]) - A.R_MAX) < 0.3, `a tap outside the floor is clamped onto its rim (${me && Math.hypot(me[3], me[4]).toFixed(1)})`);
  let worst = 0;
  const mine = sofi.posMsgs.map(([, m]) => [m.t, (m.d || []).find((r) => r[0] === sofi.k)]).filter(([, r]) => r);
  for (let i = 1; i < mine.length; i++) {
    const dt = (mine[i][0] - mine[i - 1][0]) / 1000;
    worst = Math.max(worst, Math.hypot(mine[i][1][1] - mine[i - 1][1][1], mine[i][1][2] - mine[i - 1][1][2]) / Math.max(0.05, dt));
  }
  ok(mine.length >= 2 && worst <= R.SPEED * 1.1, `no teleport: a kid never runs faster than its speed (${Math.round(worst)} u/s)`);
  const before = sofi.pos[sofi.k].slice();
  ['a', null, undefined, NaN].forEach((x) => sofi.s.emit('player:td-go', { pin, x, y: 30 }));
  sofi.s.emit('player:td-go', { pin });
  sofi.s.emit('player:td-go', null);
  await sleep(450);
  const after = sofi.pos[sofi.k];
  ok(after[3] === before[3] && after[4] === before[4], 'taps that are not numbers change nothing');
  await sleep(1050);
  for (let i = 0; i < 30; i++) sofi.s.emit('player:td-go', { pin, x: -60 + i, y: 40 });
  await sleep(450);
  const burst = sofi.pos[sofi.k];
  ok(burst[3] === -60 + R.GO_RATE - 1 && burst[4] === 40, `a burst of 30 taps: only the first ${R.GO_RATE} of the second count (target x ${burst[3]})`);

  // ---------- «0» and the doors: Sofi (wings) and Mateo (no wings) run onto the drop; Valen and Lucas get away ----------
  // (everyone waits at the hub's edge, where every slice is close: at «0» each runs to the nearest point in / out of
  // the burning slices, a few degrees past the seam)
  const D2R = Math.PI / 180;
  function aim(set, x, y, into) {
    const cur = A.angleOf(x, y);
    let best = null, bd = 9;
    for (let s = 0; s < 8; s++) {
      if (set.includes(s) !== into) continue;
      const lo = s * A.SLICE + 5 * D2R, hi = (s + 1) * A.SLICE - 5 * D2R;
      [lo, hi, Math.min(hi, Math.max(lo, cur))].forEach((a) => { let d = Math.abs(a - cur); d = Math.min(d, 2 * Math.PI - d); if (d < bd) { bd = d; best = a; } });
    }
    return A.pointAt(best, A.R_MIN + 1);
  }
  const runAt = (k, set, into) => { const p = k.pos[k.k]; const t = aim(set, p[1], p[2], into); k.s.emit('player:td-go', { pin, x: t[0], y: t[1] }); };
  // the server's verdict against where every kid stood (its last position report before the doors opened)
  function judged(openMsg, set, list) {
    list.forEach((k) => {
      const p = k.pos[k.k];
      const on = set.includes(A.sliceOf(p[1], p[2]));
      const verdict = openMsg.falls.includes(k.k) ? 'fell' : openMsg.saves.includes(k.k) ? 'saved' : 'stood';
      ok(on ? verdict !== 'stood' : verdict === 'stood', `${k.name}: ${on ? 'on' : 'off'} the drop → ${verdict}`);
    });
  }
  kids.forEach((k) => k.s.emit('player:td-go', { pin, x: 0, y: -(A.R_MIN + 1) }));
  const lockP = next(host, 'td:lock', B.lock + 4000, (m) => m.r === 1);
  const lockM = await lockP;
  ok(lockM.set.length === 2 && lockM.set.every((s) => s >= 0 && s < 8), `«0»: a quarter burns (${lockM.set})`);
  ok(Date.now() - r1At >= B.lock - 200, '«0» comes 8.5 s into the round');
  [sofi, mateo].forEach((k) => runAt(k, lockM.set, true));
  [valen, lucas].forEach((k) => runAt(k, lockM.set, false));
  await sleep(120);
  ok(lucas.closes.some((c) => c.why === 'lock') || !lucas.q, '«0» closed Lucas\'s open wings question (td:qclose)');
  const lockAt1 = Date.now();
  const posBefore = next(host, 'td:open', 3000, (m) => m.r === 1);
  const openM = await posBefore;
  judged(openM, lockM.set, kids);
  ok(openM.saves.includes(sofi.k), 'Sofi stood on a falling slice: her wings saved her');
  ok(openM.falls.includes(mateo.k), 'Mateo stood on it without wings: he fell');
  ok(!openM.falls.includes(valen.k) && !openM.falls.includes(lucas.k), 'Valen and Lucas got away');
  await sleep(200);
  ok(mateo.me && mateo.me.st === 'down', 'Mateo\'s phone: in the pit');
  ok(sofi.me && sofi.me.hover && !sofi.me.wings, 'Sofi hovers, her wings used up');
  // the pit: Mateo's comeback question; a right answer after «0» = up at the next round, then a «rise with wings» one
  const bq = await waitQ(mateo, 'back', lockAt1, 3000);
  ok(bq.td === 'back', 'in the pit: the comeback question');
  await sleep(600);
  const res5 = next(mateo.s, 'answer-result');
  const sentBack = Date.now();
  mateo.s.emit('player:answer', { pin, qid: bq.qid, choiceIdx: correctOf(bq) }, () => {});
  const rm = await res5;
  ok(rm.correct && rm.td.back === 'next', 'a right answer after «0»: back up at the next round');
  const pq = await waitQ(mateo, 'pre', sentBack, 3000);
  await sleep(600);
  const res6 = next(mateo.s, 'answer-result');
  mateo.s.emit('player:answer', { pin, qid: pq.qid, choiceIdx: correctOf(pq) }, () => {});
  const rp = await res6;
  ok(rp.correct && rp.td.wings && rp.td.kind === 'pre', 'waiting to rise: a right answer = he rises with wings');
  const tally1 = await next(host, 'td:tally', 4000, (m) => m.r === 1);
  const teams = { red: kids.filter((k) => k.team === 'red'), gold: kids.filter((k) => k.team === 'gold') };
  ['red', 'gold'].forEach((t) => {
    const present = teams[t].length;
    const standing = teams[t].filter((k) => k !== mateo).length;
    ok(tally1.present[t] === present && tally1.stand[t] === standing, `the tally: ${t} ${standing} of ${present} standing`);
    ok(tally1.add[t] === Math.round((10 * standing) / present), `${t} scores its share standing out of 10 (+${tally1.add[t]})`);
  });

  // ---------- round 2: Mateo rises with wings; a late joiner; pause; +2 rondas; a reconnect ----------
  const late = kidOn(connect(), 'Abril');
  const r2p = next(host, 'td:round', 6000, (m) => m.r === 2);
  const lj = await ack(late.s, 'player:join', { pin, name: 'Abril' });
  ok(lj && lj.ok, 'a late joiner gets in');
  await sleep(300);
  ok(late.init && late.init.st === 'wait', 'the late joiner waits to rise at the next round');
  const r2 = await r2p;
  ok(r2.enter.includes(mateo.k) && r2.enter.includes(late.k), 'round 2: Mateo and the late joiner rise onto the floor');
  await sleep(200);
  ok(mateo.me && mateo.me.st === 'up' && mateo.me.wings, 'Mateo is back on the floor, with wings');
  ok(sofi.me && !sofi.me.wings && !sofi.me.hover, 'everybody else\'s wings reset');
  // «+30 s» = 2 rondas más
  const more = next(host, 'td:rounds', 2000);
  host.emit('host:add-time', { pin, seconds: 30 });
  const mr = await more;
  ok(mr.rounds === 5 && !mr.refused, '«+30 s» = 2 rondas más (5 now)');
  // pause: the runners stand still, an answer comes back unused
  const pz = next(host, 'td:pause', 2000);
  host.emit('host:pause', { pin, paused: true });
  ok((await pz).paused, '«⏸ Pausa»');
  const frozenAt = valen.pos[valen.k].slice();
  valen.s.emit('player:td-go', { pin, x: -frozenAt[1], y: -frozenAt[2] });
  await sleep(700);
  ok(valen.pos[valen.k][1] === frozenAt[1] && valen.pos[valen.k][2] === frozenAt[2], 'paused: nobody runs');
  if (lucas.q) {
    const stale = next(lucas.s, 'answer-stale', 2000);
    lucas.s.emit('player:answer', { pin, qid: lucas.q.qid, choiceIdx: 0 }, () => {});
    ok((await stale).reason === 'paused', 'paused: an answer comes back unused (the question stays open)');
  }
  const pzOff = next(host, 'td:pause', 2000);
  host.emit('host:pause', { pin, paused: false });
  const po = await pzOff;
  ok(!po.paused && po.ago >= 0 && po.ago < B.lock, '«Seguir»: the round goes on where it stood');
  // a reconnect: Valen's phone drops and comes back with the same name
  const vk = valen.k;
  valen.s.close();
  await sleep(400);
  const v2 = kidOn(connect(), 'Valen');
  const vj = await ack(v2.s, 'player:join', { pin, name: 'Valen' });
  await sleep(300);
  ok(vj.ok && v2.init && v2.init.me === vk && v2.init.st === 'up', 'a reconnect keeps her character and her place on the floor');
  kids[2] = v2;
  // the projector's F5: a new socket takes the room back with its token and gets the platform
  const host2 = connect();
  const hinit = next(host2, 'td:init', 3000);
  const rc = await ack(host2, 'host:reclaim', { pin, hostToken });
  ok(rc.ok && rc.gameType === 'trapdoor', 'the projector\'s F5 takes the room back');
  const h2 = await hinit;
  ok(h2.r === 2 && h2.rounds === 5 && Object.keys(h2.roster).length === 5, 'and gets the platform again (round 2 of 5, 5 kids)');
  host.close();

  // round 2's drop: Lucas never answers; he runs onto the drop and falls
  lucas.s.emit('player:td-go', { pin, x: 0, y: -(A.R_MIN + 1) });
  const lock2 = await next(host2, 'td:lock', B.end + 5000, (m) => m.r === 2);
  runAt(lucas, lock2.set, true);
  const open2 = await next(host2, 'td:open', 3000, (m) => m.r === 2);
  if (!open2.falls.includes(lucas.k)) console.log('  (Lucas did not reach the drop in time: the time-up check is skipped)');
  const lucasFell = open2.falls.includes(lucas.k);

  // ---------- round 3: a comeback early in a round rises at once (td:rise) ----------
  const r3 = await next(host2, 'td:round', 6000, (m) => m.r === 3);
  ok(r3.kind === 'three', 'round 3 of 5: three slices drop now');
  if (lucasFell) {
    // Lucas holds his comeback question; a kid in the pit since round 2 answers it now, early in round 3
    const lq = await waitQ(lucas, 'back', 0, 3000);
    const rise = next(host2, 'td:rise', 3000, (m) => m.k === lucas.k);
    const res7 = next(lucas.s, 'answer-result');
    lucas.s.emit('player:answer', { pin, qid: lq.qid, choiceIdx: correctOf(lq) }, () => {});
    const rl = await res7;
    ok(rl.correct && rl.td.back === 'now', 'a right answer early in a round: up at once');
    const ri = await rise;
    ok(Math.hypot(ri.x, ri.y) >= A.R_MIN - 0.2, 'every screen sees him rise onto the floor (td:rise)');
  }
  // a pit question nobody answers: the late joiner falls and holds hers → the server closes it as time up
  late.s.emit('player:td-go', { pin, x: 0, y: -(A.R_MIN + 1) });
  const lock3 = await next(host2, 'td:lock', B.end + 5000, (m) => m.r === 3);
  runAt(late, lock3.set, true);
  const open3At = Date.now();
  const open3 = await next(host2, 'td:open', 3000, (m) => m.r === 3);
  if (open3.falls.includes(late.k)) {
    const tq = await waitQ(late, 'back', open3At, 3000);
    const tu = await next(late.s, 'answer-result', R.Q_SERVER_MS + 3000);
    ok(!tu.correct && tu.td.why === 'timeup' && late.qs.includes(tq), 'a pit question nobody answers: the server closes it (time up) and another comes');
  } else console.log('  (Abril got away at «0»: the time-up check is skipped)');

  // ---------- «Terminar» → «¡FINAL!» → the ceremony ----------
  const fin = next(host2, 'fin:final', 3000);
  const ends = kids.concat([late]).map((k) => next(k.s, 'game-end', 9000));
  const hend = next(host2, 'game-end', 9000);
  host2.emit('host:end-now', { pin });
  const ff = await fin;
  ok(ff.game === 'trapdoor' && ff.why === 'end' && ff.ms > 0, '«Terminar»: «¡FINAL!»');
  const he = await hend;
  ok(he.fin && he.fin.game === 'trapdoor' && (he.fin.stars || []).length <= 4 && he.fin.top.length >= 1, 'the projector: the show (stars, podium)');
  ok(he.teamScores.red === he.fin.totals.red && he.fin.winner === (he.fin.totals.red > he.fin.totals.gold ? 'red' : he.fin.totals.gold > he.fin.totals.red ? 'gold' : 'tie'), 'the winner is the kingdom with more points');
  const cards = await Promise.all(ends);
  cards.forEach((c, i) => ok(c.me && c.me.k && (c.me.team === 'red' || c.me.team === 'gold') && c.me.stood >= 0 && c.fin.game === 'trapdoor', `phone ${i + 1}: its own card`));
  ok(cards[0].me.saved >= 1, 'Sofi\'s card counts the save of her wings');

  // ---------- «Otra ronda» = the next arena ----------
  const nextArena = next(host2, 'td:arena', 3000);
  host2.emit('host:reset', { pin });
  const na = await nextArena;
  ok(na.arena === 2, '«Otra ronda»: the next arena (El Jardín de la Luna)');

  kids.concat([late]).forEach((k) => k.s.close());
  host2.close();
  console.log(`test-trapdoor-live: ${checks} checks pass`);
  process.exit(0);
})();
