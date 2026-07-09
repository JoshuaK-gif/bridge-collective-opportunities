ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS posted_to_instagram BOOLEAN DEFAULT false;

UPDATE site_settings SET value = jsonb_set(value, '{instagram}', '{"enabled":false,"access_token":"","instagram_id":"","default_image_url":""}'::jsonb, true)
WHERE key = 'social_accounts';
