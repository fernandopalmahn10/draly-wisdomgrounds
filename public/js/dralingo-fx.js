// DralingoFX — TikTok-battle style Dralingo moments for the whole platform.
//   DralingoFX.celebrate({ text: '¡Bien hecho!', mood: 'win' })   → random entrance, never the same one twice in a row
//   DralingoFX.play('meteor', { text, mood })                      → a specific one (teacher pickers use DralingoFX.list())
// Poses are transparent WebP stickers made with Higgsfield (Nano Banana Pro) on green screen and keyed on this PC.
// One effect at a time, CSS-only animation, everything removed afterwards (cheap phones stay smooth). Silent: callers
// play their own sounds. Respects prefers-reduced-motion (shows a short, still card instead).
(function () {
  const BASE = '/assets/kingdoms/dralingo/';
  const MOODS = {
    win: ['jump', 'champion', 'party', 'dance', 'flag', 'hearts', 'laugh', 'clap'],
    good: ['thumbsup', 'jump', 'pointing', 'hearts', 'dance', 'clap', 'wave'],
    oops: ['shocked', 'thinking', 'thumbsup'],
    hello: ['wave', 'pointing', 'thumbsup', 'jump'],
  };
  const POSES = ['jump', 'flag', 'shocked', 'countdown', 'champion', 'thinking', 'pointing', 'thumbsup', 'dance', 'dance2',
    'dance3', 'dance4', 'fly', 'fly2', 'fly3', 'party', 'hearts', 'laugh', 'clap', 'wave'];
  const DANCE = ['dance', 'dance2', 'dance3', 'dance4'];
  const FLY = ['fly', 'fly2', 'fly3'];
  // Spanish names for teacher pickers. Order = how they are listed.
  const LABELS = {
    flyby: '✈️ Vuelo', meteor: '☄️ Meteoro', gift: '🎁 Regalo', swarm: '🔥 Combo x3', zoom: '💥 Zoom',
    rain: '🌧️ Lluvia de Dralingos', spotlight: '🔦 Foco', dance: '💃 Baile', peek: '👀 Asomo',
    cameo: '🎬 Cameo del equipo', gang: '🕵️ ¡El equipo completo!',
  };
  // cameo + gang need the cast (js/cast.js); pages without it never pick them.
  const CAST_KINDS = ['cameo', 'gang'];
  const hasCast = () => !!window.DralingoCast;
  const KINDS = Object.keys(LABELS);
  const src = (p) => BASE + p + '.webp';
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  let busy = false;
  let lastKind = null;
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pose = (list) => pick(list && list.length ? list : MOODS.win);

  // Warm the cache once the page is idle so the first effect shows instantly (~0.6 MB). Pages that whole classes open
  // at once (home) set <body data-dfx-warm="tap"> and only warm on the first effect.
  let warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    POSES.forEach((p) => { const i = new Image(); i.src = src(p); });
  }
  const idleWarm = () => { if (!(document.body && document.body.dataset.dfxWarm === 'tap')) setTimeout(warm, 2500); };
  if (document.readyState === 'complete') idleWarm();
  else window.addEventListener('load', idleWarm);

  function injectCss() {
    if (document.getElementById('dfx-css')) return;
    const st = document.createElement('style');
    st.id = 'dfx-css';
    st.textContent = `
.dfx-layer{position:fixed;inset:0;pointer-events:none;z-index:99990;overflow:hidden}
.dfx-layer.dfx-shake{animation:dfxShake .42s cubic-bezier(.36,.07,.19,.97) both}
@keyframes dfxShake{10%,90%{transform:translate(-2px,1px)}20%,80%{transform:translate(4px,-2px)}30%,50%,70%{transform:translate(-7px,3px)}40%,60%{transform:translate(7px,-3px)}}
.dfx-img{position:absolute;filter:drop-shadow(0 10px 0 rgba(29,36,64,.22));will-change:transform}
.dfx-bubble{position:absolute;background:#fff7e3;color:#1d2440;border:4px solid #1d2440;border-radius:22px;padding:10px 18px;
  font:800 clamp(1.1rem,4.5vw,1.9rem)/1.1 'Baloo 2','Nunito',sans-serif;box-shadow:0 6px 0 #1d2440;white-space:nowrap;
  animation:dfxBubble 2.6s ease-out forwards}
@keyframes dfxBubble{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}12%{opacity:1;transform:translate(-50%,0) scale(1.05)}
  20%{transform:translate(-50%,0) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-8px)}}
.dfx-stamp{position:absolute;left:50%;top:30%;color:#ffc93c;-webkit-text-stroke:3px #1d2440;paint-order:stroke fill;
  font:900 clamp(2.6rem,11vw,6rem)/1 'Baloo 2','Nunito',sans-serif;text-shadow:0 7px 0 #1d2440;white-space:nowrap;
  animation:dfxStamp 1s cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes dfxStamp{0%{opacity:0;transform:translate(-50%,-50%) scale(3) rotate(-14deg)}35%{opacity:1;transform:translate(-50%,-50%) scale(.92) rotate(-6deg)}
  55%{transform:translate(-50%,-50%) scale(1.04) rotate(-7deg)}100%{opacity:1;transform:translate(-50%,-50%) scale(1) rotate(-7deg)}}
.dfx-fly{width:min(46vw,300px);top:22%;left:-50vw;animation:dfxFly 2.6s cubic-bezier(.45,.05,.4,1) forwards}
.dfx-fly.dfx-rtl{left:auto;right:-50vw;animation-name:dfxFlyR}
@keyframes dfxFly{0%{transform:translateX(0) rotate(-6deg)}50%{transform:translateX(75vw) translateY(-6vh) rotate(4deg)}100%{transform:translateX(160vw) translateY(4vh) rotate(-4deg)}}
@keyframes dfxFlyR{0%{transform:translateX(0) scaleX(-1) rotate(-6deg)}50%{transform:translateX(-75vw) translateY(-6vh) scaleX(-1) rotate(4deg)}100%{transform:translateX(-160vw) translateY(4vh) scaleX(-1) rotate(-4deg)}}
.dfx-spark{position:absolute;font-size:clamp(18px,4vw,32px);animation:dfxSpark 1.2s ease-out forwards}
@keyframes dfxSpark{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:translateY(30px) scale(1.4) rotate(90deg)}}
.dfx-gift{width:min(62vw,380px);left:50%;bottom:-70vh;transform:translateX(-50%);animation:dfxGift 2.8s cubic-bezier(.3,1.5,.5,1) forwards}
@keyframes dfxGift{0%{bottom:-70vh}22%{bottom:6vh}30%{bottom:3vh}78%{bottom:4vh;transform:translateX(-50%) scale(1)}100%{bottom:-75vh;transform:translateX(-50%) scale(.9)}}
.dfx-burst{position:absolute;left:50%;bottom:22vh;width:120vmax;height:120vmax;margin-left:-60vmax;margin-bottom:-60vmax;border-radius:50%;
  background:repeating-conic-gradient(from 0deg,rgba(255,201,60,.55) 0 8deg,rgba(255,201,60,0) 8deg 20deg);animation:dfxRays 2.6s linear forwards}
@keyframes dfxRays{0%{opacity:0;transform:scale(.3) rotate(0)}20%{opacity:1}80%{opacity:.8}100%{opacity:0;transform:scale(1) rotate(70deg)}}
.dfx-speed{position:absolute;left:50%;top:50%;width:160vmax;height:160vmax;margin:-80vmax 0 0 -80vmax;border-radius:50%;
  background:repeating-conic-gradient(from 3deg,rgba(255,255,255,.9) 0 1.2deg,rgba(255,255,255,0) 1.2deg 9deg);
  -webkit-mask:radial-gradient(circle,transparent 0 16vmin,#000 40vmin);mask:radial-gradient(circle,transparent 0 16vmin,#000 40vmin);
  animation:dfxSpeed 2.4s ease-out forwards}
@keyframes dfxSpeed{0%{opacity:0;transform:scale(1.4)}15%{opacity:.85}70%{opacity:.6}100%{opacity:0;transform:scale(1) rotate(12deg)}}
.dfx-zoom{width:min(70vw,440px);left:50%;top:52%;animation:dfxZoom 2.5s cubic-bezier(.2,1.2,.4,1) forwards}
@keyframes dfxZoom{0%{opacity:0;transform:translate(-50%,-50%) scale(.05) rotate(30deg)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.12) rotate(-3deg)}
  42%{transform:translate(-50%,-50%) scale(1) rotate(0)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.35)}}
.dfx-meteor{width:min(44vw,280px);left:50%;top:50%;animation:dfxMeteor 2.7s cubic-bezier(.5,0,.6,1) forwards}
@keyframes dfxMeteor{0%{transform:translate(70vw,-90vh) rotate(-30deg) scale(.7)}28%{transform:translate(-50%,-30%) rotate(-12deg) scale(1)}
  34%{transform:translate(-50%,-22%) scale(1.1,.86)}42%{transform:translate(-50%,-34%) scale(.96,1.05)}50%{transform:translate(-50%,-30%) scale(1)}
  85%{opacity:1;transform:translate(-50%,-30%)}100%{opacity:0;transform:translate(-50%,-30%) scale(.9)}}
.dfx-trail{position:absolute;width:26px;height:26px;border-radius:50%;animation:dfxTrail .9s ease-out forwards}
@keyframes dfxTrail{0%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(.2)}}
.dfx-ring{position:absolute;left:50%;top:60%;width:30vmin;height:30vmin;margin:-15vmin 0 0 -15vmin;border-radius:50%;
  border:10px solid #ffc93c;box-shadow:0 0 0 6px rgba(255,255,255,.7);animation:dfxRing .8s ease-out .75s both}
@keyframes dfxRing{0%{opacity:0;transform:scale(.2)}10%{opacity:1}100%{opacity:0;transform:scale(3.2)}}
.dfx-pop{width:min(30vw,210px);bottom:-60vh;animation:dfxPop 2.9s cubic-bezier(.3,1.6,.5,1) forwards}
@keyframes dfxPop{0%{bottom:-60vh}25%{bottom:2vh}32%{bottom:0}82%{bottom:1vh}100%{bottom:-60vh}}
.dfx-count{position:absolute;color:#fff;-webkit-text-stroke:3px #f0443a;paint-order:stroke fill;font:900 clamp(1.6rem,6vw,3.2rem)/1 'Baloo 2','Nunito',sans-serif;
  text-shadow:0 4px 0 #1d2440;animation:dfxCount .9s cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes dfxCount{0%{opacity:0;transform:translate(-50%,0) scale(2.4)}40%{opacity:1;transform:translate(-50%,0) scale(.9)}100%{opacity:1;transform:translate(-50%,-14px) scale(1)}}
.dfx-mini{position:absolute;top:-20vh;width:clamp(60px,14vw,110px);animation:dfxFall linear forwards}
@keyframes dfxFall{to{transform:translateY(130vh) rotate(var(--r,360deg))}}
.dfx-conf{position:absolute;top:-5vh;width:12px;height:16px;border-radius:3px;animation:dfxFall linear forwards}
.dfx-spot{width:min(70vw,420px);left:50%;top:50%;transform:translate(-50%,-50%) scale(0);animation:dfxSpot 2.6s cubic-bezier(.3,1.6,.5,1) forwards}
@keyframes dfxSpot{0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg)}25%{transform:translate(-50%,-50%) scale(1.08) rotate(3deg)}
  35%{transform:translate(-50%,-50%) scale(1) rotate(0)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15)}}
.dfx-dance{width:min(52vw,320px);left:50%;bottom:4vh;transform:translateX(-50%);animation:dfxHop .3s ease-in-out infinite alternate}
@keyframes dfxHop{from{transform:translateX(-50%) translateY(0) rotate(-4deg)}to{transform:translateX(-50%) translateY(-22px) rotate(4deg)}}
.dfx-peek{width:min(44vw,260px);right:6vw;bottom:-60vh;animation:dfxPeek 2.8s cubic-bezier(.3,1.4,.5,1) forwards}
@keyframes dfxPeek{0%{bottom:-60vh}25%{bottom:-6vh}35%{bottom:-9vh}70%{bottom:-7vh}100%{bottom:-60vh}}
.dfx-still{width:min(40vw,240px);left:50%;bottom:6vh;transform:translateX(-50%)}
.dfx-cameo{height:min(52vh,440px);bottom:-70vh;animation:dfxCameo 3.2s cubic-bezier(.3,1.4,.5,1) forwards}
.dfx-cameo.dfx-left{left:3vw}.dfx-cameo.dfx-right{right:3vw}
@keyframes dfxCameo{0%{bottom:-70vh}22%{bottom:-2vh}30%{bottom:-4vh}78%{bottom:-3vh}100%{bottom:-75vh}}
.dfx-member{height:min(34vh,320px,58vw);bottom:-60vh;transform:translateX(-50%);animation:dfxPop 3.1s cubic-bezier(.3,1.6,.5,1) forwards}
.dfx-who{display:block;font:800 .8em/1 'Nunito',sans-serif;color:#55607f;margin-bottom:4px;letter-spacing:.02em}
`;
    document.head.appendChild(st);
  }

  function layer() { const l = document.createElement('div'); l.className = 'dfx-layer'; document.body.appendChild(l); return l; }
  function img(cls, p, parent) {
    const i = document.createElement('img');
    i.className = 'dfx-img ' + cls;
    i.alt = '';
    i.onerror = () => { i.onerror = null; i.src = src('jump'); };
    i.src = src(p);
    parent.appendChild(i);
    return i;
  }
  function bubble(text, parent, x, y, who) {
    if (!text) return;
    const b = document.createElement('div');
    b.className = 'dfx-bubble';
    if (who) { const w = document.createElement('span'); w.className = 'dfx-who'; w.textContent = who; b.appendChild(w); }
    b.appendChild(document.createTextNode(text));
    b.style.left = x || '50%';
    b.style.top = y || '14%';
    parent.appendChild(b);
  }
  function stamp(text, parent, top) {
    const s = document.createElement('div');
    s.className = 'dfx-stamp';
    s.textContent = text;
    if (top) s.style.top = top;
    parent.appendChild(s);
  }
  const confColors = ['#f0443a', '#2f7bea', '#ffc93c', '#26a65b', '#ff8fb8', '#fff7e3'];

  const EFFECTS = {
    flyby(l, o) {
      const rtl = Math.random() < 0.4;
      const i = img('dfx-fly' + (rtl ? ' dfx-rtl' : ''), pick(FLY), l);
      let n = 0;
      const t = setInterval(() => {
        const r = i.getBoundingClientRect();
        const s = document.createElement('div');
        s.className = 'dfx-spark';
        s.textContent = pick(['✨', '⭐', '💫', '🌟']);
        s.style.left = (r.left + r.width * (rtl ? 0.75 : 0.25)) + 'px';
        s.style.top = (r.top + r.height * (0.3 + Math.random() * 0.4)) + 'px';
        l.appendChild(s);
        if (++n > 22) clearInterval(t);
      }, 100);
      bubble(o.text, l, '50%', '62%');
      return 2800;
    },
    meteor(l, o) {
      const i = img('dfx-meteor', pick(FLY), l);
      let n = 0;
      const t = setInterval(() => {
        const r = i.getBoundingClientRect();
        const d = document.createElement('div');
        d.className = 'dfx-trail';
        d.style.background = pick(confColors);
        d.style.left = (r.left + r.width * 0.7 + Math.random() * 30) + 'px';
        d.style.top = (r.top + r.height * 0.3 + Math.random() * 30) + 'px';
        l.appendChild(d);
        if (++n > 9) clearInterval(t);
      }, 70);
      const ring = document.createElement('div'); ring.className = 'dfx-ring'; l.appendChild(ring);
      setTimeout(() => { l.classList.add('dfx-shake'); }, 760);
      setTimeout(() => bubble(o.text, l, '50%', '12%'), 800);
      return 2900;
    },
    gift(l, o) {
      const b = document.createElement('div'); b.className = 'dfx-burst'; l.appendChild(b);
      img('dfx-gift', pose(o.poses), l);
      bubble(o.text, l, '50%', '12%');
      return 3000;
    },
    swarm(l, o) {
      // TikTok "gift combo": three Dralingos pop up one after another, the counter climbs to x3.
      const spots = ['16%', '50%', '84%'];
      const poses = o.poses.slice().sort(() => Math.random() - 0.5);
      spots.forEach((x, k) => {
        setTimeout(() => {
          const i = img('dfx-pop', poses[k % poses.length] || 'jump', l);
          i.style.left = x;
          i.style.marginLeft = 'calc(min(30vw,210px) / -2)';
          const c = document.createElement('div');
          c.className = 'dfx-count';
          c.textContent = 'x' + (k + 1);
          c.style.left = x;
          c.style.bottom = 'calc(min(30vw,210px) * 1.25)';
          l.appendChild(c);
        }, k * 380);
      });
      setTimeout(() => { stamp('¡COMBO!', l, '46%'); l.classList.add('dfx-shake'); }, 3 * 380 + 120);
      bubble(o.text, l, '50%', '8%');
      return 3300;
    },
    zoom(l, o) {
      const s = document.createElement('div'); s.className = 'dfx-speed'; l.appendChild(s);
      img('dfx-zoom', pose(o.poses), l);
      setTimeout(() => stamp(pick(['¡WOW!', '¡GENIAL!', '¡SÚPER!']), l, '20%'), 650);
      if (o.text) setTimeout(() => bubble(o.text, l, '50%', '84%'), 500);
      return 2700;
    },
    rain(l, o) {
      for (let k = 0; k < 14; k++) {
        const m = img('dfx-mini', pose(o.poses), l);
        m.style.left = (Math.random() * 92) + 'vw';
        m.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
        m.style.animationDelay = (Math.random() * 0.8) + 's';
        m.style.setProperty('--r', (Math.random() > 0.5 ? '' : '-') + (180 + Math.random() * 360) + 'deg');
      }
      for (let k = 0; k < 60; k++) {
        const c = document.createElement('div');
        c.className = 'dfx-conf';
        c.style.left = (Math.random() * 100) + 'vw';
        c.style.background = pick(confColors);
        c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
        c.style.animationDelay = (Math.random() * 0.9) + 's';
        l.appendChild(c);
      }
      bubble(o.text, l, '50%', '40%');
      return 3400;
    },
    spotlight(l, o) {
      const b = document.createElement('div'); b.className = 'dfx-burst'; b.style.bottom = '50vh'; l.appendChild(b);
      img('dfx-spot', pose(o.poses), l);
      bubble(o.text, l, '50%', '10%');
      return 2800;
    },
    dance(l, o) {
      // Real dance frames from Higgsfield, played as a flipbook while he hops.
      const i = img('dfx-dance', DANCE[0], l);
      let k = 0;
      const t = setInterval(() => { k = (k + 1) % DANCE.length; i.src = src(DANCE[k]); }, 230);
      setTimeout(() => clearInterval(t), 2600);
      bubble(o.text, l, '50%', '16%');
      return 2800;
    },
    cameo(l, o) {
      // One member of the gang slides in from a side and says their line (or the game's message).
      if (!hasCast()) return EFFECTS.peek(l, o);
      const C = window.DralingoCast;
      const id = o.char || C.pick(1)[0];
      const left = Math.random() < 0.5;
      const i = document.createElement('img');
      i.className = 'dfx-img dfx-cameo ' + (left ? 'dfx-left' : 'dfx-right');
      i.alt = '';
      i.src = C.pose(id, o.mood === 'oops' ? 'mystery' : (o.mood === 'hello' ? 'hello' : 'cheer'));
      l.appendChild(i);
      bubble(o.text || C.line(id, o.mood || 'win'), l, left ? '58%' : '42%', '30%', C.name(id));
      return 3300;
    },
    gang(l, o) {
      // The whole gang pops up in a row, Scooby-Doo finale style: «¡Caso resuelto!»
      if (!hasCast()) return EFFECTS.swarm(l, o);
      const C = window.DralingoCast;
      const ids = C.pick(3).concat('dralingo').sort(() => Math.random() - 0.5);
      ids.forEach((id, k) => {
        setTimeout(() => {
          const i = document.createElement('img');
          i.className = 'dfx-img dfx-member';
          i.alt = '';
          i.src = C.pose(id, 'cheer');
          i.style.left = (14 + k * 24) + '%';
          l.appendChild(i);
        }, k * 260);
      });
      setTimeout(() => { stamp(o.stamp || '¡Caso resuelto!', l, '30%'); l.classList.add('dfx-shake'); }, ids.length * 260 + 150);
      bubble(o.text, l, '50%', '8%');
      return 3500;
    },
    peek(l, o) {
      img('dfx-peek', pick(['thumbsup', 'pointing', 'wave', 'clap']), l);
      bubble(o.text, l, '55%', '58%');
      return 3000;
    },
  };

  function play(kind, opts) {
    opts = opts || {};
    if (busy || !document.body) return false;
    injectCss();
    // Class phones (data-dfx-warm="tap") never preload the whole library: 30 phones × 0.7 MB at once would choke the
    // school WiFi. They load only the poses the chosen effect uses.
    if (!(document.body.dataset && document.body.dataset.dfxWarm === 'tap')) warm();
    busy = true;
    const l = layer();
    let ms = 2400;
    const poses = opts.poses || MOODS[opts.mood] || MOODS.win;
    if (reduced()) {
      img('dfx-still', pose(poses), l);
      bubble(opts.text, l);
    } else {
      const fx = EFFECTS[kind] || EFFECTS.gift;
      ms = fx(l, { text: opts.text, poses, mood: opts.mood, char: opts.char, stamp: opts.stamp });
    }
    setTimeout(() => { l.remove(); busy = false; }, ms + 200);
    return true;
  }

  function celebrate(opts) {
    opts = opts || {};
    const pool = (opts.kinds || KINDS).filter((k) => k !== lastKind && EFFECTS[k] && (hasCast() || !CAST_KINDS.includes(k)));
    const kind = pick(pool.length ? pool : KINDS);
    lastKind = kind;
    return play(kind, opts);
  }

  window.DralingoFX = {
    celebrate,
    play,
    kinds: KINDS.slice(),
    list: () => KINDS.filter((id) => hasCast() || !CAST_KINDS.includes(id)).map((id) => ({ id, label: LABELS[id] })),
    poses: () => POSES.slice(),
  };
})();
