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

## Coins (core/zoco.js; judged on the server, on the kid's own record)
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

## The catalog (core/zoco.js CATALOG + public/js/saga.js ZOCO)
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
