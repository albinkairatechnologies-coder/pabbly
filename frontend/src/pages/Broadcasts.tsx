import { useEffect, useState } from "react";
import { Plus, Radio, Send, X } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getBroadcasts, createBroadcast, sendBroadcast, cancelBroadcast, getTemplates, segmentPreview } from "../api";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";

interface Broadcast {
  id: string;
  name: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_contacts: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
}

interface Template { id: string; name: string; status: string; }

const STATUS_COLOR: Record<string, any> = {
  draft: "gray", scheduled: "blue", sending: "yellow", sent: "green", failed: "red",
};

function StatBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="text-xs">
      <div className="flex justify-between text-gray-500 mb-0.5"><span>{label}</span><span>{pct}%</span></div>
      <div className="h-1.5 bg-gray-100 rounded-full"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export default function Broadcasts() {
  const { workspace } = useAuthStore();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", template_id: "", scheduled_at: "" });
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const [b, t] = await Promise.all([getBroadcasts(workspace.id), getTemplates(workspace.id)]);
      setBroadcasts(Array.isArray(b) ? b : b.items ?? []);
      setTemplates((Array.isArray(t) ? t : t.items ?? []).filter((t: Template) => t.status === "approved"));
    } catch { setBroadcasts([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [workspace?.id]);

  useEffect(() => {
    if (step === 3 && workspace) {
      segmentPreview(workspace.id, []).then((r) => setPreviewCount(r.count ?? r));
    }
  }, [step]);

  const handleCreate = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const b = await createBroadcast(workspace.id, { ...form, segment_filter: {} });
      if (!form.scheduled_at) await sendBroadcast(workspace.id, b.id);
      setShowCreate(false);
      setStep(1);
      setForm({ name: "", template_id: "", scheduled_at: "" });
      load();
    } finally { setSaving(false); }
  };

  const handleSend = async (id: string) => {
    if (!workspace || !confirm("Send this broadcast now?")) return;
    await sendBroadcast(workspace.id, id);
    load();
  };

  const handleCancel = async (id: string) => {
    if (!workspace) return;
    await cancelBroadcast(workspace.id, id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{broadcasts.length} broadcast{broadcasts.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> New Broadcast</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : broadcasts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Radio size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No broadcasts yet</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>Create Broadcast</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{b.name}</p>
                    <Badge label={b.status} color={STATUS_COLOR[b.status] ?? "gray"} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.total_contacts} contacts
                    {b.scheduled_at && ` · Scheduled ${new Date(b.scheduled_at).toLocaleString()}`}
                    {b.sent_at && ` · Sent ${new Date(b.sent_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {b.status === "draft" && (
                    <Button size="sm" onClick={() => handleSend(b.id)}><Send size={12} /> Send Now</Button>
                  )}
                  {b.status === "scheduled" && (
                    <Button size="sm" variant="danger" onClick={() => handleCancel(b.id)}><X size={12} /> Cancel</Button>
                  )}
                </div>
              </div>
              {b.total_contacts > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <StatBar label="Delivered" value={b.delivered_count} total={b.total_contacts} color="bg-blue-500" />
                  <StatBar label="Read" value={b.read_count} total={b.total_contacts} color="bg-green-500" />
                  <StatBar label="Failed" value={b.failed_count} total={b.total_contacts} color="bg-red-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setStep(1); }} title={`New Broadcast — Step ${step}/3`} width="max-w-md">
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Broadcast Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Diwali Sale 2024"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Template</label>
              <select value={form.template_id} onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Select a template...</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {templates.length === 0 && <p className="text-xs text-yellow-600">No approved templates. Create and get templates approved first.</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={() => setStep(2)} disabled={!form.name || !form.template_id}>Next →</Button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Audience: All opted-in contacts (segment filters coming soon)</p>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Schedule (optional)</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <p className="text-xs text-gray-400">Leave empty to send immediately after creation</p>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)}>Next →</Button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{form.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Template</span><span className="font-medium">{templates.find((t) => t.id === form.template_id)?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Audience</span><span className="font-medium">{previewCount ?? "..."} contacts</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Send</span><span className="font-medium">{form.scheduled_at ? new Date(form.scheduled_at).toLocaleString() : "Immediately"}</span></div>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={handleCreate} loading={saving}>{form.scheduled_at ? "Schedule" : "Send Now"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
