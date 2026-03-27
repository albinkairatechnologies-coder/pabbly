import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuthStore } from "../store/authStore";
import { getAnalyticsOverview, getMessageChart } from "../api";

interface Overview {
  messages_sent_today: number;
  messages_sent_month: number;
  open_rate_percent: number;
  reply_rate_percent: number;
  active_conversations: number;
  resolved_today: number;
  contacts_added_month: number;
  top_flows: { flow_name: string; runs: number; success_rate: number }[];
  message_volume_chart: { date: string; sent: number; received: number }[];
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const { workspace } = useAuthStore();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    Promise.all([
      getAnalyticsOverview(workspace.id).catch(() => null),
      getMessageChart(workspace.id, { group_by: "day" }).catch(() => []),
    ]).then(([ov, chart]) => {
      setOverview(ov);
      setChartData(Array.isArray(chart) ? chart : ov?.message_volume_chart ?? []);
    }).finally(() => setLoading(false));
  }, [workspace?.id]);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Messages Sent Today" value={overview?.messages_sent_today ?? 0} />
        <MetricCard label="Messages This Month" value={overview?.messages_sent_month ?? 0} />
        <MetricCard label="Open Rate" value={`${overview?.open_rate_percent ?? 0}%`} />
        <MetricCard label="Reply Rate" value={`${overview?.reply_rate_percent ?? 0}%`} />
        <MetricCard label="Active Conversations" value={overview?.active_conversations ?? 0} />
        <MetricCard label="Resolved Today" value={overview?.resolved_today ?? 0} />
        <MetricCard label="Contacts Added (Month)" value={overview?.contacts_added_month ?? 0} />
      </div>

      {/* Message Volume Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-900 mb-4">Message Volume (Last 30 Days)</p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sent" stroke="#16a34a" strokeWidth={2} dot={false} name="Sent" />
              <Line type="monotone" dataKey="received" stroke="#3b82f6" strokeWidth={2} dot={false} name="Received" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
        )}
      </div>

      {/* Top Flows */}
      {(overview?.top_flows?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="font-semibold text-gray-900 mb-4">Top Automations</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={overview!.top_flows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="flow_name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="runs" fill="#16a34a" radius={[4, 4, 0, 0]} name="Runs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
