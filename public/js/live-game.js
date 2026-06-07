// ════════════════════════════════════════════════════════════════════
// 🚀 LIVE-GAME — universal force-impose boot (v4: instant + diagnostic)
//
// Pairs with /maestro's launcher. Each non-warmup, non-HSK host page
// loads this script. When opened with ?livegame=1:
//   1. Reads sessionStorage 'dralyLiveGame' { pw, codes, label }
//   2. Uses MutationObserver to detect the moment the host page
//      writes the PIN into the DOM (#pin-display etc.). This is
//      INSTANT — no 500ms polling delay.
//   3. POSTs /api/admin/broadcast-selected with actionType:'force',
//      actionUrl '/player.html?pin=<PIN>&autojoin=1'.
//   4. Kids' homework.html polls inbox every 20s, sees actionType:
//      'force', shows the full-screen "¡Tu maestra te llama!"
//      takeover, then hard-redirects to /player.html which
//      auto-joins. Same UX as Modo Maestro.
//
// Diagnostic banner stays sticky so the teacher always sees what
// happened. Console logs every step for DevTools debugging.
// ════════════════════════════════════════════════════════════════════
(function () {
  const LIVE_GAME_VERSION = 'live-game.js v5 · 20260604q (3-digit PIN fix)';
  console.log('[live-game] script loaded · ' + LIVE_GAME_VERSION);
  if (!new URLSearchParams(location.search).get('livegame')) {
    console.log('[live-game] no ?livegame=1 flag, exiting');
    return;
  }
  let payload = null;
  try {
    const raw = sessionStorage.getItem('dralyLiveGame');
    if (raw) payload = JSON.parse(raw);
    sessionStorage.removeItem('dralyLiveGame');
  } catch (e) {
    console.warn('[live-game] sessionStorage parse failed:', e);
  }
  if (!payload || !payload.pw || !Array.isArray(payload.codes) || !payload.codes.length) {
    console.warn('[live-game] payload missing or invalid:', payload);
    return;
  }
  console.log('[live-game] payload ok — ' + payload.codes.length + ' kid(s), label=' + payload.label);

  // Banner — bigger, sticky, in-your-face so the teacher always sees it.
  function _banner(text, color) {
    let el = document.getElementById('draly-livegame-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'draly-livegame-banner';
      el.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
        'padding:14px 20px;font-weight:900;font-family:system-ui,sans-serif;' +
        'font-size:1rem;text-align:center;color:#0d2a16;' +
        'box-shadow:0 4px 18px rgba(0,0,0,0.3);' +
        'cursor:pointer;-webkit-tap-highlight-color:transparent;';
      el.title = 'Toca para cerrar';
      el.addEventListener('click', () => { try { el.remove(); } catch (_) {} });
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.background = color || 'linear-gradient(90deg,#5be88a,#5be8d1)';
  }
  _banner('🚀 ' + LIVE_GAME_VERSION + ' · Preparando ' + (payload.label || 'el juego') + ' · esperando PIN…');

  function _extractPin() {
    // 🆕 v5 FIX: genPin() returns a 3-digit PIN by default (100-999)
    // and falls back to 4-digit (1000-9999) only on collision. The
    // previous /^\d{4}$/ regex NEVER matched the common 3-digit case,
    // which is why every single launch timed out for non-HSK games.
    // Accept 3 OR 4 digits. (Cuts no PIN format we use.)
    const ids = ['pin-display', 'active-pin-display', 'hh-pin', 'hh-pin-small', 'hr-pin', 'h-pin', 'pin-num'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const txt = (el.textContent || '').replace(/\D/g, '');
      if (/^\d{3,4}$/.test(txt)) return txt;
    }
    return null;
  }

  let fired = false;
  function _fireForce(pin) {
    if (fired) return;
    fired = true;
    console.log('[live-game] PIN found: ' + pin + '. Firing broadcast-selected for ' + payload.codes.length + ' kid(s)');
    _banner('🚀 PIN ' + pin + ' · enviando "¡Tu maestra te llama!" a ' + payload.codes.length + ' alumno(s)…');
    const kidUrl = '/player.html?pin=' + pin + '&autojoin=1';
    fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(payload.pw), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentCodes: payload.codes,
        text: '🚀 La maestra está abriendo ' + (payload.label || 'el juego') + ' ahora. Estás entrando.',
        actionType: 'force',
        actionUrl: kidUrl,
        actionLabel: '📚 ' + (payload.label || 'Entrar'),
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        console.log('[live-game] broadcast-selected response:', res);
        if (res && res.ok) {
          if (res.sent > 0) {
            _banner('✅ PIN ' + pin + ' · ' + res.sent + ' alumno(s) entrarán (espera ~20s) · saltados: ' + (res.skipped || 0));
          } else {
            _banner('⚠️ Broadcast OK pero 0 alumnos recibieron. ¿Están en /homework.html abierto? · saltados: ' + (res.skipped || 0), 'linear-gradient(90deg,#ffb46b,#ff7e5f)');
          }
        } else {
          _banner('⚠️ Broadcast falló: ' + ((res && res.error) || 'desconocido'), 'linear-gradient(90deg,#ff9a6b,#ff7e5f)');
        }
      })
      .catch((e) => {
        console.error('[live-game] broadcast fetch failed:', e);
        _banner('⚠️ Error de red: ' + e.message, 'linear-gradient(90deg,#ff9a6b,#ff7e5f)');
      });
  }

  // Strategy 1: MutationObserver — fires INSTANTLY the moment the host
  // page writes the PIN into the DOM. Much faster than 500ms polling.
  const observer = new MutationObserver(() => {
    const pin = _extractPin();
    if (pin) {
      observer.disconnect();
      _fireForce(pin);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  console.log('[live-game] MutationObserver watching for PIN');

  // Strategy 2: also check NOW in case the PIN is already set before
  // this script ran (race condition where host JS ran first).
  setTimeout(() => {
    const pin = _extractPin();
    if (pin && !fired) {
      observer.disconnect();
      _fireForce(pin);
    }
  }, 100);

  // Strategy 3: safety-net polling at 1s in case MutationObserver
  // doesn't catch it (some host pages might set PIN via a method
  // that bypasses the observer — e.g., direct innerHTML rewrites).
  const safetyTimer = setInterval(() => {
    if (fired) { clearInterval(safetyTimer); return; }
    const pin = _extractPin();
    if (pin) {
      clearInterval(safetyTimer);
      observer.disconnect();
      _fireForce(pin);
    }
  }, 1000);

  // Give up after 45s.
  setTimeout(() => {
    if (!fired) {
      clearInterval(safetyTimer);
      observer.disconnect();
      console.error('[live-game] timed out without finding PIN');
      _banner('⚠️ TIMEOUT: el host no creó la sala en 45s. ¿Cargó bien?', 'linear-gradient(90deg,#ff9a6b,#ff7e5f)');
    }
  }, 45000);
})();
