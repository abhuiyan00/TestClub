import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgressStore } from '../../../core/progress.store';
import { calibration } from '../../../core/srs';
import { formatWhen } from '../../../core/time';
import { ToastService } from '../../../core/toast.service';
import { BarList, BarRow } from '../../../shared/bar-list';
import { Icon } from '../../../shared/icon';
import { ProgressRing } from '../../../shared/progress-ring';
import { CourseContext } from '../course-context';

/** The portal's "Grades" page, for practice: mastery per lecture, mock results, calibration. */
@Component({
  selector: 'tc-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProgressRing, BarList],
  templateUrl: './progress.html',
  styleUrl: './progress.scss',
})
export class ProgressPage {
  protected readonly ctx = inject(CourseContext);
  private readonly store = inject(ProgressStore);
  private readonly toast = inject(ToastService);
  protected readonly confirmReset = signal(false);

  protected readonly rows = computed(() =>
    this.ctx.studyLectures().map((l) => {
      const t = this.ctx.lectureTotals(l.n);
      return { l, t, secure: t.n ? t.l3 / t.n : 0, acc: t.answered ? t.right / t.answered : null };
    }),
  );
  protected readonly calib = computed(() => calibration(this.ctx.progress().q));
  protected readonly history = computed<BarRow[]>(() =>
    this.ctx.progress().history.slice(-10).map((h) => ({ label: formatWhen(h.t, 'day'), value: h.pct, display: h.pct + '%', detail: `${h.n} questions` })),
  );
  protected readonly accuracy = computed(() => {
    const t = this.ctx.totals();
    return t.answered ? Math.round((100 * t.right) / t.answered) : 0;
  });

  protected pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

  protected reset() {
    if (!this.confirmReset()) {
      this.confirmReset.set(true);
      return;
    }
    this.confirmReset.set(false);
    const slug = this.ctx.slug();
    const old = this.store.reset(slug);
    this.toast.show('Progress for this course was reset.', { label: 'Undo', run: () => this.store.restore(slug, old) });
  }
}
