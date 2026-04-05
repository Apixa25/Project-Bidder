CREATE TABLE IF NOT EXISTS review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES user_reviews(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  display_order integer DEFAULT 0,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE review_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Review photos are publicly readable"
  ON review_photos FOR SELECT
  USING (true);

CREATE POLICY "Review owners can insert photos"
  ON review_photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_reviews
      WHERE user_reviews.id = review_photos.review_id
        AND user_reviews.reviewer_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins have full access to review photos"
  ON review_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
