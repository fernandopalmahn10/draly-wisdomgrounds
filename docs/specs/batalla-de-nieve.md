# Batalla de Nieve en Ski Dubái · new pin game (spec, not built)

Status: **SPEC 2026-10-12** (gameType proposal `snow`). His brief: "recreate this game, with all the elements I love"
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
