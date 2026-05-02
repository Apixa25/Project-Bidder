import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import type {
  EstimatePackage,
  EstimatePackageFile,
  EstimatePackageVersion,
} from "@/types/database";
import EditEstimatePackageForm from "./EditEstimatePackageForm";
import PackageFileUploadForm, {
  DeletePackageFileButton,
} from "../PackageFileUploadForm";

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function EditEstimatePackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  const { data: packageRow } = await supabase
    .from("estimate_packages")
    .select("*")
    .eq("id", id)
    .eq("estimator_id", user.id)
    .single();

  if (!packageRow) notFound();

  const currentPackage = packageRow as EstimatePackage;
  if (!currentPackage.current_version_id) notFound();

  const [
    { data: versionRow },
    { count: purchaseCount },
    { data: fileRows },
  ] = await Promise.all([
    supabase
      .from("estimate_package_versions")
      .select("*")
      .eq("id", currentPackage.current_version_id)
      .eq("package_id", currentPackage.id)
      .single(),
    supabase
      .from("estimate_package_purchases")
      .select("*", { count: "exact", head: true })
      .eq("package_version_id", currentPackage.current_version_id),
    supabase
      .from("estimate_package_files")
      .select("*")
      .eq("package_version_id", currentPackage.current_version_id)
      .order("display_order", { ascending: true })
      .order("uploaded_at", { ascending: true }),
  ]);

  if (!versionRow) notFound();

  const packageFiles = (fileRows || []) as EstimatePackageFile[];
  const canEditFiles = currentPackage.status === "draft";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Edit Estimate Package
        </h1>
        <p className="mt-1 max-w-3xl text-text-secondary">
          Update package basics, scope details, and draft package files from one
          working page.
        </p>
      </div>

      <EditEstimatePackageForm
        packageRow={currentPackage}
        version={versionRow as EstimatePackageVersion}
        hasPurchases={Boolean(purchaseCount)}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <section className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Package Files
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              These files are attached to the active package version.
            </p>
          </div>

          {packageFiles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileText className="mx-auto mb-4 h-10 w-10 text-text-muted" />
              <h3 className="text-base font-semibold text-text-primary">
                No files uploaded yet
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
                Add scanned estimates, PDFs, spreadsheets, CAD exports, images,
                or scope documents buyers should receive.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {packageFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-4 px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-text-primary">
                      {file.file_name}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {file.file_type || "File"} ·{" "}
                      {formatFileSize(file.file_size_bytes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/api/estimate-package-files/${file.id}/download`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-warm px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Link>
                    {canEditFiles && <DeletePackageFileButton fileId={file.id} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <PackageFileUploadForm
          packageId={currentPackage.id}
          packageVersionId={currentPackage.current_version_id}
          canEditFiles={canEditFiles}
        />
      </div>
    </div>
  );
}
