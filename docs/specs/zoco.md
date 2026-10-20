# El Zoco de Dralingo · the characters shop

His idea (2026-10-19): "more avatars, more characters in different forms, better skins… a marketplace… they should be
locked". His OK of the design: "Okay I approve the design of the Souq" (5 phone boards: the Zoco, a locked character,
«¿Cómo gano monedas?», «¡Ya es tuyo!», Mi perfil «Elige tu personaje»; https://claude.ai/artifact/Tfi3racK5kFX72yempjpzT).
Rules: mochi-mash/CLAUDE.md § «El Zoco de Dralingo».

## What a kid sees and does
1. **The coins pill** in Mi Dralingo's band (beside Papás on a laptop or a wide phone; in the small line under «¡Hola!» on
   a narrow phone), a door card after the path on a phone, a tile in the dock on a laptop. All open the Zoco.
2. **`#zoco` El Zoco de Dralingo**: «Volver», the purse (→ «¿Cómo gano monedas?»), the title and line of the design, one
   character in the spotlight on the Dubai sky («Nuevo en el Zoco», its price and lock; the first visit shows Dralingo
   Emperador Qin like the design, later visits a different locked one), the sections Dralingo · La pandilla · Mascotas
   («11 formas», «5 personajes»; Mascotas hides while all three are held), 2 cards a row on a phone (more on a laptop):
   the full-body render on sand, a lock, the name, the price; «Tuyo» once theirs; «¡Ya te alcanza!» when the purse
   covers it. Last: «¿Cómo gano monedas?». A one-time «¡Un regalo de bienvenida!» card when the kid got the welcome grant.
3. **`#zoco-<id>` a character**: the render big on the Dubai sky with its shadow, «Volver al Zoco» + the purse; the sheet:
   its tag («Dralingo · forma especial» / «La pandilla · en 3D» / «Mascota»), name, one line; «Tienes X de P» + «Te faltan
   Y» and the gold bar; «Desbloquear por P» grey + «Gana las monedas que te faltan» (→ #monedas) until the purse covers
   it; then «Desbloquear por P» gold → «¡Sí, desbloquear!» (with «Te quedan N monedas después.») or «No, todavía no».
   Once theirs: «¡Ya es tuyo!», «Usarlo» (or «Lo estás usando…»), «Volver al Zoco».
4. **`#tuyo-<id>` «¡Ya es tuyo!»** right after a purchase: the red page with the gold rays (turning slowly), «¡Nuevo
   personaje!», the character popping in, its name, «Desde hoy puedes jugar con él/ella…», «Usarlo ahora» (it becomes
   their character and opens «Elige tu personaje»), «Volver al Zoco». The recorded star sound plays (a tap started it).
5. **`#monedas` «¿Cómo gano monedas?»**: the six ways with their coins (the server's table, one source with the pay), a
   line when coins wait for tomorrow (the daily caps, said in plain words), «Desafío del día: muy pronto también da
   monedas», «¡A ganar monedas!» (→ today's step, «Hoy»).
6. **`#personaje` «Elige tu personaje»** (Mi perfil's row, which replaced «Cambiar mi avatar»): «← Mi perfil», «Ahora
   juegas con» + the character + «En tu perfil y en los juegos», «Tus personajes» (the skins they own first, then the 11
   free saga avatars; one tap = their character), «En el Zoco» (the rest, greyed with lock and price, each to its page),
   and a door back to the Zoco.
7. **«+N monedas»**: a small gold pill at the top edge (nothing to tap, gone by itself, recorded coins sound) when a step
   pays: La Base's seals, El Entrenamiento's round at its goal, «¡Ya la mandé!» on the homework cards (and «−50 monedas»
   on «Deshacer»), after a class game's ceremony on the phone (6.5 s after the end, never over the reveal), and on the
   home for coins that came in elsewhere since this phone last looked (by the server's clock).
English: the hw-i18n block «El Zoco de Dralingo» (every line settles).

## Coins (core/zoco.js; judged on the server, on the kid's own record) · v1 amounts, see «v2 · 2026-10-20» for today's
| Step | Coins | Once per | Where it is judged |
|---|---|---|---|
| A word marked in La Base | +2 | word (an unmark + mark pays nothing) | `POST /api/ruta/seals` |
| A practice of El Entrenamiento at its goal (the Dorado %) | +20 | world (Pinyin básico and Simulacro del examen too) | `POST /api/ruta/train/finish` (+ a key-only phone's proofs at login, `/scores`) |
| A homework marked «¡Ya la mandé!» | +50 | homework of the kid's own level; «Deshacer» takes the 50 back | `POST /api/ruta/tareas` |
| A class PIN game played for real (3+ answers; Ojos de Halcón: 3+ looks) | +10 | game round (room id + start) | every game's finisher → `_zocoGameEnd` |
| A bonus star of that game's ceremony (Monopolio / Carrera: their bonus stars) | +5 each | game round | same |
| 7 days in a row (a real step each day, the kid's calendar) | +30 | each 7 of the same run (7, 14, 21…) | after every step, and on the home |

**Daily caps** (the kid's own calendar): seals 100 coins (50 words) and homework 150 coins (3 homeworks) a day; what passes
the cap WAITS and is paid first thing on the next days (nothing is lost, it is only paced: a free tap can mark 300 words
or every homework at once). Games 6 a day, bonus stars 8 a day: past the cap a repeat simply pays nothing that day.

**No farming**: every payment has a key kept on the record (`k`), so a repeated tap, a re-seal, a replayed practice, a
reconnect after a game's end or a merged account never pays twice. «Deshacer» of a homework takes back exactly what it
paid, even below 0 after a purchase (spend-then-undo never mints coins); a homework sent before El Zoco never pays and
is never taken back.

**Before El Zoco (the welcome grant, decided 2026-10-19)**: everything already done when the kid's purse opens (their
home, the shop, or their first step after the launch: the server opens it BEFORE the step changes the record) counts as
done and never pays coin by coin. A diligent kid should not start at 0 next to a new one, so the purse opens with a
one-time grant: half pay for it (1 per word sealed, 10 per practice at the goal, 25 per homework sent), at most 150
(one character at most).

**Who earns, spends and equips**: only the account the request proves is the kid's (their /homework session for La Base,
El Entrenamiento and the homework marks; a PIN join that `_joinOwns` proved for a class game). A classmate's code in a
body moves nothing. Buy and equip: the kid's session only, same site (`_autoSameSite`), `who` (another account's mirror →
409), 30 a minute per kid; reads 4000 per 5 min per address.

## The catalog (core/zoco.js CATALOG + public/js/saga.js ZOCO) · v1 prices and held ones, see «v2 · 2026-10-20» for today's
Renders of his models: `assets-library/originals-renders/2026-10-19/` (`roster.json`). Shipped in
`public/assets/zoco/full/<id>.webp` (480 px tall, 13-39 KB, re-encoded from the 1024 px PNG) and `avatar/<id>.webp`
(256 × 256, 10-21 KB): about 430 KB + 240 KB on disk for the 16 on sale. The 4 held ones are NOT published (their licence is
still to confirm; their renders stay in assets-library).

| id | name | section | price |
|---|---|---|---|
| dralingo-emperador-qin | Dralingo Emperador Qin | Dralingo | 400 |
| dralingo-emperador-barba | Dralingo Emperador Sabio | Dralingo | 350 |
| dralingo-fuego-azul | Dralingo Fuego Azul | Dralingo | 300 |
| dralingo-emperador | Dralingo Emperador | Dralingo | 250 |
| dralingo-sheikh-paseo / -paseo-roja | Dralingo de paseo (· ghutra roja) | Dralingo | 200 |
| bebe-dralingo-emperador | Bebé Dralingo Emperador | Dralingo | 200 |
| bebe-dralingo-kufiya | Bebé Dralingo con kufiya | Dralingo | 200 |
| dralingo-sheikh / -roja | Dralingo Sheikh (· ghutra roja) | Dralingo | 150 |
| dralingo-clasico | Dralingo clásico | Dralingo | 150 |
| profe-fer, hamdan-3d, aileen-3d, adric-3d, adrian-3d | Profe Fer de traje, Hamdan con kandura, Aileen artes marciales, Adric de negro, Adrian con chaqueta | La pandilla | 200 |
| latifa-3d | Latifa con abaya | La pandilla | 200 · **held** (Ready Player Me head) |
| perro-de-adric, poni-de-aileen, panda-3d | El perro de Adric, La poni unicornio de Aileen, Panda | Mascotas | 250 · **held** (model origin / licence) |

Kept out: `bebe-dralingo` and `bebe-dralingo-alas` (the storybook outfit: one area's look never in another) and the six he
flagged (Come-palabras, Camello, Monje John, Chica Kung Fu, Señor de lentes, Guardián maya). Names as in roster.json
(the dog, the pony and the panda: his to rename). **To sell a held one**: delete its `hold` in core/zoco.js (one line)
and copy its two renders (full + avatar webp, renamed to the catalog id) into public/assets/zoco; test-zoco checks the
files of everything on sale. A held character is never listed or sold; a kid who somehow owns one keeps it.

## A skin is the kid's character everywhere
- The record: `rec.avatar` = the skin id (`Students.setAvatar` accepts a skin only when `rec.zoco.own` has it).
- Pages: `Saga.avatarUrl(id)` → `/assets/zoco/avatar/<id>.webp` (Mi perfil, the band, Papás, /maestro rosters, the
  warm-up Cuaderno, host-hsk rows: they all use it); homework.js labels skins by their names.
- Pin games: the phone keeps the skin in `dralyAvatar` (Mi perfil's «Usarlo» sets it; a saga avatar sets its emoji).
  `player:join` keeps a skin only when the account the phone proved owns it, and the account's equipped skin wins over
  the phone's lobby pick (`_gameAvatar`); otherwise the skin's base character's emoji. The join answer tells the phone
  its `avatar` and `skins` (the lobby picker shows them first); `player:set-avatar` checks ownership the same way.
  Every renderer resolves the id: `HalconBoard.skinFor/art/head/isAnimal` (Halcón, Mochi, Piñata, 6-7, Monopolio,
  Carrera, Pintores, Trampillas, the shared ceremony), `SnowMap.skinFor` (server + Nieve + Fuga), `SnowRender` /
  `EscapeRender.SKIN_URL` (heads). A skin has one full-body picture: it is drawn for every pose (ready / victory / sad /
  6-7), with the game's own motion on top; team colours stay on the figure's outline, disc and tag (the same CSS as the
  saga characters). Text-only lists (projector lobby chips, warm-up / reading rosters) print `Saga.emojiOf(id)`.
- «Vas a jugar como …» (Nieve, Fuga, Halcón): `Saga.labelOf(id)`.

## Endpoints
- `GET /api/zoco?since=<ms>` → `{ ok, student: false }` | `{ ok, student: true, who, now, coins, earned, waiting,
  welcome, own, equipped, items [{ id, name, cat, price, blurb, owned, hero, animal, full, head }], cats, fresh, ways,
  news [{ at, n, why }], caps, settled? }` (opens the purse, pays what waited for a new day and a streak).
- `POST /api/zoco/buy { id, who }` → `{ ok, coins, own, item }` · 402 `why: 'coins'` · 404 `why: 'item'` · 409 owned /
  another account's mirror · 403 another site or no session.
- `POST /api/zoco/equip { id, who }` → `{ ok, avatar }` · 403 not theirs.
- Steps answer `coins: { got, c, items, at }`; `GET /api/homework/home?zs=<ms>` answers `zoco: { coins, news, now }`;
  the socket sends `zoco:coins { got, c, items, game, at }` after a game's end.

## Tests
`node scripts/test-zoco.js` (port 4580): see its header. Related suites: zoco home papas entrada ruta-dorada
ruta-progress ruta-tareas ruta-training homework-ownership wording party.

## As built · 2026-10-19
- Security review (agent-skills:code-reviewer, before the hand-back) fixed:
  - «Pasar mi progreso» moves only what is NEW to the real account. Keys it lacks keep their value; words count 2 each,
    never more than the automatic account really earned for words (`ps`) or had waiting. What it spent is charged, so
    spending on duplicate work becomes a debt, never minted coins. A purse merges once (`mergedInto`).
  - The caps' day only moves forward: flipping the phone's time zone never resets them.
  - A skin smuggled through the 8-character avatar cut («adric-3dX») is checked like a skin (join + lobby swap).
  - A slot pays its game only to the account it was made for (`zocoCode`): typing a dropped kid's name takes the slot
    (as rooms always did) but never its coins.
  - The held characters' pictures are not published.
  - The homework line pays only homework still marked; «Deshacer» takes back across levels.
  - One kid's error never stops the others' game coins.
  - The page accepts the shop's answer only for its own kid (`who`).
  - A debt shows as 0, with a plain line on «¿Cómo gano monedas?».
  - Left as notes: a legacy account with no class code is proven by its code alone (existing rule), so a stranger
    holding that code sees its skins list in a PIN room (coins still go only to its owner). If the Dorado % is
    lowered later, worlds between the new and the old goal pay their +20.
- Fresh-eyes design review (after the design skills pass) fixed:
  - A winged Dralingo skin stood half as tall as the other kids in the games (scaled by its wingspan): it may now
    spread past its box (`[src*="/zoco/full/dralingo-"]` in mochi.css, halcon.css, monopoly.css, dragon.css), so it
    stands as tall as everyone; the lobby cards and the kid's end card give it the wider half.
  - The phone band's coins are a gold pill that reads as a button (it was 12 px gold text).
  - The spotlight places the character by its face (`ar`, `hx` in saga.js): the title never sits on it.
  - A short phone (360 × 640) shows both buttons of a locked character on the first screen.
  - «¡Ya te alcanza!» is gold, never green (green only means «Tuyo»); the keyboard ring is Rojo Imperial.
  - The gang are named by their outfit, never «3D»: Profe Fer de traje, Hamdan con kandura, Adric de negro, Adrian con
    chaqueta (Latifa con abaya, held); the category says «La pandilla · nuevo look».
  - The round heads are cut around the face (the old ones were the top of the picture: a hat and a wing), and «Tus
    personajes» shows every character you have as a round head.
  - Look-alikes (Emperador / Sabio, the four Sheikh forms) never sit side by side (the catalog's order; the test checks it).
  - «¿Cómo gano monedas?» on a laptop: the header on the list's width.
  - Every end card gives the name tag room before the title.
- Tests: test-zoco 171 checks. The related suites passed: home 310, entrada 138, papas 122, party 80,127, ruta-dorada 99,
  ruta-progress 161, ruta-tareas 92, ruta-training 233, homework-ownership 56, wording, asset-guard.
- Live games:
  - halcon 37, mochi 49, monopoly 92, party 181 (Reinos, Pintores, Nieve, Fuga), samename 32.
  - A skin in all 11 pin games: 66 checks. The projector, the kid's phone and the ending draw it. A classmate sending
    the same skin without owning it plays its base character.
  - Bots: Mochi Mash 20 kids, 0 frozen, 0 errors.
- Scroll check (real wheel, 390×844 · 360×640 · 1366×657): 0 traps on 9 views.
- Screenshots: `.claude/handoff/zoco-shots/` (made-up kids).

## v2 · 2026-10-20
His words: "Go ahead with the Higgsfield animations and Canva, because they look too plain and boring now. Also make it
a lot more difficult to get the points, because elsewhere everyone is going to be unlocking super cool characters. I
bought licenses for all these models before in the past. … It should feel like the 3D avatar is there waiting for you."
Rules: mochi-mash/CLAUDE.md § «El Zoco de Dralingo» («Unlocking is hard and special», «Licences», «The character waits
for you»).

### Unlocking is hard and special (core/zoco.js PAY, CAP, the catalog)
| Step | v1 | **v2** | Once per |
|---|---|---|---|
| A word marked in La Base | +2 | **+1** | word |
| A practice of El Entrenamiento at its goal | +20 | **+10** | world |
| A homework marked «¡Ya la mandé!» | +50 | **+25** | homework («Deshacer» takes back what it paid) |
| A class PIN game played for real | +10 | **+5** | game round |
| A bonus star of its ceremony | +5 | **+2** each | game round |
| 7 days in a row | +30 | **+15** | each 7 of the run |

**Daily caps, in steps** (`CAP`; the day's counters stay in coins, `CAPC` = steps × pay): **30 words, 2 homeworks**
(the rest waits and is paid first thing the next days), **4 games, 5 bonus stars** (past them a repeat pays nothing that
day). «¿Cómo gano monedas?» shows the six amounts (from `PAY`) and always one line with the caps: «Cada día pagan hasta 30
palabras, 2 tareas, 4 juegos y 5 estrellas.» (the waiting coins on their own line). An active kid (a practice or two, two
homeworks, two class games and ~30 words a week, a streak) earns ~150 a week.

**Prices 800-3000** (the first character ~5 weeks of an active kid, Dralingo Emperador Qin ~5 months):
| Character | Section | v1 | **v2** |
|---|---|---|---|
| Dralingo Emperador Qin | Dralingo | 400 | **3000** (the top) |
| Dralingo Fuego Azul | Dralingo | 300 | **2500** |
| Dralingo Emperador Sabio | Dralingo | 350 | **2200** |
| Dralingo Emperador | Dralingo | 250 | **1800** |
| Bebé Dralingo Emperador | Dralingo | 200 | **1500** |
| Bebé Dralingo con kufiya | Dralingo | 200 | **1200** |
| Dralingo de paseo · Dralingo de paseo (ghutra roja) | Dralingo | 200 | **1000** |
| Dralingo Sheikh · Dralingo Sheikh (ghutra roja) · Dralingo clásico | Dralingo | 150 | **800** (the plain forms, cheapest) |
| Profe Fer de traje | La pandilla | 200 | **1600** |
| Hamdan con kandura · Latifa con abaya · Aileen artes marciales · Adric de negro · Adrian con chaqueta | La pandilla | 200 | **1400** |
| La poni unicornio de Aileen | Mascotas | 250 | **1500** |
| El perro de Adric · Panda | Mascotas | 250 | **1200** |

**Nothing changes for what kids already have** (a purse of 2026-10-19 takes v2 at its next touch, `upgrade()`, once):
- its coins (a debt too), what it earned and spent, its characters (bought at the old prices: they stay theirs, «Tuyo»,
  equipped) and its welcome grant stay exactly as they were; the grant is never paid again nor taken back;
- every key keeps what it paid, so «Deshacer» of a homework paid 50 takes back 50 (never minted);
- what was still WAITING for the day's cap was not in the purse yet: each waiting step is paid at the amount of the day
  it is paid (21 words waiting at 2 → 21 coins; a homework waiting at 50 → 25), and today's counters of words and
  homework turn into the same steps (today's caps count what really happened today);
- the purse keeps `v: 1` (its shape did not change) and gets `pv: 2` (+ `pvAt`): a server rolled back to v1 still reads
  every purse as it is (it would mistake a `v: 2` for a damaged purse and open a new one over it, coins and characters
  lost). An automatic account's purse is upgraded the same way before «Pasar mi progreso» (its waiting homework joins the
  real account's line at 25).
- **Coins already in a balance keep their value everywhere, a «Pasar mi progreso» move included** (review 2026-10-20: the
  merge valued an automatic account's words at today's 1 though they were paid 2, so a kid who had bought with them got
  a debt): `upgrade()` keeps `ps1` (the coins its words earned under v1) and the merge moves the first `ps1 / 2` new
  words at 2, the rest at today's 1, still never more than the account really earned for words or had waiting. Tested:
  50 words paid 100 move 100; 100 words (200) that bought Dralingo Sheikh at 150 with 50 left move +50 with the Sheikh.
- **«Deshacer» gives back exactly what that step paid; marking it again pays today's amount** (a homework paid 50 under
  v1, undone and marked again: −50, then +25).
- **A rollback** (v2 deployed, then a v1 server, then v2 again): a purse at `pv` 2 or later is never converted again
  (`Number(pv) >= 2`: a later version rolled back never has its line halved a second time). Whatever the v1 server
  queued meanwhile is paid as it stands when it comes due: the words' line holds coins, so those words pay their v1 2;
  a homework in the line is read within 0 … today's 25 (a damaged entry, a null, «abc», a huge number, is dropped or
  read within that range and never blocks the homework behind it).
- The welcome grant for a purse opened from now on: half of the v2 pay (½ a word, 5 a practice, 12.5 a homework), at most
  150 (unchanged).
- **Pages open across the deploy**: `GET /api/zoco` sends the day's limits in steps as `limits` (the v2 page reads
  it) and keeps `caps` in the v1 units for this release (coins of words at 2, of homework at 50), so a tab opened before
  the deploy still says «30 palabras y 2 tareas». Drop `caps` once every phone has the v2 page.

### Licences: all 20 on sale
No `hold` left (the mechanism stays for later). The dog, the pony, the panda and Latifa con abaya were shipped like the 16 of
2026-10-19 from `assets-library/originals-renders/2026-10-19/`: `full/<id>.webp` 480 px tall re-encoded from the 1024 px
PNG (13-26 KB), `avatar/<id>.webp` 256 × 256 cut around the face (7-10 KB). saga.js gives them `ar`, `hx`, `fx`. The
pony's line was its name; it got one of its own («Galopa con Aileen a toda velocidad y su cuerno brilla con cada acierto.
¡Dale!»). The six orange ones and the two storybook babies stay out.

### The character waits for you (js/mi-dralingo.js `podHtml` + `zocoAlive`, css/mi-dralingo.css «the pedestal»)
- Where one screen shows one character, it stands on a **lit pedestal** like a game's character-select screen: the
  spotlight of `#zoco` (at the right, a soft night behind the name at the left), a character's page `#zoco-<id>` (the
  stage, with a cone of light from above), «¡Ya es tuyo!» (it pops up onto the pedestal under the turning gold rays) and
  «Ahora juegas con» of `#personaje` (a small lit frame; a free saga character stands there full-body too: the cast's
  hello picture, the saga animals' still).
- The pedestal is CSS only: a cream-lit top falling to a gold rim, a Rojo Imperial drum with a gold foot, a warm glow
  behind the legs, a contact shadow. The character stands by its feet (saga.js `fx`: where it stands across its picture;
  the dog on its paws, never its head) on the pedestal's centre, and container units keep a winged Dralingo's wings on
  screen (`--reach`), except in the small «Ahora juegas con» frame, where the wing tips may go but never his size.
- **Alive until the real loops land** (`.is-idle`): it breathes (3.8 s, scale 1.008 × 1.022 from the feet), sways from its
  feet (±0.6°, 6.9 s: never a multiple of the breath, so the idle never visibly loops), its shadow breathes with it, and
  every 9 s a light sweeps over the character (cut to its own shape by a CSS mask of its picture) and across the
  pedestal's rim. Every animation takes its phase from the page's clock (`--ph` = −`performance.now()`), so a redraw never
  snaps a breath back. Not on «¡Ya es tuyo!» (the rays already turn there). Reduced motion: nothing moves; the new
  character of «¡Ya es tuyo!» still fades in (0.2 s). The spotlight card presses (0.985); hover lifts the character
  (0.22 s, mouse only).
- **The slot for the real art** (saga.js, filled only by `node scripts/zoco-art.js`):
  - `ZOCO_ANIM[id] = { still, full, lite[, ar, hx, fx] }`: the still shows first, the loop swaps in once loaded (`zocoAlive`
    after a draw, 400 ms after the page settled), the lite one on a phone (< 700 px or Save-Data) and in the small frame,
    the full one on a laptop; `.is-live` = no CSS idle on the character (the loop is the motion), only the rim's light.
    A phone never gets the full loop: with no lite one it keeps the still with the CSS idle (`skinAnim().lite` is null).
    A loop that fails to load leaves the still with the CSS idle and is never asked for again on that page; a loop
    whose picture was redrawn away before its timer is not loaded. Reduced motion: the still. A picture's address goes
    into the CSS mask `url()` without `" ' ( ) \` or spaces.
  - `ZOCO_ART[id] = { full, avatar[, ar, hx, fx] }`: the glossy picture replaces the render everywhere through saga.js
    (`skinBody`, `skinHead`, `avatarUrl`): the shop, the spotlight, every pin game, Mi perfil, Papás, /maestro.
  - Empty maps (today) = everything as on 2026-10-19 (the renders, the CSS idle).
- **Where the art lands** (names = the catalog id; the script refuses a file over its limit or with a name no character
  has, writes the maps with a `?v=` per file, keeps hand-set `hx` / `fx`, and bumps `js/saga.js?v=` in the 18 pages):

  | File | What | Size |
  |---|---|---|
  | `public/assets/zoco/full/<id>-g.webp` | the glossy picture, full body, transparent | ≤ 720 px tall, ≤ 150 KB |
  | `public/assets/zoco/avatar/<id>-g.webp` | its round head, cut around the face | 256 × 256, ≤ 30 KB |
  | `public/assets/zoco/anim/<id>-still.webp` | the loop's first frame | ≤ 150 KB |
  | `public/assets/zoco/anim/<id>.webp` | the idle loop (animated WebP), laptops | ~520 px, ~0.5-1 MB, ≤ 1.5 MB |
  | `public/assets/zoco/anim/<id>-lite.webp` | the same loop for phones | ~240 px, ~250 KB, ≤ 400 KB |

  The loop and its still come straight from `video_tools/canva_anim.py` (`<id>.webp` + `<id>-still.webp`; the lite one
  with `--size 240 --fps 12 --quality 62`). `ar` comes from the file; `hx` / `fx` default to the render's (the art is
  made from the render: same pose); set them by hand in the map when a pose differs (the script keeps them; saga.js
  reads only finite numbers, hx / fx within 0 … 1, ar within 0.2 … 3, and only string paths).
  `node scripts/zoco-art.js --check` (and test-zoco) fail when the maps and the files disagree. The script refuses a
  loop without its still or its lite one (a phone must never get the ~1 MB loop), checks each file's size before
  reading it and reads only its header for the size in pixels, names the line of a hand edit that broke the JSON,
  checks the new saga.js runs (and reads back to the same maps) before writing it, writes through a temp file + rename,
  and takes `--root <folder>` (test-zoco runs its write path on a temp copy: refusals, hx / fx kept, CRLF, the bumps).

### Screens checked (v2, 2026-10-20, made-up kids on a throw-away local server)
- Sizes: phone 390×844, short phone 360×640, laptop 1366×657. 23 screenshots: the spotlight, a character's page (Qin,
  the dog, Hamdan, Fuego Azul, Latifa, the pony on the laptop), «¡Ya es tuyo!», «Elige tu personaje» (a skin and a free
  saga character), «¿Cómo gano monedas?» (Spanish and English), the home, the welcome gift; no browser errors, nothing
  wider than the window. After the first look: a soft night behind the spotlight's name, a bigger «Ahora juegas con»
  frame, and «¡Ya es tuyo!» at 360×640 with «Usarlo ahora» AND «Volver al Zoco» on the first screen.
- The idle-loop slot in a real browser with stand-in loops (removed after): the still first, then the lite loop on a phone
  and the full one on a laptop, `.is-live`; reduced motion kept the still.
- Scroll check (a real mouse wheel, `platform-screenshots` scroll-check) on 12 Zoco views × 390×844 / 360×640 / 1366×657:
  0 traps of 36.
- Design pass: `emil-design-eng` on the idle (the timings above).
- Copies: `.claude/handoff/zoco2-shots/` (taken before the idle's timing tweaks: same frames, other periods).

### Tests (v2)
`node scripts/test-zoco.js`: 230 checks (v1: 171), all read the amounts from `core/zoco.js` (PAY, CAP, CAPC): the v2
amounts, limits and prices (Qin 3000 the only top, the plain forms 800, the gang and pets in the middle), no hold and all
40 pictures, the art slots (the maps match the files; a line in a map moves the shop's and the games' pictures and gives
an idle loop: data only; odd hand edits read safely; no lite = no loop on a phone; the script's write path on a temp
copy), a purse of 2026-10-19 upgraded once (coins, characters, welcome, keys kept; the line in v2 amounts; «Deshacer» of
a 50 takes back 50), a rollback purse (pv 2 with a v1 line) and a pv 3 purse never converted again, a damaged waiting
line, an automatic purse of 2026-10-19 merging at 25, the two merges of v1 words (+100; +50 with the Sheikh), the
laundering cases with v2 prices, `limits` and the v1-unit `caps`, and on the server: all 20 listed with pictures and no
word of why they were held, «Te faltan 745» for a kid with 55, a seeded v1 purse keeping its 300 coins, Sheikh and
welcome, the four once held bought and equipped.

## In real 3D · 2026-10-20 (a try of 3 characters, local only until his «sube»)
His words: "Is it too much to ask that it looked like a display in 3D in which when you access the marketplace, each
character… you can touch it and move it. I always loved that. Like if you were interacting in the 3D world"; his pick
«Real 3D, try 3 first»: his own 3D models, shrunk for the web; kids spin them with a finger, pinch to zoom, tap and they
hop. Three first (Dralingo Sheikh, Hamdan con kandura, the panda); if he loves it, the other 17 follow.

### The models (root repo `tools/blender/zoco_web_glb.py` + `zoco_web_run.sh`)
- Made from HIS files in `ONLY MAIN CHARACTERS/` with the roster renders' own prep (`roster_config.json`: the same file,
  the same pieces left out (truck, «FRESH OIL» sign, wing letters), the same pose), then: pose baked (no skeleton), one
  UV map per piece (Hamdan's hands came out black when two maps with different names were joined), points that sit on
  each other merged (decimating without it tore the Sheikh's kandura into shards), decimated per piece (small pieces
  keep ≥ 400-500 triangles: eyes, teeth), joined, look-alike materials merged (the Sheikh 43 → 19), one-colour pictures
  turned into plain colours, specular / roughness pictures dropped (the Sheikh's cane keeps its gold: its specular
  colour painted into its colour picture), pictures ≤ 1024 px as WebP (Hamdan's face and the panda's body 2048), Draco.
  Feet on 0, 1 unit tall, facing +Z, the turning axis through the body (the middle of 12-40 % of the height, not a cane).
- Built 2026-10-20 (`assets-library/zoco-3d/2026-10-20/`, local, with `contact-sheet.jpg` and a `.json` per model):
  Dralingo Sheikh 51 968 triangles · 406 KB · 19 materials; Hamdan 45 996 · 512 KB · 9; Panda 22 864 · 112 KB · 2.
  Checked: no closed piece inside out (`check` mode), side by side with the Zoco picture and the render (front, 45°,
  side, back). The Sheikh model sits (the render's pose) and has no mustache (the model has none; his glossy picture does).
- **They go online only with his «sube»**: `public/assets/zoco/3d/` is git-ignored; `scripts/test-zoco3d.js` fails if one
  is ever tracked. Deploying the code without them is safe: each 3D page asks once, gets a 404, keeps its picture.

### The page (js/zoco3d/stage.js, js/mi-dralingo.js `zoco3d` / `want3d`, css/mi-dralingo.css «the character in real 3D»)
- Only the characters of saga.js `ZOCO_3D` (`skin3d(id)`: the file `/assets/zoco/3d/<id>.glb?v=<sha1 8>`, the clear coat,
  the roughness range), only on a character's page (`#zoco-<id>`), locked ones too (the window into what you can win).
- The still picture shows first on its pedestal (no ~1 MB loop downloaded for a page that will show 3D); the PAGE fetches
  the model first (a missing one costs one quick 404, never three.js), then three.js 0.170 + the Draco decoder from
  jsDelivr (the import map in homework.html, the same as the golden Dralingo's on /audios); the first frame fades the
  picture out under the model. Every load has its own ticket (`Z3D.seq`): a load the kid walked away from stops at its
  next step (before the graphics work) and never touches the next character's; one stuck for 15 s gives the picture
  and its loop back.
- A transparent canvas over the stage; the CSS pedestal stays. The camera looks down at the pedestal top's angle
  (asin 0.2 ≈ 11.5°) and the feet stand on its centre (setViewOffset); the model is as tall as the picture was, never
  wider than ~42 % of the stage from its axis, its head under «Volver al Zoco» and the purse.
- Drag: a full turn across ~1.1 stage widths, inertia, a little tilt (−0.12…0.24 rad). `touch-action: pan-y`: a vertical
  swipe still scrolls the page. Pinch or the wheel: zoom 0.85-2.2 towards the face, the CSS pedestal zooms with it (the
  same 2D zoom); at a limit the wheel scrolls the page (never trapped). Tap ON the character (a ray): a hop (crouch,
  jump with a full spin, land squash, settle, 0.82 s; its shadow shrinks in the air). Keys: ← → turn, ↑ ↓ tilt, + −
  zoom, Enter / Space hop. Untouched 2.6 s: back to facing the kid, looking around slowly (±0.42 rad), breathing.
- Teach by doing: a first visit pops it in and turns it once by itself with a hand «Gíralo con el dedo» («Arrástralo
  para girarlo» with a mouse) until the kid turns it (`draly_zoco3d_spun`); then «¡Tócalo!» until the first hop
  (`draly_zoco3d_tap`). English in hw-i18n.
- Glossy toy look: MeshPhysicalMaterial (clear coat 0.1-0.25, roughness clamped), RoomEnvironment, a warm key, a cool
  fill, a warm rim, neutral tone mapping; a soft round shadow on the pedestal (a picture, no shadow maps).
- Cheap phones: at most ~1.5 Mpx drawn a frame (pixel ratio ≤ 2), ~30 frames a second when nobody touches it, ~12 after
  25 s, none after 90 s (a touch, a key, the pointer over it or coming back wakes it), nothing drawn while the tab is
  hidden or the stage is off screen, the picture under it stops its own idle, the Draco workers closed once the model
  is read, one model at a time carried over a redraw of the page (no reload), everything given back (listeners,
  observers, the scene, the WebGL context) when the kid leaves the page or when something fails half way.
- Never tries (saga.js `skin3dBlock`; the graphics probe last): reduced motion, Save-Data, < 2 GB of memory, no hardware
  WebGL 2 (three.js 0.170 needs WebGL 2; a software one would only heat the phone; `draly_zoco3d_sw = 1` allows it for
  test browsers), a model that failed on this page (404, 15 s without it, a shader the GPU cannot build): the picture and
  its idle loop, as before. A first lost context (the phone took its graphics back while WhatsApp was open) tries again
  once the page is visible; a second keeps the picture.

### Checked (2026-10-20, a throw-away local server with a made-up kid: `.claude/launch.json` «zoco3d-try»)
- 390×844, 1600×900, 1366×657, 360×640: the three in 3D, no browser errors, nothing wider than the window.
- Driven with a mouse and synthetic fingers (32 checks): the demo turn and the hand, a drag turning it (+2.1 rad,
  inertia, tilt), «¡Tócalo!», a tap → hop, a tap on the sky → nothing, the wheel and a pinch zooming within 0.85-2.2
  with the pedestal, the wheel scrolling a taller page at the zoom limit, keys, a redraw keeping the same model, «Volver
  al Zoco» disposing it, another character opening in ~1.3 s, a model 404 and reduced motion keeping the picture and its
  loop; after the fresh-eyes review: leaving mid-load for another character (one canvas, the right one, the first one
  not marked failed), a first lost context coming back by itself and a second keeping the picture, a model stuck 19 s
  giving the loop back at 15 s, asleep after a long while and awake under the pointer.
- Measured locally: first 3D frame ~0.5 s after the page opens (warm cache), ~1.3 s the first time (three.js from the
  CDN); with the CPU 4× slower and a 9 Mbit/s 4G-like line, cold: ~4 s from the page's model request to the first
  frame (this test browser draws without a graphics card), ~30 frames a second idle; first visit ~0.8 MB (three.js
  257 KB, loaders 37 KB, Draco 70 KB, the model 112-512 KB). JS heap ~13-17 MB; 20 draw calls / 52 k triangles for the
  Sheikh.
- Real wheel scroll check on the four character pages (3 in 3D + one picture) × 390×844 / 360×640 / 1366×657 / 1600×900,
  wheel over the character and over the sheet: 0 traps.
- `node scripts/test-zoco3d.js` (no server, 88 checks): the manifest, who never tries, the models off git and (when on
  disk) light and hashed, the module's rules (import map only, ~1.5 Mpx, pause and sleep, give-back on leave and on a
  failure half way, Draco workers closed, hardware WebGL 2, shader and context checks, the wheel, a trackpad pinch,
  pan-y, the load ticket, model before three.js, the 15 s watchdog, its words in English).
