// DralyParty — the Mario Party ending (and the small «in between» pieces) shared by Reinos de Colores (kingdoms),
// Dragones Pintores (paint), Batalla de Nieve en Ski Dubái (snow) and La Gran Fuga de Dubái (escape). His rules
// «Feelings at the end of class» and «Feelings in between too: no dead phones» (mochi-mash/CLAUDE.md).
//   final(o)        «¡FINAL!» on a phone or the projector (the server's 2.4 s beat, then game-end)
//   Ceremony(o)     the show: the reveal (suspense) → the winners celebrate, the others react → the bonus stars one by
//                   one → the phone's own card / the projector's podium + «Otra ronda». «Saltar» jumps to the end.
//   news(text, o)   a phone banner at the top edge (never over the answer tiles), one at a time, queued
//   chip(text, ms)  a small corner chip with a countdown (the last 30 s)
//   card(game, me, fin) / starValue(game, star)   the Spanish lines (pure: scripts/test-party.js checks them; a kid with
//                   nothing to show never reads «0»)
// Built on js/mochi-stage.js (full-body kid figures, confetti, stars, count-ups) and js/halcon-board.js (the saga art);
// styles in css/party.css (+ the .mmk figure, .mm-star and .mm-confetti rules of css/mochi.css).
// Loads in the browser (window.DralyParty) and in node for the tests (module.exports: the pure parts only).
(function (root, factory) {
  const P = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = P;
  else root.DralyParty = P;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  const DOM = typeof document !== 'undefined';
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('es-ES');
  const pl = (n, one, many) => `${fmt(n)} ${Math.round(Number(n) || 0) === 1 ? one : many}`;
  const dec = (v) => String(v).replace('.', ',');
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ======================================== the four games (pure) ========================================
  const KD_SIDES = {
    red: { id: 'red', name: 'Reino del Fuego', short: 'Fuego', fig: 'red', ico: '🔥' },
    gold: { id: 'gold', name: 'Reino del Mar', short: 'Mar', fig: 'gold', ico: '🌊' },
  };
  const GAMES = {
    kingdoms: {
      title: 'Reinos de Colores', reveal: 'columns', sides: KD_SIDES, order: ['red', 'gold'],
      unit: ['punto', 'puntos'], question: '¿Qué reino conquistó más de Dubái?',
      winTitle: (s) => `¡El ${s.name} conquista Dubái!`, tieTitle: '¡Empate de reinos!',
      champion: (s) => `¡Campeón: ${s.name}!`, tieChampion: '¡Empate en Dubái!',
      mood: 'reino', myLabel: 'Tu reino',
      mvpLabel: (s) => `Más puntos del ${s.name}`,
      ico: { tiles: '🚩', big: '🔁', streak: '🔥', lms: '🏙️' },
      value: (id, v) => (id === 'tiles' ? pl(v, 'casilla', 'casillas') : id === 'big' ? `${pl(v, 'casilla', 'casillas')} de una vez`
        : id === 'streak' ? `${fmt(v)} seguidas` : pl(v, 'monumento', 'monumentos')),
      podium: (r) => pl(r.value, 'punto', 'puntos'),
    },
    paint: {
      title: 'Dragones Pintores', reveal: 'columns', sides: KD_SIDES, order: ['red', 'gold'],
      unit: ['punto', 'puntos'], question: '¿Qué reino ganó el cielo?',     // v2: clouds + 10 per island held
      winTitle: (s) => `¡El ${s.name} pintó el cielo!`, tieTitle: '¡Empate en el cielo!',
      champion: (s) => `¡Campeón del cielo: ${s.name}!`, tieChampion: '¡Empate en el cielo!',
      mood: 'pintado', myLabel: 'Tu reino',
      mvpLabel: (s) => `Más cielo del ${s.name}`,
      ico: { painted: '🎨', lm: '🏝️', sky: '☁️', streak: '🔥', blaze: '🔥' },
      value: (id, v) => (id === 'painted' ? pl(v, 'nube pintada', 'nubes pintadas') : id === 'lm' ? pl(v, 'maravilla conquistada', 'maravillas conquistadas') : id === 'sky' ? `${pl(v, 'nube', 'nubes')} con su color al final`
        : id === 'streak' ? `${fmt(v)} seguidas` : pl(v, 'llamarada', 'llamaradas')),
      podium: (r) => `${pl(r.value, 'nube', 'nubes')} al final`,
    },
    snow: {
      title: 'Batalla de Nieve en Ski Dubái', reveal: 'frost',
      sides: {
        sun: { id: 'sun', name: 'Supervivientes', short: 'Sol', fig: 'sun', ico: '☀️' },
        ice: { id: 'ice', name: 'Equipo Hielo', short: 'Hielo', fig: 'ice', ico: '❄️' },
      },
      order: ['sun', 'ice'], unit: ['punto', 'puntos'], question: '¿Quedó alguien sin congelar?',
      winTitle: (s) => (s.id === 'sun' ? '¡Ganaron los supervivientes!' : '¡Ganó el Equipo Hielo!'), tieTitle: '¡Empate!',
      champion: (s) => (s.id === 'sun' ? '¡Sobrevivieron al Hechizo de Hielo!' : '¡El Equipo Hielo congeló Ski Dubái!'), tieChampion: '¡Empate!',
      mood: 'nieve', myLabel: 'Tu equipo',
      mvpLabel: (s) => (s.id === 'sun' ? 'Más tiempo sin congelarse' : 'Más congelados del Equipo Hielo'),
      ico: { survive: '☀️', freeze: '❄️', right: '✅', hits: '🎯' },
      value: (id, v) => (id === 'survive' ? `${fmt(v)} s sin congelarse` : id === 'freeze' ? pl(v, 'congelado', 'congelados')
        : id === 'right' ? pl(v, 'acierto', 'aciertos') : pl(v, 'bola certera', 'bolas certeras')),
      podium: (r) => pl(r.value, 'punto', 'puntos'),
    },
    escape: {
      title: 'La Gran Fuga de Dubái', reveal: 'route', coop: true, sides: { crew: { id: 'crew', name: 'La tripulación', fig: 'crew', ico: '🚀' } },
      order: ['crew'], unit: ['turbo', 'turbos'], question: '¿Hasta dónde llegó la tripulación?',
      mood: 'chase', myLabel: 'Tu tripulación',
      ico: { turbos: '🚀', fast: '⚡', streak: '🔥', safe: '🟢' },
      value: (id, v) => (id === 'turbos' ? pl(v, 'turbo', 'turbos') : id === 'fast' ? `${dec(v)} s en promedio`
        : id === 'streak' ? `${fmt(v)} seguidas` : pl(v, 'ola a salvo', 'olas a salvo')),
    },
  };
  // La Gran Fuga v2: each round is a route of three places (js/escape-map.js ROUTES); its names come from the round
  const ESC_LEVELS = ['Museo del Futuro', 'La Fuente del Burj Khalifa', 'La pista del aeropuerto'];
  const escMap = () => root.EscapeMap || (typeof globalThis !== 'undefined' ? globalThis.EscapeMap : null);
  const escZones = (ex) => (escMap() ? escMap().zonesOf((ex && ex.route) || 0) : ESC_LEVELS.map((name) => ({ name, icon: '/assets/dralingo/hello.webp' })));
  const escReached = (ex) => escZones(ex)[Math.max(0, Math.min(2, ((ex && ex.level) || 1) - 1))].name;
  const ESC_RANK_ART = { cielo: '/assets/saga/avatars/plane.webp', burj: '/assets/kingdoms/landmarks/big/burj.webp', zoco: '/assets/saga/avatars/camel.webp' };
  const escRankArt = (rk) => (rk && rk.art) || ESC_RANK_ART[rk && rk.id] || ESC_RANK_ART.zoco;

  function starValue(game, st) {
    const G = GAMES[game];
    if (!G || !st) return '';
    return (st.n > 4 ? `y ${st.n - 4} más · ` : '') + G.value(st.id, st.value);
  }
  function starIcon(game, id) { const G = GAMES[game]; return (G && G.ico[id]) || '⭐'; }

  // The phone's own card in words. Everything shown is something the kid did: a number that would be 0 is never shown;
  // a kid with nothing gets an encouraging line instead («¡La próxima es tuya!»).
  //   → { title, big: { pre, n, post } | { text }, sub, facts: [[value, label]], zero }
  function card(game, me, fin) {
    me = me || {}; fin = fin || {};
    const G = GAMES[game] || GAMES.kingdoms;
    if (me.guest || !me.team) return { title: '¡Qué ronda!', big: { text: '¡La próxima es tuya!' }, sub: 'Tu profe puede empezar otra ronda en un momento', facts: [], zero: true };
    const facts = [];
    const fact = (v, label) => { if (v) facts.push([String(v), label]); };
    // right answers as «4/6 aciertos»; a kid with none right sees how many questions they played, never «0 aciertos»
    const aciertos = () => {
      if (me.right > 0) fact(me.answered > 0 ? `${fmt(me.right)}/${fmt(me.answered)}` : fmt(me.right), me.right === 1 ? 'acierto' : 'aciertos');
      else if (me.answered > 0) fact(fmt(me.answered), me.answered === 1 ? 'pregunta jugada' : 'preguntas jugadas');
    };
    const side = G.sides[me.team] || G.sides[G.order[0]];
    const won = !!me.won, tie = !!me.tie;
    let title, big, sub, zero = false;
    if (game === 'kingdoms') {
      title = tie ? '¡Empate! ¡Qué batalla!' : won ? '¡Tu reino conquistó Dubái!' : `¡Buen intento, ${side.name}!`;
      if (me.points > 0 || me.tiles > 0) {
        big = me.points > 0 ? { pre: 'Ganaste ', n: me.points, post: me.points === 1 ? ' punto para tu reino' : ' puntos para tu reino' }
          : { pre: 'Conquistaste ', n: me.tiles, post: me.tiles === 1 ? ' casilla' : ' casillas' };
        sub = me.share >= 1 ? `Conquistaste el ${me.share} % del territorio de tu reino` : '¡Cada casilla cuenta para tu reino!';
      } else { zero = true; }
      if (me.tiles > 0) fact(me.tiles, me.tiles === 1 ? 'casilla' : 'casillas');
      if (me.lms > 0) fact(me.lms, me.lms === 1 ? 'monumento' : 'monumentos');
      if (me.best >= 2) fact(me.best, 'racha');
      aciertos();
      if (zero) sub = 'Responde bien y planta tu bandera en Dubái';
    } else if (game === 'paint') {
      title = tie ? '¡Empate en el cielo!' : won ? '¡Tu reino pintó el cielo!' : `¡Buen intento, ${side.name}!`;
      if (me.painted > 0) {
        big = { pre: 'Pintaste ', n: me.painted, post: me.painted === 1 ? ' nube' : ' nubes' };
        sub = me.owned > 0 ? `${pl(me.owned, 'nube sigue', 'nubes siguen')} con tu color al final` : '¡Cada nube cuenta para tu reino!';
      } else if (me.lms > 0) {
        big = { pre: 'Conquistaste ', n: me.lms, post: me.lms === 1 ? ' maravilla' : ' maravillas' };
        sub = '¡Cada maravilla vale +10 para tu reino!';
      } else { zero = true; sub = 'Toca el cielo para volar, pinta nubes y conquista maravillas'; }
      if (me.lms > 0 && me.painted > 0) fact(me.lms, me.lms === 1 ? 'maravilla' : 'maravillas');
      aciertos();
      if (me.best >= 2) fact(me.best, 'racha');
      if (me.blazes > 0) fact(me.blazes, me.blazes === 1 ? 'llamarada' : 'llamaradas');
    } else if (game === 'snow') {
      const sun = me.side === 'sun';
      title = sun ? '¡Sobreviviste! ☀️' : fin.winner === 'ice' ? '¡El Equipo Hielo ganó! ❄️' : '¡Buen intento, Equipo Hielo!';
      if (sun && me.seconds > 0) big = { pre: 'Aguantaste toda la ronda: ', n: me.seconds, post: ' s' };
      else if (me.freezes > 0) big = { pre: 'Congelaste a ', n: me.freezes, post: me.freezes === 1 ? ' amigo' : ' amigos' };
      else if (me.spell) big = { text: '¡El Hechizo te eligió para el Equipo Hielo!' };
      else if (me.seconds >= 5) big = { pre: 'Aguantaste ', n: me.seconds, post: ' s sin congelarte' };
      else zero = true;
      sub = sun ? '¡El Hechizo de Hielo no pudo contigo!' : me.spell ? (me.freezes > 0 ? '¡El Hechizo te eligió para cazar!' : '¡Cada bola de nieve cuenta!')
        : me.freezes > 0 && me.seconds > 0 ? `Y antes aguantaste ${fmt(me.seconds)} s sin congelarte` : '¡Cada bola de nieve cuenta!';
      if (zero) sub = 'Junta copos en las estaciones y corre del hielo';
      if (sun && me.freezes > 0) fact(me.freezes, me.freezes === 1 ? 'congelado' : 'congelados');
      aciertos();
      if (me.hits > 0) fact(me.hits, me.hits === 1 ? 'bola certera' : 'bolas certeras');
      if (me.score > 0) fact(me.score, me.score === 1 ? 'punto' : 'puntos');
    } else {     // escape (co-op): the crew's rank is the headline, the card says what this kid gave the crew
      const rk = (fin.extra && fin.extra.rank) || { name: 'Exploradores del Zoco' };
      title = `¡${rk.name}!`;
      if (me.turbos > 0) big = { pre: 'Diste ', n: me.turbos, post: me.turbos === 1 ? ' turbo a la tripulación' : ' turbos a la tripulación' };
      else if (me.safe > 0) big = { pre: 'Llegaste a salvo en ', n: me.safe, post: me.safe === 1 ? ' ola' : ' olas' };
      else zero = true;
      const ex = fin.extra || {};
      sub = ex.escaped ? '¡Escaparon en el jet de Hamdan!' : `La tripulación llegó hasta ${escReached(ex)}`;
      if (zero) sub = 'Cada respuesta correcta es un turbo para la tripulación';
      if (me.turbos > 0 && me.safe > 0) fact(me.safe, me.safe === 1 ? 'ola a salvo' : 'olas a salvo');
      if (me.supers > 0) fact(me.supers, me.supers === 1 ? 'súper turbo' : 'súper turbos');
      if (me.best >= 2) fact(me.best, 'racha');
      aciertos();
    }
    if (zero) big = { text: '¡La próxima es tuya!' };
    return { title, big, sub, facts: facts.slice(0, 4), zero };
  }

  const api = { GAMES, card, starValue, starIcon, fmt, pl };
  if (!DOM) return api;

  // ======================================== the browser parts ========================================
  const S = () => root.MochiStage;
  const C = () => root.DralingoCast;
  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SND = {
    final: '/assets/halcon/final.mp3', drum: '/assets/mochi/drum.mp3', star: '/assets/mochi/star.mp3', aww: '/assets/halcon/aww.mp3',
    win: '/assets/kingdoms/sting-win.mp3', whoosh: '/assets/kingdoms/whoosh.mp3', pop: '/assets/halcon/pop.mp3', freeze: '/assets/snow/freeze.mp3',
    jet: '/assets/escape/jet.mp3',
  };
  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  // a kid as a full-body figure in the side's colours (Fuego red, Mar blue, survivors amber, ice frosted, the crew gold)
  function figure(r, o) {
    o = o || {};
    const fig = (r && r.team) || 'gold';
    const f = S().kidFigure({ team: fig === 'red' ? 'red' : 'gold', skin: r.skin, name: r.name, me: !!o.me, pose: o.pose || 'ok', tag: o.tag });
    if (fig === 'sun' || fig === 'ice' || fig === 'crew') f.classList.add('pfk-' + fig);
    return f;
  }
  const castPose = (id, p) => (C() && id ? C().pose(id, p) : '/assets/dralingo/hello.webp');
  const castName = (id) => (C() && id ? C().name(id) : 'Dralingo');
  function castLine(id, mood, fallback) {
    if (!C() || !id) return fallback || '';
    const l = C().line(id, mood);
    return l || fallback || '';
  }

  // ---------- «¡FINAL!» ----------
  // o: { mode: 'phone' | 'host', ms, sub, play(url, vol), buzz(pattern) }
  let finalEl = null, finalT = 0;
  function final(o) {
    o = o || {};
    hideFinal();
    const box = el('div', 'pf-final ' + (o.mode === 'host' ? 'host' : 'phone'));
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'assertive');
    const band = el('div', 'pf-final-band');
    band.appendChild(el('b', null, '¡FINAL!'));
    if (o.sub) band.appendChild(el('span', null, o.sub));
    box.appendChild(band);
    document.body.appendChild(box);
    finalEl = box;
    if (o.play) o.play(SND.final, 0.9);
    if (o.buzz) o.buzz([90, 60, 200]);
    clearTimeout(finalT);
    finalT = setTimeout(hideFinal, (o.ms || 2400) + 1600);     // the ceremony normally replaces it before that
    return box;
  }
  function hideFinal() { clearTimeout(finalT); if (finalEl) finalEl.remove(); finalEl = null; }

  // ---------- the phone's news banner (top edge, under the score bar, one at a time) ----------
  let newsEl = null, newsQ = [], newsOn = false, newsHold = false, newsT = 0;
  function news(text, o) {
    o = o || {};
    if (!text) return;
    if (o.key && newsQ.some((x) => x.o.key === o.key)) return;      // the same news twice in the queue: once
    if (newsQ.length >= 3) newsQ.shift();                             // never a long backlog of old news
    newsQ.push({ text, o });
    if (!newsOn) nextNews();
  }
  function nextNews() {
    const it = newsQ.shift();
    if (!it) { newsOn = false; return; }
    newsOn = true;
    if (!newsEl) { newsEl = el('div', 'pf-news'); newsEl.setAttribute('role', 'status'); newsEl.setAttribute('aria-live', 'polite'); document.body.appendChild(newsEl); }
    newsEl.innerHTML = '';
    newsEl.className = 'pf-news ' + (it.o.kind || '');
    if (it.o.cast) { const im = el('img'); im.alt = ''; im.src = castPose(it.o.cast, it.o.pose || 'cheer'); newsEl.appendChild(im); }
    const t = el('div', 'pf-news-t');
    t.appendChild(el('b', null, it.text));
    if (it.o.sub) t.appendChild(el('span', null, it.o.sub));
    newsEl.appendChild(t);
    void newsEl.offsetWidth;
    newsEl.classList.add('show');
    clearTimeout(newsT);
    newsT = setTimeout(() => {
      if (newsHold) return;
      newsEl.classList.remove('show');
      newsT = setTimeout(nextNews, 260);
    }, it.o.ms || 2200);
  }
  function clearNews() { clearTimeout(newsT); newsQ = []; newsOn = false; if (newsEl) newsEl.classList.remove('show'); }

  // ---------- «⏸ Pausa» (Reinos / Pintores; Nieve and La Gran Fuga have their own cards) ----------
  // phone: a full-screen card «Mira a tu profe»; projector: a card in the middle, the dim layer lets clicks through so
  // «+30 s», «Terminar ronda» and «Sonido» keep working
  let pauseEl = null;
  function pauseCard(on, o) {
    o = o || {};
    if (!on) { if (pauseEl) pauseEl.remove(); pauseEl = null; return; }
    if (pauseEl) return;
    pauseEl = el('div', 'pf-pause ' + (o.mode === 'host' ? 'host' : 'phone'));
    pauseEl.setAttribute('role', 'status');
    const card = el('div', 'pf-pause-card');
    const im = el('img');
    im.alt = '';
    im.src = '/assets/dralingo/wise.webp';
    card.append(im, el('b', null, '⏸ Pausa'), el('span', null, o.mode === 'host' ? 'Todos quietos: miren al profe' : 'Mira a tu profe'));
    pauseEl.appendChild(card);
    document.body.appendChild(pauseEl);
  }

  // ---------- a corner chip with a countdown (the last 30 s) ----------
  let chipEl = null, chipT = 0;
  function chip(text, ms, kind) {
    clearChip();
    if (!(ms > 0)) return;
    chipEl = el('div', 'pf-chip ' + (kind || ''));
    document.body.classList.toggle('pf-chip-host', kind === 'host');
    chipEl.appendChild(el('b', null, text));
    const n = el('span');
    chipEl.appendChild(n);
    document.body.appendChild(chipEl);
    const end = Date.now() + ms;
    const paint = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      n.textContent = left + ' s';
      if (left <= 0) clearChip();
    };
    paint();
    chipT = setInterval(paint, 500);
  }
  function clearChip() { clearInterval(chipT); if (chipEl) chipEl.remove(); chipEl = null; document.body.classList.remove('pf-chip-host'); }

  // ======================================== the ceremony ========================================
  const REVEAL_MS = 3600, RESULT_MS = 3200, STAR_MS = 2100;
  let current = null;
  // o: { mode: 'phone' | 'host', game, data (the game-end payload), mount (element), play(url, vol), buzz(pattern),
  //      me: { name, skin } (phone fallbacks), onSkip(), onAgain(), onHome() }
  function Ceremony(o) {
    if (current) current.stop();
    this.o = o;
    this.mode = o.mode === 'host' ? 'host' : 'phone';
    this.G = GAMES[o.game] || GAMES.kingdoms;
    this.d = o.data || {};
    this.fin = this.d.fin || {};
    this.me = this.d.me || {};
    this.timers = [];
    this.stageName = null;
    const root0 = this.root = el('div', 'pf pf-' + this.mode + ' pf-g-' + o.game + (this.mode === 'phone' ? ' pf-mine-' + (this.me.team || '') : ''));
    root0.setAttribute('translate', 'no');
    this.box = el('div', 'pf-box');
    this.fx = el('div', 'pf-fx');
    root0.append(this.box, this.fx);
    const skip = this.skipBtn = el('button', 'pf-skip', this.mode === 'host' ? '⏭ Saltar' : 'Ver mi tarjeta');
    skip.type = 'button';
    skip.addEventListener('click', () => { if (this.mode === 'host' && o.onSkip) o.onSkip(); this.skip(); });
    root0.appendChild(skip);
    (o.mount || document.body).appendChild(root0);
    document.body.classList.add('pf-on');
    hideFinal();
    clearNews();
    clearChip();
    current = this;
    this.preload();
    const plan = [['reveal', REVEAL_MS], ['result', RESULT_MS]].concat((this.fin.stars || []).map((s, i) => ['star' + i, STAR_MS]));
    const ago = Math.max(0, +this.d.ago || 0);      // the ending sent again (a reload): how long ago the round ended
    let t = 0;
    plan.forEach(([name, ms]) => {
      const at = t;
      t += ms;
      if (t <= ago) return;                        // that stage is over for everybody else
      this.later(Math.max(0, at - ago), () => this.stage(name));
    });
    this.later(Math.max(0, t - ago), () => this.stage('end'));
  }
  Ceremony.prototype.later = function (ms, fn) { this.timers.push(setTimeout(fn, ms)); };
  Ceremony.prototype.clear = function () { this.timers.forEach(clearTimeout); this.timers = []; };
  Ceremony.prototype.stop = function () {
    this.clear();
    if (this.root) this.root.remove();
    this.root = null;
    if (current === this) current = null;
    document.body.classList.remove('pf-on');
  };
  Ceremony.prototype.skip = function () { this.clear(); this.stage('end'); };
  Ceremony.prototype.sfx = function (name, vol) { if (this.o.play && SND[name]) this.o.play(SND[name], vol == null ? 0.7 : vol); };
  Ceremony.prototype.buzz = function (p) { if (this.mode === 'phone' && this.o.buzz) this.o.buzz(p); };
  Ceremony.prototype.preload = function () {
    const f = this.fin;
    const rows = [].concat(...Object.values(f.crews || {}), f.top || [], ...(f.stars || []).map((s) => s.who || []));
    const seen = {};
    rows.forEach((r) => {
      if (!r || seen[r.skin]) return;
      seen[r.skin] = 1;
      ['ok', 'no'].forEach((p) => { const i = new Image(); i.src = S().kidArt(r.skin, p); });
    });
    // the captains' stickers of the show (suspense, cheer, the kind words): ~25 KB each, held per moment by cast.js
    Object.values(f.captains || {}).forEach((id) => ['wow', 'cheer', 'talk'].forEach((p) => { const i = new Image(); i.src = castPose(id, p); }));
  };
  Ceremony.prototype.fresh = function (cls) {
    this.box.innerHTML = '';
    this.fx.innerHTML = '';
    const s = el('div', 'pf-stage ' + cls);
    this.box.appendChild(s);
    return s;
  };
  Ceremony.prototype.side = function (id) { return this.G.sides[id] || { id, name: id, short: id, fig: 'gold' }; };
  Ceremony.prototype.mine = function (id) { return this.mode === 'phone' && this.me.team === id; };
  Ceremony.prototype.stage = function (name) {
    if (!this.root) return;
    this.stageName = name;
    try {
      if (name === 'reveal') return this.reveal();
      if (name === 'result') return this.result();
      if (name.indexOf('star') === 0) return this.star(Number(name.slice(4)));
      if (name === 'end') { this.clear(); this.skipBtn.remove(); return this.mode === 'host' ? this.podium() : this.card(); }
    } catch (e) { if (root.console) console.error('[party] stage', name, e); }
  };

  // ---------- 1 · the reveal ----------
  Ceremony.prototype.reveal = function () {
    const G = this.G;
    const s = this.fresh('reveal pf-r-' + G.reveal);
    s.appendChild(el('h2', 'pf-h', G.question));
    if (G.reveal === 'columns') this.revealColumns(s);
    else if (G.reveal === 'frost') this.revealFrost(s);
    else this.revealRoute(s);
  };
  Ceremony.prototype.revealColumns = function (s) {
    const f = this.fin, t = f.totals || {};
    const row = el('div', 'pf-cols');
    const max = Math.max(1, ...this.G.order.map((id) => t[id] || 0));
    this.G.order.forEach((id) => {
      const sd = this.side(id), v = t[id] || 0, k = v / max;
      const col = el('div', 'pf-col pf-' + id + (this.mine(id) ? ' mine' : ''));
      const cap = el('img', 'pf-col-cap');
      cap.alt = '';
      cap.src = castPose(f.captains && f.captains[id], 'wow');     // the suspense: who wins?
      const tube = el('div', 'pf-tube');
      const fill = el('i');
      tube.appendChild(fill);
      const n = el('b', 'pf-col-n', '0');
      const nrow = el('div', 'pf-col-nrow');
      nrow.append(n, el('small', 'pf-col-unit', v === 1 ? this.G.unit[0] : this.G.unit[1]));
      col.append(cap, tube, nrow, el('span', 'pf-col-name', this.mine(id) ? this.G.myLabel : sd.name));
      const lms = (f.extra && f.extra.lms && f.extra.lms[id]) || [];
      if (lms.length) {
        const lrow = el('div', 'pf-col-lms');
        lms.slice(0, 5).forEach((key, i) => {
          const im = el('img');
          im.alt = '';
          im.src = '/assets/kingdoms/landmarks/' + key + '.webp';
          im.style.setProperty('--i', i);
          lrow.appendChild(im);
        });
        col.appendChild(lrow);
      }
      row.appendChild(col);
      const ms = 600 + 2300 * k;
      if (reduced()) { fill.style.transform = `scaleY(${k})`; n.textContent = fmt(v); }
      else {
        fill.animate([{ transform: 'scaleY(0)' }, { transform: `scaleY(${k})` }], { duration: ms, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
        S().countUp(n, 0, v, ms);
      }
    });
    s.appendChild(row);
    this.sfx('drum', 0.75);
  };
  Ceremony.prototype.revealFrost = function (s) {
    const f = this.fin, t = f.totals || {};
    const total = Math.max(1, t.total || ((t.sun || 0) + (t.ice || 0)));
    const ice = t.ice || 0, k = Math.min(1, ice / total);
    const meter = el('div', 'pf-frost');
    const fill = el('i');
    const flake = el('span', 'pf-frost-flake', '❄️');
    meter.append(fill, flake);
    const n = el('p', 'pf-frost-n');
    const nb = el('b', null, '0');
    n.append(nb, document.createTextNode(` de ${fmt(total)} congelados`));
    const after = el('div', 'pf-frost-after');
    s.append(meter, n, after);
    const done = () => {
      if (this.stageName !== 'reveal') return;
      if (f.winner === 'sun') {
        after.appendChild(el('div', 'pf-stamp sun', `☀️ ¡${t.sun === 1 ? 'Queda 1' : 'Quedan ' + fmt(t.sun)}!`));
        const crew = el('div', 'pf-frost-crew');
        ((f.crews && f.crews.sun) || []).slice(0, this.mode === 'host' ? 8 : 4).forEach((r, i) => {
          const fg = figure(r, { pose: 'ok', tag: this.mode === 'host' || r.k === this.me.k, me: r.k === this.me.k });
          fg.style.setProperty('--i', i);
          crew.appendChild(fg);
        });
        after.appendChild(crew);
        this.sfx('whoosh', 0.7);
      } else {
        after.appendChild(el('div', 'pf-stamp ice', '❄️ ¡Todos congelados!'));
        this.sfx('freeze', 0.8);
      }
    };
    const ms = 2600;
    if (reduced()) { fill.style.transform = `scaleX(${k})`; nb.textContent = fmt(ice); done(); }
    else {
      fill.animate([{ transform: 'scaleX(0)' }, { transform: `scaleX(${k})` }], { duration: ms, easing: 'cubic-bezier(.15,.65,.1,1)', fill: 'forwards' });
      flake.animate([{ left: '0%' }, { left: (k * 100) + '%' }], { duration: ms, easing: 'cubic-bezier(.15,.65,.1,1)', fill: 'forwards' });
      S().countUp(nb, 0, ice, ms);
      this.later(ms + 150, done);
    }
    this.sfx('drum', 0.75);
  };
  Ceremony.prototype.revealRoute = function (s) {
    const ex = this.fin.extra || {};
    // v2: the route's three places, then Hamdan's jet (lit only when they escaped: it takes off)
    const LV = escZones(ex);
    const jetImg = escMap() ? escMap().JET : '/assets/saga/avatars/plane.webp';
    // each place as a postcard of its own art (the icon if the page has no EscapeMap), then the jet
    const stops = LV.map((l) => ({ name: l.short || l.name, img: escMap() && l.id ? escMap().art(l.id, 'bg-s') : l.icon, card: !!(escMap() && l.id), fb: l.icon, jet: false }))
      .concat([{ name: 'El jet', img: jetImg, jet: true }]);
    const reached = ex.escaped ? stops.length : Math.max(1, Math.min(LV.length, ex.level || 1));    // the stops lit: up to the one the crew reached
    const route = el('div', 'pf-route' + (stops.length > 3 ? ' four' : ''));
    const line = el('i', 'pf-route-line');
    const fill = el('i', 'pf-route-fill');
    route.append(line, fill);
    const nodes = stops.map((st, i) => {
      const n = el('div', 'pf-stop' + (st.jet ? ' jet' : ''));
      const L = this.mode === 'phone' ? (stops.length > 3 ? 12 : 16) : 8;      // a phone keeps the end stops off the edges
      n.style.setProperty('--x', (stops.length === 1 ? 50 : L + ((100 - 2 * L) * i) / (stops.length - 1)) + '%');
      const im = el('img');
      im.alt = '';
      if (st.card) { im.className = 'pf-postcard'; im.onerror = () => { im.onerror = null; im.className = ''; im.src = st.fb; }; }
      im.src = st.img;
      n.append(im, el('span', null, st.name));
      route.appendChild(n);
      return n;
    });
    s.appendChild(route);
    const badge = el('div', 'pf-rank');
    s.appendChild(badge);
    const step = reduced() ? 0 : 640;
    for (let i = 0; i < reached; i++) {
      this.later(step * i + 200, () => {
        nodes[i].classList.add('on');
        fill.style.transform = `scaleX(${Math.min(1, i / Math.max(1, stops.length - 1))})`;
        this.sfx('pop', 0.6);
      });
    }
    if (ex.escaped) this.later(step * reached + 200, () => { nodes[stops.length - 1].classList.add('takeoff'); this.sfx('jet', 0.7); });
    this.later(step * reached + (ex.escaped ? 900 : 400), () => {
      const rk = ex.rank || { id: 'zoco', name: 'Exploradores del Zoco', stars: 1 };
      const art = escRankArt(rk);
      const im = el('img');
      im.alt = '';
      im.src = art;
      const stars = el('div', 'pf-rank-stars');
      for (let i = 0; i < 3; i++) { const sv = S().starSvg(i < (rk.stars || 1) ? '' : 'off'); sv.style.setProperty('--i', i); stars.appendChild(sv); }
      badge.append(im, el('b', null, rk.name), stars);
      badge.classList.add('show', rk.id || 'zoco');
      this.sfx('win', 0.6);
    });
    this.sfx('drum', 0.7);
  };

  // ---------- 2 · the winners celebrate, the others react ----------
  Ceremony.prototype.result = function () {
    if (this.G.coop) return this.resultCrew();
    const f = this.fin, G = this.G, t = f.totals || {};
    const tie = f.winner === 'tie';
    const s = this.fresh('result pf-w-' + (tie ? 'tie' : f.winner));
    const won = !tie && this.me.team === f.winner;
    s.appendChild(el('h2', 'pf-h big pf-' + (tie ? 'tie' : f.winner), tie ? G.tieTitle : G.winTitle(this.side(f.winner))));
    const row = el('div', 'pf-sides' + (tie ? ' tie' : ''));
    G.order.forEach((id) => {
      const win = tie || f.winner === id;
      const sd = el('div', 'pf-side pf-' + id + (win ? ' win' : ' lose') + (this.mine(id) ? ' mine' : ''));
      // each captain speaks next to themselves: the winners' line, or a kind one to the side that lost
      const head = el('div', 'pf-side-head');
      const capId = f.captains && f.captains[id];
      const cap = el('img', 'pf-side-cap');
      cap.alt = '';
      cap.src = castPose(capId, win ? 'cheer' : 'talk');      // the winners cheer, the other captain speaks kindly
      head.appendChild(cap);
      if (capId) {
        const b = el('p', 'pf-bubble');
        b.append(el('b', null, C() ? C().captain(capId) : castName(capId)), document.createTextNode(win ? castLine(capId, tie ? 'win' : G.mood, '¡Lo logramos!') : castLine(capId, 'animo', '¡La próxima es nuestra!')));
        head.appendChild(b);
      }
      head.appendChild(el('b', 'pf-total', `${!tie && win ? '👑 ' : ''}${this.side(id).ico} ${fmt(t[id] || 0)}`));
      sd.appendChild(head);
      const crew = el('div', 'pf-kids');
      const kids = (f.crews && f.crews[id]) || [];
      const n = this.mode === 'host' ? 10 : 3;
      let list = kids.slice(0, n);
      if (this.mine(id) && this.me.k != null && !list.some((r) => r.k === this.me.k)) {
        const mineRow = kids.find((r) => r.k === this.me.k) || { k: this.me.k, name: this.o.me && this.o.me.name, skin: (this.me.skin || (this.o.me && this.o.me.skin)), team: id };
        list = [mineRow].concat(list.slice(0, n - 1));
      }
      // rows of at most 5, balanced (6 kids = 3 + 3, never 5 + a lone one); 2 rows at most on the projector
      const rows = Math.ceil(list.length / 5) || 1;
      crew.style.setProperty('--n', Math.max(3, Math.ceil(list.length / rows)));
      list.forEach((r, i) => {
        const me = this.mode === 'phone' && r.k === this.me.k;
        const fg = figure(Object.assign({}, r, { team: r.team || id }), { pose: win ? 'ok' : 'no', tag: me || this.mode === 'host', me });
        fg.classList.add(win ? 'cheer' : 'slump');
        fg.style.setProperty('--i', i % 5);
        crew.appendChild(fg);
      });
      sd.appendChild(crew);
      row.appendChild(sd);
    });
    s.appendChild(row);
    if (S().confetti) S().confetti(this.fx, tie ? null : (f.winner === 'red' ? 'red' : f.winner === 'gold' ? 'gold' : null), this.mode === 'host' ? 60 : 34);
    this.sfx('win', won || tie || this.mode === 'host' ? 0.9 : 0.55);
    if (!tie) this.later(800, () => this.sfx('aww', 0.45));
    this.buzz(won ? [60, 40, 60, 40, 200] : [80]);
  };
  Ceremony.prototype.resultCrew = function () {
    const f = this.fin, ex = f.extra || {};
    const esc = !!ex.escaped;
    const s = this.fresh('result crew ' + (esc ? 'won' : 'near'));
    s.appendChild(el('h2', 'pf-h big pf-crewh', esc ? '¡Escaparon de Robotín!' : '¡Casi escapan!'));
    const jet = (f.captains && f.captains.jet) || 'hamdan';
    const head = el('div', 'pf-side-head pf-crewhead');
    const cap = el('img', 'pf-side-cap');
    cap.alt = '';
    cap.src = castPose(jet, esc ? 'cheer' : 'talk');
    const b = el('p', 'pf-bubble');
    b.append(el('b', null, castName(jet)), document.createTextNode(castLine(jet, esc ? 'win' : 'animo', esc ? '¡Lo lograron!' : '¡La próxima escapamos!')));
    head.append(cap, b);
    s.appendChild(head);
    const stage = el('div', 'pf-crewstage');
    const robo = el('canvas', 'pf-robot');
    robo.width = 240; robo.height = 240;
    const R = root.EscapeRender;
    if (R && R.robotin) {
      const draw = (ts) => {
        if (!robo.isConnected) return;
        const g = robo.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, 240, 240);
        R.robotin(g, 120, 228, 190, { t: ts / 1000, mood: esc ? 'dizzy' : 'idle' });
        if (!reduced()) requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    }
    const crew = el('div', 'pf-kids wide');
    const kids = (f.crews && f.crews.crew) || [];
    const n = this.mode === 'host' ? 12 : 4;
    let list = kids.slice(0, n);
    if (this.mode === 'phone' && this.me.k != null && !list.some((r) => r.k === this.me.k)) {
      const mineRow = kids.find((r) => r.k === this.me.k) || { k: this.me.k, name: this.o.me && this.o.me.name, skin: this.me.skin || (this.o.me && this.o.me.skin), team: 'crew' };
      list = [mineRow].concat(list.slice(0, n - 1));
    }
    const rows = Math.ceil(list.length / 6) || 1;      // rows of at most 6, balanced (7 kids = 4 + 3)
    crew.style.setProperty('--n', Math.max(4, Math.ceil(list.length / rows)));
    crew.style.setProperty('--c', list.length <= 4 ? 2 : 3);       // the phone: rows of 2 or 3, never one kid alone on a row
    list.forEach((r, i) => {
      const me = this.mode === 'phone' && r.k === this.me.k;
      const fg = figure(Object.assign({}, r, { team: 'crew' }), { pose: esc ? 'ok' : 'no', tag: me || this.mode === 'host', me });
      fg.classList.add(esc ? 'cheer' : 'slump');
      fg.style.setProperty('--i', i % 6);
      crew.appendChild(fg);
    });
    stage.append(crew, robo);
    s.appendChild(stage);
    if (esc) { if (S().confetti) S().confetti(this.fx, null, this.mode === 'host' ? 60 : 34); this.sfx('win', 0.9); }
    else { this.sfx('aww', 0.5); this.later(900, () => this.sfx('win', 0.5)); }
    this.buzz(esc ? [60, 40, 60, 40, 200] : [80]);
  };

  // ---------- 3 · a bonus star ----------
  Ceremony.prototype.star = function (i) {
    const st = (this.fin.stars || [])[i];
    if (!st) return;
    const mineStar = this.mode === 'phone' && (this.me.stars || []).includes(st.id);
    const s = this.fresh('star' + (mineStar ? ' mine' : ''));
    const badge = el('div', 'pf-badge');
    badge.appendChild(S().starSvg());
    s.appendChild(badge);
    s.appendChild(el('div', 'pf-kicker', 'Estrella Bonus'));
    s.appendChild(el('h2', 'pf-h pf-star-h', `${starIcon(this.o.game, st.id)} ${st.name}`));
    const who = el('div', 'pf-who');
    (st.who || []).forEach((r, k) => {
      const fg = figure(r, { pose: 'ok', me: this.mode === 'phone' && r.k === this.me.k, tag: true });
      fg.style.setProperty('--i', k);
      who.appendChild(fg);
    });
    s.appendChild(who);
    s.appendChild(el('div', 'pf-val', starValue(this.o.game, st)));
    if (mineStar) { s.appendChild(el('div', 'pf-mine', '¡ES PARA TI!')); this.buzz([40, 30, 40, 30, 120]); }
    this.later(this.mode === 'host' ? 700 : 300, () => this.sfx('star', mineStar ? 0.9 : 0.65));
  };

  // ---------- 4a · the phone's own card ----------
  Ceremony.prototype.card = function () {
    const me = this.me, f = this.fin, G = this.G;
    const team = me.team || (G.coop ? 'crew' : 'tie');      // (a guest card: gold, nobody's team)
    const s = this.fresh('card pf-' + team + (me.won || me.tie ? ' won' : ''));
    const lines = card(this.o.game, me, f);
    const top = el('div', 'pf-card-top');
    const kid = figure({ k: me.k, name: (this.o.me && this.o.me.name) || me.name || '', skin: me.skin || (this.o.me && this.o.me.skin), team }, { me: true, pose: me.won || me.tie || G.coop ? 'ok' : 'no', tag: true });
    const art = el('img', 'pf-card-art');
    art.alt = '';
    if (G.coop) {
      const rk = (f.extra && f.extra.rank) || { id: 'zoco' };
      art.src = escRankArt(rk);
    } else art.src = castPose(f.captains && f.captains[team], me.won || me.tie ? 'cheer' : 'talk');
    top.append(kid, art);
    s.appendChild(top);
    s.appendChild(el('h2', 'pf-card-h', lines.title));
    if (G.coop && f.extra && f.extra.rank) {
      const rs = el('div', 'pf-rank-stars small');
      for (let i = 0; i < 3; i++) rs.appendChild(S().starSvg(i < (f.extra.rank.stars || 1) ? '' : 'off'));
      s.appendChild(rs);
    }
    const big = el('p', 'pf-card-big' + (lines.zero ? ' zero' : ''));
    if (lines.big.text) big.textContent = lines.big.text;
    else big.append(lines.big.pre, el('b', null, fmt(lines.big.n)), lines.big.post);
    s.appendChild(big);
    if (lines.sub) s.appendChild(el('p', 'pf-card-line', lines.sub));
    if (!G.coop) {
      const score = el('p', 'pf-card-score');
      G.order.forEach((id) => score.appendChild(el('b', 'pf-' + id, `${this.side(id).ico} ${this.side(id).short} ${fmt((f.totals || {})[id] || 0)}`)));
      s.appendChild(score);
    }
    if (lines.facts.length) {
      const facts = el('div', 'pf-facts');
      lines.facts.forEach(([v, l]) => { const x = el('div', 'pf-fact'); x.append(el('b', null, v), el('span', null, l)); facts.appendChild(x); });
      s.appendChild(facts);
    }
    const mine = (f.stars || []).filter((x) => (me.stars || []).includes(x.id));
    if (mine.length || me.mvp) {
      const row = el('div', 'pf-mystars');
      if (me.mvp) { const b = el('div', 'pf-mystar mvp'); b.append(S().starSvg('mvp'), el('span', null, G.coop ? '¡Estrella de la tripulación!' : `¡Número 1 de ${team === 'sun' || team === 'ice' ? 'tu equipo' : 'tu reino'}!`)); row.appendChild(b); }
      mine.forEach((x) => { const b = el('div', 'pf-mystar'); b.append(S().starSvg(), el('span', null, x.name)); row.appendChild(b); });
      s.appendChild(row);
    }
    // the card never sends a kid out of the class: «Otra ronda» brings every phone back to the lobby
    s.appendChild(el('p', 'pf-wait', 'Quédate aquí: tu profe puede empezar otra ronda'));
    const home = el('button', 'pf-home', 'Salir del juego');
    home.type = 'button';
    home.addEventListener('click', () => { if (this.o.onHome) this.o.onHome(); else location.href = '/'; });
    s.appendChild(home);
  };

  // ---------- 4b · the projector's podium (or the whole crew in La Gran Fuga) ----------
  Ceremony.prototype.podium = function () {
    const f = this.fin, G = this.G;
    const s = this.fresh('podium');
    if (G.coop) this.crewBoard(s);
    else {
      const tie = f.winner === 'tie';
      s.appendChild(el('h2', 'pf-h big pf-' + (tie ? 'tie' : f.winner), tie ? G.tieChampion : G.champion(this.side(f.winner))));
      const top = (f.top || []).filter((r) => r.value > 0).slice(0, 3);
      s.appendChild(el('p', 'pf-pod-sub', top.length ? 'Los que más sumaron' : '¡Esta vez nadie sumó! La próxima ronda es de todos'));
      const pod = el('div', 'pf-podium' + (top.length ? '' : ' empty'));
      if (!top.length) G.order.forEach((id) => {      // nobody scored: the two captains wait for the next round
        const im = el('img', 'pf-pod-cap');
        im.alt = '';
        im.src = castPose(f.captains && f.captains[id], 'hello');
        pod.appendChild(im);
      });
      else [1, 0, 2].forEach((i) => {
        const r = top[i];
        const p = el('div', 'pf-pod p' + ((r && r.rank) || i + 1));
        if (r) {
          const fg = figure(r, { pose: 'ok', tag: true });
          const step = el('div', 'pf-pod-step');
          step.append(el('span', null, String(r.rank || i + 1)), el('small', null, G.podium(r)));
          p.append(fg, step);
          if ((r.stars || []).length) {
            const stars = el('div', 'pf-pod-stars');
            stars.append(S().starSvg(), el('b', null, '× ' + r.stars.length));
            p.prepend(stars);
          }
        }
        pod.appendChild(p);
      });
      const mvps = el('div', 'pf-mvps');
      G.order.forEach((id) => {
        const r = f.mvp && f.mvp[id];
        if (!r || !top.length) return;
        const m = el('div', 'pf-mvp pf-' + id);
        m.appendChild(figure(r, { pose: 'ok', tag: false }));
        const t = el('div');
        t.append(el('small', null, G.mvpLabel(this.side(id))), el('b', null, r.name));
        m.appendChild(t);
        mvps.appendChild(m);
      });
      pod.appendChild(mvps);
      s.appendChild(pod);
    }
    const tools = el('div', 'pf-tools');
    const home = el('button', 'pf-btn', '🏠 Inicio');
    home.type = 'button';
    home.addEventListener('click', () => { if (this.o.onHome) this.o.onHome(); else location.href = '/'; });
    const again = el('button', 'pf-btn go', '🔄 Otra ronda');
    again.type = 'button';
    again.addEventListener('click', () => { if (this.o.onAgain) this.o.onAgain(); this.stop(); });
    tools.append(home, again);
    s.appendChild(tools);            // inside the stage: a stage shown again (test hold) never keeps them
    if (this.o.onEnd) this.o.onEnd();
  };
  Ceremony.prototype.crewBoard = function (s) {
    const f = this.fin, ex = f.extra || {};
    const rk = ex.rank || { id: 'zoco', name: 'Exploradores del Zoco', stars: 1 };
    s.appendChild(el('h2', 'pf-h big pf-crewh', `¡${rk.name}!`));
    const rs = el('div', 'pf-rank-stars');
    for (let i = 0; i < 3; i++) rs.appendChild(S().starSvg(i < (rk.stars || 1) ? '' : 'off'));
    s.appendChild(rs);
    s.appendChild(el('p', 'pf-crew-why', ex.escaped ? `¡Escaparon en el jet de Hamdan con ${pl(ex.hearts || 0, 'corazón', 'corazones')}!`
      : `Llegaron hasta ${escReached(ex)} · ${pl(ex.hearts || 0, 'corazón', 'corazones')}`));
    const wall = el('div', 'pf-crewwall');
    const all = ((f.crews && f.crews.crew) || []).slice(0, 40);
    wall.classList.toggle('dense', all.length > 14);
    wall.classList.toggle('xdense', all.length > 26);
    const starOf = {};
    (f.stars || []).forEach((st) => (st.who || []).forEach((r) => { (starOf[r.k] = starOf[r.k] || []).push(st); }));
    all.forEach((r, i) => {
      const cell = el('div', 'pf-mate');
      cell.style.setProperty('--i', Math.min(i, 20));
      cell.appendChild(figure(Object.assign({}, r, { team: 'crew' }), { pose: 'ok', tag: true }));
      const sts = starOf[r.k];
      if (sts) {
        const b = el('div', 'pf-mate-stars');
        sts.forEach((st) => b.appendChild(el('span', null, starIcon(this.o.game, st.id))));
        cell.appendChild(b);
      }
      wall.appendChild(cell);
    });
    s.appendChild(wall);
  };

  // a test hook for screenshots: build the ceremony, then show one stage and hold it there
  function hold(name) { if (current) { current.clear(); current.stage(name); } return current ? current.stageName : null; }

  return Object.assign(api, {
    final, hideFinal, news, clearNews, chip, clearChip, pauseCard, Ceremony, hold, SND,
    holdNews: (v) => { newsHold = !!v; },
    current: () => current,
    figure,
  });
});
