ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS display_order INTEGER;

WITH ranked_project_files AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id
      ORDER BY uploaded_at ASC, id ASC
    ) - 1 AS next_display_order
  FROM project_files
)
UPDATE project_files AS target
SET display_order = ranked_project_files.next_display_order
FROM ranked_project_files
WHERE target.id = ranked_project_files.id
  AND target.display_order IS NULL;

UPDATE project_files
SET display_order = 0
WHERE display_order IS NULL;

ALTER TABLE project_files
ALTER COLUMN display_order SET DEFAULT 0;

ALTER TABLE project_files
ALTER COLUMN display_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_files_project_display_order
ON project_files(project_id, display_order);
