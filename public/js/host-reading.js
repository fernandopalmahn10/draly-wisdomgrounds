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
        } else {
          $('admin-err').textContent = 'Contraseña incorrecta';
          adminPw = null;
        }
      });
    });
  }

  $('start-btn').addEventListener('click', () => {
    socket.emit('host:start', { pin });
  });
  $('exit-btn').addEventListener('click', () => {
    if (confirm('¿Terminar la lectura?')) socket.emit('host:end-now', { pin });
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

  // === Roster ===
  socket.on('state', (s) => {
    if (s.state === 'lobby') renderLobbyPlayers(s.players);
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
      currentPageIdx = -1;  // force render below
      $('rd-page-max').textContent = story.pages.length;
    } else if (state.pages && !story) {
      story = { title: state.title, subtitle: state.subtitle, pages: state.pages };
      $('rd-page-max').textContent = story.pages.length;
      currentStoryId = state.storyId;
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
    const wantPlay = !!state.isPlaying;
    syncAudioToServer(wantPlay);
    isPlaying = wantPlay;
    $('rd-btn-playpause').textContent = isPlaying ? '⏸ Pausar' : '▶ Reproducir';
  });

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
    // Live position = snapshot + elapsed wall time since play started
    const nowOnServer = Date.now() - serverOffsetMs;
    return serverAudioPosMs + Math.max(0, nowOnServer - serverPlayStartedAt);
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
