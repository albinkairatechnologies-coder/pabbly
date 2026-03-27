import { useEffect, useState } from "react";
import { CheckCircle, Copy, Eye, EyeOff, Users, Smartphone, Building2 } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import api from "../api/client";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Badge from "../components/ui/Badge";

// ── API helpers ───────────────────────────────────────────
const saveWhatsApp = (workspaceId: string, body: object) =>
  api.put(`/workspaces/${workspaceId}/whatsapp`, body).then((r) => r.data);

const getMembers = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/members`).then((r) => r.data);

const inviteMember = (workspaceId: string, email: string, role: string) =>
  api.post(`/workspaces/${workspaceId}/members`, { email, role }).then((r) => r.data);

const removeMember = (workspaceId: string, userId: string) =>
  api.delete(`/workspaces/${workspaceId}/members/${userId}`);

const updateWorkspace = (workspaceId: string, name: string) =>
  api.put(`/workspaces/${workspaceId}`, { name }).then((r) => r.data);

const testWhatsApp = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/whatsapp/test`).then((r) => r.data);

// ── Section wrapper ───────────────────────────────────────
function Section({ icon: Icon, title, subtitle, children }: {
  icon: any; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function Settings() {
  const { workspace, setWorkspace, user } = useAuthStore();

  // Workspace name
  const [wsName, setWsName] = useState(workspace?.name ?? "");
  const [savingWs, setSavingWs] = useState(false);
  const [wsSaved, setWsSaved] = useState(false);

  // WhatsApp credentials
  const [creds, setCreds] = useState({
    phone_number_id: "",
    access_token: "",
    business_account_id: "",
  });
  const [showToken, setShowToken] = useState(false);
  const [savingWA, setSavingWA] = useState(false);
  const [waSaved, setWaSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Team members
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setWsName(workspace.name);
    // Pre-fill phone number id if already saved
    if (workspace.whatsapp_phone_number_id) {
      setCreds((c) => ({ ...c, phone_number_id: workspace.whatsapp_phone_number_id! }));
    }
    getMembers(workspace.id).then(setMembers).catch(() => {});
  }, [workspace?.id]);

  // ── Save workspace name ───────────────────────────────
  const handleSaveWorkspace = async () => {
    if (!workspace || !wsName.trim()) return;
    setSavingWs(true);
    try {
      const updated = await updateWorkspace(workspace.id, wsName);
      setWorkspace({ ...workspace, name: updated.name });
      localStorage.setItem("workspace", JSON.stringify({ ...workspace, name: updated.name }));
      setWsSaved(true);
      setTimeout(() => setWsSaved(false), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Failed to update workspace name");
    } finally {
      setSavingWs(false);
    }
  };

  // ── Save WhatsApp credentials ─────────────────────────
  const handleSaveWA = async () => {
    if (!workspace) return;
    if (!creds.phone_number_id || !creds.access_token || !creds.business_account_id) {
      alert("Please fill in all three WhatsApp fields");
      return;
    }
    setSavingWA(true);
    try {
      await saveWhatsApp(workspace.id, creds);
      const updated = { ...workspace, whatsapp_phone_number_id: creds.phone_number_id };
      setWorkspace(updated);
      localStorage.setItem("workspace", JSON.stringify(updated));
      setWaSaved(true);
      setTestResult(null);
      setTimeout(() => setWaSaved(false), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Failed to save WhatsApp credentials");
    } finally {
      setSavingWA(false);
    }
  };

  // ── Test WhatsApp connection ──────────────────────────
  const handleTest = async () => {
    if (!workspace) return;
    setTesting(true);
    setTestResult(null);
    try {
      const data = await testWhatsApp(workspace.id);
      setTestResult({ ok: true, message: `Connected! Phone: ${data.display_phone_number ?? data.verified_name ?? "OK"}` });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.response?.data?.detail ?? "Connection failed. Check your credentials." });
    } finally {
      setTesting(false);
    }
  };

  // ── Invite member ─────────────────────────────────────
  const handleInvite = async () => {
    if (!workspace || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(workspace.id, inviteEmail, inviteRole);
      setInviteEmail("");
      const updated = await getMembers(workspace.id);
      setMembers(updated);
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Failed to invite member");
    } finally {
      setInviting(false);
    }
  };

  // ── Remove member ─────────────────────────────────────
  const handleRemove = async (userId: string) => {
    if (!workspace || !confirm("Remove this member?")) return;
    await removeMember(workspace.id, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Workspace ── */}
      <Section icon={Building2} title="Workspace" subtitle="Your workspace name shown to team members">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="My Business"
            />
          </div>
          <Button onClick={handleSaveWorkspace} loading={savingWs} variant={wsSaved ? "secondary" : "primary"}>
            {wsSaved ? <><CheckCircle size={14} /> Saved</> : "Save"}
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-500">Plan:</span>
          <Badge label={workspace?.plan ?? "free"} color="green" />
          <span className="text-xs text-gray-400 ml-2">Workspace ID:</span>
          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{workspace?.id}</code>
          <button onClick={() => copyToClipboard(workspace?.id ?? "")} className="text-gray-400 hover:text-gray-600">
            <Copy size={12} />
          </button>
        </div>
      </Section>

      {/* ── WhatsApp ── */}
      <Section icon={Smartphone} title="WhatsApp Business API" subtitle="Connect your Meta WhatsApp Cloud API credentials">

        {/* Status banner */}
        {workspace?.whatsapp_phone_number_id ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
            <CheckCircle size={14} className="text-green-600" />
            <span className="text-sm text-green-700">Connected — Phone Number ID: <strong>{workspace.whatsapp_phone_number_id}</strong></span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
            <span className="text-sm text-yellow-700">⚠ Not connected — fill in your credentials below</span>
          </div>
        )}

        <div className="space-y-4">
          <Input
            label="Phone Number ID"
            value={creds.phone_number_id}
            onChange={(e) => setCreds((c) => ({ ...c, phone_number_id: e.target.value }))}
            placeholder="e.g. 123456789012345"
            helper="Found in Meta Developer Console → WhatsApp → Getting Started"
          />

          <Input
            label="WhatsApp Business Account ID (WABA ID)"
            value={creds.business_account_id}
            onChange={(e) => setCreds((c) => ({ ...c, business_account_id: e.target.value }))}
            placeholder="e.g. 987654321098765"
            helper="Found in Meta Business Manager → WhatsApp Accounts"
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Access Token</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={creds.access_token}
                onChange={(e) => setCreds((c) => ({ ...c, access_token: e.target.value }))}
                placeholder="EAAxxxxxxxxxxxxxxx..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400">Temporary token (24h) for testing or permanent System User token for production</p>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${testResult.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {testResult.ok ? <CheckCircle size={14} /> : "✗"} {testResult.message}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSaveWA} loading={savingWA} variant={waSaved ? "secondary" : "primary"}>
              {waSaved ? <><CheckCircle size={14} /> Saved</> : "Save Credentials"}
            </Button>
            <Button variant="secondary" onClick={handleTest} loading={testing}>
              Test Connection
            </Button>
          </div>
        </div>

        {/* Setup guide */}
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How to get credentials</p>
          <ol className="space-y-1.5 text-xs text-gray-500 list-decimal list-inside">
            <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-green-600 hover:underline">developers.facebook.com</a> → Create App → Business</li>
            <li>Add product → WhatsApp → Getting Started</li>
            <li>Copy <strong>Phone Number ID</strong> and <strong>WhatsApp Business Account ID</strong></li>
            <li>Copy the <strong>Temporary Access Token</strong> (or create a System User for permanent token)</li>
            <li>Set Webhook URL to: <code className="bg-gray-100 px-1 rounded">https://yourdomain.com/webhook/whatsapp</code></li>
            <li>Set Verify Token to: <code className="bg-gray-100 px-1 rounded">flowwa-webhook-token-123</code></li>
          </ol>
        </div>
      </Section>

      {/* ── Team Members ── */}
      <Section icon={Users} title="Team Members" subtitle="Invite agents and viewers to your workspace">
        {/* Current members */}
        <div className="space-y-2 mb-4">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{m.user_name ?? m.user_email}</p>
                <p className="text-xs text-gray-400">{m.user_email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  label={m.role}
                  color={m.role === "admin" ? "green" : m.role === "agent" ? "blue" : "gray"}
                />
                {m.user_id !== user?.id && (
                  <button onClick={() => handleRemove(m.user_id)} className="text-xs text-gray-400 hover:text-red-500">
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Invite form */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@email.com"
              type="email"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="agent">Agent</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <Button onClick={handleInvite} loading={inviting} disabled={!inviteEmail.trim()}>
            Invite
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">The user must already have a FlowWA account to be invited.</p>
      </Section>

    </div>
  );
}
