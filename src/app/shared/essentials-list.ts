import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Essential } from '../core/essentials';
import { SlideLink } from './slides';

/** One line per idea: the term, what it means, and its slide. */
@Component({
  selector: 'tc-essentials-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlideLink],
  template: `
    <dl class="card">
      @for (x of items(); track $index) {
        <div>
          <dt>{{ x.t }}</dt>
          <dd>{{ x.gist }}</dd>
          <dd class="ref"><tc-slide-link [slug]="slug()" [lecture]="lecture()" [slide]="x.slide" [unit]="unit()" /></dd>
        </div>
      }
    </dl>
  `,
  styles: `
    dl { margin: 0; padding: 0 var(--sp-5); }
    div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px var(--sp-4); align-items: start; padding: var(--sp-3) 0; border-bottom: 1px solid var(--border); }
    div:last-child { border-bottom: 0; }
    dt { font-weight: 650; }
    dd { margin: 0; grid-column: 1; color: var(--ink-2); line-height: 1.5; }
    .ref { grid-column: 2; grid-row: 1; }
    @media (min-width: 760px) {
      div { grid-template-columns: 220px minmax(0, 1fr) auto; }
      dd { grid-column: 2; }
      .ref { grid-column: 3; }
    }
  `,
})
export class EssentialsList {
  readonly items = input.required<Essential[]>();
  readonly slug = input.required<string>();
  readonly lecture = input.required<number>();
  readonly unit = input('L');
}
