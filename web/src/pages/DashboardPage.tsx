import React, { useEffect, useState } from "react";
import { Tile } from "@carbon/react";
import { SimpleBarChart, DonutChart } from "@carbon/charts-react";
import "@carbon/charts/styles.css";
import { api } from "../api/client";

export default function DashboardPage() {
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    api.tenants().then(setTenants).catch(() => setTenants([]));
  }, []);

  const barData = tenants.map((t) => ({ group: t.name, value: t.last_discovery_object_count || 0 }));
  const donutData = [
    { group: "Tenants", value: tenants.length },
    { group: "Discovered", value: tenants.filter((t) => t.last_discovery_at).length },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Dashboard</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1rem" }}>
        <Tile><h4>Tenants</h4><div style={{ fontSize: "2rem" }}>{tenants.length}</div></Tile>
        <Tile><h4>Discovered</h4><div style={{ fontSize: "2rem" }}>{tenants.filter((t) => t.last_discovery_at).length}</div></Tile>
        <Tile><h4>MCP endpoint</h4><div>/mcp</div></Tile>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginTop: "1.5rem" }}>
        <Tile>
          <h4>Objects discovered per tenant</h4>
          <SimpleBarChart
            data={barData}
            options={{
              title: "",
              axes: {
                left: { mapsTo: "value" },
                bottom: { mapsTo: "group", scaleType: "labels" },
              },
              height: "320px",
            }}
          />
        </Tile>
        <Tile>
          <h4>Discovery coverage</h4>
          <DonutChart data={donutData} options={{ donut: { center: { label: "Tenants" } }, height: "320px" }} />
        </Tile>
      </div>
    </div>
  );
}
