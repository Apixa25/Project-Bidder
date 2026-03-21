export type UserRole = "customer" | "bidder" | "admin";

export type ProjectStatus = "open" | "awarded" | "closed";

export type BadgeLevel = "gold" | "silver" | "bronze" | null;

export type TradeCategory =
  | "electrical"
  | "plumbing"
  | "roofing"
  | "hvac"
  | "concrete"
  | "framing"
  | "drywall"
  | "painting"
  | "tile"
  | "landscape"
  | "general";

export const TRADE_LABELS: Record<TradeCategory, string> = {
  electrical: "Electrical",
  plumbing: "Plumbing",
  roofing: "Roofing",
  hvac: "HVAC",
  concrete: "Concrete",
  framing: "Framing",
  drywall: "Drywall",
  painting: "Painting",
  tile: "Tile",
  landscape: "Landscape",
  general: "General Work",
};

export interface Profile {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string;
  business_name: string | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BidderCredentials {
  id: string;
  user_id: string;
  license_url: string | null;
  bond_url: string | null;
  insurance_url: string | null;
  workers_comp_url: string | null;
  ein_url: string | null;
  references_url: string | null;
  badge_level: BadgeLevel;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  customer_id: string;
  title: string;
  description: string;
  completion_criteria: string;
  trades: TradeCategory[];
  location_address: string;
  location_city: string;
  location_state: string;
  location_zip: string;
  budget_min: number | null;
  budget_max: number | null;
  desired_start_date: string | null;
  timeline: string | null;
  status: ProjectStatus;
  bid_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
}

export interface ProjectEdit {
  id: string;
  project_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  edited_at: string;
}

export interface Bid {
  id: string;
  project_id: string;
  bidder_id: string;
  trade: TradeCategory;
  price: number;
  price_breakdown: string | null;
  estimated_timeline: string;
  estimated_start_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BidFile {
  id: string;
  bid_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
}

export interface Message {
  id: string;
  project_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
  read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface FlaggedContent {
  id: string;
  reporter_id: string;
  content_type: "project" | "bid" | "user" | "message";
  content_id: string;
  reason: string;
  resolved: boolean;
  created_at: string;
}

// Supabase generated types placeholder
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      bidder_credentials: {
        Row: BidderCredentials;
        Insert: Omit<BidderCredentials, "id" | "created_at" | "updated_at" | "badge_level">;
        Update: Partial<Omit<BidderCredentials, "id" | "created_at">>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "updated_at" | "bid_count" | "status">;
        Update: Partial<Omit<Project, "id" | "created_at" | "customer_id">>;
      };
      project_files: {
        Row: ProjectFile;
        Insert: Omit<ProjectFile, "id" | "uploaded_at">;
        Update: Partial<Omit<ProjectFile, "id">>;
      };
      project_edits: {
        Row: ProjectEdit;
        Insert: Omit<ProjectEdit, "id" | "edited_at">;
        Update: never;
      };
      bids: {
        Row: Bid;
        Insert: Omit<Bid, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Bid, "id" | "created_at" | "project_id" | "bidder_id">>;
      };
      bid_files: {
        Row: BidFile;
        Insert: Omit<BidFile, "id" | "uploaded_at">;
        Update: Partial<Omit<BidFile, "id">>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at" | "read">;
        Update: Partial<Pick<Message, "read">>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at" | "read">;
        Update: Partial<Pick<Notification, "read">>;
      };
      flagged_content: {
        Row: FlaggedContent;
        Insert: Omit<FlaggedContent, "id" | "created_at" | "resolved">;
        Update: Partial<Pick<FlaggedContent, "resolved">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      project_status: ProjectStatus;
      trade_category: TradeCategory;
    };
  };
}
