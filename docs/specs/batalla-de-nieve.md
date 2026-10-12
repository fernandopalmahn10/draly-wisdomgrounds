# Batalla de Nieve en Ski Dubái · new pin game

Status: **BUILT 2026-10-12 on a worktree branch, local only, not deployed** (gameType `snow`). What was built and how
it differs from this proposal: § «As built» at the end, with the scorecard (13/14, all gates passed).
His brief: "recreate this game, with all the elements I love"
after the video https://www.youtube.com/watch?v=PRQVS8Ti9FY (watched locally 2026-10-12: 100 frames + captions; frame
times below are approximate). Build with the `new-pin-game` skill; grade with `docs/GAME_QUALITY_CHECKLIST.md`
(ships at ≥ 12/14, no 0, all 5 gates).

## What the video shows (Gimkit 2D map game, infection style)
- Every student walks their own character around one big top-down 2D map: a snowy village (igloos, snowmen, pine
  trees, snow piles), an office (filing cabinets, arcade machines, round table), a farm (corn, hay bales, a pond)
  (~0:00–8:30). Signs «RUN!» / «WATCH OUT!» decorate the map.
- Header on every phone: «9/16 Cursed» rising to «15/16 Cursed» (~1:10 → 7:00), an energy + health bar (top-left),
  a big number top-right that drops through the game (their energy/score).
- Two sides: survivors (white ghosts) and the **Cursed** (mummies). Cursed players hunt survivors; a survivor who is
  caught joins the Cursed («half the people that are infected», «I'm the only one left»). Everyone throws
  **snowballs** at each other («I'm out of snowballs»); a hit player sees «respawning» (~8:35).
- **Question Answering Station**: a 4-coloured block on the map; walking to it opens a 4-option question (Spanish
  vocabulary: «la contabilidad», «trabajar» ~1:03, ~7:40); right answers give «+1500 Energy» and «LEVEL UP!» (~0:06).
- Side jobs that also pay: fishing at the pond («Looking for fish…», «Out of bait!» ~0:20–1:00), planting on the farm
  («Plant»), a «Read Case Log» item, glowing **5,000** pickups that appear around the map (~2:30, 4:50, 7:45).
- The tension: being chased, running between zones, the Cursed counter climbing, the last survivors.

## Ours: Batalla de Nieve en Ski Dubái (Dralingo style)
One sentence: every kid walks their saga avatar around a Dubai map, answers questions at stations to earn snowflakes
(❄️ «copos»), spends them on snowballs, and survives the **Hechizo de Hielo** (the ice spell) as long as possible;
frozen kids join the ice team and hunt the rest; the projector shows the whole map live.

### Map (a real place: area 1)
Top-down Dubai, made of our own art (Higgsfield tiles/props, no text, no logos), one map seeded so server,
projector and phones build the same one:
- **Ski Dubái** (centre, snow, igloos, snowmen) — the ice team's castle and respawn point.
- **El Zoco** (market stalls with spices and lanterns) — a question station.
- **El Creek** (water, abra boats) — pearl diving instead of fishing (small copos, a little mini-game).
- **El Desierto** (dunes, date palms) — harvest dates instead of planting (small copos).
- **Museo del Futuro** (the office zone) and **Plaza del Burj Khalifa** (fountain) — question stations + the big
  ❄️ 5,000 chests that spawn every ~30 s in a random zone (announced on the projector).
- Signs are pictures (a running Dralingo, a warning snowflake), never words.

### The gang (area 2)
- Each kid plays as the saga avatar they picked in the lobby (Saga.AVATARS, `public/js/saga.js`): Dralingo, Profe
  Fer, Hamdan, Latifa, Aileen, Adric, Adrian, the camel, the plane, the falcon, the oryx.
- Frozen kids get an icy-blue frost skin (recolour + frost overlay), so the two sides read at a glance on phone and
  projector (team colours on the characters, his rule).
- Two random cast members are the round's captains (one per side, VS intro in the countdown, like Reinos de
  Colores), cheering with their own lines from `js/cast.js` on big moments.

### Rules
- Start: everybody is a survivor; after a 10-s head start, **2 random kids** (more with 25+ kids) become the first
  ice team. Round 4–6 min (teacher picks), «+30 s» and «Terminar» always on the projector.
- Copos: start 3; right answer at a station +3 (streak of 3 → «¡Racha!» +2 extra); side jobs +1; ❄️ chest +5 to the
  first kid who reaches it. Wrong answer: no copos, the right answer is shown, next question at once.
- A snowball costs 1 copo. Survivor hit by an ice-team snowball: «¡Congelado!» → becomes ice team, respawns at Ski
  Dubái after 3 s. Ice kid hit by a survivor snowball: frozen in place for 3 s (stunned), can't be eliminated.
- Ends when the timer ends (survivors left win, each gets «¡Sobreviviste!») or when nobody is left (ice team wins).
- Score per kid: seconds survived + 50 per kid frozen + 20 per right answer; MVP per side.

### Phone (area 3: every tap answers)
- Joystick (left thumb) + big «❄️ Lanzar» button (right thumb, shows copos left); tap a station / chest / pearl to
  use it when close (it glows and pulses; a tapping hand on the first time).
- «Así se juega» 3 pictured steps before the round. Out of copos: full-width «¡Sin copos! Ve a una estación ❓»
  card with an arrow pointing to the nearest station. Just frozen: a big frost screen «¡Te congelaron! Ahora eres del
  equipo Hielo: ¡atrapa a los demás!».
- Sound on every throw, hit, pickup, right/wrong; Dralingo pose reactions.

### Projector (areas 4–5: feedback with restraint, finale)
- The whole map live, every kid as their avatar with a name tag; counter «7/24 congelados» with a frost bar;
  captains in the side panels; zone banners when a chest spawns.
- Big moments only for: first freeze, half the class frozen, the last 3 survivors (spotlight + heartbeat sound),
  30 s left. One DralingoFX at a time, ≥ 7 s apart.
- End: «¡Sobrevivieron!» with the survivors in a row and confetti, or the ice team's victory with Dralingo in frost,
  MVPs per side, top 6, gang finale; every phone shows the kid's own score and seconds survived.

### Fair, never stalls (area 6)
- Movement, hits and copos are checked by the server (phones send position 8 Hz like `paint`; the server validates
  throw range/cooldown and copos). Spamming throws never beats answering: no copos, no snowballs.
- Late joiners enter as survivors with a 10-s shield; a kid who leaves just disappears.
- Questions come only from the chosen pack (`/packs.html`), level-safe, pinyin without tones.

### Engine notes
Reuse the Dragones Pintores real-time pattern (`core/paint.js`, `js/player-paint.js`, `js/paint-render.js`): seeded
map, client-side movement with ≤ 1/60 s sub-steps, 5 Hz batched broadcast, test hook for headless checks
(`SnowPhone.advance(sec, keys)`). Top-down instead of side-view: no gravity, 8-direction movement, tile collisions.
Bot playtest handler `scripts/playtest/snow.js` must walk to stations, answer, throw and get frozen.

### Assets to make (higgsfield-art skill, free pictures; animations only within his credit OK)
Top-down tiles and props for the 5 zones (one sheet per zone, keyed and split), the ❄️ chest, a snowball, frost skin
overlay, station blocks, picture signs; music: a winter Arabic-flavoured loop (recorded, Kenney or made with
`video_tools/tarea_pipeline/music.py`), sfx for throw / hit / freeze / chest.


---

## As built (2026-10-12)

### Rules as built (what changed from the proposal, and why)
- **Map**: 44×26 tiles of 32 px, one seed builds the same Dubai on the server, the projector, the phones and the bots
  (`public/js/snow-map.js`). The zones never move (kids learn the map): El Zoco top-left (two rows of stalls), El Creek
  top-middle (water with Atlantis and the Burj Al Arab, a quay with 4 pearl spots, abra boats), Museo del Futuro
  top-right, **Ski Dubái** in the centre (snow ellipse, igloos, snowmen, pines, the ice team's snowflake), El Desierto
  bottom-left (date palms, oasis, a resting camel), **El Bulevar** bottom-middle (added: the Dubai Frame, palm planters,
  lamps), Plaza del Burj Khalifa bottom-right (the Burj, the fountain). The seed moves the stalls, igloos, snowmen,
  pines, palms, planters, benches and boats; every walkable tile stays reachable (checked in the generator and in the
  test). **5 stations** (one per corner zone + the Bulevar), 2×2 blocks in the four answer colours with a ❓.
- **Calor ☀️☀️☀️**: a survivor freezes on the **3rd** ice hit, not the 1st. Bot balance runs: with 1 hit the whole
  20-kid class was frozen ~40 s after the spell. A right answer gives 1 ☀️ back, and 15 s without an ice hit warms you
  up (+1 ☀️, «¡Te calentaste!»): answering keeps you alive.
- **Escudo de hielo**: while the ice team is at most 20 % of the class its kids can't be stunned (survivor balls bounce,
  «¡Tiene escudo de hielo! Mejor corre»). Without it 22 survivors kept the 2 ice kids stunned for the whole round and
  nobody froze (0 freezes in 4 min). Early game = a chase; once the ice team is big, survivors can fight back.
- **No stun-lock**: after a stun (and after a respawn) an ice kid is immune for 3 s. The ice team walks a little slower
  (138 vs 150 px/s) and throws a little slower (1 s vs 0.65 s), so a survivor who runs can get away.
- **«¡Último refugio!»**: when 3 survivors are left (class of 6+) they get full ☀️ and a 5 s shield, once — the finale
  lasts long enough to watch (projector: spotlight + heartbeat + final music).
- A freshly frozen kid keeps their copos (at least 1) and joins the hunt after 3 s at Ski Dubái.
- **After any answer the kid is back on the map** (the station is still under their feet: one tap = next question).
  The proposal's "next question at once" became: wrong answer shows the right one + «❓ Toca «¡Responder!» otra vez».
  A «🗺️ Mapa» button on the question screen lets a kid run away mid-question; a survivor with an ice kid within
  5 tiles sees «⚠️ ¡Cuidado! El Equipo Hielo está cerca» on the question screen.
- Side jobs are tiny mini-games: pearls = tap when the oyster opens; dates = shake the palm (4 taps). +1 copo, one job
  every 10 s per kid. The ❄️ chest (+5) appears every 24–34 s, never in the same zone twice in a row, and opens when a
  kid walks into it (first one wins); it leaves after 25 s.
- Before the spell (first 10 s) snowballs are off («¡Junta copos! El hechizo llega en 7 s»): everybody goes to a
  station first. Throws auto-aim at the nearest kid of the other side within 7 tiles (else straight ahead).
- Score: seconds survived + 50 per kid frozen + 20 per right answer + 10 per stun. MVP survivor = longest survived,
  MVP ice = most freezes.
- Teacher: **⏸ Pausa** (new `host:pause`, snow only for now: nothing moves, the clock stops, every timer moves forward
  on resume), «+30 s» (doesn't fire the end while paused), «Terminar ronda», mute, «Otra ronda».
- Every tunable number is in `core/snow.js` `R` (copos, calor, warmth, armor ratio, cooldowns, speeds, chest timing).

### Files
`core/snow.js` (rules, pure) · `public/js/snow-map.js` (map + collisions + saga skin per kid, shared UMD) · server.js
(«BATALLA DE NIEVE»: `snStart`, `snTick` 10 Hz physics / 5 Hz positions, `snHits`, `snMoments`, `snAnswer`,
`snPause`, `snFinish` per-phone game-end; handlers `player:sn-pos|sn-throw|sn-ask|sn-job|sn-grab`, `host:pause`) ·
`public/host-snow.html` + `js/host-snow.js` (projector; test hook `SnowHost.frame()`, `skipCountdown()`) ·
`js/player-snow.js` (phone; hooks `SnowPhone.advance(sec, keys)`, `walkTo(tx, ty)`, `throw()`, `use()`, `frozen()`,
`openMini(kind)`) · `js/snow-render.js` (shared canvas drawing: ground pre-rendered once per map, props + kids
depth-sorted) · `player.html` `#screen-snow` · `css/snow.css` · `js/player-kingdoms-skin.js` (snow branches: lobby
«Vas a jugar como …» + Así se juega, captain on the countdown, ☀️ | ❄️ bar, results, end) · `assets/snow/*.mp3`
(Kenney CC0: throw, hit, freeze, stun, copos, pop, chest, spawn, dive, heartbeat, «Mishief Stroll» chase loop) ·
registered in `games.html`, `packs.html`, `sets.html`, `js/maestro.js` · picture brief `content/snow/pictures.json`.

### Tests
- `node scripts/test-snow.js` — map (300 seeds: deterministic, no walled-in pockets, stations/jobs/spawns reachable,
  chest spots per zone) + rules (copos, racha, calor, brrr → freeze, stun, armor, no stun-lock, shields, cooldowns,
  no copos → no snowballs, walls stop balls, chest first-come, job cooldown, position checks incl. 9 600 wall-hugging
  positions, pause shift, end conditions incl. the last survivor's 10 s grace, scores, MVPs): 94 768 checks.
- `node scripts/playtest-bots.js --url http://localhost:3100 --game snow --bots 20 --seconds 60 --handlers
  scripts/playtest/snow.js --set pack:yct1-familia-r1` → **PASS** (20/20 joined, 253 questions, 0 stale, 0 frozen
  kids, 0 errors, game-end; again after the review fixes: 246 questions, PASS, and PASS with the default set). Bots walk the map with the phone's own collision code to stations (BFS), answer, throw at
  the nearest enemy, flee when out of copos, dive / harvest, race to chests. Balance runs (bots answer at random,
  ~25 % right): 30 bots / 150 s PASS (30/30, 522 questions; «la mitad», last 3, last 1; the ice team won at ~2:00), 24
  bots / 240 s PASS (459 questions; ice won at ~2:05; an earlier run ~2:45). Real kids answer far more often, which gives
  survivors ☀️ back and both sides more copos: tune `R` in core/snow.js after the first real class if rounds end too fast.
- Screenshots with playwright-cli (projector 1600×900, phone 390×844): lobby, VS countdown, Hechizo de Hielo, mid-game,
  «la mitad» cameo, pause, both end screens; phone lobby, first-play card, map + joystick, station + «¡Responder!»,
  question, wrong answer, snowball on an armored ice kid, brrr, pearl mini-game, frozen screen, pause, both end screens.
- Not run: the `classroom-playtester` agent (the shared Playwright MCP browser was in use by another job).

### Code review (agent-skills:code-reviewer, 2026-10-12), all fixed
Kids hugging a wall on the right/below were snapped back (0.1 px rounding poked the feet box into the wall: the phone now
sends exact positions and the server allows a 1 px hair) · mashing «Lanzar» faster than the cooldown made the phone
show «¡Sin copos!» with copos left (phone keeps the server cooldown, a refusal sends the real count) · the last
survivor's wifi blip ended the round (10 s grace + the end re-checks) · pause: snowballs in the air kept flying on
screens, the spell countdown wasn't re-sent, a kid on a question never saw the pause (balls cleared, `spellInMs` with
`sn:pause`, kids on a question go back to the map) · an empty spell (teacher testing alone) played the big moment ·
a rejoin lost the freeze credit of snowballs in the air · survival seconds counted while a phone was away · a second
«Terminar» replayed the end show · the teleport window is now 1.5 s. Not snow-specific (left as is, every game): a
projector that is offline at the exact end misses `game-end` and needs a reload.

### Pictures still to make (Higgsfield, his Chrome)
`content/snow/pictures.json`: 28 pictures (igloo, snowman, pine, stall, spice sacks, lantern, abra, oyster, date palm,
oasis, rock, fountain, bench, planter, street lamp, ice chest, snowball, copo, two picture signs, seamless snow / water /
sand ground, Dralingo throwing / frozen in ice / on skis, the six captains holding a snowball) + a recorded winter
Arabic loop. Each entry names the `snow-render.js` drawing it replaces.

### Scorecard · Batalla de Nieve en Ski Dubái · 2026-10-12 · worktree branch (not deployed)
```
Hard gates: bots PASS (20/20, 0 frozen, 0 errors, game-end) · teacher controls ✓ (Pausa / +30 s / Terminar / Sonido;
  question 20 s timer, mini-games 6 s, frozen screen 3 s, nothing waits on a kid) · saga only ✓ (saga avatars, the
  cast, Dralingo, Dubai landmark pieces; test-wording clean incl. the snow files) · Spanish/pinyin/level ✓ (questions
  only from /packs.html, pinyin without tones, Spanish UI) · kid-safe ✓ (no touching; pictures are the existing stickers)
1 Real place ........ 2/2  Dubai map with 7 named zones and 5 real landmarks (Burj Khalifa, Burj Al Arab, Atlantis,
                           Museo del Futuro, Dubai Frame); prizes worth points: ❄️ chests +5 (rotating zones, first one
                           wins), pearls/dates +1; stations in every corner + the Bulevar (proj-mid.png, phone-map.png)
2 The gang .......... 2/2  two captains per round (VS countdown proj-countdown.png, side panels, «la mitad» cameo with
                           Adric's own line proj-bigmoment.png, 30 s cameo, gang finale); the ice captain greets every
                           frozen kid with a line (phone-frozen.png); every kid plays as their saga pick, frosted blue
                           with an ice ring when frozen, gold ring when free — on phone and projector
3 Every tap ......... 2/2  joystick 132 px, «Lanzar» 120 px, «¡Responder!» 86 px; station in reach glows gold;
                           tapping hand on joystick / Responder / Lanzar; «Así se juega» in the lobby + first-play card;
                           sounds + buzz on every tap; prompts with an arrow: «¡Junta copos!», «¡Sin copos! Camina a una
                           estación ❓»; frozen / stunned / pause cards (phone-station.png, phone-help.png)
4 Feedback .......... 2/2  right (+3 ❄️, ¡Racha!, ☀️ back), wrong (answer + hint), brrr (frost edges), freeze (frost
                           screen), stun, armor, chest, jobs each their own reaction; projector banners ≥ 2.5 s apart,
                           big moments one at a time ≥ 7 s apart (Hechizo, half, last 3, 30 s); 30-kid run
                           (proj-spell.png, phone-throw.png, phone-result.png, phone-station2.png)
5 Finale ............ 2/2  frost bar climbing, «la mitad», «¡Último refugio!» + heartbeat + final music, «¡Solo queda X!»,
                           30 s cameo + ticking; end: survivors in a row + confetti, or the frozen champion Dralingo + ice
                           captain; MVP per side; top 6; gang finale; each phone its own points, seconds, freezes
                           (proj-end-sun.png, proj-end-ice.png, phone-end-*.png)
6 Fair, no stall .... 2/2  time-up = wrong (no copos); answers +3 beat jobs +1 (10 s cooldown); no copos no snowballs;
                           server checks speed, walls, reach, cooldowns; no stun-lock; armor; late joiners 10 s shield;
                           no body-blocking; rejoin keeps everything (tested with a reload mid-round); Pausa/+30 s/
                           Terminar/Otra ronda mid-round (proj-paused.png)
7 Product feel ...... 1/2  recorded sounds + music (Kenney), phone as polished as the projector, right at 390 px and
                           1600×900, the saga + cast + landmark art — but the map's props and tiles are clean
                           canvas drawings in the sticker style, not Higgsfield pictures yet (brief: content/snow/
                           pictures.json, 28 pictures)
Total 13/14 → ships (≥ 12, no 0). Work left for 14/14: the Higgsfield props/tiles and a recorded winter-Arabic loop.
```

### Next ideas (not built)
Footprints in the snow, the ice gate at Ski Dubái as a picture, an «hielo» trail behind ice kids on the projector,
`host:pause` for the other games, more stations when the class is over 30.
