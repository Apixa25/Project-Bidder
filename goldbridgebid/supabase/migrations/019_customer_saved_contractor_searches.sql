-- =========================================================
-- Customer saved contractor searches: reusable directory views
-- =========================================================

CREATE TABLE IF NOT EXISTS customer_saved_contractor_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  query_string TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_saved_contractor_searches_user
  ON customer_saved_contractor_searches(user_id, created_at DESC);

ALTER TABLE customer_saved_contractor_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_saved_contractor_searches_select_own
  ON customer_saved_contractor_searches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY customer_saved_contractor_searches_insert_own
  ON customer_saved_contractor_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY customer_saved_contractor_searches_delete_own
  ON customer_saved_contractor_searches
  FOR DELETE USING (auth.uid() = user_id);
