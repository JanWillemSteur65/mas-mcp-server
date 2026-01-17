from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func

from app.db.base import Base


class TenantCredential(Base):
    __tablename__ = "tenant_credentials"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)

    # Store either encrypted values OR a secret reference
    api_key_enc = Column(String(2048), nullable=True)
    username_enc = Column(String(512), nullable=True)
    password_enc = Column(String(512), nullable=True)

    secret_ref = Column(String(512), nullable=True)  # e.g. openshift secret name/key

    rotated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
