import React, { useEffect, useMemo, useState } from "react";
import { Grid, Column, Tile, Dropdown, InlineNotification, Button } from "@carbon/react";
import { apiGet, mcpCall } from "../lib/api";

type Tenant = { tenantId: string };

export default function ObjectStructuresPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>("");
  const [objectStructures, setObjectStructures] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [schema, setSchema] = useState<any>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    apiGet("/api/tenants")
      .then((d: any) => {
        const ts: Tenant[] = d.tenants ?? [];
        setTenants(ts);
        setTenantId(ts?.[0]?.tenantId ?? "");
      })
      .catch((e: any) => setErr(String(e?.message ?? e)));
  }, []);

  async function loadStructures(tid: string) {
    setErr("");
    if (!tid) return;
    const rpc = await mcpCall(tid, "maximo.metadata.list_object_structures", { tenantId: tid });
    const result = rpc?.result ?? rpc;
    setObjectStructures(result?.objectStructures ?? []);
    setSelected("");
    setSchema(null);
  }

  useEffect(() => {
    loadStructures(tenantId).catch((e: any) => setErr(String(e?.message ?? e)));
  }, [tenantId]);

  async function loadSchema() {
    setErr("");
    if (!tenantId || !selected) return;
    const rpc = await mcpCall(tenantId, "maximo.metadata.get_object_structure", { tenantId, objectStructure: selected });
    setSchema(rpc?.result ?? rpc);
  }

  const fields = useMemo(() => Array.isArray(schema?.fields) ? schema.fields : [], [schema]);

  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <h2>Object Structures</h2>
        {err && <InlineNotification kind="error" title="Error" subtitle={err} />}
      </Column>

      <Column sm={4} md={8} lg={6}>
        <Tile>
          <h4>Browse</h4>
          <Dropdown
            id="tenantSelOS"
            titleText="Tenant"
            items={tenants.map((t) => t.tenantId)}
            selectedItem={tenantId}
            onChange={(e: any) => setTenantId(String(e.selectedItem ?? ""))} label={""}          />
          <Dropdown
            id="osSel"
            titleText="Object structure"
            items={objectStructures}
            selectedItem={selected}
            onChange={(e: any) => setSelected(String(e.selectedItem ?? ""))}
            disabled={!objectStructures.length} label={""}          />
          <div style={{ marginTop: 12 }}>
            <Button size="sm" onClick={() => loadSchema().catch((e) => setErr(String(e?.message ?? e)))} disabled={!selected}>
              Load schema (inferred)
            </Button>
          </div>
        </Tile>
      </Column>

      <Column sm={4} md={8} lg={10}>
        <Tile>
          <h4>Schema</h4>
          <p>This view is inferred from a sample record and cached server-side (TTL configurable per tenant).</p>
          <div style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
            {schema ? JSON.stringify(schema, null, 2) : "(select an object structure and load schema)"}
          </div>
          {fields.length > 0 ? (
            <p style={{ marginTop: 12 }}><strong>Fields:</strong> {fields.join(", ")}</p>
          ) : null}
        </Tile>
      </Column>
    </Grid>
  );
}
