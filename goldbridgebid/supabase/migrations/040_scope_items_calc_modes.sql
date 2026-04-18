-- Adds per-cell calculation mode for material and labor on scope items.
-- "multiply" = per-unit price (multiply by quantity to get line total)
-- "add"      = flat fee (use as-is, do not multiply by quantity)
--
-- This lets the customer mix per-unit and flat-fee pricing in a single
-- estimate. Example: gravel pad = $47.10/ton (multiply) + $200 labor (add).

ALTER TABLE project_ai_scope_items
  ADD COLUMN IF NOT EXISTS material_calc_mode TEXT NOT NULL DEFAULT 'multiply',
  ADD COLUMN IF NOT EXISTS labor_calc_mode TEXT NOT NULL DEFAULT 'multiply';

ALTER TABLE project_ai_scope_items
  DROP CONSTRAINT IF EXISTS project_ai_scope_items_material_calc_mode_check;

ALTER TABLE project_ai_scope_items
  ADD CONSTRAINT project_ai_scope_items_material_calc_mode_check
  CHECK (material_calc_mode IN ('multiply', 'add'));

ALTER TABLE project_ai_scope_items
  DROP CONSTRAINT IF EXISTS project_ai_scope_items_labor_calc_mode_check;

ALTER TABLE project_ai_scope_items
  ADD CONSTRAINT project_ai_scope_items_labor_calc_mode_check
  CHECK (labor_calc_mode IN ('multiply', 'add'));
