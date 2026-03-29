-- =============================================
-- Allow review moderation through flagged content
-- =============================================

ALTER TYPE flagged_content_type ADD VALUE IF NOT EXISTS 'review';
