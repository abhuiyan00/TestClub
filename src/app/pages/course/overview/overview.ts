import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ContentService } from '../../../core/content.service';
import { essentials, readMinutes } from '../../../core/essentials';
import { LectureMeta, LectureNotes } from '../../../core/models';
import { formatWhen, parseWhen } from '../../../core/time';
import { Icon } from '../../../shared/icon';
import { CourseContext } from '../course-context';

interface Group {
  part?: string;
  lectures: LectureMeta[];
}

@Component({
  selector: 'tc-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  protected readonly ctx = inject(CourseContext);
  private readonly content = inject(ContentService);
  private readonly router = inject(Router);
  protected readonly now = Date.now();
  /** Collapsed section keys; everything starts expanded, as on the portal. */
  protected readonly collapsed = signal(new Set<string>());

  protected ess = essentials;
  protected minutes = (n: LectureNotes) => readMinutes(essentials(n));

  protected readonly groups = computed<Group[]>(() => {
    const out: Group[] = [];
    for (const l of this.ctx.course()?.lectures ?? []) {
      const last = out.at(-1);
      if (last && last.part === l.part) last.lectures.push(l);
      else out.push({ part: l.part, lectures: [l] });
    }
    return out;
  });

  protected readonly events = computed(() => this.content.events().filter((e) => e.course.slug === this.ctx.slug()));
  protected readonly notes = computed(() => (this.ctx.bank.hasValue() ? this.ctx.bank.value().lectures : {}));
  protected readonly qCount = computed(() => {
    const m = new Map<number, number>();
    for (const q of this.ctx.questions()) m.set(q.l, (m.get(q.l) ?? 0) + 1);
    return m;
  });
  protected readonly allKeys = computed(() => ['general', ...(this.ctx.course()?.lectures ?? []).map((l) => 'l' + l.n), ...this.events().map((_, i) => 'e' + i)]);
  protected readonly allCollapsed = computed(() => this.collapsed().size >= this.allKeys().length);

  protected isOpen = (key: string) => !this.collapsed().has(key);

  protected toggle(key: string) {
    this.collapsed.update((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  protected toggleAll() {
    this.collapsed.set(this.allCollapsed() ? new Set() : new Set(this.allKeys()));
  }

  protected longDate = (d?: string) => (d ? formatWhen(parseWhen(d), 'long') : '');
  protected eventWhen(e: { at: number; end?: number; timed: boolean }) {
    return formatWhen(e.at, 'long') + (e.timed ? `, ${formatWhen(e.at, 'time')}${e.end ? '–' + formatWhen(e.end, 'time') : ''}` : '');
  }
  protected secure(n: number) {
    const t = this.ctx.lectureTotals(n);
    return t.n ? t.l3 / t.n : 0;
  }

  protected practise(l: LectureMeta) {
    const ids = this.ctx.questions().filter((q) => q.l === l.n).map((q) => q.id);
    if (this.ctx.start(ids, `${this.ctx.unit()} ${l.n} · ${l.short}`)) this.router.navigate(['/courses', this.ctx.slug(), 'practice']);
  }
}
