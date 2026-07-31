// School-wide constants and date helpers.
// Attendance is marked against the SCHOOL's clock, not the server's —
// all "today" logic runs in this timezone.

export const SCHOOL_TIMEZONE = 'Africa/Addis_Ababa';

/** Today's date as YYYY-MM-DD in the school's timezone. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(new Date());
}

export function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Shift a YYYY-MM-DD date by n days (UTC math, no DST surprises). */
export function shiftISODate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function prettyDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** Saturday/Sunday check. Saturday school days exist in Ethiopia, so the UI
 *  warns but never blocks. */
export function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}
