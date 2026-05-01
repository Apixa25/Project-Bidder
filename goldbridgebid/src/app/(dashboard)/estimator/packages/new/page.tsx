import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import NewEstimatePackageForm from "./NewEstimatePackageForm";

export default async function NewEstimatePackagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          New Estimate Package
        </h1>
        <p className="mt-1 max-w-3xl text-text-secondary">
          Create a draft package for the general marketplace library. This does
          not publish the package yet.
        </p>
      </div>

      <NewEstimatePackageForm />
    </div>
  );
}

