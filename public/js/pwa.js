// pwa.js — the Draly Wisdom Grounds home-screen app (2026-10-12, his ask: "Dralingo icon, full-screen, ready for
// notifications"). Loaded by the pages families and teachers open (home, homework, audios, player, maestro, games).
//  · registers /sw.js (offline page + notifications; it never caches class content) — not on the old onrender address;
//  · every element with [data-pwa-install] becomes an «Instalar la app» button: hidden when the app is already installed
//    or the phone can't install it; Android/desktop Chrome get their own install prompt, iPhone gets a 3-step picture
//    sheet (Apple has no install button) that also shows the kid's codes, because an iPhone home-screen app keeps its
//    own storage and asks for them once;
//  · window.DralyPWA.enableNotifications(publicKey) asks permission and returns the push subscription (not wired to any
//    button yet: sending notifications needs the server keys, see docs/HOW_CLAUDE_WORKS.md § Home-screen app).
(function () {
  'use strict';
  var w = window, doc = document;
  var standalone = (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || w.navigator.standalone === true;
  var ua = w.navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (w.navigator.platform === 'MacIntel' && w.navigator.maxTouchPoints > 1);
  var deferred = null;
  (function baseCss() {                                       // a page's own button style must never un-hide it
    var s = doc.createElement('style');
    s.textContent = '[data-pwa-install][hidden]{display:none!important}';
    (doc.head || doc.documentElement).appendChild(s);
  })();

  if ('serviceWorker' in w.navigator && !/\.onrender\.com$/i.test(w.location.hostname)) {
    w.addEventListener('load', function () { w.navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }

  function canInstall() { return !standalone && (!!deferred || isIOS); }
  function refresh() {
    var show = canInstall();
    Array.prototype.forEach.call(doc.querySelectorAll('[data-pwa-install]'), function (el) { el.hidden = !show; });
  }
  w.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; refresh(); });
  w.addEventListener('appinstalled', function () { deferred = null; standalone = true; refresh(); });

  function css() {
    if (doc.getElementById('pwa-css')) return;
    var s = doc.createElement('style');
    s.id = 'pwa-css';
    s.textContent = [
      '.pwa-sheet{position:fixed;inset:0;z-index:9999;display:grid;align-items:end;justify-items:center;background:rgba(29,36,64,.55);padding:12px}',
      '.pwa-card{width:min(440px,100%);max-height:92vh;overflow:auto;background:#fff8ea;color:#1d2440;border:4px solid #1d2440;border-radius:26px;',
      'box-shadow:0 8px 0 #1d2440;padding:16px 18px 18px;font:800 1rem/1.35 "Nunito",system-ui,-apple-system,sans-serif;text-align:left}',
      '.pwa-top{display:flex;align-items:center;gap:12px;margin-bottom:10px}.pwa-top img{width:64px;height:64px;border-radius:16px}',
      '.pwa-top b{font:900 1.3rem/1.15 "Baloo 2","Nunito",system-ui,sans-serif}',
      '.pwa-step{display:flex;gap:10px;align-items:flex-start;margin:10px 0}.pwa-num{flex:none;width:30px;height:30px;border-radius:50%;',
      'background:#ffc93c;border:3px solid #1d2440;display:grid;place-items:center;font-weight:900}',
      '.pwa-share{display:inline-block;padding:0 6px;border:2px solid #1d2440;border-radius:8px;background:#fff}',
      '.pwa-codes{margin:12px 0 4px;padding:10px 12px;border:3px dashed #1d2440;border-radius:16px;background:#fff}',
      '.pwa-codes b{font:900 1.5rem "Baloo 2",system-ui,sans-serif;letter-spacing:.12em}',
      '.pwa-ok{width:100%;min-height:54px;margin-top:12px;border:3px solid #1d2440;border-radius:16px;background:#ffc93c;color:#1d2440;',
      'font:900 1.15rem "Nunito",system-ui,sans-serif;box-shadow:0 4px 0 #1d2440;cursor:pointer}',
    ].join('');
    doc.head.appendChild(s);
  }
  function txt(tag, cls, text) { var el = doc.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; }
  function step(n, nodes) {
    var row = txt('div', 'pwa-step');
    row.appendChild(txt('span', 'pwa-num', String(n)));
    var body = txt('div');
    nodes.forEach(function (x) { body.appendChild(typeof x === 'string' ? doc.createTextNode(x) : x); });
    row.appendChild(body);
    return row;
  }
  function iosSheet() {
    css();
    var code = '', ac = '';
    try { code = w.localStorage.getItem('dralyStudentCode') || ''; ac = w.localStorage.getItem('dralyHwAccessCode') || ''; } catch (_) {}
    var sheet = txt('div', 'pwa-sheet');
    sheet.setAttribute('role', 'dialog');
    var card = txt('div', 'pwa-card');
    var top = txt('div', 'pwa-top');
    var icon = txt('img'); icon.src = '/assets/app/icon-192.png'; icon.alt = '';
    top.appendChild(icon);
    top.appendChild(txt('b', '', 'Pon a Dralingo en tu pantalla de inicio'));
    card.appendChild(top);
    card.appendChild(step(1, ['Toca el botón ', txt('span', 'pwa-share', 'Compartir ⬆️'), ' (abajo en Safari, arriba en Chrome).']));
    card.appendChild(step(2, ['Baja y elige ', txt('b', '', '«Agregar a inicio»'), '.']));
    card.appendChild(step(3, ['Toca ', txt('b', '', '«Agregar»'), '. ¡Listo! Dralingo aparece con las demás apps.']));
    if (code) {
      var box = txt('div', 'pwa-codes');
      // (2026-10-18, la entrada: a kid of the level key has no class code: the app asks their code AND the level key)
      box.appendChild(txt('div', '', ac ? 'La primera vez, la app te pide tus códigos. Anótalos:'
        : 'La primera vez, la app te pide tu código y la clave de tu nivel (la del mensaje de tu profe). Anota tu código:'));
      if (ac) { box.appendChild(doc.createTextNode('Código de acceso: ')); box.appendChild(txt('b', '', ac)); box.appendChild(txt('br')); }
      box.appendChild(doc.createTextNode('Tu código de estudiante: '));
      box.appendChild(txt('b', '', code));
      card.appendChild(box);
    }
    var ok = txt('button', 'pwa-ok', '¡Entendido!');
    ok.type = 'button';
    card.appendChild(ok);
    sheet.appendChild(card);
    function close() { sheet.remove(); }
    ok.addEventListener('click', close);
    sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
    doc.body.appendChild(sheet);
    ok.focus();
  }

  function install() {
    if (deferred) {
      var d = deferred;
      deferred = null;
      d.prompt();
      (d.userChoice || Promise.resolve()).then(refresh, refresh);
    } else if (isIOS && !standalone) {
      iosSheet();
    }
  }
  doc.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-pwa-install]');
    if (!b) return;
    e.preventDefault();
    install();
  });

  // Ready for notifications: ask permission + subscribe with the server's public key (VAPID). Returns the subscription
  // as plain JSON for the server to store, or null when the phone can't / the person said no.
  function enableNotifications(publicKey) {
    if (!('serviceWorker' in w.navigator) || !('PushManager' in w) || !('Notification' in w)) return Promise.resolve(null);
    return w.Notification.requestPermission().then(function (p) {
      if (p !== 'granted') return null;
      return w.navigator.serviceWorker.ready.then(function (reg) {
        var key = publicKey;
        if (typeof key === 'string') {
          var b64 = (key + '='.repeat((4 - key.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
          var raw = w.atob(b64);
          key = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
        }
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }).then(function (sub) { return sub ? sub.toJSON() : null; });
    }).catch(function () { return null; });
  }

  w.DralyPWA = { canInstall: canInstall, install: install, isStandalone: function () { return standalone; }, enableNotifications: enableNotifications };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', refresh); else refresh();
})();
