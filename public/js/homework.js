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
    // ⭐ Character roster — uses PNGs from /assets/cutscenes/chars/
    gojo:   '👁 Gojo',    yugi:   '🃏 Yugi',    yuji:   '👊 Yuji',    shelly: '🔫 Shelly',
    fnaf:   '🎩 Freddy', dandy:  '🌻 Dandy',   hanzo:  '⚔️ Hanzō',  mei2:   '🧙‍♀️ Méi M.',
    dralingo:'🐲 Dralingo', naruto:'🍥 Naruto', sasuke: '⚡ Sasuke', luffy:  '🏴‍☠️ Luffy',
    goku:   '🥋 Goku',   pikachu:'⚡ Pikachu', sonic:  '💨 Sonic',  mario:  '🍄 Mario',
    kirby:  '🌸 Kirby',  spiderman:'🕷 Spider', ironman:'🤖 Iron Man', elsa: '❄️ Elsa', moana: '🌊 Moana',
    squirtle: '🐢 Squirtle',
  };
  // Set of names that resolve to PNGs in /assets/cutscenes/chars/ instead
  // of SVGs in /assets/avatars/. These come from the character system.
  const CHAR_AVATAR_NAMES = new Set([
    'gojo','yugi','yuji','shelly','fnaf','dandy','hanzo','mei2','dralingo',
    'naruto','sasuke','luffy','goku','pikachu','sonic','mario','kirby',
    'spiderman','ironman','elsa','moana','squirtle',
  ]);
  // 🐢 Squirtle uses the user's transparent dancing GIF directly (in the
  // /assets/png-library/ folder), not the standard /cutscenes/chars/
  // path. Mapped here so avatarSrc returns the right URL.
  const CUSTOM_AVATAR_URLS = {
    squirtle: '/assets/png-library/Squirtle%20animation.gif',
    // Transparent dancing GIFs override the static PNGs so the avatar
    // moves wherever it appears (homework portal, parent roster,
    // builder header, force-impose modal).
    gojo:     '/assets/png-library/GOJO%20TRANSPARENT.gif',
    yugi:     '/assets/png-library/YUGI%20TRANSPARENT.gif',
    fnaf:     '/assets/png-library/FREDDY%20TRANSPARENT.gif',
    mario:    '/assets/png-library/MARIO%20TRANSPARENT.gif',
    sonic:    '/assets/png-library/SONIC%20TRANSPARENT.gif',
    elsa:     '/assets/png-library/ELSA%20TRANSPARENT.gif',
  };
  // ?v bumped whenever the avatar ART is regenerated (same filenames, new
  // look) so browsers don't serve the stale cached SVG. 2026-05-28: fresh
  // cooler DiceBear set.
  const AVATAR_ASSET_VER = '20260528b';
  function avatarSrc(name) {
    // 🐢 Custom-URL avatars (e.g. squirtle → transparent dancing GIF
    // in /assets/png-library/). Win over everything below.
    if (CUSTOM_AVATAR_URLS[name]) return CUSTOM_AVATAR_URLS[name];
    // Character roster uses pose-A PNG from cutscenes folder.
    if (CHAR_AVATAR_NAMES.has(name)) {
      return '/assets/cutscenes/chars/' + name + '-a.png?v=' + AVATAR_ASSET_VER;
    }
    return '/assets/avatars/' + encodeURIComponent(name) + '.svg?v=' + AVATAR_ASSET_VER;
  }
  function isSvgAvatar(v) {
    return typeof v === 'string' && /^[a-z0-9]+$/.test(v) && AVATAR_LABELS[v];
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
  let customAssignments = [];  // 🎯 teacher-sent tareas especiales for me
  // Default lands on ⏳ Pendientes — kid's TODO list. "pending" includes both
  // brand-new tareas AND ones tried below 80%. Per user: "by default it
  // should enter in pending and only show the pending."
  let customFilter = 'pending';    // pill filter: pending | done | all (legacy)
  // 🗂️ NEW 3-TAB STATE — default to "pending" so the kid sees what they
  // still owe first. Tabs are MUTUALLY EXCLUSIVE and never mix items.
  //   pending → HSK1 folders/items NOT done
  //   done    → HSK1 folders/items DONE
  //   custom  → tareas the teacher sent ME (flat list, both done + pending)
  let currentTab = 'pending';
  function makeCuPill(id, label, count) {
    return '<button class="hw-cf-pill' + (customFilter === id ? ' is-active' : '')
      + (count === 0 ? ' is-empty' : '') + '" data-f="' + id + '" type="button">'
      + label + ' <span class="hw-cf-count">' + count + '</span></button>';
  }
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
    // Timezone first — the phone's clock region is far more reliable than the
    // UI language. A child in Mexico with an English (en-US) phone must not be
    // reported as "US"; their timezone (America/Mexico_City) gives the truth.
    const TZ_COUNTRY = {
      'Mexico_City': 'MX', 'Tijuana': 'MX', 'Monterrey': 'MX', 'Cancun': 'MX',
      'Merida': 'MX', 'Hermosillo': 'MX', 'Mazatlan': 'MX', 'Matamoros': 'MX',
      'Shanghai': 'CN', 'Chongqing': 'CN', 'Urumqi': 'CN', 'Hong_Kong': 'HK',
      'Taipei': 'TW', 'Macau': 'MO', 'Singapore': 'SG',
      'Bogota': 'CO', 'Lima': 'PE', 'Buenos_Aires': 'AR', 'Santiago': 'CL',
      'Guayaquil': 'EC', 'Caracas': 'VE', 'La_Paz': 'BO', 'Asuncion': 'PY',
      'Montevideo': 'UY', 'Guatemala': 'GT', 'Tegucigalpa': 'HN',
      'San_Salvador': 'SV', 'Managua': 'NI', 'Costa_Rica': 'CR', 'Panama': 'PA',
      'Santo_Domingo': 'DO', 'Havana': 'CU', 'Puerto_Rico': 'PR',
      'Madrid': 'ES', 'Ceuta': 'ES', 'Canary': 'ES',
      'New_York': 'US', 'Los_Angeles': 'US', 'Chicago': 'US', 'Denver': 'US',
      'Phoenix': 'US', 'Anchorage': 'US', 'Honolulu': 'US',
    };
    const city = String(tz || '').split('/').pop();
    if (city && TZ_COUNTRY[city]) return TZ_COUNTRY[city];
    // Fall back to the locale region only when the timezone is unknown.
    const m = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(locale || '');
    if (m) return m[1].toUpperCase();
    return city ? city.replace(/_/g, ' ') : null;
  }

  // ── Pre-fill remembered values
  try {
    const savedAccess = localStorage.getItem(STORAGE_ACCESS_KEY) || '';
    const savedCode = localStorage.getItem(STORAGE_CODE_KEY) || '';
    if (savedAccess) $('hw-access-code').value = savedAccess;
    if (savedCode) $('hw-student-code').value = savedCode;
  } catch (_) {}

  // ── Arriving with a hand-off from another portal page? Two sources:
  //   • Modo Maestro player end-screen sends ?code=ABCD&from=maestro
  //   • HSK simulation Inicio button sends ?code=ABCD&from=hsk-sim
  // Either way, pre-fill the student code; if the access code is
  // remembered on this device, fire tryEnter() automatically so the
  // kid lands on their portal home with zero taps. 2026-06-08 (Fernando):
  // "Inicio should take you to the homework portal" — was dropping the
  // kid on the login screen instead of straight into their home.
  try {
    const params = new URLSearchParams(location.search);
    const fromCode = (params.get('code') || '').trim().toUpperCase();
    if (fromCode && /^[A-Z2-9]{4,5}$/.test(fromCode)) {
      $('hw-student-code').value = fromCode;
      const remembered = (localStorage.getItem(STORAGE_ACCESS_KEY) || '').trim();
      const from = params.get('from');
      const trustedSources = ['maestro', 'hsk-sim'];
      if (trustedSources.includes(from) && remembered) {
        $('hw-access-code').value = remembered;
        // Defer one tick so the entry screen + DOM are fully ready.
        setTimeout(() => { try { tryEnter(); } catch (_) {} }, 60);
      }
    }
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
        // Pull the daily progression HUD (XP / swords / streak) right away.
        try { refreshDailyHud(); } catch (_) {}
        try { refreshCustomAssignments(); } catch (_) {}
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
        // 🆕 2026-06-21 (Fernando) — a force call only means "come NOW", so it
        // goes STALE after 4 min. Without this, a kid opening their portal long
        // after the teacher called would be yanked into a room that ended ages
        // ago ("called to old rooms that no longer exist"). Stale forces are
        // marked read and ignored; only a fresh call redirects.
        const FORCE_TTL = 4 * 60 * 1000;
        _inbox
          .filter((m) => !m.readAt && m.actionType === 'force' && (Date.now() - (m.ts || 0)) >= FORCE_TTL)
          .forEach((m) => {
            fetch('/api/homework/inbox/' + encodeURIComponent(m.id) + '/read?accessCode=' + encodeURIComponent(accessCode), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studentCode }),
            }).catch(() => {});
          });
        const force = _inbox.find((m) => !m.readAt && m.actionType === 'force' && m.actionUrl && (Date.now() - (m.ts || 0)) < FORCE_TTL);
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
        // 🆕 2026-06-21 (Fernando) — GOHOME: the teacher hit "send to homework
        // profile". The heartbeat path handles kids stuck in a room; this
        // branch handles a kid who's ALREADY on /homework but maybe stuck on a
        // sub-screen — mark it read and reload to a clean profile.
        const gohome = _inbox.find((m) => !m.readAt && m.actionType === 'gohome');
        if (gohome) {
          fetch('/api/homework/inbox/' + encodeURIComponent(gohome.id) + '/read?accessCode=' + encodeURIComponent(accessCode), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentCode }),
          }).finally(() => {
            location.replace('/homework?code=' + encodeURIComponent(studentCode) + '&from=maestro');
          });
          return;
        }
        // 🆕 2026-06-08 (Fernando) — ANIM messages: the teacher tapped
        // the GIF picker on /maestro and sent a dancing-mascot to this
        // kid. Show a full-screen transparent overlay for 8 seconds,
        // mark read so it doesn't replay on the next poll. Designed
        // around "fun reward" not "obligation" — no redirect, kid
        // stays exactly where they are, the mascot just dances over
        // whatever they were doing then disappears.
        const anim = _inbox.find((m) => !m.readAt && m.actionType === 'anim' && m.actionUrl);
        if (anim) {
          fetch('/api/homework/inbox/' + encodeURIComponent(anim.id) + '/read?accessCode=' + encodeURIComponent(accessCode), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentCode }),
          }).catch(() => {});
          _showAnimOverlay(anim);
          return;
        }
        // Normal unread → surface a toast
        if (_inboxUnread > prevUnread && prevUnread >= 0) {
          showInboxToast(_inbox[0]);
        }
      }).catch(() => {});
  }
  // Full-screen takeover when the teacher force-pushes a live session.
  // Shows the "tu maestra te llama" splash, then hard-redirects.
  //
  // 🆕 2026-06-08 (Fernando bug fix): a small "✕ Cancelar" chip is now
  // available so the kid can opt out if the room is dead. Without it,
  // the kid was being yanked into /player.html?pin=XXX, the join would
  // fail (room ended, PIN gone), and they'd be permanently stuck on a
  // useless screen with no way back to their portal — Fernando's words:
  // "I literally can't... it feels like I'm still being pulled in, but
  // there's no room." We DO NOT weaken the force-pull mechanic itself
  // (Fernando: "I like how stable this is"); we just add a safety hatch.
  function _showForceTakeover(msg) {
    if (document.getElementById('hw-force-takeover')) return;  // already going
    const ov = document.createElement('div');
    ov.id = 'hw-force-takeover';
    ov.className = 'hw-force-takeover';
    ov.innerHTML = `
      <button class="hw-force-cancel" id="hw-force-cancel" type="button" aria-label="Cancelar">✕ Cancelar</button>
      <div class="hw-force-card">
        <div class="hw-force-dragon">🐉</div>
        <div class="hw-force-title">¡Tu maestra te llama!</div>
        <div class="hw-force-text">${escapeHtml(msg.text || '¡Únete a la sesión en vivo ahora!')}</div>
        <div class="hw-force-spinner">Entrando en <span id="hw-force-count">3</span>…</div>
        <div class="hw-force-hint">¿No deberías estar aquí? Toca <strong>✕ Cancelar</strong> arriba.</div>
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
      if (!u.searchParams.get('code') && studentCode) u.searchParams.set('code', studentCode);
      dest = u.pathname + u.search;
    } catch (_) { /* keep original */ }
    // Visible 3-second countdown so it never feels like a freeze, and
    // gives the kid 3s of opportunity to cancel.
    let cancelled = false;
    let secs = 3;
    const countEl = document.getElementById('hw-force-count');
    const tick = setInterval(() => {
      secs--;
      if (countEl) countEl.textContent = String(Math.max(0, secs));
      if (secs <= 0) clearInterval(tick);
    }, 1000);
    const redirectT = setTimeout(() => {
      if (cancelled) return;
      window.location.href = dest;
    }, 3200);
    document.getElementById('hw-force-cancel').addEventListener('click', () => {
      cancelled = true;
      clearTimeout(redirectT);
      clearInterval(tick);
      try { ov.remove(); } catch (_) {}
      // The message is already marked-read on the server (we did it
      // before showing the takeover, line ~322). No re-fire possible.
    });
  }

  // 🆕 2026-06-08 (Fernando) — kid-side mascot overlay. 8s, transparent
  // PNG/GIF over whatever the kid was doing, auto-dismisses. Doesn't
  // block taps under it (pointer-events: none). The GIF asset has 1yr
  // immutable cache so after first download it's instant.
  function _showAnimOverlay(msg) {
    if (document.getElementById('hw-anim-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'hw-anim-overlay';
    ov.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'display:flex', 'align-items:center', 'justify-content:center',
      'pointer-events:none',                  // kid can keep tapping under
      'background:rgba(0,0,0,0)',
      'animation:hwAnimFade 0.4s ease',
    ].join(';');
    const img = document.createElement('img');
    img.src = msg.actionUrl;
    img.alt = msg.actionLabel || '';
    img.style.cssText = 'max-width:78vw;max-height:78vh;object-fit:contain;filter:drop-shadow(0 8px 30px rgba(0,0,0,0.45));';
    ov.appendChild(img);
    // Small banner so kid knows it's from their teacher
    const tag = document.createElement('div');
    tag.style.cssText = 'position:absolute;top:24px;left:50%;transform:translateX(-50%);background:rgba(91,232,209,0.18);border:2px solid rgba(91,232,209,0.55);padding:8px 18px;border-radius:14px;color:#fff5d8;font-weight:900;font-size:0.95rem;letter-spacing:0.06em;';
    tag.textContent = '🎁 ¡Te llegó algo de tu maestra! ' + (msg.actionLabel || '');
    ov.appendChild(tag);
    if (!document.getElementById('hw-anim-style')) {
      const s = document.createElement('style');
      s.id = 'hw-anim-style';
      s.textContent = '@keyframes hwAnimFade{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(ov);
    setTimeout(() => { try { ov.remove(); } catch (_) {} }, 8000);
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
  // 📜 Mis oraciones — kid's saved warmup sentences + 🔊 listen.
  $('hw-list-sentences').addEventListener('click', openMySentences);
  $('hw-sentences-close').addEventListener('click', () => $('hw-sentences-overlay').classList.add('hidden'));
  const sentCornerClose = $('hw-sentences-corner-close');
  if (sentCornerClose) sentCornerClose.addEventListener('click', () => $('hw-sentences-overlay').classList.add('hidden'));
  $('hw-sentences-overlay').addEventListener('click', (e) => { if (e.target === $('hw-sentences-overlay')) $('hw-sentences-overlay').classList.add('hidden'); });

  // 📝 Mis exámenes — kid's HSK simulation history with per-attempt
  // mistake review. Same access pattern as Mis Oraciones. Fernando
  // 2026-06-04: "they should immediately see what they got wrong in
  // the records".
  const myexamsBtn = $('hw-list-myexams');
  if (myexamsBtn) myexamsBtn.addEventListener('click', openMyExams);
  const myexamsClose = $('hw-myexams-close');
  if (myexamsClose) myexamsClose.addEventListener('click', () => $('hw-myexams-overlay').classList.add('hidden'));
  const myexamsOv = $('hw-myexams-overlay');
  if (myexamsOv) myexamsOv.addEventListener('click', (e) => { if (e.target === myexamsOv) myexamsOv.classList.add('hidden'); });
  function openMyExams() {
    const ov = $('hw-myexams-overlay');
    if (!ov) return;
    ov.classList.remove('hidden');
    const list = $('hw-myexams-list');
    list.innerHTML = '<div class="hw-empty">Cargando…</div>';
    fetch('/api/homework/my-hsk-attempts/' + encodeURIComponent(studentCode)
        + '?accessCode=' + encodeURIComponent(accessCode) + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => renderMyExams((data && data.attempts) || []))
      .catch((e) => { list.innerHTML = '<div class="hw-empty">Error: ' + e.message + '</div>'; });
  }
  function renderMyExams(attempts) {
    const list = $('hw-myexams-list');
    if (!attempts.length) {
      list.innerHTML = '<div class="hw-empty">Aún no has hecho ningún examen HSK. Cuando tu maestra abra una sala de examen, tu primer intento aparecerá aquí. 📝</div>';
      return;
    }
    list.innerHTML = '';
    attempts.forEach((a) => {
      const card = document.createElement('div');
      const passed = (a.percent != null) && a.percent >= 60;
      card.className = 'hw-myexams-attempt ' + (passed ? 'is-passed' : 'is-low');
      const dateStr = new Date(a.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const pctStr = (a.percent != null) ? Math.round(a.percent) + '%' : '—';
      const wrongPart = a.hasBreakdown
        ? '<span class="hw-myexams-attempt-wrong">' + (a.wrongCount === 0 ? '🎉 ¡Sin errores!' : '❌ ' + a.wrongCount + ' incorrecta' + (a.wrongCount === 1 ? '' : 's')) + '</span>'
        : '<span class="hw-myexams-attempt-wrong is-stale">Detalle no guardado (intento anterior)</span>';
      card.innerHTML =
        '<div class="hw-myexams-attempt-head">' +
          '<span class="hw-myexams-attempt-title">' + escapeHtml(a.title) + '</span>' +
          '<span class="hw-myexams-attempt-pct">' + pctStr + '</span>' +
        '</div>' +
        '<div class="hw-myexams-attempt-meta">' +
          '<span>📅 ' + dateStr + '</span>' +
          '<span>' + a.score + '/' + a.total + ' pts</span>' +
          wrongPart +
        '</div>';
      const detail = document.createElement('div');
      detail.className = 'hw-myexams-attempt-detail hidden';
      let loaded = false;
      // Only allow expanding if the attempt has breakdown data.
      if (a.hasBreakdown) {
        card.classList.add('is-clickable');
        const hint = document.createElement('div');
        hint.className = 'hw-myexams-attempt-hint';
        hint.textContent = '▶ Toca para ver detalle';
        card.appendChild(hint);
        card.addEventListener('click', () => {
          const open = !detail.classList.contains('hidden');
          if (open) {
            detail.classList.add('hidden');
            hint.textContent = '▶ Toca para ver detalle';
            return;
          }
          detail.classList.remove('hidden');
          hint.textContent = '▼ Ocultar detalle';
          if (loaded) return;
          loaded = true;
          detail.innerHTML = '<div class="hw-empty">Cargando…</div>';
          fetch('/api/homework/my-hsk-attempt/' + encodeURIComponent(studentCode)
              + '?accessCode=' + encodeURIComponent(accessCode) + '&studentCode=' + encodeURIComponent(studentCode)
              + '&ts=' + encodeURIComponent(a.ts))
            .then((r) => r.json())
            .then((d) => {
              if (!d || !d.ok) {
                detail.innerHTML = '<div class="hw-empty">No se pudo cargar: ' + escapeHtml(d && d.error || 'error') + '</div>';
                return;
              }
              if (!d.wrongQs || !d.wrongQs.length) {
                detail.innerHTML = '<div class="hw-myexams-perfect">🎉 ¡Cero errores en este examen! Eres una estrella.</div>';
                return;
              }
              const rows = d.wrongQs.map((wq) => {
                const titleParts = [];
                titleParts.push((wq.partLabel || wq.qid) + (wq.qNum ? ', pregunta ' + wq.qNum : ''));
                if (wq.questionLabel) titleParts.push('"' + escapeHtml(wq.questionLabel) + '"');
                return '<div class="hw-myexams-wrong-row">' +
                  '<div class="hw-myexams-wrong-q">❌ ' + titleParts.join(' · ') + '</div>' +
                  '<div class="hw-myexams-wrong-d">' +
                    '<span>Elegiste: <strong class="hw-myexams-wrong-picked">' + escapeHtml(wq.givenLabel) + '</strong></span>' +
                    '<span>Correcta: <strong class="hw-myexams-wrong-correct">' + escapeHtml(wq.expectedLabel) + '</strong></span>' +
                  '</div>' +
                '</div>';
              }).join('');
              detail.innerHTML = '<div class="hw-myexams-detail-head">Repasa estas para la próxima vez:</div>' + rows;
            })
            .catch((e) => { detail.innerHTML = '<div class="hw-empty">Error: ' + escapeHtml(e.message) + '</div>'; });
        });
      }
      card.appendChild(detail);
      list.appendChild(card);
    });
  }
  function openMySentences() {
    const ov = $('hw-sentences-overlay');
    ov.classList.remove('hidden');
    loadMySentences();
  }
  function loadMySentences() {
    const list = $('hw-sentences-list');
    list.innerHTML = '<div class="hw-empty">Cargando…</div>';
    fetch('/api/homework/sentences/' + encodeURIComponent(studentCode)
        + '?accessCode=' + encodeURIComponent(accessCode) + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => renderMySentences((data && data.sentences) || []))
      .catch((e) => { list.innerHTML = '<div class="hw-empty">Error: ' + e.message + '</div>'; });
  }
  // 🆕 2026-06-04 v2 — tab state for Mis Oraciones (Fernando: "split
  // into Saved by Me and Sent by Teacher"). 'mine' shows kid-saved,
  // 'teacher' shows pushedByTeacher sentences. Category filter only
  // applies inside the teacher tab.
  let _hwSentTab = 'mine';
  let _hwSentCat = '';   // '' = all categories, '__uncat__' = no category, or a category id
  let _hwSentLast = [];
  function renderMySentences(arr) {
    _hwSentLast = Array.isArray(arr) ? arr : [];
    const list = $('hw-sentences-list');
    const teacherArr = _hwSentLast.filter((s) => s.pushedByTeacher);
    const mineArr = _hwSentLast.filter((s) => !s.pushedByTeacher);
    const nMine = $('hw-sent-tab-n-mine');     if (nMine) nMine.textContent = mineArr.length;
    const nTea  = $('hw-sent-tab-n-teacher');  if (nTea)  nTea.textContent  = teacherArr.length;
    // Wire tab buttons (once) — uses delegated handler so this stays
    // safe across re-renders.
    if (!list.dataset.tabsWired) {
      list.dataset.tabsWired = '1';
      document.querySelectorAll('.hw-sent-tab').forEach((t) => {
        t.addEventListener('click', () => {
          _hwSentTab = t.dataset.tab;
          if (_hwSentTab !== 'teacher') _hwSentCat = '';
          document.querySelectorAll('.hw-sent-tab').forEach((x) => x.classList.toggle('is-active', x.dataset.tab === _hwSentTab));
          renderMySentences(_hwSentLast);
        });
      });
    }
    // Category filter chips — only on teacher tab AND only if there's
    // anything categorized OR uncategorized teacher push.
    const catbar = $('hw-sent-catbar');
    if (catbar) {
      catbar.innerHTML = '';
      if (_hwSentTab === 'teacher' && teacherArr.length) {
        const countsByCat = {};
        teacherArr.forEach((s) => {
          const k = s.category || '';
          countsByCat[k] = (countsByCat[k] || 0) + 1;
        });
        const presentCats = (window.SENTENCE_CATEGORIES || []).filter((c) => countsByCat[c.id]);
        const uncategorisedCount = countsByCat[''] || 0;
        if (presentCats.length || uncategorisedCount) {
          catbar.classList.remove('is-empty');
          const allChip = document.createElement('button');
          allChip.className = 'hw-sent-cat-chip' + (_hwSentCat === '' ? ' is-active' : '');
          allChip.type = 'button'; allChip.dataset.cat = '';
          allChip.innerHTML = '✨ Todas <span class="hw-sent-cat-n">' + teacherArr.length + '</span>';
          catbar.appendChild(allChip);
          presentCats.forEach((c) => {
            const chip = document.createElement('button');
            chip.className = 'hw-sent-cat-chip' + (_hwSentCat === c.id ? ' is-active' : '');
            chip.type = 'button'; chip.dataset.cat = c.id;
            chip.style.setProperty('--cat-color', c.color);
            chip.innerHTML = c.emoji + ' ' + escapeHtml(c.label) + ' <span class="hw-sent-cat-n">' + countsByCat[c.id] + '</span>';
            catbar.appendChild(chip);
          });
          if (uncategorisedCount) {
            const chip = document.createElement('button');
            chip.className = 'hw-sent-cat-chip' + (_hwSentCat === '__uncat__' ? ' is-active' : '');
            chip.type = 'button'; chip.dataset.cat = '__uncat__';
            chip.innerHTML = '🚫 Sin categoría <span class="hw-sent-cat-n">' + uncategorisedCount + '</span>';
            catbar.appendChild(chip);
          }
          catbar.querySelectorAll('.hw-sent-cat-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
              _hwSentCat = chip.dataset.cat;
              renderMySentences(_hwSentLast);
            });
          });
        } else {
          catbar.classList.add('is-empty');
        }
      } else {
        catbar.classList.add('is-empty');
      }
    }
    // Filter to current tab + category
    let shown = (_hwSentTab === 'teacher') ? teacherArr : mineArr;
    if (_hwSentTab === 'teacher' && _hwSentCat) {
      shown = (_hwSentCat === '__uncat__')
        ? shown.filter((s) => !s.category)
        : shown.filter((s) => s.category === _hwSentCat);
    }
    if (!shown.length) {
      const msg = (_hwSentTab === 'teacher')
        ? 'Aún no te han enviado oraciones. Cuando tu maestra te envíe una, aparecerá aquí. 📤'
        : 'Aún no has guardado oraciones. Toca 💾 en clase para guardar una. 🌱';
      list.innerHTML = '<div class="hw-empty">' + msg + '</div>';
      return;
    }
    list.innerHTML = '';
    // 🗂️ Group by month — newest month on top, expanded by default. Each
    // older month is collapsed so the kid can browse without overwhelm.
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const buckets = {};
    shown.forEach((s) => {
      const d = s.ts ? new Date(s.ts) : new Date();
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(s);
    });
    const keys = Object.keys(buckets).sort().reverse();
    keys.forEach((key, kIdx) => {
      const [y, mo] = key.split('-');
      const folder = document.createElement('details');
      folder.className = 'hw-sentences-month';
      if (kIdx === 0) folder.open = true;
      const summary = document.createElement('summary');
      summary.className = 'hw-sentences-month-head';
      summary.innerHTML = '<span class="hw-sm-icon">📅</span>'
        + '<span class="hw-sm-name">' + (monthNames[Number(mo) - 1] || mo) + ' ' + y + '</span>'
        + '<span class="hw-sm-count">' + buckets[key].length + ' oración' + (buckets[key].length === 1 ? '' : 'es') + '</span>';
      folder.appendChild(summary);
      const body = document.createElement('div');
      body.className = 'hw-sentences-month-body';
      folder.appendChild(body);
      list.appendChild(folder);
      renderMonthBucket(buckets[key], body);
    });
  }
  function renderMonthBucket(arr, list) {
    arr.forEach((s) => {
      // 🔧 Don't drop sentences whose IDs aren't in the catalog (daily-bonus
      // saves use the same wordbank, but a stale/renamed ID would silently
      // vanish before — making the kid think their save "didn't work").
      // Now we render a stub chip for unknown IDs so the entry still shows.
      // Custom-word snapshot (teacher words typed at runtime, ids
      // like "cw..."). Falls back BEFORE the wid-as-pinyin stub so
      // Google TTS reads real pinyin instead of the internal code.
      const _customMap = {};
      if (Array.isArray(s.customWords)) {
        s.customWords.forEach((cw) => { if (cw && cw.id) _customMap[cw.id] = cw; });
      }
      const words = (s.words || []).map((wid) => {
        const w = window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid];
        if (w) return w;
        if (_customMap[wid]) return _customMap[wid];
        return { id: wid, pinyin: String(wid), es: '', cat: '' };
      });
      if (!words.length) return;
      const pinyin = words.map((w) => w.pinyin).join(' ');
      const dateStr = s.ts ? new Date(s.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const item = document.createElement('div');
      item.className = 'hw-sentence-item';
      const wordsWrap = document.createElement('div');
      wordsWrap.className = 'hw-sentence-words';
      words.forEach((w) => wordsWrap.appendChild(makeSentChip(w)));
      const head = document.createElement('div');
      head.className = 'hw-sentence-row';
      // 📤 Surface the teacher-pushed badge so kid + parent know
      // this sentence came from the teacher (not the kid's own work).
      const teacherBadge = s.pushedByTeacher
        ? '<span class="hw-sentence-from-teacher" title="' + escapeHtml(s.teacherName || 'Maestro/a') + '">📤 De tu maestra</span>'
        : '';
      head.innerHTML = `
        <span class="hw-sentence-date">📅 ${dateStr}${teacherBadge}</span>
        <div class="hw-sentence-actions">
          <button class="hw-sentence-speak" type="button" title="Escuchar">🔊 Oír</button>
          <button class="hw-sentence-edit" type="button" title="Editar y guardar copia">✏️ Editar</button>
          <button class="hw-sentence-del" type="button" title="Borrar">🗑</button>
        </div>`;
      head.querySelector('.hw-sentence-speak').addEventListener('click', (e) => speakChinese(pinyin, e.currentTarget));
      head.querySelector('.hw-sentence-edit').addEventListener('click', () => openSentenceEditor(s.words.slice()));
      head.querySelector('.hw-sentence-del').addEventListener('click', () => {
        if (!confirm('¿Borrar esta oración guardada?')) return;
        fetch('/api/homework/sentences/delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentCode, accessCode, ts: s.ts }),
        }).then((r) => r.json()).then((d) => { if (d && d.ok) renderMySentences(d.sentences || []); else alert('No se pudo borrar.'); })
          .catch(() => alert('No se pudo borrar.'));
      });
      item.appendChild(head);
      item.appendChild(wordsWrap);
      list.appendChild(item);
    });
    if (!list.children.length) list.innerHTML = '<div class="hw-empty">Aún no hay oraciones guardadas.</div>';
  }
  // One word chip — curious-tappable (tap → big animated card, like everywhere).
  function makeSentChip(w) {
    const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
    const color = cat ? cat.color : '#ffe082';
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'hw-sent-chip curious-tappable';
    chip.style.setProperty('--cat-color', color);
    chip.innerHTML = `<span class="hw-sent-chip-py">${escapeHtml(w.pinyin)}</span><span class="hw-sent-chip-es">${escapeHtml(w.es || '')}</span>`;
    chip.addEventListener('click', () => hwShowPokedex(w));
    return chip;
  }
  // ── Editor: rearrange / remove words, then "Guardar copia" (original kept).
  let _editWords = [];
  function openSentenceEditor(wids) {
    _editWords = (wids || []).filter((wid) => window.WU_WORD_BY_ID && window.WU_WORD_BY_ID[wid]);
    _editSwapIdx = null;
    _editReorder = false;
    renderSentenceEditor();
  }
  let _editSwapIdx = null;
  let _editReorder = false;   // false = tap removes · true = tap-swap to reorder
  function renderSentenceEditor() {
    const list = $('hw-sentences-list');
    const ed = document.createElement('div');
    ed.className = 'hw-sent-editor';
    const tip = _editReorder
      ? 'Toca una palabra y luego otra para <strong>cambiarlas de lugar</strong>.'
      : 'Toca una palabra para <strong>quitarla</strong>. Activa 🔀 Mover para reordenar.';
    ed.innerHTML = `
      <div class="hw-sent-editor-tip">${tip}</div>
      <div class="hw-sent-editor-words" id="hw-sent-editor-words"></div>
      <div class="hw-sent-editor-bar">
        <button class="hw-sent-editor-cancel" type="button">← Volver</button>
        <button class="hw-sent-editor-move${_editReorder ? ' active' : ''}" type="button">${_editReorder ? '✅ Moviendo' : '🔀 Mover'}</button>
        <button class="hw-sent-editor-listen" type="button">🔊 Oír</button>
        <button class="hw-sent-editor-save" type="button">💾 Guardar copia</button>
      </div>`;
    list.innerHTML = '';
    list.appendChild(ed);
    const wrap = ed.querySelector('#hw-sent-editor-words');
    _editWords.forEach((wid, idx) => {
      const w = window.WU_WORD_BY_ID[wid];
      const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
      const color = cat ? cat.color : '#ffe082';
      const chip = document.createElement('div');
      chip.className = 'hw-sent-edit-chip' + (_editSwapIdx === idx ? ' selected' : '') + (_editReorder ? ' moving' : '');
      chip.style.setProperty('--cat-color', color);
      chip.title = _editReorder ? 'Toca para mover' : 'Toca para quitar';
      chip.innerHTML = `
        <span class="hw-sent-chip-py">${escapeHtml(w.pinyin)}</span>
        <span class="hw-sent-chip-es">${escapeHtml(w.es || '')}</span>`;
      chip.addEventListener('click', () => {
        if (!_editReorder) {
          // Default: tap removes (no scary ✕).
          _editWords.splice(idx, 1); _editSwapIdx = null; renderSentenceEditor();
          return;
        }
        // Reorder mode: tap-select then tap-target swaps.
        if (_editSwapIdx === null) { _editSwapIdx = idx; }
        else if (_editSwapIdx === idx) { _editSwapIdx = null; }
        else {
          const tmp = _editWords[_editSwapIdx]; _editWords[_editSwapIdx] = _editWords[idx]; _editWords[idx] = tmp;
          _editSwapIdx = null;
        }
        renderSentenceEditor();
      });
      wrap.appendChild(chip);
    });
    if (!_editWords.length) wrap.innerHTML = '<div class="hw-empty">Oración vacía — agrega palabras en clase.</div>';
    const moveBtn = ed.querySelector('.hw-sent-editor-move');
    if (moveBtn) moveBtn.addEventListener('click', () => { _editReorder = !_editReorder; _editSwapIdx = null; renderSentenceEditor(); });
    ed.querySelector('.hw-sent-editor-cancel').addEventListener('click', loadMySentences);
    ed.querySelector('.hw-sent-editor-listen').addEventListener('click', (e) => {
      const py = _editWords.map((wid) => window.WU_WORD_BY_ID[wid].pinyin).join(' ');
      if (py) speakChinese(py, e.currentTarget);
    });
    ed.querySelector('.hw-sent-editor-save').addEventListener('click', () => {
      if (!_editWords.length) { alert('La oración está vacía.'); return; }
      fetch('/api/homework/sentences/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCode, accessCode, words: _editWords }),
      }).then((r) => r.json()).then((d) => { if (d && d.ok) renderMySentences(d.sentences || []); else alert('No se pudo guardar.'); })
        .catch(() => alert('No se pudo guardar.'));
    });
  }
  // 🔍 Modo Curioso card — same big animated overlay used everywhere.
  function hwShowPokedex(w) {
    const overlay = $('wu-pokedex'); const card = $('wu-pokedex-card');
    if (!overlay || !card) return;
    const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
    const exp = window.WU_EXPERIENCES && window.WU_EXPERIENCES[w.exp];
    const color = cat ? cat.color : '#fff';
    card.style.setProperty('--cat-color', color);
    card.innerHTML = `
      <div class="wu-pk-icon">${w.icon || '✨'}</div>
      <div class="wu-pk-pinyin">${escapeHtml(w.pinyin)}</div>
      <div class="wu-pk-hanzi">${escapeHtml(w.hanzi || '')}</div>
      <div class="wu-pk-es">${escapeHtml(w.es || '')}</div>
      <div class="wu-pk-meta">
        <div class="wu-pk-chip cat" style="background:${color}; color:#0a1320;">${escapeHtml((cat && cat.label) || w.cat || '')}</div>
        <div class="wu-pk-chip exp">${escapeHtml((exp && exp.short) || w.exp || '')}</div>
      </div>
      <div class="wu-pk-actions"><button class="wu-pk-speak" type="button">🔊 Escuchar</button></div>
      <div class="wu-pk-hint">Toca fuera para cerrar</div>`;
    const sp = card.querySelector('.wu-pk-speak');
    if (sp) sp.addEventListener('click', (e) => { e.stopPropagation(); speakChinese(w.pinyin, e.currentTarget); });
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('show'));
  }
  function hwHidePokedex() {
    const overlay = $('wu-pokedex');
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(() => overlay.classList.add('hidden'), 250);
  }
  (function bindHwPokedex() {
    const overlay = $('wu-pokedex'); const close = $('wu-pokedex-close');
    if (close) close.addEventListener('click', hwHidePokedex);
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) hwHidePokedex(); });
  })();

  // =====================================================================
  // ⚔️ DIARIO — daily challenge · XP · tiers · DralySwords ⚔️ · streak 🔥
  // A daily 3D mini-game: slash food 🍉, pet animals/people 🐶, launch
  // verbs/abstract 🏃 — the HSK1 word reveals after each. Awards XP +
  // DralySwords; a streak rewards returning daily; tiers Bronce→Dragón
  // Dorado. The top prizes are real-world SECRETS the teacher arranges.
  // =====================================================================
  let dailyData = null;
  function localDateStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fetchDaily(cb) {
    if (!studentCode || !accessCode) { if (cb) cb(null); return; }
    fetch('/api/homework/daily?studentCode=' + encodeURIComponent(studentCode)
        + '&accessCode=' + encodeURIComponent(accessCode) + '&date=' + localDateStr())
      .then((r) => r.json())
      .then((d) => { if (d && d.ok) dailyData = d; if (cb) cb(d); })
      .catch(() => { if (cb) cb(null); });
  }
  function refreshDailyHud() {
    const hud = $('hw-hud'); if (hud) hud.style.display = '';
    fetchDaily((d) => { if (d && d.ok) applyHud(d.progress); });
  }
  function applyHud(p) {
    if (!p) return;
    const pct = Math.max(0, Math.min(100, Math.round((p.xpIntoLevel / p.xpForLevel) * 100)));
    if ($('hw-hud-fill')) $('hw-hud-fill').style.width = pct + '%';
    if ($('hw-hud-lvl')) $('hw-hud-lvl').textContent = 'Nivel ' + p.level;
    if ($('hw-hud-tier')) $('hw-hud-tier').textContent = (p.tier && p.tier.emoji) || '🥉';
    if ($('hw-hud-swords')) $('hw-hud-swords').textContent = p.swords;
    if ($('hw-hud-streak')) $('hw-hud-streak').textContent = p.streak;
  }
  function openDaily() {
    showScreen('daily');
    $('hw-game').classList.add('hidden');
    $('hw-reward').classList.add('hidden');
    // ⚡ Show the daily screen with cached data INSTANTLY (if we have it
    // from the HUD refresh on entry), so the kid sees structure rather
    // than blank. The fetch then updates the live data in the background.
    // Was: openDaily blocked on the network → "daily challenges take
    // a lot to load" on Render's cold-start dyno.
    if (dailyData && dailyData.progress) {
      try { renderDailyHome(); } catch (_) {}
    } else {
      const ch = $('hw-daily-challenge');
      if (ch) ch.innerHTML = '<div class="hw-daily-loading">⏳ Cargando reto…</div>';
    }
    fetchDaily(() => renderDailyHome());
  }
  function renderDailyHome() {
    const d = dailyData; if (!d || !d.progress) return;
    const p = d.progress;
    applyHud(p);
    if ($('hw-daily-tierbig')) $('hw-daily-tierbig').textContent = (p.tier.emoji || '') + ' ' + (p.tier.label || '');
    if ($('hw-daily-lvl')) $('hw-daily-lvl').textContent = 'Nivel ' + p.level;
    const pct = Math.max(0, Math.min(100, Math.round((p.xpIntoLevel / p.xpForLevel) * 100)));
    if ($('hw-daily-xpfill')) $('hw-daily-xpfill').style.width = pct + '%';
    if ($('hw-daily-xptext')) $('hw-daily-xptext').textContent = p.xpIntoLevel + ' / ' + p.xpForLevel + ' XP';
    if ($('hw-daily-swords')) $('hw-daily-swords').textContent = p.swords;
    if ($('hw-daily-streak')) $('hw-daily-streak').textContent = p.streak;
    const exp = (window.WU_EXPERIENCES || {})[d.theme.exp];
    const expLabel = exp ? exp.label : d.theme.exp;
    const ch = $('hw-daily-challenge');
    if (ch) {
      if (d.doneToday) {
        // Already earned today's rewards — but they can REPLAY for fun/practice
        // (no double prizes). Also surface the words they discovered today so
        // they can re-listen / re-read them.
        let learnedHtml = '';
        try {
          const key = 'hwDailyLearned_' + studentCode + '_' + localDateStr();
          const learned = JSON.parse(localStorage.getItem(key) || '[]');
          const wbi = window.WU_WORD_BY_ID || {};
          const words = learned.map((id) => wbi[id]).filter(Boolean);
          if (words.length) {
            learnedHtml = '<div class="hw-dc-learned"><div class="hw-dc-learned-head">📖 Lo que aprendí hoy</div>'
              + '<div class="hw-dc-learned-chips">'
              + words.map((w) => {
                  const cat = (window.WU_CATEGORIES || {})[w.cat];
                  const color = cat ? cat.color : '#ffe082';
                  return '<button class="hw-dc-learned-chip" data-py="' + escapeHtml(w.pinyin) + '" style="--cat-color:' + color + '">'
                    + '<span class="hw-dc-lc-icon">' + (w.icon || '⭐') + '</span>'
                    + '<span class="hw-dc-lc-py">' + escapeHtml(w.pinyin) + '</span>'
                    + '<span class="hw-dc-lc-es">' + escapeHtml(w.es || '') + '</span>'
                    + '<span class="hw-dc-lc-speak">🔊</span>'
                    + '</button>';
                }).join('')
              + '</div>'
              + '<button class="hw-dc-learned-build" id="hw-dc-learned-build" type="button">✍️ Armar una oración con estas palabras</button>'
              + '</div>';
          }
        } catch (_) {}
        ch.innerHTML = '<div class="hw-dc-done">✅ <strong>¡Desafío de hoy completado!</strong><br>'
          + '<span>Ya ganaste tus premios de hoy. ¡Vuelve mañana para tu racha 🔥!</span></div>'
          + learnedHtml
          + '<button class="hw-dc-play hw-dc-practice" id="hw-dc-play" type="button">🔁 Jugar otra vez (práctica)</button>';
        const pb = $('hw-dc-play'); if (pb) pb.addEventListener('click', () => startDailyGame(true));
        // Wire 🔊 on the learned chips → speak the pinyin.
        ch.querySelectorAll('.hw-dc-learned-chip').forEach((b) => {
          b.addEventListener('click', (e) => speakChinese(b.dataset.py, e.currentTarget));
        });
        // ✍️ "Practica una oración" — opens the sentence-bonus flow seeded
        // with today's learned words. Bonus already claimed → API returns
        // 'already' (no double prize) but the kid still gets to PRACTICE
        // and save the sentence to Mis oraciones.
        const buildBtn = $('hw-dc-learned-build');
        if (buildBtn) buildBtn.addEventListener('click', () => {
          try {
            const key = 'hwDailyLearned_' + studentCode + '_' + localDateStr();
            const learned = JSON.parse(localStorage.getItem(key) || '[]');
            if (!learned.length) return;
            $('hw-game').classList.remove('hidden');
            openSentenceBonus(learned, null);
          } catch (_) {}
        });
      } else {
        // 🎲 5-mode rotator — each day cycles through a different game so
        // "hoy" never feels like "ayer". Server picks mode by days-since-
        // epoch; client just renders whatever it sent.
        const modeMeta = ({
          story:  { label: '📖 Templo del Dragón', goal: 'Sube los escalones del templo. Descubre <strong>' + d.theme.goal + '</strong> palabras y vence al dragón 🐲' },
          memory: { label: '🧠 Memoria Flash',      goal: 'Encuentra las <strong>4 parejas</strong> escondidas 🃏' },
          speak:  { label: '🗣️ Escucha y Repite',  goal: 'Escucha cada palabra y dila en voz alta 🗣️' },
          slash:  { label: '🍉 Corte Rápido',       goal: 'Corta 🍉, acaricia 🐶 y lanza 🏃 — <strong>' + d.theme.goal + '</strong> palabras' },
          react:  { label: '⚡ Reacción Pīnyīn',    goal: '<strong>3 segundos</strong> para tocar el emoji correcto. ¡Sube tu combo! ⚡' },
        })[d.mode || 'story'] || { label: '📖 Historia', goal: 'Descubre <strong>' + d.theme.goal + '</strong> palabras' };
        // Tomorrow preview — builds anticipation, makes the kid come back.
        let tomorrowChip = '';
        if (d.tomorrow && d.tomorrow.modeMeta) {
          tomorrowChip = '<div class="hw-dc-tomorrow">'
            + '🌙 Mañana: <strong>' + d.tomorrow.modeMeta.emoji + ' ' + escapeHtml(d.tomorrow.modeMeta.short) + '</strong>'
            + '</div>';
        }
        // 🎁 Mystery-bonus visual — pulsing gold banner says "+2x swords"
        const bonusBanner = d.bonus
          ? '<div class="hw-dc-bonus">🌟 ¡DÍA DORADO! Hoy ganas <strong>el doble</strong> de ⚔️</div>'
          : '';
        ch.innerHTML = '<div class="hw-dc-head">⚔️ Desafío de hoy · ' + modeMeta.label + '</div>'
          + bonusBanner
          + '<div class="hw-dc-theme">' + escapeHtml(expLabel) + '</div>'
          + '<div class="hw-dc-goal">' + modeMeta.goal + '</div>'
          + '<button class="hw-dc-play" id="hw-dc-play" type="button">⚔️ ¡Jugar!</button>'
          + tomorrowChip;
        const pb = $('hw-dc-play'); if (pb) pb.addEventListener('click', () => startDailyGame(false));
      }
    }
    renderLadder(d.milestones || [], p.swords);
  }
  // Clear prize ladder: explains DralySwords, marks unlocked ones with ✓, and
  // shows a progress bar with "Te faltan X ⚔️" on the NEXT locked prize.
  function renderLadder(milestones, swords) {
    const lad = $('hw-daily-ladder'); if (!lad) return;
    lad.innerHTML = '';
    let nextShown = false;
    milestones.forEach((m, i) => {
      const reached = swords >= m;
      const prev = i === 0 ? 0 : milestones[i - 1];
      const isNext = !reached && !nextShown;
      if (isNext) nextShown = true;
      const el = document.createElement('div');
      el.className = 'hw-ladder-item' + (reached ? ' reached' : '') + (isNext ? ' next' : '');
      let body = '<div class="hw-ladder-box">' + (reached ? '🎁' : '🔒') + '</div>'
        + '<div class="hw-ladder-info">'
        + '<div class="hw-ladder-amt">Cofre ' + (i + 1) + ' · ⚔️ ' + m + ' DralySwords</div>';
      if (reached) {
        body += '<div class="hw-ladder-lbl">✓ ¡Desbloqueado! Pídele tu premio sorpresa a tu maestra 🤫</div>';
      } else if (isNext) {
        const have = Math.max(0, swords - prev);
        const need = m - prev;
        const pct = Math.max(0, Math.min(100, Math.round((have / need) * 100)));
        body += '<div class="hw-ladder-prog"><span class="hw-ladder-progfill" style="width:' + pct + '%"></span></div>'
          + '<div class="hw-ladder-lbl">Te faltan <strong>' + (m - swords) + ' ⚔️</strong> para este premio</div>';
      } else {
        body += '<div class="hw-ladder-lbl">Premio sorpresa bloqueado</div>';
      }
      body += '</div>';
      el.innerHTML = body;
      lad.appendChild(el);
    });
  }
  // ── 🔊 Mini-game sound effects (self-contained WebAudio; homework page has
  // no sound engine). Slash whoosh, splat pop, launch zoom, combo ding, win.
  let _dailyAC = null;
  function dailyAC() {
    if (!_dailyAC) { try { _dailyAC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { _dailyAC = null; } }
    if (_dailyAC && _dailyAC.state === 'suspended') { try { _dailyAC.resume(); } catch (_) {} }
    return _dailyAC;
  }
  function sfxTone(freq, dur, type, gain, slideTo) {
    const ac = dailyAC(); if (!ac) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function sfxNoise(dur, gain) {
    const ac = dailyAC(); if (!ac) return;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = gain || 0.12;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    src.connect(hp); hp.connect(g); g.connect(ac.destination);
    src.start();
  }
  const dailySfx = {
    slash() { sfxNoise(0.18, 0.16); sfxTone(900, 0.16, 'sawtooth', 0.10, 300); },
    pet()   { sfxTone(523, 0.12, 'sine', 0.16, 784); sfxTone(784, 0.16, 'sine', 0.12); },
    launch(){ sfxTone(300, 0.28, 'square', 0.12, 1400); },
    combo(n){ sfxTone(660 + n * 90, 0.14, 'triangle', 0.18, 990 + n * 90); },
    win()   { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfxTone(f, 0.22, 'triangle', 0.2), i * 110)); },
  };
  // Map an HSK1 category to one of three 3D mini-game actions.
  function dailyActionFor(cat) {
    if (cat === 'food' || cat === 'noun') return 'slash';     // 🍉 cut
    if (cat === 'family' || cat === 'pronoun' || cat === 'greet') return 'pet';  // 🐶 gentle
    return 'launch';                                          // 🏃 verbs/abstract
  }
  const DAILY_GAME = { active: false, practice: false, goal: 8, done: 0, correct: 0, pool: [], spawnT: null, slashing: false, combo: 0, comboT: null, discovered: [] };
  // ── Story characters — the daily picks one each day so it FEELS like a
  // game beat. ⭐ NOW using the new high-quality PNGs from the character
  // system (chars/<id>-b.png is the signature action pose). Characters
  // whose assets exist are heavily prioritized; legacy PNGs kept as
  // fallbacks until their new assets land.
  const DAILY_CHARS = [
    // ⭐ Gojo — new asset ready. Listed TWICE for higher pick odds.
    { id: 'gojo',     img: '/assets/cutscenes/chars/gojo-b.png',
      name: 'Gojo',
      intros: ['Te he estado esperando. Hoy entrenamos: {theme}.', 'Soy Gojo. Vamos a desbloquear tus límites.', 'Cierra los ojos. Hoy verás más allá del idioma…'],
      outros: ['Limit Break completado. Pero esto apenas comienza…', 'Has visto el infinito por un segundo. ¿Pudiste sentirlo?', 'Mañana abriremos otra puerta. No faltes.'] },
    { id: 'gojo',     img: '/assets/cutscenes/chars/gojo-b.png',
      name: 'Gojo',
      intros: ['Hoy te enseñaré el secreto del {theme}.', 'Snap. Y empezamos.', 'Mi infinito te protege mientras aprendes.'],
      outros: ['Hueco abierto. Tu mente se expandió.', 'Domain expansion: Idioma Infinito ✨', 'Has dado un paso hacia el lado azul.'] },
    // ⭐ Yugi — new asset ready. Listed TWICE.
    { id: 'yugi',     img: '/assets/cutscenes/chars/yugi-b.png',
      name: 'Yugi',
      intros: ['¡Es hora del duelo! Tema de hoy: {theme}.', '¡Cree en el corazón de las cartas!', 'Mi deck está listo. ¿Y el tuyo?'],
      outros: ['¡Ese fue un duelo legendario!', 'Tu mazo crece más fuerte cada día.', 'El Faraón está orgulloso de ti. Mañana otro turno.'] },
    { id: 'yugi',     img: '/assets/cutscenes/chars/yugi-b.png',
      name: 'Yugi',
      intros: ['¡Activé la carta {theme}! Empezamos.', '¡Confía en tu deck!', 'El Rompecabezas del Milenio brilla por ti.'],
      outros: ['¡Tu turno termina con victoria!', 'Las cartas hablan de ti hoy.', 'Volveré con un duelo aún mejor mañana.'] },
    // 🔧 Legacy roster (kept as fallbacks until new PNGs land per character)
    { id: 'yuji',     img: '/assets/png-library/yuji.png',
      name: 'Yuji',
      intros: ['¡Vamos juntos! Hoy: {theme}. ¡Sin miedo!', '¡Cada palabra es un golpe! ¡Conéctalos!', '¡A entrenar! Hoy tu corazón decide.'],
      outros: ['Sentí tu fuerza. Mañana entrenamos más duro.', 'Una sombra te observa. Pero tú ya estás listo…', '¡Eres más fuerte de lo que crees! Hasta mañana.'] },
    { id: 'fnaf',     img: '/assets/png-library/fnaf.png',
      name: 'FNAF',
      intros: ['Bienvenido a la noche. Tema: {theme}…', 'Las luces parpadean. ¿Estás listo?', 'La cámara te observa. Aprende rápido.'],
      outros: ['Sobreviviste… por esta noche.', 'Algo se mueve en el pasillo. Mejor vuelve mañana.', 'Tus pasos se desvanecen. Hasta la próxima noche.'] },
    { id: 'shelly',   img: '/assets/png-library/shelly.png',
      name: 'Shelly',
      intros: ['¡BOOM! ¿Lista para volar palabras? Hoy: {theme}.', '¡Disparo certero! Apunta y aprende.', '¡Vamos a reventar este nivel!'],
      outros: ['¡BOOM! ¡Combo perfecto! 💥', 'Cargando para mañana… no me hagas esperar.', '¡La próxima ronda será explosiva!'] },
    { id: 'dandy',    img: '/assets/png-library/dandy.png',
      name: 'Dandy',
      intros: ['Welcome 🎩 a {theme}.', 'Hoy seré tu guía en este mundo.', '¿Caminamos juntos en este sueño?'],
      outros: ['Has sido un buen amigo. Hasta el próximo mundo.', 'El sueño se cierra… pero la puerta seguirá ahí.', 'Volveré con más historias para ti.'] },
    { id: 'dralingo', img: '/assets/dralingo.png',
      name: 'Dralingo',
      intros: ['¡Hola, dragón! 🐉 Hoy: {theme}.', 'Mi escama brilla cuando aprendes.', 'Vuela conmigo a través de las palabras.'],
      outros: ['Estoy orgulloso de ti, pequeño dragón.', 'Otra escama dorada se reveló. ¿Cuántas faltan?', 'Mañana al amanecer, te espero.'] },
    // 🎌 The 3 anime panels the user dropped at /assets/png-library/anime 1-3.png.
    // Each becomes a "mystery character" with cryptic dialogue — perfect for
    // story-mode beats.
    { id: 'anime1', img: '/assets/png-library/anime 1.png',
      name: 'Samurái Rojo',
      intros: ['El tigre rojo despierta. Tema: {theme}.', 'Cada palabra es una espada. Empuña la primera.', 'Respira hondo. Hoy cortarás el silencio.'],
      outros: ['El tigre se duerme… pero su rugido vive en ti.', 'Has cortado bien. La hoja recuerda.', 'Cuando la luna salga, volveré por ti.'] },
    { id: 'anime2', img: '/assets/png-library/anime 2.png',
      name: 'Ojos del Trueno',
      intros: ['¡Mis ojos te ven! Hoy: {theme}.', '¡Despierta! El cielo está roto.', 'Concentración total. Empezamos.'],
      outros: ['¡Has visto lo que pocos ven!', 'Un trueno suena en la distancia… ya casi.', 'Mantén los ojos abiertos hasta mañana.'] },
    { id: 'anime3', img: '/assets/png-library/anime 3.png',
      name: 'Sombra del Templo',
      intros: ['Las líneas no mienten. Tema: {theme}.', 'En la oscuridad también se aprende.', '¿Listo para descubrir el código secreto?'],
      outros: ['Has descifrado una línea. Faltan muchas más.', 'La sombra recuerda tu nombre.', 'El templo te esperará mañana.'] },
  ];
  function dailyCharFor(dateStr) {
    let h = 0; for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
    return DAILY_CHARS[h % DAILY_CHARS.length];
  }
  // 🎬 ANIME CUTSCENE — replaces the old plain "img + bubble" intro/outro
  // with a manga-style cut-in: halftone dot background, comic impact lines
  // radiating from center, BIG character entrance with dramatic angle, and
  // a manga speech bubble. Tap anywhere to skip; auto-advances after a beat.
  //
  // ⭐ NOW USES MP4 VIDEOS if the character has one (Gojo, Yugi) so the
  // intro is animated, not a static PNG. Falls back to img if video fails.
  function showDailyStory(char, line, kind, onDone) {
    const game = $('hw-game'); if (!game) { if (onDone) onDone(); return; }
    // Check if this character has a victory mp4 — use it for both intro AND outro
    // so kids see real animation, not still PNG.
    const charVideo = (window.DRALY_CHARACTERS && window.DRALY_CHARACTERS[char.id]) ? window.DRALY_CHARACTERS[char.id].victory : null;
    const useVideo = !!charVideo && (char.id === 'gojo' || char.id === 'yugi');
    const wrap = document.createElement('div');
    wrap.className = 'hw-cutscene hw-cutscene-' + kind;
    // Tint the lines + halftone per character mood so the scene FEELS right.
    const tint = (char.id === 'fnaf') ? 'crimson'
              : (char.id === 'shelly') ? 'crimson'
              : (char.id === 'gojo') ? 'indigo'
              : (char.id === 'yuji') ? 'crimson'
              : (char.id === 'dandy') ? 'violet'
              : 'amber';
    wrap.classList.add('tint-' + tint);
    const impact = kind === 'intro'
      ? ['¡PREPÁRATE!', '¡VAMOS!', '¡AQUÍ VAMOS!', '¡A POR ELLOS!'][Math.floor(Math.random() * 4)]
      : ['¡EXCELENTE!', '¡INCREÍBLE!', '¡VICTORIA!', '¡GENIAL!'][Math.floor(Math.random() * 4)];
    wrap.innerHTML = ''
      + '<div class="hw-cs-halftone"></div>'
      + '<div class="hw-cs-lines"></div>'
      + '<div class="hw-cs-impact">' + impact + '</div>'
      + (useVideo
          ? '<video class="hw-cs-char hw-cs-video" src="' + charVideo + '" autoplay muted playsinline loop onerror="this.outerHTML=\'<img class=&quot;hw-cs-char&quot; src=&quot;' + char.img + '&quot; alt=&quot;' + char.id + '&quot;>\'"></video>'
          : '<img class="hw-cs-char" src="' + char.img + '" alt="' + char.id + '" onerror="this.style.display=\'none\'">')
      + '<div class="hw-cs-bubble"><span class="hw-cs-bubble-text">' + escapeHtml(line) + '</span></div>'
      + '<div class="hw-cs-tap">▶ toca para continuar</div>';
    game.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    try { if (kind === 'intro') dailySfx.launch(); else dailySfx.win(); } catch (_) {}
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return; dismissed = true;
      wrap.classList.remove('show');
      setTimeout(() => { wrap.remove(); if (onDone) onDone(); }, 280);
    };
    wrap.addEventListener('click', dismiss);
    // Auto-advance after a beat so kids who don't tap still move forward.
    setTimeout(dismiss, kind === 'outro' ? 2400 : 2800);
  }
  let _arenaBound = false;
  function startDailyGame(practice) {
    const d = dailyData; if (!d) return;
    const all = window.WU_WORDS || [];
    const pool = all.filter((w) => w.exp === d.theme.exp && w.icon);
    DAILY_GAME.pool = (pool.length ? pool : all.filter((w) => w.icon)).slice();
    DAILY_GAME.goal = d.theme.goal || 8;
    DAILY_GAME.done = 0; DAILY_GAME.correct = 0; DAILY_GAME.active = true;
    DAILY_GAME.practice = !!practice; DAILY_GAME.combo = 0;
    DAILY_GAME.discovered = [];
    dailyAC();  // unlock audio on this user gesture
    $('hw-game').classList.remove('hidden');
    $('hw-game').classList.toggle('is-practice', !!practice);
    const expShort = ((window.WU_EXPERIENCES || {})[d.theme.exp] || {}).short || '';
    const expLabel = ((window.WU_EXPERIENCES || {})[d.theme.exp] || {}).label || expShort;
    if ($('hw-game-theme')) $('hw-game-theme').textContent = (practice ? '🔁 Práctica · ' : '') + expShort;
    updateGameHud();
    const arena = $('hw-game-arena');
    if (arena) {
      arena.innerHTML = '';
      // Reset mode-specific classes so modes don't leak between days.
      arena.classList.remove('hw-memory', 'hw-speak', 'hw-story-mode');
      if (!_arenaBound) {
        _arenaBound = true;
        // Slash trail: while a finger/mouse is down, drop fading streak dots
        // and let the swipe "cut" objects it passes over (pointerenter).
        arena.addEventListener('pointerdown', (e) => {
          if (!DAILY_GAME.active) return;   // ← gate: daily ended? no-op
          DAILY_GAME.slashing = true; dailyTrail(e);
        });
        arena.addEventListener('pointermove', (e) => {
          if (!DAILY_GAME.active || !DAILY_GAME.slashing) return;
          dailyTrail(e);
        });
        window.addEventListener('pointerup', () => { DAILY_GAME.slashing = false; });
        window.addEventListener('pointercancel', () => { DAILY_GAME.slashing = false; });
      }
    }
    // Character intro: a daily story beat so it feels like a game, not just
    // tapping. Same character all day; rotates with the date.
    DAILY_GAME.char = dailyCharFor(localDateStr());
    const intro = DAILY_GAME.char.intros[Math.floor(Math.random() * DAILY_GAME.char.intros.length)].replace('{theme}', expLabel);
    showDailyStory(DAILY_GAME.char, intro, 'intro', () => dispatchDailyMode());
  }
  // Today's mode rotates DAILY across 5 modes — see _dailyModeFor on the
  // server (uses days-since-epoch so no two consecutive days repeat).
  // Each branch runs its own mini-game flow but all converge on
  // endDailyGame() for the shared outro → sentence-bonus → reward chain.
  function dispatchDailyMode() {
    const mode = (dailyData && dailyData.mode) || 'story';
    if (mode === 'memory') return runMemoryMode();
    if (mode === 'speak')  return runSpeakMode();
    if (mode === 'story')  return runStoryMode();
    if (mode === 'react')  return runReactMode();
    return scheduleSpawn();  // legacy 🍉 slash fallback
  }
  // ⚡ REACT MODE — new in 2026-06-01. Pinyin pops up huge in the center,
  // 4 emoji choices below (1 correct + 3 distractors from the same pool).
  // 3-second countdown ring. Tap correct → +1 discovery, advance. Wrong
  // tap or timeout → red shake, same word retries (no permanent fail).
  // Total play time ~30-45s — designed to feel sharp and arcade-y.
  function runReactMode() {
    const arena = $('hw-game-arena'); if (!arena) return;
    arena.innerHTML = '';
    arena.classList.remove('hw-memory', 'hw-slash', 'hw-story-mode', 'hw-temple-mode', 'hw-speak-mode');
    arena.classList.add('hw-react-mode');
    const pool = DAILY_GAME.pool.slice(0, 8);
    DAILY_GAME.goal = pool.length;
    DAILY_GAME.discovered = 0;
    DAILY_GAME.combo = 0;
    let idx = 0;
    // Shell — single mount, we just swap inner content per round.
    arena.innerHTML = `
      <div class="hw-react-shell">
        <div class="hw-react-progress"><span class="hw-react-progress-fill" id="hw-react-fill"></span></div>
        <div class="hw-react-combo" id="hw-react-combo">⚡ Combo: 0</div>
        <div class="hw-react-py" id="hw-react-py">…</div>
        <div class="hw-react-timer-wrap">
          <svg class="hw-react-timer" viewBox="0 0 100 100">
            <circle class="hw-react-timer-bg" cx="50" cy="50" r="46"/>
            <circle class="hw-react-timer-ring" id="hw-react-ring" cx="50" cy="50" r="46"/>
          </svg>
          <div class="hw-react-timer-num" id="hw-react-num">3</div>
        </div>
        <div class="hw-react-choices" id="hw-react-choices"></div>
      </div>`;
    const RING_CIRC = 2 * Math.PI * 46;
    const ringEl = $('hw-react-ring');
    if (ringEl) ringEl.style.strokeDasharray = RING_CIRC + ' ' + RING_CIRC;
    let roundTimer = null;
    let countdownTimer = null;
    function nextRound() {
      if (!DAILY_GAME.active) return;
      if (idx >= pool.length) return endDailyGame();
      const w = pool[idx];
      // 3 distractors drawn from the same theme bank so the kid can't
      // win by elimination based on visual style alone.
      const distractors = DAILY_GAME.pool
        .filter((x) => x.id !== w.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      const choices = [w, ...distractors].sort(() => Math.random() - 0.5);
      $('hw-react-py').textContent = w.pinyin;
      const choicesEl = $('hw-react-choices');
      choicesEl.innerHTML = '';
      choices.forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hw-react-choice';
        btn.innerHTML = '<span class="hw-react-choice-icon">' + (c.icon || '❓') + '</span>'
          + '<span class="hw-react-choice-es">' + escapeHtml(c.es || '') + '</span>';
        btn.addEventListener('click', () => onPick(c, w, btn));
        choicesEl.appendChild(btn);
      });
      // 3-sec countdown — ring drains + number ticks down. Wrong/timeout
      // shakes the screen but doesn't penalize swords (encourages retry).
      let remaining = 3000;
      const startedAt = Date.now();
      if (ringEl) {
        ringEl.style.transition = 'none';
        ringEl.style.strokeDashoffset = '0';
        // Force a reflow so the transition resets cleanly.
        void ringEl.getBoundingClientRect();
        ringEl.style.transition = 'stroke-dashoffset 3s linear';
        ringEl.style.strokeDashoffset = RING_CIRC;
      }
      countdownTimer = setInterval(() => {
        remaining = Math.max(0, 3000 - (Date.now() - startedAt));
        const num = $('hw-react-num');
        if (num) num.textContent = Math.ceil(remaining / 1000);
      }, 100);
      roundTimer = setTimeout(() => {
        clearInterval(countdownTimer);
        DAILY_GAME.combo = 0;
        const comboEl = $('hw-react-combo');
        if (comboEl) comboEl.textContent = '⚡ Combo: 0';
        arena.classList.add('hw-react-shake');
        setTimeout(() => arena.classList.remove('hw-react-shake'), 320);
        try { dailySfx.miss(); } catch (_) {}
        // Same word retries — no penalty beyond the broken combo.
        nextRound();
      }, 3100);
    }
    function onPick(chosen, correct, btn) {
      if (chosen.id !== correct.id) {
        clearTimeout(roundTimer);
        clearInterval(countdownTimer);
        DAILY_GAME.combo = 0;
        const comboEl = $('hw-react-combo');
        if (comboEl) comboEl.textContent = '⚡ Combo: 0';
        btn.classList.add('is-wrong');
        arena.classList.add('hw-react-shake');
        try { dailySfx.miss(); } catch (_) {}
        setTimeout(() => {
          arena.classList.remove('hw-react-shake');
          btn.classList.remove('is-wrong');
          nextRound();
        }, 360);
        return;
      }
      // Correct! +1 discovery + combo + record the word so the bonus
      // chain at the end pulls it into the kid's sentence-builder.
      clearTimeout(roundTimer);
      clearInterval(countdownTimer);
      btn.classList.add('is-right');
      DAILY_GAME.combo++;
      DAILY_GAME.discovered++;
      try { dailySfx.hit(); } catch (_) {}
      const comboEl = $('hw-react-combo');
      if (comboEl) comboEl.textContent = '⚡ Combo: ' + DAILY_GAME.combo;
      // Record discovered word ID for the sentence-bonus screen.
      try {
        if (!Array.isArray(DAILY_GAME.discoveredIds)) DAILY_GAME.discoveredIds = [];
        DAILY_GAME.discoveredIds.push(correct.id);
      } catch (_) {}
      // Update progress bar
      const pf = $('hw-react-fill');
      if (pf) pf.style.width = ((DAILY_GAME.discovered / DAILY_GAME.goal) * 100) + '%';
      idx++;
      setTimeout(() => { nextRound(); }, 420);
    }
    nextRound();
  }
  // 📖 STORY MODE — Pokémon-style cutscene with REAL interactivity:
  //   1. Each word starts hidden behind a 🎁 box — kid TAPS to reveal it.
  //   2. After reveal, the dialogue bar shows the word + Spanish.
  //   3. Every 3rd word, instead of advancing straight, the kid sees a
  //      mini-challenge: "¿Cuál palabra significa <español>?" with 3 chips.
  //   4. After certain categories (verbs, family, time), a brief 💡 grammar
  //      tip in Spanish appears so the kid learns the GRAMMAR not just words.
  // Each successful reveal counts as a discovery → sentence-bonus chain.
  const SPANISH_FACTS = {
    verbo:    '💡 En chino, los verbos NO cambian con persona ni tiempo. "Wǒ qù" = "yo voy", "Tā qù" = "él va". ¡Igualito siempre!',
    familia:  '💡 Los chinos llaman al hermano mayor (gēge) distinto del hermano menor (dìdi). ¡La edad importa!',
    persona:  '💡 Para preguntar "quién", usas "shéi". No hay diferencia entre él/ella en chino hablado.',
    objeto:   '💡 En chino no existe "el / la / los". Solo dices el nombre del objeto. ¡Más fácil!',
    lugar:    '💡 "Zài" significa "estar en / en". Es una palabra mágica para decir dónde estás.',
    tiempo:   '💡 La fecha en chino va de grande a chico: año, mes, día. Al revés que en español.',
    numero:   '💡 Para contar cosas en chino casi siempre necesitas un "clasificador". "Yī gè rén" = una persona.',
    color:    '💡 Los colores en chino terminan con "-sè" (sè = color). Ej: "hóngsè" = rojo.',
    sentir:   '💡 "Gāoxìng" = feliz, "lèi" = cansado. Los sentimientos se dicen como adjetivos.',
    saludo:   '💡 "Nǐ hǎo" literalmente = "tú bien". El saludo más común del mundo.',
  };
  // 🐲 TEMPLO DEL DRAGÓN — themed path-climbing game replacing the
  // gift-tap loop. Scene: Chinese mountains + pagoda + cherry-blossom petals
  // + N stepping stones leading up to a dragon at the top. Each round:
  //   1. Pinyin word appears in a banner ("回 huí")
  //   2. 3 Spanish chips at the bottom (correct + 2 distractors)
  //   3. Tap correct → character HOPS to next stone, lantern lights,
  //      combo grows, particles, +score. Tap wrong → red flash + shake,
  //      combo resets, try again. NO penalty.
  //   4. Reach the last stone → boss dragon roars, victory cutscene,
  //      sentence-bonus opens with all words discovered.
  function runStoryMode() {
    const arena = $('hw-game-arena'); if (!arena) return;
    arena.innerHTML = '';
    arena.classList.add('hw-story-mode', 'hw-temple-mode');
    arena.classList.remove('hw-memory', 'hw-slash');
    const words = DAILY_GAME.pool.slice(0, 8);
    DAILY_GAME.goal = words.length;
    const char = DAILY_GAME.char || dailyCharFor(localDateStr());
    let idx = 0;
    // Build the THEMED scene once. The DOM stays mounted; only the question
    // overlay re-renders per word so the parallax/petals don't restart.
    const scene = document.createElement('div');
    scene.className = 'hw-temple-scene';
    scene.innerHTML = `
      <div class="hw-temple-sky"></div>
      <div class="hw-temple-mountains"></div>
      <div class="hw-temple-pagoda">⛩️</div>
      <div class="hw-temple-petals">${Array.from({ length: 14 }).map((_, i) => '<span class="hw-temple-petal" style="--d:' + (i * 0.7) + 's; --x:' + (5 + (i * 11) % 90) + '%"></span>').join('')}</div>
      <div class="hw-temple-progress"><div class="hw-temple-fill" id="hw-temple-fill"></div></div>
      <div class="hw-temple-combo" id="hw-temple-combo">1× COMBO</div>
      <div class="hw-temple-stones" id="hw-temple-stones"></div>
      <img class="hw-temple-char" id="hw-temple-char" src="${char.img}" alt="${char.id}" onerror="this.style.display='none'">
      <div class="hw-temple-dragon" id="hw-temple-dragon">🐲</div>
      <div class="hw-temple-question" id="hw-temple-question"></div>`;
    arena.appendChild(scene);
    // Render the path of stepping stones (one per word).
    const stones = $('hw-temple-stones');
    if (stones) {
      stones.innerHTML = words.map((_, i) => '<div class="hw-temple-stone" data-stone="' + i + '">🪨</div>').join('');
    }
    let combo = 1; // multiplies score: 1×, 2×, 3×, …
    // Mario-style score popup ("+100") floating up from where the word appeared.
    function popScore(parent, amount) {
      if (!parent) return;
      const tag = document.createElement('div');
      tag.className = 'hw-sp-score-burst';
      tag.textContent = '+' + amount + (combo > 1 ? '  ×' + combo : '');
      parent.appendChild(tag);
      setTimeout(() => { try { tag.remove(); } catch (_) {} }, 1200);
    }
    // Confetti burst on word reveal — 12 colored specks fly out radially.
    function burstParticles(parent) {
      if (!parent) return;
      const colors = ['#ffd24a','#ff7e5f','#5be88a','#5be8d1','#ffe082','#ff7a45'];
      for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'hw-sp-particle';
        const a = (i / 12) * Math.PI * 2;
        p.style.setProperty('--dx', Math.cos(a) * (90 + Math.random() * 60) + 'px');
        p.style.setProperty('--dy', Math.sin(a) * (90 + Math.random() * 60) + 'px');
        p.style.background = colors[i % colors.length];
        parent.appendChild(p);
        setTimeout(() => { try { p.remove(); } catch (_) {} }, 1000);
      }
    }
    // Combo chip top-right: counts the reveal streak so the kid feels speed.
    function updateCombo(parent) {
      if (!parent) return;
      let chip = parent.querySelector('.hw-sp-combo');
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'hw-sp-combo';
        chip.innerHTML = '<span class="hw-sp-combo-num">' + combo + '×</span> COMBO';
        parent.appendChild(chip);
      } else {
        chip.innerHTML = '<span class="hw-sp-combo-num">' + combo + '×</span> COMBO';
        chip.classList.remove('pulse');
        void chip.offsetWidth;  // re-trigger
        chip.classList.add('pulse');
      }
    }
    function panel(word, lineHtml, opts) {
      opts = opts || {};
      arena.innerHTML = '';
      const cat = word ? (window.WU_CATEGORIES || {})[word.cat] : null;
      const color = cat ? cat.color : '#ffd24a';
      const wrap = document.createElement('div');
      wrap.className = 'hw-story-panel';
      wrap.style.setProperty('--cat-color', color);
      wrap.innerHTML = ''
        + '<div class="hw-sp-halftone"></div>'
        + '<img class="hw-sp-char" src="' + char.img + '" alt="' + char.id + '" onerror="this.style.display=\'none\'">'
        + (word ? ('<div class="hw-sp-word">'
            + '<span class="hw-sp-word-icon">' + (word.icon || '⭐') + '</span>'
            + '<span class="hw-sp-word-py">' + escapeHtml(word.pinyin) + '</span>'
            + '<span class="hw-sp-word-es">' + escapeHtml(word.es || '') + '</span>'
          + '</div>') : '')
        + '<div class="hw-sp-dialog">'
        +   '<div class="hw-sp-dialog-name">' + escapeHtml(char.name || char.id) + '</div>'
        +   '<div class="hw-sp-dialog-text">' + lineHtml + '</div>'
        +   '<div class="hw-sp-dialog-actions">'
        +     (word ? '<button class="hw-sp-listen" type="button">🔊 Escuchar</button>' : '')
        +     '<button class="hw-sp-next" type="button">' + (opts.last ? '✓ Terminar' : '▶ Siguiente') + '</button>'
        +   '</div>'
        + '</div>';
      arena.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('show'));
      const listen = wrap.querySelector('.hw-sp-listen');
      if (listen && word) listen.addEventListener('click', (e) => speakChinese(word.pinyin, e.currentTarget));
      wrap.querySelector('.hw-sp-next').addEventListener('click', () => {
        if (opts.onNext) opts.onNext();
      });
    }
    // Pick 3 distractor words for a mini-challenge from the daily pool +
    // the kid's broader catalog. Always different from the answer.
    function pickDistractors(answer, n) {
      const out = []; const seen = { [answer.id]: true };
      const fromPool = words.filter((w) => w.id !== answer.id);
      while (out.length < n && fromPool.length) {
        const pick = fromPool.splice(Math.floor(Math.random() * fromPool.length), 1)[0];
        if (!seen[pick.id]) { seen[pick.id] = true; out.push(pick); }
      }
      return out;
    }
    // Mini-challenge panel: "¿Cuál palabra significa <español>?" with 3 chips.
    // Correct → discovery + advance. Wrong → shake + try again (no penalty).
    function showMiniChallenge(w, onPass) {
      arena.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'hw-story-panel hw-sp-challenge';
      const cat = (window.WU_CATEGORIES || {})[w.cat];
      wrap.style.setProperty('--cat-color', cat ? cat.color : '#ffd24a');
      const distractors = pickDistractors(w, 2);
      const choices = [w].concat(distractors).sort(() => Math.random() - 0.5);
      wrap.innerHTML = ''
        + '<div class="hw-sp-halftone"></div>'
        + '<img class="hw-sp-char" src="' + char.img + '" alt="' + char.id + '" onerror="this.style.display=\'none\'">'
        + '<div class="hw-sp-dialog">'
        +   '<div class="hw-sp-dialog-name">' + escapeHtml(char.name || char.id) + ' · 🎯 Reto</div>'
        +   '<div class="hw-sp-dialog-text">— ¿Cuál palabra significa <strong>' + escapeHtml(w.es || '') + '</strong>?</div>'
        +   '<div class="hw-sp-choices">'
        +     choices.map((c) => '<button class="hw-sp-choice" type="button" data-id="' + c.id + '">'
                                  + '<span class="hw-sp-choice-icon">' + (c.icon || '⭐') + '</span>'
                                  + '<span class="hw-sp-choice-py">' + escapeHtml(c.pinyin) + '</span>'
                                + '</button>').join('')
        +   '</div>'
        + '</div>';
      arena.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('show'));
      wrap.querySelectorAll('.hw-sp-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.dataset.id === w.id) {
            btn.classList.add('is-correct');
            try { dailySfx.combo(idx + 2); } catch (_) {}
            popScore(wrap, 250 * combo);
            burstParticles(wrap);
            updateCombo(wrap);
            combo = Math.min(8, combo + 1);
            setTimeout(() => onPass(), 540);
          } else {
            btn.classList.add('is-wrong');
            try { if (window.MochiSounds && MochiSounds.bad) MochiSounds.bad(); } catch (_) {}
            wrap.classList.add('shake');
            combo = 1;
            updateCombo(wrap);
            setTimeout(() => { btn.classList.remove('is-wrong'); wrap.classList.remove('shake'); }, 480);
          }
        });
      });
    }
    // Grammar-tip panel: 2-second Spanish fact, then auto-advance.
    function showGrammarTip(w, onDone) {
      const tip = SPANISH_FACTS[w.cat] || SPANISH_FACTS.verbo;
      arena.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'hw-story-panel hw-sp-tip';
      wrap.innerHTML = ''
        + '<div class="hw-sp-halftone"></div>'
        + '<div class="hw-sp-tip-card">'
        +   '<div class="hw-sp-tip-head">🧠 Tip de gramática</div>'
        +   '<div class="hw-sp-tip-body">' + tip + '</div>'
        +   '<button class="hw-sp-next" type="button">▶ Continuar</button>'
        + '</div>';
      arena.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('show'));
      wrap.querySelector('.hw-sp-next').addEventListener('click', onDone);
    }
    // Tap-to-reveal: the word panel starts hidden behind a 🎁 box. Kid taps
    // it to "open" the gift — the word slides in, dialog speaks, options unfold.
    function showWordReveal(w, opts) {
      opts = opts || {};
      const cat = (window.WU_CATEGORIES || {})[w.cat];
      const color = cat ? cat.color : '#ffd24a';
      arena.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'hw-story-panel hw-sp-locked';
      wrap.style.setProperty('--cat-color', color);
      wrap.innerHTML = ''
        + '<div class="hw-sp-halftone"></div>'
        + '<img class="hw-sp-char" src="' + char.img + '" alt="' + char.id + '" onerror="this.style.display=\'none\'">'
        + '<button class="hw-sp-gift" type="button" aria-label="Abrir palabra">'
        +   '<span class="hw-sp-gift-emoji">🎁</span>'
        +   '<span class="hw-sp-gift-cta">¡Toca para descubrir!</span>'
        + '</button>'
        + '<div class="hw-sp-dialog">'
        +   '<div class="hw-sp-dialog-name">' + escapeHtml(char.name || char.id) + '</div>'
        +   '<div class="hw-sp-dialog-text">— ¿Listo/a para una palabra nueva? Toca el regalo 🎁</div>'
        + '</div>';
      arena.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('show'));
      const gift = wrap.querySelector('.hw-sp-gift');
      gift.addEventListener('click', () => {
        gift.classList.add('pop');
        try { if (window.MochiSounds && MochiSounds.combo) MochiSounds.combo(); } catch (_) {}
        // 🎮 Game-feel burst: confetti + +score + combo counter, before
        // the word panel slides in. Combo grows with each consecutive reveal.
        burstParticles(wrap);
        popScore(wrap, 100 * combo);
        updateCombo(wrap);
        combo = Math.min(8, combo + 1);
        setTimeout(() => {
          // Replace dialog with the actual reveal + listen + next buttons.
          const lines = [
            '— ¡Es <strong>' + escapeHtml(w.pinyin) + '</strong>! Significa <em>' + escapeHtml(w.es || '') + '</em>.',
            '— Mira: <strong>' + escapeHtml(w.pinyin) + '</strong> = <em>' + escapeHtml(w.es || '') + '</em>. ¡Tu turno de decirla!',
            '— ¡Apareció <strong>' + escapeHtml(w.pinyin) + '</strong>! Quiere decir <em>' + escapeHtml(w.es || '') + '</em>.',
          ];
          const line = lines[Math.floor(Math.random() * lines.length)];
          gift.remove();
          // Inject the word badge.
          const wordEl = document.createElement('div');
          wordEl.className = 'hw-sp-word';
          wordEl.innerHTML = '<span class="hw-sp-word-icon">' + (w.icon || '⭐') + '</span>'
            + '<span class="hw-sp-word-py">' + escapeHtml(w.pinyin) + '</span>'
            + '<span class="hw-sp-word-es">' + escapeHtml(w.es || '') + '</span>';
          wrap.appendChild(wordEl);
          // Swap dialog content.
          const dlg = wrap.querySelector('.hw-sp-dialog-text');
          dlg.innerHTML = line;
          const actions = document.createElement('div');
          actions.className = 'hw-sp-dialog-actions';
          actions.innerHTML = '<button class="hw-sp-listen" type="button">🔊 Escuchar</button>'
            + '<button class="hw-sp-next" type="button">' + (opts.last ? '✓ Terminar' : '▶ Siguiente') + '</button>';
          wrap.querySelector('.hw-sp-dialog').appendChild(actions);
          actions.querySelector('.hw-sp-listen').addEventListener('click', (e) => speakChinese(w.pinyin, e.currentTarget));
          actions.querySelector('.hw-sp-next').addEventListener('click', opts.onNext);
          // Auto-play the word so the kid HEARS it the moment it's revealed.
          setTimeout(() => { try { speakChinese(w.pinyin, null); } catch (_) {} }, 220);
        }, 360);
      });
    }
    // Pick 2 distractor Spanish meanings from the daily pool.
    function pickEsDistractors(answer, n) {
      const out = []; const seen = { [answer.id]: true };
      const fromPool = words.filter((w) => w.id !== answer.id && (w.es || '').trim());
      while (out.length < n && fromPool.length) {
        const pick = fromPool.splice(Math.floor(Math.random() * fromPool.length), 1)[0];
        if (!seen[pick.id]) { seen[pick.id] = true; out.push(pick); }
      }
      return out;
    }
    // Render the question overlay for the current word.
    function renderQuestion() {
      const w = words[idx]; if (!w) return;
      const distractors = pickEsDistractors(w, 2);
      const choices = [w, ...distractors].sort(() => Math.random() - 0.5);
      const q = $('hw-temple-question');
      const cat = (window.WU_CATEGORIES || {})[w.cat];
      q.style.setProperty('--cat-color', cat ? cat.color : '#ffd24a');
      q.innerHTML = `
        <div class="hw-temple-q-bubble">
          <span class="hw-temple-q-prompt">¿Qué significa…</span>
          <span class="hw-temple-q-pinyin">${escapeHtml(w.pinyin)}</span>
          <button class="hw-temple-q-listen" type="button" title="Escuchar">🔊</button>
        </div>
        <div class="hw-temple-q-choices">
          ${choices.map((c) => '<button class="hw-temple-q-choice" type="button" data-id="' + c.id + '"><span class="hw-temple-q-icon">' + (c.icon || '⭐') + '</span><span class="hw-temple-q-es">' + escapeHtml(c.es || '') + '</span></button>').join('')}
        </div>`;
      q.querySelector('.hw-temple-q-listen').addEventListener('click', () => {
        try { speakChinese(w.pinyin, null); } catch (_) {}
      });
      // Auto-play the pinyin on entry so the kid HEARS it.
      setTimeout(() => { try { speakChinese(w.pinyin, null); } catch (_) {} }, 320);
      q.querySelectorAll('.hw-temple-q-choice').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.dataset.id === w.id) {
            btn.classList.add('is-correct');
            handleCorrect(w);
          } else {
            btn.classList.add('is-wrong');
            handleWrong();
            setTimeout(() => btn.classList.remove('is-wrong'), 420);
          }
        });
      });
    }
    function handleCorrect(w) {
      // 🎮 Reward loop: light the stone, walk character, particles, combo+
      const stoneEl = document.querySelector('.hw-temple-stone[data-stone="' + idx + '"]');
      if (stoneEl) {
        stoneEl.classList.add('lit');
        stoneEl.textContent = '🏮';
      }
      const charEl = $('hw-temple-char');
      if (charEl) {
        // Walk one stone forward: stones array is spread by CSS calc.
        charEl.style.setProperty('--step', String(idx + 1));
        charEl.classList.remove('hop');
        void charEl.offsetWidth;
        charEl.classList.add('hop');
      }
      burstParticles(scene);
      popScore(scene, 200 * combo);
      updateCombo(scene);
      combo = Math.min(8, combo + 1);
      try { dailySfx.combo(combo); } catch (_) {}
      idx++;
      DAILY_GAME.done = idx; DAILY_GAME.correct = idx;
      if (DAILY_GAME.discovered.indexOf(w.id) < 0) DAILY_GAME.discovered.push(w.id);
      updateGameHud();
      // Progress bar
      const fill = $('hw-temple-fill');
      if (fill) fill.style.width = (idx / words.length * 100) + '%';
      // Grammar tip injection every 3 correct (when the category has one)
      const showTip = idx > 0 && idx % 3 === 0 && SPANISH_FACTS[w.cat] && idx < words.length;
      setTimeout(() => {
        if (showTip) return showGrammarTipInScene(w, nextQuestion);
        nextQuestion();
      }, 720);
    }
    function handleWrong() {
      combo = 1;
      updateCombo(scene);
      scene.classList.remove('shake'); void scene.offsetWidth; scene.classList.add('shake');
      try { if (window.MochiSounds && MochiSounds.bad) MochiSounds.bad(); } catch (_) {}
    }
    function nextQuestion() {
      if (idx >= words.length) return finishTemple();
      renderQuestion();
    }
    // Inline tip card that overlays the scene (doesn't kill the path).
    function showGrammarTipInScene(w, onDone) {
      const tip = SPANISH_FACTS[w.cat];
      if (!tip) return onDone();
      const card = document.createElement('div');
      card.className = 'hw-temple-tip';
      card.innerHTML = '<div class="hw-temple-tip-card"><div class="hw-temple-tip-head">🧠 Tip de gramática</div><div class="hw-temple-tip-body">' + tip + '</div><button class="hw-temple-tip-ok" type="button">▶ Continuar</button></div>';
      scene.appendChild(card);
      card.querySelector('.hw-temple-tip-ok').addEventListener('click', () => {
        card.remove(); onDone();
      });
    }
    function finishTemple() {
      // Dragon roars: scale up + glow, then pass to endDailyGame.
      const dragon = $('hw-temple-dragon');
      if (dragon) dragon.classList.add('roar');
      try { if (window.MochiSounds && MochiSounds.winFanfare) MochiSounds.winFanfare(); } catch (_) {}
      setTimeout(() => endDailyGame(), 1100);
    }
    // Kick off the first question.
    renderQuestion();
  }
  // 🧠 MEMORY MATCH — 2×4 grid of word cards. Flip two; if pinyin matches,
  // they lock and reveal the word. Match all 4 pairs to complete the daily.
  function runMemoryMode() {
    const arena = $('hw-game-arena'); if (!arena) return;
    arena.innerHTML = ''; arena.classList.add('hw-memory');
    const pool = DAILY_GAME.pool.slice();
    const words = [];
    for (let i = 0; i < 4 && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      words.push(pool.splice(idx, 1)[0]);
    }
    DAILY_GAME.goal = words.length;
    const cards = []; words.forEach((w) => { cards.push(w, w); });
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }
    const grid = document.createElement('div'); grid.className = 'hw-memory-grid';
    arena.appendChild(grid);
    const state = { flipped: [], matched: new Set() };
    cards.forEach((w, idx) => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'hw-memory-card';
      card.dataset.wid = w.id;
      const cat = (window.WU_CATEGORIES || {})[w.cat];
      card.style.setProperty('--cat-color', cat ? cat.color : '#ffe082');
      card.innerHTML = '<div class="hw-mem-inner">'
        + '<div class="hw-mem-back">?</div>'
        + '<div class="hw-mem-front">'
        + '<span class="hw-mem-icon">' + (w.icon || '⭐') + '</span>'
        + '<span class="hw-mem-py">' + escapeHtml(w.pinyin) + '</span>'
        + '<span class="hw-mem-es">' + escapeHtml(w.es || '') + '</span>'
        + '</div></div>';
      card.addEventListener('click', () => {
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
        if (state.flipped.length >= 2) return;
        card.classList.add('flipped');
        state.flipped.push(card);
        try { dailySfx.pet(); } catch (_) {}
        if (state.flipped.length === 2) {
          const a = state.flipped[0], b = state.flipped[1];
          if (a.dataset.wid === b.dataset.wid) {
            setTimeout(() => {
              a.classList.add('matched'); b.classList.add('matched');
              state.matched.add(a.dataset.wid);
              const word = (window.WU_WORD_BY_ID || {})[a.dataset.wid];
              if (word) {
                revealDailyWord(word, 'pet');
                if (DAILY_GAME.discovered.indexOf(word.id) < 0) DAILY_GAME.discovered.push(word.id);
              }
              try { dailySfx.combo(state.matched.size); } catch (_) {}
              DAILY_GAME.done = state.matched.size; DAILY_GAME.correct = state.matched.size;
              updateGameHud();
              state.flipped = [];
              if (state.matched.size >= DAILY_GAME.goal) endDailyGame();
            }, 380);
          } else {
            setTimeout(() => {
              a.classList.remove('flipped'); b.classList.remove('flipped');
              state.flipped = [];
            }, 900);
          }
        }
      });
      grid.appendChild(card);
    });
  }
  // 🗣️ SPEAK & LISTEN — show each word as a big card with 🔊 (Google voice)
  // + "✓ Lo dije" to advance. Auto-plays each word once on display.
  function runSpeakMode() {
    const arena = $('hw-game-arena'); if (!arena) return;
    arena.innerHTML = ''; arena.classList.add('hw-speak');
    const words = DAILY_GAME.pool.slice(0, 8);
    DAILY_GAME.goal = words.length;
    let idx = 0;
    function showOne() {
      if (!DAILY_GAME.active) return;
      if (idx >= words.length) { endDailyGame(); return; }
      const w = words[idx];
      const cat = (window.WU_CATEGORIES || {})[w.cat];
      arena.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'hw-speak-card';
      card.style.setProperty('--cat-color', cat ? cat.color : '#ffe082');
      card.innerHTML = '<div class="hw-speak-num">' + (idx + 1) + ' / ' + words.length + '</div>'
        + '<div class="hw-speak-icon">' + (w.icon || '⭐') + '</div>'
        + '<div class="hw-speak-py">' + escapeHtml(w.pinyin) + '</div>'
        + '<div class="hw-speak-es">' + escapeHtml(w.es || '') + '</div>'
        + '<button class="hw-speak-listen" type="button">🔊 Escuchar otra vez</button>'
        + '<button class="hw-speak-next" type="button">✓ Lo dije →</button>';
      arena.appendChild(card);
      card.querySelector('.hw-speak-listen').addEventListener('click', (e) => speakChinese(w.pinyin, e.currentTarget));
      card.querySelector('.hw-speak-next').addEventListener('click', () => {
        DAILY_GAME.done = ++idx; DAILY_GAME.correct = idx;
        if (DAILY_GAME.discovered.indexOf(w.id) < 0) DAILY_GAME.discovered.push(w.id);
        updateGameHud();
        try { dailySfx.combo(idx); } catch (_) {}
        showOne();
      });
      // Auto-play the word once on display.
      setTimeout(() => { try { speakChinese(w.pinyin, null); } catch (_) {} }, 350);
    }
    showOne();
  }
  function dailyTrail(e) {
    const arena = $('hw-game-arena'); if (!arena) return;
    const r = arena.getBoundingClientRect();
    const dot = document.createElement('div');
    dot.className = 'hw-trail';
    dot.style.left = (e.clientX - r.left) + 'px';
    dot.style.top = (e.clientY - r.top) + 'px';
    arena.appendChild(dot);
    setTimeout(() => dot.remove(), 360);
  }
  function dailyBurst(x, y, color, emoji) {
    const arena = $('hw-game-arena'); if (!arena) return;
    for (let i = 0; i < 7; i++) {
      const p = document.createElement('div');
      p.className = 'hw-particle';
      p.textContent = (i % 2 && emoji) ? emoji : '';
      const ang = (Math.PI * 2 * i) / 7 + Math.random();
      const dist = 50 + Math.random() * 60;
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      p.style.background = emoji ? 'transparent' : (color || '#ffe082');
      arena.appendChild(p);
      setTimeout(() => p.remove(), 620);
    }
  }
  function bumpCombo() {
    DAILY_GAME.combo++;
    clearTimeout(DAILY_GAME.comboT);
    DAILY_GAME.comboT = setTimeout(() => { DAILY_GAME.combo = 0; }, 1100);
    if (DAILY_GAME.combo >= 2) {
      dailySfx.combo(DAILY_GAME.combo);
      const arena = $('hw-game-arena'); if (!arena) return;
      const c = document.createElement('div');
      c.className = 'hw-combo';
      c.textContent = '¡Combo x' + DAILY_GAME.combo + '!';
      arena.appendChild(c);
      setTimeout(() => c.remove(), 800);
    }
  }
  function updateGameHud() {
    if ($('hw-game-progress')) $('hw-game-progress').textContent = DAILY_GAME.done + '/' + DAILY_GAME.goal;
  }
  function scheduleSpawn() {
    if (!DAILY_GAME.active || DAILY_GAME.done >= DAILY_GAME.goal) return;
    spawnDailyObject();
    DAILY_GAME.spawnT = setTimeout(scheduleSpawn, 780 + Math.random() * 520);
  }
  function spawnDailyObject() {
    const arena = $('hw-game-arena'); if (!arena || !DAILY_GAME.pool.length) return;
    const w = DAILY_GAME.pool[Math.floor(Math.random() * DAILY_GAME.pool.length)];
    const action = dailyActionFor(w.cat);
    const cat = (window.WU_CATEGORIES || {})[w.cat];
    const color = cat ? cat.color : '#ffe082';
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hw-obj hw-obj-' + action;
    el.style.setProperty('--cat-color', color);
    el.style.left = (6 + Math.random() * 78) + 'vw';
    const dur = 2.7 + Math.random() * 1.3;
    el.style.animationDuration = dur + 's';
    // A little hint badge so kids learn the gesture: ✂️ swipe / 👆 tap.
    const hint = action === 'slash' ? '✂️' : '👆';
    el.innerHTML = '<span class="hw-obj-emoji">' + (w.icon || '⭐') + '</span><span class="hw-obj-hint">' + hint + '</span>';
    let hit = false;
    const doHit = (viaSwipe) => {
      if (hit || !DAILY_GAME.active) return;
      // Food wants a real SWIPE (slash); people/verbs want a TAP. Be gentle:
      // a tap still works on food, but a swipe is the satisfying way.
      hit = true;
      const r = arena.getBoundingClientRect();
      const ob = el.getBoundingClientRect();
      const cx = ob.left - r.left + ob.width / 2;
      const cy = ob.top - r.top + ob.height / 2;
      el.classList.add('hw-obj-hit', 'fx-' + action);
      dailyBurst(cx, cy, color, action === 'slash' ? '' : (w.icon || ''));
      if (action === 'slash') dailySfx.slash();
      else if (action === 'pet') dailySfx.pet();
      else dailySfx.launch();
      if (viaSwipe) bumpCombo(); else { DAILY_GAME.combo = 0; }
      revealDailyWord(w, action);
      DAILY_GAME.done++; DAILY_GAME.correct++;
      // Keep the wordlist they'll use in the Sentence Bonus afterwards.
      if (DAILY_GAME.discovered.indexOf(w.id) < 0) DAILY_GAME.discovered.push(w.id);
      updateGameHud();
      setTimeout(() => el.remove(), 520);
      if (DAILY_GAME.done >= DAILY_GAME.goal) endDailyGame();
    };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); doHit(false); });
    el.addEventListener('pointerenter', () => { if (DAILY_GAME.slashing) doHit(true); });
    arena.appendChild(el);
    setTimeout(() => { if (!hit && el.parentNode) el.remove(); }, dur * 1000 + 250);
  }
  function revealDailyWord(w, action) {
    const rv = $('hw-game-reveal'); if (!rv) return;
    rv.className = 'hw-game-reveal show fx-' + action;
    rv.innerHTML = '<span class="hw-rv-emoji">' + (w.icon || '⭐') + '</span>'
      + '<span class="hw-rv-py">' + escapeHtml(w.pinyin) + '</span>'
      + '<span class="hw-rv-es">' + escapeHtml(w.es || '') + '</span>';
    try { speakChinese(w.pinyin, null); } catch (_) {}
    clearTimeout(rv._t);
    rv._t = setTimeout(() => { rv.classList.remove('show'); rv.classList.add('hidden'); }, 900);
  }
  function stopDailyGame() {
    DAILY_GAME.active = false;
    // 🛑 CRITICAL — kill the slashing flag + spawn timer + combo timer so
    // pointermove handlers stop firing dailyTrail() after the daily ends.
    // Without this, the kid leaves the daily, goes to do homework, and
    // every pointer move on the assignment screen runs the daily trail
    // logic in the background. User reported "daily interferes with
    // making sentences" — this is the cause.
    DAILY_GAME.slashing = false;
    if (DAILY_GAME.spawnT) { clearTimeout(DAILY_GAME.spawnT); DAILY_GAME.spawnT = null; }
    if (DAILY_GAME.comboT) { clearTimeout(DAILY_GAME.comboT); DAILY_GAME.comboT = null; }
    const g = $('hw-game'); if (g) { g.classList.add('hidden'); g.style.pointerEvents = 'none'; }
    const a = $('hw-game-arena'); if (a) a.innerHTML = '';
    // 🩹 NUKE leftover full-screen overlays. Was the source of "after a
    // daily / test, kid can't tap anything" — stuck cutscene / reward
    // wrappers stayed in the DOM with high z-index eating touches.
    document.querySelectorAll('.hw-cutscene, .hw-reward, .char-celebration').forEach((el) => {
      try { el.remove(); } catch (_) {}
    });
    // Reset any body overflow/scroll lock the game may have applied.
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }
  function endDailyGame() {
    if (!DAILY_GAME.active) return;
    DAILY_GAME.active = false;
    if (DAILY_GAME.spawnT) { clearTimeout(DAILY_GAME.spawnT); DAILY_GAME.spawnT = null; }
    setTimeout(() => { const a = $('hw-game-arena'); if (a) a.innerHTML = ''; }, 420);
    try { dailySfx.win(); } catch (_) {}
    // Persist today's discovered words locally so the daily home can show
    // "📖 Lo que aprendí hoy" even after the kid leaves and comes back.
    try {
      const key = 'hwDailyLearned_' + studentCode + '_' + localDateStr();
      localStorage.setItem(key, JSON.stringify(DAILY_GAME.discovered));
    } catch (_) {}
    // Outro story beat → THEN sentence bonus → THEN reward.
    const char = DAILY_GAME.char || dailyCharFor(localDateStr());
    const outro = char.outros[Math.floor(Math.random() * char.outros.length)];
    showDailyStory(char, outro, 'outro', () => {
      // Practice replay → no rewards, no bonus, straight to celebration.
      if (DAILY_GAME.practice) {
        $('hw-game').classList.add('hidden');
        showDailyReward({ ok: false, reason: 'practice' });
        return;
      }
      fetch('/api/homework/daily/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentCode, accessCode, date: localDateStr(), correct: DAILY_GAME.correct }),
      }).then((r) => r.json()).then((res) => {
        // If they discovered enough words, offer the Sentence Bonus.
        if (DAILY_GAME.discovered.length >= 2 && (!res || res.ok || res.reason === 'already')) {
          openSentenceBonus(DAILY_GAME.discovered.slice(), res);
        } else {
          $('hw-game').classList.add('hidden');
          showDailyReward(res);
        }
      }).catch(() => { $('hw-game').classList.add('hidden'); renderDailyHome(); });
    });
  }
  // ── 🎁 SENTENCE BONUS — arrange today's discovered words into a sentence
  // (free-form, expressive). +1 ⚔️ + saved to Mis oraciones. Once per day.
  let _bonusWords = [];      // pool the kid can still drop into the sentence
  let _bonusBuilt = [];      // words the kid has picked, in order
  function openSentenceBonus(wordIds, completeRes) {
    _bonusWords = wordIds.slice();
    _bonusBuilt = [];
    if (!completeRes || !completeRes._reopened) _bonusSavedCount = 0;
    const game = $('hw-game'); if (!game) return;
    // Re-use the game overlay as the bonus stage so we keep the focus.
    const arena = $('hw-game-arena'); if (arena) arena.innerHTML = '';
    let panel = document.getElementById('hw-bonus');
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'hw-bonus'; panel.className = 'hw-bonus';
      game.appendChild(panel);
    }
    game.classList.add('is-bonus');
    panel.innerHTML = `
      <div class="hw-bonus-head">🎁 Bono · Arma una oración con tus palabras</div>
      <div class="hw-bonus-stage" id="hw-bonus-stage"></div>
      <div class="hw-bonus-pool" id="hw-bonus-pool"></div>
      <div class="hw-bonus-bar">
        <button class="hw-bonus-skip" id="hw-bonus-skip" type="button">Saltar</button>
        <button class="hw-bonus-listen" id="hw-bonus-listen" type="button">🔊 Oír</button>
        <button class="hw-bonus-save" id="hw-bonus-save" type="button">💾 Guardar oración +1 ⚔️</button>
      </div>`;
    renderBonus(completeRes);
    $('hw-bonus-skip').addEventListener('click', () => closeBonus(completeRes));
    $('hw-bonus-listen').addEventListener('click', (e) => {
      const py = _bonusBuilt.map((wid) => (window.WU_WORD_BY_ID[wid] || {}).pinyin).filter(Boolean).join(' ');
      if (py) speakChinese(py, e.currentTarget);
    });
    $('hw-bonus-save').addEventListener('click', () => submitBonus(completeRes));
  }
  function renderBonus(completeRes) {
    const stage = $('hw-bonus-stage'); const pool = $('hw-bonus-pool');
    if (!stage || !pool) return;
    stage.innerHTML = '';
    _bonusBuilt.forEach((wid, idx) => {
      const w = (window.WU_WORD_BY_ID || {})[wid]; if (!w) return;
      const cat = (window.WU_CATEGORIES || {})[w.cat];
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'hw-bonus-chip on-stage';
      chip.style.setProperty('--cat-color', cat ? cat.color : '#ffe082');
      chip.innerHTML = '<span class="hw-bonus-py">' + escapeHtml(w.pinyin) + '</span><span class="hw-bonus-es">' + escapeHtml(w.es || '') + '</span>';
      chip.addEventListener('click', () => {
        _bonusBuilt.splice(idx, 1); _bonusWords.push(wid); renderBonus(completeRes);
      });
      stage.appendChild(chip);
    });
    if (!_bonusBuilt.length) stage.innerHTML = '<span class="hw-bonus-empty">Toca palabras abajo para armar tu oración ↓</span>';
    pool.innerHTML = '';
    _bonusWords.forEach((wid, idx) => {
      const w = (window.WU_WORD_BY_ID || {})[wid]; if (!w) return;
      const cat = (window.WU_CATEGORIES || {})[w.cat];
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'hw-bonus-chip in-pool';
      chip.style.setProperty('--cat-color', cat ? cat.color : '#ffe082');
      chip.innerHTML = '<span class="hw-bonus-py">' + escapeHtml(w.pinyin) + '</span><span class="hw-bonus-es">' + escapeHtml(w.es || '') + '</span>';
      chip.addEventListener('click', () => {
        _bonusBuilt.push(wid); _bonusWords.splice(idx, 1); renderBonus(completeRes);
      });
      pool.appendChild(chip);
    });
  }
  let _bonusSavedCount = 0;
  function submitBonus(completeRes) {
    if (_bonusBuilt.length < 2) { alert('Usa al menos 2 palabras.'); return; }
    const saveBtn = document.getElementById('hw-bonus-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '💾 Guardando…'; }
    fetch('/api/homework/daily/sentence-bonus', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCode, accessCode, date: localDateStr(), wordIds: _bonusBuilt }),
    }).then((r) => r.json()).then((bonus) => {
      // 🔧 EVERY save now persists to Mis oraciones (server-side fix). We
      // only "finish" the daily on the FIRST save (so the +1 sword reward
      // overlay fires once). After that, the panel offers "Guardar otra"
      // so the kid can build as many sentences as they want and they ALL
      // land in Mis oraciones + count toward the parent 0→2000 bar.
      if (bonus && bonus.ok && bonus.sentenceSaved) {
        _bonusSavedCount++;
        try { dailySfx.combo(_bonusSavedCount + 4); } catch (_) {}
      }
      // If this is the FIRST save of the session, close the panel + show
      // the daily-completed reward overlay (with the +1 sword if eligible).
      if (_bonusSavedCount === 1) {
        const merged = Object.assign({}, completeRes || { ok: true, gained: {}, progress: null });
        if (bonus && bonus.ok) {
          merged.bonusGained = bonus.gained;
          if (bonus.progress) merged.progress = bonus.progress;
          if (bonus.alreadyClaimed) merged.bonusAlready = true;
        }
        // Close + show reward — but also queue a follow-up panel offering
        // another save (kid can save infinite extras after the reward).
        closeBonusWithReward(merged, completeRes);
      } else {
        // Subsequent saves: just re-render the bonus panel with a flash
        // and a friendly counter, no reward overlay.
        flashSavedCount();
        resetBonusPanel();
      }
    }).catch(() => {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar oración'; }
    });
  }
  function flashSavedCount() {
    const panel = document.getElementById('hw-bonus');
    if (!panel) return;
    let tag = panel.querySelector('.hw-bonus-saved');
    if (!tag) {
      tag = document.createElement('div'); tag.className = 'hw-bonus-saved';
      panel.appendChild(tag);
    }
    tag.textContent = '✅ ' + _bonusSavedCount + ' oración' + (_bonusSavedCount === 1 ? '' : 'es') + ' guardada' + (_bonusSavedCount === 1 ? '' : 's') + ' hoy';
    tag.classList.remove('pulse'); void tag.offsetWidth; tag.classList.add('pulse');
  }
  function resetBonusPanel() {
    // Restore the pool (everything available again) and clear the stage.
    _bonusWords = (DAILY_GAME && DAILY_GAME.discovered) ? DAILY_GAME.discovered.slice() : _bonusWords.concat(_bonusBuilt);
    _bonusBuilt = [];
    const saveBtn = document.getElementById('hw-bonus-save');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar otra oración'; }
    renderBonus();
  }
  function closeBonusWithReward(merged, completeRes) {
    // Show the reward overlay; when the kid dismisses it, re-open the
    // bonus panel so they can save more sentences (Venn-diagram unlimited).
    closeBonus(merged);
    // After the reward overlay shows up, surface a small button that
    // re-opens the sentence builder for additional saves.
    setTimeout(() => addExtraSaveCTA(completeRes), 800);
  }
  function addExtraSaveCTA(completeRes) {
    const rw = $('hw-reward'); if (!rw) return;
    const card = rw.querySelector('.hw-reward-card'); if (!card) return;
    if (card.querySelector('.hw-extra-save')) return;
    const extra = document.createElement('button');
    extra.type = 'button';
    extra.className = 'hw-extra-save';
    extra.innerHTML = '✏️ Guardar otra oración (sin límite)';
    extra.addEventListener('click', () => {
      rw.classList.add('hidden'); rw.innerHTML = '';
      openSentenceBonus((DAILY_GAME && DAILY_GAME.discovered) ? DAILY_GAME.discovered.slice() : [], completeRes);
    });
    card.appendChild(extra);
  }
  function closeBonus(rewardResult) {
    const game = $('hw-game'); if (game) { game.classList.remove('is-bonus'); game.classList.add('hidden'); }
    const panel = document.getElementById('hw-bonus'); if (panel) panel.remove();
    showDailyReward(rewardResult);
  }
  function showDailyReward(res) {
    const rw = $('hw-reward'); if (!rw) return;
    if (res && res.ok) {
      const g = res.gained || {}; const p = res.progress || {};
      if (dailyData) { dailyData.progress = p; dailyData.doneToday = true; }
      const bonus = res.bonusGained || {};
      const totalSwords = (g.swords || 0) + (bonus.swords || 0);
      rw.innerHTML = '<div class="hw-reward-card">'
        + '<div class="hw-reward-burst">🎉</div>'
        + '<div class="hw-reward-title">¡Reto completado!</div>'
        + '<div class="hw-reward-rows">'
        + '<div class="hw-reward-row">⭐ +' + (g.xp || 0) + ' XP</div>'
        + '<div class="hw-reward-row">⚔️ +' + totalSwords + ' DralySword' + (totalSwords === 1 ? '' : 's')
          + (bonus.swords ? ' <span class="hw-reward-bonus">(+' + bonus.swords + ' bono oración 🎁)</span>' : '') + '</div>'
        + '<div class="hw-reward-row">🔥 Racha: ' + (p.streak || 0) + ' día' + ((p.streak || 0) === 1 ? '' : 's') + '</div>'
        + (res.leveledUp ? '<div class="hw-reward-row hw-reward-levelup">🆙 ¡Subiste a Nivel ' + res.newLevel + '!</div>' : '')
        + '</div><button class="hw-reward-ok" id="hw-reward-ok" type="button">¡Genial!</button></div>';
      try { if (MochiSounds && MochiSounds.winFanfare) MochiSounds.winFanfare(); } catch (_) {}
      // 🎭 CHARACTER CELEBRATION — pick a random rare/legendary character
      // and play their victory animation + catchphrase. Bigger emotional
      // payoff than a static reward card alone.
      try {
        if (window.showCharacterCelebration && window.pickRandomCharacter) {
          const char = window.pickRandomCharacter('rare');
          setTimeout(() => window.showCharacterCelebration(char.id), 1400);
        }
      } catch (_) {}
    } else if (res && res.reason === 'practice') {
      // Replay for fun — no double rewards, just a happy "well practiced".
      rw.innerHTML = '<div class="hw-reward-card">'
        + '<div class="hw-reward-burst">💪</div>'
        + '<div class="hw-reward-title">¡Buen repaso!</div>'
        + '<div class="hw-reward-rows"><div class="hw-reward-row">Ya ganaste tus premios de hoy ✅</div>'
        + '<div class="hw-reward-row">Practicaste <strong>' + DAILY_GAME.correct + '</strong> palabras más 🧠</div></div>'
        + '<button class="hw-reward-ok" id="hw-reward-ok" type="button">¡Genial!</button></div>';
    } else {
      if (dailyData) dailyData.doneToday = true;
      const already = res && res.reason === 'already';
      rw.innerHTML = '<div class="hw-reward-card">'
        + '<div class="hw-reward-burst">📅</div>'
        + '<div class="hw-reward-title">' + (already ? 'Ya completaste el desafío de hoy' : '¡Buen intento!') + '</div>'
        + '<div class="hw-reward-rows"><div class="hw-reward-row">Vuelve mañana para tu próximo desafío 🔥</div></div>'
        + '<button class="hw-reward-ok" id="hw-reward-ok" type="button">OK</button></div>';
    }
    rw.classList.remove('hidden');
    // 🆘 EJECT BAR — full-width red bar at the TOP of the viewport.
    // Appended to <body> not the card so it CANNOT be clipped by card
    // sizing. Highest z-index (100002) so it sits above everything,
    // including character celebrations. Always says "✕ CERRAR" so the
    // kid never has to guess what it does.
    if (!document.querySelector('.hw-reward-eject')) {
      const eject = document.createElement('button');
      eject.type = 'button';
      eject.className = 'hw-reward-eject';
      eject.setAttribute('aria-label', 'Cerrar');
      eject.innerHTML = '<span>✕</span><span>CERRAR</span>';
      document.body.appendChild(eject);
    }
    const ok = $('hw-reward-ok');
    const eject = document.querySelector('.hw-reward-eject');
    const dismiss = () => {
      rw.classList.add('hidden');
      rw.innerHTML = '';   // tear down so subsequent shows rebind fresh
      // Also remove the body-level eject bar so it doesn't linger.
      const ej = document.querySelector('.hw-reward-eject');
      if (ej) { try { ej.remove(); } catch (_) {} }
      try { renderDailyHome(); } catch (_) {}
    };
    if (ok) ok.addEventListener('click', dismiss);
    if (eject) eject.addEventListener('click', dismiss);
    // 🛟 Backdrop click + ESC dismissal — TRIPLE escape hatch so the kid
    // is never trapped even if ¡Genial! and ✕ both get clipped.
    rw.addEventListener('click', (e) => { if (e.target === rw) dismiss(); });
    document.addEventListener('keydown', function rwEsc(e) {
      if (e.key === 'Escape' && !rw.classList.contains('hidden')) {
        document.removeEventListener('keydown', rwEsc);
        dismiss();
      }
    });
  }
  (function bindDaily() {
    const cta = $('hw-list-daily'); if (cta) cta.addEventListener('click', openDaily);
    const hud = $('hw-hud'); if (hud) hud.addEventListener('click', openDaily);
    const back = $('hw-daily-back'); if (back) back.addEventListener('click', () => { stopDailyGame(); showScreen('list'); refreshDailyHud(); });
    const quit = $('hw-game-quit'); if (quit) quit.addEventListener('click', () => { stopDailyGame(); renderDailyHome(); });
  })();

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
    // 🌱 0→2000 lifetime progress bar — counts every sentence the kid has
    // saved (warmup, daily-bonus, edits). User asked for "papas section
    // count flawless"; this is the source of truth, computed server-side
    // from rec.sentencesBuilt.length so retries can't game it.
    const saved = t.sentencesSavedTotal || 0;
    const goal  = t.sentencesSavedGoal  || 2000;
    const pct = Math.min(100, Math.round((saved / goal) * 100));
    // Tiered milestone label so the bar feels like a journey, not a number.
    const milestone =
        saved >= 2000 ? '🐲 ¡Dragón Despierto!'
      : saved >= 1000 ? '🔥 Fénix'
      : saved >=  500 ? '🪷 Loto'
      : saved >=  200 ? '🎋 Bambú'
      : '🌱 Semilla';
    const bar = $('hw-parents-progress');
    if (bar) {
      bar.innerHTML = `
        <div class="hw-pp-head">
          <span class="hw-pp-icon">🌱</span>
          <span class="hw-pp-title">Camino del idioma</span>
          <span class="hw-pp-tier">${milestone}</span>
        </div>
        <div class="hw-pp-bar"><div class="hw-pp-fill" style="width:${pct}%"></div></div>
        <div class="hw-pp-meta"><strong>${saved.toLocaleString('es-ES')}</strong> / ${goal.toLocaleString('es-ES')} oraciones guardadas · ${pct}%</div>
        <div class="hw-pp-note">Cada oración que ${escapeHtml((data.displayName || 'tu hijo/a').split(' ')[0])} guarda en clase suma 1. Meta: 2 000 oraciones (fluidez HSK1+).</div>`;
    }
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
    // === 📝 EXÁMENES REALES — HSK simulation attempts ===
    // User feedback 2026-06-04 (Fernando): parents should see every real
    // HSK exam their kid sat — Sim 1 / Sim 2 / Sim 3 etc — with the date
    // and percentage. We show ALL attempts (not just the best) so they
    // can see the kid's progression: "Did 60% on first try, 80% on the
    // retake". Empty state explains what these are.
    const hskWrap = $('hw-parents-hsk');
    if (hskWrap) {
      const hskRows = Array.isArray(data.hskResults) ? data.hskResults : [];
      if (!hskRows.length) {
        hskWrap.innerHTML = '<div class="hw-parents-empty">Aún no ha hecho ninguna simulación del HSK. Estas son los exámenes oficiales que practicamos en clase — cuando tu hijo/a haga su primera, aquí verás el resultado.</div>';
      } else {
        hskWrap.innerHTML = '';
        hskRows.forEach((r) => {
          const row = document.createElement('div');
          row.className = 'hw-parents-hsk-row';
          // Same "passed if ≥ 60%" convention as the rest of the parent
          // view (HSK official passing line is also 60%).
          const passed = (r.percent != null) && r.percent >= 60;
          const dateStr = new Date(r.ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
          const pctStr = (r.percent != null) ? Math.round(r.percent) + '%' : '—';
          row.innerHTML = `
            <div class="hw-parents-hsk-main">
              <span class="hw-parents-hsk-title">📝 ${escapeHtml(r.title)}</span>
              <span class="hw-parents-hsk-score ${passed ? 'is-passed' : 'is-low'}">${r.score}/${r.total} <small>· ${pctStr}</small></span>
              <span class="hw-parents-hsk-date">${dateStr}</span>
            </div>
            <div class="hw-parents-hsk-note">${passed
              ? '✅ Aprobó — Felicítalo/a y pídele que te cuente qué le gustó del examen.'
              : '🌱 Aún no aprueba este examen. Anímalo/a a repasar y volverlo a intentar.'}</div>`;
          hskWrap.appendChild(row);
        });
      }
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
    const gColor = ({ A: '#1f9d55', B: '#2b7fd1', C: '#d18a00', D: '#d15a00', E: '#c81e1e' })[String(grade).toUpperCase()] || '#c81e1e';
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Diploma · ${escapeHtml(d.displayName)} · ${escapeHtml(prettyMonth(d.month))}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@600;800;900&family=ZCOOL+XiaoWei&family=Ma+Shan+Zheng&display=swap');
  * { box-sizing: border-box; margin: 0; }
  html, body { overflow-x: hidden; }
  body { font-family: 'Nunito', sans-serif; min-height: 100vh; width: 100%;
    background: radial-gradient(circle at 50% 0%, #3a0d0d, #160707 70%);
    padding: clamp(10px, 3vw, 24px); color: #3a2410; }
  /* 🔧 width:100% + max-width so the diploma ALWAYS fills the phone screen
     (was rendering narrow on mobile before). Inner padding scales fluidly. */
  .cert { width: 100%; max-width: 680px; margin: 0 auto; position: relative;
    background:
      repeating-linear-gradient(45deg, rgba(200,30,30,0.025) 0 14px, transparent 14px 28px),
      radial-gradient(circle at 50% 18%, #fffdf6, #f7ead2);
    border-radius: 14px; padding: clamp(6px, 2vw, 14px);
    box-shadow: 0 22px 60px rgba(0,0,0,0.6); }
  /* triple ornamental border */
  .frame { border: 3px solid #d4af37; border-radius: 10px; padding: 5px; }
  .frame2 { border: 1.5px solid #c81e1e; border-radius: 7px; padding: 4px; }
  .inner { border: 1px solid #d4af37; border-radius: 5px; padding: clamp(18px, 4vw, 30px) clamp(14px, 4vw, 30px) clamp(22px, 4vw, 32px); position: relative; overflow: hidden; }
  /* corner flourishes */
  .corner { position: absolute; font-size: 1.5rem; color: #d4af37; }
  .corner.tl { top: 8px; left: 10px; } .corner.tr { top: 8px; right: 10px; }
  .corner.bl { bottom: 8px; left: 10px; } .corner.br { bottom: 8px; right: 10px; }
  /* faint watermark hanzi */
  .wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-family: 'Ma Shan Zheng', 'ZCOOL XiaoWei', serif; font-size: 18rem; color: rgba(200,30,30,0.05);
    pointer-events: none; user-select: none; }
  .head { text-align: center; position: relative; z-index: 1; }
  .dragon { font-size: 3rem; line-height: 1; }
  .brand { font-family: 'Cinzel', serif; font-weight: 900; font-size: 1.55rem; color: #8a1414; letter-spacing: 0.06em; margin-top: 2px; }
  .brand small { display:block; font-family:'Nunito'; font-weight:800; font-size:0.66rem; letter-spacing:0.34em; color:#b06a2a; }
  .rule { height: 2px; width: 70%; margin: 12px auto; background: linear-gradient(90deg, transparent, #d4af37, transparent); }
  .title { font-family: 'Cinzel', serif; font-weight: 900; font-size: 1.25rem; color: #c81e1e; letter-spacing: 0.12em; }
  .titlehz { font-family: 'Ma Shan Zheng','ZCOOL XiaoWei', serif; font-size: 1.5rem; color: #8a1414; margin-top: 2px; }
  .awarded { margin-top: 14px; font-weight: 700; color: #6b4a2a; font-size: 0.9rem; }
  .name { font-family: 'Ma Shan Zheng', 'Cinzel', serif; font-weight: 900; font-size: 2.5rem; color: #8a1414; margin: 4px 0; line-height: 1.1; }
  .namebar { height: 1.5px; width: 60%; margin: 0 auto 6px; background: #d4af37; }
  .avatar { width: 92px; height: 92px; border-radius: 50%; background: #fff; border: 4px solid #d4af37; object-fit: contain; margin: 8px auto 0; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display:block; }
  .gradeseal { position: relative; width: 132px; height: 132px; margin: 16px auto 6px; }
  .gradeseal .ring { position:absolute; inset:0; border-radius:50%; border: 4px solid ${gColor};
    box-shadow: 0 0 0 5px rgba(255,255,255,0.6), 0 0 0 7px ${gColor}; display:flex; flex-direction:column; align-items:center; justify-content:center; background: radial-gradient(circle, #fff, #fff6e6); }
  .gradeseal .g { font-family: 'Cinzel', serif; font-weight: 900; font-size: 3.4rem; color: ${gColor}; line-height: 1; }
  .gradeseal .lbl { font-size: 0.62rem; font-weight: 900; letter-spacing: 0.22em; color: #b06a2a; }
  .gradeseal .star { position:absolute; top:-8px; left:50%; transform:translateX(-50%); font-size:1.4rem; }
  .month { text-align: center; font-weight: 800; color: #b06a2a; margin-bottom: 6px; }
  .sect { font-family: 'Cinzel', serif; font-weight: 900; color: #8a1414; margin: 16px 0 6px; font-size: 1.05rem; text-align:center; }
  ul { padding-left: 22px; line-height: 1.7; font-weight: 700; color: #3a2b1a; max-width: 460px; margin: 0 auto; }
  .stats { display: flex; gap: 10px; margin: 16px auto 0; max-width: 440px; }
  .stat { flex: 1; background: rgba(212,175,55,0.14); border: 1px solid rgba(212,175,55,0.5); border-radius: 12px; padding: 10px; text-align: center; }
  .stat b { display: block; font-size: 1.5rem; color: #c81e1e; font-family: 'Cinzel', serif; }
  .stat span { font-size: 0.72rem; font-weight: 800; color: #b06a2a; }
  .foot { text-align: center; margin-top: 16px; font-weight: 800; color: #8a1414; }
  .sig { display:flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; padding: 0 10px; }
  .sigblk { text-align:center; flex:1; }
  .sigline { border-top: 1.5px solid #8a1414; margin: 0 8px 4px; }
  .sigblk small { font-size: 0.7rem; color: #6b4a2a; font-weight: 800; }
  .signame { font-family:'Ma Shan Zheng', serif; color:#8a1414; font-size:1.1rem; }
  .goldseal { font-size: 2.8rem; }
  /* 🔧 FAB-style PDF button — always pinned to the bottom of the viewport
     on phones so it's never hidden behind the diploma scroll. Adds bottom
     padding to body so the cert content isn't trapped under the button. */
  .pbtn {
    display: block;
    position: fixed;
    bottom: max(16px, env(safe-area-inset-bottom, 16px));
    left: 50%; transform: translateX(-50%);
    background: linear-gradient(135deg, #c81e1e, #e23b3b); color:#fff;
    border:none; border-radius:999px; padding:14px 30px;
    font-weight:900; font-size:1.02rem; cursor:pointer;
    box-shadow: 0 8px 22px rgba(200,30,30,0.55), 0 0 0 4px rgba(255,255,255,0.85);
    z-index: 9999;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(200,30,30,0.6);
    white-space: nowrap;
  }
  .pbtn:active { transform: translateX(-50%) scale(0.96); }
  body { padding-bottom: 90px !important; }
  @media print {
    body { background:#fff; padding:0 !important; }
    .pbtn { display:none; }
    .cert { box-shadow:none; }
  }
</style></head><body>
  <div class="cert"><div class="frame"><div class="frame2"><div class="inner">
    <span class="corner tl">❖</span><span class="corner tr">❖</span>
    <span class="corner bl">❖</span><span class="corner br">❖</span>
    <div class="wm">龙</div>
    <div class="head">
      <div class="dragon">🐉</div>
      <div class="brand">DRALINGO<small>EDUTECH · 中文 HSK1</small></div>
      <div class="rule"></div>
      <div class="title">CERTIFICADO DE LOGRO</div>
      <div class="titlehz">学习证书</div>
      ${avatarUrl ? `<img class="avatar" src="${avatarUrl}" alt="">` : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;font-size:2.8rem;">🧒</div>'}
      <div class="awarded">Otorgado con orgullo a</div>
      <div class="name">${escapeHtml(d.displayName)}</div>
      <div class="namebar"></div>
      <div class="month">📅 ${escapeHtml(prettyMonth(d.month))}</div>
      <div class="gradeseal">
        <span class="star">⭐</span>
        <div class="ring"><div class="g">${grade}</div><div class="lbl">CALIFICACIÓN</div></div>
      </div>
      <div class="sect">🌟 Observaciones del maestro</div>
      <ul>${notesHtml}</ul>
      <div class="stats">
        <div class="stat"><b>${d.stats ? d.stats.assignments : 0}${d.stats && d.stats.assignmentsAttempted ? '<span style="font-size:0.7rem;color:#b06a2a;">/'+d.stats.assignmentsAttempted+'</span>' : ''}</b><span>TAREAS APROBADAS</span></div>
        <div class="stat"><b>${d.stats ? d.stats.tests : 0}${d.stats && d.stats.testsAttempted ? '<span style="font-size:0.7rem;color:#b06a2a;">/'+d.stats.testsAttempted+'</span>' : ''}</b><span>EXÁMENES</span></div>
        <div class="stat"><b>${d.stats ? d.stats.sentences : 0}</b><span>ORACIONES</span></div>
      </div>
      <div class="foot">¡Sigue practicando en voz alta! 加油 🎉</div>
      <div class="sig">
        <div class="sigblk"><div class="signame">🐉 Dralingo 老师</div><div class="sigline"></div><small>MAESTRO/A</small></div>
        <div class="goldseal">🏅</div>
        <div class="sigblk"><div class="signame">${escapeHtml(prettyMonth(d.month))}</div><div class="sigline"></div><small>FECHA</small></div>
      </div>
    </div>
    <button class="pbtn" onclick="window.print()">📄 Guardar como PDF / Compartir</button>
  </div></div></div></div>
  <script>setTimeout(function(){ try { window.focus(); } catch(e){} }, 200);<\/script>
</body></html>`;
    // 🔧 BLOB URL approach — bullet-proof against the Samsung/Android
    // about:blank race that was breaking second-generation reports.
    // document.write into an unfocused new tab on mobile sometimes lost
    // half the markup; navigating to a fresh blob URL makes the browser
    // treat it as a real navigation, so layout/print preview behave
    // identically on the 1st, 5th, 50th generation.
    let url;
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      url = URL.createObjectURL(blob);
    } catch (e) {
      // Older browsers without Blob: fall back to the old approach.
      const w0 = window.open('', '_blank');
      if (!w0) { alert('Permite ventanas emergentes para ver la boleta.'); return; }
      w0.document.open(); w0.document.write(html); w0.document.close();
      return;
    }
    const w = window.open(url, '_blank');
    if (!w) {
      URL.revokeObjectURL(url);
      alert('Permite ventanas emergentes para ver la boleta.');
      return;
    }
    try { w.focus(); } catch (_) {}
    // Free the blob URL once the new tab has had time to load.
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 60000);
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
  // 🎯 PASS RULE: a tarea is only "done/passed" at ≥80%. Below that it stays
  // PENDING and the kid must retry (user 2026-05-28: "cannot pass <80").
  const HW_PASS_PCT = 80;
  function assignmentBestPct(a) {
    const att = submissions.filter((s) => s.assignmentId === a.id);
    if (!att.length) return null;
    const totals = a.totalPoints || (a.itemCount ? a.itemCount * 20 : 100);
    return Math.max(...att.map((s) => (s.score / (s.total || totals)) * 100));
  }
  // 🔧 FIX: use integer multiplication instead of percentage comparison.
  // 12/15 in floats → 79.9999999%, which fails `>= 80`. But 12 >= 15*0.8
  // = 12 >= 12 = true. Float-safe. Also accept any submission where the
  // raw score meets the threshold directly.
  function assignmentPassed(a) {
    const att = submissions.filter((s) => s.assignmentId === a.id);
    if (!att.length) return false;
    return att.some((s) => {
      const total = s.total || a.totalPoints || (a.itemCount ? a.itemCount * 20 : 100);
      return total > 0 && s.score * 100 >= total * HW_PASS_PCT;
    });
  }
  // Best-effort story→experience grouping for the reading folders.
  const READING_EXP = { xiaomingday: 'exp8' };
  function readingExpOf(r) { return (r && (READING_EXP[r.storyId] || r.exp)) || 'exp1'; }
  (function bindFolderBack() {
    const b = $('hw-folder-back');
    if (b) b.addEventListener('click', () => { hwFolder = null; renderList(); });
  })();
  // 🗂️ Three-tab bindings. Tabs are MUTUALLY EXCLUSIVE; switching one only
  // re-renders the root view, never the folder contents.
  (function bindTabs() {
    const ids = ['hw-tab-pending', 'hw-tab-done', 'hw-tab-custom'];
    ids.forEach((id) => {
      const t = $(id); if (!t) return;
      t.addEventListener('click', () => {
        currentTab = t.dataset.tab || 'pending';
        ids.forEach((x) => { const e = $(x); if (e) e.classList.toggle('is-active', e.id === id); });
        // Switching tabs always returns to the root view.
        hwFolder = null;
        renderList();
      });
    });
  })();

  function renderList() {
    $('hw-list-name').textContent = displayName || 'Anon';
    renderAvatarInto($('hw-list-avatar'), avatar);
    if (hwFolder) renderFolderContents(hwFolder);
    else renderFolderRoot();
    // Refresh reading state once; its callback re-renders (no fetch loop).
    fetchReadingTests();
  }

  // 🎯 Pull custom assignments the teacher sent to ME. ONLY re-renders the
  // custom section — not the whole folder root. Previously every fetch
  // re-rendered the entire grid, which could destroy an HSK1 card mid-tap
  // on iPhone / Galaxy (the click was registered against a stale node).
  function refreshCustomAssignments() {
    if (!studentCode || !accessCode) return;
    fetch('/api/homework/custom-assignments/' + encodeURIComponent(studentCode)
        + '?accessCode=' + encodeURIComponent(accessCode))
      .then((r) => r.json())
      .then((d) => {
        customAssignments = (d && d.assignments) || [];
        if (!hwFolder) renderCustomSection();
        updateTabCounts();
      })
      .catch(() => { customAssignments = []; });
  }
  // Compute the tag for every custom assignment ONCE — used by the tab count
  // badge AND by the custom-tab list render.
  function taggedCustomAssignments() {
    return (customAssignments || []).slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((a) => {
        const ptsForPass = (a.itemCount || 0) * 8;
        const subs = submissions.filter((s) => s.assignmentId === a.id);
        const best = subs.reduce((m, s) => (s.score > (m && m.score || -1) ? s : m), null);
        let status = 'new';
        if (best && best.score >= ptsForPass) status = 'done';
        else if (best) status = 'pending';
        return { a, status, best };
      });
  }
  // Renders the FLAT custom-assignment list (all teacher-sent tareas) into
  // the new dedicated #hw-list-custom-all grid. Only shown when the active
  // tab is "custom". The Pendientes/Completadas HSK1 tabs never see these.
  function renderCustomSection() {
    const wrap = $('hw-list-custom-all');
    if (!wrap) return;
    if (hwFolder || currentTab !== 'custom') { wrap.classList.add('hidden'); return; }
    const tagged = taggedCustomAssignments();
    wrap.classList.remove('hidden');
    wrap.innerHTML = '';
    if (!tagged.length) {
      wrap.innerHTML = '<div class="hw-empty">Tu maestro/a aún no te ha enviado tareas. ✨</div>';
      return;
    }
    renderCustomCards(wrap, tagged);
  }
  function renderCustomCards(grid, list) {
    grid.innerHTML = '';
    list.forEach(({ a, status, best }) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'hw-folder-card hw-custom-card'
        + (status === 'done' ? ' is-passed' : status === 'pending' ? ' is-pending' : '');
      const when = a.createdAt ? new Date(a.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
      const tag = status === 'done'
          ? '<div class="hw-folder-progress">✓ Completada · ' + (best ? best.score + '/' + best.total : '') + '</div>'
        : status === 'pending'
          ? '<div class="hw-folder-progress">⏳ Reintenta · mejor ' + (best ? best.score + '/' + best.total : '0') + '</div>'
          : '<div class="hw-folder-progress">🆕 ¡Para ti!</div>';
      card.innerHTML = `
        <div class="hw-folder-emoji">🎯</div>
        <div class="hw-folder-name">${escapeHtml(a.title || 'Tarea especial')}</div>
        <div class="hw-folder-meta">📝 ${a.itemCount} oración${a.itemCount === 1 ? '' : 'es'} · ${when}</div>
        ${tag}`;
      card.dataset.assignmentId = a.id;
      card.addEventListener('click', () => openAssignment(a.id));
      grid.appendChild(card);
    });
  }
  // ROOT — HSK1 folders, filtered by the active tab. The folder card's
  // count shows only items that match the tab (so "EXP1 · 2/3 ✓" in Done
  // means 2 of 3 passed, while in Pendientes it would show "3 por hacer").
  function renderFolderRoot() {
    $('hw-folder-bar').classList.add('hidden');
    $('hw-sec-tareas').classList.add('hidden');
    $('hw-sec-lecturas').classList.add('hidden');
    $('hw-list-readings').classList.add('hidden');
    const tabsBar = $('hw-tabs'); if (tabsBar) tabsBar.classList.remove('hidden');
    const t = document.querySelector('.hw-list-title'); if (t) t.textContent = '📚 HSK1';
    // Always refresh the custom flat list (visible only on the custom tab).
    renderCustomSection();
    const grid = $('hw-list-grid');
    updateTabCounts();
    if (currentTab === 'custom') {
      // Hide the HSK1 grid; the custom flat list above takes over.
      grid.classList.add('hidden');
      grid.innerHTML = '';
      return;
    }
    grid.classList.remove('hidden');
    grid.innerHTML = '';
    const exps = window.WU_EXPERIENCES || {};
    const showDone = currentTab === 'done';
    ['exp1','exp2','exp3','exp4','exp5','exp6','exp7','exp8'].forEach((expId) => {
      const exp = exps[expId];
      if (!exp) return;
      const eAssigns = assignments.filter((a) => a.expLabel === expId);
      const eReads = (readingTests || []).filter((r) => readingExpOf(r) === expId);
      const total = eAssigns.length + eReads.length;
      const aDone = eAssigns.filter((a) => assignmentPassed(a)).length;
      const rDone = eReads.filter((r) => r.bestScore != null && r.bestScore >= 80).length;
      const done = aDone + rDone;
      const pending = total - done;
      // Skip folders that don't contribute to the current tab.
      if (showDone && done === 0) return;
      if (!showDone && pending === 0) return;
      const emoji = (exp.short || '📁').split(' ')[0] || '📁';
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'hw-folder-card'
        + (showDone ? ' hw-folder-done' : ' hw-folder-pending');
      const meta = showDone
        ? '<div class="hw-folder-progress">✅ ' + done + ' completada' + (done === 1 ? '' : 's') + '</div>'
        : '<div class="hw-folder-progress">⏳ ' + pending + ' por hacer</div>';
      card.innerHTML = `
        <div class="hw-folder-emoji">${emoji}</div>
        <div class="hw-folder-name">${escapeHtml(exp.label || expId)}</div>
        <div class="hw-folder-meta">${total + ' actividad' + (total === 1 ? '' : 'es') + ' en total'}</div>
        ${meta}`;
      // 🛡️ data-folder-id mirrors the data-assignment-id approach so the
      // global capture-phase delegate catches folder taps too, even if
      // this per-card handler ever fails to attach (e.g. re-render race).
      card.dataset.folderId = expId;
      card.addEventListener('click', () => { hwFolder = expId; renderList(); window.scrollTo({top:0, behavior:'instant'}); });
      grid.appendChild(card);
    });
    if (!grid.children.length) {
      grid.innerHTML = showDone
        ? '<div class="hw-empty">Aún no has completado ninguna tarea. ¡Vamos a Pendientes! 💪</div>'
        : '<div class="hw-empty">🎉 ¡Sin pendientes! Has terminado todo lo disponible.</div>';
    }
  }

  // FOLDER — assignments (+ readings) inside one experience, filtered by tab.
  function renderFolderContents(expId) {
    const exp = (window.WU_EXPERIENCES || {})[expId];
    const tabsBar = $('hw-tabs'); if (tabsBar) tabsBar.classList.add('hidden');
    // Hide the custom flat list while inside a folder.
    const cu = $('hw-list-custom-all'); if (cu) cu.classList.add('hidden');
    $('hw-folder-bar').classList.remove('hidden');
    const tabLabel = currentTab === 'done' ? ' · ✅ Completadas' : ' · ⏳ Pendientes';
    $('hw-folder-crumb').textContent = (exp ? exp.label : expId) + tabLabel;
    const grid = $('hw-list-grid');
    grid.classList.remove('hidden');
    grid.innerHTML = '';
    const showDone = currentTab === 'done';
    const list = assignments.filter((a) => {
      if (a.expLabel !== expId) return false;
      const passed = assignmentPassed(a);
      return showDone ? passed : !passed;
    });
    $('hw-sec-tareas').classList.toggle('hidden', list.length === 0);
    list.forEach((a) => grid.appendChild(buildAssignmentCard(a)));
    renderReadingsList();
    if (!list.length && !($('hw-list-readings').children.length)) {
      grid.innerHTML = showDone
        ? '<div class="hw-empty">Aún no has completado actividades de esta unidad.</div>'
        : '<div class="hw-empty">¡Sin pendientes en esta unidad! 🎉</div>';
    }
  }
  // 🔢 Update the 3 tab count badges. Called whenever data changes.
  function updateTabCounts() {
    const exps = window.WU_EXPERIENCES || {};
    let pendingCount = 0, doneCount = 0;
    ['exp1','exp2','exp3','exp4','exp5','exp6','exp7','exp8'].forEach((expId) => {
      if (!exps[expId]) return;
      const eA = assignments.filter((a) => a.expLabel === expId);
      const eR = (readingTests || []).filter((r) => readingExpOf(r) === expId);
      const aDone = eA.filter((a) => assignmentPassed(a)).length;
      const rDone = eR.filter((r) => r.bestScore != null && r.bestScore >= 80).length;
      doneCount += aDone + rDone;
      pendingCount += (eA.length - aDone) + (eR.length - rDone);
    });
    const customCount = (customAssignments || []).length;
    const setTxt = (id, n) => { const el = $(id); if (el) el.textContent = String(n); };
    setTxt('hw-tab-count-pending', pendingCount);
    setTxt('hw-tab-count-done', doneCount);
    setTxt('hw-tab-count-custom', customCount);
  }

  // One assignment card (+ a review button once attempted) — shared by both
  // views. Returns a fragment so we can append the card AND a "ver errores".
  function buildAssignmentCard(a) {
    const frag = document.createDocumentFragment();
    const myAttempts = submissions.filter((s) => s.assignmentId === a.id);
    const bestScore = myAttempts.length ? Math.max(...myAttempts.map((s) => s.score)) : null;
    const pct = assignmentBestPct(a);
    const passed = pct != null && pct >= HW_PASS_PCT;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'hw-card' + (passed ? ' hw-card-done' : '');
    // <80% → still PENDING (must retry). Show the score but mark it pending.
    const statusBadge = bestScore == null
      ? '<span class="hw-card-badge new">Nueva</span>'
      : (passed
          ? `<span class="hw-card-badge done">✓ ${bestScore}/${a.totalPoints} pts</span>`
          : `<span class="hw-card-badge pending">⏳ ${bestScore}/${a.totalPoints} · reintenta (necesitas 80%)</span>`);
    const expNum = (a.expLabel || '').replace('exp', '');
    const sameExp = assignments.filter((x) => x.expLabel === a.expLabel);
    const lessonNo = Math.max(1, sameExp.indexOf(a) + 1);
    const lessonChip = expNum ? `<span class="hw-card-exp">EXP${expNum} / ${lessonNo}</span>` : '';
    card.innerHTML = `
      <div class="hw-card-head">
        ${statusBadge}
        <span class="hw-card-points">${a.totalPoints} pts</span>
      </div>
      ${lessonChip}
      <div class="hw-card-title">${escapeHtml(a.title)}</div>
      <div class="hw-card-sub">${escapeHtml(a.subtitle)}</div>
      <div class="hw-card-meta">${a.itemCount} oraciones</div>`;
    card.dataset.assignmentId = a.id;
    card.addEventListener('click', () => openAssignment(a.id));
    frag.appendChild(card);
    // 🔎 Once attempted, let the kid review exactly what they missed.
    if (bestScore != null) {
      const rev = document.createElement('button');
      rev.type = 'button';
      rev.className = 'hw-review-btn';
      rev.textContent = '🔎 Ver mis errores';
      rev.addEventListener('click', () => openAssignmentReview(a.id, a.title));
      frag.appendChild(rev);
    }
    return frag;
  }
  // Fetch the kid's best assignment submission breakdown → mistakes modal.
  function openAssignmentReview(id, title) {
    fetch('/api/homework/assignment-review/' + encodeURIComponent(id)
        + '?accessCode=' + encodeURIComponent(accessCode) + '&studentCode=' + encodeURIComponent(studentCode))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok || !data.attempt) { alert('Aún no hay intento para revisar.'); return; }
        showMistakesModal(title, data.attempt.score, data.attempt.total,
          (data.attempt.breakdown || []).map((b) => ({
            q: b.es, picked: b.student || '—', correctAns: b.expected, correct: !!b.correct,
          })));
      })
      .catch((e) => alert('Error: ' + e.message));
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
    // Filter by the active tab — Pendientes shows unstarted/below-80 lecturas,
    // Completadas shows ≥80 only. (No tab switch inside folder, but the tab
    // selected on root determines what enters here.)
    const showDone = currentTab === 'done';
    const mine = (readingTests || []).filter((r) => {
      if (readingExpOf(r) !== hwFolder) return false;
      const passed = r.bestScore != null && r.bestScore >= 80;
      return showDone ? passed : !passed;
    });
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
  // ✨ SIMPLEST POSSIBLE OPEN — no AbortController, no timeout, no retry.
  // Sequence-based dedup is the ONLY thing we need: every new tap bumps
  // _openRequestSeq, and only the response whose mySeq matches the
  // latest seq gets to render. Stale responses are dropped silently.
  // Previous versions tried to be too clever with abort + retry, which
  // on flaky mobile networks turned ordinary in-flight fetches into
  // false-positive "Conexión lenta" toasts.
  let _openRequestSeq = 0;
  // No-op kept so existing callers (back button) don't error out.
  function _cancelOpenInFlight() { /* deliberate: see comment above */ }
  // 📢 Non-blocking toast — replaces alert() so a transient network blip
  // doesn't lock the kid behind an OK button. Auto-dismisses after 2.4s.
  function _hwToast(msg) {
    let t = document.querySelector('.hw-net-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'hw-net-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(_hwToast._timer);
    _hwToast._timer = setTimeout(() => t.classList.remove('is-show'), 2400);
  }
  function openAssignment(id) {
    if (!id) return;
    // 🩹 NUKE leftover overlays from a previous open — these were the
    // actual cause of "second tap, screen doesn't change":
    //   .hw-reward       → "¡Reto completado!" overlay, z-index 9999
    //   .hw-cutscene     → daily-game intro/outro overlays
    //   .char-celebration → Gojo/Yuji animated wins
    // ⚡ Optimization: querySelector first (cheap, stops at first match)
    // before doing the full querySelectorAll + remove loop. 99% of the
    // time there are no overlays and we skip the iteration entirely.
    if (document.querySelector('.hw-cutscene, .char-celebration')) {
      document.querySelectorAll('.hw-cutscene, .char-celebration').forEach((el) => {
        try { el.remove(); } catch (_) {}
      });
    }
    const rwEl = $('hw-reward');
    if (rwEl && !rwEl.classList.contains('hidden')) { rwEl.classList.add('hidden'); rwEl.innerHTML = ''; }
    const gameEl = $('hw-game');
    if (gameEl && !gameEl.classList.contains('hidden')) gameEl.classList.add('hidden');
    if (document.body.style.overflow) document.body.style.overflow = '';
    if (document.documentElement.style.overflow) document.documentElement.style.overflow = '';
    // Visual feedback so the kid knows their tap registered.
    document.querySelectorAll('.hw-card-loading').forEach((el) => el.classList.remove('hw-card-loading'));
    const card = document.querySelector('[data-assignment-id="' + CSS.escape(id) + '"]');
    if (card) card.classList.add('hw-card-loading');
    currentAssignment = null;
    const mySeq = ++_openRequestSeq;
    const isCustom = String(id || '').slice(0, 3) === 'ca_';
    const url = isCustom
      ? '/api/homework/custom-assignment/' + encodeURIComponent(id) + '?accessCode=' + encodeURIComponent(accessCode) + '&studentCode=' + encodeURIComponent(studentCode)
      : '/api/homework/assignment/' + encodeURIComponent(id) + '?accessCode=' + encodeURIComponent(accessCode);
    // 🔬 DIAGNOSTIC FETCH PATH — separates "network failed" from "server
    // said no" from "render code threw." Previous versions lumped all
    // three into a single .catch + a generic "Toca otra vez" toast that
    // hid the real cause. Now each failure mode has its own clear
    // signal so we can actually FIX the right thing.
    //
    // ⚠️ CRITICAL: r.json() failures and renderAssignment() throws
    // would BOTH land in the outer .catch as "network errors", giving
    // false "Toca otra vez" toasts even on perfectly successful HTTP
    // responses. Wrapping renderAssignment in its own try/catch isolates
    // render errors from network errors.
    fetch(url)
      .then((r) => r.text().then((txt) => ({ r: r, txt: txt })))
      .then(({ r, txt }) => {
        if (card) card.classList.remove('hw-card-loading');
        if (mySeq !== _openRequestSeq) return; // newer tap won
        // Try to parse as JSON; show body preview on failure for debug.
        let data = null;
        try { data = JSON.parse(txt); } catch (_) {}
        if (!data) {
          console.error('[homework] non-JSON response (status=' + r.status + '):', txt.slice(0, 200));
          _hwToast('Respuesta inválida (HTTP ' + r.status + ')');
          return;
        }
        if (!data.ok) {
          _hwToast('Servidor: ' + (data.error || 'no autorizado'));
          return;
        }
        // Server returned OK — try to render. Any render error is shown
        // separately from network errors so we don't false-alarm "Red".
        try {
          const asg = isCustom ? data.assignment : data;
          if (!asg || !Array.isArray(asg.items)) {
            console.error('[homework] missing items in response:', data);
            _hwToast('Tarea sin contenido. Avisa a tu maestra.');
            return;
          }
          currentAssignment = asg;
          currentAssignment.custom = isCustom || !!currentAssignment.custom;
          currentAnswers = currentAssignment.items.map(() => '');
          undoStacks = currentAssignment.items.map(() => []);
          activeExpTab = currentAssignment.custom ? 'all' : (currentAssignment.expLabel || 'all');
          renderAssignment();
          showScreen('assignment');
          window.scrollTo({ top: 0, behavior: 'instant' });
        } catch (renderErr) {
          console.error('[homework] render error:', renderErr);
          _hwToast('Error de pantalla. Recarga la página.');
          // Best-effort recovery: clear state so the kid can re-tap.
          currentAssignment = null;
        }
      })
      .catch((e) => {
        if (card) card.classList.remove('hw-card-loading');
        if (mySeq !== _openRequestSeq) return;
        console.error('[homework] fetch error:', e);
        // Show the actual error name so we can debug what's failing.
        const m = (e && e.message) ? e.message : (e && e.name) || 'desconocido';
        _hwToast('Red: ' + String(m).slice(0, 50));
      });
  }
  function renderAssignment() {
    $('hw-asg-title').textContent = currentAssignment.title;
    $('hw-asg-sub').textContent = currentAssignment.subtitle;
    $('hw-asg-instructions').textContent = currentAssignment.instructions;
    const itemsWrap = $('hw-asg-items');
    // 🛟 The library section was MOVED INTO an item row by setActiveItem
    // on the previous open. If we wipe items with innerHTML='' while the
    // library is inside one of them, the library DOM node is destroyed
    // and subsequent setActiveItem calls can't find it. Rescue it back
    // to its assignment-screen home BEFORE wiping. This was a real
    // root cause of "second open is broken / weird" — render code was
    // touching a detached/destroyed library element.
    const libRescue = $('hw-asg-library-section');
    const asgRoot = $('screen-assignment');
    if (libRescue && asgRoot && libRescue.parentNode !== asgRoot) {
      try { asgRoot.appendChild(libRescue); } catch (_) {}
    }
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
          <span class="hw-stage-empty">Toca palabras del catálogo…</span>
        </div>
        <div class="hw-item-actions">
          <button class="btn btn-ghost btn-sm hw-item-speak" data-idx="${i}" type="button" title="Escucha tu oración en chino" aria-label="Escuchar">🔊 Oír</button>
          <button class="btn btn-gold btn-sm hw-item-savesent" data-idx="${i}" type="button" title="Guardar esta oración en Mis Oraciones" aria-label="Guardar oración">💾 Guardar</button>
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
    // 💾 GUARDAR ORACIÓN — user feedback 2026-06-03: the undo button
    // wasn't getting used; replaced with a save-this-sentence shortcut
    // that pipes the current pinyin into /api/homework/sentences/save
    // → reuses the same logSentence path warmup uses, so the entry
    // shows up in "Mis oraciones" + the monthly report + the
    // teacher's Cuaderno automatically.
    itemsWrap.querySelectorAll('.hw-item-savesent').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        const text = (currentAnswers[i] || '').trim();
        if (!text) { alert('Primero arma la oración tocando palabras.'); return; }
        // Tokenize into wordIDs by space — try to match each chunk in
        // the warmup catalog by tone-stripped pinyin. Unknown chunks
        // pass through as their raw text (renderMonthBucket already
        // shows unknown IDs as a stub chip so nothing is lost).
        const stripTones = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const byBare = {};
        if (window.WU_WORD_BY_ID) {
          Object.keys(window.WU_WORD_BY_ID).forEach((id) => {
            const w = window.WU_WORD_BY_ID[id];
            if (w && w.pinyin) byBare[stripTones(w.pinyin).replace(/\s+/g, '')] = id;
          });
        }
        const chunks = text.split(/\s+/).filter(Boolean);
        const words = chunks.map((chunk) => {
          const bare = stripTones(chunk).replace(/\s+/g, '');
          return byBare[bare] || chunk;
        });
        // POST to the existing save endpoint
        btn.disabled = true;
        btn.textContent = '⏳ Guardando…';
        fetch('/api/homework/sentences/save', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessCode, studentCode, words }),
        }).then((r) => r.json()).then((d) => {
          btn.disabled = false;
          if (d && d.ok) {
            btn.textContent = '✓ Guardada';
            setTimeout(() => { btn.innerHTML = '💾 Guardar'; }, 1500);
          } else {
            btn.textContent = '💾 Guardar';
            alert('No se pudo guardar: ' + ((d && d.error) || 'desconocido'));
          }
        }).catch((e) => {
          btn.disabled = false;
          btn.textContent = '💾 Guardar';
          alert('Error: ' + e.message);
        });
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
    // Bind the anchored prev/next nav once. Clone-trick to be idempotent
    // across re-renders of the assignment screen.
    ['hw-anchor-prev', 'hw-anchor-next'].forEach((id) => {
      const el = $(id); if (!el) return;
      const fresh = el.cloneNode(true);
      el.parentNode.replaceChild(fresh, el);
      fresh.addEventListener('click', () => {
        setActiveItem(activeItemIdx + (id === 'hw-anchor-next' ? 1 : -1));
      });
    });
  }
  let activeItemIdx = 0;
  function setActiveItem(i) {
    if (!currentAssignment || !Array.isArray(currentAssignment.items)) { activeItemIdx = i; return; }
    // Clamp so the prev/next nav can't run off the ends.
    i = Math.max(0, Math.min(currentAssignment.items.length - 1, i));
    activeItemIdx = i;
    document.querySelectorAll('.hw-item-stage').forEach((s) => {
      s.classList.toggle('active', +s.dataset.idx === i);
    });
    document.querySelectorAll('.hw-item').forEach((r) => {
      r.classList.toggle('is-active-item', +r.dataset.idx === i);
    });
    // 📌 ANCHORED CATALOG — move the whole word library into the active
    // item so kids see it RIGHT THERE instead of scrolling to the bottom.
    // Re-uses existing renderLibrary/search/tabs logic by simply relocating
    // the element. The library follows the active item as it changes.
    const lib = $('hw-asg-library-section');
    const activeRow = document.querySelector('.hw-item[data-idx="' + i + '"]');
    if (lib && activeRow && lib.parentNode !== activeRow) {
      activeRow.appendChild(lib);
    }
    // Update prev/next nav labels + state.
    updateAnchorNav();
    // Smooth-scroll so the active stage stays visible above the catalog.
    if (activeRow) {
      try { activeRow.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    }
  }
  // Re-target the prev/next navigation buttons in the anchored library.
  function updateAnchorNav() {
    if (!currentAssignment) return;
    const total = currentAssignment.items.length;
    const label = $('hw-anchor-pos');
    const prev = $('hw-anchor-prev');
    const next = $('hw-anchor-next');
    if (label) label.textContent = 'Oración ' + (activeItemIdx + 1) + ' / ' + total;
    if (prev) prev.disabled = activeItemIdx <= 0;
    if (next) next.disabled = activeItemIdx >= total - 1;
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
  // 🛠️ Helper — builds a single stage chip with its remove handler.
  // Extracted so the append-fast-path (appendChipToStage below) can use
  // the same builder as the full rebuild path (renderStage).
  function _buildStageChip(i, word) {
    const dict = window.lookupWuPinyin ? window.lookupWuPinyin(word) : null;
    const cat = dict && window.WU_CATEGORIES && window.WU_CATEGORIES[dict.cat];
    const color = cat ? cat.color : '#ffe082';
    const chip = document.createElement('span');
    chip.className = 'hw-stage-word';
    chip.style.setProperty('--cat-color', color);
    chip.title = 'Toca para quitar';
    chip.innerHTML = `<span class="hw-stage-pinyin">${escapeHtml(word)}</span>`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      pushUndo(i);
      // Find this chip's index in the current array (not the closure
      // index — that goes stale if other chips were removed). Use the
      // chip's DOM position as the source of truth.
      const stage = document.getElementById('hw-stage-' + i);
      const idx = stage ? Array.prototype.indexOf.call(stage.querySelectorAll('.hw-stage-word'), chip) : -1;
      const arr = (currentAnswers[i] || '').trim().split(/\s+/).filter(Boolean);
      if (idx >= 0 && idx < arr.length) {
        arr.splice(idx, 1);
        currentAnswers[i] = arr.join(' ');
        renderStage(i);          // full rebuild only on REMOVE (rare)
        refreshUndoButtons();
      }
    });
    return chip;
  }
  // ⚡ FAST PATH — append a single chip without rebuilding the entire
  // stage. CRITICAL FIX (2026-06-01): renderStage was clearing
  // innerHTML and rebuilding EVERY existing chip on EVERY tap. Cost
  // grew linearly per chip → quadratic over building a sentence.
  // Adding the 10th word meant rebuilding 10 chips, redoing 10 dict
  // lookups + 10 event handler bindings + 10 element creations. The
  // exact source of "touch then slowly the word appears."
  // Now: append the new chip directly. Rebuild only happens on remove.
  function appendChipToStage(i, word) {
    const stage = document.getElementById('hw-stage-' + i);
    if (!stage) return;
    // Drop the empty-placeholder span if it's there
    const empty = stage.querySelector('.hw-stage-empty');
    if (empty) stage.innerHTML = '';
    stage.appendChild(_buildStageChip(i, word));
  }
  function renderStage(i) {
    const stage = document.getElementById('hw-stage-' + i);
    if (!stage) return;
    const words = (currentAnswers[i] || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      stage.innerHTML = '<span class="hw-stage-empty">Toca palabras del catálogo…</span>';
      return;
    }
    stage.innerHTML = '';
    words.forEach((w) => stage.appendChild(_buildStageChip(i, w)));
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
        // ⚡ INSTANT TAP + properly-anchored Modo Curioso bubble.
        pushUndo(activeItemIdx);
        const cur = currentAnswers[activeItemIdx] || '';
        currentAnswers[activeItemIdx] = (cur ? cur + ' ' : '') + w.pinyin;
        appendChipToStage(activeItemIdx, w.pinyin);
        refreshUndoButtons();
        chip.classList.remove('flash');
        void chip.offsetWidth;
        chip.classList.add('flash');
        _playTapChime();
        // 🐍 Modo Curioso bubble — RIGHT next to the tapped word.
        _showWordMeaningBubble(chip, w);
      });
      wrap.appendChild(chip);
    });
  }
  $('hw-asg-back').addEventListener('click', () => {
    if (confirm('¿Volver sin entregar? Perderás lo que has escrito.')) {
      // 🛟 Kill any in-flight open fetch — without this, a slow first
      // open's response/error could land on top of the kid's next tap
      // and trigger a stale "No se pudo conectar" toast on B.
      _cancelOpenInFlight();
      currentAssignment = null;
      renderList();
      showScreen('list');
    }
  });

  // 🛡️ BULLETPROOF TAP DELEGATION — even if the per-card click handler
  // doesn't bind (rendering race) or gets removed, this document-level
  // delegate catches every tap on a card via its data-assignment-id.
  // User reported "I tap assignment 2/3/4/5/6/7 and it doesn't open" —
  // this guarantees the open always fires.
  document.addEventListener('click', (e) => {
    // ⚡ FAST PATH — only run the closest() traversal when we're actually
    // on a screen that has folder/assignment cards. On the assignment or
    // results screen, the cards are hidden but still in the DOM, and
    // running closest() on every word-chip tap was a small tax that added
    // up on slow phones. Bail immediately if we're not on the list screen.
    const listEl = $('screen-list');
    if (!listEl || listEl.classList.contains('hidden')) return;
    // ── Folder cards (EXP1-EXP8) — open the folder view
    const folder = e.target && e.target.closest && e.target.closest('[data-folder-id]');
    if (folder && !e.target.closest('button[disabled]')) {
      const fid = folder.dataset.folderId;
      if (fid && hwFolder !== fid) {
        e.preventDefault();
        e.stopPropagation();   // 🛡️ stop the card's own onclick from also firing
        hwFolder = fid;
        renderList();
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
    }
    // ── Assignment cards — open the assignment fetch
    const card = e.target && e.target.closest && e.target.closest('[data-assignment-id]');
    if (!card) return;
    // Skip if the tap was on a child action button (review, edit, etc).
    if (e.target.closest('.hw-review-btn, .hw-sentence-del, .hw-sentence-edit, .hw-sentence-speak')) return;
    const id = card.dataset.assignmentId;
    if (!id) return;
    // Don't re-fire if we're literally already on the assignment screen.
    const onAsgScreen = $('screen-assignment') && !$('screen-assignment').classList.contains('hidden');
    if (onAsgScreen && currentAssignment && currentAssignment.id === id) return;
    // 🛡️ stopPropagation here is CRITICAL — without it, the bubble phase
    // continues to the card's per-instance onClick listener which also
    // calls openAssignment(id). Two back-to-back calls would race: the
    // second call cancels the first's fetch via AbortController, leaving
    // an AbortError that we silently swallow → the kid sees the tap
    // register (loading ring) but nothing opens. This was the actual
    // root cause of "second time it just doesn't open, no error".
    e.preventDefault();
    e.stopPropagation();
    openAssignment(id);
  }, true);  // capture phase so we beat any stuck overlay above the card

  // ── Submit + results — both buttons (top + bottom) trigger the same flow
  function submitAssignment() {
    if (!currentAssignment) return;
    const emptyCount = currentAnswers.filter((a) => !a.trim()).length;
    if (emptyCount > 0 && !confirm(`Tienes ${emptyCount} oraciones vacías. ¿Entregar de todas formas?`)) return;
    const btns = [$('hw-asg-submit'), $('hw-asg-submit-top')].filter(Boolean);
    btns.forEach((b) => { b.disabled = true; b.textContent = 'Enviando…'; });
    // Custom assignments go to the dedicated endpoint so the server knows to
    // re-validate the kid is in the target list + use the custom grader.
    const submitUrl = currentAssignment.custom
      ? '/api/homework/custom-assignment/submit'
      : '/api/homework/submit';
    fetch(submitUrl, {
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
        // 🔧 FIX: refresh the tab counts immediately so when the kid hits
        // Volver, Pendientes count is one lower + Completadas one higher.
        // Was: submissions array updated but counts only refreshed on full
        // page reload. Now: live update.
        try { if (typeof updateTabCounts === 'function') updateTabCounts(); } catch (_) {}
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
    // ⚡ FAST COUNT-UP — user wants the count-up animation BACK ("it was
    // better like that"), just not as long. Old: 30 ticks × 30ms + 250ms
    // delay ≈ 1.2s. New: 12 ticks × 25ms ≈ 300ms total. Snappy reveal
    // without the dragged-out "1, 2, 3, 4, 5..." feel.
    const numEl = $('hw-results-num');
    if (numEl) {
      const TICKS = 12;
      const step = Math.max(1, Math.ceil(data.score / TICKS));
      let cur = 0;
      numEl.textContent = '0';
      const tick = () => {
        cur += step;
        if (cur >= data.score) { numEl.textContent = data.score; return; }
        numEl.textContent = cur;
        setTimeout(tick, 25);
      };
      setTimeout(tick, 80);  // tiny lead-in so the kid sees 0 → spring up
    }
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
    ['entry', 'avatar', 'list', 'settings', 'assignment', 'results', 'parents', 'reading', 'daily'].forEach((n) => {
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
  // 💾 In-memory cache of object-URLs for already-fetched TTS clips so the
  // same word/sentence plays INSTANTLY on the 2nd, 3rd, ... tap (was
  // re-hitting /api/tts every time, ~500-1500ms per fetch).
  const _ttsObjectCache = new Map();
  function speakChinese(text, btn) {
    const clean = String(text || '').trim();
    if (!clean) return;
    // ⚡ CRITICAL FIX 2026-06-01: SWAP-THEN-STOP. The previous version
    // called _stopAllSpeech() at the TOP of this function, which aborted
    // the previous in-flight audio fetch BEFORE the new one was ready.
    // Result: rapid taps each killed the previous audio mid-load and
    // none played until the user FINALLY stopped tapping. Exactly the
    // "doesn't play until the 7th tap" the user reported.
    // Now: build the new audio locally, wait for it to be ready, THEN
    // stop the old one and swap. Audio is uninterrupted.

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
    // ⚡ Object-URL cache short-circuits re-fetches of the same text.
    const cachedUrl = _ttsObjectCache.get(clean);
    const url = cachedUrl || ('/api/tts?text=' + encodeURIComponent(clean));
    const audio = new Audio();
    // Stop the previous audio only AFTER our new one starts playing —
    // see canplay handler below. _ttsAudio remains the old one until then.
    const prevAudio = _ttsAudio;
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
      // 🔄 Now that THIS audio is ready, kill the previous one and swap.
      if (prevAudio && prevAudio !== audio) {
        try { prevAudio.pause(); prevAudio.removeAttribute('src'); prevAudio.load(); } catch (_) {}
      }
      _ttsAudio = audio;
      audio.play()
        .then(() => { playedOnce = true; })
        .catch((e) => { if (!playedOnce) fallback('play(): ' + e.message); });
    });
    audio.addEventListener('playing', () => {
      playedOnce = true;
      // Cache the URL (only the first time we successfully play this text)
      // so subsequent identical plays skip the network fetch.
      if (!cachedUrl) _ttsObjectCache.set(clean, url);
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
  // 🐍 Modo Curioso bubble — viewport-fixed positioning so it appears
  // RIGHT next to the tapped word, never offscreen. Auto-flips above the
  // chip if there's no room below. Single tracked bubble (removes any
  // previous one first) so rapid taps don't stack pop-ups. Pointer-events
  // disabled so it never blocks the kid's next tap.
  let _meaningBubbleTimer = null;
  function _showWordMeaningBubble(chip, w) {
    if (!chip || !w) return;
    // Clear any previous bubble + its timer so we never stack
    const prev = document.querySelector('.hw-meaning-bubble');
    if (prev) { try { prev.remove(); } catch (_) {} }
    if (_meaningBubbleTimer) clearTimeout(_meaningBubbleTimer);
    const bubble = document.createElement('div');
    bubble.className = 'hw-meaning-bubble';
    const cat = window.WU_CATEGORIES && window.WU_CATEGORIES[w.cat];
    const color = cat ? cat.color : '#5be8d1';
    bubble.style.setProperty('--cat-color', color);
    bubble.style.position = 'fixed';   // viewport-relative, scroll-proof
    bubble.style.pointerEvents = 'none';
    bubble.innerHTML = `
      <span class="hw-mb-icon">${escapeHtml(w.icon || '✨')}</span>
      <span class="hw-mb-pinyin">${escapeHtml(w.pinyin || '')}</span>
      <span class="hw-mb-arrow">→</span>
      <span class="hw-mb-es">${escapeHtml(w.es || '')}</span>`;
    document.body.appendChild(bubble);
    // Measure AFTER append so we know the bubble's natural size
    const cr = chip.getBoundingClientRect();
    const br = bubble.getBoundingClientRect();
    // Horizontal: center on the chip, clamp to viewport edges
    let left = cr.left + (cr.width / 2) - (br.width / 2);
    left = Math.max(8, Math.min(left, window.innerWidth - br.width - 8));
    // Vertical: prefer ABOVE the chip; flip BELOW if not enough room above
    let top = cr.top - br.height - 10;
    if (top < 8) top = cr.bottom + 10;
    bubble.style.left = left + 'px';
    bubble.style.top  = top + 'px';
    requestAnimationFrame(() => bubble.classList.add('show'));
    _meaningBubbleTimer = setTimeout(() => {
      bubble.classList.add('fade');
      setTimeout(() => { try { bubble.remove(); } catch (_) {} }, 220);
    }, 1300);
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
      // ⚡ If the context is still suspended (no user gesture yet), skip
      // this note silently — _primeAudio will resume it on first tap.
      // Was: scheduling notes into a suspended ctx, then they all played
      // at once when the ctx finally woke up = "7 chimes at once" feel.
      if (ctx.state !== 'running') return;
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
  // 🔊 PRE-WARM the chime AudioContext on the first user interaction.
  // Browsers create AudioContexts in 'suspended' state until a real user
  // gesture. ctx.resume() is async; the previous code fired-and-forgot
  // it, so the FIRST several oscillator schedules were queued into a
  // still-suspended context and silently dropped. Result: "first taps
  // make no sound, then suddenly the 7th tap plays."
  // Fix: on the first pointerdown ANYWHERE on the page, create the
  // context and await resume() BEFORE any chime is ever attempted.
  let _audioReady = false;
  function _primeAudio() {
    if (_audioReady) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { _audioReady = true; return; }
      if (!_tapAudioCtx) _tapAudioCtx = new AC();
      const ctx = _tapAudioCtx;
      const finish = () => {
        _audioReady = true;
        // Play a silent tick so iOS counts the context as "user-activated"
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0;
        osc.connect(g); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.01);
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(finish).catch(() => { _audioReady = true; });
      } else {
        finish();
      }
    } catch (_) { _audioReady = true; }
  }
  document.addEventListener('pointerdown', _primeAudio, { once: true, capture: true });
  document.addEventListener('touchstart',  _primeAudio, { once: true, capture: true });
  document.addEventListener('click',       _primeAudio, { once: true, capture: true });
})();
