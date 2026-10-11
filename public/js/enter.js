// Enter — handles first-interaction audio unlock, welcome chime, and looping music.
// Include on every page that should have ambient music. Requires sounds.js loaded first.
(function () {
  const PLATFORM_PAGE = /^\/(index\.html)?$|\/(games|sets|packs)\.html$/.test(location.pathname);
  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    // Hide any "tap for sound" hint
    const hint = document.getElementById('sound-hint');
    if (hint) hint.classList.add('dismissed');
    if (window.unlockAudio) window.unlockAudio();
    if (!window.MochiSounds) return;
    // His decision 2026-10-11: the platform itself is quiet by default (home, games list, question packs).
    // Pin games keep their own music (their pages start it at the countdown).
    if (PLATFORM_PAGE) return;
    // Soft welcome chime (1.5s)
    MochiSounds.welcome();
    // Then ease into the looping music
    setTimeout(() => {
      if (MochiSounds.startMusic) MochiSounds.startMusic();
    }, 1700);
  }
  ['click', 'touchstart', 'keydown'].forEach((evt) =>
    document.addEventListener(evt, enter, { once: true })
  );

  // Stop music on page unload (so the next page can start fresh cleanly)
  window.addEventListener('pagehide', () => {
    if (window.MochiSounds && MochiSounds.stopMusic) MochiSounds.stopMusic();
  });
})();
