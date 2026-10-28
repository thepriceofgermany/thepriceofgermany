#!/usr/bin/env node
// Builds the hidden subscriber library page from scripts/subscriber-library.json.
//   npm run library
// The page is noindex, not linked from the site, not in the sitemap, and not listed in robots.txt
// (so its URL is not published). It reuses the style, nav and footer of free-guides-thanks.html.
// To add a guide or a video: add an entry to subscriber-library.json, run `npm run library`, deploy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'subscriber-library.json'), 'utf8'));
const noDash = (s) => s.replace(/\s*[—–]\s*/g, ', ');
const esc = (s) => noDash(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let page = fs.readFileSync(path.join(SITE, 'free-guides-thanks.html'), 'utf8');
page = page.replace(/<title>[^<]*<\/title>/, '<title>Subscriber Library: The Price of Germany</title>');
page = page.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Free guides and checklists for subscribers.">');

const guides = data.guides.map((g) => `      <div class="dl-card">
        <span class="dl-tag">PDF</span>
        <h2>${esc(g.title)}</h2>
        <p>${esc(g.desc)}</p>
        <a class="dl-btn" href="${g.file}" download>${esc(g.btn)}</a>
        <div class="dl-meta">${esc(g.meta)}</div>
      </div>`).join('\n');

const videos = data.videos.map((v) => `        <li><strong>${esc(v.title)}</strong>: <a href="${v.video}" target="_blank" rel="noopener">watch the video</a> or <a href="${v.post}">read the post</a></li>`).join('\n');

const body = `<header class="post-head">
    <div class="shell">
      <span class="eyebrow">Subscriber library</span>
      <h1>Your free guides, always in one place.</h1>
      <p class="dek">Bookmark this page. Every new guide and checklist is added here, so you can always come back for the latest versions. Last updated ${esc(data.updated)}.</p>
    </div>
  </header>
  <article>
    <div class="shell">
${guides}
      <h2>Videos and the posts that go with them</h2>
      <ul>
${videos}
      </ul>
      <p>These guides are general information, not tax, legal or investment advice. Rules and figures change, so check your own situation with a Steuerberater, a fee only adviser (Honorarberater) or your local citizenship office.</p>
      <p>This page is for subscribers and is not listed on the site. Please do not share the link publicly. Questions? Write to <a href="mailto:contact@thepriceofgermany.com">contact@thepriceofgermany.com</a>.</p>
    </div>
  </article>
  `;
page = page.replace(/<header class="post-head">[\s\S]*?<\/article>\s*/, () => body);
if (/[–—]/.test(page.split('<body')[1])) throw new Error('dash found');
fs.writeFileSync(path.join(SITE, data.slug + '.html'), page);
console.log(`library: wrote site/${data.slug}.html (${data.guides.length} guides, ${data.videos.length} videos)`);
