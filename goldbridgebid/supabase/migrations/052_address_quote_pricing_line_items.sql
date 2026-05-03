-- =============================================
-- Address quote pricing line items
-- =============================================

CREATE TABLE IF NOT EXISTS address_quote_pricing_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_quote_id UUID NOT NULL REFERENCES address_quotes(id) ON DELETE CASCADE,
  measurement_id UUID REFERENCES address_quote_measurements(id) ON DELETE SET NULL,
  item_label TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  calc_mode TEXT NOT NULL DEFAULT 'multiply',
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT address_quote_pricing_line_items_calc_mode_check
    CHECK (calc_mode IN ('multiply', 'add'))
);

CREATE INDEX IF NOT EXISTS idx_address_quote_pricing_line_items_quote_display
  ON address_quote_pricing_line_items(address_quote_id, display_order);

CREATE INDEX IF NOT EXISTS idx_address_quote_pricing_line_items_measurement
  ON address_quote_pricing_line_items(measurement_id);

DROP TRIGGER IF EXISTS tr_address_quote_pricing_line_items_updated
  ON address_quote_pricing_line_items;
CREATE TRIGGER tr_address_quote_pricing_line_items_updated
  BEFORE UPDATE ON address_quote_pricing_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE address_quote_pricing_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY address_quote_pricing_line_items_public_published
  ON address_quote_pricing_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM address_quotes
      WHERE address_quotes.id = address_quote_pricing_line_items.address_quote_id
        AND address_quotes.status = 'published'
        AND address_quotes.removed_at IS NULL
    )
  );

CREATE POLICY address_quote_pricing_line_items_owner_all
  ON address_quote_pricing_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM address_quotes
      WHERE address_quotes.id = address_quote_pricing_line_items.address_quote_id
        AND address_quotes.contractor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM address_quotes
      WHERE address_quotes.id = address_quote_pricing_line_items.address_quote_id
        AND address_quotes.contractor_id = auth.uid()
    )
  );

CREATE POLICY address_quote_pricing_line_items_admin_all
  ON address_quote_pricing_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
