// Playtest handler for «¡Atrapa a Fénec!»: every bot plays like a kid of a crew. It answers its question (tc:q) after a
// human delay (1.2-3 s; it read the class pack: right 80 % of the time); 1 bot in 6 is «silent» and never answers (its
// questions run out: late = a jam + a snatch, so it must end below the careful ones: E.byStyle in the report). A right
// answer loads its hammer: it aims at Fénec (player:tc-aim, where it last saw him; «team» bots aim at his free side when a
// crewmate already covers him) and slams after 0.4-1.4 s (player:tc-slam). It reacts now and then.
// Frozen = the bot's crew shows no event for 15 s while the game runs; a bot whose hammer is up (idle, not jammed) gets
// no question within 6 s; or its hammer stays loaded 9 s+ (it must slam by itself at 6 s / 9 s).
// Rules checked on every event a bot sees: a question never carries its answer; a snatch never names who; a right
// answer = my hammer loaded; a wrong / late one = a jam (to me only); a bonk = +2 or +4 words for its bonker; the crew's
// words never go below 0; the end payload has the bot's crew, its card and caught / escaped.
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

module.exports = (bot, ctx) => {
  const st = ctx.state;
  st.onDemand = true;
  ctx.report.endedGrace = 4500;
  const E = ctx.report.teamcrab || (ctx.report.teamcrab = {
    inits: 0, seated: 0, boards: {}, quiz: 0, right: 0, late: 0, jams: 0, loads: 0, slams: 0, autoSlams: 0, impacts: 0, bonks: 0,
    assists: 0, snatches: 0, swings: 0, feeds: 0, hops: 0, aimRelays: 0, frenzy: 0, finals: 0, ends: 0, endChecks: 0, ruleChecks: 0,
    caught: 0, escaped: 0, maxBoardGapS: 0, byStyle: {},
  });
  const fail = (what, d) => ctx.report.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  let me = null, b = null, fx = 2, ham = 'idle', loadedAt = 0, active = false, ended = false, flagged = false, playing = false;
  let lastBoardEv = Date.now(), lastAnswerAt = Date.now(), hasQ = false, timers = [], crewAim = {}, words = 0;
  const botN = parseInt(String(ctx.name).replace(/\D/g, ''), 10) || 0;
  const style = botN % 6 === 3 ? 'silent' : Math.random() < 0.4 ? 'team' : 'careful';
  const clear = () => { timers.forEach(clearTimeout); timers = []; };
  const mine = (d) => d && d.b === b;
  const seen = () => { lastBoardEv = Date.now(); };
  bot.on('tc:init', (d) => {
    E.inits++;
    if (d.you && me == null) { me = d.you.k; E.seated++; }
    if (d.board) { b = d.board.id; E.boards[b] = d.board.seats.length; fx = d.board.fx; words = d.board.words; }
    if (d.you) ham = d.you.st;
    active = d.phase === 'play' || d.phase === 'intro' || d.phase === 'countdown';
    seen();
  });
  bot.on('tc:seat', (d) => { if (d.board && d.board.id === b) E.boards[b] = d.board.seats.length; });
  bot.on('tc:play', () => { active = true; playing = true; seen(); lastAnswerAt = Date.now(); });
  bot.on('tc:q', (q) => {
    if ('correctIdx' in q || 'correct' in q) fail('tc:q carries the right answer', q);
    if (ham === 'loaded' || ham === 'fall') fail('a question while my hammer is loaded', { ham });
    hasQ = true;
    st.questions++;
    st.lastQAt = Date.now();
    st.waiting = false;
    bot.emit('player:tc-seen', { pin: ctx.pin, qid: q.qid });
    if (style === 'silent') return;
    const right = rightOf(ctx).get(String(q.text));
    const ri = right != null ? q.answers.indexOf(right) : -1;
    const idx = ri >= 0 && Math.random() < 0.8 ? ri : Math.floor(Math.random() * q.answers.length);
    timers.push(setTimeout(() => { st.answers++; E.quiz++; bot.emit('player:tc-answer', { pin: ctx.pin, qid: q.qid, idx }); }, 1200 + Math.random() * 1800));
  });
  bot.on('tc:qr', (d) => {
    hasQ = false;
    lastAnswerAt = Date.now();
    E.ruleChecks++;
    if (d.ok) { E.right++; st.correct++; if (!(d.loadMs >= 6000)) fail('a right answer loads my hammer', d); }
    else { st.wrong++; if (d.late) E.late++; E.jams++; ham = 'jam'; if (d.jamMs !== 3000) fail('a miss jams my hammer 3 s', d); }
  });
  bot.on('tc:nope', () => { hasQ = false; lastAnswerAt = Date.now(); });
  // the hammers: mine loaded → aim at Fénec (or his free side) and slam
  bot.on('tc:ham', (d) => {
    if (!mine(d)) return;
    seen();
    if (d.k !== me) { crewAim[d.k] = d.st === 'loaded' ? d.spot : null; return; }
    ham = d.st;
    if (d.st === 'idle') lastAnswerAt = Date.now();
    if (d.st !== 'loaded') return;
    E.loads++;
    loadedAt = Date.now();
    const covered = Object.values(crewAim).some((s) => s === fx);
    let target = fx;
    if (style === 'team' && covered) target = fx === 0 ? 1 : fx === 4 ? 3 : (Math.random() < 0.5 ? fx - 1 : fx + 1);
    bot.emit('player:tc-aim', { pin: ctx.pin, x: target / 4 });
    timers.push(setTimeout(() => {
      if (ham !== 'loaded' || ended) return;
      const spot = style === 'team' && covered ? target : fx;
      bot.emit('player:tc-slam', { pin: ctx.pin, x: spot / 4 });
    }, 400 + Math.random() * 1000));
  });
  bot.on('tc:aim', (d) => { if (mine(d)) { E.aimRelays++; crewAim[d.k] = d.spot; if (d.k === me) fail('my own aim came back to me', d); } });
  bot.on('tc:slam', (d) => { if (!mine(d)) return; seen(); crewAim[d.k] = null; if (d.k === me) { ham = 'fall'; E.slams++; if (d.auto) E.autoSlams++; if (Date.now() - loadedAt > 13000) fail('a loaded hammer waited past its time', d); } });
  bot.on('tc:impact', (d) => { if (mine(d)) { seen(); if (d.k === me) E.impacts++; } });
  bot.on('tc:bonk', (d) => {
    if (!mine(d)) return;
    seen();
    E.ruleChecks++;
    if (!(d.pts === 1 || d.pts === 2 || d.pts === 4)) fail('a bonk returns 2 words (4 in the last 30 s; 1 / 2 for a hammer that slammed by itself)', d);
    if (d.words < 0 || d.words !== words + d.pts + (d.assists || []).length) fail('the crew\'s words after a bonk', { d, words });
    words = d.words;
    if (d.k === me) E.bonks++;
    if ((d.assists || []).includes(me)) E.assists++;
  });
  bot.on('tc:snatch', (d) => {
    if (!mine(d)) return;
    seen();
    E.ruleChecks++;
    if ('k' in d) fail('a snatch names who failed', d);
    if (d.words < 0) fail('the crew\'s words below 0', d);
    words = d.words;
    if (ctx.name === 'Bot01') E.snatches++;
  });
  bot.on('tc:feed', (d) => { if (mine(d)) { seen(); if (d.anger > 5) fail('anger above 5', d); } });
  bot.on('tc:swing', (d) => { if (mine(d)) { seen(); if (b && !E['sw' + b]) { E['sw' + b] = 1; E.swings++; } else E.swings++; } });
  bot.on('tc:hop', (d) => { if (mine(d)) { seen(); fx = d.to; if (ctx.name === 'Bot01') E.hops++; } });
  bot.on('tc:up', (d) => { if (mine(d)) { seen(); fx = d.to; } });
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
    if (rows[0] === row && ctx.name) { if (tc.board.caught) E.caught++; else E.escaped++; }
    if (ctx.name === 'Bot01') E.ends++;
  });
  bot.on('tc:react', () => {});
  // a slam refused while Fénec lies flat (a bonk) or the hammers are knocked: try again in a moment, like a kid
  bot.on('tc:noslam', (d) => { if (d && (d.why === 'wait' || d.why === 'knock') && ham === 'loaded') timers.push(setTimeout(() => { if (ham === 'loaded' && !ended) bot.emit('player:tc-slam', { pin: ctx.pin, x: fx / 4 }); }, 700)); });
  const watch = setInterval(() => {
    if (ended) { clearInterval(watch); return; }
    const now = Date.now();
    if (active) E.maxBoardGapS = Math.max(E.maxBoardGapS, Math.round((now - lastBoardEv) / 100) / 10);
    const noQuiz = playing && active && ham === 'idle' && !hasQ && now - lastAnswerAt > 6000 && style !== 'silent';
    const stuckLoaded = playing && active && ham === 'loaded' && loadedAt && now - loadedAt > 14000;
    if (active && !flagged && (now - lastBoardEv > 15000 || noQuiz || stuckLoaded)) {
      flagged = true;
      ctx.report.stalls.push({ name: ctx.name, secondsWithoutBoardEvent: Math.round((now - lastBoardEv) / 1000), noQuiz, stuckLoaded, ham, style, lastEvent: st.lastEvent });
    }
    if (active && Math.random() < 0.02) bot.emit('player:tc-react', { pin: ctx.pin, e: ['wow', 'lol', 'clap', 'fire'][Math.floor(Math.random() * 4)] });
  }, 1000);
};
