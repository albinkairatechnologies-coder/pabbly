import { useEffect, useRef, useState } from "react";
import { Send, CheckCheck, Check, Phone, Tag, MoreVertical } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useInboxStore } from "../store/inboxStore";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";

function statusIcon(status: string) {
  if (status === "read") return <CheckCheck size={12} className="text-blue-500" />;
  if (status === "delivered") return <CheckCheck size={12} className="text-gray-400" />;
  return <Check size={12} className="text-gray-400" />;
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
    if (activeConversationId && workspace) {
      fetchMessages(workspace.id, activeConversationId);
    }
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
    } finally {
      setSending(false);
    }
  };

  const filtered = conversations.filter((c) => c.status === filter);
  const activeConv = conversations.find((c) => c.id === activeConversationId);

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* Conversation list */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-200">
          <input
            placeholder="Search conversations..."
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-1 mt-2">
            {["open", "resolved", "bot"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex-1 text-xs py-1 rounded-md capitalize transition-colors ${
                  filter === s ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 mt-8">No conversations</p>
          )}
          {filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                activeConversationId === conv.id ? "bg-green-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-900 truncate">
                  {conv.contact_name ?? conv.contact_phone}
                </span>
                {conv.unread_count > 0 && (
                  <span className="bg-green-600 text-white text-xs rounded-full px-1.5 py-0.5 ml-1">
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{conv.contact_phone}</p>
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-gray-200">
          <span className={`text-xs ${wsConnected ? "text-green-600" : "text-gray-400"}`}>
            ● {wsConnected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {activeConversationId ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="font-medium text-gray-900">{activeConv?.contact_name ?? activeConv?.contact_phone}</p>
                <p className="text-xs text-gray-400">{activeConv?.contact_phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  label={activeConv?.status ?? "open"}
                  color={activeConv?.status === "resolved" ? "green" : activeConv?.status === "bot" ? "purple" : "blue"}
                />
                <button className="text-gray-400 hover:text-gray-600"><MoreVertical size={16} /></button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((msg) => {
                const isOut = msg.direction === "outbound";
                const text = msg.content?.text ?? msg.content?.body ?? JSON.stringify(msg.content);
                return (
                  <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-xl text-sm shadow-sm ${
                        isOut ? "bg-green-600 text-white rounded-br-sm" : "bg-white text-gray-900 rounded-bl-sm"
                      }`}
                    >
                      <p>{text}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${isOut ? "text-green-200" : "text-gray-400"}`}>
                        <span className="text-xs">
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
            <div className="bg-white border-t border-gray-200 p-3 flex items-end gap-2 flex-shrink-0">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <Button onClick={handleSend} loading={sending} size="sm">
                <Send size={14} />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Phone size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
