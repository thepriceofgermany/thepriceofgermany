# The Price of Germany — Website Handoff

Project: companion blog website for the YouTube channel **The Price of Germany**
Domain: **thepriceofgermany.com** (registered via Cloudflare Registrar, live)
Hosting: **Cloudflare Pages**, free tier, static site (no build step, no framework)
Owner: Justin (host of the channel, American expat, 12+ years in Germany)

---

## 1. Current deployment status

- Domain is registered and DNS is pointed at Cloudflare Pages (confirmed live at `https://thepriceofgermany.com/`).
- Deployment method so far has been **manual**: download files from chat, drop into a local folder, drag-and-drop upload via the Cloudflare Pages dashboard ("Upload your static files").
- **This is the task to hand to Claude Code**: set up a proper local project folder, get all files organized correctly, and ideally move to a repeatable deploy method (e.g. `wrangler pages deploy`, or connecting the Cloudflare Pages project to a GitHub repo for git-based deploys) instead of manual re-uploads every time a post is added.

## 2. Required file structure

All files are flat HTML/CSS/JS (no build tools, no npm dependencies). The site expects this structure at the root of what gets uploaded to Cloudflare Pages:

```
site/
├── index.html                          (this is homepage.html, renamed)
├── renting-in-germany-vs-usa.html
├── insurance-in-germany-vs-usa.html
├── moving-to-germany-cost.html
├── daycare-in-germany-vs-usa.html
├── emotional-tax-germany.html
├── salary-in-germany-vs-usa.html
└── assets/
    └── justin.png                      (host character illustration)
```

**Important naming note:** the homepage file has been generated in this chat under the name `homepage.html` each time — it must be renamed to `index.html` before upload, every time it's updated. This is a manual step that's been done by hand so far and is a good candidate for Claude Code to automate (e.g. a deploy script that copies/renames automatically).

There is also an old `index.html` from early in the project (a "coming soon" placeholder page) — this has been fully superseded by the real homepage and should not be used. Just confirm the current homepage.html → index.html is the one being deployed.

## 3. Design system (for building future posts/pages consistently)

All pages share this token system, defined as CSS custom properties at the top of each file's `<style>` block:

```css
--cream: #FDF8F0;      /* page background */
--paper: #FFFDF6;      /* card/box background */
--ink: #23262B;        /* primary text */
--ink-soft: #5B5F66;   /* secondary text */
--coral: #FF5A5F;      /* primary accent (CTAs, links) */
--coral-dark: #E1454A; /* accent hover/shadow */
--teal: #1FA6A0;       /* secondary accent (eyebrows, USA/Germany labels) */
--teal-dark: #14807B;
--yellow: #FFC857;     /* highlight accent (headline underline) */
--line: #E7E0D2;       /* borders, dashed dividers */
```

**Fonts** (loaded via Google Fonts CDN in every page's `<head>`):
- **Fredoka** (500/600/700) — all headlines, display text
- **Space Mono** (400/700) — data/numbers, labels, receipt-style detail, eyebrows
- **Work Sans** (400–700) — body text

**Signature visual motifs, reused across the site:**
- "Price tag" cards with a punch-hole circle (`.tag-hole`) for report/post preview cards on the homepage
- "Receipt" style boxes with dashed dividers and monospace numbers for cost breakdowns/comparisons within posts (`.compare`, `.payslip`, `.state-box` — naming varies slightly per post, same visual pattern)
- Recommendation/affiliate callout boxes styled like the price-tag cards (`.rec-card`) with a "Recommended" or "Sponsored" label
- Numbered action-item lists at the end of most posts (`.action-list`)
- Justin's cartoon character illustration (`assets/justin.png`) appears in the hero (floating, below the headline/subhead) and in the About section avatar circle, with a subtle CSS bob animation (respects `prefers-reduced-motion`)

**Hard content rule:** no em dashes (—) or en dashes (–) anywhere in body text, titles, or meta tags on this site. Use commas, colons, or periods instead. This applies to all future posts too.

## 4. Posts published so far (6 total)

Each post follows the same template: hero with embedded YouTube video (16:9 responsive iframe), article body adapted from the video's actual narration/transcript (not fabricated), comparison/data boxes, one or more affiliate callouts placed where they occur contextually in the source video, a disclosure line, footer.

| File | Video | Topic tag | Affiliate link(s) |
|---|---|---|---|
| `renting-in-germany-vs-usa.html` | Renting in Germany vs. USA | Housing | Schufa report service (meineschufa.de), DKB Bank (tidd.ly/4yKrvCk) |
| `insurance-in-germany-vs-usa.html` | This Cheap German Insurance Could Save You From Bankruptcy | Insurance | AXA (tidd.ly/4bBrJ4X) |
| `moving-to-germany-cost.html` | What Moving to Germany Actually Costs | Relocation | NordVPN sponsor (tidd.ly/44QCFI2), DKB Bank (tidd.ly/4yKrvCk) |
| `daycare-in-germany-vs-usa.html` | "Free" Daycare in Germany? | Childcare | AXA (tidd.ly/4bBrJ4X) |
| `emotional-tax-germany.html` | The Emotional Tax of Living in Germany | Culture | Gratitude journal (link.amazon/B033dK56l) |
| `salary-in-germany-vs-usa.html` | The German Salary Trap | Salary | Taxfix (taxfix.de) |

All six are linked from report cards on the homepage (`#reports` section). No placeholder cards remain.

## 5. SEO basics already baked in per post

- `<title>` and `<meta name="description">` tuned per post
- Open Graph tags (`og:title`, `og:description`, `og:type`)
- `VideoObject` JSON-LD schema block per post (name, description, thumbnailUrl pointing at the YouTube thumbnail, embedUrl)

**Not yet done, good next tasks for Claude Code:**
- `sitemap.xml` covering all pages
- `robots.txt`
- Submitting the sitemap to Google Search Console
- A real favicon (currently none set)

## 6. Outstanding / good next tasks for Claude Code

1. **Automate the deploy.** Either wire up Wrangler CLI (`wrangler pages deploy site/`) for one-command deploys, or connect the existing Cloudflare Pages project to a GitHub repo so pushes auto-deploy. This removes the manual rename-and-drag-and-drop step.
2. **Set up a proper local project folder** matching the structure in section 2, with the files currently sitting in this chat's outputs.
3. Add `sitemap.xml` and `robots.txt`.
4. Add a favicon.
5. Consider extracting the shared CSS (currently duplicated at the top of every HTML file) into a single `styles.css` referenced by all pages, to make future design tweaks (like the "no em dash" content rule, or a palette tweak) a one-file change instead of six.
6. As new videos get turned into posts going forward, each new post needs a matching card added to the `#reports` grid on `index.html`.

## 7. Content/style rules to preserve going forward

- Every post must be built from the video's **actual narration/transcript**, never invented. If a transcript doesn't match the described video, flag it rather than guessing.
- No em dashes or en dashes anywhere in site content.
- Affiliate/sponsor links go in their own visually distinct callout box, placed at the point in the article where they're contextually relevant (not just dumped at the end), and every post ends with a disclosure line.
- Match the existing design tokens and fonts exactly for any new page, don't introduce new colors/fonts without deliberate reason.
