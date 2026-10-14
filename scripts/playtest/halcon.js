// Playtest handler for Ojos de Halcón: there are no «question» events (the boards run the rounds), so this handler
// plays the rounds like a kid: on hc:open it looks at a window (it doesn't know the right one) after a human delay
// (0.3–4.5 s); now and then it taps twice (the «locked» path) or is distracted and never looks. Rounds count as the
// harness's "questions"; a bot without a new round for 20 s while the game runs is reported as frozen. The lead bot
// checks every resolve against the rules (right looks get 5/3/2/1 by board size in speed order, wrong = 0) and the
// end payload; a broken rule lands in report.errors so the verdict fails. Stats in report.halcon.
'use strict';

const TABLE = [5, 3, 2, 1, 1];

module.exports = (bot, ctx) => {
  const st = ctx.state;
  st.onDemand = true;                          // the harness's generic freeze check needs questions; ours is below
  const E = ctx.report.halcon || (ctx.report.halcon = {
    inits: 0, rounds: 0, opens: 0, looks: 0, mine: {}, resolves: 0, pts: 0, fives: 0, finishes: 0, ends: 0,
    boardSizes: {}, botsSeated: 0, maxRoundGapS: 0, ruleChecks: 0, endChecks: 0, winner: null, roundsPlayed: null,
  });
  const lead = ctx.name === 'Bot01';
  let you = null, board = null, size = 0, timers = [], lastRoundAt = Date.now(), active = false, ended = false, flagged = false;
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const fail = (what, d) => ctx.report.errors.push({ who: ctx.name, ev: 'rule:' + what, d });

  bot.on('hc:init', (d) => {
    E.inits++;
    lastRoundAt = Date.now();                  // the stall clock starts with the game, not when the bot joined the lobby
    if (d.you != null && you == null) { E.botsSeated++; }
    if (d.you != null) { you = d.you; board = d.board; }
    const b = (d.boards || [])[0];
    if (b) { size = b.seats.length; E.boardSizes[b.id] = b.seats.length; }
    active = true;
  });
  bot.on('hc:seat', (d) => { if (d.board && d.board.id === board) size = d.board.seats.length; });
  bot.on('hc:q', () => {
    active = true;
    const t = Date.now();
    if (lead) { E.rounds++; E.maxRoundGapS = Math.max(E.maxRoundGapS, Math.round((t - lastRoundAt) / 100) / 10); }
    lastRoundAt = t;
    st.questions++;
    st.lastQAt = t;
    clear();
  });
  bot.on('hc:open', (d) => {
    if (lead) E.opens++;
    const cands = (d.opts || []).map((o, i) => [o, i]).filter(([o]) => o != null).map(([, i]) => i);
    if (!cands.length || Math.random() < 0.08) return;         // distracted: never looks
    const pos = cands[Math.floor(Math.random() * cands.length)];
    const wait = 300 + Math.random() * 4200;
    timers.push(setTimeout(() => { E.looks++; bot.emit('player:hc-look', { pin: ctx.pin, pos }); }, wait));
    if (Math.random() < 0.06) timers.push(setTimeout(() => bot.emit('player:hc-look', { pin: ctx.pin, pos: (pos + 1) % 4 }), wait + 150));
  });
  bot.on('hc:mine', (r) => {
    E.mine[r.status] = (E.mine[r.status] || 0) + 1;
    if (r.status === 'ok') { st.answers++; st.waiting = false; }
  });
  bot.on('hc:resolve', (d) => {
    const rows = (d.board && d.board.rows) || [];
    const me = rows.find((r) => r.id === you);
    if (me) { E.pts += me.pts; if (me.pts === 5) E.fives++; if (me.ok) st.correct++; else st.wrong++; }
    if (lead) E.resolves++;
    // the rules, checked on every board a lead-ish bot sees (each bot checks its own board)
    const n = rows.length || size;
    const got = rows.filter((r) => r.ok).sort((a, b) => a.rank - b.rank).map((r) => r.pts);
    const want = TABLE.slice(0, Math.min(5, n)).slice(0, got.length);
    E.ruleChecks++;
    if (JSON.stringify(got) !== JSON.stringify(want)) fail('speed-rank points', { got, want, n });
    if (rows.some((r) => !r.ok && r.pts !== 0)) fail('wrong look must be 0', rows);
    if (rows.some((r) => r.ok && r.pts < 1)) fail('right look must score', rows);
  });
  bot.on('hc:finish', () => { if (lead) E.finishes++; active = false; });
  bot.on('game-end', (d) => {
    ended = true; active = false; clear();
    const h = d && d.halcon;
    E.endChecks++;
    if (!h || !Array.isArray(h.boards) || !d.me) { fail('end payload', d); return; }
    const b = h.boards[0];
    if (!b || !b.rows.some((r) => r.id === you) || !b.winners.length) fail('end payload board', h);
    if (!(d.me.rank >= 1 && d.me.of === (b ? b.rows.length : 0) && d.me.classOf >= d.me.of)) fail('end payload me', d.me);
    if (lead) { E.ends++; E.winner = h.top && h.top[0] ? h.top[0].name : null; E.roundsPlayed = h.rounds; }
  });
  const watch = setInterval(() => {
    if (ended) { clearInterval(watch); return; }
    if (active && !flagged && Date.now() - lastRoundAt > 20000) {
      flagged = true;
      ctx.report.stalls.push({ name: ctx.name, secondsWithoutQuestion: Math.round((Date.now() - lastRoundAt) / 1000), lastEvent: st.lastEvent, answers: st.answers });
    }
  }, 1000);
};
