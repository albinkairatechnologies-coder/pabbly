import { create } from "zustand";
import api from "../api/client";

interface User { id: string; email: string; full_name: string }
interface Workspace { id: string; name: string; slug: string; plan: string }

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; workspace_name: string }) => Promise<void>;
  logout: () => void;
  setWorkspace: (w: Workspace) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem("user") ?? "null"),
  workspace: JSON.parse(localStorage.getItem("workspace") ?? "null"),
  token: localStorage.getItem("token"),

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("workspace", JSON.stringify(data.workspace));
    localStorage.setItem("user", JSON.stringify(data.user));
    set({ token: data.access_token, user: data.user, workspace: data.workspace });
  },

  register: async (body) => {
    const { data } = await api.post("/auth/register", body);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("workspace", JSON.stringify(data.workspace));
    localStorage.setItem("user", JSON.stringify(data.user));
    set({ token: data.access_token, user: data.user, workspace: data.workspace });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("workspace");
    localStorage.removeItem("user");
    set({ token: null, user: null, workspace: null });
  },

  setWorkspace: (workspace) => set({ workspace }),
}));
