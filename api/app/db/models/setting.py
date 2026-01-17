from __future__ import annotations

from sqlalchemy import Column, DateTime, Integer, JSON, String, func

from app.db.base import Base


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)
    scope = Column(String(16), nullable=False)  # global|tenant
    scope_id = Column(Integer, nullable=True)

    settings_json = Column(JSON, nullable=False, default=dict)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    updated_by = Column(Integer, nullable=True)
