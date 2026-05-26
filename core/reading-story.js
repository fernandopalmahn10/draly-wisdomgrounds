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
  // === STORY 2: add here when you have it.
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
  }));
}

module.exports = {
  STORIES,
  DEFAULT_STORY_ID,
  buildStoryPayload,
  listStories,
  tokenizePage,
};
