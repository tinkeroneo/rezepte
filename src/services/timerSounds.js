// src/services/timerSounds.js — WebAudio Synth (no assets)
// Based on a lightweight WebAudio synth approach for offline-friendly timer sounds.

let _ctx;

/** Re-use one AudioContext (important for iOS/Chrome policies) */
export function getAudioCtx() {
  if (_ctx && _ctx.state !== "closed") return _ctx;
  _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

/** Must be called from a user gesture once (click/tap) */
export async function unlockAudio() {
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") await ctx.resume();
}

/** Helpers */
function makeGain(ctx, value = 0.0001) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(value, ctx.currentTime);
  return g;
}

function softClip(ctx, drive = 1.6) {
  // light saturation for warmth
  const ws = ctx.createWaveShaper();
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = Math.tanh(drive * x);
  }
  ws.curve = curve;
  ws.oversample = "4x";
  return ws;
}

function lowpass(ctx, hz) {
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = hz;
  f.Q.value = 0.7;
  return f;
}

function bandpass(ctx, hz, q = 8) {
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

/** A) Warm, clear gong ~2s */
export function playGongWarm2s({ volume = 0.9 } = {}) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  const out = makeGain(ctx, 0.0001);
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(volume, now + 0.03);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 2.05);

  const lp = lowpass(ctx, 4200);
  const sat = softClip(ctx, 1.3);

  // layered partials
  const freqs = [220, 330, 440];
  const oscs = freqs.map((f, idx) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, now);
    // slight downward glide for "gong feel"
    o.frequency.exponentialRampToValueAtTime(f * 0.72, now + 2.0);

    const g = makeGain(ctx, 0.0001);
    const a = [1.0, 0.75, 0.55][idx];
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(a, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.05);

    o.connect(g);
    return { o, g };
  });

  // small noisy strike transient
  const strike = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  strike.buffer = buf;

  const strikeBP = bandpass(ctx, 1200, 4);
  const strikeG = makeGain(ctx, 0.0001);
  strikeG.gain.setValueAtTime(0.25, now);
  strikeG.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  // wiring
  oscs.forEach(({ g }) => g.connect(sat));
  strike.connect(strikeBP).connect(strikeG).connect(sat);

  sat.connect(lp).connect(out).connect(ctx.destination);

  strike.start(now);
  oscs.forEach(({ o }) => o.start(now));
  oscs.forEach(({ o }) => o.stop(now + 2.1));
}

/** B) Deep woodblock ~0.35s */
export function playWoodblockDeep({ volume = 0.85 } = {}) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  const out = makeGain(ctx, 0.0001);
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(volume, now + 0.005);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  const lp = lowpass(ctx, 2600);
  const sat = softClip(ctx, 1.8);

  const o1 = ctx.createOscillator();
  o1.type = "triangle";
  o1.frequency.setValueAtTime(420, now);

  const o2 = ctx.createOscillator();
  o2.type = "sine";
  o2.frequency.setValueAtTime(420 * 2.1, now);

  // transient noise "clack"
  const strike = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2);
  strike.buffer = buf;

  const g = makeGain(ctx, 0.0001);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(1.0, now + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);

  o1.connect(g);
  o2.connect(g);
  strike.connect(g);

  g.connect(sat).connect(lp).connect(out).connect(ctx.destination);

  strike.start(now);
  o1.start(now); o2.start(now);
  o1.stop(now + 0.36); o2.stop(now + 0.36);
}

/** D) Warm long singing bowl ~4.5s */
export function playSingingBowlWarmLong({ volume = 0.7 } = {}) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  const out = makeGain(ctx, 0.0001);
  out.gain.setValueAtTime(0.0001, now);
  out.gain.linearRampToValueAtTime(volume, now + 0.25);     // slow attack
  out.gain.exponentialRampToValueAtTime(0.0001, now + 4.6); // long decay

  const lp = lowpass(ctx, 3800);
  const sat = softClip(ctx, 1.25);

  const f0 = 196; // warm base

  const partials = [
    [1.00, 1.00],
    [0.60, 2.05],
    [0.40, 2.98],
    [0.25, 4.10],
    [0.18, 5.43],
  ];

  const sum = ctx.createGain();
  sum.gain.value = 0.9;

  // subtle detune/chorus
  const detunes = [0, +0.003, -0.003];

  const oscs = [];
  for (const [amp, ratio] of partials) {
    for (const d of detunes) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f0 * ratio * (1 + d), now);

      const g = makeGain(ctx, 0.0001);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(amp * 0.25, now + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4.6);

      o.connect(g).connect(sum);
      oscs.push(o);
    }
  }

  sum.connect(sat).connect(lp).connect(out).connect(ctx.destination);

  oscs.forEach(o => o.start(now));
  oscs.forEach(o => o.stop(now + 4.7));
}

/** C) Simple electronic pulse (short + clear) */
export function playPulseElectronic({ volume = 0.75 } = {}) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  const out = makeGain(ctx, 0.0001);
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(880, now);
  o.frequency.exponentialRampToValueAtTime(660, now + 0.18);

  const g = makeGain(ctx, 0.0001);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  o.connect(g).connect(out).connect(ctx.destination);
  o.start(now);
  o.stop(now + 0.25);
}
