import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Six wedges, one per course colour, forming one hexagon: six courses, one club. */
const HUES = [340, 20, 60, 150, 200, 285];
const WEDGES = HUES.map((hue, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  const b = a + Math.PI / 3;
  const p = (t: number) => `${(16 + 15 * Math.cos(t)).toFixed(2)} ${(16 + 15 * Math.sin(t)).toFixed(2)}`;
  return { d: `M16 16 L${p(a)} L${p(b)} Z`, fill: `oklch(0.66 0.17 ${hue})` };
});

@Component({
  selector: 'tc-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 32 32" [attr.width]="size()" [attr.height]="size()">
      @for (w of wedges; track $index) {
        <path [attr.d]="w.d" [attr.fill]="w.fill" stroke="var(--surface)" stroke-width="0.8" stroke-linejoin="round" />
      }
      <circle cx="16" cy="16" r="5.2" fill="var(--surface)" />
      <path d="M13.4 16.2l1.8 1.8 3.6-3.8" fill="none" stroke="var(--ink)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  styles: `:host { display: inline-flex; } svg { display: block; transition: transform var(--dur-4) var(--ease-spring); } :host(:hover) svg { transform: rotate(60deg); }`,
})
export class BrandMark {
  readonly size = input(30);
  protected readonly wedges = WEDGES;
}
