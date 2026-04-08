CREATE TABLE IF NOT EXISTS project_ai_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'insufficient_data',
  scope_completeness_score INTEGER NOT NULL DEFAULT 0,
  confidence_level TEXT NOT NULL DEFAULT 'low',
  baseline_low NUMERIC(12, 2),
  baseline_high NUMERIC(12, 2),
  summary TEXT,
  assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  trade_breakdown_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_source_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis_version TEXT NOT NULL DEFAULT 'v1-rules',
  stale_after_edit BOOLEAN NOT NULL DEFAULT false,
  published_to_bidders BOOLEAN NOT NULL DEFAULT false,
  last_analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_ai_estimates_status_check CHECK (
    status IN ('insufficient_data', 'needs_clarification', 'ready', 'stale')
  ),
  CONSTRAINT project_ai_estimates_confidence_check CHECK (
    confidence_level IN ('low', 'medium', 'high')
  ),
  CONSTRAINT project_ai_estimates_score_check CHECK (
    scope_completeness_score >= 0 AND scope_completeness_score <= 100
  )
);

CREATE TABLE IF NOT EXISTS project_ai_clarifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  help_text TEXT,
  placeholder TEXT,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_value_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  asked_by TEXT NOT NULL DEFAULT 'ai',
  display_order INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_ai_clarifications_unique_key UNIQUE (project_id, question_key),
  CONSTRAINT project_ai_clarifications_status_check CHECK (
    status IN ('pending', 'answered', 'dismissed')
  ),
  CONSTRAINT project_ai_clarifications_type_check CHECK (
    question_type IN ('single_select', 'multi_select', 'number', 'text', 'upload_request')
  ),
  CONSTRAINT project_ai_clarifications_asked_by_check CHECK (
    asked_by IN ('ai', 'admin')
  )
);

CREATE TABLE IF NOT EXISTS project_ai_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  input_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_name TEXT NOT NULL DEFAULT 'v1-rules',
  duration_ms INTEGER,
  succeeded BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_ai_analysis_runs_trigger_check CHECK (
    trigger_type IN ('create', 'edit', 'manual_refresh', 'clarification_answered')
  )
);

CREATE INDEX IF NOT EXISTS idx_project_ai_clarifications_project_display
  ON project_ai_clarifications(project_id, display_order);

CREATE INDEX IF NOT EXISTS idx_project_ai_analysis_runs_project_created
  ON project_ai_analysis_runs(project_id, created_at DESC);

DROP TRIGGER IF EXISTS update_project_ai_estimates_updated_at
  ON project_ai_estimates;

CREATE TRIGGER update_project_ai_estimates_updated_at
  BEFORE UPDATE ON project_ai_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_project_ai_clarifications_updated_at
  ON project_ai_clarifications;

CREATE TRIGGER update_project_ai_clarifications_updated_at
  BEFORE UPDATE ON project_ai_clarifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_ai_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_ai_clarifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_ai_analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_ai_estimates_select_owner
  ON project_ai_estimates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_estimates.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_estimates_select_published_bidder
  ON project_ai_estimates FOR SELECT
  USING (
    published_to_bidders = true
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_estimates.project_id
    )
  );

CREATE POLICY project_ai_estimates_insert_owner
  ON project_ai_estimates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_estimates.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_estimates_update_owner
  ON project_ai_estimates FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_estimates.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_clarifications_select_owner
  ON project_ai_clarifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_clarifications.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_clarifications_insert_owner
  ON project_ai_clarifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_clarifications.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_clarifications_update_owner
  ON project_ai_clarifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_clarifications.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_analysis_runs_select_owner
  ON project_ai_analysis_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_analysis_runs.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_analysis_runs_insert_owner
  ON project_ai_analysis_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_analysis_runs.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_estimates_admin_all
  ON project_ai_estimates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY project_ai_clarifications_admin_all
  ON project_ai_clarifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY project_ai_analysis_runs_admin_all
  ON project_ai_analysis_runs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
