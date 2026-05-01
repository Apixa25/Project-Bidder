"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import {
  FORM_TRADES,
  type EstimatePackageType,
  type TradeCategory,
} from "@/types/database";

const PACKAGE_TYPES = new Set<EstimatePackageType>([
  "material_takeoff",
  "bid_ready_scope",
  "estimate_worksheet",
  "plan_review",
  "other",
]);

function cleanRequiredText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalText(value: FormDataEntryValue | null) {
  const cleaned = cleanRequiredText(value);
  return cleaned.length > 0 ? cleaned : null;
}

function splitLines(value: FormDataEntryValue | null) {
  const text = cleanRequiredText(value);
  if (!text) return [];

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePriceCents(value: FormDataEntryValue | null) {
  const raw = cleanRequiredText(value);
  if (!raw) return 0;

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

async function requireEstimator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." as const };
  if (!(await userHasRole(user.id, "estimator"))) {
    return { error: "Estimator mode is not enabled for this account." as const };
  }

  return { supabase, user };
}

export async function createEstimatePackage(formData: FormData) {
  const auth = await requireEstimator();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;
  const title = cleanRequiredText(formData.get("title"));
  const summary = cleanRequiredText(formData.get("summary"));
  const packageTypeRaw = cleanRequiredText(formData.get("packageType"));
  const packageType = packageTypeRaw as EstimatePackageType;
  const scopeOverview = cleanOptionalText(formData.get("scopeOverview"));
  const assumptions = splitLines(formData.get("assumptions"));
  const exclusions = splitLines(formData.get("exclusions"));
  const priceCents = parsePriceCents(formData.get("price"));
  const selectedTrades = Array.from(
    new Set(
      formData
        .getAll("trades")
        .filter((value): value is string => typeof value === "string")
    )
  );
  const validTrades = new Set<string>(FORM_TRADES);
  const trades = selectedTrades.filter((trade) =>
    validTrades.has(trade)
  ) as TradeCategory[];

  if (!title || !summary) {
    return { error: "Package title and summary are required." };
  }

  if (!PACKAGE_TYPES.has(packageType)) {
    return { error: "Please choose a valid package type." };
  }

  if (selectedTrades.length !== trades.length) {
    return { error: "One or more selected trades are invalid." };
  }

  if (priceCents === null) {
    return { error: "Price must be a valid non-negative number." };
  }

  const { data: packageRow, error: packageError } = await supabase
    .from("estimate_packages")
    .insert({
      estimator_id: user.id,
      title,
      summary,
      package_type: packageType,
      trades,
      price_cents: priceCents,
      currency: "usd",
      status: "draft",
    })
    .select("id")
    .single();

  if (packageError || !packageRow) {
    console.error("Estimate package create error:", packageError);
    return { error: "Unable to create estimate package." };
  }

  const { data: versionRow, error: versionError } = await supabase
    .from("estimate_package_versions")
    .insert({
      package_id: packageRow.id,
      version_number: 1,
      title_snapshot: title,
      summary_snapshot: summary,
      scope_overview: scopeOverview,
      assumptions_json: assumptions,
      exclusions_json: exclusions,
      line_items_json: [],
      price_cents_snapshot: priceCents,
      currency_snapshot: "usd",
    })
    .select("id")
    .single();

  if (versionError || !versionRow) {
    console.error("Estimate package version create error:", versionError);
    await supabase.from("estimate_packages").delete().eq("id", packageRow.id);
    return { error: "Package created, but version snapshot setup failed." };
  }

  const { error: updateError } = await supabase
    .from("estimate_packages")
    .update({ current_version_id: versionRow.id })
    .eq("id", packageRow.id)
    .eq("estimator_id", user.id);

  if (updateError) {
    console.error("Estimate package current version update error:", updateError);
    return { error: "Package created, but current version setup failed." };
  }

  revalidatePath("/estimator");
  revalidatePath("/estimator/packages");

  return { success: true, packageId: packageRow.id };
}

export async function publishEstimatePackage(packageId: string) {
  const auth = await requireEstimator();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;
  const { data: packageRow, error: packageError } = await supabase
    .from("estimate_packages")
    .select("id, estimator_id, status, current_version_id")
    .eq("id", packageId)
    .eq("estimator_id", user.id)
    .single();

  if (packageError || !packageRow) {
    return { error: "Estimate package could not be found." };
  }

  if (packageRow.status === "published") {
    return { success: true };
  }

  if (!packageRow.current_version_id) {
    return { error: "Create a package version before publishing." };
  }

  const publishedAt = new Date().toISOString();
  const { error: versionError } = await supabase
    .from("estimate_package_versions")
    .update({ published_at: publishedAt })
    .eq("id", packageRow.current_version_id)
    .eq("package_id", packageRow.id);

  if (versionError) {
    console.error("Estimate package version publish error:", versionError);
    return { error: "Unable to publish package version." };
  }

  const { error: publishError } = await supabase
    .from("estimate_packages")
    .update({
      status: "published",
      published_at: publishedAt,
      archived_at: null,
    })
    .eq("id", packageRow.id)
    .eq("estimator_id", user.id);

  if (publishError) {
    console.error("Estimate package publish error:", publishError);
    return { error: "Unable to publish estimate package." };
  }

  revalidatePath("/estimator");
  revalidatePath("/estimator/packages");
  revalidatePath("/estimate-packages");
  revalidatePath("/admin/estimate-packages");

  return { success: true };
}

