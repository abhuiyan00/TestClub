import { Directive, ElementRef, inject } from '@angular/core';

/** Cards lean towards the pointer a little. Mouse only, and never with reduced motion. */
@Directive({
  selector: '[tcTilt]',
  host: { '(pointermove)': 'move($event)', '(pointerleave)': 'reset()' },
})
export class Tilt {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)');

  protected move(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || this.still.matches) return;
    const r = this.el.nativeElement.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    const s = this.el.nativeElement.style;
    s.setProperty('--ry', `${(x * 6).toFixed(2)}deg`);
    s.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
    s.setProperty('--gx', `${((x + 0.5) * 100).toFixed(0)}%`);
    s.setProperty('--gy', `${((y + 0.5) * 100).toFixed(0)}%`);
  }

  protected reset() {
    const s = this.el.nativeElement.style;
    s.setProperty('--rx', '0deg');
    s.setProperty('--ry', '0deg');
  }
}
