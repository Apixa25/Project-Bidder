import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import type {
  EstimatePackage,
  EstimatePackageVersion,
} from "@/types/database";
import EditEstimatePackageForm from "./EditEstimatePackageForm";

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

  const [{ data: versionRow }, { count: purchaseCount }] = await Promise.all([
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
  ]);

  if (!versionRow) notFound();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Edit Estimate Package
        </h1>
        <p className="mt-1 max-w-3xl text-text-secondary">
          Update package basics and scope details. Package files are managed from
          the package detail page while the active version is a draft.
        </p>
      </div>

      <EditEstimatePackageForm
        packageRow={currentPackage}
        version={versionRow as EstimatePackageVersion}
        hasPurchases={Boolean(purchaseCount)}
      />
    </div>
  );
}
