CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (key, value) VALUES
  ('stats', '{"monthly_visitors":"100K+","social_followers":"50K+","newsletter_subs":"20K+","opportunities_listed":"500+"}'),
  ('packages', '[
    {"name":"Starter Package","price":"$450","period":"/ Month","color":"from-green-500 to-emerald-600","features":["Website post on Bridge Opportunities platform","Standard visibility","1-2 social media promotions"]},
    {"name":"Growth Package","price":"$700","period":"/ Month","color":"from-blue-500 to-indigo-600","popular":true,"features":["Website post + homepage feature","2-3 social media promotions per week","Newsletter inclusion"]},
    {"name":"Impact Package","price":"$2,500","period":" / campaign","color":"from-purple-500 to-violet-600","features":["Priority website placement","Multi-week campaign promotion","Intensive social media coverage","Newsletter feature","LinkedIn or YouTube Live session"]},
    {"name":"Annual Partnership","price":"$5,000","period":" / Year","color":"from-amber-500 to-orange-600","features":["Ongoing promotion throughout the year","Multiple campaigns","Priority support and placement","Continuous brand visibility"]}
  ]')
ON CONFLICT (key) DO NOTHING;
