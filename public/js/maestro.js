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
        renderRoster(data.students || [], data.self || null);
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

  // Auto-refresh every 15 seconds so the teacher sees who's joining in
  // real time. Only refreshes when the dashboard is visible (not while
  // looking at a student detail page or when the tab is in background).
  // User feedback 2026-05-27: "I should know who has joined right now —
  // don't make me keep asking 'who has joined?'"
  setInterval(() => {
    if (document.hidden) return;
    if ($('m-dash').classList.contains('hidden')) return;
    if (!$('m-detail').classList.contains('hidden')) return;
    if (!pw) return;
    fetchRoster();
  }, 15000);
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
        renderRoster(data.students || [], data.self || null);
      });
  }
  // === Tab switcher: students ↔ teachers (super-admin only) ===
  document.querySelectorAll('.m-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.m-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === target));
      document.querySelectorAll('.m-tabpanel').forEach((p) => p.classList.toggle('hidden', p.id !== 'm-tabpanel-' + target));
      if (target === 'teachers') fetchTeachers();
    });
  });
  // === Teacher management (super-admin) ===
  function fetchTeachers() {
    const list = $('m-teachers-list');
    list.innerHTML = '<div class="m-empty">Cargando maestros…</div>';
    fetch('/api/admin/teachers?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { list.innerHTML = '<div class="m-empty">Error: ' + (data && data.error || '') + '</div>'; return; }
        renderTeachers(data.teachers || []);
      });
  }
  function renderTeachers(teachers) {
    const list = $('m-teachers-list');
    list.innerHTML = '';
    if (!teachers.length) {
      list.innerHTML = '<div class="m-empty">Aún no hay maestros. Crea el primero ↑</div>';
      return;
    }
    teachers.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'm-teacher-row' + (t.isSuperAdmin ? ' is-super' : '');
      const since = t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      row.innerHTML = `
        <div class="m-teacher-main">
          <div class="m-teacher-name">${escapeHtml(t.displayName || 'Anon')}${t.isSuperAdmin ? ' <span class="m-teacher-badge">👑 Super admin</span>' : ''}</div>
          <div class="m-teacher-meta">${escapeHtml(t.email || 'sin email')}${t.country ? ' · ' + escapeHtml(t.country) : ''} · desde ${since}</div>
        </div>
        <div class="m-teacher-codes">
          <div class="m-teacher-code-row">
            <span class="m-teacher-code-label">🔑 Maestro/a:</span>
            <code class="m-teacher-code">${escapeHtml(t.teacherId)}</code>
          </div>
          <div class="m-teacher-code-row">
            <span class="m-teacher-code-label">📚 Aula:</span>
            <code class="m-teacher-code">${(t.accessCodes || []).map(escapeHtml).join(', ')}</code>
          </div>
        </div>
        ${t.isSuperAdmin ? '' : `<button class="btn btn-ghost btn-sm m-teacher-del" data-id="${escapeHtml(t.teacherId)}" type="button">🗑️ Eliminar</button>`}`;
      const del = row.querySelector('.m-teacher-del');
      if (del) del.addEventListener('click', () => deleteTeacher(t.teacherId, t.displayName));
      list.appendChild(row);
    });
  }
  function deleteTeacher(teacherId, displayName) {
    if (!confirm(`¿Eliminar al maestro/a "${displayName}" (${teacherId})?\n\nSus estudiantes quedarán huérfanos (puedes reasignarlos más tarde).`)) return;
    fetch('/api/admin/teachers/' + encodeURIComponent(teacherId) + '?pw=' + encodeURIComponent(pw), { method: 'DELETE' })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { alert('Error: ' + (data && data.error || '')); return; }
        fetchTeachers();
      });
  }
  // Create-teacher modal
  $('m-new-teacher-btn').addEventListener('click', () => {
    $('m-new-teacher-modal').classList.remove('hidden');
    $('m-new-teacher-name').value = '';
    $('m-new-teacher-email').value = '';
    $('m-new-teacher-country').value = '';
    $('m-new-teacher-msg').textContent = '';
    $('m-new-teacher-result').classList.add('hidden');
  });
  $('m-new-teacher-close').addEventListener('click', () => $('m-new-teacher-modal').classList.add('hidden'));
  $('m-new-teacher-submit').addEventListener('click', () => {
    const displayName = $('m-new-teacher-name').value.trim();
    const email = $('m-new-teacher-email').value.trim();
    const country = $('m-new-teacher-country').value.trim();
    if (!displayName) { $('m-new-teacher-msg').textContent = 'Escribe un nombre'; return; }
    $('m-new-teacher-msg').textContent = 'Creando…';
    fetch('/api/admin/teachers?pw=' + encodeURIComponent(pw), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, email: email || null, country: country || null }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { $('m-new-teacher-msg').textContent = 'Error: ' + (data && data.error || ''); return; }
        $('m-new-teacher-msg').textContent = '';
        $('m-result-teacher-id').textContent = data.teacher.teacherId;
        $('m-result-access-code').textContent = (data.teacher.accessCodes || []).join(', ');
        $('m-new-teacher-result').classList.remove('hidden');
        fetchTeachers();   // refresh list in background
      });
  });

  function renderRoster(students, self) {
    // Surface "who am I" line and (if super admin) the Teachers tab.
    if (self) {
      const isSuper = !!self.isSuperAdmin;
      const youLine = self.legacy
        ? '👑 Super admin (sesión legacy)'
        : `👩‍🏫 ${self.displayName || self.teacherId} — ${isSuper ? '👑 Super admin' : 'Maestro/a'}` +
          (self.accessCodes && self.accessCodes.length
            ? ` · Código de aula: ${self.accessCodes.join(', ')}`
            : '');
      $('m-dash-self').textContent = youLine;
      // Show tabs only for super admin
      const tabs = $('m-tabs');
      if (tabs) tabs.classList.toggle('hidden', !isSuper);
    }
    // Show only students with ANY activity
    students = students.filter((s) =>
      (s.sentenceCount > 0) || (s.testCount > 0) || (s.assignmentCount > 0)
    );
    // Classify by recent activity — used both for the "online now" pill
    // at the top and to sort the roster (active first).
    const ONLINE_MS  = 5 * 60 * 1000;    // active within last 5 min
    const RECENT_MS  = 60 * 60 * 1000;   // last hour
    const now = Date.now();
    students.forEach((s) => {
      const age = now - (s.lastSeen || 0);
      s._onlineNow = age <= ONLINE_MS;
      s._recent   = age <= RECENT_MS;
      s._secsAgo  = Math.floor(age / 1000);
    });
    // Sort: online first (most recent), then recent, then everyone else
    students.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    const onlineCount = students.filter((s) => s._onlineNow).length;
    $('m-dash-sub').innerHTML =
      `${students.length} alumno${students.length === 1 ? '' : 's'} con actividad` +
      (onlineCount > 0
        ? ` · <span class="m-online-pill">🟢 ${onlineCount} en línea ahora</span>`
        : '');

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
      row.className = 'm-row' + (s._onlineNow ? ' is-online' : '');
      // Friendly "5 min ago" / "2h ago" / "May 27" timestamp
      const sinceTxt = s._onlineNow
        ? formatRelative(s._secsAgo)
        : (s.lastSeen ? new Date(s.lastSeen).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—');
      row.innerHTML = `
        <span class="m-row-avatar">${renderAvatar(s.avatar)}${s._onlineNow ? '<span class="m-online-dot" title="En línea ahora"></span>' : ''}</span>
        <span class="m-row-code">${escapeHtml(s.code)}</span>
        <span class="m-row-name">${escapeHtml(s.displayName || 'Anon')}</span>
        <span class="m-row-counts">
          <span class="m-row-c" title="Oraciones escritas">📝 ${s.sentenceCount}</span>
          <span class="m-row-c" title="Tareas entregadas">📚 ${s.assignmentCount}</span>
          <span class="m-row-c" title="Exámenes de lectura">🏆 ${s.testCount}</span>
        </span>
        <span class="m-row-date">${sinceTxt}</span>`;
      row.addEventListener('click', () => openDetail(s.code));
      roster.appendChild(row);
    });
  }

  // "hace 5s" / "hace 2 min" / "hace 1h"
  function formatRelative(secs) {
    if (secs < 60)   return 'hace ' + secs + 's';
    if (secs < 3600) return 'hace ' + Math.floor(secs / 60) + ' min';
    if (secs < 86400) return 'hace ' + Math.floor(secs / 3600) + ' h';
    return 'hace ' + Math.floor(secs / 86400) + ' días';
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
