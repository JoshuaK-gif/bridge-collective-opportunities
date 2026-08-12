-- PHASE 4 + 6: Unified status state machine, dedup cross-table, feed health improvements

-- =============================================
-- Opportunities: add dedup_hash for cross-table
-- fuzzy dedup (Phase 5), and feed_url for
-- tracking which feed an opportunity came from
-- =============================================
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS dedup_hash TEXT DEFAULT '';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS feed_url TEXT DEFAULT '';

-- =============================================
-- Feed health: add last_error text column
-- (Phase 6 — feed health tracking)
-- =============================================
ALTER TABLE feed_health ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT '';

-- =============================================
-- Indexes for status-based queries (critical
-- for the status state machine performance)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_scraped_posts_status ON scraped_posts(status);
CREATE INDEX IF NOT EXISTS idx_scraped_posts_review_reason ON scraped_posts(review_reason);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_dedup_hash ON opportunities(dedup_hash);
