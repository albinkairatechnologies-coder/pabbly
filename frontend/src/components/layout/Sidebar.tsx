import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MessageSquare, Users, Zap, Radio,
  FileText, BarChart2, CreditCard, Plug, Settings, LogOut,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const NAV = [
  { to: "/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { to: "/inbox",       icon: MessageSquare,   label: "Inbox" },
  { to: "/contacts",    icon: Users,           label: "Contacts" },
  { to: "/automations", icon: Zap,             label: "Automations" },
  { to: "/broadcasts",  icon: Radio,           label: "Broadcasts" },
  { to: "/templates",   icon: FileText,        label: "Templates" },
  { to: "/analytics",   icon: BarChart2,       label: "Analytics" },
  { to: "/integrations",icon: Plug,            label: "Integrations" },
  { to: "/billing",     icon: CreditCard,      label: "Billing" },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { workspace, user, logout } = useAuthStore();

  return (
    <aside className="w-60 bg-gray-950 flex flex-col flex-shrink-0 border-r border-gray-800">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-900/40">
            <Zap size={15} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">FlowWA</span>
        </div>
        {workspace && (
          <div className="mt-3 px-2.5 py-1.5 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-xs text-gray-400 truncate">{workspace.name}</p>
            <span className="text-[10px] font-medium text-green-400 capitalize">{workspace.plan} plan</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active
                  ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-lg shadow-green-900/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Icon size={16} className={active ? "text-white" : "text-gray-500 group-hover:text-gray-300"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-gray-800 pt-3">
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
            pathname.startsWith("/settings")
              ? "bg-gradient-to-r from-green-600 to-emerald-500 text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          <Settings size={16} className="text-gray-500 group-hover:text-gray-300" />
          Settings
        </Link>

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <span className="text-xs text-gray-400 truncate flex-1">{user?.full_name}</span>
          <button onClick={logout} className="text-gray-600 hover:text-red-400 transition-colors" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
