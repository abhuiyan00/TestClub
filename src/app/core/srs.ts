/*
 * Spaced review (successive relearning), ported from the MMCV Testownik.
 * A question answered right, and confidently, when it is due moves up a box and returns after
 * INTERVAL_DAYS[box] days; a miss sends it back to box 0. Gaps of 1-5 days suit tests a few weeks
 * out (Cepeda et al. 2008: the best gap is about 20-40 % of the time left).
 */
import { DAY, HOUR, MINUTE, dayIndex } from './time';

export { DAY, HOUR } from './time';

export const INTERVAL_DAYS = [0, 1, 2, 3, 5] as const;

export interface QRecord {
  /** answers, right, wrong, right-in-a-row */
  n: number;
  r: number;
  w: number;
  s: number;
  /** 1 last answer right, 0 wrong */
  last: 0 | 1 | null;
  box: number;
  due?: number;
  /** time of the last answer */
  t?: number;
  /** text of the last wrong pick */
  pick?: string;
  /** calibration: sure-right, sure-total, unsure-right, unsure-total */
  sr?: number;
  sn?: number;
  ur?: number;
  un?: number;
  /** confident errors */
  cerr?: number;
}

export type Level = 0 | 1 | 2 | 3;

/** Next due time: never later than 20 h before the exam (a last look on the eve), never sooner than 1 h. */
export function dueIn(days: number, now: number, examAt?: number): number {
  const target = now + days * DAY - 3 * HOUR;
  const capped = examAt && examAt > now ? Math.min(target, examAt - 20 * HOUR) : target;
  return Math.max(capped, now + HOUR);
}

/** 0 unseen · 1 last answer wrong · 2 learning · 3 secure (right on two different days) */
export function level(r: QRecord | undefined): Level {
  if (!r) return 0;
  if (r.last === 0) return 1;
  return r.box >= 2 ? 3 : 2;
}

export const isDue = (r: QRecord | undefined, now: number): boolean => !!r && (r.due ?? 0) <= now;

export function record(
  map: Record<string, QRecord>,
  id: string,
  ok: boolean,
  pick: string | undefined,
  sure: boolean,
  now: number,
  examAt?: number,
): void {
  const r = (map[id] ??= { n: 0, r: 0, w: 0, s: 0, last: null, box: 0 });
  const wasDue = (r.due ?? 0) <= now;
  r.n++;
  r.t = now;
  if (sure) {
    r.sn = (r.sn ?? 0) + 1;
    if (ok) r.sr = (r.sr ?? 0) + 1;
  } else {
    r.un = (r.un ?? 0) + 1;
    if (ok) r.ur = (r.ur ?? 0) + 1;
  }
  if (!ok) {
    Object.assign(r, { w: r.w + 1, s: 0, last: 0, pick, box: 0, due: now });
    if (sure) r.cerr = (r.cerr ?? 0) + 1;
    return;
  }
  r.r++;
  r.last = 1;
  if (sure) {
    r.s++;
    if (wasDue) {
      r.box = Math.min(r.box + 1, INTERVAL_DAYS.length - 1);
      r.due = dueIn(INTERVAL_DAYS[r.box], now, examAt);
    }
  } else {
    // a lucky guess returns soon
    const soon = r.box ? dueIn(1, now, examAt) : now + 10 * MINUTE;
    r.due = Math.min(r.due && r.due > now ? r.due : Infinity, soon);
  }
}

export interface Totals {
  n: number;
  l0: number;
  l1: number;
  l2: number;
  l3: number;
  answered: number;
  right: number;
}

export function totals(ids: readonly string[], map: Record<string, QRecord>): Totals {
  const t: Totals = { n: ids.length, l0: 0, l1: 0, l2: 0, l3: 0, answered: 0, right: 0 };
  for (const id of ids) {
    const r = map[id];
    t[`l${level(r)}`]++;
    if (r) {
      t.answered += r.n;
      t.right += r.r;
    }
  }
  return t;
}

export const readiness = (t: Totals): number => (t.n ? (t.l3 + 0.5 * t.l2 + 0.15 * t.l1) / t.n : 0);

export interface Plan {
  /** Calendar days until the exam, or null without an upcoming exam. */
  days: number | null;
  newToday: number;
  due: number;
}

/** Spread unseen questions over the days left, keeping the eve for a mock and reviews. */
export function plan(unseen: number, due: number, now: number, examAt?: number): Plan {
  if (!examAt || examAt <= now) return { days: null, newToday: Math.min(unseen, 10), due };
  const days = dayIndex(examAt) - dayIndex(now);
  const spread = days >= 2 ? Math.ceil(unseen / (days - 1)) : unseen;
  return { days, newToday: Math.min(unseen, Math.max(10, spread)), due };
}

export interface Calibration {
  sureRight: number;
  sure: number;
  unsureRight: number;
  unsure: number;
}

export function calibration(map: Record<string, QRecord>): Calibration {
  const c: Calibration = { sureRight: 0, sure: 0, unsureRight: 0, unsure: 0 };
  for (const r of Object.values(map)) {
    c.sureRight += r.sr ?? 0;
    c.sure += r.sn ?? 0;
    c.unsureRight += r.ur ?? 0;
    c.unsure += r.un ?? 0;
  }
  return c;
}
