import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Inbox, LibraryBig, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";

export default async function EstimatorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  const [{ data: profile }, { count: packageCount }, { count: requestCount }, { count: reviewCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("estimate_packages")
        .select("*", { count: "exact", head: true })
        .eq("estimator_id", user.id),
      supabase
        .from("estimate_requests")
        .select("*", { count: "exact", head: true })
        .or(`assigned_estimator_id.eq.${user.id},public_to_estimators.eq.true`),
      supabase
        .from("estimate_package_reviews")
        .select("*", { count: "exact", head: true })
        .eq("estimator_id", user.id)
        .eq("status", "published"),
    ]);

  const firstName = (profile?.full_name || profile?.email || "Estimator").split(" ")[0];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-text-secondary">
            Build your estimate library, respond to requests, and protect your
            reputation through high-quality takeoffs.
          </p>
        </div>
        <Link
          href="/estimator/packages"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-light px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:brightness-110"
        >
          <LibraryBig className="h-4 w-4" />
          Manage Packages
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <LibraryBig className="mb-3 h-6 w-6 text-accent-light" />
          <p className="text-2xl font-bold text-text-primary">{packageCount || 0}</p>
          <p className="text-sm text-text-muted">Estimate packages</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <Inbox className="mb-3 h-6 w-6 text-secondary" />
          <p className="text-2xl font-bold text-text-primary">{requestCount || 0}</p>
          <p className="text-sm text-text-muted">Visible requests</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <Star className="mb-3 h-6 w-6 text-amber-500" />
          <p className="text-2xl font-bold text-text-primary">{reviewCount || 0}</p>
          <p className="text-sm text-text-muted">Published reviews</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              First build slice
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
              This workspace is scaffolded for package publishing and request
              management. The next slices will add package creation, file
              uploads, free access, Stripe purchases, and package reviews.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

