-- ============================================================
-- Public Address Quote Layer
-- ============================================================
-- Address-led prospect quotes for simple exterior services. Quotes are public
-- by address, while address-level controls (requesting quotes and removing
-- quotes) require a verified address claim.

CREATE TABLE IF NOT EXISTS property_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  address_hash TEXT NOT NULL UNIQUE,
  street TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  geohash TEXT,
  source TEXT NOT NULL DEFAULT 'user_search',
  confidence TEXT NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT property_addresses_source_check CHECK (
    source IN ('user_search', 'contractor_entry', 'customer_entry', 'admin', 'import')
  ),
  CONSTRAINT property_addresses_confidence_check CHECK (
    confidence IN ('unverified', 'geocoded', 'admin_verified', 'imported')
  )
);

CREATE TABLE IF NOT EXISTS property_address_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_method TEXT NOT NULL DEFAULT 'admin_review',
  evidence_notes TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_address_id, user_id),
  CONSTRAINT property_address_claims_status_check CHECK (
    status IN ('pending', 'verified', 'rejected', 'revoked')
  ),
  CONSTRAINT property_address_claims_method_check CHECK (
    verification_method IN ('admin_review', 'postcard_code', 'document_upload', 'manual_admin')
  )
);

CREATE TABLE IF NOT EXISTS address_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_vertical TEXT NOT NULL,
  quote_source TEXT NOT NULL DEFAULT 'contractor_unsolicited',
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  scope_notes TEXT,
  quote_total_cents INTEGER CHECK (quote_total_cents IS NULL OR quote_total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  measurement_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pricing_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_explanation TEXT,
  expires_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT address_quotes_service_vertical_check CHECK (
    service_vertical IN (
      'lawn_care',
      'exterior_painting',
      'pressure_washing',
      'gutter_cleaning',
      'fence_staining',
      'window_washing',
      'yard_debris_cleanup'
    )
  ),
  CONSTRAINT address_quotes_source_check CHECK (
    quote_source IN ('contractor_unsolicited', 'customer_requested', 'admin_seeded')
  ),
  CONSTRAINT address_quotes_status_check CHECK (
    status IN ('draft', 'published', 'removed', 'expired', 'accepted')
  ),
  CONSTRAINT address_quotes_currency_check CHECK (currency = lower(currency))
);

CREATE TABLE IF NOT EXISTS address_quote_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_quote_id UUID NOT NULL REFERENCES address_quotes(id) ON DELETE CASCADE,
  measurement_type TEXT NOT NULL,
  label TEXT,
  geometry_geojson JSONB,
  area_sqft NUMERIC(12, 2),
  source TEXT NOT NULL DEFAULT 'manual',
  confidence TEXT NOT NULL DEFAULT 'contractor_confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT address_quote_measurements_type_check CHECK (
    measurement_type IN ('polygon_area', 'manual_area', 'linear_length', 'count')
  ),
  CONSTRAINT address_quote_measurements_source_check CHECK (
    source IN ('manual', 'map_drawn', 'imported', 'admin')
  ),
  CONSTRAINT address_quote_measurements_confidence_check CHECK (
    confidence IN ('contractor_confirmed', 'customer_confirmed', 'estimated', 'admin_verified')
  )
);

CREATE TABLE IF NOT EXISTS address_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email TEXT,
  requested_services_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT address_quote_requests_status_check CHECK (
    status IN ('open', 'closed', 'removed')
  )
);

CREATE TABLE IF NOT EXISTS address_quote_removal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_quote_id UUID NOT NULL REFERENCES address_quotes(id) ON DELETE CASCADE,
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_email TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'auto_hidden',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT address_quote_removal_requests_status_check CHECK (
    status IN ('auto_hidden', 'approved', 'rejected', 'restored')
  )
);

CREATE INDEX IF NOT EXISTS idx_property_addresses_city_state
  ON property_addresses(city, state);

CREATE INDEX IF NOT EXISTS idx_property_address_claims_user_status
  ON property_address_claims(user_id, status);

CREATE INDEX IF NOT EXISTS idx_property_address_claims_address_status
  ON property_address_claims(property_address_id, status);

CREATE INDEX IF NOT EXISTS idx_address_quotes_property_status
  ON address_quotes(property_address_id, status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_address_quotes_contractor_status
  ON address_quotes(contractor_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_address_quotes_vertical
  ON address_quotes(service_vertical, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_address_quote_measurements_quote
  ON address_quote_measurements(address_quote_id);

CREATE INDEX IF NOT EXISTS idx_address_quote_requests_property_status
  ON address_quote_requests(property_address_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_address_quote_removals_quote
  ON address_quote_removal_requests(address_quote_id, created_at DESC);

DROP TRIGGER IF EXISTS tr_property_addresses_updated ON property_addresses;
CREATE TRIGGER tr_property_addresses_updated
  BEFORE UPDATE ON property_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_property_address_claims_updated ON property_address_claims;
CREATE TRIGGER tr_property_address_claims_updated
  BEFORE UPDATE ON property_address_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_address_quotes_updated ON address_quotes;
CREATE TRIGGER tr_address_quotes_updated
  BEFORE UPDATE ON address_quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_address_quote_requests_updated ON address_quote_requests;
CREATE TRIGGER tr_address_quote_requests_updated
  BEFORE UPDATE ON address_quote_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION can_create_property_address_claim(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT count(*) < 3
    FROM property_address_claims
    WHERE user_id = target_user_id
      AND status IN ('pending', 'verified')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION enforce_property_address_claim_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('pending', 'verified') THEN
    IF (
      SELECT count(*) >= 3
      FROM property_address_claims
      WHERE user_id = NEW.user_id
        AND status IN ('pending', 'verified')
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Users may only have 3 active address claims.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_property_address_claim_limit ON property_address_claims;
CREATE TRIGGER tr_property_address_claim_limit
  BEFORE INSERT OR UPDATE OF status, user_id ON property_address_claims
  FOR EACH ROW EXECUTE FUNCTION enforce_property_address_claim_limit();

CREATE OR REPLACE FUNCTION user_has_verified_property_address_claim(
  target_user_id UUID,
  target_property_address_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM property_address_claims
    WHERE user_id = target_user_id
      AND property_address_id = target_property_address_id
      AND status = 'verified'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER TABLE property_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_address_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_quote_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_quote_removal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_addresses_public_select
  ON property_addresses FOR SELECT
  USING (true);

CREATE POLICY property_addresses_authenticated_insert
  ON property_addresses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY property_addresses_admin_all
  ON property_addresses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY property_address_claims_select_own
  ON property_address_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY property_address_claims_insert_own_limited
  ON property_address_claims FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND can_create_property_address_claim(auth.uid())
  );

CREATE POLICY property_address_claims_admin_all
  ON property_address_claims FOR ALL
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

CREATE POLICY address_quotes_public_select_published
  ON address_quotes FOR SELECT
  USING (status = 'published' AND removed_at IS NULL);

CREATE POLICY address_quotes_select_own
  ON address_quotes FOR SELECT
  USING (auth.uid() = contractor_id);

CREATE POLICY address_quotes_insert_own
  ON address_quotes FOR INSERT
  WITH CHECK (auth.uid() = contractor_id);

CREATE POLICY address_quotes_update_own
  ON address_quotes FOR UPDATE
  USING (auth.uid() = contractor_id);

CREATE POLICY address_quotes_admin_all
  ON address_quotes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY address_quote_measurements_public_select_published_quote
  ON address_quote_measurements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM address_quotes
      WHERE address_quotes.id = address_quote_measurements.address_quote_id
        AND address_quotes.status = 'published'
        AND address_quotes.removed_at IS NULL
    )
  );

CREATE POLICY address_quote_measurements_owner_all
  ON address_quote_measurements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM address_quotes
      WHERE address_quotes.id = address_quote_measurements.address_quote_id
        AND address_quotes.contractor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM address_quotes
      WHERE address_quotes.id = address_quote_measurements.address_quote_id
        AND address_quotes.contractor_id = auth.uid()
    )
  );

CREATE POLICY address_quote_measurements_admin_all
  ON address_quote_measurements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY address_quote_requests_select_verified_claimant
  ON address_quote_requests FOR SELECT
  USING (
    user_has_verified_property_address_claim(auth.uid(), property_address_id)
  );

CREATE POLICY address_quote_requests_insert_verified_claimant
  ON address_quote_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_user_id
    AND user_has_verified_property_address_claim(auth.uid(), property_address_id)
  );

CREATE POLICY address_quote_requests_admin_all
  ON address_quote_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY address_quote_removals_select_participants
  ON address_quote_removal_requests FOR SELECT
  USING (
    user_has_verified_property_address_claim(auth.uid(), property_address_id)
    OR EXISTS (
      SELECT 1 FROM address_quotes
      WHERE address_quotes.id = address_quote_removal_requests.address_quote_id
        AND address_quotes.contractor_id = auth.uid()
    )
  );

CREATE POLICY address_quote_removals_insert_verified_claimant
  ON address_quote_removal_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_user_id
    AND user_has_verified_property_address_claim(auth.uid(), property_address_id)
  );

CREATE POLICY address_quote_removals_admin_all
  ON address_quote_removal_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE property_addresses IS
  'Canonical address records for the public address quote layer.';

COMMENT ON TABLE address_quotes IS
  'Public contractor-created quotes attached to real addresses.';

COMMENT ON TABLE property_address_claims IS
  'Address control claims. Claims are required for address quote requests and quote removal, not for public quote lookup.';
