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
