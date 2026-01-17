from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.db.session import get_db
from app.db.models.trace_log import TraceLog

router = APIRouter()


@router.get("/trace")
def trace_logs(tenant_id: int | None = None, level: str | None = None, limit: int = 500, db: Session = Depends(get_db), _=Depends(require_roles("admin", "operator", "viewer"))):
    q = db.query(TraceLog)
    if tenant_id is not None:
        q = q.filter(TraceLog.tenant_id == tenant_id)
    if level is not None:
        q = q.filter(TraceLog.level == level)
    rows = q.order_by(TraceLog.id.desc()).limit(min(limit, 2000)).all()
    return [r.to_dict() for r in rows]
