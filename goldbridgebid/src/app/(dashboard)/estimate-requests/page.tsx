import { redirect } from "next/navigation";
import { ClipboardPenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function EstimateRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: requests } = await supabase
    .from("estimate_requests")
    .select("*")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            My Estimate Requests
          </h1>
          <p className="mt-1 text-text-secondary">
            Any authenticated user can request a custom professional estimate.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-accent-light/70 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          title="Request creation is coming in the next build slice."
        >
          <ClipboardPenLine className="h-4 w-4" />
          New Request Soon
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {(requests || []).length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ClipboardPenLine className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h2 className="text-base font-semibold text-text-primary">
              No estimate requests yet
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
              The database and access model are ready. The next slice will add
              the request form and estimator assignment workflow.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(requests || []).map((request) => (
              <div key={request.id} className="px-6 py-4">
                <h2 className="font-semibold text-text-primary">{request.title}</h2>
                <p className="mt-1 text-sm text-text-secondary">{request.description}</p>
                <span className="mt-3 inline-flex rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold capitalize text-text-secondary">
                  {request.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

