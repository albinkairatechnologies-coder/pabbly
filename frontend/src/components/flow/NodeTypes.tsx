import {
  Zap, MessageSquare, GitBranch, Clock, Globe,
  Image, List, FileText, UserCheck, Tag, UserX,
  Mail, Repeat, PhoneCall, MousePointerClick,
  CalendarClock, Webhook, Reply, UserCog, Send,
  MessageCircle, SplitSquareVertical, LayoutList,
} from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

// ── Node catalogue ────────────────────────────────────────
// Nodes marked twilio:false are hidden when provider is Twilio
export const NODE_CATEGORIES = [
  {
    category: "Triggers",
    nodes: [
      { type: "trigger_keyword",      label: "Keyword Trigger",    icon: Zap,                color: "border-green-500",   bg: "bg-green-50",   text: "text-green-600",  twilio: true },
      { type: "trigger_first",        label: "First Message",      icon: PhoneCall,           color: "border-green-500",   bg: "bg-green-50",   text: "text-green-600",  twilio: true },
      { type: "trigger_optin",        label: "Opt-in",             icon: UserCheck,           color: "border-green-500",   bg: "bg-green-50",   text: "text-green-600",  twilio: true },
      { type: "trigger_button",       label: "Button Reply",       icon: MousePointerClick,   color: "border-green-500",   bg: "bg-green-50",   text: "text-green-600",  twilio: false },
      { type: "trigger_list",         label: "List Reply",         icon: List,                color: "border-green-500",   bg: "bg-green-50",   text: "text-green-600",  twilio: false },
      { type: "trigger_schedule",     label: "Schedule",           icon: CalendarClock,       color: "border-green-500",   bg: "bg-green-50",   text: "text-green-600",  twilio: true },
      { type: "trigger_webhook",      label: "Webhook",            icon: Webhook,             color: "border-green-500",   bg: "bg-green-50",   text: "text-green-600",  twilio: true },
    ],
  },
  {
    category: "WhatsApp",
    nodes: [
      { type: "send_message",         label: "Send Text",          icon: MessageSquare,       color: "border-blue-500",    bg: "bg-blue-50",    text: "text-blue-600",   twilio: true },
      { type: "send_image",           label: "Send Image",         icon: Image,               color: "border-blue-500",    bg: "bg-blue-50",    text: "text-blue-600",   twilio: true },
      { type: "send_buttons",         label: "Send Buttons",       icon: MousePointerClick,   color: "border-blue-500",    bg: "bg-blue-50",    text: "text-blue-600",   twilio: false },
      { type: "send_list",            label: "Send List Menu",     icon: LayoutList,          color: "border-blue-500",    bg: "bg-blue-50",    text: "text-blue-600",   twilio: false },
      { type: "send_template",        label: "Send Template",      icon: FileText,            color: "border-blue-500",    bg: "bg-blue-50",    text: "text-blue-600",   twilio: false },
      { type: "send_audio",           label: "Send Audio",         icon: MessageCircle,       color: "border-blue-500",    bg: "bg-blue-50",    text: "text-blue-600",   twilio: true },
      { type: "wait_for_reply",       label: "Wait for Reply",     icon: Reply,               color: "border-blue-500",    bg: "bg-blue-50",    text: "text-blue-600",   twilio: true },
    ],
  },
  {
    category: "Contact",
    nodes: [
      { type: "add_tag",              label: "Add Tag",            icon: Tag,                 color: "border-violet-500",  bg: "bg-violet-50",  text: "text-violet-600", twilio: true },
      { type: "remove_tag",           label: "Remove Tag",         icon: UserX,               color: "border-violet-500",  bg: "bg-violet-50",  text: "text-violet-600", twilio: true },
      { type: "update_contact",       label: "Update Contact",     icon: UserCog,             color: "border-violet-500",  bg: "bg-violet-50",  text: "text-violet-600", twilio: true },
      { type: "assign_agent",         label: "Assign Agent",       icon: UserCheck,           color: "border-violet-500",  bg: "bg-violet-50",  text: "text-violet-600", twilio: true },
      { type: "resolve_conversation", label: "Resolve Chat",       icon: Send,                color: "border-violet-500",  bg: "bg-violet-50",  text: "text-violet-600", twilio: true },
    ],
  },
  {
    category: "Logic",
    nodes: [
      { type: "condition",            label: "Condition",          icon: GitBranch,           color: "border-orange-500",  bg: "bg-orange-50",  text: "text-orange-600", twilio: true },
      { type: "ab_split",             label: "A/B Split",          icon: SplitSquareVertical, color: "border-orange-500",  bg: "bg-orange-50",  text: "text-orange-600", twilio: true },
      { type: "wait",                 label: "Wait / Delay",       icon: Clock,               color: "border-purple-500",  bg: "bg-purple-50",  text: "text-purple-600", twilio: true },
      { type: "jump_flow",            label: "Jump to Flow",       icon: Repeat,              color: "border-orange-500",  bg: "bg-orange-50",  text: "text-orange-600", twilio: true },
    ],
  },
  {
    category: "Integrations",
    nodes: [
      { type: "action",               label: "HTTP Request",       icon: Globe,               color: "border-teal-500",    bg: "bg-teal-50",    text: "text-teal-600",   twilio: true },
      { type: "send_email",           label: "Send Email",         icon: Mail,                color: "border-teal-500",    bg: "bg-teal-50",    text: "text-teal-600",   twilio: true },
      { type: "google_sheets",        label: "Google Sheets",      icon: FileText,            color: "border-teal-500",    bg: "bg-teal-50",    text: "text-teal-600",   twilio: true },
    ],
  },
];

// flat lookup
export const NODE_META: Record<string, any> = {};
NODE_CATEGORIES.forEach((cat) => cat.nodes.forEach((n) => { NODE_META[n.type] = n; }));

// ── Generic node wrapper ──────────────────────────────────
function NodeBox({ type, label, subtitle, selected, children }: {
  type: string; label: string; subtitle?: string; selected?: boolean; children?: React.ReactNode;
}) {
  const meta = NODE_META[type] ?? { color: "border-gray-400", bg: "bg-gray-50", text: "text-gray-600", icon: Zap };
  const Icon = meta.icon;
  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm min-w-[190px] max-w-[220px] ${selected ? "border-blue-500 shadow-blue-100 shadow-md" : meta.color}`}>
      <div className="px-3 py-2 flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
          <Icon size={13} className={meta.text} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-900 truncate">{label}</p>
          {subtitle && <p className="text-[10px] text-gray-400 truncate">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Trigger node ──────────────────────────────────────────
export function TriggerNode({ data, selected, type }: NodeProps) {
  const sub = (data.keyword || data.cron || data.button_id || "") as string;
  return (
    <NodeBox type={type as string} label={data.label as string} subtitle={sub} selected={selected}>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </NodeBox>
  );
}

// ── Standard node ─────────────────────────────────────────
export function StandardNode({ data, selected, type }: NodeProps) {
  const sub = (data.message || data.url || data.template_name || data.tag || data.email_to || data.image_url || "") as string;
  return (
    <NodeBox type={type as string} label={data.label as string} subtitle={sub} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3" />
    </NodeBox>
  );
}

// ── Condition node ────────────────────────────────────────
export function ConditionNode({ data, selected }: NodeProps) {
  return (
    <NodeBox type="condition" label={data.label as string} subtitle={`${data.field ?? "message"} ${data.operator ?? "contains"} "${data.value ?? ""}"`} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-400" />
      <div className="flex justify-between px-4 pb-1.5 pt-0.5">
        <span className="text-[10px] font-medium text-green-600">✓ Yes</span>
        <span className="text-[10px] font-medium text-red-500">✗ No</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: "28%" }} className="!w-3 !h-3 !bg-green-500" />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: "72%" }} className="!w-3 !h-3 !bg-red-500" />
    </NodeBox>
  );
}

// ── A/B Split node ────────────────────────────────────────
export function ABSplitNode({ data, selected }: NodeProps) {
  const pct = (data.split_percent as number) ?? 50;
  return (
    <NodeBox type="ab_split" label={data.label as string} subtitle={`A: ${pct}% / B: ${100 - pct}%`} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-orange-400" />
      <div className="flex justify-between px-4 pb-1.5 pt-0.5">
        <span className="text-[10px] font-medium text-blue-600">A {pct}%</span>
        <span className="text-[10px] font-medium text-purple-600">B {100 - pct}%</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="a" style={{ left: "28%" }} className="!w-3 !h-3 !bg-blue-500" />
      <Handle type="source" position={Position.Bottom} id="b" style={{ left: "72%" }} className="!w-3 !h-3 !bg-purple-500" />
    </NodeBox>
  );
}

// ── Send Buttons node ─────────────────────────────────────
export function SendButtonsNode({ data, selected }: NodeProps) {
  const buttons: string[] = (data.buttons as string[] | undefined) ?? [];
  return (
    <NodeBox type="send_buttons" label={data.label as string} subtitle={data.body as string} selected={selected}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-blue-400" />
      {buttons.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {buttons.slice(0, 3).map((b, i) => (
            <div key={i} className="text-[10px] bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-blue-700 truncate">{b}</div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-blue-500" />
    </NodeBox>
  );
}

// ── nodeTypes map for React Flow ──────────────────────────
export const nodeTypes: Record<string, any> = {
  trigger_keyword: TriggerNode,
  trigger_first: TriggerNode,
  trigger_optin: TriggerNode,
  trigger_button: TriggerNode,
  trigger_list: TriggerNode,
  trigger_schedule: TriggerNode,
  trigger_webhook: TriggerNode,
  send_message: StandardNode,
  send_image: StandardNode,
  send_buttons: SendButtonsNode,
  send_list: StandardNode,
  send_template: StandardNode,
  send_audio: StandardNode,
  wait_for_reply: StandardNode,
  add_tag: StandardNode,
  remove_tag: StandardNode,
  update_contact: StandardNode,
  assign_agent: StandardNode,
  resolve_conversation: StandardNode,
  condition: ConditionNode,
  ab_split: ABSplitNode,
  wait: StandardNode,
  jump_flow: StandardNode,
  action: StandardNode,
  send_email: StandardNode,
  google_sheets: StandardNode,
};
