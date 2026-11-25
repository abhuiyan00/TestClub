import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProgressStore, blankProgress } from './progress.store';
import { slideCount } from './models';

describe('ProgressStore', () => {
  beforeEach(() => localStorage.clear());

  it('starts fresh when saved progress is not valid JSON', () => {
    localStorage.setItem('testclub.progress.adb', '{not json');
    const store = TestBed.inject(ProgressStore);
    expect(store.state('adb')()).toEqual(blankProgress());
  });

  it('starts fresh when saved progress has another version', () => {
    localStorage.setItem('testclub.progress.adb', JSON.stringify({ v: 99, q: { x: 1 } }));
    expect(TestBed.inject(ProgressStore).state('adb')().q).toEqual({});
  });

  it('keeps answers but fills in settings added later', () => {
    localStorage.setItem('testclub.progress.adb', JSON.stringify({ v: 1, gen: 0, updatedAt: 1, q: { 'L1-01': { n: 1 } }, settings: { mockN: 20 } }));
    const s = TestBed.inject(ProgressStore).state('adb')();
    expect(s.q['L1-01']).toEqual({ n: 1 });
    expect(s.settings).toMatchObject({ need: 1, filter: 'all', mockN: 20 });
    expect(s.done).toEqual([]);
  });

  it('drops a drill saved before rounds existed, and the old default of two correct answers', () => {
    localStorage.setItem('testclub.progress.adb', JSON.stringify({ v: 1, q: { 'L1-01': { n: 1 } }, settings: { reps: 2 }, session: { ids: ['L1-01'], reps: { 'L1-01': 2 } } }));
    const s = TestBed.inject(ProgressStore).state('adb')();
    expect(s.session).toBeNull();
    expect(s.settings.need).toBe(1);
    expect(s.q['L1-01']).toEqual({ n: 1 });
  });

  it('saves updates and offers an undo for a reset', () => {
    const store = TestBed.inject(ProgressStore);
    store.update('adb', (d) => d.done.push(2));
    expect(JSON.parse(localStorage.getItem('testclub.progress.adb')!).done).toEqual([2]);
    const old = store.reset('adb');
    expect(store.state('adb')().done).toEqual([]);
    store.restore('adb', old);
    expect(store.state('adb')().done).toEqual([2]);
  });
});

describe('slideCount', () => {
  it('uses the page range of a combined PDF when there is no slide count', () => {
    expect(slideCount({ n: 1, title: 't', short: 's', status: 'available', pages: [101, 122] })).toBe(22);
    expect(slideCount({ n: 1, title: 't', short: 's', status: 'available', slides: 40 })).toBe(40);
  });
});
