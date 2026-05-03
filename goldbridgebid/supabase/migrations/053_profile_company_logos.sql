-- =============================================
-- Contractor company logos for official quote documents
-- =============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
