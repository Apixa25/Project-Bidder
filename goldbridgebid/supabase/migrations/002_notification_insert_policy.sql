-- Allow any authenticated user to insert notifications.
-- Notifications are created server-side during actions like bid submission,
-- project award, etc., where the sender is not the notification recipient.
CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
