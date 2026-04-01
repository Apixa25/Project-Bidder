"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { TradeCategory } from "@/types/database";
import { userHasRole } from "@/lib/auth/roles";

export async function submitBid(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to submit a bid." };
  }

  if (!(await userHasRole(user.id, "bidder"))) {
    return { error: "Enable contractor mode to submit bids." };
  }

  const projectId = formData.get("projectId") as string;
  const trade = formData.get("trade") as string;
  const price = formData.get("price") as string;
  const priceBreakdown = formData.get("priceBreakdown") as string;
  const estimatedTimeline = formData.get("estimatedTimeline") as string;
  const estimatedStartDate = formData.get("estimatedStartDate") as string;
  const notes = formData.get("notes") as string;

  if (!projectId || !trade || !price || !estimatedTimeline || !estimatedStartDate) {
    return { error: "Please fill in all required fields." };
  }

  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return { error: "Please enter a valid bid price." };
  }

  // Check if already bid on this trade for this project
  const { data: existingBid } = await supabase
    .from("bids")
    .select("id")
    .eq("project_id", projectId)
    .eq("bidder_id", user.id)
    .eq("trade", trade)
    .single();

  if (existingBid) {
    return { error: "You have already submitted a bid for this trade on this project." };
  }

  const { data: bid, error: bidError } = await supabase
    .from("bids")
    .insert({
      project_id: projectId,
      bidder_id: user.id,
      trade: trade as TradeCategory,
      price: parsedPrice,
      price_breakdown: priceBreakdown || null,
      estimated_timeline: estimatedTimeline,
      estimated_start_date: estimatedStartDate,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (bidError) {
    console.error("Bid submission error:", bidError);
    return { error: "Failed to submit bid. Please try again." };
  }

  // Handle file uploads
  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f.size > 0);

  if (validFiles.length > 0 && bid) {
    for (const file of validFiles) {
      const fileExt = file.name.split(".").pop();
      const filePath = `bids/${bid.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("bid-files")
        .upload(filePath, file, { contentType: file.type || undefined });

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("bid-files").getPublicUrl(filePath);

        await supabase.from("bid_files").insert({
          bid_id: bid.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
        });
      }
    }
  }

  // Notify the project owner
  const { data: project } = await supabase
    .from("projects")
    .select("customer_id, title")
    .eq("id", projectId)
    .single();

  if (project) {
    await supabase.from("notifications").insert({
      user_id: project.customer_id,
      type: "new_bid",
      title: "New bid received!",
      message: `A contractor has submitted a bid on "${project.title}".`,
      link: `/customer/projects/${projectId}`,
    });
  }

  redirect(`/bidder/bids`);
}
