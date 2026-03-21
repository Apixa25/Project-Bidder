"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CredentialField =
  | "license_url"
  | "bond_url"
  | "insurance_url"
  | "workers_comp_url"
  | "ein_url"
  | "references_url";

const VALID_FIELDS: CredentialField[] = [
  "license_url",
  "bond_url",
  "insurance_url",
  "workers_comp_url",
  "ein_url",
  "references_url",
];

export async function uploadCredential(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const field = formData.get("field") as string;
  const file = formData.get("file") as File;

  if (!field || !VALID_FIELDS.includes(field as CredentialField)) {
    return { error: "Invalid credential type." };
  }

  if (!file || file.size === 0) {
    return { error: "Please select a file to upload." };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `credentials/${user.id}/${field}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("credential-files")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return { error: "File upload failed. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("credential-files").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("bidder_credentials")
    .update({ [field]: publicUrl })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Update error:", updateError);
    return { error: "Failed to save credential. Please try again." };
  }

  revalidatePath("/bidder/credentials");
  return { success: true };
}

export async function removeCredential(field: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  if (!VALID_FIELDS.includes(field as CredentialField)) {
    return { error: "Invalid credential type." };
  }

  const { error } = await supabase
    .from("bidder_credentials")
    .update({ [field]: null })
    .eq("user_id", user.id);

  if (error) {
    console.error("Remove error:", error);
    return { error: "Failed to remove credential." };
  }

  revalidatePath("/bidder/credentials");
  return { success: true };
}
