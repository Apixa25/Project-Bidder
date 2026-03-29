-- =============================================
-- Dual-role foundation: user role memberships
-- =============================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

INSERT INTO user_roles (user_id, role)
SELECT user_id, role
FROM profiles
ON CONFLICT (user_id, role) DO NOTHING;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_select_own_or_admin ON user_roles
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY user_roles_insert_own ON user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_roles_delete_own_or_admin ON user_roles
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
