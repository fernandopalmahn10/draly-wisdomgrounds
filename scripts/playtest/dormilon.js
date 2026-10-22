// Playtest handler for «¡No despiertes a Dralingo!»: there are no «question» events for everyone (only the kid whose turn
// it is gets dm:q), so this handler plays like a kid of a board: on its own turn it answers each question after a human
// delay (0.8-2.6 s; it doesn't know the right one), stops with «¡Me retiro!» now and then (greedy and careful bots), and
// while a friend plays it guesses «¿Se despierta?» and reacts. Its questions count as the harness's "questions".
// Frozen = the bot's board shows no turn event (pre / go / stroke / stir / end / wake / night) for 20 s while the game
// runs, or its own turn started and no question came within 4 s. Rules checked on every event a bot sees: only the turn
// kid gets dm:q; a copy for the board never carries the right answer; nothing ever carries the hidden limit; a stroke is
// +1 (+2 in the last 30 s); the waker's score goes to 0; the end payload has the bot's board, its place and its card.
'use strict';

module.exports = (bot, ctx) => {
  const st = ctx.state;
  st.onDemand = true;
  ctx.report.endedGrace = 4500;                 // «¡FINAL!» (2.4 s) then game-end: wait for it
  const E = ctx.report.dormilon || (ctx.report.dormilon = {
    inits: 0, seated: 0, boards: {}, turns: 0, pats: 0, misses: 0, wakes: 0, nights: 0, stops: 0, guesses: 0, reacts: 0,
    turnPats: [], frenzy: 0, finals: 0, ends: 0, endChecks: 0, ruleChecks: 0, maxBoardGapS: 0, winners: 0,
  });
  const fail = (what, d) => ctx.report.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  let me = null, b = null, myTurn = false, myScore = 0, pats = 0, stopAt = 0, active = false, ended = false, flagged = false;
  let lastBoardEv = Date.now(), goAt = 0, gotQ = false, timers = [];
  const style = Math.random() < 0.3 ? 'careful' : Math.random() < 0.5 ? 'greedy' : 'normal';
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const mine = (d) => d && d.b === b;
  const seen = () => { lastBoardEv = Date.now(); };
  bot.onAny((ev, d) => {
    if (/^dm:/.test(ev) && d && typeof d === 'object' && ('limit' in d || 'danger' in d || 'cuts' in d)) fail('leak: the limit reached a phone', { ev });
  });
  bot.on('dm:init', (d) => {
    E.inits++;
    if (d.you && me == null) { me = d.you.k; E.seated++; }
    if (d.board) { b = d.board.id; E.boards[b] = d.board.seats.length; }
    if (d.q && !('qid' in d.q)) fail('dm:init open question without qid', d.q);
    myScore = d.you ? d.you.score : myScore;
    active = d.phase === 'play' || d.phase === 'intro' || d.phase === 'countdown';
    seen();
  });
  bot.on('dm:seat', (d) => { if (d.board && d.board.id === b) E.boards[b] = d.board.seats.length; });
  bot.on('dm:play', () => { active = true; seen(); });
  bot.on('dm:pre', (d) => {
    if (!mine(d)) return;
    seen();
    myTurn = d.k === me;
    if (myTurn) { pats = 0; stopAt = style === 'careful' ? 1 + Math.floor(Math.random() * 2) : style === 'greedy' ? 99 : 2 + Math.floor(Math.random() * 3); return; }
    if (Math.random() < 0.75) timers.push(setTimeout(() => { E.guesses++; bot.emit('player:dm-guess', { pin: ctx.pin, g: Math.random() < 0.35 ? 'wake' : 'sleep' }); }, 200 + Math.random() * 1800));
  });
  bot.on('dm:go', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k === me) { E.turns++; goAt = Date.now(); gotQ = false; }
  });
  bot.on('dm:q', (q) => {
    if (!q || q.b !== b) { fail('dm:q from another board', q); return; }
    if (!myTurn) fail('dm:q while it is not my turn', q);
    if ('correctIdx' in q || 'correct' in q) fail('dm:q carries the right answer', q);
    gotQ = true;
    st.questions++;
    st.lastQAt = Date.now();
    st.waiting = false;
    timers.push(setTimeout(() => {
      if (pats >= stopAt) { E.stops++; bot.emit('player:dm-stop', { pin: ctx.pin }); return; }
      st.answers++;
      st.waiting = true;
      st.lastAnsAt = Date.now();
      bot.emit('player:dm-answer', { pin: ctx.pin, qid: q.qid, idx: Math.floor(Math.random() * q.answers.length) });
    }, 800 + Math.random() * 1800));
  });
  bot.on('dm:bq', (d) => {
    if ('correctIdx' in d || 'qid' in d) fail('dm:bq carries the answer or buttons', d);
    if (mine(d) && d.k === me) fail('the turn kid got the board copy', d);
    if (Math.random() < 0.2) { E.reacts++; bot.emit('player:dm-react', { pin: ctx.pin, e: ['shh', 'wow', 'lol', 'clap'][Math.floor(Math.random() * 4)] }); }
  });
  bot.on('dm:pat', (d) => {
    if (!mine(d)) return;
    seen();
    E.ruleChecks++;
    if (!(d.pts === 1 || d.pts === 2)) fail('a stroke is +1 or +2', d);
    if (d.x2 && d.pts !== 2) fail('the last 30 s stroke is +2', d);
    if (d.k === me) { if (d.score !== myScore + d.pts) fail('my score after a stroke', { d, myScore }); myScore = d.score; pats++; E.pats++; st.correct++; st.waiting = false; }
  });
  bot.on('dm:miss', (d) => { if (!mine(d)) return; seen(); if (d.k === me) { E.misses++; st.wrong++; st.waiting = false; } if (!(d.correctIdx >= 0)) fail('a stir shows the right answer', d); });
  bot.on('dm:wake', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k === me) { E.wakes++; E.turnPats.push(pats); if (d.lost !== myScore) fail('the waker loses exactly its points', { lost: d.lost, myScore }); myScore = 0; myTurn = false; clear(); }
  });
  bot.on('dm:end', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k === me) { E.turnPats.push(d.pats); if (d.score !== myScore) fail('my score at the end of my turn', { d, myScore }); myTurn = false; clear(); }
  });
  bot.on('dm:night', (d) => { if (mine(d)) { seen(); E.nights++; } });     // (every phone of the board counts it)
  bot.on('dm:nope', () => { st.waiting = false; });                          // (an answer refused: the next question still comes)
  bot.on('dm:skip', (d) => { if (mine(d)) seen(); });
  bot.on('dm:frenzy', (d) => { if (!d.off && ctx.name === 'Bot01') E.frenzy++; });
  bot.on('dm:final', () => { active = false; clear(); if (ctx.name === 'Bot01') E.finals++; });
  bot.on('game-end', (d) => {
    ended = true; active = false; clear();
    const dm = d && d.dormilon;
    E.endChecks++;
    if (!dm || !dm.board || !d.me) { fail('end payload', d); return; }
    const rows = dm.board.rows || [];
    const row = rows.find((r) => r.k === me);
    if (!row) fail('end payload: my row in my board', dm.board);
    if (d.me.score !== (row && row.score)) fail('end payload: my card = my row', { me: d.me, row });
    if (!(d.me.rank >= 1 && d.me.of === rows.length && d.me.classOf >= rows.length)) fail('end payload me', d.me);
    const top = Math.max(0, ...rows.map((r) => r.score));
    const w = dm.board.winners || [];
    if (top > 0 && !w.length) fail('a board with points has a winner', dm.board);
    if (w.some((k) => (rows.find((r) => r.k === k) || {}).score !== top)) fail('the winner has the top score', dm.board);
    if (!Array.isArray(d.me.stars)) fail('my card lists my stars', d.me);
    if (ctx.name === 'Bot01') { E.ends++; E.winners = (dm.podium || []).length; }
  });
  const watch = setInterval(() => {
    if (ended) { clearInterval(watch); return; }
    const now = Date.now();
    if (active) E.maxBoardGapS = Math.max(E.maxBoardGapS, Math.round((now - lastBoardEv) / 100) / 10);
    const noQ = myTurn && goAt && !gotQ && now - goAt > 4000;
    if (active && !flagged && (now - lastBoardEv > 20000 || noQ)) {
      flagged = true;
      ctx.report.stalls.push({ name: ctx.name, secondsWithoutBoardEvent: Math.round((now - lastBoardEv) / 1000), noQuestionOnMyTurn: noQ, lastEvent: st.lastEvent });
    }
  }, 1000);
};
