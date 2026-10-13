# Draly Wisdom Grounds: everything Claude does, and how

A complete guide to the platform and to the work I do on it: what exists, how it's built, how I
build and test, and the new way of turning a screen recording into an official test. Use it to
understand the scope, to direct the work, and to learn the method.

**Live site:** `https://app.dralingo.app` (through Cloudflare, since 2026-10-12); the Render address `https://draly-wisdomgrounds-2.onrender.com` still works
**Code:** `C:\Users\ferpa\ClaudeCode\mochi-mash`, its own git repository on GitHub, deployed by Render.

---

## Contents

1. [What Draly Wisdom Grounds is](#1-what-draly-wisdom-grounds-is)
2. [Everything on the platform](#2-everything-on-the-platform)
3. [How the platform is built](#3-how-the-platform-is-built)
4. [How I work: the 7-step loop](#4-how-i-work-the-7-step-loop)
5. [New: building an official test from a screen recording](#5-new-building-an-official-test-from-a-screen-recording)
6. [Other ways content gets into the platform](#6-other-ways-content-gets-into-the-platform)
7. [My toolbox](#7-my-toolbox)
8. [Your standing rules I follow](#8-your-standing-rules-i-follow)
9. [What I need from you, and what I can't do](#9-what-i-need-from-you-and-what-i-cant-do)
10. [What's next (pending work)](#10-whats-next-pending-work)
11. [Timeline: what was built and when](#11-timeline-what-was-built-and-when)
12. [Glossary](#12-glossary)

---

## 1. What Draly Wisdom Grounds is

A teacher–student platform for learning **Chino Mandarín** (plus an Emirati Arabic track).
Dralingo, the blue dragon in a keffiyeh, is the host character. It brings together, in one website:

- **live classroom PIN games**: the teacher's screen shows a PIN and the kids play on their phones
- **homework** that grades itself, with progress tracking
- **parent control**: parents follow their child, and get report cards
- **official test simulations**: Old HSK, YCT and New HSK, with saved results
- **teacher modes**: tools for teaching live in class
- **a teacher dashboard** to manage students, classrooms and everything above

**In numbers:** about 43,000 lines of code, 333 saved versions since 6 May 2026, 19 live game
modes, 12 official test simulations.

---

## 2. Everything on the platform

### 2.0 The cast (every class is an episode)

His vision (2026-10-11): "like Scooby-Doo", every class feels like a new episode of a show. The gang: Dralingo, Profe
Fer, Hamdan, Latifa, Aileen, Adric and Adrian (show bible: `claude-setup/cast.md` in the parent repo). On the
platform they appear as glossy 3D stickers (`public/assets/cast/`, made with Higgsfield from his own character art) via
`public/js/cast.js`: two random members greet kids on the home page, DralingoFX has «cameo» and «el equipo» effects
(projector games, phones, Modo Maestro's «🕵️ El equipo» button).

### 2.1 Live PIN games (7 games + 3 class tools)

The teacher opens a game on the big screen, kids join with the PIN on phones or tablets, and
everyone plays at once. On 2026-10-10 he retired 11 older games to make room for a new generation;
the 5 he kept are all due for a full overhaul ("second run"). New games follow the `new-pin-game`
skill and must pass the bot playtest (`scripts/playtest-bots.js`) before shipping. Since 2026-10-12 every game is
also graded with the Reinos de Colores scorecard (`docs/GAME_QUALITY_CHECKLIST.md`: 5 must-pass checks + 7 areas scored
0–2: a real place, the gang, every tap answers, feedback with restraint, a finale, fair play, product feel). It ships
at 12/14 or more with no area at 0, and you see the card in the deploy report.

| Game | What it is |
|---|---|
| **Reinos de Colores** | Kahoot «Color Kingdoms» rebuilt and improved: right answer = a flag the kid plants on a hex map from the phone; surround zones to flip them, steal tiles, besiege the enemy castle. Dubai version (2026-10-11): five landmarks on the map worth +3/+5 (full-screen moment when one changes hands), two random captains from the gang per round (VS intro, side panels, cameos), Dubai skyline backdrop, the phone zooms onto the tiles you can tap |
| **Batalla de Nieve en Ski Dubái** | Gimkit 2D-map infection game (`snow`, 2026-10-12, branch only): kids walk their saga avatar around a top-down Dubai on the phone (joystick + «Lanzar»), answer at the 4-colour stations for copos ❄️, throw snowballs; the Hechizo de Hielo makes 2 kids the ice team and 3 ice hits freeze a survivor into it; the projector shows the whole map, the frost bar and the captains. Spec + scorecard `docs/specs/batalla-de-nieve.md` |
| **La Gran Fuga de Dubái** | Kahoot «Robot Run» co-op chase (`escape`, 2026-10-13, branch only): the whole class runs from Robotín (the museum's goofy guard robot) through the Museo del Futuro, the Dubai Mall and the airport runway; every right answer is a turbo, his tickle-zap makes everybody dizzy 3 s; between zones a «zona segura» room on every phone (joystick, green zones, limits that force the class to split, 5 team hearts); the escape in Hamdan's jet, a crew rank and personal awards. Spec + scorecard `docs/specs/gran-fuga-de-dubai.md` |
| **Dragones Pintores** | Gimkit «Color Clash» in Dralingo style: each kid flies a red or blue Dralingo over cloud platforms on the phone and paints every cloud it lands on; flying burns fire, «Recargar» + a right answer refills it; the projector shows the whole sky live |
| **Mochi Mash** | The first game: panda vs kitsune teams tap-battle on quiz answers |
| **Piñata Tigre** | Two-tiger team smash |
| **Vuelo del Dragón** (Dragon's Eye) | Vertical flight platformer, swipe up |
| **Dàfùwēng · Monopolio Chino** | Chinese trivia board game: dice, shared board, leaderboard |
| **6-7 Swing** | Math game on the viral "six-seven" meme, numbers 一–十 |
| **Warm-up / Modo Maestro** | The teacher's live sentence builder (see 2.2) |
| **Lectura** | Synced karaoke reading with a reading test (see 2.2) |
| **HSK / YCT simulation rooms** | Official tests run as PIN rooms (see 2.6) |

**Shared across all games:**
- avatars
- music per game
- the Rewards toast system
- final leaderboards
- reconnection (kids rejoin by name if their phone drops)
- late joiners land in the right game

How to add a game is documented in `docs/GAME_MODES.md`.

### 2.2 Teacher modes (teaching live in class)

- **Modo Maestro / Warm-up sentence builder.** The teacher builds sentences from the 150 HSK1 words,
  grouped by experiences EXP1–EXP8. Features:
  - picture mode and presets
  - Asistente (a student helps build sentences)
  - Modo Curioso (tap any word for a Pokédex-style card)
  - undo, and history per student
- **Lectura.** Karaoke reading of stories, synced with audio, in pinyin only. It has a slow-motion
  mode, a Spanish/pinyin toggle, and a 5-question reading test per story.
- **Describe la imagen.** Send any picture from the simulations to every screen so the class
  describes it together.
- **Animations tray.** Send our own animated saga (Dralingo ×3, the camel, the Dubai plane, the falcon, the oryx) to
  every kid's screen, plus quick bursts of the cast (Profe Fer, Hamdan, Latifa, Aileen, Adric, Adrian). Since
  2026-10-12 there are no brand characters anywhere: one list, `public/js/saga.js`.
- **Sentence practice.** All the reading sentences from the simulations, with the answer bank,
  to analyse in class by eliminating wrong options. Since 2026-10-12 in folders like Official Tests: YCT (YCT 1 Sims
  1–5) · New HSK (New HSK 1 Sims 1–2) · Old HSK (HSK 1 Sims 1–10).
- **🚀 Lanzar juego.** One launcher for every game. It can **force** kids into a session (not just
  invite them).
- **Live session to selected kids.** Pick who is online and pull them into Modo Maestro.

### 2.3 Homework portal (`/homework`)

Kids enter with a **class access code** plus **their student code**. The access code also sets
their level: 1001 is Old HSK 1, 1002 is New HSK 1, 1003 is YCT 1 (2026-10-12). You can change any code's level, or
add a code, in /maestro → Teachers. The levels live in one list, `core/levels.js`.

- **Folders:** HSK 1 / New HSK 1 → 8 experiences → activities; YCT 1 → its 6 worlds + «Simulacro del examen», each
  with the YCT 1 game rounds as tareas (same questions and Higgsfield pictures as the pin games). Assignments grade
  themselves; 80% passes. The parents' view shows the kid's own level and its words.
- **Personalized tareas** the teacher sends to specific kids.
- **Mis Oraciones:** the kid's saved sentences plus sentences the teacher sent ("De la maestra"),
  with categories, audio, and tap-a-word flashcards.
- **Sentence practice** with native audio and Spanish/English meanings.
- **Desafíos del Día:** daily challenge with 5 rotating modes, Reacción Pīnyīn and DÍA DORADO.
  Includes the **Diario** daily-rewards system, the Templo del Dragón game and diplomas.
- **Story mode** and character stories.
- **Sim Trainer:** questions from the 10 HSK simulations, organised into 3 difficulty tiers × 8
  experiences, with a confetti and 3D-trophy celebration.
- **🎒 Bolsa de Palabras (HSK2):** build valid sentences from a sack of word chips.
- **Mis exámenes:** the kid's own official-test results and mistakes.
- **🌐 ES→EN toggle**, for teachers teaching from a student account.
- **Avatars and settings.**

**🔊 Audios de las tareas (`/audios`, 2026-10-11).** Every homework PDF (the storybook guides) has its audio on a
public page, no login: `/audios` lists the homeworks by level, `/audios/hsk1-e03-r1` opens one. Each has the PDF's
three tracks (EXP3.1 the words, EXP3.2 the dialogue, EXP3.3 the six video lines) with pauses to repeat, every line
tappable on its own, the line being read lit in gold. How new ones get there: Cowork saves each final PDF in
`ClaudeCode/TAREAS/`; when a Claude Code window opens, a check lists PDFs without audio, and I build them
(`tarea-audio` skill, about 5 minutes each). The voices are the platform's Google voices.

### 2.4 Parent control

Parents open their child's progress with the same codes. A privacy guard makes sure a code only
opens the matching child.

- progress bar (0 → 2000), activities, saved sentences
- **📝 Exámenes reales**: the child's official-test results
- **report cards**: the teacher's notes become a branded monthly report card ("Generar reporte")
- word-list audio, and an English dashboard option

### 2.5 Teacher dashboard (`/maestro`)

- **Multi-teacher:** each teacher only sees their own classrooms. A super-admin sees everything.
  Teachers have levels (e.g. Ms Han HSK2, Ms Enni and Ms Nicole HSK1+2) and there's a quick-start
  guide.
- **Cuaderno de Alumnos:** every student, their saved sentences, their attempts.
- **🎓 Aulas (classrooms):** create named classes, add and remove members, send to a whole class.
- **Push sentences / Paquete de lección:** send sentences, or a whole lesson pack, to chosen kids or
  a class.
- **Messaging:** notes to one student, or a broadcast to a class, with a live inbox.
- **Live roster:** who's online right now.
- **🏠 Llevar a casa:** pulls stuck kids back to their profile within about 8 seconds, with a live
  "N/M en casa" board.
- **🏆 Official Tests:** Old HSK / YCT / New HSK → level → simulation → open a PIN room. The host
  screen shows a live monitor of each kid's progress.
- **🏅 Test Results:** every exam turned in. A result can be **migrated** if a kid used the wrong
  account.
- **Report-card notes**, the GIF/mascot push, and creating teacher accounts and levels.

### 2.6 Official tests and results

| Family | Status | Player |
|---|---|---|
| **Old HSK 1** | Simulations 1–10, 40 questions each, answers and audio from your uploaded files | `hsk-sim.html` |
| **YCT 1** | Simulations 1–5, the real exam flow on the **original recorded audio** | `yct-sim.html` (new interface) |
| **New HSK 1** | Simulations 1–2 (2026-10-11): 40 questions each, original audio, 5-minute review, 20-minute reading | `yct-sim.html` (same interface) |

**The YCT player (the new interface):**
1. A cover page with the exam structure.
2. Listening follows the original audio: welcome → "听力考试现在开始" → each part's instructions →
   examples already answered → each question read twice. No pause or replay. "Saltar intro" skips
   the welcome or the instructions.
   While the audio plays, kids can tap any question already heard to check or change it; "Volver al audio" brings
   them back, and the screen moves on by itself at the next question. "Terminar escucha" ends listening early.
   The listening ends with the original closing line "听力考试现在结束".
3. **Review time** (YCT 2 minutes, New HSK 5 minutes) for listening answers, question by question (Anterior / Siguiente), with the unanswered
   numbers listed; "Terminar revisión" moves to Reading (no way back).
4. **Reading** at the kid's own pace on the exam's clock (YCT 17 minutes, New HSK 20 minutes).
   Each Reading question has a one-line Spanish hint of what to tap.
   New HSK adds its own layouts: text answers (A/B/C with characters + pinyin), six shared pictures
   for a dialogue (tap the picture or its letter), a reply bank, a word bank, and short texts with a ★ question.
5. **Results:** a score out of 200 (120 to pass), % correct per part, and a green/red number for
   each question. Tapping a number shows the picture, the kid's answer, the correct answer, what the
   audio said, and a button to play that clip again.

It has a sober official look, works on phones, and **resumes at the same second** if the page
reloads. Results are saved for teachers, kids and parents.

**Build order (your decision):** YCT 1 → New HSK 1 → YCT 2 → New HSK 2 → YCT 3 → … Finish all
simulations of a level before moving up.

### 2.7 Emirati gateway

A separate Emirati Arabic (Khaleeji) track:
- 100 local, personalized words with exactly 2 sentences per word, in real Arabic script
- Azure's Emirati neural voices, with a Google fallback
- a study list that refills itself, and a "Mis aprendidos" review

### 2.8 Under the hood

- **Mandarin audio:** Google Cloud text-to-speech, cached on disk so each sentence is only paid for
  once, and rate-limited so nobody can run up the bill.
- **Security:**
  - **Phase 1 and 2 done:** a parent can only see their own child, password-guessing protection,
    and security logging.
  - **Admin password:** you set `WU_ADMIN_PASSWORD` on Render.
  - **Phase 3 (Cloudflare)** is still pending.
- **Data:** student records, rooms and results live on Render's **permanent disk** (`data/`), never
  in the code or on GitHub.
- **Room to grow (checked 2026-10-12):** one Starter server (half a CPU, 512 MB) used at most 40 % of its memory and
  8 % of its processor in a month; the data disk holds 45 MB of 1 GB; kids downloaded ~7.5 GB a month. New games
  are small (code + sounds 1-3 MB each); pictures and sounds are what grow, so they follow the size rules in
  `CLAUDE.md` («Keep the site light») and `scripts/asset-guard.js` checks them before each deploy. The same day the
  site went from 587 MB to 115 MB of media (unused 3D models out, Old HSK exam pictures as WebP, the 41 MB
  «Xiǎo Míng» story removed).
- **Old accounts rest in an archive (since 2026-10-12):** accounts with no activity for 30 days move out of the live
  student file every day into an archive on the same disk; the kid's code brings everything back instantly. Teachers
  see «📦 N archived» on the dashboard. Nothing is deleted.
- **New address (since 2026-10-12):** `https://app.dralingo.app` through your Cloudflare (secure, flood guard, pictures
  kept close to the kids). Opening the old Render link moves the phone there with its saved student code.
- **Home-screen app (since 2026-10-12):** families tap «📲 Instalar la app» (home footer, homework header, audios
  footer) and Dralingo's icon appears on the phone; it opens full-screen like an app, shows a «Sin conexión» page
  without internet, and is ready to receive notifications (sending them is the next step). Same link, no store.
- **Monthly health check:** on the 1st of each month a scheduled Claude task runs `scripts/health-check.js` (Render
  memory, processor, downloads, disk; the student file; media size; page weight) and tells you if a limit is crossed
  and what to do (bigger server, database, lighter pictures). Reports in `reports/platform-health/`.

---

## 3. How the platform is built

Think of a restaurant:

| Part | Restaurant | What it really is |
|---|---|---|
| `server.js` (9,200 lines) | **The kitchen** | One Node.js program on Render. It answers every request and keeps the live connection (socket.io) for PIN games |
| `core/` | **The recipes** | One file per job: `hsk-sim.js` and `yct-sim.js` (exams and grading), `teachers.js`, `student-records.js`, `assignments.js`, `classrooms.js`, `emirati-vocab.js`… |
| `public/` | **The dining room** | Every page: HTML (structure) + CSS (look) + JS (behaviour). Pictures and audio are in `public/assets/` |
| `data/` | **The pantry** | Students, results and rooms, on Render's permanent disk |
| GitHub | **The recipe archive** | Every saved version, so any change can be undone |
| Render | **The building** | Rebuilds the site about 2–3 minutes after each push |

**Deploying = `git push`.** "It's live" always comes after a push and a check on the live site.

---

## 4. How I work: the 7-step loop

1. **Understand the goal.** I read for the goal behind the words; "skip button" meant *it plays by
   default and can be skipped*. I only ask when something is truly ambiguous.
2. **Remember.** I keep a memory folder of facts and your rules
   (`C:\Users\ferpa\.claude\projects\...\memory\`), and the platform has its own rule file,
   `mochi-mash/CLAUDE.md`. I read them first and update them after.
3. **Find the exact place in the code.** I search rather than guess. For big areas I send a helper
   agent to map them and report file and line numbers.
4. **Build the way the code already works.** I reuse existing plumbing; YCT reuses the HSK rooms,
   PIN, heartbeat, grading and results, so the live monitor and "Llevar a casa" work for free.
5. **Test before you see it:**
   - a **local copy** of the site on your PC (`localhost:3000`), so real kids are never affected
   - I play **teacher and student**: open a room, join with a PIN, take the exam
   - **hidden test switches** jump anywhere instantly, e.g.
     `yct-sim.html?debug=1&direct=1&sim=yct1-sim2&pin=…&view=reading&rc=13`, or
     `yctDebug.seek(195)` to jump the audio
   - **screenshots** with a hidden Edge browser, so I check desktop and phone layouts with my own eyes
   - **number checks**: a perfect answer sheet must score exactly 200/200
6. **Save, deploy, verify.** I commit with a note explaining *why*, push, wait for Render, and check
   the live site (the exam is listed and its audio loads) before I say "live".
7. **Report honestly, then remember.** What changed, what I verified, and what I **couldn't**.

---

## 5. New: building an official test from a screen recording

**Discovered 8 October 2026.** You don't need to send pictures, audio files, transcripts or
answers. One screen recording of you taking the mock exam contains all of it, and I take it apart
with programs already on your PC. YCT1 Simulación 2 was built this way, with zero Higgsfield
credits.

### What you do

1. Open the mock test (HSK Mock) in Chrome. **Zoom to 125–150%** so pictures are bigger.
2. **Start recording before pressing Start**, so the welcome audio is captured. Your recorder saves
   to `C:\Users\ferpa\Videos\Captures`.
3. Take the full test with sound on. **After each click, move the mouse off the pictures.** In
   Reading, stay a few seconds on each question.
4. Finish on the **results screen** and open the answer review.
5. Name the file like `YCT 1 SIMULATION 3.mp4` and tell me "it's recorded".

### What I do (about 14 steps)

| # | Step | How |
|---|---|---|
| 1 | Find the newest video | `Videos/Captures` |
| 2 | Map it | A contact sheet (one picture every 15 s) plus a **silence map** of the audio show where the welcome, each part, Reading and the results are |
| 3 | Write down the audio | **Whisper** (speech-to-text, runs on your PC) turns the Chinese audio into text with timestamps |
| 4 | Take frames | One frame every 2 seconds (~400 pictures) |
| 5 | Know which question is on screen when | A script checks the sidebar: the current question is a filled orange circle |
| 6 | Read your answers | Your click leaves an orange outline; a script counts orange pixels on ✓/✗ or A/B/C. A perfect score makes your clicks the answer key. Gaps are filled from audio + picture |
| 7 | Read the Reading section | Sentences, word bank and selections, read from zoomed frames |
| 8 | Cut out every picture | Exact boxes from a pixel grid. Several frames of the same screen are merged, which erases a moving mouse pointer. A parked pointer is painted out. Letter tabs and orange outlines are removed |
| 9 | Write the exam file | `simulation.json`: every question, answer, pinyin with and without tones, picture, and the exact second each question starts |
| 10 | Cut the audio track | From the welcome to the end of listening, with volume levelled |
| 11 | Import it | `node scripts/yct-import.js <folder> <N> --offset --start --intros --end` |
| 12 | Test | Jump the audio to ~20 points and check each screen matches; a perfect sheet must give 200/200; screenshots |
| 13 | Deploy | Commit the data **and the picture/audio folder**, push, confirm live |
| 14 | Remember | Update the notes |

**Tools:** ffmpeg (from your CapCut install), Whisper large-v3, Python (Pillow, NumPy, OpenCV),
headless Edge. Everything is documented in `ClaudeCode/video_tools/yct_capture/README.md`, and each
test has a build folder (`YCT1_Sim1_Build`, `YCT1_Sim2_Build`, `NEWHSK1_Sim1_Build`, `NEWHSK1_Sim2_Build`).

**Limits:**
- **Sharpness:** pictures can only be as sharp as they were on your screen, which is why zoom
  matters.
- **Letter tabs:** where a gray A/B/C label covered a picture, that corner is blank. On New HSK the whole
  answer card is kept and our own letter tab sits exactly over that corner.
- **Audio rights:** the audio and pictures belong to the mock-test site. Using them is your decision
  for your own classes.

**The same method works for New HSK and every other level.** Only the screen layout changes, so the
first test of each new family takes longer, and the rest go faster.

---

## 6. Other ways content gets into the platform

- **Files you upload, with the answer in the name**, e.g. `6C (CORRECT).png` and `1 (FALSE).png`. I
  read the answer key from the file names (Old HSK simulations).
- **Your PDFs and documents**, transcribed into data (HSK1 Guía 01's 150 words, the 100 reading
  sentences, the HSK2 curriculum).
- **Vision helper agents** that look at hundreds of exam pictures and classify them. This sorted the
  Sim Trainer's 400 questions by theme.
- **AI-generated pictures** (Higgsfield) only when you approve it, never for exam pictures.
- **Text-to-speech** for practice audio (never for official tests, which use the real audio).
- **Game questions from your "mother files"** (2026-10-11). A mother file is a PDF with every simulation of a level
  and its answers. From it I build the questions every pin game uses:
  1. Your mother file goes in `Downloads\IMPORTANT DOCUMENTS\CURRICULUM STRUCTURE\…`.
  2. I turn it into game rounds in `core/packs/<level>.js`. Each world gets word rounds, and each simulation becomes its
     own «Simulacro» round with the exam's real words, sentences, dialogues and fill-ins.
  3. Pictures are made on your unlimited Higgsfield, often with the gang in scenes. The brief is
     `content/packs/<level>-pictures.json`.
  4. `scripts/test-packs.js` and `scripts/stress-packs.js` check that every question is clear and that no wrong option is
     secretly right.
  5. Teachers pick a round in `/packs.html` (test → level → world → round), from every game's «Elegir preguntas».
  Done so far: YCT 1, Old HSK 1 and New HSK 1 (2026-10-12: 8 worlds with all 300 official words + 4 «Simulacro» rounds).
  New HSK 1's mother file is made from the platform's own sims (`scripts/packs/make_mother_file.js`), and its Simulacro
  rounds are built straight from `core/yct/newhsk1-sim*.json`: a new sim adds two rounds (Escucha + Lectura) by itself
  once its Spanish lines are in `core/packs/newhsk1-es.json` (the mother-file script lists any that are missing).

---

## 7. My toolbox

| Tool | Used for |
|---|---|
| Reading and searching files | Understanding code before touching it |
| Exact-text editing | Changing one piece without moving anything else |
| Terminal (Bash / PowerShell) | Server, scripts, git, video and audio tools |
| Browser pane | Using the local site as a teacher or kid; reading errors |
| Headless Edge | Full-size screenshots for visual checks |
| ffmpeg (CapCut's copy) | Cutting audio, grabbing frames, finding silences |
| Whisper | Chinese audio → written Chinese |
| Python + Pillow / NumPy / OpenCV | Cropping, pointer removal, reading clicked answers |
| Helper agents | Mapping big code areas in parallel |
| Git + GitHub | Every version saved and undoable |
| Render (via push) | Putting changes live |
| Connectors | Docs (shareable documents), IconScout, DaVinci Resolve, Roblox Studio, Higgsfield (with OK) |
| Memory notes + `CLAUDE.md` | Your rules and the project state, between conversations |

---

## 8. Your standing rules I follow

- **Words:** Spanish UI says **"Chino Mandarín"**, never "Chinese". The brand is **Dralingo**.
- **Official tests:**
  - use the **original exam audio**, never TTS
  - **pinyin without tone marks**
  - a sober official look that **does not copy** the source site
- **Pictures:** **no Higgsfield credits for exam pictures**; crop them from your recordings.
- **Assets:** always **commit the picture and audio folder**. Code alone means a broken exam on
  Render.
- **Translation:** every new Spanish text in `/homework` also goes into the 🌐 English dictionary
  (`hw-i18n.js`).
- **Teachers:** they must **never feel stuck**. Big buttons, a way out (🏠 Llevar a casa).
- **Security choices:** no email verification, no 2FA, 4-character student codes.
- **Secrets and student data** never go into the code or GitHub.

---

## 9. What I need from you, and what I can't do

**I need you for:**
- screen recordings of mock tests (section 5)
- passwords and settings on Render, Google, Cloudflare (I give the exact clicks)
- trying things with real kids and telling me what you saw
- decisions: what to build next, and in what order

**I can't or won't:**
- type real passwords or create accounts
- **hear** audio (I read it through Whisper and check it against the pictures)
- do anything irreversible or public without asking (deleting data, sending messages)

**To get the best results:** say the goal, not just the action. Name a rule once and I'll keep it.
Send recordings rather than descriptions. Tell me how something *feels* ("too childish", "the
intro is long"), and I'll turn it into exact changes.

---

## 10. What's next (pending work)

- **Official tests:**
  - more New HSK 1 simulations (send the next recording), then YCT 2 per the build order
  - move Old HSK onto the new exam interface, once you're happy with YCT
- **Pin games:** a Kahoot-style quiz engine inside the platform, built once and fed by the
  simulations and word sets
- **HSK2:**
  - Bolsa de Palabras experiences 4–8
  - the parents view still labels HSK2 kids as HSK1
  - daily challenges are HSK1-themed for everyone
- **Security Phase 3:** Cloudflare in front of the site
- **Old work to check:** the HSK1 «Viajando por China» and HSK2 Store Roblox worlds have open items
  (they're Dralingo worlds, outside this website)

---

## 11. Timeline: what was built and when

| Month | Versions | Highlights |
|---|---|---|
| **May 2026** | 198 | The platform is born: Mochi Mash, then 15+ game modes, avatars, music, reconnection, the Warm-up sentence builder, Lectura, the homework portal, parents view, Google voice, multi-teacher dashboard, report cards, Emirati gateway, Desafíos del Día |
| **June 2026** | 113 | Old HSK 1 Simulations 1–10 as PIN rooms with live monitor and results, mistake review for kids and parents, Cuaderno, push sentences and lesson packs, classrooms, Llevar a casa, security phases 1–2 |
| **July 2026** | 12 | Simulation 10, sentence-practice sheet 31–40, Emirati local track with real Arabic and audio |
| **September 2026** | 6 | HSK levels by access code, HSK2 Bolsa de Palabras, Sim Trainer v1–v2, teacher levels and accounts, 🌐 ES→EN toggle |
| **October 2026** | 4+ | Official Tests folders, YCT1 Simulations 1–2 on the new exam interface, built from screen recordings; the game question packs rebuilt from the mother files (YCT 1 + Old HSK 1, 47 rounds, clear questions, Higgsfield pictures with the gang); New HSK 1 mother file + 35 game rounds; YCT mode across the platform (code 1003, YCT tareas from the game rounds, level picker per code, sentence practice in YCT / New HSK / Old HSK folders); one join screen (the home card) |

---

## 12. Glossary

| Word | Meaning |
|---|---|
| **Commit** | A saved version of the code with a note explaining it |
| **Push** | Sending saved versions to GitHub; Render then updates the live site |
| **Render** | The company whose computers run the website |
| **Local / localhost** | A private copy of the site on your PC, for testing |
| **Endpoint / API route** | One "door" of the server, e.g. `/api/hsk-sim/list` returns the list of exams |
| **Socket** | The live connection that keeps PIN games in sync |
| **PIN room** | A live session the teacher opens; kids join with the PIN |
| **Payload** | What's sent to a kid's screen. For exams the answers are removed |
| **Heartbeat** | An "I'm still here" signal every 8 s; it powers the live monitor and Llevar a casa |
| **Harness / debug mode** | Hidden test switches that jump anywhere in a page |
| **Transcript** | The written text of what the audio says |
| **Whisper** | The speech-to-text program that runs on your PC |
| **ffmpeg** | The video and audio tool that cuts, converts and extracts frames |
| **Frame** | One still picture from a video |
| **Memory / CLAUDE.md** | My notes and the platform's rule file, kept between conversations |
