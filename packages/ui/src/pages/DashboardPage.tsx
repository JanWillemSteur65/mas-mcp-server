import React, { useEffect, useState } from "react";
import { Tile, Grid, Column, InlineNotification } from "@carbon/react";
import { apiGet } from "../lib/api";
export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>("");
  useEffect(() => { apiGet("/api/status").then(setData).catch(e => setErr(String(e?.message ?? e))); }, []);
  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <h2>Dashboard</h2>
        {err && <InlineNotification kind="error" title="Failed to load status" subtitle={err} />}
      </Column>
      {data && <>
        <Column sm={4} md={4} lg={4}><Tile><h4>Uptime</h4><p>{data.uptimeSeconds}s</p></Tile></Column>
        <Column sm={4} md={4} lg={4}><Tile><h4>Tenants</h4><p>{data.tenantCount}</p></Tile></Column>
        <Column sm={4} md={4} lg={4}><Tile><h4>Tool limit</h4><p>{data.toolCatalogLimit}</p></Tile></Column>
        <Column sm={4} md={4} lg={4}><Tile><h4>Write enabled</h4><p>{String(data.configWriteEnabled)}</p></Tile></Column>
      </>}
    </Grid>
  );
}
