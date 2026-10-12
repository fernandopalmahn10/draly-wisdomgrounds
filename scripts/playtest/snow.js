// Playtest handler for Batalla de Nieve en Ski Dubái: each bot builds the map from the seed (public/js/snow-map.js),
// walks (8 Hz, the phone's own collision code) to a station, asks for a question (the base bot answers it), throws
// snowballs at the nearest kid of the other side, dives for pearls / harvests dates, races to the ❄️ chest, and gets
// frozen / stunned like a kid. Stats land in report.snow (printed with the report).
'use strict';
const SnowMap = require('../../public/js/snow-map');

module.exports = (bot, ctx) => {
  const st = ctx.state;
  st.onDemand = true;                              // questions only when the bot asks at a station
  const S = ctx.report.snow || (ctx.report.snow = {
    inits: 0, asks: 0, throws: 0, jobs: 0, chestGrabs: 0, hits: {}, refused: {}, spells: 0, corrections: 0, moments: {},
    chestsSeen: 0, frozenBots: 0, stunnedBots: 0, maxCopos: 0, endWinner: null, pauses: 0,
  });
  const T = SnowMap.TILE;
  let map = null, me = null, idx = 0, side = 'sun', copos = 0;
  let stunUntil = 0, respawnUntil = 0, paused = false, spellCast = false;
  let others = {};                                 // idx → { x, y, ice, respawning }
  let chest = null;
  let path = null, goal = null;
  let asking = false, inQuestion = false, lastThrow = 0, lastJob = 0, timer = null, f = 2;
  const now = () => Date.now();

  bot.on('sn:init', (d) => {
    S.inits++;
    map = SnowMap.buildMap(d.seed);
    spellCast = d.spellCast;
    paused = d.paused;
    chest = d.chest;
    if (d.me) { idx = d.me.idx; me = { x: d.me.x, y: d.me.y }; applyMe(d.me); }
    asking = false; inQuestion = false; path = null; goal = null;
    clearInterval(timer);
    timer = setInterval(loop, 125);
  });
  function applyMe(m) {
    if (typeof m.copos === 'number') { copos = m.copos; S.maxCopos = Math.max(S.maxCopos, copos); }
    if (m.side && m.side !== side) { if (m.side === 'ice') S.frozenBots++; side = m.side; path = null; goal = null; }
    if (typeof m.stunMs === 'number') stunUntil = now() + m.stunMs;
    if (typeof m.respawnMs === 'number') respawnUntil = now() + m.respawnMs;
    if (typeof m.paused === 'boolean') paused = m.paused;
    if (m.hit === 'stun') S.stunnedBots++;
    if (m.pos) {
      if (!m.hit && !m.frozenBy) S.corrections++;
      me = { x: m.pos[0], y: m.pos[1] };
      path = null; goal = null;
    }
  }
  bot.on('sn:me', applyMe);
  bot.on('sn:tick', (arr) => {
    const seen = {};
    arr.forEach(([i, x, y, , fl]) => { if (i === idx) return; seen[i] = 1; others[i] = { x, y, ice: !!(fl & 1), respawning: !!(fl & 8) }; });
    Object.keys(others).forEach((i) => { if (!seen[i]) delete others[i]; });
  });
  bot.on('sn:spell', () => { spellCast = true; S.spells++; });
  bot.on('sn:hit', (h) => { S.hits[h.type] = (S.hits[h.type] || 0) + 1; });
  bot.on('sn:moment', (m) => { S.moments[m.type] = (S.moments[m.type] || 0) + 1; });
  bot.on('sn:pause', (d) => { paused = d.paused; });
  bot.on('sn:chest', (c) => {
    if (c.id) { chest = c; if (idx === 1) S.chestsSeen++; } else { chest = null; if (goal && goal.kind === 'chest') { path = null; goal = null; } }
  });
  bot.on('sn:refused', (r) => {
    const k = r.what + ':' + r.why;
    S.refused[k] = (S.refused[k] || 0) + 1;
    if (r.what === 'station') { asking = false; st.askedAt = 0; path = null; goal = null; }
  });
  bot.on('question', () => { inQuestion = true; asking = false; });
  bot.on('answer-result', (r) => {
    inQuestion = false;
    st.waiting = false;                            // on-demand questions: the walk to the next station isn't a freeze
    if (r && r.snow) copos = r.snow.copos;
    // keep answering at this station sometimes (like a kid on a roll), else go do something else
    if (Math.random() < 0.45 && goal && goal.kind === 'station') {
      const sid = goal.id;
      setTimeout(() => { if (goal && goal.kind === 'station' && goal.id === sid && side !== null) ask(sid); }, 300 + Math.random() * 600);
    } else { path = null; goal = null; }
  });
  bot.on('game-end', (d) => { clearInterval(timer); if (d && d.snow) S.endWinner = d.snow.winner; });

  function ask(stationId) {
    if (inQuestion || asking) return;
    asking = true;
    st.askedAt = now();
    S.asks++;
    bot.emit('player:sn-ask', { pin: ctx.pin, station: stationId });
  }
  function nearestEnemy(range) {
    let best = null, bd = range;
    Object.values(others).forEach((o) => {
      if (o.respawning || o.ice === (side === 'ice')) return;
      const d = Math.hypot(o.x - me.x, o.y - me.y);
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }
  // a survivor with an ice kid close by and nothing to throw runs to the far side of the map (like a kid would)
  function maybeFlee() {
    if (side !== 'sun' || (goal && goal.kind === 'flee')) return false;
    const e = nearestEnemy(4.5 * T);
    if (!e || (copos > 0 && Math.random() < 0.5)) return false;
    const far = map.spawns.sun.filter(([x, y]) => Math.hypot((x + 0.5) * T - e.x, (y + 0.5) * T - e.y) > 14 * T);
    const [fx, fy] = far[Math.floor(Math.random() * far.length)] || map.spawns.sun[0];
    goal = { kind: 'flee', until: now() + 4000 };
    path = SnowMap.pathTo(map, me.x, me.y, fx, fy, 1, 1);
    return true;
  }
  function pickGoal() {
    const r = Math.random();
    if (chest && r < 0.5) { goal = { kind: 'chest', id: chest.id }; path = SnowMap.pathTo(map, me.x, me.y, Math.floor(chest.x / T), Math.floor(chest.y / T), 1, 1); return; }
    if (side === 'ice' && copos > 0 && r < 0.75) {
      const e = nearestEnemy(30 * T);
      if (e) { goal = { kind: 'hunt', until: now() + 2500 }; path = SnowMap.pathTo(map, me.x, me.y, Math.floor(e.x / T), Math.floor(e.y / T), 1, 1); return; }
    }
    if (copos < 2 || r < 0.75) {
      const sts = map.stations.slice().sort((a, b) => Math.hypot(a.x * T - me.x, a.y * T - me.y) - Math.hypot(b.x * T - me.x, b.y * T - me.y));
      const s = sts[Math.random() < 0.7 ? 0 : 1];
      goal = { kind: 'station', id: s.id };
      path = SnowMap.pathTo(map, me.x, me.y, s.x, s.y, 2, 2);
      return;
    }
    const j = map.jobs[Math.floor(Math.random() * map.jobs.length)];
    goal = { kind: 'job', id: j.id };
    path = SnowMap.pathTo(map, me.x, me.y, Math.floor(j.x), Math.floor(j.y) + (j.kind === 'pearl' ? 1 : 0), 1, 1);
  }
  function walk(dt) {
    if (!path || !path.length) return true;
    const [tx, ty] = path[0];
    const dx = tx - me.x, dy = ty - me.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) { path.shift(); return !path.length; }
    const steps = 8;
    const len = Math.min(d, (side === 'ice' ? 138 : 150) * dt);   // never overshoot the waypoint (it would wobble around it)
    for (let i = 0; i < steps; i++) SnowMap.moveBody(map, me, (dx / d) * len / steps, (dy / d) * len / steps);
    const dir = SnowMap.dirOf(dx, dy);
    if (dir >= 0) f = dir;
    return false;
  }
  function loop() {
    if (!map || !me) return;
    const t = now();
    const busy = paused || t < stunUntil || t < respawnUntil || inQuestion || asking;
    if (!busy) {
      // throw at anyone of the other side in range
      const e = spellCast && copos > 0 && t - lastThrow > 900 ? nearestEnemy(6.5 * T) : null;
      if (e) { lastThrow = t; S.throws++; bot.emit('player:sn-throw', { pin: ctx.pin, dx: e.x - me.x, dy: e.y - me.y }); }
      if (!maybeFlee() && (!goal || ((goal.kind === 'hunt' || goal.kind === 'flee') && t > goal.until) || (goal.kind === 'chest' && (!chest || chest.id !== goal.id)))) pickGoal();
      if (goal && !path) { goal = null; }
      else if (goal && walk(0.125)) {
        if (goal.kind === 'station') ask(goal.id);
        else if (goal.kind === 'job') { if (t - lastJob > 10500) { lastJob = t; S.jobs++; bot.emit('player:sn-job', { pin: ctx.pin, job: goal.id }); } goal = null; path = null; }
        else if (goal.kind === 'chest') { if (chest) { S.chestGrabs++; bot.emit('player:sn-grab', { pin: ctx.pin, chest: chest.id }); } goal = null; path = null; }
        else { goal = null; path = null; }
      }
    }
    bot.emit('player:sn-pos', { pin: ctx.pin, x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, f });
  }
};
