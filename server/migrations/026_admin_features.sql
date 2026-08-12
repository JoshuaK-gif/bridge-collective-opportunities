ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS template_name TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  deadline TEXT DEFAULT '',
  link TEXT DEFAULT '',
  structured_data JSONB DEFAULT '{}',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

UPDATE site_settings SET value = jsonb_set(COALESCE(value::jsonb, '{}'), '{source_feeds}', COALESCE(value::jsonb->'source_feeds', '["https://opportunitiesforyouth.org/feed/"]'::jsonb)) WHERE key = 'scraper_config';
