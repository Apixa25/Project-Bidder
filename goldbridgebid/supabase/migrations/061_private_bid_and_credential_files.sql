-- Private bid packets and credential documents.
--
-- Apply this yourself when you are ready. Do not run it from CI.
-- From goldbridgebid/, with the Supabase CLI linked to the project you
-- intend to change:
--
--   npx supabase db push
--
-- Or paste this file into the Supabase SQL editor for that project.
-- This file is not applied by opening the pull request.
--
-- Project photos stay on the project-files bucket. This migration only
-- changes bid-files and credential-files.
--
-- Existing rows store either a public object URL or, after the app
-- change in this same release, a storage path. The app signs whichever
-- form it finds. After this migration, the old public URL stops working
-- and the signed URL is what opens the file.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('bid-files', 'bid-files', false),
  ('credential-files', 'credential-files', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

DROP POLICY IF EXISTS "Anyone can view bid-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload bid-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own bid-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own bid-files" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view credential-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload credential-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own credential-files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own credential-files" ON storage.objects;

-- Bid packets live at bids/{bid_id}/file.
-- The bidder who owns that bid, the customer on that project, and an
-- admin may read. Only the owning bidder (or an admin) may write.

CREATE POLICY "Read own or customer bid-files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bid-files'
    AND (
      public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.bids AS bid
        JOIN public.projects AS project ON project.id = bid.project_id
        WHERE bid.id::text = (storage.foldername(name))[2]
          AND (
            bid.bidder_id = auth.uid()
            OR project.customer_id = auth.uid()
          )
      )
    )
  );

CREATE POLICY "Upload own bid-files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bid-files'
    AND (
      public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.bids AS bid
        WHERE bid.id::text = (storage.foldername(name))[2]
          AND bid.bidder_id = auth.uid()
      )
    )
  );

CREATE POLICY "Update own bid-files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bid-files'
    AND (
      public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.bids AS bid
        WHERE bid.id::text = (storage.foldername(name))[2]
          AND bid.bidder_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    bucket_id = 'bid-files'
    AND (
      public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.bids AS bid
        WHERE bid.id::text = (storage.foldername(name))[2]
          AND bid.bidder_id = auth.uid()
      )
    )
  );

CREATE POLICY "Delete own bid-files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bid-files'
    AND (
      public.is_platform_admin()
      OR EXISTS (
        SELECT 1
        FROM public.bids AS bid
        WHERE bid.id::text = (storage.foldername(name))[2]
          AND bid.bidder_id = auth.uid()
      )
    )
  );

-- Credential documents live at credentials/{user_id}/file.
-- The owner, an admin, and a customer who has a bid from that
-- contractor may read. Only the owner (or an admin) may write.

CREATE POLICY "Read own or reviewing-customer credential-files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'credential-files'
    AND (
      public.is_platform_admin()
      OR (storage.foldername(name))[2] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.bids AS bid
        JOIN public.projects AS project ON project.id = bid.project_id
        WHERE bid.bidder_id::text = (storage.foldername(name))[2]
          AND project.customer_id = auth.uid()
      )
    )
  );

CREATE POLICY "Upload own credential-files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'credential-files'
    AND (
      public.is_platform_admin()
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );

CREATE POLICY "Update own credential-files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'credential-files'
    AND (
      public.is_platform_admin()
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'credential-files'
    AND (
      public.is_platform_admin()
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );

CREATE POLICY "Delete own credential-files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'credential-files'
    AND (
      public.is_platform_admin()
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );
