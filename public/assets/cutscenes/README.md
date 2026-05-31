# 🎬 Cutscenes folder

Every video asset for the Draly Wisdomgrounds platform lives here, organized by use-site:

```
cutscenes/
├── daily/       — Templo del Dragón signature moments (dragon roar, etc.)
├── chars/       — Character entrance animations (8 + Dralingo + 2 anime)
├── temple/      — Looping background ambience (dawn/day/dusk/night)
├── landing/     — Landing-page mascot hero loops
├── exps/        — Per-HSK1-experience hero videos (exp1-exp8)
├── games/       — Per-game opening cinematics (triage, lqh, etc.)
└── emirati/     — Khaleeji culture clips per section
```

## File naming convention
- Extension: `.mp4` for opaque clips, `.webm` for transparent-background (character intros)
- Lowercase, kebab-case: `dragon-victory.mp4`, `dralingo-intro.webm`
- Match the path in `HIGGSFIELD_ASSETS.md` exactly so the integration code finds it.

## How to add a new asset
1. Generate via Higgsfield (manual or MCP)
2. Download MP4/WebM
3. Drop into the matching subfolder using the exact filename from the spec
4. The platform auto-detects the file presence — no code change needed if the loader is already wired

## Cache busting
Video URLs use `?v=YYYYMMDD` query params. When a new version of an asset is generated, the loader bumps the date and clients re-fetch.

## Size budget
Each clip should be ≤ 3MB (4-10s @ 720p, h.264 baseline). Higgsfield's default 24fps 720p output sits around 1-2MB per 5s — perfect.
