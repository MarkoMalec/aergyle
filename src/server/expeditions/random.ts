/**
 * Small deterministic PRNG for snapshotted expedition outcomes. This is not a
 * security primitive; it prevents retries (for example after an inventory-full
 * claim) from rerolling rewards or damage.
 */
export function createExpeditionRandom(seed: string) {
  let state = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16_777_619);
  }
  state >>>= 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Uniform non-negative integer in [minimum, maximum]. */
export function rollInclusive(
  minimum: number,
  maximum: number,
  random: () => number,
) {
  const low = Math.max(0, Math.ceil(Math.min(minimum, maximum)));
  const high = Math.max(low, Math.floor(Math.max(minimum, maximum)));
  return (
    low +
    Math.floor(Math.min(0.999999999, Math.max(0, random())) * (high - low + 1))
  );
}
