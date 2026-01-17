from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.db.session import get_db
from app.db.models.setting import Setting

router = APIRouter()


class SettingsUpdate(BaseModel):
    scope: str  # global|tenant
    scope_id: int | None = None
    settings_json: dict


@router.get("")
def get_settings(scope: str = "global", scope_id: int | None = None, db: Session = Depends(get_db), _=Depends(require_roles("admin", "operator", "viewer"))):
    row = db.query(Setting).filter(Setting.scope == scope, Setting.scope_id == scope_id).first()
    return row.to_dict() if row else {"scope": scope, "scope_id": scope_id, "settings_json": {}}


@router.put("")
def update_settings(body: SettingsUpdate, db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    row = db.query(Setting).filter(Setting.scope == body.scope, Setting.scope_id == body.scope_id).first()
    if not row:
        row = Setting(scope=body.scope, scope_id=body.scope_id)
        db.add(row)
    row.settings_json = body.settings_json
    db.commit()
    db.refresh(row)
    return row.to_dict()
