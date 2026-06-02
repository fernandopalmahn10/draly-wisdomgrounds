// =========================================================================
// host-hsk.js — Teacher's PIN-room host page for an HSK simulation
// =========================================================================
// Opens with ?sim=<simId>&pw=<maestroCode>. First creates a room (gets a
// 4-digit PIN), then polls /sessions every 5s. Mirrors host-reading
// UX: big PIN banner the teacher reads aloud, live roster split into
// four buckets, Animaciones panel that broadcasts an animation overlay
// across every kid's screen. Toasts pop above the grid when new
// students join, answer questions, or submit.
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

  // Either a PIN was passed in the URL (reused room), or we create one
  // immediately on load.
  let pin = params.get('pin') || '';

  $('hh-sim-title').textContent = simId.replace(/-/g, ' · ').toUpperCase();

  // ── State: track who we've already seen so toasts only fire for new
  // events ─────────────────────────────────────────────────────────────
  const _seenKeys = new Set();    // 'live:CODE' → already toasted as join
  const _lastAnswered = new Map();// CODE → last-known answered count
  const _doneKeys = new Set();    // CODE → already toasted as completed

  // ── Step 1: create or reuse the PIN room ─────────────────────────────
  function ensureRoom() {
    if (pin) {
      $('hh-pin').textContent = pin;
      poll();
      setInterval(poll, 5000);
      return;
    }
    fetch('/api/hsk-sim/room/create?pw=' + encodeURIComponent(pw), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) {
          $('hh-pin').textContent = 'ERROR';
          $('hh-sub').textContent = 'No pude crear la sala: ' + (d && d.error || 'desconocido');
          return;
        }
        pin = d.pin;
        // Persist into the URL so refresh keeps the same room.
        try {
          const u = new URL(location.href);
          u.searchParams.set('pin', pin);
          history.replaceState(null, '', u.toString());
        } catch (_) {}
        $('hh-pin').textContent = pin;
        toast('🚀 Sala creada · PIN ' + pin, 'good');
        poll();
        setInterval(poll, 5000);
      })
      .catch((e) => {
        $('hh-pin').textContent = 'ERROR';
        $('hh-sub').textContent = 'Red: ' + e.message;
      });
  }

  // ── Avatar / progress helpers (same as before) ───────────────────────
  function avatarHtml(a) {
    if (!a) return '<span class="hh-row-av is-emoji">🧒</span>';
    if (/^[a-z0-9_-]+$/i.test(a)) {
      const charSet = new Set(['gojo','yugi','yuji','shelly','fnaf','dandy','hanzo','mei2','dralingo','naruto','sasuke','luffy','goku','pikachu','sonic','mario','kirby','spiderman','ironman','elsa','moana','squirtle']);
      const url = charSet.has(a)
        ? '/assets/cutscenes/chars/' + a + '-a.png'
        : '/assets/avatars/' + encodeURIComponent(a) + '.svg';
      return '<span class="hh-row-av"><img src="' + url + '" alt=""></span>';
    }
    return '<span class="hh-row-av is-emoji">' + escapeHtml(a) + '</span>';
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

  // ── Toast feed: "Lin se unió", "María entregó (87%)" etc ────────────
  function toast(text, kind) {
    const t = document.createElement('div');
    t.className = 'hh-toast hh-toast-' + (kind || 'info');
    t.textContent = text;
    const feed = $('hh-feed');
    feed.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { try { t.remove(); } catch (_) {} }, 350);
    }, 6000);
  }

  // ── Diff incoming roster against last poll to fire toasts ─────────
  function fireToastsFor(live, done) {
    live.forEach((r) => {
      const k = r.studentCode;
      if (!_seenKeys.has('live:' + k)) {
        _seenKeys.add('live:' + k);
        toast('🟢 ' + (r.displayName || k) + ' entró a la sala', 'good');
      }
      // Answered-bump toast (every 5 questions, so it's not spammy)
      const prev = _lastAnswered.get(k) || 0;
      const cur  = r.answered || 0;
      if (cur > prev && cur % 5 === 0 && cur > 0) {
        toast('✏️ ' + (r.displayName || k) + ' lleva ' + cur + '/' + r.total, 'info');
      }
      _lastAnswered.set(k, cur);
    });
    done.forEach((r) => {
      const k = r.studentCode;
      if (!_doneKeys.has(k)) {
        _doneKeys.add(k);
        toast('🏅 ' + (r.displayName || k) + ' terminó el examen', 'gold');
      }
    });
  }

  // ── Render the four-bucket grid ─────────────────────────────────────
  function render(data) {
    const live  = (data && data.live)      || [];
    const stale = (data && data.stale)     || [];
    const done  = (data && data.completed) || [];
    const left  = (data && data.left)      || [];
    $('hh-count-live').textContent  = live.length;
    $('hh-count-stale').textContent = stale.length;
    $('hh-count-done').textContent  = done.length;
    $('hh-count-left').textContent  = left.length;
    $('hh-list-live').innerHTML  = live.length  ? live.map((r)  => rowHtml(r, 'live')).join('')   : '<p class="hh-empty">Nadie ha entrado todavía. Dales el PIN.</p>';
    $('hh-list-stale').innerHTML = stale.length ? stale.map((r) => rowHtml(r, 'stale')).join('')  : '<p class="hh-empty">Nadie está sin señal.</p>';
    $('hh-list-done').innerHTML  = done.length  ? done.map((r)  => rowHtml(r, 'done')).join('')   : '<p class="hh-empty">Aún nadie ha terminado.</p>';
    $('hh-list-left').innerHTML  = left.length  ? left.map((r)  => rowHtml(r, 'left')).join('')   : '<p class="hh-empty">Nadie ha cerrado el examen.</p>';

    const total = live.length + stale.length + done.length + left.length;
    $('hh-tally').innerHTML = '<strong>' + total + '</strong> alumno' + (total === 1 ? '' : 's') +
      ' · 🟢 ' + live.length + ' activo' + (live.length === 1 ? '' : 's') +
      ' · 🏅 ' + done.length + ' terminó' + (done.length === 1 ? '' : 'aron');

    fireToastsFor(live, done);
  }

  function poll() {
    if (!pin) return;
    let url = '/api/hsk-sim/sessions?pw=' + encodeURIComponent(pw)
      + '&pin=' + encodeURIComponent(pin);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) {
          $('hh-sub').textContent = 'Error: ' + (d && d.error || 'desconocido') + '. Revisa tu código (?pw=).';
          return;
        }
        render(d);
      })
      .catch((e) => { $('hh-sub').textContent = 'Red: ' + e.message; });
  }

  // ── Copy direct join link ───────────────────────────────────────────
  $('hh-copy-link').addEventListener('click', () => {
    if (!pin) return;
    const url = location.origin + '/hsk-sim.html?pin=' + pin;
    try {
      navigator.clipboard.writeText(url);
      toast('📋 Liga copiada', 'good');
    } catch (_) {
      prompt('Liga directa para tus alumnos:', url);
    }
  });

  // ── Force-impose to currently-online kids ───────────────────────────
  $('hh-force-online').addEventListener('click', () => {
    if (!pin) { alert('Esperando PIN…'); return; }
    fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
      .then((r) => r.json())
      .then((data) => {
        if (!data || !data.ok) { alert('No se pudo cargar la lista.'); return; }
        const onlineNow = (data.students || []).filter((s) => s.lastSeen && (Date.now() - s.lastSeen) <= 60 * 1000);
        if (!onlineNow.length) { alert('No hay alumnos en línea ahora mismo.'); return; }
        const checks = onlineNow.map((s) => '✓ ' + (s.displayName || s.code)).join('\n');
        if (!confirm('Forzar entrada a ' + onlineNow.length + ' alumnos en línea?\n\n' + checks)) return;
        const codes = onlineNow.map((s) => s.code);
        fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(pw), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentCodes: codes,
            text: '🏆 ¡Tu maestra abrió la simulación HSK! Entra ya.',
            actionType: 'force',
            actionUrl:   '/hsk-sim.html?pin=' + encodeURIComponent(pin),
            actionLabel: 'Entrar al examen →',
          }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res && res.ok) toast('🚀 Aviso enviado a ' + codes.length + ' alumnos', 'good');
            else alert('Error: ' + (res && res.error || 'desconocido'));
          })
          .catch((e) => alert('Error: ' + e.message));
      })
      .catch((e) => alert('Error: ' + e.message));
  });

  // ── 🎬 ANIMATIONS — same bank as host-reading. Fires fx to room ────
  const ANIMATIONS = [
    {
      id: 'gojo',
      name: 'Gojo (Jujutsu)',
      tags: 'gojo satoru jjk anime sensei limitless infinity blue purple six eyes',
      url: '/assets/png-library/GOJO%20TRANSPARENT.gif',
    },
    {
      id: 'turtle',
      name: 'Squirtle dancing',
      tags: 'squirtle turtle pinpin water dance dancing tortuga',
      url: '/assets/png-library/Squirtle%20animation.gif',
    },
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
          if (_animCurrent === a.id) {
            broadcastFx(a.id, false);
            _animCurrent = null;
          } else {
            broadcastFx(a.id, true);
            _animCurrent = a.id;
          }
          modal.classList.add('hidden');
        });
        grid.appendChild(card);
      });
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
      _animBuilt = true;
    }
    modal.classList.remove('hidden');
  }
  function broadcastFx(fxId, on) {
    if (!pin) return;
    fetch('/api/hsk-sim/room/' + encodeURIComponent(pin) + '/fx?pw=' + encodeURIComponent(pw), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fx: fxId, on: !!on }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) toast(on ? '🎬 Animación activada: ' + fxId : '🎬 Animación apagada', 'info');
      })
      .catch(() => {});
  }
  $('hh-anim-btn').addEventListener('click', openAnimModal);
  document.querySelector('.rd-anim-close').addEventListener('click', () => $('rd-anim-modal').classList.add('hidden'));
  $('rd-anim-modal').addEventListener('click', (e) => { if (e.target === $('rd-anim-modal')) $('rd-anim-modal').classList.add('hidden'); });

  // GO
  ensureRoom();
})();
