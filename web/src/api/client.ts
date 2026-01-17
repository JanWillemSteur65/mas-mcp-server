export type ApiError = { detail?: string };

const API_BASE = import.meta.env.VITE_API_BASE || "";
const TOKEN_KEY = "mas_mcp_token";

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!res.ok) {
    let body: ApiError = {};
    try {
      body = await res.json();
    } catch {}
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ id: number; email: string; roles: string[] }>(`/api/me`),
  tenants: () => request<any[]>(`/api/tenants`),
  createTenant: (payload: any) => request<any>(`/api/tenants`, { method: "POST", body: JSON.stringify(payload) }),
  discoverTenant: (id: number) => request<any>(`/api/tenants/${id}/discover`, { method: "POST" }),
  messages: (tenantId: number) => request<any[]>(`/api/tenants/${tenantId}/messages`),
  updateMessage: (tenantId: number, messageId: number, payload: any) =>
    request<any>(`/api/tenants/${tenantId}/messages/${messageId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  replayMessage: (tenantId: number, messageId: number) =>
    request<any>(`/api/tenants/${tenantId}/messages/${messageId}/replay`, { method: "POST" }),
  concepts: (tenantId: number) => request<any[]>(`/api/tenants/${tenantId}/concepts`),
  upsertConcept: (tenantId: number, payload: any) =>
    request<any>(`/api/tenants/${tenantId}/concepts`, { method: "POST", body: JSON.stringify(payload) }),
  traces: (tenantId: number) => request<any[]>(`/api/tenants/${tenantId}/trace`),
  settings: (tenantId?: number) =>
    request<any>(tenantId ? `/api/settings?scope=tenant&scopeId=${tenantId}` : `/api/settings?scope=global`),
  saveSettings: (payload: any) => request<any>(`/api/settings`, { method: "PUT", body: JSON.stringify(payload) }),
};
