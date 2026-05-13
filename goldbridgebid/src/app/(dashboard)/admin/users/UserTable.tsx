"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressWithMapPreview from "@/components/address-quotes/AddressWithMapPreview";
import BulkActionBar from "@/components/admin/BulkActionBar";
import UserActions from "./UserActions";

interface UserRow {
  id: string;
  user_id: string;
  full_name: string;
  business_name: string | null;
  email: string;
  is_banned: boolean;
  created_at: string;
  city: string | null;
  state: string | null;
  address: string | null;
  exact_address_map_image_url: string | null;
  roles: string[];
  badgeLabel: string | null;
  badgeIcon: string | null;
  badgeBgColor: string | null;
  badgeColor: string | null;
  isBidder: boolean;
}

interface UserTableProps {
  users: UserRow[];
}

export default function UserTable({ users }: UserTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectableUsers = users.filter(
    (u) => !u.roles.includes("admin")
  );
  const allSelected =
    selectableUsers.length > 0 && selectableUsers.every((u) => selected.has(u.user_id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableUsers.map((u) => u.user_id)));
    }
  }

  function toggleUser(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-warm text-left">
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                  />
                </th>
                <th className="px-6 py-3 font-semibold text-text-primary">Name</th>
                <th className="px-6 py-3 font-semibold text-text-primary">Role</th>
                <th className="px-6 py-3 font-semibold text-text-primary">Badge</th>
                <th className="px-6 py-3 font-semibold text-text-primary">Email</th>
                <th className="px-6 py-3 font-semibold text-text-primary">Location</th>
                <th className="px-6 py-3 font-semibold text-text-primary">Joined</th>
                <th className="px-6 py-3 font-semibold text-text-primary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((p) => {
                const isAdmin = p.roles.includes("admin");
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      selected.has(p.user_id)
                        ? "bg-primary/5"
                        : p.is_banned
                          ? "bg-red-50 hover:bg-red-100"
                          : "hover:bg-surface-hover"
                    }`}
                  >
                    <td className="px-3 py-4">
                      {!isAdmin ? (
                        <input
                          type="checkbox"
                          checked={selected.has(p.user_id)}
                          onChange={() => toggleUser(p.user_id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                        />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`/admin/users/${p.user_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.full_name}
                      </a>
                      {p.business_name && (
                        <p className="text-xs text-text-muted">{p.business_name}</p>
                      )}
                      {p.is_banned && (
                        <span className="mt-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          BANNED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {p.roles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
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
                    </td>
                    <td className="px-6 py-4">
                      {p.badgeLabel ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full ${p.badgeBgColor} px-2 py-0.5 text-xs font-medium ${p.badgeColor}`}
                        >
                          {p.badgeIcon} {p.badgeLabel}
                        </span>
                      ) : p.isBidder ? (
                        <span className="text-xs text-text-muted">None</span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{p.email}</td>
                    <td className="px-6 py-4 text-text-muted">
                      <AddressWithMapPreview
                        address={
                          p.city && p.state
                            ? `${p.city}, ${p.state}`
                            : p.address || "—"
                        }
                        mapImageUrl={p.exact_address_map_image_url}
                        imageClassName="h-12 w-16"
                        className="text-xs"
                      />
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {!isAdmin && (
                        <UserActions
                          userId={p.user_id}
                          userName={p.full_name}
                          isBanned={p.is_banned}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-text-muted">
            No users match your filters.
          </p>
        )}
      </div>

      <BulkActionBar
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        onComplete={() => {
          setSelected(new Set());
          router.refresh();
        }}
      />
    </>
  );
}
