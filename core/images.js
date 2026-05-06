// Returns an image URL for a question. Cheap, deterministic, no API key.
//   - If the question already has an image URL, use it.
//   - If `image` starts with "ai:" → Pollinations using the rest as prompt.
//   - Otherwise → Pollinations using the question text as prompt.
//
// Pollinations is free, no signup. The same prompt yields the same image (deterministic seed).
// We pass safe=true to encourage kid-friendly output.

function pollinationsUrl(prompt, seed) {
  const cleaned = String(prompt || '').trim().slice(0, 200);
  const seedNum = seed != null ? seed : hashSeed(cleaned);
  const params = new URLSearchParams({
    width: '512',
    height: '384',
    nologo: 'true',
    safe: 'true',
    seed: String(seedNum)
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleaned + ', cute friendly illustration, vibrant')}?${params.toString()}`;
}

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000000;
}

function urlForQuestion(q) {
  if (q.image) {
    if (q.image.startsWith('ai:')) {
      return pollinationsUrl(q.image.slice(3));
    }
    if (/^https?:\/\//i.test(q.image)) {
      return q.image;
    }
  }
  return pollinationsUrl(q.text);
}

module.exports = { urlForQuestion, pollinationsUrl };
