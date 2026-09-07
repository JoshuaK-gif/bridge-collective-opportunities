-- Bridge Collective Opportunities - New Nhost Database Setup
-- Focus on opportunities only (no assistant, CV, or control panel)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- USERS TABLE (for auth)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- OPPORTUNITIES TABLE (main table)
-- ============================================
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  link TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  category TEXT DEFAULT '',
  deadline TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  trending BOOLEAN DEFAULT false,
  featured_order INT DEFAULT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Briefcase',
  color TEXT DEFAULT 'text-blue-600 bg-blue-100',
  accent_color TEXT DEFAULT NULL,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default categories
INSERT INTO categories (name, icon, color) VALUES
  ('Job', 'Briefcase', 'text-blue-600 bg-blue-100'),
  ('Internship', 'GraduationCap', 'text-green-600 bg-green-100'),
  ('Scholarship', 'BookOpen', 'text-purple-600 bg-purple-100'),
  ('Training', 'Users', 'text-orange-600 bg-orange-100'),
  ('Volunteer', 'Handshake', 'text-pink-600 bg-pink-100'),
  ('Fellowship', 'Award', 'text-teal-600 bg-teal-100'),
  ('Grant', 'DollarSign', 'text-amber-600 bg-amber-100')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SUBSCRIBERS TABLE (for newsletter)
-- ============================================
CREATE TABLE IF NOT EXISTS subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  source_page TEXT DEFAULT '',
  referrer TEXT DEFAULT '',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- MESSAGES TABLE (for contact form)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SITE_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO site_settings (key, value) VALUES
  ('stats', '{"monthly_visitors":"100K+","social_followers":"50K+","newsletter_subs":"20K+","opportunities_listed":"500+"}'),
  ('packages', '[
    {"name":"Starter Package","price":"$450","period":"/ Month","color":"from-green-500 to-emerald-600","features":["Website post on Bridge Opportunities platform","Standard visibility","1-2 social media promotions"]},
    {"name":"Growth Package","price":"$700","period":"/ Month","color":"from-blue-500 to-indigo-600","popular":true,"features":["Website post + homepage feature","2-3 social media promotions per week","Newsletter inclusion"]},
    {"name":"Impact Package","price":"$2,500","period":" / campaign","color":"from-purple-500 to-violet-600","features":["Priority website placement","Multi-week campaign promotion","Intensive social media coverage","Newsletter feature","LinkedIn or YouTube Live session"]},
    {"name":"Annual Partnership","price":"$5,000","period":" / Year","color":"from-amber-500 to-orange-600","features":["Ongoing promotion throughout the year","Multiple campaigns","Priority support and placement","Continuous brand visibility"]}
  ]')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- LISTS TABLE (for collections)
-- ============================================
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(list_id, opportunity_id)
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON opportunities(category);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_date ON opportunities(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_updated_date ON opportunities(updated_date DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_deadline ON opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_featured_order ON opportunities(featured_order) WHERE featured_order IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_trending ON opportunities(trending) WHERE trending = true;
CREATE INDEX IF NOT EXISTS idx_opportunities_title_trgm ON opportunities USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_messages_created_date ON messages(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_opportunity_id ON list_items(opportunity_id);

-- ============================================
-- Create admin user (default password: admin123)
-- ============================================
INSERT INTO users (email, password, full_name, role) VALUES
  ('admin@bridgecollective.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;
