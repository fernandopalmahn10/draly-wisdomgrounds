// Reinos de Colores — phone side. After a right answer the kid sees the whole map with the tiles they may take
// glowing; one tap plants the flag. If they don't tap in time, the server plants for them.
// player.js calls KingdomsPhone.init(...) once and KingdomsPhone.prompt(payload) after a right answer.
// The phone's map only changes from server messages (kd:init / kd:plant), so it can never drift from the server.
(function () {
  let ctx = null;            // { socket, getPin, getTeam, showScreen, markActivity }
  let boardData = null;
  let own = {};
  let view = null;           // KdBoard instance on the phone
  let ringTimer = null;
  let waitingMine = false;
  let ended = false;
  let picking = null;        // { ids, onPick } while the kid is choosing
  let prompts = 0;           // plant screens seen this session: the first two show a "tap here" hand
  let lmShownAt = 0;         // when «¡Conquistaste…!» appeared (the 2nd flag of a double must not wipe it at once)

  const $ = (id) => document.getElementById(id);
  const active = () => { if (ctx && ctx.markActivity) ctx.markActivity(); };
  const flagPose = () => '/assets/kingdoms/dralingo/flag' + (ctx && ctx.getTeam() === 'red' ? '-red' : '') + '.webp';

  function init(c) {
    ctx = c;
    const s = c.socket;
    if (window.KingdomsSkin) window.KingdomsSkin.init(c);
    s.on('kd:init', (d) => {
      ended = false;
      boardData = d.board;
      own = Object.assign({}, d.own);
      view = null;            // rebuilt lazily on the next prompt
      hideHand();
    });
    s.on('kd:plant', (d) => {
      active();
      if (d.tile !== null && d.tile !== undefined) own[d.tile] = d.team;
      (d.flipped || []).forEach((f) => { own[f.id] = d.team; });
      const mine = d.playerId === s.id;
      if (view) {
        if (d.tile !== null && d.tile !== undefined) view.set(d.tile, d.team, mine ? 'pop' : null);
        (d.flipped || []).forEach((f) => view.set(f.id, d.team, mine ? 'flip' : null));
        // Tiles another kid just took for my team no longer need my flag.
        if (picking) {
          const team = ctx.getTeam();
          const left = picking.ids.filter((id) => own[id] !== team);
          if (left.length !== picking.ids.length) { picking.ids = left; view.targets(left, picking.onPick); }
        }
      }
      if (!ended) news(d, mine);
      if (mine && typeof d.playerScore === 'number' && $('player-score')) $('player-score').textContent = d.playerScore;
      if (mine && d.fallback && view) Object.keys(view.nodes).forEach((id) => view.set(+id, own[id] || null)); // undo the optimistic tile
      if (mine && waitingMine) {
        waitingMine = false;
        hideHand();
        const nf = (d.flipped || []).length;
        const lms = (d.events || []).filter((ev) => ev.type === 'landmark' && KdBoard.LANDMARKS[ev.lm]);
        const msg = d.auto ? 'Dralingo plantó tu bandera 🐉'
          : d.fallback ? 'Esa casilla ya era tuya: Dralingo eligió otra 🐉'
          : nf ? `¡Rodeaste ${nf === 1 ? '1 casilla' : nf + ' casillas'}! 🔁` : '¡Bandera plantada! 🚩';
        $('kdp-done').textContent = msg;
        // The landmark party is for a kid who tapped; an auto-plant just says Dralingo planted it (waiting must not pay).
        if (lms.length && !d.auto) landmarkWin(lms[0]);
        else if (nf && window.Rewards && window.Rewards.show) window.Rewards.show({ tier: nf >= 3 ? 'epic' : 'rare', icon: '🔁', text: `+${nf}`, duration: 1400 });
        if (navigator.vibrate) navigator.vibrate(nf || lms.length ? [40, 40, 80] : 40);
      }
    });
    s.on('kd:prompt', prompt);
    s.on('kd:pause', (d) => { if (d && d.paused) { stopRing(); if (view) view.targets([], null); picking = null; hideHand(); } });
  }

  // What the rest of the class just did, on my phone (his rule «no dead phones», 2026-10-16): the projector's big
  // moments come as one banner at the top edge (js/party.js news: never over the answer tiles, one at a time, queued):
  // a Dubai landmark won or lost, a castle in danger, a siege, my kingdom passing ahead (with my captain's line), a big
  // surround by a teammate. Throttled so 30 kids planting never turns into noise; everything comes from the kd:plant
  // diffs every phone already gets (no new network traffic).
  const SHORT = { red: 'Fuego', gold: 'Mar' };
  const newsAt = {};
  function newsOk(kind, gap) { const t = Date.now(); if (t - (newsAt[kind] || 0) < gap) return false; newsAt[kind] = t; return true; }
  function news(d, mine) {
    const P = window.DralyParty;
    if (!P || !ctx) return;
    const team = ctx.getTeam();
    const other = team === 'red' ? 'gold' : 'red';
    const cap = window.KingdomsSkin && window.KingdomsSkin.captain ? window.KingdomsSkin.captain() : null;
    const C = window.DralingoCast;
    (d.events || []).forEach((ev) => {
      if (ev.type === 'landmark') {
        const L = KdBoard.LANDMARKS[ev.lm];
        if (!L || (mine && !d.auto)) return;          // my own tap already shows «¡Conquistaste …!» big
        if (!newsOk('lm', 3000)) return;
        if (ev.team === team) P.news(`🏙️ ¡${ev.by} conquistó ${L.the}!`, { sub: `+${ev.bonus || L.bonus} para tu reino`, kind: team, key: 'lm' + ev.tile });
        else P.news(`😮 ¡El ${SHORT[ev.team]} ${ev.from === team ? 'le quitó a tu reino' : 'conquistó'} ${L.the}!`, { sub: '¡Recupéralo con tus banderas!', kind: other, key: 'lm' + ev.tile });
      } else if (ev.type === 'castle-alert') {
        if (ev.team === team) P.news('🏰 ¡Defiendan su castillo!', { sub: 'Planten banderas junto al castillo', kind: 'alarm', cast: cap, pose: 'hello', key: 'castle' + ev.team });
        else P.news(`🏰 ¡El castillo del ${SHORT[ev.team]} está casi rodeado!`, { sub: '¡Unas banderas más y es asedio!', kind: team, key: 'castle' + ev.team });
      } else if (ev.type === 'siege') {
        if (ev.by === team) P.news('⚔️ ¡Asedio! Rodearon el castillo', { sub: `+${ev.bonus} para tu reino`, kind: 'star', cast: cap, key: 'siege' });
        else P.news(`⚔️ ¡El ${SHORT[ev.by]} rodeó su castillo!`, { sub: '¡Sigan plantando, todo puede cambiar!', kind: 'alarm', key: 'siege' });
      } else if (ev.type === 'lead' && ev.team) {
        if (!newsOk('lead', 7000)) return;
        if (ev.team === team) P.news('🔥 ¡Tu reino pasa adelante!', { sub: C && cap ? `${C.name(cap)}: «${C.line(cap, 'battle')}»` : '¡Sigan así!', kind: team, cast: cap, key: 'lead' });
        else P.news(`¡El ${SHORT[ev.team]} pasa adelante!`, { sub: '¡A recuperarlo! Responde y planta', kind: other, key: 'lead' });
      }
    });
    const n = (d.flipped || []).length;
    if (!mine && d.team === team && n >= 3 && !(d.events || []).some((ev) => ev.type === 'landmark') && newsOk('surround', 5000)) {
      P.news(`🔁 ¡${d.by} rodeó ${n} casillas!`, { sub: 'para tu reino', kind: team, key: 'sur' });
    }
  }

  // The kid's flag took a Dubai landmark: the piece pops up big on their phone with its bonus.
  function landmarkWin(ev) {
    const L = KdBoard.LANDMARKS[ev.lm];
    const box = $('kdp-done');
    box.textContent = '';
    const img = document.createElement('img');
    img.className = 'kdp-lm-pop';
    img.alt = '';
    img.src = KdBoard.LM_SRC(ev.lm);
    const bonus = ev.bonus || L.bonus;
    const t = document.createElement('span');
    t.textContent = `¡Conquistaste ${L.the}! +${bonus}`;
    box.append(img, t);
    lmShownAt = Date.now();
    if (window.KingdomsSkin) window.KingdomsSkin.sfx('landmark', 0.85);
    if (window.Rewards && window.Rewards.show) window.Rewards.show({ tier: 'epic', icon: '🏙️', text: `+${bonus}`, duration: 1600 });
  }

  // First plants of the session: a big hand taps a glowing tile (a landmark if one is in reach).
  function showHand(ids) {
    hideHand();
    if (!view || !ids.length) return;
    const lm = ids.find((id) => boardData.landmarks && boardData.landmarks[id]);
    let pick = lm;
    if (pick === undefined) {
      let best = Infinity;
      ids.forEach((id) => { const n = view.nodes[id]; const dd = n.cx * n.cx + n.cy * n.cy; if (dd < best) { best = dd; pick = id; } });
    }
    const p = view.screenPoint(pick);
    if (!p) return;
    const hand = document.createElement('div');
    hand.className = 'kdp-hand';
    hand.id = 'kdp-hand';
    hand.innerHTML = '<span>👆</span><b>¡Toca!</b>';
    hand.style.left = p.x + 'px';
    hand.style.top = p.y + 'px';
    $('screen-kd-plant').appendChild(hand);
  }
  function hideHand() { const h = $('kdp-hand'); if (h) h.remove(); }

  function prompt(p) {
    if (ended || !ctx || !boardData || !p || !p.needsPlant) return;
    active();
    const team = ctx.getTeam();
    ctx.showScreen('kd-plant');
    $('screen-kd-plant').classList.remove('kdp-red', 'kdp-gold');
    $('screen-kd-plant').classList.add('kdp-' + team);
    $('kdp-title').innerHTML = '';
    $('kdp-title').append(
      document.createTextNode('¡Toca una casilla que brilla!'),
      Object.assign(document.createElement('small'), { textContent: 'junto a tu reino 🚩' }),
      Object.assign(document.createElement('span'), { className: 'kdp-team ' + team, textContent: team === 'red' ? 'Reino del Fuego' : 'Reino del Mar' }),
    );
    $('kdp-flags').innerHTML = '';
    $('kdp-flags').appendChild(Object.assign(document.createElement('img'), { className: 'kdp-flag-pose', alt: '', src: flagPose() }));
    if ((p.flags || 1) > 1) $('kdp-flags').appendChild(Object.assign(document.createElement('b'), { textContent: '×2' }));
    if (Date.now() - lmShownAt > 2500) $('kdp-done').textContent = (p.flags || 1) > 1 ? '¡Bandera doble por 3 aciertos seguidos!' : '';
    if (!view) view = KdBoard.create($('kdp-board'), boardData, own, { grass: '/assets/kingdoms/grass.png', castle: '/assets/kingdoms/castle.png' });
    else Object.keys(view.nodes).forEach((id) => view.set(+id, own[id] || null));
    waitingMine = true;
    let tapped = false;
    const onPick = (tile) => {
      if (tapped) return;
      tapped = true;
      picking = null;
      hideHand();
      view.targets([], null);
      view.set(tile, team, 'pop');          // instant feedback; the server's kd:plant confirms or repaints it
      $('kdp-done').textContent = '🚩 …';
      if (window.KingdomsSkin) window.KingdomsSkin.sfx('plant', 0.8);
      ctx.socket.emit('player:kd-plant', { pin: ctx.getPin(), tile });
      stopRing();
      active();
    };
    picking = { ids: (p.valid || []).slice(), onPick };
    view.targets(picking.ids, onPick);
    // Zoom onto the glowing tiles (the screen is visible now, so the svg has its size); the first two times a hand
    // shows where to tap once the zoom has settled.
    const coach = prompts++ < 2;
    view.focus(picking.ids, () => {
      if (coach && picking && picking.onPick === onPick) showHand(picking.ids);
    });
    startRing(p.plantMs || 8000);
  }

  function startRing(ms) {
    stopRing();
    const end = Date.now() + ms;
    const ring = $('kdp-ring');
    const paint = () => {
      const left = Math.max(0, end - Date.now());
      ring.style.setProperty('--p', (left / ms).toFixed(3));
      ring.querySelector('span').textContent = Math.ceil(left / 1000);
      return left;
    };
    paint();                             // the full ring right away (not the last prompt's number)
    ringTimer = setInterval(() => {
      if (paint() <= 0) { stopRing(); picking = null; hideHand(); if (view) view.targets([], null); }
    }, 100);
  }
  function stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } }
  function stop() { stopRing(); hideHand(); waitingMine = false; picking = null; ended = true; }

  window.KingdomsPhone = { init, prompt, stop };
})();
