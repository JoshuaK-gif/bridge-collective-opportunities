CREATE INDEX IF NOT EXISTS idx_opportunities_status_category ON opportunities(status, category);
CREATE INDEX IF NOT EXISTS idx_opportunities_status_created ON opportunities(status, created_date DESC);
