-- Add severity levels to flagged content for moderation prioritization
ALTER TABLE flagged_content
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'normal'
    CHECK (severity IN ('low', 'normal', 'high', 'critical'));

CREATE INDEX idx_flagged_content_severity ON flagged_content(severity)
  WHERE resolved = false;
