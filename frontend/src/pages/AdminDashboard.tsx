import { useEffect, useState } from "react";
import {
  Users, Building2, MessageSquare, TrendingUp,
  Search, ChevronDown, Shield, Ban, CheckCircle,
  IndianRupee, Zap, RefreshCw, X,
} from "lucide-react";
import {
  adminStats, adminWorkspaces, adminChangePlan,
  adminSuspendWorkspace, adminUsers, adminSuspendUser, adminSetSuperadmin,
} from "../api/admin";

const PLANS = ["free", "starter", "pro", "enterprise"];
const PLAN_COLOR: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  starter: "bg-blue-100 text-blue-700",
  pro: "bg-violet-100 text-violet-700",
  enterprise: "bg-amber-100 text-amber-700",
};
const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
  past_due: "bg-orange-100 text-orange-600",
  halted: "bg-red-100 text-red-600",
  none: "bg-gray-100 text-gray-500",
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${className}`}>{label}</span>;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<"overview" | "workspaces" | "users">("overview");
  const [stats, setStats] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [planModal, setPlanModal] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState("");

  const loadStats = async () => {
    try { setStats(await adminStats()); } catch { }
  };

  const loadWorkspaces = async () => {
    setLoading(true);
    try { setWorkspaces(await adminWorkspaces({ search })); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    setLoading(true);
    try { setUsers(await adminUsers({ search })); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    if (tab === "workspaces") loadWorkspaces();
    if (tab === "users") loadUsers();
  }, [tab, search]);

  const handleChangePlan = async () => {
    if (!planModal || !selectedPlan) return;
    await adminChangePlan(planModal.id, selectedPlan);
    setPlanModal(null);
    loadWorkspaces();
    loadStats();
  };

  const handleSuspendWs = async (id: string, current: boolean) => {
    if (!confirm(current ? "Suspend this workspace?" : "Reactivate this workspace?")) return;
    await adminSuspendWorkspace(id, !current);
    loadWorkspaces();
  };

  const handleSuspendUser = async (id: string, current: boolean) => {
    if (!confirm(current ? "Suspend this user?" : "Reactivate this user?")) return;
    await adminSuspendUser(id, !current);
    loadUsers();
  };

  const handleSuperadmin = async (id: string, current: boolean) => {
    if (!confirm(current ? "Revoke superadmin?" : "Grant superadmin access?")) return;
    await adminSetSuperadmin(id, !current);
    loadUsers();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="border-b border-gray-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <div>
            <span className="font-bold text-white">FlowWA</span>
            <span className="ml-2 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
              Super Admin
            </span>
          </div>
        </div>
        <a href="/dashboard" className="text-xs text-gray-400 hover:text-white transition-colors">
          ← Back to App
        </a>
      </div>

      <div className="px-8 py-6 max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 w-fit mb-6 border border-gray-800">
          {(["overview", "workspaces", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                tab === t ? "bg-gray-800 text-white shadow" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Workspaces"   value={stats.total_workspaces}     icon={Building2}     color="bg-blue-500/10 text-blue-400" />
              <StatCard label="Total Users"         value={stats.total_users}          icon={Users}         color="bg-violet-500/10 text-violet-400" />
              <StatCard label="Messages Sent"       value={stats.total_messages_sent}  icon={MessageSquare} color="bg-green-500/10 text-green-400" />
              <StatCard label="MRR (₹)"             value={`₹${stats.mrr_inr?.toLocaleString("en-IN")}`} icon={IndianRupee} color="bg-amber-500/10 text-amber-400" />
            </div>

            {/* Plan breakdown */}
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
              <p className="font-semibold text-white mb-4">Plan Breakdown</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {PLANS.map((plan) => (
                  <div key={plan} className="bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{stats.plan_breakdown?.[plan] ?? 0}</p>
                    <p className="text-xs text-gray-400 capitalize mt-1">{plan}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <p className="text-xs text-gray-400">Active Workspaces</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{stats.active_workspaces}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <p className="text-xs text-gray-400">Total Contacts</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{stats.total_contacts}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                <p className="text-xs text-gray-400">Total Flows</p>
                <p className="text-2xl font-bold text-violet-400 mt-1">{stats.total_flows}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── WORKSPACES ── */}
        {tab === "workspaces" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 w-72">
                <Search size={13} className="text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search workspace or email..."
                  className="bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none w-full"
                />
              </div>
              <button onClick={loadWorkspaces} className="text-gray-500 hover:text-white transition-colors">
                <RefreshCw size={15} />
              </button>
            </div>

            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-5 py-3 font-medium">Workspace</th>
                    <th className="px-5 py-3 font-medium">Owner</th>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Subscription</th>
                    <th className="px-5 py-3 font-medium">Messages</th>
                    <th className="px-5 py-3 font-medium">Contacts</th>
                    <th className="px-5 py-3 font-medium">WA</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : workspaces.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-500">No workspaces found</td></tr>
                  ) : workspaces.map((ws) => (
                    <tr key={ws.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white">{ws.name}</p>
                        <p className="text-xs text-gray-500">{ws.slug}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-gray-300">{ws.owner_name}</p>
                        <p className="text-xs text-gray-500">{ws.owner_email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge label={ws.plan} className={PLAN_COLOR[ws.plan] ?? "bg-gray-100 text-gray-600"} />
                      </td>
                      <td className="px-5 py-3">
                        <Badge label={ws.subscription_status} className={STATUS_COLOR[ws.subscription_status] ?? "bg-gray-100 text-gray-500"} />
                        {ws.subscription_end && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            until {new Date(ws.subscription_end * 1000).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-300">{ws.messages_sent}</td>
                      <td className="px-5 py-3 text-gray-300">{ws.contacts}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${ws.whatsapp_connected ? "text-green-400" : "text-gray-600"}`}>
                          {ws.whatsapp_connected ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${ws.is_active ? "text-green-400" : "text-red-400"}`}>
                          {ws.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setPlanModal(ws); setSelectedPlan(ws.plan); }}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            Plan
                          </button>
                          <button
                            onClick={() => handleSuspendWs(ws.id, ws.is_active)}
                            className={`text-xs transition-colors ${ws.is_active ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"}`}
                          >
                            {ws.is_active ? "Suspend" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 w-72">
                <Search size={13} className="text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none w-full"
                />
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {u.full_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium text-white">{u.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-400">{u.email}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {u.is_superadmin
                          ? <span className="text-xs font-medium text-amber-400 flex items-center gap-1"><Shield size={11} />Superadmin</span>
                          : <span className="text-xs text-gray-500">User</span>
                        }
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${u.is_active ? "text-green-400" : "text-red-400"}`}>
                          {u.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleSuperadmin(u.id, u.is_superadmin)}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            {u.is_superadmin ? "Revoke Admin" : "Make Admin"}
                          </button>
                          <button
                            onClick={() => handleSuspendUser(u.id, u.is_active)}
                            className={`text-xs transition-colors ${u.is_active ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"}`}
                          >
                            {u.is_active ? "Suspend" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Plan change modal */}
      {planModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-white">Change Plan</p>
              <button onClick={() => setPlanModal(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Workspace: <span className="text-white font-medium">{planModal.name}</span></p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {PLANS.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPlan(p)}
                  className={`py-2.5 rounded-xl text-sm font-medium capitalize border transition-all ${
                    selectedPlan === p
                      ? "bg-green-600 border-green-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={handleChangePlan}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-green-600 hover:to-emerald-700 transition-all"
            >
              Apply Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
