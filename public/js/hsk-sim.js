// =========================================================================
// hsk-sim.js — Student-side HSK simulation runner
// =========================================================================
// Walks the kid through all parts sequentially. Each question is rendered
// fresh into #hsk-question-wrap. Audio is played via /api/tts using the
// existing Google Cloud Mandarin voice. Answers are accumulated locally
// in `answers` and submitted at the end for grading.
// =========================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── 🔊 Touch feedback ─────────────────────────────────────────────
  // Tiny synthesized click — no asset needed — plus haptic vibrate
  // on Android/iOS where supported. Wired into every selection tap.
  let _audioCtx = null;
  function getAudioCtx() {
    if (_audioCtx) return _audioCtx;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      _audioCtx = new Ctor();
    } catch (_) { _audioCtx = null; }
    return _audioCtx;
  }
  function clickFeedback() {
    // Haptic
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (_) {}
    // Tiny audible tick
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      o.start();
      o.stop(ctx.currentTime + 0.09);
    } catch (_) {}
  }
  // Delegate every click on a tappable hsk-* surface through the
  // feedback function — works for buttons rendered after this hook.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.hsk-tf-pick, .hsk-3pic, .hsk-3opt, .hsk-gallery-tile, .hsk-audio-btn, .btn');
    if (t) clickFeedback();
  }, true);

  let accessCode = '';
  let studentCode = '';
  let sim = null;          // full simulation payload
  let timeline = [];       // flat array of question descriptors in order
  let cursor = 0;          // index into timeline
  const answers = {};      // qid → user's pick (boolean or letter)
  let _ttsAudio = null;    // current playing audio
  let _heartbeatTimer = null;  // periodic ping to /api/hsk-sim/heartbeat

  // Read URL params. NEW preferred convention: ?pin=1234 → look up the
  // sim from the server. Back-compat: ?sim= still works as a fallback,
  // and ?access=/?code= still pre-fills the legacy fields. The homework
  // portal force-redirect now passes ?pin=&code=.
  const params = new URLSearchParams(location.search);
  let simId   = params.get('sim') || '';
  let roomPin = params.get('pin') || '';
  const urlAc = params.get('access') || params.get('ac');
  const urlSc = params.get('code')   || params.get('sc');
  if (urlAc) $('hsk-access').value = urlAc;
  if (urlSc) $('hsk-code').value = urlSc;
  if (roomPin) $('hsk-access').value = roomPin;   // PIN goes into the "code de aula" field

  $('hsk-enter').addEventListener('click', tryEnter);
  ['hsk-access', 'hsk-code'].forEach((id) => {
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') tryEnter(); });
  });

  // Auto-resolve PIN at page load. If ?pin= was provided, look it up
  // server-side to learn the simId. We DON'T pre-flash a success
  // message — the user said "you're leaving a link visible. I don't
  // like that." So the UI just quietly resolves the sim in the
  // background. If the PIN is invalid, the gate err shows a clean,
  // friendly message that tells the kid what to do next.
  if (roomPin) {
    fetch('/api/hsk-sim/room/' + encodeURIComponent(roomPin))
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) {
          simId = d.simId;
        } else {
          $('hsk-gate-err').textContent = 'Este PIN no está activo. Pídele a tu maestra que abra una sala nueva.';
        }
      })
      .catch(() => {});
  }

  // Auto-submit when we have enough: (pin + code) OR (access + code).
  if ((roomPin || urlAc) && urlSc) {
    setTimeout(tryEnter, 80);
  }

  // Socket-based join. Mirrors the lecture player join flow: kid emits
  // player:join with the PIN; server validates against games[pin]; if
  // valid, kid joins the socket room. Then we listen for 'state' — if
  // state==='active' we start the test runner; otherwise we show the
  // waiting screen until the teacher hits Empezar examen.
  let _hskSocket = null;
  let _hskTestStarted = false;

  function tryEnter() {
    accessCode  = $('hsk-access').value.trim();
    studentCode = $('hsk-code').value.trim();
    if (/^\d{3,4}$/.test(accessCode)) roomPin = accessCode;
    if (!accessCode || !studentCode) {
      $('hsk-gate-err').textContent = 'Falta el PIN y tu código de estudiante.';
      return;
    }
    if (!roomPin) {
      $('hsk-gate-err').textContent = 'Tu PIN debe ser de 3 o 4 dígitos.';
      return;
    }
    $('hsk-gate-err').textContent = 'Entrando a la sala…';

    // Connect socket and join the room. The server's player:join
    // validates the PIN against the real games[pin] table — same
    // reliability as every other PIN-join in the platform.
    _hskSocket = io();
    // 🔥 NAME REUSE: if the kid was just on /player.html and got
    // redirected here, they already have a player slot in g.players
    // under whatever name player.html used. We MUST join with the
    // SAME name so the server's case-insensitive name-match treats
    // it as a rejoin — otherwise the kid appears as TWO players in
    // the host roster (root cause of "they disappear when I start").
    let displayName = studentCode;
    try {
      const last = JSON.parse(localStorage.getItem('dralyLastJoin') || '{}');
      if (last && last.name) displayName = last.name;
    } catch (_) {}
    _hskSocket.emit('player:join', {
      pin: roomPin,
      name: displayName,
      avatar: '',
      studentCode,
    }, (resp) => {
      if (!resp || !resp.ok) {
        $('hsk-gate-err').textContent = (resp && resp.error) || 'PIN no válido. Pregúntale a tu maestra.';
        try { _hskSocket.disconnect(); } catch (_) {}
        _hskSocket = null;
        return;
      }
      // Successfully joined the socket room — show waiting screen and
      // wait for state===active. The 'state' listener below handles
      // the transition.
      $('hsk-gate').classList.add('hidden');
      $('hsk-waiting').classList.remove('hidden');
      $('hsk-waiting-pin').textContent = 'PIN: ' + roomPin;
    });

    _hskSocket.on('state', (s) => {
      if (!s) return;
      // Pull simId from the broadcast — authoritative source.
      if (s.hsk && s.hsk.simId && !simId) simId = s.hsk.simId;
      // Fx broadcast — apply across the test runner
      if (s.hsk && s.hsk.fx) applyFx(s.hsk.fx);
      else applyFx(null);
      // Transition into the runner when the teacher hits Empezar
      if ((s.state === 'active' || s.state === 'countdown') && !_hskTestStarted) {
        _hskTestStarted = true;
        $('hsk-waiting').classList.add('hidden');
        loadSim();
      }
    });

    _hskSocket.on('disconnect', () => {
      // Brief notice — the kid stays on whatever screen they were on.
      // Heartbeat HTTP will fail silently; the room will reconnect on
      // resume (browser auto-reconnects socket.io).
    });
  }

  function loadSim() {
    // Auth: prefer PIN, fall back to access code.
    let q = '?studentCode=' + encodeURIComponent(studentCode);
    if (roomPin)        q += '&pin=' + encodeURIComponent(roomPin);
    else if (accessCode) q += '&accessCode=' + encodeURIComponent(accessCode);
    fetch('/api/hsk-sim/' + encodeURIComponent(simId) + q)
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) {
          $('hsk-gate-err').textContent = 'No se pudo cargar: ' + (d && d.error || '');
          return;
        }
        sim = d.sim;
        buildTimeline();
        $('hsk-title').textContent = sim.title;
        $('hsk-gate').classList.add('hidden');
        $('hsk-runner').classList.remove('hidden');
        renderCurrent();
        startHeartbeat();
      })
      .catch((e) => { $('hsk-gate-err').textContent = 'Red: ' + e.message; });
  }

  // Flatten the simulation into a single ordered timeline. Each entry
  // tells renderCurrent() what to draw. Section headers + example slides
  // are interleaved so the kid sees them at the right moment.
  function buildTimeline() {
    timeline = [];
    // ── Listening Part 1
    timeline.push({ kind: 'section', title: sim.listening.part1.title, instruction: sim.listening.part1.instruction });
    sim.listening.part1.examples.forEach((ex) => timeline.push({ kind: 'L1-ex', part: 1, q: ex }));
    sim.listening.part1.questions.forEach((q) => timeline.push({ kind: 'L1', part: 1, q }));
    // ── Listening Part 2
    timeline.push({ kind: 'section', title: sim.listening.part2.title, instruction: sim.listening.part2.instruction });
    sim.listening.part2.questions.forEach((q) => timeline.push({ kind: 'L2', part: 2, q }));
    // ── Listening Part 3 (one shared gallery shown each turn)
    timeline.push({ kind: 'section', title: sim.listening.part3.title, instruction: sim.listening.part3.instruction });
    sim.listening.part3.questions.forEach((q) => timeline.push({
      kind: 'L3', part: 3, q,
      gallery: sim.listening.part3.gallery,
      exampleAnswer: sim.listening.part3.exampleAnswer,
    }));
    // ── Listening Part 4
    timeline.push({ kind: 'section', title: sim.listening.part4.title, instruction: sim.listening.part4.instruction });
    timeline.push({ kind: 'L4-ex', part: 4, q: sim.listening.part4.example });
    sim.listening.part4.questions.forEach((q) => timeline.push({ kind: 'L4', part: 4, q }));
    // ── Reading Part 1
    timeline.push({ kind: 'section', title: sim.reading.part1.title, instruction: sim.reading.part1.instruction });
    timeline.push({ kind: 'R1-ex', q: sim.reading.part1.example });
    sim.reading.part1.questions.forEach((q) => timeline.push({ kind: 'R1', q }));
    // ── Reading Part 2 (one shared gallery shown each turn)
    timeline.push({ kind: 'section', title: sim.reading.part2.title, instruction: sim.reading.part2.instruction });
    timeline.push({ kind: 'R2-ex', q: sim.reading.part2.example, gallery: sim.reading.part2.gallery });
    sim.reading.part2.questions.forEach((q) => timeline.push({
      kind: 'R2', q,
      gallery: sim.reading.part2.gallery,
    }));
  }

  function renderCurrent() {
    stopAudio();
    const step = timeline[cursor];
    if (!step) { finishTest(); return; }
    const wrap = $('hsk-question-wrap');
    wrap.innerHTML = '';

    // Section header — just a big card the kid taps "Continuar" on.
    if (step.kind === 'section') {
      wrap.innerHTML = `
        <div class="hsk-section-intro">
          <div class="hsk-section-intro-title">${escapeHtml(step.title)}</div>
          <div class="hsk-section-intro-instr">${escapeHtml(step.instruction)}</div>
          <button class="btn btn-jade btn-xl" id="hsk-section-go" type="button">Empezar esta parte →</button>
        </div>`;
      $('hsk-section-go').addEventListener('click', () => { cursor++; renderCurrent(); });
      updateProgress();
      return;
    }

    // Dispatch to the right renderer for each question kind.
    if (step.kind === 'L1-ex' || step.kind === 'L1') renderListening1(step);
    else if (step.kind === 'L2') renderListening2(step);
    else if (step.kind === 'L3') renderListening3(step);
    else if (step.kind === 'L4-ex' || step.kind === 'L4') renderListening4(step);
    else if (step.kind === 'R1-ex' || step.kind === 'R1') renderReading1(step);
    else if (step.kind === 'R2-ex' || step.kind === 'R2') renderReading2(step);

    updateProgress();
  }

  function updateProgress() {
    const total = sim ? sim.totalQuestions : 30;
    const answered = Object.keys(answers).length;
    $('hsk-progress').textContent = answered + '/' + total + ' contestadas';
    const step = timeline[cursor];
    $('hsk-section-name').textContent = sectionForStep(step);
    // Enable Next only when answered (or example/section).
    const isAnswerable = step && !/^(section|.*-ex)$/.test(step.kind);
    const next = $('hsk-next');
    if (next) {
      const qid = isAnswerable ? qidFor(step) : null;
      next.disabled = isAnswerable && (answers[qid] === undefined);
      next.textContent = cursor >= timeline.length - 1 ? 'Terminar y entregar ✓' : 'Siguiente →';
    }
  }

  function qidFor(step) {
    const kind = step.kind;
    const num = step.q && step.q.num;
    if (kind === 'L1') return 'L1-' + num;
    if (kind === 'L2') return 'L2-' + num;
    if (kind === 'L3') return 'L3-' + num;
    if (kind === 'L4') return 'L4-' + num;
    if (kind === 'R1') return 'R1-' + num;
    if (kind === 'R2') return 'R2-' + num;
    return null;
  }

  function sectionForStep(step) {
    if (!step) return '';
    if (step.kind === 'section') return step.title;
    if (/^L1/.test(step.kind)) return 'Escuchar · Parte 1';
    if (/^L2/.test(step.kind)) return 'Escuchar · Parte 2';
    if (/^L3/.test(step.kind)) return 'Escuchar · Parte 3';
    if (/^L4/.test(step.kind)) return 'Escuchar · Parte 4';
    if (/^R1/.test(step.kind)) return 'Lectura · Parte 1';
    if (/^R2/.test(step.kind)) return 'Lectura · Parte 2';
    return '';
  }

  // ── Renderers per part ──────────────────────────────────────────────

  function renderListening1(step) {
    const isEx = step.kind === 'L1-ex';
    const q = step.q;
    const wrap = $('hsk-question-wrap');
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">${isEx ? 'Ejemplo' : 'Pregunta ' + q.num}</div>
        <img class="hsk-q-image" src="${q.image}" alt="" loading="lazy">
        ${audioButton(q)}
        ${isEx
          ? `<div class="hsk-tf-row hsk-tf-row-locked">
               ${q.answer === true  ? '<span class="hsk-tf-pick hsk-tf-pick-true   is-correct">✓</span>' : '<span class="hsk-tf-pick hsk-tf-pick-true   is-dim">✓</span>'}
               ${q.answer === false ? '<span class="hsk-tf-pick hsk-tf-pick-false  is-correct">✕</span>' : '<span class="hsk-tf-pick hsk-tf-pick-false  is-dim">✕</span>'}
             </div>
             <div class="hsk-ex-caption">${escapeHtml(q.caption || '')}</div>`
          : `<div class="hsk-tf-row">
               <button class="hsk-tf-pick hsk-tf-pick-true"  type="button" data-pick="true">✓ Verdadero</button>
               <button class="hsk-tf-pick hsk-tf-pick-false" type="button" data-pick="false">✕ Falso</button>
             </div>`}
      </div>`;
    if (!isEx) {
      const qid = 'L1-' + q.num;
      wrap.querySelectorAll('.hsk-tf-pick').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pick = btn.dataset.pick === 'true';
          answers[qid] = pick;
          wrap.querySelectorAll('.hsk-tf-pick').forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          updateProgress();
        });
        if (answers[qid] === (btn.dataset.pick === 'true')) btn.classList.add('is-selected');
      });
    }
    autoPlayAudio(q);
  }

  function renderListening2(step) {
    const q = step.q;
    const wrap = $('hsk-question-wrap');
    const qid = 'L2-' + q.num;
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">Pregunta ${q.num}</div>
        ${audioButton(q)}
        <div class="hsk-3pic-row">
          ${q.options.map((o) => `
            <button class="hsk-3pic" type="button" data-pick="${o.letter}">
              <img src="${o.image}" alt="${o.letter}" loading="lazy">
              <span class="hsk-3pic-letter">${o.letter}</span>
            </button>`).join('')}
        </div>
      </div>`;
    wrap.querySelectorAll('.hsk-3pic').forEach((btn) => {
      btn.addEventListener('click', () => {
        answers[qid] = btn.dataset.pick;
        wrap.querySelectorAll('.hsk-3pic').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        updateProgress();
      });
      if (answers[qid] === btn.dataset.pick) btn.classList.add('is-selected');
    });
    autoPlayAudio(q);
  }

  function renderListening3(step) {
    const q = step.q;
    const qid = 'L3-' + q.num;
    const wrap = $('hsk-question-wrap');
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">Pregunta ${q.num} — Toca la letra de la imagen que coincide</div>
        ${audioButton(q)}
        <div class="hsk-gallery">
          ${step.gallery.map((g) => `
            <button class="hsk-gallery-tile" type="button" data-pick="${g.letter}">
              <img src="${g.image}" alt="${g.letter}" loading="lazy">
              <span class="hsk-gallery-letter">${g.label}</span>
            </button>`).join('')}
        </div>
      </div>`;
    wrap.querySelectorAll('.hsk-gallery-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        answers[qid] = btn.dataset.pick;
        wrap.querySelectorAll('.hsk-gallery-tile').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        updateProgress();
      });
      if (answers[qid] === btn.dataset.pick) btn.classList.add('is-selected');
    });
    autoPlayAudio(q);
  }

  function renderListening4(step) {
    const isEx = step.kind === 'L4-ex';
    const q = step.q;
    const wrap = $('hsk-question-wrap');
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">${isEx ? 'Ejemplo' : 'Pregunta ' + q.num}</div>
        ${audioButton(q)}
        <div class="hsk-3opt-row">
          ${(q.options || []).map((o) => `
            <button class="hsk-3opt ${isEx && q.answer === o.letter ? 'is-correct is-locked' : ''}" type="button" data-pick="${o.letter}">
              <span class="hsk-3opt-letter">${o.letter}</span>
              <span class="hsk-3opt-text">${escapeHtml(o.text || '(pendiente)')}</span>
            </button>`).join('')}
        </div>
      </div>`;
    if (!isEx) {
      const qid = 'L4-' + q.num;
      wrap.querySelectorAll('.hsk-3opt').forEach((btn) => {
        btn.addEventListener('click', () => {
          answers[qid] = btn.dataset.pick;
          wrap.querySelectorAll('.hsk-3opt').forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          updateProgress();
        });
        if (answers[qid] === btn.dataset.pick) btn.classList.add('is-selected');
      });
    }
    autoPlayAudio(q);
  }

  function renderReading1(step) {
    const isEx = step.kind === 'R1-ex';
    const q = step.q;
    const wrap = $('hsk-question-wrap');
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">${isEx ? 'Ejemplo' : 'Pregunta ' + q.num}</div>
        <img class="hsk-q-image" src="${q.image}" alt="" loading="lazy">
        <div class="hsk-r1-word">${escapeHtml(q.word)}</div>
        ${isEx
          ? `<div class="hsk-tf-row hsk-tf-row-locked">
               ${q.answer === true  ? '<span class="hsk-tf-pick hsk-tf-pick-true   is-correct">✓</span>' : '<span class="hsk-tf-pick hsk-tf-pick-true   is-dim">✓</span>'}
               ${q.answer === false ? '<span class="hsk-tf-pick hsk-tf-pick-false  is-correct">✕</span>' : '<span class="hsk-tf-pick hsk-tf-pick-false  is-dim">✕</span>'}
             </div>`
          : `<div class="hsk-tf-row">
               <button class="hsk-tf-pick hsk-tf-pick-true"  type="button" data-pick="true">✓ Verdadero</button>
               <button class="hsk-tf-pick hsk-tf-pick-false" type="button" data-pick="false">✕ Falso</button>
             </div>`}
      </div>`;
    if (!isEx) {
      const qid = 'R1-' + q.num;
      wrap.querySelectorAll('.hsk-tf-pick').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pick = btn.dataset.pick === 'true';
          answers[qid] = pick;
          wrap.querySelectorAll('.hsk-tf-pick').forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          updateProgress();
        });
        if (answers[qid] === (btn.dataset.pick === 'true')) btn.classList.add('is-selected');
      });
    }
  }

  function renderReading2(step) {
    const isEx = step.kind === 'R2-ex';
    const q = step.q;
    const wrap = $('hsk-question-wrap');
    const qid = !isEx ? 'R2-' + q.num : null;
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">${isEx ? 'Ejemplo' : 'Pregunta ' + q.num} — Empareja con la imagen</div>
        <div class="hsk-r2-sentence">
          <div class="hsk-r2-hanzi">${escapeHtml(q.hanzi || '')}</div>
          <div class="hsk-r2-pinyin">${escapeHtml(q.pinyin || '')}</div>
        </div>
        <div class="hsk-gallery">
          ${step.gallery.map((g) => `
            <button class="hsk-gallery-tile ${isEx && q.answer === g.letter ? 'is-correct is-locked' : ''}" type="button" data-pick="${g.letter}">
              <img src="${g.image}" alt="${g.letter}" loading="lazy">
              <span class="hsk-gallery-letter">${g.label}</span>
            </button>`).join('')}
        </div>
      </div>`;
    if (!isEx) {
      wrap.querySelectorAll('.hsk-gallery-tile').forEach((btn) => {
        btn.addEventListener('click', () => {
          answers[qid] = btn.dataset.pick;
          wrap.querySelectorAll('.hsk-gallery-tile').forEach((b) => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          updateProgress();
        });
        if (answers[qid] === btn.dataset.pick) btn.classList.add('is-selected');
      });
    }
  }

  // ── Audio: prefers a user-uploaded MP3 (q.audioUrl) over Google
  // Cloud TTS (q.audioText) so the kid hears the teacher's own clear
  // pronunciation when available. Falls back gracefully when neither
  // is set.
  function audioButton(q) {
    // Back-compat: callers may pass a raw audioText string.
    if (typeof q === 'string') q = { audioText: q };
    if (!q || (!q.audioUrl && !q.audioText)) {
      return '<div class="hsk-audio-missing">(audio aún no disponible)</div>';
    }
    return '<button class="hsk-audio-btn" type="button" id="hsk-play-audio">🔊 Escuchar (toca para repetir)</button>';
  }
  function autoPlayAudio(q) {
    if (typeof q === 'string') q = { audioText: q };
    if (!q || (!q.audioUrl && !q.audioText)) return;
    const btn = $('hsk-play-audio');
    if (btn) btn.addEventListener('click', () => playAudio(q));
    setTimeout(() => playAudio(q), 300);   // auto-play on render
  }
  function stopAudio() {
    if (_ttsAudio) {
      try { _ttsAudio.pause(); _ttsAudio.removeAttribute('src'); _ttsAudio.load(); } catch (_) {}
      _ttsAudio = null;
    }
  }
  function playAudio(q) {
    if (!q) return;
    stopAudio();
    const audio = new Audio();
    _ttsAudio = audio;
    // MP3 wins. /api/tts is the fallback.
    audio.src = q.audioUrl
      ? q.audioUrl
      : '/api/tts?text=' + encodeURIComponent(q.audioText || '');
    audio.play().catch(() => {});
  }

  // ── Navigation ──────────────────────────────────────────────────────
  $('hsk-next').addEventListener('click', () => {
    if (cursor >= timeline.length - 1) { finishTest(); return; }
    cursor++; renderCurrent();
  });
  $('hsk-prev').addEventListener('click', () => {
    if (cursor <= 0) return;
    cursor--; renderCurrent();
  });

  // Heartbeat — teacher's live monitor polls /api/hsk-sim/sessions to
  // see who's currently inside the exam, which question they're on,
  // and how many they've answered. Aborted = stale heartbeat > 30s.
  function startHeartbeat() {
    sendHeartbeat();
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    _heartbeatTimer = setInterval(sendHeartbeat, 8000);
  }
  function sendHeartbeat(status) {
    if (!sim) return;
    const step = timeline[cursor] || {};
    // 🪪 IMPORTANT: send the kid's REAL displayName from the
    // /player.html step (stored in dralyLastJoin.name). Without this
    // the server fell back to using the typed studentCode as the
    // displayName, which is what the user saw as "I only see codes,
    // not names" — root cause of this bug.
    let realName = '';
    try {
      const last = JSON.parse(localStorage.getItem('dralyLastJoin') || '{}');
      if (last && last.name) realName = String(last.name);
    } catch (_) {}
    fetch('/api/hsk-sim/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: roomPin || undefined,
        simId: sim.id,
        accessCode, studentCode,
        displayName: realName || undefined,
        cursor, total: timeline.length,
        answered: Object.keys(answers).length,
        section: sectionForStep(step),
        status: status || 'in-progress',
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        // Server returns the current room-wide animation overlay (or
        // null). Apply it client-side so the teacher's Animaciones
        // panel propagates to every kid in the PIN room.
        if (d && d.ok) applyFx(d.fx);
      })
      .catch(() => {});
  }

  // ── 🎬 Animation overlay (teacher-broadcast via PIN room) ─────────
  const FX_URL = {
    gojo:   '/assets/png-library/GOJO%20TRANSPARENT.gif',
    yugi:   '/assets/png-library/YUGI%20TRANSPARENT.gif',
    freddy: '/assets/png-library/FREDDY%20TRANSPARENT.gif',
    mario:  '/assets/png-library/MARIO%20TRANSPARENT.gif',
    sonic:  '/assets/png-library/SONIC%20TRANSPARENT.gif',
    turtle: '/assets/png-library/Squirtle%20animation.gif',
  };
  let _curFxId = null;
  function applyFx(fx) {
    const wantId = fx && fx.id;
    if (wantId === _curFxId) return;
    _curFxId = wantId || null;
    const old = document.getElementById('hsk-fx-overlay');
    if (old) old.remove();
    if (!wantId || !FX_URL[wantId]) return;
    const ov = document.createElement('div');
    ov.id = 'hsk-fx-overlay';
    ov.className = 'hsk-fx-overlay';
    ov.innerHTML = '<img src="' + FX_URL[wantId] + '" alt="">';
    document.body.appendChild(ov);
  }
  // Send a "bye" beat on page unload so the dashboard immediately
  // shows the student as gone instead of waiting for the stale window.
  // CRITICAL: skip this if the kid already submitted — otherwise the
  // 'left' status overwrites 'completed' on the host monitor (root
  // cause of "I finished but it didn't mark me as terminated").
  let _hasFinished = false;
  window.addEventListener('beforeunload', () => {
    if (_hasFinished) return;     // don't downgrade completed → left
    try {
      const blob = new Blob([JSON.stringify({
        pin: roomPin || undefined,
        simId: sim && sim.id, accessCode, studentCode, status: 'left',
      })], { type: 'application/json' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/hsk-sim/heartbeat', blob);
    } catch (_) {}
  });

  function finishTest() {
    stopAudio();
    _hasFinished = true;            // suppress the 'left' beacon below
    if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
    // 🏅 BELT + SUSPENDERS for "I finished but the dashboard didn't
    // mark me as terminated". Three signals fire so at LEAST one
    // reaches the server before the kid closes the tab:
    //   1) sendBeacon — survives page unload, no async race
    //   2) fetch heartbeat — normal path, logs progress for monitor
    //   3) submit endpoint — persists rec.hskResults (authoritative)
    try {
      if (navigator.sendBeacon) {
        const step = timeline[cursor] || {};
        const blob = new Blob([JSON.stringify({
          pin: roomPin || undefined,
          simId: sim && sim.id,
          accessCode, studentCode,
          cursor, total: timeline.length,
          answered: Object.keys(answers).length,
          section: sectionForStep(step),
          status: 'completed',
        })], { type: 'application/json' });
        navigator.sendBeacon('/api/hsk-sim/heartbeat', blob);
      }
    } catch (_) {}
    sendHeartbeat('completed');
    $('hsk-runner').classList.add('hidden');
    $('hsk-results').classList.remove('hidden');
    // Submit (auth: PIN preferred, accessCode legacy)
    let sq = '?studentCode=' + encodeURIComponent(studentCode);
    if (roomPin)         sq += '&pin=' + encodeURIComponent(roomPin);
    else if (accessCode)  sq += '&accessCode=' + encodeURIComponent(accessCode);
    let realName2 = '';
    try {
      const last = JSON.parse(localStorage.getItem('dralyLastJoin') || '{}');
      if (last && last.name) realName2 = String(last.name);
    } catch (_) {}
    fetch('/api/hsk-sim/' + encodeURIComponent(sim.id) + '/submit' + sq, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentCode, answers,
        pin: roomPin || undefined,
        displayName: realName2 || undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) {
          $('hsk-results-title').textContent = 'No se pudo guardar la nota';
          return;
        }
        const r = d.result;
        $('hsk-results-percent').textContent = r.percent + '%';
        $('hsk-results-detail').textContent = r.score + ' / ' + r.total + ' pts';
        const emoji = r.percent >= 90 ? '🏆' : r.percent >= 75 ? '⭐' : r.percent >= 50 ? '👍' : '📚';
        $('hsk-results-emoji').textContent = emoji;
        const bk = $('hsk-results-breakdown');
        bk.innerHTML = '<div class="hsk-bk-head">Detalle por pregunta:</div>';
        r.breakdown.forEach((b) => {
          const row = document.createElement('div');
          row.className = 'hsk-bk-row ' + (b.correct ? 'ok' : 'bad');
          row.textContent = b.qid + ': ' + (b.correct ? '✓ Correcto' : '✕ Incorrecto');
          bk.appendChild(row);
        });
      });
  }
  $('hsk-results-done').addEventListener('click', () => {
    window.location.href = '/homework.html';
  });
})();
