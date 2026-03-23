-- =============================================
-- Admin Management: Ban system + Audit logging
-- =============================================

-- Add ban columns to profiles
ALTER TABLE profiles
  ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN banned_at TIMESTAMPTZ,
  ADD COLUMN banned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN ban_reason TEXT;

CREATE INDEX idx_profiles_banned ON profiles(is_banned) WHERE is_banned = true;

-- Admin audit log table
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_logs_action ON admin_audit_logs(action_type);
CREATE INDEX idx_audit_logs_created ON admin_audit_logs(created_at DESC);

-- RLS for audit logs
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select_admin ON admin_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY audit_logs_insert_admin ON admin_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow admin to update profiles (for banning)
CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow admin to delete projects
CREATE POLICY projects_delete_admin ON projects
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow admin to delete bids
CREATE POLICY bids_delete_admin ON bids
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow admin to delete messages
CREATE POLICY messages_delete_admin ON messages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow admin to update projects (force close)
CREATE POLICY projects_update_admin ON projects
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
