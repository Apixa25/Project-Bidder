"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  FolderOpen,
  ClipboardList,
  Users,
  DollarSign,
  BarChart3,
  MessageSquare,
  Flag,
  TrendingUp,
} from "lucide-react";
import AdminStatCard from "@/components/admin/AdminStatCard";

interface Props {
  stats: {
    totalProjects: number;
    openProjects: number;
    awardedProjects: number;
    closedProjects: number;
    totalBids: number;
    totalCustomers: number;
    totalBidders: number;
    totalMessages: number;
    unresolvedFlags: number;
    avgBidPrice: number;
    bidsPerProject: number;
  };
  projectsOverTime: { date: string; count: number }[];
  bidsOverTime: { date: string; count: number }[];
  userGrowth: { date: string; customers: number; bidders: number }[];
  tradeBreakdown: { trade: string; count: number }[];
  statusBreakdown: { name: string; value: number }[];
  avgBidByTrade: { trade: string; avg: number }[];
  geoData: { state: string; projects: number; users: number }[];
  topProjects: { title: string; bids: number; location: string }[];
}

const STATUS_COLORS = ["#15803D", "#D97706", "#9CA3AF"];
const CHART_ORANGE = "#D97706";
const CHART_GREEN = "#15803D";
const CHART_BLUE = "#2563EB";

export default function AnalyticsDashboard({
  stats,
  projectsOverTime,
  bidsOverTime,
  userGrowth,
  tradeBreakdown,
  statusBreakdown,
  avgBidByTrade,
  geoData,
  topProjects,
}: Props) {
  const statCards = [
    {
      label: "Total Projects",
      value: stats.totalProjects,
      icon: FolderOpen,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Total Bids",
      value: stats.totalBids,
      icon: ClipboardList,
      color: "bg-secondary/10 text-secondary",
    },
    {
      label: "Avg. Bid Price",
      value: `$${stats.avgBidPrice.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-amber-100 text-amber-700",
    },
    {
      label: "Bids per Project",
      value: stats.bidsPerProject,
      icon: BarChart3,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      label: "Bidders",
      value: stats.totalBidders,
      icon: Users,
      color: "bg-secondary/10 text-secondary",
    },
    {
      label: "Messages",
      value: stats.totalMessages,
      icon: MessageSquare,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "Unresolved Flags",
      value: stats.unresolvedFlags,
      icon: Flag,
      color:
        stats.unresolvedFlags > 0
          ? "bg-red-100 text-red-600"
          : "bg-green-100 text-green-600",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Platform Analytics 📊
        </h1>
        <p className="mt-1 text-text-secondary">
          Real-time metrics across projectxbidx.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <AdminStatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Charts Row 1: Timeline Charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Projects Over Time (30 days)">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={projectsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke={CHART_ORANGE}
                strokeWidth={2}
                dot={false}
                name="Projects"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Bids Over Time (30 days)">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={bidsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke={CHART_GREEN}
                strokeWidth={2}
                dot={false}
                name="Bids"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2: Trade Breakdown + Status Donut */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Projects by Trade">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={tradeBreakdown}
              layout="vertical"
              margin={{ left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="trade"
                tick={{ fontSize: 11 }}
                width={100}
              />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_ORANGE} radius={[0, 4, 4, 0]} name="Projects" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Project Status Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusBreakdown.map((_, i) => (
                  <Cell
                    key={i}
                    fill={STATUS_COLORS[i % STATUS_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 3: User Growth + Avg Bid by Trade */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="User Growth (30 days)">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="customers"
                stackId="1"
                stroke={CHART_BLUE}
                fill={CHART_BLUE}
                fillOpacity={0.3}
                name="Customers"
              />
              <Area
                type="monotone"
                dataKey="bidders"
                stackId="2"
                stroke={CHART_GREEN}
                fill={CHART_GREEN}
                fillOpacity={0.3}
                name="Bidders"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg Bid Price by Trade">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={avgBidByTrade}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="trade"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
              />
              <Tooltip
                formatter={(v) => `$${Number(v).toLocaleString()}`}
              />
              <Bar dataKey="avg" fill={CHART_GREEN} radius={[4, 4, 0, 0]} name="Avg Price" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tables Row: Geographic + Top Projects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Geographic Distribution">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2 font-semibold text-text-primary">
                    State
                  </th>
                  <th className="px-4 py-2 font-semibold text-text-primary text-right">
                    Projects
                  </th>
                  <th className="px-4 py-2 font-semibold text-text-primary text-right">
                    Users
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {geoData.map((row) => (
                  <tr key={row.state} className="hover:bg-surface-hover">
                    <td className="px-4 py-2 text-text-primary">
                      {row.state || "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-text-secondary">
                      {row.projects}
                    </td>
                    <td className="px-4 py-2 text-right text-text-secondary">
                      {row.users}
                    </td>
                  </tr>
                ))}
                {geoData.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-text-muted"
                    >
                      No geographic data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Top Projects by Bid Count">
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2 font-semibold text-text-primary">
                    Project
                  </th>
                  <th className="px-4 py-2 font-semibold text-text-primary text-right">
                    Bids
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topProjects.map((p, i) => (
                  <tr key={i} className="hover:bg-surface-hover">
                    <td className="px-4 py-2">
                      <p className="font-medium text-text-primary">
                        {p.title}
                      </p>
                      <p className="text-xs text-text-muted">{p.location}</p>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-text-primary">
                      {p.bids}
                    </td>
                  </tr>
                ))}
                {topProjects.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-8 text-center text-text-muted"
                    >
                      No projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">
        {title}
      </h2>
      {children}
    </div>
  );
}
