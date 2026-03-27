import { useEffect, useState } from "react";
import { CreditCard, Check } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { getSubscription, getUsage, subscribe, cancelSubscription, getInvoices } from "../api";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

interface Usage {
  messages_sent: number;
  max_messages: number;
  contacts: number;
  max_contacts: number;
  flows_executed: number;
  max_flows: number;
}

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string | null;
}

const PLANS = [
  { key: "free", name: "Free", price: "₹0", features: ["1,000 messages/mo", "500 contacts", "3 flows", "2 broadcasts/mo", "1 team member"] },
  { key: "starter", name: "Starter", price: "₹999/mo", features: ["5,000 messages/mo", "2,000 contacts", "10 flows", "10 broadcasts/mo", "3 team members"] },
  { key: "pro", name: "Pro", price: "₹2,499/mo", features: ["20,000 messages/mo", "10,000 contacts", "50 flows", "50 broadcasts/mo", "10 team members"], popular: true },
  { key: "enterprise", name: "Enterprise", price: "₹7,999/mo", features: ["100,000 messages/mo", "Unlimited contacts", "Unlimited flows", "Unlimited broadcasts", "Unlimited members"] },
];

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>{used.toLocaleString()} / {max === -1 ? "∞" : max.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${max === -1 ? 0 : pct}%` }} />
      </div>
    </div>
  );
}

export default function Billing() {
  const { workspace } = useAuthStore();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    Promise.all([
      getSubscription(workspace.id).catch(() => null),
      getUsage(workspace.id).catch(() => null),
      getInvoices(workspace.id).catch(() => []),
    ]).then(([s, u, inv]) => {
      setSub(s);
      setUsage(u);
      setInvoices(Array.isArray(inv) ? inv : []);
    }).finally(() => setLoading(false));
  }, [workspace?.id]);

  const handleSubscribe = async (plan: string) => {
    if (!workspace || plan === "free") return;
    setSubscribing(plan);
    try {
      const { short_url } = await subscribe(workspace.id, plan);
      if (short_url) window.open(short_url, "_blank");
    } finally { setSubscribing(null); }
  };

  const handleCancel = async () => {
    if (!workspace || !confirm("Cancel your subscription? You'll keep access until the period ends.")) return;
    await cancelSubscription(workspace.id);
    setSub((s) => s ? { ...s, status: "cancelled" } : s);
  };

  const currentPlan = sub?.plan ?? workspace?.plan ?? "free";

  if (loading) return <div className="text-center py-12 text-gray-400">Loading billing...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Current Plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-gray-900">Current Plan</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold capitalize text-green-600">{currentPlan}</span>
              <Badge label={sub?.status ?? "active"} color={sub?.status === "cancelled" ? "red" : "green"} />
            </div>
            {sub?.current_period_end && (
              <p className="text-xs text-gray-400 mt-1">Renews {new Date(sub.current_period_end).toLocaleDateString()}</p>
            )}
          </div>
          {currentPlan !== "free" && sub?.status === "active" && (
            <Button variant="danger" size="sm" onClick={handleCancel}>Cancel Plan</Button>
          )}
        </div>
        {usage && (
          <div className="space-y-3">
            <UsageBar label="Messages Sent" used={usage.messages_sent} max={usage.max_messages} />
            <UsageBar label="Contacts" used={usage.contacts} max={usage.max_contacts} />
            <UsageBar label="Flows" used={usage.flows_executed} max={usage.max_flows} />
          </div>
        )}
      </div>

      {/* Plan Cards */}
      <div>
        <p className="font-semibold text-gray-900 mb-3">Upgrade Plan</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            return (
              <div key={plan.key} className={`bg-white rounded-xl border-2 p-4 relative ${plan.popular ? "border-green-500" : "border-gray-200"}`}>
                {plan.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">Popular</span>
                )}
                <p className="font-semibold text-gray-900">{plan.name}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{plan.price}</p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <Check size={12} className="text-green-600 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-4"
                  size="sm"
                  variant={isCurrent ? "secondary" : "primary"}
                  disabled={isCurrent}
                  loading={subscribing === plan.key}
                  onClick={() => handleSubscribe(plan.key)}
                >
                  {isCurrent ? "Current Plan" : "Upgrade"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="font-semibold text-gray-900 mb-3">Invoice History</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b border-gray-100">
              <tr>
                <th className="text-left pb-2">Date</th>
                <th className="text-left pb-2">Amount</th>
                <th className="text-left pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="py-2 text-gray-600">{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td className="py-2 font-medium">₹{(inv.amount / 100).toLocaleString()}</td>
                  <td className="py-2"><Badge label={inv.status} color={inv.status === "paid" ? "green" : "yellow"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
