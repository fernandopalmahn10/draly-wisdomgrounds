// =========================================================================
// level-note.js · «Tu profe te cambió a New HSK 1 ✨» (2026-10-22, his ask: "if I see someone is mistakenly in a level that
// doesn't correspond to them, I change it, and then automatically that person gets logged out and logged in again and it
// says exactly that"). A teacher changed the kid's level in /maestro («Change level» in the kid's profile); the server
// hands the kid's OWN session a note (`levelNote`: /api/homework/home on the home, /api/ruta-dorada on La Ruta Dorada) until
// a phone has shown it. The page has already come in again in the new level (js/mi-dralingo.js, js/audios.js); this card
// says so once: the level's wonder, Dralingo with his star, one line of what changed, «¡Vamos!». Shown = told the server
// (POST /api/homework/level-note: no other phone shows it again) and kept on this phone (draly_lvnote: never twice here
// even when that call fails). Spanish (hw-i18n.js has its English on /homework); ✕, Esc and the backdrop close it too;
// reduced motion = no movement. No code, no hanzi on it.
// =========================================================================
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // each family's wonder, like the entrance's «¡Tu nivel es …!» (js/entrada.js WONDER)
  const WONDER = { yct: { src: '/assets/paint/dubai/bg.webp', pos: '50% 80%' }, newhsk: { src: '/assets/paint/rio/bg.webp', pos: '50% 62%' }, hsk: { src: '/assets/paint/muralla/bg.webp', pos: '50% 58%' } };
  const STAR = '/assets/dralingo/star-hold.webp';
  const SEEN = 'draly_lvnote';
  const seenHere = (at) => { try { return String(localStorage.getItem(SEEN) || '') === String(at); } catch (_) { return false; } };
  const markHere = (at) => { try { localStorage.setItem(SEEN, String(at)); } catch (_) { /* private mode: the server's mark still holds */ } };
  let open = null;

  // note = { at, level, levelId, name, family } → shows the card once (a note this phone already showed: nothing)
  function show(note, opts) {
    if (!note || !note.at || !note.name || open || seenHere(note.at)) return false;
    markHere(note.at);
    try {
      fetch('/api/homework/level-note', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ at: note.at }) }).catch(() => {});
    } catch (_) { /* the phone's own mark holds */ }
    const w = WONDER[note.family] || WONDER.hsk;
    const el = document.createElement('div');
    el.className = 'ln-back';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ln-title');
    el.innerHTML = '<div class="ln-card" tabindex="-1">' +
      '<button type="button" class="ln-x" data-ln="x" aria-label="Cerrar">✕</button>' +
      '<div class="ln-sky" style="background-image:url(\'' + esc(w.src) + '\');background-position:' + esc(w.pos) + '">' +
        '<img class="ln-dra" src="' + STAR + '" alt="" width="200" height="200" decoding="async">' +
        '<span class="ln-pill">' + esc(note.name) + '</span>' +
      '</div>' +
      '<div class="ln-body">' +
        '<p class="ln-t" id="ln-title">Tu profe te cambió a ' + esc(note.name) + ' ✨</p>' +
        '<p class="ln-p">Ahora tus palabras, tus tareas y tus prácticas son de ' + esc(note.name) + '. Lo que ya hiciste sigue guardado.</p>' +
        '<button type="button" class="ln-go" data-ln="go">¡Vamos!</button>' +
      '</div></div>';
    const back = document.activeElement;
    const close = () => {
      if (!el.isConnected) return;
      document.removeEventListener('keydown', onKey, true);
      el.classList.add('is-out');
      setTimeout(() => { el.remove(); open = null; }, calm() ? 0 : 160);
      if (back && back.focus && document.contains(back)) { try { back.focus({ preventScroll: true }); } catch (_) {} }
      if (opts && typeof opts.onClose === 'function') { try { opts.onClose(); } catch (_) {} }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {                             // focus stays in the card
        const f = [...el.querySelectorAll('button')];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-ln]')) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(el);
    open = el;
    // (the card takes the focus, not the button: no ring on a phone; Tab goes to «¡Vamos!» and ✕)
    setTimeout(() => { const c = el.querySelector('.ln-card'); if (c) { try { c.focus({ preventScroll: true }); } catch (_) {} } }, 40);
    return true;
  }
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  window.DralyLevelNote = { show, seenHere };
})();
