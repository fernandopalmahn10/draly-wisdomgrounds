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

  // ── 📖 LECTURA EN CLASE — folder picker of stories by HSK1 experience.
  // ════════════════════════════════════════════════════════════════
  // 🚀 UNIVERSAL LAUNCHER — Fernando 2026-06-04
  //
  // Pick any host page, pick online kids, kids get force-imposed when
  // the host page's PIN appears. Uses sessionStorage + ?autohost=1 +
  // the shared /js/auto-host.js runner.
  //
  // Each game card describes:
  //   id          — internal slug (for analytics later)
  //   label       — what the teacher sees on the card
  //   emoji       — big icon on the card
  //   hostUrl     — host page to open (no PIN in URL — host creates one)
  //   kidUrlTpl   — template for the kid's URL, '{PIN}' substituted
  //                 by auto-host.js when the host page's PIN appears
  //   blurb       — one-line description shown on the card
  // ════════════════════════════════════════════════════════════════
  // 🆕 2026-06-04 v3 (Fernando bug fix): kidUrlTpl MUST include
  // &autojoin=1 — without it, player.html just fills the PIN input
  // and shows the join screen. With it, the kid auto-joins as soon
  // as &name= is also present (the homework client splices that in
  // before redirect). Bug was: kids saw "Tu maestra te llama" but
  // then landed on the join screen instead of being pulled in.
  // hsk-sim.html has its own auto-join path and doesn't need it.
  // 🆕 2026-06-04 v4 (Fernando: "force games doesn't bring anyone in"):
  // Rewritten to use the PROVEN per-game patterns instead of a generic
  // autohost script. Each entry's `launch` function does what's known
  // to work for THAT game.
  //   - warmup: ?livemaster=1 + sessionStorage.dralyLiveMaster
  //     (the proven Modo Maestro flow — already in use for weeks)
  //   - hsksim: ?access=&sim= (the proven HSK button flow)
  //   - others: open the host page; teacher sees the PIN and we send
  //     a soft "Tu maestra te llama" notification when kids click in.
  //     Honest about what works vs what doesn't.
  // Also expanded to include ALL 18 host pages so Fernando can see
  // the full game catalog.
  const LAUNCHER_GAMES = [
    {
      id: 'warmup', label: 'Modo Maestro', emoji: '✏️',
      blurb: 'Arma oraciones HSK1 en vivo · ★ Auto-fuerza',
      launch: (ctx) => {
        try {
          sessionStorage.setItem('dralyLiveMaster', JSON.stringify({
            codes: ctx.codes, pw: ctx.pw, text: '¡Entra a Modo Maestro ahora!', ts: Date.now(),
          }));
        } catch (_) { alert('No se pudo guardar la sesión.'); return; }
        // 🆕 v4: SAME tab navigation (was window.open). Mobile browsers
        // throttle background tabs, breaking the force flow. Proven
        // path matches the existing Modo Maestro button.
        location.href = '/host-warmup.html?livemaster=1';
      },
    },
    {
      id: 'reading', label: 'Lectura en clase', emoji: '📖',
      blurb: 'Lectura guiada con karaoke + test al final',
      launch: (ctx) => _genericLaunch(ctx, '/host-reading.html', '/player.html'),
    },
    {
      id: 'hsksim', label: 'Simulación HSK', emoji: '🏆',
      blurb: 'Examen oficial HSK1 — Sim 1, 2 o 3 · ★ Auto-fuerza',
      launch: (ctx) => {
        // Reuse the existing HSK button's proven pattern. Default to Sim 1.
        const simId = ctx.simId || 'hsk1-sim1';
        const accessCode = (new URLSearchParams(location.search)).get('access')
          || localStorage.getItem('mochi.accessCode') || '';
        fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(ctx.pw), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentCodes: ctx.codes,
            text: '🏆 La maestra te está abriendo la simulación HSK ahora. Prepárate.',
            actionType: 'force',
            actionUrl: '/hsk-sim.html?access=' + encodeURIComponent(accessCode) + '&sim=' + encodeURIComponent(simId),
            actionLabel: 'Entrar al examen →',
          }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) {
              const monitorUrl = '/host-hsk.html'
                + '?sim=' + encodeURIComponent(simId)
                + '&access=' + encodeURIComponent(accessCode)
                + '&pw=' + encodeURIComponent(ctx.pw);
              // 🆕 2026-06-16 (Fernando): SAME-TAB nav (mobile popup-block fix).
              location.href = monitorUrl;
            } else {
              alert('Error: ' + ((res && res.error) || 'no se pudo enviar'));
            }
          });
      },
    },
    { id: 'laiquhui',  label: 'Lái-Qù-Huí Dragón',  emoji: '🐉', blurb: 'Reparte paquetes por la ciudad', launch: (ctx) => _genericLaunch(ctx, '/host-laiquhui.html', '/player.html') },
    { id: 'identity',  label: 'Detective Shéi Shì', emoji: '🕵️', blurb: 'Adivina el sospechoso con pistas', launch: (ctx) => _genericLaunch(ctx, '/host-identity.html', '/player.html') },
    { id: 'triage',    label: 'Sala de emergencia', emoji: '🚑', blurb: 'Cura pacientes con vocab médico',  launch: (ctx) => _genericLaunch(ctx, '/host-triage.html', '/player.html') },
    { id: 'partyrun',  label: 'Hóngbāo Run',        emoji: '🎲', blurb: 'Mario-Party con preguntas HSK1',  launch: (ctx) => _genericLaunch(ctx, '/host-partyrun.html', '/player.html') },
    { id: 'sixseven',  label: '6-7 Swing',          emoji: '🤙', blurb: 'Mate rápido + números chinos',    launch: (ctx) => _genericLaunch(ctx, '/host-sixseven.html', '/player.html') },
    { id: 'monopoly',  label: 'HSK Monopoly',       emoji: '🏘️', blurb: 'Tablero estilo Monopoly',         launch: (ctx) => _genericLaunch(ctx, '/host-monopoly.html', '/player.html') },
    { id: 'conquest',  label: 'Conquista',          emoji: '⚔️', blurb: 'Conquista hexágonos',             launch: (ctx) => _genericLaunch(ctx, '/host-conquest.html', '/player.html') },
    { id: 'family',    label: 'Mi Familia',         emoji: '👨‍👩‍👧', blurb: 'Familia HSK1',                  launch: (ctx) => _genericLaunch(ctx, '/host-family.html', '/player.html') },
    { id: 'mochi',     label: 'Mochi Mash',         emoji: '🍡', blurb: 'Mash de vocab clásico',           launch: (ctx) => _genericLaunch(ctx, '/host.html',          '/player.html') },
    { id: 'pinata',    label: 'Piñata',             emoji: '🪅', blurb: 'Rompe la piñata',                 launch: (ctx) => _genericLaunch(ctx, '/host-pinata.html',   '/player.html') },
    { id: 'flappy',    label: 'Flappy Dragón',      emoji: '🐲', blurb: 'Flappy Bird HSK1',                launch: (ctx) => _genericLaunch(ctx, '/host-flappy.html',   '/player.html') },
    { id: 'zombie',    label: 'Zombie Defense',     emoji: '🧟', blurb: 'Defiende con vocab HSK1',         launch: (ctx) => _genericLaunch(ctx, '/host-zombie.html',   '/player.html') },
    { id: 'dragon',    label: 'Dragon Eye',         emoji: '👁️', blurb: 'Ojo del dragón',                  launch: (ctx) => _genericLaunch(ctx, '/host-dragon.html',   '/player.html') },
    { id: 'color-clash',   label: 'Color Clash',    emoji: '🎨', blurb: 'Pinta en equipos',                launch: (ctx) => _genericLaunch(ctx, '/host-clash.html',    '/player.html') },
    { id: 'color-splash',  label: 'Color Splash',   emoji: '💦', blurb: 'Salpicaduras de color',           launch: (ctx) => _genericLaunch(ctx, '/host-color.html',    '/player.html') },
    { id: 'market',    label: 'Market Quest',       emoji: '🛒', blurb: 'Mercado tradicional',             launch: (ctx) => _genericLaunch(ctx, '/host-market.html',   '/player.html') },
  ];
  // 🆕 2026-06-04 v4 — universal force launch using ?livegame=1.
  // Same pattern as ?livemaster=1 for warmup, generalized for non-gated
  // host pages. Stashes payload, opens host page with the flag, and
  // /js/live-game.js (loaded on every host page) monitors for the PIN
  // and force-imposes the selected kids the moment it appears.
  // Kid URL is /player.html?pin=PIN&autojoin=1 — player.js auto-joins.
  function _genericLaunch(ctx, hostUrl /*, kidLandingUrl */) {
    try {
      sessionStorage.setItem('dralyLiveGame', JSON.stringify({
        codes: ctx.codes,
        pw: ctx.pw,
        label: ctx.label,
        ts: Date.now(),
      }));
    } catch (_) { alert('No se pudo guardar la sesión.'); return; }
    const url = hostUrl + (hostUrl.includes('?') ? '&' : '?') + 'livegame=1';
    // 🆕 v4 (Fernando bug — mobile background-tab throttling):
    // SAME tab navigation, not window.open. Mobile browsers throttle
    // setInterval in background tabs, so live-game.js's PIN polling
    // can stall for minutes. Matches the PROVEN Modo Maestro pattern
    // (location.href = '/host-warmup.html?livemaster=1'). Teacher can
    // go back to /maestro via browser back button if they need to.
    location.href = url;
  }
  function openUniversalLauncher() {
    // Pull the most-recent online students. Reuse the existing roster API.
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { alert('No se pudo cargar la lista de alumnos.'); return; }
        const students = (data.students || []).slice().sort((a, b) => {
          const an = (a.displayName || a.code || '').toLowerCase();
          const bn = (b.displayName || b.code || '').toLowerCase();
          return an < bn ? -1 : an > bn ? 1 : 0;
        });
        let overlay = document.getElementById('m-launch-modal');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'm-launch-modal';
        overlay.className = 'm-modal';
        const gameCardsHtml = LAUNCHER_GAMES.map((g) =>
          '<button class="m-launch-game" data-id="' + escapeHtml(g.id) + '" type="button">' +
            '<span class="m-launch-game-emoji">' + g.emoji + '</span>' +
            '<span class="m-launch-game-label">' + escapeHtml(g.label) + '</span>' +
            '<span class="m-launch-game-blurb">' + escapeHtml(g.blurb) + '</span>' +
          '</button>'
        ).join('');
        // 🆕 2026-06-04 v2 (Fernando): Default view is "🟢 En línea
        // ahora" as its OWN tab (not just a button), so the teacher
        // sees the relevant kids immediately. Toggle to "📋 Todos" to
        // see the full roster.
        const onlineCount = students.filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000).length;
        overlay.innerHTML =
          '<div class="m-modal-card" style="max-width:760px;">' +
            '<button class="m-modal-close" type="button" aria-label="Cerrar">✕</button>' +
            '<h2>🚀 Lanzar juego</h2>' +
            '<p class="m-modal-sub">Elige un juego y los alumnos seleccionados entrarán automáticamente cuando aparezca el PIN.</p>' +
            '<div class="m-launch-section-h">1) Elige el juego</div>' +
            '<div class="m-launch-games">' + gameCardsHtml + '</div>' +
            '<div class="m-launch-section-h">2) Elige los alumnos</div>' +
            '<div class="m-launch-stu-tabs" role="tablist">' +
              '<button class="m-launch-stu-tab is-active" data-stu="online" type="button">🟢 En línea ahora <span class="m-launch-stu-n">' + onlineCount + '</span></button>' +
              '<button class="m-launch-stu-tab" data-stu="all" type="button">📋 Todos <span class="m-launch-stu-n">' + students.length + '</span></button>' +
            '</div>' +
            '<div class="m-force-actions">' +
              '<button class="btn btn-ghost btn-sm" id="m-lc-all" type="button">✅ Todos visibles</button>' +
              '<button class="btn btn-ghost btn-sm" id="m-lc-none" type="button">⬜ Ninguno</button>' +
            '</div>' +
            '<div class="m-force-students" id="m-lc-list" style="max-height:32vh;overflow-y:auto;"></div>' +
            '<button class="btn btn-jade btn-xl" id="m-lc-go" disabled style="margin-top:14px;width:100%;">🚀 Elige un juego primero</button>' +
          '</div>';
        document.body.appendChild(overlay);
        const list = overlay.querySelector('#m-lc-list');
        let stuFilter = 'online';   // 'online' | 'all'
        function renderStudents() {
          list.innerHTML = '';
          let shown = students;
          if (stuFilter === 'online') {
            shown = students.filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 30 * 1000);
          }
          if (!shown.length) {
            list.innerHTML = '<div class="m-launch-empty">' +
              (stuFilter === 'online'
                ? 'Nadie está en línea ahora mismo. Cambia a 📋 Todos para ver al grupo completo.'
                : 'No hay alumnos.') +
              '</div>';
            return;
          }
          shown.forEach((s) => {
            // 🆕 2026-06-04 v3 (Fernando: "Solo en línea displays
            // everything") — tighten window to 30s. lastSeen is touched
            // by many background events including admin reads; 60s was
            // letting half-stale records through.
            const isOnline = s.lastSeen && (Date.now() - s.lastSeen) <= 30 * 1000;
            const row = document.createElement('label');
            row.className = 'm-force-row';
            row.dataset.online = isOnline ? '1' : '0';
            // Default checked = on (when in online tab); off in "all" tab
            row.innerHTML =
              '<input type="checkbox" data-code="' + escapeHtml(s.code) + (stuFilter === 'online' ? '" checked>' : '">') +
              '<span class="m-force-row-dot" style="background:' + (isOnline ? '#5be88a' : '#666') + ';"></span>' +
              '<span class="m-force-row-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
              '<span class="m-force-row-code">' + escapeHtml(s.code) + '</span>';
            list.appendChild(row);
          });
        }
        renderStudents();
        overlay.querySelectorAll('.m-launch-stu-tab').forEach((t) => {
          t.addEventListener('click', () => {
            overlay.querySelectorAll('.m-launch-stu-tab').forEach((x) => x.classList.remove('is-active'));
            t.classList.add('is-active');
            stuFilter = t.dataset.stu;
            renderStudents();
            updateGo();
          });
        });
        let chosen = null;
        const goBtn = overlay.querySelector('#m-lc-go');
        function updateGo() {
          if (!chosen) { goBtn.disabled = true; goBtn.textContent = '🚀 Elige un juego primero'; return; }
          const n = list.querySelectorAll('input[type=checkbox]:checked').length;
          goBtn.disabled = !n;
          goBtn.textContent = n
            ? '🚀 Lanzar ' + chosen.label + ' a ' + n + ' alumno(s)'
            : '⬜ Elige al menos un alumno';
        }
        overlay.querySelectorAll('.m-launch-game').forEach((card) => {
          card.addEventListener('click', () => {
            overlay.querySelectorAll('.m-launch-game').forEach((c) => c.classList.remove('is-active'));
            card.classList.add('is-active');
            chosen = LAUNCHER_GAMES.find((g) => g.id === card.dataset.id);
            updateGo();
          });
        });
        list.addEventListener('change', updateGo);
        const close = () => { try { overlay.remove(); } catch (_) {} };
        overlay.querySelector('.m-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('#m-lc-all').addEventListener('click', () => {
          list.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = true; });
          updateGo();
        });
        overlay.querySelector('#m-lc-none').addEventListener('click', () => {
          list.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = false; });
          updateGo();
        });
        list.addEventListener('change', updateGo);
        goBtn.addEventListener('click', () => {
          if (!chosen) return;
          const codes = Array.from(list.querySelectorAll('input[type=checkbox]:checked'))
            .map((cb) => cb.dataset.code).filter(Boolean);
          if (!codes.length) return;
          // 🆕 v4: each game's `launch` function does what's known to
          // work for THAT game. No more generic autohost script.
          if (typeof chosen.launch !== 'function') {
            alert('Este juego aún no tiene una vía de lanzamiento.');
            return;
          }
          chosen.launch({ pw, codes, label: chosen.label });
          close();
        });
      })
      .catch((e) => alert('Error: ' + e.message));
  }
  const launchBtn = $('m-launch-btn');
  if (launchBtn) launchBtn.addEventListener('click', openUniversalLauncher);

  // Teacher clicks a story → host-reading.html opens in a new tab pre-
  // selected to that story. Kids join via PIN. After they do the test
  // live, that story unlocks for them to repeat at home.
  const rdBtn = $('m-reading-btn');
  const rdModal = $('m-reading-modal');
  if (rdBtn && rdModal) {
    rdBtn.addEventListener('click', () => {
      rdModal.classList.remove('hidden');
      loadReadingFolders();
    });
  }
  if ($('m-reading-close')) {
    $('m-reading-close').addEventListener('click', () => rdModal.classList.add('hidden'));
  }
  if (rdModal) {
    rdModal.addEventListener('click', (e) => { if (e.target === rdModal) rdModal.classList.add('hidden'); });
  }
  function loadReadingFolders() {
    const wrap = $('m-reading-folders');
    if (!wrap) return;
    wrap.textContent = 'Cargando…';
    fetch('/api/reading/stories')
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok || !Array.isArray(d.stories)) {
          wrap.textContent = 'No se pudo cargar.';
          return;
        }
        renderReadingFolders(d.stories);
      })
      .catch(() => { wrap.textContent = 'Error de red.'; });
  }
  function renderReadingFolders(stories) {
    const wrap = $('m-reading-folders');
    if (!wrap) return;
    const exps = (window.WU_EXPERIENCES) || {
      exp1: { label: 'EXP1 · Yo / Familia',   short: '👋 EXP1' },
      exp2: { label: 'EXP2',                  short: '📘 EXP2' },
      exp3: { label: 'EXP3',                  short: '📗 EXP3' },
      exp4: { label: 'EXP4',                  short: '📕 EXP4' },
      exp5: { label: 'EXP5',                  short: '📔 EXP5' },
      exp6: { label: 'EXP6',                  short: '📙 EXP6' },
      exp7: { label: 'EXP7',                  short: '📓 EXP7' },
      exp8: { label: 'EXP8',                  short: '🌧️ EXP8' },
    };
    // Group by exp tag, then sort experiences exp1 → exp8.
    const byExp = {};
    stories.forEach((s) => {
      const k = s.exp || 'exp1';
      if (!byExp[k]) byExp[k] = [];
      byExp[k].push(s);
    });
    const order = ['exp1','exp2','exp3','exp4','exp5','exp6','exp7','exp8'];
    wrap.innerHTML = '';
    let totalFolders = 0;
    order.forEach((k) => {
      if (!byExp[k] || !byExp[k].length) return;
      totalFolders++;
      const exp = exps[k] || { label: k, short: k.toUpperCase() };
      const folder = document.createElement('div');
      folder.className = 'm-reading-folder';
      folder.innerHTML = '<div class="m-reading-folder-title">' + escapeHtml(exp.label) + '</div>';
      const grid = document.createElement('div');
      grid.className = 'm-reading-folder-grid';
      byExp[k].forEach((s) => {
        const card = document.createElement('div');
        card.className = 'm-reading-card';
        // 🩹 REVERTED 2026-06-03 — using the 22 MB Yugi GIF as a cover
        // burned bandwidth (loaded for every teacher who opened the
        // picker). Back to static page-1.png until the compressed
        // ~1 MB version is ready.
        const coverUrl = '/assets/reading/' + s.id + '/page-1.png';
        card.innerHTML =
          '<div class="m-reading-card-cover" style="background-image:url(\'' + coverUrl + '\');"></div>' +
          '<div class="m-reading-card-body">' +
            '<div class="m-reading-card-title">📖 ' + escapeHtml(s.title || s.id) + '</div>' +
            '<div class="m-reading-card-sub">' + escapeHtml(s.subtitle || '') + '</div>' +
            '<div class="m-reading-card-meta">' + (s.pageCount || 0) + ' páginas · ' + (s.questionCount || 0) + ' preguntas</div>' +
          '</div>' +
          '<div class="m-reading-card-actions">' +
            '<button class="m-reading-launch" type="button" data-story="' + escapeHtml(s.id) + '">Lanzar ›</button>' +
            '<button class="m-reading-force" type="button" data-story="' + escapeHtml(s.id) + '" title="Lanza la lectura Y la fuerza en alumnos en línea">🎯 Forzar</button>' +
          '</div>';
        // Regular launch — no force
        card.querySelector('.m-reading-launch').addEventListener('click', () => {
          window.open('/host-reading.html?story=' + encodeURIComponent(s.id), '_blank', 'noopener');
        });
        // 🎯 Force-impose flow — pick online students then launch + invite
        card.querySelector('.m-reading-force').addEventListener('click', () => {
          openForceReadingPicker(s);
        });
        grid.appendChild(card);
      });
      folder.appendChild(grid);
      wrap.appendChild(folder);
    });
    if (!totalFolders) wrap.textContent = 'No hay historias todavía.';
  }
  // 🎯 Force-reading picker — modal that shows ONLINE students and lets
  // the teacher tick which ones to force into the story. On confirm,
  // opens host-reading.html in a new tab with ?story=X&forceCodes=...
  // The host page then pushes inbox force-messages with its newly
  // generated PIN, and the kids' homework pages auto-redirect.
  function openForceReadingPicker(story) {
    // Pull the latest student list and filter to online-now client-side.
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          alert('No se pudo cargar la lista de alumnos en línea.');
          return;
        }
        const onlineNow = (data.students || []).filter((s) => {
          // "online" = lastSeen within last 60 seconds
          return s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000;
        });
        if (!onlineNow.length) {
          alert('No hay alumnos en línea ahora mismo.\n\n(Pídeles que abran /homework primero.)');
          return;
        }
        // Build the modal
        let overlay = document.getElementById('m-force-reading-modal');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'm-force-reading-modal';
        overlay.className = 'm-modal';
        overlay.innerHTML = `
          <div class="m-modal-card">
            <button class="m-modal-close" type="button" aria-label="Cerrar">✕</button>
            <h2>🎯 Forzar lectura</h2>
            <p class="m-modal-sub">Lectura: <strong>📖 ${escapeHtml(story.title || story.id)}</strong></p>
            <p class="m-modal-sub" style="margin-top:6px;">Selecciona los alumnos en línea ahora. Recibirán un aviso y entrarán automáticamente en ~20 segundos.</p>
            <div class="m-force-actions">
              <button class="btn btn-ghost btn-sm" id="m-force-all">✅ Todos</button>
              <button class="btn btn-ghost btn-sm" id="m-force-none">⬜ Ninguno</button>
            </div>
            <div class="m-force-students" id="m-force-students"></div>
            <button class="btn btn-jade btn-xl" id="m-force-launch" style="margin-top:16px;width:100%;">
              🚀 Lanzar y forzar a alumnos seleccionados
            </button>
          </div>`;
        document.body.appendChild(overlay);
        // Render student checkboxes
        const list = overlay.querySelector('#m-force-students');
        onlineNow.forEach((s) => {
          const row = document.createElement('label');
          row.className = 'm-force-row';
          row.innerHTML =
            '<input type="checkbox" data-code="' + escapeHtml(s.code) + '" checked>' +
            '<span class="m-force-row-dot"></span>' +
            '<span class="m-force-row-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
            '<span class="m-force-row-code">' + escapeHtml(s.code) + '</span>';
          list.appendChild(row);
        });
        // Wire close
        const close = () => { try { overlay.remove(); } catch (_) {} };
        overlay.querySelector('.m-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        // All / None
        overlay.querySelector('#m-force-all').addEventListener('click', () => {
          list.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = true; });
        });
        overlay.querySelector('#m-force-none').addEventListener('click', () => {
          list.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = false; });
        });
        // Launch
        overlay.querySelector('#m-force-launch').addEventListener('click', () => {
          const codes = Array.from(list.querySelectorAll('input[type=checkbox]:checked'))
            .map((cb) => cb.dataset.code).filter(Boolean);
          if (!codes.length) {
            alert('Selecciona al menos un alumno.');
            return;
          }
          const url = '/host-reading.html?story=' + encodeURIComponent(story.id)
            + '&forceCodes=' + encodeURIComponent(codes.join(','));
          window.open(url, '_blank', 'noopener');
          close();
        });
      })
      .catch((e) => { alert('Error: ' + e.message); });
  }

  // ── 🏆 HSK SIMULATION launcher (folder → level → variation) ──────
  // Three-level drill-down so the modal scales as more sims are added:
  //   🏆 Simulación HSK
  //     ├ HSK1
  //     │   ├ Simulación 1
  //     │   ├ Simulación 2 …
  //     ├ HSK2 → Simulación 1 …
  //   …
  // Sim IDs follow the convention `hsk{level}-sim{n}` (e.g. hsk1-sim1).
  // The server's /api/hsk-sim/list returns every available sim flat; we
  // group them client-side by the level prefix.
  const hskBtn = $('m-hsk-btn');
  const hskModal = $('m-hsk-modal');
  const HSK_LEVELS = [
    { id: 1, label: 'HSK1', subtitle: '6 partes · 30 preguntas · principiante' },
    { id: 2, label: 'HSK2', subtitle: 'Próximamente' },
    { id: 3, label: 'HSK3', subtitle: 'Próximamente' },
    { id: 4, label: 'HSK4', subtitle: 'Próximamente' },
    { id: 5, label: 'HSK5', subtitle: 'Próximamente' },
    { id: 6, label: 'HSK6', subtitle: 'Próximamente' },
  ];
  let _hskCachedSims = null;   // memoize the flat sim list (one fetch)
  let _hskNavStack   = ['root']; // path: ['root'] | ['root', levelId] | …

  if (hskBtn) hskBtn.addEventListener('click', () => {
    hskModal.classList.remove('hidden');
    _hskNavStack = ['root'];
    renderHskView();
  });
  // 🏅 New top-level shortcut into the Resultados HSK view —
  // user asked for this to be more discoverable.
  const hskResultsBtn = $('m-hsk-results-btn');
  if (hskResultsBtn) hskResultsBtn.addEventListener('click', () => {
    hskModal.classList.remove('hidden');
    _hskNavStack = ['root', 'results'];
    renderHskView();
  });
  if ($('m-hsk-close')) $('m-hsk-close').addEventListener('click', () => hskModal.classList.add('hidden'));
  if (hskModal) hskModal.addEventListener('click', (e) => { if (e.target === hskModal) hskModal.classList.add('hidden'); });

  // Lazy fetch the sim list once; cached for the rest of this session.
  function ensureHskSims() {
    if (_hskCachedSims) return Promise.resolve(_hskCachedSims);
    return fetch('/api/hsk-sim/list')
      .then((r) => r.json())
      .then((data) => {
        _hskCachedSims = (data && data.sims) || [];
        return _hskCachedSims;
      });
  }
  // Group flat sims by the level prefix in their ID (hsk1-sim1 → 1).
  function _hskParseLevel(simId) {
    const m = String(simId || '').match(/^hsk(\d+)-/i);
    return m ? Number(m[1]) : null;
  }

  // 🆕 2026-06-16 (Fernando): migrate a misplaced HSK attempt to the
  // correct student code. Prompts for the target code, confirms, posts
  // to the migrate endpoint, then re-renders the results list so the
  // attempt now shows under the right student everywhere.
  function _migrateHskResult(r) {
    const label = (r.displayName || 'Anon') + ' (' + r.code + ') · ' + (r.simId || '').toUpperCase() + ' · ' + r.percent + '%';
    const toCode = prompt(
      'Migrar este resultado:\n  ' + label + '\n\n' +
      'Escribe el CÓDIGO de estudiante correcto al que debe pertenecer ' +
      'este examen (aparecerá en su Cuaderno, Mis Exámenes y sección de Papás):'
    );
    if (toCode === null) return;                 // cancelled
    const clean = String(toCode).trim().toUpperCase();
    if (!clean) return;
    if (clean === r.code) { alert('Ese es el mismo código. No hay nada que migrar.'); return; }
    fetch('/api/admin/hsk-result/migrate?pw=' + encodeURIComponent(pw), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromCode: r.code, ts: r.ts, toCode: clean }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (!res || !res.ok) { alert('No se pudo migrar: ' + ((res && res.error) || 'desconocido')); return; }
        alert('✅ Resultado migrado a ' + res.toName + ' (' + res.toCode + '). Ya aparece en su historial.');
        renderHskView();                          // refresh the list
      })
      .catch((e) => alert('Error: ' + e.message));
  }

  function renderHskView() {
    const view  = $('m-hsk-view');
    const title = $('m-hsk-title');
    const sub   = $('m-hsk-sub');
    const crumb = $('m-hsk-crumb');
    if (!view) return;
    // Rebuild the breadcrumb every render.
    crumb.innerHTML = '';
    _hskNavStack.forEach((step, idx) => {
      const isLast = idx === _hskNavStack.length - 1;
      const span = document.createElement(isLast ? 'span' : 'button');
      span.className = 'm-hsk-crumb-link' + (isLast ? ' is-current' : '');
      if (!isLast) {
        span.type = 'button';
        span.addEventListener('click', () => {
          _hskNavStack = _hskNavStack.slice(0, idx + 1);
          renderHskView();
        });
      }
      span.textContent =
          step === 'root'    ? '🏆 Simulación HSK'
        : step === 'results' ? '🏅 Resultados'
        : ('HSK' + step);
      crumb.appendChild(span);
      if (!isLast) {
        const sep = document.createElement('span');
        sep.className = 'm-hsk-crumb-sep';
        sep.textContent = ' › ';
        crumb.appendChild(sep);
      }
    });
    // ─── RESULTS view — list every student's HSK exam outcomes ──
    if (_hskNavStack[0] === 'root' && _hskNavStack[1] === 'results') {
      title.textContent = '🏅 Resultados HSK';
      sub.textContent = 'Cada examen entregado por tus alumnos. Más recientes primero.';
      view.textContent = 'Cargando…';
      fetch('/api/hsk-sim/results?pw=' + encodeURIComponent(pw))
        .then((r) => r.json())
        .then((d) => {
          view.innerHTML = '';
          const rows = (d && d.results) || [];
          if (!rows.length) {
            view.innerHTML = '<p class="m-modal-sub" style="text-align:center;">Aún nadie ha terminado un examen HSK.</p>';
            return;
          }
          const hint = document.createElement('p');
          hint.className = 'm-modal-sub';
          hint.style.cssText = 'text-align:center;margin-bottom:8px;';
          hint.innerHTML = '👆 Toca un resultado para <strong>migrarlo</strong> a otro código (si el alumno lo hizo desde la cuenta equivocada).';
          view.appendChild(hint);
          const list = document.createElement('div');
          list.className = 'm-hsk-results-list';
          rows.forEach((r) => {
            const when = new Date(r.ts || 0).toLocaleString();
            const cls = r.percent >= 90 ? 'is-great' : r.percent >= 60 ? 'is-ok' : 'is-low';
            const item = document.createElement('div');
            item.className = 'm-hsk-result-row ' + cls;
            item.style.cursor = 'pointer';
            item.title = 'Toca para migrar este resultado a otro código de estudiante';
            // 🆕 2026-06-16 (Fernando): show BOTH the name AND the student
            // code so the teacher can tell accounts apart, and tap to
            // migrate a misplaced attempt to the correct student.
            item.innerHTML =
              '<div class="m-hsk-result-name">' +
                '<strong>' + escapeHtml(r.displayName || 'Anon') + '</strong>' +
                '<span class="m-hsk-result-code" style="font-size:0.78rem;color:var(--ink-dim);font-weight:700;margin-left:6px;">🔑 ' + escapeHtml(r.code) + '</span>' +
                '<span class="m-hsk-result-when">' + escapeHtml(when) + '</span>' +
              '</div>' +
              '<div class="m-hsk-result-sim">' + escapeHtml((r.simId || '').toUpperCase()) + '</div>' +
              '<div class="m-hsk-result-score">' +
                '<span class="m-hsk-result-pct">' + r.percent + '%</span>' +
                '<span class="m-hsk-result-pts">' + r.score + ' / ' + r.total + '</span>' +
              '</div>';
            item.addEventListener('click', () => _migrateHskResult(r));
            list.appendChild(item);
          });
          view.appendChild(list);
        })
        .catch((e) => { view.textContent = 'Error: ' + e.message; });
      return;
    }
    // ─── ROOT view — pick an HSK level (+ shortcut to results) ──
    if (_hskNavStack.length === 1) {
      title.textContent = '🏆 Simulación HSK';
      sub.textContent = 'Elige el nivel HSK, o mira los resultados de tus alumnos.';
      view.innerHTML = '';
      // Quick-access "ver resultados" tile at the top
      const top = document.createElement('div');
      top.className = 'm-hsk-results-cta';
      top.innerHTML =
        '<button class="btn btn-jade btn-xl" id="m-hsk-results-open" style="width:100%;">' +
          '🏅 Ver quiénes terminaron + sus notas →' +
        '</button>';
      view.appendChild(top);
      top.querySelector('#m-hsk-results-open').addEventListener('click', () => {
        _hskNavStack = ['root', 'results'];
        renderHskView();
      });

      const grid = document.createElement('div');
      grid.className = 'm-reading-folder-grid';
      HSK_LEVELS.forEach((lvl) => {
        const card = document.createElement('div');
        card.className = 'm-reading-card';
        card.innerHTML =
          '<div class="m-reading-card-body">' +
            '<div class="m-reading-card-title">🎓 ' + escapeHtml(lvl.label) + '</div>' +
            '<div class="m-reading-card-sub">' + escapeHtml(lvl.subtitle) + '</div>' +
          '</div>' +
          '<div class="m-reading-card-actions">' +
            '<button class="m-reading-launch" type="button">Abrir ›</button>' +
          '</div>';
        card.querySelector('.m-reading-launch').addEventListener('click', () => {
          _hskNavStack = ['root', lvl.id];
          renderHskView();
        });
        grid.appendChild(card);
      });
      view.appendChild(grid);
      return;
    }
    // ─── LEVEL view — list every Simulación N for that HSK level ─
    const levelId = _hskNavStack[1];
    title.textContent = '🎓 HSK' + levelId;
    sub.textContent = 'Elige una simulación.';
    view.textContent = 'Cargando…';
    ensureHskSims().then((all) => {
      const sims = all.filter((s) => _hskParseLevel(s.id) === levelId);
      view.innerHTML = '';
      if (!sims.length) {
        view.innerHTML = '<p class="m-modal-sub" style="text-align:center;">Aún no hay simulaciones para HSK' + levelId + '. Pronto.</p>';
        return;
      }
      const grid = document.createElement('div');
      grid.className = 'm-reading-folder-grid';
      sims.forEach((sim) => {
        const card = document.createElement('div');
        card.className = 'm-reading-card';
        card.innerHTML =
          '<div class="m-reading-card-body">' +
            '<div class="m-reading-card-title">🏆 ' + escapeHtml(sim.title || sim.id) + '</div>' +
            '<div class="m-reading-card-sub">' + escapeHtml(sim.subtitle || '') + '</div>' +
            '<div class="m-reading-card-meta">' + (sim.questionCount || 0) + ' preguntas · ' + (sim.partCount || 0) + ' partes</div>' +
          '</div>' +
          '<div class="m-reading-card-actions">' +
            '<button class="m-reading-force" type="button" data-sim="' + escapeHtml(sim.id) + '" title="Abre la sala HSK con PIN — los alumnos se unen escribiendo el PIN">🚀 Abrir sala con PIN ›</button>' +
          '</div>';
        // 🏆 NEW: launching a sim opens host-hsk.html in a new tab.
        // That page creates a PIN room on load, then displays it big
        // so the teacher can read it aloud OR copy a direct join
        // link. Force-impose to currently-online kids is now a
        // button INSIDE that page so everything related to the
        // exam session lives in one place — like host-reading.html.
        card.querySelector('.m-reading-force').addEventListener('click', () => {
          const url = '/host-hsk.html?sim=' + encodeURIComponent(sim.id)
            + '&pw=' + encodeURIComponent(pw);
          // 🆕 2026-06-16 (Fernando): SAME-TAB nav, not window.open.
          // On mobile (Samsung Internet / Chrome Android on the S23)
          // window.open('_blank') is popup-blocked — the teacher tapped
          // "Abrir sala" and nothing happened. Same fix as Modo Maestro:
          // navigate the current tab to the host monitor. The teacher
          // lands on the room with the PIN; they can come back to
          // /maestro any time.
          location.href = url;
        });
        grid.appendChild(card);
      });
      view.appendChild(grid);
    })
    .catch((e) => { view.textContent = 'Error: ' + e.message; });
  }

  // Mirror openForceReadingPicker(), but the launch URL is /hsk-sim.html
  // and we push it through inbox force-messages to every selected kid.
  function openForceHskPicker(sim) {
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          alert('No se pudo cargar la lista de alumnos en línea.');
          return;
        }
        const onlineNow = (data.students || []).filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000);
        if (!onlineNow.length) {
          alert('No hay alumnos en línea ahora mismo.\n\n(Pídeles que abran /homework primero.)');
          return;
        }
        let overlay = document.getElementById('m-force-hsk-modal');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'm-force-hsk-modal';
        overlay.className = 'm-modal';
        overlay.innerHTML = `
          <div class="m-modal-card">
            <button class="m-modal-close" type="button" aria-label="Cerrar">✕</button>
            <h2>🎯 Forzar simulación HSK1</h2>
            <p class="m-modal-sub">Simulación: <strong>🏆 ${escapeHtml(sim.title || sim.id)}</strong></p>
            <p class="m-modal-sub" style="margin-top:6px;">Los alumnos seleccionados entrarán automáticamente al examen en ~20 segundos.</p>
            <div class="m-force-actions">
              <button class="btn btn-ghost btn-sm" id="m-fhsk-all">✅ Todos</button>
              <button class="btn btn-ghost btn-sm" id="m-fhsk-none">⬜ Ninguno</button>
            </div>
            <div class="m-force-students" id="m-fhsk-students"></div>
            <button class="btn btn-gold btn-xl" id="m-fhsk-launch" style="margin-top:16px;width:100%;">
              🚀 Lanzar examen a alumnos seleccionados
            </button>
            <!-- 🆕 2026-06-21 (Fernando): rescue a stuck kid. Instead of pulling
                 them INTO the exam, send them back to their homework profile so
                 you can re-grab them. Reaches them even inside a frozen room. -->
            <button class="btn btn-jade btn-sm" id="m-fhsk-gohome" style="margin-top:10px;width:100%;">
              🏠 Enviar seleccionados a su perfil de tareas
            </button>
          </div>`;
        document.body.appendChild(overlay);
        const list = overlay.querySelector('#m-fhsk-students');
        onlineNow.forEach((s) => {
          const row = document.createElement('label');
          row.className = 'm-force-row';
          row.innerHTML =
            '<input type="checkbox" data-code="' + escapeHtml(s.code) + '" checked>' +
            '<span class="m-force-row-dot"></span>' +
            '<span class="m-force-row-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
            '<span class="m-force-row-code">' + escapeHtml(s.code) + '</span>';
          list.appendChild(row);
        });
        const close = () => { try { overlay.remove(); } catch (_) {} };
        overlay.querySelector('.m-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('#m-fhsk-all').addEventListener('click', () => {
          list.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = true; });
        });
        overlay.querySelector('#m-fhsk-none').addEventListener('click', () => {
          list.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = false; });
        });
        overlay.querySelector('#m-fhsk-launch').addEventListener('click', () => {
          const codes = Array.from(list.querySelectorAll('input[type=checkbox]:checked'))
            .map((cb) => cb.dataset.code).filter(Boolean);
          if (!codes.length) {
            alert('Selecciona al menos un alumno.');
            return;
          }
          // Read the access code from URL or storage — same one /maestro
          // uses for all homework operations.
          const accessCode = (new URLSearchParams(location.search)).get('access')
            || localStorage.getItem('mochi.accessCode') || '';
          // Push a force-impose inbox message — the kids' homework
          // poll picks it up and auto-redirects to /hsk-sim.html with
          // their own code already in the URL.
          //
          // IMPORTANT: /api/admin/broadcast-selected reads its password
          // from req.query.pw (NOT req.body.pw) and the body schema is
          // { studentCodes, text, actionType, actionUrl, actionLabel }
          // — NOT { codes, body }. Mirroring the working host-warmup +
          // host-reading force-flow exactly.
          fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(pw), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentCodes: codes,
              text: '🏆 La maestra te está abriendo la simulación HSK ahora. Prepárate.',
              actionType: 'force',
              actionUrl: '/hsk-sim.html?access=' + encodeURIComponent(accessCode)
                + '&sim=' + encodeURIComponent(sim.id),
              actionLabel: 'Entrar al examen →'
            })
          })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) {
              const monitorUrl = '/host-hsk.html'
                + '?sim='    + encodeURIComponent(sim.id)
                + '&access=' + encodeURIComponent(accessCode)
                + '&pw='     + encodeURIComponent(pw);
              close();
              // 🆕 2026-06-16 (Fernando): SAME-TAB nav, not window.open.
              // window.open inside this fetch().then() callback is NOT a
              // user gesture → mobile browsers (S23 / Samsung Internet /
              // Chrome Android) silently popup-block it, so "start examen"
              // appeared to do nothing on the phone. Navigating the
              // current tab to the live monitor always works. The
              // broadcast already fired above, so the kids are being
              // pulled in regardless.
              alert('✅ Examen enviado a ' + codes.length + ' alumno(s). Entrarán en ~20s. Te llevo al monitor en vivo.');
              location.href = monitorUrl;
            } else {
              alert('Error: ' + (res && res.error || 'desconocido'));
            }
          })
          .catch((e) => { alert('Error: ' + e.message); });
        });
        // 🆕 2026-06-21 (Fernando) — "send to homework profile" rescue button.
        // Sends a 'gohome' inbox message; the kid's heartbeat (player.html /
        // hsk-sim.html every 30s) picks it up and navigates them to /homework,
        // so even a kid frozen inside a room gets pulled out within ~30s.
        overlay.querySelector('#m-fhsk-gohome').addEventListener('click', () => {
          const codes = Array.from(list.querySelectorAll('input[type=checkbox]:checked'))
            .map((cb) => cb.dataset.code).filter(Boolean);
          if (!codes.length) { alert('Selecciona al menos un alumno.'); return; }
          fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(pw), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentCodes: codes,
              text: '📚 Tu maestra te envió a tu perfil de tareas.',
              actionType: 'gohome',
              actionUrl: '/homework',
              actionLabel: 'Ir a mis tareas →'
            })
          })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) {
              alert('🏠 ' + (res.sent || codes.length) + ' alumno(s) volverán a su perfil en ~30s.');
              close();
            } else {
              alert('Error: ' + (res && res.error || 'desconocido'));
            }
          })
          .catch((e) => { alert('Error: ' + e.message); });
        });
      })
      .catch((e) => { alert('Error: ' + e.message); });
  }

  // ── 🌐 EMIRATI ARABIC GATEWAY (super-admin only) ──────────────────
  const emBtn = $('m-emirati-btn');
  const emModal = $('m-emirati-modal');
  if (emBtn) emBtn.addEventListener('click', () => { emModal.classList.remove('hidden'); loadEmirati(); });
  if ($('m-emirati-close')) $('m-emirati-close').addEventListener('click', () => emModal.classList.add('hidden'));
  if (emModal) emModal.addEventListener('click', (e) => { if (e.target === emModal) emModal.classList.add('hidden'); });
  if ($('m-em-shuffle')) $('m-em-shuffle').addEventListener('click', loadEmirati);
  // 🧹 Nuke the cached MP3s — useful when bad files from earlier deploys
  // are still stuck on disk and breaking playback. They'll regenerate on
  // the next 🔊 tap (fresh from Azure).
  if ($('m-em-clear-cache')) $('m-em-clear-cache').addEventListener('click', () => {
    if (!confirm('¿Borrar todos los MP3 cacheados? Se regeneran al siguiente toque.')) return;
    fetch('/api/maestro/emirati/audio/clear-cache?pw=' + encodeURIComponent(pw), { method: 'POST' })
      .then((r) => r.json()).then((d) => {
        if (d.ok) alert('✅ Borrados ' + d.removed + ' archivos.\n\nProbá ahora — la próxima reproducción regenera fresh desde Azure.');
        else alert('Error: ' + (d.error || 'no se pudo'));
      })
      .catch((e) => alert('Error: ' + e.message));
  });
  if ($('m-em-mark-all')) $('m-em-mark-all').addEventListener('click', () => {
    if (!_emToday.length) return;
    fetch('/api/maestro/emirati/mark?pw=' + encodeURIComponent(pw), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordIds: _emToday.map((w) => w.id), date: new Date().toISOString().slice(0, 10) }),
    }).then((r) => r.json()).then((d) => { if (d && d.ok) { applyEmiratiHud(d.progress); loadEmirati(true); } });
  });
  let _emToday = [];
  let _emLearnedSentences = new Set();
  // 📜 "Mis aprendidos" review panel — opens INSIDE the Emirati modal,
  // listing every word marked seen + every sentence marked learned.
  function openEmiratiReview(initialTab) {
    if (initialTab === 'words' || initialTab === 'sentences') _emReviewTab = initialTab;
    $('m-em-review-panel').classList.remove('hidden');
    $('m-em-review-body').innerHTML = '<div class="m-empty">Cargando…</div>';
    fetch('/api/maestro/emirati/learned?pw=' + encodeURIComponent(pw))
      .then((r) => r.json()).then((d) => renderEmiratiReview(d))
      .catch((e) => { $('m-em-review-body').innerHTML = '<div class="m-empty">Error: ' + e.message + '</div>'; });
  }
  if ($('m-em-review')) {
    $('m-em-review').addEventListener('click', () => openEmiratiReview());
  }
  // 🎯 Tap-to-review on the HUD stats — tap "palabras vistas" → opens
  // Mis aprendidos at the Words tab; tap "oraciones aprendidas" → opens
  // at the Sentences tab. Lets the user unmark anything via that panel.
  document.querySelectorAll('.m-emirati-stat.is-tappable').forEach((btn) => {
    btn.addEventListener('click', () => {
      openEmiratiReview(btn.dataset.emStat === 'sentences' ? 'sentences' : 'words');
    });
  });
  if ($('m-em-review-back')) {
    $('m-em-review-back').addEventListener('click', () => $('m-em-review-panel').classList.add('hidden'));
  }
  let _emReviewTab = 'words';  // 'words' | 'sentences'
  function renderEmiratiReview(d) {
    const body = $('m-em-review-body'); if (!body) return;
    if (!d || !d.ok) { body.innerHTML = '<div class="m-empty">Error cargando: ' + ((d && d.error) || 'sin respuesta del servidor') + '</div>'; return; }
    const counts = $('m-em-review-counts');
    if (counts) counts.textContent = '🌱 ' + d.seenWordsCount + ' palabras · ✏️ ' + d.learnedSentenceCount + ' oraciones';
    // 🗂️ Two-tab layout — exactly what the user asked for: one tab for
    // words, one tab for sentences. They never mix.
    body.innerHTML = `
      <div class="m-em-review-tabs">
        <button class="m-em-review-tab ${_emReviewTab === 'words' ? 'is-active' : ''}" data-tab="words" type="button">
          🌱 Palabras <span class="m-em-review-tabn">${d.seenWordsCount}</span>
        </button>
        <button class="m-em-review-tab ${_emReviewTab === 'sentences' ? 'is-active' : ''}" data-tab="sentences" type="button">
          ✏️ Oraciones <span class="m-em-review-tabn">${d.learnedSentenceCount}</span>
        </button>
      </div>
      <div class="m-em-review-pane" id="m-em-review-pane"></div>`;
    body.querySelectorAll('.m-em-review-tab').forEach((t) => {
      t.addEventListener('click', () => {
        _emReviewTab = t.dataset.tab;
        body.querySelectorAll('.m-em-review-tab').forEach((x) => x.classList.toggle('is-active', x === t));
        renderReviewPane(d);
      });
    });
    renderReviewPane(d);
  }
  function renderReviewPane(d) {
    const pane = $('m-em-review-pane'); if (!pane) return;
    pane.innerHTML = '';
    if (_emReviewTab === 'words') {
      if (!d.seenWordsCount) {
        pane.innerHTML = '<div class="m-empty">Aún no has marcado palabras como vistas. Usa el botón "✓ Marcar como vista" debajo de cada palabra del día.</div>';
        return;
      }
      Object.keys(d.bySection).forEach((sectId) => {
        const sect = d.sections[sectId];
        const words = d.bySection[sectId];
        const wrap = document.createElement('details');
        wrap.className = 'm-em-review-section'; wrap.open = true;
        const sum = document.createElement('summary');
        sum.className = 'm-em-review-summary';
        sum.innerHTML = (sect ? sect.icon + ' ' + escapeHtml(sect.label) : sectId)
          + ' <span class="m-em-review-n">' + words.length + '</span>';
        wrap.appendChild(sum);
        const grid = document.createElement('div'); grid.className = 'm-em-review-words';
        words.forEach((w) => {
          const card = document.createElement('div'); card.className = 'm-em-review-word';
          card.innerHTML = `
            <div class="m-em-rw-ar" lang="ar" dir="rtl">${escapeHtml(w.ar)}</div>
            <div class="m-em-rw-tr">${escapeHtml(w.tr)}</div>
            <div class="m-em-rw-en">${escapeHtml(w.en)}</div>
            <div class="m-em-rw-tools">
              <button class="m-em-rw-speak" data-ar="${escapeHtml(w.ar)}" data-wid="${escapeHtml(w.id)}" title="Escuchar">🔊</button>
              <button class="m-em-rw-forget" data-wid="${escapeHtml(w.id)}" title="Olvidar esta palabra">✗</button>
            </div>`;
          card.querySelector('.m-em-rw-speak').addEventListener('click', (e) => {
            speakEmirati(e.currentTarget.dataset.ar, e.currentTarget, e.currentTarget.dataset.wid);
          });
          // ✗ Forget — sends { wordIds:[id], unmark:true } to /mark, removes from seen.
          card.querySelector('.m-em-rw-forget').addEventListener('click', (e) => {
            const wid = e.currentTarget.dataset.wid;
            if (!confirm('¿Olvidar esta palabra? Volverá a aparecer en el día.')) return;
            fetch('/api/maestro/emirati/mark?pw=' + encodeURIComponent(pw), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ wordIds: [wid], unmark: true, date: new Date().toISOString().slice(0, 10) }),
            }).then((r) => r.json()).then((res) => {
              if (!res.ok) return;
              card.remove();
              applyEmiratiHud(res.progress);
              // Also remove from the section header count chip if visible.
              const n = wrap.querySelector('.m-em-review-n');
              if (n) n.textContent = Math.max(0, (Number(n.textContent) || 0) - 1);
              d.seenWordsCount = Math.max(0, d.seenWordsCount - 1);
              const counts = $('m-em-review-counts');
              if (counts) counts.textContent = '🌱 ' + d.seenWordsCount + ' palabras · ✏️ ' + d.learnedSentenceCount + ' oraciones';
              // If section is now empty, collapse it.
              if (!grid.children.length) wrap.remove();
            });
          });
          grid.appendChild(card);
        });
        wrap.appendChild(grid);
        pane.appendChild(wrap);
      });
    } else {
      if (!d.learnedSentenceCount) {
        pane.innerHTML = '<div class="m-empty">Aún no has marcado oraciones. En la lista del día, debajo de cada palabra hay oraciones de ejemplo con un botón <b>☐ Marcar</b>. Tócalo para añadirlas aquí.</div>';
        return;
      }
      d.learnedSentenceRows.forEach((row) => {
        const s = row.sentence;
        const tile = document.createElement('div');
        tile.className = 'm-em-review-sentence';
        tile.innerHTML = `
          <div class="m-em-rs-text">
            <div class="m-em-rs-ar" lang="ar" dir="rtl">${escapeHtml(s.ar || row.ar)}</div>
            <div class="m-em-rs-tr">${escapeHtml(s.tr)}</div>
            <div class="m-em-rs-en">${escapeHtml(s.en)}</div>
            <div class="m-em-rs-from">↑ de la palabra <b>${escapeHtml(row.tr)}</b></div>
          </div>
          <div class="m-em-rs-tools">
            <button class="m-em-rs-speak" data-ar="${escapeHtml(s.ar || row.ar)}">🔊</button>
            <button class="m-em-rs-unlearn" data-key="${escapeHtml(row.key)}" title="Olvidar">✗</button>
          </div>`;
        tile.querySelector('.m-em-rs-speak').addEventListener('click', (e) => {
          speakEmiratiText(e.currentTarget.dataset.ar, e.currentTarget);
        });
        tile.querySelector('.m-em-rs-unlearn').addEventListener('click', (e) => {
          const key = e.currentTarget.dataset.key;
          fetch('/api/maestro/emirati/sentence/mark?pw=' + encodeURIComponent(pw), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys: [key], unmark: true }),
          }).then((r) => r.json()).then(() => {
            tile.remove();
            // Refresh counts label too.
            d.learnedSentenceCount = Math.max(0, d.learnedSentenceCount - 1);
            const counts = $('m-em-review-counts');
            if (counts) counts.textContent = '🌱 ' + d.seenWordsCount + ' palabras · ✏️ ' + d.learnedSentenceCount + ' oraciones';
          });
        });
        pane.appendChild(tile);
      });
    }
  }
  let _emSkipForToday = new Set();
  function loadEmirati(reshuffle) {
    const list = $('m-emirati-list');
    if (list) list.textContent = 'Cargando…';
    // 🔁 OTRAS 5 — when reshuffling, push the current 5 IDs into
    // _emSkipForToday so the server returns the NEXT 5 unseen instead of
    // recomputing the same priority slice. Was: same 5 every tap.
    if (reshuffle && Array.isArray(_emToday)) {
      _emToday.forEach((w) => _emSkipForToday.add(w.id));
    }
    const date = new Date().toISOString().slice(0, 10);
    const skip = Array.from(_emSkipForToday).join(',');
    const url = '/api/maestro/emirati/today?pw=' + encodeURIComponent(pw)
      + '&date=' + encodeURIComponent(date)
      + (skip ? '&skip=' + encodeURIComponent(skip) : '');
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) { if (list) list.textContent = 'Error: ' + (d && d.error || 'no se pudo cargar'); return; }
        _emToday = d.words || [];
        _emLearnedSentences = new Set(d.learnedSentences || []);
        applyEmiratiHud(d.progress);
        renderEmiratiWords(_emToday, d.sections, {
          visibleSentenceCount: d.visibleSentenceCount || 0,
          wordCap: d.wordCap || 10,
          sentenceCap: d.sentenceCap || 20,
        });
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
  // 🆕 The server now returns a self-refilling list — up to 10 unseen
  // words, each with ONLY their unlearned sentences attached, capped at
  // ~20 sentences total. Marking a word or sentence and re-fetching
  // auto-promotes the next priority item into the list to keep counts
  // near the 10/20 target.
  function renderEmiratiWords(words, sections, summary) {
    const list = $('m-emirati-list'); if (!list) return;
    if (!words.length) { list.innerHTML = '<div class="m-empty">¡Has visto todas las palabras disponibles! 🎉</div>'; return; }
    list.innerHTML = '';
    // Sticky list-summary header: "10 palabras · 17 oraciones por estudiar"
    if (summary) {
      const head = document.createElement('div');
      head.className = 'm-em-list-summary';
      head.innerHTML = '<span class="m-em-list-count">'
        + '📚 <strong>' + words.length + '</strong> palabra' + (words.length === 1 ? '' : 's')
        + ' · 📝 <strong>' + summary.visibleSentenceCount + '</strong> oración' + (summary.visibleSentenceCount === 1 ? '' : 'es')
        + ' por estudiar</span>'
        + '<span class="m-em-list-sub">Marca lo que ya sepas y la lista se rellena sola.</span>';
      list.appendChild(head);
    }
    words.forEach((w) => {
      const sec = sections && sections[w.section];
      const card = document.createElement('div');
      card.className = 'm-em-card';
      let ses = '';
      if (Array.isArray(w.ses) && w.ses.length) {
        ses = '<div class="m-em-sentences">'
          + w.ses.map((s) => {
              // 🆕 server sends s._idx = original sentence index in the
              // word's full sentence list. That's the stable key so a
              // marked sentence's neighbors don't shift indexes.
              const si = (typeof s._idx === 'number') ? s._idx : 0;
              const key = w.id + ':' + si;
              const learned = _emLearnedSentences.has(key);
              const isAuto = w.sesAuto ? ' m-em-s-auto' : '';
              // 🔧 Sentence now renders the actual ARABIC line (RTL) + tr + en,
              // so Azure has real text to speak. The 🔊 sends s.ar to the new
              // /api/emirati/audio/text endpoint (cached by content hash).
              return '<div class="m-em-s' + (learned ? ' is-learned' : '') + isAuto + '" data-sentkey="' + escapeHtml(key) + '">'
                + '<div class="m-em-s-text">'
                +   '<div class="m-em-s-ar" lang="ar" dir="rtl">' + escapeHtml(s.ar || w.ar) + '</div>'
                +   '<div class="m-em-s-tr">' + escapeHtml(s.tr) + '</div>'
                +   '<div class="m-em-s-en">' + escapeHtml(s.en) + '</div>'
                + '</div>'
                + '<div class="m-em-s-tools">'
                +   '<button class="m-em-s-speak" type="button" data-ar="' + escapeHtml(s.ar || w.ar) + '" title="Escuchar en Khaleeji">🔊</button>'
                +   '<button class="m-em-s-learn ' + (learned ? 'is-on' : '') + '" type="button" data-key="' + escapeHtml(key) + '">'
                +     '<span class="m-em-s-learn-icon">' + (learned ? '✅' : '☐') + '</span>'
                +     '<span class="m-em-s-learn-label">' + (learned ? 'Aprendida' : 'Marcar') + '</span>'
                +   '</button>'
                + '</div>'
              + '</div>';
            }).join('')
          + '</div>';
      }
      // No more priority number badge — user found "#383" confusing. The
      // section name + the natural top-to-bottom order is enough signal.
      const prioBadge = '';
      // 🆕 2026-06-04 — words that you already marked seen can now still
      // appear in the list (because their sentences aren't all marked
      // yet). When that happens, the bottom button reads as "already
      // known — tap to undo" so you don't accidentally toggle it off.
      const isSeen = !!w.seen;
      if (isSeen) card.classList.add('is-seen-kept');
      const markBtnHtml = isSeen
        ? `<button class="m-em-mark is-known" type="button" data-id="${escapeHtml(w.id)}" data-known="1">✅ Conocida · toca para deshacer</button>`
        : `<button class="m-em-mark" type="button" data-id="${escapeHtml(w.id)}">✓ Marcar como vista</button>`;
      card.innerHTML = `
        <div class="m-em-row">
          <div class="m-em-section">${sec ? (sec.icon + ' ' + escapeHtml(sec.label)) : ''} ${prioBadge}</div>
          <button class="m-em-speak" type="button" data-ar="${escapeHtml(w.ar)}" data-wid="${escapeHtml(w.id)}" title="Escuchar (MP3 emiratí si existe, si no Google MSA)">🔊</button>
        </div>
        <div class="m-em-ar" lang="ar" dir="rtl">${escapeHtml(w.ar)}</div>
        <div class="m-em-tr">${escapeHtml(w.tr)}</div>
        <div class="m-em-en">${escapeHtml(w.en)}</div>
        ${ses}
        ${markBtnHtml}`;
      list.appendChild(card);
    });
    list.querySelectorAll('.m-em-speak').forEach((b) => b.addEventListener('click', (e) => {
      speakEmirati(b.dataset.ar, b, b.dataset.wid);
    }));
    // 🔊 on every sentence row → /api/emirati/audio/text (real Arabic via
    // Azure ar-AE-FatimaNeural / HamdanNeural, content-hashed cache).
    // The transliteration version was sending Roman text to MSA Google,
    // which is what was making it sound bad. Now it speaks real Khaleeji.
    list.querySelectorAll('.m-em-s-speak').forEach((b) => b.addEventListener('click', () => {
      const arText = b.dataset.ar;
      if (!arText) return;
      speakEmiratiText(arText, b);
    }));
    // ✓ Toggle "learned" status on each sentence; persists to server.
    // 🆕 Marking a sentence learned no longer just dims the row — it
    // POSTs, then refetches the whole study list so the next priority
    // item slides in to keep the list at the 10/20 target. Unmarking
    // (when toggling back to ☐) also refetches so the sentence returns
    // to the list if there's room.
    list.querySelectorAll('.m-em-s-learn').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.key; if (!key) return;
      const wasLearned = _emLearnedSentences.has(key);
      // Optimistic visual feedback BEFORE the round-trip — kid sees the
      // tap register instantly, the fade-out animation runs, then the
      // refetched list renders fresh.
      const row = b.closest('.m-em-s');
      if (row && !wasLearned) row.classList.add('is-leaving');
      fetch('/api/maestro/emirati/sentence/mark?pw=' + encodeURIComponent(pw), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [key], unmark: wasLearned }),
      }).then((r) => r.json()).then((d) => {
        if (!d || !d.ok) {
          if (row) row.classList.remove('is-leaving');
          return;
        }
        _emLearnedSentences = new Set(d.learnedSentences || []);
        // Update HUD sentencesLearned via the existing emirati progress payload.
        const tag = document.getElementById('m-em-sent-count');
        if (tag) tag.textContent = d.count;
        // 🔁 Refetch so the list rebalances around the target counts.
        loadEmirati(false);
      }).catch(() => {
        if (row) row.classList.remove('is-leaving');
      });
    }));
    // 🆕 Marking a word as "vista" removes the entire card from the list
    // and pulls in the next priority unseen word — auto-refill behavior
    // matching the sentence flow above.
    list.querySelectorAll('.m-em-mark').forEach((b) => b.addEventListener('click', () => {
      const card = b.closest('.m-em-card');
      const wasKnown = b.dataset.known === '1';
      if (card) card.classList.add('is-leaving');
      fetch('/api/maestro/emirati/mark?pw=' + encodeURIComponent(pw), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordIds: [b.dataset.id], date: new Date().toISOString().slice(0, 10), unmark: wasKnown }),
      }).then((r) => r.json()).then((d) => {
        if (!d || !d.ok) {
          if (card) card.classList.remove('is-leaving');
          return;
        }
        applyEmiratiHud(d.progress);
        // 🔁 Refetch — the marked word leaves, next priority slides in.
        loadEmirati(false);
      }).catch(() => {
        if (card) card.classList.remove('is-leaving');
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
  // 🎙️ DEFAULT TO HAMDAN — user explicitly asked for the male Khaleeji
  // voice as the ONLY voice reading everything. Fatima is still available
  // via the dropdown but no longer the silent default.
  let _emAzureVoice = 'male';   // 'female' (Fatima) | 'male' (Hamdan)
  // Play priority on every 🔊 tap:
  //  1. /api/emirati/audio/{wordId}?voice=<female|male>
  //     a. served from disk cache if a prior call generated it, OR
  //     b. server hits Azure ar-AE-FatimaNeural / HamdanNeural live,
  //        caches the MP3, sends it back (first hit only)
  //  2. If both fail, fall back to /api/tts?voice=ar-XA-Wavenet-A
  //     (Google MSA) and visually mark the button so the teacher knows.
  // The Audio element's `error` event fires on a 404 from (1), which is
  // how we know to flip to (2). No wasteful HEAD pre-check.
  // 🎙️ Speak arbitrary Arabic text through Azure ar-AE Khaleeji ONLY.
  // No MSA fallback — user explicitly asked for Hamdan to read everything.
  // If Azure fails, surface a clear error on the button so they know the
  // request didn't reach Azure (silent MSA fallback was confusing them).
  // 🚀 NUCLEAR REWRITE — uses Web Audio API directly instead of <audio>.
  // The <audio> element on mobile Samsung/Android silently rejected the
  // sentence MP3s even though they were valid 14KB files (your diagnostic
  // proved Azure was OK). This path:
  //   1. fetch() the bytes as ArrayBuffer (raw)
  //   2. ctx.decodeAudioData() → decoded PCM
  //   3. AudioBufferSourceNode → play immediately
  // No <audio> element, no Content-Type sniffing, no autoplay policy
  // weirdness, no Accept-Ranges confusion. Just bytes → speaker.
  let _emAudioCtx = null;
  let _emAudioSource = null;
  // ❌ SpeechSynthesis fallback REMOVED at user request. They explicitly
  // do NOT want built-in OS Arabic voices (Samsung TTS sounds MSA, not
  // Khaleeji). The platform should ONLY play Azure ar-AE Hamdan/Fatima.
  async function speakEmiratiText(arText, btn) {
    try { if (_emAudioSource) _emAudioSource.stop(); } catch (_) {}
    if (btn) { btn.textContent = '🔊…'; btn.classList.remove('m-em-speak-msa', 'm-em-speak-err'); }
    if (!arText) {
      if (btn) { btn.textContent = '⊘'; btn.title = 'Sin texto en árabe.'; }
      return;
    }
    // ⭐ USER'S INSIGHT: words play fine, sentences fail. The DIFFERENCE
    // was the endpoint URL. Now sentences register the text and get back
    // a sentence ID (s_<hash>) that goes through the EXACT word endpoint.
    // Same Azure call, same cache, same response path — proven to work.
    try {
      const regResp = await fetch('/api/emirati/audio/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ar: arText }),
      });
      const reg = await regResp.json();
      if (!reg.ok) throw new Error('register failed');
      // Now play through the WORD endpoint with the sentence ID.
      return speakEmirati(arText, btn, reg.id);
    } catch (e) {
      console.warn('[em-text] register failed, falling back to old text endpoint:', e);
    }
    // FALLBACK: old text endpoint (if register failed for any reason).
    try {
      // Lazy-init the AudioContext on first user gesture (mobile requirement).
      if (!_emAudioCtx) {
        _emAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (_emAudioCtx.state === 'suspended') {
        await _emAudioCtx.resume();
      }
      const url = '/api/emirati/audio/text?voice=' + _emAzureVoice
        + '&ar=' + encodeURIComponent(arText)
        + '&t=' + Date.now();
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const arrayBuf = await resp.arrayBuffer();
      if (arrayBuf.byteLength < 200) throw new Error('audio too small (' + arrayBuf.byteLength + 'B)');
      const audioBuf = await _emAudioCtx.decodeAudioData(arrayBuf);
      _emAudioSource = _emAudioCtx.createBufferSource();
      _emAudioSource.buffer = audioBuf;
      _emAudioSource.connect(_emAudioCtx.destination);
      _emAudioSource.onended = () => { if (btn) btn.textContent = '🔊'; };
      _emAudioSource.start(0);
    } catch (e) {
      console.warn('[em-text] play failed:', e);
      if (btn) {
        btn.classList.add('m-em-speak-err');
        btn.textContent = '🚫';
        btn.title = 'Error: ' + (e.message || e) + ' — toca otra vez para diagnosticar.';
        btn.onclick = () => {
          btn.onclick = null;
          fetch('/api/maestro/emirati/azure/diagnose?pw=' + encodeURIComponent(pw)
              + '&voice=' + _emAzureVoice
              + '&text=' + encodeURIComponent(arText))
            .then((r) => r.json()).then((d) => {
              alert('Diag:\nOK: ' + d.ok + '\nStatus: ' + (d.azureStatus || d.reason)
                + '\nBytes: ' + (d.bytesReceived || 0)
                + '\nClient error: ' + (e.message || e));
            });
        };
      }
    }
  }
  async function speakEmirati(arText, btn, wid) {
    try { if (_emAudioSource) _emAudioSource.stop(); } catch (_) {}
    if (btn) { btn.textContent = '🔊…'; btn.classList.remove('m-em-speak-msa', 'm-em-speak-err'); }
    try {
      if (!_emAudioCtx) _emAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (_emAudioCtx.state === 'suspended') await _emAudioCtx.resume();
      const url = wid
        ? '/api/emirati/audio/' + encodeURIComponent(wid) + '?voice=' + _emAzureVoice + '&t=' + Date.now()
        : '/api/emirati/audio/text?voice=' + _emAzureVoice + '&ar=' + encodeURIComponent(arText) + '&t=' + Date.now();
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const arrayBuf = await resp.arrayBuffer();
      if (arrayBuf.byteLength < 200) throw new Error('audio too small');
      const audioBuf = await _emAudioCtx.decodeAudioData(arrayBuf);
      _emAudioSource = _emAudioCtx.createBufferSource();
      _emAudioSource.buffer = audioBuf;
      _emAudioSource.connect(_emAudioCtx.destination);
      _emAudioSource.onended = () => { if (btn) btn.textContent = '🔊'; };
      _emAudioSource.start(0);
    } catch (e) {
      console.warn('[em-word] play failed:', e);
      if (btn) {
        btn.classList.add('m-em-speak-err');
        btn.textContent = '🚫';
        btn.title = 'Error: ' + (e.message || e);
      }
    }
  }

  // ── 🎙️ AZURE: bind the Khaleeji voice generator panel. ──
  // On modal open we poll /azure-status; the button only appears when the
  // server actually has AZURE_SPEECH_KEY set. The voice <select> persists
  // to localStorage and re-fetches re-render so future taps use the chosen
  // voice (also passed via ?voice= on the audio endpoint).
  const _emAzureSavedVoice = (function () {
    try { return localStorage.getItem('em_azure_voice') || 'male'; } catch (_) { return 'male'; }
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

  // 🎬 GIF PICKER — push transparent dancing mascot to selected kids.
  // 2026-06-08 (Fernando). Same plumbing as the inbox messaging system;
  // homework.js's poller picks up the actionType:'anim' message and
  // shows an 8-second overlay over whatever the kid was doing.
  // Designed to be the foundation for a future "mascot of the day"
  // auto-rotation that fires server-side on login streaks etc.
  const GIF_LIBRARY = [
    { id: 'cr7',    label: '⚽ CR7',     url: '/assets/png-library/CR7%20TRANSPARENT.gif' },
    { id: 'gojo',   label: '👁 Gojo',    url: '/assets/png-library/GOJO%20TRANSPARENT.gif' },
    { id: 'yugi',   label: '🃏 Yugi',    url: '/assets/png-library/YUGI%20TRANSPARENT.gif' },
    { id: 'freddy', label: '🐻 Freddy',  url: '/assets/png-library/FREDDY%20TRANSPARENT.gif' },
    { id: 'mario',  label: '🍄 Mario',   url: '/assets/png-library/MARIO%20TRANSPARENT.gif' },
    { id: 'sonic',  label: '💨 Sonic',   url: '/assets/png-library/SONIC%20TRANSPARENT.gif' },
    { id: 'elsa',   label: '❄️ Elsa',    url: '/assets/png-library/ELSA%20TRANSPARENT.gif' },
    { id: 'turtle', label: '🐢 Squirtle',url: '/assets/png-library/Squirtle%20animation.gif' },
  ];
  let _gifPick = '';
  let _gifChecked = new Set();
  let _gifOnlineOnly = false;
  let _gifSearch = '';
  let _gifStudents = [];
  function _renderGifGrid() {
    const grid = $('m-gif-grid');
    if (!grid) return;
    grid.innerHTML = GIF_LIBRARY.map((g) => {
      const sel = g.id === _gifPick;
      return '<button class="m-gif-tile" data-gid="' + g.id + '" type="button" style="' +
        'padding:8px;border-radius:12px;background:' + (sel ? 'rgba(91,232,209,0.18)' : 'rgba(255,255,255,0.05)') +
        ';border:2px solid ' + (sel ? 'rgba(91,232,209,0.65)' : 'rgba(255,255,255,0.12)') +
        ';color:#fff;font-weight:800;cursor:pointer;touch-action:manipulation;text-align:center;">' +
        '<img src="' + g.url + '" alt="" style="max-width:90px;max-height:90px;display:block;margin:0 auto 6px;">' +
        '<span>' + g.label + '</span></button>';
    }).join('');
    grid.querySelectorAll('.m-gif-tile').forEach((b) => {
      b.addEventListener('click', () => {
        _gifPick = b.dataset.gid;
        _renderGifGrid();
        _updateGifSendBtn();
      });
    });
  }
  function _renderGifList() {
    const list = $('m-gif-list');
    if (!list) return;
    const q = (_gifSearch || '').toLowerCase();
    let pool = _gifStudents.slice();
    if (q) pool = pool.filter((s) =>
      (s.displayName || '').toLowerCase().includes(q) ||
      (s.code || '').toLowerCase().includes(q));
    if (_gifOnlineOnly) pool = pool.filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000);
    if (!pool.length) {
      list.innerHTML = '<p style="color:rgba(255,255,255,0.6);padding:12px;text-align:center;">Sin coincidencias.</p>';
      return;
    }
    list.innerHTML = '';
    pool.forEach((s) => {
      const online = s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000;
      const checked = _gifChecked.has(s.code);
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:8px;cursor:pointer;background:' + (checked ? 'rgba(91,232,209,0.1)' : 'transparent');
      row.innerHTML =
        '<input type="checkbox" data-code="' + escapeHtml(s.code) + '"' + (checked ? ' checked' : '') + '>' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + (online ? '#5be88a' : '#666') + ';"></span>' +
        '<span style="flex:1;font-weight:700;">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
        '<span style="font-size:0.75rem;color:rgba(255,255,255,0.5);">' + escapeHtml(s.code) + '</span>';
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) _gifChecked.add(s.code); else _gifChecked.delete(s.code);
        row.style.background = e.target.checked ? 'rgba(91,232,209,0.1)' : 'transparent';
        _updateGifSendBtn();
      });
      list.appendChild(row);
    });
  }
  function _updateGifSendBtn() {
    const btn = $('m-gif-send');
    if (!btn) return;
    if (!_gifPick) { btn.textContent = '🎬 Elige un GIF'; btn.disabled = true; return; }
    if (!_gifChecked.size) { btn.textContent = '👥 Elige al menos un alumno'; btn.disabled = true; return; }
    btn.textContent = '📤 Mandar GIF a ' + _gifChecked.size + ' alumno' + (_gifChecked.size === 1 ? '' : 's');
    btn.disabled = false;
  }
  function _openGifModal() {
    _gifPick = ''; _gifChecked = new Set(); _gifOnlineOnly = false; _gifSearch = '';
    $('m-gif-search').value = '';
    $('m-gif-msg').textContent = '';
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { _gifStudents = []; return; }
        _gifStudents = (data.students || []).slice().sort((a, b) =>
          (a.displayName || a.code || '').localeCompare(b.displayName || b.code || ''));
        _renderGifList();
      });
    _renderGifGrid();
    _updateGifSendBtn();
    $('m-gif-modal').classList.remove('hidden');
  }
  function _closeGifModal() { $('m-gif-modal').classList.add('hidden'); }
  // 💾 One-click backup (super-admin). Streams data/*.json as one file.
  const backupBtn = $('m-backup-btn');
  if (backupBtn) backupBtn.addEventListener('click', () => {
    // Simplest reliable download: navigate to the gated endpoint with the
    // password in the query. The Content-Disposition header makes the
    // browser save it instead of rendering.
    const url = '/api/admin/backup?pw=' + encodeURIComponent(pw);
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); } catch (_) {} }, 1000);
  });

  // 🎓 2026-06-21 (Fernando) — CLASSROOM MANAGER. Create / rename / delete
  // classrooms here; assign students in the Cuaderno; send to a whole class
  // in the sentence push. Reuses the same admin pw as everything else.
  function _openClassroomModal() { $('m-classroom-modal').classList.remove('hidden'); _renderClassroomList(); }
  function _closeClassroomModal() { $('m-classroom-modal').classList.add('hidden'); }
  function _classroomMsg(t, ok) {
    const el = $('m-classroom-msg'); if (!el) return;
    el.textContent = t || ''; el.style.color = ok === false ? '#ff8a8a' : '#5be8a0';
    if (t) setTimeout(() => { if (el.textContent === t) el.textContent = ''; }, 2500);
  }
  function _renderClassroomList() {
    const box = $('m-classroom-list'); if (!box) return;
    box.innerHTML = '<div style="opacity:.6;text-align:center;padding:8px;">Cargando…</div>';
    fetch('/api/admin/classrooms?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        const list = (data && data.classrooms) || [];
        if (!list.length) { box.innerHTML = '<div style="opacity:.6;text-align:center;padding:12px;">Aún no hay aulas. Crea la primera abajo. 👇</div>'; return; }
        box.innerHTML = '';
        list.forEach((c) => {
          const row = document.createElement('div');
          row.className = 'm-classroom-row';
          row.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px;';
          row.innerHTML =
            '<input class="input m-classroom-name" value="' + escapeHtml(c.name || '') + '" maxlength="40" style="flex:1;min-width:120px;">' +
            '<span class="m-classroom-count" style="font-size:0.8rem;opacity:.8;white-space:nowrap;">👥 ' + (c.studentCount || 0) + ' · 🟢 ' + (c.onlineCount || 0) + '</span>' +
            '<button class="btn btn-jade btn-sm m-classroom-members" title="Ver y editar quién está en esta aula">👥 Alumnos</button>' +
            '<button class="btn btn-ghost btn-sm m-classroom-save" title="Guardar nombre">💾</button>' +
            '<button class="btn btn-red btn-sm m-classroom-del" title="Eliminar aula">🗑</button>';
          row.querySelector('.m-classroom-members').addEventListener('click', () => _openClassroomMembers(c));
          row.querySelector('.m-classroom-save').addEventListener('click', () => {
            const name = row.querySelector('.m-classroom-name').value;
            fetch('/api/admin/classroom/' + encodeURIComponent(c.id) + '?pw=' + encodeURIComponent(pw), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            }).then((r) => r.json()).then((res) => {
              _classroomMsg(res && res.ok ? '✓ Guardado' : ('Error: ' + (res && res.error || '')), !!(res && res.ok));
              if (res && res.ok) _renderClassroomList();
            }).catch((e) => _classroomMsg('Error: ' + e.message, false));
          });
          row.querySelector('.m-classroom-del').addEventListener('click', () => {
            if (!confirm('¿Eliminar el aula "' + (c.name || '') + '"? Los alumnos quedarán Sin asignar (no se borra ningún alumno).')) return;
            fetch('/api/admin/classroom/' + encodeURIComponent(c.id) + '?pw=' + encodeURIComponent(pw), { method: 'DELETE' })
              .then((r) => r.json()).then((res) => { _classroomMsg(res && res.ok ? '✓ Eliminada' : 'No se pudo eliminar', !!(res && res.ok)); _renderClassroomList(); })
              .catch((e) => _classroomMsg('Error: ' + e.message, false));
          });
          box.appendChild(row);
        });
      })
      .catch((e) => { box.innerHTML = '<div style="color:#ff8a8a;text-align:center;">Error: ' + escapeHtml(e.message) + '</div>'; });
  }
  function _createClassroom() {
    const name = ($('m-classroom-new-name').value || '').trim();
    if (!name) { _classroomMsg('Escribe un nombre primero', false); return; }
    fetch('/api/admin/classrooms?pw=' + encodeURIComponent(pw), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => r.json()).then((res) => {
      if (res && res.ok) { $('m-classroom-new-name').value = ''; _classroomMsg('✓ Aula vacía creada — ahora añade alumnos con 👥', true); _renderClassroomList(); }
      else _classroomMsg('Error: ' + (res && res.error || ''), false);
    }).catch((e) => _classroomMsg('Error: ' + e.message, false));
  }
  // 👥 MEMBER EDITOR — see exactly who is in this aula and tick kids in/out.
  // Checked = belongs to THIS aula. Ticking moves them here; unticking makes
  // them Sin asignar. Bulk-friendly: search + scroll, changes save instantly.
  function _openClassroomMembers(classroom) {
    const box = $('m-classroom-list');
    const newRow = document.querySelector('.m-classroom-new');
    if (newRow) newRow.style.display = 'none';
    box.innerHTML = '<div style="opacity:.6;text-align:center;padding:10px;">Cargando alumnos…</div>';
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        const students = ((data && data.students) || []).slice()
          .sort((a, b) => (a.displayName || a.code || '').localeCompare(b.displayName || b.code || ''));
        box.innerHTML =
          '<button class="btn btn-ghost btn-sm" id="m-cls-back">← Volver a aulas</button>' +
          '<h3 style="margin:10px 0 6px;">👥 ' + escapeHtml(classroom.name) + '</h3>' +
          '<p style="font-size:0.8rem;opacity:.7;margin:0 0 8px;">Marca a los alumnos que pertenecen a esta aula. Se guarda al instante.</p>' +
          '<input class="input" id="m-cls-mem-search" placeholder="🔎 Buscar alumno…" style="margin-bottom:8px;">' +
          '<div id="m-cls-mem-list" style="max-height:46vh;overflow:auto;"></div>';
        const listEl = box.querySelector('#m-cls-mem-list');
        const render = (q) => {
          const qq = (q || '').toLowerCase();
          listEl.innerHTML = '';
          const pool = students.filter((s) => !qq
            || (s.displayName || '').toLowerCase().includes(qq)
            || (s.code || '').toLowerCase().includes(qq));
          if (!pool.length) { listEl.innerHTML = '<p style="opacity:.6;text-align:center;padding:8px;">Sin coincidencias.</p>'; return; }
          pool.forEach((s) => {
            const inThis = s.classroomId === classroom.id;
            const elsewhere = (s.classroomName && !inThis) ? ' <span style="opacity:.5;font-size:.78rem;">(' + escapeHtml(s.classroomName) + ')</span>' : '';
            const rowL = document.createElement('label');
            rowL.style.cssText = 'display:flex;gap:8px;align-items:center;padding:5px 2px;cursor:pointer;';
            rowL.innerHTML = '<input type="checkbox"' + (inThis ? ' checked' : '') + '>'
              + '<span>' + escapeHtml(s.displayName || 'Anon') + ' <span style="opacity:.5;">' + escapeHtml(s.code) + '</span>' + elsewhere + '</span>';
            rowL.querySelector('input').addEventListener('change', (e) => {
              const cid = e.target.checked ? classroom.id : '';
              fetch('/api/admin/student/' + encodeURIComponent(s.code) + '/classroom?pw=' + encodeURIComponent(pw), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classroomId: cid }),
              }).then((r) => r.json()).then((res) => {
                if (res && res.ok) { s.classroomId = cid || null; s.classroomName = e.target.checked ? classroom.name : null; }
                else { e.target.checked = !e.target.checked; alert('No se pudo cambiar: ' + (res && res.error || '')); }
              }).catch(() => { e.target.checked = !e.target.checked; });
            });
            listEl.appendChild(rowL);
          });
        };
        render('');
        box.querySelector('#m-cls-mem-search').addEventListener('input', (e) => render(e.target.value));
        box.querySelector('#m-cls-back').addEventListener('click', () => { if (newRow) newRow.style.display = ''; _renderClassroomList(); });
      })
      .catch((e) => { box.innerHTML = '<div style="color:#ff8a8a;text-align:center;">Error: ' + escapeHtml(e.message) + '</div>'; });
  }
  // 🏠 2026-06-21 (Fernando) — TOP-LEVEL "Llevar a casa". Pick online kids and
  // force them out of ANY room / stuck screen ("estás en la sala", a dead PIN
  // room, an old classroom screen) back to their homework profile, so you can
  // re-grab them into a fresh simulation. Reaches them via the 30s heartbeat.
  function _openSendHomePicker() {
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        const online = ((data && data.students) || []).filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000);
        if (!online.length) { alert('No hay alumnos en línea ahora mismo.\n\n(Aparecen aquí los que tienen el portal o un juego abierto.)'); return; }
        let ov = document.getElementById('m-home-modal'); if (ov) ov.remove();
        ov = document.createElement('div');
        ov.id = 'm-home-modal'; ov.className = 'm-modal';
        ov.innerHTML =
          '<div class="m-modal-card">' +
            '<button class="m-modal-close" type="button" aria-label="Cerrar">✕</button>' +
            '<h2>🏠 Llevar a casa</h2>' +
            '<p class="m-modal-sub">Saca a los seleccionados de cualquier sala o pantalla atascada y mándalos a su perfil de tareas. Vuelven en ~30s. Ideal ANTES de abrir una simulación nueva.</p>' +
            '<div class="m-force-actions">' +
              '<button class="btn btn-ghost btn-sm" id="m-home-all">✅ Todos</button>' +
              '<button class="btn btn-ghost btn-sm" id="m-home-none">⬜ Ninguno</button>' +
            '</div>' +
            '<div class="m-force-students" id="m-home-students"></div>' +
            '<button class="btn btn-gold btn-xl" id="m-home-go" style="margin-top:14px;width:100%;">🏠 Mandar a casa</button>' +
          '</div>';
        document.body.appendChild(ov);
        const listEl = ov.querySelector('#m-home-students');
        online.forEach((s) => {
          const row = document.createElement('label');
          row.className = 'm-force-row';
          row.innerHTML =
            '<input type="checkbox" data-code="' + escapeHtml(s.code) + '" checked>' +
            '<span class="m-force-row-dot"></span>' +
            '<span class="m-force-row-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
            '<span class="m-force-row-code">' + escapeHtml(s.code) + '</span>';
          listEl.appendChild(row);
        });
        const close = () => { try { ov.remove(); } catch (_) {} };
        ov.querySelector('.m-modal-close').addEventListener('click', close);
        ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        ov.querySelector('#m-home-all').addEventListener('click', () => listEl.querySelectorAll('input').forEach((c) => { c.checked = true; }));
        ov.querySelector('#m-home-none').addEventListener('click', () => listEl.querySelectorAll('input').forEach((c) => { c.checked = false; }));
        ov.querySelector('#m-home-go').addEventListener('click', () => {
          const codes = Array.from(listEl.querySelectorAll('input:checked')).map((c) => c.dataset.code).filter(Boolean);
          if (!codes.length) { alert('Selecciona al menos un alumno.'); return; }
          fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(pw), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentCodes: codes, text: '📚 Tu maestra te envió a tu perfil de tareas.', actionType: 'gohome', actionUrl: '/homework', actionLabel: 'Ir a mis tareas →' }),
          }).then((r) => r.json()).then((res) => {
            if (res && res.ok) { alert('🏠 ' + (res.sent || codes.length) + ' alumno(s) volverán a su perfil en ~30s.'); close(); }
            else alert('Error: ' + (res && res.error || 'desconocido'));
          }).catch((e) => alert('Error: ' + e.message));
        });
      })
      .catch((e) => alert('Error: ' + e.message));
  }
  if ($('m-home-btn')) $('m-home-btn').addEventListener('click', _openSendHomePicker);

  if ($('m-classroom-btn')) $('m-classroom-btn').addEventListener('click', _openClassroomModal);
  if ($('m-classroom-close')) $('m-classroom-close').addEventListener('click', _closeClassroomModal);
  if ($('m-classroom-add')) $('m-classroom-add').addEventListener('click', _createClassroom);

  $('m-gif-btn').addEventListener('click', _openGifModal);
  $('m-gif-close').addEventListener('click', _closeGifModal);
  $('m-gif-search').addEventListener('input', (e) => { _gifSearch = e.target.value || ''; _renderGifList(); });
  $('m-gif-online').addEventListener('click', (e) => {
    _gifOnlineOnly = !_gifOnlineOnly;
    e.currentTarget.textContent = _gifOnlineOnly ? '🟢 Solo en línea ✓' : '🟢 Solo en línea';
    _renderGifList();
  });
  $('m-gif-all').addEventListener('click', () => {
    document.querySelectorAll('#m-gif-list input[type=checkbox]').forEach((cb) => {
      cb.checked = true;
      _gifChecked.add(cb.dataset.code);
    });
    _renderGifList(); _updateGifSendBtn();
  });
  $('m-gif-none').addEventListener('click', () => { _gifChecked.clear(); _renderGifList(); _updateGifSendBtn(); });
  $('m-gif-send').addEventListener('click', () => {
    if (!_gifPick || !_gifChecked.size) return;
    const btn = $('m-gif-send');
    btn.disabled = true;
    $('m-gif-msg').textContent = 'Enviando…';
    fetch('/api/admin/gif-push?pw=' + encodeURIComponent(pw), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCodes: Array.from(_gifChecked), animId: _gifPick }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res && res.ok) {
          $('m-gif-msg').textContent = '✓ ' + res.label + ' enviado a ' + res.sent + ' alumno(s). Aparece en su pantalla en ~20s.';
          setTimeout(() => { _closeGifModal(); }, 1800);
        } else {
          $('m-gif-msg').textContent = '✗ ' + ((res && res.error) || 'no se pudo');
          _updateGifSendBtn();
        }
      })
      .catch((e) => { $('m-gif-msg').textContent = '✗ ' + e.message; _updateGifSendBtn(); });
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
    // 🆕 2026-06-16 (Fernando bug): don't rebuild the roster while the
    // teacher is actively typing in the search box — the 15s refresh was
    // wiping the input + filter mid-search ("I type Sophia, then get
    // kicked back to all students"). If the search input has focus, skip
    // this tick entirely. (The persisted term below covers refreshes
    // that DO happen while a filter is applied but unfocused.)
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains('m-roster-search-input')) return;
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

  // 🆕 2026-06-16 — persisted roster search term (survives auto-refresh).
  let _rosterSearch = '';
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
    // 🔍 SEARCH BAR — when the teacher has many students (esp. multiple
    // 'Luis' or 'María'), scrolling is painful. This filter narrows the
    // roster by name OR code in real time. Useful for sharing the secret
    // code with a specific parent without scrolling-and-guessing.
    const searchBar = document.createElement('div');
    searchBar.className = 'm-roster-search';
    searchBar.innerHTML = `
      <input class="m-roster-search-input" type="text" inputmode="search"
             placeholder="🔍 Buscar alumno por nombre o código…"
             autocomplete="off" autocorrect="off" spellcheck="false">
      <span class="m-roster-search-count" id="m-roster-search-count">${students.length} alumnos</span>`;
    roster.appendChild(searchBar);
    students.forEach((s) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'm-row' + (s._onlineNow ? ' is-online' : '');
      // Tone-strip + lowercase the searchable haystack so the teacher can
      // type "luis" and match "Luís", "Luisa", "LUIS_42", etc.
      const haystack = ((s.displayName || '') + ' ' + (s.code || ''))
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
      row.dataset.search = haystack;
      // Friendly "5 min ago" / "2h ago" / "May 27" timestamp
      const sinceTxt = s._onlineNow
        ? formatRelative(s._secsAgo)
        : (s.lastSeen ? new Date(s.lastSeen).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '—');
      row.innerHTML = `
        <span class="m-row-avatar">${renderAvatar(s.avatar)}${s._onlineNow ? '<span class="m-online-dot" title="En línea ahora"></span>' : ''}</span>
        <span class="m-row-code">${escapeHtml(s.code)}</span>
        <span class="m-row-name">${escapeHtml(s.displayName || 'Anon')}</span>
        <span class="m-row-classroom" title="Aula" style="font-size:0.78rem;opacity:0.85;white-space:nowrap;">${s.classroomName ? '🎓 ' + escapeHtml(s.classroomName) : ''}</span>
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
    // Wire the search filter — runs on every keystroke, no debounce
    // needed for ~30-100 rows; hides rows whose search-haystack doesn't
    // contain the query (tone-stripped lowercase substring match).
    const searchInput = searchBar.querySelector('.m-roster-search-input');
    const countEl = searchBar.querySelector('#m-roster-search-count');
    // Apply the current term to the visible rows + update the count.
    function applyRosterFilter() {
      const q = (_rosterSearch || '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
      let visible = 0;
      roster.querySelectorAll('.m-row').forEach((r) => {
        const match = !q || (r.dataset.search || '').includes(q);
        r.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      if (countEl) {
        countEl.textContent = q
          ? (visible + ' de ' + students.length + ' coinciden')
          : (students.length + ' alumno' + (students.length === 1 ? '' : 's'));
      }
    }
    if (searchInput) {
      // 🆕 2026-06-16 — persist the search term in module state so the
      // 15s auto-refresh (which rebuilds this whole list) doesn't lose
      // what the teacher typed. On every render we restore the value +
      // re-apply the filter.
      searchInput.value = _rosterSearch || '';
      searchInput.addEventListener('input', () => {
        _rosterSearch = searchInput.value;
        applyRosterFilter();
      });
      if (_rosterSearch) applyRosterFilter();
    }
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
        <div class="m-detail-meta" style="margin-top:6px;">
          🎓 Aula: <select class="input" id="m-detail-classroom" style="display:inline-block;width:auto;min-width:150px;"><option value="">Cargando…</option></select>
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
    // 🎓 2026-06-21 (Fernando) — classroom selector: populate with all aulas
    // and file/un-file this student on change. Uses the teacher-managed
    // classroomId (sticks across logins, doesn't touch parent-privacy).
    (function _wireClassroomSelect() {
      const sel = $('m-detail-classroom');
      if (!sel) return;
      fetch('/api/admin/classrooms?pw=' + encodeURIComponent(pw))
        .then((r) => r.json())
        .then((cd) => {
          const list = (cd && cd.classrooms) || [];
          let html = '<option value="">— Sin asignar —</option>';
          list.forEach((c) => {
            html += '<option value="' + escapeHtml(c.id) + '"' + (c.id === data.classroomId ? ' selected' : '') +
              '>' + escapeHtml(c.name) + (c.code ? ' (' + escapeHtml(c.code) + ')' : '') + '</option>';
          });
          sel.innerHTML = html;
        })
        .catch(() => { sel.innerHTML = '<option value="">(no se pudieron cargar las aulas)</option>'; });
      sel.addEventListener('change', () => {
        fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/classroom?pw=' + encodeURIComponent(pw), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classroomId: sel.value }),
        }).then((r) => r.json()).then((res) => {
          if (!res || !res.ok) alert('No se pudo cambiar el aula: ' + (res && res.error || ''));
        }).catch((e) => alert('Error: ' + e.message));
      });
    })();
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
    // 🏆 HSK simulation history — pinned at the TOP of the detail body
    // per user feedback: "this is the top, top, top of everything that
    // I need to see when I click on each profile". Shows count per sim
    // (best, latest) plus every individual attempt.
    const hskList = data.hskResults || [];
    if (hskList.length) {
      // Group by simId so the teacher sees "HSK1·SIM1 → 3 intentos,
      // mejor 93%, último 78%" at a glance.
      const bySim = {};
      hskList.forEach((r) => {
        const k = r.simId || '?';
        if (!bySim[k]) bySim[k] = { simId: k, attempts: 0, best: 0, latest: null, all: [] };
        bySim[k].attempts++;
        if ((r.percent || 0) > bySim[k].best) bySim[k].best = r.percent || 0;
        if (!bySim[k].latest || (r.ts || 0) > (bySim[k].latest.ts || 0)) bySim[k].latest = r;
        bySim[k].all.push(r);
      });
      const h = document.createElement('div');
      h.className = 'm-section-title';
      h.textContent = '🏆 Simulaciones HSK';
      body.appendChild(h);
      // Per-sim summary cards
      Object.values(bySim).forEach((g) => {
        const card = document.createElement('div');
        card.className = 'm-hsk-detail-card';
        const cls = g.best >= 80 ? 'great' : g.best >= 60 ? 'ok' : 'low';
        card.classList.add('is-' + cls);
        card.innerHTML =
          '<div class="m-hsk-detail-head">' +
            '<span class="m-hsk-detail-sim">' + escapeHtml(g.simId.toUpperCase()) + '</span>' +
            '<span class="m-hsk-detail-attempts">' + g.attempts + ' intento' + (g.attempts === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<div class="m-hsk-detail-stats">' +
            '<div><span class="m-hsk-detail-label">Mejor nota</span><span class="m-hsk-detail-best">' + g.best + '%</span></div>' +
            '<div><span class="m-hsk-detail-label">Último intento</span><span class="m-hsk-detail-last">' + g.latest.percent + '% · ' + new Date(g.latest.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + '</span></div>' +
          '</div>';
        body.appendChild(card);
        // Per-attempt list — sorted oldest→newest so "Intento 1, 2,
        // 3…" reads chronologically. The teacher can see if the kid
        // improved or got worse across attempts.
        const chrono = g.all.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
        chrono.forEach((r, i) => {
          const dateStr = new Date(r.ts).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          const pct = r.percent || 0;
          const cls2 = pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low';
          const isLatest = i === chrono.length - 1;
          const isBest = pct === g.best;
          const tag = (isBest ? ' 🏅' : '') + (isLatest ? ' ✨' : '');
          // 🆕 2026-06-04 (Fernando): each attempt is now clickable.
          // Tapping the row fetches the wrong-question breakdown for
          // that attempt and renders it inline so the teacher sees
          // which specific questions the kid missed. Older attempts
          // (recorded before this change) don't have wrongQs saved,
          // so the expander shows a "datos no guardados" note.
          const row = document.createElement('div');
          row.className = 'm-asg-row m-hsk-attempt-row ' + cls2;
          row.dataset.ts = String(r.ts || 0);
          row.dataset.code = data.code;
          // 🆕 2026-06-04 (Fernando): each attempt row now has a small
          // 🗑 button so the teacher can erase a bad attempt. The
          // delete propagates to the parent view + kid Mis Exámenes
          // automatically (those surfaces refetch on open).
          row.innerHTML =
            '<span class="m-asg-title">Intento ' + (i + 1) + tag + ' <small class="m-hsk-attempt-toggle">▶ Ver errores</small></span>' +
            '<span class="m-asg-score">' + r.score + '/' + r.total + ' <small>(' + pct + '%)</small></span>' +
            '<span class="m-asg-date">' + dateStr + '</span>' +
            '<button class="m-hsk-attempt-del" type="button" title="Borrar este intento (también desaparece del dashboard del padre y del alumno)" data-ts="' + (r.ts || 0) + '" data-code="' + escapeHtml(data.code) + '">🗑</button>';
          const mistakeWrap = document.createElement('div');
          mistakeWrap.className = 'm-hsk-attempt-mistakes hidden';
          let mistakesLoaded = false;
          // 🗑 Delete button — needs its own handler that swallows the click
          // so the row's expand handler doesn't fire underneath. Confirms,
          // then DELETEs and removes the row + its mistake panel from the
          // DOM. The Cuaderno header counters above still reflect the old
          // count until the next Cuaderno open; close + reopen if you want
          // a totally fresh render.
          const delBtn = row.querySelector('.m-hsk-attempt-del');
          if (delBtn) {
            delBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              ev.preventDefault();
              if (!confirm('¿Borrar este intento? Desaparecerá también del dashboard de los papás y del alumno.')) return;
              fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/hsk-attempt/delete?pw=' + encodeURIComponent(pw), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ts: r.ts }),
              })
                .then((rr) => rr.json())
                .then((d) => {
                  if (!d || !d.ok) { alert('No se pudo borrar: ' + (d && d.error || 'error')); return; }
                  row.classList.add('is-leaving');
                  mistakeWrap.classList.add('is-leaving');
                  setTimeout(() => { try { row.remove(); mistakeWrap.remove(); } catch (_) {} }, 250);
                })
                .catch((e) => alert('Error: ' + e.message));
            });
          }
          row.addEventListener('click', (ev) => {
            // If the click happened on the delete button (or its child icon),
            // skip the expand — the delete handler runs in its own listener.
            if (ev.target.closest('.m-hsk-attempt-del')) return;
            const toggle = row.querySelector('.m-hsk-attempt-toggle');
            const isOpen = !mistakeWrap.classList.contains('hidden');
            if (isOpen) {
              mistakeWrap.classList.add('hidden');
              if (toggle) toggle.textContent = '▶ Ver errores';
              return;
            }
            mistakeWrap.classList.remove('hidden');
            if (toggle) toggle.textContent = '▼ Ocultar errores';
            if (mistakesLoaded) return;
            mistakesLoaded = true;
            mistakeWrap.innerHTML = '<div class="m-hsk-attempt-loading">Cargando…</div>';
            const ts = encodeURIComponent(row.dataset.ts);
            fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/hsk-attempt?pw=' + encodeURIComponent(pw) + '&ts=' + ts)
              .then((rr) => rr.json())
              .then((d) => {
                if (!d || !d.ok) {
                  mistakeWrap.innerHTML = '<div class="m-hsk-attempt-empty">No se pudo cargar: ' + escapeHtml(d && d.error || 'error') + '</div>';
                  return;
                }
                if (!d.wrongQs || !d.wrongQs.length) {
                  mistakeWrap.innerHTML = '<div class="m-hsk-attempt-perfect">🎉 ¡Sin errores en este intento!</div>';
                  return;
                }
                // Older attempts pre-2026-06-04 won't have wrongQs
                // stored. We can't tell them apart from a perfect
                // score by length alone — but we CAN check: if the
                // kid got 100% AND wrongQs is empty, it's perfect;
                // otherwise if they got <100% AND wrongQs is empty,
                // the data just wasn't captured yet.
                if (d.percent < 100 && !d.wrongQs.length) {
                  mistakeWrap.innerHTML = '<div class="m-hsk-attempt-empty">⚠️ Datos no guardados para este intento (anterior al 4 jun 2026).</div>';
                  return;
                }
                const heading = '<div class="m-hsk-attempt-heading">❌ ' + d.wrongCount + ' pregunta' + (d.wrongCount === 1 ? '' : 's') + ' incorrecta' + (d.wrongCount === 1 ? '' : 's') + '</div>';
                const rows = d.wrongQs.map((wq) => {
                  const ans = (wq.given == null || wq.given === '') ? '<em>(sin responder)</em>' : escapeHtml(String(wq.given));
                  const exp = escapeHtml(String(wq.expected));
                  const label = wq.questionLabel ? ' <span class="m-hsk-q-label">· ' + escapeHtml(wq.questionLabel) + '</span>' : '';
                  return '<div class="m-hsk-wrong-row">' +
                    '<span class="m-hsk-wrong-qid">' + escapeHtml(wq.qid) + label + '</span>' +
                    '<span class="m-hsk-wrong-given">Eligió: <strong>' + ans + '</strong></span>' +
                    '<span class="m-hsk-wrong-expected">Correcto: <strong>' + exp + '</strong></span>' +
                  '</div>';
                }).join('');
                mistakeWrap.innerHTML = heading + rows;
              })
              .catch((e) => { mistakeWrap.innerHTML = '<div class="m-hsk-attempt-empty">Error: ' + escapeHtml(e.message) + '</div>'; });
          });
          body.appendChild(row);
          body.appendChild(mistakeWrap);
        });
      });
    }
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
        // Custom-word snapshot — falls back BEFORE rendering the raw
        // wid so the teacher sees real pinyin/hanzi for ephemeral
        // teacher-typed words (Fernando 2026-06-06: "the word that
        // didn't exist appeared as the actual word, not a code").
        const _customMap = {};
        if (Array.isArray(s.customWords)) {
          s.customWords.forEach((cw) => { if (cw && cw.id) _customMap[cw.id] = cw; });
        }
        const wordsHtml = (s.words || []).map((wid) => {
          const w = (window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid]) || _customMap[wid];
          if (!w) return '<span class="m-sent-word"><span class="m-sent-pin">' + escapeHtml(wid) + '</span></span>';
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
        const pushedBadge = s.pushedByTeacher
          ? ' · <span class="m-sent-pushed">📤 enviada por ' + escapeHtml(s.teacherName || 'maestra') + '</span>'
          : '';
        item.innerHTML = `
          <div class="m-sent-head">
            <span class="m-sent-date">📅 ${dateStr}${s.editedAt ? ' · ✏️ editada' : ''}${pushedBadge}</span>
            <button class="m-sent-edit" type="button" data-ts="${s.ts}" title="Editar esta oración (corregir typos, separar palabras pegadas)">✏️</button>
            <button class="m-sent-del" type="button" data-ts="${s.ts}" title="Borrar esta oración">🗑</button>
          </div>
          <div class="m-sent-words">${wordsHtml}</div>`;
        // ✏️ Per-row edit — opens an inline editor where the teacher
        // can fix typos, separate words that got mashed together, or
        // reorder. Submits in place — keeps the original timestamp so
        // the entry stays in its chronological slot.
        item.querySelector('.m-sent-edit').addEventListener('click', () => {
          const currentText = (s.words || []).map((wid) => {
            const w = (window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid]) || _customMap[wid];
            return w ? w.pinyin : String(wid);
          }).join(' ');
          const next = prompt(
            'Edita la oración (separa cada palabra con un espacio):\n\n' +
            'Tip: si dos palabras están pegadas como "wǒshì", sepáralas: "wǒ shì".',
            currentText
          );
          if (next === null) return;            // cancelled
          const cleaned = String(next).trim();
          if (!cleaned) { alert('La oración no puede quedar vacía.'); return; }
          // Tokenize back to wordIDs the same way the homework save does
          const stripTones = (str) => String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
          const byBare = {};
          if (window.WU_WORD_BY_ID) {
            Object.keys(window.WU_WORD_BY_ID).forEach((id) => {
              const w = window.WU_WORD_BY_ID[id];
              if (w && w.pinyin) byBare[stripTones(w.pinyin).replace(/\s+/g, '')] = id;
            });
          }
          const newWords = cleaned.split(/\s+/).filter(Boolean).map((chunk) => {
            const bare = stripTones(chunk).replace(/\s+/g, '');
            return byBare[bare] || chunk;
          });
          fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/sentence/edit?pw=' + encodeURIComponent(pw), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ts: s.ts, words: newWords }),
          }).then((r) => r.json()).then((r) => {
            if (!r.ok) { alert('No se pudo editar: ' + (r.error || 'desconocido')); return; }
            // Refresh — quickest path is just to re-render the detail.
            data.sentences = r.sentences || data.sentences;
            renderDetail(data);
          }).catch((e) => alert('Error: ' + e.message));
        });
        // 🗑 Per-row delete — surgical, propagates to kid's Mis oraciones
        // and the parent 0→2000 progress bar (rec.sentencesBuilt.length).
        item.querySelector('.m-sent-del').addEventListener('click', () => {
          if (!confirm('¿Borrar esta oración del ' + dateStr + '?\n\nEl cambio se refleja en Mis oraciones del alumno y en el panel de los papás.')) return;
          fetch('/api/admin/student/' + encodeURIComponent(data.code) + '/sentence/delete?pw=' + encodeURIComponent(pw), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ts: s.ts }),
          }).then((r) => r.json()).then((r) => {
            if (!r.ok) { alert('No se pudo borrar.'); return; }
            item.remove();
            // Update the header count + warn if empty.
            data.sentences = r.sentences || [];
            const meta = document.querySelector('.m-detail-meta');
            if (meta) meta.innerHTML = meta.innerHTML.replace(/📝 \d+ oraciones/, '📝 ' + data.sentences.length + ' oraciones');
            if (!data.sentences.length) {
              body.querySelector('.m-section-title')?.remove();
            }
          }).catch((e) => alert('Error: ' + e.message));
        });
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
