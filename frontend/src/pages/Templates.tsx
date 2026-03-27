import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, FileText } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getTemplates, createTemplate, deleteTemplate, syncTemplates } from "../api";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";

interface Template {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  rejection_reason: string | null;
  components: any[];
}

const STATUS_COLOR: Record<string, any> = {
  approved: "green", pending: "yellow", rejected: "red",
};

export default function Templates() {
  const { workspace } = useAuthStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", category: "marketing", language: "en",
    header: "", body: "", footer: "",
  });

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await getTemplates(workspace.id);
      setTemplates(Array.isArray(data) ? data : data.items ?? []);
    } catch { setTemplates([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [workspace?.id]);

  const handleSync = async () => {
    if (!workspace) return;
    setSyncing(true);
    try { await syncTemplates(workspace.id); await load(); }
    finally { setSyncing(false); }
  };

  const handleCreate = async () => {
    if (!workspace) return;
    setSaving(true);
    const components: any[] = [];
    if (form.header) components.push({ type: "HEADER", format: "TEXT", text: form.header });
    components.push({ type: "BODY", text: form.body });
    if (form.footer) components.push({ type: "FOOTER", text: form.footer });
    try {
      await createTemplate(workspace.id, {
        name: form.name.toLowerCase().replace(/\s+/g, "_"),
        category: form.category.toUpperCase(),
        language: form.language,
        components,
      });
      setShowCreate(false);
      setForm({ name: "", category: "marketing", language: "en", header: "", body: "", footer: "" });
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!workspace || !confirm("Delete this template?")) return;
    await deleteTemplate(workspace.id, id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleSync} loading={syncing}>
            <RefreshCw size={14} /> Sync Status
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> New Template</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No templates yet</p>
          <p className="text-sm text-gray-400 mt-1">Create templates and submit them to Meta for approval</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>Create Template</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <Badge label={t.status} color={STATUS_COLOR[t.status] ?? "gray"} />
                    <Badge label={t.category} color="blue" />
                    <Badge label={t.language} color="gray" />
                  </div>
                  {t.rejection_reason && (
                    <p className="text-xs text-red-500 mt-1">Rejected: {t.rejection_reason}</p>
                  )}
                  {t.components?.map((c: any, i: number) => (
                    <p key={i} className="text-xs text-gray-500 mt-1 truncate">
                      <span className="font-medium">{c.type}:</span> {c.text ?? c.format}
                    </p>
                  ))}
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-gray-300 hover:text-red-500 ml-3">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Template">
        <div className="space-y-4">
          <Input label="Template Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="order_confirmation" helper="Lowercase, underscores only" required />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="marketing">Marketing</option>
                <option value="utility">Utility</option>
                <option value="authentication">Authentication</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Language</label>
              <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="en">English</option>
                <option value="en_IN">English (India)</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
          </div>
          <Input label="Header (optional)" value={form.header} onChange={(e) => setForm((f) => ({ ...f, header: e.target.value }))}
            placeholder="Your Order Update" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Body <span className="text-red-500">*</span></label>
            <textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={4}
              placeholder="Hi {{1}}, your order #{{2}} has been confirmed!"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
            <p className="text-xs text-gray-400">Use {"{{1}}"}, {"{{2}}"} for variables</p>
          </div>
          <Input label="Footer (optional)" value={form.footer} onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
            placeholder="Reply STOP to unsubscribe" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.name || !form.body}>Submit for Approval</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
