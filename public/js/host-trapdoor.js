// Las Trampillas — the projector (secondary: the kids' phones are the game). Lobby (PIN, this match's arena with
// «Cambiar arena», the rounds 5 · 7 · 10, the kingdoms, «Así se juega») → the captains' VS countdown → the whole platform
// on the arena's art (js/trapdoor-render.js: every kid with a name tag that never overlaps, the pink roulette, «0», the
// doors), the score and the round on top, each kingdom's captain and roster on the sides (wings, 🕳️ in the pit), the
// pit strip at the bottom (who fell; they rise when they come back) → bands «¡YA!», «Ronda N», «¡Ronda final!»,
// «+N en pie» → «¡FINAL!» and the shared Mario Party ceremony (js/party.js). «Otra ronda» = the next arena.
// Test hook: window.TrapdoorHost.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  const TA = window.TrapdoorArena;
  const NAMES = { red: 'Reino del Fuego', gold: 'Reino del Mar' };
  const SHORT = { red: 'Fuego', gold: 'Mar' };
  const A = '/assets/kingdoms/', TD = '/assets/trapdoor/', HC = '/assets/halcon/';
  const SFX = { tick: A + 'tick.mp3', whoosh: A + 'whoosh.mp3', win: A + 'sting-win.mp3', alert: A + 'castle-alert.mp3', star: '/assets/monopoly/star.mp3',
    open: TD + 'open.mp3', close: TD + 'close.mp3', fall: TD + 'fall.mp3', saved: TD + 'saved.mp3', back: TD + 'back.mp3', lock: TD + 'lock.mp3', round: HC + 'round.mp3', start: HC + 'start.mp3', streak: A + 'streak.mp3' };
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let pin = null, state = null, muted = false;
  let scene = null, arenaIdx = 0, matchId = null, arenaPick = 0, roundsPick = 7;
  let roster = {};           // k → [name, team, avatar]
  let kpts = {};             // k → personal points (rounds standing; the final ×2)
  let rd = null, score = { red: 0, gold: 0 };
  let raf = 0, lastT = 0;
  let music = null, musicName = null;

  function sfx(name, vol) { if (muted) return; try { const a = new Audio(SFX[name] || name); a.volume = vol || 0.6; a.play().catch(() => {}); } catch (_) {} }
  function playMusic(name, vol) {
    if (musicName === name) return;
    stopMusic(); musicName = name;
    if (muted) return;
    const url = name === 'rounds' ? TD + 'music-rounds.mp3' : A + name + '.mp3';
    try { music = new Audio(url); music.loop = true; music.volume = vol || 0.4; music.play().catch(() => {}); } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }

  $('mute-btn').addEventListener('click', () => {
    muted = window.toggleMute ? window.toggleMute() : !muted;
    $('mute-btn').textContent = muted ? '🔇 Sin sonido' : '🔊 Sonido';
    if (muted) stopMusic(); else if (!$('screen-lobby').classList.contains('hidden')) playMusic('music-lobby', 0.35);
  });
  document.addEventListener('click', () => {
    if (window.unlockAudio) window.unlockAudio();
    if (!$('screen-lobby').classList.contains('hidden')) playMusic('music-lobby', 0.35);
  }, { once: true });

  // ---------- room ----------
  const setId = new URLSearchParams(location.search).get('setId');
  // From /maestro the page opens with ?livegame=1 (pull the class in): keep that flag through the question picker.
  const LIVE = new URLSearchParams(location.search).get('livegame') === '1' ? '&livegame=1' : '';
  if (!setId) { location.href = '/packs.html?game=trapdoor' + LIVE; return; }
  function showPin(p) {
    pin = p;
    $('pin-display').textContent = p;
    $('active-pin-display').textContent = p;
    $('join-url').textContent = `${location.origin}/?pin=${p}`;
    document.title = `Las Trampillas · ${p}`;
    try { sessionStorage.setItem('draly.trapdoorHost', JSON.stringify({ pin: p, setId })); } catch (_) {}
  }
  function createRoom() {
    socket.emit('host:create', { gameType: 'trapdoor' }, (r) => {
      if (!r || !r.pin) return;
      showPin(r.pin);
      socket.emit('host:td-rounds', { pin, rounds: roundsPick }, () => {});
      socket.emit('host:load-set', { pin, setId }, (resp) => {
        if (!resp || !resp.ok) { alert('No se pudo cargar la serie de preguntas.'); location.href = '/packs.html?game=trapdoor' + LIVE; return; }
        $('set-display').textContent = `📚 ${resp.title} · ${resp.count} preguntas`;
        updateStartBtn();
      });
    });
  }
  // A reload of this tab (F5 mid-class) takes the same room back (its token: js/teacher-gate.js) instead of a new PIN:
  // the server sends the platform (td:init) or the ending again, and the class plays on.
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('draly.trapdoorHost') || 'null'); } catch (_) {}
  if (saved && saved.pin && saved.setId === setId && !LIVE) {
    socket.emit('host:reclaim', { pin: saved.pin }, (r) => {
      if (r && r.ok && r.gameType === 'trapdoor') { showPin(saved.pin); $('set-display').textContent = '📚 la serie elegida'; }
      else createRoom();
    });
  } else createRoom();
  let connectedOnce = false;
  socket.on('connect', () => { if (connectedOnce && pin) socket.emit('host:reclaim', { pin }, () => {}); connectedOnce = true; });

  $('balance-btn').addEventListener('click', () => socket.emit('host:auto-balance', { pin }));
  $('start-btn').addEventListener('click', () => socket.emit('host:start', { pin }));
  $('add-time-btn').addEventListener('click', () => socket.emit('host:add-time', { pin, seconds: 30 }));
  $('skip-btn').addEventListener('click', () => socket.emit('host:td-skip', { pin }));
  $('end-now-btn').addEventListener('click', () => { if (confirm('¿Terminar la partida ahora?')) socket.emit('host:end-now', { pin }); });
  $('play-again-btn').addEventListener('click', () => { if (ceremony) { ceremony.stop(); ceremony = null; } socket.emit('host:reset', { pin }); showScreen('lobby'); playMusic('music-lobby', 0.35); });
  socket.on('host:start-error', (e) => alert(e && e.message ? e.message : 'No se pudo empezar.'));
  // the arena: the teacher picks another in the lobby; «Otra ronda» moves on to the next one by itself
  const pickArena = (dir) => { if (pin) socket.emit('host:td-arena', { pin, arena: (((arenaPick + dir) % TA.ARENAS.length) + TA.ARENAS.length) % TA.ARENAS.length }, () => {}); };
  $('arena-next').addEventListener('click', () => pickArena(1));
  $('arena-prev').addEventListener('click', () => pickArena(-1));
  document.querySelectorAll('.th-rounds button').forEach((b) => b.addEventListener('click', () => { if (pin) socket.emit('host:td-rounds', { pin, rounds: +b.dataset.r }, () => {}); }));
  socket.on('td:arena', (d) => { if (d && d.arena != null) { arenaPick = d.arena; paintArenaCard(); } });
  const fmtMs = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`; };
  function paintArenaCard() {
    const a = TA.arena(arenaPick);
    $('arena-bg').src = TA.art(a, 'bg');
    $('arena-n').textContent = `Arena ${arenaPick + 1} de ${TA.ARENAS.length}`;
    $('arena-name').textContent = a.name;
    $('arena-place').textContent = a.place;
    document.querySelectorAll('.th-rounds button').forEach((b) => b.classList.toggle('on', +b.dataset.r === roundsPick));
    const T = TA.TIMING, b0 = TA.bounds(false), b1 = TA.bounds(true);
    $('rounds-time').textContent = '≈ ' + fmtMs(T.INTRO + (roundsPick - 1) * b0.end + b1.end);
    if (window.TrapdoorRender) window.TrapdoorRender.load(arenaPick);
  }
  paintArenaCard();

  function updateStartBtn() { if (state) $('start-btn').disabled = !(state.questionsLoaded > 0 && Object.keys(state.players || {}).length > 0); }
  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby') {
      if (s.tdArena != null && s.tdArena !== arenaPick) arenaPick = s.tdArena;
      if (s.tdRounds != null) roundsPick = s.tdRounds;
      paintArenaCard();
      renderLobby(s.players);
      updateStartBtn();
    }
    if (s.state === 'active' && !$('screen-lobby').classList.contains('hidden') && !ceremony) showScreen('active');
  });
  function renderLobby(map) {
    ['red', 'gold'].forEach((team) => {
      const box = $('players-' + team);
      box.innerHTML = '';
      const list = Object.entries(map || {}).filter(([, p]) => p.team === team);
      $('count-' + team).textContent = list.length === 1 ? '1 jugador' : `${list.length} jugadores`;
      list.forEach(([id, p]) => {
        const chip = document.createElement('button');
        chip.className = 'kd-chip';
        chip.textContent = (p.avatar ? p.avatar + ' ' : '') + p.name;
        chip.addEventListener('click', () => socket.emit('host:swap-team', { pin, playerId: id }));
        box.appendChild(chip);
      });
    });
  }

  // ---------- captains (two of the gang lead the kingdoms; revealed during the countdown, as in Reinos) ----------
  let captains = null;
  function paintCaptains(intro) {
    const C = window.DralingoCast;
    const ok = !!(captains && C);
    ['red', 'gold'].forEach((team) => {
      $('cap-' + team).classList.toggle('hidden', !ok);
      $('side-cap-' + team).classList.toggle('hidden', !ok);
      if (!ok) { $('side-capname-' + team).textContent = ''; return; }
      const id = captains[team];
      $('cap-' + team + '-img').src = C.pose(id, 'cheer');
      $('cap-' + team + '-name').textContent = C.captain(id);
      $('side-cap-' + team).src = C.pose(id, 'hello');
      $('side-capname-' + team).textContent = C.captain(id);
      if (intro) { const el = $('cap-' + team); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
    });
  }
  socket.on('td:captains', (c) => { captains = c; paintCaptains(true); });

  // ---------- countdown ----------
  socket.on('countdown', () => {
    showScreen('countdown');
    stopMusic();
    const a = TA.arena(arenaPick);
    $('count-arena').textContent = `${a.name} · ${roundsPick} rondas`;
    let n = 3;
    const num = $('countdown-num');
    num.classList.remove('go');
    const tick = () => {
      num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
      if (n > 0) { num.textContent = n; sfx('tick', 0.9); n--; setTimeout(tick, 900); }
      else { num.textContent = '¡A jugar!'; num.classList.add('go'); sfx('whoosh', 0.9); setTimeout(() => { num.classList.remove('go'); if (!ceremony) showScreen('active'); if (scene) scene.resize(); }, 900); }
    };
    tick();
  });

  // ---------- the platform ----------
  const INSET = () => ({ top: 92, bottom: 172, left: window.innerWidth > 900 ? (window.innerWidth > 1100 ? 244 : 194) : 8, right: window.innerWidth > 900 ? (window.innerWidth > 1100 ? 244 : 194) : 8 });
  socket.on('td:init', (d) => {
    if (!d || d.arena == null) return;
    const fresh = matchId !== d.id || !scene;
    matchId = d.id;
    if (!scene) scene = new window.TrapdoorRender.Scene($('td-host-canvas'), { mode: 'host' });
    if (fresh || arenaIdx !== d.arena) { arenaIdx = d.arena; scene.setArena(d.arena); document.documentElement.style.setProperty('--td-pit-bg', `url("${TA.art(TA.arena(d.arena), 'pit')}")`); }
    scene.inset = INSET();
    scene.speed = d.speed || 92;
    roster = d.roster || {};
    scene.roster(roster);
    scene.positions(d.pos || [], performance.now());
    scene.frozen = false;
    score = d.score || score;
    rd = d.r > 0 ? { r: d.r, rounds: d.rounds, kind: d.kind, final: d.final } : { r: 0, rounds: d.rounds };
    if (d.r > 0) {
      scene.round({ r: d.r, rounds: d.rounds, kind: d.kind, final: d.final, jumps: d.jumps }, d.ago, performance.now());
      if (d.set) scene.lock(d.set);
      if (d.open && d.set) scene.open(d.set, [], [], performance.now() - 400);
    }
    scene.paused = false;
    if (d.paused) scene.pause(true, performance.now());
    if (d.captains) { captains = d.captains; paintCaptains(false); }
    // (a projector whose connection dropped during the countdown never got «¡A jugar!»: straight to the platform)
    if ($('screen-active').classList.contains('hidden') && !ceremony) showScreen('active');
    if (fresh && d.phase === 'intro') { band('¡YA!', TA.arena(d.arena).name, 'start', 1900); sfx('start', 0.7); }
    playMusic(d.final ? 'music-final' : 'rounds', 0.32);
    scene.resize();
    paintTop();
    renderRosters();
    renderPit();
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(draw); }
    if (fresh) say(`¡Bienvenidos a ${TA.arena(d.arena).name}! Cuando la cuenta llegue a 0, el suelo rosa se abre. ¡Respondan para tener alas!`, null, 5200);
  });
  socket.on('td:roster', (r) => { roster = r || {}; if (scene) scene.roster(roster); renderRosters(); renderPit(); });
  socket.on('td:pos', (m) => {
    if (!scene || !m) return;
    scene.positions(m.d || [], performance.now());
    pitDirty = true;
  });
  socket.on('td:round', (m) => {
    if (!scene || !m || m.id !== matchId) return;
    const now = performance.now();
    rd = { r: m.r, rounds: m.rounds, kind: m.kind, final: m.final };
    scene.round(m, m.ago, now);
    if (m.pos) scene.positions(m.pos, now);
    (m.enter || []).forEach((k) => { const row = (m.pos || []).find((x) => x[0] === k); if (row) scene.rise(k, row[1], row[2], now); });
    if ((m.enter || []).length) { sfx('back', 0.5); risePit(m.enter); }
    if (m.final) {
      band('¡Ronda final!', '¡Vale doble! Caen 4 trampillas', 'final', 2100, [m.r, m.rounds]);
      sfx('streak', 0.8);
      playMusic('music-final', 0.42);
      $('add-time-btn').disabled = true;
    } else {
      const sub = m.kind === 'three' ? (m.r === Math.floor(m.rounds / 2) + 1 ? '¡Ahora caen 3 trampillas!' : 'Caen 3 trampillas') : 'Caen 2 trampillas';
      band(`Ronda ${m.r}`, sub, m.kind === 'three' ? 'three' : '', 1450, [m.r, m.rounds]);
      $('add-time-btn').disabled = false;
    }
    sfx('round', 0.6);
    paintTop();
  });
  socket.on('td:lock', (m) => { if (!scene || !m || m.id !== matchId) return; scene.lock(m.set); sfx('lock', 0.9); sfx('alert', 0.5); });
  socket.on('td:open', (m) => {
    if (!scene || !m || m.id !== matchId) return;
    scene.open(m.set, m.falls, m.saves, performance.now());
    sfx('open', 0.8);
    if ((m.falls || []).length) setTimeout(() => sfx('fall', 0.6), 160);
    if ((m.saves || []).length) setTimeout(() => sfx('saved', 0.6), 260);
    setTimeout(() => renderPit(), 900);           // they land in the pit when their fall ends
    const nF = (m.falls || []).length, nS = (m.saves || []).length;
    if (nS && nS >= nF) say(nS === 1 ? `¡Las alas salvaron a ${nameOf(m.saves[0])}!` : `¡${nS} se salvaron con sus alas!`, 'power', 2600);
    else if (nF >= 3) say(`¡Cayeron ${nF}! Respondan en el foso para volver`, 'wise', 2600);
  });
  socket.on('td:close', (m) => { if (!scene || !m || m.id !== matchId) return; scene.close(performance.now()); sfx('close', 0.7); });
  socket.on('td:tally', (m) => {
    if (!m || m.id !== matchId) return;
    score = m.score || score;
    if (m.sc) kpts = m.sc;
    const add = m.add || {};
    band(`🔥 +${add.red || 0}   ·   +${add.gold || 0} 🌊`, `${m.stand.red} en pie · ${m.stand.gold} en pie${m.final ? ' · ¡ronda final ×2!' : ''}`, 'tally', 1250);
    sfx('star', 0.5);
    paintTop(true);
    renderRosters();
    if (m.leadChanged && m.lead && !m.final) {
      const cap = captains && captains[m.lead];
      const C = window.DralingoCast;
      say(cap && C ? `¡El ${NAMES[m.lead]} pasa al frente! ${C.name(cap)}: «${C.line(cap, 'trampa') || C.line(cap, 'battle')}»` : `¡El ${NAMES[m.lead]} pasa al frente!`, null, 3200, cap);
      if (window.DralingoFX && !reduced()) DralingoFX.play('flyby', { text: '¡' + SHORT[m.lead] + ' adelante!', mood: 'win' });
    }
  });
  socket.on('td:rise', (m) => { if (!scene || !m || m.id !== matchId) return; scene.rise(m.k, m.x, m.y, performance.now()); sfx('back', 0.45); risePit([m.k]); });
  socket.on('td:rounds', (d) => {
    if (!d || d.id !== matchId) return;
    if (d.refused) { banner('La ronda final ya empezó'); return; }
    if (rd) rd.rounds = d.rounds;
    if (scene && scene.rd) scene.rd.rounds = d.rounds;
    band('¡+2 rondas!', `Ahora son ${d.rounds}`, '', 1300);
    paintTop();
  });
  const nameOf = (k) => (roster[k] ? roster[k][0] : '');
  function resize() { if (scene) { scene.inset = INSET(); scene.resize(); } }
  window.addEventListener('resize', resize);
  let pitDirty = false, pitAt = 0;
  function draw(t) {
    raf = requestAnimationFrame(draw);
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    if (!scene || $('screen-active').classList.contains('hidden')) return;
    if (!scene.resize()) return;
    scene.frame(t, dt);
    tickSounds();
    if (pitDirty && t - pitAt > 500) { pitAt = t; pitDirty = false; renderPit(); renderRosters(); paintTop(); }
  }
  let lastHub = null;
  function tickSounds() {
    if (!scene || !scene.rd || scene.paused || scene.frozen) { lastHub = null; return; }
    const n = TA.hubAt(scene.clock(performance.now()), scene.rd.final);
    if (n !== lastHub) { if (n != null && n > 0) sfx('tick', n <= 2 ? 0.75 : 0.5); lastHub = n; }
  }

  // ---------- the top, the sides, the pit ----------
  let shown = { red: 0, gold: 0 };
  function standing() {
    const c = { red: 0, gold: 0 };
    if (scene) Object.values(scene.kids).forEach((d) => { if (d.f != null && !(d.f & 14) && roster[d.k] && c[roster[d.k][1]] != null) c[roster[d.k][1]]++; });
    return c;
  }
  function paintTop(bumpIt) {
    const c = standing();
    $('score-red').textContent = score.red || 0;
    $('score-gold').textContent = score.gold || 0;
    if (bumpIt) { if (score.red !== shown.red) bump($('score-red')); if (score.gold !== shown.gold) bump($('score-gold')); }
    shown = { red: score.red, gold: score.gold };
    $('up-red').textContent = `${c.red} en pie`;
    $('up-gold').textContent = `${c.gold} en pie`;
    const r = rd || { r: 0, rounds: roundsPick };
    $('round-label').textContent = r.r > 0 ? (r.final ? '¡Ronda final!' : `Ronda ${r.r} de ${r.rounds}`) : '¡Prepárense!';
    $('th-round').classList.toggle('final', !!r.final);
    const dots = $('round-dots');
    if (dots.dataset.k !== r.r + '/' + r.rounds) {
      dots.dataset.k = r.r + '/' + r.rounds;
      dots.innerHTML = '';
      for (let i = 1; i <= r.rounds; i++) { const d = document.createElement('i'); d.className = i < r.r ? 'done' : i === r.r ? 'now' : ''; dots.appendChild(d); }
    }
  }
  function bump(node) { if (!node || reduced()) return; node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
  const stIcon = (d) => (!d || d.f == null ? '' : d.f & 2 ? '🕳️' : d.f & 4 ? '⬆️' : d.f & 8 ? '💤' : d.f & 17 ? 'wings' : '');
  function renderRosters() {
    ['red', 'gold'].forEach((team) => {
      const ul = $('roster-' + team);
      const list = Object.entries(roster).filter(([, v]) => v[1] === team).map(([k, v]) => ({ k, name: v[0], pts: kpts[k] || 0, d: scene && scene.kids[k] }))
        .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
      const key = list.map((p) => p.k + ':' + p.pts + ':' + stIcon(p.d)).join(',');
      if (ul.dataset.k === key) return;
      ul.dataset.k = key;
      ul.innerHTML = '';
      list.slice(0, 11).forEach((p) => {
        const li = document.createElement('li');
        if (p.d && p.d.f & 6) li.className = 'pit';
        const n = document.createElement('span');
        const ic = stIcon(p.d);
        if (ic === 'wings') { const w = document.createElement('img'); w.className = 'th-wing'; w.alt = 'alas'; w.src = '/assets/trapdoor/wings.webp'; n.append(w, document.createTextNode(' ' + p.name)); }
        else n.textContent = (ic ? ic + ' ' : '') + p.name;
        const sc = document.createElement('span'); sc.textContent = p.pts;
        li.append(n, sc); ul.appendChild(li);
      });
      if (list.length > 11) { const li = document.createElement('li'); li.className = 'more'; li.textContent = `y ${list.length - 11} más`; ul.appendChild(li); }
    });
  }
  function renderPit() {
    const box = $('pitstrip');
    if (!box || !scene) return;
    const down = Object.values(scene.kids).filter((d) => d.f != null && (d.f & 6) && roster[d.k] && !d.fall);
    const key = down.map((d) => d.k + ':' + (d.f & 6)).join(',');
    if (box.dataset.k === key) return;
    box.dataset.k = key;
    box.querySelectorAll('.th-pitkid:not(.up)').forEach((n) => n.remove());
    $('pit-empty').hidden = down.length > 0;
    const HB = window.HalconBoard;
    down.slice(0, 15).forEach((d) => {
      const v = roster[d.k];
      const fig = document.createElement('div');
      fig.className = 'th-pitkid ' + (v[1] === 'gold' ? 'gold' : 'red') + (d.f & 4 ? ' ready' : '');
      fig.dataset.k = d.k;
      const im = document.createElement('img');
      im.alt = '';
      im.src = HB ? HB.art(HB.skinFor(v[2], v[0]), d.f & 4 ? 'ok' : 'no') : '/assets/dralingo/hello.webp';
      const n = document.createElement('span'); n.textContent = v[0];
      fig.append(im, n);
      box.appendChild(fig);
    });
    if (down.length > 15) { const more = document.createElement('span'); more.className = 'th-pit-empty th-pitkid'; more.textContent = `+${down.length - 15}`; box.appendChild(more); }
  }
  // kids rising out of the pit: their figure flies up out of the strip
  function risePit(ks) {
    const box = $('pitstrip');
    (ks || []).forEach((k) => { const n = box.querySelector(`.th-pitkid[data-k="${k}"]`); if (n) { n.classList.add('up'); setTimeout(() => n.remove(), 520); } });
    box.dataset.k = '';
    setTimeout(renderPit, 560);
  }

  // ---------- bands, Dralingo / the captains ----------
  let bandT = null;
  function band(title, sub, cls, ms, dots) {
    const b = $('th-band');
    b.className = 'th-band ' + (cls || '');
    $('th-band-title').textContent = title;
    $('th-band-sub').textContent = sub || '';
    const d = $('th-band-dots');
    d.innerHTML = '';
    if (dots) for (let i = 1; i <= dots[1]; i++) { const x = document.createElement('i'); x.className = i < dots[0] ? 'done' : i === dots[0] ? 'now' : ''; d.appendChild(x); }
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bandT);
    if (ms < 0) return;                  // (test hook: held for a still)
    bandT = setTimeout(() => b.classList.remove('show'), ms || 1400);
  }
  let sayT = null, lastSay = 0;
  function say(text, pose, ms, cast) {
    const now = Date.now();
    if (now - lastSay < 2500) return;
    lastSay = now;
    const C = window.DralingoCast;
    $('th-say-text').textContent = text;
    $('th-say-img').src = cast && C ? C.pose(cast, 'cheer') : '/assets/dralingo/' + (pose || 'point') + '.webp';
    $('th-say').classList.add('show');
    clearTimeout(sayT);
    sayT = setTimeout(() => $('th-say').classList.remove('show'), ms || 3600);
  }
  let bannerTimer = null;
  function banner(text, team) {
    document.querySelectorAll('.kd-banner').forEach((b) => b.remove());
    const b = document.createElement('div');
    b.className = 'kd-banner' + (team ? ' ' + team : '');
    b.textContent = text;
    document.body.appendChild(b);
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.remove(), 3100);
  }

  // ---------- «⏸ Pausa»: the clock stops, the platform stands still; the card lets the buttons under it work ----------
  let hostPaused = false;
  function showHostPaused(v) {
    hostPaused = !!v;
    $('pause-btn').textContent = hostPaused ? '▶ Seguir' : '⏸ Pausa';
    if (window.DralyParty) DralyParty.pauseCard(hostPaused, { mode: 'host' });
    if (hostPaused) stopMusic(); else if (!$('screen-active').classList.contains('hidden')) playMusic(rd && rd.final ? 'music-final' : 'rounds', 0.32);
  }
  $('pause-btn').addEventListener('click', () => socket.emit('host:pause', { pin, paused: !hostPaused }));
  socket.on('td:pause', (d) => { if (!d) return; if (scene) scene.pause(!!d.paused, performance.now(), d.paused ? null : d.ago); showHostPaused(d.paused); });
  socket.on('td:init', (d) => { if (d && !!d.paused !== hostPaused) showHostPaused(d.paused); });

  // ---------- the Mario Party ending (js/party.js): «¡FINAL!», the ceremony, «Otra ronda» ----------
  let ceremony = null;
  const playUrl = (url, vol) => { if (muted) return; try { const a = new Audio(url); a.volume = vol == null ? 0.7 : vol; a.play().catch(() => {}); } catch (_) {} };
  const FINAL_SUB = { time: '¡Terminó la ronda final!', end: '¡Fin de la partida!' };
  socket.on('fin:final', (d) => {
    stopMusic();
    if (scene) scene.frozen = true;
    $('th-band').classList.remove('show');
    $('th-say').classList.remove('show');
    if (window.DralyParty) { DralyParty.clearChip(); DralyParty.final({ mode: 'host', ms: d && d.ms, sub: FINAL_SUB[d && d.why] || FINAL_SUB.end, play: playUrl }); }
  });
  function partyEnd(d) {
    if (hostPaused) showHostPaused(false);
    if (!window.DralyParty || !d || !d.fin) return false;
    document.documentElement.style.setProperty('--td-arena-bg', `url("${TA.art(TA.arena(d.fin.arena || 0), 'bg')}")`);
    if (ceremony) ceremony.stop();
    ceremony = new DralyParty.Ceremony({
      mode: 'host', game: 'trapdoor', data: d, mount: document.body, play: playUrl,
      onSkip: () => socket.emit('host:fin-skip', { pin }),
      onAgain: () => { ceremony = null; $('play-again-btn').click(); },
      onHome: () => { location.href = '/'; },
    });
    return true;
  }
  socket.on('state', (s) => { if (s && s.state === 'lobby' && ceremony) { ceremony.stop(); ceremony = null; } });
  socket.on('game-end', (d) => {
    stopMusic();
    cancelAnimationFrame(raf); raf = 0;           // the frozen platform under the ceremony needs no more frames
    if (partyEnd(d)) return;
    showScreen('win');
    const r = d.teamScores.red || 0, gg = d.teamScores.gold || 0;
    $('final-red').textContent = r; $('final-gold').textContent = gg;
    $('win-banner').textContent = d.winner === 'red' || d.winner === 'gold' ? `¡Gana el ${NAMES[d.winner]}!` : '¡Empate en las trampillas!';
  });

  function showScreen(name) { ['lobby', 'countdown', 'active', 'win'].forEach((n) => $('screen-' + n).classList.toggle('hidden', n !== name)); if (name === 'lobby') { rd = null; $('add-time-btn').disabled = false; } }

  window.TrapdoorHost = {
    scene: () => scene,
    band: (t, s, cls) => band(t, s, cls, -1),
    say: (t, cast) => { lastSay = 0; say(t, null, 60000, cast); },
    frame: () => { if (scene && scene.resize()) scene.frame(performance.now(), 1 / 60); renderPit(); renderRosters(); paintTop(); },
    hold: (ms) => { if (!scene || !scene.rd) return; if (ms == null) { scene.paused = false; return; } scene.paused = true; scene.pausedAt = scene.rd.start + ms; },
  };
})();
