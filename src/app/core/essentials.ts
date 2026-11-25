import { Fact, LectureNotes } from './models';

export type Essential = Pick<Fact, 't' | 'slide'> & { gist: string };

/** Up to the first sentence end after 40 characters, so "1." or a very short sentence brings the next one along. */
const lead = (d: string): string => d.match(/^.{40,}?[.!?](?=\s+[A-Z])/s)?.[0] ?? d;

/** The facts to know first: those rated high, or all of them when none is, each as one line. */
export function essentials(notes: LectureNotes): Essential[] {
  const high = notes.facts.filter((f) => f.weight === 'high');
  return (high.length ? high : notes.facts).map((f) => ({ t: f.t, slide: f.slide, gist: f.gist ?? lead(f.d) }));
}

/** Reading time at a careful 180 words a minute. */
export function readMinutes(items: { t: string; gist: string }[]): number {
  const words = items.reduce((a, x) => a + `${x.t} ${x.gist}`.split(/\s+/).length, 0);
  return Math.max(1, Math.ceil(words / 180));
}
