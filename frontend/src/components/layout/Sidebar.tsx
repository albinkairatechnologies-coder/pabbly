import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Users, Zap, Radio, FileText, BarChart2, CreditCard, Plug, Settings } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

const NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/inbox", icon: MessageSquare, label: "Inbox" },
  { to: "/contacts", icon: Users, label: "Contacts" },
  { to: "/automations", icon: Zap, label: "Automations" },
  { to: "/broadcasts", icon: Radio, label: "Broadcasts" },
  { to: "/templates", icon: FileText, label: "Templates" },
  { to: "/analytics", icon: BarChart2, label: "Analytics" },
  { to: "/integrations", icon: Plug, label: "Integrations" },
  { to: "/billing", icon: CreditCard, label: "Billing" },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { workspace, logout } = useAuthStore();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <span className="font-bold text-green-600 text-lg">FlowWA</span>
        {workspace && <p className="text-xs text-gray-500 truncate mt-1">{workspace.name}</p>}
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith(to)
                ? "bg-green-50 text-green-700 font-medium"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t border-gray-200 space-y-0.5">
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname.startsWith("/settings")
              ? "bg-green-50 text-green-700 font-medium"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Settings size={16} />
          Settings
        </Link>
        <button onClick={logout} className="text-xs text-gray-500 hover:text-red-500 w-full text-left px-3 py-2">
          Sign out
        </button>
      </div>
    </aside>
  );
}
