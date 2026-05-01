-- =============================================
-- Professional estimator marketplace foundation
-- =============================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'estimator';

CREATE TABLE IF NOT EXISTS estimator_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  headline TEXT,
  bio TEXT,
  service_area TEXT,
  website_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT estimator_profiles_verification_status_check CHECK (
    verification_status IN ('pending', 'verified', 'rejected')
  )
);

CREATE TABLE IF NOT EXISTS estimate_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  package_type TEXT NOT NULL,
  trades trade_category[] NOT NULL DEFAULT '{}',
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'draft',
  current_version_id UUID,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT estimate_packages_status_check CHECK (
    status IN ('draft', 'published', 'archived')
  ),
  CONSTRAINT estimate_packages_type_check CHECK (
    package_type IN (
      'material_takeoff',
      'bid_ready_scope',
      'estimate_worksheet',
      'plan_review',
      'other'
    )
  ),
  CONSTRAINT estimate_packages_currency_check CHECK (currency = lower(currency))
);

CREATE TABLE IF NOT EXISTS estimate_package_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES estimate_packages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  title_snapshot TEXT NOT NULL,
  summary_snapshot TEXT NOT NULL,
  scope_overview TEXT,
  assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  line_items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_cents_snapshot INTEGER NOT NULL DEFAULT 0 CHECK (price_cents_snapshot >= 0),
  currency_snapshot TEXT NOT NULL DEFAULT 'usd',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, version_number),
  CONSTRAINT estimate_package_versions_currency_check CHECK (
    currency_snapshot = lower(currency_snapshot)
  )
);

ALTER TABLE estimate_packages
  ADD CONSTRAINT estimate_packages_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES estimate_package_versions(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS estimate_package_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES estimate_packages(id) ON DELETE CASCADE,
  package_version_id UUID NOT NULL REFERENCES estimate_package_versions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  display_order INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estimate_package_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES estimate_packages(id) ON DELETE CASCADE,
  package_version_id UUID NOT NULL REFERENCES estimate_package_versions(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_version_id, buyer_id),
  CONSTRAINT estimate_package_purchases_currency_check CHECK (currency = lower(currency))
);

CREATE TABLE IF NOT EXISTS estimate_package_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES estimate_packages(id) ON DELETE CASCADE,
  package_version_id UUID REFERENCES estimate_package_versions(id) ON DELETE CASCADE,
  grantee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, package_version_id, grantee_user_id)
);

CREATE TABLE IF NOT EXISTS estimate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_estimator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  trades trade_category[] NOT NULL DEFAULT '{}',
  location_city TEXT,
  location_state TEXT,
  target_budget_cents INTEGER CHECK (
    target_budget_cents IS NULL OR target_budget_cents >= 0
  ),
  requested_due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  public_to_estimators BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT estimate_requests_status_check CHECK (
    status IN ('open', 'assigned', 'completed', 'cancelled')
  )
);

CREATE TABLE IF NOT EXISTS estimate_package_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES estimate_packages(id) ON DELETE CASCADE,
  package_version_id UUID REFERENCES estimate_package_versions(id) ON DELETE SET NULL,
  purchase_id UUID REFERENCES estimate_package_purchases(id) ON DELETE SET NULL,
  reviewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  review_title TEXT,
  review_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT estimate_package_reviews_status_check CHECK (
    status IN ('published', 'flagged', 'hidden')
  ),
  CONSTRAINT estimate_package_reviews_no_self CHECK (
    reviewer_user_id <> estimator_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_package_reviews_unique_purchase
  ON estimate_package_reviews(purchase_id, reviewer_user_id)
  WHERE purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estimator_profiles_status
  ON estimator_profiles(verification_status);

CREATE INDEX IF NOT EXISTS idx_estimate_packages_estimator
  ON estimate_packages(estimator_id);

CREATE INDEX IF NOT EXISTS idx_estimate_packages_status
  ON estimate_packages(status);

CREATE INDEX IF NOT EXISTS idx_estimate_packages_trades
  ON estimate_packages USING GIN(trades);

CREATE INDEX IF NOT EXISTS idx_estimate_package_versions_package
  ON estimate_package_versions(package_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_estimate_package_files_version
  ON estimate_package_files(package_version_id, display_order);

CREATE INDEX IF NOT EXISTS idx_estimate_package_purchases_buyer
  ON estimate_package_purchases(buyer_id, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimate_package_purchases_seller
  ON estimate_package_purchases(seller_id, purchased_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimate_package_access_grants_grantee
  ON estimate_package_access_grants(grantee_user_id);

CREATE INDEX IF NOT EXISTS idx_estimate_requests_requester
  ON estimate_requests(requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimate_requests_assigned_estimator
  ON estimate_requests(assigned_estimator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimate_requests_status
  ON estimate_requests(status);

CREATE INDEX IF NOT EXISTS idx_estimate_package_reviews_package
  ON estimate_package_reviews(package_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_estimate_package_reviews_estimator
  ON estimate_package_reviews(estimator_id, created_at DESC);

CREATE TRIGGER tr_estimator_profiles_updated
  BEFORE UPDATE ON estimator_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_estimate_packages_updated
  BEFORE UPDATE ON estimate_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_estimate_requests_updated
  BEFORE UPDATE ON estimate_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_estimate_package_reviews_updated
  BEFORE UPDATE ON estimate_package_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE estimator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_package_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_package_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_package_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_package_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_package_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY estimator_profiles_select_authenticated
  ON estimator_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY estimator_profiles_insert_own_estimator
  ON estimator_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text = 'estimator'
    )
  );

CREATE POLICY estimator_profiles_update_own_or_admin
  ON estimator_profiles FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_packages_select_published_or_owner_or_admin
  ON estimate_packages FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND status = 'published')
    OR auth.uid() = estimator_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_packages_insert_own_estimator
  ON estimate_packages FOR INSERT
  WITH CHECK (
    auth.uid() = estimator_id
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text = 'estimator'
    )
  );

CREATE POLICY estimate_packages_update_own_or_admin
  ON estimate_packages FOR UPDATE
  USING (
    auth.uid() = estimator_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_packages_delete_own_draft_or_admin
  ON estimate_packages FOR DELETE
  USING (
    (auth.uid() = estimator_id AND status = 'draft')
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_package_versions_select_with_access
  ON estimate_package_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_versions.package_id
        AND (
          p.estimator_id = auth.uid()
          OR (auth.uid() IS NOT NULL AND p.status = 'published' AND p.price_cents = 0)
          OR EXISTS (
            SELECT 1 FROM estimate_package_purchases pur
            WHERE pur.package_version_id = estimate_package_versions.id
              AND pur.buyer_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM estimate_package_access_grants grant_row
            WHERE grant_row.package_id = p.id
              AND grant_row.grantee_user_id = auth.uid()
              AND (
                grant_row.package_version_id IS NULL
                OR grant_row.package_version_id = estimate_package_versions.id
              )
              AND (
                grant_row.expires_at IS NULL
                OR grant_row.expires_at > now()
              )
          )
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
              AND profiles.role = 'admin'
          )
        )
    )
  );

CREATE POLICY estimate_package_versions_insert_owner
  ON estimate_package_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_versions.package_id
        AND p.estimator_id = auth.uid()
    )
  );

CREATE POLICY estimate_package_versions_update_owner_or_admin
  ON estimate_package_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_versions.package_id
        AND (
          p.estimator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
              AND profiles.role = 'admin'
          )
        )
    )
  );

CREATE POLICY estimate_package_files_select_with_access
  ON estimate_package_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_files.package_id
        AND (
          p.estimator_id = auth.uid()
          OR (auth.uid() IS NOT NULL AND p.status = 'published' AND p.price_cents = 0)
          OR EXISTS (
            SELECT 1 FROM estimate_package_purchases pur
            WHERE pur.package_version_id = estimate_package_files.package_version_id
              AND pur.buyer_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM estimate_package_access_grants grant_row
            WHERE grant_row.package_id = p.id
              AND grant_row.grantee_user_id = auth.uid()
              AND (
                grant_row.package_version_id IS NULL
                OR grant_row.package_version_id = estimate_package_files.package_version_id
              )
              AND (
                grant_row.expires_at IS NULL
                OR grant_row.expires_at > now()
              )
          )
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
              AND profiles.role = 'admin'
          )
        )
    )
  );

CREATE POLICY estimate_package_files_insert_owner
  ON estimate_package_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_files.package_id
        AND p.estimator_id = auth.uid()
    )
  );

CREATE POLICY estimate_package_files_update_owner_or_admin
  ON estimate_package_files FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_files.package_id
        AND (
          p.estimator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
              AND profiles.role = 'admin'
          )
        )
    )
  );

CREATE POLICY estimate_package_files_delete_owner_or_admin
  ON estimate_package_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_files.package_id
        AND (
          p.estimator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
              AND profiles.role = 'admin'
          )
        )
    )
  );

CREATE POLICY estimate_package_purchases_select_participant_or_admin
  ON estimate_package_purchases FOR SELECT
  USING (
    buyer_id = auth.uid()
    OR seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_package_access_grants_select_participant_or_admin
  ON estimate_package_access_grants FOR SELECT
  USING (
    grantee_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_access_grants.package_id
        AND p.estimator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_package_access_grants_insert_owner_or_admin
  ON estimate_package_access_grants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estimate_packages p
      WHERE p.id = estimate_package_access_grants.package_id
        AND p.estimator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_requests_select_involved_or_public_estimator_or_admin
  ON estimate_requests FOR SELECT
  USING (
    requester_id = auth.uid()
    OR assigned_estimator_id = auth.uid()
    OR (
      public_to_estimators = true
      AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
          AND user_roles.role::text = 'estimator'
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_requests_insert_own
  ON estimate_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY estimate_requests_update_involved_or_admin
  ON estimate_requests FOR UPDATE
  USING (
    requester_id = auth.uid()
    OR assigned_estimator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_package_reviews_select_published_or_participant_or_admin
  ON estimate_package_reviews FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND status = 'published')
    OR reviewer_user_id = auth.uid()
    OR estimator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY estimate_package_reviews_insert_buyer
  ON estimate_package_reviews FOR INSERT
  WITH CHECK (
    reviewer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM estimate_package_purchases pur
      WHERE pur.id = estimate_package_reviews.purchase_id
        AND pur.buyer_id = auth.uid()
        AND pur.package_id = estimate_package_reviews.package_id
        AND pur.seller_id = estimate_package_reviews.estimator_id
    )
  );

CREATE POLICY estimate_package_reviews_update_own_or_admin
  ON estimate_package_reviews FOR UPDATE
  USING (
    reviewer_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE estimate_packages IS
  'General marketplace listings for professional estimator packages. These are separate from sealed contractor bids and paid estimate pools.';

COMMENT ON TABLE estimate_package_purchases IS
  'Records package access after free acquisition or confirmed Stripe payment. This table does not model disputes.';

COMMENT ON TABLE estimate_requests IS
  'Custom estimate requests that any authenticated user can create.';

