CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'Briefcase',
  color TEXT DEFAULT 'text-blue-600 bg-blue-100',
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categories (name, icon, color) VALUES
  ('Job', 'Briefcase', 'text-blue-600 bg-blue-100'),
  ('Internship', 'GraduationCap', 'text-green-600 bg-green-100'),
  ('Scholarship', 'BookOpen', 'text-purple-600 bg-purple-100'),
  ('Training', 'Users', 'text-orange-600 bg-orange-100'),
  ('Volunteer', 'Handshake', 'text-pink-600 bg-pink-100'),
  ('Fellowship', 'Award', 'text-teal-600 bg-teal-100'),
  ('Grant', 'DollarSign', 'text-amber-600 bg-amber-100')
ON CONFLICT (name) DO NOTHING;
