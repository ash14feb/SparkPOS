/**
 * Database datetimes arrive as naive strings ("2026-09-15 22:10:00") in the
 * DB server timezone (UTC). `new Date()` would parse them as *client-local*
 * time, shifting displayed times by the UTC offset (e.g. showing 5:10 PM in
 * IST instead of 10:40 PM). These helpers interpret naive DB strings as UTC
 * so `toLocale*` renders them in the client's timezone.
 */
export function parseDbTime(value: any): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const s = value.trim();
    // Already has timezone info (Z or ±hh:mm / ±hhmm) or is epoch millis.
    if (/^[0-9]+$/.test(s)) return new Date(Number(s));
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
    // Naive "YYYY-MM-DD HH:mm:ss" -> treat as UTC.
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  return new Date(value);
}

export const dbTimeMs = (value: any): number => parseDbTime(value).getTime();
