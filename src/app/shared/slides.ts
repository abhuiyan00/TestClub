import {
  ChangeDetectionStrategy, Component, ElementRef, Injectable, effect, inject, input, signal, viewChild,
} from '@angular/core';
import { ContentService } from '../core/content.service';
import { Icon } from './icon';

export interface SlideRef {
  src: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class SlideViewerService {
  readonly current = signal<SlideRef | null>(null);
  open(ref: SlideRef) {
    this.current.set(ref);
  }
  close() {
    this.current.set(null);
  }
}

/** Clickable slide preview; opens the full-size viewer. */
@Component({
  selector: 'tc-slide-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <button type="button" class="thumb" (click)="open()" [attr.aria-label]="'Enlarge ' + label()">
      @if (!failed()) {
        <img [src]="src()" alt="" loading="lazy" decoding="async" width="800" height="560" (error)="failed.set(true)" />
      } @else {
        <span class="missing">Slide image not available</span>
      }
      <span class="cap"><tc-icon name="zoom" [size]="14" /> {{ label() }}</span>
    </button>
  `,
  styles: `
    .thumb { position: relative; display: block; width: 100%; padding: 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: #fff; box-shadow: var(--shadow-1); transition: transform var(--dur-3) var(--ease-out), box-shadow var(--dur-3) var(--ease-out); }
    .thumb:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); }
    img { display: block; width: 100%; height: auto; aspect-ratio: auto 800 / 560; object-fit: contain; background: #fff; }
    .cap { position: absolute; left: 8px; bottom: 8px; display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; background: oklch(0.2 0.02 262 / 0.78); color: #fff; font-size: var(--fs-2xs); font-weight: 600; backdrop-filter: blur(4px); }
    .missing { display: grid; place-items: center; min-height: 120px; color: var(--ink-3); font-size: var(--fs-sm); background: var(--surface-2); }
  `,
})
export class SlideThumb {
  readonly slug = input.required<string>();
  readonly lecture = input.required<number>();
  readonly slide = input.required<number>();
  readonly unit = input('L');
  private readonly content = inject(ContentService);
  private readonly viewer = inject(SlideViewerService);
  protected readonly failed = signal(false);
  protected src = () => this.content.slideUrl(this.slug(), this.lecture(), this.slide());
  protected label = () => `${this.unit()}${this.lecture()} · slide ${this.slide()}`;
  protected open() {
    this.viewer.open({ src: this.src(), label: this.label() });
  }
}

/** Small inline "slide 12" link that opens the viewer. */
@Component({
  selector: 'tc-slide-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `<button type="button" class="sl" (click)="open()" [attr.aria-label]="'Show ' + label()"><tc-icon name="slides" [size]="13" /> slide {{ slide() }}</button>`,
  styles: `.sl { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border: 1px solid var(--accent-line, var(--border)); border-radius: 999px; background: var(--accent-soft, var(--surface-2)); color: var(--accent-ink, var(--ink-2)); font-size: var(--fs-2xs); font-weight: 650; white-space: nowrap; transition: background-color var(--dur-2); } .sl:hover { background: var(--accent-soft-2, var(--surface-3)); }`,
})
export class SlideLink {
  readonly slug = input.required<string>();
  readonly lecture = input.required<number>();
  readonly slide = input.required<number>();
  readonly unit = input('L');
  private readonly content = inject(ContentService);
  private readonly viewer = inject(SlideViewerService);
  protected label = () => `${this.unit()}${this.lecture()} · slide ${this.slide()}`;
  protected open() {
    this.viewer.open({ src: this.content.slideUrl(this.slug(), this.lecture(), this.slide()), label: this.label() });
  }
}

/** One modal viewer for the whole app, built on <dialog> for focus trapping and Esc. */
@Component({
  selector: 'tc-slide-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <dialog #dlg (close)="viewer.close()" (click)="onBackdrop($event)" [attr.aria-label]="viewer.current()?.label ?? 'Slide'">
      @if (viewer.current(); as s) {
        <div class="bar">
          <b>{{ s.label }}</b>
          <span class="sp"></span>
          <button type="button" class="btn ghost small" (click)="zoom.set(!zoom())" [attr.aria-pressed]="zoom()">
            <tc-icon name="zoom" [size]="15" /> {{ zoom() ? 'Fit' : 'Zoom' }}
          </button>
          <button type="button" class="btn ghost icon small" (click)="dlg.close()" aria-label="Close"><tc-icon name="x" /></button>
        </div>
        <div class="frame" [class.zoom]="zoom()">
          <img [src]="s.src" [alt]="'Lecture slide: ' + s.label" />
        </div>
      }
    </dialog>
  `,
  styles: `
    dialog { width: min(1100px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); padding: 0; border: 0; border-radius: var(--radius-lg); background: var(--surface); color: var(--ink); box-shadow: var(--shadow-3); overflow: hidden; }
    dialog[open] { animation: rise var(--dur-3) var(--ease-out) both; }
    dialog::backdrop { background: var(--scrim); backdrop-filter: blur(3px); }
    .bar { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-4); border-bottom: 1px solid var(--border); font-size: var(--fs-sm); }
    .sp { flex: 1; }
    .frame { max-height: calc(100dvh - 90px); overflow: auto; background: #fff; }
    img { display: block; width: 100%; height: auto; }
    .frame.zoom img { width: 180%; max-width: none; }
  `,
})
export class SlideViewer {
  protected readonly viewer = inject(SlideViewerService);
  protected readonly zoom = signal(false);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const open = !!this.viewer.current();
      const d = this.dlg().nativeElement;
      if (open && !d.open) {
        this.zoom.set(false);
        d.showModal();
      } else if (!open && d.open) d.close();
    });
  }

  protected onBackdrop(e: MouseEvent) {
    if (e.target === this.dlg().nativeElement) this.dlg().nativeElement.close();
  }
}
