// Playtest handler for La Gran Fuga de Dubái: the base bot answers every question (each right answer is a turbo for
// the crew); this handler plays the «zona segura» like a kid: builds the room from the seed and the round's route
// (public/js/escape-map.js),
// walks (8 Hz, the phone's own collision code) to the nearest green zone that still has room, switches zone when the
// one it picked fills up (capacity zones: the class must split), and sometimes dawdles so the crew loses hearts.
// Stats land in report.escape (printed with the report).
'use strict';
const EscapeMap = require('../../public/js/escape-map');

module.exports = (bot, ctx) => {
  require('./party-check')(bot, ctx, 'escape');      // the Mario Party ending: «¡FINAL!», the show, my card (2026-10-16)
  const st = ctx.state;
  const E = ctx.report.escape || (ctx.report.escape = {
    inits: 0, phases: {}, turbos: 0, supers: 0, zaps: 0, waves: 0, safe: 0, out: 0, heartsLost: 0, hearts: null,
    switchedFull: 0, dawdled: 0, corrections: 0, reachedZone: 0, moments: {}, endRank: null, levelsCleared: null, maxCrew: 0,
    // the chase pass: each bot's own Robotín (zaps on it, his lunges and trips, «¡Está detrás de ti!», its sync messages)
    pzaps: 0, lunges: 0, trips: 0, nears: 0, gSyncs: 0, minGap: null,
  });
  const T = EscapeMap.TILE;
  let phase = 'run', room = null, zones = [], me = null, idx = 0, dizzyUntil = 0, paused = false;
  let target = null, path = null, dawdle = false, occ = [], timer = null, f = 2, level = 1, seed = 0, lastSend = 0, route = 0;
  const now = () => Date.now();
  // questions only come while the crew runs: the zona segura and the big moments are a legitimate wait
  const grace = setInterval(() => { if (phase !== 'run') st.graceUntil = now() + 1500; }, 250);

  function setPhase(d) {
    if (d.phase && d.phase !== phase) E.phases[d.phase] = (E.phases[d.phase] || 0) + 1;
    phase = d.phase || phase;
    level = d.level || level;
    if (typeof d.route === 'number') route = d.route;
    if (typeof d.hearts === 'number') E.hearts = d.hearts;
    if (phase === 'zone') {
      room = EscapeMap.buildRoom(seed, level, route);       // v2: the route's room (Dubái, China)
      const mine = (d.pos || []).find((a) => a[0] === idx);
      if (mine) me = { x: mine[1], y: mine[2] };
      zones = d.zones || [];
      target = null; path = null;
      clearInterval(timer);
      timer = setInterval(loop, 125);
    } else { clearInterval(timer); timer = null; room = null; zones = []; }
    if (phase !== 'run') st.graceUntil = now() + 1500;
  }
  bot.on('es:init', (d) => {
    E.inits++;
    seed = d.seed;
    if (d.me) { idx = d.me.idx; if (typeof d.me.x === 'number') me = { x: d.me.x, y: d.me.y }; }
    setPhase(d);
  });
  bot.on('es:phase', setPhase);
  bot.on('es:pause', (d) => { paused = !!d.paused; });
  bot.on('es:zap', () => { if (idx === 1) E.zaps++; });
  // the chase pass: a stunned bot is like a kid whose tiles are locked: its question waits (a legitimate pause); a tap
  // that lands during the stun comes back «stunned» and the kid taps again once the lock is gone
  let lastQ = null;
  bot.on('question', (q) => { lastQ = q; });
  bot.on('es:pzap', (d) => { E.pzaps++; st.graceUntil = now() + ((d && d.stunMs) || 1800) + 500; });
  bot.on('answer-stale', (d) => {
    if (!d || d.reason !== 'stunned' || !lastQ) return;
    E.stunnedTaps = (E.stunnedTaps || 0) + 1;
    const q = lastQ;
    st.graceUntil = now() + (d.ms || 1800) + 1500;
    setTimeout(() => { if (lastQ === q) bot.emit('player:answer', { pin: ctx.pin, qid: q.qid, choiceIdx: Math.floor(Math.random() * ((q.answers && q.answers.length) || 2)) }, () => {}); }, (d.ms || 1800) + 300);
  });
  bot.on('es:lunge', () => { E.lunges++; });
  bot.on('es:trip', () => { E.trips++; });
  bot.on('es:near', () => { E.nears++; });
  // es:g goes out only when something changed, ~3 a second at most: a ceiling of 4 per bot-second of running (more =
  // the server is flooding phones; a report error makes the run CHECK)
  let gN = 0, gFirst = 0, gLast = 0;
  bot.on('es:g', (c) => {
    E.gSyncs++; gN++; const t = now(); if (!gFirst) gFirst = t; gLast = t;
    if (c && typeof c.g === 'number') E.minGap = E.minGap == null ? c.g : Math.min(E.minGap, c.g);
  });
  bot.on('game-end', () => {
    const secs = (gLast - gFirst) / 1000;
    if (secs < 5) return;
    const rate = gN / secs;
    E.gMaxPerSec = Math.max(E.gMaxPerSec || 0, Math.round(rate * 100) / 100);
    if (rate > 4) ctx.report.errors.push({ who: ctx.name, ev: 'es:g-flood', d: Math.round(rate * 10) / 10 + ' a second' });
  });
  bot.on('es:tick', (d) => {
    if (typeof d.c === 'number') E.maxCrew = Math.max(E.maxCrew, d.c + (level - 1) * 100);
    if (d.occ) occ = d.occ;
  });
  bot.on('es:moment', (m) => { if (idx === 1) E.moments[m.type] = (E.moments[m.type] || 0) + 1; });
  bot.on('es:me', (m) => {
    if (m.pos) { E.corrections++; me = { x: m.pos[0], y: m.pos[1] }; path = null; }
    if (typeof m.dizzyMs === 'number') dizzyUntil = now() + m.dizzyMs;
  });
  bot.on('es:wave', (w) => {
    zones = w.zones || [];
    target = null; path = null; occ = [];
    dawdle = Math.random() < 0.12;               // like a kid looking somewhere else
    if (dawdle) E.dawdled++;
    if (idx === 1) E.waves++;
  });
  bot.on('es:wave-end', (r) => {
    if (r.safe.includes(idx)) E.safe++;
    if (r.out.includes(idx)) E.out++;
    if (idx === 1) { E.heartsLost += r.lost; E.hearts = r.hearts; }
    target = null; path = null;
  });
  bot.on('answer-result', (r) => { if (r && r.escape && r.escape.turbo) { E.turbos++; if (r.escape.super) E.supers++; } });
  bot.on('game-end', (d) => {
    clearInterval(timer); clearInterval(grace);
    if (d && d.escape && idx === 1) { E.endRank = d.escape.rank && d.escape.rank.name; E.levelsCleared = d.escape.levelsCleared; E.hearts = d.escape.hearts; }
  });

  // the zone to walk to: the nearest one that still has room (its protected list isn't full without me)
  function pickZone() {
    let best = null, bd = 1e9;
    zones.forEach((z) => {
      const o = occ.find((a) => a[0] === z.id);
      const count = o ? o[1] : 0, safeIdx = o ? o[2] : [];
      if (z.cap && count >= z.cap && !safeIdx.includes(idx)) return;      // full
      const cx = (z.x + z.w / 2) * T, cy = (z.y + z.h / 2) * T;
      const d = Math.hypot(cx - me.x, cy - me.y) + Math.random() * 60;
      if (d < bd) { bd = d; best = z; }
    });
    return best || zones[Math.floor(Math.random() * zones.length)] || null;
  }
  function loop() {
    if (!room || !me || phase !== 'zone') return;
    const t = now();
    if (!paused && t >= dizzyUntil && zones.length && !dawdle) {
      // the zone I'm heading to filled up before I got in: pick another one
      if (target && target.cap) {
        const o = occ.find((a) => a[0] === target.id);
        if (o && o[1] >= target.cap && !o[2].includes(idx)) { E.switchedFull++; target = null; path = null; }
      }
      if (!target) {
        target = pickZone();
        if (target) {
          const tx = target.x + 1 + Math.floor(Math.random() * Math.max(1, target.w - 2)), ty = target.y + 1 + Math.floor(Math.random() * Math.max(1, target.h - 2));
          path = EscapeMap.pathTo(room, me.x, me.y, tx, ty, 1, 1);
          if (path) path.push([(tx + 0.5) * T, (ty + 0.5) * T + 6]);
        }
      }
      if (path && path.length) {
        const [px, py] = path[0];
        const dx = px - me.x, dy = py - me.y, d = Math.hypot(dx, dy);
        if (d < 5) { path.shift(); if (!path.length) E.reachedZone++; }
        else {
          const len = Math.min(d, 140 * 0.125);
          for (let i = 0; i < 8; i++) EscapeMap.moveBody(room, me, (dx / d) * len / 8, (dy / d) * len / 8);
          const dir = EscapeMap.dirOf(dx, dy);
          if (dir >= 0) f = dir;
        }
      }
    }
    if (t - lastSend >= 120) { lastSend = t; bot.emit('player:es-pos', { pin: ctx.pin, x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, f }); }
  }
};
