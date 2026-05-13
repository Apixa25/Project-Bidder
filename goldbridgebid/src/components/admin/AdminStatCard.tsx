import { type LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AdminStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: {
    value: number;
    previousValue?: number;
    label: string;
  };
}

export default function AdminStatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
}: AdminStatCardProps) {
  const pctChange =
    trend?.previousValue !== undefined && trend.previousValue > 0
      ? Math.round(((trend.value - trend.previousValue) / trend.previousValue) * 100)
      : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <p className="text-sm text-text-muted">{label}</p>
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            {trend.value > 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            ) : trend.value < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-text-muted" />
            )}
            <span
              className={
                trend.value > 0
                  ? "text-green-600"
                  : trend.value < 0
                    ? "text-red-500"
                    : "text-text-muted"
              }
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}
            </span>
            <span className="text-text-muted">{trend.label}</span>
          </div>
          {pctChange !== null && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                pctChange > 0
                  ? "bg-green-100 text-green-700"
                  : pctChange < 0
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {pctChange > 0 ? "+" : ""}
              {pctChange}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
