/** The run length before an admin saves one on /admin/vocations. */
export const DEFAULT_MAX_VOCATION_DURATION_SECONDS = 8 * 60 * 60;

/** The range an admin may set the run length within. */
export const VOCATION_DURATION_LIMITS_SECONDS = {
  min: 15 * 60,
  max: 24 * 60 * 60,
} as const;
