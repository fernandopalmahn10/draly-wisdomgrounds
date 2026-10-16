# Draly Wisdom Grounds · platform rules

Node web app (`server.js`, `core/`, `public/`), deployed on Render from this repo (`draly-wisdomgrounds-2.onrender.com`), served to the world through Cloudflare at **https://app.dralingo.app** (since 2026-10-12; `dralingo.app` too).
Its own git repo. Teachers use `/maestro`; kids join rooms with a PIN; homework portal at `/homework`.
Game modes live side by side (`public/host-*.html`, catalogue in `docs/GAME_MODES.md`); "Mochi Mash" is just the first
game, the platform is Draly Wisdom Grounds with Dralingo as host. Agreed-but-unbuilt features: `TODO-QUEUED.md`.
Security procedures: `SECURITY-SOP.md`. The full plain-language map of the platform and the work method (7-step loop,
recording → official test pipeline, toolbox, pending work) is `docs/HOW_CLAUDE_WORKS.md`: keep it current when features ship. Engagement patterns that worked: memory `project_engagement_patterns` — use it as
the checklist for any new game mode.

## Always
- **Media must be in git**: Render serves only what is committed. After adding any asset-backed feature (images, audio
  under `public/assets/…`, sim media under `protected/…`) run `git status --short` / `git ls-files "<asset dir>" | wc -l`
  and confirm the media is staged before saying it is live. On-disk ≠ deployed.
- **i18n**: `/homework` has an ES→EN toggle driven by a dictionary (`public/js/hw-i18n.js`, `var DICT =`). Every new
  student-facing Spanish string must be added there (and bump its `?v=` in homework.html) or it stays Spanish in EN mode.
  Lines built from a template (e.g. `'Hoy: {theme}.'`) need a regex entry in `DICT.patterns` (2026-10-11: the daily-story
  lines shipped without one).
- **Deploy** with the `deploy-platform` skill (tests → exact staging → commit → push → wait until live → live check).
- **Always ask him "is a class running right now?" before every deploy** (his rule 2026-10-12: "it's great that you
  asked… yes, there is, but I forgot. Always ask me"). A deploy drops the site for ~1 minute and every live room.
  Also check the live `/api/_diag` `rooms`; if a class is on, push only after it ends (rooms back to 0).
- Never commit secrets (`.render-token`, credentials JSON, `data/*` runtime files with student data).
- **Home-screen app (PWA, since 2026-10-12)**: `public/manifest.webmanifest` + `public/sw.js` + `public/js/pwa.js`,
  icons in `public/assets/app/` (made by `../video_tools/app_icon.py` from the green-screen Dralingo original). The
  service worker caches NOTHING but its offline page: never add caching of pages, `/api` or game files (a cached page
  shows a class stale content and sticks on phones). If it ever misbehaves, replace sw.js with one that calls
  `self.registration.unregister()` and deploy. A new page families open gets the same head tags + `pwa.js` (copy them
  from index.html); `[data-pwa-install]` on any element makes it the «Instalar la app» button. iPhone home-screen
  apps keep their own storage: the install sheet shows the kid's codes to type once. Notifications: sw.js shows them
  and `DralyPWA.enableNotifications(publicKey)` subscribes; sending needs server keys (VAPID) + a sender — not built.
- **Inactive accounts are archived, never deleted** (his rule 2026-10-12: "delete every account not active for 30
  days" → archive with auto-restore, his choice). Every day the server moves accounts with no activity for 30 days
  (max of lastSeen / firstSeen / restoredAt) into `data/student-archive.json`; `get()`, `getOrCreate()` and
  `getOrProvisionForPin()` bring one back the moment its code is used (kid login, PIN join, parent link). Any new code
  that looks a kid up by code goes through those three, never `listAll()` or the records map; boot migrations don't
  touch the archive (repeat them in `restoreArchived` when they matter). `node scripts/test-archive.js` must pass.
  Deleting the archive for good is his call alone.
- **Boot-time migrations only fill what is missing** (load() in core/*.js runs on every deploy and Render wake-up):
  never force a value a teacher can change in /maestro. 2026-10-12 the review caught two that reset code levels on
  every boot (1002, Ms Han) the day levels became editable. Use "if missing" or a one-shot flag on the record.
- **Deleting a CSS/JS file?** First list every class/selector it defines and grep the remaining pages for them; shared
  rules hide in game files (2026-10-10: the avatar picker, timer pulse and music chip lived in zombie/triage/color-clash
  css and broke every lobby). Bot playtests can't see styling: also screenshot a lobby + question screen.
- **/maestro (remade 2026-10-13, `docs/specs/maestro-remake.md`)** loads only `css/teacher-dashboard.css` (style new
  dashboard parts there; `maestro.css` now serves `host-hsk.html` only). Messages use `notify()` toasts, never
  `alert()`; new windows are `.m-modal` + `.m-modal-card` (Esc, focus and scroll lock come for free); the start
  actions stay at the top, nothing class-critical goes deeper than 2 taps.
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
- **Only our own saga, never brand characters** (his direction 2026-10-12: "change everything we can find trouble with,
  with our own saga characters"): no Gojo, Pikachu, Mario, Elsa, CR7… in avatars, animations, bursts, stories or
  celebrations. One list feeds every roster: `public/js/saga.js` (ANIMS for the warm-up / reading / HSK trays and
  «GIF to students», BURSTS for the cast quick effects, AVATARS + LEGACY_AVATARS for /homework); the server reads the
  same file. Add a new character there (art in `public/assets/saga/`, made with the `higgsfield-art` skill). Any page
  that shows a kid's avatar uses `Saga.avatarUrl()` (2026-10-12 the review found a 6th hand-written avatar renderer in
  the warm-up Cuaderno still building `/assets/avatars/<name>.svg`).
- **Avatar pickers offer only our roster** (his direction 2026-10-12: "remove all options of characters that are not of
  our roster, they subtract value to our presentation"): the saga avatars only (no DiceBear robots/kids/emoji); kids
  who had one show a saga avatar instead (Saga.avatarUrl maps every old name).
- **Alive, randomized, not overdone** (his direction 2026-10-12: "always use all the assets you have to randomize
  things… so it feels like something is interacting with you; if it's plain it gets boring; we do not need to overdo
  it"): every screen kids land on (home, homework login, lobbies, waiting screens) draws on the whole library (Dralingo
  animations and stickers, the cast and their lines, the saga animals, the Dubai skyline) and picks a different mix on
  each visit or every few seconds. One or two moving things at a time, never covering what the kid must tap, with
  `prefers-reduced-motion` respected and a still first frame on pages a whole class opens at once.
- **Removing or renaming something kids saw** (a character, a story, a tarea): student records keep copies of it
  (stored avatar ids, reading-test titles and questions, inbox messages with old URLs). Fix those too in the same
  change: a one-shot `load()` migration that only touches the old values, or a filter where they are shown. 2026-10-12
  saved «Lǎoshī Yugi» results and brand-GIF inbox messages would still have shown after the rename.
- **Pictures with the franchise** (his direction 2026-10-11: "the point is to make toys … irresistible, put them
  everywhere"): question pictures use the glossy 3D toy look and often show the gang (Dralingo in his platform look, Profe
  Fer, Hamdan, Latifa, Aileen, Adric + his dog) in scenes from that world's episode (`claude-setup/cast.md`). No picture
  where it would need digits or text (clocks, calendars): those questions stay text-only. Counts (numbers) are composited
  from one sticker so the count is exact.
- **No outside AI pictures** (since 2026-10-11): a question without its own `/assets/…` picture shows none
  (`core/images.js`); never bring back image.pollinations.ai or any generator that draws at runtime (random pictures,
  watermarks). The 9 old uploaded sets (`seed-sets/`) have no pictures and still show hanzi + tone marks in their
  questions: rebuild them as curriculum packs before using them with kids.
- **Keep the site light** (his ask 2026-10-12: "if I keep adding games and assets, are we gonna hit a limit?"). Games
  are cheap (code + sounds 1-3 MB each); media is what grows. Still pictures WebP under ~300 KB (720-1200 px, quality
  ~82), animations under 2 MB, sounds mp3 under 2 MB (exam recordings exempt), no file over 10 MB, never BMP/TIFF/WAV.
  Never deploy source or working files (3D .glb sources, full-size originals, transcription notes, answer keys):
  originals go in `assets-library/`. `node scripts/asset-guard.js` before every commit with media (exit 1 = fix it).
- **Platform health, monthly** (his ask 2026-10-12): `node scripts/health-check.js` reads Render (memory, CPU,
  downloads, data disk), the live `/api/_diag` and this repo; limits memory 70 %, CPU 60 %, student file 20 MB,
  disk 30 %, media 1 GB, any file 10 MB, a page 1 MB compressed, downloads 25 GB/month. Over a limit = act (bigger
  server, database, lighter media) and tell him. Reports in `../reports/platform-health/`. Render facts: one Starter
  server (0.5 CPU, 512 MB) on the Hobby workspace; Render already serves through Cloudflare (compressed); the 1 GB data
  disk is why deploys have a ~1 min gap and why we can't run two instances. Only one paid service should be running.
- **Cloudflare (his account, since 2026-10-12)**: `dralingo.app` (Free plan) → CNAMEs `app`, `@`, `www` proxied to
  `draly-wisdomgrounds-2.onrender.com`, SSL Full (strict), HTTPS always, TLS 1.2+, WebSockets on. Cache rule: `/assets/*`
  kept at Cloudflare 2 h (a picture replaced under the SAME name shows up within 2 h: give new art a new name or
  `?v=`). Rate limit: 400 `/api/` requests per 10 s per connection (a whole class shares one school IP: never lower
  it below class size × requests per page). API token in `~/.dralingo/cloudflare-token.txt` (zone dralingo.app only;
  never print it). Kids' saved student codes live per address (localStorage): never send kids to a new address
  without a step that carries their code over, or they create duplicate accounts. Since 2026-10-12 page loads on the
  old Render address carry the phone's saved data over once and land on app.dralingo.app (server.js `MOVE_PAGE` →
  `MOVE_ARRIVE_PAGE` at /move.html: small values in the URL fragment, big or secret ones through a one-time token,
  stays on the old address if that fails; accepted only with the old address as referrer). Not moved: API calls,
  sockets, files, `/host-*.html`, `?autohost|livemaster|livegame|nomove`. A new localStorage key must start with
  `draly`, `mochi.`, `hw_`, `em_` or `wu_` to travel.
- Asset packs (Kenney etc.) live in `C:\Users\ferpa\ClaudeCode\assets-library\` (not in git, never served). Copy only
  the files a game uses into `public/assets/<game>/` and commit those; never commit a whole pack or an installer.
- Spanish UI first; "Chino Mandarín"; big buttons, kid-friendly feedback; encouragement at the screen edge, never blocking play.

## Three levels of preparation per module (his plan 2026-10-15)
- Every module (YCT 1, New HSK 1, HSK 1, …) is prepared in three levels, with our own names: **La Base** (the
  vocabulary book digitally: every word + sentence with audio) → **El Entrenamiento** (exam-style practice world by world,
  from the curriculum packs, with audio and instant feedback) → **El Simulacro Dorado** (the full simulations, plus their
  golden book and its audio).
- **Nothing of a module is free: a secret key per level opens all three levels** (his decision 2026-10-15, replacing
  "La Base free": "we are a premium company, it looks bad if everything is free"; and the short class codes 1001-1003 can
  be guessed, so a login alone does not prove a real student). One key per level of core/levels.js (future levels
  automatically), a word + a number (e.g. DRAGON-47), set and changed by him in /maestro → Teachers → «Claves de nivel»
  (masked, «Ver», «Cambiar», «Copiar mensaje para WhatsApp», «Cerrar en todos los aparatos»), never written in the repo,
  a log line or chat: only `data/level-keys.json` on the data disk (gitignored). He sets the keys himself (Claude
  guides, never chooses or writes them). Built in `core/level-keys.js`: compared ignoring case, spaces, dashes and
  accents; a key needs a word of 4+ letters and a number of 2+ digits, each level its own, never the screen's example
  PANDA-12. The kid types it ONCE on the key screen (`protected/pages/level-key.html`, served by the server in place of
  whatever is locked, never cached; it first tries the codes the phone saved): that device keeps the level a year
  (httpOnly cookie `dlv_<level>`), and when the kid is logged in at /homework it is also saved on their account
  (`levelAccess`: their next login opens it on any phone). Wrong guesses: 5 per device + 30 per address in 15 min,
  then a wait with a kind message. A key change stops the old key for new devices; devices and accounts that opened the
  level keep it (no family retypes); «Cerrar en todos los aparatos» (for a key that leaked) ends every device of a level and
  every key saved on an account (they type the new key once); grandfathered and «Desbloquear» accounts keep it.
  The key screen must stay beautiful and very easy to read and use (his words: "parents get lost with something hard to
  use"): books' palette, Dralingo in his platform look, one big field, «Entrar», plain-language errors, 360 px, reduced
  motion; `css/key-screen.css` is shared with the teacher-key screen.
- **One question for every locked level**: `LevelKeys.access(req, level)` (server.js `levelAccess`) answers "may this
  request use level X?" (a teacher device or code · the logged-in kid's account · this device's key). La Base and the
  sims use it; El Entrenamiento and the golden book must use it too, never a check of their own.
- **Kids registered before the keys went live keep their level without typing it**; only new accounts need the key. The
  keys go live the moment the FIRST key is set (`goLiveAt`, recorded once, shown in the panel); an account created
  before (firstSeen; archived ones too) keeps its class level once the kid logs in at /homework WITH THEIR OWN CLASS
  CODE (stamped `grandfathered` on the account). A login with another class's code still does homework as always (it
  re-tags the kid: that is how kids move up) but opens nothing of the keys (no session, no level: from outside it looks
  like a stranger trying codes, and it counts as a guess). A kid who moves to another level after the go-live needs that
  level's key (Students.setLevel dates `levelSince`); the old level stays theirs if it was stamped at an earlier login.
  A teacher opens any kid early with «Desbloquear» in the kid's profile. /homework pauses an address after 60 unknown
  student codes in 10 min, and the whole platform after 600 in an hour (a login opens the account's levels, so codes
  must not be found by trying). Key screen limits, exam-PIN guesses (HTTP and socket `player:join`), the admin
  turnstile and these all count per address with `_clientIp`: CF-Connecting-IP only when the hop that reached the
  server is Cloudflare (else the last X-Forwarded-For entry), IPv6 per /64. A code retired by «Cambiar mi código» is
  refused but never counted, and a remembered teacher device is never locked out by its school's address.
- **Open on purpose**: the HSK 1 trainer in /homework (built from the Old HSK 1 sims) still answers any HSK 1 class
  code, because homework stays as it is; El Entrenamiento (phase 4) replaces it behind the key.
- **In class, no key for kids**: a kid in a teacher's live room (PIN) takes what the teacher launches (the room pass).
  **Creating a game (hosting) needs the teacher's key the first time on that device**, then THAT DEVICE is remembered
  (~90 days; his words: "maestros crear un juego needs first time key access, then it's safe"): socket `host:create`
  needs the httpOnly cookie `dtd` (signed teacher uid + codeGen) from a /maestro login or from the teacher-key screen
  (`js/teacher-gate.js`, loaded right after `/socket.io/socket.io.js` on EVERY host page: a new host page loads it too),
  or the teacher code in `password` (bots and test scripts: `--password`). Never trust by internet address: a school's
  Wi-Fi gives every kid's phone the same address. «Log out» in /maestro forgets the device.
- **Teacher codes**: «Cambiar mi código» in /maestro for every teacher (the super admin also changes others'): the old
  code stops at once, is retired for good (`data/teachers-meta.json`), devices remembered with it ask again. The boot
  seed creates a super admin only on the very first boot of an empty disk, never again (one-shot flag), and never with
  a code written in the source. Teacher codes never reach a kid's phone (inbox, special assignments, sentences) or a log
  line. The legacy password is the `WU_ADMIN_PASSWORD` env var only (no default in the code: unset = none).
- **Homework (/homework) stays as it is** (class code + the kid's name or code), and so do its audio pages
  (`/audios/<homework id>`, linked from the printed PDFs).
- **The simulations are never open to anonymous visitors** (his words: "we're not going to give away everything for
  free"): the Simulacro Dorado (player, golden book, audio) like the other levels needs the level's key; teachers still
  launch simulations from /maestro.
- **Levels unlock by progress, like a game**: Entrenamiento after enough «¡Me la sé!» seals in La Base, the Simulacro
  Dorado after enough practice in Entrenamiento; a teacher can unlock any kid early from /maestro.
- **The simulations' audio = a digital golden book**: the golden book on screen page by page, each listening question
  with its own play button (the original exam recording, cut per question), plus the PDF to download.
- The whole tab is **«La Ruta Dorada»** (was «Audios y vocabulario»). Choosing your module feels like a game: a swipe
  between modules with a super cool animation.
- `node scripts/test-level-keys.js` (its own server on port 4300 and a fresh data folder) and
  `node scripts/test-sims-lock.js` must pass.

## Levels: YCT mode everywhere (his direction 2026-10-12)
- "The whole platform has to have YCT mode": every place that checks, picks or shows a student's level reads
  `core/levels.js` (yct1 · hsk2 = New HSK 1, its stored id · hsk1 = Old HSK 1). Never hardcode `'hsk1'`/`'hsk2'`
  pairs again; a new level (YCT 2, New HSK 2…) is one entry there plus its game pack.
- The level lives on the access code: 1001 Old HSK 1, 1002 New HSK 1, 1003 YCT 1 (all three on the super admin). Teachers change a code's
  level or add a code in /maestro → Teachers. Kids/parents see "YCT 1" / "New HSK 1" / "HSK 1", never "HSK2".
- A level with `packTareas` gets its /homework tareas from its curriculum game rounds (one folder per world, played in
  the trainer's quiz player, graded on the server). YCT 1 uses it; New HSK 1 / Old HSK 1 can switch on with one flag.
  Desafíos are HSK 1 words: hidden for YCT 1 kids (above their level).
- Teacher-side exam content is organized like Official Tests: test family (YCT / New HSK / Old HSK) → level → item
  (his ask 2026-10-12 for sentence practice). Any new teacher list of sims/sentences follows the same folders.

## Official tests (YCT · HSK · New HSK simulations)
- Faithful to the real exam: same flow, timing, scoring (YCT /200, pass 120), the ORIGINAL recorded exam audio (not TTS).
  Sober official look (petrol ink #0f2f33, seal red #9e2a2b, paper bg, Source Sans 3), not kiddy, not a copy of HSK Mock's style.
- **Locked: never open to anonymous visitors** (La Ruta Dorada phase 1, 2026-10-15; his words "we're not going to give
  away everything for free"): pages, data AND files. The files live in `protected/<TEST> SIMULATIONS/…`, the player
  pages in `protected/pages/` (`yct-sim.html`, `hsk-sim.html`; refusals get the level's key screen `level-key.html`); none of it under
  `public/`, and never under `/assets/` (Cloudflare keeps `/assets/*` 2 h). The sim data keeps its media as logical
  `/assets/<TEST>%20SIMULATIONS/…` URLs; `core/sim-lock.js` rewrites them in every payload into
  `/sim-media/<token>/<fileId>` (signed, 3 h, ONE sim, `private, no-store`; a room PIN's links die when the room closes;
  file ids hide the old «(CORRECT)» names). Who gets in (`_simGrant` in server.js): a teacher (/maestro code in X-Admin-Pw,
  or a remembered teacher device); a kid who JOINED a teacher's open exam room (socket `player:join` answers with a room
  pass, so they are on the teacher's roster; a bare PIN loads nothing), for THAT room's sim (opening, taking over or
  closing a room needs the teacher code, «Terminar sala» = socket `host:end`; 60 never-used PINs from one address in
  10 min pause its room lookups); whoever may use the sim's level (`levelAccess`, § Three levels: the level's key on
  this device or on the logged-in kid's account, «Desbloquear», grandfathered), solo by link (`/yct-sim.html?sim=…`);
  the local harness `?debug=1&direct=1` on localhost only. Everyone else: the level's key screen («Entra a Mis Tareas»
  = `/homework.html?next=…` comes back to the exam). A teacher's try is graded, never saved; a solo grade goes on the
  logged-in kid's own record (a key-only phone: only when it sends the kid's class code + student code, else graded and
  not saved); the payload's `ticket` still hands in after the room closed. Key: env `SIM_LOCK_SECRET`, else `data/sim-lock.key` (made once
  on the disk, gitignored). Any new page or endpoint that shows sim content goes through `_simGrant` + `SimLock.rewrite`;
  `node scripts/test-sims-lock.js` (starts its own server on 4000) must pass. The «Simulacro del examen» pack rounds show
  only their name to non-teachers on `/api/sets`.
- Pipeline per sim: his screen recording of a full run (Videos/Captures) → build package folder `<TEST>_SimN_Build/`
  (simulation.json + images + its own CLAUDE.md) → cut audio with ffmpeg (aac .m4a) → `node scripts/yct-import.js <buildDir> <N>
  --start s --intros a,b,c,d --end e` → `core/yct/…json` + `protected/<TEST> SIMULATIONS/…` (locked; the JSON keeps the
  `/assets/…` form) → commit the protected folder too (`git ls-files "protected/<TEST> SIMULATIONS" | wc -l`). Old HSK
  sims (core/hsk-sim.js) the same: `/assets/HSK%20SIMULATIONS/…` in the code, the files in `protected/HSK SIMULATIONS/`.
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
- Pinyin without tone marks in tests. Test harness: `yct-sim.html?debug=1&direct=1&sim=…&view=…` (no room needed, opens
  on localhost only: `SimLock.isLocalDev`); headless Edge screenshots. A logged-in look: `/api/homework/enter` on the
  local server gives the session cookie.
- /maestro → "Official Tests" → test family → level → sims. Every new test reuses the YCT interface structure
  (cover, audio-driven listening, review, timed reading, gauge results) with that exam's real flow.
- **Build order (his decision 2026-10-08):** YCT 1 → New HSK 1 → YCT 2 → New HSK 2 → YCT 3 → New HSK 3 → … (alternate,
  one level up each time). Finish all sims of a level before moving on unless he says otherwise. Old HSK sims already exist
  in `hsk-sim.html`.

## Homework audio (/audios, since 2026-10-11) · «Audios y vocabulario» (folders since 2026-10-14)
- `/audios` is a library of level folders (`/audios/yct1`, `/audios/newhsk1`, `/audios/hsk1`; names and order from
  `core/levels.js`, written into `catalog.json` `levels` by the builder). A level's vocabulary base is pinned first in its
  folder, then its homework audios. Old addresses never change: the printed PDFs link `/audios/<homework id>`,
  `hsk2-…` opens `newhsk1-…` (and `/audios/hsk2` the New HSK 1 folder), `/audio/…` and `?t=<id>` still work.
- **La base · Empieza aquí** (`/audios/<level>-base`: `yct1-base` 83 words, `hsk1-base` 150 words, `newhsk1-base`
  300 words; worlds `#mundo-N`, `#tonos`, `#repaso`, words `#palabra-N`): a level's study book («YCT 1 · Vocabulario»,
  «HSK 1 · Vocabulario», «New HSK 1 · Vocabulario») digitally (his ask 2026-10-14: the first thing the level's kids
  do). The base takes the curriculum name (`newhsk1-base`, never `hsk2-base`; `/audios/hsk2-base` still opens it
  through the alias) while core/levels.js keeps the stored id `hsk2`. One page code for every level:
  `js/audios-base.js` reads only the level's data (no word looked up by its pinyin; the line under the tones is the
  book's own `toneNoteText`, `{braces}` = pinyin, its examples with a clip are buttons; none where the book has none,
  like HSK 1). One source of words: `../study/lib/web.py <level>` exports the book's own words, sentences, red words,
  tones and pictures (WebP <= 60 KB) + the PDF (web.py writes `public/assets/study/<level>-vocabulario.pdf`; the builder
  MOVES it to `protected/study/`; a book over 9 MB gets a
  lighter web copy from `../study/lib/webpdf.py`, pictures re-encoded at full chroma) into
  `content/audios/<level>-base.json`; the hanzi the voice reads live in `../study/<level>/voice.py` (never on screen).
  Then `node scripts/audios-build.js <level>-base` (one clip per word, per sentence and per Dralingo bubble, page data
  `base.json`, all in `protected/base/<level>-base/`) and `node scripts/test-audios-base.js` (every base named in
  core/levels.js `base`: its words in the book's order, card by card against `../study/<level>/build/book.html`, every
  clip > 0.3 s, no hanzi, no em dash). A new level's base = `base` in core/levels.js + its voice.py + those two steps.
  Readings: `<whisper python> ../study/lib/readings.py <level>` (pypinyin, the pitch of one-syllable words, one Whisper
  batch on the processor, words re-heard after «Wǒ shuō», score_lines on the rest); fix a wrong reading in voice.py,
  never in the page. Page: `js/audios-base.js` + the `bs-` rules in
  `css/audios.css`; seals saved per phone in `localStorage draly_base_<level>` (the move bridge carries it); the
  /homework home links it for levels with `base` in core/levels.js (`#pt-base`, server sends `base` on enter, read from
  the catalog; `?from=homework` turns the page's back arrow into «Volver a mis tareas»).
- **La Base is behind its level's key** (2026-10-15, § Three levels): its files live in `protected/base/<level>-base/` and
  `protected/study/` (never `public/`; the old `/assets/audios/<level>-base/…` and `/assets/study/…` answer 404) and travel
  only as `/base-media/<base id>/<file>` (`book.pdf` = the PDF), checked on every file with `levelAccess`, `private`
  + `Cloudflare-CDN-Cache-Control: no-store` (never kept by Cloudflare; the phone keeps clips a week). `/audios/<level>-base`
  shows the key screen to whoever may not use the level; the library draws a gold lock seal on those bases
  (`/api/level-access`). Commit `protected/base/<id>/` + `protected/study/` with the catalog.
- The builder stamps every base clip, picture and the PDF with `?v=<content hash>`, and the page asks for catalog.json /
  base.json with a 10-minute stamp (Cloudflare keeps the public `/assets/*`, catalog included, 2 h). A clip rebuilt
  under the same name still reaches phones at once; never strip those stamps.
- Type code of the books on the whole page: Gelasio = pinyin only, Noto Sans = Spanish and numbers, self-hosted subset
  woff2 in `public/assets/fonts/study/` (OFL). Cover thumbnails `cover-s.webp` are made by the builder.
- Every homework PDF (storybook guide) has its audio on the public page `/audios/<id>` (open, no key: homework stays as it is) (id `hsk1-e03-r1` from
  `DRALINGO_HSK1_E03_R1_…pdf`): no login, two taps, Spanish, pinyin WITH tone marks and Spanish exactly as in the PDF,
  never hanzi on screen. Same paper look as the PDFs (Rojo Imperial, Oro, Crema, serif pinyin) so parents recognise it.
- Three tracks per PDF with the PDF's own codes (EXP3.1 words · EXP3.2 dialogue · EXP3.3 the six video lines); built by
  `scripts/audios-build.js` from `content/audios/<id>.json` with the platform's Google voices (words + PROFE = Wavenet-A,
  TÚ = Wavenet-D). Fix a wrong reading in the JSON's `zh`, then rebuild that id.
- New PDFs arrive in `../TAREAS/` (Cowork copies them there); a SessionStart hook lists any without audio. Build them
  with the `tarea-audio` skill. TAREAS also holds kids' videos: never open, copy, commit or upload them.
- Commit `content/audios/<id>.json`, `public/assets/audios/<id>/` and `public/assets/audios/catalog.json` together.
  From a worktree, `node scripts/audios-build.js <id> --cache <main checkout>/content/audios/.cache` reuses the voices.
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
  `paint`), Batalla de Nieve en Ski Dubái (new 2026-10-12, `snow`), La Gran Fuga de Dubái
  (new 2026-10-13, `escape`), «Ojos de Halcón» (new 2026-10-13, `halcon`: Super Mario Party «Looking for Love» played
  in boards of 4, the first of his Mario Party series, one minigame at a time from
  https://www.youtube.com/watch?v=y9BKCVx_mNk; it replaced the first attempt «Ojo de Halcón», `look`, retired and
  removed 2026-10-14, his decision; recover it from git commit 83dbcbd04 if ever needed) + the 5 kept games Mochi Mash
  (remade 2026-10-14 as «La Terraza del Mochi», Fuego vs Mar feed their Dragoncitos, Mario Party ceremony; Panda vs Kitsune
  retired), Dàfùwēng · Monopolio Chino, 6-7 Swing (remade 2026-10-15 as «La Balanza de Oro»: rapid-fire sums that are always
  6 or 7, digits or pinyin, two giant buttons «6 · liu» / «7 · qi», Fuego vs Mar fill a golden balance, Dralingo does the 6-7;
  the blocky meme figure retired), Vuelo del Dragón, Piñata Tigre (remade 2026-10-15 as «La Fiesta de las
  Piñatas»: Fuego vs Mar break a ladder of tiger piñatas, every right answer a hit with a server-judged timing meter;
  Bastón vs Arco retired) (plus the class tools Warm-up, Lectura, HSK/YCT rooms); 11 older games were retired to free room.
  The 5 kept games each get a full overhaul ("second run"); new games replace the retired ones. Quality over quantity:
  retire a game rather than keep a half-optimized one.
- **The kid's phone is the product** (his correction 2026-10-11: "a beautiful projector is useless if everybody else's
  UI is terrible"). Every game ships a phone experience that feels like a competition, better than Kahoot: big colored
  answer tiles, a per-question timer with ticking, live team score, Dralingo pose reactions (right / wrong / streak /
  win / lose), recorded music + sound effects (no synthesized beeps), pictures made for each question.
- **Game-show moments on every phone, not only the projector** (his direction 2026-10-13, about the Reinos de Colores
  VS intro: "that's what makes me feel like I'm living in a video game like Nintendo… more of these should be on the
  kids' screens, not just the host's"). Every moment the projector stages (captains VS intro with the red/blue split,
  the big 3-2-1, landmark captures, half-time/last-minute alarms, the winner reveal) also plays on each phone in a
  phone-sized version, with the kid's own team colour, avatar and captain ("¡Tú eres del Reino del Fuego!"). Short
  (≤ 2.5 s), never covering the answer tiles, reduced-motion respected, light enough for cheap phones.
- **Mario Party recreations** (his direction 2026-10-13, after another model's copy "looked nothing like the mini
  game… the teacher screen is useless, the kids' screens are the most important"): when he points at a Mario Party
  minigame (a video + timestamps), watch it and look at its frames, then recreate THAT minigame's structure, flow,
  camera, timing and scoring as exactly as possible, reskinned only with our cast, Dubai and curriculum questions.
  Kids compete as their FULL-BODY characters (never a face crop or round avatar chip in the play area) moving the way
  the video shows; the phone shows the minigame itself (the kid's own character and rivals), not a remote control;
  the projector is secondary. A class plays in boards of 4 like real Mario Party matches (3 when it doesn't divide; one
  board up to 5 kids): each phone shows its own board, the projector shows every board + the class top 3.
- **Feelings at the end of class** (his words 2026-10-14, after playing Ojos de Halcón: "the Mario Party feeling is so
  important because it makes feelings at the end of a class"): every pin game ends with a Mario Party style ceremony,
  not a plain score list: «¡FINAL!», a suspenseful reveal, the winners celebrating and the others reacting, bonus stars
  by category (most fed, fastest, longest streak…), and on every phone the kid's own card (their full character, what
  they contributed, any star). Short, skippable by the teacher, never stuck.
- **Design skills on every kid/teacher screen** (his question 2026-10-13: "have you been using Emil Kowalski, taste and
  impeccable?"): any new or changed screen of the platform or a pin game gets a pass with `emil-design-eng` (motion,
  press feel, timing), `design-taste-frontend` (layout and visual direction) and `impeccable` (critique + polish)
  before it ships, compared side by side with Reinos de Colores. The area's own look always wins (palette, Dralingo
  in his platform look, the cast, Spanish kid UI, big tap targets).
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
- **Every pin game is graded before it ships** (his decision 2026-10-12): `docs/GAME_QUALITY_CHECKLIST.md`, 5 hard
  gates + 7 areas scored 0–2 with evidence. Ships only with all gates passed, no 0 and 12/14 or more; the card goes in
  the deploy report and the game's spec. Below that is work left: say the score and what is missing.
- **One join screen** (his correction 2026-10-12: "ugly leftover interface when joining, poorly designed «Únete»"): kids
  type PIN + name only on the home card «🎮 Entrar al juego» (index.html; the projector's `/?pin=X` link fills the PIN).
  player.html only shows Dralingo «Entrando al juego…» and sends failures back to that card. Never add a second join
  form; delete leftover screens instead of leaving them reachable.
- Build or overhaul any game with the `new-pin-game` skill. Before saying a game works: `node scripts/playtest-bots.js
  --game <type> --bots 20` must PASS (Monopoly is turn-based: waiting kids are expected there), then the
  `classroom-playtester` agent for the real-browser check.
