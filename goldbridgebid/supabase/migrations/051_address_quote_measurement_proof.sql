-- =============================================
-- Address quote measurement proof screenshots + linear measurements
-- =============================================

ALTER TABLE address_quotes
ADD COLUMN IF NOT EXISTS map_snapshot_url TEXT;

ALTER TABLE address_quote_measurements
ADD COLUMN IF NOT EXISTS length_ft NUMERIC(12, 2);

INSERT INTO storage.buckets (id, name, public)
VALUES ('address-quote-snapshots', 'address-quote-snapshots', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public can view address quote snapshots"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload address quote snapshots"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update address quote snapshots"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete address quote snapshots"
  ON storage.objects;

CREATE POLICY "Public can view address quote snapshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'address-quote-snapshots');

CREATE POLICY "Authenticated users can upload address quote snapshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'address-quote-snapshots'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can update address quote snapshots"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'address-quote-snapshots'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can delete address quote snapshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'address-quote-snapshots'
    AND auth.uid() IS NOT NULL
  );
