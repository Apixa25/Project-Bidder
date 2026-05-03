"use client";

import { useState, useRef, useEffect } from "react";
import { sendMessage } from "@/app/(dashboard)/messages/actions";
import { Send, Loader2 } from "lucide-react";

interface MessageData {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ConversationViewProps {
  projectId: string;
  projectTitle: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  messages: MessageData[];
}

export default function ConversationView({
  projectId,
  projectTitle,
  currentUserId,
  otherUserId,
  otherUserName,
  messages: initialMessages,
}: ConversationViewProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("receiverId", otherUserId);
    formData.set("content", content.trim());

    const result = await sendMessage(formData);

    if (result.success) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender_id: currentUserId,
          content: content.trim(),
          created_at: new Date().toISOString(),
        },
      ]);
      setContent("");
    }

    setSending(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-surface px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="break-words font-semibold text-text-primary">
          {otherUserName}
        </h2>
        <p className="break-words text-xs text-text-muted">
          Re: {projectTitle}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 && (
          <p className="text-center text-sm text-text-muted py-12">
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 sm:max-w-[70%] ${
                  isMine
                    ? "bg-secondary text-white rounded-br-md"
                    : "bg-surface border border-border text-text-primary rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-sm">
                  {msg.content}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    isMine ? "text-white/60" : "text-text-muted"
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="border-t border-border bg-surface px-3 py-3 sm:px-6 sm:py-4"
      >
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-border bg-bg-warm px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={!content.trim() || sending}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-white hover:bg-secondary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
