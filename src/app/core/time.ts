/** Calendar maths and formatting pinned to the university's time zone, whatever the visitor's clock says. */
export const TZ = 'Europe/Warsaw';
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Whole days since 1970-01-01 in Warsaw local time. */
export function dayIndex(ts: number): number {
  return Math.round(Date.parse(dayKey.format(ts) + 'T00:00:00Z') / DAY);
}

/** Warsaw calendar date of a timestamp as YYYY-MM-DD. */
export const isoDay = (ts: number): string => dayKey.format(ts);

/** Plain dates become noon UTC, which is the same calendar day everywhere in Europe. */
export function parseWhen(s: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00Z' : s);
}

export const hasTime = (s: string): boolean => s.includes('T');

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...o });
const F = {
  day: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
  long: fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  date: fmt({ day: 'numeric', month: 'short', year: 'numeric' }),
  time: fmt({ hour: '2-digit', minute: '2-digit', hour12: false }),
  month: fmt({ month: 'long', year: 'numeric' }),
  dayNum: fmt({ day: 'numeric' }),
  weekday: fmt({ weekday: 'short' }),
  mon: fmt({ month: 'short' }),
};
export type DateStyle = keyof typeof F;
export const formatWhen = (ts: number, style: DateStyle = 'date'): string => F[style].format(ts);

/** "today", "tomorrow", "in 5 days", "yesterday", "3 days ago", counted in Warsaw calendar days. */
export function relativeDay(ts: number, now = Date.now()): string {
  const d = dayIndex(ts) - dayIndex(now);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

/** Days and hours left until `ts`, never negative. */
export function countdown(ts: number, now = Date.now()): { d: number; h: number; m: number; past: boolean } {
  const ms = Math.max(0, ts - now);
  return { d: Math.floor(ms / DAY), h: Math.floor((ms % DAY) / HOUR), m: Math.floor((ms % HOUR) / MINUTE), past: ms === 0 };
}
