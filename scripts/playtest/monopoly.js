// Playtest handler for Dàfùwēng · Monopolio v2: the harness answers every question with a random choice (so ~1 in 4 is
// right); this handler plays the board like a kid: after a right answer it taps the dice block 0.4-1.6 s after the dice
// show (Bot04 never taps: the server must roll by itself after the window, and the same dice). Checks on what comes back:
//   · mn:init deals every kid a seat on a board of 3-5 with its colour; the run-in comes in the countdown
//   · every right answer opens a dice window; every window ends in exactly ONE turn script (tapped or automatic) whose
//     path follows the loop, whose dice are 1-6 (two of them every 3rd right in a row), whose length (ms) is what the
//     shared clock says, and whose last snapshot of me = my coins / stars / position
//   · the board's other phones get each move (mn:move) of their board only, never another board's
//   · the end payload: my card = my last numbers, my board's ranking, bonus stars only for kids of my board, a winner
// The freeze clock is told how long each turn plays (graceUntil), since a turn is a legitimate wait.
// Stats in report.monopoly (per-kid event counts too: a move per turn to 3-4 phones, not a storm).
'use strict';

const MAP = require('../../public/js/monopoly-map');

module.exports = (bot, ctx) => {
  const st = ctx.state;
  const R = ctx.report;
  R.endedGrace = 5000;                         // «¡FINAL!» (mn:final) ends the watch; game-end comes 2.4 s later
  const E = R.monopoly || (R.monopoly = {
    seats: 0, boards: {}, windows: 0, turns: 0, autos: 0, idleAutos: 0, doubles: 0, stars: 0, buys: 0, tolls: 0, lucky: {},
    storms: 0, passes: 0, moves: 0, leads: 0, frenzy: 0, finals: 0, ends: 0, eventsPerKid: {}, movesPerKid: {}, maxTurnMs: 0,
    winners: 0, podium: null,
  });
  const idle = ctx.name === 'Bot04';
  const lead = ctx.name === 'Bot01';
  let me = null, myBoard = null, open = {}, timers = [], finalSeen = false, last = null;
  E.eventsPerKid[ctx.name] = 0;
  E.movesPerKid[ctx.name] = 0;
  const fail = (what, d) => R.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  bot.onAny(() => { E.eventsPerKid[ctx.name]++; });

  bot.on('mn:init', (d) => {
    if (!d || !d.you || !d.board) return;
    if (!me) E.seats++;
    me = d.you;
    myBoard = d.board.id;
    E.boards[myBoard] = d.board.seats.length;
    if (!(d.board.seats.length >= 1 && d.board.seats.length <= 5)) fail('a board of 1-5', d.board.seats.length);
    if (!d.board.seats.some((s) => s.k === me.k)) fail('my seat is on my board', d.board);
    if (!(me.c >= 0 && me.c <= 4)) fail('a seat colour 0-4', me.c);
  });
  bot.on('mn:lead', (l) => { if (l.b !== myBoard) fail('a lead of another board', l); if (lead) E.leads++; });
  bot.on('mn:frenzy', () => { if (lead) E.frenzy++; });
  bot.on('mn:final', () => { finalSeen = true; if (lead) E.finals++; });
  bot.on('mn:move', (mv) => {
    E.moves++;
    E.movesPerKid[ctx.name]++;
    if (myBoard != null && mv.b !== myBoard) fail('a move of another board', { mine: myBoard, got: mv.b });
    if (me && mv.k === me.k) fail('my own move came as mn:move', mv);
  });

  bot.on('answer-result', (r) => {
    const mo = r && r.monopoly;
    if (!mo) { fail('answer-result without monopoly info', r); return; }
    if (!r.correct) { if (!(mo.wait > 0)) fail('a wrong answer without a wait', r); st.graceUntil = Date.now() + mo.wait + 500; return; }
    if (!(mo.tid > 0 && (mo.dice === 1 || mo.dice === 2) && mo.ms > 0)) { fail('a right answer must open a dice window', mo); return; }
    if (mo.dice === 2 && mo.streak % 3 !== 0) fail('two dice only every 3rd right in a row', mo);
    E.windows++;
    const t0 = Date.now();
    open[mo.tid] = { t0, dice: mo.dice };
    // the freeze clock: busy until the dice (tap or by itself) and a long turn are over
    st.graceUntil = t0 + mo.lead + mo.ms + 1200 + 15000;
    if (idle) return;                                        // the server rolls by itself
    timers.push(setTimeout(() => bot.emit('player:mn-roll', { pin: ctx.pin, tid: mo.tid }), mo.lead + 400 + Math.random() * 1200));
  });
  bot.on('mn:noroll', (d) => { if (!finalSeen) fail('a dice tap was refused', d); });
  bot.on('mn:turn', (s) => {
    if (!s || !open[s.tid]) { if (!(last && s && last.tid === s.tid)) fail('a turn for a window I never had', s); return; }
    const o = open[s.tid];
    delete open[s.tid];
    last = s;
    E.turns++;
    if (s.auto) { E.autos++; if (idle) E.idleAutos++; }
    else if (idle) fail('the idle kid got a tapped turn', s);
    if (s.dice.length !== o.dice) fail('the number of dice', { want: o.dice, got: s.dice });
    if (s.dice.length === 2) E.doubles++;
    if (s.dice.some((d) => !(d >= 1 && d <= 6))) fail('a die out of 1-6', s.dice);
    const steps = s.dice.reduce((a, d) => a + d, 0);
    const ahead = s.ev.filter((e) => e.type === 'lucky' && e.out === 'ahead').length * 3;
    if (s.path.length !== steps + ahead) fail('path length = dice (+3 for «¡Avanza 3!»)', { path: s.path.length, steps, ahead });
    let pos = s.from;
    s.path.forEach((p) => { if (p !== (pos + 1) % MAP.N) fail('the path follows the loop', s); pos = p; });
    if (s.ms !== MAP.scriptMs(s)) fail('turn length = the shared clock', { ms: s.ms, want: MAP.scriptMs(s) });
    E.maxTurnMs = Math.max(E.maxTurnMs, s.ms);
    s.ev.forEach((e) => {
      if (e.type === 'star') E.stars++;
      if (e.type === 'buy') E.buys++;
      if (e.type === 'toll') E.tolls++;
      if (e.type === 'storm') E.storms++;
      if (e.type === 'pass') E.passes++;
      if (e.type === 'lucky') E.lucky[e.out] = (E.lucky[e.out] || 0) + 1;
      const mine = e.s && e.s[s.k];
      if (!mine) fail('every moment carries my numbers', e);
    });
    if (s.coins < 0) fail('coins below 0', s);
    me = Object.assign({}, me || {}, { pos: s.pos, coins: s.coins, stars: s.stars });
    st.graceUntil = Date.now() + s.ms + 1500;
  });

  bot.on('game-end', (d) => {
    timers.forEach(clearTimeout);
    if (Object.keys(open).length > 0) fail('dice windows that never got a turn', Object.keys(open));
    const mo = d && d.monopoly;
    if (!mo || !d.me || !mo.board) { fail('end payload', d); return; }
    if (d.me.b !== myBoard) fail('my card is of my board', d.me);
    if (me && d.me.stars !== me.stars && last) {
      // a move by a rival (a swap, a duel, a storm, a toll) may have changed my numbers after my last turn: only stars
      // can't change that way
      fail('my stars on the card = my last turn', { card: d.me.stars, mine: me.stars });
    }
    if (d.me.total !== d.me.stars + (d.me.bonus || []).length) fail('total = stars + bonus stars', d.me);
    (mo.board.bonus || []).forEach((s) => s.winners.forEach((k) => { if (!mo.board.rows.some((x) => x.k === k)) fail('a bonus star for a kid of another board', s); }));
    if (!mo.board.rows.some((x) => x.k === d.me.k)) fail('I am in my board ranking', mo.board);
    if (d.me.won !== mo.board.winners.includes(d.me.k)) fail('won flag', d.me);
    if (lead) { E.ends++; E.podium = (mo.podium || []).map((x) => `${x.name}:${x.total}★${x.coins}`); }
    if (d.me.won) E.winners++;
  });
};
