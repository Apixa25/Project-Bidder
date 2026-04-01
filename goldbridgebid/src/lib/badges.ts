import type { BidderCredentials, BadgeLevel } from "@/types/database";

const CREDENTIAL_FIELDS = [
  "license_url",
  "bond_url",
  "insurance_url",
  "workers_comp_url",
  "ein_url",
  "references_url",
] as const;

export const CORE_CREDENTIAL_FIELDS = [
  "license_url",
  "bond_url",
  "insurance_url",
] as const;

type CoreCredentialShape = Pick<
  BidderCredentials,
  (typeof CORE_CREDENTIAL_FIELDS)[number]
>;

export function countUploadedCredentials(credentials: BidderCredentials | null | undefined) {
  if (!credentials) {
    return 0;
  }

  return CREDENTIAL_FIELDS.filter((field) => credentials[field] !== null).length;
}

export function calculateBadgeLevel(credentials: BidderCredentials): BadgeLevel {
  const uploadedCount = countUploadedCredentials(credentials);

  if (uploadedCount === 6) return "gold";
  if (uploadedCount >= 4) return "silver";
  if (uploadedCount >= 1) return "bronze";
  return null;
}

export function getCredentialStatus(credentials: BidderCredentials) {
  return {
    license: credentials.license_url !== null,
    bond: credentials.bond_url !== null,
    insurance: credentials.insurance_url !== null,
    workers_comp: credentials.workers_comp_url !== null,
    ein: credentials.ein_url !== null,
    references: credentials.references_url !== null,
  };
}

export function hasCoreCredentials(
  credentials: CoreCredentialShape | null | undefined
) {
  if (!credentials) {
    return false;
  }

  return CORE_CREDENTIAL_FIELDS.every((field) => credentials[field] !== null);
}

export const BADGE_CONFIG: Record<
  NonNullable<BadgeLevel>,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  gold: {
    label: "Gold Verified",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    icon: "🥇",
  },
  silver: {
    label: "Silver Verified",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    icon: "🥈",
  },
  bronze: {
    label: "Bronze Verified",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    icon: "🥉",
  },
};
