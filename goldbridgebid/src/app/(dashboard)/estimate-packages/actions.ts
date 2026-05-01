"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function unlockFreeEstimatePackage(packageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in to unlock this package." };

  const admin = createAdminClient();
  const { data: packageRow, error: packageError } = await admin
    .from("estimate_packages")
    .select("id, estimator_id, status, price_cents, currency, current_version_id")
    .eq("id", packageId)
    .single();

  if (packageError || !packageRow) {
    return { error: "Estimate package could not be found." };
  }

  if (packageRow.status !== "published") {
    return { error: "Only published packages can be unlocked." };
  }

  if (Number(packageRow.price_cents) !== 0) {
    return { error: "This package requires paid checkout." };
  }

  if (!packageRow.current_version_id) {
    return { error: "This package does not have a published version yet." };
  }

  if (packageRow.estimator_id === user.id) {
    return { success: true };
  }

  const { error: purchaseError } = await admin
    .from("estimate_package_purchases")
    .upsert(
      {
        package_id: packageRow.id,
        package_version_id: packageRow.current_version_id,
        buyer_id: user.id,
        seller_id: packageRow.estimator_id,
        price_cents: 0,
        currency: packageRow.currency || "usd",
      },
      { onConflict: "package_version_id,buyer_id", ignoreDuplicates: true }
    );

  if (purchaseError) {
    console.error("Free estimate package unlock error:", purchaseError);
    return { error: "Unable to unlock this package right now." };
  }

  revalidatePath("/estimate-packages");
  revalidatePath(`/estimate-packages/${packageRow.id}`);

  return { success: true };
}

