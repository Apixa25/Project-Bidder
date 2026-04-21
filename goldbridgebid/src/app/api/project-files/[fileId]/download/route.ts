import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { userHasRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

/**
 * Server-side download proxy for project files.
 *
 * Why this exists:
 *  Browsers honor the HTML `download` attribute (which sets the saved
 *  filename and forces a true save-to-disk) ONLY for same-origin URLs.
 *  Project files live on Supabase Storage at a different domain, so the
 *  attribute is ignored and the file just opens in a new tab.
 *
 * What this route does:
 *  Fetches the file from Supabase Storage server-side and streams it back
 *  to the user with a `Content-Disposition: attachment` header so the
 *  browser triggers a true download with the original filename.
 *
 * Auth rules mirror the in-app project pages exactly:
 *  - Customer who owns the project   -> always allowed
 *  - Admin                            -> always allowed
 *  - Bidder                           -> only when the project is "open"
 *
 * Anyone else (or unauthenticated requests) get a 401/403/404. We use the
 * admin client for the file lookup so the row-level security policies
 * cannot accidentally hide data we already authorized via roles.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  if (!fileId || typeof fileId !== "string") {
    return NextResponse.json({ error: "Invalid file id." }, { status: 400 });
  }

  // Auth: must be a logged-in user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to download project files." },
      { status: 401 }
    );
  }

  // Look up the file + the parent project's customer_id and status so we
  // can enforce visibility consistently with the rest of the app.
  const admin = createAdminClient();
  const { data: file, error: fileError } = await admin
    .from("project_files")
    .select("id, file_url, file_name, file_type, project_id")
    .eq("id", fileId)
    .single();

  if (fileError || !file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id, customer_id, status")
    .eq("id", file.project_id)
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: "Project not found." },
      { status: 404 }
    );
  }

  const isOwner = project.customer_id === user.id;
  const isAdmin = await userHasRole(user.id, "admin");
  const isBidder = await userHasRole(user.id, "bidder");

  const canAccess =
    isOwner || isAdmin || (isBidder && project.status === "open");

  if (!canAccess) {
    return NextResponse.json(
      { error: "You do not have permission to download this file." },
      { status: 403 }
    );
  }

  // Fetch the file from Supabase Storage. We don't expose the underlying
  // file_url to the client, which keeps the door open for moving to a
  // signed-URL bucket in the future without touching the front end.
  let fileResponse: Response;
  try {
    fileResponse = await fetch(file.file_url);
  } catch (error) {
    console.error("[project-files/download] fetch error:", error);
    return NextResponse.json(
      { error: "Could not retrieve file from storage." },
      { status: 502 }
    );
  }

  if (!fileResponse.ok || !fileResponse.body) {
    console.error(
      "[project-files/download] storage returned non-OK:",
      fileResponse.status,
      file.file_url
    );
    return NextResponse.json(
      { error: "Storage returned an error." },
      { status: 502 }
    );
  }

  // Build a safe Content-Disposition value.
  //  - Strip quote characters that would break the header.
  //  - Provide both `filename=` (legacy) and `filename*=UTF-8''...` (RFC 5987)
  //    so non-ASCII filenames survive in modern browsers.
  const safeName = file.file_name.replace(/["\r\n]/g, "");
  const encodedName = encodeURIComponent(safeName);
  const contentDisposition = `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`;

  // Stream the file body back to the browser. Using fileResponse.body keeps
  // memory usage flat — we don't load the whole file into RAM on Vercel,
  // which matters for big blueprint sets and PDFs.
  const headers = new Headers();
  headers.set(
    "Content-Type",
    file.file_type || fileResponse.headers.get("content-type") || "application/octet-stream"
  );
  headers.set("Content-Disposition", contentDisposition);
  headers.set("Cache-Control", "private, max-age=300");

  const contentLength = fileResponse.headers.get("content-length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new NextResponse(fileResponse.body, { headers });
}
