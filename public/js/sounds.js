(function () {
  let audioCtx = null;
  let muted = false;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let nextBarTime = 0;

  function ensureCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = muted ? 0 : 0.7;
      sfxGain.connect(audioCtx.destination);
      musicGain = audioCtx.createGain();
      musicGain.gain.value = muted ? 0 : 0.45;
      musicGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone({ freq = 440, dur = 0.1, type = 'sine', vol = 0.25, slideTo = null, delay = 0 }) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.1, vol = 0.2, delay = 0 }) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(gain).connect(sfxGain);
    src.start(t0);
  }

  // -- BACKGROUND MUSIC: pentatonic koto loop + taiko drum --
  // D minor pentatonic: D F G A C  (mysterious, traditional East Asian flavor)
  const D4 = 293.66, F4 = 349.23, G4 = 392.00, A4 = 440.00, C5 = 523.25, D5 = 587.33, F5 = 698.46;
  // Beats are at 120 BPM, each beat = 0.5s. Bar = 8 beats = 4s.
  const PATTERN = [
    { f: D4, beat: 0,   dur: 0.55 },
    { f: A4, beat: 0.5, dur: 0.35 },
    { f: F4, beat: 1,   dur: 0.4  },
    { f: G4, beat: 1.5, dur: 0.35 },
    { f: A4, beat: 2,   dur: 0.55 },
    { f: F4, beat: 2.5, dur: 0.35 },
    { f: D4, beat: 3,   dur: 0.4  },
    { f: A4, beat: 3.5, dur: 0.4  },
    { f: C5, beat: 4,   dur: 0.55 },
    { f: D5, beat: 4.5, dur: 0.4  },
    { f: A4, beat: 5,   dur: 0.4  },
    { f: G4, beat: 5.5, dur: 0.35 },
    { f: F4, beat: 6,   dur: 0.55 },
    { f: A4, beat: 6.5, dur: 0.4  },
    { f: G4, beat: 7,   dur: 0.4  },
    { f: D4, beat: 7.5, dur: 0.5  }
  ];
  const BEAT_DUR = 0.5;
  const BAR_DUR = 8 * BEAT_DUR;

  function kotoNote(freq, time, dur) {
    const ctx = audioCtx;
    // Two oscillators for richness — mimics a plucked koto
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 2;
    const gain = ctx.createGain();
    const oscGain2 = ctx.createGain();
    oscGain2.gain.value = 0.25;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc1.connect(gain);
    osc2.connect(oscGain2).connect(gain);
    gain.connect(musicGain);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.1);
    osc2.stop(time + dur + 0.1);
  }

  function taiko(time, vol = 0.35) {
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain).connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.3);
    // Snap on top
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.3, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    src.connect(ng).connect(musicGain);
    src.start(time);
  }

  function scheduleAhead() {
    if (!audioCtx) return;
    const lookAhead = audioCtx.currentTime + 2.5;
    while (nextBarTime < lookAhead) {
      // Melody
      PATTERN.forEach((n) => {
        kotoNote(n.f, nextBarTime + n.beat * BEAT_DUR, n.dur);
      });
      // Drums on beats 1 and 5
      taiko(nextBarTime, 0.35);
      taiko(nextBarTime + 4 * BEAT_DUR, 0.28);
      // Soft tick on beats 3 and 7
      taiko(nextBarTime + 2 * BEAT_DUR, 0.12);
      taiko(nextBarTime + 6 * BEAT_DUR, 0.12);
      nextBarTime += BAR_DUR;
    }
  }

  // === Custom music via Web Audio API ===
  // Web Audio plays even in iPhone silent mode (HTMLAudio does not).
  // Falls back to procedural synth music if the file fails to load.
  let bgBuffer = null;
  let bgSource = null;
  let bgFailed = false;
  let bgLoading = false;

  // Cache of additional music tracks (win/lose/tie/fanfare)
  const extraBuffers = {};       // url → AudioBuffer
  const extraSources = {};       // url → currently-playing source (for stopping)

  async function loadExtra(url) {
    if (extraBuffers[url]) return extraBuffers[url];
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const ctx = ensureCtx();
      if (!ctx) return null;
      const buf = await new Promise((resolve, reject) =>
        ctx.decodeAudioData(arr, resolve, reject)
      );
      extraBuffers[url] = buf;
      return buf;
    } catch (e) {
      return null;
    }
  }

  async function playExtraTrack(url, opts) {
    opts = opts || {};
    const ctx = ensureCtx();
    if (!ctx) return null;
    const buf = await loadExtra(url);
    if (!buf) return null;
    // Stop any previous instance of this track
    if (extraSources[url]) {
      try { extraSources[url].stop(); extraSources[url].disconnect(); } catch (e) {}
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = !!opts.loop;
    const gain = ctx.createGain();
    const targetVol = muted ? 0 : (opts.volume != null ? opts.volume : 0.6);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + (opts.fadeIn || 0.3));
    src.connect(gain).connect(musicGain);
    src.start(0);
    extraSources[url] = src;
    return { source: src, gain };
  }

  function stopExtraTrack(url, fadeOut) {
    const src = extraSources[url];
    if (!src || !audioCtx) return;
    try {
      // Quick stop after a brief fade
      setTimeout(() => {
        try { src.stop(); src.disconnect(); } catch (e) {}
      }, (fadeOut || 0.4) * 1000);
    } catch (e) {}
    delete extraSources[url];
  }

  async function loadBgBuffer() {
    if (bgBuffer || bgLoading || bgFailed) return bgBuffer;
    bgLoading = true;
    try {
      const res = await fetch('/assets/music/battle-theme.mp3');
      if (!res.ok) throw new Error('fetch failed');
      const arr = await res.arrayBuffer();
      const ctx = ensureCtx();
      if (!ctx) throw new Error('no audio ctx');
      bgBuffer = await new Promise((resolve, reject) =>
        ctx.decodeAudioData(arr, resolve, reject)
      );
      return bgBuffer;
    } catch (e) {
      bgFailed = true;
      return null;
    } finally {
      bgLoading = false;
    }
  }

  async function tryStartCustomMusic() {
    if (bgFailed) return false;
    const ctx = ensureCtx();
    if (!ctx) return false;
    if (bgSource) return true; // already playing
    const buf = bgBuffer || await loadBgBuffer();
    if (!buf) return false;
    bgSource = ctx.createBufferSource();
    bgSource.buffer = buf;
    bgSource.loop = true;
    // Fade in
    const targetVol = muted ? 0 : 0.6;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 1.5);
    bgSource.connect(musicGain);
    bgSource.start(0);
    return true;
  }

  function stopCustomMusic() {
    const ctx = audioCtx;
    if (!ctx || !bgSource) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
    const src = bgSource;
    bgSource = null;
    setTimeout(() => {
      try { src.stop(); src.disconnect(); } catch (e) {}
    }, 600);
  }

  async function startMusic() {
    // Prefer the custom MP3 via Web Audio. Fall back to procedural koto only if MP3 fails.
    const ok = await tryStartCustomMusic();
    if (ok) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    if (musicTimer) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(0, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.6, ctx.currentTime + 1.5);
    nextBarTime = ctx.currentTime + 0.2;
    scheduleAhead();
    musicTimer = setInterval(scheduleAhead, 1000);
  }

  function stopMusic() {
    stopCustomMusic();
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    if (musicGain && audioCtx) {
      musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    }
  }

  const Sounds = {
    tap() {
      tone({ freq: 700 + Math.random() * 200, dur: 0.05, type: 'square', vol: 0.12, slideTo: 1100 });
    },
    combo() {
      tone({ freq: 880, dur: 0.08, type: 'triangle', vol: 0.2 });
      tone({ freq: 1320, dur: 0.12, type: 'triangle', vol: 0.2, delay: 0.05 });
    },
    correct() {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.22, delay: i * 0.07 })
      );
    },
    wrong() {
      tone({ freq: 220, dur: 0.4, type: 'sawtooth', vol: 0.18, slideTo: 90 });
    },
    tick() {
      tone({ freq: 1200, dur: 0.03, type: 'square', vol: 0.08 });
    },
    countdownNum() {
      tone({ freq: 660, dur: 0.15, type: 'sine', vol: 0.28 });
    },
    go() {
      tone({ freq: 80, dur: 1.2, type: 'sine', vol: 0.4, slideTo: 50 });
      noise({ dur: 0.3, vol: 0.15 });
    },
    win() {
      [523, 659, 784, 1047, 1318].forEach((f, i) =>
        tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.28, delay: i * 0.1 })
      );
      tone({ freq: 65, dur: 1.8, type: 'sine', vol: 0.35, delay: 0.2 });
    },
    lose() {
      [440, 370, 311, 247].forEach((f, i) =>
        tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.22, delay: i * 0.12 })
      );
    },
    join() {
      tone({ freq: 800, dur: 0.06, type: 'square', vol: 0.15 });
      tone({ freq: 1200, dur: 0.08, type: 'square', vol: 0.12, delay: 0.05 });
    },
    swap() {
      tone({ freq: 500, dur: 0.15, type: 'triangle', vol: 0.2, slideTo: 1000 });
    },
    urgent() {
      tone({ freq: 60, dur: 0.4, type: 'sine', vol: 0.25 });
    },
    populate(team) {
      // Soft chime when a creature appears on the territory
      const f = team === 'red' ? 880 : 1100;
      tone({ freq: f, dur: 0.18, type: 'sine', vol: 0.12 });
    },
    thwack() {
      // Wooden stick hitting piñata: short noise burst with a thumpy low tone,
      // plus a brief mid resonance for the "crack" character. Distinct from
      // every other sound in the game.
      noise({ dur: 0.09, vol: 0.22 });
      tone({ freq: 140, dur: 0.12, type: 'square', vol: 0.22, slideTo: 60 });
      tone({ freq: 320, dur: 0.06, type: 'triangle', vol: 0.10, delay: 0.005 });
    },
    whoosh() {
      // Wing-flap whoosh: airy noise sweep + low rising tone. Different
      // character from the piñata thwack — feels like wind catching wings.
      noise({ dur: 0.22, vol: 0.18 });
      tone({ freq: 180, dur: 0.18, type: 'sine', vol: 0.16, slideTo: 480 });
      tone({ freq: 90,  dur: 0.12, type: 'triangle', vol: 0.10, delay: 0.04 });
    },
    zombieGroan(intensity) {
      // Low, growling groan with downward pitch slide + breathy noise tail.
      // Intensity 0..1 scales volume + duration so distant ambient groans
      // sound faint and "near miss" scares sound loud + close.
      const v = Math.max(0.05, Math.min(1, intensity || 0.4));
      tone({ freq: 110, dur: 0.7 * v + 0.2, type: 'sawtooth', vol: 0.10 * v, slideTo: 55 });
      tone({ freq: 75,  dur: 0.5 * v + 0.15, type: 'triangle', vol: 0.08 * v, slideTo: 40, delay: 0.06 });
      noise({ dur: 0.4 * v, vol: 0.06 * v, delay: 0.05 });
    },
    zombieScream() {
      // Big jumpscare scream — high gnarled screech slamming down into a growl,
      // followed by a fat low rumble and a noise burst. The center-screen
      // zombie attack uses this; volume is meant to be JARRING (not background).
      tone({ freq: 880, dur: 0.55, type: 'sawtooth', vol: 0.28, slideTo: 180 });
      tone({ freq: 660, dur: 0.45, type: 'square',  vol: 0.18, slideTo: 120, delay: 0.04 });
      tone({ freq: 320, dur: 0.7,  type: 'sawtooth', vol: 0.22, slideTo: 70, delay: 0.18 });
      tone({ freq: 55,  dur: 1.0,  type: 'sine',    vol: 0.30, slideTo: 38, delay: 0.05 });
      noise({ dur: 0.7, vol: 0.22 });
      noise({ dur: 0.5, vol: 0.14, delay: 0.35 });
    },
    heartbeat() {
      // Quick double-thump — handy for "they're getting close" cues
      tone({ freq: 70, dur: 0.18, type: 'sine', vol: 0.28, slideTo: 45 });
      tone({ freq: 65, dur: 0.20, type: 'sine', vol: 0.26, slideTo: 40, delay: 0.22 });
    },
    candySpill() {
      // Cheerful confetti-y cascade for when the piñata bursts
      [880, 1320, 1760, 2200, 1760, 1320].forEach((f, i) =>
        tone({ freq: f, dur: 0.12, type: 'triangle', vol: 0.18, delay: i * 0.04 })
      );
      noise({ dur: 0.4, vol: 0.10, delay: 0.05 });
    },
    welcome() {
      // Soft Chinese-style welcoming chime: low gong + pentatonic bells + airy shimmer
      // Low warm gong base
      tone({ freq: 110, dur: 2.5, type: 'sine', vol: 0.18 });
      tone({ freq: 165, dur: 2.0, type: 'triangle', vol: 0.10 });
      // Pentatonic bell cascade (D minor: D F G A C)
      [294, 349, 392, 440, 523].forEach((f, i) =>
        tone({ freq: f, dur: 1.0, type: 'triangle', vol: 0.13, delay: 0.15 + i * 0.16 })
      );
      // Soft high shimmer
      [1047, 1318, 1568].forEach((f, i) =>
        tone({ freq: f, dur: 0.6, type: 'sine', vol: 0.06, delay: 0.7 + i * 0.1 })
      );
    },
    paint() {
      // Painting a tile — quick wet brush sound
      tone({ freq: 600 + Math.random() * 200, dur: 0.04, type: 'sine', vol: 0.1, slideTo: 300 });
    },
    step() {
      // Step on a tile — tactile click
      tone({ freq: 200, dur: 0.03, type: 'square', vol: 0.08 });
    },
    legendary() {
      // Sub-bass dragon rumble
      tone({ freq: 55, dur: 2.2, type: 'sawtooth', vol: 0.28, slideTo: 75 });
      tone({ freq: 80, dur: 2.0, type: 'sine', vol: 0.32 });
      // Rumble noise
      noise({ dur: 0.8, vol: 0.18 });
      // Ascending bell cascade — pentatonic for that mystic feel
      [392, 523, 587, 784, 880, 1175, 1318, 1568].forEach((f, i) => {
        tone({ freq: f, dur: 0.7, type: 'triangle', vol: 0.22, delay: 0.3 + i * 0.09 });
      });
      // High shimmer arpeggio
      [2093, 2637, 3136, 3520].forEach((f, i) =>
        tone({ freq: f, dur: 0.5, type: 'sine', vol: 0.12, delay: 1.0 + i * 0.06 })
      );
      // Final boom on exit
      tone({ freq: 65, dur: 1.5, type: 'sine', vol: 0.28, delay: 2.0 });
      tone({ freq: 110, dur: 1.0, type: 'triangle', vol: 0.18, delay: 2.0 });
    },
    startMusic,
    stopMusic,
    // Win/Lose celebration music (Kenney Music Loops, ~30s each, loops)
    winMusic() {
      stopMusic(); // kill battle theme first
      return playExtraTrack('/assets/music/win-theme.ogg', { loop: true, volume: 0.55, fadeIn: 0.5 });
    },
    loseMusic() {
      stopMusic();
      return playExtraTrack('/assets/music/lose-theme.ogg', { loop: true, volume: 0.5, fadeIn: 0.5 });
    },
    tieMusic() {
      stopMusic();
      return playExtraTrack('/assets/music/tie-theme.ogg', { loop: true, volume: 0.55, fadeIn: 0.5 });
    },
    winFanfare() {
      // Short triumphant sting (Kenney steeldrum jingle ~2s) — plays once over the music
      return playExtraTrack('/assets/music/win-fanfare.ogg', { loop: false, volume: 0.7, fadeIn: 0.05 });
    },
    stopEndMusic() {
      ['/assets/music/win-theme.ogg', '/assets/music/lose-theme.ogg', '/assets/music/tie-theme.ogg']
        .forEach((u) => stopExtraTrack(u, 0.5));
    }
  };

  window.MochiSounds = Sounds;
  window.toggleMute = function () {
    muted = !muted;
    if (audioCtx && sfxGain && musicGain) {
      sfxGain.gain.linearRampToValueAtTime(muted ? 0 : 0.7, audioCtx.currentTime + 0.2);
      musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.6, audioCtx.currentTime + 0.2);
    }
    return muted;
  };
  window.unlockAudio = ensureCtx;
})();
