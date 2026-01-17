from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.db.session import get_db
from app.db.models.message import Message

router = APIRouter()


class MessageUpdate(BaseModel):
    edited_payload_json: dict | None = None
    status: str | None = None


@router.get("")
def list_messages(tenant_id: int | None = None, db: Session = Depends(get_db), _=Depends(require_roles("admin", "operator", "viewer"))):
    q = db.query(Message)
    if tenant_id is not None:
        q = q.filter(Message.tenant_id == tenant_id)
    return [m.to_dict() for m in q.order_by(Message.id.desc()).limit(500).all()]


@router.patch("/{message_id}")
def update_message(message_id: int, body: MessageUpdate, db: Session = Depends(get_db), _=Depends(require_roles("admin", "operator"))):
    m = db.query(Message).filter(Message.id == message_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Message not found")
    if body.edited_payload_json is not None:
        m.edited_payload_json = body.edited_payload_json
    if body.status is not None:
        m.status = body.status
    db.commit()
    db.refresh(m)
    return m.to_dict()
