"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { enableRole } from "@/app/(dashboard)/role-actions";
import type { UserRole } from "@/types/database";

interface RoleSwitcherProps {
  availableRoles: UserRole[];
  currentRole: UserRole;
}

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Customer",
  bidder: "Contractor",
  admin: "Admin",
};

export default function RoleSwitcher({
  availableRoles,
  currentRole,
}: RoleSwitcherProps) {
  const pathname = usePathname();
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const missingRoles = (["customer", "bidder"] as const).filter(
    (role) => !availableRoles.includes(role)
  );

  async function handleEnable(role: "customer" | "bidder") {
    setSavingRole(role);
    setError(null);
    const result = await enableRole(role);

    if (result?.error) {
      setError(result.error);
      setSavingRole(null);
      return;
    }

    window.location.href = `/${role}`;
  }

  return (
    <div className="space-y-3">
      {availableRoles.length > 1 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Switch Role
          </p>
          <div className="grid grid-cols-1 gap-2">
            {availableRoles.map((role) => {
              const isActive =
                pathname === `/${role}` || pathname.startsWith(`/${role}/`);

              return (
                <Link
                  key={role}
                  href={`/${role}`}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    isActive || role === currentRole
                      ? "border-accent-light/35 bg-accent-light/10 text-accent-light"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  {ROLE_LABELS[role]} Mode
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {missingRoles.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Enable Another Role
          </p>
          <div className="grid grid-cols-1 gap-2">
            {missingRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleEnable(role)}
                disabled={savingRole !== null}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingRole === role
                  ? `Enabling ${ROLE_LABELS[role]}...`
                  : `Enable ${ROLE_LABELS[role]} Mode`}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
