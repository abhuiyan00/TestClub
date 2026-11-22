import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { ContentService } from '../../core/content.service';
import { ProgressStore, Settings, CourseProgress } from '../../core/progress.store';
import { ChoiceQuestion, Question, isChoice, isOpen } from '../../core/models';
import { isDue, level, plan, readiness, record, totals } from '../../core/srs';
import { answerDrill, nextQuestion, shuffle, startDrill } from '../../core/drill';
import { MockSession, sampleMock } from '../../core/mock';
import { ToastService } from '../../core/toast.service';

/** Self-grades for open questions. */
export const SelfGrade = { Missed: 0, Partly: 1, GotIt: 2 } as const;
export type SelfGrade = (typeof SelfGrade)[keyof typeof SelfGrade];

/**
 * Everything one course page needs: metadata, notes and questions, this browser's progress,
 * and the practice actions. Provided by the course shell, so every tab shares one instance.
 */
@Injectable()
export class CourseContext {
  private readonly content = inject(ContentService);
  private readonly store = inject(ProgressStore);
  private readonly toast = inject(ToastService);

  readonly slug = signal('');
  readonly course = computed(() => this.content.course(this.slug()));
  readonly unit = computed(() => this.course()?.unit ?? 'Lecture');

  readonly bank = resource({
    params: () => (this.content.catalog.hasValue() && this.slug() ? this.slug() : undefined),
    loader: ({ params }) => this.content.bank(params),
  });

  readonly questions = computed<Question[]>(() => (this.bank.hasValue() ? this.bank.value().questions : []));
  readonly byId = computed(() => new Map(this.questions().map((q) => [q.id, q])));
  readonly progress = computed<CourseProgress>(() => this.store.state(this.slug())());
  readonly settings = computed(() => this.progress().settings);
  readonly exam = computed(() => {
    const c = this.course();
    return c ? this.content.nextExam(c) : undefined;
  });
  readonly examAt = computed(() => this.exam()?.at);

  /** Lectures that have notes or questions, in course order. */
  readonly studyLectures = computed(() => {
    const c = this.course();
    const b = this.bank.hasValue() ? this.bank.value() : null;
    if (!c || !b) return [];
    const withQ = new Set(this.questions().map((q) => q.l));
    return c.lectures.filter((l) => b.lectures[l.n] || withQ.has(l.n));
  });

  readonly totals = computed(() => totals(this.questions().map((q) => q.id), this.progress().q));
  readonly readiness = computed(() => readiness(this.totals()));
  readonly mistakes = computed(() => this.questions().filter((q) => level(this.progress().q[q.id]) === 1));
  readonly dueIds = computed(() => {
    const now = Date.now();
    const map = this.progress().q;
    return this.questions().filter((q) => isDue(map[q.id], now)).map((q) => q.id);
  });
  readonly plan = computed(() => {
    const unseen = this.questions().filter((q) => !this.progress().q[q.id]).length;
    return plan(unseen, this.dueIds().length, Date.now(), this.examAt());
  });

  /** Choice-only courses sit choice mocks; courses tested with open questions sit open ones. */
  readonly mockStyle = computed(() => this.course()?.examGuide?.style ?? 'choice');
  readonly mockPool = computed(() => this.questions().filter((q) => (this.mockStyle() === 'open' ? isOpen(q) : isChoice(q))));

  update(fn: (d: CourseProgress) => void) {
    this.store.update(this.slug(), fn);
  }

  lectureTotals(n: number) {
    return totals(this.questions().filter((q) => q.l === n).map((q) => q.id), this.progress().q);
  }

  toggleDone(n: number) {
    this.update((d) => {
      d.done = d.done.includes(n) ? d.done.filter((x) => x !== n) : [...d.done, n].sort((a, b) => a - b);
    });
  }

  setSettings(p: Partial<Settings>) {
    this.update((d) => Object.assign(d.settings, p));
  }

  // ---------- drill ----------

  /** Questions matching the drill builder's lecture and filter choices. */
  pool(settings: Settings = this.settings()): Question[] {
    const now = Date.now();
    const map = this.progress().q;
    return this.questions().filter((q) => {
      if (settings.lectures.length && !settings.lectures.includes(q.l)) return false;
      const lv = level(map[q.id]);
      switch (settings.filter) {
        case 'hot': return q.lk === 'high';
        case 'new': return !map[q.id];
        case 'weak': return lv === 1 || lv === 2;
        case 'due': return isDue(map[q.id], now);
        default: return true;
      }
    });
  }

  /** Unseen questions, likely ones first, lectures mixed. */
  newIds(n: number): string[] {
    const map = this.progress().q;
    return shuffle(this.questions().filter((q) => !map[q.id]))
      .sort((a, b) => Number(b.lk === 'high') - Number(a.lk === 'high'))
      .slice(0, n)
      .map((q) => q.id);
  }

  start(ids: string[], label: string, need = this.settings().reps): boolean {
    if (!ids.length) {
      this.toast.show('No questions match. Choose more lectures or another filter.');
      return false;
    }
    this.update((d) => (d.session = startDrill(ids, label, need)));
    return true;
  }

  current(): Question | undefined {
    const s = this.progress().session;
    return s?.cur ? this.byId().get(s.cur) : undefined;
  }

  /** `displayIndex` is the position the student clicked; the session maps it back to the option. */
  answerChoice(displayIndex: number) {
    const q = this.current();
    if (!q || !isChoice(q)) return;
    this.update((d) => {
      const s = d.session;
      if (!s || s.answered) return;
      const optIndex = s.order[displayIndex];
      const ok = optIndex === q.c;
      const sure = !s.unsure && !s.hint;
      answerDrill(s, ok, sure);
      s.picked = displayIndex;
      record(d.q, q.id, ok, ok ? undefined : q.o[optIndex], sure, Date.now(), this.examAt());
    });
  }

  gradeOpen(grade: SelfGrade) {
    const q = this.current();
    if (!q || !isOpen(q)) return;
    this.update((d) => {
      const s = d.session;
      if (!s || s.answered) return;
      const ok = grade !== SelfGrade.Missed;
      const sure = grade === SelfGrade.GotIt && !s.hint;
      answerDrill(s, ok, sure);
      s.picked = grade;
      record(d.q, q.id, ok, ok ? undefined : 'Missed', sure, Date.now(), this.examAt());
    });
  }

  next() {
    this.update((d) => d.session && nextQuestion(d.session));
  }

  flag(key: 'hint' | 'unsure' | 'shown') {
    this.update((d) => {
      if (d.session && !d.session.answered) d.session[key] = key === 'unsure' ? !d.session.unsure : true;
    });
  }

  endDrill() {
    this.update((d) => (d.session = null));
  }

  // ---------- mock ----------

  startMock(n: number) {
    const ids = sampleMock(this.mockPool(), this.course()?.lectures ?? [], n);
    if (!ids.length) return;
    const open = this.mockStyle() === 'open';
    const session: MockSession = {
      ids, orders: ids.map(() => shuffle([0, 1, 2, 3])), picks: ids.map(() => null), texts: ids.map(() => ''),
      i: 0, started: Date.now(), limitMin: Math.max(10, Math.round(ids.length * (open ? 4 : 1))), submitted: false, reviewing: false,
    };
    this.update((d) => {
      d.mock = session;
      d.settings.mockN = n;
    });
  }

  mockPick(i: number, value: number | null) {
    this.update((d) => d.mock && !d.mock.submitted && (d.mock.picks[i] = value));
  }

  mockText(i: number, text: string) {
    this.update((d) => d.mock && (d.mock.texts[i] = text));
  }

  mockGo(i: number) {
    this.update((d) => d.mock && (d.mock.i = Math.max(0, Math.min(d.mock.ids.length - 1, i))));
  }

  /** Choice mocks are graded at once; open mocks first reveal the model answers for self-grading. */
  submitMock() {
    const open = this.mockStyle() === 'open';
    this.update((d) => {
      const m = d.mock;
      if (!m || m.submitted) return;
      if (open && !m.reviewing) {
        m.reviewing = true;
        m.picks = m.ids.map(() => null);
        m.i = 0;
        return;
      }
      m.submitted = true;
      m.finished = Date.now();
      let score = 0;
      m.ids.forEach((id, i) => {
        const q = this.byId().get(id);
        const p = m.picks[i];
        if (!q || p === null) return;
        if (isChoice(q)) {
          const ok = m.orders[i][p] === q.c;
          score += ok ? 1 : 0;
          record(d.q, id, ok, ok ? undefined : q.o[m.orders[i][p]], true, Date.now(), this.examAt());
        } else {
          score += p === SelfGrade.GotIt ? 1 : p === SelfGrade.Partly ? 0.5 : 0;
          record(d.q, id, p !== SelfGrade.Missed, p === SelfGrade.Missed ? 'Missed' : undefined, p === SelfGrade.GotIt, Date.now(), this.examAt());
        }
      });
      d.history = [...d.history, { t: Date.now(), pct: Math.round((100 * score) / m.ids.length), n: m.ids.length }].slice(-20);
    });
  }

  endMock() {
    this.update((d) => (d.mock = null));
  }

  isCorrectChoice(q: ChoiceQuestion, order: number[], displayIndex: number): boolean {
    return order[displayIndex] === q.c;
  }
}
