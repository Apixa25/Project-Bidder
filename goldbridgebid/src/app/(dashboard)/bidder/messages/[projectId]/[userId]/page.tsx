import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ConversationView from "@/components/messaging/ConversationView";
import { markMessagesRead } from "@/app/(dashboard)/messages/actions";

export default async function BidderConversationPage({
  params,
}: {
  params: Promise<{ projectId: string; userId: string }>;
}) {
  const { projectId, userId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("full_name, business_name")
    .eq("user_id", userId)
    .single();

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("project_id", projectId)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });

  await markMessagesRead(userId, projectId);

  const otherName = otherProfile?.full_name || "Unknown User";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Link
        href="/bidder/messages"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Messages
      </Link>

      <div className="flex-1 rounded-xl border border-border bg-bg-warm shadow-sm overflow-hidden">
        <ConversationView
          projectId={projectId}
          projectTitle={project.title}
          currentUserId={user.id}
          otherUserId={userId}
          otherUserName={otherName}
          messages={messages || []}
        />
      </div>
    </div>
  );
}
