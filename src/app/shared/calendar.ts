import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UpcomingEvent } from '../core/content.service';
import { formatWhen, isoDay } from '../core/time';
import { Icon } from './icon';

interface Cell {
  key: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  events: UpcomingEvent[];
}

/** Month view, Monday first, like the portal's calendar block. Days with tests carry course-coloured dots. */
@Component({
  selector: 'tc-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  template: `
    <div class="cal">
      <div class="head">
        <b aria-live="polite">{{ title() }}</b>
        <span class="sp"></span>
        <button type="button" class="btn ghost icon small" (click)="shift(-1)" aria-label="Previous month"><tc-icon name="chevron-left" /></button>
        <button type="button" class="btn ghost icon small" (click)="shift(1)" aria-label="Next month"><tc-icon name="chevron-right" /></button>
      </div>
      <div class="grid" role="grid" [attr.aria-label]="title()">
        @for (d of weekdays; track d) {
          <span class="wd" role="columnheader">{{ d }}</span>
        }
        @for (c of cells(); track c.key) {
          <button type="button" class="day" role="gridcell" [class.out]="!c.inMonth" [class.today]="c.today" [class.has]="c.events.length"
            [class.sel]="selected() === c.key" (click)="selected.set(selected() === c.key ? null : c.key)"
            [attr.aria-label]="label(c)" [disabled]="!c.events.length && !c.today">
            {{ c.day }}
            @if (c.events.length) {
              <span class="dots">
                @for (e of c.events; track $index) {
                  <i class="hue" [style.--hue]="e.course.hue"></i>
                }
              </span>
            }
          </button>
        }
      </div>
      @if (selectedEvents().length) {
        <ul class="list">
          @for (e of selectedEvents(); track $index) {
            <li class="hue" [style.--hue]="e.course.hue">
              <i></i>
              <a [routerLink]="['/courses', e.course.slug]"><b>{{ e.course.code }}</b> {{ e.title }}</a>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .cal { font-size: var(--fs-sm); }
    .head { display: flex; align-items: center; gap: 2px; margin-bottom: var(--sp-2); b { font-weight: 650; } }
    .sp { flex: 1; }
    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
    .wd { padding: 6px 0; color: var(--ink-3); font-size: var(--fs-2xs); font-weight: 600; }
    .day { position: relative; aspect-ratio: 1; min-height: 34px; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--ink-2); font-size: var(--fs-xs); font-variant-numeric: tabular-nums; transition: background-color var(--dur-2); }
    .day:disabled { cursor: default; }
    .day.out { color: var(--ink-3); opacity: 0.45; }
    .day.has { color: var(--ink); font-weight: 650; }
    .day.has:hover, .day.sel { background: var(--surface-3); }
    .day.today { background: var(--primary); color: var(--on-primary); font-weight: 700; box-shadow: var(--shadow-1); }
    .dots { position: absolute; left: 0; right: 0; bottom: 4px; display: flex; justify-content: center; gap: 2px; }
    .dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 1px var(--surface); }
    .list { margin: var(--sp-3) 0 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .list li { display: flex; align-items: center; gap: 8px; }
    .list i { width: 8px; height: 8px; border-radius: 2px; background: var(--accent); flex: none; }
    .list a { color: var(--ink); text-decoration: none; } .list a:hover { text-decoration: underline; }
  `,
})
export class Calendar {
  readonly events = input<UpcomingEvent[]>([]);
  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  private readonly todayKey = isoDay(Date.now());
  /** First of the shown month as [year, monthIndex]. */
  protected readonly month = signal<[number, number]>([Number(this.todayKey.slice(0, 4)), Number(this.todayKey.slice(5, 7)) - 1]);
  protected readonly selected = signal<string | null>(null);

  protected readonly title = computed(() => {
    const [y, m] = this.month();
    return formatWhen(Date.UTC(y, m, 15, 12), 'month');
  });

  protected readonly cells = computed<Cell[]>(() => {
    const [y, m] = this.month();
    const byDay = new Map<string, UpcomingEvent[]>();
    for (const e of this.events()) {
      const k = isoDay(e.at);
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    }
    const first = new Date(Date.UTC(y, m, 1, 12));
    const lead = (first.getUTCDay() + 6) % 7;
    const out: Cell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(Date.UTC(y, m, 1 - lead + i, 12));
      const key = d.toISOString().slice(0, 10);
      out.push({ key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === m, today: key === this.todayKey, events: byDay.get(key) ?? [] });
    }
    // Drop a trailing week that lies entirely in the next month.
    return out.slice(35).every((c) => !c.inMonth) ? out.slice(0, 35) : out;
  });

  protected readonly selectedEvents = computed(() => this.cells().find((c) => c.key === this.selected())?.events ?? []);

  protected shift(by: number) {
    const [y, m] = this.month();
    const d = new Date(Date.UTC(y, m + by, 1));
    this.month.set([d.getUTCFullYear(), d.getUTCMonth()]);
    this.selected.set(null);
  }

  protected label(c: Cell): string {
    const base = formatWhen(Date.parse(c.key + 'T12:00:00Z'), 'long');
    return c.events.length ? `${base}: ${c.events.map((e) => `${e.course.code} ${e.title}`).join(', ')}` : base;
  }
}
