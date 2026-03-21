-- Migration: Expand trade_category enum with California CSLB classifications
-- Adds General A/B/C licenses, Handyman, General Work, and all C-specialty codes.
-- Old values (electrical, plumbing, etc.) are preserved for backward compatibility.

-- General licenses
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'general_a';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'general_b';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'general_c';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'handyman';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'general_work';

-- C-2 through C-60 specialty classifications
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c2_insulation';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c4_boiler';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c5_framing';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c6_cabinet';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c7_low_voltage';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c8_concrete';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c10_electrical';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c11_drywall';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c12_earthwork';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c13_fencing';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c15_flooring';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c16_fire_protection';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c17_glazing';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c20_hvac';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c21_demolition';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c23_ornamental_metal';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c27_landscaping';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c29_masonry';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c31_traffic_control';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c33_painting';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c34_pipeline';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c36_plumbing';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c38_refrigeration';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c39_roofing';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c42_sanitation';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c43_sheet_metal';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c45_sign';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c46_solar';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c47_manufactured_housing';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c50_reinforcing_steel';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c51_structural_steel';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c53_swimming_pool';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c54_tile';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c55_water_conditioning';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c57_well_drilling';
ALTER TYPE trade_category ADD VALUE IF NOT EXISTS 'c60_earthquake_retrofit';
