# Affiliate link tracking & analytics

One registry, tracked redirects, and a private dashboard — all on Cloudflare Pages.

## How it works

```
scripts/affiliate-links.json   ← YOU edit this (the only place raw merchant URLs live)
        │  npm run affiliate
        ▼
 ├─ site/*.html                 .rec-btn hrefs rewritten to /go/<id>?p=<page-slug>
 ├─ functions/lib/links.json    id → real URL  (imported by the redirect Function)
 ├─ functions/lib/revenue.json  id → € revenue (you fill in; stays private)
 └─ site/affiliate-inventory.json  which pages use which link (for the dashboard)

Visitor clicks  →  /go/dkb?p=renting-in-germany-vs-usa
                    functions/go/[id].js   logs click to D1, then 302 → real URL
Dashboard       →  /analytics  → functions/api/stats.js (token-gated) → D1 + revenue
```

- **Clicks** are tracked automatically and completely (first-party, in your D1 database).
- **Revenue** is manual: most partners (ElevenLabs, MyExpatTaxes, Feather, Adria, Taxfix)
  have no API, so you type cumulative figures into `functions/lib/revenue.json` and redeploy.
  Awin (DKB, AXA, NordVPN, Grand Classic Ballet) and Amazon do have reports/APIs if you
  later want to automate those.

## Day-to-day

**Add or change an affiliate link:** edit `scripts/affiliate-links.json`, then:

```bash
npm run affiliate
```

That rewrites the matching `.rec-btn` links across the site and reports any **orphan**
sponsored links (a `rel="sponsored"` href not in the registry) so nothing goes untracked.
`npm run deploy` runs it automatically.

**Author new content:** point affiliate buttons at either the real URL (the build will
rewrite it on the next `npm run affiliate`) or directly at `/go/<id>?p=<page-slug>`.

**Update revenue:** edit the numbers in `functions/lib/revenue.json`, then `npm run deploy`.

**View the dashboard:** open `https://thepriceofgermany.com/analytics` and enter the token.

## One-time backend setup

The site still deploys and redirects fine without this — clicks just aren't logged until
it's done. From the repo root:

```bash
# 1. Create the D1 database
wrangler d1 create thepriceofgermany-affiliate

# 2. In the Cloudflare dashboard → Pages → thepriceofgermany → Settings → Functions →
#    D1 database bindings: add binding  Variable name = DB,  Database = thepriceofgermany-affiliate
#    (or add it to wrangler.toml)

# 3. Create the table
wrangler d1 execute thepriceofgermany-affiliate --remote --file=./schema.sql

# 4. Set the dashboard access token (choose any strong string)
wrangler pages secret put ANALYTICS_TOKEN

# 5. Deploy
npm run deploy
```

### Recommended extra: lock down /analytics with Cloudflare Access

The token keeps the data private, but for defence in depth add a **Cloudflare Access**
policy on the path `/analytics` and `/api/stats` restricted to your own email. Free on the
Cloudflare Zero Trust plan.

## Files

| File | Purpose | Edit by hand? |
|---|---|---|
| `scripts/affiliate-links.json` | Link registry (source of truth) | ✅ yes |
| `functions/lib/revenue.json` | Cumulative revenue per link | ✅ yes |
| `scripts/build-affiliate-links.mjs` | Rewrite + audit + codegen | rarely |
| `functions/go/[id].js` | Click logger + redirect | no |
| `functions/api/stats.js` | Token-gated stats JSON | no |
| `functions/lib/links.json` | Generated id → URL map | no (generated) |
| `site/affiliate-inventory.json` | Generated page coverage | no (generated) |
| `site/analytics.html` | Dashboard UI | styling only |
| `schema.sql` | D1 table definition | no |

## Notes on `?p=` attribution

Each link carries its page slug (`/go/dkb?p=renting-in-germany-vs-usa`), so per-page
numbers don't depend on the `Referer` header. If `?p=` is ever stripped, the Function
falls back to the referrer's slug.
