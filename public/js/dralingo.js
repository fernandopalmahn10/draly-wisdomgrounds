// Dralingo — legendary appearances + ambient floating
// Uses MochiSounds.legendary() defined in sounds.js

(function () {
  let randomTimer = null;
  let lastAppearance = 0;

  // Wisdom quotes that appear during legendary entries
  const QUOTES = [
    'Wisdom flies on swift wings',
    'The mind is the true champion',
    'Knowledge is the greatest treasure',
    'Every answer paints the world',
    'Quick thinkers shape the day',
    'Sharp wit, sharp victory',
    'May your taps echo true',
    'Soar, scholar, soar'
  ];

  function randomFromArr(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function legendaryAppearance(opts) {
    opts = opts || {};
    if (document.querySelector('.dralingo-overlay')) return;
    const now = Date.now();
    if (now - lastAppearance < 8000) return;
    lastAppearance = now;

    const overlay = document.createElement('div');
    overlay.className = 'dralingo-overlay';

    const rays = document.createElement('div');
    rays.className = 'legendary-rays';
    overlay.appendChild(rays);

    for (let i = 0; i < 24; i++) {
      const spark = document.createElement('div');
      spark.className = 'legendary-spark';
      const angle = (i / 24) * Math.PI * 2;
      const dist = 200 + Math.random() * 300;
      spark.style.left = '50%';
      spark.style.top = '50%';
      spark.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
      spark.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
      spark.style.animationDelay = (0.3 + i * 0.02) + 's';
      overlay.appendChild(spark);
    }

    const img = document.createElement('img');
    img.src = '/assets/dralingo.png';
    img.alt = 'Dralingo';
    img.className = 'legendary-image';
    overlay.appendChild(img);

    const quote = document.createElement('div');
    quote.className = 'legendary-quote';
    quote.textContent = opts.quote || randomFromArr(QUOTES);
    overlay.appendChild(quote);

    document.body.appendChild(overlay);

    if (window.MochiSounds && MochiSounds.legendary) {
      MochiSounds.legendary();
    }

    setTimeout(() => overlay.remove(), 3500);
  }

  function startRandomAppearances(opts) {
    opts = opts || {};
    const minMs = opts.minMs || 25000;
    const maxMs = opts.maxMs || 50000;
    const isActive = opts.isActive || (() => true);

    function schedule() {
      const next = minMs + Math.random() * (maxMs - minMs);
      randomTimer = setTimeout(() => {
        if (isActive()) {
          legendaryAppearance();
        }
        schedule();
      }, next);
    }

    if (randomTimer) clearTimeout(randomTimer);
    schedule();
  }

  function stopRandomAppearances() {
    if (randomTimer) clearTimeout(randomTimer);
    randomTimer = null;
  }

  window.Dralingo = {
    legendary: legendaryAppearance,
    startRandom: startRandomAppearances,
    stopRandom: stopRandomAppearances
  };
})();
