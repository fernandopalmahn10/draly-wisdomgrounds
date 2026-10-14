// Ojo de Halcón — the kid's phone (the product). player.js calls LookPhone.init(...) once; the pastel skin
// (player-kingdoms-skin.js) handles the lobby look, the countdown pose and routes the sounds; this module is the game:
//   · the board: my avatar in the centre panel, four big lamps around it that light up on the server's schedule
//   · a tap = my avatar turns toward the lamp (whoosh + buzz); the right word locks a gold ring «¡La viste!», a wrong
//     word a blue shake «¡Esa no!», a dark lamp just wobbles («Aún no hay nada»)
//   · the result: «+5 ¡Primero!» / +3 / +2 / +1 / 0 with a Dralingo pose, my points and streak
//   · a status line that always says what to do; game-show moments as a band on that line (never over the lamps):
//     «¡Mira la respuesta correcta!», «¡Última ronda!», streaks, «¡FINAL!»; the show intro on the countdown; my end card
// Test hooks: LookPhone.frame(), LookPhone.hold(true) (bands and pops stay), LookPhone.light(pos).
(function () {
  const K = '/assets/kingdoms/', LK = '/assets/look/', D = '/assets/dralingo/', AV = '/assets/saga/avatars/';
  const POP = { 5: '+5 ¡Primero!', 3: '+3 ¡Rápido!', 2: '+2 ¡Bien!', 1: '+1 ¡La viste!' };
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const skin = () => window.KingdomsSkin || null;
  const sfx = (name, vol) => { const s = skin(); if (s && s.sfx) s.sfx(name.indexOf('/') === 0 ? name : LK + name + '.mp3', vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const skinUrl = (s) => AV + (s || 'dralingo') + '.webp';

  let ctx = null, on = false;
  let game = null, roster = {}, cast = null, my = { idx: 0, score: 0, streak: 0 };
  let rd = null;               // the round on screen: { id, round, rounds, opts, at, ... }
  let lit = [false, false, false, false], locked = null, timers = [], paused = false, testHold = false, bandTimer = null, helped = false, cheerI = 0;
  const localAvatar = () => {
    let v = '';
    try { v = localStorage.getItem('dralyAvatar') || ''; } catch (_) {}
    return v;
  };
  const myName = () => ($('lobby-name') && $('lobby-name').textContent) || '';
  const mySkin = () => (roster[my.idx] && roster[my.idx].skin) || skinFor(localAvatar(), myName());
  function skinFor(avatar, name) {
    const S = window.Saga;
    const a = S && S.byEmoji ? S.byEmoji(avatar) : null;
    if (a) return a.id;
    if (S && S.avatar && S.avatar(avatar)) return avatar;
    const s = String(name || '').toLowerCase();
    let h = 7;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const ids = (S && S.AVATARS ? S.AVATARS : [{ id: 'dralingo' }]).map((x) => x.id);
    return ids[h % ids.length];
  }

  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('lk-on', on);
    if (!on) { clearTimers(); rd = null; }
  }

  function init(c) {
    ctx = c;
    const s = c.socket;
    s.on('state', (st) => {
      if (st && st.gameType) setOn(st.gameType === 'look');
      if (on && st && st.state === 'active' && game && $('screen-look') && $('screen-look').classList.contains('hidden')) ctx.showScreen('look');
    });
    s.on('lk:cast', (cs) => { cast = cs; });
    s.on('countdown', () => { if (!on) return; clearTimers(); rd = null; game = null; locked = null; my = { idx: 0, score: 0, streak: 0 }; helped = false; paused = false; if ($('lk-pause')) $('lk-pause').classList.add('hidden'); });
    s.on('lk:init', (d) => {
      setOn(true);
      ctx.markActivity();
      game = d;
      roster = d.players || roster;
      cast = d.cast || cast;
      if (d.me) { my.idx = d.me.idx; my.score = d.me.score; my.streak = d.me.streak; }
      paused = !!d.paused;
      ctx.showScreen('look');
      paintTop();
      paintMe();
      $('lk-pause').classList.toggle('hidden', !paused);
      if (d.q) {
        const same = rd && rd.id === d.id && rd.round === d.round;
        if (!same) applyRound(Object.assign({ id: d.id, round: d.round, rounds: d.rounds }, d.q), true);
        else scheduleReveals(d.q.at, true);
        if (d.me && d.me.look) applyLock(d.me.look.pos, d.me.look.ok, true);
        if (d.phase === 'result' && d.q.correctPos >= 0) markCorrect(d.q.correctPos);
      } else if (d.phase === 'intro' || d.round === 0) {
        resetBoard();
        status('¡Mira la respuesta correcta!', 'go');
        if (!helped) { helped = true; band({ title: '¡Mira la respuesta correcta!', sub: 'El más rápido gana +5', kind: 'gold', ms: 2200 }); }
      } else if (d.phase === 'final') {
        finalCard();
      }
    });
    s.on('lk:roster', (d) => { roster = d.players || roster; paintMe(); });
    s.on('lk:rounds', (d) => { if (rd) rd.rounds = d.rounds; if (game) game.rounds = d.rounds; paintTop(); band({ title: `¡Ahora son ${d.rounds} rondas! 🔁`, kind: 'gold', ms: 1800 }); });
    s.on('lk:round', (d) => { if (!on) return; ctx.markActivity(); applyRound(d, false); });
    s.on('lk:looked', (r) => {
      if (!on || !rd || r.round !== rd.round) return;
      ctx.markActivity();
      if (r.status === 'ok' || r.status === 'wrong') applyLock(r.pos, r.ok, false);
      else if (r.status === 'blank') nothingThere(r.pos);
    });
    s.on('lk:result', (res) => { if (!on) return; ctx.markActivity(); showResult(res); });
    s.on('lk:pause', (d) => {
      paused = !!d.paused;
      $('lk-pause').classList.toggle('hidden', !paused);
      if (paused) { clearTimers(); status('⏸ Pausa: mira al profe', 'band'); }
      else if (d.q && rd) {
        scheduleReveals(d.q.at, true);
        if (!locked) status(lit.some(Boolean) ? '¡Toca la respuesta correcta!' : 'Espera… las respuestas se van a encender', lit.some(Boolean) ? 'go' : '');
        else status(locked.ok ? '¡La viste! Espera el resultado…' : '¡Esa no! Espera el resultado…', locked.ok ? 'ok' : 'bad');
        const pop = $('lk-pop');
        if (pop.classList.contains('show') && !testHold) timers.push(setTimeout(() => pop.classList.remove('show'), 1200));   // a pause during the result
      }
    });
    s.on('lk:final', () => { if (!on) return; ctx.markActivity(); finalCard(); });
    s.on('game-end', () => { if (!on) return; clearTimers(); $('lk-pause').classList.add('hidden'); });
    bindLamps();
  }

  // ---------- the round ----------
  function applyRound(d, fromInit) {
    clearTimers();
    rd = d;
    lit = [false, false, false, false];
    locked = null;
    hideCard();
    paintTop();
    const pr = $('lk-prompt');
    pr.classList.remove('waiting');
    $('lk-prompt-text').textContent = d.text || '';
    const im = $('lk-prompt-img');
    if (d.image) { im.src = d.image; im.classList.remove('hidden'); } else { im.classList.add('hidden'); im.removeAttribute('src'); }
    document.querySelectorAll('.lk-plamp').forEach((el) => {
      const pos = +el.dataset.pos;
      el.className = 'lk-plamp ' + ['top', 'right', 'bottom', 'left'][pos];
      el.disabled = false;
      const sp = el.querySelector('span');
      const t = d.opts && d.opts[pos] != null ? String(d.opts[pos]) : '';
      sp.textContent = t;
      sp.className = t.length > 22 ? 't-xs' : t.length > 14 ? 't-sm' : t.length > 8 ? 't-md' : '';
    });
    const panel = $('lk-panel');
    panel.className = 'lk-ppanel';
    $('lk-pop').className = 'lk-ppop';
    $('lk-pose').classList.add('hidden');
    status('Espera… las respuestas se van a encender', '');
    if (!fromInit) { sfx('round', 0.5); if (d.last) band({ title: '⏱ ¡Última ronda!', sub: 'La que decide el concurso', kind: 'hot', ms: 2000 }); }
    scheduleReveals(d.at, fromInit);
  }
  function scheduleReveals(at, quiet) {
    (at || []).forEach((ms, pos) => {
      if (ms == null || lit[pos]) return;
      if (ms <= 0) light(pos, quiet);
      else timers.push(setTimeout(() => light(pos, false), ms));
    });
  }
  function light(pos, quiet) {
    if (lit[pos] || paused) return;
    lit[pos] = true;
    const el = lamp(pos);
    if (el) el.classList.add('lit');
    if (!quiet) { sfx('pop', 0.6); }
    if (!locked) status('¡Toca la respuesta correcta!', 'go');
  }
  function resetBoard() {
    clearTimers();
    rd = null; lit = [false, false, false, false]; locked = null;
    $('lk-prompt-text').textContent = '¡Atentos!';
    $('lk-prompt').classList.add('waiting');
    $('lk-prompt-img').classList.add('hidden');
    document.querySelectorAll('.lk-plamp').forEach((el) => { el.className = 'lk-plamp ' + ['top', 'right', 'bottom', 'left'][+el.dataset.pos]; el.querySelector('span').textContent = ''; el.disabled = false; });
    $('lk-panel').className = 'lk-ppanel';
    $('lk-pop').className = 'lk-ppop';
    $('lk-pose').classList.add('hidden');
  }
  const lamp = (pos) => document.querySelector(`.lk-plamp[data-pos="${pos}"]`);
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---------- taps ----------
  function bindLamps() {
    document.querySelectorAll('.lk-plamp').forEach((el) => {
      if (el._lkBound) return;
      el._lkBound = true;
      let last = 0;
      const go = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') e.preventDefault();
        const t = now();
        if (t - last < 80) return;       // pointerdown + click on one tap
        last = t;
        tap(+el.dataset.pos);
      };
      el.addEventListener('pointerdown', go);
      el.addEventListener('click', go);
    });
  }
  function tap(pos) {
    if (!on || !rd || paused) return;
    const el = lamp(pos);
    if (el && el.disabled) return;         // the result is on: the lamps are closed
    if (locked) { if (el) { el.classList.add('press'); setTimeout(() => el.classList.remove('press'), 120); } return; }
    if (!lit[pos]) { nothingThere(pos); return; }
    // optimistic: my avatar turns at once, the server confirms right / wrong
    $('lk-panel').className = 'lk-ppanel look-' + pos;
    if (el) el.classList.add('mine');
    sfx(K + 'whoosh.mp3', 0.45);
    buzz(20);
    ctx.socket.emit('player:lk-look', { pin: ctx.getPin(), pos });
  }
  function nothingThere(pos) {
    const el = lamp(pos);
    if (el) { el.classList.remove('nothing'); void el.offsetWidth; el.classList.add('nothing'); }
    sfx('blank', 0.5);
    status('Aún no hay nada ahí… ¡espera a que se encienda!', '');
  }
  function applyLock(pos, ok, quiet) {
    locked = { pos, ok };
    const panel = $('lk-panel');
    panel.className = 'lk-ppanel look-' + pos + (ok ? ' ok' : ' wrong');
    document.querySelectorAll('.lk-plamp').forEach((el) => { el.classList.remove('mine'); if (+el.dataset.pos === pos) el.classList.add(ok ? 'ok' : 'wrong'); });
    if (ok) { status('¡La viste! Espera el resultado…', 'ok'); if (!quiet) { sfx('lock', 0.8); buzz([30, 40, 30]); } }
    else { status('¡Esa no! Espera el resultado…', 'bad'); if (!quiet) { sfx(K + 'wrong.mp3', 0.55); buzz([90, 40, 90]); } }
  }

  // ---------- the result ----------
  function showResult(res) {
    if (!rd || res.round !== rd.round) return;
    clearTimers();
    if (typeof window.__lkOnResult === 'function') { try { window.__lkOnResult(res); } catch (_) {} }   // screenshot runs
    markCorrect(res.correctPos);
    const me = res.rows.find((r) => r.idx === my.idx);
    if (!me) return;
    my.score = me.score;
    my.streak = me.streak;
    paintTop(true);
    const pop = $('lk-pop');
    pop.textContent = me.pts ? POP[me.pts] || `+${me.pts}` : (me.looked ? '0 ¡Esa no!' : '0');
    pop.className = 'lk-ppop show' + (me.pts === 5 ? ' five' : me.pts === 0 ? ' zero' : '');
    const pose = $('lk-pose');
    pose.src = D + (me.pts === 5 ? 'power' : me.pts ? 'hello' : 'wise') + '.webp';
    pose.classList.remove('hidden');
    if (me.looked) { $('lk-panel').className = 'lk-ppanel look-' + me.pos + (me.ok ? ' ok' : ' wrong'); }
    if (me.pts === 5) { sfx('first', 0.85); buzz([40, 30, 40, 30, 120]); status(`¡Primero! +5 · ${res.n > 1 ? 'nadie fue más rápido' : '¡qué ojo!'}`, 'ok'); }
    else if (me.pts) { sfx('pts', 0.6); status(`+${me.pts} · la respuesta era «${res.correctText}»`, 'ok'); }
    else if (me.looked) status(`Era «${res.correctText}». ¡A la próxima!`, 'bad');
    else status(`No miraste… era «${res.correctText}»`, 'bad');
    if (me.ok && (me.streak === 3 || me.streak === 5 || me.streak === 8)) {
      const C = window.DralingoCast;
      const id = cast && cast.cheers ? cast.cheers[cheerI++ % cast.cheers.length] : null;
      setTimeout(() => band({ title: `🔥 ¡Racha de ${me.streak}!`, sub: C && id ? `${C.name(id)}: «${C.line(id, 'win')}»` : '¡Sigue así!', img: C && id ? C.pose(id, 'cheer') : null, kind: 'hot', ms: 2400 }), 1100);
      sfx(K + 'streak.mp3', 0.6);
    }
    if (!testHold) timers.push(setTimeout(() => { pop.classList.remove('show'); }, 2600));
  }
  function markCorrect(pos) {
    document.querySelectorAll('.lk-plamp').forEach((el) => {
      const p = +el.dataset.pos;
      el.disabled = true;
      if (p === pos) { el.classList.add('lit', 'correct'); el.classList.remove('dim'); } else el.classList.add('dim');
    });
  }

  // ---------- top, me, status, bands, cards ----------
  function paintTop(bump) {
    const total = (rd && rd.rounds) || (game && game.rounds) || 10, cur = (rd && rd.round) || (game && game.round) || 0;
    const dots = $('lk-dots');
    dots.innerHTML = '';
    for (let i = 1; i <= total; i++) { const d = document.createElement('i'); if (i < cur) d.className = 'done'; else if (i === cur) d.className = 'now'; dots.appendChild(d); }
    $('lk-round').textContent = cur ? `Ronda ${cur} de ${total}` : `${total} rondas`;
    $('lk-score').textContent = my.score;
    if (bump) { const sc = $('lk-score').parentNode; sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump'); }
    const st = $('lk-streak');
    st.textContent = `🔥 ${my.streak}`;
    st.classList.toggle('hidden', my.streak < 2);
  }
  function paintMe() {
    $('lk-me').src = skinUrl(mySkin());
    $('lk-me-name').textContent = myName();
  }
  function status(text, cls) {
    const el = $('lk-status');
    el._text = text; el._cls = cls || '';   // always remembered: a band on the line shows the latest status when it ends
    if (bandTimer) return;
    el.innerHTML = '';
    el.appendChild(document.createTextNode(text));
    el.className = 'lk-pstatus' + (cls ? ' ' + cls : '');
  }
  // a game-show moment on the status line (never over the lamps), ≤ 2.5 s
  function band(o) {
    const el = $('lk-status');
    if (el._text == null) { el._text = el.textContent; el._cls = ''; }
    clearTimeout(bandTimer);
    el.innerHTML = '';
    if (o.img) { const im = document.createElement('img'); im.src = o.img; im.alt = ''; el.appendChild(im); }
    const b = document.createElement('b'); b.textContent = o.title; el.appendChild(b);
    if (o.sub) { el.appendChild(document.createTextNode(' ')); const s = document.createElement('small'); s.textContent = o.sub; s.style.fontWeight = '800'; s.style.opacity = '.85'; el.appendChild(s); }
    el.className = 'lk-pstatus band' + (o.kind ? ' ' + o.kind : '');
    bandTimer = setTimeout(() => { bandTimer = null; if (!testHold) status(el._text, el._cls); }, o.ms || 2200);
  }
  function finalCard() {
    clearTimers();
    resetBoard();
    $('lk-prompt-text').textContent = '¡Se acabaron las rondas!';
    status('¡FINAL! Mira el tablero…', 'band gold');
    card(`<img class="pc-card-pose" src="${D}power.webp" alt=""><div class="lk-pcard-big">¡FINAL!</div><div class="pc-card-text">Tus puntos: <b>${my.score}</b> ⭐</div>`);
    sfx('final', 0.8);
  }
  function card(html) {
    const c = $('lk-card');
    c.innerHTML = html;
    c.classList.remove('hidden');
  }
  function hideCard() { $('lk-card').classList.add('hidden'); }

  // ---------- lobby («Así se juega» + who I play as), the show intro on the countdown, my end card ----------
  function lobby(head) {
    let box = $('lk-how');
    if (!head) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div');
      box.className = 'lk-how';
      box.id = 'lk-how';
      box.innerHTML = '<div class="lk-you"><img id="lk-you-img" alt=""><span>Vas a concursar como<b id="lk-you-name"></b></span></div>'
        + '<div class="lk-how-title">Así se juega</div><ol>'
        + '<li><span>?</span><span><b>Lee la pregunta</b><small>aparece sola en el tablero</small></span></li>'
        + '<li><span class="lk-ico-lamps"><i></i><i></i><i></i><i></i></span><span><b>Las respuestas se encienden</b><small>una a una, en cualquier lámpara</small></span></li>'
        + '<li><span>+5</span><span><b>Toca la correcta, ¡rápido!</b><small>el más rápido +5 · una equivocada = 0</small></span></li>'
        + '</ol>';
      head.after(box);
    }
    const sk = mySkin();
    const S = window.Saga, a = S && S.avatar ? S.avatar(sk) : null;
    $('lk-you-img').src = skinUrl(sk);
    $('lk-you-name').textContent = a ? a.label.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').trim() : sk;
  }
  function intro(ov) {
    let box = $('lk-pintro');
    if (!ov) { if (box) box.remove(); return; }
    if (box) box.remove();
    box = document.createElement('div');
    box.className = 'lk-pintro';
    box.id = 'lk-pintro';
    const C = window.DralingoCast;
    const host = (cast && cast.host) || 'hamdan';
    const hello = host === 'hamdan' ? `¡Marhaba, ${myName() || 'concursante'}! Empieza el concurso más rápido de Dubái.` : (C ? C.line(host, 'hello') : '¡Empieza el concurso!');
    box.innerHTML = `<div class="lk-pintro-title">Ojo de <span>Halcón</span></div>`
      + `<div class="lk-pintro-row"><img src="${C ? C.pose(host, 'hello') : '/assets/cast/hamdan-hello.webp'}" alt=""><p></p><img class="me" src="${skinUrl(mySkin())}" alt=""></div>`;
    box.querySelector('p').textContent = hello;
    ov.prepend(box);
  }
  function end(data) {
    const me = (data && data.me) || {};
    const L = (data && data.look) || {};
    const emoji = $('end-emoji');
    emoji.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'kdp-end-img';
    img.alt = '';
    img.src = me.won ? skinUrl(mySkin()) : D + (me.rank <= 3 ? 'power' : 'hello') + '.webp';
    emoji.appendChild(img);
    const b = $('end-banner');
    b.className = 'winner-banner';
    b.textContent = me.won ? (L.tie ? '¡Empate en la cima! 🦅' : '¡Ganaste! 🦅') : me.rank === 2 ? '¡Segundo lugar!' : me.rank === 3 ? '¡Tercer lugar!' : '¡Buen concurso!';
    const teamEl = $('end-team-score'), meEl = $('end-personal-score');
    if (teamEl && teamEl.parentNode) teamEl.parentNode.style.display = 'none';
    if (meEl && meEl.parentNode.firstChild) meEl.parentNode.firstChild.nodeValue = 'Tus puntos: ';
    if (meEl) meEl.textContent = `${me.score || 0} ⭐`;
    let box = $('lk-pend');
    if (box) box.remove();
    box = document.createElement('div');
    box.className = 'lk-pend';
    box.id = 'lk-pend';
    const rank = document.createElement('div');
    rank.className = 'lk-pend-rank';
    rank.innerHTML = `Puesto <b>${me.rank || '-'}</b> de ${me.of || '-'}`;
    const stats = document.createElement('div');
    stats.className = 'lk-pend-stats';
    [[`✅ ${me.right || 0} ${me.right === 1 ? 'acierto' : 'aciertos'}`], me.firsts ? [`🦅 ${me.firsts} ${me.firsts === 1 ? 'vez' : 'veces'} primero`] : null, me.best >= 2 ? [`🔥 racha de ${me.best}`] : null, me.avg != null ? [`⚡ ${(me.avg / 1000).toFixed(1).replace('.', ',')} s`] : null]
      .filter(Boolean).forEach(([t]) => { const s = document.createElement('span'); s.textContent = t; stats.appendChild(s); });
    box.append(rank, stats);
    const AW = { eye: '🦅 Premio Ojo de Halcón: ¡la primera mirada!', fastest: '⚡ Premio Rayo: ¡la reacción más rápida!', streak: '🔥 Premio Racha: ¡la mejor racha!' };
    (me.awards || []).forEach((a) => { const d = document.createElement('div'); d.className = 'lk-pend-award'; d.textContent = AW[a] || a; box.appendChild(d); });
    if (!me.won && L.winner) {
      const w = document.createElement('div');
      w.className = 'lk-pend-winner';
      const im = document.createElement('img'); im.src = skinUrl(L.winner.skin); im.alt = '';
      w.append(im, document.createTextNode(`${L.tie ? 'Empate: ' : 'Ganó '}${L.tie ? (L.winners || []).map((x) => x.name).join(' y ') : L.winner.name} · ${L.winner.score} ⭐`));
      box.appendChild(w);
    }
    if (meEl && meEl.parentNode) meEl.parentNode.after(box);
    if (me.won) { sfx(K + 'sting-win.mp3', 0.9); buzz([60, 40, 60, 40, 200]); } else sfx('final', 0.6);
  }

  window.LookPhone = {
    init, lobby, intro, end,
    frame: () => ({ on, round: rd && rd.round, rounds: rd && rd.rounds, lit: lit.slice(), locked, paused, score: my.score, streak: my.streak, status: $('lk-status') && $('lk-status').textContent }),
    hold: (v) => { testHold = !!v; },
    light: (pos) => light(pos, true),
    tap,
  };
})();
