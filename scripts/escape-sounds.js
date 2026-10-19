// La Gran Fuga · the chase pass (2026-10-19): builds the game's sounds from the free CC0 Kenney packs on this PC and the
// projector's chase-music loop from a track he picked (Pixabay Content License: only inside the game's assets, never a
// standalone download). Only the outputs go in git; the packs and the full tracks stay in assets-library.
//
//   node scripts/escape-sounds.js                       every sound effect (public/assets/escape/<name>.mp3)
//   node scripts/escape-sounds.js --only siren,step     some of them
//   node scripts/escape-sounds.js --music <track.mp3>   the chase loop: finds the tempo, cuts 60-90 s on whole
//                                                       phrases where the end flows back into the start, writes
//                                                       music-chase.mp3 and prints the line for host-escape.js MUSIC
//   options: --lib <Kenney Audio folder>  --out <folder>  --name music-chase  --min 60 --max 90  --kbps 112
//
// Why: the old zap.mp3 peaked at −24 dB (inaudible under the music), glitch.mp3 lasted 27 ms, turbo / super −15 / −18 dB.
// Every effect here is mixed to −1 dB and limited to −4 dB (mp3 rings over metal clanks); the game code sets the volumes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const LIB = opt('lib', path.resolve(__dirname, '../../assets-library/kenney/Kenney Game Assets All-in-1 3.7.0/Audio'));
const OUT = path.resolve(opt('out', path.join(__dirname, '../public/assets/escape')));
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const FF = process.env.FFMPEG || 'ffmpeg';
const SR = 44100;

function ff(argv, input) {
  const r = spawnSync(FF, ['-hide_banner', '-nostdin', '-y'].concat(argv), { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + argv.join(' ') + '\n' + String(r.stderr).slice(-1500));
  return r;
}
// the loudest sample of (a part of) a file, in dB
function peakDb(file, ss, t) {
  const a = ['-i', file];
  if (ss) a.unshift('-ss', String(ss));
  if (t) a.push('-t', String(t));
  const r = ff(a.concat(['-af', 'volumedetect', '-f', 'null', '-']));
  const m = /max_volume: (-?[\d.]+) dB/.exec(String(r.stderr));
  return m ? +m[1] : 0;
}

// ---------- the sound effects: each a small mix of Kenney sounds (every input first brought to the same peak) ----------
const DA = 'Digital Audio/Audio/', SF = 'Sci-Fi Sounds/Audio/', IM = 'Impact Sounds/Audio/', IF = 'Interface Sounds/Audio/',
  RS1 = 'Retro Sounds 1/Audio/', RS2 = 'Retro Sounds 2/Audio/', WO = 'Foley Sounds/Audio/Woosh/';
const SFX = {
  // Robotín reaches me: his zap (the retro zap) inside an electric buzz, a crackle that flickers, and a snap
  'zap-crackle': { inputs: [
    { f: DA + 'zap2.ogg', vol: 0.9 },
    { f: SF + 'forceField_002.ogg', vol: 0.6 },
    { f: SF + 'computerNoise_001.ogg', t: 1.05, af: 'highpass=f=1800,tremolo=f=22:d=0.85', vol: 0.5 },
    { f: SF + 'explosionCrunch_000.ogg', t: 0.32, af: 'afade=t=out:st=0.18:d=0.14', vol: 0.55 },
  ], post: 'afade=t=out:st=0.78:d=0.37', t: 1.15 },
  // his sparks / glitch (was a 27 ms click): a short crackle with a zip
  spark: { inputs: [
    { f: SF + 'computerNoise_002.ogg', ss: 0.3, t: 0.42, af: 'highpass=f=1300,tremolo=f=30:d=0.9', vol: 0.8 },
    { f: DA + 'zap1.ogg', t: 0.42, vol: 0.55 },
    { f: IF + 'glitch_002.ogg', vol: 0.8 },
  ], post: 'afade=t=out:st=0.26:d=0.16', t: 0.42 },
  // his lunge: a wee-woo siren over his motor revving
  siren: { inputs: [
    { f: DA + 'highUp.ogg', vol: 0.8 },
    { f: DA + 'highDown.ogg', delay: 480, vol: 0.8 },
    { f: DA + 'highUp.ogg', delay: 940, vol: 0.75 },
    { f: RS1 + 'radar1.ogg', t: 1.4, vol: 0.3 },
    { f: SF + 'engineCircular_001.ogg', t: 1.55, af: 'lowpass=f=500', vol: 0.5 },
  ], post: 'afade=t=in:d=0.02,afade=t=out:st=1.25:d=0.3', t: 1.55 },
  // one clank of his treads coming (a metal clank, a thud, a little servo rumble); played faster and louder as he nears
  step: { inputs: [
    { f: IM + 'impactMetal_light_001.ogg', vol: 0.55 },
    { f: IM + 'footstep_concrete_000.ogg', vol: 1 },
    { f: SF + 'engineCircular_000.ogg', t: 0.24, af: 'lowpass=f=350,afade=t=out:st=0.1:d=0.14', vol: 0.35 },
  ], post: 'afade=t=out:st=0.16:d=0.08', t: 0.24 },
  // my heartbeat when he is close: lub (a soft heavy thump) – dub (a lighter one), both low
  heartbeat: { inputs: [
    { f: IM + 'impactSoft_heavy_000.ogg', af: 'lowpass=f=160', vol: 1 },
    { f: IM + 'impactSoft_medium_000.ogg', af: 'lowpass=f=220', delay: 170, vol: 0.75 },
  ], post: 'afade=t=out:st=0.44:d=0.16', t: 0.6 },
  // a right answer: I dash away (relief)
  dash: { inputs: [
    { f: WO + 'woosh4.ogg', vol: 1 },
    { f: WO + 'woosh6.ogg', delay: 40, af: 'highpass=f=400', vol: 0.5 },
  ], post: 'afade=t=out:st=0.34:d=0.1', t: 0.44 },
  // a wrong answer: I stumble (a thud) and his motor revs closer
  stumble: { inputs: [
    { f: IM + 'impactPunch_medium_000.ogg', vol: 1 },
    { f: DA + 'phaserUp1.ogg', delay: 110, vol: 0.75 },
  ], post: 'afade=t=out:st=0.42:d=0.12', t: 0.55 },
  // the shield after a zap: a bubble that rises
  shield: { inputs: [
    { f: SF + 'forceField_003.ogg', af: 'highpass=f=500', vol: 0.65 },
    { f: DA + 'powerUp2.ogg', delay: 60, vol: 0.85 },
  ], post: 'afade=t=out:st=0.5:d=0.3', t: 0.8 },
  // he trips (reached me inside his 45 s, or out of breath after a lunge): a metal crash and a falling «piu»
  trip: { inputs: [
    { f: IM + 'impactMetal_medium_000.ogg', vol: 0.9 },
    { f: IM + 'impactPlate_light_000.ogg', delay: 90, vol: 0.7 },
    { f: RS2 + 'fall1.ogg', delay: 60, vol: 0.45 },
  ], post: 'afade=t=out:st=0.5:d=0.15', t: 0.65 },
  // the old turbo / súper turbo / heart-lost sounds, the same Kenney sources, at a level kids can hear
  'turbo-v2': { inputs: [{ f: DA + 'phaserUp3.ogg', vol: 1 }], t: 0.46 },
  'super-v2': { inputs: [{ f: DA + 'powerUp7.ogg', vol: 1 }], t: 0.5 },
  'heart-v2': { inputs: [{ f: DA + 'lowDown.ogg', vol: 1 }], t: 0.76 },
};

function buildSfx(name, r) {
  const tmp = path.join(os.tmpdir(), 'escape-sfx-' + process.pid + '-' + name + '.wav');
  const argv = [];
  const chains = [];
  r.inputs.forEach((x, i) => {
    const file = path.join(LIB, x.f);
    if (!fs.existsSync(file)) throw new Error('missing ' + file);
    argv.push('-i', file);
    const g = (x.vol || 1) * Math.pow(10, -peakDb(file, x.ss, x.t) / 20);       // every input to peak 0 dB, then its share
    const parts = [];
    if (x.ss || x.t) parts.push(`atrim=start=${x.ss || 0}${x.t ? ':duration=' + x.t : ''}`, 'asetpts=PTS-STARTPTS');
    parts.push(`aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=mono`);
    if (x.af) parts.push(x.af);
    parts.push(`volume=${g.toFixed(4)}`);
    if (x.delay) parts.push(`adelay=delays=${x.delay}:all=1`);
    chains.push(`[${i}:a]${parts.join(',')}[a${i}]`);
  });
  const n = r.inputs.length;
  let graph = chains.join(';') + ';' + r.inputs.map((_, i) => `[a${i}]`).join('') + (n > 1 ? `amix=inputs=${n}:normalize=0:duration=longest` : 'anull');
  graph += `,atrim=duration=${r.t || 2}` + (r.post ? ',' + r.post : '') + '[o]';
  ff(argv.concat(['-filter_complex', graph, '-map', '[o]', '-c:a', 'pcm_f32le', tmp]));
  const gain = -1 - peakDb(tmp);                                                   // the mix to −1 dB, then a limiter at −4 dB:
  // (mp3 rings over sharp metal clanks: a −1 dB file decoded to +4 dB, clipped on phones)
  const out = path.join(OUT, name + '.mp3');
  ff(['-i', tmp, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.63:attack=0.5:release=30:level=0`, '-ac', '1', '-ar', String(SR), '-c:a', 'libmp3lame', '-b:a', '96k', out]);
  fs.unlinkSync(tmp);
  const st = fs.statSync(out);
  console.log(`${name.padEnd(12)} ${(st.size / 1024).toFixed(1)} KB · peak ${peakDb(out).toFixed(1)} dB`);
}

// ---------- the chase loop ----------
function decode(file, sr, ch) {
  const r = ff(['-i', file, '-ac', String(ch), '-ar', String(sr), '-f', 'f32le', '-']);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}
// iterative radix-2 FFT (re, im in place)
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
function buildMusic(track, name, minS, maxS, kbps) {
  const ASR = 11025, N = 1024, HOP = 128, NB = 20;
  const x = decode(track, ASR, 1);
  const frames = Math.floor((x.length - N) / HOP);
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const flux = new Float32Array(frames), rms = new Float32Array(frames);
  const bands = [];                       // log-spaced bands, 40 Hz .. 5 kHz
  for (let b = 0; b <= NB; b++) bands.push(Math.round(40 * Math.pow(5000 / 40, b / NB) / (ASR / N)));
  const feat = new Array(frames);
  let prev = new Float32Array(N / 2);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = 0; i < N; i++) { const v = x[f * HOP + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
    rms[f] = Math.sqrt(e / N);
    fft(re, im);
    const mag = new Float32Array(N / 2);
    let fl = 0;
    for (let k = 1; k < N / 2; k++) { mag[k] = Math.log1p(100 * Math.hypot(re[k], im[k])); const d = mag[k] - prev[k]; if (d > 0) fl += d; }
    flux[f] = fl;
    prev = mag;
    const fv = new Float32Array(NB);
    for (let b = 0; b < NB; b++) { let s = 0; for (let k = Math.max(1, bands[b]); k < Math.max(bands[b] + 1, bands[b + 1]); k++) s += mag[k]; fv[b] = s / Math.max(1, bands[b + 1] - bands[b]); }
    feat[f] = fv;
  }
  // the onset envelope minus its local mean
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0, c = 0; for (let j = Math.max(0, f - 20); j < Math.min(frames, f + 21); j++) { s += flux[j]; c++; } env[f] = Math.max(0, flux[f] - s / c); }
  // the tempo: the autocorrelation peak between 80 and 170 BPM (frames per beat), refined
  const fps = ASR / HOP;
  let best = 0, bestLag = 0;
  const ac = (lag) => { let s = 0; for (let f = 0; f + lag < frames; f++) s += env[f] * env[f + lag]; return s / (frames - lag); };
  for (let lag = Math.floor(fps * 60 / 170); lag <= Math.ceil(fps * 60 / 80); lag++) { const v = ac(lag) + 0.5 * ac(lag * 2); if (v > best) { best = v; bestLag = lag; } }
  // sub-frame period: the best over a fine grid around it, by comb-filter strength over the whole track
  let P = bestLag, phase = 0, bestComb = -1;
  for (let p = bestLag - 1; p <= bestLag + 1; p += 0.005) {
    for (let ph = 0; ph < p; ph += 0.5) {
      let s = 0, c = 0;
      for (let t = ph; t < frames; t += p) { s += env[Math.round(t)] || 0; c++; }
      s /= c;
      if (s > bestComb) { bestComb = s; P = p; phase = ph; }
    }
  }
  const beatS = P / fps, bpm = 60 / beatS;
  const nBeats = Math.floor((frames - phase) / P);
  // a feature per beat (its bands' mean) and its loudness
  const bf = [], be = [];
  for (let b = 0; b < nBeats; b++) {
    const f0 = Math.round(phase + b * P), f1 = Math.round(phase + (b + 1) * P);
    const v = new Float32Array(NB); let e = 0, c = 0;
    for (let f = f0; f < Math.min(frames, f1); f++) { for (let k = 0; k < NB; k++) v[k] += feat[f][k]; e += rms[f]; c++; }
    for (let k = 0; k < NB; k++) v[k] /= Math.max(1, c);
    bf.push(v); be.push(e / Math.max(1, c));
  }
  const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let k = 0; k < NB; k++) { d += a[k] * b[k]; na += a[k] * a[k]; nb += b[k] * b[k]; } return d / Math.sqrt(na * nb + 1e-12); };
  const maxE = Math.max(...be);
  // the loop: whole phrases (multiples of 32 beats = 8 bars, else 16), 60-90 s; the 8 beats after its end must sound
  // like its first 8 (so the end flows back into the start), in the loud part of the track (the chase, not the intro)
  const lens = [];
  for (const unit of [32, 16]) { if (!lens.length) for (let L = unit; L * beatS <= maxS; L += unit) if (L * beatS >= minS) lens.push(L); }
  if (!lens.length) throw new Error(`no loop of whole phrases fits ${minS}-${maxS} s at ${bpm.toFixed(1)} BPM`);
  // the bar's first beat: the beat of the four whose low end (the kick, bands under ~110 Hz) is the strongest; the loop
  // starts only there (never a cut mid-bar), a little preference for the start of a 4-bar phrase
  const low = bf.map((v) => v[0] + v[1] + v[2] + v[3]);
  const acc = [0, 0, 0, 0];
  low.forEach((x, b) => { acc[b % 4] += x; });
  const down = acc.indexOf(Math.max(...acc));
  let pick = null;
  const skipB = Math.ceil(4 / beatS);
  lens.forEach((L) => {
    for (let b = skipB; b + L + 8 < nBeats - 2; b++) {
      if (b % 4 !== down) continue;
      let s = 0;
      for (let k = 0; k < 8; k++) s += cos(bf[b + k], bf[b + L + k]);
      s /= 8;
      let e = 0, lo = 1;
      for (let k = 0; k < L; k++) { e += be[b + k]; lo = Math.min(lo, be[b + k] / maxE); }
      e /= L * maxE;
      const score = s * 2 + e * 1.5 - (lo < 0.12 ? 0.3 : 0) + (L % 32 === 0 ? 0.02 : 0) + ((b - down) % 16 === 0 ? 0.03 : 0);
      if (!pick || score > pick.score) pick = { b, L, score, sim: s, energy: e };
    }
  });
  const startS = (phase + pick.b * P) / fps, loopS = pick.L * beatS;
  console.log(`${path.basename(track)}: ${bpm.toFixed(2)} BPM · loop ${pick.L} beats = ${loopS.toFixed(3)} s from ${startS.toFixed(3)} s · end→start likeness ${pick.sim.toFixed(3)} · loudness ${pick.energy.toFixed(2)}`);
  if (args.includes('--debug')) { const bars = []; for (let b = down; b + 4 <= nBeats; b += 4) bars.push(Math.round(9 * (be[b] + be[b + 1] + be[b + 2] + be[b + 3]) / 4 / maxE)); console.log('bar loudness 0-9 (bars from beat', down + '):', bars.join(''), '· loop starts at bar', ((pick.b - down) / 4).toFixed(2)); }
  // cut it at full quality: y = the loop with its first 40 ms crossfaded from what follows its end (seamless), then
  // written with 0.25 s of itself before and after (a player that skips the encoder's padding lands on the same music)
  const full = decode(track, SR, 2);
  const s0 = Math.round(startS * SR), Ls = Math.round(loopS * SR), XF = Math.round(0.04 * SR), PRE = Math.round(0.25 * SR);
  const y = new Float32Array(Ls * 2);
  for (let i = 0; i < Ls; i++) for (let c = 0; c < 2; c++) {
    let v = full[(s0 + i) * 2 + c] || 0;
    if (i < XF) { const u = i / XF; v = v * Math.sin(u * Math.PI / 2) + (full[(s0 + Ls + i) * 2 + c] || 0) * Math.cos(u * Math.PI / 2); }
    y[i * 2 + c] = v;
  }
  const outBuf = new Float32Array((Ls + 2 * PRE) * 2);
  for (let i = 0; i < Ls + 2 * PRE; i++) { const j = ((i - PRE) % Ls + Ls) % Ls; outBuf[i * 2] = y[j * 2]; outBuf[i * 2 + 1] = y[j * 2 + 1]; }
  // the seam: how big the jump from the loop's last sample to its first is, next to the music's own sample steps
  let step = 0; for (let i = 1; i < Ls; i++) step += Math.abs(y[i * 2] - y[i * 2 - 2]); step /= Ls;
  const seam = Math.abs(y[0] - y[(Ls - 1) * 2]);
  console.log(`seam jump ${seam.toFixed(4)} (the music's average step ${step.toFixed(4)})`);
  const out = path.join(OUT, name + '.mp3');
  ff(['-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, out], Buffer.from(outBuf.buffer));
  const st = fs.statSync(out);
  console.log(`${path.relative(process.cwd(), out)} · ${(st.size / 1048576).toFixed(2)} MB`);
  console.log(`host-escape.js MUSIC: chase: { src: ES + '${name}.mp3', pre: 0.25, loop: ${(Ls / SR).toFixed(4)} },   // ${path.basename(track)}, ${bpm.toFixed(1)} BPM`);
}

if (opt('music', null)) buildMusic(opt('music'), opt('name', 'music-chase'), +opt('min', 60), +opt('max', 90), +opt('kbps', 112));
else Object.keys(SFX).filter((k) => !ONLY || ONLY.includes(k)).forEach((k) => buildSfx(k, SFX[k]));
