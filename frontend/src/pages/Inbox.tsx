import { useEffect, useRef, useState } from "react";
import { Send, CheckCheck, Check, Phone, MoreVertical, Search, Circle } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useInboxStore } from "../store/inboxStore";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";

function statusIcon(status: string) {
  if (status === "read") return <CheckCheck size={13} className="text-blue-400" />;
  if (status === "delivered") return <CheckCheck size={13} className="text-gray-400" />;
  return <Check size={13} className="text-gray-400" />;
}

function Avatar({ name, size = "md" }: { name?: string | null; size?: "sm" | "md" }) {
  const initials = name?.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  const colors = ["from-violet-400 to-purple-500", "from-blue-400 to-blue-500", "from-orange-400 to-orange-500", "from-pink-400 to-rose-500", "from-teal-400 to-emerald-500"];
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length];
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function Inbox() {
  const { workspace } = useAuthStore();
  const {
    conversations, activeConversationId, messages,
    fetchConversations, fetchMessages, setActiveConversation,
    sendMessage, connectWS, wsConnected,
  } = useInboxStore();

  const [text, setText] = useState("");
  const [filter, setFilter] = useState("open");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspace) return;
    fetchConversations(workspace.id);
    connectWS(workspace.id);
  }, [workspace?.id]);

  useEffect(() => {
    if (activeConversationId && workspace) fetchMessages(workspace.id, activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !workspace || !activeConversationId) return;
    setSending(true);
    try {
      await sendMessage(workspace.id, activeConversationId, { type: "text", text });
      setText("");
    } finally { setSending(false); }
  };

  const filtered = conversations.filter((c) => c.status === filter);
  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-full -m-6 overflow-hidden rounded-none">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-100 bg-white flex flex-col flex-shrink-0">
        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input placeholder="Search..." className="bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none w-full" />
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 mt-2.5 bg-gray-100 rounded-xl p-1">
            {["open", "resolved", "bot"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-1 text-xs py-1.5 rounded-lg capitalize font-medium transition-all ${
                  filter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Phone size={28} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">No conversations</p>
            </div>
          )}
          {filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={`w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                activeConversationId === conv.id ? "bg-green-50 border-l-2 border-l-green-500" : ""
              }`}
            >
              <Avatar name={conv.contact_name ?? conv.contact_phone} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {conv.contact_name ?? conv.contact_phone}
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{conv.contact_phone}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-1.5">
          <Circle
            size={7}
            className={`${wsConnected ? "text-green-500 fill-green-500 pulse-dot" : "text-gray-300 fill-gray-300"}`}
          />
          <span className={`text-xs font-medium ${wsConnected ? "text-green-600" : "text-gray-400"}`}>
            {wsConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {activeConversationId ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between flex-shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <Avatar name={activeConv?.contact_name ?? activeConv?.contact_phone} />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{activeConv?.contact_name ?? activeConv?.contact_phone}</p>
                  <p className="text-xs text-gray-400">{activeConv?.contact_phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  label={activeConv?.status ?? "open"}
                  color={activeConv?.status === "resolved" ? "green" : activeConv?.status === "bot" ? "purple" : "blue"}
                />
                <button className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <MoreVertical size={15} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {messages.map((msg) => {
                const isOut = msg.direction === "outbound";
                const msgText = msg.content?.text ?? msg.content?.body ?? JSON.stringify(msg.content);
                return (
                  <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        isOut
                          ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-br-sm"
                          : "bg-white text-gray-900 rounded-bl-sm border border-gray-100"
                      }`}
                    >
                      <p className="leading-relaxed">{msgText}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${isOut ? "text-green-200" : "text-gray-400"}`}>
                        <span className="text-[10px]">
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                        {isOut && statusIcon(msg.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-end gap-2.5 flex-shrink-0">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
              <button
                onClick={handleSend}
                disabled={sending || !text.trim()}
                className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-sm hover:shadow-md hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 transition-all flex-shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Phone size={28} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">Select a conversation</p>
              <p className="text-xs text-gray-400 mt-1">Choose from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
