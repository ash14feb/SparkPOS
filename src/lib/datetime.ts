/**
 * Central timezone handling.
 *
 * DB `TIMESTAMP` values are stored in UTC. The device running the browser may
 * be in any timezone, so every display string and every "today" boundary must
 * be computed in the *business* timezone from settings (default IST).
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Asia/Kolkata', label: 'IST — India (UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'UAE (UTC+4)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia (UTC+8)' },
  { value: 'Asia/Jakarta', label: 'Jakarta (UTC+7)' },
  { value: 'Asia/Manila', label: 'Philippines (UTC+8)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (UTC+3)' },
  { value: 'Asia/Qatar', label: 'Qatar (UTC+3)' },
  { value: 'Asia/Kuwait', label: 'Kuwait (UTC+3)' },
  { value: 'Asia/Bahrain', label: 'Bahrain (UTC+3)' },
  { value: 'Asia/Muscat', label: 'Oman (UTC+4)' },
  { value: 'Asia/Colombo', label: 'Sri Lanka (UTC+5:30)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (UTC+6)' },
  { value: 'Asia/Kathmandu', label: 'Nepal (UTC+5:45)' },
  { value: 'Asia/Bangkok', label: 'Thailand (UTC+7)' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (UTC+12/+13)' },
  { value: 'Europe/London', label: 'London (UTC+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
  { value: 'America/Toronto', label: 'Toronto (UTC-5/-4)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

/** Resolve the active business timezone from settings (falls back to IST). */
export function getTimezone(settings?: any): string {
  const tz = settings?.timezone || DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Database datetimes arrive as naive strings ("2026-09-15 22:10:00") in UTC,
 * Date objects (mysql2 driver), epoch millis, or ISO strings. Normalize to a
 * Date (an absolute instant — correct regardless of device timezone).
 */
export function parseDbTime(value: any): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^[0-9]+$/.test(s)) return new Date(Number(s));
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
    // Naive "YYYY-MM-DD HH:mm:ss" -> treat as UTC.
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  return new Date(value);
}

export const dbTimeMs = (value: any): number => parseDbTime(value).getTime();

/** Format an instant in the business timezone. */
export function formatInTimezone(
  value: any,
  settingsOrTz?: any,
  options?: Intl.DateTimeFormatOptions,
): string {
  const tz = typeof settingsOrTz === 'string' ? settingsOrTz : getTimezone(settingsOrTz);
  const d = parseDbTime(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: tz }).format(d);
}

export const formatDateTime = (v: any, s?: any) =>
  formatInTimezone(v, s, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
export const formatDate = (v: any, s?: any) =>
  formatInTimezone(v, s, { day: '2-digit', month: 'short', year: 'numeric' });
export const formatTime = (v: any, s?: any) =>
  formatInTimezone(v, s, { hour: '2-digit', minute: '2-digit', hour12: true });

/** Human-friendly relative time — diff math is tz-independent, parse is UTC-safe. */
export function timeAgo(value: any): string {
  const t = dbTimeMs(value);
  if (!t || Number.isNaN(t)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return parseDbTime(value).toLocaleDateString();
}

/** "YYYY-MM-DD" of *now* in the business timezone (for "today" defaults). */
export function todayInTimezone(settingsOrTz?: any): string {
  const tz = typeof settingsOrTz === 'string' ? settingsOrTz : getTimezone(settingsOrTz);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts; // en-CA yields YYYY-MM-DD
}

/**
 * Epoch-ms bounds [start, end] of a YYYY-MM-DD calendar day *in the given
 * timezone* — correct even when the device is in a different zone or DST.
 */
export function dayBoundsInTimezone(dateStr: string, settingsOrTz?: any): { start: number; end: number } {
  const tz = typeof settingsOrTz === 'string' ? settingsOrTz : getTimezone(settingsOrTz);
  const start = tzMsForLocal(dateStr, '00:00', tz);
  const end = tzMsForLocal(dateStr, '23:59:59.999', tz);
  return { start, end };
}

/** Convert a wall-clock time in `tz` to epoch ms (iterative, DST-safe). */
function tzMsForLocal(dateStr: string, timeStr: string, tz: string): number {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const [hh = 0, mm = 0, ss = 0, ms = 0] = timeStr.split(/[:.]/).map(Number);
  // Guess: treat wall time as UTC, then correct by the tz offset at that instant.
  let guess = Date.UTC(Y, M - 1, D, hh, mm, ss, ms);
  for (let i = 0; i < 3; i++) {
    const off = tzOffsetMs(tz, guess);
    const next = Date.UTC(Y, M - 1, D, hh, mm, ss, ms) - off;
    if (Math.abs(next - guess) < 1) return next;
    guess = next;
  }
  return guess;
}

/** Offset of `tz` at instant `ms`, in ms (local - UTC). */
function tzOffsetMs(tz: string, ms: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return asUTC - ms;
}

/** Hour of day (0-23) of an instant in the business timezone. */
export function hourInTimezone(value: any, settingsOrTz?: any): number {
  const tz = typeof settingsOrTz === 'string' ? settingsOrTz : getTimezone(settingsOrTz);
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(parseDbTime(value));
  return Number(h) % 24;
}

/** YYYY-MM-DD of an instant in the business timezone (day-wise grouping). */
export function dateKeyInTimezone(value: any, settingsOrTz?: any): string {
  const tz = typeof settingsOrTz === 'string' ? settingsOrTz : getTimezone(settingsOrTz);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(parseDbTime(value));
}
