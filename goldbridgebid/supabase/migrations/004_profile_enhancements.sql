-- =============================================
-- Profile Enhancements: Avatar, Portfolio, Links
-- =============================================

-- Add social link columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_link_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS other_link_label TEXT;

-- Portfolio items table (images, videos with descriptions)
CREATE TABLE portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,       -- 'image' or 'video'
  thumbnail_url TEXT,             -- auto-generated or first frame for video
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_user ON portfolio_items(user_id);
CREATE INDEX idx_portfolio_order ON portfolio_items(user_id, display_order);

-- RLS for portfolio_items
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view portfolio items (public profiles)
CREATE POLICY portfolio_select ON portfolio_items
  FOR SELECT USING (true);

-- Users manage their own
CREATE POLICY portfolio_insert ON portfolio_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY portfolio_update ON portfolio_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY portfolio_delete ON portfolio_items
  FOR DELETE USING (auth.uid() = user_id);
