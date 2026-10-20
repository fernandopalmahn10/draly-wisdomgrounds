// The Mario Party ending shared by Reinos de Colores, Dragones Pintores, Batalla de Nieve, La Gran Fuga and Las Trampillas (his rule
// «Feelings at the end of class», mochi-mash/CLAUDE.md). No sockets: the rules every one of those games' endings uses.
//   FINAL_MS   «¡FINAL!» on every screen before the ceremony (a flag tap or paint strokes already on their way for
//              GRACE_MS still count; a quiz answer during «¡FINAL!» comes back unused: the round is over)
//   stars()    bonus stars by category: every kid at the top value shares the star; a category nobody qualifies for is
//              skipped; stars are personal honours and never change a team result
//   ranks()    shared ranks (a tie shares the place), share() a kid's part of the team total in whole per cent
// Each game's own core file says WHICH stars it gives (core/kingdoms.js STARS, core/paint.js STARS, core/snow.js STARS,
// core/escape.js STARS); the screens draw them with public/js/party.js.
'use strict';

const FINAL_MS = 2400;
const GRACE_MS = 600;
const FRENZY_MS = 30000;      // the last 30 s of a round of 60 s or more: each game doubles its own thing (server fin:frenzy)
const MAX_STARS = 4;          // the ceremony stays short: at most four categories (2.1 s each)
const WHO_MAX = 4;            // at most four winners drawn per star («y N más» for the rest)
const MIN_LEFT_MS = 10000;    // the teacher's «−30 s» never ends a round by itself: it stops 10 s before the end

// The teacher's «+30 s» / «−30 s» (his ask 2026-10-20, every pin game) on a clock that ends at `endsAt`: the change
// that really applies. `now` = that game's own clock (its pause moment while paused). A cut stops MIN_LEFT_MS before
// the end; 0 = nothing left to take.
function clockShift(endsAt, ms, now) {
  if (!(ms < 0)) return ms;
  return Math.min(0, Math.max(endsAt + ms, now + MIN_LEFT_MS) - endsAt);
}

// defs: [{ id, name, unit, val(row) → number, ok(row) → bool, best: 'max' | 'min', round(value), maxShare }]
// rows: [{ k, …stats }] → [{ id, name, unit, value, winners: [k…] }]
function stars(rows, defs) {
  const out = [];
  (defs || []).forEach((s) => {
    if (out.length >= MAX_STARS) return;
    const ok = rows.filter((r) => { try { return !!s.ok(r); } catch (_) { return false; } });
    if (!ok.length) return;
    const vals = ok.map((r) => Number(s.val(r)) || 0);
    const top = s.best === 'min' ? Math.min(...vals) : Math.max(...vals);
    const winners = ok.filter((r, i) => vals[i] === top).map((r) => r.k);
    if (s.maxShare && winners.length > s.maxShare) return;      // a «star» half the class shares is no honour: skipped
    out.push({ id: s.id, name: s.name, unit: s.unit || '', value: s.round ? s.round(top) : top, winners });
  });
  return out;
}

// sorted rows (best first) → every row gets .rank (equal `key` values share the rank)
function ranks(sorted, key) {
  sorted.forEach((r, i) => {
    r.rank = i > 0 && sorted[i - 1][key] === r[key] ? sorted[i - 1].rank : i + 1;
  });
  return sorted;
}

const share = (part, whole) => (whole > 0 ? Math.round((100 * Math.max(0, part)) / whole) : 0);

// the light row every screen gets: who (name + full-body character), team, the game's main number, rank, stars
function lite(r, value) {
  return r ? { k: r.k, name: r.name, skin: r.skin, team: r.team, value: value != null ? value : r.value, rank: r.rank, stars: r.stars || [] } : null;
}

// the stars as the screens draw them: the first WHO_MAX winners as light rows, how many shared it
function publicStars(st, byK, valueOf) {
  return st.map((s) => ({
    id: s.id, name: s.name, unit: s.unit, value: s.value, n: s.winners.length,
    who: s.winners.slice(0, WHO_MAX).map((k) => lite(byK[k], valueOf ? valueOf(byK[k]) : undefined)).filter(Boolean),
  }));
}

module.exports = { FINAL_MS, GRACE_MS, FRENZY_MS, MAX_STARS, WHO_MAX, MIN_LEFT_MS, clockShift, stars, ranks, share, lite, publicStars };
