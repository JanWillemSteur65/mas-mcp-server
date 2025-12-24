import { loadConfig } from "../config.js";
import { buildTools } from "./toolRegistry.js";
import { isDeterministicError, err } from "../errors.js";

/**
 * Deterministic, tool-first agent.
 * - builds an intent plan
 * - runs execute_query
 * - returns readable answer + trace + optional data
 */
export async function agentChat(input: { tenantId: string; message: string; toolCatalogLimit: number; provider?: string; model?: string; messages?: any[] }) {
  const cfg = loadConfig();
  const { tools, makeCtx } = buildTools(cfg);
  const ctx = makeCtx(input.tenantId);

  const trace: any[] = [];

  const planTool = tools.find(t => t.name === "maximo.intent_to_oslc_plan");
  const queryTool = tools.find(t => t.name === "maximo.execute_query");
  if (!planTool || !queryTool) throw err("TOOLS_MISSING", "Required tools are not registered");

  trace.push({ type: "tool_selected", toolName: planTool.name, reason: "intent_to_oslc_plan" });
  const plan = await planTool.handler(ctx, { tenantId: input.tenantId, intent: input.message });

  trace.push({ type: "tool_selected", toolName: queryTool.name, reason: "execute_query" });
  const data = await queryTool.handler(ctx, { tenantId: input.tenantId, objectStructure: plan.objectStructure, query: { select: plan.select ?? ["*"], where: plan.where ?? [], orderBy: plan.orderBy ?? [], page: plan.page ?? { limit: 25, offset: 0 } } });

  const count = Array.isArray(data?.items) ? data.items.length : 0;
  const answer =
    `I queried **${plan.objectStructure}** for tenant **${input.tenantId}** and retrieved **${count}** record(s). ` +
    `Use the “Tool traces” section to review the exact query plan and results.`;

  trace.push({ type: "tool_result", method: queryTool.name, ok: true, preview: `items=${count}` });

  return { answer, trace, data: { plan, result: data } };
}
