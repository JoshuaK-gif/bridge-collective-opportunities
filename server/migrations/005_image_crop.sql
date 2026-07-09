ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS image_crop JSONB DEFAULT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS image_public_id TEXT DEFAULT '';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS image_size TEXT DEFAULT 'medium';
CREATE INDEX IF NOT EXISTS idx_opportunities_image_public_id ON opportunities(image_public_id);
