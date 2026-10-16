// Playtest handler for Vuelo del Dragón v2: the harness answers every question with a random choice (so ~1 in 4 is
// right); this handler flies like a kid: after a right answer it swipes 4-7 wing beats a second for the whole flight
// (sent every 250 ms like the phone), Bot03 mashes 15 a second (the server must cap it), Bot04 never beats (an idle
// flight earns nothing and must still close). Checks on what comes back:
//   · dr:init seats every kid in a race of 1-5 with its colour; the run-in comes in the countdown
//   · every right answer opens a flight; every flight ends in exactly ONE dr:flown (same id) whose beats never pass the
//     cap (RATE a second of flight + the burst) and whose metres are ≥ 0; my metres never go down
//   · the race's live line (dr:race) is of my race only, in order (seq), and carries every kid of my race
//   · leads of my race only; the sprints: a start and an end with my race's winners from my race
//   · the end payload: my card = my race, total = metres flown + bonus stars × their metres, bonus stars only for kids of
//     my race, a winner flag that matches the race's winners
// The freeze clock is told how long each flight lasts (graceUntil), since a flight is a legitimate wait.
// Stats in report.dragon (per-kid event counts too: the live line ~2 a second, not a storm).
'use strict';

module.exports = (bot, ctx) => {
  const st = ctx.state;
  const R = ctx.report;
  R.endedGrace = 5000;                         // «¡FINAL!» (dr:final) ends the watch; game-end comes 2.4 s later
  const E = R.dragon || (R.dragon = {
    seats: 0, races: {}, flights: 0, flown: 0, beatsSent: 0, beatsCredited: 0, capped: 0, rings: 0, fire: 0, lines: 0, leads: 0,
    sprintsGo: 0, sprintsEnd: 0, sprintStars: 0, frenzy: 0, finals: 0, ends: 0, eventsPerKid: {}, linesPerKid: {}, maxMetres: 0,
    winners: 0, podium: null, idleFlown: 0,
  });
  const idle = ctx.name === 'Bot04';
  const masher = ctx.name === 'Bot03';
  const lead = ctx.name === 'Bot01';
  let me = null, myRace = null, raceKs = null, seq = 0, open = {}, timers = [], finalSeen = false, lastM = 0;
  E.eventsPerKid[ctx.name] = 0;
  E.linesPerKid[ctx.name] = 0;
  const fail = (what, d) => R.errors.push({ who: ctx.name, ev: 'rule:' + what, d });
  bot.onAny(() => { E.eventsPerKid[ctx.name]++; });

  bot.on('dr:init', (d) => {
    if (!d || !d.you || !d.race) return;
    if (!me) E.seats++;
    me = d.you;
    myRace = d.race.id;
    raceKs = new Set(d.race.seats.map((s) => s.k));
    E.races[myRace] = d.race.seats.length;
    if (!(d.race.seats.length >= 1 && d.race.seats.length <= 5)) fail('a race of 1-5', d.race.seats.length);
    if (!raceKs.has(me.k)) fail('my seat is in my race', d.race);
    if (!(me.c >= 0 && me.c <= 4)) fail('a seat colour 0-4', me.c);
  });
  bot.on('dr:seat', (d) => { if (d && d.race && d.race.id === myRace) d.race.seats.forEach((s) => raceKs.add(s.k)); });
  bot.on('dr:race', (d) => {
    E.lines++;
    E.linesPerKid[ctx.name]++;
    if (myRace != null && d.b !== myRace) fail('a line of another race', { mine: myRace, got: d.b });
    if (d.seq <= seq) fail('the race line in order', { last: seq, got: d.seq });
    seq = d.seq;
    (d.d || []).forEach((row) => {
      if (raceKs && !raceKs.has(row[0])) fail('a kid of another race in my line', row);
      if (!(row[1] >= 0)) fail('metres ≥ 0', row);
      if (me && row[0] === me.k) {
        if (row[1] + 1 < lastM) fail('my metres never go down', { was: lastM, now: row[1] });
        lastM = Math.max(lastM, row[1]);
        E.maxMetres = Math.max(E.maxMetres, row[1]);
      }
    });
  });
  bot.on('dr:lead', (l) => { if (l.b !== myRace) fail('a lead of another race', l); if (lead) E.leads++; });
  bot.on('dr:sprint', (d) => {
    if (d.go) { if (lead) E.sprintsGo++; return; }
    if (lead) E.sprintsEnd++;
    const mine = (d.races || []).find((x) => x.b === myRace);
    if (!mine) { fail('the sprint end has my race', d); return; }
    (mine.w || []).forEach((k) => { if (raceKs && !raceKs.has(k)) fail('a sprint star for a kid of another race', k); });
    if (lead) E.sprintStars += (mine.w || []).length;
  });
  bot.on('dr:frenzy', () => { if (lead) E.frenzy++; });
  bot.on('dr:final', () => { finalSeen = true; if (lead) E.finals++; });

  bot.on('answer-result', (r) => {
    const dr = r && r.dragon;
    if (!dr) { fail('answer-result without dragon info', r); return; }
    if (!r.correct) { if (!(dr.wait > 0)) fail('a wrong answer without a wait', r); st.graceUntil = Date.now() + dr.wait + 500; return; }
    if (!(dr.mid > 0 && dr.ms >= 4000 && dr.lead > 0 && [1, 1.5, 2].includes(dr.power))) { fail('a right answer must open a flight', dr); return; }
    if (dr.fire !== (dr.streak >= 3)) fail('«¡Fuego azul!» from a streak of 3', dr);
    E.flights++;
    if (dr.fire) E.fire++;
    const t0 = Date.now();
    const f = open[dr.mid] = { t0, sent: 0, rate: dr.rate, burst: dr.burst, ms: dr.ms };
    st.graceUntil = t0 + dr.lead + dr.ms + 600 + 2500;
    if (idle) return;
    const perSec = masher ? 15 : 4 + Math.random() * 3;
    let acc = 0;
    const start = t0 + dr.lead + 80;
    const tick = () => {
      if (finalSeen || !open[dr.mid]) return;
      const now = Date.now();
      if (now > start + dr.ms) return;
      acc += perSec * 0.25;
      const n = Math.floor(acc);
      acc -= n;
      if (n > 0) { bot.emit('player:dr-beats', { pin: ctx.pin, mid: dr.mid, n }); f.sent += n; E.beatsSent += n; }
      timers.push(setTimeout(tick, 250));
    };
    timers.push(setTimeout(tick, Math.max(0, start - t0)));
  });
  bot.on('dr:flown', (s) => {
    const f = open[s.mid];
    if (!f) { fail('a flight summary for a flight I never had', s); return; }
    delete open[s.mid];
    E.flown++;
    E.beatsCredited += s.beats;
    if (s.beats < f.sent) E.capped += f.sent - s.beats;
    const cap = Math.floor((f.rate * f.ms) / 1000) + f.burst;
    if (s.beats > cap) fail('a flight beat more than the cap', { beats: s.beats, cap });
    if (s.beats > f.sent) fail('more beats credited than sent', { beats: s.beats, sent: f.sent });
    if (idle && s.beats !== 0) fail('the idle kid got beats', s);
    if (idle) E.idleFlown++;
    if (!(s.metres >= 0)) fail('flight metres ≥ 0', s);
    if (s.ring) E.rings++;
    if (s.m + 1 < lastM) fail('my metres after a flight never go down', { was: lastM, now: s.m });
    lastM = Math.max(lastM, s.m);
    st.graceUntil = Date.now() + 1500;
  });

  bot.on('game-end', (d) => {
    timers.forEach(clearTimeout);
    if (Object.keys(open).length > 0) fail('flights that never got a summary', Object.keys(open));
    const dr = d && d.dragon;
    if (!dr || !d.me || !dr.race) { fail('end payload', d); return; }
    if (d.me.b !== myRace) fail('my card is of my race', d.me);
    const bm = dr.bonusM || 0;
    if (d.me.total !== d.me.flown + (d.me.bonus || []).length * bm) fail('total = metres + bonus stars × their metres', d.me);
    (dr.race.bonus || []).forEach((s) => s.winners.forEach((k) => { if (!dr.race.rows.some((x) => x.k === k)) fail('a bonus star for a kid of another race', s); }));
    if (!dr.race.rows.some((x) => x.k === d.me.k)) fail('I am in my race ranking', dr.race);
    if (d.me.won !== dr.race.winners.includes(d.me.k)) fail('won flag', d.me);
    if (d.me.flown + 1 < lastM) fail('my card has my metres', { card: d.me.flown, mine: lastM });
    if (lead) { E.ends++; E.podium = (dr.podium || []).map((x) => `${x.name}:${x.total}m★${x.stars}`); }
    if (d.me.won) E.winners++;
  });
};
