import { TenantConfig } from "../tenant/tenantStore.js";
import { readSecret } from "../config.js";
import { err } from "../errors.js";

function logUpstream(label: string, url: string, res: Response) {
  const ct = res.headers.get("content-type") || "";
  console.log(`[maximo] ${label} ${url} -> ${res.status} ${ct}`);
}

async function readBodySnippet(res: Response, limit = 800): Promise<string> {
  try {
    const txt = await res.text();
    return txt.length > limit ? txt.slice(0, limit) + "…" : txt;
  } catch {
    return "";
  }
}

type OslcQueryArgs = {
  /** Optional OSLC where clause. If omitted, the request will not include oslc.where. */
  where?: string;
  select: string;
  orderBy?: string;
  pageSize: number;
  start: number;
};

export class MaximoClient {
  constructor(private tenant: TenantConfig) {}

  private async authHeaders(): Promise<Record<string,string>> {
    if (this.tenant.authMode === "apiKey") {
      const key = (this.tenant as any).apiKey ? String((this.tenant as any).apiKey) :
        this.tenant.apiKeyRef ? readSecret(this.tenant.apiKeyRef as any) : "";
      if (!key) throw err("TENANT_MISSING_APIKEY", `apiKey or apiKeyRef not configured for tenant ${this.tenant.tenantId}`);
      // Common header names seen in MAS/Maximo setups; adjust if your environment differs.
      return { "apikey": key };
    }

    if (this.tenant.authMode === "maxauth") {
      const u = (this.tenant as any).username ? String((this.tenant as any).username) :
        this.tenant.maxauth?.usernameRef ? readSecret(this.tenant.maxauth.usernameRef as any) : "";
      const p = (this.tenant as any).password ? String((this.tenant as any).password) :
        this.tenant.maxauth?.passwordRef ? readSecret(this.tenant.maxauth.passwordRef as any) : "";
      if (!u || !p) throw err("TENANT_MISSING_MAXAUTH", `maxauth.usernameRef and maxauth.passwordRef not configured for tenant ${this.tenant.tenantId}`);
      return { "maxauth": Buffer.from(`${u}:${p}`).toString("base64") };
    }

    if (!this.tenant.oauth)
 throw err("TENANT_MISSING_OAUTH", `oauth not configured for tenant ${this.tenant.tenantId}`);
    const clientId = readSecret(this.tenant.oauth.clientIdRef as any);
    const clientSecret = readSecret(this.tenant.oauth.clientSecretRef as any);
    if (!clientId || !clientSecret) throw err("TENANT_MISSING_OAUTH_SECRET", "Missing OAuth clientId/clientSecret");
    const form = new URLSearchParams();
    form.set("grant_type","client_credentials");
    if (this.tenant.oauth.scope) form.set("scope", this.tenant.oauth.scope);

    const tokenRes = await fetch(this.tenant.oauth.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "authorization": "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
      },
      body: form.toString(),
    });
    if (!tokenRes.ok) throw err("OAUTH_TOKEN_FAILED", `OAuth token request failed (${tokenRes.status})`);
    const tokTxt = await tokenRes.text();
    let tok: any = {};
    try { tok = JSON.parse(tokTxt); } catch {
      throw err("OAUTH_TOKEN_PARSE_FAILED", `OAuth token response was not JSON (${tokenRes.status})`, { contentType: tokenRes.headers.get("content-type") || "", bodySnippet: tokTxt.slice(0, 200) });
    }
    const access = String(tok.access_token || "");
    if (!access) throw err("OAUTH_TOKEN_MISSING", "OAuth token response missing access_token");
    return { "authorization": `Bearer ${access}` };
  }

  private base(p: string) {
    return this.tenant.baseUrl.replace(/\/$/,"") + p;
  }

  async oslcQuery(objectStructure: string, args: OslcQueryArgs): Promise<{ items: any[]; count?: number }> {
    const url = new URL(this.base(`/oslc/os/${encodeURIComponent(objectStructure)}`));
    if (args.where && args.where.trim()) {
      url.searchParams.set("oslc.where", args.where);
    }
    url.searchParams.set("oslc.select", args.select);
    url.searchParams.set("oslc.pageSize", String(args.pageSize));
    url.searchParams.set("oslc.paging", "true");
    url.searchParams.set("oslc.startIndex", String(Math.max(1, args.start + 1))); // OSLC is often 1-based
    if (args.orderBy) url.searchParams.set("oslc.orderBy", args.orderBy);

    const headers = await this.authHeaders();
    headers["accept"] = "application/json";

    const res = await fetch(url.toString(), { headers });
    logUpstream("GET", url.toString(), res);
    if (!res.ok) {
      const snippet = await readBodySnippet(res);
      throw err("OSLC_QUERY_FAILED", `OSLC query failed (${res.status})`, { objectStructure, contentType: res.headers.get("content-type") || "", bodySnippet: snippet });
    }
    const bodyTxt = await res.text();
    let json: any;
    try { json = JSON.parse(bodyTxt); } catch {
      throw err("OSLC_QUERY_NON_JSON", "OSLC query returned non-JSON response", { objectStructure, contentType: res.headers.get("content-type") || "", bodySnippet: bodyTxt.slice(0, 300) });
    }

    // Maximo returns different shapes; normalize
    const members = json?.member || json?.rdfs_member || json?.["rdfs:member"] || json?.["member"] || [];
    const items = Array.isArray(members) ? members : (json?.["oslc:member"] ?? []);
    const count = Number(json?.totalCount ?? json?.["oslc:totalCount"] ?? NaN);
    return { items: Array.isArray(items) ? items : [], count: Number.isFinite(count) ? count : undefined };
  }

  async getOne(objectStructure: string, key: string): Promise<any> {
    // generic fetch by adding where clause "key=..."
    const where = `${key}`;
    const out = await this.oslcQuery(objectStructure, { where, select: "*", pageSize: 1, start: 0 });
    return out.items?.[0] ?? null;
  }

  async executeOperation(operation: string, target: { objectStructure: string; key: string }, payload: any): Promise<any> {
    // This is intentionally generic: many Maximo "operations" are implemented as PATCH/POST actions.
    // We provide a safe default: PATCH by key URL if key looks like a URL; otherwise POST to /oslc/os/{os}/{key}/action/{op}.
    const headers = await this.authHeaders();
    headers["accept"] = "application/json";
    headers["content-type"] = "application/json";

    let url: string;
    let method: "POST" | "PATCH" = "POST";

    if (String(target.key).startsWith("http://") || String(target.key).startsWith("https://")) {
      url = target.key;
      method = "PATCH";
    } else {
      url = this.base(`/oslc/os/${encodeURIComponent(target.objectStructure)}/${encodeURIComponent(target.key)}/action/${encodeURIComponent(operation)}`);
      method = "POST";
    }

    const res = await fetch(url, { method, headers, body: JSON.stringify(payload ?? {}) });
    try { logUpstream("FETCH", String(url), res); } catch {}
    if (!res.ok) throw err("OSLC_OPERATION_FAILED", `OSLC operation failed (${res.status})`, { operation, target });
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return { ok: true, raw: txt }; }
  }

  async listObjectStructuresFallback(): Promise<string[]> {
    // Best-effort: some environments expose a service doc at /oslc/os
    try {
      const headers = await this.authHeaders();
      headers["accept"] = "application/json";
      const res = await fetch(this.base("/oslc/os"), { headers });
    try { logUpstream("FETCH", this.base("/oslc/os"), res); } catch {}
      if (!res.ok) return [];
      const json = await res.json();
      const members = json?.member ?? json?.["oslc:member"] ?? [];
      const names: string[] = [];
      if (Array.isArray(members)) {
        for (const m of members) {
          const href = m?.href || m?.["rdf:about"] || "";
          const title = m?.title || m?.["dcterms:title"] || "";
          if (title) names.push(String(title));
          else if (href && String(href).includes("/oslc/os/")) names.push(String(href).split("/oslc/os/")[1]);
        }
      }
      return Array.from(new Set(names)).filter(Boolean).sort();
    } catch {
      return [];
    }
  }
}
