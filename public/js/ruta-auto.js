// =========================================================================
// ruta-auto.js · the automatic student account (his words 2026-10-18: "make the system automatically give them an
// account and the option to also put their name… they automatically should keep that code forever")
// =========================================================================
// One small module for every page that needs it (audios.html: La Ruta Dorada, La Base, the homework audio pages, El
// Entrenamiento; homework.html: the «¿Eres tú?» card). The server decides everything (server.js «AUTOMATIC STUDENT
// ACCOUNTS»); this file only asks at the right moment and draws the cards:
//   DralyAuto.ensure(level, step, id)  a visitor's first REAL step ('key' | 'seal' | 'train' | 'tarea'): a phone that
//                                      remembers a /homework login logs that kid in again (no duplicate for a real kid);
//                                      anyone else gets their automatic account (POST /api/ruta/auto). Once per page and
//                                      step. → Promise<{ account, created, relogged } | null>
//   DralyAuto.welcome(account, opts)   «¡Ya tienes tu cuenta de Dralingo! Tu código es K7P2: anótalo en tu cuaderno»
//                                      (Copiar, «¿Cómo te llamas?» + Guardar, «Ahora no»), once per account on this phone
//   DralyAuto.afterRoute(ruta)         audios.js after every screen: the card an account made on another page (the key
//                                      screen, a training round) asked for (cookie draly_auto_new)
//   DralyAuto.codeSheet(me, onSaved)   «Mi código»: the code, Copiar, the name (La Ruta Dorada's band)
//   DralyAuto.me()                     GET /api/ruta/me: the account this phone holds (its login, else its automatic one)
//   DralyAuto.eresTu(mount, acc, opts) the /homework «¿Eres tú?» card → Promise<'me' | 'other' | 'merge'>
//   DralyAuto.merge()                  POST /api/ruta/auto/merge («Pasar mi progreso a esta cuenta»)
// The phone also remembers the code: localStorage draly_auto { code, seen } (the move bridge carries `draly…` keys), and
// dralyStudentCode when the phone has no /homework login saved (the /homework form then shows it).
// Never «Anon»: a nameless account shows its placeholder («Dragoncito 382»). No hanzi, no em dash here.
// =========================================================================
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
  };
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const KEY = 'draly_auto';
  const readMine = () => { try { const o = JSON.parse(ls.get(KEY) || 'null'); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; } };
  const writeMine = (o) => ls.set(KEY, JSON.stringify(o));
  const I = {
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  };
  const post = (url, body) => fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then((r) => r.json().catch(() => null).then((d) => ({ status: r.status, d })), () => ({ status: 0, d: null }));

  // the phone remembers the account (and, with no /homework login saved, puts its code in the /homework form)
  function remember(acc) {
    if (!acc || !acc.code || !acc.auto) return;
    const o = readMine();
    if (o.code !== acc.code) { o.code = acc.code; delete o.seen; }
    writeMine(o);
    if (!ls.get('dralyHwAccessCode') && !ls.get('dralyStudentCode')) ls.set('dralyStudentCode', acc.code);
  }

  // ── a first real step ─────────────────────────────────────────────
  // (security review M2, 2026-10-18) After «Salir» at /homework (localStorage dralyHwOut, cleared by the next «Entrar»)
  // the kid saved on this phone is never logged in again by itself, and this phone's PARKED automatic account is never
  // resumed by itself: the server answers why: 'parked' and the page asks «¿Eres tú?» (askParked). «Sí, soy yo» resumes it
  // (POST /api/ruta/auto/resume); «No, soy otro alumno» keeps this step on the phone only, and the next step asks for a
  // new account for this kid (`fresh`, sessionStorage draly_auto_notme). One account per page once found.
  const S = { result: null, busy: null, refused: {}, asked: false };
  const NOTME = 'draly_auto_notme';
  const ss = {
    get(k) { try { return sessionStorage.getItem(k) || ''; } catch (_) { return ''; } },
    set(k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (_) {} },
  };
  // opts.afterRound: an El Entrenamiento round is starting: a «¿Eres tú?» waits until it is over
  function ensure(level, step, id, opts) {
    if (S.result) return Promise.resolve(S.result);
    if (S.busy) return S.busy;
    if (S.refused[step + ':' + level]) return Promise.resolve(null);   // (no key here, a teacher… : not again on this page)
    S.busy = firstStep(level, step, id, opts || {}).then((r) => {
      S.busy = null;
      if (r && (r.account || r.relogged)) S.result = r;
      return r;
    }, () => { S.busy = null; return null; });
    return S.busy;
  }
  function firstStep(level, step, id, opts) {
    // 1) a phone that remembers a /homework login (the class code + the kid's code), unless that kid tapped «Salir»: that
    //    kid, again (the key screen does the same): their step lands on their real account, never on a new one
    const ac = ls.get('dralyHwAccessCode'), sc = ls.get('dralyStudentCode');
    const relog = ls.get('dralyHwOut') !== '1' && ac && sc && sc !== readMine().code
      ? post('/api/level-access/session', { accessCode: ac, studentCode: sc }).then(({ d }) => (d && d.ok && d.kind === 'student' ? { relogged: true, account: null } : null))
      : Promise.resolve(null);
    return relog.then((r) => {
      if (r) return r;
      // 2) the automatic account (the server says no to a teacher, a page from elsewhere, too many at once)
      const fresh = !!ss.get(NOTME);
      return post('/api/ruta/auto', { level, step, id: id || undefined, fresh: fresh || undefined }).then(({ d }) => {
        if (d && d.ok === false && d.why === 'parked' && d.account) return parked(d.account, opts);
        if (!d || !d.ok || !d.account) {
          if (d && d.why && d.why !== 'rate') S.refused[step + ':' + level] = true;
          return null;
        }
        if (d.created) ss.set(NOTME, '');
        remember(d.account);
        return { account: d.account, created: !!d.created, resumed: !!d.resumed };
      });
    });
  }
  // this phone's parked account: «¿Eres tú?» once per page
  function parked(acc, opts) {
    if (S.asked) return null;
    S.asked = true;
    return api.askParked(acc, opts).then((a) => {
      if (a === 'other') { ss.set(NOTME, acc.code); return null; }
      if (a !== 'me') return null;
      return post('/api/ruta/auto/resume', {}).then(({ d }) => {
        if (!d || !d.ok || !d.account) return null;
        remember(d.account);
        return { account: d.account, resumed: true };
      });
    });
  }

  // ── the sheet (the first card, «Mi código») ───────────────────────
  let open = null;
  function close(sheet) {
    const s = sheet || open;
    if (!s) return;
    if (open === s) open = null;
    document.removeEventListener('keydown', s._esc, true);
    s.remove();
    document.documentElement.classList.remove('ra-lock');
    if (s._back && s._back.focus) { try { s._back.focus({ preventScroll: true }); } catch (_) {} }
  }
  function copyText(text, btn, done) {
    const ok = () => { if (btn) { const was = btn.innerHTML; btn.innerHTML = I.check + '<span>' + esc(done || '¡Copiado!') + '</span>'; setTimeout(() => { btn.innerHTML = was; }, 1800); } };
    const fallback = () => {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; t.style.top = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (_) { /* the code is on screen: the family writes it down */ }
      t.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  }
  // the code in big gold letters, spaced (a 4-letter code read aloud letter by letter)
  const codeHtml = (code) => '<p class="ra-code" aria-label="' + esc(String(code).split('').join(' ')) + '">' +
    String(code).split('').map((c) => '<span>' + esc(c) + '</span>').join('') + '</p>';
  function sheet(acc, kind, onSaved) {
    if (open) close(open);
    const first = kind === 'first';
    const named = acc.name && !acc.placeholder;
    const s = document.createElement('div');
    s.className = 'ra-root ra-sheet';
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-modal', 'true');
    s.setAttribute('aria-labelledby', 'ra-t');
    s._back = document.activeElement;
    s.innerHTML = '<div class="ra-card' + (first ? ' is-first' : '') + '">' +
      '<button type="button" class="ra-x" data-close aria-label="Cerrar">' + I.close + '</button>' +
      '<img class="ra-dragon" src="/assets/dralingo/' + (first ? 'power' : 'hello') + '.webp" alt="" width="200" height="222" decoding="async">' +
      (first
        ? '<h2 class="ra-t" id="ra-t">¡Ya tienes tu cuenta de Dralingo!</h2><p class="ra-lede">Tu código es:</p>'
        : '<h2 class="ra-t" id="ra-t">Mi código</h2><p class="ra-lede">' + (named ? esc(acc.name) + ', tu código es:' : 'Tu código de alumno es:') + '</p>') +
      codeHtml(acc.code) +
      '<p class="ra-note">' + (first ? 'Anótalo en tu cuaderno. Este teléfono lo recuerda y guarda tu progreso.' : 'Anótalo en tu cuaderno. Con él tu profe encuentra tu progreso.') + '</p>' +
      '<button type="button" class="ra-btn ra-btn-gold" data-copy>' + I.copy + '<span>Copiar mi código</span></button>' +
      '<form class="ra-name" novalidate>' +
        '<label class="ra-label" for="ra-name">' + (named ? 'Tu nombre' : '¿Cómo te llamas?') + (first ? ' <span>(si quieres)</span>' : '') + '</label>' +
        '<div class="ra-row"><input id="ra-name" class="ra-input" type="text" autocomplete="given-name" maxlength="24" enterkeyhint="done" placeholder="Escribe tu nombre" value="' + (named ? esc(acc.name) : '') + '">' +
        '<button type="submit" class="ra-btn ra-btn-red">Guardar</button></div>' +
        '<p class="ra-err" aria-live="polite"></p>' +
      '</form>' +
      '<button type="button" class="ra-btn ra-btn-soft" data-close>' + (first ? 'Ahora no' : 'Cerrar') + '</button>' +
    '</div>';
    document.body.appendChild(s);
    document.documentElement.classList.add('ra-lock');
    open = s;
    s._esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(s); } };
    document.addEventListener('keydown', s._esc, true);
    s.addEventListener('click', (e) => {
      if (e.target === s || e.target.closest('[data-close]')) { close(s); return; }
      const c = e.target.closest('[data-copy]');
      if (c) copyText(acc.code, c, '¡Copiado!');
    });
    const form = s.querySelector('form');
    const input = s.querySelector('#ra-name');
    const err = s.querySelector('.ra-err');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) { err.textContent = 'Escribe tu nombre.'; input.focus(); return; }
      const b = form.querySelector('button');
      b.disabled = true;
      err.textContent = '';
      post('/api/ruta/me/name', { name: v }).then(({ d }) => {
        b.disabled = false;
        if (!d || !d.ok) { err.textContent = (d && d.error) || 'No se pudo guardar. Revisa tu internet.'; return; }
        acc.name = d.account.name; acc.placeholder = false;
        err.textContent = '';
        form.querySelector('.ra-label').textContent = 'Tu nombre';
        b.innerHTML = I.check + '<span>¡Guardado!</span>';
        setTimeout(() => { b.textContent = 'Guardar'; }, 1800);
        if (onSaved) onSaved(d.account);
      });
    });
    const enter = s.querySelector('.ra-card');
    if (enter.animate && !calm()) {
      try { enter.animate([{ opacity: 0, transform: 'translateY(24px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.23, 1, .32, 1)' }); } catch (_) {}
    }
    // (the title takes the focus: a screen reader hears it, a keyboard tabs on to «Copiar»)
    setTimeout(() => { const f = s.querySelector('#ra-t'); if (f) { f.tabIndex = -1; try { f.focus({ preventScroll: true }); } catch (_) {} } }, 40);
    return s;
  }

  // ── the first card, once per account on this phone ────────────────
  const clearNewCookie = () => { document.cookie = 'draly_auto_new=; Path=/; Max-Age=0; SameSite=Lax'; };
  const hasNewCookie = () => /(?:^|;\s*)draly_auto_new=1/.test(document.cookie || '');
  function welcome(acc, opts) {
    if (!acc || !acc.code || !acc.auto) return;
    const o = readMine();
    if (o.code === acc.code && o.seen) { clearNewCookie(); return; }
    const show = () => {
      clearNewCookie();
      const m = readMine();
      m.code = acc.code; m.seen = 1;
      writeMine(m);
      sheet(acc, 'first', opts && opts.onSaved);
    };
    whenFree(show, opts && opts.afterRound);
  }
  // never over a training round: `fn` waits until the round is over (its star screen or the worlds' page). afterRound:
  // the round is about to start (the «¡A jugar!» tap): wait for it to begin, then to end (15 s at most for a round that
  // never started)
  function whenFree(fn, afterRound) {
    const busy = () => document.body.classList.contains('au-is-play');
    let seenPlay = busy();
    if (!seenPlay && !afterRound) { fn(); return; }
    let t = 0;
    const mo = new MutationObserver(() => {
      if (busy()) { seenPlay = true; return; }
      if (seenPlay) { mo.disconnect(); clearTimeout(t); setTimeout(fn, 600); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    if (!seenPlay) t = setTimeout(() => { if (!seenPlay) { mo.disconnect(); fn(); } }, 15000);
  }
  // «¿Eres tú?» over La Ruta Dorada for this phone's PARKED automatic account (after «Salir» or another kid's login,
  // security review M2): the same card as the /homework one, in a sheet → Promise<'me' | 'other' | null (closed)>
  function askParked(acc, opts) {
    return new Promise((resolve) => {
      whenFree(() => {
        if (open) close(open);
        const s = document.createElement('div');
        s.className = 'ra-root ra-sheet';
        s.setAttribute('role', 'dialog');
        s.setAttribute('aria-modal', 'true');
        s.setAttribute('aria-labelledby', 'ra-eres-t');
        s._back = document.activeElement;
        s.innerHTML = '<div class="ra-card is-ask"><button type="button" class="ra-x" data-close aria-label="Cerrar">' + I.close + '</button>' +
          '<img class="ra-dragon" src="/assets/dralingo/wise.webp" alt="" width="200" height="222" decoding="async"><div data-mount></div></div>';
        document.body.appendChild(s);
        document.documentElement.classList.add('ra-lock');
        open = s;
        let done = false;
        const finish = (v) => { if (done) return; done = true; close(s); resolve(v); };
        s._esc = (e) => { if (e.key === 'Escape') { e.preventDefault(); finish(null); } };
        document.addEventListener('keydown', s._esc, true);
        s.addEventListener('click', (e) => { if (e.target === s || e.target.closest('[data-close]')) finish(null); });
        eresTu(s.querySelector('[data-mount]'), acc, {}).then((a) => finish(a));
      }, opts && opts.afterRound);
    });
  }
  function afterRoute(ruta) {
    if (!ruta || !ruta.me || !ruta.me.auto) return;
    remember(ruta.me);
    if (hasNewCookie()) welcome(ruta.me);
  }

  // ── the phone's account, «¿Eres tú?», the merge ───────────────────
  function me() {
    return fetch('/api/ruta/me', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null), () => null).then((d) => (d && d.ok ? d.account : null));
  }
  // «Este teléfono ya tiene un alumno: Ana · código K7P2 · 120 sellos · 2 tareas mandadas. ¿Eres tú?»
  // opts.merge: also offer «Pasar mi progreso a esta cuenta» (the typed code is a code, the phone's account is automatic)
  function eresTu(mount, acc, opts) {
    return new Promise((resolve) => {
      const p = acc.progress || {};
      const bits = [];
      if (p.seals) bits.push(p.seals + (p.seals === 1 ? ' sello' : ' sellos'));
      if (p.sent) bits.push(p.sent + (p.sent === 1 ? ' tarea mandada' : ' tareas mandadas'));
      else if (p.heard) bits.push(p.heard + (p.heard === 1 ? ' tarea escuchada' : ' tareas escuchadas'));
      if (p.worlds) bits.push(p.worlds + (p.worlds === 1 ? ' mundo practicado' : ' mundos practicados'));
      if (!bits.length && p.homework) bits.push(p.homework + (p.homework === 1 ? ' tarea hecha' : ' tareas hechas'));
      const box = document.createElement('div');
      box.className = 'ra-root ra-eres';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-labelledby', 'ra-eres-t');
      box.innerHTML = '<p class="ra-eres-k">Este teléfono ya tiene un alumno</p>' +
        '<p class="ra-eres-who" id="ra-eres-t"><b>' + esc(acc.name || 'Tu cuenta') + '</b><span>código ' + esc(acc.code) + '</span></p>' +
        (bits.length ? '<p class="ra-eres-p">' + esc(bits.join(' · ')) + '</p>' : '') +
        '<p class="ra-eres-q">¿Eres tú?</p>' +
        '<button type="button" class="ra-btn ra-btn-gold" data-a="me">Sí, soy yo</button>' +
        (opts && opts.merge ? '<button type="button" class="ra-btn ra-btn-red" data-a="merge">Pasar mi progreso a esta cuenta</button>' : '') +
        '<button type="button" class="ra-btn ra-btn-soft" data-a="other">No, soy otro alumno</button>';
      mount.innerHTML = '';
      mount.appendChild(box);
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]');
        if (!b) return;
        box.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        resolve(b.getAttribute('data-a'));
      });
      setTimeout(() => { const f = box.querySelector('[data-a="me"]'); if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} } }, 30);
    });
  }
  function merge() {
    return post('/api/ruta/auto/merge', {}).then(({ d }) => {
      if (d && d.ok) { const o = readMine(); delete o.code; delete o.seen; writeMine(o); }
      return d;
    });
  }

  // a short line at the bottom of the screen (never blocking), e.g. after the merge
  function toast(text) {
    const t = document.createElement('div');
    t.className = 'ra-root ra-toast';
    t.setAttribute('role', 'status');
    t.innerHTML = I.check + '<span>' + esc(text) + '</span>';
    document.body.appendChild(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 260); }, 3600);
  }

  // (one object: ensure() asks api.askParked, so a test can stand in for the card)
  const api = { ensure, welcome, afterRoute, codeSheet: (acc, onSaved) => sheet(acc, 'code', onSaved), me, eresTu, askParked, merge, remember, copyText, toast, close: () => close(open) };
  window.DralyAuto = api;
})();
