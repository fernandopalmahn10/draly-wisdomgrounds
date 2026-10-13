// La Gran Fuga de Dubái — the kid's phone. Questions use the shared pastel skin (player-kingdoms-skin.js); this module
// adds what makes it this game:
//   · the chase rail on top of every question (Robotín | the crew with my avatar | the zone's goal), red when he's close
//   · the turbo on the result screen (my avatar dashes along a lane, Robotín left behind)
//   · phone-sized game-show moments as a band over the top of the screen (never over the answer tiles): Robotín wakes,
//     ¡Zap! (tickle, dizzy 3 s), last minute, zonas verdes, ¡A salvo!, and full cards when no tiles are on screen
//     (level cleared with the zone's landmark, caught at the gate, the escape)
//   · the «zona segura» screen: the whole room, my avatar with the Batalla de Nieve joystick, an arrow to the nearest
//     zone with room, a status pill that says exactly what to do
//   · the episode intro on the countdown (my avatar in the crew VS Robotín) and the end card (the crew's rank + my numbers)
// player.js calls EscapePhone.init(...) once. Test hooks: EscapePhone.advance(sec, keys), walkTo(tx, ty), band(kind), frame().
(function () {
  const M = window.EscapeMap, R = window.EscapeRender;
  const ES = '/assets/escape/', K = '/assets/kingdoms/', D = '/assets/dralingo/';
  const T = M ? M.TILE : 32;
  const SEND_MS = 125;
  const SPEED = 140;
  const RANK_ART = { cielo: '/assets/saga/avatars/plane.webp', burj: '/assets/kingdoms/landmarks/big/burj.webp', zoco: '/assets/saga/avatars/camel.webp' };
  const LV = M ? M.LEVELS : [];
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ctx = null, on = false;
  let es = null, roster = {}, cast = null, seed = 0;
  let my = { idx: 0, turbos: 0, best: 0, streak: 0, safe: 0, waves: 0 };
  let crew = 0, robot = -22, dizzyUntil = 0, paused = false, closeFlag = false, pausedLeft = 0;
  let room = null, zones = [], occ = {}, others = {}, me = null, running = false, raf = 0, lastT = 0, lastSend = 0, lastSent = null;
  let waveUntil = 0, waveTotal = 12000, flashAt = 0, zapTargets = [], input = { dir: -1, keys: { l: 0, r: 0, u: 0, d: 0 } };
  let canvas = null, g = null, dpr = 1, view = { s: 1, ox: 0, oy: 0 };
  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const skin = () => window.KingdomsSkin || null;
  const sfx = (name, vol) => { const s = skin(); if (s && s.sfx) s.sfx(name.indexOf('/') === 0 ? name : ES + name + '.mp3', vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const onZone = () => !!$('screen-escape') && !$('screen-escape').classList.contains('hidden');
  const questionOpen = () => !!$('screen-question') && !$('screen-question').classList.contains('hidden');
  const mySkin = () => (roster[my.idx] && roster[my.idx].skin) || (M ? M.skinFor(localAvatar(), myName()) : 'dralingo');
  const localAvatar = () => {
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    const list = (window.Saga && window.Saga.AVATARS) || [];
    return list.some((a) => a.emoji === v) ? v : ((list[0] && list[0].emoji) || '🐉');    // player.js getMyAvatar()
  };
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  const hold = () => { const s = skin(); if (s && s.hold) s.hold(paused || now() < dizzyUntil); };

  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('es-on', on);
    if (!on) { stop(); document.body.classList.remove('es-dizzy', 'es-pausing', 'es-card-on'); const mp = $('end-personal-score'); if (mp) mp.parentNode.style.display = ''; }
  }

  function init(c) {
    ctx = c;
    if (!M || !R) return;
    const s = c.socket;
    if (skin() && skin().holdWhen) skin().holdWhen(() => on && (paused || now() < dizzyUntil));
    s.on('state', (st) => { if (st && st.gameType) setOn(st.gameType === 'escape'); });
    s.on('es:cast', (cs) => { cast = cs; });
    s.on('countdown', () => { if (!on) return; stop(); room = null; zones = []; es = null; my = { idx: 0, turbos: 0, best: 0, streak: 0, safe: 0, waves: 0 }; });
    s.on('es:init', (d) => {
      setOn(true);
      seed = d.seed;
      roster = d.players || roster;
      cast = d.cast || cast;
      applyPublic(d);
      if (d.me) applyMe(d.me, true);
      if (d.phase === 'zone') enterZone(d);
      else if (d.phase !== 'zone' && room) leaveZone();      // reconnected during a run: the room loop stops
      else if (d.phase === 'cleared' || d.phase === 'caught' || d.phase === 'escape') card(d.phase, Math.max(1, (d.level || 1) - (d.phase === 'cleared' ? 1 : 0)));   // joined during a big moment
      rail();
      if (d.phase === 'run' && d.wakeMs > 1500 && !d.paused) setTimeout(() => band({ kind: 'robo', robot: 'chase', title: '¡Robotín despertó!', sub: 'Cada respuesta correcta es un turbo 🚀', ms: 2200 }), 900);
    });
    s.on('es:roster', (d) => { roster = d.players || roster; });
    s.on('es:me', (m) => applyMe(m, false));
    s.on('es:tick', (d) => {
      if (typeof d.c === 'number') { crew = d.c; robot = d.r; closeFlag = !!d.cl; rail(); }
      if (d.pos) applyPos(d.pos);
      if (d.occ) { occ = {}; d.occ.forEach(([zid, n, safe]) => { occ[zid] = { n, safe }; }); }    // only sent while a wave is live: the last count stays up after the zap
      if (typeof d.wl === 'number' && d.wl > 0) waveUntil = now() + d.wl;
    });
    s.on('es:zap', (d) => {
      crew = d.crew; robot = d.robot; rail();
      dizzy(d.dizzyMs || 3000);
      sfx('zap', 0.75); buzz([80, 40, 80, 40, 120]);
      band({ kind: 'zap', robot: 'zap', title: '¡Zap! ¡Cosquillas!', sub: 'Robotín nos alcanzó: mareados 3 s', ms: 2400 });
    });
    s.on('es:moment', (m) => {
      if (m.type === 'lastmin') { sfx(K + 'castle-alert.mp3', 0.5); buzz([60, 40, 60]); band({ kind: 'time', img: D + 'power.webp', title: '⏱ ¡Último minuto!', sub: es && es.level >= 3 ? '¡El jet de Hamdan está cerca!' : '¡Respondan rápido, equipo!', ms: 2200 }); }
      if (m.type === 'close' && questionOpen()) { buzz([40, 40, 40]); sfx(K + 'castle-alert.mp3', 0.35); band({ kind: 'zap', robot: 'happy', title: '¡Robotín se acerca!', sub: 'Responde rápido: cada acierto lo aleja', ms: 2000 }); }
    });
    s.on('es:pause', (d) => { applyPublic(d); });
    s.on('es:phase', (d) => {
      const prev = es && es.phase;
      applyPublic(d);
      if (d.phase === 'zone') { enterZone(d); if (prev !== 'zone') { sfx('wave', 0.5); } }
      else if (d.phase === 'cleared') { card('cleared', d.clearedLevel, d.heartBack); sfx(K + 'landmark.mp3', 0.75); buzz([40, 30, 40]); }
      else if (d.phase === 'caught') { card('caught'); sfx('zap', 0.6); }
      else if (d.phase === 'escape') { card('escape'); sfx('jet', 0.7); setTimeout(() => sfx(K + 'sting-win.mp3', 0.7), 1300); buzz([60, 40, 60, 40, 200]); }
      else if (d.phase === 'run') {
        leaveZone();
        rail();
        setTimeout(() => band({ kind: 'robo', robot: 'chase', title: d.replay ? '¡Otra vez Robotín!' : `¡Nivel ${d.level}: ${LV[d.level - 1].name}!`, sub: d.replay ? 'Ahora corre más rápido: ¡turbos!' : '¡Robotín despertó! ¡Corran!', ms: 2300 }), 400);
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
      else if (r.out.includes(my.idx)) { dizzy(r.dizzyMs || 2000); sfx('zap', 0.7); buzz([90, 40, 90]); band({ kind: 'zap', robot: 'zap', title: '¡Zap! Te quedaste fuera', sub: 'Cosquillas 2 s. ¡En la próxima ola, a una zona verde!', ms: 2300 }); }
      hud(true);
    });
    s.on('question', () => {
      if (!on) return;
      if (onZone()) leaveZone();
      setTimeout(rail, 0);
      document.body.classList.toggle('es-dizzy', now() < dizzyUntil);
      hold();
    });
    s.on('game-end', (d) => {
      stop(); hideCard(); paused = false; hideBand(); document.body.classList.remove('es-dizzy', 'es-pausing');
      if (on && d && d.escape && !d.escape.escaped) { sfx(K + 'tick.mp3', 0.6); band({ kind: 'time', robot: 'dizzy', title: '⏱ ¡Tiempo!', sub: 'Robotín se quedó sin batería', ms: 2400 }); }
    });
    bindControls();
  }

  function applyPublic(d) {
    es = Object.assign(es || {}, d);
    if (typeof d.crew === 'number') { crew = d.crew; robot = d.robot; }
    if (typeof d.close === 'boolean') closeFlag = d.close;
    if (d.dizzyMs) dizzy(d.dizzyMs, true);
    if (typeof d.paused === 'boolean' && d.paused !== paused) {
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
    rail();
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

  // ---------- the chase rail (question screen) ----------
  let railRobot = null;
  function rail() {
    if (!on || !es) return;
    const q = $('screen-question');
    if (!q) return;
    let el = $('es-rail');
    if (!el) {
      el = document.createElement('div');
      el.className = 'es-rail'; el.id = 'es-rail';
      el.setAttribute('role', 'img');
      el.innerHTML = '<span class="es-rail-hearts" id="es-rail-hearts"></span><span class="es-rail-label" id="es-rail-label"></span>'
        + '<div class="es-rail-track"><i class="es-rail-fill" id="es-rail-fill"></i></div>'
        + '<span class="es-rail-robot" id="es-rail-robot"><canvas width="80" height="80"></canvas></span>'
        + '<span class="es-rail-me" id="es-rail-me"><img alt=""></span><img class="es-rail-goal" id="es-rail-goal" alt="">';
      q.prepend(el);
      railRobot = el.querySelector('.es-rail-robot canvas');
    }
    // the rail runs from 25 m before the start to the goal, so Robotín's head start shows as a real gap
    const L = es.L || 100;
    const cp = Math.max(0, Math.min(1, (crew + 25) / (L + 25))), rp = Math.max(0, Math.min(1, (robot + 25) / (L + 25)));
    // the track runs from 22 px to (width − 46 px); the markers ride on transforms (no relayout on a cheap phone)
    const tw = Math.max(0, el.clientWidth - 68);
    $('es-rail-fill').style.transform = `scaleX(${cp.toFixed(4)})`;
    $('es-rail-me').style.transform = `translateX(${(cp * tw).toFixed(1)}px)`;
    $('es-rail-robot').style.transform = `translateX(${(rp * tw).toFixed(1)}px)`;
    const img = $('es-rail-me').firstChild;
    const want = R.SKIN_URL(mySkin());
    if (img.getAttribute('src') !== want) img.src = want;
    const lv = Math.max(1, Math.min(3, es.level || 1));
    const goal = lv >= 3 ? '/assets/saga/avatars/plane.webp' : LV[lv].lm;
    if ($('es-rail-goal').getAttribute('src') !== goal) $('es-rail-goal').src = goal;
    const gap = Math.max(0, crew - robot);
    const close = es.phase === 'run' && closeFlag;
    el.classList.toggle('close', close);
    $('es-rail-label').textContent = close ? '¡Robotín se acerca!' : `Nivel ${lv} · ` + (gap > 15 ? 'Robotín está lejos 😎' : 'Robotín te sigue 👀');
    el.setAttribute('aria-label', $('es-rail-label').textContent);
    hearts($('es-rail-hearts'));
    if (railRobot) { const g2 = railRobot.getContext('2d'); g2.clearRect(0, 0, 80, 80); R.robotin(g2, 36, 76, 66, { t: performance.now() / 1000, mood: close ? 'happy' : 'chase', glitch: false }); }
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

  // ---------- the turbo on the result screen (called by the skin) ----------
  function result(box, correct, correctText, r) {
    const e = (r && r.escape) || {};
    box.innerHTML = '';
    if (correct && e.turbo) {
      const lane = document.createElement('div');
      lane.className = 'es-lane lv' + Math.max(1, Math.min(3, (es && es.level) || 1)) + (e.super ? ' super' : '');
      const rb = document.createElement('canvas'); rb.className = 'es-lane-robot'; rb.width = 140; rb.height = 140;
      const meEl = document.createElement('div'); meEl.className = 'es-lane-me';
      const im = document.createElement('img'); im.src = R.SKIN_URL(mySkin()); im.alt = '';
      meEl.appendChild(im);
      lane.append(rb, meEl);
      const word = document.createElement('div');
      word.className = 'es-turbo-word' + (e.super ? ' super' : '');
      word.textContent = e.super ? '¡Súper turbo! 🔥' : '¡Turbo! +1 🚀';
      const sub = document.createElement('div');
      sub.className = 'kdp-res-sub';
      sub.textContent = e.super ? `¡Racha de ${e.streak}! La tripulación vuela` : (e.streak % 3 === 2 ? '🔥 ¡Una más y súper turbo!' : '¡La tripulación acelera!');
      box.append(lane, word, sub);
      const g2 = rb.getContext('2d'); R.robotin(g2, 62, 134, 118, { t: 1.3, mood: 'dizzy', glitch: false });
      sfx(e.super ? 'super' : 'turbo', 0.6);
      buzz(e.super ? [30, 30, 30, 30, 60] : [30, 40, 30]);
    } else if (correct) {
      const t = document.createElement('div'); t.className = 'kdp-res-title ok'; t.textContent = '¡Correcto!';
      box.append(stillPose('power'), t);
    } else {
      const t = document.createElement('div'); t.className = 'kdp-res-title no';
      t.textContent = r && r.timeUp ? '¡Se acabó el tiempo!' : '¡Casi!';
      const sub = document.createElement('div'); sub.className = 'kdp-res-sub'; sub.textContent = 'La respuesta era';
      const ans = document.createElement('div'); ans.className = 'kdp-res-answer'; ans.textContent = correctText || '';
      const again = document.createElement('div'); again.className = 'kdp-res-sub'; again.textContent = 'Sin turbo esta vez: ¡la próxima!';
      box.append(stillPose('wise'), t, sub, ans, again);
    }
  }
  function stillPose(n) { const i = document.createElement('img'); i.className = 'kdp-sticker'; i.alt = ''; i.src = D + n + '.webp'; return i; }

  // ---------- phone-sized moments: a band at the top (never over the tiles) ----------
  let bandTimer = null;
  function band(o) {
    let el = $('es-band');
    if (!el) { el = document.createElement('div'); el.id = 'es-band'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.className = 'es-band ' + (o.kind || '') + (onZone() ? ' onzone' : '');
    el.innerHTML = '';
    if (o.robot) { const c = document.createElement('canvas'); c.width = 128; c.height = 128; el.appendChild(c); const g2 = c.getContext('2d'); R.robotin(g2, 60, 122, 108, { t: performance.now() / 1000, mood: o.robot, glitch: false }); }
    else if (o.img) { const i = document.createElement('img'); i.src = o.img; i.alt = ''; el.appendChild(i); }
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
    el.classList.add('out');
    setTimeout(() => { if (el.classList.contains('out')) el.style.display = 'none'; }, reduced() ? 0 : 200);
  }

  // ---------- full cards (no tiles on screen): level cleared, caught, escape ----------
  function card(kind, level, heartBack) {
    if (!onZone()) { ctx.showScreen('escape'); resize(); }
    hideBand();
    const box = $('es-card');
    if (!box) return;
    box.className = 'es-zcard ' + (kind === 'cleared' ? 'cleared' : kind === 'escape' ? 'cleared' : 'zapcard');
    box.innerHTML = '';
    const add = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; box.appendChild(e); return e; };
    if (kind === 'cleared') {
      const lv = LV[(level || 1) - 1], next = LV[level || 1];
      const im = add('img'); im.src = lv.lm; im.alt = '';
      add('b', 'es-big', `¡Nivel ${level} superado!`);
      add('span', null, `Te salvaste ${my.safe} de ${my.waves} ${my.waves === 1 ? 'vez' : 'veces'} · ${my.turbos} ${my.turbos === 1 ? 'turbo' : 'turbos'}`);
      if (next) add('b', null, `Siguiente: ${next.name}`);
      if (heartBack) add('span', 'es-heart-back', '¡Un corazón de regalo! +1 ❤️');
      const c = cast && cast.cheers && window.DralingoCast ? cast.cheers[(level - 1) % cast.cheers.length] : null;
      if (c) add('span', null, `${DralingoCast.name(c)}: «${DralingoCast.line(c, 'win')}»`);
    } else if (kind === 'caught') {
      const c = add('canvas'); c.width = 240; c.height = 240; c.style.cssText = 'display:block;width:120px;height:120px;margin:-62px auto 0;justify-self:center';
      R.robotin(c.getContext('2d'), 112, 232, 200, { t: 2, mood: 'happy', glitch: false });
      add('b', 'es-big', '¡Robotín nos alcanzó!');
      add('span', null, 'Repetimos este nivel… ¡y ahora corre más rápido!');
    } else {
      const im = add('img'); im.src = '/assets/saga/avatars/plane.webp'; im.alt = ''; im.style.animation = reduced() ? 'none' : 'esTakeOff 3.2s .2s cubic-bezier(.5,0,.75,.3) both';
      add('b', 'es-big', '¡Escapamos!');
      add('span', null, '¡Rumbo al cielo en el jet de Hamdan!');
      const me_ = add('img'); me_.src = R.SKIN_URL(mySkin()); me_.alt = ''; me_.className = 'es-board';
      add('b', null, `Tú: ${my.turbos} ${my.turbos === 1 ? 'turbo' : 'turbos'} · ${my.safe} ${my.safe === 1 ? 'zona segura' : 'zonas seguras'}`);
    }
    box.classList.remove('hidden');
    document.body.classList.add('es-card-on');
  }
  function hideCard() { const b = $('es-card'); if (b) b.classList.add('hidden'); document.body.classList.remove('es-card-on'); }

  // ---------- the zona segura screen ----------
  function enterZone(d) {
    room = M.buildRoom(seed || (es && es.seed) || 1, d.level || (es && es.level) || 1);
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
    if (!d.wave) firstHelp();
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
    const rm = LV[(es.level || 1) - 1] ? LV[(es.level || 1) - 1].room : '';
    $('es-wave-sub').textContent = rm ? 'En ' + rm : '';
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
    const sx = view.ox + me.x * view.s, sy = view.oy + (me.y - 22) * view.s;
    ar.style.display = '';
    ar.style.left = (sx + Math.cos(a) * 48) + 'px';
    ar.style.top = (sy + Math.sin(a) * 48) + 'px';
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
  function draw() {
    const cw = canvas.width, ch = canvas.height;
    if (!cw || !ch || !room) return;
    const RW = room.cols * T, RH = room.rows * T;
    const W = cw / dpr, H = ch / dpr;
    // a phone is portrait, the room is landscape: zoom in (up to 1.7× the whole-room view, never taller than the
    // stage) and follow me sideways, so my avatar is big enough to steer; the arrow points to zones off screen
    const fit = Math.min((W - 8) / RW, (H - 8) / RH);
    const s = Math.min((H - 8) / RH, fit * 1.9);
    let ox = (W - RW * s) / 2;
    if (RW * s > W) ox = Math.max(W - RW * s - 4, Math.min(4, W / 2 - me.x * s));
    const oy = (H - RH * s) / 2;
    view = { s, ox, oy };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#fbe9dc'; g.fillRect(0, 0, cw, ch);
    g.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
    const pnow = performance.now();
    const t = now();
    const kidsList = Object.entries(others).map(([i, o]) => {
      const p = roster[i] || {};
      const safe = Object.values(occ).some((q) => (q.safe || []).includes(+i));
      return { idx: +i, x: o.x, y: o.y, f: o.f, moving: o.moving, dizzy: o.dizzy, skin: p.skin || 'dralingo', name: p.name || '', safe };
    });
    const zs = myZoneState();
    kidsList.push({ idx: my.idx, x: me.x, y: me.y, f: me.f, moving: me.moving, dizzy: t < dizzyUntil, skin: mySkin(), name: 'Tú', me: true, safe: zs.zone >= 0 && zs.safe && es.wave && waveUntil > t });
    const flash = flashAt ? Math.max(0, 1 - (pnow - flashAt) / 900) : 0;
    const left = waveUntil - t;
    R.room(g, { room, zones, occ, kids: kidsList, t: pnow / 1000, flash, zapTargets, robot: { mood: flash > 0 ? 'zap' : (left > 0 && left < 3000 ? 'happy' : 'idle') }, myZone: zs.zone, mySafe: zs.zone >= 0 && zs.safe }, { s }, {
      size: 40, tag: 12, groundScale: dpr >= 2 ? 1.5 : 1, badge: 13, meLabel: 'Tú', dimOthers: true,
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

  // ---------- lobby (called by the skin): who I run as + the 3 steps ----------
  function lobby(head) {
    let box = $('es-how');
    if (!head) { if (box) box.remove(); return; }       // the skin passes the lobby header only while playing escape
    setOn(true);
    const sk = M.skinFor(localAvatar(), myName());
    const saga = window.Saga && window.Saga.avatar ? window.Saga.avatar(sk) : null;
    const label = saga ? saga.label.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').trim() : sk;
    if (!box) {
      box = document.createElement('div');
      box.className = 'kdp-how es-how';
      box.id = 'es-how';
      box.innerHTML = '<div class="es-you"><img id="es-you-img" alt=""><span>Vas a correr como<b id="es-you-name"></b></span></div>'
        + '<div class="kdp-how-title">Así se juega</div><ol>'
        + '<li><span class="es-ico-tiles"><i></i><i></i><i></i><i></i></span><span><b>Responde bien</b>cada acierto es un turbo 🚀</span></li>'
        + '<li><canvas id="es-how-robot" width="108" height="108"></canvas><span><b>¡Que no te alcance Robotín!</b>si llega: ¡zap de cosquillas!</span></li>'
        + '<li><span class="es-ico-zone"><img id="es-how-me" alt=""></span><span><b>Zona segura</b>camina a una zona verde antes del zap</span></li>'
        + '</ol>';
      head.after(box);
    }
    $('es-you-img').src = R.SKIN_URL(sk);
    $('es-how-me').src = R.SKIN_URL(sk);
    $('es-you-name').textContent = label;
    const c = $('es-how-robot');
    if (c) { const g2 = c.getContext('2d'); g2.clearRect(0, 0, 108, 108); R.robotin(g2, 50, 104, 92, { t: 1.1, mood: 'chase', glitch: false }); }
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
      box.innerHTML = '<div class="es-pintro-title">La Gran Fuga<small>de Dubái</small></div>'
        + '<div class="es-pintro-row" id="es-pintro-row"></div><div class="es-pintro-you">¡Tú vas en la tripulación!</div>'
        + '<div class="es-pintro-vs">VS</div><div class="es-pintro-robo" id="es-pintro-robo"></div>';
      ov.prepend(box);
    }
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
    let t0 = performance.now();
    const tick = (ts) => {
      if (!c.isConnected || $('screen-countdown').classList.contains('hidden')) return;
      const g2 = c.getContext('2d'); g2.clearRect(0, 0, 172, 172);
      R.robotin(g2, 80, 168, 150, { t: (ts - t0) / 1000, mood: 'chase', moving: true });
      if (!reduced()) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // ---------- the end (called by the skin): the crew's rank + my own numbers ----------
  function end(data) {
    const e = (data && data.escape) || {};
    const me_ = (data && data.me) || {};
    const emoji = $('end-emoji');
    if (!emoji) return;
    emoji.innerHTML = '';
    const rk = e.rank || { id: 'zoco', name: 'Exploradores del Zoco', stars: 1 };
    const wrap = document.createElement('div');
    wrap.className = 'es-pend';
    const badge = document.createElement('div');
    badge.className = 'es-pbadge ' + rk.id;
    const bi = document.createElement('img'); bi.src = RANK_ART[rk.id] || RANK_ART.zoco; bi.alt = '';
    badge.appendChild(bi);
    const stars = document.createElement('div'); stars.textContent = '⭐'.repeat(rk.stars || 1); stars.style.fontSize = '1.4rem';
    const name = document.createElement('div'); name.className = 'es-prank'; name.textContent = rk.name;
    const stats = document.createElement('div'); stats.className = 'es-pstats';
    [[me_.turbos || 0, 'turbos 🚀'], [me_.best || 0, 'mejor racha 🔥'], [`${me_.safe || 0}/${me_.waves || 0}`, 'zonas seguras 🟢']].forEach(([n, l]) => {
      const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = n; const s = document.createElement('span'); s.textContent = l; d.append(b, s); stats.appendChild(d);
    });
    wrap.append(badge, stars, name, stats);
    const AW = { turbos: '🏆 ¡Más turbos de la clase!', fastest: '⚡ ¡El más rápido a la zona segura!', streak: '🔥 ¡La mejor racha de la clase!' };
    (me_.awards || []).slice(0, 2).forEach((a) => { const p = document.createElement('div'); p.className = 'es-paward'; p.textContent = AW[a] || ''; wrap.appendChild(p); });
    emoji.appendChild(wrap);
    $('end-banner').textContent = e.escaped ? '¡Escapamos en el jet!' : `¡Llegamos al nivel ${e.level || 1}!`;
    const teamEl = $('end-team-score'), meEl = $('end-personal-score');
    if (teamEl && teamEl.parentNode.firstChild) teamEl.parentNode.firstChild.nodeValue = 'Niveles superados: ';
    if (teamEl) teamEl.textContent = `${e.levelsCleared || 0} de 3 · ${e.hearts || 0} ❤️`;
    if (meEl) meEl.parentNode.style.display = 'none';
  }

  window.EscapePhone = {
    init, result, lobby, intro, end, rail,
    on: () => on,
    debug: () => ({ es, my, crew, robot, me, zones, occ, paused, dizzyMs: Math.max(0, dizzyUntil - now()) }),
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
    frame: () => { if (room && me && onZone()) { resize(); draw(); hud(true); arrowTick(); } rail(); },
    band: (kind) => {
      if (kind === 'zap') band({ kind: 'zap', robot: 'zap', title: '¡Zap! ¡Cosquillas!', sub: 'Robotín nos alcanzó: mareados 3 s', hold: true });
      if (kind === 'time') band({ kind: 'time', img: D + 'power.webp', title: '⏱ ¡Último minuto!', sub: '¡Respondan rápido, equipo!', hold: true });
      if (kind === 'robo') band({ kind: 'robo', robot: 'chase', title: '¡Robotín despertó!', sub: 'Cada respuesta correcta es un turbo 🚀', hold: true });
      if (kind === 'timeup') band({ kind: 'time', robot: 'dizzy', title: '⏱ ¡Tiempo!', sub: 'Robotín se quedó sin batería', hold: true });
      if (kind === 'close') band({ kind: 'zap', robot: 'happy', title: '¡Robotín se acerca!', sub: 'Responde rápido: cada acierto lo aleja', hold: true });
      if (kind === 'safe') band({ kind: 'safe', img: R.SKIN_URL(mySkin()), title: '¡A salvo!', sub: '¡Toda la clase a salvo!', hold: true });
    },
    card: (kind, level) => card(kind, level),
    dizzy: (ms) => dizzy(ms || 3000),
  };
})();
