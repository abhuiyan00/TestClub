/** Shapes of the static content in public/content. CONTRIBUTING.md documents each field. */

export type Weight = 'high' | 'medium' | 'low';
export type EventKind = 'test' | 'retake' | 'deadline';
export type Motif = 'rgb-cube' | 'database' | 'petri' | 'embedding' | 'shield' | 'network';
export type ExamStyle = 'choice' | 'open';

export interface SiteMeta {
  name: string;
  semester: string;
  /** ISO date of the last content update; also used to bust caches of course files. */
  updated: string;
  /** Public repository for corrections. Empty hides the "report an error" links. */
  repoUrl?: string;
}

export interface CourseEvent {
  /** ISO date-time with the Warsaw offset, e.g. 2026-11-27T15:00:00+01:00, or a plain date. */
  date: string;
  end?: string;
  title: string;
  kind: EventKind;
  where?: string;
  note?: string;
}

export interface LectureMeta {
  n: number;
  title: string;
  short: string;
  date?: string;
  /** Page count of the lecture PDF; used to weight mock exams. */
  slides?: number;
  /** For several lectures in one combined PDF: first and last page; slide numbers are those pages. */
  pages?: [number, number];
  status: 'available' | 'upcoming';
  /** Optional grouping label, e.g. "Part 1 · Petri nets". */
  part?: string;
}

/** Number of slides of a lecture, from its own PDF or its page range in a combined one. */
export const slideCount = (l: LectureMeta): number | undefined => l.slides ?? (l.pages ? l.pages[1] - l.pages[0] + 1 : undefined);

export interface Insight {
  title: string;
  text: string;
}

export interface ExamGuide {
  style: ExamStyle;
  format: string;
  insights: Insight[];
  /** Question shapes seen in past tests: [label, count]. */
  pastShapes?: [string, number][];
  pastNote?: string;
}

export interface CourseMeta {
  slug: string;
  code: string;
  title: string;
  type: 'W';
  /** OKLCH hue angle of the course colour. */
  hue: number;
  motif: Motif;
  /** What a numbered section is called; "Lecture" unless the course is organised by topic. */
  unit?: string;
  summary: string;
  schedule?: string;
  assessment: string[];
  objectives?: string[];
  events: CourseEvent[];
  lectures: LectureMeta[];
  examGuide?: ExamGuide;
}

export interface Catalog {
  site: SiteMeta;
  courses: CourseMeta[];
}

export interface Fact {
  t: string;
  d: string;
  slide: number;
  weight: Weight;
}

export interface Formula {
  name: string;
  expr: string;
  slide: number;
}

export interface LectureNotes {
  summary: string;
  facts: Fact[];
  formulas: Formula[];
  traps: string[];
}

export type Pattern =
  | 'definition'
  | 'acronym'
  | 'true-statement'
  | 'not-statement'
  | 'numeric'
  | 'calculation'
  | 'compare'
  | 'classify'
  | 'order'
  | 'fact'
  | 'explain'
  | 'exercise';

interface QuestionBase {
  id: string;
  /** Lecture number. */
  l: number;
  topic: string;
  q: string;
  slide: number;
  pattern: Pattern;
  lk: Weight;
  /** Why the question is rated as it is. */
  why?: string;
}

export interface ChoiceQuestion extends QuestionBase {
  type?: 'choice';
  o: string[];
  /** Index of the correct option in `o`. */
  c: number;
  hint: string;
  /** Explanation shown after answering. */
  r: string;
}

export interface OpenQuestion extends QuestionBase {
  type: 'open';
  /** Model answer. Lines starting with "- " render as a list. */
  a: string;
  hint?: string;
}

export type Question = ChoiceQuestion | OpenQuestion;

export interface CourseBank {
  built: string;
  lectures: Record<string, LectureNotes>;
  questions: Question[];
}

export const isOpen = (q: Question): q is OpenQuestion => q.type === 'open';
export const isChoice = (q: Question): q is ChoiceQuestion => q.type !== 'open';

export const PATTERN_LABEL: Record<Pattern, string> = {
  definition: 'Definition',
  acronym: 'Acronym',
  'true-statement': 'Which is true',
  'not-statement': 'Which is not',
  numeric: 'Numeric',
  calculation: 'Calculation',
  compare: 'Compare',
  classify: 'Classify',
  order: 'Order of steps',
  fact: 'Fact',
  explain: 'Explain',
  exercise: 'Exercise',
};
