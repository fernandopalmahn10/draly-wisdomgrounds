// Playtest handler for Ojo de Halcón: there are no «question» events (the board runs the rounds), so this handler plays
// the rounds like a kid: on lk:round it picks a lamp (it doesn't know the right one), waits for that lamp to light and
// taps it with a human delay (0.3–1.8 s); sometimes it taps a dark lamp early (the «nothing there» path), sometimes it
// is distracted and never looks. Rounds count as the harness's "questions"; a bot without a new round for 25 s while
// the game runs is reported as frozen. Stats land in report.look (printed with the report).
'use strict';

module.exports = (bot, ctx) => {
  const st = ctx.state;
  st.onDemand = true;                          // the harness's generic freeze check needs questions; ours is below
  const E = ctx.report.look || (ctx.report.look = {
    inits: 0, rounds: 0, results: 0, looks: 0, ok: 0, wrong: 0, blank: 0, closed: 0, firsts: 0, pts: 0, finals: 0, ends: 0, pauses: 0,
    winner: null, roundsPlayed: null, maxRoundGapS: 0, botsWithPanel: 0,
  });
  const lead = ctx.name === 'Bot01';          // one bot counts the shared events
  let idx = 0, timers = [], lastRoundAt = Date.now(), active = false, ended = false, flagged = false;
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  bot.on('lk:init', (d) => {
    E.inits++;
    if (d.me) { if (!idx) E.botsWithPanel++; idx = d.me.idx; }
    active = true;
  });
  bot.on('lk:round', (d) => {
    active = true;
    const t = Date.now();
    if (lead) { E.rounds++; E.maxRoundGapS = Math.max(E.maxRoundGapS, Math.round((t - lastRoundAt) / 100) / 10); }
    lastRoundAt = t;
    st.questions++;
    st.lastQAt = t;
    clear();
    const cands = (d.at || []).map((ms, pos) => [ms, pos]).filter(([ms]) => ms != null);
    if (!cands.length) return;
    const roll = Math.random();
    if (roll < 0.08) return;                   // distracted: never looks
    // a kid who taps too early (a dark lamp) now and then
    if (roll < 0.2) timers.push(setTimeout(() => bot.emit('player:lk-look', { pin: ctx.pin, pos: cands[0][1] }), Math.max(0, (d.showMs || 0) - 150)));
    const [ms, pos] = cands[Math.floor(Math.random() * cands.length)];
    timers.push(setTimeout(() => { E.looks++; bot.emit('player:lk-look', { pin: ctx.pin, pos }); }, Math.max(0, ms) + 300 + Math.random() * 1500));
  });
  bot.on('lk:looked', (r) => {
    if (r.status === 'ok') { E.ok++; st.answers++; st.correct++; }
    else if (r.status === 'wrong') { E.wrong++; st.answers++; st.wrong++; }
    else if (r.status === 'blank') E.blank++;
    else E.closed++;
  });
  bot.on('lk:result', (res) => {
    if (lead) E.results++;
    const me = (res.rows || []).find((r) => r.idx === idx);
    if (me) { E.pts += me.pts; if (me.rank === 1) E.firsts++; }
  });
  bot.on('lk:pause', (d) => { if (lead && d.paused) E.pauses++; });
  bot.on('lk:final', () => { if (lead) E.finals++; active = false; });
  bot.on('game-end', (d) => {
    ended = true; active = false; clear();
    if (lead) { E.ends++; E.winner = d && d.look && d.look.winner ? d.look.winner.name : null; E.roundsPlayed = d && d.look ? d.look.rounds : null; }
  });
  const watch = setInterval(() => {
    if (ended) { clearInterval(watch); return; }
    if (active && !flagged && Date.now() - lastRoundAt > 25000) {
      flagged = true;
      ctx.report.stalls.push({ name: ctx.name, secondsWithoutQuestion: Math.round((Date.now() - lastRoundAt) / 1000), lastEvent: st.lastEvent, answers: st.answers });
    }
  }, 1000);
};
