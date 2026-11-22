import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Circular meter. The visible number is in the projected content; the ring itself is decorative. */
@Component({
  selector: 'tc-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + size() + ' ' + size()" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <circle [attr.cx]="c()" [attr.cy]="c()" [attr.r]="r()" class="track" [attr.stroke-width]="stroke()" />
      <circle [attr.cx]="c()" [attr.cy]="c()" [attr.r]="r()" class="bar" [attr.stroke-width]="stroke()"
        [attr.stroke-dasharray]="len()" [attr.stroke-dashoffset]="offset()" [attr.transform]="'rotate(-90 ' + c() + ' ' + c() + ')'" />
    </svg>
    <div class="in"><ng-content /></div>
  `,
  styles: `
    :host { position: relative; display: inline-grid; place-items: center; }
    svg { display: block; }
    circle { fill: none; }
    .track { stroke: var(--surface-3); }
    .bar { stroke: var(--accent, var(--primary)); stroke-linecap: round; transition: stroke-dashoffset 900ms var(--ease-out); }
    .in { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; line-height: 1.1; }
  `,
})
export class ProgressRing {
  readonly value = input(0);
  readonly size = input(64);
  readonly stroke = input(6);
  protected readonly c = computed(() => this.size() / 2);
  protected readonly r = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly len = computed(() => 2 * Math.PI * this.r());
  protected readonly offset = computed(() => this.len() * (1 - Math.max(0, Math.min(1, this.value()))));
}
