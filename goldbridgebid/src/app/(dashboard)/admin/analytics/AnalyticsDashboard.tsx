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
  FunnelChart,
  Funnel,
  LabelList,
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
  Star,
} from "lucide-react";
import AdminStatCard from "@/components/admin/AdminStatCard";

interface Props {
  rangeDays: number;
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
    totalReviews: number;
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
  cityData: { city: string; total: number; projects: number; users: number }[];
  topProjects: { title: string; bids: number; location: string }[];
  funnelData: {
    totalSignups: number;
    customersPosted: number;
    projectsWithBids: number;
    projectsAwarded: number;
  };
}

const STATUS_COLORS = ["#15803D", "#D97706", "#9CA3AF"];
const CHART_ORANGE = "#D97706";
const CHART_GREEN = "#15803D";
const CHART_BLUE = "#2563EB";
const FUNNEL_COLORS = ["#2563EB", "#D97706", "#15803D", "#7C3AED"];

export default function AnalyticsDashboard({
  rangeDays,
  stats,
  projectsOverTime,
  bidsOverTime,
  userGrowth,
  tradeBreakdown,
  statusBreakdown,
  avgBidByTrade,
  geoData,
  cityData,
  topProjects,
  funnelData,
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
      label: "Reviews",
      value: stats.totalReviews,
      icon: Star,
      color: "bg-primary/10 text-primary",
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

  const funnelChartData = [
    { name: "Signups", value: funnelData.totalSignups, fill: FUNNEL_COLORS[0] },
    { name: "Posted a Project", value: funnelData.customersPosted, fill: FUNNEL_COLORS[1] },
    { name: "Received Bids", value: funnelData.projectsWithBids, fill: FUNNEL_COLORS[2] },
    { name: "Awarded", value: funnelData.projectsAwarded, fill: FUNNEL_COLORS[3] },
  ];

  const geoChartData = geoData.slice(0, 15).map((row) => ({
    ...row,
    total: row.projects + row.users,
  }));

  return (
    <div>
      {/* Key Metrics */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <AdminStatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Conversion Funnel */}
      <div className="mb-6">
        <ChartCard title="Conversion Funnel (All Time)">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <FunnelChart>
                  <Tooltip formatter={(v) => Number(v).toLocaleString()} />
                  <Funnel dataKey="value" data={funnelChartData} isAnimationActive>
                    <LabelList
                      position="right"
                      fill="#1C1917"
                      stroke="none"
                      dataKey="name"
                      fontSize={12}
                    />
                    <LabelList
                      position="center"
                      fill="#fff"
                      stroke="none"
                      dataKey="value"
                      fontSize={14}
                      fontWeight={700}
                    />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center space-y-3">
              {funnelChartData.map((step, i) => {
                const prev = i > 0 ? funnelChartData[i - 1].value : step.value;
                const rate = prev > 0 ? Math.round((step.value / prev) * 100) : 0;
                return (
                  <div key={step.name} className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: step.fill }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{step.name}</p>
                      <p className="text-xs text-text-muted">
                        {step.value.toLocaleString()}
                        {i > 0 && ` (${rate}% of previous)`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Charts Row 1: Timeline Charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title={`Projects Over Time (${rangeDays}d)`}>
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

        <ChartCard title={`Bids Over Time (${rangeDays}d)`}>
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
        <ChartCard title={`User Growth (${rangeDays}d)`}>
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

      {/* Geographic Charts Row */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Activity by State">
          {geoChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(250, geoChartData.length * 32)}>
              <BarChart
                data={geoChartData}
                layout="vertical"
                margin={{ left: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="state"
                  tick={{ fontSize: 11 }}
                  width={50}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="projects" stackId="geo" fill={CHART_ORANGE} name="Projects" radius={[0, 0, 0, 0]} />
                <Bar dataKey="users" stackId="geo" fill={CHART_BLUE} name="Users" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">No geographic data yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Top Cities">
          {cityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(250, cityData.length * 32)}>
              <BarChart
                data={cityData}
                layout="vertical"
                margin={{ left: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="city"
                  tick={{ fontSize: 10 }}
                  width={120}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="projects" stackId="city" fill={CHART_GREEN} name="Projects" />
                <Bar dataKey="users" stackId="city" fill={CHART_BLUE} name="Users" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">No city data yet.</p>
          )}
        </ChartCard>
      </div>

      {/* Top Projects Table */}
      <div className="grid grid-cols-1 gap-6">
        <ChartCard title="Top Projects by Bid Count">
          <div className="max-h-72 overflow-auto">
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
