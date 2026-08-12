-- NOTE: set your Gemini API key in server/.env (GEMINI_API_KEY) before enabling scraper AI.
UPDATE site_settings SET value = '{"model": "gemini-2.0-flash", "api_key": "", "provider": "gemini", "enabled": true, "image_model": "imagen-3.0-generate-001"}'
WHERE key = 'scraper_ai_config';

UPDATE site_settings SET value = '{"model": "deepseek-v4-flash-free", "api_key": "", "provider": "opencodezen", "enabled": true}'
WHERE key = 'openai_config';

SELECT key, value FROM site_settings WHERE key IN ('openai_config', 'scraper_ai_config');
