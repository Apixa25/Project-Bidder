-- =============================================
-- Ensure estimator is available as an account role
-- =============================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'estimator';

