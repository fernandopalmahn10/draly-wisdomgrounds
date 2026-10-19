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
  // La Gran Fuga (co-op, no teams): Dralingo in his platform look (kandura + mustache: hello / power / wise)
  const ES_POSE = { thinking: 'wise', shocked: 'wise', pointing: 'hello', countdown: 'hello', jump: 'power', flag: 'power', champion: 'power' };
  const TPOSE = (n) => ((game === 'escape' || game === 'halcon' || game === 'monopoly' || game === 'dragon-eye') ? '/assets/dralingo/' + (ES_POSE[n] || 'hello') + '.webp'
    : POSE(n + (ctx && game !== 'snow' && ctx.getTeam() === 'red' && RED_POSES.includes(n) ? '-red' : '')));
  const ESC = () => (game === 'escape' && window.EscapePhone ? window.EscapePhone : null);
  // Batalla de Nieve: no red/blue kingdoms, two sides that change during the round (counts from the sn:* events)
  let snowInfo = { sun: 0, ice: 0, side: 'sun' };
  let captains = null;           // Reinos de Colores: { red, gold } cast ids of this round's captains
  const Q_MS = 20000;            // time to answer each question
  let ctx = null;
  let on = false;
  let muted = false;
  let scores = { red: 0, gold: 0 };
  let myPaint = 0;             // Dragones Pintores: clouds this kid owns (from pc:paint / game-end)
  let myKd = 0;                // Reinos de Colores: tiles my flags took this round (kd:plant playerTiles)
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
    // La Gran Fuga (chase pass 2026-10-19): the projector plays the chase music; the phones play the chase itself (his
    // treads, my heartbeat, the zaps), never 30 copies of the music
    if (game === 'escape') { stopMusic(); return; }
    if (musicName === name && music && !music.paused) return;
    stopMusic();
    musicName = name;
    if (muted) return;
    try {
      // Batalla de Nieve has its own chase loop; everything else shares the kingdoms music
      music = new Audio(game === 'snow' && name === 'music-battle' ? '/assets/snow/music-battle.mp3'
        : game === 'halcon' && name === 'music-battle' ? '/assets/halcon/music-show.mp3'    // Ojos de Halcón: the show loop
        : game === 'monopoly' && name === 'music-battle' ? '/assets/monopoly/music-board.mp3'    // Dàfùwēng · Monopolio: the board loop
        : game === 'dragon-eye' && name === 'music-battle' ? '/assets/dragon/music-race.mp3'      // Vuelo del Dragón: the race loop
        : game === 'mochi-mash' && name === 'music-battle' ? '/assets/mochi/music-mash.mp3'     // Mochi Mash: the polka
        : game === 'pinata' && name === 'music-battle' ? '/assets/pinata/music-fiesta.mp3'          // Piñata Tigre: the party loop
        : game === 'trapdoor' && name === 'music-battle' ? '/assets/trapdoor/music-rounds.mp3'     // Las Trampillas: the rounds' beat
        : game === 'sixseven' && name === 'music-battle' ? '/assets/sixseven/music-swing.mp3' : A + name + '.mp3');   // 6-7 Swing: the dance loop
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
    // Ojos de Halcón plays its own studio run-in during the countdown (no 3-2-1 ticks, like the video)
    // (Mochi Mash, Piñata Tigre: their own run-in and «¿Listos?… ¡YA!» after the countdown)
    const ownIntro = () => game === 'halcon' || game === 'mochi-mash' || game === 'pinata' || game === 'sixseven' || game === 'monopoly' || game === 'dragon-eye';
    wrap('countdownNum', () => { if (!ownIntro()) sfx('tick', 0.8); });
    wrap('go', () => { if (!ownIntro()) sfx('whoosh', 0.8); });
    wrap('startGameTheme', () => playMusic('music-battle', 0.32));
    wrap('startMusic', () => playMusic('music-battle', 0.32));
    wrap('stopGameTheme', () => stopMusic());
    wrap('stopMusic', () => stopMusic());
    // (Mochi Mash, Piñata Tigre: the ceremony keeps the result secret until the reveal, so no win / lose sound at game-end)
    // (Reinos, Pintores, Nieve, La Gran Fuga since 2026-10-16: the shared ceremony of js/party.js reveals it)
    const ownReveal = () => game === 'mochi-mash' || game === 'pinata' || game === 'sixseven' || game === 'monopoly' || game === 'dragon-eye' || PARTY_GAMES.includes(game);
    wrap('winMusic', () => { stopMusic(); if (!ownReveal()) sfx('sting-win', 0.9); });
    wrap('winFanfare', () => {});
    wrap('loseMusic', () => { stopMusic(); if (!ownReveal()) sfx('wrong', 0.5); });
    wrap('tieMusic', () => { stopMusic(); if (!ownReveal()) sfx('sting-win', 0.7); });
    const tm = window.toggleMute;
    window.toggleMute = function () {
      const r = tm ? tm.apply(this, arguments) : !muted;
      muted = !!r;
      if (muted) stopMusic();
      return r;
    };
  }

  const SKIN_GAMES = ['kingdoms', 'paint', 'snow', 'escape', 'halcon', 'mochi-mash', 'pinata', 'sixseven', 'monopoly', 'dragon-eye', 'trapdoor'];
  // the games whose ending is the shared Mario Party ceremony (js/party.js, 2026-10-16; Las Trampillas 2026-10-17)
  const PARTY_GAMES = ['kingdoms', 'paint', 'snow', 'escape', 'trapdoor'];
  const P = () => window.DralyParty || null;
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
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
    held = false;
    qTimer = setInterval(() => {
      if (held) return;                 // La Gran Fuga: the clock waits while the teacher pauses or the kid is dizzy
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
    if (holdSrcs.some((f) => f())) hold(true);   // a question that lands during a pause (La Gran Fuga, Mochi Mash) / dizzy starts held
  }
  function stopQuestionTimer() { if (qTimer) { clearInterval(qTimer); qTimer = null; } held = false; }
  // hold(true) freezes the question timer bar where it is; hold(false) lets it run on from there
  let held = false, heldAt = 0;
  const holdSrcs = [];                          // each game module registers its own «hold the clock now?» check
  function hold(v) {
    v = !!v;
    if (v === held || !qTimer) { if (!qTimer) held = false; return; }
    const fill = $('kdp-timer-fill');
    held = v;
    if (held) {
      heldAt = Date.now();
      const left = Math.max(0, Q_MS - (heldAt - qStart));
      if (fill) { fill.style.transition = 'none'; fill.style.transform = `scaleX(${(left / Q_MS).toFixed(3)})`; }
    } else {
      qStart += Date.now() - heldAt;
      const left = Math.max(0, Q_MS - (Date.now() - qStart));
      if (fill) { void fill.offsetWidth; fill.style.transition = `transform ${left}ms linear`; fill.style.transform = 'scaleX(0)'; }
    }
  }

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
    if (game === 'escape') { t.className = 'kdp-team es-team'; t.textContent = '🚀 ¡Eres de la tripulación!'; }
    if (game === 'halcon') { t.className = 'kdp-team hc-team'; t.textContent = '🦅 Ojos de Halcón · ¡tableros de 4!'; }
    if (game === 'monopoly') { t.className = 'kdp-team mn-team'; t.textContent = '🎲 El Gran Tablero de Dubái'; }
    if (game === 'dragon-eye') { t.className = 'kdp-team dr-team'; t.textContent = '🐉 La Carrera del Cielo de Dubái'; }
    if (game === 'mochi-mash' || game === 'pinata' || game === 'sixseven') t.textContent = team === 'red' ? '¡Eres del Equipo Fuego!' : '¡Eres del Equipo Mar!';
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
    if (window.EscapePhone) window.EscapePhone.lobby(game === 'escape' ? document.querySelector('#screen-lobby .lobby-header') : null);
    if (window.HalconPhone) window.HalconPhone.lobby(game === 'halcon' ? document.querySelector('#screen-lobby .lobby-header') : null);
    if (window.MonoPhone) window.MonoPhone.lobby(game === 'monopoly' ? document.querySelector('#screen-lobby .lobby-header') : null);
    if (window.DragonPhone) window.DragonPhone.lobby(game === 'dragon-eye' ? document.querySelector('#screen-lobby .lobby-header') : null);
    if (window.PaintPhone && window.PaintPhone.lobby) window.PaintPhone.lobby(game === 'paint' ? document.querySelector('#screen-lobby .lobby-header') : null);
    if (window.TrapdoorPhone && window.TrapdoorPhone.lobby) window.TrapdoorPhone.lobby(game === 'trapdoor' ? document.querySelector('#screen-lobby .lobby-header') : null);
    if (window.MochiPhone) window.MochiPhone.lobby(game === 'mochi-mash' ? document.querySelector('#screen-lobby .lobby-header') : null);
    if (window.PinataPhone) window.PinataPhone.lobby(game === 'pinata' ? document.querySelector('#screen-lobby .lobby-header') : null);
    if (window.SixSevenPhone) window.SixSevenPhone.lobby(game === 'sixseven' ? document.querySelector('#screen-lobby .lobby-header') : null);
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
    if (window.EscapePhone) window.EscapePhone.intro(game === 'escape' ? $('screen-countdown') : null);
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
    const capGame = game === 'kingdoms' || game === 'paint' || game === 'trapdoor';      // Dragones Pintores (2026-10-16) and Las Trampillas have captains too
    box.classList.toggle('hidden', !(capGame && C && id));
    if (!(capGame && C && id)) return;
    $('kdp-cap-img').src = C.pose(id, 'hello');
    $('kdp-cap-text').innerHTML = '';
    $('kdp-cap-text').append(document.createTextNode((C.fem(id) ? 'Tu capitana: ' : 'Tu capitán: ')),
      Object.assign(document.createElement('b'), { textContent: C.name(id) }));
  }
  function resultDecor(correct, correctText, r) {
    const paint = r && r.paint;
    const box = $('result-feedback');
    if (!box) return;
    if (ESC()) { ESC().result(box, correct, correctText, Object.assign({ timeUp: !correct && answered && Date.now() - qStart >= Q_MS }, r)); return; }
    if (game === 'mochi-mash' && window.MochiPhone) { window.MochiPhone.result(box, correct, correctText, Object.assign({ timeUp: !correct && answered && Date.now() - qStart >= Q_MS }, r)); return; }
    if (game === 'pinata' && window.PinataPhone) { window.PinataPhone.result(box, correct, correctText, Object.assign({ timeUp: !correct && answered && Date.now() - qStart >= Q_MS }, r)); return; }
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
          ? (paint.frenzy ? `¡FUEGO DOBLE! +${paint.gain || 20} s y llamarada 🔥🔥` : paint.blaze ? '¡LLAMARADA! 🔥🔥 Pintas más ancho' : `¡+${paint.gain || 10} s de fuego! 🔥`)
          : (r && r.kingdoms && r.kingdoms.flags >= 3 ? '¡Tres banderas! 🚩🚩🚩' : r && r.kingdoms && r.kingdoms.flags === 2 ? '¡Bandera doble! 🚩🚩' : '¡Ganaste una bandera! 🚩');
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
    if (game === 'kingdoms' || game === 'paint') liveStrip(box, correct);
  }
  // Reinos / Pintores, between two questions (his rule «no dead phones»): the kingdoms' live score, what I have done, and
  // my captain reacting to this answer (a kind line on a miss), so the wait before the next question is never empty
  function liveStrip(box, correct) {
    if (!ctx) return;
    const team = ctx.getTeam();
    const mine = scores[team] || 0, theirs = scores[team === 'red' ? 'gold' : 'red'] || 0;
    const strip = document.createElement('div');
    strip.className = 'kdp-live ' + team;
    const sc = document.createElement('div');
    sc.className = 'kdp-live-score';
    const a = document.createElement('b'); a.className = 'red'; a.textContent = '🔥 ' + (scores.red || 0);
    const g = document.createElement('b'); g.className = 'gold'; g.textContent = (scores.gold || 0) + ' 🌊';
    const gap = document.createElement('span');
    gap.textContent = mine > theirs ? `¡Tu reino gana por ${mine - theirs}!` : mine < theirs ? (theirs - mine === 1 ? '¡Falta 1 para alcanzarlos!' : `¡Faltan ${theirs - mine} para alcanzarlos!`) : '¡Empate!';
    sc.append(a, gap, g);
    strip.appendChild(sc);
    const my = game === 'paint' ? myPaint : myKd;
    const cap = captains && captains[team];
    const C = window.DralingoCast;
    if (C && cap) {
      const say = document.createElement('div');
      say.className = 'kdp-live-say';
      const im = document.createElement('img'); im.alt = ''; im.src = C.pose(cap, correct ? 'cheer' : 'hello');
      const t = document.createElement('span');
      t.textContent = correct ? C.line(cap, 'battle') : C.line(cap, 'oops');
      say.append(im, t);
      strip.appendChild(say);
    }
    if (my > 0) {
      const me = document.createElement('div');
      me.className = 'kdp-live-me';
      me.textContent = game === 'paint' ? `☁️ Tus nubes: ${my}` : `🚩 Tus casillas: ${my}`;
      strip.appendChild(me);
    }
    box.appendChild(strip);
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
  // Reinos, Pintores, Nieve, La Gran Fuga: the shared Mario Party ceremony on the phone (js/party.js), then my card
  // «⏸ Pausa» in Reinos / Pintores (2026-10-16): the card over everything, the question's clock held
  let kdPaused = false;
  function setPaused(v) {
    kdPaused = !!v;
    if (P()) P().pauseCard(kdPaused, { mode: 'phone' });
    hold(kdPaused);
    if (kdPaused) stopMusic(); else if (on && (game === 'kingdoms' || game === 'paint' || game === 'trapdoor')) playMusic(game === 'trapdoor' && document.body.classList.contains('tp-lastround') ? 'music-final' : 'music-battle', 0.32);
  }
  holdSrcs.push(() => kdPaused);
  let ceremony = null;
  function partyEnd(data) {
    if (!P() || !data || !data.fin) return false;
    const box = $('screen-end');
    if (!box) return false;
    P().hideFinal();
    document.body.classList.add('pf-ended');
    stopMusic();
    const name = ($('lobby-name') && $('lobby-name').textContent) || '';
    ceremony = new (P().Ceremony)({
      mode: 'phone', game, data, mount: box,
      play: (url, vol) => sfx(url, vol), buzz,
      me: { name, skin: data.me && data.me.skin },
    });
    return true;
  }
  function endDecor(data) {
    const emoji = $('end-emoji');
    if (!emoji) return;
    if (PARTY_GAMES.includes(game) && partyEnd(data)) return;
    if (game === 'snow') { snowEnd(data); return; }
    if (ESC()) { ESC().end(data); return; }
    if (game === 'halcon' && window.HalconPhone) { window.HalconPhone.end(data); return; }
    if (game === 'monopoly' && window.MonoPhone) { window.MonoPhone.end(data); return; }
    if (game === 'dragon-eye' && window.DragonPhone) { window.DragonPhone.end(data); return; }
    if (game === 'mochi-mash' && window.MochiPhone) { window.MochiPhone.end(data); return; }
    if (game === 'pinata' && window.PinataPhone) { window.PinataPhone.end(data); return; }
    if (game === 'sixseven' && window.SixSevenPhone) { window.SixSevenPhone.end(data); return; }
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
      if (teamEl && teamEl.parentNode.firstChild) teamEl.parentNode.firstChild.nodeValue = 'Puntos de tu reino: ';
      if (teamEl) teamEl.textContent = ((data && data.teamScores && data.teamScores[team]) || 0) + ' puntos';
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
    s.on('pc:init', (d) => { setMode(true, 'paint'); scores = d.teamScores || scores; if (d.captains) captains = d.captains; paintBar(); });
    s.on('pc:captains', (c) => { captains = c; if (on) capDecor(); });
    // Las Trampillas: the same team skin (lobby, captains, music, pause card, the shared ending)
    s.on('td:init', (d) => { setMode(true, 'trapdoor'); scores = d.score || scores; if (d.captains) captains = d.captains; paintBar(); if (d && !!d.paused !== kdPaused) setPaused(d.paused); });
    s.on('td:captains', (c) => { captains = c; if (on) capDecor(); });
    s.on('td:pause', (d) => { if (on) setPaused(d && d.paused); });
    s.on('td:tally', (d) => { if (d && d.score) { scores = d.score; paintBar(); } });
    s.on('kd:pause', (d) => { if (on) setPaused(d && d.paused); });
    s.on('pc:pause', (d) => { if (on) setPaused(d && d.paused); });
    s.on('kd:init', (d) => { if (d && !!d.paused !== kdPaused) setPaused(d.paused); });
    s.on('pc:init', (d) => { if (d && !!d.paused !== kdPaused) setPaused(d.paused); });
    // ---------- the Mario Party ending (Reinos, Pintores, Nieve, La Gran Fuga) ----------
    // «¡FINAL!»: the question closes (its clock stops), the music stops, the band covers everything
    s.on('fin:final', (d) => {
      if (!on || !P()) return;
      if (kdPaused) setPaused(false);
      stopQuestionTimer();
      answered = true;
      document.querySelectorAll('.answer-btn').forEach((b) => { b.disabled = true; });
      stopMusic();
      P().clearChip();
      const why = d && d.why;
      const sub = why === 'time' && game === 'trapdoor' ? '¡Terminó la ronda final!' : why === 'time' ? '¡Se acabó el tiempo!' : why === 'escaped' ? '¡Despegamos! ¿Qué rango ganamos?' : why === 'allFrozen' ? '¿Quién ganó la batalla?' : '¡Fin de la ronda!';
      P().final({ mode: 'phone', ms: d && d.ms, sub, play: (url, vol) => sfx(url, vol), buzz });
    });
    s.on('fin:skip', () => { if (ceremony && ceremony.root) ceremony.skip(); });
    // the last 30 s: what doubles in this game, on every phone (Nieve also gets its toast, La Gran Fuga its own band)
    s.on('fin:frenzy', (d) => {
      if (!on || !P() || !d) return;
      if (d.off) { P().clearChip(); return; }
      if (d.again) {      // after «⏸ Pausa» / «+30 s»: the chip with the new seconds, no second banner
        const lbl = game === 'kingdoms' ? 'Banderas ×2' : game === 'paint' ? 'Recarga doble' : game === 'snow' ? 'Copos ×2' : '';
        if (lbl) P().chip(lbl, d.endsMs);
        return;
      }
      const cap = ctx && captains && captains[ctx.getTeam()];
      if (game === 'kingdoms') {
        P().news('¡Últimos 30 segundos!', { sub: '¡Banderas dobles! Cada acierto: 2 banderas', kind: 'alarm', cast: cap, ms: 2800 });
        P().chip('Banderas ×2', d.endsMs);
      } else if (game === 'paint') {
        P().news('¡Últimos 30 segundos!', { sub: '¡Recarga doble! Cada acierto: +20 s y llamarada', kind: 'alarm', cast: cap, ms: 2800 });
        P().chip('Recarga doble', d.endsMs);
      } else if (game === 'snow') {
        P().chip('Copos ×2', d.endsMs);       // the map's toast says it once; the chip stays for the 30 s
      }
      sfx('streak', 0.7);
      buzz([60, 40, 60]);
    });
    // Batalla de Nieve: survivors / ice counts and my side for the question-screen bar
    const snCounts = (c) => { if (c) { snowInfo.sun = c.sun || 0; snowInfo.ice = c.ice || 0; } };
    s.on('sn:init', (d) => { setMode(true, 'snow'); snCounts(d.counts); if (d.me) snowInfo.side = d.me.side; if (d.captains) captains = d.captains; paintBar(); });
    s.on('sn:roster', (d) => { snCounts(d.counts); paintBar(); });
    s.on('sn:spell', (d) => { snCounts(d.counts); paintBar(); });
    s.on('sn:moment', (d) => { snCounts(d.counts); paintBar(); });
    s.on('sn:me', (m) => { if (m.side) snowInfo.side = m.side; paintBar(); });
    s.on('sn:hit', (h) => { if (h.type === 'freeze') { snowInfo.sun = Math.max(0, snowInfo.sun - 1); snowInfo.ice++; paintBar(); } });
    s.on('sn:captains', (c) => { captains = c; if (on) capDecor(); });
    s.on('es:init', () => { setMode(true, 'escape'); });
    s.on('hc:init', () => { setMode(true, 'halcon'); });
    s.on('pc:paint', (d) => {
      if (d && d.ts) { scores = d.ts; paintBar(); }      // Pintores v2: kingdom points (clouds + islands held)
    });
    s.on('kd:plant', (d) => { if (d.teamScores) { scores = d.teamScores; paintBar(); } if (on && d.playerId !== s.id && (d.flipped || []).length >= 3) sfx('surround', 0.35); });
    s.on('countdown', () => { streak = 0; myPaint = 0; curQid = null; if (!on) return; countdownDecor(); countdownPose(); });
    s.on('question', (q) => {
      if (!on || game === 'sixseven' || game === 'monopoly' || game === 'dragon-eye' || game === 'paint' || game === 'trapdoor') return;      // 6-7 Swing, Monopolio, Vuelo, Pintores v2, Las Trampillas: their own screen and clock
      afterRender(() => {
        ensureBar();
        const hasImg = $('question-image-wrap') && $('question-image-wrap').style.display !== 'none';
        if ($('kdp-think')) { $('kdp-think').style.display = hasImg ? 'none' : 'flex'; const ti = $('kdp-think').firstChild; if (ti && ti.getAttribute('src') !== TPOSE('thinking')) ti.src = TPOSE('thinking'); }
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
      if (!on || !r || game === 'sixseven' || game === 'monopoly' || game === 'dragon-eye' || game === 'paint' || game === 'trapdoor') return;
      answered = true;
      stopQuestionTimer();
      streak = r.correct ? streak + 1 : 0;
      afterRender(() => resultDecor(!!r.correct, r.correctText, r));
    });
    s.on('game-end', (d) => { if (!on) return; stopQuestionTimer(); if (P()) { P().clearChip(); P().clearNews(); } afterRender(() => endDecor(d)); });
    s.on('state', (st) => {
      if (st && st.state === 'lobby' && ceremony) { ceremony.stop(); ceremony = null; document.body.classList.remove('pf-ended'); }
      if (st && st.state === 'lobby' && P()) { P().hideFinal(); P().clearChip(); P().clearNews(); if (kdPaused) setPaused(false); }
    });
    s.on('countdown', () => { if (kdPaused) setPaused(false); if (ceremony) { ceremony.stop(); ceremony = null; } document.body.classList.remove('pf-ended'); if (P()) { P().hideFinal(); P().clearChip(); P().clearNews(); } myKd = 0; });
    s.on('kd:plant', (d) => { if (d.playerId === s.id && typeof d.playerScore === 'number') myKd = d.playerTiles != null ? d.playerTiles : myKd; });
    s.on('kd:prompt', () => sfx('flag', 0.6));
  }

  window.KingdomsSkin = {
    init, sfx, hold,
    captain: () => (captains && ctx ? captains[ctx.getTeam()] : null),
    ceremony: () => ceremony,
    holdWhen: (fn) => { if (typeof fn === 'function') holdSrcs.push(fn); },
    // Mochi Mash: the team bar from its own meter events, the mute state for its Web Audio pops, the frenzy music
    setScores: (s) => { if (s) { scores = { red: s.red || 0, gold: s.gold || 0 }; if (on) paintBar(); } },
    isMuted: () => muted,
    music: (name, vol) => { if (!on) return; if (name) playMusic(name, vol); else stopMusic(); },
  };
})();
