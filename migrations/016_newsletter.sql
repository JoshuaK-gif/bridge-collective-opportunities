ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ DEFAULT NULL;

INSERT INTO site_settings (key, value, updated_at) VALUES ('smtp_config', '{}', now()) ON CONFLICT (key) DO NOTHING;
