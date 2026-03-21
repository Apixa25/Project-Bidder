-- Photo annotation: store annotated image URL on project files
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS annotated_url TEXT;

-- UPDATE policy for project_files (needed so customers can save annotations)
CREATE POLICY project_files_update ON project_files FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects WHERE id = project_id AND customer_id = auth.uid())
);

-- Before/after portfolio items: distinguish item type
ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'showcase';
