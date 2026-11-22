import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DrillFilter } from '../../../core/progress.store';
import { ChoiceQuestion, OpenQuestion, PATTERN_LABEL, Question, isChoice } from '../../../core/models';
import { drillProgress } from '../../../core/drill';
import { calibration, level } from '../../../core/srs';
import { formatWhen } from '../../../core/time';
import { AnswerText } from '../../../shared/answer-text';
import { Icon } from '../../../shared/icon';
import { SlideLink, SlideThumb } from '../../../shared/slides';
import { CourseContext, SelfGrade } from '../course-context';

const FILTERS: { key: DrillFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'hot', label: 'Likely' },
  { key: 'new', label: 'New' },
  { key: 'weak', label: 'Weak' },
  { key: 'due', label: 'Due' },
];

@Component({
  selector: 'tc-practice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, SlideLink, SlideThumb, AnswerText],
  templateUrl: './practice.html',
  styleUrl: './practice.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class Practice {
  protected readonly ctx = inject(CourseContext);
  protected readonly filters = FILTERS;
  protected readonly letters = ['A', 'B', 'C', 'D'];
  protected readonly patternLabel = PATTERN_LABEL;
  protected readonly Grade = SelfGrade;
  protected readonly announce = signal('');

  protected readonly session = computed(() => this.ctx.progress().session);
  protected readonly q = computed<Question | undefined>(() => this.ctx.current());
  protected readonly choice = computed(() => {
    const q = this.q();
    return q && isChoice(q) ? (q as ChoiceQuestion) : undefined;
  });
  protected readonly open = computed(() => {
    const q = this.q();
    return q && !isChoice(q) ? (q as OpenQuestion) : undefined;
  });
  protected readonly lectureOf = (n: number) => this.ctx.course()?.lectures.find((l) => l.n === n);
  protected readonly unitShort = computed(() => this.ctx.unit()[0]);

  protected readonly poolSize = computed(() => this.ctx.pool().length);
  protected readonly counts = computed(() => {
    const s = this.ctx.settings();
    return Object.fromEntries(FILTERS.map((f) => [f.key, this.ctx.pool({ ...s, filter: f.key }).length])) as Record<DrillFilter, number>;
  });
  protected readonly progressPct = computed(() => {
    const s = this.session();
    return s ? drillProgress(s, this.ctx.settings().reps) : 0;
  });
  protected readonly cells = computed(() => {
    const s = this.session();
    const map = this.ctx.progress().q;
    return s ? s.ids.map((id) => ({ id, lv: level(map[id]), cur: id === s.cur, left: s.reps[id] })) : [];
  });
  protected readonly calib = computed(() => calibration(this.ctx.progress().q));
  protected readonly hasChoice = computed(() => this.ctx.questions().some(isChoice));

  /** Day-by-day plan strip when the exam is less than two weeks away. */
  protected readonly strip = computed(() => {
    const p = this.ctx.plan();
    const exam = this.ctx.exam();
    const days = p.days;
    if (days === null || days > 13 || !exam) return [];
    return Array.from({ length: days + 1 }, (_, i) => {
      const at = Date.now() + i * 86_400_000;
      const what = i === days ? exam.title : i === days - 1 ? 'Mock + review' : p.newToday ? `${p.newToday} new + review` : 'Review';
      return { day: formatWhen(at, 'weekday'), what, now: i === 0, exam: i === days };
    });
  });

  protected pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

  protected toggleLecture(n: number) {
    const s = this.ctx.settings().lectures;
    this.ctx.setSettings({ lectures: s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort((a, b) => a - b) });
  }

  protected startBuilt() {
    const s = this.ctx.settings();
    const label = s.lectures.length ? `${this.ctx.unit()}s ${s.lectures.join(', ')}` : 'All lectures';
    this.ctx.start(this.ctx.pool().map((q) => q.id), `${label} · ${FILTERS.find((f) => f.key === s.filter)!.label}`);
  }

  protected review() {
    this.ctx.start(this.ctx.dueIds(), 'Spaced review', 1);
  }

  protected learnNew() {
    this.ctx.start(this.ctx.newIds(this.ctx.plan().newToday), "Today's new questions");
  }

  protected answer(i: number) {
    const q = this.choice();
    const s = this.session();
    if (!q || !s || s.answered) return;
    this.ctx.answerChoice(i);
    const after = this.session()!;
    const ok = after.order[i] === q.c;
    const sure = !after.unsure && !after.hint;
    this.say(ok ? (sure ? 'Correct.' : 'Correct, but marked as a guess, so it comes back.') : `Not quite. The answer is: ${q.o[q.c]}`);
  }

  protected grade(g: SelfGrade) {
    this.ctx.gradeOpen(g);
    this.say(g === SelfGrade.GotIt ? 'Marked as known.' : g === SelfGrade.Partly ? 'Marked as partly known; it comes back soon.' : 'Marked as missed; it comes back.');
  }

  private say(msg: string) {
    this.announce.set('');
    setTimeout(() => this.announce.set(msg), 40);
  }

  protected optState(i: number): string {
    const s = this.session();
    const q = this.choice();
    if (!s || !q || !s.answered) return '';
    const right = s.order[i] === q.c;
    if (i === s.picked) return right ? 'right' : 'wrong';
    return right ? 'reveal' : 'dim';
  }

  protected isRight = computed(() => {
    const s = this.session();
    const q = this.choice();
    if (!s?.answered) return false;
    return q ? s.order[s.picked!] === q.c : s.picked !== SelfGrade.Missed;
  });

  protected onKey(e: KeyboardEvent) {
    const s = this.session();
    if (!s || s.done || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('input, textarea, select')) return;
    if ((e.key === 'Enter' || e.key === ' ') && t?.closest('button, a[href]')) return; // the focused control does its own job
    const k = e.key.toLowerCase();
    const choice = this.choice();
    if (!s.answered) {
      if (choice) {
        const hidden = this.ctx.settings().recall && !s.shown;
        const idx = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
        if (hidden && k === ' ') {
          e.preventDefault();
          this.ctx.flag('shown');
        } else if (!hidden && idx >= 0 && k.length === 1) {
          e.preventDefault();
          this.answer(idx);
        } else if (k === 'h') this.ctx.flag('hint');
        else if (k === 'g') this.ctx.flag('unsure');
      } else if (this.open()) {
        if (!s.shown && (k === ' ' || k === 'enter')) {
          e.preventDefault();
          this.ctx.flag('shown');
        } else if (s.shown && '123'.includes(k) && k.length === 1) {
          e.preventDefault();
          this.grade((Number(k) - 1) as SelfGrade);
        } else if (k === 'h') this.ctx.flag('hint');
      }
    } else if (k === 'enter' || k === 'arrowright' || k === 'n') {
      e.preventDefault();
      this.ctx.next();
    }
  }
}
