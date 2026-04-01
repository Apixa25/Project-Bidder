-- ==================================================
-- Saved contractor search alerts: opt-in + last check
-- ==================================================

ALTER TABLE customer_saved_contractor_searches
  ADD COLUMN IF NOT EXISTS notify_on_new_matches BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;
