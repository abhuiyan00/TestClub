import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content.service';
import { PrefsStore } from '../../core/prefs.store';
import { ProgressStore } from '../../core/progress.store';
import { DAY, relativeDay } from '../../core/time';
import { Calendar } from '../../shared/calendar';
import { CourseCard } from '../../shared/course-card';
import { Icon } from '../../shared/icon';
import { UpcomingList } from '../../shared/upcoming-list';

type Range = '7' | '30' | 'all' | 'past';

@Component({
  selector: 'tc-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Calendar, CourseCard, Icon, UpcomingList],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly content = inject(ContentService);
  protected readonly prefs = inject(PrefsStore);
  private readonly store = inject(ProgressStore);
  protected readonly range = signal<Range>('30');

  protected readonly timeline = computed(() => {
    const now = Date.now();
    const r = this.range();
    const ev = this.content.events();
    if (r === 'past') return ev.filter((e) => (e.end ?? e.at) <= now).reverse();
    return ev.filter((e) => (e.end ?? e.at) > now && (r === 'all' || e.at - now <= Number(r) * DAY));
  });

  protected readonly recent = computed(() =>
    this.prefs.prefs().recent.map((s) => this.content.course(s)).filter((c) => !!c).slice(0, 3),
  );

  /** One line per course from this browser's saved progress; no course file needs to load. */
  protected readonly glance = computed(() =>
    this.content.courses().map((c) => {
      const p = this.store.state(c.slug)();
      const recs = Object.values(p.q);
      const avail = c.lectures.filter((l) => l.status === 'available').length;
      return {
        c,
        done: p.done.length,
        avail,
        answered: recs.reduce((a, r) => a + r.n, 0),
        toFix: recs.filter((r) => r.last === 0).length,
        last: p.updatedAt ? relativeDay(p.updatedAt) : 'not started',
      };
    }),
  );
}
