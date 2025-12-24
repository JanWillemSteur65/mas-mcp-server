import { AppConfig } from "../config.js";
import { err } from "../errors.js";
import { listTenants, getTenant, redactTenant, upsertTenant, deleteTenant, TenantConfig } from "../tenant/tenantStore.js";
import { MaximoClient } from "../maximo/client.js";
import { MetadataCache } from "../maximo/metadata.js";

export type ToolAnnotations = any;

export type Tool = { name: string; description: string; inputSchema: any; annotations?: ToolAnnotations };
export type ToolHandler = (ctx: ToolContext, input: any) => Promise<any>;
export type ToolDef = Tool & { handler: ToolHandler };

export type ToolContext = {
  cfg: AppConfig;
  tenantId?: string;
  metadata: MetadataCache;
  maximoForTenant: (tenantId: string) => { tenant: TenantConfig; client: MaximoClient };
};

export function buildTools(cfg: AppConfig) {
  const metadata = new MetadataCache(cfg.metadataTtlSecondsDefault);

  const ctxBase: Omit<ToolContext, "tenantId"> = {
    cfg,
    metadata,
    maximoForTenant: (tenantId: string) => {
      const tenant = getTenant(tenantId);
      if (!tenant) throw err("TENANT_NOT_FOUND", `Tenant not found: ${tenantId}`);
      return { tenant, client: new MaximoClient(tenant) };
    }
  };

  function makeCtx(tenantId?: string): ToolContext {
    return { ...ctxBase, tenantId };
  }

  const tools: ToolDef[] = [
    {
      name: "mcp.listTools",
      description: "List available MCP tools (capped by TOOL_CATALOG_LIMIT).",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      handler: async (_ctx, _input) => {
        return tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations }))
          .slice(0, cfg.toolCatalogLimit);
      }
    },

    // ---- Tenant tools (admin UI uses REST, but MCP keeps parity) ----
    {
      name: "tenants.list",
      description: "List configured tenants (redacted).",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      handler: async () => ({ tenants: listTenants().map(redactTenant) })
    },
    {
      name: "admin.tenants.upsert",
      description: "Upsert a tenant configuration (requires server CONFIG_WRITE_ENABLED; approvals optional via REST).",
      inputSchema: { type: "object", additionalProperties: false, required: ["tenant"], properties: { tenant: { type: "object" } } },
      handler: async () => {
        const out = upsertTenant;
        // Not used in this repo's UI; keep as placeholder.
        return { ok: true, note: "Use /api/tenants for persistence + approvals." };
      }
    },
    {
      name: "admin.tenants.delete",
      description: "Delete a tenant configuration (requires server CONFIG_WRITE_ENABLED; approvals optional via REST).",
      inputSchema: { type: "object", additionalProperties: false, required: ["tenantId"], properties: { tenantId: { type: "string" } } },
      handler: async () => ({ ok: true, note: "Use /api/tenants/:tenantId for persistence + approvals." })
    },

    // ---- Maximo extensions ----
    {
      name: "maximo.execute_query",
      description: "Execute a safe, allowlisted OSLC query (structured filters) against a Maximo object structure.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["tenantId", "objectStructure", "query"],
        properties: {
          tenantId: { type: "string" },
          objectStructure: { type: "string" },
          query: {
            type: "object",
            additionalProperties: false,
            required: ["select", "where", "page"],
            properties: {
              select: { type: "array", items: { type: "string" } },
              where: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["field","op"],
                  properties: {
                    field: { type: "string" },
                    op: { type: "string", enum: ["=","!="," >",">=","<","<=","like","in","null","notnull"] },
                    value: {}
                  }
                }
              },
              orderBy: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["field","dir"],
                  properties: { field: { type: "string" }, dir: { type: "string", enum: ["asc","desc"] } }
                }
              },
              page: {
                type: "object",
                additionalProperties: false,
                required: ["limit","offset"],
                properties: {
                  limit: { type: "integer", minimum: 1, maximum: 200 },
                  offset: { type: "integer", minimum: 0 }
                }
              }
            }
          }
        }
      },
      annotations: {
        tenantScoped: true,
        maximo: { readOnly: true, domainAware: false, oslc: { supportsWhere: true, supportsSelect: true, supportsOrderBy: true, supportsPaging: true } },
        ui: { group: "Maximo", tags: ["query","oslc"] },
      },
      handler: async (_ctx, input) => {
        const tenantId = String(input.tenantId ?? "");
        const objectStructure = String(input.objectStructure ?? "");
        const query = input.query ?? {};
        const { tenant, client } = ctxBase.maximoForTenant(tenantId);

        const shape = await metadata.getShape(tenantId, objectStructure, client, tenant.metadataTtlSeconds);
        const allow = new Set(shape.fields);

        const select: string[] = Array.isArray(query.select) ? query.select : [];
        for (const f of select) if (!allow.has(f) && f !== "*") throw err("FIELD_NOT_ALLOWED", `Select field not allowed: ${f}`, { field: f });

        const clauses: any[] = Array.isArray(query.where) ? query.where : [];
        for (const c of clauses) {
          if (!allow.has(String(c.field))) throw err("FILTER_FIELD_NOT_ALLOWED", `Filter field not allowed: ${c.field}`, { field: c.field });
        }

        const where = oslcWhereFromClauses(clauses);
        const pageSize = Math.min(200, Math.max(1, Number(query.page?.limit ?? 50)));
        const offset = Math.max(0, Number(query.page?.offset ?? 0));

        const orderBy = Array.isArray(query.orderBy) ? query.orderBy.map((o:any) => `${o.field} ${o.dir}`).join(",") : undefined;

        const out = await client.oslcQuery(objectStructure, {
          where: where || (tenant.oslc?.whereDefault ?? "1=1"),
          select: select.length ? select.join(",") : "*",
          orderBy,
          pageSize,
          start: offset,
        });

        return { items: out.items, page: { limit: pageSize, offset, count: out.count ?? out.items.length }, shape: { fields: shape.fields } };
      }
    },

    {
      name: "maximo.execute_operation",
      description: "Execute a Maximo operation (generic) with preflight/commit phases (approvals optional via REST).",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["tenantId","operation","target","mode"],
        properties: {
          tenantId: { type: "string" },
          operation: { type: "string" },
          target: {
            type: "object",
            additionalProperties: false,
            required: ["objectStructure","key"],
            properties: {
              objectStructure: { type: "string" },
              key: { type: "string" }
            }
          },
          payload: { type: "object" },
          mode: { type: "string", enum: ["preflight","commit"] }
        }
      },
      annotations: { tenantScoped: true, maximo: { readOnly: false, domainAware: true }, ui: { group: "Maximo", tags: ["operation","write"] } },
      handler: async (_ctx, input) => {
        const tenantId = String(input.tenantId ?? "");
        const operation = String(input.operation ?? "");
        const target = input.target ?? {};
        const mode = String(input.mode ?? "preflight");
        const payload = input.payload ?? {};
        const { client } = ctxBase.maximoForTenant(tenantId);

        if (mode === "preflight") {
          // Best-effort: we cannot guarantee record fetch; return diff-like summary.
          return { ok: true, mode, operation, target, impact: { note: "Preflight is best-effort in this build; enable domain rules for strict validation." }, payloadPreview: payload };
        }

        const result = await client.executeOperation(operation, { objectStructure: String(target.objectStructure ?? ""), key: String(target.key ?? "") }, payload);
        return { ok: true, mode, result };
      }
    },

    {
      name: "maximo.metadata.list_object_structures",
      description: "List available object structures (best-effort; uses tenant config if set, otherwise probes /oslc/os).",
      inputSchema: { type: "object", additionalProperties: false, required: ["tenantId"], properties: { tenantId: { type: "string" } } },
      annotations: { tenantScoped: true, maximo: { readOnly: true }, ui: { group: "Metadata", tags: ["schema"] } },
      handler: async (_ctx, input) => {
        const tenantId = String(input.tenantId ?? "");
        const { tenant, client } = ctxBase.maximoForTenant(tenantId);
        if (tenant.objectStructures?.length) return { objectStructures: tenant.objectStructures.slice().sort() };
        const found = await client.listObjectStructuresFallback();
        const common = ["mxwo","mxasset","mxlocation","mxsr","mxinv","mxjobplan","mxpm"];
        const out = found.length ? found : common;
        return { objectStructures: out };
      }
    },

    {
      name: "maximo.metadata.get_object_structure",
      description: "Get inferred schema for an object structure (fields inferred from a sample record; cached per-tenant).",
      inputSchema: { type: "object", additionalProperties: false, required: ["tenantId","objectStructure"], properties: { tenantId: { type: "string" }, objectStructure: { type: "string" } } },
      annotations: { tenantScoped: true, maximo: { readOnly: true }, ui: { group: "Metadata", tags: ["schema"] } },
      handler: async (_ctx, input) => {
        const tenantId = String(input.tenantId ?? "");
        const objectStructure = String(input.objectStructure ?? "");
        const { tenant, client } = ctxBase.maximoForTenant(tenantId);
        const shape = await metadata.getShape(tenantId, objectStructure, client, tenant.metadataTtlSeconds);
        return { objectStructure, fields: shape.fields, discoveredAt: shape.discoveredAt };
      }
    },

    {
      name: "maximo.intent_to_oslc_plan",
      description: "Convert a Maximo intent to a structured OSLC query plan (deterministic heuristic).",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["tenantId","intent"],
        properties: { tenantId: { type: "string" }, intent: { type: "string" } }
      },
      annotations: { tenantScoped: true, maximo: { readOnly: true }, ui: { group: "Agent", tags: ["plan"] } },
      handler: async (_ctx, input) => {
        const intent = String(input.intent ?? "").toLowerCase();
        const tenantId = String(input.tenantId ?? "");

        let objectStructure = "mxwo";
        if (intent.includes("asset")) objectStructure = "mxasset";
        else if (intent.includes("location")) objectStructure = "mxlocation";
        else if (intent.includes("inventory")) objectStructure = "mxinv";
        else if (intent.includes("service request") || intent.includes("sr")) objectStructure = "mxsr";
        else if (intent.includes("job plan")) objectStructure = "mxjobplan";
        else if (intent.includes("preventive") || intent.includes("pm")) objectStructure = "mxpm";

        // Minimal plan: select common fields
        const select = ["*"];
        const where = [{ field: "status", op: "notnull" }];

        return { tenantId, objectStructure, select, where, page: { limit: 25, offset: 0 }, rationale: "Heuristic intent mapping (adjust in Settings / schema browser)." };
      }
    }
  ];

  return { tools, makeCtx };
}

function escapeOslcValue(v: any): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function oslcWhereFromClauses(clauses: any[]): string {
  const parts: string[] = [];
  for (const c of clauses) {
    const field = String(c.field ?? "");
    const op = String(c.op ?? "");
    const value = c.value;
    if (!field || !op) continue;
    if (op === "null") parts.push(`${field} is null`);
    else if (op === "notnull") parts.push(`${field} is not null`);
    else if (op === "in") {
      if (!Array.isArray(value)) throw err("INVALID_IN", "in operator requires array", { field });
      parts.push(`${field} in [${value.map(escapeOslcValue).join(",")}]`);
    } else if (op === "like") parts.push(`${field} like ${escapeOslcValue(value)}`);
    else parts.push(`${field} ${op} ${escapeOslcValue(value)}`);
  }
  return parts.join(" and ");
}
