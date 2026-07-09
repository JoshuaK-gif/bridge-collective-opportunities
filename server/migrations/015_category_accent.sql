ALTER TABLE categories ADD COLUMN IF NOT EXISTS accent TEXT DEFAULT 'bg-blue-500';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS accent_bg TEXT DEFAULT 'bg-blue-50';

UPDATE categories SET accent = 'bg-pink-500', accent_bg = 'bg-pink-50' WHERE name = 'Training';
UPDATE categories SET accent = 'bg-purple-500', accent_bg = 'bg-purple-50' WHERE name = 'Scholarship';
UPDATE categories SET accent = 'bg-orange-500', accent_bg = 'bg-orange-50' WHERE name = 'Grant';
UPDATE categories SET accent = 'bg-blue-500', accent_bg = 'bg-blue-50' WHERE name = 'Job';
UPDATE categories SET accent = 'bg-green-500', accent_bg = 'bg-green-50' WHERE name = 'Internship';
UPDATE categories SET accent = 'bg-teal-500', accent_bg = 'bg-teal-50' WHERE name = 'Fellowship';
UPDATE categories SET accent = 'bg-pink-500', accent_bg = 'bg-pink-50' WHERE name = 'Volunteer';
