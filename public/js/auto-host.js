// ════════════════════════════════════════════════════════════════════
// 🚀 AUTOHOST — universal "open host page + auto-force kids" runner.
//
// Fernando 2026-06-04: "I can have a shortcut to all the host the
// battle and then do the same — pick a kid online and host whichever
// game from here to the future we have in that host page."
//
// HOW IT WORKS
//   1. /maestro's launcher modal stashes a payload in sessionStorage
//      under the key 'dralyAutoHost':
//         { pw, codes, kidUrlTemplate, label }
//      …then opens /host-X.html?autohost=1 in a new tab.
//   2. This script runs on every host page. If it sees ?autohost=1 in
//      the URL, it:
//        - Reads the sessionStorage payload (cleared immediately so a
//          page refresh won't fire a second wave)
//        - Auto-fills the admin password input if it exists, and
//          auto-clicks the OK button if present
//        - Polls the DOM for the PIN (host pages render it into
//          #pin-display or #hh-pin)
//        - Once a 4-digit PIN appears, sends a force-impose broadcast
//          to the stashed student codes with kidUrlTemplate
//          (e.g. '/player.html?pin={PIN}') so kids auto-redirect
//   3. The launcher continues to work for HSK + warmup paths that
//      already exist — this is additive, not replacing.
//
// SAFE: if no autohost flag is present, the script is a no-op. If the
// payload is corrupt or the PIN never appears within ~30s, it gives
// up without disturbing the page.
// ════════════════════════════════════════════════════════════════════
(function () {
  if (!new URLSearchParams(location.search).get('autohost')) return;
  let payload = null;
  try {
    const raw = sessionStorage.getItem('dralyAutoHost');
    if (raw) payload = JSON.parse(raw);
    sessionStorage.removeItem('dralyAutoHost');
  } catch (_) {}
  if (!payload || !payload.pw || !Array.isArray(payload.codes) || !payload.kidUrlTemplate) return;

  // Surface a tiny banner so the teacher knows the autohost is running.
  function _banner(text, isErr) {
    let el = document.getElementById('draly-autohost-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'draly-autohost-banner';
      el.style.cssText =
        'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;' +
        'background:linear-gradient(135deg,#5be88a,#5be8d1);color:#0d2a16;' +
        'padding:8px 16px;border-radius:999px;font-weight:900;font-family:system-ui,sans-serif;' +
        'box-shadow:0 4px 18px rgba(91,232,138,0.4);font-size:0.9rem;';
      document.body.appendChild(el);
    }
    el.textContent = text;
    if (isErr) el.style.background = 'linear-gradient(135deg,#ff9a6b,#ff7e5f)';
  }
  _banner('🚀 Auto-host preparando · ' + (payload.label || 'juego') + '…');

  // Try to auto-fill + auto-click the admin gate as soon as the inputs
  // appear. Host pages use different IDs so we sweep common ones.
  function _tryAuthFill() {
    const pwInputs = [
      document.getElementById('admin-pw'),
      document.getElementById('hh-admin-pw'),
      document.getElementById('hr-admin-pw'),
      document.querySelector('input[type="password"]'),
    ].filter(Boolean);
    if (pwInputs.length) {
      pwInputs.forEach((inp) => {
        if (!inp.value) inp.value = payload.pw;
      });
      const okButtons = [
        document.getElementById('admin-ok'),
        document.getElementById('hh-admin-ok'),
        document.getElementById('hr-admin-ok'),
        document.querySelector('button.btn-gold'),
        document.querySelector('button.btn-jade'),
      ].filter(Boolean);
      const okBtn = okButtons[0];
      if (okBtn && !okBtn.dataset.dralyAutohostClicked) {
        okBtn.dataset.dralyAutohostClicked = '1';
        try { okBtn.click(); } catch (_) {}
      }
    }
  }

  function _extractPin() {
    const candidates = [
      document.getElementById('pin-display'),
      document.getElementById('active-pin-display'),
      document.getElementById('hh-pin'),
      document.getElementById('hr-pin'),
      document.getElementById('hh-pin-small'),
    ].filter(Boolean);
    for (const el of candidates) {
      const txt = (el.textContent || '').replace(/\D/g, '');
      if (/^\d{4}$/.test(txt)) return txt;
    }
    return null;
  }

  let fired = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 60;   // 60 × 500ms = 30s grace
  const timer = setInterval(() => {
    attempts++;
    if (fired) { clearInterval(timer); return; }
    if (attempts > MAX_ATTEMPTS) {
      clearInterval(timer);
      _banner('⚠️ Auto-host: no se pudo obtener el PIN. Forza manualmente.', true);
      return;
    }
    _tryAuthFill();
    const pin = _extractPin();
    if (!pin) return;
    fired = true;
    const kidUrl = String(payload.kidUrlTemplate).replace('{PIN}', pin);
    fetch('/api/admin/broadcast-selected?pw=' + encodeURIComponent(payload.pw), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentCodes: payload.codes,
        text: '🚀 La maestra está abriendo ' + (payload.label || 'el juego') + ' ahora. Prepárate.',
        actionType: 'force',
        actionUrl: kidUrl,
        actionLabel: 'Entrar →',
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res && res.ok) {
          _banner('✅ Auto-host: PIN ' + pin + ' · ' + res.sent + ' alumno(s) notificados');
          setTimeout(() => {
            const el = document.getElementById('draly-autohost-banner');
            if (el) el.remove();
          }, 6000);
        } else {
          _banner('⚠️ Auto-host: ' + ((res && res.error) || 'error'), true);
        }
      })
      .catch((e) => _banner('⚠️ Auto-host: ' + e.message, true));
  }, 500);
})();
