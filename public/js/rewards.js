// === Global Reward Toast System ===
// Lightweight, NON-intrusive positive feedback that any game can fire on a
// correct answer or other "well done" moment. Lives in a fixed bottom-center
// chip that slides up, glows, then fades — never covers the gameplay area
// like the Dralingo dragon overlay did.
//
//   Rewards.show()                  → random "great job" with random icon
//   Rewards.show({ tier: 'epic' })  → random epic message+icon
//   Rewards.show({ text, icon })    → custom message
//   Rewards.combo(n)                → "¡Combo x5!" style
//
// All banks are Spanish-first (matches the rest of the platform's UI).
(function () {
  'use strict';

  // ── ICON BANK ────────────────────────────────────────────────────────────
  // Grouped by "tier" so we can match the visual weight of the moment.
  const ICONS = {
    common: ['⭐', '✨', '💫', '🌟', '👍', '👏', '🎯', '💪', '😊', '🎈'],
    great:  ['🚀', '⚡', '🔥', '💎', '🏆', '🥇', '💯', '🌈', '🎊', '🎉'],
    epic:   ['🐉', '🌠', '👑', '🏅', '🎖', '💖', '🦄', '⚡', '🔱', '🌟'],
    combo:  ['🔥', '⚡', '💥', '🎯', '🌟', '✨'],
    streak: ['🔥', '💫', '⚡', '🌠', '✨'],
    speed:  ['⚡', '💨', '🚀', '🏃', '🌪'],
  };

  // ── MESSAGE BANKS ────────────────────────────────────────────────────────
  // Spanish positive-encouragement messages. Kept SHORT so they read as
  // friendly toasts rather than walls of text. A second "chinese" tag is
  // added on a few to weave the language angle in.
  const MSGS = {
    common: [
      '¡Bien hecho!', '¡Súper!', '¡Muy bien!', '¡Excelente!',
      '¡Eres rápido!', '¡Vas genial!', '¡Sigue así!', '¡Perfecto!',
      '¡Lo lograste!', '¡Bravo!', '¡Buen trabajo!', '¡Inteligente!',
      '¡Qué cerebro!', '¡Lo sabes todo!', '¡Imparable!',
    ],
    great: [
      '¡Increíble!', '¡Asombroso!', '¡Espectacular!', '¡Fenómeno!',
      '¡Eres una estrella! ⭐', '¡Genio!', '¡Crack!', '¡A volar! 🚀',
      '¡Sin errores!', '¡Maestro!', '¡Imparable! 🔥', '¡Vas en racha!',
    ],
    epic: [
      '¡LEGENDARIO! 🐉', '¡Eres un dragón! 🐉', '¡ÉPICO!',
      '¡Nivel maestro!', '¡Increíble combo! 💥', '¡INVENCIBLE! 👑',
      '¡A otro nivel!', '¡UN CAMPEÓN!', '¡PERFECTO! 💯',
    ],
    streak: [
      '¡Racha caliente! 🔥', '¡Sigue así!', '¡No te detengas!',
      '¡Imparable! ⚡', '¡Combo subiendo! 💫',
    ],
    speed: [
      '¡Rapidísimo! ⚡', '¡Como un rayo!', '¡Velocidad de dragón!',
      '¡Súper veloz!', '¡Imparable! 💨',
    ],
    chinese: [
      '太棒了!', '加油!', '很好!', '不错!', '聪明!',
    ],
  };

  // ── INTERNAL STATE ───────────────────────────────────────────────────────
  let container = null;
  let lastShownAt = 0;
  let recentMsgs = []; // anti-repeat queue (last 5 messages)

  function getContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.className = 'reward-toast-layer';
    document.body.appendChild(container);
    return container;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickFresh(arr) {
    // Avoid repeating the same message back-to-back
    let tries = 0;
    let m;
    do {
      m = pick(arr);
      tries++;
    } while (recentMsgs.includes(m) && tries < 6);
    recentMsgs.push(m);
    if (recentMsgs.length > 5) recentMsgs.shift();
    return m;
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────
  function show(opts) {
    opts = opts || {};
    // Throttle — never more than one toast every 350ms
    const now = Date.now();
    if (now - lastShownAt < 350) return;
    lastShownAt = now;

    const tier = opts.tier || 'common';
    const icon = opts.icon || pick(ICONS[tier] || ICONS.common);
    const text = opts.text || pickFresh(MSGS[tier] || MSGS.common);

    const root = getContainer();
    const toast = document.createElement('div');
    toast.className = `reward-toast tier-${tier}`;
    toast.innerHTML = `
      <span class="reward-toast-icon">${icon}</span>
      <span class="reward-toast-text">${escapeHtml(text)}</span>
    `;
    root.appendChild(toast);
    // Allow flow to push older toasts up
    requestAnimationFrame(() => toast.classList.add('in'));
    const ttl = opts.duration || 1600;
    setTimeout(() => {
      toast.classList.remove('in');
      toast.classList.add('out');
      setTimeout(() => toast.remove(), 380);
    }, ttl);
  }

  function combo(n) {
    // "¡Combo x5! 🔥" — for chained correct answers / fast jumps
    show({
      tier: 'combo',
      icon: pick(ICONS.combo),
      text: `¡Combo x${n}! 🔥`,
      duration: 1400,
    });
  }

  function streak(n) {
    show({
      tier: 'streak',
      icon: pick(ICONS.streak),
      text: `¡Racha ${n}! 🔥`,
      duration: 1400,
    });
  }

  function epic() {
    show({ tier: 'epic', duration: 2200 });
  }

  function speed() {
    show({ tier: 'speed' });
  }

  function chinese() {
    show({
      tier: 'great',
      icon: '🐲',
      text: pick(MSGS.chinese),
      duration: 1500,
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  window.Rewards = {
    show,
    combo,
    streak,
    epic,
    speed,
    chinese,
    // expose banks in case a host page wants to render an icon picker
    ICONS,
    MSGS,
  };
})();
