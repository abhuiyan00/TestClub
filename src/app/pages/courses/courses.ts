import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ContentService } from '../../core/content.service';
import { PrefsStore } from '../../core/prefs.store';
import { fold } from '../../core/search';
import { CourseCard } from '../../shared/course-card';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'tc-courses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CourseCard, Icon],
  template: `
    <div class="container page">
      <h1>My courses</h1>
      <section class="overview" aria-labelledby="ov-h">
        <h2 id="ov-h">Course overview</h2>
        <nav class="tabs" aria-label="Course filter">
          <a href="#" [class.active]="tab() === 'all'" (click)="$event.preventDefault(); tab.set('all')" [attr.aria-current]="tab() === 'all' ? 'page' : null">All</a>
          <a href="#" [class.active]="tab() === 'starred'" (click)="$event.preventDefault(); tab.set('starred')" [attr.aria-current]="tab() === 'starred' ? 'page' : null">
            Starred @if (prefs.prefs().starred.length) { <span class="badge">{{ prefs.prefs().starred.length }}</span> }
          </a>
        </nav>

        <div class="toolbar">
          <label class="select">
            <span class="sr-only">Sort courses</span>
            <tc-icon name="sort" [size]="16" />
            <select [value]="prefs.prefs().sort" (change)="prefs.setSort($any($event.target).value)">
              <option value="name">Sort by course name</option>
              <option value="next">Sort by next test</option>
            </select>
          </label>
          <label class="search-box">
            <tc-icon name="search" [size]="16" />
            <span class="sr-only">Search courses</span>
            <input class="input" type="search" placeholder="Search" [value]="q()" (input)="q.set($any($event.target).value)" />
          </label>
          <div class="seg" role="group" aria-label="Layout">
            <button type="button" [attr.aria-pressed]="prefs.prefs().view === 'card'" (click)="prefs.setView('card')" aria-label="Cards"><tc-icon name="grid" [size]="16" /></button>
            <button type="button" [attr.aria-pressed]="prefs.prefs().view === 'list'" (click)="prefs.setView('list')" aria-label="List"><tc-icon name="list" [size]="16" /></button>
          </div>
        </div>

        @if (content.catalog.isLoading()) {
          <div class="grid">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="sk"></div>
            }
          </div>
        } @else if (content.catalog.error()) {
          <div class="empty"><b>Courses could not be loaded</b><p>Check your connection and reload the page.</p></div>
        } @else {
          <div class="grid" [class.list]="prefs.prefs().view === 'list'">
            @for (c of shown(); track c.slug; let i = $index) {
              <tc-course-card class="rise" [style.--i]="i" [course]="c" [view]="prefs.prefs().view" />
            } @empty {
              <div class="empty wide">
                <tc-icon [name]="tab() === 'starred' ? 'star' : 'search'" [size]="26" />
                <b>{{ tab() === 'starred' ? 'No starred courses yet' : 'No course matches' }}</b>
                <p>{{ tab() === 'starred' ? 'Use the star on a course card to pin it here.' : 'Try another word.' }}</p>
              </div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .page { padding-top: var(--sp-10); }
    h1 { margin-bottom: var(--sp-8); }
    .overview h2 { font-size: var(--fs-xl); margin-bottom: var(--sp-3); }
    .tabs { margin-bottom: var(--sp-5); }
    .toolbar { display: flex; flex-wrap: wrap; gap: var(--sp-3); margin-bottom: var(--sp-6); }
    .search-box { width: min(260px, 100%); }
    .select { position: relative; display: inline-flex; align-items: center; tc-icon { position: absolute; left: 12px; color: var(--ink-3); pointer-events: none; } }
    select { min-height: 40px; padding: 0 var(--sp-4) 0 36px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink); font-size: var(--fs-sm); font-weight: 550; }
    .grid { display: grid; gap: var(--sp-5); grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
    .grid.list { grid-template-columns: 1fr; gap: var(--sp-3); }
    .sk { height: 340px; border-radius: var(--radius-lg); background: var(--surface-3); animation: fade 1s ease-in-out infinite alternate; }
    .wide { grid-column: 1 / -1; }
  `,
})
export class Courses {
  protected readonly content = inject(ContentService);
  protected readonly prefs = inject(PrefsStore);
  protected readonly tab = signal<'all' | 'starred'>('all');
  protected readonly q = signal('');

  protected readonly shown = computed(() => {
    const starred = this.prefs.prefs().starred;
    const term = fold(this.q().trim());
    const list = this.content
      .courses()
      .filter((c) => this.tab() === 'all' || starred.includes(c.slug))
      .filter((c) => !term || fold(`${c.code} ${c.title} ${c.summary}`).includes(term));
    if (this.prefs.prefs().sort === 'name') return [...list].sort((a, b) => a.title.localeCompare(b.title));
    const next = (c: (typeof list)[number]) => this.content.nextExam(c)?.at ?? Infinity;
    return [...list].sort((a, b) => next(a) - next(b) || a.title.localeCompare(b.title));
  });
}
