-- =============================================
-- Portfolio: support multiple media per item
-- =============================================

-- Child table for individual media files within a portfolio item
CREATE TABLE portfolio_item_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id UUID NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,          -- 'image' or 'video'
  thumbnail_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_media_item ON portfolio_item_media(portfolio_item_id);
CREATE INDEX idx_portfolio_media_order ON portfolio_item_media(portfolio_item_id, display_order);

ALTER TABLE portfolio_item_media ENABLE ROW LEVEL SECURITY;

-- Anyone can view (public profiles)
CREATE POLICY portfolio_media_select ON portfolio_item_media
  FOR SELECT USING (true);

-- Only the portfolio item owner can insert/update/delete
CREATE POLICY portfolio_media_insert ON portfolio_item_media
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM portfolio_items WHERE id = portfolio_item_id AND user_id = auth.uid())
  );

CREATE POLICY portfolio_media_update ON portfolio_item_media
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM portfolio_items WHERE id = portfolio_item_id AND user_id = auth.uid())
  );

CREATE POLICY portfolio_media_delete ON portfolio_item_media
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM portfolio_items WHERE id = portfolio_item_id AND user_id = auth.uid())
  );
