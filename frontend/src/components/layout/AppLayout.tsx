import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inbox": "Live Inbox",
  "/contacts": "Contacts",
  "/automations": "Automations",
  "/flows": "Flow Builder",
  "/broadcasts": "Broadcasts",
  "/templates": "Templates",
  "/analytics": "Analytics",
  "/integrations": "Integrations",
  "/billing": "Billing",
  "/settings": "Settings",
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? TITLES[`/${pathname.split("/")[1]}`] ?? "FlowWA";

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
