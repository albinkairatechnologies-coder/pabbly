import { create } from "zustand";
import api from "../api/client";

export interface Message {
  id: string;
  direction: "inbound" | "outbound";
  message_type: string;
  content: Record<string, any>;
  status: string;
  meta_message_id: string | null;
  agent_id: string | null;
  created_at: string | null;
}

export interface Conversation {
  id: string;
  contact_id: string;
  status: string;
  assigned_to: string | null;
  last_message_at: string | null;
  unread_count: number;
  contact_name: string | null;
  contact_phone: string | null;
}

interface InboxState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  wsConnected: boolean;
  ws: WebSocket | null;

  fetchConversations: (workspaceId: string) => Promise<void>;
  fetchMessages: (workspaceId: string, conversationId: string) => Promise<void>;
  setActiveConversation: (id: string) => void;
  sendMessage: (workspaceId: string, conversationId: string, payload: object) => Promise<void>;
  connectWS: (workspaceId: string) => void;
  disconnectWS: () => void;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  wsConnected: false,
  ws: null,

  fetchConversations: async (workspaceId) => {
    const { data } = await api.get(`/workspaces/${workspaceId}/conversations`);
    set({ conversations: data });
  },

  fetchMessages: async (workspaceId, conversationId) => {
    const { data } = await api.get(
      `/workspaces/${workspaceId}/conversations/${conversationId}/messages`
    );
    set({ messages: data });
  },

  setActiveConversation: (id) => set({ activeConversationId: id, messages: [] }),

  sendMessage: async (workspaceId, conversationId, payload) => {
    const { data } = await api.post(
      `/workspaces/${workspaceId}/conversations/${conversationId}/send`,
      payload
    );
    set((s) => ({ messages: [...s.messages, data] }));
  },

  connectWS: (workspaceId) => {
    const existing = get().ws;
    if (existing) existing.close();

    const wsUrl = `${import.meta.env.VITE_WS_URL ?? "ws://localhost:8000"}/ws/${workspaceId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => set({ wsConnected: true });
    ws.onclose = () => set({ wsConnected: false, ws: null });

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const state = get();

      if (payload.type === "new_message") {
        // Append to messages if this conversation is active
        if (state.activeConversationId === payload.conversation_id) {
          set((s) => ({ messages: [...s.messages, payload.message] }));
        }
        // Update conversation last_message_at + unread
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === payload.conversation_id
              ? { ...c, unread_count: c.unread_count + 1, last_message_at: payload.message.created_at }
              : c
          ),
        }));
      }

      if (payload.type === "status_update") {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.meta_message_id === payload.meta_message_id ? { ...m, status: payload.status } : m
          ),
        }));
      }
    };

    set({ ws });
  },

  disconnectWS: () => {
    get().ws?.close();
    set({ ws: null, wsConnected: false });
  },
}));
