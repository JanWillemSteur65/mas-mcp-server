# MAS MCP Server (FastAPI + Carbon React)

An **independent MCP Server** for **multi-tenant IBM Maximo Application Suite (Manage)** with:

- MCP endpoint (Streamable HTTP) mounted at `/mcp` (MCP Python SDK).
- Carbon React admin UI.
- Users + roles (RBAC).
- Tenants (Manage URL, API key, username/password, default site).
- Discovery: downloads tenant-specific OpenAPI (OAS) and imports **objects + relationship-like refs** (via `$ref` and arrays of `$ref`).
- Messages table: store/review/edit/replay outbound/inbound interactions.
- Concepts table per tenant.
- Trace log table (OpenTelemetry correlation IDs).
- OpenShift deploy manifests using **BuildConfig + ImageStream** in namespace `mas-mcp-server`.

## Key docs / references

- MCP Streamable HTTP transport and requirements (Origin validation, etc.).
- MCP Python SDK mounting examples (Streamable HTTP).
- Maximo API home endpoints `/oslc` or `/api` and dynamic OAS.
- Carbon React packages.

(See citations in the design notes you requested earlier.)

## Repo structure

- `api/` FastAPI backend + MCP tools/resources
- `web/` Carbon React UI
- `deploy/openshift/` BuildConfig/ImageStream/Deploy/Route manifests

## Local dev

### Backend

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export MAS_MCP_DATABASE_URL=postgresql+psycopg2://masmcp:masmcp@localhost:5432/masmcp
export MAS_MCP_JWT_SECRET=CHANGE_ME
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd web
npm i
npm run dev
```

Open UI: `http://localhost:5173`
Backend API: `http://localhost:8000/api`
MCP endpoint: `http://localhost:8000/mcp`

## OpenShift

See `deploy/openshift/README.md`.
