-- ============================================================
-- Address quote request responses
-- ============================================================
-- Contractor quick quote responses to customer-created address requests.
-- Responses are private to the requesting customer, responding contractor,
-- and admins.

CREATE TABLE IF NOT EXISTS address_quote_request_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES address_quote_requests(id) ON DELETE CASCADE,
  property_address_id UUID NOT NULL REFERENCES property_addresses(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_total_cents INTEGER NOT NULL CHECK (quote_total_cents >= 0),
  timeline TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  withdrawn_at TIMESTAMPTZ,
  selected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT address_quote_request_responses_status_check CHECK (
    status IN ('submitted', 'withdrawn', 'selected', 'declined')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_address_quote_request_responses_one_active
  ON address_quote_request_responses(request_id, contractor_id)
  WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS idx_address_quote_request_responses_request
  ON address_quote_request_responses(request_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_address_quote_request_responses_contractor
  ON address_quote_request_responses(contractor_id, status, created_at DESC);

ALTER TABLE address_quote_requests
  ADD COLUMN IF NOT EXISTS selected_response_id UUID
    REFERENCES address_quote_request_responses(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS tr_address_quote_request_responses_updated
  ON address_quote_request_responses;
CREATE TRIGGER tr_address_quote_request_responses_updated
  BEFORE UPDATE ON address_quote_request_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE address_quote_request_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS address_quote_request_responses_contractor_select
  ON address_quote_request_responses;
DROP POLICY IF EXISTS address_quote_request_responses_contractor_insert
  ON address_quote_request_responses;
DROP POLICY IF EXISTS address_quote_request_responses_requester_select
  ON address_quote_request_responses;
DROP POLICY IF EXISTS address_quote_request_responses_admin_all
  ON address_quote_request_responses;

CREATE POLICY address_quote_request_responses_contractor_select
  ON address_quote_request_responses FOR SELECT
  USING (auth.uid() = contractor_id);

CREATE POLICY address_quote_request_responses_contractor_insert
  ON address_quote_request_responses FOR INSERT
  WITH CHECK (auth.uid() = contractor_id);

CREATE POLICY address_quote_request_responses_requester_select
  ON address_quote_request_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM address_quote_requests
      WHERE address_quote_requests.id = address_quote_request_responses.request_id
        AND address_quote_requests.requester_user_id = auth.uid()
    )
  );

CREATE POLICY address_quote_request_responses_admin_all
  ON address_quote_request_responses FOR ALL
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
