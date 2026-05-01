/**
 * Parser for the 2023 National Construction Estimator (Craftsman Book Company).
 *
 * Reads the TXT export and produces a structured JSON file containing every
 * parseable cost line item with: section, description, craft code, manhours,
 * unit, material cost, labor cost, equipment cost, and total cost.
 *
 * Usage:  node scripts/parse-craftsman-nce.mjs
 * Output: data/craftsman-nce-parsed.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = join(__dirname, "..", "data", "2023-National-Construction-Estimator-eBook.txt");
const OUTPUT = join(__dirname, "..", "data", "craftsman-nce-parsed.json");

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

// Matches a cost data line with a real craft code: "B4@.034"
const CRAFT_DATA_RE =
  /^(.+?)\s{2,}([A-Z][A-Z0-9]{0,3})@([\d.]+)\s{2,}(\S+)\s+(.*)/;

// Matches a material-only or subcontract line with dash craft: "—  Ea  1.80  —  1.80"
const DASH_CRAFT_RE =
  /^(.+?)\s{2,}(?:—|ï)\s{2,}(\S+)\s+(.*)/;

// Matches a percentage-based add/deduct line: "—  %  -10  —  —"
const PCT_LINE_RE = /^(.+?)\s{2,}(?:—|ï)\s+%/;

// Column header line for detecting Equipment column presence
const COLUMN_HEADER_RE = /Craft@Hrs\s+Unit\s+Material\s+Labor/i;
const HAS_EQUIPMENT_RE = /Equipment/i;

// Page number lines
const PAGE_NUMBER_RE = /^\s*\d{1,3}\s*$/;

// Lines that are mostly garbled (PDF conversion artifact)
const GARBLED_LINE_RE = /[A-Z][a-z]{2,}[A-Z][a-z]/;

// Recognizable unit abbreviations
const VALID_UNITS = new Set([
  "Ea", "LF", "SF", "SY", "CF", "CY", "MBF", "MSF", "CSF",
  "Gal", "Lb", "Ton", "LS", "Hr", "Day", "Mo", "Yr", "Wk",
  "Roll", "Bag", "MBM", "Sq", "CLF", "BF", "VLF",
  "M$", "Pcs", "Set", "Job", "%",
]);

// Skip front matter (first ~1090 lines) and track I&C division start
const DATA_START_LINE = 1090;
const IC_DIVISION_START_LINE = 17700; // "Industrial and Commercial Division" appears ~line 17703

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCostValue(s) {
  if (!s || s === "—" || s === "ï" || s.includes("ï")) return null;
  const cleaned = s.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function extractCostValues(raw) {
  const values = [];
  let m;
  // Matches: "1,500.00", "3.72", ".61" (no leading digit), "—", garbled dash
  const re = /[\d,]*\.\d{1,2}(?!\d)|—|ï/g;
  while ((m = re.exec(raw)) !== null) {
    values.push(parseCostValue(m[0]));
  }
  return values;
}

function assignCosts(values, hasEquipment) {
  if (hasEquipment) {
    return {
      material: values[0] ?? null,
      labor: values[1] ?? null,
      equipment: values[2] ?? null,
      total: values[3] ?? null,
    };
  }
  return {
    material: values[0] ?? null,
    labor: values[1] ?? null,
    equipment: null,
    total: values[2] ?? null,
  };
}

function isValidUnit(u) {
  return VALID_UNITS.has(u);
}

function isSectionHeader(line, nextLines) {
  const t = line.trim();
  if (!t || t.length < 3 || t.length > 80) return false;
  if (PAGE_NUMBER_RE.test(t)) return false;
  if (GARBLED_LINE_RE.test(t)) return false;
  if (/Craft@Hrs/i.test(t)) return false;
  if (/^\d/.test(t) && !/^\d{2}\s+[A-Z]/.test(t)) return false;
  if (t.startsWith("Add ") || t.startsWith("Deduct ")) return false;
  if (t.startsWith("Using ") || t.startsWith("Labor ")) return false;

  // Must be mostly capital-led words
  if (!/^[A-Z]/.test(t)) return false;

  // Should not contain cost-like patterns
  if (/\$[\d,]+|\d+\.\d{2}/.test(t)) return false;

  // Should not contain craft code patterns
  if (/[A-Z]{1,2}\d?@[\d.]/.test(t)) return false;

  // Common section header patterns:
  //   "Concrete Footings, Grade Beams and Stem Walls"
  //   "05 Metals"
  //   "Doors, Closet"
  const wordCount = t.split(/\s+/).length;
  if (wordCount > 10) return false;

  // Heuristic: check if next non-empty lines contain data or column headers
  let hasDataNearby = false;
  for (let k = 0; k < Math.min(nextLines.length, 8); k++) {
    const nl = nextLines[k].trim();
    if (COLUMN_HEADER_RE.test(nl)) { hasDataNearby = true; break; }
    if (CRAFT_DATA_RE.test(nl) || DASH_CRAFT_RE.test(nl)) { hasDataNearby = true; break; }
  }

  return hasDataNearby || /^[A-Z][A-Za-z, &\-/()']+$/.test(t);
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

function run() {
  const raw = readFileSync(INPUT, "utf-8");
  const lines = raw.split(/\r?\n/);

  let currentSection = "General";
  let currentDivision = "Residential";
  let hasEquipmentColumn = false;
  let itemCount = 0;

  // Multi-line description accumulator
  let pendingDescription = "";

  const sections = [];
  let sectionItems = [];

  function flushSection() {
    if (sectionItems.length > 0) {
      sections.push({
        section: currentSection,
        division: currentDivision,
        item_count: sectionItems.length,
        items: sectionItems,
      });
      sectionItems = [];
    }
  }

  for (let i = DATA_START_LINE; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || PAGE_NUMBER_RE.test(trimmed)) {
      pendingDescription = "";
      continue;
    }

    // Detect division boundary — line-number based for reliability
    if (i >= IC_DIVISION_START_LINE && currentDivision === "Residential") {
      if (
        /^Industrial and Commercial Division/i.test(trimmed) ||
        /^Industrial & Commercial Division/i.test(trimmed)
      ) {
        currentDivision = "Industrial & Commercial";
        continue;
      }
    }

    // CSI division headers (only valid after the I&C boundary)
    if (currentDivision === "Industrial & Commercial" && /^\d{2}\s+[A-Z][a-zA-Z &]+/.test(trimmed)) {
      flushSection();
      currentSection = trimmed;
      pendingDescription = "";
      continue;
    }

    // Skip garbled lines
    if (GARBLED_LINE_RE.test(trimmed) && !CRAFT_DATA_RE.test(line) && !DASH_CRAFT_RE.test(line)) {
      continue;
    }

    // Detect column headers
    if (COLUMN_HEADER_RE.test(trimmed)) {
      hasEquipmentColumn = HAS_EQUIPMENT_RE.test(trimmed);
      pendingDescription = "";
      continue;
    }

    // Try: standard data line with craft code
    const craftMatch = CRAFT_DATA_RE.exec(line);
    if (craftMatch) {
      let description = craftMatch[1].trim();
      const craftCode = craftMatch[2];
      const manhours = parseFloat(craftMatch[3]);
      const unit = craftMatch[4];
      const costPart = craftMatch[5];

      if (!isValidUnit(unit)) {
        // Possibly a misparse — skip
        pendingDescription = description;
        continue;
      }

      if (pendingDescription && description.length < 20 && /^\s{4,}/.test(line)) {
        description = pendingDescription + " " + description;
      }

      const values = extractCostValues(costPart);
      const costs = assignCosts(values, hasEquipmentColumn);

      if (costs.total === null && costs.material === null && costs.labor === null) {
        pendingDescription = description;
        continue;
      }

      sectionItems.push({
        description: description.replace(/\s+/g, " "),
        craft_code: craftCode,
        manhours,
        unit,
        ...costs,
      });
      itemCount++;
      pendingDescription = "";
      continue;
    }

    // Try: dash-craft material-only line
    if (PCT_LINE_RE.test(line)) {
      pendingDescription = "";
      continue; // Skip percentage adjustment lines
    }

    const dashMatch = DASH_CRAFT_RE.exec(line);
    if (dashMatch) {
      let description = dashMatch[1].trim();
      const unit = dashMatch[2];
      const costPart = dashMatch[3];

      if (!isValidUnit(unit)) {
        pendingDescription = description;
        continue;
      }

      if (pendingDescription && description.length < 20 && /^\s{4,}/.test(line)) {
        description = pendingDescription + " " + description;
      }

      const values = extractCostValues(costPart);
      // For dash-craft lines the columns are still Material / Labor / Total
      // (or Material / Labor / Equipment / Total for I&C).
      // Most commonly these are material-only, so the pattern is: material, —, total
      const costs = assignCosts(values, hasEquipmentColumn);

      if (costs.total === null && costs.material === null && costs.labor === null) {
        pendingDescription = description;
        continue;
      }

      sectionItems.push({
        description: description.replace(/\s+/g, " "),
        craft_code: null,
        manhours: null,
        unit,
        ...costs,
      });
      itemCount++;
      pendingDescription = "";
      continue;
    }

    // Check for section header
    const nextLines = lines.slice(i + 1, i + 10);
    if (isSectionHeader(line, nextLines)) {
      flushSection();
      currentSection = trimmed;
      pendingDescription = "";
      continue;
    }

    // Continuation description line — store for potential prepend to next data line
    if (trimmed.length > 5 && !GARBLED_LINE_RE.test(trimmed)) {
      pendingDescription = trimmed;
    }
  }

  flushSection();

  // Post-processing: merge sections with the same name in the same division
  const mergedMap = new Map();
  for (const sec of sections) {
    const key = `${sec.division}|||${sec.section}`;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      existing.items.push(...sec.items);
      existing.item_count = existing.items.length;
    } else {
      mergedMap.set(key, { ...sec });
    }
  }
  const mergedSections = Array.from(mergedMap.values());

  const output = {
    source: "2023 National Construction Estimator, 71st Edition, Craftsman Book Company",
    parsed_at: new Date().toISOString(),
    total_items: itemCount,
    total_sections: mergedSections.length,
    sections: mergedSections,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), "utf-8");

  console.log(`✅ Parsed ${itemCount} line items across ${mergedSections.length} sections.`);
  console.log(`   Output: ${OUTPUT}`);

  // Quality metrics
  const withCraft = mergedSections.reduce((a, s) => a + s.items.filter(i => i.craft_code).length, 0);
  const withoutCraft = mergedSections.reduce((a, s) => a + s.items.filter(i => !i.craft_code).length, 0);
  const withTotal = mergedSections.reduce((a, s) => a + s.items.filter(i => i.total !== null).length, 0);
  const withEquip = mergedSections.reduce((a, s) => a + s.items.filter(i => i.equipment !== null).length, 0);
  console.log(`   With craft code: ${withCraft}`);
  console.log(`   Material-only (no craft): ${withoutCraft}`);
  console.log(`   With total: ${withTotal}`);
  console.log(`   With equipment cost: ${withEquip}`);
}

run();
