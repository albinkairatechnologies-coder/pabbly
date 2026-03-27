import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { MessageSquare, TrendingUp, Users, CheckCircle, Activity, BarChart2 } from "lucide-react";
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-gray-800">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value}</span></p>
      ))}
    </div>
  );
};

const CARDS = (ov: Overview | null) => [
  { label: "Sent Today",          value: ov?.messages_sent_today ?? 0,    icon: MessageSquare, bg: "bg-blue-50",    text: "text-blue-600" },
  { label: "Sent This Month",     value: ov?.messages_sent_month ?? 0,    icon: Activity,      bg: "bg-violet-50",  text: "text-violet-600" },
  { label: "Open Rate",           value: `${ov?.open_rate_percent ?? 0}%`, icon: TrendingUp,    bg: "bg-green-50",   text: "text-green-600" },
  { label: "Reply Rate",          value: `${ov?.reply_rate_percent ?? 0}%`,icon: BarChart2,     bg: "bg-orange-50",  text: "text-orange-600" },
  { label: "Active Conversations",value: ov?.active_conversations ?? 0,   icon: MessageSquare, bg: "bg-teal-50",    text: "text-teal-600" },
  { label: "Resolved Today",      value: ov?.resolved_today ?? 0,         icon: CheckCircle,   bg: "bg-emerald-50", text: "text-emerald-600" },
  { label: "New Contacts",        value: ov?.contacts_added_month ?? 0,   icon: Users,         bg: "bg-pink-50",    text: "text-pink-600" },
];

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

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Loading analytics...</p>
      </div>
    </div>
  );

  const cards = CARDS(overview);

  return (
    <div className="space-y-6">
      {/* Metric grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} mb-3`}>
              <Icon size={16} className={text} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Volume chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-semibold text-gray-900">Message Volume</p>
            <p className="text-xs text-gray-400 mt-0.5">Last 30 days</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Sent</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />Received</span>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="sent" stroke="#16a34a" strokeWidth={2.5} dot={false} name="Sent" />
              <Line type="monotone" dataKey="received" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Received" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data yet</div>
        )}
      </div>

      {/* Top flows bar chart */}
      {(overview?.top_flows?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="font-semibold text-gray-900 mb-5">Top Automations</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={overview!.top_flows} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="flow_name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="runs" fill="url(#barGrad)" radius={[6, 6, 0, 0]} name="Runs">
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
