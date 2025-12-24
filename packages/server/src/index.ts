import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import { loadConfig } from "./config.js";
import { parseJsonRpc, rpcOk, rpcError } from "./mcp/jsonrpc.js";
import { err, isDeterministicError } from "./errors.js";
import { buildTools } from "./mcp/toolRegistry.js";
import {
  loadTenants,
  listTenants,
  redactTenant,
  upsertTenant,
  deleteTenant,
} from "./tenant/tenantStore.js";
import { listConfiguredProviders } from "./llm/providers.js";
import {
  initApprovalsStore,
  // kept for compatibility, but approvals are disabled in this build:
  createApproval,
  decideApproval,
  listApprovals,
} from "./policy/approvalsStore.js";
import { agentChat } from "./mcp/agentChat.js";

function getClientIp(req: express.Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return String(xff[0]).split(",")[0].trim();

  const xri = req.headers["x-real-ip"];
  if (typeof xri === "string" && xri.length) return xri.trim();

  const anyReq = req as any;
  return String(anyReq.ip ?? anyReq.socket?.remoteAddress ?? "unknown");
}

const cfg = loadConfig();
initApprovalsStore();
loadTenants(cfg.tenantsFile);

const startedAt = Date.now();

const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/**
 * Ensure API/MCP responses are never cached and never accidentally served as HTML.
 * We do NOT force Content-Type here, because Express will set it correctly for res.json().
 * Setting Content-Type globally can interfere with non-JSON responses if you add them later.
 */
app.use((req, res, next) => {
  const isApi = req.path === "/api" || req.path.startsWith("/api/");
  const isMcp = req.path === "/mcp" || req.path.startsWith("/mcp/");
  if (isApi || isMcp) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  next();
});

// --- Health ---
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
app.get("/readyz", (_req, res) => {
  res.status(200).json({ ok: true, tenants: listTenants().length });
});

// --- Capabilities ---
// Forced-write build: always admin, always writable, approvals disabled.
app.get("/api/capabilities", (_req, res) => {
  res.json({
    role: "admin",
    canWriteConfig: true,
    approvalsEnabled: false,
  });
});

// --- debug ---
app.get("/api/debug/headers", (req, res) => {
  res.json({
    tenantHeaderConfigured: cfg.tenantHeader,
    tenantHeaderValue: req.header(cfg.tenantHeader) ?? null,
    headers: req.headers,
  });
});

// --- Status ---
// Used by Dashboard. Must exist and always return JSON.
app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    tenantCount: listTenants().length,
    toolCatalogLimit: cfg.toolCatalogLimit,
    configWriteEnabled: true,
    approvalsEnabled: false,
  });
});

// --- Providers ---
app.get("/api/providers", (_req, res) => {
  const arr = listConfiguredProviders();
  const providers: Record<string, any> = {};
  for (const p of arr) providers[p.name] = { configured: p.configured, models: p.models };
  res.json({ providers });
});

// --- Tenants ---
app.get("/api/tenants", (_req, res) => {
  res.json({ tenants: listTenants().map(redactTenant) });
});

// Forced-write build: always allow config writes.
// (Tenants are still persisted through tenantStore; if file I/O fails, it will surface as error.)
function canWrite(_req: express.Request): boolean {
  return true;
}

// Approvals are disabled by default in this build.
// We keep the code paths for compatibility, but we do not enqueue approvals.
const approvalsEnabledRuntime = false;

app.post("/api/tenants", (req, res) => {
  if (!canWrite(req)) return res.status(403).json(err("CONFIG_WRITE_DISABLED", "Config writes are disabled"));

  const payload = req.body ?? {};

  if (approvalsEnabledRuntime) {
    const approval = createApproval(
      "tenant.upsert",
      `Upsert tenant ${payload.tenantId ?? ""}`,
      payload,
      getClientIp(req)
    );
    return res.status(202).json({ pending: true, approvalId: approval.id });
  }

  const r = upsertTenant(payload);
  if (isDeterministicError(r)) return res.status(400).json(r);
  return res.json({ tenants: r.map(redactTenant) });
});

app.delete("/api/tenants/:tenantId", (req, res) => {
  if (!canWrite(req)) return res.status(403).json(err("CONFIG_WRITE_DISABLED", "Config writes are disabled"));

  const id = req.params.tenantId;

  if (approvalsEnabledRuntime) {
    const approval = createApproval("tenant.delete", `Delete tenant ${id}`, { tenantId: id }, getClientIp(req));
    return res.status(202).json({ pending: true, approvalId: approval.id });
  }

  const r = deleteTenant(id);
  if (isDeterministicError(r)) return res.status(400).json(r);
  return res.json({ tenants: r.map(redactTenant) });
});

// --- Approvals ---
// Kept for compatibility; always disabled in this build.
app.get("/api/approvals", (_req, res) => {
  return res.status(400).json(err("APPROVALS_DISABLED", "Approvals are disabled"));
});

app.post("/api/approvals/:id/approve", (_req, res) => {
  return res.status(400).json(err("APPROVALS_DISABLED", "Approvals are disabled"));
});

app.post("/api/approvals/:id/reject", (_req, res) => {
  return res.status(400).json(err("APPROVALS_DISABLED", "Approvals are disabled"));
});

// --- Agent chat ---
app.post("/api/agent/chat", async (req, res) => {
  const body = req.body ?? {};
  const tenantId = String(body.tenantId ?? "");
  const message = String(body.message ?? "");
  if (!tenantId || !message) return res.status(400).json(err("INVALID_INPUT", "tenantId and message are required"));

  try {
    const out = await agentChat({
      tenantId,
      message,
      toolCatalogLimit: cfg.toolCatalogLimit,
      provider: body.provider,
      model: body.model,
      messages: body.messages,
    });
    return res.json(out);
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    // If upstream returned HTML (e.g., login page or router error), surface a clearer message.
    if (msg.includes("Unexpected token '<'") || msg.includes("<!DOCTYPE")) {
      return res.status(500).json(
        err(
          "AGENT_ERROR",
          "Upstream returned HTML where JSON was expected (possible auth/TLS/route issue). Check server logs for upstream status/content-type."
        )
      );
    }

    return res.status(500).json(err("AGENT_ERROR", msg));
  }
});

// --- MCP JSON-RPC ---
const { tools, makeCtx } = buildTools(cfg);

// Support both /mcp and /mcp/
app.post(["/mcp", "/mcp/"], async (req, res) => {
  const rpc = parseJsonRpc(req.body);
  if (!rpc) return res.status(400).json(rpcError(null, -32600, "Invalid Request"));

  const hdrTenant = req.header(cfg.tenantHeader);
  const bodyTenant =
    rpc && rpc.params && typeof (rpc.params as any).tenantId === "string"
      ? (rpc.params as any).tenantId
      : undefined;
  const queryTenant =
    typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;

  const tenantId = String(hdrTenant ?? bodyTenant ?? queryTenant ?? "").trim();
  const ctx = makeCtx(tenantId || undefined);

  try {
    const tool = tools.find((t) => t.name === rpc.method);
    if (!tool) return res.status(404).json(rpcError(rpc.id, -32601, "Method not found"));

    const out = await tool.handler(ctx, rpc.params ?? {});
    return res.json(rpcOk(rpc.id, out));
  } catch (e: any) {
    // deterministic application errors
    if (isDeterministicError(e)) {
      return res.status(400).json(rpcError(rpc.id, -32000, e.message ?? "Request failed", e));
    }

    const msg = String(e?.message ?? e);

    // Never return HTML in error; make the symptom explicit
    if (msg.includes("Unexpected token '<'") || msg.includes("<!DOCTYPE")) {
      return res.status(500).json(
        rpcError(
          rpc.id,
          -32000,
          "Upstream returned HTML where JSON was expected (possible auth/TLS/route issue). Check server logs for upstream status/content-type."
        )
      );
    }

    return res.status(500).json(rpcError(rpc.id, -32000, msg));
  }
});

// --- Static UI ---
// Prefer an explicit path in config/env; fallback to ui/dist.
const uiDist = cfg.uiDistDir ? path.resolve(cfg.uiDistDir) : path.resolve(process.cwd(), "ui/dist");

if (fs.existsSync(uiDist)) {
  app.use("/", express.static(uiDist));

  // Never serve HTML for API or MCP endpoints.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/api" || req.path === "/mcp" || req.path.startsWith("/mcp/")) {
      return next();
    }
    return res.sendFile(path.join(uiDist, "index.html"));
  });
}

// JSON 404 for API/MCP (prevents SPA HTML fallback from masking errors)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/api" || req.path === "/mcp" || req.path.startsWith("/mcp/")) {
    return res.status(404).json(err("NOT_FOUND", `No route for ${req.method} ${req.path}`));
  }
  return next();
});

app.listen(cfg.port, () => {
  console.log(`maximo-mcp listening on :${cfg.port}`);
});


