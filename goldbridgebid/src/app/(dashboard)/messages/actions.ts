"use server";

import { createClient } from "@/lib/supabase/server";

export async function sendMessage(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const projectId = formData.get("projectId") as string;
  const receiverId = formData.get("receiverId") as string;
  const content = formData.get("content") as string;

  if (!projectId || !receiverId || !content?.trim()) {
    return { error: "Message cannot be empty." };
  }

  const { error } = await supabase.from("messages").insert({
    project_id: projectId,
    sender_id: user.id,
    receiver_id: receiverId,
    content: content.trim(),
  });

  if (error) {
    console.error("Send message error:", error);
    return { error: "Failed to send message." };
  }

  await supabase.from("notifications").insert({
    user_id: receiverId,
    type: "new_message",
    title: "New message",
    message: `You have a new message regarding a project.`,
    link: `/messages`,
  });

  return { success: true };
}

export async function markMessagesRead(conversationUserId: string, projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("messages")
    .update({ read: true })
    .eq("project_id", projectId)
    .eq("sender_id", conversationUserId)
    .eq("receiver_id", user.id)
    .eq("read", false);
}
