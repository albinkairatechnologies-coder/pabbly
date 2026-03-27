import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { MessageSquare, Users, Zap, TrendingUp, ArrowUpRight } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getAnalyticsOverview } from "../api";

interface Overview {
  messages_sent_today: number;
  messages_sent_month: number;
  active_conversations: number;
  contacts_added_month: number;
  open_rate_percent: number;
  message_volume_chart: { date: string; sent: number; received: number }[];
  top_flows: { flow_name: string; runs: number }[];
}

const METRICS = (ov: Overview | null) => [
  {
    label: "Messages Sent",
    value: ov?.messages_sent_month ?? "—",
    icon: MessageSquare,
    gradient: "from-blue-500 to-blue-600",
    bg: "bg-blue-50",
    text: "text-blue-600",
    change: "+12%",
  },
  {
    label: "Open Rate",
    value: ov ? `${ov.open_rate_percent}%` : "—",
    icon: TrendingUp,
    gradient: "from-green-500 to-emerald-600",
    bg: "bg-green-50",
    text: "text-green-600",
    change: "+4%",
  },
  {
    label: "Active Chats",
    value: ov?.active_conversations ?? "—",
    icon: MessageSquare,
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    text: "text-violet-600",
    change: "+8%",
  },
  {
    label: "New Contacts",
    value: ov?.contacts_added_month ?? "—",
    icon: Users,
    gradient: "from-orange-400 to-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-600",
    change: "+23%",
  },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value}</span></p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user, workspace } = useAuthStore();
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    if (!workspace) return;
    getAnalyticsOverview(workspace.id).catch(() => null).then(setOverview);
  }, [workspace?.id]);

  const metrics = METRICS(overview);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {workspace?.name} ·{" "}
            <span className="capitalize text-green-600 font-medium">{workspace?.plan}</span> plan
          </p>
        </div>
        <div className="text-xs text-gray-400 bg-white border border-gray-100 rounded-xl px-3 py-1.5 shadow-sm">
          {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon, gradient, bg, text, change }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon size={18} className={text} />
              </div>
              <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
                <ArrowUpRight size={12} />{change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-3">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
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
        {(overview?.message_volume_chart?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={overview!.message_volume_chart} margin={{ left: -10 }}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="sent" stroke="#16a34a" strokeWidth={2.5} dot={false} name="Sent" />
              <Line type="monotone" dataKey="received" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Received" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[210px] flex flex-col items-center justify-center text-gray-400">
            <MessageSquare size={32} className="mb-2 opacity-20" />
            <p className="text-sm">No message data yet</p>
          </div>
        )}
      </div>

      {/* Top Flows */}
      {(overview?.top_flows?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="font-semibold text-gray-900 mb-4">Active Automations</p>
          <div className="space-y-3">
            {overview!.top_flows.map((f, i) => (
              <div key={f.flow_name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Zap size={12} className="text-green-500" />
                      <span className="text-sm text-gray-700 font-medium">{f.flow_name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{f.runs} runs</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                      style={{ width: `${Math.min(100, (f.runs / (overview!.top_flows[0]?.runs || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
