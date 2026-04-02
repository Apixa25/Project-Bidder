import { CORE_CREDENTIAL_FIELDS, hasCoreCredentials } from "@/lib/badges";
import type {
  BidderCredentials,
  PaidEstimateFilter,
} from "@/types/database";

export type CoreCredentialField = (typeof CORE_CREDENTIAL_FIELDS)[number];

export type PaidEstimateEligibilityReason =
  | "eligible"
  | "missing_core_credentials";

export interface PaidEstimateEligibilityResult {
  isEligible: boolean;
  reason: PaidEstimateEligibilityReason;
  missingCoreCredentials: CoreCredentialField[];
}

export const PAID_ESTIMATE_FILTER_LABELS: Record<PaidEstimateFilter, string> = {
  open_to_anyone: "Open to anyone",
  core_verified_only: "Core verified only",
};

export function getMissingCoreCredentialFields(
  credentials: BidderCredentials | null | undefined
): CoreCredentialField[] {
  if (!credentials) {
    return [...CORE_CREDENTIAL_FIELDS];
  }

  return CORE_CREDENTIAL_FIELDS.filter((field) => credentials[field] === null);
}

export function getPaidEstimateEligibility(
  credentials: BidderCredentials | null | undefined,
  filter: PaidEstimateFilter
): PaidEstimateEligibilityResult {
  if (filter === "open_to_anyone") {
    return {
      isEligible: true,
      reason: "eligible",
      missingCoreCredentials: [],
    };
  }

  const eligible = hasCoreCredentials(credentials);

  return {
    isEligible: eligible,
    reason: eligible ? "eligible" : "missing_core_credentials",
    missingCoreCredentials: eligible
      ? []
      : getMissingCoreCredentialFields(credentials),
  };
}

export function isBidderEligibleForPaidEstimate(
  credentials: BidderCredentials | null | undefined,
  filter: PaidEstimateFilter
) {
  return getPaidEstimateEligibility(credentials, filter).isEligible;
}
