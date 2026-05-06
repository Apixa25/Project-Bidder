"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  banUser,
  unbanUser,
  deleteUser,
  enableEstimatorRole,
  adminSendPasswordReset,
} from "@/app/(dashboard)/admin/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { CheckCircle2, Sparkles, XCircle, KeyRound } from "lucide-react";
import {
  BIDDER_PAYOUT_READINESS_LABELS,
  getBidderPayoutReadiness,
} from "@/lib/paid-estimates/payout-accounts";

interface CredentialCheck {
  label: string;
  hasIt: boolean;
}

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  bid_count: number;
  location: string;
  created_at: string;
}

interface BidSummary {
  id: string;
  project_id: string;
  project_title: string;
  project_status: string;
  trade: string;
  price: number;
  created_at: string;
}

interface Props {
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    role: string;
    bio: string | null;
    is_banned: boolean;
    website_url: string | null;
    facebook_url: string | null;
    linkedin_url: string | null;
    instagram_url: string | null;
  };
  roles: string[];
  credentials: unknown;
  credentialChecks: CredentialCheck[];
  payoutAccount: {
    stripe_account_id: string | null;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    onboarding_started_at: string | null;
    onboarding_completed_at: string | null;
    last_status_sync_at: string | null;
  } | null;
  projects: ProjectSummary[] | null;
  bids: BidSummary[] | null;
  messageCount: number;
}

export default function UserDetailTabs({
  profile,
  roles,
  credentialChecks,
  payoutAccount,
  projects,
  bids,
  messageCount,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<
    "profile" | "activity" | "credentials" | "payouts"
  >("profile");
  const [showBan, setShowBan] = useState(false);
  const [showUnban, setShowUnban] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [enablingEstimator, setEnablingEstimator] = useState(false);
  const [estimatorError, setEstimatorError] = useState<string | null>(null);
  const payoutReadiness = getBidderPayoutReadiness(payoutAccount);

  // Password-reset state — three stages: idle → confirming → sent/error
  const [resetStage, setResetStage] = useState<
    "idle" | "confirming" | "pending" | "sent" | "error"
  >("idle");
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleEnableEstimator() {
    setEnablingEstimator(true);
    setEstimatorError(null);
    const result = await enableEstimatorRole(profile.user_id);

    if (result?.error) {
      setEstimatorError(result.error);
      setEnablingEstimator(false);
      return;
    }

    router.refresh();
  }

  async function handlePasswordReset() {
    setResetStage("pending");
    setResetError(null);
    const result = await adminSendPasswordReset(
      profile.user_id,
      profile.email
    );
    if (result?.error) {
      setResetError(result.error);
      setResetStage("error");
    } else {
      setResetStage("sent");
    }
  }

  const tabs = [
    { id: "profile" as const, label: "Profile" },
    { id: "activity" as const, label: "Activity" },
    ...(roles.includes("bidder")
      ? [
          { id: "credentials" as const, label: "Credentials" },
          { id: "payouts" as const, label: "Payouts" },
        ]
      : []),
  ];

  return (
    <div>
      {/* Tab Bar */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-bg-warm p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-surface text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === "profile" && (
        <div className="space-y-6">
          {profile.bio && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-text-primary">
                Bio
              </h3>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {profile.bio}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-text-primary">
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {roles.includes("customer") && projects && (
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {projects.length}
                  </p>
                  <p className="text-sm text-text-muted">Projects Posted</p>
                </div>
              )}
              {roles.includes("bidder") && bids && (
                <div>
                  <p className="text-2xl font-bold text-text-primary">
                    {bids.length}
                  </p>
                  <p className="text-sm text-text-muted">Bids Submitted</p>
                </div>
              )}
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {messageCount}
                </p>
                <p className="text-sm text-text-muted">Messages</p>
              </div>
            </div>
          </div>

          {(profile.website_url ||
            profile.facebook_url ||
            profile.linkedin_url ||
            profile.instagram_url) && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-text-primary">
                Social Links
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Website", url: profile.website_url },
                  { label: "Facebook", url: profile.facebook_url },
                  { label: "LinkedIn", url: profile.linkedin_url },
                  { label: "Instagram", url: profile.instagram_url },
                ]
                  .filter((l) => l.url)
                  .map((l) => (
                    <a
                      key={l.label}
                      href={l.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-primary hover:underline"
                    >
                      {l.label}: {l.url}
                    </a>
                  ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-text-primary">
              Role Memberships
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <span
                    key={role}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : role === "customer"
                          ? "bg-blue-100 text-blue-700"
                          : role === "estimator"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-secondary/10 text-secondary"
                    }`}
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                ))}
              </div>
              {!roles.includes("estimator") && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Enable estimator mode
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-800">
                        Grants this user access to the Professional Estimator
                        Marketplace workspace and creates their estimator
                        profile shell.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleEnableEstimator}
                      disabled={enablingEstimator}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      {enablingEstimator ? "Enabling..." : "Enable Estimator"}
                    </button>
                  </div>
                  {estimatorError && (
                    <p className="mt-3 text-xs font-medium text-red-700">
                      {estimatorError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === "activity" && (
        <div className="space-y-6">
          {roles.includes("customer") && projects && (
            <div className="rounded-xl border border-border bg-surface shadow-sm">
              <h3 className="border-b border-border px-6 py-4 text-lg font-semibold text-text-primary">
                Projects ({projects.length})
              </h3>
              {projects.length > 0 ? (
                <div className="divide-y divide-border">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-6 py-3 hover:bg-surface-hover transition-colors"
                    >
                      <div>
                        <Link
                          href={`/admin/projects/${p.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.title}
                        </Link>
                        <p className="text-xs text-text-muted">
                          {p.location} ·{" "}
                          {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-text-muted">
                          {p.bid_count} bids
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.status === "open"
                              ? "bg-green-100 text-green-700"
                              : p.status === "awarded"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {p.status.charAt(0).toUpperCase() +
                            p.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-6 py-8 text-center text-sm text-text-muted">
                  No projects posted yet.
                </p>
              )}
            </div>
          )}

          {roles.includes("bidder") && bids && (
            <div className="rounded-xl border border-border bg-surface shadow-sm">
              <h3 className="border-b border-border px-6 py-4 text-lg font-semibold text-text-primary">
                Bids ({bids.length})
              </h3>
              {bids.length > 0 ? (
                <div className="divide-y divide-border">
                  {bids.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between px-6 py-3 hover:bg-surface-hover transition-colors"
                    >
                      <div>
                        <Link
                          href={`/admin/projects/${b.project_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {b.project_title}
                        </Link>
                        <p className="text-xs text-text-muted">
                          {b.trade} ·{" "}
                          {new Date(b.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-money text-sm font-semibold">
                          ${b.price.toLocaleString()}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            b.project_status === "open"
                              ? "bg-green-100 text-green-700"
                              : b.project_status === "awarded"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {b.project_status.charAt(0).toUpperCase() +
                            b.project_status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-6 py-8 text-center text-sm text-text-muted">
                  No bids submitted yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Credentials Tab (Bidder only) */}
      {tab === "credentials" && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            Credential Documents
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {credentialChecks.map((cred) => (
              <div
                key={cred.label}
                className={`flex items-center gap-3 rounded-lg border p-4 ${
                  cred.hasIt
                    ? "border-green-200 bg-green-50"
                    : "border-border bg-bg-warm"
                }`}
              >
                {cred.hasIt ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400 shrink-0" />
                )}
                <span
                  className={`text-sm font-medium ${
                    cred.hasIt ? "text-green-800" : "text-text-muted"
                  }`}
                >
                  {cred.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "payouts" && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-text-primary">
            Payout Account
          </h3>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                payoutReadiness === "ready"
                  ? "bg-green-100 text-green-700"
                  : payoutReadiness === "restricted"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {BIDDER_PAYOUT_READINESS_LABELS[payoutReadiness]}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-bg-warm p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Stripe Account
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {payoutAccount?.stripe_account_id || "Not connected"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-warm p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Details Submitted
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {payoutAccount?.details_submitted ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-warm p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Charges Enabled
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {payoutAccount?.charges_enabled ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-warm p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Payouts Enabled
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {payoutAccount?.payouts_enabled ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-warm p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Onboarding Started
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {payoutAccount?.onboarding_started_at
                  ? new Date(payoutAccount.onboarding_started_at).toLocaleString()
                  : "Not yet"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-warm p-4">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Last Status Sync
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {payoutAccount?.last_status_sync_at
                  ? new Date(payoutAccount.last_status_sync_at).toLocaleString()
                  : "Never"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Actions */}
      {!roles.includes("admin") && (
        <div className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-text-muted">
            Admin Actions
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {profile.is_banned ? (
              <button
                onClick={() => setShowUnban(true)}
                className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
              >
                Unban User
              </button>
            ) : (
              <button
                onClick={() => setShowBan(true)}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Ban User
              </button>
            )}
            <button
              onClick={() => setShowDelete(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
            >
              Delete User
            </button>

            {/* Password-reset button — inline confirm so there's no
                alarming red modal for a non-destructive action. */}
            <div className="flex flex-wrap items-center gap-2">
              {resetStage === "idle" && (
                <button
                  onClick={() => setResetStage("confirming")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Send Password Reset Email
                </button>
              )}

              {resetStage === "confirming" && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-900">
                    Send reset email to{" "}
                    <strong>{profile.email}</strong>?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePasswordReset}
                      className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
                    >
                      Send it
                    </button>
                    <button
                      onClick={() => setResetStage("idle")}
                      className="rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {resetStage === "pending" && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-muted">
                  <KeyRound className="h-3.5 w-3.5 animate-pulse" />
                  Sending…
                </span>
              )}

              {resetStage === "sent" && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
                  ✓ Reset email sent to {profile.email}
                </span>
              )}

              {resetStage === "error" && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {resetError}
                  </span>
                  <button
                    onClick={() => setResetStage("idle")}
                    className="text-xs text-text-muted underline hover:text-text-primary"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showBan}
        onClose={() => setShowBan(false)}
        onConfirm={async (reason) => {
          await banUser(profile.user_id, reason);
        }}
        title={`Ban ${profile.full_name}`}
        description="This user will be immediately blocked from the platform."
        confirmLabel="Ban User"
        confirmColor="amber"
        showReasonInput
        reasonRequired
      />

      <ConfirmDialog
        open={showUnban}
        onClose={() => setShowUnban(false)}
        onConfirm={async () => {
          await unbanUser(profile.user_id);
        }}
        title={`Unban ${profile.full_name}`}
        description="This will restore the user's access."
        confirmLabel="Unban User"
        confirmColor="amber"
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={async () => {
          await deleteUser(profile.user_id);
          window.location.href = "/admin/users";
        }}
        title={`Delete ${profile.full_name}`}
        description="This will permanently delete the user and all their data. This cannot be undone."
        confirmLabel="Delete Permanently"
        confirmColor="red"
      />
    </div>
  );
}
