// Warm-up · sentence-builder teacher tool — host page driver.
// v2: organized by HSK1 experience (EXP1-EXP8), view-mode toggle (text/
// picture/both), and preset save/load via localStorage.
(function () {
  const socket = io();
  const $ = (id) => document.getElementById(id);
  // STABILITY: when our socket drops and reconnects (phone lock, network
  // blip), re-claim our existing game so the room — and every kid in it —
  // survives instead of being torn down. No new PIN, no kicks.
  let _everConnected = false;
  socket.on('connect', () => {
    if (!_everConnected) { _everConnected = true; return; }
    if (!pin || !adminPw) return;
    socket.emit('host:reclaim', { pin, password: adminPw }, (resp) => {
      // If the game truly vanished (very long outage past the grace window),
      // we can't silently recreate with the same PIN — surface a gentle note.
      if (!resp || !resp.ok) {
        if ($('admin-err')) $('admin-err').textContent = '';
        console.warn('[host] reclaim failed:', resp && resp.error);
      }
    });
  });
  let pin = null;
  let state = null;
  let adminPw = null;
  let activeExp = 'all';
  let currentViewMode = 'text';
  let currentSentence = [];
  let currentCurious = false;
  let currentDelegates = [];   // array of player names
  let currentJudges = [];      // array of player names with judge powers
  let currentFrozen = false;   // assistance frozen? (only teacher edits)
  let currentFrozenNames = []; // selective freeze — specific kids paused
  let currentVisibleExps = null;   // null = all banks; else array of exp ids
  let currentCustomWords = [];     // live teacher-created words
  // ⏱ Time-machine countdown — driven by the server's timer.endsAt.
  let _wuTimerRaf = null;
  function applyWuTimer(timer) {
    const badge = $('wu-countdown');
    const num = $('wu-countdown-num');
    if (_wuTimerRaf) { clearInterval(_wuTimerRaf); _wuTimerRaf = null; }
    if (!timer || !timer.endsAt) {
      if (badge) badge.classList.add('hidden');
      document.body.classList.remove('wu-timemachine');
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
      if (num) num.textContent = left;
      if (badge) {
        badge.classList.remove('hidden');
        badge.classList.toggle('wu-countdown-low', left <= 5);
      }
      document.body.classList.add('wu-timemachine');
      if (left <= 0) {
        clearInterval(_wuTimerRaf); _wuTimerRaf = null;
        if (badge) { num.textContent = '0'; badge.classList.add('wu-countdown-done'); }
        try { if (MochiSounds && MochiSounds.flatlineAlarm) MochiSounds.flatlineAlarm(); } catch (_) {}
        setTimeout(() => {
          if (badge) { badge.classList.add('hidden'); badge.classList.remove('wu-countdown-done', 'wu-countdown-low'); }
          document.body.classList.remove('wu-timemachine');
        }, 2200);
      }
    };
    tick();
    _wuTimerRaf = setInterval(tick, 250);
  }
  // Resolve a word id from the static catalog OR the live custom words.
  function wuWord(wid) {
    return (window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid])
        || currentCustomWords.find((w) => w.id === wid)
        || null;
  }
  let currentPlayers = {};     // id -> { name, team, avatar }
  let serverPresets = [];      // canonical server-side preset list
  let rearrangeMode = false;   // when true, word-tap swaps instead of deletes
  let selectedSwapIdx = null;  // index of word selected for swapping
  let isSuperAdmin = false;    // true when unlocked with a super-admin code
  let librarySearch = '';      // tone-stripped catalog search string
  const LEGACY_PRESET_KEY = 'dralyWarmupPresets';
  const MIGRATION_KEY = 'dralyWarmupPresetsMigrated';

  // Tone-stripping normalizer — identical semantics to /homework so "ni hao"
  // matches "nǐ hǎo". Lowercase → NFD decompose → drop diacritics → trim.
  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[.,!?;:'"()¿¡]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // === LIVE-MASTER auto-flow (launched from /maestro with ?livemaster=1) ===
  // The teacher already authenticated on /maestro and picked the kids.
  // We silently: create the warmup game → auth with their code → start it →
  // flip on auto-delegate (every kid = asistente) → force-redirect the
  // selected kids onto the builder. No PIN, no invitation, no gate.
  let _pendingLiveMaster = null;   // { codes, text } applied once active
  (function maybeLiveMaster() {
    const sp = new URLSearchParams(location.search);
    if (sp.get('livemaster') !== '1') return;
    let payload = null;
    try { payload = JSON.parse(sessionStorage.getItem('dralyLiveMaster') || 'null'); } catch (_) {}
    try { sessionStorage.removeItem('dralyLiveMaster'); } catch (_) {}
    if (!payload || !payload.pw) return;   // no payload → fall back to normal gate
    adminPw = payload.pw;
    // Hide the gate; show a tiny "preparing" note in its place.
    const gate = $('screen-admin-gate');
    if (gate) {
      const sub = gate.querySelector('.wu-gate-sub');
      if (sub) sub.textContent = '⚡ Preparando Modo Maestro en vivo…';
      const inp = $('admin-pw'); if (inp) inp.style.display = 'none';
      const ok = $('admin-ok'); if (ok) ok.style.display = 'none';
    }
    socket.emit('host:create', { gameType: 'warmup' }, ({ pin: p }) => {
      pin = p;
      $('pin-display').textContent = p;
      $('join-url').textContent = `${location.origin}/?pin=${p}`;
      socket.emit('wu:auth', { pin, password: adminPw }, (resp) => {
        if (!resp || !resp.ok) {
          if ($('admin-err')) $('admin-err').textContent = 'No se pudo iniciar la sesión.';
          return;
        }
        isSuperAdmin = !!resp.isSuperAdmin;
        fetchServerPresets(() => migrateLegacyPresetsOnce());
        // Stash the kids to force-in; the countdown handler fires them once
        // the builder is live (so g.warmup exists server-side).
        _pendingLiveMaster = { codes: payload.codes || [], text: payload.text || '' };
        socket.emit('host:start', { pin });   // → countdown → active
      });
    });
  })();

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
          isSuperAdmin = !!(resp && resp.isSuperAdmin);
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
      bindExtras();
      // LIVE-MASTER: now that the builder is live, flip on auto-delegate and
      // force the pre-selected kids straight in as asistentes.
      if (_pendingLiveMaster) {
        const lm = _pendingLiveMaster;
        _pendingLiveMaster = null;
        socket.emit('wu:auto-delegate', { pin, password: adminPw, on: true });
        forceLiveMasterStudents(lm.codes, lm.text);
      }
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

  // 📤 ENVIAR A ALUMNOS — push the current sentence into the chosen
  // students' "Mis oraciones" without their own work being involved.
  // Opens a modal listing every student in the teacher's classroom
  // with a checkbox + a search box. Marked as pushedByTeacher on
  // each kid's record so the parent view can credit the teacher.
  const pushBtn = $('wu-push-btn');
  if (pushBtn) pushBtn.addEventListener('click', () => {
    if (!currentSentence.length) {
      flashSaveFeedback(false, 'Arma una oración primero');
      return;
    }
    openPushToStudentsModal(currentSentence.slice());
  });

  // ════════════════════════════════════════════════════════════════
  // 📤 PUSH-TO-STUDENTS — full-screen redesign 2026-06-04 (Fernando):
  //   "It's super disorganized, something like a box at the very
  //    bottom, not clean, not beautiful. Also I can group sentences
  //    by experiences and send the whole group."
  //
  //   - Replaces the cramped 580px-wide centered modal with a
  //     full-screen sheet that has a sticky hero header + tab strip.
  //   - Two modes via tabs:
  //       ✏️ Una oración        → send the sentence on stage now
  //       📚 Paquete de lección → accumulate several sentences (per
  //         HSK1 EXP), send the whole pack at once
  //   - The pack persists in localStorage so the teacher can build
  //     it across sessions without losing progress.
  //   - EXP label is auto-detected from each sentence's words
  //     (every word in warmup-vocab carries w.exp). Mixed sentences
  //     show "Mixto".
  // ════════════════════════════════════════════════════════════════
  // 🆕 2026-06-04 v3 (Fernando): Paquete de lección is now exactly 8
  // fixed EXP packages (HSK1 experiences). Sentences auto-route to
  // whichever EXP their words belong to; teacher checks 1+ packages
  // and sends all selected at once.
  //   Storage: { expPacks: { exp1: [{words, ts}, ...], ..., exp8: [...] } }
  //   Old flat-pack data is migrated on first load (routed by detected EXP).
  const _PACK_KEY = 'draly_lesson_pack_v2';
  const _PACK_KEY_LEGACY = 'draly_lesson_pack_v1';
  const _EXP_IDS = ['exp1', 'exp2', 'exp3', 'exp4', 'exp5', 'exp6', 'exp7', 'exp8'];
  function _emptyExpPacks() {
    const o = {};
    _EXP_IDS.forEach((id) => { o[id] = []; });
    return o;
  }
  function _loadExpPacks() {
    let packs = _emptyExpPacks();
    // Migrate legacy flat-pack format if present.
    try {
      const legacy = localStorage.getItem(_PACK_KEY_LEGACY);
      if (legacy) {
        const arr = JSON.parse(legacy);
        if (Array.isArray(arr) && arr.length) {
          arr.forEach((entry) => {
            const exp = _expForWords(entry.words || []) || 'exp1';
            if (packs[exp]) packs[exp].push({ ts: entry.ts || Date.now(), words: entry.words || [] });
          });
          try { localStorage.removeItem(_PACK_KEY_LEGACY); } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      const raw = localStorage.getItem(_PACK_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          _EXP_IDS.forEach((id) => {
            if (Array.isArray(obj[id])) packs[id] = obj[id];
          });
        }
      }
    } catch (_) {}
    return packs;
  }
  function _saveExpPacks(packs) {
    try { localStorage.setItem(_PACK_KEY, JSON.stringify(packs || _emptyExpPacks())); } catch (_) {}
  }
  // Return the EXP id ('exp1'..'exp8') that the words MOSTLY belong to.
  // Falls back to the first available exp; null if no words have exp tag.
  function _expForWords(wordIds) {
    const exps = (wordIds || []).map((id) => {
      const w = window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[id];
      return w && w.exp;
    }).filter(Boolean);
    if (!exps.length) return null;
    // Pick the most common exp (covers mixed sentences gracefully).
    const counts = {};
    exps.forEach((e) => { counts[e] = (counts[e] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  }
  function _expMeta(expId) {
    const wu = (window.WU_EXPERIENCES || {})[expId];
    if (wu) return wu;
    return { id: expId, label: expId.toUpperCase(), short: expId.toUpperCase() };
  }
  // Back-compat shim — older code in this file used _expLabelForWords.
  function _expLabelForWords(wordIds) {
    const id = _expForWords(wordIds);
    return id ? id.toUpperCase() : null;
  }
  function _renderSentenceChips(wordIds) {
    return (wordIds || []).map((id) => {
      const w = window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[id];
      if (!w) return '<span class="wu-push-prev-chip">' + escapeHtml(String(id)) + '</span>';
      return '<span class="wu-push-prev-chip">' +
               '<strong>' + escapeHtml(w.pinyin || '') + '</strong>' +
               (w.hanzi ? '<em class="wu-push-prev-hz" lang="zh">' + escapeHtml(w.hanzi) + '</em>' : '') +
               '<small>' + escapeHtml(w.es || '') + '</small>' +
             '</span>';
    }).join('');
  }

  function openPushToStudentsModal(wordIds) {
    fetch('/api/admin/students?pw=' + encodeURIComponent(adminPw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { alert('No se pudo cargar la lista de alumnos.'); return; }
        const students = (data.students || []).slice().sort((a, b) => {
          const an = (a.displayName || a.code || '').toLowerCase();
          const bn = (b.displayName || b.code || '').toLowerCase();
          return an < bn ? -1 : an > bn ? 1 : 0;
        });
        let overlay = document.getElementById('wu-push-modal');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'wu-push-modal';
        overlay.className = 'wu-push-sheet';
        // Tab state — restored from last session for muscle memory.
        let activeTab = (function () {
          try { return localStorage.getItem('draly_push_tab') || 'one'; } catch (_) { return 'one'; }
        })();
        const cats = (window.SENTENCE_CATEGORIES || []);
        const catChipsHtml =
          '<button class="wu-push-cat-chip is-active" data-cat="" type="button">🚫 Sin categoría</button>' +
          cats.map((c) =>
            '<button class="wu-push-cat-chip" data-cat="' + escapeHtml(c.id) + '" type="button" style="--cat-color:' + c.color + ';">' +
              c.emoji + ' ' + escapeHtml(c.label) +
            '</button>'
          ).join('');
        overlay.innerHTML = '' +
          // 🆕 2026-06-04 v2 (Fernando bug fix): floating ✕ button in
          // the top-right corner, ALWAYS visible regardless of scroll
          // position. The sticky ← back chip below is a secondary path.
          '<button class="wu-push-corner-close" id="wu-push-close-corner" type="button" aria-label="Cerrar">✕</button>' +
          '<div class="wu-push-canvas">' +
            '<header class="wu-push-hero">' +
              '<button class="wu-push-back" id="wu-push-close" type="button" aria-label="Volver al aula">← Volver al aula</button>' +
              '<div class="wu-push-hero-text">' +
                '<h2 class="wu-push-title">📤 Enviar oraciones a alumnos</h2>' +
                '<p class="wu-push-sub">Cada oración se guarda en <strong>Mis oraciones</strong> del alumno con la nota <em>📤 Enviada por tu maestra</em>.</p>' +
              '</div>' +
            '</header>' +
            '<div class="wu-push-tabs" role="tablist">' +
              '<button class="wu-push-tab' + (activeTab === 'one' ? ' is-active' : '') + '" data-tab="one" type="button">✏️ Una oración</button>' +
              '<button class="wu-push-tab' + (activeTab === 'pack' ? ' is-active' : '') + '" data-tab="pack" type="button">📚 Paquete de lección <span class="wu-push-tab-n" id="wu-push-pack-n">0</span></button>' +
            '</div>' +

            // ── ONE-SENTENCE PANE ────────────────────────────────
            // 🆕 2026-06-06 v4 (Fernando): no more free-form "Categoría
            // (opcional)" row — categories ARE the 8 EXPs of maestro
            // mode. Tap "➕ Añadir al paquete" → picker pops with the 8
            // EXPs + "+ Nueva categoría". The teacher picks, the
            // sentence lands in that package, ready to send.
            '<section class="wu-push-pane" id="wu-push-pane-one">' +
              '<div class="wu-push-section">' +
                '<div class="wu-push-section-h">Oración actual</div>' +
                '<div class="wu-push-prev">' + _renderSentenceChips(wordIds) + '</div>' +
                '<div class="wu-push-section-foot">' +
                  '<button class="btn btn-jade btn-xl" id="wu-push-add-current" type="button" style="width:100%;">➕ Añadir al paquete…</button>' +
                '</div>' +
              '</div>' +
              '<div class="wu-push-hint">💡 Lo que está en la pizarra se envía a los alumnos seleccionados al pulsar 📤 Enviar.</div>' +
            '</section>' +

            // ── PACK PANE — 8 fixed EXP packages ────────────────
            '<section class="wu-push-pane" id="wu-push-pane-pack">' +
              '<div class="wu-push-section">' +
                '<div class="wu-push-section-h">Oración actual <small class="wu-push-section-note">Detectada automáticamente</small></div>' +
                '<div class="wu-push-prev" id="wu-push-pack-current"></div>' +
                '<div class="wu-push-pack-current-hint" id="wu-push-pack-current-hint"></div>' +
                '<div class="wu-push-section-foot">' +
                  '<button class="btn btn-jade btn-xl" id="wu-push-pack-add-auto" type="button" style="width:100%;">➕ Añadir al paquete</button>' +
                '</div>' +
              '</div>' +
              '<div class="wu-push-section">' +
                '<div class="wu-push-section-h">Tus 8 cajas <small class="wu-push-section-note">Marca las que quieres enviar</small></div>' +
                '<div class="wu-push-pack" id="wu-push-pack"></div>' +
              '</div>' +
            '</section>' +

            // ── STUDENT PICKER (shared by both panes) ───────────
            '<div class="wu-push-section">' +
              '<div class="wu-push-section-h">Alumnos</div>' +
              '<input class="input wu-push-search" id="wu-push-search" type="text" placeholder="🔎 Buscar por nombre o código…" autocomplete="off">' +
              '<div class="wu-push-quick">' +
                '<button class="btn btn-ghost btn-sm" id="wu-push-all" type="button">✅ Todos</button>' +
                '<button class="btn btn-ghost btn-sm" id="wu-push-none" type="button">⬜ Ninguno</button>' +
                '<button class="btn btn-ghost btn-sm" id="wu-push-online" type="button">🟢 Solo en línea</button>' +
              '</div>' +
              '<div class="wu-push-students" id="wu-push-list"></div>' +
            '</div>' +

            // ── STICKY FOOTER — context-aware send button ───────
            '<footer class="wu-push-footer">' +
              '<button class="wu-push-send" id="wu-push-go" type="button">📤 Enviar</button>' +
            '</footer>' +
          '</div>';
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('show'));

        // ───────── Student list rendering ─────────
        // 🆕 2026-06-06 v4 (Fernando): persistent check state survives
        // search-filtering. Used to be: typing in the search box
        // re-rendered the rows, losing every checkbox the teacher had
        // already ticked. Now we track checked codes in a Set so the
        // teacher can search-then-add to her selection without losing
        // anyone she'd already picked. Also: real "solo conectados"
        // toggle that HIDES offline kids rather than mass-checking.
        const list = overlay.querySelector('#wu-push-list');
        const checkedCodes = new Set();
        let onlineOnly = false;
        let searchTerm = '';
        const renderRows = () => {
          list.innerHTML = '';
          const q = (searchTerm || '').toLowerCase();
          let pool = q
            ? students.filter((s) =>
                (s.displayName || '').toLowerCase().includes(q) ||
                (s.code || '').toLowerCase().includes(q))
            : students.slice();
          if (onlineOnly) {
            pool = pool.filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000);
          }
          if (!pool.length) {
            list.innerHTML = '<p class="wu-push-empty">Sin coincidencias.</p>';
            return;
          }
          pool.forEach((s) => {
            const isOnline = s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000;
            const isChecked = checkedCodes.has(s.code);
            const row = document.createElement('label');
            row.className = 'wu-push-stu' + (isChecked ? ' is-checked' : '');
            row.dataset.online = isOnline ? '1' : '0';
            row.innerHTML =
              '<input type="checkbox" data-code="' + escapeHtml(s.code) + '"' + (isChecked ? ' checked' : '') + '>' +
              '<span class="wu-push-stu-dot" style="background:' + (isOnline ? '#5be88a' : '#666') + ';"></span>' +
              '<span class="wu-push-stu-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
              '<span class="wu-push-stu-code">' + escapeHtml(s.code) + '</span>';
            row.querySelector('input').addEventListener('change', (e) => {
              if (e.target.checked) checkedCodes.add(s.code);
              else checkedCodes.delete(s.code);
              row.classList.toggle('is-checked', e.target.checked);
            });
            list.appendChild(row);
          });
        };
        renderRows();

        // ───────── 8-EXP pack rendering ─────────
        let expPacks = _loadExpPacks();
        let selectedExps = new Set();     // which packages are checked for sending
        let expandedExps = new Set();     // which packages are open (showing sentences)
        const packEl = overlay.querySelector('#wu-push-pack');
        const packCountEl = overlay.querySelector('#wu-push-pack-n');
        const currentEl = overlay.querySelector('#wu-push-pack-current');
        const currentHintEl = overlay.querySelector('#wu-push-pack-current-hint');

        // List of ALL category ids the renderer should show: built-in
        // EXPs (always visible) + custom user categories the teacher
        // created (always shown if defined) + any "ghost" custom ids
        // already in expPacks but no longer in localStorage (orphaned
        // sentences — still let her send/clear them).
        function _allCatIds() {
          const ids = _EXP_IDS.slice();
          const custom = (window.SentenceCategories && window.SentenceCategories.loadCustom()) || [];
          custom.forEach((c) => { if (!ids.includes(c.id)) ids.push(c.id); });
          Object.keys(expPacks).forEach((k) => {
            if (k && !ids.includes(k) && (expPacks[k] || []).length) ids.push(k);
          });
          return ids;
        }
        function _totalPackCount() {
          return _allCatIds().reduce((n, id) => n + (expPacks[id] || []).length, 0);
        }
        function renderCurrentSentence() {
          // Pull from live builder if available.
          const live = (typeof currentSentence !== 'undefined' && Array.isArray(currentSentence) && currentSentence.length)
            ? currentSentence : (wordIds || []);
          if (!live.length) {
            currentEl.innerHTML = '<span class="wu-push-empty">Construye una oración en la pizarra primero.</span>';
            currentHintEl.textContent = '';
            return;
          }
          currentEl.innerHTML = _renderSentenceChips(live);
          const exp = _expForWords(live);
          if (exp) {
            const meta = _expMeta(exp);
            currentHintEl.innerHTML = '📍 Detectada como <strong>' + escapeHtml(meta.label) + '</strong> — toca <strong>➕ Añadir al paquete</strong> abajo.';
          } else {
            currentHintEl.textContent = '⚠️ No pude detectar la experiencia. Se añadirá a EXP1 por defecto.';
          }
        }
        // Per-sentence selection inside an expanded package. Map of
        // catId → Set<ts>. If a category has ANY entry in this map,
        // the send action treats that subset as the package payload
        // instead of the full package.
        const _picked = new Map();
        function _pickedSetFor(catId) {
          if (!_picked.has(catId)) _picked.set(catId, new Set());
          return _picked.get(catId);
        }
        function renderPack() {
          packCountEl.textContent = _totalPackCount();
          packEl.innerHTML = '';
          _allCatIds().forEach((catId) => {
            const meta = _catMeta(catId);
            const sentences = expPacks[catId] || [];
            const box = document.createElement('div');
            box.className = 'wu-push-pack-box' + (sentences.length ? ' has-items' : '') + (catId.startsWith('u_') ? ' is-custom' : '');
            const isChecked = selectedExps.has(catId);
            const isOpen = expandedExps.has(catId);
            const pickedSize = _picked.has(catId) ? _picked.get(catId).size : 0;
            const sendCount = pickedSize || sentences.length;
            const sendLabel = pickedSize ? (pickedSize + ' elegida' + (pickedSize === 1 ? '' : 's')) : 'paquete completo';
            box.innerHTML =
              '<div class="wu-push-pack-box-head" data-cat="' + escapeHtml(catId) + '">' +
                '<label class="wu-push-pack-box-check">' +
                  '<input type="checkbox" data-cat="' + escapeHtml(catId) + '"' + (isChecked ? ' checked' : '') + (sentences.length ? '' : ' disabled') + '>' +
                '</label>' +
                '<span class="wu-push-pack-box-label">' + escapeHtml(meta.label) + '</span>' +
                '<span class="wu-push-pack-box-count">' + sentences.length + ' oración' + (sentences.length === 1 ? '' : 'es') +
                  (sentences.length && pickedSize ? ' · ' + pickedSize + ' ✓' : '') +
                '</span>' +
                (sentences.length ? ('<button class="wu-push-pack-box-toggle" type="button" aria-label="Expandir">' + (isOpen ? '▲' : '▼') + '</button>') : '') +
              '</div>' +
              (isOpen && sentences.length ? '<div class="wu-push-pack-box-body" id="body-' + escapeHtml(catId) + '"></div>' : '');
            packEl.appendChild(box);
            // Wire package-level checkbox (Send-whole)
            const cb = box.querySelector('input[type=checkbox]');
            if (cb) cb.addEventListener('change', () => {
              if (cb.checked) selectedExps.add(catId);
              else selectedExps.delete(catId);
              updateSendBtn();
            });
            // Wire toggle (▼/▲)
            const toggle = box.querySelector('.wu-push-pack-box-toggle');
            if (toggle) toggle.addEventListener('click', (e) => {
              e.stopPropagation();
              if (expandedExps.has(catId)) expandedExps.delete(catId);
              else expandedExps.add(catId);
              renderPack();
            });
            // Fill body if expanded
            if (isOpen && sentences.length) {
              const body = box.querySelector('#body-' + CSS.escape(catId));
              // 🆕 2026-06-06 v4 (Fernando): pick-or-send-all bar inside
              // each expanded package. Two paths:
              //   ☑ Marca oraciones individuales para enviar SOLO esas
              //   📤 Send package whole — ignored picks, sends everything
              const bar = document.createElement('div');
              bar.className = 'wu-push-pack-bar';
              bar.innerHTML =
                '<button class="wu-push-pack-pickall" type="button">' + (pickedSize === sentences.length ? '⬜ Quitar todas' : '✅ Marcar todas') + '</button>' +
                '<span class="wu-push-pack-bar-info">' + sendLabel + '</span>';
              body.appendChild(bar);
              bar.querySelector('.wu-push-pack-pickall').addEventListener('click', () => {
                const set = _pickedSetFor(catId);
                if (set.size === sentences.length) set.clear();
                else { set.clear(); sentences.forEach((e) => set.add(e.ts)); }
                renderPack();
                updateSendBtn();
              });
              sentences.forEach((entry, idx) => {
                const row = document.createElement('div');
                const isPicked = _picked.has(catId) && _picked.get(catId).has(entry.ts);
                row.className = 'wu-push-pack-row' + (isPicked ? ' is-picked' : '');
                row.innerHTML =
                  '<label class="wu-push-pack-row-check"><input type="checkbox"' + (isPicked ? ' checked' : '') + '></label>' +
                  '<div class="wu-push-pack-chips">' + _renderSentenceChips(entry.words) + '</div>' +
                  '<button class="wu-push-pack-del" type="button" aria-label="Quitar">✕</button>';
                row.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
                  const set = _pickedSetFor(catId);
                  if (e.target.checked) set.add(entry.ts);
                  else set.delete(entry.ts);
                  // Refresh head count + bar label without re-rendering all
                  renderPack();
                  updateSendBtn();
                });
                row.querySelector('.wu-push-pack-del').addEventListener('click', () => {
                  expPacks[catId].splice(idx, 1);
                  if (_picked.has(catId)) _picked.get(catId).delete(entry.ts);
                  _saveExpPacks(expPacks);
                  renderPack();
                  updateSendBtn();
                });
                body.appendChild(row);
              });
            }
          });
        }
        renderCurrentSentence();
        renderPack();

        // ───────── Tabs ─────────
        function showTab(which) {
          activeTab = which;
          try { localStorage.setItem('draly_push_tab', which); } catch (_) {}
          overlay.querySelectorAll('.wu-push-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === which));
          overlay.querySelector('#wu-push-pane-one').classList.toggle('is-active', which === 'one');
          overlay.querySelector('#wu-push-pane-pack').classList.toggle('is-active', which === 'pack');
          updateSendBtn();
        }
        overlay.querySelectorAll('.wu-push-tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
        showTab(activeTab);

        // 🆕 2026-06-06 v4 — categories ARE the 8 EXPs now (Fernando:
        // "those categories don't match with the ones we have in maestro
        // mode... you have the eight categories"). The one-sentence pane
        // no longer carries its own free-form category chip row — when
        // the teacher hits "Añadir al paquete" we open a picker that
        // shows the 8 EXPs + "+ Nueva categoría". The pack-cats block
        // that used to exist here referenced a non-existent DOM node
        // (`#wu-push-pack-cats`) and was throwing — wiping the rest of
        // the modal's event wiring (including the back button).
        let oneCat = '';   // kept null/empty; the per-sentence category
                           // now flows through the EXP picker below.

        // ───────── Add-to-pack handlers ─────────
        // 🆕 2026-06-04 v2 (Fernando bug fix): pull the LIVE current
        // sentence from the host-warmup builder, NOT the snapshot from
        // when the modal opened. This way the teacher can build a new
        // sentence behind the modal (or with the modal half-closed),
        // tap "Añadir oración actual", and it lands in the pack. Also
        // surface visible in-modal feedback so the teacher SEES the
        // sentence land (flashSaveFeedback fires the host page chip,
        // which is hidden behind the modal — useless).
        function _modalFlash(text, isOk) {
          let el = overlay.querySelector('.wu-push-flash');
          if (!el) {
            el = document.createElement('div');
            el.className = 'wu-push-flash';
            overlay.querySelector('.wu-push-canvas').appendChild(el);
          }
          el.textContent = text;
          el.classList.remove('is-ok', 'is-err');
          el.classList.add(isOk ? 'is-ok' : 'is-err');
          el.classList.remove('hidden');
          clearTimeout(el._hideT);
          el._hideT = setTimeout(() => { try { el.classList.add('hidden'); } catch (_) {} }, 2400);
        }
        // 🆕 2026-06-06 v4 (Fernando): explicit picker. Tap Añadir →
        // teacher SEES the 8 EXPs + her own custom categories + a tile
        // to create a new one. No more silent auto-routing — she always
        // chooses where her sentence lands.
        function _ensureCustomBucket(catId) {
          if (!expPacks[catId]) expPacks[catId] = [];
        }
        function _persistAdd(catId, live) {
          _ensureCustomBucket(catId);
          expPacks[catId].push({
            ts: Date.now() + Math.floor(Math.random() * 1000),
            words: live,
          });
          _saveExpPacks(expPacks);
          expandedExps.add(catId);
          renderPack();
          renderCurrentSentence();
          updateSendBtn();
          const meta = _catMeta(catId);
          _modalFlash('➕ Añadida a ' + (meta.short || meta.label) + ' · total ' + expPacks[catId].length, true);
        }
        // Resolve label/emoji for a category id (built-in EXP or custom u_xxx).
        function _catMeta(catId) {
          if (catId && catId.startsWith('u_')) {
            const c = (window.SentenceCategories && window.SentenceCategories.byId(catId)) || null;
            if (c) return { id: catId, label: c.label, short: (c.emoji || '⭐') + ' ' + c.label };
          }
          return _expMeta(catId);
        }
        function openAddToPackPicker() {
          const live = (typeof currentSentence !== 'undefined' && Array.isArray(currentSentence) && currentSentence.length)
            ? currentSentence.slice()
            : (wordIds || []).slice();
          if (!live.length) { _modalFlash('Arma una oración en la pizarra primero', false); return; }
          const detected = _expForWords(live);
          const custom = (window.SentenceCategories && window.SentenceCategories.loadCustom()) || [];
          // Build the picker tiles.
          const expTilesHtml = _EXP_IDS.map((id) => {
            const meta = _expMeta(id);
            const count = (expPacks[id] || []).length;
            const isAuto = id === detected;
            return '<button class="wu-pack-pick-tile' + (isAuto ? ' is-auto' : '') + '" data-cat="' + id + '" type="button">' +
              '<span class="wu-pack-pick-label">' + escapeHtml(meta.label) + '</span>' +
              '<span class="wu-pack-pick-count">' + count + ' guardada' + (count === 1 ? '' : 's') + '</span>' +
              (isAuto ? '<span class="wu-pack-pick-auto">📍 sugerida</span>' : '') +
            '</button>';
          }).join('');
          const customTilesHtml = custom.map((c) => {
            const count = (expPacks[c.id] || []).length;
            return '<button class="wu-pack-pick-tile is-custom" data-cat="' + escapeHtml(c.id) + '" type="button">' +
              '<span class="wu-pack-pick-label">' + (c.emoji || '⭐') + ' ' + escapeHtml(c.label) + '</span>' +
              '<span class="wu-pack-pick-count">' + count + ' guardada' + (count === 1 ? '' : 's') + '</span>' +
            '</button>';
          }).join('');
          const picker = document.createElement('div');
          picker.className = 'wu-pack-pick-overlay';
          picker.innerHTML =
            '<div class="wu-pack-pick-card">' +
              '<div class="wu-pack-pick-head">' +
                '<div class="wu-pack-pick-title">📦 ¿En qué paquete la guardo?</div>' +
                '<button class="wu-pack-pick-close" type="button" aria-label="Cerrar">✕</button>' +
              '</div>' +
              '<div class="wu-pack-pick-prev">' + _renderSentenceChips(live) + '</div>' +
              '<div class="wu-pack-pick-grid">' + expTilesHtml + '</div>' +
              (customTilesHtml ? '<div class="wu-pack-pick-sep">Tus categorías</div><div class="wu-pack-pick-grid">' + customTilesHtml + '</div>' : '') +
              '<button class="wu-pack-pick-new" id="wu-pack-pick-new" type="button">➕ Crear nueva categoría</button>' +
            '</div>';
          overlay.appendChild(picker);
          // Wire close
          const closePicker = () => { try { picker.remove(); } catch (_) {} };
          picker.querySelector('.wu-pack-pick-close').addEventListener('click', closePicker);
          picker.addEventListener('click', (e) => { if (e.target === picker) closePicker(); });
          // Wire tile selection
          picker.querySelectorAll('.wu-pack-pick-tile').forEach((tile) => {
            tile.addEventListener('click', () => {
              const catId = tile.dataset.cat;
              if (!catId) return;
              _persistAdd(catId, live);
              closePicker();
              // Auto-switch to the Paquete tab so she can SEE it.
              showTab('pack');
            });
          });
          // Wire "Crear nueva"
          picker.querySelector('#wu-pack-pick-new').addEventListener('click', () => {
            const name = prompt('Nombre para la nueva categoría (ej. "Repaso semanal"):');
            if (!name || !name.trim()) return;
            const emoji = prompt('Un emoji opcional para esta categoría (deja vacío para ⭐):', '⭐') || '⭐';
            const cat = window.SentenceCategories && window.SentenceCategories.add(name.trim(), emoji.trim().slice(0, 4));
            if (!cat) { alert('No se pudo crear la categoría — prueba con otro nombre.'); return; }
            _persistAdd(cat.id, live);
            closePicker();
            showTab('pack');
          });
        }
        overlay.querySelector('#wu-push-add-current').addEventListener('click', openAddToPackPicker);
        overlay.querySelector('#wu-push-pack-add-auto').addEventListener('click', openAddToPackPicker);

        // ───────── Quick-pick student helpers ─────────
        // 🆕 2026-06-04 v3 — defensive close: button click + ESC key +
        // backdrop click all dismiss the modal without touching the
        // host page socket or the active room. Fernando: "The room
        // should still be active. Everything should go back to normal."
        // — by design, since the host-warmup page itself is never
        // navigated, only this overlay is added/removed.
        // 🆕 2026-06-06 v4 (Fernando bug fix): instant close, no
        // setTimeout, multiple event types so the back chip ALWAYS
        // fires the first time on phone+tablet+desktop. Once removed,
        // the underlying host-warmup screen (sticky stage, players,
        // toolbar) is intact — no nav, no socket touch.
        let _closed = false;
        const close = () => {
          if (_closed) return; _closed = true;
          try { document.removeEventListener('keydown', _escHandler); } catch (_) {}
          try { overlay.classList.remove('show'); } catch (_) {}
          try { overlay.remove(); } catch (_) {}
        };
        function _escHandler(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
        document.addEventListener('keydown', _escHandler);
        // Bind close to BOTH the back chip and the corner ✕ on the
        // three reliable touch events. We use pointerdown for the
        // fastest response on touch hardware and click as a fallback
        // for non-PointerEvent browsers / desktop. preventDefault on
        // pointerdown stops the synthesized click from re-firing close.
        function bindClose(el) {
          if (!el) return;
          const handler = (e) => { e.preventDefault(); e.stopPropagation(); close(); };
          el.addEventListener('pointerdown', handler, { passive: false });
          el.addEventListener('click', handler);
        }
        bindClose(overlay.querySelector('#wu-push-close'));
        bindClose(overlay.querySelector('#wu-push-close-corner'));
        // Backdrop click — only if the user taps the dim area, not the canvas.
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('#wu-push-search').addEventListener('input', (e) => {
          searchTerm = e.target.value || '';
          renderRows();
        });
        overlay.querySelector('#wu-push-all').addEventListener('click', () => {
          // Add EVERY currently-visible row to the checked set.
          list.querySelectorAll('.wu-push-stu').forEach((row) => {
            const cb = row.querySelector('input[type=checkbox]');
            if (cb) { cb.checked = true; checkedCodes.add(cb.dataset.code); }
            row.classList.add('is-checked');
          });
        });
        overlay.querySelector('#wu-push-none').addEventListener('click', () => {
          checkedCodes.clear();
          renderRows();
        });
        const onlineBtn = overlay.querySelector('#wu-push-online');
        onlineBtn.addEventListener('click', () => {
          onlineOnly = !onlineOnly;
          onlineBtn.classList.toggle('is-active', onlineOnly);
          onlineBtn.textContent = onlineOnly ? '🟢 Solo en línea ✓' : '🟢 Solo en línea';
          renderRows();
        });

        // ───────── Send button — copy reflects current tab ─────
        const sendBtn = overlay.querySelector('#wu-push-go');
        function updateSendBtn() {
          if (activeTab === 'pack') {
            const picked = Array.from(selectedExps);
            // Count sentences honoring per-package per-sentence picks.
            const totalSent = picked.reduce((n, id) => {
              const set = _picked.get(id);
              return n + (set && set.size ? set.size : (expPacks[id] || []).length);
            }, 0);
            if (!picked.length) {
              sendBtn.textContent = '📚 Marca al menos un paquete';
              sendBtn.disabled = true;
            } else if (!totalSent) {
              sendBtn.textContent = '📚 Los paquetes marcados están vacíos';
              sendBtn.disabled = true;
            } else {
              sendBtn.textContent = '📚 Enviar ' + picked.length + ' paquete' + (picked.length === 1 ? '' : 's') +
                ' (' + totalSent + ' oración' + (totalSent === 1 ? '' : 'es') + ')';
              sendBtn.disabled = false;
            }
          } else {
            sendBtn.textContent = '📤 Enviar oración a los seleccionados';
            sendBtn.disabled = false;
          }
        }
        updateSendBtn();
        sendBtn.addEventListener('click', () => {
          // Use the persistent Set (survives search filtering) instead
          // of just the currently-visible rows. Fernando 2026-06-06:
          // "send to individual kids... search bar for easier search."
          const codes = Array.from(checkedCodes);
          if (!codes.length) { alert('Selecciona al menos un alumno.'); return; }
          let body;
          let packsBeingSent = [];   // [{expId, sentences:[]}] for clearing on success
          if (activeTab === 'pack') {
            const allSentences = [];
            Array.from(selectedExps).forEach((catId) => {
              const set = _picked.get(catId);
              const list = (expPacks[catId] || []).filter((entry) => {
                // If the teacher checked ANY individual sentence in this
                // package, send ONLY those. Otherwise send the whole pack.
                if (!set || !set.size) return true;
                return set.has(entry.ts);
              });
              list.forEach((entry) => {
                // Send the category id as the per-sentence category so the
                // kid's "De la maestra" filter chip is the EXP (or custom).
                allSentences.push({ words: entry.words, category: catId });
              });
              packsBeingSent.push(catId);
            });
            if (!allSentences.length) { alert('Los paquetes marcados están vacíos.'); return; }
            body = { studentCodes: codes, sentences: allSentences };
          } else {
            body = { studentCodes: codes, words: wordIds, category: oneCat || null };
          }
          fetch('/api/admin/sentence/push?pw=' + encodeURIComponent(adminPw), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
            .then((r) => r.json())
            .then((res) => {
              if (res && res.ok) {
                if (activeTab === 'pack') {
                  flashSaveFeedback(true, '📚 ' + res.sentencesSent + ' oraciones (' + packsBeingSent.length + ' paquete' + (packsBeingSent.length === 1 ? '' : 's') + ') enviadas a ' + res.sent + ' alumno(s)');
                  // NOTE: we do NOT clear the packs after send. Fernando
                  // wants the packs sturdy — "build once, send to many".
                  // Just unselect them so a second tap doesn't re-send.
                  selectedExps.clear();
                } else {
                  flashSaveFeedback(true, '📤 Enviada a ' + res.sent + ' alumno(s)');
                }
                close();
              } else {
                alert('Error: ' + ((res && res.error) || 'desconocido'));
              }
            })
            .catch((e) => alert('Error: ' + e.message));
        });
      })
      .catch((e) => alert('Error: ' + e.message));
  }
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
  socket.on('wu:state', ({ sentence, viewMode, curious, delegates, judges, frozen, frozenNames, timer, visibleExps, customWords }) => {
    currentSentence = sentence || [];
    currentFrozenNames = Array.isArray(frozenNames) ? frozenNames : [];
    applyWuTimer(timer);
    if (viewMode) {
      currentViewMode = viewMode;
      document.querySelectorAll('.wu-vm-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === viewMode);
      });
    }
    currentCurious = !!curious;
    currentDelegates = Array.isArray(delegates) ? delegates : [];
    currentJudges = Array.isArray(judges) ? judges : [];
    currentFrozen = !!frozen;
    currentVisibleExps = Array.isArray(visibleExps) ? visibleExps : null;
    currentCustomWords = Array.isArray(customWords) ? customWords : [];
    renderBanks();
    renderLibrary();
    // Reflect freeze state on the toggle button.
    const fb = $('wu-freeze-btn');
    if (fb) {
      fb.classList.toggle('active', currentFrozen);
      fb.textContent = currentFrozen ? '▶️ Reanudar asistencia' : '⏸ Detener asistencia';
    }
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

  // 🎛 Render the bank-visibility chips. currentVisibleExps === null means
  // ALL banks are shown to students. Tapping a chip toggles that bank for
  // the STUDENTS' catalog (broadcast via wu:set-visible-exps).
  function renderBanks() {
    const wrap = $('wu-banks-chips');
    if (!wrap || !window.WU_EXPERIENCES) return;
    const all = currentVisibleExps === null;
    wrap.innerHTML = '';
    // "Todos" chip
    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'wu-bank-chip' + (all ? ' on' : '');
    allChip.textContent = '✨ Todos';
    allChip.onclick = () => socket.emit('wu:set-visible-exps', { pin, password: adminPw, exps: null });
    wrap.appendChild(allChip);
    Object.values(window.WU_EXPERIENCES).forEach((e) => {
      const on = all || (currentVisibleExps || []).indexOf(e.id) >= 0;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'wu-bank-chip' + (on ? ' on' : '');
      chip.textContent = e.short || e.id;
      chip.onclick = () => {
        let next = all ? [] : (currentVisibleExps || []).slice();
        if (all) {
          // From "all" → tapping one bank means "only this bank"
          next = [e.id];
        } else if (next.indexOf(e.id) >= 0) {
          next = next.filter((x) => x !== e.id);
        } else {
          next.push(e.id);
        }
        socket.emit('wu:set-visible-exps', { pin, password: adminPw, exps: next.length ? next : null });
        if (MochiSounds.tap) MochiSounds.tap();
      };
      wrap.appendChild(chip);
    });
    const hint = $('wu-banks-hint');
    if (hint) hint.textContent = all
      ? 'Los alumnos ven los 8 bancos. Toca uno para mostrar SOLO ese.'
      : 'Alumnos ven: ' + (currentVisibleExps || []).map((x) => (window.WU_EXPERIENCES[x] || {}).short || x).join(', ');
  }

  function renderLibrary() {
    const lib = $('wu-library');
    if (!lib) return;
    lib.innerHTML = '';
    const byExp = {};
    const q = librarySearch;   // already normalized
    window.WU_WORDS.forEach((w) => {
      if (activeExp !== 'all' && w.exp !== activeExp) return;
      // Tone-stripped search across pinyin, español AND hanzi.
      if (q && !(
        normalize(w.pinyin).includes(q) ||
        normalize(w.es).includes(q) ||
        (w.hanzi && w.hanzi.includes(librarySearch.trim()))
      )) return;
      (byExp[w.exp] = byExp[w.exp] || []).push(w);
    });
    // Empty-state when a search matches nothing
    if (q && Object.keys(byExp).length === 0) {
      lib.innerHTML = `<div class="wu-lib-empty">🔍 Sin resultados para “${escapeHtml(librarySearch)}”. Prueba sin tonos (ej. <em>ni hao</em>, <em>comer</em>, <em>casa</em>).</div>`;
      return;
    }
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
    // Custom (teacher-created) words section — names etc.
    const customMatches = currentCustomWords.filter((w) =>
      !q || normalize(w.pinyin).includes(q) || normalize(w.es).includes(q));
    if (customMatches.length && (activeExp === 'all' || activeExp === 'custom')) {
      const section = document.createElement('div');
      section.className = 'wu-lib-section';
      section.innerHTML = '<div class="wu-lib-section-title">⭐ Personalizadas (creadas por ti)</div>';
      const grid = document.createElement('div');
      grid.className = 'wu-lib-grid';
      customMatches.forEach((w) => {
        const card = document.createElement('button');
        card.className = 'wu-lib-card';
        card.style.setProperty('--cat-color', '#ffd86b');
        card.innerHTML = `<span class="wu-lib-icon">${w.icon || '⭐'}</span>
          <span class="wu-lib-pinyin">${escapeHtml(w.pinyin)}</span>
          <span class="wu-lib-hanzi">${escapeHtml(w.hanzi || '')}</span>
          <span class="wu-lib-es">${escapeHtml(w.es || '')}</span>`;
        card.onclick = () => {
          socket.emit('wu:add-word', { pin, password: adminPw, wordId: w.id });
          if (MochiSounds.tap) MochiSounds.tap();
        };
        // long-press / right-click to delete
        card.oncontextmenu = (e) => { e.preventDefault(); socket.emit('wu:remove-custom-word', { pin, password: adminPw, id: w.id }); };
        grid.appendChild(card);
      });
      section.appendChild(grid);
      lib.appendChild(section);
    }
  }

  // Each library card always shows: pinyin + hanzi + Spanish. Icon depends
  // on view-mode setting (so the teacher previews how it'll appear).
  function renderLibCardContent(w, cat) {
    // Picture mode: try to load /assets/warmup/<id>.png. onerror falls back to emoji.
    const showPic = (currentViewMode === 'picture' || currentViewMode === 'both');
    const showEmoji = (currentViewMode === 'text' || currentViewMode === 'both');
    const pic = showPic
      ? `<img class="wu-lib-pic" src="${(window.wuPicSrc ? window.wuPicSrc(w) : '/assets/warmup/' + w.id + '.png')}" alt="${w.pinyin}"
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
      const w = wuWord(wid);
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
        ? `<img class="wu-sw-pic" src="${(window.wuPicSrc ? window.wuPicSrc(w) : '/assets/warmup/' + w.id + '.png')}" alt="${w.pinyin}"
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
      const isJudge = currentJudges.indexOf(p.name) >= 0;
      const isPaused = currentFrozenNames.indexOf(p.name) >= 0;
      const row = document.createElement('div');
      row.className = 'wu-roster-row' + (isDelegate ? ' is-delegate' : '') + (isJudge ? ' is-judge' : '') + (isPaused ? ' is-paused' : '');
      row.innerHTML = `
        <span class="wu-roster-avatar">${p.avatar || '🎓'}</span>
        <span class="wu-roster-name">${escapeHtml(p.name)}${isJudge ? ' <span class="wu-judge-tag">⚖️ juez</span>' : ''}${isPaused ? ' <span class="wu-paused-tag">⏸ pausado</span>' : ''}</span>
        <button class="wu-roster-btn ${isDelegate ? 'revoke' : 'grant'}" type="button">
          ${isDelegate ? '🚫 Quitar' : '👑 Asistente'}
        </button>
        ${isDelegate ? `<button class="wu-roster-pause-btn ${isPaused ? 'on' : ''}" type="button" title="Pausar solo a este alumno">${isPaused ? '▶️ Reanudar' : '⏸ Pausar'}</button>` : ''}
        <button class="wu-roster-judge-btn ${isJudge ? 'on' : ''}" type="button" title="Nombrar/quitar juez">
          ${isJudge ? '⚖️ Quitar juez' : '⚖️ Juez'}
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
      const pbtn = row.querySelector('.wu-roster-pause-btn');
      if (pbtn) pbtn.onclick = () => {
        // Selective freeze: toggle this kid in/out of the frozenNames list.
        const set = new Set(currentFrozenNames);
        if (set.has(p.name)) set.delete(p.name); else set.add(p.name);
        socket.emit('wu:set-frozen', { pin, password: adminPw, names: Array.from(set) });
        if (MochiSounds.tap) MochiSounds.tap();
      };
      const jbtn = row.querySelector('.wu-roster-judge-btn');
      jbtn.onclick = () => {
        socket.emit('wu:set-judge', { pin, password: adminPw, playerName: p.name, on: !isJudge });
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
      return `<img class="wu-nb-avatar-img" src="/assets/avatars/${value}.svg?v=20260528b" alt="${escapeHtml(value)}" draggable="false">`;
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

  // =====================================================================
  // EXTRAS (2026-05-28 batch): catalog search · speak sentence · super-
  // maestro Spanish prompt · assistant activity ticker · interactive VFX.
  // Bound once when the active screen first appears.
  // =====================================================================
  // POST the force-redirect to every selected kid's inbox. Their /homework
  // page polls, sees actionType:'force', and hard-redirects to the builder
  // (their name gets spliced in client-side so autojoin needs no typing).
  function forceLiveMasterStudents(codes, text) {
    if (!Array.isArray(codes) || !codes.length || !pin) return;
    fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(adminPw), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentCodes: codes,
        text: text || '¡Entra a Modo Maestro ahora!',
        actionType:  'force',
        actionUrl:   '/player.html?pin=' + encodeURIComponent(pin) + '&autojoin=1',
        actionLabel: '📚 Modo Maestro',
      }),
    }).then((r) => r.json()).catch(() => {});
  }

  let extrasBound = false;
  function bindExtras() {
    if (extrasBound) return;
    extrasBound = true;

    // --- 🔍 Catalog search (tone-stripped) ---
    const searchInput = $('wu-search-input');
    const searchClear = $('wu-search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        librarySearch = normalize(searchInput.value);
        if (searchClear) searchClear.classList.toggle('hidden', !searchInput.value);
        renderLibrary();
      });
    }
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        librarySearch = '';
        searchClear.classList.add('hidden');
        renderLibrary();
        if (searchInput) searchInput.focus();
      });
    }

    // --- 🔊 Escuchar — speak the constructed sentence aloud ---
    const speakBtn = $('wu-speak-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        if (!currentSentence.length) { flashSaveFeedback(false, 'Oración vacía'); return; }
        const pinyin = currentSentence
          .map((wid) => {
            const w = (window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid])
                   || (currentCustomWords || []).find((cw) => cw && cw.id === wid);
            return (w && w.pinyin) || '';
          })
          .filter(Boolean)
          .join(' ');
        speakChinese(pinyin, speakBtn);
      });
    }

    // --- ✍️ Super-maestro Spanish prompt bar ---
    const promptRow = $('wu-prompt-row');
    if (promptRow) promptRow.classList.toggle('hidden', !isSuperAdmin);
    const promptInput = $('wu-prompt-input');
    const promptSend  = $('wu-prompt-send');
    const promptClear = $('wu-prompt-clear');
    if (promptSend) {
      promptSend.addEventListener('click', () => {
        const text = (promptInput && promptInput.value || '').trim();
        if (!text) return;
        socket.emit('wu:prompt-set', { pin, password: adminPw, text });
        if (MochiSounds.correct) MochiSounds.correct();
      });
    }
    if (promptClear) {
      promptClear.addEventListener('click', () => {
        if (promptInput) promptInput.value = '';
        socket.emit('wu:prompt-clear', { pin, password: adminPw });
        if (MochiSounds.tap) MochiSounds.tap();
      });
    }

    // --- 🎮 Interactive VFX buttons ---
    const fx = { 'wu-fx-rain': 'rain', 'wu-fx-confetti': 'confetti',
                 'wu-fx-zombies': 'zombies', 'wu-fx-moto': 'moto', 'wu-fx-shake': 'shake',
                 'wu-fx-sixseven': 'sixseven', 'wu-fx-stars': 'stars',
                 'wu-fx-flash': 'flash', 'wu-fx-tiger': 'tiger',
                 'wu-fx-gojo': 'gojo', 'wu-fx-yuji': 'yuji', 'wu-fx-fnaf': 'fnaf',
                 'wu-fx-shelly': 'shelly', 'wu-fx-dandy': 'dandy' };
    Object.keys(fx).forEach((id) => {
      const b = $(id);
      if (b) b.addEventListener('click', () => broadcastFx(fx[id]));
    });
    // 🎬 ANIMACIONES — persistent transparent-GIF overlays. Toggle
    // behavior: tap once = on across every kid + host; tap again = off.
    // Same socket-relay pattern as wu:fx, separate event so the
    // overlay layer is independent of the burst-effects logic.
    const _animActive = new Set();
    document.querySelectorAll('.wu-fx-anim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.animId;
        if (!id) return;
        const turningOn = !_animActive.has(id);
        if (turningOn) _animActive.add(id); else _animActive.delete(id);
        socket.emit('wu:anim', { pin, password: adminPw, id, on: turningOn });
        // Local render for the host's own screen (the relay echo will
        // also fire but it's idempotent).
        wuApplyAnim(id, turningOn);
      });
    });
    socket.on('wu:anim', (d) => {
      if (!d || !d.id) return;
      wuApplyAnim(d.id, !!d.on);
    });
    // Render an animation overlay onto the host's own screen so the
    // teacher can see what's being projected to the kids.
    const WU_ANIM_URL = {
      gojo:   '/assets/png-library/GOJO%20TRANSPARENT.gif',
      yugi:   '/assets/png-library/YUGI%20TRANSPARENT.gif',
      freddy: '/assets/png-library/FREDDY%20TRANSPARENT.gif',
      mario:  '/assets/png-library/MARIO%20TRANSPARENT.gif',
      sonic:  '/assets/png-library/SONIC%20TRANSPARENT.gif',
      elsa:   '/assets/png-library/ELSA%20TRANSPARENT.gif',
      turtle: '/assets/png-library/Squirtle%20animation.gif',
    };
    function wuApplyAnim(id, on) {
      let ov = document.getElementById('wu-anim-overlay-' + id);
      if (on) {
        if (ov) return;
        ov = document.createElement('div');
        ov.id = 'wu-anim-overlay-' + id;
        ov.className = 'wu-anim-overlay';
        ov.innerHTML = '<img src="' + (WU_ANIM_URL[id] || '') + '" alt="">';
        document.body.appendChild(ov);
        if (MochiSounds.tap) MochiSounds.tap();
      } else {
        if (ov) ov.remove();
      }
    }
    // 🎮 Pinned FAB toggles the scrollable effects tray.
    const fab = $('wu-fx-fab');
    const tray = $('wu-fx-tray');
    const trayClose = $('wu-fx-tray-close');
    if (fab && tray) {
      fab.addEventListener('click', () => tray.classList.toggle('hidden'));
      if (trayClose) trayClose.addEventListener('click', () => tray.classList.add('hidden'));
    }
    // Kick off the random anti-monotony fun loop.
    startRandomFun();

    // --- ➕ Create a live custom word (e.g. a name) ---
    const addWordBtn = $('wu-newword-add');
    if (addWordBtn) {
      const doAdd = () => {
        const pinyin = ($('wu-newword-pinyin').value || '').trim();
        const es = ($('wu-newword-es').value || '').trim();
        if (!pinyin) return;
        socket.emit('wu:add-custom-word', { pin, password: adminPw, pinyin, es });
        $('wu-newword-pinyin').value = '';
        $('wu-newword-es').value = '';
        if (MochiSounds.correct) MochiSounds.correct();
      };
      addWordBtn.addEventListener('click', doAdd);
      $('wu-newword-pinyin').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
      $('wu-newword-es').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
    }

    // --- 🧊 Detener/Reanudar asistencia (freeze toggle) ---
    const freezeBtn = $('wu-freeze-btn');
    if (freezeBtn) {
      freezeBtn.addEventListener('click', () => {
        const next = !currentFrozen;
        socket.emit('wu:set-frozen', { pin, password: adminPw, frozen: next });
      });
    }
    // ⏱ Time-machine buttons — start/clear the shared countdown.
    document.querySelectorAll('.wu-timer-btn').forEach((b) => {
      if (b._wuBound) return; b._wuBound = true;
      b.addEventListener('click', () => {
        const sec = Number(b.dataset.sec) || 0;
        socket.emit('wu:set-timer', { pin, password: adminPw, seconds: sec });
        if (sec > 0 && MochiSounds && MochiSounds.tap) try { MochiSounds.tap(); } catch (_) {}
      });
    });
  }

  // Broadcast an effect to EVERY phone (server relays wu:fx to the room) so
  // the fun happens uniformly on player screens, not just the host.
  function broadcastFx(kind) {
    socket.emit('wu:fx', { pin, password: adminPw, kind });
  }
  // Host renders effects it receives from the relay (incl. its own).
  socket.on('wu:fx', (d) => { if (d && d.kind) fireFx(d.kind); });

  // === ASSISTANT ACTIVITY TICKER ===
  // Server emits wu:activity whenever a DELEGATE touches a word. Append a
  // line to the feed (most recent on top), capped to ~12 entries.
  socket.on('wu:activity', (a) => {
    const feed = $('wu-activity-feed');
    if (!feed || !a) return;
    const empty = feed.querySelector('.wu-activity-empty');
    if (empty) empty.remove();
    const w = (window.WU_WORD_BY_ID && a.wordId) ? window.WU_WORD_BY_ID[a.wordId] : null;
    const wordLabel = a.action === 'clear' ? 'toda la oración' : (w ? `${w.pinyin} · ${w.es}` : '—');
    const verb = a.action === 'clear' ? '🧹 borró todo'
               : a.action === 'remove' ? '🗑 quitó'
               : '➕ agregó';
    const time = new Date(a.t || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const row = document.createElement('div');
    row.className = 'wu-activity-row ' + (a.action === 'clear' ? 'is-clear' : a.action === 'remove' ? 'is-remove' : 'is-add');
    row.innerHTML = `
      <span class="wu-activity-who">${a.avatar || '🎓'} ${escapeHtml(a.name || 'Asistente')}</span>
      <span class="wu-activity-verb">${verb}</span>
      <span class="wu-activity-word">${escapeHtml(wordLabel)}</span>
      <span class="wu-activity-time">${time}</span>`;
    feed.insertBefore(row, feed.firstChild);
    while (feed.children.length > 12) feed.removeChild(feed.lastChild);
  });

  // === RAISE HAND === a kid wants to become an asistente. Flash a banner +
  // highlight their roster row + log it to the activity feed, so the teacher
  // notices and can tap 👑. Gamified request-to-join.
  socket.on('wu:hand', (h) => {
    if (!h || !h.name) return;
    if (MochiSounds.winFanfare) MochiSounds.winFanfare();
    else if (MochiSounds.correct) MochiSounds.correct();
    // Activity feed entry
    const feed = $('wu-activity-feed');
    if (feed) {
      const empty = feed.querySelector('.wu-activity-empty');
      if (empty) empty.remove();
      const row = document.createElement('div');
      row.className = 'wu-activity-row is-hand';
      const time = new Date(h.t || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      row.innerHTML = `
        <span class="wu-activity-who">${h.avatar || '🙋'} ${escapeHtml(h.name)}</span>
        <span class="wu-activity-verb">✋ quiere ser asistente</span>
        <span class="wu-activity-time">${time}</span>`;
      feed.insertBefore(row, feed.firstChild);
      while (feed.children.length > 12) feed.removeChild(feed.lastChild);
    }
    // Flash a floating banner
    const banner = document.createElement('div');
    banner.className = 'wu-hand-banner';
    banner.textContent = `✋ ${h.name} quiere ser asistente`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    setTimeout(() => { banner.classList.remove('show'); setTimeout(() => banner.remove(), 400); }, 3200);
    // Highlight their roster row if present
    const list = $('wu-roster-list');
    if (list) {
      list.querySelectorAll('.wu-roster-row').forEach((r) => {
        const nm = r.querySelector('.wu-roster-name');
        if (nm && nm.textContent === h.name) {
          r.classList.add('hand-raised');
          setTimeout(() => r.classList.remove('hand-raised'), 6000);
        }
      });
    }
  });

  // === RANDOM FUN === every 25–55s while the builder is live, auto-fire a
  // random delightful event so the room never feels monotonous. Heavily
  // weighted toward gentle confetti, occasionally the 6-7 swing jumpscare.
  let _funTimer = null;
  function startRandomFun() {
    if (_funTimer) return;
    // NOTE: 'shake' is intentionally NOT in the auto pool — it transforms the
    // whole page for ~0.7s and made taps land off-target. Teachers can still
    // fire shake manually from the FX row.
    const FUN = ['confetti', 'confetti', 'sixseven', 'rain', 'stars', 'confetti'];
    const tick = () => {
      const onActive = $('screen-active') && !$('screen-active').classList.contains('hidden');
      if (onActive && document.visibilityState !== 'hidden') {
        broadcastFx(FUN[Math.floor(Math.random() * FUN.length)]);
      }
      _funTimer = setTimeout(tick, 45000 + Math.random() * 45000);
    };
    _funTimer = setTimeout(tick, 45000 + Math.random() * 45000);
  }

  // === SPEAK (Google TTS via /api/tts → Web Speech fallback) ===
  let _ttsAudio = null;
  function _stopAllSpeech() {
    if (_ttsAudio) { try { _ttsAudio.pause(); _ttsAudio.removeAttribute('src'); _ttsAudio.load(); } catch (_) {} _ttsAudio = null; }
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); window.speechSynthesis.cancel(); } catch (_) {} }
  }
  function speakChinese(text, btn) {
    const clean = String(text || '').trim();
    if (!clean) return;
    _stopAllSpeech();
    let origText = '';
    const restore = () => { if (btn) { btn.classList.remove('speaking'); btn.textContent = origText; } };
    if (btn) { btn.classList.add('speaking'); origText = btn.textContent; btn.textContent = '🔊 …'; }
    const audio = new Audio();
    _ttsAudio = audio;
    let playedOnce = false, fellBack = false;
    const fallback = (reason) => {
      if (fellBack || playedOnce) return;
      fellBack = true;
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch (_) {}
      restore();
      if ('speechSynthesis' in window) {
        try {
          const u = new SpeechSynthesisUtterance(clean);
          u.lang = 'zh-CN'; u.rate = 0.85;
          u.onend = restore;
          window.speechSynthesis.speak(u);
        } catch (_) {}
      }
    };
    audio.addEventListener('canplay', () => { if (!fellBack) audio.play().then(() => { playedOnce = true; }).catch((e) => { if (!playedOnce) fallback(e.message); }); });
    audio.addEventListener('playing', () => { playedOnce = true; if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (_) {} } });
    audio.addEventListener('ended', restore);
    audio.addEventListener('error', () => { if (!playedOnce) fallback('audio error'); });
    const timeoutId = setTimeout(() => { if (!playedOnce) fallback('timeout'); }, 10000);
    audio.addEventListener('playing', () => clearTimeout(timeoutId));
    audio.src = '/api/tts?text=' + encodeURIComponent(clean);
    audio.load();
  }

  // === INTERACTIVE VFX === reuse lightweight DOM animations to gamify the
  // teacher's projected screen. All effects are pure CSS-animated emoji
  // elements appended to #wu-fx-layer (pointer-events:none), auto-cleaned.
  // 🦸 Character summons — anime/comic-style full-screen "ult" entrances.
  // Each: themed aura color + comic speed-lines + screen shake + the
  // transparent PNG slamming in. label = the battle-cry shown.
  const WU_CHARS = {
    gojo:   { color: '#5ab0ff', glow: '#a98bff', label: '無量空処 ∞', cry: '¡GOJO!' },
    yuji:   { color: '#ff5a5a', glow: '#ff2d2d', label: '黒閃 BLACK FLASH', cry: '¡YUJI!' },
    fnaf:   { color: '#ff3b3b', glow: '#7a0000', label: 'IT\'S ME', cry: '¡FNAF!' },
    shelly: { color: '#ffd23b', glow: '#ff9f1c', label: '¡SUPER!', cry: '¡SHELLY!' },
    dandy:  { color: '#5be8d1', glow: '#7bdf7b', label: '¡HOLA!', cry: '¡DANDY!' },
  };
  function wuCharFx(layer, kind) {
    const c = WU_CHARS[kind];
    document.body.classList.remove('wu-shake'); void document.body.offsetWidth;
    document.body.classList.add('wu-shake');
    setTimeout(() => document.body.classList.remove('wu-shake'), 700);
    const el = document.createElement('div');
    el.className = 'wu-fx-char';
    el.style.setProperty('--char-color', c.color);
    el.style.setProperty('--char-glow', c.glow);
    el.innerHTML = `
      <div class="wu-fx-char-lines"></div>
      <div class="wu-fx-char-aura"></div>
      <img class="wu-fx-char-img" alt="${kind}">
      <div class="wu-fx-char-cry">${c.label}</div>`;
    const img = el.querySelector('.wu-fx-char-img');
    _wuTransparentChar(kind, (url) => { img.src = url; });
    layer.appendChild(el);
    if (MochiSounds.combo) MochiSounds.combo();
    else if (MochiSounds.correct) MochiSounds.correct();
    setTimeout(() => el.remove(), 3200);
  }
  // Edge-flood chroma-key (downscaled + cached) — strips a solid background
  // matte from character PNGs so they're truly transparent. Falls back to raw.
  const _wuCharCache = {};
  function _wuTransparentChar(kind, cb) {
    const raw = '/assets/png-library/' + kind + '.png';
    // Gojo's white hair gets eaten by the chroma-key flood; leave him untouched.
    if (kind === 'gojo') { cb(raw); return; }
    if (_wuCharCache[kind]) { cb(_wuCharCache[kind]); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, 680 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        const id = ctx.getImageData(0, 0, w, h); const px = id.data;
        const at = (x, y) => (y * w + x) * 4;
        let br = 0, bg = 0, bb = 0, n = 0;
        for (let x = 0; x < w; x += Math.max(1, (w / 60) | 0)) { [0, h - 1].forEach((y) => { const o = at(x, y); if (px[o + 3] > 10) { br += px[o]; bg += px[o + 1]; bb += px[o + 2]; n++; } }); }
        if (!n) { _wuCharCache[kind] = raw; cb(raw); return; }
        br /= n; bg /= n; bb /= n;
        const T = 46 * 46 * 3;
        const close = (o) => { const dr = px[o] - br, dg = px[o + 1] - bg, db = px[o + 2] - bb; return (dr * dr + dg * dg + db * db) <= T; };
        const stack = []; const seen = new Uint8Array(w * h);
        for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
        for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }
        while (stack.length) {
          const y = stack.pop(), x = stack.pop(); const i = y * w + x;
          if (x < 0 || y < 0 || x >= w || y >= h || seen[i]) continue;
          const o = i * 4;
          if (px[o + 3] === 0 || close(o)) { seen[i] = 1; px[o + 3] = 0; stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1); }
        }
        ctx.putImageData(id, 0, 0);
        const url = cv.toDataURL('image/png');
        _wuCharCache[kind] = url; cb(url);
      } catch (e) { _wuCharCache[kind] = raw; cb(raw); }
    };
    img.onerror = () => { _wuCharCache[kind] = raw; cb(raw); };
    img.src = raw;
  }

  function fireFx(kind) {
    const layer = $('wu-fx-layer');
    if (!layer) return;
    if (MochiSounds.tap) MochiSounds.tap();
    if (WU_CHARS[kind]) { wuCharFx(layer, kind); return; }
    if (kind === 'shake') {
      document.body.classList.remove('wu-shake');
      void document.body.offsetWidth;
      document.body.classList.add('wu-shake');
      setTimeout(() => document.body.classList.remove('wu-shake'), 700);
      return;
    }
    if (kind === 'confetti') {
      const emojis = ['🎉', '✨', '🎊', '⭐', '🧧', '🐉'];
      for (let i = 0; i < 36; i++) {
        const el = document.createElement('div');
        el.className = 'wu-fx-confetti-bit';
        el.textContent = emojis[i % emojis.length];
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDelay = (Math.random() * 0.4) + 's';
        el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
        el.style.fontSize = (18 + Math.random() * 22) + 'px';
        layer.appendChild(el);
        setTimeout(() => el.remove(), 3200);
      }
      return;
    }
    if (kind === 'rain') {
      for (let i = 0; i < 40; i++) {
        const el = document.createElement('div');
        el.className = 'wu-fx-rain-drop';
        el.textContent = Math.random() < 0.5 ? '💧' : '🌧';
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDelay = (Math.random() * 0.8) + 's';
        el.style.animationDuration = (0.8 + Math.random() * 0.8) + 's';
        layer.appendChild(el);
        setTimeout(() => el.remove(), 2400);
      }
      return;
    }
    if (kind === 'sixseven') {
      // 6-7 swing jumpscare — the same mascot from the 6-7 game crashes
      // across the screen with a little dance + screen shake. Anti-monotony.
      document.body.classList.remove('wu-shake');
      void document.body.offsetWidth;
      document.body.classList.add('wu-shake');
      setTimeout(() => document.body.classList.remove('wu-shake'), 700);
      const el = document.createElement('div');
      el.className = 'wu-fx-67';
      el.innerHTML = '<img src="/assets/png-library/67-transparent.png" alt="6-7" onerror="this.replaceWith(document.createTextNode(\'6️⃣7️⃣\'))">';
      layer.appendChild(el);
      if (MochiSounds.combo) MochiSounds.combo();
      else if (MochiSounds.correct) MochiSounds.correct();
      setTimeout(() => el.remove(), 2600);
      return;
    }
    if (kind === 'flash') {
      // 💥 Full-screen color flash (a few quick strobes). Brief; never blocks
      // taps (pointer-events:none on the layer).
      const f = document.createElement('div');
      f.className = 'wu-fx-flash';
      layer.appendChild(f);
      if (MochiSounds.combo) MochiSounds.combo();
      setTimeout(() => f.remove(), 900);
      return;
    }
    if (kind === 'stars') {
      const em = ['⭐', '🌟', '✨', '💫'];
      for (let i = 0; i < 30; i++) {
        const el = document.createElement('div');
        el.className = 'wu-fx-confetti-bit';
        el.textContent = em[i % em.length];
        el.style.left = Math.random() * 100 + 'vw';
        el.style.animationDelay = (Math.random() * 0.4) + 's';
        el.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
        el.style.fontSize = (16 + Math.random() * 22) + 'px';
        layer.appendChild(el);
        setTimeout(() => el.remove(), 3200);
      }
      if (MochiSounds.correct) MochiSounds.correct();
      return;
    }
    // 'zombies' | 'moto' | 'tiger' all stampede across the screen.
    const isZombie = (kind === 'zombies');
    const isTiger = (kind === 'tiger');
    const glyphs = isZombie ? ['🧟', '🧟‍♂️', '🧟‍♀️']
                 : isTiger  ? ['🐯', '🐅', '🐯']
                 : ['🏍', '🏍️', '🛵'];
    const count = isTiger ? 5 : (isZombie ? 7 : 6);
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'wu-fx-runner ' + (isZombie ? 'is-zombie' : isTiger ? 'is-tiger' : 'is-moto');
      el.textContent = glyphs[i % glyphs.length];
      const r2l = Math.random() < 0.5;
      el.classList.add(r2l ? 'from-right' : 'from-left');
      el.style.top = (15 + Math.random() * 65) + 'vh';
      el.style.animationDelay = (Math.random() * 0.6) + 's';
      el.style.animationDuration = ((isZombie ? 3.2 : isTiger ? 2.4 : 1.8) + Math.random() * 1.2) + 's';
      el.style.fontSize = (34 + Math.random() * 22) + 'px';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }
  }
})();
