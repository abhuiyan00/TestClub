import { describe, expect, it } from 'vitest';
import { answerDrill, nextQuestion, startDrill } from './drill';
import { grade, sampleMock } from './mock';
import { oklchToHex } from './color';
import { search } from './search';
import { ChoiceQuestion, CourseBank, LectureMeta } from './models';

/** Deterministic generator so shuffles are reproducible. */
function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const mc = (id: string, l: number, lk: ChoiceQuestion['lk'] = 'medium'): ChoiceQuestion => ({
  id, l, topic: 't', q: `Question ${id} about chroma`, o: ['a', 'b', 'c', 'd'], c: 0,
  hint: 'h', r: 'because', slide: 1, pattern: 'definition', lk,
});

describe('drill', () => {
  it('needs `reps` sure correct answers per question before it leaves', () => {
    const s = startDrill(['a'], 'x', 2, seeded());
    expect(s.cur).toBe('a');
    answerDrill(s, true, true);
    expect(s.reps['a']).toBe(1);
    nextQuestion(s, seeded());
    answerDrill(s, true, true);
    nextQuestion(s, seeded());
    expect(s.done).toBe(true);
  });

  it('adds one repetition per mistake, up to four, and ignores unsure answers', () => {
    const s = startDrill(['a'], 'x', 2, seeded());
    for (let i = 0; i < 5; i++) answerDrill(Object.assign(s, { answered: false }), false, true);
    expect(s.reps['a']).toBe(4);
    answerDrill(Object.assign(s, { answered: false }), true, false);
    expect(s.reps['a']).toBe(4);
    expect(s.wrong).toBe(5);
    expect(s.right).toBe(1);
  });

  it('never asks the same question twice in a row while others remain', () => {
    const rng = seeded(3);
    const s = startDrill(['a', 'b', 'c'], 'x', 3, rng);
    for (let i = 0; i < 20; i++) {
      const prev = s.cur;
      answerDrill(s, true, true);
      const open = s.ids.filter((id) => s.reps[id] > 0).length;
      nextQuestion(s, rng);
      if (s.done) break;
      if (open > 1) expect(s.cur).not.toBe(prev);
    }
    expect(s.done).toBe(true);
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
