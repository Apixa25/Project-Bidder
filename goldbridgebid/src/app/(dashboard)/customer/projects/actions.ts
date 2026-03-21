"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { TradeCategory } from "@/types/database";

export async function createProject(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to create a project." };
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const completionCriteria = formData.get("completionCriteria") as string;
  const tradesRaw = formData.getAll("trades") as string[];
  const locationAddress = formData.get("locationAddress") as string;
  const locationCity = formData.get("locationCity") as string;
  const locationState = formData.get("locationState") as string;
  const locationZip = formData.get("locationZip") as string;
  const budgetMin = formData.get("budgetMin") as string;
  const budgetMax = formData.get("budgetMax") as string;
  const desiredStartDate = formData.get("desiredStartDate") as string;
  const timeline = formData.get("timeline") as string;

  if (
    !title ||
    !description ||
    !completionCriteria ||
    tradesRaw.length === 0 ||
    !locationAddress ||
    !locationCity ||
    !locationState ||
    !locationZip
  ) {
    return { error: "Please fill in all required fields." };
  }

  const trades = tradesRaw as TradeCategory[];

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      customer_id: user.id,
      title,
      description,
      completion_criteria: completionCriteria,
      trades,
      location_address: locationAddress,
      location_city: locationCity,
      location_state: locationState,
      location_zip: locationZip,
      budget_min: budgetMin ? parseFloat(budgetMin) : null,
      budget_max: budgetMax ? parseFloat(budgetMax) : null,
      desired_start_date: desiredStartDate || null,
      timeline: timeline || null,
    })
    .select("id")
    .single();

  if (projectError) {
    console.error("Project creation error:", projectError);
    return { error: "Failed to create project. Please try again." };
  }

  // Handle file uploads
  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);

  if (validFiles.length > 0 && project) {
    for (const file of validFiles) {
      const fileExt = file.name.split(".").pop();
      const filePath = `projects/${project.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(filePath, file);

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("project-files").getPublicUrl(filePath);

        await supabase.from("project_files").insert({
          project_id: project.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
        });
      }
    }
  }

  redirect(`/customer/projects/${project.id}`);
}

export async function updateProjectStatus(
  projectId: string,
  status: "open" | "awarded" | "closed"
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .eq("customer_id", user.id);

  if (error) {
    return { error: "Failed to update project status." };
  }

  // If awarding, notify all bidders who bid on this project
  if (status === "awarded" || status === "closed") {
    const { data: bids } = await supabase
      .from("bids")
      .select("bidder_id")
      .eq("project_id", projectId);

    if (bids) {
      const notifications = bids.map((bid) => ({
        user_id: bid.bidder_id,
        type: status === "awarded" ? "project_awarded" : "project_closed",
        title:
          status === "awarded"
            ? "Project has been awarded"
            : "Project has been closed",
        message:
          status === "awarded"
            ? "A project you bid on has been awarded to a contractor."
            : "A project you bid on has been closed.",
        link: `/bidder/bids`,
      }));

      await supabase.from("notifications").insert(notifications);
    }
  }

  return { success: true };
}
