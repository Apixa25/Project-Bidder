-- Migration 043: Store structured contractor bid worksheet rows.
-- These rows are contractor-submitted bid details, not customer AI estimate data.

CREATE TABLE IF NOT EXISTS bid_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  scope_item_id UUID REFERENCES project_ai_scope_items(id) ON DELETE SET NULL,
  item_label TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
  material_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  material_calc_mode TEXT NOT NULL DEFAULT 'multiply',
  material_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor_calc_mode TEXT NOT NULL DEFAULT 'multiply',
  labor_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bid_line_items_material_calc_mode_check
    CHECK (material_calc_mode IN ('multiply', 'add')),
  CONSTRAINT bid_line_items_labor_calc_mode_check
    CHECK (labor_calc_mode IN ('multiply', 'add'))
);

CREATE INDEX IF NOT EXISTS idx_bid_line_items_bid_display
  ON bid_line_items(bid_id, display_order);

CREATE INDEX IF NOT EXISTS idx_bid_line_items_scope_item
  ON bid_line_items(scope_item_id);

DROP TRIGGER IF EXISTS tr_bid_line_items_updated ON bid_line_items;
CREATE TRIGGER tr_bid_line_items_updated
  BEFORE UPDATE ON bid_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE bid_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY bid_line_items_select_own
  ON bid_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_line_items.bid_id
        AND bids.bidder_id = auth.uid()
    )
  );

CREATE POLICY bid_line_items_select_customer
  ON bid_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bids
      JOIN projects ON projects.id = bids.project_id
      WHERE bids.id = bid_line_items.bid_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY bid_line_items_insert_own
  ON bid_line_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_line_items.bid_id
        AND bids.bidder_id = auth.uid()
    )
  );

CREATE POLICY bid_line_items_update_own
  ON bid_line_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_line_items.bid_id
        AND bids.bidder_id = auth.uid()
    )
  );

CREATE POLICY bid_line_items_delete_own
  ON bid_line_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_line_items.bid_id
        AND bids.bidder_id = auth.uid()
    )
  );

CREATE POLICY bid_line_items_admin_all
  ON bid_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE bid_line_items IS
  'Structured contractor-submitted line items for sealed bids. Values are independent from customer AI estimate worksheet values.';
