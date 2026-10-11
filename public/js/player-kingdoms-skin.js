// Reinos de Colores — the kid's phone experience (only while gameType is 'kingdoms'; other games untouched).
// Adds on top of player.js: pastel look (css body.kd-phone), a live "my kingdom vs theirs" bar, a 20 s question timer
// with ticking, Dralingo stickers (Higgsfield poses) for countdown / thinking / right / wrong / win / lose, and real
// recorded sounds + music (Kenney) instead of the synthesized beeps.
// player.js listeners run after ours, so DOM tweaks that depend on player.js's render use afterRender().
(function () {
  const A = '/assets/kingdoms/';
  const POSE = (n) => A + 'dralingo/' + n + '.webp';
  const Q_MS = 20000;            // time to answer each question
  let ctx = null;
  let on = false;
  let muted = false;
  let scores = { red: 0, gold: 0 };
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
      const a = (cache[name] && cache[name].paused) ? cache[name] : new Audio(A + name + '.mp3');
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
      music = new Audio(A + name + '.mp3');
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

  function setMode(v) {
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
    think.innerHTML = '<img alt="" src="' + POSE('thinking') + '">';
    q.prepend(bar, timer);
    const img = $('question-image-wrap');
    if (img) img.after(think);
    paintBar();
  }
  function paintBar() {
    if (!$('kdp-r')) return;
    const team = ctx.getTeam();
    $('kdp-r').textContent = scores.red || 0;
    $('kdp-g').textContent = scores.gold || 0;
    document.querySelector('.kdp-side.red').classList.toggle('me', team === 'red');
    document.querySelector('.kdp-side.gold').classList.toggle('me', team === 'gold');
    const mine = scores[team] || 0;
    const theirs = scores[team === 'red' ? 'gold' : 'red'] || 0;
    const st = $('kdp-status');
    if (mine > theirs) { st.textContent = `¡Ganamos por ${mine - theirs}!`; st.className = 'kdp-status ahead'; }
    else if (mine < theirs) { st.textContent = `¡Nos faltan ${theirs - mine}!`; st.className = 'kdp-status behind'; }
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
    box.innerHTML = '<img alt="" src="' + POSE('pointing') + '"><span class="kdp-team" id="kdp-lobby-team"></span>';
    head.prepend(box);
    paintLobby();
  }
  function paintLobby() {
    const t = $('kdp-lobby-team');
    if (!t || !ctx) return;
    const team = ctx.getTeam();
    t.className = 'kdp-team ' + team;
    t.textContent = team === 'red' ? '¡Eres del Reino del Fuego! 🔥' : '¡Eres del Reino del Mar! 🌊';
  }
  function countdownDecor() {
    const ov = $('screen-countdown');
    if (!ov || $('kdp-count-img')) return;
    const img = document.createElement('img');
    img.className = 'kdp-count-img';
    img.id = 'kdp-count-img';
    img.alt = '';
    img.src = POSE('countdown');
    ov.prepend(img);
  }
  function resultDecor(correct, correctText) {
    const box = $('result-feedback');
    if (!box) return;
    box.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'kdp-sticker';
    img.alt = '';
    img.src = POSE(correct ? (streak >= 3 ? 'flag' : 'jump') : 'shocked');
    const title = document.createElement('div');
    title.className = 'kdp-res-title ' + (correct ? 'ok' : 'no');
    title.textContent = correct ? '¡Correcto!' : (answered && Date.now() - qStart >= Q_MS ? '¡Se acabó el tiempo!' : '¡Casi!');
    box.append(img, title);
    if (correct) {
      const sub = document.createElement('div');
      sub.className = 'kdp-res-sub';
      sub.textContent = streak >= 3 && streak % 3 === 0 ? '¡Bandera doble! 🚩🚩' : '¡Ganaste una bandera! 🚩';
      box.appendChild(sub);
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
    }
  }
  function endDecor(data) {
    const emoji = $('end-emoji');
    if (!emoji) return;
    const team = ctx.getTeam();
    const won = data && data.winner === team;
    emoji.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'kdp-end-img';
    img.alt = '';
    img.src = POSE(won ? 'champion' : (data && data.winner === 'tie' ? 'jump' : 'pointing'));
    emoji.appendChild(img);
    if (!won && data && data.winner !== 'tie') $('end-banner').textContent = '¡La próxima es nuestra!';
  }

  function init(c) {
    ctx = c;
    const s = c.socket;
    s.on('state', (st) => {
      if (!st) return;
      setMode(st.gameType === 'kingdoms');
      if (on && st.teamScores && st.state !== 'active') { scores = st.teamScores; paintBar(); }
      if (on) paintLobby();
    });
    s.on('team-changed', () => afterRender(() => { paintLobby(); paintBar(); }));
    s.on('kd:init', (d) => { setMode(true); streak = 0; scores = d.teamScores || scores; paintBar(); });
    s.on('kd:plant', (d) => { if (d.teamScores) { scores = d.teamScores; paintBar(); } if (on && d.playerId !== s.id && (d.flipped || []).length >= 3) sfx('surround', 0.35); });
    s.on('countdown', () => { if (!on) return; countdownDecor(); });
    s.on('question', (q) => {
      if (!on) return;
      afterRender(() => {
        ensureBar();
        const hasImg = $('question-image-wrap') && $('question-image-wrap').style.display !== 'none';
        if ($('kdp-think')) $('kdp-think').style.display = hasImg ? 'none' : 'flex';
        paintBar();
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
      afterRender(() => resultDecor(!!r.correct, r.correctText));
    });
    s.on('game-end', (d) => { if (!on) return; stopQuestionTimer(); afterRender(() => endDecor(d)); });
    s.on('kd:prompt', () => sfx('flag', 0.6));
  }

  window.KingdomsSkin = { init, sfx };
})();
