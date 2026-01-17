from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.db.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False, index=True)
    manage_url = Column(String(1024), nullable=False)
    default_site = Column(String(32), nullable=True)

    # Basic auth inputs (stored encrypted or as secret references)
    api_key_enc = Column(String(2048), nullable=True)
    username_enc = Column(String(512), nullable=True)
    password_enc = Column(String(2048), nullable=True)
    secret_ref = Column(String(512), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    last_discovery_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
