// «¡Rápido!» · the hurry moment's sounds (2026-10-19, his words on Las Trampillas: "when the game is 30 seconds before
// ending … it should be like a hurry up, hurry up kind of sound, or maybe a Mario Party sound"). Built from the free CC0
// Kenney packs on this PC (never Nintendo's audio): only the outputs go in git, the packs stay in assets-library.
//
//   node scripts/hurry-sounds.js                 every sound (public/assets/party/<name>.mp3)
//   node scripts/hurry-sounds.js --only hurry    some of them
//   options: --lib <Kenney Audio folder>  --out <folder>
//
// What they are (the music itself is not a file: each projector plays its own game music faster and higher, js/party.js
// DralyParty.hurryMusic):
//   hurry   the «¡Rápido!» jingle, 1.6 s: the chiptune whole-tone run of Kenney's Retro jingles (the same 8-bit family as
//           Las Trampillas' Retro Beat), twice and a major third higher the second time, over rising toms, then two
//           high alarm stabs: «brrrrrp · BRRRRP · ¡bip-bip!»
//   tick / tock   a clock's tick and its lower tock (Interface Sounds): the count that speeds up in the last stretch.
//           Since 2026-10-23 the games play tick-v2.mp3 / tock-v2.mp3 instead (woodblock knocks made on Higgsfield
//           Supercomputer · Mirelo, originals in assets-library/higgsfield/2026-10-23/end-sounds/), and «¡FINAL!» plays
//           final-v2.mp3 (a referee's whistle + the crowd's «ohh!», was halcon/final.mp3): this script still makes the
//           old Kenney tick.mp3 / tock.mp3, kept for comparison. The hurry jingle stays this script's (the Mirelo
//           jingle takes came out weaker).
// Every sound: inputs brought to the same peak, mixed, the mix to −1 dB and limited to −4 dB (mp3 rings over sharp
// clicks: a −1 dB file can decode above 0 dB and clip on phones). The game code sets the volumes.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const LIB = opt('lib', path.resolve(__dirname, '../../assets-library/kenney/Kenney Game Assets All-in-1 3.7.0/Audio'));
const OUT = path.resolve(opt('out', path.join(__dirname, '../public/assets/party')));
const ONLY = opt('only', '') ? opt('only', '').split(',') : null;
const FF = process.env.FFMPEG || 'ffmpeg';
const SR = 44100;

function ff(argv) {
  const r = spawnSync(FF, ['-hide_banner', '-nostdin', '-y'].concat(argv), { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + argv.join(' ') + '\n' + String(r.stderr).slice(-1500));
  return r;
}
function peakDb(file) {
  const r = ff(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = /max_volume: (-?[\d.]+) dB/.exec(String(r.stderr));
  return m ? +m[1] : 0;
}
function meanDb(file) {
  const r = ff(['-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = /mean_volume: (-?[\d.]+) dB/.exec(String(r.stderr));
  return m ? +m[1] : 0;
}

const RJ = 'Music Jingles/Audio (Retro)/', HJ = 'Music Jingles/Audio (Hit)/', IF = 'Interface Sounds/Audio/';
const THIRD = Math.pow(2, 4 / 12), OCT = 2;                       // a major third up, an octave up
const SOUNDS = {
  // «brrrrrp» (C E F# G# A#) · «BRRRRP» a third higher · two «¡bip!» on the next whole tone up (E5), over three rising
  // toms each time and a last hit under the stabs
  hurry: { inputs: [
    { f: RJ + 'jingles-retro_11.ogg', t: 0.62, vol: 0.9 },
    { f: HJ + 'jingles-hit_00.ogg', vol: 0.55 },
    { f: RJ + 'jingles-retro_11.ogg', rate: THIRD, t: 0.62, delay: 600, vol: 0.95 },
    { f: HJ + 'jingles-hit_00.ogg', rate: THIRD, delay: 600, vol: 0.6 },
    { f: RJ + 'jingles-retro_08.ogg', rate: OCT * Math.pow(2, 1 / 12), t: 0.16, delay: 1150, vol: 1 },   // D#4 → E5
    { f: RJ + 'jingles-retro_08.ogg', rate: OCT * Math.pow(2, 1 / 12), t: 0.3, delay: 1330, vol: 1 },
    { f: HJ + 'jingles-hit_07.ogg', rate: 1.5, delay: 1330, vol: 0.5 },
  ], post: 'afade=t=out:st=1.5:d=0.12', t: 1.62 },
  tick: { inputs: [{ f: IF + 'tick_004.ogg', vol: 1 }], t: 0.06 },
  tock: { inputs: [{ f: IF + 'tick_004.ogg', rate: 0.75, af: 'lowpass=f=3500', vol: 1 }], t: 0.08 },
};

function build(name, r) {
  const tmp = path.join(os.tmpdir(), 'hurry-sfx-' + process.pid + '-' + name + '.wav');
  const argv = [];
  const chains = [];
  r.inputs.forEach((x, i) => {
    const file = path.join(LIB, x.f);
    if (!fs.existsSync(file)) throw new Error('missing ' + file);
    argv.push('-i', file);
    const g = (x.vol || 1) * Math.pow(10, -peakDb(file) / 20);              // every input to peak 0 dB, then its share
    const parts = [`aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=mono`];
    if (x.rate && x.rate !== 1) parts.push(`asetrate=${Math.round(SR * x.rate)}`, `aresample=${SR}`);   // faster AND higher
    if (x.t) parts.push(`atrim=duration=${x.t}`, 'asetpts=PTS-STARTPTS', `afade=t=out:st=${Math.max(0, x.t - 0.04).toFixed(3)}:d=0.04`);
    if (x.af) parts.push(x.af);
    parts.push(`volume=${g.toFixed(4)}`);
    if (x.delay) parts.push(`adelay=delays=${x.delay}:all=1`);
    chains.push(`[${i}:a]${parts.join(',')}[a${i}]`);
  });
  const n = r.inputs.length;
  let graph = chains.join(';') + ';' + r.inputs.map((_, i) => `[a${i}]`).join('') + (n > 1 ? `amix=inputs=${n}:normalize=0:duration=longest` : 'anull');
  graph += `,apad=pad_dur=${r.t || 1},atrim=duration=${r.t || 2}` + (r.post ? ',' + r.post : '') + '[o]';
  ff(argv.concat(['-filter_complex', graph, '-map', '[o]', '-c:a', 'pcm_f32le', tmp]));
  const gain = -1 - peakDb(tmp);
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, name + '.mp3');
  ff(['-i', tmp, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.63:attack=0.5:release=30:level=0`, '-ac', '1', '-ar', String(SR), '-c:a', 'libmp3lame', '-b:a', '96k', out]);
  fs.unlinkSync(tmp);
  const st = fs.statSync(out);
  console.log(`${name.padEnd(6)} ${(st.size / 1024).toFixed(1)} KB · peak ${peakDb(out).toFixed(1)} dB · mean ${meanDb(out).toFixed(1)} dB`);
}

Object.entries(SOUNDS).forEach(([name, r]) => { if (!ONLY || ONLY.includes(name)) build(name, r); });
