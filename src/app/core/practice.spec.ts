import { describe, expect, it } from 'vitest';
import { DrillSession, answerDrill, drillProgress, nextQuestion, startDrill } from './drill';
import { essentials, readMinutes } from './essentials';
import { grade, sampleMock } from './mock';
import { oklchToHex } from './color';
import { search } from './search';
import { ChoiceQuestion, CourseBank, Fact, LectureMeta, LectureNotes } from './models';

/** Deterministic generator so shuffles are reproducible. */
function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const mc = (id: string, l: number, lk: ChoiceQuestion['lk'] = 'medium'): ChoiceQuestion => ({
  id, l, topic: 't', q: `Question ${id} about chroma`, o: ['a', 'b', 'c', 'd'], c: 0,
  hint: 'h', r: 'because', slide: 1, pattern: 'definition', lk,
});

describe('drill', () => {
  /** Answers every question of one round and returns the order they were asked in. */
  const round = (s: DrillSession, size: number, ok: (id: string) => boolean = () => true) =>
    Array.from({ length: size }, () => {
      const id = s.cur!;
      answerDrill(s, ok(id), true);
      nextQuestion(s, seeded());
      return id;
    });

  it('asks every question once, in the given order, before any question returns', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const s = startDrill(ids, 'x', 2, seeded());
    expect(round(s, 5)).toEqual(ids);
    expect(round(s, 5)).toEqual(ids);
    expect(s.done).toBe(true);
  });

  it('repeats only the missed questions after the first round', () => {
    const s = startDrill(['a', 'b', 'c', 'd'], 'x', 1, seeded());
    round(s, 4, (id) => id !== 'b' && id !== 'd');
    expect(round(s, 2)).toEqual(['b', 'd']);
    expect(s.done).toBe(true);
  });

  it('never asks the same question twice in a row while others remain', () => {
    const s = startDrill(['a', 'b', 'c'], 'x', 1, seeded());
    round(s, 3, (id) => id === 'b');
    expect(s.cur).toBe('a');
    round(s, 1, () => false);
    expect(s.cur).toBe('c');
    round(s, 1);
    expect(s.cur).toBe('a');
  });

  it('a miss costs one more correct answer, never more than the target; guesses do not count', () => {
    const s = startDrill(['a'], 'x', 2, seeded());
    answerDrill(s, true, true);
    for (let i = 0; i < 3; i++) answerDrill(Object.assign(s, { answered: false }), false, true);
    expect(s.reps['a']).toBe(2);
    answerDrill(Object.assign(s, { answered: false }), true, false);
    expect(s.reps['a']).toBe(2);
    expect(s).toMatchObject({ right: 2, wrong: 3 });
  });

  it('reports progress against the target the drill started with', () => {
    const s = startDrill(['a', 'b'], 'x', 1, seeded());
    expect(drillProgress(s)).toBe(0);
    round(s, 1);
    expect(drillProgress(s)).toBe(0.5);
  });
});

describe('essentials', () => {
  const fact = (t: string, weight: Fact['weight'], d: string, gist?: string): Fact => ({ t, d, slide: 1, weight, gist });
  const notes = (facts: Fact[]): LectureNotes => ({ summary: '', facts, formulas: [], traps: [] });

  it('keeps the high-weight facts and prefers the one-line gist over the detail', () => {
    const n = notes([fact('A', 'high', 'Long. Detail.', 'Short.'), fact('B', 'low', 'x'), fact('C', 'high', '1. This opening sentence is long enough, e.g. 1.5 V. Second.')]);
    expect(essentials(n).map((e) => [e.t, e.gist])).toEqual([['A', 'Short.'], ['C', '1. This opening sentence is long enough, e.g. 1.5 V.']]);
  });

  it('falls back to every fact when none is rated high', () => {
    expect(essentials(notes([fact('A', 'medium', 'One.'), fact('B', 'low', 'Two')])).map((e) => e.gist)).toEqual(['One.', 'Two']);
  });

  it('estimates at least one minute of reading', () => {
    expect(readMinutes([])).toBe(1);
    expect(readMinutes([{ t: 'A', gist: Array(400).fill('w').join(' ') }])).toBe(3);
  });
});

describe('mock', () => {
  const lectures: LectureMeta[] = [
    { n: 1, title: 'A', short: 'A', slides: 30, status: 'available' },
    { n: 2, title: 'B', short: 'B', slides: 10, status: 'available' },
  ];
  const pool = [...Array.from({ length: 20 }, (_, i) => mc(`a${i}`, 1)), ...Array.from({ length: 20 }, (_, i) => mc(`b${i}`, 2))];

  it('splits questions in proportion to slide counts, without duplicates', () => {
    const ids = sampleMock(pool, lectures, 8, seeded());
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(ids.filter((id) => id.startsWith('a'))).toHaveLength(6);
  });

  it('tops up from other lectures when one runs short and caps at the pool size', () => {
    const small = [mc('a0', 1), ...Array.from({ length: 9 }, (_, i) => mc(`b${i}`, 2))];
    expect(sampleMock(small, lectures, 8, seeded())).toHaveLength(8);
    expect(sampleMock(small, lectures, 50, seeded())).toHaveLength(10);
  });

  it('maps percentages to the usual grade scale', () => {
    expect([49, 50, 60, 70, 80, 90, 100].map(grade)).toEqual(['2.0', '3.0', '3.5', '4.0', '4.5', '5.0', '5.0']);
  });
});

describe('oklchToHex', () => {
  it('matches reference conversions', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff');
    expect(oklchToHex(0, 0, 0)).toBe('#000000');
    expect(oklchToHex(0.6279554, 0.2576833, 29.2338851)).toBe('#ff0000');
  });

  it('clips out-of-gamut colours instead of producing invalid hex', () => {
    expect(oklchToHex(0.7, 0.4, 150)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('search', () => {
  const bank: CourseBank = {
    built: '2026-11-22',
    lectures: { '1': { summary: '', facts: [{ t: 'Chroma subsampling', d: '4:2:0 halves chroma', slide: 3, weight: 'high' }], formulas: [], traps: [] } },
    questions: [mc('L1-01', 1), { ...mc('L1-02', 1), q: 'Other' }],
  };

  it('finds facts and questions by any word, case-insensitively', () => {
    const hits = search([{ slug: 'mmcv', bank }], 'CHROMA');
    expect(hits.map((h) => h.kind + ':' + h.id)).toEqual(['fact:1-0', 'question:L1-01']);
  });

  it('needs at least two characters', () => {
    expect(search([{ slug: 'mmcv', bank }], 'c')).toEqual([]);
  });
});
