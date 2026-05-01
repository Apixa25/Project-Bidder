import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";

export default async function EstimatorMessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Estimator Messages</h1>
        <p className="mt-1 text-text-secondary">
          Estimator-specific package and request messaging will be added after
          the package/request workflows are active.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center shadow-sm">
        <MessageSquare className="mx-auto mb-4 h-10 w-10 text-text-muted" />
        <h2 className="text-base font-semibold text-text-primary">
          Messaging scaffold ready
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
          The current customer/contractor project messaging stays unchanged.
          Estimator conversations should be added separately around package
          purchases and custom estimate requests.
        </p>
      </div>
    </div>
  );
}

