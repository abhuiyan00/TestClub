import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Motif } from '../core/models';

/** Small deterministic generator so each course always draws the same pattern. */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

type Shape =
  | { k: 'circle'; x: number; y: number; r: number; o: number; fill?: boolean; w?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; o: number; rx?: number }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; o: number; w?: number }
  | { k: 'poly'; points: string; o: number; fill?: boolean };

const W = 400;
const H = 240;

function draw(motif: Motif, r: () => number): Shape[] {
  const s: Shape[] = [];
  switch (motif) {
    case 'database': // rings, like stacked platters seen from above
      for (let y = 0; y <= H + 40; y += 44)
        for (let x = (y / 44) % 2 ? 22 : 0; x <= W + 40; x += 44) {
          const big = r() > 0.72;
          s.push({ k: 'circle', x, y, r: big ? 17 : 9, o: big ? 0.22 : 0.12, w: big ? 5 : 3 });
          if (big) s.push({ k: 'circle', x, y, r: 5, o: 0.18, fill: true });
        }
      break;
    case 'petri': // places with tokens, transitions as bars, arcs between them
      for (let y = 30; y < H; y += 70)
        for (let x = 30; x < W; x += 90) {
          const ox = x + (r() - 0.5) * 16;
          s.push({ k: 'circle', x: ox, y, r: 14, o: 0.3, w: 3 });
          if (r() > 0.4) s.push({ k: 'circle', x: ox, y, r: 4, o: 0.5, fill: true });
          s.push({ k: 'rect', x: ox + 38, y: y - 14, w: 7, h: 28, o: 0.26 });
          s.push({ k: 'line', x1: ox + 14, y1: y, x2: ox + 38, y2: y, o: 0.22, w: 2 });
          s.push({ k: 'line', x1: ox + 45, y1: y, x2: ox + 76, y2: y + (r() > 0.5 ? 35 : 0), o: 0.18, w: 2 });
        }
      break;
    case 'rgb-cube': // 8×8 blocks of varying tone, like a JPEG macroblock grid
      for (let y = 0; y < H; y += 20)
        for (let x = 0; x < W; x += 20) {
          const v = r();
          if (v > 0.45) s.push({ k: 'rect', x: x + 1, y: y + 1, w: 18, h: 18, o: (v - 0.45) * 0.42, rx: 2 });
        }
      for (let i = 0; i < 3; i++) s.push({ k: 'circle', x: 250 + i * 38, y: 120 + (i === 1 ? -34 : 0), r: 52, o: 0.12, fill: true });
      break;
    case 'embedding': { // clustered points with a few nearest-neighbour links
      const pts: [number, number][] = [];
      for (let c = 0; c < 6; c++) {
        const cx = r() * W;
        const cy = r() * H;
        for (let i = 0; i < 14; i++) pts.push([cx + (r() - 0.5) * 90, cy + (r() - 0.5) * 70]);
      }
      pts.forEach(([x, y], i) => {
        const [nx, ny] = pts[(i + 1) % pts.length];
        if (Math.hypot(nx - x, ny - y) < 50) s.push({ k: 'line', x1: x, y1: y, x2: nx, y2: ny, o: 0.18, w: 1.2 });
      });
      pts.forEach(([x, y]) => s.push({ k: 'circle', x, y, r: 1.5 + r() * 3.5, o: 0.2 + r() * 0.3, fill: true }));
      break;
    }
    case 'shield': { // honeycomb, a few cells sealed
      const R = 22;
      const hx = R * Math.sqrt(3);
      for (let row = -1; row * R * 1.5 < H + R; row++)
        for (let col = -1; col * hx < W + hx; col++) {
          const cx = col * hx + (row % 2 ? hx / 2 : 0);
          const cy = row * R * 1.5;
          const pts = Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI / 3) * i + Math.PI / 6;
            return `${(cx + (R - 2) * Math.cos(a)).toFixed(1)},${(cy + (R - 2) * Math.sin(a)).toFixed(1)}`;
          }).join(' ');
          const sealed = r() > 0.82;
          s.push({ k: 'poly', points: pts, o: sealed ? 0.24 : 0.13, fill: sealed });
        }
      break;
    }
    case 'network': { // feed-forward layers
      const layers = [3, 5, 5, 4, 2];
      for (let rep = 0; rep < 2; rep++) {
        const nodes = layers.map((n, li) =>
          Array.from({ length: n }, (_, i) => [rep * 210 + 20 + li * 44, 20 + ((i + 0.5) * (H - 40)) / n] as [number, number]),
        );
        nodes.slice(0, -1).forEach((layer, li) =>
          layer.forEach(([x, y]) => nodes[li + 1].forEach(([x2, y2]) => r() > 0.35 && s.push({ k: 'line', x1: x, y1: y, x2, y2, o: 0.12, w: 1 }))),
        );
        nodes.flat().forEach(([x, y]) => s.push({ k: 'circle', x, y, r: 6, o: 0.35, fill: r() > 0.5, w: 2 }));
      }
      break;
    }
  }
  return s;
}

let uid = 0;

/** Generative course artwork in the course colour; also the fallback when WebGL is unavailable. */
@Component({
  selector: 'tc-course-pattern',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'hue', '[style.--hue]': 'hue()' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient [attr.id]="gid" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" [attr.stop-color]="'oklch(0.62 0.15 ' + hue() + ')'" />
          <stop offset="1" [attr.stop-color]="'oklch(0.44 0.13 ' + (hue() + 18) + ')'" />
        </linearGradient>
      </defs>
      <rect [attr.width]="w" [attr.height]="h" [attr.fill]="'url(#' + gid + ')'" />
      <g fill="none" stroke="#fff">
        @for (s of shapes(); track $index) {
          @switch (s.k) {
            @case ('circle') {
              <svg:circle [attr.cx]="s.x" [attr.cy]="s.y" [attr.r]="s.r" [attr.stroke-opacity]="s.o" [attr.stroke-width]="s.w ?? 2"
                [attr.fill]="s.fill ? '#fff' : 'none'" [attr.fill-opacity]="s.fill ? s.o : null" />
            }
            @case ('rect') {
              <svg:rect [attr.x]="s.x" [attr.y]="s.y" [attr.width]="s.w" [attr.height]="s.h" [attr.rx]="s.rx ?? 1" fill="#fff" [attr.fill-opacity]="s.o" stroke="none" />
            }
            @case ('line') {
              <svg:line [attr.x1]="s.x1" [attr.y1]="s.y1" [attr.x2]="s.x2" [attr.y2]="s.y2" [attr.stroke-opacity]="s.o" [attr.stroke-width]="s.w ?? 1.5" />
            }
            @case ('poly') {
              <svg:polygon [attr.points]="s.points" [attr.stroke-opacity]="s.o" stroke-width="2" [attr.fill]="s.fill ? '#fff' : 'none'" [attr.fill-opacity]="s.fill ? s.o * 0.6 : null" />
            }
          }
        }
      </g>
    </svg>
  `,
  styles: `:host { display: block; position: relative; overflow: hidden; } svg { display: block; width: 100%; height: 100%; }`,
})
export class CoursePattern {
  readonly motif = input.required<Motif>();
  readonly hue = input.required<number>();
  readonly seed = input('');
  protected readonly w = W;
  protected readonly h = H;
  protected readonly gid = `tcg${++uid}`;
  protected readonly shapes = computed(() => draw(this.motif(), rng(this.motif() + this.seed())));
}
