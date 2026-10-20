// Las Trampillas — the kid's phone (the product). player.js calls TrapdoorPhone.init(…) once; the shared phone skin
// (player-kingdoms-skin.js) gives the lobby look, the captains under the 3-2-1, the music, the pause card, «¡FINAL!» and
// the Mario Party ending. This module, only while the room's game is 'trapdoor':
//   · THE PLATFORM (js/trapdoor-render.js), the whole of it like the video's camera: the arena, the 8 slices, the hub's
//     count, the pink roulette, «0», the doors, every kid; mine bigger with a pulsing ring and «TÚ»
//   · TAP the floor = run there: my character runs at once (predicted here at the server's own speed, the same step as
//     the server: js/trapdoor-arena.js move), the tap goes to the server as an intent (player:td-go)
//   · the QUESTION as a compact card under the platform (two separate areas: run up there, answer down here, no mode
//     switch): on the floor a right answer = golden wings for this round's drop; in the pit = back up; waiting to rise
//     = rise with wings. It closes at «0» (the dash). With nothing to answer, one big line says what to do now.
//   · the HUD: Fuego vs Mar (points + who is standing), the round dots, «Sonido» (the shared button, moved here)
//   · moments: «¡YA!», «Ronda N», «¡RONDA FINAL! ¡vale doble!», «0 · ¡CORRE!», «¡Tus alas te salvaron!», «¡Caíste!»,
//     «¡De vuelta!», «+9 en pie», lead changes with my captain's line; the pit window with my character when I fell
// Test hooks: TrapdoorPhone.debug(), .advance(sec), .tapWorld(x, y), .answer(i), .moment(m), .band(t, s), .help(v),
//             .frame(), .scene(), .hold(ms-into-round).
(function () {
  'use strict';
  const TA = () => window.TrapdoorArena;
  const TR = () => window.TrapdoorRender;
  const $ = (id) => document.getElementById(id);
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const skin = () => window.KingdomsSkin;
  const CAST = () => window.DralingoCast;
  const HB = () => window.HalconBoard;
  const K = '/assets/kingdoms/', TD = '/assets/trapdoor/', MO = '/assets/mochi/', HC = '/assets/halcon/';
  const sfx = (path, vol) => { const s = skin(); if (s && s.sfx) s.sfx(path, vol); };
  const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) {} };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const NAMES = { red: 'Reino del Fuego', gold: 'Reino del Mar' };
  const SHORT = { red: 'Fuego', gold: 'Mar' };
  const other = (t) => (t === 'red' ? 'gold' : 'red');
  const ARM_MS = 450;                     // a tile answers only once the card has been up this long (no double-tap guess)
  const Q_MS = 20000;

  let ctx = null, on = false;
  let scene = null, arenaIdx = 0, matchId = null;
  let myK = null, me = null;             // me: { x, y, tx, ty }
  let myState = { st: 'up', wings: false, wingsNext: false, hover: false };
  let speed = 92;
  let lagMs = 60;                         // my one-way lag as the room measured it (td:ping)
  let rd = null;                          // { r, rounds, kind, final }
  const lastRound = () => !!(rd && rd.final);   // the Final Round: there is no «próxima ronda» to promise
  // …and from «0» on, no comeback either (the room deals no more pit questions then)
  const noComeback = () => { if (!lastRound() || !scene || !scene.rd) return false; const ph = TA().phaseAt(scene.clock(performance.now()), true); return !(ph === 'title' || ph === 'roulette' || ph === 'count'); };
  let score = { red: 0, gold: 0 }, stand = { red: 0, gold: 0 };
  let paused = false, finalOn = false, captains = null;
  let skew = null;
  let raf = 0, lastT = 0, lastGo = 0, goTimer = null, pendingGo = null;
  let roster = {};
  let arenaPick = 0, roundsPick = 7;

  // ---------- quick sounds (Web Audio: the clicks land on time) ----------
  let actx = null, loading = false;
  const bufs = {};
  const PA = '/assets/party/';
  const BUF = { tick: K + 'tick.mp3', pop: MO + 'pop.mp3', gold: MO + 'gold.mp3', open: TD + 'open.mp3', close: TD + 'close.mp3', fall: TD + 'fall.mp3', wings: TD + 'wings.mp3', saved: TD + 'saved.mp3', back: TD + 'back.mp3', lock: TD + 'lock.mp3', whoosh: K + 'whoosh.mp3',
    hurry: PA + 'hurry.mp3', clockTick: PA + 'tick.mp3', clockTock: PA + 'tock.mp3' };
  function audioReady() {
    if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      actx = new Ctx();
      if (!loading) {
        loading = true;
        Object.entries(BUF).forEach(([k, f]) => { fetch(f).then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b)).then((buf) => { bufs[k] = buf; }).catch(() => {}); });
      }
    } catch (_) {}
  }
  const muted = () => { const s = skin(); return !!(s && s.isMuted && s.isMuted()); };
  function play(name, rate, vol) {
    if (muted()) return;
    if (!actx || !bufs[name]) { if (BUF[name]) sfx(BUF[name], vol == null ? 0.6 : vol); return; }
    try {
      const src = actx.createBufferSource();
      src.buffer = bufs[name];
      src.playbackRate.value = rate || 1;
      const gn = actx.createGain();
      gn.gain.value = vol == null ? 0.6 : vol;
      src.connect(gn).connect(actx.destination);
      src.start();
    } catch (_) {}
  }

  // ---------- on / off ----------
  function setOn(v) {
    if (v === on) return;
    on = v;
    document.body.classList.toggle('tp-on', on);
    if (!on) teardown();
  }
  function teardown() {
    stopLoop();
    closeCard(true);
    hideMoment(true);
    hideBand();
    hurry(false);
    document.body.classList.remove('tp-final', 'tp-pitting', 'tp-lastround');
  }
  // «¡Rápido!» (the Final Round, 2026-10-19): the alarm lights at the edges and, on the phone, no music of its own (the
  // projector plays the beat faster and higher; the phone plays the jingle and the clock that speeds up)
  function hurry(v) {
    const P = window.DralyParty;
    if (P && P.hurryGlow) P.hurryGlow(!!v);
    if (v && skin() && skin().music) skin().music(null);
  }
  const team = () => (ctx ? ctx.getTeam() : 'red');

  function init(c) {
    ctx = c;
    const s = c.socket;
    s.on('td:init', (d) => {
      if (!d || d.arena == null) return;
      setOn(true);
      clearTimeout(initT); initT = null; initTries = 0;
      const same = matchId === d.id && scene;
      matchId = d.id;
      speed = d.speed || 92;
      if (!scene) scene = new (TR().Scene)($('tp-canvas'), { mode: 'phone' });
      if (!same || arenaIdx !== d.arena) { arenaIdx = d.arena; scene.setArena(d.arena); setArenaCss(); }
      scene.speed = speed;
      roster = d.roster || {};
      scene.roster(roster);
      myK = d.me;
      scene.me = myK;
      scene.positions(d.pos || [], performance.now());
      const mine = scene.kids[myK];
      if (mine && (!same || !me)) me = { x: mine.sx, y: mine.sy, tx: mine.tx, ty: mine.ty };
      if (d.st) myState = { st: d.st, wings: !!d.wings, wingsNext: !!d.wingsNext, hover: false };
      score = d.score || score;
      captains = d.captains || captains;
      paused = !!d.paused;
      rd = d.r > 0 ? { r: d.r, rounds: d.rounds, kind: d.kind, final: d.final } : { r: 0, rounds: d.rounds, kind: null, final: false };
      document.body.classList.toggle('tp-lastround', !!rd.final);
      hurry(!!rd.final);                  // (a phone back in the middle of the Final Round: its lights, no jingle)
      if (d.r > 0) {
        scene.round({ r: d.r, rounds: d.rounds, kind: d.kind, final: d.final, jumps: d.jumps }, d.ago, performance.now());
        if (d.set) scene.lock(d.set);
        if (d.open && d.set) scene.open(d.set, [], [], performance.now() - 400);
      } else { scene.rd = null; scene.lockSet = null; scene.doors = null; }    // «¡YA!» of a new match: no round yet
      scene.paused = false;
      if (paused) scene.pause(true, performance.now());
      finalOn = false;
      document.body.classList.remove('tp-final');
      // the server has no open question for me any more (it timed out while I was away): no dead card
      if (!d.q && cur && !cur.done) closeCard(true);
      ctx.showScreen('trapdoor');
      start();
      hud(true);
      meState(true);
      if (!same) {
        // «Así se juega» in the card's space during «¡YA!» (the platform stays in view); a kid joining later gets the hand
        if (d.phase === 'intro') { introBand(d.ago); showHelp(); } else showHand();
      }
    });
    s.on('td:roster', (r) => { roster = r || {}; if (scene) scene.roster(roster); hud(true); });
    s.on('td:pos', (m) => {
      if (!scene || !m) return;
      const now = performance.now();
      if (m.t) { const sk = m.t - Date.now(); skew = skew == null ? sk : skew + (sk - skew) * 0.2; }
      scene.positions(m.d || [], now);
      const d = scene.kids[myK];
      if (d && !me && d.sx != null) me = { x: d.sx, y: d.sy, tx: d.tx, ty: d.ty };
      if (d && me && (m.d || []).some((row) => row[0] === myK)) {
        // the server's position trails mine by my lag (+ its tick): compare with where it will be by then, so a fast
        // run on a slow connection is not pulled back; a big gap (a refused tap, a rejoin) eases me back at once,
        // a small one only while I stand still
        const ahead = (d.f & 14) ? [d.sx, d.sy] : TA().move(d.sx, d.sy, d.tx, d.ty, (speed * (lagMs + 60)) / 1000, (d.f & 16) ? null : scene.openMap());
        const eNow = Math.hypot(d.sx - me.x, d.sy - me.y), eAhead = Math.hypot(ahead[0] - me.x, ahead[1] - me.y);
        const err = Math.min(eNow, eAhead), toward = eAhead <= eNow ? ahead : [d.sx, d.sy];
        const still = Math.hypot(me.tx - me.x, me.ty - me.y) < 0.3;
        if (err > 18) { me.x += (toward[0] - me.x) * 0.5; me.y += (toward[1] - me.y) * 0.5; }
        else if (err > 2 && still && Math.hypot(me.tx - d.tx, me.ty - d.ty) < 1) { me.x += (d.sx - me.x) * 0.3; me.y += (d.sy - me.y) * 0.3; }
        // my last tap didn't reach the server (Wi-Fi blip, rate limit): send it again
        if (!paused && !finalOn && myState.st === 'up' && Math.hypot(d.tx - me.tx, d.ty - me.ty) > 1.5 && now - lastGo > 450) sendGo(me.tx, me.ty, true);
      }
    });
    // the room measures my round trip (its doors' grace follows my lag); it tells me the lag it measured
    s.on('td:ping', (m, ack) => { if (m && m.lag >= 0) lagMs = Math.min(400, m.lag); if (typeof ack === 'function') ack(1); });
    s.on('td:round', (m) => {
      if (!scene || !m || m.id !== matchId) return;
      const now = performance.now();
      rd = { r: m.r, rounds: m.rounds, kind: m.kind, final: m.final };
      scene.round(m, m.ago, now);
      if (m.pos) scene.positions(m.pos, now);
      (m.enter || []).forEach((k) => {
        const row = (m.pos || []).find((x) => x[0] === k);
        if (row) scene.rise(k, row[1], row[2], now);
        if (k === myK && row) { me = { x: row[1], y: row[2], tx: row[1], ty: row[2] }; moment({ kind: 'back', title: '¡De vuelta arriba!', sub: myState.wingsNext ? '¡Y con alas!' : '¡Ahora no te caigas!', mine: true, big: true }); play('back', 1, 0.6); buzz([30, 30, 60]); }
      });
      document.body.classList.toggle('tp-lastround', !!m.final);
      if (helpOpen()) hideHelp();
      roundBand(m);
      hud(true);
    });
    s.on('td:lock', (m) => {
      if (!scene || !m || m.id !== matchId) return;
      scene.lock(m.set);
      play('lock', 1, 0.8);
      sfx(K + 'castle-alert.mp3', 0.45);
      const v = myView();
      run(v.lock);
      if (v.lock === 'run' || v.lock === 'keep') buzz([80, 40, 80, 40, 80]);
    });
    s.on('td:open', (m) => {
      if (!scene || !m || m.id !== matchId) return;
      const now = performance.now();
      scene.open(m.set, m.falls, m.saves, now, m.at);
      play('open', 1, 0.7);
      hideRun();
      if ((m.falls || []).length) setTimeout(() => play('fall', 0.9 + Math.random() * 0.2, 0.55), 160);
      if ((m.falls || []).includes(myK)) {
        const F = scene.kids[myK] && scene.kids[myK].fall;          // the server's judgement wins over my prediction
        if (F) me = { x: F.x, y: F.y, tx: F.x, ty: F.y };
        moment({ kind: 'fall', title: '¡Caíste!', sub: noComeback() ? 'Era la ronda final: ¡anima a tu reino!' : 'Responde bien y vuelves arriba', mine: true, big: true });
        buzz([200]);
      } else if ((m.saves || []).includes(myK)) {
        const J = (m.at || []).find((row) => row[0] === myK);   // I hover where the doors found me
        if (J) me = { x: J[1], y: J[2], tx: J[1], ty: J[2] };
        moment({ kind: 'saved', title: '¡Tus alas te salvaron!', sub: lastRound() ? '¡Sigues en pie en la ronda final!' : 'Las alas se gastaron: gana otras en la próxima', mine: true, big: true });
        play('saved', 1, 0.7);
        buzz([40, 30, 40, 30, 120]);
      }
      const nF = (m.falls || []).length;
      if (nF && !(m.falls || []).includes(myK)) {
        const mates = (m.falls || []).filter((k) => roster[k] && roster[k][1] === team()).length;
        if (mates) gangLine(mates === 1 ? '¡Uno de los nuestros cayó! Vamos, ¡vuelve!' : `¡Cayeron ${mates} de los nuestros! ¡Respondan y vuelvan!`, 'oops');
      }
      statusLine();                    // the doors' verdict shows at once (never a beat of «¡Sigues en pie!» for a fall)
    });
    s.on('td:close', (m) => { if (!scene || !m || m.id !== matchId) return; scene.close(performance.now()); play('close', 1, 0.6); });
    s.on('td:tally', (m) => {
      if (!m || m.id !== matchId) return;
      score = m.score || score;
      stand = m.stand || stand;
      hud(true);
      const my = team();
      const up = myState.st === 'up';
      tallyBand(m, my, up);
      if (m.leadChanged && m.lead && !m.final) {
        const C = CAST(), cap = captains && captains[my];
        if (m.lead === my) moment({ kind: 'lead', team: my, title: '¡Tu reino pasa adelante!', sub: C && cap ? `${C.name(cap)}: «${C.line(cap, 'trampa') || C.line(cap, 'battle')}»` : '¡Sigan en pie!', cast: cap });
        else moment({ kind: 'lead', team: m.lead, title: `¡El ${SHORT[m.lead]} pasa adelante!`, sub: '¡Respondan para tener alas!' });
      }
    });
    s.on('td:rise', (m) => {
      if (!scene || !m || m.id !== matchId) return;
      scene.rise(m.k, m.x, m.y, performance.now());
      if (m.k === myK) {
        me = { x: m.x, y: m.y, tx: m.x, ty: m.y };
        moment({ kind: 'back', title: '¡De vuelta arriba!', sub: '¡Corre lejos del rosa!', mine: true, big: true });
        play('back', 1, 0.6);
        buzz([30, 30, 60]);
      }
    });
    s.on('td:me', (d) => {
      if (!d) return;
      const was = myState;
      myState = { st: d.st, wings: !!d.wings, wingsNext: !!d.wingsNext, hover: !!d.hover };
      if (d.st === 'up' && was.st !== 'up' && scene && scene.kids[myK]) { const k0 = scene.kids[myK]; me = { x: k0.sx, y: k0.sy, tx: k0.sx, ty: k0.sy }; }
      meState(false, was);
    });
    s.on('td:rounds', (d) => {
      if (!d || d.id !== matchId) return;
      if (rd) rd.rounds = d.rounds;
      if (scene && scene.rd) scene.rd.rounds = d.rounds;
      if (!d.refused) moment({ kind: 'more', title: d.cut ? '¡Menos rondas!' : '¡Más rondas!', sub: `Ahora son ${d.rounds}` });
      hud(true);
    });
    s.on('td:captains', (c) => { captains = c; });
    s.on('td:arena', (d) => { if (d && d.arena != null) arenaPick = d.arena; if (lobbyBox) paintLobby(); });
    s.on('td:pause', (d) => {
      if (!d) return;
      paused = !!d.paused;
      if (scene) scene.pause(paused, performance.now(), paused ? null : d.ago);
      holdQ(paused);
      setTiles(!paused && cur && !cur.tapped);
      hud(true);
    });
    s.on('td:qclose', (d) => {
      if (!on || !cur || cur.done || !d || d.qid !== cur.qid) return;
      cur.done = true;
      lastDoneQid = cur.qid;
      closeCard(true);
    });
    s.on('td:qkind', (d) => { if (cur && d && d.qid === cur.qid) { cur.kind = d.kind; $('tp-q-head').textContent = headFor(d.kind); } });
    s.on('state', (st) => {
      if (!st) return;
      if (st.tdArena != null && st.tdArena !== arenaPick) { arenaPick = st.tdArena; if (lobbyBox) paintLobby(); }
      if (st.tdRounds != null && st.tdRounds !== roundsPick) { roundsPick = st.tdRounds; if (lobbyBox) paintLobby(); }
      if (st.state === 'lobby') { setOn(false); matchId = null; }
      if (st.state === 'active' && st.gameType === 'trapdoor' && !on) armInitCheck();
    });
    s.on('question', (q) => { if (on && q && q.td && !finalOn) showQuestion(q); });
    s.on('answer-result', (r) => { if (on && r && r.td) onResult(r); });
    s.on('answer-stale', (d) => {
      if (!on || !cur || cur.done) return;
      // the server has no open question for me (its answer got lost on the way / «0» closed it): close the card
      if (d && (d.reason === 'no-question' || d.reason === 'final')) { closeCard(true); return; }
      cur.tapped = false;
      $('tp-verdict').className = 'tp-verdict';
      document.querySelectorAll('.tp-a').forEach((b) => b.classList.remove('picked'));
      if (!paused && !finalOn) { setTiles(true); runQTimer(); }
    });
    s.on('fin:final', () => {
      if (!on) return;
      finalOn = true;
      hurry(false);
      document.body.classList.add('tp-final');
      closeCard(true);
      hideMoment(true);
      hideBand();
      hideRun();
      if (scene) { scene.frozen = true; scene.pause(true, performance.now()); }   // no roulette or count goes on under «¡FINAL!»
      if (me) { me.tx = me.x; me.ty = me.y; }
    });
    s.on('game-end', () => { if (on) { finalOn = true; hurry(false); stopLoop(); closeCard(true); } });
    s.on('countdown', () => { matchId = null; finalOn = false; hurry(false); document.body.classList.remove('tp-final', 'tp-lastround'); if (scene) scene.frozen = false; });
    // this phone's game went on in another tab (player.js shows its card): the platform stands still, its clock is quiet
    window.addEventListener('draly:elsewhere', () => { clearTimeout(initT); initT = null; setOn(false); });
    bind();
  }

  // ---------- a phone that shows the game without its platform asks the room again (2026-10-19) ----------
  // (his laptop: the room was playing, the screen was the game's, but its td:init never came: a dark empty platform
  // until he typed the PIN again.) While #screen-trapdoor shows «Entrando a la plataforma…» (no td:init yet), ask for
  // the platform: player.js's resync → the server re-sends td:init, or says this phone has no slot (player:gone) and
  // player.js joins again by itself.
  let initT = null, initTries = 0;
  function armInitCheck() {
    if (on || initT) return;
    initT = setTimeout(function chk() {
      initT = null;
      if (on) { initTries = 0; return; }
      const scr = $('screen-trapdoor');
      if (!scr || scr.classList.contains('hidden')) return;          // not on the game's screen: nothing to fix (yet)
      if (window.DralyPlayer) window.DralyPlayer.resync('trapdoor-init');
      if (++initTries < 15) initT = setTimeout(chk, 3000);
    }, 1400);
  }

  // ---------- the loop ----------
  function start() {
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
  let hudAt = 0, actAt = 0, sizeAt = 0;
  function loop(t) {
    raf = 0;
    if (!on || !scene) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden || $('screen-trapdoor').classList.contains('hidden')) return;
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    stepMe(dt);
    frameAt(t, dt);
    tickSounds();                         // (every frame: the Final Round's clock ticks 4 times a second)
    if (t - hudAt > 150) { hudAt = t; hud(); }
    if (t - actAt > 3000) { actAt = t; ctx.markActivity(); }
  }
  function frameAt(t, dt) {
    if (t - sizeAt > 500 || !sizeAt) { sizeAt = t; if (!scene.resize()) return; }
    scene.meXY = me && myState.st === 'up' ? [me.x, me.y] : null;
    scene.frame(t, dt);
  }
  // the hub's count: a tick each second (the last two higher), from the round's own clock; the Final Round's clock
  // ticks and tocks twice, then four times a second, rising (TA().tickAt)
  let lastHub = null;
  function tickSounds() {
    if (!scene || !scene.rd || paused || finalOn) { lastHub = null; return; }
    const k = TA().tickAt(scene.clock(performance.now()), scene.rd.final);
    const key = k ? scene.rd.r + ':' + k.i : null;
    if (key !== lastHub) {
      lastHub = key;
      if (k && k.fast) play(k.i % 2 ? 'clockTock' : 'clockTick', 1 + k.i * 0.025, k.fast === 2 ? 0.8 : 0.65);
      else if (k) play('tick', k.n <= 2 ? 1.25 : 1, 0.55);
    }
  }
  // my run: the same step as the server (around the hub, never into an open hole)
  function stepMe(dt) {
    if (!me || !scene || myState.st !== 'up' || paused || finalOn) return;
    if (Math.hypot(me.tx - me.x, me.ty - me.y) < 0.05) return;
    const open = myState.hover ? null : scene.openMap();
    const [x, y] = TA().move(me.x, me.y, me.tx, me.ty, speed * dt, open);
    const d = scene.kids[myK];
    if (d) { if (x < me.x - 0.05) d.face = -1; else if (x > me.x + 0.05) d.face = 1; }
    me.x = x; me.y = y;
  }

  // ---------- tap to run ----------
  function sendGo(x, y, force) {
    const now = performance.now();
    if (!force && now - lastGo < 90) {
      pendingGo = [x, y];
      if (!goTimer) goTimer = setTimeout(() => { goTimer = null; if (pendingGo) { const p = pendingGo; pendingGo = null; sendGo(p[0], p[1], true); } }, 95);
      return;
    }
    lastGo = now;
    pendingGo = null;
    ctx.socket.emit('player:td-go', { pin: ctx.getPin(), x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }
  function runTo(x, y, fromTap) {
    if (!on || !me || paused || finalOn || !scene) return;
    hideHand();
    if (helpOpen()) hideHelp();
    if (myState.st !== 'up') {
      if (fromTap) { nudgeCard(); }
      return;
    }
    const t = TA().clampTarget(x, y);
    if (!t) return;
    me.tx = t[0]; me.ty = t[1];
    if (fromTap) { scene.ripple = { x: t[0], y: t[1], t: performance.now() }; play('whoosh', 1.4, 0.12); }
    sendGo(t[0], t[1], fromTap);
    ctx.markActivity();
  }
  let dragging = false;
  function bind() {
    const cv = $('tp-canvas');
    if (!cv) return;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      audioReady();
      if (!scene) return;
      if (e.cancelable) e.preventDefault();
      dragging = true;
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      const w = scene.toWorld(...pt(e));
      if (w) runTo(w[0], w[1], true);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!dragging || !scene) return;
      const w = scene.toWorld(...pt(e));
      if (w) runTo(w[0], w[1], false);
    });
    const up = () => { dragging = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    const go = $('tp-help-go');
    if (go) go.addEventListener('click', () => { audioReady(); hideHelp(); });
    window.addEventListener('resize', () => { sizeAt = 0; });
    document.addEventListener('keydown', (e) => {          // a laptop in the classroom: arrow keys nudge my character
      if (!on || !me || !document.body.classList.contains('tp-on')) return;
      const k = { ArrowLeft: [-30, 0], ArrowRight: [30, 0], ArrowUp: [0, -30], ArrowDown: [0, 30] }[e.key];
      if (!k) return;
      e.preventDefault();
      runTo(me.x + k[0], me.y + k[1], true);
    });
  }

  // ---------- my state: the line under the platform, the pit window ----------
  function meState(force, was) {
    const box = $('tp-status');
    if (!box) return;
    const st = myState.st;
    document.body.classList.toggle('tp-pitting', st === 'down' || st === 'wait');
    const pit = $('tp-pit');
    if (pit) {
      const show = st === 'down' || st === 'wait';
      pit.classList.toggle('hidden', !show);
      if (show) {
        const a = TA().arena(arenaIdx);
        $('tp-pit-bg').src = TA().art(a, 'pit');
        const sk = HB() ? HB().skinFor(roster[myK] && roster[myK][2], roster[myK] && roster[myK][0]) : 'dralingo';
        $('tp-pit-me').src = HB() ? HB().art(sk, st === 'wait' ? 'ok' : 'no') : '/assets/dralingo/hello.webp';
        pit.classList.toggle('ready', st === 'wait');
        $('tp-pit-text').textContent = st === 'wait' ? (lastRound() ? 'Es la ronda final: ¡mira!' : myState.wingsNext ? '¡Listo! Subes con alas' : '¡Listo! Subes en la próxima ronda') : `En ${a.pitName}`;
      }
    }
    statusLine();
    if (was && !was.wings && myState.wings && st === 'up') { play('wings', 1, 0.7); wingsFlash(); }
    void force;
  }
  // What I am right now, never ahead of the server's word: a fall or a save shows the moment the doors' verdict
  // arrives (td:open marks my character, before td:me), «¡Sigues en pie!» only once the doors have opened for this
  // round, and at «0» TA().lockVerdict never calls me safe while the server's last report of me is on a burning slice.
  function myView() {
    const d0 = scene && scene.kids[myK];
    const f = d0 && d0.f != null ? d0.f : 0;
    let st = myState.st;
    if (st === 'up' && (f & 2)) st = 'down';
    const hover = st === 'up' && (myState.hover || !!(f & 16));
    const ph = rd && rd.r > 0 && scene && scene.rd ? TA().phaseAt(scene.clock(performance.now()), scene.rd.final) : '';
    const doorsIn = !!(scene && scene.doors);
    let lock = null;
    if (st === 'up' && !hover && (ph === 'lock' || (ph === 'open' && !doorsIn)) && scene && scene.lockSet) {
      lock = TA().lockVerdict(me ? [me.x, me.y] : null, d0 && d0.sx != null ? [d0.sx, d0.sy] : null, scene.lockSet, myState.wings);
    }
    return { st, hover, ph, doorsIn, lock };
  }
  function statusLine() {
    const box = $('tp-status');
    if (!box) return;
    const v = myView();
    const st = v.st;
    let ico = '🏃', txt = '¡Toca el suelo para correr!', cls = '';
    if (st === 'down') { ico = '🕳️'; txt = noComeback() ? 'Caíste en la ronda final: ¡anima a tu reino!' : '¡Caíste al foso!'; cls = 'pit'; }
    else if (st === 'wait') { ico = '⬆️'; txt = lastRound() ? 'Es la ronda final: ¡mira cómo termina!' : myState.wingsNext ? '¡Subes con alas en la próxima ronda!' : '¡Subes en la próxima ronda!'; cls = 'wait'; }
    else if (v.hover) { ico = 'wings'; txt = '¡Tus alas te sostienen!'; cls = 'wings'; }
    else if (v.lock === 'wings') { ico = 'wings'; txt = '¡Estás en el rosa! Tus alas te cuidan'; cls = 'wings'; }
    else if (v.lock === 'run') { ico = '⚠️'; txt = '¡CORRE lejos del rosa!'; cls = 'hot'; }
    else if (v.lock === 'keep') { ico = '⚠️'; txt = '¡Sigue corriendo! Aún pisas el rosa'; cls = 'hot'; }
    else if (v.lock === 'safe') { ico = '✋'; txt = '¡Quieto ahí! Tu suelo no se abre'; cls = 'safe'; }
    else if (v.doorsIn && (v.ph === 'open' || v.ph === 'close' || v.ph === 'tally')) { ico = '⭐'; txt = '¡Sigues en pie!'; cls = 'ok'; }
    else if (myState.wings) { ico = 'wings'; txt = '¡Tienes alas! Ahora ¡esquiva el rosa!'; cls = 'wings'; }
    else if (rd && rd.r > 0) { ico = '❓'; txt = 'Sin alas: ¡responde o esquiva!'; cls = 'nowings'; }
    runPill(v);
    const key = ico + txt + cls;
    if (box.dataset.k === key) return;
    box.dataset.k = key;
    box.className = 'tp-status ' + cls;
    const icoEl = $('tp-status-ico');
    if (ico === 'wings') icoEl.innerHTML = '<img src="/assets/trapdoor/wings.webp" alt="">'; else icoEl.textContent = ico;
    $('tp-status-text').textContent = txt;
    rest(cls, v);
  }
  // the card's resting face (no question open): what to do now, big, with my own character
  function rest(cls, v) {
    const box = $('tp-rest');
    if (!box) return;
    v = v || myView();
    const st = v.st;
    let title = '¡Prepárate!', sub = 'Toca el suelo para correr', pose = 'idle';
    if (st === 'down') { title = '¡Caíste al foso!'; sub = noComeback() ? 'Era la ronda final: ¡anima a tu reino!' : 'Responde bien y vuelves arriba'; pose = 'no'; }
    else if (st === 'wait') { title = lastRound() ? '¡Ronda final!' : '¡Listo!'; sub = lastRound() ? 'Mira cómo termina: ¡anima a tu reino!' : myState.wingsNext ? 'Subes con alas en la próxima ronda' : 'Subes en la próxima ronda'; pose = 'ok'; }
    else if (v.hover) { title = '¡Tus alas te sostienen!'; sub = 'Cuando el suelo se cierre, aterrizas'; pose = 'ok'; }
    else if (cls === 'hot') { title = '¡CORRE!'; sub = '¡Sal del suelo rosa!'; pose = 'no'; }
    else if (cls === 'safe') { title = '¡Quieto ahí!'; sub = 'Tu suelo no se abre: ¡no pises el rosa!'; pose = 'ok'; }
    else if (cls === 'ok') { title = '¡Sigues en pie!'; sub = 'Cada ronda en pie suma para tu reino'; pose = 'ok'; }
    else if (myState.wings) { title = '¡Tienes alas!'; sub = 'Si tu suelo se abre, vuelas. ¡Igual esquiva el rosa!'; pose = 'ok'; }
    else if (rd && rd.r > 0) { title = '¡Esquiva el rosa!'; sub = 'En el 0, el suelo rosa se abre'; }
    // my character wears the golden wings on the card while I have them (the kid connects «alas» with the picture)
    box.className = 'tp-rest ' + (cls || '') + ((myState.wings || v.hover) && st === 'up' ? ' haswings' : '');
    $('tp-rest-text').textContent = title;
    $('tp-rest-sub').textContent = sub;
    const sk = HB() ? HB().skinFor(roster[myK] && roster[myK][2], roster[myK] && roster[myK][0]) : null;
    const u = sk ? HB().art(sk, pose) : '/assets/dralingo/hello.webp';
    const im = $('tp-rest-img');
    if (im.getAttribute('src') !== u) im.src = u;
  }
  function wingsFlash() { const b = $('tp-status'); if (!b || reduced()) return; b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }

  // ---------- the question card ----------
  let cur = null, qT = null, rescueT = null, lastTick = 0, closeT = null, lastDoneQid = null;
  const headFor = (kind) => (kind === 'back' ? '🕳️ Responde bien y ¡vuelves arriba!' : kind === 'pre' ? '✨ Responde bien y subes con alas' : '✨ Responde bien: ¡alas para esta caída!');
  const isCardUp = () => document.body.classList.contains('tp-asking');
  function card(up) {
    const q = $('tp-card');
    if (!q) return;
    q.setAttribute('aria-hidden', up ? 'false' : 'true');
    document.body.classList.toggle('tp-asking', !!up);
    sizeAt = 0;
  }
  function closeCard(now) {
    clearTimeout(closeT);
    stopQTimer();
    clearTimeout(rescueT);
    if (now) cur = null;
    card(false);
  }
  function nudgeCard() { const q = $('tp-card'); if (!q || !isCardUp()) return; q.classList.remove('nudge'); void q.offsetWidth; q.classList.add('nudge'); buzz([30, 40, 30]); }
  function showQuestion(q) {
    if (!q || q.qid === lastDoneQid) return;          // a late copy of a question already answered
    clearTimeout(closeT);
    if (cur && cur.qid === q.qid && !cur.done) {        // the same question again (a resync / a rejoin)
      if (cur.tapped) { cur.tapped = false; setTiles(!paused); document.querySelectorAll('.tp-a').forEach((b) => b.classList.remove('picked')); runQTimer(); }
      card(true);
      return;
    }
    // armed ARM_MS after it arrives, always (the server calls < 450 ms from the deal a guess: never arm sooner)
    cur = { qid: q.qid, kind: q.td, t0: performance.now(), tapped: false, done: false, heldAt: 0, heldSum: 0, armAt: performance.now() + ARM_MS };
    const box = $('tp-card');
    box.classList.toggle('nopic', !q.image);
    box.dataset.kind = q.td || 'wings';
    $('tp-q-head').textContent = headFor(q.td);
    const img = $('tp-q-img');
    if (q.image) { img.src = q.image; img.alt = ''; } else img.removeAttribute('src');
    $('tp-q-text').textContent = q.text || '';
    $('tp-verdict').className = 'tp-verdict';
    $('tp-verdict').textContent = '';
    const ans = $('tp-ans');
    ans.innerHTML = '';
    const SH = ['▲', '◆', '●', '■'];
    (q.answers || []).forEach((a, i) => {
      const b = el('button', 'tp-a s' + (i % 4) + (a.length > 26 ? ' xlong' : a.length > 13 ? ' long' : ''));
      b.type = 'button';
      const sh = el('span', 'tp-sh', SH[i % 4]);
      sh.setAttribute('aria-hidden', 'true');
      b.append(sh, el('span', 'tp-at', a));
      let pressAt = -1e9;
      b.addEventListener('pointerdown', (e) => { pressAt = performance.now(); if (e.pointerType && e.pointerType !== 'mouse' && e.cancelable) e.preventDefault(); answer(i); });
      b.addEventListener('click', () => { if (performance.now() - pressAt < 2500) return; answer(i); });
      ans.appendChild(b);
    });
    card(true);
    runQTimer(true);
    if (paused) { holdQ(true); setTiles(false); }
    play('whoosh', 1, 0.18);
    ctx.markActivity();
  }
  function setTiles(v) { document.querySelectorAll('.tp-a').forEach((b) => { b.disabled = !v; }); }
  const qLeft = () => (cur ? Math.max(0, Q_MS - ((cur.heldAt || performance.now()) - cur.t0 - cur.heldSum)) : 0);
  function runQTimer(fresh) {
    stopQTimer();
    if (!cur || cur.done) return;
    const bar = $('tp-q-bar');
    const left = qLeft();
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${(left / Q_MS).toFixed(3)})`;
    if (fresh) bar.parentNode.classList.remove('hurry');
    if (cur.heldAt || paused) return;
    void bar.offsetWidth;
    bar.style.transition = `transform ${left}ms linear`;
    bar.style.transform = 'scaleX(0)';
    lastTick = 99;
    qT = setInterval(() => {
      if (!cur || cur.tapped || cur.done || cur.heldAt) return;
      const l = qLeft();
      const sec = Math.ceil(l / 1000);
      if (sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; bar.parentNode.classList.add('hurry'); }
      if (l <= 0) {
        stopQTimer();
        cur.tapped = true;
        setTiles(false);
        ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid: cur.qid, choiceIdx: -1 }, () => {});   // time up = wrong (once)
      }
    }, 200);
  }
  function stopQTimer() {
    clearInterval(qT);
    qT = null;
    const bar = $('tp-q-bar');
    if (bar && cur) { bar.style.transition = 'none'; bar.style.transform = `scaleX(${(qLeft() / Q_MS).toFixed(3)})`; }
  }
  function holdQ(v) {
    if (!cur) return;
    if (v && !cur.heldAt) { cur.heldAt = performance.now(); stopQTimer(); }
    else if (!v && cur.heldAt) { cur.heldSum += performance.now() - cur.heldAt; cur.heldAt = 0; if (!cur.tapped && !cur.done) runQTimer(); }
  }
  // the tap answers at once (press + pop); the server judges (a pack never sends the right answer)
  function answer(i) {
    audioReady();
    if (!cur || cur.tapped || cur.done || paused || finalOn) return;
    if (performance.now() < cur.armAt) return;
    cur.tapped = true;
    const btn = document.querySelectorAll('.tp-a')[i];
    if (btn) btn.classList.add('picked');
    setTiles(false);
    play('pop', 1.1, 0.45);
    buzz(10);
    stopQTimer();
    const v = $('tp-verdict');
    v.className = 'tp-verdict wait show';
    v.textContent = '';
    v.appendChild(el('b', 'dots', '•••'));
    const qid = cur.qid;
    ctx.socket.emit('player:answer', { pin: ctx.getPin(), qid, choiceIdx: i }, () => {});
    clearTimeout(rescueT);
    // no verdict in 3 s (a Wi-Fi blip): the tiles come back (the server answers a second tap, or says it has no question)
    rescueT = setTimeout(() => {
      if (!(cur && cur.qid === qid && cur.tapped && !cur.done)) return;
      cur.tapped = false;
      if (btn) btn.classList.remove('picked');
      $('tp-verdict').className = 'tp-verdict';
      if (paused) return;
      setTiles(true);
      runQTimer();
    }, 3000);
    ctx.markActivity();
  }
  function verdict(cls, head, sub, waitMs) {
    const v = $('tp-verdict');
    v.className = 'tp-verdict ' + cls;
    v.textContent = '';
    v.appendChild(el('b', null, head));
    if (sub) v.appendChild(el('small', null, sub));
    if (waitMs) {
      const w = el('span', 'wait');
      const i = el('i');
      w.appendChild(i);
      v.appendChild(w);
      i.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => { i.style.transition = `transform ${Math.max(200, waitMs - 150)}ms linear`; i.style.transform = 'scaleX(0)'; });
    }
    void v.offsetWidth;
    v.classList.add('show');
  }
  function onResult(r) {
    const td = r.td;
    clearTimeout(rescueT);
    stopQTimer();
    if (cur) { cur.done = true; cur.tapped = true; lastDoneQid = cur.qid; }
    setTiles(false);
    document.querySelectorAll('.tp-a').forEach((b) => {
      const txt = b.querySelector('.tp-at') && b.querySelector('.tp-at').textContent;
      if (txt === r.correctText) b.classList.add('right');
      else if (b.classList.contains('picked')) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    if (r.correct) {
      let head = '¡Correcto!', sub = '';
      if (td.kind === 'wings' && td.wings) { head = '¡ALAS! ✨'; sub = 'Te salvan una vez si tu suelo cae'; }
      else if (td.back === 'now') { head = '¡ARRIBA! ⬆️'; sub = '¡Vuelves a la plataforma!'; }
      else if (td.back === 'next') { head = '¡Correcto!'; sub = lastRound() ? 'Era la ronda final: ¡mira cómo termina!' : 'Subes al empezar la próxima ronda'; }
      else if (td.kind === 'pre' && td.wings) { head = '¡ALAS! ✨'; sub = 'Subes con alas en la próxima ronda'; }
      if (td.streak >= 3) sub += (sub ? ' · ' : '') + `racha ${td.streak}`;
      verdict('ok', head, sub);
      play('gold', 1.1, 0.5);
      buzz([20, 30, 20]);
      closeT = setTimeout(() => { if (cur && cur.done) { cur = null; card(false); } }, 1250);
    } else {
      const why = td.why === 'fast' ? '¡Muy rápido! Lee primero' : td.why === 'timeup' ? '¡Se acabó el tiempo!' : '¡Casi!';
      const wait = td.wait || 2000;
      verdict('no', why, r.correctText ? `Era: ${r.correctText}` : '', wait);
      play('pop', 0.55, 0.35);
      buzz(30);
      // the next question comes from the server after the wait (if there is still time for one): the card stays up
      // until then, then rests if nothing came
      closeT = setTimeout(() => { if (cur && cur.done) { cur = null; card(false); } }, wait + 900);
    }
    statusLine();
  }

  // ---------- HUD ----------
  let hudKey = '';
  function hud(force) {
    const my = team();
    const counts = { red: 0, gold: 0 };
    if (scene) Object.values(scene.kids).forEach((d) => { if (d.f != null && !(d.f & 14) && (d.team === 'red' || d.team === 'gold')) counts[d.team]++; });
    const r = rd || { r: 0, rounds: roundsPick };
    const key = [score.red, score.gold, counts.red, counts.gold, my, r.r, r.rounds, r.final, paused].join('|');
    statusLine();
    if (key === hudKey && !force) return;
    hudKey = key;
    $('tp-r').textContent = score.red || 0;
    $('tp-g').textContent = score.gold || 0;
    // «11» over «en pie» (stacked: two-digit counts leave the middle room for the round and the lead)
    $('tp-r-up').replaceChildren(el('b', null, String(counts.red)), el('span', null, 'en pie'));
    $('tp-g-up').replaceChildren(el('b', null, String(counts.gold)), el('span', null, 'en pie'));
    document.querySelector('.tp-side.red').classList.toggle('me', my === 'red');
    document.querySelector('.tp-side.gold').classList.toggle('me', my === 'gold');
    $('tp-round').textContent = r.r > 0 ? (r.final ? '¡Ronda final!' : `Ronda ${r.r} de ${r.rounds}`) : `${r.rounds} rondas`;
    const dots = $('tp-dots');
    if (dots.dataset.k !== r.r + '/' + r.rounds) {
      dots.dataset.k = r.r + '/' + r.rounds;
      dots.innerHTML = '';
      dots.classList.toggle('many', r.rounds > 7);            // 10 rounds (or 15 with «+2 rondas»): smaller dots
      for (let i = 1; i <= r.rounds; i++) dots.appendChild(el('i', i < r.r ? 'done' : i === r.r ? 'now' : ''));
    }
    const a = score[my] || 0, b = score[other(my)] || 0;
    const st = $('tp-lead');
    st.textContent = a > b ? `¡Ganamos por ${a - b}!` : a < b ? `¡Nos falta${b - a === 1 ? '' : 'n'} ${b - a}!` : '¡Empate!';
    st.className = 'tp-lead ' + (a > b ? 'ahead' : a < b ? 'behind' : '');
  }
  function bump(node) { if (!node || reduced()) return; node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }

  // ---------- the big bands over the platform («¡YA!», «Ronda N», «¡RONDA FINAL!», the tally) ----------
  let bandT = null;
  // `kick`: a small tag over the title («¡Rápido!» on the Final Round)
  function band(title, sub, cls, ms, dots, kick) {
    const b = $('tp-band');
    if (!b) return;
    b.className = 'tp-band ' + (cls || '') + (kick ? ' kick' : '');
    const kk = $('tp-band-kick');
    if (kk) kk.textContent = kick || '';
    $('tp-band-title').textContent = title;
    $('tp-band-sub').textContent = sub || '';
    const d = $('tp-band-dots');
    d.innerHTML = '';
    if (dots) for (let i = 1; i <= dots[1]; i++) d.appendChild(el('i', i < dots[0] ? 'done' : i === dots[0] ? 'now' : ''));
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(bandT);
    bandT = setTimeout(hideBand, ms || 1400);
  }
  function hideBand() { clearTimeout(bandT); const b = $('tp-band'); if (b) b.classList.remove('show'); }
  function introBand(ago) {
    const left = TA().TIMING.INTRO - (ago || 0);
    if (left < 600) return;
    band('¡YA!', `${TA().arena(arenaIdx).name}`, 'start', Math.min(1800, left - 200));
    sfx(HC + 'start.mp3', 0.7);
  }
  function roundBand(m) {
    if (m.final) {
      // «¡Rápido!»: the jingle on my phone, the lights at the edges, my clock speeds up (tickSounds); the projector
      // carries the beat, faster and higher (never 30 copies of the music)
      band('¡RONDA FINAL!', '¡Vale doble! Caen 4 trampillas', 'final', 2000, [m.r, m.rounds], '¡Rápido!');
      hurry(true);
      play('hurry', 1, 0.85);
      buzz([60, 40, 60, 40, 140]);
    } else {
      const sub = m.kind === 'three' && m.r === Math.floor(m.rounds / 2) + 1 ? '¡Ahora caen 3 trampillas!' : m.kind === 'three' ? 'Caen 3 trampillas' : 'Caen 2 trampillas';
      band(`Ronda ${m.r}`, sub, m.kind === 'three' ? 'three' : '', 1400, [m.r, m.rounds]);
      sfx(HC + 'round.mp3', 0.55);
    }
  }
  function tallyBand(m, my, up) {
    const add = m.add || {};
    const mine = add[my] || 0, theirs = add[other(my)] || 0;
    const sub = `🔥 ${m.stand && m.stand.red || 0} en pie · ${m.stand && m.stand.gold || 0} en pie 🌊`;
    if (up) band(`¡+${mine} para tu reino!`, m.final ? `¡Ronda final ×2! ${sub}` : sub, 'tally ' + my, 1250);
    else band(`Tu reino: +${mine}`, theirs > mine ? '¡Responde y vuelve para ayudar!' : sub, 'tally ' + my, 1250);
    if (up) { play('gold', 1.25, 0.35); bump($('tp-' + (my === 'red' ? 'r' : 'g'))); }
  }
  // «0»: the big «¡CORRE!» when my slice burns (a small «0» otherwise)
  let runT = null;
  // verdict: TA().lockVerdict ('run' · 'keep' · 'wings' · 'safe') or null (not on the floor)
  const RUN_WORDS = { run: '¡CORRE!', keep: '¡Sigue corriendo!', wings: '¡Tus alas te cuidan!', safe: '¡Quieto ahí!' };
  function run(verdict) {
    const r0 = $('tp-run');
    if (!r0) return;
    const mine = verdict === 'run' || verdict === 'keep';
    r0.className = 'tp-run show' + (mine ? ' mine' : '');
    r0.textContent = RUN_WORDS[verdict] || '¡Ahora!';
    r0.dataset.v = verdict || '';
    clearTimeout(runT);
    runT = setTimeout(hideRun, TA().TIMING.LOCK + 200);
  }
  // while the pill shows, it follows the verdict (a kid who runs out sees «¡Quieto ahí!» only once the server agrees)
  function runPill(v) {
    const r0 = $('tp-run');
    if (!r0 || !r0.classList.contains('show') || !v.lock || r0.dataset.v === v.lock) return;
    r0.dataset.v = v.lock;
    r0.classList.toggle('mine', v.lock === 'run' || v.lock === 'keep');
    r0.textContent = RUN_WORDS[v.lock];
  }
  function hideRun() { clearTimeout(runT); const r0 = $('tp-run'); if (r0) r0.className = 'tp-run'; }

  // ---------- moments: one slim pill at the bottom of the platform, one at a time ----------
  let momQ = [], momOn = false, momT = null, lastMomAt = 0;
  function moment(m) {
    if (finalOn) return;
    if (m.big) momQ = momQ.filter((x) => x.big);
    else if (Date.now() - lastMomAt < 3500 && !m.mine && momOn) return;
    momQ.push(m);
    if (momQ.length > 2) momQ = momQ.slice(-2);
    if (!momOn) nextMoment();
  }
  function nextMoment() {
    if (helpOpen() && momQ.length) { momOn = true; clearTimeout(momT); momT = setTimeout(nextMoment, 600); return; }
    const m = momQ.shift();
    const box = $('tp-moment');
    if (!m || !box) { momOn = false; if (box) box.classList.remove('show'); return; }
    momOn = true;
    lastMomAt = Date.now();
    box.className = 'tp-moment ' + (m.kind || '') + ' ' + (m.team || team());
    const img = $('tp-moment-img');
    const C = CAST();
    const sk = HB() ? HB().skinFor(roster[myK] && roster[myK][2], roster[myK] && roster[myK][0]) : 'dralingo';
    if (m.cast && C) { img.src = C.pose(m.cast, 'cheer'); img.className = 'cast'; }
    else if (m.kind === 'fall') { img.src = HB() ? HB().art(sk, 'no') : '/assets/dralingo/wise.webp'; img.className = 'me'; }
    else if (m.kind === 'saved' || m.kind === 'back') { img.src = HB() ? HB().art(sk, 'ok') : '/assets/dralingo/power.webp'; img.className = 'me'; }
    else { img.src = '/assets/dralingo/point.webp'; img.className = 'cast'; }
    $('tp-moment-title').textContent = m.title;
    $('tp-moment-sub').textContent = m.sub || '';
    void box.offsetWidth;
    box.classList.add('show');
    clearTimeout(momT);
    momT = setTimeout(() => { box.classList.remove('show'); momT = setTimeout(nextMoment, 220); }, m.big ? 2400 : 2100);
  }
  function hideMoment(all) { if (all) momQ = []; clearTimeout(momT); momOn = false; const b = $('tp-moment'); if (b) b.classList.remove('show'); }
  function gangLine(text, pose) {
    const C = CAST();
    const cap = captains && captains[team()];
    if (!C || !cap) return;
    moment({ kind: 'gang', title: `${C.name(cap)}: «${text}»`, sub: '', cast: cap, pose });
  }

  // ---------- first play: «Así se juega» (3 pictured steps) + a tapping hand ----------
  let helpT = null;
  function showHelp() {
    const card0 = $('tp-help');
    if (!card0) return;
    paintHelp(card0);
    card0.classList.remove('hidden');
    clearTimeout(helpT);
    helpT = setTimeout(hideHelp, 6000);              // round 1's question takes this space (hideHelp at td:round)
  }
  function paintHelp(card0) {
    const my = team();
    card0.classList.toggle('red', my === 'red');
    card0.classList.toggle('gold', my === 'gold');
    $('tp-help-title').textContent = my === 'red' ? '¡Eres del Reino del Fuego!' : '¡Eres del Reino del Mar!';
    const sk = HB() ? HB().skinFor(roster[myK] && roster[myK][2], roster[myK] && roster[myK][0]) : 'dralingo';
    if (HB()) { $('tp-help-me').src = HB().art(sk, 'idle'); $('tp-help-wings').src = HB().art(sk, 'ok'); }
  }
  function hideHelp() { clearTimeout(helpT); const c = $('tp-help'); if (c && !c.classList.contains('hidden')) { c.classList.add('hidden'); showHand(); } }
  const helpOpen = () => { const c = $('tp-help'); return !!c && !c.classList.contains('hidden'); };
  let handT = null;
  function showHand() {
    const h = $('tp-hand');
    if (!h || reduced()) return;
    h.classList.remove('hidden');
    clearTimeout(handT);
    handT = setTimeout(hideHand, 6000);
  }
  function hideHand() { const h = $('tp-hand'); if (h) h.classList.add('hidden'); clearTimeout(handT); }
  function setArenaCss() {
    const a = TA().arena(arenaIdx);
    document.documentElement.style.setProperty('--td-arena-bg', `url("${TA().art(a, 'bg')}")`);
    document.documentElement.style.setProperty('--td-pit-bg', `url("${TA().art(a, 'pit')}")`);
  }

  // ---------- the lobby: «Así se juega» + this match's arena (the shared skin calls lobby(head)) ----------
  let lobbyBox = null;
  function lobby(head) {
    if (!head) { if (lobbyBox) { lobbyBox.remove(); lobbyBox = null; } return; }
    if (!lobbyBox || !lobbyBox.isConnected) {
      lobbyBox = el('div', 'tp-lobby');
      lobbyBox.innerHTML = '<div class="tp-lobby-arena"><img id="tp-lobby-bg" src="/assets/trapdoor/dubai/bg.webp" alt=""><div><small id="tp-lobby-n">La arena</small><b id="tp-lobby-name"></b><span id="tp-lobby-rounds"></span></div></div>'
        + '<div class="tp-lobby-title">Así se juega</div><ol class="tp-lobby-steps">'
        + '<li><span class="tp-step-ico tap">👆</span><span><b>Toca el suelo</b>tu personaje corre ahí</span></li>'
        + '<li><span class="tp-step-ico pink"><i></i></span><span><b>¡Huye del rosa!</b>en el 0, el suelo rosa se abre</span></li>'
        + '<li><span class="tp-step-ico wings"><img src="/assets/trapdoor/wings.webp" alt=""></span><span><b>Responde bien: ¡alas!</b>te salvan una vez · ¿caíste? responde y vuelves</span></li></ol>';
      head.after(lobbyBox);
    }
    paintLobby();
  }
  function paintLobby() {
    if (!lobbyBox || !TA()) return;
    const a = TA().arena(arenaPick);
    $('tp-lobby-bg').src = TA().art(a, 'bg');
    $('tp-lobby-name').textContent = a.name;
    $('tp-lobby-rounds').textContent = `${roundsPick} rondas · la última vale doble`;
    if (TR()) TR().load(arenaPick);
  }

  window.TrapdoorPhone = {
    init, lobby,
    debug: () => ({ on, me: me && Object.assign({}, me), myK, myState: Object.assign({}, myState), score, rd, paused, finalOn, skew, card: isCardUp(), cur: cur && Object.assign({}, cur), arena: arenaIdx }),
    // test hooks: headless browsers barely deliver animation frames, so step and draw by hand
    advance: (sec) => {
      if (!scene || !me) return null;
      const n = Math.round((sec || 0) * 60);
      for (let k = 0; k < n; k++) stepMe(1 / 60);
      frameAt(performance.now(), 1 / 60);
      hud(true);
      return { x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10 };
    },
    tapWorld: (x, y) => { runTo(x, y, true); return me ? [me.tx, me.ty] : null; },
    answer: (i) => { if (cur) cur.armAt = 0; answer(i); },
    moment: (m) => moment(m),
    band: (t, s, cls) => band(t, s, cls, 60000),
    run: (v) => { run(v === true ? 'run' : v === false ? 'safe' : v); clearTimeout(runT); },
    help: (v) => { const c = $('tp-help'); if (!c) return; if (v) { paintHelp(c); c.classList.remove('hidden'); clearTimeout(helpT); } else hideHelp(); },
    hand: (v) => (v ? showHand() : hideHand()),
    // hold the round's clock at `ms` into the round (a still for a screenshot), or let it run again (null)
    hold: (ms) => { if (!scene || !scene.rd) return; if (ms == null) { scene.paused = false; return; } scene.paused = true; scene.pausedAt = scene.rd.start + ms; },
    state: (st) => { myState = Object.assign({}, myState, st); meState(true); },
    frame: () => { if (scene) frameAt(performance.now(), 1 / 60); hud(true); },
    scene: () => scene,
  };
})();
