-- ==================================================
-- Estimator package payouts: Stripe Connect readiness
-- ==================================================

CREATE TABLE IF NOT EXISTS estimator_payout_accounts (
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

CREATE INDEX IF NOT EXISTS idx_estimator_payout_accounts_user_id
  ON estimator_payout_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_estimator_payout_accounts_stripe_account_id
  ON estimator_payout_accounts(stripe_account_id);

DROP TRIGGER IF EXISTS update_estimator_payout_accounts_updated_at
  ON estimator_payout_accounts;

CREATE TRIGGER update_estimator_payout_accounts_updated_at
  BEFORE UPDATE ON estimator_payout_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE estimator_payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estimator_payout_accounts_select_own
  ON estimator_payout_accounts;
DROP POLICY IF EXISTS estimator_payout_accounts_insert_own
  ON estimator_payout_accounts;
DROP POLICY IF EXISTS estimator_payout_accounts_update_own
  ON estimator_payout_accounts;
DROP POLICY IF EXISTS estimator_payout_accounts_admin_all
  ON estimator_payout_accounts;

CREATE POLICY estimator_payout_accounts_select_own
  ON estimator_payout_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY estimator_payout_accounts_insert_own
  ON estimator_payout_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY estimator_payout_accounts_update_own
  ON estimator_payout_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY estimator_payout_accounts_admin_all
  ON estimator_payout_accounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

ALTER TABLE estimate_package_purchases
  ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER NOT NULL DEFAULT 0
    CHECK (platform_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS estimator_payout_cents INTEGER NOT NULL DEFAULT 0
    CHECK (estimator_payout_cents >= 0),
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS payout_available_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT;

ALTER TABLE estimate_package_purchases
  DROP CONSTRAINT IF EXISTS estimate_package_purchases_payout_status_check;

ALTER TABLE estimate_package_purchases
  ADD CONSTRAINT estimate_package_purchases_payout_status_check CHECK (
    payout_status IN (
      'not_applicable',
      'payout_pending',
      'paid_out',
      'payout_failed'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_package_purchases_stripe_transfer_id
  ON estimate_package_purchases(stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estimate_package_purchases_payout_status
  ON estimate_package_purchases(payout_status, payout_available_at);

UPDATE estimate_package_purchases
SET
  platform_fee_cents = CASE
    WHEN price_cents > 0 THEN ROUND(price_cents * 0.10)::INTEGER
    ELSE 0
  END,
  estimator_payout_cents = CASE
    WHEN price_cents > 0 THEN price_cents - ROUND(price_cents * 0.10)::INTEGER
    ELSE 0
  END,
  payout_status = CASE
    WHEN price_cents > 0 AND paid_out_at IS NULL THEN 'payout_pending'
    WHEN price_cents = 0 THEN 'not_applicable'
    ELSE payout_status
  END,
  payout_available_at = CASE
    WHEN price_cents > 0 THEN COALESCE(payout_available_at, purchased_at)
    ELSE payout_available_at
  END
WHERE
  estimator_payout_cents = 0
  AND price_cents > 0;

COMMENT ON TABLE estimator_payout_accounts IS
  'Stripe Connect Express payout readiness for professional estimators selling package library products.';

COMMENT ON COLUMN estimate_package_purchases.estimator_payout_cents IS
  'Net seller payout amount in cents after the platform fee is retained.';
