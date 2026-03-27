import api from "./client";

// ── Contacts ──────────────────────────────────────────────
export const getContacts = (workspaceId: string, params?: object) =>
  api.get(`/workspaces/${workspaceId}/contacts`, { params }).then((r) => r.data);

export const createContact = (workspaceId: string, body: object) =>
  api.post(`/workspaces/${workspaceId}/contacts`, body).then((r) => r.data);

export const updateContact = (workspaceId: string, id: string, body: object) =>
  api.put(`/workspaces/${workspaceId}/contacts/${id}`, body).then((r) => r.data);

export const deleteContact = (workspaceId: string, id: string) =>
  api.delete(`/workspaces/${workspaceId}/contacts/${id}`);

export const importContacts = (workspaceId: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post(`/workspaces/${workspaceId}/contacts/import`, fd).then((r) => r.data);
};

export const getTags = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/contacts/tags`).then((r) => r.data);

// ── Conversations / Inbox ─────────────────────────────────
export const getConversations = (workspaceId: string, params?: object) =>
  api.get(`/workspaces/${workspaceId}/conversations`, { params }).then((r) => r.data);

export const getMessages = (workspaceId: string, conversationId: string) =>
  api.get(`/workspaces/${workspaceId}/conversations/${conversationId}/messages`).then((r) => r.data);

export const sendMessage = (workspaceId: string, conversationId: string, body: object) =>
  api.post(`/workspaces/${workspaceId}/conversations/${conversationId}/send`, body).then((r) => r.data);

export const resolveConversation = (workspaceId: string, conversationId: string) =>
  api.put(`/workspaces/${workspaceId}/conversations/${conversationId}/resolve`).then((r) => r.data);

export const assignConversation = (workspaceId: string, conversationId: string, userId: string) =>
  api.put(`/workspaces/${workspaceId}/conversations/${conversationId}/assign`, { user_id: userId }).then((r) => r.data);

// ── Flows ─────────────────────────────────────────────────
export const getFlows = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/flows`).then((r) => r.data);

export const createFlow = (workspaceId: string, body: object) =>
  api.post(`/workspaces/${workspaceId}/flows`, body).then((r) => r.data);

export const getFlow = (workspaceId: string, flowId: string) =>
  api.get(`/workspaces/${workspaceId}/flows/${flowId}`).then((r) => r.data);

export const saveFlow = (workspaceId: string, flowId: string, body: object) =>
  api.put(`/workspaces/${workspaceId}/flows/${flowId}`, body).then((r) => r.data);

export const toggleFlow = (workspaceId: string, flowId: string) =>
  api.patch(`/workspaces/${workspaceId}/flows/${flowId}/toggle`).then((r) => r.data);

export const deleteFlow = (workspaceId: string, flowId: string) =>
  api.delete(`/workspaces/${workspaceId}/flows/${flowId}`);

// ── Broadcasts ────────────────────────────────────────────
export const getBroadcasts = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/broadcasts`).then((r) => r.data);

export const createBroadcast = (workspaceId: string, body: object) =>
  api.post(`/workspaces/${workspaceId}/broadcasts`, body).then((r) => r.data);

export const sendBroadcast = (workspaceId: string, broadcastId: string) =>
  api.post(`/workspaces/${workspaceId}/broadcasts/${broadcastId}/send`).then((r) => r.data);

export const cancelBroadcast = (workspaceId: string, broadcastId: string) =>
  api.post(`/workspaces/${workspaceId}/broadcasts/${broadcastId}/cancel`).then((r) => r.data);

export const getBroadcastReport = (workspaceId: string, broadcastId: string) =>
  api.get(`/workspaces/${workspaceId}/broadcasts/${broadcastId}/report`).then((r) => r.data);

export const segmentPreview = (workspaceId: string, filters: object[]) =>
  api.post(`/workspaces/${workspaceId}/contacts/segment/preview`, { filters }).then((r) => r.data);

// ── Templates ─────────────────────────────────────────────
export const getTemplates = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/templates`).then((r) => r.data);

export const createTemplate = (workspaceId: string, body: object) =>
  api.post(`/workspaces/${workspaceId}/templates`, body).then((r) => r.data);

export const deleteTemplate = (workspaceId: string, id: string) =>
  api.delete(`/workspaces/${workspaceId}/templates/${id}`);

export const syncTemplates = (workspaceId: string) =>
  api.post(`/workspaces/${workspaceId}/templates/sync`).then((r) => r.data);

// ── Analytics ─────────────────────────────────────────────
export const getAnalyticsOverview = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/analytics/overview`).then((r) => r.data);

export const getMessageChart = (workspaceId: string, params?: object) =>
  api.get(`/workspaces/${workspaceId}/analytics/messages`, { params }).then((r) => r.data);

// ── Billing ───────────────────────────────────────────────
export const getPlans = () => api.get("/billing/plans").then((r) => r.data);

export const getSubscription = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/billing/subscription`).then((r) => r.data);

export const subscribe = (workspaceId: string, plan: string) =>
  api.post(`/workspaces/${workspaceId}/billing/subscribe`, { plan }).then((r) => r.data);

export const cancelSubscription = (workspaceId: string) =>
  api.delete(`/workspaces/${workspaceId}/billing/subscription`).then((r) => r.data);

export const getUsage = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/billing/usage`).then((r) => r.data);

export const getInvoices = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/billing/invoices`).then((r) => r.data);

// ── Integrations ──────────────────────────────────────────
export const getIntegrations = (workspaceId: string) =>
  api.get(`/workspaces/${workspaceId}/integrations`).then((r) => r.data);

export const createWebhook = (workspaceId: string) =>
  api.post(`/workspaces/${workspaceId}/integrations/webhook`).then((r) => r.data);

export const deleteWebhook = (workspaceId: string, id: string) =>
  api.delete(`/workspaces/${workspaceId}/integrations/webhook/${id}`);
