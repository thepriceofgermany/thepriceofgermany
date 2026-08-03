# The Price of Germany

Companion static site for the YouTube channel **The Price of Germany**.
Live at **https://thepriceofgermany.com** (Cloudflare Pages).

No build step, no framework. Plain HTML/CSS/JS. The deployable site lives in `site/`.

## Structure

```
thepriceofgermany/
├── site/                         <- Cloudflare Pages "build output directory"
│   ├── index.html                (homepage)
│   ├── renting-in-germany-vs-usa.html
│   ├── insurance-in-germany-vs-usa.html
│   ├── moving-to-germany-cost.html
│   ├── daycare-in-germany-vs-usa.html
│   ├── emotional-tax-germany.html
│   ├── salary-in-germany-vs-usa.html
│   ├── favicon.svg
│   ├── robots.txt
│   ├── sitemap.xml               (generated, do not hand-edit)
│   └── assets/justin.png
├── scripts/build-sitemap.mjs
├── package.json
├── HANDOFF.md                    (original project handoff notes)
└── README.md
```

There is no more `homepage.html` rename step: the homepage is already `site/index.html`.

## Local preview

```bash
npm run preview
```

Serves `site/` at http://localhost:3000 via `npx serve`.

## Deploy (Wrangler CLI)

Deploys go straight to the Cloudflare Pages project `thepriceofgermany` with one command:

```bash
npm run deploy
```

That regenerates the sitemap and runs `wrangler pages deploy site`. First time on a new
machine you need `npx wrangler login` once (browser login). The GitHub repo
(`github.com/thepriceofgermany/thepriceofgermany`) is kept as version history/backup;
pushing to it does NOT auto-deploy, `npm run deploy` is what publishes.

Cloudflare serves clean URLs: `/renting-in-germany-vs-usa.html` redirects to
`/renting-in-germany-vs-usa`. Canonical tags, the sitemap, and internal links all use the
extensionless form.

## Adding a new post

### Easiest way: Post Studio (a GUI)

Double-click **`Post Studio.command`** in the project folder (or run `npm run studio`). A form opens in your browser where you fill in the title, category, date, YouTube video, a one-line card blurb, and paste the article body. Click **Publish** and it:
- writes `site/<slug>.html` from the template,
- adds the homepage card at the top of the grid + a new category chip if needed,
- regenerates the sitemap and commits,
- and, if the "Deploy live" box is ticked, deploys to the site.

Then open GitHub Desktop and click **Push origin** to back it up.

Body formatting in the paste box: a blank line starts a new paragraph, `## ` at the start of a line makes a section heading, `**bold**`, `[text](url)` for links, and `[[AFFILIATE]]` on its own line drops in the affiliate box (filled from the Affiliate fields). Em dashes are stripped automatically.

**Auto-format from transcript (AI):** paste the raw video transcript into the Article body box and click **✨ Auto-format from transcript**. It sends the transcript to Claude (`claude-opus-5`), which adds section headings, bolds the key numbers, and places the affiliate box, then fills the box with the result for you to review before Publish. One-time setup: paste your Anthropic API key into the **AI key** field at the top and click **Save key** (stored in `.studio-key`, which is gitignored; never committed). Costs about a cent per post. The plain paste-formatting above still works without a key.

### Command-line scaffolder

```bash
npm run new-post
```

It asks for the slug, title, category, publish date, YouTube video, and a short hook, then:
- creates `site/<slug>.html` from the post template (all styling/SEO/footer included),
- adds the report card at the **top** of the homepage grid (newest first), with the right `data-cat` and date,
- adds a new filter chip automatically **if the category is new**.

Then you just:
1. Edit `site/<slug>.html` and fill the article body from the video's transcript (no em dashes; affiliate box + disclosure where relevant).
2. `npm run deploy`
3. Push to GitHub (GitHub Desktop) to back it up.

### Manual way (if you prefer)

1. Add `site/<slug>.html` (copy an existing post as a template, keep the design tokens and fonts).
2. Add a matching report card in the `#reports` grid of `site/index.html`. Link to the clean URL (`/<slug>`, no `.html`), give it a `data-cat="<category>"`, and put the publish date (format `Mon D, YYYY`) in the `.tag-compare` row.
3. If the category is new, also add a `<button class="chip" data-filter="<category>">Label</button>` to `.filter-bar`.
4. Keep the grid ordered newest first (newest card at the top).
5. `npm run deploy`, then push to GitHub.

**Categories** live as a lowercase key in three matching places: the card's `data-cat`, the filter chip's `data-filter`, and (as a label) the post header eyebrow. Reuse an existing key (housing, childcare, insurance, relocation, salary, culture) or invent a new one, the scaffolder wires up the chip for new keys.

## Content / style rules

- Built from the video's **actual narration/transcript**, never invented.
- **No em dashes or en dashes** anywhere in site content. Use commas, colons, or periods.
- Affiliate/sponsor links go in their own callout box at the contextually relevant point, and every post ends with a disclosure line.
- Match the existing design tokens (`--cream`, `--coral`, `--teal`, etc.) and fonts (Fredoka, Space Mono, Work Sans). Do not introduce new colors/fonts without a deliberate reason.
