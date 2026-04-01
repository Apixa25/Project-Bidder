"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getProfileRevalidatePaths, getUserRoles } from "@/lib/auth/roles";
import { FORM_TRADES, type TradeCategory } from "@/types/database";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const fullName = formData.get("fullName") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const state = formData.get("state") as string;
  const zip = formData.get("zip") as string;
  const bio = formData.get("bio") as string;
  const businessName = formData.get("businessName") as string;
  const selectedSpecialties = Array.from(
    new Set(
      formData
        .getAll("specialties")
        .filter((value): value is string => typeof value === "string")
    )
  );

  if (!fullName || !phone || !address) {
    return { error: "Name, phone, and address are required." };
  }

  const validTrades = new Set<string>(FORM_TRADES);
  const specialties = selectedSpecialties.filter((trade) =>
    validTrades.has(trade)
  ) as TradeCategory[];

  if (specialties.length !== selectedSpecialties.length) {
    return { error: "One or more selected specialties are invalid." };
  }

  const updateData: Record<string, string | null> = {
    full_name: fullName,
    phone,
    address,
    city: city || "",
    state: state || "",
    zip: zip || "",
    bio: bio || null,
  };

  if (businessName !== undefined && businessName !== null) {
    updateData.business_name = businessName || null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("user_id", user.id);

  if (error) {
    console.error("Profile update error:", error);
    return { error: "Failed to update profile." };
  }

  const currentRoles = await getUserRoles(user.id);

  if (currentRoles.includes("bidder")) {
    const { error: deleteSpecialtiesError } = await supabase
      .from("bidder_specialties")
      .delete()
      .eq("user_id", user.id);

    if (deleteSpecialtiesError) {
      console.error("Bidder specialty reset error:", deleteSpecialtiesError);
      return { error: "Profile saved, but specialties could not be updated." };
    }

    if (specialties.length > 0) {
      const { error: specialtyInsertError } = await supabase
        .from("bidder_specialties")
        .insert(
          specialties.map((trade, index) => ({
            user_id: user.id,
            trade,
            display_order: index,
          }))
        );

      if (specialtyInsertError) {
        console.error("Bidder specialty insert error:", specialtyInsertError);
        return { error: "Profile saved, but specialties could not be updated." };
      }
    }
  }

  const revalidatePaths = await getProfileRevalidatePaths(user.id);
  revalidatePaths.forEach((path) => revalidatePath(path));
  revalidatePath("/customer/contractors");

  return { success: true };
}
