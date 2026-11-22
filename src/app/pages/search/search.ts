import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, effect, inject, input, resource, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ContentService } from '../../core/content.service';
import { CourseBank } from '../../core/models';
import { HitKind, SearchHit, fold, search } from '../../core/search';
import { Icon } from '../../shared/icon';
import { SlideLink } from '../../shared/slides';

const KIND: Record<HitKind, string> = { fact: 'Key fact', formula: 'Formula', trap: 'Mix-up', question: 'Question' };

/** Splits text into plain and matching parts so matches can be marked without HTML strings. */
function segments(text: string, terms: string[]): { t: string; hit: boolean }[] {
  if (!terms.length) return [{ t: text, hit: false }];
  const f = fold(text);
  const marks = new Array<boolean>(text.length).fill(false);
  for (const term of terms) for (let i = f.indexOf(term); i >= 0; i = f.indexOf(term, i + 1)) marks.fill(true, i, i + term.length);
  const out: { t: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out.at(-1);
    if (last && last.hit === marks[i]) last.t += text[i];
    else out.push({ t: text[i], hit: marks[i] });
  }
  return out;
}

@Component({
  selector: 'tc-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, SlideLink],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchPage {
  readonly q = input<string>('');
  protected readonly content = inject(ContentService);
  private readonly router = inject(Router);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  protected readonly term = signal('');
  protected readonly only = signal<string | null>(null);
  protected readonly kind = KIND;

  /** Every course's notes, loaded once when the page opens. */
  protected readonly banks = resource({
    params: () => (this.content.catalog.hasValue() ? this.content.courses().map((c) => c.slug) : undefined),
    loader: async ({ params }) => {
      const loaded = await Promise.allSettled(params.map((slug) => this.content.bank(slug)));
      return params.flatMap((slug, i) => (loaded[i].status === 'fulfilled' ? [{ slug, bank: (loaded[i] as PromiseFulfilledResult<CourseBank>).value }] : []));
    },
  });

  protected readonly terms = computed(() => fold(this.term()).split(/\s+/).filter((t) => t.length > 0));
  protected readonly hits = computed<SearchHit[]>(() => {
    const sources = (this.banks.hasValue() ? this.banks.value() : []).filter((s) => !this.only() || s.slug === this.only());
    return search(sources, this.term());
  });
  protected readonly grouped = computed(() => {
    const by = new Map<string, SearchHit[]>();
    for (const h of this.hits()) by.set(h.slug, [...(by.get(h.slug) ?? []), h]);
    return [...by.entries()].map(([slug, hits]) => ({ course: this.content.course(slug)!, hits }));
  });

  constructor() {
    effect(() => this.term.set(this.q() ?? ''));
    afterNextRender(() => this.box()?.nativeElement.focus());
  }

  protected seg = (text: string) => segments(text, this.terms());
  protected unit = (slug: string) => (this.content.course(slug)?.unit ?? 'Lecture')[0];

  protected onInput(v: string) {
    this.term.set(v);
    this.router.navigate([], { queryParams: { q: v || null }, replaceUrl: true });
  }
}
