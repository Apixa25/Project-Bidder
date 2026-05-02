import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import { validateEstimatePackageFiles } from "@/lib/upload-validation";

interface UploadedPackageFile {
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
}

function isUploadedPackageFile(value: unknown): value is UploadedPackageFile {
  if (!value || typeof value !== "object") return false;

  const file = value as Partial<UploadedPackageFile>;
  return (
    typeof file.storagePath === "string" &&
    typeof file.fileName === "string" &&
    typeof file.fileType === "string" &&
    typeof file.fileSizeBytes === "number" &&
    Number.isFinite(file.fileSizeBytes) &&
    file.fileSizeBytes > 0
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!(await userHasRole(user.id, "estimator"))) {
    return NextResponse.json(
      { error: "Estimator mode is not enabled for this account." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        packageId?: unknown;
        packageVersionId?: unknown;
        files?: unknown;
      }
    | null;
  const packageId = typeof body?.packageId === "string" ? body.packageId : "";
  const packageVersionId =
    typeof body?.packageVersionId === "string" ? body.packageVersionId : "";
  const files = Array.isArray(body?.files)
    ? body.files.filter(isUploadedPackageFile)
    : [];

  if (!packageId || !packageVersionId) {
    return NextResponse.json(
      { error: "Package id and version id are required." },
      { status: 400 }
    );
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Choose at least one file to upload." },
      { status: 400 }
    );
  }

  const validationError = validateEstimatePackageFiles(
    files.map((file) => ({
      name: file.fileName,
      type: file.fileType,
      size: file.fileSizeBytes,
    }))
  );

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const expectedPathPrefix = `estimators/${user.id}/packages/${packageId}/versions/${packageVersionId}/`;
  const invalidPath = files.find(
    (file) => !file.storagePath.startsWith(expectedPathPrefix)
  );

  if (invalidPath) {
    return NextResponse.json(
      { error: "One or more uploaded files had an invalid storage path." },
      { status: 400 }
    );
  }

  const { data: packageRow, error: packageError } = await supabase
    .from("estimate_packages")
    .select("id, estimator_id, status, current_version_id")
    .eq("id", packageId)
    .eq("estimator_id", user.id)
    .single();

  if (packageError || !packageRow) {
    return NextResponse.json(
      { error: "Estimate package could not be found." },
      { status: 404 }
    );
  }

  if (packageRow.status !== "draft") {
    return NextResponse.json(
      { error: "Files can only be changed while a package is a draft." },
      { status: 400 }
    );
  }

  if (packageRow.current_version_id !== packageVersionId) {
    return NextResponse.json(
      { error: "Package version snapshot is no longer current." },
      { status: 409 }
    );
  }

  const { count } = await supabase
    .from("estimate_package_files")
    .select("*", { count: "exact", head: true })
    .eq("package_version_id", packageVersionId);

  const fileRows = files.map((file, index) => ({
    package_id: packageId,
    package_version_id: packageVersionId,
    storage_path: file.storagePath,
    file_name: file.fileName,
    file_type: file.fileType || "application/octet-stream",
    file_size_bytes: file.fileSizeBytes,
    display_order: (count || 0) + index,
  }));

  const { error: insertError } = await supabase
    .from("estimate_package_files")
    .insert(fileRows);

  if (insertError) {
    console.error("Estimate package file register error:", insertError);
    await supabase.storage
      .from("estimate-package-files")
      .remove(files.map((file) => file.storagePath));

    return NextResponse.json(
      { error: "Files uploaded, but could not be attached to the package." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
