import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  if (!fileId) {
    return NextResponse.json({ error: "Invalid file id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to download estimate package files." },
      { status: 401 }
    );
  }

  const admin = createAdminClient();
  const { data: file, error: fileError } = await admin
    .from("estimate_package_files")
    .select("id, package_id, package_version_id, storage_path, file_name, file_type")
    .eq("id", fileId)
    .single();

  if (fileError || !file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const { data: packageRow, error: packageError } = await admin
    .from("estimate_packages")
    .select("id, estimator_id, status, price_cents")
    .eq("id", file.package_id)
    .single();

  if (packageError || !packageRow) {
    return NextResponse.json({ error: "Package not found." }, { status: 404 });
  }

  const isOwner = packageRow.estimator_id === user.id;
  const isAdmin = await userHasRole(user.id, "admin");
  const isFreePublished =
    packageRow.status === "published" && Number(packageRow.price_cents) === 0;

  const [{ data: purchase }, { data: grant }] = await Promise.all([
    admin
      .from("estimate_package_purchases")
      .select("id")
      .eq("package_version_id", file.package_version_id)
      .eq("buyer_id", user.id)
      .maybeSingle(),
    admin
      .from("estimate_package_access_grants")
      .select("id")
      .eq("package_id", file.package_id)
      .eq("grantee_user_id", user.id)
      .or(`package_version_id.is.null,package_version_id.eq.${file.package_version_id}`)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle(),
  ]);

  const canAccess =
    isOwner || isAdmin || isFreePublished || Boolean(purchase) || Boolean(grant);

  if (!canAccess) {
    return NextResponse.json(
      { error: "You do not have permission to download this package file." },
      { status: 403 }
    );
  }

  const { data: fileBlob, error: downloadError } = await admin.storage
    .from("estimate-package-files")
    .download(file.storage_path);

  if (downloadError || !fileBlob) {
    console.error("[estimate-package-files/download] storage error:", downloadError);
    return NextResponse.json(
      { error: "Could not retrieve file from storage." },
      { status: 502 }
    );
  }

  const safeName = file.file_name.replace(/["\r\n]/g, "");
  const encodedName = encodeURIComponent(safeName);
  const contentDisposition = `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`;

  const headers = new Headers();
  headers.set("Content-Type", file.file_type || "application/octet-stream");
  headers.set("Content-Disposition", contentDisposition);
  headers.set("Cache-Control", "private, max-age=300");

  return new NextResponse(fileBlob.stream(), { headers });
}

