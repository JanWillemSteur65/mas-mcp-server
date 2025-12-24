# Maximo MCP Server on OpenShift (Monorepo)

This repository deploys an **MCP (Model Context Protocol) server** for **IBM Maximo Manage / MAS**, plus a **Carbon React UI** that includes an **AI Assistant** page.

## Endpoints

- UI: `GET /`
- Health: `GET /healthz`, `GET /readyz`
- MCP JSON-RPC: `POST /mcp` (requires `x-tenant-id` header)
- Admin API:
  - `GET /api/status`
  - `GET /api/tenants`
  - `POST /api/tenants` (persisted to tenants.json on PVC)
  - `DELETE /api/tenants/:tenantId`
  - `GET /api/providers` (provider config + optional model lists)
- AI Assistant:
  - `POST /api/assistant/chat` (tool-first retrieval via MCP + optional LLM summarization)

## OpenShift start-to-finish

### 1) Create a project

```bash
oc new-project mas-mcp-server
```

### 2) Create a writable PVC for server-side persistence

Tenants are stored in a JSON file on a PVC so you can add tenants without redeploying.

- Directory: `/opt/app-root/src/data`
- File: `/opt/app-root/src/data/tenants.json`

```bash
oc apply -f - <<'YAML'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: maximo-mcp-data
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 1Gi
YAML
```

### 3) Create Secrets for AI providers

The server reads secrets as environment variables (the UI never stores keys).

Model dropdowns are driven by optional `*_MODELS` vars (comma-separated). If you omit them, the UI allows free-text model entry.

#### OpenAI
```bash
oc create secret generic maximo-mcp-openai   --from-literal=OPENAI_API_KEY=sk-xxxxx   --from-literal=OPENAI_MODELS="gpt-4o-mini,gpt-4.1-mini"
```

#### Anthropic
```bash
oc create secret generic maximo-mcp-anthropic   --from-literal=ANTHROPIC_API_KEY=sk-ant-xxxxx   --from-literal=ANTHROPIC_MODELS="claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022"
```

#### Gemini
```bash
oc create secret generic maximo-mcp-gemini   --from-literal=GEMINI_API_KEY=xxxxx   --from-literal=GEMINI_MODELS="gemini-1.5-pro,gemini-1.5-flash"
```

#### Mistral
```bash
oc create secret generic maximo-mcp-mistral   --from-literal=MISTRAL_API_KEY=xxxxx   --from-literal=MISTRAL_MODELS="mistral-large-latest,mistral-small-latest"
```

#### watsonx (portable mode)
Because watsonx varies by environment, this build supports a portable mode using a configurable chat URL and bearer token:

```bash
oc create secret generic maximo-mcp-watsonx   --from-literal=WATSONX_CHAT_URL="https://<your-watsonx-chat-endpoint>"   --from-literal=WATSONX_BEARER_TOKEN="<bearer-token>"   --from-literal=WATSONX_MODELS="granite-13b-chat-v2,granite-20b-multilingual"
```

If no provider is configured, the AI Assistant still works in **tool-first mode** (it will retrieve data via MCP and show the trace).

### 4) Build the image in-cluster

Apply the OpenShift build resources:

```bash
oc apply -f deploy/openshift/imagestream.yaml
oc apply -f deploy/openshift/buildconfig.yaml
```

Start and follow the build:

```bash
oc start-build maximo-mcp --follow
```

### 5) Deploy runtime (Deployment + Service + Route)

```bash
oc apply -f deploy/openshift/runtime.yaml
oc rollout status deploy/maximo-mcp
oc expose svc/maximo-mcp
oc get route maximo-mcp -o jsonpath='{.spec.host}{"
"}'
```

### 6) Confirm the Deployment wiring

Your Deployment must include:

- PVC mount (writable)
- `TENANTS_FILE` pointing to the PVC file
- `CONFIG_WRITE_ENABLED=true`
- provider secrets via `envFrom`

Example (snippet):

```yaml
env:
  - name: TENANTS_FILE
    value: /opt/app-root/src/data/tenants.json
  - name: CONFIG_WRITE_ENABLED
    value: "true"
envFrom:
  - secretRef: { name: maximo-mcp-openai }
  - secretRef: { name: maximo-mcp-anthropic }
  - secretRef: { name: maximo-mcp-gemini }
  - secretRef: { name: maximo-mcp-mistral }
  - secretRef: { name: maximo-mcp-watsonx }
volumeMounts:
  - name: data
    mountPath: /opt/app-root/src/data
volumes:
  - name: data
    persistentVolumeClaim:
      claimName: maximo-mcp-data
```

## Using the UI

Open the Route host in your browser. The left navigation includes the **AI Assistant** page.

You can also deep-link using hash routing:

- `https://<host>/#agent` (AI Assistant)

## Smoke tests

```bash
HOST=$(oc get route maximo-mcp -o jsonpath='{.spec.host}')

curl -sk https://$HOST/healthz
curl -sk https://$HOST/readyz
curl -sk https://$HOST/api/status | jq
curl -sk https://$HOST/api/providers | jq
curl -sk https://$HOST/api/tenants | jq
```

List MCP tools:

```bash
curl -sk https://$HOST/mcp   -H 'content-type: application/json'   -H 'x-tenant-id: <tenantId>'   -d '{"jsonrpc":"2.0","id":"1","method":"mcp.listTools","params":{}}' | jq
```

## Notes on Maximo schemas/metadata/object structures

Schemas/metadata/object structures are loaded and browsed through MCP tools exposed by the server. In the UI, use **Schema & Tools** and **Object Structures** pages to browse and invoke these tools against the selected tenant.

## Troubleshooting

### UI looks unchanged
- Ensure your Deployment points to the newest image digest (avoid stale `:latest`).
- Hard refresh the browser.
- Inspect the UI dist assets in the running pod.

### Readiness probe 503
- Check server logs: `oc logs deploy/maximo-mcp -f`
- Ensure the tenants PVC mount is writable and `TENANTS_FILE` points to the mounted location.

