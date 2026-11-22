import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { KEY_PREFIX, readJson, writeJson } from './storage';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Prefs {
  v: 1;
  theme: ThemePref;
  starred: string[];
  recent: string[];
  view: 'card' | 'list';
  sort: 'name' | 'next';
  /** Right-hand block drawer (calendar, upcoming) open on wide screens. */
  blocks: boolean;
}

const KEY = KEY_PREFIX + 'prefs';
const blank = (): Prefs => ({ v: 1, theme: 'system', starred: [], recent: [], view: 'card', sort: 'name', blocks: true });

/** Site-wide preferences, kept in this browser only. */
@Injectable({ providedIn: 'root' })
export class PrefsStore {
  private readonly doc = inject(DOCUMENT);
  private readonly state = signal<Prefs>(this.load());
  private readonly systemDark = signal(false);

  readonly prefs = this.state.asReadonly();
  readonly dark = computed(() => (this.state().theme === 'system' ? this.systemDark() : this.state().theme === 'dark'));

  constructor() {
    const mq = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (mq) {
      this.systemDark.set(mq.matches);
      const on = (e: MediaQueryListEvent) => this.systemDark.set(e.matches);
      mq.addEventListener('change', on);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', on));
    }
    effect(() => {
      const t = this.state().theme;
      const root = this.doc.documentElement;
      if (t === 'system') delete root.dataset['theme'];
      else root.dataset['theme'] = t;
    });
    effect(() => writeJson(KEY, this.state()));
  }

  private load(): Prefs {
    const saved = readJson<Partial<Prefs>>(KEY);
    return saved?.v === 1 ? { ...blank(), ...saved } : blank();
  }

  private patch(p: Partial<Prefs>) {
    this.state.update((s) => ({ ...s, ...p }));
  }

  toggleTheme() {
    this.patch({ theme: this.dark() ? 'light' : 'dark' });
  }

  toggleStar(slug: string) {
    const s = this.state().starred;
    this.patch({ starred: s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug] });
  }

  visit(slug: string) {
    this.patch({ recent: [slug, ...this.state().recent.filter((x) => x !== slug)].slice(0, 5) });
  }

  setView(view: Prefs['view']) {
    this.patch({ view });
  }

  setSort(sort: Prefs['sort']) {
    this.patch({ sort });
  }

  setBlocks(blocks: boolean) {
    this.patch({ blocks });
  }
}
