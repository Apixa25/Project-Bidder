-- The customer session was missing a DELETE policy on project_ai_scope_items,
-- which caused the "wipe and re-insert" flow to silently delete 0 rows
-- (RLS blocks instead of erroring), leading to duplicate-key constraint failures.

CREATE POLICY project_ai_scope_items_delete_owner
  ON project_ai_scope_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_scope_items.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_item_clarifications_delete_owner
  ON project_ai_item_clarifications FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_item_clarifications.project_id
        AND projects.customer_id = auth.uid()
    )
  );
