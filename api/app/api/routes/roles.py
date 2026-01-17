from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.db.session import get_db
from app.db.models.role import Role

router = APIRouter()


class RoleCreate(BaseModel):
    name: str


class RoleOut(BaseModel):
    id: int
    name: str


@router.get("", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    return [RoleOut(id=r.id, name=r.name) for r in db.query(Role).order_by(Role.id.asc()).all()]


@router.post("", response_model=RoleOut)
def create_role(body: RoleCreate, db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    if db.query(Role).filter(Role.name == body.name).first():
        raise HTTPException(status_code=409, detail="Role exists")
    r = Role(name=body.name)
    db.add(r)
    db.commit()
    db.refresh(r)
    return RoleOut(id=r.id, name=r.name)
