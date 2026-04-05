"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { TradeCategory } from "@/types/database";
import { generateAndUploadThumbnail } from "@/lib/generate-thumbnail";
import { userHasRole } from "@/lib/auth/roles";
import { validateProjectUploadFile } from "@/lib/upload-validation";
import { createPaidEstimateCheckoutSessionForProject } from "./[id]/paid-estimates/actions";

interface CreateProjectResult {
  error: string | null;
  redirectUrl: string | null;
}

export async function createProject(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "You must be logged in to create a project.",
      redirectUrl: null,
    } satisfies CreateProjectResult;
  }

  if (!(await userHasRole(user.id, "customer"))) {
    return {
      error: "Enable customer mode to post and manage projects.",
      redirectUrl: null,
    } satisfies CreateProjectResult;
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

  console.info("createProject: received submit", {
    userId: user.id,
    hasTitle: Boolean(title),
    hasDescription: Boolean(description),
    hasCompletionCriteria: Boolean(completionCriteria),
    tradeCount: tradesRaw.length,
    hasLocationAddress: Boolean(locationAddress),
    hasLocationCity: Boolean(locationCity),
    hasLocationState: Boolean(locationState),
    hasLocationZip: Boolean(locationZip),
    enablePaidEstimate: formData.get("enablePaidEstimate") === "true",
    rewardAmount: formData.get("rewardAmount"),
    maxPaidSlots: formData.get("maxPaidSlots"),
    filter: formData.get("filter"),
    fileCount: formData.getAll("files").filter((file) => file instanceof File && file.size > 0).length,
  });

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
    return {
      error: "Please fill in all required fields.",
      redirectUrl: null,
    } satisfies CreateProjectResult;
  }

  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);
  for (const file of validFiles) {
    const validationError = validateProjectUploadFile(file);
    if (validationError) {
      return {
        error: validationError,
        redirectUrl: null,
      } satisfies CreateProjectResult;
    }
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
    console.error("Project creation error:", {
      code: projectError.code,
      message: projectError.message,
      details: projectError.details,
      hint: projectError.hint,
    });
    return {
      error: "Failed to create project. Please try again.",
      redirectUrl: null,
    } satisfies CreateProjectResult;
  }

  console.info("createProject: project created", {
    userId: user.id,
    projectId: project.id,
    enablePaidEstimate: formData.get("enablePaidEstimate") === "true",
  });

  // Handle file uploads
  if (validFiles.length > 0 && project) {
    for (const file of validFiles) {
      try {
        const fileExt = file.name.split(".").pop();
        const filePath = `projects/${project.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(filePath, file, { contentType: file.type || undefined });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          continue;
        }

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

        const insertData: Record<string, unknown> = {
          project_id: project.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
        };
        if (thumbnailUrl) {
          insertData.thumbnail_url = thumbnailUrl;
        }

        const { error: insertError } = await supabase
          .from("project_files")
          .insert(insertData);

        if (insertError) {
          console.error("project_files insert error:", insertError);
        }
      } catch (err) {
        console.error("File processing error:", err);
      }
    }
  }

  const shouldCreatePaidEstimate =
    formData.get("enablePaidEstimate") === "true";

  if (shouldCreatePaidEstimate) {
    console.info("createProject: preparing paid estimate checkout", {
      userId: user.id,
      projectId: project.id,
      rewardAmount: formData.get("rewardAmount"),
      maxPaidSlots: formData.get("maxPaidSlots"),
      filter: formData.get("filter"),
    });

    const paidEstimateResult = await createPaidEstimateCheckoutSessionForProject({
      customerId: user.id,
      projectId: project.id,
      rewardAmountRaw: (formData.get("rewardAmount") as string) || "",
      maxPaidSlotsRaw: (formData.get("maxPaidSlots") as string) || "",
      filterValue: formData.get("filter"),
    });

    if (paidEstimateResult.checkoutUrl) {
      console.info("createProject: paid estimate checkout created", {
        userId: user.id,
        projectId: project.id,
      });
      return {
        error: null,
        redirectUrl: paidEstimateResult.checkoutUrl,
      } satisfies CreateProjectResult;
    }

    console.error("createProject: paid estimate checkout preparation failed", {
      userId: user.id,
      projectId: project.id,
      error: paidEstimateResult.error,
    });

    return {
      error:
        paidEstimateResult.error ||
        "Project was created, but paid estimate checkout could not be prepared.",
      redirectUrl: `/customer/projects/${project.id}?paidEstimateSetup=failed`,
    } satisfies CreateProjectResult;
  }

  return {
    error: null,
    redirectUrl: `/customer/projects/${project.id}`,
  } satisfies CreateProjectResult;
}

export async function updateProjectStatus(projectId: string, status: "open" | "closed") {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage projects." };
  }

  const { error } = await supabase
    .from("projects")
    .update({
      status,
      ...(status === "closed"
        ? {}
        : {
            awarded_bid_id: null,
            awarded_bidder_id: null,
            awarded_at: null,
          }),
    })
    .eq("id", projectId)
    .eq("customer_id", user.id);

  if (error) {
    return { error: "Failed to update project status." };
  }

  if (status === "closed") {
    const { data: bids } = await supabase
      .from("bids")
      .select("bidder_id")
      .eq("project_id", projectId);

    if (bids) {
      const notifications = bids.map((bid) => ({
        user_id: bid.bidder_id,
        type: "project_closed",
        title: "Project has been closed",
        message: "A project you bid on has been closed.",
        link: `/bidder/bids`,
      }));

      await supabase.from("notifications").insert(notifications);
    }
  }

  return { success: true };
}

export async function awardBid(projectId: string, bidId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to award projects." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, status, customer_id, awarded_bid_id")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!project) {
    return { error: "Project not found." };
  }

  if (project.status !== "open") {
    return { error: "Only open projects can be awarded." };
  }

  if (project.awarded_bid_id) {
    return { error: "This project already has a winning bid." };
  }

  const { data: bid } = await supabase
    .from("bids")
    .select("id, bidder_id")
    .eq("id", bidId)
    .eq("project_id", projectId)
    .single();

  if (!bid) {
    return { error: "Winning bid not found." };
  }

  const awardedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      status: "awarded",
      awarded_bid_id: bid.id,
      awarded_bidder_id: bid.bidder_id,
      awarded_at: awardedAt,
    })
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .eq("status", "open");

  if (updateError) {
    console.error("Award bid error:", updateError);
    return { error: "Failed to award this bid. Please try again." };
  }

  const { data: allBids } = await supabase
    .from("bids")
    .select("bidder_id")
    .eq("project_id", projectId);

  if (allBids && allBids.length > 0) {
    const notifications = allBids.map((projectBid) => {
      const isWinner = projectBid.bidder_id === bid.bidder_id;

      return {
        user_id: projectBid.bidder_id,
        type: "project_awarded",
        title: isWinner ? "Your bid was awarded" : "Project has been awarded",
        message: isWinner
          ? `Congratulations! Your bid for "${project.title}" was selected.`
          : `The project "${project.title}" has been awarded to another contractor.`,
        link: `/bidder/bids`,
      };
    });

    await supabase.from("notifications").insert(notifications);
  }

  return { success: true };
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to manage projects." };
  }

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

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to annotate project files." };
  }

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

  if (!(await userHasRole(user.id, "customer"))) {
    return { error: "Enable customer mode to update projects." };
  }

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

  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);
  for (const file of validFiles) {
    const validationError = validateProjectUploadFile(file);
    if (validationError) {
      return { error: validationError };
    }
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
  if (validFiles.length > 0) {
    for (const file of validFiles) {
      try {
        const fileExt = file.name.split(".").pop();
        const filePath = `projects/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(filePath, file, { contentType: file.type || undefined });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          continue;
        }

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

        const insertData: Record<string, unknown> = {
          project_id: projectId,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
        };
        if (thumbnailUrl) {
          insertData.thumbnail_url = thumbnailUrl;
        }

        const { error: insertError } = await supabase
          .from("project_files")
          .insert(insertData);

        if (insertError) {
          console.error("project_files insert error:", insertError);
        }
      } catch (err) {
        console.error("File processing error:", err);
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
