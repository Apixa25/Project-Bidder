ALTER TABLE project_ai_scope_items
  ADD COLUMN IF NOT EXISTS assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exclusions_json JSONB NOT NULL DEFAULT '[]'::jsonb;
