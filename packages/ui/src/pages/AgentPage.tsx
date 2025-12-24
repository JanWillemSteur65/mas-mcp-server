import React, { useEffect, useMemo, useRef, useState } from "react";
import { Grid, Column, Dropdown, TextArea, Button, InlineLoading, InlineNotification, Tile, Tag, Accordion, AccordionItem } from "@carbon/react";
import { Send } from "@carbon/icons-react";
import { apiGet, apiPost } from "../lib/api";
import "../styles/agent.css";

type Tenant = { tenantId: string };
type ProviderState = { providers: Record<string, { configured: boolean; models?: string[] }> };

type TraceEvent =
  | { type: "tool_list"; toolCount: number }
  | { type: "tool_selected"; toolName: string; reason: string }
  | { type: "tool_call"; method: string; params: any }
  | { type: "tool_result"; method: string; ok: boolean; preview: string }
  | { type: "note"; message: string };

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  trace?: TraceEvent[];
  data?: any;
};

export default function AgentPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>("");

  const [providers, setProviders] = useState<ProviderState | null>(null);
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");

  const [input, setInput] = useState<string>("");
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        "Ask me questions about Maximo assets, work orders, locations, inventory, service requests, job plans, or PM. I will query the connected tenant through MCP and show tool traces.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    apiGet("/api/tenants")
      .then((d: any) => {
        const ts: Tenant[] = d.tenants ?? [];
        setTenants(ts);
        setTenantId((ts?.[0]?.tenantId as string) ?? "");
      })
      .catch((e: any) => setErr(String(e?.message ?? e)));

    apiGet("/api/providers")
      .then((d: any) => setProviders(d))
      .catch(() => setProviders({ providers: {} }));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const configuredProviders = useMemo(() => {
    const p = providers?.providers ?? {};
    return Object.entries(p)
      .filter(([, v]) => !!v?.configured)
      .map(([k]) => k)
      .sort();
  }, [providers]);

  const modelsForProvider = useMemo(() => {
    const p = providers?.providers ?? {};
    const entry = p?.[provider];
    return Array.isArray(entry?.models) ? (entry!.models as string[]) : [];
  }, [providers, provider]);

  useEffect(() => {
    const firstProv = configuredProviders[0] ?? "";
    if (!provider && firstProv) setProvider(firstProv);

    const ms = (providers?.providers?.[firstProv]?.models ?? []) as string[];
    if (!model && Array.isArray(ms) && ms.length) setModel(ms[0]);
  }, [providers, configuredProviders, provider, model]);

  async function send() {
    const q = input.trim();
    if (!q || !tenantId) return;
    setErr("");
    setBusy(true);
    setInput("");

    const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: "user", content: q };
    setTurns((t) => [...t, userTurn]);

    try {
      const resp: any = await apiPost("/api/agent/chat", {
        tenantId,
        provider,
        model,
        message: q,
        messages: turns.map((t) => ({ role: t.role, content: t.content })),
      });

      const assistantTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: String(resp?.answer ?? ""),
        trace: resp?.trace ?? [],
        data: resp?.data,
      };
      setTurns((t) => [...t, assistantTurn]);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Grid className="agent-root" condensed>
      <Column sm={4} md={8} lg={16}>
        <div className="agent-header">
          <div>
            <h2 className="agent-title">AI Assistant</h2>
            <p className="agent-subtitle">Tool-first Maximo assistant with MCP traces</p>
          </div>
          <div className="agent-badges">
            {configuredProviders.length ? (
              <Tag type="green">Providers: {configuredProviders.join(", ")}</Tag>
            ) : (
              <Tag type="cool-gray">No LLM provider configured (tool-first mode)</Tag>
            )}
          </div>
        </div>
        {err && <InlineNotification kind="error" title="Error" subtitle={err} />}
      </Column>

      <Column sm={4} md={8} lg={5}>
        <Tile className="agent-side">
          <h4>Session</h4>
          <Dropdown
            id="tenantSel"
            titleText="Tenant"
            items={tenants.map((t) => t.tenantId)}
            selectedItem={tenantId}
            onChange={(e: any) => setTenantId(String(e.selectedItem ?? ""))} label={""}          />
          <Dropdown
            id="providerSel"
            titleText="AI Provider"
            items={configuredProviders}
            selectedItem={provider}
            onChange={(e: any) => {
              const p = String(e.selectedItem ?? "");
              setProvider(p);
              const ms = (providers?.providers?.[p]?.models ?? []) as string[];
              setModel(Array.isArray(ms) && ms.length ? ms[0] : "");
            } }
            disabled={configuredProviders.length === 0} label={""}          />
          {configuredProviders.length > 0 && (
            modelsForProvider.length > 0 ? (
              <Dropdown
                id="modelSel"
                titleText="Model"
                items={modelsForProvider}
                selectedItem={model}
                onChange={(e: any) => setModel(String(e.selectedItem ?? ""))} label={""}              />
            ) : null
          )}

          <div className="agent-hint">
            <p>Examples: “open work orders”, “assets at location X”, “inventory for item Y”.</p>
          </div>
        </Tile>
      </Column>

      <Column sm={4} md={8} lg={11}>
        <div className="agent-chat">
          <div className="agent-thread">
            {turns.map((t) => (
              <div key={t.id} className={`agent-bubble ${t.role === "user" ? "user" : "assistant"}`}>
                <div className="agent-bubble-meta">
                  <span className="agent-role">{t.role === "user" ? "You" : "Assistant"}</span>
                  {t.role === "assistant" && t.trace?.length ? <Tag type="cool-gray">Traces</Tag> : null}
                </div>
                <div className="agent-bubble-content">{t.content}</div>

                {t.role === "assistant" && t.data ? (
                  <pre className="agent-data">{JSON.stringify(t.data, null, 2)}</pre>
                ) : null}

                {t.role === "assistant" && t.trace?.length ? (
                  <Accordion className="agent-traces">
                    <AccordionItem title="Tool traces">
                      <pre className="agent-trace-pre">{JSON.stringify(t.trace, null, 2)}</pre>
                    </AccordionItem>
                  </Accordion>
                ) : null}
              </div>
            ))}
            {busy && (
              <div className="agent-bubble assistant">
                <InlineLoading description="Working…" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="agent-composer">
            <TextArea
              labelText=""
              placeholder="Ask about Maximo assets, work orders, locations, inventory…"
              value={input}
              onChange={(e: any) => setInput(String(e.target.value ?? ""))}
              rows={3}
              disabled={busy}
            />
            <Button renderIcon={Send} onClick={send} disabled={busy || !input.trim() || !tenantId}>
              Send
            </Button>
          </div>
        </div>
      </Column>
    </Grid>
  );
}
