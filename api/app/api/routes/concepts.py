from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.db.session import get_db
from app.db.models.concept import Concept

router = APIRouter()


class ConceptCreate(BaseModel):
    tenant_id: int
    name: str
    description: str | None = None
    mapping_json: dict | None = None


@router.get("")
def list_concepts(tenant_id: int, db: Session = Depends(get_db), _=Depends(require_roles("admin", "operator", "viewer"))):
    return [c.to_dict() for c in db.query(Concept).filter(Concept.tenant_id == tenant_id).order_by(Concept.id.desc()).all()]


@router.post("")
def create_concept(body: ConceptCreate, db: Session = Depends(get_db), _=Depends(require_roles("admin", "operator"))):
    c = Concept(tenant_id=body.tenant_id, name=body.name, description=body.description, mapping_json=body.mapping_json or {})
    db.add(c)
    db.commit()
    db.refresh(c)
    return c.to_dict()
