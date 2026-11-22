import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { formatWhen, parseWhen } from '../../../core/time';
import { shuffle } from '../../../core/drill';
import { Icon } from '../../../shared/icon';
import { SlideLink, SlideThumb } from '../../../shared/slides';
import { CourseContext } from '../course-context';

interface Deck {
  key: string;
  order: number[];
  flipped: boolean;
  known: number;
}

@Component({
  selector: 'tc-lecture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, SlideThumb, SlideLink],
  templateUrl: './lecture.html',
  styleUrl: './lecture.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class LecturePage {
  readonly n = input.required<string>();
  readonly mode = input<string>();
  protected readonly ctx = inject(CourseContext);
  private readonly router = inject(Router);

  protected readonly num = computed(() => Number(this.n()));
  protected readonly lecture = computed(() => this.ctx.course()?.lectures.find((l) => l.n === this.num()));
  protected readonly notes = computed(() => (this.ctx.bank.hasValue() ? this.ctx.bank.value().lectures[this.num()] : undefined));
  protected readonly qCount = computed(() => this.ctx.questions().filter((q) => q.l === this.num()).length);
  protected readonly cards = computed(() => this.mode() === 'cards');
  protected readonly done = computed(() => this.ctx.progress().done.includes(this.num()));
  protected readonly unitShort = computed(() => this.ctx.unit()[0]);

  /** Neighbouring lectures that have notes, for previous / next navigation. */
  protected readonly neighbours = computed(() => {
    const list = this.ctx.studyLectures();
    const i = list.findIndex((l) => l.n === this.num());
    return { prev: i > 0 ? list[i - 1] : undefined, next: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined };
  });

  protected readonly deck = signal<Deck | null>(null);
  protected readonly card = computed(() => {
    const d = this.deck();
    const n = this.notes();
    return d && n && d.order.length ? n.facts[d.order[0]] : undefined;
  });

  protected readonly date = computed(() => {
    const d = this.lecture()?.date;
    return d ? formatWhen(parseWhen(d), 'long') : '';
  });

  constructor() {
    const title = inject(Title);
    effect(() => {
      const l = this.lecture();
      const c = this.ctx.course();
      if (l && c) title.setTitle(`${l.short} · ${c.code} · TestClub`);
    });
    // A fresh shuffled deck whenever the lecture or its notes change.
    effect(() => {
      const n = this.notes();
      const key = this.ctx.slug() + this.num();
      if (n && this.deck()?.key !== key) this.deck.set({ key, order: shuffle(n.facts.map((_, i) => i)), flipped: false, known: 0 });
    });
  }

  protected setMode(cards: boolean) {
    this.router.navigate([], { queryParams: { mode: cards ? 'cards' : null }, replaceUrl: true });
  }

  protected flip() {
    this.deck.update((d) => d && { ...d, flipped: !d.flipped });
  }

  protected again() {
    this.deck.update((d) => d && { ...d, order: [...d.order.slice(1), d.order[0]], flipped: false });
  }

  protected know() {
    this.deck.update((d) => d && { ...d, order: d.order.slice(1), known: d.known + 1, flipped: false });
  }

  protected reshuffle() {
    const n = this.notes();
    if (n) this.deck.set({ key: this.ctx.slug() + this.num(), order: shuffle(n.facts.map((_, i) => i)), flipped: false, known: 0 });
  }

  protected practise() {
    const l = this.lecture();
    const ids = this.ctx.questions().filter((q) => q.l === this.num()).map((q) => q.id);
    if (l && this.ctx.start(ids, `${this.ctx.unit()} ${l.n} · ${l.short}`)) this.router.navigate(['/courses', this.ctx.slug(), 'practice']);
  }

  protected onKey(e: KeyboardEvent) {
    if (!this.cards() || !this.card() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, a, button:not(.flash-face)')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.flip();
    } else if (e.key === '1') this.again();
    else if (e.key === '2') this.know();
  }
}
