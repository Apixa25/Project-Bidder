CREATE TABLE IF NOT EXISTS project_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE project_questions ENABLE ROW LEVEL SECURITY;

-- Bidders can ask questions on open projects
CREATE POLICY "Bidders can insert questions"
  ON project_questions FOR INSERT
  WITH CHECK (auth.uid() = asker_id);

-- Questions are visible to anyone who can see the project (all authenticated users for open projects)
CREATE POLICY "Authenticated users can read questions"
  ON project_questions FOR SELECT
  USING (true);

-- Only the project owner can answer (update the answer field)
CREATE POLICY "Project owners can answer questions"
  ON project_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_questions.project_id
        AND projects.customer_id = auth.uid()
    )
  );

-- Admins have full access
CREATE POLICY "Admins have full access to questions"
  ON project_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
