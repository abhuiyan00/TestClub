import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { essentials, readMinutes } from '../../../core/essentials';
import { EssentialsList } from '../../../shared/essentials-list';
import { Icon } from '../../../shared/icon';
import { CourseContext } from '../course-context';

/** The whole course on one page: every lecture's essentials, for a first pass or a last look. */
@Component({
  selector: 'tc-essentials-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EssentialsList, Icon],
  template: `
    @if (ctx.bank.isLoading()) {
      <p class="muted">Loading essentials…</p>
    } @else if (!sections().length) {
      <div class="empty">
        <tc-icon name="hourglass" [size]="28" />
        <b>Essentials on the way</b>
        <p>They appear here once this course has study notes.</p>
      </div>
    } @else {
      <header>
        <p class="eyebrow">Essentials</p>
        <h2>The whole course in about {{ total() }} min</h2>
        <p class="muted">One line per idea. Read a {{ ctx.unit().toLowerCase() }}, then check yourself with its likely questions.</p>
      </header>
      @for (s of sections(); track s.l.n) {
        <section [attr.aria-labelledby]="'ess-' + s.l.n">
          <div class="section-head">
            <h2 [id]="'ess-' + s.l.n">{{ s.l.n }}. {{ s.l.title }}</h2>
            <a class="btn small" [routerLink]="['../lectures', s.l.n]">{{ s.minutes }} min · check yourself <tc-icon name="arrow-right" [size]="14" /></a>
          </div>
          <tc-essentials-list [items]="s.items" [slug]="ctx.slug()" [lecture]="s.l.n" [unit]="ctx.unit()[0]" />
        </section>
      }
    }
  `,
  styles: `
    :host { display: grid; gap: var(--sp-6); }
    header h2 { font-size: var(--fs-2xl); margin: var(--sp-1) 0 var(--sp-2); }
  `,
})
export class EssentialsPage {
  protected readonly ctx = inject(CourseContext);
  protected readonly sections = computed(() => {
    const lectures = this.ctx.bank.hasValue() ? this.ctx.bank.value().lectures : {};
    return this.ctx
      .studyLectures()
      .filter((l) => lectures[l.n]?.facts.length)
      .map((l) => {
        const items = essentials(lectures[l.n]);
        return { l, items, minutes: readMinutes(items) };
      });
  });
  protected readonly total = computed(() => this.sections().reduce((a, s) => a + s.minutes, 0));
}
