-- Expand item_category to support all construction types, not just modular homes.
-- Keeps all existing values so current rows remain valid.
ALTER TABLE project_ai_scope_items
  DROP CONSTRAINT IF EXISTS project_ai_scope_items_category_check;

ALTER TABLE project_ai_scope_items
  ADD CONSTRAINT project_ai_scope_items_category_check CHECK (
    item_category IN (
      -- General phases
      'site_prep',
      'demolition',
      'excavation',
      'foundation',
      'concrete',
      'masonry',
      'structural',
      'framing',
      'roofing',
      'electrical',
      'plumbing',
      'hvac',
      'insulation',
      'drywall',
      'painting',
      'flooring',
      'tile',
      'cabinetry',
      'windows_doors',
      'siding_exterior',
      'waterproofing',
      'landscaping',
      'permits_inspections',
      'cleanup',
      'materials_delivery',
      'general_labor',
      'safety',
      'finish',
      -- Legacy values kept for backward compatibility
      'utility',
      'water',
      'sewer',
      'grading',
      'drainage',
      'landscape',
      'permit',
      'delivery',
      'other'
    )
  );

-- Add customer_inclusion column so customers can confirm/deny scope items.
-- null  = not yet reviewed by customer
-- 'yes' = customer confirms this item should be included
-- 'no'  = customer says exclude this item
-- 'not_sure' = customer is unsure, keep as tentative
ALTER TABLE project_ai_scope_items
  ADD COLUMN IF NOT EXISTS customer_inclusion TEXT DEFAULT NULL;

ALTER TABLE project_ai_scope_items
  DROP CONSTRAINT IF EXISTS project_ai_scope_items_customer_inclusion_check;

ALTER TABLE project_ai_scope_items
  ADD CONSTRAINT project_ai_scope_items_customer_inclusion_check CHECK (
    customer_inclusion IS NULL
    OR customer_inclusion IN ('yes', 'no', 'not_sure')
  );

-- Store project classification on the estimate row.
ALTER TABLE project_ai_estimates
  ADD COLUMN IF NOT EXISTS project_type_key TEXT;

ALTER TABLE project_ai_estimates
  ADD COLUMN IF NOT EXISTS project_type_label TEXT;

ALTER TABLE project_ai_estimates
  ADD COLUMN IF NOT EXISTS classification_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Expand source_method to include 'llm_generated' for LLM-produced scope items.
ALTER TABLE project_ai_scope_items
  DROP CONSTRAINT IF EXISTS project_ai_scope_items_source_method_check;

ALTER TABLE project_ai_scope_items
  ADD CONSTRAINT project_ai_scope_items_source_method_check CHECK (
    source_method IN (
      'historical_bids',
      'ai_assembly',
      'budget_signal',
      'insufficient_signal',
      'manual_review',
      'llm_generated'
    )
  );
