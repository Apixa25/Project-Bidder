-- ==================================================
-- Paid estimate payout tracking
-- ==================================================

ALTER TABLE paid_estimate_claims
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_estimate_claims_stripe_transfer_id
  ON paid_estimate_claims(stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;
