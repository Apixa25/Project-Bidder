CREATE TABLE IF NOT EXISTS project_ai_scope_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  item_category TEXT NOT NULL DEFAULT 'other',
  required_status TEXT NOT NULL DEFAULT 'unknown',
  confidence_level TEXT NOT NULL DEFAULT 'low',
  description TEXT,
  why_it_may_apply TEXT,
  confidence_reason TEXT,
  estimated_low NUMERIC(12, 2),
  estimated_high NUMERIC(12, 2),
  labor_low NUMERIC(12, 2),
  labor_high NUMERIC(12, 2),
  material_low NUMERIC(12, 2),
  material_high NUMERIC(12, 2),
  equipment_low NUMERIC(12, 2),
  equipment_high NUMERIC(12, 2),
  source_method TEXT NOT NULL DEFAULT 'insufficient_signal',
  needs_clarification BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_ai_scope_items_unique_key UNIQUE (project_id, item_key),
  CONSTRAINT project_ai_scope_items_category_check CHECK (
    item_category IN (
      'site_prep',
      'utility',
      'electrical',
      'water',
      'sewer',
      'grading',
      'drainage',
      'foundation',
      'delivery',
      'permit',
      'finish',
      'demolition',
      'landscape',
      'other'
    )
  ),
  CONSTRAINT project_ai_scope_items_required_status_check CHECK (
    required_status IN ('required', 'likely', 'possible', 'unknown')
  ),
  CONSTRAINT project_ai_scope_items_confidence_check CHECK (
    confidence_level IN ('low', 'medium', 'high')
  ),
  CONSTRAINT project_ai_scope_items_source_method_check CHECK (
    source_method IN (
      'historical_bids',
      'ai_assembly',
      'budget_signal',
      'insufficient_signal',
      'manual_review'
    )
  )
);

CREATE TABLE IF NOT EXISTS project_ai_item_clarifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_item_id UUID NOT NULL REFERENCES project_ai_scope_items(id) ON DELETE CASCADE,
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
  CONSTRAINT project_ai_item_clarifications_unique_key UNIQUE (scope_item_id, question_key),
  CONSTRAINT project_ai_item_clarifications_status_check CHECK (
    status IN ('pending', 'answered', 'dismissed')
  ),
  CONSTRAINT project_ai_item_clarifications_type_check CHECK (
    question_type IN ('single_select', 'multi_select', 'number', 'text', 'upload_request')
  ),
  CONSTRAINT project_ai_item_clarifications_asked_by_check CHECK (
    asked_by IN ('ai', 'admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_project_ai_scope_items_project_display
  ON project_ai_scope_items(project_id, display_order);

CREATE INDEX IF NOT EXISTS idx_project_ai_scope_items_project_category
  ON project_ai_scope_items(project_id, item_category);

CREATE INDEX IF NOT EXISTS idx_project_ai_item_clarifications_project_display
  ON project_ai_item_clarifications(project_id, display_order);

CREATE INDEX IF NOT EXISTS idx_project_ai_item_clarifications_scope_item
  ON project_ai_item_clarifications(scope_item_id, display_order);

DROP TRIGGER IF EXISTS update_project_ai_scope_items_updated_at
  ON project_ai_scope_items;

CREATE TRIGGER update_project_ai_scope_items_updated_at
  BEFORE UPDATE ON project_ai_scope_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_project_ai_item_clarifications_updated_at
  ON project_ai_item_clarifications;

CREATE TRIGGER update_project_ai_item_clarifications_updated_at
  BEFORE UPDATE ON project_ai_item_clarifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_ai_scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_ai_item_clarifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_ai_scope_items_select_owner
  ON project_ai_scope_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_scope_items.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_scope_items_insert_owner
  ON project_ai_scope_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_scope_items.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_scope_items_update_owner
  ON project_ai_scope_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_scope_items.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_item_clarifications_select_owner
  ON project_ai_item_clarifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_item_clarifications.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_item_clarifications_insert_owner
  ON project_ai_item_clarifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_item_clarifications.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_item_clarifications_update_owner
  ON project_ai_item_clarifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_ai_item_clarifications.project_id
        AND projects.customer_id = auth.uid()
    )
  );

CREATE POLICY project_ai_scope_items_admin_all
  ON project_ai_scope_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY project_ai_item_clarifications_admin_all
  ON project_ai_item_clarifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
