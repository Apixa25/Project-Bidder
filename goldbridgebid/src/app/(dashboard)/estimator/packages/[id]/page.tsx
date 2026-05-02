import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, LockKeyhole, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import type {
  EstimatePackage,
  EstimatePackageFile,
  EstimatePackageVersion,
} from "@/types/database";
import PackageFileUploadForm, {
  DeletePackageFileButton,
} from "./PackageFileUploadForm";
import PublishPackageButton from "../PublishPackageButton";

function formatPrice(packageRow: Pick<EstimatePackage, "price_cents" | "currency">) {
  if (packageRow.price_cents === 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: packageRow.currency.toUpperCase(),
  }).format(packageRow.price_cents / 100);
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function EstimatorPackageDetailPage({
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
  const [{ data: versionRow }, { data: files }] = await Promise.all([
    currentPackage.current_version_id
      ? supabase
          .from("estimate_package_versions")
          .select("*")
          .eq("id", currentPackage.current_version_id)
          .single()
      : Promise.resolve({ data: null }),
    currentPackage.current_version_id
      ? supabase
          .from("estimate_package_files")
          .select("*")
          .eq("package_version_id", currentPackage.current_version_id)
          .order("display_order", { ascending: true })
          .order("uploaded_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const version = (versionRow || null) as EstimatePackageVersion | null;
  const packageFiles = (files || []) as EstimatePackageFile[];
  const canEditFiles = currentPackage.status === "draft";

  return (
    <div>
      <Link
        href="/estimator/packages"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Packages
      </Link>

      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold capitalize text-text-secondary">
                {currentPackage.status}
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {formatPrice(currentPackage)}
              </span>
              {version && (
                <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                  Version {version.version_number}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-950">
              {currentPackage.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
              {currentPackage.summary}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Link
              href={`/estimator/packages/${currentPackage.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-warm px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Package
            </Link>
            {currentPackage.status === "draft" && (
              <PublishPackageButton packageId={currentPackage.id} />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <section className="rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Version Files
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              These are the files attached to the current version snapshot.
            </p>
          </div>

          {packageFiles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileText className="mx-auto mb-4 h-10 w-10 text-text-muted" />
              <h3 className="text-base font-semibold text-text-primary">
                No files uploaded yet
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
                Add the PDFs, spreadsheets, images, or scope documents buyers
                should receive for this package.
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
                      {file.file_type || "File"} · {formatFileSize(file.file_size_bytes)}
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

        <div className="space-y-6">
          <PackageFileUploadForm
            packageId={currentPackage.id}
            packageVersionId={currentPackage.current_version_id || ""}
            canEditFiles={canEditFiles}
          />

          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-text-primary">
                  Access model
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                  Publish makes the active draft version available in the public
                  estimate package library for buyers to unlock or purchase.
                  Files are stored in a private bucket, and downloads go through
                  a same-origin route that checks estimator ownership, admin
                  access, purchases, or grants.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

