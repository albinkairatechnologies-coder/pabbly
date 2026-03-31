import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Contacts from "./pages/Contacts";
import Automations from "./pages/Automations";
import FlowBuilder from "./pages/FlowBuilder";
import Broadcasts from "./pages/Broadcasts";
import Templates from "./pages/Templates";
import Analytics from "./pages/Analytics";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import Integrations from "./pages/Integrations";
import AppLayout from "./components/layout/AppLayout";
import AdminDashboard from "./pages/AdminDashboard";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, workspace, setWorkspace } = useAuthStore();

  useEffect(() => {
    if (!token || !workspace) return;
    // Refresh workspace to get latest whatsapp_provider
    import("./api/client").then(({ default: api }) => {
      api.get(`/workspaces/${workspace.id}`).then((r) => {
        const fresh = r.data;
        setWorkspace(fresh);
        localStorage.setItem("workspace", JSON.stringify(fresh));
      }).catch(() => {});
    });
  }, [token]);

  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/flows/:flowId" element={<FlowBuilder />} />
          <Route path="/broadcasts" element={<Broadcasts />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
