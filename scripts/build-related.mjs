#!/usr/bin/env node
// Injects a "Keep reading" related-posts block into every post, before <footer>.
// Source of truth is the homepage report cards (site/index.html): each card
// carries data-cat, topic label, title, description and date. We reuse that
// metadata so related links stay in sync with the homepage automatically.
//
// Internal links between topically-related posts are one of the highest-ROI
// on-site SEO moves: they spread crawl depth and link equity, and keep readers
// on the site. Run as part of `npm run deploy` (see package.json).
//
// Idempotent: the block is wrapped in <!-- related:start --> / <!-- related:end -->
// markers, so re-running replaces the block instead of stacking duplicates.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const INDEX = path.join(SITE, 'index.html');

const RELATED_COUNT = 4;

// The interactive calculator is a conversion asset, not a blog card, so it is
// injected by hand as the lead related tile on money-focused posts.
const CALCULATOR = {
  href: '/cost-of-living-calculator',
  topic: 'Tool',
  title: 'Cost of Living Calculator',
  desc: 'Pick two cities and see the real monthly breakdown, side by side.',
  ts: Infinity, // always sorts first when eligible
};
const MONEY_CATS = new Set([
  'cost-of-living', 'salary', 'housing', 'relocation', 'investing', 'childcare', 'education',
]);

// Which categories are thematically adjacent, used to fill related slots once
// same-category posts run out (before falling back to most-recent overall).
const ADJACENT = {
  'cost-of-living': ['salary', 'housing', 'relocation', 'childcare', 'investing'],
  'salary': ['cost-of-living', 'investing', 'economy'],
  'housing': ['cost-of-living', 'relocation'],
  'relocation': ['cost-of-living', 'housing', 'salary'],
  'childcare': ['parental-leave', 'cost-of-living', 'education'],
  'parental-leave': ['childcare', 'cost-of-living'],
  'healthcare': ['insurance', 'cost-of-living'],
  'insurance': ['healthcare', 'cost-of-living'],
  'investing': ['salary', 'cost-of-living'],
  'education': ['childcare', 'cost-of-living'],
  'politics': ['economy'],
  'economy': ['politics', 'cost-of-living'],
  'culture': ['cost-of-living'],
};

// --- parse homepage cards -------------------------------------------------
const indexHtml = fs.readFileSync(INDEX, 'utf8');
const cardRe = /<a class="tag-card"[^>]*\bdata-cat="([^"]+)"[^>]*\bhref="([^"]+)"[\s\S]*?<span class="tag-topic">([\s\S]*?)<\/span>[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<div class="tag-compare">\s*<span>([\s\S]*?)<\/span>/g;

const posts = [];
for (const m of indexHtml.matchAll(cardRe)) {
  const [, cat, href, topic, title, desc, date] = m;
  const ts = Date.parse(date.trim());
  posts.push({
    cat: cat.trim(),
    href: href.trim(),
    topic: topic.trim(),
    title: title.trim(),
    desc: desc.trim(),
    ts: Number.isNaN(ts) ? 0 : ts,
  });
}
if (posts.length === 0) {
  console.error('build-related: no cards parsed from index.html, aborting.');
  process.exit(1);
}

const byRecency = (a, b) => b.ts - a.ts;
const postByHref = new Map(posts.map(p => [p.href, p]));

// Full relevance-ordered candidate list (hrefs) for a post: same category first,
// then adjacent categories, then everything else by recency. Every other post
// appears exactly once, so any post is always an eligible link target.
function orderedCandidates(post) {
  const same = posts.filter(p => p.href !== post.href && p.cat === post.cat).sort(byRecency);
  const adjCats = new Set(ADJACENT[post.cat] || []);
  const adj = posts
    .filter(p => p.href !== post.href && p.cat !== post.cat && adjCats.has(p.cat))
    .sort(byRecency);
  const rest = posts.filter(p => p.href !== post.href).sort(byRecency);

  const ordered = [];
  const seen = new Set([post.href]);
  for (const p of [...same, ...adj, ...rest]) {
    if (seen.has(p.href)) continue;
    seen.add(p.href);
    ordered.push(p.href);
  }
  return ordered;
}

// Minimum inbound related links every post should receive. Picking purely by
// topical relevance leaves niche / single-category posts linked only from the
// homepage, which is exactly what makes Google leave them "Discovered -
// currently not indexed". We lift every post to this floor while keeping the
// links as topically relevant as the supply allows.
const FLOOR = 3;
// Real-post slots per post (money posts spend one slot on the calculator tile).
const realSlots = p => (MONEY_CATS.has(p.cat) ? RELATED_COUNT - 1 : RELATED_COUNT);

const ordByHref = new Map(posts.map(p => [p.href, orderedCandidates(p)]));
const rankOf = (dHref, uHref) => {
  const i = ordByHref.get(dHref).indexOf(uHref);
  return i < 0 ? Infinity : i;
};

// Initial picks: the most relevant real posts for each post.
const picks = new Map(posts.map(p => [p.href, ordByHref.get(p.href).slice(0, realSlots(p))]));

const inbound = new Map(posts.map(p => [p.href, 0]));
for (const arr of picks.values()) for (const h of arr) inbound.set(h, inbound.get(h) + 1);

// Greedy rebalance: repeatedly take the most under-linked post U and give it a
// slot borrowed from a donor D that currently links a post X with inbound to
// spare. We prefer donors where U is topically relevant and X is not, so the
// swap costs the least relevance. Each successful move raises U by one without
// pushing X below the floor, so the total deficit strictly shrinks and the loop
// terminates. Feasible here because total slots (~123) exceed 35 * FLOOR.
for (let guard = 0; guard < 10000; guard++) {
  const under = posts
    .filter(p => inbound.get(p.href) < FLOOR)
    .sort((a, b) => inbound.get(a.href) - inbound.get(b.href) || a.href.localeCompare(b.href));
  if (under.length === 0) break;
  const U = under[0].href;

  let best = null; // { D, X, score }
  for (const p of posts) {
    const D = p.href;
    if (D === U) continue;
    const arr = picks.get(D);
    if (arr.includes(U)) continue;
    const rankU = rankOf(D, U);
    for (const X of arr) {
      if (inbound.get(X) <= FLOOR) continue; // never push a donor's target below the floor
      // Reward swapping in a more relevant U for a less relevant X, plus spare surplus.
      const score = (rankOf(D, X) - rankU) + (inbound.get(X) - FLOOR) * 0.5;
      if (!best || score > best.score || (score === best.score && D + X < best.D + best.X)) {
        best = { D, X, score };
      }
    }
  }
  if (!best) break; // nothing left to borrow without dropping someone below the floor

  const arr = picks.get(best.D);
  arr[arr.indexOf(best.X)] = U;
  arr.sort((h1, h2) => rankOf(best.D, h1) - rankOf(best.D, h2)); // keep display order relevant
  inbound.set(best.X, inbound.get(best.X) - 1);
  inbound.set(U, inbound.get(U) + 1);
}

const stillUnder = posts.filter(p => inbound.get(p.href) < FLOOR);
if (stillUnder.length) {
  console.warn(`build-related: ${stillUnder.length} post(s) below ${FLOOR} inbound links: ` +
    stillUnder.map(p => `${p.href}(${inbound.get(p.href)})`).join(', '));
}

function relatedFor(post) {
  const real = picks.get(post.href).map(h => postByHref.get(h));
  const list = MONEY_CATS.has(post.cat) ? [CALCULATOR, ...real] : real;
  return list.slice(0, RELATED_COUNT);
}

// --- render ---------------------------------------------------------------
const STYLE = `<style>
    .related{max-width:1080px;margin:0 auto;padding:56px 24px 8px}
    .related-title{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:600;font-size:1.5rem;color:var(--ink);margin:0 0 20px}
    .related-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    .related-card{display:flex;flex-direction:column;gap:8px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:18px;text-decoration:none;color:inherit;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
    .related-card:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(35,38,43,.08);border-color:var(--coral)}
    .related-topic{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;color:var(--teal-dark)}
    .related-card h3{font-family:'Space Grotesk',system-ui,sans-serif;font-weight:600;font-size:1rem;line-height:1.25;color:var(--ink);margin:0}
    .related-card p{font-family:'Inter',system-ui,sans-serif;font-size:.85rem;line-height:1.45;color:var(--ink-soft);margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .related-more{margin-top:auto;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.7rem;letter-spacing:.06em;color:var(--coral)}
    @media(max-width:900px){.related-grid{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:520px){.related-grid{grid-template-columns:1fr}}
  </style>`;

function renderBlock(post) {
  const cards = relatedFor(post).map(r => `      <a class="related-card" href="${r.href}">
        <span class="related-topic">${r.topic}</span>
        <h3>${r.title}</h3>
        <p>${r.desc}</p>
        <span class="related-more">READ &rarr;</span>
      </a>`).join('\n');
  return `<!-- related:start -->
  ${STYLE}
  <section class="related" aria-label="Related reports">
    <h2 class="related-title">Keep reading</h2>
    <div class="related-grid">
${cards}
    </div>
  </section>
  <!-- related:end -->`;
}

// --- inject ---------------------------------------------------------------
const markerRe = /[ \t]*<!-- related:start -->[\s\S]*?<!-- related:end -->\n?/;
let updated = 0;

for (const post of posts) {
  const slug = post.href.replace(/^\//, '') || 'index';
  const file = path.join(SITE, `${slug}.html`);
  if (!fs.existsSync(file)) {
    console.warn(`build-related: no file for ${post.href}, skipping.`);
    continue;
  }
  let html = fs.readFileSync(file, 'utf8');
  const block = renderBlock(post);

  if (markerRe.test(html)) {
    html = html.replace(markerRe, `${block}\n`);
  } else {
    const footerIdx = html.search(/[ \t]*<footer[\s>]/);
    if (footerIdx === -1) {
      console.warn(`build-related: no <footer> in ${slug}, skipping.`);
      continue;
    }
    html = html.slice(0, footerIdx) + `${block}\n\n` + html.slice(footerIdx);
  }
  fs.writeFileSync(file, html);
  updated++;
}

console.log(`build-related: injected related blocks into ${updated} posts (${RELATED_COUNT} links each).`);
