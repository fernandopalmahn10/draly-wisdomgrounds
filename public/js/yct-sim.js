// =========================================================================
// yct-sim.js — Student-side YCT / New HSK mock exam
// =========================================================================
// Same room plumbing as hsk-sim.js (PIN → socket player:join → wait for
// the teacher's Empezar → /api/hsk-sim/:simId payload → heartbeat →
// /submit), with the real exam flow:
//   cover → LISTENING driven by one continuous audio track (the screen
//   follows the audio: welcome, part instructions, examples already
//   answered, each question while it is read twice) → review (YCT 2 min,
//   New HSK 5 min) → READING, self-paced on a clock → results (score /200,
//   per-part %, tap a number to review the question).
// Progress is kept in sessionStorage so a reload resumes at the same
// second of the audio instead of restarting the exam.
// =========================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (sec) => { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };

  // ── Tap feedback (tick + haptic) ────────────────────────────────────
  let _ctx = null;
  function tick() {
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (_) {}
    try {
      _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = _ctx.createOscillator(), g = _ctx.createGain();
      o.connect(g); g.connect(_ctx.destination); o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, _ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, _ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, _ctx.currentTime + 0.08);
      o.start(); o.stop(_ctx.currentTime + 0.09);
    } catch (_) {}
  }

  // ── State ───────────────────────────────────────────────────────────
  const params = new URLSearchParams(location.search);
  let simId = params.get('sim') || '';
  let roomPin = params.get('pin') || '';
  let studentCode = params.get('code') || '';
  let sim = null;
  let answers = {};
  let phase = 'gate';              // cover | listening | review | reading | done
  let segs = [];                   // listening schedule
  let segIdx = -1;
  let audio = null;
  let muted = false;
  let listenStartedAt = 0;         // epoch ms when the audio started (for resume)
  let reviewStartedAt = 0;
  let readingStartedAt = 0;
  let readSteps = [];              // reading items incl. examples, in order
  let readCursor = 0;
  let reviewQ = null;              // listening item open during review
  let peekQ = null;                // earlier listening item opened while the audio plays
  let clockTimer = null;
  let hbTimer = null;
  let finished = false;
  let socket = null;
  let started = false;
  let roomPass = '';               // 🔒 joining the teacher's room gives it; the room's sim loads with it (2026-10-15)

  // Exam family (YCT / New HSK, 2026-10-11) from the sim id: names on the gate
  // and cover, and a body class for family layouts (New HSK full-card pictures).
  const isNewHsk = () => /^newhsk/i.test(simId);
  function applyFamily() {
    document.body.classList.toggle('fam-newhsk', isNewHsk());
    $('y-gate-title').textContent = (isNewHsk() ? 'New HSK' : 'YCT') + ' · Simulación';
    $('y-book').textContent = isNewHsk() ? '新HSK' : 'YCT';
  }
  applyFamily();
  // "2 minutos" (YCT) / "5 minutos" (New HSK): the listening review length.
  function reviewMin() { const m = Math.round(((sim && sim.listening.review) || 120) / 60); return m + (m === 1 ? ' minuto' : ' minutos'); }

  if (roomPin) $('y-pin').value = roomPin;
  if (studentCode) $('y-code').value = studentCode;
  $('y-enter').addEventListener('click', tryEnter);
  ['y-pin', 'y-code'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') tryEnter(); }));
  if (roomPin && studentCode && params.get('direct') !== '1') setTimeout(tryEnter, 60);

  // 🔒 2026-10-15 (La Ruta Dorada): a logged-in student opens one simulation by its link (?sim=…, no room PIN) and
  // takes it on their own. The server only serves this page to whoever may use that level (its key, core/level-keys.js), and the
  // payload, files and grade follow the same session (core/sim-lock.js). Old forced links (?access=…) keep the PIN box.
  const debugDirect = params.get('debug') === '1' && params.get('direct') === '1';
  const solo = !!simId && !roomPin && !params.has('access') && !debugDirect;
  if (solo) {
    started = true;
    $('y-gate').classList.add('hidden');
    if (!studentCode) { try { studentCode = localStorage.getItem('dralyStudentCode') || ''; } catch (_) {} }
    setTimeout(loadSim, 30);
  }

  $('y-waiting-home').addEventListener('click', goHome);
  // ← 2026-10-18 (his rule: every screen has a way back): the PIN card and the cover go back to the page the kid came
  // from (La Ruta Dorada, Mis tareas), else La Ruta Dorada (solo) or the home card (a room). In a room the cover's
  // way back leaves the room like «Volver a mi perfil»; mid-exam only a solo kid may leave, after a confirm (a room's
  // exam is the teacher's: its waiting screen keeps «Volver a mi perfil»).
  // only pages that never lead back into an exam (review: the player page re-joins the room, the other exam page
  // forwards here, /homework?next= comes straight back): La Ruta Dorada (with its #paso-3), Mis tareas, the home card
  const backHref = (function () {
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      if (r && r.origin === location.origin) {
        if (/^\/audios(\/[a-z0-9-]+)*\/?$/i.test(r.pathname)) return r.pathname + r.search + r.hash;
        if (/^\/(homework(\.html)?)?$/.test(r.pathname)) return r.pathname;
      }
    } catch (_) {}
    return solo ? '/audios' : '/';
  })();
  ['y-gate-back', 'y-cover-back'].forEach((id) => { const a = $(id); if (a) a.href = backHref; });
  if (!solo && $('y-cover-back')) $('y-cover-back').addEventListener('click', (e) => { e.preventDefault(); goHome(); });
  if (solo && $('y-exit')) {
    $('y-exit').addEventListener('click', () => confirmBox('¿Salir del simulacro?',
      'Lo que respondiste en este intento no se guarda. Puedes empezarlo otra vez cuando quieras.', () => { location.href = backHref; }));
  }
  function goHome() {
    try { if (socket) socket.disconnect(); } catch (_) {}
    let code = studentCode;
    if (!code) { try { code = localStorage.getItem('dralyStudentCode') || ''; } catch (_) {} }
    location.href = '/homework.html' + (code ? '?code=' + encodeURIComponent(code) + '&from=hsk-sim' : '');
  }
  function realName() {
    try { const l = JSON.parse(localStorage.getItem('dralyLastJoin') || '{}'); return (l && l.name) ? String(l.name) : ''; } catch (_) { return ''; }
  }

  // ── Join the PIN room (identical contract to hsk-sim.js) ───────────
  function tryEnter() {
    roomPin = $('y-pin').value.trim();
    studentCode = $('y-code').value.trim();
    if (!roomPin || !studentCode) { $('y-gate-err').textContent = 'Falta el PIN y tu código de estudiante.'; return; }
    if (!/^\d{3,4}$/.test(roomPin)) { $('y-gate-err').textContent = 'Tu PIN debe ser de 3 o 4 dígitos.'; return; }
    $('y-gate-err').textContent = 'Entrando a la sala…';
    socket = io();
    let savedClass = '';
    try { savedClass = localStorage.getItem('dralyHwAccessCode') || ''; } catch (_) {}
    socket.emit('player:join', { pin: roomPin, name: realName() || studentCode, avatar: '', studentCode, accessCode: savedClass }, (resp) => {
      if (!resp || !resp.ok) {
        $('y-gate-err').textContent = (resp && resp.error) || 'PIN no válido. Pregúntale a tu maestra.';
        try { socket.disconnect(); } catch (_) {}
        socket = null;
        return;
      }
      roomPass = resp.roomPass || '';
      $('y-gate').classList.add('hidden');
      $('y-waiting').classList.remove('hidden');
      $('y-waiting-pin').textContent = 'PIN: ' + roomPin;
    });
    socket.on('state', (s) => {
      if (!s) return;
      if (s.hsk && s.hsk.simId && !simId) simId = s.hsk.simId;
      if ((s.state === 'active' || s.state === 'countdown') && !started) {
        started = true;
        $('y-waiting').classList.add('hidden');
        loadSim();
      }
    });
  }

  function loadSim() {
    const q = '?studentCode=' + encodeURIComponent(studentCode) + '&pin=' + encodeURIComponent(roomPin) +
      (roomPass ? '&pass=' + encodeURIComponent(roomPass) : '') +
      (debugDirect ? '&debug=1&direct=1' : '');   // the local harness (the server allows it on this PC only)
    fetch('/api/hsk-sim/' + encodeURIComponent(simId) + q, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        // a solo exam whose session ended (12 h): the page itself asks for the code again, once
        let relogged = true;
        try { relogged = !!sessionStorage.getItem('yct:relogin'); } catch (_) {}
        if (d && d.locked && solo && !relogged) {
          try { sessionStorage.setItem('yct:relogin', '1'); } catch (_) {}
          location.reload();
          return;
        }
        if (!d || !d.ok) { $('y-gate').classList.remove('hidden'); $('y-gate-err').textContent = 'No se pudo cargar: ' + ((d && d.error) || ''); return; }
        try { sessionStorage.removeItem('yct:relogin'); } catch (_) {}
        sim = d.sim;
        simId = sim.id;
        applyFamily();
        buildSchedule();
        buildReading();
        $('y-title').textContent = sim.title;
        $('y-paper').textContent = sim.title;
        $('y-cover-title').textContent = sim.title;
        document.title = sim.title;
        renderStructure();
        $('y-exam').classList.remove('hidden');
        startHeartbeat();
        if (!restore()) show('cover');
      })
      .catch((e) => { $('y-gate').classList.remove('hidden'); $('y-gate-err').textContent = 'Red: ' + e.message; });
  }

  // ── Persistence (sessionStorage, per sim + kid) ─────────────────────
  const storeKey = () => 'yct:' + simId + ':' + studentCode;
  function save() {
    try {
      sessionStorage.setItem(storeKey(), JSON.stringify({ phase, answers, listenStartedAt, reviewStartedAt, readingStartedAt, readCursor }));
    } catch (_) {}
  }
  let restore = function () {
    let st = null;
    try { st = JSON.parse(sessionStorage.getItem(storeKey()) || 'null'); } catch (_) {}
    if (!st || !st.phase || st.phase === 'cover' || st.phase === 'done') return false;
    answers = st.answers || {};
    listenStartedAt = st.listenStartedAt || 0;
    reviewStartedAt = st.reviewStartedAt || 0;
    readingStartedAt = st.readingStartedAt || 0;
    readCursor = st.readCursor || 0;
    if (st.phase === 'listening') {
      const at = (Date.now() - listenStartedAt) / 1000;
      if (at < listenEnd()) {
        $('y-resume').classList.remove('hidden');
        $('y-resume-go').onclick = () => { $('y-resume').classList.add('hidden'); startListening((Date.now() - listenStartedAt) / 1000); };
        return true;
      }
      reviewStartedAt = listenStartedAt + listenEnd() * 1000;
      st.phase = 'review';
    }
    if (st.phase === 'review') {
      const left = sim.listening.review - (Date.now() - reviewStartedAt) / 1000;
      if (left > 0) { startReview(true); return true; }
      readingStartedAt = readingStartedAt || reviewStartedAt + sim.listening.review * 1000;
      st.phase = 'reading';
    }
    if (st.phase === 'reading') { startReading(true); return true; }
    return false;
  };

  // ── Cover ───────────────────────────────────────────────────────────
  function count(sec) { return sec.parts.reduce((n, p) => n + p.items.filter((i) => !i.example).length, 0); }
  function renderStructure() {
    const L = sim.listening, R = sim.reading;
    const nL = count(L), nR = count(R);
    let h = '<tr><th>Sección</th><th>Parte</th><th>Preguntas</th><th>Total</th><th>Tiempo</th></tr>';
    L.parts.forEach((p, i) => {
      h += '<tr>' + (i === 0 ? '<td class="sec" rowspan="' + L.parts.length + '">🎧 Escucha</td>' : '') +
        '<td>Parte ' + p.part + '</td><td>' + p.items.filter((x) => !x.example).length + '</td>' +
        (i === 0 ? '<td rowspan="' + L.parts.length + '">' + nL + '</td><td rowspan="' + L.parts.length + '">≈ ' + Math.round(L.timeLimit / 60) + ' min</td>' : '') + '</tr>';
    });
    R.parts.forEach((p, i) => {
      h += '<tr>' + (i === 0 ? '<td class="sec" rowspan="' + R.parts.length + '">📖 Lectura</td>' : '') +
        '<td>Parte ' + p.part + '</td><td>' + p.items.filter((x) => !x.example).length + '</td>' +
        (i === 0 ? '<td rowspan="' + R.parts.length + '">' + nR + '</td><td rowspan="' + R.parts.length + '">' + Math.round(R.timeLimit / 60) + ' min</td>' : '') + '</tr>';
    });
    $('y-structure').innerHTML = h;
    $('y-rule-review').textContent = reviewMin();
    const allEx = L.parts.concat(R.parts).every((p) => p.items.some((i) => i.example));
    $('y-rule-ex').innerHTML = (allEx ? 'Cada parte empieza' : 'Casi todas las partes empiezan') + ' con un <b>ejemplo</b> que ya viene contestado.';
  }
  $('y-start').addEventListener('click', () => { tick(); startListening(0); });

  function show(which) {
    phase = which === 'cover' ? 'cover' : phase;
    $('y-cover').classList.toggle('hidden', which !== 'cover');
    $('y-runner').classList.toggle('hidden', which === 'cover');
    if ($('y-exit')) $('y-exit').classList.toggle('hidden', !solo || which === 'cover');   // the cover has its own «← Volver»
    if ($('y-cover-back')) $('y-cover-back').classList.toggle('hidden', which !== 'cover');
  }

  // ── LISTENING: the screen follows one continuous audio track ───────
  // Each item owns the screen from ~2 s before its audio (the number is
  // read out) until the next item starts, so its answer pause stays on
  // its own screen. Part intros start where the instructions are spoken.
  function listenEnd() { return sim.listening.endAt || 0; }
  function buildSchedule() {
    segs = [];
    const parts = sim.listening.parts;
    const firstIntro = parts[0].introAt != null ? parts[0].introAt : Math.max(0, parts[0].items[0].t[0] - 6);
    segs.push({ from: 0, kind: 'welcome' });
    // "听力考试现在开始" — the official start line gets its own screen.
    if (sim.listening.startAt) segs.push({ from: sim.listening.startAt, kind: 'start' });
    parts.forEach((p, pi) => {
      const introAt = pi === 0 ? firstIntro : (p.introAt != null ? p.introAt : p.items[0].t[0] - 8);
      segs.push({ from: introAt, kind: 'intro', part: p });
      p.items.forEach((it, ii) => {
        const lead = it.example && ii === 0 ? 1.0 : 2.0;
        segs.push({ from: Math.max(introAt + 0.5, it.t[0] - lead), kind: 'item', part: p, item: it });
      });
    });
    const lastItem = parts[parts.length - 1].items.slice(-1)[0];
    const end = listenEnd() || (lastItem.t[1] + 8);
    if (!sim.listening.endAt) sim.listening.endAt = end;
    segs.push({ from: sim.listening.endLineAt ? sim.listening.endLineAt - 0.3 : lastItem.t[1] + 9, kind: 'outro' });
    segs.sort((a, b) => a.from - b.from);
  }

  function startListening(at) {
    phase = 'listening';
    show('runner');
    $('y-nav').classList.add('hidden');
    $('y-audio-bar').classList.remove('hidden');
    $('y-clock').classList.add('hidden');
    if (!listenStartedAt || at === 0) listenStartedAt = Date.now() - at * 1000;
    save();
    audio = new Audio(sim.listening.audio);
    audio.preload = 'auto';
    audio.muted = muted;
    const go = () => {
      try { if (at > 0.5) audio.currentTime = at; } catch (_) {}
      audio.play().catch(() => {
        // Autoplay refused (rare: we are inside a tap) → ask for a tap.
        $('y-resume').classList.remove('hidden');
        $('y-resume-go').onclick = () => { $('y-resume').classList.add('hidden'); startListening((Date.now() - listenStartedAt) / 1000); };
      });
    };
    if (audio.readyState >= 1) go(); else audio.addEventListener('loadedmetadata', go, { once: true });
    audio.addEventListener('timeupdate', onAudioTime);
    audio.addEventListener('ended', () => { if (phase === 'listening') startReview(false); });
    // A phone lock / call pauses the media element: offer to continue at
    // the real elapsed second (the exam clock keeps running, like the real one).
    audio.addEventListener('pause', () => {
      if (phase !== 'listening' || audio.ended) return;
      $('y-resume').classList.remove('hidden');
      $('y-resume-go').onclick = () => {
        $('y-resume').classList.add('hidden');
        const at2 = (Date.now() - listenStartedAt) / 1000;
        if (at2 >= listenEnd()) { startReview(false); return; }
        try { audio.currentTime = at2; } catch (_) {}
        audio.play().catch(() => {});
      };
    });
    segIdx = -1;
    renderSide();
    onAudioTime(at);   // draw the right screen now, before the first timeupdate
  }

  function onAudioTime(tNow) {
    if (phase !== 'listening' || !audio) return;
    const t = typeof tNow === 'number' ? tNow : audio.currentTime;
    const end = listenEnd();
    $('y-audio-fill').style.width = Math.min(100, (t / end) * 100) + '%';
    $('y-audio-left').textContent = fmt(end - t);
    $('y-audio-ico').classList.toggle('on', !audio.paused);
    let i = 0;
    while (i + 1 < segs.length && segs[i + 1].from <= t) i++;
    if (i !== segIdx) {
      segIdx = i;
      // A kid looking back at an earlier answer is brought to the new
      // question as soon as the audio reaches it, so nothing is missed.
      peekQ = null;
      renderSeg(segs[i]);
    }
    if (typeof tNow !== 'number' && t >= end + 0.5) startReview(false);
  }

  function partLabel(secName, part) { return secName + ' · Parte ' + part.part; }

  function renderSeg(seg) {
    const box = $('y-q');
    if (seg.kind === 'welcome') {
      $('y-part-label').textContent = 'Escucha';
      $('y-counter').textContent = '0 / ' + totalQ();
      box.innerHTML = '<div class="y-intro"><img src="/assets/dralingo.png" alt="" class="y-intro-logo">' +
        '<div class="zh-big zh">欢迎参加考试</div><h2>Bienvenido al examen</h2>' +
        '<p>Escucha con atención. La prueba de escucha empieza en unos segundos.</p>' + wave() + skipBtn('Saltar intro') + '</div>';
    } else if (seg.kind === 'start') {
      $('y-part-label').textContent = 'Escucha';
      box.innerHTML = '<div class="y-intro y-intro-start"><div class="y-start-zh zh">听力考试现在开始</div>' +
        '<div class="y-py">tingli kaoshi xianzai kaishi</div>' +
        '<h2>La prueba de escucha empieza ahora</h2>' + wave() + '</div>';
    } else if (seg.kind === 'intro') {
      const p = seg.part;
      $('y-part-label').textContent = partLabel('Escucha', p);
      box.innerHTML = '<div class="y-intro"><div class="zh-big zh">' + esc(p.zh) + '</div>' +
        '<h2>Escucha · Parte ' + p.part + '</h2><p>' + esc(introText(p)) + '</p>' + wave() + skipBtn('Saltar instrucciones') + '</div>';
    } else if (seg.kind === 'outro') {
      $('y-part-label').textContent = 'Escucha';
      box.innerHTML = '<div class="y-intro y-intro-start"><div class="y-start-zh zh">听力考试现在结束</div>' +
        '<div class="y-py">tingli kaoshi xianzai jieshu</div>' +
        '<h2>Terminó la prueba de escucha</h2><p>Ahora tendrás ' + reviewMin() + ' para revisar tus respuestas.</p></div>';
    } else {
      renderItem(seg.part, seg.item, { live: true });
    }
    const skip = $('y-skip');
    if (skip) skip.addEventListener('click', () => { tick(); skipSeg(); });
    renderSide();
    sendHeartbeat();
  }
  // Intros play by default; "Saltar" jumps the audio to where the next
  // screen starts (welcome → the start line; part instructions → its
  // example). The resume clock moves with it.
  function skipBtn(label) {
    return '<button class="y-btn y-btn-ghost y-skip" id="y-skip" type="button">' + esc(label) + ' ⏭</button>';
  }
  function skipSeg() {
    const next = segs[segIdx + 1];
    if (!audio || !next) return;
    const target = next.from + 0.05;
    const jump = target - audio.currentTime;
    if (jump <= 0) return;
    try { audio.currentTime = target; } catch (_) { return; }
    listenStartedAt -= jump * 1000;
    save();
    onAudioTime();
  }
  function wave() { return '<div class="y-listen-wave"><i></i><i></i><i></i><i></i><i></i></div>'; }
  function introText(p) {
    switch (p.type) {
      case 'listen_true_false_picture':
        return p.part === 1 ? 'Vas a oír una palabra. Mira la imagen: ¿es lo mismo? Toca ✓ o ✗.'
                            : 'Vas a oír una oración. Mira la imagen: ¿es lo mismo? Toca ✓ o ✗.';
      case 'listen_choose_picture_abc':
        if (isNewHsk()) return 'Vas a oír una frase corta. Toca la imagen correcta: A, B o C.';
        return p.part === 2 ? 'Vas a oír una palabra. Toca la imagen correcta: A, B o C.'
                            : 'Vas a oír una pregunta y su respuesta. Toca la imagen correcta: A, B o C.';
      case 'listen_choose_text_abc':
        return p.part === 2 ? 'Vas a oír una pregunta. Toca la mejor respuesta: A, B o C.'
                            : 'Vas a oír una oración y después una pregunta sobre ella. Toca la respuesta correcta: A, B o C.';
      case 'listen_match_picture_gallery':
        return 'Vas a oír un diálogo corto. Busca su imagen entre la A y la F y tócala.';
      default: return '';
    }
  }
  // One line under the number in Reading (Reading has no instruction screen).
  function hintText(p) {
    switch (p.type) {
      case 'read_word_true_false_picture': return 'Mira la palabra y la imagen: ¿es lo mismo? Toca ✓ o ✗.';
      case 'read_match_sentence_to_picture': return 'Lee la oración y toca la imagen que va con ella.';
      case 'read_choose_reply_bank': return 'Lee la pregunta y toca la respuesta que le va mejor.';
      case 'read_fill_blank_word_bank': return 'Toca la palabra que completa el espacio.';
      case 'read_passage_question_abc': return 'Lee el texto y contesta la pregunta ★.';
      default: return '';
    }
  }

  // ── Question rendering (shared by listening, review, reading, results) ─
  function totalQ() { return count(sim.listening) + count(sim.reading); }
  function renderItem(part, it, opts) {
    opts = opts || {};
    const box = $('y-q');
    const secName = it.qid && it.qid[0] === 'R' || (!it.qid && it.id[0] === 'R') ? 'Lectura' : 'Escucha';
    $('y-part-label').textContent = partLabel(secName, part);
    $('y-counter').textContent = (it.example ? 0 : it.num) + ' / ' + totalQ();
    box.innerHTML = (opts.banner || '') + itemHtml(part, it, opts);
    box.classList.toggle('y-locked', !!it.example || !!opts.readonly);
    const back = $('y-back-live');
    if (back) back.addEventListener('click', () => { tick(); backToLive(); });
    if (it.example || opts.readonly) return;
    box.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
      tick();
      answers[it.qid] = b.getAttribute('data-v');
      save();
      renderItem(part, it, opts);
      renderSide();
    }));
  }

  // opts.mark = { mine, key } for the results review (right/wrong colours)
  function itemHtml(part, it, opts) {
    const mark = opts.mark || null;
    const chosen = it.example ? it.answer : (mark ? mark.mine : answers[it.qid]);
    const key = it.example ? it.answer : (mark ? mark.key : null);
    const cls = (v) => {
      if (key != null && v === key) return ' right';
      if (mark && v === mark.mine && v !== key) return ' wrong';
      if (!mark && v === chosen) return it.example ? ' right' : ' sel';
      return '';
    };
    let h = '<div class="y-q-tag"><span class="y-q-zh zh">' + esc(part.zh || '') + '</span>' +
      (it.example ? '<span class="y-badge ex">Ejemplo</span><span class="y-ex-note">Ya viene contestado</span>'
                  : '<span class="y-badge">' + it.num + '</span>') + '</div>';
    const hint = !it.t && hintText(part);
    if (hint && !mark) h += '<p class="y-hint">' + esc(hint) + '</p>';
    // Text answers (New HSK): letter + hanzi + pinyin on one big button.
    const textBtns = (list, extra) => '<div class="' + extra + '">' + list.map((o) =>
      '<button class="y-txt y-pick' + cls(o.label) + '" data-v="' + o.label + '" type="button"><span class="y-txt-letter">' + o.label + '</span>' +
      '<span class="y-txt-body"><span class="zh">' + esc(o.hanzi) + '</span>' + (o.pinyin ? '<span class="y-py">' + esc(o.pinyin) + '</span>' : '') + '</span></button>').join('') + '</div>';
    // Six shared pictures A–F: tap a picture or its letter.
    const gallery = () => '<div class="y-gallery">' + part.gallery.map((g) =>
      '<button class="y-opt y-pick' + cls(g.label) + '" data-v="' + g.label + '" type="button"><span class="y-opt-letter">' + g.label + '</span><img src="' + esc(g.image) + '" alt=""></button>').join('') + '</div>';
    const letters = () => '<div class="y-letters">' + part.gallery.map((g) =>
      '<button class="y-pick' + cls(g.label) + '" data-v="' + g.label + '" type="button">' + g.label + '</button>').join('') + '</div>';
    const pickW = part.bank ? part.bank.find((b) => b.label === chosen) : null;
    const fill = (s) => esc(s).replace('___', '<span class="y-blank">' + (pickW ? esc(pickW.hanzi) : '&nbsp;') + '</span>');
    const fillPy = (s) => esc(s).replace('___', '<span class="y-blank">' + (pickW ? esc(pickW.pinyin) : '&nbsp;') + '</span>');
    const line = (d, f1, f2) => '<div class="y-line"><span class="y-spk">' + esc(d.speaker) + '</span><div><div class="zh">' + f1(d.hanzi) + '</div><div class="y-py">' + f2(d.pinyin) + '</div></div></div>';
    switch (part.type) {
      case 'listen_true_false_picture':
      case 'read_word_true_false_picture':
        if (it.word) h += '<div class="y-word"><div class="zh">' + esc(it.word.hanzi) + '</div><div class="y-py">' + esc(it.word.pinyin) + '</div></div>';
        h += '<img class="y-pic" src="' + esc(it.image) + '" alt="">';
        h += '<div class="y-tf"><button class="y-pick' + cls('T') + '" data-v="T" type="button">✓</button>' +
             '<button class="y-pick' + cls('F') + '" data-v="F" type="button">✗</button></div>';
        break;
      case 'listen_choose_picture_abc':
        h += '<div class="y-abc">' + it.options.map((o) =>
          '<button class="y-opt y-pick' + cls(o.label) + '" data-v="' + o.label + '" type="button">' +
          '<span class="y-opt-letter">' + o.label + '</span><img src="' + esc(o.image) + '" alt=""></button>').join('') + '</div>';
        break;
      case 'read_match_sentence_to_picture':
        h += gallery();
        h += '<div class="y-sentence"><div class="zh">' + esc(it.hanzi) + '</div><div class="y-py">' + esc(it.pinyin) + '</div></div>';
        h += letters();
        break;
      case 'listen_match_picture_gallery':      // New HSK listening part 3
        h += gallery() + letters();
        break;
      case 'listen_choose_text_abc':            // New HSK listening parts 2 and 4
        h += textBtns(it.options, 'y-txt-opts');
        break;
      case 'read_choose_reply_bank':            // New HSK reading part 2
        h += '<div class="y-sentence"><div class="zh">' + esc(it.hanzi) + '</div><div class="y-py">' + esc(it.pinyin) + '</div>' +
          '<div class="y-reply"><span class="y-blank">' + (pickW ? esc(pickW.hanzi) : '&nbsp;') + '</span></div></div>';
        h += textBtns(part.bank, 'y-bank');
        break;
      case 'read_fill_blank_word_bank':
        if (it.image) {                         // YCT: picture + dialogue, compact letter bank
          h += '<div class="y-dialog"><img class="y-pic" src="' + esc(it.image) + '" alt=""><div>' +
            it.dialogue.map((d) => line(d, fill, fillPy)).join('') + '</div></div>';
          h += '<div class="y-letters y-bank-letters">' + part.bank.map((b) =>
            '<button class="y-pick' + cls(b.label) + '" data-v="' + b.label + '" type="button">' + b.label +
            '<small>' + esc(b.hanzi) + ' · ' + esc(b.pinyin) + '</small></button>').join('') + '</div>';
          break;
        }
        // New HSK: one sentence (or a two-line dialogue) with a blank, big word buttons
        h += it.dialogue
          ? '<div class="y-sentence y-dialog-box">' + it.dialogue.map((d) => line(d, fill, fillPy)).join('') + '</div>'
          : '<div class="y-sentence"><div class="zh">' + fill(it.hanzi) + '</div><div class="y-py">' + fillPy(it.pinyin) + '</div></div>';
        h += textBtns(part.bank, 'y-bank y-bank-words');
        break;
      case 'read_passage_question_abc':         // New HSK reading part 4
        h += '<div class="y-passage"><div class="zh">' + esc(it.passage.hanzi) + '</div><div class="y-py">' + esc(it.passage.pinyin) + '</div></div>';
        h += '<div class="y-question"><span class="y-star">★</span><div><div class="zh">' + esc(it.question.hanzi) + '</div><div class="y-py">' + esc(it.question.pinyin) + '</div></div></div>';
        h += textBtns(it.options, 'y-txt-opts');
        break;
      default:
        h += '<p>Tipo de pregunta desconocido.</p>';
    }
    return h;
  }

  // ── Sidebar: question grid ─────────────────────────────────────────
  function renderSide() {
    const curNum = currentNum();
    const navL = phase === 'review' || phase === 'listening';
    const navR = phase === 'reading';
    const heard = (i) => phase !== 'listening' || !audio || (i.t && i.t[0] - 2 <= audio.currentTime);
    let h = '';
    [['listening', '🎧 Escucha', navL, phase === 'reading'], ['reading', '📖 Lectura', navR, phase !== 'reading']].forEach(([key, name, nav, locked]) => {
      h += '<div class="y-side-sec' + (locked ? ' locked' : '') + '"><div class="y-side-sec-name">' + name + '</div>';
      sim[key].parts.forEach((p) => {
        h += '<div class="y-side-part">Parte ' + p.part + '</div><div class="y-grid">';
        p.items.filter((i) => !i.example).forEach((i) => {
          const can = nav && heard(i);
          const c = (answers[i.qid] != null ? ' done' : '') + (i.num === curNum && !locked ? ' cur' : '') + (can ? ' nav' : '');
          h += '<button class="y-num' + c + '" data-q="' + i.qid + '" type="button"' + (can ? '' : ' tabindex="-1"') + '>' + i.num + '</button>';
        });
        h += '</div>';
      });
      h += '</div>';
    });
    if (phase === 'listening') h += '<button class="y-btn y-btn-ghost y-side-btn" id="y-end-listen" type="button">Terminar escucha</button>';
    if (phase === 'review') h += '<button class="y-btn y-btn-gold y-side-btn" id="y-to-reading" type="button">Terminar revisión →</button>';
    if (phase === 'reading') h += '<button class="y-btn y-btn-gold y-side-btn" id="y-submit" type="button">Entregar examen ✓</button>';
    const side = $('y-side');
    side.innerHTML = h;
    side.querySelectorAll('.y-num.nav').forEach((b) => b.addEventListener('click', () => {
      tick();
      const qid = b.getAttribute('data-q');
      if (phase === 'review') openReviewQ(qid);
      else if (phase === 'listening') openPeek(qid);
      else if (phase === 'reading') { readCursor = readSteps.findIndex((s) => s.item.qid === qid); renderReading(); }
    }));
    const toR = $('y-to-reading');
    if (toR) toR.addEventListener('click', () => confirmBox('¿Terminar la revisión?',
      missingText(sim.listening) + 'Pasarás a Lectura y ya no podrás volver a Escucha.', () => startReading(false)));
    const endL = $('y-end-listen');
    if (endL) endL.addEventListener('click', () => confirmBox('¿Terminar la escucha?',
      'El audio se detendrá y empezarán tus ' + reviewMin() + ' de revisión. Ya no podrás oír el resto del audio.', () => startReview(false)));
    const sub = $('y-submit');
    if (sub) sub.addEventListener('click', askSubmit);
  }
  function currentNum() {
    if (phase === 'listening') {
      if (peekQ) return peekQ.item.num;
      const s = segs[segIdx]; return s && s.item && !s.item.example ? s.item.num : null;
    }
    if (phase === 'review') return reviewQ ? reviewQ.item.num : null;
    if (phase === 'reading') { const s = readSteps[readCursor]; return s && !s.item.example ? s.item.num : null; }
    return null;
  }

  // ── LOOK BACK while the audio plays ────────────────────────────────
  // Like the official platform: a number already heard can be opened and its
  // answer changed while the audio keeps going. A banner shows where the
  // audio is; the kid returns with one tap, or automatically when the audio
  // reaches the next question.
  function openPeek(qid) {
    const f = findListening(qid);
    if (!f) return;
    const live = segs[segIdx];
    if (live && live.item === f.item) { backToLive(); return; }
    peekQ = f;
    const liveNum = live && live.item && !live.item.example ? live.item.num : null;
    const banner = '<div class="y-peek"><span>Estás revisando la pregunta <b>' + f.item.num + '</b>' +
      (liveNum ? ' · el audio va en la <b>' + liveNum + '</b>' : ' · el audio sigue') + '</span>' +
      '<button class="y-btn y-btn-jade" id="y-back-live" type="button">↩ Volver al audio</button></div>';
    renderItem(f.part, f.item, { banner });
    renderSide();
  }
  function backToLive() {
    peekQ = null;
    if (segs[segIdx]) renderSeg(segs[segIdx]);
  }
  function missingText(section) {
    const miss = [];
    section.parts.forEach((p) => p.items.forEach((i) => { if (!i.example && answers[i.qid] == null) miss.push(i.num); }));
    return miss.length ? 'Sin contestar: ' + miss.join(', ') + '. ' : 'Contestaste todas. ';
  }

  // ── REVIEW (2 min after the audio) ─────────────────────────────────
  function findListening(qid) {
    for (const p of sim.listening.parts) for (const it of p.items) if (it.qid === qid) return { part: p, item: it };
    return null;
  }
  function startReview(resumed) {
    if (phase === 'review' || phase === 'reading' || phase === 'done') return;
    phase = 'review';
    if (audio) { try { audio.pause(); } catch (_) {} audio = null; }
    if (!resumed) reviewStartedAt = Date.now();
    save();
    show('runner');
    peekQ = null;
    $('y-audio-bar').classList.add('hidden');
    $('y-nav').classList.remove('hidden');
    reviewQ = null;
    renderReviewIntro();
    renderSide();
    runClock(() => sim.listening.review - (Date.now() - reviewStartedAt) / 1000, () => startReading(false));
    sendHeartbeat();
  }
  function reviewList() {
    const out = [];
    sim.listening.parts.forEach((p) => p.items.forEach((i) => { if (!i.example) out.push(i.qid); }));
    return out;
  }
  function renderReviewIntro() {
    $('y-part-label').textContent = 'Escucha · Revisión';
    $('y-counter').textContent = '';
    $('y-q').classList.remove('y-locked');
    $('y-q').innerHTML = '<div class="y-intro"><img src="/assets/dralingo.png" alt="" class="y-intro-logo"><h2>Revisa tus respuestas</h2>' +
      '<p>Tienes ' + reviewMin() + '. Toca <b>Siguiente</b> para ir pregunta por pregunta, o un número a la izquierda. ' +
      'Puedes cambiar cualquier respuesta. Cuando estés listo, toca <b>Terminar revisión</b>.</p>' +
      '<p class="y-review-miss">' + esc(missingText(sim.listening)) + '</p></div>';
    $('y-prev').disabled = true;
    $('y-next').textContent = 'Siguiente →';
    renderSide();
  }
  function openReviewQ(qid) {
    reviewQ = findListening(qid);
    if (!reviewQ) return;
    renderItem(reviewQ.part, reviewQ.item, {});
    const list = reviewList();
    const k = list.indexOf(qid);
    $('y-prev').disabled = false;
    $('y-next').textContent = k === list.length - 1 ? 'Terminar revisión →' : 'Siguiente →';
    renderSide();
  }
  function reviewStep(d) {
    const list = reviewList();
    const k = reviewQ ? list.indexOf(reviewQ.item.qid) : -1;
    const n = k + d;
    if (n < 0) { reviewQ = null; renderReviewIntro(); return; }
    if (n >= list.length) {
      confirmBox('¿Terminar la revisión?', missingText(sim.listening) + 'Pasarás a Lectura y ya no podrás volver a Escucha.', () => startReading(false));
      return;
    }
    openReviewQ(list[n]);
  }

  // ── READING (self-paced, 17 min) ───────────────────────────────────
  function buildReading() {
    readSteps = [];
    sim.reading.parts.forEach((p) => p.items.forEach((it) => readSteps.push({ part: p, item: it })));
  }
  function startReading(resumed) {
    if (phase === 'reading' && !resumed) return;
    phase = 'reading';
    closeConfirm();
    if (!resumed || !readingStartedAt) readingStartedAt = Date.now();
    save();
    show('runner');
    $('y-audio-bar').classList.add('hidden');
    $('y-nav').classList.remove('hidden');
    runClock(() => sim.reading.timeLimit - (Date.now() - readingStartedAt) / 1000, () => finish(true));
    renderReading();
  }
  function renderReading() {
    readCursor = Math.max(0, Math.min(readSteps.length - 1, readCursor));
    const s = readSteps[readCursor];
    renderItem(s.part, s.item, {});
    $('y-prev').disabled = readCursor === 0;
    $('y-next').textContent = readCursor === readSteps.length - 1 ? 'Entregar ✓' : 'Siguiente →';
    renderSide();
    save();
    sendHeartbeat();
  }
  $('y-prev').addEventListener('click', () => {
    if (phase === 'review') { tick(); reviewStep(-1); return; }
    if (phase !== 'reading') return; tick(); readCursor--; renderReading();
  });
  $('y-next').addEventListener('click', () => {
    if (phase === 'review') { tick(); reviewStep(1); return; }
    if (phase !== 'reading') return;
    tick();
    if (readCursor >= readSteps.length - 1) { askSubmit(); return; }
    readCursor++; renderReading();
  });
  function askSubmit() {
    const miss = [];
    [sim.listening, sim.reading].forEach((sec) => sec.parts.forEach((p) => p.items.forEach((i) => {
      if (!i.example && answers[i.qid] == null) miss.push(i.num);
    })));
    confirmBox('¿Entregar el examen?', miss.length
      ? 'Te faltan ' + miss.length + ' sin contestar: ' + miss.join(', ') + '. Puedes tocar esos números para contestarlos antes de entregar.'
      : 'Contestaste todas las preguntas. ¡Bien hecho!', () => finish(false));
  }

  // ── Clock, confirm, mute ────────────────────────────────────────────
  function runClock(leftFn, onZero) {
    if (clockTimer) clearInterval(clockTimer);
    $('y-clock').classList.remove('hidden');
    const step = () => {
      const left = leftFn();
      $('y-clock-txt').textContent = fmt(left);
      $('y-clock').classList.toggle('warn', left <= 60);
      if (left <= 0) { clearInterval(clockTimer); clockTimer = null; onZero(); }
    };
    step();
    clockTimer = setInterval(step, 500);
  }
  let _confirmYes = null;
  function confirmBox(title, text, onYes) {
    $('y-confirm-title').textContent = title;
    $('y-confirm-text').textContent = text;
    _confirmYes = onYes;
    $('y-confirm').classList.remove('hidden');
  }
  function closeConfirm() { $('y-confirm').classList.add('hidden'); _confirmYes = null; }
  $('y-confirm-no').addEventListener('click', closeConfirm);
  $('y-confirm-yes').addEventListener('click', () => { const f = _confirmYes; closeConfirm(); if (f) f(); });
  $('y-mute').addEventListener('click', () => {
    muted = !muted;
    if (audio) audio.muted = muted;
    $('y-mute').textContent = muted ? '🔇' : '🔊';
  });

  // ── Heartbeat (teacher's live monitor) ──────────────────────────────
  function startHeartbeat() {
    sendHeartbeat();
    if (hbTimer) clearInterval(hbTimer);
    hbTimer = setInterval(sendHeartbeat, 8000);
  }
  function sendHeartbeat(status) {
    if (!sim) return;
    fetch('/api/hsk-sim/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: roomPin, simId: sim.id, studentCode,
        displayName: realName() || undefined,
        cursor: currentNum() || 0, total: totalQ(),
        answered: Object.keys(answers).length,
        section: phase === 'reading' ? 'reading' : 'listening',
        status: status || 'in-progress',
      }),
    }).catch(() => {});
  }
  window.addEventListener('beforeunload', () => {
    if (finished || !sim) return;
    try {
      const blob = new Blob([JSON.stringify({ pin: roomPin, simId: sim.id, studentCode, status: 'left' })], { type: 'application/json' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/hsk-sim/heartbeat', blob);
    } catch (_) {}
  });
  // Global presence + teacher "Llevar a casa" redirect (same as hsk-sim.js)
  setInterval(() => {
    let code = studentCode;
    if (!code) { try { code = localStorage.getItem('dralyStudentCode') || ''; } catch (_) {} }
    if (!code) return;
    fetch('/api/heartbeat?code=' + encodeURIComponent(code), { credentials: 'same-origin' })
      .then((r) => r.json()).then((d) => { if (d && d.redirect) location.href = d.redirect; }).catch(() => {});
  }, 8000);

  // ── Submit + results ───────────────────────────────────────────────
  let result = null;
  function finish(timeUp) {
    if (finished) return;
    finished = true;
    phase = 'done';
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    if (audio) { try { audio.pause(); } catch (_) {} }
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
    try { sessionStorage.removeItem(storeKey()); } catch (_) {}
    try {
      const blob = new Blob([JSON.stringify({ pin: roomPin, simId: sim.id, studentCode, cursor: totalQ(), total: totalQ(), answered: Object.keys(answers).length, section: 'reading', status: 'completed' })], { type: 'application/json' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/hsk-sim/heartbeat', blob);
    } catch (_) {}
    sendHeartbeat('completed');
    $('y-exam').classList.add('hidden');
    $('y-results').classList.remove('hidden');
    $('y-res-title').textContent = sim.title + (timeUp ? ' · ¡Se acabó el tiempo!' : '');
    const q = '?studentCode=' + encodeURIComponent(studentCode) + '&pin=' + encodeURIComponent(roomPin) +
      (roomPass ? '&pass=' + encodeURIComponent(roomPass) : '');
    fetch('/api/hsk-sim/' + encodeURIComponent(sim.id) + '/submit' + q + (debugDirect ? '&debug=1&direct=1' : ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      // ticket: the server's signed «this phone took this sim», so the grade is saved even if the room closed meanwhile
      // 🔑 solo with only the level's key on this phone: the phone's saved class code proves whose grade it is
      body: JSON.stringify({ studentCode, answers, pin: roomPin, displayName: realName() || undefined, ticket: sim.ticket || undefined,
        accessCode: solo ? (function () { try { return localStorage.getItem('dralyHwAccessCode') || undefined; } catch (_) { return undefined; } })() : undefined }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) { $('y-res-saving').textContent = 'No se pudo guardar la nota: ' + ((d && d.error) || ''); return; }
        $('y-res-saving').textContent = d.saved === false
          ? (d.guest ? 'Tu nota no se guardó: entra en Mis Tareas con tu código para que se guarde la próxima vez.' : 'Vista de maestra · la nota no se guarda')
          : '✓ Nota guardada';
        result = d.result;
        renderResults();
      })
      .catch((e) => { $('y-res-saving').textContent = 'Error de red: ' + e.message; });
  }

  function renderResults() {
    const r = result;
    $('y-res-score').textContent = r.score;
    $('y-res-total').textContent = r.total;
    $('y-res-pass').textContent = 'Se aprueba con ' + r.pass;
    const badge = $('y-res-badge');
    badge.className = 'y-res-badge ' + (r.passed ? 'ok' : 'no');
    badge.textContent = r.passed ? 'Aprobado' : 'No aprobado · sigue practicando';
    const fg = $('y-gauge-fg');
    const len = fg.getTotalLength();
    fg.style.strokeDasharray = len;
    fg.style.strokeDashoffset = len;
    fg.style.stroke = r.passed ? 'var(--ok)' : 'var(--seal)';
    requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = len * (1 - r.score / r.total); }));
    let h = '';
    [['listening', '🎧 Escucha'], ['reading', '📖 Lectura']].forEach(([sec, name]) => {
      h += '<div class="y-res-sec"><div class="y-res-sec-head">' + name + '</div>';
      r.parts.filter((p) => p.section === sec).forEach((p) => {
        h += '<div class="y-res-part"><div class="y-res-part-name">Parte ' + p.part + ' · ' + Math.round((p.correct / p.total) * 100) + '% correcto</div><div class="y-res-nums">' +
          p.items.map((i) => '<button class="y-res-num ' + (i.correct ? 'ok' : 'bad') + '" data-q="' + i.qid + '" type="button">' + i.num + '</button>').join('') + '</div></div>';
      });
      h += '</div>';
    });
    $('y-res-parts').innerHTML = h;
    $('y-res-parts').querySelectorAll('.y-res-num').forEach((b) => b.addEventListener('click', () => { tick(); openResultReview(b.getAttribute('data-q')); }));
  }

  let clip = null;
  function findAny(qid) {
    for (const key of ['listening', 'reading']) for (const p of sim[key].parts) for (const it of p.items) if (it.qid === qid) return { part: p, item: it, key };
    return null;
  }
  function openResultReview(qid) {
    const f = findAny(qid);
    if (!f || !result) return;
    const rv = result.review[qid] || {};
    const b = result.breakdown.find((x) => x.qid === qid) || {};
    const choices = f.item.options || f.part.bank || [];
    const word = (v) => { const o = choices.find((x) => x.label === v); return o && o.hanzi ? ' · ' + o.hanzi : ''; };
    const show = (v) => v == null ? '(sin respuesta)' : v === 'T' ? '✓' : v === 'F' ? '✗' : v + word(v);
    let h = itemHtml(f.part, f.item, { readonly: true, mark: { mine: b.given, key: rv.answer } });
    h += '<div class="y-review-ans"><span class="mine ' + (b.correct ? 'ok' : 'bad') + '">Tu respuesta: ' + esc(show(b.given)) + '</span>' +
      (b.correct ? '' : '<span class="key">Correcta: ' + esc(show(rv.answer)) + '</span>') + '</div>';
    if (rv.transcript) {
      const lines = rv.transcript.lines || [{ hanzi: rv.transcript.hanzi, pinyin: rv.transcript.pinyin }];
      h += '<div class="y-review-tx"><div class="y-muted" style="font-weight:800;margin-bottom:4px;">Lo que dijo el audio:</div>' +
        lines.map((l) => '<div class="zh">' + (l.speaker ? '<b>' + esc(l.speaker) + ':</b> ' : '') + esc(l.hanzi) + '</div><div class="y-py">' + esc(l.pinyin) + '</div>').join('') + '</div>';
    }
    if (f.item.t && sim.listening.audio) h += '<button class="y-btn y-btn-jade y-review-play" id="y-review-play" type="button">▶ Escuchar otra vez</button>';
    $('y-review-body').innerHTML = h;
    $('y-review-body').classList.add('y-locked');
    $('y-review').classList.remove('hidden');
    const play = $('y-review-play');
    if (play) play.addEventListener('click', () => playClip(f.item.t));
  }
  function playClip(t) {
    stopClip();
    clip = new Audio(sim.listening.audio);
    clip.muted = muted;
    const go = () => { clip.currentTime = t[0]; clip.play().catch(() => {}); };
    if (clip.readyState >= 1) go(); else clip.addEventListener('loadedmetadata', go, { once: true });
    clip.addEventListener('timeupdate', () => { if (clip && clip.currentTime >= t[1]) stopClip(); });
  }
  function stopClip() { if (clip) { try { clip.pause(); } catch (_) {} clip = null; } }
  $('y-review-x').addEventListener('click', () => { stopClip(); $('y-review').classList.add('hidden'); });
  $('y-review').addEventListener('click', (e) => { if (e.target === $('y-review')) { stopClip(); $('y-review').classList.add('hidden'); } });
  // Test harness (?debug=1): jump the listening audio, read state.
  // ?debug=1&direct=1&sim=…&pin=…&code=… skips the socket wait, and
  // &view=listen&at=SEC | view=review | view=reading&rc=N | view=results
  // opens a given screen (used for layout screenshots).
  if (params.get('debug') === '1' && params.get('direct') === '1') {
    const view = params.get('view');
    started = true;
    $('y-gate').classList.add('hidden');
    const origRestore = restore;
    restore = function () {
      try { sessionStorage.removeItem(storeKey()); } catch (_) {}
      if (!view) return origRestore();
      if (view === 'listen') { startListening(parseFloat(params.get('at') || '0')); return true; }
      if (view === 'review') { phase = 'listening'; startReview(false); return true; }
      if (view === 'reading') { readCursor = parseInt(params.get('rc') || '0', 10); startReading(false); return true; }
      if (view === 'results') {
        // a fixed pick on a few items (some right, some wrong) for the layout shot — never a real key in a public file
        answers = {};
        [sim.listening, sim.reading].forEach((sec) => sec.parts.forEach((p) => p.items.filter((i) => !i.example).slice(0, 2).forEach((i, k) => {
          const opts = (i.options || p.bank || p.gallery || []).map((o) => o.label);
          answers[i.qid] = opts.length ? opts[k % opts.length] : (k ? 'F' : 'T');
        })));
        finish(false); return true;
      }
      return false;
    };
    setTimeout(loadSim, 50);
  }
  if (params.get('debug') === '1') {
    window.yctDebug = {
      seek(t) { if (audio) { audio.currentTime = t; listenStartedAt = Date.now() - t * 1000; save(); } },
      state() { return { phase, segIdx, seg: segs[segIdx] && (segs[segIdx].item ? segs[segIdx].item.id : segs[segIdx].kind), answers, readCursor }; },
      reviewLeft(s) { reviewStartedAt = Date.now() - (sim.listening.review - s) * 1000; },
      readingLeft(s) { readingStartedAt = Date.now() - (sim.reading.timeLimit - s) * 1000; },
    };
  }

  $('y-res-redo').addEventListener('click', () => location.reload());
  $('y-res-home').addEventListener('click', goHome);
})();
