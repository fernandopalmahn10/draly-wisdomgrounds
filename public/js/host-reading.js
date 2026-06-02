// 📖 Reading — host driver
// Teacher-driven story session. The teacher controls page nav + audio
// playback; every student phone mirrors in real time. Pinyin only (no
// hanzi). Words light up karaoke-style as the audio plays.
(function () {
  const socket = io();
  let pin = null;
  let adminPw = null;
  let story = null;          // { title, subtitle, pages: [...] }
  let currentPageIdx = 0;
  let isPlaying = false;
  let serverPlayStartedAt = 0;  // wall clock when server started playback
  let serverAudioPosMs    = 0;  // snapshot audio position at that wall clock
  let serverOffsetMs      = 0;  // (clientNow - serverNow) — drift adjustment
  let highlightRafId      = null;
  let currentLanguage     = 'pinyin';   // 'pinyin' | 'es'
  let currentCurious      = false;
  let currentStoryId      = null;
  let storyListRendered   = false;
  let lastStoryPayload    = null;  // 🎵 holds the latest reading-state payload
                                   // so the Start button can read state.music
                                   // and trigger the right themed track.

  // 🎵 Per-story music swap. Tracks the last theme we started so we
  // don't restart the same theme repeatedly on every state push. User
  // feedback 2026-06-03: "I'm so sick and tired of that song" — we
  // were never stopping the lobby music, so the same track played
  // forever. Now: every story switch swaps theme. First story start
  // also kills any music that was playing before host-reading loaded.
  let _currentMusicTheme = null;
  function maybeSwapMusic(themeName) {
    if (!window.MochiSounds) return;
    if (!themeName) return;
    if (themeName === _currentMusicTheme) return;  // already on it
    try {
      if (MochiSounds.startGameTheme) {
        MochiSounds.startGameTheme(themeName);   // this calls stopMusic() first internally
        _currentMusicTheme = themeName;
      }
    } catch (_) {}
  }

  // 🎨 Apply per-story theme — sets CSS variables on the body so the
  // lobby gradient + accent colors swap to match the story's mood.
  // Pīnpīn → default teal. Yugi → purple/gold pharaoh. Future stories
  // each ship their own palette in core/reading-story.js.
  function applyStoryTheme(theme) {
    const body = document.body;
    if (!theme) {
      // Reset to defaults if a story without a theme loads.
      body.style.removeProperty('--story-primary');
      body.style.removeProperty('--story-accent');
      body.style.removeProperty('--story-bg');
      body.style.removeProperty('background');
      return;
    }
    if (theme.primary) body.style.setProperty('--story-primary', theme.primary);
    if (theme.accent)  body.style.setProperty('--story-accent',  theme.accent);
    if (theme.bgGrad) {
      body.style.setProperty('--story-bg', theme.bgGrad);
      // Apply directly to body so the whole page swaps mood.
      body.style.background = theme.bgGrad;
      body.style.transition = 'background 0.6s ease';
    }
  }
  let currentPlaybackRate = 1.0;
  let testTimerInt        = null;     // ticks the per-question countdown
  let currentTestQIdx     = -1;       // 0-based; -1 when no test active

  const $ = (id) => document.getElementById(id);
  $('mute-btn').addEventListener('click', () => {
    const muted = window.toggleMute();
    $('mute-btn').textContent = muted ? '🔇 Off' : '🔊 On';
  });
  document.addEventListener('click', () => window.unlockAudio && window.unlockAudio(), { once: true });

  // === ADMIN GATE ===
  $('admin-ok').addEventListener('click', tryAdmin);
  $('admin-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryAdmin(); });
  function tryAdmin() {
    const pw = $('admin-pw').value.trim();
    if (!pw) { $('admin-err').textContent = 'Escribe la contraseña'; return; }
    adminPw = pw;
    $('admin-err').textContent = '';
    socket.emit('host:create', { gameType: 'reading' }, ({ pin: p }) => {
      pin = p;
      $('pin-display').textContent = p;
      if ($('active-pin')) $('active-pin').textContent = p;
      $('join-url').textContent = `${location.origin}/?pin=${p}`;
      document.title = `📖 Lectura · ${p}`;
      socket.emit('rd:auth', { pin, password: adminPw }, (resp) => {
        if (resp && resp.ok) {
          showScreen('lobby');
          // 🎯 FORCE-IMPOSE: if maestro passed ?forceCodes=, push the
          // PIN into each selected student's inbox as a force-takeover
          // message. They'll auto-redirect into this room within ~20s.
          try {
            const params = new URLSearchParams(location.search);
            const forceList = (params.get('forceCodes') || '')
              .split(',').map((s) => s.trim()).filter(Boolean);
            const storyId = params.get('story') || '';
            if (forceList.length && pin) {
              fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(adminPw), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  studentCodes: forceList,
                  text: '¡Tu maestra te invita a una lectura en vivo!',
                  actionType: 'force',
                  actionUrl: '/player.html?pin=' + pin + '&autojoin=1',
                  actionLabel: '📖 Unirme a la lectura',
                }),
              }).then((r) => r.json()).then((d) => {
                if (d && d.ok) {
                  console.log('[force-reading] invited ' + d.sent + ' students');
                  // Surface a small confirmation in the host UI
                  const note = document.createElement('div');
                  note.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#5be8d1;color:#1a1a26;padding:10px 18px;border-radius:999px;font-weight:900;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
                  note.textContent = '🎯 Forzando a ' + d.sent + ' alumno' + (d.sent === 1 ? '' : 's') + ' — entran en ~20 seg';
                  document.body.appendChild(note);
                  setTimeout(() => { try { note.remove(); } catch (_) {} }, 6000);
                }
              }).catch(() => {});
            }
          } catch (_) {}
        } else {
          $('admin-err').textContent = 'Contraseña incorrecta';
          adminPw = null;
        }
      });
    });
  }

  // 🎬 ANIMACIONES — searchable library of broadcastable animations.
  // Each entry { id, name, tags, url } is a transparent GIF (kept small,
  // ~1 MB target) that can be projected full-screen on host + every kid
  // phone in the room. Tap to project, tap again to hide. The 'fx' id
  // becomes the socket payload so player.js renders the right asset.
  //
  // To add more: drop the GIF into public/assets/png-library/ and add
  // an entry to the ANIMATIONS array below.
  const ANIMATIONS = [
    // 👁 Gojo (transparent GIF, ~2 MB) — first/featured slot. User
    // requested this replace the "guy from the beginning" of the
    // animation bank.
    {
      id: 'gojo',
      name: 'Gojo (Jujutsu)',
      tags: 'gojo satoru jujutsu kaisen jjk anime sensei limitless infinity blue purple six eyes',
      url: '/assets/png-library/GOJO%20TRANSPARENT.gif',
    },
    {
      id: 'turtle',
      name: 'Squirtle dancing',
      tags: 'squirtle turtle pinpin water dance dancing tortuga',
      url: '/assets/png-library/Squirtle%20animation.gif',
    },
    // 🆕 Add new animations here as the user drops more transparent GIFs.
    // Keep each under 1.5 MB to respect Render bandwidth. (Gojo's GIF
    // is ~2 MB — only ship it when the teacher actively triggers it.)
  ];
  let _animCurrentFx = null;   // which animation is currently broadcasting
  function showAnimOverlay(fxId) {
    hideAnimOverlay();   // single overlay at a time
    const anim = ANIMATIONS.find((a) => a.id === fxId);
    if (!anim) return;
    const ov = document.createElement('div');
    ov.id = 'rd-turtle-overlay';
    ov.className = 'rd-turtle-overlay';
    ov.innerHTML = '<img src="' + anim.url + '" alt="' + escapeHtml(anim.name) + '">';
    ov.addEventListener('click', () => {
      // Tap overlay → broadcast OFF (everywhere)
      _animCurrentFx = null;
      socket.emit('rd:vfx', { pin, password: adminPw, fx: fxId, on: false });
      hideAnimOverlay();
    });
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
  }
  function hideAnimOverlay() {
    const ov = document.getElementById('rd-turtle-overlay');
    if (!ov) return;
    ov.classList.remove('show');
    setTimeout(() => { try { ov.remove(); } catch (_) {} }, 250);
  }
  // Build + open the modal (lazy: only renders thumbnails on first open).
  let _animModalBuilt = false;
  function openAnimModal() {
    const modal = $('rd-anim-modal');
    if (!modal) return;
    if (!_animModalBuilt) {
      const grid = $('rd-anim-grid');
      grid.innerHTML = '';
      ANIMATIONS.forEach((a) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'rd-anim-tile';
        card.dataset.fxId = a.id;
        card.dataset.searchHaystack = (a.name + ' ' + (a.tags || '')).toLowerCase();
        card.innerHTML =
          '<div class="rd-anim-tile-thumb" style="background-image:url(\'' + a.url + '\');"></div>' +
          '<div class="rd-anim-tile-name">' + escapeHtml(a.name) + '</div>';
        card.addEventListener('click', () => {
          // Toggle: if same fx already on → off. Else switch to this one.
          if (_animCurrentFx === a.id) {
            _animCurrentFx = null;
            socket.emit('rd:vfx', { pin, password: adminPw, fx: a.id, on: false });
            hideAnimOverlay();
          } else {
            _animCurrentFx = a.id;
            socket.emit('rd:vfx', { pin, password: adminPw, fx: a.id, on: true });
            showAnimOverlay(a.id);
          }
          modal.classList.add('hidden');
        });
        grid.appendChild(card);
      });
      // Search filter
      const search = $('rd-anim-search');
      if (search) {
        search.addEventListener('input', () => {
          const q = search.value.trim().toLowerCase();
          grid.querySelectorAll('.rd-anim-tile').forEach((tile) => {
            const matches = !q || (tile.dataset.searchHaystack || '').includes(q);
            tile.style.display = matches ? '' : 'none';
          });
        });
      }
      _animModalBuilt = true;
    }
    modal.classList.remove('hidden');
  }
  const animBtn = $('rd-anim-btn');
  if (animBtn) animBtn.addEventListener('click', openAnimModal);
  const animClose = $('rd-anim-close');
  if (animClose) animClose.addEventListener('click', () => $('rd-anim-modal').classList.add('hidden'));
  const animModal = $('rd-anim-modal');
  if (animModal) animModal.addEventListener('click', (e) => {
    if (e.target === animModal) animModal.classList.add('hidden');
  });

  // 👥 Active-screen roster — mirror the lobby chip list into the
  // active reading screen so the teacher can SEE who's in during the
  // lecture. Updates whenever socket emits 'players' events.
  function renderActiveRoster(players) {
    const wrap = $('rd-active-roster-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    // The state.players payload is an OBJECT keyed by socket-id, not an
    // array. Convert to entries and pull name + avatar from each value.
    const entries = Object.entries(players || {});
    if (!entries.length) {
      wrap.innerHTML = '<span class="rd-active-roster-empty">esperando alumnos…</span>';
      return;
    }
    entries.forEach(([id, p]) => {
      const chip = document.createElement('span');
      chip.className = 'rd-active-roster-chip';
      const avatar = p.avatar ? `<span class="rd-active-roster-avatar">${p.avatar}</span>` : '';
      chip.innerHTML = avatar + escapeHtml(p.name || 'Anon');
      wrap.appendChild(chip);
    });
  }

  $('start-btn').addEventListener('click', () => {
    socket.emit('host:start', { pin });
    // 🎵 Per-story music — each story carries its own theme name in
    // its payload (e.g. 'family' for Pīnpīn, 'mochi-mash' for XiǎoMíng).
    // The theme name maps to a GAME_THEMES entry in sounds.js. The same
    // proven music engine the games use — zero new perf cost.
    try {
      if (window.MochiSounds) {
        if (MochiSounds.startMusic) MochiSounds.startMusic();
        const themeName = (lastStoryPayload && lastStoryPayload.music) || null;
        if (themeName && MochiSounds.startGameTheme) {
          MochiSounds.startGameTheme(themeName);
        }
      }
    } catch (_) {}
  });
  $('exit-btn').addEventListener('click', () => {
    if (confirm('¿Terminar la lectura?')) {
      socket.emit('host:end-now', { pin });
      try {
        if (window.MochiSounds && MochiSounds.stopMusic) MochiSounds.stopMusic();
      } catch (_) {}
    }
  });
  // Stop music on page unload — belt-and-suspenders so closing the
  // host tab never leaves background audio playing elsewhere.
  window.addEventListener('beforeunload', () => {
    try { if (window.MochiSounds && window.MochiSounds.stopMusic) MochiSounds.stopMusic(); } catch (_) {}
  });

  // === Transport: prev / play-pause / next / restart ===
  $('rd-btn-prev').addEventListener('click', () => {
    socket.emit('rd:goto', { pin, password: adminPw, page: currentPageIdx - 1 });
  });
  $('rd-btn-next').addEventListener('click', () => {
    socket.emit('rd:goto', { pin, password: adminPw, page: currentPageIdx + 1 });
  });
  $('rd-btn-restart').addEventListener('click', () => {
    socket.emit('rd:seek', { pin, password: adminPw, posMs: 0 });
  });
  $('rd-btn-playpause').addEventListener('click', () => {
    if (isPlaying) {
      socket.emit('rd:pause', { pin, password: adminPw });
    } else {
      // Make sure user-gesture audio unlock has fired before issuing play.
      if (window.unlockAudio) window.unlockAudio();
      socket.emit('rd:play', { pin, password: adminPw });
    }
  });
  // 🐢 Slow-mo toggle — broadcasts to ALL devices so every phone slows
  // down together. Karaoke highlight slows automatically because it's
  // driven by audio.currentTime which respects playbackRate.
  $('rd-btn-slow').addEventListener('click', () => {
    const nextRate = currentPlaybackRate === 1.0 ? 0.5 : 1.0;
    socket.emit('rd:setPlaybackRate', { pin, password: adminPw, rate: nextRate });
  });
  // Language toggle — switch text between pinyin and Spanish. Audio stays
  // Chinese (only the text changes), so kids hear narration in Chinese
  // while reading the Spanish translation = bilingual comprehension.
  $('rd-lang-btn').addEventListener('click', () => {
    const nextLang = currentLanguage === 'pinyin' ? 'es' : 'pinyin';
    socket.emit('rd:setLanguage', { pin, password: adminPw, language: nextLang });
  });
  // Modo Curioso toggle — kids can tap a word to see its dictionary card.
  // Same admin gate as the warmup version; data comes from warmup-vocab.js.
  $('rd-curious-btn').addEventListener('click', () => {
    socket.emit('rd:setCurious', { pin, password: adminPw, curious: !currentCurious });
  });
  // Story picker — switch to a different built-in story. Audio + image
  // paths re-derive automatically from /assets/reading/<storyId>/...
  $('rd-story-select').addEventListener('change', (e) => {
    const newId = e.target.value;
    if (newId && newId !== currentStoryId) {
      socket.emit('rd:setStory', { pin, password: adminPw, storyId: newId });
    }
  });
  // Test mode — start / end + results modal close
  $('rd-test-btn').addEventListener('click', () => {
    socket.emit('rd:startTest', { pin, password: adminPw });
  });
  $('rd-test-host-end').addEventListener('click', () => {
    if (confirm('¿Terminar el examen ahora y mostrar resultados?')) {
      socket.emit('rd:endTest', { pin, password: adminPw });
    }
  });
  $('rd-test-results-close').addEventListener('click', () => {
    $('rd-test-results-overlay').classList.add('hidden');
  });
  // Server fires this when the test finishes — show the per-student
  // results modal sorted by score.
  socket.on('rd:test-results', (data) => {
    const list = $('rd-test-results-list');
    if (!list) return;
    list.innerHTML = '';
    (data.results || []).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'rd-test-result-row';
      const medal = ['🥇','🥈','🥉'][i] || `#${i + 1}`;
      const pct = Math.round((r.correctCount / r.total) * 100);
      const certBadge = r.score === 100 ? '🏅 ¡PERFECTO!' :
                        r.score >= 80 ? '⭐ Excelente' :
                        r.score >= 60 ? '👍 Bien' :
                        r.score >= 40 ? '📚 Sigue practicando' :
                        '💪 ¡A repasar!';
      row.innerHTML = `
        <span class="rd-test-rank">${medal}</span>
        <span class="rd-test-rname">${escapeHtml(r.avatar || '')} ${escapeHtml(r.name)} ${r.code ? `<small>(${r.code})</small>` : ''}</span>
        <span class="rd-test-rscore">${r.score} <small>pts</small></span>
        <span class="rd-test-rcorrect">${r.correctCount}/${r.total} <small>(${pct}%)</small></span>
        <span class="rd-test-rcert">${certBadge}</span>`;
      list.appendChild(row);
    });
    $('rd-test-results-overlay').classList.remove('hidden');
    $('rd-test-host').classList.add('hidden');
    // Stop any timer
    if (testTimerInt) { clearInterval(testTimerInt); testTimerInt = null; }
  });

  // === Roster ===
  // The 'state' event carries s.players ALWAYS (lobby + active). We
  // render BOTH the lobby chip grid AND the active-screen chip row so
  // the teacher can see who's in during the lecture too. User feedback:
  // "I saw En clase tab, but it's not really displaying who's there."
  socket.on('state', (s) => {
    if (!s) return;
    if (s.state === 'lobby') renderLobbyPlayers(s.players);
    // Active roster updates regardless of state.state — every state push
    // includes the latest players map.
    renderActiveRoster(s.players || {});
  });
  socket.on('countdown', () => {
    // No countdown for reading — just jump to active when host:start fires
    showScreen('active');
  });
  socket.on('game-end', () => {
    showScreen('lobby');
  });

  // === Reading-mode state event — the source of truth ===
  socket.on('rd:state', (state) => {
    if (!state) return;
    // Show active screen if not already
    if ($('screen-active').classList.contains('hidden')) showScreen('active');
    // Story changed (different storyId)? Replace local copy + re-render
    if (state.storyId && state.storyId !== currentStoryId) {
      currentStoryId = state.storyId;
      story = { title: state.title, subtitle: state.subtitle, pages: state.pages };
      lastStoryPayload = state;   // capture so start-btn can read music
      currentPageIdx = -1;  // force render below
      $('rd-page-max').textContent = story.pages.length;
      applyStoryTheme(state.theme);    // 🎨 swap colors per story
      maybeSwapMusic(state.music);      // 🎵 swap music per story (auto)
    } else if (state.pages && !story) {
      story = { title: state.title, subtitle: state.subtitle, pages: state.pages };
      lastStoryPayload = state;
      $('rd-page-max').textContent = story.pages.length;
      currentStoryId = state.storyId;
      applyStoryTheme(state.theme);
      maybeSwapMusic(state.music);
    } else {
      lastStoryPayload = state;   // keep latest in any case
    }
    // Populate the story dropdown once
    if (!storyListRendered && state.storyList) {
      const sel = $('rd-story-select');
      sel.innerHTML = '';
      (state.storyList || []).forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `📚 ${s.title} (${s.pageCount}p)`;
        sel.appendChild(opt);
      });
      sel.value = currentStoryId || state.storyId || '';
      storyListRendered = true;
      // 🆕 If the page was launched via Modo Maestro with ?story=<id> in
      // the URL, preselect that story automatically — saves the teacher
      // a manual selection step.
      try {
        const preselect = new URLSearchParams(location.search).get('story');
        if (preselect && state.storyList.some((s) => s.id === preselect)
            && preselect !== currentStoryId) {
          sel.value = preselect;
          socket.emit('rd:setStory', { pin, password: adminPw, storyId: preselect });
        }
      } catch (_) {}
    }
    // Keep the dropdown in sync if story switched via another route
    if (state.storyId) $('rd-story-select').value = state.storyId;
    // Compute server-vs-client drift so playback math survives latency
    if (typeof state.serverNow === 'number') {
      serverOffsetMs = Date.now() - state.serverNow;
    }
    // Page change?
    if (typeof state.currentPage === 'number' && state.currentPage !== currentPageIdx) {
      currentPageIdx = state.currentPage;
      renderPage();
    } else if (!$('rd-sentences').firstChild) {
      // First render
      renderPage();
    }
    // Language change?
    const newLang = state.language || 'pinyin';
    if (newLang !== currentLanguage) {
      currentLanguage = newLang;
      // Re-render the sentences in the new language
      renderSentences(story.pages[currentPageIdx]);
      // Update the toggle button label
      const langBtn = $('rd-lang-btn');
      if (langBtn) {
        langBtn.textContent = (currentLanguage === 'pinyin')
          ? '🌐 Cambiar a Español'
          : '🌐 Volver al Pinyin';
        langBtn.classList.toggle('rd-lang-btn-es', currentLanguage === 'es');
      }
    }
    // Curious mode UI on host — just update the button label/style.
    // (The actual taps happen on the students' phones.)
    const newCurious = !!state.curious;
    if (newCurious !== currentCurious) {
      currentCurious = newCurious;
      const cBtn = $('rd-curious-btn');
      if (cBtn) {
        cBtn.textContent = currentCurious
          ? '🔍 Apagar Modo Curioso'
          : '🔍 Activar Modo Curioso';
        cBtn.classList.toggle('rd-curious-btn-on', currentCurious);
      }
    }
    // Apply play/pause + audio position
    serverPlayStartedAt = state.playStartedAt || 0;
    serverAudioPosMs = state.audioPosMs || 0;
    // Playback rate (slow-mo) — applied BEFORE syncAudioToServer so the
    // audio element is set to the right rate before we seek/play it.
    const newRate = state.playbackRate || 1.0;
    if (newRate !== currentPlaybackRate) {
      currentPlaybackRate = newRate;
      const audio = $('rd-audio');
      if (audio) audio.playbackRate = newRate;
      const slowBtn = $('rd-btn-slow');
      if (slowBtn) {
        slowBtn.textContent = (newRate === 0.5) ? '🐰 Normal' : '🐢 Slow-mo';
        slowBtn.classList.toggle('rd-btn-slow-on', newRate === 0.5);
      }
    }
    const wantPlay = !!state.isPlaying;
    syncAudioToServer(wantPlay);
    isPlaying = wantPlay;
    $('rd-btn-playpause').textContent = isPlaying ? '⏸ Pausar' : '▶ Reproducir';
    // Test mode UI sync
    renderTestHostFromState(state.test);
  });

  // Render the host's "test in progress" overlay from the state.test
  // object the server sent. Shows the current question + 4 choices the
  // students see, a per-question countdown, and the live "answered count".
  function renderTestHostFromState(test) {
    const overlay = $('rd-test-host');
    if (!test || !test.active) {
      if (currentTestQIdx !== -1) {
        // Test just ended — hide overlay; results modal lands separately
        overlay.classList.add('hidden');
        currentTestQIdx = -1;
        if (testTimerInt) { clearInterval(testTimerInt); testTimerInt = null; }
      }
      return;
    }
    // Show + populate
    overlay.classList.remove('hidden');
    $('rd-test-host-qnow').textContent  = (test.qIdx + 1);
    $('rd-test-host-qtotal').textContent = test.total;
    if (test.question) {
      $('rd-test-host-q').textContent = test.question.q;
      const wrap = $('rd-test-host-choices');
      wrap.innerHTML = '';
      (test.question.choices || []).forEach((c, i) => {
        const chip = document.createElement('div');
        chip.className = 'rd-test-host-choice';
        chip.innerHTML = `<span class="rd-test-choice-letter">${String.fromCharCode(65 + i)}</span> ${escapeHtml(c)}`;
        wrap.appendChild(chip);
      });
    }
    // Per-question countdown — recompute on every state, restart timer
    currentTestQIdx = test.qIdx;
    if (testTimerInt) clearInterval(testTimerInt);
    testTimerInt = setInterval(() => {
      const remaining = Math.max(0, (test.deadline || 0) - Date.now());
      $('rd-test-host-timer').textContent = Math.ceil(remaining / 1000) + 's';
      if (remaining <= 0) clearInterval(testTimerInt);
    }, 200);
  }

  // === Render the current page (image, caption, sentences) ===
  function renderPage() {
    if (!story) return;
    const page = story.pages[currentPageIdx];
    if (!page) return;
    $('rd-page-now').textContent = (currentPageIdx + 1);
    // Image — try to load; on error, show placeholder
    const imgWrap = $('rd-page-image');
    imgWrap.innerHTML = `<img class="rd-image-img" src="${page.imageUrl}"
      onerror="this.style.display='none'; this.parentNode.querySelector('.rd-image-placeholder').classList.add('show');"
      alt="Página ${page.pageNum}">
      <span class="rd-image-placeholder" id="rd-image-placeholder">📷 Coloca <code>page-${page.pageNum}.png</code></span>`;
    // Caption
    $('rd-page-caption').textContent = page.caption || '';
    // Sentences — split by sentenceIdx, wrap each word in a span
    renderSentences(page);
    // Audio
    const audio = $('rd-audio');
    audio.src = page.audioUrl;
    audio.currentTime = 0;
    // Audio-missing notice probe — try a HEAD-style fetch trick via Audio
    audio.onerror = () => {
      $('rd-audio-missing').classList.remove('hidden');
      $('rd-audio-missing-name').textContent = `page-${page.pageNum}.mp3`;
    };
    audio.onloadedmetadata = () => {
      $('rd-audio-missing').classList.add('hidden');
      const total = audio.duration || (page.audioDurationMs / 1000);
      $('rd-audio-total').textContent = formatTime(total);
      // Auto-time the karaoke: scale word timestamps to match REAL audio
      // duration. Keeps the highlight in sync without the teacher having
      // to hand-tune audioDurationMs in the story file.
      const realMs = (audio.duration || 0) * 1000;
      const declaredMs = page.audioDurationMs || realMs;
      if (realMs > 200 && declaredMs > 0 && Math.abs(realMs - declaredMs) > 200) {
        const scale = realMs / declaredMs;
        (page.words || []).forEach((w) => {
          w.startMs = Math.round(w.startMs * scale);
          w.endMs   = Math.round(w.endMs   * scale);
        });
        (page.sentenceRanges || []).forEach((r) => {
          r.startMs = Math.round(r.startMs * scale);
          r.endMs   = Math.round(r.endMs   * scale);
        });
        renderSentences(page);
      }
    };
    $('rd-audio-now').textContent = '0:00';
    $('rd-audio-total').textContent = formatTime(page.audioDurationMs / 1000);
    $('rd-audio-bar-fill').style.width = '0%';
  }

  function renderSentences(page) {
    const wrap = $('rd-sentences');
    wrap.innerHTML = '';
    wrap.dataset.lang = currentLanguage;
    if (currentLanguage === 'es') {
      // Spanish mode: render each Spanish sentence as a single block. The
      // word-by-word karaoke can't map cross-language (different word
      // order), so we do SENTENCE-LEVEL highlight — the whole Spanish
      // line glows when the corresponding pinyin sentence is playing.
      const ranges = page.sentenceRanges || [];
      const sentencesEs = page.sentencesEs || [];
      sentencesEs.forEach((esText, i) => {
        const range = ranges[i] || { startMs: 0, endMs: 0 };
        const line = document.createElement('div');
        line.className = 'rd-sentence rd-sentence-es';
        line.dataset.start = range.startMs;
        line.dataset.end = range.endMs;
        line.dataset.idx = i;
        line.textContent = esText;
        wrap.appendChild(line);
      });
    } else {
      // Pinyin mode: word-by-word karaoke (original behaviour)
      const sentences = {};
      (page.words || []).forEach((w, idx) => {
        if (!sentences[w.sentenceIdx]) sentences[w.sentenceIdx] = [];
        sentences[w.sentenceIdx].push({ ...w, idx });
      });
      Object.keys(sentences).sort((a, b) => +a - +b).forEach((sIdx) => {
        const line = document.createElement('div');
        line.className = 'rd-sentence';
        sentences[sIdx].forEach((w) => {
          const span = document.createElement('span');
          span.className = 'rd-word';
          span.dataset.start = w.startMs;
          span.dataset.end = w.endMs;
          span.dataset.idx = w.idx;
          span.textContent = w.pinyin + ' ';
          line.appendChild(span);
        });
        wrap.appendChild(line);
      });
    }
  }

  // === Audio sync: align the host's <audio> element to the server state ===
  function syncAudioToServer(wantPlay) {
    const audio = $('rd-audio');
    if (!audio) return;
    const targetPosSec = computeTargetPosMs() / 1000;
    // If we're far off, snap
    if (Math.abs((audio.currentTime || 0) - targetPosSec) > 0.4) {
      try { audio.currentTime = targetPosSec; } catch (_) {}
    }
    if (wantPlay && audio.paused) {
      const p = audio.play();
      if (p && p.catch) p.catch(() => {/* autoplay-blocked, user must tap */});
      startHighlightLoop();
    } else if (!wantPlay && !audio.paused) {
      audio.pause();
      stopHighlightLoop();
    } else if (wantPlay) {
      startHighlightLoop();
    }
  }
  function computeTargetPosMs() {
    if (!isPlayingNow()) return serverAudioPosMs;
    // Audio time advances at playbackRate. So elapsed wall-clock time
    // * rate = audio time elapsed.
    const nowOnServer = Date.now() - serverOffsetMs;
    const elapsed = Math.max(0, nowOnServer - serverPlayStartedAt);
    return serverAudioPosMs + elapsed * (currentPlaybackRate || 1.0);
  }
  function isPlayingNow() {
    return !!(serverPlayStartedAt && serverPlayStartedAt > 0);
  }

  // === Karaoke highlight loop ===
  function startHighlightLoop() {
    if (highlightRafId) return;
    const audio = $('rd-audio');
    const bar = $('rd-audio-bar-fill');
    const nowEl = $('rd-audio-now');
    const tick = () => {
      if (!audio) return;
      const tSec = audio.currentTime || 0;
      const tMs = tSec * 1000;
      if (currentLanguage === 'es') {
        // Spanish mode: highlight whichever SENTENCE range contains tMs
        const lines = document.querySelectorAll('#rd-sentences .rd-sentence-es');
        let activeIdx = -1;
        lines.forEach((line) => {
          const start = +line.dataset.start;
          const end = +line.dataset.end;
          if (tMs >= start && tMs < end) activeIdx = +line.dataset.idx;
        });
        lines.forEach((line) => {
          line.classList.toggle('active', +line.dataset.idx === activeIdx);
        });
      } else {
        // Pinyin mode: word-level karaoke
        const spans = document.querySelectorAll('#rd-sentences .rd-word');
        let activeIdx = -1;
        spans.forEach((s) => {
          const start = +s.dataset.start;
          const end = +s.dataset.end;
          if (tMs >= start && tMs < end) activeIdx = +s.dataset.idx;
        });
        spans.forEach((s) => {
          s.classList.toggle('active', +s.dataset.idx === activeIdx);
        });
      }
      // Progress bar
      const total = audio.duration || 1;
      if (bar) bar.style.width = Math.min(100, (tSec / total) * 100) + '%';
      if (nowEl) nowEl.textContent = formatTime(tSec);
      // Auto-advance? When the audio actually ENDS we pause.
      if (audio.ended || audio.paused) {
        stopHighlightLoop();
        return;
      }
      highlightRafId = requestAnimationFrame(tick);
    };
    highlightRafId = requestAnimationFrame(tick);
  }
  function stopHighlightLoop() {
    if (highlightRafId) cancelAnimationFrame(highlightRafId);
    highlightRafId = null;
    document.querySelectorAll('#rd-sentences .active').forEach((s) => s.classList.remove('active'));
  }

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
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
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
