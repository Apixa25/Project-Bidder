-- =============================================
-- RLS policies for project deletion + edit tracking
-- =============================================

-- Allow customers to delete their own projects
CREATE POLICY projects_delete ON projects
  FOR DELETE USING (auth.uid() = customer_id);

-- Allow project file deletion by project owner
CREATE POLICY project_files_delete ON project_files
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND customer_id = auth.uid())
  );

-- Allow project edits to be inserted (system-generated during updates)
CREATE POLICY project_edits_insert ON project_edits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND customer_id = auth.uid())
  );

-- Allow bid deletion to cascade properly (admin or project owner cleanup)
CREATE POLICY bids_delete_cascade ON bids
  FOR DELETE USING (
    auth.uid() = bidder_id
    OR EXISTS (SELECT 1 FROM projects WHERE id = project_id AND customer_id = auth.uid())
  );

-- Allow bid file deletion to cascade
CREATE POLICY bid_files_delete ON bid_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bids
      WHERE bids.id = bid_id
      AND (bids.bidder_id = auth.uid() OR EXISTS (
        SELECT 1 FROM projects WHERE projects.id = bids.project_id AND projects.customer_id = auth.uid()
      ))
    )
  );

-- Decrement bid count when a bid is deleted
CREATE OR REPLACE FUNCTION decrement_bid_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET bid_count = GREATEST(bid_count - 1, 0) WHERE id = OLD.project_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_bid_count_decrement
  AFTER DELETE ON bids FOR EACH ROW EXECUTE FUNCTION decrement_bid_count();
