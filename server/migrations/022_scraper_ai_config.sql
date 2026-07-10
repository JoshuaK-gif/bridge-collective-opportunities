INSERT INTO site_settings (key, value, updated_at) VALUES ('scraper_ai_config', '{"api_key":"","model":"gpt-4o-mini","enabled":false}', now()) ON CONFLICT (key) DO NOTHING;
