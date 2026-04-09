ALTER TABLE project_ai_scope_items
  ADD COLUMN IF NOT EXISTS quantity_drivers_json JSONB NOT NULL DEFAULT '[]'::jsonb;
