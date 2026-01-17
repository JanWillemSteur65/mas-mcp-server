import React, { useEffect, useState } from "react";
import {
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Dropdown,
} from "@carbon/react";
import { api } from "../api/client";

export default function TracePage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.tenants().then((t) => { setTenants(t); setTenant(t[0] || null); });
  }, []);

  useEffect(() => {
    if (!tenant) return;
    api.traces(tenant.id).then(setLogs);
  }, [tenant]);

  const headers = [
    { key: "created_at", header: "Time" },
    { key: "level", header: "Level" },
    { key: "source", header: "Source" },
    { key: "trace_id", header: "Trace" },
    { key: "message", header: "Message" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Trace log</h2>
      <div style={{ maxWidth: 420, margin: "1rem 0" }}>
        <Dropdown id="tenant" titleText="Tenant" label={tenant ? tenant.name : "Select"} items={tenants} itemToString={(i) => (i ? i.name : "")} onChange={(e) => setTenant(e.selectedItem)} />
      </div>

      <DataTable rows={logs} headers={headers}>
        {({ rows, headers, getHeaderProps, getRowProps }) => (
          <Table>
            <TableHead>
              <TableRow>
                {headers.map((h) => (
                  <TableHeader key={h.key} {...getHeaderProps({ header: h })}>{h.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} {...getRowProps({ row })}>
                  {row.cells.map((c) => (
                    <TableCell key={c.id}>{c.value}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </div>
  );
}
