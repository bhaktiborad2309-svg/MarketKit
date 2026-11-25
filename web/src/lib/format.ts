/**
 * Formatters shared across the admin pages.
 *
 * Each of these existed two or three times, copy-pasted between pages. They are
 * pure functions of their arguments, so they belong here rather than inside any
 * one page component.
 *
 * Money formatting lives in ./currency, not here.
 */

/**
 * How long ago something happened, as "just now" / "5m ago" / "3h ago" / "2d ago".
 *
 * Anything under a minute is "just now" — a notification that says "12s ago"
 * reads as noise, and it would be stale before the user finished reading it.
 */
export function timeAgo(dateStr: string): string {
  const elapsedMs = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(elapsedMs / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * A video's running time as "4m 07s". Renders an em dash for a missing or zero
 * duration, which is what a video that has not finished transcoding reports.
 */
export function formatDuration(totalSeconds?: number): string {
  if (!totalSeconds) return "—";

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * A stopwatch reading for work in progress, as "45s" or "2m 05s".
 *
 * Differs from formatDuration in taking milliseconds and in dropping the
 * minutes segment entirely while under a minute — a transcode that has been
 * running eight seconds should say "8s", not "0m 08s".
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}
