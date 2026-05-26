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
    // First-time setup of the story payload
    if (state.pages && !story) {
      story = { title: state.title, subtitle: state.subtitle, pages: state.pages };
      $('rd-page-max').textContent = story.pages.length;
    }
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
    // Group words by sentenceIdx
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
      // Highlight whichever word's range contains tMs
      const spans = document.querySelectorAll('#rd-sentences .rd-word');
      let activeIdx = -1;
      spans.forEach((s) => {
        const start = +s.dataset.start;
        const end = +s.dataset.end;
        if (tMs >= start && tMs < end) {
          activeIdx = +s.dataset.idx;
        }
      });
      spans.forEach((s) => {
        s.classList.toggle('active', +s.dataset.idx === activeIdx);
      });
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
    document.querySelectorAll('#rd-sentences .rd-word.active').forEach((s) => s.classList.remove('active'));
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
