# 📋 Queued To-Do — from Fernando's 2026-06-04 feature batch

These are agreed but **NOT shipped yet**. Tackle one per session so we
don't break the system.

Each item links back to the conversation that scoped it so future
sessions don't have to re-discuss why it matters.

---

## 1. Emirati gateway — no empty word cards

**Why:** Words whose 2 sentences are both already marked learned can
currently still appear in the list with no sentences below them. Fernando
called this "totally unacceptable — everything should have sentences."

**Fix shape:** One-line filter in `core/emirati-vocab.js` `studyList()` —
skip any word where `visibleSes.length === 0`. The new rule complements
the existing "kept-because-word-marked-but-sentences-pending" rule (which
the 2026-06-04 commit added):

| word marked? | any sentence unlearned? | show? |
|---|---|---|
| no | yes | YES (default state) |
| no | no  | NO — already fully done |
| yes | yes | YES (kept for remaining sentences) |
| yes | no  | NO — fully done |

Status: scoped, **not implemented**.

---

## 2. Mis Oraciones — saved-by-me vs sent-by-teacher tabs

**Why:** History modal currently mixes the kid's own saves with teacher
pushes. Fernando wants two tabs.

**Fix shape:** Server already flags `pushedByTeacher: true` on the push
endpoint. Client just needs:
- Two `<button class="tab">` toggles above the history list
- Filter the rendered list by `entry.pushedByTeacher` truthy/falsy
- Counts in the tab labels

Where: the `_emReviewTab` pattern in `maestro.js` is a good reference for
the same two-tab UX (it splits words vs. sentences).

Status: scoped, **not implemented**.

---

## 3. Mis Oraciones — full-screen redesign 🎨 (BIGGER)

**Why:** Fernando — "this is the main language essence. Our main essence.
Maybe make it bigger, like full screen, and they can just exit, and
scale perfectly."

**Fix shape:** New full-screen `<dialog>` or full-screen modal. Exit
gesture (swipe down or big X). Cards larger, more breathing room.
Beautiful typography for the Chinese text. Mobile scaling pass.

Out of scope for now — this is a real design task, not a small UI tweak.
Tackle it after we have the simpler tabs (#2) in place so the redesign
already has the right data shape.

Status: scoped, **queued — do after #2**.

---

## 4. Mis Oraciones — categories (house, school, market, …)

**Why:** Fernando — "the ones sent by me can be assigned by groups, like
house, market, school. So they should be able to have like categories.
This is gonna give us really good control of what's being taught."

**Fix shape:**
- Add `category` field to sentence records (on the push endpoint and on
  the kid's save)
- Tagging UI on the teacher side (host-warmup builder, when pushing)
- Filter chips on the kid side (above the saved/sent tabs from #2)

Status: scoped, **queued — needs #2 + #3 first so we have the right
container to put chips in**.

---

## 5. HSK simulation — capture per-question mistakes

**Why:** Fernando — "Can you capture the data of what went wrong?
The data speaks for itself, right? It would give us a really clear
understanding of what went wrong for each kid."

**What we have now:** `rec.hskResults = [{ simId, score, total, percent,
ts }]` — summary only, no per-question breakdown.

**Fix shape:**
- `HskSim.gradeSim()` already returns a `breakdown` per question
- Persist `breakdown` into the rec.hskResults entry (server.js around
  line 1779)
- Add `/api/admin/student/:code/hsk-mistakes` endpoint for teacher
- Surface in the Cuaderno per-student detail panel
- Maybe surface in the parent view too (kid's mistakes per exam)

Status: scoped, **queued**. Important data — every day we wait, we lose
the mistakes from that day's attempts forever.

---

## 6. Classroom analytics on captured mistake data

**Why:** Fernando — "and maybe even you can also run the same data
through analytics. A lot of data really tells us patterns. What should
we improve in that classroom? What is the kids don't know?"

**Fix shape:** Aggregate query across all students in a teacher's
classroom — which questions/words fail most often. Heatmap or
ranked list in the maestro view.

Status: **queued — strictly after #5 has been live for a few weeks
collecting data**.

---

## Done (from this same 2026-06-04 batch — for reference)

- ✅ Parent **Exámenes reales** section in Progreso tab. Lists every
  HSK simulation attempt the kid did with date, score, percent. Empty
  state explains the feature. Existing data populates automatically
  because the rows come from `rec.hskResults` which has been collecting
  since the sim runner launched.
