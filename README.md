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

1. Add `site/<slug>.html` (copy an existing post as a template, keep the design tokens and fonts).
2. Add a matching report card in the `#reports` grid of `site/index.html`. Link to the clean URL (`/<slug>`, no `.html`), give it a `data-cat="<category>"` (so the filter picks it up), and in the `.tag-compare` row put the publish/creation date (format `Mon D, YYYY`, e.g. `Aug 1, 2026`) in place of the old "USA vs. Germany" label.
3. Keep the grid ordered newest first (newest card at the top of the grid).
4. Deploy: `npm run deploy` (this regenerates the sitemap automatically).
5. Optionally commit + push to GitHub for version history (GitHub Desktop, since terminal auth isn't set up).

## Content / style rules

- Built from the video's **actual narration/transcript**, never invented.
- **No em dashes or en dashes** anywhere in site content. Use commas, colons, or periods.
- Affiliate/sponsor links go in their own callout box at the contextually relevant point, and every post ends with a disclosure line.
- Match the existing design tokens (`--cream`, `--coral`, `--teal`, etc.) and fonts (Fredoka, Space Mono, Work Sans). Do not introduce new colors/fonts without a deliberate reason.
