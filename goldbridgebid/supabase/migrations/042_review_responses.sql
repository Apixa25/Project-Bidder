-- =============================================
-- Review responses
-- =============================================
-- Lets the user being reviewed (the "reviewee") post a single short response
-- attached to any review on their profile. This is the standard pattern from
-- Yelp/Google/Angi etc. — reviewers tell their story, the reviewed party
-- gets one chance to respond publicly, and visitors see both sides.
--
-- Constraints:
--   * One response per review (UNIQUE on review_id).
--   * Only the reviewee can post the response (enforced via RLS).
--   * Anyone who can see the review (status = 'published') can read the
--     response (enforced via RLS).
--   * Admins can update/delete responses for moderation.

CREATE TABLE IF NOT EXISTS review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL UNIQUE REFERENCES user_reviews(id) ON DELETE CASCADE,
  responder_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_responses_body_min_length CHECK (char_length(body) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_review_responses_review_id
  ON review_responses(review_id);

CREATE INDEX IF NOT EXISTS idx_review_responses_responder_user_id
  ON review_responses(responder_user_id);

CREATE TRIGGER tr_review_responses_updated
  BEFORE UPDATE ON review_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated who can already see the underlying review can see the
-- response. We mirror the SELECT visibility logic from user_reviews so the
-- response never appears in isolation.
CREATE POLICY review_responses_select_when_review_visible ON review_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM user_reviews ur
      WHERE ur.id = review_responses.review_id
        AND (
          ur.status = 'published'
          OR auth.uid() = ur.reviewer_user_id
          OR auth.uid() = ur.reviewee_user_id
          OR EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.role = 'admin'
          )
        )
    )
  );

-- Only the user who was reviewed can insert a response, and only on a review
-- about themselves. We match auth.uid() to user_reviews.reviewee_user_id and
-- also persist that uid as responder_user_id so we can later filter by author.
CREATE POLICY review_responses_insert_reviewee_only ON review_responses
  FOR INSERT WITH CHECK (
    auth.uid() = responder_user_id
    AND EXISTS (
      SELECT 1
      FROM user_reviews ur
      WHERE ur.id = review_responses.review_id
        AND ur.reviewee_user_id = auth.uid()
    )
  );

-- Responder can edit their own response. Admin can edit any response (for
-- moderation — e.g. trimming abusive text without nuking the whole row).
CREATE POLICY review_responses_update_own_or_admin ON review_responses
  FOR UPDATE USING (
    auth.uid() = responder_user_id
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
    )
  );

-- Responder can delete their own response (e.g. they want to retract). Admin
-- can hard-delete for moderation.
CREATE POLICY review_responses_delete_own_or_admin ON review_responses
  FOR DELETE USING (
    auth.uid() = responder_user_id
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
    )
  );
