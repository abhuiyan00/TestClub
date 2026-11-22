#!/usr/bin/env node
/*
 * Runs after `ng build`:
 * - adds a Content-Security-Policy meta tag; inline scripts are allowed only by their exact hash,
 * - copies index.html to 404.html so static hosts serve the app for deep links,
 * - writes .nojekyll so GitHub Pages serves files as they are,
 * - publishes the third-party licence notices.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.argv[2] ?? 'dist/testclub', 'browser');
const indexPath = join(out, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`postbuild: ${indexPath} not found; run ng build first`);
  process.exit(1);
}

let html = readFileSync(indexPath, 'utf8');
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`,
);
if (/\son[a-z]+=/i.test(html)) {
  console.error('postbuild: inline event handlers found in index.html; they would be blocked by the CSP');
  process.exit(1);
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, '');
html = html.replace(/<meta charset="utf-8"\s*\/?>/i, (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`);
if (!html.includes('Content-Security-Policy')) {
  console.error('postbuild: could not place the CSP meta tag');
  process.exit(1);
}

writeFileSync(indexPath, html);
writeFileSync(join(out, '404.html'), html);
writeFileSync(join(out, '.nojekyll'), '');
// Third-party licence notices must ship with the bundled libraries; Angular writes them next to the browser folder.
const licences = join(out, '..', '3rdpartylicenses.txt');
if (existsSync(licences)) copyFileSync(licences, join(out, '3rdpartylicenses.txt'));
console.log(`postbuild: CSP added (${hashes.length} inline script hash${hashes.length === 1 ? '' : 'es'}), 404.html and .nojekyll written`);
