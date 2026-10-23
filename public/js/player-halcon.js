// Ojos de Halcón — the kid's phone (the product). player.js calls HalconPhone.init(...) once; the pastel skin
// (player-kingdoms-skin.js) routes the sounds, the lobby card and the end screen here. The phone IS the minigame:
//   · countdown: the TV studio, the kid's board (3–5 full-body characters) runs in, the camera pushes into the board
//   · every round: the question across the board, then the four answers pop into the round windows; the window is the
//     button: one tap = my character snaps to look at it (lean + turn + a beam), the board's rivals turn live as they look
//   · resolve: glow ring + sparkles + «+5 / +3 / +2 / +1» and the victory pose for right looks, a blue slump for wrong
//     ones, the chips count up · «¡FINAL!» · the studio finale: «<name> ¡Gana!», the winner poses, the others fall
// Game-show moments are short and never cover the windows while they are open (the band only runs between rounds).
// Test hooks: HalconPhone.frame(), HalconPhone.tap(pos), HalconPhone.hold(true) (the bands stay up for screenshots).
(function () {
  'use strict';
  const A = '/assets/halcon/', K = '/assets/kingdoms/', D = '/assets/dralingo/';
  const ANSWER_MS = 6000;
  const $ = (id) => document.getElementById(id);
  const HB = () => window.HalconBoard;
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sfx = (name, vol) => { const s = window.KingdomsSkin; if (s && s.sfx) s.sfx(name.indexOf('/') === 0 ? name : A + name + '.mp3', vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const POS_WORD = ['arriba', 'a la derecha', 'abajo', 'a la izquierda'];

  let ctx = null, on = false;
  let g = null;                 // { id, you, board, round, rounds, phase }
  let seats = [];
  let B = null, studio = null;
  let q = null;                 // the round on screen { round, text, image, opts, pics }
  let myLook = null, resolved = null, paused = false, testHold = false, helped = false, score = 0, confirmed = false;
  let timers = [], introTimers = [];

  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('hc-on', on);
    if (!on) { clearTimers(); clearIntro(); }
  }
  const later = (ms, fn, list) => { const t = setTimeout(fn, Math.max(0, ms)); (list || timers).push(t); return t; };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function clearIntro() { introTimers.forEach(clearTimeout); introTimers = []; const box = $('hc-intro'); if (box) box.classList.add('hidden'); }
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  // the character I will play as: the same pick the server makes (my lobby emoji, or one from my name)
  function localSkin() {
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    return HB() ? HB().skinFor(v, myName()) : 'dralingo';
  }

  // ---------- the screen ----------
  function ensureBoard() {
    if (B || !HB()) return;
    const wrap = $('hc-boardwrap');
    const wide = window.innerWidth > window.innerHeight && window.innerWidth >= 700;   // a tablet / landscape phone
    B = new (HB().Board)(wrap, { layout: wide ? 'wide' : 'tall', onTap: tap });
  }
  function show() {
    ctx.showScreen('halcon');
    requestAnimationFrame(() => { if (B) B.fit(); });
  }
  function setQ(text, image, fresh) {
    const box = $('hc-q');
    $('hc-q-text').textContent = text || '¡Atentos!';
    const im = $('hc-q-img');
    if (image) { im.src = image; im.classList.remove('hidden'); } else { im.classList.add('hidden'); im.removeAttribute('src'); }
    box.classList.toggle('wait', !text);
    if (fresh && !reduced()) { box.classList.remove('new'); void box.offsetWidth; box.classList.add('new'); }
  }
  function hint(text, cls) {
    const el = $('hc-hint');
    el.textContent = text || '';
    el.className = 'hc-hint' + (cls ? ' ' + cls : '');
  }
  function paintBar() {
    const r = g ? g.round : 0, n = g ? g.rounds : 10;
    $('hc-round').textContent = r ? `Ronda ${r} de ${n}` : `${n} rondas`;
    $('hc-score').textContent = `⭐ ${score}`;
  }
  function pauseUI(v) {
    paused = !!v;
    $('hc-pause').classList.toggle('hidden', !paused);
  }

  // screenshot runs can freeze the screen on a moment: the game's events wait in a queue and replay in order
  let frozen = false, queue = [];
  function init(c) {
    ctx = c;
    const sock = c.socket;
    const s = {
      on: (ev, fn) => sock.on(ev, (d) => {
        if (frozen && ev.indexOf('hc:') === 0) { queue.push([fn, d, ev]); return; }
        fn(d);
      }),
    };
    s.on('state', (st) => {
      if (!st) return;
      if (st.gameType) setOn(st.gameType === 'halcon');
      if (!on) return;
      if (st.state === 'lobby') { clearTimers(); clearIntro(); g = null; q = null; pauseUI(false); document.body.classList.remove('hc-ended'); }
      if (B && g && st.players) {
        const off = {};
        Object.values(st.players).forEach((p) => { off[String(p.name).toLowerCase()] = !!p.off; });
        seats.forEach((x) => { const k = String(x.name).toLowerCase(); if (k in off) B.setOn(x.id, !off[k]); });
      }
    });
    s.on('countdown', () => {
      if (!on) return;
      clearTimers(); clearIntro();
      g = null; q = null; myLook = null; resolved = null; score = 0; helped = false; pauseUI(false);
      document.body.classList.remove('hc-ended');
      const old = document.getElementById('hc-finale');
      if (old) old.remove();
    });
    s.on('hc:init', (d) => applyInit(d));
    s.on('hc:intro', (d) => {
      if (!on || !B || !g) return;
      ctx.markActivity();
      g.phase = 'intro';
      g.rounds = d.rounds || g.rounds;
      clearIntro();
      B.newRound();
      B.dots(0, g.rounds);
      B.bandShow('¡Mira la respuesta correcta!');
      hint('¡Toca la ventana con la respuesta!', 'go');
      paintBar();
      later((d.ms || 1700) - 650, () => { B.bandShow('¡YA!', 'go'); sfx('start', 0.75); buzz(30); });
    });
    s.on('hc:q', (d) => {
      if (!on || !B || !g) return;
      ctx.markActivity();
      newQuestion(d);
    });
    s.on('hc:open', (d) => {
      if (!on || !B || !q || d.round !== q.round) return;
      ctx.markActivity();
      openWindows(d.opts, d.pics, d.ms);
    });
    s.on('hc:mine', (d) => {
      if (!on || !B || !q || d.round !== q.round) return;
      confirmed = true;
      if (d.status === 'locked' && d.pos >= 0 && d.pos !== myLook) { if (myLook != null) B.unlook(g.you); myLook = d.pos; B.look(g.you, d.pos, true); }
      else if (d.status === 'closed' && myLook != null && !resolved) {
        // too late (the round closed on the server) or paused: my character turns back
        B.unlook(g.you);
        myLook = null;
        hint(paused ? '⏸ Pausa: mira al profe' : '¡Uy! La ronda ya se cerró', 'bad');
      }
    });
    // a rival has looked: «ready» only (their window shows at the reveal, when everybody snaps together)
    s.on('hc:ready', (d) => {
      if (!on || !B || !q || d.round !== q.round || !g || d.board !== g.board || d.id === g.you) return;
      B.ready(d.id);
      sfx(K + 'tap.mp3', 0.22);
    });
    s.on('hc:closing', (d) => {
      if (!on || !B || !q || d.round !== q.round) return;
      clearTimers();
      B.timer(d.ms, ANSWER_MS);
    });
    s.on('hc:resolve', (d) => {
      if (!on || !B || !q || d.round !== q.round) return;
      ctx.markActivity();
      resolve(d);
    });
    s.on('hc:seat', (d) => {
      if (!on || !B || !g || !d.board || d.board.id !== g.board) return;
      seats = d.board.seats;
      B.setSeats(seats, g.you);
      B.dots(g.round, g.rounds);
      if (q && q.opts && !resolved) B.open(q.opts, q.pics, null);
    });
    s.on('hc:rounds', (d) => {
      if (!on || !g) return;
      g.rounds = d.rounds;
      if (B) B.dots(g.round, g.rounds);
      paintBar();
      hint(`¡Ahora son ${d.rounds} rondas! 🔁`, 'go');
    });
    s.on('hc:finish', () => {
      if (!on || !B || !g) return;
      ctx.markActivity();
      clearTimers();
      g.phase = 'final';
      if (!resolved) B.newRound();                // «Terminar» mid-round: the windows close, everybody faces front
      B.bandShow('¡FINAL!', 'final');
      setQ('¡FINAL! Se acabaron las rondas', null, true);
      $('hc-round').textContent = '¡FINAL!';
      sfx('/assets/party/final-v2.mp3', 0.8);
      buzz([40, 30, 40]);
      hint('¡Se acabó! ¿Quién ganó tu tablero?', 'go');
      later(1300, () => { if (!testHold) B.bandHide(); B.crown(); });
    });
    s.on('hc:pause', (d) => {
      if (!on) return;
      ctx.markActivity();
      pauseUI(d.paused);
      if (!B || !g) return;
      if (d.paused) { clearTimers(); B.timerHold(); return; }
      ctx.markActivity();
      if (d.phase === 'answer' && q && q.opts && !resolved) { B.timer(d.phaseMs, ANSWER_MS); scheduleTicks(d.phaseMs); }
      if (d.phase === 'intro') later(d.phaseMs - 650, () => { B.bandShow('¡YA!', 'go'); sfx('start', 0.75); });
    });
    s.on('game-end', () => { if (!on) return; clearTimers(); clearIntro(); pauseUI(false); });
  }

  // a snapshot from the server: start, reload, late join, resync
  function applyInit(d) {
    setOn(true);
    ctx.markActivity();
    const fresh = !g || g.id !== d.id;
    g = { id: d.id, you: d.you, board: d.board, round: d.round, rounds: d.rounds, phase: d.phase };
    const board = (d.boards || [])[0];
    seats = board ? board.seats : [];
    const mine = seats.find((x) => x.id === d.you);
    if (mine) score = mine.score || 0;
    ensureBoard();
    if (!B) return;
    show();
    B.setSeats(seats, d.you);
    B.dots(d.round, d.rounds);
    paintBar();
    pauseUI(d.paused);
    if (d.you == null) { setQ('¡Ya casi! Te estamos buscando un tablero…'); hint(''); return; }
    if (d.phase === 'countdown') { if (fresh) startIntro(d.phaseMs); return; }
    clearIntro();
    if (d.phase === 'intro') {
      B.newRound();
      B.bandShow('¡Mira la respuesta correcta!');
      setQ(null);
      hint('¡Toca la ventana con la respuesta!', 'go');
      return;
    }
    if (d.q) {
      const same = q && q.round === d.round && q.text === d.q.text;
      if (!same) {
        q = { round: d.round, text: d.q.text, image: d.q.image, opts: null, pics: null };
        myLook = null; resolved = null;
        B.newRound();
        setQ(d.q.text, d.q.image, false);
      }
      if (d.phase === 'question') { B.bandShow(d.q.text, 'q'); hint('Lee la pregunta…'); }
      else if (d.q.opts) {
        B.bandHide();
        q.opts = d.q.opts; q.pics = d.q.pics;
        B.open(d.q.opts, d.q.pics, d.phase === 'answer' && !d.paused ? d.phaseMs : 0, ANSWER_MS);
        if (d.phase === 'answer' && d.paused) { B.timer(d.phaseMs, ANSWER_MS); B.timerHold(); }
        if (d.phase === 'answer' && !d.paused) scheduleTicks(d.phaseMs);
      }
      requestAnimationFrame(() => {
        // a tap made during a network blip never reached the server (the new socket joined after it): send it again
        const mineOnServer = d.mine != null;
        if (same && d.phase === 'answer' && !d.paused && myLook != null && !mineOnServer) {
          ctx.socket.emit('player:hc-look', { pin: ctx.getPin(), pos: myLook });
        }
        if (mineOnServer) { myLook = d.mine; B.look(g.you, d.mine, true); }
        (d.ready || []).forEach((sid) => { if (sid !== g.you) B.ready(sid); });
        if (d.phase === 'answer') hint(myLook != null ? '¡Listo! Esperando a los demás…' : '¡Toca la ventana correcta!', myLook != null ? 'ok' : 'go');
        if (d.phase === 'resolve' && d.res && d.res.boards[0]) {
          resolved = d.res;
          B.resolve(d.res.correctPos, d.res.boards[0].rows, () => hint(`La respuesta era «${d.res.correctText}»`, ''));
        }
      });
      return;
    }
    if (d.phase === 'final' || d.phase === 'done') { B.bandShow('¡FINAL!', 'final'); B.crown(); hint('¡Se acabó! ¿Quién ganó tu tablero?', 'go'); }
  }

  // the countdown: the studio wide shot, the board runs in, the camera pushes into the board
  function startIntro(ms) {
    clearIntro();
    const box = $('hc-intro');
    if (!box || !HB()) return;
    box.innerHTML = '';
    box.classList.remove('hidden');
    studio = new (HB().Studio)(box, {});
    studio.intro(seats, g.you);
    const n = seats.length;
    const mates = seats.filter((x) => x.id !== g.you).map((x) => x.name);
    studio.say(n > 1 ? `¡Tu tablero: ${mates.slice(0, 3).join(', ')}${mates.length > 3 ? '…' : ''}!` : '¡Bienvenido a Draly Halcón!');
    setQ(null);
    hint(n > 1 ? `Compites contra ${n - 1} ${n === 2 ? 'rival' : 'rivales'} de tu tablero` : 'Compites en tu tablero', '');
    B.newRound();
    B.dots(0, g.rounds);
    sfx(K + 'whoosh.mp3', 0.5);
    const run = Math.min(2300, 1500 + n * 110);
    const left = Math.max(1200, (ms || 3400) - 300);
    const zoomAt = Math.min(run, left - 600);
    later(zoomAt, () => { if (testHold) return; studio.zoom(); sfx('round', 0.5); }, introTimers);
    later(zoomAt + 520, () => {
      if (testHold) return;                     // screenshot runs keep the studio on screen
      box.classList.add('hidden');
      B.fit();
      B.bandShow('¡Mira la respuesta correcta!');
    }, introTimers);
  }

  function newQuestion(d) {
    clearTimers();
    clearIntro();
    g.round = d.round;
    g.rounds = d.rounds;
    g.phase = 'question';
    q = { round: d.round, text: d.text, image: d.image, opts: null, pics: null };
    myLook = null;
    resolved = null;
    B.newRound();
    B.dots(d.round, d.rounds);
    B.bandShow(d.text, 'q');
    setQ(d.text, d.image, true);
    paintBar();
    hint(d.last ? '⏱ ¡Última ronda! Lee la pregunta…' : 'Lee la pregunta…', d.last ? 'go' : '');
    sfx('round', 0.45);
  }
  function openWindows(opts, pics, ms) {
    g.phase = 'answer';
    q.opts = opts;
    q.pics = pics;
    B.bandHide();
    B.open(opts, pics, ms, ANSWER_MS);
    sfx('pop', 0.6);
    hint('¡Toca la ventana correcta!', 'go');
    scheduleTicks(ms);
    if (!helped) { helped = true; pointHand(); }
  }
  function scheduleTicks(ms) {
    [3000, 2000, 1000].forEach((left) => {
      if (ms > left) later(ms - left, () => { if (myLook == null && !resolved) { sfx(K + 'tick.mp3', 0.45); if (B) B.timerEl.classList.add('hurry'); } });
    });
  }
  // the first round: a tapping hand over a window teaches «the window is the button»
  function pointHand() {
    const hand = $('hc-hand');
    if (!hand || !B || reduced()) return;
    const w = B.wins[0].querySelector('.hcb-glass').getBoundingClientRect();
    const wrap = $('hc-boardwrap').getBoundingClientRect();
    hand.style.left = (w.left - wrap.left + w.width * 0.55) + 'px';
    hand.style.top = (w.top - wrap.top + w.height * 0.5) + 'px';
    hand.classList.remove('show');
    void hand.offsetWidth;
    hand.classList.add('show');
  }

  // ---------- my look ----------
  function tap(pos) {
    if (!on || !B || !g || paused || !q || !q.opts || resolved || g.phase !== 'answer') return;
    if (myLook != null) { buzz(8); return; }
    if (q.opts[pos] == null) return;
    myLook = pos;
    B.look(g.you, pos);                         // optimistic: my character snaps at once, the server confirms
    sfx(K + 'whoosh.mp3', 0.5);
    buzz(22);
    hint(`¡Miraste ${POS_WORD[pos]}! Esperando a los demás…`, '');
    const hand = $('hc-hand');
    if (hand) hand.classList.remove('show');
    ctx.markActivity();
    const send = () => ctx.socket.emit('player:hc-look', { pin: ctx.getPin(), pos });
    send();
    // a flaky phone network: no answer from the server in 1.2 s → send the same look once more (the server keeps the
    // first one it gets: a repeat only comes back «locked»)
    confirmed = false;
    const round = q.round;
    later(1200, () => { if (!confirmed && q && q.round === round && !resolved && myLook === pos) send(); });
  }

  // ---------- the resolve ----------
  function resolve(d) {
    clearTimers();
    g.phase = 'resolve';
    resolved = d;
    const rows = (d.board && d.board.rows) || [];
    B.bandHide();
    const me = rows.find((r) => r.id === g.you);
    hint('¡A ver!', 'go');
    sfx(K + 'whoosh.mp3', 0.45);                      // the reveal: everybody snaps to their window
    B.resolve(d.correctPos, rows, () => verdict(d, me));
  }
  // the verdict beat, REVEAL_MS after the reveal: my sounds, my points, my line
  function verdict(d, me) {
    if (!me || !g || resolved !== d) return;
    score = me.score;
    paintBar();
    if (me.ok) {
      sfx(me.pts === 5 ? 'first' : 'yes', 0.85);
      buzz(me.pts === 5 ? [40, 30, 40, 30, 90] : [30, 40, 30]);
      const streak = me.streak >= 3 ? ` · 🔥 racha de ${me.streak}` : '';
      hint(me.pts === 5 ? `¡+5! ¡El más rápido de tu tablero!${streak}` : `+${me.pts} · ¡Bien visto!${streak}`, 'ok');
    } else {
      sfx('aww', 0.75);
      buzz([90, 40, 90]);
      const late = !me.looked && myLook != null;      // I tapped, but the round had already closed on the server
      if (late) myLook = null;
      hint(me.looked ? `¡Esa no! Era «${d.correctText}»` : late ? `¡Uy, llegaste tarde! Era «${d.correctText}»` : `¡Se acabó el tiempo! Era «${d.correctText}»`, 'bad');
    }
  }

  // ---------- lobby: who I play as + «Así se juega» ----------
  function lobby(head) {
    let box = $('hc-how');
    if (!head) { if (box) box.remove(); return; }
    const H = HB();
    if (!H) return;
    const skin = localSkin();
    if (!box) {
      box = document.createElement('div');
      box.className = 'hc-how';
      box.id = 'hc-how';
      box.innerHTML = '<div class="hc-you"><img id="hc-you-img" alt=""><span>Vas a concursar como<b id="hc-you-name"></b></span></div>'
        + '<div class="hc-how-title">Así se juega</div><ol>'
        + '<li><div class="hc-step"><div class="q">¿Qué significa…?</div></div><span>Lee la pregunta<small>sale en el tablero</small></span></li>'
        + '<li><div class="hc-step"><i class="w t">baba</i><i class="w l">gege</i><i class="w r ok">mama</i><img id="hc-how-look" alt=""></div><span>Toca la ventana<small>con la respuesta</small></span></li>'
        + '<li><div class="hc-step"><i class="ring"></i><img id="hc-how-win" alt=""><b class="pts">+5</b></div><span>¡El más rápido!<small>gana +5 · mal = 0</small></span></li>'
        + '</ol>';
      head.after(box);
    }
    const S = window.Saga;
    $('hc-you-img').src = H.art(skin, 'idle');
    $('hc-you-name').textContent = (S && S.labelOf && S.labelOf(skin)) || 'Dralingo';   // (🪙 a skin: its own name)
    $('hc-how-look').src = H.art(skin, 'idle');
    $('hc-how-win').src = H.art(skin, 'ok');
  }

  // ---------- the end: the studio finale of my board, then my card ----------
  function end(data) {
    const H = HB();
    const box = $('screen-end');
    if (!H || !box) return;
    const old = $('hc-finale');
    if (old) old.remove();
    const hc = (data && data.halcon) || {};
    const me = (data && data.me) || {};
    const b = (hc.boards || [])[0];
    const rows = b ? b.rows : [];
    const fin = document.createElement('div');
    fin.className = 'hc-finale';
    fin.id = 'hc-finale';
    const stage = document.createElement('div');
    stage.className = 'hc-fstage';
    fin.appendChild(stage);
    box.appendChild(fin);                       // in the page first: the set reads its own shape (phone upright or not)
    const st = new H.Studio(stage, { big: true });
    const winners = b ? b.winners : [];
    st.finale(rows.map((r) => ({ id: r.id, name: r.name, skin: r.skin })), winners, me.id, { animated: true });
    const top = (hc.top || [])[0];
    const why = b && b.why === 'firsts' ? '¡Desempate: más +5!' : b && b.why === 'speed' ? '¡Desempate: miró más rápido!' : '';
    const wNames = rows.filter((r) => winners.includes(r.id)).map((r) => r.name);
    st.say(me.won ? (winners.length > 1 ? '¡Empate! ¡Qué ojos!' : `¡Felicidades, ${myName() || 'campeón'}!`)
      : wNames.length ? `¡Bravo, ${wNames.join(' y ')}!` : '¡La próxima ronda es nuestra!');
    const card = document.createElement('div');
    card.className = 'hc-card';
    const h2 = document.createElement('h2');
    const shared = rows.filter((r) => r.rank === me.rank).length > 1;
    h2.textContent = me.won ? (winners.length > 1 ? '¡Empate en tu tablero! 🦅' : '¡Ganaste tu tablero! 🦅')
      : !me.score ? '¡La próxima es tuya!'
        : shared ? `¡Empate en el puesto ${me.rank}!` : `Puesto ${me.rank || '-'} de ${me.of || '-'} en tu tablero`;
    const l1 = document.createElement('p');
    l1.className = 'hc-line';
    l1.append('Tus puntos: ');
    const sc = document.createElement('b');
    sc.textContent = `${me.score || 0} ⭐`;
    l1.appendChild(sc);
    const l2 = document.createElement('p');
    l2.className = 'hc-small';
    const parts = [`En la clase: puesto ${me.classRank || '-'} de ${me.classOf || '-'}`];
    if (me.won && why) parts.push(why);
    if (top && !me.classWon) parts.push(`Campeón de la clase: ${top.name} · ${top.score} ⭐`);
    if (me.classWon) parts.push('¡Y eres el número 1 de toda la clase! 👑');
    l2.textContent = parts.join(' · ');
    const home = document.createElement('button');
    home.className = 'hc-home';
    home.type = 'button';
    home.textContent = '🏠 Inicio';
    home.addEventListener('click', () => { location.href = '/'; });
    card.append(h2, l1, l2, home);
    fin.appendChild(card);
    sfx(K + 'sting-win.mp3', me.won ? 0.9 : 0.6);
    if (me.won) buzz([60, 40, 60, 40, 200]);
    document.body.classList.add('hc-ended');
    setTimeout(() => st.say(''), 2400);          // Dralingo's line goes before the card comes up: nothing covers the winner
  }

  window.HalconPhone = {
    init, lobby, end,
    frame: () => ({
      on, phase: g && g.phase, round: g && g.round, rounds: g && g.rounds, you: g && g.you, board: g && g.board, myLook, paused, score,
      seats: seats.map((x) => x.name), opts: q && q.opts, hint: $('hc-hint') && $('hc-hint').textContent,
    }),
    tap,
    hold: (v) => { testHold = !!v; },
    holdReveal: (v) => { if (HB()) HB().holdReveal(v); },
    freeze: (v) => {
      frozen = !!v;
      if (!frozen) { const q2 = queue; queue = []; q2.forEach(([fn, d]) => fn(d)); }
      return queue.length;
    },
    // stay frozen but play the queued events up to (and including) the first `ev` (e.g. 'hc:resolve')
    replay: (ev) => {
      while (queue.length) { const [fn, d, e] = queue.shift(); fn(d); if (e === ev) break; }
      return queue.length;
    },
    queued: () => queue.map((x) => x[2]),
    board: () => B,
  };
})();
