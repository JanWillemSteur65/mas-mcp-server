from __future__ import annotations

import contextlib
from typing import Any

from mcp.server.fastmcp import FastMCP
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models.tenant import Tenant
from app.db.models.tenant_discovery import TenantDiscovery
from app.db.models.message import Message
from app.maximo.client import MaximoClient, TenantAuth
from app.maximo.discovery import parse_oas

mcp = FastMCP("MAS MCP Server")


def _db() -> Session:
    return SessionLocal()


def _tenant_auth(tenant: Tenant) -> TenantAuth:
    return TenantAuth(
        manage_url=tenant.manage_url,
        api_key=tenant.api_key,
        username=tenant.username,
        password=tenant.password,
        default_site=tenant.default_site,
    )


@mcp.tool()
async def tenant_list() -> list[dict[str, Any]]:
    """List configured tenants."""
    db = _db()
    try:
        rows = db.query(Tenant).order_by(Tenant.id.asc()).all()
        return [t.to_dict() for t in rows]
    finally:
        db.close()


@mcp.tool()
async def tenant_discover(tenant_id: int) -> dict[str, Any]:
    """Fetch and index Maximo OAS for a tenant."""
    db = _db()
    try:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError("Tenant not found")

        client = MaximoClient(_tenant_auth(tenant))
        oas = await client.get_oas(include_actions=True)
        index = parse_oas(oas)

        existing = db.query(TenantDiscovery).filter(TenantDiscovery.tenant_id == tenant_id).first()
        if not existing:
            existing = TenantDiscovery(tenant_id=tenant_id)
            db.add(existing)
        existing.oas_json = oas
        existing.index_json = index
        db.commit()

        return {"tenantId": tenant_id, "oas_version": index.get("oas_version"), "objectCount": len(index.get("objects", {})), "actionCount": len(index.get("actions", []))}
    finally:
        db.close()


@mcp.tool()
async def maximo_objects_list(tenant_id: int) -> list[str]:
    """Return object names discovered from OAS."""
    db = _db()
    try:
        disc = db.query(TenantDiscovery).filter(TenantDiscovery.tenant_id == tenant_id).first()
        if not disc or not disc.index_json:
            raise ValueError("Tenant has no discovery index. Run tenant_discover first.")
        return sorted(list((disc.index_json.get("objects") or {}).keys()))
    finally:
        db.close()


@mcp.tool()
async def maximo_object_schema(tenant_id: int, object_name: str) -> dict[str, Any]:
    """Return schema (fields + relationship-like refs) for an object."""
    db = _db()
    try:
        disc = db.query(TenantDiscovery).filter(TenantDiscovery.tenant_id == tenant_id).first()
        objects = (disc.index_json.get("objects") or {}) if disc and disc.index_json else {}
        if object_name not in objects:
            raise ValueError("Object not found in discovery index")
        return objects[object_name]
    finally:
        db.close()


@mcp.tool()
async def maximo_action_list(tenant_id: int) -> list[dict[str, Any]]:
    """List discovered action endpoints."""
    db = _db()
    try:
        disc = db.query(TenantDiscovery).filter(TenantDiscovery.tenant_id == tenant_id).first()
        if not disc or not disc.index_json:
            raise ValueError("No discovery index")
        return disc.index_json.get("actions") or []
    finally:
        db.close()


@mcp.tool()
async def maximo_request(tenant_id: int, method: str, path: str, params: dict[str, Any] | None = None, body: Any | None = None) -> Any:
    """Low-level request to a tenant (use with care)."""
    db = _db()
    try:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError("Tenant not found")
        client = MaximoClient(_tenant_auth(tenant))
        return await client.request(method, path, params=params, json=body)
    finally:
        db.close()


@mcp.resource("maximo://tenant/{tenant_id}/oas")
async def resource_oas(tenant_id: str) -> str:
    """Return raw OAS JSON as a string."""
    db = _db()
    try:
        disc = db.query(TenantDiscovery).filter(TenantDiscovery.tenant_id == int(tenant_id)).first()
        if not disc or not disc.oas_json:
            return "{}"
        import json
        return json.dumps(disc.oas_json)
    finally:
        db.close()


@mcp.resource("maximo://tenant/{tenant_id}/object/{object_name}/schema")
async def resource_schema(tenant_id: str, object_name: str) -> str:
    db = _db()
    try:
        disc = db.query(TenantDiscovery).filter(TenantDiscovery.tenant_id == int(tenant_id)).first()
        objects = (disc.index_json.get("objects") or {}) if disc and disc.index_json else {}
        import json
        return json.dumps(objects.get(object_name) or {})
    finally:
        db.close()


@contextlib.asynccontextmanager
async def mcp_lifespan():
    async with mcp.session_manager.run():
        yield
