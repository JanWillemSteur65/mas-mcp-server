from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.db.session import get_db
from app.db.models.tenant import Tenant
from app.maximo.client import MaximoClient, TenantAuth
from app.maximo.discovery import parse_oas
from app.db.models.tenant_discovery import TenantDiscovery

router = APIRouter()


class TenantCreate(BaseModel):
    name: str
    manage_url: str
    api_key: str | None = None
    username: str | None = None
    password: str | None = None
    default_site: str | None = None


@router.get("")
def list_tenants(db: Session = Depends(get_db), _=Depends(require_roles("admin", "tenant-admin"))):
    return [t.to_dict() for t in db.query(Tenant).order_by(Tenant.id.asc()).all()]


@router.post("")
def create_tenant(body: TenantCreate, db: Session = Depends(get_db), _=Depends(require_roles("admin", "tenant-admin"))):
    if db.query(Tenant).filter(Tenant.name == body.name).first():
        raise HTTPException(status_code=409, detail="Tenant name exists")
    t = Tenant(
        name=body.name,
        manage_url=body.manage_url,
        api_key=body.api_key,
        username=body.username,
        password=body.password,
        default_site=body.default_site,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t.to_dict()


@router.post("/{tenant_id}/test-connection")
async def test_connection(tenant_id: int, db: Session = Depends(get_db), _=Depends(require_roles("admin", "tenant-admin"))):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    client = MaximoClient(TenantAuth(t.manage_url, t.api_key, t.username, t.password, t.default_site))
    data = await client.get_api_home()
    return {"ok": True, "apiHomeKeys": sorted(list(data.keys()))}


@router.post("/{tenant_id}/discover")
async def discover(tenant_id: int, db: Session = Depends(get_db), _=Depends(require_roles("admin", "tenant-admin"))):
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")

    client = MaximoClient(TenantAuth(t.manage_url, t.api_key, t.username, t.password, t.default_site))
    oas = await client.get_oas(include_actions=True)
    index = parse_oas(oas)

    disc = db.query(TenantDiscovery).filter(TenantDiscovery.tenant_id == tenant_id).first()
    if not disc:
        disc = TenantDiscovery(tenant_id=tenant_id)
        db.add(disc)
    disc.oas_json = oas
    disc.index_json = index
    db.commit()

    return {"tenantId": tenant_id, "oas_version": index.get("oas_version"), "objectCount": len(index.get("objects", {})), "actionCount": len(index.get("actions", []))}
