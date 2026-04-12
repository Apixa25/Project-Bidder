-- Add expertise_level column to projects table
-- Replaces the customer-facing "trades required" concept with a simpler
-- "what level of professional do you want?" question.
-- The trades column is kept for backward compatibility and bidder-side use.

ALTER TABLE projects
  ADD COLUMN expertise_level TEXT
  CHECK (expertise_level IN ('licensed_contractor', 'handyman', 'general_labor'));
