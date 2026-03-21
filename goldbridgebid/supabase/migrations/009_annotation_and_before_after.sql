-- Photo annotation: store annotated image URL on project files
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS annotated_url TEXT;

-- Before/after portfolio items: distinguish item type
ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'showcase';
