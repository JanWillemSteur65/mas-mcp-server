import fs from "fs";

export type AppConfig = {
  uiDistDir?: string;               // optional
  port: number;
  tenantsFile: string;
  tenantHeader: string;
  configWriteEnabled: boolean;
  approvalsEnabled: boolean;
  toolCatalogLimit: number;
  metadataTtlSecondsDefault: number;
};

function envBool(name: string, def = false): boolean {
  const v = (process.env[name] ?? "").toLowerCase().trim();
  if (!v) return def;
  return ["1", "true", "yes", "y", "on"].includes(v);
}

function envInt(name: string, def: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : def;
}

export function loadConfig(): AppConfig {
  const port = envInt("PORT", 8080);

  // Tenants file: default to PVC-backed path if you use persistence
  const tenantsFile = process.env.TENANTS_FILE || "/etc/maximo-mcp/tenants.json";

  const tenantHeader = process.env.TENANT_HEADER || "x-tenant-id";
  const configWriteEnabled = envBool("CONFIG_WRITE_ENABLED", true);
  const approvalsEnabled = envBool("APPROVALS_ENABLED", false);

  const toolCatalogLimit = Math.max(1, envInt("TOOL_CATALOG_LIMIT", 128));
  const metadataTtlSecondsDefault = envInt("METADATA_TTL_SECONDS", 3600);

  // UI dist directory (optional). If unset, server will use its fallback logic.
  const uiDistDir = (process.env.UI_DIST_DIR || "").trim() || undefined;

  return {
    uiDistDir,
    port,
    tenantsFile,
    tenantHeader,
    configWriteEnabled,
    approvalsEnabled,
    toolCatalogLimit,
    metadataTtlSecondsDefault,
  };
}

export function readSecret(ref: { type: "env" | "file"; name?: string; path?: string }): string {
  if (ref.type === "env") {
    const key = (ref.name || "").trim();
    return key ? (process.env[key] ?? "") : "";
  }
  const p = (ref.path || "").trim();
  if (!p) return "";
  try {
    return fs.readFileSync(p, "utf-8").trim();
  } catch {
    return "";
  }
}
