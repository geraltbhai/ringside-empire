"use client";
/**
 * Original sound effects synthesised with the Web Audio API (no audio files):
 * hits, mat slams, the ring bell, referee counts and a crowd bed that swells with heat.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let crowd: { gain: GainNode; filter: BiquadFilterNode; src: AudioBufferSourceNode } | null = null;
let enabled = true;

function audio() {
  if (!enabled || typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (!on) stopCrowd();
}

/** Strike or slam. `power` 0..1. */
export function hit(power: number) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  // body thump
  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140 + power * 40, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  og.gain.setValueAtTime(0.55 + power * 0.45, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.22 + power * 0.15);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + 0.45);
  // slap
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 0.2);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1400 - power * 600;
  f.Q.value = 0.8;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.4 + power * 0.3, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09 + power * 0.12);
  n.connect(f).connect(ng).connect(master);
  n.start(t);
}

/** Ring bell, rung `times` times. */
export function bell(times = 3) {
  const c = audio();
  if (!c || !master) return;
  for (let k = 0; k < times; k++) {
    const t = c.currentTime + k * 0.28;
    for (const [freq, amp] of [
      [880, 0.35],
      [1320, 0.18],
      [2200, 0.08],
    ] as const) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 1.2);
    }
  }
}

/** Referee's hand on the mat. */
export function matSlap() {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 0.15);
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  const g = c.createGain();
  g.gain.setValueAtTime(0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  n.connect(f).connect(g).connect(master);
  n.start(t);
}

export function startCrowd() {
  const c = audio();
  if (!c || !master || crowd) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 3);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700;
  filter.Q.value = 0.4;
  const gain = c.createGain();
  gain.gain.value = 0.04;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  crowd = { gain, filter, src };
}

/** heat 0..1 — louder and brighter as the match heats up. */
export function setCrowdHeat(heat: number) {
  if (!crowd || !ctx) return;
  const t = ctx.currentTime;
  crowd.gain.gain.setTargetAtTime(0.03 + heat * 0.12, t, 0.3);
  crowd.filter.frequency.setTargetAtTime(500 + heat * 900, t, 0.3);
}

/** Short roar for near-falls and finishers. */
export function pop(strength = 1) {
  if (!crowd || !ctx) return;
  const t = ctx.currentTime;
  crowd.gain.gain.cancelScheduledValues(t);
  crowd.gain.gain.setValueAtTime(crowd.gain.gain.value, t);
  crowd.gain.gain.linearRampToValueAtTime(0.12 + strength * 0.18, t + 0.15);
  crowd.gain.gain.setTargetAtTime(0.06, t + 0.6, 0.8);
}

export function stopCrowd() {
  try {
    crowd?.src.stop();
  } catch {
    /* already stopped */
  }
  crowd = null;
}

function noiseBurst(c: AudioContext, out: AudioNode, t: number, opts: { dur: number; gain: number; type: BiquadFilterType; freq: number; q?: number; sweepTo?: number }) {
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, opts.dur + 0.05);
  const f = c.createBiquadFilter();
  f.type = opts.type;
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + opts.dur);
  f.Q.value = opts.q ?? 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + Math.min(0.03, opts.dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
  n.connect(f).connect(g).connect(out);
  n.start(t);
  n.stop(t + opts.dur + 0.05);
}

function tone(c: AudioContext, out: AudioNode, t: number, opts: { type: OscillatorType; from: number; to: number; dur: number; gain: number; attack?: number }) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type;
  o.frequency.setValueAtTime(opts.from, t);
  o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + opts.dur + 0.05);
}

/** Air swing before a strike lands. */
export function whoosh(power = 0.5) {
  const c = audio();
  if (!c || !master) return;
  noiseBurst(c, master, c.currentTime, { dur: 0.16 + power * 0.1, gain: 0.12 + power * 0.12, type: "bandpass", freq: 500, sweepTo: 2200 + power * 1200, q: 1.4 });
}

/** A body hitting the canvas: deep thud, ring-frame boom and a mat rattle. */
export function bodyFall(power = 0.7) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  tone(c, master, t, { type: "sine", from: 95 + power * 20, to: 38, dur: 0.35 + power * 0.25, gain: 0.7 + power * 0.3 });
  tone(c, master, t + 0.01, { type: "triangle", from: 70, to: 52, dur: 0.6 + power * 0.4, gain: 0.18 + power * 0.12, attack: 0.02 });
  noiseBurst(c, master, t, { dur: 0.18 + power * 0.12, gain: 0.5 + power * 0.25, type: "lowpass", freq: 650 });
  noiseBurst(c, master, t + 0.04, { dur: 0.25, gain: 0.08, type: "bandpass", freq: 3200, q: 3 });
}

/** Rope stretch and twang. */
export function rope(power = 0.5) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(82, t);
  o.frequency.linearRampToValueAtTime(96, t + 0.08);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.5);
  f.type = "lowpass";
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(220, t + 0.45);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12 + power * 0.18, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.6);
  noiseBurst(c, master, t, { dur: 0.12, gain: 0.08 + power * 0.08, type: "bandpass", freq: 1800, q: 2 });
}

/** Boots on the canvas while running. */
export function footstep() {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  tone(c, master, t, { type: "sine", from: 120, to: 60, dur: 0.09, gain: 0.16 });
  noiseBurst(c, master, t, { dur: 0.06, gain: 0.05, type: "lowpass", freq: 900 });
}

/** Crowd "ooooh" after a big spot. */
export function ooh(strength = 1) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  for (const [freq, gain] of [
    [420, 0.12],
    [820, 0.07],
  ] as const) {
    const n = c.createBufferSource();
    n.buffer = noiseBuffer(c, 1.3);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 6;
    f.frequency.setValueAtTime(freq * 1.15, t);
    f.frequency.exponentialRampToValueAtTime(freq * 0.85, t + 1.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * strength * 2.2, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    n.connect(f).connect(g).connect(master);
    n.start(t);
    n.stop(t + 1.3);
  }
}

/** Rhythmic crowd clapping for a hot crowd: clap, clap, clap-clap-clap. */
export function crowdClap() {
  const c = audio();
  if (!c || !master) return;
  const beats = [0, 0.42, 0.84, 1.05, 1.26];
  for (let bar = 0; bar < 2; bar++)
    for (const b of beats) {
      const t = c.currentTime + bar * 1.7 + b;
      for (let k = 0; k < 4; k++) noiseBurst(c, master, t + k * 0.012, { dur: 0.07, gain: 0.05, type: "highpass", freq: 1200 + k * 300 });
    }
}

/** Stinger when a finisher is ready. */
export function stinger() {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  for (const [i, freq] of [220, 277, 330, 440].entries()) tone(c, master, t + i * 0.05, { type: "sawtooth", from: freq, to: freq * 1.01, dur: 0.7, gain: 0.05, attack: 0.02 });
  tone(c, master, t, { type: "sine", from: 60, to: 40, dur: 0.6, gain: 0.4 });
}

let distortion: WaveShaperNode | null = null;
function drive(c: AudioContext) {
  if (distortion && distortion.context === c) return distortion;
  distortion = c.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / curve.length) * 2 - 1;
    curve[i] = Math.tanh(x * 4);
  }
  distortion.curve = curve;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  const g = c.createGain();
  g.gain.value = 0.16;
  distortion.connect(lp).connect(g).connect(master!);
  return distortion;
}

/** Entrance: pyro blast, then a short distorted power-chord riff. */
export function entrance() {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime;
  tone(c, master, t, { type: "sine", from: 70, to: 30, dur: 1.2, gain: 0.9 });
  noiseBurst(c, master, t, { dur: 1.4, gain: 0.55, type: "lowpass", freq: 1800, sweepTo: 200 });
  const dist = drive(c);
  // E5 power chord riff: root + fifth, palm-muted chugs then an open hit.
  const riff: [number, number, number][] = [
    [0.5, 82.4, 0.14], [0.68, 82.4, 0.14], [0.86, 82.4, 0.14], [1.04, 98, 0.3],
    [1.4, 82.4, 0.14], [1.58, 82.4, 0.14], [1.76, 110, 0.3], [2.1, 98, 0.3], [2.45, 82.4, 1.3],
  ];
  for (const [at, root, dur] of riff) {
    for (const freq of [root, root * 1.5, root * 2]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sawtooth";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.35, t + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + dur);
      o.connect(g).connect(dist);
      o.start(t + at);
      o.stop(t + at + dur + 0.05);
    }
    tone(c, master, t + at, { type: "sine", from: 120, to: 50, dur: 0.12, gain: 0.35 });
  }
}
