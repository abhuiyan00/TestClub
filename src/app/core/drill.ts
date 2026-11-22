/*
 * Testownik drill rules: a question leaves the drill after `need` sure correct answers.
 * Each mistake adds one more repetition, up to four. Answers marked "not sure" or helped by
 * a hint do not count towards leaving.
 */
export const MAX_REPS = 4;

export interface DrillSession {
  label: string;
  ids: string[];
  reps: Record<string, number>;
  cur: string | null;
  /** Display order of the options of the current question (indices into `o`). */
  order: number[];
  answered: boolean;
  /** Displayed option index picked, or the self-grade (0 missed, 1 partly, 2 got it) for open questions. */
  picked: number | null;
  hint: boolean;
  unsure: boolean;
  /** Recall mode: options hidden until revealed. Open questions: model answer revealed. */
  shown: boolean;
  right: number;
  wrong: number;
  streak: number;
  best: number;
  last: string | null;
  done: boolean;
  started: number;
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function startDrill(ids: string[], label: string, need: number, rng: () => number = Math.random): DrillSession {
  const s: DrillSession = {
    label, ids: [...ids], reps: Object.fromEntries(ids.map((id) => [id, need])),
    cur: null, order: [], answered: false, picked: null, hint: false, unsure: false, shown: false,
    right: 0, wrong: 0, streak: 0, best: 0, last: null, done: false, started: Date.now(),
  };
  nextQuestion(s, rng);
  return s;
}

export function nextQuestion(s: DrillSession, rng: () => number = Math.random): void {
  const open = s.ids.filter((id) => s.reps[id] > 0);
  if (!open.length) {
    Object.assign(s, { done: true, cur: null });
    return;
  }
  const pool = open.length > 1 ? open.filter((id) => id !== s.last) : open;
  s.cur = pool[Math.floor(rng() * pool.length)];
  Object.assign(s, { order: shuffle([0, 1, 2, 3], rng), answered: false, picked: null, hint: false, unsure: false, shown: false });
}

/** Applies the drill bookkeeping for the current question; the caller records spaced-review state. */
export function answerDrill(s: DrillSession, ok: boolean, sure: boolean): void {
  if (s.answered || !s.cur) return;
  const id = s.cur;
  s.answered = true;
  if (ok) {
    if (sure) s.reps[id] = Math.max(0, s.reps[id] - 1);
    s.right++;
    s.streak++;
    s.best = Math.max(s.best, s.streak);
  } else {
    s.reps[id] = Math.min(s.reps[id] + 1, MAX_REPS);
    s.wrong++;
    s.streak = 0;
  }
  s.last = id;
}

/** Share of the drill's required correct answers already given, 0..1. */
export function drillProgress(s: DrillSession, need: number): number {
  const total = s.ids.length * need;
  const left = s.ids.reduce((a, id) => a + Math.min(s.reps[id], need), 0);
  return total ? 1 - left / total : 1;
}
