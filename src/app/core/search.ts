import { CourseBank, isOpen } from './models';

export type HitKind = 'fact' | 'formula' | 'trap' | 'question';

export interface SearchHit {
  slug: string;
  kind: HitKind;
  id: string;
  l: number;
  title: string;
  text: string;
  answer?: string;
  slide?: number;
}

/** Lower case without diacritics, so "lodz" finds "Łódź" and "Kohonen" finds "kohonen". */
export const fold = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();

/** Every word of the query must appear somewhere in the item. Facts come first, then formulas, traps, questions. */
export function search(sources: { slug: string; bank: CourseBank }[], query: string, limit = 80): SearchHit[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (fold(query).trim().length < 2) return [];
  const match = (...parts: (string | undefined)[]) => {
    const hay = fold(parts.filter(Boolean).join(' \u0001 '));
    return terms.every((t) => hay.includes(t));
  };
  const groups: Record<HitKind, SearchHit[]> = { fact: [], formula: [], trap: [], question: [] };
  for (const { slug, bank } of sources) {
    for (const [ln, notes] of Object.entries(bank.lectures)) {
      const l = Number(ln);
      notes.facts.forEach((f, i) => match(f.t, f.d) && groups.fact.push({ slug, kind: 'fact', id: `${l}-${i}`, l, title: f.t, text: f.d, slide: f.slide }));
      notes.formulas.forEach((f, i) => match(f.name, f.expr) && groups.formula.push({ slug, kind: 'formula', id: `${l}-f${i}`, l, title: f.name, text: f.expr, slide: f.slide }));
      notes.traps.forEach((t, i) => match(t) && groups.trap.push({ slug, kind: 'trap', id: `${l}-t${i}`, l, title: 'Easy to confuse', text: t }));
    }
    for (const q of bank.questions) {
      const answer = isOpen(q) ? q.a : q.o[q.c];
      const text = isOpen(q) ? '' : q.r;
      if (match(q.topic, q.q, answer, text, ...(isOpen(q) ? [] : q.o))) {
        groups.question.push({ slug, kind: 'question', id: q.id, l: q.l, title: q.q, text, answer, slide: q.slide });
      }
    }
  }
  return [...groups.fact, ...groups.formula, ...groups.trap, ...groups.question].slice(0, limit);
}
