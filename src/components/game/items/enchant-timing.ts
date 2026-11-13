// When things happen on the enchanting bench. The drawing (EnchantPanel) and
// its sound (enchant-sound) both read these, so the two cannot drift apart.

/** The charge fills the lines over this share of its time, then holds. */
export const FILL_END = 0.8;
// The charge first runs round the material slots, then the main line at one
// steady speed: each stretch gets time in proportion to its length (conduit
// 108, junction to chance 62, round the chance diamond 164, link 50, round the
// item 260).
export const FLOW = {
  slots: [0, 0.12],
  conduit: [0.12, 0.234],
  main: [0.234, 0.299],
  core: [0.299, 0.473],
  link: [0.473, 0.525],
  rings: [0.525, FILL_END],
} as const;
/** The sun over the chance diamond: one ray per angle (degrees, 0 = right, -90 = up). */
export const RAY_ANGLES = [-126, -108, -90, -72, -54] as const;
/**
 * A ray rises from the diamond's outline and lights as the charge, running
 * over the top from the left corner to the right, passes its foot.
 */
export const rayLitAt = (degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  const across = (Math.cos(a) / (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))) + 1) / 2;
  return FLOW.core[0] + across * (FLOW.core[1] - FLOW.core[0]);
};

/** A failure holds the lit lines for a beat, then runs them back out. */
export const DRAIN_HOLD_MS = 350;
export const DRAIN_MS = 1100;

/** A success throws one ring off the item at each of these moments. */
export const BURST_RINGS_MS = [0, 130, 260];
/** Sparks of a success, shards of a broken accessory. */
export const SPARK_COUNT = 18;
export const sparkDelayMs = (i: number) => (i * 53) % 220;
