-- Adds bot-detection signals to the clicks table.
-- Apply with:
--   wrangler d1 execute thepriceofgermany-affiliate --remote --file=./migrations/0001_bot_signals.sql
--
-- is_bot is computed at insert time in functions/go/[id].js. A click is treated
-- as a bot when it has no same-site referer (the /go buttons are only reachable
-- by a real click on one of our own pages), when the user-agent matches a known
-- crawler, or when Cloudflare's bot score (paid plans) is low.

ALTER TABLE clicks ADD COLUMN user_agent TEXT;
ALTER TABLE clicks ADD COLUMN bot_score INTEGER;
ALTER TABLE clicks ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clicks_isbot ON clicks(is_bot);

-- Backfill existing rows: anything with no referer was not a real on-page click.
UPDATE clicks SET is_bot = 1 WHERE referer IS NULL;
