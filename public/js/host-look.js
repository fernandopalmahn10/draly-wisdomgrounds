// Ojo de Halcón — projector view.
// Lobby (PIN, the contestants as their saga avatars, the 3 steps, the rounds picker) → the show intro in the countdown
// (title card, Hamdan's welcome, every kid in a panel, 3-2-1) → the board: the question alone on the LED wall, then
// the four answers light up around it on the server's schedule, every kid's panel turns toward the lamp they tapped,
// the +5 / +3 / +2 / +1 pop in rank order, the falcon of the saga lands on the right answer → «¡FINAL!» → the winner on
// stage with a crown, top 6, the awards, the gang. Big moments one at a time; the teacher's buttons always work.
// Test hooks: LookHost.hold(true) keeps pops/moments on screen; LookHost.frame() returns what is on the board.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const Cast = window.DralingoCast || null;
  const K = '/assets/kingdoms/', LK = '/assets/look/', D = '/assets/dralingo/', AV = '/assets/saga/avatars/';
  const SFX = {
    tick: K + 'tick.mp3', whoosh: K + 'whoosh.mp3', win: K + 'sting-win.mp3', wrong: K + 'wrong.mp3', streak: K + 'streak.mp3', alert: K + 'castle-alert.mp3',
    pop: LK + 'pop.mp3', lock: LK + 'lock.mp3', round: LK + 'round.mp3', pts: LK + 'pts.mp3', first: LK + 'first.mp3', final: LK + 'final.mp3',
  };
  const MUSIC = { lobby: K + 'music-lobby.mp3', show: LK + 'music-show.mp3', final: K + 'music-final.mp3' };
  const POP = { 5: '+5 ¡Primero!', 3: '+3', 2: '+2', 1: '+1' };
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skinUrl = (skin) => AV + (skin || 'dralingo') + '.webp';
  const skinFor = (avatar, name) => {
    const S = window.Saga;
    const a = S && S.byEmoji ? S.byEmoji(avatar) : null;
    if (a) return a.id;
    if (S && S.avatar && S.avatar(avatar)) return avatar;
    const s = String(name || '').toLowerCase();
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const ids = (S && S.AVATARS ? S.AVATARS : [{ id: 'dralingo' }]).map((x) => x.id);
    return ids[h % ids.length];
  };

  let pin = null, state = null, muted = false, lobbyPlayers = null;
  let lk = null;                 // the game right now (lk:init / lk:round / lk:result)
  let roster = {};               // idx → { name, skin, on, score, streak }
  let cast = null, rounds = 10, round = 0, paused = false;
  let revealTimers = [], lit = [false, false, false, false], correctPos = -1, resultShown = 0;
  let lastMoment = 0, testHold = false, music = null, musicName = null, sayTimer = null, lastSay = 0, cheerI = 0;
  const seenChips = new Set();

  // ---------- sound ----------
  const lastSfx = {};
  function sfx(name, vol, gap) {
    if (muted || !SFX[name]) return;
    const now = Date.now();
    if (gap && now - (lastSfx[name] || 0) < gap) return;
    lastSfx[name] = now;
    try { const a = new Audio(SFX[name]); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {}
  }
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic();
    musicName = name;
    if (muted || !MUSIC[name]) return;
    try { music = new Audio(MUSIC[name]); music.loop = true; music.volume = vol || 0.34; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }
  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) stopMusic(); else musicFor();
  });
  document.addEventListener('click', () => { if (window.unlockAudio) window.unlockAudio(); musicFor(); }, { once: true });
  function musicFor() {
    if (muted) return;
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('lobby', 0.33);
    else if (!$('screen-active').classList.contains('hidden') && !paused) playMusic('show', 0.3);
  }

  // ---------- room ----------
  const params = new URLSearchParams(location.search);
  const setId = params.get('setId');
  const LIVE = params.get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=look' + LIVE; return; }
  socket.emit('host:create', { gameType: 'look' }, ({ pin: p }) => {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Ojo de Halcón · ${p}`;
    socket.emit('host:lk-rounds', { pin, rounds });
    socket.emit('host:load-set', { pin, setId }, (resp) => {
      if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=look' + LIVE; return; }
      $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
      updateStartBtn();
    });
  });
  let connectedOnce = false;
  socket.on('connect', () => { if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {}); connectedOnce = true; });
  document.querySelectorAll('.lk-rounds button').forEach((b) => b.addEventListener('click', () => {
    rounds = +b.dataset.r;
    document.querySelectorAll('.lk-rounds button').forEach((x) => x.classList.toggle('on', x === b));
    socket.emit('host:lk-rounds', { pin, rounds });
  }));
  $('start-btn').addEventListener('click', () => { $('start-btn').disabled = true; socket.emit('host:start', { pin }); });
  $('skip-btn').addEventListener('click', () => socket.emit('host:lk-skip', { pin }));
  $('more-btn').addEventListener('click', () => socket.emit('host:lk-more', { pin }));   // the server's lk:rounds confirms with a banner
  $('end-now-btn').addEventListener('click', () => { if (confirm('¿Terminar el concurso ahora?')) socket.emit('host:end-now', { pin }); });
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !paused }));
  $('resume-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: false }));
  $('play-again-btn').addEventListener('click', () => {
    socket.emit('host:reset', { pin });
    lk = null; roster = {}; round = 0; clearReveals();
    document.querySelectorAll('.dfx-layer, .kd-confetti, .kd-banner').forEach((e) => e.remove());   // nothing from the show lingers in the lobby
    showScreen('lobby');
    musicFor();
  });
  socket.on('host:start-error', (e) => { alert(e && e.message ? e.message : 'No se pudo empezar.'); updateStartBtn(); });
  function updateStartBtn() {
    if (!state) return;
    $('start-btn').disabled = !(state.state === 'lobby' && state.questionsLoaded > 0 && Object.keys(state.players || {}).length > 0);
  }
  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') { renderLobby(s.players); updateStartBtn(); }
    if (s.state === 'active' && lk) syncFromState(s);
  });
  function renderLobby(players) {
    const key = JSON.stringify(players || {});
    if (key === JSON.stringify(lobbyPlayers)) return;
    lobbyPlayers = JSON.parse(key);
    const box = $('players-all');
    box.innerHTML = '';
    const list = Object.values(players || {}).filter((p) => !p.off);
    $('count-all').textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
    box.classList.toggle('dense', list.length > 16);
    box.classList.toggle('xdense', list.length > 28);
    list.forEach((p) => {
      const chip = document.createElement('span');
      chip.className = 'lk-chip' + (seenChips.has(p.name) ? '' : ' new');
      seenChips.add(p.name);
      const im = document.createElement('img');
      im.src = skinUrl(skinFor(p.avatar, p.name)); im.alt = '';
      chip.append(im, document.createTextNode(p.name));
      box.appendChild(chip);
    });
    if (!list.length) { const e = document.createElement('p'); e.className = 'lk-crew-empty'; e.textContent = 'Esperando a los concursantes: entren con el PIN.'; box.appendChild(e); }
  }
  // scores and who is connected ride on the room's state (publicState) between rounds
  function syncFromState(s) {
    const byName = {};
    Object.values(s.players || {}).forEach((p) => { byName[p.name] = p; });
    Object.values(roster).forEach((r) => { const p = byName[r.name]; if (p) { r.on = !p.off; if (typeof p.score === 'number') r.score = p.score; } });
    paintPanels(false);
    paintLeaders();
  }

  // ---------- countdown: the show intro ----------
  socket.on('lk:cast', (c) => { cast = c; });
  socket.on('countdown', () => {
    showScreen('countdown');
    stopMusic();
    const row = $('intro-kids');
    row.innerHTML = '';
    const list = Object.values(lobbyPlayers || (state && state.players) || {}).filter((p) => !p.off);
    const shown = list.length > 16 ? 15 : list.length;
    list.slice(0, shown).forEach((p, i) => {
      const d = document.createElement('div');
      d.className = 'lk-ipanel';
      d.style.setProperty('--i', i);
      const im = document.createElement('img'); im.src = skinUrl(skinFor(p.avatar, p.name)); im.alt = '';
      const b = document.createElement('b'); b.textContent = p.name;
      d.append(im, b);
      row.appendChild(d);
    });
    if (list.length > shown) { const more = document.createElement('b'); more.textContent = `+${list.length - shown}`; row.appendChild(more); }
    const host = (cast && cast.host) || 'hamdan';
    $('intro-host').src = Cast ? Cast.pose(host, 'hello') : '/assets/cast/hamdan-hello.webp';
    $('intro-line').textContent = host === 'hamdan' ? '¡Marhaba! Bienvenidos al concurso más rápido de Dubái.' : (Cast ? Cast.line(host, 'hello') : '¡Bienvenidos!');
    let n = 3;
    const num = $('countdown-num');
    num.classList.remove('go');
    const tick = () => {
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if (n > 0) { num.textContent = n; sfx('tick', 0.9); n--; setTimeout(tick, 900); }
      else {
        num.textContent = '¡Mira!'; num.classList.add('go'); sfx('whoosh', 0.9);
        setTimeout(() => { num.classList.remove('go'); showScreen('active'); musicFor(); }, 800);
      }
    };
    tick();
    sfx('round', 0.6);
  });

  // ---------- the game ----------
  socket.on('lk:init', (d) => {
    lk = d;
    roster = d.players || {};
    cast = d.cast || cast;
    rounds = d.rounds; round = d.round;
    if ($('screen-active').classList.contains('hidden') && $('screen-countdown').classList.contains('hidden')) showScreen('active');
    setPaused(!!d.paused, true);
    buildPanels();
    paintDots();
    paintLeaders();
    if (d.q) {
      applyRound({ round: d.round, rounds: d.rounds, text: d.q.text, image: d.q.image, opts: d.q.opts, at: d.q.at, showMs: d.q.showMs, closeMs: d.q.closeMs }, true);
      (d.looks || []).forEach(([idx, pos, ok]) => panelLook(idx, pos, !!ok));
      if (d.phase === 'result' && d.q.correctPos >= 0) markCorrect(d.q.correctPos, false);
    } else if (d.phase === 'intro') {
      $('prompt-text').textContent = '¡Atentos!';
      wallMsg('¡Mira la respuesta correcta!', true);
      say('¡Mira bien, equipo! El más rápido gana +5.', 'hello');
    } else if (d.phase === 'final') {
      finalBeat();
    }
  });
  socket.on('lk:roster', (d) => { roster = d.players || roster; buildPanels(); paintLeaders(); });
  socket.on('lk:rounds', (d) => { rounds = d.rounds; $('round-of').textContent = `de ${rounds}`; paintDots(); banner(`¡Ahora son ${rounds} rondas! 🔁`); });
  socket.on('lk:round', (d) => applyRound(d, false));
  socket.on('lk:look', (d) => { if (!lk || d.round !== round) return; panelLook(d.idx, d.pos, d.ok); if (d.ok && d.rank === 1) sfx('lock', 0.7, 300); else if (!d.ok) sfx('wrong', 0.35, 400); });
  socket.on('lk:result', (res) => showResult(res));
  socket.on('lk:pause', (d) => {
    setPaused(!!d.paused, false);
    if (!d.paused && d.q) { clearReveals(); scheduleReveals(d.q.at, true); }
  });
  socket.on('lk:final', () => finalBeat());

  let closeAt = 0;
  function applyRound(d, fromInit) {
    clearReveals();
    round = d.round; rounds = d.rounds;
    lit = [false, false, false, false]; correctPos = -1; resultShown = 0;
    closeAt = Date.now() + (d.closeMs || 0);
    $('round-label').textContent = `Ronda ${round}`;
    $('round-of').textContent = `de ${rounds}`;
    paintDots();
    hideWallMsg();
    // the question alone
    const pr = $('prompt');
    pr.classList.remove('waiting');
    $('prompt-text').textContent = d.text || '';
    const im = $('prompt-img');
    if (d.image) { im.src = d.image; im.classList.remove('hidden'); } else { im.classList.add('hidden'); im.removeAttribute('src'); }
    // the lamps: dark, their words ready
    document.querySelectorAll('.lk-lamp').forEach((el) => {
      const pos = +el.dataset.pos;
      el.className = 'lk-lamp ' + ['top', 'right', 'bottom', 'left'][pos];
      const sp = el.querySelector('span');
      const t = d.opts && d.opts[pos] != null ? String(d.opts[pos]) : '';
      sp.textContent = t;
      sp.className = t.length > 26 ? 't-xs' : t.length > 16 ? 't-sm' : t.length > 10 ? 't-md' : '';
    });
    // every panel back to attention
    document.querySelectorAll('.lk-panel').forEach((el) => { el.className = 'lk-panel' + (el.classList.contains('off') ? ' off' : ''); const pop = el.querySelector('.lk-ppop'); if (pop) pop.className = 'lk-ppop'; });
    $('falcon').classList.remove('fly');
    if (!fromInit) { sfx('round', 0.7); if (d.last) setTimeout(() => moment({ img: D + 'power.webp', title: '¡Última ronda!', sub: 'La que decide el concurso', ms: 1900, hot: true }), 150); }
    scheduleReveals(d.at, fromInit);
  }
  function scheduleReveals(at, quiet) {
    (at || []).forEach((ms, pos) => {
      if (ms == null || lit[pos]) return;
      if (ms <= 0) light(pos, quiet);
      else revealTimers.push(setTimeout(() => light(pos, false), ms));
    });
  }
  function clearReveals() { revealTimers.forEach(clearTimeout); revealTimers = []; }
  function light(pos, quiet) {
    if (lit[pos] || paused) return;
    lit[pos] = true;
    const el = document.querySelector(`.lk-lamp[data-pos="${pos}"]`);
    if (!el) return;
    el.classList.add('lit');
    if (!quiet) sfx('pop', 0.75, 60);
  }
  function panelLook(idx, pos, ok) {
    const el = document.querySelector(`.lk-panel[data-idx="${idx}"]`);
    if (!el) return;
    el.classList.remove('look-0', 'look-1', 'look-2', 'look-3', 'ok', 'wrong');
    el.classList.add('look-' + pos, ok ? 'ok' : 'wrong');
  }
  function markCorrect(pos, fly) {
    correctPos = pos;
    document.querySelectorAll('.lk-lamp').forEach((el) => {
      const p = +el.dataset.pos;
      if (p === pos) { el.classList.add('lit', 'correct'); el.classList.remove('dim'); } else el.classList.add('dim');
    });
    // the falcon perches on the top-right corner of the right lamp (never over its word)
    const lamp = document.querySelector(`.lk-lamp[data-pos="${pos}"]`);
    const f = $('falcon');
    if (lamp && f) {
      const b = $('board').getBoundingClientRect(), r = lamp.getBoundingClientRect();
      const x = (r.right - Math.min(60, r.width * 0.25) - b.left) / b.width * 100, y = (r.top - b.top) / b.height * 100;
      if (fly) { f.style.left = '92%'; f.style.top = '6%'; void f.offsetWidth; }
      f.style.left = x + '%'; f.style.top = y + '%';
      $('falcon-img').src = reduced() ? '/assets/saga/anim/falcon-still.webp' : '/assets/saga/anim/falcon.webp';
      f.classList.add('fly');
    }
  }
  function showResult(res) {
    if (!lk || res.round !== round) return;
    clearReveals();
    resultShown = Date.now();
    if (typeof window.__lkOnResult === 'function') { try { window.__lkOnResult(res); } catch (_) {} }   // screenshot runs
    markCorrect(res.correctPos, true);
    // pops in rank order: the +5 first with its sting, then the rest, the wrong ones last
    const rows = res.rows.slice().sort((a, b) => (a.ok && b.ok ? a.rank - b.rank : a.ok ? -1 : b.ok ? 1 : 0));
    rows.forEach((r, i) => {
      const delay = r.ok ? Math.min(i, 8) * 110 : 900 + Math.min(i, 8) * 40;
      setTimeout(() => {
        const el = document.querySelector(`.lk-panel[data-idx="${r.idx}"]`);
        const ro = roster[r.idx];
        if (ro) { ro.score = r.score; ro.streak = r.streak; }
        if (!el) return;
        const pop = el.querySelector('.lk-ppop');
        if (r.looked) { el.classList.remove('look-0', 'look-1', 'look-2', 'look-3'); el.classList.add('look-' + r.pos, r.ok ? 'ok' : 'wrong'); }
        pop.textContent = r.pts ? POP[r.pts] || `+${r.pts}` : (r.looked ? '0' : '…');
        pop.className = 'lk-ppop show' + (r.pts === 5 ? ' five' : r.pts === 0 ? ' zero' : '');
        const sc = el.querySelector('.lk-pname b');
        if (sc) sc.textContent = r.score;
        if (r.pts === 5) sfx('first', 0.8); else if (r.pts) sfx('pts', 0.5, 90);
      }, delay);
    });
    setTimeout(() => { paintLeaders(); if (!testHold) document.querySelectorAll('.lk-panel .lk-ppop').forEach((p) => p.classList.remove('show')); }, 2500);
    // Dralingo and the gang: the first eye, a streak, half-time
    const first = res.first;
    if (first && Math.random() < 0.45) say(`¡${first.name} la vio primero! ${Math.round(first.ms / 100) / 10 < 1 ? '¡Menos de un segundo!' : '+5'}`, 'power');
    const hot = res.rows.find((r) => r.ok && (r.streak === 3 || r.streak === 5 || r.streak === 8));
    if (hot && cast && cast.cheers && window.DralingoFX && Date.now() - lastMoment > 7000 && !testHold) {
      const id = cast.cheers[cheerI++ % cast.cheers.length];
      lastMoment = Date.now();
      setTimeout(() => { if (window.DralingoFX.play('cameo', { char: id, mood: 'win', text: `¡Qué ojo, ${hot.name}! Racha de ${hot.streak} 🔥` })) sfx('streak', 0.6); }, 1200);
    } else if (res.round === Math.ceil(res.rounds / 2) && !res.last) {
      setTimeout(() => say('¡Mitad del concurso! ¿Quién tiene el ojo más rápido?', 'wise'), 1500);
    }
  }
  function finalBeat() {
    clearReveals();
    hideWallMsg();
    $('falcon').classList.remove('fly');
    document.querySelectorAll('.lk-lamp').forEach((el) => { el.classList.remove('lit', 'correct', 'dim'); el.querySelector('span').textContent = ''; });
    $('prompt-text').textContent = '¡Se acabaron las rondas!';
    $('prompt').classList.add('waiting');
    $('prompt-img').classList.add('hidden');
    wallMsg('¡FINAL!', true);
    sfx('final', 0.9);
    stopMusic();
  }

  // ---------- the LED wall ----------
  function buildPanels() {
    const grid = $('grid');
    const ids = Object.keys(roster).map(Number).sort((a, b) => a - b);
    const n = ids.length;
    const cols = n <= 4 ? Math.max(1, n) : n <= 8 ? 4 : n <= 18 ? 6 : n <= 32 ? 8 : 10;
    grid.style.setProperty('--cols', cols);
    grid.className = 'lk-grid ' + (n <= 4 ? 'size-xl' : n <= 8 ? 'size-lg' : n <= 18 ? 'size-md' : n <= 32 ? 'size-sm' : 'size-xs');
    ids.forEach((idx) => {
      let el = grid.querySelector(`.lk-panel[data-idx="${idx}"]`);
      const r = roster[idx];
      if (!el) {
        el = document.createElement('div');
        el.className = 'lk-panel';
        el.dataset.idx = idx;
        el.innerHTML = '<span class="lk-eye" aria-hidden="true"></span><img alt=""><div class="lk-pname"><span></span><b>0</b></div><div class="lk-ppop"></div>';
        grid.appendChild(el);
      }
      el.querySelector('img').src = skinUrl(r.skin);
      el.querySelector('.lk-pname span').textContent = r.name;
      el.querySelector('.lk-pname b').textContent = r.score || 0;
      el.classList.toggle('off', r.on === false);
    });
  }
  function paintPanels() {
    Object.keys(roster).forEach((idx) => {
      const el = document.querySelector(`.lk-panel[data-idx="${idx}"]`);
      if (!el) return;
      el.classList.toggle('off', roster[idx].on === false);
      const b = el.querySelector('.lk-pname b');
      if (b && resultShown === 0) b.textContent = roster[idx].score || 0;
    });
  }
  function paintDots() {
    const box = $('dots');
    box.innerHTML = '';
    for (let i = 1; i <= rounds; i++) {
      const d = document.createElement('i');
      if (i < round) d.className = 'done'; else if (i === round) d.className = 'now';
      box.appendChild(d);
    }
  }
  function paintLeaders() {
    const top = Object.values(roster).filter((r) => r.on !== false || r.score > 0).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
    const box = $('leaders');
    box.innerHTML = '';
    top.forEach((r) => {
      const c = document.createElement('span');
      c.className = 'lk-leader';
      const im = document.createElement('img'); im.src = skinUrl(r.skin); im.alt = '';
      const nm = document.createTextNode(r.name);
      const b = document.createElement('b'); b.textContent = r.score || 0;
      c.append(im, nm, b);
      box.appendChild(c);
    });
  }
  function wallMsg(text, gold) {
    const m = $('wall-msg');
    m.textContent = text;
    m.className = 'lk-wall-msg' + (gold ? ' gold' : '');
  }
  function hideWallMsg() { $('wall-msg').classList.add('hidden'); }

  // ---------- big beats, Dralingo, pause ----------
  let momentTimer = null;
  function moment(o) {
    const now = Date.now();
    if (now - lastMoment < 7000 && !o.force) return false;
    lastMoment = now;
    $('moment-img').src = o.img || D + 'hello.webp';
    $('moment-title').textContent = o.title || '';
    $('moment-title').className = 'lk-moment-title' + (o.gold ? ' gold' : '');
    $('moment-sub').textContent = o.sub || '';
    $('moment').classList.remove('hidden');
    if (o.hot) sfx('alert', 0.5);
    clearTimeout(momentTimer);
    momentTimer = setTimeout(() => { if (!testHold) $('moment').classList.add('hidden'); }, o.ms || 2000);
    return true;
  }
  function say(text, pose) {
    const now = Date.now();
    if (now - lastSay < 4000) return;
    lastSay = now;
    clearTimeout(sayTimer);
    $('dralingo-say').textContent = text;
    $('dralingo-img').src = D + (pose || 'hello') + '.webp';
    $('dralingo').classList.add('show');
    sayTimer = setTimeout(() => { if (!testHold) $('dralingo').classList.remove('show'); }, 4200);
  }
  function setPaused(on, quiet) {
    if (on === paused && !quiet) return;
    paused = on;
    $('paused').classList.toggle('hidden', !on);
    $('pause-btn').textContent = on ? '▶ Seguir' : '⏸ Pausa';
    if (on) { clearReveals(); stopMusic(); } else musicFor();
  }

  // ---------- end ----------
  socket.on('game-end', (d) => {
    clearReveals();
    stopMusic();
    $('dralingo').classList.remove('show');
    setPaused(false, true);
    const L = d.look || {};
    const show = () => {
      $('moment').classList.add('hidden');
      showScreen('win');
      const w = L.winner;
      $('win-img').src = skinUrl(w && w.skin);
      $('win-name').textContent = L.tie ? (L.winners || []).map((x) => x.name).join(' y ') : (w ? w.name : 'Nadie');
      $('win-why').textContent = w ? (L.tie ? `¡Empate con ${w.score} puntos!` : `${w.score} puntos: el ojo más rápido de Dubái`) : 'Nadie jugó esta vez';
      const t6 = $('top6');
      t6.innerHTML = '';
      (L.top || []).slice(0, 6).forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'lk-row';
        row.style.setProperty('--i', i);
        const im = document.createElement('img'); im.src = skinUrl(r.skin); im.alt = '';
        const nm = document.createTextNode(`${i + 1}. ${r.name}`);
        const b = document.createElement('b'); b.textContent = r.score;
        row.append(im, nm, b);
        t6.appendChild(row);
      });
      const aw = $('awards');
      aw.innerHTML = '';
      const A_ = L.awards || {};
      [['eye', '🦅', 'Ojo de Halcón', (r) => `${r.firsts} ${r.firsts === 1 ? 'vez' : 'veces'} la primera mirada`],
        ['fastest', '⚡', 'Rayo', (r) => `${(r.avg / 1000).toFixed(1).replace('.', ',')} s de reacción`],
        ['streak', '🔥', 'Racha', (r) => `${r.best} seguidas`]].forEach(([k, ico, title, stat], i) => {
        const r = A_[k];
        if (!r) return;
        const c = document.createElement('div');
        c.className = 'lk-award';
        c.style.setProperty('--i', i);
        const im = document.createElement('img'); im.src = skinUrl(r.skin); im.alt = '';
        const t = document.createElement('span'); t.className = 'lk-award-t'; t.textContent = `${ico} ${title}`;
        const n = document.createElement('b'); n.textContent = r.name;
        const s = document.createElement('small'); s.textContent = stat(r);
        c.append(im, t, n, s);
        aw.appendChild(c);
      });
      sfx('win', 0.9);
      playMusic('final', 0.3);
      confetti(['#ffc93c', '#ffe28a', '#4fe39b', '#ffffff'], 80);
      // the gang comes in once the awards have been read (they stand at the bottom for ~3 s)
      setTimeout(() => { if (window.DralingoFX && !$('screen-win').classList.contains('hidden')) window.DralingoFX.play('gang', { text: w ? `¡Qué ojo, ${w.name}!` : '¡Buen concurso!', mood: 'win', stamp: false, chars: cast && cast.host ? [cast.host] : [] }); }, 3200);
    };
    if (!$('screen-active').classList.contains('hidden') && $('wall-msg').textContent !== '¡FINAL!') { finalBeat(); setTimeout(show, 1800); }
    else setTimeout(show, 600);
  });

  // ---------- small helpers ----------
  let bannerTimer = null;
  function banner(text) {
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'kd-banner';
    b.textContent = text;
    document.body.appendChild(b);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.remove(), 3100);
  }
  function confetti(colors, n) {
    if (reduced()) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'kd-confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2.2 + Math.random() * 2 + 's';
      c.style.animationDelay = Math.random() * 1.2 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5600);
    }
  }
  function showScreen(name) {
    ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name));
  }
  new Image().src = '/assets/saga/anim/falcon.webp';     // the falcon is ready for round 1

  window.LookHost = {
    hold: (v) => { testHold = !!v; },
    frame: () => ({ round, rounds, lit: lit.slice(), correctPos, paused, closeAt, resultShown, panels: Object.keys(roster).length, screen: ['lobby', 'countdown', 'active', 'win'].find((n) => !$('screen-' + n).classList.contains('hidden')) }),
    moment, say,
  };
})();
