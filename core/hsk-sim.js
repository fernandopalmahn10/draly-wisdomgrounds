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
      totalQuestions: 30,
      pointsPerQuestion: 10,
      listening: {
        part1: {
          title: 'Parte 1 · Verdadero / Falso',
          instruction: 'Escucha el audio. ¿Es lo que muestra la imagen? Marca ✓ o ✕.',
          examples: [
            { num: 'EJ1', image: `${B2}/LISTENING%20PART%201/PART%201%20EXAMPLE%201.png`, audioText: 'hěn gāoxìng',  answer: true,  caption: 'Hěn gāoxìng (muy feliz)' },
            { num: 'EJ2', image: `${B2}/LISTENING%20PART%201/PART%201%20EXAMPLE%202.png`, audioText: 'kàn diànyǐng', answer: false, caption: 'Kàn diànyǐng (ver película)' },
          ],
          // Q1-5 answer keys pulled from the filename markers. User
          // renamed in commit 3c883a6ad — sim 2 L1 is FFTTF (not the
          // sim 1 pattern). Paths updated to match new filenames.
          questions: [
            { num: 1, image: `${B2}/LISTENING%20PART%201/1%20(FALSE).png`, audioText: '', answer: false },
            { num: 2, image: `${B2}/LISTENING%20PART%201/2%20(FALSE).png`, audioText: '', answer: false },
            { num: 3, image: `${B2}/LISTENING%20PART%201/3%20(TRUE).png`,  audioText: '', answer: true  },
            { num: 4, image: `${B2}/LISTENING%20PART%201/4%20(TRUE).png`,  audioText: '', answer: true  },
            { num: 5, image: `${B2}/LISTENING%20PART%201/5%20(FALSE).png`, audioText: '', answer: false },
          ],
        },
        part2: {
          title: 'Parte 2 · Tres imágenes',
          instruction: 'Escucha el audio y toca la imagen correcta.',
          questions: [
            { num: 6,  audioText: '', options: [
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/6A.png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/6B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/6C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 7,  audioText: '', options: [
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/7A%20(CORRECT).png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/7B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/7C.png` },
              ], answer: 'A' },
            { num: 8,  audioText: '', options: [
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/8A%20(CORRECT).png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/8B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/8C.png` },
              ], answer: 'A' },
            { num: 9,  audioText: '', options: [
                // 9A.png missing in the asset drop — using B as a fallback display
                { letter: 'A', image: `${B2}/LISTENING%20PART%202/9B.png` },
                { letter: 'B', image: `${B2}/LISTENING%20PART%202/9B.png` },
                { letter: 'C', image: `${B2}/LISTENING%20PART%202/9C%20(CORRECT).png` },
              ], answer: 'C' },
            { num: 10, audioText: '', options: [
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
            { num: 11, audioText: '', answer: 'F' },
            { num: 12, audioText: '', answer: 'D' },
            { num: 13, audioText: '', answer: 'E' },
            { num: 14, audioText: '', answer: 'B' },
            { num: 15, audioText: '', answer: 'A' },
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
            { num: 16, audioText: '', options: [
                { letter: 'A', text: 'kàn shū' },
                { letter: 'B', text: 'xuéxí Hànyǔ' },
                { letter: 'C', text: 'dǎ diànhuà' },
              ], answer: 'B' },
            { num: 17, audioText: '', options: [
                { letter: 'A', text: 'Běijīng' },
                { letter: 'B', text: 'jiā lǐ' },
                { letter: 'C', text: 'fàndiàn' },
              ], answer: 'A' },
            { num: 18, audioText: '', options: [
                { letter: 'A', text: '6 nián' },
                { letter: 'B', text: '9 nián' },
                { letter: 'C', text: '16 nián' },
              ], answer: 'B' },
            { num: 19, audioUrl: `${B2}/LISTENING%20PART%204/19/19.mp3`, audioText: '', options: [
                { letter: 'A', text: 'kāi chē' },
                { letter: 'B', text: 'zuò fēijī' },
                { letter: 'C', text: 'zuò chūzū chē' },
              ], answer: 'C' },
            { num: 20, audioText: '', options: [
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
          // R1 words are TODO for sim 2 — placeholder shown so the kid
          // sees the structure; teacher can drop in real words after
          // looking at the images.
          questions: [
            { num: 21, word: '(palabra)', image: `${B2}/READING%20PART%201/21%20(FALSE).png`, answer: false },
            { num: 22, word: '(palabra)', image: `${B2}/READING%20PART%201/22%20(TRUE).png`,  answer: true  },
            { num: 23, word: '(palabra)', image: `${B2}/READING%20PART%201/23%20(TRUE).png`,  answer: true  },
            { num: 24, word: '(palabra)', image: `${B2}/READING%20PART%201/24%20(FALSE).png`, answer: false },
            { num: 25, word: '(palabra)', image: `${B2}/READING%20PART%201/25%20(TRUE).png`,  answer: true  },
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
      part3: sim.reading.part3,
      part4: sim.reading.part4,
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
  const total = sim.totalQuestions * PPQ;
  return { score, total, percent: Math.round((score / total) * 100), breakdown };
}

function listSims() {
  return Object.values(SIMULATIONS).map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle || '4 partes de audio · 2 partes de lectura',
    level: s.level,
    totalQuestions: s.totalQuestions,
    questionCount: s.totalQuestions,
    partCount: 6,
  }));
}

module.exports = { SIMULATIONS, buildSimPayload, gradeSim, listSims };
