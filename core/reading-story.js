// =========================================================================
// reading-story.js — the built-in Reading-mode story
//
// 7-page HSK1 narrative woven from the canonical 150-word list. Pinyin
// only (per teacher spec — no hanzi shown to students). Each "word" is
// a unit of pinyin that highlights together when its audio range hits.
//
// Per-page audio + image files are expected at:
//     public/assets/reading/page-1.mp3   (audio)
//     public/assets/reading/page-1.png   (illustration)
//     ...up to page-7
// The teacher uploads these files later. The story still works without
// them — the player just sees a placeholder where the image would be.
//
// Word timestamps (startMs / endMs) are AUTO-DISTRIBUTED evenly across
// the page's audioDurationMs based on word count. This gives a workable
// karaoke highlight out of the box. Later we can add per-word manual
// timing via a "tap to mark word boundaries" editor on the host page.
// =========================================================================
'use strict';

// Default per-page audio duration when the teacher hasn't uploaded audio
// yet. 8 seconds is a comfortable read-aloud pace for ~12 HSK1 words.
const DEFAULT_PAGE_AUDIO_MS = 8000;

// === The Story: Xiǎo Míng de yī tiān (Xiǎo Míng's Day) ===
// Each page has 1-3 sentences. Words split on space; punctuation is
// attached to the preceding word so it animates together.
const STORY = {
  title: 'Xiǎo Míng de yī tiān',
  subtitle: 'Un día con Xiǎo Míng · A day with Xiǎo Míng',
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
      // Spanish translation — same number of sentences in the same order
      // so the sentence-level highlight stays in sync (when sentence #2's
      // pinyin is being read, sentence #2's Spanish line is the one that
      // glows). NOT word-for-word; word order differs between languages.
      sentencesEs: [
        'Hoy es lunes.',
        'Me llamo Xiǎo Míng. Soy estudiante.',
        'En mi casa somos cuatro personas: papá, mamá, mi hermana y yo.',
        'Amo a mi familia.',
      ],
      // Auto-distribute timestamps for now; teacher can override later
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
};

// === Word-tokenization + timestamp distribution ===
// Splits each sentence on whitespace. Punctuation attaches to the
// previous word so it highlights as one unit. Then distributes
// startMs / endMs evenly across the page's audioDurationMs.
function tokenizePage(page) {
  // Flatten sentences → flat array of word-tokens. Track which
  // sentence each word belongs to so the renderer can group them.
  const tokens = [];
  page.sentences.forEach((sentence, sIdx) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    words.forEach((w) => {
      tokens.push({ pinyin: w, sentenceIdx: sIdx });
    });
  });
  // Distribute timestamps evenly
  const totalMs = page.audioDurationMs || DEFAULT_PAGE_AUDIO_MS;
  const perWord = totalMs / Math.max(1, tokens.length);
  tokens.forEach((tk, i) => {
    tk.startMs = Math.round(i * perWord);
    tk.endMs   = Math.round((i + 1) * perWord);
  });
  return tokens;
}

// Compute the start/end timing range of each SENTENCE on a page by
// scanning the tokenized words. Used for sentence-level highlighting
// in Spanish mode (where per-word karaoke can't map cross-language —
// Chinese and Spanish have different word orders).
function sentenceRanges(words) {
  const ranges = {};
  words.forEach((w) => {
    const sIdx = w.sentenceIdx;
    if (!ranges[sIdx]) ranges[sIdx] = { startMs: w.startMs, endMs: w.endMs };
    else {
      ranges[sIdx].startMs = Math.min(ranges[sIdx].startMs, w.startMs);
      ranges[sIdx].endMs   = Math.max(ranges[sIdx].endMs,   w.endMs);
    }
  });
  // Materialize as array indexed by sentence position
  const arr = [];
  Object.keys(ranges).sort((a, b) => +a - +b).forEach((k) => {
    arr.push({ sentenceIdx: +k, startMs: ranges[k].startMs, endMs: ranges[k].endMs });
  });
  return arr;
}

// Build the wire-ready story payload: every page has its tokenized words,
// caption, image path, audio path, total duration, AND a parallel Spanish
// sentences array. The client uses imageUrl + audioUrl directly via
// <img> / <audio>; if the file is missing the browser shows a graceful
// broken-image / no-audio state which the CSS dresses up with a placeholder.
function buildStoryPayload() {
  return {
    title: STORY.title,
    subtitle: STORY.subtitle,
    pages: STORY.pages.map((page) => {
      const words = tokenizePage(page);
      return {
        pageNum: page.pageNum,
        caption: page.caption,
        sentences: page.sentences,
        sentencesEs: page.sentencesEs || [],  // parallel Spanish array
        words,
        sentenceRanges: sentenceRanges(words),
        imageUrl: `/assets/reading/page-${page.pageNum}.png`,
        audioUrl: `/assets/reading/page-${page.pageNum}.mp3`,
        audioDurationMs: page.audioDurationMs || DEFAULT_PAGE_AUDIO_MS,
      };
    }),
  };
}

module.exports = {
  STORY,
  buildStoryPayload,
  tokenizePage,
};
