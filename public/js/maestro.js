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
  // 🎯 Modo Maestro en vivo — invite only currently-ONLINE students to a
  // live warmup session. User feedback 2026-05-27: "select from the list
  // of people that are online and enable that for everybody I select."
  let _liveMasterStudents = [];   // populated when modal opens
  let _liveMasterSelected = new Set();
  $('m-live-master-btn').addEventListener('click', () => {
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { alert('Error: ' + (data && data.error || '')); return; }
        const now = Date.now();
        const ONLINE_MS = 45 * 1000;
        // Filter: only students online RIGHT NOW (lastSeen within 45s)
        _liveMasterStudents = (data.students || [])
          .filter((s) => s.lastSeen && (now - s.lastSeen) <= ONLINE_MS)
          .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
        _liveMasterSelected = new Set(_liveMasterStudents.map((s) => s.code));  // all checked by default
        renderLiveMasterList();
        $('m-live-master-pin').value = '';
        $('m-live-master-text').value = '';
        $('m-live-master-msg').textContent = '';
        $('m-live-master-modal').classList.remove('hidden');
      });
  });
  $('m-live-master-close').addEventListener('click', () => $('m-live-master-modal').classList.add('hidden'));
  $('m-live-master-all').addEventListener('click', () => {
    _liveMasterStudents.forEach((s) => _liveMasterSelected.add(s.code));
    renderLiveMasterList();
  });
  $('m-live-master-none').addEventListener('click', () => {
    _liveMasterSelected.clear();
    renderLiveMasterList();
  });
  function renderLiveMasterList() {
    const list = $('m-live-master-list');
    $('m-live-master-count').textContent =
      `${_liveMasterStudents.length} en línea · ${_liveMasterSelected.size} seleccionados`;
    if (!_liveMasterStudents.length) {
      list.innerHTML = '<div class="m-empty">No hay estudiantes en línea ahora. Pídeles que abran /homework primero.</div>';
      return;
    }
    list.innerHTML = '';
    _liveMasterStudents.forEach((s) => {
      const row = document.createElement('label');
      row.className = 'm-live-master-row' + (_liveMasterSelected.has(s.code) ? ' selected' : '');
      const checked = _liveMasterSelected.has(s.code) ? 'checked' : '';
      row.innerHTML = `
        <input type="checkbox" class="m-live-master-check" data-code="${escapeHtml(s.code)}" ${checked}>
        <span class="m-live-master-avatar">${renderAvatar(s.avatar)}</span>
        <span class="m-live-master-name">${escapeHtml(s.displayName || 'Anon')}</span>
        <span class="m-live-master-code">${escapeHtml(s.code)}</span>`;
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) _liveMasterSelected.add(s.code);
        else _liveMasterSelected.delete(s.code);
        $('m-live-master-count').textContent =
          `${_liveMasterStudents.length} en línea · ${_liveMasterSelected.size} seleccionados`;
        row.classList.toggle('selected', e.target.checked);
      });
      list.appendChild(row);
    });
  }
  // ⚡ ONE-CLICK FORCE (2026-05-28): no PIN, no invitation. The teacher is
  // ALREADY logged in here — clicking "Activar" stashes the selected kids +
  // the teacher's code in sessionStorage, then jumps straight to the
  // sentence-builder host page in "live-master" mode. That page silently
  // creates the warmup game, starts it, flips on auto-delegate (every kid
  // = asistente), and force-redirects the selected kids onto the builder.
  // The teacher lands directly on the construction screen. "It's magic."
  $('m-live-master-send').addEventListener('click', () => {
    const text = $('m-live-master-text').value.trim() || '¡Entra a Modo Maestro ahora!';
    if (!_liveMasterSelected.size) { $('m-live-master-msg').textContent = 'Selecciona al menos un estudiante.'; return; }
    $('m-live-master-msg').textContent = 'Activando Modo Maestro en vivo…';
    try {
      sessionStorage.setItem('dralyLiveMaster', JSON.stringify({
        codes: Array.from(_liveMasterSelected),
        pw,                 // teacher's login code — same-origin, ephemeral
        text,
        ts: Date.now(),
      }));
    } catch (e) {
      $('m-live-master-msg').textContent = 'No se pudo iniciar (almacenamiento bloqueado).';
      return;
    }
    // Jump to the builder in live-master mode. It does the rest.
    location.href = '/host-warmup.html?livemaster=1';
  });

  // === 📘 GUÍAS (PDF upload + manage) ===
  const guidesBtn   = $('m-guides-btn');
  const guidesModal = $('m-guides-modal');
  if (guidesBtn) guidesBtn.addEventListener('click', () => {
    guidesModal.classList.remove('hidden');
    $('m-guide-msg').textContent = '';
    loadGuidesList();
  });
  if ($('m-guides-close')) $('m-guides-close').addEventListener('click', () => guidesModal.classList.add('hidden'));
  if (guidesModal) guidesModal.addEventListener('click', (e) => { if (e.target === guidesModal) guidesModal.classList.add('hidden'); });

  // ── 🌐 EMIRATI ARABIC GATEWAY (super-admin only) ──────────────────
  const emBtn = $('m-emirati-btn');
  const emModal = $('m-emirati-modal');
  if (emBtn) emBtn.addEventListener('click', () => { emModal.classList.remove('hidden'); loadEmirati(); });
  if ($('m-emirati-close')) $('m-emirati-close').addEventListener('click', () => emModal.classList.add('hidden'));
  if (emModal) emModal.addEventListener('click', (e) => { if (e.target === emModal) emModal.classList.add('hidden'); });
  if ($('m-em-shuffle')) $('m-em-shuffle').addEventListener('click', loadEmirati);
  if ($('m-em-mark-all')) $('m-em-mark-all').addEventListener('click', () => {
    if (!_emToday.length) return;
    fetch('/api/maestro/emirati/mark?pw=' + encodeURIComponent(pw), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordIds: _emToday.map((w) => w.id), date: new Date().toISOString().slice(0, 10) }),
    }).then((r) => r.json()).then((d) => { if (d && d.ok) { applyEmiratiHud(d.progress); loadEmirati(true); } });
  });
  let _emToday = [];
  let _emLearnedSentences = new Set();
  function loadEmirati(reshuffle) {
    const list = $('m-emirati-list');
    if (list) list.textContent = 'Cargando…';
    // Cache-bust the GET when re-shuffling so we re-pick from the unseen pool.
    const date = new Date().toISOString().slice(0, 10) + (reshuffle ? '#' + Date.now() : '');
    fetch('/api/maestro/emirati/today?pw=' + encodeURIComponent(pw) + '&date=' + encodeURIComponent(date.slice(0, 10)))
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) { if (list) list.textContent = 'Error: ' + (d && d.error || 'no se pudo cargar'); return; }
        _emToday = d.words || [];
        _emLearnedSentences = new Set(d.learnedSentences || []);
        applyEmiratiHud(d.progress);
        renderEmiratiWords(_emToday, d.sections);
      })
      .catch((e) => { if (list) list.textContent = 'Error: ' + e.message; });
  }
  function applyEmiratiHud(p) {
    if (!p) return;
    if ($('m-em-seen'))   $('m-em-seen').textContent   = p.seenCount;
    if ($('m-em-total'))  $('m-em-total').textContent  = p.total;
    if ($('m-em-streak')) $('m-em-streak').textContent = p.streak;
    if ($('m-em-sent-count')) $('m-em-sent-count').textContent = p.sentencesLearned || 0;
  }
  function renderEmiratiWords(words, sections) {
    const list = $('m-emirati-list'); if (!list) return;
    if (!words.length) { list.innerHTML = '<div class="m-empty">¡Has visto todas las palabras disponibles! 🎉</div>'; return; }
    list.innerHTML = '';
    words.forEach((w) => {
      const sec = sections && sections[w.section];
      const card = document.createElement('div');
      card.className = 'm-em-card';
      let ses = '';
      if (Array.isArray(w.ses) && w.ses.length) {
        ses = '<div class="m-em-sentences">'
          + w.ses.map((s, si) => {
              const key = w.id + ':' + si;
              const learned = _emLearnedSentences.has(key);
              const isAuto = w.sesAuto ? ' m-em-s-auto' : '';
              return '<div class="m-em-s' + (learned ? ' is-learned' : '') + isAuto + '" data-sentkey="' + escapeHtml(key) + '">'
                + '<div class="m-em-s-text">'
                +   '<span class="m-em-tr">' + escapeHtml(s.tr) + '</span>'
                +   '<span class="m-em-en">' + escapeHtml(s.en) + '</span>'
                + '</div>'
                + '<div class="m-em-s-tools">'
                +   '<button class="m-em-s-speak" type="button" data-ar="' + escapeHtml(s.tr) + '" title="Escuchar oración">🔊</button>'
                +   '<button class="m-em-s-learn" type="button" data-key="' + escapeHtml(key) + '" title="' + (learned ? 'Marcar como NO aprendida' : 'Marcar como aprendida') + '">' + (learned ? '✓' : '○') + '</button>'
                + '</div>'
              + '</div>';
            }).join('')
          + '</div>';
      }
      // Section + priority badge on the first row.
      const prioBadge = w.priority != null
        ? '<span class="m-em-prio" title="Orden de importancia">#' + w.priority + '</span>'
        : '';
      card.innerHTML = `
        <div class="m-em-row">
          <div class="m-em-section">${sec ? (sec.icon + ' ' + escapeHtml(sec.label)) : ''} ${prioBadge}</div>
          <button class="m-em-speak" type="button" data-ar="${escapeHtml(w.ar)}" data-wid="${escapeHtml(w.id)}" title="Escuchar (MP3 emiratí si existe, si no Google MSA)">🔊</button>
        </div>
        <div class="m-em-ar" lang="ar" dir="rtl">${escapeHtml(w.ar)}</div>
        <div class="m-em-tr">${escapeHtml(w.tr)}</div>
        <div class="m-em-en">${escapeHtml(w.en)}</div>
        ${ses}
        <button class="m-em-mark" type="button" data-id="${escapeHtml(w.id)}">✓ Marcar como vista</button>`;
      list.appendChild(card);
    });
    list.querySelectorAll('.m-em-speak').forEach((b) => b.addEventListener('click', (e) => {
      speakEmirati(b.dataset.ar, b, b.dataset.wid);
    }));
    // 🔊 on every sentence row: pass the transliteration (tr) to Azure
    // ar-AE-Fatima via /api/tts since Khaleeji speech is what we want.
    // No on-disk cache yet for sentences — first hit goes to Azure live.
    list.querySelectorAll('.m-em-s-speak').forEach((b) => b.addEventListener('click', () => {
      const trText = b.dataset.ar;
      if (!trText) return;
      // No wordId for sentences → speakEmirati falls through to MSA. Pass
      // the (tr) string as the ar text; Azure will phonetically render it.
      // For best quality use the Arabic of the WHOLE sentence — but ses
      // only ships with tr/en in the dataset. Live with tr-via-Azure for now.
      speakEmirati(trText, b, '');
    }));
    // ✓ Toggle "learned" status on each sentence; persists to server.
    list.querySelectorAll('.m-em-s-learn').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.key; if (!key) return;
      const wasLearned = _emLearnedSentences.has(key);
      fetch('/api/maestro/emirati/sentence/mark?pw=' + encodeURIComponent(pw), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [key], unmark: wasLearned }),
      }).then((r) => r.json()).then((d) => {
        if (!d || !d.ok) return;
        _emLearnedSentences = new Set(d.learnedSentences || []);
        const row = b.closest('.m-em-s');
        if (row) row.classList.toggle('is-learned', _emLearnedSentences.has(key));
        b.textContent = _emLearnedSentences.has(key) ? '✓' : '○';
        // Update HUD sentencesLearned via the existing emirati progress payload.
        const tag = document.getElementById('m-em-sent-count');
        if (tag) tag.textContent = d.count;
      });
    }));
    list.querySelectorAll('.m-em-mark').forEach((b) => b.addEventListener('click', () => {
      fetch('/api/maestro/emirati/mark?pw=' + encodeURIComponent(pw), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordIds: [b.dataset.id], date: new Date().toISOString().slice(0, 10) }),
      }).then((r) => r.json()).then((d) => {
        if (d && d.ok) { applyEmiratiHud(d.progress); b.textContent = '✓ Vista'; b.disabled = true; b.classList.add('done'); }
      });
    }));
  }
  // ── 🎯 CUSTOM ASSIGNMENTS — author a tarea + send to specific kids ───
  const cuBtn = $('m-custom-btn');
  const cuModal = $('m-custom-modal');
  let _cuStudents = [];     // [{code,name,checked}]
  let _cuItems = [];        // [{es,expected}]
  function openCustomModal() {
    cuModal.classList.remove('hidden');
    $('m-cu-msg').textContent = '';
    $('m-cu-title').value = ''; $('m-cu-instr').value = '';
    _cuItems = [{ es: '', expected: '' }];
    renderCustomItems();
    loadCustomStudents();
    loadCustomExisting();
  }
  if (cuBtn) cuBtn.addEventListener('click', openCustomModal);
  if ($('m-custom-close')) $('m-custom-close').addEventListener('click', () => cuModal.classList.add('hidden'));
  if (cuModal) cuModal.addEventListener('click', (e) => { if (e.target === cuModal) cuModal.classList.add('hidden'); });
  if ($('m-cu-add-item')) $('m-cu-add-item').addEventListener('click', () => {
    if (_cuItems.length >= 24) return;
    _cuItems.push({ es: '', expected: '' }); renderCustomItems();
  });
  if ($('m-cu-students-search')) $('m-cu-students-search').addEventListener('input', () => renderCustomStudents());
  if ($('m-cu-students-all')) $('m-cu-students-all').addEventListener('click', () => { _cuStudents.forEach((s) => s.checked = true); renderCustomStudents(); });
  if ($('m-cu-students-none')) $('m-cu-students-none').addEventListener('click', () => { _cuStudents.forEach((s) => s.checked = false); renderCustomStudents(); });
  if ($('m-cu-send')) $('m-cu-send').addEventListener('click', sendCustom);
  function renderCustomItems() {
    const wrap = $('m-cu-items'); if (!wrap) return;
    wrap.innerHTML = '';
    _cuItems.forEach((it, i) => {
      const row = document.createElement('div'); row.className = 'm-cu-item';
      row.innerHTML = `
        <span class="m-cu-item-num">${i + 1}.</span>
        <input class="input m-cu-item-es" placeholder="Oración en español (ej. Yo soy maestro)" value="${escapeHtml(it.es)}">
        <input class="input m-cu-item-px" placeholder="Pinyin esperado (ej. wo shi laoshi)" value="${escapeHtml(it.expected)}">
        <button class="m-cu-item-del" type="button" title="Quitar">✕</button>`;
      row.querySelector('.m-cu-item-es').addEventListener('input', (e) => { _cuItems[i].es = e.target.value; });
      row.querySelector('.m-cu-item-px').addEventListener('input', (e) => { _cuItems[i].expected = e.target.value; });
      row.querySelector('.m-cu-item-del').addEventListener('click', () => { _cuItems.splice(i, 1); if (!_cuItems.length) _cuItems.push({ es: '', expected: '' }); renderCustomItems(); });
      wrap.appendChild(row);
    });
  }
  function loadCustomStudents() {
    const list = $('m-cu-students'); if (list) list.textContent = 'Cargando…';
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        const students = (data && data.students) || [];
        _cuStudents = students.map((s) => ({ code: s.code, name: s.displayName || 'Anon', checked: false }));
        renderCustomStudents();
      })
      .catch(() => { if (list) list.textContent = 'Error cargando estudiantes.'; });
  }
  function renderCustomStudents() {
    const list = $('m-cu-students'); if (!list) return;
    const q = ($('m-cu-students-search') ? $('m-cu-students-search').value : '').toLowerCase().trim();
    const filtered = _cuStudents.filter((s) => !q || s.code.toLowerCase().indexOf(q) >= 0 || s.name.toLowerCase().indexOf(q) >= 0);
    if (!filtered.length) { list.innerHTML = '<div class="m-empty">Sin resultados.</div>'; return; }
    list.innerHTML = '';
    filtered.forEach((s) => {
      const row = document.createElement('label'); row.className = 'm-cu-student' + (s.checked ? ' on' : '');
      row.innerHTML = `<input type="checkbox" ${s.checked ? 'checked' : ''}> <span class="m-cu-stu-code">${escapeHtml(s.code)}</span> <span class="m-cu-stu-name">${escapeHtml(s.name)}</span>`;
      row.querySelector('input').addEventListener('change', (e) => { s.checked = e.target.checked; row.classList.toggle('on', s.checked); });
      list.appendChild(row);
    });
    const tag = $('m-cu-msg'); const sel = _cuStudents.filter((s) => s.checked).length;
    if (tag) tag.textContent = sel ? sel + ' alumno' + (sel === 1 ? '' : 's') + ' seleccionado' + (sel === 1 ? '' : 's') : '';
  }
  function sendCustom() {
    const title = $('m-cu-title').value.trim();
    const instructions = $('m-cu-instr').value.trim();
    const items = _cuItems.filter((it) => it.es.trim() && it.expected.trim());
    const targets = _cuStudents.filter((s) => s.checked).map((s) => s.code);
    const msg = $('m-cu-msg');
    if (!title) { if (msg) msg.textContent = '✕ Falta el título.'; return; }
    if (!items.length) { if (msg) msg.textContent = '✕ Necesitas al menos 1 oración completa (español + pinyin).'; return; }
    if (!targets.length) { if (msg) msg.textContent = '✕ Marca al menos 1 estudiante.'; return; }
    if (msg) msg.textContent = 'Enviando…';
    fetch('/api/admin/custom-assignment?pw=' + encodeURIComponent(pw), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, instructions, items, targetStudents: targets, pointsPerItem: 10 }),
    }).then((r) => r.json()).then((d) => {
      if (d && d.ok) {
        if (msg) msg.textContent = '✅ Enviada a ' + targets.length + ' alumno' + (targets.length === 1 ? '' : 's') + '.';
        _cuItems = [{ es: '', expected: '' }]; renderCustomItems();
        $('m-cu-title').value = ''; $('m-cu-instr').value = '';
        _cuStudents.forEach((s) => s.checked = false); renderCustomStudents();
        loadCustomExisting();
      } else {
        if (msg) msg.textContent = '✕ Error: ' + ((d && d.error) || 'no se pudo enviar');
      }
    }).catch((e) => { if (msg) msg.textContent = '✕ ' + e.message; });
  }
  function loadCustomExisting() {
    const wrap = $('m-cu-existing'); if (!wrap) return;
    wrap.textContent = 'Cargando…';
    fetch('/api/admin/custom-assignments?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((d) => {
        const list = (d && d.assignments) || [];
        if (!list.length) { wrap.innerHTML = '<div class="m-empty">Aún no has mandado tareas especiales.</div>'; return; }
        wrap.innerHTML = '';
        list.forEach((a) => {
          const row = document.createElement('div'); row.className = 'm-cu-ex';
          const when = a.createdAt ? new Date(a.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
          row.innerHTML = `
            <div class="m-cu-ex-info">
              <div class="m-cu-ex-title">${escapeHtml(a.title || 'Tarea')}</div>
              <div class="m-cu-ex-meta">📝 ${a.items.length} oración${a.items.length === 1 ? '' : 'es'} · 👥 ${a.targetStudents.length} alumno${a.targetStudents.length === 1 ? '' : 's'} · ${when}</div>
            </div>
            <button class="btn btn-ghost btn-sm m-cu-ex-del" type="button">🗑 Borrar</button>`;
          row.querySelector('.m-cu-ex-del').addEventListener('click', () => {
            if (!confirm('¿Borrar "' + a.title + '"? Los alumnos ya no la verán.')) return;
            fetch('/api/admin/custom-assignment/' + encodeURIComponent(a.id) + '?pw=' + encodeURIComponent(pw), { method: 'DELETE' })
              .then((r) => r.json()).then(() => loadCustomExisting());
          });
          wrap.appendChild(row);
        });
      })
      .catch(() => { wrap.textContent = 'Error.'; });
  }

  let _emAudio = null;
  let _emAzureVoice = 'female';   // 'female' (Fatima) | 'male' (Hamdan)
  // Play priority on every 🔊 tap:
  //  1. /api/emirati/audio/{wordId}?voice=<female|male>
  //     a. served from disk cache if a prior call generated it, OR
  //     b. server hits Azure ar-AE-FatimaNeural / HamdanNeural live,
  //        caches the MP3, sends it back (first hit only)
  //  2. If both fail, fall back to /api/tts?voice=ar-XA-Wavenet-A
  //     (Google MSA) and visually mark the button so the teacher knows.
  // The Audio element's `error` event fires on a 404 from (1), which is
  // how we know to flip to (2). No wasteful HEAD pre-check.
  function speakEmirati(arText, btn, wid) {
    try { if (_emAudio) { _emAudio.pause(); _emAudio = null; } } catch (_) {}
    if (btn) { btn.textContent = '🔊 …'; btn.classList.remove('m-em-speak-msa'); }
    const playMsaFallback = () => {
      if (btn) btn.classList.add('m-em-speak-msa');
      _emAudio = new Audio('/api/tts?voice=ar-XA-Wavenet-A&text=' + encodeURIComponent(arText));
      _emAudio.addEventListener('canplay', () => _emAudio.play().catch(() => {}));
      _emAudio.addEventListener('ended', () => { if (btn) btn.textContent = '🔊'; });
      _emAudio.addEventListener('error', () => { if (btn) btn.textContent = '⚠️'; });
    };
    if (!wid) return playMsaFallback();
    const overrideUrl = '/api/emirati/audio/' + encodeURIComponent(wid) + '?voice=' + _emAzureVoice;
    _emAudio = new Audio(overrideUrl);
    _emAudio.addEventListener('canplay', () => _emAudio.play().catch(() => {}));
    _emAudio.addEventListener('ended', () => { if (btn) btn.textContent = '🔊'; });
    _emAudio.addEventListener('error', () => { playMsaFallback(); });
  }

  // ── 🎙️ AZURE: bind the Khaleeji voice generator panel. ──
  // On modal open we poll /azure-status; the button only appears when the
  // server actually has AZURE_SPEECH_KEY set. The voice <select> persists
  // to localStorage and re-fetches re-render so future taps use the chosen
  // voice (also passed via ?voice= on the audio endpoint).
  const _emAzureSavedVoice = (function () {
    try { return localStorage.getItem('em_azure_voice') || 'female'; } catch (_) { return 'female'; }
  })();
  _emAzureVoice = _emAzureSavedVoice;
  const _emAzVoiceSel = $('m-em-azure-voice');
  if (_emAzVoiceSel) {
    _emAzVoiceSel.value = _emAzureSavedVoice;
    _emAzVoiceSel.addEventListener('change', () => {
      _emAzureVoice = _emAzVoiceSel.value === 'male' ? 'male' : 'female';
      try { localStorage.setItem('em_azure_voice', _emAzureVoice); } catch (_) {}
      // Invalidate previously cached MP3s by surfacing a hint — the server
      // already saved Fatima's renderings under e<id>.mp3, so switching to
      // Hamdan after generating would still play Fatima. Tell the teacher.
      const st = $('m-em-azure-status');
      if (st) st.dataset.dirty = '1';
    });
  }
  let _emAzurePollT = null;
  function refreshAzureStatus() {
    const stat = $('m-em-azure-status');
    const gen = $('m-em-azure-gen');
    const help = $('m-em-azure-help');
    if (!stat) return;
    fetch('/api/maestro/emirati/azure-status?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) { stat.textContent = 'Error: ' + ((d && d.error) || 'no se pudo verificar'); return; }
        if (d.azureConfigured) {
          stat.innerHTML = '✅ <b>Azure activo</b> · región <code>' + escapeHtml(d.region) + '</code> · '
            + 'voz por defecto <code>' + escapeHtml(d.voiceFemale) + '</code><br>'
            + '🎵 <b>' + d.cached + ' / ' + d.total + '</b> palabras cacheadas como MP3 real (Khaleeji).'
            + (d.cached < d.total ? ' Las demás se generan al primer 🔊.' : ' ¡Todas listas!');
          if (gen) {
            gen.classList.remove('hidden');
            gen.disabled = d.cached >= d.total;
            gen.textContent = d.cached >= d.total
              ? '✅ Todas generadas (' + d.total + ')'
              : '🎙️ Generar las que faltan (' + (d.total - d.cached) + ')';
          }
          if (help) help.classList.add('hidden');
        } else {
          stat.innerHTML = '⚠️ <b>Azure no configurado.</b> Por ahora las palabras suenan en MSA (Google).';
          if (gen) gen.classList.add('hidden');
          if (help) help.classList.remove('hidden');
        }
      })
      .catch((e) => { stat.textContent = 'Error: ' + e.message; });
  }
  if ($('m-em-azure-gen')) {
    $('m-em-azure-gen').addEventListener('click', () => {
      const btn = $('m-em-azure-gen');
      const stat = $('m-em-azure-status');
      btn.disabled = true;
      btn.textContent = '🎙️ Generando…';
      if (stat) stat.textContent = 'Lanzando trabajo en el servidor…';
      fetch('/api/maestro/emirati/generate-all?pw=' + encodeURIComponent(pw), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: _emAzureVoice }),
      }).then((r) => r.json()).then((d) => {
        if (!d || !d.ok) {
          if (stat) stat.textContent = '✕ Error: ' + ((d && d.error) || 'no se pudo lanzar');
          btn.disabled = false;
          return;
        }
        if (stat) stat.textContent = '🎙️ Generando ' + (d.queued || 0) + ' palabras… (≈ ' + Math.ceil((d.queued || 0) / 4) + 's)';
        // Poll every 3s until cached == total
        if (_emAzurePollT) clearInterval(_emAzurePollT);
        _emAzurePollT = setInterval(() => {
          fetch('/api/maestro/emirati/azure-status?pw=' + encodeURIComponent(pw))
            .then((r) => r.json()).then((s) => {
              if (s && s.ok) {
                if (stat) stat.innerHTML = '🎙️ Generando… <b>' + s.cached + ' / ' + s.total + '</b>';
                if (s.cached >= s.total) {
                  clearInterval(_emAzurePollT); _emAzurePollT = null;
                  refreshAzureStatus();
                }
              }
            });
        }, 3000);
      }).catch((e) => {
        if (stat) stat.textContent = '✕ ' + e.message;
        btn.disabled = false;
      });
    });
  }
  // Refresh Azure status whenever the modal opens.
  if (emBtn) emBtn.addEventListener('click', refreshAzureStatus);

  function loadGuidesList() {
    const list = $('m-guides-list');
    if (!list) return;
    list.innerHTML = '<div class="m-empty">Cargando…</div>';
    fetch('/api/admin/guides?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { list.innerHTML = '<div class="m-empty">No se pudo cargar.</div>'; return; }
        if (!data.guides.length) { list.innerHTML = '<div class="m-empty">Aún no hay guías subidas.</div>'; return; }
        list.innerHTML = '';
        data.guides.forEach((g) => {
          const mb = g.size ? (g.size / (1024 * 1024)).toFixed(1) + ' MB' : '';
          const row = document.createElement('div');
          row.className = 'm-guide-row';
          row.innerHTML = `
            <span class="m-guide-title">📘 ${escapeHtml(g.title)}</span>
            <span class="m-guide-meta">${escapeHtml((g.exp || '').toUpperCase())} · ${mb}</span>
            <a class="btn btn-ghost btn-sm" href="/api/guides/${encodeURIComponent(g.id)}" target="_blank" rel="noopener">Ver</a>
            <button class="btn btn-red btn-sm" data-id="${escapeHtml(g.id)}" type="button">🗑</button>`;
          row.querySelector('button[data-id]').addEventListener('click', () => {
            if (!confirm('¿Borrar esta guía?')) return;
            fetch('/api/admin/guides/' + encodeURIComponent(g.id) + '?pw=' + encodeURIComponent(pw), { method: 'DELETE' })
              .then((r) => r.json()).then(() => loadGuidesList());
          });
          list.appendChild(row);
        });
      })
      .catch((e) => { list.innerHTML = '<div class="m-empty">Error: ' + e.message + '</div>'; });
  }

  if ($('m-guide-upload')) $('m-guide-upload').addEventListener('click', () => {
    const title = $('m-guide-title').value.trim();
    const exp   = $('m-guide-exp').value;
    const fileEl = $('m-guide-file');
    const msg = $('m-guide-msg');
    const file = fileEl && fileEl.files && fileEl.files[0];
    if (!title) { msg.textContent = 'Escribe un título.'; return; }
    if (!file) { msg.textContent = 'Elige un archivo PDF.'; return; }
    if (file.size > 18 * 1024 * 1024) { msg.textContent = 'El PDF es muy grande (máx 18 MB).'; return; }
    msg.textContent = 'Subiendo…';
    const reader = new FileReader();
    reader.onload = () => {
      fetch('/api/admin/guides?pw=' + encodeURIComponent(pw), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, exp, dataBase64: String(reader.result || '') }),
      })
        .then((r) => r.json())
        .then((r) => {
          if (!r.ok) { msg.textContent = 'Error: ' + (r.error || ''); return; }
          msg.textContent = '✓ Guía subida.';
          $('m-guide-title').value = '';
          if (fileEl) fileEl.value = '';
          loadGuidesList();
        })
        .catch((e) => { msg.textContent = 'Error: ' + e.message; });
    };
    reader.onerror = () => { msg.textContent = 'No se pudo leer el archivo.'; };
    reader.readAsDataURL(file);   // → data:application/pdf;base64,...
  });

  // 📢 Broadcast — sends a message to every student in the teacher's
  // classroom. Super admin gets prompted for the classroomCode (defaults
  // to "1001" — your own); regular teachers auto-target their own.
  $('m-broadcast-btn').addEventListener('click', () => {
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        const self = data && data.self;
        let classroomCode = self && self.accessCodes && self.accessCodes[0];
        if (self && self.isSuperAdmin) {
          // Super admin can target any classroom — default to first own code
          classroomCode = prompt('Código de aula a la que enviar (deja vacío para 1001):', classroomCode || '1001') || '1001';
        }
        if (!classroomCode) { alert('No tienes un código de aula configurado.'); return; }
        const text = prompt(`Mensaje para todos los alumnos del aula ${classroomCode}:\n\n(Aparecerá como notificación en su portal de tareas)`, '');
        if (!text || !text.trim()) return;
        const wantLink = confirm('¿Adjuntar un enlace de acción? (ej. "Únete a mi sesión en vivo")\n\nOK = sí, Cancelar = solo texto');
        let actionUrl = null, actionLabel = null;
        if (wantLink) {
          actionUrl = prompt('URL del enlace (ej. /player.html?pin=1234):', '/player.html?pin=');
          actionLabel = actionUrl ? prompt('Texto del botón (ej. "Únete ahora"):', 'Únete ahora') : null;
        }
        fetch('/api/admin/broadcast?pw=' + encodeURIComponent(pw), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classroomCode,
            text: text.trim(),
            actionType: actionUrl ? 'link' : null,
            actionUrl,
            actionLabel,
          }),
        })
          .then((r) => r.json())
          .then((r) => {
            if (!r.ok) { alert('Error: ' + (r.error || 'no se pudo')); return; }
            alert(`✓ Mensaje enviado a ${r.sent} alumno${r.sent === 1 ? '' : 's'} del aula ${classroomCode}.`);
          });
      });
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
      // Reveal the personal Emirati gateway only for the super admin (owner).
      const emBtn = $('m-emirati-btn');
      if (emBtn) emBtn.classList.toggle('hidden', !isSuper);
    }
    // Show only students with ANY activity — including daily-challenge play
    // so a kid who only does Desafíos del Día also appears in Cuaderno.
    students = students.filter((s) =>
      (s.sentenceCount > 0) || (s.testCount > 0) || (s.assignmentCount > 0)
      || (s.xp || 0) > 0 || !!s.dailyDate
    );
    // Classify by recent activity — used both for the "online now" pill
    // at the top and to sort the roster (active first).
    // Kids poll inbox every 20s while their homework page is open. So
    // "online right now" = lastSeen within the last 45 seconds. That
    // window covers a single missed poll without flickering the dot off.
    const ONLINE_MS  = 45 * 1000;        // active within last 45 sec
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
          <span class="m-row-c m-row-daily ${s.dailyDate === (new Date().toISOString().slice(0,10)) ? 'is-done' : ''}" title="Desafío del día"
            >${s.dailyDate === (new Date().toISOString().slice(0,10)) ? '✅' : '⌛'} Hoy</span>
          <span class="m-row-c" title="DralySwords ⚔️">⚔️ ${s.swords || 0}</span>
          <span class="m-row-c" title="Racha de días">🔥 ${s.streak || 0}</span>
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

  function renderNotes(code, notes) {
    const list = $('m-notes-list');
    if (!list) return;
    if (!notes.length) { list.innerHTML = '<div class="m-notes-empty">Sin notas todavía.</div>'; return; }
    list.innerHTML = '';
    notes.slice().reverse().forEach((n) => {
      const row = document.createElement('div');
      row.className = 'm-note-item';
      row.innerHTML = `
        <span class="m-note-month-tag">${escapeHtml(n.month || '')}${n.grade ? ' · ' + escapeHtml(n.grade) : ''}</span>
        <span class="m-note-item-text">${escapeHtml(n.text)}</span>
        <button class="m-note-del" type="button" aria-label="Borrar">🗑</button>`;
      row.querySelector('.m-note-del').addEventListener('click', () => {
        fetch('/api/admin/student/' + encodeURIComponent(code) + '/note/' + n.ts + '?pw=' + encodeURIComponent(pw), { method: 'DELETE' })
          .then((r) => r.json()).then((r) => renderNotes(code, r.notes || []));
      });
      list.appendChild(row);
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
        <div class="m-detail-name-row">
          <span class="m-detail-name" id="m-detail-name">${escapeHtml(data.displayName || 'Anon')}</span>
          <button class="btn btn-ghost btn-sm" id="m-detail-rename-btn" title="Editar nombre">✏️</button>
        </div>
        <div class="m-detail-code">📇 ${escapeHtml(data.code)}</div>
        <div class="m-detail-meta">Desde ${since} ·
          📝 ${data.sentences.length} oraciones ·
          📚 ${assigns.length} tareas ·
          🏆 ${tests.length} exámenes</div>
        <div class="m-detail-meta m-detail-device">
          ${data.country ? '🌍 ' + escapeHtml(data.country) : '🌍 —'}
          ${data.device ? ' · 📱 ' + escapeHtml(data.device) : ''}
          ${data.locale ? ' · 🗣 ' + escapeHtml(data.locale) : ''}
        </div>
        <div class="m-detail-actions-row">
          <button class="btn btn-jade btn-sm" id="m-detail-send-btn">💬 Enviar mensaje</button>
          <button class="btn btn-ghost btn-sm" id="m-detail-clear-sent-btn" title="Borra solo las oraciones guardadas — el alumno permanece">🧹 Limpiar oraciones</button>
          <button class="btn btn-red btn-sm" id="m-detail-delete-btn" title="Borrar este alumno permanentemente">🗑 Borrar alumno</button>
        </div>
        <!-- 📋 Notas para el reporte mensual -->
        <div class="m-notes-box">
          <div class="m-notes-title">📋 Notas para el reporte (las verán los papás)</div>
          <div class="m-notes-row">
            <input class="input m-note-grade" id="m-note-grade" type="text" placeholder="Cal. (A, 95…)" maxlength="12">
            <input class="input m-note-month" id="m-note-month" type="month">
          </div>
          <textarea class="input m-note-text" id="m-note-text" rows="2" placeholder="Palabras clave: pronunciación excelente, tímido al hablar, dominó la familia…" maxlength="400"></textarea>
          <button class="btn btn-jade btn-sm" id="m-note-add">➕ Guardar nota</button>
          <div class="m-notes-list" id="m-notes-list"></div>
        </div>
      </div>`;
    // Notes: default month = current, render existing, wire add/delete.
    (function wireNotes() {
      const monthEl = $('m-note-month');
      if (monthEl) monthEl.value = new Date().toISOString().slice(0, 7);
      renderNotes(data.code, data.notes || []);
      const addBtn = $('m-note-add');
      if (addBtn) addBtn.addEventListener('click', () => {
        const text = ($('m-note-text').value || '').trim();
        if (!text) return;
        fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/note?pw=' + encodeURIComponent(pw), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, grade: $('m-note-grade').value.trim(), month: $('m-note-month').value }),
        }).then((r) => r.json()).then((r) => {
          if (!r.ok) { alert('Error: ' + (r.error || '')); return; }
          $('m-note-text').value = '';
          renderNotes(data.code, r.notes || []);
        });
      });
    })();
    // Wire "limpiar oraciones" — wipes saved sentences ONLY (kid record stays).
    // Useful when a class spammed test saves and the teacher wants a clean slate.
    $('m-detail-clear-sent-btn').addEventListener('click', () => {
      const n = (data.sentences || []).length;
      if (!n) { alert('Este alumno no tiene oraciones guardadas.'); return; }
      if (!confirm('¿Borrar las ' + n + ' oraciones guardadas de "' + (data.displayName || data.code) + '"?\n\nEl historial de tareas y exámenes NO se toca. Solo las oraciones del builder.')) return;
      fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/sentences/clear?pw=' + encodeURIComponent(pw), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      }).then((r) => r.json()).then((r) => {
        if (!r.ok) { alert('Error: ' + (r.error || '')); return; }
        alert('✅ ' + r.removed + ' oraciones eliminadas. Recargando…');
        openDetail(data.code);
      }).catch((e) => alert('Error: ' + e.message));
    });
    // Wire delete — irreversible; double-confirm.
    $('m-detail-delete-btn').addEventListener('click', () => {
      if (!confirm(`¿Borrar PERMANENTEMENTE a "${data.displayName || data.code}" (${data.code})?\n\nSe elimina su historial completo. Esto NO se puede deshacer.`)) return;
      if (!confirm('Última confirmación: ¿seguro que quieres borrar a este alumno?')) return;
      fetch('/api/admin/students/' + encodeURIComponent(data.code) + '?pw=' + encodeURIComponent(pw), {
        method: 'DELETE',
      })
        .then((r) => r.json())
        .then((r) => {
          if (!r.ok) { alert('Error: ' + (r.error || 'no se pudo borrar')); return; }
          $('m-detail').classList.add('hidden');
          $('m-roster').classList.remove('hidden');
          $('m-summary').classList.remove('hidden');
          fetchRoster();
        })
        .catch((e) => alert('Error: ' + e.message));
    });
    // Wire rename
    $('m-detail-rename-btn').addEventListener('click', () => {
      const cur = $('m-detail-name').textContent;
      const next = prompt('Nuevo nombre para este alumno/a:', cur);
      if (!next || next.trim() === '' || next === cur) return;
      fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/rename?pw=' + encodeURIComponent(pw), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: next.trim() }),
      })
        .then((r) => r.json())
        .then((r) => {
          if (!r.ok) { alert('Error: ' + (r.error || 'no se pudo')); return; }
          $('m-detail-name').textContent = r.displayName;
        });
    });
    // Wire send-message
    $('m-detail-send-btn').addEventListener('click', () => {
      const text = prompt(`Mensaje para ${data.displayName}:`, '');
      if (!text || !text.trim()) return;
      fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/message?pw=' + encodeURIComponent(pw), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
        .then((r) => r.json())
        .then((r) => {
          if (!r.ok) { alert('Error: ' + (r.error || 'no se pudo')); return; }
          alert('✓ Mensaje enviado a ' + data.displayName);
        });
    });
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
      return `<img class="m-avatar-img${cls}" src="/assets/avatars/${value}.svg?v=20260528b" alt="">`;
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
