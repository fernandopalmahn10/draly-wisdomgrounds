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

  const $ = (id) => document.getElementById(id);
  const active = () => { if (ctx && ctx.markActivity) ctx.markActivity(); };

  function init(c) {
    ctx = c;
    const s = c.socket;
    if (window.KingdomsSkin) window.KingdomsSkin.init(c);
    s.on('kd:init', (d) => {
      ended = false;
      boardData = d.board;
      own = Object.assign({}, d.own);
      view = null;            // rebuilt lazily on the next prompt
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
      if (mine && typeof d.playerScore === 'number' && $('player-score')) $('player-score').textContent = d.playerScore;
      if (mine && d.fallback && view) Object.keys(view.nodes).forEach((id) => view.set(+id, own[id] || null)); // undo the optimistic tile
      if (mine && waitingMine) {
        waitingMine = false;
        const nf = (d.flipped || []).length;
        const msg = d.auto ? 'Dralingo plantó tu bandera 🐉'
          : d.fallback ? 'Esa casilla ya era tuya: Dralingo eligió otra 🐉'
          : nf ? `¡Rodeaste ${nf === 1 ? '1 casilla' : nf + ' casillas'}! 🔁` : '¡Bandera plantada! 🚩';
        $('kdp-done').textContent = msg;
        if (nf && window.Rewards && window.Rewards.show) window.Rewards.show({ tier: nf >= 3 ? 'epic' : 'rare', icon: '🔁', text: `+${nf}`, duration: 1400 });
        if (navigator.vibrate) navigator.vibrate(nf ? [40, 40, 80] : 40);
      }
    });
    s.on('kd:prompt', prompt);
  }

  function prompt(p) {
    if (ended || !ctx || !boardData || !p || !p.needsPlant) return;
    active();
    const team = ctx.getTeam();
    ctx.showScreen('kd-plant');
    $('kdp-title').innerHTML = '';
    $('kdp-title').append(
      document.createTextNode('¡Planta tu bandera!'),
      Object.assign(document.createElement('small'), { textContent: 'Toca una casilla con 🚩' }),
      Object.assign(document.createElement('span'), { className: 'kdp-team ' + team, textContent: team === 'red' ? 'Reino del Fuego' : 'Reino del Mar' }),
    );
    $('kdp-flags').innerHTML = '<img class="kdp-flag-pose" alt="" src="/assets/kingdoms/dralingo/flag.webp">' + ((p.flags || 1) > 1 ? '<b>×2</b>' : '');
    $('kdp-done').textContent = (p.flags || 1) > 1 ? '¡Bandera doble por 3 aciertos seguidos!' : '';
    if (!view) view = KdBoard.create($('kdp-board'), boardData, own, { grass: '/assets/kingdoms/grass.png', castle: '/assets/kingdoms/castle.png' });
    else Object.keys(view.nodes).forEach((id) => view.set(+id, own[id] || null));
    waitingMine = true;
    let tapped = false;
    const onPick = (tile) => {
      if (tapped) return;
      tapped = true;
      picking = null;
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
    startRing(p.plantMs || 8000);
  }

  function startRing(ms) {
    stopRing();
    const end = Date.now() + ms;
    const ring = $('kdp-ring');
    ringTimer = setInterval(() => {
      const left = Math.max(0, end - Date.now());
      ring.style.setProperty('--p', (left / ms).toFixed(3));
      ring.querySelector('span').textContent = Math.ceil(left / 1000);
      if (left <= 0) { stopRing(); picking = null; if (view) view.targets([], null); }
    }, 100);
  }
  function stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } }
  function stop() { stopRing(); waitingMine = false; picking = null; ended = true; }

  window.KingdomsPhone = { init, prompt, stop };
})();
