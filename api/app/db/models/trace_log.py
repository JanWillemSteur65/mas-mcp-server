from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, func

from app.db.base import Base


class TraceLog(Base):
    __tablename__ = "trace_logs"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=True)

    level = Column(String(16), nullable=False, default="info")
    source = Column(String(64), nullable=True)

    trace_id = Column(String(64), nullable=True)
    span_id = Column(String(64), nullable=True)

    message = Column(String(4096), nullable=False)
    meta_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
