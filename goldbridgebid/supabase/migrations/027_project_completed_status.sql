-- Add 'completed' to the project_status enum
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'completed';
