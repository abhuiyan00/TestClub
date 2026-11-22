import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../core/content.service';
import { CourseMeta } from '../core/models';
import { PrefsStore } from '../core/prefs.store';
import { ProgressStore } from '../core/progress.store';
import { formatWhen, relativeDay } from '../core/time';
import { CoursePattern } from './course-pattern';
import { Icon } from './icon';
import { Tilt } from './tilt';

/** A course tile in the portal's "Course overview" style: artwork, semester chip, title, completion, View course. */
@Component({
  selector: 'tc-course-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CoursePattern, Icon, Tilt],
  templateUrl: './course-card.html',
  styleUrl: './course-card.scss',
  host: { class: 'hue', '[style.--hue]': 'course().hue', '[class.list]': "view() === 'list'" },
})
export class CourseCard {
  readonly course = input.required<CourseMeta>();
  readonly view = input<'card' | 'list'>('card');
  protected readonly content = inject(ContentService);
  protected readonly prefs = inject(PrefsStore);
  private readonly store = inject(ProgressStore);

  protected readonly starred = computed(() => this.prefs.prefs().starred.includes(this.course().slug));
  protected readonly available = computed(() => this.course().lectures.filter((l) => l.status === 'available'));
  protected readonly complete = computed(() => {
    const done = this.store.state(this.course().slug)().done;
    const avail = this.available();
    return avail.length ? avail.filter((l) => done.includes(l.n)).length / avail.length : 0;
  });
  protected readonly next = computed(() => {
    const e = this.content.nextExam(this.course());
    return e ? { title: e.title, when: formatWhen(e.at, 'day'), rel: relativeDay(e.at) } : null;
  });
}
