const integer = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const decimal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/** Whole numbers up to a million, compact beyond ("12.4M"). */
export function formatXp(value: number) {
  if (!Number.isFinite(value)) return "—";
  return Math.abs(value) >= 1_000_000 ? compact.format(value) : integer.format(value);
}

export function formatDecimal(value: number) {
  return Number.isFinite(value) ? decimal.format(value) : "—";
}

/** Elapsed calendar time given in days: "5 h", "12 days", "4.1 months", "2.3 years". */
export function formatDays(days: number | null) {
  if (days === null || !Number.isFinite(days)) return "—";
  if (days <= 0) return "Start";
  if (days === 1) return "1 day";
  if (days < 1) {
    const hours = days * 24;
    return hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : `${decimal.format(hours)} h`;
  }
  if (days < 60) return `${decimal.format(days)} days`;
  if (days < 730) return `${decimal.format(days / 30.44)} months`;
  return `${decimal.format(days / 365.25)} years`;
}

const TIME_TICK_LABELS = new Map([
  [1 / 1_440, "1 min"],
  [1 / 24, "1 h"],
  [1, "1 day"],
  [7, "1 week"],
  [30.44, "1 month"],
  [365.25, "1 year"],
  [3_652.5, "10 years"],
]);

/** Readable ticks for a log-scale time axis in days: 1 h, 1 day, 1 week… */
export const TIME_TICKS_DAYS = [...TIME_TICK_LABELS.keys()];

/** Like formatDays, with round names for the axis ticks above. */
export function formatTimeAxis(days: number) {
  return TIME_TICK_LABELS.get(days) ?? formatDays(days);
}

/** Hours of activity: "40 min", "12.5 h", "310 h". */
export function formatHours(hours: number) {
  if (!Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(0, Math.round(hours * 60))} min`;
  return `${hours < 100 ? decimal.format(hours) : integer.format(hours)} h`;
}

/** A duration in seconds: "13 s", "4 min", "2.5 h". */
export function formatSeconds(seconds: number) {
  if (seconds < 90) return `${decimal.format(seconds)} s`;
  if (seconds < 5_400) return `${decimal.format(seconds / 60)} min`;
  return `${decimal.format(seconds / 3_600)} h`;
}

export function formatPercent(value: number, digits = 0) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—";
}

/** "+12%" / "−8%" relative change, or "—" when nothing changed. */
export function formatChange(from: number, to: number) {
  if (!(from > 0) || !Number.isFinite(to)) return "—";
  const change = to / from - 1;
  if (Math.abs(change) < 0.0005) return "—";
  return `${change > 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(Math.abs(change) < 0.1 ? 1 : 0)}%`;
}
