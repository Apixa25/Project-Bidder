"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { userHasRole } from "@/lib/auth/roles";
import { isAllowedCredentialFile } from "@/lib/file-uploads";

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

function formatActionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Unknown error";
  }

  const maybeError = error as {
    message?: string;
    error?: string;
    statusCode?: string | number;
  };

  return [maybeError.message, maybeError.error, maybeError.statusCode]
    .filter(Boolean)
    .join(" | ");
}

export async function uploadCredential(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  if (!(await userHasRole(user.id, "bidder"))) {
    return { error: "Enable contractor mode to manage credentials." };
  }

  const field = formData.get("field") as string;
  const file = formData.get("file") as File;

  if (!field || !VALID_FIELDS.includes(field as CredentialField)) {
    return { error: "Invalid credential type." };
  }

  if (!file || file.size === 0) {
    return { error: "Please select a file to upload." };
  }

  if (!isAllowedCredentialFile(file)) {
    return {
      error:
        "Supported credential files are images, PDFs, Word documents, and text files.",
    };
  }

  const fileExt = file.name.split(".").pop();
  const filePath = `credentials/${user.id}/${field}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("credential-files")
    .upload(filePath, file, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    console.error("Credential upload error:", {
      field,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      filePath,
      uploadError,
    });
    return {
      error: `File upload failed: ${formatActionError(uploadError)}`,
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("credential-files").getPublicUrl(filePath);

  const { error: updateError } = await supabase
    .from("bidder_credentials")
    .update({ [field]: publicUrl })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Credential update error:", {
      field,
      filePath,
      publicUrl,
      updateError,
    });
    return {
      error: `Failed to save credential: ${formatActionError(updateError)}`,
    };
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

  if (!(await userHasRole(user.id, "bidder"))) {
    return { error: "Enable contractor mode to manage credentials." };
  }

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
