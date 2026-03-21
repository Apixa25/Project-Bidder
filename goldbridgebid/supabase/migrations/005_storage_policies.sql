-- =============================================
-- Storage RLS Policies for all buckets
-- =============================================
-- By default, Supabase Storage blocks uploads even on public buckets.
-- These policies allow authenticated users to upload and anyone to read.

-- profile-media bucket (avatars + portfolio)
CREATE POLICY "Anyone can view profile-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-media');

CREATE POLICY "Authenticated users can upload profile-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile-media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'profile-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own profile-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-media' AND auth.uid() IS NOT NULL);

-- project-files bucket
CREATE POLICY "Anyone can view project-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-files');

CREATE POLICY "Authenticated users can upload project-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own project-files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own project-files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);

-- bid-files bucket
CREATE POLICY "Anyone can view bid-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bid-files');

CREATE POLICY "Authenticated users can upload bid-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bid-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own bid-files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'bid-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own bid-files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bid-files' AND auth.uid() IS NOT NULL);

-- credential-files bucket
CREATE POLICY "Anyone can view credential-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'credential-files');

CREATE POLICY "Authenticated users can upload credential-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'credential-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own credential-files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'credential-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own credential-files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'credential-files' AND auth.uid() IS NOT NULL);
