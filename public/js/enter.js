// Enter — handles first-interaction audio unlock, welcome chime, and looping music.
// Include on every page that should have ambient music. Requires sounds.js loaded first.
(function () {
  let entered = false;
  function enter() {
    if (entered) return;
    entered = true;
    if (window.unlockAudio) window.unlockAudio();
    if (!window.MochiSounds) return;
    // Soft welcome chime (1.5s)
    MochiSounds.welcome();
    // Then ease into the looping pentatonic koto + taiko ambient
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
