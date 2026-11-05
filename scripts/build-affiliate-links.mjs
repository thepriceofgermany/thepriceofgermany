#!/usr/bin/env node
// Affiliate link registry → rewrite + audit + codegen.
//
// Single source of truth is scripts/affiliate-links.json. This script:
//   1. Rewrites every sponsored .rec-btn href in site/*.html whose URL matches a
//      registry entry to the tracked form /go/<id>. The Cloudflare Pages Function
//      functions/go/[id].js logs the click (D1) and 302-redirects to the real URL.
//   2. Generates functions/lib/links.json — the id→url map the Function imports
//      at runtime, so the raw merchant URLs live in exactly one committed place.
//   3. Generates site/affiliate-inventory.json — merchant/network/category and the
//      list of pages each link appears on, so the /analytics page can show the
//      full inventory even before any clicks are recorded.
//   4. Prints an audit: counts per link, and any ORPHAN sponsored links (a
//      rel="sponsored" href not in the registry) so nothing goes untracked.
//
// Idempotent: a href already in /go/<id> form is recognised and left as-is.
// Run via `npm run affiliate` (also wired into `npm run deploy`).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const REGISTRY = path.join(ROOT, 'scripts', 'affiliate-links.json');
const FN_LINKS = path.join(ROOT, 'functions', 'lib', 'links.json');
const FN_REVENUE = path.join(ROOT, 'functions', 'lib', 'revenue.json');
const INVENTORY = path.join(SITE, 'affiliate-inventory.json');

// --- load registry --------------------------------------------------------
const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const links = registry.links || {};
const ids = Object.keys(links);
if (ids.length === 0) {
  console.error('build-affiliate-links: registry has no links, aborting.');
  process.exit(1);
}

const urlToId = new Map();
for (const id of ids) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    console.error(`build-affiliate-links: invalid id "${id}" (use lowercase a-z 0-9 and dashes).`);
    process.exit(1);
  }
  const url = links[id].url;
  if (!url) { console.error(`build-affiliate-links: link "${id}" has no url.`); process.exit(1); }
  if (urlToId.has(url)) {
    console.error(`build-affiliate-links: duplicate url for "${id}" and "${urlToId.get(url)}": ${url}`);
    process.exit(1);
  }
  urlToId.set(url, id);
}
const idSet = new Set(ids);

// --- scan + rewrite --------------------------------------------------------
const files = fs.readdirSync(SITE).filter(f => f.endsWith('.html'));
const openTagRe = /<a\b[^>]*>/gi;
const hrefRe = /\bhref="([^"]*)"/i;
const relRe = /\brel="([^"]*)"/i;
const goRe = /^\/go\/([a-z0-9][a-z0-9-]*)(?:\?p=[a-z0-9][a-z0-9-]*)?$/;

const pagesById = new Map(ids.map(id => [id, new Set()]));
const orphans = new Map(); // url -> Set(slug)
let rewrites = 0;
let filesChanged = 0;

for (const file of files) {
  const slug = file === 'index.html' ? 'index' : file.replace(/\.html$/, '');
  const abs = path.join(SITE, file);
  const before = fs.readFileSync(abs, 'utf8');

  const after = before.replace(openTagRe, (tag) => {
    const hrefM = tag.match(hrefRe);
    if (!hrefM) return tag;
    const href = hrefM[1];

    // Already tracked? Rewrite the ?p=<slug> if the file moved, keep the id.
    const goM = href.match(goRe);
    if (goM) {
      const id = goM[1];
      if (!idSet.has(id)) { console.warn(`  ! ${slug}: /go/${id} has no registry entry`); return tag; }
      pagesById.get(id).add(slug);
      const want = `href="/go/${id}?p=${slug}"`;
      if (!hrefM[0].includes(`?p=${slug}`)) { rewrites++; return tag.replace(hrefRe, want); }
      return tag;
    }

    // Known raw URL → rewrite to /go/<id>?p=<slug>.
    if (urlToId.has(href)) {
      const id = urlToId.get(href);
      pagesById.get(id).add(slug);
      rewrites++;
      return tag.replace(hrefRe, `href="/go/${id}?p=${slug}"`);
    }

    // Untracked sponsored link → orphan (report only, never touch).
    const relM = tag.match(relRe);
    if (relM && /\bsponsored\b/i.test(relM[1])) {
      if (!orphans.has(href)) orphans.set(href, new Set());
      orphans.get(href).add(slug);
    }
    return tag;
  });

  if (after !== before) {
    fs.writeFileSync(abs, after);
    filesChanged++;
  }
}

// --- codegen: functions/lib/links.json -------------------------------------
const linkMap = Object.fromEntries(ids.map(id => [id, links[id].url]));
fs.mkdirSync(path.dirname(FN_LINKS), { recursive: true });
fs.writeFileSync(FN_LINKS, JSON.stringify(linkMap, null, 2) + '\n');

// --- maintain: functions/lib/revenue.json (private, you edit this by hand) --
// Cumulative revenue per link id, in one currency. Kept behind the /api/stats
// token (functions/ is bundled, never served as a static file). We only ADD new
// ids with 0 and never overwrite your figures, so it is safe to re-run.
let revenue = { currency: 'EUR', note: 'Cumulative revenue per link id. Edit the numbers, redeploy. Most of your partners have no API, so this is manual.', revenue: {} };
if (fs.existsSync(FN_REVENUE)) {
  try { revenue = JSON.parse(fs.readFileSync(FN_REVENUE, 'utf8')); revenue.revenue = revenue.revenue || {}; }
  catch { console.warn('  ! revenue.json unparseable, leaving it untouched.'); revenue = null; }
}
if (revenue) {
  let added = 0;
  for (const id of ids) if (!(id in revenue.revenue)) { revenue.revenue[id] = 0; added++; }
  fs.writeFileSync(FN_REVENUE, JSON.stringify(revenue, null, 2) + '\n');
  if (added) console.log(`  revenue.json: added ${added} new link id(s) at 0.`);
}

// --- codegen: site/affiliate-inventory.json --------------------------------
const inventory = {
  generatedAt: new Date().toISOString(),
  links: ids.map(id => ({
    id,
    merchant: links[id].merchant,
    network: links[id].network,
    category: links[id].category,
    pages: [...pagesById.get(id)].sort(),
  })).sort((a, b) => a.merchant.localeCompare(b.merchant) || a.id.localeCompare(b.id)),
};
fs.writeFileSync(INVENTORY, JSON.stringify(inventory, null, 2) + '\n');

// --- audit report ----------------------------------------------------------
console.log(`build-affiliate-links: rewrote ${rewrites} href(s) across ${filesChanged} file(s).`);
console.log('  inventory:');
for (const l of inventory.links) {
  const n = l.pages.length;
  console.log(`    ${l.id.padEnd(20)} ${String(n).padStart(2)} page(s)  [${l.merchant} / ${l.network}]${n === 0 ? '  — UNUSED' : ''}`);
}
if (orphans.size) {
  console.warn(`  ${orphans.size} ORPHAN sponsored link(s) not in the registry — add them to scripts/affiliate-links.json:`);
  for (const [url, slugs] of orphans) console.warn(`    ${url}  (on: ${[...slugs].sort().join(', ')})`);
} else {
  console.log('  no orphan sponsored links — every tracked link is in the registry.');
}
