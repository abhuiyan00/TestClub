import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

/** One short message at a time, announced politely to screen readers. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private timer?: ReturnType<typeof setTimeout>;
  private seq = 0;

  show(text: string, action?: Toast['action'], ms = action ? 8000 : 3200): void {
    clearTimeout(this.timer);
    this.current.set({ id: ++this.seq, text, action });
    this.timer = setTimeout(() => this.current.set(null), ms);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.current.set(null);
  }
}
