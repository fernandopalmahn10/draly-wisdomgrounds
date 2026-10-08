# Draly Wisdom Grounds · platform rules

Node web app (`server.js`, `core/`, `public/`), deployed on Render from this repo (`draly-wisdomgrounds-2.onrender.com`).
Its own git repo. Teachers use `/maestro`; kids join rooms with a PIN; homework portal at `/homework`.
Game modes live side by side (`public/host-*.html`, catalogue in `docs/GAME_MODES.md`); "Mochi Mash" is just the first
game, the platform is Draly Wisdom Grounds with Dralingo as host. Agreed-but-unbuilt features: `TODO-QUEUED.md`.
Security procedures: `SECURITY-SOP.md`. The full plain-language map of the platform and the work method (7-step loop,
recording → official test pipeline, toolbox, pending work) is `docs/HOW_CLAUDE_WORKS.md`: keep it current when features ship. Engagement patterns that worked: memory `project_engagement_patterns` — use it as
the checklist for any new game mode.

## Always
- **Media must be in git**: Render serves only what is committed. After adding any asset-backed feature (sims, images, audio
  under `public/assets/…`) run `git status --short` / `git ls-files "<asset dir>" | wc -l` and confirm the media is staged
  before saying it is live. On-disk ≠ deployed.
- **i18n**: `/homework` has an ES→EN toggle driven by a dictionary (`public/js/hw-i18n.js`, `var DICT =`). Every new
  student-facing Spanish string must be added there (and bump its `?v=` in homework.html) or it stays Spanish in EN mode.
- Never commit secrets (`.render-token`, credentials JSON, `data/*` runtime files with student data).
- Spanish UI first; "Chino Mandarín"; big buttons, kid-friendly feedback; encouragement at the screen edge, never blocking play.

## Official tests (YCT · HSK · New HSK simulations)
- Faithful to the real exam: same flow, timing, scoring (YCT /200, pass 120), the ORIGINAL recorded exam audio (not TTS).
  Sober official look (petrol ink #0f2f33, seal red #9e2a2b, paper bg, Source Sans 3), not kiddy, not a copy of HSK Mock's style.
- Pipeline per sim: his screen recording of a full run (Videos/Captures) → build package folder `<TEST>_SimN_Build/`
  (simulation.json + images + its own CLAUDE.md) → cut audio with ffmpeg (aac .m4a) → `node scripts/yct-import.js <buildDir> <N>
  --start s --intros a,b,c,d --end e` → `core/yct/…json` + `public/assets/<TEST> SIMULATIONS/…` → commit the asset folder too.
  Picture cropping/transcription tools: `../video_tools/yct_capture/README.md`. Do NOT use Higgsfield for sim pictures —
  crop them from the recording.
- Pinyin without tone marks in tests. Test harness: `yct-sim.html?debug=1&direct=1&sim=…&pin=…&view=…`; headless Edge screenshots.
- /maestro → "Official Tests" → test family → level → sims. Every new test reuses the YCT interface structure
  (cover, audio-driven listening, review, timed reading, gauge results) with that exam's real flow.
- **Build order (his decision 2026-10-08):** YCT 1 → New HSK 1 → YCT 2 → New HSK 2 → YCT 3 → New HSK 3 → … (alternate,
  one level up each time). Finish all sims of a level before moving on unless he says otherwise. Old HSK sims already exist
  in `hsk-sim.html`.

## Pin games (Kahoot-style, inside Draly Wisdom Grounds)
- Our own live quiz games: teacher hosts, kids join with a PIN, Kahoot-like pacing (question → answer → leaderboard), with
  Dralingo branding and the engagement patterns. They live in this platform like the other game modes, not as exports.
- Content comes from the same data the platform already holds (sims, sets, curriculum words); build the question engine
  once and reuse it for every test family and level. Old CSV exporters (`scripts/export-sim1-blooket.js`) stay as extras.
- This is a large, multi-feature codebase: before adding a mode, read `docs/GAME_MODES.md` and reuse existing room/PIN/
  heartbeat plumbing instead of building parallel systems.
