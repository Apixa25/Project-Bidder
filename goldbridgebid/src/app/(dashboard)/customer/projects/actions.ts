"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { TradeCategory } from "@/types/database";
import { generateAndUploadThumbnail } from "@/lib/generate-thumbnail";

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

        let thumbnailUrl: string | null = null;
        if (file.type.startsWith("image/")) {
          thumbnailUrl = await generateAndUploadThumbnail(
            file,
            "project-files",
            filePath
          );
        }

        await supabase.from("project_files").insert({
          project_id: project.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          thumbnail_url: thumbnailUrl,
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

export async function deleteProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, title")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!project) return { error: "Project not found." };

  // Notify existing bidders before deleting
  const { data: bids } = await supabase
    .from("bids")
    .select("bidder_id")
    .eq("project_id", projectId);

  if (bids && bids.length > 0) {
    const notifications = bids.map((bid) => ({
      user_id: bid.bidder_id,
      type: "project_closed",
      title: "Project has been deleted",
      message: `The project "${project.title}" you bid on has been deleted by the customer.`,
      link: `/bidder/bids`,
    }));
    await supabase.from("notifications").insert(notifications);
  }

  // Delete stored files from Supabase Storage
  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("file_url")
    .eq("project_id", projectId);

  if (projectFiles && projectFiles.length > 0) {
    const storagePaths = projectFiles
      .map((f) => {
        const match = f.file_url.match(/project-files\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      await supabase.storage.from("project-files").remove(storagePaths);
    }
  }

  // CASCADE handles project_files, project_edits, bids, bid_files, messages
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("customer_id", user.id);

  if (error) {
    console.error("Delete project error:", error);
    return { error: "Failed to delete project. Please try again." };
  }

  redirect("/customer/projects");
}

export async function saveAnnotation(projectFileId: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const blob = formData.get("annotatedImage") as File;
  if (!blob || blob.size === 0) return { error: "No annotated image provided." };

  // Verify ownership: the project_file must belong to a project owned by this user
  const { data: projectFile } = await supabase
    .from("project_files")
    .select("id, project_id")
    .eq("id", projectFileId)
    .single();

  if (!projectFile) return { error: "File not found." };

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectFile.project_id)
    .eq("customer_id", user.id)
    .single();

  if (!project) return { error: "Not authorized to annotate this file." };

  const filePath = `projects/${project.id}/annotated/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

  const { error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(filePath, blob, { contentType: "image/png" });

  if (uploadError) {
    console.error("Annotation upload error:", uploadError);
    return { error: "Failed to upload annotated image." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("project-files").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("project_files")
    .update({ annotated_url: publicUrl })
    .eq("id", projectFileId);

  if (updateError) {
    console.error("Annotation update error:", updateError);
    return { error: "Failed to save annotation." };
  }

  return { success: true, annotatedUrl: publicUrl };
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  // Fetch current project to compare changes
  const { data: current } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!current) return { error: "Project not found." };

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

  // Track all changes for the audit trail
  const edits: { field_name: string; old_value: string; new_value: string }[] = [];

  const fieldChecks: { field: string; oldVal: string; newVal: string }[] = [
    { field: "title", oldVal: current.title, newVal: title },
    { field: "description", oldVal: current.description, newVal: description },
    { field: "completion_criteria", oldVal: current.completion_criteria, newVal: completionCriteria },
    { field: "trades", oldVal: JSON.stringify(current.trades), newVal: JSON.stringify(trades) },
    { field: "location_address", oldVal: current.location_address, newVal: locationAddress },
    { field: "location_city", oldVal: current.location_city, newVal: locationCity },
    { field: "location_state", oldVal: current.location_state, newVal: locationState },
    { field: "location_zip", oldVal: current.location_zip, newVal: locationZip },
    { field: "budget_min", oldVal: String(current.budget_min ?? ""), newVal: budgetMin || "" },
    { field: "budget_max", oldVal: String(current.budget_max ?? ""), newVal: budgetMax || "" },
    { field: "desired_start_date", oldVal: current.desired_start_date ?? "", newVal: desiredStartDate || "" },
    { field: "timeline", oldVal: current.timeline ?? "", newVal: timeline || "" },
  ];

  for (const check of fieldChecks) {
    if (check.oldVal !== check.newVal) {
      edits.push({
        field_name: check.field,
        old_value: check.oldVal,
        new_value: check.newVal,
      });
    }
  }

  if (edits.length === 0) {
    return { error: "No changes detected." };
  }

  // Update the project
  const { error: updateError } = await supabase
    .from("projects")
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("customer_id", user.id);

  if (updateError) {
    console.error("Update project error:", updateError);
    return { error: "Failed to update project. Please try again." };
  }

  // Record all edits in the audit trail
  const editRecords = edits.map((e) => ({
    project_id: projectId,
    ...e,
  }));
  await supabase.from("project_edits").insert(editRecords);

  // Handle new file uploads
  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);

  if (validFiles.length > 0) {
    for (const file of validFiles) {
      const fileExt = file.name.split(".").pop();
      const filePath = `projects/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(filePath, file);

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("project-files").getPublicUrl(filePath);

        let thumbnailUrl: string | null = null;
        if (file.type.startsWith("image/")) {
          thumbnailUrl = await generateAndUploadThumbnail(
            file,
            "project-files",
            filePath
          );
        }

        await supabase.from("project_files").insert({
          project_id: projectId,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          thumbnail_url: thumbnailUrl,
        });
      }
    }
  }

  // Notify existing bidders about the edit
  const { data: bids } = await supabase
    .from("bids")
    .select("bidder_id")
    .eq("project_id", projectId);

  if (bids && bids.length > 0) {
    const changedFieldNames = edits.map((e) =>
      e.field_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
    const notifications = bids.map((bid) => ({
      user_id: bid.bidder_id,
      type: "project_edited",
      title: "A project you bid on was edited",
      message: `"${current.title}" has been updated. Changed: ${changedFieldNames.join(", ")}. Please review the changes.`,
      link: `/bidder/projects/${projectId}`,
    }));
    await supabase.from("notifications").insert(notifications);
  }

  redirect(`/customer/projects/${projectId}`);
}
