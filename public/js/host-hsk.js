// =========================================================================
// host-hsk.js — Teacher's live monitor for an in-flight HSK simulation
// =========================================================================
// Polls /api/hsk-sim/sessions every 5s and re-renders four columns:
//   - Live (recent heartbeat, still answering)
//   - Stale (no heartbeat for 30s+ — probably aborted)
//   - Completed (finished and submitted)
//   - Left (explicit 'left' status via beforeunload beacon)
//
// Auth: reads ?pw=<maestro-code> from the URL — same convention every
// other admin-side endpoint uses.
// =========================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const params = new URLSearchParams(location.search);
  const simId      = params.get('sim') || 'hsk1-sim1';
  const accessCode = params.get('access') || '';
  let pw = params.get('pw') || '';
  try { if (!pw) pw = localStorage.getItem('mochi.maestroPw') || ''; } catch (_) {}
  // Persist for refresh comfort
  try { if (pw) localStorage.setItem('mochi.maestroPw', pw); } catch (_) {}

  $('hh-sim-title').textContent = simId.replace(/-/g, ' · ').toUpperCase();

  function avatarHtml(a) {
    if (!a) return '<span class="hh-row-av is-emoji">🧒</span>';
    if (/^[a-z0-9_-]+$/i.test(a)) {
      // Heuristic: SVG avatars use lowercase keys; character roster
      // uses PNGs in /assets/cutscenes/chars/. We try SVG first, but
      // for known-char keys we use the PNG path.
      const charSet = new Set(['gojo','yugi','yuji','shelly','fnaf','dandy','hanzo','mei2','dralingo','naruto','sasuke','luffy','goku','pikachu','sonic','mario','kirby','spiderman','ironman','elsa','moana','squirtle']);
      const url = charSet.has(a)
        ? '/assets/cutscenes/chars/' + a + '-a.png'
        : '/assets/avatars/' + encodeURIComponent(a) + '.svg';
      return '<span class="hh-row-av"><img src="' + url + '" alt=""></span>';
    }
    // Legacy emoji avatar
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
    else if (kind === 'done')  meta = '<span class="hh-row-section">✓ Examen entregado</span>';
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

  function render(data) {
    const live  = (data && data.live)      || [];
    const stale = (data && data.stale)     || [];
    const done  = (data && data.completed) || [];
    const left  = (data && data.left)      || [];
    $('hh-count-live').textContent  = live.length;
    $('hh-count-stale').textContent = stale.length;
    $('hh-count-done').textContent  = done.length;
    $('hh-count-left').textContent  = left.length;
    $('hh-list-live').innerHTML  = live.length  ? live.map((r)  => rowHtml(r, 'live')).join('')   : '<p class="hh-empty">Nadie ha entrado todavía.</p>';
    $('hh-list-stale').innerHTML = stale.length ? stale.map((r) => rowHtml(r, 'stale')).join('')  : '<p class="hh-empty">Nadie está sin señal.</p>';
    $('hh-list-done').innerHTML  = done.length  ? done.map((r)  => rowHtml(r, 'done')).join('')   : '<p class="hh-empty">Aún nadie ha terminado.</p>';
    $('hh-list-left').innerHTML  = left.length  ? left.map((r)  => rowHtml(r, 'left')).join('')   : '<p class="hh-empty">Nadie ha cerrado el examen.</p>';

    const total = live.length + stale.length + done.length + left.length;
    $('hh-tally').innerHTML = '<strong>' + total + '</strong> alumno' + (total === 1 ? '' : 's') +
      ' · 🟢 ' + live.length + ' activo' + (live.length === 1 ? '' : 's') +
      ' · 🏅 ' + done.length + ' terminó' + (done.length === 1 ? '' : 'aron');
  }

  function poll() {
    let url = '/api/hsk-sim/sessions?pw=' + encodeURIComponent(pw)
      + '&simId=' + encodeURIComponent(simId);
    if (accessCode) url += '&accessCode=' + encodeURIComponent(accessCode);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) {
          $('hh-sub').textContent = 'Error: ' + (d && d.error || 'desconocido') + ' — revisa que tu código de maestra esté en la URL (?pw=…).';
          return;
        }
        render(d);
      })
      .catch((e) => { $('hh-sub').textContent = 'Red: ' + e.message; });
  }
  poll();
  setInterval(poll, 5000);
})();
