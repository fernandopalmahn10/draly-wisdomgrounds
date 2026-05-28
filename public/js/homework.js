// 📚 Homework Portal — async assignments, no PIN needed.
// Student enters: access code (one of 5 the teacher hands out) + their
// student code (4 chars, persists in localStorage). All submissions
// auto-graded server-side; results saved to their student record so the
// teacher sees who did what via the existing Cuaderno de Alumnos.
//
// 2026-05-27 overhaul:
//   - Full-body SVG avatars (12 kids, DiceBear adventurer set, local)
//   - Settings screen: rename, swap avatar, reset assignment scores
//   - Catalog organized by EXP1-EXP8 tabs (matches warmup UI)
//   - Tap feedback + Undo button on the assignment stage
//   - Student code hidden from main list — only revealed inside Settings
//     (it's a "secret" the kid shares with parents, not main UI noise)
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORAGE_CODE_KEY = 'dralyStudentCode';
  const STORAGE_ACCESS_KEY = 'dralyHwAccessCode';

  // Returns the URL for a stored avatar value. Avatars are stored as a
  // simple lowercase filename ('mochi', 'dragon', etc.). Legacy emoji
  // values fall back gracefully — we just show the emoji in a span.
  const AVATAR_LABELS = {
    // Cartoon kids (adventurer style)
    mochi:  'Mochi',  dragon: 'Drago',  stella: 'Stella', felix:  'Félix',
    luna:   'Luna',   atlas:  'Atlas',  zara:   'Zara',   kai:    'Kai',
    mei:    'Méi',    theo:   'Teo',    iris:   'Iris',   nova:   'Nova',
    // Crazy variations — user feedback 2026-05-27 "like the emojis you
    // had before, but cooler. Monkeys, aliens, funny hair."
    robo:   '🤖 Robo',   cyborg: '🦾 Ciborg',  alien:  '👽 Alien',  blob:   '🟢 Blob',
    monkey: '🐵 Mono',   ghost:  '👻 Fantasma', pixie:  '🧚 Hada',   wizard: '🧙 Mago',
    pixel:  '👾 Pixel',  punky:  '🎸 Punky',    panda:  '🐼 Panda',  ninja:  '🥷 Ninja',
    // 2026-05-28 — wider variety (more heroes, beasts & robots).
    tiger:  '🐯 Tigre',  phoenix:'🔥 Fénix',   knight: '🛡 Caballero', mecha: '🤖 Mecha',
    yeti:   '❄️ Yeti',   fox:    '🦊 Zorro',   owl:    '🦉 Búho',    shark:  '🦈 Tiburón',
    viking: '⚔️ Vikingo', galaxy: '🌌 Galaxia', comet:  '☄️ Cometa',  boba:   '🧋 Boba',
    lotus:  '🪷 Loto',   ramen:  '🍜 Ramen',   koala:  '🐨 Koala',   raptor: '🦖 Raptor',
  };
  // ?v bumped whenever the avatar ART is regenerated (same filenames, new
  // look) so browsers don't serve the stale cached SVG. 2026-05-28: fresh
  // cooler DiceBear set.
  const AVATAR_ASSET_VER = '20260528b';
  function avatarSrc(name) {
    return '/assets/avatars/' + encodeURIComponent(name) + '.svg?v=' + AVATAR_ASSET_VER;
  }
  function isSvgAvatar(v) {
    return typeof v === 'string' && /^[a-z]+$/.test(v) && AVATAR_LABELS[v];
  }
  // Drop avatar visuals into a host element. Accepts either an SVG name
  // ('mochi') or a legacy emoji string ('🧒🏼'). For SVGs we use <img>.
  function renderAvatarInto(el, value, opts) {
    if (!el) return;
    el.innerHTML = '';
    el.classList.remove('is-emoji', 'is-svg');
    if (isSvgAvatar(value)) {
      el.classList.add('is-svg');
      const img = document.createElement('img');
      img.src = avatarSrc(value);
      img.alt = AVATAR_LABELS[value] || value;
      img.draggable = false;
      el.appendChild(img);
    } else {
      el.classList.add('is-emoji');
      const span = document.createElement('span');
      span.className = 'hw-avatar-emoji-fallback';
      span.textContent = value || '🧒🏼';
      el.appendChild(span);
    }
  }

  let accessCode = '';
  let studentCode = '';
  let displayName = '';
  let avatar = null;
  let avatarOptions = [];
  let assignments = [];        // summary list
  let submissions = [];        // student's prior submissions
  let readingTests = [];       // [{ storyId, title, subtitle, coverImage, available, bestScore, attempts }]
  let currentReadingStory = null;  // loaded story when on the reading screen
  let currentReadingAnswers = []; // [questionIdx → choiceIdx]
  let readingLangMode = 'pinyin';  // 'pinyin' | 'both' | 'es'
  let currentAssignment = null;  // full body when an item is open
  let currentAnswers = [];     // string per item — arrays of word IDs joined by space, or freeform
  let activeExpTab = 'all';    // catalog filter: 'all' or 'exp1'..'exp8'
  let librarySearch = '';      // catalog search string (already normalized)
  // Tone-stripping normalizer — matches server-side grading semantics.
  // Lowercase + NFD decompose + drop combining diacritics + trim.
  // So "ni hao" matches both "nǐ hǎo" and "Nǐ Hǎo".
  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[.,!?;:'"()¿¡]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Per-item undo stack: undoStacks[itemIdx] = [snapshot1, snapshot2, …]
  // Each snapshot is the answer string BEFORE the change. So pressing
  // Deshacer once restores the previous state.
  let undoStacks = [];

  // Best-effort device + country fingerprint, sent on entry. We can't read
  // the IP behind Render's proxy, so we derive from the browser: a coarse
  // device label (phone / tablet / computer + OS), the locale, and the IANA
  // timezone — from which we guess a country code. Lets the teacher spot
  // duplicate accounts and ban a device from the Cuaderno.
  function collectDeviceMeta() {
    const ua = navigator.userAgent || '';
    let device = 'Computadora';
    if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) device = 'Tablet';
    else if (/Mobi|iPhone|Android.*Mobile|Windows Phone/i.test(ua)) device = 'Teléfono';
    let os = '';
    if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac OS X/i.test(ua)) os = 'Mac';
    else if (/Linux/i.test(ua)) os = 'Linux';
    const locale = (navigator.language || (navigator.languages && navigator.languages[0]) || '').slice(0, 12);
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
    return {
      device: (device + (os ? ' · ' + os : '')).slice(0, 60),
      locale,
      tz: tz.slice(0, 48),
      country: guessCountry(locale, tz),
    };
  }
  // Coarse country guess from locale region or timezone city. Best-effort,
  // never authoritative — just a hint for the teacher.
  function guessCountry(locale, tz) {
    const m = /[-_]([A-Za-z]{2})$/.exec(locale || '');
    if (m) return m[1].toUpperCase();
    const TZ_COUNTRY = {
      'Mexico_City': 'MX', 'Tijuana': 'MX', 'Monterrey': 'MX',
      'Shanghai': 'CN', 'Chongqing': 'CN', 'Urumqi': 'CN', 'Hong_Kong': 'HK',
      'Taipei': 'TW', 'Macau': 'MO', 'Singapore': 'SG',
      'Bogota': 'CO', 'Lima': 'PE', 'Buenos_Aires': 'AR', 'Santiago': 'CL',
      'Madrid': 'ES', 'New_York': 'US', 'Los_Angeles': 'US', 'Chicago': 'US',
    };
    const city = String(tz || '').split('/').pop();
    return TZ_COUNTRY[city] || (city ? city.replace(/_/g, ' ') : null);
  }

  // ── Pre-fill remembered values
  try {
    const savedAccess = localStorage.getItem(STORAGE_ACCESS_KEY) || '';
    const savedCode = localStorage.getItem(STORAGE_CODE_KEY) || '';
    if (savedAccess) $('hw-access-code').value = savedAccess;
    if (savedCode) $('hw-student-code').value = savedCode;
  } catch (_) {}

  // ── Entry screen
  $('hw-enter-btn').addEventListener('click', tryEnter);
  $('hw-access-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('hw-student-code').focus(); });
  $('hw-student-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryEnter(); });

  function tryEnter() {
    const ac = $('hw-access-code').value.trim();
    const sc = $('hw-student-code').value.trim();
    if (!ac) { $('hw-entry-err').textContent = 'Ingresa el código de acceso'; return; }
    $('hw-entry-err').textContent = 'Entrando…';
    const looksLikeCode = /^[A-Z2-9]{4,5}$/i.test(sc);
    const payload = {
      accessCode: ac,
      studentCode: looksLikeCode ? sc.toUpperCase() : null,
      displayName: looksLikeCode ? null : (sc || 'Anon'),
      meta: collectDeviceMeta(),
    };
    fetch('/api/homework/enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          $('hw-entry-err').textContent = data && data.error ? data.error : 'No se pudo entrar';
          return;
        }
        accessCode = ac;
        studentCode = data.studentCode;
        displayName = data.displayName;
        avatar = data.avatar || null;
        avatarOptions = data.avatarOptions || [];
        assignments = data.assignments || [];
        submissions = data.submissions || [];
        try {
          localStorage.setItem(STORAGE_ACCESS_KEY, ac);
          localStorage.setItem(STORAGE_CODE_KEY, studentCode);
        } catch (_) {}
        // First-time joiners pick an avatar before seeing the list
        if (!avatar) {
          showAvatarPicker();
        } else {
          renderList();
          showScreen('list');
        }
        // Start inbox polling — every 20s while the kid is logged in.
        // Pulls down any messages the teacher sent.
        fetchInbox();
        if (!window._inboxTimer) {
          window._inboxTimer = setInterval(() => {
            if (document.hidden) return;
            fetchInbox();
          }, 20000);
        }
      })
      .catch((e) => {
        $('hw-entry-err').textContent = 'Error de conexión: ' + e.message;
      });
  }

  // === INBOX (messages from teacher) ===
  // Poll every 20s while on the list screen. Updates the 🔔 badge.
  // Opens a modal showing message history when the bell is tapped.
  let _inbox = [];
  let _inboxUnread = 0;
  function fetchInbox() {
    if (!studentCode || !accessCode) return;
    fetch('/api/homework/inbox?accessCode=' + encodeURIComponent(accessCode)
        + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) return;
        const prevUnread = _inboxUnread;
        _inbox = data.inbox || [];
        _inboxUnread = data.unread || 0;
        renderBellBadge();
        // FORCE messages: the teacher pushed everyone into a live session.
        // Find the newest unread 'force' message and obey it immediately —
        // no toast, no button, just redirect. Mark it read first so we
        // don't loop if the kid navigates back.
        const force = _inbox.find((m) => !m.readAt && m.actionType === 'force' && m.actionUrl);
        if (force) {
          fetch('/api/homework/inbox/' + encodeURIComponent(force.id) + '/read?accessCode=' + encodeURIComponent(accessCode), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentCode }),
          }).finally(() => {
            // Brief on-screen notice so the kid isn't startled, then go
            _showForceTakeover(force);
          });
          return;
        }
        // Normal unread → surface a toast
        if (_inboxUnread > prevUnread && prevUnread >= 0) {
          showInboxToast(_inbox[0]);
        }
      }).catch(() => {});
  }
  // Full-screen takeover when the teacher force-pushes a live session.
  // Shows a 2-second "tu maestra te llama" splash, then hard-redirects.
  // The kid cannot dismiss it — it's an obligation.
  function _showForceTakeover(msg) {
    if (document.getElementById('hw-force-takeover')) return;  // already going
    const ov = document.createElement('div');
    ov.id = 'hw-force-takeover';
    ov.className = 'hw-force-takeover';
    ov.innerHTML = `
      <div class="hw-force-card">
        <div class="hw-force-dragon">🐉</div>
        <div class="hw-force-title">¡Tu maestra te llama!</div>
        <div class="hw-force-text">${escapeHtml(msg.text || '¡Únete a la sesión en vivo ahora!')}</div>
        <div class="hw-force-spinner">Entrando…</div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
    // Personalize the redirect: the live-master force URL only carries the
    // PIN (the teacher doesn't know each kid's name). We splice in THIS
    // kid's name (+ avatar) so /player.html auto-joins without making them
    // type anything — that's the whole point of "force, no PIN".
    let dest = msg.actionUrl;
    try {
      const u = new URL(msg.actionUrl, location.origin);
      if (!u.searchParams.get('name') && displayName) u.searchParams.set('name', displayName);
      dest = u.pathname + u.search;
    } catch (_) { /* keep original */ }
    setTimeout(() => { window.location.href = dest; }, 2200);
  }

  function renderBellBadge() {
    const badge = $('hw-bell-badge');
    if (!badge) return;
    if (_inboxUnread > 0) {
      badge.textContent = _inboxUnread > 9 ? '9+' : String(_inboxUnread);
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
  function showInboxToast(msg) {
    if (!msg) return;
    const toast = document.createElement('div');
    toast.className = 'hw-inbox-toast';
    toast.innerHTML = `
      <span class="hw-inbox-toast-icon">📩</span>
      <div class="hw-inbox-toast-body">
        <div class="hw-inbox-toast-from">${escapeHtml(msg.fromName || 'Maestra')}</div>
        <div class="hw-inbox-toast-text">${escapeHtml(msg.text || '').slice(0, 80)}</div>
      </div>`;
    toast.addEventListener('click', () => {
      openInbox();
      toast.remove();
    });
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
  function openInbox() {
    let overlay = document.getElementById('hw-inbox-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hw-inbox-overlay';
      overlay.className = 'hw-inbox-overlay';
      overlay.innerHTML = `
        <div class="hw-inbox-card">
          <button class="hw-inbox-close" id="hw-inbox-close" aria-label="Cerrar">✕</button>
          <h2 class="hw-inbox-title">📩 Mensajes de mi maestra</h2>
          <div class="hw-inbox-list" id="hw-inbox-list"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeInbox(); });
      overlay.querySelector('#hw-inbox-close').addEventListener('click', closeInbox);
    }
    renderInboxList();
    requestAnimationFrame(() => overlay.classList.add('show'));
    // Mark everything read on the server
    fetch('/api/homework/inbox/read-all?accessCode=' + encodeURIComponent(accessCode), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCode }),
    }).then(() => {
      _inboxUnread = 0;
      renderBellBadge();
    });
  }
  function closeInbox() {
    const overlay = document.getElementById('hw-inbox-overlay');
    if (overlay) overlay.classList.remove('show');
  }
  function renderInboxList() {
    const list = $('hw-inbox-list');
    if (!list) return;
    if (!_inbox.length) {
      list.innerHTML = '<div class="hw-inbox-empty">Aún no tienes mensajes. Cuando tu maestra te envíe uno, aparecerá aquí.</div>';
      return;
    }
    list.innerHTML = '';
    _inbox.forEach((m) => {
      const row = document.createElement('div');
      row.className = 'hw-inbox-msg' + (m.readAt ? '' : ' unread');
      const when = new Date(m.ts).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const actionHtml = m.actionUrl
        ? `<a class="btn btn-jade hw-inbox-action" href="${escapeHtml(m.actionUrl)}">${escapeHtml(m.actionLabel || 'Abrir')}</a>`
        : '';
      row.innerHTML = `
        <div class="hw-inbox-msg-head">
          <span class="hw-inbox-msg-from">👩‍🏫 ${escapeHtml(m.fromName || 'Maestra')}</span>
          <span class="hw-inbox-msg-time">${escapeHtml(when)}</span>
        </div>
        <div class="hw-inbox-msg-text">${escapeHtml(m.text || '')}</div>
        ${actionHtml}
        ${m.broadcast ? '<span class="hw-inbox-msg-tag">📢 a toda la clase</span>' : ''}`;
      list.appendChild(row);
    });
  }
  $('hw-list-inbox').addEventListener('click', openInbox);

  $('hw-list-logout').addEventListener('click', () => {
    accessCode = '';
    studentCode = '';
    showScreen('entry');
  });
  $('hw-list-parents').addEventListener('click', openParentView);
  $('hw-list-settings').addEventListener('click', openSettings);

  // === Avatar picker (first-time entry) ===
  function showAvatarPicker() {
    $('hw-avatar-pick-name').textContent = displayName || 'amigo';
    const grid = $('hw-avatar-grid');
    grid.innerHTML = '';
    avatarOptions.forEach((name) => {
      grid.appendChild(buildAvatarOption(name, (picked) => {
        $('hw-avatar-err').textContent = 'Guardando…';
        saveAvatar(picked).then((ok) => {
          if (!ok) return;
          $('hw-avatar-err').textContent = '';
          renderList();
          showScreen('list');
        }).catch((e) => {
          $('hw-avatar-err').textContent = 'Error: ' + e.message;
        });
      }));
    });
    showScreen('avatar');
  }
  function buildAvatarOption(name, onPick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hw-avatar-option';
    btn.dataset.name = name;
    btn.innerHTML = `
      <div class="hw-avatar-option-img"><img src="${avatarSrc(name)}" alt="${AVATAR_LABELS[name] || name}" draggable="false"></div>
      <div class="hw-avatar-option-label">${AVATAR_LABELS[name] || name}</div>`;
    btn.addEventListener('click', () => onPick(name));
    return btn;
  }
  // Promise-returning helper used by both first-time picker + settings.
  function saveAvatar(name) {
    return fetch('/api/homework/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode, studentCode, avatar: name }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          alert('No se pudo guardar el avatar: ' + (data && data.error || ''));
          return false;
        }
        avatar = name;
        return true;
      });
  }

  // === Settings screen ===
  $('hw-settings-back').addEventListener('click', () => {
    renderList();
    showScreen('list');
  });
  function openSettings() {
    renderSettings();
    showScreen('settings');
  }
  function renderSettings() {
    $('hw-settings-name').textContent = displayName || 'Anon';
    $('hw-settings-code').textContent = studentCode;
    renderAvatarInto($('hw-settings-avatar'), avatar);
    $('hw-settings-name-input').value = displayName || '';
    $('hw-settings-name-msg').textContent = '';
    $('hw-settings-avatar-msg').textContent = '';
    $('hw-settings-reset-msg').textContent = '';
    // Build the change-avatar grid
    const grid = $('hw-settings-avatar-grid');
    grid.innerHTML = '';
    avatarOptions.forEach((name) => {
      const opt = buildAvatarOption(name, (picked) => {
        $('hw-settings-avatar-msg').textContent = 'Guardando…';
        saveAvatar(picked).then((ok) => {
          if (!ok) { $('hw-settings-avatar-msg').textContent = ''; return; }
          renderAvatarInto($('hw-settings-avatar'), avatar);
          // Mark the picked one as selected in the grid
          grid.querySelectorAll('.hw-avatar-option').forEach((b) => {
            b.classList.toggle('selected', b.dataset.name === picked);
          });
          $('hw-settings-avatar-msg').textContent = '✓ Avatar cambiado';
        });
      });
      if (name === avatar) opt.classList.add('selected');
      grid.appendChild(opt);
    });
    // Build the reset-score list
    const resetList = $('hw-settings-reset-list');
    resetList.innerHTML = '';
    if (!submissions.length) {
      resetList.innerHTML = '<div class="hw-settings-reset-empty">Aún no has entregado ninguna tarea.</div>';
    } else {
      // One row per UNIQUE assignment in submissions, showing best score
      const byId = {};
      submissions.forEach((s) => {
        if (!byId[s.assignmentId] || s.score > byId[s.assignmentId].score) byId[s.assignmentId] = s;
      });
      Object.keys(byId).forEach((id) => {
        const sub = byId[id];
        const a = assignments.find((x) => x.id === id);
        const row = document.createElement('div');
        row.className = 'hw-settings-reset-row';
        row.innerHTML = `
          <div class="hw-settings-reset-info">
            <div class="hw-settings-reset-title">${escapeHtml(a ? a.title : id)}</div>
            <div class="hw-settings-reset-best">Mejor: <strong>${sub.score}/${sub.total} pts</strong></div>
          </div>
          <button class="btn btn-ghost btn-sm" data-id="${escapeHtml(id)}">🔄 Borrar</button>`;
        row.querySelector('button').addEventListener('click', () => doResetAssignment(id, a ? a.title : id));
        resetList.appendChild(row);
      });
    }
  }
  $('hw-settings-name-save').addEventListener('click', () => {
    const newName = $('hw-settings-name-input').value.trim();
    if (!newName) { $('hw-settings-name-msg').textContent = 'Escribe un nombre'; return; }
    if (newName === displayName) { $('hw-settings-name-msg').textContent = 'Ese ya es tu nombre'; return; }
    $('hw-settings-name-msg').textContent = 'Guardando…';
    fetch('/api/homework/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode, studentCode, displayName: newName }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          $('hw-settings-name-msg').textContent = 'Error: ' + (data && data.error || 'no se pudo');
          return;
        }
        displayName = data.displayName || newName;
        $('hw-settings-name').textContent = displayName;
        $('hw-settings-name-msg').textContent = '✓ Nombre cambiado';
      })
      .catch((e) => { $('hw-settings-name-msg').textContent = 'Error: ' + e.message; });
  });
  $('hw-settings-code-copy').addEventListener('click', () => {
    if (!studentCode) return;
    try {
      navigator.clipboard.writeText(studentCode);
      const btn = $('hw-settings-code-copy');
      const orig = btn.textContent;
      btn.textContent = '✓ Copiado';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    } catch (_) { /* ignore */ }
  });
  function doResetAssignment(id, title) {
    if (!confirm(`¿Borrar tus puntajes de "${title}"?\n\nEmpezarás esta tarea desde cero. Esto NO se puede deshacer.`)) return;
    $('hw-settings-reset-msg').textContent = 'Borrando…';
    fetch('/api/homework/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode, studentCode, assignmentId: id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          $('hw-settings-reset-msg').textContent = 'Error: ' + (data && data.error || 'no se pudo');
          return;
        }
        // Drop the cleared submissions from local state and re-render
        submissions = submissions.filter((s) => s.assignmentId !== id);
        $('hw-settings-reset-msg').textContent = `✓ Borrados ${data.removed} intentos de "${title}"`;
        renderSettings();
      })
      .catch((e) => { $('hw-settings-reset-msg').textContent = 'Error: ' + e.message; });
  }

  // === Parent view ===
  function openParentView() {
    fetch('/api/homework/insights/' + encodeURIComponent(studentCode) + '?accessCode=' + encodeURIComponent(accessCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          alert('No se pudo cargar: ' + (data && data.error || ''));
          return;
        }
        renderParentView(data);
        showScreen('parents');
      });
  }
  function renderParentView(data) {
    renderAvatarInto($('hw-parents-avatar'), data.avatar);
    $('hw-parents-name').textContent = data.displayName || 'Anon';
    $('hw-parents-code').textContent = data.code;
    const t = data.totals || {};
    // Stats row — user feedback 2026-05-27 asked for word count
    // ("palabras aprendidas, oraciones, estimated according to records").
    // Added wordsLearned (unique pinyin tokens from correct answers) and
    // sentencesCorrect alongside the existing tareas/historias stats.
    const stories = t.readingTestsTaken || 0;
    const attempts = t.readingTestAttempts || 0;
    const storiesExtra = (attempts > stories) ? ` <small>(${attempts} veces)</small>` : '';
    const wordsLearned = t.wordsLearned || 0;
    const wordsTotal   = t.wordsTotalHsk1 || 150;
    const sentCorrect  = t.sentencesCorrect || 0;
    $('hw-parents-stats').innerHTML = `
      <span class="hw-parents-stat">📚 <strong>${t.assignmentsMastered || 0}</strong>/${t.assignmentsAvailable || 0} tareas dominadas</span>
      <span class="hw-parents-stat">📖 <strong>${stories}</strong> historia${stories === 1 ? '' : 's'} leída${stories === 1 ? '' : 's'}${storiesExtra}</span>
      <span class="hw-parents-stat hw-parents-stat-pill is-clickable" id="hw-parents-pill-words" role="button">🌱 <strong>${wordsLearned}</strong>/${wordsTotal} palabras aprendidas <small>(estimado · toca para ver)</small></span>
      <span class="hw-parents-stat hw-parents-stat-pill is-clickable" id="hw-parents-pill-sentences" role="button">✏️ <strong>${sentCorrect}</strong> oraciones correctas <small>(toca para ver)</small></span>`;
    // Expandable per-sentence panel: shows exactly what the kid wrote vs the
    // right answer, marked ✓ / ✗, grouped by lesson. User feedback: "oraciones
    // correctas should expand to see what is correct and what is incorrect."
    renderSentenceDetail(data.sentenceDetail || []);
    const sentPill = $('hw-parents-pill-sentences');
    if (sentPill) {
      sentPill.addEventListener('click', () => {
        const panel = $('hw-parents-sentences-panel');
        if (!panel) return;
        const show = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !show);
        if (show) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
    // User feedback 2026-05-27: "once you click on the green bar, then
    // it's when you should display what the kid already knows."
    // → Tapping the palabras-aprendidas pill scrolls to + opens the
    // HSK dropdown so the parent sees the full word list on demand.
    const wordsPill = $('hw-parents-pill-words');
    if (wordsPill) {
      wordsPill.addEventListener('click', () => {
        const wrap = document.querySelector('.hw-parents-levels-wrap');
        if (wrap) {
          wrap.open = true;
          // Also open the HSK1 sub-section
          const hsk1 = wrap.querySelector('.hw-parents-hsk-section');
          if (hsk1) hsk1.open = true;
          wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    const insightsWrap = $('hw-parents-insights');
    // Merge: assignment-based insights (from server) + reading-test
    // insights (synthesized client-side from passed stories). User
    // feedback 2026-05-27: "Lo que tu hijo ya sabe hacer should also
    // trigger progress according to records of tests and stories."
    const allInsights = (data.insights || []).slice();
    (data.tests || []).forEach((t) => {
      if (t.score >= 60) {  // mastered if ≥60%
        allInsights.push({
          insight: {
            title: `Tu hijo/a entendió la historia "${t.storyTitle || t.storyId}"`,
            bullets: [
              `Sacó ${t.score}/100 en el examen de lectura`,
              'Identificó eventos y personajes de la historia',
              'Practicó vocabulario HSK1 en contexto real',
            ],
            encouragement: `Pídele que te cuente la historia de "${t.storyTitle || t.storyId}" con sus propias palabras.`,
          },
          score: t.score,
          total: 100,
          lastAttemptAt: t.ts,
          fromTest: true,
        });
      }
    });
    if (!allInsights.length) {
      insightsWrap.innerHTML = '<div class="hw-parents-empty">Todavía no tiene logros con 60% o más. ¡Anímalo/a a practicar más!</div>';
      insightsWrap.dataset.hasMore = 'false';
    } else {
      insightsWrap.innerHTML = '';
      allInsights.forEach((row) => {
        const card = document.createElement('div');
        card.className = 'hw-parents-insight-card' + (row.fromTest ? ' from-test' : '');
        const dateStr = row.lastAttemptAt ? new Date(row.lastAttemptAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        card.innerHTML = `
          <div class="hw-parents-insight-head">
            <span class="hw-parents-insight-title">${escapeHtml(row.insight.title)}</span>
            <span class="hw-parents-insight-score">${row.score}/${row.total} <small>pts · ${dateStr}</small></span>
          </div>
          <ul class="hw-parents-insight-bullets">
            ${row.insight.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
          ${row.insight.encouragement ? `<div class="hw-parents-insight-tip">💡 ${escapeHtml(row.insight.encouragement)}</div>` : ''}`;
        insightsWrap.appendChild(card);
      });
      insightsWrap.dataset.hasMore = allInsights.length > 1 ? 'true' : 'false';
    }
    const testsWrap = $('hw-parents-tests');
    if (!data.tests || !data.tests.length) {
      testsWrap.innerHTML = '<div class="hw-parents-empty">Aún no ha hecho exámenes de lectura en clase. Pregúntale a la maestra cuándo serán.</div>';
    } else {
      testsWrap.innerHTML = '';
      data.tests.forEach((t) => {
        const row = document.createElement('div');
        row.className = 'hw-parents-test-row';
        const dateStr = new Date(t.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        // Suggested question: prompt the parent to bring up the story
        const question = `Pregúntale: "¿Qué pasó en la historia de ${escapeHtml(t.storyTitle || t.storyId)}? Cuéntamela en chino o en español."`;
        row.innerHTML = `
          <div class="hw-parents-test-main">
            <span class="hw-parents-test-title">📖 ${escapeHtml(t.storyTitle || t.storyId)}</span>
            <span class="hw-parents-test-score">${t.score}/100 pts</span>
            <span class="hw-parents-test-date">${dateStr}</span>
          </div>
          <div class="hw-parents-test-question">💬 ${question}</div>`;
        testsWrap.appendChild(row);
      });
    }
    // === REMAINING / NOT-YET-DONE TAREAS ===
    // User feedback 2026-05-27: parents need to nudge kids on tareas
    // they haven't started. Show each remaining tarea as a row with a
    // direct button that closes the parent view and opens the assignment.
    const remainingWrap = $('hw-parents-remaining');
    if (remainingWrap) {
      if (!data.remaining || !data.remaining.length) {
        remainingWrap.innerHTML = '<div class="hw-parents-empty">¡Felicidades! Ya intentó todas las tareas disponibles.</div>';
      } else {
        remainingWrap.innerHTML = '';
        data.remaining.forEach((r) => {
          const row = document.createElement('div');
          row.className = 'hw-parents-remaining-row';
          row.innerHTML = `
            <div class="hw-parents-remaining-info">
              <div class="hw-parents-remaining-title">${escapeHtml(r.title)}</div>
              <div class="hw-parents-remaining-sub">${escapeHtml(r.subtitle)} · ${r.totalPoints} pts</div>
            </div>
            <button class="btn btn-jade btn-sm" data-id="${escapeHtml(r.assignmentId)}">🎯 Hacerla ahora</button>`;
          row.querySelector('button').addEventListener('click', () => {
            openAssignment(r.assignmentId);
          });
          remainingWrap.appendChild(row);
        });
      }
    }
    // === HSK1 LEVELS — what your kid should know by now ===
    // For each experience (EXP1..EXP8): show total word count, list all
    // words with hanzi+pinyin+Spanish, and (if we can infer it) the kid's
    // evidence of having used the word in a graded submission.
    renderHsk1Levels();

    // === CONVERSATION PROMPTS — what to ask the kid ===
    // Concrete questions parents can ask, drawn from each mastered
    // assignment's encouragement string. Reinforces SPEAKING the
    // language, not just typing it.
    const convWrap = $('hw-parents-conversations');
    if (convWrap) {
      if (!data.conversationPrompts || !data.conversationPrompts.length) {
        convWrap.innerHTML = '<div class="hw-parents-empty">Aún no hay temas — cuando complete una tarea aparecerán aquí.</div>';
      } else {
        convWrap.innerHTML = '';
        data.conversationPrompts.forEach((c) => {
          const row = document.createElement('div');
          row.className = 'hw-parents-conv-row';
          row.innerHTML = `
            <div class="hw-parents-conv-title">${escapeHtml(c.assignmentTitle)}</div>
            <div class="hw-parents-conv-prompt">💬 ${escapeHtml(c.prompt)}</div>`;
          convWrap.appendChild(row);
        });
      }
    }
  }
  // Parent-view tab switcher: progreso ↔ tips ↔ guías
  document.querySelectorAll('.hw-parents-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const target = tabBtn.dataset.tab;
      document.querySelectorAll('.hw-parents-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === target);
      });
      document.querySelectorAll('.hw-parents-tabpanel').forEach((p) => {
        p.classList.toggle('hidden', p.id !== ('hw-parents-tabpanel-' + target));
      });
      if (target === 'guias') fetchGuides();
      if (target === 'reporte') fetchReportMonths();
    });
  });

  // === 📋 REPORT CARDS ===
  function fetchReportMonths() {
    const wrap = $('hw-report-months');
    if (!wrap) return;
    fetch('/api/homework/reports/' + encodeURIComponent(studentCode)
        + '?accessCode=' + encodeURIComponent(accessCode) + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { wrap.innerHTML = '<div class="hw-parents-empty">No se pudo cargar.</div>'; return; }
        wrap.innerHTML = '';
        (data.months || []).forEach((m) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'hw-report-month-btn';
          btn.innerHTML = `<span>📅 ${prettyMonth(m)}</span><span class="hw-report-go">Generar →</span>`;
          btn.addEventListener('click', () => generateReport(m));
          wrap.appendChild(btn);
        });
      })
      .catch(() => { wrap.innerHTML = '<div class="hw-parents-empty">Error al cargar.</div>'; });
  }
  function prettyMonth(m) {
    const [y, mo] = String(m).split('-');
    const names = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return (names[Number(mo)] || m) + ' ' + y;
  }
  function generateReport(month) {
    fetch('/api/homework/report/' + encodeURIComponent(studentCode)
        + '?month=' + encodeURIComponent(month)
        + '&accessCode=' + encodeURIComponent(accessCode) + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { alert('No se pudo generar.'); return; }
        openReportCardWindow(data);
      })
      .catch((e) => alert('Error: ' + e.message));
  }
  // Opens a standalone, beautifully-branded report card in a new tab and
  // auto-triggers print (→ "Save as PDF"). Dralingo EduTech branding is
  // prominent so it looks great shared on WhatsApp / stories.
  function openReportCardWindow(d) {
    const avatarUrl = (typeof d.avatar === 'string' && /^[a-z]+$/.test(d.avatar))
      ? '/assets/avatars/' + d.avatar + '.svg?v=20260528b' : '';
    const notesHtml = (d.notes || []).length
      ? d.notes.map((n) => `<li>${escapeHtml(n.text)}</li>`).join('')
      : '<li>¡Sigue practicando en voz alta cada día! 🌱</li>';
    const grade = escapeHtml(d.grade || '—');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Boleta · ${escapeHtml(d.displayName)} · ${escapeHtml(prettyMonth(d.month))}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@400;700;800;900&family=ZCOOL+XiaoWei&display=swap');
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Nunito', sans-serif; background: #0e1322; padding: 18px; color: #1a1f33; }
  .card { max-width: 620px; margin: 0 auto; background:
      radial-gradient(circle at 100% 0%, rgba(239,91,91,0.12), transparent 45%),
      linear-gradient(160deg, #fff8ee, #fdeede);
    border: 10px solid #c81e1e; border-radius: 22px; padding: 0 0 26px; overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5); position: relative; }
  .topbar { background: linear-gradient(135deg, #c81e1e, #e23b3b); color: #ffe9c7;
    padding: 16px 22px; display: flex; align-items: center; gap: 12px; }
  .topbar .dragon { font-size: 2.4rem; }
  .brand { font-family: 'Cinzel', serif; font-weight: 900; font-size: 1.5rem; letter-spacing: 0.04em; }
  .brand small { display:block; font-family:'Nunito'; font-weight:800; font-size:0.7rem; letter-spacing:0.22em; opacity:0.85; }
  .hanzi { margin-left: auto; font-family: 'ZCOOL XiaoWei', serif; font-size: 1.8rem; opacity: 0.9; }
  .body { padding: 22px 26px 0; }
  .kid { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .kid .avatar { width: 86px; height: 86px; border-radius: 16px; background: #fff; border: 3px solid #c81e1e; object-fit: contain; }
  .kid .name { font-family: 'Cinzel', serif; font-weight: 900; font-size: 1.7rem; color: #8a1414; }
  .kid .month { font-weight: 800; color: #b06a2a; }
  .gradewrap { margin-left: auto; text-align: center; }
  .grade { font-family: 'Cinzel', serif; font-weight: 900; font-size: 3.4rem; color: #c81e1e; line-height: 1; }
  .gradelbl { font-weight: 800; font-size: 0.7rem; letter-spacing: 0.18em; color: #b06a2a; }
  .sect { font-family: 'Cinzel', serif; font-weight: 900; color: #8a1414; margin: 16px 0 6px; font-size: 1.1rem; }
  ul { padding-left: 22px; line-height: 1.7; font-weight: 700; color: #3a2b1a; }
  .stats { display: flex; gap: 10px; margin-top: 14px; }
  .stat { flex: 1; background: rgba(200,30,30,0.08); border-radius: 12px; padding: 10px; text-align: center; }
  .stat b { display: block; font-size: 1.5rem; color: #c81e1e; font-family: 'Cinzel', serif; }
  .stat span { font-size: 0.78rem; font-weight: 800; color: #b06a2a; }
  .foot { text-align: center; margin-top: 18px; font-weight: 800; color: #8a1414; }
  .seal { position: absolute; bottom: 16px; right: 18px; font-size: 2.6rem; opacity: 0.85; }
  .pbtn { display:block; margin: 16px auto 0; background:#c81e1e; color:#fff; border:none; border-radius:999px; padding:12px 26px; font-weight:900; font-size:1rem; cursor:pointer; }
  @media print { body { background:#fff; padding:0; } .pbtn { display:none; } .card { box-shadow:none; border-width:8px; } }
</style></head><body>
  <div class="card">
    <div class="topbar">
      <span class="dragon">🐉</span>
      <span class="brand">Dralingo<small>EDUTECH · HSK1</small></span>
      <span class="hanzi">成绩单</span>
    </div>
    <div class="body">
      <div class="kid">
        ${avatarUrl ? `<img class="avatar" src="${avatarUrl}" alt="">` : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;font-size:2.6rem;">🧒</div>'}
        <div>
          <div class="name">${escapeHtml(d.displayName)}</div>
          <div class="month">📅 ${escapeHtml(prettyMonth(d.month))}</div>
        </div>
        <div class="gradewrap"><div class="grade">${grade}</div><div class="gradelbl">CALIFICACIÓN</div></div>
      </div>
      <div class="sect">🌟 Observaciones del maestro</div>
      <ul>${notesHtml}</ul>
      <div class="stats">
        <div class="stat"><b>${d.stats ? d.stats.assignments : 0}</b><span>TAREAS</span></div>
        <div class="stat"><b>${d.stats ? d.stats.tests : 0}</b><span>EXÁMENES</span></div>
      </div>
      <div class="foot">¡Sigue practicando en chino en voz alta! 加油 🎉</div>
    </div>
    <div class="seal">🏅</div>
    <button class="pbtn" onclick="window.print()">📄 Guardar como PDF / Imprimir</button>
  </div>
  <script>setTimeout(function(){ try { window.focus(); } catch(e){} }, 200);<\/script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Permite ventanas emergentes para ver la boleta.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  // Render the expandable per-sentence detail (correct ✓ / incorrect ✗).
  function renderSentenceDetail(detail) {
    const panel = $('hw-parents-sentences-panel');
    if (!panel) return;
    if (!detail || !detail.length) {
      panel.innerHTML = '<div class="hw-parents-empty">Aún no hay oraciones entregadas. Cuando tu hijo/a haga una tarea, aquí verás qué escribió.</div>';
      return;
    }
    panel.innerHTML = detail.map((d) => `
      <div class="hw-sent-group">
        <div class="hw-sent-group-head">${escapeHtml(d.assignmentTitle)} <span class="hw-sent-group-score">${d.correct}/${d.rows.length} ✓</span></div>
        ${d.rows.map((r) => `
          <div class="hw-sent-row ${r.correct ? 'ok' : 'bad'}">
            <span class="hw-sent-mark">${r.correct ? '✓' : '✗'}</span>
            <span class="hw-sent-body">
              <span class="hw-sent-es">${escapeHtml(r.es)}</span>
              <span class="hw-sent-given">Escribió: <strong>${escapeHtml(r.student || '—')}</strong></span>
              ${r.correct ? '' : `<span class="hw-sent-expected">Correcto: <strong>${escapeHtml(r.expected)}</strong></span>`}
            </span>
          </div>`).join('')}
      </div>`).join('');
  }

  // === 📘 GUÍAS (study-guide PDFs) ===
  let _guidesLoaded = false;
  function fetchGuides() {
    const wrap = $('hw-guias-list');
    if (!wrap) return;
    if (_guidesLoaded) return;     // load once per session
    fetch('/api/guides?accessCode=' + encodeURIComponent(accessCode)
        + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { wrap.innerHTML = '<div class="hw-parents-empty">No se pudieron cargar las guías.</div>'; return; }
        _guidesLoaded = true;
        renderGuias(data.guides || []);
      })
      .catch(() => { wrap.innerHTML = '<div class="hw-parents-empty">Error al cargar las guías.</div>'; });
  }
  function renderGuias(guides) {
    const wrap = $('hw-guias-list');
    if (!wrap) return;
    if (!guides.length) {
      wrap.innerHTML = '<div class="hw-parents-empty">Todavía no hay guías. Tu maestra las subirá pronto. 📘</div>';
      return;
    }
    const exps = window.WU_EXPERIENCES || {};
    wrap.innerHTML = guides.map((g) => {
      const expLabel = g.exp && exps[g.exp] ? (exps[g.exp].short || g.exp) : '';
      const mb = g.size ? (g.size / (1024 * 1024)).toFixed(1) + ' MB' : '';
      return `
        <a class="hw-guia-card" href="/api/guides/${encodeURIComponent(g.id)}" target="_blank" rel="noopener">
          <span class="hw-guia-icon">📘</span>
          <span class="hw-guia-body">
            <span class="hw-guia-title">${escapeHtml(g.title)}</span>
            <span class="hw-guia-meta">${expLabel ? escapeHtml(expLabel) + ' · ' : ''}PDF${mb ? ' · ' + mb : ''}</span>
          </span>
          <span class="hw-guia-open">Abrir →</span>
        </a>`;
    }).join('');
  }
  // === HSK1 Levels render ===
  // Shows EXP1..EXP8 with word counts + expandable word lists. The
  // parent can pop open any level and quiz their kid on those words.
  function renderHsk1Levels() {
    const wrap = $('hw-parents-levels');
    if (!wrap || !window.WU_WORDS || !window.WU_EXPERIENCES) return;
    // Group words by exp
    const byExp = {};
    window.WU_WORDS.forEach((w) => {
      if (!byExp[w.exp]) byExp[w.exp] = [];
      byExp[w.exp].push(w);
    });
    wrap.innerHTML = '';
    Object.keys(window.WU_EXPERIENCES).forEach((expKey, idx) => {
      const meta = window.WU_EXPERIENCES[expKey];
      const words = byExp[expKey] || [];
      const card = document.createElement('details');
      card.className = 'hw-level-card';
      // Auto-open the first 2 levels so parents see the format immediately
      if (idx < 2) card.open = true;
      card.innerHTML = `
        <summary class="hw-level-summary">
          <span class="hw-level-num">${escapeHtml(meta.short || expKey.toUpperCase())}</span>
          <span class="hw-level-label">${escapeHtml(meta.label || expKey)}</span>
          <span class="hw-level-count">${words.length} palabras</span>
          <span class="hw-level-toggle">▼</span>
        </summary>
        <div class="hw-level-body">
          <p class="hw-level-tip">💡 Practica con tu hijo/a: pídele que traduzca cada palabra al chino EN VOZ ALTA. Si no la sabe, dile la pinyin tres veces y que la repita.</p>
          <div class="hw-level-words">
            ${words.map((w) => `
              <div class="hw-level-word">
                <span class="hw-level-icon">${escapeHtml(w.icon || '·')}</span>
                <span class="hw-level-word-hanzi">${escapeHtml(w.hanzi || '')}</span>
                <span class="hw-level-word-pinyin">${escapeHtml(w.pinyin || '')}</span>
                <span class="hw-level-word-es">${escapeHtml(w.es || '')}</span>
              </div>`).join('')}
          </div>
        </div>`;
      wrap.appendChild(card);
    });
  }

  $('hw-parents-back').addEventListener('click', () => {
    renderList();
    showScreen('list');
  });

  // ── Assignment-list screen
  // 📁 FOLDER NAVIGATION — login → HSK1 → 8 experiences → assignments.
  // Pure presentation over the SAME assignment IDs, so every saved score /
  // parent-card result is untouched. null = root (folders); else 'exp1'…
  let hwFolder = null;
  // Best-effort story→experience grouping for the reading folders.
  const READING_EXP = { xiaomingday: 'exp8' };
  function readingExpOf(r) { return (r && (READING_EXP[r.storyId] || r.exp)) || 'exp1'; }
  (function bindFolderBack() {
    const b = $('hw-folder-back');
    if (b) b.addEventListener('click', () => { hwFolder = null; renderList(); });
  })();

  function renderList() {
    $('hw-list-name').textContent = displayName || 'Anon';
    renderAvatarInto($('hw-list-avatar'), avatar);
    if (hwFolder) renderFolderContents(hwFolder);
    else renderFolderRoot();
    // Refresh reading state once; its callback re-renders (no fetch loop).
    fetchReadingTests();
  }

  // ROOT — HSK1 with its eight experience folders.
  function renderFolderRoot() {
    $('hw-folder-bar').classList.add('hidden');
    $('hw-sec-tareas').classList.add('hidden');
    $('hw-sec-lecturas').classList.add('hidden');
    $('hw-list-readings').classList.add('hidden');
    const t = document.querySelector('.hw-list-title'); if (t) t.textContent = '📚 HSK1';
    const grid = $('hw-list-grid');
    grid.classList.remove('hidden');
    grid.innerHTML = '';
    const exps = window.WU_EXPERIENCES || {};
    ['exp1','exp2','exp3','exp4','exp5','exp6','exp7','exp8'].forEach((expId) => {
      const exp = exps[expId];
      if (!exp) return;
      const eAssigns = assignments.filter((a) => a.expLabel === expId);
      const eReads = (readingTests || []).filter((r) => readingExpOf(r) === expId);
      const total = eAssigns.length + eReads.length;
      const done = eAssigns.filter((a) => submissions.some((s) => s.assignmentId === a.id)).length
                 + eReads.filter((r) => r.bestScore != null).length;
      const emoji = (exp.short || '📁').split(' ')[0] || '📁';
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'hw-folder-card' + (total ? '' : ' hw-folder-empty');
      card.innerHTML = `
        <div class="hw-folder-emoji">${emoji}</div>
        <div class="hw-folder-name">${escapeHtml(exp.label || expId)}</div>
        <div class="hw-folder-meta">${total ? (total + ' actividad' + (total === 1 ? '' : 'es')) : 'Próximamente'}</div>
        ${total ? `<div class="hw-folder-progress">${done}/${total} ✓</div>` : ''}`;
      if (total) card.addEventListener('click', () => { hwFolder = expId; renderList(); });
      else card.disabled = true;
      grid.appendChild(card);
    });
  }

  // FOLDER — assignments (+ readings) inside one experience.
  function renderFolderContents(expId) {
    const exp = (window.WU_EXPERIENCES || {})[expId];
    $('hw-folder-bar').classList.remove('hidden');
    $('hw-folder-crumb').textContent = exp ? exp.label : expId;
    const grid = $('hw-list-grid');
    grid.classList.remove('hidden');
    grid.innerHTML = '';
    const list = assignments.filter((a) => a.expLabel === expId);
    $('hw-sec-tareas').classList.toggle('hidden', list.length === 0);
    list.forEach((a) => grid.appendChild(buildAssignmentCard(a)));
    renderReadingsList();
  }

  // One assignment card — shared by both views.
  function buildAssignmentCard(a) {
    const myAttempts = submissions.filter((s) => s.assignmentId === a.id);
    const bestScore = myAttempts.length ? Math.max(...myAttempts.map((s) => s.score)) : null;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'hw-card';
    if (bestScore != null) card.classList.add('hw-card-done');
    const statusBadge = bestScore == null
      ? '<span class="hw-card-badge new">Nueva</span>'
      : `<span class="hw-card-badge done">${bestScore}/${a.totalPoints} pts</span>`;
    // Lesson label "EXP1 / 1" — numbered within its own experience (week).
    const expNum = (a.expLabel || '').replace('exp', '');
    const sameExp = assignments.filter((x) => x.expLabel === a.expLabel);
    const lessonNo = Math.max(1, sameExp.indexOf(a) + 1);
    const lessonChip = expNum
      ? `<span class="hw-card-exp">EXP${expNum} / ${lessonNo}</span>`
      : '';
    card.innerHTML = `
      <div class="hw-card-head">
        ${statusBadge}
        <span class="hw-card-points">${a.totalPoints} pts</span>
      </div>
      ${lessonChip}
      <div class="hw-card-title">${escapeHtml(a.title)}</div>
      <div class="hw-card-sub">${escapeHtml(a.subtitle)}</div>
      <div class="hw-card-meta">${a.itemCount} oraciones</div>`;
    card.addEventListener('click', () => openAssignment(a.id));
    return card;
  }

  // ── Reading-test list (fetched from server)
  function fetchReadingTests() {
    if (!studentCode || !accessCode) return;
    fetch('/api/homework/reading-tests?accessCode=' + encodeURIComponent(accessCode)
       + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) return;
        readingTests = data.stories || [];
        // Re-render so folder counts / readings reflect fresh data — but
        // NEVER rebuild the root grid on a repeat fetch, or a tap landing
        // mid-rebuild gets lost or double-fires (the touch regression).
        if (hwFolder) renderReadingsList();
        else if (!_readingsLoadedOnce) renderFolderRoot();
        _readingsLoadedOnce = true;
      }).catch(() => {});
  }
  let _readingsLoadedOnce = false;
  function renderReadingsList() {
    const wrap = $('hw-list-readings');
    if (!wrap) return;
    // Reading tests only show INSIDE an experience folder.
    if (!hwFolder) {
      wrap.classList.add('hidden');
      $('hw-sec-lecturas').classList.add('hidden');
      return;
    }
    const mine = (readingTests || []).filter((r) => readingExpOf(r) === hwFolder);
    $('hw-sec-lecturas').classList.toggle('hidden', mine.length === 0);
    wrap.classList.toggle('hidden', mine.length === 0);
    if (!mine.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '';
    mine.forEach((r) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'hw-card hw-card-reading' + (r.available ? '' : ' hw-card-locked');
      const status = r.bestScore != null
        ? `<span class="hw-card-badge done">${r.bestScore}/100 pts</span>`
        : (r.available ? '<span class="hw-card-badge new">Disponible</span>'
                       : '<span class="hw-card-badge locked">🔒 Hazlo en clase primero</span>');
      card.innerHTML = `
        <div class="hw-card-reading-img" style="background-image:url('${r.coverImage}');"></div>
        <div class="hw-card-reading-body">
          <div class="hw-card-head">
            ${status}
            <span class="hw-card-points">100 pts</span>
          </div>
          <div class="hw-card-title">📖 ${escapeHtml(r.title)}</div>
          <div class="hw-card-sub">${escapeHtml(r.subtitle || '')}</div>
          <div class="hw-card-meta">${r.pageCount} páginas · ${r.attempts || 0} intento${r.attempts === 1 ? '' : 's'}</div>
        </div>`;
      if (r.available) {
        card.addEventListener('click', () => openReadingTest(r.storyId));
      } else {
        card.addEventListener('click', () => alert('Aún no puedes hacer este examen. Tu maestra debe abrirlo en clase primero.'));
      }
      wrap.appendChild(card);
      // 🔎 Review past mistakes — only once they've attempted it.
      if (r.bestScore != null) {
        const rev = document.createElement('button');
        rev.type = 'button';
        rev.className = 'hw-review-btn';
        rev.textContent = '🔎 Ver mis errores';
        rev.addEventListener('click', () => openReadingReview(r.storyId, r.title));
        wrap.appendChild(rev);
      }
    });
  }
  // Fetch + show which reading-test questions the kid missed (best attempt).
  function openReadingReview(storyId, title) {
    fetch('/api/homework/reading-review/' + encodeURIComponent(storyId)
        + '?accessCode=' + encodeURIComponent(accessCode)
        + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok || !data.attempt) { alert('Aún no hay intento para revisar.'); return; }
        showMistakesModal(title || data.attempt.storyTitle, data.attempt.score, 100,
          (data.attempt.breakdown || []).map((b) => ({
            q: b.q,
            picked: (b.picked != null && b.choices) ? b.choices[b.picked] : '—',
            correctAns: b.choices ? b.choices[b.correctIdx] : '',
            correct: !!b.correct,
          })));
      })
      .catch((e) => alert('Error: ' + e.message));
  }
  // Generic mistakes modal — lists each question, the kid's pick (red if
  // wrong) and the right answer (green). Reused for tests.
  function showMistakesModal(title, score, total, rows) {
    let ov = document.getElementById('hw-mistakes-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'hw-mistakes-overlay';
      ov.className = 'hw-mistakes-overlay';
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('show'); });
    }
    const wrong = rows.filter((r) => !r.correct).length;
    ov.innerHTML = `
      <div class="hw-mistakes-card">
        <button class="hw-mistakes-close" type="button" aria-label="Cerrar">✕</button>
        <div class="hw-mistakes-title">📖 ${escapeHtml(title || '')}</div>
        <div class="hw-mistakes-score">${score}/${total} pts · ${wrong === 0 ? '¡Todo correcto! 🎉' : (wrong + ' por corregir')}</div>
        <div class="hw-mistakes-list">
          ${rows.map((r) => `
            <div class="hw-mistake-row ${r.correct ? 'ok' : 'bad'}">
              <span class="hw-mistake-mark">${r.correct ? '✓' : '✗'}</span>
              <span class="hw-mistake-body">
                <span class="hw-mistake-q">${escapeHtml(r.q || '')}</span>
                <span class="hw-mistake-given">Tu respuesta: <strong>${escapeHtml(r.picked || '—')}</strong></span>
                ${r.correct ? '' : `<span class="hw-mistake-correct">Correcto: <strong>${escapeHtml(r.correctAns || '')}</strong></span>`}
              </span>
            </div>`).join('')}
        </div>
        <div class="hw-mistakes-tip">🗣️ Lee EN VOZ ALTA las respuestas correctas para recordarlas la próxima vez.</div>
      </div>`;
    ov.querySelector('.hw-mistakes-close').addEventListener('click', () => ov.classList.remove('show'));
    requestAnimationFrame(() => ov.classList.add('show'));
  }
  function openReadingTest(storyId) {
    fetch('/api/homework/reading-test/' + encodeURIComponent(storyId)
        + '?accessCode=' + encodeURIComponent(accessCode)
        + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          alert('No se pudo abrir: ' + (data && data.error || ''));
          return;
        }
        currentReadingStory = data;
        currentReadingAnswers = data.questions.map(() => null);
        renderReadingScreen();
        showScreen('reading');
        // Reset the test panel
        $('hw-reading-test').classList.add('hidden');
      });
  }
  function renderReadingScreen() {
    $('hw-reading-title').textContent = currentReadingStory.title;
    $('hw-reading-sub').textContent = currentReadingStory.subtitle || '';
    const pagesWrap = $('hw-reading-pages');
    pagesWrap.innerHTML = '';
    currentReadingStory.pages.forEach((p, i) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'hw-reading-page';
      pageEl.innerHTML = `
        <div class="hw-reading-page-num">Página ${p.pageNum}</div>
        <img class="hw-reading-page-img" src="${escapeHtml(p.imageUrl)}" alt="página ${p.pageNum}">
        <div class="hw-reading-page-caption">${escapeHtml(p.caption || '')}</div>
        <audio class="hw-reading-page-audio" controls preload="none" src="${escapeHtml(p.audioUrl)}"></audio>
        <div class="hw-reading-page-text">
          ${(p.sentences || []).map((sent, idx) => {
            const es = (p.sentencesEs || [])[idx] || '';
            // Tokenize so each pinyin word becomes tappable for Modo
            // Curioso. We DON'T add a 🔊 button here — the page mp3
            // already plays the audio, so an extra TTS button would be
            // redundant + (per user feedback 2026-05-27) the Web Speech
            // quality is too rough to be useful when real audio exists.
            const pinyinHtml = tokenizePinyinForCurious(sent);
            return `
              <div class="hw-reading-line">
                <span class="hw-reading-line-pinyin">${pinyinHtml}</span>
                <span class="hw-reading-line-es">${escapeHtml(es)}</span>
              </div>`;
          }).join('')}
        </div>`;
      pagesWrap.appendChild(pageEl);
    });
    // Wire Modo Curioso taps on every clickable word in the reading text.
    // Reuses the wu-pokedex overlay markup from player.html — but since
    // homework.html doesn't include it, we create one on demand below.
    pagesWrap.querySelectorAll('.hw-curious-word').forEach((el) => {
      el.addEventListener('click', () => {
        const dict = window.lookupWuPinyin && window.lookupWuPinyin(el.dataset.token);
        if (dict) {
          showCuriousCard(dict);
        } else {
          showCuriousCard({
            pinyin: el.dataset.token,
            hanzi:  '',
            es:     '(no encontrado en el catálogo)',
            cat:    'noun',
            icon:   '❓',
            exp:    '',
          });
        }
      });
    });
    applyReadingLangMode();
  }
  // Splits a pinyin sentence into space-delimited tokens and wraps each
  // in a tappable span. Preserves punctuation attached to tokens.
  function tokenizePinyinForCurious(sent) {
    return String(sent || '').split(/\s+/).filter(Boolean).map((tok) => {
      // Strip surrounding punctuation for the lookup token, but keep it
      // visible. The cleaned form goes into data-token; display keeps original.
      const clean = tok.toLowerCase().replace(/[".,!?:;"'¡¿()]+/g, '');
      return `<span class="hw-curious-word" data-token="${escapeHtml(clean)}">${escapeHtml(tok)}</span>`;
    }).join(' ');
  }
  // Modo Curioso card — creates the overlay lazily so we don't need to
  // include the wu-pokedex markup in homework.html.
  function showCuriousCard(w) {
    let overlay = document.getElementById('hw-curious-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hw-curious-overlay';
      overlay.className = 'hw-curious-overlay hidden';
      overlay.innerHTML = `
        <button class="hw-curious-close" type="button" aria-label="Cerrar">✕</button>
        <div class="hw-curious-card" id="hw-curious-card"></div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideCuriousCard();
      });
      overlay.querySelector('.hw-curious-close').addEventListener('click', hideCuriousCard);
    }
    const card = document.getElementById('hw-curious-card');
    const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
    const exp = window.WU_EXPERIENCES && window.WU_EXPERIENCES[w.exp];
    const color = cat ? cat.color : '#ffe082';
    card.style.setProperty('--cat-color', color);
    card.innerHTML = `
      <div class="hw-curious-icon">${escapeHtml(w.icon || '✨')}</div>
      <div class="hw-curious-pinyin">${escapeHtml(w.pinyin || '')}</div>
      <div class="hw-curious-hanzi">${escapeHtml(w.hanzi || '')}</div>
      <div class="hw-curious-es">${escapeHtml(w.es || '')}</div>
      <div class="hw-curious-meta">
        <div class="hw-curious-chip" style="background:${color}; color:#0a1320;">${escapeHtml((cat && cat.label) || w.cat || '')}</div>
        ${exp ? `<div class="hw-curious-chip exp">${escapeHtml(exp.short || exp.label)}</div>` : ''}
      </div>
      ${w.pinyin ? `<button class="btn btn-jade hw-curious-speak" type="button">🔊 Escuchar y repetir</button>` : ''}
      <div class="hw-curious-hint">Toca fuera para cerrar</div>`;
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('show'));
    // Wire the speak button on the card. Auto-play the word once so the
    // kid hears it the moment the card opens.
    const speakBtn = card.querySelector('.hw-curious-speak');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => speakChinese(w.pinyin, speakBtn));
      // Small delay so the overlay slide-in finishes before audio starts
      setTimeout(() => speakChinese(w.pinyin, speakBtn), 250);
    }
  }
  function hideCuriousCard() {
    const overlay = document.getElementById('hw-curious-overlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => overlay.classList.add('hidden'), 250);
  }
  function applyReadingLangMode() {
    document.querySelectorAll('.hw-reading-lang-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.lang === readingLangMode);
    });
    document.querySelectorAll('.hw-reading-line').forEach((line) => {
      line.classList.remove('show-pinyin', 'show-es', 'show-both');
      line.classList.add('show-' + (readingLangMode === 'both' ? 'both' : readingLangMode));
    });
  }
  document.querySelectorAll('.hw-reading-lang-btn').forEach((b) => {
    b.addEventListener('click', () => {
      readingLangMode = b.dataset.lang;
      applyReadingLangMode();
    });
  });
  $('hw-reading-back').addEventListener('click', () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    currentReadingStory = null;
    renderList();
    showScreen('list');
  });
  $('hw-reading-start-test').addEventListener('click', () => {
    const panel = $('hw-reading-test');
    panel.classList.remove('hidden');
    renderReadingQuestions();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function renderReadingQuestions() {
    const wrap = $('hw-reading-qs');
    wrap.innerHTML = '';
    (currentReadingStory.questions || []).forEach((q, i) => {
      const row = document.createElement('div');
      row.className = 'hw-reading-q';
      row.innerHTML = `
        <div class="hw-reading-q-head">
          <span class="hw-reading-q-num">${i + 1}.</span>
          <span class="hw-reading-q-text">${escapeHtml(q.q)}</span>
        </div>
        <div class="hw-reading-q-choices">
          ${q.choices.map((c, ci) => `
            <button class="hw-reading-choice" type="button" data-q="${i}" data-c="${ci}">
              <span class="hw-reading-choice-letter">${String.fromCharCode(65 + ci)}</span>
              <span class="hw-reading-choice-text">${escapeHtml(c)}</span>
            </button>`).join('')}
        </div>`;
      wrap.appendChild(row);
    });
    wrap.querySelectorAll('.hw-reading-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qi = +btn.dataset.q;
        const ci = +btn.dataset.c;
        currentReadingAnswers[qi] = ci;
        // Highlight the selected choice
        wrap.querySelectorAll(`.hw-reading-choice[data-q="${qi}"]`).forEach((b) => {
          b.classList.toggle('selected', +b.dataset.c === ci);
        });
      });
    });
  }
  $('hw-reading-submit').addEventListener('click', () => {
    if (!currentReadingStory) return;
    const unanswered = currentReadingAnswers.filter((a) => a == null).length;
    if (unanswered > 0 && !confirm(`Te faltan ${unanswered} preguntas. ¿Entregar igual?`)) return;
    const btn = $('hw-reading-submit');
    btn.disabled = true; btn.textContent = 'Enviando…';
    fetch('/api/homework/reading-test/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessCode,
        studentCode,
        storyId: currentReadingStory.id,
        answers: currentReadingAnswers,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        btn.disabled = false; btn.textContent = '📤 Entregar examen';
        if (!data || !data.ok) {
          alert('Error: ' + (data && data.error || ''));
          return;
        }
        // Reuse the assignment-results screen for a consistent look
        showResults({
          score: data.score,
          total: data.total,
          breakdown: (data.breakdown || []).map((b) => ({
            es:           b.q,
            student:      b.picked != null ? b.choices[b.picked] : '—',
            expected:     b.choices[b.correctIdx],
            correct:      b.correct,
            pointsEarned: b.pointsEarned,
          })),
        });
        fetchReadingTests();
      })
      .catch((e) => {
        btn.disabled = false; btn.textContent = '📤 Entregar examen';
        alert('Error de conexión: ' + e.message);
      });
  });

  // ── Assignment screen
  function openAssignment(id) {
    fetch('/api/homework/assignment/' + encodeURIComponent(id) + '?accessCode=' + encodeURIComponent(accessCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) {
          alert('No se pudo abrir: ' + (data && data.error || ''));
          return;
        }
        currentAssignment = data;
        currentAnswers = data.items.map(() => '');
        undoStacks = data.items.map(() => []);
        // Lock the word bank to THIS assignment's experience so kids only
        // see the relevant words (no confusion). Falls back to 'all' if the
        // assignment has no experience tag.
        activeExpTab = data.expLabel || 'all';
        renderAssignment();
        showScreen('assignment');
      });
  }
  function renderAssignment() {
    $('hw-asg-title').textContent = currentAssignment.title;
    $('hw-asg-sub').textContent = currentAssignment.subtitle;
    $('hw-asg-instructions').textContent = currentAssignment.instructions;
    const itemsWrap = $('hw-asg-items');
    itemsWrap.innerHTML = '';
    currentAssignment.items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'hw-item';
      row.dataset.idx = i;
      row.innerHTML = `
        <div class="hw-item-head">
          <span class="hw-item-num">${i + 1}.</span>
          <span class="hw-item-es">${escapeHtml(it.es)}</span>
        </div>
        <div class="hw-item-stage" id="hw-stage-${i}" data-idx="${i}">
          <span class="hw-stage-empty">Toca palabras del catálogo abajo…</span>
        </div>
        <div class="hw-item-actions">
          <button class="btn btn-ghost btn-sm hw-item-speak" data-idx="${i}" type="button" title="Escucha tu oración en chino" aria-label="Escuchar">🔊 Oír</button>
          <button class="btn btn-ghost btn-sm hw-item-undo" data-idx="${i}" type="button" title="Deshacer" aria-label="Deshacer" disabled>↩️</button>
          <button class="btn btn-ghost btn-sm hw-item-clear" data-idx="${i}" type="button" title="Limpiar" aria-label="Limpiar">🧹 Borrar</button>
        </div>`;
      itemsWrap.appendChild(row);
      const stage = row.querySelector('.hw-item-stage');
      stage.addEventListener('click', () => setActiveItem(i));
    });
    itemsWrap.querySelectorAll('.hw-item-clear').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        if (!currentAnswers[i]) return;
        pushUndo(i);
        currentAnswers[i] = '';
        renderStage(i);
        refreshUndoButtons();
      });
    });
    // 🔊 Web Speech API — pronounces the kid's current pinyin sentence in
    // Mandarin. ZERO API cost, ZERO loading time, works offline. Built
    // into every modern browser. Per user feedback 2026-05-27: "can you
    // load an audio file from somewhere?" — this is the cheapest possible
    // version. Quality on desktop is OK; on iOS Safari it's quite good.
    itemsWrap.querySelectorAll('.hw-item-speak').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        const text = (currentAnswers[i] || '').trim();
        if (!text) {
          alert('Primero arma la oración tocando palabras.');
          return;
        }
        speakChinese(text, btn);
      });
    });
    itemsWrap.querySelectorAll('.hw-item-undo').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        if (!undoStacks[i] || !undoStacks[i].length) return;
        currentAnswers[i] = undoStacks[i].pop();
        renderStage(i);
        refreshUndoButtons();
      });
    });
    renderLibraryTabs();
    renderLibrary();
    setActiveItem(0);
    // Repaint each stage so previously-entered answers re-appear (e.g.
    // after pressing "Volver a intentar"). Without this, the stage divs
    // would show the empty placeholder even though currentAnswers has data.
    currentAssignment.items.forEach((_, i) => renderStage(i));
    refreshUndoButtons();
    // Wire the search box (idempotent — replace listeners on each render
    // by reading the current input value each time).
    const searchEl = $('hw-asg-library-search');
    const clearEl = $('hw-asg-library-search-clear');
    if (searchEl) {
      searchEl.value = '';        // fresh assignment → clear search
      librarySearch = '';
      // Replace listener (clone trick) so re-renders don't pile up handlers
      const fresh = searchEl.cloneNode(true);
      searchEl.parentNode.replaceChild(fresh, searchEl);
      fresh.addEventListener('input', () => {
        librarySearch = normalize(fresh.value);
        renderLibrary();
      });
    }
    if (clearEl) {
      const fresh = clearEl.cloneNode(true);
      clearEl.parentNode.replaceChild(fresh, clearEl);
      fresh.addEventListener('click', () => {
        const s = $('hw-asg-library-search');
        if (s) s.value = '';
        librarySearch = '';
        renderLibrary();
        const back = $('hw-asg-library-search');
        if (back) back.focus();
      });
    }
  }
  let activeItemIdx = 0;
  function setActiveItem(i) {
    activeItemIdx = i;
    document.querySelectorAll('.hw-item-stage').forEach((s) => {
      s.classList.toggle('active', +s.dataset.idx === i);
    });
  }
  function pushUndo(i) {
    if (!undoStacks[i]) undoStacks[i] = [];
    undoStacks[i].push(currentAnswers[i] || '');
    if (undoStacks[i].length > 20) undoStacks[i] = undoStacks[i].slice(-20);
  }
  function refreshUndoButtons() {
    document.querySelectorAll('.hw-item-undo').forEach((btn) => {
      const i = +btn.dataset.idx;
      btn.disabled = !undoStacks[i] || !undoStacks[i].length;
    });
  }
  function renderStage(i) {
    const stage = document.getElementById('hw-stage-' + i);
    if (!stage) return;
    const words = (currentAnswers[i] || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      stage.innerHTML = '<span class="hw-stage-empty">Toca palabras del catálogo abajo…</span>';
      return;
    }
    stage.innerHTML = '';
    words.forEach((w, idx) => {
      const dict = window.lookupWuPinyin ? window.lookupWuPinyin(w) : null;
      const cat = dict && window.WU_CATEGORIES && window.WU_CATEGORIES[dict.cat];
      const color = cat ? cat.color : '#ffe082';
      const chip = document.createElement('span');
      chip.className = 'hw-stage-word';
      chip.style.setProperty('--cat-color', color);
      chip.innerHTML = `<span class="hw-stage-pinyin">${escapeHtml(w)}</span> <span class="hw-stage-x">✕</span>`;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        pushUndo(i);
        const arr = (currentAnswers[i] || '').trim().split(/\s+/).filter(Boolean);
        arr.splice(idx, 1);
        currentAnswers[i] = arr.join(' ');
        renderStage(i);
        refreshUndoButtons();
      });
      stage.appendChild(chip);
    });
  }
  // EXP tab bar above the library — match warmup mode's experience filter.
  function renderLibraryTabs() {
    const tabsWrap = $('hw-asg-library-tabs');
    if (!tabsWrap) return;
    tabsWrap.innerHTML = '';
    const exps = window.WU_EXPERIENCES || {};
    // LOCKED MODE: when the assignment is tied to one experience, show ONLY
    // that experience's words — no tab bar, no "Todas" — so kids aren't
    // confused by the full 150-word catalog.
    const lockedExp = currentAssignment && currentAssignment.expLabel;
    if (lockedExp && exps[lockedExp]) {
      activeExpTab = lockedExp;
      const chip = document.createElement('div');
      chip.className = 'hw-lib-locked-chip';
      chip.textContent = '🔒 Solo palabras de ' + (exps[lockedExp].short || lockedExp);
      tabsWrap.appendChild(chip);
      return;
    }
    const tabs = [{ id: 'all', label: '✨ Todas' }].concat(
      Object.keys(exps).map((k) => ({ id: k, label: exps[k].short || exps[k].label || k }))
    );
    tabs.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hw-lib-tab' + (t.id === activeExpTab ? ' active' : '');
      btn.dataset.exp = t.id;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        activeExpTab = t.id;
        renderLibraryTabs();
        renderLibrary();
      });
      tabsWrap.appendChild(btn);
    });
  }
  function renderLibrary() {
    const wrap = $('hw-asg-library');
    if (!window.WU_WORDS) { wrap.innerHTML = '<em>Cargando catálogo…</em>'; return; }
    wrap.innerHTML = '';
    // Filter by EXP tab AND by normalized search string (tones stripped).
    // The search matches against pinyin, hanzi, and Spanish translation
    // — so a kid can type "hola", "nihao", or even "你好" and still find
    // the chip. User feedback 2026-05-27: "sometimes you can't find a
    // word like Ni hao, give us a search bar."
    const q = librarySearch;
    let words = activeExpTab === 'all'
      ? window.WU_WORDS
      : window.WU_WORDS.filter((w) => w.exp === activeExpTab);
    if (q) {
      words = words.filter((w) =>
        normalize(w.pinyin).includes(q) ||
        normalize(w.es).includes(q) ||
        (w.hanzi && w.hanzi.includes(q))
      );
    }
    if (!words.length) {
      wrap.innerHTML = q
        ? `<div class="hw-lib-empty">No encontré "${escapeHtml(q)}". Prueba escribir sin tonos, o cambia de pestaña.</div>`
        : '<div class="hw-lib-empty">No hay palabras en esta categoría.</div>';
      return;
    }
    words.forEach((w) => {
      const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
      const color = cat ? cat.color : '#fff';
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'hw-lib-chip';
      chip.style.setProperty('--cat-color', color);
      chip.innerHTML = `
        <span class="hw-lib-icon">${w.icon || '·'}</span>
        <span class="hw-lib-pinyin">${escapeHtml(w.pinyin)}</span>
        <span class="hw-lib-es">${escapeHtml(w.es)}</span>`;
      chip.addEventListener('click', () => {
        pushUndo(activeItemIdx);
        const cur = currentAnswers[activeItemIdx] || '';
        currentAnswers[activeItemIdx] = (cur ? cur + ' ' : '') + w.pinyin;
        renderStage(activeItemIdx);
        refreshUndoButtons();
        // tap feedback — flash the chip green for a beat
        chip.classList.remove('flash');
        void chip.offsetWidth;
        chip.classList.add('flash');
        // Modo Curioso feedback: brief floating bubble showing the word's
        // meaning, plus a soft chime, plus a flying animation toward the
        // active stage. Makes each tap feel like a tiny lesson.
        _showWordMeaningBubble(chip, w);
        _playTapChime();
        _flyToStage(chip, activeItemIdx);
      });
      wrap.appendChild(chip);
    });
  }
  $('hw-asg-back').addEventListener('click', () => {
    if (confirm('¿Volver sin entregar? Perderás lo que has escrito.')) {
      currentAssignment = null;
      renderList();
      showScreen('list');
    }
  });

  // ── Submit + results — both buttons (top + bottom) trigger the same flow
  function submitAssignment() {
    if (!currentAssignment) return;
    const emptyCount = currentAnswers.filter((a) => !a.trim()).length;
    if (emptyCount > 0 && !confirm(`Tienes ${emptyCount} oraciones vacías. ¿Entregar de todas formas?`)) return;
    const btns = [$('hw-asg-submit'), $('hw-asg-submit-top')].filter(Boolean);
    btns.forEach((b) => { b.disabled = true; b.textContent = 'Enviando…'; });
    fetch('/api/homework/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessCode,
        studentCode,
        assignmentId: currentAssignment.id,
        answers: currentAnswers,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        btns.forEach((b) => { b.disabled = false; b.textContent = '📤 Entregar tarea'; });
        if (!data || !data.ok) {
          alert('Error al entregar: ' + (data && data.error || ''));
          return;
        }
        showResults(data);
        submissions.push({
          assignmentId: currentAssignment.id,
          score: data.score,
          total: data.total,
          ts: Date.now(),
        });
      })
      .catch((e) => {
        btns.forEach((b) => { b.disabled = false; b.textContent = '📤 Entregar tarea'; });
        alert('Error de conexión: ' + e.message);
      });
  }
  $('hw-asg-submit').addEventListener('click', submitAssignment);
  if ($('hw-asg-submit-top')) $('hw-asg-submit-top').addEventListener('click', submitAssignment);

  function showResults(data) {
    showScreen('results');
    $('hw-results-total').textContent = data.total;
    const pct = (data.score / data.total) * 100;
    const cert = pct >= 95 ? { emoji: '🏅', text: '¡PERFECTO!' }
              : pct >= 80 ? { emoji: '⭐', text: '¡Excelente!' }
              : pct >= 60 ? { emoji: '👍', text: '¡Bien hecho!' }
              : pct >= 40 ? { emoji: '📚', text: 'Sigue practicando' }
              :              { emoji: '💪', text: '¡A repasar!' };
    $('hw-results-emoji').textContent = cert.emoji;
    $('hw-results-cert').textContent = cert.text;
    const numEl = $('hw-results-num');
    let cur = 0;
    const step = Math.max(1, Math.round(data.score / 30));
    const tick = () => {
      cur += step;
      if (cur >= data.score) { cur = data.score; numEl.textContent = cur; return; }
      numEl.textContent = cur;
      setTimeout(tick, 30);
    };
    numEl.textContent = '0';
    setTimeout(tick, 250);
    const bk = $('hw-results-breakdown');
    bk.innerHTML = '';
    // Lead the breakdown with a SPEAK-OUT-LOUD reminder. The kid just
    // finished the tarea, brain is engaged, this is the moment to push
    // pronunciation. User said this is "very important — not just count
    // how many words they know, but that they can pronounce them."
    const speakRow = document.createElement('div');
    speakRow.className = 'hw-results-speak-row';
    speakRow.innerHTML = `
      <span class="hw-results-speak-icon">🗣️</span>
      <div>
        <strong>Antes de salir:</strong> di cada respuesta correcta en voz alta tres veces.
        Hablar es la mejor forma de que se quede en tu cabeza.
      </div>`;
    bk.appendChild(speakRow);
    (data.breakdown || []).forEach((b) => {
      const row = document.createElement('div');
      row.className = 'hw-results-bk-row ' + (b.correct ? 'ok' : 'no');
      const verdict = b.correct ? '✓' : '✕';
      // What the kid should listen to: their answer if right, the correct
      // answer if wrong. Lets them hear the right pronunciation either way.
      const speakable = b.correct ? (b.student || b.expected) : b.expected;
      row.innerHTML = `
        <span class="hw-bk-verdict">${verdict}</span>
        <div class="hw-bk-content">
          <div class="hw-bk-es">${escapeHtml(b.es)}</div>
          <div class="hw-bk-line"><span class="hw-bk-label">Tu respuesta:</span> <span class="hw-bk-student">${escapeHtml(b.student || '—')}</span></div>
          ${b.correct ? '' : `<div class="hw-bk-line"><span class="hw-bk-label">Respuesta:</span> <span class="hw-bk-expected">${escapeHtml(b.expected)}</span></div>`}
          <button class="btn btn-ghost btn-sm hw-bk-speak" type="button" data-text="${escapeHtml(speakable)}">🔊 Escucha y repite</button>
        </div>
        <span class="hw-bk-points">+${b.pointsEarned}</span>`;
      bk.appendChild(row);
    });
    bk.querySelectorAll('.hw-bk-speak').forEach((btn) => {
      btn.addEventListener('click', () => speakChinese(btn.dataset.text, btn));
    });
  }
  $('hw-results-done').addEventListener('click', () => {
    renderList();
    showScreen('list');
  });
  // "🔁 Volver a intentar" — keep the kid's previous answers instead of
  // resetting to empty (user feedback 2026-05-27: "save everything so
  // progress doesn't start from zero — frustrating otherwise"). They can
  // edit the wrong ones and resubmit, building on what they had.
  $('hw-results-retry').addEventListener('click', () => {
    if (!currentAssignment) { showScreen('list'); return; }
    // currentAnswers stays as-is from the last submit
    undoStacks = currentAssignment.items.map(() => []);
    renderAssignment();
    showScreen('assignment');
  });

  function showScreen(name) {
    ['entry', 'avatar', 'list', 'settings', 'assignment', 'results', 'parents', 'reading'].forEach((n) => {
      const el = $('screen-' + n);
      if (el) el.classList.toggle('hidden', n !== name);
    });
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Premium TTS via Google Cloud (zh-CN Wavenet voice). Falls back to
  // the browser's Web Speech API if the server-side TTS isn't configured.
  // The MP3 is cached server-side so the second playback of the same
  // sentence is instant + free.
  //
  // Shared <audio> element so we can cancel an in-flight playback when
  // the kid taps a new button (avoids overlap).
  let _ttsAudio = null;
  // Aggressive stop — kills both Google audio AND Web Speech. Called
  // before every new tap so we never get two voices overlapping
  // (user feedback 2026-05-27: "both voices are playing at the same
  // time, the old one plus the Google one").
  function _stopAllSpeech() {
    if (_ttsAudio) {
      try {
        _ttsAudio.pause();
        _ttsAudio.removeAttribute('src');
        _ttsAudio.load();
      } catch (_) {}
      _ttsAudio = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        // Some browsers (iOS Safari) ignore the first cancel — fire
        // twice with a tiny delay so we're sure the queue clears.
        setTimeout(() => { try { window.speechSynthesis.cancel(); } catch (_) {} }, 50);
      } catch (_) {}
    }
  }
  function speakChinese(text, btn) {
    const clean = String(text || '').trim();
    if (!clean) return;
    _stopAllSpeech();

    // UI feedback while loading/playing
    let restoreBtn = null;
    let origText = '';
    if (btn) {
      btn.classList.add('speaking');
      origText = btn.textContent;
      btn.textContent = '🔊 …';
      restoreBtn = () => {
        btn.classList.remove('speaking');
        btn.textContent = origText;
      };
    }

    // Try Google TTS via /api/tts. Wait for canplay before play() — this
    // is the critical fix (2026-05-27): previously play() was called
    // before the audio was ready, causing the promise to reject, which
    // triggered an immediate Web Speech fallback EVERY time. As a result
    // the server-side cache stayed empty and the user only ever heard
    // the bad TTS.
    const url = '/api/tts?text=' + encodeURIComponent(clean);
    const audio = new Audio();
    _ttsAudio = audio;
    let playedOnce = false;
    let fellBack = false;

    const fallback = (reason) => {
      // Never fall back if Google already started playing (success!)
      if (fellBack || playedOnce) return;
      fellBack = true;
      // Kill the audio element so a late-arriving response can't
      // start playing while Web Speech is going
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch (_) {}
      console.warn('[tts] fallback to Web Speech:', reason);
      _showTtsToast('⚠️ Voz mala (' + reason + ')');
      if (restoreBtn) restoreBtn();
      _speakWebSpeech(clean, btn);
    };

    audio.addEventListener('canplay', () => {
      if (fellBack) return;     // already gave up — don't play
      audio.play()
        .then(() => { playedOnce = true; })
        .catch((e) => { if (!playedOnce) fallback('play(): ' + e.message); });
    });
    audio.addEventListener('playing', () => {
      playedOnce = true;
      // Hard kill any Web Speech that might have been queued
      if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      _showTtsToast('🔊 Voz Google ✓', 'good');
      if (timeoutId) clearTimeout(timeoutId);
    });
    audio.addEventListener('ended', () => { if (restoreBtn) restoreBtn(); });
    audio.addEventListener('error', () => {
      if (playedOnce) return;  // ignore errors after successful play
      const msg = audio.error ? `code ${audio.error.code}: ${audio.error.message || ''}` : 'unknown';
      fallback('audio error (' + msg + ')');
    });

    // Overall timeout — if NOTHING has played within 10s, give up.
    // First call to a brand-new sentence takes ~1-2s for Google to
    // synthesize + network round-trip, but should never hit 10s.
    const timeoutId = setTimeout(() => {
      if (!playedOnce) fallback('timeout 10s');
    }, 10000);

    audio.src = url;
    audio.load();
  }

  // Visible TTS state toast — appears top-center for 4s. Used to surface
  // success/failure of the audio system to the user without forcing
  // them into a desktop dev-tools workflow. User can see "Google ✓" or
  // "fallback (reason)" directly on the phone screen.
  let _ttsToastEl = null;
  let _ttsToastTimer = null;
  function _showTtsToast(message, kind) {
    if (!_ttsToastEl) {
      _ttsToastEl = document.createElement('div');
      _ttsToastEl.id = 'hw-tts-toast';
      _ttsToastEl.className = 'hw-tts-toast';
      document.body.appendChild(_ttsToastEl);
    }
    _ttsToastEl.textContent = message;
    _ttsToastEl.classList.remove('good', 'bad', 'show');
    _ttsToastEl.classList.add(kind === 'good' ? 'good' : 'bad', 'show');
    if (_ttsToastTimer) clearTimeout(_ttsToastTimer);
    _ttsToastTimer = setTimeout(() => {
      if (_ttsToastEl) _ttsToastEl.classList.remove('show');
    }, 4000);
  }

  function _speakWebSpeech(text, btn) {
    if (!('speechSynthesis' in window)) {
      if (btn) { btn.classList.remove('speaking'); }
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.85;
      u.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find((v) => /^zh(-CN)?/i.test(v.lang));
      if (zh) u.voice = zh;
      if (btn) {
        const origText = btn.textContent;
        btn.textContent = '🔊 Hablando…';
        u.onend = u.onerror = () => {
          btn.classList.remove('speaking');
          btn.textContent = origText;
        };
      }
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn('speech synthesis failed:', e);
      if (btn) btn.classList.remove('speaking');
    }
  }
  // === MODO CURIOSO FEEDBACK on chip taps ===
  // User feedback 2026-05-27: when kids build sentences in homework,
  // each tap should activate the meaning + animation + sound — make
  // every tap feel like a little discovery.

  // Floating bubble above the chip showing hanzi + Spanish for ~1.4s.
  function _showWordMeaningBubble(chip, w) {
    if (!chip || !w) return;
    const bubble = document.createElement('div');
    bubble.className = 'hw-meaning-bubble';
    const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
    const color = cat ? cat.color : '#5be8d1';
    bubble.style.setProperty('--cat-color', color);
    bubble.innerHTML = `
      <span class="hw-mb-icon">${escapeHtml(w.icon || '✨')}</span>
      <span class="hw-mb-hanzi">${escapeHtml(w.hanzi || '')}</span>
      <span class="hw-mb-pinyin">${escapeHtml(w.pinyin || '')}</span>
      <span class="hw-mb-arrow">→</span>
      <span class="hw-mb-es">${escapeHtml(w.es || '')}</span>`;
    // Position it just above the chip
    const rect = chip.getBoundingClientRect();
    bubble.style.left = (rect.left + rect.width / 2) + 'px';
    bubble.style.top  = (rect.top + window.scrollY - 4) + 'px';
    document.body.appendChild(bubble);
    // Animate in, then fade out. Longer linger so the kid actually reads
    // the meaning (user wanted this to feel like the full curious card).
    requestAnimationFrame(() => bubble.classList.add('show'));
    setTimeout(() => bubble.classList.add('fade'), 1500);
    setTimeout(() => { if (bubble.parentNode) bubble.parentNode.removeChild(bubble); }, 2100);
  }

  // Visual "fly-to-stage" — clones the chip's pinyin and animates it
  // arcing toward the active sentence stage. Pure CSS keyframe spawned
  // on demand, cleaned up after the animation.
  function _flyToStage(chip, itemIdx) {
    const stage = document.getElementById('hw-stage-' + itemIdx);
    if (!stage || !chip) return;
    const src = chip.getBoundingClientRect();
    const dst = stage.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'hw-fly';
    const pinyinEl = chip.querySelector('.hw-lib-pinyin');
    fly.textContent = pinyinEl ? pinyinEl.textContent : '✨';
    fly.style.left = (src.left + src.width / 2) + 'px';
    fly.style.top  = (src.top + window.scrollY + src.height / 2) + 'px';
    // Compute deltas for the animation custom properties
    const dx = (dst.left + dst.width / 2) - (src.left + src.width / 2);
    const dy = (dst.top + window.scrollY + 30) - (src.top + window.scrollY + src.height / 2);
    fly.style.setProperty('--dx', dx + 'px');
    fly.style.setProperty('--dy', dy + 'px');
    document.body.appendChild(fly);
    setTimeout(() => { if (fly.parentNode) fly.parentNode.removeChild(fly); }, 650);
    // Briefly pulse the stage when it receives the word
    setTimeout(() => {
      stage.classList.add('hw-stage-receive');
      setTimeout(() => stage.classList.remove('hw-stage-receive'), 350);
    }, 500);
  }

  // Two-note "discovery" chime — synthesized via WebAudio. Sounds
  // bigger/more curious-mode-like than the old single-blip. Free, no
  // audio files, ~10ms to synthesize.
  let _tapAudioCtx = null;
  function _playTapChime() {
    try {
      if (!_tapAudioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        _tapAudioCtx = new AC();
      }
      const ctx = _tapAudioCtx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      // Two stacked notes — a perfect 5th, classic "discovery" chime
      const playNote = (freq, startOffset, dur, peak) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(peak, t + startOffset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + startOffset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + startOffset);
        osc.stop(t + startOffset + dur + 0.05);
      };
      // Slight random pitch so repeats don't feel mechanical
      const base = 660 + Math.random() * 60;   // E5-ish, slight wobble
      playNote(base,        0.00, 0.25, 0.18);
      playNote(base * 1.5,  0.08, 0.30, 0.15);  // a fifth above
    } catch (e) { /* silent */ }
  }

  // Pre-warm the Web Speech voice list (iOS quirk) for the fallback path.
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {});
    }
  }
})();
