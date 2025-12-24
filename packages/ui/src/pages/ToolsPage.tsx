import React, { useEffect, useState } from "react";
import { InlineNotification, Grid, Column, Dropdown, Button, TextArea } from "@carbon/react";
import { apiGet, mcpCall } from "../lib/api";
export default function ToolsPage() {
  const [tenants, setTenants] = useState<{tenantId:string}[]>([]);
  const [tenantId, setTenantId] = useState<string>("");
  const [tools, setTools] = useState<any>(null);
  const [err, setErr] = useState<string>("");
  useEffect(() => {
    apiGet("/api/tenants").then((d:any)=>{ setTenants(d.tenants); setTenantId(d.tenants?.[0]?.tenantId ?? ""); })
      .catch((e:any)=>setErr(String(e?.message ?? e)));
  }, []);
  const loadTools = async () => {
    setErr(""); setTools(null);
    try { const r:any = await mcpCall(tenantId, "mcp.listTools", {}); setTools(r?.result); }
    catch (e:any) { setErr(String(e?.message ?? e)); }
  };
  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <h2>Schema & Tools</h2>
        {err && <InlineNotification kind="error" title="Failed" subtitle={err} />}
      </Column>
      <Column sm={4} md={8} lg={8}>
        <Dropdown id="tenantSel" titleText="Tenant" items={tenants.map(t => t.tenantId)} selectedItem={tenantId}
        onChange={(e: any) => setTenantId(e.selectedItem)} label={""} />
      </Column>
      <Column sm={4} md={8} lg={8} style={{display:"flex", alignItems:"end"}}>
        <Button onClick={loadTools}>Load tools</Button>
      </Column>
      <Column sm={4} md={8} lg={16}>
        <TextArea id="toolsOut" labelText="Tool catalog (JSON)" value={tools ? JSON.stringify(tools, null, 2) : ""} readOnly rows={18} />
      </Column>
    </Grid>
  );
}
