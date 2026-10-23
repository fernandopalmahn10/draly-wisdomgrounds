// host-back.js · «← Volver» on every projector page while its lobby (or its code gate) is on screen
// (his rule 2026-10-18: every screen has a way back). Before the game starts the teacher goes back to where the game
// was picked: the page they came from (the question packs, the games list), else the game's question packs, else
// Teacher Mode. Once the game runs, the game's own «Terminar» is the way out (a mis-tap must never end a class), so the
// button hides itself. Loaded at the end of <body> (needs css/back.css):
//   <script src="/js/host-back.js?v=…" data-place="float|title"></script>
//   float = pinned to the top-left corner (a lobby whose corner is empty)
//   title = just above the lobby's <h1> (a lobby whose title sits in that corner)
(function () {
  'use strict';
  var me = document.currentScript;
  var place = (me && me.getAttribute('data-place')) || 'float';
  var lobby = document.getElementById('screen-lobby') || document.getElementById('hh-lobby');
  var gate = document.getElementById('screen-admin-gate');
  if (!lobby && !gate) return;

  var GAME = {
    'host-kingdoms.html': 'kingdoms', 'host-paint.html': 'paint', 'host-snow.html': 'snow', 'host-escape.html': 'escape',
    'host-halcon.html': 'halcon', 'host-trapdoor.html': 'trapdoor', 'host.html': 'mochi-mash', 'host-pinata.html': 'pinata',
    'host-dragon.html': 'dragon-eye', 'host-monopoly.html': 'monopoly', 'host-dormilon.html': 'dormilon',
    'host-teamcrab.html': 'teamcrab',
  };
  var NO_PACKS = { 'host-sixseven.html': 1 };   // games without question packs (6-7 makes its own sums): the games list
  var file = location.pathname.split('/').pop() || 'host.html';
  var live = new URLSearchParams(location.search).get('livegame') === '1';
  var from = '';
  try { var r = document.referrer ? new URL(document.referrer) : null; if (r && r.origin === location.origin) from = r.pathname + r.search; } catch (e) {}
  var href = '/maestro.html', to = 'Modo Maestro';
  if (/^\/(packs|games|sets)\.html/.test(from)) { href = from; to = /^\/packs/.test(from) ? 'elegir las preguntas' : 'los juegos'; }
  else if (GAME[file] && !/^\/maestro/.test(from)) { href = '/packs.html?game=' + GAME[file] + (live ? '&livegame=1' : ''); to = 'elegir las preguntas'; }
  else if (NO_PACKS[file] && !/^\/maestro/.test(from)) { href = '/games.html'; to = 'los juegos'; }

  var a = document.createElement('a');
  a.className = 'dw-back host-back host-back--' + place + (place === 'float' ? ' dw-back--float' : '');
  a.href = href;
  a.textContent = 'Volver';
  a.setAttribute('aria-label', 'Volver: ' + to);
  a.title = 'Volver: ' + to;
  // kids already in the room: ask first (they would stay waiting on their phones). The lobbies say how many in words
  // («3 jugadores», «En la sala: 3»); a room nobody joined goes back at once.
  var waiting = function () {
    var t = (lobby && lobby.innerText) || '', n = 0, m, re = /(\d+)\s+jugador/gi;
    while ((m = re.exec(t))) n = Math.max(n, +m[1]);
    var s = t.match(/En la sala:\s*(\d+)/i);
    if (s) n = Math.max(n, +s[1]);
    return n;
  };
  a.addEventListener('click', function (e) {
    if (!(lobby && lobby.getClientRects().length) || waiting() === 0) return;
    if (!window.confirm('Hay alumnos esperando en esta sala. Si vuelves, se quedan esperando hasta que abras otra. ¿Volver de todos modos?')) e.preventDefault();
  });
  var h1 = place === 'title' && lobby ? lobby.querySelector('h1') : null;
  if (h1) h1.parentNode.insertBefore(a, h1);
  else { a.className += ' dw-back--float'; document.body.appendChild(a); }
  if (h1) return;   // inside the lobby: it goes away with it

  var seen = function (el) { return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  var sync = function () { a.hidden = !(seen(lobby) || seen(gate)); };
  sync();
  setInterval(sync, 600);
})();
