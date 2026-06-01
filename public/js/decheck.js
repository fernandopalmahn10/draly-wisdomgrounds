// 🛑 DISABLED 2026-06-01 — the algorithm eats character pixels because
// Gojo/Yugi PNGs have gray/white tones that match the checker pattern.
// Only safe path: regenerate assets with SOLID GREEN background and
// chroma-key the green out (single pure color, no false positives).
// =====================================================================
// 🧹 CHECKERBOARD CHROMA-KEY — strip fake-transparent backgrounds
// =====================================================================
// Higgsfield + Nano Banana sometimes BAKE the editor checkerboard into
// the saved PNG instead of giving us true alpha-channel transparency.
// This script:
//   1. Finds every <img> with src containing /cutscenes/chars/ AND data-decheck
//   2. Loads the pixels into a canvas
//   3. Flood-fills from the 4 corners, setting alpha=0 on every gray/
//      white pixel connected to the edge (the checkerboard)
//   4. Stops at the character silhouette (saturated/colored pixels)
//   5. Replaces the img's src with the cleaned dataURL
//
// Result: characters look properly cut-out even when source PNGs lied
// about transparency.
//
// Usage: add `data-decheck="1"` to any img tag, or call
//        window.decheckImage(imgEl) directly.
// =====================================================================

(function () {
  // 🟢 RE-ENABLED with GREEN chroma-key — assets now ship with pure
  // green backgrounds that don't conflict with character pixels.
  function chromaKey(img) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = id.data;
      const W = canvas.width;
      const H = canvas.height;

      // 🟢 GREEN SCREEN — pixel is green if G dominates R and B by 40+.
      // Pure green has no overlap with any character pixel (Gojo's hair
      // is gray/white = R=G=B, skin is R>G>B, blue clothes are B>G>R).
      function isBg(idx) {
        if (data[idx + 3] < 16) return true;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        return g > r + 40 && g > b + 40 && g > 80;
      }

      // Flood fill from edges using iterative stack.
      const visited = new Uint8Array(W * H);
      const stack = [];
      for (let x = 0; x < W; x++) { stack.push(x); stack.push((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { stack.push(y * W); stack.push(y * W + W - 1); }

      while (stack.length) {
        const pi = stack.pop();
        if (pi < 0 || pi >= W * H || visited[pi]) continue;
        visited[pi] = 1;
        const idx = pi * 4;
        if (!isBg(idx)) continue;
        data[idx + 3] = 0; // make transparent
        const x = pi % W, y = (pi - x) / W;
        if (x > 0)     stack.push(pi - 1);
        if (x < W - 1) stack.push(pi + 1);
        if (y > 0)     stack.push(pi - W);
        if (y < H - 1) stack.push(pi + W);
      }

      ctx.putImageData(id, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        // CORS issue if image is cross-origin without crossorigin attr.
        console.warn('[decheck] toDataURL failed:', e.message);
        resolve(null);
      }
    });
  }

  function processImg(img) {
    if (img.dataset.decheckDone === '1') return;
    img.dataset.decheckDone = '1';
    // Need crossOrigin set BEFORE the image loads to avoid canvas tainting.
    if (img.complete && img.naturalWidth) {
      chromaKey(img).then((dataUrl) => { if (dataUrl) img.src = dataUrl; });
    } else {
      img.addEventListener('load', () => {
        chromaKey(img).then((dataUrl) => { if (dataUrl) img.src = dataUrl; });
      });
    }
  }

  function processAll(root) {
    const imgs = (root || document).querySelectorAll('img[src*="/cutscenes/chars/"]:not([data-decheck-done])');
    imgs.forEach(processImg);
  }

  // ⚡ PERF (2026-06-01) — MutationObserver REMOVED. It was firing on
  // every DOM mutation in the page (and the homework page mutates a LOT
  // during sentence building), each callback doing querySelectorAll
  // walks. Source of platform-wide latency the user reported.
  // Now: only the static images present at DOMContentLoaded are processed
  // automatically. Dynamically added images must opt in by calling
  // window.decheckImage(imgEl) explicitly (see characters.js).
  document.addEventListener('DOMContentLoaded', () => {
    processAll();
  });
  window.decheckImage = processImg;
  window.decheckAll = processAll;
})();
