-- Remove stored AI provider configuration.
-- All AI features (LLM rewrite/enrichment, CV feedback, grant writing, ATS scan,
-- URL extraction, AI image generation) have been removed from the platform.
DELETE FROM site_settings WHERE key IN ('openai_config', 'scraper_ai_config');
