// =========================================================================
// host-reconnect.js · a projector whose connection drops takes its own room back (2026-10-17)
// =========================================================================
// A school's Wi-Fi blips → socket.io opens a NEW connection while the room still points at the old one, so every
// host-only control (the reading's rd:*, the exam's «Empezar») quietly stops working and the roster freezes, and a
// reload opens a NEW room with a new PIN mid-class. The warm-up always took its room back on reconnect (host:reclaim);
// this gives the reading and exam projectors the same, with the room's token (teacher-gate.js adds it) and the
// teacher code, and never leaves a dead screen:
//   · offline → a small notice at the top («Sin conexión · reconectando con la sala 123…»);
//   · back → «Conexión recuperada» and the page re-syncs (the server sends the reading state; the exam polls again);
//   · the room can't come back → a card in plain Spanish with a way forward: a new room (it is gone), today's code
//     (the code was changed mid-class), try again (no answer, too many wrong codes from the school's address).
// Loaded after teacher-gate.js; the page calls, right after io():
//   DralyReconnect.watch(socket, { pin: () => pin, code: () => code, setCode(c) {…}, room: 'la lectura',
//     holdsMinutes: 10, newRoom: { label: 'Abrir una lectura nueva', go() {…} }, onBack(resp) {…} })
// Used by host-reading.js, host-hsk.js and host-warmup.js (the warm-up too since 2026-10-17: its own reclaim showed a
// refusal only in the console).
// Test: scripts/test-host-reclaim.js (the server's answers, and this file in a small fake page).
// =========================================================================
(function () {
  'use strict';
  if (window.DralyReconnect) return;

  var CSS =
    '.drc-bar{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:100001;display:flex;align-items:center;gap:12px;' +
      'box-sizing:border-box;max-width:calc(100vw - 32px);padding:10px 18px;border-radius:16px;background:#ffd24a;color:#1a1a26;' +
      'font:800 1rem/1.25 Nunito,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);animation:drc-in .18s cubic-bezier(.2,.8,.2,1)}' +
    '.drc-bar small{display:block;font-size:.85rem;font-weight:700;opacity:.8}' +
    '.drc-bar.is-ok{background:#5be8d1}' +
    '.drc-bar.is-bad{background:#ff5a66;color:#fff}' +
    '.drc-dot{flex:none;width:12px;height:12px;border-radius:50%;background:currentColor;animation:drc-pulse 1s ease-in-out infinite}' +
    '.drc-bar.is-ok .drc-dot,.drc-bar.is-bad .drc-dot{animation:none}' +
    '.drc-bar .drc-btn{min-height:40px;padding:0 14px;font-size:.95rem;background:#fff;color:#1a1a26}' +
    '.drc-veil{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;box-sizing:border-box;' +
      'padding:16px;background:rgba(8,10,20,.62);animation:drc-fade .2s ease-out}' +
    '.drc-card{position:relative;box-sizing:border-box;width:min(580px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:30px 30px 26px;' +
      'border:2px solid #e8b14a;border-radius:22px;background:#1b1d2b;color:#f4e8d0;font-family:Nunito,system-ui,sans-serif;' +
      'box-shadow:0 24px 60px rgba(0,0,0,.55);animation:drc-pop .22s cubic-bezier(.2,.8,.2,1)}' +
    '.drc-card h2{margin:0 44px 10px 0;color:#ffd24a;font:900 1.6rem/1.2 Nunito,system-ui,sans-serif}' +
    '.drc-card p{margin:0 0 18px;font-size:1.1rem;line-height:1.45}' +
    '.drc-actions{display:flex;flex-wrap:wrap;gap:12px}' +
    '.drc-btn{min-height:56px;padding:0 24px;border:0;border-radius:14px;font:900 1.1rem Nunito,system-ui,sans-serif;cursor:pointer;' +
      'transition:transform .12s ease-out}' +
    '.drc-btn:active{transform:scale(.97)}' +
    '.drc-btn.is-main{background:#ffd24a;color:#1a1a26}' +
    '.drc-btn.is-ghost{background:transparent;color:#f4e8d0;box-shadow:inset 0 0 0 2px rgba(244,232,208,.4)}' +
    '.drc-x{position:absolute;top:12px;right:12px;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:#f4e8d0;' +
      'font:900 1.5rem/1 Nunito,system-ui,sans-serif;cursor:pointer}' +
    '.drc-label{display:block;margin:0 0 6px;font-weight:800}' +
    '.drc-field{display:flex;flex-wrap:wrap;gap:10px}' +
    '.drc-field input{flex:1 1 220px;min-width:0;min-height:56px;box-sizing:border-box;padding:0 16px;border:2px solid rgba(244,232,208,.4);' +
      'border-radius:14px;background:#10121c;color:#fff;font:800 1.2rem Nunito,system-ui,sans-serif;letter-spacing:.06em}' +
    '.drc-err{min-height:1.5em;margin:8px 0 14px;color:#ff8a93;font-weight:800}' +
    '.drc-btn:focus-visible,.drc-x:focus-visible,.drc-field input:focus-visible{outline:3px solid #fff;outline-offset:3px}' +
    '@keyframes drc-in{from{opacity:0;transform:translate(-50%,-12px)}}' +
    '@keyframes drc-fade{from{opacity:0}}' +
    '@keyframes drc-pop{from{opacity:0;transform:scale(.96)}}' +
    '@keyframes drc-pulse{50%{opacity:.35}}' +
    '@media (prefers-reduced-motion:reduce){.drc-bar,.drc-veil,.drc-card,.drc-dot{animation:none}.drc-btn{transition:none}}';

  // a tiny element builder (text only, never HTML: room words and PINs are written as text)
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  var styled = false;
  function addStyle() {
    if (styled) return;
    styled = true;
    document.head.appendChild(h('style', { 'data-drc': '1', text: CSS }));
  }
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  function watch(socket, o) {
    o = o || {};
    var room = o.room || 'la sala';
    var pinOf = function () { return String((o.pin && o.pin()) || ''); };
    var everConnected = !!socket.connected;
    var bar = null, veil = null, reopen = null;
    var barT = null, slowT = null, retryT = null;
    var seq = 0;            // each ask has its number: an answer to an older ask never paints over a newer one
    var tries = 0;          // automatic tries since the last success
    var codeTyped = false;  // the last ask carried a code typed on the card

    // ── the notice at the top ──
    function showBar(kind, line, small, button) {
      addStyle();
      clearTimeout(barT);
      if (!bar) bar = h('div', { class: 'drc-bar', role: 'status', 'aria-live': 'polite' });
      bar.className = 'drc-bar' + (kind === 'ok' ? ' is-ok' : kind === 'bad' ? ' is-bad' : '');
      while (bar.firstChild) bar.removeChild(bar.firstChild);
      bar.appendChild(h('span', { class: 'drc-dot', 'aria-hidden': 'true' }));
      bar.appendChild(h('span', { class: 'drc-msg' }, [document.createTextNode(line), small ? h('small', { text: small }) : null]));
      if (button) bar.appendChild(h('button', { class: 'drc-btn', type: 'button', text: button.label, onclick: button.go }));
      if (!bar.parentNode) document.body.appendChild(bar);
    }
    function hideBar() {
      clearTimeout(barT);
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    }

    // ── the card: what happened and what to do now ──
    function closeCard() {
      if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
      veil = null;
    }
    function showCard(title, text, actions, field) {
      addStyle();
      closeCard();
      var build = function () {
        var card = h('div', { class: 'drc-card', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'drc-t', 'aria-describedby': 'drc-d' }, [
          // «Cerrar aviso»: the card goes, the red notice stays (with «Ver opciones») until the room is back
          h('button', { class: 'drc-x', type: 'button', 'aria-label': 'Cerrar aviso', text: '×', onclick: closeCard }),
          h('h2', { id: 'drc-t', text: title }),
          h('p', { id: 'drc-d', text: text }),
          field ? field() : null,
          h('div', { class: 'drc-actions' }, actions.map(function (a, i) {
            return h('button', { class: 'drc-btn ' + (i ? 'is-ghost' : 'is-main'), type: 'button', text: a.label, onclick: a.go });
          })),
        ]);
        veil = h('div', { class: 'drc-veil' }, [card]);
        document.body.appendChild(veil);
        var first = card.querySelector('input') || card.querySelector('.drc-btn');
        if (first && first.focus) setTimeout(function () { try { first.focus(); } catch (_) {} }, 30);
      };
      reopen = build;
      build();
      showBar('bad', 'La sala ' + pinOf() + ' no está conectada', '', { label: 'Ver opciones', go: function () { if (reopen) reopen(); } });
    }
    var newRoom = function () {
      return { label: (o.newRoom && o.newRoom.label) || 'Abrir una sala nueva', go: function () { if (o.newRoom && o.newRoom.go) o.newRoom.go(); else location.reload(); } };
    };
    var retryNow = { label: 'Reintentar', go: function () { closeCard(); tries = 0; ask(); } };
    var toMaestro = { label: 'Volver a Modo Maestro', go: function () { location.href = '/maestro'; } };

    function gone(pin) {
      showCard(cap(room) + ' se cerró',
        'La sala ' + pin + ' ya no existe: se cerró mientras no había conexión. Abre una nueva: tendrá otro PIN y tus alumnos entran con él.',
        [newRoom(), toMaestro]);
    }
    function askCode(pin, again) {
      var input = null, err = null;
      var send = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        var c = String(input.value || '').trim();
        if (!c) { err.textContent = 'Escribe tu código.'; return; }
        if (o.setCode) o.setCode(c);
        codeTyped = true;
        closeCard();
        ask();
      };
      showCard('Tu código ya no abre esta sala',
        '¿Cambiaste tu código de maestra o maestro? Escribe el de ahora para recuperar la sala ' + pin + '. Tus alumnos siguen dentro.',
        [{ label: 'Recuperar la sala', go: function () { send(); } }, newRoom()],
        function () {
          input = h('input', { id: 'drc-code', type: 'password', autocomplete: 'current-password', autocapitalize: 'characters',
            spellcheck: 'false', maxlength: '40', 'aria-describedby': 'drc-err', onkeydown: function (e) { if (e.key === 'Enter') send(e); } });
          err = h('p', { class: 'drc-err', id: 'drc-err', role: 'alert', text: again ? 'Ese código tampoco funciona. Es el mismo con el que entras a Modo Maestro.' : '' });
          return h('div', {}, [h('label', { class: 'drc-label', for: 'drc-code', text: 'Tu código' }), h('div', { class: 'drc-field' }, [input]), err]);
        });
    }
    function retryIn(ms) {
      clearTimeout(retryT);
      retryT = setTimeout(function () { if (socket.connected) ask(); }, ms);
    }
    function refused(resp) {
      var why = (resp && resp.error) || 'other';
      var pin = pinOf();
      try { console.warn('[host] reclaim refused:', why); } catch (_) {}
      if (why === 'no-game') return gone(pin);
      if (why === 'bad-password') { askCode(pin, codeTyped); codeTyped = false; return; }
      codeTyped = false;
      if (why === 'wait') {
        showCard('Muchos intentos desde esta red',
          'Alguien escribió muchos códigos equivocados desde este internet y hay que esperar unos minutos. Esta página lo vuelve a intentar sola cada minuto.',
          [{ label: 'Reintentar ahora', go: retryNow.go }]);
        retryIn(60000);
        return;
      }
      showCard('No pude recuperar la sala ' + pin,
        why === 'timeout'
          ? 'El servidor no respondió. Esta página lo vuelve a intentar sola en unos segundos; si sigue así, revisa el internet de esta computadora.'
          : 'Otra pantalla tiene esta sala abierta. Si sigue así, abre una sala nueva: tendrá otro PIN.',
        [retryNow, newRoom()]);
      // no answer, or another screen still holds it (its connection may be dying): try again by itself for a while
      if ((why === 'timeout' || why === 'host-live') && tries++ < 8) retryIn(why === 'timeout' ? 5000 : 15000);
    }
    function back(resp) {
      tries = 0; codeTyped = false;
      clearTimeout(retryT); clearTimeout(slowT);
      closeCard(); reopen = null;
      showBar('ok', '✓ Conexión recuperada · sala ' + pinOf(), '');
      barT = setTimeout(hideBar, 2600);
      if (o.onBack) { try { o.onBack(resp); } catch (e) { try { console.warn('[host] after reclaim:', e); } catch (_) {} } }
    }

    // ── take the room back: the token rides along (teacher-gate.js), with the teacher code ──
    function ask() {
      var pin = pinOf();
      var code = o.code ? o.code() : '';
      clearTimeout(retryT); clearTimeout(slowT);
      if (!pin || !code) { closeCard(); hideBar(); return; }   // no room of ours yet: nothing to take back
      var mine = ++seq;
      var settled = false;
      showBar('off', 'Reconectando con la sala ' + pin + '…', '');
      var t = setTimeout(function () {
        if (settled || mine !== seq) return;
        settled = true;
        refused({ error: 'timeout' });
      }, 8000);
      socket.emit('host:reclaim', { pin: pin, password: code }, function (resp) {
        clearTimeout(t);
        if (mine !== seq) return;                                  // a newer ask is on its way
        if (resp && resp.ok) { settled = true; back(resp); return; }   // (a late yes after «no answer» still counts)
        if (settled) return;
        settled = true;
        refused(resp || {});
      });
    }
    function offline() {
      seq++;   // an answer that comes back over the dead connection no longer counts
      clearTimeout(retryT); clearTimeout(slowT);
      closeCard();
      var pin = pinOf();
      showBar('off', 'Sin conexión · reconectando con la sala ' + pin + '…', 'Los botones vuelven a funcionar en cuanto se reconecte.');
      slowT = setTimeout(function () {
        if (socket.connected) return;
        showBar('off', 'Sin conexión con la sala ' + pin,
          'Revisa el wifi de esta computadora. ' + (o.holdsMinutes ? 'La sala te espera ' + o.holdsMinutes + ' minutos.' : 'La sala te espera.'));
      }, 20000);
    }

    socket.on('connect', function () {
      if (!everConnected) { everConnected = true; return; }   // the page's first connection: nothing to take back
      ask();
    });
    socket.on('disconnect', function (reason) {
      if (reason === 'io client disconnect') return;           // the page itself closed it
      if (!pinOf()) return;                                      // no room yet
      offline();
      // the server closed it on purpose: socket.io doesn't try again by itself (back in, the room answers why)
      if (reason === 'io server disconnect') setTimeout(function () { try { socket.connect(); } catch (_) {} }, 1500);
    });
    return { ask: ask };
  }

  window.DralyReconnect = { watch: watch };
})();
