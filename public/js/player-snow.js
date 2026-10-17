// Batalla de Nieve en Ski Dubái — the kid's phone: walk your saga avatar around Dubai (joystick, left thumb), answer at
// the 4-colour stations for copos, throw snowballs (right thumb, auto-aim at the nearest kid of the other side), dive for
// pearls / harvest dates, race to the ❄️ chest. Movement runs here (≤ 1/60 s steps, the shared map's collisions);
// the server owns copos, ☀️ calor, hits and sides. Questions use the shared pastel skin (player-kingdoms-skin.js).
// player.js calls SnowPhone.init(...) once. Test hook: SnowPhone.advance(sec, keys), walkTo(tx, ty), throw(), use().
(function () {
  const M = window.SnowMap, R = window.SnowRender;
  const T = M ? M.TILE : 32;
  const SN = '/assets/snow/', K = '/assets/kingdoms/';
  // Dralingo in his platform look where he has the pose (art batch 2026-10-17; snow-* = his Ski Dubái poses), else the
  // older keffiyeh stickers
  const NEW_LOOK = { pointing: 'point', shocked: 'wow', champion: 'victory', jump: 'jump', thinking: 'wise', throw: 'snow-throw', frozen: 'snow-frozen', ski: 'snow-ski' };
  const POSE = (n) => (NEW_LOOK[n] ? '/assets/dralingo/' + NEW_LOOK[n] : K + 'dralingo/' + n) + '.webp';
  const SEND_MS = 125;              // position updates (8 Hz)
  const AIM = 7 * T;                // auto-aim reach
  const SPEED = { sun: 150, ice: 138 };

  let ctx = null;                   // { socket, getPin, showScreen, markActivity }
  let map = null, round = null, running = false, raf = 0, lastT = 0, lastSend = 0, lastSent = null;
  let roster = {}, others = {}, balls = [], fx = [], chest = null, counts = { sun: 0, ice: 0, total: 0 };
  let me = null;                    // { x, y, f }
  let my = { idx: 0, side: 'sun', copos: 3, calor: 3, streak: 0, score: 0, freezes: 0 };
  let until = { stun: 0, respawn: 0, shield: 0, spell: 0, job: 0, chestHint: 0, asking: 0, warn: 0 };
  let paused = false, spellCast = false;
  let input = { dir: -1, keys: { l: 0, r: 0, u: 0, d: 0 } };
  let near = { station: null, job: null };
  let canvas = null, g = null, dpr = 1, view = { s: 1, camX: 0, camY: 0 };
  let captains = null;
  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const skin = () => (window.KingdomsSkin || null);
  const sfx = (name, vol) => { const s = skin(); if (s && s.sfx) s.sfx(name.indexOf('/') === 0 ? name : SN + name + '.mp3', vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const onScreen = () => !!$('screen-snow') && !$('screen-snow').classList.contains('hidden');
  const helpOpen = () => { const c = $('sn-help'); return !!c && !c.classList.contains('hidden'); };
  const frozenOpen = () => { const c = $('sn-frozen'); return !!c && !c.classList.contains('hidden'); };
  const miniOpen = () => { const c = $('sn-mini'); return !!c && !c.classList.contains('hidden'); };

  function init(c) {
    ctx = c;
    if (!M || !R) return;
    const s = c.socket;
    s.on('sn:captains', (cp) => { captains = cp; });
    s.on('countdown', () => { round = null; stop(); });
    s.on('sn:init', (d) => {
      const same = !!(map && round === d.round && me);
      round = d.round;
      if (!same) {
        map = M.buildMap(d.seed);
        others = {}; balls = []; fx = [];
        R.preload();
        until = { stun: 0, respawn: 0, shield: 0, spell: 0, job: 0, chestHint: 0, asking: 0, warn: 0 };
      }
      roster = d.players || {};
      counts = d.counts || counts;
      chest = d.chest ? Object.assign({}, d.chest) : null;
      spellCast = !!d.spellCast;
      paused = !!d.paused;
      if (d.captains) captains = d.captains;
      until.spell = now() + (d.spellInMs || 0);
      if (d.me) {
        if (!same || !me) me = { x: d.me.x, y: d.me.y, f: 2 };
        applyMe(d.me, true);
      }
      applyPos(d.pos || []);
      start();
      showHelp();
      hud(true);
    });
    s.on('sn:tick', (arr) => applyPos(arr));
    s.on('sn:roster', (d) => { roster = d.players || roster; counts = d.counts || counts; hud(true); });
    s.on('sn:me', (m) => applyMe(m, false));
    s.on('sn:ball', (b) => {
      balls.push({ id: b.id, side: b.side, x0: b.x, y0: b.y, dx: b.dx, dy: b.dy, range: b.range, speed: b.speed, t0: performance.now(), x: b.x, y: b.y, mine: b.by === my.idx });
      if (b.by !== my.idx && me && Math.hypot(b.x - me.x, b.y - me.y) < 8 * T) sfx('throw', 0.25);
    });
    s.on('sn:hit', (h) => {
      balls = balls.filter((b) => b.id !== h.ball);
      if (!map) return;
      addFx(h.type === 'bonk' ? 'splash' : h.type, h.x, h.y);
      if (h.by === my.idx && h.target !== my.idx) {
        if (h.type === 'stun') { sfx('stun', 0.6); toast(`🧊 ¡Congelaste a ${h.targetName} 3 s!`, 'sun'); }
        else if (h.type === 'brrr') { sfx('hit', 0.6); toast(`❄️ ¡Le diste a ${h.targetName}!`, 'ice'); }
        else if (h.type === 'armor') { sfx('pop', 0.5); toast('🛡️ ¡Tiene escudo de hielo! Mejor corre 🏃', 'ice'); }
        else if (h.type === 'shield') sfx('pop', 0.4);
      }
      if (h.type === 'freeze') {
        if (roster[h.target]) roster[h.target].side = 'ice';
        counts = { sun: Math.max(0, counts.sun - 1), ice: counts.ice + 1, total: counts.total };
        hud(true);
      }
    });
    s.on('sn:spell', (d) => {
      spellCast = true;
      if (!(d.kids || []).length) { hud(true); return; }
      (d.kids || []).forEach((k) => { if (roster[k.idx]) roster[k.idx].side = 'ice'; });
      counts = d.counts || counts;
      const mine = (d.kids || []).some((k) => k.idx === my.idx);
      if (!mine) {
        const names = (d.kids || []).map((k) => k.name).join(' y ');
        toast(`❄️ ¡Hechizo de Hielo! ${names} ${d.kids.length === 1 ? 'es' : 'son'} del Equipo Hielo: ¡corre!`, 'ice', 3200);
        sfx(K + 'castle-alert.mp3', 0.6);
        buzz([60, 40, 60]);
      }
      hud(true);
    });
    s.on('sn:moment', (m) => {
      counts = m.counts || counts;
      if (m.type === 'half') toast('❄️ ¡La mitad de la clase ya es de hielo!', 'ice');
      if (m.type === 'last3' && my.side === 'sun') toast('☀️ ¡Último refugio! ☀️☀️☀️ y escudo 5 s', 'sun', 3200);
      if (m.type === 'last1' && m.kids && m.kids[0] && m.kids[0].idx !== my.idx) toast(`☀️ ¡Solo queda ${m.kids[0].name}!`, my.side === 'ice' ? 'ice' : 'sun');
      hud(true);
    });
    s.on('sn:chest', (c) => {
      if (c.id) {
        chest = Object.assign({}, c);
        until.chestHint = now() + 7000;
        sfx('spawn', 0.5);
        const zn = (M.ZONES[c.zone] || {}).name || 'Dubái';
        toast(`🎁 ¡Cofre de hielo en ${zn}! +5 ❄️`, 'gold');
      } else {
        if (c.taken && c.by !== my.idx) toast(`🎁 ${c.name} abrió el cofre`, 'gold', 1600);
        if (c.taken) addFx('chest', c.x, c.y);
        chest = null;
      }
    });
    s.on('sn:pause', (d) => {
      paused = !!d.paused;
      balls = [];
      if (typeof d.spellInMs === 'number' && !spellCast) until.spell = now() + d.spellInMs;
      // a kid on a question sees the pause card on the map (their question stays open: ❓ brings it back)
      if (paused) { closeMini(); if (questionOpen()) ctx.showScreen('snow'); setJoy(-1); }
      hud(true);
    });
    s.on('sn:refused', (r) => {
      until.asking = 0;
      if (r.what === 'throw') {
        if (typeof r.copos === 'number') my.copos = r.copos;          // the server's count wins
        if (r.why === 'copos') { noCopos(); }
        else if (r.why === 'early') toast(`¡Junta copos primero! El hechizo llega en ${Math.max(1, Math.ceil((until.spell - now()) / 1000))} s`, 'gold');
      } else if (r.what === 'station') {
        if (r.why === 'far') toast('Acércate más a la estación ❓', 'gold');
      } else if (r.what === 'job') {
        if (r.why === 'cooldown') toast(`¡Espera ${Math.ceil((r.waitMs || 1000) / 1000)} s para otra!`, 'gold');
      }
      hud(true);
    });
    s.on('question', () => {
      until.asking = 0;
      setJoy(-1);
      const kn = $('sn-knob'); if (kn) kn.style.transform = '';
      if (ctx.markActivity) ctx.markActivity();
      document.querySelectorAll('.sn-hand').forEach((h) => h.remove());   // a map hint never sits on the «🗺️ Mapa» button
      setTimeout(qExtras, 0);
    });
    s.on('answer-result', (r) => {
      if (!r || !r.snow) return;
      my.copos = r.snow.copos; my.calor = r.snow.calorNow; my.streak = r.snow.streak;
      if (r.correct) { addFx('plus', me ? me.x : 0, me ? me.y : 0, { text: `+${r.snow.gained} ❄️` }); setTimeout(() => sfx('copos', 0.55), 350); }
      setTimeout(backToMap, r.correct ? 1400 : 1900);
      hud(true);
    });
    s.on('game-end', () => { stop(); closeMini(); $('sn-frozen') && $('sn-frozen').classList.add('hidden'); });
    // «¡FINAL!» (2026-10-16): the map stands still under the band; the ceremony follows (js/party.js)
    s.on('fin:final', () => { if (!map) return; stop(); closeMini(); setJoy(-1); balls = []; $('sn-frozen') && $('sn-frozen').classList.add('hidden'); });
    // the last 30 s: «¡Copos dobles!» (every right answer at a station counts twice, for both sides)
    s.on('fin:frenzy', (d) => {
      if (!map || !d || d.off || d.again) return;
      toast(my.side === 'ice' ? '❄️❄️ ¡Copos dobles! Últimos 30 s: ¡atrapa a los últimos!' : '❄️❄️ ¡Copos dobles! Últimos 30 s: ¡aguanta!', 'gold', 3000);
      sfx('copos', 0.6);
    });
    bindControls();
  }

  function applyPos(arr) {
    const seen = {};
    arr.forEach(([idx, x, y, f, fl]) => {
      if (idx === my.idx) return;
      seen[idx] = 1;
      const o = others[idx] || (others[idx] = { x, y, tx: x, ty: y });
      if (Math.hypot(x - o.x, y - o.y) > 160) { o.x = x; o.y = y; }
      o.tx = x; o.ty = y; o.f = f; o.flags = fl;
    });
    Object.keys(others).forEach((i) => { if (!seen[i]) delete others[i]; });
  }

  // my own state from the server (copos, ☀️, side, stun, respawn, corrections, what just happened)
  function applyMe(m, quiet) {
    const t = now();
    const wasSide = my.side;
    ['idx', 'side', 'copos', 'calor', 'streak', 'score', 'freezes'].forEach((k) => { if (m[k] !== undefined) my[k] = m[k]; });
    if (typeof m.stunMs === 'number') until.stun = t + m.stunMs;
    if (typeof m.respawnMs === 'number') until.respawn = t + m.respawnMs;
    if (typeof m.shieldMs === 'number') until.shield = t + m.shieldMs;
    if (typeof m.paused === 'boolean') paused = m.paused;
    if (m.pos && me) { me.x = m.pos[0]; me.y = m.pos[1]; lastSent = null; }
    if (!quiet) {
      if (wasSide === 'sun' && my.side === 'ice') frozenScreen(m.frozenBy);
      else if (m.hit === 'brrr') {
        sfx('hit', 0.8); buzz([90, 40, 90]);
        frostEdges();
        toast(my.calor === 1 ? '¡Brrr! Te queda 1 ☀️: ¡corre y responde!' : `¡Brrr! Te quedan ${'☀️'.repeat(my.calor)}`, 'ice');
      } else if (m.hit === 'stun') {
        sfx('stun', 0.8); buzz([120]);
      } else if (m.hit === 'shield') sfx('pop', 0.5);
      if (m.scored === 'freeze') { sfx(K + 'streak.mp3', 0.6); toast(`❄️ ¡Congelaste a ${m.targetName}! +50`, 'ice'); }
      if (m.warm) { toast('☀️ ¡Te calentaste al sol! +1 ☀️', 'sun', 1600); }
      if (m.refuge) { sfx(K + 'landmark.mp3', 0.6); }
      if (m.chest) { sfx('chest', 0.8); sfx('copos', 0.6); addFx('chest', me.x, me.y); addFx('plus', me.x, me.y, { text: '+5 ❄️' }); toast('🎁 ¡Cofre! +5 copos ❄️', 'gold'); }
      if (m.job) { sfx('copos', 0.6); addFx('plus', me.x, me.y, { text: m.job.kind === 'pearl' ? '+1 🦪' : '+1 🌴' }); until.job = t + 10000; }
    }
    hud(true);
  }

  // ---------- screens ----------
  function start() {
    running = true;
    if (!onScreen() && !questionOpen()) ctx.showScreen('snow');
    canvas = $('sn-canvas');
    g = canvas.getContext('2d');
    resize();
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); setJoy(-1); }
  const questionOpen = () => !!$('screen-question') && !$('screen-question').classList.contains('hidden');
  function backToMap() {
    if (!map || !running) return;
    if (questionOpen() || ($('screen-result') && !$('screen-result').classList.contains('hidden'))) ctx.showScreen('snow');
    resize();
    hud(true);
  }
  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;                 // hidden (question screen): keep the last good size
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }
  window.addEventListener('resize', resize);

  // ---------- controls ----------
  function bindControls() {
    const joy = $('sn-joy');
    if (!joy) return;
    let jp = null;                                    // { id, ox, oy }
    const knob = $('sn-knob');
    const move = (e) => {
      if (!jp || e.pointerId !== jp.id) return;
      e.preventDefault();
      const dx = e.clientX - jp.ox, dy = e.clientY - jp.oy;
      const d = Math.hypot(dx, dy);
      const k = Math.min(1, 46 / Math.max(1, d));
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      setJoy(d < 12 ? -1 : M.dirOf(dx, dy));
    };
    const end = (e) => {
      if (!jp || e.pointerId !== jp.id) return;
      jp = null; knob.style.transform = ''; setJoy(-1); joy.classList.remove('down');
    };
    const begin = (e, ox, oy) => {
      if (helpOpen()) hideHelp();
      jp = { id: e.pointerId, ox, oy };
      joy.classList.add('down');
      hideHand('joy');
      try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
      move(e);
    };
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); const r = joy.getBoundingClientRect(); begin(e, r.left + r.width / 2, r.top + r.height / 2); });
    // the left part of the map works as a floating joystick too (little thumbs miss the pad)
    const cv = $('sn-canvas');
    cv.addEventListener('pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      if (e.clientX - r.left > r.width * 0.55) { tapMap(e); return; }
      e.preventDefault(); begin(e, e.clientX, e.clientY);
    });
    [joy, cv].forEach((el) => { el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); });
    const th = $('sn-throw');
    th.addEventListener('pointerdown', (e) => { e.preventDefault(); if (helpOpen()) hideHelp(); th.classList.add('down'); setTimeout(() => th.classList.remove('down'), 130); throwBall(); });
    const use = $('sn-use');
    use.addEventListener('pointerdown', (e) => { e.preventDefault(); use.classList.add('down'); setTimeout(() => use.classList.remove('down'), 130); useHere(); });
    const go = $('sn-help-go');
    if (go) go.addEventListener('click', hideHelp);
    const pr = $('sn-prompt');
    if (pr) pr.addEventListener('click', () => { if (near.station !== null) useHere(); });
    document.addEventListener('keydown', (e) => {
      if (!running || !onScreen()) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.keys.l = 1;
      if (k === 'arrowright' || k === 'd') input.keys.r = 1;
      if (k === 'arrowup' || k === 'w') input.keys.u = 1;
      if (k === 'arrowdown' || k === 's') input.keys.d = 1;
      if (k === ' ') { e.preventDefault(); throwBall(); }
      if (k === 'e' || k === 'enter') useHere();
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.keys.l = 0;
      if (k === 'arrowright' || k === 'd') input.keys.r = 0;
      if (k === 'arrowup' || k === 'w') input.keys.u = 0;
      if (k === 'arrowdown' || k === 's') input.keys.d = 0;
    });
  }
  function setJoy(d) { input.dir = d; }
  // a tap on the map: on a station / job next to me = use it
  function tapMap(e) {
    if (!map || !me) return;
    const r = canvas.getBoundingClientRect();
    const wx = view.camX + (e.clientX - r.left) / view.s, wy = view.camY + (e.clientY - r.top) / view.s;
    const st = map.stations.find((s) => wx >= s.x * T - 12 && wx <= (s.x + 2) * T + 12 && wy >= s.y * T - 40 && wy <= (s.y + 2) * T + 12);
    if (st && near.station === st.id) { useHere(); return; }
    const j = map.jobs.find((jj) => Math.hypot(jj.x * T - wx, jj.y * T - wy) < 30);
    if (j && near.job === j.id) useHere();
  }

  function enemies() {
    const out = [];
    Object.entries(others).forEach(([i, o]) => {
      if (o.flags & 8) return;
      const ice = !!(o.flags & 1);
      if (ice === (my.side === 'ice')) return;
      out.push({ idx: +i, x: o.x, y: o.y, d: me ? Math.hypot(o.x - me.x, o.y - me.y) : 1e9, stunned: !!(o.flags & 2) });
    });
    return out.sort((a, b) => a.d - b.d);
  }
  function throwBall() {
    if (!me || !running || paused || frozenOpen()) return;
    const t = now();
    if (t < until.stun) { toast('🧊 ¡Estás congelado! Espera…', 'ice', 1200); return; }
    if (!spellCast) { toast(`¡Junta copos! El hechizo llega en ${Math.max(1, Math.ceil((until.spell - t) / 1000))} s`, 'gold'); return; }
    if (!(my.copos > 0)) { noCopos(); return; }
    // the server's cooldown (a mashed button must not spend copos the server refuses)
    const cd = my.side === 'ice' ? 1000 : 650;
    if (t - (until.lastThrow || 0) < cd) return;
    until.lastThrow = t;
    // auto-aim: the nearest kid of the other side in reach (not one already stunned), else where I'm facing
    const target = enemies().find((e) => e.d <= AIM && !e.stunned) || enemies().find((e) => e.d <= AIM);
    const dir = target ? [target.x - me.x, target.y - me.y] : M.DIRS[me.f >= 0 ? me.f : 2];
    ctx.socket.emit('player:sn-throw', { pin: ctx.getPin(), dx: dir[0], dy: dir[1] });
    if (ctx.markActivity) ctx.markActivity();
    my.copos = Math.max(0, my.copos - 1);        // the server confirms with sn:me
    sfx('throw', 0.6);
    buzz(15);
    hideHand('throw');
    hud(true);
  }
  function useHere() {
    if (!me || !running || paused || frozenOpen()) return;
    hideHand('use');
    if (near.station !== null) {
      if (now() < until.asking) return;
      until.asking = now() + 4000;
      ctx.socket.emit('player:sn-ask', { pin: ctx.getPin(), station: near.station });
      if (ctx.markActivity) ctx.markActivity();
      sfx(K + 'tap.mp3', 0.6);
      hud(true);
      return;
    }
    if (near.job !== null) {
      const j = map.jobs.find((jj) => jj.id === near.job);
      if (!j) return;
      if (now() < until.job) { toast(`¡Espera ${Math.ceil((until.job - now()) / 1000)} s para otra!`, 'gold'); return; }
      openMini(j);
    }
  }
  function noCopos() {
    sfx(K + 'wrong.mp3', 0.4);
    buzz([40, 30, 40]);
    const p = $('sn-prompt');
    if (p) { p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); }
    toast('¡Sin copos! Ve a una estación ❓ y responde', 'gold', 1800);
  }

  // ---------- mini-games: pearls (tap when the oyster opens) and dates (shake the palm) ----------
  let mini = null;
  function openMini(j) {
    const box = $('sn-mini');
    if (!box) return;
    closeMini();
    mini = { job: j, taps: 0, t0: now(), done: false };
    box.className = 'sn-mini ' + j.kind;
    $('sn-mini-title').textContent = j.kind === 'pearl' ? '🦪 ¡Toca cuando se abra la ostra!' : '🌴 ¡Sacude la palmera! Toca 4 veces';
    $('sn-mini-obj').textContent = j.kind === 'pearl' ? '🦪' : '🌴';
    $('sn-mini-msg').textContent = '';
    box.classList.remove('hidden');
    sfx(j.kind === 'pearl' ? 'dive' : K + 'tap.mp3', 0.6);
    mini.timer = setTimeout(() => { if (mini && !mini.done) { $('sn-mini-msg').textContent = '¡Se fue! Prueba otra vez'; setTimeout(closeMini, 900); } }, 6000);
  }
  function miniTap(e) {
    if (e) e.preventDefault();
    if (!mini || mini.done) return;
    const box = $('sn-mini');
    if (mini.job.kind === 'pearl') {
      const open = box.classList.contains('open');
      if (open) winMini('¡Una perla! +1 ❄️');
      else { $('sn-mini-msg').textContent = '¡Casi! Espera a que se abra'; sfx('pop', 0.4); }
    } else {
      mini.taps++;
      const o = $('sn-mini-obj');
      o.classList.remove('wiggle'); void o.offsetWidth; o.classList.add('wiggle');
      sfx(K + 'tap.mp3', 0.5);
      if (mini.taps >= 4) winMini('¡Dátiles! +1 ❄️');
    }
  }
  function winMini(text) {
    mini.done = true;
    $('sn-mini-msg').textContent = text;
    ctx.socket.emit('player:sn-job', { pin: ctx.getPin(), job: mini.job.id });
    setTimeout(closeMini, 800);
  }
  function closeMini() {
    const box = $('sn-mini');
    if (mini && mini.timer) clearTimeout(mini.timer);
    mini = null;
    if (box) box.classList.add('hidden');
  }
  (function oyster() {   // the oyster opens and closes on its own rhythm
    setInterval(() => {
      const box = $('sn-mini');
      if (!box || !mini || mini.job.kind !== 'pearl' || mini.done) return;
      box.classList.toggle('open');
    }, 750);
  })();
  document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('#sn-mini-obj, #sn-mini-tap')) miniTap(e); }, true);

  // ---------- big screens: frozen, first-play card ----------
  function frozenScreen(by) {
    const box = $('sn-frozen');
    if (!box) return;
    closeMini();
    if (questionOpen()) ctx.showScreen('snow');
    const img = $('sn-frozen-img');
    const p = roster[my.idx];
    if (img) img.src = R.SKIN_URL((p && p.skin) || 'dralingo');
    $('sn-frozen-title').textContent = by === 'spell' ? '¡El Hechizo de Hielo te eligió!' : '¡Te congelaron!';
    $('sn-frozen-by').textContent = by && by !== 'spell' ? `❄️ Te congeló ${by}` : '';
    const C = window.DralingoCast, cap = captains && captains.ice;
    $('sn-frozen-cap').classList.toggle('hidden', !(C && cap));
    if (C && cap) {
      $('sn-frozen-cap-img').src = C.pose(cap, 'cheer');
      $('sn-frozen-cap-name').textContent = C.captain(cap) + ':';
      $('sn-frozen-cap-line').textContent = '«' + C.line(cap, 'battle') + '»';
    }
    box.classList.remove('hidden');
    sfx('freeze', 0.9);
    buzz([200, 60, 200]);
    const ring = $('sn-frozen-n');
    const tick = () => {
      const left = Math.ceil((until.respawn - now()) / 1000);
      if (ring) ring.textContent = Math.max(1, left);
      if (left > 0 && !box.classList.contains('hidden')) setTimeout(tick, 200);
      else { box.classList.add('hidden'); toast('❄️ ¡Ahora atrapa a los supervivientes!', 'ice'); }
    };
    tick();
  }
  function showHelp() {
    const card = $('sn-help');
    if (!card) return;
    const key = 'snHelp:' + (ctx.getPin ? ctx.getPin() : '');
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (_) { /* private mode: show it */ }
    const p = roster[my.idx];
    const k = (p && p.skin) || 'dralingo';
    $('sn-help-me').src = R.SKIN_URL(k);
    $('sn-help-frost').src = R.SKIN_URL(k);
    card.classList.remove('hidden');
  }
  function hideHelp() {
    const c = $('sn-help');
    if (c) c.classList.add('hidden');
    showHand('joy');
  }

  // ---------- tapping hand (first moves of the session) ----------
  const HAND = { joy: '¡Arrastra!', use: '¡Toca!', throw: '¡Lanza!' };
  function handDone(k) { try { return !!sessionStorage.getItem('snHand:' + k); } catch (_) { return false; } }
  function showHand(k) {
    if (handDone(k) || $('sn-hand-' + k)) return;
    const scr = $('screen-snow');
    if (!scr || scr.classList.contains('hidden')) return;   // map not on screen: its button has no place yet (was a hand at 0,0)
    const el = $(k === 'joy' ? 'sn-joy' : k === 'use' ? 'sn-use' : 'sn-throw');
    if (!el || el.classList.contains('hidden')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const h = document.createElement('div');
    h.className = 'kdp-hand sn-hand';
    h.id = 'sn-hand-' + k;
    h.innerHTML = '<span>👆</span><b>' + HAND[k] + '</b>';
    h.style.left = (r.left + r.width * (k === 'joy' ? 0.5 : 0.72)) + 'px';
    h.style.top = (r.top + r.height * (k === 'joy' ? 0.35 : 0.6)) + 'px';
    $('screen-snow').appendChild(h);
  }
  function hideHand(k) {
    const h = $('sn-hand-' + k);
    if (h) h.remove();
    try { sessionStorage.setItem('snHand:' + k, '1'); } catch (_) {}
  }

  // ---------- the question screen extras: back to the map, danger warning ----------
  function qExtras() {
    const q = $('screen-question');
    if (!q || !document.body.classList.contains('sn-on')) return;
    if (!$('sn-q-map')) {
      const b = document.createElement('button');
      b.id = 'sn-q-map'; b.className = 'sn-q-map'; b.type = 'button';
      b.textContent = '🗺️ Mapa';
      b.addEventListener('click', () => { ctx.showScreen('snow'); resize(); });
      q.appendChild(b);
      const w = document.createElement('div');
      w.id = 'sn-q-warn'; w.className = 'sn-q-warn hidden';
      w.textContent = '⚠️ ¡Cuidado! El Equipo Hielo está cerca';
      q.appendChild(w);
    }
  }
  function dangerCheck() {
    const w = $('sn-q-warn');
    if (!w) return;
    const danger = my.side === 'sun' && questionOpen() && enemies().some((e) => e.d < 5 * T);
    w.classList.toggle('hidden', !danger);
  }

  // ---------- toast, frost edges, prompt ----------
  let toastTimer = null;
  function toast(text, kind, ms) {
    const el = $('sn-toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'sn-toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'sn-toast'; }, ms || 2200);
  }
  function frostEdges() {
    const el = $('sn-frost-edges');
    if (!el) return;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function addFx(kind, x, y, extra) {
    fx.push(Object.assign({ kind, x, y, t0: performance.now(), dur: kind === 'freeze' ? 900 : kind === 'plus' ? 1100 : 500, seed: Math.random() * 6 }, extra || {}));
  }
  function nearestStation() {
    let best = null, bd = 1e9;
    map.stations.forEach((s) => { const d = Math.hypot((s.x + 1) * T - me.x, (s.y + 1) * T - me.y); if (d < bd) { bd = d; best = s; } });
    return best;
  }

  // ---------- HUD (DOM only when something visible changed) ----------
  let hudKey = '';
  function hud(force) {
    if (!map || !me) return;
    const t = now();
    const headStart = !spellCast && until.spell > t;
    const iceSide = my.side === 'ice';
    const key = [my.side, my.copos, my.calor, counts.sun, counts.ice, near.station, near.job, paused, headStart ? Math.ceil((until.spell - t) / 1000) : 0,
      t < until.stun, t < until.asking, chest ? chest.id : 0, t < until.chestHint, t < until.job ? Math.ceil((until.job - t) / 1000) : 0].join('|');
    if (!force && key === hudKey) return;
    hudKey = key;
    document.body.classList.toggle('sn-ice', iceSide);
    const p = roster[my.idx];
    if ($('sn-me-img')) $('sn-me-img').src = R.SKIN_URL((p && p.skin) || 'dralingo');
    $('sn-me-side').textContent = iceSide ? '❄️ Equipo Hielo' : '☀️ Superviviente';
    $('sn-calor').textContent = iceSide ? (my.freezes ? `❄️ ${my.freezes} congelados` : '¡Atrapa a los demás!') : '☀️'.repeat(Math.max(0, my.calor)) + '🤍'.repeat(Math.max(0, 3 - my.calor));
    $('sn-copos-n').textContent = my.copos;
    $('sn-copos').classList.toggle('empty', !(my.copos > 0));
    $('sn-throw-n').textContent = my.copos;
    $('sn-throw').classList.toggle('empty', !(my.copos > 0) || !spellCast);
    const total = Math.max(1, counts.total);
    $('sn-bar-fill').style.width = Math.round((counts.ice / total) * 100) + '%';
    $('sn-bar-text').textContent = `❄️ ${counts.ice}/${counts.total} congelados · ☀️ ${counts.sun} libres`;
    // the context button: answer at a station / dive / harvest
    const use = $('sn-use');
    if (near.station !== null) {
      use.classList.remove('hidden', 'job');
      $('sn-use-ico').textContent = '❓';
      $('sn-use-text').textContent = t < until.asking ? 'Cargando…' : '¡Responder!';
      showHand('use');
    } else if (near.job !== null) {
      const j = map.jobs.find((jj) => jj.id === near.job);
      use.classList.remove('hidden'); use.classList.add('job');
      const wait = t < until.job ? Math.ceil((until.job - t) / 1000) : 0;
      $('sn-use-ico').textContent = j && j.kind === 'pearl' ? '🦪' : '🌴';
      $('sn-use-text').textContent = wait ? `Espera ${wait} s` : (j && j.kind === 'pearl' ? '¡Bucear!' : '¡Cosechar!');
    } else use.classList.add('hidden');
    if (spellCast && my.copos > 0 && !handDone('throw') && enemies().some((e) => e.d <= AIM)) showHand('throw');
    // the big prompt over the map: exactly what to do next
    const pr = $('sn-prompt');
    let title = '', text = '', pose = iceSide ? 'frozen' : 'pointing', target = null, kind = iceSide ? 'ice' : 'gold';
    const ns = nearestStation();
    if (headStart && my.side === 'sun') {
      title = '¡Junta copos!'; text = `El Hechizo de Hielo llega en ${Math.ceil((until.spell - t) / 1000)} s · ve a una estación ❓`; target = ns;
    } else if (!(my.copos > 0) && !(t < until.stun)) {
      title = '¡Sin copos!'; text = near.station !== null ? 'Toca «¡Responder!» y gana +3 ❄️' : 'Camina a una estación ❓ y responde'; pose = 'shocked'; target = near.station !== null ? null : ns;
    } else if (chest && t < until.chestHint) {
      title = '🎁 ¡Cofre de hielo!'; text = 'Corre: el primero gana +5 ❄️'; target = { cx: chest.x, cy: chest.y }; kind = 'gold';
    }
    pr.classList.toggle('hidden', !title || paused);
    if (title) {
      $('sn-prompt-title').textContent = title;
      $('sn-prompt-text').textContent = text;
      $('sn-prompt-img').src = POSE(pose);
      pr.dataset.kind = kind;
      pr.dataset.target = target ? (target.cx ? target.cx + ',' + target.cy : ((target.x + 1) * T) + ',' + ((target.y + 1) * T)) : '';
    }
    $('sn-pause').classList.toggle('hidden', !paused);
    $('sn-stunned').classList.toggle('hidden', !(t < until.stun) || paused);
  }
  function arrowTick() {
    const pr = $('sn-prompt');
    const ar = $('sn-prompt-arrow');
    if (!pr || !ar || pr.classList.contains('hidden')) return;
    const tg = pr.dataset.target;
    if (!tg) { ar.style.visibility = 'hidden'; return; }
    const [x, y] = tg.split(',').map(Number);
    ar.style.visibility = 'visible';
    ar.style.transform = `rotate(${Math.atan2(y - me.y, x - me.x)}rad)`;
  }

  // ---------- simulation ----------
  function step(dt) {
    const t = now();
    const blocked = paused || t < until.stun || t < until.respawn || frozenOpen() || miniOpen() || helpOpen();
    let dir = input.dir;
    if (dir < 0) {
      const kx = input.keys.r - input.keys.l, ky = input.keys.d - input.keys.u;
      dir = M.dirOf(kx, ky);
    }
    me.moving = false;
    if (!blocked && dir >= 0) {
      const [vx, vy] = M.DIRS[dir];
      const sp = SPEED[my.side] || 150;
      M.moveBody(map, me, vx * sp * dt, vy * sp * dt);
      me.f = dir;
      me.moving = true;
      if (!handDone('joy')) hideHand('joy');
    }
    // what's next to me: a station (feet within ~1.7 tiles of its block), a pearl / date palm
    near.station = null; near.job = null;
    if (!blocked) {
      map.stations.forEach((s) => {
        const cx = Math.max(s.x * T, Math.min(me.x, (s.x + 2) * T)), cy = Math.max(s.y * T, Math.min(me.y, (s.y + 2) * T));
        if (Math.hypot(me.x - cx, me.y - cy) < 1.7 * T) near.station = s.id;
      });
      if (near.station === null) map.jobs.forEach((j) => { if (Math.hypot(me.x - j.x * T, me.y - j.y * T) < (j.kind === 'pearl' ? 1.7 : 1.5) * T) near.job = j.id; });
      // the chest opens when I walk into it
      if (chest && !chest.asked && Math.hypot(me.x - chest.x, me.y - chest.y) < 0.95 * T) {
        chest.asked = true;
        ctx.socket.emit('player:sn-grab', { pin: ctx.getPin(), chest: chest.id });
        setTimeout(() => { if (chest) chest.asked = false; }, 1200);
      }
    }
    Object.values(others).forEach((o) => { const a = Math.min(1, dt * 10); const d = Math.hypot(o.tx - o.x, o.ty - o.y); o.moving = d > 1.5; o.x += (o.tx - o.x) * a; o.y += (o.ty - o.y) * a; });
  }
  function send(nowMs, force) {
    if (!force && nowMs - lastSend < SEND_MS) return;
    const moved = !lastSent || Math.abs(lastSent.x - me.x) > 0.5 || Math.abs(lastSent.y - me.y) > 0.5 || lastSent.f !== me.f;
    if (!moved && nowMs - lastSend < 1000) return;      // standing still: a keepalive once a second
    lastSend = nowMs;
    lastSent = { x: me.x, y: me.y, f: me.f };
    ctx.socket.emit('player:sn-pos', { pin: ctx.getPin(), x: me.x, y: me.y, f: me.f >= 0 ? me.f : 2 });   // exact: rounding could poke into a wall
    if (ctx.markActivity) ctx.markActivity();
  }

  // ---------- drawing ----------
  function draw() {
    const cw = canvas.width, ch = canvas.height;
    if (!cw || !ch) return;
    const tilesAcross = Math.max(9, Math.min(15, (cw / dpr) / 34));
    const s = (cw / dpr) / (tilesAcross * T);              // CSS px per world px
    const S = s * dpr;
    const vw = cw / S, vh = ch / S;
    const W = map.cols * T, H = map.rows * T;
    let camX = me.x - vw / 2, camY = me.y - 20 - vh / 2;
    camX = Math.max(0, Math.min(W - vw, camX));
    camY = Math.max(0, Math.min(H - vh, camY));
    if (vh > H) camY = (H - vh) / 2;
    view = { s, camX, camY };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#e5c38c'; g.fillRect(0, 0, cw, ch);
    g.setTransform(S, 0, 0, S, -camX * S, -camY * S);
    const pnow = performance.now();
    balls = balls.filter((b) => {
      const dist = Math.min(b.range, (b.speed * (pnow - b.t0)) / 1000);
      b.x = b.x0 + b.dx * dist; b.y = b.y0 + b.dy * dist;
      if (dist >= b.range) { addFx('splash', b.x, b.y); return false; }
      return pnow - b.t0 < 3000;
    });
    fx = fx.filter((f) => pnow - f.t0 < f.dur);
    const t = now();
    const kids = Object.entries(others).map(([i, o]) => {
      const p = roster[i] || {};
      return { idx: +i, x: o.x, y: o.y, f: o.f, flags: o.flags || 0, moving: o.moving, skin: p.skin || 'dralingo', name: p.name || '' };
    });
    const mp = roster[my.idx] || {};
    const myFlags = (my.side === 'ice' ? 1 : 0) | (t < until.stun ? 2 : 0) | (t < until.shield ? 4 : 0) | (t < until.respawn ? 8 : 0);
    kids.push({ idx: my.idx, x: me.x, y: me.y, f: me.f, flags: myFlags, moving: me.moving, skin: mp.skin || 'dralingo', name: mp.name || '', me: true });
    const armor = counts.total > 0 && counts.ice <= counts.total * 0.2;   // core/snow.js R.ARMOR_RATIO
    R.world(g, { map, kids, balls, fx, chest, now: pnow, near, armor, jobsCool: t < until.job }, { s }, {
      groundScale: dpr >= 2 ? 2 : 1.5, tag: 11, size: 46, labels: true, labelSize: 11, meLabel: 'Tú',
    });
    edgeArrows(g, s, S, camX, camY, vw, vh);
  }
  // arrows at the screen edge: the chest (gold) and the nearest kid to watch (ice) / hunt (survivor)
  function edgeArrows(gg, s, S, camX, camY, vw, vh) {
    const marks = [];
    if (chest) marks.push({ x: chest.x, y: chest.y, color: '#ffc93c', ico: '🎁' });
    const e = enemies()[0];
    if (e && e.d < 12 * T) marks.push({ x: e.x, y: e.y, color: my.side === 'ice' ? '#ffb020' : '#4cc3ff', ico: my.side === 'ice' ? '☀️' : '❄️' });
    gg.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = vw * s, ch = vh * s;
    marks.forEach((m) => {
      const sx = (m.x - camX) * s, sy = (m.y - 20 - camY) * s;
      if (sx > 10 && sx < cw - 10 && sy > 10 && sy < ch - 10) return;
      const cx = cw / 2, cy = ch / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const k = Math.min((cw / 2 - 26) / Math.abs(Math.cos(a) || 1e-6), (ch / 2 - 26) / Math.abs(Math.sin(a) || 1e-6));
      const px = cx + Math.cos(a) * k, py = cy + Math.sin(a) * k;
      gg.save(); gg.translate(px, py); gg.rotate(a);
      gg.fillStyle = m.color; gg.strokeStyle = R.INK; gg.lineWidth = 3;
      gg.beginPath(); gg.moveTo(18, 0); gg.lineTo(-8, -13); gg.lineTo(-8, 13); gg.closePath(); gg.fill(); gg.stroke();
      gg.restore();
      gg.font = '18px sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
      gg.fillText(m.ico, px - Math.cos(a) * 22, py - Math.sin(a) * 22);
    });
  }

  let lastHud = 0;
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.1, (ts - lastT) / 1000);
    lastT = ts;
    if (map && me && onScreen()) {
      for (let rem = dt; rem > 1e-6; rem -= 1 / 60) step(Math.min(rem, 1 / 60));   // ≤ 1/60 s per step: no wall tunnelling
      send(Date.now());
      draw();
      if (ts - lastHud > 150) { lastHud = ts; hud(false); arrowTick(); }
    } else if (map && me) {
      send(Date.now());
      if (ts - lastHud > 300) { lastHud = ts; dangerCheck(); Object.values(others).forEach((o) => { o.x = o.tx; o.y = o.ty; }); }
    }
    raf = requestAnimationFrame(loop);
  }

  window.SnowPhone = {
    init,
    debug: () => ({ me, my, near, counts, chest, paused, spellCast, until: Object.fromEntries(Object.entries(until).map(([k, v]) => [k, Math.max(0, v - now())])) }),
    // Test hooks: headless QA browsers barely deliver animation frames, so step the simulation by hand.
    //   SnowPhone.advance(1.2, { r: 1 })  → walk right for 1.2 s, send, draw
    advance(sec, keys) {
      if (!map || !me) return null;
      Object.assign(input.keys, { l: 0, r: 0, u: 0, d: 0 }, keys || {});
      for (let k = 0; k < Math.round(sec * 60); k++) step(1 / 60);
      input.keys = { l: 0, r: 0, u: 0, d: 0 };
      send(Date.now(), true);
      if (onScreen()) { resize(); draw(); }
      hud(true); arrowTick();
      return { x: Math.round(me.x), y: Math.round(me.y), near: Object.assign({}, near), copos: my.copos, side: my.side };
    },
    // walk (in real time, 8 position messages a second) to the tile next to (tx, ty)
    walkTo(tx, ty, w, h) {
      return new Promise((resolve) => {
        const path = M.pathTo(map, me.x, me.y, tx, ty, w || 1, h || 1);
        if (!path) return resolve(null);
        const tick = () => {
          if (!path.length) { if (onScreen()) { resize(); draw(); } hud(true); arrowTick(); return resolve({ x: Math.round(me.x), y: Math.round(me.y), near: Object.assign({}, near) }); }
          let budget = (SPEED[my.side] || 150) * 0.125;
          while (budget > 0 && path.length) {
            const [px, py] = path[0];
            const d = Math.hypot(px - me.x, py - me.y);
            if (d < 1) { path.shift(); continue; }
            const l = Math.min(d, budget);
            for (let i = 0; i < 8; i++) M.moveBody(map, me, (px - me.x) / d * l / 8, (py - me.y) / d * l / 8);
            me.f = M.dirOf(px - me.x, py - me.y) >= 0 ? M.dirOf(px - me.x, py - me.y) : me.f;
            budget -= l;
            if (Math.hypot(px - me.x, py - me.y) < 1) path.shift();
            else break;
          }
          step(0);
          send(Date.now(), true);
          setTimeout(tick, 125);
        };
        tick();
      });
    },
    throw: () => throwBall(),
    use: () => useHere(),
    frame: () => { if (map && me && onScreen()) { resize(); draw(); hud(true); arrowTick(); } },
    station: (id) => map && map.stations.find((s) => s.id === id),
    jobs: () => map && map.jobs,
    openMini: (kind) => { const j = map.jobs.find((jj) => jj.kind === kind); if (j) openMini(j); },
    frozen: (by) => { until.respawn = now() + 3000; frozenScreen(by || 'Ana'); },
    hideHelp: () => hideHelp(),
  };
})();
