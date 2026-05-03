-- =============================================
-- Saved customer exact-address map preview
-- =============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS exact_address_map_image_url TEXT;
