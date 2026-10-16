# La Ruta Dorada · plan (agreed with Fernando 2026-10-15)

The audio tab («Audios y vocabulario», /audios) becomes **La Ruta Dorada**: each module (YCT 1, New HSK 1, HSK 1, then
the next levels) is prepared in three levels with our own names. Rules live in `CLAUDE.md` § Three levels of preparation.

| Level | What | Who can open it | Unlocks when |
|---|---|---|---|
| 1 · **La Base** | the vocabulary book digitally (done: /audios/<level>-base), «¡Me la sé!» seals | the level's key (or a grandfathered student); see Update below | with the key |
| 2 · **El Entrenamiento** | exam-style practice world by world, from the curriculum packs (`core/packs`), audio + instant feedback (built 2026-10-16: /audios/<level>/entrenamiento) | the level's key | world by world: every seal of a world in La Base opens that world (his pick 2026-10-16), or the teacher unlocks; Pinyin básico from the start; Simulacro del examen once every world is ready |
| 3 · **El Simulacro Dorado** | the full simulations (player), the golden book on screen with a play button per listening question (original recording cut per question) + the PDF (built 2026-10-16: /audios/<level>/libro/<n>) | enrolled students | the key until El Entrenamiento is live; then every world practised with ≥ 70 % (changeable), or the teacher unlocks; a simulation's book once that simulation is taken, the PDF once all are |

## Update 2026-10-15 (second planning round): keys, not free
- **Nothing of a module is free**: one secret key per level (word + number, set by him in /maestro, changeable) opens
  all three levels of that module. The key screen is beautiful and very easy for parents. Typed once: remembered on the
  device, saved on the kid's account when logged in; wrong guesses limited.
- **Kids registered before the keys go live keep their level** without typing it (no disruption); new accounts need it.
- **In class**: kids in a teacher's PIN room need no key. **Hosting a game** needs the teacher's key the first time on
  that device, then the device is remembered (~90 days), never by internet address.
- **Homework unchanged** (class code + name/code).
- The super-admin teacher code was exposed in a comment of the public `/js/maestro.js`: removed in the lock branch; he
  must change the code itself (a «cambiar mi código» in /maestro, and the boot seed must not recreate the old one).
- Phase 1 branch `ruta-dorada-sims-lock` (61a2f99c8, not deployed) already locks the sims (protected media, signed
  tokens, room passes, friendly page); it is reworked for the key model before deploy.

## Why now
- Today anyone with the address can take a full simulation (`/yct-sim.html?sim=…`, `/hsk-sim.html` answer 200 with no
  login), and the exam recordings and pictures are plain public files (`public/assets/*SIMULATIONS/`). His words: "if
  anyone random accesses our platform and goes directly to the simulations we could get in trouble, and we're not going
  to give away everything for free".

## Phases (each one tested, reviewed and deployed with his class check)
1. **Lock the simulations** (first, it is the risk): the sim player pages, their JSON and their media need an enrolled
   student's session (same login as /homework) or a teacher session; the media move out of `public/` behind a checked
   route (hiding the page is not enough: the files must not be downloadable by URL). Keep working: teacher launches from
   /maestro (projector), the New HSK 1 «Simulacro» homework, old links (they now ask to log in). Tests: anonymous = refused
   for every sim page, JSON and file; student of the level = allowed; student of another level = refused.
2. **La Ruta Dorada tab**: rename, the swipe module picker with a super cool animation (each module a big card; a
   logged-in kid lands on their own), and per module the three-level path (Base → Entrenamiento → Dorado) with locks,
   progress and «¿Cómo se abre?» hints. Anonymous visitors see the locks and a friendly «Entra con tu código» (login).
   **Built 2026-10-15** (branch `ruta-dorada-tab`): big glossy cards that fly in with depth and a spring bounce
   (`public/js/ruta.js`, `css/ruta.css`), per-visitor state from `GET /api/ruta-dorada` (sims listed only when the
   level is open), `/audios/<level>/clave` for the key round trip, a kid with the key gets La Base + El Simulacro
   Dorado (the existing sims), El Entrenamiento «Muy pronto»; `scripts/test-ruta-dorada.js`.
   Open for phase 3: seals live on the phone only (`draly_base_<level>`), so the path's progress is per phone; the
   unlock thresholds and a per-step «Desbloquear»; a kid's sim results already come back as «best %» on the path.
3. **Progress on the server**: a logged-in kid's seals sync to their record (any device, teachers see them), the unlock
   rules above, and a teacher «Desbloquear» per kid in /maestro.
   **Built 2026-10-16** (branch `ruta-dorada-progress`), with his picks of that day: seals stay a free tap; El
   Entrenamiento opens world by world (every seal of a world); the Simulacro Dorado stays open with the key until El
   Entrenamiento is live, then needs every world practised with 70 % (changeable) or a teacher. `core/ruta-progress.js`
   (the engine, `rec.ruta[level]` on the record), `/api/ruta/seals` (save + the first-login union), the route's world
   tiles, the /maestro profile panel + roster bar + rules panel, `scripts/test-ruta-progress.js`.
   Open for phase 4: call `recordPractice` per world, put `trainWorldOpen` / `doradoOpen` after `LevelKeys.access` at
   its doors (and `doradoOpen` in `_simGrant` for solo kids when the switch goes ON), decide the pack worlds that have
   no base world (Simulacro del examen, Pinyin básico) and how a key-only phone (no login) practises.
4. **El Entrenamiento**: practice by world from the packs (reuse the YCT tareas quiz player graded on the server), audio
   for every question, instant feedback, a score per world that feeds the unlock.
   **Built 2026-10-16** (branch `ruta-dorada-training`), with his picks of that day: the pack's worlds = La Base's
   worlds by number (HSK 1 shows La Base's names), «Pinyin básico» open from the start, «Simulacro del examen» open
   once every world is ready, only the regular worlds count for the Dorado; quick rounds of 10 with game touches (its
   own player, not the tareas': audio per question, right/wrong from the server after each answer, streaks, the gang,
   stars and a %); a key-only phone practises and its scores join the account at the first login (signed proofs);
   the Dorado rule ON at launch (a one-shot `trainingLaunchAt`), kids who already took a simulation keep it, and
   `_simGrant` asks it of solo kids. `core/entrenamiento.js`, `public/js/entrenamiento.js`, `/api/ruta/train/*`,
   `scripts/test-ruta-training.js`.
5. **El Simulacro Dorado**: the golden books digitally from the same source as their PDFs (`study/<level>sim/`, exam.py,
   one source like La Base's `web.py`), page by page, each listening question with its own play button cut from the
   original recording, the PDF download (behind the login), and the simulation player.
   **Built 2026-10-16** (branch `ruta-dorada-libro`), with his picks of that day: a simulation's book opens once the kid
   has taken that simulation (a graded try on the account with half its questions answered; a teacher sees every book); phone
   cards like La Base, simulation by simulation; mistakes first («Repasa tus N errores» from the latest try, then the
   whole simulation; /maestro «Ver su libro» shows a teacher the same list); the PDF once every simulation is taken (a
   web copy under 9 MB). `../study/lib/examweb.py` (the export from exam.py), `core/golden.js`, `/api/golden/…` +
   `/golden-media/…`, `public/js/libro.js` + `css/libro.css`, `scripts/test-golden-book.js`.

## Open defaults (he can change them)
- Unlock thresholds (his picks 2026-10-16, replacing "half the seals"): every seal of a world → that world of
  Entrenamiento; every world practised with ≥ 70 % → Dorado (the % in /maestro → Teachers).
- Anonymous seals stay on the device; after login they merge into the kid's record (built: a union, phase 3).
