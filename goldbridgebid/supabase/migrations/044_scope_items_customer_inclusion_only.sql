-- Bidders should only see scope items the customer explicitly included.
-- "required" is an AI recommendation label, not a customer approval.

DROP POLICY IF EXISTS project_ai_scope_items_select_bidder
  ON project_ai_scope_items;

CREATE POLICY project_ai_scope_items_select_bidder
  ON project_ai_scope_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM project_ai_estimates e
        JOIN projects p ON p.id = e.project_id
      WHERE e.project_id = project_ai_scope_items.project_id
        AND e.published_to_bidders = true
        AND p.status = 'open'
    )
    AND customer_inclusion = 'yes'
  );
