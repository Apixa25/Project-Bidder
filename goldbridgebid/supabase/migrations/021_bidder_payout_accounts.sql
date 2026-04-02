-- ==================================================
-- Bidder payout accounts: Stripe Connect readiness
-- ==================================================

CREATE TABLE IF NOT EXISTS bidder_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  onboarding_started_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  last_status_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bidder_payout_accounts_user_id
  ON bidder_payout_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_bidder_payout_accounts_stripe_account_id
  ON bidder_payout_accounts(stripe_account_id);

DROP TRIGGER IF EXISTS update_bidder_payout_accounts_updated_at
  ON bidder_payout_accounts;

CREATE TRIGGER update_bidder_payout_accounts_updated_at
  BEFORE UPDATE ON bidder_payout_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE bidder_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bidder_payout_accounts_select_own ON bidder_payout_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY bidder_payout_accounts_insert_own ON bidder_payout_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY bidder_payout_accounts_update_own ON bidder_payout_accounts
  FOR UPDATE USING (auth.uid() = user_id);
