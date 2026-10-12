# Building curriculum packs from his mother files

Mother files (all sims of a level with answers) live in `Downloads\IMPORTANT DOCUMENTS\CURRICULUM STRUCTURE\…`.

Old HSK 1 (2026-10-11), from `mochi-mash/`:
1. `python scripts/packs/pdf_text.py "<mother>.pdf" hsk1_mother.txt` (PyMuPDF; system `python`)
2. `python scripts/packs/hsk1_sims.py hsk1_mother.txt hsk1_sims.json` (reading items 21–40 per sim, tones removed)
3. `python scripts/packs/hsk1_sims_build.py hsk1_sims.json core/packs/hsk1-sims.json` (adds the Spanish for part 2,
   written in that script: edit translations THERE, then rebuild)
4. `node scripts/test-packs.js`

`hsk1_extract.js` pulled the EXP word lists out of the 9 old uploaded sets (already folded into `core/packs/hsk1.js`).
YCT 1 was written by hand in `core/packs/yct1.js` (its mother file includes the listening transcripts).
Tone-less pinyin hides which word was meant (xie = 写/些, he = 和/喝): pin those meanings from the toned mother file.
