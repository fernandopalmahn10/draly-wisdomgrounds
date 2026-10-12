// Reinos de Colores — the kid's phone experience (only while gameType is 'kingdoms'; other games untouched).
// Adds on top of player.js: pastel look (css body.kd-phone), a live "my kingdom vs theirs" bar, a 20 s question timer
// with ticking, Dralingo stickers (Higgsfield poses) for countdown / thinking / right / wrong / win / lose, and real
// recorded sounds + music (Kenney) instead of the synthesized beeps.
// player.js listeners run after ours, so DOM tweaks that depend on player.js's render use afterRender().
(function () {
  const A = '/assets/kingdoms/';
  const POSE = (n) => A + 'dralingo/' + n + '.webp';
  // Team colours on the characters (his rule 2026-10-11): a Fuego kid sees the red Dralingo in both team games.
  const RED_POSES = ['jump', 'flag', 'shocked', 'thinking', 'pointing', 'champion', 'countdown'];
  const TPOSE = (n) => POSE(n + (ctx && game !== 'snow' && ctx.getTeam() === 'red' && RED_POSES.includes(n) ? '-red' : ''));
  // Batalla de Nieve: no red/blue kingdoms, two sides that change during the round (counts from the sn:* events)
  let snowInfo = { sun: 0, ice: 0, side: 'sun' };
  let captains = null;           // Reinos de Colores: { red, gold } cast ids of this round's captains
  const Q_MS = 20000;            // time to answer each question
  let ctx = null;
  let on = false;
  let muted = false;
  let scores = { red: 0, gold: 0 };
  let myPaint = 0;             // Dragones Pintores: clouds this kid owns (from pc:paint / game-end)
  let curQid = null;           // question on screen (a resync re-sends the same one: keep its countdown)
  let streak = 0;
  let qTimer = null;
  let qStart = 0;
  let answered = false;
  let music = null;
  let musicName = null;
  const $ = (id) => document.getElementById(id);
  const afterRender = (fn) => setTimeout(fn, 0);

  // ---------- sound ----------
  const cache = {};
  function sfx(name, vol) {
    if (muted || !on) return;
    try {
      const url = name.indexOf('/') === 0 ? name : A + name + '.mp3';     // a full path plays as is (snow sounds)
      const a = (cache[name] && cache[name].paused) ? cache[name] : new Audio(url);
      cache[name] = a;
      a.volume = vol == null ? 0.7 : vol;
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (_) {}
  }
  function playMusic(name, vol) {
    if (musicName === name && music && !music.paused) return;
    stopMusic();
    musicName = name;
    if (muted) return;
    try {
      // Batalla de Nieve has its own chase loop; everything else shares the kingdoms music
      music = new Audio(game === 'snow' && name === 'music-battle' ? '/assets/snow/music-battle.mp3' : A + name + '.mp3');
      music.loop = true;
      music.volume = vol == null ? 0.35 : vol;
      music.play().catch(() => {});
    } catch (_) {}
  }
  function stopMusic() { if (music) { try { music.pause(); } catch (_) {} } music = null; musicName = null; }

  // While in Reinos de Colores, route the platform's synthesized sounds to recorded ones.
  function patchSounds() {
    const S = window.MochiSounds;
    if (!S || S.__kdPatched) return;
    S.__kdPatched = true;
    const wrap = (key, fn) => { const orig = S[key]; S[key] = function () { return on ? fn.apply(this, arguments) : (orig && orig.apply(this, arguments)); }; };
    wrap('correct', () => sfx('correct', 0.8));
    wrap('wrong', () => sfx('wrong', 0.6));
    wrap('countdownNum', () => sfx('tick', 0.8));
    wrap('go', () => sfx('whoosh', 0.8));
    wrap('startGameTheme', () => playMusic('music-battle', 0.32));
    wrap('startMusic', () => playMusic('music-battle', 0.32));
    wrap('stopGameTheme', () => stopMusic());
    wrap('stopMusic', () => stopMusic());
    wrap('winMusic', () => { stopMusic(); sfx('sting-win', 0.9); });
    wrap('winFanfare', () => {});
    wrap('loseMusic', () => { stopMusic(); sfx('wrong', 0.5); });
    wrap('tieMusic', () => { stopMusic(); sfx('sting-win', 0.7); });
    const tm = window.toggleMute;
    window.toggleMute = function () {
      const r = tm ? tm.apply(this, arguments) : !muted;
      muted = !!r;
      if (muted) stopMusic();
      return r;
    };
  }

  const SKIN_GAMES = ['kingdoms', 'paint', 'snow'];
  let game = null;
  function setMode(v, gt) {
    if (gt) game = gt;
    document.body.classList.toggle('pc-on', !!v && game === 'paint');
    document.body.classList.toggle('sn-on', !!v && game === 'snow');
    if (v === on) return;
    on = v;
    document.body.classList.toggle('kd-phone', on);
    if (on) { patchSounds(); ensureBar(); lobbyDecor(); }
  }

  // ---------- kingdom bar ----------
  function ensureBar() {
    const q = $('screen-question');
    if (!q || $('kdp-bar')) return;
    const bar = document.createElement('div');
    bar.className = 'kdp-bar';
    bar.id = 'kdp-bar';
    bar.innerHTML = '<div class="kdp-side red">🔥 <b id="kdp-r">0</b></div><div class="kdp-status" id="kdp-status"></div><div class="kdp-side gold"><b id="kdp-g">0</b> 🌊</div>';
    const timer = document.createElement('div');
    timer.className = 'kdp-timer';
    timer.id = 'kdp-timer';
    timer.innerHTML = '<i id="kdp-timer-fill"></i>';
    const think = document.createElement('div');
    think.className = 'kdp-think';
    think.id = 'kdp-think';
    think.innerHTML = '<img alt="" src="' + TPOSE('thinking') + '">';
    q.prepend(bar, timer);
    const img = $('question-image-wrap');
    if (img) img.after(think);
    paintBar();
  }
  function paintBar() {
    if (!$('kdp-r')) return;
    const L = document.querySelector('.kdp-side.red'), Rr = document.querySelector('.kdp-side.gold');
    if (L && L.firstChild) L.firstChild.nodeValue = game === 'snow' ? '☀️ ' : '🔥 ';
    if (Rr && Rr.lastChild) Rr.lastChild.nodeValue = game === 'snow' ? ' ❄️' : ' 🌊';
    if (game === 'snow') {
      // survivors | ice team, and which side I am on right now
      $('kdp-r').textContent = snowInfo.sun;
      $('kdp-g').textContent = snowInfo.ice;
      document.querySelector('.kdp-side.red').classList.toggle('me', snowInfo.side === 'sun');
      document.querySelector('.kdp-side.gold').classList.toggle('me', snowInfo.side === 'ice');
      const st = $('kdp-status');
      st.textContent = snowInfo.side === 'ice' ? 'Eres del Hielo ❄️' : 'Eres superviviente ☀️';
      st.className = 'kdp-status ' + (snowInfo.side === 'ice' ? 'sn-st-ice' : 'sn-st-sun');
      return;
    }
    const team = ctx.getTeam();
    $('kdp-r').textContent = scores.red || 0;
    $('kdp-g').textContent = scores.gold || 0;
    document.querySelector('.kdp-side.red').classList.toggle('me', team === 'red');
    document.querySelector('.kdp-side.gold').classList.toggle('me', team === 'gold');
    const mine = scores[team] || 0;
    const theirs = scores[team === 'red' ? 'gold' : 'red'] || 0;
    const st = $('kdp-status');
    if (mine > theirs) { st.textContent = `¡Ganamos por ${mine - theirs}!`; st.className = 'kdp-status ahead'; }
    else if (mine < theirs) { st.textContent = theirs - mine === 1 ? '¡Falta 1!' : `¡Faltan ${theirs - mine}!`; st.className = 'kdp-status behind'; }
    else { st.textContent = '¡Empate!'; st.className = 'kdp-status'; }
  }

  // ---------- question timer ----------
  function startQuestionTimer(q) {
    stopQuestionTimer();
    answered = false;
    qStart = Date.now();
    const fill = $('kdp-timer-fill');
    const box = $('kdp-timer');
    if (!fill) return;
    box.classList.remove('hurry');
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(1)';
    void fill.offsetWidth;
    fill.style.transition = `transform ${Q_MS}ms linear`;
    fill.style.transform = 'scaleX(0)';
    let lastTick = 99;
    qTimer = setInterval(() => {
      const left = Q_MS - (Date.now() - qStart);
      const sec = Math.ceil(left / 1000);
      if (sec <= 5 && sec !== lastTick && sec > 0) { lastTick = sec; box.classList.add('hurry'); sfx('tick', 0.55); }
      if (left <= 0) {
        stopQuestionTimer();
        if (!answered && $('screen-question') && !$('screen-question').classList.contains('hidden')) {
          answered = true;
          document.querySelectorAll('.answer-btn').forEach((b) => { b.disabled = true; });
          ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid: q.qid, choiceIdx: -1 }, () => {});   // time's up = wrong
        }
      }
    }, 200);
  }
  function stopQuestionTimer() { if (qTimer) { clearInterval(qTimer); qTimer = null; } }

  // ---------- screens ----------
  function lobbyDecor() {
    const head = document.querySelector('#screen-lobby .lobby-header');
    if (!head || $('kdp-lobby')) return;
    const box = document.createElement('div');
    box.className = 'kdp-lobby';
    box.id = 'kdp-lobby';
    box.innerHTML = '<img alt="" id="kdp-lobby-img" src="' + TPOSE('pointing') + '"><span class="kdp-team" id="kdp-lobby-team"></span>';
    head.prepend(box);
    paintLobby();
  }
  function paintLobby() {
    const t = $('kdp-lobby-team');
    if (!t || !ctx) return;
    const team = ctx.getTeam();
    t.className = 'kdp-team ' + team;
    if ($('kdp-lobby-img')) $('kdp-lobby-img').src = TPOSE('pointing');
    t.textContent = team === 'red' ? '¡Eres del Reino del Fuego! 🔥' : '¡Eres del Reino del Mar! 🌊';
    if (game === 'snow') { t.className = 'kdp-team sn-team'; t.textContent = '❄️ ¡Batalla de Nieve en Ski Dubái!'; }
    howDecor();
  }
  // Reinos de Colores: kids don't read rules, so the lobby shows the whole game in 3 pictured steps
  // (the same 3 steps the projector shows).
  // Batalla de Nieve lobby: the character this kid will walk as (their avatar pick) + the 3 pictured steps
  function snowHow() {
    const head = document.querySelector('#screen-lobby .lobby-header');
    let card = $('sn-how');
    if (game !== 'snow') { if (card) card.remove(); return; }
    if (!head) return;
    const M = window.SnowMap;
    let av = '';
    try { av = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    const name = ($('lobby-name') && $('lobby-name').textContent) || '';
    const skin = M ? M.skinFor(av, name) : 'dralingo';
    const saga = window.Saga && window.Saga.avatar ? window.Saga.avatar(skin) : null;
    const label = saga ? saga.label.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').trim() : skin;
    if (!card) {
      card = document.createElement('div');
      card.className = 'kdp-how sn-how';
      card.id = 'sn-how';
      card.innerHTML = '<div class="sn-you"><img id="sn-you-img" alt=""><span>Vas a jugar como<b id="sn-you-name"></b></span></div>'
        + '<div class="kdp-how-title">Así se juega</div><ol>'
        + '<li><span class="sn-ico-station"><i></i><i></i><i></i><i></i><b>?</b></span><span><b>Responde en una estación</b>cada acierto: +3 copos ❄️</span></li>'
        + '<li><span class="sn-ico-ball"></span><span><b>Lanza bolas de nieve</b>cada bola cuesta 1 copo</span></li>'
        + '<li><img id="sn-how-frost" class="sn-frost-img" alt=""><span><b>¡Que no te congelen!</b>3 golpes de hielo y eres del Equipo Hielo</span></li>'
        + '</ol>';
      head.after(card);
    }
    $('sn-you-img').src = '/assets/saga/avatars/' + skin + '.webp';
    $('sn-how-frost').src = '/assets/saga/avatars/' + skin + '.webp';
    $('sn-you-name').textContent = label;
  }
  function howDecor() {
    snowHow();
    const head = document.querySelector('#screen-lobby .lobby-header');
    let card = $('kdp-how');
    if (game !== 'kingdoms') { if (card) card.remove(); return; }
    if (!head) return;
    if (!card) {
      card = document.createElement('div');
      card.className = 'kdp-how';
      card.id = 'kdp-how';
      card.innerHTML = '<div class="kdp-how-title">Así se juega</div><ol>'
        + '<li><img id="kdp-how-flag" alt=""><span><b>Responde bien</b>y ganas una bandera 🚩</span></li>'
        + '<li><i class="kdp-how-hex"></i><span><b>Toca una casilla que brilla</b>junto a tu reino: ¡ya es tuya!</span></li>'
        + '<li><img alt="" src="/assets/kingdoms/landmarks/burj.webp" class="kdp-how-lm"><span><b>Conquista Dubái</b>los monumentos dan +3 y +5</span></li>'
        + '</ol>';
      head.after(card);
    }
    $('kdp-how-flag').src = TPOSE('flag');
  }
  function countdownDecor() {
    const ov = $('screen-countdown');
    if (!ov || $('kdp-count-img')) return;
    const img = document.createElement('img');
    img.className = 'kdp-count-img';
    img.id = 'kdp-count-img';
    img.alt = '';
    ov.prepend(img);
    const cap = document.createElement('div');
    cap.className = 'kdp-cap hidden';
    cap.id = 'kdp-cap';
    cap.innerHTML = '<img id="kdp-cap-img" alt=""><span id="kdp-cap-text"></span>';
    ov.appendChild(cap);
  }
  function countdownPose() {
    const img = $('kdp-count-img');
    if (img) img.src = TPOSE('countdown');
    capDecor();
  }
  // «Tu capitana: Aileen» under the countdown (Reinos de Colores picks two of the gang each round).
  function capDecor() {
    const box = $('kdp-cap');
    if (!box) return;
    const C = window.DralingoCast;
    if (game === 'snow') {
      const ok = !!(C && captains && captains.sun);
      box.classList.toggle('hidden', !ok);
      if (!ok) return;
      $('kdp-cap-img').src = C.pose(captains.sun, 'hello');
      $('kdp-cap-text').innerHTML = '';
      $('kdp-cap-text').append(document.createTextNode('☀️ ' + (C.fem(captains.sun) ? 'Tu capitana: ' : 'Tu capitán: ')),
        Object.assign(document.createElement('b'), { textContent: C.name(captains.sun) }),
        Object.assign(document.createElement('small'), { textContent: ' · ❄️ Hielo: ' + C.name(captains.ice) }));
      return;
    }
    const id = captains && ctx && captains[ctx.getTeam()];
    box.classList.toggle('hidden', !(game === 'kingdoms' && C && id));
    if (!(game === 'kingdoms' && C && id)) return;
    $('kdp-cap-img').src = C.pose(id, 'hello');
    $('kdp-cap-text').innerHTML = '';
    $('kdp-cap-text').append(document.createTextNode((C.fem(id) ? 'Tu capitana: ' : 'Tu capitán: ')),
      Object.assign(document.createElement('b'), { textContent: C.name(id) }));
  }
  function resultDecor(correct, correctText, r) {
    const paint = r && r.paint;
    const box = $('result-feedback');
    if (!box) return;
    box.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'kdp-sticker';
    img.alt = '';
    img.src = TPOSE(correct ? (streak >= 3 ? 'flag' : 'jump') : 'shocked');
    const title = document.createElement('div');
    title.className = 'kdp-res-title ' + (correct ? 'ok' : 'no');
    title.textContent = correct ? '¡Correcto!' : (answered && Date.now() - qStart >= Q_MS ? '¡Se acabó el tiempo!' : '¡Casi!');
    box.append(img, title);
    if (correct) {
      const sub = document.createElement('div');
      sub.className = 'kdp-res-sub';
      const sn = r && r.snow;
      sub.textContent = sn
        ? (sn.racha ? `¡Racha! +${sn.gained} copos ❄️` : `+${sn.gained} copos ❄️`)
        : paint
          ? (paint.blaze ? '¡LLAMARADA! 🔥🔥 Pintas más ancho' : '¡+10 s de fuego! 🔥')
          : (streak >= 3 && streak % 3 === 0 ? '¡Bandera doble! 🚩🚩' : '¡Ganaste una bandera! 🚩');
      box.appendChild(sub);
      if (sn && sn.calor) {
        const w = document.createElement('div');
        w.className = 'kdp-res-sub sn-warm';
        w.textContent = '☀️ ¡Recuperaste calor!';
        box.appendChild(w);
      }
      if (streak >= 2) {
        const fl = document.createElement('div');
        fl.className = 'kdp-streak';
        fl.textContent = `🔥 Racha de ${streak}`;
        box.appendChild(fl);
        if (streak >= 3) sfx('streak', 0.7);
      }
    } else {
      const sub = document.createElement('div');
      sub.className = 'kdp-res-sub';
      sub.textContent = 'La respuesta era';
      const ans = document.createElement('div');
      ans.className = 'kdp-res-answer';
      ans.textContent = correctText || '';
      box.append(sub, ans);
      if (r && r.snow) {
        const again = document.createElement('div');
        again.className = 'kdp-res-sub sn-again';
        again.textContent = '❓ Toca «¡Responder!» otra vez y gana copos';
        box.appendChild(again);
      }
    }
  }
  // Batalla de Nieve end: survived or frozen, my points, seconds survived, kids I froze
  function snowEnd(data) {
    const me = (data && data.me) || {};
    const emoji = $('end-emoji');
    emoji.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'kdp-end-img' + (me.side === 'ice' ? ' sn-frost-img' : '');
    img.alt = '';
    img.src = POSE(me.won ? 'champion' : 'pointing');
    emoji.appendChild(img);
    const b = $('end-banner');
    if (me.side === 'sun') b.textContent = '¡Sobreviviste! ☀️';
    else if (me.won) b.textContent = '¡El Equipo Hielo ganó! ❄️';
    else b.textContent = '¡Ganaron los supervivientes!';
    const teamEl = $('end-team-score'), meEl = $('end-personal-score');
    if (teamEl && teamEl.parentNode.firstChild) teamEl.parentNode.firstChild.nodeValue = me.side === 'sun' ? 'Sobreviviste: ' : 'Congelaste: ';
    if (teamEl) teamEl.textContent = me.side === 'sun' ? `toda la ronda (${me.seconds || 0} s)` : `${me.freezes || 0} · aguantaste ${me.seconds || 0} s`;
    if (meEl && meEl.parentNode.firstChild) meEl.parentNode.firstChild.nodeValue = 'Tus puntos: ';
    if (meEl) meEl.textContent = (me.score || 0) + ' ⭐';
  }
  function endDecor(data) {
    const emoji = $('end-emoji');
    if (!emoji) return;
    if (game === 'snow') { snowEnd(data); return; }
    const team = ctx.getTeam();
    const won = data && data.winner === team;
    emoji.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'kdp-end-img';
    img.alt = '';
    // In Dragones Pintores the dragon is the kid's own character, so a Fuego kid sees the red Dralingo.
    img.src = TPOSE(won ? 'champion' : (data && data.winner === 'tie' ? 'jump' : 'pointing'));
    emoji.appendChild(img);
    if (!won && data && data.winner !== 'tie') $('end-banner').textContent = '¡La próxima es nuestra!';
    if (won && game === 'kingdoms') $('end-banner').textContent = '¡Tu reino conquistó Dubái!';
    if (game === 'kingdoms') {
      // player.js fills these with quiz points; here the round is counted in kingdom points.
      const teamEl = $('end-team-score'), meEl = $('end-personal-score');
      if (teamEl && teamEl.parentNode.firstChild) teamEl.parentNode.firstChild.nodeValue = 'Puntos de tu reino: ';
      if (teamEl) teamEl.textContent = (data && data.teamScores && data.teamScores[team]) || 0;
      if (meEl && meEl.parentNode.firstChild) meEl.parentNode.firstChild.nodeValue = 'Tus puntos: ';
      if (meEl && data && data.scores && data.scores[ctx.socket.id] != null) meEl.textContent = data.scores[ctx.socket.id] + ' 🚩';
    }
    if (game === 'paint') {
      // player.js fills these with quiz points; in the paint game what counts is clouds.
      const teamEl = $('end-team-score'), meEl = $('end-personal-score');
      if (teamEl && teamEl.parentNode.firstChild) teamEl.parentNode.firstChild.nodeValue = 'Cielo de tu reino: ';
      if (teamEl) teamEl.textContent = ((data && data.teamScores && data.teamScores[team]) || 0) + ' nubes';
      if (data && data.scores && data.scores[ctx.socket.id] != null) myPaint = data.scores[ctx.socket.id];
      if (meEl && meEl.parentNode.firstChild) meEl.parentNode.firstChild.nodeValue = 'Tus nubes: ';
      if (meEl) meEl.textContent = myPaint + ' ☁️';
    }
  }

  function init(c) {
    ctx = c;
    const s = c.socket;
    s.on('state', (st) => {
      if (!st) return;
      setMode(SKIN_GAMES.includes(st.gameType), st.gameType);
      if (on && st.teamScores && st.state !== 'active') { scores = st.teamScores; paintBar(); }
      if (on) paintLobby();
    });
    s.on('team-changed', () => afterRender(() => { paintLobby(); paintBar(); }));
    s.on('kd:init', (d) => { setMode(true, 'kingdoms'); scores = d.teamScores || scores; if (d.captains) captains = d.captains; paintBar(); });
    s.on('kd:captains', (c) => { captains = c; if (on) capDecor(); });
    s.on('pc:init', (d) => { setMode(true, 'paint'); scores = d.teamScores || scores; paintBar(); });
    // Batalla de Nieve: survivors / ice counts and my side for the question-screen bar
    const snCounts = (c) => { if (c) { snowInfo.sun = c.sun || 0; snowInfo.ice = c.ice || 0; } };
    s.on('sn:init', (d) => { setMode(true, 'snow'); snCounts(d.counts); if (d.me) snowInfo.side = d.me.side; if (d.captains) captains = d.captains; paintBar(); });
    s.on('sn:roster', (d) => { snCounts(d.counts); paintBar(); });
    s.on('sn:spell', (d) => { snCounts(d.counts); paintBar(); });
    s.on('sn:moment', (d) => { snCounts(d.counts); paintBar(); });
    s.on('sn:me', (m) => { if (m.side) snowInfo.side = m.side; paintBar(); });
    s.on('sn:hit', (h) => { if (h.type === 'freeze') { snowInfo.sun = Math.max(0, snowInfo.sun - 1); snowInfo.ice++; paintBar(); } });
    s.on('sn:captains', (c) => { captains = c; if (on) capDecor(); });
    s.on('pc:paint', (d) => {
      if (d.teamScores) { scores = d.teamScores; paintBar(); }
      if (d.scores && d.scores[s.id] != null) myPaint = d.scores[s.id];
    });
    s.on('kd:plant', (d) => { if (d.teamScores) { scores = d.teamScores; paintBar(); } if (on && d.playerId !== s.id && (d.flipped || []).length >= 3) sfx('surround', 0.35); });
    s.on('countdown', () => { streak = 0; myPaint = 0; curQid = null; if (!on) return; countdownDecor(); countdownPose(); });
    s.on('question', (q) => {
      if (!on) return;
      afterRender(() => {
        ensureBar();
        const hasImg = $('question-image-wrap') && $('question-image-wrap').style.display !== 'none';
        if ($('kdp-think')) $('kdp-think').style.display = hasImg ? 'none' : 'flex';
        paintBar();
        if (q && q.qid === curQid && qTimer) return;   // same question re-sent by a resync: keep its countdown
        curQid = q && q.qid;
        startQuestionTimer(q);
        sfx('whoosh', 0.35);
      });
    });
    document.addEventListener('pointerdown', (e) => {
      if (on && e.target.closest && e.target.closest('.answer-btn')) { answered = true; stopQuestionTimer(); sfx('tap', 0.6); }
    }, true);
    s.on('answer-result', (r) => {
      if (!on || !r) return;
      answered = true;
      stopQuestionTimer();
      streak = r.correct ? streak + 1 : 0;
      afterRender(() => resultDecor(!!r.correct, r.correctText, r));
    });
    s.on('game-end', (d) => { if (!on) return; stopQuestionTimer(); afterRender(() => endDecor(d)); });
    s.on('kd:prompt', () => sfx('flag', 0.6));
  }

  window.KingdomsSkin = { init, sfx };
})();
