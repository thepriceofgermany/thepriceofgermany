// Shared helpers: read post metadata from the homepage cards and each post's own HTML.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = path.join(ROOT, 'site');
export const BASE = 'https://thepriceofgermany.com';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', rarr: '→', euro: '€', eacute: 'é', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß', middot: '·' };
export function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
}
export const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const strip = s => decode(String(s).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

function ldBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch { /* skip malformed block */ }
  }
  return out;
}

const cardRe = /<a class="tag-card"[^>]*\bdata-cat="([^"]+)"[^>]*\bhref="([^"]+)"[\s\S]*?<span class="tag-topic">([\s\S]*?)<\/span>[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<div class="tag-compare">\s*<span>([\s\S]*?)<\/span>/g;

export function loadPosts() {
  const index = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const posts = [];
  let order = 0;
  for (const m of index.matchAll(cardRe)) {
    const [, cat, href, topic, title, desc, date] = m;
    const slug = href.trim().replace(/^\//, '').replace(/\.html$/, '');
    const file = path.join(SITE, slug + '.html');
    let html = '';
    try { html = fs.readFileSync(file, 'utf8'); } catch { /* card without page (external) */ }
    const ld = html ? ldBlocks(html) : [];
    const blog = ld.find(b => b['@type'] === 'BlogPosting') || {};
    const video = ld.find(b => b['@type'] === 'VideoObject') || {};
    const cardTs = Date.parse(strip(date));
    const isoDate = blog.datePublished || video.uploadDate || (Number.isNaN(cardTs) ? null : new Date(cardTs).toISOString().slice(0, 10));
    const metaDesc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
    const ytId = (video.embedUrl || '').split('/embed/')[1];
    posts.push({
      slug, href: '/' + slug, url: `${BASE}/${slug}`,
      cat: cat.trim(), topic: strip(topic), title: strip(title),
      desc: strip(desc), metaDesc: metaDesc ? decode(metaDesc) : strip(desc),
      date: isoDate, dateLabel: strip(date),
      ts: isoDate ? Date.parse(isoDate) : 0,
      image: blog.image || video.thumbnailUrl || null,
      youtube: ytId ? `https://www.youtube.com/watch?v=${ytId}` : null,
      order: order++,
      hasPage: !!html,
    });
  }
  if (!posts.length) throw new Error('No cards parsed from site/index.html');
  return posts.sort((a, b) => b.ts - a.ts || a.order - b.order);
}
