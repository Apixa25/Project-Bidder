"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Not authorized");

  return { supabase, adminUserId: user.id };
}

async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  await supabase.from("admin_audit_logs").insert({
    admin_id: adminId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

export async function banUser(userId: string, reason: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("user_id", userId)
    .single();

  if (target?.role === "admin") return { error: "Cannot ban an admin" };

  await supabase
    .from("profiles")
    .update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      banned_by: adminUserId,
      ban_reason: reason,
    })
    .eq("user_id", userId);

  await logAudit(supabase, adminUserId, "ban_user", "user", userId, {
    reason,
    user_name: target?.full_name,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function unbanUser(userId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .single();

  await supabase
    .from("profiles")
    .update({
      is_banned: false,
      banned_at: null,
      banned_by: null,
      ban_reason: null,
    })
    .eq("user_id", userId);

  await logAudit(supabase, adminUserId, "unban_user", "user", userId, {
    user_name: target?.full_name,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function deleteUser(userId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("user_id", userId)
    .single();

  if (target?.role === "admin") return { error: "Cannot delete an admin" };

  await logAudit(supabase, adminUserId, "delete_user", "user", userId, {
    user_name: target?.full_name,
    user_email: target?.email,
    user_role: target?.role,
  });

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteProject(projectId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: project } = await supabase
    .from("projects")
    .select("title, customer_id")
    .eq("id", projectId)
    .single();

  await logAudit(supabase, adminUserId, "delete_project", "project", projectId, {
    project_title: project?.title,
  });

  await supabase.from("projects").delete().eq("id", projectId);

  revalidatePath("/admin/projects");
  revalidatePath("/admin");
  return { success: true };
}

export async function forceCloseProject(projectId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .single();

  await supabase
    .from("projects")
    .update({ status: "closed" })
    .eq("id", projectId);

  await logAudit(supabase, adminUserId, "force_close_project", "project", projectId, {
    project_title: project?.title,
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  return { success: true };
}

export async function deleteBid(bidId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  const { data: bid } = await supabase
    .from("bids")
    .select("project_id, bidder_id, price")
    .eq("id", bidId)
    .single();

  await logAudit(supabase, adminUserId, "delete_bid", "bid", bidId, {
    project_id: bid?.project_id,
    bidder_id: bid?.bidder_id,
  });

  await supabase.from("bids").delete().eq("id", bidId);

  revalidatePath("/admin/bids");
  if (bid?.project_id) revalidatePath(`/admin/projects/${bid.project_id}`);
  return { success: true };
}

export async function deleteMessage(messageId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  await logAudit(supabase, adminUserId, "delete_message", "message", messageId, {});

  await supabase.from("messages").delete().eq("id", messageId);

  revalidatePath("/admin/messages");
  return { success: true };
}

export async function resolveFlag(flagId: string) {
  const { supabase, adminUserId } = await requireAdmin();

  await supabase
    .from("flagged_content")
    .update({ resolved: true })
    .eq("id", flagId);

  await logAudit(supabase, adminUserId, "resolve_flag", "flag", flagId, {});

  revalidatePath("/admin/flags");
  revalidatePath("/admin");
  return { success: true };
}

export async function dismissFlag(flagId: string, note: string) {
  const { supabase, adminUserId } = await requireAdmin();

  await supabase
    .from("flagged_content")
    .update({ resolved: true })
    .eq("id", flagId);

  await logAudit(supabase, adminUserId, "dismiss_flag", "flag", flagId, { note });

  revalidatePath("/admin/flags");
  revalidatePath("/admin");
  return { success: true };
}
