// =========================================================================
// super-admin-badge.js — floating "👑 Super Master" widget
//
// Per user feedback 2026-05-27: "I should have super admin command and
// control to distinguish me from the rest. I should be able to toggle
// the super master mode anywhere I want."
//
// HOW IT WORKS:
// 1. On load, reads localStorage.dralyMaestroPw (set when teacher logs
//    into /maestro). If absent, badge stays hidden — kids never see it.
// 2. Verifies the saved code against the server (/api/admin/students).
//    If valid AND the responder reports isSuperAdmin === true, the badge
//    floats in the corner.
// 3. Tap the badge → opens a small action panel:
//      • 📓 Cuaderno     — opens /maestro in same tab
//      • 👩‍🏫 Modo Maestro — opens /host-warmup.html in same tab
//      • 🚪 Salir         — clears the stored code (signs out the device)
//
// No password is ever displayed in the DOM. The localStorage value is
// only used for the API validation call.
// =========================================================================
(function () {
  'use strict';
  const STORAGE_KEY = 'dralyMaestroPw';
  let pw = '';
  try { pw = localStorage.getItem(STORAGE_KEY) || ''; } catch (_) {}
  if (!pw) return;   // Not logged in — bail silently. Kids see nothing.

  // Verify with the server. If the code isn't valid or isn't super admin,
  // bail silently (no badge).
  fetch('/api/admin/students?pw=' + encodeURIComponent(pw))
    .then((r) => r.json())
    .then((data) => {
      if (!data || !data.ok) return;
      const isSuper = !!(data.self && data.self.isSuperAdmin);
      if (!isSuper) return;
      const myName = (data.self && data.self.displayName) || 'Super';
      mountBadge(myName);
    })
    .catch(() => { /* network blip — don't show badge */ });

  function mountBadge(displayName) {
    if (document.getElementById('sa-badge')) return;   // already mounted

    const css = `
      #sa-badge {
        position: fixed;
        bottom: max(14px, env(safe-area-inset-bottom, 0px));
        right: 14px;
        z-index: 99998;
        font-family: 'Nunito', system-ui, sans-serif;
      }
      #sa-badge-pill {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 10px 16px;
        background: linear-gradient(135deg, #ffe082 0%, #ffb35a 100%);
        color: #14121e;
        font-weight: 900;
        font-size: 0.9rem;
        border: 2px solid #fff5d8;
        border-radius: 999px;
        box-shadow:
          0 4px 16px rgba(255, 179, 90, 0.6),
          0 8px 28px rgba(0, 0, 0, 0.4),
          0 0 0 4px rgba(255, 224, 130, 0.18);
        cursor: pointer;
        user-select: none;
        animation: sa-pulse 2.4s ease-in-out infinite;
      }
      @keyframes sa-pulse {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.04); }
      }
      #sa-badge-pill:hover { transform: scale(1.06); }
      #sa-badge-pill:active { transform: scale(0.98); }
      #sa-badge-panel {
        position: absolute;
        bottom: calc(100% + 10px);
        right: 0;
        min-width: 240px;
        background: linear-gradient(160deg, rgba(40, 50, 80, 0.98), rgba(20, 25, 45, 0.99));
        border: 2px solid #ffe082;
        border-radius: 14px;
        padding: 12px 10px 10px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7), 0 0 28px rgba(255, 224, 130, 0.3);
        opacity: 0;
        pointer-events: none;
        transform: translateY(8px);
        transition: opacity 0.2s, transform 0.2s;
      }
      #sa-badge.open #sa-badge-panel {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      #sa-badge-name {
        color: #ffe082;
        font-family: 'Cinzel', serif;
        font-size: 0.82rem;
        font-weight: 800;
        text-align: center;
        padding: 4px 6px 8px;
        border-bottom: 1px solid rgba(255, 224, 130, 0.2);
        margin-bottom: 6px;
        letter-spacing: 0.05em;
      }
      .sa-badge-action {
        display: block;
        width: 100%;
        padding: 10px 14px;
        background: rgba(50, 55, 90, 0.6);
        border: 1px solid rgba(255, 224, 130, 0.3);
        border-radius: 10px;
        color: #fff5d8;
        font-family: inherit;
        font-weight: 800;
        font-size: 0.9rem;
        text-align: left;
        margin-bottom: 6px;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.15s, border-color 0.15s, transform 0.08s;
      }
      .sa-badge-action:hover {
        background: rgba(80, 85, 130, 0.85);
        border-color: #ffe082;
        transform: translateX(-2px);
      }
      .sa-badge-action.danger {
        color: #ff9a8a;
        border-color: rgba(255, 138, 122, 0.35);
      }
      .sa-badge-action.danger:hover { background: rgba(80, 35, 45, 0.7); }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = 'sa-badge-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    const wrap = document.createElement('div');
    wrap.id = 'sa-badge';
    wrap.innerHTML = `
      <div id="sa-badge-pill" title="Modo Super Master">
        <span>👑</span><span>Super Master</span>
      </div>
      <div id="sa-badge-panel" role="menu">
        <div id="sa-badge-name">${escapeHtml(displayName)}</div>
        <a class="sa-badge-action" href="/maestro.html" role="menuitem">📓 Cuaderno de Alumnos</a>
        <a class="sa-badge-action" href="/host-warmup.html" role="menuitem">👩‍🏫 Modo Maestro (vocabulario)</a>
        <a class="sa-badge-action" href="/games.html" role="menuitem">🎮 Hospedar juego</a>
        <button class="sa-badge-action danger" id="sa-badge-logout" type="button" role="menuitem">🚪 Salir de Super Master</button>
      </div>`;
    document.body.appendChild(wrap);

    const pill = document.getElementById('sa-badge-pill');
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });
    // Close on outside tap
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) wrap.classList.remove('open');
    });
    document.getElementById('sa-badge-logout').addEventListener('click', () => {
      if (!confirm('¿Cerrar sesión de Super Master en este dispositivo?')) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      wrap.remove();
      const styles = document.getElementById('sa-badge-styles');
      if (styles) styles.remove();
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
