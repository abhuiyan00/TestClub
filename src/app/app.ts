import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Navbar } from './layout/navbar/navbar';
import { Footer } from './layout/footer/footer';
import { ToastService } from './core/toast.service';
import { Icon } from './shared/icon';
import { SlideViewer } from './shared/slides';

@Component({
  selector: 'tc-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Navbar, Footer, Icon, SlideViewer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class App {
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** "/" jumps to search from anywhere, unless you are typing. */
  protected onKey(e: KeyboardEvent): void {
    const t = e.target instanceof Element ? e.target : null;
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || t?.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    this.router.navigateByUrl('/search');
  }
}
