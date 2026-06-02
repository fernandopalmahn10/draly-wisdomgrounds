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

  let accessCode = '';
  let studentCode = '';
  let sim = null;          // full simulation payload
  let timeline = [];       // flat array of question descriptors in order
  let cursor = 0;          // index into timeline
  const answers = {};      // qid → user's pick (boolean or letter)
  let _ttsAudio = null;    // current playing audio

  // Pre-fill from URL: ?sim=hsk1-sim1&ac=ABCD&sc=XYZ
  const params = new URLSearchParams(location.search);
  const simId = params.get('sim') || 'hsk1-sim1';
  const urlAc = params.get('ac');
  const urlSc = params.get('sc');
  if (urlAc) $('hsk-access').value = urlAc;
  if (urlSc) $('hsk-code').value = urlSc;

  $('hsk-enter').addEventListener('click', tryEnter);
  ['hsk-access', 'hsk-code'].forEach((id) => {
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') tryEnter(); });
  });

  function tryEnter() {
    accessCode  = $('hsk-access').value.trim();
    studentCode = $('hsk-code').value.trim();
    if (!accessCode || !studentCode) {
      $('hsk-gate-err').textContent = 'Falta el código de aula o de estudiante.';
      return;
    }
    $('hsk-gate-err').textContent = 'Cargando…';
    loadSim();
  }

  function loadSim() {
    fetch('/api/hsk-sim/' + encodeURIComponent(simId)
      + '?accessCode=' + encodeURIComponent(accessCode)
      + '&studentCode=' + encodeURIComponent(studentCode))
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
        ${audioButton(q.audioText)}
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
    autoPlayAudio(q.audioText);
  }

  function renderListening2(step) {
    const q = step.q;
    const wrap = $('hsk-question-wrap');
    const qid = 'L2-' + q.num;
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">Pregunta ${q.num}</div>
        ${audioButton(q.audioText)}
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
    autoPlayAudio(q.audioText);
  }

  function renderListening3(step) {
    const q = step.q;
    const qid = 'L3-' + q.num;
    const wrap = $('hsk-question-wrap');
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">Pregunta ${q.num} — Toca la letra de la imagen que coincide</div>
        ${audioButton(q.audioText)}
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
    autoPlayAudio(q.audioText);
  }

  function renderListening4(step) {
    const isEx = step.kind === 'L4-ex';
    const q = step.q;
    const wrap = $('hsk-question-wrap');
    wrap.innerHTML = `
      <div class="hsk-q-card">
        <div class="hsk-q-num">${isEx ? 'Ejemplo' : 'Pregunta ' + q.num}</div>
        ${audioButton(q.audioText)}
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
    autoPlayAudio(q.audioText);
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

  // ── Audio: Google Cloud Mandarin TTS via /api/tts (same endpoint the
  // homework / warmup pages use, with built-in caching by content hash).
  function audioButton(text) {
    if (!text) return '<div class="hsk-audio-missing">(audio aún no transcrito)</div>';
    return '<button class="hsk-audio-btn" type="button" id="hsk-play-audio">🔊 Escuchar (toca para repetir)</button>';
  }
  function autoPlayAudio(text) {
    const btn = $('hsk-play-audio');
    if (btn) btn.addEventListener('click', () => playTts(text));
    if (text) setTimeout(() => playTts(text), 300);  // first auto-play
  }
  function stopAudio() {
    if (_ttsAudio) {
      try { _ttsAudio.pause(); _ttsAudio.removeAttribute('src'); _ttsAudio.load(); } catch (_) {}
      _ttsAudio = null;
    }
  }
  function playTts(text) {
    if (!text) return;
    stopAudio();
    const audio = new Audio();
    _ttsAudio = audio;
    audio.src = '/api/tts?text=' + encodeURIComponent(text);
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

  function finishTest() {
    stopAudio();
    $('hsk-runner').classList.add('hidden');
    $('hsk-results').classList.remove('hidden');
    // Submit
    fetch('/api/hsk-sim/' + encodeURIComponent(sim.id) + '/submit'
      + '?accessCode=' + encodeURIComponent(accessCode)
      + '&studentCode=' + encodeURIComponent(studentCode), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCode, answers }),
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
