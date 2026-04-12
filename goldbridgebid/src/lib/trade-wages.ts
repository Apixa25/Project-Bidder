/**
 * Internal union / prevailing-wage sheet for all trades.
 *
 * Rates are based on California DIR prevailing wages (journeyman level)
 * and represent *fully burdened* hourly costs — base pay + fringes + taxes.
 * They intentionally sit at the top of the labor-cost range so that AI
 * estimates are conservative (a real bid can only come in equal or lower).
 *
 * Per DESIGN_PRINCIPLES.md: we never search the internet at runtime for
 * wage data. This static sheet is the single source of truth. Update it
 * periodically (annually) as DIR publishes new determinations.
 *
 * Last reviewed: April 2026 (2025-2026 DIR General Prevailing Wage
 * Determinations, Southern California residential/commercial).
 */

import type { TradeCategory } from "@/types/database";

export interface TradeWageEntry {
  /** Fully burdened hourly rate ($/hr) — base + fringes + taxes. */
  hourly_rate: number;
  /** Short label for display (e.g. "Journeyman Electrician"). */
  role_label: string;
  /** Where this rate came from — always "ca_dir_prevailing" for now. */
  source: "ca_dir_prevailing";
}

/**
 * Wage entries keyed by TradeCategory.
 *
 * Legacy categories map to the closest specialty classification.
 * General license tiers use a blended GC rate.
 * Handyman / general_work use a lower residential rate since they
 * typically don't hold a specialty license.
 */
export const TRADE_WAGES: Partial<Record<TradeCategory, TradeWageEntry>> = {
  // ── General licenses ──────────────────────────────────────────────
  general_a:     { hourly_rate: 95, role_label: "General Engineering Contractor", source: "ca_dir_prevailing" },
  general_b:     { hourly_rate: 90, role_label: "General Building Contractor",    source: "ca_dir_prevailing" },
  general_c:     { hourly_rate: 85, role_label: "Specialty Contractor (General)", source: "ca_dir_prevailing" },
  handyman:      { hourly_rate: 65, role_label: "Licensed Handyman",              source: "ca_dir_prevailing" },
  general_work:  { hourly_rate: 65, role_label: "General Laborer",                source: "ca_dir_prevailing" },

  // ── Legacy values (alias to specialty rate) ───────────────────────
  electrical:  { hourly_rate: 105, role_label: "Journeyman Electrician",    source: "ca_dir_prevailing" },
  plumbing:    { hourly_rate: 100, role_label: "Journeyman Plumber",        source: "ca_dir_prevailing" },
  roofing:     { hourly_rate: 78,  role_label: "Journeyman Roofer",         source: "ca_dir_prevailing" },
  hvac:        { hourly_rate: 98,  role_label: "HVAC Mechanic",             source: "ca_dir_prevailing" },
  concrete:    { hourly_rate: 82,  role_label: "Cement Mason",              source: "ca_dir_prevailing" },
  framing:     { hourly_rate: 80,  role_label: "Journeyman Carpenter",      source: "ca_dir_prevailing" },
  drywall:     { hourly_rate: 78,  role_label: "Drywall Installer/Finisher",source: "ca_dir_prevailing" },
  painting:    { hourly_rate: 72,  role_label: "Journeyman Painter",        source: "ca_dir_prevailing" },
  tile:        { hourly_rate: 80,  role_label: "Tile Setter",               source: "ca_dir_prevailing" },
  landscape:   { hourly_rate: 62,  role_label: "Landscape Laborer",         source: "ca_dir_prevailing" },
  general:     { hourly_rate: 65,  role_label: "General Laborer",           source: "ca_dir_prevailing" },

  // ── California Specialty (C-) Classifications ─────────────────────
  c2_insulation:         { hourly_rate: 85,  role_label: "Insulation Worker",               source: "ca_dir_prevailing" },
  c4_boiler:             { hourly_rate: 105, role_label: "Boilermaker",                      source: "ca_dir_prevailing" },
  c5_framing:            { hourly_rate: 80,  role_label: "Journeyman Carpenter",             source: "ca_dir_prevailing" },
  c6_cabinet:            { hourly_rate: 80,  role_label: "Millwright / Finish Carpenter",    source: "ca_dir_prevailing" },
  c7_low_voltage:        { hourly_rate: 90,  role_label: "Low Voltage Technician",           source: "ca_dir_prevailing" },
  c8_concrete:           { hourly_rate: 82,  role_label: "Cement Mason",                     source: "ca_dir_prevailing" },
  c10_electrical:        { hourly_rate: 105, role_label: "Journeyman Electrician",           source: "ca_dir_prevailing" },
  c11_drywall:           { hourly_rate: 78,  role_label: "Drywall Installer/Finisher",       source: "ca_dir_prevailing" },
  c12_earthwork:         { hourly_rate: 88,  role_label: "Operating Engineer",               source: "ca_dir_prevailing" },
  c13_fencing:           { hourly_rate: 72,  role_label: "Fence Installer",                  source: "ca_dir_prevailing" },
  c15_flooring:          { hourly_rate: 78,  role_label: "Floor Layer",                      source: "ca_dir_prevailing" },
  c16_fire_protection:   { hourly_rate: 100, role_label: "Sprinkler Fitter",                 source: "ca_dir_prevailing" },
  c17_glazing:           { hourly_rate: 82,  role_label: "Glazier",                          source: "ca_dir_prevailing" },
  c20_hvac:              { hourly_rate: 98,  role_label: "HVAC Mechanic",                    source: "ca_dir_prevailing" },
  c21_demolition:        { hourly_rate: 72,  role_label: "Laborer (Demolition)",             source: "ca_dir_prevailing" },
  c23_ornamental_metal:  { hourly_rate: 90,  role_label: "Ornamental Ironworker",            source: "ca_dir_prevailing" },
  c27_landscaping:       { hourly_rate: 62,  role_label: "Landscape Laborer",                source: "ca_dir_prevailing" },
  c29_masonry:           { hourly_rate: 82,  role_label: "Bricklayer / Mason",               source: "ca_dir_prevailing" },
  c31_traffic_control:   { hourly_rate: 68,  role_label: "Traffic Control Laborer",          source: "ca_dir_prevailing" },
  c33_painting:          { hourly_rate: 72,  role_label: "Journeyman Painter",               source: "ca_dir_prevailing" },
  c34_pipeline:          { hourly_rate: 95,  role_label: "Pipeline Fitter",                  source: "ca_dir_prevailing" },
  c36_plumbing:          { hourly_rate: 100, role_label: "Journeyman Plumber",               source: "ca_dir_prevailing" },
  c38_refrigeration:     { hourly_rate: 98,  role_label: "Refrigeration Mechanic",           source: "ca_dir_prevailing" },
  c39_roofing:           { hourly_rate: 78,  role_label: "Journeyman Roofer",                source: "ca_dir_prevailing" },
  c42_sanitation:        { hourly_rate: 88,  role_label: "Sanitation System Installer",      source: "ca_dir_prevailing" },
  c43_sheet_metal:       { hourly_rate: 95,  role_label: "Sheet Metal Worker",               source: "ca_dir_prevailing" },
  c45_sign:              { hourly_rate: 75,  role_label: "Sign Installer",                   source: "ca_dir_prevailing" },
  c46_solar:             { hourly_rate: 92,  role_label: "Solar Installer / Electrician",    source: "ca_dir_prevailing" },
  c47_manufactured_housing: { hourly_rate: 75, role_label: "Manufactured Housing Installer", source: "ca_dir_prevailing" },
  c50_reinforcing_steel: { hourly_rate: 95,  role_label: "Ironworker (Reinforcing)",         source: "ca_dir_prevailing" },
  c51_structural_steel:  { hourly_rate: 98,  role_label: "Ironworker (Structural)",          source: "ca_dir_prevailing" },
  c53_swimming_pool:     { hourly_rate: 78,  role_label: "Swimming Pool Installer",          source: "ca_dir_prevailing" },
  c54_tile:              { hourly_rate: 80,  role_label: "Tile Setter",                      source: "ca_dir_prevailing" },
  c55_water_conditioning:{ hourly_rate: 78,  role_label: "Water Conditioning Installer",     source: "ca_dir_prevailing" },
  c57_well_drilling:     { hourly_rate: 88,  role_label: "Well Driller",                     source: "ca_dir_prevailing" },
  c60_earthquake_retrofit:{ hourly_rate: 85, role_label: "Earthquake Retrofit Specialist",   source: "ca_dir_prevailing" },
};

const DEFAULT_PROFESSIONAL_RATE: TradeWageEntry = {
  hourly_rate: 85,
  role_label: "Licensed Professional (General)",
  source: "ca_dir_prevailing",
};

/**
 * Returns the wage entry for a trade. Falls back to a conservative
 * default if the trade isn't in the sheet.
 */
export function getTradeWage(trade: TradeCategory | string): TradeWageEntry {
  return TRADE_WAGES[trade as TradeCategory] ?? DEFAULT_PROFESSIONAL_RATE;
}

/**
 * Returns the single highest hourly rate across a set of trades.
 * Use this for a unified project estimate that defaults to the
 * most expensive professional rate.
 */
export function getMaxTradeWage(
  trades: (TradeCategory | string)[]
): TradeWageEntry {
  if (trades.length === 0) return DEFAULT_PROFESSIONAL_RATE;

  let best = DEFAULT_PROFESSIONAL_RATE;
  for (const t of trades) {
    const entry = getTradeWage(t);
    if (entry.hourly_rate > best.hourly_rate) {
      best = entry;
    }
  }
  return best;
}
