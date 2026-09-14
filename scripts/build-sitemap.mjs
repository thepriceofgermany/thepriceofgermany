#!/usr/bin/env node
// Regenerates site/sitemap.xml from the .html files in site/.
// Run after adding a new post:  npm run sitemap
//
// <lastmod> is the date the page's CONTENT actually last changed, so Google can
// tell which pages are fresh. Source of truth, in order:
//   1. the file's last git commit date (survives copies/checkouts, tracks real edits)
//   2. the file's filesystem mtime (for a new post not yet committed)
// Emitting today's date for every page (the old behaviour) trains Google to
// ignore <lastmod> entirely, so we never do that.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const BASE = 'https://thepriceofgermany.com';

const iso = d => new Date(d).toISOString().slice(0, 10);

function lastModified(file) {
  // Prefer the last git commit date for this file (author/commit date, YYYY-MM-DD).
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return out; // empty when the file isn't committed yet
  } catch {
    // git missing or not a repo, fall through to mtime
  }
  return iso(fs.statSync(file).mtime);
}

const pages = fs.readdirSync(SITE)
  .filter(f => f.endsWith('.html'))
  .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));

const urls = pages.map(f => {
  // Cloudflare Pages serves clean URLs (/x.html is redirected to /x), so emit extensionless.
  const loc = f === 'index.html' ? `${BASE}/` : `${BASE}/${f.replace(/\.html$/, '')}`;
  const priority = f === 'index.html' ? '1.0' : '0.8';
  const lastmod = lastModified(path.join(SITE, f));
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

fs.writeFileSync(path.join(SITE, 'sitemap.xml'), xml);
console.log(`sitemap.xml written with ${pages.length} URLs (per-file lastmod)`);
