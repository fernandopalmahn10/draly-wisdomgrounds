// ════════════════════════════════════════════════════════════════════
// 🚀 LIVE-GAME — universal force-into-room boot for non-gated games.
//
// Pairs with /maestro's launcher. Each non-warmup, non-HSK host page
// includes this script. When opened with ?livegame=1, it:
//   1. Reads sessionStorage 'dralyLiveGame' payload {pw, codes, label}
//   2. Polls the DOM for the PIN element (#pin-display or similar) —
//      these host pages create their rooms automatically on load, so
//      the PIN appears within a second or two.
//   3. Once found, POSTs /api/admin/broadcast-selected with a FORCE
//      action whose URL is /player.html?pin=<PIN>&autojoin=1.
//   4. Kids' homework portal splices in &name=&code=, hard-redirects.
//
// Why not the same as auto-host.js (which I tried before)? That one
// also tried to auto-click admin gates, which created race conditions
// on warmup/reading. This script INTENTIONALLY only targets the
// non-gated games — much narrower scope, much more reliable.
//
// Mirrors host-warmup's existing ?livemaster=1 flow. Warmup and HSK
// have their own proven force flows and don't need this script.
// ════════════════════════════════════════════════════════════════════
(function () {
  if (!new URLSearchParams(location.search).get('livegame')) return;
  let payload = null;
  try {
    const raw = sessionStorage.getItem('dralyLiveGame');
    if (raw) payload = JSON.parse(raw);
    sessionStorage.removeItem('dralyLiveGame');
  } catch (_) {}
  if (!payload || !payload.pw || !Array.isArray(payload.codes) || !payload.codes.length) return;

  function _banner(text, isErr) {
    let el = document.getElementById('draly-livegame-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'draly-livegame-banner';
      el.style.cssText =
        'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;' +
        'background:linear-gradient(135deg,#5be88a,#5be8d1);color:#0d2a16;' +
        'padding:10px 18px;border-radius:999px;font-weight:900;font-family:system-ui,sans-serif;' +
        'box-shadow:0 4px 18px rgba(91,232,138,0.4);font-size:0.95rem;max-width:90vw;text-align:center;' +
        'cursor:pointer;';
      el.title = 'Toca para cerrar';
      el.addEventListener('click', () => { try { el.remove(); } catch (_) {} });
      document.body.appendChild(el);
    }
    el.textContent = text;
    if (isErr) el.style.background = 'linear-gradient(135deg,#ff9a6b,#ff7e5f)';
  }
  _banner('🚀 Preparando ' + (payload.label || 'el juego') + ' · esperando PIN…');

  function _extractPin() {
    const candidates = [
      document.getElementById('pin-display'),
      document.getElementById('active-pin-display'),
      document.getElementById('hh-pin'),
      document.getElementById('hh-pin-small'),
      document.getElementById('hr-pin'),
      document.getElementById('h-pin'),
      document.getElementById('pin-num'),
    ].filter(Boolean);
    for (const el of candidates) {
      const txt = (el.textContent || '').replace(/\D/g, '');
      if (/^\d{4}$/.test(txt)) return txt;
    }
    return null;
  }

  let fired = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 60;     // 60 × 500ms = 30s
  const timer = setInterval(() => {
    attempts++;
    if (fired) { clearInterval(timer); return; }
    if (attempts > MAX_ATTEMPTS) {
      clearInterval(timer);
      _banner('⚠️ No se obtuvo el PIN. Asegúrate que la sala se haya creado.', true);
      return;
    }
    const pin = _extractPin();
    if (!pin) return;
    fired = true;
    clearInterval(timer);
    const kidUrl = '/player.html?pin=' + pin + '&autojoin=1';
    _banner('🚀 PIN ' + pin + ' · trayendo alumnos…');
    fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(payload.pw), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentCodes: payload.codes,
        text: '🚀 La maestra está abriendo ' + (payload.label || 'el juego') + '. Estás entrando.',
        actionType: 'force',
        actionUrl: kidUrl,
        actionLabel: 'Entrar →',
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res && res.ok) {
          _banner('✅ PIN ' + pin + ' · ' + res.sent + ' alumno(s) entrando');
          setTimeout(() => {
            const el = document.getElementById('draly-livegame-banner');
            if (el) el.remove();
          }, 8000);
        } else {
          _banner('⚠️ ' + ((res && res.error) || 'no se pudo enviar'), true);
        }
      })
      .catch((e) => _banner('⚠️ ' + e.message, true));
  }, 500);
})();
