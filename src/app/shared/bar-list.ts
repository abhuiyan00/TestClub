import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarRow {
  label: string;
  value: number;
  /** Text shown at the end of the bar; defaults to the value. */
  display?: string;
  /** Extra detail on hover. */
  detail?: string;
}

/**
 * Single-series horizontal bars: one hue (the course accent), values in ink beside each bar,
 * thin marks with rounded data ends on a recessive track. The numbers are always visible, so the
 * chart doubles as its own table.
 */
@Component({
  selector: 'tc-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="bars" [attr.aria-label]="label()">
      @for (r of rows(); track r.label; let i = $index) {
        <li [title]="r.detail ?? ''">
          <span class="t">{{ r.label }}</span>
          <span class="track" aria-hidden="true"><i [style.width.%]="(r.value / max()) * 100" [style.--i]="i"></i></span>
          <span class="v">{{ r.display ?? r.value }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .bars { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
    li { display: grid; grid-template-columns: minmax(90px, 38%) 1fr auto; align-items: center; gap: var(--sp-3); font-size: var(--fs-sm); padding: 2px 4px; margin: 0 -4px; border-radius: var(--radius-xs); }
    li:hover { background: var(--surface-2); }
    .t { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { height: 10px; border-radius: 0 999px 999px 0; background: var(--surface-3); overflow: hidden; }
    i { display: block; height: 100%; min-width: 3px; border-radius: 0 4px 4px 0; background: var(--accent, var(--primary)); transform-origin: left; animation: grow var(--dur-4) var(--ease-out) both; animation-delay: calc(var(--i) * 40ms); }
    .v { min-width: 3.5ch; text-align: right; color: var(--ink); font-weight: 650; font-variant-numeric: tabular-nums; }
    @keyframes grow { from { transform: scaleX(0); } }
  `,
})
export class BarList {
  readonly rows = input.required<BarRow[]>();
  readonly label = input('');
  protected readonly max = computed(() => Math.max(1e-9, ...this.rows().map((r) => r.value)));
}
