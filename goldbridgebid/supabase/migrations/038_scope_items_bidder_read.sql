-- Allow authenticated bidders to read scope items for projects that have
-- been published to bidders, restricted to items the customer confirmed.
-- The bidder page already uses the admin client to bypass RLS (so this
-- policy enables a future migration to the regular client).

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
    AND (
      customer_inclusion = 'yes'
      OR required_status = 'required'
    )
  );
