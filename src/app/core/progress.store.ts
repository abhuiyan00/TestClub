import { DestroyRef, Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { KEY_PREFIX, readJson, writeJson } from './storage';
import { QRecord } from './srs';
import { DrillSession } from './drill';
import { MockResult, MockSession } from './mock';

export type DrillFilter = 'all' | 'hot' | 'new' | 'weak' | 'due';

export interface Settings {
  /** Correct answers needed before a question leaves a drill. Not called `reps`: that key holds the old default of 2 in saved settings. */
  need: number;
  /** Lectures included in drills; empty means all. */
  lectures: number[];
  filter: DrillFilter;
  mockN: number;
  /** Hide the options until you have recalled the answer. */
  recall: boolean;
}

export interface CourseProgress {
  v: 1;
  /** Bumped by a reset, so an older copy from another tab never overwrites it. */
  gen: number;
  updatedAt: number;
  q: Record<string, QRecord>;
  settings: Settings;
  session: DrillSession | null;
  mock: MockSession | null;
  history: MockResult[];
  /** Lectures marked as done. */
  done: number[];
}

export const blankProgress = (): CourseProgress => ({
  v: 1, gen: 0, updatedAt: 0, q: {}, session: null, mock: null, history: [], done: [],
  settings: { need: 1, lectures: [], filter: 'all', mockN: 30, recall: false },
});

const keyOf = (slug: string) => `${KEY_PREFIX}progress.${slug}`;

/** Per-course practice state in localStorage, one key per course. */
@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly states = new Map<string, WritableSignal<CourseProgress>>();

  constructor() {
    const win = inject(DOCUMENT).defaultView;
    // Another tab saved newer progress: take it instead of overwriting it on our next save.
    const onStorage = (e: StorageEvent) => {
      const slug = e.key?.startsWith(KEY_PREFIX + 'progress.') ? e.key.slice((KEY_PREFIX + 'progress.').length) : null;
      const sig = slug ? this.states.get(slug) : undefined;
      if (sig && slug) sig.set(this.load(slug));
    };
    win?.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => win?.removeEventListener('storage', onStorage));
  }

  private load(slug: string): CourseProgress {
    const saved = readJson<Partial<CourseProgress>>(keyOf(slug));
    if (saved?.v !== 1 || typeof saved.q !== 'object' || !saved.q) return blankProgress();
    const b = blankProgress();
    return { ...b, ...saved, settings: { ...b.settings, ...saved.settings }, session: saved.session?.queue ? saved.session : null, history: saved.history ?? [], done: saved.done ?? [] } as CourseProgress;
  }

  private sig(slug: string): WritableSignal<CourseProgress> {
    let s = this.states.get(slug);
    if (!s) this.states.set(slug, (s = signal(this.load(slug))));
    return s;
  }

  state(slug: string): Signal<CourseProgress> {
    return this.sig(slug).asReadonly();
  }

  /** Applies `fn` to a copy, saves it and publishes it. */
  update(slug: string, fn: (draft: CourseProgress) => void): void {
    const next = structuredClone(this.sig(slug)());
    fn(next);
    next.updatedAt = Date.now();
    this.sig(slug).set(next);
    writeJson(keyOf(slug), next);
  }

  /** Clears everything for a course and returns the old state so the caller can offer an undo. */
  reset(slug: string): CourseProgress {
    const old = this.sig(slug)();
    const fresh = { ...blankProgress(), gen: old.gen + 1, updatedAt: Date.now() };
    this.sig(slug).set(fresh);
    writeJson(keyOf(slug), fresh);
    return old;
  }

  restore(slug: string, old: CourseProgress): void {
    const back = { ...old, gen: this.sig(slug)().gen + 1, updatedAt: Date.now() };
    this.sig(slug).set(back);
    writeJson(keyOf(slug), back);
  }

  /** Drops a drill or mock that points at questions no longer in the bank. */
  sanitize(slug: string, ids: Set<string>): void {
    const s = this.sig(slug)();
    const stale = (list?: string[]) => !!list?.some((id) => !ids.has(id));
    if (stale(s.session?.ids) || stale(s.mock?.ids)) {
      this.update(slug, (d) => {
        if (stale(d.session?.ids)) d.session = null;
        if (stale(d.mock?.ids)) d.mock = null;
      });
    }
  }
}
