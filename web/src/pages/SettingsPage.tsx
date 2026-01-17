import React, { useEffect, useState } from "react";
import { Button, Dropdown, NumberInput, TextInput, Tile } from "@carbon/react";
import { api } from "../api/client";

export default function SettingsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any | null>(null);

  // Human-language settings mapped to JSON on save
  const [refreshMinutes, setRefreshMinutes] = useState(1440);
  const [maxConcurrency, setMaxConcurrency] = useState(4);
  const [safeLimit, setSafeLimit] = useState(200);

  useEffect(() => {
    api.tenants().then((t) => { setTenants(t); setTenant(t[0] || null); });
  }, []);

  useEffect(() => {
    api.settings(tenant?.id).then((s) => {
      const j = s.settings_json || {};
      setRefreshMinutes(j.discovery_refresh_minutes ?? 1440);
      setMaxConcurrency(j.max_concurrency_per_tenant ?? 4);
      setSafeLimit(j.safe_query_limit ?? 200);
    });
  }, [tenant]);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Settings</h2>
      <div style={{ maxWidth: 420, margin: "1rem 0" }}>
        <Dropdown id="tenant" titleText="Scope" label={tenant ? `Tenant: ${tenant.name}` : "Global"} items={[{ id: 0, name: "Global" }, ...tenants]} itemToString={(i) => (i ? i.name : "")} onChange={(e) => setTenant(e.selectedItem?.id ? e.selectedItem : null)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
        <Tile>
          <h4>How often should we refresh tenant schemas?</h4>
          <NumberInput id="refresh" label="Minutes" value={refreshMinutes} onChange={(e: any) => setRefreshMinutes(Number(e.imaginaryTarget.value))} />
        </Tile>
        <Tile>
          <h4>Maximum concurrency per tenant</h4>
          <NumberInput id="conc" label="Concurrent requests" value={maxConcurrency} onChange={(e: any) => setMaxConcurrency(Number(e.imaginaryTarget.value))} />
        </Tile>
        <Tile>
          <h4>Default safe query limit</h4>
          <NumberInput id="limit" label="Max rows" value={safeLimit} onChange={(e: any) => setSafeLimit(Number(e.imaginaryTarget.value))} />
        </Tile>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <Button
          onClick={() => {
            const settings_json = {
              discovery_refresh_minutes: refreshMinutes,
              max_concurrency_per_tenant: maxConcurrency,
              safe_query_limit: safeLimit,
            };
            api.saveSettings({ scope: tenant ? "tenant" : "global", scope_id: tenant?.id || null, settings_json }).then(() => alert("Saved"));
          }}
        >
          Save settings
        </Button>
      </div>
    </div>
  );
}
