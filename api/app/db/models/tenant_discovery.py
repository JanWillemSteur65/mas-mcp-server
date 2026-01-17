from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, JSON, func

from app.db.base import Base


class TenantDiscovery(Base):
    __tablename__ = "tenant_discovery"

    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), primary_key=True)

    # Raw OpenAPI doc (gzipped bytes) + parsed index for fast UI/tool reads
    oas_gz = Column(LargeBinary, nullable=True)
    index_json = Column(JSON, nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
