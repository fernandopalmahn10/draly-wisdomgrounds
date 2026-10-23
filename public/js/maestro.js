// =========================================================================
// maestro.js — Standalone teacher Cuaderno (no session needed)
//
// Per user feedback 2026-05-27: "Give me a teacher password so I can see
// the cuaderno without having to host a game and have a device randomly
// join." (2026-10-15: never write a real teacher code in a public file —
// this one is served to every visitor.)
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
  // ONE meaning of «online» for the whole dashboard (2026-10-13; it was 30 s in the launcher, 45 s on the roster and
  // 60 s in Send home / GIF / force pickers, so the hero said 4 while the launcher listed 3). Kids poll their inbox
  // every 20 s and game pages ping every 30 s: 45 s covers one missed beat without letting stale records through.
  const ONLINE_MS = 45 * 1000;
  const isOnlineNow = (s, now) => !!(s && s.lastSeen && ((now || Date.now()) - s.lastSeen) <= ONLINE_MS);

  let pw = '';
  try { pw = localStorage.getItem(STORAGE_PW) || ''; } catch (_) {}

  // 🔒 2026-10-11 (security): the teacher code travels in the X-Admin-Pw request
  // header, never in a URL (URLs end up in Render/proxy access logs). URI-encoded
  // because headers only carry Latin-1; server.js _adminPw() decodes it.
  function adminFetch(url, code, opts) {
    const o = Object.assign({}, opts);
    o.headers = Object.assign({}, o.headers, { 'X-Admin-Pw': encodeURIComponent(code || '') });
    return fetch(url, o);
  }
  // The roster call with its HTTP status (2026-10-13): only 401/403 means a wrong code. 429 is the server's lockout
  // after repeated wrong codes from one network (a whole school shares one IP) and 5xx is a server hiccup: neither may
  // wipe the saved code or send the teacher to the sign-in card. A stalled request gives up after 12 s.
  function _studentsRequest(code, timeoutMs) {
    const ctl = window.AbortController ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 12000) : null;
    return adminFetch('/api/admin/students', code, ctl ? { signal: ctl.signal } : undefined)
      .then((r) => r.json().catch(() => null).then((data) => ({ status: r.status, data })))
      .finally(() => { if (t) clearTimeout(t); });
  }
  // /host-hsk.html gets the code through same-origin storage (host-hsk.js reads
  // localStorage 'mochi.maestroPw'), not the address bar. If storage is blocked,
  // fall back to the old &pw= so the teacher is never stuck mid-class.
  function withHskCode(url, code) {
    try { localStorage.setItem('mochi.maestroPw', code); return url; }
    catch (_) { return url + '&pw=' + encodeURIComponent(code); }
  }

  // ── 2026-10-13 remake helpers ─────────────────────────────────────────
  // Toasts replace the blocking alert() boxes: a projector never shows a dialog that freezes the class.
  // Errors stay longer and are announced (role=alert); a tap or ✕ dismisses.
  // action (2026-10-22, «Change level»'s «Undo»): { label, run, ms } = one button in the toast, which stays ms long
  function notify(msg, tone, action) {
    const box = $('m-toasts');
    const text = String(msg == null ? '' : msg);
    if (!box) { try { window.alert(text); } catch (_) {} return; }
    const t = tone || (/^(✕|✗|⚠)|error|could not|couldn't|can't|cannot|network|failed|not found|unknown|no students|select at least|pick at least|enter a|type a/i.test(text) ? 'error'
      : (/^(✓|✅|🏠|📤)/.test(text) ? 'ok' : ''));
    const el = document.createElement('div');
    el.className = 'm-toast' + (t ? ' is-' + t : '');
    el.setAttribute('role', t === 'error' ? 'alert' : 'status');
    el.innerHTML = '<span class="m-toast-text"></span>' + (action ? '<button class="m-toast-act" type="button"></button>' : '') +
      '<button class="m-toast-x" type="button" aria-label="Dismiss">✕</button>';
    el.querySelector('.m-toast-text').textContent = text;
    const kill = () => {
      if (!el.isConnected) return;
      el.classList.add('is-leaving');
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 170);
    };
    if (action) {
      const b = el.querySelector('.m-toast-act');
      b.textContent = action.label || 'Undo';
      b.addEventListener('click', () => { b.disabled = true; kill(); try { action.run(); } catch (_) {} });
    }
    el.querySelector('.m-toast-x').addEventListener('click', kill);
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(kill, action && action.ms ? action.ms : Math.min(t === 'error' ? 12000 : 9000, (t === 'error' ? 6000 : 3500) + text.length * 45));
  }

  // Every .m-modal (static or built by this file) gets the same behaviour: dialog semantics, focus moves in and
  // comes back, Esc closes the top one, the page behind stops scrolling, Tab stays inside.
  let _dlgN = 0;
  function _openModals() {
    return Array.from(document.querySelectorAll('.m-modal')).filter((m) => !m.classList.contains('hidden'));
  }
  function _syncModals() {
    const open = _openModals();
    open.forEach((m) => {
      if (m._mOpen) return;
      m._mOpen = true;
      m._mReturn = document.activeElement;
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-modal', 'true');
      const h = m.querySelector('h2');
      if (h) { if (!h.id) h.id = 'm-dlg-title-' + (++_dlgN); m.setAttribute('aria-labelledby', h.id); }
      const card = m.querySelector('.m-modal-card');
      if (card) {
        card.setAttribute('tabindex', '-1');
        setTimeout(() => { if (!m.classList.contains('hidden') && m.isConnected && !card.contains(document.activeElement)) card.focus({ preventScroll: true }); }, 30);
      }
    });
    document.querySelectorAll('.m-modal').forEach((m) => {
      if (m._mOpen && m.classList.contains('hidden')) _modalClosed(m);
    });
    // a window opened from another (Reading → Force) hides the one below, so only one ✕ shows
    open.forEach((m, i) => m.classList.toggle('is-under', i < open.length - 1));
    document.body.classList.toggle('m-modal-open', open.length > 0);
  }
  function _modalClosed(m) {
    m._mOpen = false;
    const back = m._mReturn;
    m._mReturn = null;
    const open = _openModals();
    const top = open[open.length - 1];
    // back to the trigger: on the page, or inside the window that is on top again (Reading → Force → close)
    if (back && back.isConnected && typeof back.focus === 'function' && (!open.length || (top && top.contains(back)))) {
      try { back.focus({ preventScroll: true }); } catch (_) {}
    }
  }
  new MutationObserver((records) => {
    records.forEach((rec) => rec.removedNodes && rec.removedNodes.forEach((n) => {
      if (n.nodeType === 1 && n.classList && n.classList.contains('m-modal') && n._mOpen) _modalClosed(n);
    }));
    _syncModals();
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;   // a pinyin/IME candidate box takes Esc, not the window
    if (e.key === 'Escape') {
      const card = document.querySelector('.wu-prac-cardwrap');
      if (card) { card.remove(); return; }
      const review = $('m-em-review-panel');
      if (review && !review.classList.contains('hidden')) { review.classList.add('hidden'); return; }
      const open = _openModals();
      const top = open[open.length - 1];
      if (!top) return;
      const x = top.querySelector('.m-modal-close');
      if (x) x.click(); else top.classList.add('hidden');
      return;
    }
    if (e.key === 'Tab') {
      const open = _openModals();
      const top = open[open.length - 1];
      if (!top) return;
      const items = Array.from(top.querySelectorAll('button, [href], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])'))
        .filter((x) => !x.disabled && x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const card = top.querySelector('.m-modal-card');
      if (!top.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      else if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // Sticky elements under the sticky top bar need its real height (it grows when the Teachers tab shows).
  (function trackTopbar() {
    const bar = document.querySelector('.m-topbar');
    if (!bar || !window.ResizeObserver) return;
    new ResizeObserver(() => {
      if (bar.offsetHeight) document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight + 'px');
    }).observe(bar);
  })();
  // Two of the gang stand with Dralingo on the sign-in card, a new pair each visit (public/js/cast.js).
  (function loginCast() {
    if (!window.DralingoCast) return;
    DralingoCast.pick(2).forEach((id, k) => {
      const img = $(k ? 'm-login-cast-b' : 'm-login-cast-a');
      if (!img) return;
      img.onerror = () => { img.hidden = true; };
      img.onload = () => { img.hidden = false; };
      img.src = DralingoCast.pose(id, 'hello');
    });
  })();

  // ── Login
  if (pw) $('m-pw').value = pw;
  $('m-enter-btn').addEventListener('click', tryEnter);
  $('m-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryEnter(); });

  function showDashboard() {
    $('m-login').classList.add('hidden');
    $('m-dash').classList.remove('hidden');
  }
  function tryEnter() {
    const v = $('m-pw').value.trim();
    const btn = $('m-enter-btn');
    if (btn.disabled) return;   // Enter pressed again while signing in: one request, not two failed attempts
    if (!v) { $('m-login-err').textContent = 'Type your teacher code.'; $('m-pw').focus(); return; }
    $('m-login-err').textContent = '';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const done = () => { btn.disabled = false; btn.textContent = 'Enter'; };
    // Validate by hitting the roster endpoint
    _studentsRequest(v)
      .then(({ status, data }) => {
        done();
        if (!data || !data.ok) {
          $('m-login-err').textContent = status === 429
            ? 'Too many wrong codes from this network. Wait about 10 minutes, then try again.'
            : (status >= 500 ? 'The server is busy. Try again in a moment.' : 'That code didn\'t work. Check it and try again.');
          return;
        }
        pw = v;
        try { localStorage.setItem(STORAGE_PW, pw); } catch (_) {}
        showDashboard();
        renderRoster(data.students || [], data.self || null, data.archived);
      })
      .catch(() => { done(); $('m-login-err').textContent = 'Can\'t reach the server. Check the Wi-Fi and try again.'; });
  }

  $('m-logout').addEventListener('click', () => {
    // a mis-tap mid-class would mean retyping the code in front of the kids
    if (!confirm('Log out of Teacher Mode?\n\nYou will need your teacher code to come back.')) return;
    try { localStorage.removeItem(STORAGE_PW); } catch (_) {}
    pw = '';
    $('m-dash').classList.add('hidden');
    $('m-login').classList.remove('hidden');
    $('m-pw').value = '';
    // a clean page for the next teacher on a shared laptop (open profile, drafts, filters, the last session's data)
    try { sessionStorage.removeItem('dralyLiveMaster'); } catch (_) {}
    // 🔑 2026-10-15: and this device stops being a teacher's (games ask for the code again)
    const reload = () => location.reload();
    fetch('/api/teacher-device/forget', { method: 'POST', credentials: 'same-origin', keepalive: true }).then(reload, reload);
  });
  $('m-refresh').addEventListener('click', () => {
    _authStopped = false;   // a manual refresh may try again after a «code not accepted»
    fetchRoster();
  });
  // 🎯 Modo Maestro en vivo — invite only currently-ONLINE students to a
  // live warmup session. User feedback 2026-05-27: "select from the list
  // of people that are online and enable that for everybody I select."
  let _liveMasterStudents = [];   // populated when modal opens
  let _liveMasterSelected = new Set();
  $('m-live-master-btn').addEventListener('click', () => {
    adminFetch('/api/admin/students', pw)
      .then((r) => r.json())
      .catch(() => null)
      .then((data) => {
        if (!data || !data.ok) { notify('Could not load the students. Check the connection and try again.' + (data && data.error ? ' (' + data.error + ')' : '')); return; }
        const now = Date.now();
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
      `${_liveMasterStudents.length} online · ${_liveMasterSelected.size} selected`;
    if (!_liveMasterStudents.length) {
      list.innerHTML = '<div class="m-empty">Nobody is online right now. Ask the kids to open their homework (/homework) on their phones, then open this again.</div>';
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
          `${_liveMasterStudents.length} online · ${_liveMasterSelected.size} selected`;
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
    const text = $('m-live-master-text').value.trim() || 'Join Live Teacher Mode now!';
    if (!_liveMasterSelected.size) { $('m-live-master-msg').textContent = 'Select at least one student.'; return; }
    $('m-live-master-msg').textContent = 'Starting Live Teacher Mode…';
    try {
      sessionStorage.setItem('dralyLiveMaster', JSON.stringify({
        codes: Array.from(_liveMasterSelected),
        pw,                 // teacher's login code — same-origin, ephemeral
        text,
        ts: Date.now(),
      }));
    } catch (e) {
      $('m-live-master-msg').textContent = 'Could not start (storage blocked).';
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
  // 🚀 LAUNCH A GAME (remade 2026-10-21, his ask: "I want to launch the game and just launch the game, like a shortcut
  // of the home screen… without me having to pick someone"; CLAUDE.md «launching a game never asks to pick kids").
  // One tap on a game = its projector page opens at once (the plain host page, like /games): the PIN shows on the
  // screen and the kids join with it. Calling in the kids who are online right now is an extra, a checkbox that
  // starts OFF; when it is on, the kids are pulled in the old way (?livegame=1 + sessionStorage dralyLiveGame,
  // /js/live-game.js on every host page; the warm-up through ?livemaster=1).
  //   id     — the card's id (dralyLastLaunchGame remembers the last one)
  //   host   — the projector page it opens
  //   label / emoji / blurb — what the card shows
  //   official — opens the «Official tests» window instead (the exam rooms have their own flow)
  // ════════════════════════════════════════════════════════════════
  const LAUNCHER_GAMES = [
    { id: 'warmup',  label: 'Live Teacher Mode', emoji: '✏️', host: '/host-warmup.html', blurb: 'Build sentences with the class on the projector',
      // (calling kids in: the proven Modo Maestro flow, same tab)
      call: (ctx) => {
        try {
          sessionStorage.setItem('dralyLiveMaster', JSON.stringify({ codes: ctx.codes, pw: ctx.pw, text: 'Join Live Teacher Mode now!', ts: Date.now() }));
        } catch (_) { notify('Could not save the session.'); return false; }
        location.href = '/host-warmup.html?livemaster=1';
        return true;
      } },
    { id: 'reading', label: 'Class Reading', emoji: '📖', host: '/host-reading.html', blurb: 'Read a story together, with a quiz at the end' },
    { id: 'hsksim',  label: 'Official tests', emoji: '🏆', official: true, blurb: 'YCT, New HSK and Old HSK exam rooms' },
    // Las Trampillas (2026-10-17): Mario Party's trapdoor platform
    { id: 'trapdoor', label: 'Las Trampillas', emoji: '🕳️', host: '/host-trapdoor.html', blurb: 'Whole class on a round platform: pink trapdoors open at 0; right answers give wings (Mario Party)' },
    // Ojos de Halcón (2026-10-13) replaced the first «Ojo de Halcón» (`look`, retired 2026-10-14)
    { id: 'halcon',   label: 'Ojos de Halcón', emoji: '🦅', host: '/host-halcon.html', blurb: 'Look at the right window first, boards of 4 (Mario Party)' },
    { id: 'teamcrab', label: '¡Atrapa a Fénec!', emoji: '🦀', host: '/host-teamcrab.html', blurb: 'Crews of 4 pilot a robot crab: a right answer loads your hammer, tap Fénec to bonk him and win the words back; a miss lets him steal one. Mario Party «Team Crab»' },
    { id: 'dormilon', label: '¡No despiertes a Dralingo!', emoji: '😴', host: '/host-dormilon.html', blurb: 'Take turns: each right answer strokes sleeping Dralingo (+1); wake him and lose it all. Boards of 4 (Mario Party)' },
    { id: 'escape',   label: 'La Gran Fuga de Dubái', emoji: '🚀', host: '/host-escape.html', blurb: 'Whole class runs from Robotín: Dubai or China route' },
    { id: 'snow',     label: 'Batalla de Nieve', emoji: '❄️', host: '/host-snow.html', blurb: 'Walk Dubai, snowball fight' },
    { id: 'paint',    label: 'Dragones Pintores', emoji: '🎨', host: '/host-paint.html', blurb: 'Tap to fly, paint the sky, win the wonders' },
    { id: 'kingdoms', label: 'Reinos de Colores', emoji: '🏰', host: '/host-kingdoms.html', blurb: 'Plant flags, conquer the map' },
    { id: 'sixseven', label: '6-7 Swing', emoji: '🤙', host: '/host-sixseven.html', blurb: 'Sums that are always 6 or 7, digits or pinyin, fill your team balance (Mario Party)' },
    { id: 'monopoly', label: 'Dàfùwēng · Monopolio', emoji: '🎲', host: '/host-monopoly.html', blurb: 'Dubai board night in boards of 4: answer, roll the dice, buy landmarks, collect stars (Mario Party)' },
    { id: 'mochi',    label: 'Mochi Mash', emoji: '🍡', host: '/host.html', blurb: 'Answer, tap fast, feed your team dragon (Mario Party)' },
    { id: 'pinata',   label: 'Piñata Tigre', emoji: '🐯', host: '/host-pinata.html', blurb: 'Answer, stop the arrow on gold, break your team piñata (Mario Party)' },
    { id: 'dragon',   label: 'Vuelo del Dragón', emoji: '🐉', host: '/host-dragon.html', blurb: 'Sky race over Dubai in races of 4: answer, swipe up to flap, win Dralingo\'s stars (Mario Party)' },
  ];
  // the old force-launch (kept for the checkbox): stash the kids, open the host page with ?livegame=1, and
  // /js/live-game.js calls them in the moment the PIN appears. SAME tab on purpose (2026-06-04: mobile browsers
  // throttle background tabs and the PIN watch stalled).
  function _genericLaunch(ctx, hostUrl) {
    try {
      sessionStorage.setItem('dralyLiveGame', JSON.stringify({ codes: ctx.codes, pw: ctx.pw, label: ctx.label, ts: Date.now() }));
    } catch (_) { notify('Could not save the session.'); return false; }
    location.href = hostUrl + (hostUrl.includes('?') ? '&' : '?') + 'livegame=1';
    return true;
  }
  function openUniversalLauncher() {
    let overlay = document.getElementById('m-launch-modal');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'm-launch-modal';
    overlay.className = 'm-modal';
    let lastGame = '';
    try { lastGame = localStorage.getItem('dralyLastLaunchGame') || ''; } catch (_) {}
    const gameCard = (g) =>
      '<button class="m-launch-game' + (g.id === lastGame ? ' is-last' : '') + '" data-id="' + escapeHtml(g.id) + '" type="button">' +
        (g.id === lastGame ? '<span class="m-launch-last">Last time</span>' : '') +
        '<span class="m-launch-game-emoji" aria-hidden="true">' + g.emoji + '</span>' +
        '<span class="m-launch-game-label">' + escapeHtml(g.label) + '</span>' +
        '<span class="m-launch-game-blurb">' + escapeHtml(g.blurb) + '</span>' +
      '</button>';
    // 2026-10-13: the class tools and the games in two short groups (11 cards in one grid was a wall);
    // any new LAUNCHER_GAMES entry lands under Games by itself.
    const TOOL_IDS = ['warmup', 'reading', 'hsksim'];
    overlay.innerHTML =
      '<div class="m-modal-card m-modal-card--wide m-launch-card" role="dialog" aria-modal="true" aria-labelledby="m-launch-title">' +
        '<button class="m-modal-close" type="button" aria-label="Close">✕</button>' +
        '<h2 id="m-launch-title">🚀 Launch a game</h2>' +
        '<p class="m-modal-sub">Tap a game: it opens on the projector right away. The kids join with the PIN on the screen.</p>' +
        '<label class="m-launch-call"><input type="checkbox" id="m-lc-call">' +
          '<span><b>Also call in the kids who are online now</b> <span class="m-launch-call-n" id="m-lc-call-n"></span>' +
          '<small>Their phones jump into the game by themselves. Optional.</small></span></label>' +
        '<p class="m-launch-group">Games</p>' +
        '<div class="m-launch-games">' + LAUNCHER_GAMES.filter((g) => !TOOL_IDS.includes(g.id)).map(gameCard).join('') + '</div>' +
        '<p class="m-launch-group">Class tools</p>' +
        '<div class="m-launch-games">' + LAUNCHER_GAMES.filter((g) => TOOL_IDS.includes(g.id)).map(gameCard).join('') + '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    const close = () => { try { overlay.remove(); } catch (_) {} };
    overlay.querySelector('.m-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const call = overlay.querySelector('#m-lc-call');
    const callN = overlay.querySelector('#m-lc-call-n');
    // who is online: asked only for the checkbox's count (never needed to launch)
    let online = null;
    const onlineCodes = () => adminFetch('/api/admin/students', pw).then((r) => r.json()).then((d) => {
      online = d && d.ok ? (d.students || []).filter((s) => isOnlineNow(s)).map((s) => s.code).filter(Boolean) : null;
      if (callN && online) callN.textContent = '(' + online.length + ')';
      return online;
    });
    onlineCodes().catch(() => {});
    let going = false;
    overlay.querySelectorAll('.m-launch-game').forEach((card) => {
      card.addEventListener('click', () => {
        const g = LAUNCHER_GAMES.find((x) => x.id === card.dataset.id);
        if (!g || going) return;
        try { localStorage.setItem('dralyLastLaunchGame', g.id); } catch (_) {}
        if (g.official) { close(); const b = $('m-hsk-btn'); if (b) b.click(); return; }
        going = true;
        card.classList.add('is-going');
        card.setAttribute('aria-busy', 'true');
        const plain = () => { location.href = g.host; };
        if (!call || !call.checked) { plain(); return; }
        // the extra: call in the online kids; nobody online (or no answer) = the game opens anyway
        (online ? Promise.resolve(online) : onlineCodes()).catch(() => null).then((codes) => {
          if (!codes || !codes.length) { notify('Nobody is online right now: the kids join with the PIN.'); plain(); return; }
          const ctx = { pw, codes, label: g.label };
          const ok = g.call ? g.call(ctx) : _genericLaunch(ctx, g.host);
          if (!ok) plain();
        });
      });
    });
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
    wrap.textContent = 'Loading…';
    fetch('/api/reading/stories')
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok || !Array.isArray(d.stories)) {
          wrap.textContent = 'Could not load.';
          return;
        }
        renderReadingFolders(d.stories);
      })
      .catch(() => { wrap.textContent = 'Network error.'; });
  }
  function renderReadingFolders(stories) {
    const wrap = $('m-reading-folders');
    if (!wrap) return;
    const exps = (window.WU_EXPERIENCES) || {
      exp1: { label: 'EXP1 · Me / Family',   short: '👋 EXP1' },
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
        const coverUrl = s.coverImage || ('/assets/reading/' + s.id + '/page-1.png');
        card.innerHTML =
          '<div class="m-reading-card-cover" style="background-image:url(\'' + coverUrl + '\');"></div>' +
          '<div class="m-reading-card-body">' +
            '<div class="m-reading-card-title">📖 ' + escapeHtml(s.title || s.id) + '</div>' +
            '<div class="m-reading-card-sub">' + escapeHtml(s.subtitle || '') + '</div>' +
            '<div class="m-reading-card-meta">' + (s.pageCount || 0) + ' pages · ' + (s.questionCount || 0) + ' questions</div>' +
          '</div>' +
          '<div class="m-reading-card-actions">' +
            '<button class="m-reading-launch" type="button" data-story="' + escapeHtml(s.id) + '">Launch ›</button>' +
            '<button class="m-reading-force" type="button" data-story="' + escapeHtml(s.id) + '" title="Launch the reading AND force it onto online students">🎯 Force</button>' +
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
    if (!totalFolders) wrap.textContent = 'No stories yet.';
  }
  // 🎯 Force-reading picker — modal that shows ONLINE students and lets
  // the teacher tick which ones to force into the story. On confirm,
  // opens host-reading.html in a new tab with ?story=X&forceCodes=...
  // The host page then pushes inbox force-messages with its newly
  // generated PIN, and the kids' homework pages auto-redirect.
  function openForceReadingPicker(story) {
    // Pull the latest student list and filter to online-now client-side.
    adminFetch('/api/admin/students', pw)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          notify('Could not load the list of online students.');
          return;
        }
        const onlineNow = (data.students || []).filter((s) => {
          // "online" = lastSeen within last 60 seconds
          return isOnlineNow(s);
        });
        if (!onlineNow.length) {
          notify('No students online right now.\n\n(Ask them to open /homework first.)');
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
            <button class="m-modal-close" type="button" aria-label="Close">✕</button>
            <h2>🎯 Force reading</h2>
            <p class="m-modal-sub">Reading: <strong>📖 ${escapeHtml(story.title || story.id)}</strong></p>
            <p class="m-modal-sub" style="margin-top:6px;">Select the students who are online now. They'll get a heads-up and join automatically in ~20 seconds.</p>
            <div class="m-force-actions">
              <button class="btn btn-ghost btn-sm" id="m-force-all" type="button">Select all</button>
              <button class="btn btn-ghost btn-sm" id="m-force-none" type="button">Clear</button>
            </div>
            <div class="m-force-students" id="m-force-students"></div>
            <button class="btn btn-gold btn-xl" id="m-force-launch" type="button">
              🚀 Launch and force to selected students
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
            notify('Select at least one student.');
            return;
          }
          const url = '/host-reading.html?story=' + encodeURIComponent(story.id)
            + '&forceCodes=' + encodeURIComponent(codes.join(','));
          window.open(url, '_blank', 'noopener');
          close();
        });
      })
      .catch((e) => { notify('Error: ' + e.message); });
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
    { id: 1, label: 'HSK1', subtitle: '6 parts · 30 questions · beginner' },
    { id: 2, label: 'HSK2', subtitle: 'Coming soon' },
    { id: 3, label: 'HSK3', subtitle: 'Coming soon' },
    { id: 4, label: 'HSK4', subtitle: 'Coming soon' },
    { id: 5, label: 'HSK5', subtitle: 'Coming soon' },
    { id: 6, label: 'HSK6', subtitle: 'Coming soon' },
  ];
  // 🆕 2026-10-08 (Fernando): "Official tests" is a folder of exam
  // families → levels → simulations. YCT = real exam flow (listening on
  // the original audio track, 2-min review, timed reading, score /200).
  // New HSK uses the same mechanism once its sims exist (ids newhsk1-…).
  const EXAM_FAMILIES = [
    { id: 'oldhsk', label: 'Old HSK', subtitle: 'HSK 1–6 · classic format', levels: HSK_LEVELS },
    { id: 'yct', label: 'YCT', subtitle: "Kids' test · YCT 1–4", levels: [
      { id: 'yct1', label: 'YCT1', subtitle: 'Listening + reading · 35 questions' },
      { id: 'yct2', label: 'YCT2', subtitle: 'Coming soon' },
      { id: 'yct3', label: 'YCT3', subtitle: 'Coming soon' },
      { id: 'yct4', label: 'YCT4', subtitle: 'Coming soon' },
    ] },
    { id: 'newhsk', label: 'New HSK', subtitle: 'HSK 3.0 · New HSK 1 ready', levels: [1, 2, 3, 4, 5, 6].map((n) => (
      { id: 'newhsk' + n, label: 'New HSK' + n, subtitle: n === 1 ? 'Listening + reading · 40 questions' : 'Coming soon' }
    )) },
  ];
  const _famById = (id) => EXAM_FAMILIES.find((f) => f.id === id);
  function _levelInfo(levelId) {
    for (const f of EXAM_FAMILIES) { const l = f.levels.find((x) => x.id === levelId); if (l) return l; }
    return null;
  }
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
        const sims = (data && data.sims) || [];
        // only a real list is kept: a failed reply must not mark every level «Not ready yet» until a reload
        if (sims.length) _hskCachedSims = sims;
        return sims;
      });
  }
  // Group flat sims by the level prefix in their ID (hsk1-sim1 → 1).
  function _hskParseLevel(simId) {
    const y = String(simId || '').match(/^((?:yct|newhsk)\d+)-/i);
    if (y) return y[1].toLowerCase();
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
      'Migrate this result:\n  ' + label + '\n\n' +
      'Enter the correct student CODE this exam should belong to ' +
      '(it will appear in their notebook, My Exams and the Parents section):'
    );
    if (toCode === null) return;                 // cancelled
    const clean = String(toCode).trim().toUpperCase();
    if (!clean) return;
    if (clean === r.code) { notify('That is the same code. Nothing to migrate.'); return; }
    adminFetch('/api/admin/hsk-result/migrate', pw, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromCode: r.code, ts: r.ts, toCode: clean }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (!res || !res.ok) { notify('Could not migrate: ' + ((res && res.error) || 'unknown')); return; }
        notify('✅ Result migrated to ' + res.toName + ' (' + res.toCode + '). It now appears in their history.');
        renderHskView();                          // refresh the list
      })
      .catch((e) => notify('Error: ' + e.message));
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
      const fam = _famById(step);
      const lvl = _levelInfo(step);
      span.textContent =
          step === 'root'    ? '🏆 Official Tests'
        : step === 'results' ? '🏅 Results'
        : fam ? fam.label
        : lvl ? lvl.label
        : ('HSK' + step);
      crumb.appendChild(span);
      if (!isLast) {
        const sep = document.createElement('span');
        sep.className = 'm-hsk-crumb-sep';
        sep.textContent = ' › ';
        crumb.appendChild(sep);
      }
    });
    // the path is hidden only at the root (it would just repeat the title); Results keeps its way back
    crumb.classList.toggle('hidden', _hskNavStack.length === 1);
    // ─── RESULTS view — list every student's HSK exam outcomes ──
    if (_hskNavStack[0] === 'root' && _hskNavStack[1] === 'results') {
      title.textContent = '🏅 Test Results';
      sub.textContent = 'Every exam your students have turned in. Most recent first.';
      view.textContent = 'Loading…';
      adminFetch('/api/hsk-sim/results', pw)
        .then((r) => r.json())
        .then((d) => {
          view.innerHTML = '';
          const rows = (d && d.results) || [];
          if (!rows.length) {
            view.innerHTML = '<div class="m-empty">Nobody has turned in an official test yet. Results appear here the moment a student submits one.</div>';
            return;
          }
          const hint = document.createElement('p');
          hint.className = 'm-modal-sub';
          hint.textContent = 'A student used the wrong account? Use Move on that result to give it to the right student code.';
          view.appendChild(hint);
          const list = document.createElement('div');
          list.className = 'm-hsk-results-list';
          rows.forEach((r) => {
            const when = new Date(r.ts || 0).toLocaleString();
            const cls = r.percent >= 90 ? 'is-great' : r.percent >= 60 ? 'is-ok' : 'is-low';
            const item = document.createElement('div');
            item.className = 'm-hsk-result-row ' + cls;
            // 🆕 2026-06-16 (Fernando): show BOTH the name AND the student code so the teacher can tell accounts apart.
            // 2026-10-13: migrating is an explicit «Move…» button (a tap on the row opened the migrate prompt by surprise).
            item.innerHTML =
              '<div class="m-hsk-result-name">' +
                '<strong>' + escapeHtml(r.displayName || 'Anon') + ' <span class="m-code-tag">' + escapeHtml(r.code) + '</span></strong>' +
                '<span class="m-hsk-result-when">' + escapeHtml(when) + '</span>' +
              '</div>' +
              '<div class="m-hsk-result-sim">' + escapeHtml((r.simId || '').toUpperCase()) + '</div>' +
              '<div class="m-hsk-result-score">' +
                '<span class="m-hsk-result-pct">' + r.percent + '%</span>' +
                '<span class="m-hsk-result-pts">' + r.score + ' / ' + r.total + '</span>' +
              '</div>' +
              '<button class="btn btn-ghost btn-sm m-hsk-migrate" type="button" title="Move this result to another student code">Move…</button>';
            item.querySelector('.m-hsk-migrate').addEventListener('click', () => _migrateHskResult(r));
            list.appendChild(item);
          });
          view.appendChild(list);
        })
        .catch(() => { view.innerHTML = '<div class="m-empty">Could not load the results. Check the connection, then open Test results again.</div>'; });
      return;
    }
    // ─── ROOT view — exam families (+ shortcut to results); the
    // FAMILY view lists that family's levels.
    // counts (optional): { [itemId]: number of sims }. A level with 0 sims shows as «Coming soon», not as an
    // «Open ›» that leads to an empty screen (2026-10-13).
    const _folderGrid = (items, onOpen, icon, counts) => {
      const wrap = document.createElement('div');
      const grid = document.createElement('div');
      grid.className = 'm-reading-folder-grid';
      wrap.appendChild(grid);
      // levels with no sims yet share one quiet line instead of a row of dead cards
      const soonOnes = counts ? items.filter((it) => !(counts[it.id] || 0)) : [];
      if (soonOnes.length && soonOnes.length < items.length) {
        const p = document.createElement('p');
        p.className = 'm-soon-line';
        p.textContent = soonOnes.map((it) => it.label).join(', ') + ': coming soon';
        wrap.appendChild(p);
      }
      items.forEach((it) => {
        const n = counts ? (counts[it.id] || 0) : null;
        const soon = counts && n === 0;
        if (soon && soonOnes.length < items.length) return;
        const card = document.createElement('div');
        card.className = 'm-reading-card' + (soon ? ' is-soon' : '');
        card.innerHTML =
          '<div class="m-reading-card-body">' +
            '<div class="m-reading-card-title">' + icon + ' ' + escapeHtml(it.label) + '</div>' +
            '<div class="m-reading-card-sub">' + escapeHtml(soon ? 'Coming soon' : it.subtitle) + '</div>' +
            (n ? '<div class="m-reading-card-meta">' + n + ' simulation' + (n === 1 ? '' : 's') + '</div>' : '') +
          '</div>' +
          '<div class="m-reading-card-actions">' +
            '<button class="m-reading-launch" type="button"' + (soon ? ' disabled' : '') + '>' + (soon ? 'Not ready yet' : 'Open ›') + '</button>' +
          '</div>';
        if (!soon) card.querySelector('.m-reading-launch').addEventListener('click', () => onOpen(it));
        grid.appendChild(card);
      });
      return wrap;
    };
    const _simCounts = (all, keyOf) => {
      const out = {};
      all.forEach((s) => { const k = keyOf(_hskParseLevel(s.id)); if (k != null) out[k] = (out[k] || 0) + 1; });
      return out;
    };
    const _famOfLevel = (lvl) => { const f = EXAM_FAMILIES.find((x) => x.levels.some((l) => l.id === lvl)); return f ? f.id : null; };
    if (_hskNavStack.length === 2 && _famById(_hskNavStack[1])) {
      const fam = _famById(_hskNavStack[1]);
      title.textContent = '📁 ' + fam.label;
      sub.textContent = 'Pick the level.';
      view.textContent = 'Loading…';
      const draw = (counts) => {
        view.innerHTML = '';
        view.appendChild(_folderGrid(fam.levels, (lvl) => { _hskNavStack = ['root', fam.id, lvl.id]; renderHskView(); }, '🎓', counts));
      };
      ensureHskSims().then((all) => draw(all.length ? _simCounts(all, (l) => l) : null)).catch(() => draw(null));
      return;
    }
    if (_hskNavStack.length === 1) {
      title.textContent = '🏆 Official Tests';
      sub.textContent = 'Pick the exam, or see your students\' results.';
      view.innerHTML = '';
      // Quick-access "ver resultados" tile at the top
      const top = document.createElement('div');
      top.className = 'm-hsk-results-cta';
      top.innerHTML =
        '<button class="btn btn-jade btn-xl" id="m-hsk-results-open" style="width:100%;">' +
          '🏅 See who finished + their scores →' +
        '</button>';
      view.appendChild(top);
      top.querySelector('#m-hsk-results-open').addEventListener('click', () => {
        _hskNavStack = ['root', 'results'];
        renderHskView();
      });
      const famGrid = document.createElement('div');
      view.appendChild(famGrid);
      const drawFams = (counts) => {
        famGrid.innerHTML = '';
        famGrid.appendChild(_folderGrid(EXAM_FAMILIES, (fam) => { _hskNavStack = ['root', fam.id]; renderHskView(); }, '📁', counts));
      };
      famGrid.textContent = 'Loading…';
      ensureHskSims().then((all) => drawFams(all.length ? _simCounts(all, _famOfLevel) : null)).catch(() => drawFams(null));
      return;
    }
    // ─── LEVEL view — list every Simulación N for that level ─
    const levelId = _hskNavStack[_hskNavStack.length - 1];
    const lvlInfo = _levelInfo(levelId);
    const lvlName = lvlInfo ? lvlInfo.label : 'HSK' + levelId;
    title.textContent = '🎓 ' + lvlName;
    sub.textContent = 'Pick a simulation.';
    view.textContent = 'Loading…';
    ensureHskSims().then((all) => {
      const sims = all.filter((s) => _hskParseLevel(s.id) === levelId);
      view.innerHTML = '';
      if (!sims.length) {
        view.innerHTML = '<div class="m-empty">No simulations for ' + escapeHtml(lvlName) + ' yet. Go back and pick another level.</div>';
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
            '<div class="m-reading-card-meta">' + (sim.questionCount || 0) + ' questions · ' + (sim.partCount || 0) + ' parts</div>' +
          '</div>' +
          '<div class="m-reading-card-actions">' +
            '<button class="m-reading-force" type="button" data-sim="' + escapeHtml(sim.id) + '" title="Open the exam room with a PIN; students join by typing the PIN">🚀 Open room with PIN</button>' +
          '</div>';
        // 🏆 NEW: launching a sim opens host-hsk.html in a new tab.
        // That page creates a PIN room on load, then displays it big
        // so the teacher can read it aloud OR copy a direct join
        // link. Force-impose to currently-online kids is now a
        // button INSIDE that page so everything related to the
        // exam session lives in one place — like host-reading.html.
        card.querySelector('.m-reading-force').addEventListener('click', (ev) => {
          ev.currentTarget.disabled = true;
          ev.currentTarget.textContent = 'Opening the room…';
          const url = withHskCode('/host-hsk.html?sim=' + encodeURIComponent(sim.id), pw);
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
    adminFetch('/api/admin/students', pw)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          notify('Could not load the list of online students.');
          return;
        }
        const onlineNow = (data.students || []).filter((s) => isOnlineNow(s));
        if (!onlineNow.length) {
          notify('No students online right now.\n\n(Ask them to open /homework first.)');
          return;
        }
        let overlay = document.getElementById('m-force-hsk-modal');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'm-force-hsk-modal';
        overlay.className = 'm-modal';
        overlay.innerHTML = `
          <div class="m-modal-card">
            <button class="m-modal-close" type="button" aria-label="Close">✕</button>
            <h2>🎯 Force HSK1 simulation</h2>
            <p class="m-modal-sub">Simulation: <strong>🏆 ${escapeHtml(sim.title || sim.id)}</strong></p>
            <p class="m-modal-sub" style="margin-top:6px;">The selected students will join the exam automatically in ~20 seconds.</p>
            <div class="m-force-actions">
              <button class="btn btn-ghost btn-sm" id="m-fhsk-all">✅ All</button>
              <button class="btn btn-ghost btn-sm" id="m-fhsk-none">⬜ None</button>
            </div>
            <div class="m-force-students" id="m-fhsk-students"></div>
            <button class="btn btn-gold btn-xl" id="m-fhsk-launch" style="margin-top:16px;width:100%;">
              🚀 Launch exam to selected students
            </button>
            <!-- 🆕 2026-06-21 (Fernando): rescue a stuck kid. Instead of pulling
                 them INTO the exam, send them back to their homework profile so
                 you can re-grab them. Reaches them even inside a frozen room. -->
            <button class="btn btn-jade btn-sm" id="m-fhsk-gohome" style="margin-top:10px;width:100%;">
              🏠 Send selected to their assignments profile
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
            notify('Select at least one student.');
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
          // from the X-Admin-Pw header (adminFetch) and the body schema is
          // { studentCodes, text, actionType, actionUrl, actionLabel }
          // — NOT { codes, body }. Mirroring the working host-warmup +
          // host-reading force-flow exactly.
          adminFetch('/api/admin/broadcast-selected', pw, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentCodes: codes,
              text: '🏆 Your teacher is opening the HSK simulation now. Get ready.',
              actionType: 'force',
              actionUrl: '/hsk-sim.html?access=' + encodeURIComponent(accessCode)
                + '&sim=' + encodeURIComponent(sim.id),
              actionLabel: 'Enter the exam →'
            })
          })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) {
              const monitorUrl = withHskCode('/host-hsk.html'
                + '?sim='    + encodeURIComponent(sim.id)
                + '&access=' + encodeURIComponent(accessCode), pw);
              close();
              // 🆕 2026-06-16 (Fernando): SAME-TAB nav, not window.open.
              // window.open inside this fetch().then() callback is NOT a
              // user gesture → mobile browsers (S23 / Samsung Internet /
              // Chrome Android) silently popup-block it, so "start examen"
              // appeared to do nothing on the phone. Navigating the
              // current tab to the live monitor always works. The
              // broadcast already fired above, so the kids are being
              // pulled in regardless.
              notify('✅ Exam sent to ' + codes.length + ' student(s). They will join in ~20s. Taking you to the live monitor.');
              location.href = monitorUrl;
            } else {
              notify('Error: ' + (res && res.error || 'unknown'));
            }
          })
          .catch((e) => { notify('Error: ' + e.message); });
        });
        // 🆕 2026-06-21 (Fernando) — "send to homework profile" rescue button.
        // Sends a 'gohome' inbox message; the kid's heartbeat (player.html /
        // hsk-sim.html every 30s) picks it up and navigates them to /homework,
        // so even a kid frozen inside a room gets pulled out within ~30s.
        overlay.querySelector('#m-fhsk-gohome').addEventListener('click', () => {
          const codes = Array.from(list.querySelectorAll('input[type=checkbox]:checked'))
            .map((cb) => cb.dataset.code).filter(Boolean);
          if (!codes.length) { notify('Select at least one student.'); return; }
          adminFetch('/api/admin/broadcast-selected', pw, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentCodes: codes,
              text: '📚 Your teacher sent you back to your assignments profile.',
              actionType: 'gohome',
              actionUrl: '/homework',
              actionLabel: 'Go to my assignments →'
            })
          })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) {
              notify('🏠 ' + (res.sent || codes.length) + ' student(s) will return to their profile in ~30s.');
              close();
            } else {
              notify('Error: ' + (res && res.error || 'unknown'));
            }
          })
          .catch((e) => { notify('Error: ' + e.message); });
        });
      })
      .catch((e) => { notify('Error: ' + e.message); });
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
    if (!confirm('Delete all cached MP3s? They regenerate on the next tap.')) return;
    adminFetch('/api/maestro/emirati/audio/clear-cache', pw, { method: 'POST' })
      .then((r) => r.json()).then((d) => {
        if (d.ok) notify('✅ Deleted ' + d.removed + ' files.\n\nTry now: the next playback regenerates fresh from Azure.');
        else notify('Error: ' + (d.error || 'could not do it'));
      })
      .catch((e) => notify('Error: ' + e.message));
  });
  if ($('m-em-mark-all')) $('m-em-mark-all').addEventListener('click', () => {
    if (!_emToday.length) return;
    adminFetch('/api/maestro/emirati/mark', pw, {
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
    $('m-em-review-body').innerHTML = '<div class="m-empty">Loading…</div>';
    adminFetch('/api/maestro/emirati/learned', pw)
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
    if (!d || !d.ok) { body.innerHTML = '<div class="m-empty">Error loading: ' + ((d && d.error) || 'no response from server') + '</div>'; return; }
    const counts = $('m-em-review-counts');
    if (counts) counts.textContent = '🌱 ' + d.seenWordsCount + ' words · ✏️ ' + d.learnedSentenceCount + ' sentences';
    // 🗂️ Two-tab layout — exactly what the user asked for: one tab for
    // words, one tab for sentences. They never mix.
    body.innerHTML = `
      <div class="m-em-review-tabs">
        <button class="m-em-review-tab ${_emReviewTab === 'words' ? 'is-active' : ''}" data-tab="words" type="button">
          🌱 Words <span class="m-em-review-tabn">${d.seenWordsCount}</span>
        </button>
        <button class="m-em-review-tab ${_emReviewTab === 'sentences' ? 'is-active' : ''}" data-tab="sentences" type="button">
          ✏️ Sentences <span class="m-em-review-tabn">${d.learnedSentenceCount}</span>
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
        pane.innerHTML = '<div class="m-empty">You haven\'t marked any words as seen yet. Use the "✓ Mark as seen" button under each word of the day.</div>';
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
              <button class="m-em-rw-speak" data-ar="${escapeHtml(w.ar)}" data-wid="${escapeHtml(w.id)}" title="Listen">🔊</button>
              <button class="m-em-rw-forget" data-wid="${escapeHtml(w.id)}" title="Forget this word">✗</button>
            </div>`;
          card.querySelector('.m-em-rw-speak').addEventListener('click', (e) => {
            speakEmirati(e.currentTarget.dataset.ar, e.currentTarget, e.currentTarget.dataset.wid);
          });
          // ✗ Forget — sends { wordIds:[id], unmark:true } to /mark, removes from seen.
          card.querySelector('.m-em-rw-forget').addEventListener('click', (e) => {
            const wid = e.currentTarget.dataset.wid;
            if (!confirm('Forget this word? It will show up again in the day.')) return;
            adminFetch('/api/maestro/emirati/mark', pw, {
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
              if (counts) counts.textContent = '🌱 ' + d.seenWordsCount + ' words · ✏️ ' + d.learnedSentenceCount + ' sentences';
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
        pane.innerHTML = '<div class="m-empty">You haven\'t marked any sentences yet. In the day\'s list, under each word there are example sentences with a <b>☐ Mark</b> button. Tap it to add them here.</div>';
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
            <div class="m-em-rs-from">↑ from the word <b>${escapeHtml(row.tr)}</b></div>
          </div>
          <div class="m-em-rs-tools">
            <button class="m-em-rs-speak" data-ar="${escapeHtml(s.ar || row.ar)}">🔊</button>
            <button class="m-em-rs-unlearn" data-key="${escapeHtml(row.key)}" title="Forget">✗</button>
          </div>`;
        tile.querySelector('.m-em-rs-speak').addEventListener('click', (e) => {
          speakEmiratiText(e.currentTarget.dataset.ar, e.currentTarget);
        });
        tile.querySelector('.m-em-rs-unlearn').addEventListener('click', (e) => {
          const key = e.currentTarget.dataset.key;
          adminFetch('/api/maestro/emirati/sentence/mark', pw, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keys: [key], unmark: true }),
          }).then((r) => r.json()).then(() => {
            tile.remove();
            // Refresh counts label too.
            d.learnedSentenceCount = Math.max(0, d.learnedSentenceCount - 1);
            const counts = $('m-em-review-counts');
            if (counts) counts.textContent = '🌱 ' + d.seenWordsCount + ' words · ✏️ ' + d.learnedSentenceCount + ' sentences';
          });
        });
        pane.appendChild(tile);
      });
    }
  }
  let _emSkipForToday = new Set();
  function loadEmirati(reshuffle) {
    const list = $('m-emirati-list');
    if (list) list.textContent = 'Loading…';
    // 🔁 OTRAS 5 — when reshuffling, push the current 5 IDs into
    // _emSkipForToday so the server returns the NEXT 5 unseen instead of
    // recomputing the same priority slice. Was: same 5 every tap.
    if (reshuffle && Array.isArray(_emToday)) {
      _emToday.forEach((w) => _emSkipForToday.add(w.id));
    }
    const date = new Date().toISOString().slice(0, 10);
    const skip = Array.from(_emSkipForToday).join(',');
    const url = '/api/maestro/emirati/today'
      + '?date=' + encodeURIComponent(date)
      + (skip ? '&skip=' + encodeURIComponent(skip) : '');
    adminFetch(url, pw)
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) { if (list) list.textContent = 'Error: ' + (d && d.error || 'could not load'); return; }
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
    if (!words.length) { list.innerHTML = '<div class="m-empty">You have seen all available words! 🎉</div>'; return; }
    list.innerHTML = '';
    // Sticky list-summary header: "10 palabras · 17 oraciones por estudiar"
    if (summary) {
      const head = document.createElement('div');
      head.className = 'm-em-list-summary';
      head.innerHTML = '<span class="m-em-list-count">'
        + '📚 <strong>' + words.length + '</strong> word' + (words.length === 1 ? '' : 's')
        + ' · 📝 <strong>' + summary.visibleSentenceCount + '</strong> sentence' + (summary.visibleSentenceCount === 1 ? '' : 's')
        + ' to study</span>'
        + '<span class="m-em-list-sub">Mark what you already know and the list refills itself.</span>';
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
                +   '<button class="m-em-s-speak" type="button" data-ar="' + escapeHtml(s.ar || w.ar) + '" title="Listen in Khaleeji">🔊</button>'
                +   '<button class="m-em-s-learn ' + (learned ? 'is-on' : '') + '" type="button" data-key="' + escapeHtml(key) + '">'
                +     '<span class="m-em-s-learn-icon">' + (learned ? '✅' : '☐') + '</span>'
                +     '<span class="m-em-s-learn-label">' + (learned ? 'Learned' : 'Mark') + '</span>'
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
        ? `<button class="m-em-mark is-known" type="button" data-id="${escapeHtml(w.id)}" data-known="1">✅ Known · tap to undo</button>`
        : `<button class="m-em-mark" type="button" data-id="${escapeHtml(w.id)}">✓ Mark as seen</button>`;
      card.innerHTML = `
        <div class="m-em-row">
          <div class="m-em-section">${sec ? (sec.icon + ' ' + escapeHtml(sec.label)) : ''} ${prioBadge}</div>
          <button class="m-em-speak" type="button" data-ar="${escapeHtml(w.ar)}" data-wid="${escapeHtml(w.id)}" title="Listen (Emirati MP3 if it exists, otherwise Google MSA)">🔊</button>
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
      adminFetch('/api/maestro/emirati/sentence/mark', pw, {
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
      adminFetch('/api/maestro/emirati/mark', pw, {
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
    // 2026-10-13: an unsent draft survives closing the window (a tap on the backdrop used to wipe 24 sentences);
    // the form only resets after a successful send.
    if (!_cuItems.length) _cuItems = [{ es: '', expected: '' }];
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
        <input class="input m-cu-item-es" placeholder="Sentence in English (e.g. I am a teacher)" value="${escapeHtml(it.es)}">
        <input class="input m-cu-item-px" placeholder="Expected pinyin (e.g. wo shi laoshi)" value="${escapeHtml(it.expected)}">
        <button class="m-cu-item-del" type="button" title="Remove">✕</button>`;
      row.querySelector('.m-cu-item-es').addEventListener('input', (e) => { _cuItems[i].es = e.target.value; });
      row.querySelector('.m-cu-item-px').addEventListener('input', (e) => { _cuItems[i].expected = e.target.value; });
      row.querySelector('.m-cu-item-del').addEventListener('click', () => { _cuItems.splice(i, 1); if (!_cuItems.length) _cuItems.push({ es: '', expected: '' }); renderCustomItems(); });
      wrap.appendChild(row);
    });
  }
  function loadCustomStudents() {
    const list = $('m-cu-students'); if (list) list.textContent = 'Loading…';
    adminFetch('/api/admin/students', pw)
      .then((r) => r.json())
      .then((data) => {
        const students = (data && data.students) || [];
        const was = new Set(_cuStudents.filter((s) => s.checked).map((s) => s.code));
        const now = Date.now();
        _cuStudents = students.map((s) => ({ code: s.code, name: s.displayName || 'Anon', checked: was.has(s.code), online: isOnlineNow(s, now) }));
        renderCustomStudents();
      })
      .catch(() => { if (list) list.textContent = 'Error loading students.'; });
  }
  function renderCustomStudents() {
    const list = $('m-cu-students'); if (!list) return;
    const q = ($('m-cu-students-search') ? $('m-cu-students-search').value : '').toLowerCase().trim();
    const filtered = _cuStudents.filter((s) => !q || s.code.toLowerCase().indexOf(q) >= 0 || s.name.toLowerCase().indexOf(q) >= 0);
    if (!filtered.length) { list.innerHTML = '<div class="m-empty">No results.</div>'; return; }
    list.innerHTML = '';
    filtered.forEach((s) => {
      const row = document.createElement('label'); row.className = 'm-cu-student' + (s.checked ? ' on' : '');
      row.innerHTML = `<input type="checkbox" ${s.checked ? 'checked' : ''}><span class="m-pick-dot${s.online ? '' : ' is-offline'}" title="${s.online ? 'Online' : 'Offline'}"></span><span class="m-cu-stu-name m-pick-name">${escapeHtml(s.name)}</span><span class="m-cu-stu-code">${escapeHtml(s.code)}</span>`;
      row.querySelector('input').addEventListener('change', (e) => { s.checked = e.target.checked; row.classList.toggle('on', s.checked); });
      list.appendChild(row);
    });
    const tag = $('m-cu-msg'); const sel = _cuStudents.filter((s) => s.checked).length;
    if (tag) tag.textContent = sel ? sel + ' student' + (sel === 1 ? '' : 's') + ' selected' : '';
  }
  function sendCustom() {
    const title = $('m-cu-title').value.trim();
    const instructions = $('m-cu-instr').value.trim();
    const items = _cuItems.filter((it) => it.es.trim() && it.expected.trim());
    const targets = _cuStudents.filter((s) => s.checked).map((s) => s.code);
    const msg = $('m-cu-msg');
    if (!title) { if (msg) msg.textContent = '✕ The title is missing.'; return; }
    if (!items.length) { if (msg) msg.textContent = '✕ You need at least 1 complete sentence (English + pinyin).'; return; }
    if (!targets.length) { if (msg) msg.textContent = '✕ Check at least 1 student.'; return; }
    if (msg) msg.textContent = 'Sending…';
    adminFetch('/api/admin/custom-assignment', pw, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, instructions, items, targetStudents: targets, pointsPerItem: 10 }),
    }).then((r) => r.json()).then((d) => {
      if (d && d.ok) {
        _cuItems = [{ es: '', expected: '' }]; renderCustomItems();
        $('m-cu-title').value = ''; $('m-cu-instr').value = '';
        _cuStudents.forEach((s) => s.checked = false); renderCustomStudents();
        // after the reset: renderCustomStudents() rewrites this line with the selection count (it used to wipe the confirmation)
        if (msg) msg.textContent = '✅ Sent to ' + targets.length + ' student' + (targets.length === 1 ? '' : 's') + '.';
        loadCustomExisting();
      } else {
        if (msg) msg.textContent = '✕ Error: ' + ((d && d.error) || 'could not send');
      }
    }).catch((e) => { if (msg) msg.textContent = '✕ ' + e.message; });
  }
  function loadCustomExisting() {
    const wrap = $('m-cu-existing'); if (!wrap) return;
    wrap.textContent = 'Loading…';
    adminFetch('/api/admin/custom-assignments', pw)
      .then((r) => r.json())
      .then((d) => {
        const list = (d && d.assignments) || [];
        if (!list.length) { wrap.innerHTML = '<div class="m-empty">You haven\'t sent any special assignments yet.</div>'; return; }
        wrap.innerHTML = '';
        list.forEach((a) => {
          const row = document.createElement('div'); row.className = 'm-cu-ex';
          const when = a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
          row.innerHTML = `
            <div class="m-cu-ex-info">
              <div class="m-cu-ex-title">${escapeHtml(a.title || 'Assignment')}</div>
              <div class="m-cu-ex-meta">📝 ${a.items.length} sentence${a.items.length === 1 ? '' : 's'} · 👥 ${a.targetStudents.length} student${a.targetStudents.length === 1 ? '' : 's'} · ${when}</div>
            </div>
            <button class="btn btn-ghost btn-sm m-cu-ex-del" type="button">🗑 Delete</button>`;
          row.querySelector('.m-cu-ex-del').addEventListener('click', () => {
            if (!confirm('Delete "' + a.title + '"? Students will no longer see it.')) return;
            adminFetch('/api/admin/custom-assignment/' + encodeURIComponent(a.id), pw, { method: 'DELETE' })
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
      if (btn) { btn.textContent = '⊘'; btn.title = 'No Arabic text.'; }
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
        btn.title = 'Error: ' + (e.message || e) + '. Tap again to diagnose.';
        btn.onclick = () => {
          btn.onclick = null;
          adminFetch('/api/maestro/emirati/azure/diagnose'
              + '?voice=' + _emAzureVoice
              + '&text=' + encodeURIComponent(arText), pw)
            .then((r) => r.json()).then((d) => {
              notify('Diag:\nOK: ' + d.ok + '\nStatus: ' + (d.azureStatus || d.reason)
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
    adminFetch('/api/maestro/emirati/azure-status', pw)
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) { stat.textContent = 'Error: ' + ((d && d.error) || 'could not verify'); return; }
        if (d.azureConfigured) {
          stat.innerHTML = '✅ <b>Azure active</b> · region <code>' + escapeHtml(d.region) + '</code> · '
            + 'default voice <code>' + escapeHtml(d.voiceFemale) + '</code><br>'
            + '🎵 <b>' + d.cached + ' / ' + d.total + '</b> words cached as real MP3 (Khaleeji).'
            + (d.cached < d.total ? ' The rest generate on the first 🔊.' : ' All ready!');
          if (gen) {
            gen.classList.remove('hidden');
            gen.disabled = d.cached >= d.total;
            gen.textContent = d.cached >= d.total
              ? '✅ All generated (' + d.total + ')'
              : '🎙️ Generate the missing ones (' + (d.total - d.cached) + ')';
          }
          if (help) help.classList.add('hidden');
        } else {
          stat.innerHTML = '⚠️ <b>Azure not configured.</b> For now the words play in MSA (Google).';
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
      btn.textContent = '🎙️ Generating…';
      if (stat) stat.textContent = 'Starting the job on the server…';
      adminFetch('/api/maestro/emirati/generate-all', pw, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: _emAzureVoice }),
      }).then((r) => r.json()).then((d) => {
        if (!d || !d.ok) {
          if (stat) stat.textContent = '✕ Error: ' + ((d && d.error) || 'could not start');
          btn.disabled = false;
          return;
        }
        if (stat) stat.textContent = '🎙️ Generating ' + (d.queued || 0) + ' words… (≈ ' + Math.ceil((d.queued || 0) / 4) + 's)';
        // Poll every 3s until cached == total
        if (_emAzurePollT) clearInterval(_emAzurePollT);
        _emAzurePollT = setInterval(() => {
          adminFetch('/api/maestro/emirati/azure-status', pw)
            .then((r) => r.json()).then((s) => {
              if (s && s.ok) {
                if (stat) stat.innerHTML = '🎙️ Generating… <b>' + s.cached + ' / ' + s.total + '</b>';
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
    list.innerHTML = '<div class="m-empty">Loading…</div>';
    adminFetch('/api/admin/guides', pw)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { list.innerHTML = '<div class="m-empty">Could not load.</div>'; return; }
        if (!data.guides.length) { list.innerHTML = '<div class="m-empty">No guides uploaded yet.</div>'; return; }
        list.innerHTML = '';
        data.guides.forEach((g) => {
          const mb = g.size ? (g.size / (1024 * 1024)).toFixed(1) + ' MB' : '';
          const row = document.createElement('div');
          row.className = 'm-guide-row';
          row.innerHTML = `
            <span class="m-guide-title">📘 ${escapeHtml(g.title)}</span>
            <span class="m-guide-meta">${escapeHtml((g.exp || '').toUpperCase())} · ${mb}</span>
            <a class="btn btn-ghost btn-sm" href="/api/guides/${encodeURIComponent(g.id)}" target="_blank" rel="noopener">View</a>
            <button class="btn btn-red btn-sm" data-id="${escapeHtml(g.id)}" type="button">🗑</button>`;
          row.querySelector('button[data-id]').addEventListener('click', () => {
            if (!confirm('Delete this guide?')) return;
            adminFetch('/api/admin/guides/' + encodeURIComponent(g.id), pw, { method: 'DELETE' })
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
    if (!title) { msg.textContent = 'Enter a title.'; return; }
    if (!file) { msg.textContent = 'Choose a PDF file.'; return; }
    if (file.size > 18 * 1024 * 1024) { msg.textContent = 'The PDF is too big (max 18 MB).'; return; }
    msg.textContent = 'Uploading…';
    const reader = new FileReader();
    reader.onload = () => {
      adminFetch('/api/admin/guides', pw, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, exp, dataBase64: String(reader.result || '') }),
      })
        .then((r) => r.json())
        .then((r) => {
          if (!r.ok) { msg.textContent = 'Error: ' + (r.error || ''); return; }
          msg.textContent = '✓ Guide uploaded.';
          $('m-guide-title').value = '';
          if (fileEl) fileEl.value = '';
          loadGuidesList();
        })
        .catch((e) => { msg.textContent = 'Error: ' + e.message; });
    };
    reader.onerror = () => { msg.textContent = 'Could not read the file.'; };
    reader.readAsDataURL(file);   // → data:application/pdf;base64,...
  });

  // 🎬 GIF PICKER — push transparent dancing mascot to selected kids.
  // 2026-06-08 (Fernando). Same plumbing as the inbox messaging system;
  // homework.js's poller picks up the actionType:'anim' message and
  // shows an 8-second overlay over whatever the kid was doing.
  // Designed to be the foundation for a future "mascot of the day"
  // auto-rotation that fires server-side on login streaks etc.
  // 2026-10-12 — the saga only (public/js/saga.js: Dralingo ×3, camel, Dubai plane, falcon, oryx); brand GIFs gone.
  // Tiles show the still frame (seven 1 MB animations would load at once otherwise).
  const GIF_LIBRARY = ((window.Saga && window.Saga.ANIMS) || []).map((x) => ({ id: x.id, label: x.label, url: x.url, still: x.still || x.url }));
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
      return '<button class="m-gif-tile' + (sel ? ' is-selected' : '') + '" data-gid="' + escapeHtml(g.id) + '" type="button" aria-pressed="' + sel + '">' +
        '<img src="' + escapeHtml(g.still) + '" alt="" width="84" height="84" loading="lazy">' +
        '<span>' + escapeHtml(g.label) + '</span></button>';
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
    if (_gifOnlineOnly) pool = pool.filter((s) => isOnlineNow(s));
    if (!pool.length) {
      list.innerHTML = '<div class="m-empty">' + (_gifOnlineOnly && !q ? 'Nobody is online right now. Turn off «Online only» to pick from everyone.' : 'No students match.') + '</div>';
      return;
    }
    list.innerHTML = '';
    pool.forEach((s) => {
      const online = isOnlineNow(s);
      const checked = _gifChecked.has(s.code);
      const row = document.createElement('label');
      row.className = 'm-pick-row';
      row.innerHTML =
        '<input type="checkbox" data-code="' + escapeHtml(s.code) + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="m-pick-dot' + (online ? '' : ' is-offline') + '" title="' + (online ? 'Online' : 'Offline') + '"></span>' +
        '<span class="m-pick-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
        '<span class="m-pick-code">' + escapeHtml(s.code) + '</span>';
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) _gifChecked.add(s.code); else _gifChecked.delete(s.code);
        _updateGifSendBtn();
      });
      list.appendChild(row);
    });
  }
  function _updateGifSendBtn() {
    const btn = $('m-gif-send');
    if (!btn) return;
    if (!_gifPick) { btn.textContent = '🎬 Pick a GIF'; btn.disabled = true; return; }
    if (!_gifChecked.size) { btn.textContent = '👥 Pick at least one student'; btn.disabled = true; return; }
    btn.textContent = '📤 Send GIF to ' + _gifChecked.size + ' student' + (_gifChecked.size === 1 ? '' : 's');
    btn.disabled = false;
  }
  function _openGifModal() {
    // 2026-10-13: like every other picker, it opens on the online kids, all checked (pick a GIF, press Send)
    _gifPick = ''; _gifChecked = new Set(); _gifOnlineOnly = true; _gifSearch = '';
    $('m-gif-search').value = '';
    $('m-gif-msg').textContent = '';
    $('m-gif-online').setAttribute('aria-pressed', 'true');
    $('m-gif-online').classList.add('btn-jade');
    $('m-gif-online').textContent = '🟢 Online only: on';
    $('m-gif-list').innerHTML = '<div class="m-empty">Loading students…</div>';
    adminFetch('/api/admin/students', pw)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { _gifStudents = []; $('m-gif-list').innerHTML = '<div class="m-empty">Could not load the students. Close and open this again.</div>'; return; }
        _gifStudents = (data.students || []).slice().sort((a, b) =>
          (a.displayName || a.code || '').localeCompare(b.displayName || b.code || ''));
        _gifStudents.forEach((s) => { if (isOnlineNow(s)) _gifChecked.add(s.code); });
        _renderGifList();
        _updateGifSendBtn();
      })
      .catch(() => { $('m-gif-list').innerHTML = '<div class="m-empty">Could not load the students. Check the connection, then close and open this again.</div>'; });
    _renderGifGrid();
    _updateGifSendBtn();
    $('m-gif-modal').classList.remove('hidden');
  }
  function _closeGifModal() { $('m-gif-modal').classList.add('hidden'); }
  // 💾 One-click backup (super-admin). Streams data/*.json as one file.
  const backupBtn = $('m-backup-btn');
  if (backupBtn) backupBtn.addEventListener('click', () => {
    // 🔒 2026-10-11: fetch with the code in the X-Admin-Pw header (a plain link
    // would have to put it in the URL), then save the file from memory. The
    // server's Content-Disposition header still names it draly-backup-<date>.json.
    if (backupBtn.disabled) return;
    backupBtn.disabled = true;
    const label = backupBtn.querySelector('small');
    const was = label ? label.textContent : '';
    if (label) label.textContent = 'Preparing the file…';
    const restore = () => { backupBtn.disabled = false; if (label) label.textContent = was; };
    adminFetch('/api/admin/backup', pw)
      .then((r) => {
        if (!r.ok) return r.json().catch(() => ({})).then((d) => { throw new Error((d && d.error) || ('HTTP ' + r.status)); });
        const m = /filename="?([^";]+)"?/i.exec(r.headers.get('Content-Disposition') || '');
        return r.blob().then((blob) => ({ blob, name: (m && m[1]) || 'draly-backup.json' }));
      })
      .then(({ blob, name }) => {
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { try { a.remove(); } catch (_) {} }, 1000);
        setTimeout(() => { try { URL.revokeObjectURL(href); } catch (_) {} }, 60000);
        restore();
        notify('✅ Backup downloaded: ' + name);
      })
      .catch((e) => { restore(); notify('Backup failed: ' + e.message); });
  });

  // 🎓 2026-06-21 (Fernando) — CLASSROOM MANAGER. Create / rename / delete
  // classrooms here; assign students in the Cuaderno; send to a whole class
  // in the sentence push. Reuses the same admin pw as everything else.
  function _openClassroomModal() {
    $('m-classroom-modal').classList.remove('hidden');
    // the «new class» row was left hidden when the window closed from a class view (2026-10-13 fix)
    const newRow = document.querySelector('.m-classroom-new');
    if (newRow) newRow.style.display = '';
    _renderClassroomList();
  }
  function _closeClassroomModal() { $('m-classroom-modal').classList.add('hidden'); }
  function _classroomMsg(t, ok) {
    const el = $('m-classroom-msg'); if (!el) return;
    el.textContent = t || '';
    el.classList.toggle('is-error', ok === false);
    if (t) setTimeout(() => { if (el.textContent === t) el.textContent = ''; }, 3500);
  }
  function _renderClassroomList() {
    const box = $('m-classroom-list'); if (!box) return;
    box.innerHTML = '<div class="m-empty">Loading classes…</div>';
    adminFetch('/api/admin/classrooms', pw)
      .then((r) => r.json())
      .then((data) => {
        const list = (data && data.classrooms) || [];
        if (!list.length) { box.innerHTML = '<div class="m-empty">No classes yet. Type a name below and press Create class.</div>'; return; }
        box.innerHTML = '';
        list.forEach((c) => {
          const row = document.createElement('div');
          row.className = 'm-classroom-row';
          row.innerHTML =
            '<input class="input m-classroom-name" value="' + escapeHtml(c.name || '') + '" maxlength="40" aria-label="Class name">' +
            '<span class="m-classroom-count">👥 ' + (c.studentCount || 0) + ' · 🟢 ' + (c.onlineCount || 0) + ' online</span>' +
            '<button class="btn btn-gold btn-sm m-classroom-members" type="button" title="Add or remove students and open their profiles">Open class</button>' +
            '<button class="btn btn-ghost btn-sm m-classroom-save" type="button" title="Save the new name">💾 Save name</button>' +
            '<button class="btn btn-red btn-sm m-classroom-del" type="button" title="Delete this class (no student is deleted)">🗑 Delete</button>';
          row.querySelector('.m-classroom-members').addEventListener('click', () => _openClassroomMembers(c));
          row.querySelector('.m-classroom-save').addEventListener('click', () => {
            const name = row.querySelector('.m-classroom-name').value;
            adminFetch('/api/admin/classroom/' + encodeURIComponent(c.id), pw, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            }).then((r) => r.json()).then((res) => {
              _classroomMsg(res && res.ok ? '✓ Name saved' : ('Could not save: ' + (res && res.error || 'unknown error')), !!(res && res.ok));
              if (res && res.ok) _renderClassroomList();
            }).catch(() => _classroomMsg('Could not save. Check the connection and try again.', false));
          });
          row.querySelector('.m-classroom-del').addEventListener('click', () => {
            if (!confirm('Delete the class "' + (c.name || '') + '"?\n\nIts students become Unassigned. No student is deleted.')) return;
            adminFetch('/api/admin/classroom/' + encodeURIComponent(c.id), pw, { method: 'DELETE' })
              .then((r) => r.json()).then((res) => { _classroomMsg(res && res.ok ? '✓ Class deleted' : 'Could not delete the class.', !!(res && res.ok)); _renderClassroomList(); })
              .catch(() => _classroomMsg('Could not delete. Check the connection and try again.', false));
          });
          box.appendChild(row);
        });
      })
      .catch(() => { box.innerHTML = '<div class="m-empty">Could not load the classes. Check the connection, then close and open this again.</div>'; });
  }
  function _createClassroom() {
    const name = ($('m-classroom-new-name').value || '').trim();
    if (!name) { _classroomMsg('Type a name for the class first.', false); $('m-classroom-new-name').focus(); return; }
    adminFetch('/api/admin/classrooms', pw, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => r.json()).then((res) => {
      if (res && res.ok) { $('m-classroom-new-name').value = ''; _classroomMsg('✓ Class created. Open it to add students.', true); _renderClassroomList(); }
      else _classroomMsg('Could not create the class: ' + (res && res.error || 'unknown error'), false);
    }).catch(() => _classroomMsg('Could not create the class. Check the connection and try again.', false));
  }
  // 👥 MEMBER EDITOR — see exactly who is in this aula and tick kids in/out.
  // Checked = belongs to THIS aula. Ticking moves them here; unticking makes
  // them Sin asignar. Bulk-friendly: search + scroll, changes save instantly.
  function _openClassroomMembers(classroom) {
    const box = $('m-classroom-list');
    const newRow = document.querySelector('.m-classroom-new');
    if (newRow) newRow.style.display = 'none';
    box.innerHTML = '<div class="m-empty">Loading students…</div>';
    adminFetch('/api/admin/students', pw)
      .then((r) => r.json())
      .then((data) => {
        const students = ((data && data.students) || []).slice()
          .sort((a, b) => (a.displayName || a.code || '').localeCompare(b.displayName || b.code || ''));
        const memberCount = students.filter((s) => s.classroomId === classroom.id).length;
        box.innerHTML =
          '<button class="btn btn-ghost btn-sm" id="m-cls-back" type="button">← All classes</button>' +
          '<h3 class="m-cls-title">🎓 ' + escapeHtml(classroom.name) + '</h3>' +
          '<button class="btn btn-gold btn-sm m-cls-full" id="m-cls-view-members" type="button">👥 Members (' + memberCount + '): open their profiles</button>' +
          '<p class="m-cls-note">Check the students who belong to this class. Each change saves at once.</p>' +
          '<input class="input" id="m-cls-mem-search" type="search" placeholder="Search by name or code" aria-label="Search students">' +
          '<div id="m-cls-mem-list" class="m-cls-list"></div>';
        box.querySelector('#m-cls-view-members').addEventListener('click', () => _openClassroomRoster(classroom));
        const listEl = box.querySelector('#m-cls-mem-list');
        const render = (q) => {
          const qq = (q || '').toLowerCase();
          listEl.innerHTML = '';
          const pool = students.filter((s) => !qq
            || (s.displayName || '').toLowerCase().includes(qq)
            || (s.code || '').toLowerCase().includes(qq));
          if (!pool.length) { listEl.innerHTML = '<div class="m-empty">No students match.</div>'; return; }
          pool.forEach((s) => {
            const inThis = s.classroomId === classroom.id;
            const elsewhere = (s.classroomName && !inThis) ? '<span class="m-cls-elsewhere">in ' + escapeHtml(s.classroomName) + '</span>' : '';
            const rowL = document.createElement('label');
            rowL.className = 'm-cls-row';
            rowL.innerHTML = '<input type="checkbox"' + (inThis ? ' checked' : '') + '>'
              + '<span class="m-pick-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' + elsewhere
              + '<span class="m-pick-code">' + escapeHtml(s.code) + '</span>';
            rowL.querySelector('input').addEventListener('change', (e) => {
              const cid = e.target.checked ? classroom.id : '';
              adminFetch('/api/admin/student/' + encodeURIComponent(s.code) + '/classroom', pw, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classroomId: cid }),
              }).then((r) => r.json()).then((res) => {
                if (res && res.ok) { s.classroomId = cid || null; s.classroomName = e.target.checked ? classroom.name : null; }
                else { e.target.checked = !e.target.checked; notify('Could not change the class: ' + (res && res.error || 'unknown error')); }
              }).catch(() => { e.target.checked = !e.target.checked; notify('Could not change the class. Check the connection and try again.'); });
            });
            listEl.appendChild(rowL);
          });
        };
        render('');
        box.querySelector('#m-cls-mem-search').addEventListener('input', (e) => render(e.target.value));
        box.querySelector('#m-cls-back').addEventListener('click', () => { if (newRow) newRow.style.display = ''; _renderClassroomList(); });
      })
      .catch(() => { box.innerHTML = '<div class="m-empty">Could not load the students. Check the connection, then close and open this again.</div>'; });
  }
  // 👥 VER MIEMBROS — only the students ALREADY in this aula, each tappable to
  // open their full profile (oraciones, notas, mensajes, cambiar aula…).
  function _openClassroomRoster(classroom) {
    const box = $('m-classroom-list');
    const newRow = document.querySelector('.m-classroom-new');
    if (newRow) newRow.style.display = 'none';
    box.innerHTML = '<div class="m-empty">Loading…</div>';
    adminFetch('/api/admin/students', pw)
      .then((r) => r.json())
      .then((data) => {
        const members = ((data && data.students) || []).filter((s) => s.classroomId === classroom.id)
          .sort((a, b) => (a.displayName || a.code || '').localeCompare(b.displayName || b.code || ''));
        let html = '<button class="btn btn-ghost btn-sm" id="m-cls-roster-back" type="button">← Back to the class</button>' +
          '<h3 class="m-cls-title">👥 ' + escapeHtml(classroom.name) + ' (' + members.length + ')</h3>' +
          '<p class="m-cls-note">Tap a student to open their profile.</p>';
        if (!members.length) html += '<div class="m-empty">Nobody in this class yet. Go back and check the students who belong to it.</div>';
        html += '<div id="m-cls-roster-list" class="m-cls-list"' + (members.length ? '' : ' hidden') + '></div>';
        box.innerHTML = html;
        const listEl = box.querySelector('#m-cls-roster-list');
        members.forEach((s) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'm-cls-member';
          row.innerHTML = '<span class="m-pick-avatar">' + renderAvatar(s.avatar) + '</span>' +
            '<span class="m-pick-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
            '<span class="m-pick-code">' + escapeHtml(s.code) + '</span>' +
            '<span class="m-cls-open">Open profile ›</span>';
          row.addEventListener('click', () => { _closeClassroomModal(); openDetail(s.code); });
          listEl.appendChild(row);
        });
        box.querySelector('#m-cls-roster-back').addEventListener('click', () => _openClassroomMembers(classroom));
      })
      .catch(() => { box.innerHTML = '<div class="m-empty">Could not load the members. Check the connection, then close and open this again.</div>'; });
  }
  // 🏠 2026-06-21 (Fernando) — TOP-LEVEL "Llevar a casa". Pick online kids and
  // force them out of ANY room / stuck screen ("estás en la sala", a dead PIN
  // room, an old classroom screen) back to their homework profile, so you can
  // re-grab them into a fresh simulation. Reaches them via the 30s heartbeat.
  function _openSendHomePicker() {
    adminFetch('/api/admin/students', pw)
      .then((r) => r.json())
      .then((data) => {
        const online = ((data && data.students) || []).filter((s) => isOnlineNow(s));
        if (!online.length) { notify('Nobody is online right now, so there is nobody to send home.\nStudents with their homework or a game open show up here.', 'info'); return; }
        let ov = document.getElementById('m-home-modal'); if (ov) ov.remove();
        ov = document.createElement('div');
        ov.id = 'm-home-modal'; ov.className = 'm-modal';
        ov.innerHTML =
          '<div class="m-modal-card">' +
            '<button class="m-modal-close" type="button" aria-label="Close">✕</button>' +
            '<h2>🏠 Send home</h2>' +
            '<p class="m-modal-sub">Pulls the checked students out of any room or stuck screen and back to their homework profile within about 30 seconds. Use it before opening a new simulation.</p>' +
            '<div class="m-force-actions">' +
              '<button class="btn btn-ghost btn-sm" id="m-home-all" type="button">Select all</button>' +
              '<button class="btn btn-ghost btn-sm" id="m-home-none" type="button">Clear</button>' +
            '</div>' +
            '<div class="m-force-students" id="m-home-students"></div>' +
            '<button class="btn btn-red btn-xl" id="m-home-go" type="button">🏠 Send them home</button>' +
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
          if (!codes.length) { notify('Select at least one student.'); return; }
          adminFetch('/api/admin/broadcast-selected', pw, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentCodes: codes, text: '📚 Your teacher sent you back to your assignments profile.', actionType: 'gohome', actionUrl: '/homework', actionLabel: 'Go to my assignments →' }),
          }).then((r) => r.json()).then((res) => {
            if (res && res.ok) { _mHomeFeedback(ov, codes); }
            else notify('Error: ' + (res && res.error || 'unknown'));
          }).catch((e) => notify('Error: ' + e.message));
        });
      })
      .catch((e) => notify('Error: ' + e.message));
  }
  // Live status board for "Llevar a casa": poll who actually arrived (≤45s).
  function _mHomeFeedback(ov, codes) {
    let t = null;
    const card = ov.querySelector('.m-modal-card');
    card.innerHTML =
      '<button class="m-modal-close" type="button" aria-label="Close">✕</button>' +
      '<h2>🏠 Heading home…</h2>' +
      '<p class="m-modal-sub" id="m-home-count" role="status">0 / ' + codes.length + ' home</p>' +
      '<div class="m-force-students" id="m-home-status"></div>' +
      '<button class="btn btn-xl" id="m-home-done" type="button">Close</button>';
    card.focus({ preventScroll: true });
    const stop = () => { if (t) clearInterval(t); try { ov.remove(); } catch (_) {} };
    card.querySelector('.m-modal-close').addEventListener('click', stop);
    card.querySelector('#m-home-done').addEventListener('click', stop);
    const board = card.querySelector('#m-home-status');
    const started = Date.now();
    const poll = () => {
      adminFetch('/api/admin/gohome-status?codes=' + encodeURIComponent(codes.join(',')), pw)
        .then((r) => r.json())
        .then((d) => {
          const sts = (d && d.statuses) || [];
          let arrived = 0;
          board.innerHTML = '';
          sts.forEach((s) => {
            if (s.arrived) arrived++;
            const row = document.createElement('div'); row.className = 'm-force-row';
            row.innerHTML = '<span class="m-force-row-state" aria-hidden="true">' + (s.arrived ? '✅' : '⏳') + '</span>'
              + '<span class="m-force-row-name">' + escapeHtml(s.name || s.code) + '</span>'
              + '<span class="m-force-row-code">' + (s.arrived ? 'home' : (s.online ? 'on the way…' : 'no signal')) + '</span>';
            board.appendChild(row);
          });
          const countEl = card.querySelector('#m-home-count');
          if (countEl) countEl.textContent = arrived + ' / ' + codes.length + ' home';
          if (arrived >= codes.length || (Date.now() - started) > 45000) {
            if (t) clearInterval(t);
            t = null;
            // the board stops after 45 s: say so, and what to do about the kids who never answered
            if (countEl && arrived < codes.length) {
              countEl.textContent = arrived + ' / ' + codes.length + ' home. Kids marked «no signal» have closed the page or lost Wi-Fi: ask them to open /homework again.';
            }
          }
        })
        .catch(() => {});
    };
    poll();
    t = setInterval(poll, 1500);
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
    e.currentTarget.setAttribute('aria-pressed', String(_gifOnlineOnly));
    e.currentTarget.classList.toggle('btn-jade', _gifOnlineOnly);
    e.currentTarget.textContent = _gifOnlineOnly ? '🟢 Online only: on' : '🟢 Online only';
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
    $('m-gif-msg').textContent = 'Sending…';
    adminFetch('/api/admin/gif-push', pw, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCodes: Array.from(_gifChecked), animId: _gifPick }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res && res.ok) {
          $('m-gif-msg').textContent = '✓ ' + res.label + ' sent to ' + res.sent + ' student(s). It appears on their screen in ~20s.';
          setTimeout(() => { _closeGifModal(); }, 1800);
        } else {
          $('m-gif-msg').textContent = '✗ ' + ((res && res.error) || 'could not do it');
          _updateGifSendBtn();
        }
      })
      .catch((e) => { $('m-gif-msg').textContent = '✗ ' + e.message; _updateGifSendBtn(); });
  });

  // 📢 Broadcast — sends a message to every student of one class code. 2026-10-13: a real form instead of five
  // prompt()/confirm() dialogs on the projector (Cancel on the first one used to send to 1001 anyway). Regular
  // teachers pick one of their own codes; the super admin may type any code (default: the first own code).
  // Same /api/admin/broadcast call and body as before.
  let _self = null;   // the signed-in teacher (renderRoster keeps it current)
  function _openBroadcast() {
    const self = _self || {};
    const codes = (self.accessCodes || []).filter(Boolean);
    const sel = $('m-bc-class-select');
    const inp = $('m-bc-class');
    const superAdmin = !!self.isSuperAdmin || !codes.length;
    sel.classList.toggle('hidden', superAdmin);
    inp.classList.toggle('hidden', !superAdmin);
    if (superAdmin) {
      $('m-bc-class-list').innerHTML = codes.map((c) => '<option value="' + escapeHtml(c) + '">').join('');
      // (no default value: the list offers the codes; a real class code is never pre-filled, his rule 2026-10-18,
      // /maestro may be on the projector)
    } else {
      const was = sel.value;
      sel.innerHTML = codes.map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>').join('');
      if (was && codes.includes(was)) sel.value = was;
    }
    $('m-bc-msg').textContent = '';
    $('m-bc-msg').classList.remove('is-error');
    $('m-bc-send').disabled = false;
    $('m-broadcast-modal').classList.remove('hidden');
  }
  function _closeBroadcast() { $('m-broadcast-modal').classList.add('hidden'); }
  function _sendBroadcast() {
    const self = _self || {};
    const superAdmin = !!self.isSuperAdmin || !(self.accessCodes || []).length;
    const classroomCode = (superAdmin ? $('m-bc-class').value : $('m-bc-class-select').value || '').trim();
    const text = ($('m-bc-text').value || '').trim();
    const url = ($('m-bc-url').value || '').trim();
    const label = ($('m-bc-label').value || '').trim() || 'Join now';
    const msg = $('m-bc-msg');
    const fail = (t) => { msg.textContent = t; msg.classList.add('is-error'); };
    msg.classList.remove('is-error');
    if (!classroomCode) { fail('Type the class code to send to.'); return; }
    if (!text) { fail('Write the message first.'); $('m-bc-text').focus(); return; }
    const btn = $('m-bc-send');
    btn.disabled = true;
    msg.textContent = 'Sending…';
    adminFetch('/api/admin/broadcast', pw, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classroomCode,
        text,
        actionType: url ? 'link' : null,
        actionUrl: url || null,
        actionLabel: url ? label : null,
      }),
    })
      .then((r) => r.json())
      .then((r) => {
        btn.disabled = false;
        if (!r || !r.ok) { fail('Could not send: ' + ((r && r.error) || 'unknown error')); return; }
        $('m-bc-text').value = '';
        $('m-bc-url').value = '';
        _closeBroadcast();
        notify('✓ Message sent to ' + r.sent + ' student' + (r.sent === 1 ? '' : 's') + ' of class ' + classroomCode + '.');
      })
      .catch(() => { btn.disabled = false; fail('Could not send. Check the connection and try again.'); });
  }
  $('m-broadcast-btn').addEventListener('click', _openBroadcast);
  $('m-broadcast-close').addEventListener('click', _closeBroadcast);
  $('m-bc-send').addEventListener('click', _sendBroadcast);
  $('m-broadcast-modal').addEventListener('click', (e) => { if (e.target === $('m-broadcast-modal')) _closeBroadcast(); });
  $('m-bc-text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) _sendBroadcast(); });

  // Auto-refresh every 15 seconds so the teacher sees who's joining in
  // real time. Only refreshes when the dashboard is visible (not while
  // looking at a student detail page or when the tab is in background).
  // User feedback 2026-05-27: "I should know who has joined right now —
  // don't make me keep asking 'who has joined?'"
  // 2026-10-13: it also runs while a student's profile is open, so «Online now» stays live (the hidden roster is
  // rebuilt behind the profile; the profile itself is not touched).
  setInterval(() => {
    if (document.hidden) return;
    if ($('m-dash').classList.contains('hidden')) return;
    if (!pw) return;
    // 🆕 2026-06-16 (Fernando bug): don't rebuild the roster while the
    // teacher is actively typing in the search box — the 15s refresh was
    // wiping the input + filter mid-search ("I type Sophia, then get
    // kicked back to all students"). If the search input has focus, skip
    // this tick entirely. (The persisted term below covers refreshes
    // that DO happen while a filter is applied but unfocused.)
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains('m-roster-search-input')) return;
    // an open class dropdown would snap shut under the teacher's finger
    if (active && active.classList && active.classList.contains('m-roster-class')) return;
    if (_authStopped) return;
    fetchRoster();
  }, 15000);
  function closeDetail() {
    $('m-detail').classList.add('hidden');
    $('m-roster').classList.remove('hidden');
    $('m-summary').classList.remove('hidden');
    // the roster is rebuilt every 15 s, so the row is found again by its code (not by the old DOM node)
    const code = _detailReturn;
    _detailReturn = null;
    const back = code && (document.querySelector('#m-roster .m-row[data-code="' + CSS.escape(code) + '"]')
      || document.querySelector('#m-online-list .m-online-kid[data-code="' + CSS.escape(code) + '"]'));
    if (back) { try { back.focus({ preventScroll: false }); } catch (_) {} }
  }
  let _detailReturn = null;   // the code of the student whose profile is open
  $('m-detail-back').addEventListener('click', closeDetail);

  // The 15 s refresh is silent: the list keeps showing while it loads (the old «Loading…» made the online pill
  // blink out), the ⟳ button spins, and a failure says what to do instead of leaving «Loading…» forever.
  let _rosterLoaded = false;
  let _rosterAt = 0;
  let _rosterInFlight = false;   // a stalled request never stacks a second one
  let _authStopped = false;      // after a 401 the 15 s refresh stops (each poll would count as a failed sign-in)
  function fetchRoster() {
    if (_rosterInFlight || !pw) return Promise.resolve();
    _rosterInFlight = true;
    const btn = $('m-refresh');
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    const done = () => { _rosterInFlight = false; btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); };
    return _studentsRequest(pw)
      .then(({ status, data }) => {
        done();
        if (data && data.ok) {
          _authStopped = false;
          renderRoster(data.students || [], data.self || null, data.archived);
          return;
        }
        if (status === 401 || status === 403) { _authStopped = true; _rosterProblem('auth', data && data.error); return; }
        _rosterProblem(status === 429 ? 'busy' : 'network');
      })
      .catch(() => { done(); _rosterProblem('network'); });
  }
  function _rosterProblem(kind, err) {
    const strip = document.querySelector('.m-online');
    if (strip) strip.classList.add('is-stale');
    if (_rosterLoaded && kind !== 'auth') {
      const t = new Date(_rosterAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      $('m-dash-sub').innerHTML = '<span class="m-stale">⚠️ ' + (kind === 'busy'
        ? 'The server is busy (too many wrong codes from this network).'
        : 'No connection right now.') + ' This list is from ' + escapeHtml(t) + '; it updates by itself.</span>';
      return;
    }
    const roster = $('m-roster');
    roster.removeAttribute('aria-busy');
    $('m-dash-sub').textContent = '';
    $('m-summary').innerHTML = '';
    if (kind === 'auth') {
      roster.innerHTML = '<div class="m-state is-error"><div class="m-state-title">Your teacher code was not accepted</div>'
        + '<p>It may have changed. Log out and sign in again with your current code.' + (err ? ' (' + escapeHtml(err) + ')' : '') + '</p>'
        + '<button class="btn btn-gold" type="button" data-act="logout">Log out</button></div>';
      roster.querySelector('[data-act=logout]').addEventListener('click', () => $('m-logout').click());
      if (!$('m-detail').classList.contains('hidden')) notify('Your teacher code was not accepted any more. Log out and sign in again.');
    } else {
      roster.innerHTML = '<div class="m-state is-error"><div class="m-state-title">'
        + (kind === 'busy' ? 'The server is busy right now' : 'Can\'t reach the server') + '</div>'
        + '<p>' + (kind === 'busy'
          ? 'Too many wrong codes were typed from this network, so sign-ins pause for a few minutes. The list comes back by itself.'
          : 'Games that are already open keep running. Check the Wi-Fi, then try again.') + '</p>'
        + '<button class="btn btn-gold" type="button" data-act="retry">⟳ Try again</button></div>';
      roster.querySelector('[data-act=retry]').addEventListener('click', fetchRoster);
    }
    const list = $('m-online-list');
    if (list && !_rosterLoaded) list.innerHTML = '';
  }
  // === Tab switcher: students ↔ teachers (super-admin only) ===
  document.querySelectorAll('.m-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.m-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === target);
        b.setAttribute('aria-selected', String(b.dataset.tab === target));
      });
      document.querySelectorAll('.m-tab').forEach((b) => b.setAttribute('tabindex', b.dataset.tab === target ? '0' : '-1'));
      document.querySelectorAll('.m-tabpanel').forEach((p) => p.classList.toggle('hidden', p.id !== 'm-tabpanel-' + target));
      // admin work: the class start band steps aside so the teacher list starts at the top (one tap brings it back)
      document.body.classList.toggle('m-tab-teachers', target === 'teachers');
      if (target === 'teachers') fetchTeachers();
    });
    // standard tab keys: ←/→ move between Students and Teachers
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tabs = Array.from(document.querySelectorAll('.m-tab'));
      const next = tabs[(tabs.indexOf(btn) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      e.preventDefault();
      next.click();
      next.focus();
    });
  });
  // === Teacher management (super-admin) ===
  // Class levels a code can have (core/levels.js via /api/admin/levels); 'hsk2' is stored for New HSK 1.
  let mLevels = [
    { id: 'yct1', teacherName: 'YCT 1', emoji: '🧒' },
    { id: 'hsk2', teacherName: 'New HSK 1', emoji: '🆕' },
    { id: 'hsk1', teacherName: 'Old HSK 1', emoji: '📘' },
  ];
  function levelLabel(id) {
    const l = mLevels.find((x) => x.id === (id || 'hsk1'));
    return l ? l.teacherName : String(id);
  }
  // quiet (2026-10-19, after an edit in a window): the rows stay until the new ones arrive, so the page does not jump
  function fetchTeachers(quiet) {
    const list = $('m-teachers-list');
    if (quiet !== true) {
      list.innerHTML = '<div class="m-empty">Loading teachers…</div>';
      fetchLevelKeys();   // 🔑 the «Claves de nivel» panel sits on top of this tab (2026-10-15)
      fetchRutaRules();   // 🏆 and La Ruta Dorada's rules under it (2026-10-16)
    }
    adminFetch('/api/admin/levels', pw).then((r) => r.json())
      .then((d) => { if (d && d.ok && Array.isArray(d.levels)) mLevels = d.levels; })
      .catch(() => {})
      .then(() => adminFetch('/api/admin/teachers', pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { list.innerHTML = '<div class="m-empty">Could not load the teachers: ' + escapeHtml(data && data.error || 'unknown error') + '</div>'; return; }
        renderTeachers(data.teachers || []);
      })
      .catch(() => { list.innerHTML = '<div class="m-empty">Could not load the teachers. Check the connection, then open this tab again.</div>'; });
  }
  // 🆕 2026-10-12 — change a classroom code's level / add a code with a level (super admin)
  // (2026-10-19: a teacher is named by uid in the address, never by her code: addresses reach access logs)
  function setCodeLevel(uid, code, level, sel) {
    sel.disabled = true;
    adminFetch('/api/admin/teacher/' + encodeURIComponent(uid) + '/class-codes/level', pw, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, level }),
    }).then((r) => r.json()).then((d) => {
      sel.disabled = false;
      if (!d || !d.ok) { notify('Error: ' + (d && d.error || '')); fetchTeachers(true); return; }
      sel.closest('.m-code-chip').classList.add('is-saved');
      setTimeout(() => { const c = sel.closest('.m-code-chip'); if (c) c.classList.remove('is-saved'); }, 1200);
    }).catch(() => { sel.disabled = false; notify('Sin conexión. Vuelve a intentarlo.', 'error'); });
  }
  function addCode(uid, level, displayName) {
    if (!confirm('¿Añadir un código de clase de ' + levelLabel(level) + ' para ' + displayName + '?')) return;
    adminFetch('/api/admin/teacher/' + encodeURIComponent(uid) + '/class-codes', pw, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level }),
    }).then((r) => r.json()).then((d) => {
      if (!d || !d.ok) { notify('Error: ' + (d && d.error || '')); return; }
      notify('✓ Código de clase nuevo: ' + d.code + ' (' + levelLabel(level) + ')');
      fetchTeachers(true);
    }).catch(() => notify('Sin conexión. Vuelve a intentarlo.', 'error'));
  }
  // 2026-10-19 (his ask: edit the teachers' names, codes and class codes): the row in Spanish, with ✏️ name and data,
  // 🔑 a new sign-in code and a pencil on each class code. Only the super admin sees this tab.
  function renderTeachers(teachers) {
    const list = $('m-teachers-list');
    list.innerHTML = '';
    if (!teachers.length) {
      list.innerHTML = '<div class="m-empty">Todavía no hay maestras. Crea la primera ↑</div>';
      return;
    }
    teachers.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'm-teacher-row' + (t.isSuperAdmin ? ' is-super' : '');
      const since = t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      row.innerHTML = `
        <div class="m-teacher-main">
          <div class="m-teacher-name">${escapeHtml(t.displayName || 'Sin nombre')}${t.isSuperAdmin ? ' <span class="m-teacher-badge">👑 Super admin</span>' : ''}</div>
          <div class="m-teacher-meta">${escapeHtml(t.email || 'sin correo')}${t.country ? ' · ' + escapeHtml(t.country) : ''}${since ? ' · desde ' + escapeHtml(since) : ''}</div>
          <button class="btn btn-ghost btn-sm m-teacher-edit" type="button">✏️ Editar nombre y datos</button>
        </div>
        <div class="m-teacher-codes">
          <div class="m-teacher-code-row">
            <span class="m-teacher-code-label">🔑 Código para entrar:</span>
            <code class="m-teacher-code is-secret" data-secret="${escapeHtml(t.teacherId)}" aria-label="Código oculto" translate="no">••••••</code>
            <button class="btn btn-ghost btn-sm m-secret-btn" type="button" aria-pressed="false" title="El código privado para entrar: oculto para que el proyector nunca lo muestre">Ver</button>
            <button class="btn btn-ghost btn-sm m-code-change-btn" type="button" title="Un código nuevo para entrar: el anterior deja de funcionar al momento">🔑 Cambiar código</button>
          </div>
          <div class="m-teacher-code-row m-teacher-code-row--codes">
            <span class="m-teacher-code-label">📚 Códigos de clase:</span>
            ${(t.accessCodes || []).map((c) => `<span class="m-code-chip"><button class="m-teacher-code m-cc-edit" type="button" data-code="${escapeHtml(c)}" translate="no"`
              + ` aria-label="Cambiar el código de clase ${escapeHtml(c)}" title="Cambiar este código de clase (los alumnos pasan solos al nuevo)">${escapeHtml(c)}<span class="m-cc-pen" aria-hidden="true">✏️</span></button>`
              + `<select class="m-code-level" data-code="${escapeHtml(c)}" aria-label="Nivel del código ${escapeHtml(c)}">`
              + mLevels.map((l) => `<option value="${escapeHtml(l.id)}"${((t.codeLevels || {})[c] || 'hsk1') === l.id ? ' selected' : ''}>${escapeHtml(l.emoji + ' ' + l.teacherName)}</option>`).join('')
              + `</select></span>`).join('')}
            <span class="m-code-add">
              <span class="m-code-add-label">Nuevo:</span>
              <select class="m-code-add-level" aria-label="Nivel del código nuevo">${mLevels.map((l) => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.emoji + ' ' + l.teacherName)}</option>`).join('')}</select>
              <button class="btn btn-ghost btn-sm m-code-add-btn" type="button">➕ Añadir</button>
            </span>
          </div>
        </div>
        ${t.isSuperAdmin ? '' : `<button class="btn btn-red btn-sm m-teacher-del" type="button">🗑️ Borrar</button>`}`;
      const del = row.querySelector('.m-teacher-del');
      if (del) del.addEventListener('click', () => deleteTeacher(t.uid, t.displayName));
      // 2026-10-13: private codes stay masked (the Teachers tab may be on the projector in front of the class)
      const secretBtn = row.querySelector('.m-secret-btn');
      const secret = row.querySelector('.m-teacher-code.is-secret, .m-teacher-code[data-secret]');
      if (secretBtn && secret) secretBtn.addEventListener('click', () => {
        const show = secretBtn.getAttribute('aria-pressed') !== 'true';
        secretBtn.setAttribute('aria-pressed', String(show));
        secretBtn.textContent = show ? 'Ocultar' : 'Ver';
        secret.textContent = show ? secret.dataset.secret : '••••••';
        secret.classList.toggle('is-secret', !show);
        secret.setAttribute('aria-label', show ? 'Código para entrar' : 'Código oculto');
      });
      row.querySelectorAll('.m-code-level').forEach((sel) => {
        const was = sel.value;
        sel.addEventListener('change', () => {
          // one code = a whole class: confirm before every kid on it changes level
          if (!confirm('¿Cambiar el código de clase ' + sel.dataset.code + ' a ' + levelLabel(sel.value) + '?\n\n'
            + 'Cada alumno que entra con ' + sel.dataset.code + ' recibe las tareas de ' + levelLabel(sel.value) + ' desde su próxima entrada.')) {
            sel.value = was;
            return;
          }
          setCodeLevel(t.uid, sel.dataset.code, sel.value, sel);
        });
      });
      row.querySelector('.m-code-add-btn').addEventListener('click', () => {
        addCode(t.uid, row.querySelector('.m-code-add-level').value, t.displayName || 'esta maestra');
      });
      row.querySelector('.m-teacher-edit').addEventListener('click', () => openTeacherEdit(t));
      row.querySelector('.m-code-change-btn').addEventListener('click', () => openCodeModal(t));
      row.querySelectorAll('.m-cc-edit').forEach((b) => b.addEventListener('click', () => openClassCodeModal(t, b.dataset.code)));
      list.appendChild(row);
    });
  }
  // ── 🔑 2026-10-15 La Ruta Dorada: «Claves de nivel» (super admin) ──────────────────────────────────────────────
  // One key per level opens La Base, El Entrenamiento and El Simulacro Dorado (core/level-keys.js). He sets and changes
  // them here; they are shown masked (this tab may be on the projector) and never written anywhere else.
  // (never a key as an example, not even a made-up one: it could be a real key on the projector; his rule 2026-10-18)
  const KEY_EX = 'una palabra de 4 letras o más y un número de 2 cifras';
  function fetchLevelKeys() {
    const list = $('m-keys-list');
    if (!list) return;
    adminFetch('/api/admin/level-keys', pw).then((r) => r.json()).then((d) => {
      if (!d || !d.ok) { $('m-keys-status').textContent = 'No se pudieron cargar las claves: ' + ((d && d.error) || ''); return; }
      renderLevelKeys(d);
    }).catch(() => { $('m-keys-status').textContent = 'No se pudieron cargar las claves. Revisa la conexión.'; });
  }
  function keyMessage(l) {
    // La Ruta Dorada (phase 2): the level's key screen, which then opens the level's route (/audios/<level>/clave)
    const link = location.origin + '/audios/' + encodeURIComponent(l.id) + '/clave';
    return '🐉 ¡Hola, familia de Dralingo!\n' +
      'Esta es la clave de *' + l.name + '*: *' + l.key + '*\n\n' +
      'Abre La Ruta Dorada de ' + l.name + ': La Base, El Entrenamiento y El Simulacro Dorado.\n' +
      '1. Entra aquí: ' + link + '\n' +
      '2. Escribe la clave una sola vez. El teléfono la recuerda.\n\n' +
      'Es solo para alumnos de Dralingo: por favor no la compartas. 💛';
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((res, rej) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(new Error('copy')); } catch (e) { rej(e); }
      ta.remove();
    });
  }
  function renderLevelKeys(d) {
    const when = d.goLiveAt ? new Date(d.goLiveAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    $('m-keys-status').innerHTML = d.goLiveAt
      ? '✅ Las claves están activas desde el <b>' + escapeHtml(when) + '</b>: los alumnos registrados antes no necesitan clave; las cuentas nuevas sí.'
      : '⏳ Todavía no hay claves. Cuando pongas la primera, las claves quedan activas: los alumnos registrados hasta ese momento siguen entrando sin clave, las cuentas nuevas la necesitarán.';
    const list = $('m-keys-list');
    list.innerHTML = '';
    (d.levels || []).forEach((l) => {
      const row = document.createElement('div');
      row.className = 'm-key-row';
      row.innerHTML =
        '<div class="m-key-main">' +
          '<span class="m-key-level">' + escapeHtml(l.name) + '</span>' +
          (l.key
            ? '<code class="m-key-value is-secret" aria-label="Clave oculta">••••••••</code>' +
              '<button class="btn btn-ghost btn-sm m-key-show" type="button" aria-pressed="false">Ver</button>'
            : '<span class="m-key-none">Sin clave todavía</span>') +
        '</div>' +
        '<div class="m-key-actions">' +
          '<button class="btn btn-ghost btn-sm m-key-edit" type="button">' + (l.key ? '✏️ Cambiar' : '➕ Poner clave') + '</button>' +
          (l.key ? '<button class="btn btn-gold btn-sm m-key-copy" type="button">📋 Copiar mensaje para WhatsApp</button>' : '') +
          (l.key ? '<button class="btn btn-ghost btn-sm m-danger-ghost m-key-close" type="button" title="Every phone and account that opened this level with the key must type the new key (kids from before the keys and kids you unlocked keep it)">Cerrar en todos los aparatos</button>' : '') +
        '</div>' +
        '<form class="m-key-form hidden" novalidate>' +
          '<label class="m-form-label"><span>Clave nueva de ' + escapeHtml(l.name) + ' (' + KEY_EX + ')</span>' +
          '<input class="input m-key-input" type="text" maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>' +
          '<div class="m-key-form-actions"><button class="btn btn-gold btn-sm" type="submit">Guardar</button>' +
          '<button class="btn btn-ghost btn-sm m-key-cancel" type="button">Cancelar</button></div>' +
          '<p class="m-key-msg" role="status"></p>' +
        '</form>';
      const show = row.querySelector('.m-key-show');
      const val = row.querySelector('.m-key-value');
      if (show) show.addEventListener('click', () => {
        const on = show.getAttribute('aria-pressed') !== 'true';
        show.setAttribute('aria-pressed', String(on));
        show.textContent = on ? 'Ocultar' : 'Ver';
        val.textContent = on ? l.key : '••••••••';
        val.classList.toggle('is-secret', !on);
        val.setAttribute('aria-label', on ? 'Clave' : 'Clave oculta');
      });
      const form = row.querySelector('.m-key-form');
      const input = row.querySelector('.m-key-input');
      const msg = row.querySelector('.m-key-msg');
      row.querySelector('.m-key-edit').addEventListener('click', () => {
        form.classList.remove('hidden');
        input.value = '';
        msg.textContent = l.key ? 'Las familias que ya la escribieron siguen entrando; la clave vieja deja de abrir aparatos nuevos.' : '';
        input.focus();
      });
      row.querySelector('.m-key-cancel').addEventListener('click', () => form.classList.add('hidden'));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = input.value.trim();
        if (!key) { msg.textContent = 'Escribe la clave.'; input.focus(); return; }
        if (l.key && !confirm('¿Cambiar la clave de ' + l.name + '?\n\nLa clave vieja deja de abrir aparatos nuevos. Manda el mensaje nuevo a las familias.')) return;
        msg.textContent = 'Guardando…';
        adminFetch('/api/admin/level-keys/' + encodeURIComponent(l.id), pw, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
        }).then((r) => r.json()).then((r) => {
          if (!r || !r.ok) { msg.textContent = (r && r.error) || 'No se pudo guardar.'; input.focus(); return; }
          notify('✓ Clave de ' + l.name + ' guardada. Copia el mensaje para WhatsApp y mándalo a las familias.');
          renderLevelKeys(r);
        }).catch(() => { msg.textContent = 'Sin conexión. Vuelve a intentarlo.'; });
      });
      const copy = row.querySelector('.m-key-copy');
      if (copy) copy.addEventListener('click', () => {
        copyText(keyMessage(l))
          .then(() => notify('✓ Mensaje copiado: pégalo en el grupo de WhatsApp de ' + l.name + '.'))
          .catch(() => { window.prompt('Copia este mensaje:', keyMessage(l)); });
      });
      const close = row.querySelector('.m-key-close');
      if (close) close.addEventListener('click', () => {
        if (!confirm('¿Cerrar ' + l.name + ' en todos los aparatos?\n\nCada teléfono y cada cuenta que la abrió con la clave tendrá que escribir la clave nueva. Los alumnos registrados antes de las claves y los que desbloqueaste tú la conservan.\n\nÚsalo solo si la clave se compartió fuera de la escuela: cámbiala primero.')) return;
        adminFetch('/api/admin/level-keys/' + encodeURIComponent(l.id) + '/close-devices', pw, { method: 'POST' })
          .then((r) => r.json()).then((r) => {
            if (!r || !r.ok) { notify('Error: ' + ((r && r.error) || '')); return; }
            notify('✓ ' + l.name + ' cerrado en todos los aparatos.');
          }).catch(() => notify('Network error'));
      });
      list.appendChild(row);
    });
  }

  // ── 🏆 2026-10-16 La Ruta Dorada: cómo se abre (super admin; core/ruta-progress.js) ─────────────────────────────
  // «El Entrenamiento está activo»: ON since phase 4's launch (his pick). ON = El Simulacro Dorado opens when every world
  // is practised with the % below (or a teacher's «Desbloquear», or the kid took a simulation before the launch);
  // OFF = the key alone opens it (El Entrenamiento stays open for practice either way).
  let _rutaRules = null;
  // canEdit: the super admin (the server refuses everyone else) · s.trainingBuilt: El Entrenamiento exists (phase 4), so
  // the switch may go on; until then it stays off and disabled, with the reason
  function paintRutaRules(s, canEdit) {
    _rutaRules = s;
    const sw = $('m-rules-live');
    if (!sw) return;
    const edit = canEdit !== false;
    sw.setAttribute('aria-checked', String(!!s.trainingLive));
    sw.disabled = !edit || (!s.trainingBuilt && !s.trainingLive);
    $('m-rules-live-help').textContent = !s.trainingBuilt && !s.trainingLive
      ? 'Apagado: El Simulacro Dorado se abre solo con la clave. El interruptor se podrá encender cuando El Entrenamiento esté publicado; entonces el Simulacro Dorado se ganará practicando cada mundo.'
      : s.trainingLive
      ? 'Encendido: El Simulacro Dorado se abre cuando el alumno practica cada mundo de El Entrenamiento con ' + s.doradoPct + ' % o más, o cuando tú lo desbloqueas en su perfil. Quien ya había hecho un simulacro antes de encenderlo lo sigue teniendo abierto.'
      : 'Apagado: El Simulacro Dorado se abre solo con la clave. El Entrenamiento sigue abierto para practicar; enciéndelo para que el Simulacro Dorado se gane practicando.';
    $('m-rules-pct-form').classList.toggle('is-off', !s.trainingLive);
    $('m-rules-off-note').hidden = !!s.trainingLive;
    const pct = $('m-rules-pct');
    pct.min = String(s.pctMin || 50);
    pct.max = String(s.pctMax || 100);
    if (document.activeElement !== pct) pct.value = String(s.doradoPct);
    pct.disabled = !edit;
    $('m-rules-pct-save').disabled = !edit;
  }
  function fetchRutaRules() {
    if (!$('m-rules')) return;
    adminFetch('/api/admin/ruta-settings', pw).then((r) => r.json()).then((d) => {
      if (!d || !d.ok) { $('m-rules-live-help').textContent = 'No se pudieron cargar las reglas: ' + ((d && d.error) || ''); return; }
      paintRutaRules(d.settings, d.canEdit);
    }).catch(() => { $('m-rules-live-help').textContent = 'No se pudieron cargar las reglas. Revisa la conexión.'; });
  }
  function saveRutaRules(patch, done) {
    $('m-rules-msg').textContent = 'Guardando…';
    adminFetch('/api/admin/ruta-settings', pw, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      .then((r) => r.json()).then((d) => {
        if (!d || !d.ok) { $('m-rules-msg').textContent = (d && d.error) || 'No se pudo guardar.'; if (done) done(false); return; }
        $('m-rules-msg').textContent = '';
        paintRutaRules(d.settings, d.canEdit);
        if (done) done(true);
      }).catch(() => { $('m-rules-msg').textContent = 'Sin conexión. Vuelve a intentarlo.'; if (done) done(false); });
  }
  if ($('m-rules-live')) {
    $('m-rules-live').addEventListener('click', () => {
      const sw = $('m-rules-live');
      if (!_rutaRules || sw.disabled) return;
      const on = !_rutaRules.trainingLive;
      if (on && !confirm('¿Encender la regla de El Entrenamiento?\n\nDesde ahora El Simulacro Dorado se abre cuando el alumno practica cada mundo con ' +
        _rutaRules.doradoPct + ' % o más (o cuando tú lo desbloqueas en su perfil).')) return;
      if (!on && !confirm('¿Apagar la regla?\n\nEl Simulacro Dorado se abrirá solo con la clave, sin practicar.')) return;
      sw.disabled = true;
      saveRutaRules({ trainingLive: on }, (ok) => {
        sw.disabled = false;
        if (ok) notify(on ? '✓ Encendido: El Simulacro Dorado se gana practicando.' : '✓ Apagado: El Simulacro Dorado se abre con la clave.');
      });
    });
    $('m-rules-pct-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Number($('m-rules-pct').value);
      const lo = (_rutaRules && _rutaRules.pctMin) || 50, hi = (_rutaRules && _rutaRules.pctMax) || 100;
      if (!Number.isInteger(n) || n < lo || n > hi) { $('m-rules-msg').textContent = 'Escribe un número de ' + lo + ' a ' + hi + '.'; $('m-rules-pct').focus(); return; }
      saveRutaRules({ doradoPct: n }, (ok) => { if (ok) notify('✓ El Simulacro Dorado pide ' + n + ' % en cada mundo.'); });
    });
  }

  // ── 🔑 2026-10-15 «Cambiar mi código» (every teacher) · another teacher's code (super admin) ─────────────────────
  // The super-admin code was served to everyone in an old comment of this file: the code can now be changed here.
  // The old code stops at once on every device; this browser keeps working with the new one.
  // 2026-10-19: one flow for everyone, in three steps inside the window (write it or 🎲 → «¿Seguro?» → the new code
  // shown once, with «Copiar»); the super admin opens the same window from a teacher's row (by uid, never the code
  // in the address).
  // ── windows in steps (form → confirm → done): the three teacher edits share these ─────────────────────────────
  function stepTo(modal, step) {
    modal.querySelectorAll('.m-step').forEach((s) => s.classList.toggle('hidden', s.dataset.step !== step));
    const card = modal.querySelector('.m-modal-card');
    if (card) card.scrollTop = 0;
    const box = modal.querySelector('.m-step[data-step="' + step + '"]');
    // the field on the first step; «Copiar» on the last; on «¿Seguro?» the window itself (a held Enter never confirms)
    const el = step === 'form' ? box && box.querySelector('input') : step === 'done' ? box && box.querySelector('.btn-gold') : card;
    setTimeout(() => { try { if (el && !modal.classList.contains('hidden')) el.focus({ preventScroll: true }); } catch (_) {} }, 40);
  }
  document.querySelectorAll('.m-step-card [data-step-back]').forEach((b) => b.addEventListener('click', () => {
    const m = b.closest('.m-modal');
    if (m) stepTo(m, 'form');
  }));
  function busyBtn(btn, label) {
    if (label) { btn.dataset.idle = btn.textContent; btn.textContent = label; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    else { if (btn.dataset.idle) btn.textContent = btn.dataset.idle; btn.disabled = false; btn.removeAttribute('aria-busy'); }
  }
  // the response with its status (a refused value goes back to the field; a server or network trouble stays put)
  const jsonOf = (r) => r.json().catch(() => null).then((d) => ({ status: r.status, d }));
  function copyBtn(btn, text) {
    const done = () => {
      btn.classList.add('is-copied');
      const was = btn.dataset.idle2 || btn.textContent;
      btn.dataset.idle2 = was;
      btn.textContent = '✓ Copiado';
      clearTimeout(btn._copyT);
      btn._copyT = setTimeout(() => { btn.textContent = was; btn.classList.remove('is-copied'); }, 1800);
    };
    copyText(text).then(done).catch(() => { window.prompt('Copia este código:', text); });
  }
  function rollDice(btn) {
    btn.classList.remove('is-rolling');
    void btn.offsetWidth;   // (restart the little roll on every tap)
    btn.classList.add('is-rolling');
  }

  // ── 🔑 the sign-in code («contraseña») ──
  let _codeTarget = null;    // null = my own code · a teacher row (super admin): { uid, teacherId, displayName }
  let _codeNew = '';
  const _isSelfRow = (t) => !t || !!(_self && _self.teacherId && t.teacherId === _self.teacherId);
  const _nameOf = (t) => (t && t.displayName) || 'esta maestra';
  // the same rules as the server (core/teachers.js validateNewCode): accents folded, spaces → one dash, 8-24 characters
  function codeShape(raw) {
    const c = String(raw || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, '-').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!c) return { error: 'Escribe el código nuevo o toca 🎲 Sugerir.' };
    if (c.replace(/-/g, '').length < 8) return { error: 'El código necesita al menos 8 letras o números.' };
    if (c.length > 24) return { error: 'El código puede tener 24 caracteres como máximo.' };
    if (!/[A-Z]/.test(c) || !/[0-9]/.test(c)) return { error: 'Usa letras y números juntos: unas palabras y unos números.' };
    return { code: c };
  }
  function openCodeModal(target) {
    _codeTarget = target || null;
    _codeNew = '';
    const self = _isSelfRow(target);
    $('m-mycode-title').textContent = self ? '🔑 Cambiar mi código' : '🔑 Código para entrar · ' + _nameOf(target);
    $('m-mycode-sub').textContent = self
      ? 'Tu código sirve para entrar aquí y para abrir juegos.'
      : 'Es el código con el que ' + _nameOf(target) + ' entra aquí y abre juegos.';
    $('m-mycode-new').value = '';
    $('m-mycode-msg').textContent = '';
    $('m-mycode-msg2').textContent = '';
    $('m-mycode-modal').classList.remove('hidden');
    stepTo($('m-mycode-modal'), 'form');
  }
  // a toast waits until its window closes (review 2026-10-19: over an open window it covered the title and repeated
  // the done step's own badge)
  let _afterClose = null;
  function toastOnClose(msg) { _afterClose = msg; }
  function flushToast() { const m = _afterClose; _afterClose = null; if (m) notify(m); }
  function closeCodeModal() {
    flushToast();
    $('m-mycode-modal').classList.add('hidden');
    $('m-mycode-final').textContent = '';     // the new code is shown once: it does not stay in the page
    $('m-mycode-preview').textContent = '';
    $('m-mycode-new').value = '';
    _codeNew = '';
  }
  $('m-mycode-btn').addEventListener('click', () => openCodeModal(null));
  $('m-mycode-close').addEventListener('click', closeCodeModal);
  $('m-mycode-done').addEventListener('click', closeCodeModal);
  $('m-mycode-random').addEventListener('click', () => {
    const btn = $('m-mycode-random');
    rollDice(btn);
    adminFetch('/api/admin/teachers/suggest-code', pw).then(jsonOf).then(({ d }) => {
      if (!d || !d.ok) { $('m-mycode-msg').textContent = (d && d.error) || 'No salió una idea. Toca 🎲 otra vez.'; return; }
      $('m-mycode-new').value = d.code;
      $('m-mycode-msg').textContent = '';
    }).catch(() => { $('m-mycode-msg').textContent = 'Sin conexión. Vuelve a intentarlo.'; });
  });
  function reviewCode() {
    const s = codeShape($('m-mycode-new').value);
    if (s.error) { $('m-mycode-msg').textContent = s.error; $('m-mycode-new').focus(); return; }
    _codeNew = s.code;
    const self = _isSelfRow(_codeTarget);
    $('m-mycode-ask').textContent = self ? '¿Cambiar tu código por este?' : '¿Darle a ' + _nameOf(_codeTarget) + ' este código nuevo?';
    $('m-mycode-preview').textContent = s.code;
    $('m-mycode-what').innerHTML = (self
      ? ['Tu código de ahora deja de funcionar al momento, en todos los aparatos.',
        'Las otras computadoras y proyectores te pedirán el código nuevo.',
        'En esta computadora sigues dentro.']
      : ['Su código de ahora deja de funcionar al momento, en todos sus aparatos.',
        'Sus computadoras y proyectores le pedirán el código nuevo.',
        'Sus alumnos, sus clases y sus tareas especiales no cambian.']).map((x) => '<li>' + escapeHtml(x) + '</li>').join('');
    $('m-mycode-msg2').textContent = '';
    stepTo($('m-mycode-modal'), 'confirm');
  }
  $('m-mycode-review').addEventListener('click', reviewCode);
  $('m-mycode-new').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); reviewCode(); } });
  $('m-mycode-save').addEventListener('click', () => {
    const btn = $('m-mycode-save');
    if (btn.disabled || !_codeNew) return;
    const target = _codeTarget;
    const self = _isSelfRow(target);
    const url = target ? '/api/admin/teacher/' + encodeURIComponent(target.uid) + '/code' : '/api/admin/my-code';
    busyBtn(btn, 'Cambiando…');
    adminFetch(url, pw, { method: target ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newCode: _codeNew }) })
      .then(jsonOf).then(({ status, d }) => {
        busyBtn(btn);
        if (!d || !d.ok) {
          const err = (d && d.error) || 'No se pudo cambiar el código. Vuelve a intentarlo.';
          if (status === 400) { stepTo($('m-mycode-modal'), 'form'); $('m-mycode-msg').textContent = err; }
          else $('m-mycode-msg2').textContent = err;
          return;
        }
        const code = d.teacher.teacherId;
        if (self) {
          pw = code;
          try { localStorage.setItem(STORAGE_PW, pw); } catch (_) {}
          try { if (localStorage.getItem('mochi.maestroPw')) localStorage.setItem('mochi.maestroPw', pw); } catch (_) {}
        }
        $('m-mycode-done-title').textContent = self ? 'Tu código cambió' : 'Código cambiado';
        $('m-mycode-final').textContent = code;
        $('m-mycode-line').textContent = self
          ? 'Este es tu código nuevo. Anótalo en un lugar seguro: el anterior ya no funciona.'
          : 'Dale este código nuevo a la maestra: el anterior ya no funciona.';
        $('m-mycode-preview').textContent = '';
        _codeNew = '';
        stepTo($('m-mycode-modal'), 'done');
        toastOnClose(self ? '✓ Tu código cambió.' : '✓ El código de ' + _nameOf(target) + ' cambió.');
        if (!$('m-tabpanel-teachers').classList.contains('hidden')) fetchTeachers(true);
        fetchRoster();
      }).catch(() => { busyBtn(btn); $('m-mycode-msg2').textContent = 'Sin conexión. Vuelve a intentarlo.'; });
  });
  $('m-mycode-copy').addEventListener('click', () => copyBtn($('m-mycode-copy'), $('m-mycode-final').textContent));

  // ── ✏️ a teacher's name, email and country (super admin) ──
  let _editTarget = null;
  const _EDIT_LABELS = { displayName: 'Nombre', email: 'Correo', country: 'País' };
  let _editNext = null;
  function openTeacherEdit(t) {
    _editTarget = t;
    _editNext = null;
    $('m-tedit-title').textContent = '✏️ ' + _nameOf(t);
    $('m-tedit-name').value = t.displayName || '';
    $('m-tedit-email').value = t.email || '';
    $('m-tedit-country').value = t.country || '';
    $('m-tedit-msg').textContent = '';
    $('m-tedit-msg2').textContent = '';
    $('m-tedit-modal').classList.remove('hidden');
    stepTo($('m-tedit-modal'), 'form');
  }
  $('m-tedit-close').addEventListener('click', () => $('m-tedit-modal').classList.add('hidden'));
  $('m-tedit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = _editTarget;
    if (!t) return;
    const msg = $('m-tedit-msg');
    const next = {
      displayName: $('m-tedit-name').value.replace(/\s+/g, ' ').trim(),
      email: $('m-tedit-email').value.trim(),
      country: $('m-tedit-country').value.trim().toUpperCase(),
    };
    if (!next.displayName) { msg.textContent = 'Escribe el nombre.'; $('m-tedit-name').focus(); return; }
    if (next.email && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(next.email)) { msg.textContent = 'Ese correo no parece bien escrito. Revísalo o déjalo vacío.'; $('m-tedit-email').focus(); return; }
    if (next.country && !/^[A-Z]{2,3}$/.test(next.country)) { msg.textContent = 'El país son 2 o 3 letras, o déjalo vacío.'; $('m-tedit-country').focus(); return; }
    const changed = Object.keys(next).filter((k) => (t[k] || '') !== next[k]);
    if (!changed.length) { msg.textContent = 'No cambiaste nada.'; return; }
    msg.textContent = '';
    _editNext = {};
    changed.forEach((k) => { _editNext[k] = next[k]; });
    $('m-tedit-diff').innerHTML = changed.map((k) => '<div class="m-diff-row"><dt>' + _EDIT_LABELS[k] + '</dt><dd>' +
      '<span class="m-diff-old">' + escapeHtml(t[k] || '(vacío)') + '</span><span class="m-diff-arrow" aria-label="cambia a">→</span>' +
      '<span class="m-diff-new">' + escapeHtml(next[k] || '(vacío)') + '</span></dd></div>').join('');
    $('m-tedit-msg2').textContent = '';
    stepTo($('m-tedit-modal'), 'confirm');
  });
  $('m-tedit-save').addEventListener('click', () => {
    const btn = $('m-tedit-save');
    const t = _editTarget;
    if (btn.disabled || !t || !_editNext) return;
    busyBtn(btn, 'Guardando…');
    adminFetch('/api/admin/teacher/' + encodeURIComponent(t.uid) + '/profile', pw, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(_editNext),
    }).then(jsonOf).then(({ status, d }) => {
      busyBtn(btn);
      if (!d || !d.ok) {
        const err = (d && d.error) || 'No se pudo guardar. Vuelve a intentarlo.';
        if (status === 400) { stepTo($('m-tedit-modal'), 'form'); $('m-tedit-msg').textContent = err; }
        else $('m-tedit-msg2').textContent = err;
        return;
      }
      $('m-tedit-modal').classList.add('hidden');
      notify('✓ Datos de ' + _nameOf(d.teacher) + ' guardados.');
      fetchTeachers(true);
      if (_isSelfRow(t)) fetchRoster();     // (his own name in the top bar)
    }).catch(() => { busyBtn(btn); $('m-tedit-msg2').textContent = 'Sin conexión. Vuelve a intentarlo.'; });
  });

  // ── 📚 a class code, renamed everywhere it lives (super admin; server.js moves every kid) ──
  let _ccTarget = null, _ccFrom = '', _ccTo = '';
  function openClassCodeModal(t, code) {
    _ccTarget = t;
    _ccFrom = String(code || '');
    _ccTo = '';
    const self = _isSelfRow(t);
    const lvl = levelLabel((t.codeLevels || {})[_ccFrom] || 'hsk1');
    $('m-cc-sub').innerHTML = (self ? 'Tu clase' : 'Clase de <b>' + escapeHtml(_nameOf(t)) + '</b>') + ' · ' + escapeHtml(lvl) +
      ' · código de ahora: <b class="m-cc-now" translate="no">' + escapeHtml(_ccFrom) + '</b>';
    $('m-cc-new').value = '';
    $('m-cc-msg').textContent = '';
    $('m-cc-msg2').textContent = '';
    $('m-cc-modal').classList.remove('hidden');
    stepTo($('m-cc-modal'), 'form');
  }
  const closeCc = () => { flushToast(); $('m-cc-modal').classList.add('hidden'); };
  $('m-cc-close').addEventListener('click', closeCc);
  $('m-cc-done').addEventListener('click', closeCc);
  $('m-cc-new').addEventListener('input', () => {
    const el = $('m-cc-new');
    const v = el.value.replace(/\D+/g, '').slice(0, 4);
    if (v !== el.value) el.value = v;
  });
  $('m-cc-random').addEventListener('click', () => {
    rollDice($('m-cc-random'));
    adminFetch('/api/admin/class-codes/suggest', pw).then(jsonOf).then(({ d }) => {
      if (!d || !d.ok) { $('m-cc-msg').textContent = (d && d.error) || 'No salió una idea. Toca 🎲 otra vez.'; return; }
      $('m-cc-new').value = d.code;
      $('m-cc-msg').textContent = '';
    }).catch(() => { $('m-cc-msg').textContent = 'Sin conexión. Vuelve a intentarlo.'; });
  });
  const _plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function reviewClassCode() {
    const t = _ccTarget;
    const msg = $('m-cc-msg');
    const to = $('m-cc-new').value.trim();
    if (!/^\d{4}$/.test(to)) { msg.textContent = 'Escribe 4 números o toca 🎲 Sugerir.'; $('m-cc-new').focus(); return; }
    if (to[0] === '0') { msg.textContent = 'Que no empiece con 0: del 1000 al 9999.'; $('m-cc-new').focus(); return; }
    const btn = $('m-cc-review');
    if (btn.disabled || !t) return;
    busyBtn(btn, 'Revisando…');
    adminFetch('/api/admin/teacher/' + encodeURIComponent(t.uid) + '/class-code/check', pw, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: _ccFrom, to }),
    }).then(jsonOf).then(({ d }) => {
      busyBtn(btn);
      if (!d || !d.ok) { msg.textContent = (d && d.error) || 'No se pudo revisar. Vuelve a intentarlo.'; $('m-cc-new').focus(); return; }
      msg.textContent = '';
      _ccTo = d.to;
      const live = (d.kids && d.kids.live) || 0, arch = (d.kids && d.kids.archived) || 0;
      $('m-cc-ask').textContent = _isSelfRow(t) ? '¿Cambiar el código de tu clase?' : '¿Cambiar el código de la clase de ' + _nameOf(t) + '?';
      $('m-cc-from').textContent = d.from;
      $('m-cc-to').textContent = d.to;
      $('m-cc-count').textContent = !live && !arch
        ? 'Ningún alumno tiene este código todavía.'
        : _plural(live, 'alumno pasa', 'alumnos pasan') + ' al código nuevo' +
          (arch ? ', y ' + _plural(arch, 'cuenta archivada', 'cuentas archivadas') + ' (vuelven ya con el código nuevo)' : '') + '.' +
          (d.classrooms ? ' Sus grupos de «Classrooms» también.' : '');
      // what changes for kids (his brief: say it in the window), with the real old number
      $('m-cc-what').innerHTML = [
        'Siguen con su nombre, sus resultados, sus tareas, sus sellos y su nivel.',
        'Los que entran con la clave de su nivel no notan nada.',
        'Un teléfono que ya recuerda al alumno entra solo. Uno que solo guardó el ' + d.from + ' le pedirá su código y la clave de su nivel.',
        'En clase con PIN, los alumnos nuevos quedan en el código nuevo.',
        'El ' + d.from + ' deja de funcionar y ninguna otra clase lo podrá usar.',
      ].map((x) => '<li>' + escapeHtml(x) + '</li>').join('');
      $('m-cc-msg2').textContent = '';
      stepTo($('m-cc-modal'), 'confirm');
    }).catch(() => { busyBtn(btn); msg.textContent = 'Sin conexión. Vuelve a intentarlo.'; });
  }
  $('m-cc-review').addEventListener('click', reviewClassCode);
  $('m-cc-new').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); reviewClassCode(); } });
  $('m-cc-save').addEventListener('click', () => {
    const btn = $('m-cc-save');
    const t = _ccTarget;
    if (btn.disabled || !t || !_ccTo) return;
    busyBtn(btn, 'Cambiando…');
    adminFetch('/api/admin/teacher/' + encodeURIComponent(t.uid) + '/class-code', pw, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: _ccFrom, to: _ccTo }),
    }).then(jsonOf).then(({ status, d }) => {
      busyBtn(btn);
      if (!d || !d.ok) {
        const err = (d && d.error) || 'No se pudo cambiar. Vuelve a intentarlo.';
        if (status === 400) { stepTo($('m-cc-modal'), 'form'); $('m-cc-msg').textContent = err; }
        else $('m-cc-msg2').textContent = err;
        return;
      }
      const moved = ((d.kids && d.kids.live) || 0) + ((d.kids && d.kids.archived) || 0);
      $('m-cc-final').textContent = d.to;
      $('m-cc-line').textContent = _isSelfRow(t)
        ? 'Tu clase ahora entra con este código. ' + (moved ? 'Tus alumnos ya están en él.' : '')
        : 'Avísale a ' + _nameOf(t) + ': su clase ahora entra con este código. ' + (moved ? 'Sus alumnos ya están en él.' : '');
      stepTo($('m-cc-modal'), 'done');
      toastOnClose('✓ Código de clase cambiado' + (moved ? ': ' + _plural(moved, 'alumno pasó', 'alumnos pasaron') + ' al código nuevo.' : '.'));
      _ccTo = '';
      fetchTeachers(true);
      fetchRoster();
    }).catch(() => { busyBtn(btn); $('m-cc-msg2').textContent = 'Sin conexión. Vuelve a intentarlo.'; });
  });
  $('m-cc-copy').addEventListener('click', () => copyBtn($('m-cc-copy'), $('m-cc-final').textContent));

  function deleteTeacher(uid, displayName) {
    // (the private teacher code is not printed: the Teachers tab keeps it masked; by uid since 2026-10-19)
    if (!confirm(`¿Borrar a «${displayName}»?\n\nSus alumnos se quedan sin maestra (puedes pasarlos a otra después).`)) return;
    adminFetch('/api/admin/teacher/' + encodeURIComponent(uid), pw, { method: 'DELETE' })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { notify('Error: ' + (data && data.error || '')); return; }
        fetchTeachers(true);
      }).catch(() => notify('Sin conexión. Vuelve a intentarlo.', 'error'));
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
    if (!displayName) { $('m-new-teacher-msg').textContent = 'Enter a name'; return; }
    const levels = [...document.querySelectorAll('#m-new-teacher-levels input:checked')].map((i) => i.value);
    if (!levels.length) { $('m-new-teacher-msg').textContent = 'Pick at least one class level'; return; }
    $('m-new-teacher-msg').textContent = 'Creating…';
    adminFetch('/api/admin/teachers', pw, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, email: email || null, country: country || null, levels }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { $('m-new-teacher-msg').textContent = 'Error: ' + (data && data.error || ''); return; }
        $('m-new-teacher-msg').textContent = '';
        $('m-result-teacher-id').textContent = data.teacher.teacherId;
        const cl = data.teacher.codeLevels || {};
        $('m-result-access-code').textContent = (data.teacher.accessCodes || [])
          .map((c) => c + ' (' + levelLabel(cl[c]) + ')').join(' · ');
        $('m-new-teacher-result').classList.remove('hidden');
        fetchTeachers(true);   // refresh list in background
      });
  });

  // 🆕 2026-06-16 — persisted roster search term (survives auto-refresh).
  let _rosterSearch = '';
  // 2026-10-13 remake: filter chips + class select also survive the 15 s refresh
  let _rosterFilter = 'all';     // 'all' | 'online' | a level id (yct1 / hsk2 / hsk1)
  let _rosterClass = '';         // '' = every class | a classroomId | '__none'
  let _rosterByCode = {};        // code → roster entry (the profile reads level + presence from it)
  let _prevOnline = null;        // codes online at the previous render: only newcomers pop in
  const _byName = (a, b) => (a.displayName || a.code || '').localeCompare(b.displayName || b.code || '');
  // The 15 s rebuild keeps keyboard focus where it was (a chip, a row, a face in Online now): the element is found
  // again by what it is, not by the old DOM node.
  function renderRoster(students, self, archived) {
    const act = document.activeElement;
    let focusSel = null;
    if (act && act !== document.body && act.classList) {
      if (act.classList.contains('m-chip')) focusSel = '.m-chip[data-filter="' + CSS.escape(act.dataset.filter || '') + '"]';
      else if (act.classList.contains('m-row') && act.dataset.code) focusSel = '#m-roster .m-row[data-code="' + CSS.escape(act.dataset.code) + '"]';
      else if (act.classList.contains('m-online-kid') && act.dataset.code) focusSel = '#m-online-list .m-online-kid[data-code="' + CSS.escape(act.dataset.code) + '"]';
    }
    _renderRoster(students, self, archived);
    const strip = document.querySelector('.m-online');
    if (strip) strip.classList.remove('is-stale');
    if (focusSel) {
      const el = document.querySelector(focusSel);
      if (el && !el.hidden) { try { el.focus({ preventScroll: true }); } catch (_) {} }
    }
  }
  function _renderRoster(students, self, archived) {
    _rosterLoaded = true;
    _rosterAt = Date.now();
    // Surface "who am I" line and (if super admin) the Teachers tab.
    if (self) {
      _self = self;
      const isSuper = !!self.isSuperAdmin;
      const codes = (self.accessCodes || []).filter(Boolean);
      const who = self.legacy ? 'Super admin (legacy session)' : (self.displayName || self.teacherId) + ' · ' + (isSuper ? 'Super admin' : 'Teacher');
      // the class codes kids type at /homework get their own chip (they were cut off at the end of one long line)
      $('m-dash-self').innerHTML = '<span class="m-self-name">' + escapeHtml(who) + '</span>'
        + (codes.length ? '<span class="m-self-codes" title="Class codes: kids type one at /homework">Codes ' + codes.map(escapeHtml).join(' · ') + '</span>' : '');
      $('m-dash-self').title = who + (codes.length ? ' · Class codes ' + codes.join(', ') : '');
      // Show tabs only for super admin
      const tabs = $('m-tabs');
      if (tabs) tabs.classList.toggle('hidden', !isSuper);
      // Reveal the personal Emirati gateway only for the super admin (owner).
      const emBtn = $('m-emirati-btn');
      if (emBtn) emBtn.classList.toggle('hidden', !isSuper);
    }
    // Kids poll their inbox every 20 s while their homework page is open, so "online right now" = lastSeen within
    // the last 45 seconds: one missed poll never flickers the dot off.
    const now = Date.now();
    students.forEach((s) => {
      const age = now - (s.lastSeen || 0);
      s._onlineNow = !!s.lastSeen && age <= ONLINE_MS;
      s._secsAgo = Math.floor(age / 1000);
    });
    // Online now: every kid online, even one who has done nothing yet (they just logged in).
    renderOnline(students.filter((s) => s._onlineNow));
    // The roster shows students with ANY activity (daily-challenge play counts) plus whoever is online right now.
    // (2026-10-16: «¡Me la sé!» seals in La Base count as activity too)
    students = students.filter((s) =>
      s._onlineNow || (s.sentenceCount > 0) || (s.testCount > 0) || (s.assignmentCount > 0)
      || (s.xp || 0) > 0 || !!s.dailyDate || !!(s.rutaBar && s.rutaBar.sealed > 0)
    );
    // Online first, by name (rows no longer jump at every refresh), then everyone else by last seen.
    students.sort((a, b) => (a._onlineNow !== b._onlineNow)
      ? (a._onlineNow ? -1 : 1)
      : (a._onlineNow ? _byName(a, b) : (b.lastSeen || 0) - (a.lastSeen || 0)));
    _rosterByCode = {};
    students.forEach((s) => { _rosterByCode[s.code] = s; });
    const onlineCount = students.filter((s) => s._onlineNow).length;
    // (the online count lives in Online now and on the «Online» chip; repeating it here was noise)
    $('m-dash-sub').innerHTML =
      `${students.length} with activity` +
      // accounts with 30 days of no activity rest in the archive (2026-10-12) and return when the kid uses their code
      (archived > 0
        ? ` · <span class="m-archived" title="No activity for 30 days. They come back with everything the moment the kid types their code.">📦 ${archived} archived</span>`
        : '');

    // Summary: one quiet line (the old three big cards pushed the list below the fold)
    const totals = students.reduce((acc, s) => {
      acc.sent  += s.sentenceCount    || 0;
      acc.asg   += s.assignmentCount  || 0;
      acc.tests += s.testCount        || 0;
      if (s.sentenceCount > 0)   acc.activeSent++;
      if (s.assignmentCount > 0) acc.activeAsg++;
      if (s.testCount > 0)       acc.activeTests++;
      return acc;
    }, { sent: 0, asg: 0, tests: 0, activeSent: 0, activeAsg: 0, activeTests: 0 });
    $('m-summary').innerHTML = students.length ? `
      <div class="m-summary-card" role="group" aria-label="Class summary">
        <div class="m-summary-stat" title="${totals.asg} homework submissions in total">
          <span class="m-summary-num">${totals.activeAsg}/${students.length}</span><span class="m-summary-lbl">turned in homework</span>
        </div>
        <div class="m-summary-stat" title="${totals.tests} reading-test attempts in total">
          <span class="m-summary-num">${totals.activeTests}/${students.length}</span><span class="m-summary-lbl">took a reading test</span>
        </div>
        <div class="m-summary-stat" title="${totals.sent} sentences in total">
          <span class="m-summary-num">${totals.activeSent}/${students.length}</span><span class="m-summary-lbl">wrote sentences</span>
        </div>
      </div>` : '';

    // Roster rows
    const roster = $('m-roster');
    roster.removeAttribute('aria-busy');
    roster.innerHTML = '';
    if (!students.length) {
      const codes = ((_self && _self.accessCodes) || []).filter(Boolean);
      roster.innerHTML = '<div class="m-state"><div class="m-state-title">No student activity yet</div>'
        + '<p>Kids appear here after their first homework, game or daily challenge'
        + (codes.length ? '. They type your class code (' + codes.map(escapeHtml).join(', ') + ') at /homework.' : '.')
        + '</p></div>';
      return;
    }
    // 🔍 SEARCH + FILTERS — many kids (several «Luis» or «María»): narrow by name or code, by online / level, by class.
    const levelIds = mLevels.map((l) => l.id).filter((id) => students.some((s) => (s.level || 'hsk1') === id));
    if (_rosterFilter !== 'all' && _rosterFilter !== 'online' && !levelIds.includes(_rosterFilter)) _rosterFilter = 'all';
    const classes = {};
    let anyUnassigned = false;
    students.forEach((s) => { if (s.classroomId) classes[s.classroomId] = s.classroomName || s.classroomId; else anyUnassigned = true; });
    const classIds = Object.keys(classes).sort((a, b) => String(classes[a]).localeCompare(String(classes[b])));
    if (_rosterClass && _rosterClass !== '__none' && !classes[_rosterClass]) _rosterClass = '';
    const chip = (id, label, n) => '<button class="m-chip" type="button" data-filter="' + escapeHtml(id) + '" aria-pressed="' + (_rosterFilter === id) + '">'
      + escapeHtml(label) + ' <span class="m-chip-n">' + n + '</span></button>';
    const searchBar = document.createElement('div');
    searchBar.className = 'm-roster-search';
    searchBar.innerHTML =
      '<input class="input m-roster-search-input" type="search" inputmode="search" placeholder="Search by name or code" aria-label="Search students by name or code" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '<div class="m-chips" role="group" aria-label="Show">' +
        chip('all', 'All', students.length) +
        chip('online', '🟢 Online', onlineCount) +
        levelIds.map((id) => chip(id, levelLabel(id), students.filter((s) => (s.level || 'hsk1') === id).length)).join('') +
      '</div>' +
      (classIds.length
        ? '<select class="input m-roster-class" aria-label="Class"><option value="">All classes</option>'
          + classIds.map((id) => '<option value="' + escapeHtml(id) + '"' + (_rosterClass === id ? ' selected' : '') + '>' + escapeHtml(classes[id]) + '</option>').join('')
          + (anyUnassigned ? '<option value="__none"' + (_rosterClass === '__none' ? ' selected' : '') + '>No class</option>' : '')
          + '</select>'
        : '') +
      '<span class="m-roster-search-count" id="m-roster-search-count" role="status">' + students.length + ' students</span>';
    roster.appendChild(searchBar);
    const cols = document.createElement('div');
    cols.className = 'm-roster-cols';
    cols.setAttribute('aria-hidden', 'true');
    cols.innerHTML = '<span></span><span>Student</span><span>Level</span><span>Class</span><span>Daily</span><span>⚔️ 🔥 📝 📚 🏆</span><span>Last seen</span>';
    roster.appendChild(cols);
    const today = new Date().toISOString().slice(0, 10);
    const groupLabel = (key, text, n) => {
      const g = document.createElement('div');
      g.className = 'm-roster-group';
      g.dataset.group = key;
      g.textContent = text + (n != null ? ' · ' + n : '');
      roster.appendChild(g);
    };
    let lastGroup = '';
    students.forEach((s) => {
      const group = s._onlineNow ? 'online' : 'earlier';
      if (onlineCount > 0 && group !== lastGroup) {
        groupLabel(group, group === 'online' ? 'Online now' : 'Earlier', group === 'online' ? onlineCount : null);
        lastGroup = group;
      }
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'm-row' + (s._onlineNow ? ' is-online' : '');
      // Tone-strip + lowercase the searchable haystack so the teacher can
      // type "luis" and match "Luís", "Luisa", "LUIS_42", etc.
      const haystack = ((s.displayName || '') + ' ' + (s.code || ''))
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
      row.dataset.search = haystack;
      row.dataset.code = s.code;
      row.dataset.group = group;
      row.dataset.online = s._onlineNow ? '1' : '0';
      row.dataset.level = s.level || 'hsk1';
      row.dataset.classroom = s.classroomId || '__none';
      // Friendly "5 min ago" / "2 h ago" / "May 27" timestamp
      const sinceTxt = s._onlineNow
        ? 'Online'
        : (!s.lastSeen ? 'Never' : (s._secsAgo < 86400 ? formatRelative(s._secsAgo)
          : new Date(s.lastSeen).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })));
      const done = s.dailyDate === today;
      const name = s.displayName || 'Anon';
      const c = (icon, n, title) => '<span class="m-row-c' + (n ? '' : ' is-zero') + '" title="' + title + '">' + icon + ' ' + n + '</span>';
      // 🏆 2026-10-16: La Ruta Dorada of their class level in one thin gold bar under the level (seals in La Base; the
      // El Entrenamiento worlds their seals or a teacher opened, in the tooltip and the row's label)
      const rb = s.rutaBar;
      const rutaTxt = rb ? 'La Ruta Dorada: ' + rb.sealed + ' of ' + rb.words + ' words marked, ' + rb.train + ' of ' + rb.worlds + ' experiences open in El Entrenamiento (practice rounds)' : '';
      const rutaBar = rb ? '<span class="m-row-ruta" title="' + escapeHtml(rutaTxt) + '">' + (rb.sealed > 0 && rb.words ? '<i style="width:' + Math.round((rb.sealed / rb.words) * 100) + '%"></i>' : '') + '</span>' : '';
      row.setAttribute('aria-label', name + ', code ' + s.code + ', ' + levelLabel(s.level) + (rutaTxt ? ', ' + rutaTxt : '') + ', '
        + (s.classroomName ? 'class ' + s.classroomName : 'no class') + ', '
        + (s._onlineNow ? 'online now' : 'last seen ' + sinceTxt) + ', daily challenge ' + (done ? 'done' : 'not done') + ', '
        + (s.sentenceCount || 0) + ' sentences, ' + (s.assignmentCount || 0) + ' homework, ' + (s.testCount || 0) + ' reading tests');
      row.innerHTML = `
        <span class="m-row-avatar"><span class="m-avatar-frame">${renderAvatar(s.avatar)}</span>${s._onlineNow ? '<span class="m-online-dot" title="Online now"></span>' : ''}</span>
        <span class="m-row-who"><span class="m-row-name">${escapeHtml(name)}</span><span class="m-row-code">${escapeHtml(s.code)}</span>${s.auto ? '<span class="m-row-auto" title="Made by itself on La Ruta Dorada (no class code yet). It joins a class when the family logs in at Mis tareas with a class code + this code.">automática</span>' : ''}${s.byKey && !s.classroomCode ? '<span class="m-row-auto" title="Made by the family with the level key (Mis tareas, «Soy nuevo»). It joins your class the first time the kid plays in one of your PIN rooms.">con clave</span>' : ''}</span>
        <span class="m-row-tags">
          <span class="m-row-levelcell"><span class="m-row-level is-${escapeHtml(s.level || 'hsk1')}" title="Level (the one the kid is in: their class code's, or the one a teacher set with «Change level»)">${escapeHtml(levelLabel(s.level))}</span>${rutaBar}</span>
          <span class="m-row-classroom${s.classroomName ? '' : ' is-none'}" title="Class">${s.classroomName ? '🎓 ' + escapeHtml(s.classroomName) : 'No class'}</span>
          <span class="m-row-daily${done ? ' is-done' : ''}" title="Daily challenge today">${done ? '✅ Done' : 'Not yet'}</span>
        </span>
        <span class="m-row-counts">${c('⚔️', s.swords || 0, 'DralySwords')}${c('🔥', s.streak || 0, 'Day streak')}${c('📝', s.sentenceCount || 0, 'Sentences written')}${c('📚', s.assignmentCount || 0, 'Homework turned in')}${c('🏆', s.testCount || 0, 'Reading tests')}</span>
        <span class="m-row-date">${sinceTxt}</span>`;
      row.addEventListener('click', () => { _detailReturn = s.code; openDetail(s.code); });
      roster.appendChild(row);
    });
    const noMatch = document.createElement('div');
    noMatch.className = 'm-state m-roster-nomatch';
    noMatch.hidden = true;
    noMatch.innerHTML = '<div class="m-state-title">No students match</div><p>Clear the search or pick All to see everyone.</p>'
      + '<button class="btn btn-sm" type="button" data-act="clear">Show everyone</button>';
    roster.appendChild(noMatch);
    // Wire the search filter — runs on every keystroke, no debounce needed for ~30-100 rows; hides rows whose
    // search-haystack doesn't contain the query (tone-stripped lowercase substring match) or that the chips exclude.
    const searchInput = searchBar.querySelector('.m-roster-search-input');
    const countEl = searchBar.querySelector('#m-roster-search-count');
    // Apply the current term to the visible rows + update the count.
    function applyRosterFilter() {
      const q = (_rosterSearch || '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
      let visible = 0;
      const groupsShown = {};
      roster.querySelectorAll('.m-row').forEach((r) => {
        const okQ = !q || (r.dataset.search || '').includes(q);
        const okF = _rosterFilter === 'all'
          || (_rosterFilter === 'online' ? r.dataset.online === '1' : r.dataset.level === _rosterFilter);
        const okC = !_rosterClass || r.dataset.classroom === _rosterClass;
        const match = okQ && okF && okC;
        r.hidden = !match;
        if (match) { visible++; groupsShown[r.dataset.group] = true; }
      });
      roster.querySelectorAll('.m-roster-group').forEach((g) => { g.hidden = !groupsShown[g.dataset.group]; });
      noMatch.hidden = visible > 0;
      const filtered = q || _rosterFilter !== 'all' || _rosterClass;
      if (countEl) {
        countEl.textContent = filtered
          ? (visible + ' of ' + students.length + ' shown')
          : (students.length + ' student' + (students.length === 1 ? '' : 's'));
      }
    }
    // 🆕 2026-06-16 — persist the search term in module state so the 15s auto-refresh (which rebuilds this whole
    // list) doesn't lose what the teacher typed. On every render we restore the value + re-apply the filter.
    searchInput.value = _rosterSearch || '';
    searchInput.addEventListener('input', () => {
      _rosterSearch = searchInput.value;
      applyRosterFilter();
    });
    searchBar.querySelectorAll('.m-chip').forEach((b) => b.addEventListener('click', () => {
      _rosterFilter = b.dataset.filter;
      searchBar.querySelectorAll('.m-chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      applyRosterFilter();
    }));
    const clsSel = searchBar.querySelector('.m-roster-class');
    if (clsSel) clsSel.addEventListener('change', () => { _rosterClass = clsSel.value; applyRosterFilter(); });
    noMatch.querySelector('[data-act=clear]').addEventListener('click', () => {
      _rosterSearch = ''; _rosterFilter = 'all'; _rosterClass = '';
      searchInput.value = '';
      if (clsSel) clsSel.value = '';
      searchBar.querySelectorAll('.m-chip').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === 'all')));
      applyRosterFilter();
    });
    applyRosterFilter();
  }

  // Online now: the class's avatars standing on the Dubai waterfront (the dashboard's one signature move).
  // Up to 5 kids stand on the waterline; a bigger class becomes a scrolling grid of smaller faces, still with names
  // (a real class is 10-30 kids: «who is here» must survive). Tap a kid → profile.
  function renderOnline(list) {
    const ul = $('m-online-list');
    const count = $('m-online-count');
    if (!ul || !count) return;
    // aria-live: only write when the number changes, or a screen reader repeats it every 15 s
    if (count.textContent !== String(list.length)) count.textContent = String(list.length);
    count.classList.toggle('is-zero', !list.length);
    const stage = ul.parentElement;
    const oldEmpty = stage.querySelector('.m-online-empty');
    const prev = _prevOnline;
    _prevOnline = new Set(list.map((s) => s.code));
    if (!list.length) {
      ul.innerHTML = '';
      ul.classList.remove('is-crowd');
      if (!oldEmpty) {
        const empty = document.createElement('div');
        empty.className = 'm-online-empty';
        const pair = window.DralingoCast ? DralingoCast.pick(2) : [];
        const img = (id) => id ? '<img src="' + escapeHtml(DralingoCast.pose(id, 'hello')) + '" alt="" width="96" height="128" onerror="this.remove()">' : '<span></span>';
        empty.innerHTML = img(pair[0]) + '<p>Nobody online yet. Kids show up here when they open their homework or join a game.</p>' + img(pair[1]);
        stage.appendChild(empty);
      }
      return;
    }
    if (oldEmpty) oldEmpty.remove();
    const sorted = list.slice().sort(_byName);
    const crowd = sorted.length > 5;
    ul.classList.toggle('is-crowd', crowd);
    ul.innerHTML = sorted.map((s) => {
      const name = s.displayName || 'Anon';
      return '<li><button class="m-online-kid' + (prev && !prev.has(s.code) ? ' is-new' : '') + '" type="button" data-code="' + escapeHtml(s.code) + '" title="' + escapeHtml(name) + ' · open profile">'
        + '<span class="m-online-face">' + renderAvatar(s.avatar) + '</span>'
        + '<span class="m-online-name">' + escapeHtml(name.split(' ')[0]) + '</span></button></li>';
    }).join('');
    ul.querySelectorAll('.m-online-kid').forEach((b) => b.addEventListener('click', () => { _detailReturn = b.dataset.code; openDetail(b.dataset.code); }));
  }

  // "hace 5s" / "hace 2 min" / "hace 1h"
  function formatRelative(secs) {
    if (secs < 60)   return secs + 's ago';
    if (secs < 3600) return Math.floor(secs / 60) + ' min ago';
    if (secs < 86400) return Math.floor(secs / 3600) + ' h ago';
    return Math.floor(secs / 86400) + ' days ago';
  }

  function openDetail(code) {
    adminFetch('/api/admin/students/' + encodeURIComponent(code), pw)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { notify('Could not open this student: ' + (data && data.error || 'unknown error')); return; }
        renderDetail(data);
      })
      .catch(() => notify('Could not open this student. Check the connection and try again.'));
  }

  function renderNotes(code, notes) {
    const list = $('m-notes-list');
    if (!list) return;
    if (!notes.length) { list.innerHTML = '<div class="m-notes-empty">No notes yet. Write a few words above; they go on the monthly report card.</div>'; return; }
    list.innerHTML = '';
    notes.slice().reverse().forEach((n) => {
      const row = document.createElement('div');
      row.className = 'm-note-item';
      row.innerHTML = `
        <span class="m-note-month-tag">${escapeHtml(n.month || '')}${n.grade ? ' · ' + escapeHtml(n.grade) : ''}</span>
        <span class="m-note-item-text">${escapeHtml(n.text)}</span>
        <button class="m-note-del" type="button" aria-label="Delete this note" title="Delete this note">🗑</button>`;
      row.querySelector('.m-note-del').addEventListener('click', () => {
        if (!confirm('Delete this note? Parents will no longer see it on the report card.')) return;
        adminFetch('/api/admin/student/' + encodeURIComponent(code) + '/note/' + n.ts, pw, { method: 'DELETE' })
          .then((r) => r.json()).then((r) => renderNotes(code, r.notes || []))
          .catch(() => notify('Could not delete the note. Check the connection and try again.'));
      });
      list.appendChild(row);
    });
  }
  // ── 🏆 2026-10-16 La Ruta Dorada in a kid's profile (server.js _rutaAdmin, core/ruta-progress.js) ───────────────
  // One card per level (their class level first): is the level open on their account, the words they marked in La
  // Base per experience (2026-10-21: each experience folds open to its words, marked ✓ or not yet), which El
  // Entrenamiento experiences are open (their words, or a teacher), El Simulacro Dorado under the rule in force, and
  // their best % per simulation. «Open early» opens a step before the kid earns it; «Close again» undoes only what a
  // teacher opened (an experience the kid's own words opened stays open).
  // 2026-10-21 (his words: «Open their seals», «best 100», «Unlock» were not understood): every label says plainly
  // what it means.
  const RUTA_VIA = { grandfathered: 'enrolled before the level keys', teacher: 'opened early by a teacher', key: 'the level key is saved on their account' };
  // one word as a chip: pinyin (with its tones) + Spanish; marked = green ✓, not yet = grey (shared with the class view)
  function wordChip(w, on, extra) {
    return '<li class="m-wchip' + (on ? ' is-on' : '') + '"><span class="m-wchip-py" lang="zh-Latn">' + (on ? '<span class="m-wchip-tick" aria-hidden="true">✓</span>' : '') +
      escapeHtml(w.py || '·') + '</span><span class="m-wchip-es">' + escapeHtml(w.es || '') + '</span>' + (extra || '') + '</li>';
  }
  // a kid's words in one experience, as a fold: «8 of 12 marked», then the words not marked yet, then the marked ones
  function kidWorldWordsHtml(L, w) {
    const words = Array.isArray(w.words) ? w.words : [];
    const done = words.filter((x) => x.m);
    const todo = words.filter((x) => !x.m);
    const all = w.count || words.length;
    const marked = words.length ? done.length : (w.sealed || 0);
    const state = marked >= all && all > 0 ? ' is-full' : marked === 0 ? ' is-none' : '';
    const pctW = all ? Math.round((marked / all) * 100) : 0;
    const list = (title, arr, on) => (arr.length ? '<p class="m-wx-h">' + title + ' <span>' + arr.length + '</span></p><ul class="m-wchips">' + arr.map((x) => wordChip(x, on)).join('') + '</ul>' : '');
    return '<details class="m-wx" data-wx="' + escapeHtml(L.id) + '-' + w.n + '">' +
      '<summary class="m-wx-sum"><span class="m-wx-n" aria-hidden="true">' + w.n + '</span>' +
        '<span class="m-wx-name">' + escapeHtml(w.name || w.short || ('Experience ' + w.n)) + '<span class="m-sr"> (experience ' + w.n + ')</span></span>' +
        '<span class="m-ruta-bar' + (marked >= all && all > 0 ? ' is-full' : '') + '" aria-hidden="true"><i style="width:' + pctW + '%"></i></span>' +
        '<span class="m-wx-count' + state + '"><b>' + marked + '</b> of ' + all + ' marked</span>' +
        '<span class="m-wx-chev" aria-hidden="true"></span></summary>' +
      '<div class="m-wx-body">' +
        (words.length ? list('Not marked yet', todo, false) + list('Marked ✓', done, true)
          : '<p class="m-wx-empty">The words of this experience could not be read. Try again later.</p>') +
      '</div></details>';
  }
  function rutaLevelHtml(L, S) {
    const name = escapeHtml(L.name);
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    const btn = (label, attrs, kind, tip) => '<button class="btn btn-sm ' + (kind || 'btn-ghost') + ' m-ruta-btn" type="button" ' + attrs + (tip ? ' title="' + escapeHtml(tip) + '"' : '') + '>' + label + '</button>';
    const access = L.open
      ? '<span class="m-ruta-access is-open">🔓 Open · ' + escapeHtml(RUTA_VIA[L.via] || 'open') + '</span>'
      : '<span class="m-ruta-access">🔒 Locked · needs the ' + name + ' key</span>' + btn('🔓 Open ' + name + ' early', 'data-ruta-act="level"', 'btn-gold', 'Opens La Base, El Entrenamiento and El Simulacro Dorado of ' + L.name + ' for this kid, without the level key');
    // 🎯 phase 4: their best round in each experience of El Entrenamiento (green once it reaches the Dorado's %)
    const need = (S && S.doradoPct) || (L.dorado && L.dorado.pct) || 70;
    const pctPill = (p) => (p == null ? '<span class="m-ruta-pct is-none">no rounds yet</span>'
      : '<span class="m-ruta-pct' + (p >= need ? ' is-ok' : '') + '">Best round: ' + p + ' %</span>');
    const rows = (L.worlds || []).map((w) => {
      const state = w.train
        ? '<span class="m-ruta-train is-open">' + (w.via === 'seals' ? '✓ Opened by their words' : '🔓 Opened early by a teacher') + '</span>' + pctPill(w.practiced)
        : '<span class="m-ruta-train" title="Opens when the kid marks every word of this experience in La Base">Not open yet</span>' + (w.practiced != null ? pctPill(w.practiced) : '');
      const wn = escapeHtml(w.name || w.short || ('Experience ' + w.n));
      const act = w.teacher
        ? btn('Close again', 'data-ruta-act="lock" data-step="train" data-world="' + w.n + '" aria-label="Close again: ' + wn + ' in El Entrenamiento of ' + name + '"', '', 'Undo the teacher\'s opening (it stays open if the kid marked all its words)')
        : (!w.train ? btn('Open early', 'data-ruta-act="unlock" data-step="train" data-world="' + w.n + '" aria-label="Open early: ' + wn + ' in El Entrenamiento of ' + name + '"', '', 'Lets this kid practise this experience before marking all its words') : '');
      return '<div class="m-ruta-tr" role="row">' +
        '<span class="m-ruta-w" role="cell"><b>' + w.n + '</b><span>' + wn + '</span></span>' +
        '<span class="m-ruta-seals" role="cell"><span class="m-ruta-bar' + (w.sealed >= w.count ? ' is-full' : '') + '" aria-hidden="true"><i style="width:' + pct(w.sealed, w.count) + '%"></i></span>' +
          '<span class="m-ruta-num">' + w.sealed + ' of ' + w.count + '<span class="m-ruta-lbl"> words marked</span></span></span>' +
        '<span class="m-ruta-tcell" role="cell">' + state + '</span>' +
        '<span class="m-ruta-act" role="cell">' + act + '</span></div>';
    }).join('');
    // the extra practice rounds (Pinyin básico, the Simulacro del examen): shown, never counted for the Dorado
    const extraRows = (L.extra || []).map((x) => '<div class="m-ruta-tr is-extra" role="row">' +
      '<span class="m-ruta-w" role="cell"><b>' + (x.key === 'pinyin' ? 'Aa' : '★') + '</b><span>' + escapeHtml(x.name) + '</span></span>' +
      '<span class="m-ruta-seals" role="cell"><span class="m-ruta-num">—</span></span>' +
      '<span class="m-ruta-tcell" role="cell"><span class="m-ruta-train">' + (x.key === 'pinyin' ? 'Open from the start' : 'Opens when every experience is open') + '</span>' + pctPill(x.best) + '</span>' +
      '<span class="m-ruta-act" role="cell"></span></div>').join('');
    const T = L.train || { open: 0, of: 0 };
    const anyTeacher = (L.worlds || []).some((w) => w.teacher);
    const allOpen = T.of > 0 && T.open === T.of;
    const D = L.dorado || {};
    const practisedOk = (L.worlds || []).filter((w) => w.practiced != null && w.practiced >= need).length;
    let dStatus;
    if (D.rule === 'key') dStatus = L.open ? 'Open: the level key is enough (the practice rule is switched off in Teachers)' : 'Locked: needs the ' + L.name + ' key';
    else if (!L.open) dStatus = 'Locked: needs the ' + L.name + ' key';
    else if (D.open) {
      dStatus = D.via === 'teacher' ? 'Open · opened early by a teacher'
        : D.via === 'taken' ? 'Open · they took a simulation before the practice rule started'
        : 'Open · every experience practised with ' + D.pct + ' % or more';
    } else dStatus = 'Not open yet · ' + (D.practiced || 0) + ' of ' + D.of + ' experiences practised with ' + D.pct + ' % or more (it opens when all are)';
    // (while the key rule is in force, «Open early» only matters later: say so, before and after)
    const dNote = D.rule !== 'key' || !L.open ? ''
      : ' <span class="m-ruta-note">' + (D.teacher ? 'A teacher opened it early too: that counts once the practice rule is on.'
        : '«Open early» keeps it open for this kid once the practice rule is on.') + '</span>';
    // 📖 phase 5: per simulation taken, the latest try's mistakes and «Ver su libro» (that kid's golden book, mistakes
    // first; the link opens only on a teacher's device, server.js /api/golden)
    const sims = (L.sims || []).map((s) => '<li class="m-ruta-sim' + (s.best == null ? '' : s.best >= 60 ? ' is-pass' : ' is-low') + '"><b>Sim ' + s.n + '</b>' +
      (s.best == null ? '<span>not taken yet</span>' : '<span>best score ' + s.best + ' % · ' + s.tries + (s.tries === 1 ? ' try' : ' tries') + '</span>') +
      (s.mistakes != null ? '<span class="m-ruta-miss' + (s.mistakes === 0 ? ' is-zero' : '') + '">' + (s.mistakes === 0 ? 'no mistakes' : s.mistakes + (s.mistakes === 1 ? ' mistake' : ' mistakes')) + ' (last try)</span>' : '') +
      (s.book ? '<a class="m-ruta-book" href="' + escapeHtml(s.book) + '" target="_blank" rel="noopener" aria-label="Ver su libro: Simulacro ' + s.n + ' de ' + name + '">📖 Ver su libro</a>' : '') +
      '</li>').join('');
    return '<div class="m-ruta-level' + (L.own ? ' is-own' : '') + '" data-level="' + escapeHtml(L.id) + '">' +
      '<div class="m-ruta-head">' +
        '<h4 class="m-ruta-name" tabindex="-1"><span class="m-level-pill is-' + escapeHtml(L.id) + '">' + name + '</span>' + (L.own ? '<span class="m-ruta-own">class level</span>' : '') + '</h4>' +
        access +
      '</div>' +
      '<div class="m-ruta-steps">' +
        '<div class="m-ruta-step"><span class="m-ruta-step-n" aria-hidden="true">1</span><div class="m-ruta-step-body">' +
          '<div class="m-ruta-step-title">La Base: words marked <span class="m-ruta-big">' + L.sealed + '<small> of ' + L.words + '</small></span></div>' +
          '<p class="m-ruta-sub">The kid taps «¡Me la sé!» on each word they feel they know. Open an experience to see which words.</p>' +
          '<span class="m-ruta-bar is-wide' + (L.sealed >= L.words ? ' is-full' : '') + '" aria-hidden="true"><i style="width:' + pct(L.sealed, L.words) + '%"></i></span>' +
          '<div class="m-wxs">' + (L.worlds || []).map((w) => kidWorldWordsHtml(L, w)).join('') + '</div></div></div>' +
        '<div class="m-ruta-step"><span class="m-ruta-step-n" aria-hidden="true">2</span><div class="m-ruta-step-body">' +
          '<div class="m-ruta-step-title">El Entrenamiento (practice rounds) <span class="m-ruta-big">' + T.open + '<small> of ' + T.of + ' experiences open</small></span>' +
            '<span class="m-ruta-big">' + practisedOk + '<small> of ' + T.of + ' with ' + need + ' % or more</small></span>' +
            '<span class="m-ruta-step-acts">' +
              (!allOpen ? btn('Open all early', 'data-ruta-act="unlock" data-step="train" data-world="all" aria-label="Open early every experience of El Entrenamiento of ' + name + '"', '', 'Lets this kid practise every experience now') : '') +
              (anyTeacher ? btn('Close all again', 'data-ruta-act="lock" data-step="train" data-world="all" aria-label="Close again what a teacher opened in El Entrenamiento of ' + name + '"', '', 'Undo every teacher opening (experiences opened by their words stay open)') : '') +
            '</span></div>' +
          '<p class="m-ruta-sub">Each experience opens by itself once the kid marks all its words. «Open early» lets them practise before that.</p>' +
          '<div class="m-ruta-table" role="table" aria-label="' + name + ': experiences">' +
            '<div class="m-ruta-tr m-ruta-th" role="row"><span role="columnheader">Experience</span><span role="columnheader">Words marked</span><span role="columnheader">Practice rounds</span><span role="columnheader"><span class="m-sr">Action</span></span></div>' +
            rows + extraRows + '</div></div></div>' +
        '<div class="m-ruta-step"><span class="m-ruta-step-n" aria-hidden="true">3</span><div class="m-ruta-step-body">' +
          '<div class="m-ruta-step-title">El Simulacro Dorado (the exam simulations)' +
            '<span class="m-ruta-step-acts">' + (D.teacher
              ? btn('Close again', 'data-ruta-act="lock" data-step="dorado" aria-label="Close again El Simulacro Dorado of ' + name + '"', '', 'Undo the teacher\'s opening')
              : btn('Open early', 'data-ruta-act="unlock" data-step="dorado" aria-label="Open early El Simulacro Dorado of ' + name + '"', '', 'Opens the exam simulations for this kid before they practise every experience')) + '</span></div>' +
          '<p class="m-ruta-dstatus' + (L.open && (D.rule === 'key' || D.open) ? ' is-open' : '') + '">' + escapeHtml(dStatus) + dNote + '</p>' +
          (sims ? '<ul class="m-ruta-sims" aria-label="' + name + ': best score per simulation">' + sims + '</ul>' : '') +
        '</div></div>' +
      '</div></div>';
  }
  function renderRuta(wrap, data) {
    const R = data.ruta || { levels: [] };
    const S = R.settings || {};
    const rule = S.trainingLive
      ? 'Three steps: La Base (the kid marks the words they know), El Entrenamiento (practice rounds: an experience opens once all its words are marked) and El Simulacro Dorado (the exam simulations: open once every experience is practised with ' + S.doradoPct +
        ' % or more; kids who took a simulation before this rule started keep it open).'
      : 'Three steps: La Base (the kid marks the words they know), El Entrenamiento (practice rounds: an experience opens once all its words are marked) and El Simulacro Dorado (the exam simulations: open with the level key, the practice rule is switched off in Teachers).';
    // the experiences the teacher had open stay open after a change (the card is drawn again)
    const openFolds = new Set(Array.from(wrap.querySelectorAll('details.m-wx[open]')).map((d) => d.dataset.wx));
    wrap.innerHTML = '<h3 class="m-section-title" id="m-ruta-title">🏆 La Ruta Dorada</h3>' +
      '<p class="m-ruta-rule">' + escapeHtml(rule) + '</p>' +
      '<p class="m-ruta-legend"><b>Open early</b> = opens a step for this kid before they earn it. <b>Close again</b> = undoes only what a teacher opened.</p>' +
      R.levels.map((L) => rutaLevelHtml(L, S)).join('');
    wrap.querySelectorAll('details.m-wx').forEach((d) => { if (openFolds.has(d.dataset.wx)) d.open = true; });
    if (wrap.dataset.wired) return;
    wrap.dataset.wired = '1';
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ruta-act]');
      if (!b || !wrap.contains(b) || b.disabled) return;
      const card = b.closest('[data-level]');
      const level = card ? card.dataset.level : '';
      const act = b.dataset.rutaAct;
      const key = [level, act === 'level' ? 'level' : 'step', b.dataset.step || '', b.dataset.world || ''].join('|');   // the same control, unlocked or locked
      const url = '/api/admin/student/' + encodeURIComponent(data.code) + (act === 'level' ? '/level-access' : '/ruta');
      const payload = act === 'level' ? { level } : { level, step: b.dataset.step, world: b.dataset.world === 'all' ? 'all' : Number(b.dataset.world || 0), action: act };
      b.disabled = true;
      adminFetch(url, pw, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then((r) => r.json()).then((r) => {
          if (!r || !r.ok || !r.ruta) { b.disabled = false; notify('Could not change it: ' + ((r && r.error) || 'unknown error')); return; }
          data.ruta = r.ruta;
          if (act === 'level' && r.levelKey && $('m-detail-key') && r.levelKey.level === level) {
            $('m-detail-key').innerHTML = levelKeyLine(r.levelKey);
            $('m-detail-key').classList.toggle('is-open', !!r.levelKey.open);
          }
          renderRuta(wrap, data);
          // the focus stays where the teacher was: the same experience's or step's button (now «Close again» or «Open early»), else the level's title
          const again = Array.from(wrap.querySelectorAll('[data-ruta-act]')).find((x) => {
            const c = x.closest('[data-level]');
            return [c ? c.dataset.level : '', x.dataset.rutaAct === 'level' ? 'level' : 'step', x.dataset.step || '', x.dataset.world || ''].join('|') === key;
          });
          const lvlCard = wrap.querySelector('[data-level="' + CSS.escape(level) + '"]');
          const target = again || (lvlCard && lvlCard.querySelector('.m-ruta-name'));
          if (target) { try { target.focus({ preventScroll: true }); } catch (_) {} }
          const who = data.displayName || data.code;
          const what = act === 'level' ? 'La Ruta Dorada open' : (payload.step === 'dorado' ? 'El Simulacro Dorado' : (payload.world === 'all' ? 'El Entrenamiento, every experience' : 'El Entrenamiento, experience ' + payload.world));
          notify('✓ ' + who + ': ' + what + (act === 'lock' ? ' closed again' : act === 'level' ? '' : ' opened early') + '. Their phone shows it next time La Ruta Dorada opens.');
        }).catch(() => { b.disabled = false; notify('Network error'); });
    });
  }
  // ── 🆕 2026-10-22 «Change level» (his words: "if I see someone is mistakenly in a level that doesn't correspond to them,
  // I change it, and then automatically that person gets logged out and logged in again and it says exactly that") ──
  // The profile's «Level: Old HSK 1 · Change level» → a window: the levels of core/levels.js (the one they are in marked
  // «now»), one line of what happens, «Move to …» → server.js POST /api/admin/kid-level (the code in the body). Their
  // phone follows by itself and shows «Tu profe te cambió a <nivel> ✨» once; their progress stays. A toast with «Undo»
  // for 8 s puts back exactly what changed.
  const KID_LEVEL_NAMES = { yct1: 'YCT 1', hsk2: 'New HSK 1', hsk1: 'HSK 1' };   // (what kids read; /api/admin/levels wins)
  const kidLevelName = (id) => { const l = mLevels.find((x) => x.id === id); return (l && l.name) || KID_LEVEL_NAMES[id] || levelLabel(id); };
  function levelRowHtml(level, change) {
    const when = change && change.at ? new Date(change.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '';
    return '<span class="m-detail-level-k">Level</span>' +
      (level ? '<span class="m-level-pill is-' + escapeHtml(level) + '">' + escapeHtml(levelLabel(level)) + '</span>' : '<span class="m-detail-level-none">none yet</span>') +
      '<button class="btn btn-sm m-level-change-btn" id="m-detail-level-btn" type="button" aria-haspopup="dialog">Change level</button>' +
      (when ? '<span class="m-detail-level-when">Changed by a teacher on ' + escapeHtml(when) + ' · ' +
        (change.seen ? 'their phone already told them ✓' : 'their phone tells them the next time they open it') + '</span>' : '');
  }
  // after a change or an undo: the profile's level row, La Ruta Dorada's lines and the roster row show the new level
  function levelApply(data, r) {
    data.levelKey = r.levelKey || data.levelKey;
    data.levelChange = r.levelChange || null;
    if (r.ruta) data.ruta = r.ruta;
    const lvl = (r.levelKey && r.levelKey.level) || r.level || null;
    const row = $('m-detail-level');
    if (row) { row.innerHTML = levelRowHtml(lvl, data.levelChange); wireLevelBtn(data); }
    const line = $('m-detail-key');
    if (line && data.levelKey) { line.innerHTML = levelKeyLine(data.levelKey); line.classList.toggle('is-open', !!data.levelKey.open); wireUnlock(data); }
    const rw = $('m-ruta');
    if (rw && data.ruta) renderRuta(rw, data);
    if (_rosterByCode[data.code] && lvl) _rosterByCode[data.code].level = lvl;
    if (r.classroomCode !== undefined && _rosterByCode[data.code]) _rosterByCode[data.code].classroomCode = r.classroomCode;
    // (if this fails, the roster catches up at its next poll; no block comment here: test-ruta-dorada reads this file
    // with comments stripped, and a «data/*.json» line comment above would swallow the rest of it)
    try { fetchRoster(); } catch (_) { void 0; }
  }
  function wireLevelBtn(data) {
    const b = $('m-detail-level-btn');
    if (b) b.addEventListener('click', () => levelChangeOpen(data));
  }
  // 🔑 «Open early» in the key line (2026-10-15; a function since 2026-10-22: the line is drawn again after a level change)
  function wireUnlock(data) {
    const unlockBtn = $('m-detail-unlock');
    if (unlockBtn) unlockBtn.addEventListener('click', () => {
      unlockBtn.disabled = true;
      adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/level-access', pw, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      }).then((r) => r.json()).then((r) => {
        if (!r || !r.ok) { unlockBtn.disabled = false; notify('Could not open it: ' + ((r && r.error) || 'unknown error')); return; }
        const line = $('m-detail-key');
        if (line) { line.innerHTML = levelKeyLine(r.levelKey); line.classList.add('is-open'); }
        data.levelKey = r.levelKey || data.levelKey;
        const rw = $('m-ruta');
        if (rw && r.ruta) { data.ruta = r.ruta; renderRuta(rw, data); }
        notify('✓ ' + (data.displayName || data.code) + ': La Ruta Dorada open. It opens on their phone at their next login to Mis Tareas.');
      }).catch(() => { unlockBtn.disabled = false; notify('Network error'); });
    });
  }
  function levelChangeOpen(data) {
    const cur = (data.levelKey && data.levelKey.level) || null;
    const name = data.displayName || 'This kid';
    let overlay = $('m-kl-modal');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.className = 'm-modal';
    overlay.id = 'm-kl-modal';
    const opts = mLevels.map((l) => {
      const now = l.id === cur;
      const kid = kidLevelName(l.id);
      return '<button class="m-kl-opt' + (now ? ' is-now' : '') + '" type="button" role="radio" aria-checked="false" data-kl="' + escapeHtml(l.id) + '"' + (now ? ' disabled' : '') + '>' +
        '<span class="m-level-pill is-' + escapeHtml(l.id) + '">' + escapeHtml(l.teacherName || kid) + '</span>' +
        '<span class="m-kl-sub">' + (now ? 'Now' : (kid !== (l.teacherName || kid) ? 'Kids see «' + escapeHtml(kid) + '»' : '')) + '</span></button>';
    }).join('');
    overlay.innerHTML = '<div class="m-modal-card m-kl-card">' +
      '<button class="m-modal-close" type="button" aria-label="Close">✕</button>' +
      '<h2>Change ' + escapeHtml(name) + '\'s level</h2>' +
      '<p class="m-modal-sub">Pick the level ' + escapeHtml(name) + ' really belongs to. Nothing they did is lost.</p>' +
      '<div class="m-kl-opts" role="radiogroup" aria-label="Level">' + opts + '</div>' +
      '<div class="m-kl-sure" id="m-kl-sure" aria-live="polite"></div>' +
      '<div class="m-kl-actions"><button class="btn btn-ghost" type="button" data-kl-cancel>Cancel</button>' +
        '<button class="btn btn-gold" type="button" id="m-kl-go" disabled>Pick a level</button></div></div>';
    document.body.appendChild(overlay);
    let pick = null;
    const go = overlay.querySelector('#m-kl-go');
    const sure = overlay.querySelector('#m-kl-sure');
    const close = () => overlay.classList.add('hidden');
    overlay.querySelector('.m-modal-close').addEventListener('click', close);
    overlay.querySelector('[data-kl-cancel]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { close(); return; }
      const o = e.target.closest('[data-kl]');
      if (!o || o.disabled) return;
      pick = o.dataset.kl;
      overlay.querySelectorAll('[data-kl]').forEach((x) => x.setAttribute('aria-checked', String(x === o)));
      const t = levelLabel(pick), kid = kidLevelName(pick);
      sure.innerHTML = '<p><b>Are you sure?</b> ' + escapeHtml(name) + ' moves to ' + escapeHtml(t) + '. Their phone updates by itself and tells them: ' +
        '<span class="m-kl-quote">«Tu profe te cambió a ' + escapeHtml(kid) + ' ✨»</span></p>';
      go.disabled = false;
      go.textContent = 'Yes, move to ' + t;
    });
    go.addEventListener('click', () => {
      if (!pick) return;
      go.disabled = true;
      go.textContent = 'Moving…';
      adminFetch('/api/admin/kid-level', pw, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: data.code, level: pick }),
      }).then((r) => r.json().catch(() => null)).then((r) => {
        if (!r || !r.ok) { go.disabled = false; go.textContent = 'Yes, move to ' + levelLabel(pick); notify('Could not change the level: ' + ((r && r.error) || 'unknown error')); return; }
        close();
        if (r.unchanged) { notify('✓ ' + name + ' is already in ' + r.teacherName + '.'); return; }
        levelApply(data, r);
        notify('✓ ' + name + ' is now in ' + r.teacherName + (r.moved && r.classroomCode ? ', in class ' + r.classroomCode + ' (the ' + r.teacherName + ' class of the same teacher)' : '') + '. Their phone updates by itself.', 'ok', {
          label: 'Undo', ms: 8000,
          run: () => adminFetch('/api/admin/kid-level/undo', pw, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ undo: r.undo }),
          }).then((x) => x.json().catch(() => null)).then((x) => {
            if (!x || !x.ok) { notify('Could not undo: ' + ((x && x.error) || 'unknown error')); return; }
            levelApply(data, x);
            notify('↩ ' + name + ' is back in ' + (x.teacherName || 'their level') + '.', 'ok');
          }).catch(() => notify('Could not undo: network error. Change the level again instead.')),
        });
      }).catch(() => { go.disabled = false; go.textContent = 'Yes, move to ' + levelLabel(pick); notify('Could not change the level: network error. Try again.'); });
    });
    // the kid-facing names come from core/levels.js (already loaded when the Teachers tab was opened)
    if (!mLevels.some((l) => l.name)) adminFetch('/api/admin/levels', pw).then((r) => r.json()).then((d) => { if (d && d.ok && Array.isArray(d.levels)) mLevels = d.levels; }).catch(() => {});
  }
  // 🔑 2026-10-15 La Ruta Dorada: is this kid's level open on their account (any phone)? «Open early» opens it.
  function levelKeyLine(lk) {
    if (!lk || !lk.level) return '🔑 La Ruta Dorada: no level yet (the kid has not entered a class code)';
    const name = escapeHtml(lk.levelName || levelLabel(lk.level));
    if (lk.open) {
      const how = lk.via === 'grandfathered' ? 'enrolled before the level keys' : lk.via === 'teacher' ? 'opened early by a teacher' : 'the level key is saved on their account';
      return '🔓 La Ruta Dorada ' + name + ': <b>open</b> · ' + how;
    }
    return '🔒 La Ruta Dorada ' + name + ': <b>locked</b> (needs the ' + name + ' key) ' +
      '<button class="btn btn-gold btn-sm" id="m-detail-unlock" type="button" title="Opens La Base, El Entrenamiento and El Simulacro Dorado for this kid on every phone, without the level key">🔓 Open early</button>';
  }
  // ── 📊 2026-10-21 «Words: easiest and hardest» (Class work; server.js GET /api/admin/word-marks) ───────────────────
  // His ask: which words the kids mark in La Base («¡Me la sé!») and which they don't, to put more emphasis on the hard
  // ones. Pick a level (her own; the super admin: every level) → per experience, each word with how many of the kids
  // who started that experience marked it, hardest first. Numbers only: no kid names here.
  function wordMarksOpen(levelId) {
    let overlay = $('m-wm-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'm-modal hidden';
      overlay.id = 'm-wm-modal';
      overlay.innerHTML = '<div class="m-modal-card m-modal-card--wide m-wm-card">' +
        '<button class="m-modal-close" type="button" aria-label="Close">✕</button>' +
        '<h2>📊 Words: easiest and hardest</h2>' +
        '<p class="m-modal-sub">Which words your kids mark as known in La Base («¡Me la sé!») and which they don\'t yet. Hardest first.</p>' +
        '<div class="m-wm-levels" id="m-wm-levels" role="group" aria-label="Level"></div>' +
        '<p class="m-wm-legend"><span class="m-wm-key is-low" aria-hidden="true"></span><b>Few kids marked it</b> = they don\'t feel they know it yet: practise these. ' +
          'An experience counts only the kids who started it (marked at least one of its words).</p>' +
        '<div class="m-wm-body" id="m-wm-body" aria-live="polite"></div></div>';
      document.body.appendChild(overlay);
      const close = () => overlay.classList.add('hidden');
      overlay.querySelector('.m-modal-close').addEventListener('click', close);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { close(); return; }
        const b = e.target.closest('[data-wm-level]');
        if (b && !b.classList.contains('is-on')) wordMarksLoad(b.dataset.wmLevel);
      });
    }
    overlay.classList.remove('hidden');
    wordMarksLoad(levelId || overlay.dataset.level || '');
  }
  let _wmReq = 0;
  function wordMarksLoad(levelId) {
    const body = $('m-wm-body');
    const levels = $('m-wm-levels');
    if (!body) return;
    const my = ++_wmReq;
    body.innerHTML = '<p class="m-wm-empty">Loading…</p>';
    levels.querySelectorAll('[data-wm-level]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wmLevel === levelId)));
    adminFetch('/api/admin/word-marks' + (levelId ? '?level=' + encodeURIComponent(levelId) : ''), pw)
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (my !== _wmReq) return;
        if (!d || !d.ok) { body.innerHTML = '<p class="m-wm-empty">Could not load the words: ' + escapeHtml((d && d.error) || 'unknown error') + '. Try again.</p>'; return; }
        $('m-wm-modal').dataset.level = d.level || '';
        levels.innerHTML = (d.levels || []).map((l) => '<button class="m-wm-level' + (l.id === d.level ? ' is-on' : '') + '" type="button" data-wm-level="' + escapeHtml(l.id) + '" aria-pressed="' + (l.id === d.level) + '">' +
          '<span class="m-level-pill is-' + escapeHtml(l.id) + '">' + escapeHtml(l.name) + '</span></button>').join('');
        levels.classList.toggle('hidden', (d.levels || []).length < 2);
        if (!d.level) { body.innerHTML = '<p class="m-wm-empty">None of your classes has a level with La Base yet.</p>'; return; }
        body.innerHTML = wordMarksHtml(d);
      })
      .catch(() => { if (my === _wmReq) body.innerHTML = '<p class="m-wm-empty">Network error. Check the connection and try again.</p>'; });
  }
  function wordMarksHtml(d) {
    const tone = (p) => (p >= 80 ? 'is-high' : p >= 50 ? 'is-mid' : 'is-low');
    const sum = '<p class="m-wm-sum"><b>' + d.kids + (d.kids === 1 ? ' kid has' : ' kids have') + '</b> marked words in ' + escapeHtml(d.name) + ' La Base' +
      (d.classKids ? ' <span>(' + d.classKids + (d.classKids === 1 ? ' kid is' : ' kids are') + ' in your ' + escapeHtml(d.name) + ' classes)</span>' : '') + '.</p>';
    if (!d.kids) return sum + '<p class="m-wm-empty">No marks yet. When kids tap «¡Me la sé!» on the words they know in La Base, the easiest and hardest words show up here.</p>';
    const worlds = (d.worlds || []).map((w) => {
      const name = escapeHtml(w.name || w.short || ('Experience ' + w.n));
      if (!w.started) {
        return '<div class="m-wm-world is-empty"><div class="m-wm-whead"><span class="m-wx-n" aria-hidden="true">' + w.n + '</span><span class="m-wm-wname">' + name + '</span>' +
          '<span class="m-wm-wmeta">no kid has started it yet</span></div></div>';
      }
      const words = (w.words || []).map((x) => Object.assign({ p: Math.round((x.marked / w.started) * 100) }, x))
        .sort((a, b) => a.p - b.p || a.n - b.n);
      const hard = words.filter((x) => x.p < 50).length;
      const rows = words.map((x) => '<li class="m-wm-row ' + tone(x.p) + '">' +
        '<span class="m-wm-word"><span class="m-wchip-py" lang="zh-Latn">' + escapeHtml(x.py || '·') + '</span><span class="m-wchip-es">' + escapeHtml(x.es || '') + '</span></span>' +
        '<span class="m-wm-bar" aria-hidden="true"><i style="width:' + x.p + '%"></i></span>' +
        '<span class="m-wm-num">' + x.marked + ' of ' + w.started + ' kids · <b>' + x.p + ' %</b></span></li>').join('');
      const preview = words.slice(0, 3).map((x) => escapeHtml(x.py)).join(', ');
      return '<details class="m-wm-world">' +
        '<summary class="m-wm-whead"><span class="m-wx-n" aria-hidden="true">' + w.n + '</span><span class="m-wm-wname">' + name + '<span class="m-sr"> (experience ' + w.n + ')</span></span>' +
          '<span class="m-wm-wmeta">' + w.started + (w.started === 1 ? ' kid started' : ' kids started') + ' · ' + w.all + ' marked every word' +
          (hard ? ' · <b class="m-wm-hardn">' + hard + (hard === 1 ? ' hard word' : ' hard words') + '</b>' : '') + '</span>' +
          '<span class="m-wm-hardest"><span>Hardest:</span> <span lang="zh-Latn">' + preview + '</span></span>' +
          '<span class="m-wx-chev" aria-hidden="true"></span></summary>' +
        '<ol class="m-wm-rows">' + rows + '</ol></details>';
    }).join('');
    return sum + '<div class="m-wm-worlds">' + worlds + '</div>';
  }
  if ($('m-words-btn')) $('m-words-btn').addEventListener('click', () => wordMarksOpen());
  function renderDetail(data) {
    // a profile opened from Classrooms or Online now while the Teachers tab is showing: bring the Students tab back
    if ($('m-tabpanel-students').classList.contains('hidden')) {
      const tab = document.querySelector('.m-tab[data-tab=students]');
      if (tab) tab.click();
    }
    const wasHidden = $('m-detail').classList.contains('hidden');
    $('m-roster').classList.add('hidden');
    $('m-summary').classList.add('hidden');
    $('m-detail').classList.remove('hidden');
    const since = data.firstSeen ? new Date(data.firstSeen).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 'unknown';
    const tests = data.tests || [];
    const assigns = data.assignments || [];
    const entry = _rosterByCode[data.code] || {};
    // (2026-10-22) the level the kid really is in (server.js LevelKeys.classLevel, the one function), else the roster's
    const level = (data.levelKey && data.levelKey.level) || entry.level || null;
    const online = isOnlineNow(data);
    const seen = online ? 'Online now'
      : (data.lastSeen ? 'Last seen ' + new Date(data.lastSeen).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not seen yet');
    $('m-detail-head').innerHTML = `
      <div class="m-detail-hero">
        <span class="m-detail-avatar">${renderAvatar(data.avatar, 'large')}</span>
        <div class="m-detail-id">
          <div class="m-detail-name-row">
            <h3 class="m-detail-name" id="m-detail-name">${escapeHtml(data.displayName || 'Anon')}</h3>
            <button class="m-icon-btn" id="m-detail-rename-btn" type="button" title="Edit name" aria-label="Edit name">✏️</button>
          </div>
          <div class="m-detail-tags">
            <span class="m-detail-code" title="Student code">${escapeHtml(data.code)}</span>
            ${data.auto ? '<span class="m-row-auto" title="Made by itself on La Ruta Dorada (no class code yet). It joins a class when the family logs in at Mis tareas with a class code + this code.">automática</span>' : ''}
            ${data.byKey ? '<span class="m-row-auto" title="Made by the family with the level key (Mis tareas, «Soy nuevo»). It joins your class the first time the kid plays in one of your PIN rooms.">con clave</span>' : ''}
            <span class="m-presence${online ? ' is-online' : ''}">${online ? '🟢 ' : ''}${escapeHtml(seen)}</span>
          </div>
          <div class="m-detail-meta">Since ${since} ·
            📝 ${data.sentences.length} sentences ·
            📚 ${assigns.length} assignments ·
            🏆 ${tests.length} exams</div>
          <div class="m-detail-meta m-detail-device">
            ${data.country ? '🌍 ' + escapeHtml(data.country) : '🌍 unknown'}
            ${data.device ? ' · 📱 ' + escapeHtml(data.device) : ''}
            ${data.locale ? ' · 🗣 ' + escapeHtml(data.locale) : ''}
          </div>
          <div class="m-detail-level" id="m-detail-level">${levelRowHtml(level, data.levelChange)}</div>
          <div class="m-detail-key${data.levelKey && data.levelKey.open ? ' is-open' : ''}" id="m-detail-key">${levelKeyLine(data.levelKey)}</div>
          <label class="m-detail-class">🎓 Class
            <select class="input" id="m-detail-classroom"><option value="">Loading…</option></select>
          </label>
          <div class="m-detail-actions-row">
            <button class="btn btn-gold btn-sm" id="m-detail-send-btn" type="button" aria-expanded="false" aria-controls="m-detail-compose">💬 Send message</button>
            <button class="btn btn-ghost btn-sm m-danger-ghost" id="m-detail-clear-sent-btn" type="button" title="Deletes only the saved sentences; the student stays">🧹 Clear sentences</button>
            <button class="btn btn-red btn-sm m-danger-zone" id="m-detail-delete-btn" type="button" title="Delete this student permanently">🗑 Delete student</button>
          </div>
          <div class="m-compose hidden" id="m-detail-compose">
            <label class="m-form-label" style="margin:0;"><span>Message for ${escapeHtml(data.displayName || data.code)} (shows in their homework portal)</span>
              <textarea class="input" id="m-detail-msg-text" rows="2" maxlength="500" placeholder="Great work today! Practice your tones at home."></textarea>
            </label>
            <div class="m-compose-actions">
              <button class="btn btn-gold btn-sm" id="m-detail-msg-send" type="button">📤 Send</button>
              <button class="btn btn-ghost btn-sm" id="m-detail-msg-cancel" type="button">Cancel</button>
            </div>
          </div>
          ${_self && _self.isSuperAdmin && !data.auto ? `<details class="m-detail-more" id="m-detail-more">
            <summary>More</summary>
            <p class="m-detail-more-p">Only for a lost phone, or when someone else is using this kid's account: every phone signs out, and the kid comes back with their code + the level key. To put a kid in the right level, use <b>Change level</b> above: that one needs nothing from them.</p>
            <button class="btn btn-ghost btn-sm m-danger-ghost" id="m-detail-close-sessions-btn" type="button">📵 Cerrar su sesión en todos los teléfonos</button>
          </details>` : ''}
        </div>
      </div>
      <!-- 📋 Notes for the monthly report card -->
      <div class="m-notes-box">
        <div class="m-notes-title">📋 Report-card notes (parents see them)</div>
        <div class="m-notes-row">
          <input class="input m-note-grade" id="m-note-grade" type="text" placeholder="Grade: A, 95" maxlength="12" aria-label="Grade">
          <input class="input m-note-month" id="m-note-month" type="month" aria-label="Month">
        </div>
        <textarea class="input m-note-text" id="m-note-text" rows="2" placeholder="Keywords: excellent pronunciation, shy to speak, mastered the family…" maxlength="400" aria-label="Note"></textarea>
        <button class="btn btn-sm" id="m-note-add" type="button">➕ Save note</button>
        <div class="m-notes-list" id="m-notes-list"></div>
      </div>`;
    // the profile opens at its top (it used to open wherever the roster had been scrolled to)
    // ...and always lands in view: from Online now or a phone it opened ~900 px below the tap (review 2026-10-13)
    if (wasHidden) {
      const bar = (document.querySelector('.m-topbar') || { offsetHeight: 0 }).offsetHeight;
      const r = $('m-detail').getBoundingClientRect();
      if (r.top < bar || r.top > window.innerHeight * 0.45) window.scrollTo({ top: Math.max(0, r.top + window.scrollY - bar - 12) });
      setTimeout(() => { try { $('m-detail-back').focus({ preventScroll: true }); } catch (_) {} }, 0);
    }
    // 🔑 «Open early»: this kid's level opens on their account (their next /homework login opens it on any phone)
    wireUnlock(data);
    wireLevelBtn(data);   // 🆕 2026-10-22 «Change level»
    // Notes: default month = current, render existing, wire add/delete.
    (function wireNotes() {
      const monthEl = $('m-note-month');
      if (monthEl) monthEl.value = new Date().toISOString().slice(0, 7);
      renderNotes(data.code, data.notes || []);
      const addBtn = $('m-note-add');
      if (addBtn) addBtn.addEventListener('click', () => {
        const text = ($('m-note-text').value || '').trim();
        if (!text) { notify('Write the note first.'); $('m-note-text').focus(); return; }
        addBtn.disabled = true;
        adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/note', pw, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, grade: $('m-note-grade').value.trim(), month: $('m-note-month').value }),
        }).then((r) => r.json()).then((r) => {
          addBtn.disabled = false;
          if (!r.ok) { notify('Could not save the note: ' + (r.error || 'unknown error')); return; }
          $('m-note-text').value = '';
          renderNotes(data.code, r.notes || []);
          notify('✓ Note saved');
        }).catch(() => { addBtn.disabled = false; notify('Could not save the note. Check the connection and try again.'); });
      });
    })();
    // Wire "limpiar oraciones" — wipes saved sentences ONLY (kid record stays).
    // Useful when a class spammed test saves and the teacher wants a clean slate.
    $('m-detail-clear-sent-btn').addEventListener('click', () => {
      const n = (data.sentences || []).length;
      if (!n) { notify('This student has no saved sentences.', 'info'); return; }
      if (!confirm('Delete the ' + n + ' saved sentences of "' + (data.displayName || data.code) + '"?\n\nHomework and exam history are NOT touched. Only the builder sentences.')) return;
      adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/sentences/clear', pw, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      }).then((r) => r.json()).then((r) => {
        if (!r.ok) { notify('Could not clear the sentences: ' + (r.error || 'unknown error')); return; }
        notify('✓ ' + r.removed + ' sentences deleted.');
        openDetail(data.code);
      }).catch((e) => notify('Could not clear the sentences: ' + e.message));
    });
    // 🔒 2026-10-18 (la entrada, security review F2): super admin only — every session and remembered phone of this kid ends
    const closeBtn = $('m-detail-close-sessions-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      // (security check N3: say honestly what it can't close)
      const caveat = data.byKey
        ? '\n\nOjo: quien tenga su código Y la clave de su nivel puede volver a entrar. Si se perdió un teléfono, cambia también la clave de su nivel.'
        : '\n\nOjo: este alumno usa el código de clase de 4 números (la puerta antigua): un teléfono que guardó ese código y su código de alumno puede volver a entrar.';
      if (!confirm('¿Cerrar la sesión de "' + (data.displayName || data.code) + '" en todos los teléfonos?\n\nCada teléfono donde entró deja de recordarlo. Vuelve a entrar con su código y la clave de su nivel. Su progreso no cambia.' + caveat)) return;
      adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/close-sessions', pw, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      }).then((r) => r.json()).then((r) => {
        if (!r.ok) { notify('No se pudo cerrar: ' + (r.error || 'error')); return; }
        notify('✓ Sesión cerrada en todos los teléfonos.');
      }).catch((e) => notify('No se pudo cerrar: ' + e.message));
    });
    // Wire delete — irreversible; double-confirm.
    $('m-detail-delete-btn').addEventListener('click', () => {
      if (!confirm(`PERMANENTLY delete "${data.displayName || data.code}" (${data.code})?\n\nTheir entire history is removed. This CANNOT be undone.`)) return;
      if (!confirm('Last confirmation: are you sure you want to delete this student?')) return;
      adminFetch('/api/admin/students/' + encodeURIComponent(data.code), pw, {
        method: 'DELETE',
      })
        .then((r) => r.json())
        .then((r) => {
          if (!r.ok) { notify('Could not delete: ' + (r.error || 'unknown error')); return; }
          closeDetail();
          notify('✓ ' + (data.displayName || data.code) + ' was deleted.');
          fetchRoster();
        })
        .catch((e) => notify('Could not delete: ' + e.message));
    });
    // 🎓 2026-06-21 (Fernando) — classroom selector: populate with all aulas
    // and file/un-file this student on change. Uses the teacher-managed
    // classroomId (sticks across logins, doesn't touch parent-privacy).
    (function _wireClassroomSelect() {
      const sel = $('m-detail-classroom');
      if (!sel) return;
      adminFetch('/api/admin/classrooms', pw)
        .then((r) => r.json())
        .then((cd) => {
          const list = (cd && cd.classrooms) || [];
          let html = '<option value="">No class</option>';
          list.forEach((c) => {
            html += '<option value="' + escapeHtml(c.id) + '"' + (c.id === data.classroomId ? ' selected' : '') +
              '>' + escapeHtml(c.name) + (c.code ? ' (' + escapeHtml(c.code) + ')' : '') + '</option>';
          });
          sel.innerHTML = html;
        })
        .catch(() => { sel.innerHTML = '<option value="">(could not load the classes)</option>'; });
      sel.addEventListener('change', () => {
        const label = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '';
        adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/classroom', pw, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classroomId: sel.value }),
        }).then((r) => r.json()).then((res) => {
          if (!res || !res.ok) { notify('Could not change the class: ' + (res && res.error || 'unknown error')); return; }
          notify(sel.value ? '✓ Moved to ' + label : '✓ Removed from the class');
        }).catch((e) => notify('Could not change the class: ' + e.message));
      });
    })();
    // Wire rename
    $('m-detail-rename-btn').addEventListener('click', () => {
      const cur = $('m-detail-name').textContent;
      const next = prompt('New name for this student:', cur);
      if (!next || next.trim() === '' || next === cur) return;
      adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/rename', pw, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: next.trim() }),
      })
        .then((r) => r.json())
        .then((r) => {
          if (!r.ok) { notify('Could not rename: ' + (r.error || 'unknown error')); return; }
          $('m-detail-name').textContent = r.displayName;
          notify('✓ Renamed to ' + r.displayName);
        })
        .catch(() => notify('Could not rename. Check the connection and try again.'));
    });
    // Wire send-message: an inline composer (was a prompt() box)
    const compose = $('m-detail-compose');
    const sendBtn = $('m-detail-send-btn');
    const setCompose = (open) => {
      compose.classList.toggle('hidden', !open);
      sendBtn.setAttribute('aria-expanded', String(open));
      if (open) $('m-detail-msg-text').focus();
    };
    sendBtn.addEventListener('click', () => setCompose(compose.classList.contains('hidden')));
    $('m-detail-msg-cancel').addEventListener('click', () => setCompose(false));
    $('m-detail-msg-send').addEventListener('click', () => {
      const text = ($('m-detail-msg-text').value || '').trim();
      if (!text) { notify('Write the message first.'); $('m-detail-msg-text').focus(); return; }
      const go = $('m-detail-msg-send');
      go.disabled = true;
      adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/message', pw, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
        .then((r) => r.json())
        .then((r) => {
          go.disabled = false;
          if (!r.ok) { notify('Could not send: ' + (r.error || 'unknown error')); return; }
          $('m-detail-msg-text').value = '';
          setCompose(false);
          notify('✓ Message sent to ' + (data.displayName || data.code));
        })
        .catch(() => { go.disabled = false; notify('Could not send. Check the connection and try again.'); });
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
      h.textContent = '🏆 HSK Simulations';
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
            '<span class="m-hsk-detail-attempts">' + g.attempts + ' attempt' + (g.attempts === 1 ? '' : 's') + '</span>' +
          '</div>' +
          '<div class="m-hsk-detail-stats">' +
            '<div><span class="m-hsk-detail-label">Best score</span><span class="m-hsk-detail-best">' + g.best + '%</span></div>' +
            '<div><span class="m-hsk-detail-label">Latest attempt</span><span class="m-hsk-detail-last">' + g.latest.percent + '% · ' + new Date(g.latest.ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) + '</span></div>' +
          '</div>';
        body.appendChild(card);
        // Per-attempt list — sorted oldest→newest so "Intento 1, 2,
        // 3…" reads chronologically. The teacher can see if the kid
        // improved or got worse across attempts.
        const chrono = g.all.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
        chrono.forEach((r, i) => {
          const dateStr = new Date(r.ts).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
            '<span class="m-asg-title">Attempt ' + (i + 1) + tag + ' <small class="m-hsk-attempt-toggle">▶ View mistakes</small></span>' +
            '<span class="m-asg-score">' + r.score + '/' + r.total + ' <small>(' + pct + '%)</small></span>' +
            '<span class="m-asg-date">' + dateStr + '</span>' +
            '<button class="m-hsk-attempt-del" type="button" title="Delete this attempt (also disappears from the parent and student dashboard)" data-ts="' + (r.ts || 0) + '" data-code="' + escapeHtml(data.code) + '">🗑</button>';
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
              if (!confirm('Delete this attempt? It will also disappear from the parents\' and student\'s dashboard.')) return;
              adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/hsk-attempt/delete', pw, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ts: r.ts }),
              })
                .then((rr) => rr.json())
                .then((d) => {
                  if (!d || !d.ok) { notify('Could not delete: ' + (d && d.error || 'error')); return; }
                  row.classList.add('is-leaving');
                  mistakeWrap.classList.add('is-leaving');
                  setTimeout(() => { try { row.remove(); mistakeWrap.remove(); } catch (_) {} }, 250);
                })
                .catch((e) => notify('Error: ' + e.message));
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
              if (toggle) toggle.textContent = '▶ View mistakes';
              return;
            }
            mistakeWrap.classList.remove('hidden');
            if (toggle) toggle.textContent = '▼ Hide mistakes';
            if (mistakesLoaded) return;
            mistakesLoaded = true;
            mistakeWrap.innerHTML = '<div class="m-hsk-attempt-loading">Loading…</div>';
            const ts = encodeURIComponent(row.dataset.ts);
            adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/hsk-attempt?ts=' + ts, pw)
              .then((rr) => rr.json())
              .then((d) => {
                if (!d || !d.ok) {
                  mistakeWrap.innerHTML = '<div class="m-hsk-attempt-empty">Could not load: ' + escapeHtml(d && d.error || 'error') + '</div>';
                  return;
                }
                if (!d.wrongQs || !d.wrongQs.length) {
                  mistakeWrap.innerHTML = '<div class="m-hsk-attempt-perfect">🎉 No mistakes on this attempt!</div>';
                  return;
                }
                // Older attempts pre-2026-06-04 won't have wrongQs
                // stored. We can't tell them apart from a perfect
                // score by length alone — but we CAN check: if the
                // kid got 100% AND wrongQs is empty, it's perfect;
                // otherwise if they got <100% AND wrongQs is empty,
                // the data just wasn't captured yet.
                if (d.percent < 100 && !d.wrongQs.length) {
                  mistakeWrap.innerHTML = '<div class="m-hsk-attempt-empty">⚠️ Data not saved for this attempt (before Jun 4, 2026).</div>';
                  return;
                }
                const heading = '<div class="m-hsk-attempt-heading">❌ ' + d.wrongCount + ' wrong question' + (d.wrongCount === 1 ? '' : 's') + '</div>';
                const rows = d.wrongQs.map((wq) => {
                  const ans = (wq.given == null || wq.given === '') ? '<em>(no answer)</em>' : escapeHtml(String(wq.given));
                  const exp = escapeHtml(String(wq.expected));
                  const label = wq.questionLabel ? ' <span class="m-hsk-q-label">· ' + escapeHtml(wq.questionLabel) + '</span>' : '';
                  return '<div class="m-hsk-wrong-row">' +
                    '<span class="m-hsk-wrong-qid">' + escapeHtml(wq.qid) + label + '</span>' +
                    '<span class="m-hsk-wrong-given">Chose: <strong>' + ans + '</strong></span>' +
                    '<span class="m-hsk-wrong-expected">Correct: <strong>' + exp + '</strong></span>' +
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
    // 🏆 La Ruta Dorada (2026-10-16): per level, the seals per world, the El Entrenamiento worlds, El Simulacro Dorado
    if (data.ruta && Array.isArray(data.ruta.levels) && data.ruta.levels.length) {
      const wrap = document.createElement('section');
      wrap.className = 'm-ruta';
      wrap.id = 'm-ruta';
      wrap.setAttribute('aria-labelledby', 'm-ruta-title');
      body.appendChild(wrap);
      renderRuta(wrap, data);
    }
    // Assignments
    if (assigns.length) {
      const h = document.createElement('div');
      h.className = 'm-section-title';
      h.textContent = '📚 Assignments turned in';
      body.appendChild(h);
      assigns.forEach((s) => {
        const pct = s.total ? Math.round((s.score / s.total) * 100) : 0;
        const cls = pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low';
        const dateStr = new Date(s.ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
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
      h.textContent = '🏆 Reading exams';
      body.appendChild(h);
      tests.forEach((t) => {
        const pct = Math.round((t.score / 100) * 100);
        const cls = pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'low';
        const dateStr = new Date(t.ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
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
      h.textContent = '✏️ Sentences built in class';
      body.appendChild(h);
      data.sentences.forEach((s) => {
        const dateStr = new Date(s.ts).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
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
          ? ' · <span class="m-sent-pushed">📤 sent by ' + escapeHtml(s.teacherName || 'teacher') + '</span>'
          : '';
        item.innerHTML = `
          <div class="m-sent-head">
            <span class="m-sent-date">📅 ${dateStr}${s.editedAt ? ' · ✏️ edited' : ''}${pushedBadge}</span>
            <button class="m-sent-edit" type="button" data-ts="${s.ts}" title="Edit this sentence (fix typos, split mashed-together words)">✏️</button>
            <button class="m-sent-del" type="button" data-ts="${s.ts}" title="Delete this sentence">🗑</button>
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
            'Edit the sentence (separate each word with a space):\n\n' +
            'Tip: if two words are stuck together like "wǒshì", split them: "wǒ shì".',
            currentText
          );
          if (next === null) return;            // cancelled
          const cleaned = String(next).trim();
          if (!cleaned) { notify('The sentence cannot be empty.'); return; }
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
          adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/sentence/edit', pw, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ts: s.ts, words: newWords }),
          }).then((r) => r.json()).then((r) => {
            if (!r.ok) { notify('Could not edit: ' + (r.error || 'unknown')); return; }
            // Refresh — quickest path is just to re-render the detail.
            data.sentences = r.sentences || data.sentences;
            renderDetail(data);
          }).catch((e) => notify('Error: ' + e.message));
        });
        // 🗑 Per-row delete — surgical, propagates to kid's Mis oraciones
        // and the parent 0→2000 progress bar (rec.sentencesBuilt.length).
        item.querySelector('.m-sent-del').addEventListener('click', () => {
          if (!confirm('Delete this sentence from ' + dateStr + '?\n\nThe change is reflected in the student\'s My Sentences and in the parents\' panel.')) return;
          adminFetch('/api/admin/student/' + encodeURIComponent(data.code) + '/sentence/delete', pw, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ts: s.ts }),
          }).then((r) => r.json()).then((r) => {
            if (!r.ok) { notify('Could not delete.'); return; }
            item.remove();
            // Update the header count + warn if empty.
            data.sentences = r.sentences || [];
            const meta = document.querySelector('.m-detail-meta');
            if (meta) meta.innerHTML = meta.innerHTML.replace(/📝 \d+ sentences/, '📝 ' + data.sentences.length + ' sentences');
            if (!data.sentences.length) {
              body.querySelector('.m-section-title')?.remove();
            }
          }).catch((e) => notify('Error: ' + e.message));
        });
        body.appendChild(item);
      });
    }
    // (2026-10-16: placed on top instead of replacing the body: it used to wipe the HSK simulations of a kid who had only
    // those, and now La Ruta Dorada, which every kid with a level has)
    const anySeal = !!(data.ruta && data.ruta.levels && data.ruta.levels.some((l) => l.sealed > 0));
    if (!assigns.length && !tests.length && !data.sentences.length && !hskList.length && !anySeal) {
      const empty = document.createElement('div');
      empty.className = 'm-empty';
      empty.textContent = 'This student has no activity yet.';
      body.prepend(empty);
    }
  }

  function renderAvatar(value, size) {
    // saga avatars (WebP), the generic SVGs, and old brand ids shown as their saga replacement (public/js/saga.js)
    // no avatar yet / an old emoji one → Dralingo, never a generic emoji face (only our roster, 2026-10-13)
    const url = window.Saga ? (window.Saga.avatarUrl(value) || window.Saga.avatarUrl('dralingo')) : null;
    if (url) {
      const cls = size === 'large' ? ' m-avatar-img-large' : '';
      return `<img class="m-avatar-img${cls}" src="${escapeHtml(url)}" alt="">`;
    }
    return '<span class="m-avatar-emoji">🐉</span>';
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ════════════════════════════════════════════════════════════════
  // 🧠 SENTENCE PRACTICE — 2026-07-05 (Fernando): same teaching mode
  // as Modo Maestro's "Oraciones 31-40", surfaced on the MAIN dashboard
  // ("I want the simulation sentences explanations to appear here").
  // Data: /api/hsk-sim-practice (teacher-only, answers included).
  // Visual classes (wu-prac-*) are re-set for this page at the end of css/teacher-dashboard.css (warmup.css is no
  // longer loaded here, 2026-10-13); the vocab panel reads WU_WORDS/WU_EXPERIENCES from warmup-vocab.js.
  // ════════════════════════════════════════════════════════════════
  let _pracData = null;
  let _pracLevel = 'hsk1';
  let _pracFamily = null;   // 🆕 2026-10-12 — null = the test-family folders (YCT / New HSK / Old HSK)
  let _pracAudio = null;
  // Minimal play→cache→replay TTS (same /api/tts disk cache the kids use;
  // repeat taps of the same text are served from cache, never re-billed).
  function _speakZh(text, btn) {
    const clean = String(text || '').trim();
    if (!clean) return;
    try { if (_pracAudio) _pracAudio.pause(); } catch (_) {}
    const au = new Audio('/api/tts?text=' + encodeURIComponent(clean));
    _pracAudio = au;
    if (btn) {
      btn.classList.add('speaking');
      const done = () => btn.classList.remove('speaking');
      au.addEventListener('ended', done);
      au.addEventListener('error', done);
    }
    au.play().catch(() => { if (btn) btn.classList.remove('speaking'); });
  }
  const pracBtn = $('m-practice-btn');
  if (pracBtn) pracBtn.addEventListener('click', () => {
    $('m-practice-modal').classList.remove('hidden');
    if (_pracData) { _renderPracSims(); return; }
    $('m-prac-body').textContent = 'Loading…';
    adminFetch('/api/hsk-sim-practice', pw)
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { $('m-prac-body').textContent = 'Could not load the sentences.'; return; }
        _pracData = data;
        const lvls = Object.keys(data.levels || {});
        if (lvls.length && !data.levels[_pracLevel]) _pracLevel = lvls[0];
        _renderPracSims();
      })
      .catch((e) => { $('m-prac-body').textContent = 'Error: ' + e.message; });
  });
  (function bindPracticeShell() {
    const close = $('m-practice-close');
    if (close) close.addEventListener('click', () => {
      $('m-practice-modal').classList.add('hidden');
      try { if (_pracAudio) _pracAudio.pause(); } catch (_) {}
    });
    const vb = $('m-prac-vocab-btn');
    if (vb) vb.addEventListener('click', () => {
      const panel = $('m-prac-vocab');
      if (!panel) return;
      const opening = panel.style.display === 'none';
      panel.style.display = opening ? '' : 'none';
      vb.textContent = opening ? '📚 Hide vocabulary' : '📚 Vocabulary';
      if (opening && !panel.dataset.built) {
        panel.dataset.built = '1';
        _buildPracVocab(panel);
      }
    });
    // 🌐 ES ↔ EN — flips sentence meanings AND vocab cards.
    const lb = $('m-prac-lang');
    if (lb) lb.addEventListener('click', () => {
      _pracVocabLang = _pracVocabLang === 'es' ? 'en' : 'es';
      lb.textContent = _pracVocabLang === 'es' ? '🌐 Meanings: ES' : '🌐 Meanings: EN';
      const vp = $('m-prac-vocab');
      if (vp && vp.dataset.built) _buildPracVocab(vp);
      if (_pracView && $('m-prac-crumb').style.display !== 'none') _renderPracDetail(_pracView.list, _pracView.heading);
    });
  })();
  // 🆕 2026-10-12 — folders like Official Tests: test family → level → sims
  function _pracFamilies() {
    if (Array.isArray(_pracData.families)) return _pracData.families.filter((f) => f.levels.length);
    const lv = _pracData.levels || {};   // older server: one family with every level
    return [{ id: 'oldhsk', name: 'HSK', emoji: '📘', levels: Object.keys(lv).map((l) => ({ id: l, name: l.toUpperCase(), sims: lv[l] })) }];
  }
  function _pracCount(sims) {
    return sims.reduce((n, s) => n + ((s.part3 && s.part3.questions.length) || 0) + ((s.part4 && s.part4.questions.length) || 0), 0);
  }
  function _pracRange(s) {
    const nums = [s.part3, s.part4].filter(Boolean).flatMap((p) => p.questions.map((q) => q.num));
    return nums.length ? Math.min(...nums) + '–' + Math.max(...nums) : '';
  }
  function _renderPracFamilies(wrap) {
    $('m-prac-title').textContent = '🧠 Sentence practice';
    $('m-prac-sub').textContent = 'Pick the exam: the sentences of its simulations with the real word bank.';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;';
    _pracFamilies().forEach((f) => {
      const sims = f.levels.flatMap((l) => l.sims);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'wu-prac-simcard';
      card.innerHTML = '<div class="wu-prac-simemoji">' + escapeHtml(f.emoji || '📁') + '</div><div class="wu-prac-simname">' + escapeHtml(f.name) + '</div>'
        + '<div class="wu-prac-simmeta">' + f.levels.map((l) => escapeHtml(l.name)).join(' · ') + ' · ' + sims.length + ' sims · ' + _pracCount(sims) + ' sentences</div>';
      card.addEventListener('click', () => { _pracFamily = f.id; _pracLevel = f.levels[0].id; _renderPracSims(); });
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  }
  function _renderPracSims() {
    const wrap = $('m-prac-body');
    if (!wrap || !_pracData) return;
    $('m-prac-crumb').style.display = 'none';
    wrap.innerHTML = '';
    const fam = _pracFamily && _pracFamilies().find((f) => f.id === _pracFamily);
    if (!fam) { _pracFamily = null; _renderPracFamilies(wrap); return; }
    const lvl = fam.levels.find((l) => l.id === _pracLevel) || fam.levels[0];
    _pracLevel = lvl.id;
    const sims = lvl.sims || [];
    $('m-prac-title').textContent = '🧠 Sentence practice · ' + lvl.name;
    $('m-prac-sub').textContent = 'Pick a simulation. Analyze each question with the real exam bank: eliminate the wrong options until only the answer makes sense.';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px;';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn-ghost btn-sm';
    back.textContent = '← Exams';
    back.addEventListener('click', () => { _pracFamily = null; _renderPracSims(); });
    bar.appendChild(back);
    if (fam.levels.length > 1) {
      fam.levels.forEach((l) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm ' + (l.id === _pracLevel ? 'btn-gold' : 'btn-ghost');
        b.textContent = l.name;
        b.addEventListener('click', () => { _pracLevel = l.id; _renderPracSims(); });
        bar.appendChild(b);
      });
    }
    wrap.appendChild(bar);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;';
    const allCard = document.createElement('button');
    allCard.type = 'button';
    allCard.className = 'wu-prac-simcard is-all';
    allCard.innerHTML = '<div class="wu-prac-simemoji">🌊</div><div class="wu-prac-simname">All in order</div><div class="wu-prac-simmeta">' + _pracCount(sims) + ' sentences · Sim 1 → ' + sims.length + '</div>';
    allCard.addEventListener('click', () => _renderPracDetail(sims, lvl.name + ' · All simulations'));
    grid.appendChild(allCard);
    sims.forEach((s) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'wu-prac-simcard';
      card.innerHTML = '<div class="wu-prac-simemoji">📖</div><div class="wu-prac-simname">' + escapeHtml(s.title) + '</div><div class="wu-prac-simmeta">' + _pracCount([s]) + ' sentences · ' + _pracRange(s) + '</div>';
      card.addEventListener('click', () => _renderPracDetail([s], s.title));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  }
  // 🔤 Word-level lookup: any pinyin token in a sim sentence → its
  // WU_WORDS entry (tone-insensitive) → tap opens the Curious-mode card.
  let _pracWuIndex = null;
  function _pracNorm(t) {
    return String(t || '').toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  }
  function _pracFindWuWord(token) {
    if (!_pracWuIndex) {
      _pracWuIndex = new Map();
      (window.WU_WORDS || []).forEach((w) => {
        const k = _pracNorm(w.pinyin);
        if (k && !_pracWuIndex.has(k)) _pracWuIndex.set(k, w);
      });
    }
    const k = _pracNorm(token);
    return k ? (_pracWuIndex.get(k) || null) : null;
  }
  function _pracSentenceHtml(pinyin) {
    return String(pinyin || '').split(/\s+/).map((tok) => {
      const w = _pracFindWuWord(tok);
      return w
        ? '<button type="button" class="wu-prac-w" data-wid="' + escapeHtml(w.id) + '">' + escapeHtml(tok) + '</button>'
        : '<span>' + escapeHtml(tok) + '</span>';
    }).join(' ');
  }
  function _bindPracWordTaps(root) {
    root.querySelectorAll('.wu-prac-w').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const w = (window.WU_WORDS || []).find((x) => x.id === b.dataset.wid);
      if (w) _pracShowWordCard(w);
    }));
  }
  let _pracView = null;   // remembered so the 🌐 toggle can re-render
  function _renderPracDetail(simList, heading) {
    _pracView = { list: simList, heading };
    const wrap = $('m-prac-body');
    if (!wrap) return;
    const crumb = $('m-prac-crumb');
    crumb.style.display = '';
    crumb.onclick = _renderPracSims;
    $('m-prac-title').textContent = '🧠 ' + heading;
    $('m-prac-sub').textContent = 'Tap 🔍 Analyze on a question: eliminate the wrong options one by one until only the answer makes sense.';
    wrap.innerHTML = '';
    simList.forEach((sim) => {
      if (simList.length > 1) {
        const h = document.createElement('div');
        h.className = 'wu-prac-simhead';
        h.textContent = '📖 ' + sim.title;
        wrap.appendChild(h);
      }
      [sim.part3, sim.part4].forEach((part) => {
        if (!part) return;
        wrap.appendChild(_buildPracPart(part));
      });
    });
  }
  function _buildPracPart(part) {
    const sec = document.createElement('section');
    sec.className = 'wu-prac-part';
    const exLetter = part.example ? part.example.answer : null;
    let head = '<div class="wu-prac-parttitle">' + escapeHtml(part.title) + '</div>' +
      '<div class="wu-prac-instr">' + escapeHtml(part.instruction) + '</div>';
    if (part.example) {
      head += '<div class="wu-prac-example">📌 Example (already solved): <b class="wu-prac-zh">' + escapeHtml(part.example.pinyin) + '</b> <span class="wu-prac-hanzi">' + escapeHtml(part.example.hanzi) + '</span> → <b class="wu-prac-ans">' + escapeHtml(String(exLetter)) + '</b></div>';
    }
    sec.innerHTML = head;
    (part.questions || []).forEach((q) => {
      sec.appendChild(_buildPracQ(q, part.bank || [], exLetter));
    });
    return sec;
  }
  function _buildPracQ(q, bank, exLetter) {
    const card = document.createElement('div');
    card.className = 'wu-prac-q';
    // Meaning in parentheses under the sentence — ES ↔ EN via 🌐 toggle
    const meaning = _pracVocabLang === 'en' ? (q.en || q.es) : (q.es || q.en);
    card.innerHTML =
      '<div class="wu-prac-qrow">' +
        '<span class="wu-prac-qnum">' + q.num + '</span>' +
        '<span class="wu-prac-qtext"><b class="wu-prac-zh">' + _pracSentenceHtml(q.pinyin) + '</b> <span class="wu-prac-hanzi">' + escapeHtml(q.hanzi) + '</span></span>' +
        '<button class="btn btn-ghost btn-sm wu-prac-speak" type="button">🔊</button>' +
        '<button class="btn btn-gold btn-sm wu-prac-toggle" type="button">🔍 Analyze</button>' +
      '</div>' +
      (meaning ? '<div class="wu-prac-qmeaning">（ ' + escapeHtml(meaning) + ' ）</div>' : '') +
      '<div class="wu-prac-analysis" style="display:none;"></div>';
    _bindPracWordTaps(card);
    // 🔊 speaks HANZI, not pinyin — the Mandarin voice reads Latin pinyin
    // letter-by-letter for words outside its converter dictionary.
    card.querySelector('.wu-prac-speak').addEventListener('click', (e) => {
      _speakZh(q.hanzi || q.pinyin, e.currentTarget);
    });
    const toggle = card.querySelector('.wu-prac-toggle');
    const panel = card.querySelector('.wu-prac-analysis');
    let built = false;
    toggle.addEventListener('click', () => {
      const opening = panel.style.display === 'none';
      panel.style.display = opening ? '' : 'none';
      toggle.textContent = opening ? '▲ Close' : '🔍 Analyze';
      if (opening && !built) { built = true; _buildPracAnalysis(panel, q, bank, exLetter); }
    });
    return card;
  }
  function _buildPracAnalysis(panel, q, bank, exLetter) {
    const hint = document.createElement('div');
    hint.className = 'wu-prac-hint';
    const HINT0 = '👆 Analyze each option: tap the ones that do NOT make sense to eliminate them.';
    hint.textContent = HINT0;
    panel.appendChild(hint);
    const grid = document.createElement('div');
    grid.className = 'wu-prac-bank';
    let solved = false;
    bank.forEach((opt) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'wu-prac-opt';
      const isExample = exLetter != null && opt.letter === exLetter;
      chip.innerHTML =
        '<span class="wu-prac-optletter">' + escapeHtml(opt.letter) + '</span>' +
        '<span class="wu-prac-optpinyin">' + escapeHtml(opt.pinyin) + '</span>' +
        '<span class="wu-prac-opthanzi">' + escapeHtml(opt.hanzi) + '</span>' +
        (isExample ? '<span class="wu-prac-extag">example</span>' : '');
      if (isExample) chip.classList.add('is-eliminated', 'is-example');
      chip.addEventListener('click', () => {
        if (solved || chip.classList.contains('is-eliminated')) {
          _speakZh(opt.hanzi || opt.pinyin, null);
          return;
        }
        _speakZh(opt.hanzi || opt.pinyin, null);
        if (opt.letter === q.answer) {
          solved = true;
          chip.classList.add('is-correct');
          grid.querySelectorAll('.wu-prac-opt').forEach((c) => {
            if (c !== chip && !c.classList.contains('is-eliminated')) c.classList.add('is-eliminated');
          });
          hint.textContent = '✅ ' + q.answer + '! No other option makes sense here.';
        } else {
          chip.classList.add('is-eliminated');
          const left = grid.querySelectorAll('.wu-prac-opt:not(.is-eliminated)').length;
          hint.textContent = '❌ Eliminated. ' + left + ' options left…';
        }
      });
      grid.appendChild(chip);
    });
    panel.appendChild(grid);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'btn btn-ghost btn-sm';
    reset.style.marginTop = '8px';
    reset.textContent = '↺ Reset analysis';
    reset.addEventListener('click', () => {
      solved = false;
      grid.querySelectorAll('.wu-prac-opt').forEach((c) => {
        c.classList.remove('is-correct');
        if (!c.classList.contains('is-example')) c.classList.remove('is-eliminated');
      });
      hint.textContent = HINT0;
    });
    panel.appendChild(reset);
  }
  // 🔍 "Curious mode" cards in practice — 2026-07-06 (Fernando): tap a
  // word → big card (HUGE icon — pictures teach), pinyin, meaning in
  // parentheses, 🔊. NO hanzi (hidden via CSS). ES ↔ EN toggle.
  let _pracVocabLang = 'es';
  function _pracMeaning(w) {
    return (_pracVocabLang === 'en' && w.en) ? w.en : (w.es || w.en || '');
  }
  function _pracShowWordCard(w) {
    const old = document.querySelector('.wu-prac-cardwrap');
    if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'wu-prac-cardwrap';
    wrap.innerHTML =
      '<div class="wu-prac-card">' +
        '<div class="wu-prac-card-icon">' + escapeHtml(w.icon || '✨') + '</div>' +
        '<div class="wu-prac-card-pinyin">' + escapeHtml(w.pinyin) + '</div>' +
        '<div class="wu-prac-card-meaning">（ ' + escapeHtml(_pracMeaning(w)) + ' ）</div>' +
        '<button type="button" class="wu-prac-card-speak">🔊 Listen</button>' +
        '<div class="wu-prac-card-hint">Tap outside to close</div>' +
      '</div>';
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
    wrap.querySelector('.wu-prac-card-speak').addEventListener('click', (e) => {
      e.stopPropagation();
      _speakZh(w.pinyin, e.currentTarget);
    });
    document.body.appendChild(wrap);
    // Hear it immediately — tap-to-open IS the first listen.
    _speakZh(w.pinyin, wrap.querySelector('.wu-prac-card-speak'));
  }
  function _buildPracVocab(panel) {
    if (!window.WU_WORDS || !window.WU_EXPERIENCES) { panel.textContent = 'Vocabulary not available.'; return; }
    panel.innerHTML = '';
    // ES ↔ EN meaning toggle
    const langBar = document.createElement('div');
    langBar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
    const langBtn = document.createElement('button');
    langBtn.type = 'button';
    langBtn.className = 'btn btn-ghost btn-sm';
    langBtn.textContent = _pracVocabLang === 'es' ? '🌐 Meaning: Español (tap for English)' : '🌐 Meaning: English (tap for Español)';
    langBtn.addEventListener('click', () => {
      _pracVocabLang = _pracVocabLang === 'es' ? 'en' : 'es';
      _buildPracVocab(panel);   // re-render with the other language
      // keep the toolbar toggle and the open questions in step (they drifted apart before 2026-10-13)
      const lb = $('m-prac-lang');
      if (lb) lb.textContent = _pracVocabLang === 'es' ? '🌐 Meanings: ES' : '🌐 Meanings: EN';
      if (_pracView && $('m-prac-crumb').style.display !== 'none') _renderPracDetail(_pracView.list, _pracView.heading);
    });
    langBar.appendChild(langBtn);
    panel.appendChild(langBar);
    const byExp = {};
    window.WU_WORDS.forEach((w) => { (byExp[w.exp] = byExp[w.exp] || []).push(w); });
    Object.keys(window.WU_EXPERIENCES).forEach((expKey) => {
      const meta = window.WU_EXPERIENCES[expKey];
      const words = byExp[expKey] || [];
      if (!words.length) return;
      const det = document.createElement('details');
      det.className = 'wu-prac-vocabexp';
      det.innerHTML = '<summary>' + escapeHtml(meta.short || expKey.toUpperCase()) + ' · ' + escapeHtml(meta.label || '') + ' <small>' + words.length + '</small></summary>';
      const grid = document.createElement('div');
      grid.className = 'wu-prac-vocabgrid';
      words.forEach((w) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'wu-prac-vocabchip';
        chip.innerHTML = '<span class="wu-prac-vicon">' + escapeHtml(w.icon || '✨') + '</span><b>' + escapeHtml(w.pinyin) + '</b><small>（' + escapeHtml(_pracMeaning(w)) + '）</small>';
        chip.title = 'Tap to see the card';
        chip.addEventListener('click', () => _pracShowWordCard(w));
        grid.appendChild(chip);
      });
      det.appendChild(grid);
      panel.appendChild(det);
    });
  }

  // Auto-login if we have a saved password. 2026-10-13: the dashboard shows at once with its loading skeleton (the
  // sign-in card used to flash first) and gets the teacher identity right away (the Teachers tab and My Gateway
  // used to appear only after the first 15 s refresh).
  if (pw) {
    showDashboard();
    _rosterInFlight = true;
    _studentsRequest(pw)
      .then(({ status, data }) => {
        _rosterInFlight = false;
        if (data && data.ok) {
          renderRoster(data.students || [], data.self || null, data.archived);
          return;
        }
        if (status === 401 || status === 403) {
          // the saved code no longer works: back to the sign-in card
          try { localStorage.removeItem(STORAGE_PW); } catch (_) {}
          pw = '';
          $('m-dash').classList.add('hidden');
          $('m-login').classList.remove('hidden');
          $('m-pw').value = '';
          $('m-login-err').textContent = 'Your saved teacher code no longer works. Type it again.';
          return;
        }
        // 429 (lockout after wrong codes on this network) or a server hiccup: keep the code, the 15 s refresh retries
        _rosterProblem(status === 429 ? 'busy' : 'network');
      })
      .catch(() => { _rosterInFlight = false; _rosterProblem('network'); });
  }
  // Back from a game page through the browser's back button: reload, so no button stays in its «Opening…» state
  // and the list is current.
  window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
})();
