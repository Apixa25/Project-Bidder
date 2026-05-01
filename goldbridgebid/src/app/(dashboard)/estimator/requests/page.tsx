import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { userHasRole } from "@/lib/auth/roles";
import { TRADE_LABELS, type TradeCategory } from "@/types/database";

export default async function EstimatorRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await userHasRole(user.id, "estimator"))) redirect("/login");

  const { data: requests } = await supabase
    .from("estimate_requests")
    .select("*")
    .or(`assigned_estimator_id.eq.${user.id},public_to_estimators.eq.true`)
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Estimate Requests</h1>
        <p className="mt-1 text-text-secondary">
          Review open custom-estimate requests from customers, contractors, and
          other marketplace users.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm">
        {(requests || []).length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Inbox className="mx-auto mb-4 h-10 w-10 text-text-muted" />
            <h2 className="text-base font-semibold text-text-primary">
              No visible requests yet
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
              The request inbox is ready for the next slice, when authenticated
              users can submit custom estimate requests.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(requests || []).map((request) => (
              <div key={request.id} className="px-6 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-text-primary">{request.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                      {request.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(request.trades as TradeCategory[]).slice(0, 4).map((trade) => (
                        <span
                          key={trade}
                          className="rounded-full bg-secondary/10 px-2.5 py-1 text-xs font-medium text-secondary"
                        >
                          {TRADE_LABELS[trade]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold capitalize text-text-secondary">
                    {request.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

