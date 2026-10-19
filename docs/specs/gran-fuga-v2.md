# La Gran Fuga de Dubái v2 · «Las rutas de la fuga» (gameType `escape`)

Address `/host-escape.html?setId=…`, gameType `escape`, the teacher flow (/maestro launcher, `/packs.html?game=escape`,
`?livegame=1`) unchanged. Remade 2026-10-17 on a branch, not deployed. v1 and its «As built» notes:
`docs/specs/gran-fuga-de-dubai.md`. Model: Dragones Pintores v2 (`docs/specs/dragones-pintores-v2.md`).

## Why
Fernando picked it next after Pintores v2 (kids loved real worlds). The scorecard was 13/14: Robotín's world (a sky
gradient, a hazy skyline, a plain floor) and the zona segura rooms (a checkerboard tile grid) were drawn with shapes.
On a phone the run was a thin progress bar and the room used half the screen.

## His picks and the rules that frame it
- **Dubai is the main stage, China's wonders round it out** (root CLAUDE.md «Not everything is Dubai»): real-looking
  places, unbranded, kid-safe (no text, logos or QR in the art, nobody touching).
- **Keep what the game is:** a co-op crew escaping zone by zone from Robotín, the «zona segura», answering to power the
  escape, Hamdan's jet at the end, co-op stars, the crew never ranked. Keep the teacher flow, the address, the gameType.
- **Everything else may change** if it makes it better: rooms as real art scenes, Robotín's world, bigger readable
  characters, phone clarity, the escape's drama.

## The routes (one per round; «Otra ronda» = the next route; the teacher can pick another in the lobby)
| # | Route | Zone 1 | Zone 2 | Zone 3 (the jet waits at the end) |
|---|---|---|---|---|
| 1 | **Ruta de Dubái** (first: the main stage) | Museo del Futuro | La Fuente del Burj Khalifa | La pista del aeropuerto |
| 2 | **Ruta de China** («¡Robotín los persigue por el portal del Museo!») | El Mercado Nocturno | El Jardín Chino | La Gran Muralla |

Each zone has its own art (Higgsfield Unlimited, glossy 3D, in his Chrome): a far background, a ground strip the crew
runs on (parallax, mirror-tiled), and a top-down room for its zona segura; between zones the crew runs through a gate
of the next place (a glowing museum door, a golden arch, a red Chinese gate, a moon gate); at the end of each route
Hamdan's jet (unbranded) waits with its stairs down. Ranks keep their ids, named for the route (Dubái: Pilotos del
Cielo · Viajeros del Burj · Exploradores del Zoco; China: Pilotos del Cielo · Viajeros de la Muralla · Exploradores
del Mercado).

## What changes
- **Robotín's world (the run):** the zone's far background + its ground strip scrolling under the crew (parallax),
  the gate or the jet coming into view in the last metres, bigger runners and Robotín, Dralingo at the front.
- **The zona segura rooms:** square rooms (16×16 tiles: the whole room fits a portrait phone too) drawn as the zone's
  painted top-down scene; the walls and the big objects in the picture are the room's walls (authored per room), plus
  a few seeded props of the place for variety; the green zones glow on top. Name tags never overlap on the projector.
- **The phone during the run:** the thin rail becomes a live chase strip on top of every question and result: the
  zone's art, my character big with «TÚ», crewmates around me, Robotín behind at his real distance, the gate / jet
  arriving. A right answer = my character dashes ahead in the strip (and the crew surges); a zap = lightning on me.
- **The escape's drama:** the crew runs to the jet, boards it, the jet takes off while Robotín arrives too late (the
  projector stages it on the route's last scene; every phone shows its own boarding).
- **Pacing (known issue: 4-minute rounds ended one wave short of the jet):** each run's pace is set from the time left
  on the clock (the remaining runs share what the remaining zonas seguras don't need), and the zona segura is a little
  shorter (waves 10 / 9.5 / 9 s, 2.5 s rest). A class that keeps answering reaches the jet at 4, 5 and 6 minutes;
  default stays 5 min.
- **The F5 of the projector keeps the room** (sessionStorage + `host:reclaim` with its token, like Pintores).
- **The playtest's notes:** «Más rápido» no longer goes to a kid who stood next to a zone when it lit up (they must
  start more than a tile away); name tags no longer overlap in the projector's room.

## What stays
The rules engine (`core/escape.js`: turbos, súper turbos, Robotín's rubber band and glitch sprints, the tickle-zap,
hearts, the free distracted kid in ten, the replay of a caught zone, «Saltar zona», súper turbos in the last 30 s), the
shared Mario Party ending (`core/party.js`, `js/party.js`) with Fuga's four co-op stars, the phone bands and cards, the
teacher controls (⏸ Pausa, +30 s, ⏭ Saltar zona, Terminar ronda, ⏭ Saltar, Sonido, Otra ronda), the sounds and music.

## Scorecard target
14/14: product feel 2/2 = real art for the run and the rooms, Robotín's pictures, the phone strip as finished as the
projector at 390 and 360 px.

## As built · 2026-10-17 (branch `escape-v2`, not deployed)

What changed from the plan above, after four reviews (below):
- **Stars count how far the crew got**, not hearts alone: escaped with 3+ hearts = 3 stars («Pilotos del Cielo»),
  escaped = 2, two places cleared = 2 («Viajeros del Burj / de la Muralla»), otherwise 1. A crew that escapes always
  beats one that doesn't.
- **The zona segura forgives a few stragglers:** one kid in five may stay out for free; the crew loses 2 ❤️ only when
  more than 40 % are out.
- **Close calls for a crew far ahead:** Robotín's glitch sprint lunges at a crew more than 3 m past the alarm line and
  stops («trips») as soon as he reaches it: a lively class hears «¡Robotín se acerca!» in every run, without zaps.
- **The projector's run:** the crew in two staggered rows, at most 12 runners shown (a kid on a turbo always shows,
  «+N más» for the rest), every name chip with its own kid (front row under the feet, back row over the head), the kid
  on a turbo jumps ahead cheering with a gold ring; full-body characters everywhere in the play area.
- **The escape:** the crew walks up the stairs, their faces show at the jet's windows, the jet rolls left and climbs over
  Robotín (dizzy); no turbo chips or guide bubbles over it (the ribbon is the only text); the meter leaves Robotín
  behind.
- **The zona segura on the projector:** the wave's result in the left card («✓ 8 a salvo · ⚡ 2 fuera · −1 ❤️»), the
  place in the right card, the room clear.
- **The phone:** the strip's numbers sit in a row under its picture (❤️ · «🤖 Robotín a 21 m» · «El Museo · 1/3»),
  never over Robotín or me; the moments («¡Robotín se acerca!», «¡Zap!», «Pausa») show inside the strip, so the question
  and the tiles stay clear; in a zona segura they sit at the bottom beside the joystick (the room stays clear); the
  room's camera fits the floor to the phone's width; my dash never leaves the strip; my full-body character on the
  result and on the escape card (walking to the jet's door); the cleared card is a postcard of the next place.
- **The ceremony** shows the place the crew reached (the whole picture, softly, on a phone) and the route's postcards.

### Files
- Rewritten: `public/js/escape-map.js` (routes, zones, 16×16 rooms with walls authored per picture, UMD: server, phones,
  bots), `public/js/escape-render.js` (the shared canvas renderer: scene, gate / jet, Robotín, full-body kids, rooms,
  name chips that never overlap), `public/host-escape.html` + `public/js/host-escape.js` (the projector: route card,
  F5 reclaim, run / room / escape), `public/js/player-escape.js` (the phone: chase strip, room, cards, lobby),
  `public/css/escape.css`.
- Changed: `core/escape.js` (pacing from the clock: `zoneSeconds`, `retimeRun`; shorter waves; lunge sprints; reach
  time minus the walk; stragglers; stars by progress; the route), `server.js` (the escape block only: `esRoute`,
  `host:es-route` in the lobby only, «Otra ronda» = the next route, a retime at every run), `public/js/party.js` +
  `public/css/party.css` (the route's postcards in «¿Hasta dónde llegó la tripulación?», the jet faces its way, the
  place behind the ceremony), `?v=` bumps on the pages that load them, `games.html`, `maestro.js`, docs.
- Tests: `scripts/test-escape.js` (rewritten), new `scripts/test-escape-live.js`, `scripts/test-party.js`,
  `scripts/playtest/escape.js` (route-aware rooms).

### The art (Higgsfield Unlimited in his Chrome, 0 credits, no reference uploads; he was not using Higgsfield)
35 WebP, 1.6 MB, in `public/assets/escape/`: per place a far background (`bg`), a lobby / postcard thumbnail (`bg-s`),
the ground strip the crew runs on (`ground`) and its zona segura room seen from above (`room`); four gates (museum
door, golden arch, red Chinese gate, moon gate), Hamdan's jet (unbranded, faces left, door at 20 %), the room props.
Per place: Museo 130 KB, Fuente 249, Pista 131, Mercado 292, Jardín 456, Muralla 157 (its far background reused from
Pintores v2); gates + jet + props 181 KB. Originals + log: `assets-library/higgsfield/2026-10-17/escape2/`. A place
loads only when the crew gets there (the next one preloads during the zona segura).

### Tests
| Test | Result |
|---|---|
| `node scripts/test-escape.js` (both routes complete; 300 seeds × 2 routes × 3 rooms: walls, dock, zones reachable, nothing on a wall; the pace and its clamps; whole episodes on the clock at 4 / 5 / 6 minutes with 5-30 kids; reach time minus the walk; close calls; stragglers; stars by progress) | ~652,000 checks pass · an average class reaches the jet 6/6 at 4, 5 and 6 min (16-34 s spare at 4-5 min) · a lively class hears «¡Robotín se acerca!» in 18/18 runs, 0 zaps · zone 3: an average class 4-8 zaps in 24 runs, a strong one 0 |
| `node scripts/test-escape-live.js` (real sockets: the route pick (lobby only), the same rooms on every screen, a run, turbos, a zona segura wave, Pausa, +30 s, Seguir, «Saltar zona», the projector's F5 reclaim, a late joiner, Terminar → the ceremony with the route and its rank, «Otra ronda» = the next route) | 51 checks pass |
| `playtest-bots.js --game escape --seconds 60` | 4 bots PASS (40 questions) · 20 PASS (170) · 30 PASS (231) · 0 frozen · 0 errors · 30 bots × 5 min escaped («Pilotos del Cielo») |
| Every live test (`run-live-tests.js` on a throw-away server: dragon, escape, halcon, mochi, monopoly, paint, party, pinata, sixseven) | 9/9 pass |
| Every suite (`run-all-tests.sh`: the 24 `scripts/test-*.js`, incl. audios-base with `STUDY_DIR`) + `asset-guard.js` | 0 failing |

### Reviews and what changed
- **Code review** (agent-skills:code-reviewer, no critical): fixed the strip reading the layout every frame (size
  cached on mount / resize), a reconnect that lost its card, the strip running on after the end, a phone waking from
  sleep, 4 fps while paused, the next place preloaded (and the room at 60 m), postcard thumbnails, `host:es-route`
  accepted mid-round (lobby only now), «Más rápido» given to a kid who stood next to a zone (reaction time: the walk is
  subtracted, a kid already inside is skipped), the hearts' order, a stale wave, a leaked timer, dead v1 code.
- **Classroom playtest** (real browsers: projector + phones at 390 and 360 + socket kids; bots 20/30 × 5 min PASS):
  fixed stars that rewarded a crew that never escaped, stragglers costing hearts for one slow kid, «TÚ» hidden under the
  strip's numbers, kids spawning under Robotín, the 640 px phone, a late joiner during a pause, a paused room showing
  two cards, the projector's F5 losing the wave title, the ceremony's subtitle on a dark picture, a small turbo.
  Reported, not changed: a second kid typing the same name takes the first kid's phone over (platform-wide); the
  súper-turbos band can come just before a zona segura; after F5 the music waits for a click (browser autoplay).
- **Fresh-eyes design review** (stills, «fix»): the projector's crew in two rows with names on their own kids, +N, full
  bodies, the turbo kid cheering; the escape clean with faces at the windows; the wave's result in the left card; the
  phone's numbers row, moments inside the strip / beside the joystick, the floor-wide camera, full-body me on the result
  and the escape card, the cleared card's title clear of the postcard, the ceremony's backdrop, a shorter lobby, the
  intro line, bigger level chips. Also fixed while re-shooting: Robotín's picture on the «nos alcanzó» card filled the
  room (a canvas rule of the room).
- **impeccable detector** (once, on the game files): fixed empty <img> sources. Kept: outlined titles (the shared
  Reinos look), the red inner glow while Robotín is close (the alarm), cards in cards (the platform's card look), bounce
  easing (a kids' party game, as in the other remakes).

### Scorecard · La Gran Fuga v2 · 2026-10-17 · branch `escape-v2`
```
Hard gates: bots PASS (4/20/30, and 30 × 5 min) · teacher controls ✓ (⏸ Pausa, +30 s, ⏭ Saltar zona, Terminar, Sonido,
            Otra ronda = next route, route pick in the lobby, F5 reclaim) · saga only ✓ · Spanish/pinyin/level ✓
            (questions from the packs; no hanzi on the phone) · kid-safe ✓ (no text/logos in the art, nobody touching)
1 Real place ........ 2/2  two routes of real places (Museo del Futuro, la Fuente del Burj Khalifa, la pista; el Mercado
                           Nocturno, el Jardín Chino, la Gran Muralla), a gate to the next place, Hamdan's jet at the end
2 The gang .......... 2/2  Fer's episode intro, Dralingo leads the run, a cast cheer at every place cleared, Hamdan waves
                           the crew aboard, every kid's full-body saga character on both screens
3 Every tap ......... 2/2  a right answer = my character dashes ahead in the strip + the crew surges; «Así se juega» with
                           the route; the joystick hand; the room's arrow to the nearest green zone; big tiles
4 Feedback .......... 2/2  turbo / súper turbo / zap / a salvo / fuera each with its own reaction; moments one at a time,
                           inside the strip on a phone; the projector's turbo chips throttled to a few at once
5 Finale ............ 2/2  «¡Robotín se acerca!» alarms, súper turbos in the last 30 s, the boarding + take-off, «¡FINAL!»,
                           the route's postcards «¿Hasta dónde llegó?», co-op stars, every kid's card
6 Fair, no stall .... 2/2  co-op (never ranked), the pace set from the clock so the jet is reachable at 4-6 min, free
                           stragglers, a caught place replays, every wait timed out, Saltar zona
7 Product feel ...... 2/2  Higgsfield places, rooms, gates, jet + Robotín's pictures; recorded music and sounds; the phone
                           strip at 390 and 360 as finished as the projector at 1600×900
Total 14/14 → ships (≥ 12, no 0)
```

### What to watch in the first real class
- **The first zona segura.** Kids must walk to a green zone with the joystick; watch whether the youngest find it in
  the 10 s of the first wave (the arrow points the way; one kid in five is free).
- **Robotín's alarms.** A class far ahead now gets lunges; if «¡Robotín se acerca!» comes too often for a strong class,
  raise `LUNGE_FAR` in `core/escape.js`.
- **4-minute rounds.** The pace is set from the clock; a slow class (far under 0.09 right answers per kid per second)
  still won't reach the jet: a 5- or 6-minute round (the lobby's time slider) gives it room.
- **China route art on a slow school network:** the Jardín is the heaviest place (456 KB), loaded during the Mercado's
  zona segura.

## Chase pass · 2026-10-19 (branch `escape-chase`, not deployed)

### Why
His words after playing v2: "I love how the robot is animated but … kids will never look at the teacher dashboard …
there are no zap sounds whenever the little robot electrifies … the robot is not chasing you at any time, just in the
animation while you're busy answering, that's why it doesn't really feel like a persecution, and I don't think the sound
matches the vibe of the game … it doesn't feel like a minigame where you're afraid of a robot … you got 70% right but
there's this 30% that really makes the difference". What we found: Robotín chased the CREW as one group (a strong class
got 0 zaps a run, nobody was ever personally in danger); `zap.mp3` peaked at −24 dB (inaudible under the music: it was
there and nobody could hear it), `turbo` −15 dB, `super` −18 dB, `glitch.mp3` was a 27 ms click; the projector's music
was a 10.5 s Kenney loop; the beautiful zap lived on the projector only.

### What changed
- **Robotín chases ME** (`core/escape.js` `stepChase`, `chaseAnswer`, `chaseView`, the `CH_*` constants). Every kid has
  their own distance to Robotín (`p.esGap`, 14 m at the start of every run, never more than 16 m), judged by the server.
  He closes in second by second only while MY question is open (not on the result screen, in his 3 s wake, a pause, my
  stun or my shield). His speed follows my own pace and accuracy (`CH_K` metres per question at my usual pace, × 0.55-1.12
  by my recent accuracy): every kid feels him come in every question, and what keeps him away is answering RIGHT. A right
  answer = I dash 7.5 m away (a súper turbo 9.5 m), a wrong one = he gains 2.5 m (a stumble alone never zaps). Every
  18-32 s of my open questions, if I am more than 9 m ahead, he LUNGES (a siren): 1.8 s at 1.5× plus a swoop down to
  5-7.5 m behind me; for 3 s after a lunge he can only trip, never zap (a scare, not a trap).
- **The personal zap**: when he reaches me, a full-screen electric moment on MY phone (my full-body character in an
  electric halo, his lightning from the broom, crackling arcs, sparks, one soft flash, «¡ZAP! ¡Robotín te alcanzó!»), the
  crackle + buzz sound, a long vibration; then my tiles locked under a draining ring with the seconds (1.8 s in all; the
  question's 20 s clock waits, so my question is never shortened), then a 3.5 s shield (a cyan bubble around me, he
  waits). Never out of play: the same question is mine again. **Fairness**: at most one zap per kid every 45 s (reached
  inside that, he trips back to 6 m: «¡Robotín tropezó!»), the gap resets to 14 m after a zap and at every new run.
  **A personal zap costs the crew nothing** (co-op, nobody is blamed). The crew-wide zap of v2 (the whole crew caught,
  rare) now only slows the crew: it no longer locks every phone for 3 s (the whole-episode simulation showed those locks
  cost a 5-kid class the jet in 6-minute rounds).
- **Fear that builds with MY distance** (phone, `public/js/player-escape.js`): the strip draws MY Robotín at MY distance
  (16 m = the strip's left edge), bigger as he nears, his eyes glowing red and a red glow behind him when close, his
  antenna a red / blue siren in a lunge, «¡Detrás de ti!» over his shoulder under 4 m; his treads (metal clanks) faster
  and louder as he nears (every 950 → 270 ms), my heartbeat under 7 m (880 → 440 ms) with a light buzz under 4 m; the
  screen's edges pulse red (one fixed layer UNDER the question and the tiles, three levels, opacity only); the row's pill
  says what he is doing («🤖 Robotín a 12 m», «¡Está a 6 m!», «😱 ¡Está detrás de ti!», «🚨 ¡Robotín acelera!»,
  «😵 ¡Robotín tropezó!», «⚡ ¡Zap! Espera…», «🛡️ ¡Escudo! Responde»). The result says what my answer did («💨 ¡Lo
  alejaste! Robotín a 14 m», «😅 ¡Por un pelo!», «🤖 Robotín se acercó: a 4 m») while the strip shows the gap open
  (+7,5 m) or me stumbling. Light on cheap phones: the strip's one canvas at ~30 fps, no layout read per frame, the
  treads and heartbeat through Web Audio (decoded once), the zap's halo drawn once into a sprite. Reduced motion: no
  flash, no shake, no pulses (the sounds stay); the global mute silences all of it. Phones play no music any more.
- **Sound that matches** (`scripts/escape-sounds.js` builds them all, peak −4 dB after a limiter: mp3 rings over metal
  clanks): `zap-crackle` (Kenney zap2 + forceField buzz + a flickering computerNoise crackle + an explosionCrunch snap),
  `spark` (his sparks / glitch, replaces the 27 ms `glitch.mp3`), `siren` (highUp/highDown wee-woo over radar1 and his
  engine), `step` (impactMetal clank + concrete thud + servo rumble), `heartbeat` (impactSoft heavy + medium, low-passed),
  `dash` (two wooshes), `stumble` (a punch thud + phaserUp), `shield` (forceField + powerUp2), `trip` (impactMetal +
  plate + a falling «piu»), and `turbo-v2` / `super-v2` / `heart-v2` (the same Kenney sources as before, at a level kids
  hear). All from the free CC0 Kenney packs in `assets-library/kenney/` (only the outputs are committed). 13 files,
  1.1 MB with the music.
- **Music that reacts** (projector only, `public/js/host-escape.js` `MUSIC` + `MOODS` + `Deck`): ONE chase track for the
  whole episode through Web Audio, its mood set live: calm (Robotín asleep, between places: muffled), chase, danger (the
  crew's alarm, his sprint, or a quarter of the class with him right behind them: 7 % faster), zone (the zona segura:
  hiding, the chase muffled outside), final (the last minute: 12 % faster). The track, **his pick 2026-10-19: «Desert
  Storm» (drum & bass) by lemonmusicstudio, Pixabay Content License**
  (https://pixabay.com/music/drum-n-bass-desert-storm-109271/; free in a game, never a standalone download; «Content ID
  Registered»: a YouTube/Instagram video using it may get a claim). The full track stays in
  `assets-library/pixabay/2026-10-19-escape-music/`; the game ships a 70.2 s loop (24 bars at 82 / 164 BPM, 112 kbps
  stereo, 0.95 MB): cut on the first beat of a bar (the beat whose kick is the strongest), whole phrases, where its end
  flows back into its start (likeness 0.98), its first 40 ms crossfaded from what follows its end, written with a
  quarter second of itself before and after so the encoder's padding never makes a gap. Seam check (decoded, as a
  player hears it): the high-frequency energy at the loop point sits at the median of the ±240 ms around it, no spike.
  **To swap**: `node scripts/escape-sounds.js --music <track.mp3>` writes `music-chase.mp3` and prints the one line for
  `MUSIC.chase`. The old `music-run.mp3` / `music-zone.mp3` are gone (the first placeholder loop never shipped).
- **The projector is secondary** (his words) and stays beautiful: who Robotín zaps (lightning from his broom to that
  runner, the runner dizzy, a cyan chip «⚡ ¡Zap de Robotín!» with the kid's name, the crackle at most every 0.45 s), red
  rings on the kids he is right behind, his eyes red and his antenna a siren in a sprint (which now plays the siren and
  his sparks, not the 27 ms click). The how-to steps say «¡Robotín te persigue!» / «¡Robotín persigue a cada uno!».
- The ceremony's card adds «N escapes de Robotín por un pelo» (dashed away from under 4 m).
- Server: per kid an `es:g` during a run (`{ g, v, st, sh, lu, lt }`, volatile, at most ~3 a second and only when
  something changed: the phone glides between with the same formula), events to that phone only (`es:pzap`, `es:lunge`,
  `es:trip`, `es:near`), `es:pzap` with the name to the projector, `es:nz` (the kids in danger) to the projector only
  when it changes, `me.ch` + `pzaps` in `es:init` (a phone back mid-stun gets its lock with the time left), `gap` /
  `from` in `answer-result`, `chase` constants in `es:init` (one source). An answer during a stun is refused
  (`answer-stale` «stunned»). A pause moves every chase timer.

### Numbers (`scripts/test-escape.js`, 30 runs × 3 zones × 3 min per kind of kid, a new run every 45 s)
| Kid | answers | zaps a minute of running | questions with him under 7 m | «¡Está detrás de ti!» |
|---|---|---|---|---|
| strong (3.5 s, 92 % right) | 11.6 / min | 0.08 | 14 % | 4 % |
| average (6 s, 72 %) | 7.4 / min | 0.21 | 31 % | 12 % |
| slow (11 s, 50 %) | 4.4 / min | 0.26 | 53 % | 30 % |
| young (14 s, 45 %, time-ups) | 3.7 / min | 0.23 | 60 % | 34 % |
| away (never answers) | 2.7 / min | 0.22 | 88 % | 42 % |
Cap 1.33 a minute (one per 45 s); never a zap every question; he comes closer in (almost) every question for every kind.
Whole episodes on the clock (every kid's Robotín running, a stunned kid not answering): an average class still reaches
the jet 6/6 at 4, 5 and 6 minutes with 5, 12, 20 and 30 kids (17-82 s to spare), with 0.6-2.1 personal zaps per kid per
round.

### Tests
| Test | Result |
|---|---|
| `node scripts/test-escape.js` (+ the chase: closing only with a question open, wake / pause / stun / shield, dash, stumble floor, zap → stun → shield → reset, trip inside 45 s, «detrás» once, lunge swoop, new run, pause shifts, crew zap locks nobody, the kinds of kids, the episodes, a pause mid-stun, an answer while paused) | 652,262 checks pass |
| `node scripts/test-escape-live.js` (+ real sockets: my own Robotín a few times a second and closing, dash / stumble in the answer, a kid who keeps missing gets zapped on her phone only (projector hears who; every zap on exactly one phone), a phone back mid-stun gets its lock with the time left, the lock ends by itself with the shield up, she answers again; an answer during the stun refused, no dash; the same question back after a reconnect mid-stun; a resync of the same phone gets no shield) | 69 checks pass |
| `playtest-bots.js --game escape --seconds 60` (the bots answer at random: 25 % right; a bot taps again after a «stunned» refusal) | 4 PASS (4 personal zaps) · 20 PASS (6) · 30 PASS (7) · 0 frozen · 0 errors · `es:g` at most 1.9 a second per bot (ceiling 4) |
| `test-party.js` · `asset-guard.js` | pass |

### Reviews and what changed (round 2)
- **Code review** (agent-skills:code-reviewer on 079e6825c, «no critical»), with the main window's list:
  - the projector's chase music played on through «¡FINAL!» and the ceremony (a pause's «Seguir» path restarted it):
    an `ended` flag from «¡FINAL!» / game-end to the next countdown;
  - the stun was only enforced on the phone: the server now refuses an answer during a stun (`answer-stale`
    «stunned», the question stays the kid's, the phone taps again after) and never deals the next question inside one;
  - a pause during a stun unlocked the tiles: the phone holds its stun through the pause and puts the lock back on
    «Seguir»; `chaseView` reads the paused moment, not the wall clock;
  - the lock vanished when the question was re-sent (a reconnect): it goes back on top; the red edges and a stun or
    shield never outlive the run (zona segura, cards, «¡FINAL!», a new countdown);
  - load: the danger list goes to the projector only when it changes (`es:nz`), `es:g` only when something changed and
    volatile (a bot measured ≤ 2 a second, was 3.3), the zap's full-screen canvas gives its memory back when hidden,
    the light buzz only on the first 3 heartbeats of an approach, an answer while paused forgets its open time;
  - a phone whose question has been open more than 25 s of its own time (locked, in a pocket) is no longer chased nor
    shown in danger on the projector; a phone back in a run gets 2.5 s of shield; the phone glides only while the
    server is really talking to it (no chase played under a Wi-Fi drop);
  - the zap's pictures and halo are made before the first zap, the strip stops drawing under the full-screen zap, the
    reduced-motion check is read once, the lightning holds still under reduced motion, a pause holds the projector's
    track where it is (it used to start again from the top).
- **The zap screen** now shows Robotín as he caught me: his chase look with red glowing eyes in a red glow, the lightning
  from his antenna (it was his smiling «zap» picture with the broom).
- **Real-browser flow** (playwright-cli, `scratchpad/flow.sh`): pause mid-stun (the lock holds through the pause,
  comes back with the time left, ends by itself), a stun across the change to the zona segura (gone, no red edge),
  «Terminar» mid-stun (lock gone, the projector's music silent through «¡FINAL!» and the ceremony), «Otra ronda»
  (lobby, nothing left): 14/14.
- Tests added: `test-escape.js` (a pause mid-stun: the view holds the time left, «Seguir» goes on with it; an answer
  while paused moves nothing and forgets its open time), `test-escape-live.js` (an answer during the stun is refused,
  no dash; the same question comes back after a reconnect mid-stun), the bot handler (a ceiling of 4 `es:g` per
  bot-second; a bot taps again after a «stunned» refusal, like a kid).
- **Classroom playtest** (classroom-playtester agent: projector 1600×900 + phones at 390×844 and 360×640 + 15-17 socket
  kids of their own pace and accuracy, 4 rounds of 4 minutes with Pausa / +30 s / Saltar zona / Terminar / Otra ronda,
  reloads mid-run and mid-stun, one phone left unanswered; bots 20 and 30 × 120 s PASS, 0 frozen, 0 errors, every
  ceremony card): no freezes, no dead phones, no console errors, every phone got its question back (longest gap 2.7 s),
  no chase leak into the zona segura or the ceremony, the projector's music through every mood and silent from
  «¡FINAL!». Fixed after it:
  - a pause during a zap left that phone locked after «Seguir» for about the pause's length (the phone's own 12 s
    resync re-started the stun from «now»): the phone's chase clock now holds at the moment the pause began, like the
    server's; a real zap + a 15 s pause + «Seguir» ends the lock with the time that was left (flow check);
  - that same 12 s resync handed out the 2.5 s rejoin shield (free shields for a kid who was just thinking, and a whole
    class unchased for the pause's length after a long pause): the shield is given only when a NEW socket takes the
    kid over, never during a pause (live test: a resync of the same phone gets no shield);
  - red rings under «¡FINAL!» on the projector (cleared at the final); the strip's place label lost its «1/3» to a long
    pill (the counter comes first now: «1/3 · El Museo»).
  - Reported, not changed (older than this pass): at 360×640 the «Sonido» chip covers part of the lobby's «Así se
    juega» card.
- **Real-browser flow** now 18/18 (the long-pause-after-a-real-zap case added).

### Scorecard · La Gran Fuga · chase pass · 2026-10-19 · branch `escape-chase`
```
Hard gates: bots PASS (4/20/30 × 60 s, 20/30 × 120 s; 0 frozen, 0 errors) · teacher controls ✓ (⏸ Pausa holds every
            kid's chase, stun and shield; +30 s; ⏭ Saltar zona; Terminar; Sonido; Otra ronda; F5 reclaim) · saga only ✓
            · Spanish/pinyin/level ✓ · kid-safe ✓ (a goofy robot's tickle-zap, no scary art; red eyes and a red glow,
            a heartbeat, never a jump scare; reduced motion: no flash, no shake, no pulses)
1 Real place ........ 2/2  unchanged: the two routes of real places, the gates, Hamdan's jet
2 The gang .......... 2/2  unchanged: Fer's intro, Dralingo leads, the cast cheers, Hamdan at the jet; Robotín now a real
                           character on every phone (his chase look, red eyes, siren, trips, a shield he waits behind)
3 Every tap ......... 2/2  a right answer = I dash away (whoosh, +7,5 m, «¡Lo alejaste!»), a wrong one = I stumble and
                           he gains; «Así se juega» says «¡Robotín te persigue!»; a locked tile says why («¡Zap!
                           Espera…» + the seconds)
4 Feedback .......... 2/2  every zap has its crackle on the phone and the projector, sparks and the siren have sound; the
                           big moments one at a time (the full-screen zap at most once per kid per 45 s); the projector's
                           zap chips throttled
5 Finale ............ 2/2  danger now builds second by second inside every question (treads faster, heartbeat, red
                           edges, «¡Está detrás de ti!»), the music speeds up with the danger and in the last minute,
                           then the boarding, «¡FINAL!» and the ceremony as before («escapes por un pelo» on the card)
6 Fair, no stall .... 2/2  his speed follows each kid's pace and accuracy; one zap per kid per 45 s at most (trips
                           inside it), never a zap every question, never out of play, a stun never shortens a question,
                           a zap costs the crew nothing, a phone in a pocket stops being chased after 25 s; the class
                           still reaches the jet 6/6 at 4, 5 and 6 minutes
7 Product feel ...... 2/2  real sound that matches (a crackle-and-buzz zap you can hear, treads, heartbeat, siren) and
                           the chase music he picked, reacting to the danger; the persecution happens on MY phone
Total 14/14 → ships (≥ 12, no 0)
```
