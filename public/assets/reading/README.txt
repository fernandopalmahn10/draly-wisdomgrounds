📖 Reading mode assets
========================

Drop your story illustration + narration files here, exactly named:

  page-1.png   page-1.mp3
  page-2.png   page-2.mp3
  page-3.png   page-3.mp3
  page-4.png   page-4.mp3
  page-5.png   page-5.mp3
  page-6.png   page-6.mp3
  page-7.png   page-7.mp3

File formats
-------------
  - Images: PNG (transparent background recommended), JPG also fine
  - Audio:  MP3 (Safari + Chrome friendly); WAV/OGG also work but
            require renaming the file in core/reading-story.js

If a file is missing for a given page:
  - Image missing → players see a "📷 Esperando imagen" placeholder
  - Audio missing → controls disable, "Audio no disponible" hint shows
                     (the page still works — word highlight just doesn't
                     animate because there's no audio time to track)

Editing the story text
-----------------------
Open core/reading-story.js. Each page has a `sentences` array of pinyin
strings. Words split on whitespace; punctuation attaches to the previous
word so it highlights as one unit. Adjust `audioDurationMs` per page to
match the length of your recording (in milliseconds). Word timestamps
auto-distribute evenly across that duration.

Tip: keep sentences in PINYIN ONLY — no Chinese characters — to match
the teacher spec for HSK1 beginners.
