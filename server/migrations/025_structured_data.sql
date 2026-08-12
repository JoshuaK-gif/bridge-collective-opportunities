ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT '{}';
ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS whatsapp_url TEXT DEFAULT '';
ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS posted_to_whatsapp BOOLEAN DEFAULT false;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT '{}';
