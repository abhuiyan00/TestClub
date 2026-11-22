import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UpcomingEvent } from '../core/content.service';
import { formatWhen, relativeDay } from '../core/time';

/** Timeline rows: date tile, course colour, title, place and how far away it is. */
@Component({
  selector: 'tc-upcoming-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <ol class="tl">
      @for (e of events(); track e.course.slug + e.at + e.title; let i = $index) {
        <li class="hue rise" [style.--hue]="e.course.hue" [style.--i]="i">
          <span class="date" aria-hidden="true"><b>{{ day(e.at) }}</b><small>{{ mon(e.at) }}</small></span>
          <span class="body">
            <a [routerLink]="['/courses', e.course.slug]" class="t"><span class="code">{{ e.course.code }}</span> {{ e.title }}</a>
            <small>{{ when(e) }}</small>
            @if (e.note && !compact()) {
              <small class="note">{{ e.note }}</small>
            }
          </span>
          <span class="rel" [class.soon]="soon(e.at)">{{ rel(e.at) }}</span>
        </li>
      } @empty {
        <li class="none">Nothing scheduled yet. Dates appear here as soon as they are announced.</li>
      }
    </ol>
  `,
  styles: `
    .tl { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--sp-2); }
    li { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2); border-radius: var(--radius); transition: background-color var(--dur-2); }
    li:hover { background: var(--surface-2); }
    .date { flex: none; display: grid; place-items: center; width: 46px; height: 50px; border-radius: var(--radius-sm); background: var(--accent-soft-2); color: var(--accent-ink); line-height: 1; }
    .date b { font-size: 1.2rem; font-weight: 750; font-variant-numeric: tabular-nums; }
    .date small { font-size: var(--fs-2xs); font-weight: 650; text-transform: uppercase; letter-spacing: 0.06em; }
    .body { flex: 1; min-width: 0; display: grid; gap: 1px; }
    .t { color: var(--ink); font-weight: 600; text-decoration: none; font-size: var(--fs-sm); } .t:hover { text-decoration: underline; }
    .code { color: var(--accent-ink); font-weight: 750; }
    small { color: var(--ink-3); font-size: var(--fs-xs); }
    .note { color: var(--ink-2); }
    .rel { flex: none; font-size: var(--fs-xs); font-weight: 600; color: var(--ink-3); white-space: nowrap; }
    .rel.soon { color: var(--bad); }
    .none { color: var(--ink-3); font-size: var(--fs-sm); padding: var(--sp-3); }
  `,
})
export class UpcomingList {
  readonly events = input<UpcomingEvent[]>([]);
  readonly compact = input(false);
  protected day = (t: number) => formatWhen(t, 'dayNum');
  protected mon = (t: number) => formatWhen(t, 'mon');
  protected rel = (t: number) => relativeDay(t);
  protected soon = (t: number) => t - Date.now() < 7 * 86_400_000;
  protected when = (e: UpcomingEvent) =>
    formatWhen(e.at, 'long') +
    (e.timed ? ', ' + formatWhen(e.at, 'time') + (e.end ? '–' + formatWhen(e.end, 'time') : '') : '') +
    (e.where ? ' · ' + e.where : '');
}
