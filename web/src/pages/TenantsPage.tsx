import React, { useEffect, useState } from "react";
import {
  Button,
  DataTable,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TextInput,
  Modal,
  Stack,
} from "@carbon/react";
import { api } from "../api/client";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", manage_url: "", api_key: "", username: "", password: "", default_site: "" });

  const load = () => api.tenants().then(setTenants);
  useEffect(() => { load(); }, []);

  const headers = [
    { key: "id", header: "ID" },
    { key: "name", header: "Name" },
    { key: "manage_url", header: "Manage URL" },
    { key: "default_site", header: "Default site" },
    { key: "last_discovery_at", header: "Last discovery" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Tenants</h2>
      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        <Button onClick={() => setOpen(true)}>Add tenant</Button>
      </div>

      <DataTable rows={tenants} headers={headers}>
        {({ rows, headers, getHeaderProps, getRowProps }) => (
          <Table>
            <TableHead>
              <TableRow>
                {headers.map((h) => (
                  <TableHeader key={h.key} {...getHeaderProps({ header: h })}>{h.header}</TableHeader>
                ))}
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} {...getRowProps({ row })}>
                  {row.cells.map((c) => (
                    <TableCell key={c.id}>{c.value}</TableCell>
                  ))}
                  <TableCell>
                    <Button
                      size="sm"
                      kind="tertiary"
                      onClick={() => api.discoverTenant(Number(row.id)).then(load)}
                    >
                      Discover
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <Modal open={open} modalHeading="Add tenant" primaryButtonText="Save" secondaryButtonText="Cancel"
        onRequestClose={() => setOpen(false)}
        onRequestSubmit={() => {
          api.createTenant(form).then(() => { setOpen(false); setForm({ name: "", manage_url: "", api_key: "", username: "", password: "", default_site: "" }); load(); });
        }}
      >
        <Stack gap={5}>
          <TextInput id="name" labelText="Tenant name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextInput id="url" labelText="Maximo Manage base URL" value={form.manage_url} onChange={(e) => setForm({ ...form, manage_url: e.target.value })} />
          <TextInput id="site" labelText="Default site" value={form.default_site} onChange={(e) => setForm({ ...form, default_site: e.target.value })} />
          <TextInput id="api" labelText="API key (optional)" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
          <TextInput id="user" labelText="Username (optional)" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <TextInput id="pass" labelText="Password (optional)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Stack>
      </Modal>
    </div>
  );
}
