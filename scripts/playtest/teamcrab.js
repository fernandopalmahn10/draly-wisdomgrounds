// Playtest handler for «Draly Cangrejo · ¡Atrapa a Fénec!» v2: every bot plays like a kid of a crew, in rounds.
// Question window: it answers its quick-fire question (tc:q) after a human delay (1.4-3.4 s; it read the class pack: right
// 80 % of the time); 1 bot in 6 is «silent» and never answers (its shown questions run out: El Péndulo eats, so it must end
// with no slam and no words: E.byStyle). Play window («¡A martillar!»): the Capitán (tc:roles) steers the crab
// (player:tc-steer) and every bot with charges slams (player:tc-slam): «skill» bots read Fénec's plan (tc:fen: he stands,
// crouches, runs 2 spots) and slam where he will be at the impact, one hammer in the air at a time per bot; «random» bots
// tap anywhere. It cheers now and then.
// Frozen = the bot's crew shows no event for 15 s while the game runs, or a non-silent bot gets no question for 7 s while
// its question window has 3 s+ left. Rules checked on every event a bot sees: a question never carries its answer; a miss
// is eaten anonymously (tc:eat has no kid; tc:mine only to that kid); the race never shows charges; roles: the Capitán is
// of the crew and every martillero has charges; I slam only with charges; a bonk = +2 or +4 for its slammer and the crew's
// words add up; the crew's words never go below 0; the end payload has my crew, my card and caught / escaped.
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
let RIGHT = null;
function rightOf(ctx) {
  if (RIGHT) return RIGHT;
  RIGHT = new Map();
  try {
    if (!process.env.DRALY_DATA_DIR) process.env.DRALY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-bots-'));
    const setId = ctx.report.set && ctx.report.set.setId;
    (require('../../core/sets').loadSet(setId).questions || []).forEach((q) => RIGHT.set(String(q.text), String(q.correct)));
  } catch (_) { /* no pack: the bots guess */ }
  return RIGHT;
}
const REACH = 1.0, FALL = 350, SPEED = 3.2, CROUCH = 300;

module.exports = (bot, ctx) => {
  const st = ctx.state;
  st.onDemand = true;
  ctx.report.endedGrace = 4500;
  const E = ctx.report.teamcrab || (ctx.report.teamcrab = {
    inits: 0, seated: 0, boards: {}, quiz: 0, right: 0, late: 0, eaten: 0, rounds: 0, playWindows: 0, captains: 0, slams: 0,
    impacts: 0, hits: 0, bonks: 0, assists: 0, steers: 0, crabMoves: 0, fenMoves: 0, aimRelays: 0, frenzy: 0, finals: 0, ends: 0,
    endChecks: 0, ruleChecks: 0, caught: 0, escaped: 0, maxBoardGapS: 0, byStyle: {}, slamsByStyle: {}, hitsByStyle: {},
  });
  const fail = (what, d) => ctx.report.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  let me = null, b = null, active = false, ended = false, flagged = false, playing = false;
  let charges = 0, role = 'none', claw = 'idle', phase = 'none', winUntil = 0, words = 0, crabX = 2, lastQAt = Date.now();
  let f = { mode: 'idle', x: 2, x0: 2, x1: 2, t0: 0, t1: 0 };
  let lastBoardEv = Date.now(), hasQ = false, timers = [], slamAt = 0, steerAt = 0, myAir = 0;
  const botN = parseInt(String(ctx.name).replace(/\D/g, ''), 10) || 0;
  const style = botN % 6 === 3 ? 'silent' : botN % 2 ? 'skill' : 'random';
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const mine = (d) => d && d.b === b;
  const seen = () => { lastBoardEv = Date.now(); };
  const clamp = (v, a, c) => Math.max(a, Math.min(c, v));
  function setFen(d) {
    const now = Date.now();
    f = { mode: d.mode, x: d.x, x0: d.x0, x1: d.x1, t0: now, t1: now + (d.ms || 0) };
    if (d.mode === 'run') { f.t0 = now - Math.max(0, (d.dur || 0) - (d.ms || 0)); f.t1 = f.t0 + (d.dur || 1); }
  }
  // where a kid who reads him expects Fénec at time t (null = can't tell / lying flat)
  function predict(t) {
    if (f.mode === 'flat' || f.mode === 'up') return null;
    if (f.mode === 'idle') return t <= f.t1 + CROUCH ? f.x : null;
    if (f.mode === 'crouch') { const dur = (Math.abs(f.x1 - f.x0) / SPEED) * 1000; if (t <= f.t1) return f.x0; return f.x0 + (f.x1 - f.x0) * Math.min(1, (t - f.t1) / Math.max(1, dur)); }
    const p = f.t1 > f.t0 ? clamp((t - f.t0) / (f.t1 - f.t0), 0, 1) : 1;
    return f.x0 + (f.x1 - f.x0) * p;
  }
  bot.on('tc:init', (d) => {
    E.inits++;
    if (d.you && me == null) { me = d.you.k; E.seated++; }
    if (d.board) { b = d.board.id; E.boards[b] = d.board.seats.length; words = d.board.words; crabX = d.board.crab; if (d.board.fen) setFen(d.board.fen); }
    if (d.you) { charges = d.you.charges || 0; claw = d.you.claw ? d.you.claw.st : 'idle'; }
    if (d.round) { phase = d.round.phase; winUntil = Date.now() + d.round.ms; }
    active = d.phase === 'play' || d.phase === 'intro' || d.phase === 'countdown';
    seen();
  });
  bot.on('tc:seat', (d) => { if (d.board && d.board.id === b) E.boards[b] = d.board.seats.length; });
  bot.on('tc:play', () => { active = true; playing = true; seen(); lastQAt = Date.now(); });
  bot.on('tc:round', (d) => {
    phase = d.phase; winUntil = Date.now() + (d.ms || 0);
    seen();
    if (d.phase === 'qw') { role = 'none'; lastQAt = Date.now(); if (ctx.name === 'Bot01') E.rounds++; }
    if (d.phase === 'pw' && ctx.name === 'Bot01') E.playWindows++;
    if (d.phase === 'pwout') { role = 'none'; }
  });
  bot.on('tc:q', (q) => {
    if ('correctIdx' in q || 'correct' in q) fail('tc:q carries the right answer', q);
    if (phase !== 'qw') fail('a question outside the question window', { phase });
    hasQ = true;
    lastQAt = Date.now();
    st.questions++;
    st.lastQAt = Date.now();
    st.waiting = false;
    bot.emit('player:tc-seen', { pin: ctx.pin, qid: q.qid });
    if (style === 'silent') return;
    const right = rightOf(ctx).get(String(q.text));
    const ri = right != null ? q.answers.indexOf(right) : -1;
    const idx = ri >= 0 && Math.random() < 0.8 ? ri : Math.floor(Math.random() * q.answers.length);
    timers.push(setTimeout(() => { if (phase !== 'qw' || ended) return; st.answers++; E.quiz++; bot.emit('player:tc-answer', { pin: ctx.pin, qid: q.qid, idx }); }, 1400 + Math.random() * 2000));
  });
  bot.on('tc:qx', () => { hasQ = false; });
  bot.on('tc:qr', (d) => {
    hasQ = false;
    lastQAt = Date.now();
    E.ruleChecks++;
    if (d.ok) { E.right++; st.correct++; if (d.charges > 4 || d.charges < 1) fail('a right answer = a charge (max 4)', d); charges = d.charges; }
    else { st.wrong++; if (d.late) E.late++; }
  });
  bot.on('tc:mine', (d) => { E.eaten++; charges = d.charges; if (d.k !== me) fail('tc:mine reached another kid', d); });
  bot.on('tc:eat', (d) => { if (!mine(d)) return; seen(); E.ruleChecks++; if ('k' in d) fail('El Péndulo names who missed', d); if (d.anger > 5) fail('anger above 5', d); });
  bot.on('tc:race', (d) => { if (!mine(d)) return; E.ruleChecks++; if ('charges' in d) fail('the Capitán race shows charges (a drop would tell who missed)', d); });
  bot.on('tc:nope', () => { hasQ = false; });
  bot.on('tc:roles', (d) => {
    if (!mine(d)) return;
    seen();
    E.ruleChecks++;
    if (d.captain != null && !(E.boards[b] >= 1)) fail('a Capitán without a crew', d);
    if ((d.mart || []).some((x) => !(x.charges > 0))) fail('a martillero without charges', d);
    const m = (d.mart || []).find((x) => x.k === me);
    role = d.captain === me ? 'cap' : m ? 'mart' : 'watch';
    if (role === 'cap' && ctx.name) E.captains++;
    if (m) { charges = m.charges; claw = 'armed'; } else claw = 'idle';
    if (style === 'silent' && m) fail('a never-answer kid got charges', d);
    crabX = d.crab;
  });
  bot.on('tc:crab', (d) => { if (mine(d)) { seen(); crabX = d.x; if (ctx.name === 'Bot01') E.crabMoves++; } });
  bot.on('tc:steer', (d) => { if (mine(d)) { seen(); if (d.k === me) fail('my own steer came back to me', d); } });
  bot.on('tc:fen', (d) => { if (!mine(d)) return; seen(); setFen(d); if (ctx.name === 'Bot01') E.fenMoves++; });
  bot.on('tc:claw', (d) => { if (!mine(d)) return; seen(); if (d.k === me) { claw = d.st; charges = d.charges; } });
  bot.on('tc:aim', (d) => { if (mine(d)) { E.aimRelays++; if (d.k === me) fail('my own aim came back to me', d); } });
  bot.on('tc:slam', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k === me) { E.slams++; E.slamsByStyle[style] = (E.slamsByStyle[style] || 0) + 1; charges = d.charges; claw = 'fall'; if (style === 'silent') fail('a never-answer kid slammed', d); }
  });
  bot.on('tc:impact', (d) => { if (mine(d)) { seen(); if (d.k === me) { E.impacts++; myAir = 0; } } });
  bot.on('tc:bonk', (d) => {
    if (!mine(d)) return;
    seen();
    E.ruleChecks++;
    if (!(d.pts === 2 || d.pts === 4)) fail('a bonk returns 2 words (4 in the final round)', d);
    const add = d.pts + (d.assists || []).length + (d.cap != null ? 1 : 0);
    if (d.words < 0 || d.words !== words + add) fail('the crew\'s words after a bonk', { d, words });
    words = d.words;
    if (d.k === me) { E.bonks++; E.hits++; myAir = 0; E.hitsByStyle[style] = (E.hitsByStyle[style] || 0) + 1; }
    if ((d.assists || []).includes(me)) E.assists++;
  });
  bot.on('tc:taunt', (d) => { if (mine(d)) seen(); });
  bot.on('tc:calm', (d) => { if (mine(d)) seen(); });
  bot.on('tc:frenzy', (d) => { if (!d.off && ctx.name === 'Bot01') E.frenzy++; });
  bot.on('tc:final', (d) => { active = false; clear(); if (ctx.name === 'Bot01') E.finals++; if (!d.boards || !d.boards.every((x) => typeof x.caught === 'boolean')) fail('«¡FINAL!» says caught / escaped per crew', d); });
  bot.on('game-end', (d) => {
    ended = true; active = false; clear();
    const tc = d && d.teamcrab;
    E.endChecks++;
    if (!tc || !tc.board || !d.me) { fail('end payload', d); return; }
    (E.byStyle[style] = E.byStyle[style] || []).push(d.me.words);
    const rows = tc.board.rows || [];
    const row = rows.find((r) => r.k === me);
    if (!row) fail('end payload: my row in my crew', tc.board);
    if (d.me.words !== (row && row.words)) fail('end payload: my card = my row', { me: d.me, row });
    if (!(d.me.rank >= 1 && d.me.of === rows.length && d.me.classOf >= rows.length)) fail('end payload me', d.me);
    if (tc.board.words >= tc.board.target && !tc.board.caught) fail('words reached the target = caught', tc.board);
    if (rows[0] === row) { if (tc.board.caught) E.caught++; else E.escaped++; }
    if (ctx.name === 'Bot01') E.ends++;
  });
  bot.on('tc:react', () => {});
  bot.on('tc:noslam', () => { myAir = 0; });
  // the play window: steer (Capitán) and slam (martillero), like a kid's finger
  const play = setInterval(() => {
    if (ended) { clearInterval(play); return; }
    if (!active || phase !== 'pw' || style === 'silent') return;
    const now = Date.now();
    if (role === 'cap' && now >= steerAt) {
      const goal = style === 'skill' ? (f.mode === 'crouch' || f.mode === 'run' ? f.x1 : f.x) : Math.random() * 4;
      steerAt = now + (style === 'skill' ? 250 : 900 + Math.random() * 600);
      E.steers++;
      bot.emit('player:tc-steer', { pin: ctx.pin, x: goal });
    }
    if (charges <= 0 || claw !== 'armed' || myAir || now < slamAt) return;
    if (style === 'skill') {
      const react = 260 + Math.random() * 200;
      const px = predict(now + react + FALL);
      if (px == null || f.mode === 'crouch' || Math.abs(px - crabX) > REACH + 0.2) return;
      slamAt = now + react + 500;
      myAir = now;
      timers.push(setTimeout(() => { if (!ended && phase === 'pw') bot.emit('player:tc-slam', { pin: ctx.pin, x: clamp(px + (Math.random() - 0.5) * 0.5, 0, 4) }); }, react));
    } else {
      slamAt = now + 400 + Math.random() * 1100;
      myAir = now;
      bot.emit('player:tc-slam', { pin: ctx.pin, x: Math.random() * 4 });
    }
  }, 60);
  const watch = setInterval(() => {
    if (ended) { clearInterval(watch); return; }
    const now = Date.now();
    if (myAir && now - myAir > 2000) myAir = 0;
    if (active) E.maxBoardGapS = Math.max(E.maxBoardGapS, Math.round((now - lastBoardEv) / 100) / 10);
    const noQuiz = playing && active && phase === 'qw' && !hasQ && winUntil - now > 3000 && now - lastQAt > 7000 && style !== 'silent';
    if (active && !flagged && (now - lastBoardEv > 15000 || noQuiz)) {
      flagged = true;
      ctx.report.stalls.push({ name: ctx.name, secondsWithoutBoardEvent: Math.round((now - lastBoardEv) / 1000), noQuiz, phase, style, lastEvent: st.lastEvent });
    }
    if (active && Math.random() < 0.02) bot.emit('player:tc-react', { pin: ctx.pin, e: ['wow', 'lol', 'clap', 'fire'][Math.floor(Math.random() * 4)] });
  }, 1000);
};
