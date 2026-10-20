# Scale · Cloudflare serves the files, the server counts its peak classes, the data backs itself up

His ask (2026-10-20): make the platform "fully scalable", and back it up every week without him pressing anything
(his OK: Sunday 7:00 a.m., kept on the laptop, never OneDrive because it holds kids' names). Restore steps:
`docs/BACKUP.md`. Tests: `node scripts/test-scale.js` and `node scripts/test-cache-versions.js` (before every deploy;
the deploy runner runs every `scripts/test-*.js`).

## The numbers that started it (main window, 2026-10-20)
- Live: memory peak 201 / 512 MB, CPU peak 0.02 / 0.5, downloads 5.2 GB in 30 days.
- Load test on a throw-away copy: 5 classes of 30 robot kids at once all PASS; the server peaked at ~0.2 laptop cores
  (≈ 0.4 of Render's 0.5 CPU) → **3 classes at once comfortable on the Starter server, 5 the edge**; Render Standard
  (1 CPU, 2 GB) ≈ 10 at once.
- Cloudflare in front, read with anonymous GETs (this helper, the same day):
  - `/assets/app/favicon-32.png` ×3 → `Cache-Control: public, max-age=0`, `cf-cache-status: HIT`, `Age: 6257`. The
    `/assets/*` Cache Rule already keeps files at Cloudflare 2 h, ignoring the server's max-age=0, while phones get
    max-age=0 and ask Cloudflare again on every use. (The main window's MISS on a new Zoco picture and EXPIRED on the
    chase music were a first fetch and a copy past its 2 h.)
  - `/css/back.css` ×2 → `max-age=14400` (the zone's «Browser Cache TTL» of 4 h replacing the server's 0), `MISS` then
    `REVALIDATED`: outside `/assets/` Cloudflare keeps scripts and styles but asks Render about them every time.

## 1. Cloudflare and the phones keep the platform's files (server.js `_staticCache`, core/asset-refs.js)
Only files of `public/assets`, `public/js`, `public/css` served by express.static; by request:

| Request | Headers | Meaning |
|---|---|---|
| exactly `?v=<a version our pages name>` | `Cache-Control: public, max-age=31536000, immutable` | a year, phones and Cloudflare: a new ?v= is a new file |
| no query at all | `Cache-Control: public, max-age=600` + `Cloudflare-CDN-Cache-Control: public, max-age=86400, stale-while-revalidate=86400` | phones 10 min; Cloudflare 1 day (only Cloudflare reads that header, so a phone never shows a day-old picture once) |
| anything else (`?t=`, a ?v= no page names, several params) | as before: `public, max-age=0` | |
| `/assets/png-library/…` | a year (as before) | rename to change |
| `*.html`, `/` | `no-cache, no-store, must-revalidate` (as before) | |
| `sw.js`, `manifest.webmanifest`, root files | `public, max-age=0` (as before) | |
| everything that is not a file of `public/`: `/api/*`, `/base-media/`, `/sim-media/`, `/golden-media/`, the key screens, `/audios/*` pages, the 404 of locked media under `/assets/` | untouched | |

**«A version our pages name»**: at boot (~50 ms) `core/asset-refs.js` reads `public/**/*.{html,js,css,json}` (the
homework audio catalog included), `protected/pages/*.html`, `core/*.js` and server.js, and lists every literal
`/js|css|assets/…?v=X` after a quote, «(» or «=». Only those pairs get the year. Why (review 2026-10-20): versions are
dates; anyone asking today for `/js/player.js?v=<tomorrow>` would otherwise make Cloudflare and that phone keep today's
file under tomorrow's name for a year. A version made by code (`'?v=' + X`, e.g. the reading stories) gets the old
short header.

`/api/_diag` now says `no-store` too. Proof: a before/after run of two throw-away servers (main vs this branch, 71
URLs): 65 identical; the 6 that differ are four files asked for with no query (10 min / 1 day), `_diag` and
`/api/admin/backup` (both + no-store); a made-up `?v=1` and the catalog's `?t=` stay exactly as before.

**The service worker** (`public/sw.js`) caches only `offline.html` + two pictures, network first: nothing new can stick.

**The risk and its guard**: a file changed WITHOUT a new `?v=` would stay a year in phones that had it.
`scripts/test-cache-versions.js` (in the deploy runner) compares the disk with the live site (`origin/main`, fetched
first without any repack, best effort): a changed script, style, picture or sound that a page or the audio catalog
still asks for with a ?v= the live site used for it on ANY page fails; a changed script or style asked for without
`?v=` fails; a changed png-library file fails; a changed script no page names (an `import` inside another script) is a
warning. On the last weeks' history it found two real misses (styles.css changed in 8b0066ca7 under `?v=20261011a` in
6 pages; pwa.js under `?v=20261012a`).

**Homework audio** (`scripts/audios-build.js`): a track, its clips and the cover now carry `?v=<content hash>`, like
La Base's clips, so a re-made homework under the same id reaches phones at once (each homework gets it at its next
build; the ones already built keep their plain addresses until then).

**A re-made picture under the same name** (no `?v=`) reaches phones within a day (Cloudflare's copy) plus 10 minutes.
Deploys happen in the morning and classes start at 4 p.m., so a morning change is usually there by class time, but not
guaranteed: give changed art a new name or a `?v=`.

### What to verify live after the deploy (anonymous, `curl -s -o /dev/null -D - <url>` twice each)
- `https://app.dralingo.app/assets/app/favicon-32.png` → `cache-control: public, max-age=600` (+
  `cloudflare-cdn-cache-control` if Cloudflare passes it on); the second answer `cf-cache-status: HIT`.
- `/js/saga.js?v=<the exact ?v= in index.html>` → `public, max-age=31536000, immutable`; second `HIT`.
- `/js/saga.js?v=29991231z` → `public, max-age=0` (a version no page names).
- `/css/back.css` → second `HIT` (not `REVALIDATED`); its max-age shows 14400 while the zone's Browser Cache TTL is 4 h.
- `/`, `/homework.html` → `no-cache, no-store, must-revalidate`, `cf-cache-status: DYNAMIC` (or BYPASS).
- `/sw.js` → `public, max-age=0`; `/api/_diag` → `no-store` and `peak30`.
- `/base-media/yct1-base/base.json` (no key) → 401 `private, no-store` + `cloudflare-cdn-cache-control: no-store`.

### Cloudflare settings (his account; nothing changed by this helper)
1. **The `/assets/*` Cache Rule** keeps everything 2 h at the edge whatever the server says (HIT with Age 6257 on a
   `max-age=0` file). For the new 1 day / 1 year to count at Cloudflare, change its **Edge TTL** to «Use cache-control
   header if present, use default Cloudflare caching behavior if not» (Caching → Cache Rules → the /assets rule). Left
   as it is, Cloudflare keeps 2 h (as today) and the phones still gain the 10 min / 1 year. In the same rule, check its
   **Cache key**: the query string must be part of it (never «ignore query string»), or every `?v=` collapses onto one
   copy.
2. **Browser Cache TTL** (Caching → Configuration) looks like 4 h: Cloudflare raises any lower max-age to it, so
   unversioned `/js/` and `/css/` stay 4 h in phones (as today). «Respect Existing Headers» makes it the server's 10 min.
3. **Caching Level** must stay «Standard» (the query string is part of the address): every `?v=` depends on it.
4. Optional: **Tiered Cache** (free): Cloudflare's own data centres ask each other before asking Render.
5. If a file ever sticks: purge that address in Cloudflare (Caching → Purge Cache → Custom) and give it a new `?v=`
   (a purge never reaches phones that already keep it).

## 2. Peak classes (core/usage-peaks.js)
Every 30 s the server counts (`_liveRoomStats`, also the source of `_diag` `liveRooms` now): **rooms** = live rooms (a
connected projector or a connected kid, as before), **classes** = live rooms with 5+ kids connected (a real class: a
projector left open with nobody in it is no load; review 2026-10-20), **players** = the kids connected in them. Per day
on his clock (UTC−6, `DRALY_UTC_OFFSET_HOURS`), the highest of each, today + the last 60 days, in
`data/usage-peaks.json` (numbers and dates only: `{ v, utcOffsetHours, classKids, days: { "2026-10-20": { rooms,
classes, players } } }`), written at most every 2 minutes and only when a peak rose (or a new day began). A damaged
entry reads as 0, anything that is not a date is dropped. A peak in the 2 minutes before a deploy may be lost (no
shutdown hook, on purpose).
`/api/_diag` → `peak30: { rooms, classes, players, days }` (`days` = how many of the 30 the server sampled).
`scripts/health-check.js` → «Most classes at the same time (30 days)»: ✅ under 3 classes and 90 kids; ⚠️ at 3-4 classes
or 90+ kids («still comfortable…»); 🔴 at 5+ classes or 150+ kids («red line for the Starter server: move up to Render
Standard, ≈ 10 classes at once»); an older server without `classes` → its rooms. New options: `--help`, `--no-render`
(the Render key is not read), `--live <url>`, `--no-save`; every live request gives up after 30 s.

## 3. The weekly backup
- **Server** (`GET /api/admin/backup`): a second door, header `X-Backup-Token`, compared in constant time (sha-256 of
  both) with env `BACKUP_TOKEN`; empty, unset or shorter than 32 characters = OFF (the header is then ignored: the same
  401 as a wrong teacher code). A wrong key answers that exact 401 and counts in the same turnstile (10 per address in
  10 min); 6 pulls in 24 h (only right keys count); one backup at a time on the server (429 «ya se está haciendo un
  respaldo»; a stalled download frees it after 15 min); a HEAD is refused (405); no same-site rule (a script); the log
  says «backup pulled by the weekly key (from <address>)» or «… by the super admin». Nothing else reads that header.
- **The bundle** (format 2): every `data/*.json` read back to back in one moment (an account moving to the archive is
  never in neither), then streamed: `_meta` (counts, who), `files` (valid JSON, as before), `raw` (a .json that does
  not parse, as base64: a `<name>.unreadable-<time>.json` copy the server parked is restorable and no error; any other
  broken file is an error), `guides` (data/guides/, base64, read 192 KB at a time), `sets` (data/sets/), `keys`, `_end`
  (whole-file mark + what could not be read; a guide deleted a moment ago is simply left out; one cut while sending
  is listed «(cut)» and unpack-backup.js never writes it as if whole).
- **The signing key** (`data/sim-lock.key`, which signs remembered phones, level keys on devices, kid sessions and
  teacher devices) is ONLY in the super admin's own download, never in the weekly files (review 2026-10-20: a leaked
  weekly file must not let anyone sign a teacher device after the codes are changed). It never changes, so one copy is
  enough: best as Render's env **`SIM_LOCK_KEY_HEX`** (new, core/sim-lock.js: the file's 64 hex; used when
  `SIM_LOCK_SECRET` is not set), so it survives a lost disk. If Render already has `SIM_LOCK_SECRET`, the file is not
  used at all and nothing is needed.
- **Laptop** (root repo `tools/backup/`, handed over in this branch as `tools-for-root/backup/`):
  `make-backup-token.js` (32 random bytes → `C:\Users\ferpa\.dralingo\backup-token`, prints only «written», keeps an
  existing key unless `--new`), `pull-backup.js` (downloads, checks it parses, is whole and has student records, saves
  `C:\Users\ferpa\DralingoBackups\platform\draly-backup-<date>.json.gz`, keeps the newest 12 + the newest of each month
  for a year, one line in `backup-log.txt`; PARTIAL (a file the server could not read) and SUSPECT (accounts fell more
  than 20 % since the last good backup; `--accept` by hand when the drop was on purpose) save the file but remove
  nothing; exit 1 with a clear line on any problem; 3 tries 2 min apart for a laptop just awake or a 5xx (Render
  restarting, Cloudflare 52x); a Cloudflare check page is named as such; never follows a redirect with the key), `weekly-backup-task.xml` (Task Scheduler, UTF-16: weekly Sunday 07:00, «run as soon as possible after a
  missed start», only while he is logged on, no password stored, below-normal priority, 1 h limit; checked with Task
  Scheduler's own parser, not registered).
- **Restore**: `scripts/unpack-backup.js <file> <new folder>` + the steps in `docs/BACKUP.md`. The test unpacks both
  kinds of file and boots a fresh server on each: every kid, the archive, the super admin's code, the guides and the
  peaks come back, and a teacher device remembered before stays remembered (with the key file, or with
  `SIM_LOCK_KEY_HEX` for a weekly file; without either it must sign in again).
- **Limits** (fine for years at today's size): the whole file is one JSON read in one piece by the laptop scripts, so
  past ~390 MB of guides and sets (a 1 GB disk) they would need a streaming reader.

## Not done here (on purpose)
- Cloudflare settings (his account) and Render's `BACKUP_TOKEN` / `SIM_LOCK_KEY_HEX` (the main window sets them).
- Registering the task (the main window: `schtasks /create /xml … /tn "Dralingo weekly backup"`).
- /maestro's «Descargar respaldo» says ✅ even when `_end.ok` is false (a guide unreadable that moment): a later polish.
- Pre-existing, unchanged: `/api/guides/:id` answers any guide PDF to whoever has its id, with `public, max-age=86400`
  (no extension and outside /assets/, so Cloudflare does not keep it; phones keep it a day).
