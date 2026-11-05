// Cloudflare Pages Function: /api/stats
// Returns affiliate click aggregates from D1 as JSON, for the /analytics page.
// Token-gated: requires `Authorization: Bearer <ANALYTICS_TOKEN>` or `?token=<...>`.
// Set the token once:  wrangler pages secret put ANALYTICS_TOKEN
//
// Merchant/category labels are NOT returned here — the page merges these numbers
// with /affiliate-inventory.json (public, derivable from page HTML anyway). Only
// the click counts and revenue, which are your private data, live behind this token.
import revenue from '../lib/revenue.json';

export async function onRequestGet(context) {
  const { request, env } = context;

  const expected = env.ANALYTICS_TOKEN;
  if (!expected) {
    return json({ error: 'not_configured', message: 'Set ANALYTICS_TOKEN: wrangler pages secret put ANALYTICS_TOKEN' }, 503);
  }
  const url = new URL(request.url);
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '') || url.searchParams.get('token') || '';
  if (!safeEqual(token, expected)) {
    return json({ error: 'unauthorized' }, 401);
  }

  if (!env.DB) {
    return json({ error: 'no_database', message: 'Create and bind a D1 database as DB (see schema.sql).' }, 503);
  }

  // Optional rolling window, e.g. /api/stats?days=30. Default: all time.
  const days = Math.max(0, Math.min(3650, parseInt(url.searchParams.get('days') || '0', 10) || 0));
  const since = days ? `datetime('now', '-${days} days')` : null;
  const where = since ? `WHERE ts >= ${since}` : '';

  try {
    const [byLink, byLinkPage, byDay, byCountry, totals] = await Promise.all([
      env.DB.prepare(`SELECT link_id, COUNT(*) AS clicks, MAX(ts) AS last_click FROM clicks ${where} GROUP BY link_id`).all(),
      env.DB.prepare(`SELECT link_id, COALESCE(page,'(unknown)') AS page, COUNT(*) AS clicks FROM clicks ${where} GROUP BY link_id, page`).all(),
      env.DB.prepare(`SELECT substr(ts,1,10) AS day, COUNT(*) AS clicks FROM clicks ${where} GROUP BY day ORDER BY day`).all(),
      env.DB.prepare(`SELECT COALESCE(country,'??') AS country, COUNT(*) AS clicks FROM clicks ${where} GROUP BY country ORDER BY clicks DESC LIMIT 25`).all(),
      env.DB.prepare(`SELECT COUNT(*) AS clicks, MIN(ts) AS first_click, MAX(ts) AS last_click FROM clicks ${where}`).first(),
    ]);

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      windowDays: days || null,
      totals: totals || { clicks: 0, first_click: null, last_click: null },
      byLink: byLink.results || [],
      byLinkPage: byLinkPage.results || [],
      byDay: byDay.results || [],
      byCountry: byCountry.results || [],
      currency: revenue.currency || 'EUR',
      revenue: revenue.revenue || {},
    }, 200, { 'cache-control': 'no-store' });
  } catch (e) {
    return json({ error: 'query_failed', message: String(e && e.message || e) }, 500);
  }
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
