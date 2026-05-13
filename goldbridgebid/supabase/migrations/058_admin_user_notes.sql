-- Admin-only internal notes on user records
CREATE TABLE admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_user_notes_user ON admin_user_notes(user_id);
ALTER TABLE admin_user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_user_notes_admin ON admin_user_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
  );
