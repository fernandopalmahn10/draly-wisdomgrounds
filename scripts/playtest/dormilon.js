// Playtest handler for «Draly Siesta · ¡No despiertes a Dralingo!» v4 (the Windows rhythm): every bot plays like a kid of
// a board. In the QUESTION WINDOW it answers its questions (dm:q) after a human delay (1.2-3 s; it read the class pack:
// right 80 % of the time) to earn feathers (max 4); every 6th bot is «silent» and never answers (its questions run out:
// late = a feather lost, it builds nothing: E.byStyle in the report). In the PLAY WINDOW every bot with feathers RUBS at
// the same time: one player:dm-stroke (with the finger's x, y) every 0.45-1 s (greedy bots scribble and never stop,
// careful bots keep their feathers («¡Guardar mis plumas!») when his face says «careful» (cue 2+), normal bots at 3 or cue 3), reacts
// once safe.
// Frozen = the bot's board shows no event for 20 s while the game runs; or a bot in a question window with room in its
// quiver gets no question within 6 s of its last answer; or a play window with feathers where not one stroke of mine
// got through within 3 s. Rules checked on every event a bot sees: a question never carries its answer; nothing carries
// the danger; strokes only in the play window; a stroke = one feather from my hand → +1 collected (+2 in the final round); a right
// answer = one feather (max 4), a miss costs one; the waker's feathers of the round fly away (exactly them), the others'
// stay; keeping adds this round's feathers to my collection; the tally = my collection; the end payload has the bot's board, its place and its card.
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
    require('../../core/packs').forGames(require('../../core/sets').loadSet(setId).questions || []).forEach((q) => RIGHT.set(String(q.text), String(q.correct)));
  } catch (_) { /* no pack: the bots guess */ }
  return RIGHT;
}
const MAXF = 4;

module.exports = (bot, ctx) => {
  const st = ctx.state;
  st.onDemand = true;
  ctx.report.endedGrace = 4500;                 // «¡FINAL!» (2.4 s) then game-end: wait for it
  const E = ctx.report.dormilon || (ctx.report.dormilon = {
    inits: 0, seated: 0, boards: {}, rounds: 0, pws: 0, strokes: 0, fast: 0, wakes: 0, wakeWindows: {}, banks: 0, quiz: 0, right: 0,
    reacts: 0, frenzy: 0, finals: 0, ends: 0, endChecks: 0, ruleChecks: 0, maxBoardGapS: 0, late: 0, lostFeathers: 0, shifts: 0,
    byStyle: {}, othersSeen: 0, simul: 0,
  });
  const fail = (what, d) => ctx.report.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  let me = null, b = null, score = 0, pile = 0, feathers = 0, safe = false, awake = false, cue = 0, phase = null, round = 0;
  let active = false, ended = false, flagged = false, pwAt = 0, firstStrokeAt = 0, calmAt = 0;
  let lastBoardEv = Date.now(), lastAnswerAt = Date.now(), hasQ = false, timers = [], rubT = null, playing = false, recentPats = [];
  const botN = parseInt(String(ctx.name).replace(/\D/g, ''), 10) || 0;   // (every 6th bot never answers: the proof always has some)
  const style = botN % 6 === 3 ? 'silent' : botN % 3 === 1 ? 'careful' : botN % 3 === 2 ? 'greedy' : 'normal';
  const clear = () => { timers.forEach(clearTimeout); timers = []; if (rubT) { clearTimeout(rubT); rubT = null; } };
  const mine = (d) => d && d.b === b;
  const seen = () => { lastBoardEv = Date.now(); };
  bot.onAny((ev, d) => {
    if (/^dm:/.test(ev) && d && typeof d === 'object' && ('danger' in d || 'cuts' in d)) fail('leak: the danger reached a phone', { ev });
  });
  bot.on('dm:init', (d) => {
    E.inits++;
    if (d.you && me == null) { me = d.you.k; E.seated++; }
    if (d.board) { b = d.board.id; E.boards[b] = d.board.seats.length; }
    if (d.you) { score = d.you.score; feathers = d.you.feathers; pile = d.you.pile || 0; safe = !!d.you.safe; }
    if (d.round) phase = d.round.phase;
    active = d.phase === 'play' || d.phase === 'intro' || d.phase === 'countdown';
    seen();
  });
  bot.on('dm:seat', (d) => { if (d.board && d.board.id === b) E.boards[b] = d.board.seats.length; });
  bot.on('dm:play', () => { active = true; playing = true; seen(); lastAnswerAt = Date.now(); });
  bot.on('dm:round', (d) => {
    seen();
    phase = d.phase;
    if (d.phase === 'qw') { round = d.n; pile = 0; safe = false; lastAnswerAt = Date.now(); if (ctx.name === 'Bot01') E.rounds++; }
    if (d.phase === 'pwin') { hasQ = false; clear(); }
    if (d.phase === 'pw') {
      pwAt = Date.now(); firstStrokeAt = 0; awake = false; safe = feathers <= 0;
      if (ctx.name === 'Bot01') E.pws++;
      if (!safe) rubT = setTimeout(rub, 300 + Math.random() * 900);
    }
    if (d.phase === 'pwout') {
      clear();
      const t = (d.tally || []).find((x) => x.b === b);
      const row = t && t.rows.find((x) => x.k === me);
      E.ruleChecks++;
      if (!row) fail('the tally has my row', d);
      else if (row.score !== score + pile) fail('the tally: my feathers of the round were kept', { row, score, pile });
      if (row) { score = row.score; feathers = row.feathers; }
      if (t && t.wakes) E.wakeWindows[b + ':' + round] = t.wakes;
      else if (t) E.wakeWindows[b + ':' + round] = E.wakeWindows[b + ':' + round] || 0;
      pile = 0; safe = true;
    }
  });
  // the questions
  bot.on('dm:q', (q) => {
    if ('correctIdx' in q || 'correct' in q) fail('dm:q carries the right answer', q);
    if (phase && phase !== 'qw') fail('a question outside the question window', { phase });
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
    if (d.ok) { E.right++; st.correct++; if (d.feathers !== Math.min(MAXF, feathers + 1)) fail('a right answer = one feather (max 4)', { d, feathers }); }
    else {
      st.wrong++;
      if (d.late) E.late++;
      if (d.feathers !== Math.max(0, feathers - 1)) fail('a wrong or late answer costs a feather', { d, feathers });
      if (feathers > 0) E.lostFeathers++;
    }
    feathers = d.feathers;
  });
  bot.on('dm:nope', () => { hasQ = false; lastAnswerAt = Date.now(); });
  bot.on('dm:ready', (d) => { if (mine(d)) { seen(); const x = (d.feathers || []).find((f) => f.k === me); if (x && x.feathers !== feathers) fail('«¡A hacerle cosquillas!» carries my feathers', { x, feathers }); cue = d.cue || 0; } });
  // the play window: everyone rubs at once
  const rub = () => {
    rubT = null;
    if (ended || phase !== 'pw' || safe || feathers <= 0) return;
    if (awake) { rubT = setTimeout(rub, 600); return; }
    const stopAt = style === 'careful' ? pile >= 1 && cue >= 2 : style === 'normal' ? pile >= 3 || (pile >= 1 && cue >= 3) : false;
    if (stopAt) { E.banks++; bot.emit('player:dm-stop', { pin: ctx.pin }); return; }
    bot.emit('player:dm-stroke', { pin: ctx.pin, x: 0.32 + Math.random() * 0.16, y: 0.36 + Math.random() * 0.08 });
    rubT = setTimeout(rub, style === 'greedy' ? 300 + Math.random() * 250 : 600 + Math.random() * 450);
  };
  bot.on('dm:pat', (d) => {
    if (!mine(d)) return;
    seen();
    E.ruleChecks++;
    if (phase !== 'pw') fail('a stroke outside the play window', { phase, d });
    if (!(d.pts === 1 || d.pts === 2)) fail('a stroke is +1 or +2', d);
    if (d.x2 && d.pts !== 2) fail('a final-round stroke is +2', d);
    if (!(d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1)) fail('a stroke carries where it landed', d);
    cue = d.cue;
    const now = Date.now();
    recentPats = recentPats.filter((p) => now - p.t < 1000);
    if (recentPats.some((p) => p.k !== d.k)) E.simul++;
    recentPats.push({ k: d.k, t: now });
    if (d.k !== me) { E.othersSeen++; return; }
    if (d.pile !== pile + d.pts) fail('my feathers of the round after a stroke', { d, pile });
    if (d.feathers !== feathers - 1) fail('a stroke spends one feather', { d, feathers });
    pile = d.pile; feathers = d.feathers; E.strokes++; if (d.fast) E.fast++;
    if (!firstStrokeAt) firstStrokeAt = now;
  });
  bot.on('dm:bank', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k !== me) return;
    E.ruleChecks++;
    if (d.score !== score + d.pile || d.pile !== pile) fail('«¡Guardar mis plumas!» keeps exactly my feathers of the round', { d, score, pile });
    score = d.score; pile = 0; safe = true;
    if (rubT) { clearTimeout(rubT); rubT = null; }
    if (Math.random() < 0.4) timers.push(setTimeout(() => { E.reacts++; bot.emit('player:dm-react', { pin: ctx.pin, e: ['wow', 'lol', 'clap', 'shh'][Math.floor(Math.random() * 4)] }); }, 400 + Math.random() * 1500));
  });
  bot.on('dm:wake', (d) => {
    if (!mine(d)) return;
    seen();
    awake = true;
    E.ruleChecks++;
    const f = (d.fell || []).find((x) => x.k === me);
    if (d.k === me) {
      E.wakes++;
      if (!f || f.lost !== pile) fail('the waker\'s feathers of the round fly away, exactly them', { d, pile });
      pile = 0;
    } else if (f) fail('only the waker\'s feathers fly away', d);
  });
  bot.on('dm:sleep', (d) => { if (mine(d)) { seen(); awake = false; calmAt = Date.now(); cue = d.cue || 0; if (phase === 'pw' && !safe && feathers > 0 && !rubT) rubT = setTimeout(rub, 300 + Math.random() * 500); } });
  bot.on('dm:shift', (d) => { if (mine(d)) { seen(); cue = d.cue; if (d.k === me) E.shifts++; } });
  bot.on('dm:nostroke', (d) => { E.nostroke = E.nostroke || {}; E.nostroke[d.why] = (E.nostroke[d.why] || 0) + 1; });
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
    if (d.me.score !== score + pile) fail('end payload: my feathers', { me: d.me.score, score, pile });
    if (!(d.me.rank >= 1 && d.me.of === rows.length && d.me.classOf >= rows.length)) fail('end payload me', d.me);
    const top = Math.max(0, ...rows.map((r) => r.score));
    const w = dm.board.winners || [];
    if (top > 0 && !w.length) fail('a board with feathers has a winner', dm.board);
    if (w.some((k) => (rows.find((r) => r.k === k) || {}).score !== top)) fail('the winner has the top score', dm.board);
    if (ctx.name === 'Bot01') E.ends++;
  });
  const watch = setInterval(() => {
    if (ended) { clearInterval(watch); return; }
    const now = Date.now();
    if (active) E.maxBoardGapS = Math.max(E.maxBoardGapS, Math.round((now - lastBoardEv) / 100) / 10);
    const noStroke = phase === 'pw' && pwAt && feathers > 0 && !safe && !awake && !firstStrokeAt && now - Math.max(pwAt, calmAt) > 3000;
    const noQuiz = playing && active && phase === 'qw' && !hasQ && now - lastAnswerAt > 6000 && style !== 'silent';
    if (active && !flagged && (now - lastBoardEv > 20000 || noStroke || noQuiz)) {
      flagged = true;
      ctx.report.stalls.push({ name: ctx.name, secondsWithoutBoardEvent: Math.round((now - lastBoardEv) / 1000), noStroke, noQuiz, lastEvent: st.lastEvent, style, feathers, phase });
    }
  }, 1000);
};
