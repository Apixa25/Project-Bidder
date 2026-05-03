-- =============================================
-- Ensure bidder profile fields exist in live databases
-- =============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS years_in_business INTEGER,
ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS available_for_work BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
