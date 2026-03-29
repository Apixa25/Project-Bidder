-- =============================================
-- Profile hearts: one quick trust vote per user
-- =============================================

CREATE TABLE IF NOT EXISTS profile_hearts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profile_hearts_unique UNIQUE (giver_user_id, target_user_id),
  CONSTRAINT profile_hearts_no_self CHECK (giver_user_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_hearts_target_user_id
  ON profile_hearts(target_user_id);

CREATE INDEX IF NOT EXISTS idx_profile_hearts_giver_user_id
  ON profile_hearts(giver_user_id);

ALTER TABLE profile_hearts ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_hearts_select_public ON profile_hearts
  FOR SELECT USING (true);

CREATE POLICY profile_hearts_insert_own ON profile_hearts
  FOR INSERT WITH CHECK (
    auth.uid() = giver_user_id
    AND giver_user_id <> target_user_id
  );

CREATE POLICY profile_hearts_delete_own ON profile_hearts
  FOR DELETE USING (auth.uid() = giver_user_id);
