-- =============================================
-- Bidder specialties: contractor trade directory
-- =============================================

CREATE TABLE IF NOT EXISTS bidder_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade trade_category NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bidder_specialties_unique UNIQUE (user_id, trade)
);

CREATE INDEX IF NOT EXISTS idx_bidder_specialties_user_id
  ON bidder_specialties(user_id);

CREATE INDEX IF NOT EXISTS idx_bidder_specialties_trade
  ON bidder_specialties(trade);

CREATE INDEX IF NOT EXISTS idx_bidder_specialties_user_order
  ON bidder_specialties(user_id, display_order);

ALTER TABLE bidder_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY bidder_specialties_select_public ON bidder_specialties
  FOR SELECT USING (true);

CREATE POLICY bidder_specialties_insert_own ON bidder_specialties
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY bidder_specialties_update_own ON bidder_specialties
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY bidder_specialties_delete_own ON bidder_specialties
  FOR DELETE USING (auth.uid() = user_id);
