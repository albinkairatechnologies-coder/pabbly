import api from "./client";

export const adminStats = () =>
  api.get("/admin/stats").then((r) => r.data);

export const adminRevenue = () =>
  api.get("/admin/revenue").then((r) => r.data);

export const adminWorkspaces = (params?: object) =>
  api.get("/admin/workspaces", { params }).then((r) => r.data);

export const adminWorkspaceDetail = (id: string) =>
  api.get(`/admin/workspaces/${id}`).then((r) => r.data);

export const adminChangePlan = (id: string, plan: string) =>
  api.patch(`/admin/workspaces/${id}/plan`, { plan }).then((r) => r.data);

export const adminSuspendWorkspace = (id: string, is_active: boolean) =>
  api.patch(`/admin/workspaces/${id}/suspend`, { is_active }).then((r) => r.data);

export const adminExtendValidity = (id: string, days: number) =>
  api.post(`/admin/workspaces/${id}/extend`, { days }).then((r) => r.data);

export const adminAddPayment = (id: string, body: object) =>
  api.post(`/admin/workspaces/${id}/payments`, body).then((r) => r.data);

export const adminGetPayments = (id: string) =>
  api.get(`/admin/workspaces/${id}/payments`).then((r) => r.data);

export const adminUsers = (params?: object) =>
  api.get("/admin/users", { params }).then((r) => r.data);

export const adminEditUser = (id: string, body: object) =>
  api.patch(`/admin/users/${id}`, body).then((r) => r.data);

export const adminSuspendUser = (id: string, is_active: boolean) =>
  api.patch(`/admin/users/${id}/suspend`, { is_active }).then((r) => r.data);

export const adminSetSuperadmin = (id: string, is_superadmin: boolean) =>
  api.patch(`/admin/users/${id}/superadmin`, { is_superadmin }).then((r) => r.data);
