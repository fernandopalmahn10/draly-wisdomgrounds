// Warm-up · sentence-builder teacher tool — host page driver.
// The teacher authenticates with an admin password, then sees a word
// library + sentence stage. Every word tap mutates the live sentence on
// the server, which broadcasts to all player phones.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  let pin = null;
  let state = null;
  let adminPw = null;
  let activeCategory = 'all';

  // === ADMIN GATE ===
  $('admin-ok').addEventListener('click', tryAdmin);
  $('admin-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryAdmin(); });
  function tryAdmin() {
    const pw = $('admin-pw').value.trim();
    if (!pw) {
      $('admin-err').textContent = 'Escribe la contraseña';
      return;
    }
    adminPw = pw;
    // Defer real verification until the game is created — server checks pw
    // on every mutation. For UI flow, we accept the password locally and
    // let the first wu:auth callback confirm.
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

  // === LOBBY ===
  $('start-btn').addEventListener('click', () => {
    socket.emit('host:start', { pin });
  });

  // The countdown for warmup is brief — we go straight to the active sentence
  // builder UI as soon as host:start succeeds.
  socket.on('countdown', () => {
    setTimeout(() => {
      $('active-pin').textContent = pin;
      showScreen('active');
      renderLibrary();
      renderCatFilters();
      renderStage([]);   // empty stage to start
    }, 800);
  });

  // === ACTIVE controls ===
  $('exit-btn').addEventListener('click', () => {
    if (!confirm('¿Salir del calentamiento? Los alumnos volverán al lobby.')) return;
    socket.emit('host:end-now', { pin });
  });
  $('wu-clear-btn').addEventListener('click', () => {
    socket.emit('wu:clear', { pin, password: adminPw });
  });

  // === Sentence state synced from server ===
  socket.on('wu:state', ({ sentence }) => {
    renderStage(sentence || []);
  });

  socket.on('state', (s) => {
    state = s;
    if (s.state === 'lobby' && pin) {
      renderLobbyPlayers(s.players);
      // No "questions loaded" check — set-less
    }
  });

  socket.on('game-end', () => {
    showScreen('lobby');
  });

  // === Renderers ===
  function renderLobbyPlayers(playersMap) {
    const red = $('players-red');
    const gold = $('players-gold');
    if (!red || !gold) return;
    red.innerHTML = '';
    gold.innerHTML = '';
    Object.entries(playersMap || {}).forEach(([id, p]) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.innerHTML = `${p.avatar ? `<span class="chip-avatar">${p.avatar}</span>` : ''}<span>${escapeHtml(p.name)}</span>`;
      // Everyone goes into the red column for warmup (single class)
      red.appendChild(chip);
    });
  }

  function renderCatFilters() {
    const wrap = $('wu-cat-filters');
    if (!wrap) return;
    wrap.innerHTML = '';
    // "All" pill
    const all = document.createElement('button');
    all.className = 'wu-cat-pill active';
    all.dataset.cat = 'all';
    all.textContent = 'Todos';
    all.addEventListener('click', () => setActiveCat('all'));
    wrap.appendChild(all);
    Object.values(window.WU_CATEGORIES).forEach((c) => {
      const pill = document.createElement('button');
      pill.className = 'wu-cat-pill';
      pill.dataset.cat = c.id;
      pill.style.setProperty('--cat-color', c.color);
      pill.textContent = c.label;
      pill.addEventListener('click', () => setActiveCat(c.id));
      wrap.appendChild(pill);
    });
  }
  function setActiveCat(id) {
    activeCategory = id;
    document.querySelectorAll('.wu-cat-pill').forEach((p) => {
      p.classList.toggle('active', p.dataset.cat === id);
    });
    renderLibrary();
  }

  function renderLibrary() {
    const lib = $('wu-library');
    if (!lib) return;
    lib.innerHTML = '';
    // Group words by category for nice section headers
    const byCat = {};
    window.WU_WORDS.forEach((w) => {
      if (activeCategory !== 'all' && w.cat !== activeCategory) return;
      (byCat[w.cat] = byCat[w.cat] || []).push(w);
    });
    Object.keys(byCat).forEach((cat) => {
      const c = window.WU_CATEGORIES[cat];
      const section = document.createElement('div');
      section.className = 'wu-lib-section';
      section.innerHTML = `<div class="wu-lib-section-title" style="color:${c.color}; border-color:${c.color};">${c.label}</div>`;
      const grid = document.createElement('div');
      grid.className = 'wu-lib-grid';
      byCat[cat].forEach((w) => {
        const card = document.createElement('button');
        card.className = 'wu-lib-card';
        card.style.setProperty('--cat-color', c.color);
        card.innerHTML = `
          <span class="wu-lib-icon">${w.icon || ''}</span>
          <span class="wu-lib-pinyin">${w.pinyin}</span>
          <span class="wu-lib-hanzi">${w.hanzi}</span>
          <span class="wu-lib-es">${w.es}</span>`;
        card.addEventListener('click', () => {
          socket.emit('wu:add-word', { pin, password: adminPw, wordId: w.id });
          if (MochiSounds.tap) MochiSounds.tap();
        });
        grid.appendChild(card);
      });
      section.appendChild(grid);
      lib.appendChild(section);
    });
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
      const cat = window.WU_CATEGORIES[w.cat];
      const color = cat ? cat.color : '#fff';

      // Pinyin word card (tap to remove)
      const p = document.createElement('button');
      p.className = 'wu-stage-word';
      p.style.setProperty('--cat-color', color);
      p.innerHTML = `
        <span class="wu-sw-icon">${w.icon || ''}</span>
        <span class="wu-sw-pinyin">${w.pinyin}</span>
        <span class="wu-sw-hanzi">${w.hanzi}</span>`;
      p.title = 'Toca para quitar';
      p.addEventListener('click', () => {
        socket.emit('wu:remove-word', { pin, password: adminPw, index: i });
        if (MochiSounds.tap) MochiSounds.tap();
      });
      pinyinRow.appendChild(p);

      // Spanish word card — same color, locked aspect
      const e = document.createElement('div');
      e.className = 'wu-stage-es-word';
      e.style.setProperty('--cat-color', color);
      e.textContent = w.es;
      esRow.appendChild(e);
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
