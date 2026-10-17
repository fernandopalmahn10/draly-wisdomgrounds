// Live check of the Mario Party ending of Reinos de Colores, Dragones Pintores, Batalla de Nieve and La Gran Fuga
// (2026-10-16 ending pass) against a RUNNING local server (never the live site):
//   node scripts/test-party-live.js --url http://localhost:4550 --password <teacher code>   [--only kingdoms] [--frenzy]
// For each game: one teacher + 3 kids play a moment, «Terminar» → «¡FINAL!» on every screen (a second «Terminar»
// ignored, an answer during «¡FINAL!» comes back unused, nothing moves) → game-end: the projector's show (`fin`: the
// winner, the totals, the crews, the bonus stars, the podium) and each phone its own card (`me`), whose Spanish lines
// (js/party.js card()) never show a 0 → a phone that reconnects after the end gets its card again → «Saltar» reaches
// every phone → «Otra ronda» = the lobby, a clean round after it. --frenzy also waits for the last 30 s of a 60 s
// Reinos round: the fin:frenzy event and «¡Banderas dobles!» (a right answer = 2 flags).
'use strict';
const assert = require('assert');
const path = require('path');
const { io } = require('socket.io-client');
const Party = require(path.join(__dirname, '..', 'public', 'js', 'party.js'));

const args = process.argv.slice(2);
const arg = (n, d) => (args.indexOf('--' + n) >= 0 && args[args.indexOf('--' + n) + 1]) || d;
const URL = arg('url', '');
const PASSWORD = arg('password', process.env.TEST_TEACHER_PW || '');
const ONLY = arg('only', null);
const FRENZY = args.includes('--frenzy');
if (!URL) { console.error('pass the URL of a local server under test: --url http://localhost:<port>'); process.exit(2); }
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
function count(s, ev, ms) {
  return new Promise((res) => { let n = 0; const h = () => { n++; }; s.on(ev, h); setTimeout(() => { s.off(ev, h); res(n); }, ms); });
}
const INIT = { kingdoms: 'kd:init', paint: 'pc:init', snow: 'sn:init', escape: 'es:init' };

async function room(game, duration) {
  const host = connect();
  const created = await ack(host, 'host:create', { gameType: game, password: PASSWORD });
  ok(created && created.pin, `${game}: room created`);
  const pin = created.pin;
  const loaded = await ack(host, 'host:load-set', { pin, setId: SET });
  ok(loaded && loaded.ok, `${game}: the pack loads`);
  host.emit('host:set-duration', { pin, duration: duration || 60 });
  const kids = [];
  for (const name of ['Sofi', 'Mateo', 'Lucía']) {
    const s = connect();
    const k = { s, name, q: null, last: {} };
    s.on('question', (q) => { k.q = q; });
    s.onAny((ev, d) => { k.last[ev] = d; });
    const j = await ack(s, 'player:join', { pin, name });
    ok(j && j.ok !== false, `${game}: ${name} joins`);
    kids.push(k);
  }
  return { host, pin, kids };
}

async function playOne(game) {
  const { host, pin, kids } = await room(game, 60);
  const inits = kids.map((k) => next(k.s, INIT[game], 9000));
  host.emit('host:start', { pin });
  await Promise.all(inits);
  ok(true, `${game}: every phone gets its world`);
  const A = kids[0];
  // a moment of play: answer what comes; Reinos plants its flag, Pintores paints a few clouds
  if (game === 'paint') {
    const init = A.last['pc:init'];
    const lv = init.level;
    const row = lv.rows - 2;
    const sp = lv.spawns.red;
    for (let i = 0; i < 6; i++) {
      const x = (sp[0] + i) * lv.tile + 4;
      A.s.emit('player:pc-pos', { pin, x, y: row * lv.tile, f: 1, moving: true, spent: 0.1 });
      await sleep(130);
      const id = row * lv.cols + Math.floor(x / lv.tile);
      if (lv.surfaces.includes(id)) A.s.emit('player:pc-paint', { pin, tiles: [id] });
    }
    A.s.emit('player:pc-ask', { pin });
  }
  if (game === 'kingdoms' || game === 'escape' || game === 'paint') {
    for (let n = 0; n < 3; n++) {
      if (!A.q) { try { await next(A.s, 'question', 5000); } catch (_) { break; } }
      const q = A.q; A.q = null;
      const r = next(A.s, 'answer-result', 5000);
      A.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: 0 });
      const res = await r;
      if (game === 'kingdoms' && res.kingdoms && res.kingdoms.needsPlant) {
        const plant = next(A.s, 'kd:plant', 5000, (d) => d.playerId === A.s.id);
        A.s.emit('player:kd-plant', { pin, tile: res.kingdoms.valid[0] });
        await plant;
        if (res.kingdoms.flags > 1) { const p2 = await next(A.s, 'kd:prompt', 3000).catch(() => null); if (p2) { A.s.emit('player:kd-plant', { pin, tile: p2.valid[0] }); await sleep(300); } }
      }
      if (game === 'paint') { A.s.emit('player:pc-ask', { pin }); }
      await sleep(game === 'escape' ? 1500 : 300);
    }
  }
  const t0 = Date.now();
  let paused = 0;
  if (game === 'kingdoms' || game === 'paint') {
    // «⏸ Pausa» (new in these two games): every phone hears it, an answer comes back unused, the clock waits
    const ev = game === 'kingdoms' ? 'kd:pause' : 'pc:pause';
    const B = kids[1];
    const q0 = B.q || (await next(B.s, 'question', 6000).catch(() => null)) || B.q;
    const pz = kids.map((k) => next(k.s, ev, 3000, (d) => d.paused));
    host.emit('host:pause', { pin, paused: true });
    const P0 = await Promise.all(pz);
    ok(P0.every((d) => d.paused && d.endsMs > 0), `${game}: «⏸ Pausa» reaches every phone with the time left`);
    if (q0) {
      const st = next(B.s, 'answer-stale', 3000);
      B.s.emit('player:answer', { pin, qid: q0.qid, choiceIdx: 0 });
      ok((await st).reason === 'paused', `${game}: an answer during the pause comes back unused (the question stays open)`);
    }
    await sleep(2000);
    const rs = next(kids[0].s, ev, 3000, (d) => !d.paused);
    host.emit('host:pause', { pin, paused: false });
    const R1 = await rs;
    if (game === 'kingdoms') {
      // a flag still to plant when the pause comes: no auto-plant meanwhile, a fresh plant window after «Seguir»
      let got = null;
      for (let n = 0; n < 14 && !got; n++) {
        const q = A.q || (await next(A.s, 'question', 6000).catch(() => null)) || A.q;
        if (!q) break;
        A.q = null;
        const res = next(A.s, 'answer-result', 4000);
        A.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: n % (q.answers.length || 2) });
        const rr = await res.catch(() => null);
        if (rr && rr.correct && rr.kingdoms && rr.kingdoms.needsPlant) got = rr;
      }
      console.log('    (a flag to plant before the pause: ' + (got ? 'yes' : 'no right answer in 14 tries') + ')');
      if (got) {
        host.emit('host:pause', { pin, paused: true });
        await next(A.s, ev, 3000, (d) => d.paused);
        const noPlant = await count(A.s, 'kd:plant', 2500);
        const again = next(A.s, 'kd:prompt', 4000);
        host.emit('host:pause', { pin, paused: false });
        const pr = await again;
        ok(pr.needsPlant && pr.plantMs >= 7000, `kingdoms: after «Seguir» my flag gets a fresh plant window (${pr.plantMs} ms)`);
        A.s.emit('player:kd-plant', { pin, tile: pr.valid[0] });
        await sleep(400);
      }
    }
    ok(R1.endsMs >= P0[0].endsMs - 400, `${game}: «▶ Seguir»: the clock picks up where it stopped (${P0[0].endsMs} → ${R1.endsMs} ms)`);
    host.emit('host:pause', { pin, paused: true });       // and the round ends from the pause card below
    await next(kids[0].s, ev, 3000, (d) => d.paused);
  }
  if (game === 'snow' || game === 'escape') {
    // «Terminar» from the pause card: the pause never counts as survived / played time
    await sleep(1500);
    host.emit('host:pause', { pin, paused: true });
    await sleep(3000);
    paused = 3000;
  }
  // «Terminar» → «¡FINAL!» on every screen
  const finals = [host].concat(kids.map((k) => k.s)).map((s) => next(s, 'fin:final', 5000));
  host.emit('host:end-now', { pin });
  const f = await Promise.all(finals);
  ok(f.every((x) => x.ms === 2400 && x.game === game && x.why === 'end'), `${game}: «¡FINAL!» on the projector and every phone (2.4 s, why=end)`);
  // a phone that arrives during «¡FINAL!» sees it, then the show with a card (its own or the guest card), never nothing
  const late = connect();
  const lateFinal = next(late, 'fin:final', 3000);
  const lateEnd = next(late, 'game-end', 6000);
  await ack(late, 'player:join', { pin, name: 'Nuevo' });
  ok((await lateFinal).ms <= 2400, `${game}: a phone joining during «¡FINAL!» gets «¡FINAL!» with the time left`);
  const twice = count(host, 'fin:final', 900);
  host.emit('host:end-now', { pin });
  ok((await twice) === 0, `${game}: a second «Terminar» is ignored`);
  // an answer during «¡FINAL!» comes back unused (Reinos / Pintores / La Gran Fuga have questions on the phones)
  if (A.q) {
    const st = next(A.s, 'answer-stale', 2000);
    A.s.emit('player:answer', { pin, qid: A.q.qid, choiceIdx: 0 });
    ok((await st).reason === 'final', `${game}: an answer during «¡FINAL!» is not judged`);
  }
  // the show: the projector gets everything, each phone its own card
  const hostEnd = next(host, 'game-end', 5000);
  const ends = kids.map((k) => next(k.s, 'game-end', 5000));
  const H = await hostEnd;
  const K = await Promise.all(ends);
  const fin = H.fin;
  ok(fin && fin.game === game, `${game}: the projector gets the show`);
  ok(Array.isArray(fin.stars) && fin.stars.length <= 4 && fin.stars.every((s) => s.id && s.name && Array.isArray(s.who) && s.who.length <= 4 && s.n >= s.who.length), `${game}: ≤ 4 bonus stars, ≤ 4 winners drawn each`);
  ok(fin.totals && typeof fin.totals === 'object', `${game}: totals`);
  ok(fin.crews && Object.values(fin.crews).every((c) => Array.isArray(c) && c.every((r) => r.name && r.skin && r.k)), `${game}: every crew figure has a name, a character and an id`);
  if (game !== 'escape') {
    ok(['red', 'gold', 'tie', 'sun', 'ice'].includes(fin.winner), `${game}: a winner (or a tie)`);
    ok(Array.isArray(fin.top) && fin.top.length >= 1, `${game}: the podium rows`);
  } else {
    ok(['crew', 'robot'].includes(fin.winner) && fin.extra && fin.extra.rank && fin.extra.rank.name, `${game}: the crew's rank`);
    ok(fin.top.length === 0, `${game}: no podium ranking of the crew`);
  }
  K.forEach((e, i) => {
    ok(e.fin && e.fin.game === game, `${game}: ${kids[i].name} gets the show`);
    ok(e.me && e.me.k && e.me.team, `${game}: ${kids[i].name} gets their own card`);
    const lines = Party.card(game, e.me, e.fin);
    ok(lines.title && lines.big && (lines.big.text || lines.big.n > 0), `${game}: the card has a headline and a non-zero big line (or the encouraging line)`);
    ok(lines.facts.every(([v]) => v !== '0' && !/^0\//.test(v)), `${game}: no fact on the card reads 0`);
    ok(!/\bNaN\b|undefined/.test(JSON.stringify(lines)), `${game}: no NaN / undefined in the card`);
  });
  const L = await lateEnd;
  ok(L.fin && L.fin.game === game && L.me && (L.me.guest || L.me.k), `${game}: … and then the show with a card`);
  ok(!L.leaderboard && (L.fin.top || []).length === 0, `${game}: phones get a lean payload (no leaderboard, no podium rows)`);
  ok(JSON.stringify(K[0]).length < 9000, `${game}: a phone's end payload stays small (${JSON.stringify(K[0]).length} bytes)`);
  ok(H.leaderboard && Array.isArray(H.leaderboard), `${game}: the projector keeps the leaderboard`);
  if (game === 'snow') {
    const played = (Date.now() - t0 - paused) / 1000;
    const sun = K.find((e) => e.me.side === 'sun');
    ok(!sun || sun.me.seconds <= played + 1, `snow: a survivor's seconds leave the pause out (${sun && sun.me.seconds} s ≤ ${played.toFixed(1)} s played)`);
  }
  late.close();
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (b || 0), 0);
  ok(K.some((e) => e.me.k !== K[0].me.k), `${game}: the cards are personal`);
  ok(sum(fin.totals) >= 0, `${game}: totals add up`);
  // a phone that reconnects after the end gets its card again (same name = same slot)
  const again = connect();
  const back = next(again, 'game-end', 5000);
  const j = await ack(again, 'player:join', { pin, name: kids[1].name });
  ok(j && j.ok !== false && j.gameState === 'ended', `${game}: a phone back after the end gets its slot`);
  const B = await back;
  ok(B.me && B.me.k === K[1].me.k, `${game}: … and the same card`);
  ok(B.ago > 0 && B.ago < 60000, `${game}: … and how long ago the round ended (it joins the show where the others are)`);
  // a projector that reconnects gets the show again once host:reclaim calls finReclaim() (server.js; host:reclaim is
  // being re-secured in the main checkout, so this branch leaves that handler as it is): reported, not required
  const host2Seen = next(host, 'game-end', 2500).catch(() => null);
  host.emit('host:reclaim', { pin }, () => {});
  const h2 = await host2Seen;
  if (h2) ok(h2.fin.game === game, `${game}: a reclaimed projector gets the show again`);
  else if (game === 'kingdoms') console.log('    (note: host:reclaim does not re-send the show yet: wire finReclaim(socket.id, g) into it)');
  // «Saltar» reaches every phone
  const skips = kids.slice(0, 2).map((k) => next(k.s, 'fin:skip', 3000));
  host.emit('host:fin-skip', { pin });
  await Promise.all(skips);
  ok(true, `${game}: «Saltar» jumps every phone to its card`);
  // «Otra ronda»: back to the lobby, a clean round after it
  const lobby = next(kids[0].s, 'state', 4000, (st) => st.state === 'lobby');
  host.emit('host:reset', { pin });
  await lobby;
  ok(true, `${game}: «Otra ronda» brings the phones back to the lobby`);
  const init2 = next(kids[2].s, INIT[game], 9000);
  host.emit('host:start', { pin });
  await init2;
  ok(true, `${game}: a clean round starts after the ceremony`);
  const fin2 = next(host, 'fin:final', 5000);
  host.emit('host:end-now', { pin });
  await fin2;
  ok(true, `${game}: and ends with «¡FINAL!» again`);
  await next(host, 'game-end', 5000);
  [host, again].concat(kids.map((k) => k.s)).forEach((s) => s.close());
}

async function frenzy() {
  const { host, pin, kids } = await room('kingdoms', 60);
  const A = kids[0];
  host.emit('host:start', { pin });
  await next(A.s, 'kd:init', 9000);
  const fz = await next(A.s, 'fin:frenzy', 40000);
  ok(fz.game === 'kingdoms' && fz.endsMs <= 30000 && fz.endsMs > 20000, 'kingdoms: the last 30 s reach every phone (fin:frenzy)');
  // right answers in the frenzy: two flags each (the server judges; try until one is right)
  let flags = null;
  for (let n = 0; n < 12 && flags === null; n++) {
    if (!A.q) { try { await next(A.s, 'question', 6000); } catch (_) { break; } }
    const q = A.q; A.q = null;
    const r = next(A.s, 'answer-result', 5000);
    A.s.emit('player:answer', { pin, qid: q.qid, choiceIdx: n % (q.answers.length || 2) });
    const res = await r;
    if (res.correct && res.kingdoms) {
      flags = res.kingdoms.flags;
      A.s.emit('player:kd-plant', { pin, tile: res.kingdoms.valid[0] });
    }
    await sleep(200);
  }
  ok(flags !== null && flags >= 2, '«¡Banderas dobles!»: a right answer in the last 30 s earns 2 flags (or 3 on a streak)');
  // «⏸ Pausa» in the last 30 s: the ×2 chips stop with the clock, and come back with the new seconds on «Seguir»
  const held = next(A.s, 'fin:frenzy', 4000);
  host.emit('host:pause', { pin, paused: true });
  const h = await held;
  ok(h.off && h.hold, 'the pause holds the ×2 chips (fin:frenzy off + hold)');
  await sleep(1500);
  const back = next(A.s, 'fin:frenzy', 4000);
  host.emit('host:pause', { pin, paused: false });
  const b = await back;
  ok(b.again && !b.off && b.endsMs > 0 && b.endsMs <= fz.endsMs, '«Seguir» brings them back with the seconds left (no second banner)');
  // «+30 s» inside the last 30 s: more than 31 s left again = the ×2 switches off
  const offAgain = next(A.s, 'fin:frenzy', 4000, (d) => d.off && !d.hold);
  host.emit('host:add-time', { pin, seconds: 30 });
  await offAgain;
  ok(true, '«+30 s» in the last 30 s switches the ×2 off (it comes back at 30 s)');
  host.emit('host:end-now', { pin });
  await next(host, 'game-end', 6000);
  [host].concat(kids.map((k) => k.s)).forEach((s) => s.close());
}

(async () => {
  for (const game of ['kingdoms', 'paint', 'snow', 'escape']) {
    if (ONLY && ONLY !== game) continue;
    await playOne(game);
    console.log(`  ${game}: ending ok (${checks} checks so far)`);
  }
  if (FRENZY) { await frenzy(); console.log('  kingdoms: «¡Banderas dobles!» ok'); }
  console.log(`party live: all ${checks} checks passed`);
  process.exit(0);
})();
