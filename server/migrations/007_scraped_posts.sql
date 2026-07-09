CREATE TABLE IF NOT EXISTS scraped_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_category TEXT DEFAULT '',
  rewritten_title TEXT DEFAULT '',
  rewritten_description TEXT DEFAULT '',
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  posted_to_website BOOLEAN DEFAULT false,
  posted_to_twitter BOOLEAN DEFAULT false,
  posted_to_linkedin BOOLEAN DEFAULT false,
  posted_to_facebook BOOLEAN DEFAULT false,
  posted_to_instagram BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_date TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auto_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT true,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);
