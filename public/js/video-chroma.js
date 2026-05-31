// =====================================================================
// 🎬 REAL-TIME VIDEO CHROMA-KEY
// =====================================================================
// Higgsfield outputs MP4 with the editor checkerboard pattern PAINTED
// INTO every frame. Pure CSS can't fix opaque pixels. So:
//   1. Hide the <video> element
//   2. Insert a <canvas> in its place with identical styling
//   3. requestAnimationFrame loop draws each video frame to the canvas
//   4. For each frame, scan pixels: any grayscale pixel (R≈G≈B, low
//      saturation) in the brightness range 30-210 → set alpha=0
//   5. putImageData renders the cleaned frame
//
// Character pixels (saturated colors) and bright whites (255+) and
// pure blacks (under 30) are preserved. Only the gray checker squares
// get erased.
//
// Performance: 480x480 canvas at 30fps = 230k pixels/frame, easy on
// modern phones.
// =====================================================================

(function () {
  function chromaKeyVideo(video) {
    if (video.dataset.chromaKeyed === '1') return;
    video.dataset.chromaKeyed = '1';

    // Wait for the video metadata so we know native dimensions.
    const setup = () => {
      const W = Math.min(video.videoWidth || 720, 720);
      const H = Math.min(video.videoHeight || 1280, 1280);
      const aspectRatio = (video.videoHeight || 1280) / (video.videoWidth || 720);

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = Math.round(W * aspectRatio);
      // Copy display properties from the original video element so layout
      // is identical (clip-path, transform, filter, sizing).
      canvas.className = video.className + ' ck-canvas';
      // Inherit computed dimensions from the original video's parent context.
      canvas.style.cssText = window.getComputedStyle(video).cssText;
      // Override the few that need fresh values for the canvas element.
      canvas.style.objectFit = 'cover';

      // Place canvas BEFORE the video, then hide the video.
      video.parentNode.insertBefore(canvas, video);
      video.style.display = 'none';

      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      function draw() {
        if (!video.paused && !video.ended && video.readyState >= 2) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = id.data;
            // Chroma-key pass: erase grayscale pixels in checker range.
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const max = Math.max(r, g, b);
              const min = Math.min(r, g, b);
              // Checker pattern: low saturation (max ≈ min) AND in the
              // mid-gray brightness range (skip pure black/outlines and
              // pure white/highlights).
              if (max - min < 28 && min > 35 && min < 215) {
                data[i + 3] = 0; // transparent
              }
            }
            ctx.putImageData(id, 0, 0);
          } catch (e) {
            // CORS taint or similar — fall back to showing original video.
            console.warn('[chroma] frame draw failed:', e.message);
            video.style.display = '';
            canvas.style.display = 'none';
            return;
          }
        }
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
    };

    if (video.readyState >= 1) {
      setup();
    } else {
      video.addEventListener('loadedmetadata', setup, { once: true });
    }
    // Some browsers don't autoplay until we explicitly call play().
    video.play().catch(() => {});
  }

  function processAll() {
    document.querySelectorAll('video[data-chroma-key]').forEach(chromaKeyVideo);
  }

  document.addEventListener('DOMContentLoaded', processAll);
  // Also catch videos added later (cutscenes, daily intros).
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'VIDEO' && n.hasAttribute('data-chroma-key')) chromaKeyVideo(n);
        else if (n.querySelectorAll) {
          n.querySelectorAll('video[data-chroma-key]').forEach(chromaKeyVideo);
        }
      });
    });
  });
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });

  window.chromaKeyVideo = chromaKeyVideo;
})();
