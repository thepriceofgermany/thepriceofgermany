#!/usr/bin/env node
// Turns a blog post into a ready-to-send newsletter.
//   npm run newsletter                 -> newest post
//   npm run newsletter -- <slug>       -> a specific post (e.g. moving-to-germany-cost)
// Writes newsletter/<slug>.html (paste into MailerLite's custom HTML editor, if your plan has it)
// and newsletter/<slug>.txt (subject, preview text, blocks to copy into the drag and drop editor).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadPosts, xml } from './lib-posts.mjs';

const arg = (process.argv[2] || '').replace(/^\//, '').replace(/\.html$/, '');
const posts = loadPosts().filter(p => p.hasPage);
const post = arg ? posts.find(p => p.slug === arg) : posts[0];
if (!post) {
  console.error(`No post found for "${arg}". Available:\n  ` + posts.map(p => p.slug).join('\n  '));
  process.exit(1);
}

const utm = (u, content) => `${u}?utm_source=newsletter&utm_medium=email&utm_campaign=${post.slug}&utm_content=${content}`;
const read = utm(post.url, 'read');
const watch = post.youtube ? post.youtube : null;
const first = post.desc.split(/(?<=[.!?])\s+/)[0] || post.desc;
const preview = (first.length > 110 ? first.slice(0, 107).replace(/\s+\S*$/, '') + '...' : first);
const short = post.title.replace(/\s*\([^)]*\)\s*$/, '');
const subject = short.length <= 70 ? short : short.slice(0, 68).replace(/\s+\S*$/, '') + '...';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${xml(post.title)}</title>
</head>
<body style="margin:0;padding:0;background:#FDF8F0;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${xml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF8F0;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFDF6;border:1px solid #E7E0D2;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#23262B;">
    <tr><td style="background:#FF5A5F;padding:16px 28px;color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:1px;">THE PRICE OF GERMANY</td></tr>${post.image ? `
    <tr><td><a href="${xml(read)}"><img src="${xml(post.image)}" width="600" alt="${xml(post.title)}" style="display:block;width:100%;height:auto;border:0;"></a></td></tr>` : ''}
    <tr><td style="padding:28px 28px 8px;">
      <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#14807B;margin-bottom:10px;">${xml(post.topic)}</div>
      <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;color:#23262B;">${xml(post.title)}</h1>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#23262B;">${xml(post.desc)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#FF5A5F;border-radius:10px;"><a href="${xml(read)}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">Read the full breakdown</a></td>${watch ? `
        <td style="width:12px;"></td>
        <td style="border:2px solid #23262B;border-radius:10px;"><a href="${xml(utm(watch, 'watch').replace('?utm_source', '&utm_source'))}" style="display:inline-block;padding:11px 22px;font-size:16px;font-weight:bold;color:#23262B;text-decoration:none;">Watch the video</a></td>` : ''}
      </tr></table>
    </td></tr>
    <tr><td style="padding:24px 28px 8px;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#5B5F66;">Thanks for reading,<br>Justin</p>
    </td></tr>
    <tr><td style="padding:20px 28px 28px;font-size:12px;line-height:1.6;color:#5B5F66;border-top:1px solid #E7E0D2;">
      You are receiving this because you subscribed at thepriceofgermany.com.<br>
      <a href="{$unsubscribe}" style="color:#5B5F66;">Unsubscribe</a> &middot; <a href="https://thepriceofgermany.com/privacy" style="color:#5B5F66;">Privacy</a> &middot; <a href="https://thepriceofgermany.com/imprint" style="color:#5B5F66;">Imprint</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;

const txt = `NEWSLETTER FOR: ${post.title}
Post: ${post.url}
Published: ${post.dateLabel}

=== COPY INTO MAILERLITE (Campaigns > Create campaign) ===

Campaign name:   ${post.slug}
Subject line:    ${subject}
Preview text:    ${preview}
From:            The Price of Germany <contact@thepriceofgermany.com>
Send to:         group "Website subscribers"

--- Drag and drop editor blocks ---
Image URL:       ${post.image || '(this post has no image, skip the image block)'}
Small label:     ${post.topic}
Headline:        ${post.title}
Body:            ${post.desc}
Button 1 text:   Read the full breakdown
Button 1 link:   ${read}${watch ? `
Button 2 text:   Watch the video
Button 2 link:   ${utm(watch, 'watch').replace('?utm_source', '&utm_source')}` : ''}
Sign-off:        Thanks for reading, Justin

--- Subject line alternatives ---
${post.title}
New: ${post.title}
${first}

=== BEFORE YOU SEND ===
1. Send a test email to yourself and open every link.
2. Check the subject and preview text on your phone.
3. Make sure the post is live on the site first (deployed).
4. Schedule or send.

If your MailerLite plan has the custom HTML editor, you can paste the contents of ${post.slug}.html instead of using the blocks above.
`;

const dir = path.join(ROOT, 'newsletter');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, post.slug + '.html'), html);
fs.writeFileSync(path.join(dir, post.slug + '.txt'), txt);
console.log(txt);
console.log(`Written: newsletter/${post.slug}.html and newsletter/${post.slug}.txt`);
