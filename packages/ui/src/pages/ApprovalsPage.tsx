import React, { useEffect, useState } from "react";
import { Button, Grid, Column, InlineNotification, Tile } from "@carbon/react";
import { apiGet, apiPost } from "../lib/api";

type Approval = {
  id: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  action: string;
  summary: string;
  actor?: string;
};

export default function ApprovalsPage() {  const [items, setItems] = useState<Approval[]>([]);
  const [err, setErr] = useState<string>("");

  async function load() {
    setErr("");
    const d: any = await apiGet("/api/approvals");
    setItems(d.items ?? []);
  }

  useEffect(() => { load().catch((e:any)=>setErr(String(e?.message ?? e))); }, []);

  async function approve(id: string) {
    setErr("");
    await apiPost(`/api/approvals/${encodeURIComponent(id)}/approve`, {});
    await load();
  }

  async function reject(id: string) {
    setErr("");
    await apiPost(`/api/approvals/${encodeURIComponent(id)}/reject`, {});
    await load();
  }

  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <h2>Approvals</h2>
        {err && <InlineNotification kind="error" title="Error" subtitle={err} />}
        {!true && (
          <InlineNotification kind="info" title="Approvals disabled" subtitle="Set APPROVALS_ENABLED=true on the server to require approvals." lowContrast />
        )}
      </Column>

      <Column sm={4} md={8} lg={16}>
        {items.map((a) => (
          <Tile key={a.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent:"space-between", gap: 12 }}>
              <div>
                <h4>{a.action} — {a.status}</h4>
                <p style={{ margin: 0 }}>{a.summary}</p>
                <small>{a.createdAt}</small>
              </div>
              <div style={{ display:"flex", gap: 8, alignItems:"center" }}>
                <Button size="sm" disabled={!true || a.status !== "pending"} onClick={() => approve(a.id).catch((e:any)=>setErr(String(e?.message ?? e)))}>Approve</Button>
                <Button size="sm" kind="danger--tertiary" disabled={!true || a.status !== "pending"} onClick={() => reject(a.id).catch((e:any)=>setErr(String(e?.message ?? e)))}>Reject</Button>
              </div>
            </div>
          </Tile>
        ))}
        {!items.length && <Tile><p>No approvals.</p></Tile>}
      </Column>
    </Grid>
  );
}
