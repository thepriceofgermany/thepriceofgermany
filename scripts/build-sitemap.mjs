#!/usr/bin/env node
// Regenerates site/sitemap.xml from the .html files in site/.
// Run after adding a new post:  npm run sitemap
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const BASE = 'https://thepriceofgermany.com';
const today = new Date().toISOString().slice(0, 10);

const pages = fs.readdirSync(SITE)
  .filter(f => f.endsWith('.html'))
  .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));

const urls = pages.map(f => {
  // Cloudflare Pages serves clean URLs (/x.html is redirected to /x), so emit extensionless.
  const loc = f === 'index.html' ? `${BASE}/` : `${BASE}/${f.replace(/\.html$/, '')}`;
  const priority = f === 'index.html' ? '1.0' : '0.8';
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

fs.writeFileSync(path.join(SITE, 'sitemap.xml'), xml);
console.log(`sitemap.xml written with ${pages.length} URLs (${today})`);
