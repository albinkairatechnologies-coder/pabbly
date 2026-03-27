import { useEffect, useState } from "react";
import { Upload, Plus, Search, Trash2, Tag } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getContacts, createContact, deleteContact, importContacts } from "../api";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";

interface Contact {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  tags: string[];
  opted_in: boolean;
  last_seen: string | null;
  total_messages_sent: number;
}

export default function Contacts() {
  const { workspace } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", phone_number: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await getContacts(workspace.id, { search, limit: 100 });
      setContacts(Array.isArray(data) ? data : data.items ?? []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workspace?.id, search]);

  const handleCreate = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const c = await createContact(workspace.id, form);
      setContacts((prev) => [c, ...prev]);
      setShowCreate(false);
      setForm({ name: "", phone_number: "", email: "" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!workspace || !confirm("Delete this contact?")) return;
    await deleteContact(workspace.id, id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;
    await importContacts(workspace.id, file);
    alert("Import started. Contacts will appear shortly.");
    load();
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-64"
          />
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button variant="secondary" size="sm">
              <Upload size={14} /> Import CSV
            </Button>
          </label>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Add Contact
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-8 px-4 py-3">
                <input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(contacts.map((c) => c.id)) : new Set())} />
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tags</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Opted In</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Last Seen</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Messages</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No contacts found</td></tr>
            ) : contacts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{c.name || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone_number}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags?.map((t) => <Badge key={t} label={t} color="blue" />)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge label={c.opted_in ? "Yes" : "No"} color={c.opted_in ? "green" : "gray"} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {c.last_seen ? new Date(c.last_seen).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{c.total_messages_sent}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Contact">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Phone Number" placeholder="+919876543210" value={form.phone_number} onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} required />
          <Input label="Email (optional)" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Save Contact</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
