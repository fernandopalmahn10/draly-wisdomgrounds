// The saga (2026-10-12, his ask: "change everything we can find trouble with, with our own saga characters; make a
// camel, an animated Emirates plane, animate stuff"): his own characters for every roster kids see, replacing the brand
// characters (Gojo, Pikachu, Mario, Elsa, CR7…). ONE list for:
//   ANIMS   the persistent animations (warm-up, reading and HSK-room trays, /maestro «GIF to students»)
//   BURSTS  the quick character bursts of the warm-up tray (the cast, cheer pose)
//   AVATARS the homework avatar picker (+ LEGACY: what a removed brand avatar shows now)
// Browser: window.Saga. Node: require('./public/js/saga') (server whitelists, avatar options, old-avatar migration).
// Art: /assets/saga/ (Higgsfield, keyed to transparent WebP), /assets/cast/, /assets/dralingo/. The plane is unbranded
// (UAE-flag colours on the tail, no airline name or logo: root CLAUDE.md).
(function (root, factory) {
  const S = factory();
  if (typeof module === 'object' && module.exports) module.exports = S;
  else root.Saga = S;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const ANIMS = [
    { id: 'dralingo', label: '🐉 Dralingo', url: '/assets/dralingo/anim/hello.webp', still: '/assets/dralingo/anim/hello-still.webp' },
    { id: 'dralingo-sabio', label: '🧔 Dralingo sabio', url: '/assets/dralingo/anim/wise.webp', still: '/assets/dralingo/anim/wise-still.webp' },
    { id: 'dralingo-poder', label: '💪 Poder de Dralingo', url: '/assets/dralingo/anim/power.webp', still: '/assets/dralingo/anim/power-still.webp' },
    { id: 'camel', label: '🐪 Camello', url: '/assets/saga/anim/camel.webp', still: '/assets/saga/anim/camel-still.webp' },
    { id: 'plane', label: '✈️ Avión de Dubái', url: '/assets/saga/anim/plane.webp', still: '/assets/saga/anim/plane-still.webp' },
    { id: 'falcon', label: '🦅 Halcón', url: '/assets/saga/anim/falcon.webp', still: '/assets/saga/anim/falcon-still.webp' },
    { id: 'oryx', label: '🦌 Órix', url: '/assets/saga/anim/oryx.webp', still: '/assets/saga/anim/oryx-still.webp' },
  ];
  // cry: shown big during the burst (the cast bible's voice: Hamdan/Latifa say «Yalla», Aileen speaks with voseo)
  const BURSTS = [
    { id: 'fer', label: '👨‍🏫 Profe Fer', color: '#3b6dff', glow: '#9db8ff', cry: '¡VAMOS, EQUIPO!', img: '/assets/cast/fer-cheer.webp' },
    { id: 'hamdan', label: '🦅 Hamdan', color: '#ff5a5a', glow: '#ffd23b', cry: '¡YALLA, YALLA!', img: '/assets/cast/hamdan-cheer.webp' },
    { id: 'latifa', label: '✨ Latifa', color: '#c38bff', glow: '#ffd23b', cry: '¡BRILLANTE!', img: '/assets/cast/latifa-cheer.webp' },
    { id: 'aileen', label: '🌎 Aileen', color: '#5be8d1', glow: '#7bdf7b', cry: '¡DALE, CHE!', img: '/assets/cast/aileen-cheer.webp' },
    { id: 'adric', label: '🐕 Adric', color: '#ff9f1c', glow: '#ffd23b', cry: '¡BIEN HECHO!', img: '/assets/cast/adric-cheer.webp' },
    { id: 'adrian', label: '🗺️ Adrian', color: '#26a65b', glow: '#b2ebcd', cry: '¡A LA AVENTURA!', img: '/assets/cast/adrian-cheer.webp' },
  ];
  const AV = '/assets/saga/avatars/';
  // emoji: what the pin games carry for the kid (hosts print avatars as text); the phone shows the picture
  const AVATARS = [
    { id: 'dralingo', emoji: '🐉', label: '🐉 Dralingo', url: AV + 'dralingo.webp' },
    { id: 'fer', emoji: '👨‍🏫', label: '👨‍🏫 Profe Fer', url: AV + 'fer.webp' },
    { id: 'hamdan', emoji: '🧔', label: 'Hamdan', url: AV + 'hamdan.webp' },
    { id: 'latifa', emoji: '🧕', label: 'Latifa', url: AV + 'latifa.webp' },
    { id: 'aileen', emoji: '🌎', label: 'Aileen', url: AV + 'aileen.webp' },
    { id: 'adric', emoji: '🐕', label: 'Adric', url: AV + 'adric.webp' },
    { id: 'adrian', emoji: '🗺️', label: 'Adrian', url: AV + 'adrian.webp' },
    { id: 'camel', emoji: '🐪', label: '🐪 Camello', url: AV + 'camel.webp' },
    { id: 'plane', emoji: '✈️', label: '✈️ Avión', url: AV + 'plane.webp' },
    { id: 'falcon', emoji: '🦅', label: '🦅 Halcón', url: AV + 'falcon.webp' },
    { id: 'oryx', emoji: '🦌', label: '🦌 Órix', url: AV + 'oryx.webp' },
  ];
  // a kid who had picked a brand avatar now shows one of the saga (server migrates the record once, pages map too)
  const LEGACY_AVATARS = {
    gojo: 'adric', yugi: 'adrian', yuji: 'hamdan', shelly: 'aileen', fnaf: 'camel', dandy: 'oryx', hanzo: 'hamdan',
    mei2: 'latifa', naruto: 'adric', sasuke: 'adrian', luffy: 'fer', goku: 'hamdan', pikachu: 'falcon',
    squirtle: 'oryx', sonic: 'plane', mario: 'camel', kirby: 'aileen', spiderman: 'adrian', ironman: 'plane',
    elsa: 'latifa', moana: 'aileen',
  };
  // own-key lookups only: an id like '__proto__' or 'constructor' must never pass a whitelist (server uses these)
  const own = (obj, k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : null);
  const byId = (list) => { const m = Object.create(null); list.forEach((x) => { m[x.id] = x; }); return m; };
  const ANIM = byId(ANIMS), BURST = byId(BURSTS), AVATAR = byId(AVATARS);
  const legacyAvatar = (id) => own(LEGACY_AVATARS, id);
  return {
    ANIMS, BURSTS, AVATARS, LEGACY_AVATARS,
    anim: (id) => own(ANIM, id),
    byEmoji: (e) => AVATARS.find((a) => a.emoji === e) || null,
    burst: (id) => own(BURST, id),
    legacyAvatar,
    avatar: (id) => own(AVATAR, legacyAvatar(id) || id),
    // any stored avatar name → its saga picture; null for emoji / unknown values. 2026-10-12 (his ask: only our roster):
    // the old generic DiceBear names (mochi, robo, alien…) also show a saga avatar, the same one every time for a name.
    avatarUrl(name) {
      const a = own(AVATAR, legacyAvatar(name) || name);
      if (a) return a.url;
      if (typeof name !== 'string' || !/^[a-z0-9]+$/.test(name)) return null;
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
      return AVATARS[h % AVATARS.length].url;
    },
    // search words for a tray tile: id + label, with and without accents («avión» / «avion»)
    searchText(x) {
      const t = (x.id + ' ' + x.label).toLowerCase();
      return t + ' ' + t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    },
  };
});
