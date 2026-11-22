import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ContentService } from '../../core/content.service';
import { PrefsStore } from '../../core/prefs.store';
import { ProgressStore } from '../../core/progress.store';
import { countdown, formatWhen } from '../../core/time';
import { Calendar } from '../../shared/calendar';
import { CoursePattern } from '../../shared/course-pattern';
import { Icon } from '../../shared/icon';
import { ProgressRing } from '../../shared/progress-ring';
import { UpcomingList } from '../../shared/upcoming-list';
import { Scene } from '../../scene/scene';
import { CourseContext } from './course-context';

@Component({
  selector: 'tc-course-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CourseContext],
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, CoursePattern, Scene, Calendar, UpcomingList, ProgressRing],
  templateUrl: './course-shell.html',
  styleUrl: './course-shell.scss',
  host: { '(document:keydown.escape)': 'indexOpen.set(false)' },
})
export class CourseShell {
  readonly slug = input.required<string>();
  protected readonly ctx = inject(CourseContext);
  protected readonly content = inject(ContentService);
  protected readonly prefs = inject(PrefsStore);
  private readonly store = inject(ProgressStore);
  protected readonly indexOpen = signal(false);

  protected readonly sceneItems = computed(() => {
    const c = this.ctx.course();
    return c ? [{ key: c.slug, motif: c.motif, hue: c.hue }] : [];
  });
  protected readonly events = computed(() => this.content.events().filter((e) => e.course.slug === this.slug()));
  protected readonly upcoming = computed(() => this.events().filter((e) => (e.end ?? e.at) > Date.now()));
  protected readonly examLabel = computed(() => {
    const e = this.ctx.exam();
    if (!e) return '';
    const c = countdown(e.at);
    return c.d > 0 ? `${c.d} d ${c.h} h` : c.h > 0 ? `${c.h} h ${c.m} min` : `${c.m} min`;
  });
  protected readonly examDate = computed(() => {
    const e = this.ctx.exam();
    return e ? formatWhen(e.at, 'day') + (e.timed ? ', ' + formatWhen(e.at, 'time') : '') : '';
  });
  protected readonly hasBank = computed(() => this.ctx.bank.hasValue() && this.ctx.questions().length > 0);

  /** The full banner belongs to the Course tab; other tabs get a slim one so the work starts above the fold. */
  private readonly router = inject(Router);
  private readonly isSub = () => /^\/courses\/[^/]+\/./.test(this.router.url.split(/[?#]/)[0]);
  protected readonly compact = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.isSub()),
    ),
    { initialValue: this.isSub() },
  );

  constructor() {
    const title = inject(Title);
    effect(() => {
      const slug = this.slug();
      const known = !!this.content.course(slug);
      // Side effects read other signals; keep them out of this effect's dependencies.
      untracked(() => {
        this.ctx.slug.set(slug);
        this.indexOpen.set(false);
        if (known) this.prefs.visit(slug);
      });
    });
    effect(() => {
      const c = this.ctx.course();
      if (c) title.setTitle(`${c.code} · ${c.title} · TestClub`);
      else if (this.content.catalog.hasValue()) title.setTitle('Course not found · TestClub');
    });
    effect(() => {
      if (!this.ctx.bank.hasValue()) return;
      const ids = new Set(this.ctx.questions().map((q) => q.id));
      const slug = this.slug();
      untracked(() => this.store.sanitize(slug, ids));
    });
  }
}
