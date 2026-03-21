-- Add thumbnail_url column to project_files for grid/listing previews
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
