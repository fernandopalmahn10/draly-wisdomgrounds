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
    questions: [
      {
        // Page 1: "Wǒ shì Pīnpīn. Wǒ tài shīle!" (very wet)
        q: '¿Por qué Pīnpīn está MUY mojado al inicio de la historia?',
        choices: [
          'Su water gun rompió la nube y le cayó toda el agua encima',
          'Se cayó en el océano',
          'Su bàba lo bañó con manguera',
          'Estaba nadando',
        ],
        correctIdx: 0,
      },
      {
        // Page 2: "Gǒu" shakes water on Pīnpīn
        q: '¿Qué hace el gǒu cuando conoce a Pīnpīn?',
        choices: [
          'Le sacude TODA el agua encima',
          'Le da una toalla',
          'Se va corriendo',
          'Se queda dormido',
        ],
        correctIdx: 0,
      },
      {
        // Page 3: cat refuses to climb down
        q: 'La māo dice que rènshi a la māma de Pīnpīn, pero…',
        choices: [
          'NO baja del árbol — odia el agua',
          'Vuela hasta la casa',
          'Se duerme',
          'Llama por teléfono',
        ],
        correctIdx: 0,
      },
      {
        // Page 4: cat rides on the dog's back
        q: '¿Cómo viaja la māo con los péngyou?',
        choices: [
          'Encima del gǒu como una reina dramática',
          'Caminando en el agua',
          'En un taxi',
          'En bicicleta',
        ],
        correctIdx: 0,
      },
      {
        // Page 5: tiny umbrella + new name
        q: 'Pīnpīn tiene 5 suì. ¿Qué míngzi nuevo le dan?',
        choices: [
          '"El Chico de la Sombrilla" — porque su sombrilla es chiquita',
          '"Mojado para siempre"',
          '"Súper tortuga 9000"',
          '"Wǒ Pīnpīn"',
        ],
        correctIdx: 0,
      },
    ],
    pages: [
      {
        pageNum: 1,
        caption: 'Pīnpīn perdido en la lluvia',
        sentences: [
          'Wǒ shì Pīnpīn. Wǒ shì tortuga.',
          'Wǒ de water gun… ¡no funcionó!',
          'Wǒ tài shīle. Wǒ de jiā… ¿en dónde?',
        ],
        sentencesEs: [
          'Soy Pīnpīn. Soy una tortuga.',
          'Mi pistola de agua… ¡no funcionó!',
          'Estoy muy mojado. Mi casa… ¿dónde está?',
        ],
        audioDurationMs: 9000,
      },
      {
        pageNum: 2,
        caption: 'Conociendo al gǒu (más mojado)',
        sentences: [
          'Nǐ hǎo, gǒu! Wǒ jiào Pīnpīn.',
          'Nǐ rènshi a mi māma?',
          'El gǒu sacude… ¡y wǒ más mojado!',
          'Gracias, gǒu. De verdad.',
        ],
        sentencesEs: [
          '¡Hola, perro! Me llamo Pīnpīn.',
          '¿Conoces a mi mamá?',
          'El perro se sacude… ¡y yo MÁS mojado!',
          'Gracias, perro. De verdad.',
        ],
        audioDurationMs: 10000,
      },
      {
        pageNum: 3,
        caption: 'La māo dramática del árbol',
        sentences: [
          'Una māo en el árbol. Wǒ digo: nǐ hǎo!',
          'La māo: wǒ rènshi a tu māma.',
          'Pero wǒ NO bajo. El agua… ¡no, gracias!',
          'Tā ài a su érzi. Pero seca, ¿ok?',
        ],
        sentencesEs: [
          'Una gata en el árbol. Yo digo: ¡hola!',
          'La gata: yo conozco a tu mamá.',
          'Pero yo NO bajo. El agua… ¡no, gracias!',
          'Ella ama a su hijo. Pero seca, ¿ok?',
        ],
        audioDurationMs: 11000,
      },
      {
        pageNum: 4,
        caption: 'Tres péngyou (uno seco, dos mojados)',
        sentences: [
          'Wǒmen somos péngyou ahora.',
          'La māo: wǒ encima del gǒu, seca como reina.',
          'El gǒu sufre. Wǒ me río. Jajaja.',
          'Péngyou raros, pero péngyou.',
        ],
        sentencesEs: [
          'Ahora somos amigos.',
          'La gata: yo encima del perro, seca como reina.',
          'El perro sufre. Yo me río. Jajaja.',
          'Amigos raros, pero amigos.',
        ],
        audioDurationMs: 11000,
      },
      {
        pageNum: 5,
        caption: 'Bàba, māma, y la sombrilla chiquita',
        sentences: [
          'Bàba! Māma! Wǒ regresé!',
          'Bàba: tienes 5 suì, érzi.',
          'Toma — tu sombrilla. (Es CHIQUITA.)',
          'Tu míngzi nuevo: "El Chico de la Sombrilla."',
        ],
        sentencesEs: [
          '¡Papá! ¡Mamá! ¡Regresé!',
          'Papá: tienes 5 años, hijo.',
          'Toma — tu sombrilla. (Es CHIQUITA.)',
          'Tu nombre nuevo: "El Chico de la Sombrilla."',
        ],
        audioDurationMs: 12000,
      },
      {
        pageNum: 6,
        caption: 'Mi jiā es mojada, pero es mía',
        sentences: [
          'Wǒ ài mi jiā. Mi jiā es mojada.',
          'Bàba, māma, gǒu, māo — todos péngyou.',
          'De wǒ, para siempre.',
          'Y la sombrilla… es chiquita. Pero es mía.',
        ],
        sentencesEs: [
          'Amo mi casa. Mi casa está mojada.',
          'Papá, mamá, perro, gata — todos amigos.',
          'Míos, para siempre.',
          'Y la sombrilla… es chiquita. Pero es mía.',
        ],
        audioDurationMs: 11000,
      },
    ],
  },
  // === STORY 3: add here when you have it.
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
  return {
    id,
    title: story.title,
    subtitle: story.subtitle,
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
        imageUrl: `/assets/reading/${id}/page-${page.pageNum}.png`,
        audioUrl: `/assets/reading/${id}/page-${page.pageNum}.mp3`,
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
