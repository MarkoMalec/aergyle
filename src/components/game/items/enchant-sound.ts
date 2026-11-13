/**
 * The sound of an enchant attempt: a forge at work. While the bench charges,
 * a smith hammers the anvil (recorded hits, played at random until the
 * server answers); the result is a synthesised blow that rings (success) or
 * lands dead and goes out in steam (failure). The result sounds belong to
 * what the bench draws (EnchantPanel, and the enchant-* keyframes in
 * tailwind.config.ts).
 */
import {
  BURST_RINGS_MS,
  DRAIN_HOLD_MS,
  DRAIN_MS,
  SPARK_COUNT,
  sparkDelayMs,
} from "./enchant-timing";

/** Spark `i` flies out at its own angle: put its sound on that side. */
const sparkPan = (i: number) => Math.cos((i / SPARK_COUNT) * 2 * Math.PI) * 0.8;

type Struck = { peak: number; decay: number; attack?: number; pan?: number };

/** `seconds` of noise, each sample scaled by `level(i)`. */
function noiseBuffer(
  ctx: BaseAudioContext,
  seconds: number,
  level: (i: number) => number,
) {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * level(i);
  return buffer;
}

const whiteNoise = (ctx: BaseAudioContext) => noiseBuffer(ctx, 2, () => 1);

/** Fire crackle: scattered pops of every size, each a few ms long. */
function crackle(ctx: BaseAudioContext) {
  const keep = Math.exp(-1 / (0.003 * ctx.sampleRate));
  let level = 0;
  return noiseBuffer(ctx, 3, () => {
    if (Math.random() < 18 / ctx.sampleRate) level = Math.max(level, Math.random() ** 3);
    return (level *= keep);
  });
}

/** A looping noise through a filter. */
function filtered(
  ctx: BaseAudioContext,
  noise: AudioBuffer,
  type: BiquadFilterType,
  f: number,
  q = 1,
) {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = f;
  filter.Q.value = q;
  source.connect(filter);
  return { source, filter };
}

/** Plays `source` (heard through `tail`) as one struck sound that dies away. */
function strike(
  ctx: BaseAudioContext,
  out: AudioNode,
  source: AudioScheduledSourceNode,
  tail: AudioNode,
  at: number,
  { peak, decay, attack = 0.004, pan = 0 }: Struck,
) {
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(peak, at + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  tail.connect(envelope).connect(panner).connect(out);
  source.start(at);
  source.stop(at + attack + decay);
}

/** One struck partial; `to` lets a thud sag as it dies. */
function tone(
  ctx: BaseAudioContext,
  out: AudioNode,
  at: number,
  {
    f,
    to,
    type = "sine",
    ...struck
  }: Struck & { f: number; to?: number; type?: OscillatorType },
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + struck.decay);
  strike(ctx, out, osc, osc, at, struck);
}

/** A struck burst of filtered noise. */
function hiss(
  ctx: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  at: number,
  { type, f, ...struck }: Struck & { type: BiquadFilterType; f: number },
) {
  const { source, filter } = filtered(ctx, noise, type, f);
  strike(ctx, out, source, filter, at, struck);
}

/** A small piece of metal struck or dropped: a click and a short, dull ring. */
function tink(
  ctx: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  at: number,
  f: number,
  peak: number,
  pan = 0,
) {
  hiss(ctx, out, noise, at, { type: "highpass", f: 4000, peak: peak * 0.8, decay: 0.012, attack: 0.001, pan });
  for (const [ratio, level] of [
    [1, 1],
    [1.52, 0.6],
    [2.33, 0.35],
  ] as const) {
    tone(ctx, out, at, { f: f * ratio, peak: peak * level, decay: 0.12 / ratio, attack: 0.001, pan });
  }
}

/** A heavy, soft thump: a sledge on the block. */
function thump(
  ctx: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  at: number,
  strength: number,
) {
  tone(ctx, out, at, { type: "triangle", f: 120, to: 75, peak: 0.45 * strength, decay: 0.16 });
  hiss(ctx, out, noise, at, { type: "lowpass", f: 350, peak: 0.5 * strength, decay: 0.11 });
}

/**
 * A hammer blow on the anvil: the face striking, the mass under it, the ring.
 * `ring` 1 is bare steel, which sings; near 0 is hot metal on the anvil, which
 * deadens it to a "tonk".
 */
function anvil(
  ctx: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  at: number,
  strength: number,
  ring: number,
) {
  hiss(ctx, out, noise, at, { type: "highpass", f: 3000, peak: 0.3 * strength, decay: 0.03, attack: 0.001 });
  hiss(ctx, out, noise, at, { type: "bandpass", f: 1100, peak: 0.25 * strength, decay: 0.09, attack: 0.001 });
  tone(ctx, out, at, { type: "triangle", f: 170, to: 110, peak: 0.3 * strength, decay: 0.12 });
  // Steel rings on many notes at once, none in tune with the next, and the
  // close pairs make the ring waver as it dies.
  for (const [f, level, decay] of [
    [1318.5, 0.5, 1.2],
    [1325, 0.3, 1.2],
    [2637, 1, 2.8],
    [2642, 0.6, 2.8],
    [3951, 0.6, 1.6],
    [3960, 0.3, 1.6],
    [5588, 0.4, 1],
    [7459, 0.25, 0.7],
    [9870, 0.15, 0.4],
  ] as const) {
    tone(ctx, out, at, {
      f,
      peak: 0.2 * level * strength * (0.4 + 0.6 * ring),
      decay: decay * ring,
      attack: 0.001,
    });
  }
}

/** Recorded anvil hits, each a little different: mixed, they don't sound canned. */
const ANVIL_FILES = [
  "bright-metal-anvil-strike",
  "high-metallic-anvil-hit",
  "muted-short-metallic-anvil-hit",
].map((name) => `/assets/sounds/enchanting/${name}.wav`);

let anvilFiles: Promise<ArrayBuffer[]> | undefined;
let anvilHits: Promise<AnvilHit[]> | undefined;
/** `onset`: seconds of silence before the strike. `level`: gain to a common loudness. */
type AnvilHit = { buffer: AudioBuffer; onset: number; level: number };
/** Every hit is brought to this loudness (RMS of its first quarter second). */
const HIT_RMS = 0.1;

/** Fetches the hits ahead of the first attempt (no AudioContext needed yet). */
export function preloadEnchantSounds() {
  anvilFiles ??= Promise.all(
    ANVIL_FILES.map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Couldn't load ${url}`);
      return response.arrayBuffer();
    }),
  );
  // A failed load is tried again on the next attempt.
  anvilFiles.catch(() => {
    anvilFiles = undefined;
  });
  return anvilFiles;
}

/** The hits decoded, each with the gain that brings its peak to the same height. */
function loadAnvilHits(ctx: BaseAudioContext) {
  anvilHits ??= preloadEnchantSounds().then((files) =>
    Promise.all(
      files.map(async (file) => {
        const buffer = await ctx.decodeAudioData(file.slice(0));
        const data = buffer.getChannelData(0);
        let peak = 0;
        for (const sample of data) peak = Math.max(peak, Math.abs(sample));
        // The strike starts where the wave first reaches a tenth of its peak.
        const start = Math.max(0, data.findIndex((x) => Math.abs(x) >= peak / 10));
        const body = data.subarray(start, start + Math.round(buffer.sampleRate / 4));
        let sum = 0;
        for (const sample of body) sum += sample * sample;
        const rms = Math.sqrt(sum / Math.max(1, body.length));
        // Peak would level them wrongly: a short dull hit and a long ring
        // with the same peak are not equally loud.
        return {
          buffer,
          onset: Math.max(0, start / buffer.sampleRate - 0.003),
          level: HIT_RMS / Math.max(rms, 0.01),
        };
      }),
    ),
  );
  anvilHits.catch(() => {
    anvilHits = undefined;
  });
  return anvilHits;
}

/**
 * The charge: a smith at the anvil from `t0` until the returned function
 * stops it (the result is in). Each blow is one of the recordings, never the
 * same one twice running, a little stronger or softer and a hair off pitch,
 * on a steady beat that only a hand would vary: one anvil, in one place.
 */
export function chargeSound(ctx: BaseAudioContext, out: AudioNode, t0: number) {
  const sources = new Set<AudioBufferSourceNode>();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  void loadAnvilHits(ctx)
    .then((hits) => {
      if (stopped) return;
      let next = Math.max(t0, ctx.currentTime);
      let last = -1;
      const blow = (at: number) => {
        // Any recording but the last one.
        let pick = Math.floor(Math.random() * (hits.length - (last < 0 ? 0 : 1)));
        if (last >= 0 && pick >= last) pick++;
        last = pick;
        const hit = hits[pick]!;
        const source = ctx.createBufferSource();
        source.buffer = hit.buffer;
        // At most 3% either way: enough to vary, not enough to sound tuned.
        source.playbackRate.value = 0.97 + Math.random() * 0.06;
        const gain = ctx.createGain();
        gain.gain.value = hit.level * (0.85 + Math.random() * 0.3);
        source.connect(gain).connect(out);
        // Skip the lead-in silence, so every strike lands on the beat.
        source.start(at, hit.onset);
        sources.add(source);
        source.onended = () => sources.delete(source);
        return at + 0.75 * (0.96 + Math.random() * 0.08);
      };
      // Scheduled a little ahead, so a busy main thread never breaks the beat.
      const schedule = () => {
        while (next < ctx.currentTime + 0.3) next = blow(next);
      };
      schedule();
      timer = setInterval(schedule, 100);
    })
    .catch(() => {
      // Without the recordings the charge is silent; the result still sounds.
    });

  return (when: number) => {
    stopped = true;
    clearInterval(timer);
    sources.forEach((source) => source.stop(when));
  };
}

/** The reveal at `t0`. A dropped level looks like a plain failure, so it sounds like one. */
export function resultSound(
  ctx: BaseAudioContext,
  out: AudioNode,
  t0: number,
  outcome: "success" | "failed" | "dropped" | "broken",
) {
  const noise = whiteNoise(ctx);
  const pops = crackle(ctx);
  /** Lasting layers that follow `envelope`, then end at `until`. */
  const lasting = (
    envelope: GainNode,
    until: number,
    layers: Array<[ReturnType<typeof filtered>, number]>,
  ) => {
    envelope.connect(out);
    for (const [{ source, filter }, level] of layers) {
      const gain = ctx.createGain();
      gain.gain.value = level;
      filter.connect(gain).connect(envelope);
      source.start(t0);
      source.stop(until);
    }
  };

  if (outcome === "success") {
    // The hammer comes down on bare steel and bounces: one blow for each ring
    // thrown off the item.
    BURST_RINGS_MS.forEach((delay, i) =>
      anvil(ctx, out, noise, t0 + delay / 1000, [1, 0.35, 0.18][i] ?? 0.1, 1),
    );
    // The sparks: a shower off the blow, each spark on the side it flies to.
    hiss(ctx, out, pops, t0, { type: "highpass", f: 3000, peak: 0.35, decay: 0.9 });
    for (let i = 0; i < SPARK_COUNT; i++) {
      hiss(ctx, out, noise, t0 + sparkDelayMs(i) / 1000, {
        type: "highpass",
        f: 5000,
        peak: 0.08,
        decay: 0.03,
        attack: 0.001,
        pan: sparkPan(i),
      });
    }
    // enchant-afterglow: the lines stay lit for 45% of 3.2 s, then fade, and
    // the fire settles with them.
    const glow = ctx.createGain();
    glow.gain.setValueAtTime(1, t0);
    glow.gain.setValueAtTime(1, t0 + 0.45 * 3.2);
    glow.gain.linearRampToValueAtTime(0, t0 + 3.2);
    lasting(glow, t0 + 3.2, [
      [filtered(ctx, noise, "lowpass", 500), 0.2],
      [filtered(ctx, pops, "highpass", 1500), 0.2],
    ]);
    return;
  }

  // The red flash: the blow lands dead, on iron that will not ring.
  hiss(ctx, out, noise, t0, { type: "highpass", f: 3000, peak: 0.3, decay: 0.03, attack: 0.001 });
  hiss(ctx, out, noise, t0, { type: "bandpass", f: 500, peak: 0.4, decay: 0.15 });
  thump(ctx, out, noise, t0, 1);
  for (const f of [233, 371, 587]) {
    tone(ctx, out, t0, { f, peak: 0.08, decay: 0.18, attack: 0.001 });
  }
  // enchant-shake: the bench knocked left and right, dying out.
  for (const [ms, px] of [
    [75, -7],
    [150, 6],
    [225, -4],
    [300, 3],
    [400, -1],
  ] as const) {
    hiss(ctx, out, noise, t0 + ms / 1000, {
      type: "lowpass",
      f: 900,
      peak: Math.abs(px) * 0.035,
      decay: 0.08,
      pan: Math.sign(px) * 0.7,
    });
  }

  // enchant-fizzle and enchant-drain: the charge sputters twice, holds for a
  // beat, then leaves the lines: the heat goes out of the metal in a hiss of
  // steam, spitting, and the fire dies under it.
  const FIZZLE = 1.6;
  const drainFrom = t0 + DRAIN_HOLD_MS / 1000;
  const lines = ctx.createGain();
  lines.gain.setValueAtTime(1, t0);
  for (const [share, level] of [
    [0.05, 0.35],
    [0.1, 1],
    [0.15, 0.45],
    [0.22, 1],
  ] as const) {
    lines.gain.linearRampToValueAtTime(level, t0 + share * FIZZLE);
    if (level < 1) {
      hiss(ctx, out, pops, t0 + share * FIZZLE, { type: "highpass", f: 2000, peak: 0.5, decay: 0.08 });
    }
  }
  lines.gain.setValueAtTime(1, drainFrom);
  lines.gain.linearRampToValueAtTime(0.15, drainFrom + DRAIN_MS / 1000);
  lines.gain.linearRampToValueAtTime(0, t0 + FIZZLE);
  lasting(lines, t0 + FIZZLE, [
    [filtered(ctx, noise, "highpass", 4000), 0.1],
    [filtered(ctx, pops, "bandpass", 2500, 0.7), 0.5],
    [filtered(ctx, noise, "lowpass", 500), 0.4],
  ]);

  if (outcome === "broken") {
    // enchant-shatter: the accessory cracks white and flies apart.
    hiss(ctx, out, noise, t0, { type: "highpass", f: 3000, peak: 0.3, decay: 0.12 });
    hiss(ctx, out, pops, t0 + 0.02, { type: "highpass", f: 2500, peak: 0.35, decay: 0.6 });
    // Each shard clinks as it leaves, and again, duller, where it lands.
    for (let i = 0; i < SPARK_COUNT; i++) {
      const left = t0 + sparkDelayMs(i) / 1000;
      const f = 2200 + ((i * i * 397) % 4200);
      const pan = sparkPan(i);
      tink(ctx, out, noise, left, f, 0.08, pan);
      tink(ctx, out, noise, left + 0.5 + ((i * 131) % 500) / 1000, f * 0.8, 0.04, pan);
    }
  }
}

let audio: AudioContext | undefined;
let playing: { bus: GainNode; stop?: (when: number) => void } | undefined;

/** Cuts whatever is playing and opens a line for the next sound. */
function line() {
  audio ??= new AudioContext();
  // Browsers only let sound start from a click: playEnchantCharge runs in one.
  void audio.resume();
  stopEnchantSound();
  const bus = audio.createGain();
  bus.connect(audio.destination);
  playing = { bus };
  return { ctx: audio, bus, now: audio.currentTime };
}

export function stopEnchantSound() {
  if (!audio || !playing) return;
  playing.bus.gain.setTargetAtTime(0, audio.currentTime, 0.02);
  playing.stop?.(audio.currentTime + 0.2);
  playing = undefined;
}

/** Call from the click that starts an attempt, even with nothing to charge (`ms` 0). */
export function playEnchantCharge(ms: number) {
  const { ctx, bus, now } = line();
  if (ms > 0) playing!.stop = chargeSound(ctx, bus, now);
}

export function playEnchantResult(outcome: Parameters<typeof resultSound>[3]) {
  const { ctx, bus, now } = line();
  resultSound(ctx, bus, now, outcome);
}
