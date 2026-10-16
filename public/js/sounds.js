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
      musicGain.gain.value = muted ? 0 : 0.85;
      musicGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      audioCtx.resume().catch(() => { /* ignore */ });
    }
    return audioCtx;
  }

  // === BULLETPROOF AUDIO UNLOCK ===
  // The user reported music works on tablet but not phone/computer. Common
  // root causes across iOS Safari, Android Chrome, and desktop browsers:
  //   1. AudioContext stays "suspended" because resume() wasn't called from
  //      inside a real user-gesture handler.
  //   2. The context gets put into "interrupted" state by other audio (e.g.
  //      a notification, headphone switch) and never recovers.
  //   3. The first user click happens but resume() returns a Promise that
  //      isn't awaited, so the next-microtask schedule still runs while the
  //      context is suspended → silently swallowed.
  // Fix: attach unlock listeners to EVERY pointer/touch/key event (not just
  // the first), and a watchdog that auto-resumes if the state slips.
  function aggressiveUnlock() {
    const events = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'];
    const handler = () => {
      const ctx = ensureCtx();
      if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
        ctx.resume().catch(() => {});
      }
    };
    events.forEach((e) => {
      document.addEventListener(e, handler, { capture: true, passive: true });
    });
    // Re-check every 2s — if the ctx slipped to suspended (e.g. user got a
    // notification), force resume on next interaction.
    setInterval(() => {
      if (audioCtx && (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted')) {
        audioCtx.resume().catch(() => {});
      }
    }, 2000);
  }
  // Run it now — script load is before any user gesture but the listeners
  // will fire on every subsequent gesture and the watchdog runs forever.
  if (typeof document !== 'undefined') aggressiveUnlock();

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
    // Also kill any procedural theme — keeps the win/lose handoff clean
    if (themeTimer) {
      clearInterval(themeTimer);
      themeTimer = null;
      themePatternFn = null;
      themeKey = null;
    }
    if (musicGain && audioCtx) {
      musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    }
  }

  // ===========================================================================
  // PER-GAME THEMED MUSIC ENGINE
  //
  // Each game gets a distinctive musical identity — different key/tempo/timbre.
  // Themes are scheduled procedurally on a beat grid (no external audio assets,
  // no licensing risk, works offline). All voices are synthesized via WebAudio.
  //
  // The user starts a game's theme with `MochiSounds.startGameTheme('kingdoms')`,
  // and stops with `MochiSounds.stopGameTheme()` (or any of the win/lose/tie
  // music helpers, which fade the theme out first).
  // ===========================================================================
  let themeTimer = null;
  let themeStartCt = 0;     // ctx.currentTime when the theme started
  let themeBarIdx = 0;      // monotonic bar counter
  let themeKey = null;      // string identifier of running theme
  let themeBPM = 120;
  let themeBeatsPerBar = 4;
  let themeBarDur = 2.0;    // seconds per bar at current tempo
  let themeBeatDur = 0.5;
  let themePatternFn = null;
  let themeNextBarAt = 0;

  // Note name → frequency (Hz). Supports A0..C8 with sharps (e.g. "F#4", "Bb3").
  function n2f(name) {
    if (typeof name === 'number') return name;
    const m = String(name).match(/^([A-Ga-g])([#bB]?)(-?\d)$/);
    if (!m) return 440;
    const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
    const base = semis[m[1].toUpperCase()];
    const acc = m[2] === '#' ? 1 : (m[2].toLowerCase() === 'b' ? -1 : 0);
    const oct = parseInt(m[3], 10);
    const n = base + acc + (oct - 4) * 12; // semitones from A4
    return 440 * Math.pow(2, n / 12);
  }

  // ---- Synth voices used by the theme patterns ----
  function vBassPluck(time, freqOrName, dur, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const f = n2f(freqOrName);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol || 0.16, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (dur || 0.4));
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, time);
    osc.connect(lp).connect(gain).connect(musicGain);
    osc.start(time);
    osc.stop(time + (dur || 0.4) + 0.05);
  }
  function vSubBass(time, freqOrName, dur, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const f = n2f(freqOrName);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol || 0.22, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (dur || 0.5));
    osc.connect(gain).connect(musicGain);
    osc.start(time);
    osc.stop(time + (dur || 0.5) + 0.05);
  }
  function vLeadSquare(time, freqOrName, dur, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const f = n2f(freqOrName);
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(f, time);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(f * 2, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol || 0.10, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (dur || 0.25));
    osc1.connect(gain);
    osc2.connect(gain).connect(musicGain);
    osc1.start(time); osc2.start(time);
    osc1.stop(time + (dur || 0.25) + 0.05);
    osc2.stop(time + (dur || 0.25) + 0.05);
  }
  function vBell(time, freqOrName, dur, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const f = n2f(freqOrName);
    [1, 2.01, 3.99].forEach((partial, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * partial, time);
      const g = ctx.createGain();
      const v = (vol || 0.14) / (i + 1);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(v, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, time + (dur || 0.9));
      osc.connect(g).connect(musicGain);
      osc.start(time);
      osc.stop(time + (dur || 0.9) + 0.05);
    });
  }
  function vBrass(time, freqOrName, dur, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const f = n2f(freqOrName);
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth'; osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(f, time);
    osc2.frequency.setValueAtTime(f * 1.005, time);    // chorused detune
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol || 0.16, time + 0.05);
    gain.gain.linearRampToValueAtTime(vol * 0.6 || 0.10, time + (dur || 0.4) * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (dur || 0.4));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(Math.max(800, f * 1.5), time);
    bp.Q.setValueAtTime(2, time);
    osc1.connect(bp); osc2.connect(bp);
    bp.connect(gain).connect(musicGain);
    osc1.start(time); osc2.start(time);
    osc1.stop(time + (dur || 0.4) + 0.05);
    osc2.stop(time + (dur || 0.4) + 0.05);
  }
  function vPad(time, freqOrName, dur, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const f = n2f(freqOrName);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol || 0.07, time + 0.4);
    gain.gain.linearRampToValueAtTime(vol * 0.5 || 0.04, time + (dur || 1.5) - 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (dur || 1.5));
    osc.connect(gain).connect(musicGain);
    osc.start(time);
    osc.stop(time + (dur || 1.5) + 0.1);
  }
  function vKick(time, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.32, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(g).connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }
  function vSnare(time, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1200, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.18, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    src.connect(hp).connect(g).connect(musicGain);
    src.start(time);
  }
  function vHat(time, vol, len) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const dur = len || 0.05;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(7000, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.10, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(hp).connect(g).connect(musicGain);
    src.start(time);
  }
  function vShaker(time, vol) {
    if (!audioCtx) return;
    const ctx = audioCtx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3500, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.10, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    src.connect(hp).connect(g).connect(musicGain);
    src.start(time);
  }
  // ---- THEME PATTERNS ----
  // Each pattern function receives (barIdx, t0, BD) where:
  //   barIdx — running bar counter (0,1,2,…). Use modulo to phrase changes.
  //   t0     — ctx.currentTime at the start of this bar
  //   BD     — beat duration (BAR_DUR = BD * beatsPerBar)
  // Schedule notes at t0 + offsets. Keep volumes low (≤ 0.25) so SFX cut through.

  // (Dàfùwēng · Monopolio's synthesized theme was retired 2026-10-16: the remade game plays a recorded Kenney loop, assets/monopoly/)

  // (6-7 Swing's synthesized theme was retired 2026-10-15: the remade game plays a recorded Kenney loop, assets/sixseven/)

  // 🥮 MOCHI MASH — Chinese pentatonic (G-A-B-D-E), 105bpm. Light bamboo
  // koto-ish lead over a soft taiko bed.
  function themeMochi(barIdx, t0, BD) {
    const phase = barIdx % 4;
    const motif = phase < 2
      ? [['G4', 0], ['B4', 0.5], ['D5', 1], ['E5', 1.5], ['D5', 2], ['B4', 2.5], ['A4', 3], ['G4', 3.5]]
      : [['E5', 0], ['D5', 0.5], ['B4', 1], ['D5', 1.5], ['A4', 2], ['G4', 2.5], ['A4', 3], ['B4', 3.5]];
    motif.forEach(([n, b]) => vLeadSquare(t0 + b * BD, n, BD * 0.45, 0.14));
    // Soft taiko bed
    taiko(t0 + 0 * BD,   0.34);
    taiko(t0 + 2 * BD,   0.28);
    taiko(t0 + 1 * BD,   0.16);
    taiko(t0 + 3 * BD,   0.16);
    vSubBass(t0, 'G2', BD * 4, 0.22);
  }

  // 🐉 DRAGON EYE / VUELO — soaring flight, F# minor, 96bpm. Wide-interval
  // bass + airy pad + ascending arpeggio bells.
  function themeDragon(barIdx, t0, BD) {
    vSubBass(t0, 'F#2', BD * 2, 0.26);
    vSubBass(t0 + 2 * BD, 'C#3', BD * 2, 0.22);
    vPad(t0, 'A3', BD * 4, 0.12);
    vPad(t0, 'C#4', BD * 4, 0.10);
    // Ascending arp every bar
    const arp = ['F#4', 'A4', 'C#5', 'F#5', 'A5', 'F#5', 'C#5', 'A4'];
    for (let i = 0; i < 8; i++) vBell(t0 + i * (BD / 2), arp[i], BD * 0.4, 0.12);
    // Light shaker on 8ths
    for (let i = 0; i < 8; i++) vShaker(t0 + i * (BD / 2), 0.05);
  }

  // 🏰 REINOS DE COLORES — bright marching fanfare, Bb major, 112bpm. Taiko march + brass call-and-answer
  // (one phrase per kingdom) over a bouncing bass; bells on the bar so it stays cheerful, never tense.
  function themeKingdoms(barIdx, t0, BD) {
    const phase = barIdx % 4;
    taiko(t0 + 0 * BD, 0.36);
    taiko(t0 + 1 * BD, 0.18);
    taiko(t0 + 2 * BD, 0.30);
    taiko(t0 + 2.5 * BD, 0.16);
    taiko(t0 + 3 * BD, 0.20);
    const bass = phase % 2 === 0 ? ['Bb1', 'F2', 'Bb2', 'F2'] : ['Eb2', 'Bb2', 'F2', 'C2'];
    bass.forEach((n, b) => vBassPluck(t0 + b * BD, n, BD * 0.8, 0.20));
    const call = phase < 2
      ? [['F4', 0], ['Bb4', 0.5], ['D5', 1], ['F5', 1.5]]
      : [['Eb5', 0], ['D5', 0.5], ['C5', 1], ['Bb4', 1.5]];
    call.forEach(([n, b]) => vBrass(t0 + b * BD, n, BD * 0.45, 0.16));
    vBell(t0 + 2 * BD, phase % 2 ? 'C6' : 'D6', BD * 1.5, 0.10);
    for (let i = 0; i < 8; i++) vShaker(t0 + i * (BD / 2), 0.05);
  }

  // === Registry ===
  const GAME_THEMES = {
    'mochi-mash':    { bpm: 105, beatsPerBar: 4, fn: themeMochi },
    'dragon-eye':    { bpm:  96, beatsPerBar: 4, fn: themeDragon },
    'kingdoms':      { bpm: 112, beatsPerBar: 4, fn: themeKingdoms },
  };

  function scheduleThemeAhead() {
    if (!audioCtx || !themePatternFn) return;
    const lookAhead = audioCtx.currentTime + 2.5;
    while (themeNextBarAt < lookAhead) {
      themePatternFn(themeBarIdx, themeNextBarAt, themeBeatDur);
      themeBarIdx++;
      themeNextBarAt += themeBarDur;
    }
  }

  async function startGameTheme(gameType) {
    const spec = GAME_THEMES[gameType];
    if (!spec) {
      console.warn('[music] no theme registered for', gameType);
      return;
    }
    // === CRITICAL: kill ALL previous music sources first, including the
    // legacy MP3 battle theme. Skipping this caused the audible "no music"
    // bug — the MP3 ramped musicGain to 0.6 then my theme ramp to 0.75 was
    // fighting the toggleMute reset to 0.6 + the legacy fade-out. Single
    // source of truth from now on: just the procedural theme. ===
    stopMusic();          // clears musicTimer + bgSource + themeTimer
    stopCustomMusic();    // belt-and-suspenders kill of any MP3 source
    const ctx = ensureCtx();
    if (!ctx) {
      console.warn('[music] no AudioContext available');
      return;
    }
    // iOS / mobile-Safari can leave the context suspended even after a
    // gesture. Force-resume and AWAIT it so the schedule below actually
    // produces audible output.
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) { /* ignore */ }
    }
    themeKey = gameType;
    themeBPM = spec.bpm;
    themeBeatsPerBar = spec.beatsPerBar;
    themeBeatDur = 60 / themeBPM;
    themeBarDur = themeBeatDur * themeBeatsPerBar;
    themePatternFn = spec.fn;
    themeBarIdx = 0;
    themeStartCt = ctx.currentTime;
    themeNextBarAt = ctx.currentTime + 0.1;     // start almost immediately
    // === Set music volume INSTANTLY to the target — no ramp-from-0. The
    // old fade-in masked the music for ~1.2s which felt like "no music".
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(muted ? 0 : 0.85, ctx.currentTime);
    console.log('[music] 🎵 theme started:', gameType, '@', spec.bpm, 'bpm — gain', muted ? 0 : 0.85, 'ctx.state =', ctx.state);
    // === GUARANTEED-AUDIBLE START CHIME ===
    // Loud short pentatonic burst played via sfxGain (which has its own gain
    // path) so even if musicGain is somehow muted on this device, the user
    // hears a clear "music is starting" cue. If they don't hear THIS, their
    // device is genuinely silent (system mute, Bluetooth, etc.).
    const chimeNotes = [523, 659, 784, 1047];   // C5 E5 G5 C6
    chimeNotes.forEach((f, i) => {
      tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.35, delay: i * 0.07 });
    });
    scheduleThemeAhead();
    themeTimer = setInterval(scheduleThemeAhead, 600);
    // Notify any host page that wants to show a "🎵 Music: …" chip
    try { window.dispatchEvent(new CustomEvent('music-started', { detail: { gameType, bpm: spec.bpm } })); } catch (_) {}
  }
  function stopGameTheme() {
    if (themeTimer) clearInterval(themeTimer);
    themeTimer = null;
    themePatternFn = null;
    themeKey = null;
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
    coinClink() {
      // Bright metallic ting for money gain — high triangle + bell
      tone({ freq: 1760, dur: 0.10, type: 'triangle', vol: 0.35, slideTo: 2640 });
      tone({ freq: 2200, dur: 0.18, type: 'sine',     vol: 0.22, slideTo: 3520, delay: 0.04 });
      tone({ freq: 1320, dur: 0.12, type: 'triangle', vol: 0.18, delay: 0.08 });
    },
    cashRegister() {
      // Cha-ching! For property purchase / big bonus
      tone({ freq: 880,  dur: 0.10, type: 'triangle', vol: 0.30 });
      tone({ freq: 1320, dur: 0.18, type: 'triangle', vol: 0.30, delay: 0.08 });
      tone({ freq: 1760, dur: 0.22, type: 'triangle', vol: 0.28, delay: 0.18 });
      tone({ freq: 2200, dur: 0.28, type: 'sine',     vol: 0.22, delay: 0.30 });
      noise({ dur: 0.10, vol: 0.10, delay: 0.05 });
    },
    dragonRoar() {
      // Low menacing roar — for treasure tile reveal
      tone({ freq: 90,  dur: 0.7, type: 'sawtooth', vol: 0.40, slideTo: 55 });
      tone({ freq: 130, dur: 0.6, type: 'square',   vol: 0.30, slideTo: 70, delay: 0.05 });
      tone({ freq: 60,  dur: 0.9, type: 'sine',     vol: 0.45, slideTo: 38, delay: 0.10 });
      noise({ dur: 0.55, vol: 0.30, delay: 0.04 });
    },
    festival() {
      // Joyful pentatonic burst for festival tiles
      [523, 659, 784, 988, 1175, 1318].forEach((f, i) =>
        tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.28, delay: i * 0.07 })
      );
      tone({ freq: 80, dur: 0.4, type: 'sine', vol: 0.35, delay: 0.1 });
      noise({ dur: 0.4, vol: 0.10, delay: 0.05 });
    },
    jailSlam() {
      // Heavy iron clang + low boom
      noise({ dur: 0.25, vol: 0.45 });
      tone({ freq: 320, dur: 0.10, type: 'square',   vol: 0.35, slideTo: 90 });
      tone({ freq: 60,  dur: 0.5,  type: 'sine',     vol: 0.40, slideTo: 35, delay: 0.08 });
      tone({ freq: 180, dur: 0.20, type: 'sawtooth', vol: 0.25, slideTo: 60, delay: 0.05 });
    },
    titleStamp() {
      // Wet "thunk" of a rubber stamp + paper rustle
      noise({ dur: 0.08, vol: 0.30 });
      tone({ freq: 220, dur: 0.10, type: 'square', vol: 0.40, slideTo: 80 });
      tone({ freq: 880, dur: 0.06, type: 'triangle', vol: 0.20, delay: 0.06 });
    },
    diceLand() {
      // Wooden clatter for dice settling
      noise({ dur: 0.15, vol: 0.22 });
      tone({ freq: 480, dur: 0.06, type: 'square', vol: 0.18 });
      tone({ freq: 320, dur: 0.08, type: 'square', vol: 0.16, delay: 0.05 });
      tone({ freq: 220, dur: 0.10, type: 'square', vol: 0.12, delay: 0.10 });
    },
    crit6() {
      // Triumphant "you rolled a six" jingle
      tone({ freq: 523,  dur: 0.10, type: 'triangle', vol: 0.30 });
      tone({ freq: 659,  dur: 0.10, type: 'triangle', vol: 0.30, delay: 0.08 });
      tone({ freq: 784,  dur: 0.10, type: 'triangle', vol: 0.30, delay: 0.16 });
      tone({ freq: 1047, dur: 0.30, type: 'triangle', vol: 0.35, delay: 0.24 });
      tone({ freq: 1568, dur: 0.30, type: 'sine',     vol: 0.30, delay: 0.30 });
    },
    footstep() {
      // Soft padded step for board walking
      tone({ freq: 180 + Math.random() * 60, dur: 0.05, type: 'sine', vol: 0.18, slideTo: 90 });
      noise({ dur: 0.04, vol: 0.10 });
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
    // Per-game themed background music (procedural). Each game gets its own
    // key/tempo/timbre — call startGameTheme('kingdoms'), startGameTheme('mochi-mash'),
    // etc. after the countdown. Stop with stopGameTheme() — or any of the
    // win/lose/tie helpers, which also stop the theme via stopMusic().
    startGameTheme,
    stopGameTheme,
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
    },

    // ============================ TRIAGE ER sounds ============================
    // All synthesized (WebAudio) — keeps the asset footprint zero while giving
    // the ER ward a distinctive hospital-tech sound palette.
    flatlineAlarm() {
      // Long sustained low tone + harsh sawtooth — the ECG flatline buzz
      tone({ freq: 1000, dur: 1.4, type: 'sawtooth', vol: 0.22 });
      tone({ freq: 500, dur: 1.4, type: 'sine', vol: 0.18 });
      // A small "thunk" at the end to mark patient lost
      tone({ freq: 90, dur: 0.4, type: 'sine', vol: 0.22, delay: 1.4 });
    },
  };

  window.MochiSounds = Sounds;
  window.toggleMute = function () {
    muted = !muted;
    if (audioCtx && sfxGain && musicGain) {
      sfxGain.gain.cancelScheduledValues(audioCtx.currentTime);
      musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
      sfxGain.gain.linearRampToValueAtTime(muted ? 0 : 0.7, audioCtx.currentTime + 0.2);
      // Match the level startGameTheme uses (0.85) so toggling mute doesn't
      // silently halve the music volume.
      musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.85, audioCtx.currentTime + 0.2);
    }
    return muted;
  };
  window.unlockAudio = ensureCtx;
})();
