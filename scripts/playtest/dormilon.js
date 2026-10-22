// Playtest handler for «¡No despiertes a Dralingo!» v3: every bot plays like a kid of a board. While it is not its turn
// it answers the quiz (dm:q) after a human delay (1.2-3 s; it read the class pack: right 80 % of the time) to earn
// feathers; 15 % of the bots are «silent» and never answer (their questions run out: late = a feather lost, so they must
// end below the careful ones: E.byStyle in the report). A wrong or late answer costs a feather (checked). On its turn
// (dm:go) it RUBS: one player:dm-stroke every 0.45-1 s (greedy bots scribble, careful bots stop after 2 strokes with
// «¡Me retiro!»), and moves its feather (player:dm-feather); it guesses «¿Se despierta?» and reacts.
// Frozen = the bot's board shows no turn event (pre / go / stroke / end / wake / night) for 20 s while the game runs; a
// bot that is not playing and has room in its quiver gets no question within 6 s of its last answer; or its own turn
// started and not one stroke got through within 3 s. Rules checked on every event a bot sees: only the turn kid strokes;
// a question never carries its answer; nothing carries the hidden limit; a stroke = +1 (+2 in the last 30 s) and one
// feather; a right answer = one feather (max 6); the waker loses exactly its points; the end payload has the bot's board,
// its place and its card.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
let RIGHT = null;                 // question text → the right answer (the pack the room loaded; read once per process)
function rightOf(ctx) {
  if (RIGHT) return RIGHT;
  RIGHT = new Map();
  try {
    if (!process.env.DRALY_DATA_DIR) process.env.DRALY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-bots-'));
    const setId = ctx.report.set && ctx.report.set.setId;
    (require('../../core/sets').loadSet(setId).questions || []).forEach((q) => RIGHT.set(String(q.text), String(q.correct)));
  } catch (_) { /* no pack: the bots guess */ }
  return RIGHT;
}

module.exports = (bot, ctx) => {
  const st = ctx.state;
  st.onDemand = true;
  ctx.report.endedGrace = 4500;                 // «¡FINAL!» (2.4 s) then game-end: wait for it
  const E = ctx.report.dormilon || (ctx.report.dormilon = {
    inits: 0, seated: 0, boards: {}, turns: 0, strokes: 0, fast: 0, wakes: 0, stops: 0, empties: 0, quiz: 0, right: 0,
    guesses: 0, reacts: 0, feRelays: 0, turnStrokes: [], frenzy: 0, finals: 0, ends: 0, endChecks: 0, ruleChecks: 0, maxBoardGapS: 0,
    late: 0, lostFeathers: 0, shifts: 0, byStyle: {},
  });
  const fail = (what, d) => ctx.report.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  let me = null, b = null, myTurn = false, myScore = 0, feathers = 3, strokes = 0, active = false, ended = false, flagged = false;
  let lastBoardEv = Date.now(), goAt = 0, firstStrokeAt = 0, lastAnswerAt = Date.now(), hasQ = false, timers = [], rubT = null, playing = false;
  const botN = parseInt(String(ctx.name).replace(/\D/g, ''), 10) || 0;   // (every 6th bot never answers: the proof always has some)
  const style = botN % 6 === 3 ? 'silent' : Math.random() < 0.35 ? 'careful' : Math.random() < 0.5 ? 'greedy' : 'normal';
  const clear = () => { timers.forEach(clearTimeout); timers = []; if (rubT) { clearTimeout(rubT); rubT = null; } };
  const mine = (d) => d && d.b === b;
  const seen = () => { lastBoardEv = Date.now(); };
  bot.onAny((ev, d) => {
    if (/^dm:/.test(ev) && d && typeof d === 'object' && ('limit' in d || 'danger' in d || 'cuts' in d)) fail('leak: the limit reached a phone', { ev });
  });
  bot.on('dm:init', (d) => {
    E.inits++;
    if (d.you && me == null) { me = d.you.k; E.seated++; }
    if (d.board) { b = d.board.id; E.boards[b] = d.board.seats.length; }
    if (d.you) { myScore = d.you.score; feathers = d.you.feathers; }
    active = d.phase === 'play' || d.phase === 'intro' || d.phase === 'countdown';
    seen();
  });
  bot.on('dm:seat', (d) => { if (d.board && d.board.id === b) E.boards[b] = d.board.seats.length; });
  bot.on('dm:play', () => { active = true; playing = true; seen(); lastAnswerAt = Date.now(); });
  // the quiz
  bot.on('dm:q', (q) => {
    if ('correctIdx' in q || 'correct' in q) fail('dm:q carries the right answer', q);
    if (myTurn) fail('a quiz question during my own turn', q);
    hasQ = true;
    st.questions++;
    st.lastQAt = Date.now();
    st.waiting = false;
    bot.emit('player:dm-seen', { pin: ctx.pin, qid: q.qid });   // (the phone shows it)
    if (style === 'silent') return;                     // (never answers: its questions run out)
    const right = rightOf(ctx).get(String(q.text));
    const ri = right != null ? q.answers.indexOf(right) : -1;
    const idx = ri >= 0 && Math.random() < 0.8 ? ri : Math.floor(Math.random() * q.answers.length);
    timers.push(setTimeout(() => {
      st.answers++;
      E.quiz++;
      bot.emit('player:dm-answer', { pin: ctx.pin, qid: q.qid, idx });
    }, 1200 + Math.random() * 1800));
  });
  bot.on('dm:qx', () => { hasQ = false; });
  bot.on('dm:qr', (d) => {
    hasQ = false;
    lastAnswerAt = Date.now();
    E.ruleChecks++;
    if (d.ok) { E.right++; st.correct++; if (d.feathers !== Math.min(6, feathers + 1)) fail('a right answer = one feather (max 6)', { d, feathers }); }
    else {
      st.wrong++;
      if (d.late) E.late++;
      if (d.feathers !== Math.max(0, feathers - 1)) fail('a wrong or late answer costs a feather', { d, feathers });
      if (feathers > 0) E.lostFeathers++;
    }
    feathers = d.feathers;
  });
  bot.on('dm:nope', () => { hasQ = false; lastAnswerAt = Date.now(); });
  // the turns
  bot.on('dm:pre', (d) => {
    if (!mine(d)) return;
    seen();
    myTurn = d.k === me;
    if (myTurn) { strokes = 0; goAt = 0; firstStrokeAt = 0; if (d.feathers != null) feathers = d.feathers; hasQ = false; return; }
    if (!d.guided && Math.random() < 0.75) timers.push(setTimeout(() => { E.guesses++; bot.emit('player:dm-guess', { pin: ctx.pin, g: Math.random() < 0.35 ? 'wake' : 'sleep' }); }, 200 + Math.random() * 1500));
  });
  const rub = () => {
    if (!myTurn || ended) return;
    if (style === 'careful' && strokes >= 2) { E.stops++; bot.emit('player:dm-stop', { pin: ctx.pin }); return; }
    if (style === 'normal' && strokes >= 4) { E.stops++; bot.emit('player:dm-stop', { pin: ctx.pin }); return; }
    bot.emit('player:dm-feather', { pin: ctx.pin, x: 0.35 + Math.random() * 0.12, y: 0.38 + Math.random() * 0.06 });
    bot.emit('player:dm-stroke', { pin: ctx.pin });
    rubT = setTimeout(rub, style === 'greedy' ? 300 + Math.random() * 300 : 600 + Math.random() * 450);
  };
  bot.on('dm:go', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k !== me) return;
    E.turns++;
    goAt = Date.now();
    firstStrokeAt = 0;
    if (d.feathers != null) feathers = d.feathers;
    if (feathers > 0) rubT = setTimeout(rub, 500 + Math.random() * 500);
  });
  bot.on('dm:fe', (d) => { if (mine(d)) { E.feRelays++; if (d.k === me) fail('my own feather came back to me', d); } });
  bot.on('dm:pat', (d) => {
    if (!mine(d)) return;
    seen();
    E.ruleChecks++;
    if (!(d.pts === 1 || d.pts === 2)) fail('a stroke is +1 or +2', d);
    if (d.x2 && d.pts !== 2) fail('the last 30 s stroke is +2', d);
    if (d.k !== me) return;
    if (!myTurn) fail('a stroke of mine outside my turn', d);
    if (d.score !== myScore + d.pts) fail('my score after a stroke', { d, myScore });
    if (d.feathers !== feathers - 1) fail('a stroke spends one feather', { d, feathers });
    myScore = d.score; feathers = d.feathers; strokes++; E.strokes++; if (d.fast) E.fast++;
    if (!firstStrokeAt) firstStrokeAt = Date.now();
  });
  bot.on('dm:wake', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k === me) { E.wakes++; E.turnStrokes.push(strokes); if (d.lost !== myScore) fail('the waker loses exactly its points', { lost: d.lost, myScore }); myScore = 0; myTurn = false; clear(); lastAnswerAt = Date.now() + 3000; }
  });
  bot.on('dm:end', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k === me) {
      E.turnStrokes.push(d.pats);
      if (d.why === 'empty') E.empties++;
      if (d.score !== myScore) fail('my score at the end of my turn', { d, myScore });
      if (d.feathers != null) feathers = d.feathers;
      myTurn = false; clear(); lastAnswerAt = Date.now();
    }
  });
  bot.on('dm:shift', (d) => { if (mine(d)) { seen(); if (d.k === me) E.shifts++; } });
  bot.on('dm:nostroke', (d) => { E.nostroke = E.nostroke || {}; E.nostroke[d.why] = (E.nostroke[d.why] || 0) + 1; });
  bot.on('dm:night', (d) => { if (mine(d)) seen(); });
  bot.on('dm:skip', (d) => { if (mine(d)) seen(); });
  bot.on('dm:frenzy', (d) => { if (!d.off && ctx.name === 'Bot01') E.frenzy++; });
  bot.on('dm:final', () => { active = false; clear(); if (ctx.name === 'Bot01') E.finals++; });
  bot.on('game-end', (d) => {
    ended = true; active = false; clear();
    const dm = d && d.dormilon;
    E.endChecks++;
    if (!dm || !dm.board || !d.me) { fail('end payload', d); return; }
    (E.byStyle[style] = E.byStyle[style] || []).push(d.me.score);
    const rows = dm.board.rows || [];
    const row = rows.find((r) => r.k === me);
    if (!row) fail('end payload: my row in my board', dm.board);
    if (d.me.score !== (row && row.score)) fail('end payload: my card = my row', { me: d.me, row });
    if (!(d.me.rank >= 1 && d.me.of === rows.length && d.me.classOf >= rows.length)) fail('end payload me', d.me);
    const top = Math.max(0, ...rows.map((r) => r.score));
    const w = dm.board.winners || [];
    if (top > 0 && !w.length) fail('a board with points has a winner', dm.board);
    if (w.some((k) => (rows.find((r) => r.k === k) || {}).score !== top)) fail('the winner has the top score', dm.board);
    if (ctx.name === 'Bot01') E.ends++;
  });
  const watch = setInterval(() => {
    if (ended) { clearInterval(watch); return; }
    const now = Date.now();
    if (active) E.maxBoardGapS = Math.max(E.maxBoardGapS, Math.round((now - lastBoardEv) / 100) / 10);
    const noStroke = myTurn && goAt && feathers > 0 && !firstStrokeAt && now - goAt > 3000;
    const noQuiz = playing && active && !myTurn && !hasQ && feathers < 6 && now - lastAnswerAt > 6000 && style !== 'silent';
    if (active && !flagged && (now - lastBoardEv > 20000 || noStroke || noQuiz)) {
      flagged = true;
      ctx.report.stalls.push({ name: ctx.name, secondsWithoutBoardEvent: Math.round((now - lastBoardEv) / 1000), noStroke, noQuiz, lastEvent: st.lastEvent, style, feathers, strokes, sinceGo: goAt ? now - goAt : null });
    }
  }, 1000);
};
