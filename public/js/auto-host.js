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
//        - Auto-fills the admin password input (only KNOWN IDs to
//          avoid touching unrelated inputs)
//        - Auto-clicks the admin OK button (ONLY by exact ID — never
//          generic class selectors that could hit a wrong button)
//        - Polls the DOM for the PIN (host pages render it into
//          #pin-display or #hh-pin)
//        - Once a 4-digit PIN appears, sends a force-impose broadcast
//          to the stashed student codes with kidUrlTemplate
//          (e.g. '/player.html?pin={PIN}') so kids auto-redirect
//
// Fernando 2026-06-04 (v2 fix): the v1 fallback selectors '.btn-gold'
// and '.btn-jade' were clicking unrelated buttons on host pages that
// had a Cuaderno / Sets button styled with those classes BEFORE the
// admin-ok button. Removed the fallbacks — exact IDs only.
//
// SAFE: if no autohost flag is present, the script is a no-op. If the
// payload is corrupt or the PIN never appears within ~45s, it gives
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
  function _banner(text, isErr, persist) {
    let el = document.getElementById('draly-autohost-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'draly-autohost-banner';
      el.style.cssText =
        'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;' +
        'background:linear-gradient(135deg,#5be88a,#5be8d1);color:#0d2a16;' +
        'padding:10px 18px;border-radius:999px;font-weight:900;font-family:system-ui,sans-serif;' +
        'box-shadow:0 4px 18px rgba(91,232,138,0.4);font-size:0.95rem;max-width:90vw;' +
        'pointer-events:none;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent = text;
    if (isErr) el.style.background = 'linear-gradient(135deg,#ff9a6b,#ff7e5f)';
    else if (persist) el.style.background = 'linear-gradient(135deg,#5be88a,#5be8d1)';
  }
  _banner('🚀 Auto-host preparando · ' + (payload.label || 'juego') + '…');

  // Auto-fill admin password into known input IDs only. Never touch
  // unidentified password inputs (they might belong to a different
  // gate). Then click the admin OK button BY EXACT ID — no class
  // fallback, no querySelector wildcards. This was the v1 bug.
  function _tryAuthFill() {
    const pwInputs = [
      document.getElementById('admin-pw'),
      document.getElementById('hh-admin-pw'),
      document.getElementById('hr-admin-pw'),
      document.getElementById('hsk-admin-pw'),
    ].filter(Boolean);
    pwInputs.forEach((inp) => {
      if (!inp.value) inp.value = payload.pw;
    });
    const okButtonIds = ['admin-ok', 'hh-admin-ok', 'hr-admin-ok', 'hsk-admin-ok'];
    for (const id of okButtonIds) {
      const btn = document.getElementById(id);
      if (btn && !btn.dataset.dralyAutohostClicked) {
        btn.dataset.dralyAutohostClicked = '1';
        try { btn.click(); } catch (_) {}
        return;
      }
    }
  }

  // Pull a 4-digit PIN out of any known PIN-display element. Expanded
  // ID list as we discover more host-page conventions.
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
  const MAX_ATTEMPTS = 90;   // 90 × 500ms = 45s grace
  const timer = setInterval(() => {
    attempts++;
    if (fired) { clearInterval(timer); return; }
    if (attempts > MAX_ATTEMPTS) {
      clearInterval(timer);
      _banner('⚠️ Auto-host: no se obtuvo el PIN. ¿La página cargó bien? Forza manualmente.', true);
      return;
    }
    _tryAuthFill();
    const pin = _extractPin();
    if (!pin) return;
    fired = true;
    const kidUrl = String(payload.kidUrlTemplate).replace('{PIN}', pin);
    _banner('🚀 PIN ' + pin + ' encontrado · enviando alumnos…');
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
          _banner('✅ PIN ' + pin + ' · ' + res.sent + ' alumno(s) notificados · ' + res.skipped + ' saltados', false, true);
          // Banner stays visible until the teacher dismisses with a click.
          const el = document.getElementById('draly-autohost-banner');
          if (el) {
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'pointer';
            el.title = 'Toca para cerrar';
            el.addEventListener('click', () => { try { el.remove(); } catch (_) {} });
            setTimeout(() => { try { el.remove(); } catch (_) {} }, 12000);
          }
        } else {
          _banner('⚠️ Auto-host: ' + ((res && res.error) || 'error broadcasting'), true);
        }
      })
      .catch((e) => _banner('⚠️ Auto-host: ' + e.message, true));
  }, 500);
})();
