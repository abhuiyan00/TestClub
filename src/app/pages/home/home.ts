import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ContentService } from '../../core/content.service';
import { countdown, formatWhen } from '../../core/time';
import { CoursePattern } from '../../shared/course-pattern';
import { Icon } from '../../shared/icon';
import { Tilt } from '../../shared/tilt';
import { Scene } from '../../scene/scene';

@Component({
  selector: 'tc-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Scene, CoursePattern, Tilt],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly content = inject(ContentService);
  private readonly router = inject(Router);
  protected readonly hovered = signal<string | null>(null);
  private readonly now = signal(Date.now());

  protected readonly items = computed(() => this.content.courses().map((c) => ({ key: c.slug, motif: c.motif, hue: c.hue })));
  protected readonly hoverCourse = computed(() => (this.hovered() ? this.content.course(this.hovered()!) : undefined));

  /** The nearest test across all courses. */
  protected readonly next = computed(() => {
    const now = this.now();
    const e = this.content.events().find((x) => x.kind !== 'deadline' && (x.end ?? x.at) > now);
    if (!e) return null;
    return { e, left: countdown(e.at, now), when: formatWhen(e.at, 'long') + (e.timed ? ', ' + formatWhen(e.at, 'time') : '') };
  });

  protected readonly nextPer = computed(() =>
    this.content.courses().map((c) => {
      const e = this.content.nextExam(c);
      return { c, e: e ? `${e.title} · ${formatWhen(e.at, 'day')}` : 'Test date not announced', lectures: c.lectures.filter((l) => l.status === 'available').length };
    }),
  );

  constructor() {
    const t = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  protected open(slug: string) {
    this.router.navigate(['/courses', slug]);
  }
}
