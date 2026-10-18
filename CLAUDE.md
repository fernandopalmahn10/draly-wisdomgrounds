# Draly Wisdom Grounds · platform rules

Node web app (`server.js`, `core/`, `public/`), deployed on Render from this repo (`draly-wisdomgrounds-2.onrender.com`), served to the world through Cloudflare at **https://app.dralingo.app** (since 2026-10-12; `dralingo.app` too).
Its own git repo. Teachers use `/maestro`; kids join rooms with a PIN; homework portal at `/homework`.
Game modes live side by side (`public/host-*.html`, catalogue in `docs/GAME_MODES.md`); "Mochi Mash" is just the first
game, the platform is Draly Wisdom Grounds with Dralingo as host. Agreed-but-unbuilt features: `TODO-QUEUED.md`.
Security procedures: `SECURITY-SOP.md`. The full plain-language map of the platform and the work method (7-step loop,
recording → official test pipeline, toolbox, pending work) is `docs/HOW_CLAUDE_WORKS.md`: keep it current when features ship. Engagement patterns that worked: memory `project_engagement_patterns` — use it as
the checklist for any new game mode.

## Always
- **Every screen has a way back** (his rule 2026-10-18: "La Ruta Dorada doesn't have an escape button to go back. Make
  sure nowhere on the platform you get this bug"): every page, step, card and overlay shows a clear «← Volver» (or ✕ on
  an overlay) to the screen it came from, always visible on phone and projector; a check for it is part of every new
  or changed screen (a page-by-page sweep of the platform when he reported it). One look: `css/back.css` (`.dw-back`
  «Volver», tinted with `--dwb-*`; a real link, never browser history). Projector lobbies: `js/host-back.js` (hidden
  once the game runs, so «Terminar» stays the only exit mid-class). /audios views: the sticky band's «Volver» takes the
  view's `.au-back` (a direct child of `#au-main`); a view that draws its own band marks its link `[data-back]` and the
  band steps aside. An error card always keeps a way back.
- **Nothing opens zoomed in** (his rule 2026-10-18: "teachers might miss a button because they might believe the
  interface is like that"): every page fits the screen at the browser's normal 100 % on a laptop (1366×768,
  1440×900), the projector (1600×900) and phones (390×844, 360×640): no CSS `zoom`/scale on the page, nothing wider than
  the window, no part of the interface pushed off-screen; check those sizes on every new or changed screen, plus
  1366×657 (what a 1366×768 laptop really shows under the browser bars: it caught most fit problems in the sweep).
  A lobby's start button and a page's first action sit on that first screen.
- **Super obvious, like Duolingo** (his direction 2026-10-18): every screen tells a kid or parent exactly what to do
  first, in direct words («Toca el 1, La Base, donde está la flecha: ahí empiezas»), never indirect lines («Primero la
  base, después el examen»); one highlighted first step with a cast character pointing and «Empieza aquí»; numbered
  steps that read like a ladder; done / to do marks and badges that show progress at a glance.
  **Designs for kids and parents use our own art from the first draft** (his words 2026-10-18 on a text-only mockup:
  "it should be more for kids… cards… you have so many assets, why are you not using assets?… the ones touching the
  buttons are parents, so sleek, beautiful, and it should make sense"): picture cards with the cast's poses, the packs'
  word pictures and the Dubai / China wonder backgrounds, on laptop and phone. A plain text-and-color mock is not a first
  draft.
- **A kid's record answers only to that kid's own phone** (security fix 2026-10-18, his «do it here»):
  - Every endpoint that takes a student code goes through `_hwKid` / `_hwOwnsStudent`: the kid's session, their
    remembered-device cookie (`dkid`, `dauto`), or their own class code with the code.
  - An unknown code and «not yours» get the same 403, counted per address, and a probe never wakes an archived account.
  - A PIN join links an existing account (its name, its results) only when the phone proves it (`_joinOwns`); otherwise
    the kid plays under a fresh account and `guest: true` keeps the phone's own saved code. Exam rooms still link the
    typed code, because the teacher supervises them on school tablets, but they never rename without proof.
  - `node scripts/test-homework-ownership.js` must pass, and a new endpoint that takes a code uses the same check.
- **Never show a real code as an example** (his rule 2026-10-18: the «Mis tareas» login had «1001» as its placeholder,
  "a clue that that is one of the codes"). No class code, level key, PIN or student code is ever a placeholder, a
  default value or an example on a page. Use words («El código de tu maestra») or neutral dots. `scripts/test-wording.js`
  fails on any code-shaped placeholder, default or example key in kid and teacher pages. The one example kept on purpose
  is `PANDA-12` on the key screen, which the server refuses as a key.
- **Study PDFs download only for the super admin** (his rule 2026-10-18): La Base's vocabulary PDF and the golden book's
  PDF are never a download for kids, parents or regular teachers; the web pages (with their audio) are how families study.
  The server refuses the files, not just the button: `_superOf(req)` in server.js is the only door (`base.json` loses
  its `book` for everyone else); a new study PDF uses the same check.
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
  code, because homework stays as it is; El Entrenamiento (phase 4, built) is the practice behind the key and never
  uses that trainer's or the tareas' endpoints.
- **In class, no key for kids**: a kid in a teacher's live room (PIN) takes what the teacher launches (the room pass).
  **Creating a game (hosting) needs the teacher's key the first time on that device**, then THAT DEVICE is remembered
  (~90 days; his words: "maestros crear un juego needs first time key access, then it's safe"): socket `host:create`
  needs the httpOnly cookie `dtd` (signed teacher uid + codeGen) from a /maestro login or from the teacher-key screen
  (`js/teacher-gate.js`, loaded right after `/socket.io/socket.io.js` on EVERY host page: a new host page loads it too),
  or the teacher code in `password` (bots and test scripts: `--password`). Never trust by internet address: a school's
  Wi-Fi gives every kid's phone the same address. «Log out» in /maestro forgets the device.
  **A room's projector goes back only to the teacher who opened it** (2026-10-16; before, anyone with the PIN could take
  it, even mid-class): `host:create` records the owner and answers a room token that `teacher-gate.js` keeps per tab
  and adds to every `host:reclaim` (an F5 or a dropped connection). While the room's projector is still connected,
  nothing but that token takes it (an old sleeping tab whose 3-digit PIN came back for a newer room must never freeze
  a class); once it is gone, the same teacher's remembered device or code, or a super admin. **Exam, warm-up and reading
  rooms follow the same owner rule AND still need a teacher code** (his decision 2026-10-17; before, ANY teacher code
  took them, even mid-class: one code tried over the 900 PINs took every one, and an old sleeping warm-up tab took a
  newer room whose PIN came back), all in `_mayReclaim` (codes through `_socketCode`). An exam room keeps its owner on
  the data disk (`owner` in `hsk-rooms.json`: a teacher uid, or `'*'` for the legacy password; never sent) so a
  restart never hands it to anyone; one
  saved before that has no owner and goes back only to a super admin. All three pages reclaim on a dropped connection
  (token + code; a reload still opens a new room) through `js/host-reconnect.js` (`DralyReconnect.watch`, loaded after
  `teacher-gate.js`), all three since 2026-10-17 (before, the warm-up had its own `connect` handler that showed a
  refusal only in the console: a dead screen). It shows «Sin conexión · reconectando…» while offline,
  re-syncs the page once back (the server re-sends `wu:state` / `rd:state`; the exam polls), and never leaves a dead
  screen: a refusal is a Spanish card with a way forward (a new room, today's code, try again). An exam monitor takes
  its room back after a restart too (`host:reclaim` loads a disk-only exam room, then the owner rule decides). A new
  teacher-tool host page uses it.
  **Closing an exam room follows the same owner rule** (his decision 2026-10-17; before, any teacher code or remembered
  teacher device closed ANY exam room: one code tried over the 900 PINs closed every running exam mid-exam): «Cerrar la
  sala» (socket `host:end`) needs a teacher (remembered device, or a code through `_socketCode`) and then the room's own
  monitor (its token, which `teacher-gate.js` adds to `host:end` too), the teacher who opened it, or a super admin
  (`_mayCloseExam`); an exam room with no owner on record closes only for a super admin (or after its 6 h). An unknown
  PIN answers like a room that is not yours, so `host:end` never tells a socket which PINs are running exams. The
  monitor waits for the answer and says why a close was refused.
  `games` has no prototype (`Object.create(null)`) and reclaim takes digit PINs only.
  **Nobody else learns whether a PIN is a running room** (2026-10-17; before, `host:reclaim` answered an empty PIN
  'no-game' and a running room 'host-live' / 'not-host' / 'bad-password', to any socket and with no limit, and a running
  exam room's PIN lets a stranger join it): `_mayReclaim` checks who asks first, the same way for every PIN. Its teacher
  or a super admin (without the token) hear how that room is ('host-live' while its projector is still connected, or
  'bad-password' when the code is missing); the room's own projector with its token just gets it back; anyone else
  hears 'no-game' (a colleague's room too), or 'bad-password' / 'wait' for a wrong code / a waiting address, for
  running rooms and empty PINs alike. The room's token is checked before anything else and counts no PIN guess: its own
  projector is never slowed. A room taken back WITHOUT its token (another laptop, an exam room loaded from the disk
  after a restart, which is loaded only for its own teacher) answers a fresh token that `teacher-gate.js` keeps, so its
  next Wi-Fi blip comes back by the token at once and an old tab's token stops working. `js/host-reconnect.js` reads
  'host-live' right after a blip as the projector's own old connection still closing (yellow bar, 8 tries × 5 s)
  before its red card. The home page's `/api/room-alive` counts unknown PINs like a join (review 2026-10-17: it was an
  unlimited list of the running rooms). A new endpoint or socket handler that takes a PIN answers the same way, or
  counts unknown PINs like `player:join` (`_pinMiss`, and `_pinBlocked` answers «nothing» once out of guesses).
  The key screen shows only when a NEW room waits, never over an F5 of a running one. A new host page needs nothing
  extra as long as it loads `teacher-gate.js`; a test script that reclaims passes the create answer's `hostToken`.
  Test: `scripts/test-host-reclaim.js`.
- **Teacher codes**: «Cambiar mi código» in /maestro for every teacher (the super admin also changes others'): the old
  code stops at once, is retired for good (`data/teachers-meta.json`), devices remembered with it ask again. The boot
  seed creates a super admin only on the very first boot of an empty disk, never again (one-shot flag), and never with
  a code written in the source. Teacher codes never reach a kid's phone (inbox, special assignments, sentences) or a log
  line. The legacy password is the `WU_ADMIN_PASSWORD` env var only (no default in the code: unset = none).
- **A socket checks a teacher code only through `_socketCode`** (server.js, 2026-10-17; the projector-lock review found
  the warm-up presets, the warm-up / reading tools and the exam / warm-up / reading `host:reclaim` reading codes with no
  limit, and Cloudflare's rate limit covers only HTTP `/api`). Never compare a code in a socket handler yourself (the
  old `isAdminPassword` / `isSuperAdminPassword` are gone; `superAdmin` in its answer gates the super tools). It shares
  the admin turnstile (10 wrong codes in 10 min per address, checked BEFORE a code is read, HTTP and sockets together)
  and never counts an empty or retired code. A remembered teacher device counts its wrong codes on itself, 10
  (`_deviceKey` = its own `dtd` cookie), and on all of that teacher's devices together, 30 (a fresh cookie is one
  right code away), never on its school's address (`_turnstile`, HTTP `_adminAuth` too). While an address waits,
  only two things get through: a code that same connection already
  proved, and the room's own projector holding its room token with its own teacher's code (its misses count for that
  teacher, 10 then even the right one waits): a running class never freezes. Being a room's host is no proof (a
  super admin, or the opener from another device, can host it too). A host-only tool reads a code only from
  the room's host socket (`wuHostCode` / `readingHostCode`), so kids' phones can't fill the school's address.
- **Sockets only from our own pages** (2026-10-17, socket.io `allowRequest` → `_socketOriginOk`): a handshake with an
  Origin must be the address it reached, app.dralingo.app / dralingo.app / www or the old Render address (localhost
  only off Render); no Origin (test scripts, bots, same-origin polling) is let in unless the browser marks it
  `Sec-Fetch-Site: cross-site`; `null`, other sites and JSONP polling (engine.io's `_query.j`) are refused (logged once an hour per
  site). A new address that serves pages to another host's socket goes in `_SOCKET_HOSTS` or the env var
  `DRALY_SOCKET_ORIGINS` (comma-separated hosts). Test: `scripts/test-socket-codes.js` (port 4320, + 4321 as Render).
- **Homework (/homework) stays as it is** (class code + the kid's name or code), and so do its audio pages
  (`/audios/<homework id>`, linked from the printed PDFs).
- **The simulations are never open to anonymous visitors** (his words: "we're not going to give away everything for
  free"): the Simulacro Dorado (player, golden book, audio) like the other levels needs the level's key; teachers still
  launch simulations from /maestro.
- **Levels unlock by progress, like a game**: Entrenamiento after enough «¡Me la sé!» seals in La Base, the Simulacro
  Dorado after enough practice in Entrenamiento; a teacher can unlock any kid early from /maestro. His picks
  2026-10-16 (phase 3): seals stay a **free tap** (a kid's own checklist, no listening or quiz needed); **El
  Entrenamiento opens world by world** (all seals of a world in La Base → that same world opens in El Entrenamiento);
  **the Simulacro Dorado stays open with the key until El Entrenamiento is live** (phase 4), then it opens when every
  world is practised with 70 % or more (the % changeable in /maestro) or by the teacher's «Desbloquear».
  (Superseded 2026-10-18 for kids: the golden simulations are the teacher's, in class with a PIN; see «La Ruta Dorada
  redesign». The self-serve code stays behind a flag that is OFF.)
- **El Entrenamiento (his picks 2026-10-16, phase 4)**: practice worlds = the level's curriculum pack worlds (world N ↔
  La Base world N); **«Pinyin básico» (HSK 1) is open from the start; «Simulacro del examen» opens when all worlds are
  ready** (the bridge to the Dorado); only the regular worlds count for the Dorado's % rule. **Quick rounds with game
  touches**: one question at a time with audio, instant right/wrong showing the right answer, streaks, Dralingo and the
  gang reacting, stars and a % per round (~10 questions); the best % per world counts. **A key-only phone may practise**:
  scores stay on the phone and join the kid's account at the first login (like seals); only account scores open the
  Dorado. **The Dorado rule switches on at launch**: new kids earn the Dorado by practising; kids who already took a
  simulation keep it open; «Desbloquear» still opens anyone.
- **El libro dorado (his picks 2026-10-16, phase 5)**: the golden book on the web, inside El Simulacro Dorado.
  **A simulation's book opens once the kid has taken that simulation** (the sim is a real test first, the book is the
  review; a teacher sees every book). **Taken anywhere is enough** (his pick after the build): a sim taken in a
  teacher's room opens its own book even before the kid earns the Dorado; the other sims and the PDF still need the
  Dorado. **Phone cards, like La Base**: one card per question with its photos, its own
  play button cut from the original exam recording, pinyin with tones, the Spanish and the answer in gold, simulation by
  simulation, from the same source as the printed book (`study/<level>sim`, `exam.py`). **Mistakes first**: after a
  sim the book opens on «Repasa tus N errores» (that kid's wrong questions, each with its play button), then the whole
  simulation; teachers see the same list. ~~**The PDF downloads once the kid has taken every simulation of the level**~~
  (superseded 2026-10-18: study PDFs download only for the super admin, see § Always) 
  and has the Dorado (it holds every answer; a lighter web copy under 9 MB).
- **Built (phase 3, 2026-10-16): progress on the kid's account, one unlock engine.** `core/ruta-progress.js` is the
  ONLY place that decides a step (the key is still the level's door: `LevelKeys.access` first, the engine after it).
  The record keeps, per stored level id, `rec.ruta[level] = { s: '1-17,20' (the seals as ranges of word numbers of
  the level's base: a whole base is ~10 characters), at, tw: 'all' | [worlds a teacher opened], td: 1 (a teacher
  opened the Dorado), p: { world: best % } }` (written only through `Students.updateRuta`, so an archived kid comes
  back and the seals travel with the archive). A logged-in kid's stamps go to `POST /api/ruta/seals` (batched, retried
  offline; `GET` says `student: false` to a key-only phone, whose seals stay on the phone as before); the phone keeps a
  mirror in `draly_base_<level>` (`who` = an opaque id of the account, `pend` = changes not saved yet, `held` = a
  sibling's unsaved changes kept for their next login) and its seals from before the first login JOIN the account (a
  union); a sibling's mirror is replaced, never mixed: every save names its `who` and the server answers 409 to a save
  from another account's mirror. The page asks again when it comes back into view, retries (capped) when offline and
  sends what waits on `pagehide`. «Salir» on /homework ends the kid's session on that phone (`/api/homework/logout`).
  Word numbers are checked against the level's base; a save counts per kid (90 a minute), a read per address (4000 per
  5 minutes): a school Wi-Fi full of kids is never slowed. The Dorado rule (`trainingLive`, in /maestro «El Simulacro
  Dorado se gana practicando», was «El Entrenamiento está activo») and the Dorado % (`doradoPct`, 50-100) live in
  `data/ruta-settings.json` (gitignored; super admin, /maestro → Teachers, under «Claves de nivel»); phase 4 set
  `TRAINING_BUILT = true` and switched the rule ON at its launch (see «Built (phase 4)» below); a level without a La
  Base always opens its Dorado with the key. Phase 4 calls `recordPractice(code, level, world, pct)` (best % per world)
  and puts the world doors / `doradoOpen(a, rec, level)` behind `LevelKeys.access` (`_simGrant` for solo kids); its
  worlds are the base's worlds by number, plus the packs' extra worlds by name (`pinyin`, `simulacro`). /maestro: a kid's profile
  shows La Ruta Dorada per level (seals per world, El Entrenamiento worlds and who opened them, the Dorado rule in force,
  best % per sim) with «Desbloquear» / «Volver a bloquear» per world, all worlds and the Dorado («Volver a bloquear»
  undoes only a teacher's opening: a world the kid's seals opened stays open); the roster shows a thin gold bar of the
  class level's seals (seals count as roster activity). `node scripts/test-ruta-progress.js` (port 4420) must pass.
- **Built (phase 4, 2026-10-16): El Entrenamiento.** `core/entrenamiento.js` (worlds, rounds, grading, voice, proofs) +
  `public/js/entrenamiento.js` / `css/entrenamiento.css`, drawn inside La Ruta Dorada's page: `/audios/<level>/entrenamiento`
  (the worlds, the Dorado meter) and `/audios/<level>/entrenamiento/<world>` (start card → round → stars), both behind
  `LevelKeys.access` (server.js: the key screen otherwise). Worlds: the pack's regular worlds BY ORDER = La Base's worlds
  (checked by shared words in the test; HSK 1's pack names differ, the page shows La Base's names), `pinyin` first
  (always open), `simulacro` last (open once every regular world is open, or a teacher device). A world opens with the
  account's seals, a teacher's «Desbloquear», or the seals the phone sends (`s=1-17,20`: seals are a free tap, so a
  phone's own count too). API (all behind the key): `GET /api/ruta/train?level=&s=`, `POST /api/ruta/train/round`
  (~10 questions mixed by kind, no two neighbours on the same word, answers shuffled, NO right answer in it),
  `POST …/answer` (the first answer counts; the right one comes back only now), `POST …/finish` (the % counted on the
  server; the logged-in kid's best via `recordPractice`; `pinyin`/`simulacro` stored by name and never counted for the
  Dorado; a key-only phone gets a `tp` proof signed with SimLock and bound to its `dkd` cookie, kept in
  `localStorage draly_train_<level>` {who, best, proofs, held}), `GET …/voice/<round>/<i>/<part>` (ask = the pinyin the
  screen already shows, o0-o3 = the options read one by one while their tile lights up, after = the right answer /
  the filled sentence / the reply, only once answered; La Base's own clips when the word or sentence is in the book,
  else the platform voice through `_ttsServe` with hanzi made on the server (`speechText`, context rules for
  hao/shi/zai/he/na…) in "trusted" mode: no per-address cap, 240 new voices a minute for everyone, one synthesis per
  text at a time), `POST …/scores` (a key-only phone's proofs join the account at login: `who`/409 like the seals).
  Rounds live in memory (3 h, one per kid/phone per world (a new one ends the open one: no second tab to peek), 3 per
  kid/phone, 400 per address, 3000 in all; a deploy ends them: the page says «Esta ronda ya terminó»). Pictures travel
  as `/api/ruta/train/pic/<round>/<i>` (the pack names a word's picture after its pinyin: the file name would be the
  answer). A proof joins ONE account (`data/train-proofs.json`: round → account, gitignored). Only a new round gives a
  phone its `dkd` id; the rate counters are swept on a timer. The never-leaky rule: no `/api/homework/pack-check`,
  `/api/sets` or `/api/packs` from El Entrenamiento (the test greps the page). His pick kept on purpose: «Simulacro del
  examen» opens with the seals (a free tap), before the Dorado, and shows each answer after it is given (its items are
  the official sims' questions; the same rounds are New HSK 1's homework already). **The Dorado rule ON at launch**: `TRAINING_BUILT` is true (env `DRALY_TRAINING_BUILT=0` = the
  guard), DEFAULTS trainingLive true, and the first boot of phase 4 switches it ON once even over a phase-3 file and
  stamps `trainingLaunchAt` (a one-shot flag: his later OFF sticks; a missing file is ON + stamped; a damaged file never
  launches again: what can be read in it is kept, else OFF with the moment unknown).
  Grandfathered: a graded simulation of that level (`hskResults`, total > 0) before `trainingLaunchAt` keeps the Dorado
  open (`via: 'taken'`). `_simGrant` asks `doradoOpen` after the key for solo kids only (403 «practica»; a teacher and a
  kid in a teacher's PIN room as before); a sim link not earned yet → `/audios/<level>?dorado=cerrado#paso-3`. The
  route: step 2 = one tile per practice world (open = plays it, closed = that world in La Base with its seals), step 3
  not earned = one coin per world with its best % (a key-only phone: «Entra con tu código»). /maestro: best % per world
  (gold-green at the Dorado's %), Pinyin/Simulacro apart, the Dorado's reason (practice / teacher / took a simulation);
  Teachers → the switch is labelled «El Simulacro Dorado se gana practicando». `node scripts/test-ruta-training.js`
  (port 4430: boot 1 = phase 3 where a kid takes a sim, boot 2 = the launch) must pass; the key-door tests run with the
  switch seeded OFF (`ruta-settings.json` in their temp folder).
- **El Entrenamiento covers every simulation** (his words 2026-10-18, once the simulations became the teacher's, run in
  class with a PIN: "we will just need the base and the training… make sure that the training is actually really
  covering all the simulations"). `node scripts/test-training-coverage.js` must pass: per level it reads the sims
  (`content/golden/<book>.json`) and every question El Entrenamiento can ask, and checks (a) every level word of the
  sims in 2+ practice questions (a word spelled like another, shi = ser / diez, also in a question of its own) and every
  word above the level the exam itself uses in 1+, (b) every kind of exam question (listen ✓ / ✕ picture, listen →
  picture, listen → written answer, read a word ✓ / ✕, read a sentence → picture, reply, fill-in, short text) in 10+
  questions, each kind of stimulus (word / sentence / dialogue / statement + question) in 5+, heard only when the
  exam's is heard, (c) every part of the exam layout, (d) the sims' sentence patterns in 5+, (e) the drills: every
  heard line sayable, every picture on disk, two drills that look the same have one answer, only level + exam words.
  A new sim, a changed pack or a new level: re-run it. The exam's kinds come from `core/entrenamiento-drills.js`
  (exam drills, added to every world's pool by `poolOf`): from La Base, every word whose picture really shows it
  (`PIC`: people, body, animals, food, places, things, transport, weather, faces, numbers; one person per question,
  numbers only beside numbers, look-alike pictures never together) gets listen ✓ / ✕, listen → photos A B C, read
  ✓ / ✕, and its example sentence (only when the sentence's Spanish names the word) listen → photo, listen ✓ / ✕, read →
  photo; the packs' dialogues heard only (choose the reply; the picture when one word of it has one) + a few written
  dialogues per level (`DIALOGUES`, level words only); «Simulacro del examen» gets every listening question of every
  sim heard only (the exam's own Chinese: `core/yct/<sim>.json`, old HSK `content/train/hsk1sim-heard.json`, exported
  once from `study/hsk1sim/transcripts.py`) and the reading lines its pack rounds leave out. Picture and ✓ / ✕ options
  are opaque tokens fixed per drill (pictures travel as `/api/ruta/train/pic/<round>/<i>/<k>`, La Base's own files,
  behind the key); a heard question sends its line only as `alt`, shown when the sound fails (never stuck); a reading
  drill speaks only on a tap (`voice.tap`); the line and its Spanish come back with the answer (`show`). Drills are the
  same in every build (only the round's order changes): the tests key them by text + options.
- **Built (phase 5, 2026-10-16): El libro dorado.** One source with the printed golden books: `../study/lib/examweb.py
  <book> --repo <checkout>` (exam.py's own Exam: the sim data, texts.py / transcripts.py, the photos as the book
  processes them) writes `content/golden/<book>.json` (never served as is) + `protected/golden/<book>/<n>/p<NN>.webp`
  (photos, <= 60 KB) + `a<NN>.m4a` (each listening question cut from the exam recording, mono AAC 48 kbps; old HSK
  reuses its own mp3 per question from `protected/HSK SIMULATIONS/`) + `book.pdf` (web copy < 9 MB); a level names its
  book in core/levels.js (`golden`). `core/golden.js` reads it; server.js: the page `/audios/<level>/libro/<n>` (the key
  screen without the level's key; `/audios/<level>/libro` → the route's step 3), `GET /api/golden/<level>/<n>` (the
  doors in order: `LevelKeys.access` → an account (a key-only phone: `why: 'login'`) → that sim taken = a graded try in
  `rec.hskResults` (solo, homework and room tries all land there through `/api/hsk-sim/:simId/submit`) that really
  answered the exam: since phase 5 the submit stores `answeredCount` as the grader saw it (not the keys a phone sent)
  and `questions`; a try needs half of them answered (older tries: anything but blank). Taken anywhere is enough: no
  `RutaProgress.doradoOpen` for a taken sim's book, its files or the examples; a sim not taken answers `why: 'dorado'`
  while the Dorado is closed, else `why: 'taken'`; a teacher passes them all), `GET /golden-media/<book>/<n|ex>/<p|a><i>`
  (by index from the JSON, only a book core/levels.js names, the same doors per file, `private` + Cloudflare no-store)
  and `/golden-media/<book>/book.pdf` (the Dorado open and every sim taken, or a teacher; `private, no-store`,
  attachment; `Golden.summary`'s `pdf.ready` / `pdf.dorado` say the same). While the Dorado is closed the route's
  step 3 keeps phase 4's practice view and adds the kid's own taken sims (`golden.taken`: «Libro dorado del Simulacro
  N» with its mistakes, «El libro en PDF llega con El Simulacro Dorado»), sent only to that logged-in kid. Rates in fixed 5-min
  windows counted AFTER the door: a teacher never waits, a kid's account 600 views / 6000 files, refused or unknown
  requests 300 per address (they never spend a school Wi-Fi's budget). A try whose total differs from today's grader
  (old HSK sims 1-6 had 30 questions until 2026-06) shows no per-question mistakes; «¡Aprobado!» = the try's % against
  the exam's pass line (old HSK grades in points of 400). The page (`public/js/libro.js` + `css/libro.css`) holds no
  content: mistakes first («Repasa tus N errores» = the latest try's `wrongQs`, each card with the kid's answer beside
  the right one), «Mis resultados», «Así es el examen» (folded; its word lists never name a sim question), the whole
  sim, the PDF; one clip at a time, started by the tap. The
  route's step 3: a taken sim's tile gets a red «Libro dorado» ribbon with its mistakes; the PDF button or «Haz los N
  simulacros que faltan». /maestro (kid profile): per sim taken, its mistakes and «📖 Ver su libro» =
  `/audios/<level>/libro/<n>?de=<link>` (AES-GCM sealed kid + level, 12 h, opens only for a teacher session that may
  touch that kid; a kid holding it sees their own book; a browser that is no teacher's gets `why: 'teacher'` and the
  page remembers it with the /maestro code it keeps, else says to open it where /maestro is). Cast moods `libro` (zero
  mistakes) and `repaso` in cast.js. The export is atomic (a new folder swapped in only when all of it worked) and the
  test checks every file against its stamp.
  `node scripts/test-golden-book.js` (port 4440; `STUDY_DIR=<…/study>` compares a clone with the printed books) must pass.
- **The simulations' audio = a digital golden book**: the golden book on screen page by page, each listening question
  with its own play button (the original exam recording, cut per question), plus the PDF to download.
- The whole tab is **«La Ruta Dorada»** (was «Audios y vocabulario»). Choosing your module feels like a game: a swipe
  between modules with a super cool animation: **big glossy module cards that fly in with depth and a little bounce**
  (his pick 2026-10-15, "like choosing a world in a Nintendo game").
- Since phase 4 the route's step 2 is El Entrenamiento itself («2 de 6 mundos listos para entrenar», one tile per
  practice world: an open one plays it, a closed one links to that world in La Base; a world that became ready since
  the phone's last visit pops its gold coin once, `draly_ruta_ready`). A level with no La Base keeps «Muy pronto» there.
- **Built (phase 2, 2026-10-15)**: `/audios` = the module picker, `/audios/<level>` = that module's golden route
  (`public/js/ruta.js` + `css/ruta.css`, routed by `js/audios.js`). One card per level of core/levels.js (its jewel
  colour by test family, a new level of the same family takes the next free colour; Dralingo's pose shuffled per visit;
  the gold Dubai skyline is one `<symbol id="rd-sky">` in audios.html). Three worlds or more go round in a ring (a
  neighbour on each side); the flight is a JS spring writing transform and opacity only (no layout read in a frame;
  measured 0 frames over 34 ms at 4x CPU slowdown); reduced motion = a crossfade; the first frame is still. What a visitor may open comes ONLY from `GET /api/ruta-dorada` (server.js
  `_rutaState`, `LevelKeys.access` per level): `open`, the base, `simCount`, and the sims list (links to the players,
  the logged-in kid's best %) only when open (phase 3 adds, only when open, the base's worlds, `dorado` = the rule in
  force, the logged-in kid's `progress`, and `who`; once El Entrenamiento is live the sims are listed only to whoever
  has earned the Dorado); `home` = the logged-in kid's class level, else the first level this
  device holds the key of (the picker shows it first; then the tab's last card, then the phone's last choice). A step
  is open / locked (the gold lock, one «Escribe la clave de <nivel>» box) / «Muy pronto» (El Entrenamiento until
  phase 4; La Base or the Simulacro of a level that has none yet). «Escribe la clave» = `/audios/<level>/clave`: the
  phase-1 key screen (with a way back to the path), which returns to the path once open (the key's «Copiar mensaje
  para WhatsApp» in /maestro links this address). A visitor gets «Entra con
  tu código» (`/homework.html?next=/audios…`, homework.js accepts `/audios`, `/audios/<id>`, `/audios/<id>/clave`).
  The /homework entry «La Ruta Dorada de <nivel>» opens `/audios/<level>?from=homework` (the path's back arrow then
  says «Volver a mis tareas»). A new locked thing on the path (El Entrenamiento, the golden book) gets its state from
  `_rutaState` (never a list sent to everyone) and its door from `LevelKeys.access`.
- `node scripts/test-level-keys.js` (its own server on port 4300 and a fresh data folder),
  `node scripts/test-sims-lock.js`, `node scripts/test-ruta-dorada.js` (port 4410: every kind of visitor, nothing
  protected reaches one who may not open it), `node scripts/test-ruta-progress.js` (port 4420: seals, the unlock
  engine, /maestro's «Desbloquear», archive), `node scripts/test-ruta-training.js` (port 4430: El Entrenamiento, the
  grading, the Dorado rule ON at launch), `node scripts/test-training-coverage.js` (no server: El Entrenamiento covers
  every simulation) and `node scripts/test-golden-book.js` (port 4440: El libro dorado, every
  visitor's doors, the media by index, the web against the printed books) must pass.

### La Ruta Dorada redesign (his picks 2026-10-18, after «it's not clear, it's messy, the tareas are left behind»)
- **A module page = one clear ladder + the homework beside it**: the big module card with the ladder 1 La Base → 2 El
  Entrenamiento → 3 El Simulacro Dorado (done / next / locked at a glance), and «Tus tareas» next to it (right on a
  laptop, below on a phone) with each homework's audio. It uses the whole screen on a laptop and stays one column on a
  phone. A visible «← Volver» everywhere.
- **Super obvious first step**: a cast character points at the next step with «Empieza aquí» (La Base first: «Toca el
  1, La Base: marca las palabras que ya sabes»), the steps read like a ladder, and red badges say what waits («3
  palabras por marcar», «1 tarea nueva»). Direct words only.
- **Homework done marks, with no extra load** (he left it to Claude: "not too many steps… you decide"): playing a
  homework's audio marks it «Escuchada ✓» by itself; one tap «¡Ya la mandé!» when the kid has sent their video on
  WhatsApp marks it done, on the kid's account (profile, «Hacer mis tareas», /maestro see it). Teachers confirm nothing
  (they may undo a wrong mark). Built 2026-10-18: `GET/POST /api/ruta/tareas` → `rec.tareas` (session only, the kid's
  own record, catalog ids, another account's `who` → 409, 60 saves a minute); the phone mirror is `draly_tareas`
  (marks made before login join the account at login, like the seals); «Deshacer» for 8 s; another level's homework
  only plays. `node scripts/test-ruta-tareas.js` must pass. Not built yet: the /maestro view and the teacher undo.
- **Design first**: a clickable design of the new module page (laptop + phone) for him to try and approve before it is
  built into the platform.
- **Homework by experience, like folders** (his rule 2026-10-18: "basing everything on experiences is so good and we
  should keep following the same rule… if you keep them all, scroll down in the list then it's going to become messy"):
  - «Tus tareas» shows every experience of the module (Experiencia 1…8, and more when a module has more), as folders.
  - Tap one to see its 2-3 homeworks, with the same «Escuchar» / «¡Ya la mandé!» marks.
  - Never one long list of homeworks. Anything new that holds a level's content follows the same experience folders.
  - Built 2026-10-18:
    - The folders come from each module's `exps` (server.js `_rutaExps`), in curriculum order.
    - The newest homework's folder glows «La más nueva».
    - A level with no homework audio yet (YCT 1) shows no column.
- **A practice that's done shows it** (his words 2026-10-18: "whenever I finish a practice on the training it's not
  recorded… if I already finished it it should be green"): in El Entrenamiento a world played shows its result, and at
  the % goal it turns green with a ✓. Card 2's «N de 8 mundos con 70 %» counts it right away. This holds for every
  kind of visitor: a logged-in kid, an automatic account, a phone with only the key, and the teacher's preview, where it
  is kept on that device and labelled as such.
  - A teacher's rounds are kept in `draly_train_t_<level>` on that device only, never on an account.
  - Every training store key starts with `draly_train_`, so other open tabs redraw.
  - «Done» is green with a ✓ everywhere; gold never means done.
- **The golden simulations are the teacher's** (his decision 2026-10-18: "the golden simulations should be just for me
  because I will manually put simulations to kids… I need to give them a pin… so the parent communication feels
  stronger"): kids get La Base and El Entrenamiento on their own; El Simulacro Dorado never starts from a kid's phone.
  When El Entrenamiento is done, step 3 tells the family to tell the teacher («¡Ya estás listo para El Simulacro
  Dorado!», a WhatsApp/copy message for the profe), and the teacher runs it in class with a PIN. The self-serve code
  stays in the platform behind one flag, OFF. A simulation taken in a teacher's room still opens its «Libro dorado».
- **El Entrenamiento covers every simulation** (his words 2026-10-18: "make sure that the training is actually really
  covering all the simulations"): every level word, question type and exam part of the level's simulations is
  practised in El Entrenamiento; `scripts/test-training-coverage.js` checks it and must pass when sims or training change.
  It uses the simulations' REAL questions, all of them (his pick 2026-10-18, told that kids then practise the exact exam
  and the class simulation becomes more of a review than a surprise test): no hold-out simulation, no variants.
- **Teachers see what kids see**: the teacher view never hides a kid's controls without a trace (2026-10-18 he couldn't
  find «¡Ya la mandé!» because his computer is the super admin): show them as a calm, inactive preview with one line
  («Así lo ven tus alumnos…»).
- **An automatic account, kept forever** (his words 2026-10-18: "it's really hard for people to make an account… make
  the system automatically give them an account… keep that code forever… remind you: are you sure you are not this
  student?"): a visitor's first real step in La Ruta Dorada (a level key, a seal, a training round, a homework mark;
  never a page view) gets a real student account with a generated code, kept on that phone; a friendly card shows the
  code («anótalo») with an optional name. Before a phone with progress logs into another code or makes a new account:
  «¿Eres tú? Este teléfono ya tiene a <nombre> · código … · progreso». An automatic account's progress can move into
  the kid's real account («Pasar mi progreso a esta cuenta»). Built 2026-10-18 (after a security review):
  - Accounts are created only through `POST /api/ruta/auto` at a real step, never on a page view or a plain listen.
  - They have no class code, and their 6-character codes always include a digit.
  - The placeholder name is «Dragoncito NNN»: never «Anon», never the code.
  - The phone holds a signed year-long `dauto` cookie (code + parked + firstSeen). An unclaimed automatic account answers
    only on that phone (or to a teacher); anywhere else its code is an unknown code.
  - «Salir» sets `dralyHwOut`, so nothing logs that kid back in by itself. A parked account comes back only through
    «¿Eres tú?» → «Sí, soy yo».
  - A merge moves seals, homework marks, training scores, exam tries and homework into the real account. Stale
    automatic accounts are archived like every account, never deleted.
  - `node scripts/test-auto-account.js` must pass.

### One kid home: the portal + La Ruta Dorada (his direction 2026-10-18, to build after La Ruta Dorada is «perfect»)
- **Integrate, don't discard** (his words: "not everything is redundant… some things are rescuable… everything should be
  integrated seamlessly and it should make sense… you have a reason why it is the way it is"): /homework (Mis tareas)
  and La Ruta Dorada become one home where the homework marks, the word seals and the route are one story. Every button
  has a reason to exist; remove duplicates and buttons nobody needs.
- **Keep**:
  - the Nintendo-Switch-like start when a kid joins (he loves it);
  - Papás, redesigned: today it is hard to read and easy to get lost in;
  - Mensajes (teachers writing to their students);
  - the sentences (Mis oraciones), which get their own new interface later;
  - «Desafío del día» (his words 2026-10-18: "later on… the games already made will become games for daily
    challenges, so leave it there"). It shows as «Muy pronto» with the games' art until the pin games become daily
    challenges.
- **Design first**, like the La Ruta Dorada redesign: a clickable design (laptop + phone) for him to approve before building.
  v1/v2 on 2026-10-18: https://claude.ai/artifact/HaZwEVT2RMfhyfuTBasKWx (La Ruta Dorada as a path of the 8 experiences;
  each experience = 1 Palabras → 2 Práctica → 3 Tu tarea; tabs La Ruta · Mensajes · Oraciones · Desafío; Papás; Mi perfil).
- **The level key is the family's one password** (his pick 2026-10-18, after asking for something easy that is still
  password-protected and places kids in their level from home without teacher approval):
  - A new kid types the level key the teacher sent on WhatsApp. The key protects the content, and it also tells the
    level: «¡Tu nivel es New HSK 1!». The kid then picks a name and avatar and gets their own 6-character code («anótalo»).
  - The phone remembers the kid: «¡Hola de nuevo!» → «¡Vamos!», with nothing to type.
  - On a new or lost phone the kid types their code AND the level key; the code alone never opens an account.
  - To move up a level, the kid types the new key («Abrir otro nivel» in Mi perfil).
  - The 4-digit class code (1001…) is no longer asked of families. Kids join a teacher's class through the PIN in class.
  - A leaked key is changed by the super admin in /maestro.
  - Built 2026-10-18 (parts 1-2 of «Mi Dralingo»: la entrada `public/js/entrada.js`, Papás `public/js/papas.js` +
    `papas-plan.js`, shared by the server and the page). Key accounts (`byKey`) answer only to their session, their
    `dkid` phone cookie, or code + key; the old form refuses them.
  - `dkid` carries the level's key generation and the account's `kidGen`:
    - after «Cambiar» + «Cerrar en todos los aparatos» the phone asks for the new key only;
    - the super admin's «Cerrar su sesión en todos los teléfonos» (kid profile) bumps `kidGen` and asks for code + key.
  - A PIN room tags an untagged key account with the room owner's class code for its level, only when the phone proves it.
  - `node scripts/test-entrada.js` and `node scripts/test-papas.js` must pass.

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
  closing a room needs the teacher code, and taking over or closing it also the owner rule, § In class; «Terminar sala» =
  socket `host:end`; 60 never-used PINs from one address in
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

## Homework audio (/audios, since 2026-10-11) · «La Ruta Dorada» (was «Audios y vocabulario»; renamed 2026-10-15)
- `/audios` is La Ruta Dorada's module picker (§ Three levels: the flying cards) and `/audios/<level>`
  (`/audios/yct1`, `/audios/newhsk1`, `/audios/hsk1`; names and order from `core/levels.js`) that module's route:
  La Base, El Entrenamiento, El Simulacro Dorado, then the level's homework audios. Old addresses never change: the
  printed PDFs link `/audios/<homework id>`, `hsk2-…` opens `newhsk1-…` (and `/audios/hsk2` the New HSK 1 path),
  `/audio/…` and `?t=<id>` still work.
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
  `css/audios.css`; seals saved per phone in `localStorage draly_base_<level>` (the move bridge carries it) and, for a
  kid logged in at /homework, on their account (phase 3, § Three levels: `/api/ruta/seals`, any phone); the
  /homework home links the level's route for levels with `base` in core/levels.js («La Ruta Dorada de <nivel>»,
  `#pt-base`, server sends `base` on enter, read from the catalog; `?from=homework` turns the route's back arrow into
  «Volver a mis tareas»; the base's own back arrow returns to the route).
- **La Base is behind its level's key** (2026-10-15, § Three levels): its files live in `protected/base/<level>-base/` and
  `protected/study/` (never `public/`; the old `/assets/audios/<level>-base/…` and `/assets/study/…` answer 404) and travel
  only as `/base-media/<base id>/<file>` (`book.pdf` = the PDF), checked on every file with `levelAccess`, `private`
  + `Cloudflare-CDN-Cache-Control: no-store` (never kept by Cloudflare; the phone keeps clips a week). `/audios/<level>-base`
  shows the key screen to whoever may not use the level; the picker and the route draw the gold lock on those levels
  (`/api/ruta-dorada`; `/api/level-access` still answers). Commit `protected/base/<id>/` + `protected/study/` with the catalog.
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
  (`?dorado=1` forces him, `?dorado=0` never); only on a homework's audio page (on a base he would cover the seals, on
  the picker the ‹ › buttons, on a route its key box; css/ruta.css hides him there). `public/js/golden/dorado.js` + `css/dorado.css` are hand-written; the other
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
  Dàfùwēng · Monopolio Chino was remade 2026-10-16 as «Dàfùwēng · Monopolio · El Gran Tablero de Dubái» (`monopoly`):
  a Mario Party board night in boards of 4, every right answer a dice roll on the kid's own board (spec
  `docs/specs/monopoly-v2.md`).
  Vuelo del Dragón was remade 2026-10-16 as «La Carrera del Cielo de Dubái» (`dragon-eye`): a Mario Party sky race in
  races of 4, every right answer a flight where each swipe up is a wing beat of the kid's own dragoncito (spec
  `docs/specs/dragon-v2.md`); the old Rojo / Dorado team version with hanzi retired.
  Dragones Pintores was remade 2026-10-17 as «El Cielo de las Maravillas» (`paint`, his picks: Dubai + China, a new sky
  each round with its landmarks as the prizes; tap where to fly): the server flies every dragon from the kids' tap intents
  and judges every cloud (spec `docs/specs/dragones-pintores-v2.md`); the platformer with ◀ ▶ ⬆ retired.
  La Gran Fuga de Dubái was remade 2026-10-17 as «Las rutas de la fuga» (`escape`, spec `docs/specs/gran-fuga-v2.md`):
  each round is a route of three real places drawn as art (Dubái: Museo del Futuro → la Fuente del Burj Khalifa → la
  pista; China: el Mercado Nocturno → el Jardín Chino → la Gran Muralla), Hamdan's jet at the end of both; the zonas
  seguras are the place's painted room (its walls authored per picture in `js/escape-map.js`); a live chase strip on
  every phone; each run's pace set from the clock. The teacher picks the route in the lobby, «Otra ronda» = the next.
  Reinos de Colores, Dragones Pintores, Batalla de Nieve and La Gran Fuga got the Mario Party ending 2026-10-16 (branch
  `ending-pass`): one shared ceremony (`js/party.js` + `css/party.css` + `core/party.js`), the last 30 s doubled, live
  news between questions; «As built · 2026-10-16» in each spec.
  «Las Trampillas» (new 2026-10-17, `trapdoor`, #2 of the Mario Party series, his video 4:43-5:41, spec
  `docs/specs/las-trampillas.md`): the whole class on one round platform whose pie slices drop like trapdoors at «0»,
  Fuego vs Mar; tap the floor to run (the server moves everyone); a right answer = wings that save you once; the
  fallen answer in the pit to come back; each round a kingdom scores its share standing out of 10 (Final Round ×2: a
  share, never a head count, so a kingdom with one kid more never wins by size); three arenas, «Otra ronda» = the next;
  the shared Mario Party ending (it has no last-30-s frenzy: the Final Round is its climax).
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
  they contributed, any star). Short, skippable by the teacher, never stuck. A game without its own ceremony uses the
  shared one (`js/party.js` `DralyParty.Ceremony` + a `fin` payload from `core/party.js`, as Reinos, Pintores, Nieve and
  La Gran Fuga do since 2026-10-16); a kid with nothing to show reads «¡La próxima es tuya!», never a 0.
- **Feelings in between too: no dead phones** (his words 2026-10-16 on 6-7: "I didn't even feel there was a feeling,
  there's nothing in between"): from one question to the next the kid's phone stays alive. Their tap shows what it did
  (to their team, the board, their character), the gang reacts, the live race or team state stays on screen, and a
  short moment fills any wait. A plain «espera» screen between questions is a bug. The game's own identity (6-7's
  hand-swing and shout, Mochi's mash…) is felt DURING play, not only in the ending.
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
  --game <type> --bots 20` must PASS (a long reward such as a Monopolio turn tells the frozen-kid watch how long it
  lasts through its handler's `graceUntil`), then the
  `classroom-playtester` agent for the real-browser check.
