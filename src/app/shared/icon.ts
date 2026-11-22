import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  ArrowLeft, ArrowRight, ArrowUpDown, Ban, Bell, BookMarked, BookOpen, CalendarDays, ChartColumn, Check,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleCheck, CircleDot, CircleHelp, CircleX, Clock,
  ExternalLink, Eye, EyeOff, FileText, Flag, Gauge, GraduationCap, History, Hourglass, House, Images, Info,
  Keyboard, Layers, LayoutDashboard, LayoutGrid, Library, Lightbulb, List, ListChecks, Lock, MapPin, Menu,
  Minus, Moon, PanelLeft, PanelRight, Play, Plus, RotateCcw, Search, ShieldCheck, Shuffle, Sigma, Star, Sun,
  Target, Timer, Trash2, TriangleAlert, Undo2, X, ZoomIn,
} from 'lucide';

/** Lucide (ISC licence) icon nodes, rendered through bindings rather than innerHTML. */
const ICONS = {
  'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, sort: ArrowUpDown, ban: Ban, bell: Bell,
  bookmark: BookMarked, book: BookOpen, calendar: CalendarDays, chart: ChartColumn, check: Check,
  'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, 'chevron-up': ChevronUp,
  'circle-check': CircleCheck, dot: CircleDot, help: CircleHelp, 'circle-x': CircleX, clock: Clock,
  external: ExternalLink, eye: Eye, 'eye-off': EyeOff, notes: FileText, flag: Flag, gauge: Gauge, cap: GraduationCap,
  history: History, hourglass: Hourglass, home: House, slides: Images, info: Info, keyboard: Keyboard, cards: Layers,
  dashboard: LayoutDashboard, grid: LayoutGrid, library: Library, hint: Lightbulb, list: List, checks: ListChecks,
  lock: Lock, pin: MapPin, menu: Menu, minus: Minus, moon: Moon, 'panel-left': PanelLeft, 'panel-right': PanelRight,
  play: Play, plus: Plus, reset: RotateCcw, search: Search, shield: ShieldCheck, shuffle: Shuffle, sigma: Sigma,
  star: Star, sun: Sun, target: Target, timer: Timer, trash: Trash2, alert: TriangleAlert, undo: Undo2, x: X, zoom: ZoomIn,
} as const;

export type IconName = keyof typeof ICONS;
type Attrs = Record<string, string | number | undefined>;

@Component({
  selector: 'tc-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tc-icon', 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" fill="none" stroke="currentColor"
      [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" focusable="false">
      @for (n of nodes(); track $index) {
        @switch (n[0]) {
          @case ('path') { <svg:path [attr.d]="a(n)['d']" /> }
          @case ('circle') { <svg:circle [attr.cx]="a(n)['cx']" [attr.cy]="a(n)['cy']" [attr.r]="a(n)['r']" [attr.fill]="a(n)['fill'] ?? null" /> }
          @case ('rect') {
            <svg:rect [attr.x]="a(n)['x']" [attr.y]="a(n)['y']" [attr.width]="a(n)['width']" [attr.height]="a(n)['height']"
              [attr.rx]="a(n)['rx'] ?? null" [attr.ry]="a(n)['ry'] ?? null" />
          }
          @case ('line') { <svg:line [attr.x1]="a(n)['x1']" [attr.y1]="a(n)['y1']" [attr.x2]="a(n)['x2']" [attr.y2]="a(n)['y2']" /> }
        }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; line-height: 0; } svg { display: block; }`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly stroke = input(2);
  protected readonly nodes = computed(() => ICONS[this.name()] as unknown as [string, Attrs][]);
  protected a = (n: [string, Attrs]) => n[1];
}
