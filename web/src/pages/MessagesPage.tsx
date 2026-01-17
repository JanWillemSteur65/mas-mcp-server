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
  TextArea,
  Dropdown,
  Modal,
  Stack,
} from "@carbon/react";
import { api } from "../api/client";

export default function MessagesPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenant, setTenant] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [payload, setPayload] = useState("{}...");

  useEffect(() => {
    api.tenants().then((t) => {
      setTenants(t);
      setTenant(t[0] || null);
    });
  }, []);

  useEffect(() => {
    if (!tenant) return;
    api.messages(tenant.id).then(setMessages);
  }, [tenant]);

  const headers = [
    { key: "id", header: "ID" },
    { key: "direction", header: "Direction" },
    { key: "status", header: "Status" },
    { key: "endpoint", header: "Endpoint" },
    { key: "created_at", header: "Created" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Messages</h2>
      <div style={{ maxWidth: 420, margin: "1rem 0" }}>
        <Dropdown
          id="tenant"
          titleText="Tenant"
          label={tenant ? tenant.name : "Select"}
          items={tenants}
          itemToString={(i) => (i ? i.name : "")}
          onChange={(e) => setTenant(e.selectedItem)}
        />
      </div>

      <DataTable rows={messages} headers={headers}>
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
                    <Button size="sm" kind="tertiary" onClick={() => {
                      const m = messages.find((x) => x.id === Number(row.id));
                      setEdit(m);
                      setPayload(JSON.stringify(m.edited_payload_json || m.payload_json || {}, null, 2));
                    }}>Edit</Button>
                    <Button size="sm" kind="ghost" onClick={() => api.replayMessage(tenant.id, Number(row.id)).then(() => api.messages(tenant.id).then(setMessages))}>Replay</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>

      <Modal open={!!edit} modalHeading={`Edit message #${edit?.id}`} primaryButtonText="Save" secondaryButtonText="Cancel"
        onRequestClose={() => setEdit(null)}
        onRequestSubmit={() => {
          api.updateMessage(tenant.id, edit.id, { edited_payload_json: JSON.parse(payload) }).then(() => {
            setEdit(null);
            api.messages(tenant.id).then(setMessages);
          });
        }}
      >
        <Stack gap={5}>
          <TextArea labelText="Payload" value={payload} onChange={(e) => setPayload(e.target.value)} rows={14} />
        </Stack>
      </Modal>
    </div>
  );
}
