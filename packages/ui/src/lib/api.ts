function normalize(p: string) {
  if (!p) return "/";
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  return p.startsWith("/") ? p : `/${p}`;
}

function adminTokenHeader(urlPath: string): Record<string, string> {
  const p = normalize(urlPath);
  if (!p.startsWith("/api/")) return {};
  try {
    const token = localStorage.getItem("maximoMcpAdminToken") || "";
    return token ? { "x-admin-token": token } : {};
  } catch {
    return {};
  }
}

export async function apiGet(path: string) {
  const url = normalize(path);
  const r = await fetch(url, { headers: { accept: "application/json", ...adminTokenHeader(url) }, cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function apiPost(path: string, body: any) {
  const url = normalize(path);
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...adminTokenHeader(url) },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function apiDelete(path: string) {
  const url = normalize(path);
  const r = await fetch(url, { method: "DELETE", headers: { accept: "application/json", ...adminTokenHeader(url) }, cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function mcpCall(tenantId: string, method: string, params: any) {
  const r = await fetch("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "x-tenant-id": tenantId },
    body: JSON.stringify({ jsonrpc: "2.0", id: String(Date.now()), method, params }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
