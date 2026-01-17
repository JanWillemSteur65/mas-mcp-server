# OpenShift deployment (namespace: mas-mcp-server)

1. Replace `REPLACE_WITH_YOUR_GIT_URL` in `02-buildconfigs.yaml` with your repo URL.

2. Apply manifests:

```bash
oc apply -f 00-namespace.yaml
oc apply -f 01-imagestreams.yaml
oc apply -f 02-buildconfigs.yaml
oc apply -f 03-config-and-secrets.yaml
oc apply -f 04-postgres.yaml
oc apply -f 05-api.yaml
oc apply -f 06-web.yaml
```

3. Start builds:

```bash
oc -n mas-mcp-server start-build mas-mcp-api
oc -n mas-mcp-server start-build mas-mcp-web
```

4. Default URLs are exposed via Routes:
- API: `/api` and MCP endpoint: `/mcp` on the API route
- UI: root of the web route

## Notes
- For production, use persistent volumes for Postgres.
- Lock down CORS and configure `Origin` validation for MCP clients per MCP transport guidance. citeturn1view1
