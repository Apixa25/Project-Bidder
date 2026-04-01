INSERT INTO storage.buckets (id, name, public)
VALUES ('credential-files', 'credential-files', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;
