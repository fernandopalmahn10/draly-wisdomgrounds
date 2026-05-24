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
  const PRESET_KEY = 'dralyWarmupPresets';

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
    // Preset save
    $('wu-save-preset').onclick = () => {
      if (!currentSentence.length) {
        alert('La oración está vacía. Construye algo antes de guardar.');
        return;
      }
      const name = prompt('Nombre para este preset:');
      if (!name || !name.trim()) return;
      const presets = loadPresets();
      presets.push({ name: name.trim(), sentence: currentSentence.slice(), ts: Date.now() });
      savePresets(presets);
      renderPresetSelect();
    };
    // Preset load (on change)
    $('wu-preset-select').onchange = (e) => {
      const i = Number(e.target.value);
      if (Number.isFinite(i) && i >= 0) {
        const presets = loadPresets();
        const p = presets[i];
        if (p && p.sentence) {
          socket.emit('wu:set-sentence', { pin, password: adminPw, sentence: p.sentence });
        }
      }
      e.target.value = '';   // reset so re-selecting the same preset works
    };
    // Modo Curioso toggle
    $('wu-curious-btn').onclick = () => {
      const next = !currentCurious;
      socket.emit('wu:set-curious', { pin, password: adminPw, curious: next });
    };
    // Preset delete
    $('wu-delete-preset').onclick = () => {
      const presets = loadPresets();
      if (!presets.length) return;
      // Use a simple prompt to pick by index
      const list = presets.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      const idx = prompt('¿Cuál borrar? Escribe el número:\n' + list);
      const i = Number(idx) - 1;
      if (Number.isFinite(i) && i >= 0 && i < presets.length) {
        presets.splice(i, 1);
        savePresets(presets);
        renderPresetSelect();
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
      // Pinyin word (tap to remove)
      const p = document.createElement('button');
      p.className = 'wu-stage-word' + (currentViewMode === 'picture' ? ' picture-only' : '');
      p.style.setProperty('--cat-color', color);
      const pic = showPic
        ? `<img class="wu-sw-pic" src="/assets/warmup/${w.id}.png" alt="${w.pinyin}"
              onerror="this.classList.add('missing')">`
        : '';
      const ic = showEmoji ? `<span class="wu-sw-icon">${w.icon || ''}</span>` : '';
      p.innerHTML = `${pic}${ic}
        <span class="wu-sw-pinyin">${w.pinyin}</span>
        <span class="wu-sw-hanzi">${w.hanzi}</span>`;
      p.title = 'Toca para quitar';
      p.onclick = () => {
        socket.emit('wu:remove-word', { pin, password: adminPw, index: i });
        if (MochiSounds.tap) MochiSounds.tap();
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

  // === Presets (localStorage) ===
  function loadPresets() {
    try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'); }
    catch { return []; }
  }
  function savePresets(presets) {
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(presets)); }
    catch (e) { console.warn('Failed to save presets', e); }
  }
  function renderPresetSelect() {
    const sel = $('wu-preset-select');
    if (!sel) return;
    const presets = loadPresets();
    sel.innerHTML = `<option value="">Cargar preset… (${presets.length})</option>`;
    presets.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i;
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
})();
