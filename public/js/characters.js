// =====================================================================
// 🎭 CHARACTER SYSTEM — single source of truth for all platform characters
// =====================================================================
// Each character has:
//   - id, name, tagline, palette
//   - poseA: walking-in / idle pose (PNG with alpha)
//   - poseB: signature / action pose (PNG with alpha)
//   - victory: 5s celebration animation (MP4 when available)
//   - catchphrase: short Spanish line shown in dialogue bubbles
//   - rarity: common | rare | legendary  (used for unlocks)
//
// Used by:
//   - homework.js daily mode intros / outros
//   - reward overlays after winning a daily or completing a tarea
//   - avatar selection (if `avatarable: true`)
//   - reading mode narrators (if `narrator: true`)
//   - random "easter egg" appearances (idle PNG slides across screen)
// =====================================================================

(function () {
  const C = (id, opts) => Object.assign({
    id,
    poseA: '/assets/cutscenes/chars/' + id + '-a.png',
    poseB: '/assets/cutscenes/chars/' + id + '-b.png',
    victory: '/assets/cutscenes/chars/' + id + '-victory.mp4',
    avatarable: true,
    narrator: false,
    rarity: 'common',
  }, opts);

  const CHARACTERS = {
    gojo: C('gojo', {
      name: 'Gojo',
      tagline: 'Sensei del infinito',
      catchphrase: '— Eres el más fuerte. ¡Sigue así! 💙',
      palette: { primary: '#5be8d1', accent: '#1c1f3a' },
      rarity: 'legendary',
    }),
    yugi: C('yugi', {
      name: 'Yugi',
      tagline: '¡Es hora del duelo!',
      catchphrase: '— ¡Confía en tu deck! 🎴',
      palette: { primary: '#ffd24a', accent: '#7a1fa3' },
      rarity: 'legendary',
      // 🩹 REVERTED 2026-06-03 — used the 22 MB Yugi GIF here briefly
      // but it was being served on every Yugi celebration. Back to the
      // static PNG until the compressed 1 MB GIF is ready.
    }),
    // 🐢 Squirtle (Pīnpīn the water turtle) — selectable avatar.
    // Uses the user's 1.1 MB transparent dancing GIF as the main pose.
    // Light blue + water vibes. Common rarity so kids can pick freely.
    squirtle: C('squirtle', {
      name: 'Squirtle',
      tagline: '¡Pīnpīn está listo!',
      catchphrase: '— ¡Wǒ ài mi jiā! 💧',
      palette: { primary: '#5eb8ff', accent: '#0a3a5e' },
      rarity: 'common',
      avatarable: true,
      // Override defaults with the transparent dancing GIF.
      poseA: '/assets/png-library/Squirtle%20animation.gif',
      poseB: '/assets/png-library/Squirtle%20animation.gif',
    }),
    // Pre-declared slots for characters whose assets are coming soon.
    // The UI knows to gracefully fall back to a PNG placeholder if the
    // file doesn't exist yet (no broken layouts).
    yuji:    C('yuji',    { name: 'Yuji',    tagline: '¡Estoy contigo!',      catchphrase: '— ¡Vamos a entrenar juntos! 💪',     palette: { primary: '#ff6f8f', accent: '#1c1c1c' }, rarity: 'rare' }),
    shelly:  C('shelly',  { name: 'Shelly',  tagline: 'Lista para el ataque', catchphrase: '— ¡Bang bang! Lo lograste 💥',       palette: { primary: '#ff6f8f', accent: '#8b3a8e' }, rarity: 'rare' }),
    fnaf:    C('fnaf',    { name: 'Freddy',  tagline: 'El bear amigable',     catchphrase: '— 🎵 Toot toot! ¡Bien hecho!',        palette: { primary: '#8a5a2b', accent: '#3a2510' }, rarity: 'rare' }),
    dandy:   C('dandy',   { name: 'Dandy',   tagline: 'Florece tu chino',     catchphrase: '— Cada palabra es un pétalo 🌻',     palette: { primary: '#ffe082', accent: '#5be88a' }, rarity: 'rare' }),
    anime1:  C('anime1',  { name: 'Hanzō',   tagline: 'Espada de sakura',     catchphrase: '— Tu sentencia fue impecable ⚔️',    palette: { primary: '#ff9aa2', accent: '#3a2410' }, rarity: 'common' }),
    anime2:  C('anime2',  { name: 'Mei',     tagline: 'Maestra de letras',    catchphrase: '— Las palabras tienen magia ✨',     palette: { primary: '#c5a3ff', accent: '#5be8d1' }, rarity: 'common' }),
    dralingo:C('dralingo',{ name: 'Dralingo',tagline: 'Tu mascota oficial',   catchphrase: '— ¡Cada día es una nueva aventura! 🐲',palette: { primary: '#5be8d1', accent: '#ffd24a' }, rarity: 'legendary' }),
    // 11 more slots for future generations — uncomment as files land
    naruto:  C('naruto',  { name: 'Naruto',  tagline: 'Ninja del rasengan',   catchphrase: '— ¡Dattebayo! Lo conseguiste 🍥',     palette: { primary: '#ff8c00', accent: '#1c1c1c' }, rarity: 'legendary' }),
    sasuke:  C('sasuke',  { name: 'Sasuke',  tagline: 'Sharingan activado',   catchphrase: '— Tu progreso es imparable 🔥',       palette: { primary: '#5b2cb3', accent: '#1c1c1c' }, rarity: 'rare' }),
    luffy:   C('luffy',   { name: 'Luffy',   tagline: 'Capitán del aprendizaje', catchphrase: '— ¡Voy a ser el rey del chino! 🏴‍☠️', palette: { primary: '#c81e1e', accent: '#ffd24a' }, rarity: 'legendary' }),
    goku:    C('goku',    { name: 'Goku',    tagline: 'Súper Saiyajin del HSK',catchphrase: '— ¡Kame-hame-cha! 🌟',                palette: { primary: '#ff8c00', accent: '#1c5fa3' }, rarity: 'legendary' }),
    pikachu: C('pikachu', { name: 'Pikachu', tagline: 'Compañero eléctrico',  catchphrase: '— Pika pika! ¡Bien hecho! ⚡',         palette: { primary: '#ffd24a', accent: '#c81e1e' }, rarity: 'legendary' }),
    sonic:   C('sonic',   { name: 'Sonic',   tagline: 'Velocidad de sonido',  catchphrase: '— ¡Más rápido cada día! 💨',          palette: { primary: '#1c5fa3', accent: '#ffd24a' }, rarity: 'rare' }),
    mario:   C('mario',   { name: 'Mario',   tagline: 'Plomero del chino',    catchphrase: '— ¡Mamma mia! ¡Lo lograste! 🍄',      palette: { primary: '#c81e1e', accent: '#1c5fa3' }, rarity: 'rare' }),
    kirby:   C('kirby',   { name: 'Kirby',   tagline: 'Devorador de palabras',catchphrase: '— ¡Inhala el conocimiento! 🌸',       palette: { primary: '#ff9aa2', accent: '#ffd24a' }, rarity: 'common' }),
    spiderman:C('spiderman',{name: 'Spider-Man',tagline:'Trepamuros del HSK1', catchphrase: '— ¡Con gran poder viene gran chino! 🕸️',palette: { primary: '#c81e1e', accent: '#1c5fa3' }, rarity: 'legendary' }),
    ironman: C('ironman', { name: 'Iron Man', tagline: 'JARVIS habla chino',  catchphrase: '— Te recomiendo seguir así, señor 🤖', palette: { primary: '#c81e1e', accent: '#ffd24a' }, rarity: 'legendary' }),
    elsa:    C('elsa',    { name: 'Elsa',    tagline: 'Reina de hielo',       catchphrase: '— Suéltalo y aprende libre ❄️',       palette: { primary: '#5be8d1', accent: '#c5a3ff' }, rarity: 'rare' }),
    moana:   C('moana',   { name: 'Moana',   tagline: 'Aventurera del mar',   catchphrase: '— ¡Que el océano te guíe! 🌊',        palette: { primary: '#36b9c7', accent: '#ffd24a' }, rarity: 'common' }),
  };

  window.DRALY_CHARACTERS = CHARACTERS;
  window.DRALY_CHARACTER_LIST = Object.values(CHARACTERS);

  // 🎉 SHOW a celebration overlay with a character's victory animation +
  // their catchphrase. Used by daily completion, tarea pass, milestones.
  //   showCharacterCelebration('gojo', 'Subiste a Nivel 5!');
  window.showCharacterCelebration = function (characterId, customText) {
    const char = CHARACTERS[characterId] || CHARACTERS.dralingo;
    const overlay = document.createElement('div');
    overlay.className = 'char-celebration';
    overlay.style.setProperty('--char-primary', char.palette.primary);
    overlay.style.setProperty('--char-accent', char.palette.accent);
    // ⚡ PERF FIX 2026-06-01 (#2): Skip the VIDEO entirely on celebrations.
    // The real-time chroma-key processing on every video frame was eating
    // significant CPU on phones, even after fixing the rAF leak. Just
    // show the static PNG fallback (decheck.js keys the green once, very
    // cheap). User reported platform-wide slowness; removing this fixed
    // most of it. Bring video back later if perf budget allows.
    overlay.innerHTML = `
      <div class="char-celebration-backdrop"></div>
      <div class="char-celebration-card">
        <div class="char-celebration-media">
          <img class="char-celebration-fallback" src="${char.poseB}" alt="${char.name}" data-decheck="1">
        </div>
        <div class="char-celebration-name">${char.name}</div>
        <div class="char-celebration-tagline">${char.tagline}</div>
        <div class="char-celebration-bubble">${customText || char.catchphrase}</div>
        <button class="char-celebration-ok" type="button">¡Genial!</button>
      </div>`;
    document.body.appendChild(overlay);
    // 🧹 Explicitly chroma-key the character image (decheck observer was
    // removed for perf reasons — see decheck.js). One-shot processing on
    // the image after it's in the DOM, no continuous observer cost.
    try {
      const img = overlay.querySelector('.char-celebration-fallback');
      if (img && window.decheckImage) window.decheckImage(img);
    } catch (_) {}
    requestAnimationFrame(() => overlay.classList.add('show'));
    const close = () => {
      overlay.classList.remove('show');
      setTimeout(() => { try { overlay.remove(); } catch (_) {} }, 300);
    };
    overlay.querySelector('.char-celebration-ok').addEventListener('click', close);
    overlay.querySelector('.char-celebration-backdrop').addEventListener('click', close);
    setTimeout(close, 5000);  // auto-close at 5s (was 8s — less screen time)
  };

  // Random character picker — used for surprise easter eggs.
  window.pickRandomCharacter = function (filter) {
    let pool = window.DRALY_CHARACTER_LIST;
    if (filter === 'legendary') pool = pool.filter((c) => c.rarity === 'legendary');
    else if (filter === 'rare')  pool = pool.filter((c) => c.rarity !== 'common');
    return pool[Math.floor(Math.random() * pool.length)];
  };
})();
