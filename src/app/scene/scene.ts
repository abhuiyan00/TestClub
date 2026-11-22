import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import {
  AmbientLight, Color, DirectionalLight, Group, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Raycaster, Scene as ThreeScene,
  SphereGeometry, Vector2, WebGLRenderer,
} from 'three';
import type { Motif } from '../core/models';
import { accentHex } from '../core/color';
import { PrefsStore } from '../core/prefs.store';
import { MotifObject, buildMotif } from './motifs';

export interface SceneItem {
  key: string;
  motif: Motif;
  hue: number;
}

interface Placed {
  item: SceneItem;
  obj: MotifObject;
  holder: Group;
  hit: Mesh;
  scale: number;
}

const RING_RADIUS = 3.1;
const BASE = { single: 1, ring: 0.52 } as const;

/**
 * WebGL artwork. `single` shows one course motif; `ring` arranges every course on a slowly turning
 * ring and reports hover and clicks. Decorative only: the same links exist as plain HTML.
 */
@Component({
  selector: 'tc-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: `
    :host { display: block; position: relative; opacity: 0; transition: opacity 600ms var(--ease-out); }
    :host(.ready) { opacity: 1; }
    :host(.pointer) { cursor: pointer; }
    canvas { display: block; width: 100%; height: 100%; touch-action: pan-y; }
  `,
  host: {
    '[class.ready]': 'ready()',
    '[class.pointer]': 'hover() !== null',
    '(pointermove)': 'onPointer($event)',
    '(pointerleave)': 'onLeave()',
    '(click)': 'onClick()',
  },
})
export class Scene {
  readonly items = input.required<SceneItem[]>();
  readonly layout = input<'single' | 'ring'>('single');
  readonly picked = output<string>();
  readonly hovered = output<string | null>();

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly prefs = inject(PrefsStore);
  protected readonly ready = signal(false);
  protected readonly hover = signal<string | null>(null);

  private renderer?: WebGLRenderer;
  private scene = new ThreeScene();
  private camera = new PerspectiveCamera(38, 1, 0.1, 100);
  private root = new Group();
  private placed: Placed[] = [];
  private raycaster = new Raycaster();
  private pointer = new Vector2(0, 0);
  private hasPointer = false;
  private raf = 0;
  private last = 0;
  private t = 0;
  private visible = true;
  private reduced = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.init()) return;
      const mq = matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = mq.matches;
      const onMotion = (e: MediaQueryListEvent) => {
        this.reduced = e.matches;
        this.kick();
      };
      mq.addEventListener('change', onMotion);
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(this.host.nativeElement);
      const io = new IntersectionObserver(([e]) => {
        this.visible = e.isIntersecting;
        this.kick();
      });
      io.observe(this.host.nativeElement);
      const onVis = () => this.kick();
      document.addEventListener('visibilitychange', onVis);
      destroyRef.onDestroy(() => {
        mq.removeEventListener('change', onMotion);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        this.dispose();
      });
    });

    // Rebuild when the course set changes, recolour when the theme flips.
    effect(() => {
      const items = this.items();
      const layout = this.layout();
      if (this.renderer) untracked(() => this.build(items, layout));
    });
    effect(() => {
      const dark = this.prefs.dark();
      this.recolor(dark);
    });
  }

  private init(): boolean {
    try {
      this.renderer = new WebGLRenderer({ canvas: this.canvas().nativeElement, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return false; // no WebGL: the SVG artwork behind stays visible
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.scene.add(new AmbientLight(0xffffff, 1.6));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    this.scene.add(key, this.root);
    this.build(this.items(), this.layout());
    this.resize();
    this.ready.set(true);
    return true;
  }

  private colors(hue: number, dark: boolean) {
    return { accent: new Color(accentHex(hue, dark)), line: new Color(dark ? '#c9d2e3' : '#3d475c') };
  }

  private build(items: SceneItem[], layout: 'single' | 'ring') {
    this.clearPlaced();
    const dark = this.prefs.dark();
    items.forEach((item, i) => {
      const { accent, line } = this.colors(item.hue, dark);
      const obj = buildMotif(item.motif, accent, line);
      const holder = new Group();
      holder.add(obj.group);
      const hit = new Mesh(new SphereGeometry(1.9, 12, 10), new MeshBasicMaterial({ visible: false }));
      hit.userData['key'] = item.key;
      holder.add(hit);
      if (layout === 'ring') {
        const a = (i / items.length) * Math.PI * 2;
        holder.position.set(Math.cos(a) * RING_RADIUS, Math.sin(a * 2) * 0.25, Math.sin(a) * RING_RADIUS);
      }
      holder.scale.setScalar(BASE[layout]);
      this.root.add(holder);
      this.placed.push({ item, obj, holder, hit, scale: BASE[layout] });
    });
    if (layout === 'ring') {
      this.camera.position.set(0, 2.1, 8.6);
      this.camera.lookAt(0, -0.2, 0);
    } else {
      this.camera.position.set(0, 0, 6.2);
      this.camera.lookAt(0, 0, 0);
    }
    this.kick();
  }

  private recolor(dark: boolean) {
    for (const p of this.placed) {
      const { accent, line } = this.colors(p.item.hue, dark);
      p.obj.recolor(accent, line);
    }
    this.kick();
  }

  private resize() {
    if (!this.renderer) return;
    const { clientWidth: w, clientHeight: h } = this.host.nativeElement;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole ring in frame on narrow screens.
    this.camera.fov = this.layout() === 'ring' && w / h < 1.2 ? 52 : 38;
    this.camera.updateProjectionMatrix();
    this.kick();
  }

  /** Starts the loop when the scene is on screen and the tab is visible, or draws one still frame. */
  private kick() {
    if (!this.renderer) return;
    const run = this.visible && !document.hidden && !this.reduced;
    if (run && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    } else if (!run) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.render();
    }
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    for (const p of this.placed) p.obj.tick(this.t, dt);
    if (this.layout() === 'ring' && this.hover() === null) this.root.rotation.y += dt * 0.09;
    // Gentle parallax towards the pointer.
    const tx = this.hasPointer ? this.pointer.y * -0.16 : 0;
    const ty = this.hasPointer ? this.pointer.x * 0.3 : 0;
    this.root.rotation.x += (tx - this.root.rotation.x) * 0.06;
    if (this.layout() === 'single') this.root.rotation.y += (ty - this.root.rotation.y) * 0.06;
    for (const p of this.placed) {
      const target = BASE[this.layout()] * (p.item.key === this.hover() ? 1.22 : 1);
      p.scale += (target - p.scale) * 0.12;
      p.holder.scale.setScalar(p.scale);
    }
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private render() {
    this.renderer?.render(this.scene, this.camera);
  }

  protected onPointer(e: PointerEvent) {
    const r = this.host.nativeElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.hasPointer = e.pointerType === 'mouse';
    if (this.layout() !== 'ring' || !this.renderer) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.placed.map((p) => p.hit), false)[0];
    const key = (hit?.object.userData['key'] as string | undefined) ?? null;
    if (key !== this.hover()) {
      this.hover.set(key);
      this.hovered.emit(key);
      if (this.reduced) this.render();
    }
  }

  protected onLeave() {
    this.hasPointer = false;
    if (this.hover() !== null) {
      this.hover.set(null);
      this.hovered.emit(null);
    }
  }

  protected onClick() {
    const key = this.hover();
    if (key) this.picked.emit(key);
  }

  private clearPlaced() {
    for (const p of this.placed) {
      this.root.remove(p.holder);
      disposeTree(p.holder);
    }
    this.placed = [];
  }

  private dispose() {
    cancelAnimationFrame(this.raf);
    this.clearPlaced();
    this.renderer?.dispose();
  }
}

/** Three.js never frees GPU memory on its own. */
function disposeTree(o: Object3D) {
  o.traverse((n) => {
    const m = n as Mesh;
    m.geometry?.dispose();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
