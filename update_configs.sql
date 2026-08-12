-- NOTE: set your Gemini API key in server/.env (GEMINI_API_KEY) and use revert_ai.mjs to apply it.
UPDATE site_settings SET value = '{"model": "gemini-2.0-flash", "api_key": "", "provider": "gemini", "enabled": true}'
WHERE key = 'openai_config';

SELECT key, value FROM site_settings WHERE key IN ('openai_config', 'scraper_ai_config');
