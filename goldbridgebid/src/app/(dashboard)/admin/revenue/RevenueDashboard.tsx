"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DollarSign, TrendingUp, ArrowDownLeft, Percent } from "lucide-react";
import AdminStatCard from "@/components/admin/AdminStatCard";

interface Props {
  rangeDays: number;
  totals: {
    funded: number;
    platformFees: number;
    contractorPayouts: number;
    refunded: number;
    fundedPools: number;
  };
  claimsByStatus: Record<string, { count: number; amount: number }>;
  revenueOverTime: {
    date: string;
    funded: number;
    fees: number;
    payouts: number;
    refunds: number;
  }[];
}

const FRIENDLY_STATUS: Record<string, string> = {
  paid_reserved: "Reserved",
  payout_pending: "Payout Pending",
  paid_out: "Paid Out",
  payout_denied_refunded: "Denied / Refunded",
  expired_refunded: "Expired / Refunded",
};

const STATUS_COLORS: Record<string, string> = {
  paid_reserved: "bg-blue-100 text-blue-700",
  payout_pending: "bg-amber-100 text-amber-700",
  paid_out: "bg-green-100 text-green-700",
  payout_denied_refunded: "bg-red-100 text-red-700",
  expired_refunded: "bg-gray-100 text-gray-600",
};

export default function RevenueDashboard({
  rangeDays,
  totals,
  claimsByStatus,
  revenueOverTime,
}: Props) {
  const statCards = [
    {
      label: "Total Funded",
      value: `$${totals.funded.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Platform Fees",
      value: `$${totals.platformFees.toLocaleString()}`,
      icon: Percent,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "Contractor Payouts",
      value: `$${totals.contractorPayouts.toLocaleString()}`,
      icon: TrendingUp,
      color: "bg-secondary/10 text-secondary",
    },
    {
      label: "Total Refunded",
      value: `$${totals.refunded.toLocaleString()}`,
      icon: ArrowDownLeft,
      color: "bg-red-100 text-red-600",
    },
  ];

  const claimStatusData = Object.entries(claimsByStatus).map(([status, data]) => ({
    status: FRIENDLY_STATUS[status] || status.replace(/_/g, " "),
    rawStatus: status,
    ...data,
  }));

  return (
    <div>
      {/* Summary Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <AdminStatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Revenue Over Time */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Funding Over Time ({rangeDays}d)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={revenueOverTime}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v.toLocaleString()}`}
            />
            <Tooltip
              formatter={(v) => `$${Number(v).toLocaleString()}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="funded"
              stackId="1"
              stroke="#D97706"
              fill="#D97706"
              fillOpacity={0.3}
              name="Funded"
            />
            <Area
              type="monotone"
              dataKey="fees"
              stackId="2"
              stroke="#15803D"
              fill="#15803D"
              fillOpacity={0.3}
              name="Platform Fees"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Claims by Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Claims by Status
          </h2>
          {claimStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={claimStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="status"
                  tick={{ fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#D97706" radius={[4, 4, 0, 0]} name="Claims" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">
              No claims yet.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Claim Amounts by Status
          </h2>
          <div className="space-y-3">
            {claimStatusData.length > 0 ? (
              claimStatusData.map((row) => (
                <div
                  key={row.rawStatus}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-warm px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[row.rawStatus] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.status}
                    </span>
                    <span className="text-sm text-text-muted">
                      {row.count} claim{row.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-text-primary">
                    ${row.amount.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-text-muted">
                No claims yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pool Summary */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">
          Pool Summary
        </h2>
        <p className="text-sm text-text-secondary">
          {totals.fundedPools} funded pool{totals.fundedPools !== 1 ? "s" : ""} ·{" "}
          ${totals.funded.toLocaleString()} total funded ·{" "}
          ${totals.platformFees.toLocaleString()} in platform fees
          {totals.funded > 0 && (
            <> · {((totals.platformFees / totals.funded) * 100).toFixed(1)}% effective fee rate</>
          )}
        </p>
      </div>
    </div>
  );
}
