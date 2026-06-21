// =========================================================================
// host-hsk.js — Real socket-driven HSK simulation host page
// =========================================================================
// Mirrors host-reading.js exactly:
//   1. opens a socket.io connection
//   2. emits 'host:create' { gameType: 'hsksim', simId } → server returns PIN
//   3. PIN goes into the same games[pin] table as every other live game
//   4. listens for 'state' broadcasts → renders live lobby roster
//   5. "🚀 EMPEZAR EXAMEN" button emits 'host:start' → state flips to active
//   6. Kids' /hsk-sim.html, sitting in their own lobby on the SAME socket
//      room, instantly flip into the test runner.
//
// Late joiners after start: they enter the running room normally and the
// test starts on their device from question 1. Each kid takes the exam
// on their own pace; the room state stays 'active' the whole time.
// =========================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const params = new URLSearchParams(location.search);
  const simId = params.get('sim') || 'hsk1-sim1';
  let pw = params.get('pw') || '';
  try { if (!pw) pw = localStorage.getItem('mochi.maestroPw') || ''; } catch (_) {}
  try { if (pw) localStorage.setItem('mochi.maestroPw', pw); } catch (_) {}

  if (!pw) {
    document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#ffd24a;font-family:Nunito;"><h2>🔒 Falta tu código de maestra.</h2><p>Entra desde <a href="/maestro" style="color:#5be8d1;">Modo Maestro</a> y vuelve a lanzar la simulación.</p></div>';
    return;
  }

  const socket = io();
  let pin = '';
  let lastState = null;
  let lastSimTitle = simId.replace(/-/g, ' · ').toUpperCase();

  // Toast helpers
  function toast(text, kind) {
    const t = document.createElement('div');
    t.className = 'hh-toast hh-toast-' + (kind || 'info');
    t.textContent = text;
    const feed = $('hh-feed');
    if (!feed) return;
    feed.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { try { t.remove(); } catch (_) {} }, 350);
    }, 6000);
  }

  // ── Step 1: create the socket room ──────────────────────────────────
  socket.emit('host:create', { gameType: 'hsksim', simId }, (resp) => {
    if (!resp || !resp.pin) {
      alert('No pude crear la sala: ' + ((resp && resp.error) || 'error desconocido'));
      return;
    }
    pin = resp.pin;
    $('hh-pin').textContent = pin;
    $('hh-pin-small').textContent = pin;
    document.title = '🏆 HSK · ' + pin;
    toast('🚀 Sala creada · PIN ' + pin, 'good');
  });

  // ── Step 2: listen for 'state' updates from the server ─────────────
  // This is the same event every other game uses. When kids player:join
  // the room, broadcast() fires and we render the updated roster.
  const _seenJoins = new Set();   // toast each kid once
  socket.on('state', (s) => {
    if (!s) return;
    lastState = s;
    // Track new joins for toast feedback
    const playerNames = new Set();
    const playerList = Object.values(s.players || {});
    playerList.forEach((p) => {
      playerNames.add(p.name);
      if (!_seenJoins.has(p.name)) {
        _seenJoins.add(p.name);
        toast('🟢 ' + p.name + ' entró a la sala', 'good');
      }
    });
    // Prune left players from the seen set (so rejoin re-toasts)
    Array.from(_seenJoins).forEach((n) => { if (!playerNames.has(n)) _seenJoins.delete(n); });

    // Update sim title
    if (s.hsk && s.hsk.simId) lastSimTitle = s.setTitle || s.hsk.simId.toUpperCase();
    if ($('hh-sim-title')) $('hh-sim-title').textContent = lastSimTitle;

    // Render based on current room state
    if (s.state === 'active' || s.state === 'ended') showActive();
    else showLobby();

    renderLobby(playerList);
    renderActive();
  });

  function showLobby() {
    $('hh-lobby').classList.remove('hidden');
    $('hh-active').classList.add('hidden');
  }
  function showActive() {
    $('hh-lobby').classList.add('hidden');
    $('hh-active').classList.remove('hidden');
  }

  // ── Lobby roster (pre-start) ───────────────────────────────────────
  function renderLobby(players) {
    const n = players.length;
    $('hh-lobby-count-num').textContent = n;
    $('hh-lobby-count-s').textContent = n === 1 ? '' : 's';
    const wrap = $('hh-lobby-roster');
    if (!wrap) return;
    if (!n) {
      wrap.innerHTML = '<p class="hh-empty">Esperando alumnos… diles el PIN.</p>';
      return;
    }
    wrap.innerHTML = players.map((p) => {
      return '<div class="hh-lobby-row">' +
               avatarHtml(p.avatar) +
               '<span class="hh-lobby-name">' + escapeHtml(p.name) + '</span>' +
             '</div>';
    }).join('');
  }

  function avatarHtml(a) {
    if (!a) return '<span class="hh-row-av is-emoji">🧒</span>';
    if (/^[a-z0-9_-]+$/i.test(a)) {
      const charSet = new Set(['gojo','yugi','yuji','shelly','fnaf','dandy','hanzo','mei2','dralingo','naruto','sasuke','luffy','goku','pikachu','sonic','mario','kirby','spiderman','ironman','elsa','moana','squirtle']);
      const url = charSet.has(a) ? '/assets/cutscenes/chars/' + a + '-a.png'
                                 : '/assets/avatars/' + encodeURIComponent(a) + '.svg';
      return '<span class="hh-row-av"><img src="' + url + '" alt=""></span>';
    }
    return '<span class="hh-row-av is-emoji">' + escapeHtml(a) + '</span>';
  }

  // ── Active monitor (post-start) ─ pulls from HTTP /sessions ────────
  // Heartbeat polling powers the four-bucket progress monitor (live,
  // stale, completed, left). This is independent of the socket roster —
  // the kid client posts heartbeats with progress data every 8s.
  function renderActive() {
    if (!lastState || lastState.state === 'lobby') return;
    // (rendering happens in poll() below)
  }

  function progressBar(answered, total) {
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    return '<div class="hh-row-prog"><div class="hh-row-prog-fill" style="width:' + pct + '%"></div>' +
           '<span class="hh-row-prog-label">' + answered + '/' + (total || '?') + '</span></div>';
  }
  function rowHtml(r, kind) {
    const ageS = Math.round((r.age || 0) / 1000);
    let meta = '';
    if (kind === 'live')      meta = '<span class="hh-row-section">' + escapeHtml(r.section || '') + '</span>';
    else if (kind === 'stale') meta = '<span class="hh-row-stale">Sin señal hace ' + ageS + 's</span>';
    else if (kind === 'done')  meta = '<span class="hh-row-section">✓ Entregado</span>';
    else if (kind === 'left')  meta = '<span class="hh-row-stale">Cerró la pestaña</span>';
    return '<div class="hh-row hh-row-' + kind + '">' +
             avatarHtml(r.avatar) +
             '<div class="hh-row-meta">' +
               '<div class="hh-row-name">' + escapeHtml(r.displayName || r.studentCode) + '</div>' +
               meta +
             '</div>' +
             progressBar(r.answered || 0, r.total || 0) +
           '</div>';
  }
  const _doneToasted = new Set();
  function pollSessions() {
    if (!pin) return;
    fetch('/api/hsk-sim/sessions?pw=' + encodeURIComponent(pw) + '&pin=' + encodeURIComponent(pin))
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) return;
        const heartbeatLive  = d.live || [];
        const heartbeatStale = d.stale || [];
        const done = d.completed || [];
        const left = d.left || [];

        // 🎯 SOURCE OF TRUTH: socket roster (lastState.players). Every
        // kid currently in the room has an entry. Heartbeat sessions
        // are a SECONDARY source used only to enrich each row with
        // progress data (answered/total/section).
        //
        // This guarantees "En el examen" === actual joined count, even
        // before the first heartbeat lands and even if heartbeat fails
        // for any reason. Root cause of the "0,0,0,0" bug the user
        // reported was reading heartbeat as primary.
        //
        // Build a lookup: displayName-lowercase → heartbeat session.
        const hbByName = {};
        const hbByCode = {};
        [].concat(heartbeatLive, heartbeatStale).forEach((r) => {
          if (r.displayName) hbByName[r.displayName.toLowerCase()] = r;
          if (r.studentCode) hbByCode[r.studentCode] = r;
        });
        const live = [];
        const stale = [];
        // Build a quick lookup of who's already in the completed/left
        // buckets — we DON'T want to re-add them to "live" via the
        // socket-roster merge (root cause of "I finished but it still
        // showed me in the test"). Heartbeat status wins.
        const finishedNames = new Set();
        const finishedCodes = new Set();
        done.forEach((r) => {
          if (r.displayName) finishedNames.add(r.displayName.toLowerCase());
          if (r.studentCode) finishedCodes.add(r.studentCode);
        });
        left.forEach((r) => {
          if (r.displayName) finishedNames.add(r.displayName.toLowerCase());
          if (r.studentCode) finishedCodes.add(r.studentCode);
        });

        const socketPlayers = lastState && lastState.players
          ? Object.values(lastState.players) : [];
        socketPlayers.forEach((p) => {
          // Skip if already in completed/left — they're in the right bucket.
          if (finishedNames.has((p.name || '').toLowerCase())) return;
          if (finishedCodes.has(p.name)) return;
          // Try to find a matching heartbeat by socket name or studentCode
          const hb = hbByName[(p.name || '').toLowerCase()] || hbByCode[p.name];
          const row = hb
            ? Object.assign({}, hb, { avatar: hb.avatar || p.avatar || null })
            : {
                displayName: p.name,
                studentCode: p.name,
                avatar: p.avatar || null,
                answered: 0,
                total: 30,
                section: 'Cargando examen…',
                age: 0,
              };
          if (hb && (Date.now() - hb.lastBeat || 0) > 30000) {
            stale.push(row);
          } else {
            live.push(row);
          }
        });
        // Also include heartbeat rows that aren't in the socket roster
        // (e.g. kid temporarily disconnected but still heartbeating).
        [].concat(heartbeatLive).forEach((r) => {
          const alreadyShown = socketPlayers.some((p) => {
            const pn = (p.name || '').toLowerCase();
            return pn === (r.displayName || '').toLowerCase() || p.name === r.studentCode;
          });
          if (!alreadyShown) live.push(r);
        });

        $('hh-count-live').textContent  = live.length;
        $('hh-count-stale').textContent = stale.length;
        $('hh-count-done').textContent  = done.length;
        $('hh-count-left').textContent  = left.length;
        $('hh-list-live').innerHTML  = live.length  ? live.map((r)  => rowHtml(r, 'live')).join('')   : '<p class="hh-empty">Nadie está activo aún.</p>';
        $('hh-list-stale').innerHTML = stale.length ? stale.map((r) => rowHtml(r, 'stale')).join('')  : '<p class="hh-empty">Nadie está sin señal.</p>';
        $('hh-list-done').innerHTML  = done.length  ? done.map((r)  => rowHtml(r, 'done')).join('')   : '<p class="hh-empty">Aún nadie ha terminado.</p>';
        $('hh-list-left').innerHTML  = left.length  ? left.map((r)  => rowHtml(r, 'left')).join('')   : '<p class="hh-empty">Nadie ha cerrado el examen.</p>';
        const total = live.length + stale.length + done.length + left.length;
        $('hh-tally').innerHTML = '<strong>' + total + '</strong> alumno' + (total === 1 ? '' : 's') +
          ' · 🟢 ' + live.length + ' activo' + (live.length === 1 ? '' : 's') +
          ' · 🏅 ' + done.length + ' terminó' + (done.length === 1 ? '' : 'aron');
        done.forEach((r) => {
          if (!_doneToasted.has(r.studentCode)) {
            _doneToasted.add(r.studentCode);
            toast('🏅 ' + (r.displayName || r.studentCode) + ' terminó (' + (r.answered || 0) + '/' + (r.total || '?') + ')', 'gold');
          }
        });
      })
      .catch(() => {});
  }
  setInterval(pollSessions, 3000);
  // Also poll immediately when state transitions to active so the
  // monitor doesn't briefly show 0 before the first scheduled poll.
  let _wasActive = false;
  socket.on('state', (s) => {
    if (s && (s.state === 'active' || s.state === 'countdown') && !_wasActive) {
      _wasActive = true;
      setTimeout(pollSessions, 100);
    }
  });

  // ── 🚀 START button — fire the existing host:start event ───────────
  $('hh-start-btn').addEventListener('click', () => {
    if (!pin) { alert('Esperando PIN…'); return; }
    socket.emit('host:start', { pin });
  });
  socket.on('host:start-error', (msg) => {
    if (msg && msg.reason === 'no-set') {
      // hsksim shouldn't hit this — but just in case
      alert((msg && msg.message) || 'No se pudo empezar.');
    } else if (msg && msg.reason === 'no-players') {
      if (confirm('No hay alumnos en la sala todavía. ¿Empezar de todas formas? (Los late-joiners entrarán al test directamente.)')) {
        // For HSK we want to allow no-player start since kids enter
        // mid-exam. We use a tiny hack: just re-emit — server already
        // permits hsksim via soloOkGameTypes.
        socket.emit('host:start', { pin });
      }
    }
  });

  // ── 🛑 END button — close the room ─────────────────────────────────
  $('hh-end-btn').addEventListener('click', () => {
    if (!confirm('¿Cerrar la sala? Los alumnos que aún no terminen perderán su progreso.')) return;
    socket.emit('host:end', { pin });
    setTimeout(() => { window.close(); }, 600);
  });

  // ── 🎯 FORCE-IMPOSE picker (lobby + active) ───────────────────────
  // Now SIM-AWARE: fetches who has/hasn't already taken THIS sim and
  // shows a badge per kid, plus two filter buttons to split the class
  // by completion status. Answer to user: "Tab A for those who didn't
  // do Sim 1, Tab B for those who did" — now one click per side.
  function openForcePicker() {
    if (!pin) { alert('Esperando PIN…'); return; }
    Promise.all([
      fetch('/api/admin/students?pw=' + encodeURIComponent(pw)).then((r) => r.json()),
      fetch('/api/hsk-sim/results?pw=' + encodeURIComponent(pw) + '&simId=' + encodeURIComponent(simId)).then((r) => r.json()),
    ]).then(([studentData, resultData]) => {
        if (!studentData || !studentData.ok) { alert('No se pudo cargar la lista.'); return; }
        const onlineNow = (studentData.students || []).filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000);
        if (!onlineNow.length) { alert('No hay alumnos en línea ahora mismo.'); return; }
        // Build a set of codes who have completed THIS sim at least once.
        const completedCodes = new Set();
        ((resultData && resultData.results) || []).forEach((r) => {
          if (r.simId === simId && r.code) completedCodes.add(r.code);
        });
        let overlay = document.getElementById('hh-force-modal');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'hh-force-modal';
        overlay.className = 'm-modal';
        const simShort = (simId || '').toUpperCase();
        overlay.innerHTML =
          '<div class="m-modal-card">' +
            '<button class="m-modal-close" type="button" aria-label="Cerrar">✕</button>' +
            '<h2>🎯 Forzar entrada</h2>' +
            '<p class="m-modal-sub">PIN <strong>' + pin + '</strong> · ' + escapeHtml(simShort) + '</p>' +
            '<p class="m-modal-sub" style="font-size:0.82rem;color:rgba(243,230,194,0.7);">' +
              '<span style="color:#5be88a;">✅ Ya hizo este examen</span> · ' +
              '<span style="color:#ffd24a;">🆕 No lo hace todavía</span>' +
            '</p>' +
            '<div class="m-force-actions" style="flex-wrap:wrap;gap:6px;">' +
              '<button class="btn btn-ghost btn-sm" id="hh-fhsk-all">✅ Todos</button>' +
              '<button class="btn btn-ghost btn-sm" id="hh-fhsk-none">⬜ Ninguno</button>' +
              '<button class="btn btn-jade btn-sm" id="hh-fhsk-only-new" title="Solo a los que NO han hecho este examen">🆕 Solo nuevos</button>' +
              '<button class="btn btn-gold btn-sm" id="hh-fhsk-only-repeat" title="Solo a los que YA hicieron este examen">🔁 Solo repetidores</button>' +
            '</div>' +
            '<div class="m-force-students" id="hh-fhsk-students"></div>' +
            '<button class="btn btn-gold btn-xl" id="hh-fhsk-launch" style="margin-top:16px;width:100%;">🚀 Forzar a los seleccionados</button>' +
          '</div>';
        document.body.appendChild(overlay);
        const list = overlay.querySelector('#hh-fhsk-students');
        // Sort: kids who haven't done it on top (the typical default
        // when launching a new sim) — easier to scan.
        onlineNow.sort((a, b) => {
          const ad = completedCodes.has(a.code) ? 1 : 0;
          const bd = completedCodes.has(b.code) ? 1 : 0;
          return ad - bd;
        });
        onlineNow.forEach((s) => {
          const did = completedCodes.has(s.code);
          const row = document.createElement('label');
          row.className = 'm-force-row' + (did ? ' is-already-done' : ' is-new');
          row.dataset.status = did ? 'done' : 'new';
          // Default-CHECKED only for "🆕 nuevos" — most common case
          // when launching a new sim. Teacher can flip with buttons.
          const checked = did ? '' : 'checked';
          const badge = did
            ? '<span class="m-force-badge m-force-badge-done">✅ Ya lo hizo</span>'
            : '<span class="m-force-badge m-force-badge-new">🆕 Nuevo</span>';
          row.innerHTML =
            '<input type="checkbox" data-code="' + escapeHtml(s.code) + '" ' + checked + '>' +
            '<span class="m-force-row-dot"></span>' +
            '<span class="m-force-row-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
            '<span class="m-force-row-code">' + escapeHtml(s.code) + '</span>' +
            badge;
          list.appendChild(row);
        });
        const close = () => { try { overlay.remove(); } catch (_) {} };
        overlay.querySelector('.m-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('#hh-fhsk-all').addEventListener('click', () => {
          list.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = true; });
        });
        overlay.querySelector('#hh-fhsk-none').addEventListener('click', () => {
          list.querySelectorAll('input[type=checkbox]').forEach((cb) => { cb.checked = false; });
        });
        // 🆕 Smart split — one click ticks only kids who haven't done
        // this sim yet (typical when launching a new simulation to a
        // mixed-progress classroom).
        overlay.querySelector('#hh-fhsk-only-new').addEventListener('click', () => {
          list.querySelectorAll('.m-force-row').forEach((row) => {
            const cb = row.querySelector('input[type=checkbox]');
            if (cb) cb.checked = (row.dataset.status === 'new');
          });
        });
        // 🔁 Inverse — only kids who already did it (e.g. for a retry
        // session or pushing the NEXT sim to those who finished).
        overlay.querySelector('#hh-fhsk-only-repeat').addEventListener('click', () => {
          list.querySelectorAll('.m-force-row').forEach((row) => {
            const cb = row.querySelector('input[type=checkbox]');
            if (cb) cb.checked = (row.dataset.status === 'done');
          });
        });
        overlay.querySelector('#hh-fhsk-launch').addEventListener('click', () => {
          const codes = Array.from(list.querySelectorAll('input[type=checkbox]:checked'))
            .map((cb) => cb.dataset.code).filter(Boolean);
          if (!codes.length) { alert('Selecciona al menos un alumno.'); return; }
          fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(pw), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentCodes: codes,
              text: '🏆 ¡Tu maestra abrió la simulación HSK! Entra ya.',
              actionType: 'force',
              actionUrl: '/hsk-sim.html?pin=' + encodeURIComponent(pin),
              actionLabel: 'Entrar al examen →',
            }),
          })
            .then((r) => r.json())
            .then((res) => {
              if (res && res.ok) { toast('🚀 ' + codes.length + ' alumno(s) entrando…', 'good'); close(); }
              else alert('Error: ' + (res && res.error || 'desconocido'));
            })
            .catch((e) => alert('Error: ' + e.message));
        });
      })
      .catch((e) => alert('Error: ' + e.message));
  }
  $('hh-force-online').addEventListener('click', openForcePicker);
  $('hh-force-online-2').addEventListener('click', openForcePicker);

  // 🏠 2026-06-21 (Fernando) — "Llevar a casa" FROM the live sim screen, with
  // real feedback. Pick online kids → force them out of ANY stuck screen back
  // to their homework profile (delivered via the 8s heartbeat), then watch a
  // live board fill in ✅ as each one arrives. Use it before/while forcing the
  // sim so nobody is trapped on an old "estás en la sala" screen.
  function openHomePicker() {
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        const online = ((data && data.students) || []).filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000);
        if (!online.length) { alert('No hay alumnos en línea ahora mismo.'); return; }
        let ov = document.getElementById('hh-home-modal'); if (ov) ov.remove();
        ov = document.createElement('div'); ov.id = 'hh-home-modal'; ov.className = 'm-modal';
        ov.innerHTML =
          '<div class="m-modal-card">' +
            '<button class="m-modal-close" type="button" aria-label="Cerrar">✕</button>' +
            '<h2>🏠 Llevar a casa</h2>' +
            '<p class="m-modal-sub">Saca a los seleccionados de cualquier pantalla atascada y mándalos a su perfil. Llegan en ~8s; verás abajo quién llegó.</p>' +
            '<div class="m-force-actions"><button class="btn btn-ghost btn-sm" id="hh-home-all">✅ Todos</button><button class="btn btn-ghost btn-sm" id="hh-home-none">⬜ Ninguno</button></div>' +
            '<div class="m-force-students" id="hh-home-students"></div>' +
            '<button class="btn btn-gold btn-xl" id="hh-home-go" style="margin-top:14px;width:100%;">🏠 Mandar a casa</button>' +
          '</div>';
        document.body.appendChild(ov);
        const listEl = ov.querySelector('#hh-home-students');
        online.forEach((s) => {
          const row = document.createElement('label'); row.className = 'm-force-row';
          row.innerHTML = '<input type="checkbox" data-code="' + escapeHtml(s.code) + '" checked>' +
            '<span class="m-force-row-dot"></span>' +
            '<span class="m-force-row-name">' + escapeHtml(s.displayName || 'Anon') + '</span>' +
            '<span class="m-force-row-code">' + escapeHtml(s.code) + '</span>';
          listEl.appendChild(row);
        });
        const close = () => { try { ov.remove(); } catch (_) {} };
        ov.querySelector('.m-modal-close').addEventListener('click', close);
        ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
        ov.querySelector('#hh-home-all').addEventListener('click', () => listEl.querySelectorAll('input').forEach((c) => { c.checked = true; }));
        ov.querySelector('#hh-home-none').addEventListener('click', () => listEl.querySelectorAll('input').forEach((c) => { c.checked = false; }));
        ov.querySelector('#hh-home-go').addEventListener('click', () => {
          const codes = Array.from(listEl.querySelectorAll('input:checked')).map((c) => c.dataset.code).filter(Boolean);
          if (!codes.length) { alert('Selecciona al menos un alumno.'); return; }
          fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(pw), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentCodes: codes, text: '📚 Tu maestra te envió a tu perfil de tareas.', actionType: 'gohome', actionUrl: '/homework', actionLabel: 'Ir a mis tareas →' }),
          }).then((r) => r.json()).then((res) => {
            if (!res || !res.ok) { alert('Error: ' + (res && res.error || 'desconocido')); return; }
            _homeFeedback(ov, codes);
          }).catch((e) => alert('Error: ' + e.message));
        });
      })
      .catch((e) => alert('Error: ' + e.message));
  }
  // Live status board: poll who has actually arrived home, until all do (or 45s).
  function _homeFeedback(ov, codes) {
    let t = null;
    const card = ov.querySelector('.m-modal-card');
    card.innerHTML =
      '<button class="m-modal-close" type="button" aria-label="Cerrar">✕</button>' +
      '<h2>🏠 Yendo a casa…</h2>' +
      '<p class="m-modal-sub" id="hh-home-count">0 / ' + codes.length + ' en casa</p>' +
      '<div class="m-force-students" id="hh-home-status"></div>' +
      '<button class="btn btn-ghost btn-sm" id="hh-home-done" style="margin-top:12px;width:100%;">Cerrar</button>';
    const stop = () => { if (t) clearInterval(t); try { ov.remove(); } catch (_) {} };
    card.querySelector('.m-modal-close').addEventListener('click', stop);
    card.querySelector('#hh-home-done').addEventListener('click', stop);
    const board = card.querySelector('#hh-home-status');
    const started = Date.now();
    const poll = () => {
      fetch('/api/admin/gohome-status?pw=' + encodeURIComponent(pw) + '&codes=' + encodeURIComponent(codes.join(',')))
        .then((r) => r.json())
        .then((d) => {
          const sts = (d && d.statuses) || [];
          let arrived = 0;
          board.innerHTML = '';
          sts.forEach((s) => {
            if (s.arrived) arrived++;
            const row = document.createElement('div'); row.className = 'm-force-row';
            row.innerHTML = '<span style="width:1.5em;">' + (s.arrived ? '✅' : '⏳') + '</span>' +
              '<span class="m-force-row-name">' + escapeHtml(s.name || s.code) + '</span>' +
              '<span class="m-force-row-code">' + (s.arrived ? 'en casa' : (s.online ? 'yendo…' : 'sin señal')) + '</span>';
            board.appendChild(row);
          });
          const countEl = card.querySelector('#hh-home-count');
          if (countEl) countEl.textContent = arrived + ' / ' + codes.length + ' en casa';
          if (arrived >= codes.length || (Date.now() - started) > 45000) { if (t) clearInterval(t); }
        })
        .catch(() => {});
    };
    poll();
    t = setInterval(poll, 1500);
  }
  if ($('hh-home-btn')) $('hh-home-btn').addEventListener('click', openHomePicker);
  if ($('hh-home-btn-2')) $('hh-home-btn-2').addEventListener('click', openHomePicker);

  // ── 🎬 ANIMATIONS panel ────────────────────────────────────────────
  const ANIMATIONS = [
    { id: 'gojo',   name: 'Gojo (Jujutsu)',     tags: 'gojo satoru jjk anime sensei limitless infinity blue purple six eyes', url: '/assets/png-library/GOJO%20TRANSPARENT.gif' },
    { id: 'yugi',   name: 'Yugi (Yu-Gi-Oh!)',   tags: 'yugi pharaoh yugioh egypt millennium puzzle duel card master king games', url: '/assets/png-library/YUGI%20TRANSPARENT.gif' },
    { id: 'freddy', name: 'Freddy (FNAF)',      tags: 'freddy fnaf bear pizzeria hat haunted security animatronic robot', url: '/assets/png-library/FREDDY%20TRANSPARENT.gif' },
    { id: 'mario',  name: 'Mario (Nintendo)',   tags: 'mario nintendo jump red plumber mustache mushroom italian princess', url: '/assets/png-library/MARIO%20TRANSPARENT.gif' },
    { id: 'sonic',  name: 'Sonic (Sega)',       tags: 'sonic hedgehog blue fast sega run shoes rings spin chaos', url: '/assets/png-library/SONIC%20TRANSPARENT.gif' },
    { id: 'elsa',   name: 'Elsa (Frozen)',      tags: 'elsa frozen disney ice queen snow princess arendelle', url: '/assets/png-library/ELSA%20TRANSPARENT.gif' },
    { id: 'turtle', name: 'Squirtle dancing',   tags: 'squirtle turtle pinpin water dance dancing tortuga', url: '/assets/png-library/Squirtle%20animation.gif' },
  ];
  let _animCurrent = null;
  let _animBuilt = false;
  function openAnimModal() {
    const modal = $('rd-anim-modal');
    if (!modal) return;
    if (!_animBuilt) {
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
          if (_animCurrent === a.id) { broadcastFx(a.id, false); _animCurrent = null; }
          else                       { broadcastFx(a.id, true);  _animCurrent = a.id; }
          modal.classList.add('hidden');
        });
        grid.appendChild(card);
      });
      const search = $('rd-anim-search');
      if (search) search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        grid.querySelectorAll('.rd-anim-tile').forEach((tile) => {
          const matches = !q || (tile.dataset.searchHaystack || '').includes(q);
          tile.style.display = matches ? '' : 'none';
        });
      });
      _animBuilt = true;
    }
    modal.classList.remove('hidden');
  }
  function broadcastFx(fxId, on) {
    if (!pin) return;
    fetch('/api/hsk-sim/room/' + encodeURIComponent(pin) + '/fx?pw=' + encodeURIComponent(pw), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fx: fxId, on: !!on }),
    }).then((r) => r.json()).then((d) => {
      if (d && d.ok) toast(on ? '🎬 Animación activada: ' + fxId : '🎬 Animación apagada', 'info');
    }).catch(() => {});
  }
  $('hh-anim-btn').addEventListener('click', openAnimModal);
  $('hh-anim-btn-2').addEventListener('click', openAnimModal);
  document.querySelector('.rd-anim-close').addEventListener('click', () => $('rd-anim-modal').classList.add('hidden'));
  $('rd-anim-modal').addEventListener('click', (e) => { if (e.target === $('rd-anim-modal')) $('rd-anim-modal').classList.add('hidden'); });
})();
