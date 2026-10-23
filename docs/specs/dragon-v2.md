# Vuelo del Dragón v2 · «La Carrera del Cielo de Dubái» (a Mario Party sky race, races of 4)

**Name since 2026-10-23: «Draly Vuelo · La Carrera del Cielo»**, short «Draly Vuelo» (the «Draly Party» names, his «Approve all»; `core/game-names.js`). The text below keeps the name it had when it was written.

gameType `dragon-eye` · address `/host-dragon.html?setId=…` (unchanged: games.html, packs.html, sets.html and /maestro's
launcher keep working, `?livegame=1` kept; no set → `/packs.html?game=dragon-eye`) · remade 2026-10-16 on a branch, not
deployed.

## Why
Fernando loved Mochi Mash v2 for its Mario Party feeling and asked (2026-10-16) that phones never go dead between
questions. Vuelo del Dragón was the last kept game never rebuilt: two emoji dragons (Rojo / Dorado) climbing two columns
of emoji scenery, hanzi in the UI, a plain «¡Correcto!» card, then a swipe screen with a 🐉 and a «+1». What kids liked
and stays: **a right answer lets you fly, and you fly with your finger (swipe up = one wing beat)** (the swipe beat the
older "aim" version, memory `project_engagement_patterns`).

## The big choice: races of 4, every kid flies their own dragon
A flight is a race, and a race is four rivals side by side: that is a Mario Party race minigame, and this repo's rule
for Mario Party recreations (`CLAUDE.md` § Pin games: boards of 4, 3 when it doesn't divide, one board up to 5).
- **Why not Fuego vs Mar** (the old two team dragons): "every right answer moves MY flyer on MY phone" needs a flyer
  that is mine; a team dragon moved by 15 kids moves on its own. Mochi, Piñata and 6-7 are already team games.
- **Why not all 30 in one race:** 30 dragons are unreadable on a phone and «17º de 30» is no fun. Four named rivals
  give overtakes («¡Pasaste a Sofía!»), a lead to steal and a podium every kid can reach.
- **What keeps the class together:** every race flies the same course over Dubai at the same time; the star sprints,
  the last 30 s and «¡FINAL!» hit everyone at once; the projector shows every race + the class top 3; the ceremony
  crowns each race, then the class podium. Same deal as Ojos de Halcón / Monopolio (`core/halcon.js`): ≤ 5 kids = one
  race, else ceil(n / 4) races of 3-4, shuffled; a late joiner flies in the smallest race with room (max 5), starting
  level with its last dragon (so a kid who arrives late is in the race, not 2 km behind); a rejoin keeps everything.
- Colours: Mario Party seat colours (red, blue, green, yellow, purple). Each kid's **dragoncito** (the Bebé Dralingo of
  his evolution line, the keffiyeh sticker of Reinos and Mochi's dragoncitos, in its three flying frames: wings up,
  level, down) wears the seat colour (`video_tools/recolor_dralingo.py`, the eyes and keffiyeh stay as drawn), and the
  kid's **full-body saga character rides standing on its back** (nobody touching anybody: kid-safe).

## The world
- **A race over Dubai from golden hour into the night:** the sky darkens from sunset to a starry night as the round
  goes on; a skyline of lit towers far away, the five glossy landmarks of Reinos standing on the course (Marco de
  Dubái, Museo del Futuro, Burj Khalifa, Burj Al Arab, Atlantis), the Creek with its abras along the water, clouds
  drifting in front. One lap = 1,500 m; a landmark every 250 m. In the last 30 s fireworks burst over the city.
- **Dralingo** (platform look: kandura, ghutra + agal, mustache) waits at a landmark with the **star**.
- **The gang hosts the race** (`js/cast.js` mood `vuelo`, Aileen in voseo): Profe Fer opens the episode, Hamdan calls
  the landmark sprints, Latifa the golden rings, Aileen the overtakes, Adric (and his dog) the tailwind, Adrian the
  laps, Dralingo hands out the stars.

## Flow (server-timed; constants in `core/dragon.js` `R`, the course in `js/dragon-course.js`)
1. **Lobby.** Projector: PIN + QR, «Así se juega» in 3 pictured steps (four answer tiles · a dragoncito and a hand
   swiping up · Dralingo with the star at the Burj Khalifa), 3 / 4 / 5 min (4 by default), the class as full-body
   characters, how many races («4 carreras de 4»), «¡A volar!». Phone: «¡Vuelas en una carrera!» with my character,
   the same 3 steps.
2. **Countdown (3.5 s) = the run-in.** The races are dealt now. Phone «¡Tu carrera!»: my rivals and I fly in, each on
   our coloured dragoncito, «TÚ» on me, Dralingo with the star. Projector: every race's dragons fly onto the start line.
3. **Intro (2.8 s).** One pictured control: a dragoncito and a hand swiping up: «¡Responde y aletea!» → «¿Listos?» →
   «¡YA!». The teacher can skip it.
4. **Play.** The phone IS the race: the race's plates on top (1º-4º, metres, stars; mine «TÚ»), the sky with my dragon
   big in front and my rivals in their lanes (true distances near me, squeezed toward the edges further away with a
   «+120 m» chip), and the question as a sheet at the bottom (picture, prompt, 4 big tiles, 20 s clock with ticks).
   - **The tap answers at once:** the tile presses, a pop, my dragon perks up and my rider leans forward while the
     server judges (the right answer is not on the phone: packs never send it).
   - **Right** → «¡Correcto!» → the sheet slides down and **«¡A VOLAR!»**: 4 s of flight (5 s on a streak of 3+ and every
     beat ×1.5, «¡Fuego azul!» puffs of blue fire; ×2 from a streak of 6). **Every swipe up (or tap) is one wing beat**: the wings go up and down, the dragon
     surges forward, the city and the clouds rush by, a beat sound whose pitch climbs, a buzz, «+6 m». The server
     credits at most 5 beats a second (+3 for jitter), 6 m each. Sometimes a **golden ring** floats ahead: the beat
     that reaches it flies through it («¡Anillo dorado!», +30 m). Then «+84 m», the dragon glides and the next question
     slides up (about 1 s later).
   - **Wrong / time up / too fast** → «¡Casi! Era …» on the sheet with a wait bar: 2.2 s (3.4 s after two in a row,
     «¡Respira! Lee y piensa»). My dragon dips and my rider looks sad, then they glide on; above the sheet the race goes
     on (rivals flapping past). The wait is the cost; nothing is taken away.
5. **Mario Party moments.**
   - **«¡Carrera al Burj Khalifa!» (the star sprints):** 20 s into the round and then every 40 s, on every race at once:
     Dralingo waits at the next landmark with a star. For 12 s, whoever of my race flies the most metres wins the star
     (+150 m: the dragon dashes ahead). Everybody starts the sprint at 0, so a kid in last place can win it. Ties share.
     The phone shows the four sprint bars filling live; the winner gets «¡ESTRELLA!» (the one big full-screen moment).
     The projector's top bar becomes the sprint (landmark, Dralingo with the star, a big 12 → 0) and every race's chips
     show their sprint metres as a gold «+96» pill.
   - **Viento a favor (the comeback, capped at the gap):** the last dragon of a race, 60 m or more behind its leader,
     gets a tailwind: every beat +50 %, the extra never more than the gap (luck alone never puts it first). Golden
     rings come more often to the last dragon (65 % of its flights, 30 % for the others), their extra capped the same.
   - **Lead alarms** per race («¡Sofía toma la delantera!», 20 m of hysteresis, ≥ 6 s apart) and **overtakes** on my
     phone («¡Pasaste a Adric!» / «Latifa te pasó»).
   - **¡Últimos 30 segundos! ¡Alas dobles!** Every metre ×2, fireworks over the city, the final music, a gold frame,
     the last 10 s big on the projector and as a chip on phones.
6. **«¡FINAL!»** (2.4 s) on every screen; beats already on their way (≤ 0.9 s) still count; nothing starts after the end.
7. **The ceremony (~16 s; «Saltar» on the projector jumps every phone to its card).**
   1. *¡Estrellas bonus!* three per race, one by one (each +200 m, the dragon dashes on the finish strip, so they can
      change who wins): **Estrella Sabia** (most right answers), **Estrella de Racha** (longest streak, ≥ 3),
      **Estrella Remontada** (most metres flown while last of the race, ≥ 1).
   2. *¿Quién gana?*: a drum roll, then each race's winner in the victory pose on its dragon under confetti in its
      colour, the others react (sad pose). Phone: my race; projector: every race, then the class podium (top 3 by
      metres) with «Otra ronda».
   3. *My card:* my dragon and my character, «1º en tu carrera», metres, stars, right answers, best streak, every bonus
      star I won; 0 m → «¡La próxima carrera es tuya!», never shame. «Quédate aquí: tu profe puede empezar otra ronda» +
      a quiet «Salir del juego».

## Score: one number you can see
**Metres flown.** The kid in front is winning; everything Mario Party turns into distance you see happen (a star = a
dash ahead, a ring = a boost, a bonus star = a dash on the finish strip). Ties: more stars, then more right answers.
Stars are counted (plates, card) because winning one is a moment, but the race is decided in metres.

## Fair, and never stuck
- **Server judges everything:** one answer per question, a tap under 600 ms after the question was sent = too fast =
  wrong; beats only inside a flight the server opened, at most 5 a second (+3 jitter), batches checked against the
  window's clock; rings, stars, tailwind and every metre are the server's. The phone predicts its own beats with the
  same cap (so what you see is what you get) and settles to the server's number when the flight closes.
- **Guessing loses to thinking:** a wrong answer costs a wait (longer after two in a row) and no flight; a streak gives a
  longer flight. Measured in `scripts/test-dragon.js` on simulated classes: a thinker beats a fast guesser and a masher.
  Finger speed matters inside the cap only: a kid swiping 4 a second flies 4/5 of the fastest tapper. The streak tiers
  («¡Fuego azul!» ×1.5 from 3 in a row, ×2 from 6) are what make thinking pay: a guesser rarely reaches them.
- **Timeouts with defaults:** a question nobody answers → time up on the server 3 s after the phone's 20 s; a flight
  closes on the server's clock even if the phone vanished; the next question comes from the server's tick.
- A kid who leaves stays in the race greyed (nobody waits for anybody: there are no turns).

## Teacher (projector, secondary but never stuck)
PIN + QR, 3 / 4 / 5 min; Pausa (holds every clock: questions, flights, waits, the sprint), +30 s, Saltar (intro,
ceremony), Terminar («¡FINAL!» then the ceremony, also from the pause card), Sonido, Otra ronda; F5 takes the same room
back (sessionStorage `draly.dragonHost`).

## Network budget (30 phones)
Per kid: its own question, verdict, flight window and flight summary; its beats go up in batches of 250 ms during a
flight (≤ 17 a flight, no answer per batch). Per race: one compact `dr:race` (metres + flags of its 3-5 dragons) every
500 ms only when something changed, to that race's phones; the projector one `dr:races` for all races. A sprint start /
end and the frenzy are one room event each. No full `state` push on answers.

## Scorecard target
Gates all pass; 14/14 aimed: 1 real place = the Dubai course with 5 landmarks where stars are won; 2 the gang = hosts
of the moments, Dralingo with the star, run-in on phone and projector, full-body riders on seat-coloured dragoncitos;
3 every tap = the swipe beat (the dragon answers each stroke), press + sound, pictured rules, the prompt; 4 feedback =
right / wrong / beat / ring / star / overtake / lead, one big moment at a time; 5 finale = sprints, lead alarms, alas
dobles + fireworks, «¡FINAL!», bonus stars that can flip a race, winners and podium, my card; 6 fair = server judge,
too-fast rule, beat cap, waits, comeback capped, timeouts; 7 product = our art, Kenney music + effects, phone as
finished as the projector.

---

## As built (branch `dragon-v2`, 2026-10-16, not deployed)

### Files
- New: `core/dragon.js` (rules: the deal, answers, flights and the beat cap, rings, the tailwind, the star sprints, leads,
  the frenzy, bonus stars, the end), `public/js/dragon-course.js` (the course: lap, landmarks, sprint order, seat colours,
  the rival squeeze `relX`; shared by the server and both screens), `public/js/dragon-sky.js` (the flyer, the sky, the
  figure, the star and the ring; phone and projector), `public/js/player-dragon.js` (the phone),
  `public/assets/dragon/` (15 flying frames of the dragoncito: 3 frames × 5 seat colours, aligned on the black agal and
  recoloured from the Reinos art with the local `recolor_dralingo.py` method, 311 KB; `music-race.mp3` = Kenney «Space
  Cadet», `flap2/4/6.mp3` = Kenney foley wooshes, all CC0; 636 KB for the folder), tests `scripts/test-dragon.js`,
  `scripts/test-dragon-live.js`, `scripts/sim-dragon.js`, `scripts/playtest/dragon-eye.js`.
- Rewritten: `public/host-dragon.html`, `public/js/host-dragon.js`, `public/css/dragon.css` (the old emoji columns,
  lanterns and hanzi are gone).
- Shared files, dragon parts only: `server.js` (the «VUELO DEL DRAGÓN v2» block replaces the DR_* constants, the old
  `dragon:init` / `dragon:alt` / `player:tap` altitude code and the answer branch; one-line branches in host:create,
  host:start, end-now, reset, reclaim, join / rejoin / late joiner, pause, +30 s, resync, cleanup, the watchdog, the
  disconnect), `public/player.html` (`#screen-dragon` replaces the old swipe screen), `public/js/player.js` (DragonPhone
  init; the old flap code out), `player-kingdoms-skin.js` (lobby, intro, music, end), `cast.js` (mood `vuelo`),
  `sounds.js` (the synthesized `themeDragon` retired), `games.html`, `maestro.js` (+ its `?v=` in maestro.html),
  `test-wording.js` (the dragon files; tone marks and hanzi refused in them), docs.

### Test hooks
Phone `window.DragonPhone`: `frame()`, `hold(v)`, `freeze(v)` / `replay(ev)` / `queued()`, `stage(name)` (line, b0-b2,
drum, win, card), `runIn()`, `rules(ms)`, `sim(ev, d)`, `answer(i)`, `beat(n)`, `holdFly(v)`, `banner(…)`, `bigStar(lm)`,
`gang(id, text)`, `chip(…)`, `tick(ms)`, `sky()`. Projector `window.DragonHost`: `frame()`, `freeze` / `replay` /
`queued`, `hold(v)`, `stage(name)` (bonus-intro, bonusN, drum, winners, podium), `sim(ev, d)`, `band(…)`, `tick(ms)`.

### Tests
| Test | Result |
|---|---|
| `node scripts/test-dragon.js` (course, deal of 1-40 kids, late joiner level with the present kids, answers, too fast, waits, flights and the beat cap, pause in the middle of a flight and beats in transit, the «¡FINAL!» cut, rings and tailwind capped at the gap, sprints, leads, frenzy, bonus stars, ties, 300 simulated classes) | 29,633 checks pass; metres per kid (sim): thinker 6,320 · slow 3,366 · fast guesser 2,606 · masher 0 · idle 0; the bonus stars flip a race in ~3 % of races (~8 % among close thinkers) |
| `node scripts/test-dragon-live.js --url … --password …` (real sockets: lobby → deal → intro skip → right / wrong / too fast → a flight with beats → pause during a flight → +30 s → reload mid-flight (time left kept) → late joiner → end → reattach → skip → «Otra ronda») | 77 checks pass (twice in a row) |
| `playtest-bots.js --game dragon-eye --seconds 60` | 4 bots PASS (47 questions) · 20 bots PASS (225, 5 races) · 30 bots PASS (346, 8 races) · 0 frozen · 0 errors · ~2 events a second per kid |
| Every other suite (monopoly, mochi, pinata, sixseven + phone, halcon, kingdoms, paint, snow, escape, packs, stress-packs, wording, ruta ×3, level-keys, sims-lock, golden-book, archive, audios-base) | all pass |
| `node scripts/asset-guard.js` on the staged files | exit 0 |

### Reviews and what changed
- **Code review** (agent-skills:code-reviewer, «request changes», no critical): fixed my own passes never showing and
  the plates ranked by the pre-flight metres (one value: my predicted metres while I fly; passes checked on every beat
  and at the flight summary), a phone that missed the lobby and the countdown keeping last round's race (a new game
  tears the race down), a right answer in the last 0.8 s opening a flight under «¡FINAL!» (phone and rules: nothing
  starts at or after the end), `bigOn` surviving into the next round, beats in transit lost at «Pausa» (sent at once,
  accepted until the pause + grace), a late joiner placed level with a kid who had left (level with the present kids),
  a flight resumed after a reload predicting too few beats (`elapsed` from the server), grace 600 → 900 ms for school
  Wi-Fi, the projector never re-measuring after F11 (resize listener), a kid back after 4-5 minutes getting a second
  dragon (re-linked by name), the beat counter read nonstop by screen readers, the projector's top 3 rebuilt every
  600 ms, the spec's numbers, the nits (comment, indentation, «Saltar» after «Terminar», counters per round).
  Not changed (outside this game, reported): `host:reclaim` lets any socket that knows the PIN take the projector of a
  non-exam room.
- **Classroom playtest** (classroom-playtester: projector + 4 real phones + 22 socket kids in 7 races, a class of 5, 30
  bots alongside): no phone dead between questions (a right answer 6.0-7.2 s including the flight, a wrong 2.3-3.8 s,
  the longest still moment 0.5 s at 390 px and 1.25 s at 360 px); every teacher control worked. Fixed: «¡Qué vuelo!»
  staying over the next question (one hide path), the projector clock under «Sonido», rivals drawn over my dragon on
  360×640 during a sprint (rival lanes always above mine, their tags hidden when tight), the plates cutting the metres
  (rank badge on the corner, number + small «m»), «¡ESTRELLA!» covering an open question (the question clock waits),
  the reload's 1.2 s with no metres, the projector's chips and far dragons (chips wrap, far dragons wait whole at the
  tile's edge), the lobby text («de 3 a 5 por carrera»), the 360 px sprint titles.
- **Fresh-eyes design review** (stills only, phone 390 / 360 and projector; disposition «fix», 8 items): fixed the
  projector having no big sprint moment (the top bar shows «¡Carrera al …!», Dralingo with the star and a big 12 → 0
  count in place of the class top 3; each race's sprint metres moved into its chips as a gold «+96» pill, the
  sprint leader's chip glowing, so no panel hides the leaders flying top right), the projector bands
  covering the lowest dragon of the middle races (they now sit in the strip under the races, left of the teacher's
  buttons; no lead bands in the last 10 s), small projector ceremony text (names 17 px, metres 28 px, «¡Gana …!» on
  each race card at «¡Los ganadores!», chips 16 px with up to 6 races), «7616 / m» on two lines (one line now; «+200 m»
  unbroken), phone banners over the flight bar (race news waits until I land, older than 7 s is dropped), «Iker y
  Martina y Abril» (commas now), the golden ring never taught (lobby step 2 and both rules cards: «¡cruza los anillos
  dorados!»), the podium's empty band (1.3× bigger). Kept: «¡Bienvenido …! Esperando al anfitrión…» on the lobby (the
  platform's shared lobby text for every game, not this game's; reported as a follow-up); p03 «answers below the
  fold» was the sheet caught sliding up.
- **Design pass (emil-design-eng format):**

| Before | After | Why |
| --- | --- | --- |
| «¡A VOLAR!» held over the whole flight, under the banners | A 1.7 s stamp (pop in, hold, fade; reduced motion: fade only) that steps aside while a banner or a landmark chip shows | One headline at a time; the flying dragon is the message |
| Sprint start: a banner under the sprint panel with the same title | The panel (it drops in) is the announcement; Hamdan's line stays | The same words twice read as clutter |
| Phone run-in: the crew in one column, riders standing on the name tag above | Two-column zig-zag, smaller on short phones | Every kid finds their own name |
| Projector run-in: text only | Dralingo holding the star beside «¡N carreras listas!» | The same picture as the phones; the gang hosts the moment |
| Projector: far dragons cut at the tile's edge, half a name | They wait whole at the edge; near the left edge the name turns to the right | Every kid can find themself on the projector |
| Projector sprint bars: a panel over the race's header, then over the leaders top right | No panel: a gold «+96» pill in each chip, the sprint leader's chip glows | Nothing covers a dragon or a name |
| Last-10 count over the third race's header | A smaller gold coin in the top bar beside the clock | It covered the leader's chip for 10 s |
| Projector «Así se juega»: small pictures (Dralingo 40 px wide) | Pictures 140-150 px, rules scoped to the projector | Read from the back of the room |
| Phone lobby card on 360×640 cut under «Sonido» (it inherited the projector's step size) | Rows 68 px, compact header on short screens | That screen does not scroll: step 3 was unreachable |
| Plates: «1233» cut at 4 digits | Rank badge on the corner, number + small «m» | The number is the whole race |
| «¡Qué vuelo!» left over the next question | One hide path for the flight box | The question must be clear |
| Projector sprint: only small panels inside each race | The top bar becomes the sprint: landmark, «¡Carrera al …!», Dralingo with the star, a big 12 → 0 | The whole room should feel the sprint |
| Projector bands at the bottom centre, over the middle races | In the strip under the races, left of the teacher's buttons; none in the last 10 s | Bands never hide a dragon; the count owns the end |
| Projector ceremony: names ~11 px, metres ~16 px | Names 17 px, metres 28 px, «¡Gana …!» pill on each race card | Read from the back row |
| Ceremony «7616» with its «m» on the next line | «7616 m» on one line; «+200 m» never split | Numbers read as one thing |
| The golden ring tall from my rider's head down, over the rival lane above | Centred on my dragon's body, 0.72 of its width | The rivals' names stay readable |
| Phone banners over my flight's bar and title | Race news waits for the landing (dropped after 7 s); a banner up when I take off steps aside | My flight owns the top of the screen |
| Ceremony «Gana Martina!» with the others in seat order | The others in finishing order, each with «2º», «3º» | The phone tells the race's story in order |
| Phone «alas dobles»: the gold frame drawn under the sky (invisible) | A gold frame overlay round the whole phone in the last 30 s | The phone feels the finale like the projector |
| Phone card at the top of a tall screen | Centred when it fits (scrolls when it doesn't) | No empty half screen at 390×844 |
| Projector lobby «5 carreras de 3 o 4» for 20 kids | The real sizes («5 carreras de 4», «2 carreras de 3», «2 carreras de 3 o 4») | The teacher reads what the deal will do |

- **impeccable detector** (run at the end on the game files): 3 flags, kept on purpose as parts of the world: the moon's
  glow, the star's radial dots, the tailwind's streak loop. Advisory: the pop easing (a kids' party game; the brief
  wins) and the water / wind stripes (scenery, not card borders). Fixed: the projector steps' tight leading (1.3 now).

### Scorecard · Vuelo del Dragón v2 · 2026-10-16 · branch `dragon-v2`
```
Hard gates: bots PASS (4/20/30) · teacher controls ✓ (Pausa, +30 s, Saltar, Terminar, Sonido, Otra ronda, F5)
            · saga only ✓ · Spanish/pinyin/level ✓ (questions from the packs; test-wording refuses hanzi and tone
            marks in the dragon files) · kid-safe ✓ (each rider stands on their own dragoncito; nobody touches)
1 Real place ........ 2/2  the Dubai course: Marco, Museo del Futuro, Burj Khalifa, Burj Al Arab and Atlantis every
                           250 m of a 1,500 m lap, skyline, Creek water and abras, dusk turning to night
2 The gang .......... 2/2  the gang talks over the race (cast.js «vuelo», Aileen in voseo), Dralingo holds the star
                           at every sprint and in both run-ins, full-body riders on seat-coloured dragoncitos on phone
                           and projector
3 Every tap ......... 2/2  the tile reacts in the same frame; each swipe or tap = one wing beat (frames + whoosh +
                           metres), flight bar and counter, «Así se juega» in 3 pictured steps, a hand on the first
                           flights
4 Feedback .......... 2/2  right / wrong / too fast / time up, beats, the golden ring, the tailwind, «¡Pasaste a…!»,
                           lead banners, the star overlay; one headline at a time (banners queue, the flight title
                           steps aside)
5 Finale ............ 2/2  star sprints every 40 s, lead alarms, alas dobles in the last 30 s with fireworks, the
                           last-10 count, «¡FINAL!», 3 bonus stars (+200 m) that can flip a race, drum, winners,
                           class podium, every kid's own card
6 Fair, no stall .... 2/2  the server judges answers and beats (5 a second + a burst of 3, per flight id); too fast =
                           wrong; ring and tailwind capped at the gap; a late joiner flies level with the present kids;
                           every flight closes on the server's clock; teacher controls
7 Product feel ...... 2/2  our art only (saga riders, recoloured dragoncitos, Reinos landmarks), Kenney CC0 music and
                           wooshes, transform-only animation, reduced motion, phone checked at 390 and 360, projector
                           at 1600×900 with 5 races
Total 14/14 → ships (≥ 12, no 0)
```

### Open items and what to watch in the first real class
- **The beat cap.** A kid who swipes faster than 5 a second sees the counter climb only at 5 a second (the rest are
  not counted). If fast swipers feel cheated, raise `R.RATE` in `core/dragon.js` and re-run `scripts/sim-dragon.js` (a
  thinker must stay ahead of a fast guesser).
- **School Wi-Fi.** The last beats of a flight must reach the server within `R.GRACE_MS` (900 ms) of its end. If
  «¡Qué vuelo!» often shows fewer metres than the kid saw while flying, raise it to 1200.
- **Sprints:** the first at 20 s, then one every 40 s (6 in a 4-minute round). If the class finds them too busy,
  raise `R.SPRINT_EVERY_MS`.
- **360×640 phones** are tight while a sprint and the question share the screen: the rivals stay above my dragon and
  their name tags hide. Watch whether kids can still tell who is who.
- **Bonus stars flip a race rarely** (~3 %): the race is mostly decided by metres, the stars add the last drama.
- **The music** (Kenney «Space Cadet») under Profe Fer's voice: check the volume on the classroom speakers.
- **Projector with 7+ races** (25+ kids): 4 columns of smaller tiles; the kids play on their phones, the projector is
  the overview.
- **Art requests (Higgsfield in his Chrome; kid-safe, no text or logos):** Dralingo in the platform look flying with
  a big gold star, on flat #00FF00 with room around the wings (the sprint panel, the star overlay and both run-ins
  use the standing Dralingo + a drawn star today); optional: each saga character crouched as a rider, on green (the
  riders stand on their dragoncitos today).
- Outside this game (reported, not changed): `host:reclaim` lets any socket that knows the PIN take over the projector
  of a non-exam room.
- Outside this game (reported, not changed): the shared phone lobby of every game says «¡Bienvenido …! Esperando al
  anfitrión… mientras tanto:» in small grey text (masculine for girls, «anfitrión» is an odd word for kids); a
  reviewer suggests «¡Hola, Sofi! Ya estás dentro. Espera a tu profe…» in white, 16 px or more.

### Art batch 1 · 2026-10-17
- The captains' new poses (Higgsfield Unlimited, 0 credits, his Chrome): `assets/cast/<id>-{talk,jump,wow,67}.webp` for Fer, Hamdan, Latifa, Aileen and Adric (Adrian: Higgsfield refuses him, his three poses stay) and Dralingo `assets/dralingo/{talk,jump,wow}.webp`. `js/cast.js` rotates them: `hello` → hello or talk, `cheer` → cheer or jump, `mystery` → mystery or wow (held 25 s per character, so a moment never flickers); `talk` / `jump` / `wow` / `67` ask for exactly one.
- Dralingo flying with the big gold star (`assets/dralingo/star-fly.webp`, `DragonSky.starFly()`): one picture where the standing Dralingo + a drawn star used to be (the lobby's step 3, the projector's run-in and sprint panel, the phone's run-in, sprint panel, «¡ESTRELLA!» and how-to). The gang's lines show the speaker talking or cheering (cast.js) instead of the victory figure.
