export type UserRole = "customer" | "bidder" | "admin";

export type ProjectStatus = "open" | "awarded" | "closed";

export type BadgeLevel = "gold" | "silver" | "bronze" | null;

export type ReviewType = "verified_platform" | "public_reference";

export type PaidEstimateFilter = "open_to_anyone" | "core_verified_only";

export type PaidEstimatePoolStatus =
  | "funding_required"
  | "active"
  | "full"
  | "closed_settling"
  | "closed_refunded";

export type PaidEstimateClaimStatus =
  | "unpaid_bid"
  | "paid_reserved"
  | "payout_pending"
  | "paid_out"
  | "disputed"
  | "payout_denied_refunded";

export type PaidEstimateDisputeReason =
  | "blank_or_spam"
  | "wrong_trade"
  | "duplicate_submission"
  | "abusive_or_irrelevant"
  | "not_qualified_at_submission";

export type PaidEstimateDisputeReviewStatus =
  | "open"
  | "resolved_paid"
  | "resolved_denied";

export type TradeCategory =
  // Legacy values (kept for backward compatibility with existing data)
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
  | "general"
  // General licenses
  | "general_a"
  | "general_b"
  | "general_c"
  | "handyman"
  | "general_work"
  // California Specialty (C-) Contractor Classifications
  | "c2_insulation"
  | "c4_boiler"
  | "c5_framing"
  | "c6_cabinet"
  | "c7_low_voltage"
  | "c8_concrete"
  | "c10_electrical"
  | "c11_drywall"
  | "c12_earthwork"
  | "c13_fencing"
  | "c15_flooring"
  | "c16_fire_protection"
  | "c17_glazing"
  | "c20_hvac"
  | "c21_demolition"
  | "c23_ornamental_metal"
  | "c27_landscaping"
  | "c29_masonry"
  | "c31_traffic_control"
  | "c33_painting"
  | "c34_pipeline"
  | "c36_plumbing"
  | "c38_refrigeration"
  | "c39_roofing"
  | "c42_sanitation"
  | "c43_sheet_metal"
  | "c45_sign"
  | "c46_solar"
  | "c47_manufactured_housing"
  | "c50_reinforcing_steel"
  | "c51_structural_steel"
  | "c53_swimming_pool"
  | "c54_tile"
  | "c55_water_conditioning"
  | "c57_well_drilling"
  | "c60_earthquake_retrofit";

export const TRADE_LABELS: Record<TradeCategory, string> = {
  // Legacy values — display-friendly labels for any existing data
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
  // General licenses
  general_a: "General A",
  general_b: "General B",
  general_c: "General C",
  handyman: "Handyman",
  general_work: "General Work",
  // California Specialty (C-) Contractor Classifications
  c2_insulation: "Insulation and Acoustical",
  c4_boiler: "Boiler, Hot Water Heating and Steam Fitting",
  c5_framing: "Framing and Rough Carpentry",
  c6_cabinet: "Cabinet, Millwork and Finish Carpentry",
  c7_low_voltage: "Low Voltage Systems",
  c8_concrete: "Concrete",
  c10_electrical: "Electrical",
  c11_drywall: "Drywall",
  c12_earthwork: "Earthwork and Paving",
  c13_fencing: "Fencing",
  c15_flooring: "Flooring and Floor Covering",
  c16_fire_protection: "Fire Protection",
  c17_glazing: "Glazing",
  c20_hvac: "HVAC",
  c21_demolition: "Building Moving/Demolition",
  c23_ornamental_metal: "Ornamental Metal",
  c27_landscaping: "Landscaping",
  c29_masonry: "Masonry",
  c31_traffic_control: "Construction Zone Traffic Control",
  c33_painting: "Painting and Decorating",
  c34_pipeline: "Pipeline",
  c36_plumbing: "Plumbing",
  c38_refrigeration: "Refrigeration",
  c39_roofing: "Roofing",
  c42_sanitation: "Sanitation System",
  c43_sheet_metal: "Sheet Metal",
  c45_sign: "Sign",
  c46_solar: "Solar",
  c47_manufactured_housing: "General Manufactured Housing",
  c50_reinforcing_steel: "Reinforcing Steel",
  c51_structural_steel: "Structural Steel",
  c53_swimming_pool: "Swimming Pool",
  c54_tile: "Tile (Ceramic and Mosaic)",
  c55_water_conditioning: "Water Conditioning",
  c57_well_drilling: "Well Drilling",
  c60_earthquake_retrofit: "Earthquake Retrofit",
};

/**
 * Ordered list of trades shown in forms (new project, edit project, bid form).
 * General licenses first, then C-classifications in numerical order.
 */
export const FORM_TRADES: TradeCategory[] = [
  "general_a",
  "general_b",
  "general_c",
  "handyman",
  "general_work",
  "c2_insulation",
  "c4_boiler",
  "c5_framing",
  "c6_cabinet",
  "c7_low_voltage",
  "c8_concrete",
  "c10_electrical",
  "c11_drywall",
  "c12_earthwork",
  "c13_fencing",
  "c15_flooring",
  "c16_fire_protection",
  "c17_glazing",
  "c20_hvac",
  "c21_demolition",
  "c23_ornamental_metal",
  "c27_landscaping",
  "c29_masonry",
  "c31_traffic_control",
  "c33_painting",
  "c34_pipeline",
  "c36_plumbing",
  "c38_refrigeration",
  "c39_roofing",
  "c42_sanitation",
  "c43_sheet_metal",
  "c45_sign",
  "c46_solar",
  "c47_manufactured_housing",
  "c50_reinforcing_steel",
  "c51_structural_steel",
  "c53_swimming_pool",
  "c54_tile",
  "c55_water_conditioning",
  "c57_well_drilling",
  "c60_earthquake_retrofit",
];

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
  website_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  other_link_url: string | null;
  other_link_label: string | null;
  is_banned: boolean;
  banned_at: string | null;
  banned_by: string | null;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface UserRoleMembership {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export type PortfolioItemType = "showcase" | "before_after";

export interface PortfolioItem {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  thumbnail_url: string | null;
  title: string;
  description: string | null;
  item_type: PortfolioItemType;
  display_order: number;
  created_at: string;
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

export interface BidderSpecialty {
  id: string;
  user_id: string;
  trade: TradeCategory;
  display_order: number;
  created_at: string;
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
  awarded_bid_id: string | null;
  awarded_bidder_id: string | null;
  awarded_at: string | null;
  bid_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectPaidEstimatePool {
  id: string;
  project_id: string;
  is_enabled: boolean;
  filter: PaidEstimateFilter;
  reward_amount: number;
  contractor_payout_amount: number;
  platform_fee_amount: number;
  max_paid_slots: number;
  claimed_paid_slots: number;
  funded_total_amount: number;
  reserved_total_amount: number;
  paid_out_total_amount: number;
  refunded_total_amount: number;
  status: PaidEstimatePoolStatus;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  funded_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileHeart {
  id: string;
  giver_user_id: string;
  target_user_id: string;
  created_at: string;
}

export interface UserReview {
  id: string;
  review_type: ReviewType;
  reviewer_user_id: string;
  reviewee_user_id: string;
  project_id: string | null;
  rating_overall: number;
  rating_communication: number | null;
  rating_quality: number | null;
  rating_reliability: number | null;
  review_title: string | null;
  review_body: string;
  relationship_context: string | null;
  would_work_again: boolean | null;
  status: "published" | "flagged" | "hidden";
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  thumbnail_url: string | null;
  annotated_url: string | null;
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

export interface PaidEstimateClaim {
  id: string;
  project_id: string;
  pool_id: string | null;
  bid_id: string;
  bidder_id: string;
  claim_status: PaidEstimateClaimStatus;
  was_paid_eligible: boolean;
  slot_sequence: number | null;
  reward_amount: number | null;
  contractor_payout_amount: number | null;
  platform_fee_amount: number | null;
  reserved_at: string | null;
  payout_due_at: string | null;
  paid_out_at: string | null;
  denied_refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaidEstimateDispute {
  id: string;
  claim_id: string;
  project_id: string;
  bid_id: string;
  customer_id: string;
  bidder_id: string;
  reason: PaidEstimateDisputeReason;
  customer_message: string | null;
  review_status: PaidEstimateDisputeReviewStatus;
  review_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
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

export interface CustomerSavedContractorSearch {
  id: string;
  user_id: string;
  label: string;
  query_string: string;
  notify_on_new_matches: boolean;
  last_notified_at: string | null;
  created_at: string;
}

export interface FlaggedContent {
  id: string;
  reporter_id: string;
  content_type: "project" | "bid" | "user" | "message" | "review";
  content_id: string;
  reason: string;
  resolved: boolean;
  created_at: string;
}

// Insert helpers: make nullable fields and DB-defaulted fields optional
type ProfileInsert = {
  user_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  business_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  other_link_url?: string | null;
  other_link_label?: string | null;
  is_banned?: boolean;
  banned_at?: string | null;
  banned_by?: string | null;
  ban_reason?: string | null;
};

type AdminAuditLogInsert = {
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  details?: Record<string, unknown>;
};

type PortfolioItemInsert = {
  user_id: string;
  media_url: string;
  media_type: string;
  title: string;
  thumbnail_url?: string | null;
  description?: string | null;
  item_type?: PortfolioItemType;
  display_order?: number;
};

type CredentialsInsert = {
  user_id: string;
  license_url?: string | null;
  bond_url?: string | null;
  insurance_url?: string | null;
  workers_comp_url?: string | null;
  ein_url?: string | null;
  references_url?: string | null;
};

type BidderSpecialtyInsert = {
  user_id: string;
  trade: TradeCategory;
  display_order?: number;
};

type ProjectInsert = {
  customer_id: string;
  title: string;
  description: string;
  completion_criteria: string;
  trades: TradeCategory[];
  location_address: string;
  location_city: string;
  location_state: string;
  location_zip: string;
  budget_min?: number | null;
  budget_max?: number | null;
  desired_start_date?: string | null;
  timeline?: string | null;
  awarded_bid_id?: string | null;
  awarded_bidder_id?: string | null;
  awarded_at?: string | null;
};

type ProjectPaidEstimatePoolInsert = {
  project_id: string;
  reward_amount: number;
  contractor_payout_amount: number;
  platform_fee_amount: number;
  max_paid_slots: number;
  funded_total_amount: number;
  is_enabled?: boolean;
  filter?: PaidEstimateFilter;
  claimed_paid_slots?: number;
  reserved_total_amount?: number;
  paid_out_total_amount?: number;
  refunded_total_amount?: number;
  status?: PaidEstimatePoolStatus;
  stripe_payment_intent_id?: string | null;
  stripe_checkout_session_id?: string | null;
  funded_at?: string | null;
  closed_at?: string | null;
};

type BidInsert = {
  project_id: string;
  bidder_id: string;
  trade: TradeCategory;
  price: number;
  estimated_timeline: string;
  estimated_start_date: string;
  price_breakdown?: string | null;
  notes?: string | null;
};

type PaidEstimateClaimInsert = {
  project_id: string;
  bid_id: string;
  bidder_id: string;
  pool_id?: string | null;
  claim_status?: PaidEstimateClaimStatus;
  was_paid_eligible?: boolean;
  slot_sequence?: number | null;
  reward_amount?: number | null;
  contractor_payout_amount?: number | null;
  platform_fee_amount?: number | null;
  reserved_at?: string | null;
  payout_due_at?: string | null;
  paid_out_at?: string | null;
  denied_refunded_at?: string | null;
};

type PaidEstimateDisputeInsert = {
  claim_id: string;
  project_id: string;
  bid_id: string;
  customer_id: string;
  bidder_id: string;
  reason: PaidEstimateDisputeReason;
  customer_message?: string | null;
  review_status?: PaidEstimateDisputeReviewStatus;
  review_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
};

type MessageInsert = {
  project_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  file_url?: string | null;
  file_name?: string | null;
};

type NotificationInsert = {
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
};

type CustomerSavedContractorSearchInsert = {
  user_id: string;
  label: string;
  query_string?: string;
  notify_on_new_matches?: boolean;
  last_notified_at?: string | null;
};

type UserRoleMembershipInsert = {
  user_id: string;
  role: UserRole;
};

type ProfileHeartInsert = {
  giver_user_id: string;
  target_user_id: string;
};

type UserReviewInsert = {
  review_type: ReviewType;
  reviewer_user_id: string;
  reviewee_user_id: string;
  review_body: string;
  rating_overall: number;
  project_id?: string | null;
  rating_communication?: number | null;
  rating_quality?: number | null;
  rating_reliability?: number | null;
  review_title?: string | null;
  relationship_context?: string | null;
  would_work_again?: boolean | null;
  status?: "published" | "flagged" | "hidden";
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      bidder_credentials: {
        Row: BidderCredentials;
        Insert: CredentialsInsert;
        Update: Partial<CredentialsInsert>;
        Relationships: [];
      };
      bidder_specialties: {
        Row: BidderSpecialty;
        Insert: BidderSpecialtyInsert;
        Update: Partial<Omit<BidderSpecialtyInsert, "user_id">>;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: Partial<Omit<ProjectInsert, "customer_id">> & { status?: ProjectStatus };
        Relationships: [];
      };
      project_paid_estimate_pools: {
        Row: ProjectPaidEstimatePool;
        Insert: ProjectPaidEstimatePoolInsert;
        Update: Partial<Omit<ProjectPaidEstimatePoolInsert, "project_id">>;
        Relationships: [];
      };
      user_roles: {
        Row: UserRoleMembership;
        Insert: UserRoleMembershipInsert;
        Update: never;
        Relationships: [];
      };
      profile_hearts: {
        Row: ProfileHeart;
        Insert: ProfileHeartInsert;
        Update: never;
        Relationships: [];
      };
      user_reviews: {
        Row: UserReview;
        Insert: UserReviewInsert;
        Update: Partial<Omit<UserReviewInsert, "review_type" | "reviewer_user_id" | "reviewee_user_id">>;
        Relationships: [];
      };
      project_files: {
        Row: ProjectFile;
        Insert: Omit<ProjectFile, "id" | "uploaded_at" | "thumbnail_url" | "annotated_url"> & {
          thumbnail_url?: string | null;
          annotated_url?: string | null;
        };
        Update: Partial<Omit<ProjectFile, "id">>;
        Relationships: [];
      };
      project_edits: {
        Row: ProjectEdit;
        Insert: Omit<ProjectEdit, "id" | "edited_at">;
        Update: never;
        Relationships: [];
      };
      bids: {
        Row: Bid;
        Insert: BidInsert;
        Update: Partial<Omit<BidInsert, "project_id" | "bidder_id">>;
        Relationships: [];
      };
      paid_estimate_claims: {
        Row: PaidEstimateClaim;
        Insert: PaidEstimateClaimInsert;
        Update: Partial<
          Omit<PaidEstimateClaimInsert, "project_id" | "bid_id" | "bidder_id">
        >;
        Relationships: [];
      };
      paid_estimate_disputes: {
        Row: PaidEstimateDispute;
        Insert: PaidEstimateDisputeInsert;
        Update: Partial<
          Omit<
            PaidEstimateDisputeInsert,
            "claim_id" | "project_id" | "bid_id" | "customer_id" | "bidder_id" | "reason"
          >
        >;
        Relationships: [];
      };
      bid_files: {
        Row: BidFile;
        Insert: Omit<BidFile, "id" | "uploaded_at">;
        Update: Partial<Omit<BidFile, "id">>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: MessageInsert;
        Update: { read?: boolean };
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: { read?: boolean };
        Relationships: [];
      };
      customer_saved_contractor_searches: {
        Row: CustomerSavedContractorSearch;
        Insert: CustomerSavedContractorSearchInsert;
        Update: never;
        Relationships: [];
      };
      flagged_content: {
        Row: FlaggedContent;
        Insert: Omit<FlaggedContent, "id" | "created_at" | "resolved">;
        Update: { resolved?: boolean };
        Relationships: [];
      };
      portfolio_items: {
        Row: PortfolioItem;
        Insert: PortfolioItemInsert;
        Update: Partial<Omit<PortfolioItemInsert, "user_id">>;
        Relationships: [];
      };
      admin_audit_logs: {
        Row: AdminAuditLog;
        Insert: AdminAuditLogInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      project_status: ProjectStatus;
      trade_category: TradeCategory;
      review_type: ReviewType;
      paid_estimate_filter: PaidEstimateFilter;
      paid_estimate_pool_status: PaidEstimatePoolStatus;
      paid_estimate_claim_status: PaidEstimateClaimStatus;
      paid_estimate_dispute_reason: PaidEstimateDisputeReason;
    };
  };
}
