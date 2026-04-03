import { useEffect, useState } from "react";
import {
  Users, Building2, MessageSquare, TrendingUp,
  Search, ChevronDown, Shield, Ban, CheckCircle,
  IndianRupee, Zap, RefreshCw, X, Edit2, Calendar, CreditCard,
  BarChart3, Moon, Sun,
} from "lucide-react";
import {
  adminStats, adminWorkspaces, adminChangePlan,
  adminSuspendWorkspace, adminUsers, adminSuspendUser, adminSetSuperadmin,
  adminEditUser, adminExtendValidity, adminGetPayments, adminAddPayment,
  adminRevenue, adminWorkspaceDetail,
} from "../api/admin";
import { useThemeStore } from "../store/themeStore";

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
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${className}`}>{label}</span>;
}

export default function AdminDashboard() {
  const { theme, toggleTheme } = useThemeStore();
  const [tab, setTab] = useState<"overview" | "workspaces" | "users">("overview");
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [planModal, setPlanModal] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [editUserModal, setEditUserModal] = useState<any>(null);
  const [editUserForm, setEditUserForm] = useState({ full_name: "", email: "" });
  const [extendModal, setExtendModal] = useState<any>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [paymentsModal, setPaymentsModal] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount_inr: 0, plan: "starter", note: "" });
  const [detailModal, setDetailModal] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadStats = async () => {
    try { 
      setStats(await adminStats());
      setRevenue(await adminRevenue());
    } catch { }
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

  // Initialize theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, []);

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

  const handleEditUser = async () => {
    if (!editUserModal) return;
    await adminEditUser(editUserModal.id, editUserForm);
    setEditUserModal(null);
    loadUsers();
  };

  const handleExtendValidity = async () => {
    if (!extendModal || extendDays < 1) return;
    await adminExtendValidity(extendModal.id, extendDays);
    setExtendModal(null);
    loadWorkspaces();
  };

  const loadPayments = async (workspaceId: string) => {
    try {
      const data = await adminGetPayments(workspaceId);
      setPayments(data);
    } catch {
      setPayments([]);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentsModal || paymentForm.amount_inr <= 0) return;
    await adminAddPayment(paymentsModal.id, paymentForm);
    setShowAddPayment(false);
    setPaymentForm({ amount_inr: 0, plan: "starter", note: "" });
    loadPayments(paymentsModal.id);
    loadWorkspaces();
  };

  const loadWorkspaceDetail = async (workspaceId: string) => {
    setDetailLoading(true);
    try {
      const data = await adminWorkspaceDetail(workspaceId);
      setDetailModal(data);
    } catch {
      setDetailModal(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white transition-colors">
      {/* Top bar */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-white">FlowWA</span>
            <span className="ml-2 text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
              Super Admin
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <a href="/dashboard" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            ← Back to App
          </a>
        </div>
      </div>

      <div className="px-8 py-6 max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-xl p-1 w-fit mb-6 border border-gray-200 dark:border-gray-800">
          {(["overview", "workspaces", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                tab === t ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow" : "text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
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

            {/* Revenue Chart */}
            {revenue.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-amber-500 dark:text-amber-400" />
                  <p className="font-semibold text-gray-900 dark:text-white">Revenue Trend (MRR)</p>
                </div>
                <div className="flex items-end justify-between gap-2 h-48">
                  {revenue.map((item, i) => {
                    const maxMrr = Math.max(...revenue.map(r => r.mrr));
                    const height = maxMrr > 0 ? (item.mrr / maxMrr) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="relative w-full group">
                          <div
                            className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-lg transition-all duration-300 hover:from-amber-400 hover:to-amber-300"
                            style={{ height: `${height}%`, minHeight: item.mrr > 0 ? '8px' : '0' }}
                          />
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-gray-800 dark:bg-gray-700 border border-gray-700 dark:border-gray-600 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap shadow-xl">
                              <p className="font-semibold">₹{item.mrr.toLocaleString("en-IN")}</p>
                              <p className="text-gray-400 dark:text-gray-300 text-[10px]">{item.month}</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">{item.month.split(' ')[0]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Plan breakdown */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Plan Breakdown</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {PLANS.map((plan) => (
                  <div key={plan} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.plan_breakdown?.[plan] ?? 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-1">{plan}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Workspaces</p>
                <p className="text-2xl font-bold text-green-500 dark:text-green-400 mt-1">{stats.active_workspaces}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Contacts</p>
                <p className="text-2xl font-bold text-blue-500 dark:text-blue-400 mt-1">{stats.total_contacts}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Flows</p>
                <p className="text-2xl font-bold text-violet-500 dark:text-violet-400 mt-1">{stats.total_flows}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── WORKSPACES ── */}
        {tab === "workspaces" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 w-72">
                <Search size={13} className="text-gray-400 dark:text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search workspace or email..."
                  className="bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 outline-none w-full"
                />
              </div>
              <button onClick={loadWorkspaces} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <RefreshCw size={15} />
              </button>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-800">
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
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
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {loading ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-500 dark:text-gray-400">Loading...</td></tr>
                  ) : workspaces.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-500 dark:text-gray-400">No workspaces found</td></tr>
                  ) : workspaces.map((ws) => (
                    <tr key={ws.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <button
                          onClick={() => loadWorkspaceDetail(ws.id)}
                          className="text-left hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">{ws.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{ws.slug}</p>
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-gray-700 dark:text-gray-300">{ws.owner_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{ws.owner_email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge label={ws.plan} className={PLAN_COLOR[ws.plan] ?? "bg-gray-100 text-gray-600"} />
                      </td>
                      <td className="px-5 py-3">
                        <Badge label={ws.subscription_status} className={STATUS_COLOR[ws.subscription_status] ?? "bg-gray-100 text-gray-500"} />
                        {ws.subscription_end && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            until {new Date(ws.subscription_end * 1000).toLocaleDateString()}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{ws.messages_sent}</td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{ws.contacts}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${ws.whatsapp_connected ? "text-green-500 dark:text-green-400" : "text-gray-400 dark:text-gray-600"}`}>
                          {ws.whatsapp_connected ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${ws.is_active ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                          {ws.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setPlanModal(ws); setSelectedPlan(ws.plan); }}
                            className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                          >
                            Plan
                          </button>
                          <button
                            onClick={() => { setExtendModal(ws); setExtendDays(30); }}
                            className="text-xs text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300 transition-colors"
                          >
                            Extend
                          </button>
                          <button
                            onClick={() => { setPaymentsModal(ws); loadPayments(ws.id); setShowAddPayment(false); }}
                            className="text-xs text-purple-500 dark:text-purple-400 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
                          >
                            Payments
                          </button>
                          <button
                            onClick={() => handleSuspendWs(ws.id, ws.is_active)}
                            className={`text-xs transition-colors ${ws.is_active ? "text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300" : "text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300"}`}
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
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 w-72">
                <Search size={13} className="text-gray-400 dark:text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users..."
                  className="bg-transparent text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 outline-none w-full"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-800">
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Joined</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">Loading...</td></tr>
                  ) : users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {u.full_name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{u.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {u.is_superadmin
                          ? <span className="text-xs font-medium text-amber-500 dark:text-amber-400 flex items-center gap-1"><Shield size={11} />Superadmin</span>
                          : <span className="text-xs text-gray-500 dark:text-gray-400">User</span>
                        }
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${u.is_active ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                          {u.is_active ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditUserModal(u); setEditUserForm({ full_name: u.full_name, email: u.email }); }}
                            className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleSuperadmin(u.id, u.is_superadmin)}
                            className="text-xs text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                          >
                            {u.is_superadmin ? "Revoke" : "Admin"}
                          </button>
                          <button
                            onClick={() => handleSuspendUser(u.id, u.is_active)}
                            className={`text-xs transition-colors ${u.is_active ? "text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300" : "text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300"}`}
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

      {/* Edit User Modal */}
      {editUserModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-blue-400" />
                <p className="font-semibold text-white">Edit User</p>
              </div>
              <button onClick={() => setEditUserModal(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Full Name</label>
                <input
                  value={editUserForm.full_name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Email</label>
                <input
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter email"
                />
              </div>
            </div>
            <button
              onClick={handleEditUser}
              className="w-full mt-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-blue-700 transition-all"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Extend Validity Modal */}
      {extendModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-green-400" />
                <p className="font-semibold text-white">Extend Validity</p>
              </div>
              <button onClick={() => setExtendModal(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-1">Workspace: <span className="text-white font-medium">{extendModal.name}</span></p>
            {extendModal.subscription_end && (
              <p className="text-xs text-gray-500 mb-4">
                Current expiry: {new Date(extendModal.subscription_end * 1000).toLocaleDateString()}
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Add Days</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[7, 15, 30, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => setExtendDays(d)}
                      className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                        extendDays === d
                          ? "bg-green-600 border-green-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={extendDays}
                  onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
                  placeholder="Custom days"
                  min="1"
                />
              </div>
              {extendModal.subscription_end && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                  <p className="text-xs text-gray-400">New expiry date:</p>
                  <p className="text-sm text-green-400 font-medium mt-1">
                    {new Date(extendModal.subscription_end * 1000 + extendDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleExtendValidity}
              className="w-full mt-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-green-600 hover:to-emerald-700 transition-all"
            >
              Extend Subscription
            </button>
          </div>
        </div>
      )}

      {/* Payments Modal */}
      {paymentsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-purple-400" />
                <p className="font-semibold text-white">Payment Details</p>
              </div>
              <button onClick={() => setPaymentsModal(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Workspace: <span className="text-white font-medium">{paymentsModal.name}</span></p>

            {!showAddPayment ? (
              <>
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="w-full mb-4 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  + Add Manual Payment
                </button>

                {payments.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <CreditCard size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No payment records found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payments.map((p: any, i: number) => (
                      <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">₹{(p.amount / 100).toLocaleString("en-IN")}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{p.method || "Online"}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              p.status === "captured" ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"
                            }`}>
                              {p.status || "completed"}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              {p.created_at ? new Date(p.created_at * 1000).toLocaleDateString() : "—"}
                            </p>
                          </div>
                        </div>
                        {p.description && <p className="text-xs text-gray-500 mt-2">{p.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Amount (₹)</label>
                  <input
                    type="number"
                    value={paymentForm.amount_inr}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount_inr: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                    placeholder="Enter amount"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Plan</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PLANS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPaymentForm({ ...paymentForm, plan: p })}
                        className={`py-2 rounded-lg text-xs font-medium capitalize border transition-all ${
                          paymentForm.plan === p
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Note (optional)</label>
                  <textarea
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                    placeholder="Payment note or reference"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddPayment(false)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPayment}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
                  >
                    Add Payment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workspace Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Building2 size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-lg">{detailModal.name}</p>
                  <p className="text-xs text-gray-500">{detailModal.slug}</p>
                </div>
              </div>
              <button onClick={() => setDetailModal(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            {detailLoading ? (
              <div className="text-center py-10 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Plan</p>
                    <Badge label={detailModal.plan} className={PLAN_COLOR[detailModal.plan] ?? "bg-gray-100 text-gray-600"} />
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Status</p>
                    <span className={`text-sm font-medium ${detailModal.is_active ? "text-green-400" : "text-red-400"}`}>
                      {detailModal.is_active ? "Active" : "Suspended"}
                    </span>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Created</p>
                    <p className="text-sm text-white">{detailModal.created_at ? new Date(detailModal.created_at).toLocaleDateString() : "—"}</p>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">WhatsApp</p>
                    <span className={`text-sm font-medium ${detailModal.whatsapp_phone_number_id ? "text-green-400" : "text-gray-500"}`}>
                      {detailModal.whatsapp_phone_number_id ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                </div>

                {/* Owner Info */}
                {detailModal.owner && (
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-2">Owner</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                        {detailModal.owner.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{detailModal.owner.name}</p>
                        <p className="text-xs text-gray-500">{detailModal.owner.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subscription Info */}
                {detailModal.subscription && (
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-3">Subscription</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <Badge label={detailModal.subscription.status} className={STATUS_COLOR[detailModal.subscription.status] ?? "bg-gray-100 text-gray-500"} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Period End</p>
                        <p className="text-sm text-white mt-1">
                          {detailModal.subscription.period_end ? new Date(detailModal.subscription.period_end).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      {detailModal.subscription.razorpay_id && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Razorpay ID</p>
                          <p className="text-xs text-gray-400 font-mono mt-1">{detailModal.subscription.razorpay_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Usage Stats */}
                {detailModal.usage && (
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-3">Usage Statistics</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-green-400">{detailModal.usage.messages_sent}</p>
                        <p className="text-xs text-gray-500 mt-1">Messages Sent</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-400">{detailModal.usage.messages_received}</p>
                        <p className="text-xs text-gray-500 mt-1">Messages Received</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-violet-400">{detailModal.usage.contacts}</p>
                        <p className="text-xs text-gray-500 mt-1">Contacts</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-400">{detailModal.usage.flows}</p>
                        <p className="text-xs text-gray-500 mt-1">Flows</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-pink-400">{detailModal.usage.flow_runs}</p>
                        <p className="text-xs text-gray-500 mt-1">Flow Runs</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-cyan-400">{detailModal.usage.this_month?.messages || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">This Month</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* WhatsApp Details */}
                {detailModal.whatsapp_phone_number_id && (
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-2">WhatsApp Integration</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-gray-500">Phone Number ID</p>
                        <p className="text-xs text-white font-mono">{detailModal.whatsapp_phone_number_id}</p>
                      </div>
                      {detailModal.whatsapp_business_account_id && (
                        <div>
                          <p className="text-xs text-gray-500">Business Account ID</p>
                          <p className="text-xs text-white font-mono">{detailModal.whatsapp_business_account_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
