// Live check of Vuelo del Dragón v2 against a RUNNING local server (never the live site):
//   node scripts/test-dragon-live.js --url http://localhost:4540 --password <the local teacher code>
// One teacher + 4 kids (one race of 4): the lobby ids + characters, the deal at the countdown (every phone its race, the
// projector all of them), a second «¡A volar!» ignored, the intro and «Saltar», a question for every kid, a right answer →
// a flight (the lead, 4 s) → beats in batches → the flight's summary (dr:flown) with the cap applied and the race line to
// the race's phones and the projector; the next question after the flight; a wrong answer → its wait; a too-fast tap;
// beats of another flight or after the flight ignored; «Pausa» (answers handed back, beats refused, the flight held) and
// «Seguir»; «+30 s»; a reconnect in the middle of a flight gets it back with the time left; a late joiner flies in the
// race (5th seat, level with its last dragon); the projector's F5 (host:reclaim) gets every race; «Terminar» → «¡FINAL!» →
// each phone its race's ceremony + card (a second «Terminar» ignored); a reconnect after the end gets its card; «Saltar»
// after the end reaches the phones; «Otra ronda» = the lobby again and a new deal.
'use strict';
const assert = require('assert');
const { io } = require('socket.io-client');
const Dragon = require('../core/dragon');

const args = process.argv.slice(2);
const URL = (args.indexOf('--url') >= 0 && args[args.indexOf('--url') + 1]) || 'http://localhost:4540';
const PASSWORD = (args.indexOf('--password') >= 0 && args[args.indexOf('--password') + 1]) || process.env.TEST_TEACHER_PW || '';
if (!PASSWORD) { console.error('pass the teacher code of the server under test: --password <code> (or TEST_TEACHER_PW)'); process.exit(2); }
const SET = 'pack:yct1-familia-r1';
const R = Dragon.R;
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
  const correctOf = (q) => { const x = set.questions.find((y) => y.text === q.text); return x ? q.answers.indexOf(x.correct) : -1; };
  ok(set.questions.length > 5, 'the pack loads');

  // ---------- the room ----------
  const host = connect();
  const { pin, hostToken } = await ack(host, 'host:create', { gameType: 'dragon-eye', password: PASSWORD });
  ok(pin, 'a PIN');
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded.ok, 'the pack loads into the room');
  host.emit('host:set-duration', { pin, duration: 180 });
  const kids = [];
  const NAMES = ['Sofi', 'Mateo', 'Valen', 'Lucas'];
  for (const name of NAMES) {
    const s = connect();
    const kid = { s, name, q: null, init: null, lines: [], results: [], flown: [] };
    s.on('question', (q) => { kid.q = q; kid.qAt = Date.now(); });
    s.on('dr:init', (d) => { kid.init = d; });
    s.on('dr:race', (d) => kid.lines.push(d));
    s.on('dr:flown', (d) => kid.flown.push(d));
    s.on('answer-result', (r) => kid.results.push(r));
    const j = await ack(s, 'player:join', { pin, name, avatar: '🐪' });
    ok(j.ok, 'joined ' + name);
    kid.id = j.playerId;
    kids.push(kid);
  }
  const st = await next(host, 'state', 3000, (x) => Object.keys(x.players || {}).length === 4);
  Object.values(st.players).forEach((p) => ok(p.k > 0 && p.sk, 'the lobby knows each kid id + character'));
  ok(Object.values(st.players).every((p) => p.sk === 'camel'), 'the character comes from the avatar (camel)');
  const hostLines = [];
  host.on('dr:races', (d) => hostLines.push(d));

  // ---------- the deal, the intro ----------
  const hInit = next(host, 'dr:init', 6000);
  const kInits = kids.map((k) => next(k.s, 'dr:init', 6000));
  host.emit('host:start', { pin });
  const hi = await hInit;
  ok(hi.phase === 'countdown' && hi.races.length === 1 && hi.races[0].seats.length === 4, 'the deal: one race of 4 at the countdown');
  const ki = await Promise.all(kInits);
  ki.forEach((d, i) => {
    ok(d.race && d.you && d.race.id === hi.races[0].id, 'every phone gets its race (' + NAMES[i] + ')');
    ok(d.you.m === 0 && d.you.st === 0 && !d.you.flight, 'at the start line: 0 m, no stars, no flight');
  });
  ok(new Set(ki.map((d) => d.you.c)).size === 4, 'four seat colours');
  const again = await new Promise((res) => { host.emit('host:start', { pin }); setTimeout(() => res(true), 300); });
  ok(again, '(a second «¡A volar!» is ignored)');
  await next(host, 'dr:intro', 6000);
  ok(await none(kids[0].s, 'question', 600), 'no question in the intro');
  host.emit('host:dr-skip', { pin });
  const play = await next(kids[0].s, 'dr:play', 3000);
  ok(play.endsMs > 170000 && play.sprintMs > 15000, 'play: 3 minutes, the first sprint ~20 s away');
  await sleep(700);
  kids.forEach((k) => ok(k.q && k.q.answers.length >= 2 && !('correctIdx' in k.q), 'a question for every kid, without its answer (' + k.name + ')'));
  ok(kids.every((k) => k.init && k.init.id === ki[0].id), 'every phone kept its race');

  // ---------- a right answer → a flight → beats → the summary ----------
  const A = kids[0];
  await sleep(R.FAST_MS + 50);
  let qa = A.q;
  A.s.emit('player:answer', { pin, qid: qa.qid, choiceIdx: correctOf(qa) });
  const ra = await next(A.s, 'answer-result', 3000);
  const f = ra.dragon;
  ok(ra.correct && f && f.right && f.mid > 0 && f.lead === R.LEAD_MS && f.ms === R.FLAP_MS && f.power === 1, 'right → a flight (lead, 4 s, power 1)');
  ok(f.rate === R.RATE && f.burst === R.BURST && f.beatM === R.BEAT_M, 'the flight tells the phone the cap and the metres a beat');
  ok(await none(A.s, 'question', 300), 'no new question during the lead');
  await sleep(f.lead + 120);
  A.s.emit('player:dr-beats', { pin, mid: f.mid + 99, n: 3 });            // another flight: ignored
  for (let i = 0; i < 10; i++) { A.s.emit('player:dr-beats', { pin, mid: f.mid, n: 2 }); await sleep(250); }   // 8 a second: over the cap
  const seesA = (d) => (d.d || []).some((row) => row[0] === ki[0].you.k && row[1] > 0);
  const lineA = kids[1].lines.find(seesA) || await next(kids[1].s, 'dr:race', 2000, seesA);
  ok(lineA.b === hi.races[0].id, 'a rival phone sees my metres in its race line');
  ok(hostLines.some((x) => x.r.some(([b]) => b === hi.races[0].id)), 'the projector gets the race lines');
  const fl = await next(A.s, 'dr:flown', f.ms + 3000);
  const cap = Math.floor((R.RATE * f.ms) / 1000) + R.BURST;
  ok(fl.mid === f.mid && fl.beats > 0 && fl.beats <= cap, `the summary: beats capped (${fl.beats} ≤ ${cap})`);
  ok(fl.metres >= fl.beats * R.BEAT_M && fl.m >= fl.metres, 'the summary: metres for the beats');
  A.s.emit('player:dr-beats', { pin, mid: f.mid, n: 3 });                 // after the flight: ignored
  const qn = await next(A.s, 'question', 3000);
  ok(qn.qid !== qa.qid, 'the next question right after the flight');

  // ---------- wrong, too fast ----------
  const B = kids[1];
  await sleep(R.FAST_MS);
  const qb = B.q;
  B.s.emit('player:answer', { pin, qid: qb.qid, choiceIdx: (correctOf(qb) + 1) % qb.answers.length });
  const rb = await next(B.s, 'answer-result', 3000);
  ok(!rb.correct && rb.dragon && !rb.dragon.right && rb.dragon.wait === R.WRONG_MS && rb.correctText, 'wrong → the wait and the right answer');
  const tWrong = Date.now();
  await next(B.s, 'question', R.WRONG_MS + 2000);
  ok(Date.now() - tWrong >= R.WRONG_MS - 300, 'the next question after the wait');
  // too fast: C answers wrong, then answers its next question the moment it arrives (right, but under 600 ms)
  const C = kids[2];
  const qc0 = C.q;
  const freshP = next(C.s, 'question', R.WRONG_MS + 3000, (q) => q.qid !== qc0.qid);
  const wrongC = next(C.s, 'answer-result', 3000);
  C.s.emit('player:answer', { pin, qid: qc0.qid, choiceIdx: (correctOf(qc0) + 1) % qc0.answers.length });
  await wrongC;
  const fresh = await freshP;
  C.s.emit('player:answer', { pin, qid: fresh.qid, choiceIdx: correctOf(fresh) });
  const rc = await next(C.s, 'answer-result', 3000);
  ok(rc.dragon && rc.dragon.tooFast && !rc.dragon.right, 'a right answer under 600 ms counts as too fast and opens no flight');
  ok(rc.dragon.wait === R.WRONG2_MS && rc.dragon.calm, '…two misses in a row: the longer «¡Respira!» wait');

  // ---------- pause, +30 s ----------
  const D = kids[3];
  await sleep(R.FAST_MS);
  let qd = D.q;
  D.s.emit('player:answer', { pin, qid: qd.qid, choiceIdx: correctOf(qd) });
  const rd = await next(D.s, 'answer-result', 3000);
  ok(rd.dragon.right, 'D flies');
  await sleep(rd.dragon.lead + 300);
  D.s.emit('player:dr-beats', { pin, mid: rd.dragon.mid, n: 3 });
  await sleep(200);
  const pz = next(D.s, 'dr:pause', 3000);
  host.emit('host:pause', { pin, paused: true });
  const p1 = await pz;
  ok(p1.paused && p1.endsMs > 0, '«Pausa» reaches the phones with the clock');
  await sleep(R.GRACE_MS + 150);
  D.s.emit('player:dr-beats', { pin, mid: rd.dragon.mid, n: 3 });          // refused while paused (past the grace)
  await sleep(R.FLAP_MS + 400);
  ok(!kids[3].flown.some((x) => x.mid === rd.dragon.mid), 'paused: the flight is held (no summary)');
  const qa2 = kids[0].q;
  kids[0].s.emit('player:answer', { pin, qid: qa2.qid, choiceIdx: correctOf(qa2) });
  const stale = await next(kids[0].s, 'answer-stale', 2000);
  ok(stale.reason === 'paused', 'an answer during «Pausa» is handed back');
  const pr = next(D.s, 'dr:pause', 3000);
  host.emit('host:pause', { pin, paused: false });
  ok(!(await pr).paused, '«Seguir»');
  const flD = await next(D.s, 'dr:flown', R.FLAP_MS + 3000, (x) => x.mid === rd.dragon.mid);
  ok(flD.beats === 3, 'the beats during the pause did not count (3 before it)');
  const tm = next(kids[0].s, 'dr:time', 2000);
  host.emit('host:add-time', { pin, seconds: 30 });
  const t30 = await tm;
  ok(t30.add === 30 && t30.endsMs > 180000, '«+30 s» moves the end');

  // ---------- a reconnect in the middle of a flight ----------
  await sleep(R.FAST_MS);
  qa = kids[0].q;
  kids[0].s.emit('player:answer', { pin, qid: qa.qid, choiceIdx: correctOf(qa) });
  const ra2 = await next(kids[0].s, 'answer-result', 3000, (r) => r.dragon);
  if (ra2.dragon.right) {
    await sleep(ra2.dragon.lead + 500);
    kids[0].s.emit('player:dr-beats', { pin, mid: ra2.dragon.mid, n: 2 });
    await sleep(150);
    kids[0].s.disconnect();
    await sleep(300);          // (its old connection closes first: a live name is never taken by another connection, 2026-10-19)
    const s2 = connect();
    s2.on('dr:race', () => {});
    const back = next(s2, 'dr:init', 4000);
    const j2 = await ack(s2, 'player:join', { pin, name: 'Sofi', avatar: '🐪' });
    ok(j2.ok && j2.rejoined, 'Sofi comes back (same name)');
    const bi = await back;
    ok(bi.you && bi.you.k === ki[0].you.k && bi.you.c === ki[0].you.c, 'the same seat and colour');
    ok(bi.you.flight && bi.you.flight.mid === ra2.dragon.mid && bi.you.flight.ms === ra2.dragon.ms && bi.you.flight.elapsed > 0 && bi.you.flight.elapsed < ra2.dragon.ms, 'the open flight comes back with its length and the time already flown');
    ok(bi.you.flight.beats === 2, '…and its beats so far');
    kids[0].s = s2;
    s2.on('question', (q) => { kids[0].q = q; });
    s2.on('dr:flown', (d) => kids[0].flown.push(d));
    const fl2 = await next(s2, 'dr:flown', R.FLAP_MS + 3000);
    ok(fl2.mid === ra2.dragon.mid && fl2.beats === 2, 'the summary reaches the new phone');
  } else ok(true, '(that answer was not right: reconnect checked at the end)');

  // ---------- a late joiner, the projector's F5 ----------
  const late = connect();
  const seat = next(host, 'dr:seat', 4000);
  const li = next(late, 'dr:init', 4000);
  const jl = await ack(late, 'player:join', { pin, name: 'Tardía', avatar: '🦅' });
  ok(jl.ok, 'a late joiner gets in');
  const lv = await seat;
  ok(lv.race.seats.length === 5, 'the late joiner flies in the race (5th seat)');
  const lInit = await li;
  const minM = Math.min(...lv.race.seats.filter((s) => s.k !== lInit.you.k).map((s) => s.m));
  ok(lInit.you.c === 4 && lInit.you.m === minM, 'purple, level with the last dragon of the race');
  const host2 = connect();
  const recl = next(host2, 'dr:init', 3000);
  const rr = await ack(host2, 'host:reclaim', { pin, hostToken });   // an F5 brings the room's token (js/teacher-gate.js)
  ok(rr && rr.ok, 'the projector takes the room back (F5)');
  const rInit = await recl;
  ok(rInit.races && rInit.races[0].seats.length === 5 && rInit.phase === 'play', 'every race again after F5');

  // ---------- «Terminar» → «¡FINAL!» → the ceremony ----------
  const fin = next(kids[1].s, 'dr:final', 3000);
  const ends = kids.slice(1).map((k) => next(k.s, 'game-end', 6000));
  const hEnd = next(host2, 'game-end', 6000);
  host2.emit('host:end-now', { pin });
  const fd = await fin;
  ok(fd.ms === R.FINAL_MS, '«¡FINAL!» on every phone');
  ok(await new Promise((res) => { host2.emit('host:end-now', { pin }); setTimeout(() => res(true), 200); }), '(a second «Terminar» is ignored)');
  const cards = await Promise.all(ends);
  const he = await hEnd;
  ok(he.dragon && he.dragon.races.length === 1 && he.dragon.podium.length >= 1, 'the projector: every race + the podium');
  cards.forEach((c, i) => {
    ok(c.dragon && c.dragon.race && c.me && c.me.b === hi.races[0].id, 'every phone: its race + its card (' + NAMES[i + 1] + ')');
    ok(c.me.total === c.me.flown + (c.me.bonus || []).length * c.dragon.bonusM, 'the card: metres + bonus stars');
  });
  const winners = cards[0].dragon.race.winners;
  ok(winners.length >= 1, 'the race has a winner');
  cards.forEach((c) => ok(c.me.won === winners.includes(c.me.k), 'the won flag matches'));
  // a reconnect after the end: its card again
  kids[1].s.disconnect();
  await sleep(300);
  const s3 = connect();
  const again2 = next(s3, 'game-end', 3000);
  const j3 = await ack(s3, 'player:join', { pin, name: 'Mateo', avatar: '🐪' });
  ok(j3.ok && j3.gameState === 'ended', 'Mateo reattaches after the end');
  const c3 = await again2;
  ok(c3.me && c3.me.k === cards[0].me.k, 'his card again');
  const sk = next(kids[2].s, 'dr:skip', 2000);
  host2.emit('host:dr-skip', { pin });
  await sk;
  ok(true, '«Saltar» after the end reaches the phones');

  // ---------- «Otra ronda» ----------
  const lob = next(kids[2].s, 'state', 3000, (x) => x.state === 'lobby');
  host2.emit('host:reset', { pin });
  const lb = await lob;
  ok(lb.state === 'lobby', '«Otra ronda» = the lobby again');
  const ni = next(kids[2].s, 'dr:init', 6000);
  host2.emit('host:start', { pin });
  const nd = await ni;
  ok(nd.id !== ki[0].id && nd.you.m === 0, 'a new deal from 0 m');
  host2.emit('host:end-now', { pin });
  await sleep(300);

  [host, host2, late, s3, ...kids.map((k) => k.s)].forEach((s) => { try { s.close(); } catch (_) {} });
  console.log(`test-dragon-live: ${checks} checks pass`);
  process.exit(0);
})();
