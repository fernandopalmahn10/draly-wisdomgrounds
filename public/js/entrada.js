// =========================================================================
// entrada.js · «Mi Dralingo», la entrada (his pick 2026-10-18: "the level key is the family's one password"; his approved
// design «Entrada», kidhome-design/Entrada.dc.html + ASSETS.md). Part 1 of the new kid home: the door of /homework.
// =========================================================================
//   hola    this phone remembers a kid: their avatar beside Dralingo, «¡Hola de nuevo!», name and level, one big «¡Vamos!»
//           and «¿No eres tú?». Nothing to type. Remembered = the server's answer (GET /api/entrada/hola: a session, the
//           phone's `dkid`, a named automatic account) or the OLD saved class code + student code (localStorage, today's
//           families: POST /api/entrada/hola checks them; «¡Vamos!» logs in with them exactly as the old card did)
//   quien   «Ya tengo mi código» (Adric) · «Soy nuevo» (Aileen) · the transitional door
//   clave   the level key from the teacher's WhatsApp (Profe Fer says where it is) → POST /api/entrada/clave
//   nivel   «¡Tu nivel es New HSK 1!» (the level's wonder, Dralingo's thumbs up), «¿Cómo te llamas?», the saga avatars,
//           «Crear mi cuenta» → POST /api/entrada/crear (a phone holding an automatic account makes THAT one the kid's)
//   codigo  the six-character code in gold tiles, «anótalo», «Copiar mi código», «¡Vamos!»
//   tengo   the student code AND the level key → POST /api/entrada/entrar (one uniform answer when they don't match)
//   eres    «¿Eres tú?» for this phone's parked account (after «Salir») before «Soy nuevo» (js/ruta-auto.js draws it)
//   door    ⏳ TRANSITIONAL: «¿Tu profe te dio un código de 4 números? Entra aquí» = the old class code + student code card
//           (homework.html's .hw-entry-card + homework.js tryEnter), for families without their key yet; he removes it once
//           every family has its key
// «¡Vamos!» goes to today's portal home (homework.js DralyHw.enterWith; part 3 replaces the home). Every state has a way
// back; the English toggle translates every line (hw-i18n.js); never a real code as a placeholder (dots and words).
// Also here: «¿Salir de tu cuenta en este teléfono?» (DralyEntrada.confirmOut, homework.js «Salir») and «Abrir otro nivel»
// in Ajustes (POST /api/entrada/nivel). No hanzi, no em dash.
// =========================================================================
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const scr = $('screen-entry');
  const root = $('en-root');
  if (!scr || !root) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
  };
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const post = (url, body) => fetch(url, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then((r) => r.json().catch(() => null).then((d) => ({ status: r.status, d })), () => ({ status: 0, d: null }));
  const getJ = (url) => fetch(url, { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => r.json().catch(() => null).then((d) => ({ status: r.status, d })), () => ({ status: 0, d: null }));
  const NET = 'Revisa tu internet y vuelve a intentarlo.';

  // the design's pictures (ASSETS.md)
  const ART = {
    hello: '/assets/dralingo/anim/hello-still.webp', helloAnim: '/assets/dralingo/anim/hello.webp',
    thumbs: '/assets/dralingo/thumbsup.webp', victory: '/assets/halcon/cast/dralingo-victory.webp',
    adric: '/assets/cast/adric-hello.webp', aileen: '/assets/cast/aileen-hello.webp', fer: '/assets/cast/fer-hello.webp',
  };
  // each level's wonder, like La Ruta Dorada's module page (js/ruta.js WONDERS)
  const WONDER = { yct: { src: '/assets/paint/dubai/bg.webp', pos: '50% 80%' }, newhsk: { src: '/assets/paint/rio/bg.webp', pos: '50% 62%' }, hsk: { src: '/assets/paint/muralla/bg.webp', pos: '50% 58%' } };
  const I = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="#1f6b45" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const avatarUrl = (id) => (window.Saga && window.Saga.avatarUrl(id || 'dralingo')) || '/assets/saga/avatars/dralingo.webp';
  const AVATARS = ((window.Saga && window.Saga.AVATARS) || []).map((a) => ({ id: a.id, label: String(a.label || a.id).replace(/^[^A-Za-zÀ-ÿ]+/, '').trim() || a.id }));

  // ── state ─────────────────────────────────────────────────────────
  // answer: what «Soy nuevo» sends about this phone's automatic account ('resume' = «Sí, soy yo», 'fresh' = «¿No eres
  // tú?» / «No, soy otro alumno»: a new account, that one untouched; security review F1) · ask: the account «¿Eres tú?»
  // is about · relock: the phone remembers the kid but their level's key changed since (type the new key, F2)
  const S = {
    step: 'load', hola: null, kid: null, oldCodes: null, key: '', lvl: null, name: '', avatar: null, account: null,
    busy: false, ask: null, answer: null, prefill: '', keyTyped: '', user: false, relock: false,
  };
  const BACK = { quien: () => (S.relock ? 'llave' : (S.kid ? 'hola' : 'home')), clave: 'quien', nivel: 'clave', codigo: 'hola', tengo: 'quien', eres: 'quien', door: 'quien' };
  const backOf = (step) => { const b = BACK[step]; return typeof b === 'function' ? b() : (b || 'quien'); };
  const nextLine = () => { const n = $('hw-entry-next'); return n && !n.hidden ? n.textContent : ''; };

  function backBtn(step) {
    const to = backOf(step);
    if (to === 'home') return '<a class="en-back" href="/">' + I.back + '<span>Volver</span></a>';
    return '<button type="button" class="en-back" data-go="' + to + '">' + I.back + '<span>Volver</span></button>';
  }
  const DOOR = '<p class="en-doorline"><span>¿Tu profe te dio un código de 4 números?</span><button type="button" class="en-link" data-go="door">Entra aquí</button></p>';
  const brand = '<p class="en-brand">Mi Dralingo</p>';

  // ── the states ────────────────────────────────────────────────────
  function viewLoad() {
    return '<div class="en-wrap is-load">' + brand + '<img class="en-load-dr" src="' + ART.hello + '" alt="" width="140" height="157"></div>';
  }
  function holaHero() {
    const k = S.kid || {};
    const lvl = k.levelName ? k.levelName + (k.exp && k.exp.n ? ' · Experiencia ' + k.exp.n : '') : '';
    return '<section class="en-hola" aria-labelledby="en-h">' + brand +
        '<div class="en-hola-stage">' +
          '<img class="en-hola-av en-pop" src="' + esc(avatarUrl(k.avatar)) + '" alt="Tu avatar" width="152" height="152">' +
          '<img class="en-hola-dr" id="en-hola-dr" src="' + ART.hello + '" alt="Dralingo te saluda" width="160" height="212">' +
        '</div>' +
        '<h1 class="en-hola-t" id="en-h" tabindex="-1">¡Hola de nuevo!</h1>' +
        (k.name ? '<p class="en-hola-name">' + esc(k.name) + '</p>' : '') +
        (lvl ? '<p class="en-pill">' + esc(lvl) + '</p>' : '') +
      '</section>' +
      (nextLine() ? '<p class="en-next">' + esc(nextLine()) + '</p>' : '');
  }
  // 🔒 2026-10-18 (security review F2): the phone remembers the kid, but their level's key changed since («Cambiar» +
  // «Cerrar en todos los aparatos»): the new key only, nothing else to type (POST /api/entrada/reabrir)
  function viewLlave() {
    return '<div class="en-wrap is-llave">' + holaHero() +
      '<div class="en-hola-go">' +
        '<form class="en-form en-relock" data-form="reabrir" novalidate>' +
          '<p class="en-hola-note">Este teléfono te recuerda: escribe la clave nueva de tu nivel.</p>' +
          '<label class="en-label" for="en-key3">La clave nueva</label>' +
          '<input id="en-key3" class="en-in en-in-key" type="text" placeholder="••••-••" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" maxlength="30">' +
          '<p class="en-err" role="alert"></p>' +
          '<button type="submit" class="en-btn en-btn-red en-btn-xl"><span>Entrar</span>' + I.go + '</button>' +
        '</form>' +
        '<button type="button" class="en-btn en-btn-soft" data-go="quien">¿No eres tú?</button>' +
      '</div></div>';
  }
  function viewHola() {
    return '<div class="en-wrap is-hola">' + holaHero() +
      '<div class="en-hola-go">' +
        '<button type="button" class="en-btn en-btn-red en-btn-xl" data-act="vamos"><span>¡Vamos!</span>' + I.go + '</button>' +
        '<p class="en-hola-note">Este teléfono te recuerda: no tienes que escribir nada.</p>' +
        '<p class="en-err" role="alert"></p>' +
        '<button type="button" class="en-btn en-btn-soft" data-go="quien">¿No eres tú?</button>' +
      '</div></div>';
  }
  function card(step, inner) {
    return '<div class="en-wrap is-' + step + '">' + brand + (nextLine() ? '<p class="en-next">' + esc(nextLine()) + '</p>' : '') +
      '<div class="en-card">' + backBtn(step) + inner + '</div></div>';
  }
  function viewQuien() {
    return card('quien',
      '<h1 class="en-h" id="en-h" tabindex="-1">¿Quién eres?</h1>' +
      '<button type="button" class="en-opt" data-act="tengo"><img src="' + ART.adric + '" alt="" width="58" height="66"><span><b>Ya tengo mi código</b><small>El que anoté en mi cuaderno</small></span></button>' +
      '<button type="button" class="en-opt en-opt-gold" data-act="nuevo"><img src="' + ART.aileen + '" alt="" width="58" height="66"><span><b>Soy nuevo</b><small>Solo necesito la clave de mi nivel</small></span></button>' +
      DOOR);
  }
  function viewEres() {
    // (F4: a kid of the key is shown by name and avatar, never their code: the next person on a shared phone)
    const a = S.ask || {};
    return card('eres', '<h1 class="en-h" id="en-h" tabindex="-1">Antes de seguir</h1>' +
      (a.kind === 'key' ? '<img class="en-eres-av" src="' + esc(avatarUrl(a.avatar)) + '" alt="" width="76" height="76">' : '') +
      '<div class="en-mount" id="en-mount"></div>');
  }
  function levelList() {
    const names = (S.hola && S.hola.levels) || [];
    if (names.length < 2) return '';
    return 'La clave dice tu nivel: ' + names.slice(0, -1).join(', ') + ' o ' + names[names.length - 1] + '.';
  }
  function viewClave() {
    const ll = levelList();
    return card('clave',
      '<h1 class="en-h" id="en-h" tabindex="-1">Escribe la clave de tu nivel</h1>' +
      '<div class="en-say"><img src="' + ART.fer + '" alt="" width="56" height="66"><p class="en-bubble"><span>Está en el mensaje de WhatsApp de tu profe.</span>' + (ll ? ' <span>' + esc(ll) + '</span>' : '') + '</p></div>' +
      '<form class="en-form" data-form="clave" novalidate>' +
        '<label class="en-label" for="en-key">La clave</label>' +
        '<input id="en-key" class="en-in en-in-key" type="text" placeholder="••••-••" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" maxlength="30" value="' + esc(S.keyTyped) + '">' +
        '<p class="en-err" role="alert"></p>' +
        '<button type="submit" class="en-btn en-btn-red">Seguir</button>' +
      '</form>');
  }
  function viewNivel() {
    const l = S.lvl || {};
    const w = WONDER[l.family] || WONDER.newhsk;
    const avs = AVATARS.map((a) => '<button type="button" class="en-av" role="radio" aria-checked="' + (S.avatar === a.id) + '" data-av="' + esc(a.id) + '" aria-label="' + esc(a.label) + '">' +
      '<img src="' + esc(avatarUrl(a.id)) + '" alt="" width="54" height="54" loading="lazy"></button>').join('');
    return card('nivel',
      '<div class="en-level is-' + esc(l.family || 'newhsk') + '">' +
        '<img class="en-level-bg" src="' + w.src + '" alt="" style="object-position:' + w.pos + '">' +
        '<p class="en-level-txt"><span class="en-level-k">¡Tu nivel es</span><span class="en-level-n" id="en-h" tabindex="-1">' + esc(l.levelName || '') + '!</span></p>' +
        '<img class="en-level-dr" src="' + ART.thumbs + '" alt="" width="98" height="112">' +
      '</div>' +
      '<form class="en-form" data-form="crear" novalidate>' +
        '<label class="en-label" for="en-name">¿Cómo te llamas?</label>' +
        '<input id="en-name" class="en-in" type="text" placeholder="Tu nombre" autocomplete="given-name" enterkeyhint="done" maxlength="24" value="' + esc(S.name) + '">' +
        '<p class="en-label" id="en-av-l">Elige tu avatar</p>' +
        '<div class="en-avs" role="radiogroup" aria-labelledby="en-av-l">' + avs + '</div>' +
        '<p class="en-err" role="alert"></p>' +
        '<button type="submit" class="en-btn en-btn-red">Crear mi cuenta</button>' +
      '</form>');
  }
  function viewCodigo() {
    const c = String((S.account && S.account.code) || '');
    return card('codigo',
      '<div class="en-done"><img src="' + ART.victory + '" alt="" width="84" height="92"><h1 class="en-h" id="en-h" tabindex="-1">¡Ya tienes tu cuenta!</h1></div>' +
      '<p class="en-label">Tu código de alumno es:</p>' +
      '<p class="en-code" style="--n:' + Math.max(4, c.length) + '" aria-label="' + esc(c.split('').join(' ')) + '">' + c.split('').map((x) => '<span>' + esc(x) + '</span>').join('') + '</p>' +
      '<p class="en-note">Anótalo en tu cuaderno. Este teléfono ya lo recuerda; en otro teléfono te pedimos tu código y la clave de tu nivel.</p>' +
      '<button type="button" class="en-btn en-btn-light" data-act="copy">' + I.copy + '<span>Copiar mi código</span></button>' +
      '<p class="en-err" role="alert"></p>' +
      '<button type="button" class="en-btn en-btn-red" data-act="vamos"><span>¡Vamos!</span>' + I.go + '</button>');
  }
  function viewTengo() {
    return card('tengo',
      '<h1 class="en-h" id="en-h" tabindex="-1">Entra con tu código</h1>' +
      '<form class="en-form" data-form="entrar" novalidate>' +
        '<label class="en-label" for="en-code">Tu código de alumno</label>' +
        '<input id="en-code" class="en-in en-in-key" type="text" placeholder="El de tu cuaderno" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="next" maxlength="8" value="' + esc(S.prefill) + '">' +
        '<label class="en-label" for="en-key2">La clave de tu nivel</label>' +
        '<input id="en-key2" class="en-in en-in-key" type="text" placeholder="El del mensaje de tu profe" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" maxlength="30">' +
        '<p class="en-err" role="alert"></p>' +
        '<button type="submit" class="en-btn en-btn-red">Entrar</button>' +
      '</form>' +
      '<p class="en-lock">' + I.lock + '<span>En un teléfono nuevo pedimos las dos: así nadie entra solo con tu código. Tu progreso te espera completo.</span></p>' +
      DOOR);
  }
  function viewDoor() {
    return '<button type="button" class="en-fixed-back" data-go="quien">' + I.back + '<span>Volver</span></button>';
  }
  const VIEWS = { load: viewLoad, hola: viewHola, llave: viewLlave, quien: viewQuien, eres: viewEres, clave: viewClave, nivel: viewNivel, codigo: viewCodigo, tengo: viewTengo, door: viewDoor };

  // ── showing a state ───────────────────────────────────────────────
  let helloTimer = 0;
  function go(step, opts) {
    if (step === 'home') { location.href = '/'; return; }
    S.step = step;
    S.busy = false;
    root.innerHTML = VIEWS[step]();
    if (step === 'hola' || step === 'llave') S.answer = null;   // (back on the kid this phone remembers: nothing answered yet)
    ['load', 'hola', 'llave', 'quien', 'eres', 'clave', 'nivel', 'codigo', 'tengo'].forEach((s) => scr.classList.toggle('is-' + s, s === step));
    scr.classList.toggle('en-door', step === 'door');
    const box = root.firstElementChild;
    if (box && !calm() && step !== 'load' && step !== 'door') { box.classList.add('en-in-anim'); }
    if (step === 'door') {
      // the old card, as it always was (its boxes hold the phone's saved codes; a kid of the level key keeps no class
      // code on the phone, and their code never opens at this door: an empty box then)
      const err = $('hw-entry-err');
      if (err && !(opts && opts.keepErr)) err.textContent = '';
      const sc = $('hw-student-code');
      if (sc && !ls.get('dralyHwAccessCode') && sc.value === ls.get('dralyStudentCode')) sc.value = '';
    }
    if (step === 'hola' || step === 'llave') wakeHello();
    if (step === 'eres') mountEres();
    // the focus follows a tap (a screen reader hears the new title; a phone opens its keyboard on the box to type)
    if (S.user) {
      const f = step === 'clave' ? $('en-key') : step === 'llave' ? $('en-key3') : step === 'tengo' ? (S.prefill ? $('en-key2') : $('en-code')) : step === 'door' ? $('hw-access-code') : $('en-h');
      if (f) { try { f.focus({ preventScroll: step === 'hola' }); } catch (_) {} }
    }
    if (step !== 'hola' && step !== 'llave') window.scrollTo(0, 0);
  }
  // Dralingo waves for real once the page has loaded (the still first: a whole class may open the page at once)
  function wakeHello() {
    clearTimeout(helloTimer);
    if (calm()) return;
    helloTimer = setTimeout(() => {
      const dr = $('en-hola-dr');
      if (!dr || document.hidden || scr.classList.contains('hidden')) return;
      const im = new Image();
      im.onload = () => { const d = $('en-hola-dr'); if (d) d.src = im.src; };
      im.src = ART.helloAnim;
    }, document.readyState === 'complete' ? 1200 : 2200);
  }
  const errBox = () => root.querySelector('.en-err');
  function showErr(text, field) {
    const b = errBox();
    if (b) b.textContent = text || '';
    root.querySelectorAll('.en-in').forEach((x) => x.removeAttribute('aria-invalid'));
    if (field) { field.setAttribute('aria-invalid', 'true'); try { field.focus(); } catch (_) {} }
  }
  function busy(btn, on) {
    S.busy = !!on;
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('en-busy', !!on);
  }

  // ── doors into the portal ─────────────────────────────────────────
  function enter(d) {
    if (window.DralyHw && window.DralyHw.enterWith) window.DralyHw.enterWith(d);
  }
  // «¡Vamos!»: the remembered kid (or the account just made) → today's portal home
  function vamos(btn) {
    if (S.busy) return;
    const k = S.kid;
    if (k && k.how === 'codes' && S.oldCodes && window.DralyHw) {
      // today's families: the old card's «Entrar» with the codes this phone saved, exactly as before
      const ac = $('hw-access-code'), sc = $('hw-student-code');
      if (ac) ac.value = S.oldCodes.ac;
      if (sc) sc.value = S.oldCodes.sc;
      const auto = S.hola && S.hola.auto;
      if (auto && auto.progress && auto.progress.any) { go('door'); window.DralyHw.tryOld(); return; }   // «¿Eres tú?» + «Pasar mi progreso» there
      busy(btn, true);
      Promise.resolve(window.DralyHw.tryOld({ eres: true })).then((d) => {
        busy(btn, false);
        if (!d || !d.ok) go('door', { keepErr: true });   // what the old card says, with its boxes
      });
      return;
    }
    busy(btn, true);
    post('/api/entrada/vamos', {}).then(({ status, d }) => {
      busy(btn, false);
      if (d && d.ok) { enter(d); return; }
      if (status === 401) { S.kid = null; S.user = true; go('quien'); return; }
      showErr((d && d.error) || NET);
    });
  }
  // «Soy nuevo» (security review F1): after «¿No eres tú?» it is always a new account; otherwise this phone's account with
  // progress (parked after «Salir», or an automatic one) asks «¿Eres tú?» first; the server asks too when it must
  function nuevo() {
    if (S.answer) { go('clave'); return; }
    const h = S.hola || {};
    const has = (x) => !!(x && x.progress && x.progress.any);
    const p = has(h.parked) ? h.parked : (has(h.auto) ? Object.assign({ kind: 'auto' }, h.auto) : null);
    if (p) { S.ask = p; go('eres'); return; }
    go('clave');
  }
  // «¿Eres tú?» for this phone's account (js/ruta-auto.js's card). A kid of the key: name + avatar only, never the code
  // (F4); «Sí, soy yo» = their code (typed: the box stays empty) + the key
  function mountEres() {
    const m = $('en-mount');
    const p = S.ask;
    if (!m || !p || !window.DralyAuto || !window.DralyAuto.eresTu) { go('clave'); return; }
    window.DralyAuto.eresTu(m, { code: p.kind === 'auto' ? p.code : '', name: p.name || 'Tu cuenta', progress: p.progress || {} }, {}).then((a) => {
      S.user = true;
      if (p.kind === 'key') {
        if (a === 'me') { S.prefill = ''; go('tengo'); return; }      // their own account: their code + the key
        S.answer = 'fresh'; go('clave'); return;
      }
      S.answer = a === 'me' ? 'resume' : 'fresh';                       // an automatic account: «Soy nuevo» makes it theirs, or a new one
      if (S.lvl && S.key) { go('nivel'); return; }
      go('clave');
    });
  }

  // ── the forms ─────────────────────────────────────────────────────
  function submitClave(form) {
    const input = $('en-key');
    const key = (input.value || '').trim();
    S.keyTyped = key;
    if (!key) { showErr('Escribe la clave de tu nivel.', input); return; }
    const btn = form.querySelector('[type="submit"]');
    busy(btn, true);
    post('/api/entrada/clave', { key }).then(({ d }) => {
      busy(btn, false);
      if (d && d.ok) { S.key = key; S.lvl = d; go('nivel'); return; }
      showErr((d && d.error) || NET, input);
    });
  }
  function submitCrear(form) {
    const input = $('en-name');
    const name = (input.value || '').trim();
    S.name = name;
    if (!name) { showErr('Escribe tu nombre.', input); return; }
    if (!S.avatar) { showErr('Elige tu avatar.'); const a = root.querySelector('.en-av'); if (a) a.focus(); return; }
    const btn = form.querySelector('[type="submit"]');
    busy(btn, true);
    const body = { key: S.key, name, avatar: S.avatar };
    if (S.answer === 'resume') body.resume = true;
    if (S.answer === 'fresh') body.fresh = true;
    post('/api/entrada/crear', body).then(({ status, d }) => {
      busy(btn, false);
      if (d && d.ok && d.account) {
        S.account = d.account;
        S.kid = { name: d.account.name, avatar: d.account.avatar, levelName: d.account.levelName, level: d.account.level, how: 'device' };
        S.oldCodes = null;
        ls.del('dralyHwOut');
        ls.set('dralyStudentCode', d.account.code);
        ls.del('dralyHwAccessCode');
        go('codigo');
        return;
      }
      if (d && d.why === 'parked' && d.account) { S.ask = d.account; go('eres'); return; }
      if (d && d.why === 'key') { S.key = ''; go('clave'); showErr(d.error || NET, $('en-key')); return; }
      showErr((d && d.error) || (status ? NET : NET), d && d.why === 'name' ? input : null);
    });
  }
  // (F2) the level's new key, on the phone that remembers the kid
  function submitReabrir(form) {
    const input = $('en-key3');
    const key = (input.value || '').trim();
    if (!key) { showErr('Escribe la clave nueva.', input); return; }
    const btn = form.querySelector('[type="submit"]');
    busy(btn, true);
    post('/api/entrada/reabrir', { key }).then(({ d }) => {
      busy(btn, false);
      if (d && d.ok) { ls.del('dralyHwOut'); S.relock = false; enter(d); return; }
      if (d && d.why === 'none') { S.kid = null; S.relock = false; go('quien'); return; }
      showErr((d && d.error) || NET, input);
    });
  }
  function submitEntrar(form) {
    const ci = $('en-code'), ki = $('en-key2');
    const code = String(ci.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const key = (ki.value || '').trim();
    if (!code) { showErr('Escribe tu código de alumno.', ci); return; }
    if (!key) { showErr('Escribe la clave de tu nivel.', ki); return; }
    const btn = form.querySelector('[type="submit"]');
    busy(btn, true);
    post('/api/entrada/entrar', { code, key }).then(({ d }) => {
      busy(btn, false);
      if (d && d.ok) { ls.del('dralyHwOut'); enter(d); return; }
      showErr((d && d.error) || NET);
    });
  }
  function copyCode(btn) {
    const code = String((S.account && S.account.code) || '');
    const done = () => {
      btn.classList.add('is-done');
      btn.innerHTML = I.check + '<span>¡Copiado!</span>';
      setTimeout(() => { if (btn.isConnected) { btn.classList.remove('is-done'); btn.innerHTML = I.copy + '<span>Copiar mi código</span>'; } }, 1800);
    };
    const fallback = () => {
      const t = document.createElement('textarea');
      t.value = code; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; t.style.top = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (_) { /* the code is on screen: they write it down */ }
      t.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(code).then(done, fallback); else fallback();
  }

  // ── events (one listener for every state) ─────────────────────────
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go],[data-act],[data-av]');
    if (!t || !root.contains(t)) return;
    S.user = true;
    if (t.hasAttribute('data-av')) {
      S.avatar = t.getAttribute('data-av');
      root.querySelectorAll('.en-av').forEach((b) => b.setAttribute('aria-checked', String(b === t)));
      const b = errBox(); if (b && /avatar/i.test(b.textContent)) b.textContent = '';
      return;
    }
    if (t.hasAttribute('data-go')) {
      const to = t.getAttribute('data-go');
      if (S.step === 'nivel') { const n = $('en-name'); if (n) S.name = n.value; }
      if (to === 'quien' && S.step === 'eres') S.answer = null;
      // «¿No eres tú?» (F1): whatever comes next is another kid: «Soy nuevo» makes a fresh account, never this one's
      if (to === 'quien' && (S.step === 'hola' || S.step === 'llave')) S.answer = 'fresh';
      go(to);
      return;
    }
    const act = t.getAttribute('data-act');
    if (act === 'vamos') vamos(t);
    else if (act === 'tengo') { S.prefill = ''; go('tengo'); }
    else if (act === 'nuevo') nuevo();
    else if (act === 'copy') copyCode(t);
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    S.user = true;
    if (S.busy) return;
    const k = f.getAttribute('data-form');
    if (k === 'clave') submitClave(f);
    else if (k === 'crear') submitCrear(f);
    else if (k === 'entrar') submitEntrar(f);
    else if (k === 'reabrir') submitReabrir(f);
  });
  root.addEventListener('input', (e) => {
    if (e.target.classList && e.target.classList.contains('en-in')) {
      e.target.removeAttribute('aria-invalid');
      const b = errBox(); if (b) b.textContent = '';
    }
  });
  // Esc = «Volver» on a card
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || scr.classList.contains('hidden') || document.querySelector('.en-sheet, .ra-sheet')) return;
    if (['quien', 'clave', 'nivel', 'tengo', 'eres', 'door'].includes(S.step)) { S.user = true; const to = backOf(S.step); go(to); }
  });

  // ── start: who is this phone? ─────────────────────────────────────
  function start() {
    scr.classList.add('en-on');
    root.hidden = false;
    S.user = false;
    go('load');
    getJ('/api/entrada/hola').then(({ d }) => {
      S.hola = d && d.ok ? d : { kid: null, auto: null, parked: null, levels: [] };
      if (S.hola.kid) { S.kid = S.hola.kid; go('hola'); return; }
      if (S.hola.relock) { S.kid = S.hola.relock; S.relock = true; go('llave'); return; }   // (F2) the level's key changed
      // today's families: the class code + student code this phone saved (never after «Salir»: a brother or sister)
      const ac = ls.get('dralyHwAccessCode'), sc = ls.get('dralyStudentCode');
      if (ls.get('dralyHwOut') !== '1' && ac && sc) {
        post('/api/entrada/hola', { accessCode: ac, studentCode: sc }).then(({ d: o }) => {
          if (o && o.ok && o.kid) { S.kid = o.kid; S.oldCodes = { ac, sc }; go('hola'); } else go('quien');
        });
        return;
      }
      go('quien');
    });
  }
  // the entry screen shown again with nobody logged in (homework.js: the avatar picker's «Volver»): ask the server again
  function restart() { S.kid = null; S.oldCodes = null; S.account = null; S.answer = null; S.ask = null; S.relock = false; start(); }

  // ── «¿Salir de tu cuenta en este teléfono?» (homework.js «Salir») ─────────────
  function confirmOut(keyMode) {
    return new Promise((resolve) => {
      const s = document.createElement('div');
      s.className = 'en-sheet';
      s.setAttribute('role', 'dialog');
      s.setAttribute('aria-modal', 'true');
      s.setAttribute('aria-labelledby', 'en-out-t');
      s.innerHTML = '<div class="en-sheet-card">' +
        '<p class="en-sheet-t" id="en-out-t">¿Salir de tu cuenta en este teléfono?</p>' +
        '<p class="en-sheet-p">' + (keyMode ? 'Tu progreso queda guardado. Para volver necesitas tu código y la clave de tu nivel.' : 'Tu progreso queda guardado. Tus códigos siguen en este teléfono.') + '</p>' +
        '<div class="en-sheet-row"><button type="button" class="en-btn en-btn-stay" data-a="0">No, quedarme</button>' +
        '<button type="button" class="en-btn en-btn-out" data-a="1">Sí, salir</button></div></div>';
      const back = document.activeElement;
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey, true);
        s.remove();
        if (!v && back && back.focus) { try { back.focus({ preventScroll: true }); } catch (_) {} }
        resolve(v);
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); finish(false); } };
      document.addEventListener('keydown', onKey, true);
      s.addEventListener('click', (e) => {
        if (e.target === s) { finish(false); return; }
        const b = e.target.closest('[data-a]');
        if (b) finish(b.getAttribute('data-a') === '1');
      });
      document.body.appendChild(s);
      setTimeout(() => { const f = s.querySelector('[data-a="0"]'); if (f) { try { f.focus({ preventScroll: true }); } catch (_) {} } }, 30);
    });
  }

  // ── «Abrir otro nivel» (Ajustes today, «Mi perfil» in part 3) ────
  (function levelInSettings() {
    const input = $('hw-settings-level-key'), btn = $('hw-settings-level-btn'), msg = $('hw-settings-level-msg');
    if (!input || !btn || !msg) return;
    const run = () => {
      const key = (input.value || '').trim();
      if (!key) { msg.textContent = 'Escribe la clave nueva.'; input.focus(); return; }
      btn.disabled = true;
      msg.textContent = 'Abriendo…';
      post('/api/entrada/nivel', { key }).then(({ d }) => {
        btn.disabled = false;
        if (!d || !d.ok) { msg.textContent = (d && d.error) || NET; return; }
        input.value = '';
        msg.textContent = '¡Listo! Ya tienes ' + d.levelName + '.';
        if (!d.moved) return;
        // the home takes the new level (its tareas, La Ruta Dorada, its words)
        setTimeout(() => post('/api/entrada/vamos', {}).then(({ d: e }) => { if (e && e.ok) enter(e); }), 1200);
      });
    };
    btn.addEventListener('click', run);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  })();

  window.DralyEntrada = { start, restart, vamos: () => vamos(null), confirmOut, go: (s) => go(s) };
  start();
})();
