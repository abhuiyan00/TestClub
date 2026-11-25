#!/usr/bin/env node
/*
 * Content and privacy gate. Run with `npm run check:content`; CI runs it on every push.
 * 1. Schema: catalog.json and every course.json have the fields the app expects.
 * 2. References: every slide a note or question points at exists as an image, inside the lecture's range.
 * 3. Quality: in choice questions the right answer must not be guessable from option length alone.
 * 4. Privacy: no e-mail addresses and no denylisted names anywhere in the published files or the source.
 * Exits 1 with a list of problems when any check fails.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'public', 'content');
const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

const MOTIFS = new Set(['rgb-cube', 'database', 'petri', 'embedding', 'shield', 'network']);
const PATTERNS = new Set(['definition', 'acronym', 'true-statement', 'not-statement', 'numeric', 'calculation', 'compare', 'classify', 'order', 'fact', 'explain', 'exercise']);
const WEIGHTS = new Set(['high', 'medium', 'low']);
const KINDS = new Set(['test', 'retake', 'deadline']);
const MAX_GUESS = 28; // % right for a guesser who sees only option lengths; chance is 25 %

const text = (v) => typeof v === 'string' && v.trim().length > 0;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Expected % score of guessers who look only at option lengths (ported from the MMCV quality audit). */
export function lengthGuess(questions, tol) {
  const out = { longest: 0, shortest: 0, 'not longest': 0, 'not shortest': 0, middle: 0 };
  for (const q of questions) {
    const L = q.o.map((x) => x.length);
    const max = Math.max(...L);
    const min = Math.min(...L);
    const all = new Set(L.keys());
    const top = new Set([...all].filter((i) => L[i] * (1 + tol) >= max));
    const low = new Set([...all].filter((i) => L[i] <= min * (1 + tol)));
    const keeps = {
      longest: top, shortest: low,
      'not longest': new Set([...all].filter((i) => !top.has(i))),
      'not shortest': new Set([...all].filter((i) => !low.has(i))),
      middle: new Set([...all].filter((i) => !top.has(i) && !low.has(i))),
    };
    for (const [name, keep0] of Object.entries(keeps)) {
      const keep = keep0.size ? keep0 : all;
      out[name] += keep.has(q.c) ? 1 / keep.size : 0;
    }
  }
  for (const k of Object.keys(out)) out[k] = (100 * out[k]) / Math.max(1, questions.length);
  return out;
}

// Self-check on hand-worked one-question banks.
{
  const near = (a, b) => Math.abs(a - b) < 0.01;
  const g1 = lengthGuess([{ o: ['aaaa', 'aaa', 'aa', 'a'], c: 0 }], 0);
  const g2 = lengthGuess([{ o: ['ab', 'cd', 'ef', 'gh'], c: 2 }], 0);
  if (!(near(g1.longest, 100) && near(g1.shortest, 0) && near(g1['not shortest'], 100 / 3) && near(g2.middle, 25))) {
    throw new Error('lengthGuess self-check failed');
  }
}

// ---------- catalog ----------
const catalog = readJson(join(CONTENT, 'catalog.json'));
if (!text(catalog.site?.name) || !text(catalog.site?.semester) || !/^\d{4}-\d{2}-\d{2}$/.test(catalog.site?.updated ?? '')) fail('catalog.site', 'name, semester and updated (YYYY-MM-DD) are required');
const slugs = new Set();
for (const c of catalog.courses ?? []) {
  const at = `catalog/${c.slug}`;
  if (!/^[a-z0-9-]+$/.test(c.slug ?? '')) fail(at, 'slug must be lower-case letters, digits or dashes');
  if (slugs.has(c.slug)) fail(at, 'duplicate slug');
  slugs.add(c.slug);
  for (const k of ['code', 'title', 'summary']) if (!text(c[k])) fail(at, `missing ${k}`);
  if (c.type !== 'W') fail(at, 'type must be "W" (lecture courses only)');
  if (!(c.hue >= 0 && c.hue < 360)) fail(at, 'hue must be 0-359');
  if (!MOTIFS.has(c.motif)) fail(at, `unknown motif ${c.motif}`);
  if (!Array.isArray(c.assessment)) fail(at, 'assessment must be a list');
  const ns = new Set();
  for (const l of c.lectures ?? []) {
    if (!Number.isInteger(l.n) || ns.has(l.n)) fail(at, `lecture numbers must be unique integers (${l.n})`);
    ns.add(l.n);
    if (!text(l.title) || !text(l.short)) fail(at, `lecture ${l.n} needs title and short`);
    if (!['available', 'upcoming'].includes(l.status)) fail(at, `lecture ${l.n} status must be available or upcoming`);
    if (l.date && Number.isNaN(Date.parse(l.date))) fail(at, `lecture ${l.n} has an invalid date`);
    if (l.pages && !(Array.isArray(l.pages) && l.pages.length === 2 && Number.isInteger(l.pages[0]) && l.pages[0] >= 1 && l.pages[1] >= l.pages[0])) fail(at, `lecture ${l.n} pages must be [first, last]`);
  }
  for (const e of c.events ?? []) {
    if (!KINDS.has(e.kind) || !text(e.title) || Number.isNaN(Date.parse(e.date))) fail(at, `event "${e.title}" needs kind, title and a valid date`);
    if (e.date.includes('T') && !/[+-]\d{2}:\d{2}$|Z$/.test(e.date)) fail(at, `event "${e.title}" time needs a time-zone offset`);
  }
  if (c.examGuide && !['choice', 'open'].includes(c.examGuide.style)) fail(at, 'examGuide.style must be choice or open');
}

// ---------- course banks ----------
const stats = [];
for (const c of catalog.courses ?? []) {
  const file = join(CONTENT, c.slug, 'course.json');
  if (!existsSync(file)) continue;
  const at = `${c.slug}/course.json`;
  const bank = readJson(file);
  const lect = new Map((c.lectures ?? []).map((l) => [l.n, l]));
  const slideOk = (l, s, where) => {
    const meta = lect.get(l);
    if (!meta) return fail(at, `${where}: lecture ${l} is not in the catalog`);
    const [lo, hi] = meta.pages ?? [1, meta.slides ?? Infinity];
    if (!Number.isInteger(s) || s < lo || s > hi) fail(at, `${where}: slide ${s} outside ${lo}-${hi}`);
    if (!existsSync(join(CONTENT, c.slug, 'slides', `L${l}-${s}.webp`))) fail(at, `${where}: missing image slides/L${l}-${s}.webp`);
  };
  for (const [n, notes] of Object.entries(bank.lectures ?? {})) {
    const l = Number(n);
    if (lect.get(l)?.status !== 'available') fail(at, `notes for lecture ${n}, which is not marked available`);
    if (!text(notes.summary)) fail(at, `lecture ${n}: summary missing`);
    (notes.facts ?? []).forEach((f, i) => {
      if (!text(f.t) || !text(f.d) || !WEIGHTS.has(f.weight)) fail(at, `lecture ${n} fact ${i}: t, d and weight are required`);
      if ('gist' in f && !text(f.gist)) fail(at, `lecture ${n} fact ${i}: gist must be text`);
      slideOk(l, f.slide, `fact "${f.t}"`);
    });
    (notes.formulas ?? []).forEach((f) => {
      if (!text(f.name) || !text(f.expr)) fail(at, `lecture ${n}: formula needs name and expr`);
      slideOk(l, f.slide, `formula "${f.name}"`);
    });
    (notes.traps ?? []).forEach((t) => text(t) || fail(at, `lecture ${n}: empty trap`));
  }
  const ids = new Set();
  const choice = [];
  for (const q of bank.questions ?? []) {
    const where = `question ${q.id}`;
    if (!/^L\d+-\d+[a-z]?$/.test(q.id ?? '') || ids.has(q.id)) fail(at, `${where}: ids look like L3-07 and must be unique`);
    ids.add(q.id);
    if (!text(q.q) || !text(q.topic) || !PATTERNS.has(q.pattern) || !WEIGHTS.has(q.lk)) fail(at, `${where}: q, topic, pattern and lk are required`);
    slideOk(q.l, q.slide, where);
    if (q.type === 'open') {
      if (!text(q.a)) fail(at, `${where}: open questions need a model answer`);
    } else {
      if (!Array.isArray(q.o) || q.o.length !== 4 || new Set(q.o).size !== 4 || !q.o.every(text)) fail(at, `${where}: four different options required`);
      if (!Number.isInteger(q.c) || q.c < 0 || q.c > 3) fail(at, `${where}: c must be 0-3`);
      if (!text(q.hint) || !text(q.r)) fail(at, `${where}: hint and explanation (r) required`);
      choice.push(q);
    }
  }
  if (choice.length >= 40) {
    for (const tol of [0, 0.1, 0.25]) {
      for (const [k, v] of Object.entries(lengthGuess(choice, tol))) {
        if (v > MAX_GUESS) fail(at, `guessing "${k}" by option length scores ${v.toFixed(1)}% at ${tol * 100}% tolerance (max ${MAX_GUESS}%)`);
      }
    }
  }
  stats.push(`${c.slug}: ${bank.questions.length} questions (${choice.length} choice), ${Object.values(bank.lectures).reduce((a, n) => a + n.facts.length, 0)} facts`);
}

// ---------- privacy ----------
// The denylist never enters the repository: a plain SHA-256 of a name is easy to reverse with a list of names.
// It comes from the local file or the PRIVACY_DENYLIST secret in CI; without either, only e-mail addresses are checked.
const denyFile = join(ROOT, 'tools', 'privacy-denylist.json');
const deny = process.env.PRIVACY_DENYLIST ? JSON.parse(process.env.PRIVACY_DENYLIST) : existsSync(denyFile) ? readJson(denyFile) : null;
if (!deny) console.warn('privacy: no denylist (tools/privacy-denylist.json or PRIVACY_DENYLIST), checking e-mail addresses only');
const NAMES = new Set(deny?.names ?? []);
const TOOLS = new Set(deny?.tools ?? []);
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}/i;
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
const sha = (t) => createHash('sha256').update(t).digest('hex');
const SKIP = new Set(['node_modules', 'dist', '.angular', '.git', 'coverage', 'slides', 'out-tsc']);
const TEXT = /\.(ts|html|scss|css|json|md|mjs|js|py|yml|yaml|txt|svg)$/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** Exactly the files git would publish (tracked or new, minus ignored ones); a plain walk outside a repo. */
function publishable() {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\0').filter(Boolean).map((f) => join(ROOT, f)).filter((p) => existsSync(p) && !p.split(sep).includes('slides'));
  } catch {
    return [...walk(ROOT)];
  }
}

for (const p of publishable()) {
  const rel = relative(ROOT, p).split(sep).join('/');
  if (!TEXT.test(p) && !/^(LICENSE|\.gitignore|\.editorconfig)$/.test(rel)) continue;
  if (rel === 'package-lock.json' || rel === 'tools/privacy-denylist.json') continue;
  const body = readFileSync(p, 'utf8');
  const m = body.match(EMAIL);
  if (m) fail(rel, `contains an e-mail address (${m[0].replace(/^(.).*@/, '$1…@')})`);
  const isContent = rel.startsWith('public/content/');
  const seen = new Set();
  for (const tok of fold(body).split(/[^a-z0-9]+/)) {
    if (!tok || seen.has(tok)) continue;
    seen.add(tok);
    const h = sha(tok);
    if (NAMES.has(h) || (!isContent && TOOLS.has(h))) fail(rel, `contains a denylisted word (token "${tok.slice(0, 2)}…")`);
  }
}

console.log(stats.join('\n'));
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log('content check passed');
