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
    // 2026-10-13: his route — local AI picture on green → Canva Image to Video → ../video_tools/canva_anim.py
    { id: 'dralingo-festeja', label: '🎉 Dralingo festeja', url: '/assets/dralingo/anim/cheer.webp', still: '/assets/dralingo/anim/cheer-still.webp' },
    { id: 'fer-bienvenida', label: '👨‍🏫 Profe Fer', url: '/assets/cast/anim/fer-welcome.webp', still: '/assets/cast/anim/fer-welcome-still.webp' },
    { id: 'adric-festeja', label: '🐕 Adric y su perro', url: '/assets/cast/anim/adric-cheer.webp', still: '/assets/cast/anim/adric-cheer-still.webp' },
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
  // 🆕 2026-10-19 · El Zoco de Dralingo (his OK: "Okay I approve the design of the Souq"): the characters a kid unlocks
  // with coins, renders of his own 3D models (assets-library/originals-renders/2026-10-19). A skin is the kid's
  // character everywhere: every page draws it through avatarUrl / skinHead / skinBody below, and every game through
  // HalconBoard / SnowMap (which ask this list). `base` = the saga character it is a form of (a page or game that has no
  // place for the skin shows the base); `animal` = no human poses. The shop (prices, held ones, who may buy, the coins)
  // is core/zoco.js; this list only says how to draw them. A new character: its renders in /assets/zoco/full + avatar,
  // a row here, a row in core/zoco.js (the test checks both lists agree).
  // ar = the full picture's width / height, hx = where the face is across it (0 left … 1 right): a page places a
  // character by its face (the shop's spotlight); the round head pictures are cut around the face the same way.
  // fx (2026-10-20, the pedestal) = where the character stands across it (its feet, paws or seat), when not under the face.
  const ZOCO = [
    { id: 'dralingo-sheikh', base: 'dralingo', label: 'Dralingo Sheikh', ar: 1.46, hx: 0.375, fx: 0.47 },
    { id: 'dralingo-sheikh-roja', base: 'dralingo', label: 'Dralingo Sheikh · ghutra roja', ar: 1.46, hx: 0.375, fx: 0.47 },
    { id: 'dralingo-sheikh-paseo', base: 'dralingo', label: 'Dralingo de paseo', ar: 1.33, hx: 0.36, fx: 0.48 },
    { id: 'dralingo-sheikh-paseo-roja', base: 'dralingo', label: 'Dralingo de paseo · ghutra roja', ar: 1.33, hx: 0.36, fx: 0.48 },
    { id: 'dralingo-clasico', base: 'dralingo', label: 'Dralingo clásico', ar: 1.46, hx: 0.365, fx: 0.44 },
    { id: 'bebe-dralingo-emperador', base: 'dralingo', label: 'Bebé Dralingo Emperador', ar: 0.86, hx: 0.5, fx: 0.52 },
    { id: 'bebe-dralingo-kufiya', base: 'dralingo', label: 'Bebé Dralingo con kufiya', ar: 1.08, hx: 0.49, fx: 0.52 },
    { id: 'dralingo-emperador', base: 'dralingo', label: 'Dralingo Emperador', ar: 1.14, hx: 0.33, fx: 0.46 },
    { id: 'dralingo-emperador-barba', base: 'dralingo', label: 'Dralingo Emperador Sabio', ar: 1.14, hx: 0.33, fx: 0.46 },
    { id: 'dralingo-emperador-qin', base: 'dralingo', label: 'Dralingo Emperador Qin', ar: 1.22, hx: 0.335, fx: 0.46 },
    { id: 'dralingo-fuego-azul', base: 'dralingo', label: 'Dralingo Fuego Azul', ar: 1.57, hx: 0.44, fx: 0.5 },
    { id: 'profe-fer', base: 'fer', label: 'Profe Fer de traje', ar: 0.45, hx: 0.49 },
    { id: 'hamdan-3d', base: 'hamdan', label: 'Hamdan con kandura', ar: 0.38, hx: 0.47 },
    { id: 'latifa-3d', base: 'latifa', label: 'Latifa con abaya', ar: 0.44, hx: 0.5, fx: 0.49 },
    { id: 'aileen-3d', base: 'aileen', label: 'Aileen artes marciales', ar: 0.55, hx: 0.52, fx: 0.48 },
    { id: 'adric-3d', base: 'adric', label: 'Adric de negro', ar: 0.41, hx: 0.5 },
    { id: 'adrian-3d', base: 'adrian', label: 'Adrian con chaqueta', ar: 0.45, hx: 0.52 },
    { id: 'perro-de-adric', base: 'adric', label: 'El perro de Adric', animal: true, emoji: '🐕', ar: 0.85, hx: 0.82, fx: 0.57 },
    { id: 'poni-de-aileen', base: 'aileen', label: 'La poni unicornio de Aileen', animal: true, emoji: '🦄', ar: 0.9, hx: 0.79, fx: 0.53 },
    { id: 'panda-3d', base: 'dralingo', label: 'Panda', animal: true, emoji: '🐼', ar: 0.55, hx: 0.47, fx: 0.5 },
  ];
  const ZB = '/assets/zoco/';
  // 🆕 2026-10-20 · the art slots of El Zoco (his words: "they look too plain and boring now… it should feel like the 3D
  // avatar is there waiting for you"). Filled ONLY by `node scripts/zoco-art.js` from the files it finds (swapping in new
  // art is data: drop the files with the right names, run the script, it writes these two maps with a ?v= per file and
  // bumps saga.js everywhere); empty = every character shows its render, as on 2026-10-19.
  //   ZOCO_ART[id]  = { full, avatar[, ar, hx, fx] }  the glossy platform-look picture (public/assets/zoco/full/<id>-g.webp
  //                   + avatar/<id>-g.webp): the shop, the games, Mi perfil and the rosters draw it instead of the render
  //   ZOCO_ANIM[id] = { still, full, lite[, ar, hx, fx] }  the idle «waiting» loop (public/assets/zoco/anim/<id>-still.webp,
  //                   <id>.webp, <id>-lite.webp): only where one screen shows one character, the still first, the loop
  //                   swapped in once loaded (the lite one on a phone), never with reduced motion
  // ar comes from the file; hx / fx default to the render's (the art is made from the render: same pose).
  // <zoco-art>
  const ZOCO_ART = {};
  const ZOCO_ANIM = {};
  // </zoco-art>
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
  const ANIM = byId(ANIMS), BURST = byId(BURSTS), AVATAR = byId(AVATARS), SKIN = byId(ZOCO);
  const legacyAvatar = (id) => own(LEGACY_AVATARS, id);
  const zoco = (id) => own(SKIN, id);
  const zArt = (id) => { const z = zoco(id); return z ? own(ZOCO_ART, z.id) : null; };
  // a picture's look: { ar, hx, fx } (fx = hx when the character stands under its face; a slot's own values win)
  const lookOf = (z, slot) => {
    const ar = Number((slot && slot.ar) || z.ar) || 1;
    const hx = Number((slot && slot.hx) || z.hx) || 0.5;
    return { ar, hx, fx: Number((slot && slot.fx) || z.fx) || hx };
  };
  return {
    ANIMS, BURSTS, AVATARS, LEGACY_AVATARS, ZOCO, ZOCO_ART, ZOCO_ANIM,
    anim: (id) => own(ANIM, id),
    byEmoji: (e) => AVATARS.find((a) => a.emoji === e) || null,
    burst: (id) => own(BURST, id),
    legacyAvatar,
    avatar: (id) => own(AVATAR, legacyAvatar(id) || id),
    // 🆕 2026-10-19 El Zoco: a skin of the shop by its id (null for anything else)
    zoco,
    // the saga character a skin is a form of ('dralingo-fuego-azul' → 'dralingo'); any other value as it is
    skinBase: (id) => { const z = zoco(id); return z ? z.base : id; },
    // the round head picture (256 × 256) of a saga avatar or a skin; null for anything else (a skin's glossy head first)
    skinHead: (id) => { const z = zoco(id); if (z) { const g = zArt(z.id); return g && g.avatar ? g.avatar : ZB + 'avatar/' + z.id + '.webp'; } const a = own(AVATAR, legacyAvatar(id) || id); return a ? a.url : null; },
    // a skin's full-body picture (transparent; one pose: games draw it for every pose; its glossy picture first, else
    // the 480 px render); null for the rest
    skinBody: (id) => { const z = zoco(id); if (!z) return null; const g = zArt(z.id); return g && g.full ? g.full : ZB + 'full/' + z.id + '.webp'; },
    // 🆕 2026-10-20 the idle «waiting» loop of a skin: { still, full, lite, ar, hx, fx } or null (no loop yet)
    skinAnim: (id) => {
      const z = zoco(id);
      const a = z ? own(ZOCO_ANIM, z.id) : null;
      return a && a.still && a.full ? Object.assign({ still: a.still, full: a.full, lite: a.lite || a.full }, lookOf(z, a)) : null;
    },
    // 🆕 2026-10-20 how a skin's full-body picture (skinBody) stands: { ar, hx, fx }; null for the rest
    skinLook: (id) => { const z = zoco(id); return z ? lookOf(z, zArt(z.id)) : null; },
    // a character's name for a «Vas a jugar como …» line: a skin's own name, a saga avatar's name (no emoji in front)
    labelOf(id) {
      const z = zoco(id);
      if (z) return z.label;
      const a = own(AVATAR, legacyAvatar(id) || id);
      return a ? a.label.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/, '').trim() : '';
    },
    // what a text-only list prints for a kid's avatar (a projector's lobby chips): the emoji of the saga character (a
    // skin: its base's, or its own for a pet), an emoji as it is; '' for anything else (never an id as text)
    emojiOf(v) {
      if (typeof v !== 'string' || !v) return '';
      const z = zoco(v);
      if (z) { if (z.emoji) return z.emoji; const b = own(AVATAR, z.base); return b ? b.emoji : ''; }
      const a = own(AVATAR, legacyAvatar(v) || v);
      if (a) return a.emoji;
      return /^[a-z0-9-]+$/.test(v) ? '' : v.slice(0, 8);
    },
    // any stored avatar name → its saga picture; null for emoji / unknown values. 2026-10-12 (his ask: only our roster):
    // the old generic DiceBear names (mochi, robo, alien…) also show a saga avatar, the same one every time for a name.
    // (2026-10-19: a skin of El Zoco → its own head picture)
    avatarUrl(name) {
      const z = zoco(name);
      if (z) { const g = zArt(z.id); return g && g.avatar ? g.avatar : ZB + 'avatar/' + z.id + '.webp'; }
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
