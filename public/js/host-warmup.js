// Warm-up · sentence-builder teacher tool — host page driver.
// v2: organized by HSK1 experience (EXP1-EXP8), view-mode toggle (text/
// picture/both), and preset save/load via localStorage.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  let pin = null;
  let state = null;
  let adminPw = null;
  let activeExp = 'all';
  let currentViewMode = 'text';
  let currentSentence = [];
  let currentCurious = false;
  let currentDelegates = [];   // array of player names
  let currentPlayers = {};     // id -> { name, team, avatar }
  let serverPresets = [];      // canonical server-side preset list
  let rearrangeMode = false;   // when true, word-tap swaps instead of deletes
  let selectedSwapIdx = null;  // index of word selected for swapping
  const LEGACY_PRESET_KEY = 'dralyWarmupPresets';
  const MIGRATION_KEY = 'dralyWarmupPresetsMigrated';

  // === ADMIN GATE ===
  $('admin-ok').addEventListener('click', tryAdmin);
  $('admin-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryAdmin(); });
  function tryAdmin() {
    const pw = $('admin-pw').value.trim();
    if (!pw) { $('admin-err').textContent = 'Escribe la contraseña'; return; }
    adminPw = pw;
    $('admin-err').textContent = '';
    socket.emit('host:create', { gameType: 'warmup' }, ({ pin: p }) => {
      pin = p;
      $('pin-display').textContent = p;
      $('join-url').textContent = `${location.origin}/?pin=${p}`;
      socket.emit('wu:auth', { pin, password: adminPw }, (resp) => {
        if (resp && resp.ok) {
          showScreen('lobby');
          // Fetch server-side presets so the dropdown is ready immediately.
          // One-shot migration: if this laptop has presets in localStorage
          // that haven't been uploaded yet, push them all to the server.
          fetchServerPresets(() => migrateLegacyPresetsOnce());
        } else {
          $('admin-err').textContent = 'Contraseña incorrecta';
          adminPw = null;
        }
      });
    });
  }

  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  $('start-btn').addEventListener('click', () => socket.emit('host:start', { pin }));

  socket.on('countdown', () => {
    setTimeout(() => {
      $('active-pin').textContent = pin;
      showScreen('active');
      renderExpTabs();
      renderLibrary();
      renderStage([]);
      renderPresetSelect();
      bindToolbar();
    }, 600);
  });

  // === ACTIVE controls ===
  $('exit-btn').addEventListener('click', () => {
    if (!confirm('¿Salir del calentamiento?')) return;
    socket.emit('host:end-now', { pin });
  });
  $('wu-clear-btn').addEventListener('click', () => {
    socket.emit('wu:clear', { pin, password: adminPw });
  });
  $('wu-undo-btn').addEventListener('click', () => {
    socket.emit('wu:undo', { pin, password: adminPw });
    if (MochiSounds.tap) MochiSounds.tap();
  });
  $('wu-save-current-btn').addEventListener('click', () => {
    if (!currentSentence.length) {
      flashSaveFeedback(false, 'Oración vacía');
      return;
    }
    socket.emit('wu:save-current', { pin, password: adminPw });
    if (MochiSounds.correct) MochiSounds.correct();
  });
  // Server fires this after a save lands (or fails). Provides the visible
  // confirmation chip + button-green-flash that Rewards.show used to
  // provide before Rewards was disabled platform-wide.
  socket.on('wu:saved', (data) => {
    if (data && data.ok) {
      const c = data.contributors || 1;
      const w = data.words || 0;
      const noun = c === 1 ? 'historial' : `${c} historiales`;
      flashSaveFeedback(true, `Guardada · ${w} palabra${w === 1 ? '' : 's'} en ${noun}`);
    } else {
      flashSaveFeedback(false, 'No se pudo guardar — oración vacía');
    }
  });
  // Tiny inline feedback helper: flashes the Save button green/red and
  // pops a chip next to it with text for ~1.6s. Auto-cleans up.
  function flashSaveFeedback(ok, text) {
    const btn = $('wu-save-current-btn');
    if (btn) {
      btn.classList.remove('wu-save-flash-ok', 'wu-save-flash-err');
      void btn.offsetWidth;
      btn.classList.add(ok ? 'wu-save-flash-ok' : 'wu-save-flash-err');
      setTimeout(() => btn.classList.remove('wu-save-flash-ok', 'wu-save-flash-err'), 1700);
    }
    // Show or update the chip
    let chip = document.getElementById('wu-save-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'wu-save-chip';
      chip.className = 'wu-save-chip';
      // Attach near the save button so it floats above it
      const parent = btn && btn.parentNode ? btn.parentNode : document.body;
      parent.appendChild(chip);
    }
    chip.textContent = (ok ? '✓ ' : '✕ ') + text;
    chip.classList.remove('wu-save-chip-ok', 'wu-save-chip-err', 'show');
    chip.classList.add(ok ? 'wu-save-chip-ok' : 'wu-save-chip-err');
    void chip.offsetWidth;
    chip.classList.add('show');
    clearTimeout(chip._hideT);
    chip._hideT = setTimeout(() => { chip.classList.remove('show'); }, 1800);
  }
  $('wu-rearrange-btn').addEventListener('click', () => {
    rearrangeMode = !rearrangeMode;
    selectedSwapIdx = null;
    const btn = $('wu-rearrange-btn');
    if (btn) {
      btn.classList.toggle('active', rearrangeMode);
      btn.textContent = rearrangeMode ? '✏️ Salir' : '🔀 Rearreglar';
    }
    renderStage(currentSentence);
  });

  function bindToolbar() {
    // View-mode buttons
    document.querySelectorAll('.wu-vm-btn').forEach((btn) => {
      btn.onclick = () => {
        const mode = btn.dataset.mode;
        currentViewMode = mode;
        document.querySelectorAll('.wu-vm-btn').forEach((b) => b.classList.toggle('active', b === btn));
        socket.emit('wu:set-view-mode', { pin, password: adminPw, mode });
        // Re-render locally so the host sees the change instantly
        renderStage(currentSentence);
      };
    });
    // Preset save (server-side now — follows the teacher across devices)
    $('wu-save-preset').onclick = () => {
      if (!currentSentence.length) {
        alert('La oración está vacía. Construye algo antes de guardar.');
        return;
      }
      const name = prompt('Nombre para este preset:');
      if (!name || !name.trim()) return;
      socket.emit('wu:presets-save', {
        pin, password: adminPw, name: name.trim(), sentence: currentSentence.slice(),
      }, (resp) => {
        if (resp && resp.ok) {
          serverPresets = resp.presets || [];
          renderPresetSelect();
        } else {
          alert('No se pudo guardar: ' + ((resp && resp.error) || 'error'));
        }
      });
    };
    // Preset load (on change) — server-side lookup by id
    $('wu-preset-select').onchange = (e) => {
      const id = String(e.target.value || '');
      if (id) {
        const p = serverPresets.find((x) => String(x.id) === id);
        if (p && p.sentence) {
          socket.emit('wu:set-sentence', { pin, password: adminPw, sentence: p.sentence });
        }
      }
      e.target.value = '';
    };
    // Modo Curioso toggle
    $('wu-curious-btn').onclick = () => {
      const next = !currentCurious;
      socket.emit('wu:set-curious', { pin, password: adminPw, curious: next });
    };
    // Preset delete — server-side by id
    $('wu-delete-preset').onclick = () => {
      if (!serverPresets.length) return;
      const list = serverPresets.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      const idx = prompt('¿Cuál borrar? Escribe el número:\n' + list);
      const i = Number(idx) - 1;
      if (Number.isFinite(i) && i >= 0 && i < serverPresets.length) {
        const id = serverPresets[i].id;
        socket.emit('wu:presets-delete', { pin, password: adminPw, id }, (resp) => {
          if (resp && resp.ok) {
            serverPresets = resp.presets || [];
            renderPresetSelect();
          }
        });
      }
    };
  }

  // === Server sync ===
  socket.on('wu:state', ({ sentence, viewMode, curious, delegates }) => {
    currentSentence = sentence || [];
    if (viewMode) {
      currentViewMode = viewMode;
      document.querySelectorAll('.wu-vm-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === viewMode);
      });
    }
    currentCurious = !!curious;
    currentDelegates = Array.isArray(delegates) ? delegates : [];
    const btn = $('wu-curious-btn');
    if (btn) {
      btn.classList.toggle('active', currentCurious);
      btn.textContent = currentCurious ? '🔍 Desactivar Modo Curioso' : '🔍 Activar Modo Curioso';
    }
    const hint = $('wu-curious-hint');
    if (hint) {
      hint.textContent = currentCurious
        ? '✅ Activo — los alumnos pueden tocar palabras y ver tarjetas tipo Pokédex.'
        : 'Cuando esté activo, los alumnos podrán tocar cualquier palabra para ver detalles.';
    }
    renderStage(currentSentence);
    renderRoster();
  });
  socket.on('state', (s) => {
    state = s;
    if (s.players) currentPlayers = s.players;
    if (s.state === 'lobby' && pin) renderLobbyPlayers(s.players);
    if (s.state === 'active' && pin) renderRoster();
  });
  socket.on('game-end', () => showScreen('lobby'));

  // === Renderers ===
  function renderLobbyPlayers(playersMap) {
    const red = $('players-red');
    if (!red) return;
    red.innerHTML = '';
    Object.entries(playersMap || {}).forEach(([id, p]) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `${p.avatar ? `<span class="chip-avatar">${p.avatar}</span>` : ''}<span>${escapeHtml(p.name)}</span>`;
      red.appendChild(chip);
    });
  }

  function renderExpTabs() {
    const wrap = $('wu-exp-tabs');
    if (!wrap) return;
    wrap.innerHTML = '';
    // "Todos" + each EXP
    const all = document.createElement('button');
    all.className = 'wu-exp-tab active';
    all.dataset.exp = 'all';
    all.textContent = 'Todos';
    all.onclick = () => setActiveExp('all');
    wrap.appendChild(all);
    Object.values(window.WU_EXPERIENCES).forEach((e) => {
      const tab = document.createElement('button');
      tab.className = 'wu-exp-tab';
      tab.dataset.exp = e.id;
      tab.textContent = e.short;
      tab.onclick = () => setActiveExp(e.id);
      wrap.appendChild(tab);
    });
  }
  function setActiveExp(id) {
    activeExp = id;
    document.querySelectorAll('.wu-exp-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.exp === id);
    });
    renderLibrary();
  }

  function renderLibrary() {
    const lib = $('wu-library');
    if (!lib) return;
    lib.innerHTML = '';
    const byExp = {};
    window.WU_WORDS.forEach((w) => {
      if (activeExp !== 'all' && w.exp !== activeExp) return;
      (byExp[w.exp] = byExp[w.exp] || []).push(w);
    });
    Object.keys(byExp).forEach((expId) => {
      const exp = window.WU_EXPERIENCES[expId];
      const section = document.createElement('div');
      section.className = 'wu-lib-section';
      section.innerHTML = `<div class="wu-lib-section-title">${exp ? exp.label : expId}</div>`;
      const grid = document.createElement('div');
      grid.className = 'wu-lib-grid';
      byExp[expId].forEach((w) => {
        const cat = window.WU_CATEGORIES[w.cat] || { color: '#aaa' };
        const card = document.createElement('button');
        card.className = 'wu-lib-card';
        card.style.setProperty('--cat-color', cat.color);
        card.innerHTML = renderLibCardContent(w, cat);
        card.onclick = () => {
          socket.emit('wu:add-word', { pin, password: adminPw, wordId: w.id });
          if (MochiSounds.tap) MochiSounds.tap();
        };
        grid.appendChild(card);
      });
      section.appendChild(grid);
      lib.appendChild(section);
    });
  }

  // Each library card always shows: pinyin + hanzi + Spanish. Icon depends
  // on view-mode setting (so the teacher previews how it'll appear).
  function renderLibCardContent(w, cat) {
    // Picture mode: try to load /assets/warmup/<id>.png. onerror falls back to emoji.
    const showPic = (currentViewMode === 'picture' || currentViewMode === 'both');
    const showEmoji = (currentViewMode === 'text' || currentViewMode === 'both');
    const pic = showPic
      ? `<img class="wu-lib-pic" src="/assets/warmup/${w.id}.png" alt="${w.pinyin}"
            onerror="this.classList.add('missing')">`
      : '';
    const ic = showEmoji
      ? `<span class="wu-lib-icon">${w.icon || ''}</span>`
      : '';
    return `${pic}${ic}
      <span class="wu-lib-pinyin">${w.pinyin}</span>
      <span class="wu-lib-hanzi">${w.hanzi}</span>
      <span class="wu-lib-es">${w.es}</span>`;
  }

  function renderStage(sentence) {
    const pinyinRow = $('wu-stage-pinyin');
    const esRow     = $('wu-stage-es');
    const empty     = $('wu-stage-empty');
    if (!pinyinRow || !esRow) return;
    pinyinRow.innerHTML = '';
    esRow.innerHTML = '';
    if (!sentence.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    sentence.forEach((wid, i) => {
      const w = window.WU_WORD_BY_ID[wid];
      if (!w) return;
      const cat = window.WU_CATEGORIES[w.cat] || { color: '#fff' };
      const color = cat.color;
      const showPic = (currentViewMode === 'picture' || currentViewMode === 'both');
      const showEmoji = (currentViewMode === 'text' || currentViewMode === 'both');
      // Pinyin word — tap behavior depends on rearrangeMode:
      //   normal:    tap → remove
      //   rearrange: tap → select; second tap → swap with selected
      const p = document.createElement('button');
      p.className = 'wu-stage-word'
        + (currentViewMode === 'picture' ? ' picture-only' : '')
        + (rearrangeMode ? ' rearrange-mode' : '')
        + (selectedSwapIdx === i ? ' swap-selected' : '');
      p.style.setProperty('--cat-color', color);
      const pic = showPic
        ? `<img class="wu-sw-pic" src="/assets/warmup/${w.id}.png" alt="${w.pinyin}"
              onerror="this.classList.add('missing')">`
        : '';
      const ic = showEmoji ? `<span class="wu-sw-icon">${w.icon || ''}</span>` : '';
      p.innerHTML = `${pic}${ic}
        <span class="wu-sw-pinyin">${w.pinyin}</span>
        <span class="wu-sw-hanzi">${w.hanzi}</span>`;
      p.title = rearrangeMode ? 'Toca dos palabras para intercambiar' : 'Toca para quitar';
      p.onclick = () => {
        if (rearrangeMode) {
          if (selectedSwapIdx === null) {
            selectedSwapIdx = i;
            renderStage(currentSentence);
            if (MochiSounds.tap) MochiSounds.tap();
          } else if (selectedSwapIdx === i) {
            selectedSwapIdx = null;
            renderStage(currentSentence);
          } else {
            socket.emit('wu:swap-words', {
              pin, password: adminPw,
              fromIndex: selectedSwapIdx, toIndex: i,
            });
            selectedSwapIdx = null;
            if (MochiSounds.swap) MochiSounds.swap();
          }
        } else {
          socket.emit('wu:remove-word', { pin, password: adminPw, index: i });
          if (MochiSounds.tap) MochiSounds.tap();
        }
      };
      pinyinRow.appendChild(p);

      // Spanish word — same color, matches order
      const e = document.createElement('div');
      e.className = 'wu-stage-es-word';
      e.style.setProperty('--cat-color', color);
      e.textContent = w.es;
      esRow.appendChild(e);
    });
  }

  // === Live student roster — only renders during the active screen.
  // Each row shows the student's avatar + name + a 👑/🚫 button to
  // grant or revoke "asistente" admin powers. Current delegates are
  // visually highlighted.
  function renderRoster() {
    const list = $('wu-roster-list');
    if (!list) return;
    const ids = Object.keys(currentPlayers || {});
    if (!ids.length) {
      list.innerHTML = '<div class="wu-roster-empty">Esperando alumnos…</div>';
      return;
    }
    list.innerHTML = '';
    ids.forEach((id) => {
      const p = currentPlayers[id];
      if (!p || !p.name) return;
      const isDelegate = currentDelegates.indexOf(p.name) >= 0;
      const row = document.createElement('div');
      row.className = 'wu-roster-row' + (isDelegate ? ' is-delegate' : '');
      row.innerHTML = `
        <span class="wu-roster-avatar">${p.avatar || '🎓'}</span>
        <span class="wu-roster-name">${escapeHtml(p.name)}</span>
        <button class="wu-roster-btn ${isDelegate ? 'revoke' : 'grant'}" type="button">
          ${isDelegate ? '🚫 Quitar' : '👑 Asistente'}
        </button>`;
      const btn = row.querySelector('.wu-roster-btn');
      btn.onclick = () => {
        if (isDelegate) {
          socket.emit('wu:delegate-revoke', { pin, password: adminPw, playerName: p.name });
        } else {
          socket.emit('wu:delegate-grant',  { pin, password: adminPw, playerName: p.name });
        }
        if (MochiSounds.swap) MochiSounds.swap();
      };
      list.appendChild(row);
    });
    // Update the sub-hint
    const sub = $('wu-roster-sub');
    if (sub) {
      sub.textContent = currentDelegates.length
        ? `${currentDelegates.length} asistente${currentDelegates.length > 1 ? 's' : ''} activo${currentDelegates.length > 1 ? 's' : ''}: ${currentDelegates.join(', ')}`
        : 'Toca un alumno para darle el control del catálogo';
    }
  }

  // === Presets (server-side; cross-device) ===
  function fetchServerPresets(cb) {
    socket.emit('wu:presets-list', { pin, password: adminPw }, (resp) => {
      if (resp && resp.ok) serverPresets = resp.presets || [];
      renderPresetSelect();
      if (typeof cb === 'function') cb();
    });
  }
  // One-shot localStorage → server migration. Runs ONCE per laptop so
  // teachers who already saved presets locally don't lose them when we
  // move storage server-side.
  function migrateLegacyPresetsOnce() {
    try {
      if (localStorage.getItem(MIGRATION_KEY) === '1') return;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_PRESET_KEY) || '[]');
      if (!Array.isArray(legacy) || legacy.length === 0) {
        localStorage.setItem(MIGRATION_KEY, '1');
        return;
      }
      console.log('[presets] migrating', legacy.length, 'legacy presets to server');
      let remaining = legacy.length;
      legacy.forEach((p) => {
        if (!p || !p.name || !Array.isArray(p.sentence)) {
          if (--remaining === 0) finalize();
          return;
        }
        socket.emit('wu:presets-save', {
          pin, password: adminPw, name: '[mig] ' + p.name, sentence: p.sentence,
        }, () => {
          if (--remaining === 0) finalize();
        });
      });
      function finalize() {
        localStorage.setItem(MIGRATION_KEY, '1');
        fetchServerPresets();
      }
    } catch (e) {
      console.warn('[presets] migration failed:', e);
    }
  }
  function renderPresetSelect() {
    const sel = $('wu-preset-select');
    if (!sel) return;
    sel.innerHTML = `<option value="">Cargar preset… (${serverPresets.length})</option>`;
    serverPresets.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${i + 1}. ${p.name}`;
      sel.appendChild(opt);
    });
  }

  function showScreen(name) {
    ['admin-gate', 'lobby', 'active'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Avatars in the Cuaderno can be stored as either:
  //  - new SVG name ('mochi', 'robo', 'alien', etc.) — use <img>
  //  - legacy emoji ('🧒🏼') — render the emoji
  //  - null/undefined — fallback emoji
  // This helper picks the right rendering.
  function renderAvatarChip(value) {
    if (typeof value === 'string' && /^[a-z]+$/.test(value)) {
      return `<img class="wu-nb-avatar-img" src="/assets/avatars/${value}.svg" alt="${escapeHtml(value)}" draggable="false">`;
    }
    return `<span class="wu-nb-avatar-emoji">${escapeHtml(value || '🧒🏼')}</span>`;
  }

  // === CUADERNO DE ALUMNOS ============================================
  // Teacher-only window into every student's saved-sentence history.
  // Hits the admin REST endpoints with the password the teacher unlocked
  // the maestro mode with (adminPw). Two views: roster (list of all
  // students with their code + name + sentence count) and detail (one
  // student's full sentence history).
  const notebookBtn   = $('wu-notebook-btn');
  const notebookOL    = $('wu-notebook-overlay');
  const notebookClose = $('wu-notebook-close');
  const notebookBack  = $('wu-notebook-back');
  const notebookRoster = $('wu-notebook-roster');
  const notebookDetail = $('wu-notebook-detail');
  const notebookSub   = $('wu-notebook-sub');
  if (notebookBtn) notebookBtn.addEventListener('click', openNotebook);
  if (notebookClose) notebookClose.addEventListener('click', closeNotebook);
  if (notebookBack) notebookBack.addEventListener('click', showRosterView);
  // Click on the overlay backdrop (but not the card) closes the panel.
  if (notebookOL) notebookOL.addEventListener('click', (e) => {
    if (e.target === notebookOL) closeNotebook();
  });

  function openNotebook() {
    if (!notebookOL) return;
    notebookOL.classList.remove('hidden');
    showRosterView();
    fetchRoster();
  }
  function closeNotebook() {
    if (!notebookOL) return;
    notebookOL.classList.add('hidden');
  }
  function showRosterView() {
    if (notebookRoster) notebookRoster.classList.remove('hidden');
    if (notebookDetail) notebookDetail.classList.add('hidden');
  }
  function showDetailView() {
    if (notebookRoster) notebookRoster.classList.add('hidden');
    if (notebookDetail) notebookDetail.classList.remove('hidden');
  }
  function fetchRoster() {
    if (!adminPw) {
      notebookSub.textContent = 'Sesión sin contraseña — vuelve a iniciar.';
      return;
    }
    notebookSub.textContent = 'Cargando…';
    notebookRoster.innerHTML = '';
    fetch('/api/admin/students?pw=' + encodeURIComponent(adminPw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          notebookSub.textContent = 'No se pudo cargar la lista.';
          return;
        }
        // Show every student that has ANY activity (sentences, tests, or
        // assignments). Filter is union of the three counters.
        const students = (data.students || []).filter((s) =>
          (s.sentenceCount > 0) || (s.testCount > 0) || (s.assignmentCount > 0)
        );
        notebookSub.textContent = `${students.length} alumno${students.length === 1 ? '' : 's'} con actividad`;
        if (!students.length) {
          notebookRoster.innerHTML = '<div class="wu-notebook-empty">Aún nadie tiene actividad registrada. Cuando un alumno guarde una oración, haga un examen o entregue una tarea, aparecerá aquí.</div>';
          return;
        }
        // Class summary header — quick glance: how many kids did X, Y, Z
        // (user feedback 2026-05-27: "give me a UI in which I can see
        // how everybody is doing on the lecture and on the assignments")
        const totals = students.reduce((acc, s) => {
          acc.sent  += s.sentenceCount    || 0;
          acc.asg   += s.assignmentCount  || 0;
          acc.tests += s.testCount        || 0;
          if (s.sentenceCount > 0)   acc.activeSent++;
          if (s.assignmentCount > 0) acc.activeAsg++;
          if (s.testCount > 0)       acc.activeTests++;
          return acc;
        }, { sent: 0, asg: 0, tests: 0, activeSent: 0, activeAsg: 0, activeTests: 0 });
        const summary = document.createElement('div');
        summary.className = 'wu-nb-class-summary';
        summary.innerHTML = `
          <div class="wu-nb-class-summary-title">📊 Resumen de la clase</div>
          <div class="wu-nb-class-summary-grid">
            <div class="wu-nb-class-stat">
              <div class="wu-nb-class-stat-num">${totals.activeAsg}/${students.length}</div>
              <div class="wu-nb-class-stat-label">📚 Han entregado tareas</div>
              <div class="wu-nb-class-stat-detail">${totals.asg} entregas en total</div>
            </div>
            <div class="wu-nb-class-stat">
              <div class="wu-nb-class-stat-num">${totals.activeTests}/${students.length}</div>
              <div class="wu-nb-class-stat-label">🏆 Han hecho exámenes</div>
              <div class="wu-nb-class-stat-detail">${totals.tests} intentos en total</div>
            </div>
            <div class="wu-nb-class-stat">
              <div class="wu-nb-class-stat-num">${totals.activeSent}/${students.length}</div>
              <div class="wu-nb-class-stat-label">📝 Han escrito oraciones</div>
              <div class="wu-nb-class-stat-detail">${totals.sent} oraciones en total</div>
            </div>
          </div>`;
        notebookRoster.appendChild(summary);

        students.forEach((s) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'wu-notebook-row-btn';
          const since = s.lastSeen ? new Date(s.lastSeen).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—';
          const avatarHtml = renderAvatarChip(s.avatar);
          row.innerHTML = `
            <span class="wu-nb-row-avatar">${avatarHtml}</span>
            <span class="wu-nb-code">${escapeHtml(s.code)}</span>
            <span class="wu-nb-name">${escapeHtml(s.displayName || 'Anon')}</span>
            <span class="wu-nb-row-counts">
              <span class="wu-nb-row-c" title="Oraciones">📝${s.sentenceCount}</span>
              <span class="wu-nb-row-c" title="Tareas entregadas">📚${s.assignmentCount}</span>
              <span class="wu-nb-row-c" title="Exámenes de lectura">🏆${s.testCount}</span>
            </span>
            <span class="wu-nb-date">${since}</span>`;
          row.addEventListener('click', () => fetchStudent(s.code));
          notebookRoster.appendChild(row);
        });
      })
      .catch((e) => {
        notebookSub.textContent = 'Error: ' + e.message;
      });
  }
  function fetchStudent(code) {
    if (!adminPw) return;
    notebookSub.textContent = 'Cargando ' + code + '…';
    fetch('/api/admin/students/' + encodeURIComponent(code) + '?pw=' + encodeURIComponent(adminPw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          notebookSub.textContent = 'No se encontró ese alumno.';
          return;
        }
        showDetailView();
        const head = $('wu-notebook-detail-head');
        const list = $('wu-notebook-detail-list');
        const since = data.firstSeen ? new Date(data.firstSeen).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        const tests = data.tests || [];
        const assigns = data.assignments || [];
        head.innerHTML = `
          <div class="wu-nb-head-row">
            <span class="wu-nb-head-avatar">${renderAvatarChip(data.avatar)}</span>
            <span class="wu-nb-head-code">📇 ${escapeHtml(data.code)}</span>
            <span class="wu-nb-head-name">${escapeHtml(data.displayName || 'Anon')}</span>
          </div>
          <div class="wu-nb-head-meta">
            Desde ${since} ·
            📝 ${data.sentences.length} oración${data.sentences.length === 1 ? '' : 'es'} ·
            📚 ${assigns.length} tarea${assigns.length === 1 ? '' : 's'} ·
            🏆 ${tests.length} examen${tests.length === 1 ? '' : 'es'}
          </div>`;
        notebookSub.textContent = '';
        list.innerHTML = '';

        // === ASSIGNMENTS section ===
        if (assigns.length) {
          const h = document.createElement('div');
          h.className = 'wu-nb-section-title';
          h.textContent = '📚 Tareas entregadas';
          list.appendChild(h);
          assigns.slice(0, 20).forEach((s) => {
            const row = document.createElement('div');
            const pct = s.total ? Math.round((s.score / s.total) * 100) : 0;
            row.className = 'wu-nb-asg-row ' + (pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low');
            const dateStr = new Date(s.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            row.innerHTML = `
              <span class="wu-nb-asg-title">${escapeHtml(s.assignmentTitle || s.assignmentId)}</span>
              <span class="wu-nb-asg-score">${s.score}/${s.total} <small>(${pct}%)</small></span>
              <span class="wu-nb-asg-date">${dateStr}</span>`;
            list.appendChild(row);
          });
        }

        // === READING-MODE TESTS section ===
        if (tests.length) {
          const h = document.createElement('div');
          h.className = 'wu-nb-section-title';
          h.textContent = '🏆 Exámenes de lectura';
          list.appendChild(h);
          tests.slice(0, 20).forEach((t) => {
            const row = document.createElement('div');
            const pct = Math.round((t.score / 100) * 100);
            row.className = 'wu-nb-test-row ' + (pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low');
            const dateStr = new Date(t.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            row.innerHTML = `
              <span class="wu-nb-test-story">📖 ${escapeHtml(t.storyTitle || t.storyId)}</span>
              <span class="wu-nb-test-score">${t.score}/100</span>
              <span class="wu-nb-test-date">${dateStr}</span>`;
            list.appendChild(row);
          });
        }

        // === SENTENCES (warmup) section ===
        if (data.sentences.length) {
          const h = document.createElement('div');
          h.className = 'wu-nb-section-title';
          h.textContent = '✏️ Oraciones construidas';
          list.appendChild(h);
          data.sentences.forEach((s) => {
            const item = document.createElement('div');
            item.className = 'wu-notebook-sentence';
            const dateStr = new Date(s.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
            const wordsHtml = (s.words || []).map((wid) => {
              const w = window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid];
              if (!w) return '';
              const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
              const color = cat ? cat.color : '#fff';
              return `<span class="wu-nb-word" style="--cat-color:${color};">
                <span class="wu-nb-icon">${w.icon || ''}</span>
                <span class="wu-nb-pinyin">${escapeHtml(w.pinyin || '')}</span>
                <span class="wu-nb-es">${escapeHtml(w.es || '')}</span>
              </span>`;
            }).join('');
            item.innerHTML = `
              <div class="wu-nb-sentence-meta">📅 ${dateStr}</div>
              <div class="wu-nb-sentence-words">${wordsHtml}</div>`;
            list.appendChild(item);
          });
        }

        if (!assigns.length && !tests.length && !data.sentences.length) {
          list.innerHTML = '<div class="wu-notebook-empty">Este alumno aún no tiene actividad registrada.</div>';
        }
      })
      .catch((e) => {
        notebookSub.textContent = 'Error: ' + e.message;
      });
  }
})();
