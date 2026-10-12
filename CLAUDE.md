# Draly Wisdom Grounds · platform rules

Node web app (`server.js`, `core/`, `public/`), deployed on Render from this repo (`draly-wisdomgrounds-2.onrender.com`).
Its own git repo. Teachers use `/maestro`; kids join rooms with a PIN; homework portal at `/homework`.
Game modes live side by side (`public/host-*.html`, catalogue in `docs/GAME_MODES.md`); "Mochi Mash" is just the first
game, the platform is Draly Wisdom Grounds with Dralingo as host. Agreed-but-unbuilt features: `TODO-QUEUED.md`.
Security procedures: `SECURITY-SOP.md`. The full plain-language map of the platform and the work method (7-step loop,
recording → official test pipeline, toolbox, pending work) is `docs/HOW_CLAUDE_WORKS.md`: keep it current when features ship. Engagement patterns that worked: memory `project_engagement_patterns` — use it as
the checklist for any new game mode.

## Always
- **Media must be in git**: Render serves only what is committed. After adding any asset-backed feature (sims, images, audio
  under `public/assets/…`) run `git status --short` / `git ls-files "<asset dir>" | wc -l` and confirm the media is staged
  before saying it is live. On-disk ≠ deployed.
- **i18n**: `/homework` has an ES→EN toggle driven by a dictionary (`public/js/hw-i18n.js`, `var DICT =`). Every new
  student-facing Spanish string must be added there (and bump its `?v=` in homework.html) or it stays Spanish in EN mode.
  Lines built from a template (e.g. `'Hoy: {theme}.'`) need a regex entry in `DICT.patterns` (2026-10-11: the daily-story
  lines shipped without one).
- **Deploy** with the `deploy-platform` skill (tests → exact staging → commit → push → wait until live → live check).
- Never commit secrets (`.render-token`, credentials JSON, `data/*` runtime files with student data).
- **Deleting a CSS/JS file?** First list every class/selector it defines and grep the remaining pages for them; shared
  rules hide in game files (2026-10-10: the avatar picker, timer pulse and music chip lived in zombie/triage/color-clash
  css and broke every lobby). Bot playtests can't see styling: also screenshot a lobby + question screen.
- Question packs follow the curriculum (`core/packs.js` → picker `/packs.html?game=…`): test family → level → world →
  round. Content lives in `core/packs/<level>.js` (words + exam-style items; built into questions by `core/packs.js`).
  Pictures come from Higgsfield (Nano Banana Pro, Unlimited ON) in his Chrome, saved to `assets-library/higgsfield/`,
  web copies in `public/assets/packs/<level>/<world>/`; the brief per level is `content/packs/<level>-pictures.json`.
  Pinyin without tone marks in games. `node scripts/test-packs.js` must pass before a deploy.
- **Every question says exactly what it asks** (his correction 2026-10-11: "who is him? … how are we going to know just by a
  picture? Completely out of context"). Name the word («¿Cómo se dice «hermano mayor» en Chino Mandarín?»), never a bare
  picture with «¿Quién es?»; pronouns go in a scene with the cast («Dralingo saluda a Hamdan: "___ hao!"»). Test-day
  practice comes first: each level has a «Simulacro del examen» world built from his mother file (all the sims of that
  level with answers, `Downloads\IMPORTANT DOCUMENTS\CURRICULUM STRUCTURE\…`). New HSK 1's Simulacro is built from
  `core/yct/newhsk1-sim*.json` itself: a new sim needs only its Spanish lines in `core/packs/newhsk1-es.json`.
- **Pictures with the franchise** (his direction 2026-10-11: "the point is to make toys … irresistible, put them
  everywhere"): question pictures use the glossy 3D toy look and often show the gang (Dralingo in his platform look, Profe
  Fer, Hamdan, Latifa, Aileen, Adric + his dog) in scenes from that world's episode (`claude-setup/cast.md`). No picture
  where it would need digits or text (clocks, calendars): those questions stay text-only. Counts (numbers) are composited
  from one sticker so the count is exact.
- **No outside AI pictures** (since 2026-10-11): a question without its own `/assets/…` picture shows none
  (`core/images.js`); never bring back image.pollinations.ai or any generator that draws at runtime (random pictures,
  watermarks). The 9 old uploaded sets (`seed-sets/`) have no pictures and still show hanzi + tone marks in their
  questions: rebuild them as curriculum packs before using them with kids.
- Asset packs (Kenney etc.) live in `C:\Users\ferpa\ClaudeCode\assets-library\` (not in git, never served). Copy only
  the files a game uses into `public/assets/<game>/` and commit those; never commit a whole pack or an installer.
- Spanish UI first; "Chino Mandarín"; big buttons, kid-friendly feedback; encouragement at the screen edge, never blocking play.

## Levels: YCT mode everywhere (his direction 2026-10-12)
- "The whole platform has to have YCT mode": every place that checks, picks or shows a student's level reads
  `core/levels.js` (yct1 · hsk2 = New HSK 1, its stored id · hsk1 = Old HSK 1). Never hardcode `'hsk1'`/`'hsk2'`
  pairs again; a new level (YCT 2, New HSK 2…) is one entry there plus its game pack.
- The level lives on the access code: 1001 Old HSK 1, 1002 New HSK 1, 1003 YCT 1 (EMAAR2026). Teachers change a code's
  level or add a code in /maestro → Teachers. Kids/parents see "YCT 1" / "New HSK 1" / "HSK 1", never "HSK2".
- A level with `packTareas` gets its /homework tareas from its curriculum game rounds (one folder per world, played in
  the trainer's quiz player, graded on the server). YCT 1 uses it; New HSK 1 / Old HSK 1 can switch on with one flag.
  Desafíos are HSK 1 words: hidden for YCT 1 kids (above their level).
- Teacher-side exam content is organized like Official Tests: test family (YCT / New HSK / Old HSK) → level → item
  (his ask 2026-10-12 for sentence practice). Any new teacher list of sims/sentences follows the same folders.

## Official tests (YCT · HSK · New HSK simulations)
- Faithful to the real exam: same flow, timing, scoring (YCT /200, pass 120), the ORIGINAL recorded exam audio (not TTS).
  Sober official look (petrol ink #0f2f33, seal red #9e2a2b, paper bg, Source Sans 3), not kiddy, not a copy of HSK Mock's style.
- Pipeline per sim: his screen recording of a full run (Videos/Captures) → build package folder `<TEST>_SimN_Build/`
  (simulation.json + images + its own CLAUDE.md) → cut audio with ffmpeg (aac .m4a) → `node scripts/yct-import.js <buildDir> <N>
  --start s --intros a,b,c,d --end e` → `core/yct/…json` + `public/assets/<TEST> SIMULATIONS/…` → commit the asset folder too.
  Picture cropping/transcription tools: `../video_tools/yct_capture/README.md`. Do NOT use Higgsfield for sim pictures —
  crop them from the recording.
- Every listening track ends with the closing line 听力考试现在结束 (`--endline`). If the recording skipped it (review started
  early), append the clean clip `YCT1_Sim1_Build/audio/exam/closing_line.m4a` after the same ~11.5 s pause.
- Exam flow must match the official platform: look back at already-heard questions during listening, "Terminar escucha",
  review with Anterior/Siguiente + "Terminar revisión" (no way back; YCT 2 min, New HSK 5 min), free navigation in Reading,
  submit confirm. Timings come from the sim JSON (`review_seconds`, `time_limit_seconds`): never hardcode minutes in the player.
- **New HSK** (since 2026-10-11) runs on the same player: ids `newhsk<N>-sim<K>`, import with `--level newhsk<N>` (assets in
  `NEW HSK SIMULATIONS/NEW HSK <N>/`). Its pictures are whole answer cards (keep them whole: the player's letter tab covers the
  painted-out original tab), cropped with `../video_tools/yct_capture/newhsk_crop_abc.py` / `newhsk_crop_grid.py` from frames taken BEFORE the answer was clicked
  (a selected card leaks the answer). A new question layout = a new `part.type` case in `public/js/yct-sim.js` `itemHtml`.
- Every answer in a key must be SEEN selected in the recording, never filled in from what the content suggests: when the
  2-s frames miss it (auto-advance, a look-back, a click during the review) scan at full frame rate
  (`../video_tools/yct_capture/README.md` § New HSK 1 Sim 2 lessons). His 200/200 runs make his selections the key.
- Pinyin without tone marks in tests. Test harness: `yct-sim.html?debug=1&direct=1&sim=…&pin=…&view=…`; headless Edge screenshots.
- /maestro → "Official Tests" → test family → level → sims. Every new test reuses the YCT interface structure
  (cover, audio-driven listening, review, timed reading, gauge results) with that exam's real flow.
- **Build order (his decision 2026-10-08):** YCT 1 → New HSK 1 → YCT 2 → New HSK 2 → YCT 3 → New HSK 3 → … (alternate,
  one level up each time). Finish all sims of a level before moving on unless he says otherwise. Old HSK sims already exist
  in `hsk-sim.html`.

## Homework audio (/audios, since 2026-10-11)
- Every homework PDF (storybook guide) has its audio on the public page `/audios/<id>` (id `hsk1-e03-r1` from
  `DRALINGO_HSK1_E03_R1_…pdf`): no login, two taps, Spanish, pinyin WITH tone marks and Spanish exactly as in the PDF,
  never hanzi on screen. Same paper look as the PDFs (Rojo Imperial, Oro, Crema, serif pinyin) so parents recognise it.
- Three tracks per PDF with the PDF's own codes (EXP3.1 words · EXP3.2 dialogue · EXP3.3 the six video lines); built by
  `scripts/audios-build.js` from `content/audios/<id>.json` with the platform's Google voices (words + PROFE = Wavenet-A,
  TÚ = Wavenet-D). Fix a wrong reading in the JSON's `zh`, then rebuild that id.
- New PDFs arrive in `../TAREAS/` (Cowork copies them there); a SessionStart hook lists any without audio. Build them
  with the `tarea-audio` skill. TAREAS also holds kids' videos: never open, copy, commit or upload them.
- Commit `content/audios/<id>.json`, `public/assets/audios/<id>/` and `public/assets/audios/catalog.json` together.
- **Dralingo Dorado** (2026-10-11): about one visit in ten, a golden 3D Dralingo pops up in the corner of /audios
  (`?dorado=1` forces him, `?dorado=0` never). `public/js/golden/dorado.js` + `css/dorado.css` are hand-written; the other
  `js/golden/*.js` files come from `../three/golden-dralingo/ship.mjs`: never edit them here, rebuild there. three.js
  loads from the CDN (import map in audios.html) only when he appears. Silent, corner-only, leaves after 30 s or ×.

## Pin games (Kahoot-style, inside Draly Wisdom Grounds)
- Our own live quiz games: teacher hosts, kids join with a PIN, Kahoot-like pacing (question → answer → leaderboard), with
  Dralingo branding and the engagement patterns. They live in this platform like the other game modes, not as exports.
- Content comes from the same data the platform already holds (sims, sets, curriculum words); build the question engine
  once and reuse it for every test family and level. Old CSV exporters (`scripts/export-sim1-blooket.js`) stay as extras.
- This is a large, multi-feature codebase: before adding a mode, read `docs/GAME_MODES.md` and reuse existing room/PIN/
  heartbeat plumbing instead of building parallel systems.
- **Game roster (his decision 2026-10-10):** Reinos de Colores (new, `kingdoms`), Dragones Pintores (new 2026-10-11,
  `paint`) + the 5 kept games Mochi Mash, Dàfùwēng ·
  Monopolio Chino, 6-7 Swing, Vuelo del Dragón, Piñata Tigre (plus the class tools Warm-up, Lectura, HSK/YCT rooms); 11 older
  games were retired to free room.
  The 5 kept games each get a full overhaul ("second run"); new games replace the retired ones. Quality over quantity:
  retire a game rather than keep a half-optimized one.
- **The kid's phone is the product** (his correction 2026-10-11: "a beautiful projector is useless if everybody else's
  UI is terrible"). Every game ships a phone experience that feels like a competition, better than Kahoot: big colored
  answer tiles, a per-question timer with ticking, live team score, Dralingo pose reactions (right / wrong / streak /
  win / lose), recorded music + sound effects (no synthesized beeps), pictures made for each question.
- **Kids don't read instructions** (his correction 2026-10-11: "kids don't understand, so they start asking questions").
  Every mechanic must explain itself on the phone: a first-play card with 3 big pictured steps, and whenever a kid is
  blocked (out of energy/fire, waiting for a turn) a big full-width prompt with Dralingo that says exactly what to tap
  ("¡Sin fuego! Responde una pregunta para volar"). Bigger buttons, fewer words, the action named on the button.
- **Team colours on the characters** (his note 2026-10-11): in team games every kid's character wears its team colour
  (Fuego = red Dralingo, Mar = blue Dralingo) on the phone and on the projector, not only the tiles and scores.
- **Quality bar = Reinos de Colores** (his words 2026-10-11, after the Dubai upgrade: "like playing a Nintendo Switch game…
  so premium. The landmarks, the touches, the feedback, the excitement"). Every new game and every overhaul is designed to
  that level: a themed world with real landmarks (not a plain board), a physical-feeling response to every tap (press,
  bounce, sound), feedback for every right/wrong/streak/capture, and rising excitement toward the end (final countdown,
  big reveals, a celebrated winner). Before calling a game done, compare it side by side with Reinos de Colores.
- **One join screen** (his correction 2026-10-12: "ugly leftover interface when joining, poorly designed «Únete»"): kids
  type PIN + name only on the home card «🎮 Entrar al juego» (index.html; the projector's `/?pin=X` link fills the PIN).
  player.html only shows Dralingo «Entrando al juego…» and sends failures back to that card. Never add a second join
  form; delete leftover screens instead of leaving them reachable.
- Build or overhaul any game with the `new-pin-game` skill. Before saying a game works: `node scripts/playtest-bots.js
  --game <type> --bots 20` must PASS (Monopoly is turn-based: waiting kids are expected there), then the
  `classroom-playtester` agent for the real-browser check.
