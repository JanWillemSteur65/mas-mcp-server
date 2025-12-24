import fetch from "node-fetch";
const base = process.env.BASE || "http://localhost:8080";
const tenant = process.env.TENANT || "tenant1";
const r1 = await fetch(`${base}/healthz`);
console.log("healthz", r1.status, await r1.text());
const r2 = await fetch(`${base}/readyz`);
console.log("readyz", r2.status, await r2.text());
const rpc = await fetch(`${base}/mcp`, {method:"POST", headers:{
  "content-type":"application/json",
  "x-tenant-id": tenant
}, body: JSON.stringify({jsonrpc:"2.0", id:"1", method:"mcp.listTools", params:{}})});
console.log("mcp.listTools", rpc.status, await rpc.text());
