import { LectureMeta, Question, Weight, slideCount } from './models';
import { shuffle } from './drill';

const LK_WEIGHT: Record<Weight, number> = { high: 3, medium: 2, low: 1 };

export interface MockSession {
  ids: string[];
  /** Option display order per question (choice questions). */
  orders: number[][];
  /** Picked display index (choice) or self-grade 0/1/2 (open), null when unanswered. */
  picks: (number | null)[];
  /** Written answers for open-question tests; never leave the browser. */
  texts: string[];
  i: number;
  started: number;
  limitMin: number;
  submitted: boolean;
  /** Open tests: answers revealed, waiting for self-grades. */
  reviewing: boolean;
  finished?: number;
}

export interface MockResult {
  t: number;
  pct: number;
  n: number;
}

/** Weighted draw without replacement: likely questions are three times as likely as unlikely ones. */
function draw(cands: Question[], k: number, rng: () => number): Question[] {
  const left = cands.slice();
  const out: Question[] = [];
  while (out.length < k && left.length) {
    let r = rng() * left.reduce((a, q) => a + LK_WEIGHT[q.lk], 0);
    let i = 0;
    for (; i < left.length - 1; i++) {
      r -= LK_WEIGHT[left[i].lk];
      if (r <= 0) break;
    }
    out.push(...left.splice(i, 1));
  }
  return out;
}

/**
 * Picks `n` questions with per-lecture quotas proportional to slide counts (largest remainder),
 * then tops up from any lecture when one runs short.
 */
export function sampleMock(pool: Question[], lectures: LectureMeta[], n: number, rng: () => number = Math.random): string[] {
  n = Math.min(n, pool.length);
  const byLecture = new Map<number, Question[]>();
  for (const q of pool) byLecture.set(q.l, [...(byLecture.get(q.l) ?? []), q]);
  const parts = [...byLecture.keys()].map((l) => ({
    l, w: slideCount(lectures.find((x) => x.n === l) ?? { n: l, title: '', short: '', status: 'available' }) ?? byLecture.get(l)!.length,
  }));
  const total = parts.reduce((a, p) => a + p.w, 0);
  const quotas = parts.map((p) => ({ ...p, k: Math.floor((n * p.w) / total), f: ((n * p.w) / total) % 1 }));
  let rest = n - quotas.reduce((a, x) => a + x.k, 0);
  for (const x of [...quotas].sort((a, b) => b.f - a.f)) if (rest-- > 0) x.k++;

  const picked = quotas.flatMap((x) => draw(byLecture.get(x.l)!, x.k, rng));
  const chosen = new Set(picked);
  picked.push(...draw(pool.filter((q) => !chosen.has(q)), n - picked.length, rng));
  return shuffle(picked.map((q) => q.id), rng);
}

/** Typical thresholds (50/60/70/80/90 %); real cut-offs may differ. */
export function grade(pct: number): string {
  return pct >= 90 ? '5.0' : pct >= 80 ? '4.5' : pct >= 70 ? '4.0' : pct >= 60 ? '3.5' : pct >= 50 ? '3.0' : '2.0';
}
