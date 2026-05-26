📖 Reading mode assets
========================

Each story has its OWN subfolder named after its story id. The story id
is whatever key you used in core/reading-story.js. The default story
ships with id 'xiaomingday'.

Folder layout
-------------
public/assets/reading/
├── xiaomingday/             ← story 1
│   ├── page-1.png           ← illustration for page 1
│   ├── page-1.mp3           ← Chinese narration for page 1
│   ├── page-2.png
│   ├── page-2.mp3
│   ├── ... up to page-7 ...
│
├── lunarnewyear/            ← story 2 (when you add it)
│   ├── page-1.png
│   ├── page-1.mp3
│   ├── ...
│
└── README.txt               ← this file

File formats
------------
  Images: PNG (transparent background recommended), JPG also fine.
  Audio:  MP3 (Safari + Chrome friendly). WAV/OGG also work but you'd
          have to rename the file or change the URL in
          core/reading-story.js.

If a file is missing for a given page
--------------------------------------
  Image missing → player sees "📷 Esperando imagen" placeholder.
  Audio missing → audio controls disable, "Audio no disponible" hint.
                  Page still renders, kids can still read the text —
                  word highlighting just doesn't animate because there
                  is no audio time to track against.

How to add a NEW story
----------------------
1. Open core/reading-story.js
2. Add a new entry to the STORIES object. Copy the existing 'xiaomingday'
   entry and edit:
     - the id (key) — short, lowercase, no spaces
     - title (pinyin) and subtitle (Spanish gloss)
     - pages array — pageNum, caption, sentences (pinyin), sentencesEs
       (Spanish translation, SAME number of sentences, SAME order),
       audioDurationMs
3. Create the matching folder under public/assets/reading/<your-id>/
4. Drop in page-1.png / page-1.mp3 / page-2.png / page-2.mp3 / ...
5. Push to GitHub. Render redeploys. The new story shows up in the
   host's story-picker dropdown automatically.

How to EDIT an existing story
-----------------------------
  - Text changes: edit the relevant page's `sentences` (pinyin) or
    `sentencesEs` (Spanish) inside core/reading-story.js. Save + commit.
  - Image swap: just overwrite the page-N.png file. Same filename.
  - Audio swap: same — overwrite the page-N.mp3 file. If the new audio
    has a different length, update `audioDurationMs` for that page in
    core/reading-story.js so the karaoke word timing stays in sync.
  - Pinyin only — no hanzi (Chinese characters) in `sentences`. That's
    the explicit teacher spec for HSK1 beginners.

Word-timing
-----------
v1 auto-distributes word timestamps evenly across each page's
audioDurationMs based on word count. This works fine for most narration
paces. If you find one page is consistently misaligned, the easiest fix
is to adjust that page's audioDurationMs value (in ms) to better match
your actual recording length. The system auto-redistributes on every
reload.

Future: a "tap to mark word boundaries" mode could be added on the host
page so you record exact timings by tapping along with the audio. Ask
when you have real recordings if you want that.
