ALTER TABLE project_ai_scope_items
  ADD COLUMN IF NOT EXISTS evidence_signals_json JSONB NOT NULL DEFAULT '[]'::jsonb;
