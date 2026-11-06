-- D1 schema for affiliate click tracking (The Price of Germany).
-- Apply with:
--   wrangler d1 create thepriceofgermany-affiliate
--   wrangler d1 execute thepriceofgermany-affiliate --remote --file=./schema.sql
-- Then bind the database as `DB` on the Pages project.

CREATE TABLE IF NOT EXISTS clicks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id    TEXT    NOT NULL,          -- registry id, e.g. "dkb", "elevenlabs"
  page       TEXT,                      -- page slug the click came from, e.g. "renting-in-germany-vs-usa"
  country    TEXT,                      -- cf-ipcountry, e.g. "DE"
  referer    TEXT,                      -- full referring URL (nullable)
  user_agent TEXT,                      -- request user-agent (for bot detection)
  bot_score  INTEGER,                   -- Cloudflare bot score 1-99 (paid Bot Management; nullable)
  is_bot     INTEGER NOT NULL DEFAULT 0,-- 1 = classified as bot at insert time
  ts         TEXT    NOT NULL DEFAULT (datetime('now'))  -- UTC ISO-ish timestamp
);

CREATE INDEX IF NOT EXISTS idx_clicks_link    ON clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_ts      ON clicks(ts);
CREATE INDEX IF NOT EXISTS idx_clicks_linkday ON clicks(link_id, ts);
CREATE INDEX IF NOT EXISTS idx_clicks_isbot   ON clicks(is_bot);
