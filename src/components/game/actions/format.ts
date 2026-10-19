export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}

/** A countdown: "1h 05m 09s", or "5m 09s" under an hour. */
export function formatRemaining(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
    : `${minutes}m ${String(secs).padStart(2, "0")}s`;
}

/** A configured length, rounded to minutes: "2 h 30 min", "45 min". */
export function formatLength(seconds: number) {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.round((seconds % 3_600) / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** The local wall-clock time of an ISO timestamp, e.g. "14:05". */
export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function formatAgo(value: string, now: number) {
  const minutes = Math.floor((now - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** A wait in plain words, e.g. "under a minute", "14 min", "2 h 5 min". */
export function formatWait(seconds: number) {
  if (seconds < 60) return "under a minute";
  const totalMinutes = Math.ceil(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
