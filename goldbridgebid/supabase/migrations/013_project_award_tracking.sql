-- =============================================
-- Project award tracking for verified reputation
-- =============================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS awarded_bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS awarded_bidder_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_awarded_bid_id ON projects(awarded_bid_id);
CREATE INDEX IF NOT EXISTS idx_projects_awarded_bidder_id ON projects(awarded_bidder_id);
