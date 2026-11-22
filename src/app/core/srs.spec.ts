import { describe, expect, it } from 'vitest';
import { DAY, HOUR, QRecord, dueIn, level, plan, readiness, record, totals } from './srs';

const NOW = Date.UTC(2026, 10, 22, 10);

describe('record', () => {
  it('sends a wrong answer back to box 0, due now, and remembers the pick', () => {
    const q: Record<string, QRecord> = {};
    record(q, 'a', false, 'B', true, NOW);
    expect(q['a']).toMatchObject({ n: 1, w: 1, last: 0, box: 0, due: NOW, pick: 'B', cerr: 1 });
    expect(level(q['a'])).toBe(1);
  });

  it('moves a sure, due, correct answer up one box with the matching interval', () => {
    const q: Record<string, QRecord> = {};
    record(q, 'a', true, undefined, true, NOW);
    expect(q['a'].box).toBe(1);
    expect(q['a'].due).toBe(NOW + DAY - 3 * HOUR);
    record(q, 'a', true, undefined, true, NOW + 2 * DAY);
    expect(q['a'].box).toBe(2);
    expect(level(q['a'])).toBe(3);
  });

  it('does not promote a sure correct answer that is not due yet', () => {
    const q: Record<string, QRecord> = {};
    record(q, 'a', true, undefined, true, NOW);
    record(q, 'a', true, undefined, true, NOW + HOUR);
    expect(q['a'].box).toBe(1);
  });

  it('brings an unsure correct answer back within ten minutes while in box 0', () => {
    const q: Record<string, QRecord> = {};
    record(q, 'a', true, undefined, false, NOW);
    expect(q['a'].box).toBe(0);
    expect(q['a'].due).toBe(NOW + 10 * 60_000);
    expect(q['a']).toMatchObject({ un: 1, ur: 1 });
  });

  it('caps intervals 20 hours before the exam but never earlier than one hour from now', () => {
    const exam = NOW + 2 * DAY;
    expect(dueIn(5, NOW, exam)).toBe(exam - 20 * HOUR);
    expect(dueIn(5, exam - 20 * HOUR, exam)).toBe(exam - 19 * HOUR);
  });

  it('reports unseen as level 0', () => {
    expect(level(undefined)).toBe(0);
  });
});

describe('totals and readiness', () => {
  it('weights secure, learning and wrong answers', () => {
    const q: Record<string, QRecord> = {};
    record(q, 'w', false, 'x', true, NOW);
    record(q, 'l', true, undefined, true, NOW);
    const t = totals(['w', 'l', 'u', 'u2'], q);
    expect(t).toMatchObject({ n: 4, l0: 2, l1: 1, l2: 1, l3: 0, answered: 2, right: 1 });
    expect(readiness(t)).toBeCloseTo((0.5 + 0.15) / 4);
  });

  it('returns 0 readiness for an empty list instead of NaN', () => {
    expect(readiness(totals([], {}))).toBe(0);
  });
});

describe('plan', () => {
  it('spreads unseen questions over the days left, keeping the last day for review', () => {
    const exam = Date.UTC(2026, 10, 27, 14); // Fri 15:00 Warsaw
    expect(plan(250, 3, NOW, exam)).toEqual({ days: 5, newToday: 63, due: 3 });
  });

  it('falls back to at least ten a day when there is no exam date or it has passed', () => {
    expect(plan(40, 0, NOW)).toEqual({ days: null, newToday: 10, due: 0 });
    expect(plan(4, 0, NOW, NOW - DAY)).toEqual({ days: null, newToday: 4, due: 0 });
  });
});
