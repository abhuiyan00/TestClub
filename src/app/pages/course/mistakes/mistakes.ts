import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { isChoice } from '../../../core/models';
import { AnswerText } from '../../../shared/answer-text';
import { Icon } from '../../../shared/icon';
import { SlideLink } from '../../../shared/slides';
import { CourseContext } from '../course-context';

@Component({
  selector: 'tc-mistakes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, SlideLink, AnswerText],
  template: `
    @if (!list().length) {
      <div class="empty">
        <tc-icon name="circle-check" [size]="30" />
        <b>Nothing to fix</b>
        <p>Questions you get wrong land here with the answer you picked. They leave as soon as you answer them correctly; spaced review then brings them back on later days.</p>
        <a class="btn primary" routerLink="../practice"><tc-icon name="play" [size]="16" /> Practise</a>
      </div>
    } @else {
      <div class="head">
        <div>
          <p class="eyebrow">Mistakes</p>
          <h2>{{ list().length }} {{ list().length === 1 ? 'question' : 'questions' }} to fix</h2>
          <p class="muted">Mistakes you were sure about come first: they are the easiest to fix once you see why, and the likeliest to come back.</p>
        </div>
        <button type="button" class="btn primary" (click)="drill()"><tc-icon name="play" [size]="16" /> Drill all {{ list().length }}</button>
      </div>
      <ol class="list">
        @for (m of list(); track m.q.id; let i = $index) {
          <li class="card rise" [style.--i]="i % 10">
            <div class="meta">
              <span class="lec">{{ ctx.unit()[0] }}{{ m.q.l }}</span>
              <span>{{ m.q.topic }}</span>
              @if (m.confident) {
                <span class="badge bad">you were sure</span>
              }
              <tc-slide-link [slug]="ctx.slug()" [lecture]="m.q.l" [slide]="m.q.slide" [unit]="ctx.unit()[0]" />
            </div>
            <p class="stem">{{ m.q.q }}</p>
            @if (m.choice; as c) {
              @if (m.pick) {
                <p class="picked">You picked: <s>{{ m.pick }}</s></p>
              }
              <p class="right">Answer: <b>{{ c.o[c.c] }}</b></p>
              <p class="why">{{ c.r }}</p>
            } @else {
              <div class="model"><p class="eyebrow">Model answer</p><tc-answer-text [text]="$any(m.q).a" /></div>
            }
          </li>
        }
      </ol>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--sp-5); }
    .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--sp-4); h2 { font-size: var(--fs-2xl); margin: var(--sp-1) 0 var(--sp-2); } p.muted { max-width: 62ch; } }
    .list { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--sp-3); }
    li { padding: var(--sp-4) var(--sp-5); border-left: 4px solid var(--bad); display: grid; gap: var(--sp-2); }
    .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; color: var(--ink-3); font-size: var(--fs-xs); font-weight: 600; }
    .lec { font-family: var(--font-mono); color: var(--accent-ink); }
    .stem { font-weight: 650; }
    .picked, .right, .why { font-size: var(--fs-sm); }
    s { color: var(--bad); }
    .why { color: var(--ink-2); }
    .model { padding: var(--sp-3) var(--sp-4); border-radius: var(--radius); background: var(--accent-soft); border: 1px solid var(--accent-line); font-size: var(--fs-sm); .eyebrow { margin-bottom: 6px; } }
  `,
})
export class Mistakes {
  protected readonly ctx = inject(CourseContext);
  private readonly router = inject(Router);

  protected readonly list = computed(() => {
    const map = this.ctx.progress().q;
    return this.ctx
      .mistakes()
      .map((q) => {
        const r = map[q.id];
        return { q, choice: isChoice(q) ? q : null, pick: r?.pick && isChoice(q) ? r.pick : '', confident: (r?.cerr ?? 0) > 0, t: r?.t ?? 0, cerr: r?.cerr ?? 0 };
      })
      .sort((a, b) => b.cerr - a.cerr || b.t - a.t);
  });

  protected drill() {
    if (this.ctx.start(this.list().map((m) => m.q.id), 'Mistakes')) this.router.navigate(['/courses', this.ctx.slug(), 'practice']);
  }
}
