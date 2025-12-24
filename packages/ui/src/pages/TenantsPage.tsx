import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  DataTable,
  Grid,
  Column,
  InlineNotification,
  TextInput,
  Select,
  SelectItem,
  Tile,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableContainer,
} from "@carbon/react";
import { apiDelete, apiGet, apiPost } from "../lib/api";
import { useCapabilities } from "../lib/capabilities";

type Tenant = {
  tenantId: string;
  authMode: "oauth" | "apiKey";
  baseUrl: string;
  org?: string;
  site?: string;
  oslc?: { whereDefault?: string; pageSize?: number };
  metadataTtlSeconds?: number;
  // Note: apiKey is write-only (the server should not return it).
  apiKey?: string;
};

export default function TenantsPage() {
  const caps = useCapabilities();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [err, setErr] = useState<string>("");

  // Create form
  const [tenantId, setTenantId] = useState("");
  const [authMode, setAuthMode] = useState<"oauth" | "apiKey">("apiKey");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [org, setOrg] = useState("");
  const [site, setSite] = useState("");

  const load = async () => {
    setErr("");
    const d: any = await apiGet("/api/tenants");
    setTenants(d.tenants ?? []);
  };

  useEffect(() => {
    load().catch((e: any) => setErr(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => tenants.map((t) => ({ id: t.tenantId, ...t })), [tenants]);

  async function createTenant() {
    setErr("");
    const newTenant: Tenant = {
      tenantId: tenantId.trim(),
      authMode,
      baseUrl: baseUrl.trim(),
      org: org.trim() || undefined,
      site: site.trim() || undefined,
    };

    // Only include apiKey when creating/updating apiKey tenants.
    // (Server must redact it from reads.)
    if (authMode === "apiKey" && apiKey.trim()) {
      newTenant.apiKey = apiKey.trim();
    }

    if (!newTenant.tenantId || !newTenant.baseUrl) {
      setErr("tenantId and baseUrl are required.");
      return;
    }

    // Optimistic update
    const prev = tenants;
    setTenants((cur) => {
      const filtered = cur.filter((t) => t.tenantId !== newTenant.tenantId);
      return [newTenant, ...filtered];
    });

    try {
      await apiPost("/api/tenants", newTenant);
      await load();
      setTenantId("");
      setApiKey("");
      setBaseUrl("");
      setOrg("");
      setSite("");
    } catch (e: any) {
      setTenants(prev); // rollback
      setErr(String(e?.message ?? e));
    }
  }

  async function deleteTenantRow(id: string) {
    setErr("");
    const prev = tenants;
    setTenants((cur) => cur.filter((t) => t.tenantId !== id));
    try {
      await apiDelete(`/api/tenants/${encodeURIComponent(id)}`);
      await load();
    } catch (e: any) {
      setTenants(prev); // rollback
      setErr(String(e?.message ?? e));
    }
  }

  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <h2>Tenants</h2>
        {err && <InlineNotification kind="error" title="Error" subtitle={err} />}
        <p>
          Tenants are persisted on the server when <code>CONFIG_WRITE_ENABLED=true</code> and a writable PVC is mounted
          at the tenants file path. UI actions are gated by server-reported capabilities.
        </p>
      </Column>

      <Column sm={4} md={8} lg={16}>
        <Tile style={{ marginBottom: 16 }}>
          <h4>Create tenant</h4>
          {!caps.canWriteConfig && (
            <InlineNotification
              kind="info"
              title="Read-only mode"
              subtitle="Server is not allowing config writes. Provide an admin token and enable CONFIG_WRITE_ENABLED."
              lowContrast
            />
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <TextInput
              id="tenantId"
              labelText="Tenant ID"
              value={tenantId}
              onChange={(e) => setTenantId(e.currentTarget.value)}
            />
            <TextInput
              id="baseUrl"
              labelText="Maximo baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.currentTarget.value)}
            />
      {authMode === "apiKey" && (
        <TextInput
          id="apiKey"
          labelText="API key"
          type="password"
          value={apiKey}
          onChange={(e: any) => setApiKey(e.target.value)}
        />
      )}

            <Select
              id="authMode"
              labelText="Auth mode"
              value={authMode}
              onChange={(e) => setAuthMode(e.currentTarget.value as any)}
            >
              <SelectItem value="apiKey" text="API key" />
              <SelectItem value="oauth" text="OAuth (MAS)" />
            </Select>
            <TextInput id="org" labelText="Org (optional)" value={org} onChange={(e) => setOrg(e.currentTarget.value)} />
            <TextInput id="site" labelText="Site (optional)" value={site} onChange={(e) => setSite(e.currentTarget.value)} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Button disabled={!caps.canWriteConfig} onClick={() => createTenant().catch((e) => setErr(String(e?.message ?? e)))}>
              Create
            </Button>
          </div>
        </Tile>
      </Column>

      <Column sm={4} md={8} lg={16}>
        <DataTable
          rows={rows}
          headers={[
            { key: "tenantId", header: "Tenant ID" },
            { key: "authMode", header: "Auth Mode" },
            { key: "baseUrl", header: "Base URL" },
            { key: "org", header: "Org" },
            { key: "site", header: "Site" },
            { key: "actions", header: "Actions" },
          ]}
        >
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map((h) => {
                      // getHeaderProps includes a `key` and sort-handler props; apply to TableHeader (not <th>)
                      const { key: _ignored, ...headerProps } = getHeaderProps({ header: h });

                      return (
                        <TableHeader key={h.key} {...headerProps}>
                          {h.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {rows.map((r) => {
                    // getRowProps includes a `key`; keep our explicit key stable
                    const { key: _ignored, ...rowProps } = getRowProps({ row: r });

                    return (
                      <TableRow key={r.id} {...rowProps}>
                        {r.cells.map((c) => {
                          if (c.info.header === "actions") {
                            return (
                              <TableCell key={c.id}>
                                <Button
                                  kind="danger--tertiary"
                                  size="sm"
                                  disabled={!caps.canWriteConfig}
                                  onClick={() =>
                                    deleteTenantRow(r.id).catch((e) => setErr(String(e?.message ?? e)))
                                  }
                                >
                                  Delete
                                </Button>
                              </TableCell>
                            );
                          }

                          return <TableCell key={c.id}>{String(c.value ?? "")}</TableCell>;
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      </Column>
    </Grid>
  );
}