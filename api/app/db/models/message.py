from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, func

from app.db.base import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)

    direction = Column(String(8), nullable=False)  # in|out
    status = Column(String(32), nullable=False, default="new")
    endpoint = Column(String(1024), nullable=True)

    payload_json = Column(JSON, nullable=True)
    edited_payload_json = Column(JSON, nullable=True)

    last_error = Column(String(2048), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
