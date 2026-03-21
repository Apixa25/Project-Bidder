-- Admin can view all flagged content
CREATE POLICY flagged_select_admin ON flagged_content
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can resolve flagged content
CREATE POLICY flagged_update_admin ON flagged_content
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can view all bids (for the admin dashboard)
CREATE POLICY bids_select_admin ON bids
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can view all messages (for moderation)
CREATE POLICY messages_select_admin ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
