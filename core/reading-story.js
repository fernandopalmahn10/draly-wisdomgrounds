// =========================================================================
// reading-story.js — built-in Reading-mode stories
//
// HOW TO ADD A NEW STORY
// =========================================================================
// 1. Pick a short id (lowercase, no spaces) for your story. Examples:
//      'xiaomingday', 'lunarnewyear', 'marketday', 'firstrain'
//
// 2. Add a new entry to the STORIES object below, following the shape of
//    the existing 'xiaomingday' entry:
//      - title (pinyin)
//      - subtitle (Spanish gloss)
//      - pages: an array of pages, each with
//          pageNum, caption (Spanish), sentences (pinyin), sentencesEs
//          (Spanish translation, same count + order), audioDurationMs
//
// 3. Drop your assets into:
//      public/assets/reading/<storyId>/page-1.png   (illustration)
//      public/assets/reading/<storyId>/page-1.mp3   (Chinese narration)
//      ...one pair per page.
//
// 4. Restart the server (Render auto-deploys on push). Your new story
//    appears in the host's lobby story picker automatically.
//
// HOW TO EDIT AN EXISTING STORY
// =========================================================================
// Just change the text in `sentences` (pinyin) or `sentencesEs` (Spanish)
// of the relevant page. Word timestamps auto-redistribute. If you change
// `audioDurationMs`, update your audio recording length to match.
// PINYIN ONLY in the `sentences` array — no hanzi (teacher spec).
// =========================================================================
'use strict';

const DEFAULT_PAGE_AUDIO_MS = 8000;

// All stories live here. Add new entries to expand the library. The
// `id` (key) becomes the URL path component for that story's assets.
const STORIES = {
  // === STORY 1 ===
  xiaomingday: {
    id: 'xiaomingday',
    title: 'Xiǎo Míng de yī tiān',
    subtitle: 'Un día con Xiǎo Míng',
    exp: 'exp8',  // late-set vocab (school/weather/shopping) → EXP8
    music: 'mochi-mash',     // upbeat, warm, daily-life vibes
    animated: false,         // PNG stills only
    assetVersion: '20260601a', // bump when you replace the page-N.png files
    // === Test bank ===
    // 5 multiple-choice questions, each worth 20 points (100 total).
    // Questions are tied to EVENTS in the story — kids who actually
    // read/listened can answer; kids who didn't can't guess. Pinyin and
    // Spanish are intentionally mixed: some questions use pinyin in the
    // stem with Spanish choices, some use Spanish stems with pinyin
    // choices, so the test trains BOTH directions. HSK1 vocab only.
    questions: [
      {
        // Story fact: "Wǒ jiā yǒu sì gè rén" (page 1)
        q: '¿Cuántas personas viven en la casa de Xiǎo Míng?',
        choices: ['Sì (4)', 'Sān (3)', 'Wǔ (5)', 'Liù (6)'],
        correctIdx: 0,
      },
      {
        // Story fact: "Bàba kàn diànshì" (page 2)
        q: 'En la mañana, ¿qué hace bàba?',
        choices: ['kàn diànshì', 'chī mǐfàn', 'qù xuéxiào', 'shuìjiào'],
        correctIdx: 0,
      },
      {
        // Story fact: "Wǒ qù xuéxiào" (page 3) — completion in pinyin
        q: '"Wǒ qù ___" — completa como en el cuento:',
        choices: ['xuéxiào (escuela)', 'shāngdiàn (tienda)', 'yīyuàn (hospital)', 'jiā (casa)'],
        correctIdx: 0,
      },
      {
        // Story fact: "Wǒ chī fàn, hē chá" (page 5)
        q: 'En el almuerzo, Xiǎo Míng bebe…',
        choices: ['chá (té)', 'shuǐ (agua)', 'kāfēi (café)', 'niúnǎi (leche)'],
        correctIdx: 0,
      },
      {
        // Story fact: "Tiānqì hěn rè" (page 6) — Spanish question, pinyin answer
        q: 'Por la tarde, ¿cómo está el tiempo?',
        choices: ['Hěn rè (caluroso)', 'Hěn lěng (frío)', 'Xiàyǔ (lluvia)', 'Xià xuě (nieve)'],
        correctIdx: 0,
      },
    ],
    pages: [
      {
        pageNum: 1,
        caption: 'Por la mañana, en casa',
        sentences: [
          'Jīntiān shì xīngqī yī.',
          'Wǒ jiào Xiǎo Míng. Wǒ shì xuéshēng.',
          'Wǒ jiā yǒu sì gè rén: bàba, māma, jiějie hé wǒ.',
          'Wǒ ài wǒ de jiā.',
        ],
        sentencesEs: [
          'Hoy es lunes.',
          'Me llamo Xiǎo Míng. Soy estudiante.',
          'En mi casa somos cuatro personas: papá, mamá, mi hermana y yo.',
          'Amo a mi familia.',
        ],
        audioDurationMs: 10000,
      },
      {
        pageNum: 2,
        caption: 'El desayuno',
        sentences: [
          'Shàngwǔ qī diǎn, wǒ qǐchuáng.',
          'Wǒ chī mǐfàn, hē shuǐ.',
          'Bàba kàn diànshì. Māma hěn gāoxìng.',
          'Jiějie zài kàn shū.',
        ],
        sentencesEs: [
          'A las siete de la mañana, me levanto.',
          'Como arroz y tomo agua.',
          'Papá ve la televisión. Mamá está muy contenta.',
          'Mi hermana está leyendo un libro.',
        ],
        audioDurationMs: 9000,
      },
      {
        pageNum: 3,
        caption: 'Al colegio',
        sentences: [
          'Wǒ qù xuéxiào.',
          'Xuéxiào zài qiánmiàn. Wǒ bù zuò chūzūchē.',
          'Wǒ kàn yī gè gǒu. Gǒu hěn xiǎo, hěn piàoliang.',
        ],
        sentencesEs: [
          'Voy a la escuela.',
          'La escuela está al frente. No tomo taxi.',
          'Veo un perrito. Es muy pequeño y muy bonito.',
        ],
        audioDurationMs: 8500,
      },
      {
        pageNum: 4,
        caption: 'En la escuela',
        sentences: [
          'Lǎoshī shuō: "Nǐ hǎo!"',
          'Wǒ shuō: "Lǎoshī hǎo!"',
          'Wǒmen xuéxí Hànyǔ. Wǒ rènshi wǒ de tóngxué.',
          'Tā shì wǒ de péngyou.',
        ],
        sentencesEs: [
          'La maestra dice: "¡Hola!"',
          'Yo digo: "¡Hola, maestra!"',
          'Estudiamos chino. Conozco a mis compañeros.',
          'Él es mi amigo.',
        ],
        audioDurationMs: 10000,
      },
      {
        pageNum: 5,
        caption: 'La hora del almuerzo',
        sentences: [
          "Zhōngwǔ shí'èr diǎn. Wǒ chī fàn, hē chá.",
          'Cài hěn hǎochī.',
          'Yī gè píngguǒ duōshǎo qián?',
          'Wǔ kuài. Wǒ mǎi yī gè.',
        ],
        sentencesEs: [
          'Es mediodía, las doce. Como comida y tomo té.',
          'La comida está muy rica.',
          '¿Cuánto cuesta una manzana?',
          'Cinco yuanes. Compro una.',
        ],
        audioDurationMs: 10000,
      },
      {
        pageNum: 6,
        caption: 'El tiempo',
        sentences: [
          'Xiànzài xiàwǔ. Tiānqì hěn rè.',
          'Bù lěng. Xiàyǔ ma? Bù xiàyǔ.',
          'Tài hǎo le! Wǒ hé péngyou qù shāngdiàn.',
        ],
        sentencesEs: [
          'Es la tarde. El clima está muy caluroso.',
          'No hace frío. ¿Está lloviendo? No, no llueve.',
          '¡Qué bueno! Mi amigo y yo vamos a la tienda.',
        ],
        audioDurationMs: 9000,
      },
      {
        pageNum: 7,
        caption: 'Por la noche, en casa',
        sentences: [
          'Wǎnshang, wǒ huí jiā. Wǒ kàn diànyǐng.',
          'Wǒ hěn xǐhuan zhège diànyǐng.',
          'Wǒ ài wǒ de jiā. Wǒ shuìjiào.',
          "Wǎn'ān!",
        ],
        sentencesEs: [
          'En la noche, regreso a casa. Veo una película.',
          'Me gusta mucho esta película.',
          'Amo a mi familia. Me voy a dormir.',
          '¡Buenas noches!',
        ],
        audioDurationMs: 10000,
      },
    ],
  },
  // === STORY 2: PĪNPĪN — the soaking-wet water turtle =================
  // Funny Spanglish + pinyin half-and-half story for the kid who's
  // already wrestled with EXP1 vocab. Hardest HSK1 level (uses the
  // possessive 'de', the verb-trio shì/jiào/rènshi, and 'suì' for age).
  // Every page leans on at least one comedic beat — Pīnpīn's water-gun
  // backfires, dog shakes water on him, cat refuses to come down from
  // a tree, etc. The kid who reads carefully gets the gag AND learns.
  pinpin: {
    id: 'pinpin',
    title: 'Pīnpīn de jiā',
    subtitle: 'La casa mojada de Pīnpīn',
    exp: 'exp1',  // pure EXP1 vocab (Yo / Familia: wǒ, jiā, gǒu, māo…)
    music: 'family',         // gentle warm "home / reunion" theme
    animated: false,         // set to true if you drop page-N.gif files
    assetVersion: '20260602a', // bump this when you replace the art
    questions: [
      {
        // Page 1: "Wǒ shì Pīnpīn"
        q: '¿Cómo se llama el personaje del cuento?',
        choices: ['Pīnpīn', 'Xiǎo Míng', 'Bàba', 'Māma'],
        correctIdx: 0,
      },
      {
        // Page 2: Pīnpīn asks the dog
        q: '¿A quién busca Pīnpīn cuando habla con el gǒu?',
        choices: [
          'A su māma',
          'A su bàba',
          'A su érzi',
          'A su gato',
        ],
        correctIdx: 0,
      },
      {
        // Page 3: cat refuses to come down
        q: 'La māo dice que rènshi a la māma de Pīnpīn, pero…',
        choices: [
          'No baja del árbol porque odia el agua',
          'Se va volando',
          'Se duerme',
          'Llama por teléfono',
        ],
        correctIdx: 0,
      },
      {
        // Page 4: "Wǒmen shì péngyou" — three friends
        q: '"Wǒmen shì péngyou" — ¿qué significa?',
        choices: [
          'Somos amigos',
          'Somos familia',
          'Vamos a casa',
          'Tengo hambre',
        ],
        correctIdx: 0,
      },
      {
        // Page 5: "Wǒ shì érzi de bàba"
        q: '"Wǒ shì érzi de bàba" — ¿qué significa?',
        choices: [
          'Soy el hijo de papá',
          'Mi papá tiene un perro',
          'Vamos a la escuela',
          'Amo a mi mamá',
        ],
        correctIdx: 0,
      },
    ],
    pages: [
      {
        pageNum: 1,
        caption: 'Pīnpīn perdido',
        sentences: [
          'Wǒ shì Pīnpīn.',
          'Wǒ ài wǒ de jiā.',
          'Wǒ de jiā?',
        ],
        sentencesEs: [
          'Soy Pīnpīn, una tortuguita.',
          'Y amo mucho mi casa.',
          '¡Pero hoy estoy perdido en la lluvia!',
        ],
        audioDurationMs: 8000,
      },
      {
        pageNum: 2,
        caption: 'El gǒu',
        sentences: [
          'Gǒu! Wǒ jiào Pīnpīn.',
          'Nǐ rènshi wǒ māma?',
        ],
        sentencesEs: [
          '¡Hola perrito! Me llamo Pīnpīn.',
          '¿Conoces a mi mamá?',
        ],
        audioDurationMs: 7000,
      },
      {
        pageNum: 3,
        caption: 'La māo del árbol',
        sentences: [
          'Māo, nǐ rènshi wǒ māma?',
          'Māo: shì.',
          'Tā ài tā de érzi.',
        ],
        sentencesEs: [
          'Gatita, ¿conoces a mi mamá?',
          'La gata: sí, sí la conozco.',
          'Ella ama mucho a su hijo (pero la gata no baja del árbol, dice — odia el agua).',
        ],
        audioDurationMs: 10000,
      },
      {
        pageNum: 4,
        caption: 'Tres péngyou',
        sentences: [
          'Wǒmen shì péngyou.',
          'Gǒu, māo, wǒ.',
        ],
        sentencesEs: [
          'Ahora somos amigos: el perro, la gata y yo.',
          'Pero la gata viaja arriba del perro — ¡tan dramática! El perro sufre. Yo me río.',
        ],
        audioDurationMs: 9000,
      },
      {
        pageNum: 5,
        caption: 'Bàba y Māma',
        sentences: [
          'Bàba! Māma!',
          'Bàba ài wǒ.',
          'Wǒ shì érzi de bàba.',
        ],
        sentencesEs: [
          '¡Papá! ¡Mamá! ¡Regresé!',
          'Papá me ama.',
          'Soy el hijo de papá — y me da una sombrilla CHIQUITA como regalo.',
        ],
        audioDurationMs: 10000,
      },
      {
        pageNum: 6,
        caption: 'Mi jiā',
        sentences: [
          'Wǒ ài wǒ de jiā.',
          'Bàba, māma, gǒu, māo.',
          'Wǒ de péngyou.',
        ],
        sentencesEs: [
          'Amo mi casa mojadita.',
          'Papá, mamá, perro, gata.',
          'Todos mis amigos — para siempre.',
        ],
        audioDurationMs: 9000,
      },
    ],
  },
  // === STORY 3: YUGI — the ancient pharaoh teacher (EXP2: Escuela/Idioma)
  // Mysterious Egyptian-pyramid vibe. Yugi appears as an ancient lǎoshī
  // teaching the kid the basics of Hànyǔ. Drills EXP2's school+learning
  // vocab in a dramatic anime ritual setting.
  yugipharaoh: {
    id: 'yugipharaoh',
    title: 'Lǎoshī Yugi',
    subtitle: 'El maestro misterioso de la pirámide',
    exp: 'exp2',                  // Escuela / Idioma
    music: 'identity',            // mysterious detective theme fits the mood
    animated: false,              // APNG files use .png extension natively
    assetVersion: '20260603a',    // bumped: user dropped fresh Yugi-pharaoh art
    // 🎨 Theme — purple + gold pharaoh palette. host-reading.js applies
    // these as CSS variables on the body when this story loads.
    theme: {
      primary: '#a070ff',
      accent:  '#ffd24a',
      bgGrad:  'radial-gradient(ellipse at 50% 25%, rgba(160,112,255,0.30), transparent 60%), linear-gradient(180deg, #1a0a2e 0%, #2d0a4a 50%, #0a0a1a 100%)',
    },
    questions: [
      {
        q: '"Lǎoshī" — ¿qué significa?',
        choices: ['Maestro/a', 'Estudiante', 'Libro', 'Escuela'],
        correctIdx: 0,
      },
      {
        q: '¿Qué hace Yugi con el shū antiguo?',
        choices: [
          'Lo lee — kàn shū',
          'Lo come',
          'Lo lanza por la pirámide',
          'Lo vende',
        ],
        correctIdx: 0,
      },
      {
        q: '"Wǒ xiě zì" — ¿qué significa?',
        choices: [
          'Yo escribo caracteres',
          'Yo leo libros',
          'Yo hablo chino',
          'Yo escucho al maestro',
        ],
        correctIdx: 0,
      },
      {
        q: '¿Qué prueba le pone Yugi al estudiante?',
        choices: [
          'Hablar chino — shuō Hànyǔ',
          'Saltar la pirámide',
          'Pelear con monstruos',
          'Comer comida egipcia',
        ],
        correctIdx: 0,
      },
      {
        q: '"Wǒ huì shuō Hànyǔ" — ¿qué significa?',
        choices: [
          'Sé hablar chino',
          'No sé chino',
          'Quiero hablar chino',
          'No me gusta el chino',
        ],
        correctIdx: 0,
      },
    ],
    pages: [
      {
        pageNum: 1,
        caption: 'La pirámide misteriosa',
        sentences: [
          'Yugi lǎoshī.',
          'Wǒ shì xuésheng.',
        ],
        sentencesEs: [
          'Teacher Yugi — el maestro antiguo de la pirámide.',
          'Yo soy su nuevo estudiante. Estamos dentro de una pirámide enorme — las paredes brillan con jeroglíficos y caracteres chinos flotando en el aire.',
        ],
        audioDurationMs: 8000,
      },
      {
        pageNum: 2,
        caption: 'El libro antiguo',
        sentences: [
          'Yugi lǎoshī kàn shū.',
          'Wǒ dú shū.',
        ],
        sentencesEs: [
          'El maestro abre un libro antiguo que flota en el aire — sus páginas brillan con luz dorada.',
          'Yo me acerco y empiezo a leerlo.',
        ],
        audioDurationMs: 8000,
      },
      {
        pageNum: 3,
        caption: 'El primer zì',
        sentences: [
          'Yugi lǎoshī: kàn zì.',
          'Wǒ kàn zì.',
          'Wǒ xiě zì.',
        ],
        sentencesEs: [
          'Teacher Yugi: "Mira este carácter."',
          'Yo lo veo brillar dorado entre sus manos.',
          'Lo escribo con mi dedo en la arena. ¡Lo logré!',
        ],
        audioDurationMs: 10000,
      },
      {
        pageNum: 4,
        caption: 'La prueba',
        sentences: [
          'Yugi lǎoshī shuō: tīng!',
          'Wǒ tīng.',
          'Wǒ shuō Hànyǔ.',
        ],
        sentencesEs: [
          'Teacher Yugi dice: "¡Escucha!" — su voz retumba en la pirámide.',
          'Yo escucho con atención.',
          'Y luego yo hablo en chino — mi voz también suena ancestral.',
        ],
        audioDurationMs: 11000,
      },
      {
        pageNum: 5,
        caption: '¡Nǐ huì!',
        sentences: [
          'Yugi lǎoshī: nǐ huì shuō.',
          'Nǐ huì dú zì.',
        ],
        sentencesEs: [
          'Teacher Yugi asiente con orgullo: "Tú SÍ sabes hablar."',
          'Tú SÍ puedes leer caracteres. Una luz dorada me envuelve — soy un verdadero estudiante de Hànyǔ.',
        ],
        audioDurationMs: 10000,
      },
      {
        pageNum: 6,
        caption: 'El regalo del faraón',
        sentences: [
          'Wǒ shì Yugi lǎoshī de xuésheng.',
          'Wǒ ài xuéxí Hànyǔ.',
        ],
        sentencesEs: [
          'Soy estudiante de Teacher Yugi.',
          'Amo aprender chino. El maestro me da un amuleto dorado — y se desvanece en partículas de luz dorada. Volveré a su pirámide algún día.',
        ],
        audioDurationMs: 11000,
      },
    ],
  },
  // === STORY 4: add here when you have it.
  // Example skeleton (commented out so it doesn't appear in the picker
  // until you flesh it out):
  // marketday: {
  //   id: 'marketday',
  //   title: 'Wǒ qù shāngdiàn',
  //   subtitle: 'Un día en el mercado',
  //   pages: [
  //     { pageNum: 1, caption: '…', sentences: [...], sentencesEs: [...],
  //       audioDurationMs: 8000 },
  //     ...
  //   ],
  // },
};

// Default story shown when a host first opens the reading page.
const DEFAULT_STORY_ID = 'xiaomingday';

// === Helpers ===
function tokenizePage(page) {
  const tokens = [];
  page.sentences.forEach((sentence, sIdx) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    words.forEach((w) => tokens.push({ pinyin: w, sentenceIdx: sIdx }));
  });
  const totalMs = page.audioDurationMs || DEFAULT_PAGE_AUDIO_MS;
  const perWord = totalMs / Math.max(1, tokens.length);
  tokens.forEach((tk, i) => {
    tk.startMs = Math.round(i * perWord);
    tk.endMs = Math.round((i + 1) * perWord);
  });
  return tokens;
}
function sentenceRanges(words) {
  const ranges = {};
  words.forEach((w) => {
    const sIdx = w.sentenceIdx;
    if (!ranges[sIdx]) ranges[sIdx] = { startMs: w.startMs, endMs: w.endMs };
    else {
      ranges[sIdx].startMs = Math.min(ranges[sIdx].startMs, w.startMs);
      ranges[sIdx].endMs = Math.max(ranges[sIdx].endMs, w.endMs);
    }
  });
  const arr = [];
  Object.keys(ranges).sort((a, b) => +a - +b).forEach((k) => {
    arr.push({ sentenceIdx: +k, startMs: ranges[k].startMs, endMs: ranges[k].endMs });
  });
  return arr;
}

// Build the wire-ready payload for ONE story (used when the teacher selects
// it). Asset URLs are namespaced by storyId so multiple stories never
// collide on filenames.
function buildStoryPayload(storyId) {
  const id = storyId && STORIES[storyId] ? storyId : DEFAULT_STORY_ID;
  const story = STORIES[id];
  // 🎨 Animated stories (page-N.gif instead of page-N.png) opt in via
  // `animated: true` on the story config. Cache-busting via assetVersion
  // forces kids to fetch the new art when the teacher replaces it.
  const ext = story.animated ? 'gif' : 'png';
  const ver = story.assetVersion ? '?v=' + encodeURIComponent(story.assetVersion) : '';
  return {
    id,
    title: story.title,
    subtitle: story.subtitle,
    music: story.music || null,     // ← per-story theme name, see sounds.js GAME_THEMES
    theme: story.theme || null,     // ← per-story color palette { primary, accent, bgGrad }
    questionCount: (story.questions || []).length,
    pages: story.pages.map((page) => {
      const words = tokenizePage(page);
      return {
        pageNum: page.pageNum,
        caption: page.caption,
        sentences: page.sentences,
        sentencesEs: page.sentencesEs || [],
        words,
        sentenceRanges: sentenceRanges(words),
        imageUrl: `/assets/reading/${id}/page-${page.pageNum}.${ext}${ver}`,
        audioUrl:  `/assets/reading/${id}/page-${page.pageNum}.mp3${ver}`,
        audioDurationMs: page.audioDurationMs || DEFAULT_PAGE_AUDIO_MS,
      };
    }),
  };
}

// Short summary of every available story — used for the host's picker.
// Doesn't include the page bodies, just enough to choose.
function listStories() {
  return Object.values(STORIES).map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    pageCount: s.pages.length,
    exp: s.exp || 'exp1',   // HSK1 folder bucket for the Modo Maestro picker
    questionCount: (s.questions || []).length,
  }));
}

// Server-only: returns the test bank for a story (with correct answers).
// The host needs this to grade; the player payload strips correctIdx.
function getStoryQuestions(storyId) {
  const s = STORIES[storyId] || STORIES[DEFAULT_STORY_ID];
  return Array.isArray(s.questions) ? s.questions : [];
}

module.exports = {
  STORIES,
  DEFAULT_STORY_ID,
  buildStoryPayload,
  listStories,
  tokenizePage,
  getStoryQuestions,
};
