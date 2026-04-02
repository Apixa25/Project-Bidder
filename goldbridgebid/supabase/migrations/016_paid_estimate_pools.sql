-- =============================================
-- Paid estimate pools: schema foundation
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'paid_estimate_filter'
  ) THEN
    CREATE TYPE paid_estimate_filter AS ENUM (
      'open_to_anyone',
      'core_verified_only'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'paid_estimate_pool_status'
  ) THEN
    CREATE TYPE paid_estimate_pool_status AS ENUM (
      'funding_required',
      'active',
      'full',
      'closed_settling',
      'closed_refunded'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'paid_estimate_claim_status'
  ) THEN
    CREATE TYPE paid_estimate_claim_status AS ENUM (
      'unpaid_bid',
      'paid_reserved',
      'payout_pending',
      'paid_out',
      'disputed',
      'payout_denied_refunded'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'paid_estimate_dispute_reason'
  ) THEN
    CREATE TYPE paid_estimate_dispute_reason AS ENUM (
      'blank_or_spam',
      'wrong_trade',
      'duplicate_submission',
      'abusive_or_irrelevant',
      'not_qualified_at_submission'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_paid_estimate_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  filter paid_estimate_filter NOT NULL DEFAULT 'open_to_anyone',
  reward_amount NUMERIC(12, 2) NOT NULL CHECK (reward_amount > 0),
  contractor_payout_amount NUMERIC(12, 2) NOT NULL CHECK (contractor_payout_amount >= 0),
  platform_fee_amount NUMERIC(12, 2) NOT NULL CHECK (platform_fee_amount >= 0),
  max_paid_slots INTEGER NOT NULL CHECK (max_paid_slots > 0),
  claimed_paid_slots INTEGER NOT NULL DEFAULT 0 CHECK (claimed_paid_slots >= 0),
  funded_total_amount NUMERIC(12, 2) NOT NULL CHECK (funded_total_amount >= 0),
  reserved_total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (reserved_total_amount >= 0),
  paid_out_total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_out_total_amount >= 0),
  refunded_total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (refunded_total_amount >= 0),
  status paid_estimate_pool_status NOT NULL DEFAULT 'funding_required',
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  funded_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_paid_estimate_pools_fee_split_valid CHECK (
    reward_amount = contractor_payout_amount + platform_fee_amount
  ),
  CONSTRAINT project_paid_estimate_pools_claimed_slots_valid CHECK (
    claimed_paid_slots <= max_paid_slots
  )
);

CREATE INDEX IF NOT EXISTS idx_project_paid_estimate_pools_status
  ON project_paid_estimate_pools(status);

CREATE INDEX IF NOT EXISTS idx_project_paid_estimate_pools_funded_at
  ON project_paid_estimate_pools(funded_at);

CREATE TABLE IF NOT EXISTS paid_estimate_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES project_paid_estimate_pools(id) ON DELETE SET NULL,
  bid_id UUID NOT NULL UNIQUE REFERENCES bids(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_status paid_estimate_claim_status NOT NULL DEFAULT 'unpaid_bid',
  was_paid_eligible BOOLEAN NOT NULL DEFAULT false,
  slot_sequence INTEGER CHECK (slot_sequence IS NULL OR slot_sequence > 0),
  reward_amount NUMERIC(12, 2) CHECK (reward_amount IS NULL OR reward_amount >= 0),
  contractor_payout_amount NUMERIC(12, 2) CHECK (
    contractor_payout_amount IS NULL OR contractor_payout_amount >= 0
  ),
  platform_fee_amount NUMERIC(12, 2) CHECK (
    platform_fee_amount IS NULL OR platform_fee_amount >= 0
  ),
  reserved_at TIMESTAMPTZ,
  payout_due_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  denied_refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paid_estimate_claims_project_id
  ON paid_estimate_claims(project_id);

CREATE INDEX IF NOT EXISTS idx_paid_estimate_claims_bidder_id
  ON paid_estimate_claims(bidder_id);

CREATE INDEX IF NOT EXISTS idx_paid_estimate_claims_claim_status
  ON paid_estimate_claims(claim_status);

CREATE INDEX IF NOT EXISTS idx_paid_estimate_claims_payout_due_at
  ON paid_estimate_claims(payout_due_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_estimate_claims_pool_slot_sequence
  ON paid_estimate_claims(pool_id, slot_sequence)
  WHERE pool_id IS NOT NULL AND slot_sequence IS NOT NULL;

CREATE TABLE IF NOT EXISTS paid_estimate_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL UNIQUE REFERENCES paid_estimate_claims(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason paid_estimate_dispute_reason NOT NULL,
  customer_message TEXT,
  review_status TEXT NOT NULL DEFAULT 'open' CHECK (
    review_status IN ('open', 'resolved_paid', 'resolved_denied')
  ),
  review_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paid_estimate_disputes_project_id
  ON paid_estimate_disputes(project_id);

CREATE INDEX IF NOT EXISTS idx_paid_estimate_disputes_review_status
  ON paid_estimate_disputes(review_status);

CREATE TRIGGER tr_project_paid_estimate_pools_updated
  BEFORE UPDATE ON project_paid_estimate_pools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_paid_estimate_claims_updated
  BEFORE UPDATE ON paid_estimate_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_paid_estimate_disputes_updated
  BEFORE UPDATE ON paid_estimate_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_paid_estimate_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_estimate_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE paid_estimate_disputes ENABLE ROW LEVEL SECURITY;
