import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/content.service';
import { formatWhen, parseWhen } from '../../core/time';
import { BrandMark } from '../../shared/brand-mark';

@Component({
  selector: 'tc-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BrandMark],
  template: `
    <footer class="foot">
      <div class="container grid">
        <div class="about">
          <a class="brand" routerLink="/"><tc-brand-mark [size]="26" /> <span>Test<b>Club</b></span></a>
          <p>An unofficial, student-made study companion for the {{ site()?.semester ?? '' }} lecture courses. Not affiliated with the university or its course portal.</p>
        </div>
        <nav aria-label="Footer">
          <p class="h">Site</p>
          <a routerLink="/courses">My courses</a>
          <a routerLink="/dashboard">Dashboard</a>
          <a routerLink="/guide">How it works</a>
          <a routerLink="/guide" fragment="privacy">Privacy</a>
          @if (site()?.repoUrl; as repo) {
            <a [href]="repo + '/issues/new/choose'" target="_blank" rel="noopener noreferrer">Report a mistake</a>
          }
        </nav>
        <div class="notes">
          <p class="h">About the material</p>
          <p>Notes and questions are written from the lecture slides. Slide excerpts remain the property of their authors and appear in small parts, for study reference only.</p>
          @if (updated(); as u) {
            <p class="upd">Content updated {{ u }} · <a href="3rdpartylicenses.txt">Open-source licences</a></p>
          }
        </div>
      </div>
    </footer>
  `,
  styles: `
    .foot { margin-top: var(--sp-16); padding: var(--sp-10) 0 var(--sp-8); background: var(--footer-bg); color: var(--footer-ink); font-size: var(--fs-sm); }
    .grid { display: grid; gap: var(--sp-8); @media (min-width: 800px) { grid-template-columns: 1.3fr 0.7fr 1.3fr; } }
    .brand { display: inline-flex; align-items: center; gap: 10px; margin-bottom: var(--sp-3); color: #fff; font-size: 1.1rem; letter-spacing: -0.03em; text-decoration: none; b { font-weight: 750; } }
    .about p, .notes p { max-width: 52ch; line-height: 1.6; opacity: 0.85; }
    .h { margin-bottom: var(--sp-2); color: #fff; font-weight: 650; opacity: 1 !important; }
    nav { display: grid; align-content: start; gap: 6px; a { width: fit-content; color: var(--footer-ink); text-decoration: none; opacity: 0.85; &:hover { opacity: 1; text-decoration: underline; } } }
    .upd { margin-top: var(--sp-3); font-size: var(--fs-xs); opacity: 0.65 !important; a { color: inherit; } }
  `,
})
export class Footer {
  private readonly content = inject(ContentService);
  protected readonly site = this.content.site;
  protected readonly updated = computed(() => {
    const u = this.site()?.updated;
    return u ? formatWhen(parseWhen(u), 'date') : '';
  });
}
