-- Scraping pipeline improvements: deadline, category, status machine, dedup, daily_stats, feed_health

-- scraped_posts: add date-type deadline, review_reason, new statuses, dedup hash
ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS deadline_date DATE;
ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS review_reason TEXT DEFAULT '';
ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS dedup_hash TEXT DEFAULT '';
ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS feed_url TEXT DEFAULT '';
ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS classification_method TEXT DEFAULT '';  -- 'keyword' or 'llm'
ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS classification_confidence REAL DEFAULT 0;

-- opportunities: add date-type deadline, manually_edited flag, new statuses
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS deadline_date DATE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS manually_edited BOOLEAN DEFAULT false;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS review_reason TEXT DEFAULT '';

-- daily_stats table for image generation quotas
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stat_key TEXT NOT NULL,
  stat_value INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stat_date, stat_key)
);

-- feed_health table for tracking feed reliability
CREATE TABLE IF NOT EXISTS feed_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_url TEXT NOT NULL,
  last_successful_run TIMESTAMPTZ,
  consecutive_empty_runs INTEGER DEFAULT 0,
  last_error TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feed_url)
);

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_scraped_posts_dedup_hash ON scraped_posts(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_scraped_posts_feed_url ON scraped_posts(feed_url);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline_date ON opportunities(deadline_date);
CREATE INDEX IF NOT EXISTS idx_opportunities_manually_edited ON opportunities(manually_edited) WHERE manually_edited = true;
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date, stat_key);
