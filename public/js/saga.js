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
  const ZOCO_ART = {
    "dralingo-emperador-qin": {"full":"/assets/zoco/full/dralingo-emperador-qin-g.webp?v=fe332ba6","ar":0.89,"avatar":"/assets/zoco/avatar/dralingo-emperador-qin-g.webp?v=5cc7b4ab"},
    "dralingo-fuego-azul": {"full":"/assets/zoco/full/dralingo-fuego-azul-g.webp?v=133475ab","ar":0.74,"avatar":"/assets/zoco/avatar/dralingo-fuego-azul-g.webp?v=b213f566"},
    "dralingo-sheikh": {"full":"/assets/zoco/full/dralingo-sheikh-g.webp?v=ed3ba907","ar":0.93,"avatar":"/assets/zoco/avatar/dralingo-sheikh-g.webp?v=fcb57545"},
    "dralingo-emperador-barba": {"full":"/assets/zoco/full/dralingo-emperador-barba-g.webp?v=3891de33","ar":0.77,"avatar":"/assets/zoco/avatar/dralingo-emperador-barba-g.webp?v=596cb112"},
    "dralingo-sheikh-paseo-roja": {"full":"/assets/zoco/full/dralingo-sheikh-paseo-roja-g.webp?v=d6faac2e","ar":1.01,"avatar":"/assets/zoco/avatar/dralingo-sheikh-paseo-roja-g.webp?v=013c7736"},
    "dralingo-clasico": {"full":"/assets/zoco/full/dralingo-clasico-g.webp?v=db1635cc","ar":0.9,"avatar":"/assets/zoco/avatar/dralingo-clasico-g.webp?v=65e9fd79"},
    "dralingo-emperador": {"full":"/assets/zoco/full/dralingo-emperador-g.webp?v=3819ca8a","ar":0.83,"avatar":"/assets/zoco/avatar/dralingo-emperador-g.webp?v=0995de32"},
    "bebe-dralingo-kufiya": {"full":"/assets/zoco/full/bebe-dralingo-kufiya-g.webp?v=dafbbe2b","ar":0.58,"avatar":"/assets/zoco/avatar/bebe-dralingo-kufiya-g.webp?v=48ddb1c6"},
    "dralingo-sheikh-roja": {"full":"/assets/zoco/full/dralingo-sheikh-roja-g.webp?v=936564d4","ar":0.86,"avatar":"/assets/zoco/avatar/dralingo-sheikh-roja-g.webp?v=f5da6feb"},
    "bebe-dralingo-emperador": {"full":"/assets/zoco/full/bebe-dralingo-emperador-g.webp?v=f965205b","ar":0.49,"avatar":"/assets/zoco/avatar/bebe-dralingo-emperador-g.webp?v=d7a66869"},
    "dralingo-sheikh-paseo": {"full":"/assets/zoco/full/dralingo-sheikh-paseo-g.webp?v=4e681764","ar":0.86,"avatar":"/assets/zoco/avatar/dralingo-sheikh-paseo-g.webp?v=fdf1d9d6"},
    "profe-fer": {"full":"/assets/zoco/full/profe-fer-g.webp?v=1ab0a2f8","ar":0.34,"avatar":"/assets/zoco/avatar/profe-fer-g.webp?v=492b80a5"},
    "hamdan-3d": {"full":"/assets/zoco/full/hamdan-3d-g.webp?v=fac9b8fa","ar":0.35,"avatar":"/assets/zoco/avatar/hamdan-3d-g.webp?v=880e36e2"},
    "latifa-3d": {"full":"/assets/zoco/full/latifa-3d-g.webp?v=00fe06b5","ar":0.33,"avatar":"/assets/zoco/avatar/latifa-3d-g.webp?v=cc1a1bf4"},
    "aileen-3d": {"full":"/assets/zoco/full/aileen-3d-g.webp?v=49051abb","ar":0.49,"avatar":"/assets/zoco/avatar/aileen-3d-g.webp?v=d58b99d1"},
    "adric-3d": {"full":"/assets/zoco/full/adric-3d-g.webp?v=49570d13","ar":0.39,"avatar":"/assets/zoco/avatar/adric-3d-g.webp?v=20e31ca0"},
    "adrian-3d": {"full":"/assets/zoco/full/adrian-3d-g.webp?v=5f4f6b73","ar":0.38,"avatar":"/assets/zoco/avatar/adrian-3d-g.webp?v=fc898fd1"},
    "perro-de-adric": {"full":"/assets/zoco/full/perro-de-adric-g.webp?v=fa789149","ar":0.49,"avatar":"/assets/zoco/avatar/perro-de-adric-g.webp?v=d7f8c88e"},
    "poni-de-aileen": {"full":"/assets/zoco/full/poni-de-aileen-g.webp?v=b643ac56","ar":0.76,"avatar":"/assets/zoco/avatar/poni-de-aileen-g.webp?v=967ea073"},
    "panda-3d": {"full":"/assets/zoco/full/panda-3d-g.webp?v=17a735c6","ar":0.55,"avatar":"/assets/zoco/avatar/panda-3d-g.webp?v=2a102777"}
  };
  const ZOCO_ANIM = {
    "dralingo-emperador-qin": {"still":"/assets/zoco/anim/dralingo-emperador-qin-still.webp?v=983a7e27","full":"/assets/zoco/anim/dralingo-emperador-qin.webp?v=6ff86d58","lite":"/assets/zoco/anim/dralingo-emperador-qin-lite.webp?v=d2f1cd4a","ar":1.23},
    "dralingo-fuego-azul": {"still":"/assets/zoco/anim/dralingo-fuego-azul-still.webp?v=aa9070ac","full":"/assets/zoco/anim/dralingo-fuego-azul.webp?v=f66d6bd2","lite":"/assets/zoco/anim/dralingo-fuego-azul-lite.webp?v=86773418","ar":0.98},
    "dralingo-sheikh": {"still":"/assets/zoco/anim/dralingo-sheikh-still.webp?v=316a814a","full":"/assets/zoco/anim/dralingo-sheikh.webp?v=c94d4467","lite":"/assets/zoco/anim/dralingo-sheikh-lite.webp?v=6c3c9f92","ar":1.26},
    "dralingo-emperador-barba": {"still":"/assets/zoco/anim/dralingo-emperador-barba-still.webp?v=030f7c16","full":"/assets/zoco/anim/dralingo-emperador-barba.webp?v=2f64105d","lite":"/assets/zoco/anim/dralingo-emperador-barba-lite.webp?v=df859c4b","ar":1.09},
    "dralingo-sheikh-paseo-roja": {"still":"/assets/zoco/anim/dralingo-sheikh-paseo-roja-still.webp?v=69b3f2a0","full":"/assets/zoco/anim/dralingo-sheikh-paseo-roja.webp?v=7107c862","lite":"/assets/zoco/anim/dralingo-sheikh-paseo-roja-lite.webp?v=250d2e88","ar":1.28},
    "dralingo-clasico": {"still":"/assets/zoco/anim/dralingo-clasico-still.webp?v=734b53bc","full":"/assets/zoco/anim/dralingo-clasico.webp?v=feca1980","lite":"/assets/zoco/anim/dralingo-clasico-lite.webp?v=d4783746","ar":1.33},
    "dralingo-emperador": {"still":"/assets/zoco/anim/dralingo-emperador-still.webp?v=e2c2936c","full":"/assets/zoco/anim/dralingo-emperador.webp?v=ceb393e6","lite":"/assets/zoco/anim/dralingo-emperador-lite.webp?v=53a7edd8","ar":1.24},
    "bebe-dralingo-kufiya": {"still":"/assets/zoco/anim/bebe-dralingo-kufiya-still.webp?v=03a173e3","full":"/assets/zoco/anim/bebe-dralingo-kufiya.webp?v=9dc945dc","lite":"/assets/zoco/anim/bebe-dralingo-kufiya-lite.webp?v=714063e4","ar":0.76},
    "dralingo-sheikh-roja": {"still":"/assets/zoco/anim/dralingo-sheikh-roja-still.webp?v=6f4ce379","full":"/assets/zoco/anim/dralingo-sheikh-roja.webp?v=4aad19bb","lite":"/assets/zoco/anim/dralingo-sheikh-roja-lite.webp?v=6db5f243","ar":1.31},
    "bebe-dralingo-emperador": {"still":"/assets/zoco/anim/bebe-dralingo-emperador-still.webp?v=ac81b57c","full":"/assets/zoco/anim/bebe-dralingo-emperador.webp?v=4ef78b74","lite":"/assets/zoco/anim/bebe-dralingo-emperador-lite.webp?v=70a18cbf","ar":0.54},
    "dralingo-sheikh-paseo": {"still":"/assets/zoco/anim/dralingo-sheikh-paseo-still.webp?v=433eb94b","full":"/assets/zoco/anim/dralingo-sheikh-paseo.webp?v=f9187a5d","lite":"/assets/zoco/anim/dralingo-sheikh-paseo-lite.webp?v=c1c0e4b5","ar":0.86},
    "profe-fer": {"still":"/assets/zoco/anim/profe-fer-still.webp?v=b1c45624","full":"/assets/zoco/anim/profe-fer.webp?v=116823e7","lite":"/assets/zoco/anim/profe-fer-lite.webp?v=3e9f16ae","ar":0.36},
    "hamdan-3d": {"still":"/assets/zoco/anim/hamdan-3d-still.webp?v=db713881","full":"/assets/zoco/anim/hamdan-3d.webp?v=c5d6033d","lite":"/assets/zoco/anim/hamdan-3d-lite.webp?v=1d168fa0","ar":0.36},
    "latifa-3d": {"still":"/assets/zoco/anim/latifa-3d-still.webp?v=6ecbc16f","full":"/assets/zoco/anim/latifa-3d.webp?v=3493e02a","lite":"/assets/zoco/anim/latifa-3d-lite.webp?v=2b9b5d56","ar":0.34},
    "aileen-3d": {"still":"/assets/zoco/anim/aileen-3d-still.webp?v=1ea4f4f8","full":"/assets/zoco/anim/aileen-3d.webp?v=17523627","lite":"/assets/zoco/anim/aileen-3d-lite.webp?v=1567dcec","ar":0.5},
    "adric-3d": {"still":"/assets/zoco/anim/adric-3d-still.webp?v=cbe81f45","full":"/assets/zoco/anim/adric-3d.webp?v=217986d1","lite":"/assets/zoco/anim/adric-3d-lite.webp?v=a34f679e","ar":0.4},
    "adrian-3d": {"still":"/assets/zoco/anim/adrian-3d-still.webp?v=0a7ebc4a","full":"/assets/zoco/anim/adrian-3d.webp?v=9803cb8f","lite":"/assets/zoco/anim/adrian-3d-lite.webp?v=9f72ed8b","ar":0.42},
    "perro-de-adric": {"still":"/assets/zoco/anim/perro-de-adric-still.webp?v=44a46ef2","full":"/assets/zoco/anim/perro-de-adric.webp?v=e900dbdb","lite":"/assets/zoco/anim/perro-de-adric-lite.webp?v=63558f64","ar":0.5},
    "poni-de-aileen": {"still":"/assets/zoco/anim/poni-de-aileen-still.webp?v=dab98333","full":"/assets/zoco/anim/poni-de-aileen.webp?v=174f3303","lite":"/assets/zoco/anim/poni-de-aileen-lite.webp?v=0b4c38a1","ar":0.79},
    "panda-3d": {"still":"/assets/zoco/anim/panda-3d-still.webp?v=19ef5195","full":"/assets/zoco/anim/panda-3d.webp?v=0afe3b5f","lite":"/assets/zoco/anim/panda-3d-lite.webp?v=b9e6306d","ar":0.58}
  };
  // </zoco-art>
  // 🧊 2026-10-20 · El Zoco in real 3D (his words: "it looked like a display in 3D… each character… you can touch it and
  // move it… Like if you were interacting in the 3D world"; his pick «Real 3D, try 3 first»): the characters whose page
  // (#zoco-<id>) puts HIS original 3D model on the pedestal (js/zoco3d/stage.js: turn it with a finger, zoom, tap → it
  // hops). The models come from his files through tools/blender/zoco_web_glb.py (root repo, assets-library/zoco-3d/) and
  // go online only with his «sube»: a model missing on the server leaves the picture and its loop (one quick 404).
  //   glb   its file (?v= = the file's own hash: a new model is a new name for Cloudflare and the phones)
  //   coat  the clear coat of the glossy look (0…1) · rough  its roughness range [lo, hi] · yaw  how it faces at rest
  const ZOCO_3D = {
    'dralingo-sheikh': { glb: '/assets/zoco/3d/dralingo-sheikh.glb?v=39a89dc5', coat: 0.25, rough: [0.3, 0.5] },
    'hamdan-3d': { glb: '/assets/zoco/3d/hamdan-3d.glb?v=70348a31', coat: 0.1, rough: [0.38, 0.65] },
    'panda-3d': { glb: '/assets/zoco/3d/panda-3d.glb?v=4d1d9777', coat: 0.15, rough: [0.38, 0.65] },
  };
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
  // one picture of a skin's glossy art (a string, or null: a hand-edited map never yields a broken src)
  const artOf = (id, k) => { const g = zArt(id); return g && typeof g[k] === 'string' && g[k] ? g[k] : null; };
  // a picture's look: { ar, hx, fx } (fx = hx when the character stands under its face; a slot's own values win)
  // (review 2026-10-20: a hand-edited map can hold anything: finite numbers only, hx / fx within 0…1, ar within 0.2…3)
  const num = (...vs) => { for (const v of vs) { const n = Number(v); if (v != null && v !== '' && Number.isFinite(n)) return n; } return null; };
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const lookOf = (z, slot) => {
    const ar = clamp(num(slot && slot.ar, z.ar) || 1, 0.2, 3);
    const hx = clamp(num(slot && slot.hx, z.hx) == null ? 0.5 : num(slot && slot.hx, z.hx), 0, 1);
    const fx = num(slot && slot.fx, z.fx);
    return { ar, hx, fx: fx == null ? hx : clamp(fx, 0, 1) };
  };
  return {
    ANIMS, BURSTS, AVATARS, LEGACY_AVATARS, ZOCO, ZOCO_ART, ZOCO_ANIM, ZOCO_3D,
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
    skinHead: (id) => { const z = zoco(id); if (z) { return artOf(z.id, 'avatar') || ZB + 'avatar/' + z.id + '.webp'; } const a = own(AVATAR, legacyAvatar(id) || id); return a ? a.url : null; },
    // a skin's full-body picture (transparent; one pose: games draw it for every pose; its glossy picture first, else
    // the 480 px render); null for the rest
    skinBody: (id) => { const z = zoco(id); if (!z) return null; return artOf(z.id, 'full') || ZB + 'full/' + z.id + '.webp'; },
    // 🆕 2026-10-20 the idle «waiting» loop of a skin: { still, full, lite, ar, hx, fx } or null (no loop yet). lite is
    // null when there is none: a phone then keeps the still (never the full ~1 MB loop)
    skinAnim: (id) => {
      const z = zoco(id);
      const a = z ? own(ZOCO_ANIM, z.id) : null;
      return a && typeof a.still === 'string' && typeof a.full === 'string'
        ? Object.assign({ still: a.still, full: a.full, lite: typeof a.lite === 'string' && a.lite ? a.lite : null }, lookOf(z, a)) : null;
    },
    // 🆕 2026-10-20 how a skin's full-body picture (skinBody) stands: { ar, hx, fx }; null for the rest
    skinLook: (id) => { const z = zoco(id); return z ? lookOf(z, zArt(z.id)) : null; },
    // 🧊 2026-10-20 a skin's real 3D model (ZOCO_3D): { id, glb, coat, rough: [lo, hi], yaw } or null (only a skin listed
    // there, with a file of /assets/zoco/3d/; a hand-edited map never yields a value out of range)
    skin3d: (id) => {
      const z = zoco(id);
      const m = z ? own(ZOCO_3D, z.id) : null;
      if (!m || typeof m.glb !== 'string' || !/^\/assets\/zoco\/3d\/[a-z0-9-]+\.glb(\?v=[A-Za-z0-9_-]{1,40})?$/.test(m.glb)) return null;
      const r = Array.isArray(m.rough) ? m.rough : [];
      const lo = clamp(num(r[0]) == null ? 0.3 : num(r[0]), 0, 1);
      const hi = clamp(num(r[1]) == null ? Math.max(lo, 0.6) : num(r[1]), lo, 1);
      return { id: z.id, glb: m.glb, coat: clamp(num(m.coat) == null ? 0.2 : num(m.coat), 0, 1), rough: [lo, hi],
        yaw: clamp(num(m.yaw) || 0, -Math.PI, Math.PI) };
    },
    // 🧊 why a phone does NOT get the 3D character (null = it may try; the page keeps the picture and its loop otherwise):
    // env = { reduced (prefers-reduced-motion), saveData, webgl (the phone can draw 3D), memory (navigator.deviceMemory,
    // GB), failed (this model already failed on this page) }
    skin3dBlock(env) {
      const e = env || {};
      if (e.reduced) return 'reduced';
      if (e.saveData) return 'save-data';
      if (!e.webgl) return 'webgl';
      if (e.memory != null && Number(e.memory) > 0 && Number(e.memory) < 2) return 'memory';
      if (e.failed) return 'failed';
      return null;
    },
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
      if (z) { return artOf(z.id, 'avatar') || ZB + 'avatar/' + z.id + '.webp'; }
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
