import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BADGE_CONFIG } from "@/lib/badges";
import { hasCoreCredentials } from "@/lib/badges";
import type { BadgeLevel } from "@/types/database";
import { Star } from "lucide-react";
import CredentialCard from "./CredentialCard";
import { userHasRole } from "@/lib/auth/roles";

const CREDENTIAL_FIELDS = [
  {
    field: "license_url",
    label: "Contractor's License",
    description: "Your state-issued contractor's license document.",
    icon: "📜",
    required: true,
  },
  {
    field: "bond_url",
    label: "Surety Bond",
    description: "Proof of contractor's surety bond.",
    icon: "🔐",
    required: true,
  },
  {
    field: "insurance_url",
    label: "General Liability Insurance",
    description: "Certificate of general liability insurance coverage.",
    icon: "🛡️",
    required: true,
  },
  {
    field: "workers_comp_url",
    label: "Workers' Compensation",
    description: "Workers' compensation insurance certificate.",
    icon: "⚕️",
    required: false,
  },
  {
    field: "ein_url",
    label: "EIN / Tax ID",
    description: "IRS Employer Identification Number letter.",
    icon: "🏛️",
    required: false,
  },
  {
    field: "references_url",
    label: "References",
    description: "Document with professional references or letters of recommendation.",
    icon: "📋",
    required: false,
  },
] as const;

export default async function CredentialsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "bidder"))) redirect("/login");

  const { data: credentials } = await supabase
    .from("bidder_credentials")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!credentials) redirect("/bidder");

  const badgeLevel = credentials.badge_level as BadgeLevel;
  const badgeInfo = badgeLevel ? BADGE_CONFIG[badgeLevel] : null;
  const hasCoreCheck = hasCoreCredentials(credentials);

  const uploadedCount = CREDENTIAL_FIELDS.filter(
    (c) => credentials[c.field as keyof typeof credentials] !== null
  ).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          My Credentials 🛡️
        </h1>
        <p className="mt-1 text-text-secondary">
          Upload your qualifications to earn a badge and stand out to customers.
        </p>
      </div>

      {/* Badge Status */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {badgeInfo ? (
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full ${badgeInfo.bgColor}`}
              >
                <span className="text-3xl">{badgeInfo.icon}</span>
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Star className="h-8 w-8 text-gray-300" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-primary">
                {badgeInfo ? badgeInfo.label : "No Badge Yet"}
              </h2>
              <p className="text-sm text-text-muted">
                {uploadedCount}/6 credentials uploaded
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-xs text-text-muted mb-2">Badge Requirements</p>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
              {(["bronze", "silver", "gold"] as const).map((level) => {
                const cfg = BADGE_CONFIG[level];
                const isActive =
                  level === "bronze"
                    ? uploadedCount >= 1
                    : level === "silver"
                      ? uploadedCount >= 4
                      : uploadedCount === 6;
                return (
                  <div
                    key={level}
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                      isActive
                        ? `${cfg.bgColor} ${cfg.color}`
                        : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    {cfg.icon}{" "}
                    {level === "bronze"
                      ? "1+"
                      : level === "silver"
                        ? "4+"
                        : "All 6"}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-3 w-full rounded-full bg-bg-warm overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                uploadedCount === 6
                  ? "bg-amber-500"
                  : uploadedCount >= 4
                    ? "bg-gray-400"
                    : uploadedCount >= 1
                      ? "bg-orange-400"
                      : "bg-gray-200"
              }`}
              style={{ width: `${(uploadedCount / 6) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-text-muted">
            <span className="font-semibold text-text-primary">Core</span> means
            your contractor license, surety bond, and general liability
            insurance. Upload all 3 core documents to earn the green check that
            customers will see next to your name.
          </p>
          {hasCoreCheck && (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Core Verified achieved: customers can spot this next to your name.
            </p>
          )}
        </div>
      </div>

      {/* Credential Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CREDENTIAL_FIELDS.map((cred) => {
          const currentUrl = credentials[
            cred.field as keyof typeof credentials
          ] as string | null;
          return (
            <CredentialCard
              key={cred.field}
              field={cred.field}
              label={cred.label}
              description={cred.description}
              icon={cred.icon}
              required={cred.required}
              currentUrl={currentUrl}
            />
          );
        })}
      </div>
    </div>
  );
}
