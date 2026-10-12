// Returns the picture URL for a question, or null for no picture.
//   - '/assets/…'    → our own pictures (Higgsfield packs, made for that word)
//   - 'http(s)://…'  → a picture the teacher put in the set on purpose
//   - anything else (no image, 'ai:…') → NO picture.
// Until 2026-10-11 the fallback asked image.pollinations.ai to draw the question text: kids got unrelated pictures
// (a pink cat for «ni hao») with a visible watermark, against the kid-safe rule "no text/logos in images" and the
// rule that pictures are made for each question. A question without its own picture now shows none (the Reinos /
// Pintores phones show a thinking Dralingo there). Real pictures come from curriculum packs (core/packs.js).

function urlForQuestion(q) {
  const img = q && typeof q.image === 'string' ? q.image.trim() : '';
  if (!img || img === 'none' || img.startsWith('ai:')) return null;
  if (img.startsWith('/assets/')) return img;
  if (/^https?:\/\//i.test(img)) return img;
  return null;
}

module.exports = { urlForQuestion };
