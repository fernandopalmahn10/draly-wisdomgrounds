# Dragones Pintores · new pin game (Gimkit «Color Clash», Dralingo style)

Status: **REPLACED 2026-10-17 by v2 «El Cielo de las Maravillas»** (`docs/specs/dragones-pintores-v2.md`: worlds with
landmark prizes, tap to fly). This file is v1's history (built 2026-10-11, gameType `paint`). His brief: "design and improve this same game,
dralingo style … a new pin game" after watching Gimkit Color Clash (https://www.youtube.com/watch?v=SyAyV0LcRQQ).

## What we copy and what we beat
Color Clash: two teams run and jump around a 2D map; every platform you touch turns your team's colour; you spend
energy moving and refill it by answering questions; the team with more of the map wins.
Ours, Dralingo style:
- Every kid flies a baby Dralingo in the team colour (Fuego = red Dralingo, Mar = blue) over pastel cloud platforms.
- Fire («fuego») instead of energy: running/flying burns it; «🔥 ¡Recargar fuego!» asks for a question; right answer
  = +10 s, three in a row = «¡Llamarada!» (6 s of wide painting). Gems give an extra flap.
- Kid-obvious (his rule 2026-10-11): a 3-step picture card when the round starts, a full-width Recargar bar that pulses
  when fire is low, and a «¡Te quedaste sin fuego!» card with a giant button at 0. Same 3 steps on the projector lobby.
- Projector: the whole map live (every dragon with a name tag, painted tiles), Fuego/Mar rosters, territory tug bar,
  👑 on each team's top painter, team flags at the spawns, Dralingo announcer + DralingoFX (flyby on lead change,
  random effect at 25/50/75 % painted, rain of Dralingos on the winner screen). Teacher: +30 s, Terminar ronda.

## Rules
- Level: `core/paint.js` `buildLevel(seed)`, 60×36 tiles of 32 px, ground with 4 gaps, 8 platform tiers 4 rows apart,
  short walls and 3 pillars, spawn columns kept clear. Seeded, so server, projector and phones build the same map.
- A "surface" is a solid tile with air above it; only surfaces paint. Team score = surfaces owned per team; a kid's
  score = clouds they own at that moment (last painter of each tile), so the 👑 goes to whoever holds the sky.
- A cloud can't change colour again for 1.5 s (`PC_FLIP_COOLDOWN_MS`): standing still on a contested cloud farms nothing.
  The phone that painted too early gets the true colour back. Lead-change announcements: at most every 4 s.
- Server owns fire and tile ownership. Phones run the physics (client side) and send position at 8 Hz plus painted
  tile ids (≤16 per message); the server checks reach (3 tiles, 6 while blazing) and fire > 0.
- Fire burn: the phone reports the seconds it actually simulated (`spent`); the server charges that, never more than
  the real time since the last message (a laggy phone isn't charged for frames it never showed), and a dragon that
  clearly moved pays at least half the real time. Physics runs in ≤ 1/60 s sub-steps (no falling through clouds at
  low frame rates). Playing counts as activity, so the phone's 12 s resync never fires mid-flight; a resync of the same
  round keeps the dragon where it is (same level seed).
- Start fire 8 s, +10 s per right answer, max 30 s. Questions only on demand (no watchdog push).
- Broadcast: `pc:pos` and `pc:paint` batched at 5 Hz (200 ms tick) to the room.

## Files
`core/paint.js` · server.js (`pcStart`, `pcTick`, `pcAnswer`, `pcStop`, handlers `player:pc-pos|pc-paint|pc-ask`) ·
`public/host-paint.html` + `js/host-paint.js` · `js/player-paint.js` (phone; test hook `PaintPhone.advance(sec, keys)`)
· `js/paint-render.js` (shared tile drawing) · `player.html` `#screen-paint` · `css/kingdoms.css` (`pc-*`) ·
poses in `assets/kingdoms/dralingo/` (`fly`, `jump`, `*-red` made with `video_tools/recolor_dralingo.py`).

## Review + classroom playtest (2026-10-11), all fixed
Teleport every ~12 s (watchdog resync → spawn), blank canvas after rotating during a question, paint tick leaking after
the host left, last 200 ms of paint not counted for the winner, projector map not resent on reclaim, tunnelling at
20–30 fps, point farming by camping, /maestro launch losing ?livegame=1 through /packs, gems inside walls, question
timer refilled by resyncs, «Otra ronda» leaving question-less kids on the winner screen, «Tú pintaste: 0», sound button
over an answer tile, blue champion for Fuego, English join errors, winner screen taller than the projector.

## Tests
- `node scripts/test-paint.js` (level rules, ~2000 checks).
- `node scripts/playtest-bots.js --game paint --bots 20 --seconds 45 --handlers scripts/playtest/paint.js --set pack:yct1-familia-r1`
  (the handler marks the game on-demand: a freeze = asked for a question and none came).
- Headless browsers here deliver ~2 animation frames per second, so drive the phone with `PaintPhone.advance()` and
  `PaintPhone.jump()` from the console for screenshots.

## Next ideas (not built)
Power-ups from gems (paint bomb), a short "pintura" sound per tile on the projector, per-kid trails, Aileen/Adric/
Adrian/Profe Fer as selectable dragons' riders once he sends their art.

---

## As built · 2026-10-16 · the Mario Party ending pass (branch `ending-pass`, not deployed)

The shared ceremony, the lobby greeting, the shared files, every test with its count, the reviews and what they
changed, and the design pass are written once in `docs/specs/reinos-de-colores.md` § «As built · 2026-10-16».

- **Dragones Pintores: what changed.**
  - *The gang:* two captains from the gang every round (server `g.pcCaptains`, event `pc:captains`): the red | blue VS
    face-off in the projector's countdown, each kingdom's captain in its side panel, the leading captain's `battle` line
    on a lead change, «Tu capitana: Aileen» under the phone's 3-2-1, and they speak in the ending.
  - *The ending:* «¡FINAL!» (the dragons stop where they are; strokes already on their way count for 0.6 s) → «¿Qué reino
    pintó más cielo?» (two columns of clouds fill with a drum) → «¡El Reino del … pintó el cielo!» (captains speaking,
    kids cheering / slumped) → bonus stars: **Más nubes pintadas** (strokes), **Más cielo al final** (clouds still the
    kid's colour at the end), **Racha más larga** (3+), **Más llamaradas** → podium by clouds owned at the end («9 nubes al final») + «Más cielo del
    Reino del …»; the card: «Pintaste 19 nubes», «7 nubes siguen con tu color al final», aciertos, racha, llamaradas.
    «Más llamaradas» counts only llamaradas a streak earned (the last 30 s gives everyone one) and is skipped when more
    than 3 kids would share it.
  - *No dead phones:* «☁️ N» (my clouds right now) in the phone's score bar; the result screen carries the live score,
    my captain's reaction and «Tus nubes»; banners for lead changes (my captain's line, ≥ 7 s apart) and 25 / 50 / 75 %
    of the sky painted (from the pc:paint events every phone already gets).
  - *Mario Party touch:* **«¡Fuego doble!»** in the last 30 s (a right answer = +20 s of fire and always a Llamarada, the
    wide brush): phone banner + «Fuego ×2» chip, projector banner. Kept out on purpose: a comeback bonus (every cloud can
    be repainted, so the sky already swings back and forth all round).
  - *«⏸ Pausa» (new, the hard gate «teacher never stuck»):* the clock stops, every dragon stands still (no fire burnt,
    no clouds painted, «Recargar» waits), an answer comes back unused; «▶ Seguir» moves the clock on by the paused time;
    the same cards as Reinos on the phones and the projector.

### Files
- Pintores parts: `core/paint.js` (`ENERGY_PER_RIGHT` / `ENERGY_MAX`, `reward`, `STARS`, `finish`), server.js
  (`pcRight` / `pcAnswered` / `pcBest` / `pcBlazes` per kid, `g.pcCaptains` + `pc:captains`, `pcPause`, `pcEndPayloads`),
  `public/host-paint.html` + `js/host-paint.js` (the captains: VS countdown, side panels, lead lines; the ceremony, the
  ribbon, «⏸ Pausa»), `css/kingdoms.css` (`.kd-count.pc-vs`), `js/player-paint.js` («☁️ N», the news, the pause),
  `scripts/test-paint.js`, `scripts/playtest/paint.js`.

### Tests and reviews
`node scripts/test-paint.js` ~120,900 checks; Pintores in `test-party.js` (cards, stars, «Más llamaradas» shared by
  more than 3 = skipped) and `test-party-live.js` (the ending + the pause); bots PASS at 4 / 20 / 30 (30: 381 questions).

Classroom playtest (4 rounds, projector + 3 phones + socket kids): PASS, no phone ever dead. Fixed: the «Fuego ×2»
chip running out during a pause in the last 30 s and after «+30 s» at the bell, «+30 s» not moving the paused clock,
the lead bubble contradicting the score bar, the reveal's unit, the chip on the out-of-fire card, «Reino del Mar» pale
in the lobby, the VS divider through «¡A pintar!», a reload after the end replaying the show, the empty podium.

### Scorecard · Dragones Pintores · 2026-10-16 · branch `ending-pass`
```
Hard gates: bots PASS (4/20/30) · teacher controls ✓ (⏸ Pausa NEW, +30 s, Terminar, ⏭ Saltar, Sonido, Otra ronda,
            F5) · saga only ✓ · Spanish/pinyin/level ✓ · kid-safe ✓
1 Real place ........ 1/2  a sky of clouds over the Dubai skyline; nothing in the sky is a Dubai place to win
2 The gang .......... 2/2  NEW: two captains every round (VS in the countdown, side panels, lead lines, «Tu capitana»
                           on the phone, speaking in the ending)
3 Every tap ......... 2/2  unchanged: the dragon answers every swipe, fire bar, «Recargar»
4 Feedback .......... 2/2  «☁️ N» my clouds live, the result screen's score + captain + «Tus nubes», lead and 25/50/75 %
                           banners
5 Finale ............ 2/2  «¡Fuego doble!» in the last 30 s, «¡FINAL!», cloud columns with a drum, winners vs the
                           others, 4 bonus stars, podium + MVP per kingdom, every kid's own card
6 Fair, no stall .... 2/2  server-judged painting, strokes in flight count for 0.6 s, «Más llamaradas» only from
                           streaks, pause stops every dragon
7 Product feel ...... 2/2  our dragons and the gang, Kenney sounds, phone at 390 and 360, projector at 1600×900
Total 13/14 → ships (≥ 12, no 0). To 14: Dubai landmark prizes in the sky (art request below).
```

### Open items and what to watch in the first real class
- **«¡Fuego doble!»** gives every right answer a Llamarada in the last 30 s: the sky swings a lot at the end. Watch
  whether the side that led all round feels robbed; the switch is `Paint.reward(streak, frenzy)` in `core/paint.js`.
- **Captains:** two of the gang each round, picked at random. Watch whether kids care who their captain is.
- **Lead announcements** on the projector: at most one every 7 s now (the sky flips often). If the class wants more,
  lower the 7000 in `js/host-paint.js` (the `lead` event).
- **Art request:** five Dubai landmark prizes for the sky (Burj Khalifa, Burj Al Arab, Museo del Futuro, Marco de
  Dubái, Atlantis) as small floating «islands» on #00FF00, the same style as Reinos' landmark pieces (→ Real place 2/2).
- **The show's length.** ~15 s from «¡FINAL!» to the cards (2.4 + 3.6 + 3.2 + 2.1 per star). If the class gets
  restless, «⏭ Saltar» jumps every phone to its card; the stage times are `REVEAL_MS` / `RESULT_MS` / `STAR_MS` in `public/js/party.js`.
- **A projector reloaded after the end** shows the old screen until `finReclaim(socket.id, g)` is called from
  `host:reclaim` (`reinos-de-colores.md` § Files). Phones that reload get their card back.
- **School Wi-Fi.** A flag tap or a paint stroke counts up to 0.6 s into «¡FINAL!» (`GRACE_MS`); a quiz answer sent
  during FINAL comes back unused. If kids complain «I answered!» at the bell, raise `GRACE_MS` in `core/party.js`.
- **The ceremony sounds** (drum, fanfare) under Profe Fer's voice: check the volume on the classroom speakers.
- **Art requests (Higgsfield in his Chrome; kid-safe, no text or logos):** each captain in a true «talking» pose on
  flat #00FF00 (the bubbles use the ready / victory poses today).

### Art batch 1 · 2026-10-17
- The captains' new poses (Higgsfield Unlimited, 0 credits, his Chrome): `assets/cast/<id>-{talk,jump,wow,67}.webp` for Fer, Hamdan, Latifa, Aileen and Adric (Adrian: Higgsfield refuses him, his three poses stay) and Dralingo `assets/dralingo/{talk,jump,wow}.webp`. `js/cast.js` rotates them: `hello` → hello or talk, `cheer` → cheer or jump, `mystery` → mystery or wow (held 25 s per character, so a moment never flickers); `talk` / `jump` / `wow` / `67` ask for exactly one. The shared ending (`js/party.js`): the reveal shows both captains surprised (`wow`), the result the winners cheering and the other captain speaking kindly (`talk`), the phone card the same; the captains' stickers are preloaded with the show.
- Dubai in the sky: five landmark «islands» (Burj Khalifa, Burj Al Arab, Museo del Futuro, Marco de Dubái, a palm-island resort; one Higgsfield sheet at one scale) in `assets/paint/islands/`, drawn by `PaintRender.islands()` behind the cloud platforms: the projector spreads them over the top of the sky, the phone with a slow parallax (30 % of the camera) so all five pass by; a slow bob, still with reduced motion. Scenery only (→ Real place 2/2).
