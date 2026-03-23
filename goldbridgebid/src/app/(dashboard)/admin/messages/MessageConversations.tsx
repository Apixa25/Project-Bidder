"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { deleteMessage } from "@/app/(dashboard)/admin/actions";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

interface MessageData {
  id: string;
  content: string;
  sender_id: string;
  senderName: string;
  senderRole: string;
  created_at: string;
}

interface Conversation {
  key: string;
  projectId: string;
  projectTitle: string;
  participants: { id: string; name: string; role: string }[];
  lastMessage: string;
  lastDate: string;
  count: number;
  messages: MessageData[];
}

export default function MessageConversations({
  conversations,
}: {
  conversations: Conversation[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {conversations.length === 0 && (
        <div className="rounded-xl border border-border bg-surface py-12 text-center">
          <p className="text-sm text-text-muted">
            No conversations match your search.
          </p>
        </div>
      )}

      {conversations.map((conv) => (
        <div
          key={conv.key}
          className="rounded-xl border border-border bg-surface shadow-sm"
        >
          <button
            onClick={() =>
              setExpanded(expanded === conv.key ? null : conv.key)
            }
            className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-hover transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/projects/${conv.projectId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-primary hover:underline truncate"
                >
                  {conv.projectTitle}
                </Link>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {conv.count} msg{conv.count !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {conv.participants.map((p) => `${p.name} (${p.role})`).join(" ↔ ")}
              </p>
              <p className="mt-1 text-sm text-text-secondary truncate">
                {conv.lastMessage}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <span className="text-xs text-text-muted">
                {new Date(conv.lastDate).toLocaleDateString()}
              </span>
              {expanded === conv.key ? (
                <ChevronUp className="h-4 w-4 text-text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-text-muted" />
              )}
            </div>
          </button>

          {expanded === conv.key && (
            <div className="border-t border-border px-4 py-3 max-h-80 overflow-y-auto">
              <div className="space-y-3">
                {conv.messages
                  .sort(
                    (a, b) =>
                      new Date(a.created_at).getTime() -
                      new Date(b.created_at).getTime()
                  )
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start gap-2 group"
                    >
                      <div
                        className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                          msg.senderRole === "customer"
                            ? "bg-primary"
                            : "bg-secondary"
                        }`}
                      >
                        {msg.senderName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-text-primary">
                            {msg.senderName}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary">
                          {msg.content}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteTarget(msg.id)}
                        className="shrink-0 rounded p-1 text-text-muted opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Delete message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMessage(deleteTarget);
            setDeleteTarget(null);
          }
        }}
        title="Delete Message"
        description="This will permanently remove this message. This cannot be undone."
        confirmLabel="Delete"
        confirmColor="red"
      />
    </div>
  );
}
