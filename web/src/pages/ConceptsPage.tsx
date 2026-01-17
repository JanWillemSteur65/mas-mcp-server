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
  Dropdown,
  Modal,
  TextInput,
  TextArea,
  Stack,
} from "@carbon/react";
import { api } from "../api/client";

export default function ConceptsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any | null>(null);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", description: "", mapping_json: "{}" });

  useEffect(() => {
    api.tenants().then((t) => { setTenants(t); setTenant(t[0] || null); });
  }, []);

  useEffect(() => {
    if (!tenant) return;
    api.concepts(tenant.id).then(setConcepts);
  }, [tenant]);

  const headers = [
    { key: "id", header: "ID" },
    { key: "name", header: "Name" },
    { key: "description", header: "Description" },
    { key: "updated_at", header: "Updated" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Concepts</h2>
      <div style={{ display: "flex", gap: "1rem", alignItems: "end" }}>
        <div style={{ maxWidth: 420 }}>
          <Dropdown id="tenant" titleText="Tenant" label={tenant ? tenant.name : "Select"} items={tenants} itemToString={(i) => (i ? i.name : "")} onChange={(e) => setTenant(e.selectedItem)} />
        </div>
        <Button onClick={() => setOpen(true)}>Add concept</Button>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <DataTable rows={concepts} headers={headers}>
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

      <Modal open={open} modalHeading="Add concept" primaryButtonText="Save" secondaryButtonText="Cancel"
        onRequestClose={() => setOpen(false)}
        onRequestSubmit={() => {
          api.upsertConcept(tenant.id, { ...form, mapping_json: JSON.parse(form.mapping_json) }).then(() => {
            setOpen(false);
            setForm({ name: "", description: "", mapping_json: "{}" });
            api.concepts(tenant.id).then(setConcepts);
          });
        }}
      >
        <Stack gap={5}>
          <TextInput id="name" labelText="Concept name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextInput id="desc" labelText="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextArea id="map" labelText="Mapping (JSON stored, but you can write it here for now)" value={form.mapping_json} onChange={(e) => setForm({ ...form, mapping_json: e.target.value })} rows={10} />
        </Stack>
      </Modal>
    </div>
  );
}
