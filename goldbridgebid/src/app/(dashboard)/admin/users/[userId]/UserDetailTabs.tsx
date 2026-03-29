"use client";

import { useState } from "react";
import Link from "next/link";
import {
  banUser,
  unbanUser,
  deleteUser,
} from "@/app/(dashboard)/admin/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { CheckCircle2, XCircle } from "lucide-react";

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
  projects: ProjectSummary[] | null;
  bids: BidSummary[] | null;
  messageCount: number;
}

export default function UserDetailTabs({
  profile,
  roles,
  credentialChecks,
  projects,
  bids,
  messageCount,
}: Props) {
  const [tab, setTab] = useState<"profile" | "activity" | "credentials">(
    "profile"
  );
  const [showBan, setShowBan] = useState(false);
  const [showUnban, setShowUnban] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const tabs = [
    { id: "profile" as const, label: "Profile" },
    { id: "activity" as const, label: "Activity" },
    ...(roles.includes("bidder")
      ? [{ id: "credentials" as const, label: "Credentials" }]
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
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <span
                  key={role}
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                    role === "admin"
                      ? "bg-purple-100 text-purple-700"
                      : role === "customer"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-secondary/10 text-secondary"
                  }`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              ))}
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
                        <span className="text-sm font-semibold text-text-primary">
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

      {/* Admin Actions */}
      {!roles.includes("admin") && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          <span className="text-sm font-medium text-text-muted">
            Admin Actions:
          </span>
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
