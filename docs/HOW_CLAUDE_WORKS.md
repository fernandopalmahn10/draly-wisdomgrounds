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
| **Ojos de Halcón** | Super Mario Party «Looking for Love» recreated (`halcon`, 2026-10-13, branch only; first of the Mario Party series; it replaced the first attempt «Ojo de Halcón», `look`, retired and removed 2026-10-14): the class is dealt into boards of 4 (3 when it doesn't divide, ≤ 5 kids = one board); every phone shows its own brass board with four round windows and every kid of the board as their full-body saga character; the question flashes across the board, the four answers pop into the windows, a tap = my character turns to look at that window (beam of light); rivals only show «ready» (✓) until the reveal, when everybody snaps to their window at once (like the video); right looks +5 / +3 / +2 / +1 by speed inside the board (glow, sparkles, victory pose), wrong = 0 (blue slump); 10 or 15 rounds; «¡FINAL!» and the TV-studio finale «<nombre> ¡Gana!» with the winner posing and the others on the floor; the projector shows every board + the class top 5. Spec + scorecard `docs/specs/ojos-de-halcon.md` |
| **La Gran Fuga de Dubái** | Kahoot «Robot Run» co-op chase (`escape`, 2026-10-13, branch only): the whole class runs from Robotín (the museum's goofy guard robot) through the Museo del Futuro, the Dubai Mall and the airport runway; every right answer is a turbo, his tickle-zap makes everybody dizzy 3 s; between zones a «zona segura» room on every phone (joystick, green zones, limits that force the class to split, 5 team hearts); the escape in Hamdan's jet, a crew rank and personal awards. Spec + scorecard `docs/specs/gran-fuga-de-dubai.md` |
| **Dragones Pintores** | Gimkit «Color Clash» in Dralingo style: each kid flies a red or blue Dralingo over cloud platforms on the phone and paints every cloud it lands on; flying burns fire, «Recargar» + a right answer refills it; the projector shows the whole sky live |
| **Mochi Mash** | Remade 2026-10-14 (`mochi-mash`, branch only; same address `/host.html`): «La Terraza del Mochi» on Dubai Creek, Fuego (red) vs Mar (blue) each feed their baby Dragoncito. A right answer opens a 5-second mash zone on the phone (6 s on a streak of 3+): the whole screen is the button, each tap throws a mochi from the kid's full-body character into the dragon's mouth (combo counter, a rare golden mochi +5); phones send tap counts every 250 ms and the server caps 12 taps a second. Rising excitement: the tug meter and growing dragons on both screens, lead-change alarms, a landmark race (Museo del Futuro → Marco de Dubái → Burj Al Arab → Burj Khalifa, the first team to grow that tall wins a mochi bonus), «¡Últimos 30 segundos! ¡Doble mochi!»; comeback rule: the trailing team gets more golden mochis (capped at the gap), a smaller team counts ×size. Mario Party ending: «¡FINAL!», the weigh-in, «¡Gana el Equipo …!» (winners cheer, losers slump), 5 bonus stars one by one (más mochis, respuesta más rápida, racha, puntería, remontada), the podium on the projector and each kid's own card on the phone. Spec + scorecard `docs/specs/mochi-mash-v2.md` |
| **Piñata Tigre** | Remade 2026-10-15 (`pinata`, branch only; same address `/host-pinata.html`): «La Fiesta de las Piñatas», an evening party on Dubai Creek, Fuego (red) vs Mar (blue) each break a ladder of tiger piñatas (our own glossy toy tiger, Higgsfield art, with the team's bow; orange tigers under the Museo del Futuro, Marco de Dubái and Burj Al Arab, a golden one under the Burj Khalifa, then more golden tigers). EVERY right answer is a hit for that kid: the phone shows a timing meter (flojo · bien · fuerte · dorado), one tap stops the arrow and the kid's full-body character swings the stick (recorded whack, vibration, shake, the tiger jolts and cracks, candies fly into the kid's counter; «¡CRÍTICO!» in the gold). The meter is judged on the server (the phone sends its tap time, used only when it is within ± 150 ms of the server's own estimate from the measured round trip, the median of the last 5 pings; otherwise the server's estimate counts). A broken tiger rains its jackpot of candies and the next one drops in; the first team to break a landmark's tiger wins it; lead-change alarms, «¡Últimos 30 segundos! ¡Doble golpe!»; comeback: the trailing team gets a wider golden zone (its lucky extra capped at the gap), a smaller team counts ×size. Mario Party ending: «¡FINAL!», the candy jars, «¡Gana el Equipo …!» (winners cheer, the others sob under a rain cloud), 5 bonus stars (más golpes, más críticos, respuesta más rápida, racha, remontada), the podium and each kid's own card. Spec + scorecard `docs/specs/pinata-tigre-v2.md` |
| **Dàfùwēng · Monopolio** | Remade 2026-10-16 (`monopoly`; same address `/host-monopoly.html`, question packs): «El Gran Tablero de Dubái», a Mario Party board night. The class is dealt into boards of 4 (3 when it doesn't divide, ≤ 5 kids = one board), every kid for themself, all boards on the same luxury Dubai map (the sea and the Palm, the Creek with its abras, downtown, the desert; 24 glossy spaces; 5 landmarks standing on their spaces). The phone IS the board: my board's four players on top (rank, stars, coins), the board around my full-body piece in its seat colour (red, blue, green, yellow), rivals hopping by, a minimap; the question is a sheet at the bottom. A right answer = a dice block over my head (the whole screen is the button; the server picks the number; 3 s without a tap = it rolls by itself), two dice every 3rd right in a row; my piece hops, passes Salida (+4) and the star (10 coins = a star from Dralingo, then it moves), and lands: blue +3, red −3, a landmark (buy it / pay its toll to the owner / level it up), «¡Suerte!» (Latifa's roulette: chest, swap places, dice duel, advance 3), «¡Tormenta de arena!» (the whole board drops coins, the star flies). Each space has a host from the gang (Hamdan, Latifa, Aileen in voseo, Adric, Adrian, Dralingo). Wrong = «¡Casi!» and a wait (longer after two), under 600 ms = too fast. Lead alarms per board, «¡Monedas dobles!» in the last 30 s, lucky coins for the last kid of a board (capped at the gap). Mario Party ending: three bonus stars per board (Sabia, Magnate, Racha) that can change the winner, each board's winner, the class podium, each kid's card. Spec + scorecard `docs/specs/monopoly-v2.md` |
| **Vuelo del Dragón** | Remade 2026-10-16 (`dragon-eye`; same address `/host-dragon.html`, question packs): «La Carrera del Cielo de Dubái», a Mario Party sky race. The class is dealt into races of 4 (3 when it doesn't divide, ≤ 5 kids = one race; a late joiner flies in the smallest race, level with its last dragon), every kid on their own dragoncito (the Bebé Dralingo of Reinos in three flying frames, recoloured red, blue, green, yellow, purple) with their full-body saga character standing on its back. One score: metres flown. The phone IS the race: my race's plates on top, the sky over Dubai with my dragon big in front and my rivals in their lanes (true distances up close, squeezed toward the edges with «+120 m»), the landmarks, the Creek and its abras rushing by, the sky going from golden hour to night; the question is a sheet at the bottom. A right answer = «¡A VOLAR!»: 4 s (5 s on a streak of 3+, «¡Fuego azul!» ×1.5, ×2 from 6) where every swipe up or tap is a wing beat (the wings beat, the dragon surges, «+6 m»); the phone sends beat counts every 250 ms, the server credits at most 5 a second (+3), the phone predicts with the same cap and settles on the server's summary. Golden rings sometimes wait in a flight; the last dragon of a race far behind gets a tailwind (+50 %); both extras capped at the gap. Every 40 s a 12 s star sprint at the next landmark («¡Carrera al Burj Khalifa!»: whoever of the race flies the most metres wins Dralingo's star, +150 m). Wrong = «¡Casi!» and a wait (longer after two), under 600 ms = too fast. Overtakes, lead alarms, laps, «¡Alas dobles!» + fireworks in the last 30 s. The gang talks in a corner bubble (Fer, Hamdan the sprints, Latifa the rings, Aileen the overtakes in voseo, Adric the tailwind, Adrian the laps, Dralingo the stars). Mario Party ending: «¡FINAL!», each race's finish strip, 3 bonus stars (Sabia, Racha, Remontada; +200 m each, they can flip a close race), the winners, the class podium, each kid's card. The old team version (two emoji dragons, hanzi) is gone. Spec + scorecard `docs/specs/dragon-v2.md` |
| **6-7 Swing** | Remade 2026-10-15 (`sixseven`, branch only; same address `/host-sixseven.html`, no question pack): «La Balanza de Oro», night on Dubai Creek, Fuego (red) vs Mar (blue) fill the pans of a giant golden balance that tips toward the team with more gold. Rapid-fire sums whose answer is ALWAYS 6 or 7 (the kids' «six-seven» meme), numbers 1-10 and + / − only, written with digits («Números»: 3 + 4), with pinyin words without tone marks («En Chino»: san + si) or both in turns («Mezcla»), the teacher's pick in the lobby. Two giant buttons «6 · liu» and «7 · qi»; a right answer = the kid's full-body character swings, coins fly, the platform voice says «liù» / «qī», the streak multiplier (×2 from 3 right, ×3 from 6, ×4 from 10); a wrong one = a funny wobble, «Era 7 · qi» and a short wait (longer after two in a row: «¡Respira!»); a tap under 400 ms counts as wrong. Dralingo in his platform look does the 6-7 (palms up, one up, one down: our own Higgsfield art) at the foot of the balance and on the phone on a racha. Server-judged; a fast guesser earns less than half of a kid who thinks, a masher nothing (measured). Landmark race, lead alarms, «¡Doble oro!» in the last 30 s, comeback = more golden sums for the trailing team (extra capped at the gap), size weighting. Mario Party ending: «¡FINAL!», the great weigh-in, winners do the 6-7 swing / losers sob under a rain cloud, 6 bonus stars (aciertos, racha, puntería, la más rápida, Experto en Chino, remontada), podium, each kid's card. Second pass 2026-10-16 («no dead phones»): the tap reacts at once, the phone shows a little world (the balance, my team and the rivals, Dralingo) where my coins and my teammates' land between sums, «¡Recargando!» instead of a wait, and «¡SIX SEVEN!» during play (racha 7, the 67th coin, each team's waves at 67 gold with a crowd shout). Spec + scorecard `docs/specs/six-seven-v2.md` |
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
- **The 2026-10-13 remake (game menu look, `docs/specs/portal-remake.md`).** The home is a game menu: a hero with the kid,
  the level, Dralingo and one of the gang (a new friend and line every 12 s), a big gold **▶ Siguiente** (the next
  tarea in one tap), a dock (Desafíos · Mensajes · Mis oraciones · Mis exámenes) and quiet pills (Papás · Ajustes ·
  Instalar app · Salir); tap your avatar = Ajustes. Game-show moments on the phone: a welcome (the kid and Dralingo
  over a gold | sky split, once per visit), a results reveal for every tarea (count-up, stars, the kid + a gang member,
  confetti only when passed, a kind «¡Casi!» otherwise, ▶ Siguiente / 🔁 Otra vez), level-up and streak banners, a
  «¡Combo x3!» chip in the quiz. The parents' view is calmer (white report, a 2 × 2 grid of counts). All of it lives
  in `css/portal.css` + `js/portal.js` (without `hw-portal` on `<body>` the moments and the new styling switch off; a full
  rollback is reverting the commit, the home markup changed too); the gang poses it shows come from
  one map in portal.js (`POSES`).

**🔊 Audios de las tareas (`/audios`, 2026-10-11).** Every homework PDF (the storybook guides) has its audio on a
public page, no login: `/audios` lists the homeworks by level, `/audios/hsk1-e03-r1` opens one. Each has the PDF's
three tracks (EXP3.1 the words, EXP3.2 the dialogue, EXP3.3 the six video lines) with pauses to repeat, every line
tappable on its own, the line being read lit in gold. How new ones get there: Cowork saves each final PDF in
`ClaudeCode/TAREAS/`; when a Claude Code window opens, a check lists PDFs without audio, and I build them
(`tarea-audio` skill, about 5 minutes each). The voices are the platform's Google voices.

**📖 Audios y vocabulario: folders + «La base · Empieza aquí» (2026-10-14).** `/audios` is now a library of level
folders (YCT 1 · New HSK 1 · HSK 1). Pinned first in YCT 1: `/audios/yct1-base`, the study book «YCT 1 · Vocabulario»
digitally: the 83 words in its 6 worlds, each card like the book (number, picture, pinyin, Spanish, sentence with the
word in red), tap the picture to hear the word and the sentence to hear the sentence, a «¡Me la sé!» seal to stamp
(saved on the phone, progress per world and x/83), «Escuchar el mundo» plays a whole world, the tones with sound, the
repaso, and «Descargar el libro (PDF)». It is exported from the book's own source (`study/lib/web.py`), so the page and
the PDF never disagree; every reading was checked with local Whisper. YCT 1 kids see «Empieza aquí · La base de
YCT 1» on their /homework home. HSK 1 has its own base the same way (`/audios/hsk1-base`, «HSK 1 · Vocabulario»:
150 words in 8 worlds, pinned above its homework audios; HSK 1 kids see «Empieza aquí · La base de HSK 1»), and so
does New HSK 1 (`/audios/newhsk1-base`, «New HSK 1 · Vocabulario»: 300 words in 8 worlds, with the book's note on the
spoken tone changes yí ge, yì běn, bú shì; code 1002 kids see «Empieza aquí · La base de New HSK 1»).
Since 15 October 2026 each base opens with its level's key (see «Who can open a simulation or La Base» below): a
visitor without it sees the key screen at the same address, and La Ruta Dorada shows a gold lock on that level.

**🏆 La Ruta Dorada (the tab, 15 October 2026; was «Audios y vocabulario»).** `/audios` now opens like choosing a world
in a Nintendo game: one big glossy card per level (YCT 1 in Rojo Imperial, New HSK 1 in jade, HSK 1 in lapis; a new
level in core/levels.js gets its own card by itself), Dralingo in his kandura on a gold Dubai skyline (Burj Khalifa,
Emirates Towers, Burj Al Arab). Kids swipe (or drag, or tap ‹ ›, the dots, or the arrow keys) and the next card flies
in with depth and a little bounce, round and round; a kid who is logged in lands on their own level first, and so
does a phone that typed a level's key. Each card opens its **golden route**: 1 · La Base (with the kid's seals, «7 de
83 sellos»), 2 · El Entrenamiento (practice world by world, since 16 October), 3 · El Simulacro Dorado (the level's
simulations: YCT 1 sims 1-5, New HSK 1 sims 1-2, Old HSK 1 sims 1-10, each opening its exam player), then the homework
audios of that level (still open to everyone, the printed PDFs' links unchanged). A friend of the gang cheers along
the route with a new line each visit. Without the key the route shows its locks and one gold box «Escribe la clave de
YCT 1» (it opens the key screen and comes back to the route); a visitor also gets «Entra con tu código». The kids'
/homework home shows «La Ruta Dorada de YCT 1» (their seals), and the home page card says «La Ruta Dorada».

**🏆 Progress on the kid's account (La Ruta Dorada, step 3, 16 October 2026).** A kid logged in at /homework keeps
their «¡Me la sé!» seals on their account: stamp on one phone, open La Base on another and they are there (the
phone also keeps them while offline and saves them when the signal comes back). Seals a phone had from before the
kid's first login join their account; a brother's or sister's seals on the same phone never mix. A phone that only
has the key (nobody logged in) keeps its seals on the phone, as before. Your picks rule how the steps open: a seal is
a free tap; **El Entrenamiento opens world by world** (every seal of a world in La Base opens that world there), and
the route already shows it: «2 de 6 mundos listos para entrenar», one tile per world (a gold coin when it is ready,
its seals when not; a world that just became ready pops its coin once). **El Simulacro Dorado stays open with the
key** until El Entrenamiento exists; then (a switch in /maestro → Teachers → «La Ruta Dorada: cómo se abre», with the
% next to it, 70 by default; it can only be turned on once El Entrenamiento is published) it opens when every world
is practised with that % or more. «Salir» in Mis Tareas now also ends the kid's session on that phone, so a brother or
sister using the same phone never stamps seals on their account. In /maestro
each kid's profile shows La Ruta Dorada per level: seals per world, which El Entrenamiento worlds are open (their seals
or a teacher), El Simulacro Dorado, their best % per simulation, and «Desbloquear» / «Volver a bloquear» for one world,
every world or the Simulacro Dorado («Volver a bloquear» only undoes what a teacher opened). The student list shows a
thin gold bar of each kid's seals. The rules live in one place (`core/ruta-progress.js`); El Entrenamiento (step 4)
hands in each world's % there.

**🎯 El Entrenamiento (La Ruta Dorada, step 4, 16 October 2026).** Step 2 of every route is now real practice:
`/audios/yct1/entrenamiento` lists the level's worlds (the same worlds as La Base; HSK 1 starts with «Pinyin básico»,
open from the start, and every level ends with «Simulacro del examen», open once all worlds are ready) with the kid's
best stars and a gold meter of El Simulacro Dorado. A world opens when every word of that world has its «¡Me la sé!»
seal in La Base (or a teacher unlocks it). Tapping a world shows one big «¡A jugar!» card with three pictured steps
(Escucha · Toca la respuesta · Gana estrellas), then a quick round of 10 questions from that world's curriculum pack,
one at a time: the question is read aloud (La Base's own recordings when the word or sentence is in the book, the
platform voice otherwise) or, when the answers are pinyin, the four answers are read one by one and each tile lights
up; big tiles that press down; the server says right or wrong and only then which answer was right (green tile, the
answer read aloud), a streak counter with moments at 3, 5, 7 and 10 in a row, Dralingo or one of the gang reacting
in a sheet at the bottom with the big «Siguiente»; at the end the stars land one by one, the % counts up, a record is
celebrated and «Otra ronda» / «Siguiente mundo». The best % of each world goes on the kid's account; a phone that only
has the key keeps its scores (with a signed proof) and they join the kid's account at their first login on that
phone. **The Dorado rule is ON since this launch**: El Simulacro Dorado opens when every world has 70 % or more (or a
teacher's «Desbloquear»); kids who had already taken a simulation keep it open; a kid who follows a simulation's link
before earning it lands on step 3 of the route, which shows each world's best %. Your switch in /maestro → Teachers is
now called «El Simulacro Dorado se gana practicando» (ON by default; OFF = the key alone opens it, and it stays OFF if
you turn it off). Each kid's profile shows their best % per world. Answers never travel to the phone before the kid
answers, and El Entrenamiento never uses the homework endpoints.

**📖 El libro dorado (La Ruta Dorada, step 5, 16 October 2026).** The printed golden book of a level's simulations
(«YCT 1 · Simulaciones», «New HSK 1 · Simulaciones», «HSK 1 · Simulaciones») on the phone, inside El Simulacro
Dorado: `/audios/yct1/libro/1` is Simulacro 1's book. **It opens once the kid has taken that simulation** (on their
own, as homework or in your room: a graded try on their account with at least half of the questions answered; a try
handed in blank or with a question or two does not count), so the simulation stays a real test and the book is the
review. It opens on **«Repasa tus N errores»**: the
questions of their latest try that went wrong, each a full card with the kid's own answer marked, then «Mis
resultados» (right answers per part), «Así es el examen» (the solved examples, folded) and the whole simulation part by
part. Every card is the book's own: the exam's photos as the book prints them (a tap shows one big), a gold play
button with the original exam recording of that question only (cut from the recording; old HSK uses its own clip
per question), the pinyin with tone marks, the Spanish and the answer in gold. Zero mistakes = a celebration line from
the gang. **Taken anywhere is enough** (your pick after the build): a simulation taken in your room opens its own
book even before the kid earns El Simulacro Dorado (the route keeps showing how the Dorado opens, plus that
simulation's «Libro dorado»); the other simulations and the PDF still need the Dorado. **The PDF downloads once every
simulation of the level is taken and the Dorado is open** (a web copy under 9 MB); before that the page and the route
say how many are left, or that the PDF comes with El Simulacro Dorado. On the route, a simulation the kid took gets a red «Libro dorado» ribbon
with its mistakes count; a phone that only has the key is asked to «Entra con tu código» (the book lives on an
account). Teachers see every book and the PDF; in a kid's profile each simulation they took shows its mistakes and
«📖 Ver su libro» (that kid's mistakes view; the link works only on a teacher's device, and a kid holding it sees only
their own book). Nothing of a book travels to a phone that may not open it: the questions come one simulation at a
time from the server, and the photos and clips are served by number, checked on every file. The content comes from the
same source as the printed book (`../study/lib/examweb.py`): fix a line in the study book, rebuild it, export again.

### 2.4 Parent control

Parents open their child's progress with the same codes. A privacy guard makes sure a code only
opens the matching child.

- progress bar (0 → 2000), activities, saved sentences
- **📝 Exámenes reales**: the child's official-test results
- **report cards**: the teacher's notes become a branded monthly report card ("Generar reporte")
- word-list audio, and an English dashboard option

### 2.5 Teacher dashboard (`/maestro`)

**The control room (remade 2026-10-13, spec `docs/specs/maestro-remake.md`).** Same features, laid out for the first
five seconds of a class, in the platform's paper-and-navy sticker look (light, so it reads on a projector):
- **Start the class** at the top: one big gold «🚀 Launch a game» (the last game is already picked), then «✏️ Live
  Teacher Mode» and «🏆 Official tests», with «📖 Reading in class» and «🧠 Sentence practice» under them.
- **Online now** beside it: the online kids' avatars standing on the Dubai waterfront with a big count (tap a kid for
  their profile), and the three class actions: 📢 Message the class (now a form, not five pop-ups), 🎬 GIF, 🏠 Send home.
- **Students** below: online kids first, then everyone else; search, filter chips (Online / per level) and a class
  picker that survive the 15 s refresh; level, class, daily challenge, ⚔️🔥📝📚🏆 and last seen on every row;
  «📦 N archived» in the header. **Tools** on the right: Test results, Special assignment, Classrooms, Guides, Backup,
  My Gateway (super admin).
- Pop-up messages became small notes at the bottom of the screen that never freeze the class; every window closes with
  Esc or ✕; the Teachers tab hides the private teacher codes until you tap «Show». Phones get the same page in one
  column, with windows sliding up from the bottom.

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

**Who can open a simulation or La Base (locked since 15 October 2026, the first step of «La Ruta Dorada»):**
nothing of a module is free any more. One **secret key per level** (YCT 1, New HSK 1, HSK 1; you set them in /maestro →
Teachers → «Claves de nivel», and «Copiar mensaje para WhatsApp» gives you the message for the families) opens all
three levels of that module: La Base, El Entrenamiento and El Simulacro Dorado. Pages, questions **and** the
recordings, pictures and the La Base PDF are protected:
- **A family** types the key once on the key screen (big, Spanish, Dralingo, one field, «Entrar»). That phone keeps it
  for a year; if the kid is logged in at /homework, it is also saved on their account, so their other phones open too.
  Wrong guesses are limited (5 per phone, 30 per internet address in 15 minutes, then a short wait).
- **Kids registered before you set the first key** keep their level without typing anything (once they log in at
  /homework). New accounts need the key. A kid who moves up a level needs the new level's key.
- **You can open any kid early**: «Desbloquear» in the kid's profile in /maestro.
- **A kid in your room** gets in with your PIN, no key, for that room's simulation only. «Terminar sala» on the monitor
  really closes the room: its PIN, page and files stop working (a kid who already finished can still hand in).
- **A teacher** opens everything. Creating any game needs your teacher code the **first time on a device** (the
  /maestro login does it, or the teacher-key screen that appears on the game page); then that device is remembered for
  90 days. «Log out» in /maestro forgets it.
- **Changing a key**: the old key stops working for new phones; phones that already opened the level keep it. If a key
  leaks outside the school, change it and press «Cerrar en todos los aparatos» (families type the new key once; kids from
  before the keys and kids you unlocked keep it; they get it back at their next
  login to Mis Tareas).
- **Your own code**: «Cambiar mi código» in /maestro (you can also change any teacher's code in the Teachers tab). The
  old code stops at once everywhere and can never be used again.
- **Homework stays exactly as before**: /homework (class code + name or student code) and the audio pages of the
  printed homework PDFs (/audios/<homework>) are open as always.

The recordings and pictures now live in a locked folder of the code (`protected/`), never as public files: the
platform hands each phone links that expire after 3 hours and work for one simulation only. One thing it costs:
Cloudflare can't keep a copy of locked files, so each phone downloads the exam audio from our server (YCT ~3.5 MB,
New HSK ~10 MB per kid).

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
  - **Admin password:** you set `WU_ADMIN_PASSWORD` on Render (since 2026-10-15 there is no default in the code: if it
    is not set on Render there is no backup password, only teacher codes).
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
     `yct-sim.html?debug=1&direct=1&sim=yct1-sim2&view=reading&rc=13`, or
     `yctDebug.seek(195)` to jump the audio (these switches only work on the copy on your PC, never on the live site)
   - `node scripts/test-sims-lock.js` checks the simulation lock from every side (anonymous visitor, each level's
     student, teacher, a room PIN before and after the room closes, expired and forged links);
     `node scripts/test-level-keys.js` checks the keys (anonymous, right/wrong keys and their limits, grandfathered and
     new accounts, key changes, teacher devices, «Cambiar mi código», restarts)
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
| 13 | Deploy | Commit the data **and the picture/audio folder** (`protected/<TEST> SIMULATIONS/…`, locked: the import writes there), push, confirm live |
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
  - **never open to anonymous visitors**: only teachers, kids in a teacher's room, and whoever has that level's key
    (typed on the phone or saved on the account, or registered before the keys)
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

- **La Ruta Dorada** (plan `docs/specs/ruta-dorada.md`): steps 1-5 are built: the key per level (La Base + the
  simulations behind it), teacher devices for hosting, «Cambiar mi código», the tab itself (the flying module
  cards, each module's golden route), progress on the kid's account (seals on any phone, «Desbloquear» / «Volver a
  bloquear» per step, the rules in /maestro), El Entrenamiento (quick rounds per world, the Dorado earned by
  practice) and El libro dorado (each simulation's book once taken, mistakes first, the PDF once all are taken).
  First week of El libro dorado: listen to a few play buttons per level (each clip is cut from the exam recording by
  the times the import measured), and say if the book should also open for a kid who took a simulation in your room
  before earning El Simulacro Dorado (today it follows the Dorado's door). First week of El Entrenamiento:
  listen to a few questions per level on a real phone (the platform voice reads some sentences from toneless pinyin;
  wrong readings are fixed in `core/entrenamiento.js` speechText), and watch whether 70 % per world is the right bar
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
