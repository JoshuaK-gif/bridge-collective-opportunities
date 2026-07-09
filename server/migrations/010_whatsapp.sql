ALTER TABLE scraped_posts ADD COLUMN IF NOT EXISTS posted_to_whatsapp BOOLEAN DEFAULT false;

UPDATE site_settings SET value = jsonb_set(value, '{whatsapp}', '{"enabled":false,"access_token":"","phone_number_id":"","target_phone":"","group_id":""}'::jsonb, true)
WHERE key = 'social_accounts';
