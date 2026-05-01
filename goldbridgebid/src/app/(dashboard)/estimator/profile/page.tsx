import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";

export default async function EstimatorProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  const [{ data: profile }, { data: estimatorProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, business_name, bio")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("estimator_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Estimator Profile</h1>
        <p className="mt-1 text-text-secondary">
          This profile will power estimator reputation, package attribution, and
          buyer trust.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
            <ShieldCheck className="h-6 w-6 text-secondary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {estimatorProfile?.display_name ||
                profile?.business_name ||
                profile?.full_name ||
                "Estimator profile"}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {estimatorProfile?.headline ||
                "Profile editing and verification will be added in the next build slice."}
            </p>
            <div className="mt-4 rounded-lg border border-dashed border-border bg-bg-warm/50 p-4 text-sm text-text-secondary">
              Verification status:{" "}
              <span className="font-semibold capitalize text-text-primary">
                {estimatorProfile?.verification_status || "not started"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

