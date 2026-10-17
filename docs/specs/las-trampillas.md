# Las Trampillas · ¡Que no te trague el suelo! (gameType `trapdoor`)

Mario Party recreation #2 of his series (2026-10-17): the minigame of his video at 4:43-5:41
(https://www.youtube.com/watch?v=y9BKCVx_mNk), the round platform whose pie slices drop like trapdoors. Analysis and his
picks: `.claude/handoff/trapdoor-video/next-minigame-analysis.md` (root repo, this PC). Built on a branch, not deployed.

## The video, frame by frame (80 frames, 4:43 → 5:41)
- One big round platform split into **8 equal pie slices** (seams every 45°, from 12 o'clock) around a raised **hub**
  that shows the countdown; a thick gold rim; a fixed **tilted top-down camera**: the whole platform and every player
  always in view. ~20 characters on it at once, **red rings vs blue rings** under their feet.
- Flow: black → the platform → **«START!»** (1.5 s) → **«Round 1»** with 3 progress dots (1.5 s) → pink warning
  slices start jumping (~2 s) → the hub counts **5, 4, 3, 2, 1** (1 s each) while the pink slices keep jumping around the
  circle (a bluff: every ~0.7 s a new place) → **«0»**: the slices lit at that instant hold ~1 s (the last dash) → they
  **open like double doors** hinged on their outer seams, everyone on them drops into the dark (~1.5 s) → the floor
  closes (~0.6 s) → **«Round 2»** → the same → **«Final Round»** → **«FINISH!»** over the survivors → **«Team Mario
  Wins!»** (the team with more survivors), the whole cast celebrating on the platform.
- What drops: Rounds 1 and 2 = **one quarter** (2 adjacent slices); the Final Round = **two opposite quarters** (a bowtie,
  half the floor), the lit pair rotating 45° at a time. A round is ~13 s.

## Our version: the same minigame, reskinned (his three picks)
**1 · Answers save you.** Exactly the video's round, plus: during the countdown each kid on the platform gets a question
on the phone; a **right answer gives their character golden WINGS** for this round's drop: standing on a falling slice
with wings, the wings flap and hold them over the hole, then set them down when the floor closes (wings used up). Wings
are earned again every round (every round every kid answers). The wings question closes at «0» (the dash belongs to
running). **Kids who fell answer to come back**: in the pit their phone keeps asking; a right answer brings them back up
at once (rising onto the platform) if there is still time before «0» this round (≥ 1.8 s), else at the start of the next
round. While they wait for that start, one more right answer = they come up with wings. Nobody just watches.
**2 · Fuego vs Mar.** Red vs blue rings, the whole class (10-30) on one platform. After each drop every kid still
standing scores **1 point for their kingdom** (the Final Round counts double: «¡vale doble!»); the kingdom with more
points wins («¡Gana el Reino del Fuego!»), then the shared Mario Party ending (`core/party.js`, `js/party.js`).
**3 · The arena (Claude's pick, Dubai + China).** Three arenas, the teacher picks one in the lobby, «Otra ronda» = the
next: **El Palacio de Dubái** (a royal hall's round marble mosaic, gold and turquoise, the night skyline through the
arches; the pit = a pool of giant floating cushions), **El Templo del Cielo** (Pekín: the round white marble altar, the
blue triple-roof hall behind it at sunset; the pit = a misty lotus pond), **El Jardín de la Luna** (Suzhou: a round
pebble-mosaic courtyard behind a moon gate, lanterns and bamboo; the pit = a koi pond). Art: Higgsfield Unlimited.

## Timing (one round = 13.1 s, like the video's ~13-15 s)
| Phase | ms | What every screen shows |
|---|---|---|
| TITLE | 1500 (Final 2200) | «Ronda N» + the progress dots; wings reset; waiting kids rise; the wings question appears |
| ROULETTE | 2000 | pink slices start jumping (no number yet) |
| COUNT | 5000 | the hub counts 5 → 1 (tick each second); the pink keeps jumping, faster near the end |
| LOCK | 1100 | «0» + alarm: the chosen slices burn hot pink; the wings question closes («¡CORRE!») |
| OPEN | 1700 | the doors swing down; falls judged on the server at this instant; wings hover over the hole |
| CLOSE | 600 | the doors close; saved kids land |
| TALLY | 1300 | «+N en pie» per kingdom, the lead; then the next round (or «¡FINAL!») |
Game: «¡YA!» intro 2.6 s, then **5 · 7 · 10 rounds** (teacher's pick in the lobby, default 7 ≈ 1.6 min), the last one
is always «¡Ronda final!». What drops: quarter (2 slices) in the first half, **3 slices** in the second half («¡Ahora
caen 3!», the roulette faster), the bowtie (4 slices = two opposite quarters) in the Final Round. The final set is drawn
uniformly at random at «0» by the server, independent of the roulette and of where kids stand (the roulette is a bluff,
like the video). A class plays several matches with «Otra ronda» (the next arena each time).

## Movement (server-authoritative, the paint recipe)
- Platform radius 100 world units; the hub 24; a kid's feet stay between 32 and 93 from the centre. **Tap the floor =
  run there** (`player:td-go {x, y}`, an intent: clamped, ≤ 12 a second); the server moves every kid at 10 Hz at
  92 u/s (≈ 2 s across), sliding around the hub; nobody enters an open hole; position only ever changes by the server's
  step. The phone predicts its own run at the same speed (the tap answers in the same frame) and eases onto the server.
- Positions out at 5 Hz (`td:pos`, only the kids that moved, everyone every 2 s); round plan once per round (`td:round`,
  the roulette schedule included, never the final set); `td:lock` / `td:open` / `td:tally` at those instants; `td:me`
  per kid on a change; `td:roster` on joins and team changes. No `state` pushes during play.
- Which slice a kid is on = the slice of their feet point. Falls are judged on the server's position at the OPEN instant.

## Phone (the product, 390×844 and 360×640)
Top: Fuego vs Mar points + who is still standing, the round dots, «Sonido». Middle (flex): **the whole platform**
(tilted, full width), every kid as their full-body saga character on a red / blue ring, **mine 1.4× bigger, a pulsing
ring and «TÚ»**, names only near me (never overlapping), the pink slices, the hub's big number. Bottom: **a compact
question card** (header in words, a 64 px picture + the prompt, four 2×2 tiles ≥ 58 px): **tap-to-move on the platform +
answer below = two separate areas, no mode switch**, so a kid can run and answer without fumbling (the alternative, a
sheet over the floor like Pintores, would hide the slices during the countdown: rejected). The card collapses to one line
once answered («🪽 ¡Tienes alas! Ahora ¡esquiva!»), giving the platform more room. In the pit: the platform stays in view
(the action above), my character waits in a «foso» window in the corner (the arena's pit art), the card says «¡Caíste!
Responde y vuelves arriba». Moments on every phone: «¡YA!», «Ronda N», «¡RONDA FINAL! ¡vale doble!», «0 · ¡CORRE!»,
«¡Tus alas te salvaron!», «¡Caíste!», «¡De vuelta!», «+9 en pie», lead changes with my captain's line. «Así se juega» (3
pictured steps) on the first round + a tapping hand on the floor.

## Projector (secondary, 1600×900, readable from the back)
The arena art filling the screen, the platform big in the middle with every kid, name tags collision-avoided, the
hub's number big; top: PIN, Fuego points (en pie), «Ronda 3 de 7» dots, Mar points; sides: the captains + rosters (🪽
wings, 🕳️ in the pit); bottom: **«El foso»** strip with the fallen kids (their heads rise when they come back);
bands for «¡YA!», «Ronda N», «¡Ronda final!», «+N en pie». Lobby: PIN, the arena (picture + «Cambiar arena»), rounds
5 · 7 · 10, the kingdoms, Equilibrar, «Así se juega», start. Countdown: the captains' VS.

## Fairness (sim `scripts/test-trapdoor.js`, 200+ simulated classes)
- A stronger kingdom usually wins (more wings, faster comebacks); chance still matters (where you stand at «0»).
- Server judges answers: a guess under 450 ms = wrong; one answer per question; a wrong one waits 2 s (3.4 s after two
  in a row) before the next; the wings question closes at «0»: mashing never earns anything.
- No teleport, no client deciding a fall, no entering a hub or an open hole; the final set is uniform random.
- Late joiners and kids whose phone dropped: a late joiner rises at the next round; a dropped phone's character stays
  (greyed) and can fall, but only connected kids score.

## Teacher
⏸ Pausa (everything stands still: the count, the roulette, the runners, the question clocks), «+30 s» = **2 rondas
más** (up to 15, not during the Final Round), ⏭ Saltar (the intro, a tally), Terminar («¡FINAL!» now), Sonido, «Otra
ronda» (the next arena), F5 reclaim with the room token (`teacher-gate.js`), arena + rounds in the lobby, Equilibrar.
Every wait has a timeout: phases are timer-driven, a question nobody answers closes at 20 s (phone) / 21 s (server).

## Ending (shared ceremony)
«¡FINAL!» → the reveal «¿Qué reino quedó más en pie?» → «¡Gana el Reino del …!» → bonus stars (at most 4): **Siempre en
pie** (longest run of rounds standing), **Alas salvadoras** (times the wings saved them), **Más aciertos**, **Vuelta
épica** (comebacks from the pit) → each phone's card («Aguantaste N rondas en pie», wings, comebacks, aciertos).
