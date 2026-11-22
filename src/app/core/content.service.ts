import { Injectable, computed, resource } from '@angular/core';
import { Catalog, CourseBank, CourseMeta } from './models';
import { parseWhen } from './time';

export interface UpcomingEvent {
  course: CourseMeta;
  at: number;
  end?: number;
  title: string;
  kind: CourseMeta['events'][number]['kind'];
  where?: string;
  note?: string;
  timed: boolean;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Static content under public/content, fetched relative to the base href. */
@Injectable({ providedIn: 'root' })
export class ContentService {
  readonly catalog = resource({ loader: () => getJson<Catalog>('content/catalog.json') });

  readonly courses = computed<CourseMeta[]>(() => (this.catalog.hasValue() ? this.catalog.value().courses : []));
  readonly site = computed(() => (this.catalog.hasValue() ? this.catalog.value().site : null));

  /** Every dated event of every course, oldest first. */
  readonly events = computed<UpcomingEvent[]>(() =>
    this.courses()
      .flatMap((course) =>
        course.events.map((e) => ({
          course, at: parseWhen(e.date), end: e.end ? parseWhen(e.end) : undefined, title: e.title,
          kind: e.kind, where: e.where, note: e.note, timed: e.date.includes('T'),
        })),
      )
      .sort((a, b) => a.at - b.at),
  );

  private readonly banks = new Map<string, Promise<CourseBank>>();

  course(slug: string): CourseMeta | undefined {
    return this.courses().find((c) => c.slug === slug);
  }

  /** The course's notes and questions; cached for the session, refreshed when the catalog date changes. */
  bank(slug: string): Promise<CourseBank> {
    let p = this.banks.get(slug);
    if (!p) {
      const v = encodeURIComponent(this.site()?.updated ?? '');
      p = getJson<CourseBank>(`content/${slug}/course.json?v=${v}`);
      p.catch(() => this.banks.delete(slug));
      this.banks.set(slug, p);
    }
    return p;
  }

  slideUrl(slug: string, lecture: number, slide: number): string {
    return `content/${slug}/slides/L${lecture}-${slide}.webp`;
  }

  /** Next test or retake of a course still ahead of `now`. */
  nextExam(course: CourseMeta, now = Date.now()): UpcomingEvent | undefined {
    return this.events().find((e) => e.course === course && e.kind !== 'deadline' && (e.end ?? e.at) > now);
  }
}
