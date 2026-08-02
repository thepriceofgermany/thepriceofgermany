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

## Deploy (GitHub git-based)

This repo is connected to the Cloudflare Pages project, so **every push to `main` auto-deploys**.

```bash
git add -A
git commit -m "Add new post"
git push
```

Cloudflare Pages settings (set once in the dashboard):
- Framework preset: **None**
- Build command: **(leave empty)**
- Build output directory: **`site`**

## Adding a new post

1. Add `site/<slug>.html` (copy an existing post as a template, keep the design tokens and fonts).
2. Add a matching report card in the `#reports` grid of `site/index.html`.
3. Regenerate the sitemap: `npm run sitemap`
4. Commit and push.

## Content / style rules

- Built from the video's **actual narration/transcript**, never invented.
- **No em dashes or en dashes** anywhere in site content. Use commas, colons, or periods.
- Affiliate/sponsor links go in their own callout box at the contextually relevant point, and every post ends with a disclosure line.
- Match the existing design tokens (`--cream`, `--coral`, `--teal`, etc.) and fonts (Fredoka, Space Mono, Work Sans). Do not introduce new colors/fonts without a deliberate reason.
