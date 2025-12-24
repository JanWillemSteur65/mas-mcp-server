import React, { useEffect, useState } from "react";
import { Button, Grid, Column, InlineNotification, Tag, TextInput, Tile, Toggle } from "@carbon/react";
import { apiGet } from "../lib/api";

type ProviderRow = { name: string; configured: boolean; models: string[] };

function readTheme(): "white" | "g100" {
  try {
    const v = (localStorage.getItem("maximoMcpTheme") || "").toLowerCase();
    return v === "g100" || v === "dark" ? "g100" : "white";
  } catch {
    return "white";
  }
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [err, setErr] = useState<string>("");

  const [adminToken, setAdminToken] = useState<string>(() => {
    try { return localStorage.getItem("maximoMcpAdminToken") || ""; } catch { return ""; }
  });

  const [theme, setTheme] = useState<"white" | "g100">(readTheme());

  const load = () =>
    apiGet("/api/providers")
      .then((d: any) => {
        const p = d?.providers ?? {};
        const arr: ProviderRow[] = Object.entries(p).map(([name, v]: any) => ({
          name,
          configured: !!v?.configured,
          models: Array.isArray(v?.models) ? v.models : [],
        }));
        setProviders(arr.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((e: any) => setErr(String(e?.message ?? e)));

  useEffect(() => { load(); }, []);

  function saveToken() {
    try { localStorage.setItem("maximoMcpAdminToken", adminToken); } catch {}
    window.location.reload();
  }

  function clearToken() {
    setAdminToken("");
    try { localStorage.removeItem("maximoMcpAdminToken"); } catch {}
    window.location.reload();
  }

  function toggleTheme(checked: boolean) {
    const next = checked ? "g100" : "white";
    setTheme(next);
    try { localStorage.setItem("maximoMcpTheme", next); } catch {}
    window.location.reload();
  }

  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <h2>Settings</h2>
        {err && <InlineNotification kind="error" title="Failed to load providers" subtitle={err} />}
      </Column>

      <Column sm={4} md={8} lg={8}>
        <Tile>
          <h4>AI Providers (configured via OpenShift Secrets)</h4>
          <p>The server detects configured providers from environment variables (injected from Secrets). The UI never stores keys.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {providers.map((p) => (
              <Tag key={p.name} type={p.configured ? "green" : "red"}>
                {p.name}{p.configured ? "" : " (missing keys)"}
              </Tag>
            ))}
          </div>
        </Tile>
      </Column>

      <Column sm={4} md={8} lg={8}>
        <Tile>
          <h4>Theme</h4>
          <p>Toggle a dark UI theme for the Admin + AI Assistant pages.</p>
          <Toggle
            id="themeToggle"
            labelText="Dark mode"
            labelA="Light"
            labelB="Dark"
            toggled={theme === "g100"}
            onToggle={toggleTheme}
          />
        </Tile>
      </Column>

      <Column sm={4} md={8} lg={8}>
        <Tile>
          <h4>Model lists</h4>
          <p>Model dropdowns in the AI Assistant are driven by *_MODELS environment variables (e.g., OPENAI_MODELS). If empty, you can type a model name manually.</p>
          <div style={{ marginTop: 8 }}>
            {providers.map((p) => (
              <div key={p.name} style={{ marginBottom: 12 }}>
                <strong>{p.name}</strong>
                <div style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
                  {(p.models && p.models.length) ? p.models.join(", ") : "(no models configured)"}
                </div>
              </div>
            ))}
          </div>
        </Tile>
      </Column>

      <Column sm={4} md={8} lg={8}>
        <Tile>
          <h4>Admin token (optional)</h4>
          <p>If you enabled an admin token check server-side, set it here. This build does not require it by default.</p>
          <TextInput id="adminToken" labelText="Admin token" value={adminToken} onChange={(e) => setAdminToken(e.currentTarget.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button size="sm" onClick={saveToken}>Save</Button>
            <Button size="sm" kind="secondary" onClick={clearToken}>Clear</Button>
          </div>
        </Tile>
      </Column>
    </Grid>
  );
}
