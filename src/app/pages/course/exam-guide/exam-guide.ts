import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PATTERN_LABEL, Pattern, slideCount } from '../../../core/models';
import { countdown, formatWhen } from '../../../core/time';
import { BarList, BarRow } from '../../../shared/bar-list';
import { Icon } from '../../../shared/icon';
import { CourseContext } from '../course-context';

@Component({
  selector: 'tc-exam-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, BarList],
  templateUrl: './exam-guide.html',
  styleUrl: './exam-guide.scss',
})
export class ExamGuidePage {
  protected readonly ctx = inject(CourseContext);
  private readonly router = inject(Router);
  protected readonly guide = computed(() => this.ctx.course()?.examGuide);

  protected readonly when = computed(() => {
    const e = this.ctx.exam();
    if (!e) return '';
    return formatWhen(e.at, 'long') + (e.timed ? `, ${formatWhen(e.at, 'time')}${e.end ? '–' + formatWhen(e.end, 'time') : ''}` : '');
  });
  protected readonly left = computed(() => {
    const e = this.ctx.exam();
    return e ? countdown(e.at) : null;
  });

  /** Expected questions out of 30 per lecture, assuming questions follow slide counts. */
  protected readonly share = computed<BarRow[]>(() => {
    const lectures = this.ctx.studyLectures().filter((l) => slideCount(l));
    const total = lectures.reduce((a, l) => a + (slideCount(l) ?? 0), 0);
    return lectures.map((l) => {
      const n = slideCount(l) ?? 0;
      const hot = this.ctx.questions().filter((q) => q.l === l.n && q.lk === 'high').length;
      const v = (n / total) * 30;
      return { label: `${this.ctx.unit()[0]}${l.n} ${l.short}`, value: v, display: '≈' + v.toFixed(1), detail: `${n} slides · ${hot} likely questions here` };
    });
  });

  protected readonly shapes = computed<BarRow[]>(() => {
    const counts = new Map<Pattern, number>();
    for (const q of this.ctx.questions()) counts.set(q.pattern, (counts.get(q.pattern) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => ({ label: PATTERN_LABEL[p], value: n }));
  });

  protected readonly past = computed<BarRow[]>(() => {
    const p = this.guide()?.pastShapes ?? [];
    const total = p.reduce((a, [, n]) => a + n, 0);
    return p.map(([label, n]) => ({ label, value: n, display: Math.round((100 * n) / total) + '%', detail: `${n} of ${total} past questions` }));
  });

  protected readonly hot = computed(() =>
    this.ctx.studyLectures().map((l) => {
      const qs = this.ctx.questions().filter((q) => q.l === l.n && q.lk === 'high');
      return { l, ids: qs.map((q) => q.id), topics: [...new Set(qs.map((q) => q.topic))] };
    }),
  );

  protected readonly traps = computed(() => {
    const b = this.ctx.bank.hasValue() ? this.ctx.bank.value() : null;
    return b ? this.ctx.studyLectures().flatMap((l) => (b.lectures[l.n]?.traps ?? []).slice(0, 3).map((t) => ({ n: l.n, t }))) : [];
  });

  protected drill(ids: string[], label: string) {
    if (this.ctx.start(ids, label)) this.router.navigate(['/courses', this.ctx.slug(), 'practice']);
  }
}
