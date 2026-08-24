#!/usr/bin/env node
// Post Studio: a small local web GUI for adding a new blog post.
// Fill the form, click Publish -> it writes the post, adds the homepage card +
// category chip, regenerates the sitemap, commits, and (optionally) deploys.
//   npm run studio
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { execFile, exec } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const TEMPLATE = path.join(SITE, 'salary-in-germany-vs-usa.html');
const INDEX = path.join(SITE, 'index.html');
const KEY_FILE = path.join(ROOT, '.studio-key');
const PORT = 4477;

function readKey() { try { return fs.readFileSync(KEY_FILE, 'utf8').trim(); } catch { return ''; } }

// Turn a raw transcript into the Studio's markdown-lite (## headings, **bold**,
// [[AFFILIATE]] marker, [text](url) links) using Claude, so the existing
// bodyToHtml() converter turns it into a formatted article.
const FORMAT_SYSTEM = `You format a YouTube video transcript into a clean blog article body for a cost-of-living channel. You are a FORMATTER, not a writer: keep the host's voice, facts, and numbers exactly; never invent, add, or remove information.

Output rules, follow all of them:
- Output ONLY the article body. No preamble, no title, no HTML, no code fences, no closing remarks about what you did.
- Break the text into readable paragraphs (a blank line between paragraphs).
- Insert section headings as lines starting with "## " where the topic clearly shifts. Keep headings short and concrete. Do not over-segment: aim for one heading every 2 to 4 paragraphs.
- Bold the key figures and standout terms with **double asterisks** (specific numbers, prices, percentages, named laws or programs). Do not bold whole sentences.
- If an affiliate product is provided, put the marker [[AFFILIATE]] on its own line at the single point in the transcript where the host recommends it or says a link is below. If no affiliate is provided, do not add the marker.
- Absolutely no em dashes or en dashes. Use commas, colons, or periods instead.
- Fix only obvious speech-to-text artifacts (a clearly misspelled place or word, a stray filler). Do not rewrite sentences or change meaning.`;

async function aiFormat({ title, transcript, affiliate }) {
  const key = readKey();
  if (!key) throw new Error('No Anthropic API key saved yet. Paste your key in the "AI key" field and click Save.');
  const client = new Anthropic({ apiKey: key });

  const affLine = affiliate && affiliate.url
    ? `Affiliate product to place with [[AFFILIATE]]: "${affiliate.heading || 'recommended product'}".`
    : 'No affiliate product for this post; do not add an [[AFFILIATE]] marker.';
  const user = `Video title: ${title || '(untitled)'}\n${affLine}\n\nTranscript:\n"""\n${transcript}\n"""`;

  const msg = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    output_config: { effort: 'low' },
    system: FORMAT_SYSTEM,
    messages: [{ role: 'user', content: user }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('The model declined to format this text. Format it manually, or edit the transcript and retry.');
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

// template's own values that get swapped out
const T = {
  title: 'The German Salary Trap: Why Your Gross Pay Is A Lie',
  slug: 'salary-in-germany-vs-usa',
  video: 'KNk8xvkgPmE',
};

// ---------- helpers ----------
const stripDashes = (s) => String(s).replace(/\s*—\s*/g, ', ').replace(/–/g, '-');
const key = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const escText = (s) => stripDashes(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => stripDashes(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return null;
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m[2] - 1];
  return `${mon} ${+m[3]}, ${m[1]}`;
}
function videoId(v) {
  v = String(v).trim();
  const m = v.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(v) ? v : null);
}
function inline(s) {
  s = escText(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s;
}
function affiliateCard(a) {
  if (!a || !a.url) return '';
  return `<div class="rec-card">
        <span class="rec-hole"></span>
        <span class="rec-label">${escText(a.label || 'Recommended')}</span>
        <h3>${escText(a.heading || '')}</h3>
        <p>${escText(a.blurb || '')}</p>
        <a class="rec-btn" href="${escAttr(a.url)}" target="_blank" rel="noopener sponsored">${escText(a.button || 'Check it out')} &rarr;</a>
      </div>`;
}
// Turn the pasted body into HTML: blank-line paragraphs, "## " headings,
// "### " subheadings, **bold**, [text](url) links, and a [[AFFILIATE]] marker.
function bodyToHtml(raw, affHtml) {
  const clean = String(raw).replace(/\r\n/g, '\n').trim();
  const blocks = clean.split(/\n\s*\n/);
  const parts = [];
  for (let b of blocks) {
    b = b.trim();
    if (!b) continue;
    if (b === '[[AFFILIATE]]') { if (affHtml) parts.push(affHtml); continue; }
    if (b.startsWith('### ')) { parts.push(`<h3>${inline(b.slice(4))}</h3>`); continue; }
    if (b.startsWith('## ')) { parts.push(`<h2>${inline(b.slice(3))}</h2>`); continue; }
    const p = b.split('\n').map((l) => l.trim()).join(' ');
    parts.push(`<p>${inline(p)}</p>`);
  }
  return parts.join('\n\n      ');
}

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: ROOT, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: (stdout || '') + (stderr || '') });
    });
  });
}
function runShell(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd: ROOT, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: (stdout || '') + (stderr || '') });
    });
  });
}

// ---------- build one post ----------
function buildPost(d) {
  const slug = key(d.slug || d.title);
  if (!slug) throw new Error('A slug or title is required.');
  const file = path.join(SITE, slug + '.html');
  if (fs.existsSync(file)) throw new Error(`A post at /${slug} already exists.`);
  const vid = videoId(d.video);
  if (!vid) throw new Error('Enter a valid YouTube video ID or URL.');
  const date = fmtDate(d.date);
  if (!date) throw new Error('Publish date must be YYYY-MM-DD.');
  const title = String(d.title || '').trim();
  if (!title) throw new Error('Title is required.');
  const label = String(d.category || '').trim();
  if (!label) throw new Error('Category is required.');
  const catKey = key(label);
  const hook = String(d.hook || '').trim();
  const metaDesc = String(d.meta || hook).trim();

  const affHtml = affiliateCard(d.affiliate);
  let bodyHtml = bodyToHtml(d.body, affHtml);
  if (affHtml && !String(d.body).includes('[[AFFILIATE]]')) bodyHtml += `\n\n      ${affHtml}`;
  if (d.affiliate && d.affiliate.url) {
    bodyHtml += `\n\n      <p><em>This article contains affiliate links. If you buy or sign up through them, I may earn a small commission at no extra cost to you, which helps support the channel.</em></p>`;
  }

  const article = `<article>
    <div class="shell">

      <p class="lede">${inline(hook)}</p>

      ${bodyHtml}

    </div>
  </article>`;

  // ---- post file from template ----
  let post = fs.readFileSync(TEMPLATE, 'utf8');
  // Drop the template's inherited BlogPosting JSON-LD; regenerated fresh below to match this post.
  post = post.replace(/<script type="application\/ld\+json">[^<]*?"BlogPosting"[^<]*?<\/script>\s*/, '');
  post = post.split(T.video).join(vid);
  post = post.split(T.slug).join(slug);
  // Escape the JSON-LD "name" with real JSON escaping, then attribute-escape every remaining
  // HTML title occurrence (a double quote in the title would otherwise break attributes / the
  // JSON). &quot; also renders fine inside <title>/<h1> element text.
  post = post.replace(/"name":\s*"[^"]*"/, () => `"name": ${JSON.stringify(stripDashes(title))}`);
  post = post.split(T.title).join(escAttr(title));
  // NOTE: use replacement FUNCTIONS, not template strings. A template string in
  // the 2nd arg treats "$1" (e.g. inside a price like "$1,297") as a capture-group
  // backreference and corrupts the output.
  post = post.replace(/(<meta name="description" content=")[^"]*(">)/, (m, a, b) => a + escAttr(metaDesc) + b);
  post = post.replace(/(<meta property="og:description" content=")[^"]*(">)/, (m, a, b) => a + escAttr(metaDesc) + b);
  post = post.replace(/("description":\s*")[^"]*(")/, (m, a, b) => a + escAttr(metaDesc) + b);
  post = post.replace(/("uploadDate":\s*")[^"]*(")/, (m, a, b) => a + d.date + b);  // VideoObject uploadDate (Google requires it)
  post = post.replace(/(<span class="eyebrow">)[^<]*(<\/span>)/, (m, a, b) => a + escText(label) + ' report' + b);
  post = post.replace(/(<span class="post-date">)[^<]*(<\/span>)/, (m, a, b) => a + date + b);
  post = post.replace(/<p class="dek">[\s\S]*?<\/p>/, () => `<p class="dek">${inline(hook)}</p>`);
  post = post.replace(/<article>[\s\S]*?<\/article>/, () => article);
  // ---- fresh BlogPosting JSON-LD (article schema, helps the page index as an article) ----
  const bp = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: stripDashes(title),
    description: stripDashes(metaDesc),
    image: `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`,
    datePublished: d.date,
    dateModified: d.date,
    inLanguage: 'en',
    author: { '@type': 'Person', name: 'Justin' },
    publisher: { '@type': 'Organization', name: 'The Price of Germany', logo: { '@type': 'ImageObject', url: 'https://thepriceofgermany.com/favicon.svg' } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://thepriceofgermany.com/${slug}` },
    articleSection: stripDashes(label),
  };
  post = post.replace('<link rel="icon"', `<script type="application/ld+json">\n${JSON.stringify(bp, null, 2)}\n</script>\n<link rel="icon"`);
  fs.writeFileSync(file, post);

  // ---- homepage card at top of grid ----
  let index = fs.readFileSync(INDEX, 'utf8');
  const card = `        <a class="tag-card" data-cat="${catKey}" href="/${slug}">
          <span class="tag-hole"></span>
          <span class="tag-topic">${escText(label)}</span>
          <h3>${escText(title)}</h3>
          <p>${escText(hook)}</p>
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
      (m, a, b) => a + `\n        <button class="chip" type="button" data-filter="${catKey}">${escText(label)}</button>` + b
    );
    addedChip = true;
  }
  fs.writeFileSync(INDEX, index);
  return { slug, title, addedChip };
}

// ---------- HTTP ----------
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(FORM.replace('__HAS_KEY__', readKey() ? 'true' : 'false'));
    return;
  }
  if (req.method === 'POST' && req.url === '/save-key') {
    try {
      const { key } = JSON.parse(await readBody(req));
      if (!key || !key.trim()) throw new Error('Empty key.');
      fs.writeFileSync(KEY_FILE, key.trim(), { mode: 0o600 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }
  if (req.method === 'POST' && req.url === '/format') {
    try {
      const d = JSON.parse(await readBody(req));
      if (!d.transcript || !d.transcript.trim()) throw new Error('Paste the transcript into the Article body box first.');
      const body = await aiFormat(d);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, body }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }
  if (req.method === 'POST' && req.url === '/publish') {
    try {
      const d = JSON.parse(await readBody(req));
      const built = buildPost(d);
      const steps = [`Created site/${built.slug}.html`, `Added homepage card${built.addedChip ? ' + new category chip' : ''}`];

      const sm = await run('node', ['scripts/build-sitemap.mjs']);
      steps.push(sm.ok ? 'Regenerated sitemap' : 'Sitemap step had a warning');

      const commit = await runShell(
        `git add -A && git -c user.name="Justin" -c user.email="justin.m.espada@gmail.com" commit -m "New post: ${built.title.replace(/"/g, "'")}"`
      );
      steps.push(commit.ok ? 'Committed to git' : 'Commit skipped (nothing to commit or git error)');

      let deployed = false, deployOut = '';
      if (d.deploy) {
        const dep = await runShell('npx wrangler pages deploy site --project-name thepriceofgermany --branch main --commit-dirty=true');
        deployed = dep.ok;
        deployOut = dep.out.split('\n').filter((l) => l.includes('pages.dev') || l.includes('Success')).join(' ');
        steps.push(deployed ? 'Deployed live' : 'Deploy FAILED (run npm run deploy in Terminal)');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, slug: built.slug, url: `https://thepriceofgermany.com/${built.slug}`, steps, deployed, deployOut }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n  Post Studio running at ${url}\n  (leave this window open; press Ctrl+C to stop)\n`);
  exec(`open ${url}`);
});

// ---------- the form page ----------
const FORM = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Post Studio - The Price of Germany</title>
<style>
  :root{--cream:#FDF8F0;--paper:#FFFDF6;--ink:#23262B;--soft:#5B5F66;--coral:#FF5A5F;--coral-d:#E1454A;--teal:#14807B;--line:#E7E0D2}
  *{box-sizing:border-box}
  body{margin:0;background:var(--cream);color:var(--ink);font-family:-apple-system,'Work Sans',sans-serif;line-height:1.5}
  .wrap{max-width:760px;margin:0 auto;padding:28px 20px 80px}
  h1{font-size:1.6rem;margin:0 0 4px}
  .sub{color:var(--soft);margin:0 0 24px;font-size:14px}
  label{display:block;font-weight:600;font-size:13.5px;margin:16px 0 5px}
  .hint{font-weight:400;color:var(--soft);font-size:12px}
  input,textarea,select{width:100%;font:inherit;font-size:14px;padding:10px 12px;border:1.5px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink)}
  textarea{resize:vertical}
  .row{display:flex;gap:14px;flex-wrap:wrap}
  .row>div{flex:1;min-width:200px}
  fieldset{border:1.5px solid var(--line);border-radius:12px;margin:22px 0 0;padding:6px 16px 16px}
  legend{font-weight:700;font-size:13px;padding:0 8px;color:var(--teal)}
  .count{float:right;color:var(--soft);font-weight:400}
  .check{display:flex;align-items:center;gap:8px;margin-top:20px}
  .check input{width:auto}
  .bar{position:sticky;bottom:0;background:linear-gradient(transparent,var(--cream) 30%);padding-top:24px;margin-top:24px}
  button{font:inherit;font-weight:700;font-size:15px;background:var(--coral);color:#fff;border:0;border-radius:10px;padding:13px 26px;cursor:pointer;box-shadow:0 4px 0 var(--coral-d)}
  button:active{transform:translateY(2px);box-shadow:0 2px 0 var(--coral-d)}
  button[disabled]{opacity:.5;cursor:default;box-shadow:none}
  #result{margin-top:18px;padding:14px 16px;border-radius:10px;font-size:14px;display:none}
  #result.ok{background:#e9f7f1;border:1.5px solid #bfe6d8;display:block}
  #result.err{background:#fdecec;border:1.5px solid #f4b8b8;display:block}
  #result ul{margin:8px 0 0;padding-left:18px}
  a{color:var(--coral)}
  code{background:#00000010;padding:1px 5px;border-radius:4px;font-size:12.5px}
  .keybar{margin:14px 0 4px;padding:12px 14px;border:1.5px dashed var(--line);border-radius:10px;background:#00000005}
  .keyrow{display:flex;gap:10px;margin-top:6px}
  .keyrow input{flex:1}
  .ghost{background:transparent;color:var(--ink);border:1.5px solid var(--ink);box-shadow:none;padding:9px 16px;font-size:13.5px}
  .ghost:active{transform:none}
  .aibtn{background:var(--teal);box-shadow:0 3px 0 #0e5f5b;color:#fff;font-size:12.5px;padding:5px 12px;margin-left:8px;vertical-align:middle}
  .aibtn[disabled]{opacity:.55}
</style></head><body><div class="wrap">
  <h1>Post Studio</h1>
  <p class="sub">Fill this in, click Publish. It writes the post, adds the homepage card and category chip, regenerates the sitemap, and commits. Tick "Deploy live" to push it to the site immediately.</p>

  <div class="keybar">
    <label style="margin:0">AI key <span class="hint" id="keystatus"></span></label>
    <div class="keyrow">
      <input id="apikey" type="password" placeholder="Anthropic API key (sk-ant-...), saved locally, used for Auto-format">
      <button type="button" id="savekey" class="ghost">Save key</button>
    </div>
  </div>

  <label>Post title</label>
  <input id="title" placeholder="Is Germany Cheaper Than America? The Honest Numbers">

  <div class="row">
    <div>
      <label>URL slug <span class="hint">(auto from title; edit if needed)</span></label>
      <input id="slug" placeholder="is-germany-cheaper-than-america">
    </div>
    <div>
      <label>Publish date</label>
      <input id="date" type="date">
    </div>
  </div>

  <div class="row">
    <div>
      <label>Category <span class="hint">(reuses a chip or makes a new one)</span></label>
      <input id="category" placeholder="Cost of Living" list="cats">
      <datalist id="cats"><option>Housing</option><option>Childcare</option><option>Insurance</option><option>Relocation</option><option>Salary</option><option>Culture</option><option>Education</option><option>Cost of Living</option></datalist>
    </div>
    <div>
      <label>YouTube video <span class="hint">(ID or full URL)</span></label>
      <input id="video" placeholder="cXoLFiXZU7U">
    </div>
  </div>

  <label>Card blurb <span class="hint">shown on the homepage card, keep it to one sentence</span><span class="count" id="hookcount">0</span></label>
  <textarea id="hook" rows="2" maxlength="170" placeholder="Two new dads, two very different bills. Where Germany quietly saves you tens of thousands, and where it will make your eyes water."></textarea>

  <label>Article body
    <button type="button" id="ai" class="aibtn">✨ Auto-format from transcript</button>
    <span class="hint" id="aihint">paste the raw transcript, then Auto-format. Or write it yourself: blank line = new paragraph, <code>## </code> heading, <code>**bold**</code>, <code>[text](url)</code> link, <code>[[AFFILIATE]]</code> for the box.</span>
  </label>
  <textarea id="body" rows="16" placeholder="Paste the raw transcript here, then click Auto-format from transcript..."></textarea>

  <fieldset>
    <legend>Affiliate callout (optional)</legend>
    <div class="row">
      <div><label>Heading</label><input id="a_heading" placeholder="The book I used to learn German"></div>
      <div><label>Button text</label><input id="a_button" placeholder="See it on Amazon"></div>
    </div>
    <label>Blurb</label>
    <input id="a_blurb" placeholder="Why it fits here.">
    <label>Link URL</label>
    <input id="a_url" placeholder="https://tidd.ly/...">
  </fieldset>

  <div class="check"><input type="checkbox" id="deploy" checked><label for="deploy" style="margin:0">Deploy live to thepriceofgermany.com right after publishing</label></div>

  <div class="bar">
    <button id="go">Publish</button>
    <div id="result"></div>
  </div>
</div>
<script>
  const $ = (id) => document.getElementById(id);
  $('date').value = new Date().toISOString().slice(0,10);

  // ---- AI key + auto-format ----
  let hasKey = __HAS_KEY__;
  function refreshKeyStatus(){ $('keystatus').textContent = hasKey ? '(saved on this machine)' : '(not set - needed for Auto-format)'; }
  refreshKeyStatus();
  $('savekey').addEventListener('click', async () => {
    const key = $('apikey').value.trim();
    if (!key) return;
    const b = $('savekey'); b.disabled = true; b.textContent = 'Saving...';
    try {
      const j = await (await fetch('/save-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})})).json();
      if (j.ok){ hasKey = true; $('apikey').value=''; $('apikey').placeholder='Key saved. Paste a new one only to replace it.'; refreshKeyStatus(); }
      else alert('Could not save key: '+j.error);
    } catch(e){ alert('Error: '+e); }
    b.disabled=false; b.textContent='Save key';
  });
  $('ai').addEventListener('click', async () => {
    if (!hasKey){ alert('Add your Anthropic API key first (the AI key field at the top), then Save.'); return; }
    const transcript = $('body').value.trim();
    if (!transcript){ alert('Paste the raw transcript into the Article body box first.'); return; }
    const btn = $('ai'); btn.disabled = true; btn.textContent = 'Formatting...';
    $('aihint').textContent = 'Formatting with Claude, this takes a few seconds...';
    try {
      const payload = { title:$('title').value, transcript, affiliate:{ heading:$('a_heading').value, url:$('a_url').value } };
      const j = await (await fetch('/format',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})).json();
      if (j.ok){ $('body').value = j.body; $('aihint').textContent = 'Formatted. Review and edit the body below, then Publish.'; }
      else { $('aihint').textContent = ''; alert('Auto-format failed: '+j.error); }
    } catch(e){ $('aihint').textContent=''; alert('Error: '+e); }
    btn.disabled=false; btn.textContent='✨ Auto-format from transcript';
  });

  $('title').addEventListener('input', () => {
    if (!$('slug').dataset.touched) $('slug').value = $('title').value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  });
  $('slug').addEventListener('input', () => $('slug').dataset.touched = '1');
  $('hook').addEventListener('input', () => $('hookcount').textContent = $('hook').value.length);
  $('go').addEventListener('click', async () => {
    const btn = $('go'), r = $('result');
    const data = {
      title:$('title').value, slug:$('slug').value, category:$('category').value,
      date:$('date').value, video:$('video').value, hook:$('hook').value, body:$('body').value,
      deploy:$('deploy').checked,
      affiliate:{ heading:$('a_heading').value, button:$('a_button').value, blurb:$('a_blurb').value, url:$('a_url').value }
    };
    btn.disabled = true; btn.textContent = data.deploy ? 'Publishing + deploying...' : 'Publishing...';
    r.className=''; r.style.display='none';
    try{
      const res = await fetch('/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const j = await res.json();
      if(j.ok){
        r.className='ok';
        r.innerHTML = '<strong>Published'+(j.deployed?' and deployed':'')+'.</strong><ul>'+j.steps.map(s=>'<li>'+s+'</li>').join('')+'</ul>'+
          (j.deployed?'<p>Live at <a href="'+j.url+'" target="_blank">'+j.url+'</a> (allow a minute).</p>':'<p>Preview locally with <code>npm run preview</code>. Then deploy with <code>npm run deploy</code>.</p>')+
          '<p>Last step: open <strong>GitHub Desktop</strong> and click <strong>Push origin</strong> to back it up.</p>';
      } else { r.className='err'; r.innerHTML='<strong>Could not publish:</strong> '+j.error; }
    }catch(e){ r.className='err'; r.textContent='Error: '+e; }
    btn.disabled=false; btn.textContent='Publish';
  });
</script>
</body></html>`;
