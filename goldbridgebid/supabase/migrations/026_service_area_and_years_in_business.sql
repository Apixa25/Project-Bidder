-- Add service area fields and years_in_business for bidder profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS years_in_business integer,
  ADD COLUMN IF NOT EXISTS service_radius_miles integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS available_for_work boolean DEFAULT true;

-- Service area: which states/cities a bidder is willing to serve
CREATE TABLE IF NOT EXISTS bidder_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL,
  city text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, state, city)
);

ALTER TABLE bidder_service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bidders can manage their own service areas"
  ON bidder_service_areas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service areas are publicly readable"
  ON bidder_service_areas FOR SELECT
  USING (true);

CREATE POLICY "Admins have full access to service areas"
  ON bidder_service_areas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
