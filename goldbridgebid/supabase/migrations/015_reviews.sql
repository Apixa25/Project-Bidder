-- =============================================
-- Reputation reviews: verified platform + public
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'review_type'
  ) THEN
    CREATE TYPE review_type AS ENUM ('verified_platform', 'public_reference');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_type review_type NOT NULL,
  reviewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_communication INTEGER CHECK (rating_communication BETWEEN 1 AND 5),
  rating_quality INTEGER CHECK (rating_quality BETWEEN 1 AND 5),
  rating_reliability INTEGER CHECK (rating_reliability BETWEEN 1 AND 5),
  review_title TEXT,
  review_body TEXT NOT NULL,
  relationship_context TEXT,
  would_work_again BOOLEAN,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_reviews_no_self CHECK (reviewer_user_id <> reviewee_user_id),
  CONSTRAINT user_reviews_status_valid CHECK (status IN ('published', 'flagged', 'hidden')),
  CONSTRAINT user_reviews_verified_requires_project CHECK (
    (review_type = 'verified_platform' AND project_id IS NOT NULL)
    OR
    (review_type = 'public_reference' AND project_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_user_reviews_reviewee_user_id
  ON user_reviews(reviewee_user_id);

CREATE INDEX IF NOT EXISTS idx_user_reviews_reviewer_user_id
  ON user_reviews(reviewer_user_id);

CREATE INDEX IF NOT EXISTS idx_user_reviews_project_id
  ON user_reviews(project_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reviews_verified_unique
  ON user_reviews(project_id, reviewer_user_id, reviewee_user_id)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reviews_public_unique
  ON user_reviews(reviewer_user_id, reviewee_user_id, review_type)
  WHERE review_type = 'public_reference';

CREATE TRIGGER tr_user_reviews_updated
  BEFORE UPDATE ON user_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_reviews_select_public_or_owner_or_admin ON user_reviews
  FOR SELECT USING (
    status = 'published'
    OR auth.uid() = reviewer_user_id
    OR auth.uid() = reviewee_user_id
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY user_reviews_insert_own ON user_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_user_id
    AND reviewer_user_id <> reviewee_user_id
  );

CREATE POLICY user_reviews_update_own_or_admin ON user_reviews
  FOR UPDATE USING (
    auth.uid() = reviewer_user_id
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY user_reviews_delete_own_or_admin ON user_reviews
  FOR DELETE USING (
    auth.uid() = reviewer_user_id
    OR EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
