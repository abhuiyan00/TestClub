import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, EdgesGeometry, Float32BufferAttribute, Group, IcosahedronGeometry,
  LineBasicMaterial, LineLoop, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, Points,
  PointsMaterial, SRGBColorSpace, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import type { Motif } from '../core/models';

export interface MotifObject {
  group: Group;
  /** t: seconds since start, dt: seconds since last frame. */
  tick(t: number, dt: number): void;
  recolor(accent: Color, line: Color): void;
}

const srgb = (r: number, g: number, b: number) => new Color().setRGB(r, g, b, SRGBColorSpace);

function solid(accent: Color) {
  return new MeshStandardMaterial({ color: accent, roughness: 0.38, metalness: 0.12 });
}
function lines(line: Color, opacity = 0.6) {
  return new LineBasicMaterial({ color: line, transparent: true, opacity });
}

/** Lecture 1 of MMCV in one object: the RGB cube, black to white along its diagonal. */
function rgbCube(accent: Color, line: Color): MotifObject {
  const group = new Group();
  const lineMat = lines(line, 0.5);
  group.add(new LineSegments(new EdgesGeometry(new BoxGeometry(2, 2, 2)), lineMat));
  const n = 8;
  const pos: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) {
        const [r, g, b] = [i / (n - 1), j / (n - 1), k / (n - 1)];
        pos.push(r * 2 - 1, g * 2 - 1, b * 2 - 1);
        const c = srgb(r, g, b);
        col.push(c.r, c.g, c.b);
      }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  group.add(new Points(geo, new PointsMaterial({ size: 0.13, vertexColors: true, sizeAttenuation: true })));
  const diag = new BufferGeometry().setFromPoints([new Vector3(-1, -1, -1), new Vector3(1, 1, 1)]);
  const diagMat = new LineBasicMaterial({ color: accent });
  group.add(new LineSegments(diag, diagMat));
  group.rotation.set(0.62, 0.78, 0);
  return {
    group,
    tick: (_t, dt) => (group.rotation.y += dt * 0.22),
    recolor: (a, l) => {
      lineMat.color.copy(l);
      diagMat.color.copy(a);
    },
  };
}

/** Stacked platters with records orbiting them. */
function database(accent: Color, line: Color): MotifObject {
  const group = new Group();
  const mat = solid(accent);
  const lineMat = lines(line, 0.7);
  const cyl = new CylinderGeometry(1.05, 1.05, 0.42, 56);
  const rim = new EdgesGeometry(cyl, 30);
  for (const y of [0.62, 0, -0.62]) {
    const disc = new Mesh(cyl, mat);
    disc.position.y = y;
    const edge = new LineSegments(rim, lineMat);
    edge.position.y = y;
    group.add(disc, edge);
  }
  const ring = new Group();
  const recMat = new MeshStandardMaterial({ color: line, roughness: 0.5 });
  const rec = new BoxGeometry(0.22, 0.1, 0.1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = new Mesh(rec, recMat);
    m.position.set(Math.cos(a) * 1.75, Math.sin(a * 2) * 0.25, Math.sin(a) * 1.75);
    m.rotation.y = -a;
    ring.add(m);
  }
  group.add(ring);
  group.rotation.x = 0.35;
  return {
    group,
    tick: (_t, dt) => {
      group.rotation.y += dt * 0.18;
      ring.rotation.y -= dt * 0.55;
    },
    recolor: (a, l) => {
      mat.color.copy(a);
      lineMat.color.copy(l);
      recMat.color.copy(l);
    },
  };
}

/** A cyclic Petri net: four places, four transitions, two tokens travelling around it. */
function petri(accent: Color, line: Color): MotifObject {
  const group = new Group();
  const R = 1.35;
  const lineMat = lines(line, 0.55);
  const placeMat = new MeshStandardMaterial({ color: line, roughness: 0.45 });
  const trMat = solid(accent);
  const loop = new BufferGeometry().setFromPoints(
    Array.from({ length: 96 }, (_, i) => new Vector3(Math.cos((i / 96) * Math.PI * 2) * R, Math.sin((i / 96) * Math.PI * 2) * R, 0)),
  );
  group.add(new LineLoop(loop, lineMat));
  const torus = new TorusGeometry(0.3, 0.055, 12, 40);
  const bar = new BoxGeometry(0.1, 0.56, 0.26);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const p = new Mesh(torus, placeMat);
    p.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    const t = new Mesh(bar, trMat);
    const b = a + Math.PI / 4;
    t.position.set(Math.cos(b) * R, Math.sin(b) * R, 0);
    t.rotation.z = b;
    group.add(p, t);
  }
  const tokenMat = new MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.35, roughness: 0.3 });
  const tokens = [0, Math.PI].map((phase) => {
    const m = new Mesh(new SphereGeometry(0.12, 20, 16), tokenMat);
    group.add(m);
    return { m, phase };
  });
  group.rotation.set(-0.55, 0.35, 0);
  let angle = 0;
  return {
    group,
    tick: (t, dt) => {
      // tokens dwell in places and hurry through transitions
      angle += dt * (0.25 + 0.9 * Math.abs(Math.sin(angle * 2 + Math.PI / 2)) ** 3);
      for (const { m, phase } of tokens) m.position.set(Math.cos(angle + phase) * R, Math.sin(angle + phase) * R, 0.0);
      group.rotation.y = 0.35 + Math.sin(t * 0.25) * 0.3;
    },
    recolor: (a, l) => {
      lineMat.color.copy(l);
      placeMat.color.copy(l);
      trMat.color.copy(a);
      tokenMat.color.copy(a);
      tokenMat.emissive.copy(a);
    },
  };
}

/** Word vectors: three clusters with a few nearest-neighbour links. */
function embedding(accent: Color, line: Color): MotifObject {
  const group = new Group();
  const centers = [new Vector3(-0.8, 0.5, 0.2), new Vector3(0.9, 0.2, -0.3), new Vector3(0, -0.8, 0.4)];
  const pos: number[] = [];
  const seg: number[] = [];
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => (rand() + rand() + rand() - 1.5) * 0.75;
  for (const c of centers) {
    const pts = Array.from({ length: 90 }, () => new Vector3(c.x + gauss(), c.y + gauss(), c.z + gauss()));
    pts.forEach((p) => pos.push(p.x, p.y, p.z));
    for (let i = 0; i < 26; i++) {
      const p = pts[i];
      const q = pts.slice(i + 1).reduce((best, x) => (x.distanceTo(p) < best.distanceTo(p) ? x : best), pts[(i + 1) % pts.length]);
      seg.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const ptMat = new PointsMaterial({ color: accent, size: 0.075, sizeAttenuation: true });
  const linkGeo = new BufferGeometry();
  linkGeo.setAttribute('position', new Float32BufferAttribute(seg, 3));
  const lineMat = lines(line, 0.35);
  const core = new Mesh(new SphereGeometry(0.11, 20, 16), new MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.5 }));
  group.add(new Points(geo, ptMat), new LineSegments(linkGeo, lineMat), core);
  return {
    group,
    tick: (t, dt) => {
      group.rotation.y += dt * 0.14;
      core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.25);
    },
    recolor: (a, l) => {
      ptMat.color.copy(a);
      lineMat.color.copy(l);
      (core.material as MeshStandardMaterial).color.copy(a);
      (core.material as MeshStandardMaterial).emissive.copy(a);
    },
  };
}

/** A faceted core inside a geodesic shell, with an orbiting ring. */
function shield(accent: Color, line: Color): MotifObject {
  const group = new Group();
  const lineMat = lines(line, 0.55);
  const shell = new LineSegments(new EdgesGeometry(new IcosahedronGeometry(1.45, 1)), lineMat);
  const coreMat = new MeshStandardMaterial({ color: accent, flatShading: true, roughness: 0.3, metalness: 0.2 });
  const core = new Mesh(new OctahedronGeometry(0.72, 0), coreMat);
  const ringMat = new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.7 });
  const ring = new Mesh(new TorusGeometry(1.85, 0.018, 8, 160), ringMat);
  ring.rotation.x = 1.2;
  group.add(shell, core, ring);
  return {
    group,
    tick: (_t, dt) => {
      shell.rotation.y += dt * 0.16;
      core.rotation.y -= dt * 0.5;
      core.rotation.x += dt * 0.2;
      ring.rotation.z += dt * 0.3;
    },
    recolor: (a, l) => {
      lineMat.color.copy(l);
      coreMat.color.copy(a);
      ringMat.color.copy(a);
    },
  };
}

/** A small feed-forward network with signals travelling along its weights. */
function network(accent: Color, line: Color): MotifObject {
  const group = new Group();
  const layers = [3, 4, 4, 2];
  const nodeMat = solid(accent);
  const node = new SphereGeometry(0.13, 20, 16);
  const coords = layers.map((n, li) =>
    Array.from({ length: n }, (_, i) => new Vector3(-1.6 + li * (3.2 / (layers.length - 1)), ((i - (n - 1) / 2) * 2.4) / 3.5, (li % 2) * 0.3 - 0.15)),
  );
  coords.flat().forEach((p) => {
    const m = new Mesh(node, nodeMat);
    m.position.copy(p);
    group.add(m);
  });
  const edges: [Vector3, Vector3][] = [];
  coords.slice(0, -1).forEach((layer, li) => layer.forEach((a) => coords[li + 1].forEach((b) => edges.push([a, b]))));
  const seg: number[] = edges.flatMap(([a, b]) => [a.x, a.y, a.z, b.x, b.y, b.z]);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(seg, 3));
  const lineMat = lines(line, 0.3);
  group.add(new LineSegments(geo, lineMat));
  const pulseMat = new MeshBasicMaterial({ color: accent });
  const pulses = Array.from({ length: 7 }, (_, i) => {
    const m = new Mesh(new SphereGeometry(0.055, 12, 10), pulseMat);
    group.add(m);
    return { m, e: (i * 7) % edges.length, t: i / 7 };
  });
  return {
    group,
    tick: (t, dt) => {
      group.rotation.y = Math.sin(t * 0.3) * 0.45;
      for (const p of pulses) {
        p.t += dt * 0.7;
        if (p.t >= 1) {
          // continue from the end node into the next layer when possible
          const end = edges[p.e][1];
          const next = edges.map((e, i) => [e, i] as const).filter(([e]) => e[0] === end);
          p.e = next.length ? next[Math.floor(Math.random() * next.length)][1] : Math.floor(Math.random() * (layers[0] * layers[1]));
          p.t = 0;
        }
        const [a, b] = edges[p.e];
        p.m.position.lerpVectors(a, b, p.t);
      }
    },
    recolor: (a, l) => {
      nodeMat.color.copy(a);
      lineMat.color.copy(l);
      pulseMat.color.copy(a);
    },
  };
}

const BUILDERS: Record<Motif, (accent: Color, line: Color) => MotifObject> = {
  'rgb-cube': rgbCube, database, petri, embedding, shield, network,
};

export const buildMotif = (motif: Motif, accent: Color, line: Color): MotifObject => BUILDERS[motif](accent, line);
