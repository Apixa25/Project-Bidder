CREATE TABLE IF NOT EXISTS bidder_saved_project_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  query_string text NOT NULL DEFAULT '',
  notify_on_new_matches boolean NOT NULL DEFAULT false,
  last_notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bidder_saved_project_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bidders can manage their own saved project searches"
  ON bidder_saved_project_searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins have full access to bidder saved searches"
  ON bidder_saved_project_searches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
