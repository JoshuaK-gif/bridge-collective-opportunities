-- ============================================================
-- Bridge Jobs - Supabase Database Schema
-- Generated from all migration files (001-013)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- OPPORTUNITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  link TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  image_public_id TEXT DEFAULT '',
  image_crop JSONB DEFAULT NULL,
  image_size TEXT DEFAULT 'medium',
  category TEXT DEFAULT '',
  deadline TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  trending BOOLEAN DEFAULT false,
  featured_order INT DEFAULT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_image_public_id ON opportunities(image_public_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_featured ON opportunities (featured_order NULLS LAST) WHERE featured_order IS NOT NULL;

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SITE SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SUBSCRIBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  source_page TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  country TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SCRAPED POSTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS scraped_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_category TEXT DEFAULT '',
  rewritten_title TEXT DEFAULT '',
  rewritten_description TEXT DEFAULT '',
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  posted_to_website BOOLEAN DEFAULT false,
  posted_to_twitter BOOLEAN DEFAULT false,
  posted_to_linkedin BOOLEAN DEFAULT false,
  posted_to_facebook BOOLEAN DEFAULT false,
  posted_to_instagram BOOLEAN DEFAULT false,
  posted_to_whatsapp BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_date TIMESTAMPTZ
);

-- ============================================================
-- AUTO PUBLISH LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS auto_publish_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT true,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Briefcase',
  color TEXT DEFAULT 'text-blue-600 bg-blue-100',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MIGRATIONS TRACKING TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default site settings
INSERT INTO site_settings (key, value) VALUES
  ('stats', '{"monthly_visitors":"100K+","social_followers":"50K+","newsletter_subs":"20K+","opportunities_listed":"500+"}'),
  ('packages', '[{"name":"Starter Package","price":"$450","period":"/ Month","color":"from-green-500 to-emerald-600","features":["Website post on Bridge Opportunities platform","Standard visibility","1-2 social media promotions"]},{"name":"Growth Package","price":"$700","period":"/ Month","color":"from-blue-500 to-indigo-600","popular":true,"features":["Website post + homepage feature","2-3 social media promotions per week","Newsletter inclusion"]},{"name":"Impact Package","price":"$2,500","period":" / campaign","color":"from-purple-500 to-violet-600","features":["Priority website placement","Multi-week campaign promotion","Intensive social media coverage","Newsletter feature","LinkedIn or YouTube Live session"]},{"name":"Annual Partnership","price":"$5,000","period":" / Year","color":"from-amber-500 to-orange-600","features":["Ongoing promotion throughout the year","Multiple campaigns","Priority support and placement","Continuous brand visibility"]}]'),
  ('scraper_config', '{"source_url":"https://opportunitiesforyouth.org/feed/","enabled":false,"interval_minutes":60,"auto_post":false,"auto_social":false,"generate_images":true,"category_map":{"Scholarships":"Scholarship","Grants":"Grant","Jobs":"Job","Internships":"Internship","Fellowship":"Fellowship","Training":"Training","Volunteer":"Volunteer","Awards":"Grant","Conferences":"Training","Short Courses":"Training"}}'),
  ('social_accounts', '{"twitter":{"enabled":false,"api_key":"","api_secret":"","access_token":"","access_secret":""},"linkedin":{"enabled":false,"access_token":"","person_id":""},"facebook":{"enabled":false,"page_id":"","access_token":""},"instagram":{"enabled":false,"access_token":"","instagram_id":"","default_image_url":""},"whatsapp":{"enabled":false,"access_token":"","phone_number_id":"","target_phone":"","group_id":""}}'),
  ('openai_config', '{"api_key":"","model":"gpt-4o-mini","enabled":false}')
ON CONFLICT (key) DO NOTHING;

-- Default categories
INSERT INTO categories (name, icon, color) VALUES
  ('Job', 'Briefcase', 'text-blue-600 bg-blue-100'),
  ('Internship', 'GraduationCap', 'text-green-600 bg-green-100'),
  ('Scholarship', 'BookOpen', 'text-purple-600 bg-purple-100'),
  ('Training', 'Users', 'text-orange-600 bg-orange-100'),
  ('Volunteer', 'Handshake', 'text-pink-600 bg-pink-100'),
  ('Fellowship', 'Award', 'text-teal-600 bg-teal-100'),
  ('Grant', 'DollarSign', 'text-amber-600 bg-amber-100')
ON CONFLICT (name) DO NOTHING;

-- Record migrations as applied
INSERT INTO _migrations (name) VALUES
  ('001_simplified.sql'),
  ('002_trending.sql'),
  ('003_settings_messages.sql'),
  ('004_subscribers.sql'),
  ('005_image_crop.sql'),
  ('006_image_size.sql'),
  ('007_scraped_posts.sql'),
  ('008_social_accounts.sql'),
  ('009_instagram.sql'),
  ('010_whatsapp.sql'),
  ('011_subscriber_source.sql'),
  ('012_featured.sql'),
  ('013_categories.sql')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_publish_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE _migrations ENABLE ROW LEVEL SECURITY;

-- Users: users can only see/update their own data; admins can see all
CREATE POLICY "users_select_own" ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "users_update_own" ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Opportunities: public read, admin write
CREATE POLICY "opportunities_select_public" ON opportunities FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "opportunities_insert_admin" ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "opportunities_update_admin" ON opportunities FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "opportunities_delete_admin" ON opportunities FOR DELETE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Messages: public insert, admin read/update/delete
CREATE POLICY "messages_insert_public" ON messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "messages_select_admin" ON messages FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "messages_update_admin" ON messages FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "messages_delete_admin" ON messages FOR DELETE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Site settings: public read, admin write
CREATE POLICY "site_settings_select_public" ON site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "site_settings_insert_admin" ON site_settings FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "site_settings_update_admin" ON site_settings FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Subscribers: public insert, admin read/delete
CREATE POLICY "subscribers_insert_public" ON subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "subscribers_select_admin" ON subscribers FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "subscribers_delete_admin" ON subscribers FOR DELETE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Scraped posts: admin only
CREATE POLICY "scraped_posts_select_admin" ON scraped_posts FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "scraped_posts_insert_admin" ON scraped_posts FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "scraped_posts_update_admin" ON scraped_posts FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Auto publish log: admin only
CREATE POLICY "auto_publish_log_select_admin" ON auto_publish_log FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "auto_publish_log_insert_admin" ON auto_publish_log FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Categories: public read, admin write
CREATE POLICY "categories_select_public" ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "categories_insert_admin" ON categories FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "categories_update_admin" ON categories FOR UPDATE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "categories_delete_admin" ON categories FOR DELETE
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
