import fs from "fs";
import path from "path";
import { z } from "zod";
import { err, DeterministicError } from "../errors.js";

const SecretRef = z.object({
  type: z.enum(["env","file"]),
  name: z.string().optional(),
  path: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.type === "env" && !v.name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SecretRef env requires name" });
  if (v.type === "file" && !v.path) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "SecretRef file requires path" });
});

const TenantSchema = z.object({
  tenantId: z.string().min(1),
  authMode: z.enum(["oauth","apiKey","maxauth"]),
  baseUrl: z.string().url(),
  org: z.string().optional(),
  site: z.string().optional(),
  oslc: z.object({
    whereDefault: z.string().optional(),
    pageSize: z.number().int().min(1).max(200).optional(),
  }).optional(),
  metadataTtlSeconds: z.number().int().min(30).optional(),

  // apiKey mode
  apiKey: z.string().min(1).optional(),
  apiKeyRef: SecretRef.optional(),

  // oauth mode (client credentials)
  oauth: z.object({
    tokenUrl: z.string().url(),
    clientIdRef: SecretRef,
    clientSecretRef: SecretRef,
    scope: z.string().optional(),
  }).optional(),

  

  // maxauth mode (Maximo "maxauth" header: base64(username:password))
  maxauth: z.object({
    usernameRef: SecretRef,
    passwordRef: SecretRef,
  }).optional(),
// optional: allow explicit list of OS to show
  objectStructures: z.array(z.string().min(1)).optional(),
});

export type SecretRef = z.infer<typeof SecretRef>;
export type TenantConfig = z.infer<typeof TenantSchema>;

let _filePath: string | null = null;
let _tenants: TenantConfig[] = [];

export function loadTenants(filePath: string): TenantConfig[] | DeterministicError {
  _filePath = filePath;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (parsed?.tenants ?? []);
    const out: TenantConfig[] = [];
    for (const t of arr) {
      const v = TenantSchema.safeParse(t);
      if (!v.success) return err("TENANT_INVALID", "Tenant validation failed", v.error.format());
      out.push(v.data);
    }
    _tenants = out;
    return _tenants;
  } catch (e: any) {
    // If file does not exist, start empty but remember the path for persistence.
    if (e?.code === "ENOENT") { _tenants = []; return _tenants; }
    return err("TENANTS_LOAD_FAILED", "Failed to load tenants file", { error: String(e?.message ?? e), filePath });
  }
}

export function listTenants(): TenantConfig[] { return _tenants.slice(); }

export function getTenant(tenantId: string): TenantConfig | null {
  return _tenants.find(t => t.tenantId === tenantId) ?? null;
}

function atomicWrite(fp: string, content: string) {
  const dir = path.dirname(fp);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, fp);
}

export function upsertTenant(t: any): TenantConfig[] | DeterministicError {
  if (!_filePath) return err("TENANTS_NOT_LOADED", "Tenants not loaded");
  const v = TenantSchema.safeParse(t);
  if (!v.success) return err("TENANT_INVALID", "Tenant validation failed", v.error.format());

  const idx = _tenants.findIndex(x => x.tenantId === v.data.tenantId);
  if (idx >= 0) _tenants[idx] = v.data;
  else _tenants.unshift(v.data);

  try {
    atomicWrite(_filePath, JSON.stringify(_tenants, null, 2));
    return listTenants();
  } catch (e: any) {
    return err("TENANTS_WRITE_FAILED", "Failed to persist tenants file", { error: String(e?.message ?? e), filePath: _filePath });
  }
}

export function deleteTenant(tenantId: string): TenantConfig[] | DeterministicError {
  if (!_filePath) return err("TENANTS_NOT_LOADED", "Tenants not loaded");
  const before = _tenants.length;
  _tenants = _tenants.filter(t => t.tenantId !== tenantId);
  if (_tenants.length === before) return err("TENANT_NOT_FOUND", `Tenant not found: ${tenantId}`);
  try {
    atomicWrite(_filePath, JSON.stringify(_tenants, null, 2));
    return listTenants();
  } catch (e: any) {
    return err("TENANTS_WRITE_FAILED", "Failed to persist tenants file", { error: String(e?.message ?? e), filePath: _filePath });
  }
}

export function redactTenant(t: TenantConfig) {
  return {
    tenantId: t.tenantId,
    authMode: t.authMode,
    baseUrl: t.baseUrl,
    org: t.org,
    site: t.site,
    oslc: t.oslc,
    metadataTtlSeconds: t.metadataTtlSeconds,
    objectStructures: t.objectStructures,
    // Safe to expose: this is a reference (not the secret itself).
    apiKeyRef: t.apiKeyRef,
  };
}
