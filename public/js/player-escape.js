// La Gran Fuga de Dubái v2 — the kid's phone (spec docs/specs/gran-fuga-v2.md). Questions use the shared pastel skin
// (player-kingdoms-skin.js); this module adds what makes it this game:
//   · the CHASE STRIP on top of every question and result: the zone's own world live (its far background and ground
//     strip, js/escape-render.js scene()), my character big with «TÚ», crewmates around me, Robotín behind at his real
//     distance, the next place's gate or Hamdan's jet arriving; a right answer = I dash ahead (súper turbo in gold),
//     a zap = lightning on me; hearts, the place and «Robotín a 12 m» on it
//   · phone-sized game-show moments as a band (never over the answer tiles): Robotín wakes, ¡Zap!, last minute, zonas
//     verdes, ¡A salvo!, and full cards when no tiles are on screen (a postcard of the next place, caught, the escape)
//   · the «zona segura» screen: the zone's painted room (square: almost all of it fits a portrait phone), my character
//     with the Batalla de Nieve joystick, an arrow to the nearest zone with room, a status pill that says what to do
//   · the episode intro on the countdown (my character in the crew VS Robotín) and the end card
// player.js calls EscapePhone.init(...) once. Test hooks: EscapePhone.advance(sec, keys), walkTo(tx, ty), band(kind),
// card(kind), frame(), dash(super).
(function () {
  const M = window.EscapeMap, R = window.EscapeRender;
  const ES = '/assets/escape/', K = '/assets/kingdoms/', D = '/assets/dralingo/';
  const T = M ? M.TILE : 32;
  const SEND_MS = 125;
  const SPEED = 140;
  const PXM = 7;            // the strip: px per metre of ground
  const RMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;     // (read once: no media query per frame)
  const reduced = () => !!(RMQ && RMQ.matches);

  let ctx = null, on = false;
  let es = null, roster = {}, cast = null, seed = 0, route = 0;
  let my = { idx: 0, turbos: 0, best: 0, streak: 0, safe: 0, waves: 0 };
  let crew = 0, robot = -22, crewShown = 0, robotShown = -22, dizzyUntil = 0, paused = false, closeFlag = false, pausedLeft = 0;
  let dashAt = 0, dashSuper = false, zapAt = 0, dashHoldU = null, finished = false;    // (dashHoldU: test screenshots only)
  let room = null, zones = [], occ = {}, others = {}, me = null, running = false, raf = 0, lastT = 0, lastSend = 0, lastSent = null;
  let waveUntil = 0, waveTotal = 10000, flashAt = 0, zapTargets = [], input = { dir: -1, keys: { l: 0, r: 0, u: 0, d: 0 } };
  let canvas = null, g = null, dpr = 1, view = { s: 1, ox: 0, oy: 0 };
  // ---- the chase pass (2026-10-19): MY Robotín. The server runs him (core/escape.js stepChase) and sends his numbers a
  // few times a second (es:g) and every event (es:pzap / es:lunge / es:trip / es:near); this phone glides between them
  // with the same formula, draws him in the strip at MY distance and plays the fear: his treads, my heartbeat, red edges.
  let CHC = { g0: 14, gmax: 16, warn: 7, near: 4, lx: 1.5, lk: 1.3 };   // es:init `chase` (core/escape.js R.CH_*)
  let ch = { v: 0, sh: 0, lu: 0, lt: 0 };            // his base speed (m/s); my shield's end and his lunge's end (this clock)
  let gap = 14, gapShown = 14;                        // metres between him and me (gap: now; gapShown: what the strip draws)
  let myQ = false;                                    // a question of mine is open (he only comes while it is)
  let stunUntil = 0, stunMs = 1800, tripAt = -1e9, stumbleAt = -1e9, nearAt = -1e9, zapMeAt = -1e9, shieldAt = -1e9;
  let wakeUntil = 0;                                  // Robotín asleep at the start of a run
  let pausedAt = 0, stunT = 0, edgeLv = -1, lastDashM = 0, lastGAt = 0, buzzLeft = 3;
  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const skin = () => window.KingdomsSkin || null;
  const muted = () => { const s = skin(); return !!(s && s.isMuted && s.isMuted()); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  // Web Audio for the chase's sounds (his treads every 0.3-1 s, my heartbeat: an <audio> per step would pile up on a
  // cheap phone); a sound not decoded yet, or a phone without Web Audio, plays through the skin's <audio> instead
  const AU = (() => {
    let ac = null;
    const buf = {}, asked = {};
    const ctx = () => { if (!ac) { try { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } catch (_) { ac = null; } } return ac; };
    function load(name) {
      const c = ctx();
      if (!c || asked[name]) return;
      asked[name] = 1;
      fetch(ES + name + '.mp3').then((r) => r.arrayBuffer()).then((b) => new Promise((res) => c.decodeAudioData(b, res, () => res(null))))
        .then((d) => { if (d) buf[name] = d; }).catch(() => { asked[name] = 0; });
    }
    function play(name, vol, rate) {
      if (muted() || !on) return true;
      const c = ctx();
      if (!c || c.state !== 'running' || !buf[name]) return false;
      try {
        const s = c.createBufferSource(); s.buffer = buf[name];
        if (rate) s.playbackRate.value = rate;
        const gn = c.createGain(); gn.gain.value = Math.max(0, Math.min(1, vol));
        s.connect(gn); gn.connect(c.destination); s.start();
        return true;
      } catch (_) { return false; }
    }
    const unlock = () => { const c = ctx(); if (c && c.state === 'suspended') c.resume().catch(() => {}); };
    return { load, play, unlock };
  })();
  const CHASE_SFX = ['step', 'heartbeat', 'zap-crackle', 'siren', 'dash', 'stumble', 'shield', 'trip', 'spark', 'turbo-v2', 'super-v2'];
  // one-off sounds: Web Audio when ready, else the skin's <audio>; the treads and the heartbeat only through Web Audio
  const sfx = (name, vol) => {
    if (name.indexOf('/') !== 0 && AU.play(name, vol == null ? 0.7 : vol)) return;
    const s = skin(); if (s && s.sfx) s.sfx(name.indexOf('/') === 0 ? name : ES + name + '.mp3', vol);
  };
  const onZone = () => !!$('screen-escape') && !$('screen-escape').classList.contains('hidden');
  const questionOpen = () => !!$('screen-question') && !$('screen-question').classList.contains('hidden');
  const zoneNow = () => M.zoneOf(es ? es.route : route, es ? es.level : 1);
  const mySkin = () => (roster[my.idx] && roster[my.idx].skin) || (M ? M.skinFor(localAvatar(), myName()) : 'dralingo');
  const localAvatar = () => {
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    const list = (window.Saga && window.Saga.AVATARS) || [];
    return list.some((a) => a.emoji === v) || (window.Saga && window.Saga.zoco && window.Saga.zoco(v)) ? v : ((list[0] && list[0].emoji) || '🐉');    // player.js getMyAvatar() (🪙 a skin stays)
  };
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  // the phone's clock for the chase: a teacher's pause holds it at the moment it began (the server does the same), so a
  // stun or a shield never runs out during a pause and is never started again from «now» (classroom playtest 2026-10-19)
  const nowC = () => (paused && pausedAt ? pausedAt : now());
  const stunned = () => nowC() < stunUntil;
  const hold = () => { const s = skin(); if (s && s.hold) s.hold(paused || now() < dizzyUntil || stunned()); };

  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('es-on', on);
    if (!on) { stop(); stopStrip(); endStun(true); setEdge(0); document.body.classList.remove('es-dizzy', 'es-pausing', 'es-card-on'); const mp = $('end-personal-score'); if (mp) mp.parentNode.style.display = ''; }
  }

  function init(c) {
    ctx = c;
    if (!M || !R) return;
    const s = c.socket;
    if (skin() && skin().holdWhen) skin().holdWhen(() => on && (paused || now() < dizzyUntil || stunned()));
    // every tap may unlock the phone's audio (browsers start it only from a tap); a tap on a tile closes my question
    document.addEventListener('pointerdown', (e) => {
      if (!on) return;
      AU.unlock();
      if (e.target.closest && e.target.closest('.answer-btn') && !stunned()) myQ = false;
    }, true);
    s.on('answer-stale', () => { if (on && questionOpen()) myQ = true; });
    // the chase pass: my own Robotín
    s.on('es:g', (c) => applyCh(c));
    s.on('es:pzap', (d) => { if (!chFrozen) zapMe(d || {}); });
    s.on('es:lunge', (d) => { if (!chFrozen) lunge(d || {}); });
    s.on('es:trip', () => { if (!chFrozen) trip(); });
    s.on('es:near', () => { if (!chFrozen) nearMe(); });
    s.on('state', (st) => {
      if (st && st.gameType) setOn(st.gameType === 'escape');
      if (st && st.gameType === 'escape' && st.esRoute != null && st.state === 'lobby' && st.esRoute !== route) { route = st.esRoute; paintLobbyRoute(); }
    });
    s.on('es:route', (d) => { if (d && d.route != null) { route = d.route; paintLobbyRoute(); } });
    s.on('es:cast', (cs) => { cast = cs; });
    s.on('countdown', () => { if (!on) return; finished = false; stop(); endStun(true); setEdge(0); ch = { v: 0, sh: 0, lu: 0, lt: 0 }; room = null; zones = []; es = null; my = { idx: 0, turbos: 0, best: 0, streak: 0, safe: 0, waves: 0 }; R.preload([mySkin()], route, M.route(route).zones.slice(0, 1)); });
    s.on('es:init', (d) => {
      setOn(true);
      seed = d.seed;
      if (d.route != null) route = d.route;
      roster = d.players || roster;
      cast = d.cast || cast;
      const fresh = !es || es.round !== d.round;
      applyPublic(d);
      if (fresh) { crewShown = crew; robotShown = robot; }
      if (d.chase) CHC = Object.assign(CHC, d.chase);
      if (fresh) { gap = gapShown = CHC.g0; stunUntil = 0; ch = { v: 0, sh: 0, lu: 0, lt: 0 }; }
      if (d.phase === 'run') wakeUntil = now() + (d.wakeMs || 0);
      CHASE_SFX.forEach((n) => AU.load(n));
      prewarmZap();                                    // (the zap's pictures and halo ready before the first zap)
      R.preload(Object.values(roster).map((p) => p.skin).filter(Boolean).slice(0, 12).concat(['dralingo']), route, [zoneNow().id]);
      if (d.me) applyMe(d.me, true);
      if (d.me && d.me.ch) applyCh(d.me.ch, true);         // (a phone back mid-stun gets its lock back with the time left)
      finished = false;
      if (d.phase === 'zone') enterZone(d);
      else if (room) leaveZone();      // reconnected after a zona segura: the room loop stops
      if (d.phase === 'cleared' || d.phase === 'caught' || d.phase === 'escape') card(d.phase, Math.max(1, (d.level || 1) - (d.phase === 'cleared' ? 1 : 0)));   // joined during a big moment
      mountStrip();
      if (d.phase === 'run' && d.paused) setTimeout(() => { if (paused && !questionOpen() && !onZone()) { ctx.showScreen('escape'); hideBand(); } }, 400);
      if (d.phase === 'run' && d.wakeMs > 1500 && !d.paused) setTimeout(() => band({ kind: 'robo', robot: 'chase', title: '¡Robotín despertó!', sub: 'Cada respuesta correcta es un turbo 🚀', ms: 2200 }), 900);
    });
    s.on('es:roster', (d) => { roster = d.players || roster; });
    s.on('es:me', (m) => applyMe(m, false));
    s.on('es:tick', (d) => {
      if (typeof d.c === 'number') { crew = d.c; robot = d.r; closeFlag = !!d.cl; if (crew > 60 && es && es.phase === 'run') R.roomArt(zoneNow().id); }   // the zona segura's room, before it's needed
      if (d.pos) applyPos(d.pos);
      if (d.occ) { occ = {}; d.occ.forEach(([zid, n, safe]) => { occ[zid] = { n, safe }; }); }    // only sent while a wave is live: the last count stays up after the zap
      if (typeof d.wl === 'number' && d.wl > 0) waveUntil = now() + d.wl;
    });
    // the whole crew caught (rare): the crew slides back and runs slower for 3 s; my tiles stay mine (the chase pass:
    // only MY Robotín stuns me)
    s.on('es:zap', (d) => {
      crew = d.crew; robot = d.robot; crewShown = Math.min(crewShown, crew + 0.5);
      zapAt = performance.now();
      sfx('spark', 0.6); buzz([60, 40, 60]);
      band({ kind: 'zap', robot: 'zap', title: '¡Zap a la tripulación!', sub: '¡Turbos para alejarlo!', ms: 2000 });
    });
    s.on('es:moment', (m) => {
      if (m.type === 'lastmin') { sfx(K + 'castle-alert.mp3', 0.5); buzz([60, 40, 60]); band({ kind: 'time', img: D + 'power.webp', title: '⏱ ¡Último minuto!', sub: es && es.level >= 3 ? '¡El jet de Hamdan está cerca!' : '¡Respondan rápido, equipo!', ms: 2200 }); }
      // («¡Robotín se acerca!» of the whole crew stays on the projector: on my phone it is MY Robotín who comes)
    });
    s.on('es:pause', (d) => { applyPublic(d); });
    s.on('es:phase', (d) => {
      const prev = es && es.phase;
      // the chase lives in the run only: a stun or a shield that spans a zona segura or a card ends there, quietly
      if (d.phase !== 'run') { endStun(true); ch.sh = 0; ch.lu = 0; setEdge(0); }
      applyPublic(d);
      if (d.phase === 'zone') { enterZone(d); if (prev !== 'zone') { sfx('wave', 0.5); } }
      else if (d.phase === 'cleared') { card('cleared', d.clearedLevel, d.heartBack); sfx(K + 'landmark.mp3', 0.75); buzz([40, 30, 40]); }
      else if (d.phase === 'caught') { card('caught'); sfx('zap-crackle', 0.6); }
      else if (d.phase === 'escape') { card('escape'); sfx('jet', 0.7); setTimeout(() => sfx(K + 'sting-win.mp3', 0.7), 1300); buzz([60, 40, 60, 40, 200]); }
      else if (d.phase === 'run') {
        leaveZone();
        crewShown = 0; robotShown = robot;
        gap = gapShown = CHC.g0; stunUntil = 0; ch = { v: 0, sh: 0, lu: 0, lt: 0 }; endStun(true);     // my Robotín: 14 m back
        wakeUntil = now() + (d.wakeMs || 0);
        R.preload([], route, [zoneNow().id]);
        setTimeout(() => band({ kind: 'robo', robot: 'chase', title: d.replay ? '¡Otra vez Robotín!' : `¡Nivel ${d.level}: ${zoneNow().name}!`, sub: d.replay ? 'Ahora corre más rápido: ¡turbos!' : '¡Robotín despertó! ¡Corran!', ms: 2300 }), 400);
      }
    });
    s.on('es:wave', (w) => {
      zones = w.zones || [];
      occ = {};
      waveUntil = now() + w.ms; waveTotal = w.ms;
      if (es) es.wave = w.wave;
      flashAt = 0; zapTargets = [];
      hideCard();
      if ($('es-help')) $('es-help').classList.add('hidden');
      sfx('wave', 0.6); buzz(30);
      const capped = zones.some((z) => z.cap);
      band({ kind: 'safe', img: '/assets/dralingo/hello.webp', title: `Ola ${w.wave} de ${w.waves}: ¡zonas verdes!`, sub: capped ? 'El número es el límite: si está llena, ¡busca otra!' : 'Camina hasta una zona verde antes del zap', ms: 2200 });
      if (w.wave === 1) showHand();
      hud(true);
    });
    s.on('es:wave-end', (r) => {
      flashAt = performance.now();
      zapTargets = r.out.map((i) => (i === my.idx ? (me ? { x: me.x, y: me.y } : null) : others[i])).filter(Boolean);
      if (es) es.hearts = r.hearts;
      if (r.safe.includes(my.idx)) { sfx('safe', 0.75); buzz(40); band({ kind: 'safe', img: R.SKIN_URL(mySkin()), title: '¡A salvo!', sub: r.out.length ? (r.lost ? `El equipo perdió ${r.lost} ❤️` : 'Algunos se quedaron fuera') : '¡Toda la clase a salvo!', ms: 1800 }); }
      else if (r.out.includes(my.idx)) { dizzy(r.dizzyMs || 2000); sfx('zap-crackle', 0.7); buzz([90, 40, 90]); band({ kind: 'zap', robot: 'zap', title: '¡Zap! Te quedaste fuera', sub: 'Cosquillas 2 s. ¡En la próxima ola, a una zona verde!', ms: 2300 }); }
      hud(true);
    });
    s.on('question', () => {
      if (!on) return;
      myQ = true;
      if (stunned()) setTimeout(lockTiles, 0);         // (player.js redraws the tiles: the lock goes back on top)
      if (onZone()) leaveZone();
      setTimeout(mountStrip, 0);
      document.body.classList.toggle('es-dizzy', now() < dizzyUntil);
      hold();
    });
    s.on('game-end', (d) => {
      finished = true;
      stop(); stopStrip(); endStun(true); setEdge(0); hideCard(); paused = false; hideBand(); document.body.classList.remove('es-dizzy', 'es-pausing');
      const ex = d && d.fin && d.fin.extra;
      if (on && ex) document.documentElement.style.setProperty('--es-world-bg', `url("${M.art(M.zoneOf(ex.route || 0, ex.escaped ? 3 : (ex.level || 1)).id, 'bg')}")`);
    });
    // «¡FINAL!» (2026-10-16): the chase stops under the band (it says «¡Se acabó el tiempo!» when the clock ran out); the
    // ceremony follows (js/party.js)
    s.on('fin:final', () => {
      if (!on) return;
      finished = true;
      stop(); stopStrip(); endStun(true); setEdge(0); hideBand(); paused = false; document.body.classList.remove('es-dizzy', 'es-pausing');
      if (es) document.documentElement.style.setProperty('--es-world-bg', `url("${M.art(zoneNow().id, 'bg')}")`);   // the ceremony's backdrop: the place they reached
    });
    // the last 30 s: «¡Súper turbos!» (every right answer is a súper turbo)
    s.on('fin:frenzy', (d) => {
      if (!on || !d || d.off || d.again) return;
      setTimeout(() => sfx('super-v2', 0.6), 1650); buzz([60, 40, 60]);   // (after the «¡Rápido!» jingle, js/party.js)
      band({ kind: 'time', img: D + 'power.webp', title: '🚀 ¡Súper turbos!', sub: 'Últimos 30 s: cada acierto es un súper turbo', ms: 2400 });
    });
    bindControls();
  }

  function applyPublic(d) {
    es = Object.assign(es || {}, d);
    if (typeof d.crew === 'number') { crew = d.crew; robot = d.robot; }
    if (typeof d.close === 'boolean') closeFlag = d.close;
    // (the crew's dizzy no longer locks my tiles: the chase pass; my own dizzy comes in es:me, my stun in my chase)
    if (typeof d.paused === 'boolean' && d.paused !== paused) {
      // my stun, shield, his lunge and his wake wait during a pause too (the server moves them the same way)
      if (d.paused) pausedAt = now();
      else if (pausedAt) {
        const sh = now() - pausedAt;
        pausedAt = 0;
        if (stunUntil) stunUntil += sh;
        if (ch.sh) ch.sh += sh;
        if (ch.lu) ch.lu += sh;
        if (wakeUntil) wakeUntil += sh;
        // still stunned after the pause: the lock is back on my tiles with the time that was left
        if (stunned()) { document.body.classList.add('es-stunned'); if (!$('es-lock')) lockTiles(); clearTimeout(stunT); stunT = setTimeout(endStunIfDue, stunUntil - now() + 30); }
      }
      if (d.paused) pausedLeft = Math.max(0, waveUntil - now());
      paused = d.paused;
      document.body.classList.toggle('es-pausing', paused);
      if ($('es-pause')) $('es-pause').classList.toggle('hidden', !paused);
      // the zona segura has its own pause card; on a question the band says it (and the tiles wait)
      if (paused) { setJoy(-1); if (!onZone()) band({ kind: 'time', img: D + 'wise.webp', title: '⏸ Pausa', sub: 'Mira al profe', hold: true }); }
      else hideBand();
      hold();
    }
    if (d.zones) zones = d.zones;
    if (d.waveMs) { waveUntil = now() + d.waveMs; waveTotal = d.waveTotalMs || d.waveMs; }
  }
  function applyMe(m, quiet) {
    ['idx', 'turbos', 'best', 'streak', 'safe', 'waves'].forEach((k) => { if (m[k] !== undefined) my[k] = m[k]; });
    if (typeof m.dizzyMs === 'number' && m.dizzyMs > 0) dizzy(m.dizzyMs, true);
    if (m.pos && me) { me.x = m.pos[0]; me.y = m.pos[1]; lastSent = null; }
    if (typeof m.x === 'number' && (!me || quiet)) me = { x: m.x, y: m.y, f: 2 };
    if (!quiet) hud(true);
  }
  function dizzy(ms, quiet) {
    dizzyUntil = Math.max(dizzyUntil, now() + ms);
    document.body.classList.add('es-dizzy');
    hold();
    clearTimeout(dizzy.t);
    dizzy.t = setTimeout(() => { if (now() >= dizzyUntil) { document.body.classList.remove('es-dizzy'); hold(); hud(true); } }, Math.max(50, dizzyUntil - now() + 30));
    if (!quiet) hud(true);
  }

  // ---------- the chase pass: MY Robotín ----------
  // the server's numbers (es:g, es:init me.ch): his distance, his base speed, ms left of my stun / shield / his lunge
  let chFrozen = false;                               // (test screenshots: EscapePhone.chase() holds a staged chase)
  function applyCh(c, quiet) {
    if (!c || typeof c.g !== 'number' || chFrozen) return;
    const t = nowC();
    lastGAt = performance.now();
    // (the first 0.95 s of a zap he stays right on me, whatever the server's reset says: then he is bounced back)
    if (performance.now() - zapMeAt >= 950) {
      gap = c.g;
      if (quiet || (Math.abs(gapShown - gap) > 6 && performance.now() - zapMeAt > 2500)) gapShown = gap;   // (after a zap: he glides back)
    }
    ch.v = c.v || 0;
    ch.sh = c.sh ? t + c.sh : 0;
    ch.lu = c.lu ? t + c.lu : 0;
    ch.lt = c.lt || 0;
    if (c.st > 0 && !stunned()) startStun(c.st);              // a phone back mid-stun: the lock with the time left
  }
  // he comes closer only while my question is open (the server decides; v is 0 otherwise)
  // (and only while the server is really talking to me: a Wi-Fi drop never plays a chase nobody is running)
  const live = () => chFrozen || (performance.now() - lastGAt < 1200 && !!(ctx && ctx.socket && ctx.socket.connected));
  const closing = () => !!(es && es.phase === 'run' && !paused && !finished && myQ && ch.v > 0 && questionOpen() && !stunned() && now() >= ch.sh && now() >= wakeUntil && live());
  const danger = (gm) => Math.max(0, Math.min(1, (12 - gm) / 11.5));      // 0 far … 1 right behind me
  // every frame of the strip: glide him closer (the same formula as the server between its numbers) and play the fear:
  // his treads faster and louder as he nears, my heartbeat under 7 m (a light buzz with it under 4 m), red screen edges
  let nextStep = 0, nextBeat = 0;
  function chaseTick(dt, ms) {
    const t = now();
    const moving = closing();
    if (moving && !chFrozen) {
      let v = ch.v;
      if (t < ch.lu) v = v * CHC.lx + Math.max(0, gap - (ch.lt || 6)) * CHC.lk;
      gap = Math.max(0.3, gap - v * dt);                       // (reaching me is the server's call: es:pzap)
    }
    gapShown += (gap - gapShown) * Math.min(1, dt * (gap > gapShown ? 5 : 9));
    if (!moving) { setEdge(0); nextStep = Math.max(nextStep, ms + 250); return; }
    const d = danger(gap);
    if (ms >= nextStep) {
      AU.play('step', 0.1 + 0.55 * d, 0.94 + 0.12 * d + Math.random() * 0.05);
      nextStep = ms + (950 - 680 * d) * (t < ch.lu ? 0.55 : 1);
    }
    if (gap < CHC.warn) {
      const dd = Math.max(0, Math.min(1, (CHC.warn - gap) / (CHC.warn - 0.5)));
      if (ms >= nextBeat) {
        AU.play('heartbeat', 0.35 + 0.55 * dd, 1);
        if (gap < CHC.near && buzzLeft > 0) { buzzLeft--; buzz(22); }     // (a light buzz on the first 3 beats of each approach)
        nextBeat = ms + 880 - 440 * dd;
      }
    } else nextBeat = Math.max(nextBeat, ms + 150);
    if (gap > CHC.near + 3) buzzLeft = 3;
    setEdge(gap < CHC.near ? 3 : gap < CHC.warn ? 2 : d > 0.3 ? 1 : 0);
  }
  // the red edges of the screen (one fixed layer UNDER the question and the tiles; only its class changes)
  function setEdge(lv) {
    if (lv === edgeLv) return;
    edgeLv = lv;
    let el = $('es-edge');
    if (!el) {
      if (!lv) return;
      el = document.createElement('div'); el.id = 'es-edge'; el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    el.className = 'es-edge' + (lv ? ' lv' + lv : '');
    if (strip) strip.classList.toggle('danger', lv >= 2);
  }
  // he reached me: the full-screen zap on MY phone, then my tiles locked with a countdown (my question's clock waits),
  // then my shield (he waits). Never out of play: the same question is mine again after the lock.
  function zapMe(d) {
    if (!on || finished) return;
    zapMeAt = performance.now();
    gap = gapShown = 0.3;                                      // he is right on me while the lightning hits …
    const back = typeof d.g === 'number' ? d.g : CHC.g0;
    setTimeout(() => { if (performance.now() - zapMeAt >= 850) gap = Math.max(gap, back); }, 900);   // … then bounced back
    startStun(d.stunMs || 1800, d.shieldMs || 3500);
    sfx('zap-crackle', 0.9);
    buzz([120, 50, 160, 50, 240]);
    setEdge(0);
    zapFx();
  }
  function startStun(ms, shieldMs) {
    stunMs = ms;
    stunUntil = nowC() + ms;
    if (shieldMs) ch.sh = stunUntil + shieldMs;
    if (questionOpen()) myQ = true;                            // the question stays mine
    document.body.classList.add('es-stunned');
    lockTiles();
    hold();
    clearTimeout(stunT);
    stunT = setTimeout(endStunIfDue, ms + 30);
  }
  function endStunIfDue() {
    clearTimeout(stunT);
    if (paused) { stunT = setTimeout(endStunIfDue, 250); return; }      // (a pause holds the stun: the resume moves it)
    if (now() >= stunUntil) endStun(false);
    else stunT = setTimeout(endStunIfDue, stunUntil - now() + 30);
  }
  function endStun(silent) {
    clearTimeout(stunT);
    if (silent) stunUntil = 0;
    document.body.classList.remove('es-stunned');
    const lk = $('es-lock');
    if (lk) lk.remove();
    hold();
    if (!silent && on && !finished && now() < ch.sh) { shieldAt = performance.now(); sfx('shield', 0.55); buzz(30); }
  }
  // the lock over my tiles: a draining ring with the seconds left, «¡Zap! Espera…» (my tiles show through, grey)
  function lockTiles() {
    const box = document.querySelector('#screen-question .answers');
    if (!box) return;
    let lk = $('es-lock');
    if (!lk) { lk = document.createElement('div'); lk.id = 'es-lock'; lk.className = 'es-lock'; lk.setAttribute('role', 'status'); }
    lk.innerHTML = '<div class="es-lock-ring"><b></b></div><span>¡Zap! Espera…</span>';
    lk.style.setProperty('--es-lock-ms', Math.max(200, stunUntil - nowC()) + 'ms');
    box.appendChild(lk);
    const b = lk.querySelector('b');
    const tick = () => {
      if (!lk.isConnected) return;
      const left = Math.max(0, stunUntil - nowC());
      const txt = String(Math.max(1, Math.ceil(left / 1000)));
      if (b.textContent !== txt) b.textContent = txt;
      if (left > 0) setTimeout(tick, 120);
    };
    tick();
  }
  // the full-screen electric moment (~0.95 s): one canvas, my full-body character hit by lightning from Robotín, sparks,
  // a single soft flash (no strobe; reduced motion: one still frame, no flash, no shake). holdU = a test still.
  let zfxRaf = 0, zfxT = 0;
  function zapFx(holdU) {
    let el = $('es-zapfx');
    if (!el) {
      el = document.createElement('div'); el.id = 'es-zapfx'; el.className = 'es-zapfx'; el.setAttribute('role', 'alert');
      el.innerHTML = '<canvas></canvas><div class="es-zapfx-words"><b>¡ZAP!</b><span>¡Robotín te alcanzó!</span></div>';
      document.body.appendChild(el);
    }
    clearTimeout(zfxT);
    el.classList.remove('out'); el.style.display = '';
    const c = el.querySelector('canvas');
    const W = window.innerWidth, H = window.innerHeight;          // (one size read when it starts, never per frame)
    const dp = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(W * dp); c.height = Math.round(H * dp);
    const g2 = c.getContext('2d');
    const skinNow = mySkin();
    const sparks = [];
    for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2; sparks.push({ a, v: 0.25 + Math.random() * 0.55, l: 6 + Math.random() * 14, c: ['#ffffff', '#7ff6ff', '#ffd23f'][i % 3] }); }
    const t0 = performance.now(), DUR = 950, still_ = reduced();
    const frame = (ts) => {
      const u = holdU != null ? holdU : (still_ ? 0.45 : Math.min(1, (ts - t0) / DUR));
      drawZapFx(g2, W, H, dp, u, ts, skinNow, sparks, still_ || holdU != null);
      if (holdU == null && !still_ && u < 1 && el.isConnected) zfxRaf = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(zfxRaf);
    frame(t0);
    if (holdU == null) {
      zfxT = setTimeout(() => {
        el.classList.add('out');
        zfxT = setTimeout(() => { if (el.classList.contains('out')) hideZapFx(); }, still_ ? 0 : 220);
      }, still_ ? 1100 : DUR);
    }
  }
  // hidden = its full-screen canvas gives its memory back (~5 MB on a phone at 2×)
  function hideZapFx() {
    const el = $('es-zapfx');
    if (!el) return;
    cancelAnimationFrame(zfxRaf);
    el.style.display = 'none';
    const c = el.querySelector('canvas');
    if (c) { c.width = 0; c.height = 0; }
  }
  // my character's electric halo, drawn once into a sprite when the picture is ready (no blur per frame on a cheap phone)
  let glowSprite = null;
  function glowOf(fb, meH) {
    const key = fb.src + '|' + Math.round(meH);
    if (glowSprite && glowSprite.key === key) return glowSprite;
    const w = meH * fb.naturalWidth / fb.naturalHeight, pad = Math.round(meH * 0.12);
    const c = document.createElement('canvas');
    c.width = Math.round(w + pad * 2); c.height = Math.round(meH + pad * 2);
    const x = c.getContext('2d');
    x.shadowColor = '#7ff6ff'; x.shadowBlur = pad * 0.9;
    for (let i = 0; i < 3; i++) x.drawImage(fb, pad, pad, w, meH);
    x.shadowBlur = 0; x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#9ff8ff'; x.fillRect(0, 0, c.width, c.height);
    glowSprite = { key, c, pad };
    return glowSprite;
  }
  // load the zap's pictures (my hit pose, his chase look) and draw my halo sprite now, so the first zap lands at once
  function prewarmZap() {
    const url = R.BODY_URL(mySkin(), 'no');
    R.img('/assets/escape/robotin/chase.webp');
    const build = () => {
      const fb = R.img(url);
      if (!R.ready(fb)) return;
      const H = window.innerHeight, W = window.innerWidth;
      const go = () => { try { glowOf(fb, Math.min(H * 0.44, W * 0.95)); } catch (_) {} };
      if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 400);
    };
    if (R.ready(R.img(url))) build(); else R.onLoad(url, 'es-zap-prewarm', build);
  }
  function drawZapFx(g2, W, H, dp, u, ts, skinNow, sparks, still_) {
    g2.setTransform(dp, 0, 0, dp, 0, 0);
    g2.clearRect(0, 0, W, H);
    const meH = Math.min(H * 0.44, W * 0.95), mx = W * 0.5, my = H * 0.86;
    const shake = still_ ? 0 : Math.sin(ts * 0.09) * 7 * (1 - u);
    // Robotín on the left as he caught me: his chase look, eyes glowing red in a red glow, his antenna crackling (the
    // lightning comes from it), all of him on the screen
    const rs = Math.min(H * 0.24, W * 0.44);
    const pic = R.img('/assets/escape/robotin/chase.webp');
    const rh = rs * 1.08, rw = R.ready(pic) ? rh * pic.naturalWidth / pic.naturalHeight : rh;
    const rx = Math.max(rw / 2 + 6, W * 0.25), ry = H * 0.45;
    const au = g2.createRadialGradient(rx, ry - rh * 0.5, rh * 0.1, rx, ry - rh * 0.5, rh * 0.95);
    au.addColorStop(0, 'rgba(240,68,58,.5)'); au.addColorStop(1, 'rgba(240,68,58,0)');
    g2.fillStyle = au; R.ell(g2, rx, ry - rh * 0.5, rh * 0.95, rh * 0.95); g2.fill();
    R.robotin(g2, rx, ry, rs, { t: ts / 1000, mood: 'chase', glitch: false, eyes: 1 });
    // my full body, hit (the dizzy pose), shaking, in an electric halo that flickers
    const im = R.img(R.BODY_URL(skinNow, 'no'));
    const fb = R.ready(im) ? im : R.img(R.SKIN_URL(skinNow));
    if (R.ready(fb)) {
      const w = meH * fb.naturalWidth / fb.naturalHeight;
      const gs = glowOf(fb, meH);
      g2.save();
      g2.translate(mx + shake, my);
      if (!still_) g2.rotate(Math.sin(ts * 0.05) * 0.06 * (1 - u));
      g2.globalAlpha = still_ ? 0.9 : 0.6 + 0.4 * Math.abs(Math.sin(ts * 0.045));
      g2.drawImage(gs.c, -w / 2 - gs.pad, -meH - gs.pad);
      g2.globalAlpha = 1;
      g2.drawImage(fb, -w / 2, -meH, w, meH);
      g2.restore();
    }
    // lightning from his antenna to me, a new zigzag every 60 ms (the brightest first), and little arcs crackling on me
    const seed = still_ ? 7 : Math.floor(ts / 60);
    const tipX = rx - rw / 2 + rw * 0.616, tipY = ry - rh + rs * 0.02 + rh * 0.139;      // (the antenna bulb of chase.webp)
    const tg = g2.createRadialGradient(tipX, tipY, 0, tipX, tipY, rs * 0.22);
    tg.addColorStop(0, 'rgba(220,252,255,.95)'); tg.addColorStop(1, 'rgba(127,246,255,0)');
    g2.fillStyle = tg; R.ell(g2, tipX, tipY, rs * 0.22, rs * 0.22); g2.fill();
    const targets = [[mx, my - meH * 0.62], [mx - meH * 0.18, my - meH * 0.35], [mx + meH * 0.16, my - meH * 0.82], [mx + meH * 0.2, my - meH * 0.3]];
    targets.forEach(([x2, y2], i) => R.zap(g2, tipX, tipY, x2 + shake, y2, i ? 3 : 5.5, seed * 7 + i * 31));
    let s = seed * 13 + 5;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 7; i++) {
      const a = rnd() * Math.PI * 2, cx = mx + shake + Math.cos(a) * meH * 0.3, cy = my - meH * 0.5 + Math.sin(a) * meH * 0.42;
      const b = a + 0.8 + rnd() * 0.8;
      R.zap(g2, cx, cy, mx + shake + Math.cos(b) * meH * 0.32, my - meH * 0.5 + Math.sin(b) * meH * 0.44, 2, seed * 3 + i * 19);
    }
    // sparks flying off me
    g2.lineCap = 'round';
    sparks.forEach((s) => {
      const r0 = meH * 0.2 + u * meH * s.v * 1.2;
      const x = mx + Math.cos(s.a) * r0, y = my - meH * 0.55 + Math.sin(s.a) * r0 * 0.8;
      g2.globalAlpha = Math.max(0, 1 - u * 0.9);
      g2.strokeStyle = s.c; g2.lineWidth = 3;
      g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x - Math.cos(s.a) * s.l, y - Math.sin(s.a) * s.l * 0.8); g2.stroke();
    });
    g2.globalAlpha = 1;
    // one soft flash as it lands (never with reduced motion)
    if (!still_ && u < 0.14) { g2.fillStyle = `rgba(255,255,255,${0.75 * (1 - u / 0.14)})`; g2.fillRect(0, 0, W, H); }
  }
  // his lunge: a siren, a buzz, his antenna flashing; he swoops in (es:g carries the swoop)
  function lunge(d) {
    ch.lu = now() + (d.ms || 1800);
    if (!on || finished || !questionOpen()) return;
    sfx('siren', 0.5);
    buzz([50, 50, 50]);
  }
  // he reached me inside his 45 s (or out of breath after a lunge): he trips back (relief)
  function trip() {
    if (!on || finished) return;
    tripAt = performance.now();
    gap = Math.max(gap, 6);
    sfx('trip', 0.6);
  }
  // under 4 m: «¡Está detrás de ti!» (the strip's pill and a tag over him, a buzz; the heartbeat is already on)
  function nearMe() {
    if (!on || finished || !questionOpen()) return;
    nearAt = performance.now();
    buzz([40, 30, 40]);
  }

  // ---------- the chase strip (on top of the question and the result) ----------
  let strip = null, sc = null, sg = null, sRaf = 0, sLast = 0, sKey = '';
  function makeStrip() {
    strip = document.createElement('div');
    strip.className = 'es-strip'; strip.id = 'es-strip';
    strip.setAttribute('role', 'img');
    strip.innerHTML = '<canvas class="es-strip-c"></canvas>'
      + '<div class="es-strip-info"><span class="es-strip-hearts" id="es-strip-hearts"></span><span class="es-strip-gap" id="es-strip-gap"></span>'
      + '<b class="es-strip-place" id="es-strip-place"></b></div>';
    sc = strip.querySelector('canvas');
    sg = sc.getContext('2d');
  }
  // the strip lives at the top of whichever screen shows: the question or the result
  function mountStrip() {
    if (!on || !es || finished) return;
    if (!strip) makeStrip();
    const host = questionOpen() ? $('screen-question') : ($('screen-result') && !$('screen-result').classList.contains('hidden') ? $('screen-result') : null);
    if (!host) { stopStrip(); return; }
    if (strip.parentNode !== host) host.prepend(strip);
    sizeStrip();
    paintStripHud(true);
    if (!sRaf) { sLast = 0; sRaf = requestAnimationFrame(stripLoop); }
  }
  function stopStrip() { cancelAnimationFrame(sRaf); sRaf = 0; setEdge(0); }      // (the red edges never outlive the strip)
  let sW = 0, sH = 0, sD = 1;       // the strip's css size and pixel ratio, measured on mount / resize only (no layout read per frame)
  function sizeStrip() {
    if (!sc) return;
    const r = sc.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    sD = Math.min(2, window.devicePixelRatio || 1);
    sW = r.width; sH = r.height;
    const w = Math.round(sW * sD), h = Math.round(sH * sD);
    if (sc.width !== w || sc.height !== h) { sc.width = w; sc.height = h; }
  }
  window.addEventListener('resize', () => { if (strip && strip.isConnected) sizeStrip(); });
  // a phone that wakes up (screen unlocked) starts the strip again
  document.addEventListener('visibilitychange', () => { if (!document.hidden && on && !finished) mountStrip(); });
  function stripLoop(ts) {
    sRaf = 0;
    if (!strip || !strip.isConnected || !on || !es || finished) return;
    const host = strip.parentNode;
    if (!host || host.classList.contains('hidden')) return;
    sRaf = requestAnimationFrame(stripLoop);
    if (ts - sLast < (paused ? 250 : 30)) return;     // ~30 fps is plenty on a cheap phone (4 while the teacher pauses)
    if (performance.now() - zapMeAt < 960) return;    // (the full-screen zap covers it: no drawing underneath)
    const dt = Math.min(0.1, (ts - (sLast || ts)) / 1000);
    sLast = ts;
    drawStrip(ts, dt);
  }
  function crewmates() {
    // up to four crewmates around me: the kids who joined just before and after me (the same ones every time)
    const ids = Object.keys(roster).map(Number).filter((i) => i !== my.idx && roster[i] && roster[i].on !== false).sort((a, b) => a - b);
    if (!ids.length) return [];
    const at = ids.findIndex((i) => i > my.idx);
    const k = at < 0 ? ids.length : at;
    const pick = [];
    for (let d = 0; pick.length < Math.min(4, ids.length) && d < ids.length; d++) {
      const a = ids[(k + d) % ids.length], b = ids[(k - 1 - d + ids.length * 4) % ids.length];
      if (!pick.includes(a)) pick.push(a);
      if (pick.length < 4 && !pick.includes(b)) pick.push(b);
    }
    return pick.slice(0, 4).map((i) => ({ idx: i, skin: roster[i].skin || 'dralingo' }));
  }
  // my crewmates run just ahead of me (x, y × my size): behind me is Robotín's lane
  const SLOTS = [[0.62, -0.13], [1.02, -0.18], [1.4, -0.1], [0.3, -0.24]];
  function drawStrip(ts, dt) {
    if (!sg || !es) return;
    if (!sW) sizeStrip();
    if (!sW) return;
    const d = sD, W = sW, H = sH, t = ts / 1000;
    const a = Math.min(1, dt * 6);
    crewShown += (crew - crewShown) * a;
    robotShown += (robot - robotShown) * a;
    if (es.phase === 'run') chaseTick(dt, ts);
    const z = zoneNow();
    const L = es.L || 100;
    const pn = performance.now();
    sg.setTransform(d, 0, 0, d, 0, 0);
    const scn = R.scene(sg, { zone: z, W, H, crew: crewShown + ((es.level || 1) - 1) * L, groundFrac: 0.56, feetFrac: 0.14, pxm: PXM, bgPxm: 0.6, bgMinW: 1.15, bgFocus: 0.6 });
    const base = scn.feetY;
    const size = H * 0.52;
    const meX = W * 0.56;
    // the goal: the next place's gate or the jet, in the last metres
    const gx = meX + (L - crewShown) * PXM + 26;
    if (gx < W + 200) R.goal(sg, z, gx, base + 1, z.exit === 'jet' ? H * 0.42 : H * 0.86, t);
    // the chase pass: MY Robotín behind me at MY distance (16 m = the strip's left edge), bigger and redder-eyed as he
    // nears; his antenna a siren in a lunge; dizzy when he trips; waiting while my shield is up
    const gS = Math.max(0, gapShown);
    const dg = danger(gS);
    const pxm = Math.max(4, (meX - size * 0.62 - W * 0.06) / CHC.gmax);
    const rs = H * (0.62 + 0.4 * dg);
    const rx = Math.max(rs * 0.14, meX - size * 0.62 - gS * pxm);
    const zapMe_ = pn - zapMeAt < 1000;
    const zapping = zapMe_ || pn - zapAt < 900;
    const tripping = pn - tripAt < 1300;
    const shielded = now() < ch.sh && !stunned();
    const lunging = now() < ch.lu && es.phase === 'run';
    if (dg > 0.35 && !shielded) {                       // a red glow behind him when he is close
      const ay = base - rs * 0.45, ar = rs * 0.95;
      const au = sg.createRadialGradient(rx, ay, ar * 0.1, rx, ay, ar);
      au.addColorStop(0, `rgba(240,68,58,${Math.min(0.55, (dg - 0.35) * 0.9)})`); au.addColorStop(1, 'rgba(240,68,58,0)');
      sg.fillStyle = au; R.ell(sg, rx, ay, ar, ar); sg.fill();
    }
    const mood = zapMe_ ? 'chase' : zapping ? 'zap' : tripping ? 'dizzy' : shielded ? 'idle' : 'chase';     // (he caught ME: his red-eyed chase look)
    R.robotin(sg, rx, base + 3, rs, { t: lunging ? t * 1.6 : t, mood, moving: closing() || lunging, glitch: true, eyes: zapMe_ ? 1 : mood === 'chase' ? Math.max(0, (dg - 0.25) / 0.55) : 0, siren: lunging && mood === 'chase' });
    // my dash (a right answer): a thin speed trail under everyone, me jumping ahead (never off the strip)
    const u = dashHoldU != null ? dashHoldU : (pn - dashAt) / 900;
    const dash = u >= 0 && u < 1 ? Math.sin(u * Math.PI) * size * (dashSuper ? 1.35 : 0.9) : 0;
    const mx = Math.min(meX + dash, W * 0.76);
    if (dash > 2) {
      sg.save(); sg.globalAlpha = Math.min(1, dash / size) * 0.9; sg.lineCap = 'round';
      for (let i = 0; i < 3; i++) { sg.strokeStyle = dashSuper ? (i % 2 ? '#ff8a1f' : '#ffd23f') : 'rgba(255,255,255,.95)'; sg.lineWidth = dashSuper ? 3.5 : 2.5; const yy = base - size * (0.3 + i * 0.18); sg.beginPath(); sg.moveTo(mx - size * 0.28, yy); sg.lineTo(mx - size * 0.28 - (mx - meX + size * 0.4) * (0.9 + i * 0.15), yy); sg.stroke(); }
      sg.restore();
    }
    // my crewmates (ahead of me), then me (biggest, with «TÚ»): dizzy when zapped or stumbling, a bubble with my shield
    const dz = now() < dizzyUntil;
    crewmates().forEach((k, i) => {
      const [ox, oy] = SLOTS[i];
      R.kid(sg, { x: meX + ox * size + Math.sin(t * 1.7 + i) * 3, y: base + oy * size, skin: k.skin, idx: k.idx, moving: !paused, f: 0 }, size * 0.68, t);
    });
    const stumbling = pn - stumbleAt < 650;
    const shieldA = shielded ? Math.min(1, (ch.sh - now()) / 500) : 0;
    const meK = { x: mx, y: base, skin: mySkin(), idx: my.idx, moving: !paused && !stunned(), dizzy: dz || stunned() || stumbling, cheer: dash > 2, me: true, name: 'TÚ', f: 0, shield: shieldA > 0 ? shieldA : 0 };
    R.kid(sg, meK, size, t);
    R.tag(sg, meK, size, 1, 12, 'TÚ');
    if (zapping) {
      // (my zap comes from his antenna, as on the full-screen moment; the crew's from his broom)
      const ph = rs * 1.08, pw = ph * 367 / 360;
      const sx = zapMe_ ? rx - pw / 2 + pw * 0.616 : rx + rs * 0.45, sy = zapMe_ ? base + 3 - ph + rs * 0.02 + ph * 0.139 : base - rs * 0.62;
      R.zap(sg, sx, sy, mx, base - size * 0.5, zapMe_ ? 4 : 3, reduced() ? 7 : Math.floor(ts / 50));     // (reduced motion: one still zigzag)
    }
    // «+7 m» rising over me after a dash; «¡Detrás de ti!» over him when he is right behind me
    if (u >= 0 && u < 1 && lastDashM > 0) {
      sg.save(); sg.globalAlpha = Math.max(0, 1 - u); sg.font = "800 15px 'Baloo 2', Nunito, sans-serif"; sg.textAlign = 'center';
      sg.lineWidth = 4; sg.strokeStyle = R.INK; const ty = base - size * 0.95 - u * 14, tx = Math.min(W - 30, mx + size * 0.62);   // (beside me: «TÚ» stays clear)
      sg.strokeText(`+${fmtM(lastDashM)} m`, tx, ty); sg.fillStyle = '#ffd23f'; sg.fillText(`+${fmtM(lastDashM)} m`, tx, ty); sg.restore();
    }
    if (gS < CHC.near && !zapping && !shielded && es.phase === 'run' && H >= 110) {      // (a short strip: the pill says it)
      const label = '¡Detrás de ti!';
      sg.font = "800 13px 'Baloo 2', Nunito, sans-serif";
      // over his shoulder, on his side (my «TÚ» stays clear)
      const tw = sg.measureText(label).width + 14, tx = Math.max(tw / 2 + 4, Math.min(mx - size * 0.45 - tw / 2, rx - rs * 0.1)), ty = Math.max(13, base - rs * 0.98);
      const pop = reduced() ? 1 : 1 + 0.06 * Math.sin(t * 12);
      sg.save(); sg.translate(tx, ty); sg.scale(pop, pop);
      sg.fillStyle = R.DANGER; R.rr(sg, -tw / 2, -11, tw, 22, 11); sg.fill(); sg.strokeStyle = R.INK; sg.lineWidth = 2; sg.stroke();
      sg.fillStyle = '#fff'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText(label, 0, 1);
      sg.restore();
    }
    paintStripHud(false);
  }
  const fmtM = (m) => String(Math.round(m * 10) / 10).replace('.', ',');
  // the row under the strip: hearts · MY Robotín (what he is doing to me, in words) · the place
  function chaseWords() {
    const pn = performance.now();
    if (!es || es.phase !== 'run') return ['', ''];
    if (stunned()) return ['⚡ ¡Zap! Espera…', 'zap'];
    if (nowC() < ch.sh) return ['🛡️ ¡Escudo! Responde', 'shield'];
    if (pn - tripAt < 1600) return ['😵 ¡Robotín tropezó!', 'ok'];
    if (nowC() < wakeUntil) return ['😴 Robotín despierta…', ''];
    if (nowC() < ch.lu) return ['🚨 ¡Robotín acelera!', 'danger'];
    const gm = Math.max(0, Math.round(gap));
    if (gap < CHC.near || (pn - nearAt < 1200 && gap < CHC.warn)) return ['😱 ¡Está detrás de ti!', 'danger'];
    if (gap < CHC.warn) return [`🤖 ¡Está a ${gm} m!`, 'warn'];
    return [`🤖 Robotín a ${gm} m`, ''];
  }
  function paintStripHud(force) {
    if (!strip || !es) return;
    const z = zoneNow();
    const [words, cls] = chaseWords();
    const key = [z.id, es.level, words, es.hearts, paused].join('|');
    if (!force && key === sKey) return;
    sKey = key;
    strip.classList.toggle('close', cls === 'danger');
    $('es-strip-place').textContent = `${es.level || 1}/3 · ${z.short || z.name}`;     // (the counter first: a long pill cuts the name, never the 2/3)
    const gp = $('es-strip-gap');
    gp.textContent = words || '🤖 Robotín';
    gp.className = 'es-strip-gap' + (cls ? ' ' + cls : '');
    hearts($('es-strip-hearts'));
    strip.setAttribute('aria-label', `${z.name}, nivel ${es.level || 1} de 3. ${words.replace(/^\S+\s/, '')}.`);
  }
  function hearts(box) {
    if (!box || !es) return;
    const h = typeof es.hearts === 'number' ? es.hearts : 5;
    const key = 'h' + h;
    if (box.dataset.k === key) return;
    box.dataset.k = key;
    box.innerHTML = '';
    for (let i = 0; i < 5; i++) { const s = document.createElement('i'); s.textContent = '❤️'; if (i >= h) s.className = 'off'; box.appendChild(s); }
    box.setAttribute('aria-label', `${h} corazones`);
  }

  // ---------- the result (called by the skin): the strip stays on top; my dash happens in it ----------
  function result(box, correct, correctText, r) {
    const e = (r && r.escape) || {};
    box.innerHTML = '';
    myQ = false;
    setTimeout(mountStrip, 0);
    // the chase pass: my own Robotín — a right answer = I dash away (the gap opens in the strip, a whoosh of relief), a
    // wrong one = I stumble and he gains (a thud, his motor revs)
    const hasGap = typeof e.gap === 'number' && es && es.phase === 'run';
    if (hasGap) {
      lastDashM = correct ? Math.max(0, e.gap - (typeof e.from === 'number' ? e.from : e.gap)) : 0;
      gap = e.gap;
      if (correct) { sfx('dash', 0.55); if (typeof e.from === 'number' && e.from < CHC.near) buzz([20, 30, 20]); }
      else { stumbleAt = performance.now(); sfx('stumble', 0.5); }
    }
    const chaseLine = () => {
      if (!hasGap) return null;
      const l = document.createElement('div');
      l.className = 'es-res-chase' + (correct ? ' ok' : ' no');
      const gm = Math.max(0, Math.round(e.gap));
      l.textContent = correct
        ? (typeof e.from === 'number' && e.from < CHC.near ? `😅 ¡Por un pelo! Robotín a ${gm} m` : `💨 ¡Lo alejaste! Robotín a ${gm} m`)
        : `🤖 Robotín se acercó: a ${gm} m`;
      return l;
    };
    if (correct && e.turbo) {
      dashAt = performance.now(); dashSuper = !!e.super;
      const word = document.createElement('div');
      word.className = 'es-turbo-word' + (e.super ? ' super' : '');
      word.textContent = e.super ? '¡Súper turbo! 🔥' : '¡Turbo! 🚀';
      const sub = document.createElement('div');
      sub.className = 'kdp-res-sub';
      sub.textContent = e.super ? `¡Racha de ${e.streak}! La tripulación vuela` : (e.streak % 3 === 2 ? '🔥 ¡Una más y súper turbo!' : '¡Tu turbo empuja a la tripulación!');
      const meI = document.createElement('img');
      meI.className = 'es-res-me'; meI.alt = ''; meI.src = R.BODY_URL(mySkin(), 'ok');
      meI.onerror = () => { meI.onerror = null; meI.src = R.SKIN_URL(mySkin()); };
      const trail = document.createElement('i'); trail.className = 'es-res-trail' + (e.super ? ' super' : '');
      box.append(meI, trail, word, sub);
      const cl = chaseLine(); if (cl) box.appendChild(cl);
      if (e.streak >= 2) { const fl = document.createElement('div'); fl.className = 'kdp-streak'; fl.textContent = `🔥 Racha de ${e.streak}`; box.appendChild(fl); }
      sfx(e.super ? 'super-v2' : 'turbo-v2', 0.5);
      buzz(e.super ? [30, 30, 30, 30, 60] : [30, 40, 30]);
    } else if (correct) {
      const t = document.createElement('div'); t.className = 'kdp-res-title ok'; t.textContent = '¡Correcto!';
      box.append(stillPose('thumbsup'), t);
      const cl = chaseLine(); if (cl) box.appendChild(cl);
    } else {
      const t = document.createElement('div'); t.className = 'kdp-res-title no';
      t.textContent = r && r.timeUp ? '¡Se acabó el tiempo!' : '¡Casi!';
      const sub = document.createElement('div'); sub.className = 'kdp-res-sub'; sub.textContent = 'La respuesta era';
      const ans = document.createElement('div'); ans.className = 'kdp-res-answer'; ans.textContent = correctText || '';
      const cl = chaseLine();
      const again = document.createElement('div'); again.className = 'kdp-res-sub'; again.textContent = cl ? '¡La próxima, a alejarlo!' : 'Sin turbo esta vez: ¡la próxima!';
      box.append(stillPose('wise'), t, sub, ans);
      if (cl) box.appendChild(cl);
      box.appendChild(again);
    }
  }
  function stillPose(n) { const i = document.createElement('img'); i.className = 'kdp-sticker'; i.alt = ''; i.src = D + n + '.webp'; return i; }

  // ---------- phone-sized moments: a band (never over the tiles) ----------
  let bandTimer = null;
  function band(o) {
    let el = $('es-band');
    if (!el) { el = document.createElement('div'); el.id = 'es-band'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    const inStrip = !onZone() && strip && strip.isConnected && strip.parentNode && !strip.parentNode.classList.contains('hidden');
    const host = inStrip ? strip : document.body;
    if (el.parentNode !== host) host.appendChild(el);
    el.className = 'es-band ' + (o.kind || '') + (onZone() ? ' onzone' : '') + (inStrip ? ' instrip' : '');
    document.body.classList.toggle('es-band-zone', !!onZone());
    el.innerHTML = '';
    if (o.robot) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128; el.appendChild(c);
      const drawR = () => { const g2 = c.getContext('2d'); g2.clearRect(0, 0, 128, 128); R.robotin(g2, 60, 122, 108, { t: performance.now() / 1000, mood: o.robot, glitch: false }); };
      drawR(); R.onRobot(o.robot, c, drawR);
    } else if (o.img) { const i = document.createElement('img'); i.src = o.img; i.alt = ''; el.appendChild(i); }
    const w = document.createElement('div');
    const b = document.createElement('b'); b.textContent = o.title || '';
    const s = document.createElement('span'); s.textContent = o.sub || '';
    w.append(b, s); el.appendChild(w);
    el.style.display = '';
    clearTimeout(bandTimer);
    // phone moments stay short (≤ 2.5 s); only the pause band (and test screenshots) stay up
    if (!o.hold) bandTimer = setTimeout(hideBand, Math.min(o.ms || 2200, 2500));
  }
  function hideBand() {
    const el = $('es-band');
    if (!el || el.style.display === 'none') return;
    clearTimeout(bandTimer);
    document.body.classList.remove('es-band-zone');
    el.classList.add('out');
    setTimeout(() => { if (el.classList.contains('out')) el.style.display = 'none'; }, reduced() ? 0 : 200);
  }

  // ---------- full cards (no tiles on screen): a postcard of the next place, caught, the escape ----------
  function card(kind, level, heartBack) {
    if (!onZone()) { ctx.showScreen('escape'); resize(); }
    stopStrip();
    hideBand();
    const box = $('es-card');
    if (!box) return;
    box.className = 'es-zcard ' + (kind === 'cleared' ? 'cleared' : kind === 'escape' ? 'escape' : 'zapcard');
    box.innerHTML = '';
    const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; box.appendChild(e); return e; };
    if (kind === 'cleared') {
      const lv = level || 1;
      const next = lv < 3 ? M.zoneOf(route, lv + 1) : null;
      if (next) {
        const pc = add('figure', 'es-postcard');
        const im = document.createElement('img'); im.alt = ''; im.src = M.art(next.id, 'bg-s');
        im.onerror = () => { im.onerror = null; im.src = next.icon; im.classList.add('icon'); };
        const cap = document.createElement('figcaption'); cap.textContent = '¡Ahora: ' + next.name + '!';
        pc.append(im, cap);
      }
      add('b', 'es-big', `¡Nivel ${lv} superado!`);
      add('span', null, myNumbers() || '¡En el próximo lugar, a por más turbos!');
      if (heartBack) add('span', 'es-heart-back', '¡Un corazón de regalo! +1 ❤️');
      const c = cast && cast.cheers && window.DralingoCast ? cast.cheers[(lv - 1) % cast.cheers.length] : null;
      if (c) {
        const row = add('div', 'es-cheer');
        const ci = document.createElement('img'); ci.alt = ''; ci.src = DralingoCast.pose(c, 'cheer');
        const cl = document.createElement('p'); cl.textContent = `${DralingoCast.name(c)}: «${DralingoCast.line(c, 'win')}»`;
        row.append(ci, cl);
      }
    } else if (kind === 'caught') {
      const c = add('canvas'); c.width = 240; c.height = 240; c.className = 'es-card-robot';
      const drawR = () => { const g2 = c.getContext('2d'); g2.clearRect(0, 0, 240, 240); R.robotin(g2, 112, 232, 200, { t: 2, mood: 'happy', glitch: false }); };
      drawR(); R.onRobot('happy', c, drawR);
      add('b', 'es-big', '¡Robotín nos alcanzó!');
      add('span', null, 'Repetimos este nivel… ¡y ahora corre más rápido!');
    } else {
      // the escape: the jet takes off with me aboard (Robotín left behind, dizzy)
      const sky = add('div', 'es-takeoff');
      const jt = document.createElement('img'); jt.className = 'es-takeoff-jet'; jt.alt = ''; jt.src = M.JET;
      jt.onerror = () => { jt.onerror = null; jt.src = '/assets/saga/avatars/plane.webp'; };
      const meI = document.createElement('img'); meI.className = 'es-takeoff-me'; meI.alt = ''; meI.src = R.BODY_URL(mySkin(), 'ok');
      meI.onerror = () => { meI.onerror = null; meI.src = R.SKIN_URL(mySkin()); };
      sky.style.setProperty('--es-sky', `url("${M.art(zoneNow().id, 'bg')}")`);
      sky.append(meI, jt);
      add('b', 'es-big', '¡Escapamos!');
      add('span', null, '¡Rumbo al cielo en el jet de Hamdan!');
      const mine = myNumbers();
      add('b', null, mine ? 'Tú: ' + mine : '¡Lo logramos juntos!');
    }
    box.classList.remove('hidden');
    document.body.classList.add('es-card-on');
  }
  // what I gave the crew so far, in words, never a 0 («2 turbos · a salvo 3 de 3 veces»); '' when there's nothing yet
  function myNumbers() {
    const parts = [];
    if (my.turbos > 0) parts.push(`${my.turbos} ${my.turbos === 1 ? 'turbo' : 'turbos'}`);
    if (my.safe > 0) parts.push(`a salvo ${my.safe} de ${my.waves} ${my.waves === 1 ? 'vez' : 'veces'}`);
    return parts.join(' · ');
  }
  function hideCard() { const b = $('es-card'); if (b) b.classList.add('hidden'); document.body.classList.remove('es-card-on'); }

  // ---------- the zona segura screen ----------
  function enterZone(d) {
    stopStrip();
    room = M.buildRoom(seed || (es && es.seed) || 1, d.level || (es && es.level) || 1, route);
    R.roomArt(room.zone);
    if (room.level < 3) R.preload([], route, [M.zoneOf(route, room.level + 1).id]);      // the next place, while kids walk
    zones = d.zones || [];
    if (d.waveMs) { waveUntil = now() + d.waveMs; waveTotal = d.waveTotalMs || d.waveMs; }
    // where the server put me in this room (a new room every zone: never keep the last room's spot)
    const mine = (d.pos || []).find((a) => a[0] === my.idx);
    if (mine) me = { x: mine[1], y: mine[2], f: 2 };
    else if (!me || M.boxBlocked(room, me.x, me.y)) { const s0 = room.spawn[(my.idx * 7 + 3) % room.spawn.length]; me = { x: (s0[0] + 0.5) * T, y: (s0[1] + 0.5) * T + 6, f: 2 }; }
    lastSent = null;
    applyPos(d.pos || [], true);
    hideCard();
    if (!onZone()) ctx.showScreen('escape');
    document.documentElement.style.setProperty('--es-zone-ink', zoneNow().ink || '#2a3a63');
    if (!d.wave) firstHelp();
    if (paused) hideBand();          // the room has its own pause card
    start();
    hud(true);
  }
  function leaveZone() {
    stop();
    room = null; zones = []; others = {}; occ = {};
    hideCard();
    hideHand();
  }
  function applyPos(arr, snap) {
    const seen = {};
    arr.forEach(([idx, x, y, f, dz]) => {
      if (idx === my.idx) return;
      seen[idx] = 1;
      const o = others[idx] || (others[idx] = { x, y, tx: x, ty: y });
      if (snap || Math.hypot(x - o.x, y - o.y) > 140) { o.x = x; o.y = y; }
      o.tx = x; o.ty = y; o.f = f; o.dizzy = !!dz;
    });
    Object.keys(others).forEach((i) => { if (!seen[i]) delete others[i]; });
  }
  function start() {
    running = true;
    canvas = $('es-zcanvas');
    if (!canvas) return;
    g = canvas.getContext('2d');
    resize();
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); setJoy(-1); }
  function resize() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }
  window.addEventListener('resize', resize);

  function bindControls() {
    const joy = $('es-joy');
    if (!joy) return;
    let jp = null;
    const knob = $('es-knob');
    const move = (e) => {
      if (!jp || e.pointerId !== jp.id) return;
      e.preventDefault();
      const dx = e.clientX - jp.ox, dy = e.clientY - jp.oy, d = Math.hypot(dx, dy);
      const k = Math.min(1, 46 / Math.max(1, d));
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      setJoy(d < 12 ? -1 : M.dirOf(dx, dy));
    };
    const end = (e) => { if (!jp || e.pointerId !== jp.id) return; jp = null; knob.style.transform = ''; setJoy(-1); joy.classList.remove('down'); };
    const begin = (e, ox, oy) => {
      jp = { id: e.pointerId, ox, oy };
      joy.classList.add('down');
      hideHand();
      try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
      move(e);
    };
    joy.addEventListener('pointerdown', (e) => { e.preventDefault(); const r = joy.getBoundingClientRect(); begin(e, r.left + r.width / 2, r.top + r.height / 2); sfx(K + 'tap.mp3', 0.35); });
    // the whole room works as a floating joystick too (little thumbs miss the pad)
    const cv = $('es-zcanvas');
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); begin(e, e.clientX, e.clientY); });
    [joy, cv].forEach((el) => { el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); });
    document.addEventListener('keydown', (e) => {
      if (!running || !onZone()) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.keys.l = 1;
      if (k === 'arrowright' || k === 'd') input.keys.r = 1;
      if (k === 'arrowup' || k === 'w') input.keys.u = 1;
      if (k === 'arrowdown' || k === 's') input.keys.d = 1;
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.keys.l = 0;
      if (k === 'arrowright' || k === 'd') input.keys.r = 0;
      if (k === 'arrowup' || k === 'w') input.keys.u = 0;
      if (k === 'arrowdown' || k === 's') input.keys.d = 0;
    });
    const help = $('es-help-go');
    if (help) help.addEventListener('click', () => { $('es-help').classList.add('hidden'); showHand(); });
  }
  function setJoy(d) { input.dir = d; }

  // where am I: inside a zone? protected (first N in) or over its limit?
  function myZoneState() {
    if (!me || !zones.length) return { zone: -1 };
    const zid = M.zoneAt(zones, me.x, me.y);
    if (zid < 0) return { zone: -1 };
    const z = zones.find((q) => q.id === zid);
    const o = occ[zid];
    const safe = !z.cap || !o || (o.safe || []).includes(my.idx) || (o.n < z.cap);
    return { zone: zid, safe, full: !safe };
  }
  function bestZone() {
    let best = null, bd = 1e9;
    zones.forEach((z) => {
      const o = occ[z.id];
      if (z.cap && o && o.n >= z.cap && !(o.safe || []).includes(my.idx)) return;
      const d = Math.hypot((z.x + z.w / 2) * T - me.x, (z.y + z.h / 2) * T - me.y);
      if (d < bd) { bd = d; best = z; }
    });
    return best;
  }

  let hudKey = '';
  function hud(force) {
    if (!room || !es) return;
    const t = now();
    const left = paused ? pausedLeft : Math.max(0, waveUntil - t);
    const live = es.wave && left > 0;
    const zs = myZoneState();
    const dz = t < dizzyUntil;
    const key = [es.wave, live ? Math.ceil(left / 1000) : 0, zs.zone, zs.safe, dz, paused, es.hearts, Object.values(occ).map((o) => o.n).join(',')].join('|');
    if (!force && key === hudKey) return;
    hudKey = key;
    $('es-wave-n').textContent = live ? Math.ceil(left / 1000) : (es.wave ? '✓' : '…');
    $('es-wave-ring').style.setProperty('--p', live ? (left / Math.max(1, waveTotal)).toFixed(3) : 0);
    $('es-wave-ring').classList.toggle('hurry', live && left < 3000);
    $('es-wave-title').textContent = es.wave ? `Ola ${es.wave} de 3` : '¡Zona segura!';
    $('es-wave-sub').textContent = 'En ' + zoneNow().room;
    hearts($('es-zhearts'));
    const st = $('es-status');
    let text = '', cls = '';
    if (paused) { text = ''; cls = 'out'; }
    else if (dz) { text = '😵 ¡Cosquillas! Espera…'; cls = 'dizzy'; }
    else if (!es.wave || !live) { text = es.wave ? '¡Espera la próxima ola!' : 'Las zonas verdes se encienden…'; cls = 'out'; }
    else if (zs.zone >= 0 && zs.safe) { text = '🟢 ¡A salvo! Quédate aquí'; cls = 'safe'; }
    else if (zs.zone >= 0) { text = '😬 ¡Llena! Busca otra zona'; cls = 'full'; }
    else { text = '👉 ¡Entra en una zona verde!'; cls = 'out'; }
    st.style.display = text ? '' : 'none';
    if (st.textContent !== text) { st.textContent = text; st.className = 'es-status ' + cls + ' pop'; setTimeout(() => st.classList.remove('pop'), 180); if (cls === 'safe') { sfx(K + 'tap.mp3', 0.5); buzz(25); } }
    $('es-zhint').textContent = live && zs.zone < 0 ? 'Arrastra el círculo o toca el suelo y camina' : (zs.safe ? '¡Quieto hasta el zap!' : '');
  }
  function arrowTick() {
    const ar = $('es-arrow');
    if (!ar || !room || !me) return;
    const live = es && es.wave && waveUntil > now();
    const zs = myZoneState();
    const z = live && !(zs.zone >= 0 && zs.safe) ? bestZone() : null;
    if (!z || paused) { ar.style.display = 'none'; return; }
    const zx = (z.x + z.w / 2) * T, zy = (z.y + z.h / 2) * T;
    const a = Math.atan2(zy - me.y, zx - me.x);
    const sx = view.ox + me.x * view.s, sy = view.oy + (me.y - 24) * view.s;
    ar.style.display = '';
    ar.style.left = (sx + Math.cos(a) * 54) + 'px';
    ar.style.top = (sy + Math.sin(a) * 54) + 'px';
    ar.firstChild.style.transform = `rotate(${a}rad)`;
  }

  function step(dt) {
    const t = now();
    const blocked = paused || t < dizzyUntil || !es || es.phase !== 'zone';
    let dir = input.dir;
    if (dir < 0) dir = M.dirOf(input.keys.r - input.keys.l, input.keys.d - input.keys.u);
    me.moving = false;
    if (!blocked && dir >= 0) {
      const [vx, vy] = M.DIRS[dir];
      M.moveBody(room, me, vx * SPEED * dt, vy * SPEED * dt);
      me.f = dir;
      me.moving = true;
    }
    Object.values(others).forEach((o) => { const a = Math.min(1, dt * 10); const d = Math.hypot(o.tx - o.x, o.ty - o.y); o.moving = d > 1.5; o.x += (o.tx - o.x) * a; o.y += (o.ty - o.y) * a; });
  }
  function send(nowMs, force) {
    if (!force && nowMs - lastSend < SEND_MS) return;
    const moved = !lastSent || Math.abs(lastSent.x - me.x) > 0.5 || Math.abs(lastSent.y - me.y) > 0.5 || lastSent.f !== me.f;
    if (!moved && nowMs - lastSend < 1000) return;       // standing still: a keepalive once a second
    lastSend = nowMs;
    lastSent = { x: me.x, y: me.y, f: me.f };
    ctx.socket.emit('player:es-pos', { pin: ctx.getPin(), x: me.x, y: me.y, f: me.f >= 0 ? me.f : 2 });
    if (ctx.markActivity) ctx.markActivity();
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function draw() {
    const cw = canvas.width, ch = canvas.height;
    if (!cw || !ch || !room) return;
    const RW = room.cols * T, RH = room.rows * T;
    const W = cw / dpr, H = ch / dpr;
    // the room is square: it fills the stage's height (or 1.5× the width) and the camera follows me both ways
    const Lw = room.layout || { left: 1, right: 1 }, floorW = room.cols - Lw.left - Lw.right;
    const s = Math.min(H / RH, Math.max(W / RW, W / ((floorW + 0.6) * T)));
    let ox = (W - RW * s) / 2, oy = (H - RH * s) / 2;
    if (RW * s > W) ox = floorW * T * s <= W ? clamp(W / 2 - (Lw.left + floorW / 2) * T * s, W - RW * s, 0) : clamp(W / 2 - me.x * s, W - RW * s, 0);
    if (RH * s > H) oy = clamp(H / 2 - me.y * s, H - RH * s, 0);
    view = { s, ox, oy };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = zoneNow().ink || '#2a3a63'; g.fillRect(0, 0, cw, ch);
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    const pnow = performance.now();
    const t = now();
    const kidsList = Object.entries(others).map(([i, o]) => {
      const p = roster[i] || {};
      const safe = Object.values(occ).some((q) => (q.safe || []).includes(+i));
      return { idx: +i, x: o.x, y: o.y, f: o.f, moving: o.moving, dizzy: o.dizzy, skin: p.skin || 'dralingo', name: p.name || '', safe };
    });
    const zs = myZoneState();
    kidsList.push({ idx: my.idx, x: me.x, y: me.y, f: me.f, moving: me.moving, dizzy: t < dizzyUntil, skin: mySkin(), name: 'TÚ', me: true, safe: zs.zone >= 0 && zs.safe && es.wave && waveUntil > t });
    const flash = flashAt ? Math.max(0, 1 - (pnow - flashAt) / 900) : 0;
    const left = waveUntil - t;
    R.room(g, { room, zones, occ, kids: kidsList, t: pnow / 1000, flash, zapTargets, robot: { mood: flash > 0 ? 'zap' : (left > 0 && left < 3000 ? 'happy' : 'idle') }, myZone: zs.zone, mySafe: zs.zone >= 0 && zs.safe }, { s }, {
      size: 48, meScale: 1.18, tag: 13, badge: 14, meLabel: 'TÚ', dimOthers: true,
    });
  }
  let lastHud = 0;
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.1, (ts - lastT) / 1000);
    lastT = ts;
    if (room && me && onZone()) {
      for (let rem = dt; rem > 1e-6; rem -= 1 / 60) step(Math.min(rem, 1 / 60));     // ≤ 1/60 s per step: no wall tunnelling
      send(Date.now());
      draw();
      if (ts - lastHud > 150) { lastHud = ts; hud(false); arrowTick(); }
    }
    raf = requestAnimationFrame(loop);
  }

  // ---------- first time in a zona segura: 3 pictured steps, a tapping hand on the joystick ----------
  function firstHelp() {
    const card_ = $('es-help');
    if (!card_) return;
    try { if (sessionStorage.getItem('esHelp')) return; sessionStorage.setItem('esHelp', '1'); } catch (_) { /* private mode: show it */ }
    $('es-help-me').src = R.SKIN_URL(mySkin());
    card_.classList.remove('hidden');
    setTimeout(() => { card_.classList.add('hidden'); }, 5200);    // never waits for a tap: the wave starts anyway
  }
  function showHand() {
    try { if (sessionStorage.getItem('esHand')) return; } catch (_) {}
    if (!onZone() || $('es-hand')) return;
    const el = $('es-joy');
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const h = document.createElement('div');
    h.className = 'kdp-hand'; h.id = 'es-hand';
    h.innerHTML = '<span>👆</span><b>¡Arrastra!</b>';
    h.style.left = (r.left + r.width * 0.5) + 'px';
    h.style.top = (r.top + r.height * 0.35) + 'px';
    $('screen-escape').appendChild(h);
  }
  function hideHand() {
    const h = $('es-hand');
    if (h) { h.remove(); try { sessionStorage.setItem('esHand', '1'); } catch (_) {} }
  }

  // ---------- lobby (called by the skin): who I run as, this round's route, the 3 steps ----------
  function lobby(head) {
    let box = $('es-how');
    if (!head) { if (box) box.remove(); return; }       // the skin passes the lobby header only while playing escape
    setOn(true);
    const sk = M.skinFor(localAvatar(), myName());
    const label = (window.Saga && window.Saga.labelOf && window.Saga.labelOf(sk)) || 'Dralingo';   // (🪙 a skin: its own name)
    if (!box) {
      box = document.createElement('div');
      box.className = 'kdp-how es-how';
      box.id = 'es-how';
      box.innerHTML = '<div class="es-you"><img id="es-you-img" src="/assets/saga/avatars/dralingo.webp" alt=""><span>Vas a correr como<b id="es-you-name"></b></span></div>'
        + '<div class="es-proute"><b id="es-proute-name"></b><div class="es-proute-stops" id="es-proute-stops"></div></div>'
        + '<div class="kdp-how-title es-how-title">Así se juega</div><ol>'
        + '<li><span class="es-ico-tiles"><i></i><i></i><i></i><i></i></span><span><b>Responde bien</b>cada acierto es un turbo 🚀</span></li>'
        + '<li><canvas id="es-how-robot" width="108" height="108"></canvas><span><b>¡Robotín te persigue!</b>cada acierto te aleja · si te alcanza: ¡zap!</span></li>'
        + '<li><span class="es-ico-zone"><img id="es-how-me" src="/assets/saga/avatars/dralingo.webp" alt=""></span><span><b>Zona segura</b>camina a una zona verde antes del zap</span></li>'
        + '</ol>';
      head.after(box);
    }
    $('es-you-img').src = R.SKIN_URL(sk);
    $('es-how-me').src = R.SKIN_URL(sk);
    $('es-you-name').textContent = label;
    paintLobbyRoute();
    const c = $('es-how-robot');
    if (c) { const drawR = () => { const g2 = c.getContext('2d'); g2.clearRect(0, 0, 108, 108); R.robotin(g2, 50, 104, 92, { t: 1.1, mood: 'chase', glitch: false }); }; drawR(); R.onRobot('chase', c, drawR); }
  }
  function paintLobbyRoute() {
    const nm = $('es-proute-name'), box = $('es-proute-stops');
    if (!nm || !box) return;
    const rt = M.route(route);
    nm.textContent = 'Hoy: ' + rt.name;
    box.innerHTML = '';
    M.zonesOf(route).forEach((z) => {
      const f = document.createElement('figure');
      const im = document.createElement('img'); im.alt = ''; im.src = M.art(z.id, 'bg-s');
      im.onerror = () => { im.onerror = null; im.src = z.icon; im.classList.add('icon'); };
      const cap = document.createElement('figcaption'); cap.textContent = z.short || z.name;
      f.append(im, cap);
      box.appendChild(f);
    });
    const j = document.createElement('figure'); j.className = 'jet';
    const ji = document.createElement('img'); ji.alt = ''; ji.src = M.JET;
    ji.onerror = () => { ji.onerror = null; ji.src = '/assets/saga/avatars/plane.webp'; };
    const jc = document.createElement('figcaption'); jc.textContent = '¡El jet!';
    j.append(ji, jc);
    box.appendChild(j);
  }
  // ---------- countdown (called by the skin): the episode card, my avatar in the crew VS Robotín ----------
  function intro(ov) {
    let box = $('es-pintro');
    if (!ov) { if (box) box.remove(); return; }         // the skin passes the countdown overlay only while playing escape
    setOn(true);
    if (!box) {
      box = document.createElement('div');
      box.className = 'es-pintro'; box.id = 'es-pintro';
      // 2026-10-13: the phone's own VS card, like the projector's split (crew on the warm side, Robotín on the cool side)
      box.innerHTML = '<div class="es-pintro-title">Draly Fuga<small>Las rutas de la fuga</small></div><div class="es-pintro-route" id="es-pintro-route"></div>'
        + '<div class="es-pintro-row" id="es-pintro-row"></div><div class="es-pintro-you">¡Tú vas en la tripulación!</div>'
        + '<div class="es-pintro-vs">VS</div><div class="es-pintro-robo" id="es-pintro-robo"></div>';
      ov.prepend(box);
    }
    $('es-pintro-route').textContent = `${M.route(route).name} · ${M.zoneOf(route, 1).name}`;
    box.style.setProperty('--es-sky', `url("${M.art(M.zoneOf(route, 1).id, 'bg')}")`);
    const row = $('es-pintro-row');
    row.innerHTML = '';
    const mk = (src, cls, i) => { const im = document.createElement('img'); im.src = src; im.alt = ''; if (cls) im.className = cls; im.style.setProperty('--i', i); row.appendChild(im); };
    mk(D + 'power.webp', '', 0);
    mk(R.SKIN_URL(M.skinFor(localAvatar(), myName())), 'me', 1);
    if (window.DralingoCast) mk(DralingoCast.pose('fer', 'hello'), '', 2);
    const robo = $('es-pintro-robo');
    robo.innerHTML = '';
    const c = document.createElement('canvas'); c.width = 172; c.height = 172; robo.appendChild(c);
    const tag = document.createElement('span'); tag.className = 'es-pintro-robotag'; tag.textContent = 'Robotín'; robo.appendChild(tag);
    const t0 = performance.now();
    const tick = (ts) => {
      if (!c.isConnected || $('screen-countdown').classList.contains('hidden')) return;
      const g2 = c.getContext('2d'); g2.clearRect(0, 0, 172, 172);
      R.robotin(g2, 80, 168, 150, { t: (ts - t0) / 1000, mood: 'chase', moving: true });
      if (!reduced()) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // ---------- the end (called by the skin, only without the shared ceremony): the crew's rank + my own numbers ----------
  function end(data) {
    const e = (data && data.escape) || {};
    const me_ = (data && data.me) || {};
    const emoji = $('end-emoji');
    if (!emoji) return;
    emoji.innerHTML = '';
    const rt = M.route(e.route || 0);
    const rk = e.rank || { id: 'zoco', name: rt.ranks.zoco, stars: 1 };
    const wrap = document.createElement('div');
    wrap.className = 'es-pend';
    const badge = document.createElement('div');
    badge.className = 'es-pbadge ' + rk.id;
    const bi = document.createElement('img'); bi.src = rk.art || rt.rankArt[rk.id] || rt.rankArt.zoco; bi.alt = '';
    badge.appendChild(bi);
    const stars = document.createElement('div'); stars.textContent = '⭐'.repeat(rk.stars || 1); stars.style.fontSize = '1.4rem';
    const name = document.createElement('div'); name.className = 'es-prank'; name.textContent = rk.name;
    const stats = document.createElement('div'); stats.className = 'es-pstats';
    [[me_.turbos || 0, 'turbos 🚀'], [me_.best || 0, 'mejor racha 🔥'], [`${me_.safe || 0}/${me_.waves || 0}`, 'zonas seguras 🟢']].forEach(([n, l]) => {
      const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = n; const s = document.createElement('span'); s.textContent = l; d.append(b, s); stats.appendChild(d);
    });
    wrap.append(badge, stars, name, stats);
    emoji.appendChild(wrap);
    $('end-banner').textContent = e.escaped ? '¡Escapamos en el jet!' : `¡Llegamos al nivel ${e.level || 1}!`;
    const teamEl = $('end-team-score'), meEl = $('end-personal-score');
    if (teamEl && teamEl.parentNode.firstChild) teamEl.parentNode.firstChild.nodeValue = 'Niveles superados: ';
    if (teamEl) teamEl.textContent = `${e.levelsCleared || 0} de 3 · ${e.hearts || 0} ❤️`;
    if (meEl) meEl.parentNode.style.display = 'none';
  }

  window.EscapePhone = {
    init, result, lobby, intro, end,
    on: () => on,
    debug: () => ({ es, my, crew, robot, me, zones, occ, paused, route, dizzyMs: Math.max(0, dizzyUntil - now()) }),
    // Test hooks: headless QA browsers barely deliver animation frames, so step the room by hand.
    advance(sec, keys) {
      if (!room || !me) return null;
      Object.assign(input.keys, { l: 0, r: 0, u: 0, d: 0 }, keys || {});
      for (let k = 0; k < Math.round(sec * 60); k++) step(1 / 60);
      input.keys = { l: 0, r: 0, u: 0, d: 0 };
      send(Date.now(), true);
      if (onZone()) { resize(); draw(); }
      hud(true); arrowTick();
      return { x: Math.round(me.x), y: Math.round(me.y), zone: myZoneState() };
    },
    walkTo(tx, ty) {
      return new Promise((resolve) => {
        const path = room && me && M.pathTo(room, me.x, me.y, tx, ty, 1, 1);
        if (!path) return resolve(null);
        path.push([(tx + 0.5) * T, (ty + 0.5) * T + 6]);
        const tick = () => {
          if (!path.length || !room) { if (onZone()) { resize(); draw(); } hud(true); arrowTick(); return resolve({ x: Math.round(me.x), y: Math.round(me.y), zone: myZoneState() }); }
          let budget = SPEED * 0.125;
          while (budget > 0 && path.length) {
            const [px, py] = path[0];
            const d = Math.hypot(px - me.x, py - me.y);
            if (d < 1) { path.shift(); continue; }
            const l = Math.min(d, budget);
            for (let i = 0; i < 8; i++) M.moveBody(room, me, (px - me.x) / d * l / 8, (py - me.y) / d * l / 8);
            budget -= l;
            if (Math.hypot(px - me.x, py - me.y) < 1) path.shift(); else break;
          }
          send(Date.now(), true);
          setTimeout(tick, 125);
        };
        tick();
      });
    },
    zones: () => zones,
    // draw now (the room, or the strip at the given dash phase u 0..1)
    frame: (u) => {
      if (room && me && onZone()) { resize(); draw(); hud(true); arrowTick(); }
      mountStrip();
      if (strip && strip.isConnected) { if (u != null) dashAt = performance.now() - u * 900; crewShown = crew; robotShown = robot; drawStrip(performance.now(), 0.016); }
    },
    dash: (sup, u) => { dashHoldU = sup === null ? null : (u == null ? 0.45 : u); dashSuper = !!sup; mountStrip(); if (strip && strip.isConnected) drawStrip(performance.now(), 0.016); },
    band: (kind) => {
      if (kind === 'zap') band({ kind: 'zap', robot: 'zap', title: '¡Zap! ¡Cosquillas!', sub: 'Robotín nos alcanzó: mareados 3 s', hold: true });
      if (kind === 'time') band({ kind: 'time', img: D + 'power.webp', title: '⏱ ¡Último minuto!', sub: '¡Respondan rápido, equipo!', hold: true });
      if (kind === 'robo') band({ kind: 'robo', robot: 'chase', title: '¡Robotín despertó!', sub: 'Cada respuesta correcta es un turbo 🚀', hold: true });
      if (kind === 'close') band({ kind: 'zap', robot: 'happy', title: '¡Robotín se acerca!', sub: 'Responde rápido: cada acierto lo aleja', hold: true });
      if (kind === 'safe') band({ kind: 'safe', img: R.SKIN_URL(mySkin()), title: '¡A salvo!', sub: '¡Toda la clase a salvo!', hold: true });
    },
    card: (kind, level) => card(kind, level),
    uncard: () => { hideCard(); if (ctx) ctx.showScreen('question'); mountStrip(); return true; },
    dizzy: (ms) => dizzy(ms || 3000),
    // the chase pass (screenshots / QA): MY Robotín at `g` metres, closing (v m/s), in a lunge, behind my shield,
    // tripping; zapFx(u) holds the full-screen zap at u (0..1); stun(ms) locks my tiles; chaseState() reads it all
    chase: (o) => {
      o = o || {};
      chFrozen = o.live !== true;                      // ({ live: true } hands it back to the server)
      if (typeof o.g === 'number') { gap = gapShown = o.g; }
      myQ = o.open !== false; ch.v = o.v == null ? 0.6 : o.v; wakeUntil = 0;
      ch.lu = o.lunge ? now() + 60000 : 0; ch.lt = 6;
      ch.sh = o.shield ? now() + 60000 : 0;
      tripAt = o.trip ? performance.now() + 60000 : -1e9;
      if (o.near) nearAt = performance.now();
      mountStrip();
      if (o.v === 0) ch.v = 0;
      if (strip && strip.isConnected) { crewShown = crew; robotShown = robot; drawStrip(performance.now(), 0.016); paintStripHud(true); }
      return chaseState();
    },
    zapFx: (u) => { zapMeAt = performance.now() + 60000; zapFx(u == null ? 0.35 : u); return true; },
    unzapFx: () => { zapMeAt = -1e9; hideZapFx(); return true; },
    stun: (ms) => { startStun(ms || 60000); return chaseState(); },
    unstun: () => { endStun(true); return chaseState(); },
    edge: (lv) => { setEdge(lv); return lv; },
    chaseState: () => chaseState(),
  };
  function chaseState() { return { gap: Math.round(gap * 10) / 10, shown: Math.round(gapShown * 10) / 10, v: ch.v, myQ, stunned: stunned(), stunMs: Math.max(0, stunUntil - now()), shieldMs: Math.max(0, ch.sh - now()), lungeMs: Math.max(0, ch.lu - now()), edge: edgeLv, closing: closing(), words: chaseWords()[0] }; }
})();
