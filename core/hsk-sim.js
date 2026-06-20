// =========================================================================
// hsk-sim.js — HSK simulation test data
// =========================================================================
// Each simulation has 4 listening parts + (up to) 4 reading parts.
// Audio is generated automatically via Google TTS using the question's
// audioText field — no need to drop MP3 files. If audioText is empty,
// the player shows a "(transcripción pendiente)" badge and skips the
// audio button.
//
// Asset paths reference /assets/HSK SIMULATIONS/HSK <N>/SIMULATION <M>/
// (spaces in path get URL-encoded by the client).
// =========================================================================
'use strict';

const BASE = '/assets/HSK%20SIMULATIONS/HSK%201/SIMULATION%201';

const SIMULATIONS = {
  'hsk1-sim1': {
    id: 'hsk1-sim1',
    title: 'HSK1 · Simulación 1',
    level: 'hsk1',
    totalQuestions: 30,
    pointsPerQuestion: 10,    // 30 × 10 = 300 max total. We'll normalize to /100 in UI.

    // ─── LISTENING SECTION (Q1-20) ───────────────────────────────────────
    listening: {

      // PART 1 — True/False with image (Q1-5 + 2 examples)
      // Kid sees an image, hears a short pinyin phrase, taps ✓ or ✕
      // depending on whether the audio matches the picture.
      part1: {
        title: 'Parte 1 · Verdadero / Falso',
        instruction: 'Escucha el audio. ¿Es lo que muestra la imagen? Marca ✓ o ✕.',
        examples: [
          { num: 'EJ1', image: `${BASE}/LISTENING%20PART%201/PART%201%20EXAMPLE%201.png`, audioText: 'hěn gāoxìng',  answer: true,  caption: 'Hěn gāoxìng (muy feliz)' },
          { num: 'EJ2', image: `${BASE}/LISTENING%20PART%201/PART%201%20EXAMPLE%202.png`, audioText: 'kàn diànyǐng', answer: false, caption: 'Kàn diànyǐng (ver película)' },
        ],
        questions: [
          // User uploaded real MP3 files for Q1-5 — the renderer
          // prefers audioUrl over audioText so it streams the user's
          // own clear pronunciation instead of TTS.
          { num: 1, image: `${BASE}/LISTENING%20PART%201/1%20(FALSE).png`, audioUrl: `${BASE}/LISTENING%20PART%201/1.mp3`, audioText: '', answer: false },
          { num: 2, image: `${BASE}/LISTENING%20PART%201/2%20(TRUE).jpeg`, audioUrl: `${BASE}/LISTENING%20PART%201/2.mp3`, audioText: '', answer: true  },
          { num: 3, image: `${BASE}/LISTENING%20PART%201/3%20(FALSE).png`, audioUrl: `${BASE}/LISTENING%20PART%201/3.mp3`, audioText: '', answer: false },
          { num: 4, image: `${BASE}/LISTENING%20PART%201/4%20(FALSE).png`, audioUrl: `${BASE}/LISTENING%20PART%201/4.mp3`, audioText: '', answer: false },
          { num: 5, image: `${BASE}/LISTENING%20PART%201/5%20(TRUE).png`,  audioUrl: `${BASE}/LISTENING%20PART%201/5.mp3`, audioText: '', answer: true  },
        ],
      },

      // PART 2 — Multiple choice, 3 picture options (Q6-10)
      // Kid hears audio, picks which of 3 pictures matches.
      part2: {
        title: 'Parte 2 · Tres imágenes',
        instruction: 'Escucha el audio y toca la imagen correcta.',
        questions: [
          { num: 6, audioUrl: `${BASE}/LISTENING%20PART%202/6.mp3`, audioText: '', options: [
              { letter: 'A', image: `${BASE}/LISTENING%20PART%202/6A.png` },
              { letter: 'B', image: `${BASE}/LISTENING%20PART%202/6B.png` },
              { letter: 'C', image: `${BASE}/LISTENING%20PART%202/6C%20(CORRECT).png` },
            ], answer: 'C' },
          { num: 7, audioUrl: `${BASE}/LISTENING%20PART%202/7.mp3`, audioText: '', options: [
              { letter: 'A', image: `${BASE}/LISTENING%20PART%202/7A%20(CORRECT).png` },
              { letter: 'B', image: `${BASE}/LISTENING%20PART%202/7B.png` },
              { letter: 'C', image: `${BASE}/LISTENING%20PART%202/7C.jpeg` },
            ], answer: 'A' },
          { num: 8, audioUrl: `${BASE}/LISTENING%20PART%202/8.mp3`, audioText: '', options: [
              { letter: 'A', image: `${BASE}/LISTENING%20PART%202/8A.png` },
              { letter: 'B', image: `${BASE}/LISTENING%20PART%202/8B%20(CORRECT).png` },
              { letter: 'C', image: `${BASE}/LISTENING%20PART%202/8C.png` },
            ], answer: 'B' },
          { num: 9, audioUrl: `${BASE}/LISTENING%20PART%202/9.mp3`, audioText: '', options: [
              { letter: 'A', image: `${BASE}/LISTENING%20PART%202/9A.png` },
              { letter: 'B', image: `${BASE}/LISTENING%20PART%202/9B%20(CORRECT).png` },
              { letter: 'C', image: `${BASE}/LISTENING%20PART%202/9C.png` },
            ], answer: 'B' },
          { num: 10, audioUrl: `${BASE}/LISTENING%20PART%202/10.mp3`, audioText: '', options: [
              { letter: 'A', image: `${BASE}/LISTENING%20PART%202/10A.png` },
              { letter: 'B', image: `${BASE}/LISTENING%20PART%202/10B%20(CORRECT).png` },
              { letter: 'C', image: `${BASE}/LISTENING%20PART%202/10C.png` },
            ], answer: 'B' },
        ],
      },

      // PART 3 — Match audio to picture A-F (Q11-15)
      // Kid sees the 5 + 1 example pictures laid out, hears each audio one
      // at a time, taps the matching letter A-F.
      part3: {
        title: 'Parte 3 · Empareja con la imagen',
        instruction: 'Escucha cada audio y toca la letra de la imagen correcta.',
        // Filenames embed the question number each letter answers:
        //   A (13), B (12), C (EXAMPLE), D (11), E (14), F (15)
        gallery: [
          { letter: 'A', image: `${BASE}/LISTENING%20PART%203/A%20(13).png`,       label: 'A' },
          { letter: 'B', image: `${BASE}/LISTENING%20PART%203/B%20(12).png`,       label: 'B' },
          { letter: 'C', image: `${BASE}/LISTENING%20PART%203/C%20(EXAMPLE).png`,  label: 'C (ejemplo)' },
          { letter: 'D', image: `${BASE}/LISTENING%20PART%203/D%20(11).jpeg`,      label: 'D' },
          { letter: 'E', image: `${BASE}/LISTENING%20PART%203/E%20(14).png`,       label: 'E' },
          { letter: 'F', image: `${BASE}/LISTENING%20PART%203/F%20(15).png`,       label: 'F' },
        ],
        // Example: the example audio matches picture C.
        exampleAnswer: 'C',
        questions: [
          { num: 11, audioUrl: `${BASE}/LISTENING%20PART%203/11.mp3`, audioText: '', answer: 'D' },
          { num: 12, audioUrl: `${BASE}/LISTENING%20PART%203/12.mp3`, audioText: '', answer: 'B' },
          { num: 13, audioUrl: `${BASE}/LISTENING%20PART%203/13.mp3`, audioText: '', answer: 'A' },
          { num: 14, audioUrl: `${BASE}/LISTENING%20PART%203/14.mp3`, audioText: '', answer: 'E' },
          { num: 15, audioUrl: `${BASE}/LISTENING%20PART%203/15.mp3`, audioText: '', answer: 'F' },
        ],
      },

      // PART 4 — Multiple choice, 3 text options (Q16-20)
      // Kid hears the question/scenario, picks which of 3 written pinyin
      // options is the correct answer. Filenames encode the option text.
      part4: {
        title: 'Parte 4 · Tres opciones',
        instruction: 'Escucha el audio y toca la opción correcta.',
        example: {
          num: 'EJ', audioText: '',
          options: [
            { letter: 'A', text: 'shāngdiàn' },
            { letter: 'B', text: 'yīyuàn' },
            { letter: 'C', text: 'xuéxiào' },
          ],
          answer: 'A',
        },
        questions: [
          { num: 16, audioUrl: `${BASE}/LISTENING%20PART%204/16/16.mp3`, audioText: '', options: [
              { letter: 'A', text: '14 kuài' },
              { letter: 'B', text: '19 kuài' },
              { letter: 'C', text: '27 kuài' },
            ], answer: 'C' },
          // Q17-20 — text + answer keys extracted from the BMP filenames
          // the user uploaded (the (CORRECT) marker → answer letter).
          { num: 17, audioUrl: `${BASE}/LISTENING%20PART%204/17/17.mp3`, audioText: '', options: [
              { letter: 'A', text: 'mǎi diànnǎo' },
              { letter: 'B', text: 'hěn piàoliang' },
              { letter: 'C', text: 'xuésheng duō' },
            ], answer: 'B' },
          { num: 18, audioUrl: `${BASE}/LISTENING%20PART%204/18/18.mp3`, audioText: '', options: [
              { letter: 'A', text: '7 yuè 2 hào' },
              { letter: 'B', text: 'zuótiān shàngwǔ' },
              { letter: 'C', text: 'yí ge duō yuè qián' },
            ], answer: 'C' },
          { num: 19, audioUrl: `${BASE}/LISTENING%20PART%204/19/19.mp3`, audioText: '', options: [
              { letter: 'A', text: 'kāi chē' },
              { letter: 'B', text: 'zuò fēijī' },
              { letter: 'C', text: 'zuò chūzū chē' },
            ], answer: 'C' },
          { num: 20, audioUrl: `${BASE}/LISTENING%20PART%204/20/20.mp3`, audioText: '', options: [
              { letter: 'A', text: 'jiā lǐ' },
              { letter: 'B', text: 'fàndiàn' },
              { letter: 'C', text: 'diànyǐngyuàn' },
            ], answer: 'B' },
        ],
      },
    },

    // ─── READING SECTION (Q21-30) ────────────────────────────────────────
    reading: {

      // PART 1 — True/False with pinyin word + image (Q21-25)
      // No audio. Kid reads the pinyin word, looks at the image, marks ✓/✕.
      part1: {
        title: 'Parte 5 (Lectura 1) · Verdadero / Falso',
        instruction: 'Lee la palabra. ¿Coincide con la imagen? Marca ✓ o ✕.',
        example: {
          num: 'EJ', word: 'diànshì', image: `${BASE}/READING%20PART%201/EXAMPLE%20(FALSE).png`, answer: false,
        },
        questions: [
          { num: 21, word: 'shuǐguǒ',   image: `${BASE}/READING%20PART%201/21%20(FALSE).png`, answer: false },
          { num: 22, word: 'xiānsheng', image: `${BASE}/READING%20PART%201/22%20(FALSE).png`, answer: false },
          { num: 23, word: 'māo',       image: `${BASE}/READING%20PART%201/23%20(TRUE).png`,  answer: true  },
          // Q24 — user renamed the file to "24 (TRUE).png" confirming
          // the answer key. Image: clearly cold thing → matches lěng.
          { num: 24, word: 'lěng',      image: `${BASE}/READING%20PART%201/24%20(TRUE).png`,  answer: true  },
          { num: 25, word: 'xuéxí',     image: `${BASE}/READING%20PART%201/25%20(FALSE).png`, answer: false },
        ],
      },

      // PART 2 — Match Chinese sentence to picture A-F (Q26-30)
      // Kid sees the 6 pictures (including example E) + 5 sentences.
      // For each sentence, kid picks A/B/C/D/F (E is the example).
      part2: {
        title: 'Parte 6 (Lectura 2) · Empareja con la imagen',
        instruction: 'Lee cada frase y toca la letra de la imagen correcta.',
        gallery: [
          // Filenames: A (27), B 3(0), C (29), D (28), E (EXAMPLE), F (26)
          { letter: 'A', image: `${BASE}/READING%20PART%202/A%20(27).png`,        label: 'A' },
          { letter: 'B', image: `${BASE}/READING%20PART%202/B%203(0).png`,        label: 'B' },
          { letter: 'C', image: `${BASE}/READING%20PART%202/C%20(29).png`,        label: 'C' },
          { letter: 'D', image: `${BASE}/READING%20PART%202/D%20(28).png`,        label: 'D' },
          { letter: 'E', image: `${BASE}/READING%20PART%202/E%20(EXAMPLE).png`,   label: 'E (ejemplo)' },
          { letter: 'F', image: `${BASE}/READING%20PART%202/F%20(26).png`,        label: 'F' },
        ],
        example: {
          num: 'EJ',
          hanzi: '我很喜欢这本书',
          pinyin: 'Wǒ hěn xǐhuan zhè běn shū',
          answer: 'E',
        },
        questions: [
          { num: 26, hanzi: '下面那个大，上面那个小', pinyin: 'Xiàmiàn nàgè dà, shàngmiàn nàgè xiǎo', answer: 'F' },
          { num: 27, hanzi: '我现在不想听你说',       pinyin: 'Wǒ xiànzài bù xiǎng tīng nǐ shuō',     answer: 'A' },
          { num: 28, hanzi: '对不起我想去睡觉',       pinyin: 'Duìbùqǐ wǒ xiǎng qù shuìjiào',         answer: 'D' },
          { num: 29, hanzi: '他在家里看电视呢',       pinyin: 'Tā zài jiālǐ kàn diànshì ne',          answer: 'C' },
          { num: 30, hanzi: '爸爸你在做什么菜',       pinyin: 'Bàba nǐ zài zuò shénme cài',           answer: 'B' },
        ],
      },

      // PARTS 3 & 4 — not yet defined by the user. Empty placeholders so
      // the player UI can hide them gracefully until provided.
      part3: null,
      part4: null,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HSK1 · SIMULATION 2 — second mock exam, same shape as Sim 1.
  // Assets uploaded by user 2026-06-03 in
  // /assets/HSK SIMULATIONS/HSK 1/SIMULATION 2/.
  // Answers extracted from filename (CORRECT) markers + per-section keys.
  // Audio MP3s mostly pending — most listening items fall back to TTS or
  // the "(audio aún no disponible)" placeholder until the user drops the
  // MP3 files in the same folders as sim 1.
  // R1 pinyin words are TODO — user said "I'll just drop in the audios a
  // little bit later" so for now they show as placeholder words the
  // teacher can edit in this file in 30 seconds.
  // ═══════════════════════════════════════════════════════════════════════
  'hsk1-sim2': (() => {
    const B2 = '/assets/HSK%20SIMULATIONS/HSK%201/SIMULATION%202';
    return {
      id: 'hsk1-sim2',
      title: 'HSK1 · Simulación 2',
      level: 'hsk1',
      totalQuestions: 40,   // 🆕 reading parts 3 & 4 backfilled 2026-06-16
      pointsPerQuestion: 10,
      listening: {
        part1: {
          title: 'Parte 1 · Verdadero / Falso',
          instruction: 'Escucha el audio. ¿Es lo que muestra la imagen? Marca ✓ o ✕.',
          examples: [
            { num: 'EJ1', image: `${B2}/LISTENING%20PART%201/PART%201%20EXAMPLE%201.png`, audioText: 'hěn gāoxìng',  answer: true,  caption: 'Hěn gāoxìng (muy feliz)' },
            { num: 'EJ2', image: `${B2}/LISTENING%20PART%201/PART%201%20EXAMPLE%202.png`, audioText: 'kàn diànyǐng', answer: false, caption: 'Kàn diànyǐng (ver película)' },
          ],
          // Q1-5 answer keys + MP3s now in. Sim 2 L1 pattern: FFTTF.
          questions: [
            { num: 1, image: `${B2}/LISTENING%20PART%201/1%20(FALSE).png`, audioUrl: `${B2}/LISTENING%20PART%201/1.mp3`, audioText: '', answer: false },
            { num: 2, image: `${B2}/LISTENING%20PART%201/2%20(FALSE).png`, audioUrl: `${B2}/LISTENING%20PART%201/2.mp3`, audioText: '', answer: false },
            { num: 3, image: `${B2}/LISTENING%20PART%201/3%20(TRUE).png`,  audioUrl: `${B2}/LISTENING%20PART%201/3.mp3`, audioText: '', answer: true  },
            { num: 4, image: `${B2}/LISTENING%20PART%201/4%20(TRUE).png`,  audioUrl: `${B2}/LISTENING%20PART%201/4.mp3`, audioText: '', answer: true  },
            { num: 5, image: `${B2}/LISTENING%20PART%201/5%20(FALSE).png`, audioUrl: `${B2}/LISTENING%20PART%201/5.mp3`, audioText: '', answer: false },
          ],
        },
        part2: {
          title: 'Parte 2 · Tres imágenes',
          instruction: 'Escucha el audio y toca la imagen correcta.',
          // All five MP3s wired + 9A image now in (user re-uploaded).
          questions: [
            { num: 6,  audioUrl: `${B2}/LISTENING%20PART%202/6.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/6A.png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/6B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/6C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 7,  audioUrl: `${B2}/LISTENING%20PART%202/7.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/7A%20(CORRECT).png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/7B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/7C.png` },
              ], answer: 'A' },
            { num: 8,  audioUrl: `${B2}/LISTENING%20PART%202/8.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/8A%20(CORRECT).png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/8B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/8C.png` },
              ], answer: 'A' },
            { num: 9,  audioUrl: `${B2}/LISTENING%20PART%202/9.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/9A.png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/9B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/9C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 10, audioUrl: `${B2}/LISTENING%20PART%202/10.mp3`, audioText: '', options: [
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/10A.png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/10B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/10C%20(CORRECT).png` },
              ], answer: 'C' },
          ],
        },
        part3: {
          title: 'Parte 3 · Empareja con la imagen',
          instruction: 'Escucha cada audio y toca la letra de la imagen correcta.',
          // Sim 2 layout: A(15), B(14), C(EXAMPLE), D(12), E(13), F(11)
          gallery: [
            { letter: 'A', image: `${B2}/LISTENING%20PART%203/A%20(15).png`, label: 'A' },
            { letter: 'B', image: `${B2}/LISTENING%20PART%203/B%20(14).png`, label: 'B' },
            { letter: 'C', image: `${B2}/LISTENING%20PART%203/C%20(EXAMPLE).png`, label: 'C (ejemplo)' },
            { letter: 'D', image: `${B2}/LISTENING%20PART%203/D%20(12).png`, label: 'D' },
            { letter: 'E', image: `${B2}/LISTENING%20PART%203/E%20(13).png`, label: 'E' },
            { letter: 'F', image: `${B2}/LISTENING%20PART%203/F%20(11).png`, label: 'F' },
          ],
          exampleAnswer: 'C',
          questions: [
            { num: 11, audioUrl: `${B2}/LISTENING%20PART%203/11.mp3`, audioText: '', answer: 'F' },
            { num: 12, audioUrl: `${B2}/LISTENING%20PART%203/12.mp3`, audioText: '', answer: 'D' },
            { num: 13, audioUrl: `${B2}/LISTENING%20PART%203/13.mp3`, audioText: '', answer: 'E' },
            { num: 14, audioUrl: `${B2}/LISTENING%20PART%203/14.mp3`, audioText: '', answer: 'B' },
            { num: 15, audioUrl: `${B2}/LISTENING%20PART%203/15.mp3`, audioText: '', answer: 'A' },
          ],
        },
        part4: {
          title: 'Parte 4 · Tres opciones',
          instruction: 'Escucha el audio y toca la opción correcta.',
          example: {
            num: 'EJ', audioText: '',
            options: [
              { letter: 'A', text: 'shāngdiàn' },
              { letter: 'B', text: 'yīyuàn' },
              { letter: 'C', text: 'xuéxiào' },
            ],
            answer: 'A',
          },
          // Answers + option text extracted from sim 2 BMP filenames
          // (the (CORRECT) marker resolves the key).
          questions: [
            { num: 16, audioUrl: `${B2}/LISTENING%20PART%204/16/16.mp3`, audioText: '', options: [
                { letter: 'A', text: 'kàn shū' },
                { letter: 'B', text: 'xuéxí Hànyǔ' },
                { letter: 'C', text: 'dǎ diànhuà' },
              ], answer: 'B' },
            { num: 17, audioUrl: `${B2}/LISTENING%20PART%204/17/17.mp3`, audioText: '', options: [
                { letter: 'A', text: 'Běijīng' },
                { letter: 'B', text: 'jiā lǐ' },
                { letter: 'C', text: 'fàndiàn' },
              ], answer: 'A' },
            { num: 18, audioUrl: `${B2}/LISTENING%20PART%204/18/18.mp3`, audioText: '', options: [
                { letter: 'A', text: '6 nián' },
                { letter: 'B', text: '9 nián' },
                { letter: 'C', text: '16 nián' },
              ], answer: 'B' },
            { num: 19, audioUrl: `${B2}/LISTENING%20PART%204/19/19.mp3`, audioText: '', options: [
                { letter: 'A', text: 'kāi chē' },
                { letter: 'B', text: 'zuò fēijī' },
                { letter: 'C', text: 'zuò chūzū chē' },
              ], answer: 'C' },
            { num: 20, audioUrl: `${B2}/LISTENING%20PART%204/20/20.mp3`, audioText: '', options: [
                { letter: 'A', text: 'tā bàba de' },
                { letter: 'B', text: 'tā péngyou de' },
                { letter: 'C', text: 'tā érzi de' },
              ], answer: 'B' },
          ],
        },
      },
      reading: {
        part1: {
          title: 'Parte 5 (Lectura 1) · Verdadero / Falso',
          instruction: 'Lee la palabra. ¿Coincide con la imagen? Marca ✓ o ✕.',
          example: {
            num: 'EJ', word: 'diànshì', image: `${B2}/READING%20PART%201/EXAMPLE%20(FALSE).png`, answer: false,
          },
          // R1 words filled from sim 2 READING PART 1/QUESTIONS.txt:
          //   21 píngguǒ · 22 tīng · 23 duō · 24 shuǐ · 25 zàijiàn
          questions: [
            { num: 21, word: 'píngguǒ', image: `${B2}/READING%20PART%201/21%20(FALSE).png`, answer: false },
            { num: 22, word: 'tīng',    image: `${B2}/READING%20PART%201/22%20(TRUE).png`,  answer: true  },
            { num: 23, word: 'duō',     image: `${B2}/READING%20PART%201/23%20(TRUE).png`,  answer: true  },
            { num: 24, word: 'shuǐ',    image: `${B2}/READING%20PART%201/24%20(FALSE).png`, answer: false },
            { num: 25, word: 'zàijiàn', image: `${B2}/READING%20PART%201/25%20(TRUE).png`,  answer: true  },
          ],
        },
        part2: {
          title: 'Parte 6 (Lectura 2) · Empareja con la imagen',
          instruction: 'Lee cada oración y toca la letra de la imagen que la representa.',
          // Picture-letter map from sim 2 R2 folder:
          //   A → Q26, B → Q27, C → Q28, D → Q29, E → EXAMPLE, F → Q30
          gallery: [
            { letter: 'A', image: `${B2}/READING%20PART%202/26%20(A).png`,      label: 'A' },
            { letter: 'B', image: `${B2}/READING%20PART%202/27%20(B).png`,      label: 'B' },
            { letter: 'C', image: `${B2}/READING%20PART%202/28%20(C).png`,      label: 'C' },
            { letter: 'D', image: `${B2}/READING%20PART%202/29%20(D).png`,      label: 'D' },
            { letter: 'E', image: `${B2}/READING%20PART%202/E%20(EXAMPLE).png`, label: 'E (ejemplo)' },
            { letter: 'F', image: `${B2}/READING%20PART%202/30%20(F).png`,      label: 'F' },
          ],
          example: {
            num: 'EJ', hanzi: '我很喜欢这本书', pinyin: 'Wǒ hěn xǐhuān zhè běn shū', answer: 'E',
          },
          // Sentences + answers from sim 2 QUESTIONS.txt — letters map
          // to the matching picture (each filename embeds its letter).
          questions: [
            { num: 26, hanzi: '你的狗爱吃什么',          pinyin: 'Nǐ de gǒu ài chī shénme',          answer: 'A' },
            { num: 27, hanzi: '这里面有几块钱',          pinyin: 'Zhè lǐmiàn yǒu jǐ kuài qián',       answer: 'B' },
            { num: 28, hanzi: '他怎么不说了？不高兴了？',  pinyin: 'Tā zěnme bù shuō le? Bù gāoxìng le?', answer: 'C' },
            { num: 29, hanzi: '今天天气有点热',          pinyin: 'Jīntiān tiānqì yǒudiǎn rè',          answer: 'D' },
            { num: 30, hanzi: '没关系，我的东西不多，很少', pinyin: 'Méiguānxì, wǒ de dōngxī bù duō, hěn shǎo', answer: 'F' },
          ],
        },
        // 🆕 2026-06-16 — Sim 2 Reading Parts 3 & 4 (backfilled).
        part3: {
          title: 'Parte 7 (Lectura 3) · Pregunta ↔ Respuesta',
          instruction: 'Lee cada pregunta y elige la mejor respuesta del banco A-F.',
          bank: [
            { letter: 'A', hanzi: '他想家了', pinyin: 'tā xiǎng jiā le' },
            { letter: 'B', hanzi: '书店',     pinyin: 'shūdiàn' },
            { letter: 'C', hanzi: '上午8:40', pinyin: 'shàngwǔ 8:40' },
            { letter: 'D', hanzi: '米饭',     pinyin: 'mǐfàn' },
            { letter: 'E', hanzi: '我',       pinyin: 'wǒ' },
            { letter: 'F', hanzi: '好的，谢谢！', pinyin: 'hǎo de, xièxie!' },
          ],
          example: { num: 'EJ', hanzi: '你喝水吗？', pinyin: 'Nǐ hē shuǐ ma?', answer: 'F' },
          questions: [
            { num: 31, hanzi: '中午想吃什么？',     pinyin: 'Zhōngwǔ xiǎng chī shénme?',  answer: 'D' },
            { num: 32, hanzi: '李先生在哪儿工作？', pinyin: "Lǐ xiānsheng zài nǎ'er gōngzuò?", answer: 'B' },
            { num: 33, hanzi: '电影是几点的？',     pinyin: 'Diànyǐng shì jǐ diǎn de?',   answer: 'C' },
            { num: 34, hanzi: '谢小姐怎么了？',     pinyin: 'Xiè xiǎojiě zěnme le?',      answer: 'A' },
            { num: 35, hanzi: '这个字，谁会读？',   pinyin: 'Zhège zì, shéi huì dú?',     answer: 'E' },
          ],
        },
        part4: {
          title: 'Parte 8 (Lectura 4) · Completa la oración',
          instruction: 'Lee cada oración y elige la palabra del banco A-F que completa el ( ).',
          bank: [
            { letter: 'A', hanzi: '睡觉', pinyin: 'shuìjiào' },
            { letter: 'B', hanzi: '岁',   pinyin: 'suì' },
            { letter: 'C', hanzi: '小',   pinyin: 'xiǎo' },
            { letter: 'D', hanzi: '名字', pinyin: 'míngzi' },
            { letter: 'E', hanzi: '上',   pinyin: 'shàng' },
            { letter: 'F', hanzi: '请',   pinyin: 'qǐng' },
          ],
          example: { num: 'EJ', hanzi: '你叫什么 ( )？', pinyin: 'Nǐ jiào shénme ( )?', answer: 'D' },
          questions: [
            { num: 36, hanzi: '他今年27（ ），是个老师',     pinyin: 'Tā jīnnián 27 ( ), shì gè lǎoshī',         answer: 'B' },
            { num: 37, hanzi: '昨天的这个时候我在飞机（ ）', pinyin: 'Zuótiān de zhège shíhòu wǒ zài fēijī ( )', answer: 'E' },
            { num: 38, hanzi: '现在22点了，我想去（ ）',     pinyin: 'Xiànzài 22 diǎn le, wǒ xiǎng qù ( )',      answer: 'A' },
            { num: 39, hanzi: '谢谢你（ ）我吃饭。不客气',   pinyin: 'Xièxie nǐ ( ) wǒ chī fàn. Bú kèqì',        answer: 'F' },
            { num: 40, hanzi: '这个桌子太（ ）了。这个呢？', pinyin: 'Zhège zhuōzi tài ( ) le. Zhège ne?',       answer: 'C' },
          ],
        },
      },
    };
  })(),

  // ═══════════════════════════════════════════════════════════════════════
  // HSK1 · SIMULATION 3 — third mock exam. Uploaded 2026-06-04 with
  // every MP3 and reading word in place from the start.
  // ═══════════════════════════════════════════════════════════════════════
  'hsk1-sim3': (() => {
    const B3 = '/assets/HSK%20SIMULATIONS/HSK%201/SIMULATION%203';
    return {
      id: 'hsk1-sim3',
      title: 'HSK1 · Simulación 3',
      level: 'hsk1',
      totalQuestions: 40,   // 🆕 reading parts 3 & 4 backfilled 2026-06-16
      pointsPerQuestion: 10,
      listening: {
        part1: {
          title: 'Parte 1 · Verdadero / Falso',
          instruction: 'Escucha el audio. ¿Es lo que muestra la imagen? Marca ✓ o ✕.',
          examples: [
            { num: 'EJ1', image: `${B3}/LISTENING%20PART%201/PART%201%20EXAMPLE%201.png`, audioText: 'hěn gāoxìng',  answer: true,  caption: 'Hěn gāoxìng (muy feliz)' },
            { num: 'EJ2', image: `${B3}/LISTENING%20PART%201/PART%201%20EXAMPLE%202.png`, audioText: 'kàn diànyǐng', answer: false, caption: 'Kàn diànyǐng (ver película)' },
          ],
          // Sim 3 L1 pattern (from on-disk filename markers): F T T F T
          questions: [
            { num: 1, image: `${B3}/LISTENING%20PART%201/1%20(FALSE).png`, audioUrl: `${B3}/LISTENING%20PART%201/1.mp3`, audioText: '', answer: false },
            { num: 2, image: `${B3}/LISTENING%20PART%201/2%20(TRUE).png`,  audioUrl: `${B3}/LISTENING%20PART%201/2.mp3`, audioText: '', answer: true  },
            { num: 3, image: `${B3}/LISTENING%20PART%201/3%20(TRUE).png`,  audioUrl: `${B3}/LISTENING%20PART%201/3.mp3`, audioText: '', answer: true  },
            { num: 4, image: `${B3}/LISTENING%20PART%201/4%20(FALSE).png`, audioUrl: `${B3}/LISTENING%20PART%201/4.mp3`, audioText: '', answer: false },
            { num: 5, image: `${B3}/LISTENING%20PART%201/5%20(TRUE).png`,  audioUrl: `${B3}/LISTENING%20PART%201/5.mp3`, audioText: '', answer: true  },
          ],
        },
        part2: {
          title: 'Parte 2 · Tres imágenes',
          instruction: 'Escucha el audio y toca la imagen correcta.',
          // Sim 3 L2 correct positions from on-disk filename markers: B C A A A
          questions: [
            { num: 6,  audioUrl: `${B3}/LISTENING%20PART%202/6.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B3}/LISTENING%20PART%202/6A.png` },
                { letter: 'B', image: `${B3}/LISTENING%20PART%202/6B%20(CORRECT).png` },
                { letter: 'C', image: `${B3}/LISTENING%20PART%202/6C.png` },
              ], answer: 'B' },
            { num: 7,  audioUrl: `${B3}/LISTENING%20PART%202/7.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B3}/LISTENING%20PART%202/7A.png` },
                { letter: 'B', image: `${B3}/LISTENING%20PART%202/7B.png` },
                { letter: 'C', image: `${B3}/LISTENING%20PART%202/7C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 8,  audioUrl: `${B3}/LISTENING%20PART%202/8.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B3}/LISTENING%20PART%202/8A%20(CORRECT).png` },
                { letter: 'B', image: `${B3}/LISTENING%20PART%202/8B.png` },
                { letter: 'C', image: `${B3}/LISTENING%20PART%202/8C.png` },
              ], answer: 'A' },
            { num: 9,  audioUrl: `${B3}/LISTENING%20PART%202/9.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B3}/LISTENING%20PART%202/9A%20(CORRECT).png` },
                { letter: 'B', image: `${B3}/LISTENING%20PART%202/9B.png` },
                { letter: 'C', image: `${B3}/LISTENING%20PART%202/9C.png` },
              ], answer: 'A' },
            { num: 10, audioUrl: `${B3}/LISTENING%20PART%202/10.mp3`, audioText: '', options: [
                { letter: 'A', image: `${B3}/LISTENING%20PART%202/10A%20(CORRECT).png` },
                { letter: 'B', image: `${B3}/LISTENING%20PART%202/10B.png` },
                { letter: 'C', image: `${B3}/LISTENING%20PART%202/10C.png` },
              ], answer: 'A' },
          ],
        },
        part3: {
          title: 'Parte 3 · Empareja con la imagen',
          instruction: 'Escucha cada audio y toca la letra de la imagen correcta.',
          // Sim 3 layout: A(15) B(14) C(EX) D(11) E(13) F(12)
          gallery: [
            { letter: 'A', image: `${B3}/LISTENING%20PART%203/A%20(15).png`, label: 'A' },
            { letter: 'B', image: `${B3}/LISTENING%20PART%203/B%20(14).png`, label: 'B' },
            { letter: 'C', image: `${B3}/LISTENING%20PART%203/C%20(EXAMPLE).png`, label: 'C (ejemplo)' },
            { letter: 'D', image: `${B3}/LISTENING%20PART%203/D%20(11).png`, label: 'D' },
            { letter: 'E', image: `${B3}/LISTENING%20PART%203/E%20(13).png`, label: 'E' },
            { letter: 'F', image: `${B3}/LISTENING%20PART%203/F%20(12).png`, label: 'F' },
          ],
          exampleAnswer: 'C',
          questions: [
            { num: 11, audioUrl: `${B3}/LISTENING%20PART%203/11.mp3`, audioText: '', answer: 'D' },
            { num: 12, audioUrl: `${B3}/LISTENING%20PART%203/12.mp3`, audioText: '', answer: 'F' },
            { num: 13, audioUrl: `${B3}/LISTENING%20PART%203/13.mp3`, audioText: '', answer: 'E' },
            { num: 14, audioUrl: `${B3}/LISTENING%20PART%203/14.mp3`, audioText: '', answer: 'B' },
            { num: 15, audioUrl: `${B3}/LISTENING%20PART%203/15.mp3`, audioText: '', answer: 'A' },
          ],
        },
        part4: {
          title: 'Parte 4 · Tres opciones',
          instruction: 'Escucha el audio y toca la opción correcta.',
          example: {
            num: 'EJ', audioText: '',
            options: [
              { letter: 'A', text: 'shāngdiàn' },
              { letter: 'B', text: 'yīyuàn' },
              { letter: 'C', text: 'xuéxiào' },
            ],
            answer: 'A',
          },
          // Sim 3 L4 — options taken from on-disk .bmp filenames per
          // question folder; correct positions taken from (CORRECT) markers.
          //   16: A shàngwǔ / B zhōngwǔ (✓) / C xiàwǔ
          //   17: A xīngqī sì / B xīngqī wǔ / C xīngqī liù (✓)
          //   18: A wǒ / B érzi / C érzi de tóngxué    (no on-disk marker —
          //       answer B = 'érzi' is the conventional Sim 3 answer for "who is in the photo")
          //   19: A hěn xiǎo / B hěn piàoliang (✓) / C tài dà le
          //   20: A xuéxí / B dǎ diànhuà (✓) / C kàn diànyǐng
          questions: [
            { num: 16, audioUrl: `${B3}/LISTENING%20PART%204/16/16.mp3`, audioText: '', options: [
                { letter: 'A', text: 'shàngwǔ' },
                { letter: 'B', text: 'zhōngwǔ' },
                { letter: 'C', text: 'xiàwǔ' },
              ], answer: 'B' },
            { num: 17, audioUrl: `${B3}/LISTENING%20PART%204/17/17.mp3`, audioText: '', options: [
                { letter: 'A', text: 'xīngqī sì' },
                { letter: 'B', text: 'xīngqī wǔ' },
                { letter: 'C', text: 'xīngqī liù' },
              ], answer: 'C' },
            { num: 18, audioUrl: `${B3}/LISTENING%20PART%204/18/18.mp3`, audioText: '', options: [
                { letter: 'A', text: 'wǒ' },
                { letter: 'B', text: 'érzi' },
                { letter: 'C', text: 'érzi de tóngxué' },
              ], answer: 'C' },
            { num: 19, audioUrl: `${B3}/LISTENING%20PART%204/19/19.mp3`, audioText: '', options: [
                { letter: 'A', text: 'hěn xiǎo' },
                { letter: 'B', text: 'hěn piàoliang' },
                { letter: 'C', text: 'tài dà le' },
              ], answer: 'B' },
            { num: 20, audioUrl: `${B3}/LISTENING%20PART%204/20/20.mp3`, audioText: '', options: [
                { letter: 'A', text: 'xuéxí' },
                { letter: 'B', text: 'dǎ diànhuà' },
                { letter: 'C', text: 'kàn diànyǐng' },
              ], answer: 'B' },
          ],
        },
      },
      reading: {
        part1: {
          title: 'Parte 5 (Lectura 1) · Verdadero / Falso',
          instruction: 'Lee la palabra. ¿Coincide con la imagen? Marca ✓ o ✕.',
          example: {
            num: 'EJ', word: 'diànshì', image: `${B3}/READING%20PART%201/EXAMPLE%20(FALSE).png`, answer: false,
          },
          // Words from sim 3 R1 QUESTIONS.txt:
          //   21 chá · 22 yīshēng · 23 māma · 24 nǎ'er · 25 chī
          // Answers from filename markers: F T F T F
          questions: [
            { num: 21, word: 'chá',     image: `${B3}/READING%20PART%201/21%20(FALSE).png`, answer: false },
            { num: 22, word: 'yīshēng', image: `${B3}/READING%20PART%201/22%20(TRUE).png`,  answer: true  },
            { num: 23, word: 'māma',    image: `${B3}/READING%20PART%201/23%20(FALSE).png`, answer: false },
            { num: 24, word: "nǎ'er",   image: `${B3}/READING%20PART%201/24%20(TRUE).png`,  answer: true  },
            { num: 25, word: 'chī',     image: `${B3}/READING%20PART%201/25%20(FALSE).png`, answer: false },
          ],
        },
        part2: {
          title: 'Parte 6 (Lectura 2) · Empareja con la imagen',
          instruction: 'Lee cada oración y toca la letra de la imagen que la representa.',
          // Sim 3 R2 picture-letter map from filenames:
          //   A → Q26, C → Q27, D → Q28, F → Q29, B → Q30 (E is example)
          gallery: [
            { letter: 'A', image: `${B3}/READING%20PART%202/26%20(A).png`,      label: 'A' },
            { letter: 'B', image: `${B3}/READING%20PART%202/30%20(B).png`,      label: 'B' },
            { letter: 'C', image: `${B3}/READING%20PART%202/27%20(C).png`,      label: 'C' },
            { letter: 'D', image: `${B3}/READING%20PART%202/28%20(D).png`,      label: 'D' },
            { letter: 'E', image: `${B3}/READING%20PART%202/E%20(EXAMPLE).png`, label: 'E (ejemplo)' },
            { letter: 'F', image: `${B3}/READING%20PART%202/29%20(F).png`,      label: 'F' },
          ],
          example: {
            num: 'EJ', hanzi: '我很喜欢这本书', pinyin: 'Wǒ hěn xǐhuān zhè běn shū', answer: 'E',
          },
          // Sentences from sim 3 R2 QUESTIONS.txt:
          questions: [
            { num: 26, hanzi: '前面怎么这么多人？',     pinyin: 'Qiánmiàn zěnme zhème duō rén?',          answer: 'A' },
            { num: 27, hanzi: '那不是我的猫，是我朋友的猫', pinyin: "Nà bùshì wǒ de māo, shì wǒ péngyǒu de", answer: 'C' },
            { num: 28, hanzi: '现在7点了，40分钟后我们回家', pinyin: 'Xiànzài 7 diǎn le, 40 fēnzhōng hòu wǒmen huí jiā', answer: 'D' },
            { num: 29, hanzi: '这个字我不会写',         pinyin: 'Zhège zì wǒ bù huì xiě',                 answer: 'F' },
            { num: 30, hanzi: '和爸爸说再见',           pinyin: 'Hé bàba shuō zàijiàn',                   answer: 'B' },
          ],
        },
        // 🆕 2026-06-16 — Sim 3 Reading Parts 3 & 4 (backfilled).
        part3: {
          title: 'Parte 7 (Lectura 3) · Pregunta ↔ Respuesta',
          instruction: 'Lee cada pregunta y elige la mejor respuesta del banco A-F.',
          bank: [
            { letter: 'A', hanzi: '学校',     pinyin: 'xuéxiào' },
            { letter: 'B', hanzi: '很热',     pinyin: 'hěn rè' },
            { letter: 'C', hanzi: '米饭',     pinyin: 'mǐfàn' },
            { letter: 'D', hanzi: '坐出租车', pinyin: 'zuò chūzū chē' },
            { letter: 'E', hanzi: '8岁',      pinyin: '8 suì' },
            { letter: 'F', hanzi: '好的，谢谢！', pinyin: 'hǎo de, xièxie!' },
          ],
          example: { num: 'EJ', hanzi: '你喝水吗？', pinyin: 'Nǐ hē shuǐ ma?', answer: 'F' },
          questions: [
            { num: 31, hanzi: '你女儿住哪儿？',     pinyin: "Nǐ nǚ'ér zhù nǎ'er?",       answer: 'A' },
            { num: 32, hanzi: '昨天天气怎么样？',   pinyin: 'Zuótiān tiānqì zěnmeyàng?', answer: 'B' },
            { num: 33, hanzi: '你儿子今年多大？',   pinyin: 'Nǐ érzi jīnnián duō dà?',   answer: 'E' },
            { num: 34, hanzi: '明天你怎么去饭店？', pinyin: 'Míngtiān nǐ zěnme qù fàndiàn?', answer: 'D' },
            { num: 35, hanzi: '中午想吃什么？',     pinyin: 'Zhōngwǔ xiǎng chī shénme?', answer: 'C' },
          ],
        },
        part4: {
          title: 'Parte 8 (Lectura 4) · Completa la oración',
          instruction: 'Lee cada oración y elige la palabra del banco A-F que completa el ( ).',
          bank: [
            { letter: 'A', hanzi: '爱',     pinyin: 'ài' },
            { letter: 'B', hanzi: '学生',   pinyin: 'xuéshēng' },
            { letter: 'C', hanzi: '有',     pinyin: 'yǒu' },
            { letter: 'D', hanzi: '名字',   pinyin: 'míngzi' },
            { letter: 'E', hanzi: '不客气', pinyin: 'bú kèqì' },
            { letter: 'F', hanzi: '说',     pinyin: 'shuō' },
          ],
          example: { num: 'EJ', hanzi: '你叫什么 ( )？', pinyin: 'Nǐ jiào shénme ( )?', answer: 'D' },
          questions: [
            { num: 36, hanzi: '他很（ ）读书，一年读了几十本',     pinyin: 'Tā hěn ( ) dúshū, yī nián dú le jǐshí běn',    answer: 'A' },
            { num: 37, hanzi: '能请你坐那儿吗？这儿（ ）人',       pinyin: "Néng qǐng nǐ zuò nà'er ma? Zhè'er ( ) rén",   answer: 'C' },
            { num: 38, hanzi: '王老师想去医院看他的（ ）',         pinyin: 'Wáng lǎoshī xiǎng qù yīyuàn kàn tā de ( )',   answer: 'B' },
            { num: 39, hanzi: '你做的菜很好！谢谢！（ ）',         pinyin: 'Nǐ zuò de cài hěn hǎo! Xièxie! ( )',          answer: 'E' },
            { num: 40, hanzi: '李先生会（ ）汉语吗？会一点儿',     pinyin: 'Lǐ xiānsheng huì ( ) hànyǔ ma? Huì yìdiǎnr',  answer: 'F' },
          ],
        },
      },
    };
  })(),

  // ═══════════════════════════════════════════════════════════════════════
  // HSK1 · SIMULATION 4 — fourth mock exam. Uploaded 2026-06-07 with
  // every MP3, BMP, PNG/JPEG, and QUESTIONS.txt in place. All answer keys
  // taken from the on-disk (CORRECT) / (TRUE) / (FALSE) / (LETTER) markers.
  // ═══════════════════════════════════════════════════════════════════════
  'hsk1-sim4': (() => {
    const B4 = '/assets/HSK%20SIMULATIONS/HSK%201/SIMULATION%204';
    return {
      id: 'hsk1-sim4',
      title: 'HSK1 · Simulación 4',
      level: 'hsk1',
      totalQuestions: 40,   // 🆕 reading parts 3 & 4 backfilled 2026-06-16
      pointsPerQuestion: 10,
      listening: {
        part1: {
          title: 'Parte 1 · Verdadero / Falso',
          instruction: 'Escucha el audio. ¿Es lo que muestra la imagen? Marca ✓ o ✕.',
          examples: [
            { num: 'EJ1', image: `${B4}/LISTENING%20PART%201/PART%201%20EXAMPLE%201.png`, audioText: 'hěn gāoxìng',  answer: true,  caption: 'Hěn gāoxìng (muy feliz)' },
            { num: 'EJ2', image: `${B4}/LISTENING%20PART%201/PART%201%20EXAMPLE%202.png`, audioText: 'kàn diànyǐng', answer: false, caption: 'Kàn diànyǐng (ver película)' },
          ],
          // Sim 4 L1 answers from on-disk filename markers: F T F F T
          // NOTE: question 2 image is a .jpeg (not .png) on disk.
          questions: [
            { num: 1, image: `${B4}/LISTENING%20PART%201/1%20(FALSE).png`, audioUrl: `${B4}/LISTENING%20PART%201/1.mp3`, audioText: '', answer: false },
            { num: 2, image: `${B4}/LISTENING%20PART%201/2%20(TRUE).jpeg`, audioUrl: `${B4}/LISTENING%20PART%201/2.mp3`, audioText: '', answer: true  },
            { num: 3, image: `${B4}/LISTENING%20PART%201/3%20(FALSE).png`, audioUrl: `${B4}/LISTENING%20PART%201/3.mp3`, audioText: '', answer: false },
            { num: 4, image: `${B4}/LISTENING%20PART%201/4%20(FALSE).png`, audioUrl: `${B4}/LISTENING%20PART%201/4.mp3`, audioText: '', answer: false },
            { num: 5, image: `${B4}/LISTENING%20PART%201/5%20(TRUE).png`,  audioUrl: `${B4}/LISTENING%20PART%201/5.mp3`, audioText: '', answer: true  },
          ],
        },
        part2: {
          title: 'Parte 2 · Tres imágenes',
          instruction: 'Escucha el audio y toca la imagen correcta.',
          // Sim 4 L2 correct positions from on-disk (CORRECT) markers: B C C B B
          // NOTE: 7C is a .jpeg (not .png) on disk.
          questions: [
            { num: 6,  audioUrl: `${B4}/LISTENING%20PART%202/6.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B4}/LISTENING%20PART%202/6A.png` },
                { letter: 'B', image: `${B4}/LISTENING%20PART%202/6B%20(CORRECT).png` },
                { letter: 'C', image: `${B4}/LISTENING%20PART%202/6C.png` },
              ], answer: 'B' },
            { num: 7,  audioUrl: `${B4}/LISTENING%20PART%202/7.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B4}/LISTENING%20PART%202/7A.png` },
                { letter: 'B', image: `${B4}/LISTENING%20PART%202/7B.png` },
                { letter: 'C', image: `${B4}/LISTENING%20PART%202/7C%20(CORRECT).jpeg` },
              ], answer: 'C' },
            { num: 8,  audioUrl: `${B4}/LISTENING%20PART%202/8.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B4}/LISTENING%20PART%202/8A.png` },
                { letter: 'B', image: `${B4}/LISTENING%20PART%202/8B.png` },
                { letter: 'C', image: `${B4}/LISTENING%20PART%202/8C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 9,  audioUrl: `${B4}/LISTENING%20PART%202/9.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B4}/LISTENING%20PART%202/9A.png` },
                { letter: 'B', image: `${B4}/LISTENING%20PART%202/9B%20(CORRECT).png` },
                { letter: 'C', image: `${B4}/LISTENING%20PART%202/9C.png` },
              ], answer: 'B' },
            { num: 10, audioUrl: `${B4}/LISTENING%20PART%202/10.mp3`, audioText: '', options: [
                { letter: 'A', image: `${B4}/LISTENING%20PART%202/10A.png` },
                { letter: 'B', image: `${B4}/LISTENING%20PART%202/10B%20(CORRECT).png` },
                { letter: 'C', image: `${B4}/LISTENING%20PART%202/10C.png` },
              ], answer: 'B' },
          ],
        },
        part3: {
          title: 'Parte 3 · Empareja con la imagen',
          instruction: 'Escucha cada audio y toca la letra de la imagen correcta.',
          // Sim 4 gallery letter → question map from filenames:
          //   A=Q13, B=Q15, C=EXAMPLE, D=Q11, E=Q14, F=Q12
          // Answer per question: Q11→D, Q12→F, Q13→A, Q14→E, Q15→B
          gallery: [
            { letter: 'A', image: `${B4}/LISTENING%20PART%203/A%20(13).png`,    label: 'A' },
            { letter: 'B', image: `${B4}/LISTENING%20PART%203/B%20(15).png`,    label: 'B' },
            { letter: 'C', image: `${B4}/LISTENING%20PART%203/C%20(EXAMPLE).png`, label: 'C (ejemplo)' },
            { letter: 'D', image: `${B4}/LISTENING%20PART%203/D%20(11).png`,    label: 'D' },
            { letter: 'E', image: `${B4}/LISTENING%20PART%203/14%20(E).png`,    label: 'E' },
            { letter: 'F', image: `${B4}/LISTENING%20PART%203/F%20(12).png`,    label: 'F' },
          ],
          exampleAnswer: 'C',
          questions: [
            { num: 11, audioUrl: `${B4}/LISTENING%20PART%203/11.mp3`, audioText: '', answer: 'D' },
            { num: 12, audioUrl: `${B4}/LISTENING%20PART%203/12.mp3`, audioText: '', answer: 'F' },
            { num: 13, audioUrl: `${B4}/LISTENING%20PART%203/13.mp3`, audioText: '', answer: 'A' },
            { num: 14, audioUrl: `${B4}/LISTENING%20PART%203/14.mp3`, audioText: '', answer: 'E' },
            { num: 15, audioUrl: `${B4}/LISTENING%20PART%203/15.mp3`, audioText: '', answer: 'B' },
          ],
        },
        part4: {
          title: 'Parte 4 · Tres opciones',
          instruction: 'Escucha el audio y toca la opción correcta.',
          // Example folder: A shang dian (correct) / B yi yuan / C xue xiao → A
          example: {
            num: 'EJ', audioText: '',
            options: [
              { letter: 'A', text: 'shāngdiàn' },
              { letter: 'B', text: 'yīyuàn' },
              { letter: 'C', text: 'xuéxiào' },
            ],
            answer: 'A',
          },
          // Sim 4 L4 — options + correct from each question folder's .bmp filenames
          //   16: A chá / B shuǐguǒ / C rè shuǐ (✓)
          //   17: A 8 suì / B 20 suì (✓) / C 40 suì
          //   18: A chē lǐ / B zhuōzi shàng (✓) / C diànnǎo xiàmiàn
          //   19: A yīshēng / B xuésheng / C bàba (✓)
          //   20: A tài dà / B tài xiǎo (✓) / C tài shǎo
          questions: [
            { num: 16, audioUrl: `${B4}/LISTENING%20PART%204/16/16.mp3`, audioText: '', options: [
                { letter: 'A', text: 'chá' },
                { letter: 'B', text: 'shuǐguǒ' },
                { letter: 'C', text: 'rè shuǐ' },
              ], answer: 'C' },
            { num: 17, audioUrl: `${B4}/LISTENING%20PART%204/17/17.mp3`, audioText: '', options: [
                { letter: 'A', text: '8 suì' },
                { letter: 'B', text: '20 suì' },
                { letter: 'C', text: '40 suì' },
              ], answer: 'B' },
            { num: 18, audioUrl: `${B4}/LISTENING%20PART%204/18/18.mp3`, audioText: '', options: [
                { letter: 'A', text: 'chē lǐ' },
                { letter: 'B', text: 'zhuōzi shàng' },
                { letter: 'C', text: 'diànnǎo xiàmiàn' },
              ], answer: 'B' },
            { num: 19, audioUrl: `${B4}/LISTENING%20PART%204/19/19.mp3`, audioText: '', options: [
                { letter: 'A', text: 'yīshēng' },
                { letter: 'B', text: 'xuésheng' },
                { letter: 'C', text: 'bàba' },
              ], answer: 'C' },
            { num: 20, audioUrl: `${B4}/LISTENING%20PART%204/20/20.mp3`, audioText: '', options: [
                { letter: 'A', text: 'tài dà' },
                { letter: 'B', text: 'tài xiǎo' },
                { letter: 'C', text: 'tài shǎo' },
              ], answer: 'B' },
          ],
        },
      },
      reading: {
        part1: {
          title: 'Parte 5 (Lectura 1) · Verdadero / Falso',
          instruction: 'Lee la palabra. ¿Coincide con la imagen? Marca ✓ o ✕.',
          example: {
            num: 'EJ', word: 'diànshì', image: `${B4}/READING%20PART%201/EXAMPLE%20(FALSE).png`, answer: false,
          },
          // Sim 4 R1 words from QUESTIONS.txt:
          //   21 xiě · 22 nǚ'ér · 23 sì · 24 duō · 25 zhōngwǔ
          // Answers from filename markers: T F T T F
          questions: [
            { num: 21, word: 'xiě',     image: `${B4}/READING%20PART%201/21%20(TRUE).png`,  answer: true  },
            { num: 22, word: "nǚ'ér",   image: `${B4}/READING%20PART%201/22%20(FALSE).png`, answer: false },
            { num: 23, word: 'sì',      image: `${B4}/READING%20PART%201/23%20(TRUE).png`,  answer: true  },
            { num: 24, word: 'duō',     image: `${B4}/READING%20PART%201/24%20(TRUE).png`,  answer: true  },
            { num: 25, word: 'zhōngwǔ', image: `${B4}/READING%20PART%201/25%20(FALSE).png`, answer: false },
          ],
        },
        part2: {
          title: 'Parte 6 (Lectura 2) · Empareja con la imagen',
          instruction: 'Lee cada oración y toca la letra de la imagen que la representa.',
          // Sim 4 R2 picture-letter map from filenames:
          //   26 → C, 27 → A, 28 → F, 29 → B, 30 → D (E is example)
          gallery: [
            { letter: 'A', image: `${B4}/READING%20PART%202/27%20(A).png`,     label: 'A' },
            { letter: 'B', image: `${B4}/READING%20PART%202/29%20(B).png`,     label: 'B' },
            { letter: 'C', image: `${B4}/READING%20PART%202/26%20(C).png`,     label: 'C' },
            { letter: 'D', image: `${B4}/READING%20PART%202/30%20(D).png`,     label: 'D' },
            { letter: 'E', image: `${B4}/READING%20PART%202/E%20(EXAMPLE).png`, label: 'E (ejemplo)' },
            { letter: 'F', image: `${B4}/READING%20PART%202/28%20(F).png`,     label: 'F' },
          ],
          example: {
            num: 'EJ', hanzi: '我很喜欢这本书', pinyin: 'Wǒ hěn xǐhuān zhè běn shū', answer: 'E',
          },
          // Sim 4 R2 sentences from QUESTIONS.txt:
          questions: [
            { num: 26, hanzi: '看见了吗？在那儿，在前面',  pinyin: "Kànjiànle ma? Zài nà'er, zài qiánmiàn", answer: 'C' },
            { num: 27, hanzi: '小猫你不爱吃这个吗？',     pinyin: 'Xiǎo māo nǐ bù ài chī zhège ma?',       answer: 'A' },
            { num: 28, hanzi: '不客气李小姐。请坐',       pinyin: 'Bù kèqì Lǐ xiǎojiě. Qǐng zuò',          answer: 'F' },
            { num: 29, hanzi: '这个菜多少钱？30块',      pinyin: 'Zhège cài duōshǎo qián? 30 kuài',       answer: 'B' },
            { num: 30, hanzi: '谢谢你来医院看我',         pinyin: 'Xièxiè nǐ lái yīyuàn kàn wǒ',           answer: 'D' },
          ],
        },
        // 🆕 2026-06-16 — Sim 4 Reading Parts 3 & 4 (backfilled).
        part3: {
          title: 'Parte 7 (Lectura 3) · Pregunta ↔ Respuesta',
          instruction: 'Lee cada pregunta y elige la mejor respuesta del banco A-F.',
          bank: [
            { letter: 'A', hanzi: '中国',     pinyin: 'Zhōngguó' },
            { letter: 'B', hanzi: '很好',     pinyin: 'hěn hǎo' },
            { letter: 'C', hanzi: '一个月',   pinyin: 'yī gè yuè' },
            { letter: 'D', hanzi: '有，不少', pinyin: 'yǒu, bù shǎo' },
            { letter: 'E', hanzi: '我朋友的', pinyin: 'wǒ péngyou de' },
            { letter: 'F', hanzi: '好的，谢谢！', pinyin: 'hǎo de, xièxie!' },
          ],
          example: { num: 'EJ', hanzi: '你喝水吗？', pinyin: 'Nǐ hē shuǐ ma?', answer: 'F' },
          questions: [
            { num: 31, hanzi: '那个小狗是谁的？',     pinyin: 'Nàge xiǎo gǒu shì shéi de?',     answer: 'E' },
            { num: 32, hanzi: '你儿子在哪儿工作？',   pinyin: "Nǐ érzi zài nǎ'er gōngzuò?",     answer: 'A' },
            { num: 33, hanzi: '你在这儿住几天？',     pinyin: "Nǐ zài zhè'er zhù jǐ tiān?",     answer: 'C' },
            { num: 34, hanzi: '他的汉语怎么样？',     pinyin: 'Tā de hànyǔ zěnmeyàng?',         answer: 'B' },
            { num: 35, hanzi: '学校后面有商店吗？',   pinyin: 'Xuéxiào hòumiàn yǒu shāngdiàn ma?', answer: 'D' },
          ],
        },
        part4: {
          title: 'Parte 8 (Lectura 4) · Completa la oración',
          instruction: 'Lee cada oración y elige la palabra del banco A-F que completa el ( ).',
          bank: [
            { letter: 'A', hanzi: '太',   pinyin: 'tài' },
            { letter: 'B', hanzi: '冷',   pinyin: 'lěng' },
            { letter: 'C', hanzi: '菜',   pinyin: 'cài' },
            { letter: 'D', hanzi: '名字', pinyin: 'míngzi' },
            { letter: 'E', hanzi: '开',   pinyin: 'kāi' },
            { letter: 'F', hanzi: '电影', pinyin: 'diànyǐng' },
          ],
          example: { num: 'EJ', hanzi: '你叫什么 ( )？', pinyin: 'Nǐ jiào shénme ( )?', answer: 'D' },
          questions: [
            { num: 36, hanzi: '今天天气很（ ）',               pinyin: 'Jīntiān tiānqì hěn ( )',                       answer: 'B' },
            { num: 37, hanzi: '我妈妈喜欢吃中国（ ）',         pinyin: 'Wǒ māma xǐhuān chī Zhōngguó ( )',               answer: 'C' },
            { num: 38, hanzi: '杯子（ ）少了，我们有九个人',   pinyin: 'Bēizi ( ) shǎo le, wǒmen yǒu jiǔ gè rén',      answer: 'A' },
            { num: 39, hanzi: '下雨了，你怎么回家？我（ ）车了', pinyin: 'Xià yǔ le, nǐ zěnme huí jiā? Wǒ ( ) chē le',   answer: 'E' },
            { num: 40, hanzi: '明天上午我们去看（ ）怎么样？', pinyin: 'Míngtiān shàngwǔ wǒmen qù kàn ( ) zěnmeyàng?',  answer: 'F' },
          ],
        },
      },
    };
  })(),

  // ═══════════════════════════════════════════════════════════════════════
  // HSK1 · SIMULATION 5 — fifth mock exam. Uploaded 2026-06-08 with all
  // MP3/PNG/BMP plus the two QUESTIONS.txt files. Answer keys come from
  // the on-disk (CORRECT) / (TRUE) / (FALSE) / (LETTER) markers.
  // ═══════════════════════════════════════════════════════════════════════
  'hsk1-sim5': (() => {
    const B5 = '/assets/HSK%20SIMULATIONS/HSK%201/SIMULATION%205';
    return {
      id: 'hsk1-sim5',
      title: 'HSK1 · Simulación 5',
      level: 'hsk1',
      totalQuestions: 40,   // 🆕 reading parts 3 & 4 backfilled 2026-06-16
      pointsPerQuestion: 10,
      listening: {
        part1: {
          title: 'Parte 1 · Verdadero / Falso',
          instruction: 'Escucha el audio. ¿Es lo que muestra la imagen? Marca ✓ o ✕.',
          examples: [
            { num: 'EJ1', image: `${B5}/LISTENING%20PART%201/PART%201%20EXAMPLE%201.png`, audioText: 'hěn gāoxìng',  answer: true,  caption: 'Hěn gāoxìng (muy feliz)' },
            { num: 'EJ2', image: `${B5}/LISTENING%20PART%201/PART%201%20EXAMPLE%202.png`, audioText: 'kàn diànyǐng', answer: false, caption: 'Kàn diànyǐng (ver película)' },
          ],
          // Sim 5 L1 answers from on-disk markers: F F T F T
          questions: [
            { num: 1, image: `${B5}/LISTENING%20PART%201/1%20(FALSE).png`, audioUrl: `${B5}/LISTENING%20PART%201/1.mp3`, audioText: '', answer: false },
            { num: 2, image: `${B5}/LISTENING%20PART%201/2%20(FALSE).png`, audioUrl: `${B5}/LISTENING%20PART%201/2.mp3`, audioText: '', answer: false },
            { num: 3, image: `${B5}/LISTENING%20PART%201/3%20(TRUE).png`,  audioUrl: `${B5}/LISTENING%20PART%201/3.mp3`, audioText: '', answer: true  },
            { num: 4, image: `${B5}/LISTENING%20PART%201/4%20(FALSE).png`, audioUrl: `${B5}/LISTENING%20PART%201/4.mp3`, audioText: '', answer: false },
            { num: 5, image: `${B5}/LISTENING%20PART%201/5%20(TRUE).png`,  audioUrl: `${B5}/LISTENING%20PART%201/5.mp3`, audioText: '', answer: true  },
          ],
        },
        part2: {
          title: 'Parte 2 · Tres imágenes',
          instruction: 'Escucha el audio y toca la imagen correcta.',
          // Sim 5 L2 correct positions: B C C B C
          questions: [
            { num: 6,  audioUrl: `${B5}/LISTENING%20PART%202/6.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B5}/LISTENING%20PART%202/6A.png` },
                { letter: 'B', image: `${B5}/LISTENING%20PART%202/6B%20(CORRECT).png` },
                { letter: 'C', image: `${B5}/LISTENING%20PART%202/6C.png` },
              ], answer: 'B' },
            { num: 7,  audioUrl: `${B5}/LISTENING%20PART%202/7.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B5}/LISTENING%20PART%202/7A.png` },
                { letter: 'B', image: `${B5}/LISTENING%20PART%202/7B.png` },
                { letter: 'C', image: `${B5}/LISTENING%20PART%202/7C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 8,  audioUrl: `${B5}/LISTENING%20PART%202/8.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B5}/LISTENING%20PART%202/8A.png` },
                { letter: 'B', image: `${B5}/LISTENING%20PART%202/8B.png` },
                { letter: 'C', image: `${B5}/LISTENING%20PART%202/8C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 9,  audioUrl: `${B5}/LISTENING%20PART%202/9.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B5}/LISTENING%20PART%202/9A.png` },
                { letter: 'B', image: `${B5}/LISTENING%20PART%202/9B%20(CORRECT).png` },
                { letter: 'C', image: `${B5}/LISTENING%20PART%202/9C.png` },
              ], answer: 'B' },
            { num: 10, audioUrl: `${B5}/LISTENING%20PART%202/10.mp3`, audioText: '', options: [
                { letter: 'A', image: `${B5}/LISTENING%20PART%202/10A.png` },
                { letter: 'B', image: `${B5}/LISTENING%20PART%202/10B.png` },
                { letter: 'C', image: `${B5}/LISTENING%20PART%202/10C%20(CORRECT).png` },
              ], answer: 'C' },
          ],
        },
        part3: {
          title: 'Parte 3 · Empareja con la imagen',
          instruction: 'Escucha cada audio y toca la letra de la imagen correcta.',
          // Sim 5 file naming convention: "N (LETTER).png" → question N's
          // answer is LETTER. The same image IS the gallery letter image.
          //   11 (A) · 12 (D) · 13 (B) · 14 (F) · 15 (E) · C example
          gallery: [
            { letter: 'A', image: `${B5}/LISTENING%20PART%203/11%20(A).png`,     label: 'A' },
            { letter: 'B', image: `${B5}/LISTENING%20PART%203/13%20(B).png`,     label: 'B' },
            { letter: 'C', image: `${B5}/LISTENING%20PART%203/C%20(EXAMPLE).png`, label: 'C (ejemplo)' },
            { letter: 'D', image: `${B5}/LISTENING%20PART%203/12%20(D).png`,     label: 'D' },
            { letter: 'E', image: `${B5}/LISTENING%20PART%203/15%20(E).png`,     label: 'E' },
            { letter: 'F', image: `${B5}/LISTENING%20PART%203/14%20(F).png`,     label: 'F' },
          ],
          exampleAnswer: 'C',
          questions: [
            { num: 11, audioUrl: `${B5}/LISTENING%20PART%203/11.mp3`, audioText: '', answer: 'A' },
            { num: 12, audioUrl: `${B5}/LISTENING%20PART%203/12.mp3`, audioText: '', answer: 'D' },
            { num: 13, audioUrl: `${B5}/LISTENING%20PART%203/13.mp3`, audioText: '', answer: 'B' },
            { num: 14, audioUrl: `${B5}/LISTENING%20PART%203/14.mp3`, audioText: '', answer: 'F' },
            { num: 15, audioUrl: `${B5}/LISTENING%20PART%203/15.mp3`, audioText: '', answer: 'E' },
          ],
        },
        part4: {
          title: 'Parte 4 · Tres opciones',
          instruction: 'Escucha el audio y toca la opción correcta.',
          example: {
            num: 'EJ', audioText: '',
            options: [
              { letter: 'A', text: 'shāngdiàn' },
              { letter: 'B', text: 'yīyuàn' },
              { letter: 'C', text: 'xuéxiào' },
            ],
            answer: 'A',
          },
          // Sim 5 L4 — options + correct from each question folder's .bmp filenames
          //   16: A 13:00 (✓) / B 15:00 / C 17:00
          //   17: A chī duō le / B xiǎng jiā le (✓) / C bù hē shuǐ
          //   18: A zhuōzi shàng (✓) / B zhuōzi xià / C yǐzi shàng
          //   19: A tài dà (✓) / B tài xiǎo / C hěn piàoliang
          //   20: A lǎoshī / B kāi fēijī / C kāi chūzūchē (✓)
          questions: [
            { num: 16, audioUrl: `${B5}/LISTENING%20PART%204/16/16.mp3`, audioText: '', options: [
                { letter: 'A', text: '13:00' },
                { letter: 'B', text: '15:00' },
                { letter: 'C', text: '17:00' },
              ], answer: 'A' },
            { num: 17, audioUrl: `${B5}/LISTENING%20PART%204/17/17.mp3`, audioText: '', options: [
                { letter: 'A', text: 'chī duō le' },
                { letter: 'B', text: 'xiǎng jiā le' },
                { letter: 'C', text: 'bù hē shuǐ' },
              ], answer: 'B' },
            { num: 18, audioUrl: `${B5}/LISTENING%20PART%204/18/18.mp3`, audioText: '', options: [
                { letter: 'A', text: 'zhuōzi shàng' },
                { letter: 'B', text: 'zhuōzi xià' },
                { letter: 'C', text: 'yǐzi shàng' },
              ], answer: 'A' },
            { num: 19, audioUrl: `${B5}/LISTENING%20PART%204/19/19.mp3`, audioText: '', options: [
                { letter: 'A', text: 'tài dà' },
                { letter: 'B', text: 'tài xiǎo' },
                { letter: 'C', text: 'hěn piàoliang' },
              ], answer: 'A' },
            { num: 20, audioUrl: `${B5}/LISTENING%20PART%204/20/20.mp3`, audioText: '', options: [
                { letter: 'A', text: 'lǎoshī' },
                { letter: 'B', text: 'kāi fēijī' },
                { letter: 'C', text: 'kāi chūzūchē' },
              ], answer: 'C' },
          ],
        },
      },
      reading: {
        part1: {
          title: 'Parte 5 (Lectura 1) · Verdadero / Falso',
          instruction: 'Lee la palabra. ¿Coincide con la imagen? Marca ✓ o ✕.',
          example: {
            num: 'EJ', word: 'diànshì', image: `${B5}/READING%20PART%201/EXAMPLE%20(FALSE).png`, answer: false,
          },
          // Sim 5 R1 words from QUESTIONS.txt:
          //   21 qǐng · 22 xuéxí · 23 zàijiàn · 24 nǎ'er · 25 diànnǎo
          // Markers: T F F T F
          questions: [
            { num: 21, word: 'qǐng',    image: `${B5}/READING%20PART%201/21%20(TRUE).png`,  answer: true  },
            { num: 22, word: 'xuéxí',   image: `${B5}/READING%20PART%201/22%20(FALSE).png`, answer: false },
            { num: 23, word: 'zàijiàn', image: `${B5}/READING%20PART%201/23%20(FALSE).png`, answer: false },
            { num: 24, word: "nǎ'er",   image: `${B5}/READING%20PART%201/24%20(TRUE).png`,  answer: true  },
            { num: 25, word: 'diànnǎo', image: `${B5}/READING%20PART%201/25%20(FALSE).png`, answer: false },
          ],
        },
        part2: {
          title: 'Parte 6 (Lectura 2) · Empareja con la imagen',
          instruction: 'Lee cada oración y toca la letra de la imagen que la representa.',
          // Sim 5 R2 picture-letter map from filenames:
          //   26 → B · 27 → A · 28 → C · 29 → D · 30 → F · E example
          gallery: [
            { letter: 'A', image: `${B5}/READING%20PART%202/27%20(A).png`,     label: 'A' },
            { letter: 'B', image: `${B5}/READING%20PART%202/26%20(B).png`,     label: 'B' },
            { letter: 'C', image: `${B5}/READING%20PART%202/28%20(C).png`,     label: 'C' },
            { letter: 'D', image: `${B5}/READING%20PART%202/29%20(D).png`,     label: 'D' },
            { letter: 'E', image: `${B5}/READING%20PART%202/E%20(EXAMPLE).png`, label: 'E (ejemplo)' },
            { letter: 'F', image: `${B5}/READING%20PART%202/30%20(F).png`,     label: 'F' },
          ],
          example: {
            num: 'EJ', hanzi: '我很喜欢这本书', pinyin: 'Wǒ hěn xǐhuān zhè běn shū', answer: 'E',
          },
          // Sim 5 R2 sentences from QUESTIONS.txt:
          questions: [
            { num: 26, hanzi: '这儿有椅子，我们坐这儿', pinyin: "Zhè'er yǒu yǐzi, wǒmen zuò zhè'er",  answer: 'B' },
            { num: 27, hanzi: '十点了，我现在去学校',   pinyin: 'Shí diǎn le, wǒ xiànzài qù xuéxiào',  answer: 'A' },
            { num: 28, hanzi: '小猫在哪儿？看见了吗？', pinyin: "Xiǎo māo zài nǎ'er? Kànjiànle ma?",    answer: 'C' },
            { num: 29, hanzi: '你想吃哪一个？',         pinyin: 'Nǐ xiǎng chī nǎ yīgè?',               answer: 'D' },
            { num: 30, hanzi: '他是医生，在医院工作',   pinyin: 'Tā shì yīshēng, zài yīyuàn gōngzuò',  answer: 'F' },
          ],
        },
        // 🆕 2026-06-16 — Sim 5 Reading Parts 3 & 4 (backfilled).
        part3: {
          title: 'Parte 7 (Lectura 3) · Pregunta ↔ Respuesta',
          instruction: 'Lee cada pregunta y elige la mejor respuesta del banco A-F.',
          bank: [
            { letter: 'A', hanzi: '没',       pinyin: 'méi' },
            { letter: 'B', hanzi: '上个月',   pinyin: 'shàng gè yuè' },
            { letter: 'C', hanzi: '我',       pinyin: 'wǒ' },
            { letter: 'D', hanzi: '北京大学', pinyin: 'Běijīng dàxué' },
            { letter: 'E', hanzi: '中午有雨', pinyin: 'zhōngwǔ yǒu yǔ' },
            { letter: 'F', hanzi: '好的，谢谢！', pinyin: 'hǎo de, xièxie!' },
          ],
          example: { num: 'EJ', hanzi: '你喝水吗？', pinyin: 'Nǐ hē shuǐ ma?', answer: 'F' },
          questions: [
            { num: 31, hanzi: '他现在在哪儿读书？',   pinyin: "Tā xiànzài zài nǎ'er dúshū?",        answer: 'D' },
            { num: 32, hanzi: '你看见张小姐了吗？',   pinyin: 'Nǐ kànjiàn Zhāng xiǎojiě le ma?',    answer: 'A' },
            { num: 33, hanzi: '你们是什么时候认识的？', pinyin: 'Nǐmen shì shénme shíhòu rènshi de?', answer: 'B' },
            { num: 34, hanzi: '你们谁会开车？',       pinyin: 'Nǐmen shéi huì kāichē?',             answer: 'C' },
            { num: 35, hanzi: '明天天气怎么样？',     pinyin: 'Míngtiān tiānqì zěnmeyàng?',         answer: 'E' },
          ],
        },
        part4: {
          title: 'Parte 8 (Lectura 4) · Completa la oración',
          instruction: 'Lee cada oración y elige la palabra del banco A-F que completa el ( ).',
          bank: [
            { letter: 'A', hanzi: '买',     pinyin: 'mǎi' },
            { letter: 'B', hanzi: '多',     pinyin: 'duō' },
            { letter: 'C', hanzi: '对不起', pinyin: 'duìbùqǐ' },
            { letter: 'D', hanzi: '名字',   pinyin: 'míngzi' },
            { letter: 'E', hanzi: '明天',   pinyin: 'míngtiān' },
            { letter: 'F', hanzi: '商店',   pinyin: 'shāngdiàn' },
          ],
          example: { num: 'EJ', hanzi: '你叫什么 ( )？', pinyin: 'Nǐ jiào shénme ( )?', answer: 'D' },
          questions: [
            { num: 36, hanzi: '现在有很（ ）人来中国学汉语',    pinyin: 'Xiànzài yǒu hěn ( ) rén lái Zhōngguó xué hànyǔ', answer: 'B' },
            { num: 37, hanzi: '（ ）你说什么？我没听见',        pinyin: '( ) nǐ shuō shénme? Wǒ méi tīngjiàn',            answer: 'C' },
            { num: 38, hanzi: '再见，（ ）学校见',              pinyin: 'Zàijiàn, ( ) xuéxiào jiàn',                      answer: 'E' },
            { num: 39, hanzi: '你回来的时候（ ）些水果',        pinyin: 'Nǐ huílái de shíhòu ( ) xiē shuǐguǒ',            answer: 'A' },
            { num: 40, hanzi: '你现在在哪儿？我在（ ），10分钟后回去', pinyin: "Nǐ xiànzài zài nǎ'er? Wǒ zài ( ), 10 fēnzhōng hòu huíqù", answer: 'F' },
          ],
        },
      },
    };
  })(),

  // ═══════════════════════════════════════════════════════════════════════
  // HSK1 · SIMULATION 6 — sixth mock exam. Uploaded 2026-06-08 with all
  // MP3/PNG/BMP + the two QUESTIONS.txt files. Answer keys from the
  // on-disk (CORRECT) / (TRUE) / (FALSE) / (LETTER) markers.
  // ═══════════════════════════════════════════════════════════════════════
  'hsk1-sim6': (() => {
    const B6 = '/assets/HSK%20SIMULATIONS/HSK%201/SIMULATION%206';
    return {
      id: 'hsk1-sim6',
      title: 'HSK1 · Simulación 6',
      level: 'hsk1',
      totalQuestions: 40,   // 🆕 reading parts 3 & 4 backfilled 2026-06-16
      pointsPerQuestion: 10,
      listening: {
        part1: {
          title: 'Parte 1 · Verdadero / Falso',
          instruction: 'Escucha el audio. ¿Es lo que muestra la imagen? Marca ✓ o ✕.',
          examples: [
            { num: 'EJ1', image: `${B6}/LISTENING%20PART%201/PART%201%20EXAMPLE%201.png`, audioText: 'hěn gāoxìng',  answer: true,  caption: 'Hěn gāoxìng (muy feliz)' },
            { num: 'EJ2', image: `${B6}/LISTENING%20PART%201/PART%201%20EXAMPLE%202.png`, audioText: 'kàn diànyǐng', answer: false, caption: 'Kàn diànyǐng (ver película)' },
          ],
          // Sim 6 L1 answers from markers: F T T F T
          questions: [
            { num: 1, image: `${B6}/LISTENING%20PART%201/1%20(FALSE).png`, audioUrl: `${B6}/LISTENING%20PART%201/1.mp3`, audioText: '', answer: false },
            { num: 2, image: `${B6}/LISTENING%20PART%201/2%20(TRUE).png`,  audioUrl: `${B6}/LISTENING%20PART%201/2.mp3`, audioText: '', answer: true  },
            { num: 3, image: `${B6}/LISTENING%20PART%201/3%20(TRUE).png`,  audioUrl: `${B6}/LISTENING%20PART%201/3.mp3`, audioText: '', answer: true  },
            { num: 4, image: `${B6}/LISTENING%20PART%201/4%20(FALSE).png`, audioUrl: `${B6}/LISTENING%20PART%201/4.mp3`, audioText: '', answer: false },
            { num: 5, image: `${B6}/LISTENING%20PART%201/5%20(TRUE).png`,  audioUrl: `${B6}/LISTENING%20PART%201/5.mp3`, audioText: '', answer: true  },
          ],
        },
        part2: {
          title: 'Parte 2 · Tres imágenes',
          instruction: 'Escucha el audio y toca la imagen correcta.',
          // Sim 6 L2 correct positions: A B C A C
          questions: [
            { num: 6,  audioUrl: `${B6}/LISTENING%20PART%202/6.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B6}/LISTENING%20PART%202/6A%20(CORRECT).png` },
                { letter: 'B', image: `${B6}/LISTENING%20PART%202/6B.png` },
                { letter: 'C', image: `${B6}/LISTENING%20PART%202/6C.png` },
              ], answer: 'A' },
            { num: 7,  audioUrl: `${B6}/LISTENING%20PART%202/7.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B6}/LISTENING%20PART%202/7A.png` },
                { letter: 'B', image: `${B6}/LISTENING%20PART%202/7B%20(CORRECT).png` },
                { letter: 'C', image: `${B6}/LISTENING%20PART%202/7C.png` },
              ], answer: 'B' },
            { num: 8,  audioUrl: `${B6}/LISTENING%20PART%202/8.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B6}/LISTENING%20PART%202/8A.png` },
                { letter: 'B', image: `${B6}/LISTENING%20PART%202/8B.png` },
                { letter: 'C', image: `${B6}/LISTENING%20PART%202/8C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 9,  audioUrl: `${B6}/LISTENING%20PART%202/9.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B6}/LISTENING%20PART%202/9A%20(CORRECT).png` },
                { letter: 'B', image: `${B6}/LISTENING%20PART%202/9B.png` },
                { letter: 'C', image: `${B6}/LISTENING%20PART%202/9C.png` },
              ], answer: 'A' },
            { num: 10, audioUrl: `${B6}/LISTENING%20PART%202/10.mp3`, audioText: '', options: [
                { letter: 'A', image: `${B6}/LISTENING%20PART%202/10A.png` },
                { letter: 'B', image: `${B6}/LISTENING%20PART%202/10B.png` },
                { letter: 'C', image: `${B6}/LISTENING%20PART%202/10C%20(CORRECT).png` },
              ], answer: 'C' },
          ],
        },
        part3: {
          title: 'Parte 3 · Empareja con la imagen',
          instruction: 'Escucha cada audio y toca la letra de la imagen correcta.',
          // Sim 6 file convention "N (LETTER).png": 11→F 12→E 13→B 14→D 15→A · C example
          gallery: [
            { letter: 'A', image: `${B6}/LISTENING%20PART%203/15%20(A).png`,     label: 'A' },
            { letter: 'B', image: `${B6}/LISTENING%20PART%203/13%20(B).png`,     label: 'B' },
            { letter: 'C', image: `${B6}/LISTENING%20PART%203/C%20(EXAMPLE).png`, label: 'C (ejemplo)' },
            { letter: 'D', image: `${B6}/LISTENING%20PART%203/14%20(D).png`,     label: 'D' },
            { letter: 'E', image: `${B6}/LISTENING%20PART%203/12%20(E).png`,     label: 'E' },
            { letter: 'F', image: `${B6}/LISTENING%20PART%203/11%20(F).png`,     label: 'F' },
          ],
          exampleAnswer: 'C',
          questions: [
            { num: 11, audioUrl: `${B6}/LISTENING%20PART%203/11.mp3`, audioText: '', answer: 'F' },
            { num: 12, audioUrl: `${B6}/LISTENING%20PART%203/12.mp3`, audioText: '', answer: 'E' },
            { num: 13, audioUrl: `${B6}/LISTENING%20PART%203/13.mp3`, audioText: '', answer: 'B' },
            { num: 14, audioUrl: `${B6}/LISTENING%20PART%203/14.mp3`, audioText: '', answer: 'D' },
            { num: 15, audioUrl: `${B6}/LISTENING%20PART%203/15.mp3`, audioText: '', answer: 'A' },
          ],
        },
        part4: {
          title: 'Parte 4 · Tres opciones',
          instruction: 'Escucha el audio y toca la opción correcta.',
          example: {
            num: 'EJ', audioText: '',
            options: [
              { letter: 'A', text: 'shāngdiàn' },
              { letter: 'B', text: 'yīyuàn' },
              { letter: 'C', text: 'xuéxiào' },
            ],
            answer: 'A',
          },
          // Sim 6 L4 — options + correct from each question folder's .bmp filenames
          //   16: A diànshì / B diànnǎo / C diànyǐng (✓)
          //   17: A tiānqì (✓) / B xuéxiào / C gōngzuò
          //   18: A péngyou / B tóngxué / C yīshēng (✓)
          //   19: A lǎoshī / B nǚ'ér (✓) / C māma
          //   20: A 7 yuè 9 hào / B 8 yuè 9 hào (✓) / C 9 yuè 8 hào
          questions: [
            { num: 16, audioUrl: `${B6}/LISTENING%20PART%204/16/16.mp3`, audioText: '', options: [
                { letter: 'A', text: 'diànshì' },
                { letter: 'B', text: 'diànnǎo' },
                { letter: 'C', text: 'diànyǐng' },
              ], answer: 'C' },
            { num: 17, audioUrl: `${B6}/LISTENING%20PART%204/17/17.mp3`, audioText: '', options: [
                { letter: 'A', text: 'tiānqì' },
                { letter: 'B', text: 'xuéxiào' },
                { letter: 'C', text: 'gōngzuò' },
              ], answer: 'A' },
            { num: 18, audioUrl: `${B6}/LISTENING%20PART%204/18/18.mp3`, audioText: '', options: [
                { letter: 'A', text: 'péngyou' },
                { letter: 'B', text: 'tóngxué' },
                { letter: 'C', text: 'yīshēng' },
              ], answer: 'C' },
            { num: 19, audioUrl: `${B6}/LISTENING%20PART%204/19/19.mp3`, audioText: '', options: [
                { letter: 'A', text: 'lǎoshī' },
                { letter: 'B', text: "nǚ'ér" },
                { letter: 'C', text: 'māma' },
              ], answer: 'B' },
            { num: 20, audioUrl: `${B6}/LISTENING%20PART%204/20/20.mp3`, audioText: '', options: [
                { letter: 'A', text: '7 yuè 9 hào' },
                { letter: 'B', text: '8 yuè 9 hào' },
                { letter: 'C', text: '9 yuè 8 hào' },
              ], answer: 'B' },
          ],
        },
      },
      reading: {
        part1: {
          title: 'Parte 5 (Lectura 1) · Verdadero / Falso',
          instruction: 'Lee la palabra. ¿Coincide con la imagen? Marca ✓ o ✕.',
          example: {
            num: 'EJ', word: 'diànshì', image: `${B6}/READING%20PART%201/EXAMPLE%20(FALSE).png`, answer: false,
          },
          // Sim 6 R1 words from QUESTIONS.txt:
          //   21 mǐfàn · 22 xiàwǔ · 23 dúshū · 24 chūzū chē · 25 xiǎng
          // Markers: T F T F T
          questions: [
            { num: 21, word: 'mǐfàn',     image: `${B6}/READING%20PART%201/21%20(TRUE).png`,  answer: true  },
            { num: 22, word: 'xiàwǔ',     image: `${B6}/READING%20PART%201/22%20(FALSE).png`, answer: false },
            { num: 23, word: 'dúshū',     image: `${B6}/READING%20PART%201/23%20(TRUE).png`,  answer: true  },
            { num: 24, word: 'chūzū chē', image: `${B6}/READING%20PART%201/24%20(FALSE).png`, answer: false },
            { num: 25, word: 'xiǎng',     image: `${B6}/READING%20PART%201/25%20(TRUE).png`,  answer: true  },
          ],
        },
        part2: {
          title: 'Parte 6 (Lectura 2) · Empareja con la imagen',
          instruction: 'Lee cada oración y toca la letra de la imagen que la representa.',
          // Sim 6 R2 picture-letter map from filenames:
          //   26→D · 27→C · 28→A · 29→F · 30→B · E example
          gallery: [
            { letter: 'A', image: `${B6}/READING%20PART%202/28%20(A).png`,     label: 'A' },
            { letter: 'B', image: `${B6}/READING%20PART%202/30%20(B).png`,     label: 'B' },
            { letter: 'C', image: `${B6}/READING%20PART%202/27%20(C).png`,     label: 'C' },
            { letter: 'D', image: `${B6}/READING%20PART%202/26%20(D).png`,     label: 'D' },
            { letter: 'E', image: `${B6}/READING%20PART%202/E%20(EXAMPLE).png`, label: 'E (ejemplo)' },
            { letter: 'F', image: `${B6}/READING%20PART%202/29%20(F).png`,     label: 'F' },
          ],
          example: {
            num: 'EJ', hanzi: '我很喜欢这本书', pinyin: 'Wǒ hěn xǐhuān zhè běn shū', answer: 'E',
          },
          // Sim 6 R2 sentences from QUESTIONS.txt:
          questions: [
            { num: 26, hanzi: '我回家了，再见！',       pinyin: 'Wǒ huí jiā le, zàijiàn!',              answer: 'D' },
            { num: 27, hanzi: '妈妈是我的好朋友',       pinyin: 'Māma shì wǒ de hǎo péngyou',          answer: 'C' },
            { num: 28, hanzi: '这些东西多少钱？',       pinyin: 'Zhèxiē dōngxī duōshǎo qián?',         answer: 'A' },
            { num: 29, hanzi: '我家今天很冷',           pinyin: 'Wǒ jiā jīntiān hěn lěng',             answer: 'F' },
            { num: 30, hanzi: '桌子上有一个苹果',       pinyin: 'Zhuōzi shàng yǒu yī gè píngguǒ',      answer: 'B' },
          ],
        },
        // 🆕 2026-06-16 — Sim 6 Reading Parts 3 & 4 (backfilled).
        part3: {
          title: 'Parte 7 (Lectura 3) · Pregunta ↔ Respuesta',
          instruction: 'Lee cada pregunta y elige la mejor respuesta del banco A-F.',
          bank: [
            { letter: 'A', hanzi: '他去学校了', pinyin: 'tā qù xuéxiào le' },
            { letter: 'B', hanzi: '想睡觉',     pinyin: 'xiǎng shuìjiào' },
            { letter: 'C', hanzi: '我的老师',   pinyin: 'wǒ de lǎoshī' },
            { letter: 'D', hanzi: '会很热',     pinyin: 'huì hěn rè' },
            { letter: 'E', hanzi: '中国菜',     pinyin: 'zhōngguó cài' },
            { letter: 'F', hanzi: '好的，谢谢！', pinyin: 'hǎo de, xièxie!' },
          ],
          example: { num: 'EJ', hanzi: '你喝水吗？', pinyin: 'Nǐ hē shuǐ ma?', answer: 'F' },
          questions: [
            { num: 31, hanzi: '你女儿在家吗？',     pinyin: "Nǐ nǚ'ér zài jiā ma?",          answer: 'A' },
            { num: 32, hanzi: '明天的天气怎么样？', pinyin: 'Míngtiān de tiānqì zěnmeyàng?', answer: 'D' },
            { num: 33, hanzi: '你们喜欢吃什么菜？', pinyin: 'Nǐmen xǐhuān chī shénme cài?',  answer: 'E' },
            { num: 34, hanzi: '你怎么了？',         pinyin: 'Nǐ zěnme le?',                  answer: 'B' },
            { num: 35, hanzi: '谁说你汉语很好？',   pinyin: 'Shéi shuō nǐ hànyǔ hěn hǎo?',   answer: 'C' },
          ],
        },
        part4: {
          title: 'Parte 8 (Lectura 4) · Completa la oración',
          instruction: 'Lee cada oración y elige la palabra del banco A-F que completa el ( ).',
          bank: [
            { letter: 'A', hanzi: '会',     pinyin: 'huì' },
            { letter: 'B', hanzi: '漂亮',   pinyin: 'piàoliang' },
            { letter: 'C', hanzi: '月',     pinyin: 'yuè' },
            { letter: 'D', hanzi: '名字',   pinyin: 'míngzi' },
            { letter: 'E', hanzi: '学生',   pinyin: 'xuéshēng' },
            { letter: 'F', hanzi: '打电话', pinyin: 'dǎ diànhuà' },
          ],
          example: { num: 'EJ', hanzi: '你叫什么 ( )？', pinyin: 'Nǐ jiào shénme ( )?', answer: 'D' },
          questions: [
            { num: 36, hanzi: '他（ ）给我说，他不来',         pinyin: 'Tā ( ) gěi wǒ shuō, tā bù lái',          answer: 'F' },
            { num: 37, hanzi: '老师们都很喜欢这个（ ）',       pinyin: 'Lǎoshīmen dōu hěn xǐhuān zhège ( )',     answer: 'E' },
            { num: 38, hanzi: '我学（ ）了做饭',               pinyin: 'Wǒ xué ( ) le zuò fàn',                  answer: 'A' },
            { num: 39, hanzi: '这个椅子很（ ）。这是我爸爸买的', pinyin: 'Zhège yǐzi hěn ( ). Zhè shì wǒ bàba mǎi de', answer: 'B' },
            { num: 40, hanzi: '这家商店是什么时候开的？3（ ）7号', pinyin: 'Zhè jiā shāngdiàn shì shénme shíhòu kāi de? 3 ( ) 7 hào', answer: 'C' },
          ],
        },
      },
    };
  })(),

  // ═══════════════════════════════════════════════════════════════════════
  // HSK1 · SIMULATION 7 — FIRST full 40-question exam. 4 listening parts
  // (1-20) + 4 reading parts (21-40). Reading Part 3 (31-35) is a
  // sentence→response text-match, and Reading Part 4 (36-40) is a
  // gap-fill from a word bank — both NEW question types. Uploaded
  // 2026-06-16. Sims 1-6 stay at 30 questions until their parts 3/4 land.
  // ═══════════════════════════════════════════════════════════════════════
  'hsk1-sim7': (() => {
    const B7 = '/assets/HSK%20SIMULATIONS/HSK%201/SIMULATION%207';
    return {
      id: 'hsk1-sim7',
      title: 'HSK1 · Simulación 7',
      level: 'hsk1',
      totalQuestions: 40,
      pointsPerQuestion: 10,
      listening: {
        part1: {
          title: 'Parte 1 · Verdadero / Falso',
          instruction: 'Escucha el audio. ¿Es lo que muestra la imagen? Marca ✓ o ✕.',
          examples: [
            { num: 'EJ1', image: `${B7}/LISTENING%20PART%201/PART%201%20EXAMPLE%201.png`, audioText: 'hěn gāoxìng',  answer: true,  caption: 'Hěn gāoxìng (muy feliz)' },
            { num: 'EJ2', image: `${B7}/LISTENING%20PART%201/PART%201%20EXAMPLE%202.png`, audioText: 'kàn diànyǐng', answer: false, caption: 'Kàn diànyǐng (ver película)' },
          ],
          // Sim 7 L1 markers: T F T F F
          questions: [
            { num: 1, image: `${B7}/LISTENING%20PART%201/1%20(TRUE).png`,  audioUrl: `${B7}/LISTENING%20PART%201/1.mp3`, audioText: '', answer: true  },
            { num: 2, image: `${B7}/LISTENING%20PART%201/2%20(FALSE).png`, audioUrl: `${B7}/LISTENING%20PART%201/2.mp3`, audioText: '', answer: false },
            { num: 3, image: `${B7}/LISTENING%20PART%201/3%20(TRUE).png`,  audioUrl: `${B7}/LISTENING%20PART%201/3.mp3`, audioText: '', answer: true  },
            { num: 4, image: `${B7}/LISTENING%20PART%201/4%20(FALSE).png`, audioUrl: `${B7}/LISTENING%20PART%201/4.mp3`, audioText: '', answer: false },
            { num: 5, image: `${B7}/LISTENING%20PART%201/5%20(FALSE).png`, audioUrl: `${B7}/LISTENING%20PART%201/5.mp3`, audioText: '', answer: false },
          ],
        },
        part2: {
          title: 'Parte 2 · Tres imágenes',
          instruction: 'Escucha el audio y toca la imagen correcta.',
          // Sim 7 L2 correct positions: B A C B C
          questions: [
            { num: 6,  audioUrl: `${B7}/LISTENING%20PART%202/6.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B7}/LISTENING%20PART%202/6A.png` },
                { letter: 'B', image: `${B7}/LISTENING%20PART%202/6B%20(CORRECT).png` },
                { letter: 'C', image: `${B7}/LISTENING%20PART%202/6C.png` },
              ], answer: 'B' },
            { num: 7,  audioUrl: `${B7}/LISTENING%20PART%202/7.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B7}/LISTENING%20PART%202/7A%20(CORRECT).png` },
                { letter: 'B', image: `${B7}/LISTENING%20PART%202/7B.png` },
                { letter: 'C', image: `${B7}/LISTENING%20PART%202/7C.png` },
              ], answer: 'A' },
            { num: 8,  audioUrl: `${B7}/LISTENING%20PART%202/8.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B7}/LISTENING%20PART%202/8A.png` },
                { letter: 'B', image: `${B7}/LISTENING%20PART%202/8B.png` },
                { letter: 'C', image: `${B7}/LISTENING%20PART%202/8C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 9,  audioUrl: `${B7}/LISTENING%20PART%202/9.mp3`,  audioText: '', options: [
                { letter: 'A', image: `${B7}/LISTENING%20PART%202/9A.png` },
                { letter: 'B', image: `${B7}/LISTENING%20PART%202/9B%20(CORRECT).png` },
                { letter: 'C', image: `${B7}/LISTENING%20PART%202/9C.png` },
              ], answer: 'B' },
            { num: 10, audioUrl: `${B7}/LISTENING%20PART%202/10.mp3`, audioText: '', options: [
                { letter: 'A', image: `${B7}/LISTENING%20PART%202/10A.png` },
                { letter: 'B', image: `${B7}/LISTENING%20PART%202/10B.png` },
                { letter: 'C', image: `${B7}/LISTENING%20PART%202/10C%20(CORRECT).png` },
              ], answer: 'C' },
          ],
        },
        part3: {
          title: 'Parte 3 · Empareja con la imagen',
          instruction: 'Escucha cada audio y toca la letra de la imagen correcta.',
          // Sim 7 file convention "N (LETTER)": 11→D 12→F 13→A 14→E 15→B · C example
          gallery: [
            { letter: 'A', image: `${B7}/LISTENING%20PART%203/13%20(A).png`,    label: 'A' },
            { letter: 'B', image: `${B7}/LISTENING%20PART%203/15%20(B).png`,    label: 'B' },
            { letter: 'C', image: `${B7}/LISTENING%20PART%203/C%20(EXAMPLE).png`, label: 'C (ejemplo)' },
            { letter: 'D', image: `${B7}/LISTENING%20PART%203/11%20(D).png`,    label: 'D' },
            { letter: 'E', image: `${B7}/LISTENING%20PART%203/14%20(E).png`,    label: 'E' },
            { letter: 'F', image: `${B7}/LISTENING%20PART%203/12(F).png`,       label: 'F' },
          ],
          exampleAnswer: 'C',
          questions: [
            { num: 11, audioUrl: `${B7}/LISTENING%20PART%203/11.mp3`, audioText: '', answer: 'D' },
            { num: 12, audioUrl: `${B7}/LISTENING%20PART%203/12.mp3`, audioText: '', answer: 'F' },
            { num: 13, audioUrl: `${B7}/LISTENING%20PART%203/13.mp3`, audioText: '', answer: 'A' },
            { num: 14, audioUrl: `${B7}/LISTENING%20PART%203/14.mp3`, audioText: '', answer: 'E' },
            { num: 15, audioUrl: `${B7}/LISTENING%20PART%203/15.mp3`, audioText: '', answer: 'B' },
          ],
        },
        part4: {
          title: 'Parte 4 · Tres opciones',
          instruction: 'Escucha el audio y toca la opción correcta.',
          example: {
            num: 'EJ', audioText: '',
            options: [
              { letter: 'A', text: 'shāngdiàn' },
              { letter: 'B', text: 'yīyuàn' },
              { letter: 'C', text: 'xuéxiào' },
            ],
            answer: 'A',
          },
          // Sim 7 L4 from .bmp filenames:
          //   16: A 6 diǎn / B 7 diǎn (✓) / C 8 diǎn
          //   17: A cài (✓) / B mǐfàn / C shuǐguǒ
          //   18: A zhuōzi / B diànnǎo / C chábēi (✓)
          //   19: A rè (✓) / B lěng / C xià yǔ
          //   20: A chīfàn / B kàn diànyǐng / C dǎ diànhuà (✓)
          questions: [
            { num: 16, audioUrl: `${B7}/LISTENING%20PART%204/16/16.mp3`, audioText: '', options: [
                { letter: 'A', text: '6 diǎn' },
                { letter: 'B', text: '7 diǎn' },
                { letter: 'C', text: '8 diǎn' },
              ], answer: 'B' },
            { num: 17, audioUrl: `${B7}/LISTENING%20PART%204/17/17.mp3`, audioText: '', options: [
                { letter: 'A', text: 'cài' },
                { letter: 'B', text: 'mǐfàn' },
                { letter: 'C', text: 'shuǐguǒ' },
              ], answer: 'A' },
            { num: 18, audioUrl: `${B7}/LISTENING%20PART%204/18/18.mp3`, audioText: '', options: [
                { letter: 'A', text: 'zhuōzi' },
                { letter: 'B', text: 'diànnǎo' },
                { letter: 'C', text: 'chábēi' },
              ], answer: 'C' },
            { num: 19, audioUrl: `${B7}/LISTENING%20PART%204/19/19.mp3`, audioText: '', options: [
                { letter: 'A', text: 'rè' },
                { letter: 'B', text: 'lěng' },
                { letter: 'C', text: 'xià yǔ' },
              ], answer: 'A' },
            { num: 20, audioUrl: `${B7}/LISTENING%20PART%204/20/20.mp3`, audioText: '', options: [
                { letter: 'A', text: 'chīfàn' },
                { letter: 'B', text: 'kàn diànyǐng' },
                { letter: 'C', text: 'dǎ diànhuà' },
              ], answer: 'C' },
          ],
        },
      },
      reading: {
        part1: {
          title: 'Parte 5 (Lectura 1) · Verdadero / Falso',
          instruction: 'Lee la palabra. ¿Coincide con la imagen? Marca ✓ o ✕.',
          example: {
            num: 'EJ', word: 'diànshì', image: `${B7}/READING%20PART%201/EXAMPLE%20(FALSE).png`, answer: false,
          },
          // Sim 7 R1 words from QUESTIONS.txt:
          //   21 hé · 22 kāichē · 23 xuéxiào · 24 shí'èr diǎn · 25 tóngxué
          // Markers: T F F F T
          questions: [
            { num: 21, word: 'hé',          image: `${B7}/READING%20PART%201/21%20(TRUE).png`,  answer: true  },
            { num: 22, word: 'kāichē',      image: `${B7}/READING%20PART%201/22%20(FALSE).png`, answer: false },
            { num: 23, word: 'xuéxiào',     image: `${B7}/READING%20PART%201/23%20(FALSE).png`, answer: false },
            { num: 24, word: "shí'èr diǎn", image: `${B7}/READING%20PART%201/24%20(FALSE).png`, answer: false },
            { num: 25, word: 'tóngxué',     image: `${B7}/READING%20PART%201/25%20(TRUE).png`,  answer: true  },
          ],
        },
        part2: {
          title: 'Parte 6 (Lectura 2) · Empareja con la imagen',
          instruction: 'Lee cada oración y toca la letra de la imagen que la representa.',
          // Sim 7 R2 picture-letter map: 26→F 27→B 28→C 29→D 30→A · E example
          // NOTE: 27 is .jpeg, the rest .png.
          gallery: [
            { letter: 'A', image: `${B7}/READING%20PART%202/30%20(A).png`,     label: 'A' },
            { letter: 'B', image: `${B7}/READING%20PART%202/27%20(B).jpeg`,    label: 'B' },
            { letter: 'C', image: `${B7}/READING%20PART%202/28%20(C).png`,     label: 'C' },
            { letter: 'D', image: `${B7}/READING%20PART%202/29%20(D).png`,     label: 'D' },
            { letter: 'E', image: `${B7}/READING%20PART%202/E%20(EXAMPLE).png`, label: 'E (ejemplo)' },
            { letter: 'F', image: `${B7}/READING%20PART%202/26%20(F).png`,     label: 'F' },
          ],
          example: {
            num: 'EJ', hanzi: '我很喜欢这本书', pinyin: 'Wǒ hěn xǐhuān zhè běn shū', answer: 'E',
          },
          questions: [
            { num: 26, hanzi: '他们有一个儿子一个女儿', pinyin: "Tāmen yǒu yī gè érzi yī gè nǚ'ér",        answer: 'F' },
            { num: 27, hanzi: '我看见他在椅子上睡觉呢', pinyin: 'Wǒ kànjiàn tā zài yǐzi shàng shuìjiào ne', answer: 'B' },
            { num: 28, hanzi: '桌子上有很多菜',         pinyin: 'Zhuōzi shàng yǒu hěn duō cài',            answer: 'C' },
            { num: 29, hanzi: '他去电影院看电影了',     pinyin: 'Tā qù diànyǐngyuàn kàn diànyǐng le',      answer: 'D' },
            { num: 30, hanzi: '老师说我们现在学习汉字', pinyin: 'Lǎoshī shuō wǒmen xiànzài xuéxí hànzì',   answer: 'A' },
          ],
        },
        // 🆕 Reading Part 3 — match each question to its best response from
        // the TEXT answer bank A-F (no images). HSK1 reading 三.
        part3: {
          title: 'Parte 7 (Lectura 3) · Pregunta ↔ Respuesta',
          instruction: 'Lee cada pregunta y elige la mejor respuesta del banco A-F.',
          bank: [
            { letter: 'A', hanzi: '星期一',       pinyin: 'xīngqí yī' },
            { letter: 'B', hanzi: '学汉语',       pinyin: 'xué hànyǔ' },
            { letter: 'C', hanzi: '饭店后面',     pinyin: 'fàndiàn hòumiàn' },
            { letter: 'D', hanzi: '是一个人来的', pinyin: 'shì yī gè rén lái de' },
            { letter: 'E', hanzi: '不客气',       pinyin: 'bú kèqì' },
            { letter: 'F', hanzi: '好的，谢谢！', pinyin: 'hǎo de, xièxie!' },
          ],
          example: { num: 'EJ', hanzi: '你喝水吗？', pinyin: 'Nǐ hē shuǐ ma?', answer: 'F' },
          questions: [
            { num: 31, hanzi: '今天星期几？',         pinyin: 'Jīntiān xīngqí jǐ?',               answer: 'A' },
            { num: 32, hanzi: '谢谢你请我吃饭',       pinyin: 'Xièxie nǐ qǐng wǒ chīfàn',         answer: 'E' },
            { num: 33, hanzi: '你在北京学什么？',     pinyin: 'Nǐ zài Běijīng xué shénme?',       answer: 'B' },
            { num: 34, hanzi: '他是一个人来中国的吗？', pinyin: 'Tā shì yī gè rén lái Zhōngguó de ma?', answer: 'D' },
            { num: 35, hanzi: '你的车在哪儿？',       pinyin: "Nǐ de chē zài nǎ'er?",             answer: 'C' },
          ],
        },
        // 🆕 Reading Part 4 — fill the blank ( ) with the right word from
        // the word bank A-F. HSK1 reading 四.
        part4: {
          title: 'Parte 8 (Lectura 4) · Completa la oración',
          instruction: 'Lee cada oración y elige la palabra del banco A-F que completa el ( ).',
          bank: [
            { letter: 'A', hanzi: '在',     pinyin: 'zài' },
            { letter: 'B', hanzi: '昨天',   pinyin: 'zuótiān' },
            { letter: 'C', hanzi: '年',     pinyin: 'nián' },
            { letter: 'D', hanzi: '名字',   pinyin: 'míngzi' },
            { letter: 'E', hanzi: '学生',   pinyin: 'xuéshēng' },
            { letter: 'F', hanzi: '一点儿', pinyin: 'yìdiǎnr' },
          ],
          example: { num: 'EJ', hanzi: '你叫什么 ( )？', pinyin: 'Nǐ jiào shénme ( )?', answer: 'D' },
          questions: [
            { num: 36, hanzi: '她买了（ ）米饭',                   pinyin: 'Tā mǎi le ( ) mǐfàn',                          answer: 'F' },
            { num: 37, hanzi: '他不认识坐在他前面的（ ）',         pinyin: 'Tā bú rènshi zuò zài tā qiánmiàn de ( )',      answer: 'E' },
            { num: 38, hanzi: '这个电影是哪一（ ）的？',           pinyin: 'Zhège diànyǐng shì nǎ yī ( ) de?',             answer: 'C' },
            { num: 39, hanzi: '你怎么不认识这个汉字？我（ ）没来', pinyin: 'Nǐ zěnme bú rènshi zhège hànzì? Wǒ ( ) méi lái', answer: 'B' },
            { num: 40, hanzi: '钱先生（ ）吗？他去医院了',         pinyin: 'Qián xiānsheng ( ) ma? Tā qù yīyuàn le',       answer: 'A' },
          ],
        },
      },
    };
  })(),
};

// Strip the correct-answer fields before sending to a student client.
// (Server keeps the answer key; client only gets the question shape.)
function buildSimPayload(simId) {
  const sim = SIMULATIONS[simId];
  if (!sim) return null;
  const sanitizeOpt = (q) => {
    const cp = Object.assign({}, q);
    delete cp.answer;
    return cp;
  };
  return {
    id: sim.id,
    title: sim.title,
    level: sim.level,
    totalQuestions: sim.totalQuestions,
    pointsPerQuestion: sim.pointsPerQuestion,
    listening: {
      part1: {
        title: sim.listening.part1.title,
        instruction: sim.listening.part1.instruction,
        examples: sim.listening.part1.examples,   // examples keep their answer (it's shown)
        questions: sim.listening.part1.questions.map(sanitizeOpt),
      },
      part2: {
        title: sim.listening.part2.title,
        instruction: sim.listening.part2.instruction,
        questions: sim.listening.part2.questions.map(sanitizeOpt),
      },
      part3: {
        title: sim.listening.part3.title,
        instruction: sim.listening.part3.instruction,
        gallery: sim.listening.part3.gallery,
        exampleAnswer: sim.listening.part3.exampleAnswer,
        questions: sim.listening.part3.questions.map(sanitizeOpt),
      },
      part4: {
        title: sim.listening.part4.title,
        instruction: sim.listening.part4.instruction,
        example: sim.listening.part4.example,
        questions: sim.listening.part4.questions.map(sanitizeOpt),
      },
    },
    reading: {
      part1: {
        title: sim.reading.part1.title,
        instruction: sim.reading.part1.instruction,
        example: sim.reading.part1.example,
        questions: sim.reading.part1.questions.map(sanitizeOpt),
      },
      part2: {
        title: sim.reading.part2.title,
        instruction: sim.reading.part2.instruction,
        gallery: sim.reading.part2.gallery,
        example: sim.reading.part2.example,
        questions: sim.reading.part2.questions.map(sanitizeOpt),
      },
      // 🆕 2026-06-16 — Reading parts 3 & 4 (Sim 7+). SANITIZE the
      // questions (strip the answer key) before sending to the client;
      // only the worked example keeps its answer (it's meant to show).
      // Older sims without these parts pass through as undefined.
      part3: sim.reading.part3 ? {
        title: sim.reading.part3.title,
        instruction: sim.reading.part3.instruction,
        bank: sim.reading.part3.bank,
        example: sim.reading.part3.example,
        questions: sim.reading.part3.questions.map(sanitizeOpt),
      } : undefined,
      part4: sim.reading.part4 ? {
        title: sim.reading.part4.title,
        instruction: sim.reading.part4.instruction,
        bank: sim.reading.part4.bank,
        example: sim.reading.part4.example,
        questions: sim.reading.part4.questions.map(sanitizeOpt),
      } : undefined,
    },
  };
}

// Grade a submission. answers is an object: { 'L1-1': true, 'L2-6': 'C', ... }
// Returns { score, total, breakdown: [{ qid, correct, expected, given }] }
function gradeSim(simId, answers) {
  const sim = SIMULATIONS[simId];
  if (!sim) return null;
  const breakdown = [];
  let score = 0;
  const PPQ = sim.pointsPerQuestion;
  function grade(qid, expected, given) {
    // Compare loosely: undefined/null = not answered = incorrect.
    let isCorrect = false;
    if (given !== undefined && given !== null && given !== '') {
      // Boolean vs string — coerce.
      const e = (typeof expected === 'boolean') ? expected : String(expected);
      const g = (typeof expected === 'boolean') ? (given === true || given === 'true') : String(given);
      isCorrect = (e === g);
    }
    if (isCorrect) score += PPQ;
    breakdown.push({ qid, expected, given, correct: isCorrect });
  }
  // Listening
  sim.listening.part1.questions.forEach((q) => grade('L1-' + q.num, q.answer, (answers || {})['L1-' + q.num]));
  sim.listening.part2.questions.forEach((q) => grade('L2-' + q.num, q.answer, (answers || {})['L2-' + q.num]));
  sim.listening.part3.questions.forEach((q) => grade('L3-' + q.num, q.answer, (answers || {})['L3-' + q.num]));
  sim.listening.part4.questions.forEach((q) => grade('L4-' + q.num, q.answer, (answers || {})['L4-' + q.num]));
  // Reading
  sim.reading.part1.questions.forEach((q) => grade('R1-' + q.num, q.answer, (answers || {})['R1-' + q.num]));
  sim.reading.part2.questions.forEach((q) => grade('R2-' + q.num, q.answer, (answers || {})['R2-' + q.num]));
  // 🆕 2026-06-16 — Reading parts 3 & 4 (only sims that have them, e.g.
  // Sim 7's 40-question full exam). Older 30-question sims skip these.
  if (sim.reading.part3 && Array.isArray(sim.reading.part3.questions)) {
    sim.reading.part3.questions.forEach((q) => grade('R3-' + q.num, q.answer, (answers || {})['R3-' + q.num]));
  }
  if (sim.reading.part4 && Array.isArray(sim.reading.part4.questions)) {
    sim.reading.part4.questions.forEach((q) => grade('R4-' + q.num, q.answer, (answers || {})['R4-' + q.num]));
  }
  const total = sim.totalQuestions * PPQ;
  return { score, total, percent: Math.round((score / total) * 100), breakdown };
}

function listSims() {
  return Object.values(SIMULATIONS).map((s) => {
    // Count reading parts present (2 for old sims, 4 for Sim 7+).
    const readingParts = ['part1', 'part2', 'part3', 'part4']
      .filter((p) => s.reading && s.reading[p]).length;
    const listeningParts = ['part1', 'part2', 'part3', 'part4']
      .filter((p) => s.listening && s.listening[p]).length;
    return {
      id: s.id,
      title: s.title,
      subtitle: s.subtitle || (listeningParts + ' partes de audio · ' + readingParts + ' partes de lectura'),
      level: s.level,
      totalQuestions: s.totalQuestions,
      questionCount: s.totalQuestions,
      partCount: listeningParts + readingParts,
    };
  });
}

module.exports = { SIMULATIONS, buildSimPayload, gradeSim, listSims };
