import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ChoiceQuestion, Question, isChoice } from '../../../core/models';
import { grade } from '../../../core/mock';
import { formatWhen } from '../../../core/time';
import { AnswerText } from '../../../shared/answer-text';
import { Icon } from '../../../shared/icon';
import { SlideLink } from '../../../shared/slides';
import { CourseContext, SelfGrade } from '../course-context';

@Component({
  selector: 'tc-mock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, SlideLink, AnswerText],
  templateUrl: './mock.html',
  styleUrl: './mock.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class Mock {
  protected readonly ctx = inject(CourseContext);
  protected readonly letters = ['A', 'B', 'C', 'D'];
  protected readonly Grade = SelfGrade;
  protected readonly sizes = [10, 20, 30, 40];
  protected readonly now = signal(Date.now());
  protected readonly confirm = signal(false);
  protected readonly n = signal(this.ctx.settings().mockN);

  protected readonly m = computed(() => this.ctx.progress().mock);
  protected readonly open = computed(() => this.ctx.mockStyle() === 'open');
  protected readonly q = computed<Question | undefined>(() => {
    const m = this.m();
    return m ? this.ctx.byId().get(m.ids[m.i]) : undefined;
  });
  protected readonly qc = computed(() => {
    const q = this.q();
    return q && isChoice(q) ? (q as ChoiceQuestion) : undefined;
  });
  protected readonly answered = computed(() => this.m()?.picks.filter((p) => p !== null).length ?? 0);
  protected readonly written = computed(() => this.m()?.texts.filter((t) => t.trim()).length ?? 0);
  protected readonly left = computed(() => {
    const m = this.m();
    if (!m) return 0;
    return m.started + m.limitMin * 60_000 - this.now();
  });
  protected readonly clock = computed(() => {
    const ms = Math.abs(this.left());
    const s = Math.floor(ms / 1000);
    return `${this.left() < 0 ? '+' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  protected readonly result = computed(() => {
    const m = this.m();
    if (!m?.submitted) return null;
    const rows = m.ids.map((id, i) => {
      const q = this.ctx.byId().get(id)!;
      const p = m.picks[i];
      if (isChoice(q)) {
        const ok = p !== null && m.orders[i][p] === q.c;
        return { q, i, ok, partial: false, picked: p === null ? null : q.o[m.orders[i][p]], text: '' };
      }
      return { q, i, ok: p === SelfGrade.GotIt, partial: p === SelfGrade.Partly, picked: null, text: m.texts[i] };
    });
    const score = rows.reduce((a, r) => a + (r.ok ? 1 : r.partial ? 0.5 : 0), 0);
    const pct = Math.round((100 * score) / rows.length);
    return { rows, score, pct, grade: grade(pct), minutes: Math.max(1, Math.round(((m.finished ?? Date.now()) - m.started) / 60000)) };
  });
  protected readonly history = computed(() => this.ctx.progress().history.slice(-10).reverse());

  constructor() {
    const t = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  protected fmt = (t: number) => formatWhen(t, 'day');
  protected sizeOk = (n: number) => n <= Math.max(10, this.ctx.mockPool().length);

  protected start() {
    this.confirm.set(false);
    this.ctx.startMock(Math.min(this.n(), this.ctx.mockPool().length));
    scrollTo({ top: 0 });
  }

  protected submit() {
    const m = this.m();
    if (!m) return;
    const missing = this.open() && !m.reviewing ? 0 : m.ids.length - this.answered();
    if (missing && !this.confirm()) {
      this.confirm.set(true);
      return;
    }
    this.confirm.set(false);
    this.ctx.submitMock();
    scrollTo({ top: 0 });
  }

  protected onKey(e: KeyboardEvent) {
    const m = this.m();
    if (!m || m.submitted || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright') this.ctx.mockGo(m.i + 1);
    else if (k === 'arrowleft') this.ctx.mockGo(m.i - 1);
    else if (this.qc() && !m.reviewing) {
      const idx = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
      if (idx >= 0 && k.length === 1) this.ctx.mockPick(m.i, idx);
    } else if (m.reviewing && '123'.includes(k) && k.length === 1) this.ctx.mockPick(m.i, Number(k) - 1);
  }
}
