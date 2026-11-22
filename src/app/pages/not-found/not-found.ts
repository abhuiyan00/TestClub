import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'tc-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="container page">
      <p class="code" aria-hidden="true">404</p>
      <h1>This page is not here</h1>
      <p class="muted">The link may be old, or the page has moved.</p>
      <div class="cta">
        <a class="btn primary" routerLink="/courses"><tc-icon name="library" [size]="16" /> My courses</a>
        <a class="btn ghost" routerLink="/">Home</a>
      </div>
    </div>
  `,
  styles: `
    .page { display: grid; justify-items: center; gap: var(--sp-3); padding-block: var(--sp-16); text-align: center; }
    .code { font-family: var(--font-mono); font-size: clamp(4rem, 10vw, 7rem); font-weight: 700; line-height: 1; background: linear-gradient(90deg, oklch(0.6 0.17 340), oklch(0.6 0.17 200), oklch(0.6 0.17 60)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .cta { display: flex; gap: var(--sp-3); margin-top: var(--sp-4); }
  `,
})
export class NotFound {}
