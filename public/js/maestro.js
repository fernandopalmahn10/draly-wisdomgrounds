// =========================================================================
// maestro.js — Standalone teacher Cuaderno (no session needed)
//
// Per user feedback 2026-05-27: "Give me a teacher password (EMAAR2026)
// so I can see the cuaderno without having to host a game and have a
// device randomly join."
//
// Same UX shape as the in-game Cuaderno on host-warmup, but lives on
// its own page so the teacher can pop it open anywhere. Uses the
// existing /api/admin/students endpoints (which now accept either the
// warmup password or the teacher password).
// =========================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const STORAGE_PW = 'dralyMaestroPw';

  let pw = '';
  try { pw = localStorage.getItem(STORAGE_PW) || ''; } catch (_) {}

  // ── Login
  if (pw) $('m-pw').value = pw;
  $('m-enter-btn').addEventListener('click', tryEnter);
  $('m-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryEnter(); });

  function tryEnter() {
    const v = $('m-pw').value.trim();
    if (!v) { $('m-login-err').textContent = 'Escribe la contraseña'; return; }
    $('m-login-err').textContent = 'Entrando…';
    // Validate by hitting the roster endpoint
    fetch('/api/admin/students?pw=' + encodeURIComponent(v))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          $('m-login-err').textContent = 'Contraseña incorrecta';
          return;
        }
        pw = v;
        try { localStorage.setItem(STORAGE_PW, pw); } catch (_) {}
        $('m-login').classList.add('hidden');
        $('m-dash').classList.remove('hidden');
        renderRoster(data.students || []);
      })
      .catch((e) => { $('m-login-err').textContent = 'Error: ' + e.message; });
  }

  $('m-logout').addEventListener('click', () => {
    try { localStorage.removeItem(STORAGE_PW); } catch (_) {}
    pw = '';
    $('m-dash').classList.add('hidden');
    $('m-login').classList.remove('hidden');
    $('m-pw').value = '';
  });
  $('m-refresh').addEventListener('click', () => {
    fetchRoster();
  });
  $('m-detail-back').addEventListener('click', () => {
    $('m-detail').classList.add('hidden');
    $('m-roster').classList.remove('hidden');
    $('m-summary').classList.remove('hidden');
  });

  function fetchRoster() {
    $('m-dash-sub').textContent = 'Cargando…';
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { $('m-dash-sub').textContent = 'Error: ' + (data && data.error || ''); return; }
        renderRoster(data.students || []);
      });
  }

  function renderRoster(students) {
    // Show only students with ANY activity
    students = students.filter((s) =>
      (s.sentenceCount > 0) || (s.testCount > 0) || (s.assignmentCount > 0)
    );
    $('m-dash-sub').textContent = `${students.length} alumno${students.length === 1 ? '' : 's'} con actividad`;

    // Summary
    const totals = students.reduce((acc, s) => {
      acc.sent  += s.sentenceCount    || 0;
      acc.asg   += s.assignmentCount  || 0;
      acc.tests += s.testCount        || 0;
      if (s.sentenceCount > 0)   acc.activeSent++;
      if (s.assignmentCount > 0) acc.activeAsg++;
      if (s.testCount > 0)       acc.activeTests++;
      return acc;
    }, { sent: 0, asg: 0, tests: 0, activeSent: 0, activeAsg: 0, activeTests: 0 });
    $('m-summary').innerHTML = `
      <div class="m-summary-card">
        <div class="m-summary-title">📊 Resumen de la clase</div>
        <div class="m-summary-grid">
          <div class="m-summary-stat">
            <div class="m-summary-num">${totals.activeAsg}/${students.length}</div>
            <div class="m-summary-lbl">📚 Han entregado tareas</div>
            <div class="m-summary-det">${totals.asg} entregas en total</div>
          </div>
          <div class="m-summary-stat">
            <div class="m-summary-num">${totals.activeTests}/${students.length}</div>
            <div class="m-summary-lbl">🏆 Han hecho exámenes</div>
            <div class="m-summary-det">${totals.tests} intentos en total</div>
          </div>
          <div class="m-summary-stat">
            <div class="m-summary-num">${totals.activeSent}/${students.length}</div>
            <div class="m-summary-lbl">📝 Han escrito oraciones</div>
            <div class="m-summary-det">${totals.sent} oraciones en total</div>
          </div>
        </div>
      </div>`;

    // Roster rows
    const roster = $('m-roster');
    roster.innerHTML = '';
    if (!students.length) {
      roster.innerHTML = '<div class="m-empty">Aún nadie tiene actividad registrada.</div>';
      return;
    }
    students.forEach((s) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'm-row';
      const since = s.lastSeen ? new Date(s.lastSeen).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—';
      row.innerHTML = `
        <span class="m-row-avatar">${renderAvatar(s.avatar)}</span>
        <span class="m-row-code">${escapeHtml(s.code)}</span>
        <span class="m-row-name">${escapeHtml(s.displayName || 'Anon')}</span>
        <span class="m-row-counts">
          <span class="m-row-c" title="Oraciones escritas">📝 ${s.sentenceCount}</span>
          <span class="m-row-c" title="Tareas entregadas">📚 ${s.assignmentCount}</span>
          <span class="m-row-c" title="Exámenes de lectura">🏆 ${s.testCount}</span>
        </span>
        <span class="m-row-date">${since}</span>`;
      row.addEventListener('click', () => openDetail(s.code));
      roster.appendChild(row);
    });
  }

  function openDetail(code) {
    fetch('/api/admin/students/' + encodeURIComponent(code) + '?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { alert('Error: ' + (data && data.error || '')); return; }
        renderDetail(data);
      });
  }

  function renderDetail(data) {
    $('m-roster').classList.add('hidden');
    $('m-summary').classList.add('hidden');
    $('m-detail').classList.remove('hidden');
    const since = data.firstSeen ? new Date(data.firstSeen).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const tests = data.tests || [];
    const assigns = data.assignments || [];
    $('m-detail-head').innerHTML = `
      <span class="m-detail-avatar">${renderAvatar(data.avatar, 'large')}</span>
      <div class="m-detail-id">
        <div class="m-detail-name">${escapeHtml(data.displayName || 'Anon')}</div>
        <div class="m-detail-code">📇 ${escapeHtml(data.code)}</div>
        <div class="m-detail-meta">Desde ${since} ·
          📝 ${data.sentences.length} oraciones ·
          📚 ${assigns.length} tareas ·
          🏆 ${tests.length} exámenes</div>
      </div>`;
    const body = $('m-detail-body');
    body.innerHTML = '';
    // Assignments
    if (assigns.length) {
      const h = document.createElement('div');
      h.className = 'm-section-title';
      h.textContent = '📚 Tareas entregadas';
      body.appendChild(h);
      assigns.forEach((s) => {
        const pct = s.total ? Math.round((s.score / s.total) * 100) : 0;
        const cls = pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low';
        const dateStr = new Date(s.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const row = document.createElement('div');
        row.className = 'm-asg-row ' + cls;
        row.innerHTML = `
          <span class="m-asg-title">${escapeHtml(s.assignmentTitle || s.assignmentId)}</span>
          <span class="m-asg-score">${s.score}/${s.total} <small>(${pct}%)</small></span>
          <span class="m-asg-date">${dateStr}</span>`;
        body.appendChild(row);
      });
    }
    // Reading-mode tests
    if (tests.length) {
      const h = document.createElement('div');
      h.className = 'm-section-title';
      h.textContent = '🏆 Exámenes de lectura';
      body.appendChild(h);
      tests.forEach((t) => {
        const pct = Math.round((t.score / 100) * 100);
        const cls = pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low';
        const dateStr = new Date(t.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const row = document.createElement('div');
        row.className = 'm-asg-row ' + cls;
        row.innerHTML = `
          <span class="m-asg-title">📖 ${escapeHtml(t.storyTitle || t.storyId)}</span>
          <span class="m-asg-score">${t.score}/100 <small>(${pct}%)</small></span>
          <span class="m-asg-date">${dateStr}</span>`;
        body.appendChild(row);
      });
    }
    // Sentences (warmup)
    if (data.sentences.length) {
      const h = document.createElement('div');
      h.className = 'm-section-title';
      h.textContent = '✏️ Oraciones construidas en clase';
      body.appendChild(h);
      data.sentences.forEach((s) => {
        const dateStr = new Date(s.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const wordsHtml = (s.words || []).map((wid) => {
          const w = window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid];
          if (!w) return '';
          const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
          const color = cat ? cat.color : '#fff';
          return `<span class="m-sent-word" style="--cat-color:${color};">
            <span class="m-sent-icon">${w.icon || ''}</span>
            <span class="m-sent-pin">${escapeHtml(w.pinyin || '')}</span>
            <span class="m-sent-es">${escapeHtml(w.es || '')}</span>
          </span>`;
        }).join('');
        const item = document.createElement('div');
        item.className = 'm-sent-row';
        item.innerHTML = `
          <div class="m-sent-date">📅 ${dateStr}</div>
          <div class="m-sent-words">${wordsHtml}</div>`;
        body.appendChild(item);
      });
    }
    if (!assigns.length && !tests.length && !data.sentences.length) {
      body.innerHTML = '<div class="m-empty">Este alumno aún no tiene actividad.</div>';
    }
  }

  function renderAvatar(value, size) {
    if (typeof value === 'string' && /^[a-z]+$/.test(value)) {
      const cls = size === 'large' ? ' m-avatar-img-large' : '';
      return `<img class="m-avatar-img${cls}" src="/assets/avatars/${value}.svg" alt="">`;
    }
    return `<span class="m-avatar-emoji">${escapeHtml(value || '🧒🏼')}</span>`;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Auto-login if we have a saved password
  if (pw) {
    // Validate then mount
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ok) {
          $('m-login').classList.add('hidden');
          $('m-dash').classList.remove('hidden');
          renderRoster(data.students || []);
        }
      });
  }
})();
