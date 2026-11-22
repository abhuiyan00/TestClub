import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ContentService, UpcomingEvent } from '../../core/content.service';
import { PrefsStore } from '../../core/prefs.store';
import { DAY, formatWhen, relativeDay } from '../../core/time';
import { BrandMark } from '../../shared/brand-mark';
import { Icon } from '../../shared/icon';

type Menu = 'recent' | 'bell' | 'menu';

@Component({
  selector: 'tc-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, BrandMark, Icon],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  host: {
    '(document:click)': 'onDocClick($event)',
    '(document:keydown.escape)': 'open.set(null)',
    '(window:scroll)': 'onScroll()',
  },
})
export class Navbar {
  private readonly el = inject(ElementRef<HTMLElement>);
  protected readonly content = inject(ContentService);
  protected readonly prefs = inject(PrefsStore);
  protected readonly open = signal<Menu | null>(null);
  protected readonly scrolled = signal(false);
  protected readonly when = (e: UpcomingEvent) =>
    `${formatWhen(e.at, 'day')}${e.timed ? ', ' + formatWhen(e.at, 'time') : ''} · ${relativeDay(e.at)}`;

  protected readonly recent = computed(() =>
    this.prefs.prefs().recent.map((slug) => this.content.course(slug)).filter((c) => !!c),
  );

  /** Tests and retakes in the next 30 days; the badge counts the next 7. */
  protected readonly upcoming = computed(() => {
    const now = Date.now();
    return this.content.events().filter((e) => (e.end ?? e.at) > now && e.at - now < 30 * DAY);
  });
  protected readonly soon = computed(() => this.upcoming().filter((e) => e.at - Date.now() < 7 * DAY).length);

  constructor() {
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.open.set(null));
  }

  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 4);
  }

  protected toggle(m: Menu): void {
    this.open.update((o) => (o === m ? null : m));
  }

  protected onDocClick(e: MouseEvent): void {
    if (this.open() && !this.el.nativeElement.contains(e.target as Node)) this.open.set(null);
  }
}
