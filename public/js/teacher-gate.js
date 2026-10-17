// =========================================================================
// teacher-gate.js · the teacher key on every host page (2026-10-15, La Ruta Dorada)
// =========================================================================
// His words: "maestros crear un juego needs first time key access, then it's safe". The server refuses host:create
// unless the device is a remembered teacher device (httpOnly cookie from a /maestro login or from this screen,
// core/level-keys.js) or the teacher's code comes along. This script, loaded right after /socket.io/socket.io.js and
// before the page's own script, makes that painless:
//   1. asks the server whether this device is remembered (GET /api/teacher-device);
//   2. if not, tries the code this browser already saved (/maestro, host-hsk) once, silently;
//   3. else shows the teacher-key screen (same family as the kids' key screen: css/key-screen.css, loaded only then)
//      and holds the page's host:create until the code is right. The code then rides along with that create once
//      (the page's connection was opened before the cookie existed), and the device is remembered for 90 days.
// Rooms already running (F5 on the projector → host:reclaim) never wait for this. A refusal from the server shows the
// screen again instead of a broken lobby.
// =========================================================================
(function () {
  'use strict';
  if (!window.io || window.io.__dralyGate) return;
  var realIo = window.io;
  var state = 'unknown';          // 'unknown' → 'open' | 'closed'
  var code = '';                  // a code typed or saved on this page: sent with host:create (never stored)
  var waiters = [];
  var ui = null;
  var ls = function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  var forgetSaved = function () { ['dralyMaestroPw', 'mochi.maestroPw'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} }); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function open(c) {
    if (c) code = c;
    state = 'open';
    hide();
    var w = waiters; waiters = [];
    w.forEach(function (f) { try { f(); } catch (e) { console.warn('[teacher-gate]', e); } });
  }
  function whenOpen(fn) { if (state === 'open') fn(); else waiters.push(fn); }
  function remember(c) {
    return fetch('/api/teacher-device', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: c }) })
      .then(function (r) { return r.json().then(function (d) { d = d || {}; d.status = r.status; return d; }); })
      .catch(function () { return { ok: false, error: 'No hay conexión. Revisa el internet y vuelve a intentarlo.' }; });
  }
  function check() {
    fetch('/api/teacher-device', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.remembered) { open(); return; }
        var saved = ls('dralyMaestroPw') || ls('mochi.maestroPw');
        // (the screen only when a new room is waiting: an F5 that takes a running room back never gets covered by it,
        // even when the teacher's code was changed mid-class)
        if (!saved) { state = 'closed'; if (waiters.length) show(); return; }
        remember(saved).then(function (r) {
          if (r && r.ok) { open(saved); return; }
          if (r && r.retired) forgetSaved();   // a code changed with «Cambiar mi código»: never tried again
          state = 'closed'; if (waiters.length) show();
        });
      })
      .catch(function () { open(); });   // no answer: the server decides at host:create (a refusal shows the screen)
  }

  // ── the room's secret (2026-10-16): the server gives the projector that opened a room a token, and takes the projector
  // back (host:reclaim) only with it or the same teacher's device or code. Kept per tab (an F5 keeps it; another tab
  // or browser of the same teacher goes by the remembered device), never in localStorage or a URL.
  var tokens = {};
  var tokenKey = function (pin) { return 'draly.hostToken.' + pin; };
  function keepToken(pin, t) {
    if (!pin || !t) return;
    tokens[pin] = t;
    try { sessionStorage.setItem(tokenKey(pin), t); } catch (e) {}
  }
  function tokenOf(pin) {
    if (!pin) return '';
    if (tokens[pin]) return tokens[pin];
    try { return sessionStorage.getItem(tokenKey(pin)) || ''; } catch (e) { return ''; }
  }

  // ── host:create waits for the gate; a refusal brings the screen back ──
  function patch(sock) {
    if (!sock || sock.__dralyGate) return sock;
    sock.__dralyGate = true;
    var emit = sock.emit;
    sock.emit = function (ev) {
      if (ev === 'host:reclaim' || ev === 'host:end') {
        // the room's token rides along; so does a code typed on this page (another browser of the same teacher).
        // «Cerrar la sala» (host:end, 2026-10-17) too: an exam room closes only for its own projector, its teacher or a
        // super admin
        var args = Array.prototype.slice.call(arguments, 1);
        var i = -1;
        args.forEach(function (a, k) { if (i < 0 && a && typeof a === 'object') i = k; });
        if (i >= 0) {
          var o = Object.assign({}, args[i]);
          var t = tokenOf(o.pin);
          if (t && !o.hostToken) o.hostToken = t;
          if (code && !o.password) o.password = code;
          args[i] = o;
        }
        return emit.apply(sock, [ev].concat(args));
      }
      if (ev !== 'host:create') return emit.apply(sock, arguments);
      var opts = null, cb = null;
      Array.prototype.slice.call(arguments, 1).forEach(function (a) {
        if (typeof a === 'function') cb = a;
        else if (a && typeof a === 'object' && !opts) opts = a;
      });
      opts = Object.assign({}, opts || {});
      var send = function () {
        var o = Object.assign({}, opts);
        if (code) o.password = code;   // the code the teacher just typed wins over one the page brought (it may be old)
        emit.call(sock, 'host:create', o, function (resp) {
          if (resp && resp.needTeacherKey) {
            state = 'closed'; code = '';
            whenOpen(send);
            show(resp.error);
            return;
          }
          if (resp && resp.pin && resp.hostToken) keepToken(resp.pin, resp.hostToken);
          if (cb) cb.apply(null, arguments);
        });
      };
      if (state === 'closed') show();   // the device is not a teacher's: the screen comes now, with the new room
      whenOpen(send);
      return sock;
    };
    return sock;
  }
  var gated = function () { return patch(realIo.apply(this, arguments)); };
  Object.keys(realIo).forEach(function (k) { gated[k] = realIo[k]; });   // io.Manager, io.Socket, io.protocol…
  gated.connect = gated;
  gated.__dralyGate = true;
  window.io = gated;

  // ── the screen ──
  var LOCK = '<svg class="ks-seal-lock" viewBox="0 0 24 24" aria-hidden="true"><path class="ks-shackle" d="M8 11.5V8a4 4 0 0 1 8 0v3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="11" width="15" height="10.5" rx="2.6" fill="currentColor"/></svg>';
  var ALERT = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v6" stroke="#f8e3dc" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.5" fill="#f8e3dc"/></svg>';
  function build() {
    if (!document.querySelector('link[data-ks-css]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = '/css/key-screen.css?v=20261015f'; l.setAttribute('data-ks-css', '1');
      document.head.appendChild(l);
    }
    var el = document.createElement('div');
    el.className = 'ks-root ks-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ks-t-title');
    el.style.visibility = 'hidden';          // until its stylesheet is in (never a flash of an unstyled form)
    el.innerHTML =
      '<div class="ks-layout">' +
        '<header class="ks-stage">' +
          '<p class="ks-word" translate="no">DRALINGO</p>' +
          '<div class="ks-hero">' +
            '<p class="ks-bubble" lang="zh-Latn-pinyin" translate="no">Lǎoshī hǎo!</p>' +
            '<img class="ks-dragon" src="/assets/dralingo/wise.webp" alt="Dralingo" width="427" height="480" decoding="async">' +
            '<div class="ks-seal" aria-hidden="true">' + LOCK + '<span class="ks-seal-name is-long">Maestros</span></div>' +
          '</div>' +
        '</header>' +
        '<main class="ks-sheet"><div class="ks-inner">' +
          '<h1 class="ks-title" id="ks-t-title">Escribe tu código de maestra o maestro</h1>' +
          '<p class="ks-lede">Es el mismo código con el que entras a Teacher Mode (/maestro). Este aparato lo recordará 90 días y ya no te lo pedirá.</p>' +
          '<p class="ks-lede is-en" lang="en">Your Teacher Mode code. This device remembers it for 90 days.</p>' +
          '<form class="ks-form" novalidate>' +
            '<label class="ks-label" for="ks-t-code">Tu código</label>' +
            '<div class="ks-field">' +
              '<input class="ks-input is-secret" id="ks-t-code" name="code" type="password" autocomplete="current-password" ' +
                'autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" maxlength="40" aria-describedby="ks-t-err" required>' +
              '<button class="ks-show" type="button" aria-pressed="false" aria-controls="ks-t-code">Ver</button>' +
            '</div>' +
            '<p class="ks-error" id="ks-t-err" role="alert"></p>' +
            '<button class="ks-go" type="submit">Entrar</button>' +
          '</form>' +
          '<p class="ks-alt">¿Olvidaste tu código? Pídeselo a Profe Fer.</p>' +
          '<p class="ks-alt"><a class="ks-link ks-back" href="/">← Volver</a></p>' +
        '</div></main>' +
      '</div>';
    var reveal = function () { el.style.visibility = ''; };
    var css = document.querySelector('link[data-ks-css]');
    if (css && css.sheet) reveal(); else if (css) { css.addEventListener('load', reveal); css.addEventListener('error', reveal); }
    setTimeout(reveal, 1500);

    var form = el.querySelector('form'), input = el.querySelector('.ks-input'), go = el.querySelector('.ks-go');
    el.querySelector('.ks-back').addEventListener('click', function (e) {
      if (history.length > 1) { e.preventDefault(); history.back(); }
    });
    var err = el.querySelector('.ks-error'), eye = el.querySelector('.ks-show');
    var hideT = null;
    var setShown = function (showIt) {
      input.type = showIt ? 'text' : 'password';
      eye.textContent = showIt ? 'Ocultar' : 'Ver';
      eye.setAttribute('aria-pressed', String(showIt));
    };
    eye.addEventListener('click', function () {
      var showIt = input.type === 'password';
      setShown(showIt);
      clearTimeout(hideT);
      if (showIt && window.innerWidth >= 860) hideT = setTimeout(function () { setShown(false); }, 3000);
      input.focus();
    });
    input.addEventListener('input', function () { if (input.getAttribute('aria-invalid')) { err.textContent = ''; input.removeAttribute('aria-invalid'); } });
    var setError = function (msg) {
      err.innerHTML = '';
      setTimeout(function () { err.innerHTML = ALERT; err.appendChild(document.createTextNode(msg)); }, 30);
      input.setAttribute('aria-invalid', 'true');
      if (!reduce) { el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake'); }
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = input.value.trim();
      if (!c) { setError('Escribe tu código.'); input.focus(); return; }
      go.disabled = true; go.setAttribute('aria-busy', 'true'); go.textContent = 'Revisando…';
      remember(c).then(function (r) {
        if (r && r.ok) {
          // an exam monitor (host-hsk) reads the code from here: keep it current
          try { if (localStorage.getItem('mochi.maestroPw')) localStorage.setItem('mochi.maestroPw', c); } catch (_) {}
          el.classList.add('is-open');
          go.textContent = '¡Listo!';
          setTimeout(function () { open(c); }, reduce ? 150 : 520);
          return;
        }
        go.disabled = false; go.setAttribute('aria-busy', 'false'); go.textContent = 'Entrar';
        setError((r && r.error) || 'Ese código no funciona. Es el mismo con el que entras a Teacher Mode (/maestro).');
        input.focus();
      });
    });
    return el;
  }
  var inerted = [];
  function show(msg) {
    var mount = function () {
      if (!ui) ui = build();
      if (!ui.isConnected) {
        document.body.appendChild(ui);
        Array.prototype.forEach.call(document.body.children, function (n) {
          if (n !== ui && !n.hasAttribute('inert')) { n.setAttribute('inert', ''); inerted.push(n); }
        });
      }
      ui.classList.remove('is-open', 'is-leaving');
      var go = ui.querySelector('.ks-go');
      go.disabled = false; go.setAttribute('aria-busy', 'false'); go.textContent = 'Entrar';
      if (msg) { var e = ui.querySelector('.ks-error'); e.textContent = msg; }
      // the field takes the focus on a laptop or projector; on a phone the keyboard waits for a tap
      if (window.matchMedia && matchMedia('(pointer: fine)').matches) {
        setTimeout(function () { try { ui.querySelector('.ks-input').focus(); } catch (_) {} }, 60);
      }
    };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  }
  function hide() {
    if (!ui || !ui.isConnected) return;
    inerted.forEach(function (n) { n.removeAttribute('inert'); });
    inerted = [];
    ui.classList.add('is-leaving');
    var gone = ui;
    setTimeout(function () { if (gone.isConnected) gone.remove(); }, reduce ? 0 : 200);
  }

  check();
})();
