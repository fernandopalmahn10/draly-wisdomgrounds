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

      // 🛑 CRITICAL PERF FIX (2026-06-01) — was leaking one infinite rAF
      // loop per celebration. Even after the video was removed from DOM,
      // the loop kept rescheduling itself. After 10 celebrations there
      // were 10 rAF loops firing every frame, blocking touch events and
      // making the whole platform feel unresponsive ("phantom touches",
      // "stuck active states"). Now the loop bails when the video is
      // detached from the document.
      let stopped = false;
      function stop() { stopped = true; }
      function draw() {
        if (stopped) return;
        // Self-terminate if the video has been removed from the DOM —
        // this is the safety net for celebration overlays that get
        // destroyed mid-playback by overlay.remove() in characters.js.
        if (!document.contains(video)) { stopped = true; return; }
        if (!video.paused && !video.ended && video.readyState >= 2) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = id.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              if (g > r + 40 && g > b + 40 && g > 80) {
                data[i + 3] = 0;
              }
            }
            ctx.putImageData(id, 0, 0);
          } catch (e) {
            console.warn('[chroma] frame draw failed:', e.message);
            video.style.display = '';
            canvas.style.display = 'none';
            stopped = true;
            return;
          }
        }
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
      // Expose the stop function so callers can kill the loop explicitly.
      video._chromaStop = stop;
      canvas._chromaStop = stop;
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
