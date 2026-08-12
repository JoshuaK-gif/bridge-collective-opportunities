SELECT 'openai_config (site_settings)' as source, key, value FROM site_settings WHERE key = 'openai_config';
SELECT 'scraper_ai_config (all rows)' as source, * FROM scraper_ai_config;
