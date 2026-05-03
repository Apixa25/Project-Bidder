import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MessageSquare, FolderOpen } from "lucide-react";
import { userHasRole } from "@/lib/auth/roles";

export default async function CustomerMessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const { data: messages } = await supabase
    .from("messages")
    .select("*, projects!inner(title)")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  // Group messages into conversations (unique project_id + other_user_id)
  const conversationMap = new Map<
    string,
    {
      projectId: string;
      projectTitle: string;
      otherUserId: string;
      lastMessage: string;
      lastDate: string;
      unreadCount: number;
    }
  >();

  for (const msg of messages || []) {
    const otherUserId =
      msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
    const key = `${msg.project_id}:${otherUserId}`;
    const project = msg.projects as unknown as { title: string };

    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        projectId: msg.project_id,
        projectTitle: project.title,
        otherUserId,
        lastMessage: msg.content,
        lastDate: msg.created_at,
        unreadCount: 0,
      });
    }

    const conv = conversationMap.get(key)!;
    if (!msg.read && msg.receiver_id === user.id) {
      conv.unreadCount++;
    }
  }

  const conversations = Array.from(conversationMap.values());

  // Fetch other user profiles
  const otherUserIds = [...new Set(conversations.map((c) => c.otherUserId))];
  const { data: profiles } = otherUserIds.length > 0
    ? await supabase
        .from("profiles")
        .select("user_id, full_name, business_name")
        .in("user_id", otherUserIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Messages 💬</h1>
        <p className="mt-1 text-text-secondary">
          Communicate with bidders about your projects.
        </p>
      </div>

      {conversations.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface shadow-sm divide-y divide-border">
          {conversations.map((conv) => {
            const profile = profileMap.get(conv.otherUserId);
            return (
              <Link
                key={`${conv.projectId}:${conv.otherUserId}`}
                href={`/customer/messages/${conv.projectId}/${conv.otherUserId}`}
                className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-hover sm:flex-row sm:items-center sm:gap-4 sm:px-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 shrink-0">
                  <MessageSquare className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {profile?.full_name || "Unknown User"}
                    </h3>
                    {profile?.business_name && (
                      <span className="min-w-0 truncate text-xs text-text-muted">
                        ({profile.business_name})
                      </span>
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-slate-950">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    <FolderOpen className="inline h-3 w-3 mr-1" />
                    {conv.projectTitle}
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary truncate">
                    {conv.lastMessage}
                  </p>
                </div>
                <span className="text-xs text-text-muted sm:shrink-0">
                  {new Date(conv.lastDate).toLocaleDateString()}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-sm">
          <MessageSquare className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-4 text-lg font-medium text-text-secondary">
            No messages yet
          </p>
          <p className="mt-1 text-sm text-text-muted">
            When bidders message you about a project, conversations will appear
            here.
          </p>
        </div>
      )}
    </div>
  );
}
