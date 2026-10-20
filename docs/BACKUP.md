# Backups of Draly Wisdom Grounds

Everything the platform learns lives on ONE place: Render's 1 GB data disk (`data/` on the server): the kids' accounts,
their progress and coins, the archive, the teachers and their codes, the level keys, the classrooms, the teacher guide
PDFs, the uploaded question sets, and the key that signs every remembered phone. If that disk is lost, all of it is
lost. So it is copied to this laptop every week, without anyone pressing anything (his OK, 2026-10-20).

## When, where, what

- **When:** every Sunday at 7:00 a.m. Windows Task Scheduler runs the task «Dralingo weekly backup». If the laptop is
  off or asleep at 7:00, it runs as soon as the laptop is on again (and he is logged in).
- **What runs:** `C:\Users\ferpa\ClaudeCode\tools\backup\pull-backup.js`. It asks the live site
  (`https://app.dralingo.app/api/admin/backup`) with the weekly backup key (a line in
  `C:\Users\ferpa\.dralingo\backup-token`; the same value is Render's setting `BACKUP_TOKEN`).
- **Where it goes:** `C:\Users\ferpa\DralingoBackups\platform\draly-backup-<date>.json.gz`. The newest 12 stay (about
  3 months) plus the newest of each month for a year; older ones are removed. One line per run in `backup-log.txt` in
  the same folder.
- **Never** copy these files to OneDrive, Google Drive, WhatsApp or email: they hold every kid's name and every
  teacher code and level key. A backup file is as secret as the super admin's code.
- **The button:** /maestro → «Descargar respaldo» (super admin) downloads the same thing, uncompressed (`.json`), plus
  the signing key (see below).

Inside one file (format 2, since 2026-10-20):

| Part | What | Restored as |
|---|---|---|
| `files` | every `data/*.json` (student-records, student-archive, teachers, teachers-meta, level-keys, classrooms, guides.json, ruta-settings, usage-peaks, hsk-rooms…), all read in the same moment | `data/<name>.json` |
| `raw` | a `.json` that does not read as JSON, as its bytes: usually a copy the server parked for recovery (`<name>.unreadable-<time>.json`, no error); any other broken file makes the run PARTIAL | `data/<name>.json`, as it was |
| `guides` | the teacher guide PDFs (`data/guides/`) | `data/guides/<file>.pdf` |
| `sets` | the uploaded question sets (`data/sets/`) | `data/sets/<file>` |
| `keys` | only in the super admin's own download: `sim-lock.key` | `data/sim-lock.key` |
| `_end` | the mark that the file is whole (`errors` lists anything the server could not read that day) | |

Not in it, on purpose: `data/tts-cache/` (the platform's voice clips: they are made again by themselves when needed)
and `heartbeat.txt`. Backups made before 2026-10-20 (format 1) hold only the JSON files.

### The signing key (keep ONE copy, best in Render)

`data/sim-lock.key` signs every remembered phone (the level key typed once, the automatic accounts, kid sessions) and
every remembered teacher device. If it is lost, those phones and devices must sign in again (families retype the level
key). It never changes, so one copy is enough, and it is kept OUT of the weekly files: a weekly file that leaks must
not let anyone sign a teacher device.
- Best: Render's environment variable `SIM_LOCK_KEY_HEX` = the file's 64 characters (from one super admin download,
  `keys` → `sim-lock.key`). Then it survives a lost disk and no backup needs it.
- If Render already has `SIM_LOCK_SECRET`, the file is not used at all: nothing to do.

## Is it working?

Open `C:\Users\ferpa\DralingoBackups\platform\backup-log.txt`. The last line should be last Sunday's:

```
2026-10-25 07:00:31  OK       draly-backup-2026-10-25.json.gz · 312 kids (+ 1204 archived) · 21 data files · 3 guides · 4 sets · 41.3 MB → 9.9 MB
```

| The line says | What it means | What to do |
|---|---|---|
| `FAILED … no backup key on this laptop` | the key file is missing | `node tools\backup\make-backup-token.js`, then set `BACKUP_TOKEN` on Render to the same value |
| `FAILED … refused the backup key` | Render's `BACKUP_TOKEN` and the laptop's key differ (or it is not set) | set Render's `BACKUP_TOKEN` again from the key file |
| `FAILED … could not reach` or `… HTTP 5xx` | no internet, or the site was restarting (it tried 3 times, 2 min apart) | run it by hand: `schtasks /run /tn "Dralingo weekly backup"` |
| `FAILED … the server says to wait` | 6 backups already in 24 h, another backup running, or 10 wrong keys from this address | wait and run it again later |
| `FAILED … a web page, not the backup` | Cloudflare showed a check page to the script | check Cloudflare's security settings (Bot Fight Mode) |
| `PARTIAL …` | saved, but a file could not be read on the server that day; nothing older removed | look at the server's log for that file |
| `SUSPECT …` | saved, but it has far fewer accounts (−20 %) than the last good one; nothing older removed | look at the platform now: something may have wiped accounts. The older backups are all still there. If the drop was on purpose (accounts deleted by his decision), run once by hand `node tools\backup\pull-backup.js --accept`: that backup becomes the new «last good» one |

## Restore (the data disk is lost or damaged)

Do it in the morning, with **no class running** (the restart drops every live room for about a minute).

1. **Pick the file.** The newest `OK` line in `backup-log.txt`. If the damage is already in that one (a wrong mass
   change, for example), take an older one. Everything since that backup (new kids, seals, homework marks, coins,
   results) is not in it: at most a week.
2. **Keep what is there now.** If the server still answers, first press «Descargar respaldo» in /maestro (or run
   `pull-backup.js` by hand): then the restore can be undone.
3. **Unpack it on the laptop** into a NEW folder (the script never writes into a folder that has files):
   ```
   cd /c/Users/ferpa/ClaudeCode/mochi-mash
   node scripts/unpack-backup.js "C:/Users/ferpa/DralingoBackups/platform/draly-backup-2026-10-25.json.gz" C:/Users/ferpa/DralingoRestore/2026-10-25
   ```
   It prints how many data files, guides, sets and kids came out. It refuses a cut or broken file: pick an older one.
   A guide the server could not finish sending that day is listed as «not written» (take it from an older backup).
4. **Look before you put it back (optional, recommended).** Open the folder on a throw-away server on the laptop
   (never port 3000, never the main checkout's `data/`):
   ```
   PORT=4470 DRALY_DATA_DIR=C:/Users/ferpa/DralingoRestore/2026-10-25 STUDENT_DATA_DIR= node server.js
   ```
   then http://localhost:4470/maestro with the super admin's code: the kids, classes and guides should all be there.
   Stop it with Ctrl+C.
5. **Put the files on Render's disk** (`/opt/render/project/src/data/` on the server): every file of the folder, plus
   its `guides\` and `sets\` folders, replacing what is there. Render's own guide: «Transferring files»,
   https://render.com/docs/disks#transferring-files (SCP with `-s` after setting up SSH for the service, or
   Magic-Wormhole from the service's Shell page in the Render dashboard). A weekly file has no `sim-lock.key`: the
   phones stay signed in only if Render has `SIM_LOCK_KEY_HEX` (or `SIM_LOCK_SECRET`), or if you also copy the key file
   from a super admin download.
6. **Restart the service:** Render dashboard → the service → «Manual Deploy» → «Restart service». The server reads
   `data/` only when it starts.
7. **Check:** `https://app.dralingo.app/api/_diag` (`studentRecordsBytes`, `archivedAccounts`), a /maestro login, one
   kid's login on a phone, one guide PDF.

The teacher codes and level keys come back as they were on that day: a code changed after the backup is the old one
again.

## If a backup file leaks (someone else got a copy)

It has every kid's name, every teacher code and the level keys. In the morning, no class running:
1. Every teacher: «Cambiar mi código» in /maestro (the super admin changes the others' too). This also ends every
   remembered teacher device made with the old codes.
2. Every level key: «Cambiar» + «Cerrar en todos los aparatos» (families type the new key once).
3. The weekly key: `node tools\backup\make-backup-token.js --new`, then Render's `BACKUP_TOKEN` again.
4. Only if it was a super admin download (it has `sim-lock.key`): a new signing key. Remove `SIM_LOCK_KEY_HEX` (and
   delete `data/sim-lock.key` on the disk) so the server makes a new one at its next start; every phone and teacher
   device signs in again. Then put the new key in `SIM_LOCK_KEY_HEX`.

## Set-up and changes (done once by Claude, 2026-10-20)

- The key: `node tools\backup\make-backup-token.js` (prints only «written»; a key already there is kept).
- Render: the environment variable `BACKUP_TOKEN` = the content of `C:\Users\ferpa\.dralingo\backup-token` (32 or more
  characters; shorter or empty = the weekly door is OFF). Optional but recommended: `SIM_LOCK_KEY_HEX` (above).
  Changing a Render variable restarts the service: morning, no class.
- The task: `schtasks /create /xml tools\backup\weekly-backup-task.xml /tn "Dralingo weekly backup"` (runs only while
  he is logged in, no password stored), then a first run by hand: `schtasks /run /tn "Dralingo weekly backup"`.
- A new key (e.g. the old one leaked): `make-backup-token.js --new`, then set `BACKUP_TOKEN` on Render again.
- Turning it off: remove `BACKUP_TOKEN` on Render and `schtasks /change /tn "Dralingo weekly backup" /disable`.
- What the server allows the key: only `/api/admin/backup`, 6 times in 24 h, one backup at a time; a wrong key counts
  like a wrong teacher code (10 per address in 10 min); the log says «backup pulled by the weekly key (from
  <address>)», never the key. `node scripts/test-scale.js` checks all of this, the laptop scripts, and a full restore
  on a throw-away server.
