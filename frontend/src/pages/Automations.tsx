import { useEffect, useState } from "react";
import { Plus, Zap, ToggleLeft, ToggleRight, Trash2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { getFlows, createFlow, deleteFlow, toggleFlow } from "../api";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";

interface Flow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: string;
  total_runs: number;
  last_run_at: string | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  keyword: "Keyword",
  webhook: "Webhook",
  api: "API",
  schedule: "Schedule",
  opt_in: "Opt-in",
  first_message: "First Message",
  button_reply: "Button Reply",
};

export default function Automations() {
  const { workspace } = useAuthStore();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", trigger_type: "keyword" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await getFlows(workspace.id);
      setFlows(Array.isArray(data) ? data : data.items ?? []);
    } catch { setFlows([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [workspace?.id]);

  const handleCreate = async () => {
    if (!workspace) {
      alert("No workspace found. Please refresh the page.");
      return;
    }
    setSaving(true);
    try {
      const flow = await createFlow(workspace.id, form);
      setShowCreate(false);
      setForm({ name: "", description: "", trigger_type: "keyword" });
      navigate(`/flows/${flow.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Failed to create flow. Check console for details.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    if (!workspace) return;
    const updated = await toggleFlow(workspace.id, id);
    setFlows((prev) => prev.map((f) => f.id === id ? { ...f, is_active: updated.is_active } : f));
  };

  const handleDelete = async (id: string) => {
    if (!workspace || !confirm("Delete this flow?")) return;
    await deleteFlow(workspace.id, id);
    setFlows((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{flows.length} automation{flows.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Flow
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : flows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Zap size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No automations yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first flow to automate WhatsApp conversations</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>Create Flow</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {flows.map((flow) => (
            <div key={flow.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <Zap size={16} className="text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{flow.name}</p>
                  <Badge label={TRIGGER_LABELS[flow.trigger_type] ?? flow.trigger_type} color="blue" />
                  <Badge label={flow.is_active ? "Active" : "Inactive"} color={flow.is_active ? "green" : "gray"} />
                </div>
                {flow.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{flow.description}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {flow.total_runs} runs
                  {flow.last_run_at && ` · Last run ${new Date(flow.last_run_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleToggle(flow.id)} className="text-gray-400 hover:text-green-600">
                  {flow.is_active ? <ToggleRight size={22} className="text-green-600" /> : <ToggleLeft size={22} />}
                </button>
                <button onClick={() => navigate(`/flows/${flow.id}`)} className="text-gray-400 hover:text-blue-600">
                  <ExternalLink size={16} />
                </button>
                <button onClick={() => handleDelete(flow.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Automation">
        <div className="space-y-4">
          <Input label="Flow Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Welcome Message" required />
          <Input label="Description (optional)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Trigger Type</label>
            <select
              value={form.trigger_type}
              onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.name}>Create & Open Builder</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
