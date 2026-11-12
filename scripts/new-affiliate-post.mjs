#!/usr/bin/env node
// Interactive: scaffold a new NON-VIDEO affiliate guide post, pre-wired with the
// comparison table, CTA boxes, and FAQ stubs. Companion to new-post.mjs (which is
// for video posts). See the non-video-affiliate-post-playbook.
//   npm run new-affiliate-post
//
// It clones site/best-dental-insurance-germany.html (the reference affiliate post:
// it already carries every component style, the SEO meta, and a null-safe chart
// script), swaps in your slug / title / affiliate id, replaces the article body
// with a ready-to-fill skeleton, regenerates the BlogPosting + FAQPage JSON-LD,
// and adds the homepage card (+ filter chip if the category is new).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const TEMPLATE = path.join(SITE, 'best-dental-insurance-germany.html');
const INDEX = path.join(SITE, 'index.html');
const LINKS = path.join(ROOT, 'scripts', 'affiliate-links.json');

// template's own values that we swap out
const T = {
  title: 'The Best Dental Insurance in Germany (and Why You Actually Need It)',
  slug: 'best-dental-insurance-germany',
  affId: 'feather-dental',
};

const noDash = (s) => s.replace(/\s*[—–]\s*/g, ', ');   // strip em/en dashes (site rule)
const attr = (s) => noDash(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const text = (s) => noDash(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const key  = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m[2] - 1];
  return `${mon} ${+m[3]}, ${m[1]}`;
}

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
  console.log('\n  New AFFILIATE post for The Price of Germany\n  (no video; Ctrl+C to cancel)\n');

  let slug;
  while (true) {
    slug = key(await ask('URL slug (e.g. best-dental-insurance-germany)'));
    if (!slug) { console.log('  ! slug required'); continue; }
    if (fs.existsSync(path.join(SITE, slug + '.html'))) { console.log('  ! that file already exists'); continue; }
    break;
  }
  const title = await ask('Post title (headline)');
  const label = await ask('Category label (e.g. Insurance)');
  const catKey = key(label);
  let dateIso, date;
  while (true) { dateIso = await ask('Publish date (YYYY-MM-DD)'); date = fmtDate(dateIso); if (date) break; console.log('  ! use YYYY-MM-DD'); }

  // affiliate link id (should already exist in scripts/affiliate-links.json)
  let registry = {};
  try { registry = JSON.parse(fs.readFileSync(LINKS, 'utf8')).links || {}; } catch {}
  const affId = key(await ask('Affiliate link id (from scripts/affiliate-links.json, e.g. feather-dental)'));
  const partner = await ask('Partner display name (e.g. Feather)');
  const comp1 = await ask('Competitor 1 name (optional)', 'Competitor A');
  const comp2 = await ask('Competitor 2 name (optional)', 'Competitor B');
  const hook = await ask('Short hook / dek (1-2 sentences, used on the card + intro)');
  const metaDesc = await ask('Meta description (SEO, ~155 chars)', hook);

  const affKnown = Object.prototype.hasOwnProperty.call(registry, affId);

  // ---- start from the reference affiliate post ----
  let post = fs.readFileSync(TEMPLATE, 'utf8');

  // drop the two content JSON-LD blocks (BlogPosting + FAQPage); regenerated below.
  post = post.replace(/<script type="application\/ld\+json">[^<]*?"BlogPosting"[^<]*?<\/script>\s*/, '');
  post = post.replace(/<script type="application\/ld\+json">[^<]*?"FAQPage"[^<]*?<\/script>\s*/, '');

  // replace the article body with a ready-to-fill skeleton (uses the final slug/affId/partner).
  const go = `/go/${affId}?p=${slug}`;
  const faqs = [
    { q: `What does this guide about ${text(label).toLowerCase()} in Germany cover?`, a: 'Replace this with a direct answer. Keep the same wording in the visible FAQ and the FAQPage schema below.' },
    { q: `How much does it cost in Germany?`, a: 'Give the real euro range. Numbers readers can act on.' },
    { q: `Which is the best option for expats: ${text(partner)}, ${text(comp1)} or ${text(comp2)}?`, a: `For most foreigners ${text(partner)} is the easiest pick: say why in plain English (price, English signup, coverage). Be honest about where the others win.` },
    { q: `Is there a catch to watch for?`, a: 'Waiting periods, caps, minimum terms, exclusions. Whatever trips people up.' },
    { q: `Do I even need it?`, a: 'Who should buy it and who can safely skip it.' },
  ];
  const faqVisible = faqs.map(f => `        <details>
          <summary>${text(f.q)}</summary>
          <div class="faq-body">${text(f.a)}</div>
        </details>`).join('\n');

  const skeleton = `<article>
    <div class="shell">

      <p class="lede">${text(hook)}</p>

      <p>I'm Justin. I'm American, I've lived in Germany for over 12 years, and every week on this channel I put real numbers next to real numbers, Germany versus the US, so you can see what things actually cost here instead of relying on guesswork. [Transition into the topic.]</p>

      <h2>What German [public insurance / the system] actually covers</h2>
      <p>[What the default covers, and where it stops. Use the video/research, never invented.]</p>

      <div class="compare">
        <div class="compare-title">Typical costs in Germany</div>
        <div class="compare-row de"><span class="country">Item one</span><span class="value">&euro;000 to &euro;000</span></div>
        <div class="compare-row de"><span class="country">Item two</span><span class="value">&euro;000 to &euro;000</span></div>
      </div>

      <h2>Germany vs the USA</h2>
      <p>[The Germany-vs-USA cost framing. One honest counterpoint, then the numbers.]</p>

      <div class="compare">
        <div class="compare-title">[Metric], out of pocket</div>
        <div class="compare-row us"><span class="country">USA</span><span class="value">$000</span></div>
        <div class="compare-row de"><span class="country">Germany</span><span class="value">&euro;000</span></div>
      </div>

      <h2>${text(partner)} vs ${text(comp1)} vs ${text(comp2)}: the real comparison</h2>
      <p>[Why these three. All legitimate. The difference that matters for a foreigner.] If you would rather just see your options, you can <a class="inline-cta" href="${go}" target="_blank" rel="noopener sponsored">check ${text(partner)} here &rarr;</a></p>

      <div class="cmp-wrap">
        <table class="cmp">
          <colgroup><col><col class="pick"><col><col></colgroup>
          <thead>
            <tr>
              <th></th>
              <th class="pick-col">${text(partner)} <span class="pick-badge">Best for expats</span></th>
              <th>${text(comp1)}</th>
              <th>${text(comp2)}</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">Starts at</th><td class="pick-col"><strong>&euro;0/mo</strong></td><td>&euro;0/mo</td><td>&euro;0/mo</td></tr>
            <tr><th scope="row">Sign up fully in English</th><td class="pick-col"><span class="yes">Yes</span></td><td>?</td><td><span class="no">?</span></td></tr>
            <tr><th scope="row">Built for internationals</th><td class="pick-col"><span class="yes">Yes</span></td><td>Partly</td><td>?</td></tr>
            <tr><th scope="row">Key feature</th><td class="pick-col">?</td><td>?</td><td>?</td></tr>
            <tr><th scope="row">The catch</th><td class="pick-col">?</td><td>?</td><td>?</td></tr>
          </tbody>
        </table>
      </div>
      <p style="font-size:12.5px;color:var(--ink-soft);font-family:'IBM Plex Mono',monospace;margin-top:-8px;">Figures are entry-level starting prices and typical terms; always confirm current terms on the provider's site before buying.</p>

      <h3>Where each one wins, and loses</h3>
      <p><strong>${text(comp1)}</strong> [strength, then the catch for foreigners].</p>
      <p><strong>${text(comp2)}</strong> [strength, then the catch].</p>
      <p><strong>${text(partner)}</strong> [why it is the fewest-surprises option for an expat].</p>

      <div class="verdict">
        <span class="v-label">The pick</span>
        <h3>For most foreigners in Germany, ${text(partner)} is the one to get</h3>
        <p>[One tight paragraph on why. Honest, specific, no empty superlatives.]</p>
        <a class="rec-btn" href="${go}" target="_blank" rel="noopener sponsored">Get ${text(partner)} &rarr;</a>
      </div>

      <div class="rec-card">
        <span class="rec-hole"></span>
        <span class="rec-label">Recommended</span>
        <h3>Compare ${text(partner)} in plain English</h3>
        <p>[What the reader gets: a quote in minutes, English signup, clear coverage.]</p>
        <a class="rec-btn" href="${go}" target="_blank" rel="noopener sponsored">See ${text(partner)} &rarr;</a>
      </div>

      <h2>Who actually needs it (and who can skip it)</h2>
      <p><strong>You probably want it if</strong> [the reader profile that benefits].</p>
      <p><strong>You can probably skip it if</strong> [the exception].</p>

      <blockquote>[A sharp one-line takeaway.]</blockquote>

      <h2>Common questions about ${text(label).toLowerCase()} in Germany</h2>
      <div class="faq">
${faqVisible}
      </div>

      <h2>What to do about it</h2>
      <p>Here is the short version.</p>

      <ol class="action-list">
        <li><p><strong>Step one.</strong> [Action.] You can <a class="inline-cta" href="${go}" target="_blank" rel="noopener sponsored">start a ${text(partner)} quote here &rarr;</a></p></li>
        <li><p><strong>Step two.</strong> [Action.]</p></li>
        <li><p><strong>Step three.</strong> [Action.]</p></li>
      </ol>

      <p>[Closing paragraph that lands the "price of Germany" theme.]</p>

      <div class="disclosure">
        DISCLOSURE: This post contains an affiliate link for ${text(partner)}. If you sign up through it, I may earn a small commission at no extra cost to you. I only recommend services I actually use and would point a friend to. Prices and coverage details are typical figures and can change, always check the current terms before buying.
      </div>

    </div>
  </article>`;
  post = post.replace(/<article>[\s\S]*?<\/article>/, () => skeleton);

  // swap slug (canonical, og:url) and affiliate id anywhere they still appear.
  post = post.split(T.slug).join(slug);
  post = post.split(T.affId).join(affId);

  // title: JSON name handled in regenerated schema; here fix the HTML occurrences.
  post = post.split(T.title).join(attr(title));

  // meta + social copy
  post = post.replace(/(<meta name="description" content=")[^"]*(">)/, (m, a, b) => a + attr(metaDesc) + b);
  post = post.replace(/(<meta property="og:description" content=")[^"]*(">)/, (m, a, b) => a + attr(metaDesc) + b);
  post = post.replace(/(<meta name="twitter:description" content=")[^"]*(">)/, (m, a, b) => a + attr(metaDesc) + b);
  post = post.replace(/(<meta property="og:image:alt" content=")[^"]*(">)/, (m, a, b) => a + attr('The Price of Germany ' + label + ' report') + b);
  post = post.replace(/(<meta property="article:published_time" content=")[^"]*(">)/, (m, a, b) => a + dateIso + b);
  post = post.replace(/(<meta property="article:modified_time" content=")[^"]*(">)/, (m, a, b) => a + dateIso + b);
  post = post.replace(/(<meta property="article:section" content=")[^"]*(">)/, (m, a, b) => a + attr(label) + b);
  post = post.replace(/(<span class="eyebrow">)[^<]*(<\/span>)/, (m, a, b) => a + text(label) + ' report' + b);
  post = post.replace(/(<span class="post-date">)[^<]*(<\/span>)/, (m, a, b) => a + date + b);

  // ---- fresh BlogPosting + FAQPage JSON-LD (FAQPage mirrors the visible FAQ) ----
  const bp = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: noDash(title), description: noDash(metaDesc),
    image: 'https://thepriceofgermany.com/assets/justin-photo.jpg',
    datePublished: dateIso, dateModified: dateIso, inLanguage: 'en',
    author: { '@type': 'Person', name: 'Justin' },
    publisher: { '@type': 'Organization', name: 'The Price of Germany', logo: { '@type': 'ImageObject', url: 'https://thepriceofgermany.com/favicon.svg' } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://thepriceofgermany.com/${slug}` },
    articleSection: noDash(label),
  };
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: noDash(f.q), acceptedAnswer: { '@type': 'Answer', text: noDash(f.a) } })),
  };
  const ld = `<script type="application/ld+json">\n${JSON.stringify(bp, null, 2)}\n</script>\n<script type="application/ld+json">\n${JSON.stringify(faqLd, null, 2)}\n</script>\n<link rel="icon"`;
  post = post.replace('<link rel="icon"', () => ld);

  fs.writeFileSync(path.join(SITE, slug + '.html'), post);

  // ---- homepage card at the top of the grid (newest first) ----
  let index = fs.readFileSync(INDEX, 'utf8');
  const card = `        <a class="tag-card reveal" data-cat="${catKey}" href="/${slug}">
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
  if (!affKnown) {
    console.log(`\n  ! Affiliate id "${affId}" is NOT in scripts/affiliate-links.json yet.`);
    console.log(`    Add it there (with the real tracked URL), or the /go/${affId} redirect will 404.`);
  }
  console.log(`\n  Next:`);
  console.log(`   1. Fill the [bracketed] placeholders in site/${slug}.html (table, verdict, FAQ, body).`);
  console.log(`      Keep the visible FAQ answers identical to the FAQPage JSON-LD in <head>.`);
  console.log(`   2. npm run affiliate   (wires the /go link + checks for orphans)`);
  console.log(`   3. npm run deploy`);
  console.log(`   4. Push to GitHub (GitHub Desktop) to back it up.\n`);
} finally {
  if (rl) rl.close();
}
