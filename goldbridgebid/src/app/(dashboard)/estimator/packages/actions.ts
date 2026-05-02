"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import {
  FORM_TRADES,
  type EstimatePackageType,
  type TradeCategory,
} from "@/types/database";
import { validateEstimatePackageFiles } from "@/lib/upload-validation";

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

async function requireCompleteEstimatorProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: profile, error } = await supabase
    .from("estimator_profiles")
    .select("display_name, headline, bio")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    return {
      error:
        "Complete your estimator profile before publishing. Go to /estimator/profile to add your display name and headline or bio.",
    };
  }

  const hasDisplayName = Boolean(profile.display_name?.trim());
  const hasPublicSummary = Boolean(profile.headline?.trim() || profile.bio?.trim());

  if (!hasDisplayName || !hasPublicSummary) {
    return {
      error:
        "Complete your estimator profile before publishing. Add a display name plus a headline or bio at /estimator/profile.",
    };
  }

  return { success: true };
}

async function insertEstimatePackageFiles(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  packageId: string;
  packageVersionId: string;
  files: File[];
  startingDisplayOrder?: number;
}) {
  const {
    supabase,
    userId,
    packageId,
    packageVersionId,
    files,
    startingDisplayOrder = 0,
  } = options;
  let displayOrder = startingDisplayOrder;

  for (const file of files) {
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
    const storagePath = `estimators/${userId}/packages/${packageId}/versions/${packageVersionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("estimate-package-files")
      .upload(storagePath, file, { contentType: file.type || undefined });

    if (uploadError) {
      console.error("Estimate package file upload error:", uploadError);
      return { error: `Unable to upload "${file.name}".` };
    }

    const { error: insertError } = await supabase
      .from("estimate_package_files")
      .insert({
        package_id: packageId,
        package_version_id: packageVersionId,
        storage_path: storagePath,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
        display_order: displayOrder,
      });

    if (insertError) {
      console.error("Estimate package file insert error:", insertError);
      await supabase.storage.from("estimate-package-files").remove([storagePath]);
      return { error: `Uploaded "${file.name}", but could not save its record.` };
    }

    displayOrder += 1;
  }

  return { success: true };
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
  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);
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

  const validationError = validateEstimatePackageFiles(files);
  if (validationError) {
    return { error: validationError };
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

  if (files.length > 0) {
    const uploadResult = await insertEstimatePackageFiles({
      supabase,
      userId: user.id,
      packageId: packageRow.id,
      packageVersionId: versionRow.id,
      files,
    });

    if ("error" in uploadResult) {
      return {
        error: `Package draft was created, but files were not attached: ${uploadResult.error}`,
        packageId: packageRow.id,
      };
    }
  }

  revalidatePath("/estimator");
  revalidatePath("/estimator/packages");
  revalidatePath(`/estimator/packages/${packageRow.id}`);

  return { success: true, packageId: packageRow.id };
}

export async function updateEstimatePackage(formData: FormData) {
  const auth = await requireEstimator();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;
  const packageId = cleanRequiredText(formData.get("packageId"));
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

  if (!packageId) {
    return { error: "Package id is required." };
  }

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
    .select("id, estimator_id, status, current_version_id")
    .eq("id", packageId)
    .eq("estimator_id", user.id)
    .single();

  if (packageError || !packageRow) {
    return { error: "Estimate package could not be found." };
  }

  if (packageRow.status === "archived") {
    return { error: "Archived packages cannot be edited." };
  }

  if (!packageRow.current_version_id) {
    return { error: "Package version snapshot is missing." };
  }

  const { count: purchaseCount } = await supabase
    .from("estimate_package_purchases")
    .select("*", { count: "exact", head: true })
    .eq("package_version_id", packageRow.current_version_id);

  const hasLockedBuyerVersion =
    packageRow.status === "published" && Boolean(purchaseCount);
  const packageUpdate = {
    title,
    summary,
    package_type: packageType,
    trades,
    price_cents: priceCents,
    currency: "usd",
  };
  const versionSnapshot = {
    title_snapshot: title,
    summary_snapshot: summary,
    scope_overview: scopeOverview,
    assumptions_json: assumptions,
    exclusions_json: exclusions,
    line_items_json: [],
    price_cents_snapshot: priceCents,
    currency_snapshot: "usd",
  };

  if (hasLockedBuyerVersion) {
    const { data: latestVersion } = await supabase
      .from("estimate_package_versions")
      .select("version_number")
      .eq("package_id", packageRow.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersionNumber = Number(latestVersion?.version_number || 0) + 1;

    const { data: newVersion, error: newVersionError } = await supabase
      .from("estimate_package_versions")
      .insert({
        package_id: packageRow.id,
        version_number: nextVersionNumber,
        ...versionSnapshot,
      })
      .select("id")
      .single();

    if (newVersionError || !newVersion) {
      console.error("Estimate package revision create error:", newVersionError);
      return { error: "Unable to create a new draft revision." };
    }

    const { error: revisionUpdateError } = await supabase
      .from("estimate_packages")
      .update({
        ...packageUpdate,
        current_version_id: newVersion.id,
        status: "draft",
        published_at: null,
        archived_at: null,
      })
      .eq("id", packageRow.id)
      .eq("estimator_id", user.id);

    if (revisionUpdateError) {
      console.error("Estimate package revision update error:", revisionUpdateError);
      return { error: "Revision was created, but the package was not updated." };
    }

    revalidatePath("/estimator");
    revalidatePath("/estimator/packages");
    revalidatePath(`/estimator/packages/${packageRow.id}`);
    revalidatePath("/estimate-packages");
    revalidatePath(`/estimate-packages/${packageRow.id}`);

    return {
      success: true,
      packageId: packageRow.id,
      revisionCreated: true,
    };
  }

  const { error: packageUpdateError } = await supabase
    .from("estimate_packages")
    .update(packageUpdate)
    .eq("id", packageRow.id)
    .eq("estimator_id", user.id);

  if (packageUpdateError) {
    console.error("Estimate package update error:", packageUpdateError);
    return { error: "Unable to update estimate package." };
  }

  const { error: versionUpdateError } = await supabase
    .from("estimate_package_versions")
    .update(versionSnapshot)
    .eq("id", packageRow.current_version_id)
    .eq("package_id", packageRow.id);

  if (versionUpdateError) {
    console.error("Estimate package version update error:", versionUpdateError);
    return { error: "Package updated, but version snapshot update failed." };
  }

  revalidatePath("/estimator");
  revalidatePath("/estimator/packages");
  revalidatePath(`/estimator/packages/${packageRow.id}`);
  revalidatePath("/estimate-packages");
  revalidatePath(`/estimate-packages/${packageRow.id}`);

  return { success: true, packageId: packageRow.id, revisionCreated: false };
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

  const profileCheck = await requireCompleteEstimatorProfile(supabase, user.id);
  if ("error" in profileCheck) return profileCheck;

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

export async function uploadEstimatePackageFiles(formData: FormData) {
  const auth = await requireEstimator();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;
  const packageId = cleanRequiredText(formData.get("packageId"));
  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!packageId) {
    return { error: "Package id is required." };
  }

  if (files.length === 0) {
    return { error: "Choose at least one file to upload." };
  }

  const validationError = validateEstimatePackageFiles(files);
  if (validationError) {
    return { error: validationError };
  }

  const { data: packageRow, error: packageError } = await supabase
    .from("estimate_packages")
    .select("id, estimator_id, status, current_version_id")
    .eq("id", packageId)
    .eq("estimator_id", user.id)
    .single();

  if (packageError || !packageRow) {
    return { error: "Estimate package could not be found." };
  }

  if (packageRow.status !== "draft") {
    return { error: "Files can only be changed while a package is a draft." };
  }

  if (!packageRow.current_version_id) {
    return { error: "Package version snapshot is missing." };
  }

  const { count } = await supabase
    .from("estimate_package_files")
    .select("*", { count: "exact", head: true })
    .eq("package_version_id", packageRow.current_version_id);

  const uploadResult = await insertEstimatePackageFiles({
    supabase,
    userId: user.id,
    packageId: packageRow.id,
    packageVersionId: packageRow.current_version_id,
    files,
    startingDisplayOrder: count || 0,
  });

  if ("error" in uploadResult) return uploadResult;

  revalidatePath("/estimator/packages");
  revalidatePath(`/estimator/packages/${packageRow.id}`);

  return { success: true };
}

export async function deleteEstimatePackageFile(fileId: string) {
  const auth = await requireEstimator();
  if ("error" in auth) return auth;

  const { supabase, user } = auth;
  const { data: file, error: fileError } = await supabase
    .from("estimate_package_files")
    .select("id, package_id, package_version_id, storage_path, estimate_packages!inner(estimator_id, status)")
    .eq("id", fileId)
    .single();

  const packageInfo = file?.estimate_packages as
    | { estimator_id: string; status: string }
    | undefined;

  if (fileError || !file || !packageInfo || packageInfo.estimator_id !== user.id) {
    return { error: "Package file could not be found." };
  }

  if (packageInfo.status !== "draft") {
    return { error: "Files can only be deleted while a package is a draft." };
  }

  const { error: deleteError } = await supabase
    .from("estimate_package_files")
    .delete()
    .eq("id", file.id);

  if (deleteError) {
    console.error("Estimate package file delete error:", deleteError);
    return { error: "Unable to remove package file." };
  }

  await supabase.storage
    .from("estimate-package-files")
    .remove([file.storage_path]);

  revalidatePath("/estimator/packages");
  revalidatePath(`/estimator/packages/${file.package_id}`);

  return { success: true };
}

