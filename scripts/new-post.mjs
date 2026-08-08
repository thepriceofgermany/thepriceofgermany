#!/usr/bin/env node
// Interactive: scaffold a new post .html, add its homepage card (newest-first),
// and add a filter chip if the category is new.
//   npm run new-post
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const TEMPLATE = path.join(SITE, 'salary-in-germany-vs-usa.html');
const INDEX = path.join(SITE, 'index.html');

// template's own values that we swap out
const T = {
  title: 'The German Salary Trap: Why Your Gross Pay Is A Lie',
  slug: 'salary-in-germany-vs-usa',
  video: 'KNk8xvkgPmE',
  eyebrow: 'Salary report',
  date: 'Aug 1, 2026',
  metaDesc: 'An American expat in Germany breaks down what things actually cost, including rent, healthcare, groceries, and taxes, dollar for dollar, euro for euro.',
};

const noDash = (s) => s.replace(/[—–]/g, ', ');           // strip em/en dashes (site rule)
const attr = (s) => noDash(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const text = (s) => noDash(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const key  = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m[2] - 1];
  return `${mon} ${+m[3]}, ${m[1]}`;
}

function videoId(v) {
  v = v.trim();
  const m = v.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(v) ? v : null);
}

// Interactive on a TTY; otherwise consume piped stdin line by line (keeps it testable).
const interactive = Boolean(input.isTTY);
const rl = interactive ? readline.createInterface({ input, output }) : null;
let piped = [], pi = 0;
if (!interactive) piped = fs.readFileSync(0, 'utf8').split('\n');
const ask = async (q, def) => {
  if (!interactive) { const v = (piped[pi++] ?? '').trim(); return v || def || ''; }
  const a = (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim();
  return a || def || '';
};

try {
  console.log('\n  New post for The Price of Germany\n  (Ctrl+C to cancel)\n');

  let slug;
  while (true) {
    slug = key(await ask('URL slug (e.g. groceries-in-germany-vs-usa)'));
    if (!slug) { console.log('  ! slug required'); continue; }
    if (fs.existsSync(path.join(SITE, slug + '.html'))) { console.log('  ! that file already exists'); continue; }
    break;
  }
  const title = await ask('Post title (headline)');
  const label = await ask('Category label (e.g. Groceries)');
  const catKey = key(label);
  let dateIso, date;
  while (true) { dateIso = await ask('Publish date (YYYY-MM-DD)'); date = fmtDate(dateIso); if (date) break; console.log('  ! use YYYY-MM-DD'); }
  let vid;
  while (true) { vid = videoId(await ask('YouTube video ID or URL')); if (vid) break; console.log('  ! need an 11-char video id or a YouTube URL'); }
  const hook = await ask('Short hook (1-2 sentences, used on the card + intro)');
  const metaDesc = await ask('Meta description (SEO)', hook);

  // ---- build the post file from the template ----
  let post = fs.readFileSync(TEMPLATE, 'utf8');
  post = post.split(T.video).join(vid);                         // thumbnail + embed + iframe src
  post = post.split(T.slug).join(slug);                          // canonical + og:url
  post = post.split(T.title).join(text(title));                  // <title>, og:title, JSON-LD name, iframe title, h1
  // NOTE: use replacement FUNCTIONS, not template strings. A template string in
  // the 2nd arg treats "$1" (e.g. inside a price like "$1,297") as a capture-group
  // backreference and corrupts the output.
  post = post.replace(/(<meta name="description" content=")[^"]*(">)/, (m, a, b) => a + attr(metaDesc) + b);
  post = post.replace(/(<meta property="og:description" content=")[^"]*(">)/, (m, a, b) => a + attr(metaDesc) + b);
  post = post.replace(/("description":\s*")[^"]*(")/, (m, a, b) => a + attr(metaDesc) + b);
  post = post.replace(/(<span class="eyebrow">)[^<]*(<\/span>)/, (m, a, b) => a + text(label) + ' report' + b);
  post = post.replace(/(<span class="post-date">)[^<]*(<\/span>)/, (m, a, b) => a + date + b);
  post = post.replace(/<p class="dek">[\s\S]*?<\/p>/, () => `<p class="dek">${text(hook)}</p>`);
  post = post.replace(/<article>[\s\S]*?<\/article>/, () => `<article>
    <div class="shell">

      <p class="lede">${text(hook)}</p>

      <h2>Add your first section heading</h2>
      <p>Write the body from the video's actual transcript. No em dashes. Add comparison boxes / receipt-style breakdowns as needed (see other posts for .compare / .payslip / .state-box patterns).</p>

      <!-- Affiliate / sponsor callout: place where it is contextually relevant, not just at the end.
      <div class="rec-card">
        <span class="rec-hole"></span>
        <span class="rec-label">Recommended</span>
        <h3>Product or service name</h3>
        <p>One line on why it fits here.</p>
        <a class="btn btn-primary" href="AFFILIATE_URL" target="_blank" rel="noopener sponsored">Check it out</a>
      </div>
      -->

      <p><em>This article contains affiliate links. If you buy through them, we may earn a commission at no extra cost to you.</em></p>

    </div>
  </article>`);

  fs.writeFileSync(path.join(SITE, slug + '.html'), post);

  // ---- add the homepage card at the top of the grid (newest first) ----
  let index = fs.readFileSync(INDEX, 'utf8');
  const card = `        <a class="tag-card" data-cat="${catKey}" href="/${slug}">
          <span class="tag-hole"></span>
          <span class="tag-topic">${text(label)}</span>
          <h3>${text(title)}</h3>
          <p>${text(hook)}</p>
          <div class="tag-compare">
            <span>${date}</span>
            <span class="status">READ &rarr;</span>
          </div>
        </a>`;
  index = index.replace(/<div class="grid">\n/, (m) => `${m}\n${card}\n`);

  // ---- add a filter chip if this category is new ----
  let addedChip = false;
  if (!new RegExp(`data-filter="${catKey}"`).test(index)) {
    index = index.replace(
      /(<div class="filter-bar"[\s\S]*?)(\n\s*<\/div>\s*\n\s*<div class="grid">)/,
      (m, a, b) => a + `\n        <button class="chip" type="button" data-filter="${catKey}">${text(label)}</button>` + b
    );
    addedChip = true;
  }
  fs.writeFileSync(INDEX, index);

  console.log(`\n  Created  site/${slug}.html`);
  console.log(`  Card added to the top of the homepage grid (category: ${label}${addedChip ? ', new filter chip added' : ''}).`);
  console.log(`\n  Next:`);
  console.log(`   1. Edit site/${slug}.html  ->  fill the article body from the video transcript.`);
  console.log(`   2. npm run deploy`);
  console.log(`   3. Push to GitHub (GitHub Desktop) to back it up.\n`);
} finally {
  if (rl) rl.close();
}
