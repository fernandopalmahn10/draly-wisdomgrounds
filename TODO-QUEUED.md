# 📋 Queued To-Do — from Fernando's 2026-06-04 feature batch

These are agreed but **NOT shipped yet**. Tackle one per session so we
don't break the system.

Each item links back to the conversation that scoped it so future
sessions don't have to re-discuss why it matters.

---

## 1. Emirati gateway — no empty word cards ✅ SHIPPED 2026-06-04

`core/emirati-vocab.js` `studyList()` now hides any word whose every
sentence is already marked learned, regardless of whether the word
itself was marked seen. Truth table:

| word marked? | any sentence unlearned? | show? |
|---|---|---|
| no  | yes | YES (default) |
| no  | no  | NO — fully done |
| yes | yes | YES (kept for remaining sentences) |
| yes | no  | NO — fully done |

---

## 2. Mis Oraciones — saved-by-me vs sent-by-teacher tabs ✅ SHIPPED 2026-06-04

`player.js` `openWuHistory()` now renders two tabs at the top of the
modal: ✍️ Mías and 📤 De la maestra, with counts. Teacher-pushed
rows show a green left-border + 📤 attribution chip. Same delete +
Curious-tap behavior on both tabs.

---

## 3. Mis Oraciones — full-screen redesign ✅ SHIPPED 2026-06-04

The `wu-history-modal` is now a 100vw × 100dvh sheet with a 1100px
inner column, a sticky hero header (Cinzel title + counts pill), and
a responsive card grid (1 col phone → 2 col tablet → 3 col desktop).
Each card shows the date, every word as a vertical icon + 汉字 +
pinyin + Spanish chip, a 🔊 Escuchar oración button (Google TTS),
and a 🗑 delete button. Teacher-pushed cards get a green tint +
border. Background uses a parchment-under-candlelight gradient.

## 4. Mis Oraciones — categories ✅ SHIPPED 2026-06-04

End-to-end: teacher tags each push with a category (chip row in the
push modal), server validates against `core/sentence-categories.js`
and stores `entry.category` on the record. Kid's `De la maestra` tab
gets a horizontal scrolling category-filter bar with counts, plus a
small colored pill on each card showing its category.

12 starter categories (home, school, store, restaurant, family,
health, time, weather, transport, chat, study, other). Shared list
in core/ + mirrored in public/js/sentence-categories.js (kept in
sync by hand — no bundler).

---

## 5. HSK simulation — capture per-question mistakes ✅ SHIPPED 2026-06-04

`server.js` now persists `wrongQs: [{qid, expected, given}]` on every
sim submission. New endpoint `/api/admin/student/:code/hsk-attempt?ts=...`
returns the wrong-question list with question labels (word/pinyin/audioText)
enriched from the sim catalog. New endpoint `/api/admin/hsk-mistakes/heatmap`
aggregates across all kids in a teacher's classroom (per-question wrong %).
Per-attempt rows in the maestro Cuaderno are now clickable → expand into
inline "❌ N preguntas incorrectas" panel showing what each kid picked vs
the right answer. Older attempts (pre-2026-06-04) show a graceful
"datos no guardados" note since they don't have wrongQs in the record.

---

## 6. Classroom analytics on captured mistake data — data layer ready

The heatmap endpoint `/api/admin/hsk-mistakes/heatmap` is live and
returns `{ attempts, rows: [{qid, wrongPct, wrong, attempted}, ...] }`
sorted hardest-first. **What's missing is the UI** — a maestro
heatmap view to render the rows visually. Tackle after the data has
been collecting for a couple of weeks (Fernando's "let it speak for
itself" plan).

Status: **server side ✅, UI queued**.

---

## 7. Kids see their own mistakes immediately ✅ SHIPPED 2026-06-04

Fernando 2026-06-04: "the mistakes don't need to be for two weeks…
right now, one kid can immediately see what they got wrong in the
records."

Three pieces:
- **Post-sim screen:** The breakdown card now shows wrong-only rows
  with pretty pick/correct columns and friendly question labels
  ("Lectura 1, pregunta 22 · yīshēng — Elegiste: Verdadero · Correcta:
  Falso"). Booleans formatted as Verdadero/Falso, not true/false.
- **Homework portal — new "📝 Mis exámenes" button:** Sits next to
  "📜 Mis oraciones" in the kid's header. Opens an overlay listing
  every HSK attempt sorted newest-first. Each card is tappable when
  the attempt has breakdown data → expands inline into the wrong-q
  detail panel. Pre-2026-06-04 attempts gracefully show "Detalle no
  guardado (intento anterior)".
- **Two new kid-facing endpoints:**
  `/api/homework/my-hsk-attempts/:code` and
  `/api/homework/my-hsk-attempt/:code?ts=...`
  Auth via access code (same as the rest of the homework portal),
  not admin. Same enrichment + label lookup as the teacher's version.

---

## Done (from this same 2026-06-04 batch — for reference)

- ✅ Parent **Exámenes reales** section in Progreso tab. Lists every
  HSK simulation attempt the kid did with date, score, percent. Empty
  state explains the feature. Existing data populates automatically
  because the rows come from `rec.hskResults` which has been collecting
  since the sim runner launched.
