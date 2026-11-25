/*
 * A drill runs in rounds, so nothing repeats while other questions are still waiting. The first
 * round asks every question once, in the order given; each later round asks only what is left.
 * A question leaves after `need` sure correct answers. A miss takes one of them back; answers
 * marked "not sure" or helped by a hint do not count.
 */
export interface DrillSession {
  label: string;
  ids: string[];
  /** Sure correct answers a question needs to leave. */
  need: number;
  /** Sure correct answers still missing, per question. */
  reps: Record<string, number>;
  /** Questions still to come in this round. */
  queue: string[];
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
    label, ids: [...ids], need, queue: [], reps: Object.fromEntries(ids.map((id) => [id, need])),
    cur: null, order: [], answered: false, picked: null, hint: false, unsure: false, shown: false,
    right: 0, wrong: 0, streak: 0, best: 0, done: false, started: Date.now(),
  };
  nextQuestion(s, rng);
  return s;
}

export function nextQuestion(s: DrillSession, rng: () => number = Math.random): void {
  if (!s.queue.length) s.queue = s.ids.filter((id) => s.reps[id] > 0);
  s.cur = s.queue.shift() ?? null;
  if (!s.cur) {
    s.done = true;
    return;
  }
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
    s.reps[id] = Math.min(s.reps[id] + 1, s.need);
    s.wrong++;
    s.streak = 0;
  }
}

/** Share of the drill's required correct answers already given, 0..1. */
export function drillProgress(s: DrillSession): number {
  const total = s.ids.length * s.need;
  const left = s.ids.reduce((a, id) => a + s.reps[id], 0);
  return total ? 1 - left / total : 1;
}
