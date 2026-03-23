"use client";

import { useState } from "react";
import Link from "next/link";
import type { TradeCategory, BadgeLevel } from "@/types/database";
import {
  forceCloseProject,
  deleteProject,
} from "@/app/(dashboard)/admin/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface BidWithBidder {
  id: string;
  bidder_id: string;
  trade: string;
  price: number;
  estimated_timeline: string;
  estimated_start_date: string;
  notes: string | null;
  created_at: string;
  bidder: {
    full_name: string;
    email: string;
    business_name: string | null;
    phone: string;
  } | null;
  badge: BadgeLevel;
}

interface MessageWithSender {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  senderName: string;
  senderRole: string;
}

interface ProjectEdit {
  id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  edited_at: string;
}

interface ProjectFile {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
}

interface BadgeInfo {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

interface Props {
  project: {
    id: string;
    description: string;
    completion_criteria: string;
    status: string;
  };
  bids: BidWithBidder[];
  edits: ProjectEdit[];
  messages: MessageWithSender[];
  files: ProjectFile[];
  badgeConfig: Record<string, BadgeInfo>;
  tradeLabels: Record<string, string>;
}

const TABS = ["Details", "Bids", "History", "Messages"] as const;

export default function ProjectDetailTabs({
  project,
  bids,
  edits,
  messages,
  files,
  badgeConfig,
  tradeLabels,
}: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Details");
  const [showClose, setShowClose] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div>
      {/* Tab Bar */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-bg-warm p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-surface text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t}
            {t === "Bids" && ` (${bids.length})`}
            {t === "Messages" && ` (${messages.length})`}
            {t === "History" && edits.length > 0 && ` (${edits.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "Details" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-text-primary">
              Description
            </h3>
            <p className="whitespace-pre-wrap text-sm text-text-secondary leading-relaxed">
              {project.description}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-text-primary">
              Completion Criteria
            </h3>
            <p className="whitespace-pre-wrap text-sm text-text-secondary leading-relaxed">
              {project.completion_criteria}
            </p>
          </div>

          {files.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-text-primary">
                Files ({files.length})
              </h3>
              <div className="space-y-2">
                {files.map((f) => (
                  <a
                    key={f.id}
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-primary hover:bg-surface-hover transition-colors"
                  >
                    📎 {f.file_name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "Bids" && (
        <div className="rounded-xl border border-border bg-surface shadow-sm">
          {bids.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-warm text-left">
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Bidder
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Badge
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Trade
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Price
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Timeline
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Start Date
                    </th>
                    <th className="px-6 py-3 font-semibold text-text-primary">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bids.map((bid) => {
                    const badge = bid.badge
                      ? badgeConfig[bid.badge]
                      : null;
                    return (
                      <tr
                        key={bid.id}
                        className="hover:bg-surface-hover transition-colors"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/admin/users/${bid.bidder_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {bid.bidder?.full_name || "Unknown"}
                          </Link>
                          <p className="text-xs text-text-muted">
                            {bid.bidder?.business_name || bid.bidder?.email}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {badge ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full ${badge.bgColor} px-2 py-0.5 text-xs font-medium ${badge.color}`}
                            >
                              {badge.icon} {badge.label}
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">
                              None
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {tradeLabels[bid.trade as TradeCategory] ||
                            bid.trade}
                        </td>
                        <td className="px-6 py-4 font-semibold text-text-primary">
                          ${Number(bid.price).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {bid.estimated_timeline}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {new Date(
                            bid.estimated_start_date
                          ).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-text-muted">
                          {new Date(bid.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 py-12 text-center text-sm text-text-muted">
              No bids on this project yet.
            </p>
          )}
        </div>
      )}

      {tab === "History" && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {edits.length > 0 ? (
            <div className="space-y-4">
              {edits.map((edit) => (
                <div
                  key={edit.id}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-800">
                      {edit.field_name}
                    </span>
                    <span className="text-xs text-text-muted">
                      {new Date(edit.edited_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-medium text-red-600">
                        Before
                      </p>
                      <p className="mt-1 text-text-secondary line-through">
                        {edit.old_value.length > 200
                          ? edit.old_value.slice(0, 200) + "..."
                          : edit.old_value}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-green-600">
                        After
                      </p>
                      <p className="mt-1 text-text-primary">
                        {edit.new_value.length > 200
                          ? edit.new_value.slice(0, 200) + "..."
                          : edit.new_value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">
              No edits have been made to this project.
            </p>
          )}
        </div>
      )}

      {tab === "Messages" && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {messages.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <div
                    className={`mt-1 h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      msg.senderRole === "customer"
                        ? "bg-primary"
                        : "bg-secondary"
                    }`}
                  >
                    {msg.senderName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {msg.senderName}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          msg.senderRole === "customer"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary/10 text-secondary"
                        }`}
                      >
                        {msg.senderRole}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {msg.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">
              No messages on this project yet.
            </p>
          )}
        </div>
      )}

      {/* Admin Actions */}
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
        <span className="text-sm font-medium text-text-muted">
          Admin Actions:
        </span>
        {project.status !== "closed" && (
          <button
            onClick={() => setShowClose(true)}
            className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Force Close
          </button>
        )}
        <button
          onClick={() => setShowDelete(true)}
          className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
        >
          Delete Project
        </button>
      </div>

      <ConfirmDialog
        open={showClose}
        onClose={() => setShowClose(false)}
        onConfirm={async () => {
          await forceCloseProject(project.id);
        }}
        title="Force Close Project"
        description="This will close the project and stop accepting new bids. This action cannot be undone."
        confirmLabel="Close Project"
        confirmColor="amber"
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={async () => {
          await deleteProject(project.id);
          window.location.href = "/admin/projects";
        }}
        title="Delete Project"
        description="This will permanently delete the project and all associated bids, files, and messages. This cannot be undone."
        confirmLabel="Delete Project"
        confirmColor="red"
        showReasonInput
      />
    </div>
  );
}
