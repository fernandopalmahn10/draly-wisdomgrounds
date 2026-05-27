// 📚 Homework Portal — async assignments, no PIN needed.
// Student enters: access code (one of 5 the teacher hands out) + their
// student code (4 chars, persists in localStorage). All submissions
// auto-graded server-side; results saved to their student record so the
// teacher sees who did what via the existing Cuaderno de Alumnos.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORAGE_CODE_KEY = 'dralyStudentCode';
  const STORAGE_ACCESS_KEY = 'dralyHwAccessCode';

  let accessCode = '';
  let studentCode = '';
  let displayName = '';
  let assignments = [];        // summary list
  let submissions = [];        // student's prior submissions
  let currentAssignment = null;  // full body when an item is open
  let currentAnswers = [];     // string per item — arrays of word IDs joined by space, or freeform

  // ── Pre-fill remembered values
  try {
    const savedAccess = localStorage.getItem(STORAGE_ACCESS_KEY) || '';
    const savedCode = localStorage.getItem(STORAGE_CODE_KEY) || '';
    if (savedAccess) $('hw-access-code').value = savedAccess;
    if (savedCode) $('hw-student-code').value = savedCode;
  } catch (_) {}

  // ── Entry screen
  $('hw-enter-btn').addEventListener('click', tryEnter);
  $('hw-access-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('hw-student-code').focus(); });
  $('hw-student-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryEnter(); });

  function tryEnter() {
    const ac = $('hw-access-code').value.trim().toUpperCase();
    const sc = $('hw-student-code').value.trim();
    if (!ac) { $('hw-entry-err').textContent = 'Ingresa el código de acceso'; return; }
    $('hw-entry-err').textContent = 'Entrando…';
    // The student-code field may be a 4-char code OR a name (first-time
    // joiner). We send it as both — the server's getOrCreate() figures
    // it out: if it matches an existing code, returns that record;
    // otherwise creates a new one with the value as displayName.
    const looksLikeCode = /^[A-Z2-9]{4,5}$/i.test(sc);
    const payload = {
      accessCode: ac,
      studentCode: looksLikeCode ? sc.toUpperCase() : null,
      displayName: looksLikeCode ? null : (sc || 'Anon'),
    };
    fetch('/api/homework/enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          $('hw-entry-err').textContent = data && data.error ? data.error : 'No se pudo entrar';
          return;
        }
        accessCode = ac;
        studentCode = data.studentCode;
        displayName = data.displayName;
        assignments = data.assignments || [];
        submissions = data.submissions || [];
        try {
          localStorage.setItem(STORAGE_ACCESS_KEY, ac);
          localStorage.setItem(STORAGE_CODE_KEY, studentCode);
        } catch (_) {}
        renderList();
        showScreen('list');
      })
      .catch((e) => {
        $('hw-entry-err').textContent = 'Error de conexión: ' + e.message;
      });
  }

  $('hw-list-logout').addEventListener('click', () => {
    accessCode = '';
    studentCode = '';
    showScreen('entry');
  });

  // ── Assignment-list screen
  function renderList() {
    $('hw-list-name').textContent = displayName || 'Anon';
    $('hw-list-code').textContent = studentCode;
    const grid = $('hw-list-grid');
    grid.innerHTML = '';
    assignments.forEach((a) => {
      // Find best (highest) prior score for this assignment
      const myAttempts = submissions.filter((s) => s.assignmentId === a.id);
      const bestScore = myAttempts.length ? Math.max(...myAttempts.map((s) => s.score)) : null;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'hw-card';
      if (bestScore != null) card.classList.add('hw-card-done');
      const statusBadge = bestScore == null
        ? '<span class="hw-card-badge new">Nueva</span>'
        : `<span class="hw-card-badge done">${bestScore}/${a.totalPoints} pts</span>`;
      card.innerHTML = `
        <div class="hw-card-head">
          ${statusBadge}
          <span class="hw-card-points">${a.totalPoints} pts</span>
        </div>
        <div class="hw-card-title">${escapeHtml(a.title)}</div>
        <div class="hw-card-sub">${escapeHtml(a.subtitle)}</div>
        <div class="hw-card-meta">${a.itemCount} oraciones</div>`;
      card.addEventListener('click', () => openAssignment(a.id));
      grid.appendChild(card);
    });
    if (!assignments.length) {
      grid.innerHTML = '<div class="hw-empty">No hay tareas aún. Pregúntale a tu maestra.</div>';
    }
  }

  // ── Assignment screen
  function openAssignment(id) {
    fetch('/api/homework/assignment/' + encodeURIComponent(id) + '?accessCode=' + encodeURIComponent(accessCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          alert('No se pudo abrir: ' + (data && data.error || ''));
          return;
        }
        currentAssignment = data;
        currentAnswers = data.items.map(() => '');
        renderAssignment();
        showScreen('assignment');
      });
  }
  function renderAssignment() {
    $('hw-asg-title').textContent = currentAssignment.title;
    $('hw-asg-sub').textContent = currentAssignment.subtitle;
    $('hw-asg-instructions').textContent = currentAssignment.instructions;
    const itemsWrap = $('hw-asg-items');
    itemsWrap.innerHTML = '';
    currentAssignment.items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'hw-item';
      row.dataset.idx = i;
      row.innerHTML = `
        <div class="hw-item-head">
          <span class="hw-item-num">${i + 1}.</span>
          <span class="hw-item-es">${escapeHtml(it.es)}</span>
        </div>
        <div class="hw-item-stage" id="hw-stage-${i}" data-idx="${i}">
          <span class="hw-stage-empty">Toca palabras del catálogo abajo…</span>
        </div>
        <div class="hw-item-actions">
          <button class="btn btn-ghost btn-sm hw-item-clear" data-idx="${i}" type="button">🧹 Limpiar</button>
        </div>`;
      itemsWrap.appendChild(row);
      // Clicking the stage marks it as the active target for new words
      const stage = row.querySelector('.hw-item-stage');
      stage.addEventListener('click', () => setActiveItem(i));
    });
    // Bind clear buttons
    itemsWrap.querySelectorAll('.hw-item-clear').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const i = +btn.dataset.idx;
        currentAnswers[i] = '';
        renderStage(i);
      });
    });
    renderLibrary();
    setActiveItem(0);
  }
  let activeItemIdx = 0;
  function setActiveItem(i) {
    activeItemIdx = i;
    document.querySelectorAll('.hw-item-stage').forEach((s) => {
      s.classList.toggle('active', +s.dataset.idx === i);
    });
  }
  function renderStage(i) {
    const stage = document.getElementById('hw-stage-' + i);
    if (!stage) return;
    const words = (currentAnswers[i] || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      stage.innerHTML = '<span class="hw-stage-empty">Toca palabras del catálogo abajo…</span>';
      return;
    }
    stage.innerHTML = '';
    words.forEach((w, idx) => {
      const dict = window.lookupWuPinyin ? window.lookupWuPinyin(w) : null;
      const cat = dict && window.WU_CATEGORIES && window.WU_CATEGORIES[dict.cat];
      const color = cat ? cat.color : '#ffe082';
      const chip = document.createElement('span');
      chip.className = 'hw-stage-word';
      chip.style.setProperty('--cat-color', color);
      chip.innerHTML = `<span class="hw-stage-pinyin">${escapeHtml(w)}</span> <span class="hw-stage-x">✕</span>`;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        // Remove this word from the stage
        const arr = (currentAnswers[i] || '').trim().split(/\s+/).filter(Boolean);
        arr.splice(idx, 1);
        currentAnswers[i] = arr.join(' ');
        renderStage(i);
      });
      stage.appendChild(chip);
    });
  }
  function renderLibrary() {
    const wrap = $('hw-asg-library');
    if (!window.WU_WORDS) { wrap.innerHTML = '<em>Cargando catálogo…</em>'; return; }
    wrap.innerHTML = '';
    // Show words grouped lightly by category; just render all 150 as
    // tappable chips. They're searchable visually by pinyin/Spanish.
    window.WU_WORDS.forEach((w) => {
      const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
      const color = cat ? cat.color : '#fff';
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'hw-lib-chip';
      chip.style.setProperty('--cat-color', color);
      chip.innerHTML = `
        <span class="hw-lib-icon">${w.icon || '·'}</span>
        <span class="hw-lib-pinyin">${escapeHtml(w.pinyin)}</span>
        <span class="hw-lib-es">${escapeHtml(w.es)}</span>`;
      chip.addEventListener('click', () => {
        const cur = currentAnswers[activeItemIdx] || '';
        currentAnswers[activeItemIdx] = (cur ? cur + ' ' : '') + w.pinyin;
        renderStage(activeItemIdx);
      });
      wrap.appendChild(chip);
    });
  }
  $('hw-asg-back').addEventListener('click', () => {
    if (confirm('¿Volver sin entregar? Perderás lo que has escrito.')) {
      currentAssignment = null;
      renderList();
      showScreen('list');
    }
  });

  // ── Submit + results
  $('hw-asg-submit').addEventListener('click', () => {
    if (!currentAssignment) return;
    // Confirm if any item is empty
    const emptyCount = currentAnswers.filter((a) => !a.trim()).length;
    if (emptyCount > 0 && !confirm(`Tienes ${emptyCount} oraciones vacías. ¿Entregar de todas formas?`)) return;
    $('hw-asg-submit').disabled = true;
    $('hw-asg-submit').textContent = 'Enviando…';
    fetch('/api/homework/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessCode,
        studentCode,
        assignmentId: currentAssignment.id,
        answers: currentAnswers,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        $('hw-asg-submit').disabled = false;
        $('hw-asg-submit').textContent = '📤 Entregar tarea';
        if (!data || !data.ok) {
          alert('Error al entregar: ' + (data && data.error || ''));
          return;
        }
        showResults(data);
        // Refresh local submission cache so the list shows the new best score
        submissions.push({
          assignmentId: currentAssignment.id,
          score: data.score,
          total: data.total,
        });
      })
      .catch((e) => {
        $('hw-asg-submit').disabled = false;
        $('hw-asg-submit').textContent = '📤 Entregar tarea';
        alert('Error de conexión: ' + e.message);
      });
  });

  function showResults(data) {
    showScreen('results');
    $('hw-results-total').textContent = data.total;
    const pct = (data.score / data.total) * 100;
    const cert = pct >= 95 ? { emoji: '🏅', text: '¡PERFECTO!' }
              : pct >= 80 ? { emoji: '⭐', text: '¡Excelente!' }
              : pct >= 60 ? { emoji: '👍', text: '¡Bien hecho!' }
              : pct >= 40 ? { emoji: '📚', text: 'Sigue practicando' }
              :              { emoji: '💪', text: '¡A repasar!' };
    $('hw-results-emoji').textContent = cert.emoji;
    $('hw-results-cert').textContent = cert.text;
    // Animate score counting up
    const numEl = $('hw-results-num');
    let cur = 0;
    const step = Math.max(1, Math.round(data.score / 30));
    const tick = () => {
      cur += step;
      if (cur >= data.score) { cur = data.score; numEl.textContent = cur; return; }
      numEl.textContent = cur;
      setTimeout(tick, 30);
    };
    numEl.textContent = '0';
    setTimeout(tick, 250);
    // Per-item breakdown
    const bk = $('hw-results-breakdown');
    bk.innerHTML = '';
    (data.breakdown || []).forEach((b) => {
      const row = document.createElement('div');
      row.className = 'hw-results-bk-row ' + (b.correct ? 'ok' : 'no');
      const verdict = b.correct ? '✓' : '✕';
      row.innerHTML = `
        <span class="hw-bk-verdict">${verdict}</span>
        <div class="hw-bk-content">
          <div class="hw-bk-es">${escapeHtml(b.es)}</div>
          <div class="hw-bk-line"><span class="hw-bk-label">Tu respuesta:</span> <span class="hw-bk-student">${escapeHtml(b.student || '—')}</span></div>
          ${b.correct ? '' : `<div class="hw-bk-line"><span class="hw-bk-label">Respuesta:</span> <span class="hw-bk-expected">${escapeHtml(b.expected)}</span></div>`}
        </div>
        <span class="hw-bk-points">+${b.pointsEarned}</span>`;
      bk.appendChild(row);
    });
  }
  $('hw-results-done').addEventListener('click', () => {
    renderList();
    showScreen('list');
  });
  $('hw-results-retry').addEventListener('click', () => {
    if (!currentAssignment) { showScreen('list'); return; }
    currentAnswers = currentAssignment.items.map(() => '');
    renderAssignment();
    showScreen('assignment');
  });

  function showScreen(name) {
    ['entry', 'list', 'assignment', 'results'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
