"use client";

import { useActionState, useEffect } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import type {
  PaidEstimateFilter,
  ProjectPaidEstimatePool,
  ProjectStatus,
} from "@/types/database";
import { PAID_ESTIMATE_FILTER_LABELS } from "@/lib/paid-estimates/eligibility";
import {
  getRemainingPaidSlots,
  isPaidEstimatePoolVisibleAsPaid,
} from "@/lib/paid-estimates/pools";
import {
  createPaidEstimateCheckoutSession,
  type PaidEstimateCheckoutActionState,
} from "./paid-estimates/actions";

interface PaidEstimatePoolPanelProps {
  projectId: string;
  projectStatus: ProjectStatus;
  existingPool: ProjectPaidEstimatePool | null;
}

const INITIAL_STATE: PaidEstimateCheckoutActionState = {
  error: null,
  checkoutUrl: null,
};

export default function PaidEstimatePoolPanel({
  projectId,
  projectStatus,
  existingPool,
}: PaidEstimatePoolPanelProps) {
  const [state, formAction, isPending] = useActionState(
    createPaidEstimateCheckoutSession,
    INITIAL_STATE
  );

  useEffect(() => {
    if (state.checkoutUrl) {
      window.location.assign(state.checkoutUrl);
    }
  }, [state.checkoutUrl]);

  const fundedAndVisible = isPaidEstimatePoolVisibleAsPaid(existingPool);
  const remainingSlots = getRemainingPaidSlots(existingPool);
  const filterDefault: PaidEstimateFilter = existingPool?.filter || "open_to_anyone";

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm ring-1 ring-amber-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">
              Paid Estimate Pool
            </h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            Offer money for serious estimates on this project. This supports the
            Phase 3 monetization direction in `project-vision.md` while keeping
            the normal sealed-bid marketplace open for unpaid bids too.
          </p>
        </div>
        {fundedAndVisible && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Paid Estimate Live
          </span>
        )}
      </div>

      {existingPool && (
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-surface px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Reward
            </p>
            <p className="mt-1 text-lg font-bold text-text-primary">
              ${Number(existingPool.reward_amount).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-surface px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Paid Slots
            </p>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {existingPool.claimed_paid_slots}/{existingPool.max_paid_slots}
            </p>
          </div>
          <div className="rounded-lg bg-surface px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Remaining
            </p>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {remainingSlots}
            </p>
          </div>
          <div className="rounded-lg bg-surface px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Filter
            </p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {PAID_ESTIMATE_FILTER_LABELS[existingPool.filter]}
            </p>
          </div>
        </div>
      )}

      {projectStatus !== "open" ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Only open projects can activate paid estimates. Re-open the project
          before creating a funded paid estimate offer.
        </div>
      ) : fundedAndVisible ? (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          This project already has a live funded offer. Editing live offers,
          disputes, and settlement controls will be added in the next phases.
        </div>
      ) : (
        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="projectId" value={projectId} />

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="rewardAmount"
                className="block text-sm font-medium text-text-primary"
              >
                Reward per estimate
              </label>
              <input
                id="rewardAmount"
                name="rewardAmount"
                type="number"
                min="1"
                step="0.01"
                required
                defaultValue={existingPool?.reward_amount ?? 100}
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label
                htmlFor="maxPaidSlots"
                className="block text-sm font-medium text-text-primary"
              >
                Number of paid slots
              </label>
              <input
                id="maxPaidSlots"
                name="maxPaidSlots"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={existingPool?.max_paid_slots ?? 3}
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label
                htmlFor="filter"
                className="block text-sm font-medium text-text-primary"
              >
                Paid eligibility filter
              </label>
              <select
                id="filter"
                name="filter"
                defaultValue={filterDefault}
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="open_to_anyone">Open to anyone</option>
                <option value="core_verified_only">Core verified only</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface px-4 py-4 text-sm text-text-secondary">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
              <p>
                The offer will not carry the public `Paid Estimate` badge until
                Stripe funding succeeds. Contractors can still submit unpaid bids
                even when they do not meet the paid filter.
              </p>
            </div>
          </div>

          {state.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            <CreditCard className="h-4 w-4" />
            {isPending ? "Preparing Stripe Checkout..." : "Continue to Stripe"}
          </button>
        </form>
      )}
    </section>
  );
}
