import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MessageSquare, Users, Zap, TrendingUp } from "lucide-react";
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

export default function Dashboard() {
  const { user, workspace } = useAuthStore();
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    if (!workspace) return;
    getAnalyticsOverview(workspace.id).catch(() => null).then(setOverview);
  }, [workspace?.id]);

  const metrics = [
    { label: "Messages Sent", value: overview?.messages_sent_month ?? "—", icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
    { label: "Open Rate", value: overview ? `${overview.open_rate_percent}%` : "—", icon: TrendingUp, color: "text-green-600 bg-green-50" },
    { label: "Active Conversations", value: overview?.active_conversations ?? "—", icon: MessageSquare, color: "text-purple-600 bg-purple-50" },
    { label: "New Contacts", value: overview?.contacts_added_month ?? "—", icon: Users, color: "text-orange-600 bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Welcome back, {user?.full_name} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">{workspace?.name} · <span className="capitalize">{workspace?.plan}</span> plan</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-900 mb-4">Message Volume</p>
        {(overview?.message_volume_chart?.length ?? 0) > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={overview!.message_volume_chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sent" stroke="#16a34a" strokeWidth={2} dot={false} name="Sent" />
              <Line type="monotone" dataKey="received" stroke="#3b82f6" strokeWidth={2} dot={false} name="Received" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
            No message data yet. Start sending messages to see analytics.
          </div>
        )}
      </div>

      {/* Top Flows */}
      {(overview?.top_flows?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="font-semibold text-gray-900 mb-3">Active Automations</p>
          <div className="space-y-2">
            {overview!.top_flows.map((f) => (
              <div key={f.flow_name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-green-600" />
                  <span className="text-sm text-gray-700">{f.flow_name}</span>
                </div>
                <span className="text-xs text-gray-400">{f.runs} runs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
