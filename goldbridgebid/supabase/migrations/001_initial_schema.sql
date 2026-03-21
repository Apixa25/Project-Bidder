-- ============================================
-- GoldBridgeBid.com — Initial Database Schema
-- ============================================

-- Custom ENUM types
CREATE TYPE user_role AS ENUM ('customer', 'bidder', 'admin');
CREATE TYPE project_status AS ENUM ('open', 'awarded', 'closed');
CREATE TYPE trade_category AS ENUM (
  'electrical', 'plumbing', 'roofing', 'hvac', 'concrete',
  'framing', 'drywall', 'painting', 'tile', 'landscape', 'general'
);
CREATE TYPE badge_level AS ENUM ('gold', 'silver', 'bronze');
CREATE TYPE flagged_content_type AS ENUM ('project', 'bid', 'user', 'message');

-- ========== PROFILES ==========
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  full_name TEXT NOT NULL,
  business_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== BIDDER CREDENTIALS ==========
CREATE TABLE bidder_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_url TEXT,
  bond_url TEXT,
  insurance_url TEXT,
  workers_comp_url TEXT,
  ein_url TEXT,
  references_url TEXT,
  badge_level badge_level,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== PROJECTS ==========
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  completion_criteria TEXT NOT NULL,
  trades trade_category[] NOT NULL DEFAULT '{}',
  location_address TEXT NOT NULL,
  location_city TEXT NOT NULL,
  location_state TEXT NOT NULL,
  location_zip TEXT NOT NULL,
  budget_min NUMERIC(12, 2),
  budget_max NUMERIC(12, 2),
  desired_start_date DATE,
  timeline TEXT,
  status project_status NOT NULL DEFAULT 'open',
  bid_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_state ON projects(location_state);
CREATE INDEX idx_projects_trades ON projects USING GIN(trades);

-- ========== PROJECT FILES ==========
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_files_project ON project_files(project_id);

-- ========== PROJECT EDITS (audit trail) ==========
CREATE TABLE project_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_edits_project ON project_edits(project_id);

-- ========== BIDS ==========
CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade trade_category NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  price_breakdown TEXT,
  estimated_timeline TEXT NOT NULL,
  estimated_start_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bids_project ON bids(project_id);
CREATE INDEX idx_bids_bidder ON bids(bidder_id);
CREATE UNIQUE INDEX idx_bids_unique_per_trade ON bids(project_id, bidder_id, trade);

-- ========== BID FILES ==========
CREATE TABLE bid_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bid_files_bid ON bid_files(bid_id);

-- ========== MESSAGES ==========
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_project ON messages(project_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);

-- ========== NOTIFICATIONS ==========
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- ========== FLAGGED CONTENT ==========
CREATE TABLE flagged_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type flagged_content_type NOT NULL,
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flagged_unresolved ON flagged_content(resolved) WHERE resolved = false;

-- ========== FUNCTIONS ==========

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_credentials_updated
  BEFORE UPDATE ON bidder_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_projects_updated
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_bids_updated
  BEFORE UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-calculate badge level when credentials change
CREATE OR REPLACE FUNCTION calculate_badge_level()
RETURNS TRIGGER AS $$
DECLARE
  doc_count INTEGER := 0;
BEGIN
  IF NEW.license_url IS NOT NULL THEN doc_count := doc_count + 1; END IF;
  IF NEW.bond_url IS NOT NULL THEN doc_count := doc_count + 1; END IF;
  IF NEW.insurance_url IS NOT NULL THEN doc_count := doc_count + 1; END IF;
  IF NEW.workers_comp_url IS NOT NULL THEN doc_count := doc_count + 1; END IF;
  IF NEW.ein_url IS NOT NULL THEN doc_count := doc_count + 1; END IF;
  IF NEW.references_url IS NOT NULL THEN doc_count := doc_count + 1; END IF;

  IF doc_count = 6 THEN
    NEW.badge_level := 'gold';
  ELSIF doc_count >= 4 THEN
    NEW.badge_level := 'silver';
  ELSIF doc_count >= 1 THEN
    NEW.badge_level := 'bronze';
  ELSE
    NEW.badge_level := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_badge_calculation
  BEFORE INSERT OR UPDATE ON bidder_credentials
  FOR EACH ROW EXECUTE FUNCTION calculate_badge_level();

-- Auto-increment bid count on projects
CREATE OR REPLACE FUNCTION increment_bid_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects SET bid_count = bid_count + 1 WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_bid_count_increment
  AFTER INSERT ON bids FOR EACH ROW EXECUTE FUNCTION increment_bid_count();

-- ========== ROW-LEVEL SECURITY ==========

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bidder_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_content ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read any profile, but only update their own
CREATE POLICY profiles_select ON profiles FOR SELECT USING (true);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = user_id);

-- Credentials: bidders manage their own; anyone can view (for badge display)
CREATE POLICY credentials_select ON bidder_credentials FOR SELECT USING (true);
CREATE POLICY credentials_insert ON bidder_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY credentials_update ON bidder_credentials FOR UPDATE USING (auth.uid() = user_id);

-- Projects: anyone can view open projects; customers manage their own
CREATE POLICY projects_select ON projects FOR SELECT USING (true);
CREATE POLICY projects_insert ON projects FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY projects_update ON projects FOR UPDATE USING (auth.uid() = customer_id);

-- Project files: visible with the project; customer uploads
CREATE POLICY project_files_select ON project_files FOR SELECT USING (true);
CREATE POLICY project_files_insert ON project_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE id = project_id AND customer_id = auth.uid())
);

-- Project edits: visible to all (transparency); system-generated
CREATE POLICY project_edits_select ON project_edits FOR SELECT USING (true);

-- Bids: bidder sees own bids; project owner sees bids on their projects
CREATE POLICY bids_select_own ON bids FOR SELECT USING (auth.uid() = bidder_id);
CREATE POLICY bids_select_customer ON bids FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE id = project_id AND customer_id = auth.uid())
);
CREATE POLICY bids_insert ON bids FOR INSERT WITH CHECK (auth.uid() = bidder_id);
CREATE POLICY bids_update ON bids FOR UPDATE USING (auth.uid() = bidder_id);

-- Bid files: follow same rules as bids
CREATE POLICY bid_files_select ON bid_files FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bids
    WHERE bids.id = bid_id
    AND (bids.bidder_id = auth.uid() OR EXISTS (
      SELECT 1 FROM projects WHERE projects.id = bids.project_id AND projects.customer_id = auth.uid()
    ))
  )
);
CREATE POLICY bid_files_insert ON bid_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bids WHERE id = bid_id AND bidder_id = auth.uid())
);

-- Messages: only sender and receiver can see
CREATE POLICY messages_select ON messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY messages_update ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- Notifications: users see only their own
CREATE POLICY notifications_select ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Flagged content: anyone can report; only visible to reporter
CREATE POLICY flagged_insert ON flagged_content FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY flagged_select ON flagged_content FOR SELECT USING (auth.uid() = reporter_id);
