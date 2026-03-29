"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export async function enableRole(role: UserRole) {
  if (role !== "customer" && role !== "bidder") {
    return { error: "Only customer and bidder roles can be enabled here." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to enable another role." };
  }

  const { error: roleError } = await supabase.from("user_roles").upsert(
    {
      user_id: user.id,
      role,
    },
    { onConflict: "user_id,role", ignoreDuplicates: true }
  );

  if (roleError) {
    console.error("Enable role error:", roleError);
    return { error: "Unable to enable that role right now." };
  }

  if (role === "bidder") {
    const { error: credentialsError } = await supabase
      .from("bidder_credentials")
      .upsert(
        {
          user_id: user.id,
        },
        { onConflict: "user_id", ignoreDuplicates: true }
      );

    if (credentialsError) {
      console.error("Bidder credential bootstrap error:", credentialsError);
      return { error: "Bidder mode was enabled, but credential setup failed." };
    }
  }

  revalidatePath("/customer");
  revalidatePath("/bidder");
  revalidatePath("/customer/profile");
  revalidatePath("/bidder/profile");

  return { success: true };
}
