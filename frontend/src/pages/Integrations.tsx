import { useEffect, useState } from "react";
import { Plus, Copy, Trash2, Plug, Check } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getIntegrations, createWebhook, deleteWebhook } from "../api";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";

interface Webhook {
  id: string;
  webhook_url: string;
  secret: string;
  created_at: string;
}

const INTEGRATIONS = [
  { key: "shopify", name: "Shopify", desc: "Auto-send order updates, abandoned cart reminders", icon: "🛍️", available: true },
  { key: "razorpay", name: "Razorpay", desc: "Payment confirmations and subscription reminders", icon: "💳", available: true },
  { key: "google_sheets", name: "Google Sheets", desc: "Import contacts from spreadsheets", icon: "📊", available: false },
  { key: "woocommerce", name: "WooCommerce", desc: "Order and shipping notifications", icon: "🛒", available: false },
];

export default function Integrations() {
  const { workspace } = useAuthStore();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newWebhook, setNewWebhook] = useState<Webhook | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await getIntegrations(workspace.id);
      setWebhooks(Array.isArray(data?.webhooks) ? data.webhooks : []);
    } catch { setWebhooks([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [workspace?.id]);

  const handleCreate = async () => {
    if (!workspace) return;
    setCreating(true);
    try {
      const wh = await createWebhook(workspace.id);
      setNewWebhook(wh);
      setWebhooks((prev) => [wh, ...prev]);
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!workspace || !confirm("Delete this webhook?")) return;
    await deleteWebhook(workspace.id, id);
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Native Integrations */}
      <div>
        <p className="font-semibold text-gray-900 mb-3">Available Integrations</p>
        <div className="grid grid-cols-2 gap-3">
          {INTEGRATIONS.map((int) => (
            <div key={int.key} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <span className="text-2xl">{int.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{int.name}</p>
                  {!int.available && <Badge label="Coming Soon" color="gray" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{int.desc}</p>
              </div>
              <Button size="sm" variant="secondary" disabled={!int.available}>
                {int.available ? "Connect" : "Soon"}
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Webhooks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-gray-900">Incoming Webhooks</p>
            <p className="text-xs text-gray-500 mt-0.5">Trigger flows from external services via HTTP POST</p>
          </div>
          <Button size="sm" onClick={handleCreate} loading={creating}><Plus size={14} /> New Webhook</Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <Plug size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No webhooks yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <div key={wh.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700 truncate max-w-xs">{wh.webhook_url}</code>
                      <button onClick={() => copyToClipboard(wh.webhook_url, `url-${wh.id}`)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        {copied === `url-${wh.id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Secret:</span>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{wh.secret.slice(0, 12)}...</code>
                      <button onClick={() => copyToClipboard(wh.secret, `sec-${wh.id}`)} className="text-gray-400 hover:text-gray-600">
                        {copied === `sec-${wh.id}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Created {new Date(wh.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleDelete(wh.id)} className="text-gray-300 hover:text-red-500 ml-3">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New webhook modal */}
      <Modal open={!!newWebhook} onClose={() => setNewWebhook(null)} title="Webhook Created">
        {newWebhook && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Save your webhook secret — it won't be shown again.</p>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Webhook URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-gray-100 px-3 py-2 rounded-lg text-gray-700 break-all">{newWebhook.webhook_url}</code>
                <button onClick={() => copyToClipboard(newWebhook.webhook_url, "new-url")} className="text-gray-400 hover:text-gray-600">
                  {copied === "new-url" ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">Secret Key</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg text-gray-700 break-all">{newWebhook.secret}</code>
                <button onClick={() => copyToClipboard(newWebhook.secret, "new-sec")} className="text-gray-400 hover:text-gray-600">
                  {copied === "new-sec" ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
            <Button className="w-full" onClick={() => setNewWebhook(null)}>Done</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
