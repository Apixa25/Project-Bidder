-- =============================================
-- Private storage for estimator package files
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('estimate-package-files', 'estimate-package-files', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Authenticated users can upload estimate-package-files"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update estimate-package-files"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete estimate-package-files"
  ON storage.objects;

CREATE POLICY "Authenticated users can upload estimate-package-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'estimate-package-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can update estimate-package-files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'estimate-package-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can delete estimate-package-files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'estimate-package-files'
    AND auth.uid() IS NOT NULL
  );

