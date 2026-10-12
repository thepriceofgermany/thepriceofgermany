#!/usr/bin/env node
// Builds site/feed.xml (RSS 2.0) from the homepage report cards.
// MailerLite RSS campaigns, feed readers and Google News-style tools read this.
// Each item's <guid> is the post URL, which never changes, so a post is only
// "new" once. Run via `npm run rss` (also part of `npm run deploy`).
import fs from 'node:fs';
import path from 'node:path';
import { SITE, BASE, loadPosts, xml } from './lib-posts.mjs';

const posts = loadPosts().filter(p => p.hasPage).slice(0, 30);
const pub = p => new Date((p.date || '2026-01-01') + 'T08:00:00Z').toUTCString();

const items = posts.map(p => `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(p.url)}</link>
      <guid isPermaLink="true">${xml(p.url)}</guid>
      <pubDate>${pub(p)}</pubDate>
      <category>${xml(p.topic)}</category>
      <description>${xml(p.desc)}</description>${p.image ? `
      <media:content url="${xml(p.image)}" medium="image" />
      <enclosure url="${xml(p.image)}" type="image/jpeg" length="0" />` : ''}
    </item>`).join('\n');

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>The Price of Germany</title>
    <link>${BASE}/</link>
    <atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Videos, guides and cost breakdowns about life and money in Germany.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
fs.writeFileSync(path.join(SITE, 'feed.xml'), feed);
console.log(`feed.xml written with ${posts.length} items`);
