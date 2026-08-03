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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const TEMPLATE = path.join(SITE, 'salary-in-germany-vs-usa.html');
const INDEX = path.join(SITE, 'index.html');
const PORT = 4477;

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
  post = post.split(T.video).join(vid);
  post = post.split(T.slug).join(slug);
  post = post.split(T.title).join(escText(title));
  post = post.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${escAttr(metaDesc)}$2`);
  post = post.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${escAttr(metaDesc)}$2`);
  post = post.replace(/("description":\s*")[^"]*(")/, `$1${escAttr(metaDesc)}$2`);
  post = post.replace(/(<span class="eyebrow">)[^<]*(<\/span>)/, `$1${escText(label)} report$2`);
  post = post.replace(/(<span class="post-date">)[^<]*(<\/span>)/, `$1${date}$2`);
  post = post.replace(/<p class="dek">[\s\S]*?<\/p>/, `<p class="dek">${inline(hook)}</p>`);
  post = post.replace(/<article>[\s\S]*?<\/article>/, article);
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
  index = index.replace(/(<div class="grid">\n)/, `$1\n${card}\n`);

  let addedChip = false;
  if (!new RegExp(`data-filter="${catKey}"`).test(index)) {
    index = index.replace(
      /(<div class="filter-bar"[\s\S]*?)(\n\s*<\/div>\s*\n\s*<div class="grid">)/,
      `$1\n        <button class="chip" type="button" data-filter="${catKey}">${escText(label)}</button>$2`
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
    res.end(FORM);
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
</style></head><body><div class="wrap">
  <h1>Post Studio</h1>
  <p class="sub">Fill this in, click Publish. It writes the post, adds the homepage card and category chip, regenerates the sitemap, and commits. Tick "Deploy live" to push it to the site immediately.</p>

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

  <label>Article body <span class="hint">paste the transcript. Blank line = new paragraph. Start a line with <code>## </code> for a section heading, <code>**bold**</code> for bold, <code>[text](url)</code> for a link, and <code>[[AFFILIATE]]</code> on its own line to place the box below.</span></label>
  <textarea id="body" rows="16" placeholder="Mike is standing in a hospital parking lot in Ohio...

## The myth vs. the reality

The popular assumption is simple..."></textarea>

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
