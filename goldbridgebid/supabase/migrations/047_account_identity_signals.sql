-- =============================================
-- Account identity and risk signals
-- =============================================

CREATE TABLE IF NOT EXISTS account_identity_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_value_hash TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'low',
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, signal_type, signal_value_hash),
  CONSTRAINT account_identity_signals_confidence_check CHECK (
    confidence IN ('low', 'medium', 'high')
  ),
  CONSTRAINT account_identity_signals_source_check CHECK (
    source IN ('email_signup', 'oauth_signup', 'login', 'stripe', 'admin')
  )
);

CREATE TABLE IF NOT EXISTS account_risk_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  related_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'low',
  reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, related_user_id, signal_type),
  CONSTRAINT account_risk_links_distinct_users_check CHECK (user_id <> related_user_id),
  CONSTRAINT account_risk_links_ordered_users_check CHECK (user_id < related_user_id),
  CONSTRAINT account_risk_links_confidence_check CHECK (
    confidence IN ('low', 'medium', 'high')
  )
);

CREATE INDEX IF NOT EXISTS idx_account_identity_signals_lookup
  ON account_identity_signals(signal_type, signal_value_hash);

CREATE INDEX IF NOT EXISTS idx_account_identity_signals_user
  ON account_identity_signals(user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_risk_links_user
  ON account_risk_links(user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_risk_links_related
  ON account_risk_links(related_user_id, last_seen_at DESC);

ALTER TABLE account_identity_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_risk_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_identity_signals_admin_select
  ON account_identity_signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY account_identity_signals_admin_insert
  ON account_identity_signals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY account_identity_signals_admin_update
  ON account_identity_signals FOR UPDATE
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

CREATE POLICY account_identity_signals_admin_delete
  ON account_identity_signals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY account_risk_links_admin_select
  ON account_risk_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY account_risk_links_admin_insert
  ON account_risk_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY account_risk_links_admin_update
  ON account_risk_links FOR UPDATE
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

CREATE POLICY account_risk_links_admin_delete
  ON account_risk_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE account_identity_signals IS
  'Hashed account identity signals for trust and safety review. Raw signal values should not be stored here.';

COMMENT ON TABLE account_risk_links IS
  'Admin-only related-account links produced from matching identity signals. These are review signals, not automatic enforcement.';

