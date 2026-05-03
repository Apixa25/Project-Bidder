-- =============================================
-- Address quote evidence media
-- =============================================

CREATE TABLE IF NOT EXISTS address_quote_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_quote_id UUID NOT NULL REFERENCES address_quotes(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('map_snapshot', 'uploaded_photo', 'street_view')),
  url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_address_quote_media_quote_id
  ON address_quote_media(address_quote_id, display_order, created_at);

CREATE INDEX IF NOT EXISTS idx_address_quote_media_contractor_id
  ON address_quote_media(contractor_id);

ALTER TABLE address_quote_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view address quote media"
  ON address_quote_media;
DROP POLICY IF EXISTS "Contractors can manage their own address quote media"
  ON address_quote_media;

CREATE POLICY "Public can view address quote media"
  ON address_quote_media FOR SELECT
  USING (true);

CREATE POLICY "Contractors can manage their own address quote media"
  ON address_quote_media FOR ALL
  USING (auth.uid() = contractor_id)
  WITH CHECK (auth.uid() = contractor_id);
